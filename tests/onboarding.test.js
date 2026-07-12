/* 星图 Stellar Raft — 新手引导（Onboarding.jsx）结构性自检
   React 组件在这里没法做单元测试（app 是浏览器端 Babel 编译的 JSX，没有构建产物可
   import），所以本测试只对源码文本做结构性断言，守住关键回归点：
   注册到 SRKit / 11 页大纲齐全 / 无 emoji / 聚光锚点与宿主页面对齐。 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ONB = read('ui_kits/stellar-raft/Onboarding.jsx');

test('Onboarding 注册 Onboarding 与 OnboardingTour 到 SRKit', () => {
  // 锚定到实际的注册语句本身，而不是零散地匹配函数名——后者哪怕从
  // Object.assign 的第二个参数里被删掉，函数声明依然存在，测试仍会通过。
  assert.match(
    ONB,
    /window\.SRKit\s*=\s*Object\.assign\(\s*window\.SRKit\s*\|\|\s*\{\}\s*,\s*\{\s*Onboarding\s*,\s*OnboardingTour\s*\}\s*\)/
  );
});

test('导览册恰好 11 页，每页字段完整', () => {
  // 只在 SR_GUIDE_PAGES 数组本体内计数，避免 SR_TOUR_STEPS（聚光步骤，也有
  // title/body 字段，但没有 id）把 title/body 的计数灌水到 11 以上。
  const block = ONB.match(/const SR_GUIDE_PAGES = \[([\s\S]*?)\n\];/);
  assert.ok(block, '找不到 SR_GUIDE_PAGES 数组定义');
  const pages = block[1];

  const ids = pages.match(/\bid:\s*'[a-z]+'/g) || [];
  assert.equal(ids.length, 11, '期望 11 页，实得 ' + ids.length);
  // 每页应有 title 与 body
  const titles = pages.match(/\btitle:\s*'/g) || [];
  const bodies = pages.match(/\bbody:\s*'/g) || [];
  assert.equal(titles.length, 11);
  assert.equal(bodies.length, 11);
});

test('无 emoji / 无杂色（品牌律）', () => {
  // 基本 emoji 区段扫描
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(ONB), 'Onboarding.jsx 含 emoji');
});

test('聚光锚点在源码中成对存在', () => {
  assert.match(ONB, /\[data-tour="search"\]/);
  assert.match(ONB, /\[data-tour="review"\]/);
  assert.match(ONB, /\[data-tour="tools"\]/);
  assert.match(read('ui_kits/stellar-raft/Sidebar.jsx'), /data-tour="search"/);
  assert.match(read('ui_kits/stellar-raft/Sidebar.jsx'), /dataTour="review"/);
  assert.match(read('ui_kits/stellar-raft/StarMap.jsx'), /data-tour="tools"/);
});
