/* 星图 Stellar Raft — Obsidian 仓库导出（vault.js）单元测试
   纯字节实现，import 后从 globalThis.SRVault 取 API。覆盖：zip 结构（本地头 /
   中央目录 / EOCD / CRC32 / UTF-8 标志）· 文件名卫生与去重 · wikilink 关联 ·
   README 索引 · frontmatter 走 SRMd 同一口径。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../ui_kits/stellar-raft/sanitize.js';
import '../ui_kits/stellar-raft/mdcore.js';
import '../ui_kits/stellar-raft/vault.js';

const { buildZip, buildVault, crc32, safeName } = globalThis.SRVault;

const rd16 = (b, p) => b[p] | (b[p + 1] << 8);
const rd32 = (b, p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
const dec = new TextDecoder();

/* 最小 zip 读取器（store 法）：从 EOCD 找中央目录，逐条取名与数据 */
function readZip(bytes) {
  let eocd = -1;
  for (let p = bytes.length - 22; p >= 0; p--) { if (rd32(bytes, p) === 0x06054b50) { eocd = p; break; } }
  assert.ok(eocd >= 0, '应有 EOCD 记录');
  const count = rd16(bytes, eocd + 10);
  let p = rd32(bytes, eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    assert.equal(rd32(bytes, p), 0x02014b50, '中央目录签名');
    const flags = rd16(bytes, p + 8);
    assert.ok(flags & 0x0800, '文件名应带 UTF-8 标志位');
    const crc = rd32(bytes, p + 16);
    const size = rd32(bytes, p + 24);
    const nameLen = rd16(bytes, p + 28);
    const extraLen = rd16(bytes, p + 30);
    const cmtLen = rd16(bytes, p + 32);
    const headerOffset = rd32(bytes, p + 42);
    const name = dec.decode(bytes.slice(p + 46, p + 46 + nameLen));
    // 本地头：定位数据段（store 法数据原样存放）
    assert.equal(rd32(bytes, headerOffset), 0x04034b50, '本地文件头签名');
    const lNameLen = rd16(bytes, headerOffset + 26);
    const lExtraLen = rd16(bytes, headerOffset + 28);
    const dataStart = headerOffset + 30 + lNameLen + lExtraLen;
    const data = bytes.slice(dataStart, dataStart + size);
    assert.equal(crc32(data), crc, name + ' 的 CRC32 应与目录一致');
    files[name] = dec.decode(data);
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}

const GALAXY = {
  account: { name: '林深' },
  constellations: [
    { id: 'qm', name: '量子力学' },
    { id: 'ma', name: '数学分析' },
  ],
  stars: [
    {
      id: 's1', con: 'qm', label: '薛定谔方程', tags: ['公式'], summary: '波函数如何演化',
      props: { type: '概念', source: 'MIT 8.04: Quantum' },
      body: [{ id: 'b1', type: 'h2', text: '定态解' }, { id: 'b2', type: 'p', text: '能级分立。' }],
    },
    { id: 's2', con: 'qm', label: '薛定谔方程', tags: [], summary: '', props: {}, body: [] },   // 同名星
    { id: 's3', con: 'ma', label: 'A/B: 极限*定义?', tags: [], summary: '', props: {}, body: [] }, // 脏字符
    { id: 's4', con: 'ghost', label: '孤儿星', tags: [], summary: '', props: {}, body: [] },       // 星域已删
  ],
  connections: [{ a: 's1', b: 's3', kind: 'cross', rel: '是其分析基础' }],
};

test('safeName：文件系统与 Obsidian 敏感字符全部剥离，空名回退', () => {
  assert.equal(safeName('A/B: 极限*定义?'), 'A B 极限 定义');
  assert.equal(safeName('a[b]#c^d|e'), 'a b c d e');
  assert.equal(safeName('   '), '未命名星');
  assert.equal(safeName('结尾点...'), '结尾点');
});

test('buildVault：每星一档按星域分夹、同名去重、孤儿星入未分域、README 索引齐全', () => {
  const entries = buildVault(GALAXY);
  const paths = entries.map(e => e.path);
  assert.ok(paths.includes('README.md'));
  assert.ok(paths.includes('量子力学/薛定谔方程.md'));
  assert.ok(paths.includes('量子力学/薛定谔方程 2.md'), '同名星追加序号');
  assert.ok(paths.includes('数学分析/A B 极限 定义.md'));
  assert.ok(paths.includes('未分域/孤儿星.md'), '星域已删的星落入未分域');
  const readme = entries.find(e => e.path === 'README.md').text;
  assert.ok(readme.includes('# 林深的星空'));
  assert.ok(readme.includes('[[薛定谔方程]]') && readme.includes('[[薛定谔方程 2]]'));
  assert.ok(readme.includes('## 未分域') && readme.includes('[[孤儿星]]'));
});

test('buildVault：正文走 SRMd 口径（frontmatter 敏感值加引号），关联为 wikilink', () => {
  const entries = buildVault(GALAXY);
  const star = entries.find(e => e.path === '量子力学/薛定谔方程.md').text;
  assert.ok(star.startsWith('---\n'), '有 frontmatter');
  assert.ok(/source: ".*"/.test(star), 'YAML 敏感值加引号');
  assert.ok(star.includes('tags: ["公式"]'));
  assert.ok(star.includes('# 薛定谔方程'), '标题为星名');
  assert.ok(star.includes('## 定态解'));
  assert.ok(star.includes('## 关联'));
  assert.ok(star.includes('[[A B 极限 定义]] — 是其分析基础'), 'wikilink 指向去重后的最终文件名');
});

test('buildZip：合法 zip——EOCD/中央目录/本地头/CRC 全对，中文件名 UTF-8，往返内容一致', () => {
  const entries = buildVault(GALAXY);
  const bytes = buildZip(entries, Date.UTC(2026, 6, 21, 12, 0, 0));
  assert.equal(rd32(bytes, 0), 0x04034b50, 'zip 以本地文件头开场');
  const files = readZip(bytes);
  assert.equal(Object.keys(files).length, entries.length);
  entries.forEach(e => assert.equal(files[e.path], e.text, e.path + ' 内容往返一致'));
});

test('buildZip：空清单也产出合法空 zip', () => {
  const bytes = buildZip([], 0);
  const files = readZip(bytes);
  assert.deepEqual(files, {});
});

/* --------------------- 反向导入：readZip + parseVault --------------------- */

test('readZip：读回自家 store 法 zip，路径与内容逐一还原', async () => {
  const entries = buildVault(GALAXY);
  const back = await globalThis.SRVault.readZip(buildZip(entries, 0));
  assert.equal(back.length, entries.length);
  entries.forEach(e => {
    const f = back.find(x => x.path === e.path);
    assert.ok(f, e.path + ' 应存在');
    assert.equal(f.text, e.text);
  });
});

test('parseVault：导出→导入往返——星域/星/标签/属性/连线全部还原，索引跳过、标题行掐掉', async () => {
  const entries = buildVault(GALAXY);
  const plan = globalThis.SRVault.parseVault(entries);
  assert.equal(plan.stars.length, 4, 'README 索引不算星');
  const conNames = plan.constellations.map(c => c.name).sort();
  assert.deepEqual(conNames, ['数学分析', '未分域', '量子力学']);
  const s1 = plan.stars.find(s => s.label === '薛定谔方程');
  assert.ok(s1);
  assert.deepEqual(s1.tags, ['公式']);
  assert.equal(s1.props.source, 'MIT 8.04: Quantum');
  assert.ok(!s1.body.some(bk => bk.type === 'h1'), '与文件名相同的标题行已掐掉');
  assert.ok(s1.body.some(bk => bk.type === 'h2'), '正文块保留');
  assert.ok(!s1.body.some(bk => stripAll(bk.text).includes('[[')), '关联小节不进正文');
  assert.equal(plan.connections.length, 1, 'wikilink 还原为连线');
  const c = plan.connections[0];
  const ids = [c.a, c.b].map(id => plan.stars.find(s => s.id === id).label).sort();
  assert.deepEqual(ids, ['A B 极限 定义', '薛定谔方程']);
  assert.equal(c.kind, 'cross');
  assert.equal(c.rel, '是其分析基础');
});

function stripAll(h) { return String(h == null ? '' : h).replace(/<[^>]*>/g, ''); }

test('parseVault：非自家仓库也能吃——散档归未分域、块级 tags、无关联小节', () => {
  const plan = globalThis.SRVault.parseVault([
    { path: '笔记.md', text: '---\ntags:\n  - 随笔\n---\n\n第一段是摘要。\n\n## 小节\n\n- 列表项\n' },
    { path: '物理/力学.md', text: '# 另一个标题\n\n内容。\n' },
  ]);
  assert.equal(plan.stars.length, 2);
  const loose = plan.stars.find(s => s.label === '笔记');
  assert.equal(plan.constellations.find(c => c.id === loose.con).name, '未分域');
  assert.deepEqual(loose.tags, ['随笔']);
  assert.equal(loose.summary, '第一段是摘要。');
  const mech = plan.stars.find(s => s.label === '力学');
  assert.ok(mech.body.some(bk => bk.type === 'h1'), '标题与文件名不同则保留');
});

/* ---------------- 导入侧的防爆闸 ----------------
   导入入口是「用户选中一个文件」，但文件本身可能来自任何地方。
   条目数与解压后总量都必须有界，否则一个 zip 炸弹就能把标签页内存吃光。 */

// 手工拼一条中央目录 + EOCD（count 可伪造），数据段可以不存在——
// 条目数检查发生在遍历之前
function zipWithClaimedCount(claimed) {
  const eocd = new Uint8Array(22);
  const dv = new DataView(eocd.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(10, claimed, true);   // 目录条目数（伪造）
  dv.setUint16(12, claimed, true);
  dv.setUint32(16, 0, true);         // 中央目录偏移
  return eocd;
}

test('readZip：条目数超过上限直接拒收（EOCD 声称 20001 条）', async () => {
  await assert.rejects(() => globalThis.SRVault.readZip(zipWithClaimedCount(20001)),
    /条目过多/);
});

// 拼一个 method=8（deflate）的 zip：真压缩、真解压，只是内容体积越线
async function deflateZip(payloadText) {
  const enc = new TextEncoder();
  const raw = enc.encode(payloadText);
  const cs = new CompressionStream('deflate-raw');
  const compressed = new Uint8Array(await new Response(
    new Blob([raw]).stream().pipeThrough(cs)).arrayBuffer());
  const name = enc.encode('big.md');
  const u16 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const cat = (arrs) => {
    const out = new Uint8Array(arrs.reduce((a, b) => a + b.length, 0));
    let p = 0; arrs.forEach(a => { out.set(a, p); p += a.length; });
    return out;
  };
  const local = cat([
    u32(0x04034b50), u16(20), u16(0x0800), u16(8),
    u16(0), u16(0), u32(0), u32(compressed.length), u32(raw.length),
    u16(name.length), u16(0), name, compressed,
  ]);
  const central = cat([
    u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8),
    u16(0), u16(0), u32(0), u32(compressed.length), u32(raw.length),
    u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), name,
  ]);
  const eocd = cat([
    u32(0x06054b50), u16(0), u16(0), u16(1), u16(1),
    u32(central.length), u32(local.length), u16(0),
  ]);
  return cat([local, central, eocd]);
}

