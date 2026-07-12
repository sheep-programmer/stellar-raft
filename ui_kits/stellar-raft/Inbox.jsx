/* Inbox — 收件箱：两个标签页。
   「待整理」顶部的「星际来信」：好友寄来的造访邀请（去造访 / 忽略）与赠星
   （收纳到星域 / 忽略）——消息本体在服务器（GET /api/inbox），后端未运行时
   整区隐藏不报错；收纳经 data.js 的 adoptShared 建星，从未点亮起步。
   「待整理」：随手捕捉、尚未归入任何星域的想法草稿——
   · 归入即真的创建一颗知识星（落在该星域质心附近，星图/3D 立即可见）
   · 有建议的草稿一键「按建议归入」；批量勾选后可一次归入/忽略
   · 搜索 + 「全部 / 有建议 / 无建议」过滤，长列表也好整理
   「收藏」：所有被收藏的笔记（编辑器右上角星形按钮），可直接打开、
   在星图中定位、或取消收藏。所有操作同步写回共享数据。 */
const { GlassPanel, Icon, IconButton, Button, Tag, Tabs, Badge } = window.StellarRaftDesignSystem_2866af;

// 收件箱数据变更后广播：侧栏角标（收件箱计数）与在场视图立即读到同一份真相
const inboxPulse = () => window.dispatchEvent(new CustomEvent('sr-memory'));

const INBOX_WORLD = { w: 1680, h: 1040 };

