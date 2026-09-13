/* 星图 Stellar Raft — 星港管理台路由（/api/admin/*）
   守卫三条：必须是有效会话（匿名 token 进不来）、角色必须是 admin、每个写操作留一条审计。
   管理员本人在应用里与普通用户完全一样——管理台是多出来的一层，不是另一个身份。 */
const fs = require('node:fs');
const { DB_PATH } = require('../config');
const { db, q } = require('../db');
const {
  json, audit, arr, objArr, cleanText, sqlTs, shareOf, siteGet, siteSet, hashPass,
  adminDefaultPass, clearAdminDefaultPass, systemInfo, decayedStrength, litFlags, DAY,
  ADMIN_USER, ADMIN_PASS_MIN, SITE_DEFAULT, TRUST_PROXY,
} = require('../core');


// 用户的管理侧视图（比 pubAccount 多出运营字段，仍然绝不带 token / 密码哈希）
const adminUser = (u) => ({
  id: u.id, name: u.name, avatar: u.avatar, username: u.username || null, email: u.email || null,
  role: u.role || 'user', registered: !!u.username, banned: !!u.banned, banReason: u.ban_reason || null,
  createdAt: u.created_at, registeredAt: u.registered_at || null, lastSeen: u.last_seen || null,
  ip: u.ip || null, lastIp: u.last_ip || null, lastLogin: u.last_login || null,
});

/* ——— 星系快照的「形状」缓存 ———
   管理台的总览与名单都要把每个人的快照读一遍。300 个用户、46MB 快照时，一次
   /api/admin/overview 要 270ms —— 而它每 10 秒轮询一次。Node 是单线程的，这 270ms
   里全站所有人的请求都在排队等着。

   但缓存不能缓存「数字」：亮度、点亮、熄灭都随时间变，README 承诺的是「每个数字
   都由服务端当场算出」。所以缓存的是**解析结果的形状**——每颗星里参与计算的那几个
   字段（con / strength / sr），它只在这个人保存星系时才变；随时间变的那部分仍然
   每次请求现算。

   新鲜度按 (version, updated_at) 判：任何一次保存都会让它变，于是缓存自动作废。
   拿这个签名只需要一条不含 data 的轻查询，命中时那几百 KB 正文根本不出库。 */
/* 按「缓存了多少颗星」封顶，而不是按「缓存了多少个人」：一个人可能有 20 颗星，
   也可能有 2000 颗，按条数封顶的话内存上限会差两个数量级。40 万颗星大约十几 MB，
   放得下一个中等站点的全部快照形状；超出就按先进先出腾地方——真超了也只是退回
   「用到谁再解析谁」，慢一点，不会错。 */
const SHAPE_STAR_BUDGET = 400000;
const shapeCache = new Map();   // userId -> { sig, shape, n }
let shapeStars = 0;             // 当前缓存里的星数合计
const sigOf = (meta) => String(meta.version || 0) + '|' + (meta.updated_at || '');
const shapeEvict = (userId) => {
  const old = shapeCache.get(userId);
  if (old) { shapeStars -= old.n; shapeCache.delete(userId); }
};

const shapeOf = (userId, meta) => {
  const sig = sigOf(meta);
  const hit = shapeCache.get(userId);
  if (hit && hit.sig === sig) return hit.shape;
  const g = q.getGalaxy.get(userId);
  if (!g) return null;
  let d; try { d = JSON.parse(g.data); } catch { return null; }
  // 只留下参与计算的字段：一颗星从几 KB 收成几十字节
  // objArr：数组里的每一项还得是对象——null/字符串成员照样让 .con 抛 TypeError
  const shape = {
    bytes: Buffer.byteLength(g.data),   // 体积跟着这一版走，省掉每次请求的 LENGTH(data) 全表扫描
    stars: objArr(d.stars).map(s => ({
      con: s.con,
      strength: s.strength,
      sr: s.sr ? { S: s.sr.S, last: s.sr.last, lit: s.sr.lit, ember: s.sr.ember } : undefined,
    })),
    cons: objArr(d.constellations).map(c => ({ id: c.id, name: cleanText(c.name, 60), color: c.color })),
    notes: arr(d.notes).length,
    trash: arr(d.trash).length,
  };
  shapeEvict(userId);   // 同一个人换了新版本：先把旧的那份从账上减掉
  shapeCache.set(userId, { sig, shape, n: shape.stars.length });
  shapeStars += shape.stars.length;
  while (shapeStars > SHAPE_STAR_BUDGET && shapeCache.size > 1) {
    const oldest = shapeCache.keys().next().value;
    if (oldest === userId) break;   // 别把刚放进去的这份挤掉
    shapeEvict(oldest);
  }
  return shape;
};

