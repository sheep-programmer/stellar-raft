/* 星图 Stellar Raft — 安全边界测试

   这一套盯的都是「一条请求能不能越过它本不该越过的线」：

   1) 一条畸形 URL 曾经能把整个进程带走（decodeURIComponent 抛 URIError，
      在 node:http 的回调里就是 uncaughtException）—— 未认证的 GET 不该有这种分量；
   2) 500 的正文不该把库表结构、文件绝对路径这类内部细节送出门；
   3) 登录耗时不该因为「这个账号存不存在」而分岔 —— 那是撞库的第一步；
   4) 令牌只从 Authorization 头认，?token= 只给两个够不着请求头的入口开小门；
   5) 分享密文撞空有闸，别让脚本对着 redeem 撒网。 */

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
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    srv.on('error', reject);
  });
}

let child, tmpDir, baseUrl;

const api = async (token, method, p, body) => {
  const res = await fetch(baseUrl + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-security-test-'));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, PORT: String(port), SR_DB: path.join(tmpDir, 'stellar.db'), SR_GUEST_PER_IP: '0' },
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

test('畸形 URL 打不死服务器：一条 GET /%ZZ 曾经就够了', async () => {
  /* decodeURIComponent 遇到坏编码抛 URIError，而它当时就在 http 回调的同步路径上——
     没有任何人接，于是 uncaughtException，进程退出，所有人一起掉线。
     任何能碰到端口的人（反代后面就是整个互联网）都能反复地打。 */
  for (const p of ['/%ZZ', '/%', '/%E4%', '/ui_kits/%FF%FE', '/docs/%C0%80']) {
    const r = await fetch(baseUrl + p, { redirect: 'manual' });
    assert.equal(r.status, 400, `${p} 应当是一条 400`);
  }
  // 最要紧的一句断言：打完之后它还活着
  assert.equal((await fetch(baseUrl + '/ui_kits/stellar-raft/', { redirect: 'manual' })).status, 200);
  assert.equal((await api('u-alive', 'POST', '/api/hello', {})).status, 200);
});

test('500 的正文只说一句话，内部细节留在服务器日志里', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
  const admin = fs.readFileSync(path.join(ROOT, 'server', 'routes', 'admin.js'), 'utf8');
  // 曾经是 json(res, 500, { error: String(e.message || e) })：sqlite 报错里带着库表结构，
  // fs 报错里带着 /Users/… 这样的绝对路径，一并送到了客户端
  for (const [name, src] of [['server.js', server], ['routes/admin.js', admin]]) {
    assert.equal(/500,\s*\{\s*error:\s*String\(e/.test(src), false, name + ' 仍在把内部异常原样吐出去');
  }
  assert.match(server, /json\(res, 500, \{ error: '服务器开小差了，请稍后再试' \}\)/);
  assert.match(server, /console\.error\('\[stellar-raft\] 未处理的异常：'/);
});

test('登录耗时不因账号是否存在而分岔', async () => {
  await api('u-warm', 'POST', '/api/hello', {});
  await api('u-warm', 'POST', '/api/auth/register', { username: '计时者', password: 'passw0rd' });

  const timed = async (id) => {
    const t0 = process.hrtime.bigint();
    await api('u-timing', 'POST', '/api/auth/login', { id, password: 'definitely-wrong' });
    return Number(process.hrtime.bigint() - t0) / 1e6;
  };
  await timed('计时者');   // 预热，别把首次的 JIT 算进去

  /* 存在的账号会真的跑一遍 scrypt（几十毫秒）；不存在的账号如果直接返回，
     两者差着两个数量级，光靠计时就能把「这台服务器上有哪些账号」问出来。
     所以查无此人也要陪跑一遍同样重的哈希。
     断言只取「也慢」这个下限——机器负载会让绝对值飘，但「有没有做那件重活」不会飘。 */
  const missing = Math.min(await timed('查无此人'), await timed('也查无此人'));
  const exists = Math.min(await timed('计时者'), await timed('计时者'));
  assert.ok(missing > 3, `查无此人只花了 ${missing.toFixed(1)}ms —— 说明它没走哈希，耗时会把账号是否存在说出去`);
  assert.ok(missing > exists / 4, `两条路差得太远（存在 ${exists.toFixed(1)}ms / 不存在 ${missing.toFixed(1)}ms）`);
});

test('令牌只认请求头；?token= 只给 beacon 与备份下载开小门', async () => {
  await api('u-q', 'POST', '/api/hello', {});
  const sess = (await api('u-q', 'POST', '/api/auth/register', { username: '查询串', password: 'passw0rd' })).body.session;

  // 正门：头里带令牌，一切照常
  assert.equal((await api(sess, 'GET', '/api/galaxy')).status, 200);

  /* 侧门：URL 里的令牌会顺着 Referer、反代访问日志、浏览器历史一路留下来，
     所以除了那两个够不着请求头的入口，别处一律不认（没有令牌 = 401）。 */
  const viaQuery = await fetch(`${baseUrl}/api/galaxy?token=${encodeURIComponent(sess)}`);
  assert.equal(viaQuery.status, 401, '普通接口不该认 URL 里的令牌');

  // beacon 认（sendBeacon 带不了请求头）
  const beacon = await fetch(`${baseUrl}/api/galaxy/beacon?token=${encodeURIComponent(sess)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { stars: [], constellations: [] } }),
  });
  assert.equal(beacon.status, 200);
});

test('分享密文撞空有闸：脚本撒网会被停下，真人碰不到这条线', async () => {
  await api('u-r', 'POST', '/api/hello', {});
  const sess = (await api('u-r', 'POST', '/api/auth/register', { username: '猜密文', password: 'passw0rd' })).body.session;

  let sawLimit = false;
  for (let i = 0; i < 130; i++) {
    const r = await api(sess, 'POST', '/api/friends/redeem', { code: 'XING-AAAA-' + String(i).padStart(4, '0') });
    if (r.status === 429) { sawLimit = true; assert.ok(r.body.retryAfter > 0, '要告诉对方还得等多久'); break; }
    assert.equal(r.status, 404);
  }
  assert.ok(sawLimit, '撞空上百次也没被拦，等于给穷举开着门');
  /* 上限本身要宽到真人一辈子碰不到。这里读源码而不是 import core.js——
     那个模块一被加载就会去开数据库，测试进程不该有这种副作用。 */
  const core = fs.readFileSync(path.join(ROOT, 'server', 'core.js'), 'utf8');
  const lim = core.match(/const REDEEM_LIM = \{ limit: (\d+)/);
  assert.ok(lim && Number(lim[1]) >= 100, '闸门给得太紧，真人会先撞上');
});

test('响应都带 nosniff：不给浏览器猜类型的机会', async () => {
  const apiRes = await fetch(baseUrl + '/api/hello', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer u-sniff' }, body: '{}',
  });
  assert.equal(apiRes.headers.get('x-content-type-options'), 'nosniff');
  const fileRes = await fetch(baseUrl + '/ui_kits/stellar-raft/app.jsx');
  assert.equal(fileRes.headers.get('x-content-type-options'), 'nosniff');
});

/* 运行时全部从 CDN 来，而这一页握着用户的全部笔记：
   谁在提供这些字节、提供的是不是我们当初看过的那一份，必须是确定的。 */
test('CDN 脚本：版本钉死 + integrity + crossorigin，一个都不能少', () => {
  const pages = ['ui_kits/stellar-raft/index.html', 'docs/index.html', 'docs/showcase.html',
    'docs/foundations.html', 'docs/components.html', 'docs/getting-started.html'];
  // 演示卡与规范卡同样是真页面——它们在浏览器里跑同一份 CDN 运行时
  for (const dir of ['components', 'guidelines']) {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.card.html')) pages.push(path.relative(ROOT, p));
      }
    };
    walk(path.join(ROOT, dir));
  }
  const bad = [];
  for (const f of pages) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    // 只看真正的 <script src>，getting-started 页正文里那段转义的示例代码不算
    for (const m of html.matchAll(/<script\b([^>]*\bsrc="https:\/\/[^"]+"[^>]*)>/g)) {
      const tag = m[1];
      const src = tag.match(/src="([^"]+)"/)[1];
      if (/@latest\b/.test(src)) bad.push(`${f} 没钉版本：${src}`);
      if (!/\bintegrity="sha\d{3}-/.test(tag)) bad.push(`${f} 缺 integrity：${src}`);
      if (!/\bcrossorigin="anonymous"/.test(tag)) bad.push(`${f} 缺 crossorigin（不带它浏览器根本不校验）：${src}`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});
