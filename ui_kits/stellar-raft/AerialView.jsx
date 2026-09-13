/* AerialView — 极远景俯瞰。与星图创作态是同一份编排：读取每颗星被拖拽后的
   真实 wx/wy、按等比缩放整体收进一屏（不做任何轴向拉伸），星域光晕、恒星主星
   与知识星沿用星图的视觉语言——它就是"从更高处看你自己的星空"。这个高度只看
   亮度分布，不画连接线。知识星按记忆温度着色（冷蓝=正在变暗，暖金=融会贯通），
   星域按平均记忆强度给出冷/暖星云。点击星域即飞入星图并聚焦该星座。 */
const { GlassPanel, Icon, Button: SRButton } = window.StellarRaftDesignSystem_2866af;

const A_WORLD = { w: 1680, h: 1040 };

/* 记忆温度色阶（镜像设计系统 memoryColor；bundle 未导出该函数，此处内联同一份色标） */
function aMemoryColor(strength) {
  const dawn = document.documentElement.dataset.theme === 'dawn';
  const stops = dawn ? [
    [0.0, [108, 121, 155]], [0.25, [92, 108, 150]], [0.5, [76, 96, 148]],
    [0.7, [52, 95, 190]], [0.88, [184, 128, 26]], [1.0, [168, 109, 18]],
  ] : [
    [0.0, [44, 53, 86]], [0.25, [70, 82, 122]], [0.5, [120, 150, 205]],
    [0.7, [159, 198, 255]], [0.88, [255, 224, 150]], [1.0, [255, 244, 214]],
  ];
  const s = Math.max(0, Math.min(1, strength));
  for (let i = 1; i < stops.length; i++) {
    if (s <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      const t = (s - a) / (b - a || 1);
      const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return 'rgb(255,244,214)';
}
function hexRgb(hex) {
  const m = (hex || '').replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return '159,198,255';
  return m.slice(0, 3).map(x => parseInt(x, 16)).join(',');
}

function AerialView({ onClose, onOpenCon, dataset }) {
  // dataset：造访好友星系时注入的只读数据；缺省用自己的
  const D = dataset || window.SR_DATA;
  // 认证态（点亮/待重燃）：自己的星走数据层派生函数（读共享 sr），
  // 造访好友时 server sanitizeGalaxy 只透传 lit/ember 两个布尔（不泄露时间戳）
  const litOf = (s) => D.isLit ? !!D.isLit(s) : !!s.lit;
  const emberOf = (s) => D.isEmber ? !!D.isEmber(s) : !!s.ember;
  const ref = React.useRef(null);
  const [box, setBox] = React.useState(null);      // 容器实际尺寸，用于等比换算
  const [hoverCon, setHoverCon] = React.useState(null);

  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(read); ro.observe(el); read();
    return () => ro.disconnect();
  }, []);

  // Esc = 返回星图：与其它浮层/沉浸视图同一词汇（费曼抽屉在 app 层捕获，永远先关）
  React.useEffect(() => {
    if (!onClose) return;
    const h = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // 真实位置：优先星图写回的 wx/wy，否则用种子布局
  const posOf = (s) => {
    const d = D.byId[s.id] || s;
    return { x: d.wx != null ? d.wx : s.x / 100 * A_WORLD.w, y: d.wy != null ? d.wy : s.y / 100 * A_WORLD.h };
  };
  const sp = D.stars.map(s => ({ ...s, ...posOf(s) }));

  // 星域几何：与 StarMap.domainGeom 同一套规则（质心 + 包裹全部成员的半径）
  const doms = D.constellations.map(c => {
    const ms = sp.filter(s => s.con === c.id);
    if (!ms.length) return null;
    const cx = ms.reduce((a, s) => a + s.x, 0) / ms.length;
    let cy = ms.reduce((a, s) => a + s.y, 0) / ms.length;
    if (ms.length === 1) cy -= 96;   // 与星图一致：单星星域主星上移让位
    const r = Math.max(150, ...ms.map(s => Math.hypot(s.x - cx, s.y - cy))) + 96;
    const avg = ms.reduce((a, s) => a + s.strength, 0) / ms.length;
    // 星域光环转金的新口径：过半点亮 ∧ 平均亮度不塌（litRatio ≥ 0.5 ∧ health ≥ 0.5）
    const lit = ms.filter(litOf).length;
    const gold = lit / ms.length >= 0.5 && avg >= 0.5;
    return { ...c, cx, cy, r, avg, lit, members: ms.length, col: gold ? '#ffd98a' : c.color };
  }).filter(Boolean);

  // 等比取景：把（含光晕的）整片星空收进一屏，只缩放、不变形。
  // 包围盒走一趟循环而不是 Math.min(...arr)：spread 会把整个数组铺成实参，
  // 星一多就是 Maximum call stack size exceeded（与星图 fitView 修过的同款）
  let X = () => 0, Y = () => 0, k = 1;
  if (box && sp.length) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of sp) {
      if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y; if (s.y > maxY) maxY = s.y;
    }
    for (const d of doms) {
      if (d.cx - d.r < minX) minX = d.cx - d.r; if (d.cx + d.r > maxX) maxX = d.cx + d.r;
      if (d.cy - d.r < minY) minY = d.cy - d.r; if (d.cy + d.r > maxY) maxY = d.cy + d.r;
    }
    const W = Math.max(1, maxX - minX), H = Math.max(1, maxY - minY);
    const padX = 70, padTop = 92, padBottom = 96;
    k = Math.min((box.w - padX * 2) / W, (box.h - padTop - padBottom) / H);
    const ox = (box.w - W * k) / 2 - minX * k;
    const oy = padTop + (box.h - padTop - padBottom - H * k) / 2 - minY * k;
    X = (wx) => ox + wx * k;
    Y = (wy) => oy + wy * k;
  }

  const weakest = doms.slice().sort((a, b) => a.avg - b.avg)[0] || { name: '—' };
  const litCount = sp.filter(litOf).length;
  const emberCount = sp.filter(emberOf).length;
  const dimming = sp.filter(s => s.strength < 0.4).length;

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {/* 极远景不放流星——这个高度只看亮度分布，任何快速移动都是噪音 */}
      <sr-starfield density="1.7" meteors="0"></sr-starfield>
      <AerialStyle />

      {box && (
        <div className="aer-scene" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          {/* 星域星云 + 光晕（真实几何：位置=质心，尺寸=实际半径×k） */}
          {doms.map(g => {
            const rgb = hexRgb(g.col);
            // 光晕显示半径设上限：星少倍率高时（如造访好友的小星系）R 会被放大到
            // 上千像素，巨型合成图层在 Windows GPU 分块光栅化时会沿瓦片边界漏缝，
            // 表现为贯穿画面的细亮线
            const R = Math.min(g.r * k, 520);
            const hov = hoverCon === g.id;
            return (
              <div key={g.id} onClick={() => onOpenCon && onOpenCon(g.id)}
                role="button" tabIndex={0} className="sr-focus-ring"
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onOpenCon) { e.preventDefault(); onOpenCon(g.id); } }}
                onMouseEnter={() => setHoverCon(g.id)} onMouseLeave={() => setHoverCon(null)}
                title={`飞入「${g.name}」`} aria-label={`飞入星域「${g.name}」`}
                style={{ position: 'absolute', left: X(g.cx), top: Y(g.cy), width: R * 2, height: R * 2, transform: 'translate(-50%,-50%)', borderRadius: '50%', cursor: 'pointer' }}>
                {/* 大气光晕：与星图同一语言，只是更远、更弥散。
                    只用平滑衰减的径向渐变——不加描边/环形阴影（大半径下圆缘读成直线），
                    也不加 filter:blur（Chrome 对大元素的 GPU 分块模糊会留下垂直接缝）。 */}
                {/* 两层都不加 border-radius（大图层的圆形蒙版是 GPU 瓦片接缝的温床），
                    改用 closest-side 让渐变在盒边之内就衰减到零，不会漏出方形边 */}
                <div style={{ position: 'absolute', inset: 0,
                  background: `radial-gradient(circle closest-side, rgba(${rgb},${hov ? 0.32 : 0.22}) 0%, rgba(${rgb},${hov ? 0.15 : 0.10}) 48%, rgba(${rgb},0.04) 72%, transparent 96%)`,
                  transition: 'background var(--dur-base)' }} />
                {/* 云心的暖雾——记忆越好越暖 */}
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: R * 1.2, height: R * 1.0, transform: 'translate(-50%,-50%)',
                  background: `radial-gradient(circle closest-side at 46% 42%, rgba(${rgb},0.26), rgba(${rgb},0.10) 52%, transparent 92%)` }} />
              </div>
            );
          })}

          {/* 知识星：真实位置 + 记忆温度着色 + 呼吸闪烁 */}
          {sp.map((s, i) => {
            const col = aMemoryColor(s.strength);
            const sz = 3 + (s.importance || 1) * 2.2 + s.strength * 2;
            const lit = litOf(s), ember = emberOf(s);
            return (
              <span key={s.id} className="aer-star" data-cert={lit ? 'lit' : ember ? 'ember' : undefined}
                style={{ position: 'absolute', left: X(s.x), top: Y(s.y), width: sz, height: sz, borderRadius: '50%', transform: 'translate(-50%,-50%)',
                background: col, opacity: 0.4 + s.strength * 0.55,
                boxShadow: `0 0 ${4 + s.strength * 8}px ${col}`, pointerEvents: 'none',
                // 认证环：已点亮 = 发丝金环；待重燃 = 低透明度暗金余烬环（冷暗星体 + 残迹）
                outline: lit ? '1px solid var(--gold)' : ember ? '1px solid color-mix(in srgb, var(--gold-warm) 45%, transparent)' : 'none',
                outlineOffset: 2,
                animationDuration: `${3.4 + (i % 5) * 0.9}s`, animationDelay: `${(i % 7) * 0.5}s` }} />
            );
          })}

          {/* 星域主星 + 名字（俯瞰下依然是那颗温暖的太阳） */}
          {doms.map(g => (
            <div key={'n' + g.id} onClick={() => onOpenCon && onOpenCon(g.id)}
              onMouseEnter={() => setHoverCon(g.id)} onMouseLeave={() => setHoverCon(null)}
              style={{ position: 'absolute', left: X(g.cx), top: Y(g.cy), transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer', zIndex: 3 }}>
              <span className="sr-breathe" style={{ width: 15, height: 15, borderRadius: '50%', flex: 'none',
                background: 'radial-gradient(circle at 38% 34%, #fff6e0 0%, #ffd58a 32%, #ff9d52 64%, #e8623a 100%)',
                boxShadow: '0 0 26px 5px rgba(255,128,60,0.5), 0 0 10px 2px rgba(255,196,120,0.85)' }} />
              <span style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 300, color: 'var(--text-1)', letterSpacing: '0.05em', textShadow: 'var(--star-label-shadow)' }}>{g.name}</span>
                <span title={`健康度 ${Math.round(g.avg * 100)}% · 已点亮 ${g.lit} / 共 ${g.members} 颗`}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', color: g.avg > 0.6 ? 'var(--gold)' : 'var(--star-blue-dim)' }}>
                  {Math.round(g.avg * 100)}% · 已点亮 {g.lit}/{g.members}
                </span>
                <span className="aer-flyhint" style={{ display: 'block', fontSize: 'var(--t-xs)', color: 'var(--gold)', letterSpacing: 'var(--ls-hud)', marginTop: 3, opacity: hoverCon === g.id ? 1 : 0, transition: 'opacity var(--dur-base)' }}>点击飞入</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {!sp.length && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>你的星空还很暗。写下第一颗星，让它发光。</span>
        </div>
      )}

      {/* 顶部概览条——窄窗防线：条目一律不折字（nowrap），放不下就整组换行居中，
          绝不出现中文被 flex 压成逐字竖排的病态 */}
      <div data-tour="aerial-hud" style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: 'max-content', maxWidth: 'calc(100% - 32px)' }}>
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', rowGap: 4, gap: 'var(--s-6)', padding: 'var(--s-2) var(--s-6)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-2)', fontSize: 'var(--t-sm)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
            <Icon name="satellite" size={17} color="var(--gold)" />亮度鸟瞰
          </span>
          {dataset && dataset.ownerName && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 'var(--t-sm)', color: 'var(--gold)', whiteSpace: 'nowrap' }}>
              <Icon name="telescope" size={14} color="var(--gold)" />{dataset.ownerName} · 只读
            </span>
          )}
          <AerialSep />
          <AerialStat n={D.stars.length} t="知识星" />
          <AerialStat n={litCount} t="已点亮" tone="var(--gold)" />
          {emberCount > 0 && <AerialStat n={emberCount} t="待重燃" tone="var(--gold-warm)" />}
          <AerialStat n={dimming} t="正变暗" tone="var(--star-blue-dim)" />
          <AerialSep />
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text-2)', whiteSpace: 'nowrap', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>最薄弱星域 <b style={{ color: 'var(--star-blue-dim)', fontWeight: 500 }}>{weakest.name}</b></span>
        </GlassPanel>
      </div>

      {/* 左下：说明；右下：记忆温度图例 */}
      <div style={{ position: 'absolute', bottom: 26, left: 24, zIndex: 30, display: 'flex', alignItems: 'center', gap: 'var(--s-2)', fontSize: 'var(--t-xs)', color: 'var(--text-2)', maxWidth: 'calc(50% - 90px)' }}>
        <Icon name="map" size={14} color="currentColor" />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {dataset ? `${dataset.ownerName ? dataset.ownerName + ' 的星空编排' : '对方的星空编排'} · 点击星域返回星图` : '与你的星图同一编排 · 点击星域飞入'}
        </span>
      </div>
      <div style={{ position: 'absolute', bottom: 22, right: 24, zIndex: 30, maxWidth: 'calc(50% - 90px)' }}>
        {/* 图例小字统一收敛到 --t-xs 地板，颜色抬到 --text-2 保证对比；窄窗按组换行、不折字 */}
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', rowGap: 4, gap: 'var(--s-3)', padding: 'var(--s-2) var(--s-4)', whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-2)' }}>记忆温度</span>
          <span style={{ fontSize: 'var(--t-xs)', color: 'var(--text-2)' }}>正在变暗</span>
          <span style={{ width: 84, height: 5, borderRadius: 3, background: 'linear-gradient(90deg, var(--mem-dead), var(--mem-low), var(--mem-mid), var(--mem-high), var(--mem-full))' }} />
          <span style={{ fontSize: 'var(--t-xs)', color: 'var(--gold)' }}>融会贯通</span>
          <span style={{ width: 1, height: 14, background: 'var(--line)' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--t-xs)', color: 'var(--text-2)' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', boxSizing: 'border-box', border: '1px solid var(--gold)' }} />金环 = 已点亮
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--t-xs)', color: 'var(--text-2)' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', boxSizing: 'border-box', border: '1px solid color-mix(in srgb, var(--gold-warm) 55%, transparent)' }} />暗金环 = 待重燃
          </span>
        </GlassPanel>
      </div>

      <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 30 }}>
        <SRButton icon="corner-up-left" onClick={onClose}>返回星图</SRButton>
      </div>
    </div>
  );
}

function AerialStyle() {
  return (
    <style>{`
    /* 入场：从星图"拔升"到高空——整片星空缩小落定，zoom = flight */
    .aer-scene { animation: aer-ascend 760ms var(--ease-flight) both; transform-origin: 50% 46%; }
    @keyframes aer-ascend { from { opacity: 0; transform: scale(1.45); } to { opacity: 1; transform: scale(1); } }
    .aer-star { animation-name: aer-twinkle; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
    @keyframes aer-twinkle { 0%, 100% { filter: brightness(0.85); } 50% { filter: brightness(1.35); } }
    @media (prefers-reduced-motion: reduce) {
      .aer-scene { animation: none; }
      .aer-star { animation: none; }
    }
    `}</style>
  );
}

function AerialSep() { return <span style={{ width: 1, height: 20, background: 'var(--line)' }} />; }
function AerialStat({ n, t, tone }) {
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', flex: 'none' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-body-lg)', color: tone || 'var(--text-1)' }}>{n}</span>
      <span style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)' }}>{t}</span>
    </span>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { AerialView });
