/* ReviewSession — 复习会话（间隔重复的核心闭环）。
   从到期星里按到期先后取卡：先只呈现星名 + 所属星座（回忆阶段），空格 / 点「展开」
   翻开笔记摘要与大纲（翻开阶段），随后三档自评：
   忘了 (1/←) → D.reviewFail · 模糊 (2/↓) → D.reviewPartial · 记得 (3/→) → D.reviewSuccess。
   评分立即持久化（reviewX 内部走 touchNote → SRNet 防抖落盘），并广播 sr-memory
   让星图 / 鸟瞰 / 侧栏角标就地读回新亮度。Esc 退出；reduced-motion 下卡片瞬切。 */
const { GlassPanel, Icon, IconButton, Button } = window.StellarRaftDesignSystem_2866af;

const RS_HUD = { fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' };

// 直接落在深色遮罩上的文字（HUD / 键位提示）：遮罩两个主题下都是深色，
// 墨水必须用固定亮色，不能跟随主题（黎明的深藏青压在遮罩上约 1.26:1，不可读）。
const RS_SCRIM_INK = 'var(--text-on-scrim, rgba(255,255,255,0.92))';
const RS_SCRIM_INK_DIM = 'var(--text-on-scrim-dim, rgba(214,225,255,0.86))';
const RS_HUD_SCRIM = { ...RS_HUD, color: RS_SCRIM_INK_DIM };

// 系统 reduced-motion 或设置页关闭动效时，卡片不飞、直接瞬切
const rsReduced = () =>
  (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
  document.documentElement.dataset.motion === 'off';

// 从笔记块里提炼一个克制的大纲：标题与前几条要点
const rsOutline = (star) => (star.body || [])
  .filter(b => ['h2', 'h3', 'bulleted', 'numbered'].includes(b.type) && b.text)
  .slice(0, 5);

function RSKbd({ children, onScrim }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1,
      color: onScrim ? RS_SCRIM_INK_DIM : 'var(--text-3)',
      border: '1px solid ' + (onScrim ? 'rgba(208,220,255,0.28)' : 'var(--glass-border)'),
      borderRadius: 5, padding: '2px 5px', flex: 'none',
    }}>{children}</span>
  );
}

/* 认证态徽标：已点亮 = 金发丝 · 待重燃 = 暗金余烬（差异呈现，金色只属于点亮语义本身） */
function RSCertChip({ ember }) {
  return (
    <span style={{
      fontSize: 10, letterSpacing: '0.05em', padding: '2px 8px', borderRadius: 'var(--r-pill)',
      border: '1px solid ' + (ember ? 'color-mix(in srgb, var(--gold) 30%, transparent)' : 'color-mix(in srgb, var(--gold) 45%, transparent)'),
      color: ember ? 'color-mix(in srgb, var(--gold) 72%, var(--text-3))' : 'var(--gold)',
      background: ember ? 'color-mix(in srgb, var(--gold) 6%, transparent)' : 'color-mix(in srgb, var(--gold) 8%, transparent)',
    }}>{ember ? '待重燃' : '已点亮'}</span>
  );
}

/* 三档自评按钮：忘了 / 模糊 / 记得 —— 玻璃底 + 发丝边，色彩各归其位 */
function RSGrade({ label, hint, kbd, keys, icon, color, border, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick} aria-keyshortcuts={keys} className="sr-focus-ring"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
        padding: '14px 10px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer',
        border: '1px solid ' + (hover ? border : 'var(--glass-border)'),
        // hover 底色从主题墨水派生：深空≈原来的星蓝水洗，黎明下自动换成可感知的深色低透明
        background: hover
          ? 'color-mix(in srgb, var(--star-blue) 10%, transparent)'
          : 'color-mix(in srgb, var(--star-blue) 4%, transparent)',
        transition: 'background var(--dur-fast), border-color var(--dur-fast), transform var(--dur-fast)',
        transform: hover ? 'translateY(-1px)' : 'none',
      }}>
      <Icon name={icon} size={18} color={color} />
      <span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{label}</span>
      <span style={{ fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.4 }}>{hint}</span>
      <RSKbd>{kbd}</RSKbd>
    </button>
  );
}

