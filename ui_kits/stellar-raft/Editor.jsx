/* Editor — professional block editor (screen 8). Block-driven: hover handles,
   right-click context menu, slash insert, selection toolbar, many block types,
   contentEditable text, + the right knowledge rail. Content is data-driven:
   each star renders its own body / summary / properties / relations. */
const { GlassPanel, Icon, IconButton, Input, Tag, Badge, MemoryBar, Button } = window.StellarRaftDesignSystem_2866af;

const TXT = { default: 'var(--text-1)', blue: 'var(--star-blue)', gold: 'var(--gold)', dim: 'var(--star-blue-dim)', danger: 'var(--danger)' };
const BG = { none: 'transparent', bgblue: 'rgba(159,198,255,0.10)', bggold: 'rgba(255,217,138,0.10)', bgdeep: 'rgba(26,35,80,0.45)' };
const uid = () => 'b' + Math.random().toString(36).slice(2, 8);

const EDITABLE = ['p', 'h1', 'h2', 'h3', 'bulleted', 'numbered', 'todo', 'quote', 'toggle', 'callout'];

/* ---- Markdown 支持：行内标记 → HTML，整段 Markdown → 块数组（粘贴时使用） ---- */
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const CODE_SPAN_CSS = 'font-family:var(--font-mono);font-size:0.92em;background:rgba(159,198,255,0.14);padding:1px 5px;border-radius:5px;';
const mdInline = (s) => escHtml(s)
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
  .replace(/`([^`]+)`/g, '<code style="' + CODE_SPAN_CSS + '">$1</code>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" style="color:var(--star-blue);text-decoration:underline;text-underline-offset:3px;">$1</a>');

function parseMdBlocks(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0, m;
  while (i < lines.length) {
    const l = lines[i].trim();
    if (!l) { i++; continue; }
    if ((m = l.match(/^```(\w*)/))) {                                    // 代码围栏
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++;
      out.push({ id: uid(), type: 'code', lang: (m[1] || 'plaintext').toLowerCase(), code: buf.join('\n') });
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
    } else if (/^(-{3,}|\*{3,})$/.test(l)) { out.push({ id: uid(), type: 'divider' }); i++; }
    else if ((m = l.match(/^(#{1,3})\s+(.*)/))) { out.push({ id: uid(), type: 'h' + m[1].length, text: mdInline(m[2]) }); i++; }
    else if ((m = l.match(/^[-*]\s+\[( |x|X)\]\s+(.*)/))) { out.push({ id: uid(), type: 'todo', checked: m[1].toLowerCase() === 'x', text: mdInline(m[2]) }); i++; }
    else if ((m = l.match(/^[-*]\s+(.*)/))) { out.push({ id: uid(), type: 'bulleted', text: mdInline(m[1]) }); i++; }
    else if ((m = l.match(/^\d+[.)]\s+(.*)/))) { out.push({ id: uid(), type: 'numbered', text: mdInline(m[1]) }); i++; }
    else if ((m = l.match(/^>\s?(.*)/))) { out.push({ id: uid(), type: 'quote', text: mdInline(m[1]) }); i++; }
    else { out.push({ id: uid(), type: 'p', text: mdInline(l) }); i++; }
  }
  return out;
}

function Handle({ icon, title, onClick, onMouseDown }) {
  const [h, setH] = React.useState(false);
  return (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); if (onMouseDown) onMouseDown(e); }} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 22, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5,
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

