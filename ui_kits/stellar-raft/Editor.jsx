/* Editor — professional block editor (screen 8). Block-driven: hover handles,
   right-click context menu, slash insert, selection toolbar, many block types,
   contentEditable text, + the right knowledge rail. Content is data-driven:
   each star renders its own body / summary / properties / relations. */
const { GlassPanel, Icon, IconButton, Input, Tag, Badge, MemoryBar, Button, Select, Modal } = window.StellarRaftDesignSystem_2866af;

const TXT = { default: 'var(--text-1)', blue: 'var(--star-blue)', gold: 'var(--gold)', dim: 'var(--star-blue-dim)', danger: 'var(--danger)' };
const BG = { none: 'transparent', bgblue: 'rgba(159,198,255,0.10)', bggold: 'rgba(255,217,138,0.10)', bgdeep: 'rgba(26,35,80,0.45)' };
const uid = () => 'b' + Math.random().toString(36).slice(2, 8);

const EDITABLE = ['p', 'h1', 'h2', 'h3', 'bulleted', 'numbered', 'todo', 'quote', 'toggle', 'callout'];

// 新建/转换为结构块时初始化真实空结构——否则 CodeBlock/DataTable 会兜底渲染演示
// 内容（「看到」的不等于「存下」的），导出也把演示表当真数据写出。
const typeExtras = (type, existing) => {
  const e = existing || {};
  const x = {};
  if (type === 'code' && e.code == null) { x.code = ''; x.lang = e.lang || 'python'; x._new = true; }
  if (type === 'table' && !e.head) { x.head = ['列 1', '列 2']; x.rows = [['', ''], ['', '']]; }
  if (type === 'math' && e.tex == null) { x.tex = ''; x._new = true; }
  if (type === 'toggle' && e.child == null) { x.child = ''; x.open = true; }
  return x;
};

/* 白名单 HTML 清洗（sanitize.js）：渲染前 + 入库前双端调用；协议白名单同源。
   sanitize.js 加载失败时兜底为最小转义，绝不裸渲染原始 HTML。 */
const SAN = (typeof window !== 'undefined' && window.SRSanitize) || null;
const sanHtml = (h) => SAN ? SAN.sanitizeHtml(h) : String(h == null ? '' : h).replace(/</g, '&lt;').replace(/>/g, '&gt;');
const safeUrl = (u) => SAN ? SAN.safeUrl(u) : (/^\s*(javascript|data|vbscript):/i.test(String(u || '')) ? null : u);

/* ---- Markdown 支持：核心搬进 mdcore.js（window.SRMd，纯字符串、Node 可测）。
   这里只留薄封装与加载失败的最小兜底。 ---- */
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MD = (typeof window !== 'undefined' && window.SRMd) || null;
const CODE_SPAN_CSS = (MD && MD.CODE_SPAN_CSS) || 'font-family:var(--font-mono);font-size:0.92em;background:color-mix(in srgb, var(--star-blue) 14%, transparent);padding:1px 5px;border-radius:5px;';
const parseMdBlocks = (text) => MD ? MD.parseMdBlocks(text)
  : String(text || '').split('\n').filter(l => l.trim()).map(l => ({ id: uid(), type: 'p', text: escHtml(l) }));
const matchInlineMd = (pre) => (MD && MD.matchInline) ? MD.matchInline(pre) : null;

function Handle({ icon, title, onClick, onMouseDown }) {
  const [h, setH] = React.useState(false);
  return (
    <button type="button" title={title} className="sr-focus-ring sr-hit40" onMouseDown={(e) => { e.preventDefault(); if (onMouseDown) onMouseDown(e); }} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 22, height: 24, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5,
        background: h ? 'rgba(159,198,255,0.12)' : 'transparent', border: 'none', cursor: 'grab', color: 'var(--text-3)', padding: 0 }}>
      <Icon name={icon} size={15} color="currentColor" />
    </button>
  );
}

function useDawn() {
  const [dawn, setDawn] = React.useState(typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dawn');
  React.useEffect(() => {
    const obs = new MutationObserver(() => setDawn(document.documentElement.dataset.theme === 'dawn'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dawn;
}

const CODE_LANGS = (window.SR_HL && window.SR_HL.LANGS) || ['python', 'javascript', 'plaintext'];

function CodeBlock({ code: codeProp, lang: langProp, onCommitCode, onCommitLang, onCopyFail, autoEdit }) {
  const dawn = useDawn();
  const [copied, setCopied] = React.useState(false);
  const [lang, setLangState] = React.useState(langProp || 'python');
  // 语言切换必须落盘：本地 state + 回写块（否则重开 / 导出语言回退，高亮按错语言）
  const setLang = (v) => { setLangState(v); if (v && onCommitLang) onCommitLang(v); };
  // 语言选择走 DS Select（combobox 键盘词汇 + 焦点环 + 双主题皆由组件承担）
  const langOpts = (CODE_LANGS.includes(lang) ? CODE_LANGS : [lang, ...CODE_LANGS]).map(l => ({ value: l, label: l }));

  // Light code surface in dawn, deep surface at night — syntax palette per theme.
  const P = dawn
    ? { bg: '#e8ecf4', head: '#dde3ef', border: 'rgba(36,52,96,0.18)', plain: '#1b2440', kw: '#7c3aed', fn: '#2563eb', str: '#0a7a4f', com: '#7c87a4', num: '#0e7490', ln: '#9aa4be', meta: '#566184' }
    : { bg: 'rgba(3,4,12,0.66)', head: 'transparent', border: 'var(--glass-border)', plain: '#e2e9ff', kw: '#c9a6ff', fn: '#9fc6ff', str: '#ffd98a', com: '#828fb2', num: '#7fd6c0', ln: 'rgba(190,212,255,0.5)', meta: 'rgba(190,212,255,0.62)' };

  const HL = window.SR_HL;
  const sample = (HL && (HL.SAMPLES[lang] || HL.GENERIC)) || '';
  const [code, setCode] = React.useState(codeProp != null ? codeProp : sample);
  const [editingCode, setEditingCode] = React.useState(!!autoEdit);
  const rows = HL ? HL.tokenize(code, lang) : code.split('\n').map(line => [{ t: line, c: 'plain' }]);

  return (
    <div style={{ background: P.bg, border: '1px solid ' + P.border, borderRadius: 'var(--r-md)', margin: '2px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 10px', borderBottom: '1px solid ' + P.border, background: P.head, borderRadius: 'var(--r-md) var(--r-md) 0 0', position: 'relative' }}>
        <Icon name="code" size={14} color={P.meta} style={{ flex: 'none' }} />
        <Select size="sm" aria-label="代码语言" value={lang} options={langOpts}
          onChange={(v) => setLang(v)} style={{ width: 148, flex: 'none' }} />
        <div style={{ flex: 1 }} />
        <button type="button" className="sr-focus-ring sr-hit40" onClick={() => {
          // 真正写剪贴板；成功后才切「已复制」，失败降级隐藏 textarea，再失败给提示
          const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1200); };
          const fallback = () => {
            try {
              const ta = document.createElement('textarea');
              ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
              document.body.appendChild(ta); ta.select();
              const ok = document.execCommand('copy'); ta.remove();
              if (ok) done(); else if (onCopyFail) onCopyFail();
            } catch (e) { if (onCopyFail) onCopyFail(); }
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done).catch(fallback);
          } else fallback();
        }}
          title="复制代码"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? (dawn ? '#b8801a' : '#ffd98a') : P.meta, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
          <Icon name={copied ? 'check' : 'copy'} size={13} color="currentColor" />{copied ? '已复制' : '复制'}
        </button>
      </div>
      {editingCode ? (
        <textarea value={code} autoFocus spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => { setEditingCode(false); if (onCommitCode) onCommitCode(code); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.currentTarget.blur(); return; }
            // Tab 在代码里是缩进不是移焦：插入 4 空格；Shift+Tab 回退本行行首缩进
            if (e.key === 'Tab') {
              e.preventDefault();
              const ta = e.currentTarget;
              const v = ta.value, s0 = ta.selectionStart, e0 = ta.selectionEnd;
              if (e.shiftKey) {
                const ls = v.lastIndexOf('\n', s0 - 1) + 1;
                const m = v.slice(ls).match(/^(\t| {1,4})/);
                if (!m) return;
                const nv = v.slice(0, ls) + v.slice(ls + m[1].length);
                ta.value = nv; ta.selectionStart = ta.selectionEnd = Math.max(ls, s0 - m[1].length);
                setCode(nv);
              } else {
                const nv = v.slice(0, s0) + '    ' + v.slice(e0);
                ta.value = nv; ta.selectionStart = ta.selectionEnd = s0 + 4;
                setCode(nv);
              }
            }
          }}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: Math.max(80, rows.length * 22 + 24), background: 'transparent', color: P.plain, border: 'none', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.85, padding: '12px 14px', tabSize: 4, borderRadius: '0 0 var(--r-md) var(--r-md)' }} />
      ) : (
        <div onClick={() => setEditingCode(true)} title="点击编辑代码" style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.85, color: P.plain, overflowX: 'auto', cursor: 'text', minHeight: 24, borderRadius: '0 0 var(--r-md) var(--r-md)' }}>
          {rows.map((toks, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, whiteSpace: 'pre' }}>
              <span style={{ width: 18, flex: 'none', textAlign: 'right', color: P.ln, userSelect: 'none' }}>{i + 1}</span>
              <span>{toks.map((tk, j) => <span key={j} style={{ color: P[tk.c] || P.plain }}>{tk.t}</span>)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataTable({ head: headProp, rows: rowsProp, onCommit }) {
  // 单元格失焦即把 textContent 回写 head/rows 并 onCommit 落盘——不再静默丢失。
  const head = headProp || ['理论', 'S 上限', '是否定域'];
  const rows = rowsProp || [['经典隐变量', '2', '是'], ['量子力学', '2√2 ≈ 2.83', '否'], ['实验观测', '≈ 2.4', '—']];
  const cols = head.length;
  const commit = (nh, nr) => { if (onCommit) onCommit(nh.slice(), nr.map(r => r.slice())); };
  const setHeadCell = (j, v) => { if (head[j] === v) return; const nh = head.slice(); nh[j] = v; commit(nh, rows); };
  const setBodyCell = (i, j, v) => { if ((rows[i] || [])[j] === v) return; const nr = rows.map(r => r.slice()); nr[i][j] = v; commit(head, nr); };
  const addRow = () => commit(head, [...rows, head.map(() => '')]);
  const delRow = (i) => { if (rows.length <= 1) return; commit(head, rows.filter((_, k) => k !== i)); };
  const addCol = () => commit([...head, '列 ' + (cols + 1)], rows.map(r => [...r, '']));
  const delCol = (j) => { if (cols <= 1) return; commit(head.filter((_, k) => k !== j), rows.map(r => r.filter((_, k) => k !== j))); };
  const cell = (txt, isHead, onWrite) => (
    <td contentEditable suppressContentEditableWarning onBlur={(e) => onWrite(e.currentTarget.textContent)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      style={{ outline: 'none', padding: '9px 13px', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
      fontSize: 13.5, color: isHead ? 'var(--text-1)' : 'var(--text-2)', fontWeight: isHead ? 500 : 400, background: isHead ? 'color-mix(in srgb, var(--star-blue) 5%, transparent)' : 'transparent' }}>{txt}</td>
  );
  const ctrlBtn = (icon, title, onClick) => (
    <button type="button" className="sr-focus-ring sr-hit40" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}>
      <Icon name={icon} size={13} color="currentColor" />
    </button>
  );
  return (
    <div style={{ margin: '2px 0' }}>
      <div style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
          <tbody>
            <tr>{head.map((h, j) => <React.Fragment key={j}>{cell(h, true, (v) => setHeadCell(j, v))}</React.Fragment>)}</tr>
            {rows.map((r, i) => <tr key={i}>{Array.from({ length: cols }).map((_, j) => <React.Fragment key={j}>{cell((r || [])[j] || '', false, (v) => setBodyCell(i, j, v))}</React.Fragment>)}</tr>)}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 6, alignItems: 'center' }}>
        {ctrlBtn('plus', '添加一行', addRow)}
        {ctrlBtn('minus', '删除末行', () => delRow(rows.length - 1))}
        {ctrlBtn('columns-3', '添加一列', addCol)}
        {ctrlBtn('trash-2', '删除末列', () => delCol(cols - 1))}
      </div>
    </div>
  );
}

/* ---- MiniTeX: a self-contained LaTeX → typeset renderer (no external lib).
   Handles ^ _ \frac \sqrt accents \text/\mathrm/\mathbf greek + a wide symbol
   table; raw unicode passes straight through so existing pretty-printed tex
   still reads correctly. The block's `tex` is always the editable source. */
const TEX_SYM = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆', circ: '∘', bullet: '∙',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', cong: '≅', sim: '∼', simeq: '≃', propto: '∝', ll: '≪', gg: '≫',
  subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇', in: '∈', notin: '∉', ni: '∋', cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅', varnothing: '∅',
  forall: '∀', exists: '∃', nexists: '∄', neg: '¬', land: '∧', wedge: '∧', lor: '∨', vee: '∨',
  rightarrow: '→', to: '→', longrightarrow: '⟶', leftarrow: '←', gets: '←', leftrightarrow: '↔', Rightarrow: '⇒', implies: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', iff: '⇔', mapsto: '↦', uparrow: '↑', downarrow: '↓',
  infty: '∞', partial: '∂', nabla: '∇', hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', wp: '℘',
  sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮',
  langle: '⟨', rangle: '⟩', lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋',
  otimes: '⊗', oplus: '⊕', odot: '⊙', ominus: '⊖', perp: '⊥', parallel: '∥', angle: '∠', triangle: '△',
  cdots: '⋯', ldots: '…', dots: '…', vdots: '⋮', ddots: '⋱', prime: '′', surd: '√',
  dagger: '†', ddagger: '‡', backslash: '\\', quad: ' ', qquad: '  ',
  '%': '%', '&': '&', '_': '_', '#': '#', '$': '$', '{': '{', '}': '}', ' ': ' ',
};
const TEX_FN = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'det', 'dim', 'ker', 'deg', 'gcd', 'arg', 'sup', 'inf', 'mod', 'Pr']);

// errs（可选数组）：解析时收集缺参 / 未闭合花括号等问题，供块级的语法提示用——
// 残缺语法不再被静默吞掉（`\frac{a` 只渲出一个斜体 a 却毫无线索）。
function renderTex(src, errs) {
  if (src == null || src === '') return null;
  let key = 0; const K = () => key++;
  const report = (m) => { if (errs && !errs.includes(m)) errs.push(m); };
  // tokenize
  const toks = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      let j = i + 1;
      if (j < src.length && /[a-zA-Z]/.test(src[j])) { let name = ''; while (j < src.length && /[a-zA-Z]/.test(src[j])) { name += src[j]; j++; } toks.push({ k: 'cmd', v: name }); i = j; }
      else { toks.push({ k: 'cmd', v: src[j] || '\\' }); i = j + 1; }
    } else if (c === '{') { toks.push({ k: '{' }); i++; }
    else if (c === '}') { toks.push({ k: '}' }); i++; }
    else if (c === '^') { toks.push({ k: '^' }); i++; }
    else if (c === '_') { toks.push({ k: '_' }); i++; }
    else if (c === '&') { i++; }
    else { toks.push({ k: 'c', v: c }); i++; }
  }
  let pos = 0;
  const peek = () => toks[pos];
  const upright = (node) => <span key={K()} style={{ fontStyle: 'normal' }}>{node}</span>;
  const frac = (a, b) => (
    <span key={K()} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 0.18em', fontSize: '0.94em' }}>
      <span style={{ padding: '0 0.32em', lineHeight: 1.15 }}>{a}</span>
      <span style={{ width: '100%', height: 1, background: 'currentColor', opacity: 0.85, margin: '1px 0' }} />
      <span style={{ padding: '0 0.32em', lineHeight: 1.15 }}>{b}</span>
    </span>
  );
  const sqrtEl = (rad, idx) => (
    <span key={K()} style={{ display: 'inline-flex', alignItems: 'flex-start', verticalAlign: 'middle' }}>
      {idx != null && <span style={{ fontSize: '0.6em', transform: 'translateY(0.15em)', marginRight: '-0.32em' }}>{idx}</span>}
      <span style={{ fontSize: '1.15em', lineHeight: 1 }}>√</span>
      <span style={{ borderTop: '1px solid currentColor', padding: '0.06em 0.22em 0' }}>{rad}</span>
    </span>
  );
  const overlineEl = (u) => <span key={K()} style={{ borderTop: '1px solid currentColor', padding: '0.06em 0.1em 0' }}>{u}</span>;
  const accentEl = (u, mark) => (
    <span key={K()} style={{ position: 'relative', display: 'inline-block', padding: '0.18em 0 0' }}>
      <span style={{ position: 'absolute', left: 0, right: 0, top: '-0.42em', textAlign: 'center', fontSize: '0.82em', lineHeight: 1 }}>{mark}</span>{u}
    </span>
  );
  function parseSeq(stopBrace) {
    const out = [];
    let closed = false;
    while (pos < toks.length) {
      const tk = peek();
      if (!tk) break;
      if (tk.k === '}') { pos++; if (stopBrace) { closed = true; break; } else continue; }
      let atom = parseAtom();
      if (atom == null) continue;
      atom = attachScripts(atom);
      out.push(<React.Fragment key={K()}>{atom}</React.Fragment>);
    }
    if (stopBrace && !closed) report('花括号未闭合');
    return out;
  }
  function parseUnit() {
    const tk = peek(); if (!tk) return null;
    if (tk.k === '{') { pos++; return <span key={K()}>{parseSeq(true)}</span>; }
    return parseAtom();
  }
  function attachScripts(base) {
    let sup = null, sub = null;
    while (peek() && (peek().k === '^' || peek().k === '_')) { const w = peek().k; pos++; const u = parseUnit(); if (w === '^') sup = u; else sub = u; }
    if (sup == null && sub == null) return base;
    return (
      <span key={K()} style={{ display: 'inline-flex', alignItems: 'center' }}>{base}
        <span style={{ display: 'inline-flex', flexDirection: 'column', fontSize: '0.68em', lineHeight: 1, marginLeft: '0.06em' }}>
          <span style={{ transform: 'translateY(-0.18em)' }}>{sup != null ? sup : '​'}</span>
          <span style={{ transform: 'translateY(0.18em)' }}>{sub != null ? sub : '​'}</span>
        </span>
      </span>
    );
  }
  function parseAtom() {
    const tk = toks[pos++]; if (!tk) return null;
    if (tk.k === '{') return <span key={K()}>{parseSeq(true)}</span>;
    if (tk.k === '^' || tk.k === '_') return tk.k;
    if (tk.k === 'c') return /[a-zA-Z]/.test(tk.v) ? <span key={K()} style={{ fontStyle: 'italic' }}>{tk.v}</span> : tk.v;
    if (tk.k === 'cmd') return renderCmd(tk.v);
    return null;
  }
  function renderCmd(name) {
    switch (name) {
      case 'frac': case 'dfrac': case 'tfrac': {
        const a = parseUnit(); const b = parseUnit();
        if (a == null || b == null) report('\\' + name + ' 缺少' + (a == null ? '分子' : '第二个参数（分母）'));
        return frac(a, b);
      }
      case 'sqrt': {
        let idx = null;
        if (peek() && peek().k === 'c' && peek().v === '[') { pos++; const inner = []; while (peek() && !(peek().k === 'c' && peek().v === ']')) { const a = parseAtom(); if (a != null) inner.push(a); } if (peek()) pos++; idx = inner; }
        const rad = parseUnit();
        if (rad == null) report('\\sqrt 缺少被开方式');
        return sqrtEl(rad, idx);
      }
      case 'vec': return accentEl(parseUnit(), '→');
      case 'hat': case 'widehat': return accentEl(parseUnit(), 'ˆ');
      case 'tilde': case 'widetilde': return accentEl(parseUnit(), '˜');
      case 'dot': return accentEl(parseUnit(), '˙');
      case 'ddot': return accentEl(parseUnit(), '¨');
      case 'bar': case 'overline': return overlineEl(parseUnit());
      case 'text': case 'mathrm': case 'operatorname': case 'mathbb': case 'mathsf': return upright(parseUnit());
      case 'mathbf': case 'boldsymbol': return <span key={K()} style={{ fontWeight: 600 }}>{parseUnit()}</span>;
      case 'mathcal': case 'mathscr': return <span key={K()} style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}>{parseUnit()}</span>;
      case 'left': case 'right': case 'big': case 'Big': case 'bigg': case 'Bigg': case 'bigl': case 'bigr': case 'Bigl': case 'Bigr': case 'biggl': case 'biggr': return parseUnit();
      case ',': case ':': case ';': case '>': return <span key={K()} style={{ display: 'inline-block', width: '0.26em' }} />;
      case '!': return null;
      case ' ': return ' ';
      case '\\': return <br key={K()} />;
      default:
        if (TEX_SYM[name] != null) return upright(TEX_SYM[name]);
        if (TEX_FN.has(name)) return upright(name);
        return upright('\\' + name);
    }
  }
  try { return <span style={{ fontStyle: 'normal' }}>{parseSeq(false)}</span>; }
  catch (e) { report('无法解析，已按原文显示'); return <span>{src}</span>; }
}

