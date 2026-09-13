/* SRNet — 前端与本地后端的同步层（plain global, 在 data.js 之前加载）
   - 每个浏览器一份匿名令牌（localStorage），后端据此建档
   - schedule(): 任何数据变更后防抖 1.2s 整体上传星系快照
   - 每次上传前先把快照镜像进 localStorage（sr.galaxy.v1）——
     无 server（file:// 打开 / 后端未启动）时它就是唯一的真实存储
   - 页面卸载时 localStorage 同步落一份 + sendBeacon 补最后一发，不丢尾部编辑 */
/* SRGate — 游客功能门禁的前端一侧。
   门禁表由服务器随 /api/hello 下发（SR_DATA.site.gates），管理员在星港管理台里
   逐项开关。这里只负责「拦一下并把人请去登录」——分享与造访在服务端另有硬拦，
   编辑器与 Markdown 导入导出没有专属接口，拦的就是入口本身。 */
window.SRGate = {
  // 这项功能现在是否需要账号（true = 需要，当前身份还没有）
  gated(feature) {
    const D = window.SR_DATA;
    if (!D || !D.site || !D.site.gates) return false;
    if (D.account && D.account.registered) return false;
    return !!D.site.gates[feature];
  },
  /* 用法：if (!SRGate.require('editor', '记笔记')) return;
     被拦下时给一句说明并唤起登录页，返回 false。 */
  require(feature, what) {
    if (!this.gated(feature)) return true;
    const NS = window.StellarRaftDesignSystem_2866af;
    if (NS && NS.toast) {
      NS.toast((what ? what + '需要一个账号' : '这项功能需要一个账号') + ' · 注册后星空原地跟着你走',
        { icon: 'user-plus', tone: 'gold', duration: 4200 });
    }
    try { window.dispatchEvent(new CustomEvent('sr-need-login', { detail: { feature } })); } catch (e) { }
    return false;
  },
};

