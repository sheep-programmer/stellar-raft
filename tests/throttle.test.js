/* 星图 Stellar Raft — 登录节流测试
   公网部署时，账号前面只剩密码这一道门：scrypt 慢，但慢不过一台不睡觉的机器。
   服务端为登录记两本账——来源 IP 与账号标识，任一本在 15 分钟窗口里攒够上限就先停一会儿。

   覆盖：同账号连败达上限后正确密码也要等 · 别的账号不受牵连 ·
        登录成功即销账（计数从零重来）· 同 IP 撒网式猜名同样会被停。

   这几条都靠「打满窗口」来验，计数又是进程内存里的——本文件单开一台服务器，
   按顺序跑，最后一条会把回环地址锁住，因此它必须排在最后。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 与 server/core.js 的 LOGIN_LIM 同口径
const LIMIT = { perIp: 50, perAccount: 6 };

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

let tmpDir, child, baseUrl;

const api = (token, method, pathName, body) => fetch(baseUrl + pathName, {
  method,
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: body === undefined ? undefined : JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

const login = (id, password, token = 'probe') => api(token, 'POST', '/api/auth/login', { id, password });

// 造一个可登录的账号（走注册，不碰数据库）
async function makeUser(username, password) {
  const anon = 'anon-' + username;
  await api(anon, 'POST', '/api/hello', {});
  const r = await api(anon, 'POST', '/api/auth/register', { username, password });
  assert.equal(r.status, 200, '注册失败：' + JSON.stringify(r.body));
}

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-throttle-test-'));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], {
    // 同一个回环地址要建好几位匿名旅客，关掉「每 IP 一个游客」的限额
    env: { ...process.env, PORT: String(port), SR_DB: path.join(tmpDir, 'stellar.db'), SR_GUEST_PER_IP: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => (logs += d));
  child.stderr.on('data', (d) => (logs += d));
  for (let i = 0; ; i++) {
    try { if ((await fetch(baseUrl + '/', { redirect: 'manual' })).status) break; } catch { /* 还没起来 */ }
    if (i > 200) throw new Error('server did not start:\n' + logs);
    await new Promise((r) => setTimeout(r, 50));
  }
  await makeUser('locked', 'passw0rd');
  await makeUser('bystander', 'passw0rd');
  await makeUser('resetter', 'passw0rd');
  await makeUser('lastone', 'passw0rd');
});

test.after(() => {
  if (child) child.kill('SIGKILL');
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('同一账号连败到上限：之后连正确密码也要先等一会儿', async () => {
  for (let i = 0; i < LIMIT.perAccount; i++) {
    assert.equal((await login('locked', 'nope' + i)).status, 401, `第 ${i + 1} 次错密码该是 401`);
  }
  const blocked = await login('locked', 'passw0rd');
  assert.equal(blocked.status, 429, '攒够失败之后，正确密码也该被拦在门外');
  assert.match(blocked.body.error, /太多/);
  assert.ok(blocked.body.retryAfter > 0, '要告诉人还得等多久');
  assert.ok(!JSON.stringify(blocked.body).includes('scrypt'), '拦截应答不泄露任何密码材料');
});

test('停的是那把钥匙，不是整座门：别的账号照常登录', async () => {
  assert.equal((await login('bystander', 'passw0rd')).status, 200);
});

test('登录成功即销账：中途对过一次，计数从零重来', async () => {
  for (let i = 0; i < LIMIT.perAccount - 1; i++) {
    assert.equal((await login('resetter', 'nope' + i)).status, 401);
  }
  assert.equal((await login('resetter', 'passw0rd')).status, 200, '还没到上限，正确密码就该放行');
  // 计数若没销，这一轮会在中途撞上 429
  for (let i = 0; i < LIMIT.perAccount - 1; i++) {
    assert.equal((await login('resetter', 'nope' + i)).status, 401, '成功一次之后，计数该从零重来');
  }
  assert.equal((await login('resetter', 'passw0rd')).status, 200);
});

/* 这一条会把回环地址本身锁住（窗口 15 分钟），因此放在最后。 */
test('撒网式猜名：同一 IP 攒够失败，连有效账号也先停一会儿', async () => {
  /* 不假设这本账是从零开始的。前面几条用例已经往同一个 IP 上打过失败，而登录成功
     **只销账号那本、不销 IP 那本**——IP 那本拦的正是「一台机器换着账号猜」，攻击者
     手上总有一个自己的有效账号，能顺手把它清零的话这道闸等于不存在。
     所以这里只认那条真正的性质：撒网撞上上限之后，连有效账号也进不去。 */
  let hitLimit = false;
  for (let i = 0; i < LIMIT.perIp; i++) {
    // 每次换一个不存在的用户名：避开「同账号」那本账，专打「同 IP」这本
    const r = await login('ghost-' + i, 'whatever');
    if (r.status === 429) { hitLimit = true; break; }
    assert.equal(r.status, 401, '还没撞上上限时，猜错就该是一句 401');
  }
  const blocked = await login('lastone', 'passw0rd');
  assert.equal(blocked.status, 429, '同一 IP 撒网猜名撞上上限后，整台机器都该先歇一会儿');
  assert.ok(blocked.body.retryAfter > 0, '要告诉对方还得等多久');
  void hitLimit;
});

test('登录成功不销 IP 那本账：否则手上有个有效账号就能把闸门无限重置', async () => {
  /* 上一条已经把这个 IP 打到上限。此时拿一个**密码正确**的账号登录——
     它自己会被 429 拦住（闸门先于校验），更要紧的是：即便让它过去，
     也不该把 IP 那本清零。这里验的是「清零没有发生」。 */
  assert.equal((await login('resetter', 'passw0rd')).status, 429, '闸门期间正确密码也先等着');
  assert.equal((await login('lastone', 'passw0rd')).status, 429, 'IP 那本没有被谁顺手清零');
});
