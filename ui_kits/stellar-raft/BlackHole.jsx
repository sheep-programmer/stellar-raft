/* BlackHole — 黑洞（回收站）。所有被删除的星域与知识星都坠入这里：
   左侧是一座正俯视的 CSS 黑洞——纯黑事件视界 + 光子环 + 面向观察者旋转的
   吸积盘漩涡（双层湍流条纹 + 静态多普勒增亮），被吞噬的条目化作碎屑沿
   各自的圆轨道绕洞公转。公转不再用 CSS 动画，而是一台 rAF 引擎：每个碎屑
   持有稳定的 { 半径, 角速度, 相位 }（全部由 t.id 哈希派生，与数组下标无关），
   每帧推进角度后直接写 transform——销毁任何一颗只移除它自己的节点，
   其余碎屑的运动在引擎里连续不断、绝不跳位。碎屑层底下叠一张 canvas 画
   运动拖尾：常速绕行是淡淡的星蓝短尾，坠向奇点转为暗红长尾，逃逸恢复
   转为金色长尾（金 = 奖励/恢复语义）；颜色全部取自 tokens 的运行时值，
   黎明主题自动换色。prefers-reduced-motion / data-motion=off 时引擎不启动：
   碎屑按各自相位静止排布、不画拖尾。碎屑本体是可聚焦的真按钮（Enter/点击
   弹恢复/销毁卡，聚焦即显名），恢复/销毁反馈走 role=status。 */
const { GlassPanel, Icon, IconButton, Button, Badge } = window.StellarRaftDesignSystem_2866af;

/* ---- 碎屑轨道引擎（独立于 React 渲染） ---- */

const BH_TRAIL_PAD = 190;                       // 拖尾画布向舞台四周溢出，逃逸的长尾不被 520 框裁断
const BH_TRAIL_SIZE = 520 + BH_TRAIL_PAD * 2;

// FNV-1a：碎屑的轨道参数只由 id 决定——销毁别的碎屑不会改变自己的相位/周期
const bhHash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

