/* 星图 Stellar Raft — 本地后端
   Node 内置能力实现，零 npm 依赖：
   - node:sqlite 持久化用户数据（用户 / 星系 / 分享设置 / 访问关系）
   - http 同源托管静态文件 + REST API，前端无需处理 CORS

   分享模型：
   - 每个用户一份星系（整棵 SR_DATA 快照，JSON 存储）
   - 开启分享后获得「星系密文」（分享码）；他人兑换后成为访客
   - 访客能看到的内容由服务端按主人的可见度设置剥离：
       stars   仅星名与星域结构
       outline 星名 + 标签 + 笔记大纲（各级标题），正文永不出库
   - 主人可随时 关闭分享 / 重置密文 / 拉黑某个访客

   启动：node --no-warnings server/server.js   （默认端口 8756） */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 8756);
const ROOT = path.resolve(__dirname, '..');            // stellar-raft/
const APP_DIR = '/ui_kits/stellar-raft/';              // 应用入口（目录式，页面内相对引用才成立）
const DB_PATH = path.join(__dirname, 'stellar.db');

/* ============================ 数据库 ============================ */
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL DEFAULT '旅行者',
    avatar     TEXT NOT NULL DEFAULT '星',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS galaxies (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id),
    data       TEXT NOT NULL,
    version    INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS shares (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id),
    enabled    INTEGER NOT NULL DEFAULT 0,
    code       TEXT UNIQUE,
    visibility TEXT NOT NULL DEFAULT 'outline'
  );
  CREATE TABLE IF NOT EXISTS friendships (
    owner_id  INTEGER NOT NULL,
    viewer_id INTEGER NOT NULL,
    blocked   INTEGER NOT NULL DEFAULT 0,
    added_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (owner_id, viewer_id)
  );
  CREATE TABLE IF NOT EXISTS inbox_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    to_user    INTEGER NOT NULL REFERENCES users(id),
    from_user  INTEGER NOT NULL REFERENCES users(id),
    kind       TEXT NOT NULL,
    payload    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    claimed    INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_audit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id   INTEGER NOT NULL,
    actor_name TEXT NOT NULL,
    action     TEXT NOT NULL,
    target_id  INTEGER,
    target_name TEXT,
    detail     TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 兼容旧库：为已存在的 galaxies 表补 version 列（乐观锁用）。新库已含该列，重复
// 添加会抛错，吞掉即可——绝不改动既有行数据。
try { db.exec('ALTER TABLE galaxies ADD COLUMN version INTEGER NOT NULL DEFAULT 0'); } catch { /* 列已存在 */ }

// 账号体系：既有库平滑加列（ALTER ADD COLUMN 不支持 UNIQUE，唯一性用部分索引兜底）
const ensureColumn = (table, col, ddl) => {
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
  if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
};
ensureColumn('users', 'username', 'username TEXT');
ensureColumn('users', 'email', 'email TEXT');
ensureColumn('users', 'pass', 'pass TEXT');
ensureColumn('users', 'registered_at', 'registered_at TEXT');
ensureColumn('users', 'role', "role TEXT NOT NULL DEFAULT 'user'");   // 'admin' | 'user'
ensureColumn('users', 'banned', 'banned INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'ban_reason', 'ban_reason TEXT');
ensureColumn('users', 'last_seen', 'last_seen TEXT');                 // 任一 API 触达即刷新（按天粒度算活跃）
ensureColumn('users', 'ip', 'ip TEXT');                               // 建档时的来源 IP（游客限额按它算）
ensureColumn('users', 'last_ip', 'last_ip TEXT');
ensureColumn('users', 'last_login', 'last_login TEXT');               // 最近一次密码登录成功的时刻
ensureColumn('friendships', 'last_visit', 'last_visit TEXT');   // 访客足迹：这位访客上次造访的时刻
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

const q = {
  userByToken: db.prepare('SELECT * FROM users WHERE token = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (token, name, avatar) VALUES (?, ?, ?)'),
  updateUser: db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?'),
  getGalaxy: db.prepare('SELECT data, updated_at, version FROM galaxies WHERE user_id = ?'),
  putGalaxy: db.prepare(`INSERT INTO galaxies (user_id, data, version, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at`),
  getShare: db.prepare('SELECT * FROM shares WHERE user_id = ?'),
  shareByCode: db.prepare('SELECT * FROM shares WHERE code = ?'),
  upsertShare: db.prepare(`INSERT INTO shares (user_id, enabled, code, visibility) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, code = excluded.code, visibility = excluded.visibility`),
  addFriend: db.prepare('INSERT OR IGNORE INTO friendships (owner_id, viewer_id) VALUES (?, ?)'),
  removeFriend: db.prepare('DELETE FROM friendships WHERE owner_id = ? AND viewer_id = ?'),
  friendship: db.prepare('SELECT * FROM friendships WHERE owner_id = ? AND viewer_id = ?'),
  friendsOf: db.prepare(`SELECT u.id, u.name, u.avatar, f.blocked, f.added_at FROM friendships f
    JOIN users u ON u.id = f.owner_id WHERE f.viewer_id = ?`),
  visitorsOf: db.prepare(`SELECT u.id, u.name, u.avatar, f.blocked, f.added_at, f.last_visit FROM friendships f
    JOIN users u ON u.id = f.viewer_id WHERE f.owner_id = ?`),
  setBlocked: db.prepare('UPDATE friendships SET blocked = ? WHERE owner_id = ? AND viewer_id = ?'),
  touchVisit: db.prepare(`UPDATE friendships SET last_visit = datetime('now') WHERE owner_id = ? AND viewer_id = ?`),
  inboxInsert: db.prepare('INSERT INTO inbox_messages (to_user, from_user, kind, payload) VALUES (?, ?, ?, ?)'),
  inboxList: db.prepare('SELECT * FROM inbox_messages WHERE to_user = ? ORDER BY id DESC'),
  inboxById: db.prepare('SELECT * FROM inbox_messages WHERE id = ?'),
  inboxUnclaimed: db.prepare('SELECT * FROM inbox_messages WHERE to_user = ? AND from_user = ? AND kind = ? AND claimed = 0 ORDER BY id DESC'),
  inboxClaim: db.prepare('UPDATE inbox_messages SET claimed = 1 WHERE id = ?'),
  inboxDelete: db.prepare('DELETE FROM inbox_messages WHERE id = ?'),
  metaGet: db.prepare('SELECT value FROM meta WHERE key = ?'),
  metaSet: db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)'),
  metaDel: db.prepare('DELETE FROM meta WHERE key = ?'),
  sessionByToken: db.prepare('SELECT * FROM sessions WHERE token = ?'),
  insertSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
  touchSession: db.prepare("UPDATE sessions SET last_seen = datetime('now') WHERE token = ?"),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  registerUser: db.prepare("UPDATE users SET username = ?, email = ?, pass = ?, registered_at = datetime('now') WHERE id = ?"),
  setPass: db.prepare('UPDATE users SET pass = ? WHERE id = ?'),
  setEmail: db.prepare('UPDATE users SET email = ? WHERE id = ?'),

  /* ——— IP 与登录足迹 ——— */
  insertUserIp: db.prepare('INSERT INTO users (token, name, avatar, ip, last_ip) VALUES (?, ?, ?, ?, ?)'),
  countGuestsAtIp: db.prepare('SELECT COUNT(*) AS n FROM users WHERE ip = ? AND username IS NULL'),
  guestsAtIp: db.prepare('SELECT * FROM users WHERE ip = ? AND username IS NULL ORDER BY id ASC'),
  touchLogin: db.prepare("UPDATE users SET last_login = datetime('now'), last_ip = ? WHERE id = ?"),
  touchIp: db.prepare('UPDATE users SET last_ip = ? WHERE id = ?'),

  /* ——— 管理台 ——— */
  touchUserSeen: db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?"),
  allUsers: db.prepare('SELECT * FROM users ORDER BY id ASC'),
  countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
  countAdmins: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
  setRole: db.prepare('UPDATE users SET role = ? WHERE id = ?'),
  setBan: db.prepare('UPDATE users SET banned = ?, ban_reason = ? WHERE id = ?'),
  setName: db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?'),
  setUsername: db.prepare('UPDATE users SET username = ? WHERE id = ?'),
  sessionsOf: db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY last_seen DESC'),
  allSessions: db.prepare(`SELECT s.token, s.user_id, s.created_at, s.last_seen, u.name, u.username, u.avatar, u.role, u.last_ip
    FROM sessions s JOIN users u ON u.id = s.user_id ORDER BY s.last_seen DESC LIMIT 200`),
  // 趋势按天分桶要数全量登录，不能用上面那条带 LIMIT 的
  sessionTimes: db.prepare('SELECT created_at FROM sessions'),
  countSessionsOf: db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?'),
  dropSessionsOf: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  allShares: db.prepare('SELECT * FROM shares WHERE code IS NOT NULL'),
  countVisitorsOf: db.prepare('SELECT COUNT(*) AS n FROM friendships WHERE owner_id = ?'),
  countMailTo: db.prepare('SELECT COUNT(*) AS n FROM inbox_messages WHERE to_user = ?'),
  countAllMail: db.prepare('SELECT COUNT(*) AS n FROM inbox_messages'),
  countFriendships: db.prepare('SELECT COUNT(*) AS n FROM friendships'),
  // 删号级联：星系 / 分享 / 双向好友 / 收发件 / 会话，一并清干净
  dropGalaxyOf: db.prepare('DELETE FROM galaxies WHERE user_id = ?'),
  dropShareOf: db.prepare('DELETE FROM shares WHERE user_id = ?'),
  dropFriendshipsOf: db.prepare('DELETE FROM friendships WHERE owner_id = ? OR viewer_id = ?'),
  dropMailOf: db.prepare('DELETE FROM inbox_messages WHERE to_user = ? OR from_user = ?'),
  dropUser: db.prepare('DELETE FROM users WHERE id = ?'),
  auditInsert: db.prepare('INSERT INTO admin_audit (actor_id, actor_name, action, target_id, target_name, detail) VALUES (?, ?, ?, ?, ?, ?)'),
  auditList: db.prepare('SELECT * FROM admin_audit ORDER BY id DESC LIMIT ?'),
  auditPrune: db.prepare('DELETE FROM admin_audit WHERE id <= (SELECT MAX(id) - ? FROM admin_audit)'),
};

