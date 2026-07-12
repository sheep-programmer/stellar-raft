#!/usr/bin/env node
/* ============================================================================
   星图 Stellar Raft — design-system bundle builder
   ----------------------------------------------------------------------------
   Regenerates the two build artifacts (never edit those by hand):

     _ds_bundle.js     format-3 IIFE bundle:
                       · header comment `@ds-bundle` carries the metadata JSON
                         (format / namespace / components / sourceHashes /
                          inlinedExternals / unexposedExports)
                       · one `try { (() => { … })(); } catch …` section per
                         source file, so a broken file degrades gracefully and
                         reports into `<ns>.__errors`
                       · design-system components are collected on a private
                         `__ds_scope` and re-exported on the public namespace
                         `window.StellarRaftDesignSystem_2866af`
     _ds_manifest.json components / sourceHashes / cards kept in sync with the
                       files on disk (all other manifest keys are preserved).

   Reverse-engineered pipeline (verified byte-identical against the sections of
   the original bundle for every source file that is unchanged on disk):

     · included files: assets/starfield.js, components/<group>/*.jsx and the
       ui_kits app snapshot (*.jsx + data.js/codehl.js — api.js/tip.js stay
       excluded: they attach network/beforeunload side effects at load time and
       are always loaded live by index.html, bundling them would double-run
       those side effects)
     · every file (plain .js too) is passed through Babel — preset "react"
       (classic runtime, inline helpers) — so formatting is normalized
     · `import React …` / `import ReactDOM …` are dropped (globals at runtime),
       relative design-system imports are dropped and every reference to an
       imported name is rewritten to `__ds_scope.<name>`
     · `export` keywords are stripped; all exports of components/** files are
       appended as `Object.assign(__ds_scope, { … });`
     · section order = Kahn topological sort over the relative-import graph
       with lexicographic (repo-path) tie-break
     · sourceHashes = sha256(file bytes), hex, first 12 chars

   Usage:
     node scripts/build-bundle.mjs           # write _ds_bundle.js + manifest
     node scripts/build-bundle.mjs --check   # build in memory, exit 1 on drift
     node scripts/build-bundle.mjs --out DIR # write artifacts into DIR instead

   Zero native dependencies. Prefers the pinned devDependency
   @babel/standalone@7.29.0 (same version the ui-kit loads from the CDN, which
   is what makes the output byte-reproducible); if node_modules is missing it
   falls back to a tiny pure-JS JSX transformer (functionally equivalent, NOT
   byte-identical — a warning is printed).
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NAMESPACE = 'StellarRaftDesignSystem_2866af';
const BUNDLE_FORMAT = 3;
const BUNDLE_FILE = '_ds_bundle.js';
const MANIFEST_FILE = '_ds_manifest.json';
const DEFAULT_CARD_VIEWPORT = '700x420';

/* ui_kits files that must NOT be bundled: they run network / beforeunload
   side effects at top level and are always loaded live by index.html. */
const UI_KIT_DIR = 'ui_kits/stellar-raft';
const UI_KIT_EXCLUDE = new Set(['api.js', 'tip.js']);

/* Non-component exports that must still be re-exported on the public
   namespace (imperative helpers the cards / consumers call directly).
   Everything else that doesn't match its file basename stays private
   (`unexposedExports`, e.g. memoryColor). */
const EXPOSED_HELPERS = new Set(['components/overlay/Toast.jsx::toast']);

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const outIdx = args.indexOf('--out');
const OUT_DIR = outIdx >= 0 ? path.resolve(args[outIdx + 1] || ROOT) : ROOT;

/* --------------------------- small helpers ------------------------------- */

const rel = (p) => p.split(path.sep).join('/');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const sha12 = (p) =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex').slice(0, 12);

function listDir(dir, filter) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isFile() && filter(e.name))
    .map((e) => `${dir}/${e.name}`)
    .sort();
}

/* ------------------------------ file set --------------------------------- */

