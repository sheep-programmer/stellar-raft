/* sr-tip — 全应用统一的自绘悬浮提示（plain global，替代浏览器原生 title 气泡）。
   工作方式：
   - 悬停到带 title 的元素时，把 title 搬进 data-tip（原生气泡从此消失），用玻璃胶囊展示；
   - 图标按钮（无文字、只有 aria-label）同样给出提示；
   - 键盘聚焦（:focus-visible）同样触发，按目标元素定位——收起态侧栏的图标按钮
     不再对键盘用户「盲开」（WCAG 1.4.13：Esc 可随时隐藏）；
   - 250ms 延迟出现、跟随目标元素定位、越界自动收进视口，滚动/按下即隐藏。 */
(function () {
  const tip = document.createElement('div');
  tip.setAttribute('data-sr-tip', '');
  Object.assign(tip.style, {
    position: 'fixed', zIndex: 9999, pointerEvents: 'none',
    background: 'rgba(11,14,34,0.94)', border: '1px solid rgba(159,198,255,0.24)',
    borderRadius: '9px', padding: '5px 11px', maxWidth: '340px',
    font: '300 12px/1.55 Sora, "Noto Sans SC", sans-serif', color: 'rgba(255,255,255,0.92)',
    whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
    boxShadow: '0 8px 26px rgba(0,0,0,0.5)',
    opacity: '0', transform: 'translateY(3px)',
    transition: 'opacity 140ms ease, transform 140ms ease',
    left: '0', top: '0',
  });
  const mount = () => { if (document.body && !tip.isConnected) document.body.appendChild(tip); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  let cur = null, timer = null, mx = 0, my = 0;
  document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; }, { capture: true, passive: true });

  const textFor = (el) => {
    const t = el.getAttribute('data-tip');
    if (t) return t;
    // 图标按钮：只有 aria-label、没有可见文字
    if (el.tagName === 'BUTTON') {
      const a = el.getAttribute('aria-label');
      if (a && !el.textContent.trim()) return a;
    }
    return '';
  };

  // 跟随光标出现在右下方（原生气泡的习惯位置），避免盖住目标周围的内容
  const place = () => {
    tip.style.left = '-9999px'; tip.style.top = '-9999px'; // 先离屏量尺寸
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = mx + 14, y = my + 20;
    if (x + w > window.innerWidth - 8) x = mx - w - 10;   // 右侧放不下 → 光标左侧
    if (y + h > window.innerHeight - 8) y = my - h - 12;  // 底部放不下 → 光标上方
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    y = Math.max(8, Math.min(window.innerHeight - h - 8, y));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };

  const hide = () => {
    clearTimeout(timer); timer = null; cur = null;
    tip.style.opacity = '0'; tip.style.transform = 'translateY(3px)';
  };

  // 键盘聚焦时按目标元素定位（元素下缘居中；放不下则翻到上缘）
  const placeEl = (el) => {
    const r = el.getBoundingClientRect();
    tip.style.left = '-9999px'; tip.style.top = '-9999px'; // 先离屏量尺寸
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    let y = r.bottom + 8;
    if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    y = Math.max(8, Math.min(window.innerHeight - h - 8, y));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };

  // 悬停 / 聚焦共用的展示逻辑；byFocus 时用元素定位而非光标定位
  const show = (el, byFocus) => {
    // 把原生 title 搬走：浏览器气泡从此不再出现
    if (el.hasAttribute('title')) {
      const v = el.getAttribute('title');
      if (v) el.setAttribute('data-tip', v);
      el.removeAttribute('title');
    }
    const txt = textFor(el);
    if (!txt) { hide(); return; }
    cur = el;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (cur !== el || !el.isConnected) return;
      tip.textContent = txt;
      if (byFocus) placeEl(el); else place();
      tip.style.opacity = '1'; tip.style.transform = 'translateY(0)';
    }, 250);
  };

  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const el = t.closest('[title], [data-tip], button[aria-label]');
    if (!el || el === cur) return;
    show(el, false);
  }, true);

  // 键盘聚焦：只在 :focus-visible（真键盘焦点）时出提示，鼠标点击聚焦不打扰
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const el = t.closest('[title], [data-tip], button[aria-label]');
    if (!el || el === cur) return;
    try { if (!t.matches(':focus-visible')) return; } catch (_) { return; }
    show(el, true);
  }, true);
  document.addEventListener('focusout', (e) => {
    if (cur && (!e.relatedTarget || !cur.contains(e.relatedTarget))) hide();
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (cur && (!e.relatedTarget || !cur.contains(e.relatedTarget))) hide();
  }, true);
  document.addEventListener('mousedown', hide, true);
  // WCAG 1.4.13：Esc 随时隐藏提示（只隐藏，不拦截事件——上层的 Esc 语义照常）
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); }, true);
  document.addEventListener('wheel', hide, { capture: true, passive: true });
  window.addEventListener('scroll', hide, true);

  // 整个应用不使用浏览器右键菜单：自己的右键菜单各自 stopPropagation/自行渲染，
  // 这里兜底拦掉其余所有位置（侧边栏、面板、空白处）的原生菜单
  document.addEventListener('contextmenu', (e) => {
    const t = e.target;
    // 输入框与正文编辑区保留原生菜单（复制/粘贴/拼写），其余一律拦截
    if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')) return;
    e.preventDefault();
  });
})();
