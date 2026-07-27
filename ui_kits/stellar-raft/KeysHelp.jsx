/* KeysHelp — 快捷键速查面板。任意视图按 ? 唤出的居中玻璃 modal，
   分组罗列全站真实存在的按键（这页是承诺，不是愿望清单——新增快捷键
   请先落地行为，再来这里登记）。Esc / 点遮罩关闭，焦点圈禁同设置页。
   props: { onClose } */
const { GlassPanel, Icon, IconButton } = window.StellarRaftDesignSystem_2866af;

const SRK = window.SRKeys;

/* 分组数据：keys 里每个元素渲染成一枚键帽；跨平台说法交给 SRKeys
   （macOS ⌘/⌥/⇧ 符号，其余系统 Ctrl/Alt/Shift 文字）。 */
const SR_KEY_GROUPS = [
  {
    id: 'global', icon: 'globe', title: '全局',
    items: [
      { keys: [SRK.mod, 'K'], label: '命令面板 · 搜索星、星域、视图与笔记正文' },
      { keys: ['?'], label: '打开这张快捷键速查' },
      { keys: ['Esc'], label: '关闭浮层 / 收起摘要卡 / 返回星图' },
    ],
  },
  {
    id: 'palette', icon: 'search', title: '命令面板',
    items: [
      { keys: ['↑', '↓'], label: '上下选择结果' },
      { keys: ['Enter'], label: '前往选中项' },
    ],
  },
  {
    id: 'editor', icon: 'pen-line', title: '编辑器',
    items: [
      { keys: [SRK.mod, 'F'], label: '笔记内查找 / 替换' },
      { keys: [SRK.mod, 'Z'], label: '撤销 · 加 ' + SRK.shift + ' 为重做' },
      { keys: [SRK.mod, 'B · I · U'], label: '选中文字 · 加粗 / 斜体 / 下划线' },
      { keys: [SRK.mod, 'K'], label: '选中文字 · 添加链接' },
      { keys: ['/'], label: '唤起块菜单，插入或转换块' },
      { keys: [SRK.alt, '↑', '↓'], label: '上下移动当前块' },
      { keys: ['Tab'], label: '列表块缩进 · ' + SRK.shift + 'Tab 反向' },
      { keys: ['Space'], label: '块首 # / [] / - 等前缀后按空格，转换块类型' },
    ],
  },
  {
    id: 'review', icon: 'repeat', title: '复习会话',
    items: [
      { keys: ['Space'], label: '翻开卡片' },
      { keys: ['1', '←'], label: '自评 · 忘了' },
      { keys: ['2', '↓'], label: '自评 · 模糊' },
      { keys: ['3', '→'], label: '自评 · 记得' },
    ],
  },
  {
    id: 'inbox', icon: 'inbox', title: '收件箱',
    items: [
      { keys: [SRK.mod, 'Enter'], label: '捕捉当前草稿 / 寄出给好友的回信' },
    ],
  },
];

/* 键帽：等宽字体小方块，同设置页「快捷键」表的既有样子 */
function SRKeyCap({ children }) {
  return (
    <kbd style={{
      fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-1)', minWidth: 22, textAlign: 'center',
      border: '1px solid var(--line-strong)', borderRadius: 6, padding: '3px 7px', lineHeight: 1.4,
      background: 'var(--input-bg, rgba(3,4,12,0.45))', whiteSpace: 'nowrap',
    }}>{children}</kbd>
  );
}

function SRKeyGroup({ group }) {
  return (
    <section aria-label={group.title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
        <Icon name={group.icon} size={13} color="var(--star-blue)" />
        <span style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{group.title}</span>
      </div>
      {group.items.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: i === group.items.length - 1 ? 'none' : '1px solid var(--line)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{s.label}</span>
          <span style={{ display: 'flex', gap: 5, flex: 'none' }}>
            {s.keys.map((k, j) => <SRKeyCap key={j}>{k}</SRKeyCap>)}
          </span>
        </div>
      ))}
    </section>
  );
}

function KeysHelp({ onClose }) {
  // 模态焦点管理：移焦入内 · Tab 圈禁 · 关闭还原焦点；打开期间吞掉 ⌘K，
  // 命令面板不叠在速查之上（同设置 / AI 配置的语义）
  const modalRef = React.useRef(null);
  (window.SRKit && window.SRKit.useModalFocus ? window.SRKit.useModalFocus : () => { })(modalRef, { swallowCmdK: true });

  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  // 左右两栏：编辑器条目最多独占一栏，其余分组归到另一栏；窄屏时自动叠成单栏
  const left = SR_KEY_GROUPS.filter(g => g.id === 'editor');
  const right = SR_KEY_GROUPS.filter(g => g.id !== 'editor');
  const col = { flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 };

  return (
    <div ref={modalRef} onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()}
      role="dialog" aria-modal="true" aria-label="快捷键"
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(3,4,12,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onMouseDown={(e) => e.stopPropagation()}
        className="sr-modal-panel" style={{ width: 720, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" pad="none" glow style={{ width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: '1px solid var(--line)', flex: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="keyboard" size={18} color="var(--star-blue)" />
              <span style={{ fontSize: 15, color: 'var(--text-1)', fontWeight: 300, letterSpacing: '0.02em' }}>快捷键</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>不离开键盘，走遍整片星空</span>
            </div>
            <IconButton name="x" title="关闭" onClick={onClose} />
          </div>

          {/* body */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 20px 20px', display: 'flex', flexWrap: 'wrap', gap: '18px 28px', alignContent: 'flex-start' }}>
            <div style={col}>{left.map(g => <SRKeyGroup key={g.id} group={g} />)}</div>
            <div style={col}>{right.map(g => <SRKeyGroup key={g.id} group={g} />)}</div>
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 18px', borderTop: '1px solid var(--line)', flex: 'none', fontSize: 12, color: 'var(--text-3)' }}>
            按 <SRKeyCap>?</SRKeyCap> 随时打开
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { KeysHelp });
