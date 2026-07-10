/* EditorMenus — professional editor overlays: slash menu, selection toolbar,
   and the block right-click context menu with 转换为 / 颜色 / 移动到 submenus.
   The selection toolbar drives real document.execCommand formatting. */
const { GlassPanel: SRGlass, Icon: SRIcon, IconButton: SRIconBtn } = window.StellarRaftDesignSystem_2866af;

const BLOCK_TYPES = [
  { type: 'p', icon: 'type', label: '文本', hint: '' },
  { type: 'h1', icon: 'heading-1', label: '标题 1', hint: '#' },
  { type: 'h2', icon: 'heading-2', label: '标题 2', hint: '##' },
  { type: 'h3', icon: 'heading-3', label: '标题 3', hint: '###' },
  { type: 'todo', icon: 'square-check-big', label: '待办列表', hint: '[]' },
  { type: 'bulleted', icon: 'list', label: '无序列表', hint: '-' },
  { type: 'numbered', icon: 'list-ordered', label: '有序列表', hint: '1.' },
  { type: 'toggle', icon: 'chevron-right', label: '折叠列表', hint: '>' },
  { type: 'quote', icon: 'quote', label: '引用', hint: '"' },
  { type: 'callout', icon: 'info', label: '标注', hint: '' },
  { type: 'code', icon: 'code', label: '代码块', hint: '```' },
  { type: 'math', icon: 'sigma', label: '数学公式', hint: '$$' },
  { type: 'table', icon: 'table', label: '表格', hint: '' },
  { type: 'divider', icon: 'minus', label: '分割线', hint: '---' },
  { type: 'image', icon: 'image', label: '图片', hint: '' },
];

// `c` drives the swatch (theme var); `exec` is the concrete value passed to execCommand.
const TEXT_COLORS = [
  { id: 'default', label: '默认', c: 'var(--text-1)', exec: '#eef3ff' },
  { id: 'blue', label: '星辉蓝', c: 'var(--star-blue)', exec: '#9fc6ff' },
  { id: 'gold', label: '暖金', c: 'var(--gold)', exec: '#ffd98a' },
  { id: 'dim', label: '暗淡', c: 'var(--star-blue-dim)', exec: '#7896cd' },
  { id: 'danger', label: '警示', c: 'var(--danger)', exec: '#e8917a' },
];
const BG_COLORS = [
  { id: 'none', label: '无背景', c: 'transparent', ring: 'var(--line-strong)', exec: 'rgba(0,0,0,0)' },
  { id: 'bgblue', label: '星蓝底', c: 'rgba(159,198,255,0.16)', exec: 'rgba(159,198,255,0.24)' },
  { id: 'bggold', label: '暖金底', c: 'rgba(255,217,138,0.16)', exec: 'rgba(255,217,138,0.24)' },
  { id: 'bgdeep', label: '深蓝底', c: 'rgba(26,35,80,0.55)', exec: 'rgba(26,35,80,0.6)' },
];

/* ---- generic floating panel that closes on outside click / Esc ---- */
function Floating({ x, y, width = 240, onClose, children, anchor = 'left' }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ left: x, top: y });
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    let left = anchor === 'right' ? x - r.width : x;
    let top = y;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (left + r.width > vw - 8) left = vw - r.width - 8;
    if (left < 8) left = 8;
    if (top + r.height > vh - 8) top = Math.max(8, vh - r.height - 8);
    setPos({ left, top });
  }, [x, y]);
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const k = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [onClose]);
  // 菜单内部的 mousedown 不冒泡到 document——否则父菜单/兄弟子菜单的
  // "点击外部关闭"会抢在 click 之前卸载整棵菜单，导致子菜单项点了没反应
  return (
    <div ref={ref} onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 95, width }}>
      <SRGlass strong radius="md" pad="none" glow style={{ padding: 6 }}>{children}</SRGlass>
    </div>
  );
}

function Row({ icon, label, hint, chevron, danger, tone, active, onClick, onMouseEnter }) {
  const [h, setH] = React.useState(false);
  const color = danger ? 'var(--danger)' : tone === 'gold' ? 'var(--gold)' : (h || active) ? 'var(--text-1)' : 'var(--text-2)';
  return (
    <div onClick={onClick} onMouseEnter={(e) => { setH(true); onMouseEnter && onMouseEnter(e); }} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 9px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
        background: (h || active) ? (danger ? 'rgba(232,145,122,0.12)' : 'rgba(159,198,255,0.08)') : 'transparent', color }}>
      {icon && <SRIcon name={icon} size={16} color="currentColor" />}
      <span style={{ flex: 1, fontSize: 13, color: danger ? 'var(--danger)' : (h || active) ? 'var(--text-1)' : 'var(--text-2)' }}>{label}</span>
      {hint && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{hint}</span>}
      {chevron && <SRIcon name="chevron-right" size={14} color="var(--text-3)" />}
    </div>
  );
}
function Label({ children }) {
  return <div style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 10px 4px', fontFamily: 'var(--font-mono)' }}>{children}</div>;
}
function Divider() { return <div style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />; }

