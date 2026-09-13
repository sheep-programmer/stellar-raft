/* 星图 Stellar Raft — 记忆模型（FSRS-lite + 点亮状态机）单元测试
   data.js 是 plain global 脚本（window.SR_DATA = IIFE），这里用 node:vm 提供
   最小 window/document/localStorage/CustomEvent shim 载入（setInterval 置空，
   心跳不落到 node 事件循环；window.SRNet 缺席 ⇒ 全部持久化调用自然短路）。

   覆盖：ensureMemory 迁移默认值（旧档案 lit/ember=0）· 点亮授予公式与 lit/ember
   写入 · R<0.35 熄灭仅触发一次 · lit 星「忘了」立即熄灭（×0.55）· 待重燃星「记得」
   回亮度不回认证 · 重燃恢复 lit · sMaxUnlit=60/365 封顶与「不回缩」钳制 · 两组三档
   严格有序 · syncCounts 的 litRatio · hasSubstance 边界 · emberStars/todayTodo。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = fs.readFileSync(path.join(ROOT, 'ui_kits', 'stellar-raft', 'data.js'), 'utf8');

const DAY = 86400000;

/* 每次调用得到一份全新的 SR_DATA（演示种子 12 颗星，已跑过一轮 refreshMemory） */
function fresh() {
  const storage = new Map();
  const windowObj = {
    addEventListener: () => { },
    removeEventListener: () => { },
    dispatchEvent: () => true,
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

/* 造一颗受控的测试星：S 稳定度、daysAgo 天前复习、可选 lit/ember 时刻 */
function makeStar(D, id, { S = 10, daysAgo = 0, lit = 0, ember = 0, con = 'qm' } = {}) {
  const s = D.addStar({ id, con, x: 10, y: 10, importance: 1, label: '测试星' + id, tags: [], body: [] });
  s.sr = { S, last: Date.now() - daysAgo * DAY, due: 0, lit, ember };
  return s;
}
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < (eps || 1e-3), `${msg}：期望 ~${b}，实际 ${a}`);

/* ------------------------------ 迁移默认值 ------------------------------ */

test('迁移：种子星 / 旧 sr（无 lit/ember）/ addStar 全部落到 lit:0, ember:0', () => {
  const D = fresh();
  // 种子星：strength 反推的 sr 必须带认证轴默认值
  for (const s of D.stars) {
    assert.equal(s.sr.lit, 0, s.id + ' 种子星默认未点亮');
    assert.equal(s.sr.ember, 0, s.id + ' 种子星默认无余烬');
  }
  // 旧快照的 sr：只有 { S, last, due } —— refreshMemory（唯一迁移入口）就地补默认
  const s = D.stars[0];
  s.sr = { S: 12, last: Date.now() - DAY, due: 0 };
  D.refreshMemory();
  assert.equal(s.sr.lit, 0);
  assert.equal(s.sr.ember, 0);
  assert.equal(D.isLit(s), false);
  assert.equal(D.isEmber(s), false);
  // addStar 的新生 sr 也带默认值
  const ns = D.addStar({ id: 'mig1', con: 'qm', x: 5, y: 5, importance: 1, label: '新星', tags: [], body: [] });
  assert.equal(ns.sr.lit, 0);
  assert.equal(ns.sr.ember, 0);
});

/* ------------------------------ 点亮授予 ------------------------------ */

test('点亮：S = S·(2.5+(1−R)·0.6)，R 回满，lit=now / ember=0，时间线记 ignite「点亮」', () => {
  const D = fresh();
  const s = makeStar(D, 't-ign', { S: 10, daysAgo: 5 });          // R = exp(−0.5) ≈ 0.6065
  const R = Math.exp(-5 / 10);
  const res = D.reviewSuccess('t-ign', { ignite: true });
  close(s.sr.S, 10 * (2.5 + (1 - R) * 0.6), 0.02, '点亮后的稳定度');
  assert.ok(s.sr.lit > 0, '写入点亮时刻');
  assert.equal(s.sr.ember, 0);
  assert.equal(s.strength, 0.98, 'R 回满');
  assert.equal(res.lit, true);
  assert.equal(res.relit, false);
  assert.equal(D.isLit(s), true);
  const tl = D.timeline.find(t => t.starId === 't-ign' && t.kind === 'ignite');
  assert.ok(tl, '时间线应有 ignite 事件');
  assert.equal(tl.note, '点亮');
});

test('已点亮星「记得」：×2.2 档巩固，保持点亮，不再写 ignite 时间线', () => {
  const D = fresh();
  const s = makeStar(D, 't-lit', { S: 10, daysAgo: 5, lit: Date.now() - 5 * DAY });
  const R = Math.exp(-5 / 10);
  D.reviewSuccess('t-lit');
  close(s.sr.S, 10 * (2.2 + (1 - R) * 0.6), 0.02, 'lit 星「记得」乘数应为 2.2 档');
  assert.equal(D.isLit(s), true, '保持点亮');
  assert.equal(D.timeline.filter(t => t.starId === 't-lit' && t.kind === 'ignite').length, 0);
});

/* ------------------------------ 熄灭 ------------------------------ */

test('熄灭：lit 星 R<0.35 时 refreshMemory 转待重燃，时间线 dim 只写一次，status=待重燃', () => {
  const D = fresh();
  const s = makeStar(D, 't-emb', { S: 10, daysAgo: 20, lit: Date.now() - 30 * DAY }); // R=exp(−2)≈0.135
  D.refreshMemory();
  assert.equal(D.isLit(s), false);
  assert.equal(D.isEmber(s), true);
  assert.ok(s.sr.ember > 0);
  assert.equal(s.props.status, '待重燃', 'props.status 输出待重燃');
  const dims = () => D.timeline.filter(t => t.starId === 't-emb' && t.kind === 'dim');
  assert.equal(dims().length, 1);
  assert.equal(dims()[0].note, '熄灭 · 待重燃');
  D.refreshMemory();   // 再跑心跳：迁移只触发一次
  D.refreshMemory();
  assert.equal(dims().length, 1, '跨越阈值只写一条 dim');
});

test('R≥0.35 的 lit 星不熄灭；未点亮星再暗也不产生 dim 迁移', () => {
  const D = fresh();
  const litOk = makeStar(D, 't-ok', { S: 10, daysAgo: 8, lit: Date.now() - 8 * DAY });  // R≈0.449
  const unlit = makeStar(D, 't-dark', { S: 10, daysAgo: 40 });                          // R≈0.018
  D.refreshMemory();
  assert.equal(D.isLit(litOk), true);
  assert.equal(D.isEmber(unlit), false);
  assert.equal(unlit.props.status, '将熄灭', '未点亮星走亮度四档，不出待重燃');
  assert.equal(D.timeline.filter(t => (t.starId === 't-ok' || t.starId === 't-dark') && t.kind === 'dim').length, 0);
});

test('lit 星评「忘了」：S×0.55、立即熄灭转待重燃、R 保持评分前值', () => {
  const D = fresh();
  const s = makeStar(D, 't-fail', { S: 10, daysAgo: 5, lit: Date.now() - 5 * DAY });
  const R = Math.exp(-5 / 10);
  const res = D.reviewFail('t-fail');
  close(s.sr.S, 5.5, 0.01, 'lit 星失败回缩 ×0.55');
  assert.equal(res.extinguished, true);
  assert.equal(D.isEmber(s), true);
  close(s.strength, R, 0.02, '显示强度保持评分前值');
  assert.equal(D.timeline.filter(t => t.starId === 't-fail' && t.kind === 'dim').length, 1);
  // 待重燃星再评「忘了」：回到未点亮参数 ×0.45
  const s2 = makeStar(D, 't-fail2', { S: 10, daysAgo: 5, ember: Date.now() });
  D.reviewFail('t-fail2');
  close(s2.sr.S, 4.5, 0.01, 'ember 星失败按未点亮 ×0.45');
});

/* ------------------------------ 重燃 ------------------------------ */

test('待重燃星「记得」：×1.8 回亮度、离开到期队列，但认证不回来', () => {
  const D = fresh();
  const s = makeStar(D, 't-warm', { S: 10, daysAgo: 20, ember: Date.now() - DAY });
  const R = Math.max(0.02, Math.exp(-2));
  assert.ok(D.dueStars().some(x => x.id === 't-warm'), '复习前在到期队列');
  D.reviewSuccess('t-warm');
  close(s.sr.S, 10 * (1.8 + (1 - R) * 0.6), 0.02, 'ember 星「记得」按未点亮 1.8 档');
  assert.equal(s.strength, 0.98, 'R 回满 ⇒ 离开到期队列');
  assert.ok(!D.dueStars().some(x => x.id === 't-warm'));
  assert.equal(D.isEmber(s), true, '认证不自动回来——重燃只走费曼');
  assert.equal(D.isLit(s), false);
});

test('重燃：费曼 ignite 恢复 lit、清空 ember，时间线 note「重燃」，模糊评分保持余烬', () => {
  const D = fresh();
  const s = makeStar(D, 't-re', { S: 10, daysAgo: 20, ember: Date.now() - DAY });
  D.reviewPartial('t-re');
  assert.equal(D.isEmber(s), true, '「模糊」保持待重燃');
  const res = D.reviewSuccess('t-re', { ignite: true });
  assert.equal(res.relit, true);
  assert.ok(s.sr.lit > 0);
  assert.equal(s.sr.ember, 0);
  assert.equal(D.isLit(s), true);
  const tl = D.timeline.find(t => t.starId === 't-re' && t.kind === 'ignite');
  assert.equal(tl.note, '重燃');
});

test('「模糊」不动认证轴：lit 星保持点亮', () => {
  const D = fresh();
  const s = makeStar(D, 't-hazy', { S: 10, daysAgo: 5, lit: Date.now() - 5 * DAY });
  D.reviewPartial('t-hazy');
  close(s.sr.S, 12, 0.01, '×1.2');
  assert.equal(D.isLit(s), true);
});

/* --------------------------- 封顶与不回缩钳制 --------------------------- */

test('稳定度上限：从未点亮星封顶 60；旧档案 S>60 只封顶生长、绝不回缩', () => {
  const D = fresh();
  const a = makeStar(D, 't-cap', { S: 40, daysAgo: 20 });          // 40×2.04+ > 60 → 钳到 60
  D.reviewSuccess('t-cap');
  assert.equal(a.sr.S, 60, '未点亮星生长封顶 sMaxUnlit=60');
  const b = makeStar(D, 't-old', { S: 100, daysAgo: 51 });         // 旧 sMax=365 时代攒下的 S
  D.reviewSuccess('t-old');
  assert.equal(b.sr.S, 100, '既有 S>60 的星不被削减，只是不再生长');
  D.reviewPartial('t-old');
  assert.equal(b.sr.S, 100, '「模糊」同样受钳制且不回缩');
});

test('曾点亮星（lit 与 ember）同享 365 上限', () => {
  const D = fresh();
  const lit = makeStar(D, 't-365', { S: 200, daysAgo: 100, lit: Date.now() - 100 * DAY });
  D.refreshMemory();                       // R=exp(−0.5)≈0.61 ≥0.35，保持点亮
  D.reviewSuccess('t-365');
  assert.equal(lit.sr.S, 365, 'lit 星生长封顶 365');
  const emb = makeStar(D, 't-emb365', { S: 100, daysAgo: 200, ember: Date.now() - DAY });
  const R = Math.max(0.02, Math.exp(-2));
  D.reviewSuccess('t-emb365');
  close(emb.sr.S, 100 * (1.8 + (1 - R) * 0.6), 0.05, 'ember 星突破 60——火种还在，S 上限仍是 365');
  assert.ok(emb.sr.S > 60);
});

/* ------------------------------ 三档严格有序 ------------------------------ */

test('未点亮组：fail < partial < success < ignite（S 结果严格递增）', () => {
  const D = fresh();
  const mk = (id) => makeStar(D, id, { S: 10, daysAgo: 5 });
  const [f, p, su, ig] = [mk('o-f'), mk('o-p'), mk('o-s'), mk('o-i')];
  D.reviewFail('o-f'); D.reviewPartial('o-p'); D.reviewSuccess('o-s'); D.reviewSuccess('o-i', { ignite: true });
  assert.ok(f.sr.S < p.sr.S, `fail(${f.sr.S}) < partial(${p.sr.S})`);
  assert.ok(p.sr.S < su.sr.S, `partial(${p.sr.S}) < success(${su.sr.S})`);
  assert.ok(su.sr.S < ig.sr.S, `success(${su.sr.S}) < ignite(${ig.sr.S})`);
});

test('已点亮组：fail(0.55) < partial(1.2) < success(2.2+)，且 fail 是唯一的熄灭边', () => {
  const D = fresh();
  const lit = () => Date.now() - 5 * DAY;
  const mk = (id) => makeStar(D, id, { S: 10, daysAgo: 5, lit: lit() });
  const [f, p, su] = [mk('l-f'), mk('l-p'), mk('l-s')];
  D.reviewFail('l-f'); D.reviewPartial('l-p'); D.reviewSuccess('l-s');
  assert.ok(f.sr.S < p.sr.S && p.sr.S < su.sr.S, `${f.sr.S} < ${p.sr.S} < ${su.sr.S}`);
  assert.equal(D.isEmber(f), true);
  assert.equal(D.isLit(p), true);
  assert.equal(D.isLit(su), true);
});

/* --------------------------- litRatio 与今日待办 --------------------------- */

test('syncCounts：星域新增 litRatio = 已点亮成员占比，health 口径不变（成员 strength 均值）', () => {
  const D = fresh();
  const qm = D.constellations.find(c => c.id === 'qm');
  assert.equal(qm.litRatio, 0, '种子星全部未点亮');
  const members = D.stars.filter(s => s.con === 'qm');
  D.reviewSuccess(members[0].id, { ignite: true });
  const after = D.constellations.find(c => c.id === 'qm');
  close(after.litRatio, 1 / members.length, 1e-9, 'litRatio');
  const mean = members.reduce((a, s) => a + s.strength, 0) / members.length;
  close(after.health, mean, 1e-9, 'health 仍是亮度均值，不混入点亮维度');
});

test('emberStars / todayTodo：待重燃队列与统一今日待办三计数', () => {
  const D = fresh();
  assert.equal(D.emberStars().length, 0, '初始无待重燃');
  const t0 = D.todayTodo();
  assert.equal(t0.ember, 0);
  assert.equal(t0.inbox, D.inbox.length, '收件箱待整理 = inbox.length');
  assert.equal(t0.due, D.dueStars().length);
  makeStar(D, 't-todo1', { S: 10, daysAgo: 20, lit: Date.now() - 30 * DAY });
  makeStar(D, 't-todo2', { S: 10, daysAgo: 25, lit: Date.now() - 30 * DAY });
  D.refreshMemory();   // 两颗都跨过熄灭阈值
  const embers = D.emberStars();
  // 注意：vm 沙盒里的数组跨 realm，deepEqual 会因原型不同失败——比较序列化结果
  assert.equal(embers.map(s => s.id).sort().join(','), 't-todo1,t-todo2');
  const t1 = D.todayTodo();
  assert.equal(t1.ember, 2);
  assert.ok(t1.due >= 2, '熄灭星多半也到期——两行允许重叠');
  // 重燃其中一颗：同时清掉到期（R 回满）
  D.reviewSuccess('t-todo1', { ignite: true });
  const t2 = D.todayTodo();
  assert.equal(t2.ember, 1);
  assert.ok(!D.dueStars().some(s => s.id === 't-todo1'));
});

/* ------------------------------ hasSubstance ------------------------------ */

test('hasSubstance：摘要去空白 ≥20 字 或 带文本的非 rich/divider 块 ≥2（code 不计）', () => {
  const D = fresh();
  const mk = (summary, body) => ({ summary, body });
  // 摘要门槛：去空白后计数
  assert.equal(D.hasSubstance(mk('一二三四五六七八九十一二三四五六七八九十', [])), true, '20 字达标');
  assert.equal(D.hasSubstance(mk('一二三四五六七八九十一二三四五六七八九', [])), false, '19 字不足');
  assert.equal(D.hasSubstance(mk('  一二三四五六七八九十\n一二三四五六七八九十  ', [])), true, '空白不计入');
  // 块门槛：2 个带文本块
  const b = (type, text) => ({ id: 'x', type, text });
  assert.equal(D.hasSubstance(mk('', [b('bulleted', '要点一'), b('bulleted', '要点二')])), true);
  assert.equal(D.hasSubstance(mk('', [b('bulleted', '只有一条')])), false);
  // rich / divider / code / 空文本块不计
  assert.equal(D.hasSubstance(mk('', [
    { id: 'r', type: 'rich' }, { id: 'd', type: 'divider' },
    { id: 'c', type: 'code', lang: 'python', code: 'import numpy' },
    b('p', '   '), b('h2', '唯一标题'),
  ])), false, 'rich/divider/code/空块都不计');
  // math 的 tex 算文本
  assert.equal(D.hasSubstance(mk('', [{ id: 'm', type: 'math', tex: 'E=mc^2' }, b('p', '正文一句')])), true);
  assert.equal(D.hasSubstance(null), false);
});

/* ------------------------------ 星域读数 ------------------------------ */

/* syncCounts 改写过一次：原来是「对每个星域把全部星过一遍」，而且过三遍
   （filter + reduce + filter）——20 个星域 2000 颗星就是 12 万次比较，还挂在
   每次切视图与每分钟心跳上。现在对星走一趟按星域累加。
   这条测试认的是结果，不是写法：三个派生值都必须和逐个数出来的一致。 */
test('星域读数：成员数 / 健康度 / 点亮占比，与逐个数出来的一致', () => {
  const D = fresh();
  // 造一个干净的局面：两个星域，成员数、亮度、点亮状态都不一样
  D.constellations.length = 0;
  D.stars.length = 0;
  Object.keys(D.byId).forEach(k => delete D.byId[k]);
  D.constellations.push({ id: 'ca', name: '域 A', color: '#9fc6ff' });
  D.constellations.push({ id: 'cb', name: '域 B', color: '#ffd98a' });
  D.constellations.push({ id: 'cc', name: '空域', color: '#ffd98a' });   // 一个成员都没有

  makeStar(D, 'a1', { con: 'ca', S: 30, daysAgo: 0, lit: Date.now() });      // 亮且点亮
  makeStar(D, 'a2', { con: 'ca', S: 30, daysAgo: 1 });                        // 亮但没点亮
  makeStar(D, 'b1', { con: 'cb', S: 10, daysAgo: 40, lit: Date.now() });      // 久未复习：会熄灭
  makeStar(D, 'orphan', { con: '不存在的星域', S: 10, daysAgo: 0 });          // 孤儿星：不该算进任何星域
  D.refreshMemory();

  const byId = Object.fromEntries(D.constellations.map(c => [c.id, c]));
  const manual = (cid) => {
    const members = D.stars.filter(s => s.con === cid);
    return {
      count: members.length,
      health: members.length ? members.reduce((a, s) => a + s.strength, 0) / members.length : 0,
      litRatio: members.length ? members.filter(s => D.isLit(s)).length / members.length : 0,
    };
  };
  for (const cid of ['ca', 'cb', 'cc']) {
    const m = manual(cid);
    assert.equal(byId[cid].count, m.count, cid + ' 成员数');
    close(byId[cid].health, m.health, 1e-9, cid + ' 健康度');
    close(byId[cid].litRatio, m.litRatio, 1e-9, cid + ' 点亮占比');
  }
  assert.equal(byId.cc.count, 0, '没有成员的星域读数归零，而不是 NaN');
  assert.equal(byId.cc.health, 0);
  assert.equal(byId.cb.litRatio, 0, '放了 40 天的那颗已经熄灭，不再计入点亮');
  // 孤儿星既不该让哪个星域凭空多一个成员，也不该让总数对不上
  assert.equal(D.constellations.reduce((a, c) => a + c.count, 0), 3, '孤儿星不计入任何星域');
});

/* ——— 两端同参 ———
   同一颗星，主人看到的亮度与访客看到的亮度必须是同一个数：主人那边由
   data.js 算，访客那边由 server/core.js 算，两份代码各写各的常数。
   一旦哪边被人顺手调了一下（比如把熄灭阈值从 0.35 挪到 0.3），就会出现
   「我这儿还亮着，朋友那儿已经熄了」——而这种偏差不会报错，只会让人觉得
   哪里不对劲。所以把它钉在这里。 */
test('记忆模型的常数与公式：客户端与服务端逐项对齐', () => {
  const CORE = fs.readFileSync(path.join(ROOT, 'server', 'core.js'), 'utf8');
  const num = (src, re, what) => {
    const m = src.match(re);
    assert.ok(m, '没找到' + what);
    return Number(m[1]);
  };
  assert.equal(num(CODE, /rMin:\s*([\d.]+)/, '客户端 rMin'), num(CORE, /rMin:\s*([\d.]+)/, '服务端 rMin'));
  assert.equal(num(CODE, /rMax:\s*([\d.]+)/, '客户端 rMax'), num(CORE, /rMax:\s*([\d.]+)/, '服务端 rMax'));
  assert.equal(num(CODE, /emberR:\s*([\d.]+)/, '客户端 emberR'), num(CORE, /emberR:\s*([\d.]+)/, '服务端 emberR'));
  assert.equal(num(CODE, /const DAY = (\d+)/, '客户端 DAY'), num(CORE, /const DAY = (\d+)/, '服务端 DAY'));

  // 衰减公式：R = exp(−Δt天 / S)，两边都要有同一条式子
  assert.match(CODE, /Math\.exp\(-Math\.max\(0, \(now \|\| Date\.now\(\)\) - s\.sr\.last\) \/ DAY \/ s\.sr\.S\)/);
  assert.match(CORE, /Math\.exp\(-Math\.max\(0, now - sr\.last\) \/ DAY \/ sr\.S\)/);
  // 出库都保留三位小数，免得同一颗星在两端显示成 0.607 和 0.6065
  assert.match(CORE, /\* 1000\) \/ 1000/);
  assert.match(CODE, /\* 1000\) \/ 1000/);
  // 熄灭判定：两端都是「曾点亮 且 R < emberR」
  assert.match(CODE, /s\.sr\.lit > 0 && s\.strength < MEM\.emberR/);
  assert.match(CORE, /wasLit && r < MEM\.emberR/);
});
