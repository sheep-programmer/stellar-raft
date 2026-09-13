/* CommandPalette — 全局搜索 (⌘K): one box to jump to any star, constellation
   or view. Arrow keys to move, Enter to go, Esc to close.
   全文搜索：正文命中的星归入「笔记」组，行下给一段高亮片段。 */
const { GlassPanel, Icon, Badge } = window.StellarRaftDesignSystem_2866af;

// 剥掉 HTML 标签并还原基本实体，取纯文本参与索引
function srStripHtml(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// 全文索引：每颗星一条记录。几百颗星线性扫足够，不做倒排。
// nameLower / metaLower(别名+标签) / bodyLower(摘要+正文) 分层存，供排序分档；
// bodyRaw 留原文，命中后截片段用。
function srBuildIndex(stars) {
  return (stars || []).map(s => {
    const meta = [(s.props && s.props.alias) || ''].concat(s.tags || []).join(' ');
    const parts = [];
    if (s.summary) parts.push(s.summary);
    (s.body || []).forEach(b => {
      if (b.text) parts.push(b.text);
      if (b.tex) parts.push(b.tex);
      if (b.code) parts.push(b.code);
    });
    const bodyRaw = parts.map(srStripHtml).join(' ').replace(/\s+/g, ' ').trim();
    const label = s.label || '';
    return {
      id: s.id, label, con: s.con,
      nameLower: label.toLowerCase(),
      metaLower: meta.toLowerCase(),
      bodyRaw, bodyLower: bodyRaw.toLowerCase(),
      hay: (label + ' ' + meta + ' ' + bodyRaw).toLowerCase(),
    };
  });
}

// 截取命中片段：首个命中词前后各约 24 字，按命中/未命中切成段，交给 React 渲染
// （不拼 HTML 字符串，避免 dangerouslySetInnerHTML）。
function srSnippet(raw, rawLower, tokens) {
  let pos = -1, len = 0;
  tokens.forEach(t => {
    const p = rawLower.indexOf(t);
    if (p !== -1 && (pos === -1 || p < pos)) { pos = p; len = t.length; }
  });
  if (pos === -1) return null;
  const start = Math.max(0, pos - 24);
  const end = Math.min(raw.length, pos + len + 24);
  const text = raw.slice(start, end);
  const lower = rawLower.slice(start, end);
  const hitAt = (i) => {
    let m = 0;
    tokens.forEach(t => { if (t && lower.startsWith(t, i) && t.length > m) m = t.length; });
    return m;
  };
  const segs = [];
  let i = 0;
  while (i < text.length) {
    const m = hitAt(i);
    if (m) { segs.push({ t: text.slice(i, i + m), hit: true }); i += m; continue; }
    let j = i + 1;
    while (j < text.length && !hitAt(j)) j += 1;
    segs.push({ t: text.slice(i, j), hit: false });
    i = j;
  }
  if (start > 0) segs.unshift({ t: '…', hit: false });
  if (end < raw.length) segs.push({ t: '…', hit: false });
  return segs;
}

// 视图命令：label 与侧栏完全同名（搜索「时间轴视图」也要命中），补充说明放 sub
const VIEW_CMDS = [
  { kind: 'view', id: 'map', label: '星图视图', icon: 'orbit', sub: '视图' },
  { kind: 'view', id: 'list', label: '列表视图', icon: 'list', sub: '视图' },
  { kind: 'view', id: 'timeline', label: '时间轴视图', icon: 'git-commit-horizontal', sub: '视图' },
  { kind: 'view', id: 'inbox', label: '收件箱', icon: 'inbox', sub: '视图' },
  { kind: 'view', id: 'blackhole', label: '黑洞', icon: 'aperture', sub: '回收站' },
  { kind: 'view', id: 'aerial', label: '亮度鸟瞰', icon: 'satellite', sub: '视图' },
  { kind: 'view', id: 'checkup', label: '知识体检报告', icon: 'activity', sub: '视图' },
  { kind: 'view', id: 'galaxy3d', label: '三维星系', icon: 'globe', sub: '视图' },
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
  // 管理员多一个去处：星港管理台。非管理员这一项根本不进候选，搜也搜不出来
  const viewCmds = D.account.admin
    ? [...VIEW_CMDS, { kind: 'view', id: 'admin', label: '星港管理台', icon: 'shield', sub: '管理' }]
    : VIEW_CMDS;
  const views = viewCmds.filter(v => !q || v.label.toLowerCase().includes(q)).map(v => ({ ...v, run: () => onOpenView(v.id) }));
  const actions = ACTION_CMDS.filter(a => !q || a.label.toLowerCase().includes(q));
  const cons = D.constellations.filter(c => !q || c.name.toLowerCase().includes(q)).map(c => ({ kind: 'con', id: c.id, label: c.name, sub: c.count + ' 颗星', color: c.color, icon: 'orbit', run: () => onFocusCon(c.id) }));

  // 星的全文搜索。索引首次用到才建，缓存在 ref 里，面板关闭随组件一起丢弃。
  const indexRef = React.useRef(null);
  const asItem = (e, extra) => Object.assign({ kind: 'star', id: e.id, label: e.label, sub: D.conName(e.con), color: D.conColor(e.con), icon: 'sparkles', run: () => onOpenStar(e.id) }, extra);
  let stars = [], notes = [];
  if (!q) {
    stars = D.stars.map(s => asItem(s));
  } else {
    if (!indexRef.current) indexRef.current = srBuildIndex(D.stars);
    const tokens = q.split(/\s+/).filter(Boolean);
    const ranked = [];
    indexRef.current.forEach(e => {
      if (!tokens.every(t => e.hay.includes(t))) return;
      // 0=星名命中 1=别名/标签命中 2=只有正文命中
      const rank = tokens.every(t => e.nameLower.includes(t)) ? 0
        : tokens.every(t => e.nameLower.includes(t) || e.metaLower.includes(t)) ? 1 : 2;
      ranked.push({ e, rank });
    });
    ranked.sort((a, b) => a.rank - b.rank);
    ranked.slice(0, 12).forEach(({ e, rank }) => {
      if (rank === 2) notes.push(asItem(e, { note: true, snippet: srSnippet(e.bodyRaw, e.bodyLower, tokens) }));
      else stars.push(asItem(e));
    });
  }

  const sections = [
    { title: '动作', items: actions },
    { title: '视图', items: views },
    { title: '星域', items: cons },
    { title: '知识星', items: stars },
    { title: '笔记', items: notes },
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
      className="sr-cmd-mask"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(3,4,12,0.55)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '13vh' }}>
      {/* preventDefault 与 stopPropagation 都要：点在面板的空白处（结果列表的
          padding、边缘）时，mousedown 的默认行为会把焦点拽去 body——此后
          Esc/↑↓/Enter 全部无人接收（它们只挂在 input 上）。preventDefault
          保住焦点，click 事件不受影响，结果项照常可点。 */}
      <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} className="sr-cmd-panel" style={{ width: 560, maxWidth: '92vw', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" pad="none" glow style={{ overflow: 'hidden' }}>
          {/* input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid var(--line)' }}>
            <Icon name="search" size={19} color="var(--star-blue)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey}
              role="combobox" aria-expanded="true" aria-controls="sr-cmd-list" aria-activedescendant={flat.length ? 'sr-cmd-opt-' + active : undefined}
              aria-label="搜索星、星域、视图、笔记正文"
              placeholder="搜索星、星域、视图、笔记正文…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-1)', fontSize: 16, fontFamily: 'var(--font-sans)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '2px 7px' }}>ESC</span>
          </div>

          {/* results */}
          <div ref={listRef} role="listbox" id="sr-cmd-list" style={{ maxHeight: 380, overflow: 'auto', padding: 8 }}>
            {flat.length === 0 && (
              <div role="status" style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>没有匹配「{query}」的结果。</div>
            )}
            {sections.map(sec => (
              <div key={sec.title} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 10px 4px', fontFamily: 'var(--font-mono)' }}>{sec.title}</div>
                {sec.items.map(item => {
                  idx += 1; const i = idx; const on = i === active;
                  return (
                    <div key={item.kind + item.id} data-idx={i} id={'sr-cmd-opt-' + i} role="option" aria-selected={on} onMouseEnter={() => setActive(i)} onClick={() => exec(item)}
                      style={{ padding: '9px 11px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: on ? 'color-mix(in srgb, var(--star-blue) 11%, transparent)' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        {item.color
                          ? <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, boxShadow: `0 0 7px ${item.color}` }} /></span>
                          : <Icon name={item.icon} size={16} color={on ? 'var(--gold)' : 'var(--text-2)'} />}
                        <span style={{ flex: 1, fontSize: 13.5, color: on ? 'var(--text-1)' : 'var(--text-2)' }}>{item.label}</span>
                        {item.note && <Badge tone="fading" style={{ fontSize: 10, height: 16, minWidth: 0 }}>正文</Badge>}
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.sub}</span>
                        {on && <Icon name="corner-down-left" size={13} color="var(--text-3)" />}
                      </div>
                      {item.snippet && (
                        <div style={{ margin: '3px 0 0 29px', fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.snippet.map((sg, k) => sg.hit
                            ? <b key={k} style={{ color: 'var(--gold)', fontWeight: 600 }}>{sg.t}</b>
                            : <span key={k}>{sg.t}</span>)}
                        </div>
                      )}
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
