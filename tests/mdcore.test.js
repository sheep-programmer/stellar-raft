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
  assert.ok(md.includes('tags: ["a","b"]'));
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

/* --------------------- 真实 GFM 适配补齐 --------------------- */

test('行内：\\* 转义按字面、***粗斜体***、带题链接、<自动链接>', () => {
  const h = mdInline('\\*字面\\* 与 5 0 5 ***强调*** [题](https://a.b "注") <https://z.dev>');
  assert.ok(h.includes('*字面*'), '反斜杠转义按字面输出');
  assert.ok(h.includes('5 0 5'), '普通数字文本不被占位符误伤');
  assert.ok(h.includes('<b><i>强调</i></b>'));
  assert.ok(h.includes('href="https://a.b"'));
  assert.ok(h.includes('href="https://z.dev"'));
});

test('parseMdBlocks：独行图片 → image 块；javascript: 协议降级为段落', () => {
  const bs = parseMdBlocks('![示意](https://a.b/x.png "题注")\n\n![x](javascript:alert(1))');
  assert.equal(bs[0].type, 'image');
  assert.equal(bs[0].src, 'https://a.b/x.png');
  assert.equal(bs[0].alt, '示意');
  assert.equal(bs[1].type, 'p');
});

test('parseMdBlocks：#### 及更深折入 h3；Setext === 标题', () => {
  const bs = parseMdBlocks('#### 四级\n###### 六级\n\n大标题\n===');
  assert.deepEqual(bs.map(b => b.type), ['h3', 'h3', 'h1']);
});

test('parseMdBlocks：GFM 提示框 [!NOTE]/[!TIP] → callout，吸收续行', () => {
  const bs = parseMdBlocks('> [!NOTE]\n> 第一行\n> 第二行\n\n> 普通引用');
  assert.equal(bs[0].type, 'callout');
  assert.equal(bs[0].tone, 'blue');
  assert.ok(bs[0].text.includes('第一行') && bs[0].text.includes('第二行'));
  assert.equal(bs[1].type, 'quote');
  const tip = parseMdBlocks('> [!TIP] 一句话提示');
  assert.equal(tip[0].tone, 'gold');
});

test('parseMdBlocks：<details> → toggle，与导出互逆', () => {
  const bs = parseMdBlocks('<details>\n<summary>折叠标题</summary>\n\n里面的内容\n</details>');
  assert.equal(bs[0].type, 'toggle');
  assert.ok(bs[0].text.includes('折叠标题'));
  assert.ok(bs[0].child.includes('里面的内容'));
});

test('表格：单元格含 | 导出转义、导入归位（round-trip）', () => {
  const md = blocksToMd([{ id: 'x', type: 'table', head: ['A|B', 'C'], rows: [['a|b', 'c\nd']] }]);
  assert.ok(md.includes('A\\|B'), '导出转义竖线');
  assert.ok(!/c\nd/.test(md.split('\n').find(l => l.includes('c'))), '单元格换行折为空格');
  const back = parseMdBlocks(md);
  assert.equal(back[0].type, 'table');
  assert.deepEqual(back[0].head, ['A|B', 'C']);
  assert.deepEqual(back[0].rows, [['a|b', 'c d']]);
});

test('段落防歧义：以 # / - / 1. / --- 开头的正文 round-trip 后仍是段落', () => {
  const blocks = [
    { id: 'a', type: 'p', text: '# 不是标题' },
    { id: 'b', type: 'p', text: '- 不是列表' },
    { id: 'c', type: 'p', text: '1. 不是有序项' },
    { id: 'd', type: 'p', text: '---' },
  ];
  const back = parseMdBlocks(blocksToMd(blocks));
  assert.deepEqual(back.map(b => b.type), ['p', 'p', 'p', 'p']);
  assert.ok(back[0].text.includes('# 不是标题'));
  assert.ok(back[3].text.includes('---'));
});

test('callout / toggle / 图片 round-trip：类型与内容都回得来', () => {
  const blocks = [
    { id: 'a', type: 'callout', tone: 'blue', text: '要点标注' },
    { id: 'b', type: 'callout', tone: 'gold', text: '一个技巧' },
    { id: 'c', type: 'toggle', text: '展开看', child: '藏起来的话' },
    { id: 'd', type: 'image', alt: '星图', src: 'https://a.b/star.png' },
  ];
  const md = blocksToMd(blocks);
  assert.ok(md.includes('[!NOTE]') && md.includes('[!TIP]'), 'GitHub 需要大写提示框标记');
  const back = parseMdBlocks(md);
  assert.deepEqual(back.map(b => b.type), ['callout', 'callout', 'toggle', 'image']);
  assert.equal(back[0].tone, 'blue');
  assert.equal(back[1].tone, 'gold');
  assert.ok(back[2].child.includes('藏起来的话'));
  assert.equal(back[3].src, 'https://a.b/star.png');
});

