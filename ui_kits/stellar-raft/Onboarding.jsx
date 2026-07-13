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

/* ============================================================
   动画演示：每页一个「假光标 + 迷你场景」循环，演示该操作的真实手势。
   纯 CSS keyframes（注入一次），无外部依赖；prefers-reduced-motion 下全部静音。
   ============================================================ */
const SR_DEMO_CSS = `
.sr-demo{position:relative;width:340px;height:150px;flex:none;border-radius:16px;overflow:hidden;
 background:radial-gradient(130% 110% at 50% 0%,#0b1226 0%,#05060f 72%);
 border:1px solid rgba(159,198,255,.15);box-shadow:inset 0 0 34px rgba(0,0,0,.45)}
.sr-demo *{box-sizing:border-box}
.sr-demo .bd{position:absolute;width:2px;height:2px;border-radius:50%;background:rgba(159,198,255,.45)}
.sr-cur{position:absolute;z-index:9;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))}
.sr-star{position:absolute;border-radius:50%}
.sr-tag{position:absolute;font:600 10px/1 var(--font-mono,monospace);letter-spacing:.05em;
 padding:3px 7px;border-radius:999px;white-space:nowrap}
.sr-demo.reduce *{animation:none!important;animation-play-state:paused!important}

/* — welcome：一颗星被点亮 — */
@keyframes srk-wlight{0%,18%{transform:scale(.7);background:#3a4a7a;box-shadow:0 0 4px rgba(120,150,205,.5)}
 55%,80%{transform:scale(1.12);background:#fff4d6;box-shadow:0 0 22px 4px rgba(255,217,138,.85)}100%{transform:scale(.85);background:#9fc6ff;box-shadow:0 0 10px rgba(159,198,255,.7)}}
@keyframes srk-ring{0%,25%{transform:scale(.4);opacity:0}45%{opacity:.8}100%{transform:scale(2.4);opacity:0}}
@keyframes srk-tw{0%,100%{opacity:.35}50%{opacity:1}}

/* — map：光标拖拽平移 + 右键建星 — */
@keyframes srk-pan{0%,12%{transform:translate(0,0)}30%,46%{transform:translate(-34px,10px)}100%{transform:translate(-34px,10px)}}
@keyframes srk-cur-map{0%{left:80%;top:78%;opacity:0}8%{opacity:1}
 12%{left:58%;top:40%}30%{left:24%;top:50%}      /* 拖拽 */
 46%{left:24%;top:50%}64%{left:70%;top:64%}       /* 移到空白 */
 70%,74%{left:70%;top:64%;transform:scale(.82)}   /* 右键按下 */
 100%{left:70%;top:64%;transform:scale(1)}}
@keyframes srk-grab{0%,12%{opacity:0}14%,46%{opacity:1}48%,100%{opacity:0}}
@keyframes srk-menu{0%,66%{opacity:0;transform:scale(.9)}74%,90%{opacity:1;transform:scale(1)}100%{opacity:0}}
@keyframes srk-newstar{0%,82%{transform:scale(0);opacity:0}92%,100%{transform:scale(1);opacity:1}}

/* — memory：星群逐渐变暗冷却 — */
@keyframes srk-cool{0%,15%{background:#fff4d6;box-shadow:0 0 14px 2px rgba(255,244,214,.8);opacity:1}
 100%{background:#5a74ad;box-shadow:0 0 4px rgba(90,116,173,.5);opacity:.6}}
@keyframes srk-sweep{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}

/* — ignite：讲解→金色点亮 — */
@keyframes srk-line{0%,10%{width:0;opacity:0}20%{opacity:1}40%,100%{width:var(--w,60%);opacity:1}}
@keyframes srk-fire{0%,44%{background:#46608f;transform:scale(.8);box-shadow:0 0 5px rgba(90,116,173,.5)}
 60%{transform:scale(1.35)}68%,88%{background:#fff4d6;transform:scale(1.05);box-shadow:0 0 26px 6px rgba(255,217,138,.9)}100%{transform:scale(1);background:#ffd98a}}
@keyframes srk-burst{0%,50%{transform:scale(.3);opacity:0}62%{opacity:.9}100%{transform:scale(2.6);opacity:0}}
@keyframes srk-chip{0%,60%{opacity:0;transform:translateY(6px)}72%,92%{opacity:1;transform:translateY(0)}100%{opacity:0}}

/* — review：卡片三选，光标点「记得」卡片飞出 — */
@keyframes srk-cur-rev{0%{left:50%;top:88%;opacity:0}10%{opacity:1;left:50%;top:88%}
 40%{left:74%;top:74%}48%,52%{left:74%;top:74%;transform:scale(.82)}100%{left:74%;top:74%;transform:scale(1)}}
@keyframes srk-card{0%,52%{transform:translateX(0) rotate(0);opacity:1}72%,100%{transform:translateX(150px) rotate(9deg);opacity:0}}
@keyframes srk-btn3{0%,48%{background:rgba(159,198,255,.08);color:var(--text-3)}54%,72%{background:rgba(255,217,138,.22);color:#ffd98a}100%{background:rgba(159,198,255,.08)}}

/* — inbox：打字 → ⌘Enter → 卡片落进收件箱 — */
@keyframes srk-type{0%{width:0}30%{width:104px}42%,100%{width:104px}}
@keyframes srk-cap{0%,50%{opacity:0;transform:translateY(0) scale(1)}58%,64%{opacity:1;transform:scale(.96)}
 82%{opacity:1;transform:translateY(56px) scale(.7)}100%{opacity:0;transform:translateY(56px) scale(.6)}}
@keyframes srk-kbd{0%,52%{transform:translateY(0);background:rgba(159,198,255,.1)}58%,64%{transform:translateY(2px);background:rgba(255,217,138,.28)}100%{transform:translateY(0);background:rgba(159,198,255,.1)}}
@keyframes srk-tray{0%,74%{box-shadow:0 0 0 rgba(255,217,138,0)}80%,88%{box-shadow:0 0 14px rgba(255,217,138,.5)}100%{box-shadow:none}}

/* — editor：markdown 即时转换 — */
@keyframes srk-toH{0%,30%{font-size:11px;color:var(--text-3);font-weight:400}42%,100%{font-size:19px;color:#e8eefc;font-weight:300}}
@keyframes srk-toTodo{0%,52%{opacity:0}62%,100%{opacity:1}}
@keyframes srk-check{0%,74%{background:transparent;border-color:rgba(159,198,255,.5)}82%,100%{background:var(--gold);border-color:var(--gold)}}
@keyframes srk-caret{0%,100%{opacity:0}50%{opacity:1}}

/* — views：星图 ↔ 热力网格 切换 — */
@keyframes srk-mapfade{0%,44%{opacity:1}56%,94%{opacity:0}100%{opacity:1}}
@keyframes srk-heatfade{0%,44%{opacity:0}56%,94%{opacity:1}100%{opacity:0}}
@keyframes srk-cur-tog{0%{left:50%;top:26%;opacity:0}12%{opacity:1}40%{left:82%;top:20%}46%,50%{left:82%;top:20%;transform:scale(.82)}100%{left:82%;top:20%;transform:scale(1)}}

/* — trash：光标拖星坠入黑洞 — */
@keyframes srk-cur-tr{0%{left:24%;top:36%;opacity:0}10%{opacity:1}20%{left:24%;top:36%}66%{left:76%;top:66%}70%{opacity:1}80%,100%{opacity:0}}
@keyframes srk-drag{0%,20%{left:24%;top:36%;transform:scale(1) rotate(0);opacity:1}
 66%{left:76%;top:66%;transform:scale(1) rotate(120deg)}86%{left:80%;top:70%;transform:scale(.1) rotate(320deg);opacity:.4}100%{transform:scale(0);opacity:0}}
@keyframes srk-disc{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}

/* — visit：两星系以金弧相连，星被收纳 — */
@keyframes srk-arc{0%,15%{stroke-dashoffset:120;opacity:0}30%{opacity:1}60%,100%{stroke-dashoffset:0;opacity:1}}
@keyframes srk-travel{0%,30%{offset-distance:0%;opacity:0}40%{opacity:1}80%{offset-distance:100%;opacity:1}100%{opacity:0}}
@keyframes srk-adopt{0%,78%{transform:scale(0);opacity:0}90%,100%{transform:scale(1);opacity:1}}

/* — shortcuts：键位依次按下 — */
@keyframes srk-press{0%,100%{transform:translateY(0);background:rgba(159,198,255,.08);border-color:rgba(159,198,255,.25)}
 40%,60%{transform:translateY(2px);background:rgba(255,217,138,.22);border-color:rgba(255,217,138,.6);color:#ffd98a}}
`;

