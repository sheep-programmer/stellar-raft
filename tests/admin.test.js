/* 星图 Stellar Raft — 星港管理台 REST 测试

   与 server.test.js / auth.test.js 同样的隔离手法：把 server.js 复制进临时目录
   再起进程，数据库随 __dirname 落在临时目录，绝不碰仓库里的 stellar.db。

   覆盖：默认管理员入户 → 权限守卫（匿名 / 普通用户 / 会话）→ 总览统计 →
   用户列表的搜索/筛选/分页 → 用户详情 → 停用与解封（踢下线、登录被拒）→
   角色任免与「最后一位管理员」保护 → 重置密码 → 改资料 → 强制下线 →
   删号（确认字串 + 级联清理）→ 分享强制关闭 → 会话列表不泄露完整令牌 →
   公告 / 注册开关 / 维护模式 → 审计日志 → 数据库维护与备份 →
   环境变量覆盖默认管理员凭据。 */

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

/* 起一台隔离的星图服务器，返回 { baseUrl, child, tmpDir, logs } */
async function startServer(env) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-admin-test-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, PORT: String(port), SR_DB: path.join(tmpDir, 'stellar.db'), ...(env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const box = { logs: '' };
  child.stdout.on('data', (d) => (box.logs += d));
  child.stderr.on('data', (d) => (box.logs += d));
  for (let i = 0; ; i++) {
    try {
      // 就绪探测走静态根路径：/api/hello 会给探测令牌建一个游客账号，
      // 把「每 IP 一个游客」的名额提前吃掉
      const r = await fetch(baseUrl + '/', { redirect: 'manual' });
      if (r.status) break;
    } catch { /* not up yet */ }
    if (i > 200) throw new Error('server did not start:\n' + box.logs);
    await new Promise((r) => setTimeout(r, 50));
  }
  return { baseUrl, child, tmpDir, box };
}

let srv;
let baseUrl;

async function api(token, method, pathName, body) {
  const res = await fetch(baseUrl + pathName, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* 二进制或空体 */ }
  return { status: res.status, body: parsed, raw: text };
}

/* 建一个已注册的普通用户，返回 { session, id, username } */
async function makeUser(username, password) {
  const anon = 'anon-' + username + '-' + Math.random().toString(36).slice(2);
  await api(anon, 'POST', '/api/hello', { name: username });
  const r = await api(anon, 'POST', '/api/auth/register', { username, password });
  assert.equal(r.status, 200, '注册应成功：' + JSON.stringify(r.body));
  return { session: r.body.session, id: r.body.user.id, username, anon };
}

let admin;   // 默认管理员的会话

test.before(async () => {
  // 主套件要从同一个回环地址造很多旅客，先关掉「每 IP 一个游客」的限额；
  // 限额与功能门禁本身在文件末尾单独起服务器覆盖
  srv = await startServer({ SR_GUEST_PER_IP: '0' });
  baseUrl = srv.baseUrl;
});

test.after(() => {
  if (srv) {
    srv.child.kill('SIGKILL');
    fs.rmSync(srv.tmpDir, { recursive: true, force: true });
  }
});

/* ---------------------------- 入户与守卫 ---------------------------- */

test('默认管理员入户：admin / stellar-admin 可直接登录，凭据打在启动日志里', async () => {
  assert.match(srv.box.logs, /星港管理员已入户/);
  assert.match(srv.box.logs, /admin/);

  const r = await api('anon-boot', 'POST', '/api/auth/login', { id: 'admin', password: 'stellar-admin' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, 'admin');
  assert.equal(r.body.user.admin, true);
  admin = r.body.session;
});

test('hello 对管理员额外下发「仍在用出厂密码」提醒，普通用户拿不到这个字段', async () => {
  const mine = await api(admin, 'POST', '/api/hello', {});
  assert.equal(mine.body.account.admin, true);
  assert.equal(mine.body.site.defaultPass, true);

  const u = await makeUser('plainuser', 'passw0rd');
  const theirs = await api(u.session, 'POST', '/api/hello', {});
  assert.equal(theirs.body.account.admin, false);
  assert.equal(theirs.body.site.defaultPass, undefined);
});

test('守卫：匿名令牌与普通账号都进不了 /api/admin/*', async () => {
  const anon = await api('anon-nobody', 'GET', '/api/admin/overview');
  assert.equal(anon.status, 403);

  const u = await makeUser('guard', 'passw0rd');
  const plain = await api(u.session, 'GET', '/api/admin/users');
  assert.equal(plain.status, 403);

  // 无令牌一律 401（连身份都没有）
  const none = await api('', 'GET', '/api/admin/overview');
  assert.equal(none.status, 401);
});

/* ---------------------------- 总览 ---------------------------- */

test('总览：账号 / 知识 / 星际 / 运行 / 站点五组读数齐全且自洽', async () => {
  const r = await api(admin, 'GET', '/api/admin/overview');
  assert.equal(r.status, 200);
  const d = r.body;

  assert.equal(d.users.total, d.users.registered + d.users.anonymous);
  assert.ok(d.users.registered >= 3);          // admin + plainuser + guard
  assert.equal(d.users.admins, 1);
  assert.equal(d.users.banned, 0);

  // 演示好友「星图伙伴」的 6 颗星是新装库里唯一的星系
  assert.equal(d.knowledge.galaxies, 1);
  assert.equal(d.knowledge.stars, 6);
  assert.ok(d.knowledge.snapshotBytes > 0);

  assert.equal(d.social.sharesOpen, 1);        // 演示星系默认开着分享
  assert.ok(d.system.uptimeMs >= 0);
  assert.ok(d.system.db.size > 0);
  assert.equal(d.site.registrationOpen, true);
  assert.equal(d.defaultPass, true);
});

/* 管理台为了不在每次请求里把每个人的快照重新解析一遍，缓存了「解析结果的形状」
   （每颗星参与计算的那几个字段），按 (version, updated_at) 判新鲜。
   缓存最危险的地方只有一个：陈旧。这两条分别盯住它的两面——
   人一保存，数字就得跟上；而随时间变的量（亮度/点亮/熄灭）必须仍然当场算，
   不能被冻在上一次保存的那一刻。 */

test('缓存不陈旧：用户刚保存完，管理台的读数立刻跟上', async () => {
  const u = await makeUser('cachey', 'passw0rd');
  const starsOf = async () => {
    const r = await api(admin, 'GET', '/api/admin/users?q=cachey');
    return r.body.users[0];
  };

  await api(u.session, 'PUT', '/api/galaxy', {
    data: { constellations: [{ id: 'c1', name: '域一' }], stars: [{ id: 'a', con: 'c1', label: '一' }] },
  });
  const before = await starsOf();
  assert.equal(before.stars, 1);
  const bytesBefore = before.snapshotBytes;
  assert.ok(bytesBefore > 0, '快照体积要真的量出来');

  // 同一个人再存一次，多两颗星 —— 版本号变了，缓存必须作废
  await api(u.session, 'PUT', '/api/galaxy', {
    data: {
      constellations: [{ id: 'c1', name: '域一' }, { id: 'c2', name: '域二' }],
      stars: [{ id: 'a', con: 'c1', label: '一' }, { id: 'b', con: 'c2', label: '二' }, { id: 'c', con: 'c2', label: '三' }],
    },
  });
  const after = await starsOf();
  assert.equal(after.stars, 3, '新存进去的星要立刻算数');
  assert.equal(after.constellations, 2);
  assert.ok(after.snapshotBytes > bytesBefore, '体积也得跟着这一版走');

  // 详情页与总览走的是同一套读数，不该各说各话
  const detail = await api(admin, 'GET', '/api/admin/users/' + u.id);
  assert.equal(detail.body.galaxy.stars, 3);
  assert.equal(detail.body.galaxy.breakdown.find(c => c.id === 'c2').count, 2);
});

test('随时间变的量仍然当场算：点亮与熄灭不被冻在上一次保存', async () => {
  const u = await makeUser('emberish', 'passw0rd');
  const DAY_MS = 86400000;
  /* 两颗都「曾经点亮」的星，差别只在多久没复习：
     一颗昨天刚复习（R≈1，仍然亮着），一颗放了 60 天（R 远低于熄灭阈值 0.35）。
     这两个数字都不在快照里，只能由服务端按此刻的时间算出来。 */
  await api(u.session, 'PUT', '/api/galaxy', {
    data: {
      constellations: [{ id: 'c1', name: '域' }],
      stars: [
        { id: 'fresh', con: 'c1', label: '刚复习过', strength: 0.9, sr: { S: 10, last: Date.now() - DAY_MS, lit: Date.now() - 5 * DAY_MS } },
        { id: 'cold', con: 'c1', label: '放很久了', strength: 0.9, sr: { S: 10, last: Date.now() - 60 * DAY_MS, lit: Date.now() - 90 * DAY_MS } },
      ],
    },
  });
  const r = await api(admin, 'GET', '/api/admin/users/' + u.id);
  assert.equal(r.body.galaxy.stars, 2);
  assert.equal(r.body.galaxy.lit, 1, '只有那颗刚复习过的还算点亮');
  assert.equal(r.body.galaxy.ember, 1, '放了 60 天的那颗该判成待重燃');
  // 快照里写的 strength 都是 0.9，出库的均值必须是按真实时间重算过的，明显低于 0.9
  assert.ok(r.body.galaxy.avgStrength < 0.9, '均值应当是衰减后的，而不是快照里的静态值');
});

test('嵌套投毒：快照里数组的坏成员拖不垮管理台（总览 / 名单 / 详情都 200）', async () => {
  // 顶层数组合法（写入端放行），坏的是成员：null 星、字符串星、null 星域
  const u = await makeUser('nested', 'passw0rd');
  await api(u.session, 'PUT', '/api/galaxy', {
    data: {
      constellations: [null, { id: 'c1', name: '好域' }],
      connections: [null],
      stars: [null, 'oops', { id: 'ok', con: 'c1', label: '好星', strength: 0.8 }],
    },
  });
  const overview = await api(admin, 'GET', '/api/admin/overview');
  assert.equal(overview.status, 200, '总览不该被嵌套坏数据打成 500');
  const list = await api(admin, 'GET', '/api/admin/users?sort=stars&q=nested');
  assert.equal(list.status, 200);
  assert.equal(list.body.users[0].stars, 1, '只有那颗合法星算数');
  const detail = await api(admin, 'GET', '/api/admin/users/' + u.id);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.galaxy.constellations, 1);
});

