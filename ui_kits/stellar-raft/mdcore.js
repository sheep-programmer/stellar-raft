/* mdcore.js — window.SRMd：Markdown 纯字符串核心（不依赖 DOM，Node 可直接
   import 做单元测试，tests/mdcore.test.js）。编辑器的四条 Markdown 通路共用：
     parseMdBlocks(text)        → 块数组（粘贴 / 导入）
     parseFrontmatter(text)     → { props, tags, body }（YAML frontmatter 回填属性）
     matchInline(textBeforeCaret) → { len, html }（打字时行内 **x** · *x* · `x` · ~~x~~ 即时转换）
     blocksToMd(blocks, opts)   → Markdown 全文（导出，含 frontmatter 与列表缩进）
   链接协议统一走 SRSanitize.safeUrl（未加载时退化为最小黑名单）。 */
(function () {
  'use strict';

  const uid = () => 'b' + Math.random().toString(36).slice(2, 8);
  const safeUrl = (u) => {
    const S = typeof globalThis !== 'undefined' ? globalThis.SRSanitize : null;
    if (S && S.safeUrl) return S.safeUrl(u);
    return /^\s*(javascript|data|vbscript):/i.test(String(u || '')) ? null : u;
  };
  const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 行内代码的着色走主题 token（color-mix），黎明主题下同样成立
  const CODE_SPAN_CSS = 'font-family:var(--font-mono);font-size:0.92em;background:color-mix(in srgb, var(--star-blue) 14%, transparent);padding:1px 5px;border-radius:5px;';

  /* ---- 行内标记 → HTML（整行解析，粘贴 / 导入用） ---- */
  const mdInline = (s) => escHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code style="' + CODE_SPAN_CSS + '">$1</code>')
    // 链接协议白名单：javascript:/data: 等降级为纯文本（保留可见字样，去掉可点 href）
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (mm, txt, url) => {
      const ok = safeUrl(url);
      return ok
        ? '<a href="' + ok.replace(/"/g, '&quot;') + '" style="color:var(--star-blue);text-decoration:underline;text-underline-offset:3px;">' + txt + '</a>'
        : txt;
    });

  /* ---- 打字即时转换：光标前缀里已闭合的行内标记（Typora 式，空格触发） ----
     顺序敏感：** 在 * 之前；斜体用 lookbehind 避免吃掉 ** 的一半。
     不支持 _下划线_ 语法——snake_case / __init__ 一类标识符太容易误伤。 */
  const INLINE_RULES = [
    { re: /\*\*([^*]+)\*\*$/, tag: 'b' },
    { re: /~~([^~]+)~~$/, tag: 's' },
    { re: /`([^`]+)`$/, tag: 'code' },
    { re: /(?<!\*)\*([^*\s](?:[^*]*[^*\s])?)\*$/, tag: 'i' },
  ];
  const matchInline = (pre) => {
    const s = String(pre == null ? '' : pre);
    for (const r of INLINE_RULES) {
      const m = s.match(r.re);
      if (!m || !m[1]) continue;
      const inner = escHtml(m[1]);
      const html = r.tag === 'code'
        ? '<code style="' + CODE_SPAN_CSS + '">' + inner + '</code>'
        : '<' + r.tag + '>' + inner + '</' + r.tag + '>';
      return { len: m[0].length, html };
    }
    return null;
  };

  /* ---- 整段 Markdown → 块数组 ----
     列表（- · * · + · 数字. · []）带缩进解析为 indent 层级（2 空格一级，封顶 5），
     嵌套列表不再被压平；非列表的 4 空格缩进段仍识别为 plaintext 代码块。 */
  const LIST_RE = /^([-*+]|\d+[.)])\s/;
  function parseMdBlocks(text) {
    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0, m;
    while (i < lines.length) {
      const raw = lines[i];
      const l = raw.trim();
      if (!l) { i++; continue; }
      const lead = (raw.match(/^[ \t]*/)[0] || '').replace(/\t/g, '  ').length;
      const indent = Math.min(5, Math.floor(lead / 2));
      const ind = indent ? { indent } : {};
      if ((m = l.match(/^```(\w*)/))) {                                    // 代码围栏
        const buf = []; i++;
        let closed = false;
        while (i < lines.length) { if (/^```/.test(lines[i].trim())) { closed = true; i++; break; } buf.push(lines[i]); i++; }
        // 只有真正围起了内容才建代码块——文本末尾一个孤零零的 ``` 不再遗留空 code 块
        if (closed || buf.length) out.push({ id: uid(), type: 'code', lang: (m[1] || 'plaintext').toLowerCase(), code: buf.join('\n') });
      }
      else if ((m = l.match(/^[-*+]\s+\[( |x|X)\]\s+(.*)/))) { out.push({ id: uid(), type: 'todo', checked: m[1].toLowerCase() === 'x', text: mdInline(m[2]), ...ind }); i++; }
      else if (/^(-{3,}|\*{3,})$/.test(l)) { out.push({ id: uid(), type: 'divider' }); i++; }
      else if ((m = l.match(/^[-*+]\s+(.*)/))) { out.push({ id: uid(), type: 'bulleted', text: mdInline(m[1]), ...ind }); i++; }
      else if ((m = l.match(/^(\d+)[.)]\s+(.*)/))) { out.push({ id: uid(), type: 'numbered', text: mdInline(m[2]), ...ind, ...(m[1] !== '1' ? { start: parseInt(m[1], 10) } : {}) }); i++; }
      else if (/^(\t| {4,})\S/.test(raw)) {                                // 缩进代码：连续缩进行整体保留为 plaintext 代码块
        const buf = [];
        while (i < lines.length
          && (/^(\t| {2,})\S/.test(lines[i]) || (lines[i].trim() === '' && i + 1 < lines.length && /^(\t| {2,})\S/.test(lines[i + 1])))
          && !LIST_RE.test(lines[i].trim())) { buf.push(lines[i]); i++; }
        const minIndent = Math.min(...buf.filter(x => x.trim()).map(x => (x.match(/^[ \t]*/)[0] || '').length));
        out.push({ id: uid(), type: 'code', lang: 'plaintext', code: buf.map(x => x.slice(minIndent)).join('\n') });
      } else if (/^\$\$/.test(l)) {                                        // 数学块
        if (l.length > 4 && /\$\$$/.test(l)) { out.push({ id: uid(), type: 'math', tex: l.slice(2, -2).trim() }); i++; }
        else {
          const buf = []; i++;
          while (i < lines.length && !/\$\$/.test(lines[i])) { buf.push(lines[i]); i++; }
          i++;
          out.push({ id: uid(), type: 'math', tex: buf.join('\n').trim() });
        }
      } else if (/^\|.+\|$/.test(l)) {                                     // 表格
        const rowsRaw = [];
        while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) { rowsRaw.push(lines[i].trim()); i++; }
        const cells = (r) => r.slice(1, -1).split('|').map(c => c.trim());
        const body = rowsRaw.slice(1).filter(r => !/^\|[\s:\-|]+\|$/.test(r)).map(cells);
        out.push({ id: uid(), type: 'table', head: cells(rowsRaw[0]), rows: body });
      }
      else if ((m = l.match(/^(#{1,3})\s+(.*)/))) { out.push({ id: uid(), type: 'h' + m[1].length, text: mdInline(m[2]) }); i++; }
      else if ((m = l.match(/^>\s?(.*)/))) { out.push({ id: uid(), type: 'quote', text: mdInline(m[1]) }); i++; }
      else { out.push({ id: uid(), type: 'p', text: mdInline(l) }); i++; }
    }
    return out;
  }

  /* ---- YAML frontmatter（--- 包围的 k: v 段）→ { props, tags, body } ---- */
  function parseFrontmatter(text) {
    const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) return { props: null, tags: null, body: src };
    const props = {};
    let tags = null;
    m[1].split('\n').forEach(line => {
      const mm = line.match(/^([A-Za-z_一-鿿][\w一-鿿-]*)\s*:\s*(.*)$/);
      if (!mm) return;
      const k = mm[1];
      const v = mm[2].trim().replace(/^["']|["']$/g, '');
      if (k === 'tags') { tags = v.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean); return; }
      if (v) props[k] = v;
    });
    return { props: Object.keys(props).length ? props : null, tags, body: src.slice(m[0].length) };
  }

  /* ---- 块数组 → Markdown（导出）----
     opts: { title, props, tags, summary }。frontmatter / admonition / <details> /
     列表缩进（2 空格一级）/ 协议白名单与 Editor 渲染语义一一对应。 */
  const stripTags = (h) => String(h == null ? '' : h).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const htmlToMd = (h) => stripTags(String(h == null ? '' : h)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<(s|strike|del)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    // 导出时同样过协议白名单：非法链接降级为纯文本，不把 javascript:/data: 带出仓
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (mm, url, txt) => safeUrl(url) ? '[' + txt + '](' + url + ')' : txt)).trim();

  function blocksToMd(blocks, opts) {
    const o = opts || {};
    const lines = [];
    let counters = [];
    (blocks || []).forEach(b => {
      if (b.type !== 'numbered') counters = [];
      const pad = '  '.repeat(b.indent || 0);
      switch (b.type) {
        case 'rich': if (o.summary) lines.push(o.summary); break;
        case 'h1': lines.push('# ' + htmlToMd(b.text)); break;
        case 'h2': lines.push('## ' + htmlToMd(b.text)); break;
        case 'h3': lines.push('### ' + htmlToMd(b.text)); break;
        case 'p': lines.push(htmlToMd(b.text)); break;
        case 'quote': lines.push('> ' + htmlToMd(b.text)); break;
        // callout 用 admonition 语法并带 tone，round-trip 不再退化成普通引用
        case 'callout': lines.push('> [!' + (b.tone === 'blue' ? 'note' : 'tip') + ']\n> ' + htmlToMd(b.text)); break;
        case 'bulleted': lines.push(pad + '- ' + htmlToMd(b.text)); break;
        case 'numbered': {
          const lvl = b.indent || 0;
          counters = counters.slice(0, lvl + 1);
          if (counters[lvl] == null) counters[lvl] = 0;
          if (counters[lvl] === 0 && b.start) counters[lvl] = b.start - 1;
          counters[lvl] += 1;
          lines.push(pad + counters[lvl] + '. ' + htmlToMd(b.text));
          break;
        }
        case 'todo': lines.push(pad + '- [' + (b.checked ? 'x' : ' ') + '] ' + htmlToMd(b.text)); break;
        // toggle 用标准可折叠 <details>，标注其为折叠块
        case 'toggle': lines.push('<details>\n<summary>' + htmlToMd(b.text) + '</summary>\n\n' + htmlToMd(b.child || '') + '\n</details>'); break;
        case 'math': lines.push('$$\n' + (b.tex || '') + '\n$$'); break;
        case 'code': lines.push('```' + (b.lang || '') + '\n' + (b.code || '') + '\n```'); break;
        case 'divider': lines.push('---'); break;
        // 本地上传的 dataURL 不把超大 base64 内联进 md，改为附件提示
        case 'image': lines.push(/^data:/.test(b.src || '') ? '![' + (b.alt || '本地图片') + '](附件：本地上传的图片已略去内联数据)' : '![' + (b.alt || '') + '](' + (b.src || '') + ')'); break;
        case 'table': {
          const head = b.head || [];
          const rows = b.rows || [];
          if (!head.length) break;
          lines.push('| ' + head.join(' | ') + ' |');
          lines.push('| ' + head.map(() => '---').join(' | ') + ' |');
          rows.forEach(r => lines.push('| ' + r.join(' | ') + ' |'));
          break;
        }
        default: break;
      }
    });
    // YAML frontmatter：把结构化属性写出，round-trip 后属性不再丢失（对标 Obsidian）
    const p = o.props || {};
    const fm = [];
    const pushFm = (k, v) => { if (v != null && String(v).trim() !== '' && v !== '—') fm.push(k + ': ' + v); };
    pushFm('type', p.type); pushFm('status', p.status); pushFm('source', p.source);
    pushFm('alias', p.alias); pushFm('nextReview', p.nextReview);
    if (o.tags && o.tags.length) fm.push('tags: [' + o.tags.join(', ') + ']');
    const front = fm.length ? '---\n' + fm.join('\n') + '\n---\n\n' : '';
    const title = o.title ? '# ' + o.title + '\n\n' : '';
    return front + title + lines.filter(l => l != null && l !== '').join('\n\n') + '\n';
  }

  const api = { parseMdBlocks, parseFrontmatter, matchInline, mdInline, blocksToMd, CODE_SPAN_CSS, INLINE_RULES };
  if (typeof window !== 'undefined') window.SRMd = api;
  if (typeof globalThis !== 'undefined') globalThis.SRMd = api;
})();
