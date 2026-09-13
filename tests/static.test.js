/* 星图 Stellar Raft — 静态托管的边界测试

   这台服务器的根目录就是整个仓库：数据库、.git、node_modules、测试与全部源码
   都在里面躺着。曾经它们全都能被匿名 GET 走——`/server/stellar.db` 一个请求就是
   整库（密码哈希、所有人的笔记正文、会话令牌、分享密文）。进程只监听 127.0.0.1
   看似够不着，但 README 教的部署方式是放在 nginx / Caddy 后面，反代会把这些路径
   原样转进来。

   这一套盯两件事：该出去的一样不少（应用与文档站真实用到的每条路径），
   不该出去的一样不漏（数据库 / 源码 / 点开头文件 / 目录穿越的各种写法）。 */

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

// 不经 URL 规范化地打过去：目录穿越的写法必须原样送到服务器，否则测的是 fetch 而不是它
const hit = (p) => fetch(baseUrl + p, { redirect: 'manual' });

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-static-test-'));
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

test('数据库、源码、.git、node_modules —— 一律不出门', async () => {
  const forbidden = [
    '/server/stellar.db', '/server/stellar.db-wal', '/server/stellar.db-shm',
    '/server/server.js', '/server/core.js', '/server/db.js', '/server/config.js', '/server/routes/admin.js',
    '/package.json', '/package-lock.json', '/README.md', '/README.en.md',
    '/tests/auth.test.js', '/scripts/lint.mjs',
    '/.git/config', '/.gitignore', '/.github/workflows/ci.yml', '/.oxlintrc.derived.json',
    '/node_modules/oxlint/package.json',
  ];
  for (const p of forbidden) {
    const r = await hit(p);
    // 404 而不是 403：403 等于承认「这里确实有东西」
    assert.equal(r.status, 404, `${p} 不该被端出去（拿到 ${r.status}）`);
  }
});

test('目录穿越的各种写法都落不到仓库外，也翻不回被挡的目录', async () => {
  const tries = [
    '/ui_kits/../server/stellar.db',
    '/docs/../server/core.js',
    '/docs/./../server/db.js',
    '/%2e%2e/server/stellar.db',
    '/ui_kits/%2e%2e/%2e%2e/etc/passwd',
    '//server/stellar.db',
    '/ui_kits/stellar-raft/../../server/stellar.db',
    '/../../../../etc/passwd',
  ];
  for (const p of tries) {
    const r = await hit(p);
    assert.ok(r.status === 404 || r.status === 403, `${p} 应当被挡（拿到 ${r.status}）`);
  }
});

test('应用与文档站真实用到的每条路径都还在', async () => {
  const allowed = [
    '/ui_kits/stellar-raft/', '/ui_kits/stellar-raft/index.html', '/ui_kits/stellar-raft/app.jsx',
    '/ui_kits/stellar-raft/data.js', '/ui_kits/stellar-raft/README.md',
    '/_ds_bundle.js', '/_ds_manifest.json', '/styles.css',
    '/tokens/colors.css', '/assets/starfield.js', '/components/core/Button.jsx',
    '/docs/', '/docs/index.html', '/docs/registry.js', '/docs/docs.css',
    '/docs/screenshots/starmap.webp', '/docs/diagrams/architecture.svg',
    '/guidelines/brand-logo.card.html',
  ];
  for (const p of allowed) {
    const r = await hit(p);
    assert.equal(r.status, 200, `${p} 应当照常托管（拿到 ${r.status}）`);
  }
  // 根路径重定向到应用目录（相对引用只有在那儿才解析得对）
  assert.equal((await hit('/')).status, 302);
});

test('index.html 登记的每个本地脚本，在真服务器上都取得到', async () => {
  // compile.test.js 查的是「磁盘上有没有」，这里查的是「托管白名单放不放行」——
  // 白名单收紧时，漏掉一个目录就会在这里当场现形，而不是等到页面白屏
  const html = fs.readFileSync(path.join(ROOT, 'ui_kits', 'stellar-raft', 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]).filter(s => !s.startsWith('http'));
  assert.ok(srcs.length >= 20);
  for (const s of srcs) {
    const url = new URL(s, baseUrl + '/ui_kits/stellar-raft/');
    const r = await fetch(url);
    assert.equal(r.status, 200, `${s} 取不到（${r.status}）`);
  }
});

test('未知类型不出门：MIME 表里没有的扩展名一律 404', async () => {
  // 公开目录里哪天多出一个 .db / .env.local / .sh，也不该被 octet-stream 原样端出去
  const probe = path.join(ROOT, 'docs', '__static_test_probe.bin');
  fs.writeFileSync(probe, 'should never be served');
  try {
    assert.equal((await hit('/docs/__static_test_probe.bin')).status, 404);
  } finally {
    fs.rmSync(probe, { force: true });
  }
});

test('非 GET 方法不碰静态文件', async () => {
  const r = await fetch(baseUrl + '/ui_kits/stellar-raft/index.html', { method: 'POST' });
  assert.equal(r.status, 405);
});