/* ---------------------------- 用户列表与详情 ---------------------------- */

test('用户列表：搜索 / 筛选 / 分页各自生效，且每行带真实星系读数', async () => {
  const all = await api(admin, 'GET', '/api/admin/users?size=100');
  assert.equal(all.status, 200);
  assert.equal(all.body.total, all.body.users.length);

  const hit = await api(admin, 'GET', '/api/admin/users?q=plainuser');
  assert.equal(hit.body.total, 1);
  assert.equal(hit.body.users[0].username, 'plainuser');

  const miss = await api(admin, 'GET', '/api/admin/users?q=没有这个人');
  assert.equal(miss.body.total, 0);

  const admins = await api(admin, 'GET', '/api/admin/users?filter=admin');
  assert.equal(admins.body.total, 1);
  assert.equal(admins.body.users[0].username, 'admin');

  const anon = await api(admin, 'GET', '/api/admin/users?filter=anonymous');
  assert.ok(anon.body.users.every(u => !u.registered));

  const paged = await api(admin, 'GET', '/api/admin/users?size=5&page=1');
  assert.ok(paged.body.users.length <= 5);
  assert.equal(paged.body.pages, Math.max(1, Math.ceil(paged.body.total / 5)));

  // 演示星系那一行的星数来自真实快照，不是估算
  const byStars = await api(admin, 'GET', '/api/admin/users?sort=stars&size=100');
  assert.equal(byStars.body.users[0].stars, 6);
  assert.equal(byStars.body.users[0].constellations, 2);
});

test('用户详情：星域分布、分享、会话、来信一次给全', async () => {
  const list = await api(admin, 'GET', '/api/admin/users?sort=stars&size=100');
  const demoId = list.body.users[0].id;

  const r = await api(admin, 'GET', '/api/admin/users/' + demoId);
  assert.equal(r.status, 200);
  assert.equal(r.body.galaxy.stars, 6);
  assert.equal(r.body.galaxy.constellations, 2);
  assert.deepEqual(r.body.galaxy.breakdown.map(c => c.count).sort(), [3, 3]);
  assert.ok(r.body.galaxy.avgStrength > 0 && r.body.galaxy.avgStrength <= 1);
  assert.equal(r.body.share.enabled, true);
  assert.equal(r.body.share.code, 'XING-DEMO-2333');

  const missing = await api(admin, 'GET', '/api/admin/users/99999');
  assert.equal(missing.status, 404);
});

/* ---------------------------- 停用 / 解封 ---------------------------- */

test('停用：立刻踢下线、API 与登录都被拒且带上理由，解封后恢复', async () => {
  const u = await makeUser('banme', 'passw0rd');

  // 停用前一切正常
  assert.equal((await api(u.session, 'POST', '/api/hello', {})).status, 200);

  const ban = await api(admin, 'POST', `/api/admin/users/${u.id}/ban`, { banned: true, reason: '刷屏' });
  assert.equal(ban.status, 200);
  assert.equal(ban.body.user.banned, true);

  // 旧会话已被清掉 → 认不出这个 token，回落匿名建档而非报错；重新登录才是关键路径
  const login = await api('anon-banned', 'POST', '/api/auth/login', { id: 'banme', password: 'passw0rd' });
  assert.equal(login.status, 403);
  assert.equal(login.body.banned, true);
  assert.equal(login.body.error, '刷屏');

  const detail = await api(admin, 'GET', '/api/admin/users/' + u.id);
  assert.equal(detail.body.sessions.length, 0, '停用应清空全部会话');
  assert.equal(detail.body.user.banReason, '刷屏');

  const unban = await api(admin, 'POST', `/api/admin/users/${u.id}/ban`, { banned: false });
  assert.equal(unban.status, 200);
  assert.equal(unban.body.user.banned, false);

  const back = await api('anon-back', 'POST', '/api/auth/login', { id: 'banme', password: 'passw0rd' });
  assert.equal(back.status, 200);
});

