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
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // 服务器对这个身份关了门（账号被管理员停用 / 全站维护中）：广播出去，
      // 由 app 切到一张说明页——否则用户只会看到一堆无声失败的请求
      if (data && (data.banned || data.maintenance)) {
        try {
          window.dispatchEvent(new CustomEvent('sr-blocked', {
            detail: { kind: data.banned ? 'banned' : 'maintenance', message: data.error || '' },
          }));
        } catch (e) { }
      }
      const e = new Error((data && data.error) || 'HTTP ' + res.status); e.status = res.status; e.data = data; throw e;
    }
    return data;
  };

  // 乐观锁版本号：GET 时由 data.js 写入，PUT 成功时更新；用于检测并发覆盖
  let version = 0;

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
      savedAt: Date.now(),   // 客户端时间戳：启动时本地 / 服务器两份快照按新者优先
      constellations: D.constellations, stars: D.stars, connections: D.connections,
      notes: D.notes, inbox: D.inbox, timeline: D.timeline, trash: D.trash,
      account: { name: D.account.name, avatar: D.account.avatar, bio: D.account.bio || '' },
      prefs: accountPrefs(), aiConfig,
    };
  };

  // localStorage 镜像：无后端时的降级存储，有后端时的双保险
  const saveLocal = (data) => {
    try { localStorage.setItem(LS_GALAXY, JSON.stringify({ savedAt: (data && data.savedAt) || Date.now(), data })); return true; }
    catch (e) { return false; }
  };
  const loadLocal = () => {
    try { const v = JSON.parse(localStorage.getItem(LS_GALAXY)); return v && v.data ? v : null; }
    catch (e) { return null; }
  };

  let timer = null, dirty = false, online = true, inflight = false;
  // 水合闸门：服务器上的星系取回（或确认为空）之前，绝不上传——
  // 否则种子数据可能在竞态中覆盖掉用户的真实星空
  let ready = false;

  // ——— 保存状态（给顶栏「保存指示」与离线提示用）———
  // status: saving（正在落盘）| saved（两端已同步）| local（仅本机，服务器暂不可达）| error（连本机都没存下）
  let status = 'saved', lastSync = 0, offlineToldAt = 0, localFullTold = false;
  const dsToast = (msg, opts) => {
    const NS = window.StellarRaftDesignSystem_2866af;
    if (NS && NS.toast) NS.toast(msg, opts);
  };
  const emit = (s) => {
    status = s;
    try { window.dispatchEvent(new CustomEvent('sr-net', { detail: { status, online, lastSync } })); } catch (e) { }
  };
  const saveNow = () => {
    if (!ready) return Promise.resolve();
    const data = snapshot(); if (!data) return Promise.resolve();
    dirty = false; inflight = true;
    emit('saving');
    const localOk = saveLocal(data);   // 本地镜像先落盘：file:// / 断网时这就是持久化本体
    if (!localOk && !localFullTold) {
      localFullTold = true;
      dsToast('本机存储写入失败 · 请导出数据以防丢失', { tone: 'danger', icon: 'triangle-alert', duration: 5200 });
    }
    return api('/api/galaxy', { method: 'PUT', body: { data, baseVersion: version } })
      .then((r) => {
        online = true; lastSync = Date.now();
        if (r && r.version != null) version = r.version;
        emit('saved');
      })
      .catch((err) => {
        // 409：其它标签页 / 设备已改动同一星系。服务器把最新版回给我们，收敛到服务器真相，
        // 避免这次整棵快照覆盖对方的全部改动（宁可这次未落盘的编辑合并让位，也不静默抹掉对方）。
        if (err && err.status === 409 && err.data) {
          online = true;
          if (err.data.version != null) version = err.data.version;
          try { window.dispatchEvent(new CustomEvent('sr-conflict', { detail: err.data.data })); } catch (e) { }
          emit('saved');
          dsToast('已同步其它设备上的最新改动', { icon: 'refresh-cw', duration: 4200 });
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
      .finally(() => { inflight = false; });
  };
  const schedule = () => { if (!ready) return; dirty = true; clearTimeout(timer); timer = setTimeout(saveNow, 1200); emit('saving'); };

  // 服务器恢复后的自动补写：浏览器 online 事件 + 20s 心跳，离线且有本地镜像时重试
  addEventListener('online', () => { if (ready && !online && !inflight) saveNow(); });
  setInterval(() => {
    if (!ready || online || inflight || document.hidden) return;
    saveNow();
  }, 20000);

  addEventListener('beforeunload', () => {
    if (!ready || (!dirty && !inflight)) return;
    try {
      const data = snapshot(); if (!data) return;
      saveLocal(data);   // localStorage 是同步的，卸载前必然落下
      const payload = JSON.stringify({ data, baseVersion: version });
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
    setReady: () => { ready = true; }, isReady: () => ready,
    setVersion: (v) => { if (v != null) version = v; }, getVersion: () => version,
    auth, adoptSession, logoutFlow,
  };
})();