/* ============================ 工具 ============================ */
// 分享码：星语前缀 + 去歧义字母表（无 0/O/1/I）。生成时校验唯一，避免撞码
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => {
  const part = (n) => Array.from(crypto.randomBytes(n)).map(b => CODE_ALPHA[b % CODE_ALPHA.length]).join('');
  for (let i = 0; i < 8; i++) {
    const code = `XING-${part(4)}-${part(4)}`;
    if (!q.shareByCode.get(code)) return code;
  }
  return `XING-${part(6)}-${part(6)}`;
};

/* 来源 IP。默认只信 socket 地址；放在 nginx / Caddy 之类反代后面时用
   SR_TRUST_PROXY=1 打开 X-Forwarded-For 的第一跳——不开的话所有人都会是
   127.0.0.1，游客限额会把整台服务器锁成一个游客。 */
const TRUST_PROXY = process.env.SR_TRUST_PROXY === '1';
const normIp = (s) => String(s || '').replace(/^::ffff:/, '').trim();
const clientIp = (req) => {
  if (TRUST_PROXY) {
    const first = String(req.headers['x-forwarded-for'] || '').split(',')[0];
    if (normIp(first)) return normIp(first).slice(0, 64);
  }
  return normIp(req.socket && req.socket.remoteAddress).slice(0, 64) || 'unknown';
};

/* 建档（匿名游客）。每个 IP 只允许存在一个尚未注册的游客账号——
   限额由站点设置 guestPerIp 决定（0 = 不限）。注册之后 username 不再为 NULL，
   这个 IP 的名额随即释放，所以规则的实际效果是「想再要一片新星空，就去注册」。
   返回 { user } 或 { error }：超限时由调用方回 403，前端据此弹登录页。 */
const ensureUser = (token, name, avatar, ip, skipLimit) => {
  let u = q.userByToken.get(token);
  if (u) {
    if (ip && u.last_ip !== ip) q.touchIp.run(ip, u.id);
    return { user: u };
  }
  const limit = skipLimit ? 0 : Number(siteGet().guestPerIp);
  if (limit > 0 && ip && q.countGuestsAtIp.get(ip).n >= limit) {
    return { error: '这个网络上已经有一位游客了 —— 登录或注册一个账号，就能拥有自己的星空。', code: 'guest_limit' };
  }
  q.insertUserIp.run(token, (name || '旅行者').slice(0, 24), (avatar || '星').slice(0, 2), ip || null, ip || null);
  u = q.userByToken.get(token);
  maybeSeedWelcomeInbox(u); // 新装 DB 的第一位旅行者：收件箱里预置两封「星际来信」
  return { user: u };
};

/* ——— 账号体系：密码哈希 / 会话 ——— */
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
  username: u.username || null, email: u.email || null, registeredAt: u.registered_at || null,
  role: u.role || 'user', admin: (u.role || 'user') === 'admin',
  banned: !!u.banned, banReason: u.ban_reason || null });

/* ——— 站点设置（meta 表里的 JSON 单例）———
   公告 · 注册开关 · 维护模式：管理台改，普通用户在 /api/hello 拿到只读快照 */
const SITE_DEFAULT = {
  announcement: { text: '', tone: 'info', enabled: false, updatedAt: null },  // tone: info | warn | danger
  registrationOpen: true,
  maintenance: { enabled: false, message: '星图正在维护，稍后回来看看。' },
  // 每个 IP 允许的匿名游客账号数（0 = 不限）。初值可用 SR_GUEST_PER_IP 覆盖，
  // 之后以管理台里的设置为准——校园网这类大 NAT 出口下可以调高或关掉
  guestPerIp: process.env.SR_GUEST_PER_IP != null ? Math.max(0, Number(process.env.SR_GUEST_PER_IP) || 0) : 1,
  /* 功能门禁：true = 这项功能需要账号，游客点了会被请去登录。
     share / visit 由服务端硬拦（下面的 needAccount），editor / vault 没有专属
     接口，是前端门禁——诚实地说，它们拦的是入口而不是数据通道。
     初值可用 SR_GUEST_GATES=off 整体关掉（等同于管理台里把四项都关上）。 */
  guestGates: (() => {
    const off = ['0', 'off', 'false'].includes(String(process.env.SR_GUEST_GATES || '').toLowerCase());
    return { editor: !off, share: !off, visit: !off, vault: !off };
  })(),
};
const siteGet = () => {
  try { return { ...SITE_DEFAULT, ...JSON.parse(q.metaGet.get('site_config').value) }; }
  catch { return { ...SITE_DEFAULT }; }
};
const siteSet = (patch) => {
  const cur = siteGet();
  // guestGates 是逐项开关，只改其中一项时不该把其余项抹回默认值
  const next = { ...cur, ...patch, guestGates: { ...cur.guestGates, ...(patch.guestGates || {}) } };
  q.metaSet.run('site_config', JSON.stringify(next));
  return next;
};

/* ——— 默认管理员 ———
   首次启动建一个可直接登录的管理员账号（用户名 admin / 密码 stellar-admin，
   可用 SR_ADMIN_USER、SR_ADMIN_PASS 覆盖）。用的是默认密码时打上
   default_pass 标记，管理台顶部会一直挂着「请尽快改密」的红条，直到改掉为止。
   只种一次：种过之后即便管理员被删也不再自动重建（避免删号后幽灵复活）。 */
const ADMIN_USER = String(process.env.SR_ADMIN_USER || 'admin');
const ADMIN_PASS = String(process.env.SR_ADMIN_PASS || 'stellar-admin');
const ADMIN_IS_DEFAULT = !process.env.SR_ADMIN_PASS;
const seedAdmin = () => {
  if (q.metaGet.get('admin_seeded')) return null;
  q.metaSet.run('admin_seeded', '1');
  if (q.userByUsername.get(ADMIN_USER)) return null;   // 同名账号已存在：不覆盖任何人的密码
  const token = 'admin-' + crypto.randomBytes(12).toString('hex');
  q.insertUser.run(token, '星港管理员', '港');
  const u = q.userByToken.get(token);
  q.registerUser.run(ADMIN_USER, null, hashPass(ADMIN_PASS), u.id);
  q.setRole.run('admin', u.id);
  if (ADMIN_IS_DEFAULT) q.metaSet.run('admin_default_pass', '1');
  return { username: ADMIN_USER, password: ADMIN_PASS, id: u.id };
};

const adminDefaultPass = () => !!q.metaGet.get('admin_default_pass');
const clearAdminDefaultPass = () => q.metaDel.run('admin_default_pass');

// 审计：每次写操作留痕，管理台「操作日志」页倒序读。保留最近 2000 条
const audit = (actor, action, target, detail) => {
  q.auditInsert.run(actor.id, actor.username || actor.name || ('#' + actor.id), action,
    target ? target.id : null, target ? (target.username || target.name || ('#' + target.id)) : null,
    String(detail || ''));
  if (Math.random() < 0.05) { try { q.auditPrune.run(2000); } catch { /* 日志尚不足 2000 条 */ } }
};

const shareOf = (userId) => {
  const s = q.getShare.get(userId);
  return s || { user_id: userId, enabled: 0, code: null, visibility: 'outline' };
};

// sqlite 的 datetime('now') 是不带时区标记的 UTC，补 Z 才不会被当成本地时间
const sqlTs = (s) => (s ? Date.parse(String(s).replace(' ', 'T') + 'Z') || 0 : 0);

const stripHtml = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/* ——— 星际收件箱（好友互寄）工具 ———
   一切进 payload 的文本都先剥 HTML 再钳长度：label 120 · summary 2000 ·
   keyPoints 每条 300 且至多 12 条。keyPoints 沿用访客视图的大纲提取口径
   （只取 h1/h2/h3 标题），正文与富文本永不进收件箱。 */
const INBOX_LIM = { label: 120, summary: 2000, keyPoint: 300, keyPoints: 12 };
const cleanText = (v, max) => stripHtml(v).replace(/\s+/g, ' ').trim().slice(0, max);
const outlinePoints = (star) => (star.body || [])
  .filter(b => b && ['h1', 'h2', 'h3'].includes(b.type))
  .map(b => cleanText(b.text, INBOX_LIM.keyPoint))
  .filter(Boolean)
  .slice(0, INBOX_LIM.keyPoints);