test('停用中的账号：任何接口都是 403 + banned 标志，唯独退出登录放行', async () => {
  // 注册是「把匿名星空原地升级成账号」——那个原始匿名令牌仍指向同一行用户，
  // 停用清掉的只是 sessions。所以这条路径才是被封用户还能触达服务器的真实入口。
  const u = await makeUser('banned2', 'passw0rd');
  await api(admin, 'POST', `/api/admin/users/${u.id}/ban`, { banned: true, reason: '违规' });

  for (const [method, p, body] of [
    ['POST', '/api/hello', {}],
    ['GET', '/api/galaxy', undefined],
    ['PUT', '/api/galaxy', { data: { stars: [] } }],
    ['GET', '/api/inbox', undefined],
    ['GET', '/api/friends', undefined],
  ]) {
    const r = await api(u.anon, method, p, body);
    assert.equal(r.status, 403, `${method} ${p} 应被停用拦下`);
    assert.equal(r.body.banned, true);
    assert.equal(r.body.error, '违规');
  }

  // 退出登录永远放行：被停用也得让人干净地离开
  const out = await api(u.anon, 'POST', '/api/auth/logout', {});
  assert.equal(out.status, 200);

  // 停用期间星空数据一动不动
  const detail = await api(admin, 'GET', '/api/admin/users/' + u.id);
  assert.equal(detail.body.user.banned, true);
});

test('自我保护：管理员不能停用、删除自己，也不能撤销最后一位管理员', async () => {
  const me = await api(admin, 'POST', '/api/hello', {});
  const myId = me.body.user.id;

  const ban = await api(admin, 'POST', `/api/admin/users/${myId}/ban`, { banned: true });
  assert.equal(ban.status, 400);
  assert.match(ban.body.error, /自己/);

  const del = await api(admin, 'POST', `/api/admin/users/${myId}/delete`, { confirm: 'admin' });
  assert.equal(del.status, 400);

  const demote = await api(admin, 'POST', `/api/admin/users/${myId}/role`, { role: 'user' });
  assert.equal(demote.status, 400);
  assert.match(demote.body.error, /最后一位管理员/);
});

/* ---------------------------- 角色 ---------------------------- */

test('角色：任免往返，匿名账号不可任命，管理员不可被停用/删除', async () => {
  const u = await makeUser('deputy', 'passw0rd');

  const up = await api(admin, 'POST', `/api/admin/users/${u.id}/role`, { role: 'admin' });
  assert.equal(up.status, 200);
  assert.equal(up.body.user.role, 'admin');

  // 升成管理员后，他自己也能进管理台
  const theirView = await api(u.session, 'GET', '/api/admin/overview');
  assert.equal(theirView.status, 200);
  assert.equal(theirView.body.users.admins, 2);

  // 有两位管理员时不能被停用 / 删除（先撤职才行）
  const ban = await api(admin, 'POST', `/api/admin/users/${u.id}/ban`, { banned: true });
  assert.equal(ban.status, 400);
  const del = await api(admin, 'POST', `/api/admin/users/${u.id}/delete`, { confirm: 'deputy' });
  assert.equal(del.status, 400);

  const down = await api(admin, 'POST', `/api/admin/users/${u.id}/role`, { role: 'user' });
  assert.equal(down.status, 200);
  assert.equal(down.body.user.role, 'user');
  assert.equal((await api(u.session, 'GET', '/api/admin/overview')).status, 403);

  // 匿名用户没有账号，不能任命
  const anonList = await api(admin, 'GET', '/api/admin/users?filter=anonymous&size=1');
  const anonId = anonList.body.users[0].id;
  const bad = await api(admin, 'POST', `/api/admin/users/${anonId}/role`, { role: 'admin' });
  assert.equal(bad.status, 400);
});

/* ---------------------------- 密码 / 资料 / 下线 ---------------------------- */

test('重置密码：新密码可登录、旧密码作废，并默认踢掉全部旧会话', async () => {
  const u = await makeUser('resetme', 'oldpass1');
  assert.equal((await api(u.session, 'POST', '/api/hello', {})).status, 200);

  const r = await api(admin, 'POST', `/api/admin/users/${u.id}/password`, { password: 'newpass1' });
  assert.equal(r.status, 200);

  assert.equal((await api('anon-r1', 'POST', '/api/auth/login', { id: 'resetme', password: 'oldpass1' })).status, 401);
  assert.equal((await api('anon-r2', 'POST', '/api/auth/login', { id: 'resetme', password: 'newpass1' })).status, 200);

  const detail = await api(admin, 'GET', '/api/admin/users/' + u.id);
  assert.equal(detail.body.sessions.length, 1, '只剩刚才那次新登录');

  const tooShort = await api(admin, 'POST', `/api/admin/users/${u.id}/password`, { password: '123' });
  assert.equal(tooShort.status, 400);
});

test('给管理员重置密码走更高的下限（与交接卡同一条线），普通用户仍是 6 位', async () => {
  // 普通用户：6 位就行
  const u = await makeUser('sixok', 'passw0rd');
  assert.equal((await api(admin, 'POST', `/api/admin/users/${u.id}/password`, { password: '123456' })).status, 200);

  // 升任管理员后：7 位拒收、8 位才放行（core.js ADMIN_PASS_MIN）
  await api(admin, 'POST', `/api/admin/users/${u.id}/role`, { role: 'admin' });
  const seven = await api(admin, 'POST', `/api/admin/users/${u.id}/password`, { password: '1234567' });
  assert.equal(seven.status, 400, '管理员密码 7 位应当拒收');
  const eight = await api(admin, 'POST', `/api/admin/users/${u.id}/password`, { password: '12345678' });
  assert.equal(eight.status, 200);
  assert.equal((await api('anon-sixok', 'POST', '/api/auth/login', { id: 'sixok', password: '12345678' })).status, 200);
});

test('管理员自己改密：不再 500，出厂密码警告当场摘掉，新旧密码即刻交替', async () => {
  // 单开一台：改的是这台服务器上那位出厂管理员的密码，别牵连同文件里共用的那台
  const one = await startServer({ SR_GUEST_PER_IP: '0' });
  try {
    const call = (token, method, p, body) => fetch(one.baseUrl + p, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async r => ({ status: r.status, body: await r.json() }));

    const sess = (await call('a', 'POST', '/api/auth/login', { id: 'admin', password: 'stellar-admin' })).body.session;
    assert.equal((await call(sess, 'POST', '/api/hello', {})).body.site.defaultPass, true);

    // README 指的就是这条路：设置 → 账户 → 修改密码。它一度 500（ADMIN_USER 未导入），
    // 密码其实已经改掉，用户看到的却是一句报错——再拿旧密码重试只会「旧密码不对」
    const chg = await call(sess, 'POST', '/api/auth/password', { old: 'stellar-admin', new: 'a-brand-new-key' });
    assert.equal(chg.status, 200, '管理员改自己的密码不该报错');

    assert.equal((await call(sess, 'POST', '/api/hello', {})).body.site.defaultPass, false, '不再是出厂密码，顶部那条红警告该摘掉');
    assert.equal((await call('b', 'POST', '/api/auth/login', { id: 'admin', password: 'stellar-admin' })).status, 401);
    assert.equal((await call('c', 'POST', '/api/auth/login', { id: 'admin', password: 'a-brand-new-key' })).status, 200);
  } finally {
    one.child.kill('SIGKILL');
    fs.rmSync(one.tmpDir, { recursive: true, force: true });
  }
});

