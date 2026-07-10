/* StarMap — infinite pannable/zoomable creation canvas. Domains group stars:
   · 星域 (constellation) groups its knowledge stars. Right-click empty space → create a 星域.
   · 知识星 (note) lives INSIDE a 星域. You can only create one within a domain's
     halo — right-click inside a domain (or click its name) → 新建知识星. Outside any
     domain you can only create a 星域.
   · A domain's halo glows in its own color; once its stars are well-remembered
     (lit) the halo turns gold.
   Stars, connections and domain halos live in a transformed world layer;
   HUD / tool capsule / cards stay screen-fixed. */
const { StarNode, GlassPanel, IconButton, Icon, Button, MemoryBar } = window.StellarRaftDesignSystem_2866af;

const WORLD = { w: 1680, h: 1040 };
// New domains start in a COLD (un-lit) color; they warm to gold as their stars are remembered.
const NEW_COLORS = ['#9fc6ff', '#bcd0ff', '#7896cd', '#8ea2cc'];
const LIT_GOLD = '#ffd98a';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Geometry of a domain in world px: centroid of its stars + a radius that wraps them.
function domainGeom(con, stars) {
  const members = stars.filter(s => s.con === con.id);
  if (members.length) {
    const cx = members.reduce((a, s) => a + s.wx, 0) / members.length;
    let cy = members.reduce((a, s) => a + s.wy, 0) / members.length;
    // 单星星域：质心与唯一成员重合，主星会压住知识星让它无法点击——主星上移让位
    if (members.length === 1) cy -= 96;
    const r = Math.max(150, ...members.map(s => Math.hypot(s.wx - cx, s.wy - cy))) + 96;
    return { cx, cy, r, members: members.length };
  }
  return { cx: con.wx, cy: con.wy, r: 170, members: 0 };
}
// Halo color: a domain's own color, or gold once its stars are, on average, "lit".
function domainColor(con, stars) {
  const members = stars.filter(s => s.con === con.id);
  if (!members.length) return con.color;
  const avg = members.reduce((a, s) => a + s.strength, 0) / members.length;
  return avg >= 0.78 ? LIT_GOLD : con.color;
}

function HudStat({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 64 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: tone || 'var(--text-1)' }}>{value}</span>
    </div>
  );
}

/* connections, in world px — star-shaped around each domain's sun:
   · every knowledge star links to its domain's sun (intra, blue)
   · suns link to suns across domains that share a 融会贯通 link (cross, gold) */
function Connections({ stars, cons, dim }) {
  const D = window.SR_DATA;
  const byId = React.useMemo(() => Object.fromEntries(stars.map(s => [s.id, s])), [stars]);
  const suns = React.useMemo(() => { const m = {}; cons.forEach(c => { m[c.id] = domainGeom(c, stars); }); return m; }, [cons, stars]);
  // domain↔domain pairs, derived from the cross links in the data
  const crossPairs = React.useMemo(() => {
    const seen = new Set(), pairs = [];
    D.connections.forEach(c => {
      if (c.kind !== 'cross') return;
      const A = byId[c.a], B = byId[c.b]; if (!A || !B || A.con === B.con) return;
      const key = [A.con, B.con].sort().join('|'); if (seen.has(key)) return; seen.add(key); pairs.push([A.con, B.con]);
    });
    return pairs;
  }, [stars]);

  // non-scaling-stroke keeps the lines a constant on-screen thickness at any zoom
  const line = (key, d, gold) => (
    <g key={key}>
      <path d={d} fill="none" vectorEffect="non-scaling-stroke" stroke={gold ? 'var(--gold)' : 'var(--star-blue)'} strokeWidth={gold ? 4 : 3} opacity={gold ? 0.5 : 0.3} filter="url(#cglow)" />
      <path d={d} fill="none" vectorEffect="non-scaling-stroke" stroke={gold ? 'var(--gold)' : 'var(--star-blue)'} strokeWidth={gold ? 1.8 : 1.3} opacity={0.82} />
      <path d={d} fill="none" vectorEffect="non-scaling-stroke" stroke={gold ? 'var(--flow-dash-gold, #fff4d6)' : 'var(--flow-dash-blue, #cfe0ff)'} strokeWidth="1.4" strokeDasharray="3 7" style={{ animation: `sr-flow ${gold ? 2.2 : 3}s linear infinite` }} />
    </g>
  );

  return (
    <svg width={WORLD.w} height={WORLD.h} style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none', overflow: 'visible', opacity: dim ? 0.22 : 1, transition: 'opacity var(--dur-base)' }}>
      <defs><filter id="cglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" /></filter></defs>
      {stars.map((s, i) => { const sun = suns[s.con]; if (!sun) return null; return line('i' + s.id, window.SRConnect(sun.cx, sun.cy, s.wx, s.wy, 0.1 + (i % 3) * 0.03), false); })}
      {crossPairs.map(([a, b]) => { const A = suns[a], B = suns[b]; if (!A || !B) return null; return line('c' + a + b, window.SRConnect(A.cx, A.cy, B.cx, B.cy, 0.16), true); })}
    </svg>
  );
}

