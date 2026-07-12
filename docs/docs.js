/* ===== 星图 Stellar Raft — 文档站共用脚本 =====
   职责：
   1. 深空 / 黎明 主题切换 —— 写 data-theme 到 <html>，localStorage('sr.docs.theme') 记忆；
   2. 把当前主题同步进带 [data-theme-sync] 的同源 iframe（规范卡片跟随文档站换肤）；
   3. 解析 [data-token] 元素的 CSS 变量实际值填入 .val（速查表在两套主题下都显示真值）；
   4. 初始化 Lucide 图标（1.6px 描边，品牌线宽）。

   注意：<head> 里需先内联一段防闪脚本（见各页），本文件只负责交互。 */
(function () {
  var KEY = 'sr.docs.theme';

  function current() {
    return document.documentElement.dataset.theme === 'dawn' ? 'dawn' : 'space';
  }

  function syncFrame(frame) {
    try {
      var doc = frame.contentDocument;
      if (!doc || !doc.documentElement) return;
      if (current() === 'dawn') doc.documentElement.dataset.theme = 'dawn';
      else delete doc.documentElement.dataset.theme;
    } catch (e) { /* 跨源时静默 */ }
  }

  function syncFrames() {
    document.querySelectorAll('iframe[data-theme-sync]').forEach(syncFrame);
  }

  /* 速查表真值：解析 data-token 指向的自定义属性当前计算值 */
  function resolveTokens() {
    var cs = getComputedStyle(document.documentElement);
    document.querySelectorAll('[data-token]').forEach(function (el) {
      var v = cs.getPropertyValue(el.getAttribute('data-token')).trim();
      var out = el.classList.contains('val') ? el : el.querySelector('.val');
      if (out && v) out.textContent = v.replace(/\s+/g, ' ');
    });
  }

  function apply(theme) {
    if (theme === 'dawn') document.documentElement.dataset.theme = 'dawn';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    syncFrames();
    resolveTokens();
  }

  function init() {
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        apply(current() === 'dawn' ? 'space' : 'dawn');
      });
    }
    /* iframe 加载完成后补一次同步（切换发生在加载前时） */
    document.querySelectorAll('iframe[data-theme-sync]').forEach(function (f) {
      f.addEventListener('load', function () { syncFrame(f); });
      syncFrame(f);
    });
    resolveTokens();
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons({ attrs: { 'stroke-width': 1.6 } });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SRDocs = { apply: apply, current: current, resolveTokens: resolveTokens, syncFrames: syncFrames };
})();
