# 星门 · 账号系统 — 设计文档

> 日期：2026-07-15 · 主题：account-system
> 目标：为星图补全登录/注册账号体系，账号数据入 SQLite；匿名照常可用，
> 注册继承当前星空，独立全屏登录页。

---

## 1. 产品语义（已确认）

- **登录方式**：用户名必填 + 邮箱选填；登录时**用户名或邮箱任一**皆可。
- **匿名照常可用**：不登录也能写笔记（现有体验不破坏）。账号价值 = 数据可跨设备、身份可恢复。
- **注册 = 升级当前匿名账户**：星空/分享/好友/来信全部无缝继承（`users.id` 不变，零数据迁移）。
- **独立全屏登录页**：深空星场 + 居中玻璃卡，登录/注册双 Tab；未登录首次启动展示，
  带「暂不登录，先逛逛」跳过（`localStorage['sr.login.skipped']` 记住，不再打扰）；
  已登录（会话有效）自动直进应用。
- **登录其他账号** → 本浏览器切到该账号星空；**退出登录** → 删会话、回到全新匿名身份。

## 2. 数据库（node:sqlite，零依赖）

- `users` 表**加列**（启动时用 `PRAGMA table_info` 检查缺列再 `ALTER TABLE ADD COLUMN`，兼容既有库）：
  - `username TEXT UNIQUE`（2–24 字符；未注册用户为 NULL）
  - `email TEXT UNIQUE`（可空；仅作登录标识，不验证真实性）
  - `pass TEXT`（格式 `scrypt:<盐hex>:<哈希hex>`）
  - `registered_at TEXT`
