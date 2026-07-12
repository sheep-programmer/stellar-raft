/* Timeline — 时间轴视图: trace back every star you've lit, dimmed or reviewed.
   Newest first, grouped by 今天/昨天/本周/更早, with a glowing thread down the left.
   Filter by kind, glance at this week's tally, click an entry to fly to its star. */
const { GlassPanel, Icon, Button, Tag, MemoryBar } = window.StellarRaftDesignSystem_2866af;

const TL_KIND = {
  ignite: { icon: 'zap', color: 'var(--gold)', label: '点亮' },
  review: { icon: 'repeat', color: 'var(--star-blue)', label: '复习' },
  dim: { icon: 'trending-down', color: 'var(--star-blue-dim)', label: '变暗' },
};

// 时段分组，自新到旧
const TL_BUCKETS = [
  { id: 'today', label: '今天' },
  { id: 'yesterday', label: '昨天' },
  { id: 'week', label: '本周' },
  { id: 'earlier', label: '更早' },
];

// 把一条事件归入某个时段：优先用显式 bucket，否则从 when 文案推断。
function tlBucketOf(ev) {
  if (ev.bucket) return ev.bucket;
  const w = ev.when || '';
  if (w.indexOf('今天') === 0) return 'today';
  if (w.indexOf('昨天') === 0) return 'yesterday';
  if (w.indexOf('上周') === 0 || w.indexOf('更早') === 0) return 'earlier';
  const m = w.match(/(\d+)\s*天前/);
  if (m) return (+m[1] <= 6) ? 'week' : 'earlier';
  return 'week';
}

const tlIsUp = ev => ev.delta.indexOf('−') !== 0 && ev.delta.indexOf('-') !== 0;
const TL_PAGE = 6; // 每次展示/加载的条目数

