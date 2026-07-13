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
   工艺要点：全部 transform 合成器动画（光标不走 left/top）·
   逐段缓动（keyframe 内覆写 timing-function）· 循环首尾状态闭合 ·
   点击金色脉冲反馈 · 拖拽与画布位移物理同步。
   纯 CSS keyframes（注入一次），零依赖；prefers-reduced-motion 静音成静态构图。
   ============================================================ */
const SR_DEMO_CSS = `
.sr-demo{position:relative;width:360px;height:160px;flex:none;border-radius:16px;overflow:hidden;
 background:radial-gradient(130% 115% at 50% 0%,#0b1226 0%,#05060f 74%);
 border:1px solid rgba(159,198,255,.15);box-shadow:inset 0 0 36px rgba(0,0,0,.45)}
.sr-demo *{box-sizing:border-box}
.sr-demo .bd{position:absolute;width:2px;height:2px;border-radius:50%;background:rgba(159,198,255,.45)}
.sr-star{position:absolute;border-radius:50%}
.sr-cur{position:absolute;left:0;top:0;z-index:9;opacity:0;pointer-events:none;will-change:transform;
 filter:drop-shadow(0 2px 3px rgba(0,0,0,.65))}
.sr-pulse{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;
 border:1.5px solid rgba(255,217,138,.8);opacity:0;pointer-events:none}
.sr-tag{position:absolute;font:600 10px/1 var(--font-mono,monospace);letter-spacing:.05em;
 padding:3px 8px;border-radius:999px;white-space:nowrap}
.sr-demo.reduce *{animation:none!important}
@keyframes dm-tw{0%,100%{opacity:.3}50%{opacity:.9}}
@keyframes dm-spin{to{transform:rotate(360deg)}}

/* — welcome（5s）：一颗星被点亮，闭环回到暗星 — */
@keyframes w-star{0%{background:#4a5c8a;transform:scale(.78);box-shadow:0 0 6px rgba(90,116,173,.5)}
 30%{background:#9fc6ff;box-shadow:0 0 10px rgba(159,198,255,.6)}
 44%{background:#fff4d6;transform:scale(1.16);box-shadow:0 0 30px 8px rgba(255,244,214,.95)}
 54%{transform:scale(.98)}60%{background:#ffd98a;transform:scale(1.04);box-shadow:0 0 18px 4px rgba(255,217,138,.7)}
 78%{background:#ffd98a;transform:scale(1);box-shadow:0 0 14px 3px rgba(255,217,138,.6)}
 100%{background:#4a5c8a;transform:scale(.78);box-shadow:0 0 6px rgba(90,116,173,.5)}}
@keyframes w-ring{0%,36%{transform:scale(.35);opacity:0}44%{opacity:.85}62%,100%{transform:scale(2.6);opacity:0}}
@keyframes w-spike{0%,38%{opacity:0;transform:scale(.2) rotate(var(--r,0deg))}46%,58%{opacity:.85;transform:scale(1) rotate(var(--r,0deg))}72%,100%{opacity:0;transform:scale(.2) rotate(var(--r,0deg))}}

/* — map（7s）：拖拽平移（画布同步）→ 右键 → 菜单 → 新星 — */
@keyframes mp-cur{0%{transform:translate(272px,124px);opacity:0}5%{opacity:1}6%{transform:translate(272px,124px)}
 14%{transform:translate(202px,96px)}16%{transform:translate(202px,96px);animation-timing-function:cubic-bezier(.65,0,.35,1)}
 38%,40%{transform:translate(137px,71px)}
 50%{transform:translate(242px,54px)}62%{transform:translate(296px,94px)}
 76%{transform:translate(296px,94px);opacity:1}84%{transform:translate(306px,110px);opacity:0}
 100%{transform:translate(272px,124px);opacity:0}}
@keyframes mp-press{0%,13%{transform:scale(1)}15%,39%{transform:scale(.85)}41%,51%{transform:scale(1)}
 53%,54%{transform:scale(.85)}56%,61%{transform:scale(1)}63%,64%{transform:scale(.85)}66%,100%{transform:scale(1)}}
@keyframes mp-pan{0%,16%{transform:translate(0,0);animation-timing-function:cubic-bezier(.65,0,.35,1)}
 38%,84%{transform:translate(-65px,-25px);animation-timing-function:cubic-bezier(.65,0,.35,1)}
 96%,100%{transform:translate(0,0)}}
@keyframes mp-pulse1{0%,51%{transform:scale(.3);opacity:0}53%{opacity:.75}62%,100%{transform:scale(1.9);opacity:0}}
@keyframes mp-pulse2{0%,62%{transform:scale(.3);opacity:0}64%{opacity:.75}73%,100%{transform:scale(1.9);opacity:0}}
@keyframes mp-menu{0%,54%{opacity:0;transform:translateY(5px) scale(.95)}58%,69%{opacity:1;transform:translateY(0) scale(1)}
 73%,100%{opacity:0;transform:translateY(0) scale(.98)}}
@keyframes mp-row{0%,62%{background:transparent;color:#c9d6f0}64%,69%{background:rgba(255,217,138,.15);color:#ffd98a}
 70%,100%{background:transparent;color:#c9d6f0}}
@keyframes mp-star{0%,73%{transform:scale(0);opacity:0}77%{opacity:1}78%{transform:scale(1.25)}81%{transform:scale(1)}
 90%{transform:scale(1);opacity:1}97%,100%{transform:scale(.5);opacity:0}}
@keyframes mp-ring{0%,74%{transform:scale(.3);opacity:0}79%{opacity:.85}90%,100%{transform:scale(2.3);opacity:0}}

/* — memory（5.5s）：星群冷却变暗 → 一次复习回暖，闭环 — */
@keyframes me-cool{0%,10%{background:#fff1cf;box-shadow:0 0 12px 2px rgba(255,241,207,.8)}
 60%,78%{background:#5a74ad;box-shadow:0 0 4px rgba(90,116,173,.45)}
 88%{background:#ffe9b8;box-shadow:0 0 14px 3px rgba(255,233,184,.85)}
 96%,100%{background:#fff1cf;box-shadow:0 0 12px 2px rgba(255,241,207,.8)}}
@keyframes me-mark{0%,10%{transform:translateX(4px)}60%,78%{transform:translateX(78px)}
 88%{transform:translateX(18px)}96%,100%{transform:translateX(4px)}}

/* — ignite（5.5s）：讲解逐行铺开 → 金色点亮爆发 + 粒子环 — */
@keyframes ig-l1{0%,8%{transform:scaleX(0)}18%,100%{transform:scaleX(1)}}
@keyframes ig-l2{0%,20%{transform:scaleX(0)}32%,100%{transform:scaleX(1)}}
@keyframes ig-l3{0%,34%{transform:scaleX(0)}46%,100%{transform:scaleX(1)}}
@keyframes ig-star{0%,48%{background:#46608f;transform:scale(.85);box-shadow:0 0 6px rgba(90,116,173,.5)}
 56%{transform:scale(1.3);animation-timing-function:cubic-bezier(.22,1,.36,1)}
 60%{background:#fff4d6;box-shadow:0 0 26px 8px rgba(255,217,138,.9)}64%{transform:scale(1.02)}
 80%,90%{background:#ffd98a;transform:scale(1);box-shadow:0 0 14px 3px rgba(255,217,138,.6)}
 98%,100%{background:#46608f;transform:scale(.85);box-shadow:0 0 6px rgba(90,116,173,.5)}}
@keyframes ig-ring{0%,52%{transform:scale(.3);opacity:0}58%{opacity:.9}72%,100%{transform:scale(2.6);opacity:0}}
@keyframes ig-p{0%,54%{transform:translate(0,0) scale(1);opacity:0}57%{opacity:1}
 74%,100%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
@keyframes ig-conn{0%,50%{stroke:rgba(159,198,255,.25)}60%,80%{stroke:rgba(255,217,138,.7)}95%,100%{stroke:rgba(159,198,255,.25)}}
@keyframes ig-wrap{0%{opacity:0}4%{opacity:1}92%{opacity:1}98%,100%{opacity:0}}
@keyframes ig-chip{0%,58%{opacity:0;transform:translateY(6px)}64%,84%{opacity:1;transform:translateY(0)}
 92%,100%{opacity:0;transform:translateY(-4px)}}

/* — review（5s）：点「记得」→ 卡片飞出 → 下一张滑入（无缝洗牌） — */
@keyframes rv-cur{0%{transform:translate(196px,134px);opacity:0}8%{opacity:1}
 24%{transform:translate(258px,117px)}44%,58%{transform:translate(258px,117px)}
 72%{transform:translate(286px,138px);opacity:1}82%,100%{transform:translate(286px,138px);opacity:0}}
@keyframes rv-press{0%,43%{transform:scale(1)}45%,47%{transform:scale(.85)}50%,100%{transform:scale(1)}}
@keyframes rv-pulse{0%,44%{transform:scale(.3);opacity:0}46%{opacity:.75}56%,100%{transform:scale(1.9);opacity:0}}
@keyframes rv-btn{0%,44%{background:rgba(159,198,255,.08);border-color:rgba(159,198,255,.18);color:#8a94a8}
 47%,62%{background:rgba(255,217,138,.2);border-color:rgba(255,217,138,.55);color:#ffd98a}
 70%,100%{background:rgba(159,198,255,.08);border-color:rgba(159,198,255,.18);color:#8a94a8}}
@keyframes rv-card1{0%,48%{transform:translate(0,0) rotate(0);opacity:1;animation-timing-function:cubic-bezier(.5,0,.75,0)}
 64%,100%{transform:translate(190px,-10px) rotate(8deg);opacity:0}}
@keyframes rv-card2{0%,60%{transform:translate(-190px,8px) rotate(-6deg);opacity:0}64%{opacity:1}
 78%,100%{transform:translate(0,0) rotate(0);opacity:1}}
@keyframes rv-chip{0%,50%{opacity:0;transform:translateY(6px)}56%,70%{opacity:1;transform:translateY(0)}
 78%,100%{opacity:0;transform:translateY(-6px)}}

/* — inbox（5.5s）：打字 → ⌘Enter 键按下 → 卡片弧线落入收件箱 — */
@keyframes ib-wrap{0%{opacity:0}5%{opacity:1}92%{opacity:1}98%,100%{opacity:0}}
@keyframes ib-type{0%,6%{width:0}30%,100%{width:100px}}
@keyframes ib-key{0%,44%{transform:translateY(0);background:rgba(159,198,255,.08);border-color:rgba(159,198,255,.25);color:#c9d6f0;box-shadow:0 3px 0 rgba(8,12,28,.95)}
 48%,54%{transform:translateY(3px);background:rgba(255,217,138,.22);border-color:rgba(255,217,138,.6);color:#ffd98a;box-shadow:0 0 0 rgba(8,12,28,.95)}
 58%,100%{transform:translateY(0);background:rgba(159,198,255,.08);border-color:rgba(159,198,255,.25);color:#c9d6f0;box-shadow:0 3px 0 rgba(8,12,28,.95)}}
@keyframes ib-chip{0%,50%{opacity:0;transform:translate(0,0) scale(1)}
 54%{opacity:1;transform:translate(0,0) scale(1);animation-timing-function:cubic-bezier(.5,0,.75,0)}
 74%{transform:translate(58px,66px) scale(.5);opacity:.9}78%,100%{opacity:0;transform:translate(58px,66px) scale(.4)}}
@keyframes ib-tray{0%,72%{border-color:rgba(159,198,255,.35);box-shadow:none}
 76%,84%{border-color:rgba(255,217,138,.6);box-shadow:0 0 14px rgba(255,217,138,.35)}
 92%,100%{border-color:rgba(159,198,255,.35);box-shadow:none}}
@keyframes ib-n3{0%,76%{opacity:1;transform:translateY(0)}82%,100%{opacity:0;transform:translateY(-5px)}}
@keyframes ib-n4{0%,77%{opacity:0;transform:translateY(5px)}84%,100%{opacity:1;transform:translateY(0)}}

/* — editor（5.5s）：# 前缀即时转标题 · [] 转待办 · 勾选划线 — */
@keyframes ed-wrap{0%{opacity:0}4%{opacity:1}93%{opacity:1}99%,100%{opacity:0}}
@keyframes ed-t1{0%,6%{clip-path:inset(0 100% 0 0)}24%,100%{clip-path:inset(0 -8% 0 0)}}
@keyframes ed-hash{0%,5%{opacity:0;width:0}7%,28%{opacity:1;width:15px}33%,100%{opacity:0;width:0}}
@keyframes ed-size{0%,28%{font-size:12px;color:#8a94a8}36%,100%{font-size:19px;color:#e8eefc}}
@keyframes ed-l2{0%,42%{opacity:0}46%,100%{opacity:1}}
@keyframes ed-t2{0%,46%{clip-path:inset(0 100% 0 0)}64%,100%{clip-path:inset(0 -8% 0 0)}}
@keyframes ed-br{0%,44%{opacity:0;width:0}46%,62%{opacity:1;width:18px}67%,100%{opacity:0;width:0}}
@keyframes ed-box{0%,64%{opacity:0;transform:scale(.6)}69%,100%{opacity:1;transform:scale(1)}}
@keyframes ed-fill{0%,76%{background:transparent;border-color:rgba(159,198,255,.5)}82%,100%{background:#ffd98a;border-color:#ffd98a}}
@keyframes ed-check{0%,78%{stroke-dashoffset:14}86%,100%{stroke-dashoffset:0}}
@keyframes ed-blink{0%,49%{opacity:1}50%,100%{opacity:0}}

/* — views（6s）：点分段开关 星图 ⇄ 鸟瞰热图（热图格子逐格铺开） — */
@keyframes vw-cur{0%{transform:translate(180px,120px);opacity:0}8%{opacity:1}
 22%{transform:translate(294px,27px)}40%,42%{transform:translate(294px,27px)}
 56%{transform:translate(272px,27px)}66%,68%{transform:translate(272px,27px)}
 80%{transform:translate(240px,84px);opacity:1}90%,100%{transform:translate(240px,84px);opacity:0}}
@keyframes vw-press{0%,39%{transform:scale(1)}41%,43%{transform:scale(.85)}45%,65%{transform:scale(1)}
 67%,69%{transform:scale(.85)}71%,100%{transform:scale(1)}}
@keyframes vw-pulse1{0%,40%{transform:scale(.3);opacity:0}42%{opacity:.75}52%,100%{transform:scale(1.9);opacity:0}}
@keyframes vw-pulse2{0%,66%{transform:scale(.3);opacity:0}68%{opacity:.75}78%,100%{transform:scale(1.9);opacity:0}}
@keyframes vw-thumb{0%,41%{transform:translateX(0)}45%,67%{transform:translateX(46px)}71%,100%{transform:translateX(0)}}
@keyframes vw-lab1{0%,41%{color:#e8eefc}45%,67%{color:#8a94a8}71%,100%{color:#e8eefc}}
@keyframes vw-lab2{0%,41%{color:#8a94a8}45%,67%{color:#e8eefc}71%,100%{color:#8a94a8}}
@keyframes vw-map{0%,42%{opacity:1;transform:scale(1)}48%,68%{opacity:0;transform:scale(.93)}76%,100%{opacity:1;transform:scale(1)}}
@keyframes vw-cell{0%,44%{opacity:0;transform:scale(.5)}50%,66%{opacity:.92;transform:scale(1)}72%,100%{opacity:0;transform:scale(.5)}}

/* — trash（5.5s）：拖星到黑洞 → 螺旋吞没 → 星域重生，闭环 — */
@keyframes tr-cur{0%{transform:translate(38px,124px);opacity:0}6%{opacity:1}
 16%{transform:translate(70px,52px)}18%{transform:translate(70px,52px);animation-timing-function:cubic-bezier(.65,0,.35,1)}
 50%,52%{transform:translate(236px,92px)}
 64%{transform:translate(206px,124px);opacity:1}74%,100%{transform:translate(206px,124px);opacity:0}}
@keyframes tr-press{0%,15%{transform:scale(1)}17%,51%{transform:scale(.85)}54%,100%{transform:scale(1)}}
@keyframes tr-star{0%,18%{transform:translate(70px,52px) rotate(0) scale(1);opacity:1;animation-timing-function:cubic-bezier(.65,0,.35,1)}
 50%{transform:translate(236px,92px) rotate(50deg) scale(1);animation-timing-function:cubic-bezier(.5,0,.75,0)}
 66%{transform:translate(272px,104px) rotate(460deg) scale(0);opacity:.9}
 67%,88%{transform:translate(70px,52px) scale(0);opacity:0}
 96%,100%{transform:translate(70px,52px) rotate(0) scale(1);opacity:1}}
@keyframes tr-flash{0%,62%{box-shadow:0 0 0 rgba(255,217,138,0)}66%,72%{box-shadow:0 0 18px rgba(255,217,138,.5)}
 80%,100%{box-shadow:0 0 0 rgba(255,217,138,0)}}

/* — visit（5.5s）：金弧相连 → 光点旅行 → 收纳新星 — */
@keyframes vi-arc{0%,10%{stroke-dashoffset:300;opacity:0}16%{opacity:1}48%,86%{stroke-dashoffset:0;opacity:1}
 94%,100%{stroke-dashoffset:0;opacity:0}}
@keyframes vi-dot{0%,24%{offset-distance:0%;opacity:0}30%{opacity:1}62%{offset-distance:100%;opacity:1}
 66%,100%{offset-distance:100%;opacity:0}}
@keyframes vi-adopt{0%,64%{transform:scale(0);opacity:0}70%{transform:scale(1.25);opacity:1}
 74%,88%{transform:scale(1);opacity:1}96%,100%{transform:scale(0);opacity:0}}
@keyframes vi-ring{0%,65%{transform:scale(.3);opacity:0}70%{opacity:.85}80%,100%{transform:scale(2.3);opacity:0}}
@keyframes vi-chip{0%,68%{opacity:0;transform:translateY(5px)}74%,86%{opacity:1;transform:translateY(0)}
 94%,100%{opacity:0;transform:translateY(-4px)}}

/* — shortcuts（4.8s）：键帽依次按下（3D 底边压缩 + 金色亮起） — */
@keyframes sc-key{0%,4%{transform:translateY(0);box-shadow:0 3px 0 rgba(8,12,28,.95),0 5px 10px rgba(0,0,0,.35);background:rgba(159,198,255,.07);color:#c9d6f0;border-color:rgba(159,198,255,.22)}
 8%,14%{transform:translateY(3px);box-shadow:0 0 0 rgba(8,12,28,.95),0 0 14px rgba(255,217,138,.4);background:rgba(255,217,138,.2);color:#ffd98a;border-color:rgba(255,217,138,.55)}
 19%,100%{transform:translateY(0);box-shadow:0 3px 0 rgba(8,12,28,.95),0 5px 10px rgba(0,0,0,.35);background:rgba(159,198,255,.07);color:#c9d6f0;border-color:rgba(159,198,255,.22)}}
`;