// 好友关系（任一方向的 friendships 行即算好友）；任一方向被拉黑 → 两个方向都投递不进
const relationOf = (a, b) => {
  const f1 = q.friendship.get(a, b);
  const f2 = q.friendship.get(b, a);
  return { friends: !!(f1 || f2), blocked: !!((f1 && f1.blocked) || (f2 && f2.blocked)) };
};

// 速率：send / collect 共享一个桶，每用户每分钟 ≤ 20 条（只统计真正入库的投递）
const RATE = { limit: 20, windowMs: 60000 };
const rateBuckets = new Map();
const rateHit = (userId) => {
  const now = Date.now();
  let arr = rateBuckets.get(userId);
  if (!arr) { arr = []; rateBuckets.set(userId, arr); }
  while (arr.length && now - arr[0] > RATE.windowMs) arr.shift();
  if (arr.length >= RATE.limit) return false;
  arr.push(now);
  return true;
};

// 出库形态：payload 反序列化 + 寄件人公开信息（绝不带 token）
const pubMsg = (m) => {
  const fu = q.userById.get(m.from_user);
  let payload; try { payload = JSON.parse(m.payload); } catch { payload = {}; }
  return {
    id: m.id, kind: m.kind,
    from: fu ? { id: fu.id, name: fu.name, avatar: fu.avatar } : { id: m.from_user, name: '旅行者', avatar: '星' },
    payload, at: m.created_at, claimed: !!m.claimed,
  };
};

// 从某用户的星系快照里按 id 找星（快照损坏按找不到计）
const starInGalaxyOf = (userId, starId) => {
  if (!starId) return null;
  const g = q.getGalaxy.get(userId);
  try { return ((JSON.parse(g ? g.data : '{}').stars) || []).find(x => x && x.id === starId) || null; }
  catch { return null; }
};

/* 投递（send / collect 共用）：
   ① 防重复 —— 同 (to, from, kind, starId) 已有未领取消息时幂等返回既有消息，不重复入库
   ② 速率 —— 只有真正入库才消耗投递者（actor）的配额 */
const deliver = (res, actorId, fromId, toId, kind, starId, payload) => {
  // 星语允许多句并存，但同一寄件人的未读星语封顶 5 句——防刷屏也防骚扰
  if (kind === 'note') {
    if (q.inboxUnclaimed.all(toId, fromId, 'note').length >= 5) {
      return json(res, 429, { error: '对方还有几句你的星语没读，稍后再寄' });
    }
  } else {
    const dup = q.inboxUnclaimed.all(toId, fromId, kind).find(m => {
      if (kind !== 'star') return true;
      try { return JSON.parse(m.payload).starId === starId; } catch { return false; }
    });
    if (dup) return json(res, 200, { ok: true, duplicate: true, message: pubMsg(dup) });
  }
  if (!rateHit(actorId)) return json(res, 429, { error: '来信太频繁，请稍后再寄' });
  const info = q.inboxInsert.run(toId, fromId, kind, JSON.stringify(payload));
  return json(res, 200, { ok: true, message: pubMsg(q.inboxById.get(Number(info.lastInsertRowid))) });
};

/* 记忆衰减（FSRS-lite，与 ui_kits/stellar-raft/data.js 同参）：
   R = exp(−Δt天 / S)，clamp 到 [rMin, rMax] 后保留三位小数。
   访客视图出库时按快照里的 sr = { S, last } 实时重算亮度 —— 主人几天不回来，
   访客看到的星也一样变暗。sr.due 只影响复习队列时刻，不影响显示强度，故不参与。
   无 sr 的旧星（或字段残缺）保持快照静态 strength 原样。
   emberR = 熄灭阈值：已点亮星（sr.lit>0）实时 R 衰减到 0.35 以下，访客视角即判「待重燃」——
   主人几天不回来，访客看到的不只是变暗，还有熄灭，与主人视角同一世界观。 */
const DAY = 86400000;
const MEM = { rMin: 0.02, rMax: 0.98, emberR: 0.35 };
const decayedStrength = (s, now) => {
  const sr = s.sr;
  if (!sr || !(Number(sr.S) > 0) || !Number(sr.last)) return s.strength;
  const r = Math.exp(-Math.max(0, now - sr.last) / DAY / sr.S);
  return Math.round(Math.min(MEM.rMax, Math.max(MEM.rMin, r)) * 1000) / 1000;
};
// 认证态透传（只出布尔，绝不泄露 lit/ember 时间戳）：
//   lit   = sr.lit>0 且衰减后 R ≥ emberR（快照写入后主人再没回来，也会在访客视角实时熄灭）
//   ember = (sr.ember>0 ∧ lit=0) ∨ (sr.lit>0 ∧ 衰减后 R < emberR)
const litFlags = (s, strength) => {
  const sr = s.sr || {};
  const wasLit = Number(sr.lit) > 0;
  const r = Number(strength);
  return {
    lit: wasLit && r >= MEM.emberR,
    ember: (Number(sr.ember) > 0 && !wasLit) || (wasLit && r < MEM.emberR),
  };
};

// 访客视图在服务端生成：正文、摘要、属性、关系语句一律不出库
const sanitizeGalaxy = (raw, visibility) => {
  let d; try { d = JSON.parse(raw); } catch { return null; }
  const now = Date.now();
  const outline = visibility === 'outline';
  const stars = (d.stars || []).map(s => {
    const strength = decayedStrength(s, now);
    const flags = litFlags(s, strength);
    return {
      id: s.id, con: s.con, x: s.x, y: s.y,
      strength, importance: s.importance, label: cleanText(s.label, 120),
      lit: flags.lit, ember: flags.ember,
      tags: outline ? (s.tags || []) : [],
      outline: outline
        ? (s.body || []).filter(b => ['h1', 'h2', 'h3'].includes(b.type)).map(b => ({ type: b.type, text: stripHtml(b.text).slice(0, 120) }))
        : [],
    };
  });
  return {
    visibility,
    // 星域 health / count / litRatio 不透传快照静态值：按衰减后的成员强度实时重算，
    // 与前端 data.js 的 syncCounts 同口径（health = 均值 / count = 现存成员数 /
    // litRatio = 已点亮成员占比，访客端按实时熄灭后的 lit 布尔计）
    constellations: (d.constellations || []).map(c => {
      const members = stars.filter(s => s.con === c.id);
      const health = members.length
        ? Math.round(members.reduce((a, s) => a + (Number(s.strength) || 0), 0) / members.length * 1000) / 1000
        : 0;
      const litRatio = members.length
        ? Math.round(members.filter(s => s.lit).length / members.length * 1000) / 1000
        : 0;
      return { id: c.id, name: cleanText(c.name, 60), color: c.color, health, count: members.length, litRatio };
    }),
    stars,
    connections: (d.connections || []).map(c => ({ a: c.a, b: c.b, kind: c.kind })),
  };
};

/* ============================ 演示好友 ============================
   首次启动种一位开着分享的演示用户，前端拿固定密文即可体验访问流程 */
const DEMO_CODE = 'XING-DEMO-2333';
(function seedDemo() {
  if (q.userByToken.get('demo-friend-token')) return;
  q.insertUser.run('demo-friend-token', '星图伙伴', '星');
  const u = q.userByToken.get('demo-friend-token');
  const mk = (id, con, x, y, t, label, heads) => ({
    id, con, x, y, strength: t, importance: 1, label,
    tags: ['概念'], summary: '（演示星系）',
    body: heads.map((h, i) => ({ id: id + '-h' + i, type: i === 0 ? 'h2' : 'h3', text: h })),
  });
  const galaxy = {
    constellations: [
      { id: 'astro', name: '天体物理', color: '#ffd98a', health: 0.8, count: 3 },
      { id: 'ml', name: '机器学习', color: '#9fc6ff', health: 0.5, count: 3 },
    ],
    stars: [
      mk('d1', 'astro', 24, 30, 0.9, '钱德拉塞卡极限', ['白矮星的质量上限', '电子简并压', '超新星的引信']),
      mk('d2', 'astro', 34, 48, 0.62, '哈勃定律', ['退行速度与距离', '宇宙膨胀']),
      mk('d3', 'astro', 18, 55, 0.4, '史瓦西半径', ['事件视界', '逃逸速度推导']),
      mk('d4', 'ml', 66, 34, 0.75, '反向传播', ['链式法则', '梯度消失', '计算图']),
      mk('d5', 'ml', 76, 52, 0.5, '注意力机制', ['QKV', '为什么是点积']),
      mk('d6', 'ml', 58, 58, 0.3, '正则化', ['L1 与稀疏性', 'Dropout 的集成视角']),
    ],
    connections: [
      { a: 'd1', b: 'd3', kind: 'intra', rel: '同属致密天体' },
      { a: 'd4', b: 'd5', kind: 'intra', rel: '是其基础' },
      { a: 'd2', b: 'd4', kind: 'cross', rel: '数据拟合的共同思想' },
    ],
    notes: [], inbox: [], timeline: [], trash: [],
    account: { name: '星图伙伴', avatar: '星' },
  };
  q.putGalaxy.run(u.id, JSON.stringify(galaxy), 1);
  q.upsertShare.run(u.id, 1, DEMO_CODE, 'outline');
  // 新装 DB 一次性标记：第一位建档的旅行者会收到两封演示「星际来信」
  q.metaSet.run('welcome_inbox_pending', '1');
  console.log('[seed] 演示好友「星图伙伴」已就绪，分享码', DEMO_CODE);
})();