function Timeline({ onOpen }) {
  const D = window.SR_DATA;
  const [kind, setKind] = React.useState('all'); // all | ignite | review | dim
  const [shown, setShown] = React.useState(TL_PAGE);

  // 全量事件：只呈现真实发生过、且星仍然存在的记录——
  // 已销毁的星不再以「未知星」空壳占据时间轴。
  const all = React.useMemo(() => D.timeline.filter(ev => D.byId[ev.starId]), [D]);

  // 顶部小统计：本周（今天/昨天/本周，不含更早）的点亮与复习数。
  const weekly = all.filter(ev => tlBucketOf(ev) !== 'earlier');
  const lit = weekly.filter(ev => ev.kind === 'ignite').length;
  const reviewed = weekly.filter(ev => ev.kind === 'review').length;
  const fading = weekly.filter(ev => ev.kind === 'dim').length;

  const chips = [
    { id: 'all', label: '全部', icon: 'layers', color: 'var(--text-2)' },
    { id: 'ignite', label: '点亮', icon: TL_KIND.ignite.icon, color: TL_KIND.ignite.color },
    { id: 'review', label: '复习', icon: TL_KIND.review.icon, color: TL_KIND.review.color },
    { id: 'dim', label: '变暗', icon: TL_KIND.dim.icon, color: TL_KIND.dim.color },
  ];

  const filtered = kind === 'all' ? all : all.filter(ev => ev.kind === kind);
  const visible = filtered.slice(0, shown);
  const hasMore = filtered.length > visible.length;

  // 把可见事件按时段切片，保留顺序。
  const groups = TL_BUCKETS
    .map(b => ({ ...b, items: visible.filter(ev => tlBucketOf(ev) === b.id) }))
    .filter(g => g.items.length > 0);

  const pickKind = id => { setKind(id); setShown(TL_PAGE); };

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'auto', padding: '28px 30px 48px' }}
      onContextMenu={e => e.preventDefault()}>
      <sr-starfield density="0.6"></sr-starfield>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 680, margin: '0 auto' }}>
        {/* 标题 + 本周小统计 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 23, fontWeight: 300, color: 'var(--text-1)' }}>时间轴</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>按时间回溯你点亮、复习与变暗的每一颗星。</div>
          </div>
          <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '9px 20px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)' }}>This Week</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-2)' }}>
              <Icon name={TL_KIND.ignite.icon} size={15} color={TL_KIND.ignite.color} />
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{lit}</span> 点亮
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-2)' }}>
              <Icon name={TL_KIND.review.icon} size={15} color={TL_KIND.review.color} />
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--star-blue)' }}>{reviewed}</span> 复习
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-3)' }}>
              <Icon name={TL_KIND.dim.icon} size={15} color={TL_KIND.dim.color} />
              <span style={{ fontFamily: 'var(--font-mono)' }}>{fading}</span> 变暗
            </span>
          </GlassPanel>
        </div>

        {/* 类型筛选 chips */}
        <div style={{ display: 'flex', gap: 8, margin: '20px 0 22px', flexWrap: 'wrap' }}>
          {chips.map(c => {
            const count = c.id === 'all' ? all.length : all.filter(ev => ev.kind === c.id).length;
            return (
              <Tag key={c.id} active={kind === c.id} icon={c.icon} onClick={() => pickKind(c.id)}>
                {c.label}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.7, marginLeft: 2 }}>{count}</span>
              </Tag>
            );
          })}
        </div>

        {/* 空状态 */}
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-3)' }}>
            <Icon name="telescope" size={30} color="var(--star-blue-dim)" />
            <div style={{ fontSize: 14.5, color: 'var(--text-2)', marginTop: 14 }}>这段时间没有这类活动。</div>
            <div style={{ fontSize: 12.5, marginTop: 6 }}>换个筛选，或回到星空点亮一颗星。</div>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 30 }}>
            {/* 贯穿的发光丝线 */}
            <div style={{ position: 'absolute', left: 9, top: 6, bottom: 28, width: 1, background: 'linear-gradient(var(--gold), var(--star-blue), transparent)' }} />

            {groups.map(g => (
              <div key={g.id} style={{ marginBottom: 8 }}>
                {/* 时段分组标题 */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 10px' }}>
                  <span style={{ position: 'absolute', left: -25, top: '50%', width: 7, height: 7, marginTop: -3.5, transform: 'rotate(45deg)', background: 'var(--space-0)', border: '1px solid var(--line-strong)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)' }}>{g.label}</span>
                  <span style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{g.items.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {g.items.map(ev => {
                    const star = D.byId[ev.starId] || {};
                    const k = TL_KIND[ev.kind] || TL_KIND.review;
                    const up = tlIsUp(ev);
                    // 状态机新增的两种迁移在时间轴上有自己的名字：
                    // ignite + note「重燃」→ 重燃（flame）；dim + note「熄灭」→ 熄灭（待重燃）
                    const relitEv = ev.kind === 'ignite' && (ev.note || '').indexOf('重燃') >= 0;
                    const outEv = ev.kind === 'dim' && (ev.note || '').indexOf('熄灭') >= 0;
                    const evIcon = relitEv ? 'flame' : k.icon;
                    const evLabel = relitEv ? '重燃' : outEv ? '熄灭' : k.label;
                    // 这颗星当下的认证态（与事件无关的现状徽标）
                    const litNow = !!(D.isLit && D.isLit(star));
                    const emberNow = !!(D.isEmber && D.isEmber(star));
                    // 星域一律由这颗星当前的归属派生，不信事件快照里的 con 字段
                    const conId = star.con || ev.con;
                    return (
                      <div key={ev.id} style={{ position: 'relative' }}>
                        {/* 节点 */}
                        <span style={{ position: 'absolute', left: -25, top: 16, width: 11, height: 11, borderRadius: '50%', background: k.color, boxShadow: `0 0 8px ${k.color}`, border: '2px solid var(--space-0)' }} />
                        <div onClick={() => onOpen && onOpen(star.id)}
                          title="在星图中打开这颗星"
                          role="button" tabIndex={0} className="sr-focus-ring"
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen && onOpen(star.id); } }}
                          style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'color-mix(in srgb, var(--star-blue) 4%, transparent)', padding: '12px 15px', cursor: 'pointer', transition: 'background var(--dur-fast), border-color var(--dur-fast)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--star-blue) 9%, transparent)'; e.currentTarget.style.borderColor = 'var(--line-strong)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--star-blue) 4%, transparent)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: k.color }}>
                              <Icon name={evIcon} size={14} color={k.color} />{evLabel}
                            </span>
                            <span style={{ fontSize: 14.5, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{star.label}</span>
                            {litNow && <span title="已点亮 · 讲清楚的东西，暗得更慢。" style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', boxSizing: 'border-box', border: '1px solid var(--gold)' }} />}
                            {emberNow && <span title="曾点亮的星暗了下来。再讲透一次，就能重燃。" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, height: 16, padding: '0 6px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--gold-warm) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--gold-warm) 30%, transparent)', fontSize: 10, color: 'var(--gold-warm)' }}><Icon name="flame" size={10} color="var(--gold-warm)" />待重燃</span>}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-3)', flex: 'none' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: D.conColor(conId), boxShadow: `0 0 5px ${D.conColor(conId)}` }} />{D.conName(conId)}
                            </span>
                            <div style={{ flex: 1 }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: up ? 'var(--gold)' : 'var(--star-blue-dim)' }}>{ev.delta}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingLeft: 24 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.note}</span>
                            <div style={{ flex: 1 }} />
                            {typeof star.strength === 'number' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none' }} title="当前记忆强度">
                                <span style={{ width: 56 }}><MemoryBar value={star.strength} height={4} fading={star.strength < 0.4} /></span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{Math.round(star.strength * 100)}%</span>
                              </span>
                            )}
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', flex: 'none' }}>{ev.ts ? D.ago(ev.ts) : ev.when}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 加载更多 / 尽头 */}
            <div style={{ position: 'relative', paddingTop: 18, textAlign: 'center' }}>
              <span style={{ position: 'absolute', left: -22, top: 24, width: 5, height: 5, borderRadius: '50%', background: 'var(--line-strong)' }} />
              {hasMore ? (
                <Button variant="ghost" size="sm" icon="chevron-down" onClick={() => setShown(s => s + TL_PAGE)}>
                  加载更早的活动
                </Button>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>已是星空记忆的尽头</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { Timeline });
