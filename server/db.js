/* 星图 Stellar Raft — 数据库
   建表、既有库的平滑迁移、以及全部预编译语句（q）。
   只负责「数据怎么存、怎么取」，不含任何业务判断。 */
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('./config');

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

module.exports = { db, q };