/* 默认管理员入户：新装 DB 首次启动时建号并把凭据打在控制台上（只此一次） */
(function announceAdmin() {
  const a = seedAdmin();
  if (!a) return;
  console.log('');
  console.log('  ┌─ 星港管理员已入户 ───────────────────────────────');
  console.log('  │  用户名   ' + a.username);
  console.log('  │  密码     ' + a.password + (ADMIN_IS_DEFAULT ? '   ← 默认密码，登录后请尽快修改' : ''));
  console.log('  │  登录后侧边栏底部出现「星港管理台」入口');
  console.log('  └──────────────────────────────────────────────────');
  console.log('');
})();

/* 星际来信种子：仅在「新装 DB 种子」标记尚未消费时，给第一位真实用户的收件箱
   预置一封 kind:'galaxy'（造访邀请）与一封 kind:'star'（赠星），寄件人都是演示
   好友「星图伙伴」——新用户第一次打开收件箱就能看到来信长什么样。 */
const maybeSeedWelcomeInbox = (user) => {
  if (!user || user.token === 'demo-friend-token') return;
  if (!q.metaGet.get('welcome_inbox_pending')) return;
  q.metaDel.run('welcome_inbox_pending');
  const demo = q.userByToken.get('demo-friend-token');
  if (!demo) return;
  const star = starInGalaxyOf(demo.id, 'd1');
  q.inboxInsert.run(user.id, demo.id, 'galaxy', JSON.stringify({
    code: DEMO_CODE,
    galaxyName: '星图伙伴的星系',
    starCount: (() => { try { return (JSON.parse(q.getGalaxy.get(demo.id).data).stars || []).length; } catch { return 0; } })(),
  }));
  if (star) {
    q.inboxInsert.run(user.id, demo.id, 'star', JSON.stringify({
      starId: star.id,
      label: cleanText(star.label, INBOX_LIM.label),
      summary: cleanText(star.summary, INBOX_LIM.summary),
      keyPoints: outlinePoints(star),
    }));
  }
};

/* ============================ 运行指标 ============================ */
// 进程级轻量计数（重启归零，不落盘）：管理台「系统」页的实时读数
const METRICS = { startedAt: Date.now(), requests: 0, apiRequests: 0, errors: 0 };

/* ============================ API ============================ */
const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
};

const readBody = (req) => new Promise((resolve, reject) => {
  let buf = '';
  req.on('data', (c) => { buf += c; if (buf.length > 8 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); } });
  req.on('end', () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { reject(e); } });
  req.on('error', reject);
});

const tokenOf = (req, url) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return url.searchParams.get('token') || '';
};

