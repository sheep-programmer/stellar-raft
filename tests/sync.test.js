/* 星图 Stellar Raft — 同步层（api.js / SRNet）行为测试
   同步是这个应用最输不起的一层：星空「整片一次整存」，乐观锁版本号是唯一
   的并发防线。这里在 vm 里加载真代码（localStorage / fetch / navigator 全 mock），
   驱动真场景：

   1. PUT 成功：本地镜像从 pending 转确认，syncVer 跟进服务器版本
   2. 409 收敛：镜像与版本对齐服务器，dirty 清掉——不再把刚收敛的版本
      原样推回去（冲突放大：内容没变、版本空涨、其它设备跟着 409）
   3. saveNow 直调也要排在在飞那一发后面（登出/交接的冲刷路径），
      两发串行、各带正确的 baseVersion，绝不自撞 409
   4. ready 闸：水合完成前的编辑先落本机镜像（pending），setReady 后补推 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'ui_kits/stellar-raft/api.js'), 'utf8');

// 搭一个可控的世界：localStorage 是 Map，fetch 按脚本应答并记录每次调用
function makeWorld({ ready = true } = {}) {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const fetchCalls = [];
  const script = [];   // [{ respond: (call) => Promise<{status, body}> }]
  const fetch = (url, opts = {}) => {
    const call = { url, opts, body: opts.body ? JSON.parse(opts.body) : undefined };
    fetchCalls.push(call);
    const handler = script.length ? script.shift() : null;
    assert.ok(handler, 'fetch 被调用却没有脚本应答：' + url);
    return Promise.resolve(handler(call)).then(({ status, body }) => ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }));
  };
  const listeners = {};
  const ctx = {
    console,
    localStorage,
    fetch,
    navigator: {},
    crypto: { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2, 8) },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => { },
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeEventListener: () => { },
    document: { hidden: true },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
  };
  ctx.window = ctx;
  ctx.window.dispatchEvent = () => true;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'api.js' });
  const N = ctx.window.SRNet;
  // 最小可用的 SR_DATA
  ctx.window.SR_DATA = {
    constellations: [], stars: [], connections: [], notes: [], inbox: [], timeline: [], trash: [],
    account: { name: '测', avatar: '测', bio: '' },
  };
  if (ready) N.setReady();
  const mirror = () => { const m = store.get('sr.galaxy.v1'); return m ? JSON.parse(m) : null; };
  const puts = () => fetchCalls.filter(c => c.url === '/api/galaxy' && c.opts.method === 'PUT');
  return { N, store, script, mirror, puts, ctx };
}

test('PUT 成功：镜像先 pending 后确认，syncVer 跟进服务器的版本', async () => {
  const w = makeWorld();
  w.N.setVersion(1);
  w.script.push(() => ({ status: 200, body: { ok: true, version: 2 } }));
  await w.N.saveNow();
  const m = w.mirror();
  assert.equal(m.syncVer, 2, '确认后镜像记服务器的版本');
  assert.equal(m.pending, false, '确认后不再是 pending');
  assert.equal(w.N.getVersion(), 2);
});

test('409 收敛：对齐服务器版本、镜像换血、且不再把收敛来的版本推回去（不放大冲突）', async () => {
  const w = makeWorld();
  w.N.setVersion(1);
  const serverGalaxy = { constellations: [], stars: [{ id: 's1', label: '别人的' }], connections: [], notes: [], inbox: [], timeline: [], trash: [] };
  // 第一发：飞行途中再 schedule()（dirty=true），随后这一发撞 409
  w.script.push(() => ({ status: 409, body: { error: '版本冲突', version: 5, data: serverGalaxy } }));
  const p = w.N.saveNow();
  w.N.schedule();   // 飞行窗口内的编辑 → dirty
  await p;
  // dirty 若没被清掉，finally 会把刚收敛的服务器版本原样推回去（1200ms 防抖后）。
  // 等过整个防抖窗口再断言——只等几十毫秒的话这条断言是空转的
  await new Promise(r => setTimeout(r, 1400));
  assert.equal(w.N.getVersion(), 5, '版本对齐到服务器');
  const m = w.mirror();
  assert.equal(m.syncVer, 5);
  assert.deepEqual(m.data.stars[0].label, '别人的', '镜像已收敛为服务器版本');
  assert.equal(w.puts().length, 1, 'dirty 已在收敛时清掉：不再把服务器版原样推回去（冲突放大）');
}, { timeout: 10000 });

test('saveNow 直调排队：两发串行，第二发带着第一发落地后的新 baseVersion', async () => {
  const w = makeWorld();
  w.N.setVersion(1);
  const baseVersions = [];
  w.script.push(() => ({ status: 200, body: { ok: true, version: 2 } }));
  w.script.push(() => ({ status: 200, body: { ok: true, version: 3 } }));
  const p1 = w.N.saveNow();
  const p2 = w.N.saveNow();   // 直接调用也要排在 p1 后面，而不是并发出门自撞 409
  await Promise.all([p1, p2]);
  const calls = w.puts();
  assert.equal(calls.length, 2);
  calls.forEach(c => baseVersions.push(c.body.baseVersion));
  assert.deepEqual(baseVersions, [1, 2], '第二发必须基于第一发落地后的版本');
});

test('ready 闸：水合完成前的编辑先落本机镜像（pending），setReady 后补推', async () => {
  const w = makeWorld({ ready: false });
  w.N.schedule();   // 水合窗口内的编辑
  assert.equal(w.puts().length, 0, '还没 ready 不上传');
  const m0 = w.mirror();
  assert.ok(m0, '但本机镜像必须已经落下');
  assert.equal(m0.pending, true);
  w.script.push(() => ({ status: 200, body: { ok: true, version: 1 } }));
  w.N.setReady();   // 翻转：dirty 的补推应当立刻发生
  await new Promise(r => setTimeout(r, 30));
  assert.equal(w.puts().length, 1, 'setReady 后补推了一发');
});

test('启动因果比较（镜像语义）：syncVer 相等且 pending = 别处没写过，本地为准', async () => {
  // 这条不跑代码，钉住协议本身：saveLocal 的镜像形状是 data.js 启动决策的依据
  const w = makeWorld();
  w.N.setVersion(7);
  w.N.saveLocal({ savedAt: 1, stars: [], constellations: [] }, 7, true);
  const m = w.mirror();
  assert.equal(m.syncVer, 7);
  assert.equal(m.pending, true);
  w.N.saveLocal({ savedAt: 2, stars: [], constellations: [] }, 7, false);
  assert.equal(w.mirror().pending, false);
});