function bhMakeEngine(pausedRef) {
  const bodies = new Map();  // id → { el, baseR, radius, omega, angle, mode, modeStart, trail }
  let canvas = null, ctx = null, raf = 0, last = 0, running = false;
  let colors = null, colorTick = 0;

  const reduced = () => (window.srTransition && window.srTransition.reduced)
    ? window.srTransition.reduced()
    : !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // 拖尾颜色全部读 tokens 的运行时值（绕行=--star-blue · 坠落=--danger · 逃逸=--gold），
  // 定期重读，黎明/深空切换后自动跟上
  const parseRgb = (v) => {
    let m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) { const n = parseInt(m[1], 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
    m = /^#([0-9a-f]{3})$/i.exec(v);
    if (m) { const n = parseInt(m[1], 16); const e = (x) => x | (x << 4); return { r: e((n >> 8) & 15), g: e((n >> 4) & 15), b: e(n & 15) }; }
    m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(v);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return null;
  };
  const parseTokenColor = (cs, name, fallback) =>
    parseRgb((cs.getPropertyValue(name) || '').trim()) || parseRgb(fallback);
  const resolveColors = () => {
    const cs = getComputedStyle(document.documentElement);
    colors = {
      orbit: parseTokenColor(cs, '--star-blue', '#9fc6ff'),
      fall: parseTokenColor(cs, '--danger', '#e8917a'),
      escape: parseTokenColor(cs, '--gold', '#ffd98a'),
    };
  };

  const place = (b) => {
    if (!b.el) return;
    const x = Math.cos(b.angle) * b.radius, y = Math.sin(b.angle) * b.radius;
    b.el.style.transform = `translate(${x}px, ${y}px)`;
  };

  const attach = (id, el) => {
    let b = bodies.get(id);
    if (!b) {
      const h = bhHash(id);
      const baseR = 170 + (h % 4) * 26;                       // 全部在吸积盘外缘绕行（对齐轨道细线）
      const period = 16 + ((h >>> 2) % 5) * 5;                // 16–36s 一圈
      b = {
        id, el, baseR, radius: baseR,
        omega: (2 * Math.PI) / period,
        angle: (((h >>> 5) % 3600) / 3600) * 2 * Math.PI,     // 相位同样由 id 派生
        mode: 'orbit', modeStart: 0, trail: [],
      };
      bodies.set(id, b);
    } else {
      b.el = el;      // React 重渲染只是换 ref 回调——角度/半径原样保留，运动连续
    }
    place(b);         // 挂载当帧就放到位，不在圆心闪现
  };
  const detach = (id) => {
    const b = bodies.get(id); if (!b) return;
    b.el = null;                          // 运行中交给下一帧 GC（重渲染的 detach→attach 会原样接回）
    if (!running) bodies.delete(id);      // reduced-motion 下没有帧循环，就地回收（参数由 id 派生，可无损重建）
  };

  const syncModes = (fallIds, escIds) => {
    const now = performance.now();
    for (const b of bodies.values()) {
      const m = fallIds.indexOf(b.id) >= 0 ? 'fall' : (escIds.indexOf(b.id) >= 0 ? 'escape' : 'orbit');
      if (b.mode !== m) { b.mode = m; b.modeStart = now; }
    }
  };

  const draw = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, BH_TRAIL_SIZE, BH_TRAIL_SIZE);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const C = BH_TRAIL_SIZE / 2;
    for (const b of bodies.values()) {
      const pts = b.trail;
      if (pts.length < 2 || !colors) continue;
      const col = b.mode === 'fall' ? colors.fall : (b.mode === 'escape' ? colors.escape : colors.orbit);
      const baseA = b.mode === 'orbit' ? 0.3 : (b.mode === 'fall' ? 0.55 : 0.7);
      const w = b.mode === 'orbit' ? 1.4 : 2.2;
      for (let i = 1; i < pts.length; i++) {
        const a = baseA * Math.pow(i / (pts.length - 1), 1.6);   // 尾端渐隐、头部最亮
        if (a <= 0.012) continue;
        ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${a})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(C + pts[i - 1].x, C + pts[i - 1].y);
        ctx.lineTo(C + pts[i].x, C + pts[i].y);
        ctx.stroke();
      }
    }
  };

  const frame = (t) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(Math.max((t - last) / 1000, 0), 0.05);  // 后台回来不跳大步
    last = t;
    if (!colors || (colorTick++ % 120) === 0) resolveColors();
    const paused = pausedRef.current;
    for (const [id, b] of bodies) {
      if (!b.el) { bodies.delete(id); continue; }               // 已卸载 → 连拖尾一起湮灭
      if (b.mode === 'fall') {
        // 坠落：公转持续加速，半径收缩坠向奇点——轨迹自然成螺旋
        const p = Math.min((t - b.modeStart) / 1450, 1);
        b.angle += b.omega * dt * (1 + 2.4 * p);
        b.radius = b.baseR + (6 - b.baseR) * p * p;
      } else if (b.mode === 'escape') {
        // 逃逸：冻结公转，沿当前半径背离中心加速飞出
        const p = Math.min((t - b.modeStart) / 980, 1);
        b.radius = b.baseR + (620 - b.baseR) * p * p * p;
      } else {
        if (!paused.has(id)) b.angle += b.omega * dt;           // 悬停/选中即暂停，松开原地续行
        b.radius = b.baseR;
      }
      place(b);
      // 常速绕行留短尾；坠落/逃逸拉长采样窗（暂停时旧点照常滑出，尾巴自然收拢）
      const cap = b.mode === 'orbit' ? 10 : 34;
      b.trail.push({ x: Math.cos(b.angle) * b.radius, y: Math.sin(b.angle) * b.radius });
      while (b.trail.length > cap) b.trail.shift();
    }
    draw();
  };

  const api = {
    attach, detach, syncModes,
    setCanvas(el) {
      if (!el) { canvas = null; ctx = null; return; }
      if (el === canvas && ctx) return;
      canvas = el;
      const dpr = window.devicePixelRatio || 1;
      el.width = BH_TRAIL_SIZE * dpr;
      el.height = BH_TRAIL_SIZE * dpr;
      ctx = el.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      el.__srBhEngine = api;    // 自测钩子：无头浏览器从 canvas 节点拿引擎内部状态
    },
    start() {
      if (running || reduced()) return;   // reduced-motion：不起 rAF——碎屑静止在各自相位上，不画拖尾
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      bodies.clear();
    },
    isRunning: () => running,
    bodies,
  };
  return api;
}