function CodeBlock({ code: codeProp, lang: langProp, onCommitCode, autoEdit }) {
  const dawn = useDawn();
  const [copied, setCopied] = React.useState(false);
  const [lang, setLang] = React.useState(langProp || 'python');
  const [menu, setMenu] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const langBtnRef = React.useRef(null);
  const [menuPos, setMenuPos] = React.useState(null);
  React.useLayoutEffect(() => {
    if (!menu || !langBtnRef.current) return;
    const r = langBtnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 16;
    const below = spaceBelow >= 220 || spaceBelow >= r.top;
    const maxH = Math.max(160, Math.min(340, below ? spaceBelow : r.top - 16));
    setMenuPos(below ? { left: r.left, top: r.bottom + 6, maxH } : { left: r.left, bottom: window.innerHeight - r.top + 6, maxH });
  }, [menu]);

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
    <div style={{ background: P.bg, border: '1px solid ' + P.border, borderRadius: 'var(--r-md)', overflow: 'hidden', margin: '2px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid ' + P.border, background: P.head, position: 'relative' }}>
        <span style={{ display: 'flex', gap: 5 }}>
          {['#ff6b6b88', '#ffc94e99', '#5ec98e99'].map((c, i) => <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
        </span>
        {editing ? (
          <input autoFocus defaultValue={lang}
            onBlur={(e) => { const v = e.target.value.trim().toLowerCase(); if (v) setLang(v); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { const v = e.target.value.trim().toLowerCase(); if (v) setLang(v); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
            style={{ marginLeft: 4, width: 110, background: 'transparent', border: 'none', borderBottom: '1px solid ' + P.meta, outline: 'none', color: P.plain, fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 0' }} />
        ) : (
          <button type="button" ref={langBtnRef} onClick={() => setMenu(m => !m)} onDoubleClick={() => { setMenu(false); setEditing(true); }}
            title="点击切换语言 · 双击直接编辑"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4, padding: '2px 6px', borderRadius: 6, background: menu ? (dawn ? 'rgba(36,52,96,0.08)' : 'rgba(159,198,255,0.1)') : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, color: P.meta }}>
            {lang} <Icon name="chevron-down" size={12} color="currentColor" style={{ transform: menu ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-fast)' }} />
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? (dawn ? '#b8801a' : '#ffd98a') : P.meta, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
          <Icon name={copied ? 'check' : 'copy'} size={13} color="currentColor" />{copied ? '已复制' : '复制'}
        </button>
        {menu && menuPos && (
          <React.Fragment>
            <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
            <div style={{ position: 'fixed', left: menuPos.left, top: menuPos.top, bottom: menuPos.bottom, zIndex: 10, width: 160 }}>
              <GlassPanel strong radius="md" pad="none" style={{ padding: 5, maxHeight: menuPos.maxH, overflow: 'auto' }}>
                {CODE_LANGS.map(l => (
                  <div key={l} onClick={() => { setLang(l); setMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: l === lang ? 'var(--gold)' : 'var(--text-1)' }}
                    onMouseEnter={e => e.currentTarget.style.background = dawn ? 'rgba(36,52,96,0.07)' : 'rgba(159,198,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 14, display: 'inline-flex' }}>{l === lang && <Icon name="check" size={13} color="var(--gold)" />}</span>{l}
                  </div>
                ))}
              </GlassPanel>
            </div>
          </React.Fragment>
        )}
      </div>
      {editingCode ? (
        <textarea value={code} autoFocus spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => { setEditingCode(false); if (onCommitCode) onCommitCode(code); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.currentTarget.blur(); } }}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: Math.max(80, rows.length * 22 + 24), background: 'transparent', color: P.plain, border: 'none', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.85, padding: '12px 14px', tabSize: 4 }} />
      ) : (
        <div onClick={() => setEditingCode(true)} title="点击编辑代码" style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.85, color: P.plain, overflowX: 'auto', cursor: 'text', minHeight: 24 }}>
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

function DataTable({ head: headProp, rows: rowsProp }) {
  const head = headProp || ['理论', 'S 上限', '是否定域'];
  const rows = rowsProp || [['经典隐变量', '2', '是'], ['量子力学', '2√2 ≈ 2.83', '否'], ['实验观测', '≈ 2.4', '—']];
  const cell = (txt, isHead) => (
    <td contentEditable suppressContentEditableWarning style={{ outline: 'none', padding: '9px 13px', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
      fontSize: 13.5, color: isHead ? 'var(--text-1)' : 'var(--text-2)', fontWeight: isHead ? 500 : 400, background: isHead ? 'rgba(159,198,255,0.05)' : 'transparent' }}>{txt}</td>
  );
  return (
    <div style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--r-md)', overflow: 'hidden', margin: '2px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
        <tbody>
          <tr>{head.map((h, i) => <React.Fragment key={i}>{cell(h, true)}</React.Fragment>)}</tr>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <React.Fragment key={j}>{cell(c, false)}</React.Fragment>)}</tr>)}
        </tbody>
      </table>
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

function renderTex(src) {
  if (src == null || src === '') return null;
  let key = 0; const K = () => key++;
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
    while (pos < toks.length) {
      const tk = peek();
      if (!tk) break;
      if (tk.k === '}') { pos++; if (stopBrace) break; else continue; }
      let atom = parseAtom();
      if (atom == null) continue;
      atom = attachScripts(atom);
      out.push(<React.Fragment key={K()}>{atom}</React.Fragment>);
    }
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
      case 'frac': case 'dfrac': case 'tfrac': { const a = parseUnit(); const b = parseUnit(); return frac(a, b); }
      case 'sqrt': {
        let idx = null;
        if (peek() && peek().k === 'c' && peek().v === '[') { pos++; const inner = []; while (peek() && !(peek().k === 'c' && peek().v === ']')) { const a = parseAtom(); if (a != null) inner.push(a); } if (peek()) pos++; idx = inner; }
        return sqrtEl(parseUnit(), idx);
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
  catch (e) { return <span>{src}</span>; }
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
          <span style={{ fontSize: 19, color: v.trim() ? 'var(--text-1)' : 'var(--text-3)', letterSpacing: '0.01em' }}>{v.trim() ? renderTex(v) : '预览'}</span>
        </div>
      </div>
    );
  }
  return (
    <div onClick={() => setEditing(true)} title="点击编辑 LaTeX 源码"
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 14px', borderRadius: 'var(--r-md)', background: 'rgba(159,198,255,0.04)', border: '1px solid var(--glass-border)', cursor: 'text', margin: '2px 0' }}>
      <span style={{ fontSize: 19.5, color: tex ? 'var(--text-1)' : 'var(--text-3)', letterSpacing: '0.01em', textAlign: 'center' }}>
        {tex ? renderTex(tex) : '点击输入公式（LaTeX 源码）…'}
      </span>
    </div>
  );
}

// 标签 chip：悬停露出移除按钮
function TagChip({ label, onRemove }) {
  const [h, setH] = React.useState(false);
  return (
    <span onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Tag icon="hash">{label}</Tag>
      <button type="button" title="移除标签" onClick={onRemove}
        style={{ width: h ? 18 : 0, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: h ? 1 : 0, overflow: 'hidden', border: 0, background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', padding: 0, transition: 'width var(--dur-fast), opacity var(--dur-fast)' }}>
        <Icon name="x" size={12} color="currentColor" />
      </button>
    </span>
  );
}

// 基础属性行 → star.props 字段名
const PROP_KEYS = { type: 'type', status: 'status', source: 'source', alias: 'alias', review: 'nextReview' };

function Properties({ props, onFlash, onConfirm, onCommit }) {
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
    { key: 'type', icon: 'tag', k: '类型', v: p.type || '—', kind: 'select' },
    { key: 'status', icon: 'circle-dot', k: '状态', v: p.status || '—', kind: 'status' },
    { key: 'source', icon: 'book-open', k: '来源', v: p.source || '—', kind: 'text' },
    { key: 'alias', icon: 'languages', k: '别名', v: p.alias || '—', kind: 'text' },
    { key: 'review', icon: 'calendar', k: '下次复习', v: p.nextReview || '—', kind: 'text' },
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
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', cursor: 'pointer', color: 'var(--text-3)' }}>
        <Icon name="chevron-right" size={14} color="currentColor" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-fast)' }} />
        <span style={{ fontSize: 11, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>属性 Properties</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{rows.length}</span>
      </div>
      {open && (
        <div style={{ padding: '2px 14px 12px' }}>
          {rows.map((r) => (
            <div key={r.key} onMouseEnter={() => setHoverKey(r.key)} onMouseLeave={() => setHoverKey(null)}
              onFocus={() => setFocusKey(r.key)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusKey(f => (f === r.key ? null : f)); }}
              onContextMenu={(e) => { e.preventDefault(); delRow(r); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', margin: '0 -8px', borderRadius: 'var(--r-sm)',
                background: focusKey === r.key ? 'rgba(159,198,255,0.07)' : (hoverKey === r.key ? 'rgba(159,198,255,0.03)' : 'transparent'),
                boxShadow: focusKey === r.key ? '0 0 0 1.5px rgba(159,198,255,0.45)' : 'none',
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
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-1)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', boxShadow: 'var(--glow-gold-soft)' }} /><span contentEditable suppressContentEditableWarning title="点击编辑" onBlur={commitVal(r)} style={{ outline: 'none', cursor: 'text' }}>{r.v}</span></span>
                  : r.kind === 'select'
                    ? <span contentEditable suppressContentEditableWarning title="点击编辑" onBlur={commitVal(r)} style={{ outline: 'none', cursor: 'text', fontSize: 12, padding: '2px 9px', borderRadius: 'var(--r-pill)', background: 'rgba(159,198,255,0.12)', color: 'var(--star-blue)' }}>{r.v}</span>
                    : <span contentEditable suppressContentEditableWarning title="点击编辑" data-ph="空" onBlur={commitVal(r)}
                        style={{ outline: 'none', cursor: 'text', fontSize: 13, color: 'var(--text-1)', borderRadius: 4, padding: '0 2px', display: 'inline-block', minWidth: 42 }}>{r.v}</span>}
              </div>
              <button type="button" title="删除此属性（或右键该行）" onMouseDown={(e) => e.preventDefault()} onClick={() => delRow(r)}
                style={{ flex: 'none', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', opacity: hoverKey === r.key ? 1 : 0, transition: 'opacity var(--dur-fast)' }}>
                <Icon name="x" size={14} color="currentColor" />
              </button>
            </div>
          ))}
          <div onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 0 2px', color: 'var(--text-3)', fontSize: 12.5, cursor: 'pointer' }}>
            <Icon name="plus" size={13} color="currentColor" />添加属性
          </div>
        </div>
      )}
    </div>
  );
}

function Editor({ starId, onBack, onOpen }) {
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
  const toggleFav = () => setFav(f => { const nf = !f; star.fav = nf; flash(nf ? '已收藏 · 可在收件箱「收藏」里找到' : '已取消收藏'); return nf; });
  const [tags, setTags] = React.useState(() => (star.tags || []).slice());
  const [addingTag, setAddingTag] = React.useState(false);
  const [tagDraft, setTagDraft] = React.useState('');
  const [connected, setConnected] = React.useState(() => D.relatedStars(star.id));
  const [linking, setLinking] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);     // {message, confirmLabel, onYes}
  const [linkDialog, setLinkDialog] = React.useState(null); // {range}
  const [more, setMore] = React.useState(null);           // page-level 「更多」 dropdown {x,y}
  const [history, setHistory] = React.useState(false);    // version-history dialog (mock)
  const [con, setCon] = React.useState(star.con);         // constellation, mutable via 「移动到星座」
  const [linkStar, setLinkStar] = React.useState(null);   // chosen star awaiting a relation sentence
  const [relDraft, setRelDraft] = React.useState('');
  const [hoverConn, setHoverConn] = React.useState(null);

  const { SlashMenu, SelectionToolbar, ContextMenu, ColorMenu, ConfirmDialog, LinkDialog, EditorMoreMenu, HistoryDialog } = window.SRKit;
  const backlinks = D.backlinksOf(star.id);
  const scrollRef = React.useRef(null);
  const stripTags = (h) => (h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // 大纲与字数读取活的 DOM（输入时防抖触发一次轻量重渲染，不改块状态、不动光标）
  const [, bumpTick] = React.useReducer(x => x + 1, 0);
  const tickTimer = React.useRef(null);
  const scheduleTick = () => { clearTimeout(tickTimer.current); tickTimer.current = setTimeout(() => { bumpTick(); persistBody(); }, 350); };
  React.useEffect(() => () => clearTimeout(tickTimer.current), []);
  const liveText = (b) => { const el = refs.current[b.id]; return el ? el.innerText : stripTags(b.text || ''); };
  const outline = blocks.filter(b => ['h1', 'h2', 'h3'].includes(b.type)).map(b => ({ ...b, live: liveText(b).trim() })).filter(b => b.live);
  const charCount = blocks.filter(b => EDITABLE.includes(b.type)).map(liveText).join('').replace(/\s/g, '').length + (star.summary || '').length + star.label.length;
  const readMin = Math.max(1, Math.round(charCount / 350));
  const scrollToBlock = (id) => {
    const c = scrollRef.current, el = document.getElementById('blk-' + id);
    if (c && el) c.scrollTo({ top: el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 40, behavior: 'smooth' });
  };

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1600); };
  // capture innerHTML (not innerText) so inline formatting — bold / italic /
  // highlight / links / colors — survives any structural block operation.
  const syncBlock = (b) => (refs.current[b.id] && EDITABLE.includes(b.type)) ? { ...b, text: refs.current[b.id].innerHTML } : b;
  const withSynced = (fn) => setBlocks(bs => fn(bs.map(syncBlock)));

  const blocksRef = React.useRef(blocks); blocksRef.current = blocks;
  const [dragBlk, setDragBlk] = React.useState(null);   // 正在拖拽排序的块 id
  const [dropIdx, setDropIdx] = React.useState(null);   // 拖拽落点（目标索引）
  const dropIdxRef = React.useRef(null); dropIdxRef.current = dropIdx;

  // 「已自动保存」的实现：正文回写到 star.body。
  // 结构变更（增删/转换/排序）时 blocks 已同步，直接落盘；
  // 纯打字停留在 DOM，由输入防抖与卸载时的 persistBody 收拢。
  const persistBody = () => { star.body = blocksRef.current.map(syncBlock); D.touchNote(star.id); };
  React.useEffect(() => { star.body = blocks; }, [blocks]);
  React.useEffect(() => () => persistBody(), []);

  // 结构变更需要同步提交（flushSync），随后立即聚焦——否则连续快速输入
  // 会赶在 React 提交/聚焦之前，把字符落进旧块
  const flushSynced = (fn) => {
    if (ReactDOM.flushSync) ReactDOM.flushSync(() => withSynced(fn));
    else withSynced(fn);
  };
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

    // 空格触发 Markdown 前缀转换（块里只有前缀本身时）。先清 DOM 再提交：
    // React 对相同 __html 不会重设 innerHTML，前缀字符会残留
    if (e.key === ' ') {
      const t = el.innerText.replace(/\n+$/, '');
      const type = MD_PREFIX[t];
      if (type) {
        e.preventDefault();
        el.innerHTML = '';
        flushSynced(s => s.map(x => x.id === b.id ? { ...x, type, text: '', checked: t.toLowerCase() === '[x]' } : x));
        focusBlock(b.id, 'start');
        return;
      }
    }

    // Enter：在光标处拆分为新块（列表延续同类型；空列表项退出为正文）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const listLike = ['bulleted', 'numbered', 'todo'].includes(b.type);
      if (listLike && el.innerText.trim() === '') {
        el.innerHTML = '';
        flushSynced(s => s.map(x => x.id === b.id ? { ...x, type: 'p', text: '' } : x));
        focusBlock(b.id, 'start');
        return;
      }
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
      const nb = { id: uid(), type: listLike ? b.type : 'p', text: tail, checked: false };
      flushSynced(s => { const i = s.findIndex(x => x.id === b.id); return [...s.slice(0, i + 1), nb, ...s.slice(i + 1)]; });
      focusBlock(nb.id, 'start');
      return;
    }

    // Backspace 在块首：先降级为正文，再删除/并入上一块
    if (e.key === 'Backspace') {
      const info = caretInfo(el);
      if (!info || !info.collapsed || !info.atStart) return;
      if (b.type !== 'p') {
        e.preventDefault();
        flushSynced(s => s.map(x => x.id === b.id ? { ...x, type: 'p' } : x));
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
        const curHtml = el.innerHTML;
        flushSynced(s => s.filter(x => x.id !== b.id).map(x => x.id === prev.id ? { ...x, text: (x.text || '') + '<span data-caret="1"></span>' + curHtml } : x));
        const pel = refs.current[prev.id];
        if (pel) {
          pel.focus();
          const mark = pel.querySelector('[data-caret="1"]');
          if (mark) {
            const s2 = window.getSelection(); const r2 = document.createRange();
            r2.setStartBefore(mark); r2.collapse(true);
            s2.removeAllRanges(); s2.addRange(r2);
            mark.remove();
          }
        }
      }
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

  // 粘贴：多行或含 Markdown 标记的文本解析成块插入
  const blockPaste = (b) => (e) => {
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!text) return;
    const md = /(^|\n)(#{1,3} |[-*] |\d+[.)] |> |```|\$\$|(-{3,}|\*{3,})$|\|.+\|)/.test(text);
    if (!text.includes('\n') && !md) return;   // 单行普通文本走默认粘贴
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
  const blocksToMd = () => {
    const cur = blocks.map(syncBlock);
    const toMd = (h) => stripTags((h || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
      .replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')).trim();
    let n = 0;
    const lines = [];
    cur.forEach(b => {
      if (b.type !== 'numbered') n = 0;
      switch (b.type) {
        case 'rich': if (star.summary) lines.push(star.summary); break;
        case 'h1': lines.push('# ' + toMd(b.text)); break;
        case 'h2': lines.push('## ' + toMd(b.text)); break;
        case 'h3': lines.push('### ' + toMd(b.text)); break;
        case 'p': lines.push(toMd(b.text)); break;
        case 'quote': lines.push('> ' + toMd(b.text)); break;
        case 'callout': lines.push('> ' + toMd(b.text)); break;
        case 'bulleted': lines.push('- ' + toMd(b.text)); break;
        case 'numbered': n += 1; lines.push(n + '. ' + toMd(b.text)); break;
        case 'todo': lines.push('- [' + (b.checked ? 'x' : ' ') + '] ' + toMd(b.text)); break;
        case 'toggle': lines.push('- ' + toMd(b.text) + (b.child ? '\n  ' + b.child : '')); break;
        case 'math': lines.push('$$\n' + (b.tex || '') + '\n$$'); break;
        case 'code': lines.push('```' + (b.lang || '') + '\n' + (b.code || '') + '\n```'); break;
        case 'divider': lines.push('---'); break;
        case 'image': lines.push('![](' + (b.src || '') + ')'); break;
        case 'table': {
          const head = b.head || ['理论', 'S 上限', '是否定域'];
          const rows = b.rows || [];
          lines.push('| ' + head.join(' | ') + ' |');
          lines.push('| ' + head.map(() => '---').join(' | ') + ' |');
          rows.forEach(r => lines.push('| ' + r.join(' | ') + ' |'));
          break;
        }
        default: break;
      }
    });
    const tagLine = tags.length ? tags.map(t => '#' + t).join(' ') + '\n\n' : '';
    return '# ' + star.label + '\n\n' + tagLine + lines.filter(l => l != null && l !== '').join('\n\n') + '\n';
  };
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
    else if (action === 'move') { star.con = arg; D.syncCounts(); D.touchNote(star.id); setCon(arg); flash('已移动到「' + D.conName(arg) + '」'); }
    else if (action === 'history') { setHistory(true); }
    else if (action === 'delete') { setConfirm({ message: '「' + star.label + '」将坠入黑洞，连接与反链一并带走。黑洞里的星可以随时恢复。', confirmLabel: '移入黑洞', onYes: () => { D.trashStar(star.id); flash('已移入黑洞 · 可随时恢复'); if (onBack) setTimeout(onBack, 480); } }); }
    setMore(null);
  };

  const act = (id) => (action, arg) => {
    if (action === 'delete') setConfirm({ message: '确定删除这个块吗？此操作不可撤销。', confirmLabel: '删除', onYes: () => withSynced(s => s.filter(b => b.id !== id)) });
    else if (action === 'duplicate') withSynced(s => { const i = s.findIndex(b => b.id === id); return [...s.slice(0, i + 1), { ...s[i], id: uid() }, ...s.slice(i + 1)]; });
    else if (action === 'turn') withSynced(s => s.map(b => b.id === id ? { ...b, type: arg } : b));
    else if (action === 'color') withSynced(s => s.map(b => b.id === id ? (arg.kind === 'text' ? { ...b, color: arg.id } : { ...b, bg: arg.id }) : b));
    else if (action === 'copyLink') { try { navigator.clipboard && navigator.clipboard.writeText('stellar-raft://star/' + star.id + '#' + id); } catch (e) { } flash('已复制块链接'); }
    else if (action === 'move') { star.con = arg; D.syncCounts(); D.touchNote(star.id); setCon(arg); flash('已移动到「' + D.conName(arg) + '」'); }
    else if (action === 'comment') flash('已添加评论');
    else if (action === 'review') { star.props = star.props || {}; star.props.nextReview = '今天'; D.pushTimeline('review', star.id, '加入复习队列'); D.touchNote(star.id); bumpTick(); flash('已加入复习队列 · 下次复习改为今天'); }
    else if (action === 'ai') flash('AI 正在阅读这个块…');
    setCtx(null);
  };

  const insertAfter = (id, type = 'p') => withSynced(s => { const i = s.findIndex(b => b.id === id); const nb = { id: uid(), type, text: '' }; return [...s.slice(0, i + 1), nb, ...s.slice(i + 1)]; });

  const syncTags = (ts) => { star.tags = ts.slice(); D.touchNote(star.id); };
  const commitTag = () => { const t = tagDraft.trim(); if (t && !tags.includes(t)) setTags(ts => { const nt = [...ts, t]; syncTags(nt); return nt; }); setTagDraft(''); setAddingTag(false); };
  const removeTag = (t) => setTags(ts => { const nt = ts.filter(x => x !== t); syncTags(nt); return nt; });

  const onMouseUp = () => {
    const s = window.getSelection();
    if (s && !s.isCollapsed && s.rangeCount && s.toString().trim()) {
      const r = s.getRangeAt(0).getBoundingClientRect();
      if (r.width > 1) { setSel({ x: r.left + r.width / 2, y: r.top - 6 }); return; }
    }
    setSel(null);
  };

  // run a rich-text command on the current selection, then keep the toolbar in place
  const runFormat = (cmd, value) => {
    if (cmd === 'inlineCode') {
      const s0 = window.getSelection();
      if (s0 && s0.rangeCount && !s0.isCollapsed) {
        const text = s0.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        document.execCommand('insertHTML', false, '<code style="font-family:var(--font-mono);font-size:0.92em;background:rgba(159,198,255,0.14);padding:1px 5px;border-radius:5px;">' + text + '</code>');
      }
      return;
    }
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, value);
    const s = window.getSelection();
    if (s && s.rangeCount && !s.isCollapsed) {
      const r = s.getRangeAt(0).getBoundingClientRect();
      if (r.width > 1) setSel({ x: r.left + r.width / 2, y: r.top - 6 });
    }
  };
  const formatLink = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    setLinkDialog({ range: sel.getRangeAt(0).cloneRange() });
  };
  const applyLink = (url) => {
    const ld = linkDialog; setLinkDialog(null);
    if (!ld) return;
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(ld.range);
    document.execCommand('createLink', false, url);
  };

  const editable = (b, tag, style) => {
    const Tag = tag;
    return React.createElement(Tag, {
      ref: el => (refs.current[b.id] = el), contentEditable: true, suppressContentEditableWarning: true,
      'data-ph': '输入正文，或按 / 选择块类型',
      onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, id: b.id }); },
      onKeyDown: blockKeyDown(b),
      onPaste: blockPaste(b),
      // typing "/" in an empty block opens the slash menu at the caret (Notion-style);
      // "```" / "$$" / "---" transform in place (Typora-style)
      onInput: (e) => {
        scheduleTick();
        const t = e.currentTarget.innerText;
        if (t === '/') {
          let rect;
          try { const r = window.getSelection().getRangeAt(0).getBoundingClientRect(); if (r && (r.left || r.top)) rect = r; } catch (_) { }
          if (!rect) rect = e.currentTarget.getBoundingClientRect();
          setSlash({ x: rect.left, y: rect.bottom + 6, id: b.id, inline: true });
          return;
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
      dangerouslySetInnerHTML: { __html: b.text || '' },
    });
  };

  let numCount = 0;
  const renderInner = (b) => {
    if (b.type !== 'numbered') numCount = 0;
    switch (b.type) {
      case 'rich': return <div contentEditable suppressContentEditableWarning data-ph="一句话摘要：这颗星在悬停时如何介绍自己…"
        onInput={scheduleTick}
        onBlur={(e) => { const t = e.currentTarget.innerText.trim(); if (t !== (star.summary || '')) { star.summary = t; D.touchNote(star.id); } }}
        style={{ outline: 'none', fontSize: 16.5, lineHeight: 1.85, color: 'var(--text-2)' }}>{star.summary}</div>;
      case 'h1': return editable(b, 'div', { fontSize: 28, fontWeight: 300, lineHeight: 1.3 });
      case 'h2': return editable(b, 'div', { fontSize: 21, fontWeight: 300, marginTop: 6 });
      case 'h3': return editable(b, 'div', { fontSize: 17.5, fontWeight: 500, color: 'var(--text-1)' });
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
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: 'var(--star-blue)', marginTop: 11, width: 5, height: 5, borderRadius: '50%', background: 'var(--star-blue)', flex: 'none' }} />
          {editable(b, 'div', { flex: 1, fontSize: 16.5, lineHeight: 1.7, color: 'var(--text-2)' })}
        </div>
      );
      case 'numbered': { numCount += 1; const n = numCount; return (
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: 'var(--star-blue)', fontFamily: 'var(--font-mono)', fontSize: 14, marginTop: 2, minWidth: 16 }}>{n}.</span>
          {editable(b, 'div', { flex: 1, fontSize: 16.5, lineHeight: 1.7, color: 'var(--text-2)' })}
        </div>
      ); }
      case 'todo': return (
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <span onClick={() => setBlocks(s => s.map(x => x.id === b.id ? { ...x, checked: !x.checked } : x))}
            style={{ width: 18, height: 18, marginTop: 2, borderRadius: 5, flex: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid', borderColor: b.checked ? 'var(--gold)' : 'var(--line-strong)', background: b.checked ? 'var(--gold)' : 'transparent' }}>
            {b.checked && <Icon name="check" size={12} color="var(--text-on-gold)" />}
          </span>
          {editable(b, 'div', { flex: 1, fontSize: 16, lineHeight: 1.7, color: b.checked ? 'var(--text-3)' : 'var(--text-2)', textDecoration: b.checked ? 'line-through' : 'none' })}
        </div>
      );
      case 'toggle': return (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span onClick={() => setBlocks(s => s.map(x => x.id === b.id ? { ...x, open: !x.open } : x))}
              style={{ marginTop: 4, cursor: 'pointer', transform: b.open ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-fast)', color: 'var(--text-3)' }}>
              <Icon name="chevron-right" size={16} color="currentColor" />
            </span>
            {editable(b, 'div', { flex: 1, fontSize: 16.5, lineHeight: 1.7, color: 'var(--text-1)' })}
          </div>
          {b.open && <div contentEditable suppressContentEditableWarning style={{ outline: 'none', marginLeft: 24, marginTop: 6, fontSize: 15, lineHeight: 1.7, color: 'var(--text-2)' }}>{b.child}</div>}
        </div>
      );
      case 'math': return <MathBlock tex={b.tex} autoEdit={b._new} onCommit={(t) => setBlocks(s => s.map(x => x.id === b.id ? { ...x, tex: t, _new: false } : x))} />;
      case 'code': return <CodeBlock code={b.code} lang={b.lang} autoEdit={b._new} onCommitCode={(c) => setBlocks(s => s.map(x => x.id === b.id ? { ...x, code: c, _new: false } : x))} />;
      case 'table': return <DataTable head={b.head} rows={b.rows} />;
      case 'image': return (
        b.src
          ? <img src={b.src} alt="" style={{ maxWidth: '100%', borderRadius: 'var(--r-md)', display: 'block', border: '1px solid var(--glass-border)' }} />
          : (
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 120, borderRadius: 'var(--r-md)', border: '1px dashed var(--line-strong)', color: 'var(--text-3)', cursor: 'pointer' }}>
              <Icon name="image" size={22} color="currentColor" /><span style={{ fontSize: 13 }}>拖入图片，或点击上传</span>
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setBlocks(s => s.map(x => x.id === b.id ? { ...x, src: rd.result } : x)); rd.readAsDataURL(f); }} />
            </label>
          )
      );
      case 'divider': return <div style={{ height: 1, background: 'var(--line-strong)', margin: '6px 0' }} />;
      default: return null;
    }
  };

  return (
    <div onContextMenu={(e) => e.preventDefault()} style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
      <sr-starfield density="0.4"></sr-starfield>

      {/* MIDDLE — editor */}
      <div ref={scrollRef} onMouseUp={onMouseUp} style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 52px 120px' }}>
          {/* top bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <Button variant="ghost" size="sm" icon="corner-up-left" onClick={onBack}>星图</Button>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap', flex: 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(con), boxShadow: `0 0 7px ${D.conColor(con)}` }} />{D.conName(con)}
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', flex: 'none' }}><Icon name="check" size={14} color="var(--gold)" />已自动保存</span>
            <IconButton name="star" active={fav} title={fav ? '已收藏 · 点击取消' : '收藏这颗星'} onClick={toggleFav} />
            <IconButton name="more-horizontal" title="更多" onClick={(e) => setMore({ x: e.clientX + 12, y: e.clientY + 10 })} />
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
            <Badge tone="gold">Lv.4</Badge>
          </div>

          {/* title */}
          <div contentEditable suppressContentEditableWarning data-ph="无标题"
            onBlur={(e) => {
              const t = e.currentTarget.textContent.trim();
              if (t && t !== star.label) { D.renameStar(star.id, t); bumpTick(); flash('已重命名'); }
              else if (!t) e.currentTarget.textContent = star.label;
            }}
            style={{ outline: 'none', fontSize: 32, fontWeight: 200, color: 'var(--text-1)', letterSpacing: '-0.01em', textShadow: 'var(--text-glow-cool)', marginBottom: 20, lineHeight: 1.2 }}>{star.label}</div>

          {/* properties (frontmatter) */}
          <Properties props={star.props = star.props || {}} onFlash={flash} onConfirm={setConfirm} onCommit={() => { D.touchNote(star.id); bumpTick(); }} />

          {/* blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, userSelect: dragBlk ? 'none' : 'auto' }} onMouseLeave={() => setHover(null)}>
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
                    : focusBlk === b.id ? '0 0 0 1.5px rgba(159,198,255,0.45), 0 0 14px rgba(159,198,255,0.12)' : 'none',
                  transition: 'background var(--dur-fast), opacity var(--dur-fast), box-shadow var(--dur-fast)' }}>
                <div style={{ position: 'absolute', left: -52, top: 1, display: 'flex', gap: 1, opacity: hover === b.id ? 1 : 0, transition: 'opacity var(--dur-fast)' }}>
                  <Handle icon="plus" title="在下方插入块" onClick={() => insertAfter(b.id)} />
                  <Handle icon="grip-vertical" title="拖动排序 · 点击打开菜单 · Alt+↑↓ 移动" onMouseDown={(e) => startDrag(e, b.id)} />
                </div>
                {renderInner(b)}
              </div>
            ))}
            {dragBlk && dropIdx === blocks.length && <div style={{ height: 2, background: 'var(--gold)', borderRadius: 1, boxShadow: 'var(--glow-gold-soft)' }} />}
          </div>

        </div>
      </div>

      {/* RIGHT — knowledge rail */}
      <aside style={{ width: 312, flex: 'none', borderLeft: '1px solid var(--glass-border)', background: 'var(--glass-bg)', WebkitBackdropFilter: 'blur(var(--glass-blur))', backdropFilter: 'blur(var(--glass-blur))', overflow: 'auto', position: 'relative', zIndex: 2 }}>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <section>
            <RailHead icon="list-tree" title="大纲" />
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div onClick={() => scrollRef.current && scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })}
                style={{ padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 13, color: 'var(--text-1)', borderLeft: '2px solid var(--gold)' }}>{star.label}</div>
              {outline.map(o => (
                <div key={o.id} onClick={() => scrollToBlock(o.id)}
                  style={{ padding: '5px 10px', paddingLeft: o.type === 'h3' ? 30 : 18, borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-2)', borderLeft: '2px solid var(--line)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,198,255,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{o.live}</div>
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
                    <button type="button" title="断开连接" onClick={() => removeConnection(l)}
                      style={{ marginLeft: l.kind === 'cross' ? 6 : 'auto', flex: 'none', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)', opacity: hoverConn === i ? 1 : 0, transition: 'opacity var(--dur-fast)' }}>
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
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: linkStar.con === con ? 'var(--star-blue)' : 'var(--gold)' }}>{linkStar.con === con ? '同一星座' : '融会贯通'}</span>
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
                          <div key={s.id} onClick={() => { setLinkStar(s); setRelDraft(''); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(s.con), boxShadow: `0 0 6px ${D.conColor(s.con)}` }} />
                            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{s.label}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-3)' }}>{D.conName(s.con)}</span>
                          </div>
                        ))}
                      </div>
                      <div onClick={resetLinking} style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', borderTop: '1px solid var(--line)' }}>取消</div>
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
            <div style={{ marginTop: 10, padding: 14, borderRadius: 'var(--r-md)', background: 'rgba(255,217,138,0.05)', border: '1px solid rgba(255,217,138,0.18)' }}>
              <MemoryBar value={star.strength} showPct />
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 12, color: 'var(--text-2)' }}>
                <Icon name="calendar-clock" size={14} color="var(--gold)" />遗忘曲线预计 <b style={{ color: 'var(--gold)', fontWeight: 500 }}>{(star.props && star.props.nextReview) || '6 天后'}</b> 复习
              </div>
            </div>
          </section>
          <section>
            <RailHead icon="crosshair" title="在星图中定位" />
            <div style={{ marginTop: 10, height: 132, borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', position: 'relative', overflow: 'hidden', background: 'radial-gradient(120% 100% at 40% 40%, rgba(26,35,80,0.5), transparent 60%)' }}>
              {D.stars.map(s => (
                <span key={s.id} data-tip={s.id === star.id ? undefined : s.label}
                  onClick={s.id === star.id ? undefined : () => onOpen && onOpen(s.id)}
                  style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%,-50%)',
                    width: s.id === star.id ? 8 : 5, height: s.id === star.id ? 8 : 5, borderRadius: '50%',
                    background: s.id === star.id ? 'var(--gold)' : (s.strength > 0.7 ? '#ffe096' : '#9fc6ff'),
                    boxShadow: s.id === star.id ? '0 0 10px var(--gold)' : 'none', opacity: s.id === star.id ? 1 : 0.55,
                    cursor: s.id === star.id ? 'default' : 'pointer' }} />
              ))}
            </div>
          </section>
        </div>
      </aside>

      {/* status bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 312, zIndex: 3, display: 'flex', alignItems: 'center', gap: 18, padding: '7px 24px', borderTop: '1px solid var(--line)', background: 'var(--glass-bg-strong)', WebkitBackdropFilter: 'blur(var(--glass-blur))', backdropFilter: 'blur(var(--glass-blur))', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="layout-list" size={13} color="currentColor" />{blocks.length} 块</span>
        <span>{charCount} 字</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="clock" size={13} color="currentColor" />约 {readMin} 分钟阅读</span>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="command" size={13} color="currentColor" />⌘P 命令</span>
        <span>Markdown</span>
        <span>UTF-8</span>
      </div>

      {/* overlays */}
      {ctx && <ContextMenu x={ctx.x} y={ctx.y} constellations={D.constellations} onClose={() => setCtx(null)} onAction={act(ctx.id)} />}
      {slash && <SlashMenu x={slash.x} y={slash.y} onClose={() => setSlash(null)}
        onPick={(t) => { if (slash.inline) withSynced(s => s.map(bb => bb.id === slash.id ? { ...bb, type: t, text: '' } : bb)); else insertAfter(slash.id, t); setSlash(null); }} />}
      {more && <EditorMoreMenu x={more.x} y={more.y} fav={fav} constellations={D.constellations} onAction={pageAction} onClose={() => setMore(null)} />}
      {history && <HistoryDialog star={star} onClose={() => setHistory(false)} onFlash={flash} />}
      {sel && !ctx && <SelectionToolbar x={sel.x} y={sel.y} onFormat={runFormat} onLink={formatLink} onColor={() => { setColorPop({ x: sel.x, y: sel.y + 10 }); }} />}
      {colorPop && <ColorMenu x={colorPop.x} y={colorPop.y} onClose={() => setColorPop(null)} onPick={(c) => { if (c.kind === 'text') runFormat('foreColor', c.exec); else runFormat('hiliteColor', c.exec); setColorPop(null); }} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 95, animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
          <GlassPanel strong radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px' }}>
            <Icon name="check" size={16} color="var(--gold)" /><span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{toast}</span>
          </GlassPanel>
        </div>
      )}

      {confirm && <ConfirmDialog message={confirm.message} confirmLabel={confirm.confirmLabel} onYes={() => { confirm.onYes(); setConfirm(null); }} onClose={() => setConfirm(null)} />}
      {linkDialog && <LinkDialog onSubmit={applyLink} onClose={() => setLinkDialog(null)} />}
    </div>
  );
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