- **新表 `sessions`**：
  ```sql
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  一个账号可多设备同时在线（多个 session）。
- **鉴权链**（`tokenOf` 之后的解析）：Bearer token → 先查 `sessions`（登录态，命中即该账号身份，顺手刷 `last_seen`）→ 未命中再查 `users.token`（匿名态，`ensureUser` 自动建档照旧）。现有全部 API 因此自动兼容，无需逐个改。

## 3. 服务端 API（挂在现有 `/api` 分发内）

| 路由 | 请求 | 行为 |
|---|---|---|
| `POST /api/auth/register` | `{username, email?, password}` | 校验：username 2–24 字符且唯一、email（若填）唯一、password ≥ 6。当前身份若为**匿名** user → 原行升级（填 username/email/pass/registered_at）继承全部数据；当前身份已是注册账号 → 409（提示先退出）。成功 → 建 session，返回 `{session, user}` |
| `POST /api/auth/login` | `{id, password}` | `id` 按 username 或 email 查用户；scrypt 重算 + `crypto.timingSafeEqual` 比较；成功建 session 返回 `{session, user}`；失败统一 401「用户名或密码不对」（不区分哪个错） |
| `POST /api/auth/logout` | — | 删当前 session（匿名 token 调用则 no-op 200） |
| `POST /api/auth/password` | `{old, new}` | 仅登录态；验旧密码，写新哈希；其余 session 不失效（本地应用不搞会话风暴） |
| `POST /api/hello`（扩展） | 原样 | 返回增加 `account: {registered, username, email, registeredAt}` |

- 密码哈希：`crypto.scryptSync(pw, salt, 64)`，盐 `crypto.randomBytes(16).toString('hex')`；存 `scrypt:salt:hash`。
- session token：`crypto.randomBytes(24).toString('hex')` 加前缀 `s_`（与匿名 token 可目测区分，逻辑不依赖前缀）。
- 错误返回沿用现有 `json(res, code, {error})` 中文文案风格。

## 4. 前端

### 4.1 `LoginView.jsx`（新文件，注册 `window.SRKit.LoginView`）
- 全屏 overlay（`position:fixed inset:0`，zIndex 高于一切视图、低于 toast）：`<sr-starfield>` 或纯深空渐变背景 + 居中 `GlassPanel`。
- 双 Tab：**登录**（用户名或邮箱 / 密码）、**注册**（用户名 / 邮箱选填 / 密码 / 确认密码）。
- 注册 Tab 顶部一句说明：「注册会把当前这片星空收进账号里，换台设备也能回来。」
- 错误行内提示（红/warm danger 色，来自服务端 error 文案）；提交中按钮 loading 态。
- 底部「暂不登录，先逛逛」ghost 按钮 → 写 `sr.login.skipped=1`，关闭。
- 成功（登录或注册）→ `SRNet.adoptSession(token)`（替换 localStorage token）→ `location.reload()` 全量重水合。
- Esc 不关闭首次强制展示？——**可关**（等同跳过），保持产品不强迫的性格。
- 文案遵守品牌守则（天文台叙述者、「你」、无 emoji）。

### 4.2 `api.js`（SRNet 扩展）
- `SRNet.auth = { register(payload), login(payload), logout(), changePassword(payload) }`——薄封装 `api('/api/auth/…')`。
- `SRNet.adoptSession(newToken)`：写 localStorage KEY 并更新闭包 token。
- `logout()`：调 `/api/auth/logout` 后生成**全新匿名 token** 写回，`location.reload()`。

### 4.3 `app.jsx`
- 新 state `login`（bool）。hello 结果通过 `data.js` 暴露（见 4.5）：`account.registered === false && !localStorage['sr.login.skipped']` → `setLogin(true)`（在 hydration 后判断，避免闪屏）。
- 挂载 `{login && <LoginView onClose={...} />}`；`openLogin` 回调供 Settings/Sidebar 使用。

### 4.4 `Settings.jsx` 账户页改真
- 已登录：显示 username / email（未填显示「未绑定」）/ 注册时间；「修改密码」（旧+新两输入，行内展开）；「退出登录」→ 真实 `SRNet.auth.logout()`（保留现有确认弹层文案风格）。
- 未登录：一句说明 +「登录 / 注册」主按钮 → `onOpenLogin`（App 注入 prop）。
- 删除 mock 的 email/plan 字段渲染（`D.account.email/plan` 若无真实数据不再展示假的）。

### 4.5 `data.js`
- `account` 增加 `registered/username/email/registeredAt` 字段；`/api/hello` 返回后填充并广播（现有 hello 流程内补一行）。

### 4.6 `Sidebar.jsx` 用户 chip
- 未登录：名字显示「星际旅客」、副行「未登录 · 点击登录」，onClick → `onOpenLogin`。
- 已登录：显示 username（或昵称），onClick 照旧打开设置。
- App 给 Sidebar 传 `onOpenLogin`。

## 5. 测试

`tests/auth.test.js`（node --test，仿现有 server 测试模式起真实 server 于随机端口 + 临时 DB）：
1. 注册成功 → 返回 session；旧匿名 token 的星空归属该账号（PUT galaxy 后注册，再用 session GET galaxy 数据在）。
2. 重名注册 409；短密码 400；坏 username 400。
3. 登录：用户名可登、邮箱可登、错密码 401（文案不区分）。
4. session 鉴权：用 session token 调 `/api/hello` 得 registered=true。
5. 改密码：旧错 401；成功后旧密码登不上、新密码能登。
6. 登出：session 失效（再用它调 auth-required 接口 401/匿名化）。
7. 多会话：同一账号两次登录得两个 token，都能用。

## 6. 不做（YAGNI）

邮箱验证、找回密码、OAuth、验证码、多因素、会话过期策略（本地应用暂不设 TTL）、密码强度条。

## 7. 涉及文件

| 文件 | 改动 |
|---|---|
| `server/server.js` | users 加列迁移、sessions 表、鉴权链改造（session 优先）、`/api/auth/*` 四路由、hello 扩展 |
| `ui_kits/stellar-raft/LoginView.jsx` | 新增：全屏登录/注册页 |
| `ui_kits/stellar-raft/api.js` | SRNet.auth / adoptSession / logout 流程 |
| `ui_kits/stellar-raft/app.jsx` | login state、首启判断、挂载、openLogin 下发 |
| `ui_kits/stellar-raft/Settings.jsx` | 账户页真实化（登录态双形态 + 改密 + 真退出） |
| `ui_kits/stellar-raft/Sidebar.jsx` | 用户 chip 双形态 |
| `ui_kits/stellar-raft/data.js` | account 字段扩展（hello 回填） |
| `ui_kits/stellar-raft/index.html` | LoginView 脚本行 + 相关 `?v=` 递增 |
| `tests/auth.test.js` | 新增：auth 全链路 HTTP 测试 |
