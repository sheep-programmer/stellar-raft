/* Settings — 用户设置覆盖层。居中玻璃 modal，左侧分区导航 + 右侧内容。
   由左下角头像点击打开。Esc / 点遮罩关闭，保存有 toast 反馈，无浏览器原生弹窗。
   props: { onClose, theme, onToggleTheme, onReplayGuide, onOpenLogin } */
const { Button, GlassPanel, Icon, IconButton, Input } = window.StellarRaftDesignSystem_2866af;

/* 头像预设：渐变色块，semantic 内仍走冷蓝/暖金的克制色域 */
const SR_AVATARS = [
  { id: 'nebula', grad: 'linear-gradient(140deg, #2a3566, #56689c)' },
  { id: 'dawn',   grad: 'linear-gradient(140deg, #8ea2cc, #b6c3dc)' },
  { id: 'gold',   grad: 'linear-gradient(140deg, #7a5a22, #ffd98a)' },
  { id: 'deep',   grad: 'linear-gradient(140deg, #11152e, #2a3566)' },
  { id: 'ice',    grad: 'linear-gradient(140deg, #3a4a7a, #9fc6ff)' },
  { id: 'ember',  grad: 'linear-gradient(140deg, #5a2e26, #e8917a)' },
];

// 只列真实存在的快捷键——这页是承诺，不是愿望清单
const SRK = window.SRKeys;
const SR_SHORTCUTS = [
  { keys: [SRK.mod, 'K'],     label: '全局搜索 · 跳转任意星或视图' },
  { keys: [SRK.mod, 'K'],     label: '编辑器内选中文字 · 添加链接' },
  { keys: [SRK.mod, 'F'],     label: '编辑器 · 笔记内查找 / 替换' },
  { keys: [SRK.mod, 'Z'],     label: '编辑器 · 撤销（加 ' + SRK.shift + ' 重做）' },
  { keys: ['/'],          label: '编辑器内唤起块菜单' },
  { keys: [SRK.alt, '↑', '↓'], label: '编辑器 · 上下移动当前块' },
  { keys: ['Tab'],        label: '编辑器 · 列表缩进（' + SRK.shift + 'Tab 减少）' },
  { keys: [SRK.mod, 'Enter'], label: '收件箱 · 捕捉当前草稿' },
  { keys: ['Space'],      label: '复习会话 · 翻开卡片' },
  { keys: ['1', '2', '3'], label: '复习会话 · 忘了 / 模糊 / 记得' },
  { keys: ['Esc'],        label: '关闭当前弹窗 / 抽屉' },
];

const SR_SET_NAV = [
  { id: 'profile', label: '个人资料', icon: 'user' },
  { id: 'prefs',   label: '偏好',     icon: 'sliders-horizontal' },
  { id: 'review',  label: '复习提醒', icon: 'bell' },
  // 触摸端没有物理键盘，这一整页（连同它列出的十来条组合键）都没有意义
  { id: 'keys',    label: '快捷键',   icon: 'keyboard', desktopOnly: true },
  { id: 'guide',   label: '上手引导', icon: 'compass' },
  { id: 'account', label: '账户',     icon: 'shield' },
];

/* 玻璃开关 */
function SRToggle({ on, onChange, disabled, label }) {
  /* role/状态/名称一个不能少：裸 <button> 对读屏来说只是「按钮」——
     不知道管什么、也不知道当前开还是关（AIConfig 的 Toggle 是对照的样板） */
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label || '开关'}
      disabled={disabled} onClick={() => !disabled && onChange(!on)}
      style={{
        width: 42, height: 24, flex: 'none', borderRadius: 'var(--r-pill)', position: 'relative',
        border: '1px solid ' + (on ? 'rgba(255,217,138,0.5)' : 'var(--glass-border-strong)'),
        background: on ? 'rgba(255,217,138,0.18)' : 'var(--input-bg, rgba(3,4,12,0.45))',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition: 'background var(--dur-fast), border-color var(--dur-fast)', padding: 0,
      }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
        background: on ? 'var(--gold)' : 'var(--text-3)',
        boxShadow: on ? '0 0 8px rgba(255,217,138,0.6)' : 'none',
        transition: 'left var(--dur-base) var(--ease-flight), background var(--dur-fast)',
      }} />
    </button>
  );
}