/* ---------------------------- 星港交接 ----------------------------
   出厂凭据（admin / stellar-admin）写在 README 与启动日志里，谁都看得见。
   所以第一次登录要求把用户名与密码一起换掉：只换密码，出厂用户名还留着，
   等于把门牌号也交出去。这一组盯的是服务端这一侧的口径与善后。 */

test('星港交接：出厂管理员把用户名与密码一起换掉，旧凭据与旧会话一起作废', async () => {
  const one = await startServer({ SR_GUEST_PER_IP: '0' });
  try {
    const call = (token, method, p, body) => fetch(one.baseUrl + p, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async r => ({ status: r.status, body: await r.json() }));

    const sess = (await call('h0', 'POST', '/api/auth/login', { id: 'admin', password: 'stellar-admin' })).body.session;
    const older = (await call('h1', 'POST', '/api/auth/login', { id: 'admin', password: 'stellar-admin' })).body.session;
    assert.equal((await call(sess, 'POST', '/api/hello', {})).body.site.defaultPass, true);

    // ——— 守卫：匿名与普通账号都不该碰得到这个接口 ———
    assert.equal((await call('anon-h', 'POST', '/api/auth/handover', { username: 'x', password: 'whatever12' })).status, 401);
    await call('anon-p', 'POST', '/api/hello', { name: '路人' });
    const plain = await call('anon-p', 'POST', '/api/auth/register', { username: '路人甲', password: 'passw0rd' });
    assert.equal((await call(plain.body.session, 'POST', '/api/auth/handover', { username: 'newname', password: 'passw0rd12' })).status, 403);

    // ——— 校验：出厂的那两样都不许留，密码另有一档更严的下限 ———
    const bad = async (body) => (await call(sess, 'POST', '/api/auth/handover', body)).status;
    assert.equal(await bad({ username: 'admin', password: 'a-strong-key' }), 400, '出厂用户名不能留');
    assert.equal(await bad({ username: 'ADMIN', password: 'a-strong-key' }), 400, '大小写换一下也还是那个名字');
    assert.equal(await bad({ username: 'captain', password: 'stellar-admin' }), 400, '出厂密码不能留');
    assert.equal(await bad({ username: 'captain', password: 'short1' }), 400, '管理员密码至少 8 位');
    assert.equal(await bad({ username: 'captain', password: 'captain' }), 400, '密码不能和用户名一样');
    assert.equal(await bad({ username: 'a', password: 'a-strong-key' }), 400, '用户名太短');
    assert.equal(await bad({ username: '带 空格', password: 'a-strong-key' }), 400, '用户名字符集');
    assert.equal(await bad({ username: '路人甲', password: 'a-strong-key' }), 409, '撞上别人的用户名');
    // 都没改成：出厂凭据仍然当值
    assert.equal((await call(sess, 'POST', '/api/hello', {})).body.site.defaultPass, true);

    // ——— 交接 ———
    const done = await call(sess, 'POST', '/api/auth/handover', { username: 'captain', password: 'a-strong-key' });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.user.username, 'captain');
    assert.ok(done.body.session, '要发一把新钥匙回来');

    // 旧凭据两样都作废，新凭据能登
    assert.equal((await call('h2', 'POST', '/api/auth/login', { id: 'admin', password: 'stellar-admin' })).status, 401);
    assert.equal((await call('h3', 'POST', '/api/auth/login', { id: 'admin', password: 'a-strong-key' })).status, 401);
    assert.equal((await call('h4', 'POST', '/api/auth/login', { id: 'captain', password: 'stellar-admin' })).status, 401);
    assert.equal((await call('h5', 'POST', '/api/auth/login', { id: 'captain', password: 'a-strong-key' })).status, 200);

    // 出厂凭据配出去的会话一把都不留：交接时用的那把也在内
    assert.equal((await call(older, 'GET', '/api/admin/overview')).status, 401, '别处那把出厂钥匙该被请下去');
    assert.equal((await call(sess, 'GET', '/api/admin/overview')).status, 401, '交接时用的那把也一并吊销');

    // 新钥匙照常通行，红条摘掉，交接不可重放
    const fresh = done.body.session;
    assert.equal((await call(fresh, 'GET', '/api/admin/overview')).status, 200);
    assert.equal((await call(fresh, 'POST', '/api/hello', {})).body.site.defaultPass, false);
    assert.equal((await call(fresh, 'POST', '/api/auth/handover', { username: 'captain2', password: 'another-strong-key' })).status, 409);
    assert.equal((await call(fresh, 'POST', '/api/hello', {})).body.account.username, 'captain', '409 之后名字没被改动');

    // 审计留痕
    const log = await call(fresh, 'GET', '/api/admin/audit?size=50');
    assert.ok(log.body.entries.some(e => e.action === 'admin.handover'), '交接要在操作日志里留痕');
  } finally {
    one.child.kill('SIGKILL');
    fs.rmSync(one.tmpDir, { recursive: true, force: true });
  }
});

test('星港交接：凭据由环境变量指定时不拦 —— 那是运维自己挑的，不是出厂值', async () => {
  const other = await startServer({ SR_ADMIN_USER: 'captain', SR_ADMIN_PASS: 'a-very-private-key' });
  try {
    const call = (token, p, body) => fetch(other.baseUrl + p, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    }).then(async r => ({ status: r.status, body: await r.json() }));

    const sess = (await call('e1', '/api/auth/login', { id: 'captain', password: 'a-very-private-key' })).body.session;
    assert.equal((await call(sess, '/api/hello', {})).body.site.defaultPass, false, '不该被请去交接');
    assert.equal((await call(sess, '/api/auth/handover', { username: 'other', password: 'yet-another-key' })).status, 409);
  } finally {
    other.child.kill('SIGKILL');
    fs.rmSync(other.tmpDir, { recursive: true, force: true });
  }
});

