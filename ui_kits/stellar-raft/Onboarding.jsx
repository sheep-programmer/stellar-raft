/* Onboarding — 星图手册 · 新手引导。
   分页玻璃导览册（Onboarding）+ 末页聚光实地导览（OnboardingTour）。
   首次打开自动弹出（app.jsx 判 localStorage['sr.onboarded']），设置里可回看。
   props: Onboarding { onClose, onSpotlight } · OnboardingTour { onClose } */
const { Button, GlassPanel, Icon, IconButton } = window.StellarRaftDesignSystem_2866af;

// 11 页内容（Task 2 填满 body 与配图 icon）。此处先放 1 页占位，保证组件可渲染。
const SR_GUIDE_PAGES = [
  { id: 'welcome', kicker: 'WELCOME', icon: 'sparkles', warm: true,
    title: '知识是唯一的光', body: '别人的笔记堆在仓库里；你的笔记是一片活着的深空。' },
];

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
            <Icon name={p.icon} size={40} color={p.warm ? 'var(--gold)' : 'var(--star-blue)'} />
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

// OnboardingTour 占位（Task 3 实现）——先注册，避免 app.jsx 解构 undefined。
function OnboardingTour({ onClose }) { return null; }

window.SRKit = Object.assign(window.SRKit || {}, { Onboarding, OnboardingTour });
