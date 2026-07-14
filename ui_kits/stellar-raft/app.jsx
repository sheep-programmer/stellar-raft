/* App — orchestrates the Stellar Raft kit as one interactive click-through.
   star map ⇄ list ⇄ editor ⇄ inbox ⇄ timeline, with Feynman drawer, ignite,
   aerial heat map, ⌘K command palette and a 知识体检 report — all via the sidebar. */
const { Sidebar, StarMap, AerialView, FeynmanDrawer, ListView, Editor, Inbox, Timeline, CommandPalette, Checkup, Galaxy3D, Settings, AIConfig, BlackHole, VisitView, ReviewSession, Onboarding, OnboardingTour, LoginView } = window.SRKit;
const { GlassPanel, Icon, IconButton, Button, MemoryBar } = window.StellarRaftDesignSystem_2866af;

function App() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [view, setView] = React.useState('map');     // map | list | editor | inbox | timeline | checkup | galaxy3d
  const [selected, setSelected] = React.useState(null);
  const [focus, setFocus] = React.useState('qm');
  const [focusReq, setFocusReq] = React.useState(null); // {con, n} — ask the map to fly to a constellation
  const [aerial, setAerial] = React.useState(false);
  const [feynman, setFeynman] = React.useState(null); // starId or null
  const [editing, setEditing] = React.useState(null); // starId or null
  const [theme, setTheme] = React.useState('night');   // night | dawn
  const [cmd, setCmd] = React.useState(false);         // command palette open
  const [settingsOpen, setSettingsOpen] = React.useState(false); // 个人设置 modal
  const [reviewOpen, setReviewOpen] = React.useState(false);     // 复习会话（间隔重复）
  const [aiConfigOpen, setAiConfigOpen] = React.useState(false); // AI 配置 modal
  const [onboard, setOnboard] = React.useState(false); // 新手引导册
  const [tour, setTour] = React.useState(false);       // 聚光实地导览
  const [login, setLogin] = React.useState(false);     // 全屏登录/注册页
  const [dataRev, setDataRev] = React.useState(0); // 数据库水合后整体重挂载
  const nonce = React.useRef(0);

  const openLogin = () => setLogin(true);
  const closeLogin = () => { try { localStorage.setItem('sr.login.skipped', '1'); } catch (e) {} setLogin(false); };

  React.useEffect(() => {
    const h = () => { setDataRev(r => r + 1); setSelected(null); setEditing(null); };
    window.addEventListener('sr-hydrated', h);
    return () => window.removeEventListener('sr-hydrated', h);
  }, []);

  // 首启：水合完成后，服务器确认「未注册」且用户没跳过 → 弹全屏登录页
  // （account.registered 仅在服务器 hello 成功后才为 false；后端未运行时是 undefined，不弹）
  React.useEffect(() => {
    const h = () => {
      const A = window.SR_DATA && window.SR_DATA.account;
      let skipped = false; try { skipped = localStorage.getItem('sr.login.skipped') === '1'; } catch (e) {}
      if (A && A.registered === false && !skipped) setLogin(true);
    };
    window.addEventListener('sr-hydrated', h);
    return () => window.removeEventListener('sr-hydrated', h);
  }, []);

  // 应用挂载完成：淡出 index.html 里的静态启动帧
  React.useEffect(() => {
    const b = document.getElementById('sr-boot');
    if (b) { b.setAttribute('data-done', ''); setTimeout(() => b.remove(), 700); }
  }, []);

  // 首次打开自动弹出新手引导（看过/跳过后写标记，不再自动弹）
  React.useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem('sr.onboarded') === '1'; } catch (e) {}
    if (!seen) setOnboard(true);
  }, []);

  // 主题切换：300ms 全局 crossfade（transition.js 注入的 html 层过渡类；
  // reduced-motion / 关动效时 themeCrossfade 内部瞬切，不加类）
  const toggleTheme = () => {
    const T = window.srTransition;
    if (T && T.themeCrossfade) T.themeCrossfade();
    setTheme(t => t === 'dawn' ? 'night' : 'dawn');
  };

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dawn' ? 'dawn' : '';
  }, [theme]);

  // ⌘K / Ctrl+K opens the command palette anywhere —
  // 复习会话是模态：进行中不叠命令面板，避免按键穿透到会话里误评分
  React.useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        if (reviewOpen || onboard || tour || login) return;
        e.preventDefault(); setCmd(c => !c);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [reviewOpen, onboard, tour, login]);

  // Esc 统一词汇：同一动作（离开当前浮层）在所有屏幕说同一句话。
  // 命令面板 / 设置 / AI 配置 / 复习会话自带 Esc，这里让位；
  // 捕获阶段处理费曼抽屉——抽屉永远盖在视图内浮层（菜单、摘要卡）之上，Esc 先关它；
  // 体检报告自身无键盘处理，Esc 在这里统一返回星图。
  // 鸟瞰 / 三维星系的 Esc 在各自组件内（它们检查 e.defaultPrevented 协调层叠）。
  React.useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (cmd || settingsOpen || aiConfigOpen || reviewOpen || onboard || tour || login) return;
      if (feynman) { e.preventDefault(); setFeynman(null); return; }
      if (view === 'checkup') { e.preventDefault(); freshen(); setView('map'); setAerial(false); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [cmd, settingsOpen, aiConfigOpen, reviewOpen, onboard, tour, login, feynman, view]);

  // 切换视图前按真实时间重算全部星的 R（衰减模型），新挂载的视图读到的是当下的亮度
  const freshen = () => { const D = window.SR_DATA; if (D && D.refreshMemory) D.refreshMemory(); };

  // 星际跃迁遮罩（srTransition.flight）只留给「大跳转」——目前仅编辑器右栏的
  // 「探索星系」。高频操作（侧栏切视图、开关编辑器、复习、返回星图）一律直接
  // 切换：<main> 按视图 key 重挂载自带 .sr-view-enter 轻量入场，不挡操作。
  const warp = (fn) => {
    const T = window.srTransition;
    if (T && T.flight) T.flight(fn); else fn();
  };

  // 视图切换统一收掉费曼抽屉——抽屉属于打开它的那个上下文，不跨视图滞留
  const openEditor = (id) => { freshen(); setFeynman(null); setEditing(id); setView('editor'); setAerial(false); };
  const openReview = () => { freshen(); setFeynman(null); setReviewOpen(true); };
  const closeReview = () => { setReviewOpen(false); freshen(); };
  const focusCon = (id) => {
    // 落到星图后由地图自己的镜头飞行承担这次跃迁感，无需全屏遮罩
    freshen(); setFeynman(null); setFocus(id); setView('map'); setAerial(false); setEditing(null); nonce.current += 1; setFocusReq({ con: id, n: nonce.current });
  };
  // 编辑器右栏迷你星图的「探索星系」：跃迁回星图，聚焦该星的星域并选中它
  // （选中即 StarNode 高亮 + 摘要卡随镜头打开）
  const exploreStar = (id) => {
    const D = window.SR_DATA;
    const s = D && D.byId && D.byId[id];
    if (!s) { backToMap(); return; }
    warp(() => {
      freshen(); setFeynman(null);
      setFocus(s.con); setView('map'); setAerial(false); setEditing(null);
      setSelected(id);
      nonce.current += 1; setFocusReq({ con: s.con, n: nonce.current });
    });
  };
  const openView = (v) => {
    if (v === 'aerial' ? (view === 'map' && aerial) : (v === view && !aerial && !editing)) return; // 已在目标视图，不空跳
    freshen(); setFeynman(null);
    if (v === 'aerial') { setView('map'); setAerial(true); setEditing(null); return; }
    setView(v); setAerial(false); setEditing(null);
  };
  const backToMap = () => { setView('map'); setAerial(false); setEditing(null); };

  const finishOnboard = () => {
    try { localStorage.setItem('sr.onboarded', '1'); } catch (e) {}
    setOnboard(false);
  };
  const startTour = () => { finishOnboard(); backToMap(); setTour(true); };
  const replayGuide = () => { setSettingsOpen(false); setOnboard(true); };
  // 稳定 ref：只在 <main> 真正重挂载（key 变化）时触发入场动画；
  // 内联箭头 ref 每次渲染都会重跑 enter，任何 setState 都会闪一次入场
  const mainEnter = React.useCallback((el) => { const T = window.srTransition; if (el && T && T.enter) T.enter(el); }, []);

  return (
    <div key={dataRev} style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Sidebar
        collapsed={collapsed} onToggle={() => setCollapsed(c => !c)}
        view={view === 'editor' ? 'map' : view} onView={openView}
        focus={focus} onFocus={focusCon}
        theme={theme} onToggleTheme={toggleTheme}
        onSearch={() => setCmd(true)}
        onCheckup={() => openView('checkup')}
        onAIConfig={() => setAiConfigOpen(true)}
        onReview={openReview}
        onOpenSettings={() => setSettingsOpen(true)} />

      {/* main stage — key 随视图变化：换视图重挂载一次，用 srTransition.enter 做
          元素级入场（淡入 + 上浮，240ms var(--ease-flight)，reduced-motion 直达）。
          必须用 enter()（动画结束摘类）而不是常驻 className：带 transform 的动画
          fill:both 会让 <main> 永久成为 position:fixed 的包含块，视图内所有 fixed
          弹层（摘要卡 / 右键菜单）的坐标系就从视口变成 main，整体偏移一个侧栏宽度 */}
      <main key={`${view}|${aerial ? 'a' : ''}|${view === 'editor' ? editing : ''}`}
        ref={mainEnter}
        style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex' }}>
        {view === 'map' && !aerial && (
          <StarMap selected={selected} onSelect={setSelected}
            onOpenEditor={openEditor} onFeynman={(id) => setFeynman(id)}
            onAerial={() => openView('aerial')} on3D={() => openView('galaxy3d')}
            igniteId={null} focusReq={focusReq} />
        )}
        {view === 'map' && aerial && <AerialView onClose={() => setAerial(false)} onOpenCon={focusCon} />}
        {view === 'galaxy3d' && <Galaxy3D onClose={backToMap} onOpenStar={openEditor} onFeynman={(id) => setFeynman(id)} />}
        {view === 'list' && <ListView onOpen={openEditor} onOpenCon={focusCon} onFeynman={(id) => setFeynman(id)} />}
        {view === 'editor' && <Editor key={editing} starId={editing} onBack={backToMap} onOpen={openEditor} onExplore={exploreStar} />}
        {view === 'inbox' && <Inbox onFocusCon={focusCon} onOpen={openEditor} />}
        {view === 'blackhole' && <BlackHole onOpenCon={focusCon} />}
        {view === 'visit' && <VisitView />}
        {view === 'timeline' && <Timeline onOpen={openEditor} />}
        {view === 'checkup' && <Checkup onClose={backToMap} onOpenStar={openEditor} onFocusCon={focusCon} onFeynman={(id) => setFeynman(id)} onReview={openReview} />}

        {feynman && <FeynmanDrawer starId={feynman} onClose={() => setFeynman(null)} />}
      </main>

      {reviewOpen && <ReviewSession onClose={closeReview} />}

      {cmd && <CommandPalette onClose={() => setCmd(false)} onOpenStar={openEditor} onOpenView={openView} onFocusCon={focusCon} />}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} theme={theme} onToggleTheme={toggleTheme} onReplayGuide={replayGuide} />}
      {aiConfigOpen && <AIConfig onClose={() => setAiConfigOpen(false)} />}
      {onboard && <Onboarding onClose={finishOnboard} onSpotlight={startTour} />}
      {tour && <OnboardingTour onClose={() => setTour(false)} />}
      {login && <LoginView onClose={closeLogin} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
if (window.lucide) window.lucide.createIcons();