test('改资料：昵称与用户名可改，撞名被挡下', async () => {
  const u = await makeUser('renameme', 'passw0rd');

  const ok = await api(admin, 'POST', `/api/admin/users/${u.id}/profile`, { name: '新名字', username: 'renamed' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.name, '新名字');
  assert.equal(ok.body.user.username, 'renamed');
  assert.equal((await api('anon-n', 'POST', '/api/auth/login', { id: 'renamed', password: 'passw0rd' })).status, 200);

  const clash = await api(admin, 'POST', `/api/admin/users/${u.id}/profile`, { name: '新名字', username: 'admin' });
  assert.equal(clash.status, 409);

  const illegal = await api(admin, 'POST', `/api/admin/users/${u.id}/profile`, { name: 'x', username: 'a' });
  assert.equal(illegal.status, 400);
});

test('强制下线：断开全部会话，星空数据不受影响', async () => {
  const u = await makeUser('kickme', 'passw0rd');
  await api(u.session, 'PUT', '/api/galaxy', { data: { stars: [{ id: 's1', label: '一颗星' }], constellations: [] } });

  const r = await api(admin, 'POST', `/api/admin/users/${u.id}/revoke`, {});
  assert.equal(r.status, 200);
  assert.equal(r.body.revoked, 1);

  const detail = await api(admin, 'GET', '/api/admin/users/' + u.id);
  assert.equal(detail.body.sessions.length, 0);
  assert.equal(detail.body.galaxy.stars, 1, '星空还在');
});

/* ---------------------------- 删号 ---------------------------- */

test('删号：确认字串对不上就不动手；删掉后星系、分享、关系、来信一并消失', async () => {
  const owner = await makeUser('doomed', 'passw0rd');
  const friend = await makeUser('watcher', 'passw0rd');

  // 给他一片星空 + 开分享 + 让另一个人成为访客 + 寄一封信
  await api(owner.session, 'PUT', '/api/galaxy', {
    data: { stars: [{ id: 'a', label: '星', con: 'c' }], constellations: [{ id: 'c', name: '域' }] },
  });
  const share = await api(owner.session, 'POST', '/api/share', { enabled: true, visibility: 'outline' });
  await api(friend.session, 'POST', '/api/friends/redeem', { code: share.body.code });
  await api(owner.session, 'POST', '/api/inbox/send', { toUserId: friend.id, kind: 'note', text: '来玩' });

  const before = await api(admin, 'GET', '/api/admin/users/' + owner.id);
  assert.equal(before.body.galaxy.stars, 1);
  assert.equal(before.body.visitors.length, 1);

  const wrong = await api(admin, 'POST', `/api/admin/users/${owner.id}/delete`, { confirm: '随便写的' });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error, /doomed/);
  assert.equal((await api(admin, 'GET', '/api/admin/users/' + owner.id)).status, 200, '确认失败不能删掉任何东西');

  const gone = await api(admin, 'POST', `/api/admin/users/${owner.id}/delete`, { confirm: 'doomed' });
  assert.equal(gone.status, 200);

  assert.equal((await api(admin, 'GET', '/api/admin/users/' + owner.id)).status, 404);
  assert.equal((await api('anon-d', 'POST', '/api/auth/login', { id: 'doomed', password: 'passw0rd' })).status, 401);

  // 好友那边的访问关系与来信也一并清干净
  const friends = await api(friend.session, 'GET', '/api/friends');
  assert.equal(friends.body.friends.filter(f => f.id === owner.id).length, 0);
  const mail = await api(friend.session, 'GET', '/api/inbox');
  assert.equal(mail.body.filter(m => m.from.id === owner.id).length, 0);
});

/* ---------------------------- 分享 / 会话 ---------------------------- */

test('分享总览：能看到全站密文，并可强制关闭（密文保留，主人可再开）', async () => {
  const u = await makeUser('sharer', 'passw0rd');
  const s = await api(u.session, 'POST', '/api/share', { enabled: true, visibility: 'stars' });
  const code = s.body.code;

  const list = await api(admin, 'GET', '/api/admin/shares');
  const row = list.body.shares.find(x => x.userId === u.id);
  assert.ok(row);
  assert.equal(row.enabled, true);
  assert.equal(row.visibility, 'stars');
  assert.equal(row.code, code);

  const close = await api(admin, 'POST', '/api/admin/shares/close', { userId: u.id });
  assert.equal(close.status, 200);

  const after = await api(u.session, 'GET', '/api/share');
  assert.equal(after.body.enabled, false);
  assert.equal(after.body.code, code, '密文保留');

  // 主人自己还能重新开启
  const reopen = await api(u.session, 'POST', '/api/share', { enabled: true });
  assert.equal(reopen.body.enabled, true);
});

test('会话列表：只出指纹，完整令牌永不出库', async () => {
  const r = await api(admin, 'GET', '/api/admin/sessions');
  assert.equal(r.status, 200);
  assert.ok(r.body.sessions.length > 0);
  const mine = r.body.sessions.find(s => s.current);
  assert.ok(mine, '当前会话应被标出');
  assert.equal(mine.role, 'admin');
  for (const s of r.body.sessions) {
    assert.equal(s.token, undefined);
    assert.ok(s.fingerprint && s.fingerprint.length <= 12);
    assert.ok(!admin.includes(s.fingerprint) || admin.slice(2, 10) === s.fingerprint);
  }
  // 整个响应里不该出现任何一个完整会话令牌
  assert.equal(JSON.stringify(r.body).includes(admin), false);
});

/* ---------------------------- 站点设置 ---------------------------- */

test('公告：发布后随 hello 下发给所有人，撤下即消失', async () => {
  const u = await makeUser('reader', 'passw0rd');

  const post = await api(admin, 'POST', '/api/admin/site', {
    announcement: { text: '本周日 02:00 维护', tone: 'warn', enabled: true },
  });
  assert.equal(post.status, 200);
  assert.equal(post.body.announcement.enabled, true);

  const seen = await api(u.session, 'POST', '/api/hello', {});
  assert.equal(seen.body.site.announcement.text, '本周日 02:00 维护');
  assert.equal(seen.body.site.announcement.tone, 'warn');

  await api(admin, 'POST', '/api/admin/site', { announcement: { text: '本周日 02:00 维护', tone: 'warn', enabled: false } });
  const gone = await api(u.session, 'POST', '/api/hello', {});
  assert.equal(gone.body.site.announcement, null);

  // 空文案不会被当成「发布中」
  await api(admin, 'POST', '/api/admin/site', { announcement: { text: '   ', enabled: true } });
  const empty = await api(u.session, 'POST', '/api/hello', {});
  assert.equal(empty.body.site.announcement, null);
});

test('注册开关：关闭后新账号注册被拒，已有账号照常登录', async () => {
  await api(admin, 'POST', '/api/admin/site', { registrationOpen: false });

  const anon = 'anon-noreg-' + Math.random().toString(36).slice(2);
  await api(anon, 'POST', '/api/hello', {});
  const reg = await api(anon, 'POST', '/api/auth/register', { username: 'latecomer', password: 'passw0rd' });
  assert.equal(reg.status, 403);

  assert.equal((await api('anon-l', 'POST', '/api/auth/login', { id: 'plainuser', password: 'passw0rd' })).status, 200);

  await api(admin, 'POST', '/api/admin/site', { registrationOpen: true });
  const ok = await api(anon, 'POST', '/api/auth/register', { username: 'latecomer', password: 'passw0rd' });
  assert.equal(ok.status, 200);
});

