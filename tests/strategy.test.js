/* 星图 Stellar Raft — 复习策略与连续观星天数测试
   data.js 用 node:vm 载入（同 memory.test.js 的最小 shim）。额外注入可切换的
   window.SRAI 桩，验证 dueTsOf 的四档策略口径：
   cooling（默认）= last + S·ln(1/0.6) 天 · sm2 = 1·3·7·15·30…阶梯（≤S 的最大档）
   daily = last + 1 天 · off = 与 cooling 相同（只关通知，不改到期）。
   连续观星：timeline 有主动记录（非 dim）的连续自然日；今天缺席从昨天起数。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = fs.readFileSync(path.join(ROOT, 'ui_kits', 'stellar-raft', 'data.js'), 'utf8');

const DAY = 86400000;

function fresh(strategyBox) {
  const storage = new Map();
  const windowObj = {
    addEventListener: () => { },
    removeEventListener: () => { },
    dispatchEvent: () => true,
    SRAI: strategyBox ? { active: () => ({ strategy: strategyBox.value }) } : undefined,
  };
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

function makeStar(D, id, { S = 10, daysAgo = 0, con = 'qm' } = {}) {
  const s = D.addStar({ id, con, x: 10, y: 10, importance: 1, label: '测试星' + id, tags: [], body: [] });
  s.sr = { S, last: Date.now() - daysAgo * DAY, due: 0, lit: 0, ember: 0 };
  return s;
}
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < (eps || 1e-3), `${msg}：期望 ~${b}，实际 ${a}`);

/* ------------------------------ 到期口径 ------------------------------ */

test('cooling（默认 / SRAI 缺席）：due = last + S·ln(1/0.6) 天', () => {
  const D = fresh(null);   // 无 SRAI —— 后向兼容：老页面不载 ai.js 也不能崩
  const s = makeStar(D, 'x1', { S: 10 });
  close((D.dueTsOf(s) - s.sr.last) / DAY, 10 * Math.log(1 / 0.6), 1e-6, 'cooling 到期天数');
});

test('sm2：取不超过稳定度的最大阶梯档；S 低于 1 天档取 1；超过 365 封在 365', () => {
  const box = { value: 'sm2' };
  const D = fresh(box);
  const pairs = [[10, 7], [3, 3], [2.9, 1], [0.9, 1], [40, 30], [400, 365]];
  pairs.forEach(([S, days], i) => {
    const s = makeStar(D, 'sm' + i, { S });
    close((D.dueTsOf(s) - s.sr.last) / DAY, days, 1e-6, `S=${S} 应落在 ${days} 天档`);
  });
});

test('daily：一律 last + 1 天；off：到期照常按 cooling 计算', () => {
  const box = { value: 'daily' };
  const D = fresh(box);
  const s = makeStar(D, 'd1', { S: 50 });
  close((D.dueTsOf(s) - s.sr.last) / DAY, 1, 1e-6, 'daily 到期天数');
  box.value = 'off';
  close((D.dueTsOf(s) - s.sr.last) / DAY, 50 * Math.log(1 / 0.6), 1e-6, 'off 不改到期口径');
});

test('策略切换即时改变 dueStars 队列（同一颗星 cooling 未到期 → daily 到期）', () => {
  const box = { value: 'cooling' };
  const D = fresh(box);
  D.stars.splice(0, D.stars.length);   // 清掉种子星，队列只看测试星
  Object.keys(D.byId).forEach(k => delete D.byId[k]);
  const s = makeStar(D, 'q1', { S: 30, daysAgo: 2 });   // cooling 下 15 天后才到期
  assert.ok(!D.dueStars().includes(s), 'cooling 下未到期');
  box.value = 'daily';
  assert.ok(D.dueStars().includes(s), 'daily 下 2 天前复习过的星已到期');
});

test('手动排队仍能把任何策略下的到期提前', () => {
  const box = { value: 'sm2' };
  const D = fresh(box);
  const s = makeStar(D, 'm1', { S: 40 });   // sm2 档 30 天
  D.queueReview('m1', 0);
  assert.ok(D.dueTsOf(s) <= Date.now() + DAY, '排队后到期不晚于一天内');
});

/* ------------------------------ 连续观星 ------------------------------ */

test('连续观星：连续自然日计数，dim 不算，断档即止', () => {
  const D = fresh(null);
  makeStar(D, 'st1', { S: 10 });
  D.timeline.splice(0, D.timeline.length,
    { id: 't1', starId: 'st1', ts: Date.now(), kind: 'review' },
    { id: 't2', starId: 'st1', ts: Date.now() - DAY, kind: 'ignite' },
    { id: 't3', starId: 'st1', ts: Date.now() - 2 * DAY, kind: 'dim' },      // 熄灭不算主动学习
    { id: 't4', starId: 'st1', ts: Date.now() - 3 * DAY, kind: 'review' },   // 已断档，不接上
  );
  D.refreshMemory();
  assert.equal(D.account.streak, 2);
});

test('连续观星：今天还没开张不断签——从昨天起往回数', () => {
  const D = fresh(null);
  makeStar(D, 'st2', { S: 10 });
  D.timeline.splice(0, D.timeline.length,
    { id: 't1', starId: 'st2', ts: Date.now() - DAY, kind: 'review' },
    { id: 't2', starId: 'st2', ts: Date.now() - 2 * DAY, kind: 'review' },
  );
  D.refreshMemory();
  assert.equal(D.account.streak, 2);
});

test('连续观星：pushTimeline 当场续上；空时间线为 0', () => {
  const D = fresh(null);
  D.timeline.splice(0, D.timeline.length);
  D.refreshMemory();
  assert.equal(D.account.streak, 0);
  makeStar(D, 'st3', { S: 10 });
  D.pushTimeline('review', 'st3', '测试');
  assert.equal(D.account.streak, 1);
});

test('手动排期是权威预约：推迟也算数；复习完成后清预约回自然口径', () => {
  const D = fresh(null);
  const s = makeStar(D, 'ap1', { S: 2.5 });          // 自然到期约 1.3 天（明天）
  const target = Date.now() + 9 * DAY;
  s.sr.due = target;
  assert.equal(D.dueTsOf(s), target, '选到 9 天后就该是 9 天后，不被自然到期拉回明天');
  assert.ok(!D.dueStars().includes(s), '预约未到，不进到期队列');
  D.reviewSuccess('ap1');
  assert.equal(s.sr.due, 0, '复习完成清掉预约');
});
