# 星门 · 账号系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登录/注册账号体系：用户名+邮箱皆可登录、注册继承当前匿名星空、sessions 多设备、全屏登录页、Settings 账户页真实化；数据全部入 SQLite。

**Architecture:** 服务端在现有零依赖 `server/server.js` 内加列迁移 + `sessions` 表 + 鉴权链改造（session 优先于匿名 token）+ 4 条 `/api/auth/*` 路由；前端 `SRNet.auth` 薄封装 + 全屏 `LoginView` overlay + Settings/Sidebar 双形态。设计文档：`docs/superpowers/specs/2026-07-15-account-system-design.md`（实现前先读）。

**Tech Stack:** node:http + node:sqlite + node:crypto(scryptSync/timingSafeEqual/randomBytes)，浏览器内 Babel JSX，node --test。

## Global Constraints

- **零三方依赖**：服务端只用 Node 内置模块；密码哈希 `crypto.scryptSync`，比较 `crypto.timingSafeEqual`。
- **匿名兼容**：所有既有 API 对匿名 token 行为不变；鉴权链 = 先 `sessions` 后 `users.token`。
- **登录失败文案统一**：「用户名或密码不对」，不区分是哪个错。
- **错误返回**沿用 `json(res, code, {error: '中文文案'})` 风格；文案遵守品牌守则（安静、不 hype、无 emoji）。
- **前端**：改动 JSX/js 后递增 index.html 对应 `?v=`；组件注册 `window.SRKit`；三色预算/玻璃拟态/Lucide 图标。
- **关键正确性**：`adoptSession`/登出时必须 `localStorage.removeItem('sr.galaxy.v1')`（清本地星空镜像），否则「新者优先」的水合会拿旧账号镜像覆盖新账号服务器数据。
- 提交消息不得含任何 AI 署名尾注。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `server/server.js` | 改：列迁移 + sessions 表 + 鉴权链 + `/api/auth/*` + hello 扩展 |
| `tests/auth.test.js` | 新增：auth 全链路 HTTP 测试（TDD，仿 `tests/server.test.js` 模式） |
| `ui_kits/stellar-raft/api.js` | 改：`SRNet.auth` + `adoptSession` + `logoutFlow` |
| `ui_kits/stellar-raft/data.js` | 改：hello 回填 `account.registered/username/email/registeredAt` |
| `ui_kits/stellar-raft/LoginView.jsx` | 新增：全屏登录/注册页 |
| `ui_kits/stellar-raft/app.jsx` | 改：login state + 首启判断 + 挂载 + `openLogin` 下发 |
| `ui_kits/stellar-raft/Settings.jsx` | 改：账户页真实化（双形态 + 改密 + 真退出） |
| `ui_kits/stellar-raft/Sidebar.jsx` | 改：用户 chip 双形态 |
| `ui_kits/stellar-raft/index.html` | 改：LoginView 脚本行 + `?v=` 递增 |

---

## Task 1: 服务端账号体系（TDD）

**Files:**
- Modify: `server/server.js`
- Test: `tests/auth.test.js`（新建）

**Interfaces:**
- Produces（后续任务依赖，签名照此实现）：
  - `POST /api/auth/register {username, email?, password}` → `{session, user}`；重名/占用 409、格式错 400、已登录再注册 409
  - `POST /api/auth/login {id, password}` → `{session, user}`；失败 401 `{error:'用户名或密码不对'}`
  - `POST /api/auth/logout {}` → `{ok:true}`（匿名调用也 200）
  - `POST /api/auth/password {old, new}` → `{ok:true}`；未登录/旧密码错 401、新密码短 400
  - `POST /api/hello` 返回增加 `account: {id,name,avatar,registered,username,email,registeredAt}`
  - session token 形如 `s_<48hex>`

- [ ] **Step 1: 写失败测试 `tests/auth.test.js`**

仿照 `tests/server.test.js` 的启动模式（复制 server.js 进临时目录、free port、`api(token, method, path, body)` helper——直接照抄该文件顶部的 `freePort`/`before`/`after` 脚手架），用例：

