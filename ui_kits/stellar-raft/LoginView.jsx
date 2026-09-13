/* LoginView — 全屏登录/注册页。首次启动（服务器确认未注册且未跳过）自动展示，
   也可由 Settings / Sidebar 的「登录 / 注册」按钮随时唤起（openLogin）。
   深空渐变 + 微闪星点背景，居中玻璃卡，双 Tab 登录/注册。
   注册 = 把当前这台设备的匿名星空升级为账号（同一 users.id，零数据迁移）；
   登录 = 把本浏览器切到该账号的星空。两者成功后都 adoptSession + 整页刷新重水合。
   props: { onClose } —— 跳过 / Esc 都调它，从不强留。 */
const { Button, GlassPanel, Icon, Input } = window.StellarRaftDesignSystem_2866af;

// 背景微闪星点：与 Onboarding 的 .bd 手法同源，独立一份 CSS（避免依赖 Onboarding 是否已挂载）
const SR_LOGIN_CSS = `
@keyframes sr-login-tw { 0%, 100% { opacity: .25; } 50% { opacity: .9; } }
.sr-login-bd { position: fixed; border-radius: 50%; background: rgba(159,198,255,.55); pointer-events: none; }
`;
function injectLoginCss() {
  if (typeof document === 'undefined' || document.getElementById('sr-login-css')) return;
  const s = document.createElement('style'); s.id = 'sr-login-css'; s.textContent = SR_LOGIN_CSS;
  document.head.appendChild(s);
}
// 十二颗星点：分散在整个视口（vw/vh 百分比），大小与延迟错开，避免机械感
const SR_LOGIN_STARS = [
  [8, 14, 1.5], [22, 62, 1], [34, 28, 1.5], [46, 8, 1], [58, 46, 1.5], [70, 20, 1],
  [82, 58, 1.5], [92, 32, 1], [14, 78, 1], [64, 84, 1.5], [88, 12, 1], [40, 90, 1.5],
];

function LoginTabs({ tab, onChange }) {
  const tabs = [{ id: 'login', label: '登录' }, { id: 'register', label: '注册' }];
  return (
    <div style={{ display: 'flex', gap: 6, padding: 3, borderRadius: 'var(--r-pill)', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--line-strong)' }}>
      {tabs.map(t => {
        const on = t.id === tab;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)}
            style={{
              flex: 1, height: 34, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)',
              fontSize: 13.5, fontFamily: 'var(--font-sans)',
              background: on ? 'rgba(255,217,138,0.16)' : 'transparent',
              color: on ? 'var(--gold)' : 'var(--text-3)',
              transition: 'background var(--dur-fast), color var(--dur-fast)',
            }}>{t.label}</button>
        );
      })}
    </div>
  );
}

function LoginView({ onClose }) {
  const [tab, setTab] = React.useState('login');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  // 登录字段
  const [idOrEmail, setIdOrEmail] = React.useState('');
  const [loginPass, setLoginPass] = React.useState('');

  // 注册字段
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [regPass, setRegPass] = React.useState('');
  const [regConfirm, setRegConfirm] = React.useState('');

  React.useEffect(() => { injectLoginCss(); }, []);

  const modalRef = React.useRef(null);
  (window.SRKit && window.SRKit.useModalFocus ? window.SRKit.useModalFocus : () => {})(modalRef, { swallowCmdK: true });

  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  const switchTab = (t) => { setTab(t); setError(''); };

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    setError('');

    if (tab === 'register' && regPass !== regConfirm) {
      setError('两次输入的密码不一致');
      return;
    }

    setBusy(true);
    try {
      const N = window.SRNet;
      const r = tab === 'login'
        ? await N.auth.login({ id: idOrEmail.trim(), password: loginPass })
        : await N.auth.register({ username: username.trim(), email: email.trim() || undefined, password: regPass });
      await N.adoptSession(r.session);   // 内含冲刷未保存编辑，await 后再刷新
      location.reload();
    } catch (err) {
      setError((err && err.message) || '出了点问题，请再试一次');
      setBusy(false);
    }
  };

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label={tab === 'login' ? '登录' : '注册'}
      style={{
        position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        background: 'radial-gradient(1200px 800px at 78% -10%, rgba(26,35,80,0.55), transparent 60%), radial-gradient(900px 700px at 12% 110%, rgba(40,30,70,0.35), transparent 60%), linear-gradient(180deg, #05060f 0%, #03040c 55%, #04050e 100%)',
      }}>
      <div aria-hidden="true">
        {SR_LOGIN_STARS.map((d, i) => (
          <span key={i} className="sr-login-bd"
            style={{
              left: d[0] + '%', top: d[1] + '%', width: d[2], height: d[2],
              animation: `sr-login-tw ${2.6 + (i % 4) * 0.7}s ease-in-out ${i * 0.32}s infinite`,
            }} />
        ))}
      </div>

      <div style={{ width: 400, maxWidth: '94vw', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" glow style={{ padding: '32px 28px 24px' }}>

          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{
              fontSize: 30, fontWeight: 300, letterSpacing: '0.08em', color: 'var(--text-1)',
              textShadow: '0 0 16px rgba(159,198,255,0.22)',
            }}>星图</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>登录你的星空</div>
          </div>

          <LoginTabs tab={tab} onChange={switchTab} />

          <form onSubmit={submit} style={{ marginTop: 20 }}>
            {tab === 'register' && (
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 16 }}>
                注册会把当前这片星空收进账号里，换台设备也能回来。
              </div>
            )}

            {tab === 'login' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 不用原生 autoFocus：它在 commit 阶段抢焦点，useModalFocus 捕到的 prev
                    就变成弹层自己，关闭时焦点无从还原。进场移焦交给 useModalFocus。 */}
                <Input icon="user" placeholder="用户名或邮箱" autoComplete="username" aria-label="用户名或邮箱" value={idOrEmail}
                  onChange={(e) => setIdOrEmail(e.target.value)} />
                <Input icon="lock" type="password" placeholder="密码" autoComplete="current-password" aria-label="密码" value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Input icon="user" placeholder="用户名（2–24 位）" autoComplete="username" aria-label="用户名" value={username}
                  onChange={(e) => setUsername(e.target.value)} />
                <Input icon="mail" placeholder="邮箱（选填）" autoComplete="email" aria-label="邮箱（选填）" value={email}
                  onChange={(e) => setEmail(e.target.value)} />
                <Input icon="lock" type="password" placeholder="密码（至少 6 位）" autoComplete="new-password" aria-label="密码（至少 6 位）" value={regPass}
                  onChange={(e) => setRegPass(e.target.value)} />
                <Input icon="lock" type="password" placeholder="确认密码" autoComplete="new-password" aria-label="确认密码" value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)} />
              </div>
            )}

            {error && (
              <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 12, lineHeight: 1.6 }}>{error}</div>
            )}

            <Button type="submit" variant="primary" glow disabled={busy} icon={busy ? undefined : 'sparkles'}
              style={{ width: '100%', marginTop: 18 }}>
              {busy ? '正在点亮…' : (tab === 'login' ? '登录' : '注册')}
            </Button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button variant="ghost" size="sm" onClick={onClose}>暂不登录，先逛逛</Button>
          </div>

        </GlassPanel>
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { LoginView });