// 解析某人的星系快照，算出管理台要展示的读数。快照损坏 / 不存在 → null
const galaxyStats = (userId, meta) => {
  const m = meta || q.galaxyMeta.get(userId);
  if (!m) return null;
  const shape = shapeOf(userId, m);
  if (!shape) return null;
  const stars = shape.stars;
  const now = Date.now();
  /* 一趟走完：衰减、点亮/熄灭、星域计数、强度求和。原来是三个 map 加一次
     per-constellation 的全量 filter——对几万颗星来说，省下的是成串的中间数组。 */
  const perCon = new Map();
  let litN = 0, emberN = 0, sum = 0, n = 0;
  for (const s of stars) {
    const r = decayedStrength(s, now);
    if (Number.isFinite(r)) { sum += r; n++; }
    const f = litFlags(s, r);
    if (f.lit) litN++;
    if (f.ember) emberN++;
    perCon.set(s.con, (perCon.get(s.con) || 0) + 1);
  }
  const breakdown = shape.cons.map(c => ({ id: c.id, name: c.name, color: c.color, count: perCon.get(c.id) || 0 }))
    .sort((a, b) => b.count - a.count).slice(0, 12);
  return {
    stars: stars.length,
    lit: litN,
    ember: emberN,
    cons: shape.cons.length,
    notes: shape.notes,
    trash: shape.trash,
    bytes: shape.bytes || 0,
    updatedAt: m.updated_at,
    version: m.version || 0,
    avgStrength: n ? Math.round(sum / n * 1000) / 1000 : 0,
    breakdown,
  };
};

/* 分页口径统一在这里：?page 从 1 起、?size 夹在 5–100，出库形状与旅客名单一致
   （total / page / size / pages），前端一套翻页控件就能通吃所有名单。
   越界的页号夹回最后一页——删到只剩一页时仍停在第 7 页会看见一片空白。 */
const paginate = (rows, url, defSize = 20) => {
  const size = Math.min(100, Math.max(5, Number(url.searchParams.get('size')) || defSize));
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pages, Math.max(1, Number(url.searchParams.get('page')) || 1));
  return { total, page, size, pages, slice: rows.slice((page - 1) * size, page * size) };
};

