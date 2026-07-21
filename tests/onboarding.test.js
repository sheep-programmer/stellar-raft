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
  // 每页应有 title 与 body（值可以是字符串字面量，也可以是 SRKeys 拼接表达式——
  // 快捷键说法按系统变换后，部分 body 以 SRK.combo(...) 开头，不再强求紧跟引号）
  const titles = pages.match(/\btitle:\s*/g) || [];
  const bodies = pages.match(/\bbody:\s*/g) || [];
  assert.equal(titles.length, 11);
  assert.equal(bodies.length, 11);
});

test('无 emoji / 无杂色（品牌律）', () => {
  // 基本 emoji 区段扫描
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(ONB), 'Onboarding.jsx 含 emoji');
});

test('聚光锚点在源码中成对存在', () => {
  // 导览已升级为「自动走进每个板块实地展示」：每步带 view（宿主领航切换视图）
  // 与 target（视图内锚点）。这里从 SR_TOUR_STEPS 里解析出全部 (view, 锚点) 对，
  // 逐一核对锚点确实写在对应视图的源码里——拼写漂移会在这里直接报警。
  const block = ONB.match(/const SR_TOUR_STEPS = \[([\s\S]*?)\n\];/);
  assert.ok(block, '找不到 SR_TOUR_STEPS 数组定义');
  const steps = [...block[1].matchAll(/view:\s*'([a-z0-9]+)',\s*target:\s*'\[data-tour="([a-z0-9-]+)"\]'/g)]
    .map(m => ({ view: m[1], anchor: m[2] }));
  assert.equal(steps.length, 15, '期望 15 步实地导览，实得 ' + steps.length);

  // view → 锚点可能落在的源文件（map 的锚点分布在侧栏与星图两处；
  // 侧栏经 NavRow 透传，属性在源码里写作 dataTour="…"）
  const VIEW_FILES = {
    map: ['Sidebar.jsx', 'StarMap.jsx'],
    aerial: ['AerialView.jsx'],
    galaxy3d: ['Galaxy3D.jsx'],
    list: ['ListView.jsx'],
    editor: ['Editor.jsx'],
    checkup: ['Checkup.jsx'],
    inbox: ['Inbox.jsx'],
    blackhole: ['BlackHole.jsx'],
    visit: ['VisitView.jsx'],
    timeline: ['Timeline.jsx'],
  };
  // 叙事编排：先星图，再逐板块实地走，最后回星图收尾
  assert.equal(steps[0].view, 'map');
  assert.equal(steps[steps.length - 1].view, 'map');
  assert.equal(steps[steps.length - 1].anchor, 'settings');
  for (const { view, anchor } of steps) {
    const files = VIEW_FILES[view];
    assert.ok(files, `锚点 "${anchor}" 所在步的 view '${view}' 不是合法视图`);
    const hit = files.some(f => {
      const src = read('ui_kits/stellar-raft/' + f);
      return src.includes(`data-tour="${anchor}"`) || src.includes(`dataTour="${anchor}"`);
    });
    assert.ok(hit, `锚点 "${anchor}"（view: ${view}）在 ${files.join(' / ')} 中都不存在`);
  }
});
