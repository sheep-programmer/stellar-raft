/* App — orchestrates the Stellar Raft kit as one interactive click-through.
   star map ⇄ list ⇄ editor ⇄ inbox ⇄ timeline, with Feynman drawer, ignite,
   aerial heat map, ⌘K command palette and a 知识体检 report — all via the sidebar. */
const { Sidebar, StarMap, AerialView, FeynmanDrawer, ListView, Editor, Inbox, Timeline, CommandPalette, Checkup, Galaxy3D, Settings, AIConfig, BlackHole, VisitView } = window.SRKit;
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
  const [aiConfigOpen, setAiConfigOpen] = React.useState(false); // AI 配置 modal
  const [dataRev, setDataRev] = React.useState(0); // 数据库水合后整体重挂载
  const nonce = React.useRef(0);

  React.useEffect(() => {
    const h = () => { setDataRev(r => r + 1); setSelected(null); setEditing(null); };
    window.addEventListener('sr-hydrated', h);
    return () => window.removeEventListener('sr-hydrated', h);
  }, []);

  const toggleTheme = () => setTheme(t => t === 'dawn' ? 'night' : 'dawn');

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dawn' ? 'dawn' : '';
  }, [theme]);

  // ⌘K / Ctrl+K opens the command palette anywhere
  React.useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setCmd(c => !c); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const openEditor = (id) => { setEditing(id); setView('editor'); setAerial(false); };
  const focusCon = (id) => { setFocus(id); setView('map'); setAerial(false); setEditing(null); nonce.current += 1; setFocusReq({ con: id, n: nonce.current }); };
  const openView = (v) => {
    if (v === 'aerial') { setView('map'); setAerial(true); setEditing(null); return; }
    setView(v); setAerial(false); setEditing(null);
  };

  return (
    <div key={dataRev} style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Sidebar
        collapsed={collapsed} onToggle={() => setCollapsed(c => !c)}
        view={view === 'editor' ? 'map' : view} onView={(v) => { setView(v); setAerial(false); setEditing(null); }}
        focus={focus} onFocus={focusCon}
        theme={theme} onToggleTheme={toggleTheme}
        onSearch={() => setCmd(true)}
        onCheckup={() => { setView('checkup'); setAerial(false); setEditing(null); }}
        onAIConfig={() => setAiConfigOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)} />

      {/* main stage */}
      <main style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex' }}>
        {view === 'map' && !aerial && (
          <StarMap selected={selected} onSelect={setSelected}
            onOpenEditor={openEditor} onFeynman={(id) => setFeynman(id)}
            onAerial={() => setAerial(true)} on3D={() => { setView('galaxy3d'); setAerial(false); setEditing(null); }}
            igniteId={null} focusReq={focusReq} />
        )}
        {view === 'map' && aerial && <AerialView onClose={() => setAerial(false)} onOpenCon={focusCon} />}
        {view === 'galaxy3d' && <Galaxy3D onClose={() => { setView('map'); setAerial(false); }} onOpenStar={openEditor} onFeynman={(id) => setFeynman(id)} />}
        {view === 'list' && <ListView onOpen={openEditor} onOpenCon={focusCon} onFeynman={(id) => setFeynman(id)} />}
        {view === 'editor' && <Editor key={editing} starId={editing} onBack={() => { setView('map'); setEditing(null); }} onOpen={openEditor} />}
        {view === 'inbox' && <Inbox onFocusCon={focusCon} onOpen={openEditor} />}
        {view === 'blackhole' && <BlackHole onOpenCon={focusCon} />}
        {view === 'visit' && <VisitView />}
        {view === 'timeline' && <Timeline onOpen={openEditor} />}
        {view === 'checkup' && <Checkup onClose={() => { setView('map'); setAerial(false); }} onOpenStar={openEditor} onFocusCon={focusCon} onFeynman={(id) => setFeynman(id)} />}

        {feynman && <FeynmanDrawer starId={feynman} onClose={() => setFeynman(null)} />}
      </main>

      {cmd && <CommandPalette onClose={() => setCmd(false)} onOpenStar={openEditor} onOpenView={openView} onFocusCon={focusCon} />}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} theme={theme} onToggleTheme={toggleTheme} />}
      {aiConfigOpen && <AIConfig onClose={() => setAiConfigOpen(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
if (window.lucide) window.lucide.createIcons();
