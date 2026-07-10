/* Checkup — 知识体检报告 (整页仪表盘): a full-stage dashboard that reads the whole
   universe's memory health. Overall health, per-constellation bars, the memory
   distribution (牢固 / 正常 / 正变暗 / 将熄灭), the stars most in need of review,
   a recent ignite trend drawn from the timeline, and weak-constellation nudges.
   Click a star to open it, click a constellation to fly there. */
const { GlassPanel, Icon, IconButton, Button, MemoryBar } = window.StellarRaftDesignSystem_2866af;

// memory band — same thresholds the rest of the kit uses
function band(s) {
  if (s < 0.2) return { key: 'dying', t: '将熄灭', c: 'var(--star-blue-deep)' };
  if (s < 0.4) return { key: 'fading', t: '正变暗', c: 'var(--star-blue-dim)' };
  if (s < 0.7) return { key: 'normal', t: '正常', c: 'var(--star-blue)' };
  return { key: 'solid', t: '牢固', c: 'var(--gold)' };
}

// parse a timeline delta string ("+0.12" / "−0.06") into a signed number
function parseDelta(d) {
  const neg = d.indexOf('−') === 0 || d.indexOf('-') === 0;
  const n = parseFloat(d.replace('−', '').replace('+', '').replace('-', '')) || 0;
  return neg ? -n : n;
}

const HUD = { fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' };

function SectionTitle({ icon, children, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      {icon && <Icon name={icon} size={14} color="var(--star-blue)" />}
      <span style={HUD}>{children}</span>
      {hint && <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginLeft: 'auto' }}>{hint}</span>}
    </div>
  );
}

