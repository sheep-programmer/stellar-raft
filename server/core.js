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
  const seeded = maybeSeedWelcomeInbox(u); // 新装 DB 的第一位旅行者：收件箱里预置两封「星际来信」
  // created：这一行是这次请求现建的。注册校验没过时调用方据此把它收回去
  return { user: u, created: true, seeded };
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
   default_pass 标记：这个标记还在，就说明出厂凭据仍然当值——管理员一登录就会被
   请去交接（/api/auth/handover：用户名与密码一起换），交接完标记即摘。
   只种一次：种过之后即便管理员被删也不再自动重建（避免删号后幽灵复活）。 */
const ADMIN_USER = String(process.env.SR_ADMIN_USER || 'admin');
const ADMIN_PASS = String(process.env.SR_ADMIN_PASS || 'stellar-admin');
/* 「还是出厂凭据吗」——两样都得由运维自己指定才算不是。只设了密码，用户名仍是
   公开的 admin；只设了用户名，密码仍是公开的 stellar-admin。交接卡的整个理由就是
   「两样都公开的东西一起换掉」，所以判据也必须是两样都数。 */
const ADMIN_IS_DEFAULT = !(process.env.SR_ADMIN_PASS && process.env.SR_ADMIN_USER);
/* 交接后的管理员密码下限比普通账号（6 位）高：这一把钥匙开的是整台服务器上
   所有人的星空，而不是一个人的。UI 上的提示与这里同一个数。 */
const ADMIN_PASS_MIN = 8;
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
const outlinePoints = (star) => arr(star.body)
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

/* ——— 滑动窗口计数器 ———
   「某某在最近这段时间里做了几次」——登录失败、密文猜错，都是这一件事。
   只记在进程内存里，重启归零：挡的是自动化字典，不值得为它再加一张表。 */
const slidingHits = new Map();   // 'ns:key' -> 失败时刻数组
const hitsOf = (bucket, windowMs) => {
  const now = Date.now();
  const arr = slidingHits.get(bucket) || [];
  while (arr.length && now - arr[0] > windowMs) arr.shift();
  if (arr.length) slidingHits.set(bucket, arr); else slidingHits.delete(bucket);   // 不留空桶
  return arr;
};
// 还能不能再来一次：能 → null；不能 → { retryAfter 秒 }
const slidingCheck = (bucket, limit, windowMs) => {
  const arr = hitsOf(bucket, windowMs);
  if (arr.length < limit) return null;
  return { retryAfter: Math.max(1, Math.ceil((windowMs - (Date.now() - arr[0])) / 1000)) };
};
/* 顺手清扫：桶只在「被再次碰到」时才过期，于是撒网猜名（每换一个用户名就是一个
   新桶）会让这张表一直长下去。攒到一定数量就整体扫一遍已经过期的——O(n) 但极少
   触发，比给每个桶挂一个定时器省事得多。 */
const SWEEP_AT = 5000;
const sweepSliding = (windowMs) => {
  if (slidingHits.size < SWEEP_AT) return;
  const now = Date.now();
  for (const [k, arr] of slidingHits) {
    if (!arr.length || now - arr[arr.length - 1] > windowMs) slidingHits.delete(k);
  }
};
const slidingHit = (bucket, windowMs) => {
  sweepSliding(windowMs);
  const arr = hitsOf(bucket, windowMs); arr.push(Date.now()); slidingHits.set(bucket, arr);
};
const slidingClear = (bucket) => slidingHits.delete(bucket);