/* 低调的 LaTeX 语法提示：danger 色小标记，hover 看具体问题 */
function TexErrMark({ errs }) {
  if (!errs || !errs.length) return null;
  return (
    <span title={'LaTeX 可能有语法错误：' + errs.join('；')} aria-label={'LaTeX 可能有语法错误：' + errs.join('；')}
      style={{ display: 'inline-flex', flex: 'none', marginLeft: 8, transform: 'translateY(1px)' }}>
      <Icon name="triangle-alert" size={13} color="var(--danger)" />
    </span>
  );
}

function MathBlock({ tex, onCommit, autoEdit }) {
  const [editing, setEditing] = React.useState(!!autoEdit && !tex);
  const [v, setV] = React.useState(tex || '');
  const taRef = React.useRef(null);
  React.useEffect(() => { setV(tex || ''); }, [tex]);
  const autoH = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = Math.max(54, el.scrollHeight) + 'px'; };
  React.useEffect(() => { if (editing && taRef.current) { const el = taRef.current; el.focus(); el.selectionStart = el.selectionEnd = el.value.length; autoH(el); } }, [editing]);
  const commit = () => { setEditing(false); const nv = v.trim(); if (nv !== (tex || '') && onCommit) onCommit(nv); };
  const cancel = () => { setV(tex || ''); setEditing(false); };

  // 渲染 + 收集语法问题（缺参 / 花括号未闭合），块旁给一个低调的提示标记
  const viewErrs = [];
  const viewNode = tex ? renderTex(tex, viewErrs) : null;
  const previewErrs = [];
  const previewNode = v.trim() ? renderTex(v, previewErrs) : null;

  if (editing) {
    return (
      <div style={{ borderRadius: 'var(--r-md)', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', overflow: 'hidden', margin: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderBottom: '1px solid var(--line)', color: 'var(--text-3)' }}>
          <Icon name="sigma" size={13} color="var(--gold)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase' }}>LaTeX 源码</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>Enter 渲染 · Shift+Enter 换行 · Esc 取消</span>
        </div>
        <textarea ref={taRef} value={v} spellCheck={false}
          onChange={(e) => { setV(e.target.value); autoH(e.target); }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.preventDefault(); cancel(); } }}
          placeholder="输入 LaTeX 源码，例如  |\Phi^+\rangle = \frac{|00\rangle + |11\rangle}{\sqrt 2}"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 54, background: 'transparent', color: 'var(--text-1)', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font-mono)', fontSize: 13.5, lineHeight: 1.7, padding: '11px 14px', tabSize: 2 }} />
        <div style={{ borderTop: '1px solid var(--line)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 30, background: 'rgba(159,198,255,0.04)' }}>
          <span style={{ fontSize: 19, color: v.trim() ? 'var(--text-1)' : 'var(--text-3)', letterSpacing: '0.01em' }}>{v.trim() ? previewNode : '预览'}</span>
          <TexErrMark errs={previewErrs} />
        </div>
      </div>
    );
  }
  return (
    <div onClick={() => setEditing(true)} title={viewErrs.length ? 'LaTeX 可能有语法错误：' + viewErrs.join('；') + ' · 点击进入源码编辑' : '点击编辑 LaTeX 源码'}
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 14px', borderRadius: 'var(--r-md)', background: 'rgba(159,198,255,0.04)', border: '1px solid ' + (viewErrs.length ? 'color-mix(in srgb, var(--danger) 35%, transparent)' : 'var(--glass-border)'), cursor: 'text', margin: '2px 0' }}>
      <span style={{ fontSize: 19.5, color: tex ? 'var(--text-1)' : 'var(--text-3)', letterSpacing: '0.01em', textAlign: 'center' }}>
        {tex ? viewNode : '点击输入公式（LaTeX 源码）…'}
      </span>
      <TexErrMark errs={viewErrs} />
    </div>
  );
}

/* 图片块：src 失效（外链挂掉 / 图床死链）时给出可见的失败态占位，
   而不是一条 0 高度的隐形横线；重新上传即可替换。 */
function ImageBlock({ b, onSrc }) {
  const [err, setErr] = React.useState(false);
  React.useEffect(() => { setErr(false); }, [b.src]);
  const pick = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => onSrc(rd.result); rd.readAsDataURL(f);
  };
  if (b.src && !err) {
    return <img src={b.src} alt="笔记图片" onError={() => setErr(true)}
      style={{ maxWidth: '100%', borderRadius: 'var(--r-md)', display: 'block', border: '1px solid var(--glass-border)' }} />;
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 120, borderRadius: 'var(--r-md)', border: '1px dashed ' + (err ? 'color-mix(in srgb, var(--danger) 45%, transparent)' : 'var(--line-strong)'), color: 'var(--text-3)', cursor: 'pointer', background: err ? 'color-mix(in srgb, var(--danger) 5%, transparent)' : 'transparent' }}>
      <Icon name={err ? 'image-off' : 'image'} size={22} color={err ? 'var(--danger)' : 'currentColor'} />
      <span style={{ fontSize: 13, color: err ? 'var(--text-2)' : 'inherit' }}>{err ? '图片加载失败 · 原链接已失效' : '拖入图片，或点击上传'}</span>
      {err && <span style={{ fontSize: 11.5 }}>点击重新上传，替换这张图</span>}
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} />
    </label>
  );
}

// 标签 chip：悬停露出移除按钮
function TagChip({ label, onRemove }) {
  const [h, setH] = React.useState(false);
  return (
    <span onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Tag icon="hash">{label}</Tag>
      <button type="button" title="移除标签" className="sr-focus-ring sr-hit40" onClick={onRemove}
        onFocus={() => setH(true)} onBlur={() => setH(false)}
        style={{ width: h ? 18 : 0, height: 18, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: h ? 1 : 0, overflow: 'hidden', border: 0, background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', padding: 0, transition: 'width var(--dur-fast), opacity var(--dur-fast)' }}>
        <Icon name="x" size={12} color="currentColor" />
      </button>
    </span>
  );
}

// 基础属性行 → star.props 字段名
const PROP_KEYS = { type: 'type', status: 'status', source: 'source', alias: 'alias', review: 'nextReview' };
// 类型下拉预设；状态按记忆模型五态着色（状态由 refreshStar 每次心跳覆写，只读展示）
const PROP_TYPE_PRESETS = ['概念', '公式', '定理', '方法', '案例', '收纳', '草稿'];
const PROP_STATUS_TONE = { '牢固': 'var(--gold)', '正常': 'var(--star-blue)', '正变暗': 'var(--star-blue-dim)', '将熄灭': '#e08a6d', '待重燃': 'var(--gold-warm)' };

/* 「下次复习」的日期选择：文字仍显示派生标签（今天/明天/x 天后），点击弹原生日历。
   选定日期把星排入那天的复习队列；星自然变暗到期不会被推迟——遗忘不等人。 */
function ReviewPicker({ label, iso, onPick }) {
  const ref = React.useRef(null);
  const d = new Date();
  const todayIso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const openPicker = () => {
    const el = ref.current; if (!el) return;
    el.value = iso || todayIso;
    try { el.showPicker(); } catch (e) { el.focus(); el.click(); }
  };
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button type="button" className="sr-focus-ring" onClick={openPicker}
        title="选择日期，把这颗星排入那天的复习（星自然变暗到期不会被推迟）"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: 'inherit', fontSize: 13, color: 'var(--text-1)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px' }}>
        {label}
        <Icon name="calendar-days" size={13} color="var(--text-3)" />
      </button>
      <input ref={ref} type="date" min={todayIso} defaultValue={iso || ''} aria-label="选择下次复习日期" tabIndex={-1}
        onChange={(e) => { if (e.target.value) onPick && onPick(e.target.value); }}
        style={{ position: 'absolute', left: 0, bottom: 0, width: 1, height: 1, opacity: 0, border: 0, padding: 0, colorScheme: 'dark', pointerEvents: 'none' }} />
    </span>
  );
}