/* faint glowing domain halo + clickable name behind each constellation cluster */
function DomainHalos({ stars, cons, k, onDomainDown }) {
  const nameOpacity = clamp(1.4 - k, 0.25, 1); // semantic zoom: names louder when far
  return (
    <React.Fragment>
      {cons.map(c => {
        const { cx, cy, r } = domainGeom(c, stars);
        const col = domainColor(c, stars);
        const count = stars.filter(s => s.con === c.id).length;
        return (
          <div key={c.id}>
            {/* atmosphere halo — the domain's own color */}
            <div style={{ position: 'absolute', left: cx, top: cy, width: r * 2, height: r * 2, transform: 'translate(-50%,-50%)', borderRadius: '50%',
              background: `radial-gradient(circle, ${col}2b 0%, ${col}16 44%, transparent 72%)`,
              border: `1.5px solid ${col}4a`,
              boxShadow: `0 0 60px ${col}28, inset 0 0 80px ${col}1f`,
              pointerEvents: 'none' }} />
            {/* the domain's SUN — its name as a single warm, hot-glowing star. Drag it to move the whole 星域. */}
            <div onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onDomainDown(e, c); } }}
              title={`星域「${c.name}」· 拖动可整体移动 · 点击新建知识星 · 右键更多`}
              style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, calc(-50% + 14px))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, cursor: 'grab', zIndex: 3 }}>
              <span className="sr-breathe" style={{
                width: 30, height: 30, borderRadius: '50%', flex: 'none',
                background: 'radial-gradient(circle at 38% 34%, #fff6e0 0%, #ffd58a 32%, #ff9d52 64%, #e8623a 100%)',
                boxShadow: '0 0 48px 9px rgba(255,128,60,0.5), 0 0 18px 3px rgba(255,196,120,0.85), inset 0 0 9px rgba(255,90,40,0.45)',
              }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: nameOpacity, transition: 'opacity var(--dur-base)', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 15.5, fontWeight: 400, letterSpacing: '0.06em', color: 'var(--sun-label, #ffe3b0)', textShadow: 'var(--sun-label-glow, 0 0 12px rgba(255,150,70,0.55), 0 1px 8px rgba(0,0,0,0.85))' }}>{c.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--sun-label-dim, rgba(255,200,140,0.62))' }}>{count}</span>
              </span>
            </div>
          </div>
        );
      })}
    </React.Fragment>
  );
}

