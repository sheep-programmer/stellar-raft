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

   本文件只负责请求管线：解析身份 → 过封禁 / 维护 / 门禁三道闸 → 派发到路由模块。
   数据在 db.js，公共能力在 core.js，管理台在 routes/admin.js。

   启动：node --no-warnings server/server.js   （默认端口 8756） */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { PORT, ROOT, APP_DIR, DB_SHOWN } = require('./config');
const { q } = require('./db');
const {
  json, readBody, tokenOf, clientIp, ensureUser, hashPass, checkPass, newSession, pubAccount,
  siteGet, adminDefaultPass, clearAdminDefaultPass, shareOf, pubShare, genCode, sanitizeGalaxy,
  cleanText, outlinePoints, INBOX_LIM, relationOf, pubMsg, starInGalaxyOf, deliver,
  METRICS,
} = require('./core');
const { runSeeds } = require('./seed');
const { handleAdmin } = require('./routes/admin');

runSeeds();

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

     返回 true = 已经替你应答完毕，调用方必须立刻 return，否则同一个响应会被写第二遍。
     json() 本身就回 true（见 core.js），所以这里直接把它转发出去。 */
  const needAccount = (feature) => {
    if (me.username) return false;
    if (!site.guestGates[feature]) return false;
    return json(res, 403, {
      error: '这项功能需要一个账号 —— 注册后星空会原地跟着你走，换台设备也能回来。',
      needAccount: true, feature,
    });
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
  /* ——— 星港管理台 ——— */
  if (await handleAdmin({ req, res, url, seg, body, me, sess, isAdmin, token, site })) return;

  return json(res, 404, { error: '未知接口' });
}

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
  console.log(`[stellar-raft] http://localhost:${PORT}${APP_DIR}  (静态 + API · 数据库 ${DB_SHOWN})`);
});

