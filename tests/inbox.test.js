/* 星图 Stellar Raft — 星际收件箱（inbox_messages）REST 测试
   与 server.test.js 同法：把 server.js 复制进临时目录再启动，数据库落在
   临时目录里，端口用空闲端口注入 —— 绝不触碰仓库 / 用户真实实例。

   覆盖：新装 DB 欢迎来信种子 → 好友投递（galaxy / star 两种）→ 非好友被拒
   → 拉黑双向被拒 → collect 按可见度裁剪（stars 档无 keyPoints/summary）
   → HTML 剥离 → 长度钳制（label 120 / summary 2000 / keyPoint 300×12）
   → 幂等（同 to,from,kind,starId 未领取时不重复入库）→ ack 领取/忽略
   → 速率限制（每用户每分钟 ≤ 20 条投递）。

   注意：就绪探测用「无 token 请求 → 401」，不建任何用户 ——
   欢迎来信种子只发给新装 DB 的第一位旅行者，探测若建档会把种子吃掉。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

let tmpDir;
let child;
let baseUrl;

async function api(token, method, pathName, body) {
  const res = await fetch(baseUrl + pathName, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-inbox-test-'));

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], {
    // 这套用例以匿名旅客的身份跑分享 / 造访 / 来信协议本身：关掉「每 IP 一个游客」
    // 的限额与「社交需要账号」的门禁（都是管理台里可关的真实配置）。
    // 限额与门禁的行为本身在 tests/admin.test.js 里单独覆盖。
    env: { ...process.env, PORT: String(port), SR_DB: path.join(tmpDir, 'stellar.db'), SR_GUEST_PER_IP: '0', SR_GUEST_GATES: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => (logs += d));
  child.stderr.on('data', (d) => (logs += d));

  // 等待就绪（最多 10s）：无 token → 401 即视为服务已起。不建用户！
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(baseUrl + '/api/hello', { method: 'POST' });
      if (r.status === 401) break;
    } catch {
      /* not up yet */
    }
    if (i > 200) throw new Error('server did not start:\n' + logs);
    await new Promise((r) => setTimeout(r, 50));
  }
});