function collectSourceFiles() {
  const files = [];
  if (exists('assets/starfield.js')) files.push('assets/starfield.js');

  const compRoot = path.join(ROOT, 'components');
  if (fs.existsSync(compRoot)) {
    for (const group of fs.readdirSync(compRoot, { withFileTypes: true })) {
      if (!group.isDirectory()) continue;
      files.push(...listDir(`components/${group.name}`, (n) => n.endsWith('.jsx')));
    }
  }

  files.push(
    ...listDir(UI_KIT_DIR, (n) => (n.endsWith('.jsx') || n.endsWith('.js')) && !UI_KIT_EXCLUDE.has(n)),
  );

  return files.sort();
}

/* --------------------------- import scanning ------------------------------ */

const IMPORT_RE = /^[ \t]*import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]\s*;?/gm;

function relativeImports(file, code) {
  const deps = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;
    const resolved = rel(path.normalize(path.join(path.dirname(file), spec)));
    deps.push(resolved);
  }
  return deps;
}

/* Kahn topological sort, lexicographic tie-break (matches original bundle). */
function topoSort(files, sources) {
  const inSet = new Set(files);
  const deps = new Map(); // file -> deps inside the set
  const dependents = new Map();
  for (const f of files) {
    const d = relativeImports(f, sources.get(f)).filter((x) => inSet.has(x));
    deps.set(f, new Set(d));
    for (const x of d) {
      if (!dependents.has(x)) dependents.set(x, []);
      dependents.get(x).push(f);
    }
  }
  const ready = files.filter((f) => deps.get(f).size === 0).sort();
  const out = [];
  while (ready.length) {
    const f = ready.shift();
    out.push(f);
    for (const dep of dependents.get(f) || []) {
      const s = deps.get(dep);
      s.delete(f);
      if (s.size === 0) {
        ready.push(dep);
        ready.sort();
      }
    }
  }
  if (out.length !== files.length) {
    throw new Error('circular import between: ' + files.filter((f) => !out.includes(f)).join(', '));
  }
  return out;
}

/* ------------------------------ compilers --------------------------------- */

let Babel = null;
try {
  Babel = require('@babel/standalone');
} catch {
  console.warn(
    '[build-bundle] WARN @babel/standalone not installed (run `npm install`); ' +
      'falling back to the built-in JSX transformer — output is functionally ' +
      'equivalent but not byte-identical to the reference bundle.',
  );
}

/**
 * Babel plugin: strip ESM syntax the bundle-runtime way.
 *  - `import React/ReactDOM` dropped (they are globals);
 *  - relative imports dropped, referenced names rewritten to `__ds_scope.X`;
 *  - bare non-react imports are a build error (bundle keeps inlinedExternals=[]);
 *  - `export` stripped, exported names collected into `state.exports`.
 */
function dsModulePlugin({ types: t }) {
  return {
    visitor: {
      ImportDeclaration(p) {
        const src = p.node.source.value;
        if (src.startsWith('.')) {
          for (const spec of p.node.specifiers) {
            const exposed =
              spec.type === 'ImportSpecifier' ? spec.imported.name : spec.local.name;
            const binding = p.scope.getBinding(spec.local.name);
            if (!binding) continue;
            for (const ref of binding.referencePaths) {
              if (ref.node.type === 'JSXIdentifier') {
                ref.replaceWith(
                  t.jsxMemberExpression(t.jsxIdentifier('__ds_scope'), t.jsxIdentifier(exposed)),
                );
              } else {
                ref.replaceWith(
                  t.memberExpression(t.identifier('__ds_scope'), t.identifier(exposed)),
                );
              }
            }
          }
        } else if (!/^react(-dom)?(\/|$)/.test(src)) {
          throw p.buildCodeFrameError(
            `unsupported bare import "${src}" — the bundle inlines no externals`,
          );
        }
        p.remove();
      },
      ExportNamedDeclaration(p, state) {
        const decl = p.node.declaration;
        if (decl) {
          if (decl.id) state.opts.exports.push(decl.id.name);
          else if (decl.declarations) {
            for (const d of decl.declarations) if (d.id.name) state.opts.exports.push(d.id.name);
          }
          decl.leadingComments = p.node.leadingComments;
          p.replaceWith(decl);
        } else {
          for (const spec of p.node.specifiers) state.opts.exports.push(spec.local.name);
          p.remove();
        }
      },
      ExportDefaultDeclaration(p) {
        throw p.buildCodeFrameError('default exports are not supported by the ds bundle');
      },
    },
  };
}

