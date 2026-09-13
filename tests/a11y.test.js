/* 星图 Stellar Raft — 无障碍守卫
   钉住几处修过的无障碍缺口，全部是「成因级」断言而不是选择器碰巧：
   - 设置开关对读屏必须有名有态（曾是裸 button：不知道管什么、也不知道开没开）
   - 费曼对话的新消息必须播报（功能的核心反馈环）
   - 系统「减少动态效果」必须兜得住内联动画（类选择器够不着 inline style）
   - 移动端抽屉/弹层必须有焦点圈（aria-modal 不能形同虚设）
   - --text-3 不是装饰色，对比度必须 ≥ 4.5:1 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// WCAG 相对亮度与对比度（与实际渲染一致：先按 alpha 合成，再算比值）
const lum = (r, g, b) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (c1, c2) => {
  const [l1, l2] = [lum(...c1), lum(...c2)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const blend = (fg, a, bg) => fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));
const parseRgba = (s) => {
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  return m ? { rgb: [+m[1], +m[2], +m[3]], a: m[4] == null ? 1 : +m[4] } : null;
};

test('SRToggle：role=switch + aria-checked + aria-label 一个不少，四处使用都给了名字', () => {
  const s = read('ui_kits/stellar-raft/Settings.jsx');
  const block = s.match(/function SRToggle[\s\S]*?\n\}/)[0];
  assert.match(block, /role="switch"/);
  assert.match(block, /aria-checked/);
  assert.match(block, /aria-label/);
  const uses = s.split('\n').filter(l => l.includes('<SRToggle'));
  assert.equal(uses.length, 4, 'SRToggle 的用量变了，记得回来看这条测试');
  for (const u of uses) assert.ok(/label="/.test(u), '有 SRToggle 没给 label：' + u.trim());
});

test('费曼抽屉：对话本体是可播报的 log（状态行有 aria-live，聊天本体也必须有）', () => {
  const s = read('ui_kits/stellar-raft/FeynmanDrawer.jsx');
  assert.match(s, /role="log"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="log"/);
});

test('减少动态效果：全局兜底压得住内联动画（不只 .sr-breathe 一个类）', () => {
  const css = read('tokens/effects.css');
  const media = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\n\}/);
  assert.ok(media, '找不到 reduced-motion 媒体查询');
  assert.match(media[1], /animation-iteration-count:\s*1\s*!important/, '内联无限动画必须压得住');
  assert.match(media[1], /transition-duration:.*!important/, '过渡也要收敛');
  // StarMap 的连线流光是内联 animation 的典型——全局兜底存在就是为了它这一类
  assert.match(read('ui_kits/stellar-raft/StarMap.jsx'), /animation:\s*`sr-flow/);
});

test('移动端抽屉与底部弹层：焦点圈、Esc、进场移焦、退场归还', () => {
  const s = read('ui_kits/stellar-raft/MobileShell.jsx');
  assert.match(s, /function usePanelFocus\(/, '抽屉/弹层要有自己的焦点管理（常驻挂载，useModalFocus 的 [] 依赖跟不上开合）');
  for (const name of ['MobileDrawer', 'MobileSheet']) {
    const block = s.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}'))[0];
    assert.ok(/usePanelFocus\(open,/.test(block), name + ' 没接焦点圈');
    assert.ok(/role="dialog"[^>]*aria-modal="true"|aria-modal="true"[^>]*role="dialog"/.test(block), name + ' 丢了 dialog 语义');
  }
});

test('--text-3 对比度 ≥ 4.5:1（暗色与黎明主题都查）——它是导航性元信息，不是装饰色', () => {
  const cases = [
    { file: 'tokens/colors.css', bg: [3, 4, 12] },        // --space-void
    { file: 'tokens/themes.css', bg: [223, 228, 238] },   // dawn 底色
  ];
  for (const c of cases) {
    const css = read(c.file);
    const decl = css.match(/--text-3:\s*([^;]+);/);
    assert.ok(decl, c.file + ' 没有 --text-3');
    const col = parseRgba(decl[1]);
    const r = ratio(blend(col.rgb, col.a, c.bg), c.bg);
    assert.ok(r >= 4.5, `${c.file} 的 --text-3 对比度 ${r.toFixed(2)}:1，低于 4.5:1`);
  }
});