/* ---- Slash command menu — searchable + keyboard navigable ---- */
function SlashMenu({ x, y, onPick, onClose }) {
  const [q, setQ] = React.useState('');
  const [ai, setAi] = React.useState(0);
  const s = q.trim().toLowerCase();
  const list = BLOCK_TYPES.filter(b => !s || b.label.toLowerCase().includes(s) || b.type.includes(s) || (b.hint || '').includes(s));
  React.useEffect(() => { setAi(0); }, [q]);
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAi(i => Math.min(list.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAi(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[ai]) onPick(list[ai].type); }
  };
  return (
    <Floating x={x} y={y} width={252} onClose={onClose}>
      <div style={{ padding: '3px 5px 6px' }}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="筛选块类型…"
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
      </div>
      <div style={{ maxHeight: 320, overflow: 'auto' }}>
        <Label>基础块</Label>
        {list.length ? list.map((b, i) => (
          <Row key={b.type} icon={b.icon} label={b.label} hint={b.hint} active={i === ai} onMouseEnter={() => setAi(i)} onClick={() => onPick(b.type)} />
        )) : <div style={{ padding: '8px 11px', fontSize: 12.5, color: 'var(--text-3)' }}>没有匹配的块类型</div>}
      </div>
    </Floating>
  );
}

/* ---- Selection mini toolbar — wired to real execCommand via onFormat ---- */
function SelectionToolbar({ x, y, onFormat, onLink, onColor }) {
  const [active, setActive] = React.useState({});
  React.useEffect(() => {
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikethrough: document.queryCommandState('strikeThrough'),
      });
    } catch (e) { /* queryCommandState can throw in some states */ }
  }, [x, y]);
  const tools = [
    { n: 'bold', t: '加粗 ⌘B', cmd: 'bold' },
    { n: 'italic', t: '斜体 ⌘I', cmd: 'italic' },
    { n: 'underline', t: '下划线 ⌘U', cmd: 'underline' },
    { n: 'strikethrough', t: '删除线', cmd: 'strikeThrough' },
    { n: 'code', t: '行内代码', cmd: 'inlineCode' },
    { n: 'highlighter', t: '高亮', cmd: 'hiliteColor', val: 'rgba(255,217,138,0.24)' },
    { n: 'link', t: '链接 ⌘K', link: true },
  ];
  // preventDefault on mousedown anywhere in the bar keeps the text selection alive through the click.
  return (
    <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', left: x, top: y, zIndex: 95, transform: 'translate(-50%,-100%)' }}>
      <SRGlass strong radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '5px 7px' }}>
        <div onClick={onColor} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 30, cursor: 'pointer', color: 'var(--text-2)', fontSize: 12.5 }}>
          A<SRIcon name="chevron-down" size={13} color="var(--text-3)" />
        </div>
        <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
        {tools.map(t => (
          <SRIconBtn key={t.n} name={t.n} size="sm" title={t.t} active={!!active[t.n]}
            onClick={() => { if (t.link) onLink(); else onFormat(t.cmd, t.val); }} />
        ))}
      </SRGlass>
    </div>
  );
}

/* ---- Color submenu (text + background) ----
   onPick receives {kind, id, exec, ...}: block-coloring uses id, selection-coloring uses exec. */
function ColorMenu({ x, y, onClose, onPick }) {
  const swatch = (c, kind) => (
    <div key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick({ kind, ...c })}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 9px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {kind === 'text'
        ? <span style={{ width: 18, height: 18, borderRadius: 5, border: '1px solid var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.c, fontSize: 12, fontWeight: 600 }}>A</span>
        : <span style={{ width: 18, height: 18, borderRadius: 5, background: c.c, border: '1px solid ' + (c.ring || 'var(--line)') }} />}
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.label}</span>
    </div>
  );
  return (
    <Floating x={x} y={y} width={200} onClose={onClose}>
      <Label>文字颜色</Label>
      {TEXT_COLORS.map(c => swatch(c, 'text'))}
      <Divider />
      <Label>背景</Label>
      {BG_COLORS.map(c => swatch(c, 'bg'))}
    </Floating>
  );
}