test('readZip：deflate 条目正常解压（上限之内）', async () => {
  const text = '# 标题\n\n' + '内容。'.repeat(1000);
  const entries = await globalThis.SRVault.readZip(await deflateZip(text));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].path, 'big.md');
  assert.equal(entries[0].text, text);
});

test('readZip：解压后总量超过 64MB 拒绝（zip 炸弹防爆）', async () => {
  // 65MB 重复文本压完只有几十 KB——典型的炸弹形态
  const zip = await deflateZip('炸'.repeat(22 * 1024 * 1024));
  assert.ok(zip.length < 1024 * 1024, '压缩包本身很小，危险全在解压后');
  await assert.rejects(() => globalThis.SRVault.readZip(zip), /超过 64MB/);
}, { timeout: 30000 });

test('parseVault：正文里的星链接按 frontmatter 旧 id 重指到新 id，fav 随仓库往返', () => {
  /* 回导时每颗星拿全新随机 id，正文里的 stellar-raft://star/<旧id> 曾全部
     变成死链（只得到「这颗星已经不在星图里了」）。导出端把旧 id 写进
     frontmatter，导入端据此重建指向。 */
  const data = {
    stars: [
      { id: 'sA', con: 'c1', label: '甲星', fav: true, body: [{ id: 'r', type: 'rich' }, { id: 'p1', type: 'p', text: '去看 <a href="stellar-raft://star/sB" style="color:x">乙星</a>' }] },
      { id: 'sB', con: 'c1', label: '乙星', body: [{ id: 'r', type: 'rich' }, { id: 'p1', type: 'p', text: '内容' }] },
    ],
    constellations: [{ id: 'c1', name: '域一' }],
    connections: [{ a: 'sA', b: 'sB', rel: '参照' }],
    account: { name: '我' },
  };
  const plan = globalThis.SRVault.parseVault(globalThis.SRVault.buildVault(data));
  const a = plan.stars.find(s => s.label === '甲星');
  const b = plan.stars.find(s => s.label === '乙星');
  assert.equal(a.fav, true, 'fav 该随仓库往返');
  assert.equal(b.fav, undefined);
  assert.ok(a.body.some(bk => typeof bk.text === 'string' && bk.text.includes('stellar-raft://star/' + b.id)),
    '正文星链接要重指到新 id');
  assert.ok(!a.body.some(bk => typeof bk.text === 'string' && bk.text.includes('stellar-raft://star/sB')),
    '旧 id 不该残留');
  assert.equal(a.props.id, undefined, 'id/fav 是往返字段，不该混进用户 props');
  assert.equal(a.props.fav, undefined);
  assert.equal(plan.connections.length, 1, '连线照常按名重建');
  // 老导出文件（frontmatter 无 id）：行为与从前一致，不炸
  const legacy = globalThis.SRVault.parseVault([{ path: '域/X.md', text: '# X\n\n[链接](stellar-raft://star/sOld)\n' }]);
  assert.equal(legacy.stars.length, 1);
});