function compileWithBabel(file, code) {
  const exports = [];
  const res = Babel.transform(code, {
    filename: file,
    presets: [['react', {}]],
    plugins: [[dsModulePlugin, { exports }]],
    babelrc: false,
    configFile: false,
    compact: false,
    comments: true,
  });
  return { code: res.code, exports };
}

/* ---- fallback: dependency-free JSX transformer (no Babel available) ------ */
/* Handles the subset of JSX used by this repo: elements, fragments, member
   expressions, spread props, expression children/attrs, nested JSX. Plain JS
   passes through untouched (no reformatting). */

function fallbackCompile(file, code) {
  const exports = [];
  let src = code.replace(IMPORT_RE, (m, spec) => {
    if (!spec.startsWith('.') && !/^react(-dom)?(\/|$)/.test(spec)) {
      throw new Error(`${file}: unsupported bare import "${spec}"`);
    }
    return '';
  });
  // rewrite references to relatively-imported names
  for (const m of code.matchAll(/import\s*{([^}]*)}\s*from\s*['"](\.[^'"]*)['"]/g)) {
    for (const name of m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) {
      src = src.replace(new RegExp(`(?<![.\\w'"])${name}\\b`, 'g'), `__ds_scope.${name}`);
    }
  }
  src = src.replace(/^export\s+(function|const|let|class)/gm, (m, kw) => kw);
  for (const m of code.matchAll(/^export\s+(?:function|class)\s+([A-Za-z_$][\w$]*)/gm)) exports.push(m[1]);
  for (const m of code.matchAll(/^export\s+(?:const|let)\s+([A-Za-z_$][\w$]*)/gm)) exports.push(m[1]);
  return { code: transformJsx(src).trimEnd(), exports };
}

function transformJsx(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = skipString(src, i);
      out += src.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      out += src.slice(i, end < 0 ? src.length : end);
      i = end < 0 ? src.length : end;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i) + 2;
      out += src.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && jsxLikely(out)) {
      // 正则字面量（与 JSX 相同的启发式：运算数位置的 '/' 是正则而非除号）
      const end = skipRegex(src, i);
      out += src.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '<' && /[A-Za-z_>$]/.test(src[i + 1] || '') && jsxLikely(out)) {
      const [expr, next] = parseJsx(src, i);
      out += expr;
      i = next;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function jsxLikely(before) {
  const t = before.trimEnd();
  if (!t) return true;
  const c = t[t.length - 1];
  if (/[\w$)\]]/.test(c)) {
    // could be `return`/`=>`/keyword — check last word
    const m = t.match(/([A-Za-z_$][\w$]*)$/);
    if (m && ['return', 'default', 'do', 'else', 'typeof', 'case', 'in', 'of', 'yield', 'await', 'void', 'new'].includes(m[1]))
      return true;
    return false;
  }
  return true;
}

function skipRegex(src, i) {
  // i 指向开头的 '/'；返回正则字面量（含 flags）之后的下标
  let j = i + 1;
  let inClass = false;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') j += 2;
    else if (c === '[') {
      inClass = true;
      j++;
    } else if (c === ']') {
      inClass = false;
      j++;
    } else if (c === '/' && !inClass) {
      j++;
      while (j < src.length && /[a-z]/i.test(src[j])) j++;
      return j;
    } else if (c === '\n') return i + 1; // 不是正则（换行终止），按除号处理
    else j++;
  }
  return j;
}

