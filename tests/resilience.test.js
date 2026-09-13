/* 星图 Stellar Raft — 崩了 / 掉线 / 过期时，人还能看懂发生了什么

   三件事凑成一套，因为它们回答的是同一个问题：出岔子的那一刻，用户看到的是
   一句人话，还是一整屏黑。

   1) 会话的寿命 —— 90 天没露面的登录态就地判失效（真的改数据库回拨时间来验）；
   2) 死掉的会话令牌 —— 不再被当成匿名令牌新建一位游客，而是明说「请重新登录」；
   3) 渲染崩溃 —— Boundary 接住，说清「出了什么事 / 数据在哪儿 / 怎么回去」。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    srv.on('error', reject);
  });
}

let child, tmpDir, baseUrl, dbPath;

const api = async (token, method, p, body) => {
  const res = await fetch(baseUrl + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-resilience-test-'));
  dbPath = path.join(tmpDir, 'stellar.db');
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, PORT: String(port), SR_DB: dbPath, SR_GUEST_PER_IP: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', d => (logs += d));
  child.stderr.on('data', d => (logs += d));
  for (let i = 0; ; i++) {
    try { if ((await fetch(baseUrl + '/', { redirect: 'manual' })).status) break; } catch { /* not up */ }
    if (i > 200) throw new Error('server did not start:\n' + logs);
    await new Promise(r => setTimeout(r, 50));
  }
});