function ReviewSession({ onClose }) {
  const D = window.SR_DATA;
  const toast = window.StellarRaftDesignSystem_2866af.toast;
  // 结束页「去重燃」复用费曼抽屉（渲染时取，脚本加载顺序无关）
  const RelightDrawer = window.SRKit && window.SRKit.FeynmanDrawer;
  // 进场时按真实时间重算一遍，再取到期队列的快照（按到期先后）
  const queue = React.useMemo(() => { D.refreshMemory(); return D.dueStars(); }, []);
  const total = queue.length;

  const [idx, setIdx] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [stats, setStats] = React.useState({ ok: 0, hazy: 0, fail: 0 });
  // 结束页「去重燃」：在会话之上就地打开费曼抽屉（重燃是恢复，出口留在结束页，不打断卡序）
  const [relight, setRelight] = React.useState(null); // starId | null
  const timers = React.useRef([]);
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const done = total === 0 || idx >= total;
  const star = done ? null : queue[idx];
  // 当前卡的认证态：已点亮（差异呈现 + 熄灭警示）/ 待重燃（复习保温，重燃走费曼）
  const starLit = !!(star && D.isLit && D.isLit(star));
  const starEmber = !!(star && D.isEmber && D.isEmber(star));
  // 结束页口径：本轮队列里此刻仍待重燃的星（含本轮被「忘了」讲灭的）——重燃成功即从这里消失
  const emberLeft = done ? queue.filter(s => D.isEmber && D.isEmber(s)) : [];

  // 焦点管理：会话即模态——进场移焦到舞台，退场还给原处
  const stageRef = React.useRef(null);
  React.useEffect(() => {
    const prev = document.activeElement;
    if (stageRef.current) stageRef.current.focus();
    return () => { if (prev && prev.focus) prev.focus(); };
  }, []);
  // 阶段切换（翻开 / 换卡）会卸载刚被点击的按钮，焦点若掉出对话框则收回舞台，
  // 保证键盘与读屏的上下文始终留在会话之内
  React.useEffect(() => {
    const root = stageRef.current;
    if (root && !root.contains(document.activeElement)) root.focus();
  }, [revealed, idx, done]);

  const grade = (kind) => {
    if (!star || leaving) return;
    if (kind === 'fail') {
      const res = D.reviewFail(star.id);
      // 已点亮星「忘了」：模型 ×0.55 并当场熄灭——冷色 toast，认证作废、待重燃
      if (res && res.extinguished && toast) toast(`「${star.label}」已熄灭 · 待重燃`, { icon: 'cloud-off' });
    }
    else if (kind === 'hazy') D.reviewPartial(star.id);
    else {
      const res = D.reviewSuccess(star.id);
      if (res) D.pushTimeline('review', star.id, '复习巩固', res.gained);
      // 已点亮星「记得」走 2.2 档；待重燃星只回亮度，认证要靠费曼重燃
      if (toast) toast(
        starLit ? `记得 · ${star.label} 点亮加固` :
        starEmber ? `记得 · ${star.label} 亮度回来了，重燃还差一次讲透` :
        `记得 · ${star.label} 重新亮起`, { icon: 'check' });
    }
    // 就地广播：星图 / 鸟瞰 / 侧栏角标立即读回新亮度（持久化已在 reviewX 内完成）
    window.dispatchEvent(new CustomEvent('sr-memory'));
    setStats(s => ({ ...s, [kind === 'fail' ? 'fail' : kind === 'hazy' ? 'hazy' : 'ok']: s[kind === 'fail' ? 'fail' : kind === 'hazy' ? 'hazy' : 'ok'] + 1 }));
    const next = () => { setRevealed(false); setLeaving(false); setIdx(i => i + 1); };
    if (rsReduced()) next();
    else { setLeaving(true); timers.current.push(setTimeout(next, 340)); }
  };

  // 键盘：空格翻开 · 1/2/3 或 ←↓→ 评分 · Esc 退出（每次渲染重挂，闭包始终新鲜）
  React.useEffect(() => {
    const h = (e) => {
      // 来源防护：别处已处理过的按键、或正在输入框 / 可编辑区里的敲击，一律不当作评分
      if (e.defaultPrevented) return;
      // 结束页的费曼抽屉（去重燃）开着时让位：抽屉自带 Esc / 焦点圈禁，会话按键全部休眠
      if (relight) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // 焦点圈禁：会话是模态，Tab 只在对话框内部回绕（同 DS Modal 的做法）
      if (e.key === 'Tab') {
        const root = stageRef.current;
        if (!root) return;
        const list = Array.from(root.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ));
        if (!list.length) { e.preventDefault(); root.focus(); return; }
        const inside = root.contains(document.activeElement);
        const i = list.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0 || !inside)) { e.preventDefault(); list[list.length - 1].focus(); }
        else if (!e.shiftKey && (i === list.length - 1 || !inside)) { e.preventDefault(); list[0].focus(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      // 焦点在按钮上时把 Space / Enter 让给原生激活（Tab 到「退出会话」按 Space
      // 应该退出，而不是被抢去翻卡）；只有焦点落在舞台 / 非交互区时才当快捷键
      const onButton = !!(t && t.closest && t.closest('button, a[href], [role="button"]'));
      if (done) {
        if ((e.key === 'Enter' || e.key === ' ') && !onButton) { e.preventDefault(); onClose(); }
        return;
      }
      if (e.key === ' ') {
        if (onButton) return;
        e.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (!revealed) return;
      if (e.key === '1' || e.key === 'ArrowLeft') { e.preventDefault(); grade('fail'); }
      else if (e.key === '2' || e.key === 'ArrowDown') { e.preventDefault(); grade('hazy'); }
      else if (e.key === '3' || e.key === 'ArrowRight') { e.preventDefault(); grade('ok'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const reviewed = stats.ok + stats.hazy + stats.fail;
  const progress = total ? Math.min(idx + (revealed ? 0.5 : 0), total) / total : 1;

  return (
    <div ref={stageRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="复习会话"
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}>
      <style>{`
        @keyframes sr-review-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-30px) scale(0.96); } }
        @media (prefers-reduced-motion: reduce) { .sr-review-card { animation: none !important; } }
      `}</style>
      {/* 压暗 + blur 的深空遮罩（同费曼抽屉 / 设置页惯例，但更沉浸） */}
      <div onClick={onClose} aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: 'rgba(3,4,12,0.66)', WebkitBackdropFilter: 'blur(6px)', backdropFilter: 'blur(6px)' }} />

      <div style={{ position: 'relative', zIndex: 2, width: 580, maxWidth: 'calc(100vw - 48px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* HUD：进度小字 + 发丝进度线 + 退出 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...RS_HUD_SCRIM }}>
            <Icon name="repeat" size={13} color="#9fc6ff" />REVIEW SESSION
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(208,220,255,0.22)', position: 'relative', overflow: 'hidden', borderRadius: 1 }} aria-hidden="true">
            <div style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: '#9fc6ff', opacity: 0.75, transition: 'width var(--dur-base) var(--ease-flight)' }} />
          </div>
          <span style={{ ...RS_HUD_SCRIM, color: RS_SCRIM_INK }} aria-live="polite">
            {done ? `${reviewed} / ${total}` : `${idx + 1} / ${total}`}
          </span>
          <span style={{ display: 'inline-flex', borderRadius: 'var(--r-sm)', background: 'var(--glass-bg)' }}>
            <IconButton name="x" title="退出会话 (Esc)" onClick={onClose} />
          </span>
        </div>

        {/* 空队列：星空明亮 */}
        {total === 0 && (
          <GlassPanel strong radius="lg" pad="none" style={{ padding: '46px 40px', textAlign: 'center', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }} className="sr-review-card">
            <Icon name="sparkles" size={22} color="var(--star-blue)" />
            <div style={{ fontSize: 19, fontWeight: 300, color: 'var(--text-1)', marginTop: 14 }}>没有到期的星</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.7 }}>星空明亮，此刻无需复习。保持节奏，改天再来。</div>
            <div style={{ marginTop: 22 }}>
              <Button variant="secondary" size="md" icon="arrow-left" onClick={onClose}>回到星空</Button>
            </div>
          </GlassPanel>
        )}

        {/* 结束页：克制的总结 */}
        {total > 0 && done && (
          <GlassPanel strong radius="lg" pad="none" className="sr-review-card"
            style={{ padding: '42px 40px', textAlign: 'center', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
            <Icon name="check" size={22} color="var(--star-blue)" />
            <div style={{ fontSize: 21, fontWeight: 300, color: 'var(--text-1)', marginTop: 14, textShadow: 'var(--text-glow-cool)' }}>本轮复习结束</div>
            {/* 「点亮」是奖励保留动词：复习只回亮度，这里说「记得」 */}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, color: 'var(--text-2)', marginTop: 12 }}>
              复习 {reviewed} 颗 · 记得 {stats.ok} 颗{stats.hazy > 0 ? ` · ${stats.hazy} 颗还有些模糊` : ''}{stats.fail > 0 ? ` · ${stats.fail} 颗还需回来` : ''}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.7 }}>
              {stats.fail > 0 ? '暗下去的星已排回队列，它们会在合适的时候等你。' : '星光已经归位。'}
            </div>
            {/* 本轮的熄灭 / 待重燃：逐颗给出「去重燃」出口（费曼快速通道，就地打开） */}
            {emberLeft.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 10 }}>
                  <Icon name="flame" size={14} color="color-mix(in srgb, var(--gold) 60%, var(--text-3))" />
                  本轮有 {emberLeft.length} 颗星熄灭待重燃——把它讲透，光就会回来。
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {emberLeft.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 'var(--r-md)',
                      border: '1px solid color-mix(in srgb, var(--gold) 16%, transparent)', background: 'color-mix(in srgb, var(--gold) 4%, transparent)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: D.conColor(s.con), boxShadow: `0 0 6px ${D.conColor(s.con)}` }} aria-hidden="true" />
                      <span style={{ fontSize: 13, color: 'var(--text-1)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                      <Button size="sm" icon="flame" onClick={() => setRelight(s.id)}>去重燃</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
              <Button variant="primary" size="md" icon="orbit" onClick={onClose}>回到星空</Button>
            </div>
          </GlassPanel>
        )}

        {/* 复习卡：回忆 → 翻开 → 自评 */}
        {star && (
          <GlassPanel key={star.id} strong radius="lg" pad="none" glow className="sr-review-card"
            style={{
              padding: '34px 36px 26px', display: 'flex', flexDirection: 'column', gap: 18,
              animation: leaving ? 'sr-review-out 340ms var(--ease-flight) both' : 'sr-cardin var(--dur-base) var(--ease-flight) both',
            }}>
            {/* 回忆阶段：只有星名 + 星座 */}
            <div style={{ textAlign: 'center', padding: revealed ? '4px 0 0' : '26px 0 8px', transition: 'padding var(--dur-base) var(--ease-flight)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-3)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(star.con), boxShadow: `0 0 8px ${D.conColor(star.con)}` }} aria-hidden="true" />
                  {D.conName(star.con)}
                </span>
                {(starLit || starEmber) && <RSCertChip ember={starEmber} />}
              </div>
              <div style={{ fontSize: revealed ? 24 : 30, fontWeight: 300, color: 'var(--text-1)', textShadow: 'var(--text-glow-cool)', marginTop: 8, transition: 'font-size var(--dur-base) var(--ease-flight)' }}>
                {star.label}
              </div>
              {!revealed && (
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 14, lineHeight: 1.7 }}>
                  先在心里回忆：这颗星讲了什么？
                </div>
              )}
            </div>

            {!revealed && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
                <Button variant="secondary" size="md" icon="chevrons-down" onClick={() => setRevealed(true)} aria-keyshortcuts="Space">
                  展开笔记
                </Button>
              </div>
            )}

            {/* 翻开阶段：摘要 + 大纲 + 三档自评 */}
            {revealed && (
              <React.Fragment>
                <div style={{ height: 1, background: 'var(--line)' }} aria-hidden="true" />
                <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-2)' }}>{star.summary}</div>
                {rsOutline(star).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <span style={RS_HUD}>大纲</span>
                    {rsOutline(star).map(b => (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', flex: 'none', background: 'var(--star-blue)', opacity: 0.55, transform: 'translateY(-2px)' }} aria-hidden="true" />
                        <span style={{ fontSize: 12.5, color: ['h2', 'h3'].includes(b.type) ? 'var(--text-1)' : 'var(--text-3)', lineHeight: 1.6, minWidth: 0 }}>{b.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* 待重燃星翻开后的口径句：复习保温，重燃走费曼 */}
                {starEmber && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, lineHeight: 1.6, color: 'var(--text-3)' }}>
                    <Icon name="flame" size={13} color="color-mix(in srgb, var(--gold) 60%, var(--text-3))" />
                    复习能让它保温——重新点亮，要再讲透一次。
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }} role="group" aria-label="自评这颗星记得如何">
                  {/* 已点亮星的差异呈现：忘了 = 熄灭警示 · 记得 = 点亮加固（间隔更长） */}
                  <RSGrade label="忘了" hint={starLit ? '将熄灭 · 转待重燃' : '重新排回队列'} kbd="1 / ←" keys="1 ArrowLeft" icon="cloud-off"
                    color="var(--danger)" border="rgba(232,145,122,0.4)" onClick={() => grade('fail')} />
                  <RSGrade label="模糊" hint={starLit ? '想起了大概 · 保持点亮' : '想起了大概'} kbd="2 / ↓" keys="2 ArrowDown" icon="haze"
                    color="var(--star-blue-dim)" border="rgba(120,150,205,0.5)" onClick={() => grade('hazy')} />
                  <RSGrade label="记得" hint={starLit ? '点亮加固 · 间隔更长' : '星光如常'} kbd="3 / →" keys="3 ArrowRight" icon="check"
                    color="var(--star-blue)" border="rgba(159,198,255,0.5)" onClick={() => grade('ok')} />
                </div>
              </React.Fragment>
            )}
          </GlassPanel>
        )}

        {/* 键位提示 */}
        {star && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, ...RS_HUD_SCRIM }} aria-hidden="true">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RSKbd onScrim>空格</RSKbd>翻开</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RSKbd onScrim>1 · 2 · 3</RSKbd>评分</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RSKbd onScrim>Esc</RSKbd>退出</span>
          </div>
        )}
      </div>

      {/* 结束页「去重燃」：费曼抽屉盖在会话之上（重燃 = 快速通道）；
          关闭后回到结束页，emberLeft 按当下认证态重算——重燃成功的星就地消失 */}
      {relight && RelightDrawer && (
        <RelightDrawer starId={relight} onClose={() => setRelight(null)} />
      )}
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { ReviewSession });
