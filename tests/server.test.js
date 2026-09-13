/* 星图 Stellar Raft — 本地后端 REST 流程测试
   server/server.js 是零依赖的（node:http + node:sqlite）。测试直接启动仓库里的
   那一份，用 SR_DB 把库指到临时目录，端口用先探测的空闲端口注入 —— 既不污染
   仓库数据库，跑的又是真实代码（而不是一份复制品）。

   覆盖：注册（hello）→ 存/取星系 → 开启分享 → 兑换分享码 → 可见度剥离
   （outline / stars，正文与摘要永不出库）→ 拉黑/解除 → 关闭分享 → 重置密文
   → 移除好友 → beacon 兜底保存 → 演示好友种子。 */

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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-test-'));

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

  // 等待就绪（最多 10s）
  for (let i = 0; ; i++) {
    try {
      // 就绪探测走静态根路径：/api/hello 会给探测令牌建一个游客账号，
      // 把「每 IP 一个游客」的名额提前吃掉
      const r = await fetch(baseUrl + '/', { redirect: 'manual' });
      if (r.status) break;
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

const SECRET = '这段正文绝不允许离开数据库_SECRET_BODY';
const galaxyOf = (name) => ({
  constellations: [{ id: 'qm', name: '量子力学', color: '#9fc6ff', health: 0.7, count: 1 }],
  stars: [
    {
      id: 's1',
      con: 'qm',
      x: 40,
      y: 40,
      strength: 0.8,
      importance: 1,
      label: '薛定谔方程',
      tags: ['概念', '公式'],
      summary: '含密摘要:' + SECRET,
      body: [
        { id: 'b1', type: 'h1', text: '<b>波函数</b>的演化' },
        { id: 'b2', type: 'p', text: SECRET },
        { id: 'b3', type: 'h2', text: '定态解 &amp; 能级' },
      ],
    },
  ],
  connections: [{ a: 's1', b: 's1', kind: 'intra', rel: '自指（测试）' }],
  notes: [],
  account: { name, avatar: '星' },
});

const A = 'token-owner-aaa';
const B = 'token-viewer-bbb';

/* ------------------------------- 流程 ------------------------------- */

test('缺少 token 一律 401', async () => {
  const r = await api(null, 'POST', '/api/hello', {});
  assert.equal(r.status, 401);
});

test('注册 / 建档：POST /api/hello', async () => {
  const r = await api(A, 'POST', '/api/hello', { name: '主人甲', avatar: '甲' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.name, '主人甲');
  assert.equal(r.body.hasGalaxy, false);
  assert.equal(r.body.share.enabled, false);

  const r2 = await api(B, 'POST', '/api/hello', { name: '访客乙', avatar: '乙' });
  assert.equal(r2.status, 200);
});

test('星系整存整取：PUT/GET /api/galaxy', async () => {
  const bad = await api(A, 'PUT', '/api/galaxy', { data: { stars: '不是数组' } });
  assert.equal(bad.status, 400);

  const put = await api(A, 'PUT', '/api/galaxy', { data: galaxyOf('主人甲') });
  assert.equal(put.status, 200);

  const get = await api(A, 'GET', '/api/galaxy');
  assert.equal(get.status, 200);
  assert.deepEqual(get.body.data, galaxyOf('主人甲'));

  const hello = await api(A, 'POST', '/api/hello', {});
  assert.equal(hello.body.hasGalaxy, true);
});

test('乐观锁：baseVersion 不匹配返回 409 + 服务器最新版；匹配则递增', async () => {
  // 干净基线：先取当前版本
  const g0 = await api(A, 'GET', '/api/galaxy');
  const v0 = g0.body.version;
  assert.equal(typeof v0, 'number');

  // 带正确 baseVersion → 成功且 version 递增
  const ok = await api(A, 'PUT', '/api/galaxy', { data: galaxyOf('乐观锁甲'), baseVersion: v0 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.version, v0 + 1);

  // 用过期 baseVersion（模拟另一标签页落后一版）→ 409，回带服务器当前数据与版本
  const conflict = await api(A, 'PUT', '/api/galaxy', { data: galaxyOf('乐观锁乙'), baseVersion: v0 });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error, 'version_conflict');
  assert.equal(conflict.body.version, v0 + 1);
  assert.deepEqual(conflict.body.data, galaxyOf('乐观锁甲'));   // 未被乙覆盖

  // 无 baseVersion（beacon / 末发兜底）→ 不校验，直接落
  const force = await api(A, 'PUT', '/api/galaxy', { data: galaxyOf('乐观锁丙') });
  assert.equal(force.status, 200);
  const after = await api(A, 'GET', '/api/galaxy');
  assert.deepEqual(after.body.data, galaxyOf('乐观锁丙'));

  // 还原 A 的星系，避免影响后续共享测试（它们期望「主人甲」）
  await api(A, 'PUT', '/api/galaxy', { data: galaxyOf('主人甲'), baseVersion: after.body.version });
});

let shareCode;

test('开启分享得到星语密文', async () => {
  const r = await api(A, 'POST', '/api/share', { enabled: true, visibility: 'outline' });
  assert.equal(r.status, 200);
  assert.equal(r.body.enabled, true);
  assert.equal(r.body.visibility, 'outline');
  assert.match(r.body.code, /^XING-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  shareCode = r.body.code;
});

let ownerId;

test('兑换分享码：无效码 404、自兑 400、正常兑换 200', async () => {
  const bad = await api(B, 'POST', '/api/friends/redeem', { code: 'XING-XXXX-YYYY' });
  assert.equal(bad.status, 404);

  const self = await api(A, 'POST', '/api/friends/redeem', { code: shareCode });
  assert.equal(self.status, 400);

  const ok = await api(B, 'POST', '/api/friends/redeem', { code: shareCode.toLowerCase() });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.friend.name, '主人甲');
  ownerId = ok.body.friend.id;

  const friends = await api(B, 'GET', '/api/friends');
  assert.equal(friends.status, 200);
  const f = friends.body.friends.find((x) => x.id === ownerId);
  assert.ok(f, '好友列表应包含主人甲');
  assert.equal(f.starCount, 1);
  assert.equal(f.enabled, true);
});

test('outline 可见度：只出星名/标签/大纲，正文与摘要永不出库', async () => {
  const r = await api(B, 'GET', `/api/visit/${ownerId}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.galaxy.visibility, 'outline');

  const star = r.body.galaxy.stars[0];
  assert.equal(star.label, '薛定谔方程');
  assert.deepEqual(star.tags, ['概念', '公式']);
  // 大纲仅 h1/h2/h3，且 HTML 已剥离
  assert.deepEqual(
    star.outline.map((o) => o.type),
    ['h1', 'h2'],
  );
  assert.equal(star.outline[0].text, '波函数的演化');
  assert.equal(star.outline[1].text, '定态解 & 能级');
  assert.equal(star.body, undefined);
  assert.equal(star.summary, undefined);

  const raw = JSON.stringify(r.body);
  assert.ok(!raw.includes(SECRET), '访客视图不得包含正文/摘要内容');
});

test('stars 可见度：连标签和大纲也剥掉', async () => {
  const set = await api(A, 'POST', '/api/share', { visibility: 'stars' });
  assert.equal(set.body.visibility, 'stars');

  const r = await api(B, 'GET', `/api/visit/${ownerId}`);
  assert.equal(r.status, 200);
  const star = r.body.galaxy.stars[0];
  assert.deepEqual(star.tags, []);
  assert.deepEqual(star.outline, []);
  assert.ok(!JSON.stringify(r.body).includes(SECRET));
  // 星名与结构仍在（星名与星域结构可见）
  assert.equal(star.label, '薛定谔方程');
  assert.equal(r.body.galaxy.constellations[0].name, '量子力学');
});

test('拉黑访客：访问被拒、再兑换也被拒；解除后恢复', async () => {
  const before = await api(A, 'GET', '/api/share');
  const visitor = before.body.visitors.find((v) => v.name === '访客乙');
  assert.ok(visitor, '访客列表应包含访客乙');
  assert.equal(visitor.blocked, false);

  const block = await api(A, 'POST', '/api/share/block', { viewerId: visitor.id, blocked: true });
  assert.equal(block.status, 200);

  const denied = await api(B, 'GET', `/api/visit/${ownerId}`);
  assert.equal(denied.status, 403);

  const redeemAgain = await api(B, 'POST', '/api/friends/redeem', { code: shareCode });
  assert.equal(redeemAgain.status, 403);

  const unblock = await api(A, 'POST', '/api/share/block', { viewerId: visitor.id, blocked: false });
  assert.equal(unblock.status, 200);
  const restored = await api(B, 'GET', `/api/visit/${ownerId}`);
  assert.equal(restored.status, 200);
});

test('被隐身的访客不能靠「移除好友再重新兑换」自助解除隐身', async () => {
  const before = await api(A, 'GET', '/api/share');
  const visitor = before.body.visitors.find((v) => v.name === '访客乙');
  assert.ok(visitor, '访客列表应包含访客乙');

  // 主人隐身 → 访客移除好友（这一侧照常返回 200）→ 同一段密文重新兑换
  await api(A, 'POST', '/api/share/block', { viewerId: visitor.id, blocked: true });
  const rm = await api(B, 'POST', '/api/friends/remove', { friendId: ownerId });
  assert.equal(rm.status, 200);
  const re = await api(B, 'POST', '/api/friends/redeem', { code: shareCode });
  assert.equal(re.status, 403, '隐身状态必须挺过 移除→重兑换，不能落回 blocked=0');
  const denied = await api(B, 'GET', `/api/visit/${ownerId}`);
  assert.equal(denied.status, 403);

  // 行还在（隐身记录没有丢），主人解除后一切恢复
  const list = await api(B, 'GET', '/api/friends');
  assert.ok(list.body.friends.some((f) => f.id === ownerId && f.blocked), '被隐身的行应留在库里');
  await api(A, 'POST', '/api/share/block', { viewerId: visitor.id, blocked: false });
  assert.equal((await api(B, 'GET', `/api/visit/${ownerId}`)).status, 200);

  // 未被隐身的正常移除不受影响：删掉即真的删掉
  const rm2 = await api(B, 'POST', '/api/friends/remove', { friendId: ownerId });
  assert.equal(rm2.status, 200);
  const list2 = await api(B, 'GET', '/api/friends');
  assert.ok(!list2.body.friends.some((f) => f.id === ownerId), '正常移除应当真的消失');
  // 把关系加回来，别影响后面的测试
  const re2 = await api(B, 'POST', '/api/friends/redeem', { code: shareCode });
  assert.equal(re2.status, 200);
});

test('关闭分享后访客即刻失去访问；重置密文换新码', async () => {
  const off = await api(A, 'POST', '/api/share', { enabled: false });
  assert.equal(off.body.enabled, false);
  const denied = await api(B, 'GET', `/api/visit/${ownerId}`);
  assert.equal(denied.status, 403);

  const on = await api(A, 'POST', '/api/share', { enabled: true, reset: true });
  assert.equal(on.body.enabled, true);
  assert.notEqual(on.body.code, shareCode, '重置后密文必须更换');
  assert.match(on.body.code, /^XING-/);
  shareCode = on.body.code;

  const ok = await api(B, 'GET', `/api/visit/${ownerId}`);
  assert.equal(ok.status, 200, '重置密文不影响既有访客关系');
});

test('移除好友星系', async () => {
  const rm = await api(B, 'POST', '/api/friends/remove', { friendId: ownerId });
  assert.equal(rm.status, 200);
  const friends = await api(B, 'GET', '/api/friends');
  assert.ok(!friends.body.friends.some((f) => f.id === ownerId));
  const denied = await api(B, 'GET', `/api/visit/${ownerId}`);
  assert.equal(denied.status, 403);
});

test('beacon 兜底保存（sendBeacon 通道，token 走 query）', async () => {
  const data = galaxyOf('主人甲');
  data.stars[0].label = '海森堡不确定性';
  const res = await fetch(`${baseUrl}/api/galaxy/beacon?token=${A}`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
  assert.equal(res.status, 200);
  const get = await api(A, 'GET', '/api/galaxy');
  assert.equal(get.body.data.stars[0].label, '海森堡不确定性');
});

test('演示好友种子可兑换（XING-DEMO-2333）', async () => {
  const r = await api(B, 'POST', '/api/friends/redeem', { code: 'XING-DEMO-2333' });
  assert.equal(r.status, 200);
  assert.equal(r.body.friend.name, '星图伙伴');
  const visit = await api(B, 'GET', `/api/visit/${r.body.friend.id}`);
  assert.equal(visit.status, 200);
  assert.equal(visit.body.galaxy.visibility, 'outline');
  assert.ok(visit.body.galaxy.stars.length >= 6);
});

/* 畸形请求体不该把服务器打成 500。
   曾经的漏洞是最朴素的那种：请求体写一个字面量 `null` —— 合法 JSON，JSON.parse
   欣然返回 null，而每个路由紧接着就读 body.xxx。一行 `curl -d null` 就能让每个
   POST 接口回一句「Cannot read properties of null」。5xx 是「服务器自己出了错」，
   把用户送来的垃圾算在自己头上，既误导排查，也把内部报错原样吐了出去。 */
test('畸形请求体：null / 数组 / 类型全错，一律 4xx 而不是 5xx', async () => {
  const junk = [
    null, 42, '"字符串"', '[]',                                   // 合法 JSON 但不是对象
    '{"id":{},"password":[]}', '{"data":"不是对象"}', '{"data":{"stars":"不是数组"}}',
    '{"toUserId":{},"kind":{}}', '{"code":{},"starId":[]}', '{"id":"NaN","action":{}}',
    '{"viewerId":{},"blocked":{}}', '{"friendId":{}}', '{"enabled":{},"visibility":{}}',
    '{"username":{},"email":[],"password":{}}', '{"old":{},"new":[]}', '{"name":{},"avatar":[]}',
  ];
  const posts = [
    '/api/hello', '/api/auth/register', '/api/auth/login', '/api/auth/password', '/api/auth/email',
    '/api/auth/handover', '/api/share', '/api/share/block', '/api/friends/redeem', '/api/friends/remove',
    '/api/inbox/send', '/api/inbox/collect', '/api/inbox/ack',
  ];
  const bad = [];
  for (const p of posts) {
    for (const raw of junk) {
      const res = await fetch(baseUrl + p, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A },
        body: typeof raw === 'string' ? raw : JSON.stringify(raw),
      });
      if (res.status >= 500) bad.push(`POST ${p} <- ${typeof raw === 'string' ? raw : JSON.stringify(raw)} => ${res.status}`);
    }
  }
  // PUT /api/galaxy 同样过一遍（它是唯一的 PUT）
  for (const raw of junk) {
    const res = await fetch(baseUrl + '/api/galaxy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A },
      body: typeof raw === 'string' ? raw : JSON.stringify(raw),
    });
    if (res.status >= 500) bad.push(`PUT /api/galaxy <- ${typeof raw === 'string' ? raw : JSON.stringify(raw)} => ${res.status}`);
  }
  assert.deepEqual(bad, [], '这些请求把服务器打成了 5xx：\n' + bad.join('\n'));

  // 真正的坏 JSON 仍然要被明确拒绝（400），而不是当成空对象放行
  const broken = await fetch(baseUrl + '/api/hello', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A },
    body: '{ 这不是 json',
  });
  assert.equal(broken.status, 400);
});

/* 超大请求体：说清是「太大了」，而不是含混的「格式错误」。
   星图是整片星空一次整存，所以这条 8MB 的线同时也是「一片星空能有多大」——
   笔记里内联一张手机原图就能顶穿它。客户端据 413 给一句人话（去压那张图），
   若混成 400 或网络错误，用户只会一直等一个永远不会到来的「网络恢复」。 */
test('请求体超过 8MB：413 + tooLarge，而不是 400 或直接断开', async () => {
  const huge = JSON.stringify({ data: { stars: [], constellations: [], blob: 'x'.repeat(9 * 1024 * 1024) } });
  const res = await fetch(baseUrl + '/api/galaxy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A },
    body: huge,
  });
  assert.equal(res.status, 413);
  const j = await res.json();
  assert.equal(j.tooLarge, true);
  assert.match(j.error, /8MB/);
  assert.match(j.error, /图/, '要指出多半是内联大图，人才知道下一步做什么');

  // 被拒之后原来的星系分毫未动
  const still = await api(A, 'GET', '/api/galaxy');
  assert.equal(still.status, 200);
  assert.ok(Array.isArray(still.body.data.stars));
});

test('未知接口 404', async () => {
  const r = await api(A, 'GET', '/api/nonsense');
  assert.equal(r.status, 404);
});

/* --------------------------- 访客视图实时衰减 --------------------------- */

test('访客视角强度按 sr 实时衰减，sr 内部字段不出库，无 sr 旧星保持原值', async () => {
  const OWNER = 'token-owner-decay';
  const VIEWER = 'token-viewer-decay';
  await api(OWNER, 'POST', '/api/hello', { name: '衰减主人', avatar: '衰' });
  await api(VIEWER, 'POST', '/api/hello', { name: '衰减访客', avatar: '客' });

  // 一颗 5 天前复习过、稳定度 S=10 天的星：快照静态 strength 写成 0.9（陈旧值）
  const S = 10;
  const daysAgo = 5;
  const DAY = 86400000;
  const data = galaxyOf('衰减主人');
  data.stars[0].strength = 0.9;
  data.stars[0].sr = { S, last: Date.now() - daysAgo * DAY, due: 0 };
  // 一颗没有 sr 的旧星：出库时应原样保留静态 strength
  data.stars.push({
    id: 's-legacy', con: 'qm', x: 60, y: 60, strength: 0.66,
    importance: 1, label: '旧星', tags: [], summary: '', body: [],
  });
  await api(OWNER, 'PUT', '/api/galaxy', { data });

  const share = await api(OWNER, 'POST', '/api/share', { enabled: true, visibility: 'outline' });
  const redeem = await api(VIEWER, 'POST', '/api/friends/redeem', { code: share.body.code });
  assert.equal(redeem.status, 200);

  const r = await api(VIEWER, 'GET', `/api/visit/${redeem.body.friend.id}`);
  assert.equal(r.status, 200);

  const decayed = r.body.galaxy.stars.find((s) => s.id === 's1');
  // R = exp(−Δt天/S) = exp(−5/10) ≈ 0.6065；容忍请求耗时带来的微小偏差
  const expected = Math.exp(-daysAgo / S);
  assert.ok(
    Math.abs(decayed.strength - expected) < 0.01,
    `访客拿到的 strength 应是实时衰减值 ~${expected.toFixed(3)}，实际 ${decayed.strength}`,
  );
  assert.ok(decayed.strength < 0.8, '不得原样返回快照里的静态 strength(0.9)');
  // sr 内部字段（S / last / due）绝不外泄
  assert.equal(decayed.sr, undefined);
  assert.ok(!JSON.stringify(r.body).includes('"sr"'), '访客视图不得包含 sr 字段');

  const legacy = r.body.galaxy.stars.find((s) => s.id === 's-legacy');
  assert.equal(legacy.strength, 0.66, '无 sr 的旧星保持快照静态强度');
});

test('访客视角星域 health/count 按衰减后成员强度重算，不透传快照静态值', async () => {
  const VIEWER = 'token-viewer-decay';
  // 前一个测试里：s1 衰减到 ~exp(-0.5)，s-legacy 保持 0.66，快照静态 health=0.7 / count=1
  const friends = await api(VIEWER, 'GET', '/api/friends');
  const owner = friends.body.friends.find((f) => f.name === '衰减主人');
  assert.ok(owner, '好友列表应包含衰减主人');
  const r = await api(VIEWER, 'GET', `/api/visit/${owner.id}`);
  assert.equal(r.status, 200);
  const con = r.body.galaxy.constellations.find((c) => c.id === 'qm');
  const stars = r.body.galaxy.stars.filter((s) => s.con === 'qm');
  assert.equal(con.count, stars.length, 'count 按现存成员数重算');
  const mean = stars.reduce((a, s) => a + s.strength, 0) / stars.length;
  assert.ok(Math.abs(con.health - mean) < 0.002, `health 应为衰减后强度均值 ~${mean.toFixed(3)}，实际 ${con.health}`);
  assert.notEqual(con.health, 0.7, '不得原样返回快照静态 health');
});

/* --------------------------- 访客视角点亮认证态 --------------------------- */

test('访客视角 lit/ember：布尔透传、按实时 R 判熄灭、不泄露时间戳，litRatio 与前端同口径', async () => {
  const OWNER = 'token-owner-lit';
  const VIEWER = 'token-viewer-lit';
  await api(OWNER, 'POST', '/api/hello', { name: '点亮主人', avatar: '点' });
  await api(VIEWER, 'POST', '/api/hello', { name: '点亮访客', avatar: '客' });

  const DAY = 86400000;
  const now = Date.now();
  const data = galaxyOf('点亮主人');
  const base = data.stars[0];
  data.stars = [
    // 已点亮且 R = exp(−5/10) ≈ 0.61 ≥ 0.35 → 访客看到 lit
    { ...base, id: 'a', label: '仍点亮', sr: { S: 10, last: now - 5 * DAY, due: 0, lit: now - 10 * DAY, ember: 0 } },
    // 快照里还写着 lit>0，但 R = exp(−2) ≈ 0.135 < 0.35 → 访客视角实时熄灭为 ember
    { ...base, id: 'b', label: '实时熄灭', sr: { S: 10, last: now - 20 * DAY, due: 0, lit: now - 30 * DAY, ember: 0 } },
    // 主人端已熄灭（lit=0, ember>0）→ 透传 ember
    { ...base, id: 'c', label: '待重燃', sr: { S: 10, last: now - 2 * DAY, due: 0, lit: 0, ember: now - DAY } },
    // 从未点亮
    { ...base, id: 'd', label: '未点亮', sr: { S: 10, last: now - 2 * DAY, due: 0, lit: 0, ember: 0 } },
    // 无 sr 的旧星：两个布尔都为 false
    { id: 'e', con: 'qm', x: 1, y: 1, strength: 0.5, importance: 1, label: '旧星', tags: [], summary: '', body: [] },
  ];
  await api(OWNER, 'PUT', '/api/galaxy', { data });
  const share = await api(OWNER, 'POST', '/api/share', { enabled: true, visibility: 'stars' });
  const redeem = await api(VIEWER, 'POST', '/api/friends/redeem', { code: share.body.code });
  assert.equal(redeem.status, 200);
  const r = await api(VIEWER, 'GET', `/api/visit/${redeem.body.friend.id}`);
  assert.equal(r.status, 200);

  const byId = Object.fromEntries(r.body.galaxy.stars.map((s) => [s.id, s]));
  assert.equal(byId.a.lit, true);
  assert.equal(byId.a.ember, false);
  assert.equal(byId.b.lit, false, '主人离线多日：访客看到的不只是变暗，还有熄灭');
  assert.equal(byId.b.ember, true);
  assert.equal(byId.c.lit, false);
  assert.equal(byId.c.ember, true);
  assert.equal(byId.d.lit, false);
  assert.equal(byId.d.ember, false);
  assert.equal(byId.e.lit, false);
  assert.equal(byId.e.ember, false);
  // 只出布尔，绝不泄露 lit/ember 时间戳与 sr 内部字段
  for (const s of r.body.galaxy.stars) {
    assert.equal(typeof s.lit, 'boolean');
    assert.equal(typeof s.ember, 'boolean');
  }
  assert.ok(!JSON.stringify(r.body).includes('"sr"'), '访客视图不得包含 sr 字段');

  // litRatio 与前端 syncCounts 同式（已点亮成员数 / 成员数，访客端按实时熄灭后的 lit 计）
  const con = r.body.galaxy.constellations.find((c) => c.id === 'qm');
  assert.equal(con.litRatio, 0.2, '5 颗成员只有 a 仍点亮 → 1/5');
  // health 口径不变：仍是衰减后成员强度均值
  const mean = r.body.galaxy.stars.reduce((acc, s) => acc + s.strength, 0) / r.body.galaxy.stars.length;
  assert.ok(Math.abs(con.health - mean) < 0.002, `health 应为衰减后均值 ~${mean.toFixed(3)}，实际 ${con.health}`);
});

/* ----------------------------- 静态文件服务 ----------------------------- */

test('根路径 302 重定向到应用目录（相对引用只有在目录路径下才成立）', async () => {
  for (const p of ['/', '/index.html']) {
    const r = await fetch(baseUrl + p, { redirect: 'manual' });
    assert.equal(r.status, 302, p + ' 应重定向');
    assert.equal(r.headers.get('location'), '/ui_kits/stellar-raft/');
  }
});

test('目录路径回退：/docs/ 返回 index.html（200）', async () => {
  const r = await fetch(baseUrl + '/docs/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/html/);
  assert.match(await r.text(), /Stellar Raft/);   // 落到仓库真实的 docs/index.html
});

test('路径穿越仍被挡：/../ 一律 403', async () => {
  // fetch/URL 会归一化字面 /../，用 %2f 编码绕过客户端归一化，服务端解码后必须拦截
  const r1 = await fetch(baseUrl + '/..%2fserver%2fstellar.db');
  assert.equal(r1.status, 403);
  const r2 = await fetch(baseUrl + '/..%2f'); // 目录回退分支也不能放行穿越
  assert.equal(r2.status, 403);
  const r3 = await fetch(baseUrl + '/..%2f..%2fetc%2fpasswd');
  assert.equal(r3.status, 403);
});

/* --------------------- beacon 乐观锁 · 造访主人简介 --------------------- */

test('beacon 乐观锁：版本落后的末发被放弃，版本对齐的正常落库', async () => {
  const T = 'token-beacon-lock';
  await api(T, 'POST', '/api/hello', { name: '锁主', avatar: '锁' });
  const put1 = await api(T, 'PUT', '/api/galaxy', { data: galaxyOf('锁主') });
  const d2 = galaxyOf('锁主'); d2.stars[0].label = '第二版';
  const put2 = await api(T, 'PUT', '/api/galaxy', { data: d2, baseVersion: put1.body.version });
  assert.equal(put2.status, 200);

  // 过期 baseVersion 的末发 → 服务器放弃写入，最新版不被覆盖
  const stale = galaxyOf('锁主'); stale.stars[0].label = '过期末发';
  const res = await fetch(`${baseUrl}/api/galaxy/beacon?token=${T}`, {
    method: 'POST', body: JSON.stringify({ data: stale, baseVersion: put1.body.version }),
  });
  assert.equal(res.status, 200);
  let get = await api(T, 'GET', '/api/galaxy');
  assert.equal(get.body.data.stars[0].label, '第二版');

  // 版本对齐的末发 → 正常落库；不带 baseVersion 的旧客户端仍按兜底放行
  const fresh = galaxyOf('锁主'); fresh.stars[0].label = '末发落库';
  await fetch(`${baseUrl}/api/galaxy/beacon?token=${T}`, {
    method: 'POST', body: JSON.stringify({ data: fresh, baseVersion: put2.body.version }),
  });
  get = await api(T, 'GET', '/api/galaxy');
  assert.equal(get.body.data.stars[0].label, '末发落库');
});

test('造访返回主人简介：剥 HTML、钳 160 字；偏好与 AI 配置绝不出库', async () => {
  const O = 'token-bio-owner', V = 'token-bio-viewer';
  await api(O, 'POST', '/api/hello', { name: '简介主', avatar: '简' });
  await api(V, 'POST', '/api/hello', { name: '简介客', avatar: '客' });
  const g = galaxyOf('简介主');
  g.account.bio = '<b>观星</b>十年' + '长'.repeat(300);
  g.prefs = { nickname: '简介主', remindTime: '20:00' };
  g.aiConfig = { provider: 'openai', providers: { openai: { key: 'sk-secret-123' } } };
  await api(O, 'PUT', '/api/galaxy', { data: g });

  const share = await api(O, 'POST', '/api/share', { enabled: true, visibility: 'outline' });
  const redeem = await api(V, 'POST', '/api/friends/redeem', { code: share.body.code });
  assert.equal(redeem.status, 200);

  const visit = await api(V, 'GET', `/api/visit/${redeem.body.friend.id}`);
  assert.equal(visit.status, 200);
  assert.ok(visit.body.owner.bio.startsWith('观星十年'), '简介应剥掉 HTML 标签保留文本');
  assert.ok(!visit.body.owner.bio.includes('<'));
  assert.ok(visit.body.owner.bio.length <= 160, '简介应钳长度');
  const raw = JSON.stringify(visit.body);
  assert.ok(!raw.includes('sk-secret-123'), 'AI 密钥绝不能出现在访客视图');
  assert.ok(!raw.includes('remindTime'), '偏好不透传给访客');
});

test('嵌套投毒：快照里数组的坏成员拖不垮访客视图（每层都兜底）', async () => {
  const O = 'token-poison-owner', V = 'token-poison-viewer';
  await api(O, 'POST', '/api/hello', { name: '毒库主', avatar: '毒' });
  await api(V, 'POST', '/api/hello', { name: '造访者', avatar: '访' });

  // 顶层数组都合法（写入端校验放行），坏的是**成员**：null、字符串、
  // body 是字符串的星、tags 是字符串的星、null 星域、null 连线
  await api(O, 'PUT', '/api/galaxy', {
    data: {
      constellations: [null, 'oops', { id: 'c1', name: '好域' }],
      connections: [null, { a: 'good', b: 'good', kind: 'intra' }],
      stars: [
        null,
        'oops',
        { id: 'good', con: 'c1', x: 1, y: 1, label: '好星', body: [{ type: 'h2', text: '<b>标题</b>' }, null], tags: ['好'] },
        { id: 'badbody', con: 'c1', x: 2, y: 2, label: '坏身星', body: 'not-an-array', tags: 'not-an-array' },
      ],
    },
  });

  const share = await api(O, 'POST', '/api/share', { enabled: true, visibility: 'outline' });
  const redeem = await api(V, 'POST', '/api/friends/redeem', { code: share.body.code });
  assert.equal(redeem.status, 200);

  const visit = await api(V, 'GET', `/api/visit/${redeem.body.friend.id}`);
  assert.equal(visit.status, 200, '嵌套坏数据不该把造访打成 500');
  const labels = visit.body.galaxy.stars.map((s) => s.label);
  assert.ok(labels.includes('好星') && labels.includes('坏身星'), '好星与带病星都该留下（坏字段被剥离）');
  const bad = visit.body.galaxy.stars.find((s) => s.label === '坏身星');
  assert.deepEqual(bad.tags, [], '字符串 tags 应被剥成空数组');
  assert.deepEqual(bad.outline, [], '字符串 body 应被剥成空大纲');
  const good = visit.body.galaxy.stars.find((s) => s.label === '好星');
  assert.equal(good.outline.length, 1, '好星的大纲只留合法块（null 块剔除）');
  assert.equal(good.outline[0].text, '标题', '大纲剥 HTML');
  assert.equal(visit.body.galaxy.constellations.length, 1, 'null/字符串星域剔除');
  assert.equal(visit.body.galaxy.connections.length, 1, 'null 连线剔除');
});

/* --------------------- 星语留言 · 访客足迹 --------------------- */

test('星语：好友可寄、陌生人 403、剥 HTML 钳 160、未读封顶 5 句', async () => {
  const O = 'token-bio-owner', V = 'token-bio-viewer', S = 'token-note-stranger';
  await api(S, 'POST', '/api/hello', { name: '陌生人', avatar: '陌' });
  const hello = await api(O, 'POST', '/api/hello', {});
  const ownerId = hello.body.user.id;

  const forbid = await api(S, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'note', text: '你好' });
  assert.equal(forbid.status, 403);

  const empty = await api(V, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'note', text: '   ' });
  assert.equal(empty.status, 400);

  const long = '<b>星语</b>' + '很'.repeat(300);
  const ok = await api(V, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'note', text: long });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.message.payload.text.startsWith('星语'), '剥 HTML');
  assert.ok(ok.body.message.payload.text.length <= 160, '钳长度');

  // 星语不受「同类未领取即重复」抑制：能连寄多句；未读到 5 句后 429
  for (let k = 0; k < 4; k++) {
    const r = await api(V, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'note', text: '第' + k + '句' });
    assert.equal(r.status, 200);
    assert.ok(!r.body.duplicate, '星语不该被去重抑制');
  }
  const capped = await api(V, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'note', text: '第六句' });
  assert.equal(capped.status, 429);

  // 主人收信并领取一句后，又能继续寄
  const list = await api(O, 'GET', '/api/inbox');
  const note = list.body.find(mm => mm.kind === 'note');
  assert.ok(note);
  const ack = await api(O, 'POST', '/api/inbox/ack', { id: note.id, action: 'claim' });
  assert.equal(ack.status, 200);
  const again = await api(V, 'POST', '/api/inbox/send', { toUserId: ownerId, kind: 'note', text: '又一句' });
  assert.equal(again.status, 200);
});

test('访客足迹：造访后 share.visitors 带 lastVisit 时刻', async () => {
  const O = 'token-bio-owner', V = 'token-bio-viewer';
  const hello = await api(O, 'POST', '/api/hello', {});
  await api(V, 'GET', `/api/visit/${hello.body.user.id}`);
  const share = await api(O, 'GET', '/api/share');
  const v = share.body.visitors.find(x => x.name === '简介客');
  assert.ok(v, '访客列表应包含简介客');
  assert.match(String(v.lastVisit), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, '足迹为 UTC 时刻');
});

/* ——— SR_DB：库的落点可以搬走 ———
   默认落在 server/ 边上；SR_DB 指到哪儿就写到哪儿，父目录不存在当场建出来。
   这条是部署（指向数据盘）和本地起第二个实例（指向临时库）都依赖的前提。 */
test('SR_DB：数据库按环境变量落点，父目录自动创建；缺省仍在 server/ 边上', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-srdb-'));
  // 特意多套一层还不存在的目录，验证会被建出来
  const dbPath = path.join(dir, '还没有的目录', 'moved.db');
  const port = await freePort();
  const proc = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, PORT: String(port), SR_DB: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  proc.stdout.on('data', (d) => (logs += d));
  proc.stderr.on('data', (d) => (logs += d));
  try {
    const base = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 10000;
    for (;;) {
      try { await fetch(base + '/api/state'); break; } catch {
        if (Date.now() > deadline) throw new Error('SR_DB 实例未能就绪：' + logs);
        await new Promise((r) => setTimeout(r, 120));
      }
    }
    assert.ok(fs.existsSync(dbPath), '库应落在 SR_DB 指定的位置');
    assert.ok(fs.statSync(dbPath).size > 0, '库应已建表，不是空文件');
    // 仓库自带的 server/stellar.db 不该被这次启动碰出来
    assert.match(logs, /数据库 /, '启动日志应打出库的位置');
    assert.ok(!logs.includes('../../'), '库在仓库外时日志应给绝对路径，而非一串 ../..');
  } finally {
    proc.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
