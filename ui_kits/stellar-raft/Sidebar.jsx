/* Sidebar — persistent deep-space glass nav. Collapsible 260 ⇄ 64. */
const { IconButton, Input, ConstellationItem, Badge, Icon } = window.StellarRaftDesignSystem_2866af;

function SRLogo({ collapsed, theme }) {
  const dawn = theme === 'dawn';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span style={{ flex: 'none', display: 'inline-flex', filter: 'drop-shadow(0 0 7px rgba(255,217,138,0.35))' }}>
        <svg width="27" height="27" viewBox="0 0 26 26" fill="none">
          <rect x="0.5" y="0.5" width="25" height="25" rx="7.5" fill="#080c1c" stroke="rgba(159,198,255,0.28)" />
          <path d="M7.5 9 L16.5 7 L19 16.5 L11 18.5" stroke="rgba(159,198,255,0.5)" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M7.5 9 L11 18.5" stroke="rgba(255,217,138,0.55)" strokeWidth="0.8" strokeLinecap="round" />
          <circle cx="7.5" cy="9" r="1.35" fill="#d6e6ff" />
          <circle cx="19" cy="16.5" r="1.15" fill="#9fc6ff" />
          <circle cx="11" cy="18.5" r="1.1" fill="#9fc6ff" />
          <circle cx="16.5" cy="7" r="3.4" fill="#ffd98a" opacity="0.22" />
          <circle cx="16.5" cy="7" r="1.8" fill="#ffe9b0" />
        </svg>
      </span>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={dawn
            ? { fontSize: 19, fontWeight: 400, letterSpacing: '0.06em', color: '#b3781a' }
            : {
                fontSize: 19, fontWeight: 300, letterSpacing: '0.06em',
                background: 'linear-gradient(176deg, #fff3da 0%, #ffffff 30%, #e9f0ff 62%, #b6cbf2 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 10px rgba(159,198,255,0.2))',
              }}>星图</span>
          <span style={{ fontSize: 8.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Stellar Raft</span>
        </div>
      )}
    </div>
  );
}

function NavRow({ icon, label, active, badge, collapsed, onClick, dawn, tip }) {
  const [hover, setHover] = React.useState(false);
  const lit = active || hover;
  const idle = dawn ? 'rgba(22,30,56,0.82)' : 'rgba(159,198,255,0.72)';
  return (
    <button type="button" className="sr-focus-ring" onClick={onClick} data-tip={collapsed ? label : undefined}
      title={collapsed ? undefined : tip}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%', height: 40,
        padding: collapsed ? 0 : '0 11px', justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 'var(--r-sm)', cursor: 'pointer', position: 'relative',
        border: '1px solid', borderColor: active ? 'var(--glass-border-strong)' : 'transparent',
        background: active ? 'rgba(159,198,255,0.08)' : (hover ? 'rgba(159,198,255,0.05)' : 'transparent'),
        color: active ? 'var(--gold)' : (lit ? 'var(--text-1)' : idle),
        transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)',
      }}>
      <Icon name={icon} size={19} color="currentColor" />
      {!collapsed && <span style={{ flex: 1, textAlign: 'left', fontSize: 13.5, color: lit && !active ? 'var(--text-1)' : 'inherit' }}>{label}</span>}
      {!collapsed && badge != null && <Badge tone={active ? 'gold' : 'blue'}>{badge}</Badge>}
      {collapsed && badge != null && <span style={{ position: 'absolute', top: 5, right: 9 }}><Badge dot tone="gold" /></span>}
    </button>
  );
}