function injectDemoCss() {
  if (typeof document === 'undefined' || document.getElementById('sr-onb-demo-css')) return;
  const s = document.createElement('style'); s.id = 'sr-onb-demo-css'; s.textContent = SR_DEMO_CSS;
  document.head.appendChild(s);
}

/* 假光标（指针箭头） */
function Cursor({ style, className }) {
  return (
    <svg className={'sr-cur ' + (className || '')} style={style} width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 2 L4 19 L8.6 14 L11.7 20.6 L14.4 19.5 L11.2 13 L18 12.5 Z" fill="#eef3ff" stroke="#05060f" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
const Field = () => (
  <div aria-hidden="true">
    {[[16, 22], [300, 30], [60, 120], [280, 110], [200, 18], [120, 60], [250, 70], [40, 95], [320, 80], [160, 130]].map((d, i) => (
      <span key={i} className="bd" style={{ left: d[0], top: d[1], animation: `srk-tw ${2.4 + (i % 4) * 0.7}s ease-in-out ${i * 0.3}s infinite` }} />
    ))}
  </div>
);
const dot = (x, y, size, bg, glow) => ({ left: x, top: y, width: size, height: size, background: bg, boxShadow: glow, marginLeft: -size / 2, marginTop: -size / 2 });

/* 每页的演示场景。id → 一个 340×150 迷你舞台的循环动画。 */
function GuideDemo({ id, warm }) {
  React.useEffect(() => { injectDemoCss(); }, []);
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scenes = {
    welcome: (
      <>
        <Field />
        <span className="sr-star" style={{ ...dot(170, 78, 16, '#3a4a7a'), animation: 'srk-wlight 4.2s var(--ease-flight) infinite' }} />
        <span style={{ position: 'absolute', left: 170, top: 78, width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: '50%', border: '1.5px solid rgba(255,217,138,.7)', animation: 'srk-ring 4.2s var(--ease-flight) infinite' }} />
        <span className="sr-star" style={dot(90, 46, 4, 'rgba(159,198,255,.7)')} />
        <span className="sr-star" style={dot(258, 60, 5, 'rgba(255,217,138,.6)')} />
        <span className="sr-star" style={dot(250, 116, 3, 'rgba(159,198,255,.6)')} />
      </>
    ),
    map: (
      <>
        <Field />
        <div style={{ position: 'absolute', inset: 0, animation: 'srk-pan 6s var(--ease-flight) infinite' }}>
          <span className="sr-star" style={dot(150, 60, 14, '#ffd98a', '0 0 14px rgba(255,217,138,.7)')} />
          <span className="sr-star" style={dot(96, 96, 7, '#9fc6ff', '0 0 8px rgba(159,198,255,.6)')} />
          <span className="sr-star" style={dot(200, 100, 6, '#c7dcff')} />
          <span className="sr-star" style={dot(214, 44, 5, '#fff4d6')} />
        </div>
        <span className="sr-tag" style={{ left: 202, top: 52, background: 'rgba(14,19,44,.9)', border: '1px solid rgba(159,198,255,.3)', color: '#c9d6f0', animation: 'srk-menu 6s var(--ease-flight) infinite' }}>+ 建知识星</span>
        <span className="sr-star" style={{ ...dot(214, 78, 12, '#9fc6ff', '0 0 12px rgba(159,198,255,.8)'), animation: 'srk-newstar 6s var(--ease-flight) infinite' }} />
        <span style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, background: 'transparent', animation: 'srk-grab 6s linear infinite', pointerEvents: 'none' }} />
        <Cursor style={{ animation: 'srk-cur-map 6s var(--ease-flight) infinite' }} />
      </>
    ),
    memory: (
      <>
        <Field />
        {[[110, 55, 13], [180, 90, 10], [240, 50, 9], [150, 112, 8]].map((s, i) => (
          <span key={i} className="sr-star" style={{ ...dot(s[0], s[1], s[2], '#fff4d6'), animation: `srk-cool ${4.4}s var(--ease-flight) ${i * 0.25}s infinite` }} />
        ))}
        <span style={{ position: 'absolute', left: 300, top: 26, width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: '50%', border: '1px solid rgba(159,198,255,.3)' }}>
          <span style={{ position: 'absolute', left: '50%', top: '50%', width: 1.5, height: 8, background: 'rgba(159,198,255,.8)', transformOrigin: '50% 0', animation: 'srk-sweep 4.4s linear infinite' }} />
        </span>
        <span className="sr-tag" style={{ left: 16, top: 122, background: 'transparent', color: 'var(--text-3)' }}>R = e^(−Δt/S)</span>
      </>
    ),
    ignite: (
      <>
        <Field />
        <div style={{ position: 'absolute', left: 26, top: 34, width: 150 }}>
          {[62, 92, 74].map((w, i) => (
            <span key={i} style={{ display: 'block', height: 5, borderRadius: 3, marginBottom: 9, background: 'rgba(159,198,255,.35)', '--w': w + 'px', width: 0, animation: `srk-line 4.6s var(--ease-flight) ${0.3 + i * 0.5}s infinite` }} />
          ))}
        </div>
        <span className="sr-star" style={{ ...dot(250, 74, 15, '#46608f'), animation: 'srk-fire 4.6s var(--ease-flight) infinite' }} />
        <span style={{ position: 'absolute', left: 250, top: 74, width: 15, height: 15, marginLeft: -7.5, marginTop: -7.5, borderRadius: '50%', border: '1.5px solid rgba(255,217,138,.85)', animation: 'srk-burst 4.6s var(--ease-flight) infinite' }} />
        <span className="sr-tag" style={{ left: 224, top: 104, background: 'rgba(255,217,138,.14)', border: '1px solid rgba(255,217,138,.5)', color: '#ffd98a', animation: 'srk-chip 4.6s var(--ease-flight) infinite' }}>点亮 +1</span>
      </>
    ),
    review: (
      <>
        <Field />
        <div style={{ position: 'absolute', left: 90, top: 20, width: 160, height: 74, borderRadius: 12, background: 'rgba(14,19,44,.92)', border: '1px solid rgba(159,198,255,.28)', boxShadow: '0 6px 18px rgba(0,0,0,.4)', animation: 'srk-card 4.4s var(--ease-flight) infinite' }}>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>量子力学</div>
            <div style={{ fontSize: 14, color: 'var(--text-1)', marginTop: 6, fontWeight: 300 }}>贝尔不等式</div>
          </div>
        </div>
        {['忘了', '模糊', '记得'].map((t, i) => (
          <span key={i} className="sr-tag" style={{ left: 90 + i * 58, top: 108, background: 'rgba(159,198,255,.08)', color: 'var(--text-3)', border: '1px solid rgba(159,198,255,.18)', ...(i === 2 ? { animation: 'srk-btn3 4.4s var(--ease-flight) infinite' } : {}) }}>{t}</span>
        ))}
        <Cursor style={{ animation: 'srk-cur-rev 4.4s var(--ease-flight) infinite' }} />
      </>
    ),
    inbox: (
      <>
        <Field />
        <div style={{ position: 'absolute', left: 60, top: 30, width: 150, height: 34, borderRadius: 10, background: 'rgba(14,19,44,.9)', border: '1px solid rgba(159,198,255,.25)', display: 'flex', alignItems: 'center', padding: '0 12px', animation: 'srk-cap 4.6s var(--ease-flight) infinite' }}>
          <span style={{ height: 6, borderRadius: 3, background: 'rgba(159,198,255,.6)', animation: 'srk-type 4.6s steps(12) infinite' }} />
        </div>
        <span className="sr-tag" style={{ left: 226, top: 40, background: 'rgba(159,198,255,.1)', border: '1px solid rgba(159,198,255,.3)', color: '#c9d6f0', animation: 'srk-kbd 4.6s var(--ease-flight) infinite' }}>⌘ Enter</span>
        <div style={{ position: 'absolute', left: 118, top: 104, width: 100, height: 26, borderRadius: 8, border: '1px dashed rgba(159,198,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', animation: 'srk-tray 4.6s var(--ease-flight) infinite' }}>收件箱</div>
      </>
    ),
    editor: (
      <>
        <Field />
        <div style={{ position: 'absolute', left: 40, top: 34, width: 260 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', animation: 'srk-toH 5s var(--ease-flight) infinite' }}>
            贝尔不等式<span style={{ width: 2, height: '1em', background: 'var(--gold)', marginLeft: 2, display: 'inline-block', animation: 'srk-caret 1s step-end infinite' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, animation: 'srk-toTodo 5s var(--ease-flight) infinite' }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, border: '1.5px solid rgba(159,198,255,.5)', flex: 'none', animation: 'srk-check 5s var(--ease-flight) infinite' }} />
            <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>复现 CHSH 推导</span>
          </div>
        </div>
        <span className="sr-tag" style={{ left: 20, top: 122, background: 'transparent', color: 'var(--text-3)' }}># · [] · ⌘F</span>
      </>
    ),
    views: (
      <>
        <div style={{ position: 'absolute', inset: 0, animation: 'srk-mapfade 5s var(--ease-flight) infinite' }}>
          <Field />
          <span className="sr-star" style={dot(120, 70, 12, '#ffd98a', '0 0 12px rgba(255,217,138,.6)')} />
          <span className="sr-star" style={dot(210, 90, 8, '#9fc6ff')} />
          <span className="sr-star" style={dot(180, 46, 6, '#c7dcff')} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: 0, animation: 'srk-heatfade 5s var(--ease-flight) infinite', display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gridTemplateRows: 'repeat(3,1fr)', gap: 4, padding: 16 }}>
          {['#ffd98a', '#c9a86a', '#7896cd', '#46608f', '#9fc6ff', '#3a4a7a', '#c9a86a', '#ffd98a', '#46608f', '#5a74ad', '#7896cd', '#9fc6ff', '#3a4a7a', '#46608f', '#c9a86a', '#7896cd', '#9fc6ff', '#5a74ad'].map((c, i) => (
            <span key={i} style={{ borderRadius: 5, background: c, opacity: 0.85 }} />
          ))}
        </div>
        <Cursor style={{ animation: 'srk-cur-tog 5s var(--ease-flight) infinite' }} />
        <span className="sr-tag" style={{ right: 14, top: 12, position: 'absolute', background: 'rgba(159,198,255,.1)', border: '1px solid rgba(159,198,255,.3)', color: '#c9d6f0' }}>鸟瞰</span>
      </>
    ),
    trash: (
      <>
        <Field />
        <span style={{ position: 'absolute', left: 280, top: 100, width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: '50%', background: 'radial-gradient(circle,#05060f 40%,rgba(159,198,255,.15) 70%,transparent)', border: '1px solid rgba(159,198,255,.25)' }}>
          <span style={{ position: 'absolute', inset: 3, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'rgba(255,217,138,.6)', borderRightColor: 'rgba(159,198,255,.4)', animation: 'srk-disc 2s linear infinite' }} />
        </span>
        <span className="sr-star" style={{ ...dot(0, 0, 14, '#9fc6ff', '0 0 12px rgba(159,198,255,.7)'), left: 0, top: 0, animation: 'srk-drag 4.6s var(--ease-flight) infinite' }} />
        <Cursor style={{ animation: 'srk-cur-tr 4.6s var(--ease-flight) infinite' }} />
      </>
    ),
    visit: (
      <>
        <Field />
        {/* 左星系 */}
        <span className="sr-star" style={dot(64, 74, 16, '#ffd98a', '0 0 14px rgba(255,217,138,.6)')} />
        <span className="sr-star" style={dot(44, 54, 5, '#9fc6ff')} />
        <span className="sr-star" style={dot(88, 96, 5, '#c7dcff')} />
        {/* 右星系 */}
        <span className="sr-star" style={dot(276, 76, 16, '#9fc6ff', '0 0 12px rgba(159,198,255,.6)')} />
        <span className="sr-star" style={dot(300, 100, 5, '#c7dcff')} />
        <svg style={{ position: 'absolute', inset: 0 }} width="340" height="150" aria-hidden="true">
          <path id="sr-visit-arc" d="M64 74 C 150 20, 200 20, 276 76" fill="none" stroke="#ffd98a" strokeWidth="1.6" strokeDasharray="120" style={{ animation: 'srk-arc 4.6s var(--ease-flight) infinite' }} />
        </svg>
        <span style={{ position: 'absolute', width: 5, height: 5, borderRadius: '50%', background: '#fff4d6', boxShadow: '0 0 8px rgba(255,217,138,.9)', offsetPath: 'path("M64 74 C 150 20, 200 20, 276 76")', animation: 'srk-travel 4.6s var(--ease-flight) infinite' }} />
        <span className="sr-star" style={{ ...dot(300, 56, 9, '#ffd98a', '0 0 10px rgba(255,217,138,.8)'), animation: 'srk-adopt 4.6s var(--ease-flight) infinite' }} />
      </>
    ),
    shortcuts: (
      <>
        <Field />
        {[['⌘K', 40], ['⌘F', 118], ['/', 196], ['Esc', 250]].map((k, i) => (
          <span key={i} style={{ position: 'absolute', left: k[1], top: 60, minWidth: 34, height: 30, padding: '0 9px', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', border: '1px solid rgba(159,198,255,.25)', background: 'rgba(159,198,255,.08)', animation: `srk-press 4.4s var(--ease-flight) ${i * 0.9}s infinite` }}>{k[0]}</span>
        ))}
        <span className="sr-tag" style={{ left: 40, top: 108, background: 'transparent', color: 'var(--text-3)' }}>KEYBOARD</span>
      </>
    ),
  };

  return (
    <div className={'sr-demo' + (reduce ? ' reduce' : '')} aria-hidden="true" data-demo={id}>
      {scenes[id] || scenes.welcome}
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
            <GuideDemo id={p.id} warm={p.warm} />
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