/* ——— 登录节流 ———
   scrypt 慢，但慢不过一台不睡觉的机器；公网部署时这是账号前面唯一一道门。
   两本账各记各的：来源 IP（一台机器换着账号猜）与账号标识（一群机器猜同一个账号），
   任一本在 15 分钟窗口里攒够上限，这把钥匙就先停一会儿。登录成功即两本账一起销。

   两处取舍写在这里，免得后来人当成 bug：
   · 账号那本按账号名记，不掺 IP —— 一群机器分头猜同一个账号照样会撞上限。代价是
     有人故意连敲 6 次错密码就能让这个账号歇 15 分钟；窗口自己会过，主人不必找管理员，
     换来的是「密码能被慢慢磨出来」这件事不成立，值。
   · IP 那本给得宽（50）：校园网、公司出口这类大 NAT 后面，几十号人共用一个地址；
     反代后若忘了开 SR_TRUST_PROXY=1，全站更是共用 127.0.0.1。门槛太低会把好人一起锁死，
     而脚本刷字典几秒钟就能撞满 50，宽一点并不放过它。 */
const LOGIN_LIM = { perIp: 50, perAccount: 6, windowMs: 15 * 60000 };
const loginKeys = (ip, idf) => [
  { key: 'login-ip:' + ip, limit: LOGIN_LIM.perIp },
  { key: 'login-id:' + String(idf || '').toLowerCase(), limit: LOGIN_LIM.perAccount },
];
const loginGuard = (ip, idf) => {
  for (const { key, limit } of loginKeys(ip, idf)) {
    const wait = slidingCheck(key, limit, LOGIN_LIM.windowMs);
    if (wait) return wait;
  }
  return null;
};
const loginFailed = (ip, idf) => { for (const { key } of loginKeys(ip, idf)) slidingHit(key, LOGIN_LIM.windowMs); };
/* 只销「账号」那一本。IP 那本必须留着自然过期——它拦的是「一台机器换着账号猜」，
   而攻击者手上总有一个自己的有效账号：每撞 49 次就登录自己一次，就能把 IP 那本清零，
   per-IP 的 50 次于是永远攒不满，这道闸等于不存在。 */
const loginPassed = (ip, idf) => slidingClear('login-id:' + String(idf || '').toLowerCase());

/* ——— 密文猜测节流 ———
   分享密文是 32 个字母里取 8 位（约 40 bit），在线穷举本来就不现实——这道闸拦的
   不是数学，是噪音：脚本对着 /api/friends/redeem 撒网，会在审计与访客表里留下一地
   垃圾。同一 IP 在 10 分钟里撞空 100 次就先歇一会儿。

   两处分寸：只有「这个密文根本不存在」才算一次猜测——密文存在但主人关了分享是
   正常的扑空，不该因为朋友收了星系就把人锁在门外；上限给到 100 也是同一个意思，
   真人一辈子也撞不到，脚本几秒钟就撞满。 */
const REDEEM_LIM = { limit: 100, windowMs: 10 * 60000 };
const redeemGuard = (ip) => slidingCheck('redeem:' + ip, REDEEM_LIM.limit, REDEEM_LIM.windowMs);
const redeemFailed = (ip) => slidingHit('redeem:' + ip, REDEEM_LIM.windowMs);

/* ——— 会话的寿命 ———
   登录态本就不该无限期。以前「90 天没露面的会话」只是管理台「系统」页上的一个
   按钮：没人点，两年前泄漏的令牌今天照样通行。改成每次解析身份时就地判——过期的
   当场删掉，那个按钮从此只是顺手打扫，而不是唯一的过期机制。
   窗口按 last_seen 滑动：天天在用的设备永远不会被判过期。 */
