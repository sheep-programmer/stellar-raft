/* 星图 Stellar Raft — 星港管理台前端接线自检

   与 onboarding.test.js 同一思路：浏览器端 Babel 编译的 JSX 没有可 import 的
   构建产物，React 组件做不了单元测试，所以对源码做结构性断言，守住这些回归点：
   注册到 SRKit / 七个分区都有渲染分支 / 入口只对管理员出现 / 视图与横幅在 app 里
   接上 / 账号字段被水合 / 服务端每个管理接口都在守卫之内 / 品牌律（无 emoji）。 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const ADMIN = read('ui_kits/stellar-raft/AdminConsole.jsx');
const APP = read('ui_kits/stellar-raft/app.jsx');
const SIDEBAR = read('ui_kits/stellar-raft/Sidebar.jsx');
const DATA = read('ui_kits/stellar-raft/data.js');
const API = read('ui_kits/stellar-raft/api.js');
const SETTINGS = read('ui_kits/stellar-raft/Settings.jsx');
const HTML = read('ui_kits/stellar-raft/index.html');
const SERVER = read('server/server.js');

/* ---------------------------- 组件本体 ---------------------------- */

test('AdminConsole 注册 AdminConsole 与 AnnouncementBanner 到 SRKit', () => {
  assert.match(
    ADMIN,
    /window\.SRKit\s*=\s*Object\.assign\(\s*window\.SRKit\s*\|\|\s*\{\}\s*,\s*\{\s*AdminConsole\s*,\s*AnnouncementBanner\s*\}\s*\)/
  );
});

test('八个分区：TABS 登记的每一个都有对应的渲染分支', () => {
  const block = ADMIN.match(/const TABS = \[([\s\S]*?)\n\];/);
  assert.ok(block, '找不到 TABS 定义');
  const ids = [...block[1].matchAll(/id:\s*'([a-z]+)'/g)].map(m => m[1]);
  assert.deepEqual(ids, ['overview', 'users', 'guests', 'shares', 'sessions', 'broadcast', 'system', 'audit']);
  for (const id of ids) {
    assert.match(ADMIN, new RegExp(`tab === '${id}' &&`), `分区 ${id} 没有渲染分支`);
  }
});