function Checkup({ onClose, onOpenStar, onFocusCon, onFeynman }) {
  const D = window.SR_DATA;
  const stars = D.stars;
  const total = stars.length;

  // overall memory health
  const overall = Math.round(stars.reduce((a, s) => a + s.strength, 0) / total * 100);
  const overallCol = overall >= 70 ? 'var(--gold)' : overall >= 45 ? 'var(--star-blue)' : 'var(--star-blue-dim)';

  // distribution by band
  const bandDefs = [
    { key: 'solid', t: '牢固', c: 'var(--gold)', desc: '记忆稳固，无需打扰' },
    { key: 'normal', t: '正常', c: 'var(--star-blue)', desc: '光度平稳' },
    { key: 'fading', t: '正变暗', c: 'var(--star-blue-dim)', desc: '开始遗忘，宜复习' },
    { key: 'dying', t: '将熄灭', c: 'var(--star-blue-deep)', desc: '濒临熄灭，尽快回看' },
  ];
  const counts = bandDefs.map(b => ({ ...b, n: stars.filter(s => band(s.strength).key === b.key).length }));
  const fadingTotal = counts.filter(b => b.key === 'fading' || b.key === 'dying').reduce((a, b) => a + b.n, 0);

  // per-constellation health, weakest first
  const cons = D.constellations.map(c => {
    const ss = stars.filter(s => s.con === c.id);
    const avg = ss.length ? ss.reduce((a, s) => a + s.strength, 0) / ss.length : 0;
    const weakest = ss.slice().sort((a, b) => a.strength - b.strength)[0];
    return { ...c, avg, members: ss.length, weakStar: weakest, dim: ss.filter(s => s.strength < 0.4).length };
  }).sort((a, b) => a.avg - b.avg);

  // stars most in need of review (overdue or dim, weakest first)
  const urgent = stars.slice()
    .filter(s => s.strength < 0.6 || (s.props && s.props.nextReview === '已逾期'))
    .sort((a, b) => {
      const ao = (a.props && a.props.nextReview === '已逾期') ? 0 : 1;
      const bo = (b.props && b.props.nextReview === '已逾期') ? 0 : 1;
      return ao - bo || a.strength - b.strength;
    })
    .slice(0, 6);
  const topUrgent = urgent[0];

  // weak-constellation nudges — the two coldest domains with dim members
  const weakCons = cons.filter(c => c.avg < 0.6).slice(0, 2);

  // recent ignite trend, oldest → newest, cumulative net light gained
  const events = D.timeline.slice().reverse();
  let acc = 0;
  const series = events.map(ev => { acc += parseDelta(ev.delta); return { ev, v: acc }; });
  const netDelta = acc;
  const igniteN = D.timeline.filter(t => t.kind === 'ignite').length;
  const reviewN = D.timeline.filter(t => t.kind === 'review').length;
  const dimN = D.timeline.filter(t => t.kind === 'dim').length;

  // sparkline geometry
  const SW = 320, SH = 96, PAD = 8;
  const vals = series.map(p => p.v).concat([0]);
  const vMin = Math.min(...vals), vMax = Math.max(...vals);
  const span = (vMax - vMin) || 1;
  const px = i => PAD + (series.length <= 1 ? 0 : i / (series.length - 1)) * (SW - PAD * 2);
  const py = v => SH - PAD - ((v - vMin) / span) * (SH - PAD * 2);
  const linePts = series.map((p, i) => `${px(i).toFixed(1)},${py(p.v).toFixed(1)}`).join(' ');
  const areaPts = series.length
    ? `${px(0).toFixed(1)},${(SH - PAD).toFixed(1)} ${linePts} ${px(series.length - 1).toFixed(1)},${(SH - PAD).toFixed(1)}`
    : '';

  const card = { borderRadius: 'var(--r-lg)', border: '1px solid var(--glass-border)', background: 'var(--glass-bg-faint)', padding: 18 };

  return (
    <div onContextMenu={e => e.preventDefault()} style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'auto', padding: '22px 30px 56px' }}>
      <sr-starfield density="0.55"></sr-starfield>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1080, margin: '0 auto' }}>

        {/* header with back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <Button variant="ghost" size="sm" icon="arrow-left" onClick={onClose}>返回</Button>
          <div style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...HUD }}>
            <Icon name="activity" size={13} color="var(--gold)" />KNOWLEDGE CHECKUP
          </span>
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 25, fontWeight: 300, color: 'var(--text-1)' }}>知识体检报告</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            为你的整片星空做一次记忆体检 —— 哪些星在发光，哪些正在变暗，哪些该回来看看。
          </div>
        </div>

        {/* hero row: big health number + distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginBottom: 16 }}>
          {/* overall */}
          <GlassPanel strong radius="lg" pad="none" glow style={{ padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={HUD}>整体记忆健康度</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '10px 0 2px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 64, fontWeight: 200, lineHeight: 1, color: overallCol, textShadow: overall >= 70 ? 'var(--text-glow-warm)' : 'var(--text-glow-cool)' }}>{overall}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 200, color: 'var(--text-3)' }}>%</span>
            </div>
            <div style={{ marginTop: 14 }}>
              <MemoryBar value={overall / 100} height={6} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, marginTop: 14 }}>
              共 <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)', fontWeight: 500 }}>{total}</b> 颗知识星，其中
              <b style={{ color: 'var(--star-blue-dim)', fontWeight: 500 }}> {fadingTotal} </b>颗正在变暗。
              {fadingTotal > 0 ? '该回来看看了。' : '星空明亮，保持节奏。'}
            </div>
          </GlassPanel>

          {/* distribution */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="layers" hint="按记忆强度分层">记忆分布</SectionTitle>
            {/* stacked proportion bar */}
            <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'rgba(159,198,255,0.08)', marginBottom: 16 }}>
              {counts.map(b => b.n > 0 && (
                <div key={b.key} title={`${b.t} · ${b.n}`} style={{ width: `${b.n / total * 100}%`, background: b.c, boxShadow: b.key === 'solid' ? '0 0 8px rgba(255,217,138,0.5)' : 'none' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {counts.map(b => (
                <div key={b.key} style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'rgba(159,198,255,0.03)', padding: '12px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.c, boxShadow: `0 0 6px ${b.c}` }} />
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{b.t}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 200, color: 'var(--text-1)', lineHeight: 1.1, marginTop: 8 }}>{b.n}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* per-constellation health */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="orbit" hint="点击飞入该星座">各星座健康度</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cons.map(c => (
                <div key={c.id} onClick={() => onFocusCon && onFocusCon(c.id)} title={`在星图中聚焦 ${c.name}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'background var(--dur-fast)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(159,198,255,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 92, flex: 'none', fontSize: 13, color: 'var(--text-2)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />{c.name}
                  </span>
                  <div style={{ flex: 1 }}><MemoryBar value={c.avg} height={6} fading={c.avg < 0.4} /></div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: c.avg < 0.4 ? 'var(--star-blue-dim)' : 'var(--text-2)', width: 34, textAlign: 'right' }}>{Math.round(c.avg * 100)}%</span>
                  <Icon name="chevron-right" size={15} color="var(--text-3)" />
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* most-needed review list */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="trending-down" hint={`${urgent.length} 颗待复习`}>最需复习</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {urgent.length === 0 && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>没有正在变暗的星，状态很好。</div>
              )}
              {urgent.map(s => {
                const b = band(s.strength);
                const overdue = s.props && s.props.nextReview === '已逾期';
                return (
                  <div key={s.id} onClick={() => (onFeynman ? onFeynman(s.id) : onOpenStar && onOpenStar(s.id))} title="进入费曼复习"
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'rgba(120,150,205,0.05)', cursor: 'pointer', transition: 'background var(--dur-fast)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(159,198,255,0.09)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(120,150,205,0.05)'; }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: b.c, boxShadow: `0 0 7px ${b.c}` }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: D.conColor(s.con) }} />
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{D.conName(s.con)}</span>
                        <span style={{ fontSize: 11, color: b.c }}>· {b.t}</span>
                      </div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--text-3)', flex: 'none' }}>
                      {(s.props && s.props.nextReview) || '—'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: b.c, width: 34, textAlign: 'right', flex: 'none' }}>{Math.round(s.strength * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </GlassPanel>

          {/* recent ignite trend */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="sparkles" hint="本周点亮 / 复习 / 变暗">近期点亮趋势</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <svg width="100%" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" style={{ flex: 1, height: SH }}>
                <defs>
                  <linearGradient id="sr-checkup-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,217,138,0.30)" />
                    <stop offset="100%" stopColor="rgba(255,217,138,0)" />
                  </linearGradient>
                </defs>
                {/* zero baseline */}
                <line x1={PAD} x2={SW - PAD} y1={py(0)} y2={py(0)} stroke="var(--line)" strokeDasharray="3 4" />
                {areaPts && <polygon points={areaPts} fill="url(#sr-checkup-trend)" />}
                <polyline points={linePts} fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                {series.map((p, i) => {
                  const col = p.ev.kind === 'dim' ? 'var(--star-blue-dim)' : p.ev.kind === 'review' ? 'var(--star-blue)' : 'var(--gold)';
                  return <circle key={p.ev.id} cx={px(i)} cy={py(p.v)} r="3" fill={col} stroke="var(--space-0)" strokeWidth="1.5" />;
                })}
              </svg>
              <div style={{ flex: 'none', width: 86, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 200, color: netDelta >= 0 ? 'var(--gold)' : 'var(--star-blue-dim)', lineHeight: 1 }}>
                    {netDelta >= 0 ? '+' : '−'}{Math.abs(netDelta).toFixed(2)}
                  </div>
                  <div style={{ ...HUD, marginTop: 4 }}>净光度</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, color: 'var(--text-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />点亮 {igniteN}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--star-blue)' }} />复习 {reviewN}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--star-blue-dim)' }} />变暗 {dimN}</span>
                </div>
              </div>
            </div>
          </GlassPanel>

          {/* weak-constellation nudges */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="compass" hint="点击前往">薄弱星座建议</SectionTitle>
            {weakCons.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>各星座都还明亮，无需特别关注。</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weakCons.map(c => (
                <div key={c.id} style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'rgba(120,150,205,0.05)', padding: '13px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, boxShadow: `0 0 7px ${c.color}` }} />
                    <span style={{ fontSize: 14, color: 'var(--text-1)' }}>{c.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--star-blue-dim)' }}>{Math.round(c.avg * 100)}%</span>
                    <div style={{ flex: 1 }} />
                    <Button variant="ghost" size="sm" icon="arrow-right" onClick={() => onFocusCon && onFocusCon(c.id)}>前往</Button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, marginTop: 8 }}>
                    {c.dim} 颗星正在变暗{c.weakStar ? <>，最暗的是「<span onClick={() => onOpenStar && onOpenStar(c.weakStar.id)} style={{ color: 'var(--star-blue)', cursor: 'pointer' }}>{c.weakStar.label}</span>」</> : null}。
                    建议优先回看这片星座，把光度找回来。
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 }}>
          <Button variant="primary" size="md" icon="repeat" glow disabled={!topUrgent}
            onClick={() => topUrgent && (onFeynman ? onFeynman(topUrgent.id) : onOpenStar && onOpenStar(topUrgent.id))}>
            去复习最暗的星{topUrgent ? `「${topUrgent.label}」` : ''}
          </Button>
          {cons[0] && (
            <Button variant="secondary" size="md" icon="compass" onClick={() => onFocusCon && onFocusCon(cons[0].id)}>
              前往最薄弱星座
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="md" icon="check" onClick={onClose}>完成体检</Button>
        </div>
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { Checkup });
