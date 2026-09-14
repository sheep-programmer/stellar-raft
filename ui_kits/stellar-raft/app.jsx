/* App — orchestrates the Stellar Raft kit as one interactive click-through.
   star map ⇄ list ⇄ editor ⇄ inbox ⇄ timeline, with Feynman drawer, ignite,
   aerial heat map, ⌘K command palette and a 知识体检 report — all via the sidebar. */
const { Sidebar, StarMap, AerialView, FeynmanDrawer, ListView, Editor, Inbox, Timeline, CommandPalette, Checkup, Galaxy3D, Settings, AIConfig, BlackHole, VisitView, ReviewSession, Onboarding, OnboardingTour, LoginView, KeysHelp, AdminConsole, AdminHandover, Boundary, AnnouncementBanner, MobileTopBar, MobileTabBar, MobileDrawer, useScreen } = window.SRKit;
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
  const [keysHelp, setKeysHelp] = React.useState(false); // 快捷键速查面板
  const [onboard, setOnboard] = React.useState(false); // 新手引导册
  const [tour, setTour] = React.useState(false);       // 聚光实地导览
  const [login, setLogin] = React.useState(false);
  const [authKnown, setAuthKnown] = React.useState(false); // 登录态尘埃落定前引导不闪现     // 全屏登录/注册页
  const [dataRev, setDataRev] = React.useState(0); // 数据库水合后整体重挂载
  const [banner, setBanner] = React.useState(null);  // 管理员发布的全站公告
  const [blocked, setBlocked] = React.useState(null); // { kind: 'banned' | 'maintenance', message }
  const [handover, setHandover] = React.useState(false); // 出厂管理员未交接：强制换用户名与密码
  /* 崩溃兜底卡的重置计数：Boundary 是类组件，错误态只能靠 key 变化重挂载来清。
     光靠 view 拼 key 不够——最常见的崩溃恰恰是默认视图星图自己崩了，此时
     backToMap() 不改变 view，key 不变，那颗「回到星图」就是个死键。 */
  const [boundaryNonce, setBoundaryNonce] = React.useState(0);
  const [drawer, setDrawer] = React.useState(false);   // 手机：侧栏抽屉
  const nonce = React.useRef(0);

  // 断点：phone 走抽屉 + 底部标签栏那一套；平板与桌面保持常驻侧栏
  const scr = useScreen();
  const phone = scr.phone;
  const closeDrawer = React.useCallback(() => setDrawer(false), []);
  // 换到桌面宽度时把抽屉收掉，否则遮罩会挂在一个已经常驻的侧栏上
  React.useEffect(() => { if (!phone) setDrawer(false); }, [phone]);

  const openLogin = () => setLogin(true);
  const closeLogin = () => { try { localStorage.setItem('sr.login.skipped', '1'); } catch (e) {} setLogin(false); };

  React.useEffect(() => {
    /* 正在编辑的那颗星在水合后还活着，就别把人弹出编辑器——409 收敛也走这条路：
       另一台设备保存的瞬间本端在打字，以前直接 editing=null，人被扔到 stars[0]
       （星空为空时甚至崩给 Boundary）。内容按服务器真相刷新（toast 已告知），
       但「我在哪篇笔记」不该被没收。星真的没了（对端删了它）才放手。 */
    const h = () => {
      setDataRev(r => r + 1);
      setSelected(null);
      setEditing(id => (id && window.SR_DATA && window.SR_DATA.stars.some(s => s.id === id)) ? id : null);
    };
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
      if (A && A.registered !== undefined) setAuthKnown(true);   // 服务器已表态，登录/引导取舍已定
    };
    h();   // 补查：本地后端很快，sr-hydrated 可能早于 React 挂载已经发过
    const settled = () => { h(); setAuthKnown(true); };          // 水合尘埃落定（含离线 startFresh 路径）
    window.addEventListener('sr-hydrated', settled);
    const t = setTimeout(() => setAuthKnown(true), 3000);        // 兜底：事件早于挂载已发过且后端离线
    return () => { window.removeEventListener('sr-hydrated', settled); clearTimeout(t); };
  }, []);

  /* 全站公告：管理员在管理台发布后，所有人下次握手就带回来。
     同一条公告只提醒一次——按内容指纹记在本机，读过就不再挡视线；
     管理员改了文案（指纹变化）会重新出现。 */
  React.useEffect(() => {
    const h = () => {
      const a = window.SR_DATA && window.SR_DATA.site && window.SR_DATA.site.announcement;
      if (!a || !a.text) { setBanner(null); return; }
      let dismissed = '';
      try { dismissed = localStorage.getItem('sr.notice.read') || ''; } catch (e) {}
      setBanner(dismissed === a.text ? null : a);
    };
    h();
    window.addEventListener('sr-site', h);
    return () => window.removeEventListener('sr-site', h);
  }, []);
  const dismissBanner = () => {
    try { localStorage.setItem('sr.notice.read', banner.text); } catch (e) {}
    setBanner(null);
  };

  // 账号被停用 / 全站维护：服务器关门的那一刻由 SRNet 广播，这里换上一张说明页
  React.useEffect(() => {
    const h = (e) => setBlocked(e.detail || null);
    window.addEventListener('sr-blocked', h);
    return () => window.removeEventListener('sr-blocked', h);
  }, []);

  /* 星港交接：管理员账号还在用出厂凭据（用户名与密码都是公开知识）时，
     一登录就把交接卡请出来，换完之前不放行。判据由服务器随 /api/hello 下发
     （site.defaultPass，只发给管理员），交接成功后 AdminHandover 广播 sr-account。 */
  React.useEffect(() => {
    const h = () => {
      const A = window.SR_DATA && window.SR_DATA.account;
      setHandover(!!(A && A.admin && A.defaultPass));
    };
    h();
    window.addEventListener('sr-site', h);
    window.addEventListener('sr-account', h);
    window.addEventListener('sr-hydrated', h);
    return () => {
      window.removeEventListener('sr-site', h);
      window.removeEventListener('sr-account', h);
      window.removeEventListener('sr-hydrated', h);
    };
  }, []);

  // 游客撞上功能门禁（SRGate.require）：直接把登录页请出来，人已经在门口了
  React.useEffect(() => {
    const h = () => setLogin(true);
    window.addEventListener('sr-need-login', h);
    return () => window.removeEventListener('sr-need-login', h);
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
        if (reviewOpen || onboard || tour || login || handover || feynman) return;
        e.preventDefault(); setCmd(c => !c);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [reviewOpen, onboard, tour, login, handover, feynman]);

  // ? 打开快捷键速查（Shift+/）——正在输入框 / 可编辑区里打问号不受影响；
  // 已有弹层置顶时不叠开（同 ⌘K 的互斥语义，速查自带 Esc / 点遮罩关闭）
  React.useEffect(() => {
    const h = (e) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (cmd || settingsOpen || aiConfigOpen || reviewOpen || onboard || tour || login || keysHelp || handover || feynman) return;
      e.preventDefault(); setKeysHelp(true);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cmd, settingsOpen, aiConfigOpen, reviewOpen, onboard, tour, login, keysHelp, handover, feynman]);

  // Esc 统一词汇：同一动作（离开当前浮层）在所有屏幕说同一句话。
  // 命令面板 / 设置 / AI 配置 / 复习会话自带 Esc，这里让位；
  // 捕获阶段处理费曼抽屉——抽屉永远盖在视图内浮层（菜单、摘要卡）之上，Esc 先关它；
  // 体检报告自身无键盘处理，Esc 在这里统一返回星图。
  // 鸟瞰 / 三维星系的 Esc 在各自组件内（它们检查 e.defaultPrevented 协调层叠）。
  React.useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (cmd || settingsOpen || aiConfigOpen || reviewOpen || onboard || tour || login || keysHelp || handover) return;
      if (feynman) { e.preventDefault(); setFeynman(null); return; }
      if (view === 'checkup' || view === 'admin') { e.preventDefault(); freshen(); setView('map'); setAerial(false); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [cmd, settingsOpen, aiConfigOpen, reviewOpen, onboard, tour, login, keysHelp, handover, feynman, view]);

  // 切换视图前按真实时间重算全部星的 R（衰减模型），新挂载的视图读到的是当下的亮度
  const freshen = () => { const D = window.SR_DATA; if (D && D.refreshMemory) D.refreshMemory(); };

  // 星际跃迁遮罩（srTransition.flight）只留给「大跳转」——目前仅编辑器右栏的
  // 「探索星系」。高频操作（侧栏切视图、开关编辑器、复习、返回星图）一律直接
  // 切换：<main> 按视图 key 重挂载自带 .sr-view-enter 轻量入场，不挡操作。
  const warp = (fn) => {
    const T = window.srTransition;
    if (T && T.flight) T.flight(fn); else fn();
  };

  // 视图切换统一收掉费曼抽屉——抽屉属于打开它的那个上下文，不跨视图滞留。
  // 编辑器与星际漫游是可门禁的功能：游客点进来先被请去登录（门禁由管理台掌控，
  // 关掉之后这两行就是透明的）。
  const openEditor = (id) => {
    if (!window.SRGate.require('editor', '写笔记')) return;
    freshen(); setFeynman(null); setEditing(id); setView('editor'); setAerial(false);
  };
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
    if (v === 'visit' && !window.SRGate.require('visit', '星际漫游')) return;
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
  // 聚光导览的领航员：导览走到某板块时替它切视图。编辑器要有星才进得去
  // （返回 false 表示该步进不了，导览会略过它）；导览结束一律送回星图。
  const tourNavigate = (v) => {
    if (v === 'map') { backToMap(); return true; }
    if (v === 'aerial') { openView('aerial'); return true; }
    if (v === 'editor') {
      const D = window.SR_DATA;
      if (D && D.stars && D.stars.length) { openEditor(D.stars[0].id); return true; }
      return false;
    }
    openView(v); return true;
  };
  const closeTour = () => { setTour(false); backToMap(); };
  const replayGuide = () => { setSettingsOpen(false); setOnboard(true); };
  /* 手机顶部条的标题 / 副标题，以及底部标签栏的角标。
     角标口径与侧边栏完全一致（同样读 D.dueStars / D.inbox + 未领取来信），
     两处导航不会各说各话；随 sr-data / sr-memory 心跳刷新。 */
  // 依赖里放的是计数值 tick，不是 dispatch——dispatch 是稳定引用，
  // 拿它当依赖等于把这个 memo 焊死，角标永远停在第一次算出来的数
  const [tick, tabTick] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!phone) return;
    ['sr-data', 'sr-memory', 'sr-friends'].forEach(e => window.addEventListener(e, tabTick));
    return () => ['sr-data', 'sr-memory', 'sr-friends'].forEach(e => window.removeEventListener(e, tabTick));
  }, [phone]);
  const tabCounts = React.useMemo(() => {
    const D = window.SR_DATA;
    if (!D) return { due: 0, inbox: 0 };
    return {
      due: D.dueStars ? D.dueStars().length : 0,
      inbox: (D.inbox ? D.inbox.length : 0) + (D.unclaimedMail ? D.unclaimedMail() : 0),
    };
  }, [phone, view, dataRev, tick]);   // eslint-disable-line react-hooks/exhaustive-deps
  const VIEW_TITLES = {
    map: ['星图', '记得越牢，越亮'], list: ['列表', null], timeline: ['时间轴', null],
    inbox: ['收件箱', null], blackhole: ['黑洞', null], visit: ['星际漫游', null],
    checkup: ['知识体检', null], galaxy3d: ['三维星系', null], admin: ['星港管理台', null],
  };
  const [viewTitle, viewSub] = (aerial ? ['亮度鸟瞰', null] : (VIEW_TITLES[view] || ['星图', null]));

  // 稳定 ref：只在 <main> 真正重挂载（key 变化）时触发入场动画；
  // 内联箭头 ref 每次渲染都会重跑 enter，任何 setState 都会闪一次入场
  const mainEnter = React.useCallback((el) => { const T = window.srTransition; if (el && T && T.enter) T.enter(el); }, []);

  /* 停用 / 维护 / 登录失效：整屏说明页。停用是终局（只能退出登录换个身份），
     维护是暂时的（留一颗「再试一次」按钮，恢复了就能进来），登录失效则是这台设备
     的钥匙没了——管理员请你下线、账号被删、或者太久没露面被判过期，重新登录即可。
     三种情况本机星空都完好——离线编辑照常，恢复后自动补写。 */
  if (blocked) {
    const banned = blocked.kind === 'banned';
    const expired = blocked.kind === 'expired';
    const ICON = { banned: 'user-x', expired: 'key-round', maintenance: 'construction' };
    const TITLE = { banned: '这个账号已被停用', expired: '这台设备的登录已失效', maintenance: '星图正在维护' };
    const SUB = {
      banned: '如有疑问，请联系这台服务器的管理员。',
      expired: '可能是管理员请你重新登录，也可能是这个登录态太久没用过了。重新登录就好。',
      maintenance: '稍后回来看看。',
    };
    const kind = blocked.kind === 'banned' || blocked.kind === 'expired' ? blocked.kind : 'maintenance';
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'radial-gradient(1200px 800px at 78% -10%, rgba(26,35,80,0.55), transparent 60%), linear-gradient(180deg, #05060f 0%, #03040c 55%, #04050e 100%)',
      }}>
        <div style={{ width: 420, maxWidth: '94vw', textAlign: 'center' }}>
          <GlassPanel strong radius="lg" glow style={{ padding: '34px 28px 26px' }}>
            <Icon name={ICON[kind]} size={30} color={banned ? 'var(--danger)' : 'var(--gold)'} />
            <div style={{ fontSize: '1.1875rem', fontWeight: 300, color: 'var(--text-1)', marginTop: 16 }}>
              {TITLE[kind]}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginTop: 12, lineHeight: 1.8 }}>
              {expired ? SUB.expired : (blocked.message || SUB[kind])}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 14, lineHeight: 1.7 }}>
              你在本机的星空完好无损，什么都没有丢。
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 22 }}>
              {kind === 'maintenance' && <Button variant="primary" icon="refresh-cw" onClick={() => location.reload()}>再试一次</Button>}
              {/* 登录失效走的也是 logoutFlow：它正好做了该做的三件事——
                  换回一把全新的匿名令牌、清掉上一个身份的本地痕迹、整页刷新落到登录页 */}
              <Button variant={kind === 'maintenance' ? 'ghost' : 'primary'} icon={expired ? 'log-in' : 'log-out'}
                onClick={() => window.SRNet.logoutFlow()}>{expired ? '重新登录' : '退出登录'}</Button>
            </div>
          </GlassPanel>
        </div>
      </div>
    );
  }

  /* 侧栏：桌面/平板常驻，手机收进抽屉。两处渲染的是同一个组件、同一份状态——
     手机上任选一个目的地就顺手把抽屉关掉，不必再点一次遮罩。 */
  const sidebar = (
    <Sidebar
      collapsed={phone ? false : collapsed} onToggle={() => (phone ? setDrawer(false) : setCollapsed(c => !c))}
      view={view === 'editor' ? 'map' : view} onView={(v) => { closeDrawer(); openView(v); }}
      focus={focus} onFocus={(id) => { closeDrawer(); focusCon(id); }}
      theme={theme} onToggleTheme={toggleTheme}
      onSearch={() => { closeDrawer(); setCmd(true); }}
      onCheckup={() => { closeDrawer(); openView('checkup'); }}
      onAIConfig={() => { closeDrawer(); setAiConfigOpen(true); }}
      onReview={() => { closeDrawer(); openReview(); }}
      onOpenSettings={() => { closeDrawer(); setSettingsOpen(true); }}
      onAdmin={() => { closeDrawer(); openView('admin'); }}
      mobile={phone}
    />
  );

  return (
    <div key={dataRev} style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {!phone && sidebar}
      {phone && <MobileDrawer open={drawer} onClose={closeDrawer}>{sidebar}</MobileDrawer>}
      {/* 手机顶部条：编辑器自带返回与标题，不叠第二层；复习/引导是模态，也不需要 */}
      {phone && view !== 'editor' && (
        <MobileTopBar title={viewTitle} sub={viewSub} onMenu={() => setDrawer(true)} onSearch={() => setCmd(true)} />
      )}

      {/* main stage — key 随视图变化：换视图重挂载一次，用 srTransition.enter 做
          元素级入场（淡入 + 上浮，240ms var(--ease-flight)，reduced-motion 直达）。
          必须用 enter()（动画结束摘类）而不是常驻 className：带 transform 的动画
          fill:both 会让 <main> 永久成为 position:fixed 的包含块，视图内所有 fixed
          弹层（摘要卡 / 右键菜单）的坐标系就从视口变成 main，整体偏移一个侧栏宽度 */}
      <main key={`${view}|${aerial ? 'a' : ''}|${view === 'editor' ? editing : ''}`}
        ref={mainEnter}
        style={{
          flex: 1, minWidth: 0, position: 'relative', display: 'flex',
          // 手机上给顶部条与底部标签栏让位（编辑器没有顶部条，也不挂标签栏——
          // 键盘弹起时底部栏只会碍事）
          paddingTop: phone && view !== 'editor' ? 'calc(var(--sr-topbar) + var(--sr-safe-top))' : 0,
          paddingBottom: phone && view !== 'editor' ? 'calc(var(--sr-tabbar) + var(--sr-safe-bottom))' : 0,
          boxSizing: 'border-box',
        }}>
        {/* 视图层的崩溃兜底：一个视图崩了，侧栏与其它视图照常可用。
            key 跟着视图走——换个目的地就重挂载一次，不必手动清掉错误态。 */}
        <Boundary key={`b|${view}|${aerial ? 'a' : ''}|${boundaryNonce}`} title={`「${viewTitle}」`}
          onReset={() => { setSelected(null); setEditing(null); backToMap(); setBoundaryNonce(n => n + 1); }}>
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
        {view === 'admin' && <AdminConsole onClose={backToMap} />}
        </Boundary>

        {/* 抽屉也各自兜底：它盖在视图之上、却不属于任何一个视图，
            崩了不该把整棵树带走——收起抽屉就该回到原来那个视图 */}
        {feynman && (
          <Boundary key={`fey|${feynman}`} title="「费曼讲解」" resetLabel="收起抽屉" onReset={() => setFeynman(null)}>
            <FeynmanDrawer starId={feynman} onClose={() => setFeynman(null)} onOpenAIConfig={() => setAiConfigOpen(true)} />
          </Boundary>
        )}

        {/* 手机上的底部标签栏：贴在 main 内部，跟着安全区走 */}
        {phone && view !== 'editor' && (
          <MobileTabBar view={aerial ? 'map' : view} onView={openView} onReview={openReview}
            onMore={() => setDrawer(true)} drawerOpen={drawer}
            dueN={tabCounts.due} inboxN={tabCounts.inbox} />
        )}

        {/* 全站公告：浮在舞台顶部居中，不占版面、不挡操作，读过一次就不再出现 */}
        {banner && (
          <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 40, padding: '0 20px' }}>
            <div style={{ maxWidth: 620, width: '100%', pointerEvents: 'auto', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
              <AnnouncementBanner announcement={banner} onDismiss={dismissBanner} />
            </div>
          </div>
        )}
      </main>

      {/* 结束页回看里点「打开笔记」：会话是模态，得先收起来，否则编辑器开在它底下看不见 */}
      {reviewOpen && <ReviewSession onClose={closeReview} onOpenStar={(id) => { closeReview(); openEditor(id); }} />}

      {cmd && <CommandPalette onClose={() => setCmd(false)} onOpenStar={openEditor} onOpenView={openView} onFocusCon={focusCon} />}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} theme={theme} onToggleTheme={toggleTheme} onReplayGuide={replayGuide} onOpenLogin={() => { setSettingsOpen(false); openLogin(); }} />}
      {aiConfigOpen && <AIConfig onClose={() => setAiConfigOpen(false)} />}
      {keysHelp && <KeysHelp onClose={() => setKeysHelp(false)} />}
      {/* 登录页与新手引导的焦点圈禁互斥：登录优先，登录页出现时引导整体让位（卸载），避免 Tab 焦点陷阱与 Esc 冲突 */}
      {onboard && !login && !handover && authKnown && <Onboarding onClose={finishOnboard} onSpotlight={startTour} />}
      {tour && !login && <OnboardingTour onClose={closeTour} onNavigate={tourNavigate} />}
      {login && <LoginView onClose={closeLogin} />}
      {/* 星港交接卡：压在所有浮层之上，交接完成前关不掉（唯一出口是退出登录） */}
      {handover && <AdminHandover onDone={() => setHandover(false)} />}
    </div>
  );
}

/* 根层的最后一道防线：连侧栏、断点、水合这些外围也崩了的时候，至少还有一张
   说明卡和一颗刷新键——而不是一整屏无从解释的黑。 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <Boundary title="星图"><App /></Boundary>
);
if (window.lucide) window.lucide.createIcons();
