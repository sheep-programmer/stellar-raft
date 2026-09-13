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
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PORT, HOST, ROOT, APP_DIR, DB_SHOWN } = require('./config');
const { q } = require('./db');
const {
  json, readBody, tokenOf, clientIp, ensureUser, hashPass, checkPass, newSession, pubAccount,
  siteGet, adminDefaultPass, clearAdminDefaultPass, shareOf, pubShare, genCode, sanitizeGalaxy,
  cleanText, outlinePoints, INBOX_LIM, relationOf, pubMsg, starInGalaxyOf, deliver,
  ADMIN_USER, ADMIN_PASS, ADMIN_PASS_MIN, audit, isSessionToken, liveSession, BODY_LIMIT,
  loginGuard, loginFailed, loginPassed, redeemGuard, redeemFailed, METRICS,
} = require('./core');
const { runSeeds } = require('./seed');
const { handleAdmin } = require('./routes/admin');

runSeeds();

/* 星系快照的形状检查。只认「该是数组的必须是数组」这一条，别的一律不管——
   这是一份客户端自己的数据结构，服务端不该替它定义内容。

   但这一条必须拦：`(d.constellations || []).map(...)` 对一个字符串会当场抛异常，
   而管理台的总览要遍历**每个人**的快照。于是任何一个普通用户存一次
   `constellations: "x"`，就能让管理员再也打不开管理台——一次写入，全站瘫掉。
   实测过：存完之后 /api/admin/overview 与 /api/admin/users?sort=stars 双双 500。 */
const GALAXY_ARRAYS = ['stars', 'constellations', 'connections', 'notes', 'inbox', 'timeline', 'trash'];
function galaxyShapeError(data) {
  if (!Array.isArray(data.stars)) return 'data.stars 必须是数组';
  for (const k of GALAXY_ARRAYS) {
    if (data[k] != null && !Array.isArray(data[k])) return `data.${k} 必须是数组`;
  }
  return null;
}

/* 拿来给「查无此人」当陪跑的哈希：进程起来时算一次，之后每次落空的登录都拿它
   再跑一遍 scrypt，好让两条路的耗时对不出差别。它对应的明文不存在于任何地方。 */
const DUMMY_HASH = hashPass(crypto.randomBytes(32).toString('hex'));

