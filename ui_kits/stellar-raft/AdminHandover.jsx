/* AdminHandover — 星港交接卡。出厂管理员（用户名与密码都写在 README 和启动日志里）
   一登录就撞上它，交接完成前什么都做不了：没有 Esc、没有遮罩点击、没有关闭按钮。
   唯一的出口是「退出登录」——误登进来的人不该被困住，但也不许绕过去。

   为什么用户名也要换：出厂密码换掉、用户名留着，等于把门牌号交给对方，
   攻击者省下的正是「先猜中是谁」这一步。两样一起换，服务端同一个接口里校验。

   「我已记下这组凭据」是一枚必须亲手勾上的闸：星图不发找回邮件，忘了只能从
   服务器上重置。勾选之前提交键是灰的——这是这张卡唯一一处刻意的摩擦。

   props: { onDone } —— 交接成功后调用（app 据此收起这张卡）。 */
const { Button, GlassPanel, Icon, Input, Checkbox } = window.StellarRaftDesignSystem_2866af;

// 与服务端 core.js 的 ADMIN_PASS_MIN 同一个数：管理员这把钥匙开的是全站所有人的星空
const SR_ADMIN_PASS_MIN = 8;

function AdminHandover({ onDone }) {
  const A = (window.SR_DATA && window.SR_DATA.account) || {};
  const [username, setUsername] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [remembered, setRemembered] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  // 焦点圈禁 + 吞掉 ⌘K：这张卡在的时候，命令面板也不该被唤出来
  const modalRef = React.useRef(null);
  (window.SRKit && window.SRKit.useModalFocus ? window.SRKit.useModalFocus : () => { })(modalRef, { swallowCmdK: true });

  // Esc 在捕获阶段就地吃掉：不给任何下层 Esc 处理器机会，这张卡关不掉
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);

  const uname = username.trim();
  // 本地先照一遍服务端的口径，省掉一个来回；真正说了算的仍是服务器
  const localErr = () => {
    if (!/^[\w一-龥-]{2,24}$/.test(uname)) return '用户名需 2–24 个字符（中英文、数字、_ 或 -）';
    if (A.username && uname.toLowerCase() === String(A.username).toLowerCase()) return '换一个用户名 —— 出厂的那个是公开的';
    if (pw.length < SR_ADMIN_PASS_MIN) return `管理员密码至少 ${SR_ADMIN_PASS_MIN} 位`;
    if (pw.toLowerCase() === uname.toLowerCase()) return '密码不能和用户名一样';
    if (pw !== confirm) return '两次输入的密码不一致';
    return '';
  };
  const ready = !localErr() && remembered && !busy;

  const copyPair = async () => {
    const text = `星图 · 星港管理员\n用户名：${uname}\n密码：${pw}`;
    const ok = await window.SRCopy.copy(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2200); }
    else setError('这台设备不允许自动复制，请手抄一份');
  };

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    const bad = localErr();
    if (bad) { setError(bad); return; }
    if (!remembered) { setError('请先确认你已经记下这组凭据'); return; }
    setError(''); setBusy(true);
    try {
      const r = await window.SRNet.auth.handover({ username: uname, password: pw });
      // 服务器把这个账号的全部会话连同当前这把一起吊销了，只发回一把新的：换上它，
      // 本地星空镜像与账号偏好原样留下（这不是换人，是同一个人换了钥匙）
      await window.SRNet.renewSession(r.session);
      const acc = window.SR_DATA && window.SR_DATA.account;
      if (acc) {
        acc.username = (r.user && r.user.username) || uname;
        acc.defaultPass = false;
        window.dispatchEvent(new CustomEvent('sr-account'));
      }
      const NS = window.StellarRaftDesignSystem_2866af;
      if (NS && NS.toast) NS.toast('星港已经交到你手上 · 别处的登录已全部失效', { icon: 'shield-check', tone: 'gold', duration: 4600 });
      onDone();
    } catch (err) {
      setError((err && err.message) || '出了点问题，请再试一次');
      setBusy(false);
    }
  };

  const hint = (t) => <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.7 }}>{t}</div>;

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label="交接星港管理员凭据"
      style={{
        position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        // 这张卡关不掉，所以更不能有一角落在刘海或 Home 条底下够不着；
        // 安全区只读 --sr-safe-*（组件不各自写 env()，同全站口径）
        padding: 'calc(var(--sr-safe-top) + 20px) calc(var(--sr-safe-right) + 16px) calc(var(--sr-safe-bottom) + 20px) calc(var(--sr-safe-left) + 16px)',
        overflow: 'auto', boxSizing: 'border-box',
        background: 'radial-gradient(1200px 800px at 78% -10%, rgba(60,40,26,0.45), transparent 60%), linear-gradient(180deg, #05060f 0%, #03040c 55%, #04050e 100%)',
      }}>
      <div style={{ width: 440, maxWidth: '94vw', margin: 'auto', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" glow style={{ padding: '30px 28px 24px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Icon name="shield-alert" size={20} color="var(--gold)" />
            <div style={{ fontSize: 19, fontWeight: 300, letterSpacing: '0.02em', color: 'var(--text-1)' }}>
              先把星港交到你手上
            </div>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 16 }}>
            这个管理员账号是装机时自动建的，用户名 <b style={{ color: 'var(--gold)' }}>{A.username || 'admin'}</b> 和它的密码
            都写在 README 与启动日志里 —— 拿到这台服务器地址的人都知道。
            现在换成只有你知道的一组，两样一起换：留着出厂用户名，等于把门牌号也留给对方。
          </div>

          <form onSubmit={submit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Input icon="user" placeholder="新的管理员用户名（2–24 位）" autoComplete="username"
                  value={username} onChange={(ev) => setUsername(ev.target.value)} autoFocus />
                {hint('中英文、数字、_ 或 -。这是你以后登录管理台用的名字。')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Input icon="lock" type="password" placeholder={`新密码（至少 ${SR_ADMIN_PASS_MIN} 位）`} autoComplete="new-password"
                  value={pw} onChange={(ev) => setPw(ev.target.value)} />
                {hint('管理员密码比普通账号严一档 —— 它开的是这台服务器上所有人的星空。')}
              </div>
              <Input icon="lock" type="password" placeholder="再输一次新密码" autoComplete="new-password"
                value={confirm} onChange={(ev) => setConfirm(ev.target.value)} />
            </div>

            {/* 记住这组凭据：星图不发找回邮件，这枚勾是交接前最后一道自觉 */}
            <div style={{
              marginTop: 16, padding: '12px 14px', borderRadius: 'var(--r-sm)',
              border: '1px solid rgba(255,217,138,0.28)', background: 'rgba(255,217,138,0.07)',
            }}>
              <Checkbox checked={remembered} onChange={setRemembered}
                label="我已经把这组用户名和密码记下来了" />
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.75, marginTop: 8 }}>
                星图不存找回邮箱、也不发重置邮件。这组凭据忘了，只能到服务器上重置数据库里的这一行。
              </div>
              <div style={{ marginTop: 10 }}>
                <Button variant="ghost" size="sm" icon={copied ? 'check' : 'copy'}
                  disabled={!uname || !pw} onClick={copyPair}>
                  {copied ? '已复制到剪贴板' : '复制这组凭据'}
                </Button>
              </div>
            </div>

            {error && (
              <div role="alert" style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 12, lineHeight: 1.6 }}>{error}</div>
            )}

            <Button type="submit" variant="primary" glow disabled={!ready} icon={busy ? undefined : 'shield-check'}
              style={{ width: '100%', marginTop: 16 }}>
              {busy ? '正在交接…' : '完成交接'}
            </Button>
          </form>

          <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 14, textAlign: 'center' }}>
            交接完成后，别处用出厂凭据登进来的会话会被一起请下去。
          </div>
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <Button variant="ghost" size="sm" icon="log-out" onClick={() => window.SRNet.logoutFlow()}>
              不是我，退出登录
            </Button>
          </div>

        </GlassPanel>
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { AdminHandover });
