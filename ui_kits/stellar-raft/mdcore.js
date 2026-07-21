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

  /* ---- 行内标记 → HTML（整行解析，粘贴 / 导入用） ----
     反斜杠转义先行提位（\* \| \# …按字面处理，不再被规则误吞），***x*** 粗斜体、
     [t](url "标题") 带题链接、<https://…> 自动链接都对齐真实 Markdown。 */
  const ESCAPABLE = /\\([\\`*_[\]()#+\-.!|>~${}])/g;
  const LINK_A = (url, txt) => '<a href="' + url.replace(/"/g, '&quot;') + '" style="color:var(--star-blue);text-decoration:underline;text-underline-offset:3px;">' + txt + '</a>';
  const mdInline = (s) => {
    const toks = [];
    const src = String(s == null ? '' : s).replace(ESCAPABLE, (mm, c) => { toks.push(c); return '\u0000' + (toks.length - 1) + '\u0000'; });
    return escHtml(src)
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<b><i>$1</i></b>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/`([^`]+)`/g, '<code style="' + CODE_SPAN_CSS + '">$1</code>')
      // 链接协议白名单：javascript:/data: 等降级为纯文本（保留可见字样，去掉可点 href）
      .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;|\s+"[^"]*")?\)/g, (mm, txt, url) => {
        const ok = safeUrl(url);
        return ok ? LINK_A(ok, txt) : txt;
      })
      // 自动链接 <https://…>（escHtml 之后尖括号已成实体）
      .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (mm, url) => safeUrl(url) ? LINK_A(url, url) : url)
      .replace(/\u0000(\d+)\u0000/g, (mm, n) => escHtml(toks[Number(n)]));
  };

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
      } else if (/^\|.+\|$/.test(l)) {                                     // 表格（\| 转义的竖线按字面归位）
        const rowsRaw = [];
        while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) { rowsRaw.push(lines[i].trim()); i++; }
        const cells = (r) => r.slice(1, -1).split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
        const body = rowsRaw.slice(1).filter(r => !/^\|[\s:\-|]+\|$/.test(r)).map(cells);
        out.push({ id: uid(), type: 'table', head: cells(rowsRaw[0]), rows: body });
      }
      // 独占一行的图片 ![alt](url) / ![alt](url "题注") → 图片块；非法协议降级为纯文本段落
      else if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/))) {
        out.push(safeUrl(m[2]) ? { id: uid(), type: 'image', alt: m[1], src: m[2] } : { id: uid(), type: 'p', text: mdInline(l) });
        i++;
      }
      // 标题支持到 ######：编辑器块模型只有三级，h4–h6 折入 h3（导出仍是合法 Markdown）
      else if ((m = l.match(/^(#{1,6})\s+(.*)/))) { out.push({ id: uid(), type: 'h' + Math.min(3, m[1].length), text: mdInline(m[2]) }); i++; }
      // GFM 提示框 > [!NOTE] / [!TIP]…（Obsidian 同语法）→ 标注块，吸收随后的 > 续行
      else if ((m = l.match(/^>\s*\[!(\w+)\]\s*(.*)$/))) {
        const buf = m[2] ? [m[2]] : [];
        i++;
        while (i < lines.length && /^>\s?/.test(lines[i].trim()) && !/^>\s*\[!/.test(lines[i].trim())) {
          const t = lines[i].trim().replace(/^>\s?/, ''); if (t) buf.push(t); i++;
        }
        out.push({ id: uid(), type: 'callout', tone: m[1].toLowerCase() === 'tip' ? 'gold' : 'blue', text: mdInline(buf.join(' ')) });
      }
      else if ((m = l.match(/^>\s?(.*)/))) { out.push({ id: uid(), type: 'quote', text: mdInline(m[1]) }); i++; }
      // <details><summary>…</summary>…</details> → 折叠块（与导出的 toggle 语法互逆）
      else if (/^<details>/i.test(l)) {
        const buf = [raw];
        if (!/<\/details>/i.test(l)) {
          i++;
          while (i < lines.length) { buf.push(lines[i]); if (/<\/details>/i.test(lines[i])) { i++; break; } i++; }
        } else i++;
        const all = buf.join('\n');
        const sm = all.match(/<summary>([\s\S]*?)<\/summary>/i);
        const child = all.replace(/<\/?details>/gi, '').replace(/<summary>[\s\S]*?<\/summary>/i, '').trim();
        out.push({ id: uid(), type: 'toggle', text: mdInline(sm ? sm[1].trim() : '折叠'), child: mdInline(child) });
      }
      // Setext 标题：下一行全为 = 号 → 一级标题（真实 Markdown 的另一种写法）
      else if (i + 1 < lines.length && /^=+$/.test(lines[i + 1].trim())) { out.push({ id: uid(), type: 'h1', text: mdInline(l) }); i += 2; }
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
    const fmLines = m[1].split('\n');
    for (let li = 0; li < fmLines.length; li++) {
      const mm = fmLines[li].match(/^([A-Za-z_一-鿿][\w一-鿿-]*)\s*:\s*(.*)$/);
      if (!mm) continue;
      const k = mm[1];
      const v = mm[2].trim().replace(/^["']|["']$/g, '');
      if (k === 'tags') {
        if (v) { tags = v.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean); }
        else {
          // Obsidian 的块级列表写法：tags: 换行后跟若干「  - x」
          tags = [];
          while (li + 1 < fmLines.length && /^\s+-\s+/.test(fmLines[li + 1])) {
            li++;
            const t = fmLines[li].replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, '');
            if (t) tags.push(t);
          }
          if (!tags.length) tags = null;
        }
        continue;
      }
      if (v) props[k] = v;
    }
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
    // 行内代码本身含反引号时用双反引号包裹（CommonMark 语义），round-trip 不碎
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (mm, c) => c.includes('`') ? '`` ' + c + ' ``' : '`' + c + '`')
    // 导出时同样过协议白名单：非法链接降级为纯文本，不把 javascript:/data: 带出仓
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (mm, url, txt) => safeUrl(url) ? '[' + txt + '](' + url + ')' : txt)).trim();

  // 段落导出的防歧义转义：正文若以 Markdown 结构记号开头（# > - 1. ``` $$ | 或整行 ---），
  // 加反斜杠护住，round-trip 后仍是同一个段落，不会被真实解析器误读成结构
  const escLead = (s) => String(s == null ? '' : s)
    .replace(/^(#{1,6} |> ?|[-*+] |\d+[.)] |```|\$\$|\|)/, '\\$1')
    .replace(/^(-{3,}|\*{3,}|={3,})$/, '\\$1');
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
        case 'p': lines.push(escLead(htmlToMd(b.text))); break;
        case 'quote': lines.push('> ' + htmlToMd(b.text)); break;
        // callout 用 GFM 提示框语法（大写才被 GitHub 渲染；Obsidian 大小写皆可）
        case 'callout': lines.push('> [!' + (b.tone === 'blue' ? 'NOTE' : 'TIP') + ']\n> ' + htmlToMd(b.text)); break;
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
        // 图片：本地上传的 dataURL 在 100KB 内直接内联（合法 Markdown，Typora/Obsidian/VS Code
        // 都能显示）；超限才降级为附件占位（URL 无空格，真实解析器不碎）
        case 'image': {
          const src = b.src || '';
          if (/^data:/.test(src) && src.length >= 100000) { lines.push('![' + (b.alt || '本地图片') + '](本地图片-过大未内联)'); break; }
          lines.push('![' + (b.alt || '') + '](' + src + ')');
          break;
        }
        case 'table': {
          const head = b.head || [];
          const rows = b.rows || [];
          if (!head.length) break;
          // 单元格里的竖线与换行按 GFM 规矩处理（\| 与空格），表格结构永不被内容撑破。
          // 整张表作为一个块推入——行与行之间不能隔空行，否则真实解析器会把表拆碎
          const cell = (c) => String(c == null ? '' : c).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
          const tbl = ['| ' + head.map(cell).join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |'];
          rows.forEach(r => tbl.push('| ' + r.map(cell).join(' | ') + ' |'));
          lines.push(tbl.join('\n'));
          break;
        }
        default: break;
      }
    });
    // YAML frontmatter：把结构化属性写出，round-trip 后属性不再丢失（对标 Obsidian）
    const p = o.props || {};
    const fm = [];
    // 值里带冒号 / 井号 / 引号等 YAML 敏感字符时加引号，Obsidian 属性面板读得回来
    const pushFm = (k, v) => {
      if (v == null) return;
      const s = String(v).trim();
      if (!s || s === '—') return;
      fm.push(k + ': ' + (/[:#'"[\]{}|>&*!%@`]/.test(s) ? JSON.stringify(s) : s));
    };
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