function skipString(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') j += 2;
    else if (src[j] === q) return j + 1;
    else if (q === '`' && src[j] === '$' && src[j + 1] === '{') {
      let depth = 1;
      j += 2;
      while (j < src.length && depth) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        else if (src[j] === '"' || src[j] === "'" || src[j] === '`') j = skipString(src, j) - 1;
        j++;
      }
    } else j++;
  }
  return j;
}

function parseJsx(src, i) {
  // i points at '<'
  let j = i + 1;
  if (src[j] === '>') {
    // fragment
    const { children, end } = parseChildren(src, j + 1, '');
    return [wrapCreate('React.Fragment', 'null', children), end];
  }
  const nameM = /^[A-Za-z_$][\w$.-]*/.exec(src.slice(j));
  const tag = nameM[0];
  j += tag.length;
  const isComp = (/^[A-Z]|\./.test(tag) && !tag.includes('-')) || tag.startsWith('__ds_scope');
  const tagExpr = isComp ? tag : JSON.stringify(tag);
  const props = [];
  for (;;) {
    while (/\s/.test(src[j])) j++;
    if (src[j] === '/' && src[j + 1] === '>') return [wrapCreate(tagExpr, propsExpr(props), []), j + 2];
    if (src[j] === '>') break;
    if (src[j] === '{') {
      // spread
      const end = matchBrace(src, j);
      props.push({ spread: transformJsx(src.slice(j + 1, end - 1)).trim().replace(/^\.\.\./, '') });
      j = end;
      continue;
    }
    const am = /^[A-Za-z_$][\w$:-]*/.exec(src.slice(j));
    if (!am) throw new Error(`JSX parse error near: ${src.slice(j - 40, j + 40)}`);
    const aname = am[0];
    j += aname.length;
    if (src[j] === '=') {
      j++;
      if (src[j] === '"' || src[j] === "'") {
        const end = skipString(src, j);
        props.push({ name: aname, value: JSON.stringify(src.slice(j + 1, end - 1)) });
        j = end;
      } else if (src[j] === '{') {
        const end = matchBrace(src, j);
        props.push({ name: aname, value: transformJsx(src.slice(j + 1, end - 1)).trim() });
        j = end;
      }
    } else props.push({ name: aname, value: 'true' });
  }
  j++; // past '>'
  const { children, end } = parseChildren(src, j, tag);
  return [wrapCreate(tagExpr, propsExpr(props), children), end];
}

function parseChildren(src, i) {
  const children = [];
  let text = '';
  let j = i;
  const flush = () => {
    const t = text.replace(/\s*\n\s*/g, ' ').trim();
    if (t) children.push(JSON.stringify(t));
    text = '';
  };
  while (j < src.length) {
    if (src[j] === '<' && src[j + 1] === '/') {
      flush();
      const close = src.indexOf('>', j);
      return { children, end: close + 1 };
    }
    if (src[j] === '<' && /[A-Za-z_>$]/.test(src[j + 1] || '')) {
      flush();
      const [expr, next] = parseJsx(src, j);
      children.push(expr);
      j = next;
      continue;
    }
    if (src[j] === '{') {
      flush();
      const end = matchBrace(src, j);
      const inner = transformJsx(src.slice(j + 1, end - 1)).trim();
      if (inner && !inner.startsWith('/*')) children.push(inner);
      j = end;
      continue;
    }
    text += src[j];
    j++;
  }
  return { children, end: j };
}

function matchBrace(src, i) {
  let depth = 0;
  let j = i;
  while (j < src.length) {
    const c = src[j];
    if (c === '"' || c === "'" || c === '`') {
      j = skipString(src, j);
      continue;
    }
    if (c === '/' && src[j + 1] === '/') {
      j = src.indexOf('\n', j);
      continue;
    }
    if (c === '/' && src[j + 1] === '*') {
      j = src.indexOf('*/', j) + 2;
      continue;
    }
    if (c === '/') {
      const prev = src.slice(i, j).replace(/\s+$/, '').slice(-1);
      if (!/[\w$)\]]/.test(prev)) {
        j = skipRegex(src, j);
        continue;
      }
    }
    if (c === '<' && /[A-Za-z_>$]/.test(src[j + 1] || '') && depth > 0) {
      // nested JSX inside the expression — skip through it textually
      const [, next] = parseJsx(src, j);
      j = next;
      continue;
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) return j + 1;
    }
    j++;
  }
  throw new Error('unbalanced braces in JSX expression');
}

