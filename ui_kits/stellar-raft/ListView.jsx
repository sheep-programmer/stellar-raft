/* ListView — 笔记管理界面 (俯瞰态·列表视图): flatten the universe into a
   scannable, filterable, sortable, batch-editable data table. Header columns
   sort on click; rows reveal quick actions on hover; batch and per-row
   destructive actions go through a self-drawn confirm. Dimming rows read colder.
   All mutations are local to this view (data.js stays untouched), so moves /
   tags / review-queue / deletes take real effect on what's rendered here. */
const { GlassPanel, Icon, IconButton, Input, Tag, Badge, MemoryBar, Button } = window.StellarRaftDesignSystem_2866af;

function strengthLabel(s) {
  if (s < 0.2) return { t: '将熄灭', c: 'var(--star-blue-deep)' };
  if (s < 0.4) return { t: '正变暗', c: 'var(--star-blue-dim)' };
  if (s < 0.7) return { t: '正常', c: 'var(--star-blue)' };
  return { t: '牢固', c: 'var(--gold)' };
}

// Lower rank = more urgent, used by the 下次复习 column sort.
function reviewRank(r) {
  if (!r) return 999;
  if (r.indexOf('逾期') >= 0) return -1;
  if (r.indexOf('今天') >= 0) return 0;
  if (r.indexOf('明天') >= 0) return 1;
  const m = r.match(/(\d+)/);
  return m ? 1 + parseInt(m[1], 10) : 900;
}
function reviewColor(r) {
  if (!r) return 'var(--text-3)';
  if (r.indexOf('逾期') >= 0) return 'var(--danger)';
  if (r.indexOf('明天') >= 0 || r.indexOf('今天') >= 0) return 'var(--star-blue)';
  return 'var(--text-3)';
}

// Sortable columns. dir is the default direction the first click applies.
const SORT_DEFS = {
  title: { dir: 'asc', cmp: (a, b) => (a.title || '').localeCompare(b.title || '', 'zh') },
  strength: { dir: 'desc', cmp: (a, b) => a.strength - b.strength },
  review: { dir: 'asc', cmp: (a, b) => reviewRank(a.nextReview) - reviewRank(b.nextReview) || a.strength - b.strength },
  links: { dir: 'desc', cmp: (a, b) => a.links - b.links },
};

const GRID = '30px 1fr 156px 150px 116px 78px';

