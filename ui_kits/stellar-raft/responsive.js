/* SRScreen — 星图的响应式底座（plain global，在所有 .jsx 之前加载）

   一套断点，全站共用；组件不要各自写 matchMedia，否则同一个「窄屏」在不同
   视图里会是不同的宽度：
     phone   ≤ 720px   手机竖屏：单列、抽屉侧栏、底部标签栏
     tablet  ≤ 1024px  平板 / 分屏：侧栏可折叠，右侧栏让位
     desktop  >1024px  原本的 1440×900 桌面布局

   还有一个与宽度档次无关、但两处布局都要用的阈值：narrow ≤ 1180px。
   它是「多栏还摆不摆得下」的那条线——编辑器的知识栏、列表页的六列表格，
   都在这里让位。它比 tablet 宽：1100px 的窗口不是平板，但那张表已经塌了
   （标题列被固定列挤成 0 宽，整整一段 721~1180px 的死区）。
   写成断点而不是各自 matchMedia，是为了 JS 与 CSS 认同一个数：
   html[data-narrow] 给样式用，state.narrow 给组件用，改一处两边同时动。

   另外提供 coarse（粗指针 = 手指）——它与宽度是两件事：外接触摸屏的大屏也是
   coarse，需要更大的点击区，但不需要单列布局。

   横屏矮屏（landscape 且 height ≤ 480）单独标出来：手机横过来时高度只剩一点，
   顶部条 + 底部栏会把内容挤没，这种时候两条都收起来。 */
window.SRScreen = (function () {
  const BP = { phone: 720, tablet: 1024, narrow: 1180, shortSide: 480 };

  const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false, addEventListener() { }, removeEventListener() { } });

  const queries = {
    phone: mq(`(max-width: ${BP.phone}px)`),
    tablet: mq(`(max-width: ${BP.tablet}px)`),
    narrow: mq(`(max-width: ${BP.narrow}px)`),
    coarse: mq('(pointer: coarse)'),
    short: mq(`(max-height: ${BP.shortSide}px) and (orientation: landscape)`),
  };

  const read = () => ({
    phone: queries.phone.matches,
    tablet: queries.tablet.matches,        // 注意：phone 也满足 tablet
    narrow: queries.narrow.matches,        // 多栏摆不下（编辑器知识栏 / 列表六列表格让位）
    desktop: !queries.tablet.matches,
    coarse: queries.coarse.matches,
    short: queries.short.matches,
    touch: queries.coarse.matches || queries.phone.matches,
  });

  let state = read();
  const subs = new Set();
  const emit = () => {
    const next = read();
    // 只在真正跨过断点时广播，resize 抖动不触发整树重渲染
    if (Object.keys(next).every(k => next[k] === state[k])) return;
    state = next;
    subs.forEach(fn => { try { fn(state); } catch (e) { } });
    try { window.dispatchEvent(new CustomEvent('sr-screen', { detail: state })); } catch (e) { }
    applyAttrs();
  };
  Object.values(queries).forEach(q => {
    if (q.addEventListener) q.addEventListener('change', emit);
    else if (q.addListener) q.addListener(emit);   // 老 Safari
  });

  /* html 上落两个属性，纯 CSS 也能挂钩（.jsx 里的内联样式之外，
     styles.css / 各组件注入的 <style> 用 html[data-screen="phone"] 选择） */
  const applyAttrs = () => {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const el = document.documentElement;
    el.dataset.screen = state.phone ? 'phone' : (state.tablet ? 'tablet' : 'desktop');
    if (state.touch) el.dataset.pointer = 'coarse'; else delete el.dataset.pointer;
    if (state.narrow) el.dataset.narrow = ''; else delete el.dataset.narrow;
    if (state.short) el.dataset.short = ''; else delete el.dataset.short;
  };
  applyAttrs();

  /* 视口高度：移动端浏览器的地址栏会吞掉 100vh，用 --sr-vh 兜底。
     支持 dvh 的浏览器（iOS 16+ / Chrome 108+）直接用 dvh，这里只是给老设备垫底。 */
  const syncVh = () => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--sr-vh', (window.innerHeight * 0.01) + 'px');
  };
  syncVh();
  addEventListener('resize', () => { syncVh(); emit(); });
  addEventListener('orientationchange', () => setTimeout(() => { syncVh(); emit(); }, 60));

  return {
    BP,
    get: () => state,
    // 订阅断点变化，返回退订函数
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    // 便捷判断（非 React 语境用）
    isPhone: () => state.phone,
    isTablet: () => state.tablet,
    isTouch: () => state.touch,
    isNarrow: () => state.narrow,
  };
})();

/* React 侧的入口：SRKit.useScreen() —— 组件里只写
     const scr = useScreen();
     scr.phone ? <单列> : <双栏>
   跨断点时才重渲染。注册进 SRKit 而不是各自 import，是因为整个 kit 走全局命名空间。 */
window.SRKit = Object.assign(window.SRKit || {}, {
  useScreen() {
    const [s, set] = React.useState(window.SRScreen.get());
    React.useEffect(() => window.SRScreen.subscribe(set), []);
    return s;
  },
});
