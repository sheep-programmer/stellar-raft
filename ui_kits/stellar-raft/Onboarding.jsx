/* Onboarding — 星图手册 · 新手引导。
   分页玻璃导览册（Onboarding）+ 末页聚光实地导览（OnboardingTour）。
   首次打开自动弹出（app.jsx 判 localStorage['sr.onboarded']），设置里可回看。
   props: Onboarding { onClose, onSpotlight } · OnboardingTour { onClose } */
const { Button, GlassPanel, Icon } = window.StellarRaftDesignSystem_2866af;

// 11 页内容：欢迎 · 星图 · 记忆 · 点亮 · 复习 · 收件箱 · 编辑器 · 视角 · 黑洞 · 到访 · 快捷键。
const SR_GUIDE_PAGES = [
  { id: 'welcome',  kicker: 'WELCOME',      icon: 'sparkles',  warm: true,
    title: '知识是唯一的光',   body: '别人的笔记堆在仓库里；你的笔记是一片活着的深空。记得越牢，星越亮；久不回望，它会慢慢变暗。' },
  { id: 'map',      kicker: 'STAR MAP',     icon: 'orbit',     warm: false,
    title: '你的星图',         body: '拖空白平移，滚轮缩放就像飞行般靠近或远离。在空白处右键，建一片星域，或点亮一颗新的知识星。' },
  { id: 'memory',   kicker: 'MEMORY',       icon: 'activity',  warm: false,
    title: '会生长，也会遗忘', body: '每颗星的亮度就是你此刻的记忆强度，按真实时间衰减。放着不看，它会一天天冷下去——这是提醒，不是责备。' },
  { id: 'ignite',   kicker: 'IGNITE',       icon: 'flame',     warm: true,
    title: '点亮一颗星',       body: '在费曼内化模式里把这颗星讲透，它才被真正「点亮」——一次金色的时刻，记忆稳定度随之升起。' },
  { id: 'review',   kicker: 'REVIEW',       icon: 'repeat',    warm: false,
    title: '让星不熄灭',       body: '复习会话按到期先后取卡：忘了 · 模糊 · 记得。间隔重复让亮起来的星，不再悄悄熄灭。' },
  { id: 'inbox',    kicker: 'INBOX',        icon: 'inbox',     warm: false,
    title: '随手收，慢慢理',   body: '灵光一现先 ⌘Enter 收进收件箱，之后按建议一键归入星域。好友的星际来信也落在这里。' },
  { id: 'editor',   kicker: 'EDITOR',       icon: 'pen-line',  warm: false,
    title: '专业的编辑台',     body: '块编辑、markdown 快捷输入、⌘F 查找替换、导入导出——像主流笔记软件一样顺手，又始终安静好看。' },
  { id: 'views',    kicker: 'AERIAL · 3D',  icon: 'satellite', warm: false,
    title: '换一个视角',       body: '亮度鸟瞰把整片星空摊成一张热图，一眼看清哪里正亮、哪里正暗；三维星系则让你在星海里绕行。' },
  { id: 'trash',    kicker: 'BLACK HOLE',   icon: 'aperture',  warm: false,
    title: '删掉的去了哪',     body: '删除的星与星域坠入黑洞，绕着事件视界打转。想它回来，随时把它捞出，位置与连接都还在。' },
  { id: 'visit',    kicker: 'VISIT',        icon: 'telescope', warm: true,
    title: '星与星的相逢',     body: '用分享码邀请好友造访你的星系，也去看看别人的深空。遇到心动的星，把它收进自己的星域。' },
  { id: 'shortcuts', kicker: 'SHORTCUTS',   icon: 'keyboard',  warm: true,
    title: '就这些，去点亮吧', body: '⌘K 跳转任意星 · ⌘F 笔记内查找 · / 唤起块菜单 · Esc 收起浮层。想再看这份手册，去设置里找「上手引导」。' },
];

/* 复用插画：Lucide 图标居中 + 同心发光环 + 星尘。冷蓝(结构)/暖金(奖励)二选一。 */
function GuideArt({ icon, warm }) {
  const c = warm ? '255,217,138' : '159,198,255';
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: 132, height: 132, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'absolute', width: 132, height: 132, borderRadius: '50%', border: '1px solid rgba(' + c + ',0.14)' }} />
      <span style={{ position: 'absolute', width: 92, height: 92, borderRadius: '50%', border: '1px solid rgba(' + c + ',0.22)',
        boxShadow: '0 0 22px rgba(' + c + ',0.16), inset 0 0 18px rgba(' + c + ',0.10)',
        animation: reduce ? 'none' : 'sr-breathe 5.2s var(--ease-flight) infinite' }} />
      <span style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', background: 'rgba(' + c + ',0.06)', filter: 'blur(2px)' }} />
      <Icon name={icon} size={30} color={warm ? 'var(--gold)' : 'var(--star-blue)'} />
      {[[-46, -30, 1.6], [44, -20, 1.2], [30, 42, 1.4], [-38, 34, 1.1]].map((s, i) => (
        <span key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: s[2] * 2, height: s[2] * 2, borderRadius: '50%',
          transform: 'translate(' + s[0] + 'px,' + s[1] + 'px)', background: 'rgba(' + c + ',0.8)', boxShadow: '0 0 6px rgba(' + c + ',0.7)' }} />
      ))}
    </div>
  );
}

