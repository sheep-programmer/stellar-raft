/* 星图 Stellar Raft — README 与仓库现状的一致性测试

   README 是这个项目对外的门面，里面那些数字（几个测试套件、几个组件原语）
   一向靠手改，于是最容易悄悄过期——曾经长期停在「18 个套件 236 项」，而实际
   早就不是了。这里把「文档里写的」和「磁盘上真有的」对上，让漂移在 CI 里当场暴露。

   中英两份 README 的同一处数字也互相对齐：只改了一边，同样算漂移。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ZH = read('README.md');
const EN = read('README.en.md');

// 从文本里把某个模式的第 1 个捕获组全部取出来，转成数字
const nums = (src, re) => [...src.matchAll(re)].map(m => Number(m[1]));
// 一组数字必须彼此相等，返回那个公共值
const same = (list, what) => {
  assert.ok(list.length > 0, `没在 README 里找到${what}`);
  assert.equal(new Set(list).size, 1, `${what}在几处写得不一样：${list.join(' / ')}`);
  return list[0];
};

test('README 里的套件数 = tests/ 下真实的测试文件数（中英两份都算）', () => {
  const onDisk = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.js')).length;

  const zhSuites = same([
    ...nums(ZH, /（(\d+) 个套件 \d+ 项）/g),
    ...nums(ZH, /(\d+) 个套件 \d+ 项 \|/g),
    ...nums(ZH, /node --test：(\d+) 个套件/g),
  ], '中文 README 的套件数');
  const enSuites = same([
    ...nums(EN, /\((\d+) suites, \d+ tests\)/g),
    ...nums(EN, /(\d+) suites, \d+ tests \|/g),
    ...nums(EN, /node --test: (\d+) suites/g),
  ], '英文 README 的套件数');

  assert.equal(zhSuites, onDisk, `中文 README 写着 ${zhSuites} 个套件，tests/ 下实际有 ${onDisk} 个`);
  assert.equal(enSuites, onDisk, `英文 README 写着 ${enSuites} 个套件，tests/ 下实际有 ${onDisk} 个`);
});

test('README 里的测试项数：徽章与正文、中文与英文，四处口径一致', () => {
  const counts = [
    ...nums(ZH, /tests-(\d+)%20passing/g),
    ...nums(ZH, /（\d+ 个套件 (\d+) 项）/g),
    ...nums(ZH, /\d+ 个套件 (\d+) 项 \|/g),
    ...nums(EN, /tests-(\d+)%20passing/g),
    ...nums(EN, /\(\d+ suites, (\d+) tests\)/g),
    ...nums(EN, /\d+ suites, (\d+) tests \|/g),
  ];
  assert.equal(counts.length, 6, '六处测试项数应当都还在（徽章 + 技术栈表 + 脚本表，各两份 README）');
  same(counts, '测试项数');
});

test('README 里的组件原语数 = components/ 下的 .jsx = 构建产物登记的组件数', () => {
  const groups = fs.readdirSync(path.join(ROOT, 'components'), { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
  const onDisk = groups
    .flatMap(g => fs.readdirSync(path.join(ROOT, 'components', g)).filter(f => f.endsWith('.jsx')))
    .length;
  const manifest = JSON.parse(read('_ds_manifest.json'));
  assert.equal(manifest.components.length, onDisk, '产物登记的组件数与磁盘对不上，跑一次 npm run build');

  const declared = same([
    ...nums(ZH, /components-(\d+)%20primitives/g),
    ...nums(ZH, /# (\d+) 个可复用原语/g),
    ...nums(ZH, /\*\*组件库\*\* — (\d+) 个原语/g),
    ...nums(EN, /components-(\d+)%20primitives/g),
    ...nums(EN, /# (\d+) reusable primitives/g),
    ...nums(EN, /\*\*Design system\*\* — (\d+) primitives/g),
  ], '组件原语数');
  assert.equal(declared, onDisk, `README 写着 ${declared} 个原语，components/ 下实际有 ${onDisk} 个`);
});

/* 出厂管理员那一组凭据：README 上写的就是新装库里真的那一组。
   这里最容易出的错不是写错，而是代码里改了默认值、两份 README 谁也没跟上——
   于是照着文档敲的人登不进去，或者更糟：以为换过了，其实那台服务器还开着出厂门。 */
test('README 写的出厂管理员凭据 = server/core.js 里真正的默认值', () => {
  const core = read('server/core.js');
  const user = core.match(/process\.env\.SR_ADMIN_USER \|\| '([^']+)'/);
  const pass = core.match(/process\.env\.SR_ADMIN_PASS \|\| '([^']+)'/);
  const min = core.match(/const ADMIN_PASS_MIN = (\d+);/);
  assert.ok(user && pass && min, 'core.js 里找不到出厂凭据或管理员密码下限');

  for (const [name, doc] of [['中文', ZH], ['英文', EN]]) {
    assert.ok(doc.includes('`' + user[1] + '`'), `${name} README 没写出厂用户名 ${user[1]}`);
    assert.ok(doc.includes('`' + pass[1] + '`'), `${name} README 没写出厂密码 ${pass[1]}`);
    // 交接那一节承诺的密码下限，得和服务端校验的是同一个数
    assert.ok(new RegExp(`\\*\\*${min[1]} (位|characters)\\*\\*`).test(doc),
      `${name} README 里的管理员密码下限与 ADMIN_PASS_MIN=${min[1]} 对不上`);
  }
  // 前端交接卡上的提示同样不能各说各话
  const card = read('ui_kits/stellar-raft/AdminHandover.jsx');
  assert.ok(card.includes(`SR_ADMIN_PASS_MIN = ${min[1]}`), '交接卡上的密码下限与服务端对不上');
});

test('项目结构树里列出的每一项，磁盘上都真的存在', () => {
  // 认「画着项目结构的那一块」，而不是「第一块 ```text」——README 里不止一块
  const tree = ZH.split('```text').slice(1).map(b => b.split('```')[0]).find(b => /^stellar-raft\/$/m.test(b.trim().split('\n')[0]));
  assert.ok(tree, '找不到项目结构树那一块 ```text');
  // 只认第一层（顶格两个缩进字符的那些行），形如 "├─ tokens/   # 说明"
  const entries = [...tree.matchAll(/^[├└]─ (\S+)/gm)].map(m => m[1]);
  assert.ok(entries.length >= 8, '结构树至少该列出八项，实际解析到 ' + entries.length);
  for (const e of entries) {
    assert.ok(fs.existsSync(path.join(ROOT, e)), `结构树里写了 ${e}，磁盘上却没有`);
  }
});

test('两份 README 的脚本表列的是同一批 npm script，且 package.json 里都有', () => {
  const scripts = Object.keys(JSON.parse(read('package.json')).scripts);
  const listed = (src) => [...src.matchAll(/\| `npm (?:run )?([\w:]+)` \|/g)].map(m => m[1]);
  const zh = listed(ZH), en = listed(EN);
  assert.deepEqual(zh, en, '中英两份 README 的脚本表对不上');
  assert.deepEqual([...zh].sort(), [...scripts].sort(), 'README 的脚本表与 package.json 对不上');
});
