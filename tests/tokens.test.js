/* 星图 Stellar Raft — design-token 合法性与双主题对应性测试
   解析 tokens/*.css（不执行任何浏览器代码）：
   · 所有颜色字面量（#hex / rgb / rgba / hsl）必须格式合法
   · var() 引用必须指向已定义的 token
   · 黎明 dawn 主题（:root[data-theme="dawn"]）与默认深空主题一一对应：
     dawn 只允许覆写基础主题已有的 token；基础主题里所有携带颜色字面量的
     token 必须被 dawn 覆写（少数刻意跨主题共享的除外，见 SHARED_OK）。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS_DIR = path.join(ROOT, 'tokens');

/* 刻意在两主题间共享的颜色 token：
   --danger 是唯一的破坏性警示色（低饱和暖色），双主题共用同一个值。 */
const SHARED_OK = new Set(['--danger']);

/* ------------------------- 轻量 CSS 解析 ------------------------- */

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 返回 [{ selector, decls: Map<prop, value> }] ，只关心自定义属性。 */
function parseBlocks(css) {
  const src = stripComments(css);
  const blocks = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    const selector = src.slice(i, open).trim().split('\n').pop().trim();
    let depth = 1;
    let j = open + 1;
    while (j < src.length && depth) {
      if (src[j] === '{') depth++;
      if (src[j] === '}') depth--;
      j++;
    }
    const body = src.slice(open + 1, j - 1);
    const decls = new Map();
    for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      decls.set(m[1], m[2].replace(/\s+/g, ' ').trim());
    }
    if (decls.size) blocks.push({ selector, decls });
    i = j;
  }
  return blocks;
}

const cssFiles = fs
  .readdirSync(TOKENS_DIR)
  .filter((f) => f.endsWith('.css'))
  .sort();

const base = new Map(); // token -> { value, file }
const dawn = new Map();
for (const f of cssFiles) {
  const css = fs.readFileSync(path.join(TOKENS_DIR, f), 'utf8');
  for (const block of parseBlocks(css)) {
    const isDawn = /\[data-theme=["']dawn["']\]/.test(block.selector);
    const target = isDawn ? dawn : base;
    if (!isDawn && !/^:root\b/.test(block.selector)) continue; // 只统计 :root 作用域
    for (const [k, v] of block.decls) target.set(k, { value: v, file: f });
  }
}

/* ----------------------------- 断言 ------------------------------ */

test('tokens/ 目录存在且两套主题都有内容', () => {
  assert.ok(cssFiles.length >= 5, `tokens/*.css 应至少有 5 个文件，实际 ${cssFiles.length}`);
  assert.ok(base.size >= 80, `深空主题 token 数异常（${base.size}）`);
  assert.ok(dawn.size >= 40, `dawn 主题 token 数异常（${dawn.size}）`);
});

test('所有颜色字面量合法', () => {
  const problems = [];
  const checkValue = (name, { value, file }) => {
    for (const m of value.matchAll(/#([0-9a-zA-Z]+)/g)) {
      const hex = m[1];
      if (!/^[0-9a-fA-F]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) {
        problems.push(`${file} ${name}: 非法 hex #${hex}`);
      }
    }
    for (const m of value.matchAll(/\brgba?\(([^)]*)\)/g)) {
      const parts = m[1].split(',').map((s) => s.trim());
      if (parts.length !== 3 && parts.length !== 4) {
        problems.push(`${file} ${name}: rgb/rgba 参数个数错误 (${m[0]})`);
        continue;
      }
      parts.slice(0, 3).forEach((p) => {
        const n = Number(p.replace('%', ''));
        if (!Number.isFinite(n) || n < 0 || n > 255) problems.push(`${file} ${name}: 通道越界 ${p}`);
      });
      if (parts[3] !== undefined) {
        const a = Number(parts[3]);
        if (!Number.isFinite(a) || a < 0 || a > 1) problems.push(`${file} ${name}: alpha 越界 ${parts[3]}`);
      }
    }
    for (const m of value.matchAll(/\bhsla?\(([^)]*)\)/g)) {
      const parts = m[1].split(',').map((s) => s.trim());
      if (parts.length < 3) problems.push(`${file} ${name}: hsl 参数不足 (${m[0]})`);
    }
  };
  for (const [k, v] of base) checkValue(k, v);
  for (const [k, v] of dawn) checkValue(k, v);
  assert.deepEqual(problems, []);
});

test('var() 引用都指向已定义 token', () => {
  const missing = [];
  const check = (scope, scopeName) => {
    for (const [k, { value, file }] of scope) {
      for (const m of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!base.has(m[1]) && !dawn.has(m[1])) missing.push(`${file} ${scopeName} ${k} → ${m[1]}`);
      }
    }
  };
  check(base, 'base');
  check(dawn, 'dawn');
  assert.deepEqual(missing, []);
});

test('dawn 主题只覆写基础主题已有的 token（无孤儿覆写）', () => {
  const orphans = [...dawn.keys()].filter((k) => !base.has(k));
  assert.deepEqual(orphans, []);
});

test('基础主题中所有颜色字面量 token 都被 dawn 覆写（一一对应）', () => {
  const colorish = [...base.entries()]
    .filter(([, { value }]) => /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(value))
    // 字体栈 / 尺寸类不参与（它们本来就是跨主题共享的）
    .filter(([, { file }]) => file === 'colors.css' || file === 'effects.css' || file === 'themes.css')
    .map(([k]) => k);
  const missing = colorish.filter((k) => !dawn.has(k) && !SHARED_OK.has(k));
  assert.deepEqual(
    missing,
    [],
    'colors/effects 中的颜色 token 需要在 :root[data-theme="dawn"] 中给出对应覆写',
  );
});

test('品牌关键 token 双主题齐备', () => {
  const must = [
    '--star-blue',
    '--gold',
    '--gold-warm',
    '--gold-white',
    '--glass-bg',
    '--glass-border',
    '--mem-dead',
    '--mem-low',
    '--mem-mid',
    '--mem-high',
    '--mem-full',
    '--text-1',
    '--text-2',
    '--text-3',
    '--bg-deepspace',
  ];
  for (const t of must) {
    assert.ok(base.has(t), `深空主题缺少 ${t}`);
    assert.ok(dawn.has(t), `dawn 主题缺少 ${t}`);
  }
  // 动效 token 属于结构性共享，只需存在于基础主题
  for (const t of ['--ease-flight', '--dur-ignite', '--r-pill', '--s-2']) {
    assert.ok(base.has(t), `缺少 ${t}`);
  }
});
