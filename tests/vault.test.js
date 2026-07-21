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
  assert.ok(star.includes('tags: [公式]'));
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