test.after(() => {
  if (child) child.kill('SIGKILL');
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

/* ---------------------------- 会话的寿命 ---------------------------- */

test('90 天没露面的会话就地失效，并且从库里清掉', async () => {
  const anon = 'u-ttl-' + Math.random().toString(36).slice(2);
  await api(anon, 'POST', '/api/hello', {});
  const reg = await api(anon, 'POST', '/api/auth/register', { username: '久别', password: 'passw0rd' });
  const sess = reg.body.session;
  assert.equal((await api(sess, 'POST', '/api/hello', {})).status, 200);

  /* 把这把钥匙的 last_seen 回拨到 100 天前。以前这只有管理台「系统」页上那颗
     手动按钮会管——没人点，两年前泄漏的令牌今天照样通行。 */
  const db = new DatabaseSync(dbPath);
  db.prepare("UPDATE sessions SET last_seen = datetime('now', '-100 days'), created_at = datetime('now', '-100 days') WHERE token = ?").run(sess);
  db.close();

  const after = await api(sess, 'POST', '/api/hello', {});
  assert.equal(after.status, 401, '过期的登录态不该还能通行');
  assert.equal(after.body.sessionExpired, true, '要告诉客户端「是登录失效」，它才切得出说明页');

  // 判过期的同时把死行删掉，不留一张只会越长越长的表
  const db2 = new DatabaseSync(dbPath);
  const row = db2.prepare('SELECT COUNT(*) AS n FROM sessions WHERE token = ?').get(sess);
  db2.close();
  assert.equal(row.n, 0, '过期会话应当就地删除');

  // 密码没变，重新登录立刻恢复——过期的是这把钥匙，不是这个账号
  assert.equal((await api('u-ttl-again', 'POST', '/api/auth/login', { id: '久别', password: 'passw0rd' })).status, 200);
});

test('天天在用的会话不会被窗口滑掉（last_seen 每次请求都往前推）', async () => {
  const anon = 'u-live-' + Math.random().toString(36).slice(2);
  await api(anon, 'POST', '/api/hello', {});
  const sess = (await api(anon, 'POST', '/api/auth/register', { username: '常在', password: 'passw0rd' })).body.session;

  // 89 天前建的会话，但刚刚才用过 → 仍然有效
  const db = new DatabaseSync(dbPath);
  db.prepare("UPDATE sessions SET created_at = datetime('now', '-89 days') WHERE token = ?").run(sess);
  db.close();
  assert.equal((await api(sess, 'POST', '/api/hello', {})).status, 200);
});

test('死掉的会话令牌不会变成一位新游客，也不占游客名额', async () => {
  const anon = 'u-ghost-' + Math.random().toString(36).slice(2);
  await api(anon, 'POST', '/api/hello', {});
  const sess = (await api(anon, 'POST', '/api/auth/register', { username: '幽灵', password: 'passw0rd' })).body.session;
  await api(sess, 'POST', '/api/auth/logout', {});

  const db = new DatabaseSync(dbPath);
  const before = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  db.close();

  const r = await api(sess, 'POST', '/api/hello', {});
  assert.equal(r.status, 401);
  assert.equal(r.body.sessionExpired, true);

  const db2 = new DatabaseSync(dbPath);
  const after = db2.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  db2.close();
  assert.equal(after, before, '不该凭空多出一行用户');
});

test('长得不像会话令牌的字符串仍按匿名建档 —— 别把游客一起关在门外', async () => {
  // 'u-…' 是匿名令牌的样子；只有 s_+48 位十六进制才判定为「会话令牌」
  const r = await api('u-plain-' + Math.random().toString(36).slice(2), 'POST', '/api/hello', {});
  assert.equal(r.status, 200);
  assert.equal(r.body.account.registered, false);

  // 形似但不合格的（长度不对）也走匿名，不误伤
  assert.equal((await api('s_short', 'POST', '/api/hello', {})).status, 200);
});

/* ---------------------------- 崩溃兜底 ---------------------------- */

const BOUNDARY = read('ui_kits/stellar-raft/Boundary.jsx');
const APP = read('ui_kits/stellar-raft/app.jsx');
const API_JS = read('ui_kits/stellar-raft/api.js');
const HTML = read('ui_kits/stellar-raft/index.html');

test('Boundary 是真的错误边界，而不是一个长得像的壳', () => {
  assert.match(BOUNDARY, /static getDerivedStateFromError/);
  assert.match(BOUNDARY, /componentDidCatch/);
  assert.match(BOUNDARY, /window\.SRKit = Object\.assign\(window\.SRKit \|\| \{\}, \{ Boundary \}\)/);
  // 崩了之后要给得出三样东西：出了什么事、怎么回去、怎么把现场交给别人
  assert.match(BOUNDARY, /this\.state\.err/);
  assert.match(BOUNDARY, /location\.reload\(\)/);
  assert.match(BOUNDARY, /clipboard|execCommand/);
  // 控制台留全量堆栈：卡片上只给摘要
  assert.match(BOUNDARY, /console\.error\('\[星图\] 渲染时崩了：'/);
});

test('两层兜底：整个 App 一层，视图一层（一个视图崩了还回得去）', () => {
  assert.match(APP, /<Boundary title="星图"><App \/><\/Boundary>/);
  assert.match(APP, /<Boundary key=\{`b\|\$\{view\}/, '视图层的 Boundary 要按视图 key 重挂载');
  assert.match(APP, /onReset=\{\(\) => \{[^}]*backToMap\(\)/);
  // Boundary 必须先于 app.jsx 加载，否则 SRKit 里取到 undefined
  const b = HTML.indexOf('Boundary.jsx');
  assert.ok(b > 0 && b < HTML.indexOf('app.jsx?v='), 'Boundary.jsx 要登记在 app.jsx 之前');
});

test('登录失效在前端有一张说明页，而不是一串静默失败', () => {
  assert.match(API_JS, /data\.banned \|\| data\.maintenance \|\| data\.sessionExpired/);
  assert.match(API_JS, /'sr-blocked'/);
  assert.match(APP, /blocked\.kind === 'expired'/);
  assert.match(APP, /expired: '这台设备的登录已失效'/);
  // 出口是 logoutFlow：换回全新匿名令牌 + 清掉上一个身份的本地痕迹 + 落到登录页
  assert.match(APP, /\{expired \? '重新登录' : '退出登录'\}/);
});

test('启动兜底那句话不撒谎：源文件坏了不该被说成「网络不可达」', () => {
  const m = HTML.match(/m\.textContent = '([^']+)'/);
  assert.ok(m, 'index.html 里找不到启动兜底文案');
  assert.match(m[1], /源文件/, '要把「某个源文件坏了」也说出来');
});
