/* VisitView — 星际漫游（好友星系）。
   「我的分享」 开关星系访问 · 星系密文复制/重置 · 可见度（仅星名 / 星名+大纲）· 访客拉黑
   「好友星系」 兑换密文 · 好友卡片 → 只读造访：
     与自己的星图同一套世界坐标 + 相机（拖拽平移 / 滚轮缩放 / 星域光晕 / 缩放控件），
     只是不可编辑；点星只看得到服务端裁剪后的大纲——正文从未离开对方数据库。 */
const { GlassPanel, Button, IconButton, Icon, Input, Badge, Tag, StarNode, MemoryBar } = window.StellarRaftDesignSystem_2866af;

const VWORLD = { w: 1680, h: 1040 };
const vclamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* 密文备忘：收纳（/api/inbox/collect）要用主人的当前密文，但 /api/friends 与
   /api/visit 都不回传密文（不扩大它的暴露面）。兑换成功时在本机记下
   friendId → code；主人重置密文后这份备忘自然失效，收纳时给「重新连接」的引导。 */
const VISIT_CODE_KEY = 'sr.visit.codes.v1';
const codeMemo = {
  read() { try { return JSON.parse(localStorage.getItem(VISIT_CODE_KEY)) || {}; } catch (e) { return {}; } },
  get(id) { return this.read()[id] || null; },
  set(id, code) { try { const m = this.read(); m[id] = code; localStorage.setItem(VISIT_CODE_KEY, JSON.stringify(m)); } catch (e) { } },
};

/* ---------- 访客足迹：lastVisit（UTC 'YYYY-MM-DD HH:MM:SS'）→ 相对时间 ----------
   服务端给的是 SQLite datetime('now')，无时区后缀；补 'Z' 按 UTC 解析。
   null / 解析失败一律「尚未造访」，不猜。 */
function visitAgo(utc) {
  if (!utc) return '尚未造访';
  const t = Date.parse(String(utc).replace(' ', 'T') + 'Z');
  if (!Number.isFinite(t)) return '尚未造访';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return '刚来过';
  if (min < 60) return min + ' 分钟前来过';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + ' 小时前来过';
  const day = Math.floor(hr / 24);
  if (day < 30) return day + ' 天前来过';
  return Math.floor(day / 30) + ' 个月前来过';
}

/* ---------- 知识共鸣：造访的星系里，哪些知识我们都拥有 ----------
   口径（纯客户端计算，双方正文都不经手）：
   · 归一：星名与标签去首尾空白、转小写后再比较；
   · 强共鸣：双方星名归一后完全相等——同一颗知识星；双方都点亮时另行标注；
   · 弱共鸣：双方 tags 有交集，剔除「草稿」「星际来信」这类系统标签；
   · 每颗对方星至多归一档，强共鸣优先；返回按强→弱排序。
   我方点亮口径与 data.js 一致（sr.lit>0）；对方 lit 由服务端实时熄灭后给出。
   对方 tags 仅在「星名+大纲」档下发——「仅星名」档自然只剩强共鸣。 */
const RESONANCE_SKIP_TAGS = ['草稿', '星际来信'];
const resNorm = (v) => String(v == null ? '' : v).trim().toLowerCase();
function matchResonance(myStars, theirStars) {
  const mine = (myStars || []).filter(s => s && s.label);
  if (!mine.length || !theirStars || !theirStars.length) return [];
  const skip = new Set(RESONANCE_SKIP_TAGS.map(resNorm));
  const byLabel = new Map();   // 归一星名 → 我方星（重名取先见者）
  const byTag = new Map();     // 归一标签 → 我方星列表
  mine.forEach(s => {
    const l = resNorm(s.label);
    if (l && !byLabel.has(l)) byLabel.set(l, s);
    (s.tags || []).forEach(t => {
      const n = resNorm(t);
      if (!n || skip.has(n)) return;
      if (!byTag.has(n)) byTag.set(n, []);
      byTag.get(n).push(s);
    });
  });
  const out = [];
  theirStars.forEach(ts => {
    const twin = byLabel.get(resNorm(ts.label));
    if (twin) {
      out.push({ id: ts.id, kind: 'strong', theirLabel: ts.label, mineLabel: twin.label,
        bothLit: !!ts.lit && !!(twin.sr && twin.sr.lit > 0) });
      return;
    }
    const tags = [], names = [], seen = new Set();
    (ts.tags || []).forEach(t => {
      const n = resNorm(t);
      if (!n || skip.has(n) || seen.has(n) || !byTag.has(n)) return;
      seen.add(n); tags.push(t);
      byTag.get(n).forEach(m => { if (names.indexOf(m.label) < 0) names.push(m.label); });
    });
    if (tags.length) out.push({ id: ts.id, kind: 'weak', theirLabel: ts.label, tags, mineLabels: names.slice(0, 3), bothLit: false });
  });
  out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'strong' ? -1 : 1));
  return out;
}

/* ---------- 共享样式：远航坞 / 飞船 / 卡片 / 电波环 ---------- */
function VisitStyle() {
  return (
    <style>{`
      @keyframes sr-bay-bob   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
      @keyframes sr-ship-flame{ 0%,100% { transform: scaleX(1); opacity: 0.85; } 50% { transform: scaleX(1.4); opacity: 0.55; } }
      @keyframes sr-beacon    { 0%,100% { opacity: 0.15; } 50% { opacity: 1; } }
      @keyframes sr-launch    { 0% { transform: translateY(0); } 14% { transform: translateY(5px); } 100% { transform: translateY(-135vh); } }
      @keyframes sr-pad-flash { from { opacity: 0.85; transform: translateX(-50%) scale(0.4); } to { opacity: 0; transform: translateX(-50%) scale(2.4); } }
      @keyframes sr-ping      { from { transform: scale(0.55); opacity: 0.7; } to { transform: scale(2.2); opacity: 0; } }
      @keyframes sr-twk       { 0%,100% { opacity: 0.2; } 50% { opacity: 0.85; } }
      @keyframes sr-res-pulse { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.16); opacity: 1; } }
      .sr-ship-flame { animation: sr-ship-flame 0.32s ease-in-out infinite; }
      .sr-res-ring   { animation: sr-res-pulse 2.8s ease-in-out infinite; }
      .sr-bay-ship   { animation: sr-bay-bob 2.6s var(--ease-flight) infinite; }
      .sr-bay-ship.launch { animation: sr-launch 1.05s cubic-bezier(0.55, 0, 0.9, 0.4) both; }
      .sr-bay-ship.launch .sr-ship-flame { animation-duration: 0.1s; }
      .sr-visit-card { transition: transform var(--dur-base) var(--ease-flight), border-color var(--dur-base); }
      .sr-visit-card:hover { transform: translateY(-3px); }
      .sr-res-item { transition: border-color var(--dur-base), background var(--dur-base); }
      .sr-res-item:hover, .sr-res-item:focus-visible { border-color: rgba(255,217,138,0.45); background: rgba(255,217,138,0.09); }
      @media (prefers-reduced-motion: reduce) {
        .sr-bay-ship, .sr-ship-flame, .sr-res-ring { animation: none; }
      }
    `}</style>
  );
}