/* ---- Block context menu (right-click / ⋮⋮ handle) ---- */
function ContextMenu({ x, y, onClose, onAction, constellations }) {
  const [sub, setSub] = React.useState(null); // 'turn' | 'color' | 'move'
  const [subPos, setSubPos] = React.useState({ x: 0, y: 0 });
  const openSub = (name, e) => { const r = e.currentTarget.getBoundingClientRect(); setSubPos({ x: r.right + 4, y: r.top - 6 }); setSub(name); };

  return (
    <React.Fragment>
      <Floating x={x} y={y} width={238} onClose={onClose}>
        <Row icon="sparkles" label="询问 AI" tone="gold" onClick={() => onAction('ai')} />
        <Divider />
        <Row icon="refresh-cw" label="转换为" chevron onMouseEnter={(e) => openSub('turn', e)} />
        <Row icon="copy" label="复制为副本" hint="⌘D" onClick={() => onAction('duplicate')} />
        <Row icon="link" label="复制块链接" onClick={() => onAction('copyLink')} />
        <Row icon="corner-up-right" label="移动到星座" chevron onMouseEnter={(e) => openSub('move', e)} />
        <Divider />
        <Row icon="palette" label="颜色" chevron onMouseEnter={(e) => openSub('color', e)} />
        <Row icon="message-square-text" label="评论" hint="⌘⇧M" onClick={() => onAction('comment')} />
        <Row icon="bookmark" label="加入复习队列" onClick={() => onAction('review')} />
        <Divider />
        <Row icon="trash-2" label="删除" hint="Del" danger onClick={() => onAction('delete')} />
        <div style={{ padding: '7px 11px 4px', borderTop: '1px solid var(--line)', marginTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{(window.SR_DATA.account || {}).name || '我'} 编辑</div>
        </div>
      </Floating>

      {sub === 'turn' && (
        <Floating x={subPos.x} y={subPos.y} width={208} onClose={() => setSub(null)}>
          <Label>转换为</Label>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {BLOCK_TYPES.filter(b => b.type !== 'divider' && b.type !== 'image').map(b => (
              <Row key={b.type} icon={b.icon} label={b.label} onClick={() => { onAction('turn', b.type); onClose(); }} />
            ))}
          </div>
        </Floating>
      )}
      {sub === 'move' && (
        <Floating x={subPos.x} y={subPos.y} width={190} onClose={() => setSub(null)}>
          <Label>移动到星座</Label>
          {constellations.map(c => (
            <div key={c.id} onClick={() => { onAction('move', c.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, boxShadow: `0 0 7px ${c.color}` }} />
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.name}</span>
            </div>
          ))}
        </Floating>
      )}
      {sub === 'color' && (
        <ColorMenu x={subPos.x} y={subPos.y} onClose={() => setSub(null)} onPick={(c) => { onAction('color', c); onClose(); }} />
      )}
    </React.Fragment>
  );
}

/* in-app confirm dialog (no browser confirm/alert) */
function ConfirmDialog({ message, confirmLabel, onYes, onClose }) {
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return (
    <div onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(3,4,12,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 348, maxWidth: '90vw', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <SRGlass strong radius="lg" pad="md" glow>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
            <span style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', background: 'rgba(232,145,122,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SRIcon name="alert-triangle" size={18} color="var(--danger)" /></span>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-1)', paddingTop: 5 }}>{message}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ height: 32, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>取消</button>
            <button type="button" onClick={onYes} style={{ height: 32, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid rgba(232,145,122,0.5)', background: 'rgba(232,145,122,0.16)', color: 'var(--danger)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{confirmLabel || '删除'}</button>
          </div>
        </SRGlass>
      </div>
    </div>
  );
}

/* in-app link input (replaces window.prompt) */
function LinkDialog({ initial, onSubmit, onClose }) {
  const [v, setV] = React.useState(initial || 'https://');
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const submit = () => { const u = v.trim(); if (u) onSubmit(u); else onClose(); };
  return (
    <div onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(3,4,12,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: '92vw', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <SRGlass strong radius="lg" pad="md" glow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, fontSize: 13.5, color: 'var(--text-1)' }}><SRIcon name="link" size={16} color="var(--star-blue)" />添加链接</div>
          <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            placeholder="https://…"
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: 14, padding: '9px 11px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="button" onClick={onClose} style={{ height: 32, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>取消</button>
            <button type="button" onClick={submit} style={{ height: 32, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'rgba(159,198,255,0.14)', color: 'var(--text-1)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>添加</button>
          </div>
        </SRGlass>
      </div>
    </div>
  );
}

/* ---- Page-level 「更多」 dropdown for the editor title bar ---- */
function EditorMoreMenu({ x, y, fav, constellations, onAction, onClose }) {
  const [sub, setSub] = React.useState(null);
  const [subPos, setSubPos] = React.useState({ x: 0, y: 0 });
  const openSub = (name, e) => { const r = e.currentTarget.getBoundingClientRect(); setSubPos({ x: r.left - 4, y: r.top - 6 }); setSub(name); };
  return (
    <React.Fragment>
      <Floating x={x} y={y} width={236} anchor="right" onClose={onClose}>
        <Row icon="star" tone={fav ? 'gold' : undefined} active={fav} label={fav ? '取消收藏' : '收藏这颗星'} onClick={() => onAction('fav')} />
        <Divider />
        <Row icon="copy" label="复制为副本" onClick={() => onAction('dup')} />
        <Row icon="link" label="复制星链接" onClick={() => onAction('copyLink')} />
        <Row icon="file-down" label="导出 Markdown" onClick={() => onAction('export')} />
        <Row icon="corner-up-right" label="移动到星座" chevron onMouseEnter={(e) => openSub('move', e)} />
        <Row icon="history" label="查看历史" onClick={() => onAction('history')} />
        <Divider />
        <Row icon="trash-2" label="删除这颗星" danger onClick={() => onAction('delete')} />
      </Floating>
      {sub === 'move' && (
        <Floating x={subPos.x} y={subPos.y} width={190} anchor="right" onClose={() => setSub(null)}>
          <Label>移动到星座</Label>
          {constellations.map(c => (
            <div key={c.id} onClick={() => { onAction('move', c.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, boxShadow: `0 0 7px ${c.color}` }} />
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.name}</span>
            </div>
          ))}
        </Floating>
      )}
    </React.Fragment>
  );
}

/* ---- Version history (mock) — self-drawn GlassPanel dialog, no browser modal ---- */
function HistoryDialog({ star, onClose, onFlash }) {
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const versions = [
    { when: '刚刚', who: '你', note: '编辑了公式块与正文', cur: true },
    { when: '今天 14:08', who: '你', note: '新增「实验验证」小节与代码块' },
    { when: '昨天 21:14', who: '你', note: '调整属性、补充标签' },
    { when: '6 月 22 日', who: '你', note: '建立到「量子纠缠」的连接' },
    { when: '6 月 18 日', who: '你', note: '创建这颗星', first: true },
  ];
  return (
    <div onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(3,4,12,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 432, maxWidth: '92vw', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <SRGlass strong radius="lg" pad="md" glow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <SRIcon name="history" size={17} color="var(--star-blue)" />
            <span style={{ fontSize: 14.5, color: 'var(--text-1)' }}>版本历史</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>· {star.label}</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={onClose} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)' }}><SRIcon name="x" size={16} color="currentColor" /></button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>记录最近的编辑快照</div>
          <div style={{ maxHeight: 320, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {versions.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 4px', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: v.cur ? 'var(--gold)' : 'var(--star-blue)', boxShadow: v.cur ? 'var(--glow-gold-soft)' : 'none', opacity: v.cur ? 1 : 0.6 }} />
                  {i < versions.length - 1 && <span style={{ width: 1, flex: 1, marginTop: 4, background: 'var(--line)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{v.note}</span>
                    {v.cur && <span style={{ fontSize: 10, color: 'var(--gold)', border: '1px solid rgba(255,217,138,0.4)', borderRadius: 'var(--r-pill)', padding: '1px 7px' }}>当前</span>}
                    {v.first && <span style={{ fontSize: 10, color: 'var(--text-3)', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-pill)', padding: '1px 7px' }}>创建</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{v.who} · {v.when}</div>
                </div>
                {!v.cur && (
                  <button type="button" onClick={() => { onFlash && onFlash('已恢复到该版本'); onClose(); }}
                    style={{ flex: 'none', alignSelf: 'center', height: 26, padding: '0 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>恢复</button>
                )}
              </div>
            ))}
          </div>
        </SRGlass>
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { SlashMenu, SelectionToolbar, ContextMenu, ColorMenu, ConfirmDialog, LinkDialog, EditorMoreMenu, HistoryDialog, BLOCK_TYPES, TEXT_COLORS, BG_COLORS });