// 从随手记的一句话里取一个可做星名的短标题
function draftLabel(text) {
  const t = (text || '').replace(/^["'「『""]+/, '').trim();
  const cut = t.split(/[。：:；;！!？?\n—…]/)[0].trim();
  const s = cut || t;
  return s.length > 16 ? s.slice(0, 15) + '…' : (s || '新的知识星');
}

function Inbox({ onFocusCon, onOpen }) {
  const D = window.SR_DATA;
  const [tab, setTab] = React.useState('triage');   // triage | fav
  const [, bumpFav] = React.useReducer(x => x + 1, 0);
  const [items, setItems] = React.useState(() => D.inbox.slice());
  const [draft, setDraft] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');   // all | suggested | none
  const [sel, setSel] = React.useState([]);            // 勾选的草稿 id
  const [picker, setPicker] = React.useState(null);    // { id } 或 { batch: true }，正在选星域
  const [confirm, setConfirm] = React.useState(null);
  const [toast, setToast] = React.useState(null);      // { msg, con } — con 给「查看」用
  const seq = React.useRef(0);
  const toastTimer = React.useRef(null);
  // 带动作的 toast 多停一会儿（5s），纯文字的保持 2.6s
  const flash = (msg, con) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, con });
    toastTimer.current = setTimeout(() => setToast(null), con ? 5000 : 2600);
  };
  React.useEffect(() => () => clearTimeout(toastTimer.current), []);

  // 本地列表和共享数据一起改，角标与其它视图保持一致
  const removeItems = (ids) => {
    setItems(s => s.filter(x => !ids.includes(x.id)));
    for (let i = D.inbox.length - 1; i >= 0; i--) if (ids.includes(D.inbox[i].id)) D.inbox.splice(i, 1);
    setSel(s => s.filter(id => !ids.includes(id)));
    D.persist();
    inboxPulse();
  };

  // 快速捕捉
  const capture = () => {
    const text = draft.trim();
    if (!text) return;
    seq.current += 1;
    const item = { id: 'cap-' + seq.current, text, captured: '刚刚', suggest: null };
    setItems(s => [item, ...s]);
    D.inbox.unshift(item);
    D.persist();
    inboxPulse();
    setDraft('');
    flash('已捕捉一条草稿');
  };

  // 归入 = 真的在该星域生出一颗新星（落在星域质心附近）。
  // 新星未点亮——「点亮」是奖励保留动词，要在费曼抽屉里讲透才配得上。
  const fileOne = (it, conId) => {
    const members = D.stars.filter(s => s.con === conId);
    let wx = INBOX_WORLD.w / 2, wy = INBOX_WORLD.h / 2;
    if (members.length) {
      const px = (s) => s.wx != null ? s.wx : s.x / 100 * INBOX_WORLD.w;
      const py = (s) => s.wy != null ? s.wy : s.y / 100 * INBOX_WORLD.h;
      wx = members.reduce((a, s) => a + px(s), 0) / members.length;
      wy = members.reduce((a, s) => a + py(s), 0) / members.length;
    }
    const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 70;
    wx += Math.cos(a) * r; wy += Math.sin(a) * r;
    const id = 's' + Math.random().toString(36).slice(2, 8);
    const star = {
      id, con: conId, x: wx / INBOX_WORLD.w * 100, y: wy / INBOX_WORLD.h * 100, wx, wy,
      strength: 0.5, importance: 1, label: draftLabel(it.text),
      summary: it.text, tags: ['草稿'],
      props: { type: '草稿', status: '正常', source: '收件箱', alias: '', nextReview: '明天' },
      body: [{ id: id + '-r', type: 'rich' }, { id: id + '-p', type: 'p', text: '' }],
    };
    D.addStar(star);
    return star;
  };
  const fileTo = (ids, conId) => {
    const its = items.filter(x => ids.includes(x.id));
    its.forEach(it => fileOne(it, conId));
    removeItems(ids);
    setPicker(null);
    flash(its.length === 1
      ? '已归入 · 写下内容，讲给 AI 学生，让它自己发光。'
      : `${its.length} 颗新星已归入「${D.conName(conId)}」· 讲给 AI 学生，让它们自己发光。`, conId);
  };
  // 按各自的建议归入（批量时逐条按自己的 suggest）
  const fileBySuggest = (ids) => {
    const its = items.filter(x => ids.includes(x.id) && x.suggest);
    if (!its.length) return;
    const byCon = {};
    its.forEach(it => { fileOne(it, it.suggest); (byCon[it.suggest] = byCon[it.suggest] || []).push(it); });
    removeItems(its.map(x => x.id));
    const cons = Object.keys(byCon);
    flash(its.length === 1
      ? '已归入 · 写下内容，讲给 AI 学生，让它自己发光。'
      : `${its.length} 颗新星已按建议归入 · 讲给 AI 学生，让它们自己发光。`, cons.length === 1 ? cons[0] : null);
  };

  /* ——— 星际来信：好友寄来的造访邀请与赠星（服务端收件箱）———
     打开视图即拉取一次（GET /api/inbox 的 SRNet 便捷方法）；
     后端未运行 → 镜像保持为空，整个区块隐藏、不报错。 */
  const [, bumpMail] = React.useReducer(x => x + 1, 0);
  const [mailPicker, setMailPicker] = React.useState(null);   // 正在选星域收纳的来信 id
  React.useEffect(() => {
    if (D.refreshMail) D.refreshMail();
    const h = () => bumpMail();
    window.addEventListener('sr-data', h);   // adoptShared / 拉取成功都会广播
    return () => window.removeEventListener('sr-data', h);
  }, []);
  const mail = (D.mail && D.mail.list) || [];
  // 服务器时间是 UTC 的 'YYYY-MM-DD HH:MM:SS'，换算成「n 分钟前」
  const mailAgo = (at) => {
    const ts = Date.parse(String(at || '').replace(' ', 'T') + 'Z');
    return Number.isFinite(ts) ? D.ago(ts) : '刚刚';
  };
  const dismissMail = (m) => setConfirm({
    message: m.kind === 'galaxy'
      ? '忽略后这封造访邀请会被删除。确定忽略吗？'
      : `忽略后「${(m.payload && m.payload.label) || '这颗星'}」的赠星来信会被删除，不会成为你的星。确定忽略吗？`,
    confirmLabel: '忽略',
    onYes: () => {
      if (window.SRNet && window.SRNet.inbox) window.SRNet.inbox.ack(m.id, 'dismiss');   // 静默降级
      const i = mail.indexOf(m); if (i >= 0) mail.splice(i, 1);
      if (mailPicker === m.id) setMailPicker(null);
      window.dispatchEvent(new Event('sr-data'));   // 侧栏角标即时对齐
      flash('已忽略这封来信');
    },
  });
  // 去造访：密文放进 sessionStorage 供星际漫游预填，广播后由侧栏代跳视图
  const visitMail = (m) => {
    const code = (m.payload && m.payload.code) || '';
    try { sessionStorage.setItem('sr.visit.code', code); } catch (e) { }
    window.dispatchEvent(new CustomEvent('sr-visit-code', { detail: { code, fromId: m.from && m.from.id } }));
  };
  // 收纳赠星：payload 建星（未点亮起步），领取由 adoptShared 内部 ack('claim')
  const adoptMail = (m, conId) => {
    const star = D.adoptShared && D.adoptShared(m, conId);
    setMailPicker(null);
    if (star) flash(`已收纳「${star.label}」· 从未点亮起步，讲透它，才是你的星。`, conId);
  };

  const askDismiss = (ids) => setConfirm({
    message: ids.length === 1 ? '忽略后这条捕获会被丢弃，不会成为星。确定忽略吗？' : `确定忽略已选的 ${ids.length} 条捕获吗？它们不会成为星。`,
    confirmLabel: '忽略',
    onYes: () => { removeItems(ids); if (picker && ids.includes(picker.id)) setPicker(null); flash('已忽略'); },
  });

  const ConfirmDialog = window.SRKit && window.SRKit.ConfirmDialog;

  const q = query.trim().toLowerCase();
  const visible = items.filter(it =>
    (filter === 'all' || (filter === 'suggested' ? !!it.suggest : !it.suggest)) &&
    (!q || it.text.toLowerCase().includes(q)));
  const allChecked = visible.length > 0 && visible.every(it => sel.includes(it.id));
  const toggleAll = () => setSel(allChecked ? [] : visible.map(it => it.id));
  const toggle = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const selSuggested = sel.filter(id => { const it = items.find(x => x.id === id); return it && it.suggest; });

  const ConPicker = ({ suggest, onPick, onCancel }) => (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 9 }}>归入哪个星域？点击即成星</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {D.constellations.map(c => (
          <button type="button" key={c.id} onClick={() => onPick(c.id)} className="sr-focus-ring"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
              transition: 'all var(--dur-fast) var(--ease-flight)', font: 'inherit',
              border: '1px solid', borderColor: c.id === suggest ? 'rgba(255,217,138,0.45)' : 'var(--glass-border)',
              background: c.id === suggest ? 'rgba(255,217,138,0.08)' : 'color-mix(in srgb, var(--star-blue) 5%, transparent)',
              fontSize: 12.5, color: 'var(--text-2)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,217,138,0.55)'; e.currentTarget.style.color = 'var(--gold)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.id === suggest ? 'rgba(255,217,138,0.45)' : 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-2)'; }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />{c.name}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.7 }}>{D.stars.filter(s => s.con === c.id).length}</span>
          </button>
        ))}
        <button type="button" onClick={onCancel} className="sr-focus-ring" style={{ display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 11px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 12, font: 'inherit', color: 'var(--text-3)', background: 'transparent', border: '1px dashed var(--line-strong)' }}>取消</button>
      </div>
    </div>
  );

  return (
    <div onContextMenu={(e) => e.preventDefault()} style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'auto', padding: '28px 30px 48px' }}>
      <sr-starfield density="0.6"></sr-starfield>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 23, fontWeight: 300, color: 'var(--text-1)' }}>收件箱</div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {tab === 'triage' ? `${items.length} 条待整理` : `${D.stars.filter(s => s.fav).length} 颗收藏`}
          </span>
        </div>

        {/* 标签页：待整理 / 收藏（DS Tabs：roving tabindex，←→ 可切） */}
        <Tabs size="sm" value={tab} onChange={setTab} style={{ marginBottom: 16 }}
          tabs={[
            { id: 'triage', label: '待整理', icon: 'inbox', count: items.length },
            { id: 'fav', label: '收藏', icon: 'star', count: D.stars.filter(s => s.fav).length },
          ]} />

        {tab === 'fav' && <FavList D={D} onOpen={onOpen} onFocusCon={onFocusCon} onUnfav={(s) => { s.fav = false; D.persist(); bumpFav(); flash(`已取消收藏「${s.label}」`); }} />}

        {tab === 'triage' && <React.Fragment>
        {/* 星际来信：好友寄来的造访邀请 / 赠星，置于本地捕捉之上，有来信才显示 */}
        {mail.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 2px 3px' }}>
              <Icon name="mail" size={14} color="var(--star-blue)" style={{ alignSelf: 'center', flex: 'none' }} />
              <span style={{ fontSize: 13, color: 'var(--text-1)' }}>星际来信</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{mail.filter(m => !m.claimed).length} 封未领取</span>
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.7, color: 'var(--text-3)', margin: '0 2px 10px' }}>
              来自星际的知识，收纳后从未点亮起步——讲透它，才是你的星。
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mail.map(m => {
                const galaxy = m.kind === 'galaxy';
                const p = m.payload || {};
                const from = m.from || {};
                const open = mailPicker === m.id;
                return (
                  <GlassPanel key={'mail-' + m.id} radius="md" pad="none" style={{ padding: '13px 15px', opacity: m.claimed ? 0.62 : 1 }}>
                    <div style={{ display: 'flex', gap: 11 }}>
                      {/* 发件人头像（装饰，名字在旁边） */}
                      <span aria-hidden="true" style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', background: 'linear-gradient(140deg, #2a3566, #56689c)', border: '1px solid var(--glass-border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-1)' }}>{from.avatar || '星'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{from.name || '星际旅人'}</span>
                          {/* 类型徽标：星系邀请 / 知识星（Lucide，星蓝——金色只留给点亮） */}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--star-blue)', border: '1px solid rgba(159,198,255,0.28)', borderRadius: 'var(--r-pill)', padding: '2.5px 9px' }}>
                            <Icon name={galaxy ? 'radio-tower' : 'star'} size={11} color="currentColor" />{galaxy ? '星系邀请' : '知识星'}
                          </span>
                          {m.claimed && <Badge tone="gold">已收纳</Badge>}
                          <div style={{ flex: 1 }} />
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}><Icon name="clock" size={12} color="currentColor" />{mailAgo(m.at)}</span>
                        </div>

                        {galaxy ? (
                          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-2)', marginTop: 7 }}>
                            邀请你造访「{p.galaxyName || '一片新的星空'}」
                            {p.starCount != null && <span style={{ color: 'var(--text-3)' }}> · {p.starCount} 颗星</span>}
                            {p.code && <span style={{ display: 'block', marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.08em', color: 'var(--text-3)' }}>密文 {p.code}</span>}
                          </div>
                        ) : (
                          <div style={{ marginTop: 7 }}>
                            <div style={{ fontSize: 14.5, color: 'var(--text-1)' }}>{p.label || '一颗知识星'}</div>
                            {p.summary && <div style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-3)', marginTop: 5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.summary}</div>}
                            {!!(p.keyPoints || []).length && (
                              <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {p.keyPoints.slice(0, 4).map((k, i) => (
                                  <div key={i} style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-2)', borderLeft: '2px solid var(--line)', padding: '1px 2px 1px 9px', marginLeft: 2 }}>{k}</div>
                                ))}
                                {p.keyPoints.length > 4 && <div style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 13 }}>… 共 {p.keyPoints.length} 条要点，收纳后可见全部</div>}
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1 }} />
                          {!m.claimed && (galaxy
                            ? <Button size="sm" icon="rocket" glow onClick={() => visitMail(m)}>去造访</Button>
                            : <Button size="sm" icon="folder-input" glow onClick={() => setMailPicker(open ? null : m.id)}>收纳到星域</Button>)}
                          <Button size="sm" variant="ghost" icon="x" onClick={() => dismissMail(m)}>忽略</Button>
                        </div>
                        {open && !m.claimed && (D.constellations.length
                          ? <ConPicker onPick={(conId) => adoptMail(m, conId)} onCancel={() => setMailPicker(null)} />
                          : (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 12, lineHeight: 1.6, color: 'var(--text-3)' }}>
                              还没有星域可以安放它——先回星图创建一个星域，再来收纳这颗星。
                            </div>
                          ))}
                      </div>
                    </div>
                  </GlassPanel>
                );
              })}
            </div>
          </div>
        )}

        {/* 快速捕捉 */}
        <GlassPanel radius="md" pad="none" style={{ padding: '13px 15px', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 11 }}>
            <Icon name="feather" size={16} color="var(--star-blue)" style={{ marginTop: 6, flex: 'none' }} />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); capture(); } }}
              placeholder="随手记下一个想法、一段公式、一句灵感…"
              aria-label="快速捕捉"
              rows={2}
              style={{ flex: 1, minWidth: 0, resize: 'none', background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-1)', fontSize: 14, lineHeight: 1.7, fontFamily: 'var(--font-sans)', padding: '3px 0' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>⌘/Ctrl + Enter 捕捉</span>
            <div style={{ flex: 1 }} />
            <Button size="sm" icon="plus" glow disabled={!draft.trim()} onClick={capture}>捕捉</Button>
          </div>
        </GlassPanel>

        {/* 积压提示：捕捉不会自己变成星——与体检「今日待办」的收件箱一栏同一口径 */}
        {items.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 12px', fontSize: 12, lineHeight: 1.6, color: 'var(--text-3)' }}>
            <Icon name="info" size={13} color="var(--star-blue-dim)" style={{ flex: 'none' }} />
            <span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{items.length}</span> 条捕捉还没归入星域——归入并写下内容，它们才会成为星。
            </span>
          </div>
        )}

        {/* 工具行：过滤 + 搜索 + 全选 */}
        {items.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: '全部', n: items.length },
              { id: 'suggested', label: '有建议', n: items.filter(i => i.suggest).length },
              { id: 'none', label: '无建议', n: items.filter(i => !i.suggest).length },
            ].map(f => (
              <Tag key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, opacity: 0.8, marginLeft: 4 }}>{f.n}</span>
              </Tag>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={13} color="var(--text-3)" style={{ position: 'absolute', left: 9, top: 7 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索草稿…" aria-label="搜索草稿"
                style={{ height: 27, width: 150, boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-pill)', color: 'var(--text-1)', fontSize: 12, padding: '0 10px 0 27px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
            </div>
            <button type="button" onClick={toggleAll} title={allChecked ? '取消全选' : '全选当前列表'} className="sr-focus-ring"
              aria-pressed={allChecked}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, font: 'inherit', color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 2px' }}>
              <CheckBox checked={allChecked} />全选
            </button>
          </div>
        )}

        {/* 批量操作条 */}
        {sel.length > 0 && (
          <GlassPanel strong radius="md" pad="none" glow style={{ padding: '9px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-1)' }}>已选 <b style={{ color: 'var(--gold)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{sel.length}</b> 条</span>
            <div style={{ flex: 1 }} />
            {selSuggested.length > 0 && (
              <Button size="sm" icon="sparkles" glow onClick={() => fileBySuggest(sel)}>按建议归入 {selSuggested.length} 条</Button>
            )}
            <Button size="sm" icon="folder-input" onClick={() => setPicker({ batch: true })}>归入同一星域</Button>
            <Button size="sm" variant="ghost" icon="x" onClick={() => askDismiss(sel)}>忽略</Button>
            <Button size="sm" variant="ghost" onClick={() => setSel([])}>取消</Button>
          </GlassPanel>
        )}
        {picker && picker.batch && (
          <GlassPanel radius="md" pad="none" style={{ padding: '4px 15px 15px', marginBottom: 12 }}>
            <ConPicker onPick={(conId) => fileTo(sel, conId)} onCancel={() => setPicker(null)} />
          </GlassPanel>
        )}

        {visible.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13, padding: '54px 0 40px', color: 'var(--text-3)', textAlign: 'center' }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(159,198,255,0.06)', boxShadow: '0 0 22px rgba(159,198,255,0.10) inset' }}>
              <Icon name="inbox" size={26} color="var(--star-blue)" />
            </span>
            <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{items.length ? '没有匹配的草稿' : '收件箱已清空'}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, maxWidth: 320 }}>
              {items.length ? '换个关键词或切换过滤条件试试。' : <span>所有捕获都已整理入星域。<br />有了新念头，就在上面随手记下一颗星。</span>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map(it => {
              const open = picker && picker.id === it.id;
              const checked = sel.includes(it.id);
              return (
                <GlassPanel key={it.id} radius="md" pad="none" style={{ padding: '13px 15px', border: checked ? '1px solid rgba(255,217,138,0.35)' : undefined }}>
                  <div style={{ display: 'flex', gap: 11 }}>
                    <button type="button" onClick={() => toggle(it.id)} className="sr-focus-ring"
                      role="checkbox" aria-checked={checked} aria-label="选择这条捕获"
                      style={{ marginTop: 3, cursor: 'pointer', flex: 'none', background: 'none', border: 'none', padding: 0, display: 'inline-flex' }}>
                      <CheckBox checked={checked} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div contentEditable suppressContentEditableWarning title="点击可直接修改这条捕获" data-ph="写点什么…"
                        onBlur={(e) => {
                          const t = e.currentTarget.innerText.trim();
                          if (!t || t === it.text) { if (!t) e.currentTarget.innerText = it.text; return; }
                          setItems(s => s.map(x => x.id === it.id ? { ...x, text: t } : x));
                          const rec = D.inbox.find(x => x.id === it.id); if (rec) rec.text = t;
                          D.persist();
                          flash('已更新捕获');
                        }}
                        style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-1)', outline: 'none', cursor: 'text', caretColor: 'var(--gold)' }}>{it.text}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}><Icon name="clock" size={12} color="currentColor" />{it.captured}</span>
                        {it.suggest && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-3)' }}>
                            建议 <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(it.suggest), boxShadow: `0 0 6px ${D.conColor(it.suggest)}` }} />{D.conName(it.suggest)}
                          </span>
                        )}
                        <div style={{ flex: 1 }} />
                        {it.suggest && <Button size="sm" icon="sparkles" glow onClick={() => fileBySuggest([it.id])}>按建议归入</Button>}
                        <Button size="sm" icon="folder-input" onClick={() => setPicker(open ? null : { id: it.id })}>{it.suggest ? '换个星域' : '归入星域'}</Button>
                        <Button size="sm" variant="ghost" icon="x" onClick={() => askDismiss([it.id])}>忽略</Button>
                      </div>
                      {open && <ConPicker suggest={it.suggest} onPick={(conId) => fileTo([it.id], conId)} onCancel={() => setPicker(null)} />}
                    </div>
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        )}
        </React.Fragment>}
      </div>

      {confirm && ConfirmDialog && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onYes={() => { confirm.onYes(); setConfirm(null); }}
          onClose={() => setConfirm(null)} />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 95, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
          <GlassPanel strong radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px' }}>
            <Icon name="check" size={16} color="var(--gold)" /><span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{toast.msg}</span>
            {toast.con && onFocusCon && (
              <button type="button" onClick={() => onFocusCon(toast.con)} className="sr-focus-ring"
                style={{ fontSize: 12.5, font: 'inherit', color: 'var(--star-blue)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, borderBottom: '1px dashed rgba(159,198,255,0.5)' }}>在星图中查看</button>
            )}
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

/* 收藏标签页：所有 fav=true 的知识星 */
function FavList({ D, onOpen, onFocusCon, onUnfav }) {
  const favs = D.stars.filter(s => s.fav);
  if (!favs.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13, padding: '54px 0 40px', color: 'var(--text-3)', textAlign: 'center' }}>
        <span style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,217,138,0.06)', boxShadow: '0 0 22px rgba(255,217,138,0.10) inset' }}>
          <Icon name="star" size={26} color="var(--gold)" />
        </span>
        <div style={{ fontSize: 15, color: 'var(--text-2)' }}>还没有收藏</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.7, maxWidth: 320 }}>打开任何一颗星，点右上角的星形按钮，<br />它就会出现在这里，随手可达。</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {favs.map(s => (
        <GlassPanel key={s.id} radius="md" pad="none" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,217,138,0.08)', border: '1px solid rgba(255,217,138,0.25)' }}>
              <Icon name="star" size={15} color="var(--gold)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span onClick={() => onOpen && onOpen(s.id)} style={{ fontSize: 15.5, color: 'var(--text-1)', cursor: 'pointer' }}>{s.label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-3)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(s.con), boxShadow: `0 0 6px ${D.conColor(s.con)}` }} />{D.conName(s.con)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: s.strength >= 0.7 ? 'var(--gold)' : 'var(--star-blue-dim)' }}>记忆 {Math.round(s.strength * 100)}%</span>
              </div>
              {s.summary && <div style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-3)', marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.summary}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
                <Button size="sm" icon="maximize-2" onClick={() => onOpen && onOpen(s.id)}>打开笔记</Button>
                <Button size="sm" variant="ghost" icon="crosshair" onClick={() => onFocusCon && onFocusCon(s.con)}>在星图中定位</Button>
                <div style={{ flex: 1 }} />
                <Button size="sm" variant="ghost" icon="star-off" onClick={() => onUnfav(s)}>取消收藏</Button>
              </div>
            </div>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}

function CheckBox({ checked }) {
  const { Icon } = window.StellarRaftDesignSystem_2866af;
  return (
    <span style={{ width: 16, height: 16, borderRadius: 5, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid', borderColor: checked ? 'var(--gold)' : 'var(--line-strong)',
      background: checked ? 'var(--gold)' : 'transparent', transition: 'all var(--dur-fast)' }}>
      {checked && <Icon name="check" size={11} color="var(--text-on-gold)" />}
    </span>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { Inbox });