test.after(() => {
  if (child) child.kill('SIGKILL');
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

/* ------------------------------ 测试数据 ------------------------------ */

const SECRET = '这段正文绝不允许进入收件箱_SECRET_BODY';
const LONG_LABEL = '甲'.repeat(200);              // > 120，需钳到 120
const LONG_SUMMARY = '乙'.repeat(3000);           // > 2000，需钳到 2000
const LONG_POINT = '丙'.repeat(400);              // > 300，需钳到 300

const ownerGalaxy = () => ({
  constellations: [{ id: 'qm', name: '量子力学', color: '#9fc6ff', health: 0.7, count: 4 }],
  stars: [
    {
      id: 's1', con: 'qm', x: 40, y: 40, strength: 0.8, importance: 1,
      label: '<b>薛定谔</b>方程', tags: ['概念'],
      summary: '摘要带 <i>标记</i> 与实体 &amp; 符号',
      body: [
        { id: 'b1', type: 'h1', text: '<b>波函数</b>的演化' },
        { id: 'b2', type: 'p', text: SECRET },
        { id: 'b3', type: 'h2', text: '定态解 &amp; 能级' },
      ],
    },
    {
      id: 's2', con: 'qm', x: 50, y: 50, strength: 0.6, importance: 1,
      label: LONG_LABEL, tags: [],
      summary: LONG_SUMMARY,
      body: [
        { id: 'c0', type: 'h2', text: LONG_POINT },
        ...Array.from({ length: 14 }, (_, i) => ({ id: 'c' + (i + 1), type: 'h3', text: '要点' + (i + 1) })),
        { id: 'cp', type: 'p', text: SECRET },
      ],
    },
    {
      id: 's3', con: 'qm', x: 60, y: 60, strength: 0.5, importance: 1,
      label: '不确定性原理', tags: [],
      summary: '含密摘要:' + SECRET,
      body: [
        { id: 'd1', type: 'h2', text: '位置与动量' },
        { id: 'd2', type: 'p', text: SECRET },
      ],
    },
    {
      id: 's4', con: 'qm', x: 70, y: 70, strength: 0.4, importance: 1,
      label: '泡利不相容', tags: [],
      summary: '含密摘要:' + SECRET,
      body: [{ id: 'e1', type: 'h3', text: '自旋与轨道' }],
    },
  ],
  connections: [],
  notes: [],
  account: { name: '主人甲', avatar: '甲' },
});

const FIRST = 'token-inbox-first';    // 新装 DB 的第一位旅行者：应收到欢迎来信
const OWNER = 'token-inbox-owner';    // 分享方（甲）
const FRIEND = 'token-inbox-friend';  // 好友（乙）
const STRANGER = 'token-inbox-stranger'; // 陌生人（丙）

let ownerId, friendId, strangerId, shareCode;

/* --------------------------- 欢迎来信种子 --------------------------- */

test('新装 DB：第一位旅行者收到 galaxy + star 两封演示来信，后来者没有', async () => {
  const hello = await api(FIRST, 'POST', '/api/hello', { name: '第一旅行者', avatar: '壹' });
  assert.equal(hello.status, 200);

  const r = await api(FIRST, 'GET', '/api/inbox');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
  assert.equal(r.body.length, 2, '第一位旅行者应有两封来信');

  const galaxyMsg = r.body.find((m) => m.kind === 'galaxy');
  const starMsg = r.body.find((m) => m.kind === 'star');
  assert.ok(galaxyMsg && starMsg, '一封造访邀请 + 一封赠星');
  for (const m of [galaxyMsg, starMsg]) {
    assert.equal(m.from.name, '星图伙伴');
    assert.equal(m.claimed, false);
    assert.equal(typeof m.at, 'string');
  }
  assert.equal(galaxyMsg.payload.code, 'XING-DEMO-2333');
  assert.equal(typeof galaxyMsg.payload.galaxyName, 'string');
  assert.ok(galaxyMsg.payload.starCount >= 6);
  assert.equal(starMsg.payload.label, '钱德拉塞卡极限');
  assert.ok(Array.isArray(starMsg.payload.keyPoints) && starMsg.payload.keyPoints.length > 0);

  // 第二位建档的用户不再收到种子
  const hello2 = await api(OWNER, 'POST', '/api/hello', { name: '主人甲', avatar: '甲' });
  assert.equal(hello2.status, 200);
  ownerId = hello2.body.user.id;
  const r2 = await api(OWNER, 'GET', '/api/inbox');
  assert.deepEqual(r2.body, [], '欢迎种子只发一次');
});

/* ----------------------------- 建档与好友 ----------------------------- */

test('准备：主人甲存星系并开分享，乙兑换成好友，丙保持陌生', async () => {
  const put = await api(OWNER, 'PUT', '/api/galaxy', { data: ownerGalaxy() });
  assert.equal(put.status, 200);

  const share = await api(OWNER, 'POST', '/api/share', { enabled: true, visibility: 'outline' });
  assert.equal(share.status, 200);
  shareCode = share.body.code;

  const hf = await api(FRIEND, 'POST', '/api/hello', { name: '好友乙', avatar: '乙' });
  friendId = hf.body.user.id;
  const hs = await api(STRANGER, 'POST', '/api/hello', { name: '陌生丙', avatar: '丙' });
  strangerId = hs.body.user.id;

  const redeem = await api(FRIEND, 'POST', '/api/friends/redeem', { code: shareCode });
  assert.equal(redeem.status, 200);
  assert.equal(redeem.body.friend.id, ownerId);
});

/* ------------------------------- 投递 ------------------------------- */

test('好友投递 kind:galaxy：payload 带我的密文 / 星系名 / 星数', async () => {
  const r = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'galaxy' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  const m = r.body.message;
  assert.equal(m.kind, 'galaxy');
  assert.equal(m.from.id, ownerId);
  assert.equal(m.payload.code, shareCode);
  assert.equal(m.payload.galaxyName, '主人甲的星系');
  assert.equal(m.payload.starCount, 4);
  assert.equal(m.claimed, false);

  const list = await api(FRIEND, 'GET', '/api/inbox');
  assert.ok(list.body.some((x) => x.id === m.id), '来信应出现在乙的收件箱');
});

test('好友关系是双向的：乙也能给甲赠星（friendships 只有一行）', async () => {
  // 乙自己的星系（用于赠星）
  const g = ownerGalaxy();
  g.stars = [{
    id: 'f1', con: 'qm', x: 10, y: 10, strength: 0.9, importance: 1,
    label: '乙的星', tags: [], summary: '乙的摘要',
    body: [{ id: 'fb', type: 'h2', text: '乙的要点' }],
  }];
  g.account = { name: '好友乙', avatar: '乙' };
  await api(FRIEND, 'PUT', '/api/galaxy', { data: g });

  const r = await api(FRIEND, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'star', starId: 'f1' });
  assert.equal(r.status, 200);
  assert.equal(r.body.message.payload.label, '乙的星');
  // 清理：甲忽略这封，保持后续断言干净
  await api(OWNER, 'POST', '/api/inbox/ack', { id: r.body.message.id, action: 'dismiss' });
});

test('非好友被拒 403；寄给自己 400；收件人不存在 404；未知类型 400', async () => {
  const r1 = await api(STRANGER, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'galaxy' });
  assert.equal(r1.status, 403);
  const r2 = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: strangerId, kind: 'galaxy' });
  assert.equal(r2.status, 403, '任一方向都要求好友关系');
  const r3 = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'galaxy' });
  assert.equal(r3.status, 400);
  const r4 = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: 999999, kind: 'galaxy' });
  assert.equal(r4.status, 404);
  const r5 = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'wormhole' });
  assert.equal(r5.status, 400);
});

