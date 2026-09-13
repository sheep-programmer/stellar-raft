/* 星图 Stellar Raft — 跨平台适配

   这套 UI 有完整的手机断点与手势，可服务器长期只听 127.0.0.1 —— 手机根本连不上，
   那套布局只能靠缩浏览器窗口来看。SR_HOST 把这件事打通，默认仍然只听回环。

   而一旦真的用手机打开 http://192.168.x.x:8756，就掉进了**非安全上下文**：
   浏览器会直接抹掉 navigator.clipboard。以前几处复制照样弹「已复制」，
   手机上什么都没发生。SRCopy 负责如实回答成没成。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

// 这台机器上的一个非回环 IPv4（没有就跳过那条用例——CI 容器里未必有）
const lanIp = () => {
  for (const list of Object.values(os.networkInterfaces() || {})) {
    for (const ni of list || []) if (ni && ni.family === 'IPv4' && !ni.internal) return ni.address;
  }
  return null;
};

async function boot(env) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-platform-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, PORT: String(port), SR_DB: path.join(tmp, 'stellar.db'), ...(env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const box = { logs: '' };
  child.stdout.on('data', d => (box.logs += d));
  child.stderr.on('data', d => (box.logs += d));
  for (let i = 0; ; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' })).status) break; } catch { /* 还没起来 */ }
    if (i > 200) throw new Error('server did not start:\n' + box.logs);
    await new Promise(r => setTimeout(r, 50));
  }
  return { port, child, tmp, box, stop() { child.kill('SIGKILL'); fs.rmSync(tmp, { recursive: true, force: true }); } };
}

const reachable = (host, port) => new Promise((resolve) => {
  const s = net.connect({ host, port });
  const done = (ok) => { try { s.destroy(); } catch { /* 已经断了 */ } resolve(ok); };
  s.setTimeout(1500);
  s.on('connect', () => done(true));
  s.on('error', () => done(false));
  s.on('timeout', () => done(false));
});

test('默认只听回环：不设 SR_HOST 时，局域网地址连不上', async (t) => {
  const ip = lanIp();
  if (!ip) return t.skip('这台机器没有非回环网卡，跳过');
  const srv = await boot({});
  try {
    assert.equal(await reachable('127.0.0.1', srv.port), true, '本机当然要连得上');
    assert.equal(await reachable(ip, srv.port), false,
      `默认不该对局域网开放，但 ${ip}:${srv.port} 连上了`);
  } finally { srv.stop(); }
});

test('SR_HOST=0.0.0.0：手机 / 平板能从局域网打开，且日志把地址直接给出来', async (t) => {
  const ip = lanIp();
  if (!ip) return t.skip('这台机器没有非回环网卡，跳过');
  const srv = await boot({ SR_HOST: '0.0.0.0' });
  try {
    assert.equal(await reachable(ip, srv.port), true, '开了 SR_HOST 就该连得上');
    const r = await fetch(`http://${ip}:${srv.port}/ui_kits/stellar-raft/`);
    assert.equal(r.status, 200, '从局域网地址要能真的打开应用');
    // 「手机怎么打开」不该逼人自己去翻 ifconfig
    assert.match(srv.box.logs, /同一网络下的设备：http:\/\//);
    // 也要提醒这是非安全上下文（剪贴板等 API 会被浏览器关掉）
    assert.match(srv.box.logs, /安全上下文/);
  } finally { srv.stop(); }
});

test('PORT 不是合法端口时立刻说人话退出，而不是 listen 时才炸栈', async () => {
  for (const bad of ['abc', '99999', '0']) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-badport-'));
    try {
      const res = await new Promise((resolve) => {
        const child = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], {
          env: { ...process.env, PORT: bad, SR_DB: path.join(tmp, 'stellar.db') },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let logs = '';
        child.stdout.on('data', d => (logs += d));
        child.stderr.on('data', d => (logs += d));
        child.on('exit', (code) => resolve({ code, logs }));
      });
      assert.equal(res.code, 1, `PORT=${bad} 应当退出码 1`);
      assert.match(res.logs, /PORT 必须是 1-65535 的整数/, '要给出能看懂的提示，而不是 ERR_SOCKET_BAD_PORT');
      assert.doesNotMatch(res.logs, /ERR_SOCKET_BAD_PORT/, '不该走到 listen 才炸');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
});

/* ---------------------------- 剪贴板 ---------------------------- */
// 在受控环境里加载 clipboard.js，可以摆布 navigator / execCommand
function loadCopy({ modern, modernFails, legacyOk }) {
  const calls = { legacy: 0 };
  const ta = { value: '', style: {}, setAttribute() {}, setSelectionRange() {}, remove() {}, focus() {} };
  const ctx = vm.createContext({
    document: {
      createElement: () => ta,
      body: { appendChild() {} },
      createRange: () => ({ selectNodeContents() {} }),
      execCommand: () => { calls.legacy++; return legacyOk; },
    },
    navigator: modern
      ? { clipboard: { writeText: () => (modernFails ? Promise.reject(new Error('denied')) : Promise.resolve()) } }
      : {},
    console,
  });
  ctx.window = ctx;
  ctx.window.getSelection = () => ({ rangeCount: 0, removeAllRanges() {}, addRange() {} });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'ui_kits', 'stellar-raft', 'clipboard.js'), 'utf8'), ctx, { filename: 'clipboard.js' });
  return { SRCopy: ctx.window.SRCopy, calls };
}

test('SRCopy：现代 API 可用时走它，用不了就退回老办法', async () => {
  const a = loadCopy({ modern: true, legacyOk: true });
  assert.equal(await a.SRCopy.copy('x'), true);
  assert.equal(a.calls.legacy, 0, '现代 API 成功时不该再走一遍老办法');

  // 非安全上下文：navigator.clipboard 压根不存在（手机开 http:// 局域网地址就是这样）
  const b = loadCopy({ modern: false, legacyOk: true });
  assert.equal(await b.SRCopy.copy('x'), true, '退回 execCommand 也算复制成功');
  assert.equal(b.calls.legacy, 1);

  // 现代 API 存在但被拒（权限/焦点）：同步 try/catch 接不住，必须靠 Promise 的拒绝分支
  const c = loadCopy({ modern: true, modernFails: true, legacyOk: true });
  assert.equal(await c.SRCopy.copy('x'), true);
  assert.equal(c.calls.legacy, 1, '被拒之后要试老办法');
});

test('SRCopy：两条路都走不通时如实回 false，绝不谎报「已复制」', async () => {
  const d = loadCopy({ modern: false, legacyOk: false });
  assert.equal(await d.SRCopy.copy('x'), false);
  const e = loadCopy({ modern: true, modernFails: true, legacyOk: false });
  assert.equal(await e.SRCopy.copy('x'), false);
  // 空内容不算复制
  assert.equal(await d.SRCopy.copy(''), false);
});

test('复制动作一律走 SRCopy —— 不再有直接摸 navigator.clipboard 的地方', () => {
  const kit = path.join(ROOT, 'ui_kits', 'stellar-raft');
  const offenders = fs.readdirSync(kit)
    .filter(f => /\.(jsx|js)$/.test(f) && f !== 'clipboard.js')
    .filter(f => /navigator\.clipboard/.test(fs.readFileSync(path.join(kit, f), 'utf8')));
  assert.deepEqual(offenders, [],
    '这些文件仍在直接用 navigator.clipboard —— 非安全上下文里它是 undefined：' + offenders.join(', '));
});
