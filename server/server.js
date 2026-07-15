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
  visitorsOf: db.prepare(`SELECT u.id, u.name, u.avatar, f.blocked, f.added_at FROM friendships f
    JOIN users u ON u.id = f.viewer_id WHERE f.owner_id = ?`),
  setBlocked: db.prepare('UPDATE friendships SET blocked = ? WHERE owner_id = ? AND viewer_id = ?'),
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

const ensureUser = (token, name, avatar) => {
  let u = q.userByToken.get(token);
  if (!u) {
    q.insertUser.run(token, (name || '旅行者').slice(0, 24), (avatar || '星').slice(0, 2));
    u = q.userByToken.get(token);
    maybeSeedWelcomeInbox(u); // 新装 DB 的第一位旅行者：收件箱里预置两封「星际来信」
  }
  return u;
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
  username: u.username || null, email: u.email || null, registeredAt: u.registered_at || null });

const shareOf = (userId) => {
  const s = q.getShare.get(userId);
  return s || { user_id: userId, enabled: 0, code: null, visibility: 'outline' };
};

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
  const dup = q.inboxUnclaimed.all(toId, fromId, kind).find(m => {
    if (kind !== 'star') return true;
    try { return JSON.parse(m.payload).starId === starId; } catch { return false; }
  });
  if (dup) return json(res, 200, { ok: true, duplicate: true, message: pubMsg(dup) });
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
  // 鉴权链：session 优先（登录态），未命中退回匿名 token 建档
  const sess = q.sessionByToken.get(token);
  let me;
  if (sess) { me = q.userById.get(sess.user_id); q.touchSession.run(token); }
  else { me = ensureUser(token, body.name, body.avatar); }

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
    try { q.registerUser.run(username, email || null, hashPass(password), me.id); }
    catch (e) { return json(res, 409, { error: '用户名或邮箱刚被占用，换一个试试' }); }   // 并发窗口撞唯一索引
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
    // 改密仅认「登录态」（有效 session）：即便某个匿名 token 恰好是某个已注册账号
    // 升级前的原始 token（同一行、未失效），未经会话鉴权也不当作登录态放行
    if (!sess || !me.username || !me.pass) return json(res, 401, { error: '尚未登录账号' });
    if (!checkPass(String(body.old || ''), me.pass)) return json(res, 401, { error: '旧密码不对' });
    if (String(body.new || '').length < 6) return json(res, 400, { error: '新密码至少 6 位' });
    q.setPass.run(hashPass(String(body.new)), me.id);
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
    catch (e) { return json(res, 409, { error: '这个邮箱刚被占用，换一个试试' }); }
    return json(res, 200, { ok: true, user: pubAccount(q.userById.get(me.id)) });
  }

  // POST /api/hello — 建档/取回身份与分享状态
  if (seg[1] === 'hello' && req.method === 'POST') {
    if (body.name && body.name !== me.name) { q.updateUser.run(String(body.name).slice(0, 24), String(body.avatar || me.avatar).slice(0, 2), me.id); }
    const u = q.userById.get(me.id);
    return json(res, 200, { user: { id: u.id, name: u.name, avatar: u.avatar }, share: pubShare(shareOf(u.id)), hasGalaxy: !!q.getGalaxy.get(u.id), account: pubAccount(u) });
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
      q.putGalaxy.run(me.id, JSON.stringify(body.data), (cur ? (cur.version || 0) : 0) + 1);
    }
    return json(res, 200, { ok: true });
  }

  // GET /api/share — 我的分享状态与访客列表；POST /api/share — 开关/可见度/重置密文
  if (seg[1] === 'share' && seg.length === 2) {
    if (req.method === 'GET') {
      return json(res, 200, { ...pubShare(shareOf(me.id)), visitors: q.visitorsOf.all(me.id).map(v => ({ id: v.id, name: v.name, avatar: v.avatar, blocked: !!v.blocked, addedAt: v.added_at })) });
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
    return json(res, 200, { owner: { id: owner.id, name: owner.name, avatar: owner.avatar }, galaxy: sanitizeGalaxy(g.data, s.visibility) });
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

  return json(res, 404, { error: '未知接口' });
}

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
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch(e => json(res, 500, { error: String(e.message || e) }));
  } else if (req.method === 'GET') {
    serveStatic(req, res, url);
  } else {
    res.writeHead(405); res.end();
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[stellar-raft] http://localhost:${PORT}${APP_DIR}  (静态 + API · 数据库 ${path.relative(ROOT, DB_PATH)})`);
});
