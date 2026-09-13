/* EditorMenus — professional editor overlays: slash menu, selection toolbar,
   and the block right-click context menu with 转换为 / 颜色 / 移动到 submenus.
   The selection toolbar drives real document.execCommand formatting. */
/* 本文件的私有小组件一律带 EdMenu 前缀：浏览器里所有 .jsx 共享同一个全局作用域，
   叫 Row / Divider 这种通名必然和别的文件撞车，而且是「后加载者静悄悄覆盖前者」。 */
const { GlassPanel: SRGlass, Icon: SRIcon, IconButton: SRIconBtn } = window.StellarRaftDesignSystem_2866af;

const BLOCK_TYPES = [
  { type: 'p', icon: 'type', label: '文本', hint: '' },
  { type: 'h1', icon: 'heading-1', label: '标题 1', hint: '#' },
  { type: 'h2', icon: 'heading-2', label: '标题 2', hint: '##' },
  { type: 'h3', icon: 'heading-3', label: '标题 3', hint: '###' },
  { type: 'todo', icon: 'square-check-big', label: '待办列表', hint: '[]' },
  { type: 'bulleted', icon: 'list', label: '无序列表', hint: '-' },
  { type: 'numbered', icon: 'list-ordered', label: '有序列表', hint: '1.' },
  { type: 'toggle', icon: 'chevron-right', label: '折叠列表', hint: '' },
  { type: 'quote', icon: 'quote', label: '引用', hint: '>' },
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

/* ---- 模态焦点管理（与 DS Modal / ReviewSession 同一套语义）----
   进场移焦入内 · Tab 只在浮层内部回绕 · 退场把焦点还给打开它的元素。
   swallowCmdK: 模态置顶期间吞掉 ⌘K，避免命令面板叠在设置/AI 配置之上。 */
function useModalFocus(rootRef, opts) {
  const { swallowCmdK = false, autoFocus = true } = opts || {};
  React.useEffect(() => {
    const prev = document.activeElement;
    const root = rootRef.current;
    if (autoFocus && root && !root.contains(document.activeElement)) {
      const first = root.querySelector('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (first) first.focus(); else if (root.focus) root.focus();
    }
    const onKey = (e) => {
      if (swallowCmdK && (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); e.stopPropagation(); return;
      }
      if (e.key !== 'Tab') return;
      const r = rootRef.current; if (!r) return;
      const list = Array.from(r.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(el => el.offsetWidth || el.offsetHeight || el === document.activeElement);
      if (!list.length) { e.preventDefault(); return; }
      const inside = r.contains(document.activeElement);
      const i = list.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0 || !inside)) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && (i === list.length - 1 || !inside)) { e.preventDefault(); list[0].focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (prev && prev.focus && document.contains(prev)) prev.focus();
    };
  }, []);
}

/* ---- generic floating panel that closes on outside click / Esc ----
   键盘可达：role=menu、↑↓/Home/End 在 [role=menuitem] 间漫游、Enter/Space 激活
   （原生 button）、Esc 关闭并把焦点还给打开它的元素。autoFocus 为菜单（非 SlashMenu
   的输入框场景）进场移焦到首项。reduced-motion 下不播开合动画。 */
/* Floating — 跟着鼠标落点飘的浮动菜单。

   手机上这套「算坐标 + 视口夹取」的浮层不好用：屏幕就那么大，菜单要么贴边、
   要么盖住你刚点的东西，还得跟正文抢层叠顺序。所以窄屏整条路换掉——
   同样的菜单项，改从屏幕底部推上来（sheet），坐标一概不参与。 */
function Floating({ x, y, width = 240, onClose, children, anchor = 'left', autoFocus = false, role = 'menu', title }) {
  const phone = window.SRScreen && window.SRScreen.isPhone();
  const Sheet = window.SRKit && window.SRKit.MobileSheet;
  const ref = React.useRef(null);
  // Hook 顺序不能因分支变化：所有 hook 照常执行，只在最后决定渲染哪一种
  const sheetMode = phone && !!Sheet;
  const [pos, setPos] = React.useState({ left: x, top: y });
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  React.useLayoutEffect(() => {
    if (sheetMode) return;                 // 底部弹层不算坐标
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
    if (sheetMode) return;                 // sheet 自带遮罩与 Esc，不再挂全局关闭
    const prev = document.activeElement;
    if (autoFocus && ref.current) {
      const items = ref.current.querySelectorAll('[role="menuitem"], button:not([disabled])');
      if (items.length) items[0].focus();
    }
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const k = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k);
      if (autoFocus && prev && prev.focus && document.contains(prev)) prev.focus();
    };
  }, [onClose]);
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    // sheet 模式下 ref 没有挂到任何元素上：从事件本身找容器，别去解一个 null
    const root = ref.current || e.currentTarget;
    if (!root) return;
    const items = Array.from(root.querySelectorAll('[role="menuitem"]')).filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;   // 焦点不在菜单项上（如 SlashMenu 的搜索框）：交回原处理
    e.preventDefault();
    if (e.key === 'ArrowDown') items[(i + 1 + items.length) % items.length].focus();
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length].focus();
    else if (e.key === 'Home') items[0].focus();
    else items[items.length - 1].focus();
  };
  // 手机：同一批菜单项，从底部推上来。不算坐标、不抢层叠、拇指够得着
  if (sheetMode) {
    return (
      <Sheet open onClose={onClose} title={title}>
        <div role={role} onKeyDown={onKeyDown}>{children}</div>
      </Sheet>
    );
  }

  // 菜单内部的 mousedown 不冒泡到 document——否则父菜单/兄弟子菜单的
  // "点击外部关闭"会抢在 click 之前卸载整棵菜单，导致子菜单项点了没反应
  return (
    <div ref={ref} role={role} onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}
      style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 'var(--z-menu)', width, animation: reduce ? 'none' : 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
      <SRGlass strong radius="md" pad="none" glow style={{ padding: 6 }}>{children}</SRGlass>
    </div>
  );
}