test('图片导出：小 dataURL 内联（合法 Markdown），超大降级为无空格占位', () => {
  const small = blocksToMd([{ id: 'a', type: 'image', alt: 'x', src: 'data:image/png;base64,AAAA' }]);
  assert.ok(small.includes('](data:image/png;base64,AAAA)'));
  const big = blocksToMd([{ id: 'b', type: 'image', alt: 'y', src: 'data:image/png;base64,' + 'A'.repeat(120000) }]);
  assert.ok(!big.includes('base64,AAA'), '超大不内联');
  assert.ok(!/\]\([^)]* [^)]*\)/.test(big), '占位 URL 不含空格');
});

test('行内代码含反引号：双反引号包裹，round-trip 不碎', () => {
  const md = blocksToMd([{ id: 'a', type: 'p', text: '看 <code>a`b</code> 这个' }]);
  assert.ok(md.includes('`` a`b ``'));
  const back = parseMdBlocks(md);
  assert.equal(back[0].type, 'p');
});

test('frontmatter：值含冒号加引号导出；块级 tags 列表也能读', () => {
  const md = blocksToMd([], { props: { source: 'MIT 8.04: Quantum Physics' }, tags: ['量子'] });
  assert.ok(/source: ".*"/.test(md), 'YAML 敏感值（ASCII 冒号）应加引号');
  const fm = parseFrontmatter('---\ntags:\n  - 量子\n  - 熵\nsource: "x: y"\n---\n正文');
  assert.deepEqual(fm.tags, ['量子', '熵']);
  assert.equal(fm.props.source, 'x: y');
  assert.equal(fm.body.trim(), '正文');
});

/* ——— 往返的三个破口（都会真的动到用户的内容）——— */

test('代码块里含 ``` ：围栏自动加长，内容不被自己的正文提前关掉', () => {
  /* 「知识笔记」里贴一段 Markdown 示例是常事。固定三个反引号的话，内容里那行
     ``` 会把代码块提前关掉，导出再导入就被劈成三块、中间的代码丢掉。 */
  const code = 'print("a")\n```\nprint("b")';
  const md = blocksToMd([{ id: 'c', type: 'code', lang: 'python', code }], {});
  assert.match(md, /^````python\n/, '围栏要比内容里最长的那串反引号更长');
  const back = parseMdBlocks(md).filter(b => b.type === 'code');
  assert.equal(back.length, 1, '应当还是一个代码块，而不是被劈开');
  assert.equal(back[0].code, code, '内容要一字不差地回来');
  assert.equal(back[0].lang, 'python', '语言别被围栏那一组吃掉');

  // 更长的也要跟着长
  const deep = '``````\nx';
  const md2 = blocksToMd([{ id: 'c', type: 'code', lang: '', code: deep }], {});
  assert.equal(parseMdBlocks(md2).find(b => b.type === 'code').code, deep);
});

test('数字开头的段落：转义加在分隔符上（1\\. ），往返后一字不多', () => {
  /* 写成 `\1. ` 既护不住（真实解析器照样当成列表），导入时也还原不回来——
     ESCAPABLE 的字符集里没有数字，那个反斜杠会原样留在正文里。 */
  for (const t of ['1. 第一步是先把公式抄下来', '2) 另一种写法', '10. 第十步', '# 这不是标题', '- 这不是列表', '> 这不是引用', '| 这不是表格']) {
    const md = blocksToMd([{ id: 'p', type: 'p', text: t }], {});
    const back = parseMdBlocks(md).find(b => b.type === 'p');
    // 块正文存的是 HTML：字面量的 > < & 会以实体形式落在里面，比对前先还原
    const got = String((back && back.text) || '').replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    assert.equal(got, t, `段落往返不等价：${JSON.stringify(t)} -> ${JSON.stringify(got)}`);
  }
});

