/* 星图 Stellar Raft — Markdown 核心（mdcore.js）单元测试
   纯字符串实现，import 后从 globalThis.SRMd 取 API。覆盖：块解析（围栏 / 缩进
   代码 / 嵌套列表 / 待办 / 表格 / 起始序号）、frontmatter 解析、行内打字转换
   （matchInline，含不误伤场景）、导出序列化与 round-trip。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../ui_kits/stellar-raft/sanitize.js';
import '../ui_kits/stellar-raft/mdcore.js';

const { parseMdBlocks, parseFrontmatter, matchInline, blocksToMd, mdInline } = globalThis.SRMd;

test('parseMdBlocks：标题 / 引用 / 分割线 / 段落', () => {
  const bs = parseMdBlocks('# 一\n\n> 引用\n\n---\n\n正文 **粗**');
  assert.deepEqual(bs.map(b => b.type), ['h1', 'quote', 'divider', 'p']);
  assert.ok(bs[3].text.includes('<b>粗</b>'));
});

test('parseMdBlocks：代码围栏，末尾孤立 ``` 不产生空块', () => {
  const bs = parseMdBlocks('```python\nprint(1)\n```\n\n后文\n```');
  assert.equal(bs[0].type, 'code');
  assert.equal(bs[0].lang, 'python');
  assert.equal(bs[0].code, 'print(1)');
  assert.equal(bs[bs.length - 1].type, 'p');
});

test('parseMdBlocks：嵌套列表保留缩进层级（不再压平）', () => {
  const bs = parseMdBlocks('- 一级\n  - 二级\n    - 三级\n- 又一级');
  assert.deepEqual(bs.map(b => b.type), ['bulleted', 'bulleted', 'bulleted', 'bulleted']);
  assert.deepEqual(bs.map(b => b.indent || 0), [0, 1, 2, 0]);
});

test('parseMdBlocks：缩进的待办与有序列表也保留层级与勾选', () => {
  const bs = parseMdBlocks('1. 第一\n2. 第二\n  1. 子项\n- [x] 已完成\n  - [ ] 子待办');
  assert.deepEqual(bs.map(b => b.type), ['numbered', 'numbered', 'numbered', 'todo', 'todo']);
  assert.equal(bs[1].start, 2);
  assert.equal(bs[2].indent, 1);
  assert.equal(bs[3].checked, true);
  assert.equal(bs[4].indent, 1);
  assert.equal(bs[4].checked, false);
});

test('parseMdBlocks：非列表的 4 空格缩进段仍识别为 plaintext 代码块', () => {
  const bs = parseMdBlocks('说明：\n\n    def hello():\n        return 1');
  assert.equal(bs[0].type, 'p');
  assert.equal(bs[1].type, 'code');
  assert.equal(bs[1].lang, 'plaintext');
  assert.ok(bs[1].code.includes('def hello():'));
  assert.ok(bs[1].code.includes('    return 1'), '相对缩进保留');
});

test('parseMdBlocks：表格与任意起始序号', () => {
  const bs = parseMdBlocks('| a | b |\n| --- | --- |\n| 1 | 2 |\n\n3. 从三开始');
  assert.equal(bs[0].type, 'table');
  assert.deepEqual(bs[0].head, ['a', 'b']);
  assert.deepEqual(bs[0].rows, [['1', '2']]);
  assert.equal(bs[1].type, 'numbered');
  assert.equal(bs[1].start, 3);
});

test('mdInline：链接协议白名单', () => {
  assert.ok(mdInline('[官网](https://example.com)').includes('href="https://example.com"'));
  const bad = mdInline('[点我](javascript:alert(1))');
  assert.ok(!bad.includes('href'), 'javascript: 降级为纯文本');
  assert.ok(bad.includes('点我'));
});

test('parseFrontmatter：属性与 tags 回填，body 剥离', () => {
  const r = parseFrontmatter('---\ntype: 定理\nstatus: 融会贯通\ntags: [物理, 量子]\n---\n\n正文');
  assert.equal(r.props.type, '定理');
  assert.equal(r.props.status, '融会贯通');
  assert.deepEqual(r.tags, ['物理', '量子']);
  assert.equal(r.body.trim(), '正文');
});

test('parseFrontmatter：无 frontmatter 时原样返回', () => {
  const r = parseFrontmatter('# 直接正文');
  assert.equal(r.props, null);
  assert.equal(r.body, '# 直接正文');
});

test('matchInline：**粗** / *斜* / `码` / ~~删~~ 就地转换', () => {
  assert.deepEqual(matchInline('前文 **加粗**'), { len: 6, html: '<b>加粗</b>' });
  assert.equal(matchInline('说 *斜体*').html, '<i>斜体</i>');
  assert.ok(matchInline('用 `code`').html.startsWith('<code'));
  assert.equal(matchInline('~~删除~~').html, '<s>删除</s>');
});

test('matchInline：不误伤——未闭合 / 空内容 / ** 的一半 / 星号乘法留空格', () => {
  assert.equal(matchInline('**没闭合'), null);
  assert.equal(matchInline('****'), null);
  assert.equal(matchInline('a * b *'), null, '内容以空格开头不转斜体');
  assert.equal(matchInline('普通文字'), null);
  const bold = matchInline('**x**');
  assert.equal(bold.html, '<b>x</b>', '完整 ** 对不会被斜体规则拆半');
});

test('matchInline：内容做 HTML 转义', () => {
  assert.equal(matchInline('**<img onerror=1>**').html, '<b>&lt;img onerror=1&gt;</b>');
});

test('blocksToMd：frontmatter + 各块型序列化', () => {
  const md = blocksToMd([
    { type: 'h2', text: '小节' },
    { type: 'todo', checked: true, text: '完成' },
    { type: 'todo', checked: false, text: '待办' },
    { type: 'bulleted', text: '一级' },
    { type: 'bulleted', text: '二级', indent: 1 },
    { type: 'numbered', text: '从五开始', start: 5 },
    { type: 'code', lang: 'go', code: 'x := 1' },
  ], { title: '测试星', props: { type: '定理', status: '—' }, tags: ['a', 'b'] });
  assert.ok(md.startsWith('---\ntype: 定理\n'), 'frontmatter 在最前，— 空值跳过');
  assert.ok(md.includes('tags: [a, b]'));
  assert.ok(md.includes('# 测试星'));
  assert.ok(md.includes('## 小节'));
  assert.ok(md.includes('- [x] 完成'));
  assert.ok(md.includes('- [ ] 待办'));
  assert.ok(md.includes('\n  - 二级'), '嵌套列表带 2 空格缩进');
  assert.ok(md.includes('5. 从五开始'));
  assert.ok(md.includes('```go\nx := 1\n```'));
});

test('blocksToMd：行内格式与非法链接协议过滤', () => {
  const md = blocksToMd([
    { type: 'p', text: '有 <b>粗</b> 和 <s>删</s> 与 <a href="javascript:1">坏链</a> 和 <a href="https://e.com">好链</a>' },
  ], {});
  assert.ok(md.includes('**粗**'));
  assert.ok(md.includes('~~删~~'));
  assert.ok(!md.includes('javascript:'));
  assert.ok(md.includes('[好链](https://e.com)'));
});

test('round-trip：导出再导入，结构保真', () => {
  const src = [
    { type: 'h1', text: '标题' },
    { type: 'bulleted', text: '一级' },
    { type: 'bulleted', text: '二级', indent: 1 },
    { type: 'todo', checked: true, text: '做完了' },
    { type: 'numbered', text: '第一' },
    { type: 'code', lang: 'python', code: 'print(1)' },
  ];
  const back = parseMdBlocks(blocksToMd(src, {}));
  assert.deepEqual(back.map(b => b.type), ['h1', 'bulleted', 'bulleted', 'todo', 'numbered', 'code']);
  assert.equal(back[2].indent, 1);
  assert.equal(back[3].checked, true);
  assert.equal(back[5].code, 'print(1)');
});