window.SRNet = (function () {
  const KEY = 'sr.token';
  const LS_GALAXY = 'sr.galaxy.v1';
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = 'u-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(KEY, token);
  }

  const api = async (path, opts = {}) => {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: opts.raw != null ? opts.raw : (opts.body ? JSON.stringify(opts.body) : undefined),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      /* 服务器对这个身份关了门：账号被停用 / 全站维护 / 这台设备的登录已失效
         （管理员强制下线、账号被删、会话太久没露面）。广播出去，由 app 切到一张
         说明页——否则用户只会看到一堆无声失败的请求，还以为是网断了。
         renewing 窗口例外：交接换钥匙时，旧钥匙的在飞请求被吊销是预期内的，
         不该把刚交接成功的人弹去「登录已失效」。 */
      if (data && (data.banned || data.maintenance || data.sessionExpired) && !renewing) {
        const kind = data.banned ? 'banned' : (data.maintenance ? 'maintenance' : 'expired');
        try {
          window.dispatchEvent(new CustomEvent('sr-blocked', { detail: { kind, message: data.error || '' } }));
        } catch (e) { }
      }
      const e = new Error((data && data.error) || 'HTTP ' + res.status); e.status = res.status; e.data = data; throw e;
    }
    return data;
  };

  // 乐观锁版本号：GET 时由 data.js 写入，PUT 成功时更新；用于检测并发覆盖
  let version = 0;
  /* 本机镜像记一笔 syncVer = 这份内容「基于的服务器版本」。启动时拿它和服务器的
     现版本做因果比较：相等 = 别处没人写过（镜像里可能有离线编辑，本地为准）；
     不等 = 另一台设备写过（服务器为准）。不再比两台设备的系统时钟谁快——
     时钟快的那端以前恒赢，另一端的离线编辑被静默覆盖。 */

  // 随账号走的偏好：昵称/头像/简介/提醒相关设置。动效与星点闪烁是设备偏好，留在本机不同步。
  const accountPrefs = () => {
    try {
      const p = JSON.parse(localStorage.getItem('sr.settings')) || {};
      const { nickname, avatar, bio, remind, freq, remindTime, dimNudge } = p;
      return { nickname, avatar, bio, remind, freq, remindTime, dimNudge };
    } catch (e) { return {}; }
  };
  const snapshot = () => {
    const D = window.SR_DATA; if (!D) return null;
    let aiConfig = null;
    try { aiConfig = window.SRAI ? window.SRAI.getConfig() : null; } catch (e) { }
    return {
      savedAt: Date.now(),   // 客户端时间戳：仅作展示与旧版镜像的兜底比较（新版看 syncVer）
      constellations: D.constellations, stars: D.stars, connections: D.connections,
      notes: D.notes, inbox: D.inbox, timeline: D.timeline, trash: D.trash,
      account: { name: D.account.name, avatar: D.account.avatar, bio: D.account.bio || '' },
      prefs: accountPrefs(), aiConfig,
    };
  };

  // localStorage 镜像：无后端时的降级存储，有后端时的双保险。
  // pending = 这份内容还没被服务器确认（离线编辑 / 在飞 / beacon 未回话）——
  // 启动时 syncVer 相等只能证明「基于同一版」，pending 才区分得出「镜像是
  // 服务器内容的回声」还是「镜子上有没推上去的编辑」。
  const saveLocal = (data, ver, pending) => {
    try { localStorage.setItem(LS_GALAXY, JSON.stringify({ savedAt: (data && data.savedAt) || Date.now(), syncVer: ver != null ? ver : version, pending: !!pending, data })); return true; }
    catch (e) { return false; }
  };
  const loadLocal = () => {
    try { const v = JSON.parse(localStorage.getItem(LS_GALAXY)); return v && v.data ? v : null; }
    catch (e) { return null; }
  };

  let timer = null, dirty = false, online = true, inflight = false;
  let inflightPromise = null;   // 在飞的那一发（saveNow 直调入口也要排它后面）
  let renewing = false;         // 交接换钥匙的窗口（见 api() 的 sr-blocked 抑制）
  // 水合闸门：服务器上的星系取回（或确认为空）之前，绝不上传——
  // 否则种子数据可能在竞态中覆盖掉用户的真实星空
  let ready = false;

  // ——— 保存状态（给顶栏「保存指示」与离线提示用）———
  // status: saving（正在落盘）| saved（两端已同步）| local（仅本机，服务器暂不可达）| error（连本机都没存下）
  let status = 'saved', lastSync = 0, offlineToldAt = 0, localFullTold = false, tooBigTold = false;
  const dsToast = (msg, opts) => {
    const NS = window.StellarRaftDesignSystem_2866af;
    if (NS && NS.toast) NS.toast(msg, opts);
  };
  const emit = (s) => {
    status = s;
    try { window.dispatchEvent(new CustomEvent('sr-net', { detail: { status, online, lastSync } })); } catch (e) { }
  };
  const saveNow = () => {
    if (!ready) {
      // 水合完成前的编辑不许静默蒸发：先落本机镜像、记下 dirty，
      // ready 翻转后由 flushReady 补推
      const d0 = snapshot(); if (d0) saveLocal(d0, undefined, true);
      dirty = true;
      return Promise.resolve();
    }
    /* 直接调用 saveNow 的入口（登出/换会话/交接前的冲刷）也要排在在飞那一发的
       后面：第二发带着同一个 baseVersion 并发出门必撞 409——自己撞自己。 */
    if (inflightPromise) return inflightPromise.catch(() => { }).then(() => saveNow());
    const data = snapshot(); if (!data) return Promise.resolve();
    /* 把还排着的那一发防抖收掉：saveNow 也会被直接调用（登出前冲刷、换会话前冲刷），
       留着定时器就会在身份已经换掉之后再写一发——把上一个身份的星空写进新账号。 */
    clearTimeout(timer); timer = null;
    dirty = false; inflight = true;
    emit('saving');
    /* 整棵快照只序列化一次：镜像与请求体共用这同一份字节（以前是两次全量
       JSON.stringify，打字期的每次防抖落盘都在主线程跑两遍） */
    const dataStr = JSON.stringify(data);
    const mirrorStr = (ver, pending) =>
      '{"savedAt":' + (data.savedAt || Date.now()) + ',"syncVer":' + ver + ',"pending":' + pending + ',"data":' + dataStr + '}';
    let localOk = true;
    try {
      localStorage.setItem(LS_GALAXY, mirrorStr(version, true));   // pending：服务器还没确认
    } catch (e) { localOk = false; }
    if (!localOk && !localFullTold) {
      localFullTold = true;
      dsToast('本机存储写入失败 · 请导出数据以防丢失', { tone: 'danger', icon: 'triangle-alert', duration: 5200 });
    }
    const p = api('/api/galaxy', { method: 'PUT', raw: '{"data":' + dataStr + ',"baseVersion":' + version + '}' })
      .then((r) => {
        online = true; lastSync = Date.now();
        if (r && r.version != null) version = r.version;
        // 确认落地：镜像改写为「内容与服务器第 N 版一致」，不再标 pending。
        // 复用同一份序列化字节，这一步只是一次 localStorage 写
        try { localStorage.setItem(LS_GALAXY, mirrorStr(version, false)); } catch (e) { }
        tooBigTold = false;   // 这一份收下了：下次再撑爆，那句提醒该重新说一遍
        emit('saved');
      })
      .catch((err) => {
        // 409：其它标签页 / 设备已改动同一星系。服务器把最新版回给我们，收敛到服务器真相，
        // 避免这次整棵快照覆盖对方的全部改动（宁可这次未落盘的编辑合并让位，也不静默抹掉对方）。
        if (err && err.status === 409 && err.data) {
          online = true;
          if (err.data.version != null) version = err.data.version;
          /* 本机镜像也要跟着收敛。这一发出门前已经把「被服务器拒收的那一版」写进镜像了，
             而且它的 savedAt 比服务器那份新；不改回来的话，下次开机 data.js 的
             「新者优先」会判本机赢，再把这一版整棵推回去——刚刚让位的那次合并被悄悄撤销。 */
          if (err.data.data) saveLocal(err.data.data, err.data.version);
          /* dirty 必须清掉：飞行窗口里攒的编辑随着收敛已经从数据里让位，
             留着它，finally 会把刚收敛来的服务器版本原样推回去——内容没变、
             版本号空涨一格，其它在线设备下一轮跟着 409，冲突被自己放大。 */
          dirty = false;
          try { window.dispatchEvent(new CustomEvent('sr-conflict', { detail: err.data.data })); } catch (e) { }
          emit('saved');
          dsToast('另一台设备（或标签页）保存了更新，这里已刷新为最新', { icon: 'refresh-cw', duration: 4200 });
          return;
        }
        /* 413：服务器好端端的，是这一份太大了（多半是笔记里内联了大图）。
           这一条必须和「服务器暂不可达」分开——否则用户会一直等一个永远不会到来的
           「网络恢复」，而真正该做的是把那张图压一压。 */
        if (err && err.status === 413) {
          online = true;
          emit(localOk ? 'local' : 'error');
          if (!tooBigTold) {
            tooBigTold = true;
            dsToast((err.data && err.data.error) || '这片星空太大了，服务器没收下',
              { tone: 'danger', icon: 'triangle-alert', duration: 6600 });
          }
          return;
        }
        // 服务器暂不可达：本地镜像已在，之后由心跳 / online 事件自动补写
        online = false;
        emit(localOk ? 'local' : 'error');
        const nowTs = Date.now();
        if (nowTs - offlineToldAt > 60000) {   // 克制：离线提示至多一分钟一次
          offlineToldAt = nowTs;
          dsToast('已保存在本机 · 服务器暂不可达', { icon: 'hard-drive', duration: 4200 });
        }
      })
      .finally(() => {
        inflight = false; inflightPromise = null;
        // 飞行途中攒下的改动：现在版本号已经对齐，补一发
        if (dirty) schedule();
      });
    inflightPromise = p;
    return p;
  };
  // ready 翻转后：把水合窗口里攒下的编辑推上去
  const flushReady = () => { if (dirty && !inflight) saveNow(); };
  /* 有一发还在飞的时候，绝不再排第二发。
     第二发会带着同一个 baseVersion 出门，等第一发落地把版本推到 n+1，它必然撞 409——
     而 409 的处理是「收敛到服务器真相」，于是两发之间写下的东西被自己的上一发挤掉，
     内存里刚敲进去的字当场消失，顶栏还显示「已保存」。跨设备冲突该那样处理；
     自己撞自己不该。标记 dirty 等它落地，finally 里会补上。 */
  const schedule = () => {
    if (!ready) {
      // 水合完成前的编辑：先落本机镜像 + 记 dirty，否则弱网下这几秒的字会被
      // 随后到来的 hydrate 整片盖掉（窗口期关页则连镜像都没留下）
      const d0 = snapshot(); if (d0) saveLocal(d0, undefined, true);
      dirty = true;
      return;
    }
    dirty = true;
    if (inflight) return;
    clearTimeout(timer); timer = setTimeout(saveNow, 1200); emit('saving');
  };

  // 服务器恢复后的自动补写：浏览器 online 事件 + 20s 心跳，离线且有本地镜像时重试
  addEventListener('online', () => { if (ready && !online && !inflight) saveNow(); });
  setInterval(() => {
    if (!ready || online || inflight || document.hidden) return;
    saveNow();
  }, 20000);

  addEventListener('beforeunload', () => {
    /* !ready 也要落本机镜像：水合窗口内关页，以前这里直接 return，
       那几秒的编辑连 localStorage 都没留下 */
    if (ready && !dirty && !inflight) return;
    try {
      const data = snapshot(); if (!data) return;
      saveLocal(data, undefined, true);   // localStorage 是同步的，卸载前必然落下（pending：beacon 是否落地无从得知）
      if (!ready) return;   // 还没握过手：beacon 没有可靠的 baseVersion，不硬发
      const payload = '{"data":' + JSON.stringify(data) + ',"baseVersion":' + version + '}';
      const url = '/api/galaxy/beacon?token=' + encodeURIComponent(token);
      // sendBeacon 有队列大小上限，塞不下时退回 keepalive fetch，别默默丢尾部编辑
      if (!navigator.sendBeacon(url, payload)) {
        fetch(url, { method: 'POST', body: payload, keepalive: true }).catch(() => { });
      }
    } catch (e) { }
  });

  /* ——— 星际收件箱便捷方法 ———
     全部静默降级：后端未运行（网络失败）时返回 null，不抛；
     HTTP 业务错误（非好友 403 / 太频繁 429 …）返回 { error, status }，
     UI 可据此给出温和提示，也可与 null 一样按「暂不可用」处理。 */
  const soften = (p) => p.catch((e) => (e && e.status ? { error: e.message, status: e.status } : null));
  const inbox = {
    // 造访邀请：inbox.send(toUserId, 'galaxy')；赠星：inbox.send(toUserId, 'star', starId)；
    // 星语留言：inbox.send(toUserId, 'note', null, { text: '…' })
    send: (toUserId, kind, starId, extra) =>
      soften(api('/api/inbox/send', { method: 'POST', body: { toUserId, kind, starId, ...(extra || {}) } })),
    // 造访好友星系时收纳一颗可见的星（进自己的收件箱）
    collect: (code, starId) =>
      soften(api('/api/inbox/collect', { method: 'POST', body: { code, starId } })),
    // 我的星际来信（时间倒序数组；不可用时 null）
    list: () => soften(api('/api/inbox')),
    // 领取或忽略：inbox.ack(id, 'claim' | 'dismiss')
    ack: (id, action) =>
      soften(api('/api/inbox/ack', { method: 'POST', body: { id, action } })),
  };

  // ——— 账号：登录/注册/改密/登出（薄封装 api()）；会话切换与登出流负责清 KEY + 旧镜像 ———
  const auth = {
    register: (p) => api('/api/auth/register', { method: 'POST', body: p }),
    login: (p) => api('/api/auth/login', { method: 'POST', body: p }),
    logout: () => api('/api/auth/logout', { method: 'POST', body: {} }),
    changePassword: (p) => api('/api/auth/password', { method: 'POST', body: p }),
    changeEmail: (p) => api('/api/auth/email', { method: 'POST', body: p }),
    // 星港交接：出厂管理员第一次登录时把用户名与密码一起换掉，服务器回一把新钥匙
    handover: (p) => api('/api/auth/handover', { method: 'POST', body: p }),
  };
  // 采用一个新会话（登录/注册成功后）：换 token + 清旧镜像，防旧账号本地数据覆盖新账号的服务器数据
  // 身份切换的本地卫生：清掉上一个身份的全部账号级残留——昵称/头像/简介/提醒偏好、
  // AI 接入配置（密钥绝不能串到下一个账号）、提醒去重标记、好友密文备忘。动效等设备偏好保留。
  const stripLocalIdentity = () => {
    try {
      const prefs = JSON.parse(localStorage.getItem('sr.settings')) || {};
      delete prefs.nickname; delete prefs.avatar; delete prefs.bio;
      delete prefs.remind; delete prefs.freq; delete prefs.remindTime; delete prefs.dimNudge;
      localStorage.setItem('sr.settings', JSON.stringify(prefs));
    } catch (e) { }
    try { window.SRAI ? window.SRAI.clearConfig() : localStorage.removeItem('sr.aiConfig'); } catch (e) { }
    ['sr.remind.last', 'sr.dimnudge.last', 'sr.visit.codes.v1'].forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) { }
    });
  };
  /* 同一个账号换一把新钥匙（星港交接后，服务器把旧会话连同当前这把一起吊销了）。
     与 adoptSession 的区别正是「这不是换人」：本地星空镜像与账号级偏好原样留下，
     stripLocalIdentity 那一套反而会把这个人自己的昵称、AI 配置清掉。 */
  const renewSession = async (t) => {
    renewing = true;
    try {
      /* 换钥匙之前，先等旧钥匙的在飞请求落完地（交接已吊销它，它注定 401——
         renewing 窗口里这个 401 被抑制，不弹「登录已失效」）。等完再换再写：
         先换后写是硬要求（先写就是拿死钥匙出门）。 */
      if (inflightPromise) { try { await inflightPromise; } catch (e) { } }
      token = t; localStorage.setItem(KEY, t);
      await saveNow();
    } catch (e) { } finally { renewing = false; }
  };
  const adoptSession = async (t) => {
    try { await saveNow(); } catch (e) { }   // 冲刷防抖：注册前 1.2s 内的最后一笔编辑不落空
    token = t; localStorage.setItem(KEY, t);
    try { localStorage.removeItem(LS_GALAXY); } catch (e) {}   // 关键：清旧镜像，防覆盖新账号数据
    stripLocalIdentity();
  };
  // 登出流：冲刷未保存编辑 → 删服务端 session → 换回全新匿名身份 → 清旧镜像 → 整页刷新重水合
  const logoutFlow = async () => {
    try { await saveNow(); } catch (e) { }
    try { await auth.logout(); } catch (e) {}
    const fresh = 'u-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    token = fresh; localStorage.setItem(KEY, fresh);
    try { localStorage.removeItem(LS_GALAXY); } catch (e) {}
    stripLocalIdentity();
    location.reload();
  };

  return {
    get token() { return token; },   // live getter：adoptSession/logoutFlow 换身份后读到的永远是现值
    api, schedule, saveNow, snapshot, saveLocal, loadLocal, inbox,
    isOnline: () => online,
    getStatus: () => ({ status, online, lastSync }),
    setReady: () => { ready = true; flushReady(); }, isReady: () => ready,
    setVersion: (v) => { if (v != null) version = v; }, getVersion: () => version,
    auth, adoptSession, renewSession, logoutFlow,
  };
})();
