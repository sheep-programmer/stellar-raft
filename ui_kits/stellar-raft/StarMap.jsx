/* StarMap — infinite pannable/zoomable creation canvas. Domains group stars:
   · 星域 (constellation) groups its knowledge stars. Right-click empty space → create a 星域.
   · 知识星 (note) lives INSIDE a 星域. You can only create one within a domain's
     halo — right-click inside a domain (or click its name) → 新建知识星. Outside any
     domain you can only create a 星域.
   · A domain's halo glows in its own color; once its stars are well-remembered
     (lit) the halo turns gold.
   Stars, connections and domain halos live in a transformed world layer;
   HUD / tool capsule / cards stay screen-fixed. */
const { StarNode, GlassPanel, IconButton, Icon, Button, MemoryBar, toast } = window.StellarRaftDesignSystem_2866af;

/* 数据写操作后广播：侧栏角标（黑洞/复习）监听 sr-data 即时刷新，不等每分钟心跳 */
const emitData = () => window.dispatchEvent(new Event('sr-data'));

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
// 认证维度（与亮度四档正交）：本地 star 拷贝与数据层共享同一 sr 引用，可直接判定
const litOf = (s) => { const D = window.SR_DATA; return !!(D && D.isLit && D.isLit(s)); };
const emberOf = (s) => { const D = window.SR_DATA; return !!(D && D.isEmber && D.isEmber(s)); };
// 星域点亮统计 + 光环转金判据：litRatio ≥ 0.5 ∧ health ≥ 0.5
//（过半点亮 · 星域转暖；health 下限防止全员熄灭却仍挂金）
function domainStats(con, stars) {
  const members = stars.filter(s => s.con === con.id);
  const n = members.length;
  const health = n ? members.reduce((a, s) => a + s.strength, 0) / n : 0;
  const lit = members.filter(litOf).length;
  return { n, health, lit, gold: n > 0 && lit / n >= 0.5 && health >= 0.5 };
}
// Halo color: a domain's own color, or gold once half its stars are certified-lit.
function domainColor(con, stars) {
  return domainStats(con, stars).gold ? LIT_GOLD : con.color;
}

function HudStat({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 64 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: tone || 'var(--text-1)' }}>{value}</span>
    </div>
  );
}

/* connections, in world px — star-shaped around each domain's sun:
   · every knowledge star links to its domain's sun (intra, blue)
   · suns link to suns across domains that share a 融会贯通 link (cross, gold) */
