/* sr-transition — 星际跃迁转场系统（plain global：window.srTransition）。
   把「换视图」变成一次微型星际飞行：深空遮罩淡入、星光拉成短暂的光轨、
   旧视图微缩放退后；遮罩峰值处执行真正的切换（run()），再揭开新视图。

   API（挂在 window.srTransition）：
   · flight(run, opts?) → Promise<boolean>
       视图级跃迁。入场 ~300ms → 峰值执行 run() → 出场 ~340ms，全程
       var(--ease-flight)。prefers-reduced-motion / 设置页关动效 /
       opts.instant 时直接 run() 不播动画（resolve(false)）。
       防连点：入场阶段的重复调用只保留最后一次意图（同一目标点两下 = 一次），
       出场阶段的调用直接执行（遮罩正在揭开，切换被自然盖住）。
   · enter(el) — 元素级入场辅助：给新挂载的视图根补一次 .sr-view-enter
       淡入 + 上浮（React 里也可以直接写 className="sr-view-enter"）。
   · themeCrossfade(apply?) — 主题切换的 300ms 全局 crossfade：
       给 <html> 挂临时过渡类，随后（或在回调里）改 data-theme；
       reduced-motion / 动效关闭时不加类、瞬切。
   · reduced() — 当前是否应跳过动画（系统 reduced-motion 或 data-motion="off"）。
   · busy — 只读：跃迁遮罩是否在场（可用来做额外的防连点判断）。

   动效口径：视图级 300/340ms（仅保留给「探索星系」等大跳转）、控件级入场 240ms，缓动统一 var(--ease-flight)；
   遮罩与光轨只用 tokens（--bg-deepspace / --star-blue），双主题自然成立。 */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const IN_MS = 300;   // 入场遮罩（视图级 250–450ms 区间）
  const OUT_MS = 340;  // 出场揭开
  const ENTER_MS = 240; // 元素级入场辅助（高频视图切换的唯一过渡，宜快不宜久）
  const THEME_MS = 300; // 主题 crossfade

  const reduced = () =>
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    document.documentElement.dataset.motion === 'off';

  /* ------------------------------ CSS ------------------------------ */

  const CSS = `
/* —— 星际跃迁遮罩（tokens-only，深空/黎明双主题成立） —— */
.sr-warp {
  position: fixed; inset: 0; z-index: calc(var(--z-toast, 140) + 10);
  background: var(--bg-deepspace); pointer-events: auto; overflow: hidden;
  opacity: 0;
}
.sr-warp[data-phase="in"]  { animation: sr-warp-in ${IN_MS}ms var(--ease-flight) both; }
.sr-warp[data-phase="out"] { animation: sr-warp-out ${OUT_MS}ms var(--ease-flight) both; }
@keyframes sr-warp-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes sr-warp-out { from { opacity: 1; } to { opacity: 0; } }
/* 拉成光轨的星光：细渐变线，纵向拉伸掠过 */
.sr-warp-streak {
  position: absolute; width: 2px; border-radius: 2px;
  background: linear-gradient(180deg, transparent, var(--star-blue), transparent);
  opacity: 0; will-change: transform, opacity;
  animation: sr-warp-streak ${IN_MS + OUT_MS}ms var(--ease-flight) both;
}
@keyframes sr-warp-streak {
  0%   { transform: translateY(-46%) scaleY(0.35); opacity: 0; }
  40%  { opacity: 0.7; }
  100% { transform: translateY(52%) scaleY(1.6); opacity: 0; }
}
/* 跃迁时旧视图微缩放淡出（遮罩峰值处移除，切换被完全盖住） */
.sr-warp-stage {
  transition: transform ${IN_MS}ms var(--ease-flight), opacity ${IN_MS}ms var(--ease-flight);
  transform: scale(1.014); opacity: 0.72;
}
/* —— 元素级入场辅助：新挂载视图根的淡入 + 上浮 —— */
.sr-view-enter { animation: sr-view-enter ${ENTER_MS}ms var(--ease-flight) both; }
@keyframes sr-view-enter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
/* —— 主题切换的全局 crossfade（reduced-motion 时不加此类） —— */
html.sr-theme-xfade, html.sr-theme-xfade *,
html.sr-theme-xfade *::before, html.sr-theme-xfade *::after {
  transition:
    background ${THEME_MS}ms var(--ease-flight),
    color ${THEME_MS}ms var(--ease-flight),
    border-color ${THEME_MS}ms var(--ease-flight),
    fill ${THEME_MS}ms var(--ease-flight),
    stroke ${THEME_MS}ms var(--ease-flight),
    box-shadow ${THEME_MS}ms var(--ease-flight) !important;
}
/* reduced-motion：全部直达终态（flight() 本身也不会建遮罩，这里是双保险） */
@media (prefers-reduced-motion: reduce) {
  .sr-warp, .sr-warp-streak, .sr-view-enter { animation: none !important; }
  .sr-warp { display: none; }
  .sr-warp-stage { transition: none; transform: none; opacity: 1; }
}
`;

  function injectCss() {
    let el = document.getElementById('sr-transition-css');
    if (!el) {
      el = document.createElement('style');
      el.id = 'sr-transition-css';
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = CSS;
  }
  injectCss();

  /* --------------------------- 跃迁遮罩 --------------------------- */

  // 光轨的固定布点（确定性的「伪随机」，不引入运行时随机闪烁）：
  // [left%, top%, height(px), delay(ms)]
  const STREAKS = [
    [8, 6, 130, 0], [16, 52, 92, 60], [24, 22, 150, 30], [33, 66, 112, 90],
    [41, 12, 84, 15], [48, 44, 165, 75], [55, 74, 100, 45], [62, 18, 132, 105],
    [70, 58, 90, 20], [77, 4, 148, 65], [84, 38, 116, 35], [91, 64, 96, 95],
    [28, 84, 76, 50], [66, 88, 122, 10],
  ];

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sr-warp';
    overlay.setAttribute('aria-hidden', 'true');
    for (const [left, top, h, delay] of STREAKS) {
      const s = document.createElement('span');
      s.className = 'sr-warp-streak';
      s.style.left = left + '%';
      s.style.top = top + '%';
      s.style.height = h + 'px';
      s.style.animationDelay = delay + 'ms';
      overlay.appendChild(s);
    }
    return overlay;
  }

  let active = null; // { overlay, phase: 'in'|'out', pending, done, resolve }

  function flight(run, opts) {
    opts = opts || {};
    if (typeof run !== 'function') return Promise.resolve(false);
    if (opts.instant || reduced()) {
      run();
      return Promise.resolve(false);
    }
    if (active) {
      // 防连点：入场阶段只保留最后一次意图（双击同一目标 = 只切一次）；
      // 出场阶段直接执行——遮罩尚在揭开，切换仍被视觉盖住。
      if (active.phase === 'in') active.pending = run;
      else run();
      return active.done;
    }

    const overlay = buildOverlay();
    document.body.appendChild(overlay);
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    active = { overlay, phase: 'in', pending: run, done, resolve };

    const stage = document.getElementById('root');
    if (stage) stage.classList.add('sr-warp-stage');
    overlay.dataset.phase = 'in';

    // 不用 rAF 编排（后台标签页 rAF 会冻结，遮罩会卡死），全部走定时器
    setTimeout(() => {
      if (!active) return;
      const job = active.pending;
      active.pending = null;
      try { if (job) job(); } catch (err) { console.error('[srTransition] run() 抛错：', err); }
      if (stage) stage.classList.remove('sr-warp-stage');
      // 留一帧给 React 提交新视图，再揭开遮罩
      setTimeout(() => {
        if (!active) return;
        active.phase = 'out';
        overlay.dataset.phase = 'out';
        setTimeout(() => {
          overlay.remove();
          const r = active && active.resolve;
          active = null;
          if (r) r(true);
        }, OUT_MS + 30);
      }, 30);
    }, IN_MS + 20);

    return done;
  }

  /* ------------------------ 元素级入场辅助 ------------------------ */

  function enter(el) {
    if (!el || !el.classList || reduced()) return;
    el.classList.remove('sr-view-enter');
    // 强制 reflow，保证同一元素可重复触发入场
    void el.offsetWidth;
    el.classList.add('sr-view-enter');
    el.addEventListener('animationend', () => el.classList.remove('sr-view-enter'), { once: true });
  }

  /* ------------------------ 主题全局 crossfade ------------------------ */

  let themeTimer = 0;

  function themeCrossfade(apply) {
    const root = document.documentElement;
    if (reduced()) {
      if (apply) apply();
      return;
    }
    root.classList.add('sr-theme-xfade');
    if (apply) {
      try { apply(); } catch (err) { console.error('[srTransition] themeCrossfade apply() 抛错：', err); }
    }
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => root.classList.remove('sr-theme-xfade'), THEME_MS + 60);
  }

  window.srTransition = {
    flight,
    enter,
    themeCrossfade,
    reduced,
    enterClass: 'sr-view-enter',
    get busy() { return !!active; },
  };
})();