function Onboarding({ onClose, onSpotlight }) {
  const [page, setPage] = React.useState(0);
  const total = SR_GUIDE_PAGES.length;
  const last = page === total - 1;
  const p = SR_GUIDE_PAGES[page];

  const modalRef = React.useRef(null);
  (window.SRKit && window.SRKit.useModalFocus ? window.SRKit.useModalFocus : () => {})(modalRef, { swallowCmdK: true });

  React.useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setPage(v => Math.min(v + 1, total - 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setPage(v => Math.max(v - 1, 0)); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose, total]);

  return (
    <div ref={modalRef} onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="新手引导"
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(3,4,12,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: '94vw', height: 520, maxHeight: '92vh', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" pad="none" glow style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* header: kicker + 进度点 + 跳过 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', flex: 'none' }}>
            <span style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{p.kicker}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {SR_GUIDE_PAGES.map((_, i) => (
                <button key={i} type="button" onClick={() => setPage(i)} aria-label={'第 ' + (i + 1) + ' 页'}
                  style={{ width: i === page ? 16 : 7, height: 7, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)',
                    background: i === page ? 'var(--gold)' : 'var(--text-3)', opacity: i === page ? 1 : 0.4,
                    boxShadow: i === page ? '0 0 8px rgba(255,217,138,0.55)' : 'none',
                    transition: 'width var(--dur-base) var(--ease-flight), background var(--dur-fast), opacity var(--dur-fast)' }} />
              ))}
            </div>
            <button type="button" onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>跳过</button>
          </div>

          {/* body: 插画 + 标题 + 短文（Task 2 接入 GuideArt） */}
          <div key={page} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px 40px 20px', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
            <GuideArt icon={p.icon} warm={p.warm} />
            <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-1)', marginTop: 22, letterSpacing: '0.02em', textShadow: '0 0 16px rgba(159,198,255,0.18)' }}>{p.title}</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.85, marginTop: 14, maxWidth: 420 }}>{p.body}</div>
          </div>

          {/* footer: 上一页 / 下一页；末页换 实地看看 + 开始使用 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderTop: '1px solid var(--line)', flex: 'none' }}>
            <Button size="sm" variant="ghost" icon="chevron-left" disabled={page === 0} onClick={() => setPage(v => Math.max(v - 1, 0))}>上一页</Button>
            {last ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <Button size="sm" variant="ghost" icon="compass" onClick={onSpotlight}>实地看看</Button>
                <Button size="sm" variant="primary" glow icon="check" onClick={onClose}>开始使用</Button>
              </div>
            ) : (
              <Button size="sm" variant="primary" icon="chevron-right" iconRight onClick={() => setPage(v => Math.min(v + 1, total - 1))}>下一页</Button>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

// 聚光步骤——只指向星图主界面的稳定 chrome；找不到的目标优雅跳过。
const SR_TOUR_STEPS = [
  { target: '[data-tour="search"]', title: '随时跳转', body: '⌘K 或点这里，跳到任意一颗星、任意一个视图。' },
  { target: '[data-tour="review"]', title: '到期复习', body: '角标是今天到期的星数。点它开始一轮复习，让星不熄灭。' },
  { target: '[data-tour="tools"]',  title: '换个视角', body: '这里切换亮度鸟瞰与三维星系，也能缩放、复位画布。' },
];

function OnboardingTour({ onClose }) {
  const [i, setI] = React.useState(0);
  const [rect, setRect] = React.useState(null);
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 定位当前步目标；找不到则跳过到下一个可见目标，全部找不到就结束。
  const locate = React.useCallback((from) => {
    for (let j = from; j < SR_TOUR_STEPS.length; j++) {
      const el = document.querySelector(SR_TOUR_STEPS[j].target);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { setI(j); setRect(r); return true; }
      }
    }
    return false;
  }, []);

  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (!locate(0)) onClose();
  }, [locate, onClose]);

  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  if (!rect) return null;
  const step = SR_TOUR_STEPS[i];
  const last = i === SR_TOUR_STEPS.length - 1;
  const next = () => { if (last) onClose(); else if (!locate(i + 1)) onClose(); };

  const pad = 8;
  const hole = { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  // 气泡放在光洞右侧；靠右则翻到左侧
  const bubbleLeft = hole.left + hole.width + 14 > window.innerWidth - 300
    ? Math.max(16, hole.left - 300 - 14) : hole.left + hole.width + 14;
  const bubbleTop = Math.min(Math.max(16, hole.top), window.innerHeight - 160);

  return (
    <div onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="实地导览"
      style={{ position: 'fixed', inset: 0, zIndex: 140 }}>
      {/* 挖光洞：目标处透明，四周暗化（超大 spread 阴影）+ 发光描边 */}
      <div style={{ position: 'fixed', left: hole.left, top: hole.top, width: hole.width, height: hole.height,
        borderRadius: 'var(--r-md)', boxShadow: '0 0 0 9999px rgba(3,4,12,0.66), 0 0 22px rgba(159,198,255,0.35)',
        border: '1px solid rgba(159,198,255,0.6)', pointerEvents: 'none',
        transition: reduce ? 'none' : 'left var(--dur-base) var(--ease-flight), top var(--dur-base) var(--ease-flight), width var(--dur-base) var(--ease-flight), height var(--dur-base) var(--ease-flight)' }} />
      {/* 气泡 */}
      <div onMouseDown={(e) => e.stopPropagation()}
        style={{ position: 'fixed', left: bubbleLeft, top: bubbleTop, width: 280, animation: reduce ? 'none' : 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="md" pad="none" glow>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 14.5, color: 'var(--text-1)', fontWeight: 300 }}>{step.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.75, marginTop: 8 }}>{step.body}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{(i + 1)} / {SR_TOUR_STEPS.length}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" variant="ghost" onClick={onClose}>结束</Button>
                <Button size="sm" variant="primary" glow icon={last ? 'check' : 'chevron-right'} onClick={next}>{last ? '完成' : '下一步'}</Button>
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { Onboarding, OnboardingTour });