test('摘要不会每来回一次就在正文里多复制一遍', () => {
  /* 导出把摘要写成正文开头的第一段；导入时 parseVault 会把第一段认成摘要
     **并保留在正文里**。两边一叠加，每来回一次正文里就多一份摘要，无限增长。
     导出端认得出「第一段就是摘要本身」，于是不再多写一遍。 */
  const summary = '定域隐变量理论必须满足的一条上限。';
  // 真实的星，body 一律以 rich 块开头——摘要正是由它写出去的
  const body = [{ id: 'r', type: 'rich' }, { id: 'p0', type: 'p', text: summary }, { id: 'h', type: 'h2', text: 'CHSH 形式' }];
  const once = blocksToMd(body, { summary });
  assert.equal((once.match(/定域隐变量/g) || []).length, 1, '正文第一段已经是摘要时，不该再写一遍');

  // 第一段不是摘要时，摘要照常写在最前面（导出给别的编辑器看，摘要不能凭空消失）
  const other = blocksToMd([{ id: 'r', type: 'rich' }, { id: 'h', type: 'h2', text: '小节' }], { summary });
  assert.match(other, /^定域隐变量/);
});

test('dataURL 图片回导不蒸发：导出内联的小图，导入原样回来', () => {
  /* 导出端把 ≤100KB 的本地图片以 dataURL 内联（合法 Markdown），但导入端的
     协议白名单曾把 data: 一概拒之门外——回导时整张图静默蒸发，正文只剩 "!x"。
     现在 image 块单独放行 data:image/*;base64。 */
  const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const md = blocksToMd([{ id: 'b1', type: 'image', alt: '像素', src: img }], {});
  const back = parseMdBlocks(md);
  assert.equal(back[0].type, 'image');
  assert.equal(back[0].src, img);
  assert.equal(back[0].alt, '像素');
  // data: 的其它形态（非图片/非 base64）仍然拒收——开口只给图片
  const evil = parseMdBlocks('![x](data:text/html;base64,PHNjcmlwdD4=)');
  assert.equal(evil[0].type, 'p');
});

test('超限图片占位：回导成一段读得懂的说明，而不是一张永久裂图', () => {
  const md = blocksToMd([{ id: 'b1', type: 'image', alt: '大图', src: 'data:image/png;base64,' + 'A'.repeat(100001) }], {});
  assert.ok(!md.includes('](') || !/!\[[^\]]*\]\((?!>)/.test(md.split('\n').find(l => l.includes('100KB')) || ''), '占位不能写成图片语法');
  const back = parseMdBlocks(md);
  assert.equal(back[0].type, 'quote');
  assert.match(back[0].text, /100KB/);
});

test('多行块 round-trip：引用 / 列表 / 待办 / 标注的续行不再掉出结构', () => {
  /* htmlToMd 把 <br> 还原成 \n，但导出曾只给首行加结构前缀——回导时第二行起
     掉出结构变成独立段落，块被静默拆开。导出端逐行补前缀，导入端把续行并回。 */
  const blocks = [
    { id: 'q', type: 'quote', text: '第一行<br>第二行' },
    { id: 'b', type: 'bulleted', text: '甲<br>甲续' },
    { id: 'n', type: 'numbered', text: '乙<br>乙续' },
    { id: 't', type: 'todo', checked: true, text: '丙<br>丙续' },
    { id: 'c', type: 'callout', tone: 'blue', text: '丁<br>丁续' },
  ];
  const md = blocksToMd(blocks, {});
  assert.match(md, /> 第一行\n> 第二行/, '引用续行也要带 > 前缀');
  assert.match(md, /- 甲\n {2}甲续/, '列表续行缩进到与首行文字对齐');
  const back = parseMdBlocks(md);
  assert.deepEqual(back.map(b => b.type), ['quote', 'bulleted', 'numbered', 'todo', 'callout'],
    '五种多行块回导后仍各是一块，不散架');
  for (const [i, frag] of [[0, '第二行'], [1, '甲续'], [2, '乙续'], [3, '丙续'], [4, '丁续']]) {
    assert.ok(back[i].text.includes(frag), `${back[i].type} 丢了续行 ${frag}`);
  }
  // 嵌套列表项不被误吞成续行；父项的续行（导出端写在嵌套项之前）照常并回
  const nested = parseMdBlocks('- 父\n  续行\n  - 子');
  assert.equal(nested.length, 2);
  assert.equal(nested[1].indent, 1);
  assert.ok(nested[0].text.includes('续行'));
});

test('BOM 与空 frontmatter：Windows 记事本的文件不再丢 tags，空 --- 不变双分隔线', () => {
  const bom = parseFrontmatter('\uFEFF---\ntags: ["a"]\n---\n正文');
  assert.deepEqual(bom.tags, ['a']);
  assert.equal(bom.body.trim(), '正文');
  const emp = parseFrontmatter('---\n---\n正文');
  assert.equal(emp.props, null);
  assert.equal(emp.body.trim(), '正文');
});