function SummaryCard({ star, onOpen, onFeynman, onClose, screen }) {
  if (!star || !screen) return null;
  const D = window.SR_DATA;
  const flip = screen.x > window.innerWidth - 320;
  const left = flip ? screen.x - 280 : screen.x + 26;
  const top = clamp(screen.y - 40, 78, window.innerHeight - 300);
  return (
    <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', left, top, width: 260, zIndex: 28, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
      <GlassPanel strong radius="lg" pad="md" glow>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(star.con), boxShadow: `0 0 8px ${D.conColor(star.con)}` }} />
            {D.conName(star.con)}
          </span>
          <IconButton name="x" size="sm" title="关闭" onClick={onClose} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 300, color: 'var(--text-1)', marginBottom: 10, textShadow: 'var(--text-glow-cool)' }}>{star.label}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 14 }}>
          {star.summary || '还没有摘要——打开编辑器，写下第一段。'}
        </div>
        <MemoryBar value={star.strength} label="记忆强度" showPct fading={star.strength < 0.4} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Button variant="primary" size="sm" icon="zap" glow onClick={onFeynman} style={{ flex: 1 }}>费曼内化</Button>
          <Button size="sm" icon="maximize-2" onClick={onOpen} style={{ flex: 1 }}>打开编辑</Button>
        </div>
      </GlassPanel>
    </div>
  );
}

/* right-click create menu — domain always available; knowledge star only inside a domain */
function CreateMenu({ x, y, inDomain, onClose, onDomain, onStar, onRenameDomain, onDeleteDomain }) {
  React.useEffect(() => {
    const h = () => onClose();
    document.addEventListener('mousedown', h); document.addEventListener('keydown', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', h); };
  }, []);
  const Item = ({ icon, label, hint, tone, disabled, onClick }) => {
    const [h, setH] = React.useState(false);
    return (
      <div onMouseDown={(e) => { e.stopPropagation(); if (!disabled) onClick(); }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 'var(--r-sm)', cursor: disabled ? 'default' : 'pointer', background: (!disabled && h) ? 'rgba(159,198,255,0.08)' : 'transparent', opacity: disabled ? 0.5 : 1 }}>
        <Icon name={icon} size={16} color={tone || (h && !disabled ? 'var(--gold)' : 'var(--text-2)')} />
        <span style={{ flex: 1, fontSize: 13, color: tone || (h && !disabled ? 'var(--text-1)' : 'var(--text-2)') }}>{label}</span>
        {hint && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{hint}</span>}
      </div>
    );
  };
  const left = Math.min(x, window.innerWidth - 240), top = Math.min(y, window.innerHeight - 170);
  return (
    <div style={{ position: 'fixed', left, top, width: 228, zIndex: 60 }} onMouseDown={(e) => e.stopPropagation()}>
      <GlassPanel strong radius="md" pad="none" glow style={{ padding: 6 }}>
        <div style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 10px 4px', fontFamily: 'var(--font-mono)' }}>
          {inDomain ? `星域「${inDomain.name}」内` : '在此创建'}
        </div>
        <Item icon="orbit" label="新建星域" tone="var(--gold)" onClick={onDomain} />
        {inDomain
          ? <Item icon="plus" label={`新建知识星`} onClick={onStar} />
          : <Item icon="plus" label="新建知识星" hint="需在星域内" disabled />}
        {inDomain && <div style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />}
        {inDomain && <Item icon="pen-line" label={`重命名「${inDomain.name}」`} onClick={onRenameDomain} />}
        {inDomain && <Item icon="trash-2" label={`删除星域「${inDomain.name}」`} tone="var(--danger)" onClick={onDeleteDomain} />}
        {!inDomain && (
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.5, padding: '4px 10px 6px' }}>知识星要安放在星域之内。先建一片星域，或在已有星域的范围里创建。</div>
        )}
      </GlassPanel>
    </div>
  );
}