async function handleApi(req, res, url) {
  const seg = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const token = tokenOf(req, url);
  if (!token) return json(res, 401, { error: '缺少访问令牌' });
  let body = {};
  if (req.method === 'POST' || req.method === 'PUT') {
    try { body = await readBody(req); } catch { return json(res, 400, { error: '请求体格式错误' }); }
  }
  const ip = clientIp(req);

  /* ——— 登录 / 退出：先于身份解析 ———
     这两件事都不需要知道「当前是谁」：登录靠用户名密码认人，退出只认令牌本身。
     放在最前面顺手解开三个死结：维护期间管理员仍然登得进来；被停用的人还能干净
     地离开；游客名额已满的 IP 上，人依然能登录——那正是我们请他去做的事。 */
  if (seg[1] === 'auth' && seg[2] === 'login' && req.method === 'POST') {
    const idf = String(body.id || '').trim();
    const u = q.userByUsername.get(idf) || q.userByEmail.get(idf);
    if (!u || !u.pass || !checkPass(String(body.password || ''), u.pass)) return json(res, 401, { error: '用户名或密码不对' });
    if (u.banned) return json(res, 403, { error: u.ban_reason || '这个账号已被管理员停用', banned: true });
    q.touchLogin.run(ip, u.id);   // 登录足迹：管理台「最近登录」与用户详情里的真实来源
    q.touchUserSeen.run(u.id);
    return json(res, 200, { session: newSession(u.id), user: pubAccount(u) });
  }
  if (seg[1] === 'auth' && seg[2] === 'logout' && req.method === 'POST') {
    q.deleteSession.run(token);
    return json(res, 200, { ok: true });
  }

  // 鉴权链：session 优先（登录态），未命中退回匿名 token 建档
  const sess = q.sessionByToken.get(token);
  let me;
  if (sess) {
    me = q.userById.get(sess.user_id);
    q.touchSession.run(token);
    if (me && me.last_ip !== ip) q.touchIp.run(ip, me.id);
  } else {
    // 注册豁免限额：注册的下一步就是 username 落地，这一行马上不再算游客——
    // 名额已满时更要放行，否则「请去注册」就成了一句做不到的话
    const registering = seg[1] === 'auth' && seg[2] === 'register' && req.method === 'POST';
    const r = ensureUser(token, body.name, body.avatar, ip, registering);
    if (r.error) return json(res, 403, { error: r.error, guestLimit: true });
    me = r.user;
  }
  if (!me) return json(res, 401, { error: '会话已失效，请重新登录' });   // session 指向已被删除的账号
  q.touchUserSeen.run(me.id);
  const isAdmin = (me.role || 'user') === 'admin';

  // 封禁：除登录/退出外一律拒绝，前端据 403 + banned 标志切封禁提示页
  if (me.banned) {
    return json(res, 403, { error: me.ban_reason || '这个账号已被管理员停用', banned: true, banReason: me.ban_reason || null });
  }
  // 维护模式：管理员照常通行，其余只读到一句说明
  const site = siteGet();
  if (site.maintenance.enabled && !isAdmin) {
    return json(res, 503, { error: site.maintenance.message || '星图正在维护', maintenance: true });
  }

  /* 功能门禁：分享与造访这类「牵扯到别人」的能力要求先有账号。
     判据是 me.username（注册过）而非 session——同一行用户升级成账号后，
     它原来的匿名令牌也算数，不必强迫人重新登录一次。

     返回 true = 已经替你应答完毕，调用方必须立刻 return。
     （json() 本身不返回值，所以这里不能写成 `return json(...)` 交给调用方转发——
     那会让调用方拿到 undefined 继续往下走，把同一个响应写第二遍。） */
  const needAccount = (feature) => {
    if (me.username) return false;
    if (!site.guestGates[feature]) return false;
    json(res, 403, {
      error: '这项功能需要一个账号 —— 注册后星空会原地跟着你走，换台设备也能回来。',
      needAccount: true, feature,
    });
    return true;
  };

  // ——— 账号体系 ———
  if (seg[1] === 'auth' && seg[2] === 'register' && req.method === 'POST') {
    if (me.username) return json(res, 409, { error: '当前已登录账号，如需另建请先退出' });
    if (!site.registrationOpen) return json(res, 403, { error: '星港暂时关闭了新账号注册' });
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!/^[\w一-龥-]{2,24}$/.test(username)) return json(res, 400, { error: '用户名需 2–24 个字符（中英文、数字、_ 或 -）' });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: '邮箱格式不对' });
    if (password.length < 6) return json(res, 400, { error: '密码至少 6 位' });
    if (q.userByUsername.get(username)) return json(res, 409, { error: '这个用户名已经有主人了' });
    if (email && q.userByEmail.get(email)) return json(res, 409, { error: '这个邮箱已经绑定过账号' });
    try { q.registerUser.run(username, email || null, hashPass(password), me.id); }
    catch { return json(res, 409, { error: '用户名或邮箱刚被占用，换一个试试' }); }   // 并发窗口撞唯一索引
    const session = newSession(me.id);
    return json(res, 200, { session, user: pubAccount(q.userById.get(me.id)) });
  }
  if (seg[1] === 'auth' && seg[2] === 'password' && req.method === 'POST') {
    // 改密仅认「登录态」（有效 session）：即便某个匿名 token 恰好是某个已注册账号
    // 升级前的原始 token（同一行、未失效），未经会话鉴权也不当作登录态放行
    if (!sess || !me.username || !me.pass) return json(res, 401, { error: '尚未登录账号' });
    if (!checkPass(String(body.old || ''), me.pass)) return json(res, 401, { error: '旧密码不对' });
    if (String(body.new || '').length < 6) return json(res, 400, { error: '新密码至少 6 位' });
    q.setPass.run(hashPass(String(body.new)), me.id);
    // 管理员改掉出厂密码 → 摘掉管理台顶部那条「仍在用默认密码」的警告
    if (isAdmin && me.username === ADMIN_USER) clearAdminDefaultPass();
    return json(res, 200, { ok: true });
  }
  // 绑定 / 修改邮箱：仅登录态，验密码；改成自己当前邮箱视为幂等成功
  if (seg[1] === 'auth' && seg[2] === 'email' && req.method === 'POST') {
    if (!sess || !me.username || !me.pass) return json(res, 401, { error: '尚未登录账号' });
    if (!checkPass(String(body.password || ''), me.pass)) return json(res, 401, { error: '密码不对' });
    const email = String(body.email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: '邮箱格式不对' });
    const holder = q.userByEmail.get(email);
    if (holder && holder.id !== me.id) return json(res, 409, { error: '这个邮箱已经绑定过账号' });
    try { q.setEmail.run(email, me.id); }
    catch { return json(res, 409, { error: '这个邮箱刚被占用，换一个试试' }); }
    return json(res, 200, { ok: true, user: pubAccount(q.userById.get(me.id)) });
  }

  // POST /api/hello — 建档/取回身份与分享状态
  if (seg[1] === 'hello' && req.method === 'POST') {
    if (body.name && body.name !== me.name) { q.updateUser.run(String(body.name).slice(0, 24), String(body.avatar || me.avatar).slice(0, 2), me.id); }
    const u = q.userById.get(me.id);
    // site：公告随每次握手下发（普通用户只读）；管理员另带一条「默认密码未改」提醒
    // gates 只对游客有意义：已注册的账号一律拿到全开的门禁表，前端不必再判身份
    const gates = u.username ? { editor: false, share: false, visit: false, vault: false } : { ...site.guestGates };
    const pubSite = {
      announcement: site.announcement.enabled ? site.announcement : null,
      registrationOpen: site.registrationOpen,
      gates,
    };
    if ((u.role || 'user') === 'admin') pubSite.defaultPass = adminDefaultPass();
    return json(res, 200, { user: { id: u.id, name: u.name, avatar: u.avatar }, share: pubShare(shareOf(u.id)), hasGalaxy: !!q.getGalaxy.get(u.id), account: pubAccount(u), site: pubSite });
  }

  // GET/PUT /api/galaxy — 自己的星系整存整取
  if (seg[1] === 'galaxy' && seg.length === 2) {
    if (req.method === 'GET') {
      const g = q.getGalaxy.get(me.id);
      // updatedAt（UTC）：前端启动时与 localStorage 镜像比对，新者优先；version 供乐观锁
      return json(res, 200, { data: g ? JSON.parse(g.data) : null, updatedAt: g ? g.updated_at : null, version: g ? (g.version || 0) : 0 });
    }
    if (req.method === 'PUT') {
      if (!body.data) return json(res, 400, { error: '缺少 data' });
      if (!Array.isArray(body.data.stars)) return json(res, 400, { error: 'data.stars 必须是数组' });
      const cur = q.getGalaxy.get(me.id);
      const curVer = cur ? (cur.version || 0) : 0;
      // 乐观锁：带 baseVersion 且与服务器当前版本不一致 → 409，把服务器最新版回给客户端合并，
      // 避免后保存者整棵星系覆盖前保存者的全部改动。beacon / 无 baseVersion 不校验（末发兜底）。
      if (body.baseVersion != null && cur && Number(body.baseVersion) !== curVer) {
        return json(res, 409, { error: 'version_conflict', data: JSON.parse(cur.data), version: curVer, updatedAt: cur.updated_at });
      }
      const newVer = curVer + 1;
      q.putGalaxy.run(me.id, JSON.stringify(body.data), newVer);
      if (body.data.account && body.data.account.name) q.updateUser.run(String(body.data.account.name).slice(0, 24), String(body.data.account.avatar || me.avatar).slice(0, 2), me.id);
      return json(res, 200, { ok: true, version: newVer });
    }
  }
  // POST /api/galaxy/beacon — 页面卸载时的最后一发（sendBeacon 无法带 header）
  if (seg[1] === 'galaxy' && seg[2] === 'beacon' && req.method === 'POST') {
    if (body.data && Array.isArray(body.data.stars)) {
      const cur = q.getGalaxy.get(me.id);
      const curVer = cur ? (cur.version || 0) : 0;
      // 乐观锁与 PUT 同口径：末发版本落后说明其它设备/标签页已写入更新的星系——放弃这一发，
      // 不让卸载兜底覆盖别人的新数据；不带 baseVersion 的旧客户端保持原行为
      if (!(body.baseVersion != null && cur && Number(body.baseVersion) !== curVer)) {
        q.putGalaxy.run(me.id, JSON.stringify(body.data), curVer + 1);
      }
    }
    return json(res, 200, { ok: true });
  }

  /* 社交面的门禁总闸：把星系开出去（share）与到别人那儿去（visit / friends /
     inbox）都要求先有账号。启动时的角标探测也会撞上这道 403，前端 soften()
     已经把它当「暂不可用」处理，静默留白而不是报错。 */
  if (seg[1] === 'share' && needAccount('share')) return;
  if ((seg[1] === 'friends' || seg[1] === 'visit' || seg[1] === 'inbox') && needAccount('visit')) return;

  // GET /api/share — 我的分享状态与访客列表；POST /api/share — 开关/可见度/重置密文
  if (seg[1] === 'share' && seg.length === 2) {
    if (req.method === 'GET') {
      return json(res, 200, { ...pubShare(shareOf(me.id)), visitors: q.visitorsOf.all(me.id).map(v => ({ id: v.id, name: v.name, avatar: v.avatar, blocked: !!v.blocked, addedAt: v.added_at, lastVisit: v.last_visit || null })) });
    }
    if (req.method === 'POST') {
      const cur = shareOf(me.id);
      const enabled = body.enabled != null ? (body.enabled ? 1 : 0) : cur.enabled;
      const visibility = ['outline', 'stars'].includes(body.visibility) ? body.visibility : cur.visibility;
      let code = cur.code;
      if ((enabled && !code) || body.reset) code = genCode();
      q.upsertShare.run(me.id, enabled, code, visibility);
      return json(res, 200, pubShare(shareOf(me.id)));
    }
  }
  // POST /api/share/block — 拉黑/解除某位访客
  if (seg[1] === 'share' && seg[2] === 'block' && req.method === 'POST') {
    if (!q.friendship.get(me.id, body.viewerId)) return json(res, 404, { error: '不是你的访客' });
    q.setBlocked.run(body.blocked ? 1 : 0, me.id, body.viewerId);
    return json(res, 200, { ok: true });
  }

  // POST /api/friends/redeem — 用分享码兑换访问权
  if (seg[1] === 'friends' && seg[2] === 'redeem' && req.method === 'POST') {
    const code = String(body.code || '').trim().toUpperCase();
    const s = q.shareByCode.get(code);
    if (!s || !s.enabled) return json(res, 404, { error: '密文无效，或对方已关闭星系访问' });
    if (s.user_id === me.id) return json(res, 400, { error: '这是你自己的星系' });
    q.addFriend.run(s.user_id, me.id);
    const fr = q.friendship.get(s.user_id, me.id);
    if (fr && fr.blocked) return json(res, 403, { error: '对方暂时关闭了你的访问' });
    const owner = q.userById.get(s.user_id);
    return json(res, 200, { friend: { id: owner.id, name: owner.name, avatar: owner.avatar } });
  }
  // GET /api/friends — 我能访问的星系列表
  if (seg[1] === 'friends' && seg.length === 2 && req.method === 'GET') {
    const list = q.friendsOf.all(me.id).map(f => {
      const s = shareOf(f.id);
      const g = q.getGalaxy.get(f.id);
      let starCount = 0; try { starCount = (JSON.parse(g ? g.data : '{}').stars || []).length; } catch { /* 快照损坏时按 0 颗计 */ }
      return { id: f.id, name: f.name, avatar: f.avatar, addedAt: f.added_at, enabled: !!s.enabled, blocked: !!f.blocked, visibility: s.visibility, starCount };
    });
    return json(res, 200, { friends: list });
  }
  // POST /api/friends/remove — 移除一个好友星系
  if (seg[1] === 'friends' && seg[2] === 'remove' && req.method === 'POST') {
    q.removeFriend.run(body.friendId, me.id);
    return json(res, 200, { ok: true });
  }

  // GET /api/visit/:ownerId — 访问好友星系（服务端裁剪后的只读视图）
  if (seg[1] === 'visit' && seg[2] && req.method === 'GET') {
    const ownerId = Number(seg[2]);
    if (!Number.isInteger(ownerId)) return json(res, 404, { error: '未知星系' });
    const f = q.friendship.get(ownerId, me.id);
    if (!f) return json(res, 403, { error: '你没有这片星系的访问权' });
    if (f.blocked) return json(res, 403, { error: '对方暂时关闭了你的访问' });
    const s = shareOf(ownerId);
    if (!s.enabled) return json(res, 403, { error: '对方已关闭星系访问' });
    const g = q.getGalaxy.get(ownerId);
    if (!g) return json(res, 404, { error: '这片星空还是空的' });
    const owner = q.userById.get(ownerId);
    q.touchVisit.run(ownerId, me.id);   // 访客足迹：主人在分享面板能看到「谁刚来过」
    // 主人的星空简介（设置 → 个人简介）随造访视图展示；剥 HTML 并钳长度
    let ownerBio = '';
    try { ownerBio = cleanText((JSON.parse(g.data).account || {}).bio, 160); } catch { }
    return json(res, 200, { owner: { id: owner.id, name: owner.name, avatar: owner.avatar, bio: ownerBio }, galaxy: sanitizeGalaxy(g.data, s.visibility) });
  }

  /* ——— 星际收件箱 ——— */

  // POST /api/inbox/send — 给好友寄「造访邀请」(kind:'galaxy') 或赠一颗自己的星 (kind:'star')
  if (seg[1] === 'inbox' && seg[2] === 'send' && req.method === 'POST') {
    const toId = Number(body.toUserId);
    const toUser = Number.isInteger(toId) ? q.userById.get(toId) : null;
    if (!toUser) return json(res, 404, { error: '收件人不存在' });
    if (toUser.id === me.id) return json(res, 400, { error: '不能寄给自己' });
    const rel = relationOf(me.id, toUser.id);
    if (!rel.friends) return json(res, 403, { error: '你们还不是星际好友' });
    if (rel.blocked) return json(res, 403, { error: '这条星路暂时不通' });

    if (body.kind === 'galaxy') {
      const s = shareOf(me.id);
      if (!s.enabled || !s.code) return json(res, 400, { error: '先在设置里开启星系分享' });
      const g = q.getGalaxy.get(me.id);
      let starCount = 0; try { starCount = (JSON.parse(g ? g.data : '{}').stars || []).length; } catch { /* 快照损坏按 0 颗计 */ }
      const payload = {
        code: s.code,
        galaxyName: cleanText(me.name, INBOX_LIM.label) + '的星系',
        starCount,
      };
      return deliver(res, me.id, me.id, toUser.id, 'galaxy', null, payload);
    }

    // 星语：造访时给对方留一句话（进对方收件箱）。文本剥 HTML 钳 160 字；
    // 绕过「同类未领取即视为重复」的抑制（多句星语是常态），改由 deliver 内的未读上限兜底
    if (body.kind === 'note') {
      const text = cleanText(body.text, 160);
      if (!text) return json(res, 400, { error: '星语不能是空的' });
      return deliver(res, me.id, me.id, toUser.id, 'note', null, { text });
    }

    if (body.kind === 'star') {
      const star = starInGalaxyOf(me.id, body.starId);
      if (!star) return json(res, 404, { error: '这颗星不在你的星系里' });
      const payload = {
        starId: star.id,
        label: cleanText(star.label, INBOX_LIM.label),
        summary: cleanText(star.summary, INBOX_LIM.summary),
        keyPoints: outlinePoints(star),
      };
      return deliver(res, me.id, me.id, toUser.id, 'star', star.id, payload);
    }

    return json(res, 400, { error: '未知的来信类型' });
  }

  // POST /api/inbox/collect — 造访好友星系时收纳一颗可见的星（投进自己的收件箱，寄件人=星系主人）
  if (seg[1] === 'inbox' && seg[2] === 'collect' && req.method === 'POST') {
    const code = String(body.code || '').trim().toUpperCase();
    const s = q.shareByCode.get(code);
    if (!s || !s.enabled) return json(res, 404, { error: '密文无效，或对方已关闭星系访问' });
    if (s.user_id === me.id) return json(res, 400, { error: '这是你自己的星系' });
    if (relationOf(s.user_id, me.id).blocked) return json(res, 403, { error: '对方暂时关闭了你的访问' });
    const star = starInGalaxyOf(s.user_id, body.starId);
    if (!star) return json(res, 404, { error: '这颗星不存在' });
    // 严格按主人的可见度裁剪：'stars' 档只有星名；'outline' 档另含大纲要点。摘要与正文永不进收件箱
    const payload = { starId: star.id, label: cleanText(star.label, INBOX_LIM.label) };
    if (s.visibility === 'outline') payload.keyPoints = outlinePoints(star);
    return deliver(res, me.id, s.user_id, me.id, 'star', star.id, payload);
  }

  // GET /api/inbox — 我的星际来信（时间倒序）
  if (seg[1] === 'inbox' && seg.length === 2 && req.method === 'GET') {
    return json(res, 200, q.inboxList.all(me.id).map(pubMsg));
  }

  // POST /api/inbox/ack — 领取（收纳完成）或忽略（删除）
  if (seg[1] === 'inbox' && seg[2] === 'ack' && req.method === 'POST') {
    const msgId = Number(body.id);
    const m = Number.isInteger(msgId) ? q.inboxById.get(msgId) : null;
    if (!m || m.to_user !== me.id) return json(res, 404, { error: '来信不存在' });
    if (body.action === 'claim') {
      q.inboxClaim.run(m.id);
      return json(res, 200, { ok: true, message: pubMsg(q.inboxById.get(m.id)) });
    }
    if (body.action === 'dismiss') {
      q.inboxDelete.run(m.id);
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: '未知操作' });
  }

  /* ============================ 星港管理台 ============================
     入口一律 /api/admin/*，守卫三条：必须是有效会话（匿名 token 进不来）、
     角色必须是 admin、每个写操作留一条审计。管理员本人在应用里与普通用户
     完全一样——管理台是多出来的一层，不是另一个身份。 */
  if (seg[1] === 'admin') {
    if (!sess || !isAdmin) return json(res, 403, { error: '需要管理员权限' });

    // ——— 总览：一次算清全站家底 ———
    if (seg[2] === 'overview' && req.method === 'GET') {
      const users = q.allUsers.all();
      const now = Date.now();
      const within = (ts, days) => ts && (now - Date.parse(String(ts).replace(' ', 'T') + 'Z')) < days * DAY;
      let stars = 0, lit = 0, ember = 0, cons = 0, notes = 0, bytes = 0, galaxies = 0;
      for (const u of users) {
        const st = galaxyStats(u.id);
        if (!st) continue;
        galaxies++; stars += st.stars; lit += st.lit; ember += st.ember; cons += st.cons; notes += st.notes; bytes += st.bytes;
      }
      const shares = q.allShares.all();
      // 游客分布：有多少个来源 IP、其中多少个已经顶到限额
      const guestIps = new Map();
      for (const u of users) {
        if (u.username) continue;
        const k = u.ip || '未知';
        guestIps.set(k, (guestIps.get(k) || 0) + 1);
      }
      return json(res, 200, {
        guests: {
          total: [...guestIps.values()].reduce((a, b) => a + b, 0),
          ips: guestIps.size,
          atLimit: site.guestPerIp > 0 ? [...guestIps.values()].filter(n => n >= site.guestPerIp).length : 0,
          perIp: site.guestPerIp,
          trustProxy: TRUST_PROXY,
        },
        users: {
          total: users.length,
          registered: users.filter(u => u.username).length,
          anonymous: users.filter(u => !u.username).length,
          admins: users.filter(u => (u.role || 'user') === 'admin').length,
          banned: users.filter(u => u.banned).length,
          newThisWeek: users.filter(u => within(u.registered_at || u.created_at, 7)).length,
          activeToday: users.filter(u => within(u.last_seen, 1)).length,
          activeThisWeek: users.filter(u => within(u.last_seen, 7)).length,
        },
        knowledge: { galaxies, stars, lit, ember, constellations: cons, notes, snapshotBytes: bytes },
        social: {
          sharesOpen: shares.filter(s => s.enabled).length,
          sharesTotal: shares.length,
          friendships: q.countFriendships.get().n,
          mail: q.countAllMail.get().n,
        },
        system: systemInfo(),
        site: siteGet(),
        defaultPass: adminDefaultPass(),
      });
    }

    // ——— 用户列表：搜索 + 排序 + 分页，每行都带真实的星系读数 ———
    if (seg[2] === 'users' && seg.length === 3 && req.method === 'GET') {
      const kw = String(url.searchParams.get('q') || '').trim().toLowerCase();
      const sort = ['id', 'name', 'stars', 'lastSeen', 'created'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'id';
      const desc = url.searchParams.get('order') !== 'asc';
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const size = Math.min(100, Math.max(5, Number(url.searchParams.get('size')) || 20));
      const filter = url.searchParams.get('filter') || 'all';   // all | registered | anonymous | admin | banned

      let rows = q.allUsers.all().map(u => {
        const st = galaxyStats(u.id) || { stars: 0, lit: 0, cons: 0, bytes: 0, savedAt: null };
        return {
          ...adminUser(u),
          stars: st.stars, lit: st.lit, constellations: st.cons, snapshotBytes: st.bytes,
          lastSaved: st.updatedAt || null,
          sessions: q.countSessionsOf.get(u.id).n,
          visitors: q.countVisitorsOf.get(u.id).n,
          shareEnabled: !!shareOf(u.id).enabled,
        };
      });
      if (filter === 'registered') rows = rows.filter(r => r.registered);
      else if (filter === 'anonymous') rows = rows.filter(r => !r.registered);
      else if (filter === 'admin') rows = rows.filter(r => r.role === 'admin');
      else if (filter === 'banned') rows = rows.filter(r => r.banned);
      // 搜索兼收 IP：排查「这个地址上都有谁」时不必换一个页面
      if (kw) rows = rows.filter(r => [r.name, r.username, r.email, r.ip, r.lastIp].some(v => String(v || '').toLowerCase().includes(kw)));
      const key = { id: r => r.id, name: r => String(r.username || r.name).toLowerCase(), stars: r => r.stars,
        lastSeen: r => r.lastSeen || '', created: r => r.createdAt || '' }[sort];
      rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1); });
      const total = rows.length;
      return json(res, 200, { total, page, size, pages: Math.max(1, Math.ceil(total / size)), users: rows.slice((page - 1) * size, page * size) });
    }

    // ——— 用户详情：星域分布 + 分享 + 会话 + 来信，够判断「这个人在干什么」———
    if (seg[2] === 'users' && seg[3] && seg.length === 4 && req.method === 'GET') {
      const u = q.userById.get(Number(seg[3]));
      if (!u) return json(res, 404, { error: '用户不存在' });
      const st = galaxyStats(u.id);
      const s = shareOf(u.id);
      return json(res, 200, {
        user: adminUser(u),
        galaxy: st ? {
          stars: st.stars, lit: st.lit, ember: st.ember, constellations: st.cons, notes: st.notes,
          trash: st.trash, snapshotBytes: st.bytes, updatedAt: st.updatedAt, version: st.version,
          breakdown: st.breakdown, avgStrength: st.avgStrength,
        } : null,
        share: { enabled: !!s.enabled, code: s.code || null, visibility: s.visibility },
        visitors: q.visitorsOf.all(u.id).map(v => ({ id: v.id, name: v.name, avatar: v.avatar, blocked: !!v.blocked, lastVisit: v.last_visit || null })),
        friends: q.friendsOf.all(u.id).map(f => ({ id: f.id, name: f.name, avatar: f.avatar })),
        sessions: q.sessionsOf.all(u.id).map(x => ({ createdAt: x.created_at, lastSeen: x.last_seen, current: x.token === token })),
        mail: q.countMailTo.get(u.id).n,
      });
    }

    // ——— 用户写操作 ———
    if (seg[2] === 'users' && seg[3] && seg[4] && req.method === 'POST') {
      const target = q.userById.get(Number(seg[3]));
      if (!target) return json(res, 404, { error: '用户不存在' });
      const self = target.id === me.id;
      const action = seg[4];

      if (action === 'ban') {
        if (self) return json(res, 400, { error: '不能停用自己的账号' });
        if ((target.role || 'user') === 'admin') return json(res, 400, { error: '先撤销对方的管理员身份，再考虑停用' });
        const banned = body.banned ? 1 : 0;
        const reason = banned ? cleanText(body.reason, 200) || '管理员停用了这个账号' : null;
        q.setBan.run(banned, reason, target.id);
        if (banned) q.dropSessionsOf.run(target.id);   // 停用即刻踢下线，不等会话自然过期
        audit(me, banned ? 'user.ban' : 'user.unban', target, reason || '');
        return json(res, 200, { ok: true, user: adminUser(q.userById.get(target.id)) });
      }

      if (action === 'role') {
        const role = body.role === 'admin' ? 'admin' : 'user';
        // 最后一个管理员不能自我降级，否则这台服务器就没人管得了了
        if (role === 'user' && (target.role || 'user') === 'admin' && q.countAdmins.get().n <= 1) {
          return json(res, 400, { error: '这是最后一位管理员，不能撤销' });
        }
        if (role === 'admin' && !target.username) return json(res, 400, { error: '匿名用户没有账号，无法任命为管理员' });
        if (role === 'admin' && target.banned) return json(res, 400, { error: '先解除停用，再任命管理员' });
        q.setRole.run(role, target.id);
        audit(me, role === 'admin' ? 'user.promote' : 'user.demote', target, '');
        return json(res, 200, { ok: true, user: adminUser(q.userById.get(target.id)) });
      }

      if (action === 'password') {
        const pw = String(body.password || '');
        if (pw.length < 6) return json(res, 400, { error: '密码至少 6 位' });
        if (!target.username) return json(res, 400, { error: '匿名用户没有账号密码' });
        q.setPass.run(hashPass(pw), target.id);
        if (body.revoke !== false) q.dropSessionsOf.run(target.id);   // 改密默认踢掉全部旧会话
        if (target.username === ADMIN_USER) clearAdminDefaultPass();
        audit(me, 'user.password', target, body.revoke === false ? '' : '并强制下线');
        return json(res, 200, { ok: true });
      }

      if (action === 'profile') {
        const name = cleanText(body.name, 24) || target.name;
        const avatar = String(body.avatar || target.avatar).slice(0, 2);
        q.setName.run(name, avatar, target.id);
        if (body.username != null && target.username) {
          const nu = String(body.username).trim();
          if (!/^[\w一-龥-]{2,24}$/.test(nu)) return json(res, 400, { error: '用户名需 2–24 个字符（中英文、数字、_ 或 -）' });
          const holder = q.userByUsername.get(nu);
          if (holder && holder.id !== target.id) return json(res, 409, { error: '这个用户名已经有主人了' });
          try { q.setUsername.run(nu, target.id); } catch { return json(res, 409, { error: '这个用户名刚被占用' }); }
        }
        audit(me, 'user.profile', target, name);
        return json(res, 200, { ok: true, user: adminUser(q.userById.get(target.id)) });
      }

      if (action === 'revoke') {
        const n = q.countSessionsOf.get(target.id).n;
        q.dropSessionsOf.run(target.id);
        audit(me, 'user.revoke', target, n + ' 个会话');
        return json(res, 200, { ok: true, revoked: n });
      }

      if (action === 'delete') {
        if (self) return json(res, 400, { error: '不能删除自己的账号' });
        if ((target.role || 'user') === 'admin') return json(res, 400, { error: '先撤销对方的管理员身份，再删除' });
        // 二次确认：请求体必须原样回带用户名/昵称，防误点
        const expect = target.username || target.name;
        if (String(body.confirm || '') !== expect) return json(res, 400, { error: `请输入「${expect}」以确认删除` });
        const label = adminUser(target);
        q.dropGalaxyOf.run(target.id); q.dropShareOf.run(target.id);
        q.dropFriendshipsOf.run(target.id, target.id); q.dropMailOf.run(target.id, target.id);
        q.dropSessionsOf.run(target.id); q.dropUser.run(target.id);
        audit(me, 'user.delete', label, '连同星系与全部关系');
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: '未知的管理操作' });
    }

    /* ——— 游客治理：按来源 IP 聚合 ———
       每一行都是数出来的：这个 IP 下的游客账号、他们各自存了多少颗星、
       最近一次露面是什么时候。zombie = 从没存过任何星系且 N 天没露面，
       purge 只清这一类，绝不碰存过东西的人。 */
    if (seg[2] === 'guests' && seg.length === 3 && req.method === 'GET') {
      const days = Math.min(365, Math.max(1, Number(url.searchParams.get('idleDays')) || 7));
      const cut = Date.now() - days * DAY;
      const groups = new Map();
      for (const u of q.allUsers.all()) {
        if (u.username) continue;                    // 只看游客
        const key = u.ip || '未知';
        if (!groups.has(key)) groups.set(key, []);
        const st = galaxyStats(u.id);
        const seen = sqlTs(u.last_seen || u.created_at);
        groups.get(key).push({
          id: u.id, name: u.name, avatar: u.avatar, createdAt: u.created_at, lastSeen: u.last_seen,
          stars: st ? st.stars : 0, snapshotBytes: st ? st.bytes : 0,
          banned: !!u.banned,
          zombie: !st && seen < cut,                 // 空手来、又很久没回
        });
      }
      const rows = [...groups.entries()].map(([ip, guests]) => ({
        ip,
        guests: guests.sort((a, b) => b.id - a.id),
        count: guests.length,
        stars: guests.reduce((a, g) => a + g.stars, 0),
        zombies: guests.filter(g => g.zombie).length,
        lastSeen: guests.map(g => g.lastSeen).sort().pop() || null,
      })).sort((a, b) => b.count - a.count || (b.lastSeen || '').localeCompare(a.lastSeen || ''));
      return json(res, 200, {
        limit: site.guestPerIp, trustProxy: TRUST_PROXY, idleDays: days,
        ips: rows.length, guests: rows.reduce((a, r) => a + r.count, 0),
        zombies: rows.reduce((a, r) => a + r.zombies, 0),
        rows,
      });
    }

    // 清理僵尸游客：从没存过星系、且 idleDays 天没露面的匿名账号。
    // 传 ip 只清那一个来源（用来给某个 IP 腾出名额），不传就全站清一遍。
    if (seg[2] === 'guests' && seg[3] === 'purge' && req.method === 'POST') {
      const days = Math.min(365, Math.max(1, Number(body.idleDays) || 7));
      const cut = Date.now() - days * DAY;
      const onlyIp = body.ip ? String(body.ip) : null;
      let removed = 0;
      for (const u of q.allUsers.all()) {
        if (u.username || (u.role || 'user') === 'admin') continue;
        if (onlyIp && (u.ip || '未知') !== onlyIp) continue;
        if (galaxyStats(u.id)) continue;                                  // 存过东西的一律不动
        if (sqlTs(u.last_seen || u.created_at) >= cut) continue;          // 最近还来过的不动
        q.dropGalaxyOf.run(u.id); q.dropShareOf.run(u.id);
        q.dropFriendshipsOf.run(u.id, u.id); q.dropMailOf.run(u.id, u.id);
        q.dropSessionsOf.run(u.id); q.dropUser.run(u.id);
        removed++;
      }
      audit(me, 'guest.purge', null, (onlyIp ? onlyIp + ' · ' : '') + removed + ' 个空游客');
      return json(res, 200, { ok: true, removed });
    }

    /* ——— 趋势：近 N 天的注册 / 登录 / 活跃，全部从时间戳列现算 ———
       没有任何平滑或估算：某天没有人就是 0。 */
    if (seg[2] === 'trends' && req.method === 'GET') {
      const days = Math.min(90, Math.max(7, Number(url.searchParams.get('days')) || 14));
      const users = q.allUsers.all();
      const sessions = q.sessionTimes.all();
      const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10);
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const buckets = [];
      for (let i = days - 1; i >= 0; i--) {
        buckets.push({ day: dayKey(today.getTime() - i * DAY), joined: 0, registered: 0, active: 0, logins: 0 });
      }
      const index = new Map(buckets.map((b, i) => [b.day, i]));
      const bump = (ts, field) => {
        if (!ts) return;
        const i = index.get(dayKey(sqlTs(ts)));
        if (i != null) buckets[i][field]++;
      };
      for (const u of users) {
        bump(u.created_at, 'joined');
        bump(u.registered_at, 'registered');
        bump(u.last_seen, 'active');       // 「活跃」按最后一次露面落在哪天算，不重复计
      }
      for (const s of sessions) bump(s.created_at, 'logins');
      return json(res, 200, { days, buckets });
    }

    // ——— 会话总览与单条吊销 ———
    if (seg[2] === 'sessions' && seg.length === 3 && req.method === 'GET') {
      return json(res, 200, {
        // 会话令牌只出一段指纹（够肉眼区分同一人的多台设备），完整 token 绝不出库；
        // 要断开就用 users/:id/revoke 踢掉那个人的全部会话
        sessions: q.allSessions.all().map(s => ({
          fingerprint: s.token.slice(2, 10), ip: s.last_ip || null,
          userId: s.user_id, name: s.name, username: s.username || null, avatar: s.avatar, role: s.role || 'user',
          createdAt: s.created_at, lastSeen: s.last_seen, current: s.token === token,
        })),
      });
    }

    // ——— 分享总览：谁把星系开给了外面 ———
    if (seg[2] === 'shares' && seg.length === 3 && req.method === 'GET') {
      return json(res, 200, {
        shares: q.allShares.all().map(s => {
          const u = q.userById.get(s.user_id);
          return {
            userId: s.user_id, name: u ? u.name : '（已删除）', username: u ? (u.username || null) : null, avatar: u ? u.avatar : '星',
            enabled: !!s.enabled, code: s.code, visibility: s.visibility,
            visitors: q.countVisitorsOf.get(s.user_id).n,
          };
        }),
      });
    }
    if (seg[2] === 'shares' && seg[3] === 'close' && req.method === 'POST') {
      const target = q.userById.get(Number(body.userId));
      if (!target) return json(res, 404, { error: '用户不存在' });
      const cur = shareOf(target.id);
      q.upsertShare.run(target.id, 0, cur.code, cur.visibility);
      audit(me, 'share.close', target, '');
      return json(res, 200, { ok: true });
    }

    // ——— 站点设置：公告 / 注册开关 / 维护模式 ———
    if (seg[2] === 'site' && req.method === 'GET') return json(res, 200, siteGet());
    if (seg[2] === 'site' && req.method === 'POST') {
      const patch = {};
      if (body.announcement) {
        const a = body.announcement;
        patch.announcement = {
          text: cleanText(a.text, 300),
          tone: ['info', 'warn', 'danger'].includes(a.tone) ? a.tone : 'info',
          enabled: !!a.enabled && !!cleanText(a.text, 300),
          updatedAt: new Date().toISOString(),
        };
      }
      if (body.registrationOpen != null) patch.registrationOpen = !!body.registrationOpen;
      if (body.guestPerIp != null) patch.guestPerIp = Math.max(0, Math.min(50, Number(body.guestPerIp) || 0));
      if (body.guestGates) {
        patch.guestGates = {};
        for (const k of ['editor', 'share', 'visit', 'vault']) {
          if (body.guestGates[k] != null) patch.guestGates[k] = !!body.guestGates[k];
        }
      }
      if (body.maintenance) {
        patch.maintenance = {
          enabled: !!body.maintenance.enabled,
          message: cleanText(body.maintenance.message, 200) || SITE_DEFAULT.maintenance.message,
        };
      }
      const next = siteSet(patch);
      audit(me, 'site.update', null, Object.keys(patch).join(' · '));
      return json(res, 200, next);
    }

    // ——— 操作日志 ———
    if (seg[2] === 'audit' && req.method === 'GET') {
      const limit = Math.min(500, Math.max(10, Number(url.searchParams.get('limit')) || 100));
      return json(res, 200, {
        entries: q.auditList.all(limit).map(a => ({
          id: a.id, actor: a.actor_name, action: a.action,
          target: a.target_name, targetId: a.target_id, detail: a.detail, at: a.created_at,
        })),
      });
    }

    // ——— 数据库维护 ———
    if (seg[2] === 'maintenance' && req.method === 'POST') {
      const act = body.action;
      try {
        if (act === 'checkpoint') { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); }
        else if (act === 'vacuum') { db.exec('VACUUM'); }
        else if (act === 'prune-sessions') {
          // 90 天没露面的会话按失效清掉（登录态本就不该无限期）
          const info = db.prepare("DELETE FROM sessions WHERE last_seen < datetime('now', '-90 days')").run();
          audit(me, 'db.prune-sessions', null, Number(info.changes) + ' 个');
          return json(res, 200, { ok: true, removed: Number(info.changes), system: systemInfo() });
        }
        else return json(res, 400, { error: '未知的维护操作' });
      } catch (e) { return json(res, 500, { error: String(e.message || e) }); }
      audit(me, 'db.' + act, null, '');
      return json(res, 200, { ok: true, system: systemInfo() });
    }

    // ——— 备份下载：先 checkpoint 把 WAL 收进主库，再整文件流出去 ———
    if (seg[2] === 'backup' && req.method === 'GET') {
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* 无 WAL 可收也无妨 */ }
      audit(me, 'db.backup', null, '');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const st = fs.statSync(DB_PATH);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': st.size,
        'Content-Disposition': `attachment; filename="stellar-raft-${stamp}.db"`,
      });
      return fs.createReadStream(DB_PATH).pipe(res);
    }

    return json(res, 404, { error: '未知接口' });
  }

  return json(res, 404, { error: '未知接口' });
}