/* 返回 true 表示已应答；返回 false 交回 server.js 继续派发。 */
async function handleAdmin(ctx) {
  const { req, res, url, seg, body, me, sess, isAdmin, token, site } = ctx;
  if (seg[1] !== 'admin') return false;
  if (!sess || !isAdmin) return json(res, 403, { error: '需要管理员权限' });

  // ——— 总览：一次算清全站家底 ———
  if (seg[2] === 'overview' && req.method === 'GET') {
    const users = q.allUsers.all();
    const now = Date.now();
    const within = (ts, days) => ts && (now - Date.parse(String(ts).replace(' ', 'T') + 'Z')) < days * DAY;
    let stars = 0, lit = 0, ember = 0, cons = 0, notes = 0, bytes = 0, galaxies = 0;
    /* 按「有快照的人」遍历，而不是按全部用户逐个去问有没有快照；每条 meta 只带
       版本与体积，正文只在形状缓存失效时才真的读出来。 */
    const alive = new Set(users.map(u => u.id));
    for (const meta of q.allGalaxyMeta.all()) {
      if (!alive.has(meta.user_id)) continue;   // 主人已被删掉的孤儿快照不计入
      const st = galaxyStats(meta.user_id, meta);
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
    const filter = url.searchParams.get('filter') || 'all';   // all | registered | anonymous | admin | banned

    /* 三张计数表各来一次 GROUP BY，而不是逐行三次查询（原来是 3N 次往返） */
    const nOf = (rowsArr) => { const m = new Map(); for (const r of rowsArr) m.set(r.user_id, r.n); return m; };
    const sessN = nOf(q.sessionCounts.all());
    const visN = nOf(q.visitorCounts.all());
    const shareOn = new Set(q.shareFlags.all().filter(r => r.enabled).map(r => r.user_id));
    const metaOf = new Map(q.allGalaxyMeta.all().map(m => [m.user_id, m]));

    let rows = q.allUsers.all().map(u => ({
      ...adminUser(u),
      sessions: sessN.get(u.id) || 0,
      visitors: visN.get(u.id) || 0,
      shareEnabled: shareOn.has(u.id),
    }));
    if (filter === 'registered') rows = rows.filter(r => r.registered);
    else if (filter === 'anonymous') rows = rows.filter(r => !r.registered);
    else if (filter === 'admin') rows = rows.filter(r => r.role === 'admin');
    else if (filter === 'banned') rows = rows.filter(r => r.banned);
    // 搜索兼收 IP：排查「这个地址上都有谁」时不必换一个页面
    if (kw) rows = rows.filter(r => [r.name, r.username, r.email, r.ip, r.lastIp].some(v => String(v || '').toLowerCase().includes(kw)));

    /* 星系读数只给真正要出库的那 20 行算。
       例外是「按星数排序」——那得先知道每个人有多少颗星，才排得出先后。 */
    const withStats = (r) => {
      const st = galaxyStats(r.id, metaOf.get(r.id)) || { stars: 0, lit: 0, cons: 0, bytes: 0, updatedAt: null };
      return { ...r, stars: st.stars, lit: st.lit, constellations: st.cons, snapshotBytes: st.bytes, lastSaved: st.updatedAt || null };
    };
    if (sort === 'stars') rows = rows.map(withStats);

    const key = { id: r => r.id, name: r => String(r.username || r.name).toLowerCase(), stars: r => r.stars,
      lastSeen: r => r.lastSeen || '', created: r => r.createdAt || '' }[sort];
    rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1); });
    const p = paginate(rows, url);
    const users2 = sort === 'stars' ? p.slice : p.slice.map(withStats);
    return json(res, 200, { total: p.total, page: p.page, size: p.size, pages: p.pages, users: users2 });
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
      // 管理员的钥匙开的是全站所有人的星空，下限与交接卡同一条线（core.js ADMIN_PASS_MIN）
      const min = (target.role || 'user') === 'admin' ? ADMIN_PASS_MIN : 6;
      if (pw.length < min) return json(res, 400, { error: `密码至少 ${min} 位` });
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
    // 汇总读数按全量算（顶部三个数字要说的是全站，不是这一页）
    const summary = {
      ips: rows.length,
      guests: rows.reduce((a, r) => a + r.count, 0),
      zombies: rows.reduce((a, r) => a + r.zombies, 0),
    };
    const p = paginate(rows, url, 10);   // 每个 IP 一张卡、卡里还嵌着游客明细，一页 10 组足够
    return json(res, 200, {
      limit: site.guestPerIp, trustProxy: TRUST_PROXY, idleDays: days,
      ...summary,
      total: p.total, page: p.page, size: p.size, pages: p.pages,
      rows: p.slice,
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
    // 会话令牌只出一段指纹（够肉眼区分同一人的多台设备），完整 token 绝不出库；
    // 要断开就用 users/:id/revoke 踢掉那个人的全部会话
    const all = q.allSessions.all().map(s => ({
      fingerprint: s.token.slice(2, 10), ip: s.last_ip || null,
      userId: s.user_id, name: s.name, username: s.username || null, avatar: s.avatar, role: s.role || 'user',
      createdAt: s.created_at, lastSeen: s.last_seen, current: s.token === token,
    }));
    const p = paginate(all, url);
    return json(res, 200, { total: p.total, page: p.page, size: p.size, pages: p.pages, sessions: p.slice });
  }

  // ——— 分享总览：谁把星系开给了外面 ———
  if (seg[2] === 'shares' && seg.length === 3 && req.method === 'GET') {
    const all = q.allShares.all().map(s => {
      const u = q.userById.get(s.user_id);
      return {
        userId: s.user_id, name: u ? u.name : '（已删除）', username: u ? (u.username || null) : null, avatar: u ? u.avatar : '星',
        enabled: !!s.enabled, code: s.code, visibility: s.visibility,
        visitors: q.countVisitorsOf.get(s.user_id).n,
      };
    });
    // 开着的排前面，其次按访客多寡——翻页时最该管的那些始终在第一页
    all.sort((a, b) => (b.enabled - a.enabled) || (b.visitors - a.visitors) || (a.userId - b.userId));
    const p = paginate(all, url);
    return json(res, 200, { total: p.total, page: p.page, size: p.size, pages: p.pages, shares: p.slice });
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
  if (seg[2] === 'audit' && seg.length === 3 && req.method === 'GET') {
    // 日志可能上千条：分页走 SQL 的 LIMIT/OFFSET，不把整张表读进内存再切
    const size = Math.min(100, Math.max(5, Number(url.searchParams.get('size')) || 20));
    const total = q.auditCount.get().n;
    const pages = Math.max(1, Math.ceil(total / size));
    const page = Math.min(pages, Math.max(1, Number(url.searchParams.get('page')) || 1));
    return json(res, 200, {
      total, page, size, pages,
      entries: q.auditPage.all(size, (page - 1) * size).map(a => ({
        id: a.id, actor: a.actor_name, action: a.action,
        target: a.target_name, targetId: a.target_id, detail: a.detail, at: a.created_at,
      })),
    });
  }

  /* 清空日志。审计日志被清这件事本身也要留痕——清完立刻补写一条，
     写明清掉了多少、谁清的。否则「日志能被人无声抹掉」，它就不再是审计。 */
  if (seg[2] === 'audit' && seg[3] === 'clear' && req.method === 'POST') {
    const n = q.auditCount.get().n;
    q.auditClear.run();
    audit(me, 'audit.clear', null, '清空 ' + n + ' 条');
    return json(res, 200, { ok: true, removed: n });
  }

  // ——— 数据库维护 ———
  if (seg[2] === 'maintenance' && req.method === 'POST') {
    const act = body.action;
    const walSize = () => { try { return fs.statSync(DB_PATH + '-wal').size; } catch { return 0; } };
    try {
      if (act === 'checkpoint') {
        /* 收拢 WAL 是幂等的：没东西可收时它照样「成功」。以前无论收没收到都写一条
           审计并回一句 ok，于是反复点就反复刷屏，日志里全是无内容的 db.checkpoint。
           现在按真实结果说话——量一下 WAL 收缩了多少，没收到就明说，也不写审计。 */
        const before = walSize();
        const r = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() || {};
        const freed = Math.max(0, before - walSize());
        if (Number(r.busy)) return json(res, 200, { ok: false, busy: true, freed: 0, system: systemInfo() });
        return json(res, 200, { ok: true, freed, pages: Number(r.log) || 0, system: systemInfo() });
      }
      else if (act === 'vacuum') { db.exec('VACUUM'); }
      else if (act === 'prune-sessions') {
        // 与 core.js 的 SESSION_TTL_DAYS 同一条线：那边在使用时就地判失效，
        // 这里只是把已经死掉的行从表里扫走——不点也不影响安全
        const info = db.prepare("DELETE FROM sessions WHERE last_seen < datetime('now', '-90 days')").run();
        audit(me, 'db.prune-sessions', null, Number(info.changes) + ' 个');
        return json(res, 200, { ok: true, removed: Number(info.changes), system: systemInfo() });
      }
      else return json(res, 400, { error: '未知的维护操作' });
    } catch (e) {
      // sqlite 的报错里常带着库表结构与文件绝对路径：详情进控制台，出门只留一句话
      console.error('[stellar-raft] 数据库维护失败：', e);
      return json(res, 500, { error: '这次维护没能跑完，详情见服务器日志' });
    }
    /* 收拢 WAL 与 VACUUM 都只是搬运字节，不动任何一条用户数据，而且随时可以再来一次。
       给它们逐次留痕，只会让真正要紧的停用 / 删号 / 改密被淹掉——何况每个请求都在写
       last_seen，WAL 永远不会真的空，于是「收拢」永远收得到东西、永远写得出一条。
       删会话的 prune-sessions 确实销毁数据，那一条仍然留痕（在上面各自返回）。 */
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
      'Cache-Control': 'no-store',   // 整库文件（哈希、会话、笔记）不该在任何共享缓存里留副本
    });
    const stream = fs.createReadStream(DB_PATH);
    stream.on('error', () => { try { res.destroy(); } catch { /* 已经断了 */ } });   // 读到一半出错不带走进程
    return stream.pipe(res);
  }

  return json(res, 404, { error: '未知接口' });
}

module.exports = { handleAdmin };
