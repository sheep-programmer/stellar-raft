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
const HANDOVER = read('ui_kits/stellar-raft/AdminHandover.jsx');
const HTML = read('ui_kits/stellar-raft/index.html');
const SERVER = read('server/server.js');
const CORE = read('server/core.js');
const ADMIN_ROUTES = read('server/routes/admin.js');

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
  for (const p of ['/overview', '/trends?days=14', '/users?', '/guests?idleDays=7', '/shares?', '/sessions?', '/site', '/audit?']) {
    assert.ok(ADMIN.includes(`'${p}`) || ADMIN.includes(`useAdminData('${p}`) || ADMIN.includes(p),
      '缺少取数路径 ' + p);
  }
  // 趋势条按真实峰值缩放，0 就是 0——不做插值也不铺底
  assert.match(ADMIN, /const peak = Math\.max\(1, \.\.\.buckets\.map/);
  assert.match(ADMIN, /v \? Math\.max\(3, Math\.round\(v \/ peak \* 52\)\) : 1/);
});

test('会变长的名单一律分页：旅客 / 游客 / 分享 / 会话 / 日志共用同一副翻页条', () => {
  // 四个名单都带上 page/size，不再一次性把整张表拉下来
  for (const p of ['/users?', '/shares?page=', '/sessions?page=', '/audit?page=', '/guests?idleDays=7&page=']) {
    assert.ok(ADMIN.includes(p), '名单未分页：' + p);
  }
  // 翻页条只有一副（改分页体验时不会漏改某一个分区）
  assert.match(ADMIN, /function AdmPager\(/);
  assert.equal((ADMIN.match(/<AdmPager /g) || []).length, 5, '五个名单都要挂上翻页条');
  // 只有一页时整条不出现
  assert.match(ADMIN, /if \(!d \|\| !\(d\.pages > 1\)\) return null;/);
});

test('操作日志可以清空，且清空这件事本身也留痕', () => {
  assert.match(ADMIN, /adminApi\('\/audit\/clear', \{ method: 'POST'/);
  assert.match(ADMIN, /setClearing\(true\)/);          // 二次确认，不是点一下就没
  assert.match(ADMIN_ROUTES, /seg\[3\] === 'clear'/);
  assert.match(ADMIN_ROUTES, /q\.auditClear\.run\(\)/);
  assert.match(ADMIN_ROUTES, /audit\(me, 'audit\.clear'/);   // 清完补记一条
});

test('收拢 WAL 报出真实收拢量；只搬字节的维护不写审计，销毁数据的才写', () => {
  assert.match(ADMIN_ROUTES, /const before = walSize\(\)/);
  assert.match(ADMIN_ROUTES, /freed = Math\.max\(0, before - walSize\(\)\)/);
  assert.match(ADMIN_ROUTES, /busy: true/);
  // checkpoint / vacuum 不留痕，prune-sessions 留痕
  assert.equal(/audit\(me, 'db\.checkpoint'/.test(ADMIN_ROUTES), false, '收拢 WAL 不该写审计');
  assert.equal(/audit\(me, 'db\.' \+ act/.test(ADMIN_ROUTES), false, '维护动作不该逐个留痕');
  assert.match(ADMIN_ROUTES, /audit\(me, 'db\.prune-sessions'/);
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

/* ---------------------------- 星港交接 ----------------------------
   出厂管理员一登录就撞上交接卡：用户名与密码一起换，换完才放行。
   这一组盯的是「关不掉」与「必须亲手确认记住」这两件事没被后来的改动磨平。 */

test('AdminHandover 注册到 SRKit，并在 app.jsx 之前加载', () => {
  assert.match(HANDOVER, /window\.SRKit\s*=\s*Object\.assign\(\s*window\.SRKit\s*\|\|\s*\{\}\s*,\s*\{\s*AdminHandover\s*\}\s*\)/);
  const card = HTML.indexOf('AdminHandover.jsx');
  const app = HTML.indexOf('app.jsx?v=');
  assert.ok(card > 0, 'index.html 没有登记 AdminHandover.jsx');
  assert.ok(card < app, 'AdminHandover.jsx 必须先于 app.jsx 加载');
});

test('交接卡只对「出厂凭据还当值的管理员」出现，且压在所有浮层之上', () => {
  assert.match(APP, /setHandover\(!!\(A && A\.admin && A\.defaultPass\)\)/);
  assert.match(APP, /\{handover && <AdminHandover onDone=/);
  // 服务器改口（sr-site / sr-account）之后要跟着变，不能只在挂载时看一眼
  for (const ev of ['sr-site', 'sr-account', 'sr-hydrated']) {
    assert.ok(APP.includes(`window.addEventListener('${ev}', h)`), '交接卡没有跟住 ' + ev);
  }
  // 新手引导给它让位（同登录页的取舍），⌘K / ? / Esc 一律不在它之上开第二层
  assert.match(APP, /\{onboard && !login && !handover && authKnown && <Onboarding/);
  /* ⌘K / ? / Esc 三处守卫都要认得交接卡。认「这一行里有没有 handover」而不是
     锁死它是不是最后一项——守卫清单本来就会随浮层增减而变长。 */
  const guards = [...APP.matchAll(/if \(([a-zA-Z|\s!.]*handover[a-zA-Z|\s!.]*)\) return;/g)];
  assert.equal(guards.length, 3, '⌘K / ? / Esc 三处守卫都要认得交接卡，实得 ' + guards.length);
  // zIndex 压过登录页（150）
  const z = HANDOVER.match(/zIndex:\s*(\d+)/);
  assert.ok(z && Number(z[1]) > 150, '交接卡要压在登录页之上');
});

test('交接卡关不掉：没有 onClose，Esc 被就地吃掉，唯一出口是退出登录', () => {
  assert.equal(/onClose/.test(HANDOVER), false, '交接卡不该有「关闭」这条路');
  // Esc 在捕获阶段拦下并吞掉，而不是转手关闭
  assert.match(HANDOVER, /e\.key === 'Escape'.*preventDefault\(\);\s*e\.stopPropagation\(\);/s);
  assert.match(HANDOVER, /addEventListener\('keydown', k, true\)/);
  assert.match(HANDOVER, /window\.SRNet\.logoutFlow\(\)/);
});

test('交接卡：用户名与密码一起换，且必须亲手勾上「我已记下」才提交得了', () => {
  // 三个输入：新用户名、新密码、确认密码
  assert.equal((HANDOVER.match(/<Input\b/g) || []).length, 3);
  assert.match(HANDOVER, /autoComplete="username"/);
  assert.equal((HANDOVER.match(/autoComplete="new-password"/g) || []).length, 2);
  // 「记住」是一枚闸：没勾上 ready 就是 false，提交键是灰的
  assert.match(HANDOVER, /const ready = !localErr\(\) && remembered && !busy/);
  assert.match(HANDOVER, /disabled=\{!ready\}/);
  assert.match(HANDOVER, /<Checkbox checked=\{remembered\}/);
  // 本地校验与服务端同一口径（出厂用户名 / 密码下限 / 两次一致）
  assert.match(HANDOVER, /SR_ADMIN_PASS_MIN = 8/);
  assert.match(HANDOVER, /\^\[\\w一-龥-\]\{2,24\}\$/);
  assert.match(HANDOVER, /pw !== confirm/);
});

test('交接成功后换钥匙而不是换身份：本地星空镜像与账号偏好原样留下', () => {
  assert.match(HANDOVER, /window\.SRNet\.auth\.handover\(/);
  assert.match(HANDOVER, /window\.SRNet\.renewSession\(r\.session\)/);
  assert.equal(/adoptSession/.test(HANDOVER), false, 'adoptSession 会清掉这个人自己的镜像与偏好');
  // renewSession 只换令牌：既不清 galaxy 镜像，也不走 stripLocalIdentity
  const rn = API.slice(API.indexOf('const renewSession'), API.indexOf('const adoptSession'));
  assert.match(rn, /localStorage\.setItem\(KEY, t\)/);
  assert.equal(/removeItem\(LS_GALAXY\)|stripLocalIdentity/.test(rn), false);
  // 交接后就地摘掉红条
  assert.match(HANDOVER, /acc\.defaultPass = false/);
  assert.match(HANDOVER, /'sr-account'/);
});

test('服务端：交接接口三道守卫，两样一起换，善后是吊销全部会话', () => {
  const block = SERVER.slice(SERVER.indexOf("seg[2] === 'handover'"), SERVER.indexOf("seg[1] === 'hello'"));
  assert.match(block, /if \(!sess \|\| !me\.username \|\| !me\.pass\)/, '必须是真登录态');
  assert.match(block, /if \(!isAdmin\)/, '必须是管理员');
  assert.match(block, /if \(!adminDefaultPass\(\)\)/, '交接过一次就不再开门');
  // 出厂用户名与出厂密码都不许留
  assert.match(block, /username\.toLowerCase\(\) === ADMIN_USER\.toLowerCase\(\)/);
  assert.match(block, /password === ADMIN_PASS/);
  assert.match(block, /password\.length < ADMIN_PASS_MIN/);
  // 两样一起落库，标记摘掉，旧会话全清，再发一把新的
  assert.match(block, /q\.setUsername\.run/);
  assert.match(block, /q\.setPass\.run\(hashPass\(password\), me\.id\)/);
  assert.match(block, /clearAdminDefaultPass\(\)/);
  assert.match(block, /q\.dropSessionsOf\.run\(me\.id\)/);
  assert.match(block, /audit\(fresh, 'admin\.handover'/);
  assert.match(block, /session: newSession\(me\.id\)/);
  // 管理员密码下限比普通账号严一档
  assert.match(CORE, /const ADMIN_PASS_MIN = 8;/);
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

  // 「已应答」这件事全靠 json() 回 true 来传递：门禁把它转发给调用方，调用方立刻
  // return。任何一环把返回值吞掉，请求都会漏进真正的路由，把同一个响应再写一次。
  assert.match(CORE, /const json = \(res, code, obj\) => \{[\s\S]*?return true;\n\};/);
  assert.match(SERVER, /const needAccount = \(feature\) => \{[\s\S]*?return json\(res, 403, \{/);
  assert.match(SERVER, /needAccount\('share'\)\) return;/);
  assert.match(SERVER, /needAccount\('visit'\)\) return;/);

  assert.match(SERVER, /guestLimit: true/);
  assert.match(CORE, /countGuestsAtIp/);
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
  // 管理台自成一个模块：进门先认身份，认不过一步都走不下去
  const entry = ADMIN_ROUTES.indexOf('async function handleAdmin');
  assert.ok(entry > 0, '找不到 handleAdmin 入口');
  const guard = ADMIN_ROUTES.indexOf("if (!sess || !isAdmin) return json(res, 403", entry);
  assert.ok(guard > entry && guard - entry < 400, '守卫必须是 handleAdmin 里的第一件事');

  // 守卫之前不得出现任何 seg[2] 级别的管理接口处理
  assert.equal(/seg\[2\] ===/.test(ADMIN_ROUTES.slice(entry, guard)), false, '守卫之前不该有路由分支');
  // 管理接口只此一处：主管线除了把请求交出去，不自己处理 admin
  assert.equal(/seg\[1\] === 'admin'/.test(SERVER), false, 'server.js 不该自己处理 admin 路由');
  assert.match(SERVER, /await handleAdmin\(/);
});

test('服务端：停用拦截在路由之前，退出登录先于拦截放行', () => {
  const logout = SERVER.indexOf("seg[2] === 'logout'");
  const banCheck = SERVER.indexOf('if (me.banned)');
  const maint = SERVER.indexOf('site.maintenance.enabled && !isAdmin');
  const admin = SERVER.indexOf('await handleAdmin(');
  assert.ok(logout > 0 && banCheck > logout, '退出登录必须先于停用拦截');
  assert.ok(maint > banCheck, '维护模式拦截排在停用之后');
  assert.ok(admin > maint, '两道拦截都在管理路由之前');
});

test('服务端：默认管理员只种一次，凭据可由环境变量覆盖', () => {
  assert.match(CORE, /process\.env\.SR_ADMIN_USER \|\| 'admin'/);
  assert.match(CORE, /process\.env\.SR_ADMIN_PASS \|\| 'stellar-admin'/);
  assert.match(CORE, /if \(q\.metaGet\.get\('admin_seeded'\)\) return null/);
  // 同名账号已存在时绝不覆盖别人的密码
  assert.match(CORE, /if \(q\.userByUsername\.get\(ADMIN_USER\)\) return null/);
});

test('服务端：会话与用户的敏感字段不进管理台响应', () => {
  const block = ADMIN_ROUTES.slice(ADMIN_ROUTES.indexOf("seg[2] === 'sessions'"), ADMIN_ROUTES.indexOf("seg[2] === 'shares'"));
  assert.equal(/token:\s*s\.token[^.]/.test(block), false, '完整会话令牌不得出库');
  assert.match(block, /fingerprint: s\.token\.slice/);

  // adminUser 是用户出库的唯一形态：不带 token，也不带密码哈希
  const au = ADMIN_ROUTES.slice(ADMIN_ROUTES.indexOf('const adminUser = (u) =>'), ADMIN_ROUTES.indexOf('const galaxyStats'));
  assert.equal(/\btoken\b/.test(au), false);
  assert.equal(/\bpass\b/.test(au), false);
});
