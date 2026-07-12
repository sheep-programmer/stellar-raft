/* CommandPalette — 全局搜索 (⌘K): one box to jump to any star, constellation
   or view. Arrow keys to move, Enter to go, Esc to close. */
const { GlassPanel, Icon } = window.StellarRaftDesignSystem_2866af;

// 视图命令：label 与侧栏完全同名（搜索「时间轴视图」也要命中），补充说明放 sub
const VIEW_CMDS = [
  { kind: 'view', id: 'map', label: '星图视图', icon: 'orbit', sub: '视图' },
  { kind: 'view', id: 'list', label: '列表视图', icon: 'list', sub: '视图' },
  { kind: 'view', id: 'timeline', label: '时间轴视图', icon: 'git-commit-horizontal', sub: '视图' },
  { kind: 'view', id: 'inbox', label: '收件箱', icon: 'inbox', sub: '视图' },
  { kind: 'view', id: 'blackhole', label: '黑洞', icon: 'aperture', sub: '回收站' },
  { kind: 'view', id: 'aerial', label: '亮度鸟瞰', icon: 'satellite', sub: '视图' },
  { kind: 'view', id: 'visit', label: '星际漫游', icon: 'telescope', sub: '好友星系' },
];

function CommandPalette({ onClose, onOpenStar, onOpenView, onFocusCon }) {
  const D = window.SR_DATA;
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef(null);

  // 关闭时把焦点还给打开面板的元素（Tab 也圈禁在面板内）。
  // 移焦交给 useModalFocus（面板内第一个 focusable 就是搜索 input）：
  // hook 会先捕获 prev 再移焦；input 上不能用原生 autoFocus，否则在
  // commit 阶段就抢焦点，hook 捕到的 prev 是面板自己，关闭时无从还原。
  const rootRef = React.useRef(null);
  (window.SRKit && window.SRKit.useModalFocus ? window.SRKit.useModalFocus : () => { })(rootRef, { autoFocus: true });

  // 动作命令：⌘K 不只是搜索框——新建知识星落进第一个星域（没有就先立一片），直接进编辑器
  const newStar = () => {
    let con = D.constellations[0];
    if (!con) {
      con = { id: 'c' + Math.random().toString(36).slice(2, 7), name: '我的星域', color: '#9fc6ff', health: 0, count: 0 };
      D.constellations.push(con);
    }
    const id = 's' + Math.random().toString(36).slice(2, 8);
    D.addStar({
      id, con: con.id, x: 46 + Math.random() * 10, y: 42 + Math.random() * 10,
      strength: 0.5, importance: 1, label: '新的知识星', summary: '', tags: ['草稿'],
      props: { type: '草稿', status: '正常', source: '命令面板', alias: '', nextReview: '明天' },
      body: [{ id: id + '-r', type: 'rich' }, { id: id + '-p', type: 'p', text: '' }],
    });
    onOpenStar(id);
  };
  const ACTION_CMDS = [
    { kind: 'action', id: 'new-star', label: '新建知识星', icon: 'plus', sub: '动作', run: newStar },
  ];

  const q = query.trim().toLowerCase();
  const views = VIEW_CMDS.filter(v => !q || v.label.toLowerCase().includes(q)).map(v => ({ ...v, run: () => onOpenView(v.id) }));
  const actions = ACTION_CMDS.filter(a => !q || a.label.toLowerCase().includes(q));
  const cons = D.constellations.filter(c => !q || c.name.toLowerCase().includes(q)).map(c => ({ kind: 'con', id: c.id, label: c.name, sub: c.count + ' 颗星', color: c.color, icon: 'orbit', run: () => onFocusCon(c.id) }));
  const stars = D.stars.filter(s => !q || s.label.toLowerCase().includes(q) || (s.tags || []).some(t => t.toLowerCase().includes(q))).map(s => ({ kind: 'star', id: s.id, label: s.label, sub: D.conName(s.con), color: D.conColor(s.con), icon: 'sparkles', run: () => onOpenStar(s.id) }));

  const sections = [
    { title: '动作', items: actions },
    { title: '视图', items: views },
    { title: '星域', items: cons },
    { title: '知识星', items: stars },
  ].filter(s => s.items.length);
  const flat = sections.reduce((a, s) => a.concat(s.items), []);

  React.useEffect(() => { setActive(0); }, [query]);
  React.useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('[data-idx="' + active + '"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const exec = (item) => { if (!item) return; item.run(); onClose(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); exec(flat[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let idx = -1;
  return (
    <div ref={rootRef} onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="全局搜索"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(3,4,12,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '13vh' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" pad="none" glow style={{ overflow: 'hidden' }}>
          {/* input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid var(--line)' }}>
            <Icon name="search" size={19} color="var(--star-blue)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey}
              aria-label="搜索星、星域、视图"
              placeholder="搜索星、星域、视图…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-1)', fontSize: 16, fontFamily: 'var(--font-sans)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '2px 7px' }}>ESC</span>
          </div>

          {/* results */}
          <div ref={listRef} style={{ maxHeight: 380, overflow: 'auto', padding: 8 }}>
            {flat.length === 0 && (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>没有匹配「{query}」的结果。</div>
            )}
            {sections.map(sec => (
              <div key={sec.title} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 10px 4px', fontFamily: 'var(--font-mono)' }}>{sec.title}</div>
                {sec.items.map(item => {
                  idx += 1; const i = idx; const on = i === active;
                  return (
                    <div key={item.kind + item.id} data-idx={i} onMouseEnter={() => setActive(i)} onClick={() => exec(item)}
                      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: on ? 'color-mix(in srgb, var(--star-blue) 11%, transparent)' : 'transparent' }}>
                      {item.color
                        ? <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, boxShadow: `0 0 7px ${item.color}` }} /></span>
                        : <Icon name={item.icon} size={16} color={on ? 'var(--gold)' : 'var(--text-2)'} />}
                      <span style={{ flex: 1, fontSize: 13.5, color: on ? 'var(--text-1)' : 'var(--text-2)' }}>{item.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.sub}</span>
                      {on && <Icon name="corner-down-left" size={13} color="var(--text-3)" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { CommandPalette });