const SESSION_TTL_DAYS = 90;
// 会话令牌长这样（newSession 出品）。匿名令牌是 'u-'+uuid，两者不会认错
const isSessionToken = (t) => /^s_[0-9a-f]{48}$/.test(String(t || ''));
const liveSession = (token) => {
  const s = q.sessionByToken.get(token);
  if (!s) return null;
  const seen = sqlTs(s.last_seen || s.created_at);
  if (seen && Date.now() - seen > SESSION_TTL_DAYS * DAY) { q.deleteSession.run(token); return null; }
  return s;
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
  try { return arr(JSON.parse(g ? g.data : '{}').stars).find(x => x && x.id === starId) || null; }
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
    /* 造访邀请里的密文是投递那一刻的快照。主人重置密文后再寄是正当操作，
       若幂等原样返回，好友手里那封「等待领取」的邀请永远是一串死码——
       去重照做（不重复入库、不占配额），但把最新密文刷进那封未领取的邀请。 */
    if (dup) {
      if (kind === 'galaxy') q.inboxRefresh.run(JSON.stringify(payload), dup.id);
      return json(res, 200, { ok: true, duplicate: true, message: pubMsg(q.inboxById.get(dup.id)) });
    }
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
/* 快照里那些「本该是数组」的字段，谁也不保证它真的是数组：老版本客户端、
   手改过的备份、或者一个直接调接口的人，都能塞进一个字符串。而 `(d.x || []).map`
   对字符串会当场抛异常——出口是 500，并且因为管理台会遍历每个人的快照，一个人
   的坏数据能让整个管理台再也打不开。写入端已经拦了一道，这里是对付已经进了库的。 */
const arr = (v) => (Array.isArray(v) ? v : []);
/* 再往下一层：数组里的每一项也得是对象。`null.id`、字符串星的 `body.filter`
   一样是 TypeError——出口仍是 500，且坏数据在库里，每次造访 / 每次管理台遍历必现。 */
const objArr = (v) => arr(v).filter(x => x && typeof x === 'object');

const sanitizeGalaxy = (raw, visibility) => {
  let d; try { d = JSON.parse(raw); } catch { return null; }
  const now = Date.now();
  const outline = visibility === 'outline';
  const stars = objArr(d.stars).map(s => {
    const strength = decayedStrength(s, now);
    const flags = litFlags(s, strength);
    const body = Array.isArray(s.body) ? s.body : [];
    return {
      id: s.id, con: s.con, x: s.x, y: s.y,
      strength, importance: s.importance, label: cleanText(s.label, 120),
      lit: flags.lit, ember: flags.ember,
      tags: outline ? arr(s.tags).filter(t => typeof t === 'string').slice(0, 12) : [],
      outline: outline
        ? body.filter(b => b && ['h1', 'h2', 'h3'].includes(b.type)).map(b => ({ type: b.type, text: stripHtml(b.text).slice(0, 120) }))
        : [],
    };
  });
  return {
    visibility,
    // 星域 health / count / litRatio 不透传快照静态值：按衰减后的成员强度实时重算，
    // 与前端 data.js 的 syncCounts 同口径（health = 均值 / count = 现存成员数 /
    // litRatio = 已点亮成员占比，访客端按实时熄灭后的 lit 布尔计）
    constellations: objArr(d.constellations).map(c => {
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
    connections: objArr(d.connections).map(c => ({ a: c.a, b: c.b, kind: c.kind })),
  };
};

/* 星际来信种子：仅在「新装 DB 种子」标记尚未消费时，给第一位真实用户的收件箱
   预置一封 kind:'galaxy'（造访邀请）与一封 kind:'star'（赠星），寄件人都是演示
   好友「星图伙伴」——新用户第一次打开收件箱就能看到来信长什么样。 */
// 返回 true = 这一次真的把「欢迎来信」发掉了（标记随之消耗）。
// 调用方据此在回滚时把标记还回去——否则一次失败的注册就能把新装库的这份见面礼吃掉。
const maybeSeedWelcomeInbox = (user) => {
  if (!user || user.token === 'demo-friend-token') return false;
  if (!q.metaGet.get('welcome_inbox_pending')) return false;
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
  return true;
};

/* ============================ 运行指标 ============================ */
// 进程级轻量计数（重启归零，不落盘）：管理台「系统」页的实时读数
const METRICS = { startedAt: Date.now(), requests: 0, apiRequests: 0, errors: 0 };

/* ——— 应答与请求体 ——— */
/* json() 回 true = 「这个请求我应答完了」。路由模块里现成的 `return json(...)`
   因此天然成为「已处理」的信号，server.js 据此停止往下派发。 */
const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    // 别让浏览器去猜类型：接口回的永远是 JSON，猜出个 HTML 来就有了执行面
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
  return true;
};

/* 请求体上限。整片星空是一次整存，所以这条线同时也是「一片星空能有多大」——
   笔记里内联的图片最容易把它顶穿，编辑器那侧因此会先把大图压一遍。 */
const BODY_LIMIT = 8 * 1024 * 1024;
const readBody = (req) => new Promise((resolve, reject) => {
  /* 攒 Buffer，最后一次性解码 —— 不要 `buf += chunk`。
     那样写等于对每个 TCP chunk 单独做 utf8 解码，而一个多字节字符完全可能被
     chunk 边界劈成两半：前半截和后半截各自解码成一个 U+FFFD（�）。JSON 依然
     合法，于是 200 OK、不报错、坏数据直接落库。

     这对一个中文笔记应用是致命的：整片星空一次整存，星系一超过一个 chunk
     （约 64KB）就开始吃字。实测 192KB 的请求体丢 5 个字，720KB 丢 18 个。 */
  const chunks = [];
  let over = false, seen = 0;
  req.on('data', (c) => {
    seen += c.length;   // c 是 Buffer，length 就是字节数（上限量的也该是字节，不是 UTF-16 码元）
    /* 判超之后不掐断连接，而是把剩下的字节读完丢掉。
       这一点很反直觉却很重要：req.destroy() 会连同刚写出去的 413 一起断掉，
       客户端收到的只是一句 ECONNRESET——「太大了」这句话根本送不到人眼前。
       只有真的在灌流量（超过上限八倍）才动手掐。 */
    if (over) { if (seen > BODY_LIMIT * 8) req.destroy(); return; }
    if (seen > BODY_LIMIT) {
      over = true; chunks.length = 0;
      // 打上标记，让路由能把它和「JSON 解析不了」分开说——两者对用户的意思完全不同
      const e = new Error('body too large'); e.tooLarge = true;
      reject(e);
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    if (over) return;   // 已经 reject 过了，别再落定第二次
    try {
      const v = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      // 合法 JSON 未必是个对象：字面量 null / 数字 / 字符串都能解析成功，
      // 而每个路由接下来都会读 body.xxx —— null 会当场把请求崩成 500。
      // 统一收成对象，非对象的请求体等同于「什么都没带」。
      resolve(v && typeof v === 'object' ? v : {});
    } catch (e) { reject(e); }
  });
  req.on('error', reject);
});

/* 令牌只从 Authorization 头取；?token= 是给两个够不着请求头的入口开的小门：
   卸载时的 sendBeacon，和浏览器自己发起的备份下载导航。别处一律不认——
   URL 里的令牌会顺着 Referer、代理访问日志和浏览器历史一路留下来。 */
const QUERY_TOKEN_PATHS = new Set(['/api/galaxy/beacon', '/api/admin/backup']);
const tokenOf = (req, url) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (QUERY_TOKEN_PATHS.has(url.pathname)) return url.searchParams.get('token') || '';
  return '';
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

module.exports = { genCode, TRUST_PROXY, clientIp, ensureUser, hashPass, checkPass, newSession, pubAccount, SITE_DEFAULT, siteGet, siteSet, ADMIN_USER, ADMIN_PASS, ADMIN_PASS_MIN, ADMIN_IS_DEFAULT, seedAdmin, adminDefaultPass, clearAdminDefaultPass, audit, shareOf, sqlTs, stripHtml, INBOX_LIM, cleanText, outlinePoints, relationOf, arr, objArr, rateHit, LOGIN_LIM, REDEEM_LIM, redeemGuard, redeemFailed, SESSION_TTL_DAYS, isSessionToken, liveSession, loginGuard, loginFailed, loginPassed, pubMsg, starInGalaxyOf, deliver, DAY, MEM, decayedStrength, litFlags, sanitizeGalaxy, DEMO_CODE, maybeSeedWelcomeInbox, METRICS, json, readBody, BODY_LIMIT, tokenOf, QUERY_TOKEN_PATHS, systemInfo, pubShare };
