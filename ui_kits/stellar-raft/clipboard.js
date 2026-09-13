/* SRCopy — 复制到剪贴板，并且如实回答「到底成没成」。

   为什么值得单开一个文件：`navigator.clipboard` 只在**安全上下文**里存在
   （https，或 localhost）。而星图那一整套手机断点与手势，面向的恰恰是
   「用手机打开 http://192.168.x.x:8756」这个场景 —— 在那里它是 undefined。

   以前各处是 `try { navigator.clipboard && navigator.clipboard.writeText(x) } catch {}`
   紧跟一句 flash('已复制')：手机上什么都没复制，却照样告诉你复制好了。
   更隐蔽的是 writeText 返回的是 Promise，权限被拒时同步的 try/catch 也接不住。

   这里把三件事收在一处：
   · 优先用现代 API；
   · 不可用 / 被拒时退回 execCommand('copy')（非安全上下文里仍然有效）；
   · 返回 Promise<boolean>，调用方据此决定说「已复制」还是「请手动选择」。 */
window.SRCopy = (function () {
  // 老办法：塞一个离屏 textarea、选中、execCommand。iOS Safari 需要 contentEditable
  // + 手动 Range 才选得中，光 select() 不够。
  const legacy = (text) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.contentEditable = 'true';
      // 不能 display:none / visibility:hidden —— 那样选不中；挪出视口即可
      Object.assign(ta.style, { position: 'fixed', top: '0', left: '-9999px', opacity: '0' });
      document.body.appendChild(ta);
      const r = document.createRange();
      r.selectNodeContents(ta);
      const sel = window.getSelection();
      const saved = sel && sel.rangeCount ? sel.getRangeAt(0) : null;   // 用户原来的选区别弄丢
      if (sel) { sel.removeAllRanges(); sel.addRange(r); }
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      if (sel) { sel.removeAllRanges(); if (saved) sel.addRange(saved); }
      return !!ok;
    } catch (e) { return false; }
  };

  /* 复制。总是 resolve，never reject —— 调用方只需要一个布尔值。 */
  const copy = (text) => {
    const s = String(text == null ? '' : text);
    if (!s) return Promise.resolve(false);
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      return nav.clipboard.writeText(s).then(() => true, () => legacy(s));
    }
    return Promise.resolve(legacy(s));
  };

  // 这台设备现在到底能不能用现代剪贴板（UI 想提前说明时用）
  const isSecure = () => typeof window !== 'undefined' && window.isSecureContext !== false;

  return { copy, legacy, isSecure };
})();