/* in-canvas confirm dialog (no browser confirm/alert) */
function ConfirmDialog({ message, confirmLabel, onYes, onClose }) {
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return (
    <div onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(3,4,12,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 348, maxWidth: '90vw', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" pad="md" glow>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
            <span style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', background: 'rgba(232,145,122,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="alert-triangle" size={18} color="var(--danger)" /></span>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-1)', paddingTop: 5 }}>{message}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button size="sm" onClick={onClose}>取消</Button>
            <button type="button" onClick={onYes} style={{ height: 32, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid rgba(232,145,122,0.5)', background: 'rgba(232,145,122,0.16)', color: 'var(--danger)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{confirmLabel || '删除'}</button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

/* right-click menu on a knowledge star */
function StarContextMenu({ x, y, star, onClose, onOpen, onFeynman, onRename, onDelete }) {
  React.useEffect(() => { const h = () => onClose(); document.addEventListener('mousedown', h); document.addEventListener('keydown', h); return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', h); }; }, []);
  const Item = ({ icon, label, tone, onClick }) => {
    const [h, setH] = React.useState(false);
    return (
      <div onMouseDown={(e) => { e.stopPropagation(); onClick(); }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: h ? 'rgba(159,198,255,0.08)' : 'transparent' }}>
        <Icon name={icon} size={16} color={tone || (h ? 'var(--gold)' : 'var(--text-2)')} />
        <span style={{ flex: 1, fontSize: 13, color: tone || (h ? 'var(--text-1)' : 'var(--text-2)') }}>{label}</span>
      </div>
    );
  };
  const left = Math.min(x, window.innerWidth - 212), top = Math.min(y, window.innerHeight - 205);
  return (
    <div style={{ position: 'fixed', left, top, width: 200, zIndex: 60 }} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <GlassPanel strong radius="md" pad="none" glow style={{ padding: 6 }}>
        <div style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 10px 4px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{star ? star.label : '知识星'}</div>
        <Item icon="maximize-2" label="打开编辑" onClick={onOpen} />
        <Item icon="pen-line" label="重命名" onClick={onRename} />
        <Item icon="zap" label="费曼内化" onClick={onFeynman} />
        <div style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />
        <Item icon="trash-2" label="删除知识星" tone="var(--danger)" onClick={onDelete} />
      </GlassPanel>
    </div>
  );
}

function StarMap({ selected, onSelect, onOpenEditor, onFeynman, onAerial, on3D, igniteId, focusReq }) {
  const D = window.SR_DATA;
  const ref = React.useRef(null);
  const [view, setView] = React.useState({ x: 0, y: 0, k: 0.82 });
  const [stars, setStars] = React.useState(() => D.stars.map(s => ({ ...s, wx: s.wx != null ? s.wx : s.x / 100 * WORLD.w, wy: s.wy != null ? s.wy : s.y / 100 * WORLD.h })));
  const [cons, setCons] = React.useState(() => D.constellations.map(c => ({ ...c, wx: c.wx != null ? c.wx : WORLD.w / 2, wy: c.wy != null ? c.wy : WORLD.h / 2 })));
  const [menu, setMenu] = React.useState(null);     // {x,y,wx,wy,inDomain}
  const [naming, setNaming] = React.useState(null);  // {x,y,wx,wy}
  const [draftName, setDraftName] = React.useState('');
  const [selScreen, setSelScreen] = React.useState(null);
  const [starMenu, setStarMenu] = React.useState(null); // {x,y,id}
  const [confirm, setConfirm] = React.useState(null);   // {message, confirmLabel, onYes}
  const [toast, setToast] = React.useState(null);       // 轻量操作反馈
  const toastT = React.useRef(null);
  const flash = (msg) => { setToast(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 1800); };

  const viewRef = React.useRef(view); viewRef.current = view;
  const drag = React.useRef(null);
  const inited = React.useRef(false);

  const toScreen = (wx, wy) => { const r = ref.current.getBoundingClientRect(); const v = viewRef.current; return { x: r.left + v.x + wx * v.k, y: r.top + v.y + wy * v.k }; };
  const toWorld = (cx, cy) => { const r = ref.current.getBoundingClientRect(); const v = viewRef.current; return { wx: (cx - r.left - v.x) / v.k, wy: (cy - r.top - v.y) / v.k }; };

  // which domain (if any) contains a world point
  const domainAt = (wx, wy) => cons.find(c => { const g = domainGeom(c, stars); return Math.hypot(wx - g.cx, wy - g.cy) <= g.r; }) || null;

  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => {
      if (inited.current) return; const w = el.clientWidth, h = el.clientHeight; if (!w) return;
      inited.current = true;
      setView({ k: 0.82, x: (w - WORLD.w * 0.82) / 2, y: (h - WORLD.h * 0.82) / 2 });
    };
    const ro = new ResizeObserver(fit); ro.observe(el); fit();
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (!focusReq) return;
    const el = ref.current; if (!el) return;
    const members = stars.filter(s => s.con === focusReq.con);
    if (!members.length) return;
    const cx = members.reduce((a, s) => a + s.wx, 0) / members.length;
    const cy = members.reduce((a, s) => a + s.wy, 0) / members.length;
    const k = 1.05;
    setView({ k, x: el.clientWidth / 2 - cx * k, y: el.clientHeight / 2 - cy * k });
  }, [focusReq]);

  React.useEffect(() => {
    if (!selected) { setSelScreen(null); return; }
    const s = stars.find(x => x.id === selected); if (s) setSelScreen(toScreen(s.wx, s.wy));
  }, [selected, view, stars]);

  // 点亮事件（费曼抽屉派发）：就地提升该星的亮度，无需重新挂载
  React.useEffect(() => {
    const h = (e) => { const { id, strength } = e.detail || {}; if (id) setStars(ss => ss.map(s => s.id === id ? { ...s, strength } : s)); };
    window.addEventListener('sr-ignite', h);
    return () => window.removeEventListener('sr-ignite', h);
  }, []);

  // persist live positions to the shared dataset so the bird's-eye view shows the real layout
  React.useEffect(() => { stars.forEach(s => { const d = D.byId[s.id]; if (d) { d.wx = s.wx; d.wy = s.wy; } }); }, [stars]);
  React.useEffect(() => { cons.forEach(c => { const d = D.constellations.find(x => x.id === c.id); if (d) { d.wx = c.wx; d.wy = c.wy; } }); }, [cons]);

  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top;
      setView(v => { const k = clamp(v.k * (e.deltaY < 0 ? 1.12 : 0.89), 0.34, 2.6); return { k, x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k) }; });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  React.useEffect(() => {
    const move = (e) => {
      const d = drag.current; if (!d) return;
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      if (d.mode === 'pan') setView(v => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
      else if (d.mode === 'star') {
        const k = viewRef.current.k;
        // 行星可自由拖到任何位置（包括与主星重合）——行星层级高于主星，随时能再拖出来
        setStars(ss => ss.map(s => s.id === d.id ? { ...s, wx: d.swx + (e.clientX - d.sx) / k, wy: d.swy + (e.clientY - d.sy) / k } : s));
      }
      else if (d.mode === 'domain') {
        const k = viewRef.current.k;
        const dx = (e.clientX - d.sx) / k, dy = (e.clientY - d.sy) / k;
        if (d.members.length) {
          const mp = Object.fromEntries(d.members.map(m => [m.id, m]));
          setStars(ss => ss.map(s => mp[s.id] ? { ...s, wx: mp[s.id].swx + dx, wy: mp[s.id].swy + dy } : s));
        } else {
          setCons(cs => cs.map(c => c.id === d.conId ? { ...c, wx: d.cwx + dx, wy: d.cwy + dy } : c));
        }
      }
    };
    const up = (e) => {
      const d = drag.current; drag.current = null;
      if (d && d.mode === 'domain' && !d.moved && e.button === 0) { if (pickRef.current) pickRef.current(d.con, e.clientX, e.clientY); }
      else if (d && d.mode === 'pan' && !d.moved && e.button === 0) onSelect(null);
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [onSelect]);

  // press anywhere that isn't the sun or a star → pan the canvas
  const bgDown = (e) => {
    if (e.button !== 0) return;
    setMenu(null); setNaming(null); setStarMenu(null);
    drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
    document.body.style.cursor = 'grabbing';
  };
  // press the domain's sun → drag moves the whole 星域; a click (no drag) opens its create menu
  const domainDown = (e, con) => {
    if (e.button !== 0) return;
    setMenu(null); setNaming(null); setStarMenu(null);
    const members = stars.filter(s => s.con === con.id).map(s => ({ id: s.id, swx: s.wx, swy: s.wy }));
    drag.current = { mode: 'domain', con, conId: con.id, members, cwx: con.wx, cwy: con.wy, sx: e.clientX, sy: e.clientY, moved: false };
    document.body.style.cursor = 'grabbing';
  };
  const starDown = (e, s) => {
    if (e.button !== 0) return; e.stopPropagation();
    onSelect(s.id);
    drag.current = { mode: 'star', id: s.id, sx: e.clientX, sy: e.clientY, swx: s.wx, swy: s.wy, moved: false };
  };
  const onContext = (e) => {
    e.preventDefault(); const w = toWorld(e.clientX, e.clientY);
    setMenu({ x: e.clientX, y: e.clientY, wx: w.wx, wy: w.wy, inDomain: domainAt(w.wx, w.wy) }); setNaming(null);
  };
  // clicking a domain name opens the same create menu, scoped to that domain
  const onPickDomain = (con, clientX, clientY) => {
    const w = toWorld(clientX, clientY);
    setMenu({ x: clientX, y: clientY, wx: w.wx, wy: w.wy, inDomain: con }); setNaming(null); onSelect(null);
  };
  const pickRef = React.useRef(); pickRef.current = onPickDomain;

  const startDomain = () => { setNaming({ kind: 'domain', x: menu.x, y: menu.y, wx: menu.wx, wy: menu.wy }); setDraftName(''); setMenu(null); };
  // 新建知识星也先命名（弹窗），确认后才真正落到星图上
  const startStar = () => {
    const dom = menu && menu.inDomain;
    if (!dom) { setMenu(null); return; } // guard: knowledge stars only inside a domain
    setNaming({ kind: 'star', x: menu.x, y: menu.y, wx: menu.wx, wy: menu.wy, dom });
    setDraftName(''); setMenu(null);
  };
  const startRename = (id, x, y, label) => { setNaming({ kind: 'rename', x, y, id }); setDraftName(label || ''); };
  const doCreateStar = (label, wx, wy, dom) => {
    const id = 's' + Math.random().toString(36).slice(2, 6);
    const ns = {
      id, con: dom.id, x: wx / WORLD.w * 100, y: wy / WORLD.h * 100, strength: 0.5, importance: 1, label,
      summary: '一颗新点亮的星，等待你为它写下内容。', tags: ['草稿'],
      props: { type: '草稿', status: '正常', source: '手动创建', alias: '', nextReview: '明天' },
      body: [{ id: id + '-r', type: 'rich' }, { id: id + '-p', type: 'p', text: '' }],
    };
    D.addStar(ns);
    setStars(ss => [...ss, { ...ns, wx, wy }]);
    onSelect(id);
    flash(`已创建「${ns.label}」`);
  };
  const renameStar = (id, label) => {
    D.renameStar(id, label);
    setStars(ss => ss.map(s => (s.id === id ? { ...s, label } : s)));
    flash('已重命名');
  };
  const commitNaming = () => {
    if (!naming) return;
    const name = draftName.trim();
    if (naming.kind === 'star') {
      doCreateStar(name || '新的知识星', naming.wx, naming.wy, naming.dom);
    } else if (naming.kind === 'rename') {
      if (name) renameStar(naming.id, name);
    } else if (naming.kind === 'renameDomain') {
      if (name) {
        const rec = D.constellations.find(c => c.id === naming.id); if (rec) rec.name = name;
        setCons(cs => cs.map(c => (c.id === naming.id ? { ...c, name } : c)));
        flash('已重命名星域');
      }
    } else {
      const dn = name || '新星域';
      const color = NEW_COLORS[D.constellations.length % NEW_COLORS.length];
      const cid = 'c' + Math.random().toString(36).slice(2, 6);
      D.constellations.push({ id: cid, name: dn, color, health: 0.5, count: 0 });
      setCons(cs => [...cs, { id: cid, name: dn, color, wx: naming.wx, wy: naming.wy }]);
    }
    setNaming(null);
  };
  // 删除 = 移入黑洞（可在黑洞视图恢复或彻底销毁）
  const deleteStar = (id) => {
    D.trashStar(id);
    setStars(ss => ss.filter(s => s.id !== id));
    if (selected === id) onSelect(null);
    flash('已移入黑洞 · 可随时恢复');
  };
  const deleteDomain = (conId) => {
    const memberIds = stars.filter(s => s.con === conId).map(s => s.id);
    D.trashDomain(conId);
    setStars(ss => ss.filter(s => s.con !== conId));
    setCons(cs => cs.filter(c => c.id !== conId));
    if (selected && memberIds.includes(selected)) onSelect(null);
    flash('星域已移入黑洞 · 可随时恢复');
  };

  const resetView = () => { const el = ref.current; const w = el.clientWidth, h = el.clientHeight; setView({ k: 0.82, x: (w - WORLD.w * 0.82) / 2, y: (h - WORLD.h * 0.82) / 2 }); onSelect(null); };
  const sel = stars.find(s => s.id === selected);

  return (
    <div ref={ref} onMouseDown={bgDown} onContextMenu={onContext}
      style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', cursor: 'grab', userSelect: 'none' }}>
      <sr-starfield density="1"></sr-starfield>

      {/* world layer */}
      <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, willChange: 'transform' }}>
        <DomainHalos stars={stars} cons={cons} k={view.k} onDomainDown={domainDown} />
        <Connections stars={stars} cons={cons} dim={!!sel} />
        {stars.map(s => (
          <div key={s.id} onMouseDown={(e) => starDown(e, s)} onDoubleClick={() => onOpenEditor(s.id)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu(null); setStarMenu({ x: e.clientX, y: e.clientY, id: s.id }); }}
            style={{ position: 'absolute', left: s.wx, top: s.wy, zIndex: 4 /* 行星的点击层级高于星域主星 */ }}>
            {/* StarNode centers the dot+label column on the anchor; the label pushes the dot up by
                ~11.5px. Shift down so the dot core sits exactly on (wx,wy) where the lines attach. */}
            <StarNode strength={s.id === igniteId ? 0.96 : s.strength} importance={s.importance} label={s.label}
              selected={selected === s.id} style={{ left: 0, top: 0, transform: 'translate(-50%, calc(-50% + 11.5px))', cursor: 'grab', opacity: sel && selected !== s.id ? 0.45 : 1, transition: 'opacity var(--dur-base)' }} />
          </div>
        ))}
      </div>

      {/* Top HUD */}
      <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 18, left: 22, right: 22, zIndex: 30, display: 'flex', alignItems: 'stretch', gap: 14, pointerEvents: 'none' }}>
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', pointerEvents: 'auto' }}>
          <Icon name="orbit" size={17} color="var(--gold)" />
          <span style={{ fontSize: 14, color: 'var(--text-1)' }}>我的星空</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>创作态 · 中景</span>
        </GlassPanel>
        <div style={{ flex: 1 }} />
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '8px 22px', pointerEvents: 'auto' }}>
          <HudStat label="知识星" value={stars.length} />
          <HudStat label="正发光" value={stars.filter(s => s.strength >= 0.7).length} tone="var(--gold)" />
          <HudStat label="正变暗" value={stars.filter(s => s.strength < 0.4).length} tone="var(--star-blue-dim)" />
          <HudStat label="星域" value={cons.length} tone="var(--star-blue)" />
        </GlassPanel>
      </div>

      {/* hint */}
      <div style={{ position: 'absolute', bottom: 26, left: 24, zIndex: 30, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-3)', pointerEvents: 'none' }}>
        <Icon name="move" size={14} color="currentColor" />拖主星=整体移动星域 · 拖空白=平移画布 · 拖星点=移动单颗 · 滚轮缩放 · 右键创建
      </div>

      {/* zoom controls */}
      <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 26, right: 24, zIndex: 30 }}>
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px' }}>
          <IconButton name="minus" size="sm" title="缩小" onClick={() => setView(v => ({ ...v, k: clamp(v.k * 0.85, 0.34, 2.6) }))} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', minWidth: 42, textAlign: 'center' }}>{Math.round(view.k * 100)}%</span>
          <IconButton name="plus" size="sm" title="放大" onClick={() => setView(v => ({ ...v, k: clamp(v.k * 1.18, 0.34, 2.6) }))} />
          <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
          <IconButton name="box" size="sm" title="三维星系（2D / 3D）" onClick={on3D} />
          <IconButton name="satellite" size="sm" title="亮度鸟瞰" onClick={onAerial} />
          <IconButton name="locate-fixed" size="sm" title="复位视图" onClick={resetView} />
        </GlassPanel>
      </div>

      <SummaryCard star={sel} screen={selScreen} onOpen={() => onOpenEditor(sel.id)} onFeynman={() => onFeynman(sel.id)} onClose={() => onSelect(null)} />

      {menu && <CreateMenu x={menu.x} y={menu.y} inDomain={menu.inDomain} onClose={() => setMenu(null)} onDomain={startDomain} onStar={startStar}
        onRenameDomain={() => { const dom = menu.inDomain; const { x, y } = menu; setMenu(null); setNaming({ kind: 'renameDomain', x, y, id: dom.id }); setDraftName(dom.name); }}
        onDeleteDomain={() => { const dom = menu.inDomain; const n = stars.filter(s => s.con === dom.id).length; setMenu(null); setConfirm({ message: n ? `星域「${dom.name}」和它的 ${n} 颗知识星将一并坠入黑洞。黑洞里的东西可以随时恢复。` : `空星域「${dom.name}」将坠入黑洞。黑洞里的东西可以随时恢复。`, confirmLabel: '移入黑洞', onYes: () => deleteDomain(dom.id) }); }} />}

      {starMenu && (() => { const st = stars.find(s => s.id === starMenu.id); return (
        <StarContextMenu x={starMenu.x} y={starMenu.y} star={st} onClose={() => setStarMenu(null)}
          onOpen={() => { const id = starMenu.id; setStarMenu(null); onOpenEditor(id); }}
          onFeynman={() => { const id = starMenu.id; setStarMenu(null); onFeynman(id); }}
          onRename={() => { const { id, x, y } = starMenu; setStarMenu(null); startRename(id, x, y, st ? st.label : ''); }}
          onDelete={() => { const id = starMenu.id, lbl = st ? st.label : '这颗星'; setStarMenu(null); setConfirm({ message: `知识星「${lbl}」将坠入黑洞。黑洞里的星可以随时恢复。`, confirmLabel: '移入黑洞', onYes: () => deleteStar(id) }); }} />
      ); })()}

      {confirm && <ConfirmDialog message={confirm.message} confirmLabel={confirm.confirmLabel} onYes={() => { confirm.onYes(); setConfirm(null); }} onClose={() => setConfirm(null)} />}

      {toast && (
        <div style={{ position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 70, pointerEvents: 'none', animation: 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
          <GlassPanel strong radius="pill" pad="none" glow style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check" size={14} color="var(--gold)" />
            <span style={{ fontSize: 12.5, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{toast}</span>
          </GlassPanel>
        </div>
      )}

      {naming && (() => {
        const meta = {
          domain: { title: '新星域名称', ph: '例如：概率论', ok: '创建' },
          star: { title: '新知识星名称', ph: '例如：贝叶斯定理', ok: '创建' },
          rename: { title: '重命名知识星', ph: '输入新名字…', ok: '保存' },
          renameDomain: { title: '重命名星域', ph: '输入新名字…', ok: '保存' },
        }[naming.kind || 'domain'];
        return (
        <div style={{ position: 'fixed', left: Math.min(naming.x, window.innerWidth - 240), top: Math.min(naming.y, window.innerHeight - 130), zIndex: 60, width: 220 }} onMouseDown={(e) => e.stopPropagation()}>
          <GlassPanel strong radius="md" pad="sm" glow>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 7 }}>{meta.title}</div>
            <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === 'Enter') commitNaming(); if (e.key === 'Escape') setNaming(null); }}
              placeholder={meta.ph}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: 14, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button variant="primary" size="sm" glow onClick={commitNaming} style={{ flex: 1 }}>{meta.ok}</Button>
              <Button size="sm" onClick={() => setNaming(null)}>取消</Button>
            </div>
          </GlassPanel>
        </div>
        );
      })()}
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { StarMap });