```js
/* 星图 Stellar Raft — 账号体系 REST 测试
   注册继承匿名星空 · 用户名/邮箱皆可登录 · sessions 多设备 · 改密 · 登出 */
import test from 'node:test';
import assert from 'node:assert/strict';
// …（脚手架与 server.test.js 相同：tmpDir/child/baseUrl/api/freePort/before/after）

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
  const a = await api(null, 'POST', '/api/auth/login?token=whatever', {});
  // ↑ login 也要带 token（任意匿名皆可）——直接用 anon 调
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
```

- [ ] **Step 2: 跑测试确认 RED**

Run: `node --test tests/auth.test.js`
Expected: FAIL（/api/auth/* 404、hello 无 account 字段）

- [ ] **Step 3: 实现 server.js**

依次加入（位置跟随现有结构，行号勿死记）：

① 建表块之后——列迁移 + sessions 表：
```js
// 账号体系：既有库平滑加列（ALTER ADD COLUMN 不支持 UNIQUE，唯一性用部分索引兜底）
const ensureColumn = (table, col, ddl) => {
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
  if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
};
ensureColumn('users', 'username', 'username TEXT');
ensureColumn('users', 'email', 'email TEXT');
ensureColumn('users', 'pass', 'pass TEXT');
ensureColumn('users', 'registered_at', 'registered_at TEXT');
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
```

② `q` 语句表追加：
```js
  sessionByToken: db.prepare('SELECT * FROM sessions WHERE token = ?'),
  insertSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
  touchSession: db.prepare("UPDATE sessions SET last_seen = datetime('now') WHERE token = ?"),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  registerUser: db.prepare("UPDATE users SET username = ?, email = ?, pass = ?, registered_at = datetime('now') WHERE id = ?"),
  setPass: db.prepare('UPDATE users SET pass = ? WHERE id = ?'),
```

③ 密码/会话 helpers（`crypto` 若未 import 则加 `import crypto from 'node:crypto'` 或对齐现有 require 风格）：
```js
const hashPass = (pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt:' + salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
};
const checkPass = (pw, stored) => {
  try {
    const [m, salt, hex] = String(stored || '').split(':');
    if (m !== 'scrypt') return false;
    const a = crypto.scryptSync(pw, salt, 64), b = Buffer.from(hex, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
};
const newSession = (userId) => { const t = 's_' + crypto.randomBytes(24).toString('hex'); q.insertSession.run(t, userId); return t; };
const pubAccount = (u) => ({ id: u.id, name: u.name, avatar: u.avatar, registered: !!u.username,
  username: u.username || null, email: u.email || null, registeredAt: u.registered_at || null });
```

④ `handleApi` 鉴权链改造——把 `const me = ensureUser(token, body.name, body.avatar);` 替换为：
```js
  // 鉴权链：session 优先（登录态），未命中退回匿名 token 建档
  const sess = q.sessionByToken.get(token);
  let me;
  if (sess) { me = q.userById.get(sess.user_id); q.touchSession.run(token); }
  else { me = ensureUser(token, body.name, body.avatar); }
```

⑤ `/api/auth/*` 四路由（放在 hello 之前）：
```js
  // ——— 账号体系 ———
  if (seg[1] === 'auth' && seg[2] === 'register' && req.method === 'POST') {
    if (me.username) return json(res, 409, { error: '当前已登录账号，如需另建请先退出' });
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!/^[\w一-龥-]{2,24}$/.test(username)) return json(res, 400, { error: '用户名需 2–24 个字符（中英文、数字、_ 或 -）' });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: '邮箱格式不对' });
    if (password.length < 6) return json(res, 400, { error: '密码至少 6 位' });
    if (q.userByUsername.get(username)) return json(res, 409, { error: '这个用户名已经有主人了' });
    if (email && q.userByEmail.get(email)) return json(res, 409, { error: '这个邮箱已经绑定过账号' });
    q.registerUser.run(username, email || null, hashPass(password), me.id);
    const session = newSession(me.id);
    return json(res, 200, { session, user: pubAccount(q.userById.get(me.id)) });
  }
  if (seg[1] === 'auth' && seg[2] === 'login' && req.method === 'POST') {
    const idf = String(body.id || '').trim();
    const u = q.userByUsername.get(idf) || q.userByEmail.get(idf);
    if (!u || !u.pass || !checkPass(String(body.password || ''), u.pass)) return json(res, 401, { error: '用户名或密码不对' });
    return json(res, 200, { session: newSession(u.id), user: pubAccount(u) });
  }
  if (seg[1] === 'auth' && seg[2] === 'logout' && req.method === 'POST') {
    q.deleteSession.run(token);
    return json(res, 200, { ok: true });
  }
  if (seg[1] === 'auth' && seg[2] === 'password' && req.method === 'POST') {
    if (!me.username || !me.pass) return json(res, 401, { error: '尚未登录账号' });
    if (!checkPass(String(body.old || ''), me.pass)) return json(res, 401, { error: '旧密码不对' });
    if (String(body.new || '').length < 6) return json(res, 400, { error: '新密码至少 6 位' });
    q.setPass.run(hashPass(String(body.new)), me.id);
    return json(res, 200, { ok: true });
  }
```

⑥ hello 返回加 `account`：在现有 `return json(res, 200, { user: {...}, share, hasGalaxy })` 里追加 `account: pubAccount(u)`。

- [ ] **Step 4: 跑测试确认 GREEN + 全套无回归**

Run: `node --test tests/auth.test.js` → 全过；`npm test` → 既有 99 + 新增全过；`npm run lint` 干净。

- [ ] **Step 5: Commit**

```bash
git add server/server.js tests/auth.test.js
git commit -m "feat(server): 账号体系——注册继承匿名星空、用户名/邮箱登录、sessions 多设备、改密登出"
```

---

## Task 2: 前端网络层（api.js + data.js）

**Files:**
- Modify: `ui_kits/stellar-raft/api.js`、`ui_kits/stellar-raft/data.js`、`ui_kits/stellar-raft/index.html`（bump 两文件 `?v=`）

**Interfaces:**
- Consumes: Task 1 的 `/api/auth/*`、hello.account。
- Produces: `SRNet.auth.{register,login,logout,changePassword}`（均返回 api() 的 Promise）；`SRNet.adoptSession(token)`（换 token + 清 `sr.galaxy.v1` 镜像）；`SRNet.logoutFlow()`（调 logout → 生成全新匿名 token → 清镜像 → `location.reload()`）；`window.SR_DATA.account` 增加 `registered/username/email/registeredAt`。

- [ ] **Step 1: api.js 增加 auth 域**

在 SRNet 导出对象上追加（对齐文件内现有风格；匿名 token 生成方式抄文件顶部现有代码）：
```js
  auth: {
    register: (p) => api('/api/auth/register', { method: 'POST', body: p }),
    login: (p) => api('/api/auth/login', { method: 'POST', body: p }),
    logout: () => api('/api/auth/logout', { method: 'POST', body: {} }),
    changePassword: (p) => api('/api/auth/password', { method: 'POST', body: p }),
  },
  adoptSession(t) {
    token = t; localStorage.setItem(KEY, t);
    try { localStorage.removeItem(LS_GALAXY); } catch (e) {}   // 关键：清旧镜像，防覆盖新账号数据
  },
  async logoutFlow() {
    try { await this.auth.logout(); } catch (e) {}
    const fresh = /* 与文件顶部匿名 token 生成完全一致的表达式 */;
    token = fresh; localStorage.setItem(KEY, fresh);
    try { localStorage.removeItem(LS_GALAXY); } catch (e) {}
    location.reload();
  },