/* footer user chip — opens personal settings on click */
function UserChip({ collapsed, dawn, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" className="sr-focus-ring" onClick={onClick} title="个人设置"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: collapsed ? 0 : '6px 8px', justifyContent: collapsed ? 'center' : 'flex-start',
        marginTop: 2, cursor: 'pointer', borderRadius: 'var(--r-sm)', border: '1px solid transparent',
        borderColor: hover ? 'var(--glass-border-strong)' : 'transparent',
        background: hover ? 'rgba(159,198,255,0.05)' : 'transparent',
        transition: 'background var(--dur-fast), border-color var(--dur-fast)',
      }}>
      <span style={{ width: 28, height: 28, flex: 'none', borderRadius: '50%', background: dawn ? 'linear-gradient(140deg, #8ea2cc, #b6c3dc)' : 'linear-gradient(140deg, #2a3566, #56689c)', border: '1px solid var(--glass-border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: dawn ? '#1a2238' : 'var(--text-1)' }}>{window.SR_DATA.account.avatar}</span>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0, textAlign: 'left' }}>
          <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{window.SR_DATA.account.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>连续点亮 {window.SR_DATA.account.streak} 天</span>
        </div>
      )}
      {!collapsed && <div style={{ flex: 1 }} />}
      {!collapsed && <Icon name="settings" size={15} color={hover ? 'var(--text-1)' : 'var(--text-3)'} />}
    </button>
  );
}