async function handleApi(req, res, url) {
  const seg = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const token = tokenOf(req, url);
  if (!token) return json(res, 401, { error: '缺少访问令牌' });
  let body = {};
  if (req.method === 'POST' || req.method === 'PUT') {
    try { body = await readBody(req); }
    catch (e) {
      /* 「太大」和「不是 JSON」得分开说：前者是这片星空真的胖了（多半是笔记里内联的
         大图），客户端据此给一句人话；混成 400「格式错误」只会让人以为是自己发错了。 */
      if (e && e.tooLarge) {
        return json(res, 413, {
          error: `这次要保存的内容超过 ${Math.round(BODY_LIMIT / 1024 / 1024)}MB —— 多半是笔记里内联了大图，压缩或改成外链后即可保存。`,
          tooLarge: true,
        });
      }
      return json(res, 400, { error: '请求体格式错误' });
    }
  }
  const ip = clientIp(req);

  /* ——— 登录 / 退出：先于身份解析 ———
     这两件事都不需要知道「当前是谁」：登录靠用户名密码认人，退出只认令牌本身。
     放在最前面顺手解开三个死结：维护期间管理员仍然登得进来；被停用的人还能干净
     地离开；游客名额已满的 IP 上，人依然能登录——那正是我们请他去做的事。 */
  if (seg[1] === 'auth' && seg[2] === 'login' && req.method === 'POST') {
    const idf = String(body.id || '').trim();
    /* 字典攻击的闸门：同一 IP / 同一账号攒够失败就先停一会儿。停的是「再试一次」，
       不是这个账号——窗口一过自己就开，主人不必找管理员解锁。 */
    const wait = loginGuard(ip, idf);
    if (wait) {
      return json(res, 429, {
        error: `登录尝试太多了，请 ${Math.ceil(wait.retryAfter / 60)} 分钟后再试。`,
        retryAfter: wait.retryAfter,
      });
    }
    const u = q.userByUsername.get(idf) || q.userByEmail.get(idf);
    /* 账号不存在时也走一遍同样重的 scrypt。否则「查无此人」几毫秒就回来、
       「密码不对」要慢上两个数量级——光靠计时就能把这台服务器上有哪些账号问出来，
       而那正是撞库的第一步。两条路同样慢，答案也同样含糊。 */
    let ok = false;
    if (u && u.pass) {
      ok = checkPass(String(body.password || ''), u.pass);
    } else {
      // 陪跑，只为耗时——这一行看着像死代码，删掉就等于把「有没有这个账号」重新说出去
      checkPass(String(body.password || ''), DUMMY_HASH);
    }
    if (!ok) {
      loginFailed(ip, idf);
      return json(res, 401, { error: '用户名或密码不对' });
    }
    loginPassed(ip, idf);   // 密码对了：两本账一起销，下一次手滑不从半满的桶开始
    if (u.banned) return json(res, 403, { error: u.ban_reason || '这个账号已被管理员停用', banned: true });
    q.touchLogin.run(ip, u.id);   // 登录足迹：管理台「最近登录」与用户详情里的真实来源
    q.touchUserSeen.run(u.id);
    return json(res, 200, { session: newSession(u.id), user: pubAccount(u) });
  }
  if (seg[1] === 'auth' && seg[2] === 'logout' && req.method === 'POST') {
    q.deleteSession.run(token);
    return json(res, 200, { ok: true });
  }

  // 鉴权链：session 优先（登录态，liveSession 顺手判过期），未命中退回匿名 token 建档
  const sess = liveSession(token);
  let me;
  let freshRow = false;   // 这次请求现建的匿名行：注册校验没过时要收回去
  let freshSeeded = false;   // 且这一行顺手把「欢迎来信」的标记消耗掉了
  if (sess) {
    me = q.userById.get(sess.user_id);
    q.touchSession.run(token);
    if (me && me.last_ip !== ip) q.touchIp.run(ip, me.id);
  } else {
    /* 一把解析不出会话的会话令牌 = 这个登录态已经没了：管理员强制下线、账号被删、
       或者太久没露面被判过期。这里以前会径直掉进 ensureUser，拿 s_… 当匿名令牌
       新建一位游客——人明明是被请下线的，却变成一位崭新的旅行者，星空空空如也，
       还白占掉这个 IP 的游客名额。现在明说：登录已失效，请重新登录。 */
    if (isSessionToken(token)) return json(res, 401, { error: '这台设备的登录已失效，请重新登录', sessionExpired: true });
    // 注册豁免限额：注册的下一步就是 username 落地，这一行马上不再算游客——
    // 名额已满时更要放行，否则「请去注册」就成了一句做不到的话
    const registering = seg[1] === 'auth' && seg[2] === 'register' && req.method === 'POST';
    const r = ensureUser(token, body.name, body.avatar, ip, registering);
    if (r.error) return json(res, 403, { error: r.error, guestLimit: true });
    me = r.user;
    freshRow = !!r.created; freshSeeded = !!r.seeded;
  }
  // session 指向一个已被删除的账号：同样是「这个登录态没了」，走同一张说明页
  if (!me) return json(res, 401, { error: '这台设备的登录已失效，请重新登录', sessionExpired: true });
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
    /* 注册走的是「先建号、再校验」：为了让名额已满的 IP 也能注册，ensureUser 对注册
       豁免了游客限额。代价是每一次失败的注册都在库里留下一个匿名账号——非法用户名、
       短密码、甚至「星港已关闭注册」，都能被拿来无限写库，游客限额与注册开关一起绕过。
       所以校验不过时，把这次现建的那一行收回去。 */
    const bail = (code, obj) => {
      if (freshRow && !me.username) {
        /* 按管理台删号的同一套顺序清依赖再删本行。少了这一步，新装库的第一位
           旅行者会带着「欢迎来信」（maybeSeedWelcomeInbox），删用户当场撞外键，
           回滚静静失败——那一行照样留在库里占着这个 IP 的游客名额。 */
        try {
          q.dropGalaxyOf.run(me.id); q.dropShareOf.run(me.id);
          q.dropFriendshipsOf.run(me.id, me.id); q.dropMailOf.run(me.id, me.id);
          q.dropSessionsOf.run(me.id); q.dropUser.run(me.id);
          // 见面礼的标记也还回去，留给真正的第一位旅行者
          if (freshSeeded) q.metaSet.run('welcome_inbox_pending', '1');
        } catch (e) { console.error('[stellar-raft] 注册回滚失败：', e); }
      }
      return json(res, code, obj);
    };
    if (me.username) return json(res, 409, { error: '当前已登录账号，如需另建请先退出' });
    if (!site.registrationOpen) return bail(403, { error: '星港暂时关闭了新账号注册' });
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!/^[\w一-龥-]{2,24}$/.test(username)) return bail(400, { error: '用户名需 2–24 个字符（中英文、数字、_ 或 -）' });
    // 长度先卡再验格式：这个正则对超长输入是线性的，但真正的问题是一兆长的「合法邮箱」会原样进库
    if (email && (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))) return bail(400, { error: '邮箱格式不对' });
    if (password.length < 6) return bail(400, { error: '密码至少 6 位' });
    if (q.userByUsername.get(username)) return bail(409, { error: '这个用户名已经有主人了' });
    if (email && q.userByEmail.get(email)) return bail(409, { error: '这个邮箱已经绑定过账号' });
    try { q.registerUser.run(username, email || null, hashPass(password), me.id); }
    catch { return bail(409, { error: '用户名或邮箱刚被占用，换一个试试' }); }   // 并发窗口撞唯一索引
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
    /* 管理员改掉出厂密码 → 摘掉「出厂凭据仍然当值」的标记。正常路径是下面的交接
       （用户名与密码一起换），这一行留给只走改密这条路的老库与直接调接口的人。 */
    if (isAdmin && me.username === ADMIN_USER) clearAdminDefaultPass();
    return json(res, 200, { ok: true });
  }
  /* POST /api/auth/handover — 星港交接：出厂管理员第一次登录时把用户名与密码一起换掉。
     只改密码不够：出厂用户名同样写在 README 和控制台上，留着它等于把门牌号也交出去，
     攻击者省下的正是「先猜中是谁」这一步。所以两样一起换，缺一不可。

     换完顺手吊销这个账号的全部会话，再发一把新钥匙给当前这台设备 —— 出厂凭据是公开
     知识，别处可能早就拿它登进来了，交接之后那些会话一个都不该活着。

     只在出厂凭据仍然当值时开门（admin_default_pass 标记还在）；交接过一次就 409，
     之后改密走 /api/auth/password、改名由管理台负责。 */
  if (seg[1] === 'auth' && seg[2] === 'handover' && req.method === 'POST') {
    if (!sess || !me.username || !me.pass) return json(res, 401, { error: '尚未登录账号' });
    if (!isAdmin) return json(res, 403, { error: '只有管理员需要交接星港' });
    // 「已经交接过了」先于「你不是那位」回答：这件事对谁都一样，与来者是谁无关
    if (!adminDefaultPass()) return json(res, 409, { error: '这台星港的出厂凭据已经交接过了' });
    /* 而且只认「出厂的那一位」。admin_default_pass 是全局标记，谁交接谁就把它消费掉——
       第二位管理员（由出厂管理员任免出来的）一登录也会看到交接卡，在自己账号上换一套
       用户名密码，标记随之清零：门锁上了，钥匙还挂在门口，出厂的 admin / stellar-admin
       照样能登进来，而真正该交接的那位再想交接只会拿到 409。 */
    if (me.username !== ADMIN_USER) {
      return json(res, 403, { error: '出厂凭据只能由出厂那个管理员账号来交接' });
    }
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!/^[\w一-龥-]{2,24}$/.test(username)) return json(res, 400, { error: '用户名需 2–24 个字符（中英文、数字、_ 或 -）' });
    if (username.toLowerCase() === ADMIN_USER.toLowerCase()) return json(res, 400, { error: '换一个用户名 —— 出厂的那个是公开的' });
    if (password.length < ADMIN_PASS_MIN) return json(res, 400, { error: `管理员密码至少 ${ADMIN_PASS_MIN} 位` });
    if (password === ADMIN_PASS) return json(res, 400, { error: '换一个密码 —— 出厂的那个是公开的' });
    if (password.toLowerCase() === username.toLowerCase()) return json(res, 400, { error: '密码不能和用户名一样' });
    const holder = q.userByUsername.get(username);
    if (holder && holder.id !== me.id) return json(res, 409, { error: '这个用户名已经有主人了' });
    try { q.setUsername.run(username, me.id); }
    catch { return json(res, 409, { error: '这个用户名刚被占用，换一个试试' }); }   // 并发窗口撞唯一索引
    q.setPass.run(hashPass(password), me.id);
    clearAdminDefaultPass();
    q.dropSessionsOf.run(me.id);   // 含当前这一把：出厂钥匙配出去的副本，一把都不留
    const fresh = q.userById.get(me.id);
    audit(fresh, 'admin.handover', fresh, '出厂凭据交接：用户名与密码一并更换，原有会话全部吊销');
    return json(res, 200, { ok: true, session: newSession(me.id), user: pubAccount(fresh) });
  }

  // 绑定 / 修改邮箱：仅登录态，验密码；改成自己当前邮箱视为幂等成功
  if (seg[1] === 'auth' && seg[2] === 'email' && req.method === 'POST') {
    if (!sess || !me.username || !me.pass) return json(res, 401, { error: '尚未登录账号' });
    if (!checkPass(String(body.password || ''), me.pass)) return json(res, 401, { error: '密码不对' });
    const email = String(body.email || '').trim();
    if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: '邮箱格式不对' });
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
    // site：公告随每次握手下发（普通用户只读）；管理员另带一条「出厂凭据未交接」提醒（前端据此弹交接卡）
    // gates 只对游客有意义：已注册的账号一律拿到全开的门禁表，前端不必再判身份
    const gates = u.username ? { editor: false, share: false, visit: false, vault: false } : { ...site.guestGates };
    const pubSite = {
      announcement: site.announcement.enabled ? site.announcement : null,
      registrationOpen: site.registrationOpen,
      gates,
    };
    /* 字段对每位管理员照常下发，值只对出厂那个账号为真：标记是全局的，但该换凭据的
       只有它。否则第二位管理员也会看到交接卡，在自己账号上换一套，把全局标记消费掉——
       门锁上了，钥匙还挂在门口。 */
    if ((u.role || 'user') === 'admin') pubSite.defaultPass = u.username === ADMIN_USER && adminDefaultPass();
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
      const shapeErr = galaxyShapeError(body.data);
      if (shapeErr) return json(res, 400, { error: shapeErr });
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
    if (body.data && !galaxyShapeError(body.data)) {
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
    // 先收成整数再进 SQL：node:sqlite 绑不了 undefined / 对象，会把请求崩成 500
    const viewerId = Number(body.viewerId);
    if (!Number.isInteger(viewerId)) return json(res, 400, { error: '缺少访客 id' });
    if (!q.friendship.get(me.id, viewerId)) return json(res, 404, { error: '不是你的访客' });
    q.setBlocked.run(body.blocked ? 1 : 0, me.id, viewerId);
    return json(res, 200, { ok: true });
  }

  // POST /api/friends/redeem — 用分享码兑换访问权
  if (seg[1] === 'friends' && seg[2] === 'redeem' && req.method === 'POST') {
    // 撒网猜密文的闸门：猜错才计数，猜对的不受影响（见 core.js 的 REDEEM_LIM）
    const wait = redeemGuard(ip);
    if (wait) return json(res, 429, { error: '试过太多密文了，先歇一会儿再来。', retryAfter: wait.retryAfter });
    const code = String(body.code || '').trim().toUpperCase();
    const s = q.shareByCode.get(code);
    // 只有「根本不存在」才算一次猜测；存在但关着是正常的扑空（对外同一句话，不给探测者留信号）
    if (!s) { redeemFailed(ip); return json(res, 404, { error: '密文无效，或对方已关闭星系访问' }); }
    if (!s.enabled) return json(res, 404, { error: '密文无效，或对方已关闭星系访问' });
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
    const friendId = Number(body.friendId);
    if (!Number.isInteger(friendId)) return json(res, 400, { error: '缺少好友 id' });
    q.removeFriend.run(friendId, me.id);
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
    const wait = redeemGuard(ip);   // collect 认的是同一把密文，同一道闸
    if (wait) return json(res, 429, { error: '试过太多密文了，先歇一会儿再来。', retryAfter: wait.retryAfter });
    const code = String(body.code || '').trim().toUpperCase();
    const s = q.shareByCode.get(code);
    if (!s) { redeemFailed(ip); return json(res, 404, { error: '密文无效，或对方已关闭星系访问' }); }
    if (!s.enabled) return json(res, 404, { error: '密文无效，或对方已关闭星系访问' });
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

/* ============================ 静态文件 ============================
   这台服务器的根就是整个仓库，而仓库里躺着数据库、.git、node_modules、测试与
   全部源码。逐样去堵是堵不完的（今天没有的目录明天会长出来），所以反过来写：
   下面这份白名单之外的一切，一律当作不存在。

   为什么这不是杞人忧天：进程只监听 127.0.0.1，看似谁也够不着；但 README 教的
   部署方式是放在 nginx / Caddy 后面，反代会把 /server/stellar.db 原样转进来——
   整库（密码哈希、所有人的笔记正文、会话令牌、分享密文）一个 GET 就走了。 */
const PUBLIC_DIRS = ['ui_kits', 'components', 'tokens', 'assets', 'docs', 'guidelines'];
const PUBLIC_FILES = ['styles.css', '_ds_bundle.js', '_ds_manifest.json', 'favicon.ico'];

/* rel：相对仓库根的 posix 路径（已 normalize、已确认没跑出 ROOT）。
   点开头的一段一律拒绝（.git / .env / .github 都在此列），单层文件走文件白名单，
   其余只认第一段是不是公开目录。 */
function isPublicPath(rel) {
  const seg = rel.split(path.sep).filter(Boolean);
  if (!seg.length) return false;
  if (seg.some(x => x.startsWith('.'))) return false;
  return seg.length === 1 ? PUBLIC_FILES.includes(seg[0]) : PUBLIC_DIRS.includes(seg[0]);
}

/* 扩展名同样是白名单：MIME 表里没有的类型不出门。少了这一条，公开目录里
   哪天多出一个 .db / .env.local / .sh，仍会被 octet-stream 原样端出去。 */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json', '.webmanifest': 'application/manifest+json',
};
function serveStatic(req, res, url) {
  let p;
  // %ZZ 这类坏编码会让 decodeURIComponent 抛 URIError —— 这是一条 400，不是服务器的错
  try { p = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); return res.end('bad request'); }
  // 根路径重定向到应用目录：index.html 里的相对引用（*.jsx / data.js …）
  // 只有在 /ui_kits/stellar-raft/ 下解析才全部正确，原地改写会 404 成黑屏
  if (p === '/' || p === '/index.html') {
    res.writeHead(302, { Location: APP_DIR });
    return res.end();
  }
  if (p.endsWith('/')) p += 'index.html'; // 目录路径回退：/docs/ → /docs/index.html
  const file = path.normalize(path.join(ROOT, p));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  /* 白名单之外一律 404 而不是 403：403 等于告诉对方「这里确实有东西」，
     而这台服务器上「有没有」本身就不必回答。 */
  const type = MIME[path.extname(file).toLowerCase()];
  if (!type || !isPublicPath(path.relative(ROOT, file))) { res.writeHead(404); return res.end('not found'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache',
      // 类型已经是白名单里的了，再叮嘱浏览器别自作主张去嗅探
      'X-Content-Type-Options': 'nosniff' });
    const stream = fs.createReadStream(file);
    // 读到一半出错（文件被删/权限变了）：断掉这条响应就好，别让未处理的流错误带走进程
    stream.on('error', () => { try { res.destroy(); } catch { /* 已经断了 */ } });
    stream.pipe(res);
  });
}