test('kind:galaxy 要求分享已开启：乙未开分享 → 400', async () => {
  const r = await api(FRIEND, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'galaxy' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /分享/);
});

test('kind:star：HTML 剥离 + 长度钳制，正文永不进 payload', async () => {
  // s1：HTML 剥离
  const r1 = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'star', starId: 's1' });
  assert.equal(r1.status, 200);
  const p1 = r1.body.message.payload;
  assert.equal(p1.label, '薛定谔方程');
  assert.equal(p1.summary, '摘要带 标记 与实体 & 符号');
  assert.deepEqual(p1.keyPoints, ['波函数的演化', '定态解 & 能级']);
  assert.ok(!JSON.stringify(p1).includes('<'), 'payload 不得含任何 HTML 标签');
  assert.ok(!JSON.stringify(r1.body).includes(SECRET), '正文段落不得进收件箱');

  // s2：长度钳制（label 120 / summary 2000 / keyPoint 300 / keyPoints ≤ 12）
  const r2 = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'star', starId: 's2' });
  assert.equal(r2.status, 200);
  const p2 = r2.body.message.payload;
  assert.equal(p2.label.length, 120);
  assert.equal(p2.summary.length, 2000);
  assert.equal(p2.keyPoints.length, 12, 'keyPoints 至多 12 条');
  assert.equal(p2.keyPoints[0].length, 300, '单条要点钳到 300');

  // 不是自己星系里的星 → 404
  const r3 = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'star', starId: 'nope' });
  assert.equal(r3.status, 404);
  // 乙的星不在甲的星系里，同样 404（只能赠自己的星）
  const r4 = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'star', starId: 'f1' });
  assert.equal(r4.status, 404);
});

/* ------------------------------- 幂等 ------------------------------- */

test('幂等：同 (to,from,kind,starId) 未领取时返回既有消息，不重复入库', async () => {
  const before = await api(FRIEND, 'GET', '/api/inbox');
  const again = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'star', starId: 's1' });
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  const after = await api(FRIEND, 'GET', '/api/inbox');
  assert.equal(after.body.length, before.body.length, '重复投递不得新增来信');

  // galaxy 类型同样幂等
  const g = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'galaxy' });
  assert.equal(g.body.duplicate, true);

  // 领取后再寄 → 新消息（幂等只针对未领取）
  const dupId = again.body.message.id;
  const claim = await api(FRIEND, 'POST', '/api/inbox/ack', { id: dupId, action: 'claim' });
  assert.equal(claim.status, 200);
  const fresh = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'star', starId: 's1' });
  assert.equal(fresh.status, 200);
  assert.notEqual(fresh.body.duplicate, true, '已领取后重寄应是新来信');
  assert.notEqual(fresh.body.message.id, dupId);
});

