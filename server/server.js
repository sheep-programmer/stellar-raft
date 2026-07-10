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
const APP = '/ui_kits/stellar-raft/index.html';
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
`);

const q = {
  userByToken: db.prepare('SELECT * FROM users WHERE token = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (token, name, avatar) VALUES (?, ?, ?)'),
  updateUser: db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?'),
  getGalaxy: db.prepare('SELECT data FROM galaxies WHERE user_id = ?'),
  putGalaxy: db.prepare(`INSERT INTO galaxies (user_id, data, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
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
  }
  return u;
};

const shareOf = (userId) => {
  const s = q.getShare.get(userId);
  return s || { user_id: userId, enabled: 0, code: null, visibility: 'outline' };
};

const stripHtml = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// 访客视图在服务端生成：正文、摘要、属性、关系语句一律不出库
const sanitizeGalaxy = (raw, visibility) => {
  let d; try { d = JSON.parse(raw); } catch (e) { return null; }
  const outline = visibility === 'outline';
  return {
    visibility,
    constellations: (d.constellations || []).map(c => ({ id: c.id, name: c.name, color: c.color, health: c.health, count: c.count })),
    stars: (d.stars || []).map(s => ({
      id: s.id, con: s.con, x: s.x, y: s.y,
      strength: s.strength, importance: s.importance, label: s.label,
      tags: outline ? (s.tags || []) : [],
      outline: outline
        ? (s.body || []).filter(b => ['h1', 'h2', 'h3'].includes(b.type)).map(b => ({ type: b.type, text: stripHtml(b.text).slice(0, 120) }))
        : [],
    })),
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
  q.putGalaxy.run(u.id, JSON.stringify(galaxy));
  q.upsertShare.run(u.id, 1, DEMO_CODE, 'outline');
  console.log('[seed] 演示好友「星图伙伴」已就绪，分享码', DEMO_CODE);
})();

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
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: '请求体格式错误' }); }
  }
  const me = ensureUser(token, body.name, body.avatar);

  // POST /api/hello — 建档/取回身份与分享状态
  if (seg[1] === 'hello' && req.method === 'POST') {
    if (body.name && body.name !== me.name) { q.updateUser.run(String(body.name).slice(0, 24), String(body.avatar || me.avatar).slice(0, 2), me.id); }
    const u = q.userById.get(me.id);
    return json(res, 200, { user: { id: u.id, name: u.name, avatar: u.avatar }, share: pubShare(shareOf(u.id)), hasGalaxy: !!q.getGalaxy.get(u.id) });
  }

  // GET/PUT /api/galaxy — 自己的星系整存整取
  if (seg[1] === 'galaxy' && seg.length === 2) {
    if (req.method === 'GET') {
      const g = q.getGalaxy.get(me.id);
      return json(res, 200, { data: g ? JSON.parse(g.data) : null });
    }
    if (req.method === 'PUT') {
      if (!body.data) return json(res, 400, { error: '缺少 data' });
      if (!Array.isArray(body.data.stars)) return json(res, 400, { error: 'data.stars 必须是数组' });
      q.putGalaxy.run(me.id, JSON.stringify(body.data));
      if (body.data.account && body.data.account.name) q.updateUser.run(String(body.data.account.name).slice(0, 24), String(body.data.account.avatar || me.avatar).slice(0, 2), me.id);
      return json(res, 200, { ok: true });
    }
  }
  // POST /api/galaxy/beacon — 页面卸载时的最后一发（sendBeacon 无法带 header）
  if (seg[1] === 'galaxy' && seg[2] === 'beacon' && req.method === 'POST') {
    if (body.data && Array.isArray(body.data.stars)) q.putGalaxy.run(me.id, JSON.stringify(body.data));
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
      let starCount = 0; try { starCount = (JSON.parse(g ? g.data : '{}').stars || []).length; } catch (e) { }
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
  if (p === '/' || p === '/index.html') p = APP;
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
  console.log(`[stellar-raft] http://localhost:${PORT}  (静态 + API · 数据库 ${path.relative(ROOT, DB_PATH)})`);
});