test('管理台的数字全部来自服务端接口，没有写死的占位数据', () => {
  // 每个分区的取数路径都必须是真实的 /api/admin 接口
  for (const p of ['/overview', '/trends?days=14', '/users?', '/guests?idleDays=7', '/shares', '/sessions', '/site', '/audit?limit=200']) {
    assert.ok(ADMIN.includes(`'${p}`) || ADMIN.includes(`useAdminData('${p}`) || ADMIN.includes(p),
      '缺少取数路径 ' + p);
  }
  // 趋势条按真实峰值缩放，0 就是 0——不做插值也不铺底
  assert.match(ADMIN, /const peak = Math\.max\(1, \.\.\.buckets\.map/);
  assert.match(ADMIN, /v \? Math\.max\(3, Math\.round\(v \/ peak \* 52\)\) : 1/);
});

test('游客治理：限额、门禁开关与清理都接到真实接口，清理有二次确认', () => {
  assert.match(ADMIN, /adminApi\('\/site', \{ method: 'POST'/);
  assert.match(ADMIN, /guestPerIp: Number\(perIp\)/);
  assert.match(ADMIN, /guestGates: \{ \[g\.id\]: v \}/);
  assert.match(ADMIN, /adminApi\('\/guests\/purge'/);
  assert.match(ADMIN, /open=\{!!purge\}/);
  // 四项门禁与服务端登记的一致
  const block = ADMIN.match(/const GATE_ITEMS = \[([\s\S]*?)\n\];/);
  assert.ok(block);
  const ids = [...block[1].matchAll(/id:\s*'(\w+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(ids, ['editor', 'share', 'vault', 'visit']);
});

test('越权兜底：非管理员即便渲染到组件也只看到一句话', () => {
  assert.match(ADMIN, /if \(!A\.admin\)/);
  assert.match(ADMIN, /只对管理员开放/);
});

test('危险操作都有二次确认，删号还要求敲一遍用户名', () => {
  for (const kind of ['ban', 'delete', 'role', 'password', 'revoke']) {
    assert.match(ADMIN, new RegExp(`dialog === '${kind}'`), `${kind} 应走确认对话框`);
  }
  // 确认字串对不上时按钮保持禁用（服务端另有一道同样的校验）
  assert.match(ADMIN, /confirmText !== \(user\.username \|\| user\.name\)/);
});

test('分区入场不用常驻 className：带 transform 的 fill:both 动画会做成 fixed 包含块', () => {
  assert.equal(/className="sr-view-enter"/.test(ADMIN), false);
  assert.match(ADMIN, /srTransition[\s\S]{0,80}T\.enter\(el\)/);
});

test('无 emoji（品牌律）', () => {
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(ADMIN), 'AdminConsole.jsx 含 emoji');
});

/* ---------------------------- 接线 ---------------------------- */

test('入口只对管理员出现，且挂在侧边栏底部', () => {
  assert.match(SIDEBAR, /D\.account\.admin && \(/);
  assert.match(SIDEBAR, /label="星港管理台"/);
  assert.match(SIDEBAR, /onClick=\{onAdmin\}/);
});

test('app 接上管理台视图、全站公告横幅与停用/维护说明页', () => {
  assert.match(APP, /view === 'admin' && <AdminConsole/);
  // 只认「onAdmin 会跳到管理台视图」，不锁死那一行怎么写——
  // 手机上它还要顺手收起抽屉，写法本来就该能长出来
  assert.match(APP, /onAdmin=\{[^}]*openView\('admin'\)/);
  assert.match(APP, /<AnnouncementBanner announcement=\{banner\}/);
  assert.match(APP, /addEventListener\('sr-blocked'/);
  assert.match(APP, /blocked\.kind === 'banned'/);
  // Esc 从管理台退回星图，与体检页同一套词汇
  assert.match(APP, /view === 'checkup' \|\| view === 'admin'/);
});

test('SRNet 把「服务器关门」翻译成一个事件，而不是一串无声失败', () => {
  assert.match(API, /data\.banned \|\| data\.maintenance/);
  assert.match(API, /'sr-blocked'/);
});

test('data.js 水合 id / role / admin 与站点状态', () => {
  assert.match(DATA, /id: r\.account\.id/);
  assert.match(DATA, /role: r\.account\.role \|\| 'user', admin: !!r\.account\.admin/);
  assert.match(DATA, /site\.announcement = r\.site\.announcement/);
  assert.match(DATA, /account\.defaultPass = !!r\.site\.defaultPass/);
  assert.match(DATA, /'sr-site'/);
  // site 必须出现在对外暴露的接口里，否则横幅读不到
  assert.match(DATA, /account, social, site, ago/);
});

test('index.html 在 app.jsx 之前加载 AdminConsole.jsx', () => {
  const admin = HTML.indexOf('AdminConsole.jsx');
  const app = HTML.indexOf('app.jsx?v=');
  assert.ok(admin > 0, 'index.html 没有登记 AdminConsole.jsx');
  assert.ok(admin < app, 'AdminConsole.jsx 必须先于 app.jsx 加载');
});

/* ---------------------------- 游客门禁 ---------------------------- */

const VISIT = read('ui_kits/stellar-raft/VisitView.jsx');

test('SRGate：门禁表由服务器下发，已注册账号一律放行', () => {
  assert.match(API, /window\.SRGate = \{/);
  assert.match(API, /if \(D\.account && D\.account\.registered\) return false/);
  assert.match(API, /'sr-need-login'/);
  // 后端不在时四项全 false——离线把玩本地星空不该被登录挡住
  assert.match(DATA, /gates: \{ editor: false, share: false, visit: false, vault: false \}/);
  assert.match(DATA, /if \(r\.site\.gates\) site\.gates = r\.site\.gates/);
});

test('三处受限功能都接上门禁：写笔记 / 分享 / 造访，外加 Markdown 仓库进出', () => {
  assert.match(APP, /SRGate\.require\('editor'/);
  assert.match(APP, /v === 'visit' && !window\.SRGate\.require\('visit'/);
  assert.match(SETTINGS, /SRGate\.require\('vault', 'Markdown 仓库导出'\)/);
  assert.match(SETTINGS, /SRGate\.require\('vault', 'Markdown 仓库导入'\)/);
  // 面板级门禁：被拦时给一张说明卡，而不是静默空白
  assert.match(VISIT, /SRGate\.gated\('share'\)/);
  assert.match(VISIT, /gated = window\.SRGate\.gated\('visit'\)/);
  assert.match(VISIT, /function GateNotice/);
  assert.match(APP, /addEventListener\('sr-need-login'/);
});

test('服务端：门禁与游客限额都拦在路由之前，且不会把响应写两遍', () => {
  const gate = SERVER.indexOf("seg[1] === 'share' && needAccount('share')");
  const shareRoute = SERVER.indexOf("if (seg[1] === 'share' && seg.length === 2)");
  assert.ok(gate > 0 && gate < shareRoute, '门禁必须排在分享路由之前');

  // needAccount 自己应答后返回 true，调用方 return —— 不能写成 return json(...)，
  // 因为 json() 不返回值，那样会漏进真正的路由把同一个响应再写一次
  assert.match(SERVER, /const needAccount = \(feature\) => \{[\s\S]*?return true;\n {2}\};/);
  assert.equal(/return json\(res, 403, \{\n\s+error: '这项功能需要一个账号/.test(SERVER), false);

  assert.match(SERVER, /guestLimit: true/);
  assert.match(SERVER, /countGuestsAtIp/);
});

test('服务端：登录与退出排在身份解析之前——维护中、名额已满、被停用都还能进出', () => {
  const login = SERVER.indexOf("seg[1] === 'auth' && seg[2] === 'login'");
  const ensure = SERVER.indexOf('const r = ensureUser(token');
  const ban = SERVER.indexOf('if (me.banned)');
  const maint = SERVER.indexOf('site.maintenance.enabled && !isAdmin');
  assert.ok(login > 0 && login < ensure, '登录必须先于建档');
  assert.ok(login < ban && login < maint, '登录必须先于停用与维护拦截');
  // 注册豁免限额，否则「请去注册」是一句做不到的话
  assert.match(SERVER, /const registering = seg\[1\] === 'auth' && seg\[2\] === 'register'/);
});

/* ---------------------------- 服务端守卫 ---------------------------- */

test('服务端：所有 /api/admin/* 处理都在权限守卫之内', () => {
  const start = SERVER.indexOf("if (seg[1] === 'admin') {");
  assert.ok(start > 0, '找不到 admin 路由块');
  const guard = SERVER.indexOf("if (!sess || !isAdmin) return json(res, 403", start);
  assert.ok(guard > start && guard - start < 400, '守卫必须是 admin 块里的第一件事');

  // admin 块之外不该再出现任何 seg[2] 级别的管理接口处理
  const before = SERVER.slice(0, start);
  assert.equal(/seg\[1\] === 'admin'/.test(before), false, 'admin 路由不该在守卫之前出现');
});

test('服务端：停用拦截在路由之前，退出登录先于拦截放行', () => {
  const logout = SERVER.indexOf("seg[2] === 'logout'");
  const banCheck = SERVER.indexOf('if (me.banned)');
  const maint = SERVER.indexOf('site.maintenance.enabled && !isAdmin');
  const admin = SERVER.indexOf("if (seg[1] === 'admin') {");
  assert.ok(logout > 0 && banCheck > logout, '退出登录必须先于停用拦截');
  assert.ok(maint > banCheck, '维护模式拦截排在停用之后');
  assert.ok(admin > maint, '两道拦截都在管理路由之前');
});

test('服务端：默认管理员只种一次，凭据可由环境变量覆盖', () => {
  assert.match(SERVER, /process\.env\.SR_ADMIN_USER \|\| 'admin'/);
  assert.match(SERVER, /process\.env\.SR_ADMIN_PASS \|\| 'stellar-admin'/);
  assert.match(SERVER, /if \(q\.metaGet\.get\('admin_seeded'\)\) return null/);
  // 同名账号已存在时绝不覆盖别人的密码
  assert.match(SERVER, /if \(q\.userByUsername\.get\(ADMIN_USER\)\) return null/);
});

test('服务端：会话与用户的敏感字段不进管理台响应', () => {
  const block = SERVER.slice(SERVER.indexOf("seg[2] === 'sessions'"), SERVER.indexOf("seg[2] === 'shares'"));
  assert.equal(/token:\s*s\.token[^.]/.test(block), false, '完整会话令牌不得出库');
  assert.match(block, /fingerprint: s\.token\.slice/);

  // adminUser 是用户出库的唯一形态：不带 token，也不带密码哈希
  const au = SERVER.slice(SERVER.indexOf('const adminUser = (u) =>'), SERVER.indexOf('const galaxyStats'));
  assert.equal(/\btoken\b/.test(au), false);
  assert.equal(/\bpass\b/.test(au), false);
});