test('parseVault：「关联」小节只认文末最后一个，其后的外来内容不丢', () => {
  /* 外来仓库若恰好有同名小节，曾把其后到文末的全部正文（含无关小节）一起
     截掉。现在要求「之后再无其它标题」，且小节内不像连线条目的块留在正文。 */
  const foreign = [{ path: '域/X.md', text: '# X\n\n正文\n\n## 关联\n\n- [[别的星]] — 有关系\n\n这张表要活着\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n' }];
  const plan = globalThis.SRVault.parseVault(foreign);
  const x = plan.stars[0];
  assert.ok(x.body.some(bk => bk.type === 'table'), '关联小节后的表格不该被吞');
  assert.ok(!x.body.some(bk => typeof bk.text === 'string' && bk.text.includes('别的星')), '连线条目本身不留在正文');
  // 同名小节后面还有别的标题 → 那不是连线区，整个当正文
  const mid = globalThis.SRVault.parseVault([{ path: '域/Y.md', text: '# Y\n\n## 关联\n\n- [[谁]] — x\n\n## 后话\n\n还在\n' }]);
  const y = mid.stars[0];
  assert.ok(y.body.some(bk => typeof bk.text === 'string' && bk.text.includes('后话')), '中段的「关联」小节不构成截断点');
});