function BlackHole({ onOpenCon }) {
  const D = window.SR_DATA;
  const [entries, setEntries] = React.useState(() => D.trash.slice());
  const [confirm, setConfirm] = React.useState(null);
  const [toast, setToast] = React.useState(null);   // { msg, con }
  const [hoverId, setHoverId] = React.useState(null);
  const [picked, setPicked] = React.useState(null); // { id, x, y } — 点中的碎屑与弹出位置
  const [falling, setFalling] = React.useState([]); // 正在坠向奇点的碎屑 id
  const [escaping, setEscaping] = React.useState([]); // 正在飞离黑洞的碎屑 id（恢复动画）
  const [zoom, setZoom] = React.useState(1);        // 舞台缩放（滚轮 / 控件）
  const stageBoxRef = React.useRef(null);
  React.useEffect(() => {
    const el = stageBoxRef.current; if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom(z => Math.max(0.55, Math.min(1.9, z * (e.deltaY < 0 ? 1.12 : 0.89))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---- 轨道引擎：React 只负责挂载/卸载节点（key=t.id），运动全在引擎里 ----
  const pausedRef = React.useRef(new Set());
  pausedRef.current = new Set([hoverId, picked && picked.id].filter(Boolean));
  const engineRef = React.useRef(null);
  const getEngine = () => {
    if (!engineRef.current) engineRef.current = bhMakeEngine(pausedRef);
    return engineRef.current;
  };
  const trailRef = React.useCallback((el) => { getEngine().setCanvas(el); }, []);
  React.useEffect(() => {
    const eng = getEngine();
    eng.start();
    return () => eng.stop();
  }, []);
  React.useEffect(() => {
    if (engineRef.current) engineRef.current.syncModes(falling, escaping);
  }, [falling, escaping]);

  const toastTimer = React.useRef(null);
  const fallTimers = React.useRef([]);
  const flash = (msg, con) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, con });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  React.useEffect(() => () => { clearTimeout(toastTimer.current); fallTimers.current.forEach(clearTimeout); }, []);
  const ConfirmDialog = window.SRKit && window.SRKit.ConfirmDialog;

  const sync = () => setEntries(D.trash.slice());

  // 彻底销毁的动画：碎屑先沿螺旋轨迹坠向奇点（半径收缩 + 缩小淡出），
  // 落进中心后才真正从数据里湮灭
  const startFall = (ids, doneMsg) => {
    setFalling(f => [...f, ...ids.filter(id => !f.includes(id))]);
    fallTimers.current.push(setTimeout(() => {
      ids.forEach(id => D.purgeTrash(id));
      window.dispatchEvent(new Event('sr-data')); // 侧栏角标即时刷新
      setFalling(f => f.filter(x => !ids.includes(x)));
      sync();
      flash(doneMsg);
    }, 1550));
  };
  const nameOf = (t) => t.kind === 'star' ? t.payload.star.label : t.payload.con.name;
  const colorOf = (t) => t.kind === 'star'
    ? (D.conColor(t.payload.star.con) || '#7896cd')
    : t.payload.con.color;

  const restore = (t) => {
    if (escaping.includes(t.id) || falling.includes(t.id)) return;
    setPicked(null);
    // 逃逸动画：暂停公转，沿当前半径背离中心加速飞出，然后才真正恢复
    setEscaping(e => [...e, t.id]);
    fallTimers.current.push(setTimeout(() => {
      const r = D.restoreTrash(t.id);
      window.dispatchEvent(new Event('sr-data')); // 侧栏角标即时刷新
      setEscaping(e => e.filter(x => x !== t.id));
      sync();
      if (!r) { flash('恢复失败 — 找不到可以安放它的星域'); return; }
      const con = t.kind === 'star' ? r.payload.star.con : r.payload.con.id;
      flash(`「${nameOf(t)}」逃逸了黑洞`, con);
    }, 980));
  };
  const purge = (t) => setConfirm({
    message: t.kind === 'star'
      ? `彻底销毁「${nameOf(t)}」吗？它将永远湮灭在黑洞里，无法再恢复。`
      : `彻底销毁星域「${nameOf(t)}」和它的 ${t.payload.stars.length} 颗星吗？它们将永远湮灭，无法再恢复。`,
    confirmLabel: '彻底销毁',
    onYes: () => { setPicked(null); startFall([t.id], `「${nameOf(t)}」已湮灭于奇点`); },
  });
  const purgeAll = () => setConfirm({
    message: `清空黑洞吗？${entries.length} 个条目将全部永远湮灭，无法再恢复。`,
    confirmLabel: '清空黑洞',
    onYes: () => { setPicked(null); startFall(entries.map(t => t.id), '黑洞已清空'); },
  });

  return (
    <div onContextMenu={(e) => e.preventDefault()} className="sr-bh-stage" style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex' }}>
      <style>{`
        /* 手机：404px 的右侧列表在 360px 屏上会把黑洞视觉挤成 0 宽。
           改成上下叠——黑洞留一块能看清的方形，列表在下面继续滚。 */
        html[data-screen="phone"] .sr-bh-stage { flex-direction: column !important; overflow: auto !important; }
        html[data-screen="phone"] .sr-bh-visual { flex: none !important; height: 42vh; min-height: 220px; }
        html[data-screen="phone"] .sr-bh-list {
          width: 100% !important; flex: none !important;
          border-left: none !important; border-top: 1px solid var(--glass-border);
        }
      `}</style>
      <sr-starfield density="0.5" warm="0.05"></sr-starfield>
      <BlackHoleStyle />

      {/* 左：正俯视的黑洞 + 可点击的碎屑轨道（滚轮缩放） */}
      <div ref={stageBoxRef} onClick={() => setPicked(null)}
        className="sr-bh-visual"
        style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, overflow: 'hidden' }}>
        <div data-tour="blackhole-stage" className="bh-stage" style={{ transform: `scale(${zoom})`, transition: 'transform 200ms var(--ease-flight)' }}>
          {/* 吸积盘：双层湍流条纹旋转 + 一层静态多普勒增亮 */}
          <div className="bh-disk" />
          <div className="bh-disk2" />
          <div className="bh-beam" />
          {/* 轨道细线 */}
          {[170, 196, 222, 248].map(r => (
            <span key={r} className="bh-ring-guide" style={{ width: r * 2, height: r * 2 }} />
          ))}
          <div className="bh-photon" />
          <div className="bh-core" />
          {/* 拖尾画布：引擎每帧把各碎屑的近若干帧位置画成渐隐光迹 */}
          <canvas className="bh-trails" aria-hidden="true" ref={trailRef}
            style={{ width: BH_TRAIL_SIZE, height: BH_TRAIL_SIZE }} />
          {/* 被吞噬的条目化作碎屑绕洞公转（rAF 引擎驱动，transform 由引擎每帧写入）：
              悬停/聚焦暂停并显名，点击/Enter 弹出操作卡 */}
          {entries.slice(0, 12).map((t) => {
            const isFalling = falling.includes(t.id);
            const isEscaping = escaping.includes(t.id);
            const busy = isFalling || isEscaping;
            const lit = !busy && (hoverId === t.id || (picked && picked.id === t.id));
            const size = t.kind === 'domain' ? 17 : 12;
            return (
              <div key={t.id} className="bh-body"
                ref={(el) => { if (el) getEngine().attach(t.id, el); else getEngine().detach(t.id); }}>
                <button type="button" className="sr-focus-ring bh-chip-btn"
                  aria-label={`${nameOf(t)} — 恢复或彻底销毁`}
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    const box = e.currentTarget.getBoundingClientRect();
                    setPicked({ id: t.id, x: e.clientX || box.left + box.width / 2, y: e.clientY || box.top + box.height / 2 });
                  }}
                  onMouseEnter={() => setHoverId(t.id)} onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(t.id)} onBlur={() => setHoverId(null)}
                  style={{
                    // 坠落 = 引擎收缩半径成螺旋，这里只负责缩小淡出；逃逸 = 引擎拉出半径，这里放大淡出
                    opacity: busy ? 0 : 1,
                    transform: isFalling ? 'scale(0.15)' : (isEscaping ? 'scale(1.25)' : 'none'),
                    cursor: busy ? 'default' : 'pointer',
                    transition: isFalling
                      ? 'opacity 0.5s ease 0.95s, transform 1.45s cubic-bezier(0.55, 0, 0.85, 0.4)'
                      : isEscaping
                        ? 'opacity 0.4s ease 0.6s, transform 0.98s ease-in'
                        : 'opacity var(--dur-base)',
                  }}>
                  <span aria-hidden="true" style={{
                    width: size, height: size, borderRadius: '50%', display: 'block',
                    background: `radial-gradient(circle at 35% 32%, #fff 0%, ${colorOf(t)} 55%, ${colorOf(t)} 100%)`,
                    opacity: lit ? 1 : 0.95,
                    border: lit ? '1.5px solid var(--gold)' : '1.5px solid transparent',
                    boxShadow: `0 0 ${lit ? 18 : 12}px 2px ${colorOf(t)}`,
                    transition: 'opacity var(--dur-base), box-shadow var(--dur-base)',
                  }} />
                </button>
                <span className="bh-chip-name" style={{ opacity: lit ? 1 : 0 }}>{nameOf(t)}</span>
              </div>
            );
          })}
        </div>

        {/* 底部提示 */}
        <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
          <Icon name="mouse-pointer-click" size={13} color="currentColor" />点击绕行的碎屑可直接恢复或销毁 · 滚轮缩放 · 彻底销毁前都可随时恢复
        </div>

        {toast && (
          /* 定位层与动画层分离：sr-cardin 结束帧的 transform:none 会覆盖居中的 translateX。
             role=status：恢复/销毁的反馈读屏也听得到；动作是真按钮，键盘可达 */
          <div role="status" style={{ position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 95 }}>
            <div style={{ animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
              <GlassPanel strong radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px', whiteSpace: 'nowrap' }}>
                <Icon name="check" size={16} color="var(--gold)" /><span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{toast.msg}</span>
                {toast.con && onOpenCon && (
                  <button type="button" className="sr-focus-ring" onClick={() => onOpenCon(toast.con)}
                    style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--star-blue)', cursor: 'pointer', borderBottom: '1px dashed rgba(159,198,255,0.5)' }}>在星图中查看</button>
                )}
              </GlassPanel>
            </div>
          </div>
        )}

        {/* 缩放控件 */}
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 22, right: 20 }}>
          <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px' }}>
            <IconButton name="minus" size="sm" title="缩小" onClick={() => setZoom(z => Math.max(0.55, z * 0.85))} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <IconButton name="plus" size="sm" title="放大" onClick={() => setZoom(z => Math.min(1.9, z * 1.18))} />
            <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
            <IconButton name="locate-fixed" size="sm" title="复位" onClick={() => setZoom(1)} />
          </GlassPanel>
        </div>


      </div>

      {/* 右：被吞噬列表 */}
      <aside className="sr-bh-list" style={{ width: 404, flex: 'none', borderLeft: '1px solid var(--glass-border)', background: 'var(--glass-bg)', WebkitBackdropFilter: 'blur(var(--glass-blur))', backdropFilter: 'blur(var(--glass-blur))', overflow: 'auto', position: 'relative', zIndex: 2 }}>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="aperture" size={18} color="var(--gold)" />
            <span style={{ fontSize: 17, fontWeight: 300, color: 'var(--text-1)' }}>黑洞</span>
            <Badge tone="blue">{entries.length}</Badge>
            <div style={{ flex: 1 }} />
            {entries.length > 0 && <Button size="sm" variant="ghost" icon="flame" onClick={purgeAll}>清空</Button>}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-3)' }}>
            被删除的星域与知识星先坠落到这里。<span style={{ color: 'var(--text-2)' }}>恢复</span>会带着位置与连接一起回到星图；<span style={{ color: 'var(--danger)' }}>彻底销毁</span>不可逆。
          </div>

          {entries.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '46px 0', color: 'var(--text-3)', textAlign: 'center' }}>
              <span style={{ width: 52, height: 52, borderRadius: '50%', background: '#03040c', border: '1px solid rgba(255,200,130,0.25)', boxShadow: '0 0 24px rgba(255,170,90,0.12)' }} />
              <div style={{ fontSize: 14, color: 'var(--text-2)' }}>黑洞正在沉睡</div>
              <div style={{ fontSize: 12 }}>没有任何东西被吞噬。</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entries.map(t => {
                const star = t.kind === 'star' ? t.payload.star : null;
                const conName = star ? (D.conName(star.con) || '已消失的星域') : null;
                return (
                  <GlassPanel key={t.id} radius="md" pad="none"
                    style={{ padding: '13px 15px', opacity: (falling.includes(t.id) || escaping.includes(t.id)) ? 0.3 : 0.92, pointerEvents: (falling.includes(t.id) || escaping.includes(t.id)) ? 'none' : 'auto', transition: 'opacity var(--dur-slow)' }}
                    onMouseEnter={() => setHoverId(t.id)} onMouseLeave={() => setHoverId(null)}>
                    <div style={{ display: 'flex', gap: 11 }}>
                      <span style={{ width: 30, height: 30, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(159,198,255,0.06)', border: '1px solid var(--glass-border)' }}>
                        <Icon name={t.kind === 'domain' ? 'orbit' : 'star'} size={15} color={colorOf(t)} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 14.5, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(t)}</span>
                          {t.kind === 'domain' && <span style={{ fontSize: 10.5, color: 'var(--gold)', flex: 'none' }}>整个星域</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 11.5, color: 'var(--text-3)' }}>
                          {star
                            ? <span>来自 {conName} · 记忆 {Math.round(star.strength * 100)}%</span>
                            : <span>{t.payload.stars.length} 颗知识星 · {t.payload.connections.length} 条连接</span>}
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{t.ts ? D.ago(t.ts) : t.deletedAt}坠入</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <Button size="sm" icon="undo-2" glow onClick={() => restore(t)} style={{ flex: 1 }}>恢复</Button>
                          <button type="button" className="sr-focus-ring" onClick={() => purge(t)}
                            style={{ flex: 1, height: 30, borderRadius: 'var(--r-pill)', border: '1px solid rgba(232,145,122,0.4)', background: 'rgba(232,145,122,0.10)', color: 'var(--danger)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Icon name="flame" size={13} color="currentColor" />彻底销毁
                          </button>
                        </div>
                      </div>
                    </div>
                  </GlassPanel>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* 碎屑操作卡（根层级渲染，避免被舞台的层叠上下文压到侧栏之下） */}
      {picked && (() => {
        const t = entries.find(x => x.id === picked.id);
        if (!t) return null;
        const star = t.kind === 'star' ? t.payload.star : null;
        const left = Math.max(12, Math.min(picked.x - 116, window.innerWidth - 250));
        const top = Math.max(12, Math.min(picked.y + 18, window.innerHeight - 190));
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left, top, width: 232, zIndex: 40, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
            <GlassPanel strong radius="md" pad="md" glow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon name={t.kind === 'domain' ? 'orbit' : 'star'} size={14} color={colorOf(t)} />
                <span style={{ flex: 1, fontSize: 14.5, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(t)}</span>
                <IconButton name="x" size="sm" title="关闭" onClick={() => setPicked(null)} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 12 }}>
                {star ? `来自 ${D.conName(star.con) || '已消失的星域'} · 记忆 ${Math.round(star.strength * 100)}%` : `整个星域 · ${t.payload.stars.length} 颗知识星`} · {t.ts ? D.ago(t.ts) : t.deletedAt}坠入
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" icon="undo-2" glow onClick={() => restore(t)} style={{ flex: 1 }}>恢复</Button>
                <button type="button" className="sr-focus-ring" onClick={() => purge(t)}
                  style={{ flex: 1, height: 30, borderRadius: 'var(--r-pill)', border: '1px solid rgba(232,145,122,0.4)', background: 'rgba(232,145,122,0.10)', color: 'var(--danger)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="flame" size={13} color="currentColor" />销毁
                </button>
              </div>
            </GlassPanel>
          </div>
        );
      })()}

      {confirm && ConfirmDialog && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onYes={() => { confirm.onYes(); setConfirm(null); }}
          onClose={() => setConfirm(null)} />
      )}
    </div>
  );
}

function BlackHoleStyle() {
  return (
    <style>{`
    .bh-stage { position: relative; width: 520px; height: 520px; flex: none; }
    .bh-stage > * { position: absolute; left: 50%; top: 50%; }
    /* 吸积盘（正俯视）：内缘炽热、外缘渐冷的暖色环，细密条纹旋转成漩涡 */
    .bh-disk {
      width: 520px; height: 520px; border-radius: 50%;
      transform: translate(-50%,-50%);
      background:
        repeating-conic-gradient(from 0deg,
          rgba(255,210,140,0) 0deg 2.1deg, rgba(255,214,148,0.22) 2.7deg 3.2deg,
          rgba(255,210,140,0) 3.8deg 5.9deg, rgba(255,196,120,0.12) 6.3deg 6.7deg,
          rgba(255,210,140,0) 7.2deg 9.4deg),
        repeating-radial-gradient(circle,
          rgba(255,196,124,0.10) 0px 2px, rgba(90,62,42,0.03) 4px 7px),
        radial-gradient(circle,
          transparent 100px, rgba(255,238,205,0.50) 116px, rgba(255,205,135,0.30) 142px,
          rgba(220,150,88,0.12) 168px, transparent 198px);
      -webkit-mask: radial-gradient(circle, transparent 102px, black 118px, black 152px, transparent 205px);
      mask: radial-gradient(circle, transparent 102px, black 118px, black 152px, transparent 205px);
      filter: blur(1.6px);
      animation: bh-rot-center 46s linear infinite;
    }
    /* 内层湍流：贴着光子环的更亮、更快的细条纹 */
    .bh-disk2 {
      width: 340px; height: 340px; border-radius: 50%;
      transform: translate(-50%,-50%);
      background:
        repeating-conic-gradient(from 0deg,
          rgba(255,236,198,0) 0deg 1.6deg, rgba(255,238,202,0.28) 2.1deg 2.5deg,
          rgba(255,236,198,0) 3.0deg 4.6deg),
        radial-gradient(circle, transparent 98px, rgba(255,242,212,0.5) 112px, rgba(255,205,135,0.2) 144px, transparent 165px);
      -webkit-mask: radial-gradient(circle, transparent 100px, black 112px, black 132px, transparent 162px);
      mask: radial-gradient(circle, transparent 100px, black 112px, black 132px, transparent 162px);
      filter: blur(1px);
      animation: bh-rot-center 24s linear infinite;
    }
    /* 多普勒增亮：吸积盘朝向我们旋转的一侧更亮（静态，不随盘转） */
    .bh-beam {
      width: 480px; height: 480px; border-radius: 50%;
      transform: translate(-50%,-50%);
      background: radial-gradient(circle at 26% 50%, rgba(255,244,214,0.26) 0%, rgba(255,220,160,0.10) 24%, transparent 50%);
      -webkit-mask: radial-gradient(circle, transparent 104px, black 124px, black 148px, transparent 198px);
      mask: radial-gradient(circle, transparent 104px, black 124px, black 148px, transparent 198px);
      filter: blur(3px);
      pointer-events: none;
    }
    /* 轨道细线 */
    .bh-ring-guide {
      display: block; border-radius: 50%;
      transform: translate(-50%,-50%);
      border: 1px solid rgba(255,205,140,0.10);
      pointer-events: none;
    }
    /* 光子环：视界外缘那圈最亮的细环 */
    .bh-photon {
      width: 212px; height: 212px; border-radius: 50%;
      transform: translate(-50%,-50%);
      border: 2px solid rgba(255,232,186,1);
      box-shadow: 0 0 30px rgba(255,196,120,0.7), 0 0 8px rgba(255,232,186,0.8), inset 0 0 20px rgba(255,196,120,0.45);
      pointer-events: none;
    }
    /* 事件视界：纯黑的球 */
    .bh-core {
      width: 202px; height: 202px; border-radius: 50%;
      transform: translate(-50%,-50%);
      background: radial-gradient(circle at 50% 46%, #000 0%, #000 80%, #0a0805 100%);
      box-shadow: 0 0 80px 26px rgba(255,150,64,0.12);
    }
    /* 拖尾画布：盖在黑洞本体之上、碎屑之下；向四周溢出舞台，长尾不被裁断 */
    .bh-trails {
      left: ${-BH_TRAIL_PAD}px; top: ${-BH_TRAIL_PAD}px;
      z-index: 4; pointer-events: none;
    }
    /* 碎屑：位置由 rAF 轨道引擎每帧写 transform（translate 不旋转，名字天然直立） */
    .bh-body { width: 0; height: 0; z-index: 5; pointer-events: none; }
    .bh-chip-btn {
      position: absolute; left: -20px; top: -20px; width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; padding: 0; margin: 0;
      border-radius: 50%; pointer-events: auto; font: inherit;
    }
    .bh-chip-btn:disabled { pointer-events: none; }
    .bh-chip-name {
      position: absolute; left: 14px; top: 0; transform: translateY(-50%);
      font-size: 11px; color: var(--text-1); white-space: nowrap;
      text-shadow: var(--star-label-shadow); pointer-events: none;
      transition: opacity var(--dur-base);
    }
    @keyframes bh-rot-center { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .bh-disk, .bh-disk2 { animation: none; }
    }
    `}</style>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { BlackHole });