function EdMenuRow({ icon, label, hint, chevron, danger, tone, active, onClick, onMouseEnter, onFocus }) {
  const [h, setH] = React.useState(false);
  const on = h || active;
  const color = danger ? 'var(--danger)' : tone === 'gold' ? 'var(--gold)' : on ? 'var(--text-1)' : 'var(--text-2)';
  return (
    <button type="button" role="menuitem" tabIndex={-1} className="sr-focus-ring" onClick={onClick}
      onMouseEnter={(e) => { setH(true); onMouseEnter && onMouseEnter(e); }} onMouseLeave={() => setH(false)}
      onFocus={(e) => { setH(true); onFocus && onFocus(e); }} onBlur={() => setH(false)}
      style={{ width: '100%', textAlign: 'left', font: 'inherit', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 9px',
        minHeight: (window.SRScreen && window.SRScreen.isTouch()) ? 46 : 40, boxSizing: 'border-box', borderRadius: 'var(--r-sm)', cursor: 'pointer', border: 'none',
        background: on ? (danger ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'color-mix(in srgb, var(--star-blue) 9%, transparent)') : 'transparent', color }}>
      {icon && <SRIcon name={icon} size={16} color="currentColor" />}
      <span style={{ flex: 1, fontSize: 13, color: danger ? 'var(--danger)' : on ? 'var(--text-1)' : 'var(--text-2)' }}>{label}</span>
      {hint && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{hint}</span>}
      {chevron && <SRIcon name="chevron-right" size={14} color="var(--text-3)" />}
    </button>
  );
}
// 「移动到星域」行：保留星域彩点（承载颜色信息），键盘可达
function MoveRow({ color, name, onClick }) {
  const [h, setH] = React.useState(false);
  return (
    <button type="button" role="menuitem" tabIndex={-1} className="sr-focus-ring" onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onFocus={() => setH(true)} onBlur={() => setH(false)}
      style={{ width: '100%', textAlign: 'left', font: 'inherit', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 9px', minHeight: 40, boxSizing: 'border-box', borderRadius: 'var(--r-sm)', cursor: 'pointer', border: 'none',
        background: h ? 'color-mix(in srgb, var(--star-blue) 9%, transparent)' : 'transparent' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: color, boxShadow: `0 0 7px ${color}` }} />
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{name}</span>
    </button>
  );
}
function Label({ children }) {
  return <div style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 10px 4px', fontFamily: 'var(--font-mono)' }}>{children}</div>;
}
function EdMenuDivider() { return <div style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />; }

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
    <Floating x={x} y={y} width={252} onClose={onClose} title="插入块">
      <div style={{ padding: '3px 5px 6px' }}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="筛选块类型…"
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
      </div>
      <div style={{ maxHeight: 320, overflow: 'auto' }}>
        <Label>基础块</Label>
        {list.length ? list.map((b, i) => (
          <EdMenuRow key={b.type} icon={b.icon} label={b.label} hint={b.hint} active={i === ai} onMouseEnter={() => setAi(i)} onClick={() => onPick(b.type)} />
        )) : <div style={{ padding: '8px 11px', fontSize: 12.5, color: 'var(--text-3)' }}>没有匹配的块类型</div>}
      </div>
    </Floating>
  );
}