test('重置密文后重寄邀请：好友那封未领取的邀请被刷成新密文（不再是死码）', async () => {
  /* 死锁场景：主人重置密文 → 重寄命中去重 → 好友收件箱里躺着的仍是旧密文，
     「去造访」必 404，而主人这边看到的却是「等待领取」。现在去重照做，
     但把那封未领取邀请的 payload 刷成最新密文。 */
  const oldCode = shareCode;
  const reset = await api(OWNER, 'POST', '/api/share', { enabled: true, reset: true });
  assert.equal(reset.status, 200);
  assert.notEqual(reset.body.code, oldCode);
  shareCode = reset.body.code;   // 后面的用例都认这个新码

  const resend = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'galaxy' });
  assert.equal(resend.status, 200);
  assert.equal(resend.body.duplicate, true, '仍是幂等命中，不重复入库');

  const box = await api(FRIEND, 'GET', '/api/inbox');
  const invite = box.body.find(m => m.kind === 'galaxy' && !m.claimed && m.from && m.from.id === ownerId);
  assert.ok(invite, '未领取的造访邀请应还在');
  assert.equal(invite.payload.code, shareCode, '邀请里的密文必须是最新的');
  assert.notEqual(invite.payload.code, oldCode);

  // 新码是真的能用：陌生丙拿它兑换成功（顺手把关系清掉，别影响后面的用例）
  const redeem = await api(STRANGER, 'POST', '/api/friends/redeem', { code: invite.payload.code });
  assert.equal(redeem.status, 200);
  await api(STRANGER, 'POST', '/api/friends/remove', { friendId: ownerId });
});

/* ------------------------------- collect ------------------------------- */

test('collect（outline 档）：label + keyPoints，无 summary；投进自己收件箱，from=主人', async () => {
  const r = await api(FRIEND, 'POST', '/api/inbox/collect', { code: shareCode, starId: 's3' });
  assert.equal(r.status, 200);
  const m = r.body.message;
  assert.equal(m.kind, 'star');
  assert.equal(m.from.id, ownerId, '寄件人是星系主人');
  assert.equal(m.payload.label, '不确定性原理');
  assert.deepEqual(m.payload.keyPoints, ['位置与动量']);
  assert.equal(m.payload.summary, undefined, 'collect 永不带摘要');
  assert.ok(!JSON.stringify(r.body).includes(SECRET));

  const list = await api(FRIEND, 'GET', '/api/inbox');
  assert.ok(list.body.some((x) => x.id === m.id), '收纳进的是自己的收件箱');
});

test('collect（stars 档）：只有星名，keyPoints/summary 都不带', async () => {
  await api(OWNER, 'POST', '/api/share', { visibility: 'stars' });
  const r = await api(FRIEND, 'POST', '/api/inbox/collect', { code: shareCode, starId: 's4' });
  assert.equal(r.status, 200);
  const p = r.body.message.payload;
  assert.equal(p.label, '泡利不相容');
  assert.equal(p.keyPoints, undefined, 'stars 档不得带大纲要点');
  assert.equal(p.summary, undefined);
  await api(OWNER, 'POST', '/api/share', { visibility: 'outline' }); // 还原
});

test('collect：无效密文 404、自己的星系 400、星不存在 404', async () => {
  const r1 = await api(FRIEND, 'POST', '/api/inbox/collect', { code: 'XING-XXXX-YYYY', starId: 's3' });
  assert.equal(r1.status, 404);
  const r2 = await api(OWNER, 'POST', '/api/inbox/collect', { code: shareCode, starId: 's3' });
  assert.equal(r2.status, 400);
  const r3 = await api(FRIEND, 'POST', '/api/inbox/collect', { code: shareCode, starId: 'nope' });
  assert.equal(r3.status, 404);
});

/* ------------------------------- 拉黑 ------------------------------- */

test('拉黑后两个方向都投递不进，collect 也被拒；解除后恢复', async () => {
  const block = await api(OWNER, 'POST', '/api/share/block', { viewerId: friendId, blocked: true });
  assert.equal(block.status, 200);

  const r1 = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'star', starId: 's3' });
  assert.equal(r1.status, 403, '甲→乙 投递不进');
  const r2 = await api(FRIEND, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'star', starId: 'f1' });
  assert.equal(r2.status, 403, '乙→甲 也投递不进');
  const r3 = await api(FRIEND, 'POST', '/api/inbox/collect', { code: shareCode, starId: 's3' });
  assert.equal(r3.status, 403, '被拉黑者不能收纳');

  await api(OWNER, 'POST', '/api/share/block', { viewerId: friendId, blocked: false });
  const ok = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'star', starId: 's3' });
  assert.equal(ok.status, 200, '解除拉黑后恢复投递');
});

