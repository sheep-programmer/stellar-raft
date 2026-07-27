/* MobileShell — 手机上的外壳：顶部条 · 底部标签栏 · 侧栏抽屉。

   桌面端 260px 的常驻侧栏在 375px 宽的屏幕上会吃掉七成版面，所以手机上换一套
   导航：最常去的四个地方沉到底部（拇指够得着），完整的侧栏收进左侧抽屉。
   这三件都只在 phone 断点出现，平板与桌面完全不渲染——不是隐藏，是不挂载。

   安全区：顶部条自己吃掉刘海高度，底部标签栏吃掉 Home 指示条的高度，
   视图内容拿到的是一块干净的矩形。 */
const { Icon, IconButton, Badge } = window.StellarRaftDesignSystem_2866af;

const SR_MOBILE_CSS = `
.sr-m-top, .sr-m-tab {
  position: absolute; left: 0; right: 0; z-index: 40;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.2);
  backdrop-filter: blur(var(--glass-blur)) saturate(1.2);
}
.sr-m-top { top: 0; height: calc(var(--sr-topbar) + var(--sr-safe-top)); padding-top: var(--sr-safe-top);
  border-bottom: 1px solid var(--glass-border); display: flex; align-items: center; gap: 6; padding-left: 6px; padding-right: 6px; }
.sr-m-tab { bottom: 0; height: calc(var(--sr-tabbar) + var(--sr-safe-bottom)); padding-bottom: var(--sr-safe-bottom);
  border-top: 1px solid var(--glass-border); display: flex; align-items: stretch; }

.sr-m-tabbtn { flex: 1; min-width: 0; border: none; background: transparent; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  padding: 0; color: rgba(159,198,255,0.66); font-family: var(--font-sans); font-size: 10.5px; position: relative;
  -webkit-tap-highlight-color: transparent; transition: color var(--dur-fast); }
.sr-m-tabbtn[aria-current="page"] { color: var(--gold); }
/* 选中态的那一点光：底部一道短横，比整块底色更克制 */
.sr-m-tabbtn[aria-current="page"]::after { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  width: 22px; height: 2px; border-radius: 0 0 2px 2px; background: var(--gold); box-shadow: 0 0 8px rgba(255,217,138,0.6); }
.sr-m-tabbtn:active { transform: scale(0.94); }
.sr-m-badge { position: absolute; top: 6px; left: 50%; margin-left: 5px; }

/* 抽屉：遮罩淡入 + 面板滑出，跟随 reduced-motion */
.sr-m-mask { position: fixed; inset: 0; z-index: 120; background: rgba(3,4,12,0.6);
  -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: sr-m-fade var(--dur-base) ease both; }
/* 抽屉宽度：始终给右侧留一条 68px 的活口——那条缝既是「这是一层浮层、点它就关」
   的视觉交代，也让你一眼还看得见自己的星空。窄屏上 282px 会吃掉九成屏幕，
   看起来就像整页跳转，那不是抽屉该有的样子。 */
.sr-m-panel { position: fixed; top: 0; bottom: 0; left: 0; z-index: 121;
  width: min(282px, calc(100vw - 68px));
  padding-left: var(--sr-safe-left); display: flex;
  animation: sr-m-slide var(--dur-base) var(--ease-flight) both; }
@keyframes sr-m-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes sr-m-slide { from { transform: translateX(-100%) } to { transform: none } }
@media (prefers-reduced-motion: reduce) {
  .sr-m-mask, .sr-m-panel { animation: none !important; }
  .sr-m-tabbtn:active { transform: none; }
}

/* 底部弹层（摘要卡 / 菜单在手机上的落点）：从下方推上来，顶部一根抓手 */
.sr-m-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 130;
  padding-bottom: var(--sr-safe-bottom); border-radius: var(--r-lg) var(--r-lg) 0 0;
  background: var(--glass-bg-strong); border-top: 1px solid var(--glass-border-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.2); backdrop-filter: blur(var(--glass-blur)) saturate(1.2);
  box-shadow: 0 -18px 48px rgba(0,0,0,0.5); max-height: 78vh; display: flex; flex-direction: column;
  animation: sr-m-up var(--dur-base) var(--ease-flight) both; }
@keyframes sr-m-up { from { transform: translateY(100%) } to { transform: none } }
@media (prefers-reduced-motion: reduce) { .sr-m-sheet { animation: none !important; } }
.sr-m-grip { width: 36px; height: 4px; border-radius: 2px; background: rgba(159,198,255,0.28); margin: 9px auto 4px; flex: none; }

/* ═══════════ 窄屏总调整 ═══════════
   各视图的根容器都挂 .sr-view；这里一处收掉桌面的 30px 留白。
   用 !important 是刻意的：这些视图的内边距写在内联 style 上，
   不加就压不过——而逐个改成 className 会把八个文件搅一遍。 */
html[data-screen="phone"] .sr-view { padding: 14px 14px 32px !important; }

/* 两栏 / 三栏统统压成一列。auto-fill minmax(...) 那种网格会自己适应，
   只有写死列数的需要在这里收口。 */
html[data-screen="phone"] .sr-cols-1,
html[data-screen="phone"] .sr-ck-2col { grid-template-columns: 1fr !important; }
/* 体检页的四格分布：手机上两两一排，不挤成四条竖线 */
html[data-screen="phone"] .sr-ck-4col { grid-template-columns: 1fr 1fr !important; }

/* 大标题在 375px 上会占掉两行：整体降一档 */
html[data-screen="phone"] .sr-view h1 { font-size: 23px !important; }

/* 触摸端的点击热区：用一层看不见的 ::after 把可点范围撑到 34px，
   元素自己的盒子一点不动。
   走过两次弯路，都是同一个错误——拿「会改变盒子」的属性去做热区：
     ① button.sr-focus-ring { min-height: 36px } → 17×17 的复选框被拉成竖条；
     ② padding + 负 margin → 边框和底色本来就画在按钮上，撑大内边距等于把
        那个方框整个放大，于是复选框变成一个大方块。
   热区只该是「感应面积」，不该是「可见尺寸」。 */
html[data-pointer="coarse"] .sr-hit-pad { position: relative; }
html[data-pointer="coarse"] .sr-hit-pad::after {
  content: ''; position: absolute; top: 50%; left: 50%;
  width: 34px; height: 34px; transform: translate(-50%, -50%);
}

/* 键盘提示：手机上没有物理键盘，印一枚「空格 / ⌘K」只会让人去找一个
   不存在的东西。挂了这个类的元素在触摸端整个不出现。 */
html[data-pointer="coarse"] .sr-kbd-only { display: none !important; }
/* 反过来的一半：只对手指说的话（「双指捏合」这类）在有鼠标的地方不出现。
   两个类成对，改一处操作说明时不会漏掉另一端。 */
.sr-touch-only { display: none; }
html[data-pointer="coarse"] .sr-touch-only { display: inline; }

/* 弹层：手机上一律铺满屏幕（480px 的对话框在 375px 屏上会被裁掉两边），
   贴着安全区，圆角只留顶部两个——像一张从底部推上来的纸。 */
html[data-screen="phone"] .sr-modal-panel {
  width: 100% !important; max-width: 100% !important; max-height: 100% !important;
  height: 100%; border-radius: 0 !important;
  padding-top: var(--sr-safe-top); padding-bottom: var(--sr-safe-bottom);
}
html[data-screen="phone"] .sr-modal-mask { padding: 0 !important; align-items: stretch !important; }

/* 设置页：左侧 168px 的分区导航在手机上横过来，变成顶部一条可横滑的标签行 */
html[data-screen="phone"] .sr-set-body { flex-direction: column !important; }
html[data-screen="phone"] .sr-set-nav {
  width: 100% !important; flex-direction: row !important; overflow-x: auto !important; overflow-y: hidden !important;
  border-right: none !important; border-bottom: 1px solid var(--line);
  padding: 8px 10px !important; gap: 6px !important; flex: none !important;
}
html[data-screen="phone"] .sr-set-nav > button { flex: none !important; white-space: nowrap; }

/* 命令面板：手机上从顶部落下来，铺满宽度（13vh 的留白在小屏是浪费） */
html[data-screen="phone"] .sr-cmd-panel { width: 100% !important; max-width: 100% !important; }
html[data-screen="phone"] .sr-cmd-mask { padding-top: calc(var(--sr-safe-top) + 8px) !important; padding-left: 8px; padding-right: 8px; }
`;

