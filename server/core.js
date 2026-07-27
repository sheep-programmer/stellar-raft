/* 星图 Stellar Raft — 公共内核
   跨路由共用的一切：应答与请求体、身份与密码、站点设置、审计、记忆衰减与访客视图裁剪、
   收件箱投递。路由模块只管「这个请求要做什么」，怎么做在这里。 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PORT, DB_PATH, DB_SHOWN } = require('./config');
const { q } = require('./db');

const DEMO_CODE = 'XING-DEMO-2333';   // 演示好友的固定分享码（seed.js 种，欢迎来信也引用它）

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

/* ——— 应答与请求体 ——— */
/* json() 回 true = 「这个请求我应答完了」。路由模块里现成的 `return json(...)`
   因此天然成为「已处理」的信号，server.js 据此停止往下派发。 */
const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
  return true;
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

// 进程与磁盘的实时读数（db 体积把 WAL/SHM 一起算上，才是真正占的地方）
const systemInfo = () => {
  const size = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };
  const mem = process.memoryUsage();
  return {
    node: process.version, platform: process.platform, pid: process.pid,
    uptimeMs: Date.now() - METRICS.startedAt,
    requests: METRICS.requests, apiRequests: METRICS.apiRequests, errors: METRICS.errors,
    rss: mem.rss, heapUsed: mem.heapUsed,
    db: { path: DB_SHOWN, size: size(DB_PATH), wal: size(DB_PATH + '-wal'), shm: size(DB_PATH + '-shm') },
    port: PORT,
  };
};

const pubShare = (s) => ({ enabled: !!s.enabled, code: s.enabled ? s.code : (s.code || null), visibility: s.visibility });

module.exports = { genCode, TRUST_PROXY, clientIp, ensureUser, hashPass, checkPass, newSession, pubAccount, SITE_DEFAULT, siteGet, siteSet, ADMIN_USER, ADMIN_PASS, ADMIN_IS_DEFAULT, seedAdmin, adminDefaultPass, clearAdminDefaultPass, audit, shareOf, sqlTs, stripHtml, INBOX_LIM, cleanText, outlinePoints, relationOf, rateHit, pubMsg, starInGalaxyOf, deliver, DAY, MEM, decayedStrength, litFlags, sanitizeGalaxy, DEMO_CODE, maybeSeedWelcomeInbox, METRICS, json, readBody, tokenOf, systemInfo, pubShare };