/* ============================ 服务器 ============================ */
/* 500 的正文永远是同一句话。内部异常里常带着库表结构、文件系统绝对路径这类
   不该出门的细节；真正的错误打在控制台——那是运维该看的地方，不是访客。 */
function fail(res, e) {
  METRICS.errors++;
  try { console.error('[stellar-raft] 未处理的异常：', e); } catch { /* 连日志都写不出就算了 */ }
  if (res.headersSent) { try { res.end(); } catch { /* 已经断了 */ } return; }
  json(res, 500, { error: '服务器开小差了，请稍后再试' });
}

http.createServer((req, res) => {
  METRICS.requests++;
  /* 整条管线套一层 try：node:http 的请求回调里同步抛出的异常会变成
     uncaughtException，直接把进程带走。曾经一条 `GET /%ZZ` 就够了——
     decodeURIComponent 抛 URIError，服务器当场退出，所有人一起掉线。
     一个未认证的 GET 不该有这种分量。 */
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch { res.writeHead(400); return res.end('bad request'); }
  try {
    if (url.pathname.startsWith('/api/')) {
      METRICS.apiRequests++;
      handleApi(req, res, url).catch(e => fail(res, e));
    } else if (req.method === 'GET') {
      serveStatic(req, res, url);
    } else {
      res.writeHead(405); res.end();
    }
  } catch (e) { fail(res, e); }
}).listen(PORT, HOST, () => {
  console.log(`[stellar-raft] http://localhost:${PORT}${APP_DIR}  (静态 + API · 数据库 ${DB_SHOWN})`);
  /* 听的是所有网卡时，把局域网地址也打出来 —— 否则「手机怎么打开」得自己去翻
     ifconfig。同时提醒一句：那种地址不是安全上下文，浏览器会关掉剪贴板 API。 */
  if (HOST === '0.0.0.0' || HOST === '::') {
    const lan = [];
    for (const list of Object.values(os.networkInterfaces() || {})) {
      for (const ni of list || []) {
        if (ni && ni.family === 'IPv4' && !ni.internal) lan.push(ni.address);
      }
    }
    for (const ip of lan) console.log(`[stellar-raft] 同一网络下的设备：http://${ip}:${PORT}${APP_DIR}`);
    if (lan.length) {
      console.log('[stellar-raft] 注意：http:// 的局域网地址不是「安全上下文」，浏览器会关掉剪贴板等 API（星图已各自备好退路）。');
    }
  }
});