/* ——— 管理台辅助 ——— */

// 用户的管理侧视图（比 pubAccount 多出运营字段，仍然绝不带 token / 密码哈希）
const adminUser = (u) => ({
  id: u.id, name: u.name, avatar: u.avatar, username: u.username || null, email: u.email || null,
  role: u.role || 'user', registered: !!u.username, banned: !!u.banned, banReason: u.ban_reason || null,
  createdAt: u.created_at, registeredAt: u.registered_at || null, lastSeen: u.last_seen || null,
  ip: u.ip || null, lastIp: u.last_ip || null, lastLogin: u.last_login || null,
});

// 解析某人的星系快照，算出管理台要展示的读数。快照损坏 / 不存在 → null
const galaxyStats = (userId) => {
  const g = q.getGalaxy.get(userId);
  if (!g) return null;
  let d; try { d = JSON.parse(g.data); } catch { return null; }
  const stars = d.stars || [];
  const now = Date.now();
  const strengths = stars.map(s => decayedStrength(s, now)).filter(v => Number.isFinite(v));
  const flags = stars.map((s, i) => litFlags(s, strengths[i]));
  const breakdown = (d.constellations || []).map(c => ({
    id: c.id, name: cleanText(c.name, 60), color: c.color,
    count: stars.filter(s => s.con === c.id).length,
  })).sort((a, b) => b.count - a.count).slice(0, 12);
  return {
    stars: stars.length,
    lit: flags.filter(f => f.lit).length,
    ember: flags.filter(f => f.ember).length,
    cons: (d.constellations || []).length,
    notes: (d.notes || []).length,
    trash: (d.trash || []).length,
    bytes: Buffer.byteLength(g.data),
    updatedAt: g.updated_at,
    version: g.version || 0,
    avgStrength: strengths.length ? Math.round(strengths.reduce((a, b) => a + b, 0) / strengths.length * 1000) / 1000 : 0,
    breakdown,
  };
};

