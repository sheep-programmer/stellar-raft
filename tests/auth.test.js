/* 星图 Stellar Raft — 账号体系 REST 测试
   注册继承匿名星空 · 用户名/邮箱皆可登录 · sessions 多设备 · 改密 · 登出 */
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-auth-test-'));
  fs.mkdirSync(path.join(tmpDir, 'server'));
  fs.copyFileSync(path.join(ROOT, 'server', 'server.js'), path.join(tmpDir, 'server', 'server.js'));

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--no-warnings', path.join(tmpDir, 'server', 'server.js')], {
    // 这几套用例都要从同一个回环地址建多个匿名旅客，关掉「每 IP 一个游客」的限额
    // （限额本身在 tests/admin.test.js 里单独覆盖）
    env: { ...process.env, PORT: String(port), SR_GUEST_PER_IP: '0' },
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

/* ------------------------------- 流程 ------------------------------- */

const anon = 'anon-token-' + Math.random().toString(36).slice(2);

test('匿名建档并存一片星空', async () => {
  const hello = await api(anon, 'POST', '/api/hello', { name: '旅人' });
  assert.equal(hello.status, 200);
  assert.equal(hello.body.account.registered, false);
  const put = await api(anon, 'PUT', '/api/galaxy', { data: { stars: [{ id: 'x1' }], savedAt: Date.now() } });
  assert.equal(put.status, 200);
});

let session1;
test('注册继承当前星空', async () => {
  const r = await api(anon, 'POST', '/api/auth/register', { username: '林深', email: 'lin@star.map', password: 'secret1' });
  assert.equal(r.status, 200);
  assert.match(r.body.session, /^s_[0-9a-f]{48}$/);
  assert.equal(r.body.user.registered, true);
  session1 = r.body.session;
  // 用 session 取星系：匿名时代的数据还在
  const g = await api(session1, 'GET', '/api/galaxy');
  assert.equal(g.status, 200);
  assert.equal(g.body.data.stars[0].id, 'x1');
});

test('注册校验：重名/坏名/短密码/重复邮箱', async () => {
  const anon2 = 'anon2-' + Math.random().toString(36).slice(2);
  await api(anon2, 'POST', '/api/hello', {});
  assert.equal((await api(anon2, 'POST', '/api/auth/register', { username: '林深', password: 'secret1' })).status, 409);
  assert.equal((await api(anon2, 'POST', '/api/auth/register', { username: 'x', password: 'secret1' })).status, 400);
  assert.equal((await api(anon2, 'POST', '/api/auth/register', { username: 'ok名字', password: '123' })).status, 400);
  assert.equal((await api(anon2, 'POST', '/api/auth/register', { username: 'ok名字', email: 'lin@star.map', password: 'secret1' })).status, 409);
});

test('已登录身份再注册 → 409', async () => {
  assert.equal((await api(session1, 'POST', '/api/auth/register', { username: '另一个', password: 'secret1' })).status, 409);
});