function Properties({ props, onFlash, onConfirm, onCommit, reviewISO, onPickReview }) {
  const p = props || {};
  const [open, setOpen] = React.useState(true);
  const [extra, setExtra] = React.useState([]);
  const [removed, setRemoved] = React.useState([]);
  const [hoverKey, setHoverKey] = React.useState(null);
  const [focusKey, setFocusKey] = React.useState(null); // 光标所在属性行，整行给选中态
  // 值编辑在失焦时落到 star.props，让记忆栏/列表读到的是新值
  const commitVal = (r) => (e) => {
    const val = e.currentTarget.textContent.trim();
    const key = PROP_KEYS[r.key] || r.k || r.key;
    if (p[key] === val) return;
    p[key] = val;
    onCommit && onCommit();
    onFlash && onFlash('已更新属性');
  };
  const base = [
    { key: 'type', icon: 'tag', k: '类型', v: p.type || '', kind: 'select' },
    { key: 'status', icon: 'circle-dot', k: '状态', v: p.status || '正常', kind: 'status' },
    { key: 'source', icon: 'book-open', k: '来源', v: p.source || '', kind: 'text' },
    { key: 'alias', icon: 'languages', k: '别名', v: p.alias || '', kind: 'text' },
    { key: 'review', icon: 'calendar', k: '下次复习', v: p.nextReview || '—', kind: 'review' },
  ].filter(r => !removed.includes(r.key));
  const rows = [...base, ...extra];
  const addRow = () => {
    const key = 'x' + Math.random().toString(36).slice(2, 7);
    setExtra(e => [...e, { key, icon: 'plus-circle', k: '', v: '', kind: 'edit' }]);
    // 新行先命名：渲染后把光标放进属性名
    setTimeout(() => { const el = document.getElementById('prop-k-' + key); if (el) el.focus(); }, 0);
  };
  const delRow = (r) => {
    const doDel = () => {
      delete p[PROP_KEYS[r.key] || r.k || r.key];
      if (r.key && r.key[0] === 'x') setExtra(e => e.filter(x => x.key !== r.key)); else setRemoved(s => [...s, r.key]);
      onCommit && onCommit();
      onFlash && onFlash('已删除属性');
    };
    if (onConfirm) onConfirm({ message: '删除属性「' + (r.k || '未命名') + '」？这一行将从这颗星的档案里移除。', confirmLabel: '删除', onYes: doDel });
    else doDel();
  };
  return (
    <div style={{ marginBottom: 22, border: '1px solid var(--glass-border)', borderRadius: 'var(--r-md)', background: 'rgba(159,198,255,0.03)', overflow: 'hidden' }}>
      <button type="button" className="sr-focus-ring" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ display: 'flex', width: '100%', font: 'inherit', border: 'none', background: 'transparent', textAlign: 'left', alignItems: 'center', gap: 8, padding: '9px 14px', cursor: 'pointer', color: 'var(--text-3)' }}>
        <Icon name="chevron-right" size={14} color="currentColor" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-fast)' }} />
        <span style={{ fontSize: 11, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>属性 Properties</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{rows.length}</span>
      </button>
      {open && (
        <div style={{ padding: '2px 14px 12px' }}>
          {rows.map((r) => (
            <div key={r.key} onMouseEnter={() => setHoverKey(r.key)} onMouseLeave={() => setHoverKey(null)}
              onFocus={() => setFocusKey(r.key)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusKey(f => (f === r.key ? null : f)); }}
              onContextMenu={(e) => { e.preventDefault(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', margin: '0 -8px', borderRadius: 'var(--r-sm)',
                background: focusKey === r.key ? 'rgba(159,198,255,0.07)' : (hoverKey === r.key ? 'rgba(159,198,255,0.03)' : 'transparent'),
                boxShadow: focusKey === r.key ? '0 0 0 1.5px var(--focus)' : 'none',
                transition: 'background var(--dur-fast), box-shadow var(--dur-fast)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 96, flex: 'none', color: 'var(--text-3)', fontSize: 12.5 }}>
                <Icon name={r.icon} size={13} color="currentColor" />
                {r.key[0] === 'x'
                  ? <span id={'prop-k-' + r.key} contentEditable suppressContentEditableWarning data-ph="属性名"
                      onBlur={(e) => {
                        const k = e.currentTarget.textContent.trim();
                        if (k && k !== r.k) { if (r.k && p[r.k] !== undefined) { p[k] = p[r.k]; delete p[r.k]; } onCommit && onCommit(); }
                        setExtra(es => es.map(x => x.key === r.key ? { ...x, k } : x));
                      }}
                      style={{ outline: 'none', cursor: 'text', minWidth: 42, borderRadius: 4, padding: '0 2px' }}>{r.k}</span>
                  : r.k}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {r.kind === 'status'
                  /* 状态是记忆模型的派生值（心跳会覆写），只读展示、按态着色 */
                  ? <span title="由记忆模型实时派生，随复习与时间自动变化" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-1)', cursor: 'default' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: PROP_STATUS_TONE[r.v] || 'var(--star-blue)', boxShadow: (r.v === '牢固' || r.v === '待重燃') ? 'var(--glow-gold-soft)' : 'none' }} />
                      {r.v}
                    </span>
                  : r.kind === 'select'
                    /* 类型用真下拉：预设 + 当前自定义值兜底 */
                    ? <Select size="sm" value={p.type || '草稿'} placeholder="选择类型…"
                        options={(PROP_TYPE_PRESETS.includes(p.type) || !p.type ? PROP_TYPE_PRESETS : [p.type, ...PROP_TYPE_PRESETS]).map(t => ({ value: t, label: t }))}
                        onChange={(v) => { if (p.type === v) return; p.type = v; onCommit && onCommit(); onFlash && onFlash('已更新类型'); }}
                        style={{ maxWidth: 168 }} />
                    : r.kind === 'review'
                      ? <ReviewPicker label={r.v} iso={reviewISO} onPick={onPickReview} />
                      : <span contentEditable suppressContentEditableWarning title="点击编辑" data-ph="点击填写"
                          onBlur={commitVal(r)}
                          style={{ outline: 'none', cursor: 'text', fontSize: 13, color: 'var(--text-1)', borderRadius: 4, padding: '0 2px', display: 'inline-block', minWidth: 42 }}>{r.v}</span>}
              </div>
              <button type="button" title="删除此属性" className="sr-focus-ring sr-hit40" onMouseDown={(e) => e.preventDefault()} onClick={() => delRow(r)}
                style={{ flex: 'none', width: 22, height: 22, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', opacity: (hoverKey === r.key || focusKey === r.key) ? 1 : 0, transition: 'opacity var(--dur-fast)' }}>
                <Icon name="x" size={14} color="currentColor" />
              </button>
            </div>
          ))}
          <button type="button" className="sr-focus-ring" onClick={addRow} style={{ display: 'flex', font: 'inherit', border: 'none', background: 'transparent', alignItems: 'center', gap: 7, padding: '8px 0 2px', color: 'var(--text-3)', fontSize: 12.5, cursor: 'pointer' }}>
            <Icon name="plus" size={13} color="currentColor" />添加属性
          </button>
        </div>
      )}
    </div>
  );
}

/* ── 迷你星图（右栏「在星图中定位」）──
   与真实星图同一套视觉语言的静态缩影：读取每颗星拖拽后的真实 wx/wy 等比取景，
   星域光晕 + 恒星主星 + 星-主星连线（SRConnect 有机曲线）+ 跨星域融会贯通金弧，
   知识星按记忆温度着色、按重要度定尺寸，当前星金色放大高亮（呼吸微动）。
   点击任意星（含当前星）→ onPick(star)：上层弹「探索星系」确认，不再直接换笔记。 */
const MINI_WORLD = { w: 1680, h: 1040 };
/* 记忆温度色阶（镜像设计系统 memoryColor；bundle 未导出该函数，此处内联同一份色标） */
function edMemoryColor(strength, dawn) {
  const stops = dawn ? [
    [0.0, [108, 121, 155]], [0.25, [92, 108, 150]], [0.5, [76, 96, 148]],
    [0.7, [52, 95, 190]], [0.88, [184, 128, 26]], [1.0, [168, 109, 18]],
  ] : [
    [0.0, [44, 53, 86]], [0.25, [70, 82, 122]], [0.5, [120, 150, 205]],
    [0.7, [159, 198, 255]], [0.88, [255, 224, 150]], [1.0, [255, 244, 214]],
  ];
  const s = Math.max(0, Math.min(1, strength));
  for (let i = 1; i < stops.length; i++) {
    if (s <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      const t = (s - a) / (b - a || 1);
      const c = ca.map((v, j) => Math.round(v + (cb[j] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return 'rgb(255,244,214)';
}
function MiniStarMap({ currentId, onPick }) {
  const D = window.SR_DATA;
  const dawn = useDawn();
  const W = 268, H = 166;
  const posOf = (s) => ({ px: s.wx != null ? s.wx : (s.x || 50) / 100 * MINI_WORLD.w, py: s.wy != null ? s.wy : (s.y || 50) / 100 * MINI_WORLD.h });
  const sp = D.stars.map(s => ({ ...s, ...posOf(s) }));
  // 星域几何：与 StarMap.domainGeom 同一套规则（质心 + 包裹全部成员的半径；单星主星上移让位）
  const doms = D.constellations.map(c => {
    const ms = sp.filter(s => s.con === c.id);
    if (!ms.length) return null;
    const cx = ms.reduce((a, s) => a + s.px, 0) / ms.length;
    let cy = ms.reduce((a, s) => a + s.py, 0) / ms.length;
    if (ms.length === 1) cy -= 96;
    const r = Math.max(150, ...ms.map(s => Math.hypot(s.px - cx, s.py - cy))) + 96;
    const avg = ms.reduce((a, s) => a + s.strength, 0) / ms.length;
    return { id: c.id, name: c.name, cx, cy, r, col: avg >= 0.78 ? 'var(--gold)' : c.color, hex: avg >= 0.78 ? '#ffd98a' : c.color };
  }).filter(Boolean);
  const cs = sp.find(s => s.id === currentId);
  // 放大取景：以当前星为视口中心（k 固定，星点大、好点击），可拖拽平移看邻域
  const k = 0.45;
  const home = cs ? { x: cs.px, y: cs.py } : { x: MINI_WORLD.w / 2, y: MINI_WORLD.h / 2 };
  const [center, setCenter] = React.useState(home);
  React.useEffect(() => { setCenter(cs ? { x: cs.px, y: cs.py } : home); }, [currentId]); // 换笔记回中
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const drag = React.useRef(null);          // {sx,sy,cx,cy,el,pid,captured}
  const movedRef = React.useRef(0);         // 本次手势位移，>5px 则吞掉星点 click
  const onPointerDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, cx: center.x, cy: center.y, el: e.currentTarget, pid: e.pointerId, captured: false };
    movedRef.current = 0;
    // 注意：不能在这里就 setPointerCapture——捕获会把 pointerup/click 重定向到容器，
    // 星点按钮的 click 就永远收不到了。捕获推迟到确认拖拽意图（位移 >5px）之后。
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.sx, dy = e.clientY - drag.current.sy;
    movedRef.current = Math.max(movedRef.current, Math.hypot(dx, dy));
    if (!drag.current.captured && movedRef.current > 5) {
      drag.current.captured = true;
      drag.current.el.setPointerCapture && drag.current.el.setPointerCapture(drag.current.pid);
    }
    setCenter({
      x: clamp(drag.current.cx - dx / k, -120, MINI_WORLD.w + 120),
      y: clamp(drag.current.cy - dy / k, -120, MINI_WORLD.h + 120),
    });
  };
  const onPointerUp = () => { drag.current = null; };
  const pick = (s) => { if (movedRef.current <= 5 && onPick) onPick(s); };
  const offHome = cs && Math.hypot(center.x - cs.px, center.y - cs.py) > 8;
  const X = (wx) => W / 2 + (wx - center.x) * k, Y = (wy) => H / 2 + (wy - center.y) * k;
  const conn = (x1, y1, x2, y2, bow) => window.SRConnect ? window.SRConnect(x1, y1, x2, y2, bow) : `M ${x1} ${y1} L ${x2} ${y2}`;
  const sunOf = Object.fromEntries(doms.map(d => [d.id, d]));
  // 跨星域「融会贯通」域对（与星图同源：connections 里的 cross 链）
  const crossPairs = (() => {
    const seen = new Set(), out = [];
    (D.connections || []).forEach(c => {
      if (c.kind !== 'cross') return;
      const A = D.byId[c.a], B = D.byId[c.b];
      if (!A || !B || A.con === B.con || !sunOf[A.con] || !sunOf[B.con]) return;
      const key = [A.con, B.con].sort().join('|');
      if (seen.has(key)) return; seen.add(key);
      out.push([A.con, B.con]);
    });
    return out;
  })();
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      style={{ marginTop: 10, height: H, borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(120% 100% at 40% 40%, rgba(26,35,80,0.5), transparent 60%)',
        cursor: drag.current ? 'grabbing' : 'grab', touchAction: 'none' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {/* 星域大气光晕（各自的颜色；点亮的星域转暖金） */}
        {doms.map(d => (
          <g key={d.id}>
            <circle cx={X(d.cx)} cy={Y(d.cy)} r={Math.max(14, d.r * k)} fill={d.hex} opacity={dawn ? 0.1 : 0.09} />
            <circle cx={X(d.cx)} cy={Y(d.cy)} r={Math.max(14, d.r * k)} fill="none" stroke={d.hex} strokeWidth="0.75" opacity="0.3" />
          </g>
        ))}
        {/* 星-主星连线（蓝）与跨星域融会贯通弧（金）——与星图同一语言的静态缩影 */}
        {sp.map((s, i) => {
          const sun = sunOf[s.con]; if (!sun) return null;
          return <path key={'i' + s.id} d={conn(X(sun.cx), Y(sun.cy), X(s.px), Y(s.py), 0.1 + (i % 3) * 0.03)} fill="none" stroke="var(--star-blue)" strokeWidth="0.7" opacity={s.id === currentId ? 0.5 : 0.2} />;
        })}
        {crossPairs.map(([a, b]) => {
          const A = sunOf[a], B = sunOf[b];
          return <path key={'c' + a + b} d={conn(X(A.cx), Y(A.cy), X(B.cx), Y(B.cy), 0.16)} fill="none" stroke="var(--gold)" strokeWidth="0.9" opacity="0.5" />;
        })}
        {/* 恒星主星：暖核 + 星域名 */}
        {doms.map(d => (
          <g key={'s' + d.id}>
            <circle cx={X(d.cx)} cy={Y(d.cy)} r="6" fill="#ff9d52" opacity="0.34" />
            <circle cx={X(d.cx)} cy={Y(d.cy)} r="3.2" fill="#ffd58a" />
            <text x={X(d.cx)} y={Y(d.cy) + 13} textAnchor="middle" fontSize="8.5" fontFamily="var(--font-sans)" fill="var(--sun-label, #ffe3b0)" opacity="0.85" style={{ letterSpacing: '0.05em' }}>{d.name}</text>
          </g>
        ))}
        {/* 定位准线：贯穿全幅的金色十字虚线 + 双层目标环，钉住当前星的位置 */}
        {cs && (
          <g>
            <line x1="0" y1={Y(cs.py)} x2={W} y2={Y(cs.py)} stroke="var(--gold)" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.25" />
            <line x1={X(cs.px)} y1="0" x2={X(cs.px)} y2={H} stroke="var(--gold)" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.25" />
            <circle cx={X(cs.px)} cy={Y(cs.py)} r="8.5" fill="none" stroke="var(--gold)" strokeWidth="0.9" opacity="0.6" />
            <circle cx={X(cs.px)} cy={Y(cs.py)} r="14" fill="none" stroke="var(--gold)" strokeWidth="0.6" opacity="0.28" />
          </g>
        )}
      </svg>
      {/* 知识星：放大视口下星点更大更好点。拖拽超过阈值的松手不算点击 */}
      {sp.map(s => {
        const cur = s.id === currentId;
        const size = cur ? 13 : Math.max(7, Math.min(11, 5.5 + (s.importance || 1) * 1.6 + s.strength * 2));
        const col = cur ? 'var(--gold)' : edMemoryColor(s.strength, dawn);
        const sx = X(s.px), sy = Y(s.py);
        if (sx < -24 || sx > W + 24 || sy < -24 || sy > H + 24) return null; // 视口外剔除
        // 定位与呼吸分层：外层按钮只管 translate 居中（sr-breathe 的 transform:scale
        // 若直接挂在按钮上会覆盖居中位移，星点整体偏移半个身位——准线就对不上了）
        return (
          <button type="button" key={s.id} data-tip={cur ? `当前星 ·「${s.label}」· 点击在星图中探索` : `在星图中探索「${s.label}」`}
            aria-label={'在星图中探索「' + s.label + '」'} className="sr-focus-ring sr-hit40"
            onClick={() => pick(s)}
            style={{ position: 'absolute', left: `${sx / W * 100}%`, top: `${sy / H * 100}%`, transform: 'translate(-50%,-50%)', padding: 0, border: 'none',
              width: size, height: size, background: 'transparent', cursor: 'pointer', opacity: cur ? 1 : 0.72 }}>
            <span aria-hidden="true" className={cur && !reduce ? 'sr-breathe' : ''}
              style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: col,
                boxShadow: cur ? '0 0 14px var(--gold), 0 0 5px var(--gold)' : (s.strength >= 0.7 ? `0 0 6px ${edMemoryColor(s.strength, dawn)}` : 'none') }} />
          </button>
        );
      })}
      {/* 拖离当前星后：回中按钮 */}
      {offHome && (
        <button type="button" title="回到当前星" aria-label="回到当前星" className="sr-focus-ring"
          onClick={() => setCenter({ x: cs.px, y: cs.py })}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', right: 6, bottom: 6, width: 24, height: 24, borderRadius: 7, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            background: 'rgba(12,17,38,.92)', border: '1px solid rgba(255,217,138,.45)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3.2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── AI 助手（右栏小节）──
   AI 配置面板里的三个开关（自动摘要 / 连接建议 / 标签推荐）在这里接成真实能力，
   调用层是 window.SRAI（ai.js）。未配置服务商时整节只留一行引导；
   监听 sr-ai-config，配置或开关一变就地刷新。 */
const aiStripHtml = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// 取一颗星的正文纯文本（与导出同一份数据源 star.body；代码 / 公式 / 表格也算内容）
const aiBodyText = (s) => (((s && s.body) || []).map(b => {
  if (!b) return '';
  if (b.type === 'code') return b.code || '';
  if (b.type === 'math') return b.tex || '';
  if (b.type === 'table') return [(b.head || []).join(' ')].concat((b.rows || []).map(r => (r || []).join(' '))).join('\n');
  const t = aiStripHtml(b.text || '');
  return b.type === 'toggle' ? (t + ' ' + aiStripHtml(b.child || '')) : t;
}).map(t => t.trim()).filter(Boolean).join('\n'));
// 摘要清洗：只留第一行，剥引号与「摘要：」类前缀，硬截 60 字
const aiTrimSummary = (out) => String(out || '').trim().split('\n')[0].trim()
  .replace(/^(摘要|一句话摘要)[:：]\s*/, '')
  .replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, '').trim().slice(0, 60);
// 生成一句话摘要——「生成摘要」按钮与关闭编辑器时的静默生成走同一条路径
const aiSummarize = (s) => window.SRAI.chat([{
  role: 'user',
  content: '为下面这篇笔记写一句话中文摘要，直接输出摘要本身：不超过 60 字，不带引号，也不带「摘要：」之类前缀。\n\n标题：' + (s.label || '无标题') + '\n正文：\n' + aiBodyText(s).slice(0, 2000),
}], { system: '你是克制的笔记摘要助手，只输出一句话，不解释。', maxTokens: 120, temperature: 0.3 }).then(aiTrimSummary);
// 本会话已静默尝试过自动摘要的星——同一颗星只触发一次，失败也不再打扰
const aiAutoTried = new Set();

function AIAssist({ star, tags, connected, onAddTag, onAddConnection, onSummaryDone }) {
  const D = window.SR_DATA;
  const AI = window.SRAI;
  const readAi = () => ({ ok: !!(AI && AI.isConfigured()), cfg: (AI && AI.active()) || {} });
  const [ai, setAi] = React.useState(readAi);
  React.useEffect(() => {
    const h = () => setAi(readAi());
    window.addEventListener('sr-ai-config', h);
    return () => window.removeEventListener('sr-ai-config', h);
  }, []);
  const [sum, setSum] = React.useState({ busy: false, err: null, done: null, empty: false });
  const [tagS, setTagS] = React.useState({ busy: false, err: null, list: null });
  const [lnk, setLnk] = React.useState({ busy: false, err: null, list: null });

  const genSummary = () => {
    if (sum.busy) return;
    if (!aiBodyText(star).trim()) { setSum({ busy: false, err: null, done: null, empty: true }); return; }
    setSum({ busy: true, err: null, done: null, empty: false });
    aiSummarize(star).then(line => {
      if (!line) { setSum({ busy: false, err: '没有得到可用的摘要，请重试', done: null, empty: false }); return; }
      star.summary = line;
      D.touchNote(star.id);
      setSum({ busy: false, err: null, done: line, empty: false });
      if (onSummaryDone) onSummaryDone(line);
    }).catch(e => setSum({ busy: false, err: (e && e.message) || '生成失败，请重试', done: null, empty: false }));
  };

  const genTags = () => {
    if (tagS.busy) return;
    setTagS({ busy: true, err: null, list: null });
    AI.chatJSON([{
      role: 'user',
      content: '根据标题与正文，为这篇笔记推荐 3~5 个中文短标签（每个不超过 6 个字），只返回 JSON 字符串数组，例如 ["量子力学","入门"]。\n\n标题：' + (star.label || '无标题') + '\n正文：\n' + aiBodyText(star).slice(0, 2000),
    }], { system: '你是标签推荐助手，只输出 JSON 数组，不解释。', maxTokens: 200, temperature: 0.4 })
      .then(arr => {
        const list = (Array.isArray(arr) ? arr : [])
          .map(t => String(t == null ? '' : t).trim().replace(/^#/, ''))
          .filter(t => t && t.length <= 6)
          .filter((t, i, a) => a.indexOf(t) === i)
          .slice(0, 5);
        setTagS({ busy: false, err: null, list });
      }).catch(e => setTagS({ busy: false, err: (e && e.message) || '推荐失败，请重试', list: null }));
  };

  const genLinks = () => {
    if (lnk.busy) return;
    const linked = new Set(connected.map(c => c.star.id));
    // 候选：至多 40 颗未连接的其他星（id + 星名 + 摘要截 60 字）
    const cands = D.stars.filter(s => s.id !== star.id && !linked.has(s.id)).slice(0, 40);
    if (!cands.length) { setLnk({ busy: false, err: null, list: [] }); return; }
    setLnk({ busy: true, err: null, list: null });
    const brief = cands.map(s => ({ id: s.id, label: s.label, summary: String(s.summary || '').slice(0, 60) }));
    AI.chatJSON([{
      role: 'user',
      content: '当前笔记：' + JSON.stringify({ label: star.label, summary: String(star.summary || '').slice(0, 120) })
        + '\n候选笔记列表：' + JSON.stringify(brief)
        + '\n\n从候选里挑出最值得与当前笔记建立连接的至多 3 篇，只返回 JSON 数组，元素形如 {"id":"候选的 id","rel":"一句中文关系描述，不超过 20 字"}；没有合适的就返回 []。',
    }], { system: '你是知识连接助手，只输出 JSON 数组，不解释。', maxTokens: 300, temperature: 0.4 })
      .then(arr => {
        const byId = {};
        cands.forEach(s => { byId[s.id] = s; });
        const list = (Array.isArray(arr) ? arr : [])
          .map(it => (it && byId[it.id]) ? { star: byId[it.id], rel: String(it.rel || '').trim().slice(0, 20) || '相关概念' } : null)
          .filter(Boolean)
          .filter((it, i, a) => a.findIndex(x => x.star.id === it.star.id) === i)
          .slice(0, 3);
        setLnk({ busy: false, err: null, list });
      }).catch(e => setLnk({ busy: false, err: (e && e.message) || '获取建议失败，请重试', list: null }));
  };

  // 结果区就地过滤：已加的标签 / 已连上的星不再出现在建议里
  const tagList = tagS.list ? tagS.list.filter(t => !tags.includes(t)) : null;
  const lnkList = lnk.list ? lnk.list.filter(it => !connected.some(c => c.star.id === it.star.id)) : null;

  const note = (msg, danger) => (
    <div style={{ marginTop: 6, fontSize: 11.5, color: danger ? 'var(--danger)' : 'var(--text-3)', lineHeight: 1.6 }}>{msg}</div>
  );
  // 能力入口按钮：与右栏「新建连接」同一虚线语言；生成期间转等待态
  const entryBtn = (icon, label, busy, onClick) => (
    <button type="button" className="sr-focus-ring" disabled={busy} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', font: 'inherit', textAlign: 'left', padding: '9px 12px', borderRadius: 'var(--r-md)', border: '1px dashed var(--line-strong)', background: 'transparent', color: busy ? 'var(--text-3)' : 'var(--text-2)', fontSize: 12.5, cursor: busy ? 'wait' : 'pointer' }}>
      <span aria-hidden="true" className={busy ? 'sr-ed-spin' : ''} style={{ display: 'inline-flex', animation: busy ? 'sr-ed-spin 1.2s linear infinite' : 'none' }}>
        <Icon name={busy ? 'loader' : icon} size={14} color="currentColor" />
      </span>
      {busy ? label + '…' : label}
    </button>
  );

  return (
    <section>
      <RailHead icon="sparkles" title="AI 助手" />
      {!ai.ok ? (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>在 AI 配置中接入服务商后可用。</div>
      ) : !(ai.cfg.autoSummary || ai.cfg.tagSuggest || ai.cfg.linkSuggest) ? (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>三项助手能力都关着 · 可在 AI 配置中开启。</div>
      ) : (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ai.cfg.autoSummary && (
            <div>
              {entryBtn('sparkles', sum.busy ? '正在生成摘要' : '生成摘要', sum.busy, genSummary)}
              {sum.done != null && note('已写入摘要：' + sum.done)}
              {sum.empty && note('正文还没有内容，先写点什么再来生成。')}
              {sum.err && note(sum.err, true)}
            </div>
          )}
          {ai.cfg.tagSuggest && (
            <div>
              {entryBtn('hash', tagS.busy ? '正在推荐标签' : '标签推荐', tagS.busy, genTags)}
              {tagList && (tagList.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {tagList.map(t => (
                    <button type="button" key={t} className="sr-focus-ring" title={'添加标签「' + t + '」'} onClick={() => onAddTag(t)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 10px', borderRadius: 'var(--r-pill)', border: '1px dashed rgba(159,198,255,0.45)', background: 'rgba(159,198,255,0.07)', color: 'var(--star-blue)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      <Icon name="plus" size={11} color="currentColor" />{t}
                    </button>
                  ))}
                </div>
              ) : note('没有新的标签可推荐。'))}
              {tagS.err && note(tagS.err, true)}
            </div>
          )}
          {ai.cfg.linkSuggest && (
            <div>
              {entryBtn('waypoints', lnk.busy ? '正在寻找可连接的星' : '连接建议', lnk.busy, genLinks)}
              {lnkList && (lnkList.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {lnkList.map(it => (
                    <div key={it.star.id} style={{ padding: '9px 11px', borderRadius: 'var(--r-md)', background: 'rgba(159,198,255,0.04)', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: D.conColor(it.star.con), boxShadow: `0 0 6px ${D.conColor(it.star.con)}` }} />
                        <span style={{ fontSize: 13, color: 'var(--text-1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.star.label}</span>
                        <button type="button" className="sr-focus-ring" onClick={() => onAddConnection(it.star, it.rel)}
                          style={{ marginLeft: 'auto', flex: 'none', height: 24, padding: '0 11px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'rgba(159,198,255,0.14)', color: 'var(--text-1)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>连上</button>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 4, paddingLeft: 14 }}>{it.rel}</div>
                    </div>
                  ))}
                </div>
              ) : note('没有找到值得连接的星。'))}
              {lnk.err && note(lnk.err, true)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Editor({ starId, onBack, onOpen, onExplore }) {
  const D = window.SR_DATA;
  const star = D.byId[starId] || D.stars[0];
  const refs = React.useRef({});
  const [blocks, setBlocks] = React.useState(() => (star.body || []).map(b => ({ ...b })));
  const [hover, setHover] = React.useState(null);
  const [focusBlk, setFocusBlk] = React.useState(null); // 光标所在块，给选中态视觉
  const [ctx, setCtx] = React.useState(null);     // {x,y,id}
  const [slash, setSlash] = React.useState(null); // {x,y,id}
  const [sel, setSel] = React.useState(null);     // {x,y}
  const [colorPop, setColorPop] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [fav, setFav] = React.useState(() => !!star.fav);
  const toggleFav = () => setFav(f => { const nf = !f; star.fav = nf; D.persist(); flash(nf ? '已收藏 · 可在收件箱「收藏」里找到' : '已取消收藏'); return nf; });
  const [tags, setTags] = React.useState(() => (star.tags || []).slice());
  const [addingTag, setAddingTag] = React.useState(false);
  const [tagDraft, setTagDraft] = React.useState('');
  const [connected, setConnected] = React.useState(() => D.relatedStars(star.id));
  const [linking, setLinking] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);     // {message, confirmLabel, onYes}
  const [linkDialog, setLinkDialog] = React.useState(null); // {range}
  const [more, setMore] = React.useState(null);           // page-level 「更多」 dropdown {x,y}
  const [history, setHistory] = React.useState(false);    // version-history dialog (mock)
  const [explore, setExplore] = React.useState(null);     // 迷你星图点选的星（待确认「探索星系」）{id,label,con}
  const [con, setCon] = React.useState(star.con);         // constellation, mutable via 「移动到星域」
  const [linkStar, setLinkStar] = React.useState(null);   // chosen star awaiting a relation sentence
  const [relDraft, setRelDraft] = React.useState('');
  const [hoverConn, setHoverConn] = React.useState(null);
  const [pendingAtomicDel, setPendingAtomicDel] = React.useState(null); // 块首 Backspace 选中的上方原子块，再按一次删除
  const blockTypeName = (type) => { const bt = ((window.SRKit && window.SRKit.BLOCK_TYPES) || []).find(x => x.type === type); return bt ? bt.label : '内容'; };

  const { SlashMenu, SelectionToolbar, ContextMenu, ColorMenu, ConfirmDialog, LinkDialog, EditorMoreMenu, HistoryDialog } = window.SRKit;
  const backlinks = D.backlinksOf(star.id);
  const scrollRef = React.useRef(null);
  const stripTags = (h) => (h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // 大纲与字数读取活的 DOM（输入时防抖触发一次轻量重渲染，不改块状态、不动光标）
  const [tick, bumpTick] = React.useReducer(x => x + 1, 0);
  const tickTimer = React.useRef(null);
  const scheduleTick = () => { clearTimeout(tickTimer.current); tickTimer.current = setTimeout(() => { bumpTick(); persistBody(); }, 350); };
  React.useEffect(() => () => clearTimeout(tickTimer.current), []);
  // 记忆心跳：右栏「记忆」区（强度 / 下次复习 / 点亮·待重燃状态）就地读回新值——
  // 只改数值不加动画，reduced-motion 下同样安静
  React.useEffect(() => {
    const h = () => bumpTick();
    window.addEventListener('sr-memory', h);
    return () => window.removeEventListener('sr-memory', h);
  }, []);
  const liveText = (b) => { const el = refs.current[b.id]; return el ? el.innerText : stripTags(b.text || ''); };
  const outline = blocks.filter(b => ['h1', 'h2', 'h3'].includes(b.type)).map(b => ({ ...b, live: liveText(b).trim() })).filter(b => b.live);
  // 字数口径：中文按「字」、西文按「词」分列统计（纳入 table/math/toggle-child），
  // 代码单独按行折算阅读时长（约 30 行/分钟），不再和正文一锅平摊。
  const proseText = blocks.map(b => {
    if (b.type === 'toggle') return liveText(b) + ' ' + stripTags(b.child || '');
    if (EDITABLE.includes(b.type)) return liveText(b);
    if (b.type === 'math') return b.tex || '';
    if (b.type === 'table') return (b.head || []).join(' ') + ' ' + (b.rows || []).map(r => r.join(' ')).join(' ');
    return '';
  }).join(' ') + ' ' + (star.summary || '') + ' ' + star.label;
  const codeText = blocks.filter(b => b.type === 'code').map(b => b.code || '').join('\n');
  const CJK_RE = /[㐀-鿿豈-﫿]/g;
  const cjkCount = (proseText.match(CJK_RE) || []).length + (codeText.match(CJK_RE) || []).length;
  const wordCount = (proseText.replace(CJK_RE, ' ').match(/[A-Za-z0-9][A-Za-z0-9'’_-]*/g) || []).length;
  const codeLines = codeText.trim() ? codeText.split('\n').filter(l => l.trim()).length : 0;
  const readMin = Math.max(1, Math.round(cjkCount / 350 + wordCount / 200 + codeLines / 30));
  const scrollToBlock = (id) => {
    const c = scrollRef.current, el = document.getElementById('blk-' + id);
    if (c && el) c.scrollTo({ top: el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 40, behavior: 'smooth' });
  };

  // 编辑器反馈统一走 DS toast（自带 role=status/aria-live + --z-toast + reduced-motion）。
  // 通用操作反馈一律蓝色——金色是点亮/奖励的保留色，不给「已删除/已复制」这类日常操作
  const flash = (msg) => {
    const NS = window.StellarRaftDesignSystem_2866af;
    if (NS && NS.toast) NS.toast(msg, { tone: 'blue', icon: 'check' });
    else { setToast(msg); setTimeout(() => setToast(null), 1600); }
  };
  // capture innerHTML (not innerText) so inline formatting — bold / italic /
  // highlight / links / colors — survives any structural block operation.
  const syncBlock = (b) => (refs.current[b.id] && EDITABLE.includes(b.type)) ? { ...b, text: sanHtml(refs.current[b.id].innerHTML) } : b;

  // ---- 应用级撤销/重做栈 ----
  // 栈的推进逻辑在 undocore.js（window.SRUndoCore，纯逻辑、Node 单测覆盖）。
  // 快照 = { blocks: DOM-synced 块数组, con: 所属星域 }：
  // · 结构变更（拆分/合并/移动/转换/删除/粘贴/着色）经 withSynced/flushSynced 统一压栈；
  // · 选区格式（execCommand：加粗/颜色/高亮/链接…）经 pushExec 统一压栈；
  // · 纯打字在一次输入突发的起点压一份 state 快照（此时 state.text 尚为突发前的文本）；
  // · 「移动到星域」也压栈——快照带 con，⌘Z 能把星移回原星域。
  // ⌘Z/⌘⇧Z 由全局 capture 拦截、setBlocks 回放，DOM 由 dangerouslySetInnerHTML
  // 完全驱动，不再与块数组分叉。
  const U = window.SRUndoCore;
  const cloneBlk = (b) => ({ ...b, head: b.head && b.head.slice(), rows: b.rows && b.rows.map(r => r.slice()) });
  const undoRef = React.useRef(null);
  if (!undoRef.current) undoRef.current = U ? U.create(120) : { past: [], future: [], cap: 120, typing: false };
  const snapNow = () => ({ blocks: blocksRef.current.map(syncBlock).map(cloneBlk), con: star.con });
  const snapState = () => ({ blocks: blocksRef.current.map(cloneBlk), con: star.con });
  const pushHistory = () => { if (U) U.push(undoRef.current, snapNow()); };
  // execCommand 类操作的统一压栈入口：先压快照，再把本次改动标记为「突发已入栈」，
  // 紧随而来的 input 事件不会重复压栈。
  const pushExec = () => { pushHistory(); undoRef.current.typing = true; };
  const noteTyping = () => {
    const u = undoRef.current;
    if (!U || u.typing) return;
    U.noteTyping(u, snapState());
  };
  const focusedBlockId = () => {
    const a = document.activeElement;
    const w = a && a.closest && a.closest('[id^="blk-"]');
    return w ? w.id.slice(4) : null;
  };
  const applyHistory = (snap, preferId) => {
    const blks = snap.blocks;
    if (ReactDOM.flushSync) ReactDOM.flushSync(() => setBlocks(blks.map(cloneBlk)));
    else setBlocks(blks.map(cloneBlk));
    // 关键：React 对「与上次渲染相同的 __html」不会重设 innerHTML——而行内格式
    // （颜色/加粗/高亮/链接…）只活在 DOM 里、state.text 未变，回放时必须手动把
    // DOM 刷回快照，否则「改颜色 → ⌘Z」界面纹丝不动（用户报障的根因）。
    blks.forEach(b => {
      if (!EDITABLE.includes(b.type)) return;
      const el = refs.current[b.id]; if (!el) return;
      const want = sanHtml(b.text || '');
      if (el.innerHTML !== want) el.innerHTML = want;
    });
    if (snap.con && snap.con !== star.con) { star.con = snap.con; D.syncCounts(); setCon(snap.con); }
    persistBody();
    // 回放后把焦点留在编辑区，撤销/重做链才能连续按 —— 优先原聚焦块，否则第一个可编辑块
    const target = (preferId && blks.some(b => b.id === preferId && EDITABLE.includes(b.type)))
      ? preferId : (blks.find(b => EDITABLE.includes(b.type)) || {}).id;
    if (target) focusBlock(target, 'end');
  };
  const undo = () => {
    if (!U) return;
    if (!U.canUndo(undoRef.current)) { flash('没有可撤销的操作'); return; }
    const fid = focusedBlockId();
    applyHistory(U.undo(undoRef.current, snapNow()), fid);
  };
  const redo = () => {
    if (!U || !U.canRedo(undoRef.current)) return;
    const fid = focusedBlockId();
    applyHistory(U.redo(undoRef.current, snapNow()), fid);
  };
  // 「前缀 + 空格」刚转换出的块：块首 Backspace 可退回纯文本前缀（Typora 手感）。
  // 继续输入或任何结构变更后即失效（onInput / mutateBlocks 里清掉）。
  const prefixConvRef = React.useRef(null);   // { id, prefix }
  // 结构变更映射前先把所有块的 DOM 文本同步进 state（否则相邻块正在输入、未落 state
   // 的文字会被这次 setBlocks 覆盖丢失）；withSynced 额外压一份撤销快照。
  const mutateBlocks = (fn) => { prefixConvRef.current = null; setBlocks(bs => fn(bs.map(syncBlock))); };
  const withSynced = (fn) => { pushHistory(); mutateBlocks(fn); };

  const blocksRef = React.useRef(blocks); blocksRef.current = blocks;
  const [dragBlk, setDragBlk] = React.useState(null);   // 正在拖拽排序的块 id
  const [dropIdx, setDropIdx] = React.useState(null);   // 拖拽落点（目标索引）
  const dropIdxRef = React.useRef(null); dropIdxRef.current = dropIdx;

  // 「已自动保存」的实现：正文回写到 star.body。
  // 结构变更（增删/转换/排序）时 blocks 已同步，直接落盘；
  // 纯打字停留在 DOM，由输入防抖与卸载时的 persistBody 收拢。
  const persistBody = () => { star.body = blocksRef.current.map(syncBlock); D.touchNote(star.id); };
  // 块数组任何变化（结构变更 / 待办勾选 / 折叠开合 / 表格与代码提交）都落盘：
  // 更新 star.body 并 D.touchNote → SRNet.schedule() 防抖保存 + 刷新 SaveStatus。
  // 首帧（打开笔记）不算编辑，跳过，避免把「打开」误记为「刚刚编辑」。
  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    star.body = blocks;
    if (mountedRef.current) D.touchNote(star.id); else mountedRef.current = true;
  }, [blocks]);
  React.useEffect(() => () => persistBody(), []);
  // 「自动摘要」的自动含义：开关开启、AI 已配置、这颗星还没有摘要、正文有实质内容时，
  // 关闭编辑器（卸载 / 切换星）后台静默生成一次并写入；失败静默放弃，不打扰。
  // 声明在 persistBody 的卸载 effect 之后——cleanup 按声明顺序执行，此时 star.body 已同步。
  React.useEffect(() => () => {
    try {
      const AI = window.SRAI;
      if (!AI || !AI.isConfigured() || !AI.active().autoSummary) return;
      if (String(star.summary || '').trim() || aiAutoTried.has(star.id)) return;
      if (aiBodyText(star).replace(/\s+/g, '').length < 30) return;
      aiAutoTried.add(star.id);
      aiSummarize(star).then(line => {
        // 生成期间用户可能已回来手写了摘要——只在仍为空时写入
        if (line && !String(star.summary || '').trim()) { star.summary = line; D.touchNote(star.id); }
      }).catch(() => { });
    } catch (e) { }
  }, []);
  // 关标签页 / 切到后台：强制把编辑器 DOM flush 进 star.body，再交给 api.js 的
  // beforeunload beacon —— 否则最后一次 keystroke 后 350ms 内关闭会丢尾部输入。
  React.useEffect(() => {
    const flush = () => { try { persistBody(); } catch (e) { } };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', flush, true);
    document.addEventListener('visibilitychange', onVis, true);
    return () => { window.removeEventListener('beforeunload', flush, true); document.removeEventListener('visibilitychange', onVis, true); };
  }, []);

  // 结构变更需要同步提交（flushSync），随后立即聚焦——否则连续快速输入
  // 会赶在 React 提交/聚焦之前，把字符落进旧块
  const flushMutate = (fn) => {
    if (ReactDOM.flushSync) ReactDOM.flushSync(() => mutateBlocks(fn));
    else mutateBlocks(fn);
  };
  // flushMutate + 撤销快照。快照读的是当前 DOM——拆分/清前缀这类要先动 DOM 的操作，
  // 应在动 DOM 之前自行 pushHistory 再用 flushMutate，快照才带着改动前的原文。
  const flushSynced = (fn) => { pushHistory(); flushMutate(fn); };
  const placeCaret = (id, where) => {
    const el = refs.current[id]; if (!el) return false;
    el.focus();
    try {
      const s = window.getSelection(); const r = document.createRange();
      r.selectNodeContents(el); r.collapse(where === 'start');
      s.removeAllRanges(); s.addRange(r);
    } catch (_) { }
    return true;
  };
  const focusBlock = (id, where) => {
    if (!placeCaret(id, where)) requestAnimationFrame(() => placeCaret(id, where));
  };
  // 可见字符偏移 → 文本节点定位（光标放置 / 查找高亮 / 行内 md 转换共用）
  const nodeAtOffset = (el, offset) => {
    let remaining = offset, target = null, toff = 0;
    const walk = (n) => {
      if (target) return;
      if (n.nodeType === 3) {
        const len = n.textContent.length;
        if (remaining <= len) { target = n; toff = remaining; } else remaining -= len;
      } else { for (let i = 0; i < n.childNodes.length && !target; i++) walk(n.childNodes[i]); }
    };
    walk(el);
    return target ? { node: target, off: toff } : null;
  };
  // 按可见字符偏移放置光标（合并块时定位到接缝处，取代写进块 text 的 data-caret 哨兵）
  const placeCaretAt = (id, offset) => {
    const el = refs.current[id]; if (!el) return false;
    el.focus();
    const hit = nodeAtOffset(el, offset);
    try {
      const s = window.getSelection(); const r = document.createRange();
      if (hit) { r.setStart(hit.node, hit.off); r.collapse(true); }
      else { r.selectNodeContents(el); r.collapse(false); }
      s.removeAllRanges(); s.addRange(r);
    } catch (_) { }
    return true;
  };
  const focusBlockAt = (id, offset) => { if (!placeCaretAt(id, offset)) requestAnimationFrame(() => placeCaretAt(id, offset)); };
  // 节点所属块 id（块包裹层 id 形如 blk-<id>）
  const blockIdOfNode = (node) => {
    let el = node && (node.nodeType === 1 ? node : node.parentElement);
    while (el && el !== document.body) {
      if (el.id && el.id.indexOf('blk-') === 0) return el.id.slice(4);
      el = el.parentElement;
    }
    return null;
  };
  const htmlSlice = (el, container, offset, before) => {
    const r = document.createRange(); r.selectNodeContents(el);
    if (before) r.setEnd(container, offset); else r.setStart(container, offset);
    const div = document.createElement('div'); div.appendChild(r.cloneContents()); return div.innerHTML;
  };
  // 当前光标相对某块的位置（是否折叠 / 在块首 / 在块尾）
  const caretInfo = (el) => {
    const s = window.getSelection();
    if (!s || !s.rangeCount) return null;
    const r = s.getRangeAt(0);
    if (!el.contains(r.startContainer)) return null;
    const pre = r.cloneRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
    const post = r.cloneRange(); post.selectNodeContents(el); post.setStart(r.endContainer, r.endOffset);
    return { collapsed: r.collapsed, atStart: pre.toString().length === 0, atEnd: post.toString().length === 0, range: r };
  };

  // Markdown 前缀 → 块类型（行首输入前缀后按空格触发，Typora / Notion 式）
  const MD_PREFIX = { '#': 'h1', '##': 'h2', '###': 'h3', '-': 'bulleted', '*': 'bulleted', '>': 'quote', '1.': 'numbered', '[]': 'todo', '[ ]': 'todo', '[x]': 'todo' };
  // 列表/标题等块降级回正文：清掉不再适用的列表痕迹（缩进 / 勾选 / 起始序号）
  const toPlainP = (x) => { const y = { ...x, type: 'p' }; delete y.indent; delete y.checked; delete y.start; return y; };

  const blockKeyDown = (b) => (e) => {
    if (slash || e.nativeEvent.isComposing) return;
    const el = refs.current[b.id]; if (!el) return;

    // Alt+↑/↓ 移动块
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      flushSynced(s => {
        const i = s.findIndex(x => x.id === b.id); const j = i + dir;
        if (i < 0 || j < 0 || j >= s.length) return s;
        const arr = s.slice(); const [it] = arr.splice(i, 1); arr.splice(j, 0, it);
        return arr;
      });
      focusBlock(b.id, 'end');
      return;
    }

    // 空格触发 Markdown 前缀转换（Typora / Notion 式）：光标前恰是前缀，即前缀
    // 位于块首——前缀后已有的内容原样保留，不再要求块里只有前缀本身。
    if (e.key === ' ') {
      const info0 = caretInfo(el);
      if (info0 && info0.collapsed) {
        const pre = info0.range.cloneRange();
        pre.selectNodeContents(el);
        pre.setEnd(info0.range.startContainer, info0.range.startOffset);
        const preRaw = pre.toString();
        const t = preRaw.replace(/\u00a0/g, ' ');
        let type = MD_PREFIX[t];
        const extra = {};
        // 任意起始序号的有序列表：`2.` / `3)` → numbered 并记住 start；`+` → 无序
        const om = t.match(/^(\d+)[.)]$/);
        if (!type && om) { type = 'numbered'; const n0 = parseInt(om[1], 10); if (n0 !== 1) extra.start = n0; }
        if (!type && t === '+') type = 'bulleted';
        if (type) {
          e.preventDefault();
          // 先压快照（此刻 DOM 里还是字面前缀），⌘Z 能退回成纯文本；再清掉前缀字符——
          // React 对相同 __html 不会重设 innerHTML，不清会残留
          pushHistory();
          try { const r0 = document.createRange(); r0.setStart(el, 0); r0.setEnd(info0.range.startContainer, info0.range.startOffset); r0.deleteContents(); } catch (_) { }
          flushMutate(s => s.map(x => x.id === b.id ? { ...x, type, checked: t.toLowerCase() === '[x]', ...extra } : x));
          prefixConvRef.current = { id: b.id, prefix: t };
          focusBlock(b.id, 'start');
          return;
        }

        // 行内 Markdown：光标前缀里已闭合的 **x** / *x* / `x` / ~~x~~，
        // 按空格就地转为 <b>/<i>/<code>/<s>（Typora 式）。IME 组合期在函数
        // 入口已被挡掉；行内代码里不再二次转换。
        const anchorEl = info0.range.startContainer.nodeType === 1 ? info0.range.startContainer : info0.range.startContainer.parentElement;
        if (!(anchorEl && anchorEl.closest && anchorEl.closest('code'))) {
          const hit = matchInlineMd(preRaw);
          if (hit) {
            const sp = nodeAtOffset(el, preRaw.length - hit.len);
            if (sp) {
              e.preventDefault();
              pushExec();
              const s0 = window.getSelection(); const r0 = document.createRange();
              r0.setStart(sp.node, sp.off);
              r0.setEnd(info0.range.startContainer, info0.range.startOffset);
              s0.removeAllRanges(); s0.addRange(r0);
              document.execCommand('insertHTML', false, hit.html + '&nbsp;');
              scheduleTick();
              return;
            }
          }
        }
      }
    }

    // Tab / Shift+Tab：列表块缩进（嵌套层级持久化到块模型，md 导出带缩进）
    if (e.key === 'Tab' && ['bulleted', 'numbered', 'todo'].includes(b.type)) {
      e.preventDefault();
      const d = e.shiftKey ? -1 : 1;
      withSynced(s => s.map(x => x.id === b.id ? { ...x, indent: Math.max(0, Math.min(5, (x.indent || 0) + d)) } : x));
      return;
    }

    // Enter：在光标处拆分为新块（列表/待办/引用延续同类型；空项退出为正文）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const listLike = ['bulleted', 'numbered', 'todo'].includes(b.type);
      const contLike = listLike || b.type === 'quote';   // 引用也逐行延续（Typora 手感）
      if (contLike && el.innerText.trim() === '') {
        // 空的嵌套列表项先降一级缩进，到顶层再退出为正文（Notion / Typora 同款）
        if (listLike && (b.indent || 0) > 0) {
          flushSynced(s => s.map(x => x.id === b.id ? { ...x, indent: x.indent - 1 } : x));
          focusBlock(b.id, 'start');
          return;
        }
        el.innerHTML = '';
        flushSynced(s => s.map(x => x.id === b.id ? toPlainP({ ...x, text: '' }) : x));
        focusBlock(b.id, 'start');
        return;
      }
      // 先压快照再从 DOM 摘走尾巴——快照才带着拆分前的整块原文，⌘Z 能完整还原
      pushHistory();
      let tail = '';
      const info = caretInfo(el);
      if (info) {
        const after = document.createRange();
        after.selectNodeContents(el);
        after.setStart(info.range.endContainer, info.range.endOffset);
        const tmp = document.createElement('div');
        tmp.appendChild(after.extractContents());
        tail = tmp.innerHTML;
      }
      const nb = { id: uid(), type: contLike ? b.type : 'p', text: tail, checked: false, ...(listLike && b.indent ? { indent: b.indent } : {}) };
      flushMutate(s => { const i = s.findIndex(x => x.id === b.id); return [...s.slice(0, i + 1), nb, ...s.slice(i + 1)]; });
      focusBlock(nb.id, 'start');
      return;
    }

    // Backspace 在块首：刚转换的块先退回字面前缀，嵌套列表先降一级缩进，
    // 其余块型先降级为正文，之后才删除/并入上一块
    if (e.key === 'Backspace') {
      const info = caretInfo(el);
      if (!info || !info.collapsed || !info.atStart) return;
      if (b.type !== 'p') {
        e.preventDefault();
        const pc = prefixConvRef.current;
        if (pc && pc.id === b.id) {
          // 「前缀 + 空格」刚转换出的块：退回纯文本前缀（Typora 手感），内容原样保留
          prefixConvRef.current = null;
          pushHistory();
          el.innerHTML = escHtml(pc.prefix) + el.innerHTML;
          flushMutate(s => s.map(x => x.id === b.id ? toPlainP(x) : x));
          focusBlockAt(b.id, pc.prefix.length);
          return;
        }
        if (['bulleted', 'numbered', 'todo'].includes(b.type) && (b.indent || 0) > 0) {
          flushSynced(s => s.map(x => x.id === b.id ? { ...x, indent: x.indent - 1 } : x));
        } else {
          flushSynced(s => s.map(x => x.id === b.id ? toPlainP(x) : x));
        }
        focusBlock(b.id, 'start');
        return;
      }
      const cur = blocksRef.current;
      const i = cur.findIndex(x => x.id === b.id);
      const prev = i > 0 ? cur[i - 1] : null;
      if (!prev) return;
      e.preventDefault();
      if (prev.type === 'divider') { flushSynced(s => s.filter(x => x.id !== prev.id)); focusBlock(b.id, 'start'); return; }
      if (el.innerText.trim() === '') { flushSynced(s => s.filter(x => x.id !== b.id)); focusBlock(prev.id, 'end'); return; }
      if (EDITABLE.includes(prev.type)) {
        // 接缝处光标：合并后按上一块原可见长度定位，不再往块 text 里塞哨兵 span
        const curHtml = el.innerHTML;
        const pel = refs.current[prev.id];
        const joinAt = pel ? pel.innerText.length : stripTags(prev.text || '').length;
        flushSynced(s => s.filter(x => x.id !== b.id).map(x => x.id === prev.id ? { ...x, text: sanHtml((x.text || '') + curHtml) } : x));
        focusBlockAt(prev.id, joinAt);
        return;
      }
      // 上一块是 code / table / math / image 等原子块：选中它并给出删除引导，
      // 不再静默吞掉按键（Backspace 像被吃）
      setFocusBlk(prev.id);
      setPendingAtomicDel(prev.id);
      scrollToBlock(prev.id);
      flash('已选中上方的' + blockTypeName(prev.type) + '块 · 再按 ⌫ 删除');
      return;
    }

    // Delete 在块尾：并入下一块——Backspace 的镜像语义（Notion / Typora 皆然）
    if (e.key === 'Delete') {
      const info = caretInfo(el);
      if (!info || !info.collapsed || !info.atEnd) return;
      const cur = blocksRef.current;
      const i = cur.findIndex(x => x.id === b.id);
      const next = i >= 0 && i + 1 < cur.length ? cur[i + 1] : null;
      if (!next) return;
      e.preventDefault();
      if (next.type === 'divider') { flushSynced(s => s.filter(x => x.id !== next.id)); focusBlock(b.id, 'end'); return; }
      if (EDITABLE.includes(next.type)) {
        // 空段落上按 Delete：删掉自己、光标落到下一块块首（保住下一块的块型）
        if (b.type === 'p' && el.innerText.trim() === '') {
          flushSynced(s => s.filter(x => x.id !== b.id));
          focusBlock(next.id, 'start');
          return;
        }
        const nel = refs.current[next.id];
        const nextHtml = nel ? nel.innerHTML : sanHtml(next.text || '');
        const joinAt = el.innerText.length;
        flushSynced(s => s.filter(x => x.id !== next.id).map(x => x.id === b.id ? { ...x, text: sanHtml((x.text || '') + nextHtml) } : x));
        focusBlockAt(b.id, joinAt);
        return;
      }
      // 下一块是 code / table / math / image 等原子块：与块首 Backspace 同一套引导
      setFocusBlk(next.id);
      setPendingAtomicDel(next.id);
      scrollToBlock(next.id);
      flash('已选中下方的' + blockTypeName(next.type) + '块 · 再按 ⌫ 删除');
      return;
    }

    // ↑/↓ 在块首/块尾时跨块移动光标
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const info = caretInfo(el);
      if (!info || !info.collapsed || !(e.key === 'ArrowUp' ? info.atStart : info.atEnd)) return;
      const cur = blocksRef.current;
      const i = cur.findIndex(x => x.id === b.id);
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      let k = i + dir;
      while (k >= 0 && k < cur.length && !EDITABLE.includes(cur[k].type)) k += dir;
      if (k >= 0 && k < cur.length) { e.preventDefault(); focusBlock(cur[k].id, dir < 0 ? 'end' : 'start'); }
    }
  };

  // 粘贴：统一拦截，绝不放任浏览器默认富文本粘贴（未净化的 HTML 会直接入库）。
  // 多行 / 含 Markdown 的文本解析成块；单行走白名单清洗后的行内 HTML 插入当前块。
  const blockPaste = (b) => (e) => {
    const cd = e.clipboardData; if (!cd) return;
    const text = cd.getData('text/plain') || '';
    const html = cd.getData('text/html') || '';
    const md = /(^|\n)(#{1,3} |[-*] |\d+[.)] |> |```|\$\$|(-{3,}|\*{3,})$|\|.+\|)/.test(text);
    // 多行或含 Markdown → 解析为块
    if (text.includes('\n') || md) {
      e.preventDefault();
      const nbs = parseMdBlocks(text);
      if (!nbs.length) return;
      const emptyCur = b.type === 'p' && refs.current[b.id] && refs.current[b.id].innerText.trim() === '';
      flushSynced(s => {
        const i = s.findIndex(x => x.id === b.id);
        return emptyCur ? [...s.slice(0, i), ...nbs, ...s.slice(i + 1)] : [...s.slice(0, i + 1), ...nbs, ...s.slice(i + 1)];
      });
      focusBlock(nbs[nbs.length - 1].id, 'end');
      flash('已粘贴为 ' + nbs.length + ' 个块');
      return;
    }
    // 单行：有 text/html 就白名单清洗后插入，否则纯文本转义插入——始终不走浏览器默认
    e.preventDefault();
    if (!EDITABLE.includes(b.type)) return;
    pushExec();
    const clean = html ? sanHtml(html) : escHtml(text);
    if (clean) document.execCommand('insertHTML', false, clean);
    scheduleTick();
  };

  // 拖住 ⋮⋮ 手柄排序；原地点击仍打开块菜单
  const startDrag = (e, id) => {
    if (e.button !== 0) return;
    const sy = e.clientY; let moved = false;
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientY - sy) > 4) { moved = true; setDragBlk(id); document.body.style.cursor = 'grabbing'; }
      if (!moved) return;
      const cur = blocksRef.current;
      let idx = cur.length;
      for (let i = 0; i < cur.length; i++) {
        const bel = document.getElementById('blk-' + cur[i].id);
        if (!bel) continue;
        const r = bel.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { idx = i; break; }
      }
      setDropIdx(idx);
    };
    const up = (ev) => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      if (!moved) { setCtx({ x: ev.clientX, y: ev.clientY, id }); setDragBlk(null); setDropIdx(null); return; }
      const idx = dropIdxRef.current;
      withSynced(s => {
        const from = s.findIndex(x => x.id === id);
        if (from < 0 || idx == null) return s;
        const arr = s.slice(); const [it] = arr.splice(from, 1);
        arr.splice(from < idx ? idx - 1 : idx, 0, it);
        return arr;
      });
      setDragBlk(null); setDropIdx(null);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  // candidates for a new connection: any star not me and not already linked
  const linkCandidates = D.stars.filter(s => s.id !== star.id && !connected.some(c => c.star.id === s.id));
  const resetLinking = () => { setLinking(false); setLinkStar(null); setRelDraft(''); };
  const addConnection = (s, rel) => {
    const sameCon = s.con === con;
    const relText = (rel && rel.trim()) || '相关概念';
    D.connections.push({ a: star.id, b: s.id, kind: sameCon ? 'intra' : 'cross', rel: relText });
    D.touchNote(star.id); D.touchNote(s.id);
    setConnected(cs => [...cs, { star: s, kind: sameCon ? 'intra' : 'cross', rel: relText }]);
    resetLinking(); flash('已连接到「' + s.label + '」');
  };
  const removeConnection = (item) => setConfirm({ message: '断开与「' + item.star.label + '」的连接？连接断开后两颗星不再相互指引。', confirmLabel: '断开', onYes: () => {
    const i = D.connections.findIndex(c => (c.a === star.id && c.b === item.star.id) || (c.b === star.id && c.a === item.star.id));
    if (i >= 0) D.connections.splice(i, 1);
    D.touchNote(star.id); D.touchNote(item.star.id);
    setConnected(cs => cs.filter(x => x !== item)); flash('已断开连接');
  } });

  // serialize the current (DOM-synced) document to Markdown for 导出
  // （序列化核心在 mdcore.js：frontmatter / admonition / 列表缩进 / 协议白名单）
  const blocksToMd = () => MD
    ? MD.blocksToMd(blocks.map(syncBlock), { title: star.label, props: star.props, tags, summary: star.summary })
    : '# ' + star.label + '\n\n' + blocks.map(syncBlock).map(b => stripTags(b.text || '')).filter(Boolean).join('\n\n') + '\n';
  const exportMd = () => {
    try {
      const md = blocksToMd();
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = (star.label || 'star') + '.md';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      flash('已导出 Markdown · ' + star.label + '.md');
    } catch (e) { flash('导出失败，请重试'); }
  };

  // ---- Markdown 导入：「更多」菜单选择 .md 文件，或直接把文件拖进正文 ----
  // frontmatter 回填 star.props / tags；空笔记整体替换，非空笔记追加到末尾。
  const importInputRef = React.useRef(null);
  const importMdText = (name, text) => {
    const fm = (MD && MD.parseFrontmatter) ? MD.parseFrontmatter(text) : { props: null, tags: null, body: text };
    const nbs = parseMdBlocks(fm.body);
    if (!nbs.length && !fm.props) { flash('文件是空的 · 没有可导入的内容'); return; }
    if (fm.props) { star.props = Object.assign(star.props || {}, fm.props); }
    if (fm.tags && fm.tags.length) setTags(ts => { const nt = [...ts, ...fm.tags.filter(t => !ts.includes(t))]; syncTags(nt); return nt; });
    const cur = blocksRef.current;
    const empty = !cur.length || cur.every(b => EDITABLE.includes(b.type) && !liveText(b).trim());
    flushSynced(s => empty ? nbs : [...s, ...nbs]);
    bumpTick();
    if (nbs.length) {
      scrollToBlock(nbs[nbs.length - 1].id);
      const lastEd = [...nbs].reverse().find(b => EDITABLE.includes(b.type));
      if (lastEd) focusBlock(lastEd.id, 'end');
    }
    flash('已导入「' + name + '」· ' + nbs.length + ' 个块' + (fm.props ? ' · 属性已回填' : ''));
  };
  const readMdFile = (f) => f.text()
    .then(t => importMdText(f.name.replace(/\.(md|markdown|txt)$/i, ''), t))
    .catch(() => flash('读取文件失败，请重试'));
  const onImportFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) readMdFile(f);
  };
  const onEditorDragOver = (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.items || []).some(it => it.kind === 'file')) e.preventDefault();
  };
  const onEditorDrop = (e) => {
    const fs = (e.dataTransfer && e.dataTransfer.files) ? Array.from(e.dataTransfer.files) : [];
    const f = fs.find(x => /\.(md|markdown|txt)$/i.test(x.name) || x.type === 'text/markdown');
    if (!f) return;
    e.preventDefault(); e.stopPropagation();
    readMdFile(f);
  };

  // ---- 笔记内查找 / 替换（⌘F）----
  // 高亮走 CSS Custom Highlight API：不改块 DOM、不进 innerHTML、不碰持久化。
  const [find, setFind] = React.useState(null);          // { q, rv, rep }
  const [findIdx, setFindIdx] = React.useState(0);
  const [findMatches, setFindMatches] = React.useState([]);
  const findInputRef = React.useRef(null);
  const computeFind = (q) => {
    const res = [];
    const needle = String(q || '').toLowerCase().replace(/\u00a0/g, ' ');
    if (!needle) return res;
    blocksRef.current.forEach(b => {
      if (!EDITABLE.includes(b.type)) return;
      const el = refs.current[b.id]; if (!el) return;
      const hay = el.textContent.toLowerCase().replace(/\u00a0/g, ' ');
      let at = 0;
      while ((at = hay.indexOf(needle, at)) >= 0) { res.push({ id: b.id, start: at, end: at + needle.length }); at += needle.length; }
    });
    return res;
  };
  React.useEffect(() => {
    if (!find) { setFindMatches([]); return; }
    const ms = computeFind(find.q);
    setFindMatches(ms);
    setFindIdx(i => ms.length ? Math.min(i, ms.length - 1) : 0);
  }, [find ? find.q : null, find ? 1 : 0, blocks, tick]);
  React.useEffect(() => {
    const reg = typeof CSS !== 'undefined' && CSS.highlights;
    const H = window.Highlight;
    if (!reg || !H) return;   // 不支持时退化为「跳转即选中」，无害
    if (!find) { reg.delete('sr-find'); reg.delete('sr-find-cur'); return; }
    const others = [];
    let curR = null;
    findMatches.forEach((mt, i) => {
      const el = refs.current[mt.id]; if (!el) return;
      const s = nodeAtOffset(el, mt.start), e2 = nodeAtOffset(el, mt.end);
      if (!s || !e2) return;
      try {
        const r = document.createRange();
        r.setStart(s.node, s.off); r.setEnd(e2.node, e2.off);
        if (i === findIdx) curR = r; else others.push(r);
      } catch (_) { }
    });
    reg.set('sr-find', new H(...others));
    reg.set('sr-find-cur', curR ? new H(curR) : new H());
    return () => { reg.delete('sr-find'); reg.delete('sr-find-cur'); };
  }, [find, findMatches, findIdx]);
  const gotoMatch = (i) => {
    if (!findMatches.length) return;
    const k = ((i % findMatches.length) + findMatches.length) % findMatches.length;
    setFindIdx(k);
    scrollToBlock(findMatches[k].id);
  };
  const selectMatch = (mt) => {
    const el = refs.current[mt.id]; if (!el) return false;
    const s = nodeAtOffset(el, mt.start), e2 = nodeAtOffset(el, mt.end);
    if (!s || !e2) return false;
    el.focus();
    try {
      const sel0 = window.getSelection(); const r = document.createRange();
      r.setStart(s.node, s.off); r.setEnd(e2.node, e2.off);
      sel0.removeAllRanges(); sel0.addRange(r);
    } catch (_) { return false; }
    return true;
  };
  const replaceOne = () => {
    const mt = findMatches[findIdx]; if (!mt || !find) return;
    if (!selectMatch(mt)) return;
    pushExec();
    if (find.rv) document.execCommand('insertText', false, find.rv); else document.execCommand('delete');
    persistBody(); bumpTick();
    if (findInputRef.current) findInputRef.current.focus();
  };
  const replaceAll = () => {
    if (!find || !findMatches.length) return;
    pushExec();
    const n = findMatches.length;
    // 倒序替换：前面命中处的偏移不受后面替换影响
    for (let k = n - 1; k >= 0; k--) {
      if (!selectMatch(findMatches[k])) continue;
      if (find.rv) document.execCommand('insertText', false, find.rv); else document.execCommand('delete');
    }
    persistBody(); bumpTick();
    flash('已替换 ' + n + ' 处');
    if (findInputRef.current) findInputRef.current.focus();
  };
  const findReturnRef = React.useRef(null);   // ⌘F 打开时光标所在块，关闭时兜底还焦
  const closeFind = () => {
    const mt = findMatches[findIdx];
    setFind(null);
    // 焦点还给正文：优先当前命中处，其次打开查找前的块，再次第一个可编辑块
    if (mt) { focusBlockAt(mt.id, mt.start); return; }
    const back = findReturnRef.current;
    if (back && refs.current[back]) { focusBlock(back, 'end'); return; }
    const first = blocksRef.current.find(b => EDITABLE.includes(b.type));
    if (first) focusBlock(first.id, 'end');
  };
  // ⌘F：capture 阶段接管（编辑器打开期间不再落到浏览器原生查找）；
  // 有选中文字时把它带进查找框。⌘K 语义不受影响。
  React.useEffect(() => {
    const h = (e) => {
      if (!((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 'f' || e.key === 'F'))) return;
      e.preventDefault(); e.stopPropagation();
      findReturnRef.current = blockIdOfNode(document.activeElement);
      const selTxt = String(window.getSelection() || '').trim().slice(0, 120);
      setFind(f => ({ q: selTxt || (f && f.q) || '', rv: (f && f.rv) || '', rep: !!(f && f.rep) }));
      setTimeout(() => { const el = findInputRef.current; if (el) { el.focus(); el.select(); } }, 0);
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);
  // 查找条打开时 Esc 关闭之——但让位给更上层的浮层（菜单 / 对话框先关它们自己）
  React.useEffect(() => {
    if (!find) return;
    const h = (e) => {
      if (e.key !== 'Escape') return;
      if (slash || ctx || colorPop || linkDialog || confirm || history || more || sel || explore) return;
      // 让位给正在交互的内层控件：代码语言下拉、数学/代码源码输入等先吃 Esc
      const t = e.target;
      if (t && t.closest && !t.closest('[role="search"]')
        && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.closest('[role="combobox"],[role="listbox"]'))) return;
      e.preventDefault(); e.stopPropagation();
      closeFind();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [find, findMatches, findIdx, slash, ctx, colorPop, linkDialog, confirm, history, more, sel, explore]);

  // 移动到星域：也压撤销快照（快照带 con）——⌘Z 能把星移回原星域
  const moveToCon = (cid) => {
    if (cid === star.con) { flash('这颗星已经在「' + D.conName(cid) + '」里了'); return; }
    pushHistory();
    star.con = cid; D.syncCounts(); D.touchNote(star.id); setCon(cid);
    flash('已移动到「' + D.conName(cid) + '」· ' + window.SRKeys.combo('Z') + ' 撤销');
  };

  // actions from the top-right 「更多」 dropdown (page-level, not block-level)
  const pageAction = (action, arg) => {
    if (action === 'fav') { toggleFav(); }
    else if (action === 'dup') {
      const id2 = 's' + Math.random().toString(36).slice(2, 6);
      const src = D.byId[star.id] || star;
      const copy = {
        ...src, id: id2, label: src.label + ' 副本', fav: false,
        x: Math.min(96, (src.x || 50) + 3), y: Math.min(96, (src.y || 50) + 3),
        body: (src.body || []).map(b => ({ ...b, id: id2 + '-' + Math.random().toString(36).slice(2, 5) })),
        props: { ...(src.props || {}) }, tags: (src.tags || []).slice(),
      };
      delete copy.wx; delete copy.wy;
      D.addStar(copy);
      flash('已创建副本 ·「' + copy.label + '」');
    }
    else if (action === 'copyLink') { try { navigator.clipboard && navigator.clipboard.writeText('stellar-raft://star/' + star.id); } catch (e) { } flash('已复制星链接'); }
    else if (action === 'export') exportMd();
    else if (action === 'import') { if (importInputRef.current) importInputRef.current.click(); }
    else if (action === 'move') { moveToCon(arg); }
    else if (action === 'history') { setHistory(true); }
    else if (action === 'delete') { setConfirm({ message: '「' + star.label + '」将坠入黑洞，连接与反链一并带走。黑洞里的星可以随时恢复。', confirmLabel: '移入黑洞', onYes: () => { D.trashStar(star.id); flash('已移入黑洞 · 可随时恢复'); if (onBack) setTimeout(onBack, 480); } }); }
    setMore(null);
  };

  const act = (id) => (action, arg) => {
    // 有了应用级撤销栈，删除块不再需要模态确认——直接删除并给「⌘Z 撤销」toast
    if (action === 'delete') { withSynced(s => s.filter(b => b.id !== id)); flash('已删除这个块 · ' + window.SRKeys.combo('Z') + ' 撤销'); }
    else if (action === 'duplicate') withSynced(s => { const i = s.findIndex(b => b.id === id); return [...s.slice(0, i + 1), { ...s[i], id: uid() }, ...s.slice(i + 1)]; });
    else if (action === 'turn') withSynced(s => s.map(b => b.id === id ? { ...b, type: arg, ...typeExtras(arg, b) } : b));
    else if (action === 'color') withSynced(s => s.map(b => b.id === id ? (arg.kind === 'text' ? { ...b, color: arg.id } : { ...b, bg: arg.id }) : b));
    else if (action === 'copyLink') { try { navigator.clipboard && navigator.clipboard.writeText('stellar-raft://star/' + star.id + '#' + id); } catch (e) { } flash('已复制块链接'); }
    else if (action === 'move') { moveToCon(arg); }
    else if (action === 'review') { D.queueReview(star.id, 0); D.pushTimeline('review', star.id, '加入复习队列'); bumpTick(); flash('已加入复习队列 · 下次复习改为今天'); }
    setCtx(null);
  };

  const insertAfter = (id, type = 'p') => withSynced(s => { const i = s.findIndex(b => b.id === id); const nb = { id: uid(), type, text: '', ...typeExtras(type) }; return [...s.slice(0, i + 1), nb, ...s.slice(i + 1)]; });
  // 删光所有块后不再是死局：占位空态点击/回车即插入一个可输入的正文块并聚焦。
  const seedFirstBlock = () => { const nb = { id: uid(), type: 'p', text: '' }; flushSynced(() => [nb]); focusBlock(nb.id, 'start'); };
  // 点击正文末尾的空白区：末块已是空段落则直接聚焦，否则追加一个空段落并聚焦——
  // 无论最后一块是代码/表格/引用还是别的，鼠标永远能「点出下一行」。
  const appendTailBlock = () => {
    const last = blocks[blocks.length - 1];
    if (!last) { seedFirstBlock(); return; }
    const isEmptyP = last.type === 'p' && !stripTags(last.html != null ? last.html : (last.text || '')).trim();
    if (isEmptyP) { focusBlock(last.id, 'end'); return; }
    const nb = { id: uid(), type: 'p', text: '' };
    flushSynced(s => [...s, nb]);
    focusBlock(nb.id, 'start');
  };

  const syncTags = (ts) => { star.tags = ts.slice(); D.touchNote(star.id); };
  const commitTag = () => { const t = tagDraft.trim(); if (t && !tags.includes(t)) setTags(ts => { const nt = [...ts, t]; syncTags(nt); return nt; }); setTagDraft(''); setAddingTag(false); };
  const removeTag = (t) => setTags(ts => { const nt = ts.filter(x => x !== t); syncTags(nt); return nt; });

  const onMouseUp = () => {
    if (pendingAtomicDel) setPendingAtomicDel(null);
    const s = window.getSelection();
    if (s && !s.isCollapsed && s.rangeCount && s.toString().trim()) {
      const r = s.getRangeAt(0).getBoundingClientRect();
      if (r.width > 1) { setSel({ x: r.left + r.width / 2, y: r.top - 6 }); return; }
    }
    setSel(null);
  };

  // 键盘选区（Shift+方向键）也唤出选区工具条：监听 selectionchange（防抖 150ms），
  // 选区落在编辑区内且非折叠时定位工具条，折叠时收起。
  React.useEffect(() => {
    let t = null;
    const onSelChange = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const root = scrollRef.current; if (!root) return;
        const s = window.getSelection();
        if (!s || !s.rangeCount || s.isCollapsed || !s.toString().trim()) { setSel(cur => cur ? null : cur); return; }
        const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
        if (!el || !root.contains(el) || !el.closest('[contenteditable]')) return;
        const r = s.getRangeAt(0).getBoundingClientRect();
        if (r.width > 1) setSel({ x: r.left + r.width / 2, y: r.top - 6 });
      }, 150);
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => { document.removeEventListener('selectionchange', onSelChange); clearTimeout(t); };
  }, []);

  const keepToolbar = () => {
    const s = window.getSelection();
    if (s && s.rangeCount && !s.isCollapsed) {
      const r = s.getRangeAt(0).getBoundingClientRect();
      if (r.width > 1) setSel({ x: r.left + r.width / 2, y: r.top - 6 });
    }
    persistBody();
  };
  // 选区着色 / 高亮：不再往内容里写死具体色值（execCommand foreColor 会烤进 #hex，
  // 黎明主题下文字隐形）。改为用主题 token（CSS 变量 / color-mix）包一层 span，
  // 渲染随主题重映射。cssColor 形如 var(--star-blue) 或 color-mix(...)。
  const applyInlineColor = (prop, cssColor) => {
    const s0 = window.getSelection();
    if (!s0 || !s0.rangeCount || s0.isCollapsed) return;
    const text = escHtml(s0.toString());
    const style = prop === 'background'
      ? 'background:' + cssColor + ';border-radius:4px;padding:0 2px;'
      : 'color:' + cssColor + ';';
    document.execCommand('insertHTML', false, '<span style="' + style + '">' + text + '</span>');
    keepToolbar();
  };
  // run a rich-text command on the current selection, then keep the toolbar in place.
  // 统一执行入口：所有 execCommand 格式操作（加粗/斜体/下划线/删除线/行内代码/
  // 文字颜色/高亮）先经 pushExec 压一份撤销快照——⌘Z 才撤得掉「改颜色」这类操作。
  const runFormat = (cmd, value) => {
    const s0 = window.getSelection();
    if (!s0 || !s0.rangeCount || s0.isCollapsed) return;
    pushExec();
    if (cmd === 'inlineCode') {
      const text = s0.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      document.execCommand('insertHTML', false, '<code style="' + CODE_SPAN_CSS + '">' + text + '</code>');
      keepToolbar();
      return;
    }
    if (cmd === 'foreColor') { applyInlineColor('color', value); return; }
    if (cmd === 'hiliteColor') { applyInlineColor('background', value); return; }
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, value);
    keepToolbar();
  };
  const formatLink = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    setLinkDialog({ range: sel.getRangeAt(0).cloneRange() });
  };

  // 编辑器内有选区时，⌘K 归「添加链接」（选区工具条上标注的语义）；
  // capture 阶段拦截，app.jsx 的全局命令面板监听不会抢走它。
  React.useEffect(() => {
    const h = (e) => {
      if (!((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K'))) return;
      const s = window.getSelection();
      const root = scrollRef.current;
      if (!s || !s.rangeCount || s.isCollapsed || !root) return;
      const n = s.anchorNode;
      const el = n && (n.nodeType === 1 ? n : n.parentElement);
      if (!el || !root.contains(el) || !el.closest('[contenteditable]')) return;
      e.preventDefault(); e.stopPropagation();
      setLinkDialog({ range: s.getRangeAt(0).cloneRange() });
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);

  // ⌘Z / ⌘⇧Z：接管撤销/重做（capture 阶段，先于浏览器原生 contentEditable undo），
  // 只在编辑区内生效，避免抢走其它输入框的原生撤销。
  React.useEffect(() => {
    const h = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const root = scrollRef.current; if (!root) return;
      const a = document.activeElement;
      const inEditor = a && root.contains(a);
      // 焦点落在 body（菜单动作执行完、焦点未回正文）时也接管——
      // 「右键菜单改颜色 → ⌘Z」不能因为焦点丢了就失灵
      const free = !a || a === document.body;
      // 对话框 / 浮层里的输入框保留原生撤销
      if (linkDialog || confirm || history) return;
      if (!inEditor && !free) return;
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [linkDialog, confirm, history]);

  // 被块首 Backspace 选中的原子块：再按一次 ⌫/Delete 删除，其它键 / Esc 取消选中
  React.useEffect(() => {
    if (!pendingAtomicDel) return;
    const onKey = (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault(); e.stopPropagation();
        const id = pendingAtomicDel;
        withSynced(s => s.filter(x => x.id !== id));
        setPendingAtomicDel(null);
        flash('已删除 · ' + window.SRKeys.combo('Z') + ' 撤销');
      } else if (e.key === 'Escape') { setPendingAtomicDel(null); }
      else if (e.key.length === 1 || e.key === 'Enter') { setPendingAtomicDel(null); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [pendingAtomicDel]);

  // 跨块选区的删除/替换/剪切：绝不让浏览器默认行为直接删块 DOM（React 仍持有该块
  // 与 ref，reconcile 时会 NotFoundError: removeChild）。接管为一次 React 合并，
  // 把首块选区前 + 尾块选区后的内容并进存活块，中间块整体移除。
  React.useEffect(() => {
    const root = scrollRef.current; if (!root) return;
    const doMerge = (ins, e) => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
      const r = sel.getRangeAt(0);
      if (!root.contains(r.commonAncestorContainer)) return false;
      const startId = blockIdOfNode(r.startContainer), endId = blockIdOfNode(r.endContainer);
      if (!startId || !endId || startId === endId) return false;   // 同块交给原生
      const cur = blocksRef.current;
      const si = cur.findIndex(x => x.id === startId), ei = cur.findIndex(x => x.id === endId);
      if (si < 0 || ei < 0) return false;
      e.preventDefault(); e.stopPropagation();
      const lo = Math.min(si, ei), hi = Math.max(si, ei);
      const startBlk = cur[si], endBlk = cur[ei];
      const sEl = refs.current[startId], eEl = refs.current[endId];
      const startEd = sEl && EDITABLE.includes(startBlk.type);
      const endEd = eEl && EDITABLE.includes(endBlk.type);
      const head = startEd ? htmlSlice(sEl, r.startContainer, r.startOffset, true) : '';
      const tail = endEd ? htmlSlice(eEl, r.endContainer, r.endOffset, false) : '';
      const tmp = document.createElement('div'); tmp.innerHTML = head + ins; const caretOff = tmp.textContent.length;
      let survivor, survivorId;
      if (startEd) { survivorId = startId; survivor = { ...startBlk, text: sanHtml(head + ins + tail) }; }
      else if (endEd) { survivorId = endId; survivor = { ...endBlk, text: sanHtml(ins + tail) }; }
      else { survivorId = uid(); survivor = { id: survivorId, type: 'p', text: sanHtml(ins) }; }
      pushHistory();
      const next = [...cur.slice(0, lo), survivor, ...cur.slice(hi + 1)];
      if (ReactDOM.flushSync) ReactDOM.flushSync(() => setBlocks(next.map(cloneBlk))); else setBlocks(next.map(cloneBlk));
      focusBlockAt(survivorId, caretOff);
      persistBody();
      return true;
    };
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const isChar = e.key.length === 1;
      const del = e.key === 'Backspace' || e.key === 'Delete';
      const ent = e.key === 'Enter' && !e.shiftKey;
      if (!isChar && !del && !ent) return;
      doMerge(isChar ? escHtml(e.key) : '', e);
    };
    // 跨块选区的复制/剪切：text/plain 写合法 Markdown（经 blocksToMd，标题/列表/
    // 代码等结构不再被压平成纯文本），text/html 带原富文本片段供富文本编辑器粘贴。
    const rangeToMd = (r) => {
      const startId = blockIdOfNode(r.startContainer), endId = blockIdOfNode(r.endContainer);
      if (!startId || !endId || startId === endId) return null;   // 同块选区保持浏览器默认
      const cur = blocksRef.current;
      const si = cur.findIndex(x => x.id === startId), ei = cur.findIndex(x => x.id === endId);
      if (si < 0 || ei < 0 || si >= ei) return null;
      const picked = cur.slice(si, ei + 1).map(syncBlock);
      // 首尾块只取选区覆盖的那一截
      const sEl = refs.current[startId], eEl = refs.current[endId];
      if (sEl && EDITABLE.includes(cur[si].type)) picked[0] = { ...picked[0], text: sanHtml(htmlSlice(sEl, r.startContainer, r.startOffset, false)) };
      if (eEl && EDITABLE.includes(cur[ei].type)) picked[picked.length - 1] = { ...picked[picked.length - 1], text: sanHtml(htmlSlice(eEl, r.endContainer, r.endOffset, true)) };
      return MD ? MD.blocksToMd(picked) : picked.map(x => stripTags(x.text || '')).filter(Boolean).join('\n\n');
    };
    const writeClipboard = (e) => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed || !e.clipboardData) return false;
      const r = sel.getRangeAt(0);
      if (!root.contains(r.commonAncestorContainer)) return false;
      const md = rangeToMd(r);
      if (md == null) return false;
      try {
        e.clipboardData.setData('text/plain', md);
        const div = document.createElement('div'); div.appendChild(r.cloneContents());
        e.clipboardData.setData('text/html', div.innerHTML);
      } catch (_) { return false; }
      return true;
    };
    const onCopy = (e) => { if (writeClipboard(e)) e.preventDefault(); };
    const onCut = (e) => {
      if (!writeClipboard(e)) {
        const sel = window.getSelection();
        if (sel && sel.toString() && e.clipboardData) {
          try { e.clipboardData.setData('text/plain', sel.toString()); } catch (_) { }
        }
      }
      doMerge('', e);
    };
    root.addEventListener('keydown', onKey, true);
    root.addEventListener('copy', onCopy, true);
    root.addEventListener('cut', onCut, true);
    return () => { root.removeEventListener('keydown', onKey, true); root.removeEventListener('copy', onCopy, true); root.removeEventListener('cut', onCut, true); };
  }, []);
  const applyLink = (url) => {
    const ld = linkDialog;
    // 协议白名单：javascript:/data:/vbscript: 拒绝，保留对话框让用户改
    const ok = safeUrl(url);
    if (!ok) { flash('链接协议不被允许 · 仅支持 http/https/mailto'); return; }
    setLinkDialog(null);
    if (!ld) return;
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(ld.range);
    pushExec();   // 添加链接同样可 ⌘Z 撤销
    document.execCommand('createLink', false, ok);
    persistBody();
  };

  // 空块引导文案按块类型给（只在光标所在块淡入，不再满屏灰字——Notion 口径）
  const BLOCK_PH = {
    p: '输入正文，或按 / 选择块类型…', h1: '一级标题', h2: '二级标题', h3: '三级标题',
    quote: '引用一句值得记住的话…', callout: '写一句醒目的标注…', todo: '待办事项',
    bulleted: '列表项', numbered: '列表项', toggle: '折叠标题 · 点左侧箭头收纳内容',
  };
  const editable = (b, tag, style) => {
    const Tag = tag;
    return React.createElement(Tag, {
      ref: el => (refs.current[b.id] = el), contentEditable: true, suppressContentEditableWarning: true,
      className: 'sr-blk-ph',
      'data-ph': BLOCK_PH[b.type] || BLOCK_PH.p,
      onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, id: b.id }); },
      onKeyDown: blockKeyDown(b),
      onPaste: blockPaste(b),
      // typing "/" at the caret opens the slash menu (Notion-style) — anywhere in the
      // block, as long as the char before the "/" is whitespace or line start;
      // "```" / "$$" / "---" transform in place (Typora-style)
      onInput: (e) => {
        if (e.nativeEvent && e.nativeEvent.isComposing) { scheduleTick(); return; }
        prefixConvRef.current = null;   // 继续输入后，块首 Backspace 不再退回前缀
        noteTyping();
        scheduleTick();
        const t = e.currentTarget.innerText;
        // 斜杠菜单：任意位置输入 /（行首或前一字符为空白）都触发，不再要求块里只有「/」。
        // IME 组合期在上面已挡；行内代码里不触发。
        const justSlash = e.nativeEvent && (e.nativeEvent.data === '/' || (e.nativeEvent.data == null && t.replace(/\n+$/, '') === '/'));
        const info = justSlash ? caretInfo(e.currentTarget) : null;
        if (info && info.collapsed) {
          const anchorEl = info.range.startContainer.nodeType === 1 ? info.range.startContainer : info.range.startContainer.parentElement;
          if (!(anchorEl && anchorEl.closest && anchorEl.closest('code'))) {
            const pre = info.range.cloneRange();
            pre.selectNodeContents(e.currentTarget);
            pre.setEnd(info.range.startContainer, info.range.startOffset);
            const preText = pre.toString().replace(/\u00a0/g, ' ');
            if (/(?:^|\s)\/$/.test(preText)) {
              let rect;
              try { const r = window.getSelection().getRangeAt(0).getBoundingClientRect(); if (r && (r.left || r.top)) rect = r; } catch (_) { }
              if (!rect) rect = e.currentTarget.getBoundingClientRect();
              setSlash({ x: rect.left, y: rect.bottom + 6, id: b.id, inline: true, at: preText.length });
              return;
            }
          }
        }
        if (t === '```') { withSynced(s => s.map(x => x.id === b.id ? { id: x.id, type: 'code', lang: 'python', code: '', _new: true } : x)); return; }
        if (t === '$$') { withSynced(s => s.map(x => x.id === b.id ? { id: x.id, type: 'math', tex: '', _new: true } : x)); return; }
        if (t === '---') {
          const nb = { id: uid(), type: 'p', text: '' };
          flushSynced(s => {
            const i = s.findIndex(x => x.id === b.id);
            const arr = s.map(x => x.id === b.id ? { id: x.id, type: 'divider' } : x);
            return [...arr.slice(0, i + 1), nb, ...arr.slice(i + 1)];
          });
          focusBlock(nb.id, 'start');
        }
      },
      // 用户选的文字颜色必须压过块类型的默认色，所以放在类型样式之后
      style: { outline: 'none', ...style, color: TXT[b.color] || style.color || 'var(--text-1)' },
      dangerouslySetInnerHTML: { __html: sanHtml(b.text || '') },
    });
  };

  let numCounters = [];   // 有序列表逐层计数（indent 层级各自续号）
  const renderInner = (b) => {
    if (b.type !== 'numbered') numCounters = [];
    switch (b.type) {
      case 'rich': return <div contentEditable suppressContentEditableWarning data-ph="一句话摘要：这颗星在悬停时如何介绍自己…"
        onInput={scheduleTick}
        onBlur={(e) => { const t = e.currentTarget.innerText.trim(); if (t !== (star.summary || '')) { star.summary = t; D.touchNote(star.id); } }}
        style={{ outline: 'none', fontSize: 16.5, lineHeight: 1.85, color: 'var(--text-2)' }}>{star.summary}</div>;
      // 标题上下留白：上方多、下方少（块间距 8px 统一兜底），阅读节奏对标 Notion/Typora
      case 'h1': return editable(b, 'div', { fontSize: 28, fontWeight: 300, lineHeight: 1.35, marginTop: 18, marginBottom: 2 });
      case 'h2': return editable(b, 'div', { fontSize: 21, fontWeight: 300, lineHeight: 1.45, marginTop: 14, marginBottom: 1 });
      case 'h3': return editable(b, 'div', { fontSize: 17.5, fontWeight: 500, lineHeight: 1.5, marginTop: 10, color: 'var(--text-1)' });
      case 'p': return editable(b, 'div', { fontSize: 16.5, lineHeight: 1.85, color: 'var(--text-2)', minHeight: 26 });
      case 'quote': return (
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={{ width: 3, borderRadius: 2, background: 'linear-gradient(var(--gold), var(--star-blue))', flex: 'none' }} />
          {editable(b, 'div', { fontSize: 16, lineHeight: 1.75, color: 'var(--text-2)', fontStyle: 'italic' })}
        </div>
      );
      case 'callout': return (
        <div style={{ display: 'flex', gap: 12, padding: '13px 15px', borderRadius: 'var(--r-md)',
          background: b.tone === 'blue' ? 'rgba(159,198,255,0.06)' : 'rgba(255,217,138,0.06)',
          border: '1px solid ' + (b.tone === 'blue' ? 'rgba(159,198,255,0.20)' : 'rgba(255,217,138,0.20)') }}>
          <Icon name={b.tone === 'blue' ? 'info' : 'lightbulb'} size={18} color={b.tone === 'blue' ? 'var(--star-blue)' : 'var(--gold)'} style={{ marginTop: 2 }} />
          {editable(b, 'div', { flex: 1, fontSize: 15, lineHeight: 1.7, color: 'var(--text-1)' })}
        </div>
      );
      case 'bulleted': return (
        <div style={{ display: 'flex', gap: 12, marginLeft: (b.indent || 0) * 24 }}>
          <span style={{ color: 'var(--star-blue)', marginTop: 11, width: 5, height: 5, borderRadius: (b.indent || 0) % 2 ? 1 : '50%', background: 'var(--star-blue)', flex: 'none' }} />
          {editable(b, 'div', { flex: 1, fontSize: 16.5, lineHeight: 1.7, color: 'var(--text-2)' })}
        </div>
      );
      case 'numbered': {
        const lvl = b.indent || 0;
        numCounters = numCounters.slice(0, lvl + 1);
        if (numCounters[lvl] == null) numCounters[lvl] = 0;
        if (numCounters[lvl] === 0 && b.start) numCounters[lvl] = b.start - 1;
        numCounters[lvl] += 1;
        const n = numCounters[lvl];
        return (
        <div style={{ display: 'flex', gap: 12, marginLeft: lvl * 24 }}>
          <span style={{ color: 'var(--star-blue)', fontFamily: 'var(--font-mono)', fontSize: 14, marginTop: 2, minWidth: 16 }}>{n}.</span>
          {editable(b, 'div', { flex: 1, fontSize: 16.5, lineHeight: 1.7, color: 'var(--text-2)' })}
        </div>
      ); }
      case 'todo': { const toggleTodo = () => withSynced(s => s.map(x => x.id === b.id ? { ...x, checked: !x.checked } : x)); return (
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginLeft: (b.indent || 0) * 24 }}>
          <span role="checkbox" tabIndex={0} aria-checked={!!b.checked} aria-label="待办完成" className="sr-focus-ring sr-hit40"
            onClick={toggleTodo} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleTodo(); } }}
            style={{ width: 18, height: 18, marginTop: 2, borderRadius: 5, flex: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              border: '1px solid', borderColor: b.checked ? 'var(--gold)' : 'var(--line-strong)', background: b.checked ? 'var(--gold)' : 'transparent' }}>
            {b.checked && <Icon name="check" size={12} color="var(--text-on-gold)" />}
          </span>
          {editable(b, 'div', { flex: 1, fontSize: 16, lineHeight: 1.7, color: b.checked ? 'var(--text-3)' : 'var(--text-2)', textDecoration: b.checked ? 'line-through' : 'none' })}
        </div>
      ); }
      case 'toggle': { const toggleOpen = () => mutateBlocks(s => s.map(x => x.id === b.id ? { ...x, open: !x.open } : x)); return (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span role="button" tabIndex={0} aria-expanded={!!b.open} aria-label="展开或收起" className="sr-focus-ring sr-hit40"
              onClick={toggleOpen} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOpen(); } }}
              style={{ marginTop: 4, cursor: 'pointer', display: 'inline-flex', position: 'relative', transform: b.open ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-fast)', color: 'var(--text-3)' }}>
              <Icon name="chevron-right" size={16} color="currentColor" />
            </span>
            {editable(b, 'div', { flex: 1, fontSize: 16.5, lineHeight: 1.7, color: 'var(--text-1)' })}
          </div>
          {b.open && <div contentEditable suppressContentEditableWarning data-ph="折叠内容…"
            onBlur={(e) => { const h = sanHtml(e.currentTarget.innerHTML); if (h !== (b.child || '')) mutateBlocks(s => s.map(x => x.id === b.id ? { ...x, child: h } : x)); }}
            dangerouslySetInnerHTML={{ __html: sanHtml(b.child || '') }}
            style={{ outline: 'none', marginLeft: 24, marginTop: 6, fontSize: 15, lineHeight: 1.7, color: 'var(--text-2)' }} />}
        </div>
      ); }
      case 'math': return <MathBlock tex={b.tex} autoEdit={b._new} onCommit={(t) => mutateBlocks(s => s.map(x => x.id === b.id ? { ...x, tex: t, _new: false } : x))} />;
      case 'code': return <CodeBlock code={b.code} lang={b.lang} autoEdit={b._new}
        onCommitCode={(c) => mutateBlocks(s => s.map(x => x.id === b.id ? { ...x, code: c, _new: false } : x))}
        onCommitLang={(lg) => mutateBlocks(s => s.map(x => x.id === b.id ? { ...x, lang: lg } : x))}
        onCopyFail={() => flash('复制失败 · 请手动选择代码复制')} />;
      case 'table': return <DataTable head={b.head} rows={b.rows} onCommit={(head, rows) => mutateBlocks(s => s.map(x => x.id === b.id ? { ...x, head, rows } : x))} />;
      case 'image': return <ImageBlock b={b} onSrc={(src) => mutateBlocks(s => s.map(x => x.id === b.id ? { ...x, src } : x))} />;
      case 'divider': return <div style={{ height: 1, background: 'var(--line-strong)', margin: '6px 0' }} />;
      default: return null;
    }
  };

  return (
    <div onContextMenu={(e) => e.preventDefault()} style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
      <style>{`
        /* 1024–1180px：正文优先——右侧知识栏让位，状态栏铺满 */
        @media (max-width: 1180px) {
          .sr-ed-rail { display: none; }
          .sr-ed-status { right: 0 !important; }
        }
        /* 小宽度下按优先级收敛状态栏低价值项，别把「UTF-8」硬截成「UTF-」 */
        @media (max-width: 1280px) {
          .sr-ed-status-opt { display: none !important; }
        }
        /* 查找条：右栏让位时跟着贴边 */
        @media (max-width: 1180px) {
          .sr-ed-find { right: 24px !important; }
        }
        /* 笔记内查找高亮（CSS Custom Highlight，不进块 DOM / 不进持久化） */
        ::highlight(sr-find) { background: color-mix(in srgb, var(--star-blue) 25%, transparent); }
        ::highlight(sr-find-cur) { background: color-mix(in srgb, var(--star-blue) 55%, transparent); }
        /* 正文空块的引导文案：只在光标所在块淡入（其余空块保持安静的黑） */
        .sr-blk-ph:empty:before { opacity: 0; transition: opacity 160ms var(--ease-flight); }
        .sr-blk-ph:empty:focus:before { opacity: 1; }
        @media (prefers-reduced-motion: reduce) { .sr-blk-ph:empty:before { transition: none; } }
        /* 保存中指示的旋转——只表状态，reduced-motion / 设置关动效时静止 */
        @keyframes sr-ed-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .sr-ed-spin { animation: none !important; } }
      `}</style>
      <sr-starfield density="0.4"></sr-starfield>

      {/* MIDDLE — editor */}
      <div ref={scrollRef} onMouseUp={onMouseUp} onDragOver={onEditorDragOver} onDrop={onEditorDrop} style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 52px 24px' }}>
          {/* top bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <Button variant="ghost" size="sm" icon="corner-up-left" onClick={onBack}>星图</Button>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap', flex: 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(con), boxShadow: `0 0 7px ${D.conColor(con)}` }} />{D.conName(con)}
            </span>
            <div style={{ flex: 1 }} />
            <IconButton name="star" active={fav} title={fav ? '已收藏 · 点击取消' : '收藏这颗星'} onClick={toggleFav} />
            <IconButton name="more-horizontal" title="更多" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMore({ x: r.right, y: r.bottom + 6 }); }} />
          </div>

          {/* meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {tags.map(t => <TagChip key={t} label={t} onRemove={() => removeTag(t)} />)}
            {addingTag ? (
              <input autoFocus value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
                onBlur={commitTag} onKeyDown={(e) => { if (e.key === 'Enter') commitTag(); if (e.key === 'Escape') { setTagDraft(''); setAddingTag(false); } }}
                placeholder="标签名…"
                style={{ height: 26, width: 96, boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-pill)', color: 'var(--text-1)', fontSize: 12.5, padding: '0 10px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
            ) : (
              <span onClick={() => { setTagDraft(''); setAddingTag(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 'var(--r-pill)', border: '1px dashed var(--line-strong)', color: 'var(--text-3)', fontSize: 12.5, cursor: 'pointer' }}><Icon name="plus" size={13} color="currentColor" />标签</span>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>编辑于 {(() => { const n = D.notes.find(x => x.id === star.id) || {}; return n.editedTs ? D.ago(n.editedTs) : (n.edited || '刚刚'); })()}</span>
          </div>

          {/* title：快速新建的默认名（新的知识星）聚焦即全选——打字直接替换，不用先删 */}
          <div contentEditable suppressContentEditableWarning data-ph="无标题"
            onFocus={(e) => {
              if (e.currentTarget.textContent.trim() !== '新的知识星') return;
              const range = document.createRange(); range.selectNodeContents(e.currentTarget);
              const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
            }}
            onBlur={(e) => {
              const t = e.currentTarget.textContent.trim();
              if (t && t !== star.label) { D.renameStar(star.id, t); bumpTick(); flash('已重命名'); }
              else if (!t) e.currentTarget.textContent = star.label;
            }}
            style={{ outline: 'none', fontSize: 32, fontWeight: 200, color: 'var(--text-1)', letterSpacing: '-0.01em', textShadow: 'var(--text-glow-cool)', marginBottom: 20, lineHeight: 1.2 }}>{star.label}</div>

          {/* properties (frontmatter) */}
          <Properties props={star.props = star.props || {}} onFlash={flash} onConfirm={setConfirm} onCommit={() => { D.touchNote(star.id); bumpTick(); }}
            reviewISO={(() => {
              const d = new Date(Math.max(D.dueTsOf(star), Date.now()));
              return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            })()}
            onPickReview={(iso) => {
              const ts = Date.parse(iso + 'T20:00:00');   // 排到那天傍晚：白天还来得及复习
              if (!Number.isFinite(ts)) return;
              if (!(star.sr && star.sr.S > 0)) D.refreshMemory();
              star.sr.due = ts;
              D.refreshMemory();
              D.pushTimeline('review', star.id, '排期复习 · ' + iso.slice(5).replace('-', '/'));
              D.touchNote(star.id);
              bumpTick();
              flash('下次复习已排到 ' + iso.replace(/-/g, '/') + ' · 若星更早变暗会提前');
            }} />

          {/* blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, userSelect: dragBlk ? 'none' : 'auto' }} onMouseLeave={() => setHover(null)}>
            {blocks.length === 0 && (
              <div role="button" tabIndex={0} className="sr-focus-ring" onClick={seedFirstBlock}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === '/') { e.preventDefault(); seedFirstBlock(); } }}
                style={{ padding: '14px 8px', margin: '0 -8px', borderRadius: 'var(--r-sm)', color: 'var(--text-3)', cursor: 'text', fontSize: 16.5, lineHeight: 1.85 }}>
                写下第一行，或按 / 选择块类型…
              </div>
            )}
            {blocks.map((b, bi) => (
              <div key={b.id} id={'blk-' + b.id} onMouseEnter={() => setHover(b.id)}
                onFocus={() => setFocusBlk(b.id)}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusBlk(f => (f === b.id ? null : f)); }}
                onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, id: b.id }); }}
                style={{ position: 'relative', borderRadius: 'var(--r-sm)', padding: b.bg && b.bg !== 'none' ? '8px 12px' : '2px 8px',
                  margin: b.bg && b.bg !== 'none' ? 0 : '0 -8px',
                  background: focusBlk === b.id ? (b.bg && b.bg !== 'none' ? BG[b.bg] : 'rgba(159,198,255,0.07)')
                    : hover === b.id ? (b.bg && b.bg !== 'none' ? BG[b.bg] : 'rgba(159,198,255,0.025)') : (b.bg ? BG[b.bg] : 'transparent'),
                  opacity: dragBlk === b.id ? 0.4 : 1,
                  // 选中态：整块包围的高亮环，一眼看清光标在哪个块里
                  boxShadow: dragBlk && dragBlk !== b.id && dropIdx === bi ? 'inset 0 2px 0 var(--gold)'
                    : pendingAtomicDel === b.id ? '0 0 0 1.5px var(--danger)'
                    : focusBlk === b.id ? '0 0 0 1.5px var(--focus), 0 0 14px color-mix(in srgb, var(--focus) 24%, transparent)' : 'none',
                  transition: 'background var(--dur-fast), opacity var(--dur-fast), box-shadow var(--dur-fast)' }}>
                {/* ⊕/⋮⋮ 块手柄：hover/聚焦时淡入 + 轻微滑入（150–220ms 口径，--ease-flight）；
                    隐藏时关掉指针事件，看不见的手柄不再吃到误点击 */}
                <div style={{ position: 'absolute', left: -52, top: 1, display: 'flex', gap: 1,
                  opacity: (hover === b.id || focusBlk === b.id) ? 1 : 0,
                  transform: (hover === b.id || focusBlk === b.id) ? 'none' : 'translateX(-5px)',
                  pointerEvents: (hover === b.id || focusBlk === b.id) ? 'auto' : 'none',
                  transition: 'opacity 180ms var(--ease-flight), transform 180ms var(--ease-flight)' }}>
                  <Handle icon="plus" title="在下方插入块" onClick={() => insertAfter(b.id)} />
                  <Handle icon="grip-vertical" title="拖动排序 · 点击打开菜单 · Alt+↑↓ 移动" onMouseDown={(e) => startDrag(e, b.id)} />
                </div>
                {renderInner(b)}
              </div>
            ))}
            {dragBlk && dropIdx === blocks.length && <div style={{ height: 2, background: 'var(--gold)', borderRadius: 1, boxShadow: 'var(--glow-gold-soft)' }} />}
          </div>

          {/* 尾部点击区：点正文下方的空白 = 新增/聚焦一行（文本光标提示这里可写） */}
          {blocks.length > 0 && (
            <div aria-hidden="true" onClick={appendTailBlock}
              style={{ height: 96, margin: '0 -8px', cursor: 'text' }} />
          )}
        </div>
      </div>

      {/* RIGHT — knowledge rail */}
      <aside data-tour="editor-rail" className="sr-ed-rail" style={{ width: 312, flex: 'none', borderLeft: '1px solid var(--glass-border)', background: 'var(--glass-bg)', WebkitBackdropFilter: 'blur(var(--glass-blur))', backdropFilter: 'blur(var(--glass-blur))', overflow: 'auto', position: 'relative', zIndex: 2 }}>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <section>
            <RailHead icon="list-tree" title="大纲" />
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button type="button" className="sr-focus-ring" onClick={() => scrollRef.current && scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })}
                style={{ display: 'block', width: '100%', textAlign: 'left', font: 'inherit', background: 'transparent', padding: '5px 10px', borderRadius: 'var(--r-sm)', border: 'none', borderLeft: '2px solid var(--gold)', cursor: 'pointer', fontSize: 13, color: 'var(--text-1)' }}>{star.label}</button>
              {outline.map(o => (
                <button type="button" key={o.id} className="sr-focus-ring" onClick={() => scrollToBlock(o.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', font: 'inherit', background: 'transparent', border: 'none', padding: '5px 10px', paddingLeft: o.type === 'h3' ? 30 : 18, borderRadius: 'var(--r-sm)', borderLeft: '2px solid var(--line)', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-2)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,198,255,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{o.live}</button>
              ))}
            </div>
          </section>
          <section>
            <RailHead icon="waypoints" title="连接的星" extra={connected.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {connected.map((l, i) => (
                <div key={l.star.id + i} onMouseEnter={() => setHoverConn(i)} onMouseLeave={() => setHoverConn(null)}
                  style={{ position: 'relative', padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'rgba(159,198,255,0.04)', border: '1px solid ' + (l.kind === 'cross' ? 'rgba(255,217,138,0.22)' : 'var(--glass-border)') }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Icon name="link" size={13} color={l.kind === 'cross' ? 'var(--gold)' : 'var(--star-blue)'} /><span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{l.star.label}</span>
                    {l.kind === 'cross' && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--gold)' }}>融会贯通</span>}
                    <button type="button" title="断开连接" className="sr-focus-ring sr-hit40" onClick={() => removeConnection(l)}
                      onFocus={() => setHoverConn(i)} onBlur={() => setHoverConn(null)}
                      style={{ marginLeft: l.kind === 'cross' ? 6 : 'auto', flex: 'none', width: 20, height: 20, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', opacity: hoverConn === i ? 1 : 0, transition: 'opacity var(--dur-fast)' }}>
                      <Icon name="unlink" size={13} color="currentColor" />
                    </button>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, paddingLeft: 21 }}>{l.rel}</div>
                </div>
              ))}
              {linking ? (
                <div style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border-strong)', background: 'var(--input-bg, rgba(3,4,12,0.45))', overflow: 'hidden' }}>
                  {linkStar ? (
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, fontSize: 12.5, color: 'var(--text-2)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(linkStar.con), boxShadow: `0 0 6px ${D.conColor(linkStar.con)}` }} />
                        <span style={{ color: 'var(--text-1)' }}>{linkStar.label}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: linkStar.con === con ? 'var(--star-blue)' : 'var(--gold)' }}>{linkStar.con === con ? '同一星域' : '融会贯通'}</span>
                      </div>
                      <input autoFocus value={relDraft} onChange={(e) => setRelDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addConnection(linkStar, relDraft); } if (e.key === 'Escape') resetLinking(); }}
                        placeholder="写一句关系，例如「是其特例」…"
                        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: 12.5, padding: '7px 10px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                        <button type="button" onClick={resetLinking} style={{ height: 28, padding: '0 13px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>取消</button>
                        <button type="button" onClick={() => addConnection(linkStar, relDraft)} style={{ height: 28, padding: '0 13px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'rgba(159,198,255,0.14)', color: 'var(--text-1)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>建立连接</button>
                      </div>
                    </div>
                  ) : (
                    <React.Fragment>
                      <div style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', padding: '8px 12px 4px', fontFamily: 'var(--font-mono)' }}>选择要连接的星</div>
                      <div style={{ maxHeight: 180, overflow: 'auto' }} onContextMenu={(e) => e.preventDefault()}>
                        {linkCandidates.length === 0 && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-3)' }}>没有可连接的星了。</div>}
                        {linkCandidates.map(s => (
                          <button type="button" key={s.id} className="sr-focus-ring" onClick={() => { setLinkStar(s); setRelDraft(''); }} style={{ display: 'flex', width: '100%', textAlign: 'left', font: 'inherit', border: 'none', background: 'transparent', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onFocus={e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)'} onBlur={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(s.con), boxShadow: `0 0 6px ${D.conColor(s.con)}` }} />
                            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{s.label}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-3)' }}>{D.conName(s.con)}</span>
                          </button>
                        ))}
                      </div>
                      <button type="button" className="sr-focus-ring" onClick={resetLinking} style={{ display: 'block', width: '100%', textAlign: 'left', font: 'inherit', background: 'transparent', padding: '7px 12px', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', border: 'none', borderTop: '1px solid var(--line)' }}>取消</button>
                    </React.Fragment>
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => { setLinking(true); setLinkStar(null); }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 'var(--r-md)', border: '1px dashed var(--line-strong)', background: 'transparent', color: 'var(--text-3)', fontSize: 12.5, cursor: 'pointer' }}>
                  <Icon name="plus" size={14} color="currentColor" />新建连接 · 写一句关系
                </button>
              )}
            </div>
          </section>
          {/* AI 助手：能力入口按 AI 配置的三个开关渲染；加标签 / 建连接复用上面既有的数据路径 */}
          <AIAssist star={star} tags={tags} connected={connected}
            onAddTag={(t) => { if (!t || tags.includes(t)) return; setTags(ts => { if (ts.includes(t)) return ts; const nt = [...ts, t]; syncTags(nt); return nt; }); flash('已添加标签「' + t + '」'); }}
            onAddConnection={(s, rel) => { addConnection(s, rel); D.persist(); }}
            onSummaryDone={() => { bumpTick(); flash('已生成摘要'); }} />
          <section>
            <RailHead icon="corner-down-left" title="反向链接" extra={backlinks.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {backlinks.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>暂无其它星指向这里。</div>}
              {backlinks.map((b, i) => (
                <div key={b.star.id + i} style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'rgba(159,198,255,0.04)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(b.star.con), boxShadow: `0 0 7px ${D.conColor(b.star.con)}`, flex: 'none' }} />
                    <span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{b.star.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>{D.conName(b.star.con)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.6, paddingLeft: 15 }}>
                    …{b.rel}，引用了 <span style={{ color: 'var(--star-blue)', background: 'rgba(159,198,255,0.10)', padding: '0 4px', borderRadius: 3 }}>[[{star.label}]]</span>。
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <RailHead icon="zap" title="记忆" />
            {(() => {
              // 认证态与点亮门槛都从数据层派生（tick / sr-memory 触发重读），不在编辑器另存状态
              const litSt = !!(D.isLit && D.isLit(star));
              const emberSt = !!(D.isEmber && D.isEmber(star));
              const substantial = D.hasSubstance ? D.hasSubstance(star) : true;
              const sumLen = String(star.summary || '').replace(/\s+/g, '').length;
              const textyN = (star.body || []).filter(b => b && !['rich', 'divider', 'code'].includes(b.type) && String(b.text || b.tex || '').trim()).length;
              return (
                <div style={{ marginTop: 10, padding: 14, borderRadius: 'var(--r-md)', background: 'rgba(255,217,138,0.05)', border: '1px solid rgba(255,217,138,0.18)' }}>
                  <MemoryBar value={star.strength} showPct />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 12, color: 'var(--text-2)' }}>
                    <Icon name="calendar-clock" size={14} color="var(--gold)" />遗忘曲线预计 <b style={{ color: 'var(--gold)', fontWeight: 500 }}>{(star.props && star.props.nextReview) || '6 天后'}</b> 复习
                  </div>
                  <div style={{ height: 1, background: 'var(--line)', margin: '12px 0' }} />
                  {/* 点亮状态（认证轴，与亮度四档正交）：已点亮 = 发丝金环 · 待重燃 = 暗金余烬环 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: litSt ? 'var(--gold)' : emberSt ? 'var(--gold-warm)' : 'var(--text-2)' }}>
                    <span aria-hidden="true" style={{ flex: 'none', width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box',
                      border: litSt ? '1px solid var(--gold)'
                        : emberSt ? '1px solid color-mix(in srgb, var(--gold-warm) 55%, transparent)'
                        : '1px solid var(--line-strong)' }} />
                    {litSt ? `已点亮 · ${D.ago(star.sr && star.sr.lit)}` : emberSt ? '待重燃' : '未点亮'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 6 }}>
                    {litSt ? '已点亮 · 讲清楚的东西，暗得更慢。'
                      : emberSt ? '曾点亮的星暗了下来。再讲透一次，就能重燃。'
                      : '讲清楚一次，这颗星才会真正点亮——点亮的星记得更久。'}
                  </div>
                  {/* 门槛进度：内容门槛（摘要 ≥ 20 字 或 有内容块 ≥ 2）随输入就地更新 */}
                  {!litSt && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: substantial ? 'var(--text-2)' : 'var(--text-3)', lineHeight: 1.6, marginTop: 8 }}>
                      <Icon name={substantial ? 'check' : 'pen-line'} size={12} color={substantial ? 'var(--gold)' : 'currentColor'} />
                      <span>
                        {substantial
                          ? (emberSt ? '内容已足够 · 讲给 AI 学生，就能重燃' : '内容已足够 · 讲给 AI 学生，就能点亮')
                          : `点亮门槛：摘要 ${Math.min(sumLen, 20)}/20 字，或有内容的块 ${Math.min(textyN, 2)}/2`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
          <section>
            <RailHead icon="crosshair" title="在星图中定位" />
            <MiniStarMap currentId={star.id} onPick={(s) => setExplore({ id: s.id, label: s.label, con: s.con })} />
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>点击任意星，跃迁到星图中探索它的星系。</div>
          </section>
        </div>
      </aside>

      {/* status bar */}
      <div className="sr-ed-status" style={{ position: 'absolute', bottom: 0, left: 0, right: 312, zIndex: 3, display: 'flex', alignItems: 'center', gap: 18, padding: '7px 24px', borderTop: '1px solid var(--line)', background: 'var(--glass-bg-strong)', WebkitBackdropFilter: 'blur(var(--glass-blur))', backdropFilter: 'blur(var(--glass-blur))', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="layout-list" size={13} color="currentColor" />{blocks.length} 块</span>
        <span title="中文按字、西文按词分别统计（含表格 / 公式 / 折叠内容）">{cjkCount} 字{wordCount > 0 ? ' · ' + wordCount + ' 词' : ''}</span>
        <span title={'正文与代码分别折算' + (codeLines ? '（含 ' + codeLines + ' 行代码）' : '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="clock" size={13} color="currentColor" />约 {readMin} 分钟阅读</span>
        <div style={{ flex: 1 }} />
        <SaveStatus />
        <span className="sr-ed-status-opt" title={window.SRKeys.combo('F') + ' 在这篇笔记内查找 / 替换'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="search" size={12} color="currentColor" />{window.SRKeys.combo('F')} 查找</span>
        <span title={window.SRKeys.combo('K') + ' 打开命令面板；在编辑器内选中文字时 ' + window.SRKeys.combo('K') + ' 为「添加链接」'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="command" size={13} color="currentColor" />{window.SRKeys.combo('K')} 命令 · 选中文字时为链接</span>
        <span className="sr-ed-status-opt">Markdown</span>
      </div>

      {/* overlays */}
      {ctx && <ContextMenu x={ctx.x} y={ctx.y} constellations={D.constellations} onClose={() => setCtx(null)} onAction={act(ctx.id)} />}
      {slash && <SlashMenu x={slash.x} y={slash.y}
        onClose={() => {
          const sid = slash.id, at = slash.at; setSlash(null);
          const a = document.activeElement;
          // 不选直接关：保留输入的「/」，光标回到它后面继续打字
          if (sid && refs.current[sid] && (!a || a === document.body)) {
            if (at != null) focusBlockAt(sid, at); else focusBlock(sid, 'end');
          }
        }}
        onPick={(t) => {
          const sid = slash.id, inline = slash.inline, at = slash.at; setSlash(null);
          if (inline) {
            const el = refs.current[sid];
            const bare = el && el.innerText.replace(/\n+$/, '') === '/';
            if (el && !bare && at != null) {
              // 块里还有别的内容（正文中途输入 /）：只删掉触发的「/」，
              // 在下方插入所选类型的新块——当前块的既有内容原样保留。
              const s1 = nodeAtOffset(el, at - 1), e1 = nodeAtOffset(el, at);
              if (s1 && e1) { try { const r = document.createRange(); r.setStart(s1.node, s1.off); r.setEnd(e1.node, e1.off); r.deleteContents(); } catch (_) { } }
              const nb = { id: uid(), type: t, text: '', ...typeExtras(t) };
              flushSynced(s => { const i = s.findIndex(x => x.id === sid); return [...s.slice(0, i + 1), nb, ...s.slice(i + 1)]; });
              if (EDITABLE.includes(t)) focusBlock(nb.id, 'start');
              return;
            }
            // 块内容只有「/」：先清掉它（React 对相同 __html 不重设 innerHTML），
            // 再原地转换块类型，最后把焦点还给该块——避免「/」残留 + 焦点掉到 body。
            if (el) el.innerHTML = '';
            flushSynced(s => s.map(bb => bb.id === sid ? { ...bb, type: t, text: '', ...typeExtras(t, bb) } : bb));
            if (EDITABLE.includes(t)) focusBlock(sid, 'start');
          } else insertAfter(sid, t);
        }} />}
      {more && <EditorMoreMenu x={more.x} y={more.y} fav={fav} constellations={D.constellations} onAction={pageAction} onClose={() => setMore(null)} />}
      {history && <HistoryDialog star={star} onClose={() => setHistory(false)} onFlash={flash} />}
      {sel && !ctx && <SelectionToolbar x={sel.x} y={sel.y} onFormat={runFormat} onLink={formatLink} onColor={() => { setColorPop({ x: sel.x, y: sel.y + 10 }); }} />}
      {colorPop && <ColorMenu x={colorPop.x} y={colorPop.y} onClose={() => setColorPop(null)} onPick={(c) => { if (c.kind === 'text') runFormat('foreColor', c.c); else runFormat('hiliteColor', c.c); setColorPop(null); }} />}

      {toast && (
        <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--z-toast)', animation: 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
          <GlassPanel strong radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px' }}>
            <Icon name="check" size={16} color="var(--gold)" /><span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{toast}</span>
          </GlassPanel>
        </div>
      )}

      {confirm && <ConfirmDialog message={confirm.message} confirmLabel={confirm.confirmLabel} onYes={() => { confirm.onYes(); setConfirm(null); }} onClose={() => setConfirm(null)} />}
      {linkDialog && <LinkDialog onSubmit={applyLink} onClose={() => setLinkDialog(null)} />}

      {/* 「在星图中探索」确认：DS Modal——确认后关闭编辑器，跃迁到星图并聚焦该星系 */}
      {explore && (() => {
        const conNm = D.conName(explore.con) || '未知星域';
        const goExplore = () => {
          const s = explore; setExplore(null);
          persistBody();
          if (onExplore) { onExplore(s.id); return; }
          // 兜底：上层没接线时至少跃迁回星图
          const T = window.srTransition;
          if (T && T.flight && onBack) T.flight(onBack); else if (onBack) onBack();
        };
        return (
          <Modal open onClose={() => setExplore(null)} title={'探索「' + conNm + '」星系'} icon="orbit" width={392}
            footer={
              <React.Fragment>
                <Button size="sm" onClick={() => setExplore(null)}>留在笔记</Button>
                <Button variant="primary" size="sm" icon="rocket" glow autoFocus onClick={goExplore}>启程</Button>
              </React.Fragment>
            }>
            <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-2)' }}>
              将离开编辑器，跃迁回星图——镜头会飞向「{conNm}」星域，为你照亮
              <span style={{ color: 'var(--text-1)' }}>「{explore.label}」</span>所在的位置。这里的更改已自动保存。
            </div>
          </Modal>
        );
      })()}

      {/* Markdown 导入的隐藏文件入口（「更多 ▸ 导入 Markdown」触发；也支持直接拖入正文） */}
      <input ref={importInputRef} id="sr-md-import" type="file" accept=".md,.markdown,.txt,text/markdown"
        style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" onChange={onImportFile} />

      {/* 笔记内查找 / 替换条（⌘F）——非模态浮条，Esc 关闭并把焦点还给正文 */}
      {find && (() => {
        const inputCss = { flex: 1, minWidth: 0, boxSizing: 'border-box', background: 'var(--input-bg, rgba(3,4,12,0.45))', border: '1px solid var(--glass-border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontSize: 13, padding: '6px 9px', outline: 'none', fontFamily: 'var(--font-sans)' };
        const btnCss = (off) => ({ flex: 'none', position: 'relative', height: 30, padding: '0 11px', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-border-strong)', background: 'color-mix(in srgb, var(--star-blue) 12%, transparent)', color: 'var(--text-1)', fontSize: 12, cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.5 : 1, fontFamily: 'var(--font-sans)' });
        return (
          <div className="sr-ed-find" role="search" aria-label="笔记内查找"
            style={{ position: 'absolute', top: 10, right: 336, zIndex: 'var(--z-menu)' }}>
            <GlassPanel strong radius="md" pad="none" glow style={{ padding: 8, width: 348, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon name="search" size={14} color="var(--star-blue)" style={{ flex: 'none' }} />
                <input ref={findInputRef} autoFocus value={find.q} placeholder="在这篇笔记中查找…" aria-label="查找内容"
                  onChange={(e) => { const v = e.target.value; setFindIdx(0); setFind(f => ({ ...f, q: v })); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); gotoMatch(findIdx + (e.shiftKey ? -1 : 1)); } }}
                  style={inputCss} />
                <span aria-live="polite" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: find.q ? (findMatches.length ? 'var(--text-2)' : 'var(--danger)') : 'var(--text-3)', flex: 'none', minWidth: 46, textAlign: 'center' }}>
                  {find.q ? (findMatches.length ? (findIdx + 1) + ' / ' + findMatches.length : '无结果') : ''}
                </span>
                <IconButton name="chevron-up" size="sm" title="上一处 · ⇧Enter" onClick={() => gotoMatch(findIdx - 1)} />
                <IconButton name="chevron-down" size="sm" title="下一处 · Enter" onClick={() => gotoMatch(findIdx + 1)} />
                <IconButton name="replace" size="sm" active={!!find.rep} title={find.rep ? '收起替换' : '替换'} onClick={() => setFind(f => ({ ...f, rep: !f.rep }))} />
                <IconButton name="x" size="sm" title="关闭 · Esc" onClick={closeFind} />
              </div>
              {find.rep && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
                  <Icon name="corner-down-right" size={14} color="var(--text-3)" style={{ flex: 'none' }} />
                  <input value={find.rv} placeholder="替换为…" aria-label="替换为"
                    onChange={(e) => { const v = e.target.value; setFind(f => ({ ...f, rv: v })); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); replaceOne(); } }}
                    style={inputCss} />
                  <button type="button" className="sr-focus-ring sr-hit40" disabled={!findMatches.length} onClick={replaceOne} style={btnCss(!findMatches.length)}>替换</button>
                  <button type="button" className="sr-focus-ring sr-hit40" disabled={!findMatches.length} onClick={replaceAll} style={btnCss(!findMatches.length)}>全部替换</button>
                </div>
              )}
            </GlassPanel>
          </div>
        );
      })()}
    </div>
  );
}

/* 顶栏保存指示：真实三态（保存中 / 已同步 / 仅本机），吃 api.js 的 sr-net 事件。
   离线时点击可立即重试；title 里始终能看到上次同步时间。 */
function SaveStatus() {
  const read = () => (window.SRNet && window.SRNet.getStatus) ? window.SRNet.getStatus() : { status: 'saved', online: true, lastSync: 0 };
  const [st, setSt] = React.useState(read);
  React.useEffect(() => {
    const h = (e) => setSt(e.detail || read());
    window.addEventListener('sr-net', h);
    return () => window.removeEventListener('sr-net', h);
  }, []);
  const D = window.SR_DATA;
  const syncTip = st.lastSync ? '上次同步 ' + D.ago(st.lastSync) : '尚未与服务器同步';
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, whiteSpace: 'nowrap', flex: 'none' };
  if (st.status === 'saving') {
    return (
      <span style={{ ...base, color: 'var(--text-3)' }} title={syncTip}>
        <span className="sr-ed-spin" style={{ display: 'inline-flex', animation: 'sr-ed-spin 1.2s linear infinite' }} aria-hidden="true"><Icon name="loader" size={14} color="var(--text-3)" /></span>
        保存中…
      </span>
    );
  }
  if (st.status === 'local' || st.status === 'error') {
    return (
      <button type="button" className="sr-focus-ring" onClick={() => window.SRNet && window.SRNet.saveNow()}
        title={'服务器暂不可达 · 点击立即重试 · ' + syncTip}
        style={{ ...base, color: st.status === 'error' ? 'var(--danger)' : 'var(--star-blue-dim)', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}>
        <Icon name={st.status === 'error' ? 'triangle-alert' : 'hard-drive'} size={14} color="currentColor" />
        {st.status === 'error' ? '未能保存' : '已保存在本机'}
      </button>
    );
  }
  return <span style={{ ...base, color: 'var(--text-3)' }} title={syncTip}><Icon name="check" size={14} color="var(--gold)" />已同步</span>;
}

function RailHead({ icon, title, extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={15} color="var(--gold)" />
      <span style={{ fontSize: 12.5, letterSpacing: '0.04em', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{title}</span>
      {extra != null && <Badge tone="blue">{extra}</Badge>}
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { Editor });