function injectMobileCss() {
  if (typeof document === 'undefined' || document.getElementById('sr-mobile-css')) return;
  const s = document.createElement('style');
  s.id = 'sr-mobile-css';
  s.textContent = SR_MOBILE_CSS;
  document.head.appendChild(s);
}

/* ---------- 顶部条 ---------- */
function MobileTopBar({ title, sub, onMenu, onSearch, onBack }) {
  React.useEffect(() => { injectMobileCss(); }, []);
  return (
    <header className="sr-m-top">
      {onBack
        ? <IconButton name="corner-up-left" title="返回" onClick={onBack} />
        : <IconButton name="menu" title="打开菜单" onClick={onMenu} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.15, paddingLeft: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 300, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {sub && <span style={{ fontSize: 10.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      </div>
      {onSearch && <IconButton name="search" title="搜索" onClick={onSearch} />}
    </header>
  );
}

/* ---------- 底部标签栏 ----------
   四个去处 + 一个「更多」。星图是家，永远在最左。 */
function MobileTabBar({ view, onView, onReview, onMore, dueN, inboxN, drawerOpen }) {
  const items = [
    { id: 'map', label: '星图', icon: 'orbit' },
    { id: 'list', label: '列表', icon: 'list' },
    { id: 'review', label: '复习', icon: 'repeat', badge: dueN },
    { id: 'inbox', label: '收件箱', icon: 'inbox', badge: inboxN },
    { id: 'more', label: '更多', icon: 'menu' },
  ];
  const current = drawerOpen ? 'more' : view;
  return (
    <nav className="sr-m-tab" aria-label="主导航">
      {items.map(it => (
        <button key={it.id} type="button" className="sr-m-tabbtn"
          aria-current={current === it.id ? 'page' : undefined}
          aria-label={it.label + (it.badge ? `（${it.badge}）` : '')}
          onClick={() => {
            if (it.id === 'more') onMore();
            else if (it.id === 'review') onReview();
            else onView(it.id);
          }}>
          <Icon name={it.icon} size={20} color="currentColor" />
          <span>{it.label}</span>
          {!!it.badge && <span className="sr-m-badge"><Badge dot tone="gold" /></span>}
        </button>
      ))}
    </nav>
  );
}

/* ---------- 抽屉 ----------
   装的就是桌面那套完整侧栏，不做第二份导航——两边永远同步。
   点遮罩 / 按 Esc / 选中任一目的地都关。 */
function MobileDrawer({ open, onClose, children }) {
  React.useEffect(() => { injectMobileCss(); }, []);
  React.useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <React.Fragment>
      <div className="sr-m-mask" onClick={onClose} />
      <div className="sr-m-panel" role="dialog" aria-modal="true" aria-label="导航菜单">
        {children}
      </div>
    </React.Fragment>
  );
}

/* ---------- 底部弹层 ----------
   手机上代替「浮在鼠标旁的卡片 / 菜单」。title 可省，省了就只有一根抓手。 */
function MobileSheet({ open, onClose, title, children, footer }) {
  React.useEffect(() => { injectMobileCss(); }, []);
  React.useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <React.Fragment>
      <div className="sr-m-mask" style={{ zIndex: 129 }} onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div className="sr-m-sheet" role="dialog" aria-modal="true" aria-label={title || '面板'}>
        <div className="sr-m-grip" aria-hidden="true" />
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px 10px', borderBottom: '1px solid var(--line)', flex: 'none' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 300, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            <IconButton name="x" size="sm" title="关闭" onClick={onClose} />
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 14px 16px' }}>{children}</div>
        {footer && <div style={{ flex: 'none', padding: '10px 14px', borderTop: '1px solid var(--line)' }}>{footer}</div>}
      </div>
    </React.Fragment>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { MobileTopBar, MobileTabBar, MobileDrawer, MobileSheet, injectMobileCss });
