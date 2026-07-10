/* SRNet — 前端与本地后端的同步层（plain global, 在 data.js 之前加载）
   - 每个浏览器一份匿名令牌（localStorage），后端据此建档
   - schedule(): 任何数据变更后防抖 1.2s 整体上传星系快照
   - 页面卸载时用 sendBeacon 补最后一发，不丢尾部编辑 */
window.SRNet = (function () {
  const KEY = 'sr.token';
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
    if (!res.ok) { const e = new Error((data && data.error) || 'HTTP ' + res.status); e.status = res.status; throw e; }
    return data;
  };

  const snapshot = () => {
    const D = window.SR_DATA; if (!D) return null;
    return {
      constellations: D.constellations, stars: D.stars, connections: D.connections,
      notes: D.notes, inbox: D.inbox, timeline: D.timeline, trash: D.trash,
      account: { name: D.account.name, avatar: D.account.avatar },
    };
  };

  let timer = null, dirty = false, online = true, inflight = false;
  // 水合闸门：服务器上的星系取回（或确认为空）之前，绝不上传——
  // 否则种子数据可能在竞态中覆盖掉用户的真实星空
  let ready = false;
  const saveNow = () => {
    if (!ready) return Promise.resolve();
    const data = snapshot(); if (!data) return Promise.resolve();
    dirty = false; inflight = true;
    return api('/api/galaxy', { method: 'PUT', body: { data } })
      .then(() => { online = true; })
      .catch(() => { dirty = true; online = false; })
      .finally(() => { inflight = false; });
  };
  const schedule = () => { if (!ready) return; dirty = true; clearTimeout(timer); timer = setTimeout(saveNow, 1200); };

  addEventListener('beforeunload', () => {
    if (!ready || (!dirty && !inflight)) return;
    try {
      const data = snapshot(); if (!data) return;
      const payload = JSON.stringify({ data });
      const url = '/api/galaxy/beacon?token=' + encodeURIComponent(token);
      // sendBeacon 有队列大小上限，塞不下时退回 keepalive fetch，别默默丢尾部编辑
      if (!navigator.sendBeacon(url, payload)) {
        fetch(url, { method: 'POST', body: payload, keepalive: true }).catch(() => { });
      }
    } catch (e) { }
  });

  return { token, api, schedule, saveNow, snapshot, isOnline: () => online, setReady: () => { ready = true; }, isReady: () => ready };
})();