/* ---- StarLinkMenu：正文里打 [[ 唤出的「链到另一颗星」选择器 ----
   Obsidian 的招牌动作，而这个应用本来就有对应的东西：星与星之间的连线、
   导出仓库时写成的 [[wikilink]]、以及「复制星链接」给出的 stellar-raft://star/<id>。
   缺的只是正文里那个入口 —— 以前要引用另一颗星，得先去复制链接再回来 ⌘K。

   只做一件事：列出星、按输入筛、选中后把链接交回去。插入与删掉那两个方括号
   由编辑器负责（它才知道光标在哪）。 */
function StarLinkMenu({ x, y, stars, onPick, onClose }) {
  const [q, setQ] = React.useState('');
  const [ai, setAi] = React.useState(0);
  const s = q.trim().toLowerCase();
  const list = (stars || []).filter(st => !s
    || String(st.label || '').toLowerCase().includes(s)
    || String(st.conName || '').toLowerCase().includes(s)
    || (st.tags || []).some(t => String(t).toLowerCase().includes(s))).slice(0, 40);
  React.useEffect(() => { setAi(0); }, [q]);
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAi(i => Math.min(list.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAi(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[ai]) onPick(list[ai]); }
  };
  return (
    <Floating x={x} y={y} width={286} onClose={onClose} title="链到另一颗星">
      <div style={{ padding: '3px 5px 6px' }}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="搜星名、星域或标签…"
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
      </div>
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {list.length ? list.map((st, i) => (
          <EdMenuRow key={st.id} icon="star" label={st.label} hint={st.conName} active={i === ai}
            onMouseEnter={() => setAi(i)} onClick={() => onPick(st)} />
        )) : <div style={{ padding: '8px 11px', fontSize: 12.5, color: 'var(--text-3)' }}>没有匹配的星</div>}
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
    { n: 'bold', t: '加粗 ' + window.SRKeys.combo('B'), cmd: 'bold' },
    { n: 'italic', t: '斜体 ' + window.SRKeys.combo('I'), cmd: 'italic' },
    { n: 'underline', t: '下划线 ' + window.SRKeys.combo('U'), cmd: 'underline' },
    { n: 'strikethrough', t: '删除线', cmd: 'strikeThrough' },
    { n: 'code', t: '行内代码', cmd: 'inlineCode' },
    { n: 'highlighter', t: '高亮', cmd: 'hiliteColor', val: 'color-mix(in srgb, var(--gold) 24%, transparent)' },
    { n: 'link', t: '链接 ' + window.SRKeys.combo('K'), link: true },
  ];
  // preventDefault on mousedown anywhere in the bar keeps the text selection alive through the click.
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div role="toolbar" aria-label="文字格式" onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', left: x, top: y, zIndex: 'var(--z-menu)', transform: 'translate(-50%,-100%)' }}>
      {/* 开合动画与菜单同一口径：--ease-flight · 控件级 160ms（reduced-motion 直达） */}
      <SRGlass strong radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '5px 7px', animation: reduce ? 'none' : 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
        <button type="button" className="sr-focus-ring sr-hit40" onClick={onColor} title="文字颜色"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 30, cursor: 'pointer', color: 'var(--text-2)', fontSize: 12.5, background: 'transparent', border: 'none', borderRadius: 'var(--r-sm)', position: 'relative' }}>
          A<SRIcon name="chevron-down" size={13} color="var(--text-3)" />
        </button>
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
function ColorMenu({ x, y, onClose, onPick, autoFocus = false }) {
  const swatch = (c, kind) => (
    <button type="button" role="menuitem" tabIndex={-1} key={kind + c.id} className="sr-focus-ring" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick({ kind, ...c })}
      style={{ width: '100%', textAlign: 'left', font: 'inherit', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', minHeight: 40, boxSizing: 'border-box', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--star-blue) 9%, transparent)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      onFocus={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--star-blue) 9%, transparent)'} onBlur={e => e.currentTarget.style.background = 'transparent'}>
      {kind === 'text'
        ? <span style={{ width: 18, height: 18, borderRadius: 5, border: '1px solid var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.c, fontSize: 12, fontWeight: 600 }}>A</span>
        : <span style={{ width: 18, height: 18, borderRadius: 5, background: c.c, border: '1px solid ' + (c.ring || 'var(--line)') }} />}
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.label}</span>
    </button>
  );
  return (
    <Floating x={x} y={y} width={200} onClose={onClose} autoFocus={autoFocus} title="块操作">
      <Label>文字颜色</Label>
      {TEXT_COLORS.map(c => swatch(c, 'text'))}
      <EdMenuDivider />
      <Label>背景</Label>
      {BG_COLORS.map(c => swatch(c, 'bg'))}
    </Floating>
  );
}

/* ---- Block context menu (right-click / ⋮⋮ handle) ---- */
function ContextMenu({ x, y, onClose, onAction, constellations }) {
  const [sub, setSub] = React.useState(null); // 'turn' | 'color' | 'move'
  const [subPos, setSubPos] = React.useState({ x: 0, y: 0 });
  const [subAuto, setSubAuto] = React.useState(false);
  const openSub = (name, e, auto) => { const r = e.currentTarget.getBoundingClientRect(); setSubPos({ x: r.right + 4, y: r.top - 6 }); setSub(name); setSubAuto(!!auto); };

  return (
    <React.Fragment>
      <Floating x={x} y={y} width={238} onClose={onClose} autoFocus title="这个块">
        <EdMenuRow icon="refresh-cw" label="转换为" chevron onMouseEnter={(e) => openSub('turn', e)} onFocus={(e) => openSub('turn', e)} onClick={(e) => openSub('turn', e, true)} />
        <EdMenuRow icon="copy" label="复制为副本" onClick={() => onAction('duplicate')} />
        <EdMenuRow icon="link" label="复制块链接" onClick={() => onAction('copyLink')} />
        <EdMenuRow icon="corner-up-right" label="移动到星域" chevron onMouseEnter={(e) => openSub('move', e)} onFocus={(e) => openSub('move', e)} onClick={(e) => openSub('move', e, true)} />
        <EdMenuDivider />
        <EdMenuRow icon="palette" label="颜色" chevron onMouseEnter={(e) => openSub('color', e)} onFocus={(e) => openSub('color', e)} onClick={(e) => openSub('color', e, true)} />
        <EdMenuRow icon="bookmark" label="加入复习队列" onClick={() => onAction('review')} />
        <EdMenuDivider />
        <EdMenuRow icon="trash-2" label="删除" danger onClick={() => onAction('delete')} />
        <div style={{ padding: '7px 11px 4px', borderTop: '1px solid var(--line)', marginTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{(window.SR_DATA.account || {}).name || '我'} 编辑</div>
        </div>
      </Floating>

      {sub === 'turn' && (
        <Floating x={subPos.x} y={subPos.y} width={208} onClose={() => setSub(null)} autoFocus={subAuto} title="转换为">
          <Label>转换为</Label>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {BLOCK_TYPES.filter(b => b.type !== 'divider' && b.type !== 'image').map(b => (
              <EdMenuRow key={b.type} icon={b.icon} label={b.label} onClick={() => { onAction('turn', b.type); onClose(); }} />
            ))}
          </div>
        </Floating>
      )}
      {sub === 'move' && (
        <Floating x={subPos.x} y={subPos.y} width={190} onClose={() => setSub(null)} autoFocus={subAuto} title="移动到星域">
          <Label>移动到星域</Label>
          {constellations.map(c => (
            <MoveRow key={c.id} color={c.color} name={c.name} onClick={() => { onAction('move', c.id); onClose(); }} />
          ))}
        </Floating>
      )}
      {sub === 'color' && (
        <ColorMenu x={subPos.x} y={subPos.y} onClose={() => setSub(null)} autoFocus={subAuto} onPick={(c) => { onAction('color', c); onClose(); }} />
      )}
    </React.Fragment>
  );
}

/* in-app confirm dialog (no browser confirm/alert) */
function ConfirmDialog({ message, confirmLabel, onYes, onClose }) {
  const ref = React.useRef(null);
  useModalFocus(ref, { swallowCmdK: true });
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); else if (e.key === 'Enter') { e.preventDefault(); onYes(); } }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return (
    <div onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(3,4,12,0.55)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={ref} onMouseDown={(e) => e.stopPropagation()} style={{ width: 348, maxWidth: '90vw', animation: reduce ? 'none' : 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
        <SRGlass strong radius="lg" pad="md" glow>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
            <span style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', background: 'color-mix(in srgb, var(--danger) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SRIcon name="alert-triangle" size={18} color="var(--danger)" /></span>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-1)', paddingTop: 5 }}>{message}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="sr-focus-ring" onClick={onClose} style={{ height: 34, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>取消</button>
            <button type="button" className="sr-focus-ring" onClick={onYes} style={{ height: 34, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid color-mix(in srgb, var(--danger) 50%, transparent)', background: 'color-mix(in srgb, var(--danger) 16%, transparent)', color: 'var(--danger)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{confirmLabel || '删除'}</button>
          </div>
        </SRGlass>
      </div>
    </div>
  );
}

/* in-app link input (replaces window.prompt) */
function LinkDialog({ initial, onSubmit, onClose }) {
  const [v, setV] = React.useState(initial || 'https://');
  const ref = React.useRef(null);
  useModalFocus(ref, { swallowCmdK: true });
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SANI = window.SRSanitize;
  const u = v.trim();
  const bad = u && SANI && SANI.safeUrl(u) == null;   // 协议非法：即时提示，禁用「添加」
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const submit = () => { if (!u) { onClose(); return; } if (bad) return; onSubmit(u); };
  return (
    <div onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(3,4,12,0.5)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={ref} onMouseDown={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: '92vw', animation: reduce ? 'none' : 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
        <SRGlass strong radius="lg" pad="md" glow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, fontSize: 13.5, color: 'var(--text-1)' }}><SRIcon name="link" size={16} color="var(--star-blue)" />添加链接</div>
          <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            placeholder="https://…"
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid ' + (bad ? 'color-mix(in srgb, var(--danger) 55%, transparent)' : 'var(--glass-border-strong)'), borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: 14, padding: '9px 11px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
          {bad && <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>不支持该协议 · 仅允许 http/https/mailto 或相对链接</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="button" className="sr-focus-ring" onClick={onClose} style={{ height: 34, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>取消</button>
            <button type="button" className="sr-focus-ring" onClick={submit} disabled={bad} style={{ height: 34, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'rgba(159,198,255,0.14)', color: 'var(--text-1)', fontSize: 13, cursor: bad ? 'not-allowed' : 'pointer', opacity: bad ? 0.5 : 1, fontFamily: 'var(--font-sans)' }}>添加</button>
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
  const [subAuto, setSubAuto] = React.useState(false);
  const openSub = (name, e, auto) => { const r = e.currentTarget.getBoundingClientRect(); setSubPos({ x: r.left - 4, y: r.top - 6 }); setSub(name); setSubAuto(!!auto); };
  return (
    <React.Fragment>
      <Floating x={x} y={y} width={236} anchor="right" onClose={onClose} autoFocus title="这颗星">
        <EdMenuRow icon="star" tone={fav ? 'gold' : undefined} active={fav} label={fav ? '取消收藏' : '收藏这颗星'} onClick={() => onAction('fav')} />
        <EdMenuDivider />
        <EdMenuRow icon="copy" label="创建星的副本" onClick={() => onAction('dup')} />
        <EdMenuRow icon="link" label="复制星链接" onClick={() => onAction('copyLink')} />
        <EdMenuRow icon="file-down" label="导出 Markdown" onClick={() => onAction('export')} />
        <EdMenuRow icon="file-up" label="导入 Markdown" onClick={() => onAction('import')} />
        <EdMenuRow icon="corner-up-right" label="移动到星域" chevron onMouseEnter={(e) => openSub('move', e)} onFocus={(e) => openSub('move', e)} onClick={(e) => openSub('move', e, true)} />
        <EdMenuRow icon="history" label="查看历史" onClick={() => onAction('history')} />
        <EdMenuDivider />
        <EdMenuRow icon="trash-2" label="删除这颗星" danger onClick={() => onAction('delete')} />
      </Floating>
      {sub === 'move' && (
        <Floating x={subPos.x} y={subPos.y} width={190} anchor="right" onClose={() => setSub(null)} autoFocus={subAuto} title="移动到星域">
          <Label>移动到星域</Label>
          {constellations.map(c => (
            <MoveRow key={c.id} color={c.color} name={c.name} onClick={() => { onAction('move', c.id); onClose(); }} />
          ))}
        </Floating>
      )}
    </React.Fragment>
  );
}

/* ---- Version history (mock) — self-drawn GlassPanel dialog, no browser modal ---- */
function HistoryDialog({ star, onClose, onFlash }) {
  const ref = React.useRef(null);
  useModalFocus(ref, { swallowCmdK: true });
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const versions = [
    { when: '刚刚', who: '你', note: '编辑了公式块与正文', cur: true },
    { when: '今天 14:08', who: '你', note: '新增「实验验证」小节与代码块' },
    { when: '昨天 21:14', who: '你', note: '调整属性、补充标签' },
    { when: '6 月 22 日', who: '你', note: '建立到「量子纠缠」的连接' },
    { when: '6 月 18 日', who: '你', note: '创建这颗星', first: true },
  ];
  return (
    <div onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'rgba(3,4,12,0.55)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={ref} onMouseDown={(e) => e.stopPropagation()} style={{ width: 432, maxWidth: '92vw', animation: reduce ? 'none' : 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
        <SRGlass strong radius="lg" pad="md" glow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <SRIcon name="history" size={17} color="var(--star-blue)" />
            <span style={{ fontSize: 14.5, color: 'var(--text-1)' }}>版本历史</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>· {star.label}</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="sr-focus-ring sr-hit40" onClick={onClose} style={{ width: 26, height: 26, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)' }}><SRIcon name="x" size={16} color="currentColor" /></button>
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
                    onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--star-blue) 9%, transparent)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>恢复</button>
                )}
              </div>
            ))}
          </div>
        </SRGlass>
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { SlashMenu, StarLinkMenu, SelectionToolbar, ContextMenu, ColorMenu, ConfirmDialog, LinkDialog, EditorMoreMenu, HistoryDialog, useModalFocus, BLOCK_TYPES, TEXT_COLORS, BG_COLORS });