/* 设置行：标题 + 说明 + 右侧控件 */
function SRRow({ title, hint, children, align, noLine }) {
  return (
    <div style={{ display: 'flex', alignItems: align || 'center', justifyContent: 'space-between', gap: 18, padding: '13px 0', borderBottom: noLine ? 'none' : '1px solid var(--line)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.84375rem', color: 'var(--text-1)' }}>{title}</div>
        {hint && <div style={{ fontSize: '0.71875rem', color: 'var(--text-3)', marginTop: 3, lineHeight: 1.55 }}>{hint}</div>}
      </div>
      <div style={{ flex: 'none' }}>{children}</div>
    </div>
  );
}

function SRSectionTitle({ children }) {
  return <div style={{ fontSize: '0.625rem', letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{children}</div>;
}

/* 分段选择（如复习频率） */
function SRSegment({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-pill)', padding: 2 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            style={{
              height: 26, padding: '0 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
              fontSize: '0.78125rem', fontFamily: 'var(--font-sans)',
              background: on ? 'rgba(159,198,255,0.16)' : 'transparent',
              color: on ? 'var(--text-1)' : 'var(--text-3)',
              transition: 'background var(--dur-fast), color var(--dur-fast)',
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function Settings({ onClose, theme, onToggleTheme, onReplayGuide, onOpenLogin }) {
  const dawn = theme === 'dawn';
  // 危险操作复用 EditorMenus 的 ConfirmDialog（danger 样式）；与 ListView / BlackHole 同一取法
  const ConfirmDialog = window.SRKit && window.SRKit.ConfirmDialog;
  // 未登录打开设置直接落在「账户」页——那里有醒目的「登录 / 注册」，入口不因胶囊改开设置而变深
  const [tab, setTab] = React.useState(() => (window.SR_DATA.account.registered ? 'profile' : 'account'));
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);

  // 账户 tab：改密行内展开 + 忙碌 / 报错态
  const [pwOpen, setPwOpen] = React.useState(false);
  const [emOpen, setEmOpen] = React.useState(false);   // 邮箱绑定/修改行内展开
  const [emPw, setEmPw] = React.useState('');
  const [emVal, setEmVal] = React.useState('');
  const [emErr, setEmErr] = React.useState('');
  const [emBusy, setEmBusy] = React.useState(false);
  const importRef = React.useRef(null);                 // 导入数据的隐藏 file input
  const mdImportRef = React.useRef(null);               // 导入 Markdown 仓库（.zip / 多个 .md）的隐藏 file input

  // Markdown 仓库并入星空：与 JSON 的「整体替换」不同，这是增量合并——
  // 同名星域并入现有域，星按域心散布落位，连线补进；写完一次性落库
  const mergeVaultPlan = (plan) => {
    const PALETTE = ['#9fc6ff', '#ffd98a', '#b8a6ff', '#8fe3c0', '#f0a8b8', '#a8d8f0'];
    const conMap = {};   // 计划域 id → 实际域 id
    plan.constellations.forEach((c, i) => {
      const exist = D.constellations.find(x => x.name === c.name);
      if (exist) { conMap[c.id] = exist.id; return; }
      const nc = { id: c.id, name: c.name, color: PALETTE[(D.constellations.length + i) % PALETTE.length], health: 0, count: 0 };
      D.constellations.push(nc);
      conMap[c.id] = nc.id;
    });
    // 每个域一个落点簇：域心随机、成员绕域心散布
    const centers = {};
    Object.values(conMap).forEach(id => { centers[id] = centers[id] || [22 + Math.random() * 56, 24 + Math.random() * 52]; });
    plan.stars.forEach(s => {
      s.con = conMap[s.con] || s.con;
      const [cx, cy] = centers[s.con] || [50, 50];
      const ang = Math.random() * Math.PI * 2, rad = 3 + Math.random() * 9;
      s.x = Math.min(94, Math.max(6, cx + Math.cos(ang) * rad));
      s.y = Math.min(92, Math.max(8, cy + Math.sin(ang) * rad));
      D.addStar(s);
    });
    plan.connections.forEach(c => { D.connections.push(c); });
    D.syncCounts();
    D.persist();
    window.dispatchEvent(new Event('sr-data'));
  };
  const handleMdImport = async (files) => {
    try {
      let entries = [];
      for (const f of files) {
        // 64MB 与 vault.js 解压上限同口径：纯文本笔记仓库远到不了这里，
        // 超出的东西读进来只会先把标签页内存吃光
        if (f.size > 64 * 1024 * 1024) { flashToast(`「${f.name}」超过 64MB，不像是笔记仓库`); continue; }
        if (/\.zip$/i.test(f.name)) {
          entries = entries.concat(await window.SRVault.readZip(new Uint8Array(await f.arrayBuffer())));
        } else if (/\.md$/i.test(f.name)) {
          entries.push({ path: (f.webkitRelativePath || f.name), text: await f.text() });
        }
      }
      const plan = window.SRVault.parseVault(entries);
      if (!plan.stars.length) { flashToast('没有找到可导入的 Markdown 笔记'); return; }
      setConfirm({
        message: `将导入 ${plan.stars.length} 颗星 · ${plan.constellations.length} 个星域 · ${plan.connections.length} 条连线，增量并入当前星空（不覆盖现有数据）。`,
        confirmLabel: '并入星空',
        onYes: () => { mergeVaultPlan(plan); flashToast(`已并入 ${plan.stars.length} 颗星 ✦ 从未点亮起步，讲透才发光`); },
      });
    } catch (err) { flashToast('导入失败 · ' + ((err && err.message) || '文件无法解析')); }
  };
  const [oldPw, setOldPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [pwBusy, setPwBusy] = React.useState(false);
  const [pwErr, setPwErr] = React.useState('');

  // 已保存的设置（本机浏览器）；昵称等身份信息以 D.account 为单一来源
  const D = window.SR_DATA;
  const saved = React.useMemo(() => { try { return JSON.parse(localStorage.getItem('sr.settings')) || {}; } catch (e) { return {}; } }, []);

  // 个人资料
  const [nickname, setNickname] = React.useState(() => saved.nickname || D.account.name);
  const [avatar, setAvatar] = React.useState(() => saved.avatar || 'nebula');
  const [bio, setBio] = React.useState(() => saved.bio != null ? saved.bio : (D.account.bio || ''));

  // 偏好
  const [motion, setMotion] = React.useState(() => saved.motion !== false);
  const [twinkle, setTwinkle] = React.useState(() => saved.twinkle !== false);

  // 复习提醒
  const [remind, setRemind] = React.useState(() => saved.remind !== false);
  const [freq, setFreq] = React.useState(() => saved.freq || 'daily');
  const [remindTime, setRemindTime] = React.useState(() => saved.remindTime || '21:00');
  const [dimNudge, setDimNudge] = React.useState(() => saved.dimNudge !== false);
  const [confirm, setConfirm] = React.useState(null); // {message, confirmLabel, onYes}

  // 模态焦点管理：移焦入内 · Tab 圈禁 · 关闭还原焦点；打开期间吞掉 ⌘K，
  // 命令面板不再叠在设置之上（同 DS Modal / ReviewSession 的语义）
  const modalRef = React.useRef(null);
  (window.SRKit && window.SRKit.useModalFocus ? window.SRKit.useModalFocus : () => { })(modalRef, { swallowCmdK: true });

  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [onClose]);

  const flashToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  const submitPwChange = async () => {
    if (pwBusy) return;
    setPwErr('');
    setPwBusy(true);
    try {
      await window.SRNet.auth.changePassword({ old: oldPw, new: newPw });
      setPwOpen(false); setOldPw(''); setNewPw('');
      flashToast('密码已更新');
      // 管理员刚换掉出厂密码：广播出去，管理台顶部那条警告随即消失（交接卡走的是同一个标记）
      const A = window.SR_DATA && window.SR_DATA.account;
      if (A && A.defaultPass) { A.defaultPass = false; window.dispatchEvent(new CustomEvent('sr-account')); }
    } catch (err) {
      setPwErr((err && err.message) || '出了点问题，请再试一次');
    } finally {
      setPwBusy(false);
    }
  };

  const avatarGrad = (SR_AVATARS.find(a => a.id === avatar) || SR_AVATARS[0]).grad;
  const avatarLetter = (nickname.trim()[0] || '星');

  const save = () => {
    const name = nickname.trim();
    if (name) { D.account.name = name; D.account.avatar = name[0]; }
    D.account.bio = bio.trim().slice(0, 120);
    try {
      localStorage.setItem('sr.settings', JSON.stringify({ nickname: name || D.account.name, avatar, bio: D.account.bio, motion, twinkle, remind, freq, remindTime, dimNudge }));
    } catch (e) { }
    D.persist();   // 昵称/头像/简介与提醒偏好进星系快照，随账号跨设备同步
    // 动效偏好即刻生效（index.html 里有对应 CSS 钩子）
    document.documentElement.dataset.motion = motion ? 'on' : 'off';
    document.documentElement.dataset.twinkle = (twinkle && motion) ? 'on' : 'off';
    flashToast('设置已保存 · 你的星空已更新');
  };

  const ink = dawn ? '#1a2238' : 'var(--text-1)';

  return (
    <div ref={modalRef} onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()}
      role="dialog" aria-modal="true" aria-label="设置"
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(3,4,12,0.55)', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onMouseDown={(e) => e.stopPropagation()}
        className="sr-modal-panel" style={{ width: 760, maxWidth: '94vw', height: 560, maxHeight: '92vh', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" pad="none" glow style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: '1px solid var(--line)', flex: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="settings" size={18} color="var(--star-blue)" />
              <span style={{ fontSize: '0.9375rem', color: 'var(--text-1)', fontWeight: 300, letterSpacing: '0.02em' }}>设置</span>
            </div>
            <IconButton name="x" title="关闭" onClick={onClose} />
          </div>

          {/* body: nav + content */}
          <div className="sr-set-body" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            {/* left nav */}
            <nav className="sr-set-nav" style={{ width: 168, flex: 'none', borderRight: '1px solid var(--line)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto' }}>
              {SR_SET_NAV.filter(n => !(n.desktopOnly && window.SRScreen.isTouch())).map(n => {
                const on = tab === n.id;
                return (
                  <button key={n.id} type="button" onClick={() => setTab(n.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 11px', width: '100%',
                      borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left',
                      border: '1px solid ' + (on ? 'var(--glass-border-strong)' : 'transparent'),
                      background: on ? 'rgba(159,198,255,0.08)' : 'transparent',
                      color: on ? 'var(--gold)' : 'var(--text-2)',
                      transition: 'background var(--dur-fast), color var(--dur-fast)',
                    }}>
                    <Icon name={n.icon} size={17} color="currentColor" />
                    <span style={{ fontSize: '0.8125rem', color: on ? 'var(--text-1)' : 'inherit' }}>{n.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* content */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 24px' }}>

              {tab === 'profile' && (
                <div>
                  <SRSectionTitle>头像</SRSectionTitle>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0 16px', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ width: 56, height: 56, flex: 'none', borderRadius: '50%', background: avatarGrad, border: '1px solid var(--glass-border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.375rem', color: ink, boxShadow: '0 0 18px rgba(159,198,255,0.18)' }}>{avatarLetter}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                      {SR_AVATARS.map(a => {
                        const on = a.id === avatar;
                        return (
                          <button key={a.id} type="button" onClick={() => setAvatar(a.id)} title={'头像 ' + a.id}
                            style={{
                              width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', background: a.grad,
                              border: '2px solid ' + (on ? 'var(--gold)' : 'transparent'),
                              outline: on ? 'none' : '1px solid var(--glass-border)',
                              boxShadow: on ? '0 0 10px rgba(255,217,138,0.45)' : 'none',
                              transition: 'box-shadow var(--dur-fast), border-color var(--dur-fast)',
                            }} />
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ paddingTop: 16 }}>
                    <SRSectionTitle>昵称</SRSectionTitle>
                    <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="你的名字" icon="user" aria-label="昵称" />
                  </div>

                  <div style={{ paddingTop: 16 }}>
                    <SRSectionTitle>个人简介</SRSectionTitle>
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                      placeholder="用一两句话描述你的星空…" aria-label="个人简介"
                      onContextMenu={(e) => e.stopPropagation()}
                      style={{
                        width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 72,
                        background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-sm)',
                        color: 'var(--text-1)', fontSize: '0.84375rem', lineHeight: 1.7, padding: '10px 12px', outline: 'none',
                        fontFamily: 'var(--font-sans)',
                      }} />
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: 6, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{bio.length} / 120</div>
                  </div>
                </div>
              )}

              {tab === 'prefs' && (
                <div>
                  <SRSectionTitle>外观</SRSectionTitle>
                  <SRRow title="主题" hint={dawn ? '当前为「黎明」浅色 · 切回深空让星辰更亮' : '当前为「深空」暗场 · 知识是唯一的光'}>
                    <SRSegment value={dawn ? 'dawn' : 'space'} onChange={(v) => { if ((v === 'dawn') !== dawn) onToggleTheme(); }}
                      options={[{ value: 'space', label: '深空' }, { value: 'dawn', label: '黎明' }]} />
                  </SRRow>
                  <div style={{ height: 10 }} />
                  <SRSectionTitle>动效</SRSectionTitle>
                  <SRRow title="界面动效" hint="星辰呼吸、卡片浮起、点亮时的光爆。关闭后界面更安静。">
                    <SRToggle on={motion} onChange={setMotion} label="界面动效" />
                  </SRRow>
                  <SRRow title="背景星点闪烁" hint="远景星场的微弱明灭。">
                    <SRToggle on={twinkle} onChange={setTwinkle} disabled={!motion} label="背景星点闪烁" />
                  </SRRow>
                  <div style={{ marginTop: 14, display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'rgba(159,198,255,0.05)', border: '1px solid var(--line)' }}>
                    <Icon name="accessibility" size={16} color="var(--star-blue)" />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: 1.7 }}>
                      若系统已开启「减少动态效果」(prefers-reduced-motion)，星图会自动收敛所有动画；上面的开关保存后立即生效，可随时手动控制。
                    </div>
                  </div>
                </div>
              )}

              {tab === 'review' && (
                <div>
                  <SRSectionTitle>复习提醒</SRSectionTitle>
                  <SRRow title="开启提醒" hint={(() => {
                    if (typeof Notification === 'undefined') return '当前环境不支持系统通知。';
                    if (Notification.permission === 'denied') return '浏览器拦截了通知——到浏览器设置里允许本站通知后生效。';
                    if (Notification.permission === 'default') return '到点提醒你回来点亮正在变暗的星。开启后浏览器会询问通知权限。';
                    return '到点提醒你回来点亮正在变暗的星。页面开着时按设定时刻通知。';
                  })()}>
                    <SRToggle on={remind} label="开启复习提醒" onChange={(v) => {
                      setRemind(v);
                      if (v && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
                    }} />
                  </SRRow>
                  <SRRow title="提醒频率">
                    <SRSegment value={freq} onChange={setFreq}
                      options={[{ value: 'daily', label: '每日' }, { value: 'weekly', label: '每周' }, { value: 'smart', label: '智能' }]} />
                  </SRRow>
                  <SRRow title="提醒时间" hint="安静的时刻，适合回望一天。">
                    <input type="time" value={remindTime} onChange={(e) => setRemindTime(e.target.value)} disabled={!remind} aria-label="提醒时间"
                      style={{
                        height: 30, padding: '0 10px', borderRadius: 'var(--r-sm)', outline: 'none',
                        background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)',
                        color: 'var(--text-1)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
                        opacity: remind ? 1 : 0.45, colorScheme: 'dark',
                      }} />
                  </SRRow>
                  <SRRow title="星域变暗提醒" hint="当一片星域长期无人问津、整体变暗时，轻轻提醒你。" align="flex-start">
                    <SRToggle on={dimNudge} onChange={setDimNudge} label="星域变暗提醒" />
                  </SRRow>
                  <div style={{ marginTop: 14, fontSize: '0.71875rem', color: 'var(--text-3)', lineHeight: 1.7 }}>
                    提醒只在你点亮节奏放缓时出现，不会催促。你的星空，由你决定何时回来。
                  </div>
                </div>
              )}

              {tab === 'keys' && (
                <div>
                  <SRSectionTitle>快捷键一览</SRSectionTitle>
                  <div style={{ marginTop: 8 }}>
                    {SR_SHORTCUTS.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{s.label}</span>
                        <span style={{ display: 'flex', gap: 5, flex: 'none' }}>
                          {s.keys.map((k, j) => (
                            <kbd key={j} style={{
                              fontFamily: 'var(--font-mono)', fontSize: '0.71875rem', color: 'var(--text-1)', minWidth: 22, textAlign: 'center',
                              border: '1px solid var(--line-strong)', borderRadius: 6, padding: '3px 7px', background: 'var(--input-bg, rgba(3,4,12,0.45))',
                            }}>{k}</kbd>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'guide' && (
                <div>
                  <SRSectionTitle>上手引导</SRSectionTitle>
                  <div style={{ padding: '14px 0 4px', fontSize: '0.8125rem', color: 'var(--text-2)', lineHeight: 1.85 }}>
                    第一次进来的那本「星图手册」——星图、点亮、复习、收件箱、黑洞、漫游，一页页讲清楚。想重温随时翻开。
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Button size="sm" variant="primary" glow icon="book-open"
                      onClick={() => { if (onReplayGuide) onReplayGuide(); }}>重新观看引导</Button>
                  </div>
                </div>
              )}

              {tab === 'account' && (
                <div>
                  <SRSectionTitle>账户</SRSectionTitle>

                  {!D.account.registered && (
                    <div style={{ padding: '14px 0 4px' }}>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-2)', lineHeight: 1.85, marginBottom: 14 }}>
                        登录后，这片星空会跟着账号走——换台设备也能回来。
                      </div>
                      <Button variant="primary" glow icon="log-in" onClick={() => { if (onOpenLogin) onOpenLogin(); }}>登录 / 注册</Button>
                    </div>
                  )}

                  {D.account.registered && (
                    <div>
                      <SRRow title="用户名"><span style={{ fontSize: '0.8125rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{D.account.username}</span></SRRow>
                      <SRRow title="邮箱" noLine={emOpen}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{D.account.email || '未绑定'}</span>
                          {!emOpen && <Button size="sm" variant="ghost" icon="mail" onClick={() => { setEmErr(''); setEmVal(D.account.email || ''); setEmPw(''); setEmOpen(true); }}>{D.account.email ? '修改' : '绑定'}</Button>}
                        </span>
                      </SRRow>
                      {emOpen && (
                        <div style={{ padding: '2px 0 14px', display: 'flex', flexDirection: 'column', gap: 9, borderBottom: '1px solid var(--line)' }}>
                          <Input icon="mail" placeholder="新邮箱" autoComplete="email" value={emVal} onChange={(e) => setEmVal(e.target.value)} />
                          <Input type="password" icon="lock" placeholder="账号密码（确认是你本人）" autoComplete="current-password" value={emPw} onChange={(e) => setEmPw(e.target.value)} />
                          {emErr && <div style={{ fontSize: '0.75rem', color: 'var(--danger)', lineHeight: 1.6 }}>{emErr}</div>}
                          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                            <Button size="sm" variant="primary" glow disabled={emBusy} icon={emBusy ? undefined : 'check'} onClick={async () => {
                              if (emBusy) return;
                              setEmBusy(true); setEmErr('');
                              try {
                                const r = await window.SRNet.auth.changeEmail({ password: emPw, email: emVal.trim() });
                                D.account.email = (r.user && r.user.email) || emVal.trim();
                                setEmOpen(false); setEmPw(''); flashToast('邮箱已更新');
                              } catch (err) { setEmErr((err && err.message) || '出了点问题，请再试一次'); }
                              setEmBusy(false);
                            }}>{emBusy ? '确认中…' : '确认'}</Button>
                            <Button size="sm" variant="ghost" disabled={emBusy} onClick={() => { setEmOpen(false); setEmPw(''); setEmErr(''); }}>取消</Button>
                          </div>
                        </div>
                      )}
                      <SRRow title="注册于"><span style={{ fontSize: '0.8125rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{(D.account.registeredAt || '').slice(0, 10)}</span></SRRow>

                      <SRRow title="修改密码" hint={pwOpen ? undefined : '定期更换密码，让账号更安全。'} align={pwOpen ? 'flex-start' : 'center'} noLine={pwOpen}>
                        {!pwOpen && <Button size="sm" variant="ghost" icon="key-round" onClick={() => { setPwErr(''); setPwOpen(true); }}>修改密码</Button>}
                      </SRRow>
                      {pwOpen && (
                        <div style={{ padding: '2px 0 14px', display: 'flex', flexDirection: 'column', gap: 9, borderBottom: '1px solid var(--line)' }}>
                          <Input type="password" icon="lock" placeholder="旧密码" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
                          <Input type="password" icon="lock" placeholder="新密码" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                          {pwErr && <div style={{ fontSize: '0.75rem', color: 'var(--danger)', lineHeight: 1.6 }}>{pwErr}</div>}
                          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                            <Button size="sm" variant="primary" glow disabled={pwBusy} icon={pwBusy ? undefined : 'check'} onClick={submitPwChange}>{pwBusy ? '确认中…' : '确认'}</Button>
                            <Button size="sm" variant="ghost" disabled={pwBusy} onClick={() => { setPwOpen(false); setOldPw(''); setNewPw(''); setPwErr(''); }}>取消</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <SRRow title="我的星空"><span style={{ fontSize: '0.8125rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>共 {D.stars.length} 颗 · 正发光 {D.stars.filter(s => s.strength >= 0.7).length} · 正变暗 {D.stars.filter(s => s.strength < 0.4).length} · 连接 {D.connections.length}</span></SRRow>
                  <SRRow title="连续点亮"><span style={{ fontSize: '0.8125rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{D.account.streak} 天</span></SRRow>
                  <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    <Button size="sm" variant="ghost" icon="download" onClick={() => {
                      const snap = window.SRNet && window.SRNet.snapshot();
                      if (!snap) { flashToast('导出失败 · 数据尚未就绪'); return; }
                      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = '星图-我的星空.json';
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
                      flashToast('已导出你的星图数据（JSON 文件）');
                    }}>导出数据</Button>
                    <Button size="sm" variant="ghost" icon="folder-down" onClick={() => {
                      // 整片星空 → Obsidian 风格 Markdown 仓库（zip）：每星一档、星域分夹、
                      // wikilink 关联、README 索引；知识随时带得走，不锁在应用里。
                      // Markdown 仓库进出可由管理台设成「需要账号」（游客点了会被请去登录）
                      if (!window.SRGate.require('vault', 'Markdown 仓库导出')) return;
                      try {
                        const entries = window.SRVault.buildVault({
                          stars: D.stars, constellations: D.constellations,
                          connections: D.connections, account: D.account,
                        });
                        const bytes = window.SRVault.buildZip(entries, Date.now());
                        const blob = new Blob([bytes], { type: 'application/zip' });
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = '星图-Markdown仓库.zip';
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
                        flashToast('已导出 Markdown 仓库 · Obsidian 可直接打开');
                      } catch (err) { flashToast('导出失败 · ' + ((err && err.message) || '稍后再试')); }
                    }}>导出 Markdown 仓库</Button>
                    <Button size="sm" variant="ghost" icon="upload" onClick={() => importRef.current && importRef.current.click()}>导入数据</Button>
                    <Button size="sm" variant="ghost" icon="folder-up" onClick={() => { if (!window.SRGate.require('vault', 'Markdown 仓库导入')) return; if (mdImportRef.current) mdImportRef.current.click(); }}>导入 Markdown</Button>
                    <input ref={mdImportRef} type="file" accept=".zip,.md,text/markdown,application/zip" multiple style={{ display: 'none' }}
                      onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) handleMdImport(fs); }} />
                    <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0];
                        e.target.value = '';
                        if (!f) return;
                        const rd = new FileReader();
                        rd.onload = () => {
                          let data = null;
                          try { data = JSON.parse(String(rd.result)); } catch (err) { }
                          if (!data || !Array.isArray(data.stars)) { flashToast('这不是有效的星图数据文件'); return; }
                          setConfirm({
                            message: `导入将替换当前星空（文件含 ${data.stars.length} 颗星），本机与账号里的现有数据都会被覆盖。确定导入吗？`,
                            confirmLabel: '导入并替换',
                            onYes: () => {
                              // 复用冲突收敛通道：hydrate + sr-hydrated 整体重挂载，再落库
                              window.dispatchEvent(new CustomEvent('sr-conflict', { detail: data }));
                              setTimeout(() => { try { window.SRNet.saveNow(); } catch (err) { } }, 400);
                              const T = window.StellarRaftDesignSystem_2866af;
                              if (T && T.toast) T.toast('星空已导入 · ' + data.stars.length + ' 颗星就位', { icon: 'check' });
                            },
                          });
                        };
                        rd.readAsText(f);
                      }} />
                    {D.account.registered && (
                      <Button size="sm" variant="ghost" icon="log-out" onClick={() => setConfirm({
                        message: '退出后，这台设备回到匿名状态；你的星空安全地留在账号里。',
                        confirmLabel: '退出登录',
                        onYes: () => { window.SRNet.logoutFlow(); },
                      })}>退出登录</Button>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '13px 18px', borderTop: '1px solid var(--line)', flex: 'none' }}>
            <Button size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" variant="primary" icon="check" glow onClick={save}>保存更改</Button>
          </div>
        </GlassPanel>
      </div>

      {confirm && ConfirmDialog && (
        <ConfirmDialog message={confirm.message} confirmLabel={confirm.confirmLabel}
          onYes={() => { confirm.onYes(); setConfirm(null); }} onClose={() => setConfirm(null)} />
      )}

      {/* toast */}
      {toast && (
        <div role="status" onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 130, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
          <GlassPanel strong radius="pill" pad="sm" glow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 8px' }}>
              <Icon name="check" size={16} color="var(--gold)" />
              <span style={{ fontSize: '0.84375rem', color: 'var(--text-1)' }}>{toast}</span>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { Settings });
