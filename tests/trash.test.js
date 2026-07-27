/* 星图 Stellar Raft — 黑洞（回收站）的删除与恢复
   data.js 是 plain global 脚本（window.SR_DATA = IIFE），这里用 node:vm 提供
   最小 window/document/localStorage/CustomEvent shim 载入。

   覆盖：星与星域各自的移入 / 恢复 · 先恢复成员星再恢复星域时的归属 ·
   星域被彻底销毁后成员星的落点 · 两端都在黑洞里的连线不随恢复顺序丢失。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = fs.readFileSync(path.join(ROOT, 'ui_kits', 'stellar-raft', 'data.js'), 'utf8');

function fresh() {
  const storage = new Map();
  const windowObj = { addEventListener: () => { }, removeEventListener: () => { }, dispatchEvent: () => true };
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
    console,
  });
  vm.runInContext(CODE, ctx, { filename: 'data.js' });
  return windowObj.SR_DATA;
}

const conOf = (D, id) => D.constellations.find(c => c.id === id);
const memberIds = (D, conId) => D.stars.filter(s => s.con === conId).map(s => s.id).sort();

test('单颗星：移入黑洞后从星图与笔记里消失，恢复后回到原星域', () => {
  const D = fresh();
  const star = D.stars.find(s => s.con === 'qm');
  const before = memberIds(D, 'qm');

  const entry = D.trashStar(star.id);
  assert.ok(entry && entry.kind === 'star');
  assert.equal(D.byId[star.id], undefined, '移入黑洞后不该还在索引里');
  assert.ok(!memberIds(D, 'qm').includes(star.id));

  D.restoreTrash(entry.id);
  assert.equal(D.byId[star.id].con, 'qm', '应回到原星域');
  assert.deepEqual(memberIds(D, 'qm'), before, '成员应与删除前一致');
  assert.equal(D.trash.find(t => t.id === entry.id), undefined, '恢复后条目应离开黑洞');
});

test('整个星域：成员与星域一起走、一起回', () => {
  const D = fresh();
  const before = memberIds(D, 'qm');
  assert.ok(before.length > 1);

  const entry = D.trashDomain('qm');
  assert.equal(conOf(D, 'qm'), undefined, '星域应已移出');
  assert.equal(memberIds(D, 'qm').length, 0, '成员应一并移出');

  D.restoreTrash(entry.id);
  assert.ok(conOf(D, 'qm'), '星域应归位');
  assert.deepEqual(memberIds(D, 'qm'), before, '成员应全部回到该星域');
});

/* 用户报的那条路径：先逐颗删成员，再删空掉的星域，
   然后先恢复成员星、再恢复星域——星必须回到自己的星域里。 */
test('先删成员再删星域：先恢复星、再恢复星域，星仍回到原星域', () => {
  const D = fresh();
  const before = memberIds(D, 'qm');
  const [a, b] = before;

  const ea = D.trashStar(a);
  const eb = D.trashStar(b);
  const ed = D.trashDomain('qm');
  assert.equal(conOf(D, 'qm'), undefined);

  // 先恢复两颗成员星：此时星域还在黑洞里
  D.restoreTrash(ea.id);
  D.restoreTrash(eb.id);
  assert.equal(D.byId[a].con, 'qm', '不得把星改挂到别的星域');
  assert.equal(D.byId[b].con, 'qm');
  assert.ok(conOf(D, 'qm'), '星域壳应被带回来，否则星在星图上无处可画');

  // 再恢复星域：其余成员并入同一个星域，且不产生重复
  D.restoreTrash(ed.id);
  assert.equal(D.constellations.filter(c => c.id === 'qm').length, 1, '星域不得重复');
  assert.deepEqual(memberIds(D, 'qm'), before, '全部成员应回到原星域');
  assert.equal(D.stars.filter(s => s.id === a).length, 1, '星不得重复');
});

test('星域被彻底销毁后：成员星落入「未分域」，不塞进不相干的星域', () => {
  const D = fresh();
  const star = D.stars.find(s => s.con === 'qm');
  const others = D.constellations.filter(c => c.id !== 'qm').map(c => c.id);

  const es = D.trashStar(star.id);
  const ed = D.trashDomain('qm');
  D.purgeTrash(ed.id);                     // 星域再也回不来了

  D.restoreTrash(es.id);
  const home = D.byId[star.id].con;
  assert.ok(!others.includes(home), '不得把星硬塞进某个不相干的星域');
  assert.ok(conOf(D, home), '落点星域必须真实存在，否则星图上画不出来');
  assert.equal(conOf(D, home).name, '未分域');
});

test('两端都在黑洞里的连线：不随恢复顺序丢失', () => {
  const D = fresh();
  const link = D.connections.find(c => D.byId[c.a] && D.byId[c.b]);
  assert.ok(link, '演示星系应当自带连线');
  const { a, b } = link;
  const total = D.connections.length;

  const ea = D.trashStar(a);               // a–b 连线随 a 收进黑洞
  const eb = D.trashStar(b);               // 此时连线已不在 connections 里
  assert.equal(D.connections.filter(c => c.a === a && c.b === b).length, 0);

  D.restoreTrash(ea.id);                   // 只恢复 a：b 还在黑洞，连线应被寄存而不是丢掉
  assert.equal(D.connections.filter(c => c.a === a && c.b === b).length, 0, 'b 缺席时不该先连上');

  D.restoreTrash(eb.id);                   // b 回来，连线随之复原
  assert.equal(D.connections.filter(c => c.a === a && c.b === b).length, 1, '两端齐了连线就该回来');
  assert.equal(D.connections.length, total, '连线总数应与删除前一致');
});