test('登录：用户名可登 · 邮箱可登 · 错密码 401', async () => {
  const byName = await api(anon, 'POST', '/api/auth/login', { id: '林深', password: 'secret1' });
  assert.equal(byName.status, 200);
  const byMail = await api(anon, 'POST', '/api/auth/login', { id: 'lin@star.map', password: 'secret1' });
  assert.equal(byMail.status, 200);
  const bad = await api(anon, 'POST', '/api/auth/login', { id: '林深', password: 'wrong!' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error, '用户名或密码不对');
});

test('多会话并存：两次登录的 token 都有效', async () => {
  const s2 = (await api(anon, 'POST', '/api/auth/login', { id: '林深', password: 'secret1' })).body.session;
  const h1 = await api(session1, 'POST', '/api/hello', {});
  const h2 = await api(s2, 'POST', '/api/hello', {});
  assert.equal(h1.body.account.registered, true);
  assert.equal(h2.body.account.username, '林深');
});

test('改密码：未登录 401 · 旧密码错 401 · 成功后新旧交替生效', async () => {
  assert.equal((await api(anon, 'POST', '/api/auth/password', { old: 'secret1', new: 'secret2' })).status, 401);
  assert.equal((await api(session1, 'POST', '/api/auth/password', { old: 'nope', new: 'secret2' })).status, 401);
  assert.equal((await api(session1, 'POST', '/api/auth/password', { old: 'secret1', new: 'secret2' })).status, 200);
  assert.equal((await api(anon, 'POST', '/api/auth/login', { id: '林深', password: 'secret1' })).status, 401);
  assert.equal((await api(anon, 'POST', '/api/auth/login', { id: '林深', password: 'secret2' })).status, 200);
});

test('登出：session 失效，退回匿名语义', async () => {
  assert.equal((await api(session1, 'POST', '/api/auth/logout', {})).status, 200);
  const h = await api(session1, 'POST', '/api/hello', {});
  assert.equal(h.status, 200);
  assert.equal(h.body.account.registered, false); // 死 session 落回匿名建档
});

test('补充不变量：哈希不出库 · 双会话互异 · 旧匿名 token 双行为', async () => {
  const r1 = await api(anon, 'POST', '/api/auth/login', { id: '林深', password: 'secret2' });
  const r2 = await api(anon, 'POST', '/api/auth/login', { id: '林深', password: 'secret2' });
  assert.equal(r1.status, 200); assert.equal(r2.status, 200);
  assert.notEqual(r1.body.session, r2.body.session);              // 多设备：两次登录 token 互异
  assert.ok(!JSON.stringify(r1.body).includes('scrypt:'));        // 密码哈希绝不出库
  const h = await api(r1.body.session, 'POST', '/api/hello', {});
  assert.ok(!JSON.stringify(h.body).includes('scrypt:'));
  // 旧匿名 token = 该账号的遗留凭证：星系仍可读（设计使然），改密仍被拒（仅登录态）
  const g = await api(anon, 'GET', '/api/galaxy');
  assert.equal(g.status, 200);
  assert.equal(g.body.data.stars[0].id, 'x1');
  assert.equal((await api(anon, 'POST', '/api/auth/password', { old: 'secret2', new: 'secret9' })).status, 401);
});

test('绑定/修改邮箱：验密码 · 校格式 · 防占用 · 未登录拒绝', async () => {
  const sess = (await api(anon, 'POST', '/api/auth/login', { id: '林深', password: 'secret2' })).body.session;
  // 未登录（匿名 token）→ 401
  assert.equal((await api(anon, 'POST', '/api/auth/email', { password: 'secret2', email: 'x@y.z' })).status, 401);
  // 密码不对 → 401；格式不对 → 400
  assert.equal((await api(sess, 'POST', '/api/auth/email', { password: 'nope', email: 'x@y.z' })).status, 401);
  assert.equal((await api(sess, 'POST', '/api/auth/email', { password: 'secret2', email: 'not-an-email' })).status, 400);
  // 被别人占用 → 409（先造第二个账号占一个邮箱）
  const anonB = 'anonB-' + Math.random().toString(36).slice(2);
  await api(anonB, 'POST', '/api/hello', {});
  await api(anonB, 'POST', '/api/auth/register', { username: '占位者', email: 'taken@star.map', password: 'secret1' });
  assert.equal((await api(sess, 'POST', '/api/auth/email', { password: 'secret2', email: 'taken@star.map' })).status, 409);
  // 成功：改绑新邮箱，hello 读回新值；改成自己当前邮箱也应 200（幂等不误报占用）
  const ok = await api(sess, 'POST', '/api/auth/email', { password: 'secret2', email: 'new@star.map' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.email, 'new@star.map');
  const h = await api(sess, 'POST', '/api/hello', {});
  assert.equal(h.body.account.email, 'new@star.map');
  assert.equal((await api(sess, 'POST', '/api/auth/email', { password: 'secret2', email: 'new@star.map' })).status, 200);
});