function Connections({ stars, cons, dim, k, vis }) {
  const D = window.SR_DATA;
  const byId = React.useMemo(() => Object.fromEntries(stars.map(s => [s.id, s])), [stars]);
  const suns = React.useMemo(() => { const m = {}; cons.forEach(c => { m[c.id] = domainGeom(c, stars); }); return m; }, [cons, stars]);
  // domain↔domain pairs, derived from the cross links in the data.
  // 融会贯通金弧的新口径：仅当某条 cross 连接的两端知识星都「已点亮」，
  // 这对星域之间才亮金弧＋流光；否则退为无流光的冷色细弧（一端熄灭，金弧当场冷却）。
  const crossPairs = React.useMemo(() => {
    const seen = new Map(), pairs = [];
    D.connections.forEach(c => {
      if (c.kind !== 'cross') return;
      const A = byId[c.a], B = byId[c.b]; if (!A || !B || A.con === B.con) return;
      const key = [A.con, B.con].sort().join('|');
      const gold = litOf(A) && litOf(B);
      if (seen.has(key)) { const p = seen.get(key); p.gold = p.gold || gold; return; }
      const p = { a: A.con, b: B.con, gold };
      seen.set(key, p); pairs.push(p);
    });
    return pairs;
  }, [stars]);

  /* LOD（几百颗星的边界）：星多时逐条模糊滤镜辉光 + 逐条流光动画是帧率杀手
     （312 星 ≈ 900 条 path + 300 个 feGaussianBlur），也把深空糊成灰白乱麻。
     dense 时改为单层描边（略调不透明度补辉光），流光只留给少数金色融会贯通弧；
     远景（k 低）时星-主星连线整层隐去，只留星点 + 星域晕——亮度才是这一层的信息。 */
  const dense = stars.length > 120;
  const far = k < 0.55;
  const drawIntra = !(dense && far);

  // non-scaling-stroke keeps the lines a constant on-screen thickness at any zoom
  const line = (key, d, gold, tip) => (
    <g key={key} style={tip ? { pointerEvents: 'stroke' } : undefined}>
      {tip && <title>{tip}</title>}
      {!dense && <path d={d} fill="none" vectorEffect="non-scaling-stroke" stroke={gold ? 'var(--gold)' : 'var(--star-blue)'} strokeWidth={gold ? 4 : 3} opacity={gold ? 0.5 : 0.3} filter="url(#cglow)" />}
      <path d={d} fill="none" vectorEffect="non-scaling-stroke" stroke={gold ? 'var(--gold)' : 'var(--star-blue)'} strokeWidth={gold ? 1.8 : 1.3} opacity={dense && !gold ? 0.4 : 0.82} />
      {(gold || !dense) && <path d={d} fill="none" vectorEffect="non-scaling-stroke" stroke={gold ? 'var(--flow-dash-gold, #fff4d6)' : 'var(--flow-dash-blue, #cfe0ff)'} strokeWidth="1.4" strokeDasharray="3 7" style={{ animation: `sr-flow ${gold ? 2.2 : 3}s linear infinite` }} />}
    </g>
  );
  // 未齐亮的跨星域连接：无流光的冷色细弧，静静等着两端点亮
  const coldArc = (key, d, tip) => (
    <g key={key} style={{ pointerEvents: 'stroke' }}>
      <title>{tip}</title>
      <path d={d} fill="none" vectorEffect="non-scaling-stroke" stroke="var(--star-blue)" strokeWidth="1.1" opacity="0.42" />
    </g>
  );

  return (
    <svg width={WORLD.w} height={WORLD.h} style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none', overflow: 'visible', opacity: dim ? 0.22 : 1, transition: 'opacity var(--dur-base)' }}>
      <defs><filter id="cglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" /></filter></defs>
      {drawIntra && stars.map((s, i) => {
        const sun = suns[s.con]; if (!sun) return null;
        // 视口外剔除：两端都在屏外的连线不画
        if (vis && !vis(s.wx, s.wy) && !vis(sun.cx, sun.cy)) return null;
        return line('i' + s.id, window.SRConnect(sun.cx, sun.cy, s.wx, s.wy, 0.1 + (i % 3) * 0.03), false);
      })}
      {crossPairs.map(p => {
        const A = suns[p.a], B = suns[p.b]; if (!A || !B) return null;
        const d = window.SRConnect(A.cx, A.cy, B.cx, B.cy, 0.16);
        return p.gold
          ? line('c' + p.a + p.b, d, true, '融会贯通 · 两端已点亮')
          : coldArc('c' + p.a + p.b, d, '两端都点亮后，这条连接才是融会贯通的金弧。');
      })}
    </svg>
  );
}

/* faint glowing domain halo + clickable name behind each constellation cluster */
function DomainHalos({ stars, cons, k, onDomainDown, onDomainKey }) {
  const nameOpacity = clamp(1.4 - k, 0.25, 1); // semantic zoom: names louder when far
  return (
    <React.Fragment>
      {cons.map(c => {
        const { cx, cy, r } = domainGeom(c, stars);
        const st = domainStats(c, stars);
        const col = st.gold ? LIT_GOLD : c.color;
        const count = st.n;
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
              role="button" tabIndex={0} className="sr-focus-ring"
              aria-label={`星域「${c.name}」· ${count} 颗星 · 已点亮 ${st.lit} 颗 · 回车打开菜单`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDomainKey(c); } }}
              title={`星域「${c.name}」· 拖动可整体移动 · 点击新建知识星 · 右键更多`}
              style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, calc(-50% + 14px))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, cursor: 'grab', zIndex: 3 }}>
              <span className="sr-breathe" style={{
                width: 30, height: 30, borderRadius: '50%', flex: 'none',
                background: 'radial-gradient(circle at 38% 34%, #fff6e0 0%, #ffd58a 32%, #ff9d52 64%, #e8623a 100%)',
                boxShadow: '0 0 48px 9px rgba(255,128,60,0.5), 0 0 18px 3px rgba(255,196,120,0.85), inset 0 0 9px rgba(255,90,40,0.45)',
              }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: nameOpacity, transition: 'opacity var(--dur-base)', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 15.5, fontWeight: 400, letterSpacing: '0.06em', color: 'var(--sun-label, #ffe3b0)', textShadow: 'var(--sun-label-glow, 0 0 12px rgba(255,150,70,0.55), 0 1px 8px rgba(0,0,0,0.85))' }}>{c.name}</span>
                <span title={`已点亮 ${st.lit} / 共 ${count} 颗`} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--sun-label-dim, rgba(255,200,140,0.62))' }}>{st.lit}/{count}</span>
              </span>
            </div>
          </div>
        );
      })}
    </React.Fragment>
  );
}