```
（`token`/`KEY`/`LS_GALAXY` 均是该文件既有闭包变量；`api()` 为既有请求函数。）

- [ ] **Step 2: data.js hello 回填 account**

在 `/api/hello` 的 `.then(r => { ... })` 里追加：
```js
        if (r.account) Object.assign(account, {
          registered: r.account.registered, username: r.account.username,
          email: r.account.email, registeredAt: r.account.registeredAt,
        });
```

- [ ] **Step 3: 验证 + Commit**

babel 编译无关（纯 js），`npm run lint`、`npm test` 全绿；`node -e` 简单 smoke：起 dev server 用 curl 走一遍 register/login（或依赖 Task 1 测试已覆盖，仅确认前端文件语法 `node --check`）。

```bash
git add ui_kits/stellar-raft/api.js ui_kits/stellar-raft/data.js ui_kits/stellar-raft/index.html
git commit -m "feat(api): SRNet.auth 与会话切换/登出流，hello 回填账号态"
```

---

## Task 3: 全屏登录页 LoginView + App 集成

**Files:**
- Create: `ui_kits/stellar-raft/LoginView.jsx`
- Modify: `ui_kits/stellar-raft/app.jsx`、`ui_kits/stellar-raft/index.html`（新增 `<script type="text/babel" src="LoginView.jsx?v=1">` 于 Settings.jsx 行后；bump app.jsx）

**Interfaces:**
- Consumes: `SRNet.auth`、`SRNet.adoptSession`。
- Produces: `window.SRKit.LoginView`，props `{ onClose }`（跳过/Esc 都走它）；app.jsx 内 `openLogin()` 回调（Task 4 的 Settings/Sidebar 用）。

- [ ] **Step 1: LoginView.jsx**

结构（完整实现由实现者按既有组件风格写，要点如下，视觉对齐 Settings/Onboarding 的玻璃语言）：
- `position:fixed inset:0 zIndex:150`，背景 `radial-gradient` 深空 + 十来颗 CSS 星点微闪（参考 Onboarding 的 `.bd` 手法，无需 sr-starfield）。
- 居中 `GlassPanel strong radius="lg" glow`，宽 400：顶部 logo 字「星图」+ 副题「登录你的星空」；双 Tab（登录/注册，样式仿 Settings 左侧导航的选中态即可，横向两枚）。
- 登录表单：`Input`（icon user，placeholder 用户名或邮箱）+ `Input`（icon lock，type password）；注册表单：用户名 / 邮箱（选填）/ 密码 / 确认密码，顶部说明「注册会把当前这片星空收进账号里，换台设备也能回来。」
- 行内错误文案（`var(--danger)` 色，展示服务端 error）；确认密码不一致前端直接提示。
- 提交按钮 `Button primary glow`（提交中禁用 + 文案「正在点亮…」）；成功：`SRNet.adoptSession(r.session); location.reload();`
- 底部 ghost：「暂不登录，先逛逛」→ `onClose()`；Esc 同 onClose；无遮罩点击关闭（全屏页没有遮罩外区域）。
- `useModalFocus` 圈禁焦点（同 Settings 用法）。

- [ ] **Step 2: app.jsx 集成**

```jsx
  const [login, setLogin] = React.useState(false);
  const openLogin = () => setLogin(true);
  const closeLogin = () => { try { localStorage.setItem('sr.login.skipped', '1'); } catch (e) {} setLogin(false); };
  // 首启：水合完成后，服务器确认「未注册」且用户没跳过 → 弹全屏登录页
  React.useEffect(() => {
    const h = () => {
      const A = window.SR_DATA && window.SR_DATA.account;
      let skipped = false; try { skipped = localStorage.getItem('sr.login.skipped') === '1'; } catch (e) {}
      if (A && A.registered === false && !skipped) setLogin(true);
    };
    window.addEventListener('sr-hydrated', h);
    return () => window.removeEventListener('sr-hydrated', h);
  }, []);