function Sidebar({ collapsed, onToggle, view, onView, focus, onFocus, theme, onToggleTheme, onSearch, onCheckup, onAIConfig, onOpenSettings, onReview }) {
  const D = window.SR_DATA;
  const dawn = theme === 'dawn';
  // 好友数 / 到期星数 / 黑洞·收件箱计数都随写操作变化：
  // sr-friends（好友异步取回）、sr-memory（每分钟心跳）之外，
  // 写操作（删除/恢复/建星）即时广播 sr-data——角标不再等心跳才对齐
  const [, srTick] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    window.addEventListener('sr-friends', srTick);
    window.addEventListener('sr-memory', srTick);
    window.addEventListener('sr-data', srTick);
    return () => { window.removeEventListener('sr-friends', srTick); window.removeEventListener('sr-memory', srTick); window.removeEventListener('sr-data', srTick); };
  }, []);
  // 「去造访」接线：收件箱的星系邀请广播 sr-visit-code，这里代跳星际漫游。
  // 密文已放进 sessionStorage（sr.visit.code），VisitView 挂载/收到事件时读取并预填。
  const onViewRef = React.useRef(onView); onViewRef.current = onView;
  React.useEffect(() => {
    const h = () => { if (onViewRef.current) onViewRef.current('visit'); };
    window.addEventListener('sr-visit-code', h);
    return () => window.removeEventListener('sr-visit-code', h);
  }, []);
  // 复习入口的 live 计数（样式同收件箱 / 黑洞的角标）；dueStars 口径不变
  const dueN = D.dueStars ? D.dueStars().length : 0;
  // 收件箱角标口径 = 本地捕捉 + 未领取来信（tooltip 写明白，两处计数不再各说各话）
  const mailN = D.unclaimedMail ? D.unclaimedMail() : 0;
  const inboxN = D.inbox.length + mailN;
  // 体检 = 统一今日待办：到期复习 + 待重燃 + 收件箱待整理（三行计数，due 与 ember 可重叠）
  const todo = D.todayTodo ? D.todayTodo() : null;
  const todoN = todo ? (todo.due + todo.ember + todo.inbox) : 0;
  return (
    <aside style={{
      width: collapsed ? 64 : 260, flex: 'none', height: '100%',
      display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 5,
      background: 'var(--glass-bg-strong)',
      WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.2)', backdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
      borderRight: '1px solid var(--glass-border)',
      transition: 'width var(--dur-base) var(--ease-flight)',
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: collapsed ? '0' : '0 14px', flex: 'none', justifyContent: collapsed ? 'center' : 'space-between' }}>
        <SRLogo collapsed={collapsed} theme={theme} />
        {!collapsed && <IconButton name="panel-left-close" title="折叠" onClick={onToggle} />}
      </div>
      {collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <IconButton name="panel-left-open" title="展开" onClick={onToggle} />
        </div>
      )}

      {/* search */}
      <div style={{ padding: collapsed ? '0 12px 8px' : '0 14px 10px', flex: 'none' }}>
        {collapsed
          ? <IconButton name="search" title="搜索 ⌘K" onClick={onSearch} />
          : (
            /* 搜索入口：点击 / Enter / 直接开始输入 都打开命令面板。
               readOnly 让它保持可 Tab 聚焦（Input 自带聚焦发光），
               但不再吞字——键盘用户不会把「量子」打进一个死输入框 */
            <div style={{ cursor: 'pointer' }} onClick={onSearch}>
              <Input icon="search" placeholder="搜索你的星空…" kbd="⌘K" size="sm"
                readOnly value="" aria-label="搜索你的星空（打开命令面板）"
                inputStyle={{ cursor: 'pointer' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ' || (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey)) {
                    e.preventDefault(); onSearch();
                  }
                }} />
            </div>
          )}
      </div>

      {/* views */}
      <nav style={{ padding: collapsed ? '6px 8px' : '6px 12px', display: 'flex', flexDirection: 'column', gap: 3, flex: 'none' }}>
        <NavRow icon="orbit"   label="星图视图"   active={view === 'map'}  collapsed={collapsed} dawn={dawn} onClick={() => onView('map')} />
        <NavRow icon="list"    label="列表视图"   active={view === 'list'} collapsed={collapsed} dawn={dawn} onClick={() => onView('list')} />
        <NavRow icon="git-commit-horizontal" label="时间轴视图" active={view === 'timeline'} collapsed={collapsed} dawn={dawn} onClick={() => onView('timeline')} />
        <div style={{ height: 1, background: 'var(--line)', margin: '8px 4px' }} />
        <NavRow icon="repeat"   label="复习"   badge={dueN || null} collapsed={collapsed} dawn={dawn} onClick={onReview} active={false} />
        <NavRow icon="inbox"    label="收件箱" badge={inboxN || null} tip={`本地捕捉 ${D.inbox.length} 条 + 未领取来信 ${mailN} 封`} collapsed={collapsed} dawn={dawn} onClick={() => onView('inbox')} active={view === 'inbox'} />
        <NavRow icon="aperture" label="黑洞"   badge={D.trash.length || null} collapsed={collapsed} dawn={dawn} onClick={() => onView('blackhole')} active={view === 'blackhole'} />
        <NavRow icon="telescope" label="星际漫游" badge={(D.social && D.social.friends) || null} collapsed={collapsed} dawn={dawn} onClick={() => onView('visit')} active={view === 'visit'} />
      </nav>

      {/* constellations */}
      {!collapsed && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 12px 0' }}>
          <div style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', padding: '0 6px 8px', fontFamily: 'var(--font-mono)' }}>我的星域</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {D.constellations.map(c => (
              <ConstellationItem key={c.id} name={c.name} color={c.color} count={c.count}
                active={focus === c.id} onClick={() => onFocus(c.id)} />
            ))}
          </div>
        </div>
      )}
      {collapsed && <div style={{ flex: 1 }} />}

      {/* footer */}
      <div style={{ flex: 'none', padding: collapsed ? '10px 8px' : '12px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <NavRow icon={dawn ? 'moon-star' : 'sunrise'} label={dawn ? '切回深空' : '黎明模式'} collapsed={collapsed} dawn={dawn} onClick={onToggleTheme} />
        <NavRow icon="activity" label="知识体检报告" badge={todoN || null} collapsed={collapsed} dawn={dawn} active={view === 'checkup'} onClick={onCheckup} />
        <NavRow icon="bot" label="AI 配置" collapsed={collapsed} dawn={dawn} onClick={onAIConfig} />
        <UserChip collapsed={collapsed} dawn={dawn} onClick={onOpenSettings} />
      </div>
    </aside>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { Sidebar });