function propsExpr(props) {
  if (!props.length) return 'null';
  const hasSpread = props.some((p) => p.spread);
  const chunks = [];
  let current = [];
  for (const p of props) {
    if (p.spread) {
      if (current.length) {
        chunks.push('{' + current.join(', ') + '}');
        current = [];
      }
      chunks.push(p.spread);
    } else {
      const key = /^[A-Za-z_$][\w$]*$/.test(p.name) ? p.name : JSON.stringify(p.name);
      current.push(`${key}: ${p.value}`);
    }
  }
  if (current.length) chunks.push('{' + current.join(', ') + '}');
  if (!hasSpread) return chunks[0] || 'null';
  if (chunks.length === 1) return chunks[0];
  return `Object.assign({}, ${chunks.join(', ')})`;
}

function wrapCreate(tag, props, children) {
  const args = [tag, props, ...children];
  return `React.createElement(${args.join(', ')})`;
}

/* ------------------------------ bundling ---------------------------------- */

function buildBundle() {
  const files = collectSourceFiles();
  const sources = new Map(files.map((f) => [f, read(f)]));
  const ordered = topoSort(files, sources);

  const sections = [];
  const componentList = []; // {name, sourcePath} sorted by path later
  const unexposedExports = [];
  const exposedHelpers = []; // imperative helpers (EXPOSED_HELPERS) also re-exported
  const exposeNames = [];

  for (const file of ordered) {
    const compile = Babel ? compileWithBabel : fallbackCompile;
    const { code, exports } = compile(file, sources.get(file));
    let body = code;
    if (exports.length && file.startsWith('components/')) {
      body += `\nObject.assign(__ds_scope, { ${exports.join(', ')} });`;
      const base = path.basename(file).replace(/\.jsx?$/, '');
      for (const name of exports) {
        if (name === base) {
          componentList.push({ name, sourcePath: file });
          exposeNames.push(name);
        } else if (EXPOSED_HELPERS.has(`${file}::${name}`)) {
          exposedHelpers.push({ name, sourcePath: file });
        } else {
          unexposedExports.push({ name, sourcePath: file });
        }
      }
    }
    sections.push(
      `// ${file}\ntry { (() => {\n${body}\n})(); } catch (e) { __ds_ns.__errors.push({ path: ${JSON.stringify(
        file,
      )}, error: String((e && e.message) || e) }); }`,
    );
  }

  const byPath = (a, b) => (a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0);
  componentList.sort(byPath);
  unexposedExports.sort(byPath);
  exposedHelpers.sort(byPath);

  const sourceHashes = {};
  for (const f of [...files].sort()) sourceHashes[f] = sha12(f);

  const header = {
    format: BUNDLE_FORMAT,
    namespace: NAMESPACE,
    components: componentList,
    sourceHashes,
    inlinedExternals: [],
    unexposedExports,
  };
  if (exposedHelpers.length) header.exposedHelpers = exposedHelpers;

  const tail = [...componentList, ...exposedHelpers]
    .map((c) => `__ds_ns.${c.name} = __ds_scope.${c.name};`)
    .join('\n\n');

  const bundle =
    `/* @ds-bundle: ${JSON.stringify(header)} */\n\n` +
    `(() => {\n\n` +
    `const __ds_ns = (window.${NAMESPACE} = window.${NAMESPACE} || {});\n\n` +
    `const __ds_scope = {};\n\n` +
    `(__ds_ns.__errors = __ds_ns.__errors || []);\n\n` +
    sections.join('\n\n') +
    `\n\n${tail}\n\n})();\n`;

  return { bundle, componentList, sourceHashes };
}