// A neutral / positive confirm modal (non-destructive) drawn from GlassPanel.
// Destructive actions reuse window.SRKit.ConfirmDialog (danger styling) instead.
function ActionDialog({ icon, accent, title, children, confirmLabel, confirmDisabled, onYes, onClose }) {
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  const tint = accent || 'var(--star-blue)';
  return (
    <div onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(3,4,12,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 360, maxWidth: '90vw', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" pad="md" glow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
            <span style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', background: 'rgba(159,198,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={17} color={tint} />
            </span>
            <div style={{ fontSize: 14.5, color: 'var(--text-1)' }}>{title}</div>
          </div>
          <div style={{ marginBottom: 18 }}>{children}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ height: 32, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>取消</button>
            <button type="button" onClick={confirmDisabled ? undefined : onYes} disabled={confirmDisabled}
              style={{ height: 32, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '1px solid rgba(255,217,138,0.5)', background: confirmDisabled ? 'rgba(159,198,255,0.06)' : 'rgba(255,217,138,0.16)', color: confirmDisabled ? 'var(--text-3)' : 'var(--gold)', fontSize: 13, cursor: confirmDisabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>{confirmLabel}</button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

// A small glass dropdown anchored under its trigger; closes on outside click.
function Menu({ open, onClose, width, children }) {
  if (!open) return null;
  return (
    <React.Fragment>
      <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div onContextMenu={(e) => e.preventDefault()}
        style={{ position: 'absolute', top: 'calc(100% + 7px)', left: 0, zIndex: 61, width: width || 200, animation: 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
        <GlassPanel strong radius="md" pad="none" style={{ overflow: 'hidden', padding: 6 }}>{children}</GlassPanel>
      </div>
    </React.Fragment>
  );
}
function MenuRow({ onClick, active, children }) {
  const [h, setH] = React.useState(false);
  return (
    <div onMouseDown={(e) => e.stopPropagation()} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 13,
        color: active ? 'var(--gold)' : 'var(--text-2)', background: h ? 'color-mix(in srgb, var(--star-blue) 9%, transparent)' : 'transparent', transition: 'background var(--dur-fast)' }}>
      {children}
    </div>
  );
}

function ListView({ onOpen, onOpenCon, onFeynman }) {
  const D = window.SR_DATA;
  const ConfirmDialog = window.SRKit && window.SRKit.ConfirmDialog;

  // Local mirror of the note list for rendering; every mutation writes through
  // to window.SR_DATA first, so other views (map / editor / timeline) stay in sync.
  const [notes, setNotes] = React.useState(() => D.notes.map(n => ({ ...n, tags: [...(n.tags || [])] })));
  const [reviewQueue, setReviewQueue] = React.useState([]); // ids queued for review

  // 记忆心跳：数据层每分钟按真实时间重算 R，本地镜像跟着刷新亮度与到期（只改数值，无动画）
  React.useEffect(() => {
    const h = () => setNotes(ns => ns.map(n => {
      const s = D.byId[n.id];
      return s ? { ...n, strength: s.strength, nextReview: (s.props && s.props.nextReview) || n.nextReview } : n;
    }));
    window.addEventListener('sr-memory', h);
    return () => window.removeEventListener('sr-memory', h);
  }, []);

  const [query, setQuery] = React.useState('');
  const [band, setBand] = React.useState('all');           // 记忆强度档
  const [conFilter, setConFilter] = React.useState(null);  // 星座
  const [tagFilter, setTagFilter] = React.useState(null);  // 标签
  const [overdueOnly, setOverdueOnly] = React.useState(false);

  const [sortKey, setSortKey] = React.useState(null);      // null = 原始(最近编辑)序
  const [sortDir, setSortDir] = React.useState('asc');

  const [sel, setSel] = React.useState([]);
  const [hoverId, setHoverId] = React.useState(null);
  const [menu, setMenu] = React.useState(null);            // 'con' | 'tag' | null
  const [dialog, setDialog] = React.useState(null);        // ActionDialog config
  const [confirm, setConfirm] = React.useState(null);      // danger ConfirmDialog config
  const [tagDraft, setTagDraft] = React.useState('');
  const [moveTarget, setMoveTarget] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1700); };

  // 空态的第一步：就地写下第一颗星（没有星域时先立一片），随后直接进入编辑器
  const [newStarOpen, setNewStarOpen] = React.useState(false);
  const [newStarDraft, setNewStarDraft] = React.useState('');
  const createFirstStar = () => {
    const label = newStarDraft.trim();
    if (!label) return;
    let con = D.constellations[0];
    if (!con) {
      con = { id: 'c' + Math.random().toString(36).slice(2, 7), name: '我的星域', color: '#9fc6ff', health: 0, count: 0 };
      D.constellations.push(con);
    }
    const id = 's' + Math.random().toString(36).slice(2, 8);
    D.addStar({
      id, con: con.id, x: 46 + Math.random() * 10, y: 42 + Math.random() * 10,
      strength: 0.5, importance: 1, label, summary: '', tags: ['草稿'],
      props: { type: '草稿', status: '正常', source: '列表视图', alias: '', nextReview: '明天' },
      body: [{ id: id + '-r', type: 'rich' }, { id: id + '-p', type: 'p', text: '' }],
    });
    setNewStarOpen(false); setNewStarDraft('');
    onOpen(id);
  };

  // 认证态（点亮/待重燃）——与亮度四档正交，从数据层派生，不在本地镜像里存一份
  const litOf = n => !!(D.isLit && D.isLit(D.byId[n.id]));
  const emberOf = n => !!(D.isEmber && D.isEmber(D.byId[n.id]));

  const bands = [
    { id: 'all', label: '全部' }, { id: 'lit', label: '已点亮' }, { id: 'ember', label: '待重燃' },
    { id: 'solid', label: '牢固' }, { id: 'normal', label: '正常' },
    { id: 'fading', label: '正变暗' }, { id: 'dying', label: '将熄灭' },
  ];
  const matchBand = n => band === 'all'
    || (band === 'lit' && litOf(n)) || (band === 'ember' && emberOf(n))
    || (band === 'solid' && n.strength >= 0.7) || (band === 'normal' && n.strength >= 0.4 && n.strength < 0.7)
    || (band === 'fading' && n.strength >= 0.2 && n.strength < 0.4) || (band === 'dying' && n.strength < 0.2);

  const allTags = React.useMemo(() => Array.from(new Set(notes.flatMap(n => n.tags || []))).sort((a, b) => a.localeCompare(b, 'zh')), [notes]);

  const q = query.trim().toLowerCase();
  const matchQuery = n => !q || n.title.toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q)) || (D.conName(n.con) || '').toLowerCase().includes(q);
  const matchCon = n => !conFilter || n.con === conFilter;
  const matchTag = n => !tagFilter || (n.tags || []).includes(tagFilter);
  const matchOverdue = n => !overdueOnly || (n.nextReview || '').indexOf('逾期') >= 0;

  let rows = notes.filter(n => matchBand(n) && matchQuery(n) && matchCon(n) && matchTag(n) && matchOverdue(n));
  if (sortKey && SORT_DEFS[sortKey]) {
    const cmp = SORT_DEFS[sortKey].cmp;
    rows = rows.slice().sort((a, b) => { const base = cmp(a, b); return sortDir === 'asc' ? base : -base; });
  }

  const visibleIds = rows.map(n => n.id);
  const selSet = new Set(sel);
  const allChecked = rows.length > 0 && visibleIds.every(id => selSet.has(id));
  const someChecked = visibleIds.some(id => selSet.has(id));

  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const selectAll = () => setSel(allChecked ? sel.filter(id => !visibleIds.includes(id)) : Array.from(new Set([...sel, ...visibleIds])));
  const invert = () => setSel(Array.from(new Set([...sel.filter(id => !visibleIds.includes(id)), ...visibleIds.filter(id => !selSet.has(id))])));

  const clickHeader = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(SORT_DEFS[key].dir); }
  };

  const anyFilter = band !== 'all' || conFilter || tagFilter || overdueOnly || q;
  const resetFilters = () => { setBand('all'); setConFilter(null); setTagFilter(null); setOverdueOnly(false); setQuery(''); };

  // ---- mutations（写穿数据层，星图/编辑器/时间轴同步可见）----
  const applyMove = (ids, conId) => {
    const set = new Set(ids);
    ids.forEach(id => { const s = D.byId[id]; if (s) { s.con = conId; D.touchNote(id); } });
    D.syncCounts();
    setNotes(ns => ns.map(n => set.has(n.id) ? { ...n, con: conId } : n));
  };
  const applyTag = (ids, tag) => {
    const set = new Set(ids);
    ids.forEach(id => { const s = D.byId[id]; if (s) { s.tags = s.tags || []; if (!s.tags.includes(tag)) s.tags.push(tag); D.touchNote(id); } });
    setNotes(ns => ns.map(n => set.has(n.id) && !n.tags.includes(tag) ? { ...n, tags: [...n.tags, tag] } : n));
  };
  const applyReview = (ids) => {
    // 写穿记忆模型：到期时刻提前到「明天」（已逾期的保持逾期），并记入时间线
    ids.forEach(id => { if (D.byId[id]) { D.queueReview(id, 1); D.pushTimeline('review', id, '加入复习队列'); } });
    setReviewQueue(q => Array.from(new Set([...q, ...ids])));
    setNotes(ns => ns.map(n => {
      if (!ids.includes(n.id)) return n;
      const s = D.byId[n.id];
      return s ? { ...n, nextReview: (s.props && s.props.nextReview) || n.nextReview } : n;
    }));
  };
  const applyDelete = (ids) => { const set = new Set(ids); setNotes(ns => ns.filter(n => !set.has(n.id))); setSel(s => s.filter(id => !set.has(id))); };

  // ---- batch flows ----
  const openBatchMove = () => {
    const ids = sel.slice();
    setMoveTarget(null);
    setDialog({
      icon: 'folder-input', accent: 'var(--star-blue)', title: '移动星域', confirmLabel: '移动到此',
      body: 'pickCon', ids,
      onYes: (target) => { if (!target) return; applyMove(ids, target); flash(`已将 ${ids.length} 颗星移动到「${D.conName(target)}」`); setSel([]); setDialog(null); setMoveTarget(null); },
    });
  };
  const batchTag = () => {
    const ids = sel.slice();
    setTagDraft('');
    setDialog({
      icon: 'hash', accent: 'var(--gold)', title: '加标签', confirmLabel: '添加',
      body: 'tag', ids,
      onYes: (tag) => { const t = (tag || '').trim().replace(/^#/, ''); if (!t) return; applyTag(ids, t); flash(`已为 ${ids.length} 颗星添加标签 #${t}`); setSel([]); setDialog(null); },
    });
  };
  const batchReview = () => {
    const ids = sel.slice();
    setDialog({
      icon: 'repeat', accent: 'var(--gold)', title: '加入复习', confirmLabel: '加入队列', body: 'review', ids,
      onYes: () => { applyReview(ids); flash(`已将 ${ids.length} 颗星加入复习队列`); setSel([]); setDialog(null); },
    });
  };
  const batchDelete = () => {
    const ids = sel.slice();
    setConfirm({
      message: `已选的 ${ids.length} 颗星将一并坠入黑洞（星图同步移除）。黑洞里的星可以随时恢复。`,
      confirmLabel: '移入黑洞',
      onYes: () => { ids.forEach(id => D.trashStar(id)); applyDelete(ids); flash(`${ids.length} 颗星已移入黑洞`); setConfirm(null); },
    });
  };

  // ---- per-row quick actions ----
  const [renameId, setRenameId] = React.useState(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const startRename = (n) => { setRenameId(n.id); setRenameDraft(n.title); };
  const commitRename = () => {
    const t = renameDraft.trim();
    if (t && renameId) {
      D.renameStar(renameId, t);
      setNotes(ns => ns.map(x => x.id === renameId ? { ...x, title: t } : x));
      flash('已重命名');
    }
    setRenameId(null);
  };
  const rowReview = (n) => { applyReview([n.id]); flash(`「${n.title}」已加入复习队列`); };
  const rowDelete = (n) => {
    setConfirm({
      message: `「${n.title}」将坠入黑洞（星图同步移除）。黑洞里的星可以随时恢复。`,
      confirmLabel: '移入黑洞',
      onYes: () => { D.trashStar(n.id); applyDelete([n.id]); flash(`「${n.title}」已移入黑洞`); setConfirm(null); },
    });
  };

  // real health stats from the (possibly mutated) local list
  const total = notes.length;
  const litTotal = notes.filter(litOf).length;
  const dimming = notes.filter(n => n.strength < 0.4).length;
  const health = total ? Math.round(notes.reduce((a, n) => a + n.strength, 0) / total * 100) : 0;

  const HeadCell = ({ k, children, justify }) => {
    const active = sortKey === k;
    return (
      <button type="button" onClick={() => clickHeader(k)} title="点击按此列排序" className="sr-focus-ring"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', justifyContent: justify || 'flex-start',
          background: 'none', border: 'none', padding: 0, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit',
          color: active ? 'var(--gold)' : 'var(--text-3)', transition: 'color var(--dur-fast)' }}>
        {children}
        <Icon name={active ? (sortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down'} size={12}
          color={active ? 'var(--gold)' : 'var(--line-strong)'} />
      </button>
    );
  };

  const Checkbox = ({ on, dash, onClick, label }) => (
    <button type="button" onClick={onClick} className="sr-focus-ring"
      role="checkbox" aria-checked={dash && !on ? 'mixed' : !!on} aria-label={label || '选择'}
      style={{ width: 17, height: 17, borderRadius: 5, border: '1px solid', cursor: 'pointer', padding: 0,
        borderColor: on || dash ? 'var(--gold)' : 'var(--line-strong)', background: on || dash ? 'var(--gold)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--dur-fast)' }}>
      {on && <Icon name="check" size={12} color="var(--text-on-gold)" />}
      {!on && dash && <span style={{ width: 8, height: 2, borderRadius: 1, background: 'var(--text-on-gold)' }} />}
    </button>
  );

  // 批量条上的文字动作：真按钮，可聚焦、可回车
  const TextAction = ({ onClick, children }) => (
    <button type="button" onClick={onClick} className="sr-focus-ring"
      style={{ background: 'none', border: 'none', font: 'inherit', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', padding: '6px 4px' }}>
      {children}
    </button>
  );

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'auto', padding: '26px 30px 40px' }}
      onContextMenu={(e) => e.preventDefault()}>
      <sr-starfield density="0.5"></sr-starfield>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1080, margin: '0 auto' }}>

        {/* health summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 23, fontWeight: 300, color: 'var(--text-1)' }}>笔记管理</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{total} 颗星 · <span style={{ color: litTotal ? 'var(--gold)' : 'inherit' }}>{litTotal} 已点亮</span> · {dimming} 颗偏暗</div>
          </div>
          <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '9px 20px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)' }}><Icon name="activity" size={16} color="var(--gold)" />知识体检</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: health >= 60 ? 'var(--gold)' : 'var(--star-blue-dim)' }}>健康度 {health}%</span>
          </GlassPanel>
        </div>

        {/* filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 240 }}><Input icon="search" placeholder="检索标题、标签…" size="sm" value={query} onChange={(e) => setQuery(e && e.target ? e.target.value : (e || ''))} /></div>
          <div style={{ display: 'flex', gap: 6 }}>
            {bands.map(f => <Tag key={f.id} active={band === f.id} onClick={() => setBand(f.id)}>{f.label}</Tag>)}
          </div>

          {/* 星域 filter */}
          <div style={{ position: 'relative' }}>
            <Tag icon="orbit" dot={conFilter ? D.conColor(conFilter) : undefined} active={!!conFilter} onClick={() => setMenu(menu === 'con' ? null : 'con')}>
              {conFilter ? D.conName(conFilter) : '星域'}
            </Tag>
            <Menu open={menu === 'con'} onClose={() => setMenu(null)} width={170}>
              <MenuRow active={!conFilter} onClick={() => { setConFilter(null); setMenu(null); }}>全部星域</MenuRow>
              {D.constellations.map(c => (
                <MenuRow key={c.id} active={conFilter === c.id} onClick={() => { setConFilter(c.id); setMenu(null); }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />{c.name}
                </MenuRow>
              ))}
            </Menu>
          </div>

          {/* 标签 filter */}
          <div style={{ position: 'relative' }}>
            <Tag icon="hash" active={!!tagFilter} onClick={() => setMenu(menu === 'tag' ? null : 'tag')}>
              {tagFilter ? tagFilter : '标签'}
            </Tag>
            <Menu open={menu === 'tag'} onClose={() => setMenu(null)} width={160}>
              <MenuRow active={!tagFilter} onClick={() => { setTagFilter(null); setMenu(null); }}>全部标签</MenuRow>
              {allTags.map(t => (
                <MenuRow key={t} active={tagFilter === t} onClick={() => { setTagFilter(t); setMenu(null); }}>#{t}</MenuRow>
              ))}
            </Menu>
          </div>

          {/* 逾期 toggle */}
          <Tag icon="alarm-clock" active={overdueOnly} onClick={() => setOverdueOnly(v => !v)}>逾期</Tag>

          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
            {rows.length}<span style={{ opacity: 0.5 }}> / {total}</span> 颗{sel.length > 0 && <span style={{ color: 'var(--gold)' }}> · 选 {sel.length}</span>}
          </span>
          {anyFilter && <span onClick={resetFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}><Icon name="x" size={13} color="currentColor" />清除筛选</span>}
        </div>

        {/* batch bar */}
        {sel.length > 0 && (
          <GlassPanel radius="md" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>已选 {sel.length} 颗</span>
            <TextAction onClick={selectAll}>{allChecked ? '全不选' : '全选'}</TextAction>
            <TextAction onClick={invert}>反选</TextAction>
            <TextAction onClick={() => setSel([])}>取消</TextAction>
            <div style={{ flex: 1 }} />
            <Button size="sm" variant="ghost" icon="folder-input" onClick={openBatchMove}>移动星域</Button>
            <Button size="sm" variant="ghost" icon="hash" onClick={batchTag}>加标签</Button>
            <Button size="sm" variant="ghost" icon="repeat" onClick={batchReview}>加入复习</Button>
            <Button size="sm" variant="ghost" icon="trash-2" onClick={batchDelete}>删除</Button>
          </GlassPanel>
        )}

        {/* table head */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '0 16px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase' }}>
          <Checkbox on={allChecked} dash={!allChecked && someChecked} onClick={selectAll} />
          <HeadCell k="title">标题</HeadCell>
          <HeadCell k="strength">记忆强度</HeadCell>
          <span style={{ color: 'var(--text-3)' }}>所属星域</span>
          <HeadCell k="review">下次复习</HeadCell>
          <HeadCell k="links" justify="flex-start">连接</HeadCell>
        </div>

        {/* rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.length === 0 && (
            <div style={{ padding: '54px 0 40px', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', background: 'rgba(159,198,255,0.06)', marginBottom: 14 }}>
                <Icon name={total === 0 ? 'sparkles' : 'search-x'} size={24} color="var(--star-blue-dim)" />
              </div>
              {total === 0
                ? (
                  <div>
                    <div style={{ color: 'var(--text-2)', fontSize: 14 }}>你的星空还很暗。<span style={{ color: 'var(--text-3)' }}>写下第一颗星，让它发光。</span></div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18 }}>
                      <Button size="sm" variant="primary" icon="plus" glow onClick={() => { setNewStarDraft(''); setNewStarOpen(true); }}>写下第一颗星</Button>
                      {D.loadDemo && <Button size="sm" variant="ghost" icon="telescope" title="载入一片可随时清空的演示星空" onClick={() => D.loadDemo()}>载入示例星系</Button>}
                    </div>
                  </div>
                )
                : <div style={{ color: 'var(--text-2)', fontSize: 14 }}>没有匹配的星。<span style={{ color: 'var(--text-3)' }}>换个关键词，或</span><button type="button" onClick={resetFilters} className="sr-focus-ring" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--gold)', cursor: 'pointer' }}>清除筛选</button>。</div>}
            </div>
          )}

          {rows.map(n => {
            const litRow = litOf(n);
            const emberRow = emberOf(n);
            // 待重燃是唯一新增的用户可见状态：覆盖亮度四档的状态文字（口径同 props.status）
            const sl = emberRow ? { t: '待重燃', c: 'var(--gold-warm)' } : strengthLabel(n.strength);
            const dim = n.strength < 0.4;
            const checked = selSet.has(n.id);
            const queued = reviewQueue.includes(n.id);
            const hov = hoverId === n.id;
            return (
              <div key={n.id} onClick={() => onOpen(n.id)}
                role="button" tabIndex={0} className="sr-focus-ring"
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOpen(n.id); } }}
                onMouseEnter={() => setHoverId(n.id)} onMouseLeave={() => setHoverId(h => h === n.id ? null : h)}
                onFocus={() => setHoverId(n.id)}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHoverId(h => h === n.id ? null : h); }}
                style={{ position: 'relative', display: 'grid', gridTemplateColumns: GRID, gap: 14, alignItems: 'center',
                  padding: '13px 16px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                  // 变暗的星降低整行「存在感」而不是叠深色底——黎明主题下深底会把整行糊死
                  background: checked ? 'rgba(255,217,138,0.06)'
                    : (hov ? 'color-mix(in srgb, var(--star-blue) 8%, transparent)'
                      : (dim ? 'var(--glass-bg-faint)' : 'color-mix(in srgb, var(--star-blue) 4%, transparent)')),
                  border: '1px solid', borderColor: checked ? 'rgba(255,217,138,0.24)' : 'var(--glass-border)',
                  opacity: dim ? 0.8 : 1, transition: 'background var(--dur-fast), border-color var(--dur-fast)' }}>

                <Checkbox on={checked} label={'选择「' + n.title + '」'} onClick={(e) => { e.stopPropagation(); toggle(n.id); }} />

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {renameId === n.id ? (
                      <input autoFocus value={renameDraft}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenameId(null); }}
                        style={{ height: 24, minWidth: 0, flex: 1, boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: 13.5, padding: '0 8px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
                    ) : (
                      <span onDoubleClick={(e) => { e.stopPropagation(); startRename(n); }} title="双击重命名"
                        style={{ fontSize: 14.5, color: dim ? 'var(--text-2)' : 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
                    )}
                    {litRow && <span title="已点亮 · 讲清楚的东西，暗得更慢。" style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', boxSizing: 'border-box', border: '1px solid var(--gold)' }} />}
                    {emberRow && <span title="曾点亮的星暗了下来。再讲透一次，就能重燃。" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, height: 17, padding: '0 7px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--gold-warm) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--gold-warm) 30%, transparent)', fontSize: 10, color: 'var(--gold-warm)' }}><Icon name="flame" size={10} color="var(--gold-warm)" />待重燃</span>}
                    {queued && <span title="已加入复习队列" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, height: 17, padding: '0 7px', borderRadius: 'var(--r-pill)', background: 'rgba(255,217,138,0.12)', border: '1px solid rgba(255,217,138,0.28)', fontSize: 10, color: 'var(--gold)' }}><Icon name="repeat" size={10} color="var(--gold)" />待复习</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>{(n.tags || []).map(t => <span key={t} style={{ fontSize: 10.5, color: 'var(--text-3)' }}>#{t}</span>)}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}><MemoryBar value={n.strength} height={5} fading={dim} /></div>
                  <span style={{ fontSize: 11, color: sl.c, width: 38 }}>{sl.t}</span>
                </div>

                <span onClick={(e) => { e.stopPropagation(); onOpenCon && onOpenCon(n.con); }} title="在星图中聚焦该星域"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-2)', minWidth: 0 }}>
                  <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: D.conColor(n.con), boxShadow: `0 0 6px ${D.conColor(n.con)}` }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{D.conName(n.con)}</span>
                </span>

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: reviewColor(n.nextReview) }}>{n.nextReview}</span>

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}><Icon name="link" size={13} color="currentColor" />{n.links}</span>

                {/* hover quick actions */}
                {hov && (
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 2, paddingLeft: 28,
                      background: 'linear-gradient(90deg, transparent 0%, var(--glass-bg-strong) 32%)',
                      borderRadius: 'var(--r-md)', animation: 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
                    <IconButton name="square-arrow-out-up-right" size="sm" title="打开" onClick={() => onOpen(n.id)} />
                    <IconButton name="pen-line" size="sm" title="重命名" onClick={() => startRename(n)} />
                    <IconButton name={emberRow ? 'flame' : 'brain'} size="sm" title={emberRow ? '重燃 · 再讲透一次' : '费曼内化'} onClick={() => (onFeynman ? onFeynman(n.id) : onOpen(n.id))} />
                    <IconButton name="repeat" size="sm" title="加入复习" onClick={() => rowReview(n)} />
                    <DangerIconButton name="trash-2" title="删除" onClick={() => rowDelete(n)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ActionDialog: move-confirm / tag / review */}
      {dialog && (
        <ActionDialog icon={dialog.icon} accent={dialog.accent} title={dialog.title} confirmLabel={dialog.confirmLabel}
          confirmDisabled={dialog.body === 'tag' ? !tagDraft.trim() : dialog.body === 'pickCon' ? !moveTarget : false}
          onClose={() => { setDialog(null); setMoveTarget(null); }}
          onYes={() => dialog.onYes(dialog.body === 'tag' ? tagDraft : dialog.body === 'pickCon' ? moveTarget : undefined)}>
          {dialog.body === 'review' && (
            <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-2)' }}>把已选的 <span style={{ color: 'var(--gold)' }}>{dialog.ids.length}</span> 颗星加入复习队列，下次复习将提前到「明天」。</div>
          )}
          {dialog.body === 'tag' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>为已选的 {dialog.ids.length} 颗星添加一个标签：</div>
              <Input icon="hash" placeholder="输入标签名…" size="sm" value={tagDraft} onChange={(e) => setTagDraft(e && e.target ? e.target.value : (e || ''))} />
              {allTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {allTags.slice(0, 8).map(t => <Tag key={t} onClick={() => setTagDraft(t)}>#{t}</Tag>)}
                </div>
              )}
            </div>
          )}
          {dialog.body === 'pickCon' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>把已选的 {dialog.ids.length} 颗星移动到：</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {D.constellations.map(c => (
                  <MenuRow key={c.id} active={moveTarget === c.id} onClick={() => setMoveTarget(c.id)}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />{c.name}
                    {moveTarget === c.id && <React.Fragment><span style={{ flex: 1 }} /><Icon name="check" size={14} color="var(--gold)" /></React.Fragment>}
                  </MenuRow>
                ))}
              </div>
            </div>
          )}
        </ActionDialog>
      )}

      {/* 写下第一颗星 */}
      {newStarOpen && (
        <ActionDialog icon="sparkles" accent="var(--gold)" title="写下第一颗星" confirmLabel="点亮"
          confirmDisabled={!newStarDraft.trim()}
          onClose={() => setNewStarOpen(false)} onYes={createFirstStar}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>给它一个名字——一个概念、一条公式、一个此刻想留住的念头。</div>
          <Input icon="sparkles" placeholder="例如「傅里叶变换」…" size="sm" autoFocus value={newStarDraft}
            onChange={(e) => setNewStarDraft(e && e.target ? e.target.value : (e || ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createFirstStar(); } }} />
        </ActionDialog>
      )}

      {/* danger confirm (delete) */}
      {confirm && ConfirmDialog && (
        <ConfirmDialog message={confirm.message} confirmLabel={confirm.confirmLabel} onYes={confirm.onYes} onClose={() => setConfirm(null)} />
      )}

      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 130, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
          <GlassPanel strong radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px' }}>
            <Icon name="check" size={16} color="var(--gold)" /><span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{toast}</span>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

// A trash/danger icon control with warm low-sat danger tint on hover.
function DangerIconButton({ name, title, onClick }) {
  const [h, setH] = React.useState(false);
  return (
    <button type="button" aria-label={title} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)',
        border: '1px solid', borderColor: h ? 'rgba(232,145,122,0.4)' : 'transparent', background: h ? 'rgba(232,145,122,0.12)' : 'transparent', cursor: 'pointer', transition: 'all var(--dur-fast)' }}>
      <Icon name={name} size={16} color={h ? 'var(--danger)' : 'var(--text-3)'} />
    </button>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { ListView });
