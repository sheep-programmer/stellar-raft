/* sanitize.js — window.SRSanitize：编辑器内容的白名单 HTML 清洗与链接协议校验。
   块正文的唯一净化通道：渲染前（dangerouslySetInnerHTML）与入库前（syncBlock
   抓取 innerHTML）都过这里，粘贴的 text/html 同样先清洗再插入。

   纯字符串实现（不依赖 DOM），Node 可直接 import 做单元测试。
   API：
     sanitizeHtml(html)  → 只保留行内语义标签（b/i/u/s/code/a/span/…），
                           剥除全部 on* 事件、script/img/svg/iframe 等元素，
                           style 只留颜色/字体等安全声明，href 走协议白名单。
     safeUrl(url)        → 通过协议白名单（http/https/mailto/stellar-raft/相对
                           路径）返回原串，否则返回 null（javascript:/data:/
                           vbscript: 及其实体/控制字符混淆一律拒绝）。
     cleanStyle(css)     → style 声明白名单过滤（导出复用）。 */
(function () {
  'use strict';

  // 允许保留的行内语义标签（div/p 等容器标签剥壳留内容；br 单独处理）
  const SAFE_TAGS = {
    b: 1, strong: 1, i: 1, em: 1, u: 1, s: 1, strike: 1, del: 1,
    code: 1, a: 1, span: 1, sub: 1, sup: 1, mark: 1,
  };
  // 连内容一起丢弃的元素（其文本没有语义，或本身就是执行面）
  const DROP_WITH_CONTENT = {
    script: 1, style: 1, iframe: 1, object: 1, embed: 1, title: 1,
    textarea: 1, noscript: 1, template: 1, select: 1, option: 1,
    svg: 1, math: 1, head: 1,
  };

  // style 白名单：只允许影响行内排版/配色的声明
  const SAFE_STYLE_PROPS = {
    color: 1, background: 1, 'background-color': 1,
    'font-family': 1, 'font-size': 1, 'font-style': 1, 'font-weight': 1,
    'text-decoration': 1, 'text-decoration-line': 1, 'text-underline-offset': 1,
    padding: 1, 'border-radius': 1, 'letter-spacing': 1,
  };
  const SAFE_STYLE_VAL = /^[a-zA-Z0-9#%.,()\-\s'"_/]*$/;
  const BAD_STYLE_VAL = /url\s*\(|expression|javascript|image-set|element\s*\(|@|\\/i;

  const cleanStyle = (raw) => {
    const out = [];
    String(raw == null ? '' : raw).split(';').forEach((d) => {
      const i = d.indexOf(':');
      if (i < 0) return;
      const prop = d.slice(0, i).trim().toLowerCase();
      const val = d.slice(i + 1).trim();
      if (!SAFE_STYLE_PROPS[prop]) return;
      if (!val || val.length > 220 || !SAFE_STYLE_VAL.test(val) || BAD_STYLE_VAL.test(val)) return;
      out.push(prop + ':' + val);
    });
    return out.join(';');
  };

  // 属性值里的实体最小解码——只为协议嗅探（&#58; / &colon; 混淆的 javascript:）
  const decodeEntities = (s) => String(s)
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 0))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10) || 0))
    .replace(/&(colon|tab|newline|amp|quot|apos|lt|gt);/gi, (_, n) => ({
      colon: ':', tab: '\t', newline: '\n', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
    }[n.toLowerCase()]));

  const SAFE_SCHEMES = { http: 1, https: 1, mailto: 1, 'stellar-raft': 1 };
  const safeUrl = (url) => {
    if (url == null) return null;
    const u = String(url).trim();
    if (!u) return null;
    // 浏览器解析 scheme 时忽略控制字符/空白，实体也会先解码——按同样规则嗅探
    const sniff = decodeEntities(u).replace(/[\u0000-\u0020]/g, '').toLowerCase();
    const m = sniff.match(/^([a-z][a-z0-9+.-]*):/);
    if (m) return SAFE_SCHEMES[m[1]] ? u : null;
    return u;   // 无协议：相对路径 / 锚点
  };

  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const escText = (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const ATTR_RE = /([a-zA-Z_][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  const getAttr = (attrs, name) => {
    ATTR_RE.lastIndex = 0;
    let m;
    while ((m = ATTR_RE.exec(attrs))) {
      if (m[1].toLowerCase() === name) return m[3] != null ? m[3] : (m[4] != null ? m[4] : m[5]);
    }
    return null;
  };

  const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

  const sanitizeHtml = (html) => {
    if (html == null) return '';
    const src = String(html);
    let out = '';
    const stack = [];
    let last = 0;
    let skipUntil = null;   // 正在整体丢弃内容的元素名
    let m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(src))) {
      const text = src.slice(last, m.index);
      if (!skipUntil && text) out += escText(text);
      last = TAG_RE.lastIndex;
      const closing = m[1] === '/';
      const name = m[2].toLowerCase();
      const attrs = m[3] || '';
      if (skipUntil) {
        if (closing && name === skipUntil) skipUntil = null;
        continue;
      }
      if (closing) {
        if (SAFE_TAGS[name]) {
          const i = stack.lastIndexOf(name);
          if (i >= 0) while (stack.length > i) out += '</' + stack.pop() + '>';
        }
        continue;   // 未开启/非白名单的闭合标签直接丢
      }
      if (DROP_WITH_CONTENT[name]) {
        if (!/\/\s*$/.test(attrs)) skipUntil = name;
        continue;
      }
      if (name === 'br') { out += '<br>'; continue; }
      if (!SAFE_TAGS[name]) continue;   // 非白名单元素剥壳留内容（div/p/img/…）
      let attrStr = '';
      if (name === 'a') {
        const href = getAttr(attrs, 'href');
        const ok = href != null ? safeUrl(decodeEntities(href)) : null;
        if (ok) attrStr += ' href="' + escAttr(ok) + '" rel="noopener noreferrer"';
      }
      const st = getAttr(attrs, 'style');
      if (st != null) {
        const cs = cleanStyle(decodeEntities(st));
        if (cs) attrStr += ' style="' + escAttr(cs) + '"';
      }
      out += '<' + name + attrStr + '>';
      stack.push(name);
    }
    const tail = src.slice(last);
    if (!skipUntil && tail) out += escText(tail);
    while (stack.length) out += '</' + stack.pop() + '>';
    return out;
  };

  const api = { sanitizeHtml, safeUrl, cleanStyle };
  if (typeof window !== 'undefined') window.SRSanitize = api;
  if (typeof globalThis !== 'undefined') globalThis.SRSanitize = api;
})();