function SummaryCard({ star, onOpen, onFeynman, onClose, screen }) {
  const boxRef = React.useRef(null);
  const [pos, setPos] = React.useState(null);
  // 实测卡片尺寸后贴着星定位：优先星右侧，右边放不下翻到左侧；
  // 垂直与星对齐后按实际高度钳进视口（此前用固定估高 300，星在屏幕下缘时
  // 卡片会被顶到离星 250px 远，摘要一长还会溢出屏幕）
  React.useLayoutEffect(() => {
    if (!star || !screen) return;
    const el = boxRef.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, pad = 12, gap = 22;
    let left = screen.x + gap;
    if (left + w > window.innerWidth - pad) left = screen.x - w - gap;
    left = clamp(left, pad, window.innerWidth - w - pad);
    const top = clamp(screen.y - 40, 78, window.innerHeight - h - pad);
    setPos({ left, top });
  }, [star && star.id, screen && screen.x, screen && screen.y]);
  if (!star || !screen) return null;
  const D = window.SR_DATA;
  // 认证态（点亮/待重燃）随状态就地自解释；重燃 = 待重燃星的费曼快速通道
  const lit = litOf(star), ember = emberOf(star);
  return (
    <div ref={boxRef} onMouseDown={(e) => e.stopPropagation()}
      style={{ position: 'fixed', left: pos ? pos.left : screen.x, top: pos ? pos.top : screen.y,
        visibility: pos ? 'visible' : 'hidden', width: 260, zIndex: 28,
        animation: pos ? 'sr-cardin var(--dur-base) var(--ease-flight) both' : 'none' }}>
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 10, fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-3)' }}>
          <span aria-hidden="true" style={{ flex: 'none', width: 9, height: 9, marginTop: 4, borderRadius: '50%', boxSizing: 'border-box',
            border: lit ? '1px solid var(--gold)'
              : ember ? '1px solid color-mix(in srgb, var(--gold-warm) 55%, transparent)'
              : '1px solid var(--line-strong)' }} />
          <span>
            {lit ? '已点亮 · 讲清楚的东西，暗得更慢。'
              : ember ? '曾点亮的星暗了下来。再讲透一次，就能重燃。'
              : '讲清楚一次，这颗星才会真正点亮——点亮的星记得更久。'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Button variant="primary" size="sm" icon={ember ? 'flame' : 'zap'} glow onClick={onFeynman} style={{ flex: 1 }}>{ember ? '重燃' : '费曼内化'}</Button>
          <Button size="sm" icon="maximize-2" onClick={onOpen} style={{ flex: 1 }}>打开编辑</Button>
        </div>
      </GlassPanel>
    </div>
  );
}

/* PopMenu — 星图两个右键菜单的共用基座，与 DS ContextMenu 同一套键盘词汇：
   焦点移入菜单、↑↓/Home/End 移动、Enter/Space 选取、Esc 关闭、关闭后焦点还原；
   任意按键不再误关菜单（此前 keydown 一律 onClose）。items:
   { icon, label, tone?, hint?, disabled?, sep?, onClick } */