/* ------------------------------ manifest ---------------------------------- */

function findCards() {
  const cards = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir || '.'), { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.card.html')) cards.push(p);
    }
  };
  walk('');
  return cards.sort();
}

const titleCase = (s) =>
  s
    .replace(/\.card\.html$/, '')
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

/* Card metadata source of truth is the `@dsCard` comment every card carries:
     <!-- @dsCard group="Components" viewport="700x460" name="Overlay" subtitle="…" -->
   Falls back to the existing manifest entry, then to <title>/<meta description>
   heuristics for cards that predate the convention. */
function cardMeta(p, existing) {
  const html = read(p);
  const ds = html.match(/<!--\s*@dsCard\s+([\s\S]*?)-->/);
  if (ds) {
    const attrs = {};
    for (const m of ds[1].matchAll(/(\w+)="([^"]*)"/g)) attrs[m[1]] = m[2];
    return {
      path: p,
      group: attrs.group || titleCase(path.basename(path.dirname(p))).split(' ')[0] || 'Misc',
      viewport: /^\d+x\d+$/.test(attrs.viewport || '') ? attrs.viewport : DEFAULT_CARD_VIEWPORT,
      subtitle: attrs.subtitle || '',
      name: attrs.name || titleCase(path.basename(p)),
    };
  }
  if (existing) return existing;
  const title = html.match(/<title>([^<]*)<\/title>/i);
  const desc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return {
    path: p,
    group: titleCase(path.basename(path.dirname(p))).split(' ')[0] || 'Misc',
    viewport: DEFAULT_CARD_VIEWPORT,
    subtitle: desc ? desc[1] : '',
    name: title ? title[1].trim() : titleCase(path.basename(p)),
  };
}

function updateManifest(componentList, sourceHashes) {
  const manifest = JSON.parse(read(MANIFEST_FILE));

  const existingCards = new Map((manifest.cards || []).map((c) => [c.path, c]));
  const onDisk = findCards();
  const cards = [];
  for (const p of onDisk) cards.push(cardMeta(p, existingCards.get(p)));
  // keep non-card entries (e.g. the ui_kits app) that still exist on disk
  for (const [p, card] of existingCards) {
    if (!p.endsWith('.card.html') && exists(p)) cards.push(card);
  }
  cards.sort((a, b) => (a.group + ' ' + a.path < b.group + ' ' + b.path ? -1 : 1));

  const next = {};
  for (const [k, v] of Object.entries(manifest)) {
    if (k === 'components') {
      next.components = componentList;
      next.sourceHashes = sourceHashes;
    } else if (k === 'sourceHashes') {
      // replaced above (keeps position on rebuilds)
      if (!next.sourceHashes) next.sourceHashes = sourceHashes;
    } else if (k === 'cards') {
      next.cards = cards;
    } else {
      next[k] = v;
    }
  }
  return JSON.stringify(next);
}

/* -------------------------------- main ------------------------------------ */

const { bundle, componentList, sourceHashes } = buildBundle();
const manifest = updateManifest(componentList, sourceHashes);

if (CHECK) {
  const drift = [];
  if (!exists(BUNDLE_FILE) || read(BUNDLE_FILE) !== bundle) drift.push(BUNDLE_FILE);
  if (!exists(MANIFEST_FILE) || read(MANIFEST_FILE) !== manifest) drift.push(MANIFEST_FILE);
  if (drift.length) {
    console.error('[build-bundle] STALE artifacts, rerun `npm run build`: ' + drift.join(', '));
    process.exit(1);
  }
  console.log('[build-bundle] artifacts up to date.');
} else {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, BUNDLE_FILE), bundle);
  fs.writeFileSync(path.join(OUT_DIR, MANIFEST_FILE), manifest);
  console.log(
    `[build-bundle] wrote ${BUNDLE_FILE} (${bundle.length} bytes, ${componentList.length} components) ` +
      `+ ${MANIFEST_FILE} → ${rel(path.relative(process.cwd(), OUT_DIR) || '.')}`,
  );
}