test('维护模式：普通用户 503 且带 maintenance 标志，管理员照常通行', async () => {
  await api(admin, 'POST', '/api/admin/site', { maintenance: { enabled: true, message: '升级中，稍后回来' } });

  const u = await api('anon-maint', 'POST', '/api/hello', {});
  assert.equal(u.status, 503);
  assert.equal(u.body.maintenance, true);
  assert.equal(u.body.error, '升级中，稍后回来');

  assert.equal((await api(admin, 'GET', '/api/admin/overview')).status, 200);
  assert.equal((await api(admin, 'POST', '/api/hello', {})).status, 200);

  await api(admin, 'POST', '/api/admin/site', { maintenance: { enabled: false } });
  assert.equal((await api('anon-maint', 'POST', '/api/hello', {})).status, 200);
});

/* ---------------------------- 日志 / 维护 / 备份 ---------------------------- */

test('审计日志：每次管理动作都留痕，倒序、带执行人与对象', async () => {
  const r = await api(admin, 'GET', '/api/admin/audit?limit=200');
  assert.equal(r.status, 200);
  const actions = r.body.entries.map(e => e.action);

  for (const a of ['user.ban', 'user.unban', 'user.promote', 'user.demote', 'user.password',
    'user.profile', 'user.revoke', 'user.delete', 'share.close', 'site.update']) {
    assert.ok(actions.includes(a), '应记录 ' + a);
  }
  assert.ok(r.body.entries.every(e => e.actor === 'admin'));

  const del = r.body.entries.find(e => e.action === 'user.delete');
  assert.equal(del.target, 'doomed');

  // 倒序：id 单调递减
  const ids = r.body.entries.map(e => e.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => b - a));
});

test('数据库维护：checkpoint / vacuum / 清理过期会话都能跑通', async () => {
  for (const action of ['checkpoint', 'vacuum', 'prune-sessions']) {
    const r = await api(admin, 'POST', '/api/admin/maintenance', { action });
    assert.equal(r.status, 200, action + ' 应成功：' + JSON.stringify(r.body));
  }
  const bad = await api(admin, 'POST', '/api/admin/maintenance', { action: '删库跑路' });
  assert.equal(bad.status, 400);
});