function PopMenu({ x, y, width = 228, header, footer, items, onClose }) {
  const ref = React.useRef(null);
  const prevFocus = React.useRef(null);
  const [active, setActive] = React.useState(-1);
  const enabled = items.map((it, i) => (!it.sep && !it.disabled ? i : -1)).filter(i => i >= 0);
  const close = React.useCallback(() => {
    onClose();
    const p = prevFocus.current;
    if (p && p.focus) p.focus();
  }, [onClose]);
  React.useEffect(() => {
    prevFocus.current = document.activeElement;
    if (ref.current) ref.current.focus();
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', down, true);
    document.addEventListener('contextmenu', down, true);
    return () => { document.removeEventListener('mousedown', down, true); document.removeEventListener('contextmenu', down, true); };
  }, [close]);
  const pick = (it) => { if (it.disabled) return; close(); it.onClick(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { e.preventDefault(); return; }
    if (!enabled.length) return;
    const cur = enabled.indexOf(active);
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(enabled[(cur + 1) % enabled.length]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(cur < 0 ? enabled[enabled.length - 1] : enabled[(cur - 1 + enabled.length) % enabled.length]); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(enabled[0]); }
    else if (e.key === 'End') { e.preventDefault(); setActive(enabled[enabled.length - 1]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const it = items[active]; if (it && !it.sep && !it.disabled) pick(it); }
  };
  // 实测菜单尺寸后贴着光标定位：默认在点击点右下，右/下放不下就翻到左/上
  // （此前用 items×34+64 估高做钳位，带 header/footer 时估不准会溢出视口）
  const [pos, setPos] = React.useState(null);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, pad = 12;
    let left = x + 4, top = y + 4;
    if (left + w > window.innerWidth - pad) left = Math.max(pad, x - w - 4);
    if (top + h > window.innerHeight - pad) top = Math.max(pad, y - h - 4);
    setPos({ left, top });
  }, [x, y, items.length]);
  return (
    <div ref={ref} role="menu" tabIndex={-1} className="sr-focus-ring" onKeyDown={onKey}
      onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'fixed', left: pos ? pos.left : x, top: pos ? pos.top : y,
        visibility: pos ? 'visible' : 'hidden', width, zIndex: 60, outline: 'none' }}>
      <GlassPanel strong radius="md" pad="none" glow style={{ padding: 6 }}>
        {header && (
          <div style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 10px 4px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{header}</div>
        )}
        {items.map((it, i) => it.sep
          ? <div key={'sep' + i} role="separator" style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />
          : (
            <div key={it.label} role="menuitem" aria-disabled={it.disabled || undefined}
              onMouseEnter={() => { if (!it.disabled) setActive(i); }}
              onMouseLeave={() => setActive(a => (a === i ? -1 : a))}
              onClick={() => pick(it)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 'var(--r-sm)', cursor: it.disabled ? 'default' : 'pointer',
                background: active === i && !it.disabled ? 'rgba(159,198,255,0.08)' : 'transparent', opacity: it.disabled ? 0.5 : 1 }}>
              <Icon name={it.icon} size={16} color={it.tone || (active === i && !it.disabled ? 'var(--gold)' : 'var(--text-2)')} />
              <span style={{ flex: 1, fontSize: 13, color: it.tone || (active === i && !it.disabled ? 'var(--text-1)' : 'var(--text-2)') }}>{it.label}</span>
              {it.hint && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: 'var(--text-3)' }}>{it.hint}</span>}
            </div>
          ))}
        {footer && (
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)', lineHeight: 1.5, padding: '4px 10px 6px' }}>{footer}</div>
        )}
      </GlassPanel>
    </div>
  );
}

