/* 星图 Stellar Raft — 启动水合（data.js × SRNet）决策测试

   启动时「本地镜像 vs 服务器快照，谁说了算」以前比的是两台设备的系统时钟——
   时钟快的那端恒赢，另一端的离线编辑被静默覆盖。现在比因果：
   镜像里的 syncVer（这份内容基于的服务器版本）+ pending（还没被确认过）。

   这里在 vm 里加载真 data.js，SRNet 全 mock，驱动四种启动局面。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = fs.readFileSync(path.join(ROOT, 'ui_kits', 'stellar-raft', 'data.js'), 'utf8');

const galaxyWith = (label) => ({
  constellations: [], connections: [], notes: [], inbox: [], timeline: [], trash: [],
  stars: [{ id: 's-' + label, con: null, x: 50, y: 50, label, strength: 0.5, importance: 1, body: [] }],
});

/* mirror: 本地镜像（{ savedAt, syncVer, pending, data } 或 null）
   remoteVersion / remoteData: 服务器现况 */
function boot({ mirror, remoteVersion, remoteData }) {
  const storage = new Map();
  const calls = { schedule: 0, saveLocal: [], setVersion: [] };
  const windowObj = {
    addEventListener: () => { },
    removeEventListener: () => { },
    dispatchEvent: () => true,
  };
  const N = {
    loadLocal: () => mirror,
    schedule: () => { calls.schedule++; },
    saveLocal: (d, ver) => { calls.saveLocal.push({ d, ver }); return true; },
    setVersion: (v) => { calls.setVersion.push(v); },
    setReady: () => { },
    api: (p) => {
      if (p === '/api/hello') return Promise.resolve({ user: { name: '测' }, account: {}, site: {} });
      if (p === '/api/galaxy') return Promise.resolve(remoteData != null
        ? { data: remoteData, updatedAt: '2026-09-01 00:00:00', version: remoteVersion }
        : { data: null, updatedAt: null, version: remoteVersion });
      if (p === '/api/friends') return Promise.resolve({ friends: [] });
      return Promise.resolve(null);
    },
    inbox: { list: () => Promise.resolve([]) },
  };
  windowObj.SRNet = N;
  const ctx = vm.createContext({
    window: windowObj,
    document: { hidden: true, documentElement: { dataset: {} } },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    setInterval: () => 0,
    clearInterval: () => { },
    CustomEvent: class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; } },
    Event: class Event { constructor(type) { this.type = type; } },
    console,
  });
  vm.runInContext(CODE, ctx, { filename: 'data.js' });
  // 等 hello → galaxy 链跑完
  return new Promise((resolve) => setTimeout(() => resolve({ D: windowObj.SR_DATA, calls }), 30));
}

const labels = (D) => D.stars.map(s => s.label).join(',');

test('syncVer 相等 + pending：别处没人写过，本地镜像（含离线编辑）为准并回推', async () => {
  const { D, calls } = await boot({
    mirror: { savedAt: 100, syncVer: 3, pending: true, data: galaxyWith('离线写的星') },
    remoteVersion: 3, remoteData: galaxyWith('服务器上的星'),
  });
  assert.equal(labels(D), '离线写的星', '本地为准');
  assert.ok(calls.schedule > 0, '离线编辑要回推给服务器');
});

test('syncVer 相等 + 非 pending：镜像是服务器内容的回声，一致，不回推', async () => {
  const { D, calls } = await boot({
    mirror: { savedAt: 100, syncVer: 3, pending: false, data: galaxyWith('同一片星') },
    remoteVersion: 3, remoteData: galaxyWith('同一片星'),
  });
  assert.equal(labels(D), '同一片星');
  assert.equal(calls.schedule, 0, '内容一致时不该空推一发（每次启动都涨版本号）');
});

test('syncVer 不等：另一台设备写过，服务器为准，镜像跟着对齐', async () => {
  const { D, calls } = await boot({
    mirror: { savedAt: 100, syncVer: 3, pending: true, data: galaxyWith('本机的旧编辑') },
    remoteVersion: 4, remoteData: galaxyWith('另一台设备的星'),
  });
  assert.equal(labels(D), '另一台设备的星', '服务器为准');
  assert.equal(calls.schedule, 0, '不让本机旧编辑盖回去');
  assert.equal(calls.saveLocal.length, 1, '镜像同步到服务器这一版');
  assert.equal(calls.saveLocal[0].ver, 4);
});

test('旧版镜像（无 syncVer）：退回 savedAt 比较，并顺手带进 syncVer 时代', async () => {
  const newer = { savedAt: Date.parse('2026-09-10T00:00:00Z'), data: galaxyWith('旧格式的星') };
  const { D, calls } = await boot({
    mirror: newer,   // 比服务器 updatedAt(2026-09-01) 新
    remoteVersion: 2, remoteData: galaxyWith('服务器上的星'),
  });
  assert.equal(labels(D), '旧格式的星', 'savedAt 较新时本地为准（旧语义保持）');
  assert.ok(calls.schedule > 0, '本地为准则回推');
});
