/* 星图 Stellar Raft — 代码高亮器（codehl.js）单元测试
   编辑器代码块的分词器：纯字符串实现、不碰 DOM，import 后从 globalThis.SR_HL 取 API。

   最要紧的一条不变量是「无损」——高亮只该给字符上色，绝不能吞掉或改写任何一个字符。
   其余覆盖：未知语言全 plain · 关键字/函数名/数字/字符串/注释的归类 ·
   跨行块注释的状态机 · 字符串里的转义与伪关键字 · 语言清单与样例的一致性。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../ui_kits/stellar-raft/codehl.js';

const { tokenize, DEFS, SAMPLES, LANGS, GENERIC } = globalThis.SR_HL;

// 把一行的 token 拼回字符串
const joinLine = (toks) => toks.map(t => t.t).join('');
// 取某一类的全部文本
const ofClass = (toks, c) => toks.filter(t => t.c === c).map(t => t.t);

/* 无损：拼回来必须与原文逐行相等。空行是唯一的例外——它被顶成一个空格，
   否则高亮层里那一行会塌掉、行号跟着错位。 */
function assertLossless(code, lang) {
  const lines = String(code).split('\n');
  const out = tokenize(code, lang);
  assert.equal(out.length, lines.length, `${lang}：行数必须一一对应`);
  lines.forEach((line, i) => {
    assert.equal(joinLine(out[i]), line === '' ? ' ' : line, `${lang} 第 ${i + 1} 行被改写了`);
  });
}

test('无损：任何语言分词后拼回原文，一个字符都不少', () => {
  const code = 'def f(x):\n    s = "a\\"b"  # 注释里也有 def\n\n    return x * 2';
  for (const lang of ['python', 'javascript', 'c++', 'sql', 'yaml', 'plaintext', '', 'no-such-lang']) {
    assertLossless(code, lang);
  }
});

test('无损：内置的每一份语言样例都能原样拼回', () => {
  for (const [lang, sample] of Object.entries(SAMPLES)) assertLossless(sample, lang);
  assertLossless(GENERIC, 'python');
});

test('未知语言（含 plaintext）：整行一个 plain token，不做任何着色', () => {
  for (const lang of ['plaintext', 'text', 'txt', 'log', '', undefined, 'klingon']) {
    const out = tokenize('def f(): return "x"  # c', lang);
    assert.equal(out[0].length, 1, `${lang} 不该被分词`);
    assert.equal(out[0][0].c, 'plain');
  }
});

test('归类：关键字 / 调用名 / 数字 / 字符串 / 行注释各归各位', () => {
  const [line] = tokenize('const n = compute(0x1f, "字面量");  // 说明', 'javascript');
  assert.deepEqual(ofClass(line, 'kw'), ['const']);
  assert.deepEqual(ofClass(line, 'fn'), ['compute'], '后面跟着 ( 的标识符算函数名');
  assert.deepEqual(ofClass(line, 'num'), ['0x1f']);
  assert.deepEqual(ofClass(line, 'str'), ['"字面量"']);
  assert.deepEqual(ofClass(line, 'com'), ['// 说明']);
  assert.ok(ofClass(line, 'plain').includes('n'), '普通变量名保持 plain');
});

test('字符串：转义引号不提前收尾，里面的关键字不被当关键字', () => {
  const [line] = tokenize('x = "a\\"return\\" b" + y', 'javascript');
  assert.deepEqual(ofClass(line, 'str'), ['"a\\"return\\" b"']);
  assert.deepEqual(ofClass(line, 'kw'), [], '引号里的 return 只是文本');
});

test('未闭合的字符串：吃到行尾就收手，不把下一行也卷进去', () => {
  const out = tokenize('s = "没关引号\nreturn 1', 'javascript');
  assert.deepEqual(ofClass(out[0], 'str'), ['"没关引号']);
  assert.deepEqual(ofClass(out[1], 'kw'), ['return'], '下一行照常分词');
});

test('块注释的跨行状态机：开在上一行，关在下一行', () => {
  const out = tokenize('a = 1; /* 开始\n中间 return 2\n结束 */ b = 3;', 'c');
  assert.deepEqual(ofClass(out[0], 'num'), ['1'], '注释之前照常分词');
  assert.deepEqual(ofClass(out[0], 'com'), ['/* 开始']);
  assert.equal(out[1].every(t => t.c === 'com'), true, '注释内部整行都是注释');
  assert.deepEqual(ofClass(out[2], 'com'), ['结束 */']);
  assert.deepEqual(ofClass(out[2], 'num'), ['3'], '注释闭合之后恢复分词');
});

test('同一行内开合的块注释不会把后面的代码吞掉', () => {
  const [line] = tokenize('int x = /* 注 */ 42;', 'c');
  assert.deepEqual(ofClass(line, 'com'), ['/* 注 */']);
  assert.deepEqual(ofClass(line, 'num'), ['42']);
  assert.deepEqual(ofClass(line, 'kw'), ['int']);
});

test('注释符号按语言各认各的：# 之于 Python、-- 之于 SQL、// 不是它俩的', () => {
  assert.deepEqual(ofClass(tokenize('x = 1  # 注释', 'python')[0], 'com'), ['# 注释']);
  assert.deepEqual(ofClass(tokenize('SELECT 1 -- 注释', 'sql')[0], 'com'), ['-- 注释']);
  assert.deepEqual(ofClass(tokenize('x = 1  // 不是注释', 'python')[0], 'com'), []);
});

test('别名指向同一份语言定义：js/jsx/mjs 与 javascript 同源', () => {
  for (const alias of ['js', 'jsx', 'mjs']) assert.equal(DEFS[alias], DEFS.javascript);
  for (const alias of ['py']) assert.equal(DEFS[alias], DEFS.python);
  assert.equal(DEFS.JS, undefined, '大小写由 tokenize 归一，DEFS 本身只收小写');
  assert.deepEqual(ofClass(tokenize('const a = 1', 'JavaScript')[0], 'kw'), ['const'], '语言名大小写不敏感');
});

test('清单一致性：样例里的语言都在下拉列表里，列表里的语言要么有定义要么是有意的纯文本', () => {
  const PLAIN_ON_PURPOSE = new Set(['plaintext', 'text', 'txt', 'log', 'diff', 'csv', 'env']);
  for (const lang of Object.keys(SAMPLES)) {
    assert.ok(LANGS.includes(lang), `样例语言 ${lang} 不在下拉列表里`);
  }
  for (const lang of LANGS) {
    assert.ok(DEFS[lang] || PLAIN_ON_PURPOSE.has(lang), `${lang} 既没有语法定义，也不在「有意纯文本」名单里`);
  }
  assert.equal(new Set(LANGS).size, LANGS.length, '下拉列表不该有重复项');
});