test('备份下载：返回一个真正的 SQLite 文件', async () => {
  const res = await fetch(baseUrl + '/api/admin/backup', { headers: { Authorization: 'Bearer ' + admin } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition') || '', /stellar-raft-.*\.db/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 15).toString('utf8'), 'SQLite format 3');
  assert.ok(buf.length > 1000);

  // 普通用户拿不到备份
  const u = await makeUser('nobackup', 'passw0rd');
  const denied = await fetch(baseUrl + '/api/admin/backup', { headers: { Authorization: 'Bearer ' + u.session } });
  assert.equal(denied.status, 403);
});

/* ---------------------------- 游客治理 ---------------------------- */

test('游客总览：按来源 IP 聚合，每个数字都数得出来', async () => {
  const r = await api(admin, 'GET', '/api/admin/guests');
  assert.equal(r.status, 200);
  assert.equal(r.body.limit, 0, '这台测试服务器关掉了限额');
  assert.ok(r.body.rows.length >= 1);

  const loop = r.body.rows.find(x => x.ip === '127.0.0.1');
  assert.ok(loop, '本机造出来的游客应归到 127.0.0.1');
  assert.equal(loop.count, loop.guests.length);
  assert.equal(loop.stars, loop.guests.reduce((a, g) => a + g.stars, 0));
  assert.equal(r.body.guests, r.body.rows.reduce((a, x) => a + x.count, 0));

  // 总览里的游客摘要与这一页对得上
  const ov = await api(admin, 'GET', '/api/admin/overview');
  assert.equal(ov.body.guests.total, r.body.guests);
  assert.equal(ov.body.guests.ips, r.body.ips);
});

test('清理空游客：只删「从没存过星系且很久没来」的，存过东西的一根汗毛都不动', async () => {
  // 一个空手游客 + 一个存过星空的游客
  const empty = 'guest-empty-' + Math.random().toString(36).slice(2);
  const kept = 'guest-kept-' + Math.random().toString(36).slice(2);
  await api(empty, 'POST', '/api/hello', {});
  await api(kept, 'POST', '/api/hello', {});
  await api(kept, 'PUT', '/api/galaxy', { data: { stars: [{ id: 'k', label: '留下' }], constellations: [] } });

  // idleDays=0 会被钳到 1 天，刚建的账号一律不在清理范围内
  const noop = await api(admin, 'POST', '/api/admin/guests/purge', { idleDays: 1 });
  assert.equal(noop.status, 200);
  assert.equal(noop.body.removed, 0, '今天刚来的游客不该被清掉');

  assert.equal((await api(empty, 'POST', '/api/hello', {})).status, 200);
  assert.equal((await api(kept, 'GET', '/api/galaxy')).body.data.stars.length, 1);
});

/* 上面那条只证明了「今天刚来的不清」——因为一切都是新建的，removed 恒为 0，
   清理循环里的三道闸门一道也没走到。于是把 `if (galaxyStats(u.id)) continue;`
   整行删掉，测试照样全绿，而那一行守的是「存过东西的游客不该被抹掉」，
   下游是 dropUser：不可逆。
   要让闸门真正受考，就得有账号落在截止线之外——API 没法把时间往回拨，
   所以直接改库里的 last_seen / created_at。服务器是 WAL，第二个连接写得进去。 */
test('清理僵尸游客：只动「空且久未露面」的匿名号，另外两类一个不碰', async () => {
  const { DatabaseSync } = await import('node:sqlite');

  const oldEmpty = 'guest-old-empty-' + Math.random().toString(36).slice(2);
  const oldFull = 'guest-old-full-' + Math.random().toString(36).slice(2);
  const freshEmpty = 'guest-new-empty-' + Math.random().toString(36).slice(2);
  for (const t of [oldEmpty, oldFull, freshEmpty]) await api(t, 'POST', '/api/hello', {});
  await api(oldFull, 'PUT', '/api/galaxy', { data: { stars: [{ id: 'x', label: '写过东西' }], constellations: [] } });
  // 久未露面但已注册的账号：它有 username，第一道闸门就该把它挡在外面
  const oldMember = await makeUser('purge-survivor', 'passw0rd');

  const db = new DatabaseSync(path.join(srv.tmpDir, 'stellar.db'));
  const backdate = db.prepare("UPDATE users SET last_seen = datetime('now','-30 days'), created_at = datetime('now','-30 days') WHERE token = ? OR id = ?");
  const idOf = db.prepare('SELECT id FROM users WHERE token = ?');
  for (const t of [oldEmpty, oldFull]) backdate.run(t, -1);
  backdate.run('__none__', oldMember.id);
  const ids = { oldEmpty: idOf.get(oldEmpty).id, oldFull: idOf.get(oldFull).id, fresh: idOf.get(freshEmpty).id };
  db.close();

  const r = await api(admin, 'POST', '/api/admin/guests/purge', { idleDays: 7 });
  assert.equal(r.status, 200);
  assert.equal(r.body.removed, 1, '只该清掉那个「空且久未露面」的游客：' + JSON.stringify(r.body));

  // ① 写过东西的游客：星还在（这条钉的就是 galaxyStats 那道闸门）
  const kept = await api(oldFull, 'GET', '/api/galaxy');
  assert.equal(kept.status, 200);
  assert.equal(kept.body.data.stars.length, 1, '存过星系的游客被清掉了');

  // ② 已注册的账号：哪怕三十天没来也不能动
  assert.equal((await api(oldMember.session, 'POST', '/api/hello', {})).status, 200, '注册用户被当成僵尸游客清掉了');

  // ③ 今天刚来的空游客：不在范围内
  assert.equal((await api(freshEmpty, 'POST', '/api/hello', {})).status, 200);

  // 被清掉的那一位：行本身没了（拿同一个令牌再来会是一位全新的旅客，不是旧的那个 id）
  const db2 = new DatabaseSync(path.join(srv.tmpDir, 'stellar.db'));
  assert.equal(db2.prepare('SELECT COUNT(*) n FROM users WHERE id = ?').get(ids.oldEmpty).n, 0, '空游客应当被删除');
  for (const k of ['oldFull', 'fresh']) {
    assert.equal(db2.prepare('SELECT COUNT(*) n FROM users WHERE id = ?').get(ids[k]).n, 1, k + ' 不该被删');
  }
  db2.close();
});

test('每 IP 一个游客：第二位游客被挡下并被请去登录，注册后名额立刻释放', async () => {
  const one = await startServer({ SR_GUEST_PER_IP: '1' });
  try {
    const url = one.baseUrl;
    const call = (token, method, p, body) => fetch(url + p, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async r => ({ status: r.status, body: await r.json() }));

    // 第一位游客：畅通
    assert.equal((await call('g1', 'POST', '/api/hello', {})).status, 200);

    // 第二位：同一个回环地址，被限额挡下
    const second = await call('g2', 'POST', '/api/hello', {});
    assert.equal(second.status, 403);
    assert.equal(second.body.guestLimit, true);
    assert.match(second.body.error, /登录或注册/);

    // 已建档的游客不受影响，还能继续用
    assert.equal((await call('g1', 'GET', '/api/galaxy')).status, 200);

    // 第一位注册之后 username 不再为空，名额释放，新游客又能进来
    const reg = await call('g1', 'POST', '/api/auth/register', { username: 'firstguest', password: 'passw0rd' });
    assert.equal(reg.status, 200);
    assert.equal((await call('g3', 'POST', '/api/hello', {})).status, 200);

    // 管理台看得到这个限额，也能把它调走
    const ov = await call(reg.body.session, 'GET', '/api/admin/overview');
    assert.equal(ov.status, 403, '刚注册的普通用户不是管理员');

    const adminSess = (await call('a', 'POST', '/api/auth/login', { id: 'admin', password: 'stellar-admin' })).body.session;
    const g = await call(adminSess, 'GET', '/api/admin/guests');
    assert.equal(g.body.limit, 1);
    assert.equal(g.body.trustProxy, false);

    await call(adminSess, 'POST', '/api/admin/site', { guestPerIp: 0 });
    assert.equal((await call('g4', 'POST', '/api/hello', {})).status, 200, '限额改成 0 之后不再拦人');
  } finally {
    one.child.kill('SIGKILL');
    fs.rmSync(one.tmpDir, { recursive: true, force: true });
  }
});

/* ---------------------------- 功能门禁 ---------------------------- */

test('游客门禁：分享与造访被服务端硬拦，注册后立刻放行', async () => {
  const gated = await startServer({ SR_GUEST_PER_IP: '0' });
  try {
    const url = gated.baseUrl;
    const call = (token, method, p, body) => fetch(url + p, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async r => ({ status: r.status, body: await r.json() }));

    await call('visitor', 'POST', '/api/hello', {});

    // 游客：分享 / 好友 / 造访 / 来信 全部 403 + needAccount
    for (const [method, p, body, feature] of [
      ['GET', '/api/share', undefined, 'share'],
      ['POST', '/api/share', { enabled: true }, 'share'],
      ['GET', '/api/friends', undefined, 'visit'],
      ['POST', '/api/friends/redeem', { code: 'XING-DEMO-2333' }, 'visit'],
      ['GET', '/api/visit/1', undefined, 'visit'],
      ['GET', '/api/inbox', undefined, 'visit'],
      ['POST', '/api/inbox/send', { toUserId: 1, kind: 'note', text: 'hi' }, 'visit'],
      ['POST', '/api/inbox/collect', { code: 'XING-DEMO-2333', starId: 'd1' }, 'visit'],
    ]) {
      const r = await call('visitor', method, p, body);
      assert.equal(r.status, 403, `${method} ${p} 应对游客关门`);
      assert.equal(r.body.needAccount, true);
      assert.equal(r.body.feature, feature);
    }

    // 星空本体照常读写——门禁挡的是社交，不是记笔记
    assert.equal((await call('visitor', 'PUT', '/api/galaxy', { data: { stars: [], constellations: [] } })).status, 200);

    // hello 把门禁表交给前端，游客那份是关着的
    const hello = await call('visitor', 'POST', '/api/hello', {});
    assert.deepEqual(hello.body.site.gates, { editor: true, share: true, visit: true, vault: true });

    // 注册之后同一个令牌立刻畅通，门禁表也全开
    const reg = await call('visitor', 'POST', '/api/auth/register', { username: 'nowreal', password: 'passw0rd' });
    assert.equal(reg.status, 200);
    assert.equal((await call('visitor', 'GET', '/api/share')).status, 200);
    assert.equal((await call(reg.body.session, 'GET', '/api/friends')).status, 200);
    const hello2 = await call(reg.body.session, 'POST', '/api/hello', {});
    assert.deepEqual(hello2.body.site.gates, { editor: false, share: false, visit: false, vault: false });

    // 管理员可以逐项关掉门禁：把 share 放开，游客又能开分享了
    const adminSess = (await call('a', 'POST', '/api/auth/login', { id: 'admin', password: 'stellar-admin' })).body.session;
    await call(adminSess, 'POST', '/api/admin/site', { guestGates: { share: false } });
    await call('guest2', 'POST', '/api/hello', {});
    assert.equal((await call('guest2', 'GET', '/api/share')).status, 200);
    // 只改了 share，visit 仍然关着
    assert.equal((await call('guest2', 'GET', '/api/friends')).status, 403);
  } finally {
    gated.child.kill('SIGKILL');
    fs.rmSync(gated.tmpDir, { recursive: true, force: true });
  }
});

/* ---------------------------- 趋势 ---------------------------- */

test('趋势：按天分桶，每个数字都来自真实时间戳，今天的注册数对得上', async () => {
  const r = await api(admin, 'GET', '/api/admin/trends?days=14');
  assert.equal(r.status, 200);
  assert.equal(r.body.buckets.length, 14);

  const today = new Date().toISOString().slice(0, 10);
  const last = r.body.buckets[r.body.buckets.length - 1];
  assert.equal(last.day, today, '最后一个桶应该是今天（UTC）');

  // 今天这个桶的注册数应等于全站 registered_at 落在今天的账号数
  const users = await api(admin, 'GET', '/api/admin/users?size=100');
  const regToday = users.body.users.filter(u => (u.registeredAt || '').slice(0, 10) === today).length;
  assert.equal(last.registered, regToday);

  // 桶按日期升序且不重复
  const days = r.body.buckets.map(b => b.day);
  assert.deepEqual(days, [...days].sort());
  assert.equal(new Set(days).size, days.length);
});

test('用户列表与详情带上真实 IP 与最近登录时间', async () => {
  const u = await makeUser('ipuser', 'passw0rd');
  const list = await api(admin, 'GET', '/api/admin/users?q=ipuser');
  const row = list.body.users[0];
  assert.equal(row.ip, '127.0.0.1');
  assert.equal(row.lastIp, '127.0.0.1');

  // 注册不算登录；登录一次之后 lastLogin 才有值
  assert.equal(row.lastLogin, null);
  await api('anon-ip', 'POST', '/api/auth/login', { id: 'ipuser', password: 'passw0rd' });
  const after = await api(admin, 'GET', '/api/admin/users/' + u.id);
  assert.ok(after.body.user.lastLogin, '登录后应记下时刻');
  assert.equal(after.body.user.lastIp, '127.0.0.1');

  // 按 IP 搜得到人
  const byIp = await api(admin, 'GET', '/api/admin/users?q=127.0.0.1');
  assert.ok(byIp.body.total > 0);
});

/* ---------------------------- 环境变量覆盖 ---------------------------- */

test('SR_ADMIN_USER / SR_ADMIN_PASS 覆盖默认凭据，且不再打「默认密码」标记', async () => {
  const other = await startServer({ SR_ADMIN_USER: 'captain', SR_ADMIN_PASS: 'a-very-private-key' });
  try {
    const url = other.baseUrl;
    const post = (token, p, body) => fetch(url + p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    }).then(async r => ({ status: r.status, body: await r.json() }));

    // 出厂凭据在这台服务器上不存在
    assert.equal((await post('a1', '/api/auth/login', { id: 'admin', password: 'stellar-admin' })).status, 401);

    const login = await post('a2', '/api/auth/login', { id: 'captain', password: 'a-very-private-key' });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'admin');

    const hello = await post(login.body.session, '/api/hello', {});
    assert.equal(hello.body.site.defaultPass, false, '自定义密码不该被标成出厂密码');
    assert.equal(other.box.logs.includes('默认密码'), false);
  } finally {
    other.child.kill('SIGKILL');
    fs.rmSync(other.tmpDir, { recursive: true, force: true });
  }
});