// 进程与磁盘的实时读数（db 体积把 WAL/SHM 一起算上，才是真正占的地方）
const systemInfo = () => {
  const size = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };
  const mem = process.memoryUsage();
  return {
    node: process.version, platform: process.platform, pid: process.pid,
    uptimeMs: Date.now() - METRICS.startedAt,
    requests: METRICS.requests, apiRequests: METRICS.apiRequests, errors: METRICS.errors,
    rss: mem.rss, heapUsed: mem.heapUsed,
    db: { path: path.relative(ROOT, DB_PATH), size: size(DB_PATH), wal: size(DB_PATH + '-wal'), shm: size(DB_PATH + '-shm') },
    port: PORT,
  };
};

const pubShare = (s) => ({ enabled: !!s.enabled, code: s.enabled ? s.code : (s.code || null), visibility: s.visibility });

/* ============================ 静态文件 ============================ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  // 根路径重定向到应用目录：index.html 里的相对引用（*.jsx / data.js …）
  // 只有在 /ui_kits/stellar-raft/ 下解析才全部正确，原地改写会 404 成黑屏
  if (p === '/' || p === '/index.html') {
    res.writeHead(302, { Location: APP_DIR });
    return res.end();
  }
  if (p.endsWith('/')) p += 'index.html'; // 目录路径回退：/docs/ → /docs/index.html
  const file = path.normalize(path.join(ROOT, p));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

/* ============================ 服务器 ============================ */
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  METRICS.requests++;
  if (url.pathname.startsWith('/api/')) {
    METRICS.apiRequests++;
    handleApi(req, res, url).catch(e => { METRICS.errors++; json(res, 500, { error: String(e.message || e) }); });
  } else if (req.method === 'GET') {
    serveStatic(req, res, url);
  } else {
    res.writeHead(405); res.end();
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[stellar-raft] http://localhost:${PORT}${APP_DIR}  (静态 + API · 数据库 ${path.relative(ROOT, DB_PATH)})`);
});