function injectDemoCss() {
  if (typeof document === 'undefined' || document.getElementById('sr-onb-demo-css')) return;
  const s = document.createElement('style'); s.id = 'sr-onb-demo-css'; s.textContent = SR_DEMO_CSS;
  document.head.appendChild(s);
}

const EO = 'cubic-bezier(.22,1,.36,1)'; // ease-out-quint：默认逐段缓动

/* 假光标：外层走位（translate keyframes），内层按压缩放，尖端为原点 */
function Cursor({ move, press, dur }) {
  return (
    <span className="sr-cur" style={{ animation: `${move} ${dur} ${EO} infinite` }}>
      <svg style={{ display: 'block', transformOrigin: '4px 3px', animation: press ? `${press} ${dur} ${EO} infinite` : 'none' }}
        width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3 L5 20.5 L9.8 15.7 L12.6 22 L15.6 20.7 L12.8 14.6 L19.5 14 Z"
          fill="#f2f6ff" stroke="rgba(3,4,12,.9)" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
function Pulse({ x, y, anim, dur }) {
  return <span className="sr-pulse" style={{ left: x, top: y, animation: `${anim} ${dur} ${EO} infinite` }} />;
}
const Field = () => (
  <div aria-hidden="true">
    {[[18, 22], [318, 32], [64, 128], [296, 118], [208, 16], [126, 64], [262, 74], [44, 96], [338, 88], [168, 138], [232, 132], [90, 40]].map((d, i) => (
      <span key={i} className="bd" style={{ left: d[0], top: d[1], animation: `dm-tw ${2.6 + (i % 4) * 0.7}s ease-in-out ${i * 0.28}s infinite` }} />
    ))}
  </div>
);
const dot = (x, y, size, bg, glow) => ({ left: x, top: y, width: size, height: size, background: bg, boxShadow: glow, marginLeft: -size / 2, marginTop: -size / 2 });
const kf = (name, dur, extra) => ({ animation: `${name} ${dur} ${EO} infinite${extra ? ' ' + extra : ''}` });

/* 每页的演示场景。id → 一个 360×160 迷你舞台的无缝循环。 */
function GuideDemo({ id }) {
  React.useEffect(() => { injectDemoCss(); }, []);
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scenes = {
    /* 欢迎：一颗星被点亮（衍射芒 + 双环），再缓缓归于暗 */
    welcome: (
      <>
        <Field />
        <span className="sr-star" style={{ ...dot(185, 82, 16, '#4a5c8a'), ...kf('w-star', '5s') }} />
        {[0, 90].map((r, i) => (
          <span key={i} style={{ position: 'absolute', left: 185, top: 82, width: 2, height: 52, marginLeft: -1, marginTop: -26, '--r': r + 'deg',
            background: 'linear-gradient(180deg,transparent,rgba(255,236,190,.85),transparent)', ...kf('w-spike', '5s') }} />
        ))}
        <span style={{ position: 'absolute', left: 185, top: 82, width: 16, height: 16, margin: '-8px 0 0 -8px', borderRadius: '50%',
          border: '1.5px solid rgba(255,217,138,.7)', ...kf('w-ring', '5s') }} />
        <span className="sr-star" style={dot(95, 48, 4, 'rgba(159,198,255,.75)')} />
        <span className="sr-star" style={dot(268, 62, 5, 'rgba(188,208,255,.8)')} />
        <span className="sr-star" style={dot(258, 122, 3, 'rgba(159,198,255,.6)')} />
        <span className="sr-star" style={dot(120, 126, 4, 'rgba(199,220,255,.7)')} />
      </>
    ),
    /* 星图：按住拖空白 → 画布同步平移 → 右键 → 菜单选「新建知识星」→ 新星入场 */
    map: (
      <>
        <div style={{ position: 'absolute', inset: 0, willChange: 'transform', ...kf('mp-pan', '7s') }}>
          <Field />
          {/* 星域光环 + 主星 + 成员星 + 连接曲线（贴近真实星图语言） */}
          <span style={{ position: 'absolute', left: 100, top: 74, width: 118, height: 118, margin: '-59px 0 0 -59px', borderRadius: '50%',
            border: '1px solid rgba(255,217,138,.16)', background: 'radial-gradient(circle,rgba(255,217,138,.05),transparent 70%)' }} />
          <svg style={{ position: 'absolute', left: 0, top: 0 }} width="360" height="160" aria-hidden="true">
            <path d="M100 74 Q 80 58 64 50" fill="none" stroke="rgba(159,198,255,.3)" strokeWidth="1" />
            <path d="M100 74 Q 122 90 136 100" fill="none" stroke="rgba(159,198,255,.3)" strokeWidth="1" />
            <path d="M100 74 Q 130 56 150 44" fill="none" stroke="rgba(159,198,255,.3)" strokeWidth="1" />
          </svg>
          <span className="sr-star" style={dot(100, 74, 13, '#ffd98a', '0 0 14px rgba(255,217,138,.7)')} />
          <span style={{ position: 'absolute', left: 100, top: 92, transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(255,217,138,.75)', letterSpacing: '.12em' }}>量子力学</span>
          <span className="sr-star" style={dot(64, 50, 6, '#9fc6ff', '0 0 7px rgba(159,198,255,.6)')} />
          <span className="sr-star" style={dot(136, 100, 7, '#c7dcff', '0 0 7px rgba(199,220,255,.55)')} />
          <span className="sr-star" style={dot(150, 44, 5, '#bcd0ff')} />
          <span style={{ position: 'absolute', left: 330, top: 150, width: 96, height: 96, margin: '-48px 0 0 -48px', borderRadius: '50%',
            border: '1px solid rgba(159,198,255,.14)' }} />
        </div>
        <Pulse x={242} y={54} anim="mp-pulse1" dur="7s" />
        <Pulse x={296} y={94} anim="mp-pulse2" dur="7s" />
        {/* 右键菜单（迷你玻璃） */}
        <div style={{ position: 'absolute', left: 248, top: 60, width: 100, borderRadius: 10, overflow: 'hidden',
          background: 'rgba(12,17,38,.96)', border: '1px solid rgba(159,198,255,.28)', boxShadow: '0 10px 26px rgba(0,0,0,.5)',
          ...kf('mp-menu', '7s') }}>
          <div style={{ padding: '5px 9px 3px', fontSize: 8, letterSpacing: '.14em', color: '#8a94a8' }}>在此创建</div>
          <div style={{ padding: '5px 9px', fontSize: 10.5, color: '#c9d6f0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#9fc6ff' }} />新建星域
          </div>
          <div style={{ padding: '5px 9px 7px', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 6, ...kf('mp-row', '7s') }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ffd98a' }} />新建知识星
          </div>
        </div>
        <span className="sr-star" style={{ ...dot(242, 54, 12, '#9fc6ff', '0 0 12px rgba(159,198,255,.85)'), ...kf('mp-star', '7s') }} />
        <span style={{ position: 'absolute', left: 242, top: 54, width: 12, height: 12, margin: '-6px 0 0 -6px', borderRadius: '50%',
          border: '1.5px solid rgba(159,198,255,.8)', ...kf('mp-ring', '7s') }} />
        <Cursor move="mp-cur" press="mp-press" dur="7s" />
      </>
    ),
    /* 记忆：星群按错开节奏冷却变暗，记忆温度计同步滑向冷端；一次复习回暖 */
    memory: (
      <>
        <Field />
        {[[105, 54, 13, 0], [172, 92, 10, 0.18], [238, 50, 9, 0.36], [150, 120, 8, 0.54]].map((s, i) => (
          <span key={i} className="sr-star" style={{ ...dot(s[0], s[1], s[2], '#fff1cf'), animation: `me-cool 5.5s ${EO} ${s[3]}s infinite` }} />
        ))}
        <div style={{ position: 'absolute', left: 232, top: 124, width: 92, height: 5, borderRadius: 3,
          background: 'linear-gradient(90deg,#ffe9b8,#9fc6ff 55%,#46608f)' }}>
          <span style={{ position: 'absolute', top: -2, left: 0, width: 9, height: 9, borderRadius: '50%', background: '#e8eefc',
            boxShadow: '0 0 6px rgba(232,238,252,.8)', ...kf('me-mark', '5.5s') }} />
        </div>
        <span className="sr-tag" style={{ left: 20, top: 126, background: 'transparent', color: 'var(--text-3)', padding: 0 }}>R = e^(−Δt/S)</span>
      </>
    ),
    /* 点亮：讲解逐行铺开 → 连接线转金 → 星爆发点亮 + 粒子环 + 徽章 */
    ignite: (
      <>
        <Field />
        <svg style={{ position: 'absolute', left: 0, top: 0 }} width="360" height="160" aria-hidden="true">
          <path d="M172 74 C 208 74, 226 72, 254 72" fill="none" strokeWidth="1.2" style={kf('ig-conn', '5.5s')} />
        </svg>
        <div style={{ ...kf('ig-wrap', '5.5s') }}>
          <div style={{ position: 'absolute', left: 22, top: 24, width: 150, height: 102, borderRadius: 12,
            background: 'rgba(12,17,38,.85)', border: '1px solid rgba(159,198,255,.22)', padding: '12px 13px' }}>
            <div style={{ fontSize: 8, letterSpacing: '.16em', color: '#8a94a8', marginBottom: 9 }}>费曼内化 · 讲给自己听</div>
            {[[118, 'ig-l1'], [96, 'ig-l2'], [110, 'ig-l3']].map((l, i) => (
              <span key={i} style={{ display: 'block', width: l[0], height: 5, borderRadius: 3, marginBottom: 9,
                background: 'rgba(159,198,255,.4)', transformOrigin: 'left center', ...kf(l[1], '5.5s') }} />
            ))}
          </div>
          <span className="sr-tag" style={{ left: 216, top: 106, background: 'rgba(255,217,138,.14)', border: '1px solid rgba(255,217,138,.5)', color: '#ffd98a', ...kf('ig-chip', '5.5s') }}>点亮 +1 · 融会贯通</span>
        </div>
        <span className="sr-star" style={{ ...dot(262, 72, 15, '#46608f'), ...kf('ig-star', '5.5s') }} />
        <span style={{ position: 'absolute', left: 262, top: 72, width: 15, height: 15, margin: '-7.5px 0 0 -7.5px', borderRadius: '50%',
          border: '1.5px solid rgba(255,217,138,.85)', ...kf('ig-ring', '5.5s') }} />
        {[[24, -16], [28, 10], [6, -28], [-6, 26], [20, 24], [-14, -20]].map((p, i) => (
          <span key={i} className="sr-star" style={{ ...dot(262, 72, 4, '#ffe9b8', '0 0 6px rgba(255,233,184,.9)'),
            '--dx': p[0] + 'px', '--dy': p[1] + 'px', ...kf('ig-p', '5.5s') }} />
        ))}
      </>
    ),
    /* 复习：点「记得」→ 金色确认 → 卡片飞出 → 下一张滑入（洗牌闭环） */
    review: (
      <>
        <Field />
        {['rv-card1', 'rv-card2'].map((a, i) => (
          <div key={i} style={{ position: 'absolute', left: 100, top: 24, width: 160, height: 64, borderRadius: 12,
            background: 'rgba(12,17,38,.94)', border: '1px solid rgba(159,198,255,.28)', boxShadow: '0 8px 22px rgba(0,0,0,.45)',
            willChange: 'transform', ...kf(a, '5s') }}>
            <div style={{ padding: '11px 14px' }}>
              <div style={{ fontSize: 8.5, letterSpacing: '.18em', color: '#8a94a8' }}>量子力学 · 到期</div>
              <div style={{ fontSize: 14, color: '#e8eefc', marginTop: 6, fontWeight: 300 }}>{i === 0 ? '贝尔不等式' : '纠缠态'}</div>
            </div>
          </div>
        ))}
        {[['忘了', 100], ['模糊', 168], ['记得', 236]].map((b, i) => (
          <span key={i} className="sr-tag" style={{ left: b[1], top: 108, padding: '5px 12px', fontSize: 10.5,
            border: '1px solid rgba(159,198,255,.18)', background: 'rgba(159,198,255,.08)', color: '#8a94a8',
            ...(i === 2 ? kf('rv-btn', '5s') : {}) }}>{b[0]}</span>
        ))}
        <span className="sr-tag" style={{ left: 212, top: 6, background: 'transparent', color: '#ffd98a', ...kf('rv-chip', '5s') }}>记忆稳定度 ↑</span>
        <Pulse x={258} y={117} anim="rv-pulse" dur="5s" />
        <Cursor move="rv-cur" press="rv-press" dur="5s" />
      </>
    ),
    /* 收件箱：速记打字 → ⌘Enter 实体键按下 → 内容化作卡片弧线落入收件箱，角标 3→4 */
    inbox: (
      <div style={{ position: 'absolute', inset: 0, ...kf('ib-wrap', '5.5s') }}>
        <Field />
        <div style={{ position: 'absolute', left: 56, top: 30, width: 150, height: 32, borderRadius: 10,
          background: 'rgba(12,17,38,.9)', border: '1px solid rgba(159,198,255,.25)', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
          <span style={{ height: 6, borderRadius: 3, background: 'rgba(159,198,255,.6)', animation: `ib-type 5.5s steps(14) infinite` }} />
        </div>
        <span className="sr-tag" style={{ left: 232, top: 34, padding: '7px 10px', fontSize: 10.5, borderRadius: 8,
          border: '1px solid rgba(159,198,255,.25)', ...kf('ib-key', '5.5s') }}>⌘ Enter</span>
        <span style={{ position: 'absolute', left: 70, top: 36, width: 96, height: 20, borderRadius: 7,
          background: 'rgba(159,198,255,.16)', border: '1px solid rgba(159,198,255,.4)', willChange: 'transform', ...kf('ib-chip', '5.5s') }} />
        <div style={{ position: 'absolute', left: 125, top: 106, width: 110, height: 30, borderRadius: 9,
          border: '1px dashed rgba(159,198,255,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 7, fontSize: 10, color: '#8a94a8', fontFamily: 'var(--font-mono)', ...kf('ib-tray', '5.5s') }}>
          收件箱
          <span style={{ position: 'relative', width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,217,138,.16)',
            border: '1px solid rgba(255,217,138,.45)', fontSize: 9, color: '#ffd98a' }}>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...kf('ib-n3', '5.5s') }}>3</span>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...kf('ib-n4', '5.5s') }}>4</span>
          </span>
        </div>
      </div>
    ),
    /* 编辑器：真实 markdown 语感——「# 」打出后转标题，「[] 」转待办再勾选 */
    editor: (
      <div style={{ position: 'absolute', inset: 0, ...kf('ed-wrap', '5.5s') }}>
        <Field />
        <div style={{ position: 'absolute', left: 46, top: 36, width: 260 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', fontWeight: 300, letterSpacing: '.02em', ...kf('ed-size', '5.5s') }}>
            <span style={{ display: 'inline-block', overflow: 'hidden', color: '#8a94a8', fontFamily: 'var(--font-mono)', ...kf('ed-hash', '5.5s') }}>#&nbsp;</span>
            <span style={{ display: 'inline-block', whiteSpace: 'nowrap', ...kf('ed-t1', '5.5s'), animationTimingFunction: 'steps(6)' }}>贝尔不等式</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, ...kf('ed-l2', '5.5s') }}>
            <span style={{ display: 'inline-block', overflow: 'hidden', color: '#8a94a8', fontSize: 12, fontFamily: 'var(--font-mono)', ...kf('ed-br', '5.5s') }}>[]&nbsp;</span>
            <span style={{ position: 'relative', width: 14, height: 14, borderRadius: 4, border: '1.5px solid rgba(159,198,255,.5)', flex: 'none', ...kf('ed-box', '5.5s'), animationName: 'ed-box, ed-fill' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" style={{ position: 'absolute', left: 1, top: 1 }}>
                <path d="M2 6 L5 9 L10 3" fill="none" stroke="#0a0e20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="14" style={kf('ed-check', '5.5s')} />
              </svg>
            </span>
            <span style={{ display: 'inline-block', whiteSpace: 'nowrap', fontSize: 12.5, color: '#c9d6f0', ...kf('ed-t2', '5.5s'), animationTimingFunction: 'steps(8)' }}>复现 CHSH 推导</span>
            <span style={{ width: 2, height: 14, background: '#ffd98a', ...kf('ed-blink', '1s'), animationTimingFunction: 'step-end' }} />
          </div>
        </div>
        <span className="sr-tag" style={{ left: 20, top: 132, background: 'transparent', color: 'var(--text-3)', padding: 0 }}># 标题 · [] 待办 · ⌘F 查找</span>
      </div>
    ),
    /* 视角：分段开关 星图 ⇄ 鸟瞰。热图格子逐格铺开（stagger），再切回 */
    views: (
      <>
        <div style={{ position: 'absolute', inset: 0, ...kf('vw-map', '6s') }}>
          <Field />
          <span className="sr-star" style={dot(120, 80, 12, '#ffd98a', '0 0 12px rgba(255,217,138,.6)')} />
          <span className="sr-star" style={dot(210, 100, 8, '#9fc6ff', '0 0 8px rgba(159,198,255,.55)')} />
          <span className="sr-star" style={dot(180, 52, 6, '#c7dcff')} />
          <span className="sr-star" style={dot(76, 118, 5, '#bcd0ff')} />
        </div>
        <div style={{ position: 'absolute', left: 24, top: 46, right: 24, bottom: 20, display: 'grid',
          gridTemplateColumns: 'repeat(6,1fr)', gridTemplateRows: 'repeat(3,1fr)', gap: 5 }}>
          {['#ffd98a', '#c9a86a', '#7896cd', '#46608f', '#9fc6ff', '#3a4a7a', '#c9a86a', '#ffd98a', '#46608f', '#5a74ad', '#7896cd', '#9fc6ff', '#3a4a7a', '#46608f', '#c9a86a', '#7896cd', '#9fc6ff', '#5a74ad'].map((c, i) => (
            <span key={i} style={{ borderRadius: 5, background: c, opacity: 0, animation: `vw-cell 6s ${EO} ${i * 0.016}s infinite` }} />
          ))}
        </div>
        {/* 分段开关：星图 ⇄ 鸟瞰（滑块 + 双标签） */}
        <div style={{ position: 'absolute', left: 248, top: 14, width: 96, height: 26, borderRadius: 999,
          background: 'rgba(12,17,38,.92)', border: '1px solid rgba(159,198,255,.28)' }}>
          <span style={{ position: 'absolute', left: 3, top: 3, width: 44, height: 18, borderRadius: 999,
            background: 'rgba(159,198,255,.16)', ...kf('vw-thumb', '6s') }} />
          <span style={{ position: 'absolute', left: 0, top: 0, width: 50, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, ...kf('vw-lab1', '6s') }}>星图</span>
          <span style={{ position: 'absolute', right: 0, top: 0, width: 50, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, ...kf('vw-lab2', '6s') }}>鸟瞰</span>
        </div>
        <Pulse x={294} y={27} anim="vw-pulse1" dur="6s" />
        <Pulse x={272} y={27} anim="vw-pulse2" dur="6s" />
        <Cursor move="vw-cur" press="vw-press" dur="6s" />
      </>
    ),
    /* 黑洞：按住拖星 → 松手 → 星自己螺旋坠入（吸积盘旋转、视界闪光）→ 重生闭环 */
    trash: (
      <>
        <Field />
        <span style={{ position: 'absolute', left: 272, top: 104, width: 44, height: 44, margin: '-22px 0 0 -22px', borderRadius: '50%',
          background: 'radial-gradient(circle,#05060f 42%,rgba(159,198,255,.14) 72%,transparent)',
          border: '1px solid rgba(159,198,255,.22)', ...kf('tr-flash', '5.5s') }}>
          <span style={{ position: 'absolute', inset: 3, borderRadius: '50%', border: '2px solid transparent',
            borderTopColor: 'rgba(255,217,138,.65)', borderRightColor: 'rgba(159,198,255,.4)', animation: 'dm-spin 2.4s linear infinite' }} />
          <span style={{ position: 'absolute', inset: -8, animation: 'dm-spin 3.6s linear infinite' }}>
            <span style={{ position: 'absolute', left: '50%', top: 0, width: 3, height: 3, marginLeft: -1.5, borderRadius: '50%', background: 'rgba(199,220,255,.8)' }} />
            <span style={{ position: 'absolute', left: 2, top: '62%', width: 2.5, height: 2.5, borderRadius: '50%', background: 'rgba(255,217,138,.7)' }} />
          </span>
        </span>
        <span className="sr-star" style={{ position: 'absolute', left: 0, top: 0, width: 14, height: 14, margin: '-7px 0 0 -7px',
          background: '#9fc6ff', boxShadow: '0 0 12px rgba(159,198,255,.7)', willChange: 'transform', ...kf('tr-star', '5.5s') }} />
        <Cursor move="tr-cur" press="tr-press" dur="5.5s" />
      </>
    ),
    /* 星际漫游：两座星系 · 金弧生长 · 光点旅行 · 落地收纳成新星 */
    visit: (
      <>
        <Field />
        {[[74, 80, '#ffd98a', 'rgba(255,217,138'], [286, 82, '#9fc6ff', 'rgba(159,198,255']].map((g, i) => (
          <React.Fragment key={i}>
            <span style={{ position: 'absolute', left: g[0], top: g[1], width: 64, height: 64, margin: '-32px 0 0 -32px', borderRadius: '50%',
              border: `1px solid ${g[3]},.18)`, background: `radial-gradient(circle,${g[3]},.05),transparent 70%)` }} />
            <span className="sr-star" style={dot(g[0], g[1], 14, g[2], `0 0 13px ${g[3]},.6)`)} />
            <span style={{ position: 'absolute', left: g[0], top: g[1], width: 0, height: 0, animation: `dm-spin ${9 + i * 2}s linear infinite` }}>
              <span className="sr-star" style={dot(22, 8, 5, '#c7dcff')} />
            </span>
          </React.Fragment>
        ))}
        <svg style={{ position: 'absolute', left: 0, top: 0 }} width="360" height="160" aria-hidden="true">
          <path d="M74 80 C 160 26, 216 26, 286 82" fill="none" stroke="#ffd98a" strokeWidth="1.5"
            strokeDasharray="300" style={kf('vi-arc', '5.5s')} />
        </svg>
        <span style={{ position: 'absolute', width: 6, height: 6, margin: '-3px 0 0 -3px', borderRadius: '50%', background: '#fff4d6',
          boxShadow: '0 0 10px rgba(255,217,138,.9)', offsetPath: 'path("M74 80 C 160 26, 216 26, 286 82")', ...kf('vi-dot', '5.5s') }} />
        <span className="sr-star" style={{ ...dot(302, 58, 9, '#ffd98a', '0 0 10px rgba(255,217,138,.8)'), ...kf('vi-adopt', '5.5s') }} />
        <span style={{ position: 'absolute', left: 302, top: 58, width: 12, height: 12, margin: '-6px 0 0 -6px', borderRadius: '50%',
          border: '1.5px solid rgba(255,217,138,.8)', ...kf('vi-ring', '5.5s') }} />
        <span className="sr-tag" style={{ left: 236, top: 30, background: 'rgba(255,217,138,.12)', border: '1px solid rgba(255,217,138,.4)', color: '#ffd98a', ...kf('vi-chip', '5.5s') }}>收纳 · 星光入域</span>
      </>
    ),
    /* 快捷键：实体键帽依次按下（底边压缩 + 金色亮起） */
    shortcuts: (
      <>
        <Field />
        {[['⌘K', 46, 0], ['⌘F', 124, 0.95], ['/', 202, 1.9], ['Esc', 258, 2.85]].map((k, i) => (
          <span key={i} style={{ position: 'absolute', left: k[1], top: 62, minWidth: 40, height: 32, padding: '0 11px',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 12, border: '1px solid rgba(159,198,255,.22)',
            animation: `sc-key 4.8s ${EO} ${k[2]}s infinite` }}>{k[0]}</span>
        ))}
        <span className="sr-tag" style={{ left: 46, top: 116, background: 'transparent', color: 'var(--text-3)', padding: 0 }}>跳转 · 查找 · 块菜单 · 收起</span>
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

          {/* body: 操作动画演示 + 标题 + 短文 */}
          <div key={page} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px 40px 20px', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
            <GuideDemo id={p.id} />
            <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-1)', marginTop: 20, letterSpacing: '0.02em', textShadow: '0 0 16px rgba(159,198,255,0.18)' }}>{p.title}</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.85, marginTop: 12, maxWidth: 430 }}>{p.body}</div>
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