/* ——— 分页 ———
   名单会随着站点长大而无限变长：旅客 / 分享 / 会话 / 日志一律分页出库。
   四个接口共用一套口径（total / page / size / pages），前端才能共用一副翻页条。 */
test('名单分页：四个接口口径一致，页号越界夹回最后一页', async () => {
  // 造够跨页的数据：25 个账号 → 25 个会话（注册即建会话）
  for (let i = 0; i < 25; i++) await makeUser('pager' + i, 'pw123456');

  for (const [path, key] of [['/api/admin/users', 'users'], ['/api/admin/sessions', 'sessions'], ['/api/admin/audit', 'entries']]) {
    const p1 = await api(admin, 'GET', `${path}?page=1&size=10`);
    assert.equal(p1.status, 200, path);
    for (const f of ['total', 'page', 'size', 'pages']) {
      assert.ok(p1.body[f] != null, `${path} 缺少分页字段 ${f}`);
    }
    assert.equal(p1.body.size, 10);
    assert.ok(p1.body[key].length <= 10, `${path} 一页不该超过 size 条`);
    assert.equal(p1.body.pages, Math.max(1, Math.ceil(p1.body.total / 10)));

    if (p1.body.pages > 1) {
      const p2 = await api(admin, 'GET', `${path}?page=2&size=10`);
      assert.notDeepEqual(p2.body[key], p1.body[key], `${path} 第二页应是不同的内容`);
      // 页号越界：夹回最后一页，而不是给一片空白
      const over = await api(admin, 'GET', `${path}?page=9999&size=10`);
      assert.equal(over.body.page, over.body.pages, `${path} 越界页号应夹回最后一页`);
      assert.ok(over.body[key].length > 0, `${path} 最后一页不该是空的`);
    }
  }
});

/* ——— 操作日志：可以清空，但清空本身也留痕 ——— */
test('清空日志：全部删除后立刻补记一条，审计不会被无声抹掉', async () => {
  await api(admin, 'POST', '/api/admin/site', { registrationOpen: true });   // 先制造几条留痕
  const before = await api(admin, 'GET', '/api/admin/audit?page=1&size=5');
  assert.ok(before.body.total > 0, '应当已有日志');

  const cleared = await api(admin, 'POST', '/api/admin/audit/clear', {});
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.removed, before.body.total, '应报告清掉了多少条');

  const after = await api(admin, 'GET', '/api/admin/audit?page=1&size=5');
  assert.equal(after.body.total, 1, '清空后应只剩「清空」这一条本身');
  assert.equal(after.body.entries[0].action, 'audit.clear');
  assert.match(after.body.entries[0].detail, /清空 \d+ 条/);
});

/* ——— 收拢 WAL ———
   每个请求都会写 last_seen / 会话时刻，WAL 因此永远不会真的空——「收拢」总能收到东西，
   这是 SQLite 的常态，不是故障。要紧的是：它只搬字节、不动任何一条用户数据，
   所以反复点不该把审计日志刷满，掩住真正要紧的停用与删号。 */
test('收拢 WAL：报出真实收拢量，且反复点也不往审计里塞东西', async () => {
  await api(admin, 'POST', '/api/admin/audit/clear', {});   // 从干净的日志起算
  const base = (await api(admin, 'GET', '/api/admin/audit?page=1&size=50')).body.total;

  for (let i = 0; i < 3; i++) {
    const r = await api(admin, 'POST', '/api/admin/maintenance', { action: 'checkpoint' });
    assert.equal(r.status, 200);
    assert.ok(typeof r.body.freed === 'number', '应报告收拢了多少字节');
    assert.ok(r.body.system && r.body.system.db, '应带回最新的库体积读数');
  }
  await api(admin, 'POST', '/api/admin/maintenance', { action: 'vacuum' });

  const after = (await api(admin, 'GET', '/api/admin/audit?page=1&size=50')).body.total;
  assert.equal(after, base, '收拢 / VACUUM 只搬字节，不该在日志里留下任何一条');

  // 反过来：删会话是真销毁数据，那一条必须留痕
  await api(admin, 'POST', '/api/admin/maintenance', { action: 'prune-sessions' });
  const log = await api(admin, 'GET', '/api/admin/audit?page=1&size=50');
  assert.ok(log.body.entries.some(e => e.action === 'db.prune-sessions'), '清理会话应当留痕');
});