```
挂载于 overlay 区：`{login && <LoginView onClose={closeLogin} />}`。
注意：`account.registered === false` 仅在服务器 hello 成功后为 false；后端未运行（undefined）不弹。
⌘K/Esc 守卫按 onboarding 先例把 `login` 加入两个 effect 的条件与依赖数组。

- [ ] **Step 3: 浏览器验证 + Commit**

清 `sr.login.skipped` + 换新匿名 token 刷新 → 全屏登录页出现；注册一个账号 → reload 后直进应用;设置里数据还在（继承验证）。跳过路径、Esc 路径各验一次。

```bash
git add ui_kits/stellar-raft/LoginView.jsx ui_kits/stellar-raft/app.jsx ui_kits/stellar-raft/index.html
git commit -m "feat(login): 全屏登录/注册页——首启引导、跳过记忆、注册继承星空"
```

---

## Task 4: Settings 账户页真实化 + Sidebar 用户 chip

**Files:**
- Modify: `ui_kits/stellar-raft/Settings.jsx`、`ui_kits/stellar-raft/Sidebar.jsx`、`ui_kits/stellar-raft/app.jsx`（传 props）、`ui_kits/stellar-raft/index.html`（bump ×3）

**Interfaces:**
- Consumes: `D.account.{registered,username,email,registeredAt}`、`SRNet.auth.changePassword`、`SRNet.logoutFlow`、app 的 `openLogin`。
- Produces: `Settings` 新 prop `onOpenLogin`；`Sidebar` 新 prop `onOpenLogin`。

- [ ] **Step 1: Settings 账户 tab 双形态**

- 未登录（`!D.account.registered`）：一句说明（「登录后，这片星空会跟着账号走——换台设备也能回来。」）+ `Button primary glow icon="log-in"`「登录 / 注册」→ `onOpenLogin()`（内部先 `onClose()` 关设置再开登录页，由 app 的回调保证）。
- 已登录：SRRow 展示 用户名 / 邮箱（`email || '未绑定'`）/ 注册于（registeredAt 日期部分）；「修改密码」行内展开两个 password Input + 确认按钮 → `SRNet.auth.changePassword({old,new})`，成功 flashToast、失败展示 error；「退出登录」沿用现有 ConfirmDialog 文案改真：onYes → `SRNet.logoutFlow()`。
- 删除 mock 的 `D.account.email/plan` 假字段展示（我的星空/连续点亮两行保留）。

- [ ] **Step 2: Sidebar UserChip 双形态**

`UserChip` 增加 props `{registered, onOpenLogin}`（由 Sidebar 从 `window.SR_DATA.account` 读取传入）：
- 未登录：头像圈显示「旅」，主行「星际旅客」，副行「未登录 · 点击登录」，onClick → `onOpenLogin`。
- 已登录：主行 `account.username || account.name`，副行照旧连续点亮；onClick 照旧 `onOpenSettings`。
Sidebar 接收并透传 `onOpenLogin`（app.jsx 传入）。

- [ ] **Step 3: app.jsx 传 props + 验证 + Commit**

`<Settings … onOpenLogin={() => { setSettingsOpen(false); openLogin(); }} />`；`<Sidebar … onOpenLogin={openLogin} />`。
浏览器验证：未登录 chip 文案与点击、登录后 chip 显示用户名、设置账户页两形态、改密流程、退出登录回匿名。

```bash
git add ui_kits/stellar-raft/Settings.jsx ui_kits/stellar-raft/Sidebar.jsx ui_kits/stellar-raft/app.jsx ui_kits/stellar-raft/index.html
git commit -m "feat(account): 设置账户页真实化（改密/退出），侧栏用户 chip 登录态"
```

---

## Task 5: E2E 浏览器 drive + README

**Files:**
- Modify: `ui_kits/stellar-raft/README.md`（补「账号」一段）

- [ ] **Step 1: CDP 全流程 drive**（控制者执行）
新匿名 profile → 全屏登录页出现 → 注册（带星空数据）→ reload 后直进 + 星空还在 → 设置账户页已登录形态 → 改密 → 退出登录 → 登录页可再登 → 邮箱登录也通。
- [ ] **Step 2: README 补段** + `npm test` 全绿确认。
- [ ] **Step 3: Commit**

---

## Self-Review

- 设计文档 §1–§7 每条均有对应 Task（语义→T3/T4、DB/API→T1、前端网络→T2、UI→T3/T4、测试→T1/T5）✓
- 无占位符；Task 1 代码完整可落；T2–T4 关键片段 + 明确指引 ✓
- 接口一致性：`SRNet.auth.*`/`adoptSession`/`logoutFlow`/`onOpenLogin`/`account.registered` 跨任务同名 ✓
- 关键坑已写入 Global Constraints（镜像清理、鉴权链、失败文案统一）✓
