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
    /* 链接正则是这条管线上唯一的回溯风险：「开括号多、闭括号少」的输入
       （粘进来的日志、代码）会让无界的 [^\]]+ / [^)\s]+ 逐位回溯——实测
       '['×10万 要 4.2s，×100万 直接冻页。两道闸：没有 ' ](' 的文本根本不
       可能有链接，整个正则跳过；量词有界（文字 ≤300 / URL ≤2000），每个
       候选位的失败成本从 O(n) 收成 O(1)。超限链接降级为字面文本。 */
    const withLinks = src.includes('](');
    return escHtml(src)
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<b><i>$1</i></b>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/`([^`]+)`/g, '<code style="' + CODE_SPAN_CSS + '">$1</code>')
      // 链接协议白名单：javascript:/data: 等降级为纯文本（保留可见字样，去掉可点 href）
      .replace(withLinks ? /\[([^\]]{1,300})\]\(([^)\s]{1,2000})(?:\s+&quot;[^&]{0,300}&quot;|\s+"[^"]{0,300}")?\)/g : /$a/, (mm, txt, url) => {
        const ok = safeUrl(url);
        return ok ? LINK_A(ok, txt) : txt;
      })
      // 自动链接 <https://…>（escHtml 之后尖括号已成实体）
      .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (mm, url) => safeUrl(url) ? LINK_A(url, url) : url)
      // oxlint-disable-next-line no-control-regex -- \u0000 是本文件自己埋的占位哨兵，正则必须认得它
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
    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').split('\n');
    const out = [];
    let i = 0, m;
    /* 列表项的续行（导出端按标记宽度缩进续行；CommonMark 同样把更深缩进的
       内容归给列表项）。只并「更深缩进、非空、本身不是新结构」的行，
       嵌套列表项/围栏/标题/表格照旧各立门户。 */
    const absorb = (bk, minLead) => {
      while (i < lines.length) {
        const raw2 = lines[i];
        if (!raw2.trim()) break;
        const lead2 = (raw2.match(/^[ \t]*/)[0] || '').replace(/\t/g, '  ').length;
        if (lead2 < minLead) break;
        const t2 = raw2.trim();
        if (LIST_RE.test(t2) || /^(`{3,}|-{3,}|\*{3,}|#{1,6}(\s|$)|\$\$|\|)/.test(t2)) break;
        bk.text += '<br>' + mdInline(t2);
        i++;
      }
    };
    while (i < lines.length) {
      const raw = lines[i];
      const l = raw.trim();
      if (!l) { i++; continue; }
      const lead = (raw.match(/^[ \t]*/)[0] || '').replace(/\t/g, '  ').length;
      const indent = Math.min(5, Math.floor(lead / 2));
      const ind = indent ? { indent } : {};
      if ((m = l.match(/^(`{3,})([\w+#.-]*)/))) {                         // 代码围栏（长度可变；语言号认 C++ / c# 这类字符）
        const buf = []; i++;
        let closed = false;
        /* 收尾的围栏至少要和开头一样长（CommonMark）。只认死三个反引号的话，
           内容里那行 ``` 会把代码块提前关掉，剩下的代码掉进正文。 */
        const fenceLen = m[1].length;
        const closeRe = new RegExp('^`{' + fenceLen + ',}\\s*$');
        while (i < lines.length) { if (closeRe.test(lines[i].trim())) { closed = true; i++; break; } buf.push(lines[i]); i++; }
        // 只有真正围起了内容才建代码块——文本末尾一个孤零零的 ``` 不再遗留空 code 块
        // m[1] 现在是围栏本身，语言在 m[2]
        if (closed || buf.length) out.push({ id: uid(), type: 'code', lang: (m[2] || 'plaintext').toLowerCase(), code: buf.join('\n') });
      }
      else if ((m = l.match(/^[-*+]\s+\[( |x|X)\](?:\s+(.*)|$)/))) { const bk = { id: uid(), type: 'todo', checked: m[1].toLowerCase() === 'x', text: mdInline(m[2] || ''), ...ind }; out.push(bk); i++; absorb(bk, lead + 2); }
      else if (/^(-{3,}|\*{3,})$/.test(l)) { out.push({ id: uid(), type: 'divider' }); i++; }
      // 裸标记（`-` / `1.` 无内容）也是合法的空列表项——与导出端的空块互逆
      else if ((m = l.match(/^[-*+](?:\s+(.*)|$)/))) { const bk = { id: uid(), type: 'bulleted', text: mdInline(m[1] || ''), ...ind }; out.push(bk); i++; absorb(bk, lead + 2); }
      else if ((m = l.match(/^(\d+)[.)](?:\s+(.*)|$)/))) { const bk = { id: uid(), type: 'numbered', text: mdInline(m[2] || ''), ...ind, ...(m[1] !== '1' ? { start: parseInt(m[1], 10) } : {}) }; out.push(bk); i++; absorb(bk, lead + 2); }
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
          /* 收尾只认「整行就是 $$」——内容行里含 $$（如 TeX 的 a $$ b）不能当
             结束符，否则公式被从中间截断、后半截掉进正文，导出再导入即丢内容 */
          const buf = []; i++;
          while (i < lines.length && !/^\$\$\s*$/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
          i++;
          out.push({ id: uid(), type: 'math', tex: buf.join('\n').trim() });
        }
      } else if (/^\|.+\|$/.test(l)) {                                     // 表格（\| 转义的竖线按字面归位）
        const rowsRaw = [];
        while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) { rowsRaw.push(lines[i].trim()); i++; }
        const cells = (r) => r.slice(1, -1).split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
        /* 分隔行只认第二行这个位置——GFM 表格的分隔线本来就必须紧跟表头。
           之前是「任何全由 -|: 组成的行都过滤」，于是一行 --- 的**数据行**被静默丢掉 */
        const hasSep = rowsRaw.length > 1 && /^\|[\s:\-|]+\|$/.test(rowsRaw[1]);
        const body = rowsRaw.slice(hasSep ? 2 : 1).map(cells);
        out.push({ id: uid(), type: 'table', head: cells(rowsRaw[0]), rows: body });
      }
      // 独占一行的图片 ![alt](url) / ![alt](<url 带括号或空格>) / ![alt](url "题注") → 图片块；非法协议降级为纯文本段落
      else if ((m = l.match(/^!\[((?:\\[[\]]|[^\]])*)\]\((<[^>\n]+>|[^)\s]+)(?:\s+"[^"]*")?\)$/))) {
        const alt = m[1].replace(/\\([[\]])/g, '$1');
        const src = m[2].replace(/^<|>$/g, '');
        /* data:image/* 单独放行：导出端会把 ≤100KB 的本地图片以 dataURL 内联
           （blocksToMd 的 image 分支），不收回来就是「导得出、导不回」——图在
           回导时静默蒸发。只认 base64 图片，data: 的其它形态（HTML/脚本）仍拒。 */
        const dataImg = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(src);
        out.push(safeUrl(src) || dataImg ? { id: uid(), type: 'image', alt, src } : { id: uid(), type: 'p', text: mdInline(l) });
        i++;
      }
      // 标题支持到 ######：编辑器块模型只有三级，h4–h6 折入 h3（导出仍是合法 Markdown）。
      // 裸「##」也是合法的空标题（CommonMark）——字面值段落由导出端 escLead 转义护住
      else if ((m = l.match(/^(#{1,6})(?:\s+(.*)|\s*$)/))) { out.push({ id: uid(), type: 'h' + Math.min(3, m[1].length), text: mdInline(m[2] || '') }); i++; }
      // GFM 提示框 > [!NOTE] / [!TIP]…（Obsidian 同语法）→ 标注块，吸收随后的 > 续行。
      // 续行按 <br> 并回（导出端对多行标注逐行补 > 前缀）——外来的软换行标注同形，
      // 保留源文件的换行比塌成一行更忠实
      else if ((m = l.match(/^>\s*\[!(\w+)\]\s*(.*)$/))) {
        const buf = m[2] ? [m[2]] : [];
        i++;
        while (i < lines.length && /^>\s?/.test(lines[i].trim()) && !/^>\s*\[!/.test(lines[i].trim())) {
          const t = lines[i].trim().replace(/^>\s?/, ''); if (t) buf.push(t); i++;
        }
        out.push({ id: uid(), type: 'callout', tone: m[1].toLowerCase() === 'tip' ? 'gold' : 'blue', text: buf.map(x => mdInline(x)).join('<br>') });
      }
      // 连续的引用行属于同一个引用块（导出端对多行引用逐行补 > 前缀）；
      // 后随的 > [!…] 是新的提示框，不吞
      else if ((m = l.match(/^>\s?(.*)/))) {
        const parts = [m[1]]; i++;
        while (i < lines.length && /^>\s?/.test(lines[i].trim()) && !/^>\s*\[!/.test(lines[i].trim())) { parts.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
        out.push({ id: uid(), type: 'quote', text: parts.map(x => mdInline(x)).join('<br>') });
      }
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
  /* 值的解引号：导出端用 JSON.stringify 加引（"说\"话"、"a\nb"），
     这里必须真按 JSON 解——只剥一层引号会把 \" 和 \n 原样留在值里 */
  const unq = (v) => {
    const s = String(v == null ? '' : v).trim();
    if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
      try { return JSON.parse(s); } catch { /* 落回裸剥 */ }
    }
    return s.replace(/^["']|["']$/g, '');
  };
  function parseFrontmatter(text) {
    /* BOM 先剥：Windows 记事本存的 .md 常带 \uFEFF，不剥的话开头的 ---
       对不上，整个 frontmatter 退化成正文里的分隔线，tags/props 全丢 */
    const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
    const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) {
      // 空 frontmatter（---\n---\n）：主正则要求包围体里至少一个换行，
      // 空的匹配不上会退化成两个分隔线块——单独认下来，按「无属性」处理
      const empty = src.match(/^---\n---\n?/);
      if (empty) return { props: null, tags: null, body: src.slice(empty[0].length) };
      return { props: null, tags: null, body: src };
    }
    const props = {};
    let tags = null;
    const fmLines = m[1].split('\n');
    for (let li = 0; li < fmLines.length; li++) {
      const mm = fmLines[li].match(/^([A-Za-z_一-鿿][\w一-鿿-]*)\s*:\s*(.*)$/);
      if (!mm) continue;
      const k = mm[1];
      const v = mm[2].trim();
      if (k === 'tags') {
        if (v) {
          // 导出端写的是 JSON 数组（"b,c" 这样的标签不会被逗号劈开）；
          // 外来的裸写法 [a, b] 仍按逗号切（YAML flow 的兼容路径）
          let arr = null;
          if (/^\[/.test(v)) { try { const j = JSON.parse(v); if (Array.isArray(j)) arr = j.map(String); } catch { } }
          if (!arr) arr = v.replace(/^\[|\]$/g, '').split(',').map(unq);
          tags = arr.map(s => String(s).trim()).filter(Boolean);
          if (!tags.length) tags = null;
        }
        else {
          // Obsidian 的块级列表写法：tags: 换行后跟若干「  - x」
          tags = [];
          while (li + 1 < fmLines.length && /^\s+-\s+/.test(fmLines[li + 1])) {
            li++;
            const t = unq(fmLines[li].replace(/^\s+-\s+/, ''));
            if (t) tags.push(t);
          }
          if (!tags.length) tags = null;
        }
        continue;
      }
      const pv = unq(v);
      if (pv) props[k] = pv;
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
    /* 有序列表单独一档：Markdown 的转义位置是分隔符本身（`1\. `），不是数字前面。
       写成 `\1. ` 既护不住（真实解析器照样当列表），导入时也还原不回来——
       ESCAPABLE 的字符集里没有数字，那个反斜杠会原样留在正文里。 */
    .replace(/^(\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
    .replace(/^(#{1,6} |> ?|[-*+] |```|\$\$|\|)/, '\\$1')
    .replace(/^(-{3,}|\*{3,}|={3,})$/, '\\$1')
    // 裸标记也是结构（空标题 `##`、空列表项 `-`）：整行就是标记本身的段落同样护住
    .replace(/^(#{1,6}|[-*+])$/, '\\$1');
  function blocksToMd(blocks, opts) {
    const o = opts || {};
    const lines = [];
    let counters = [];
    (blocks || []).forEach(b => {
      if (b.type !== 'numbered') counters = [];
      const pad = '  '.repeat(b.indent || 0);
      switch (b.type) {
        case 'rich': {
          /* 摘要写成正文开头的第一段。导入时 parseVault 会把第一段认成摘要**并保留在正文里**，
             于是下一次导出就有了两份、再下一次三份——每来回一次多复制一遍。
             这里在导出端掐断：正文里紧跟着的第一个段落如果就是摘要本身，就不再多写一遍。 */
          if (!o.summary) break;
          const firstP = (blocks || []).find(x => x && x.type === 'p' && String(x.text || '').trim());
          const same = firstP && htmlToMd(firstP.text).trim() === String(o.summary).trim();
          /* 摘要是纯文本，写进 Markdown 必须逐行过 escLead：一句以 ``` 或 # 开头的
             摘要会开启围栏/变成标题，把整个文件剩余部分（含「## 关联」与连线）吞掉 */
          if (!same) lines.push(String(o.summary).split('\n').map(escLead).join('\n'));
          break;
        }
        case 'h1': lines.push('# ' + htmlToMd(b.text)); break;
        case 'h2': lines.push('## ' + htmlToMd(b.text)); break;
        case 'h3': lines.push('### ' + htmlToMd(b.text)); break;
        case 'p': lines.push(escLead(htmlToMd(b.text))); break;
        // 引用/列表文本若以 [ 开头（[!NOTE]、[ ] 之类），转义护住——
        // 否则导入端会把引用误认成 callout、把列表项误认成 todo。
        // 多行内容（块内的 <br>）续行必须同样补结构前缀：只给首行加前缀的话，
        // 回导时第二行起就掉出结构，变成独立段落——块被静默拆开
        case 'quote': lines.push(htmlToMd(b.text).replace(/^\[!/, '\\[!').split('\n').map(x => '> ' + x).join('\n')); break;
        // callout 用 GFM 提示框语法（大写才被 GitHub 渲染；Obsidian 大小写皆可）
        case 'callout': lines.push('> [!' + (b.tone === 'blue' ? 'NOTE' : 'TIP') + ']\n' + htmlToMd(b.text).replace(/^\[!/, '\\[!').split('\n').map(x => '> ' + x).join('\n')); break;
        // 续行缩进到与首行文字对齐（标记宽度），导入端据此并回本项
        case 'bulleted': {
          const t = htmlToMd(b.text).replace(/^\[/, '\\[').split('\n');
          lines.push(pad + '- ' + t[0] + (t.length > 1 ? '\n' + t.slice(1).map(x => pad + '  ' + x).join('\n') : ''));
          break;
        }
        case 'numbered': {
          const lvl = b.indent || 0;
          counters = counters.slice(0, lvl + 1);
          if (counters[lvl] == null) counters[lvl] = 0;
          if (counters[lvl] === 0 && b.start) counters[lvl] = b.start - 1;
          counters[lvl] += 1;
          const marker = counters[lvl] + '. ';
          const t = htmlToMd(b.text).replace(/^\[/, '\\[').split('\n');
          lines.push(pad + marker + t[0] + (t.length > 1 ? '\n' + t.slice(1).map(x => pad + ' '.repeat(marker.length) + x).join('\n') : ''));
          break;
        }
        case 'todo': {
          const marker = '- [' + (b.checked ? 'x' : ' ') + '] ';
          const t = htmlToMd(b.text).split('\n');
          lines.push(pad + marker + t[0] + (t.length > 1 ? '\n' + t.slice(1).map(x => pad + ' '.repeat(marker.length) + x).join('\n') : ''));
          break;
        }
        // toggle 用标准可折叠 <details>，标注其为折叠块
        case 'toggle': lines.push('<details>\n<summary>' + htmlToMd(b.text) + '</summary>\n\n' + htmlToMd(b.child || '') + '\n</details>'); break;
        case 'math': lines.push('$$\n' + (b.tex || '') + '\n$$'); break;
        case 'code': {
          /* 围栏要比内容里最长的一串反引号更长（CommonMark 的规矩）。
             笔记里贴一段 Markdown 示例是常事，而固定三个反引号会被内容里的
             ``` 提前关掉——导出再导入，这个代码块会被劈成三块、中间的内容丢掉。 */
          const body = b.code || '';
          const longest = (body.match(/`+/g) || []).reduce((n, r) => Math.max(n, r.length), 0);
          const fence = '`'.repeat(Math.max(3, longest + 1));
          // 语言号收进 [\w+#.-]：C++ / c# 合法；换行/空格会劈开信息行，取首个词再消毒
          const lang = String(b.lang || '').split(/\s/)[0].replace(/[^\w+#.-]/g, '');
          lines.push(fence + lang + '\n' + body + '\n' + fence);
          break;
        }
        case 'divider': lines.push('---'); break;
        // 图片：本地上传的 dataURL 在 100KB 内直接内联（合法 Markdown，Typora/Obsidian/VS Code
        // 都能显示）；超限才降级为附件占位（URL 无空格，真实解析器不碎）。
        // alt 里的 ] 与换行、src 里的空格与括号（维基百科式 URL 很常见）按 CommonMark 转义/
        // <…> 包裹——否则导出的图片行在导入时降级为段落，图丢了
        case 'image': {
          const src0 = b.src || '';
          const alt = String(b.alt || '').replace(/\r?\n/g, ' ').replace(/([[\]])/g, '\\$1');
          /* 超限 dataURL 不内联。占位不能写成图片语法——回导会生成一个 src 指向
             占位文字的 image 块，编辑器里就是一张永久裂图。写成引用行：导入回来
             是一段能读懂的说明，而不是一块坏图。 */
          if (/^data:/.test(src0) && src0.length >= 100000) { lines.push('> 📷 本地图片「' + (alt || '未命名') + '」超过 100KB，未内联进这份导出'); break; }
          const src = /[\s()]/.test(src0) ? '<' + src0.replace(/[<>]/g, '') + '>' : src0;
          lines.push('![' + alt + '](' + src + ')');
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
    /* 值里带 YAML 敏感字符或**换行**时按 JSON 加引写出（解析端用 JSON.parse 解回）。
       换行最要命：不加引会把一个值写成两行，导入只读回第一行，后半静默丢 */
    const pushFm = (k, v) => {
      if (v == null) return;
      const s = String(v).trim();
      if (!s || s === '—') return;
      fm.push(k + ': ' + (/[:#'"[\]{}|>&*!%@`\n\r]/.test(s) ? JSON.stringify(s) : s));
    };
    pushFm('type', p.type); pushFm('status', p.status); pushFm('source', p.source);
    pushFm('alias', p.alias); pushFm('nextReview', p.nextReview);
    /* id 与 fav 随 frontmatter 走（vault 导出时传入）：导入端靠旧 id 重建
       正文里 stellar-raft://star/<旧id> 的指向——没有它，回导后这些链接
       全部指向不存在的星，变成死链。fav 是星上的收藏标记，不该默默丢。 */
    if (o.id) fm.push('id: ' + String(o.id).replace(/[^\w-]/g, ''));
    if (o.fav) fm.push('fav: true');
    // tags 恒写 JSON 数组（合法 YAML flow）——「a,b」这样的标签不会被逗号劈成两个
    if (o.tags && o.tags.length) fm.push('tags: ' + JSON.stringify(o.tags.map(String)));
    const front = fm.length ? '---\n' + fm.join('\n') + '\n---\n\n' : '';
    // 标题恒为一行：换行会把后半截劈进正文
    const title = o.title ? '# ' + String(o.title).replace(/\s*\n\s*/g, ' ').trim() + '\n\n' : '';
    return front + title + lines.filter(l => l != null && l !== '').join('\n\n') + '\n';
  }

  const api = { parseMdBlocks, parseFrontmatter, matchInline, mdInline, blocksToMd, CODE_SPAN_CSS, INLINE_RULES };
  if (typeof window !== 'undefined') window.SRMd = api;
  if (typeof globalThis !== 'undefined') globalThis.SRMd = api;
})();
