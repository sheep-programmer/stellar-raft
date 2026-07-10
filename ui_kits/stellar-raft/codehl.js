/* codehl.js — lightweight, language-aware syntax highlighter for the editor's
   code block. window.SR_HL = { DEFS, SAMPLES, GENERIC, LANGS, tokenize }.
   tokenize(code, lang) → array of lines, each an array of {t, c} tokens where
   c ∈ kw|fn|str|num|com|plain. Unknown language (no DEF) → everything plain. */
(function () {
  if (window.SR_HL) return;

  const DEFS = {};
  // def(aliases, keywords, lineComment, [blockOpen, blockClose])
  const def = (names, kw, line, block) => {
    const d = { kw: kw ? kw.trim().split(/\s+/) : [], line: line || null, block: block || null };
    names.split(' ').forEach(n => { DEFS[n] = d; });
  };

  const JS = 'function var let const return if else for while do switch case break continue new class extends super this typeof instanceof in of try catch finally throw async await yield import export default from null undefined true false void delete static get set';

  def('python py', 'def class return if elif else for while import from as with try except finally lambda yield pass break continue in is not and or None True False global nonlocal raise assert del async await match case', '#');
  def('javascript js jsx mjs', JS, '//', ['/*', '*/']);
  def('typescript ts tsx', JS + ' interface type enum implements public private protected readonly namespace declare as keyof infer never unknown any string number boolean abstract', '//', ['/*', '*/']);
  def('java', 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed yield', '//', ['/*', '*/']);
  def('c h', 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while inline restrict _Bool NULL', '//', ['/*', '*/']);
  def('c++ cpp cc cxx hpp hxx', 'alignas alignof auto bool break case catch char class const constexpr const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator private protected public register reinterpret_cast return short signed sizeof static static_cast struct switch template this throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while', '//', ['/*', '*/']);
  def('c# csharp cs', 'abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile while async await record nameof when', '//', ['/*', '*/']);
  def('go golang', 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false iota make len cap append', '//', ['/*', '*/']);
  def('rust rs', 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while box', '//', ['/*', '*/']);
  def('ruby rb', 'def class module return if elsif else unless while until for in do begin rescue ensure end yield self nil true false and or not then case when next break redo retry raise require require_relative attr_accessor attr_reader attr_writer puts lambda proc', '#');
  def('php', 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield true false null', '//', ['/*', '*/']);
  def('swift', 'associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch false is nil rethrows super self throw throws true try some any actor await async', '//', ['/*', '*/']);
  def('kotlin kt kts', 'abstract as break by catch class companion const continue crossinline data do dynamic else enum external false final finally for fun if import in infix init inline inner interface internal is lateinit lazy null object open operator out override package private protected public reified return sealed super suspend this throw true try typealias val var vararg when where while', '//', ['/*', '*/']);
  def('scala', 'abstract case catch class def do else extends false final finally for forSome if implicit import lazy match new null object override package private protected return sealed super this throw trait true try type val var while with yield given using', '//', ['/*', '*/']);
  def('dart', 'abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for get if implements import in interface is late library mixin new null on operator part required rethrow return set static super switch sync this throw true try typedef var void while with yield', '//', ['/*', '*/']);
  def('r', 'if else for while repeat function return break next in TRUE FALSE NULL NA Inf NaN library require function', '#');
  def('julia jl', 'function return if elseif else for while begin end do try catch finally module using import export struct mutable abstract type quote let global local const in isa where true false nothing missing', '#', ['#=', '=#']);
  def('haskell hs', 'module where import data type newtype class instance deriving do let in if then else case of forall infix infixl infixr', '--', ['{-', '-}']);
  def('elixir ex exs', 'def defp defmodule defmacro do end fn if else unless case cond when for with try rescue catch after raise import alias require use quote unquote true false nil', '#');
  def('erlang erl', 'after begin case catch cond end fun if let of receive try when andalso orelse div rem band bor bxor bnot', '%');
  def('clojure clj cljs edn', 'def defn defmacro let if when cond do fn loop recur ns require import true false nil defrecord defprotocol', ';');
  def('lisp scheme scm el', 'define lambda let let* letrec if cond case when unless begin set! quote quasiquote do defun defvar defmacro setq', ';');
  def('lua', 'and break do else elseif end false for function goto if in local nil not or repeat return then true until while', '--', ['--[[', ']]']);
  def('perl pl pm', 'sub my our local if elsif else unless while until for foreach do return last next use require package print say wantarray defined undef', '#');
  def('sql', 'select from where insert into values update set delete create table alter drop index view join inner left right outer full on group by order having distinct as and or not null is in between like exists limit offset union all primary key foreign references default count sum avg min max case when then else end asc desc with', '--', ['/*', '*/']);
  def('bash sh shell zsh', 'if then else elif fi for while do done case esac function in select until return local export readonly declare echo exit source alias unset set test trap shift', '#');
  def('powershell ps1 pwsh', 'function param if else elseif switch foreach for while do until return break continue try catch finally throw begin process end filter class enum in', '#', ['<#', '#>']);
  def('fish', 'if else end for while function return break continue switch case set echo', '#');
  def('latex tex', 'documentclass usepackage begin end section subsection subsubsection paragraph textbf textit emph item frac sum int prod label ref cite newcommand renewcommand includegraphics caption', '%');
  def('matlab octave', 'function end if elseif else for while switch case otherwise break continue return try catch global persistent true false parfor', '%', ['%{', '%}']);
  def('dockerfile', 'FROM RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL AS', '#');
  def('makefile make mk', 'ifeq ifneq ifdef ifndef else endif define endef include export', '#');
  def('graphql gql', 'query mutation subscription type input enum interface union scalar schema fragment on implements extend directive true false null', '#');
  def('solidity sol', 'contract library interface function modifier event error struct enum mapping address uint uint256 int bytes bool string public private external internal pure view payable returns return if else for while do break continue new delete emit require revert assert try catch memory storage calldata constant immutable constructor using is import pragma true false', '//', ['/*', '*/']);
  def('objective-c objectivec objc m mm', 'interface implementation protocol property synthesize end if else for while do switch case break continue return void id self super nil YES NO BOOL NSString NSInteger int float double char new class static const instancetype atomic nonatomic strong weak copy assign retain', '//', ['/*', '*/']);
  def('fortran f f90 f95 f03', 'program end subroutine function module use implicit none integer real complex character logical if then else elseif endif do while enddo call return stop print write read allocate deallocate true false', '!');
  def('vim viml', 'function endfunction if else elseif endif for endfor while endwhile let call return set au autocmd nnoremap inoremap', '"');
  def('assembly asm nasm s', 'mov push pop call ret jmp je jne jg jl cmp add sub mul div inc dec and or xor not lea int section global extern db dw dd resb', ';');
  def('groovy', 'def class return if else for while switch case break continue try catch finally throw new import package as in true false null assert', '//', ['/*', '*/']);
  def('nim', 'proc func method iterator template macro var let const type object enum if elif else case of for while block break continue return discard import include export true false nil', '#', ['#[', ']#']);
  def('crystal cr', 'def class module struct return if elsif else unless while until for in do begin rescue ensure end yield self nil true false require puts case when', '#');
  def('zig', 'const var fn pub return if else while for switch break continue defer errdefer try catch struct enum union comptime inline export extern test true false null undefined', '//');
  def('css', '', null, ['/*', '*/']);
  def('scss less sass', '', '//', ['/*', '*/']);
  def('html xml svg vue svelte', '', null, ['<!--', '-->']);
  def('yaml yml', '', '#');
  def('toml', '', '#');
  def('ini cfg conf', '', ';');
  def('json json5 jsonc', '', null, ['/*', '*/']);
  def('markdown md mdx', '', null);
  // 'plaintext'/'text' intentionally NOT defined → renders plain.

  const idword = /[A-Za-z_$À-￿]/;
  const idword2 = /[A-Za-z0-9_$À-￿]/;

  function tokenize(code, lang) {
    const d = DEFS[(lang || '').toLowerCase()];
    const lines = String(code).split('\n');
    if (!d) return lines.map(l => [{ t: l || ' ', c: 'plain' }]); // unknown → no highlight
    const kw = new Set(d.kw);
    const lc = d.line, bc = d.block;
    const out = []; let inBlock = false;
    for (const line of lines) {
      const toks = []; let i = 0; const n = line.length;
      const push = (t, c) => { if (t) toks.push({ t, c }); };
      while (i < n) {
        if (inBlock) {
          const end = bc ? line.indexOf(bc[1], i) : -1;
          if (end < 0) { push(line.slice(i), 'com'); i = n; }
          else { push(line.slice(i, end + bc[1].length), 'com'); i = end + bc[1].length; inBlock = false; }
          continue;
        }
        const ch = line[i];
        if (bc && line.startsWith(bc[0], i)) {
          const end = line.indexOf(bc[1], i + bc[0].length);
          if (end < 0) { push(line.slice(i), 'com'); i = n; inBlock = true; }
          else { push(line.slice(i, end + bc[1].length), 'com'); i = end + bc[1].length; }
          continue;
        }
        if (lc && line.startsWith(lc, i)) { push(line.slice(i), 'com'); i = n; continue; }
        if (ch === '"' || ch === "'" || ch === '`') {
          let j = i + 1; while (j < n && line[j] !== ch) { if (line[j] === '\\') j++; j++; }
          push(line.slice(i, Math.min(j + 1, n)), 'str'); i = Math.min(j + 1, n); continue;
        }
        if (ch >= '0' && ch <= '9') {
          let j = i; while (j < n && /[0-9a-fA-FxX._]/.test(line[j])) j++;
          push(line.slice(i, j), 'num'); i = j; continue;
        }
        if (idword.test(ch)) {
          let j = i; while (j < n && idword2.test(line[j])) j++;
          const word = line.slice(i, j);
          let c = 'plain';
          if (kw.has(word)) c = 'kw';
          else { let k = j; while (k < n && line[k] === ' ') k++; if (line[k] === '(') c = 'fn'; }
          push(word, c); i = j; continue;
        }
        push(ch, 'plain'); i++;
      }
      out.push(toks.length ? toks : [{ t: ' ', c: 'plain' }]);
    }
    return out;
  }

  const SAMPLES = {
    python: `# 计算 CHSH 关联值 S\ndef chsh_s(E):\n    a, ap, b, bp = E.angles()\n    return E(a,b) - E(a,bp) + E(ap,b) + E(ap,bp)\n\n# |S| <= 2 为定域极限；量子上界 2√2`,
    javascript: `// 计算 CHSH 关联值 S\nfunction chshS(E) {\n  const { a, ap, b, bp } = E.angles();\n  return E(a,b) - E(a,bp) + E(ap,b) + E(ap,bp);\n}\nconsole.log(chshS(exp) <= 2);`,
    typescript: `// CHSH 关联值（带类型）\ninterface Angles { a: number; b: number }\nfunction chshS(E: Correlator): number {\n  const { a, ap, b, bp } = E.angles();\n  return E(a,b) - E(a,bp) + E(ap,b) + E(ap,bp);\n}`,
    java: `// 计算 CHSH 关联值\npublic class Bell {\n    static double chshS(Correlator E) {\n        return E.v(0,0) - E.v(0,1) + E.v(1,0) + E.v(1,1);\n    }\n}`,
    'c++': `// 计算 CHSH 关联值\n#include <cmath>\ndouble chsh_s(const Correlator& E) {\n    return E(0,0) - E(0,1) + E(1,0) + E(1,1);  // |S| <= 2\n}`,
    c: `/* 计算 CHSH 关联值 */\ndouble chsh_s(Correlator *E) {\n    return E->v[0] - E->v[1] + E->v[2] + E->v[3];\n}`,
    'c#': `// 计算 CHSH 关联值\npublic static double ChshS(Correlator E) {\n    return E[0,0] - E[0,1] + E[1,0] + E[1,1];\n}`,
    go: `// 计算 CHSH 关联值\nfunc chshS(E Correlator) float64 {\n    return E(0,0) - E(0,1) + E(1,0) + E(1,1)\n}`,
    rust: `// 计算 CHSH 关联值\nfn chsh_s(e: &Correlator) -> f64 {\n    let (a, ap, b, bp) = e.angles();\n    e(a,b) - e(a,bp) + e(ap,b) + e(ap,bp)\n}`,
    ruby: `# 计算 CHSH 关联值\ndef chsh_s(e)\n  a, ap, b, bp = e.angles\n  e[a,b] - e[a,bp] + e[ap,b] + e[ap,bp]\nend`,
    php: `<?php\n// 计算 CHSH 关联值\nfunction chsh_s($E) {\n    return $E(0,0) - $E(0,1) + $E(1,0) + $E(1,1);\n}`,
    swift: `// 计算 CHSH 关联值\nfunc chshS(_ E: Correlator) -> Double {\n    return E(0,0) - E(0,1) + E(1,0) + E(1,1)\n}`,
    kotlin: `// 计算 CHSH 关联值\nfun chshS(E: Correlator): Double {\n    return E(0,0) - E(0,1) + E(1,0) + E(1,1)\n}`,
    sql: `-- 查询变暗的知识星\nSELECT title, strength FROM stars\nWHERE strength < 0.4\nORDER BY strength ASC\nLIMIT 10;`,
    bash: `#!/bin/bash\n# 备份星图数据\nfor f in stars/*.json; do\n  cp "$f" "backup/$(basename $f)"\ndone\necho "完成"`,
    html: `<!-- 一颗知识星 -->\n<div class="star" data-strength="0.95">\n  <span class="label">贝尔不等式</span>\n</div>`,
    css: `/* 发光的知识星 */\n.star {\n  border-radius: 50%;\n  box-shadow: 0 0 24px rgba(255,217,138,0.6);\n}`,
    json: `{\n  "star": "贝尔不等式",\n  "strength": 0.95,\n  "links": ["纠缠态", "叠加原理"]\n}`,
    latex: `% CHSH 不等式\n\\begin{equation}\n  S = E(a,b) - E(a,b') + E(a',b) + E(a',b')\n\\end{equation}`,
    haskell: `-- 计算 CHSH 关联值\nchshS :: Correlator -> Double\nchshS e = e a b - e a bp + e ap b + e ap bp\n  where (a, ap, b, bp) = angles e`,
    lua: `-- 计算 CHSH 关联值\nlocal function chsh_s(E)\n  local a, ap, b, bp = E:angles()\n  return E(a,b) - E(a,bp) + E(ap,b) + E(ap,bp)\nend`,
  };

  const GENERIC = `greeting = "Hello, 星图"\nitems = [1, 2, 3, 5, 8, 13]\ntotal = sum(items)\nprint(greeting, total)`;

  // ordered display list for the dropdown
  const LANGS = ['python', 'javascript', 'typescript', 'java', 'c', 'c++', 'c#', 'go', 'rust',
    'ruby', 'php', 'swift', 'kotlin', 'scala', 'dart', 'r', 'julia', 'haskell', 'elixir', 'erlang',
    'clojure', 'lisp', 'lua', 'perl', 'groovy', 'nim', 'crystal', 'zig', 'objective-c', 'fortran',
    'matlab', 'sql', 'bash', 'powershell', 'fish', 'graphql', 'solidity', 'dockerfile', 'makefile',
    'assembly', 'vim', 'html', 'css', 'scss', 'xml', 'yaml', 'toml', 'ini', 'json', 'markdown', 'latex',
    'plaintext', 'text', 'txt', 'log', 'diff', 'csv', 'env'];

  window.SR_HL = { DEFS, SAMPLES, GENERIC, LANGS, tokenize };
})();