/* ------------------------------- ack ------------------------------- */

test('ack：claim 标记领取、dismiss 删除、别人的来信 404、未知操作 400', async () => {
  const sent = await api(OWNER, 'POST', '/api/inbox/send', { toUserId: friendId, kind: 'star', starId: 's4' });
  assert.equal(sent.status, 200);
  const id = sent.body.message.id;

  // 别人（甲/丙）不能 ack 乙的来信
  const foreign = await api(OWNER, 'POST', '/api/inbox/ack', { id, action: 'claim' });
  assert.equal(foreign.status, 404);
  const bad = await api(FRIEND, 'POST', '/api/inbox/ack', { id, action: 'burn' });
  assert.equal(bad.status, 400);

  const claim = await api(FRIEND, 'POST', '/api/inbox/ack', { id, action: 'claim' });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.message.claimed, true);
  const list1 = await api(FRIEND, 'GET', '/api/inbox');
  assert.equal(list1.body.find((m) => m.id === id).claimed, true, '领取后仍在列表里、claimed=true');

  const dismiss = await api(FRIEND, 'POST', '/api/inbox/ack', { id, action: 'dismiss' });
  assert.equal(dismiss.status, 200);
  const list2 = await api(FRIEND, 'GET', '/api/inbox');
  assert.ok(!list2.body.some((m) => m.id === id), '忽略即删除');

  const gone = await api(FRIEND, 'POST', '/api/inbox/ack', { id, action: 'claim' });
  assert.equal(gone.status, 404);
});

test('GET /api/inbox 按时间倒序（id 递减）', async () => {
  const list = await api(FRIEND, 'GET', '/api/inbox');
  assert.ok(list.body.length >= 2);
  for (let i = 1; i < list.body.length; i++) {
    assert.ok(list.body[i - 1].id > list.body[i].id, '新来信在前');
  }
});

/* ------------------------------- 速率 ------------------------------- */

test('速率限制：每用户每分钟 ≤ 20 条投递；幂等命中不消耗配额', async () => {
  const R_OWNER = 'token-inbox-rate-owner';
  const R_FRIEND = 'token-inbox-rate-friend';
  await api(R_OWNER, 'POST', '/api/hello', { name: '限速主人', avatar: '速' });
  const hf = await api(R_FRIEND, 'POST', '/api/hello', { name: '限速好友', avatar: '友' });
  const rFriendId = hf.body.user.id;

  const g = ownerGalaxy();
  g.stars = Array.from({ length: 21 }, (_, i) => ({
    id: 'r' + i, con: 'qm', x: i, y: i, strength: 0.5, importance: 1,
    label: '限速星' + i, tags: [], summary: '', body: [],
  }));
  g.account = { name: '限速主人', avatar: '速' };
  await api(R_OWNER, 'PUT', '/api/galaxy', { data: g });
  const share = await api(R_OWNER, 'POST', '/api/share', { enabled: true, visibility: 'outline' });
  await api(R_FRIEND, 'POST', '/api/friends/redeem', { code: share.body.code });

  // 20 颗不同的星 → 全部成功
  for (let i = 0; i < 20; i++) {
    const r = await api(R_OWNER, 'POST', '/api/inbox/send', { toUserId: rFriendId, kind: 'star', starId: 'r' + i });
    assert.equal(r.status, 200, `第 ${i + 1} 条应成功`);
  }
  // 第 21 条（新的 starId）→ 429
  const over = await api(R_OWNER, 'POST', '/api/inbox/send', { toUserId: rFriendId, kind: 'star', starId: 'r20' });
  assert.equal(over.status, 429);
  // 幂等命中（重寄 r0，仍未领取）→ 200，不消耗配额
  const dup = await api(R_OWNER, 'POST', '/api/inbox/send', { toUserId: rFriendId, kind: 'star', starId: 'r0' });
  assert.equal(dup.status, 200);
  assert.equal(dup.body.duplicate, true);
});