/* ---------- 飞船（远航坞与跃迁转场共用同一艘） ---------- */
function ShipSVG({ width = 160 }) {
  return (
    <svg viewBox="0 0 160 64" style={{ width, display: 'block', filter: 'drop-shadow(0 0 18px rgba(159,198,255,0.35))' }}>
      <defs>
        <linearGradient id="srw-hull" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#56689c" /><stop offset="0.55" stopColor="#9fc6ff" /><stop offset="1" stopColor="#e8f0ff" />
        </linearGradient>
        <linearGradient id="srw-flame" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#fff4d6" /><stop offset="0.35" stopColor="#ffd98a" /><stop offset="1" stopColor="rgba(255,184,107,0)" />
        </linearGradient>
      </defs>
      <g className="sr-ship-flame" style={{ transformOrigin: '46px 32px' }}>
        <path d="M46 27 L4 32 L46 37 Z" fill="url(#srw-flame)" opacity="0.9" />
        <path d="M46 29.5 L18 32 L46 34.5 Z" fill="#fff4d6" opacity="0.8" />
      </g>
      <path d="M44 32 C56 16, 96 12, 128 26 L148 32 L128 38 C96 52, 56 48, 44 32 Z" fill="url(#srw-hull)" />
      <ellipse cx="112" cy="28" rx="11" ry="6" fill="#0b0e22" stroke="rgba(159,198,255,0.8)" strokeWidth="1.2" />
      <ellipse cx="115" cy="27" rx="4" ry="2.2" fill="rgba(159,198,255,0.9)" />
      <path d="M70 20 L84 6 L92 18 Z" fill="#56689c" />
      <path d="M70 44 L84 58 L92 46 Z" fill="#3d4c7a" />
      <circle cx="132" cy="32" r="2" fill="#ffd98a">
        <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ---------- 远航坞：飞船在发射台待命，点火后冲出画面 ---------- */
function LaunchBay({ launching }) {
  return (
    <div style={{ position: 'relative', height: 210, marginTop: 26, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* 点火时台面的光爆 */}
      {launching && (
        <div style={{ position: 'absolute', left: '50%', bottom: 22, width: 200, height: 60, borderRadius: '50%', transformOrigin: 'center', animation: 'sr-pad-flash 0.9s ease-out both', background: 'radial-gradient(ellipse closest-side, rgba(255,217,138,0.65), rgba(255,184,107,0.2) 55%, transparent 80%)' }} />
      )}

      {/* 飞船（机头朝上待命） */}
      <div className={'sr-bay-ship' + (launching ? ' launch' : '')}
        style={{ position: 'absolute', left: '50%', bottom: 46, marginLeft: -32, width: 64, height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: 'rotate(-90deg)' }}><ShipSVG width={128} /></div>
      </div>

      {/* 发射台：一枚玻璃圆台 + 信标灯 */}
      <div style={{ position: 'absolute', left: '50%', bottom: 26, transform: 'translateX(-50%)', width: 230, height: 22, borderRadius: '50%', background: 'radial-gradient(ellipse closest-side, rgba(159,198,255,0.22), rgba(159,198,255,0.06) 60%, transparent 85%)', border: '1px solid rgba(159,198,255,0.18)' }} />
      <div style={{ position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)', width: 300, height: 10, borderRadius: '50%', background: 'radial-gradient(ellipse closest-side, rgba(159,198,255,0.10), transparent 80%)' }} />
      {[-96, -52, 52, 96].map((dx, i) => (
        <span key={i} style={{ position: 'absolute', left: `calc(50% + ${dx}px)`, bottom: 32, width: 4, height: 4, borderRadius: '50%', background: launching ? 'var(--gold)' : 'var(--star-blue)', boxShadow: `0 0 8px ${launching ? 'var(--gold)' : 'var(--star-blue)'}`, animation: `sr-beacon ${launching ? 0.35 : 1.8}s ease-in-out ${i * (launching ? 0.08 : 0.4)}s infinite` }} />
      ))}

      {/* 台侧播报 */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.28em', textTransform: 'uppercase', color: launching ? 'var(--gold)' : 'var(--text-3)' }}>
        {launching ? `IGNITION · ${launching.name}` : 'DOCK · READY'}
      </div>
    </div>
  );
}

const VISIBILITY_OPTS = [
  { id: 'outline', label: '星名 + 大纲', desc: '访客可见星名、标签与各级标题，正文永不可见' },
  { id: 'stars', label: '仅星名', desc: '访客只能看到星与连线的形状' },
];

/* ---------- 我的分享 ---------- */
function SharePanel({ flash, onGoFriends }) {
  const N = window.SRNet;
  const [share, setShare] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  // 好友名单：给「把星系分享给好友」的选择器用；后端不可用时本面板整体不渲染
  const [friends, setFriends] = React.useState(null);
  const [inviting, setInviting] = React.useState(null); // 正在投递的好友 id
  const load = () => N.api('/api/share').then(setShare).catch(() => setShare(null));
  React.useEffect(() => { load(); }, []);
  React.useEffect(() => {
    N.api('/api/friends').then(r => setFriends(r.friends || [])).catch(() => setFriends([]));
  }, []);

  // 造访邀请：POST /api/inbox/send kind:'galaxy'（payload 由服务端生成，带当前密文）
  const invite = (f) => {
    if (inviting) return;
    setInviting(f.id);
    N.inbox.send(f.id, 'galaxy').then(r => {
      if (!r) flash('星际网络暂不可用，稍后再试', 'danger');
      else if (r.error) flash(r.error, 'danger');
      else if (r.duplicate) flash(`邀请已在「${f.name}」的收件箱里等待领取`);
      else flash(`已送达「${f.name}」的收件箱`);
    }).finally(() => setInviting(null));
  };

  const post = (body, msg) => {
    setBusy(true);
    N.api('/api/share', { method: 'POST', body }).then(s => { setShare(prev => ({ ...prev, ...s })); if (msg) flash(msg); load(); })
      .catch(e => flash(e.message, 'danger')).finally(() => setBusy(false));
  };
  const copyCode = () => {
    try { navigator.clipboard.writeText(share.code); flash('密文已复制 · 发给朋友即可造访你的星系'); } catch (e) { flash('复制失败，请手动选择', 'danger'); }
  };
  const toggleBlock = (v) => {
    N.api('/api/share/block', { method: 'POST', body: { viewerId: v.id, blocked: !v.blocked } })
      .then(() => { flash(v.blocked ? `已恢复「${v.name}」的访问` : `已对「${v.name}」隐身`); load(); })
      .catch(e => flash(e.message, 'danger'));
  };

  if (!share) return <div style={{ padding: 40, color: 'var(--text-3)', fontSize: 13 }}>正在连接星际网络…（后端未运行时此页不可用）</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 620 }}>
      <GlassPanel data-tour="visit-share" radius="lg" pad="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ position: 'relative', width: 38, height: 38, borderRadius: 12, background: share.enabled ? 'rgba(255,217,138,0.12)' : 'rgba(159,198,255,0.08)', border: '1px solid', borderColor: share.enabled ? 'rgba(255,217,138,0.3)' : 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="radio-tower" size={19} color={share.enabled ? 'var(--gold)' : 'var(--text-3)'} />
            {share.enabled && (
              <React.Fragment>
                <span style={{ position: 'absolute', inset: -2, borderRadius: 14, border: '1px solid rgba(255,217,138,0.5)', animation: 'sr-ping 2.4s ease-out infinite', pointerEvents: 'none' }} />
                <span style={{ position: 'absolute', inset: -2, borderRadius: 14, border: '1px solid rgba(255,217,138,0.35)', animation: 'sr-ping 2.4s ease-out 1.2s infinite', pointerEvents: 'none' }} />
              </React.Fragment>
            )}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: 'var(--text-1)' }}>星系访问</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{share.enabled ? '你的星空正在对持有密文的人开放' : '已关闭 · 任何人都无法造访'}</div>
          </div>
          <Button variant={share.enabled ? 'secondary' : 'primary'} size="sm" glow={!share.enabled} disabled={busy}
            onClick={() => post({ enabled: !share.enabled }, share.enabled ? '星系已关闭访问' : '星系已开放 · 把密文分享给朋友吧')}>
            {share.enabled ? '关闭访问' : '开放星系'}
          </Button>
        </div>

        {share.enabled && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 7 }}>星系密文 · 持有它的人才能造访</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 17, letterSpacing: '0.12em', color: 'var(--gold-white)', padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'rgba(3,4,12,0.5)', border: '1px solid var(--glass-border-strong)', textShadow: 'var(--text-glow-warm)' }}>{share.code}</span>
                <IconButton name="copy" title="复制密文" onClick={copyCode} />
                <IconButton name="refresh-cw" title="重置密文（旧密文立即失效）" onClick={() => post({ reset: true }, '密文已重置 · 旧密文全部失效')} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 7 }}>访客可见度</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {VISIBILITY_OPTS.map(o => {
                  const on = share.visibility === o.id;
                  return (
                    <div key={o.id} role="radio" aria-checked={on} onClick={() => !on && post({ visibility: o.id }, `可见度已改为「${o.label}」`)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', cursor: 'pointer', borderRadius: 'var(--r-md)', border: '1px solid', borderColor: on ? 'rgba(255,217,138,0.4)' : 'var(--glass-border)', background: on ? 'rgba(255,217,138,0.08)' : 'rgba(159,198,255,0.04)' }}>
                      <span style={{ width: 15, height: 15, borderRadius: '50%', marginTop: 2, flex: 'none', border: '1.5px solid', borderColor: on ? 'var(--gold)' : 'var(--text-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />}
                      </span>
                      <div>
                        <div style={{ fontSize: 13, color: on ? 'var(--text-1)' : 'var(--text-2)' }}>{o.label}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{o.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* 把星系分享给好友：造访邀请直接寄进对方的收件箱（服务端自动带上当前密文） */}
      <GlassPanel radius="lg" pad="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="send" size={15} color="var(--star-blue)" />
          <span style={{ fontSize: 14, color: 'var(--text-1)' }}>把星系分享给好友</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>造访邀请会带上你的星系密文，寄进对方的收件箱，领取即可造访。</div>
        {!share.enabled ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'rgba(159,198,255,0.04)' }}>
            <Icon name="radio-tower" size={16} color="var(--text-3)" />
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>星系访问还没开启——先开放星系，邀请才有处可去。</span>
            <Button size="sm" variant="primary" glow disabled={busy} onClick={() => post({ enabled: true }, '星系已开放 · 现在可以寄出邀请了')}>开放星系</Button>
          </div>
        ) : friends === null ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>正在呼叫好友名单…</div>
        ) : !friends.length ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'rgba(159,198,255,0.04)' }}>
            <Icon name="user-plus" size={16} color="var(--text-3)" />
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>还没有星际好友——先交换密文成为好友。</span>
            <Button size="sm" variant="ghost" icon="key-round" onClick={onGoFriends}>去连接好友星系</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {friends.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 2px' }}>
                <span style={{ width: 28, height: 28, flex: 'none', borderRadius: '50%', background: 'linear-gradient(140deg, #2a3566, #56689c)', border: '1px solid var(--glass-border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-1)' }}>{f.avatar}</span>
                <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                <Button size="sm" variant="ghost" icon="send" disabled={inviting === f.id} onClick={() => invite(f)}>
                  {inviting === f.id ? '寄出中…' : '寄出邀请'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      <GlassPanel radius="lg" pad="md">
        <div style={{ fontSize: 12, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>访客 · {((share.visitors || []).length)}</div>
        {!(share.visitors || []).length && <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>还没有人造访过你的星系。把密文发给朋友试试。</div>}
        {(share.visitors || []).map(v => (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(140deg, #2a3566, #56689c)', border: '1px solid var(--glass-border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-1)', opacity: v.blocked ? 0.45 : 1 }}>{v.avatar}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, color: v.blocked ? 'var(--text-3)' : 'var(--text-1)' }}>{v.name}</span>
              {v.blocked && <Badge tone="neutral" style={{ marginLeft: 8 }}>已隐身</Badge>}
              {/* 访客足迹：lastVisit 由 /api/visit 落笔，主人在这里看到「谁刚来过」 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 11, color: 'var(--text-3)', opacity: v.lastVisit ? 1 : 0.7 }}>
                <Icon name="footprints" size={11} color="currentColor" />{visitAgo(v.lastVisit)}
              </div>
            </div>
            <Button size="sm" variant="ghost" icon={v.blocked ? 'eye' : 'eye-off'} onClick={() => toggleBlock(v)}>
              {v.blocked ? '恢复可见' : '对 TA 隐身'}
            </Button>
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}

/* ---------- 好友星系列表 + 兑换 ---------- */
function FriendsPanel({ flash, onVisit, launching }) {
  const N = window.SRNet;
  const [friends, setFriends] = React.useState([]);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const load = () => N.api('/api/friends').then(r => {
    const list = r.friends || [];
    setFriends(list);
    // 同步侧边栏「星际漫游」的好友数角标
    const D = window.SR_DATA;
    if (D.social) { D.social.friends = list.length; window.dispatchEvent(new CustomEvent('sr-friends')); }
  }).catch(() => { });
  React.useEffect(() => { load(); }, []);
  // 收件箱「去造访」的接线：邀请里的密文放在 sessionStorage（sr.visit.code），到这里预填
  React.useEffect(() => {
    const pull = () => {
      try {
        const c = sessionStorage.getItem('sr.visit.code');
        if (c) { setCode(c); sessionStorage.removeItem('sr.visit.code'); }
      } catch (e) { }
    };
    pull();
    window.addEventListener('sr-visit-code', pull);
    return () => window.removeEventListener('sr-visit-code', pull);
  }, []);

  const redeem = () => {
    const c = code.trim(); if (!c) return;
    setBusy(true);
    N.api('/api/friends/redeem', { method: 'POST', body: { code: c } })
      .then(r => {
        codeMemo.set(r.friend.id, c.toUpperCase()); // 记住密文：造访时「收纳这颗星」要用
        flash(`已连接「${r.friend.name}」的星系`, 'gold'); setCode(''); load();
      })
      .catch(e => flash(e.message, 'danger')).finally(() => setBusy(false));
  };
  const [confirm, setConfirm] = React.useState(null); // {message, confirmLabel, onYes}
  const remove = (f) => setConfirm({
    message: `移除「${f.name} 的星系」？移除后需要重新输入密文才能再次连接。`,
    confirmLabel: '移除',
    onYes: () => {
      N.api('/api/friends/remove', { method: 'POST', body: { friendId: f.id } })
        .then(() => { flash(`已移除「${f.name}」的星系`); load(); }).catch(e => flash(e.message, 'danger'));
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <GlassPanel radius="lg" pad="md" style={{ maxWidth: 620 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>输入朋友的星系密文，连接一片新的星空</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XING-XXXX-XXXX（试试演示密文 XING-DEMO-2333）"
            icon="key-round" size="md" style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
            onKeyDown={(e) => { if (e.key === 'Enter') redeem(); }} />
          <Button variant="primary" size="md" icon="telescope" glow disabled={busy || !code.trim()} onClick={redeem}>连接</Button>
        </div>
      </GlassPanel>

      {!friends.length && (
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '0 4px' }}>
          远航坞的飞船在待命——向朋友要一段密文，为它设定第一个目的地。
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
        {friends.map((f, fi) => {
          const reachable = f.enabled && !f.blocked;
          // 卡片里的装饰小星：位置由好友 id 决定，稳定不闪跳
          const seeds = [(f.id * 37) % 100, (f.id * 61) % 100, (f.id * 89) % 100];
          return (
            <div key={f.id} className="sr-visit-card">
              <GlassPanel radius="lg" pad="md" style={{ position: 'relative', overflow: 'hidden', opacity: reachable ? 1 : 0.6 }}>
                {seeds.map((s, i) => (
                  <span key={i} style={{ position: 'absolute', left: (14 + s * 0.72) + '%', top: (10 + ((s * 7 + i * 31) % 46)) + '%', width: 3, height: 3, borderRadius: '50%', background: i === 1 ? 'var(--gold)' : 'var(--star-blue)', boxShadow: `0 0 6px ${i === 1 ? 'var(--gold)' : 'var(--star-blue)'}`, animation: `sr-twk ${2.6 + i}s ease-in-out ${i * 0.7}s infinite`, pointerEvents: 'none' }} />
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 44, height: 44, flex: 'none', borderRadius: '50%', background: 'linear-gradient(140deg, #2a3566, #56689c)', border: '1px solid var(--glass-border-strong)', boxShadow: reachable ? 'var(--glow-faint)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: 'var(--text-1)' }}>{f.avatar}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name} 的星系</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                      {f.enabled
                        ? (f.blocked ? <span>对方暂时对你隐身</span> : <React.Fragment><Icon name="sparkles" size={11} color="var(--gold)" /><span>{f.starCount} 颗星</span><span>·</span><span>{f.visibility === 'outline' ? '可见大纲' : '仅星名'}</span></React.Fragment>)
                        : <span>对方已关闭访问</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <Button size="sm" variant="ghost" icon="x" onClick={() => remove(f)}>移除</Button>
                  <div style={{ flex: 1 }} />
                  <Button size="sm" variant="primary" icon="rocket" glow disabled={!reachable || !!launching}
                    onClick={() => onVisit(f)}>
                    {launching && launching.id === f.id ? '点火中…' : '造访'}
                  </Button>
                </div>
              </GlassPanel>
            </div>
          );
        })}
      </div>

      {/* 远航坞：飞船在这里待命，点「造访」即点火 */}
      <LaunchBay launching={launching} />

      {confirm && window.SRKit.ConfirmDialog && (
        <window.SRKit.ConfirmDialog message={confirm.message} confirmLabel={confirm.confirmLabel}
          onYes={() => { confirm.onYes(); setConfirm(null); }} onClose={() => setConfirm(null)} />
      )}
    </div>
  );
}

/* ---------- 跃迁转场：飞船穿越星流，抵达后加速离场 ----------
   cruise 阶段飞船居中巡航、星光拉成流线；数据就绪且演出满最短时长后
   进入 depart：飞船冲出画面，幕布淡出。 */
function WarpOverlay({ name, ready, onFinish }) {
  const MIN_MS = 1900;
  const [phase, setPhase] = React.useState('cruise'); // cruise | depart
  const t0 = React.useRef(performance.now());

  React.useEffect(() => {
    if (!ready || phase !== 'cruise') return;
    const wait = Math.max(0, MIN_MS - (performance.now() - t0.current));
    const t = setTimeout(() => setPhase('depart'), wait);
    return () => clearTimeout(t);
  }, [ready, phase]);
  React.useEffect(() => {
    if (phase !== 'depart') return;
    const t = setTimeout(onFinish, 700);
    return () => clearTimeout(t);
  }, [phase]);

  // 星流线：一次生成，蓝为主、偶有金
  const streaks = React.useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    top: 4 + Math.random() * 92,
    w: 60 + Math.random() * 180,
    delay: Math.random() * 1.2,
    dur: 0.55 + Math.random() * 0.7,
    gold: i % 9 === 0,
    op: 0.25 + Math.random() * 0.5,
  })), []);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, overflow: 'hidden', background: 'radial-gradient(120% 100% at 50% 50%, #080a18 0%, #03040c 70%)', opacity: phase === 'depart' ? 0 : 1, transition: 'opacity 0.55s ease 0.15s', pointerEvents: phase === 'depart' ? 'none' : 'auto' }}>
      <style>{`
        @keyframes sr-warp-streak { from { transform: translateX(60vw); } to { transform: translateX(-140vw); } }
        @keyframes sr-warp-bob { 0%,100% { transform: translateY(-4px) rotate(-1deg); } 50% { transform: translateY(4px) rotate(1deg); } }
        @keyframes sr-warp-flame { 0%,100% { transform: scaleX(1); opacity: 0.9; } 50% { transform: scaleX(1.35); opacity: 0.6; } }
        @keyframes sr-warp-dots { 0% { content: '·'; } 33% { content: '· ·'; } 66% { content: '· · ·'; } }
        .sr-warp-eta::after { content: '· · ·'; animation: sr-warp-dots 1.2s steps(1) infinite; margin-left: 6px; }
        .sr-warp-ship { animation: sr-warp-bob 2.2s var(--ease-flight) infinite; transition: transform 0.65s cubic-bezier(0.6, 0, 0.9, 0.4); }
        .sr-warp-ship.depart { transform: translateX(120vw) !important; animation: none; }
      `}</style>

      {/* 星流 */}
      {streaks.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: s.top + '%', height: 1.5, width: s.w,
          background: s.gold ? 'linear-gradient(90deg, transparent, rgba(255,217,138,0.85), transparent)' : 'linear-gradient(90deg, transparent, rgba(159,198,255,0.8), transparent)',
          opacity: s.op, borderRadius: 2,
          animation: `sr-warp-streak ${s.dur}s linear ${s.delay}s infinite`,
        }} />
      ))}

      {/* 飞船（居中巡航，出发时冲出画面）——与远航坞同一艘 */}
      <div className={'sr-warp-ship' + (phase === 'depart' ? ' depart' : '')}
        style={{ position: 'absolute', left: 'calc(50% - 80px)', top: 'calc(50% - 56px)', width: 160 }}>
        <ShipSVG width={160} />
      </div>

      {/* 目的地播报——背景固定是深空黑，墨水必须用固定亮色，不随主题（黎明深字压黑幕不可读） */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '18%', textAlign: 'center', pointerEvents: 'none' }}>
        <div className="sr-warp-eta" style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--text-on-scrim-dim, rgba(214,225,255,0.86))' }}>WARP</div>
        <div style={{ marginTop: 10, fontSize: 17, fontWeight: 300, color: 'var(--text-on-scrim, rgba(255,255,255,0.92))', letterSpacing: '0.04em' }}>
          正在跃迁 · 目的地 <span style={{ color: '#fff4d6', textShadow: '0 0 18px rgba(255,217,138,0.45)' }}>{name}</span> 的星系
        </div>
      </div>
    </div>
  );
}

/* ---------- 造访：只读星图（与自己的星图同一套相机手感） ---------- */
function VisitMap({ friend, onBack, onReady, flash }) {
  const N = window.SRNet;
  const ref = React.useRef(null);
  const [state, setState] = React.useState({ loading: true });
  const [view, setView] = React.useState({ x: 0, y: 0, k: 0.8 });
  const [selected, setSelected] = React.useState(null);
  const [mode, setMode] = React.useState('map'); // map | 3d | aerial
  const [collecting, setCollecting] = React.useState(false);
  const [resOpen, setResOpen] = React.useState(false);   // 共鸣清单面板
  const [noteOpen, setNoteOpen] = React.useState(false); // 星语输入浮层
  const [noteText, setNoteText] = React.useState('');
  const [sendingNote, setSendingNote] = React.useState(false);
  const [flying, setFlying] = React.useState(false);     // 飞往某颗星：世界层短暂带缓动
  const flyT = React.useRef(null);
  React.useEffect(() => () => clearTimeout(flyT.current), []);

  /* 收纳这颗星：POST /api/inbox/collect —— 服务端按主人的可见度生成 payload，
     投进「我自己」的收件箱（寄件人=星系主人）；重复收纳幂等，不重复入库 */
  const collectStar = (star) => {
    if (collecting) return;
    const c = codeMemo.get(friend.id);
    if (!c) { flash('缺少这片星系的密文——回到好友列表重新输入密文连接一次，就能收纳', 'danger'); return; }
    setCollecting(true);
    N.inbox.collect(c, star.id).then(r => {
      if (!r) flash('星际网络暂不可用，稍后再试', 'danger');
      else if (r.error) flash(r.error, 'danger');
      else if (r.duplicate) flash('这颗星已在你的收件箱里 · 等待领取');
      else flash(`已收进你的收件箱 · 来自 ${(state.owner && state.owner.name) || friend.name}`);
    }).finally(() => setCollecting(false));
  };
  const viewRef = React.useRef(view); viewRef.current = view;
  const drag = React.useRef(null);
  const readyRef = React.useRef(onReady); readyRef.current = onReady;

  React.useEffect(() => {
    N.api('/api/visit/' + friend.id)
      .then(r => { setState({ galaxy: r.galaxy, owner: r.owner }); readyRef.current && readyRef.current(); })
      .catch(e => { setState({ error: e.message }); readyRef.current && readyRef.current(); });
  }, [friend.id]);

  const g = state.galaxy;
  // 世界坐标：与 StarMap 相同的百分比 → 像素映射
  const stars = React.useMemo(() => (g ? g.stars.map(s => ({ ...s, wx: s.x / 100 * VWORLD.w, wy: s.y / 100 * VWORLD.h })) : []), [g]);
  const byId = React.useMemo(() => Object.fromEntries(stars.map(s => [s.id, s])), [stars]);
  // 知识共鸣：我方星图 × 对方星系，纯客户端匹配（口径见 matchResonance）
  const resonance = React.useMemo(() => matchResonance((window.SR_DATA || {}).stars, stars), [stars]);
  const resById = React.useMemo(() => Object.fromEntries(resonance.map(r => [r.id, r])), [resonance]);
  // 注入给 3D / 鸟瞰的只读数据集（形状与 window.SR_DATA 对齐）
  const dataset = React.useMemo(() => (g ? {
    stars, constellations: g.constellations, connections: g.connections, byId,
    timeline: [], notes: [], trash: [],
    ownerName: state.owner ? state.owner.name : '',
    conName: (id) => (g.constellations.find(c => c.id === id) || {}).name,
    conColor: (id) => (g.constellations.find(c => c.id === id) || {}).color,
  } : null), [g, stars, byId, state.owner]);

  // 初始视图：把整片星系收进画面正中
  React.useEffect(() => {
    if (!stars.length || !ref.current) return;
    const el = ref.current, w = el.clientWidth, h = el.clientHeight;
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    stars.forEach(s => { a = Math.min(a, s.wx); b = Math.min(b, s.wy); c = Math.max(c, s.wx); d = Math.max(d, s.wy); });
    const k = vclamp(Math.min(w / (c - a + 480), h / (d - b + 420)), 0.4, 1.4);
    setView({ k, x: w / 2 - (a + c) / 2 * k, y: h / 2 - (b + d) / 2 * k });
  }, [stars]);

  // 拖拽把监听器挂在 document 上；组件卸载（如拖拽中途切视图）时必须摘除
  const dragCleanup = React.useRef(null);
  React.useEffect(() => () => { if (dragCleanup.current) dragCleanup.current(); }, []);
  const bgDown = (e) => {
    // 飞行途中开始拖拽：立刻收掉缓动，手感回到 1:1 跟手
    clearTimeout(flyT.current); setFlying(false);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y, moved: 0 };
    const move = (ev) => {
      const dcur = drag.current; if (!dcur) return;
      dcur.moved += Math.abs(ev.movementX) + Math.abs(ev.movementY);
      setView(v => ({ ...v, x: dcur.ox + (ev.clientX - dcur.sx), y: dcur.oy + (ev.clientY - dcur.sy) }));
    };
    const up = () => { drag.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); dragCleanup.current = null; };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    dragCleanup.current = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  };
  // React 的 onWheel 是被动监听、preventDefault 无效；与 Galaxy3D 一样用原生非被动监听
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setView(v => {
        const k = vclamp(v.k * (e.deltaY < 0 ? 1.12 : 0.89), 0.34, 2.6);
        // 缩放锚定在光标：保持光标下的世界点不动
        return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [state.galaxy]);
  const zoomBy = (f) => setView(v => ({ ...v, k: vclamp(v.k * f, 0.34, 2.6) }));

  /* 飞到一颗星：选中 + 相机居中（保持当前缩放）。世界层短暂开缓动做飞行感，
     data-motion="off" 时全局规则把 transition 收敛为瞬移，自然合规 */
  const flyTo = (starId) => {
    const s = byId[starId]; if (!s) return;
    setSelected(starId); setResOpen(false);
    const el = ref.current; if (!el) return;
    setFlying(true);
    setView(v => ({ ...v, x: el.clientWidth / 2 - s.wx * v.k, y: el.clientHeight / 2 - s.wy * v.k }));
    clearTimeout(flyT.current);
    flyT.current = setTimeout(() => setFlying(false), 750);
  };

  /* 星语留言：≤160 字纯文本，寄进主人的收件箱（kind 'note'）。
     soften 语义：null=网络不可用；{error}=业务拒绝（非好友 / 太频繁 / 未读满 5 句） */
  const sendNote = () => {
    const text = noteText.trim().slice(0, 160);
    const ownerId = state.owner && state.owner.id;
    if (!text || sendingNote || !ownerId) return;
    setSendingNote(true);
    N.inbox.send(ownerId, 'note', null, { text }).then(r => {
      if (!r) flash('星际网络暂不可用，稍后再试', 'danger');
      else if (r.error) flash(r.error, 'danger');
      else { flash('星语已寄出 ✦', 'gold'); setNoteText(''); setNoteOpen(false); }
    }).finally(() => setSendingNote(false));
  };

  if (state.loading) return <div style={{ flex: 1, padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>正在飞往「{friend.name}」的星系…</div>;
  if (state.error) return (
    <div style={{ flex: 1, padding: 60, textAlign: 'center' }}>
      <Icon name="cloud-off" size={30} color="var(--star-blue-dim)" />
      <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 14 }}>{state.error}</div>
      <Button size="sm" variant="ghost" icon="corner-up-left" style={{ marginTop: 18 }} onClick={onBack}>返回</Button>
    </div>
  );

  // 三维 / 鸟瞰：直接复用同一套视图组件，只注入对方的只读数据集。
  // 不包任何额外容器、不加悬浮层——与浏览自己星空时的渲染路径完全一致，
  // 主人名字由组件在自己已有的 HUD 里展示（dataset.ownerName）。
  if (mode === '3d' || mode === 'aerial') {
    const G3D = window.SRKit.Galaxy3D, Aerial = window.SRKit.AerialView;
    return mode === '3d'
      ? <G3D dataset={dataset} onClose={() => setMode('map')} />
      : <Aerial dataset={dataset} onClose={() => setMode('map')} onOpenCon={() => setMode('map')} />;
  }

  const outlineMode = g.visibility === 'outline';
  const sel = selected ? byId[selected] : null;
  // 星域几何：质心 + 成员散布半径 + 平均记忆（与 StarMap 的 domainGeom/domainColor 同一口径）
  const geoms = g.constellations.map(c => {
    const members = stars.filter(s => s.con === c.id);
    if (!members.length) return null;
    const cx = members.reduce((a, s) => a + s.wx, 0) / members.length;
    const cy = members.reduce((a, s) => a + s.wy, 0) / members.length;
    const r = Math.max(150, ...members.map(s => Math.hypot(s.wx - cx, s.wy - cy))) + 96;
    const avg = members.reduce((a, s) => a + s.strength, 0) / members.length;
    return { con: c, cx, cy, r, count: members.length, col: avg >= 0.78 ? '#ffd98a' : c.color };
  }).filter(Boolean);
  const nameOpacity = vclamp(1.4 - view.k, 0.25, 1); // 语义缩放：拉远时域名更醒目

  return (
    <div ref={ref} onMouseDown={bgDown}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: drag.current ? 'grabbing' : 'grab', userSelect: 'none', background: 'var(--bg-deepspace)' }}>
      <sr-starfield density="1"></sr-starfield>

      {/* 世界层：与 StarMap 相同的 translate+scale 相机 */}
      <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, willChange: 'transform', transition: flying ? 'transform 0.7s var(--ease-flight)' : 'none' }}>
        {/* 星域：大气光圈 + 主星太阳 + 发光域名——与自己的星图同一套视觉语言，只是不可拖动 */}
        {geoms.map(({ con, cx, cy, r, count, col }) => (
          <div key={con.id}>
            <div style={{ position: 'absolute', left: cx, top: cy, width: r * 2, height: r * 2, transform: 'translate(-50%,-50%)', borderRadius: '50%',
              background: `radial-gradient(circle, ${col}2b 0%, ${col}16 44%, transparent 72%)`,
              border: `1.5px solid ${col}4a`,
              boxShadow: `0 0 60px ${col}28, inset 0 0 80px ${col}1f`,
              pointerEvents: 'none' }} />
            <div title={`星域「${con.name}」`}
              style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, calc(-50% + 14px))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, zIndex: 3, pointerEvents: 'none' }}>
              <span className="sr-breathe" style={{
                width: 30, height: 30, borderRadius: '50%', flex: 'none',
                background: 'radial-gradient(circle at 38% 34%, #fff6e0 0%, #ffd58a 32%, #ff9d52 64%, #e8623a 100%)',
                boxShadow: '0 0 48px 9px rgba(255,128,60,0.5), 0 0 18px 3px rgba(255,196,120,0.85), inset 0 0 9px rgba(255,90,40,0.45)',
              }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: nameOpacity, transition: 'opacity var(--dur-base)', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 15.5, fontWeight: 400, letterSpacing: '0.06em', color: 'var(--sun-label, #ffe3b0)', textShadow: 'var(--sun-label-glow, 0 0 12px rgba(255,150,70,0.55), 0 1px 8px rgba(0,0,0,0.85))' }}>{con.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--sun-label-dim, rgba(255,200,140,0.62))' }}>{count}</span>
              </span>
            </div>
          </div>
        ))}

        <svg width={VWORLD.w} height={VWORLD.h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
          {g.connections.map((cn, i) => {
            const a = byId[cn.a], b = byId[cn.b]; if (!a || !b) return null;
            const d = window.SRConnect ? window.SRConnect(a.wx, a.wy, b.wx, b.wy, 0.1 + (i % 3) * 0.03)
              : `M${a.wx},${a.wy} Q${(a.wx + b.wx) / 2},${(a.wy + b.wy) / 2 - 40} ${b.wx},${b.wy}`;
            const lit = Math.min(a.strength, b.strength);
            return <path key={i} d={d} fill="none" stroke={cn.kind === 'cross' ? 'rgba(255,217,138,0.35)' : `rgba(159,198,255,${0.16 + lit * 0.2})`} strokeWidth="1.1" />;
          })}
        </svg>

        {stars.map(s => {
          const res = resById[s.id];
          // 共鸣环外径：跟随星核尺寸（StarNode 的 core = 12×importance），强共鸣更亮
          const ringR = (12 * (s.importance || 1) + 24) / 2;
          return (
            <div key={s.id} onMouseDown={(e) => e.stopPropagation()} onClick={() => { setResOpen(false); setSelected(s.id === selected ? null : s.id); }}
              style={{ position: 'absolute', left: s.wx, top: s.wy, zIndex: 4 }}>
              {res && (
                <span className="sr-res-ring" style={{
                  position: 'absolute', left: -ringR, top: -ringR, width: ringR * 2, height: ringR * 2,
                  borderRadius: '50%', pointerEvents: 'none', zIndex: 3,
                  border: res.kind === 'strong' ? '1.5px solid rgba(255,217,138,0.75)' : '1px solid rgba(255,217,138,0.45)',
                  boxShadow: res.kind === 'strong'
                    ? '0 0 16px rgba(255,217,138,0.4), inset 0 0 10px rgba(255,217,138,0.18)'
                    : '0 0 10px rgba(255,217,138,0.22)',
                }} />
              )}
              <StarNode strength={s.strength} importance={s.importance || 1} label={s.label}
                selected={selected === s.id}
                style={{ left: 0, top: 0, transform: 'translate(-50%, calc(-50% + 11.5px))', cursor: 'pointer' }} />
            </div>
          );
        })}
      </div>

      {/* 顶部 HUD */}
      <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 18, left: 22, right: 22, zIndex: 30, display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'none' }}>
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', pointerEvents: 'auto' }}>
          <IconButton name="corner-up-left" size="sm" title="返回好友列表" onClick={onBack} />
          <Icon name="telescope" size={16} color="var(--gold)" />
          <span style={{ fontSize: 14, color: 'var(--text-1)' }}>{(state.owner && state.owner.name) || friend.name} 的星系</span>
          <Badge tone="gold">{outlineMode ? '可见大纲' : '仅星名'}</Badge>
          {/* 主人的星空简介（设置 → 个人简介），服务端已剥 HTML 钳长度 */}
          {state.owner && state.owner.bio && (
            <span style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={state.owner.bio}>
              「{state.owner.bio}」
            </span>
          )}
        </GlassPanel>
        <div style={{ flex: 1 }} />
        {/* 知识共鸣 chip：有共鸣才出现，金=共同拥有的知识 */}
        {!!resonance.length && (
          <button type="button" title="你们俩都拥有的知识" aria-expanded={resOpen}
            onClick={() => { setResOpen(o => !o); setSelected(null); }}
            style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', font: 'inherit', fontSize: 12.5, cursor: 'pointer', borderRadius: 'var(--r-pill)', color: 'var(--gold-white)', border: '1px solid', borderColor: resOpen ? 'rgba(255,217,138,0.6)' : 'rgba(255,217,138,0.4)', background: resOpen ? 'rgba(255,217,138,0.16)' : 'rgba(255,217,138,0.1)', backdropFilter: 'blur(10px)', boxShadow: '0 0 14px rgba(255,217,138,0.12)' }}>
            <Icon name="sparkles" size={14} color="var(--gold)" />
            共鸣 <b style={{ fontWeight: 500, color: 'var(--gold)' }}>{resonance.length}</b> 处
          </button>
        )}
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '8px 18px', pointerEvents: 'auto' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>知识星 <b style={{ color: 'var(--text-1)', fontWeight: 500 }}>{stars.length}</b></span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>星域 <b style={{ color: 'var(--star-blue)', fontWeight: 500 }}>{geoms.length}</b></span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>连接 <b style={{ color: 'var(--gold)', fontWeight: 500 }}>{g.connections.length}</b></span>
        </GlassPanel>
      </div>

      {/* 提示 + 缩放控件 */}
      <div style={{ position: 'absolute', bottom: 26, left: 24, zIndex: 30, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-3)', pointerEvents: 'none' }}>
        <Icon name="move" size={14} color="currentColor" />拖拽平移 · 滚轮缩放 · 点星看大纲 · 只读造访，笔记正文不会离开对方的数据库
      </div>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 26, right: 24, zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        {/* 星语留言：给主人留一句话，寄进对方的收件箱 */}
        <GlassPanel radius="pill" pad="none" style={{ padding: '4px 6px' }}>
          <Button size="sm" variant="ghost" icon="feather" onClick={() => setNoteOpen(o => !o)}>留下星语</Button>
        </GlassPanel>
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px' }}>
          <IconButton name="minus" size="sm" title="缩小" onClick={() => zoomBy(0.85)} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', minWidth: 42, textAlign: 'center' }}>{Math.round(view.k * 100)}%</span>
          <IconButton name="plus" size="sm" title="放大" onClick={() => zoomBy(1.18)} />
          <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
          <IconButton name="box" size="sm" title="三维星系" onClick={() => setMode('3d')} />
          <IconButton name="satellite" size="sm" title="亮度鸟瞰" onClick={() => setMode('aerial')} />
        </GlassPanel>
      </div>

      {/* 共鸣清单：对方星名 ↔ 我方星名 / 共同标签，点条目飞过去 */}
      {resOpen && (
        <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 20, top: 68, width: 324, zIndex: 45, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
          <GlassPanel strong radius="lg" pad="md" glow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sparkles" size={15} color="var(--gold)" />
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text-1)' }}>知识共鸣</span>
              <Badge tone="gold">{resonance.length} 处</Badge>
              <IconButton name="x" size="sm" title="关闭" onClick={() => setResOpen(false)} />
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-3)', margin: '7px 0 10px' }}>
              这些知识你们俩都拥有——点一条，飞过去看看。
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 336, overflowY: 'auto', paddingRight: 2 }}>
              {resonance.map(r => (
                <div key={r.id} className="sr-res-item" role="button" tabIndex={0}
                  onClick={() => flyTo(r.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flyTo(r.id); } }}
                  style={{ padding: '9px 11px', borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'rgba(255,217,138,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Icon name={r.kind === 'strong' ? 'star' : 'hash'} size={12} color="var(--gold)" />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.theirLabel}</span>
                    {r.bothLit && <Badge tone="gold">你们都点亮了它</Badge>}
                  </div>
                  <div style={{ marginTop: 4, paddingLeft: 19, fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-3)' }}>
                    {r.kind === 'strong'
                      ? <span>与你的「{r.mineLabel}」同名</span>
                      : <span>共同标签 {r.tags.join(' · ')} ↔ 你的「{r.mineLabels.join('」「')}」</span>}
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      )}

      {/* 星语输入浮层：≤160 字，回车寄出，Esc 收起 */}
      {noteOpen && (
        <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 24, bottom: 124, width: 324, zIndex: 45, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
          <GlassPanel strong radius="lg" pad="md" glow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <Icon name="feather" size={15} color="var(--gold)" />
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text-1)' }}>留下星语</span>
              <IconButton name="x" size="sm" title="收起" onClick={() => setNoteOpen(false)} />
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-3)', marginBottom: 10 }}>
              给 {(state.owner && state.owner.name) || friend.name} 留一句话，会寄进 TA 的收件箱。
            </div>
            <Input value={noteText} onChange={(e) => setNoteText(e.target.value.slice(0, 160))}
              placeholder="一句星语…" icon="message-circle" size="md" autoFocus maxLength={160}
              onKeyDown={(e) => { if (e.key === 'Enter') sendNote(); else if (e.key === 'Escape') setNoteOpen(false); }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{noteText.length} / 160</span>
              <Button size="sm" variant="primary" icon="send" glow disabled={sendingNote || !noteText.trim()} onClick={sendNote}>
                {sendingNote ? '寄出中…' : '寄出'}
              </Button>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* 大纲卡（服务端已裁剪，这里拿到什么就只有什么） */}
      {sel && (
        <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 20, top: 76, width: 292, zIndex: 40, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
          <GlassPanel strong radius="lg" pad="md" glow>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', opacity: 0.8 }}>{(g.constellations.find(c => c.id === sel.con) || {}).name}</div>
                <div style={{ fontSize: 18, fontWeight: 400, color: 'var(--text-1)', marginTop: 4 }}>{sel.label}</div>
              </div>
              <IconButton name="x" size="sm" title="关闭" onClick={() => setSelected(null)} />
            </div>
            <div style={{ margin: '10px 0 4px' }}><MemoryBar value={sel.strength} height={5} /></div>
            {!!(sel.tags || []).length && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '8px 0 2px' }}>
                {sel.tags.map(t => <Tag key={t} icon="hash">{t}</Tag>)}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              {outlineMode ? (
                (sel.outline || []).length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>大纲</div>
                    {sel.outline.map((o, i) => (
                      <div key={i} style={{ fontSize: o.type === 'h1' ? 13.5 : 12.5, color: 'var(--text-2)', borderLeft: '2px solid var(--line)', padding: '2px 2px 2px ' + (o.type === 'h3' ? 16 : o.type === 'h2' ? 10 : 6) + 'px', marginLeft: 2, lineHeight: 1.5 }}>{o.text}</div>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>这颗星还没有大纲。</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-3)' }}>
                  <Icon name="lock" size={13} color="currentColor" />对方只开放了星名
                </div>
              )}
            </div>
            {/* 收纳：把这颗可见的星寄进自己的收件箱（内容按主人的可见度裁剪） */}
            <div style={{ marginTop: 14 }}>
              <Button size="sm" icon="inbox" disabled={collecting} onClick={() => collectStar(sel)} style={{ width: '100%' }}>
                {collecting ? '收纳中…' : '收纳这颗星'}
              </Button>
              <div style={{ marginTop: 7, fontSize: 11, lineHeight: 1.6, color: 'var(--text-3)' }}>
                {outlineMode ? '星名与大纲要点会寄进你的收件箱，正文不会离开对方的数据库。' : '对方只开放了星名——只能收纳星名。'}
              </div>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

/* ---------- 主视图 ---------- */
function VisitView() {
  const [tab, setTab] = React.useState('friends'); // friends | share
  const [visiting, setVisiting] = React.useState(null);
  const [launching, setLaunching] = React.useState(null); // 远航坞点火中的目标好友
  const [warp, setWarp] = React.useState(false);      // 跃迁转场进行中
  const [mapReady, setMapReady] = React.useState(false);
  const [toast, setToast] = React.useState(null); // { msg, tone } — 错误与成功用不同视觉词汇
  const toastT = React.useRef(null);
  const launchT = React.useRef(null);
  const launchingRef = React.useRef(false); // 同步双击在同一轮事件里看不到 state 更新，用 ref 挡
  React.useEffect(() => () => { clearTimeout(toastT.current); clearTimeout(launchT.current); }, []);
  const flash = (msg, tone) => { setToast({ msg, tone: tone || 'blue' }); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), tone === 'danger' ? 3200 : 2200); };
  // 点火 → 起飞（1.05s，远航坞演出）→ 跃迁巡航 → 抵达
  const startVisit = (f) => {
    if (launchingRef.current) return;
    launchingRef.current = true;
    setLaunching(f);
    launchT.current = setTimeout(() => {
      launchingRef.current = false;
      setLaunching(null);
      setVisiting(f); setWarp(true); setMapReady(false);
    }, 1050);
  };

  return (
    // display:flex 与应用主区域一致——3D/鸟瞰组件靠 flex:1 撑满，
    // 渲染语境和浏览自己的星空完全相同
    <div style={{ position: 'relative', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex' }}>
      <VisitStyle />
      {visiting ? (
        <React.Fragment>
          <VisitMap friend={visiting} onBack={() => setVisiting(null)} onReady={() => setMapReady(true)} flash={flash} />
          {warp && <WarpOverlay name={visiting.name} ready={mapReady} onFinish={() => setWarp(false)} />}
        </React.Fragment>
      ) : (
        <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'auto', position: 'relative' }}>
          <sr-starfield density="0.8" meteors="0"></sr-starfield>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '34px 32px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 8 }}>
              <Icon name="telescope" size={26} color="var(--gold)" />
              <h1 style={{ fontSize: 30, fontWeight: 200, letterSpacing: '0.04em', background: 'linear-gradient(100deg, var(--gold), var(--gold-white) 45%, var(--star-blue))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>星际漫游</h1>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 22, fontWeight: 300 }}>用密文连接彼此的星空——看得见星与星域的形状，看不见笔记的内容。</div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
              {[{ id: 'friends', icon: 'rocket', label: '好友星系' }, { id: 'share', icon: 'radio-tower', label: '我的分享' }].map(t => {
                const on = tab === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => setTab(t.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', border: '1px solid', borderColor: on ? 'rgba(255,217,138,0.4)' : 'transparent', borderRadius: 'var(--r-pill)', background: on ? 'rgba(255,217,138,0.1)' : 'transparent', color: on ? 'var(--text-1)' : 'var(--text-3)', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>
                    <Icon name={t.icon} size={15} color={on ? 'var(--gold)' : 'var(--text-3)'} />{t.label}
                  </button>
                );
              })}
            </div>

            {tab === 'share' ? <SharePanel flash={flash} onGoFriends={() => setTab('friends')} /> : <FriendsPanel flash={flash} onVisit={startVisit} launching={launching} />}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 95, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }} role="status">
          <GlassPanel strong radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px' }}>
            <Icon name={toast.tone === 'danger' ? 'circle-alert' : 'check'} size={16}
              color={toast.tone === 'danger' ? 'var(--danger)' : toast.tone === 'gold' ? 'var(--gold)' : 'var(--star-blue)'} />
            <span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{toast.msg}</span>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { VisitView });
