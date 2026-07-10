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

// 更久之前的活动 —— 由「加载更多」逐步揭开（mock，不写进 data.js）。
const TL_OLDER = [
  { id: 'tlx1', starId: 's7',  con: 'ds', when: '上周三 14:20', delta: '+0.09', kind: 'ignite', note: '点亮 · 哈希冲突与开放寻址', bucket: 'earlier' },
  { id: 'tlx2', starId: 's4',  con: 'qm', when: '上周二 19:50', delta: '+0.06', kind: 'review', note: '复习 · 不确定性原理', bucket: 'earlier' },
  { id: 'tlx3', starId: 's10', con: 'ds', when: '上周一 09:10', delta: '−0.05', kind: 'dim',    note: '长时间未复习，开始变暗', bucket: 'earlier' },
  { id: 'tlx4', starId: 's8',  con: 'th', when: '更早',         delta: '+0.12', kind: 'ignite', note: '点亮 · 卡诺循环与效率上限', bucket: 'earlier' },
  { id: 'tlx5', starId: 's5',  con: 'la', when: '更早',         delta: '+0.04', kind: 'review', note: '复习 · 特征值分解', bucket: 'earlier' },
  { id: 'tlx6', starId: 's9',  con: 'ds', when: '更早',         delta: '−0.08', kind: 'dim',    note: '记忆继续冷却，亮度走低', bucket: 'earlier' },
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

  // 全量事件：data.js 的近期记录 + 本文件补充的更早记录。
  const all = React.useMemo(() => [...D.timeline, ...TL_OLDER], [D]);

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
                    const clickable = !!star.id;
                    return (
                      <div key={ev.id} style={{ position: 'relative' }}>
                        {/* 节点 */}
                        <span style={{ position: 'absolute', left: -25, top: 16, width: 11, height: 11, borderRadius: '50%', background: k.color, boxShadow: `0 0 8px ${k.color}`, border: '2px solid var(--space-0)' }} />
                        <div onClick={() => clickable && onOpen && onOpen(star.id)}
                          title={clickable ? '在星图中打开这颗星' : undefined}
                          style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'rgba(159,198,255,0.04)', padding: '12px 15px', cursor: clickable ? 'pointer' : 'default', transition: 'background var(--dur-fast), border-color var(--dur-fast)' }}
                          onMouseEnter={e => { if (clickable) { e.currentTarget.style.background = 'rgba(159,198,255,0.08)'; e.currentTarget.style.borderColor = 'var(--line-strong)'; } }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(159,198,255,0.04)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: k.color }}>
                              <Icon name={k.icon} size={14} color={k.color} />{k.label}
                            </span>
                            <span style={{ fontSize: 14.5, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{star.label || '未知星'}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-3)', flex: 'none' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: D.conColor(ev.con), boxShadow: `0 0 5px ${D.conColor(ev.con)}` }} />{D.conName(ev.con)}
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