/* in-canvas confirm dialog (no browser confirm/alert) */
function ConfirmDialog({ message, confirmLabel, onYes, onClose }) {
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return (
    <div onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(3,4,12,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 348, maxWidth: '90vw', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" pad="md" glow>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
            <span style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', background: 'rgba(232,145,122,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="alert-triangle" size={18} color="var(--danger)" /></span>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-1)', paddingTop: 5 }}>{message}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button size="sm" autoFocus onClick={onClose}>取消</Button>
            <button type="button" className="sr-focus-ring" onClick={onYes} style={{ height: 32, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid rgba(232,145,122,0.5)', background: 'rgba(232,145,122,0.16)', color: 'var(--danger)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{confirmLabel || '删除'}</button>
          </div>
        </GlassPanel>
      </div>
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
  const [gift, setGift] = React.useState(null);          // {x,y,id,label} 赠星好友选择器
  const [confirm, setConfirm] = React.useState(null);   // {message, confirmLabel, onYes}
  // 轻量操作反馈走 DS 的 toast()：自带 role=status/aria-live 栈，读屏也听得到
  const flash = (msg) => toast(msg);

  /* 星际好友（赠星选择器用）：静默取回——后端未运行 / 还没有好友时保持空数组，
     「赠给好友」菜单项随之隐藏，不打扰纯本地使用 */
  const [friends, setFriends] = React.useState([]);
  React.useEffect(() => {
    const N = window.SRNet; if (!N) return;
    let alive = true;
    const load = () => N.api('/api/friends').then(r => { if (alive) setFriends(r.friends || []); }).catch(() => { });
    load();
    window.addEventListener('sr-friends', load); // 星际漫游里连接/移除好友后就地刷新
    return () => { alive = false; window.removeEventListener('sr-friends', load); };
  }, []);
  // 赠星：POST /api/inbox/send kind:'star'——服务端剥 HTML、只取标题作要点，正文永不出库
  const giftStar = (f, starId) => {
    const N = window.SRNet; if (!N || !N.inbox) return;
    N.inbox.send(f.id, 'star', starId).then(r => {
      if (!r) toast('星际网络暂不可用，稍后再试', { tone: 'danger', icon: 'circle-alert' });
      else if (r.error) toast(r.error, { tone: 'danger', icon: 'circle-alert' });
      else if (r.duplicate) toast(`已在「${f.name}」的收件箱里等待领取`);
      else toast('已送达', { icon: 'send' });
    });
  };

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

  // 记忆心跳：数据层按真实时间重算 R 后，星就地读回新亮度——
  // 只更新数值，不加任何闪烁动画，prefers-reduced-motion 下同样安静。
  // 一律换新对象：点亮/熄灭（lit/ember）可能在强度几乎不变时跨越，也要触发重绘
  React.useEffect(() => {
    const h = () => setStars(ss => ss.map(s => {
      const d = D.byId[s.id];
      return d ? { ...s, strength: d.strength } : s;
    }));
    window.addEventListener('sr-memory', h);
    return () => window.removeEventListener('sr-memory', h);
  }, []);

  // 星域首次转金只提示一次（金色只属于状态跃迁）：litRatio ≥ 0.5 ∧ health ≥ 0.5
  const goldKey = cons.filter(c => domainStats(c, stars).gold).map(c => c.id).sort().join(',');
  const prevGoldRef = React.useRef(null);
  React.useEffect(() => {
    const cur = new Set(goldKey ? goldKey.split(',') : []);
    const prev = prevGoldRef.current;
    prevGoldRef.current = cur;
    if (!prev) return;   // 首帧不提示——只有「跨越」才配一次金 toast
    cons.forEach(c => { if (cur.has(c.id) && !prev.has(c.id)) toast(`「${c.name}」过半点亮 · 星域转暖`, { tone: 'gold', icon: 'orbit' }); });
  }, [goldKey]);

  // Esc 统一词汇：摘要卡也响应 Escape（菜单/命名/确认各自有 Esc，先让位给它们；
  // 费曼抽屉的 Esc 在 app 层捕获阶段处理，层级永远先于这里）
  React.useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (menu || naming || confirm || starMenu) return;
      if (selected) { e.preventDefault(); onSelect(null); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [menu, naming, confirm, starMenu, selected, onSelect]);

  // persist live positions to the shared dataset so the bird's-eye view shows the real layout;
  // 拖动星 / 星域后的坐标也要落盘（SRNet 自带 1.2s 防抖，拖拽途中不会刷库）
  React.useEffect(() => {
    let moved = false;
    stars.forEach(s => {
      const d = D.byId[s.id]; if (!d) return;
      if (d.wx !== s.wx || d.wy !== s.wy) moved = true;
      d.wx = s.wx; d.wy = s.wy;
      d.x = s.wx / WORLD.w * 100; d.y = s.wy / WORLD.h * 100;
    });
    if (moved && window.SRNet) window.SRNet.schedule();
  }, [stars]);
  React.useEffect(() => {
    let moved = false;
    cons.forEach(c => {
      const d = D.constellations.find(x => x.id === c.id); if (!d) return;
      if (d.wx !== c.wx || d.wy !== c.wy) moved = true;
      d.wx = c.wx; d.wy = c.wy;
    });
    if (moved && window.SRNet) window.SRNet.schedule();
  }, [cons]);

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
    emitData();
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
    emitData();
    setStars(ss => ss.filter(s => s.id !== id));
    if (selected === id) onSelect(null);
    flash('已移入黑洞 · 可随时恢复');
  };
  const deleteDomain = (conId) => {
    const memberIds = stars.filter(s => s.con === conId).map(s => s.id);
    D.trashDomain(conId);
    emitData();
    setStars(ss => ss.filter(s => s.con !== conId));
    setCons(cs => cs.filter(c => c.id !== conId));
    if (selected && memberIds.includes(selected)) onSelect(null);
    flash('星域已移入黑洞 · 可随时恢复');
  };

  const resetView = () => { const el = ref.current; const w = el.clientWidth, h = el.clientHeight; setView({ k: 0.82, x: (w - WORLD.w * 0.82) / 2, y: (h - WORLD.h * 0.82) / 2 }); onSelect(null); };
  const sel = stars.find(s => s.id === selected);

  // 键盘打开星域菜单：Enter 落在主星上时，菜单出现在主星的屏幕位置
  const onDomainKey = (con) => {
    const g = domainGeom(con, stars);
    const p = toScreen(g.cx, g.cy);
    onPickDomain(con, p.x, p.y + 24);
  };

  /* ── LOD：几百颗星也要保持深空的安静 ─────────────────────────
     · 视口外剔除：屏外（含 240px 余量）的星不渲染 DOM
     · dense（>120 星）时标签只在近景（k≥0.9）常显——远景标签互相压叠，
       亮度=记忆的可读性反而丢失；选中星的标签任何时候都在 */
  const boxEl = ref.current;
  const vw = boxEl ? boxEl.clientWidth : window.innerWidth;
  const vh = boxEl ? boxEl.clientHeight : window.innerHeight;
  const vis = (wx, wy) => {
    const sx = view.x + wx * view.k, sy = view.y + wy * view.k;
    return sx > -240 && sx < vw + 240 && sy > -240 && sy < vh + 240;
  };
  const dense = stars.length > 120;
  const showLabels = !dense || view.k >= 0.9;
  const empty = stars.length === 0 && cons.length === 0;

  return (
    <div ref={ref} onMouseDown={bgDown} onContextMenu={onContext}
      style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', cursor: 'grab', userSelect: 'none' }}>
      <sr-starfield density="1"></sr-starfield>

      {/* world layer */}
      <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, willChange: 'transform' }}>
        <DomainHalos stars={stars} cons={cons} k={view.k} onDomainDown={domainDown} onDomainKey={onDomainKey} />
        <Connections stars={stars} cons={cons} dim={!!sel} k={view.k} vis={vis} />
        {stars.map(s => {
          if (!vis(s.wx, s.wy) && selected !== s.id) return null; // 视口外剔除
          const litS = litOf(s), emberS = emberOf(s);
          return (
          <div key={s.id} onMouseDown={(e) => starDown(e, s)} onDoubleClick={() => onOpenEditor(s.id)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu(null); setStarMenu({ x: e.clientX, y: e.clientY, id: s.id }); }}
            style={{ position: 'absolute', left: s.wx, top: s.wy, zIndex: 4 /* 行星的点击层级高于星域主星 */ }}>
            {/* 认证环（叠加在亮度分层之上的正交维度）：已点亮 = 发丝金环（不加常驻辉光）；
                待重燃 = 低透明度暗金余烬环——曾获认证的残迹，属点亮语义本身 */}
            {(litS || emberS) && (
              <span data-cert={litS ? 'lit' : 'ember'} aria-hidden="true" style={{
                position: 'absolute', left: 0, top: 0,
                width: 12 * (s.importance || 1) + 10, height: 12 * (s.importance || 1) + 10,
                transform: 'translate(-50%,-50%)', borderRadius: '50%', boxSizing: 'border-box',
                pointerEvents: 'none', zIndex: 0,
                border: litS ? '1px solid var(--gold)' : '1px solid color-mix(in srgb, var(--gold-warm) 45%, transparent)',
                opacity: sel && selected !== s.id ? 0.35 : (litS ? 0.9 : 0.8),
                transition: 'opacity var(--dur-base)',
              }} />
            )}
            {/* StarNode centers the dot+label column on the anchor; the label pushes the dot up by
                ~11.5px. Shift down so the dot core sits exactly on (wx,wy) where the lines attach.
                onClick 让 StarNode 进入 Tab 序列（role=button + Enter/Space 激活）——
                键盘也能走完「选中星 → 摘要卡 → 费曼点亮」的闭环。 */}
            <StarNode strength={s.id === igniteId ? 0.96 : s.strength} importance={s.importance}
              label={showLabels || selected === s.id ? s.label : undefined}
              onClick={() => onSelect(s.id)}
              selected={selected === s.id} style={{ left: 0, top: 0, transform: 'translate(-50%, calc(-50% + 11.5px))', cursor: 'grab', opacity: sel && selected !== s.id ? 0.45 : 1, transition: 'opacity var(--dur-base)' }} />
          </div>
          );
        })}
      </div>

      {/* 教学空态：新用户 / 清空后落地的正是这里，别只留一行灰字 */}
      {empty && !naming && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--s-2)', pointerEvents: 'none', textAlign: 'center' }}>
          <span className="sr-breathe" style={{ width: 10, height: 10, borderRadius: '50%', background: 'radial-gradient(circle at 38% 35%, #eaf2ff, var(--star-blue-dim) 70%)', boxShadow: '0 0 18px rgba(159,198,255,0.5)', marginBottom: 'var(--s-3)' }} />
          <div style={{ fontSize: 'var(--t-h3)', fontWeight: 300, color: 'var(--text-1)', textShadow: 'var(--text-glow-cool)' }}>你的星空还很暗。</div>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 300 }}>先划出一片星域，再写下第一颗星，让它发光。</div>
          <div style={{ marginTop: 'var(--s-4)', pointerEvents: 'auto' }}>
            <Button variant="primary" icon="orbit" glow onClick={() => {
              const r = ref.current.getBoundingClientRect();
              const w = toWorld(r.left + r.width / 2, r.top + r.height / 2);
              setDraftName('');
              setNaming({ kind: 'domain', x: r.left + r.width / 2 - 110, y: r.top + r.height / 2 - 40, wx: w.wx, wy: w.wy });
            }}>创建第一个星域</Button>
          </div>
          <div style={{ marginTop: 'var(--s-2)', fontSize: 'var(--t-xs)', color: 'var(--text-3)' }}>也可以在画布任意处右键创建</div>
        </div>
      )}

      {/* Top HUD */}
      <div data-tour="hud" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 18, left: 22, right: 22, zIndex: 30, display: 'flex', alignItems: 'stretch', gap: 14, pointerEvents: 'none' }}>
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', pointerEvents: 'auto' }}>
          <Icon name="orbit" size={17} color="var(--gold)" />
          <span style={{ fontSize: 14, color: 'var(--text-1)' }}>我的星空</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>创作态 · 中景</span>
        </GlassPanel>
        <div style={{ flex: 1 }} />
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '8px 22px', pointerEvents: 'auto' }}>
          <HudStat label="知识星" value={stars.length} />
          <HudStat label="已点亮" value={stars.filter(litOf).length} tone="var(--gold)" />
          <HudStat label="正发光" value={stars.filter(s => s.strength >= 0.7).length} />
          <HudStat label="正变暗" value={stars.filter(s => s.strength < 0.4).length} tone="var(--star-blue-dim)" />
          <HudStat label="星域" value={cons.length} tone="var(--star-blue)" />
        </GlassPanel>
      </div>

      {/* hint */}
      <div data-tour="hint" style={{ position: 'absolute', bottom: 26, left: 24, zIndex: 30, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-3)', pointerEvents: 'none' }}>
        <Icon name="move" size={14} color="currentColor" />拖主星=整体移动星域 · 拖空白=平移画布 · 拖星点=移动单颗 · 滚轮缩放 · 右键创建
      </div>

      {/* zoom controls */}
      <div data-tour="tools" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 26, right: 24, zIndex: 30 }}>
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

      {menu && <PopMenu x={menu.x} y={menu.y}
        header={menu.inDomain ? `星域「${menu.inDomain.name}」内` : '在此创建'}
        footer={menu.inDomain ? null : '知识星要安放在星域之内。先建一片星域，或在已有星域的范围里创建。'}
        onClose={() => setMenu(null)}
        items={[
          { icon: 'orbit', label: '新建星域', tone: 'var(--gold)', onClick: startDomain },
          menu.inDomain
            ? { icon: 'plus', label: '新建知识星', onClick: startStar }
            : { icon: 'plus', label: '新建知识星', hint: '需在星域内', disabled: true, onClick: () => {} },
          ...(menu.inDomain ? [
            { sep: true },
            { icon: 'pen-line', label: `重命名「${menu.inDomain.name}」`, onClick: () => { const dom = menu.inDomain; setNaming({ kind: 'renameDomain', x: menu.x, y: menu.y, id: dom.id }); setDraftName(dom.name); } },
            { icon: 'trash-2', label: `删除星域「${menu.inDomain.name}」`, tone: 'var(--danger)', onClick: () => { const dom = menu.inDomain; const n = stars.filter(s => s.con === dom.id).length; setConfirm({ message: n ? `星域「${dom.name}」和它的 ${n} 颗知识星将一并坠入黑洞。黑洞里的东西可以随时恢复。` : `空星域「${dom.name}」将坠入黑洞。黑洞里的东西可以随时恢复。`, confirmLabel: '移入黑洞', onYes: () => deleteDomain(dom.id) }); } },
          ] : []),
        ]} />}

      {starMenu && (() => { const st = stars.find(s => s.id === starMenu.id); return (
        <PopMenu x={starMenu.x} y={starMenu.y} width={200} header={st ? st.label : '知识星'} onClose={() => setStarMenu(null)}
          items={[
            { icon: 'maximize-2', label: '打开编辑', onClick: () => onOpenEditor(starMenu.id) },
            { icon: 'pen-line', label: '重命名', onClick: () => startRename(starMenu.id, starMenu.x, starMenu.y, st ? st.label : '') },
            { icon: 'zap', label: '费曼内化', onClick: () => onFeynman(starMenu.id) },
            // 赠给好友：无好友 / 后端未运行（friends 为空）时整项隐藏
            ...(friends.length ? [{ icon: 'gift', label: '赠给好友', onClick: () => setGift({ x: starMenu.x, y: starMenu.y, id: starMenu.id, label: st ? st.label : '这颗星' }) }] : []),
            { sep: true },
            { icon: 'trash-2', label: '删除知识星', tone: 'var(--danger)', onClick: () => { const lbl = st ? st.label : '这颗星'; setConfirm({ message: `知识星「${lbl}」将坠入黑洞。黑洞里的星可以随时恢复。`, confirmLabel: '移入黑洞', onYes: () => deleteStar(starMenu.id) }); } },
          ]} />
      ); })()}

      {/* 赠星好友选择器：与右键菜单同一套 PopMenu 基座（↑↓/Enter/Esc + 焦点还原） */}
      {gift && <PopMenu x={gift.x} y={gift.y} width={224}
        header={`赠「${gift.label}」给`}
        footer="星名与大纲要点会寄进对方的收件箱，正文不会。"
        onClose={() => setGift(null)}
        items={friends.map(f => ({ icon: 'user-round', label: f.name, onClick: () => giftStar(f, gift.id) }))} />}

      {confirm && <ConfirmDialog message={confirm.message} confirmLabel={confirm.confirmLabel} onYes={() => { confirm.onYes(); setConfirm(null); }} onClose={() => setConfirm(null)} />}

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
            <input autoFocus className="sr-focus-ring" value={draftName} onChange={(e) => setDraftName(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === 'Enter') commitNaming(); if (e.key === 'Escape') { e.preventDefault(); setNaming(null); } }}
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
