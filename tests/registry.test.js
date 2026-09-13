/* 星图 Stellar Raft — 组件登记表（docs/registry.js）与组件实现的一致性测试

   docs/components.html 完全由 REGISTRY 驱动，里面的每个 prop 默认值本该
   「从 <Name>.d.ts 提炼」——但三者（登记表 / d.ts / .jsx 实现）各写各的，
   曾经悄悄长出 17 处漂移：Icon 的 size 写着 24 实为 20、GlassPanel 的 radius
   写着 'md' 实为 'lg'、StarNode 的四个 prop（hit 与三个事件处理器）干脆没登记。

   这里不再靠肉眼：把 REGISTRY 跑在 vm 里读出来，逐个组件解析 .jsx 的
   解构签名（剥掉注释），比对每个 prop 的默认值；再和 d.ts 双向核对——
   任何一边改了，另一边没跟上，CI 当场红。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const sandbox = { window: {} };
vm.runInNewContext(read('docs/registry.js'), sandbox, { filename: 'registry.js' });
const REGISTRY = sandbox.window.SR_DOCS_REGISTRY;
assert.ok(Array.isArray(REGISTRY) && REGISTRY.length >= 18, 'REGISTRY 没读出来');

// 解析 `export function Name({ a = 1, b, ... })` 的解构签名：{ a: '1', b: null }
function parseImplDefaults(src, name) {
  const fnIdx = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
  assert.ok(fnIdx !== -1, `${name} 的实现里找不到函数签名`);
  const open = src.indexOf('{', fnIdx);
  let depth = 0, close = open;
  for (; close < src.length; close++) {
    if (src[close] === '{') depth++;
    else if (src[close] === '}') { depth--; if (depth === 0) break; }
  }
  const block = src.slice(open + 1, close)
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 块注释（StarNode 的 hit 上方就有一大段）
    .replace(/\/\/[^\n]*/g, '');        // 行注释
  // 按顶层逗号切开（默认值里可能带嵌套括号）
  const parts = [];
  let cur = '', d2 = 0;
  for (const ch of block) {
    if ('{[('.includes(ch)) d2++;
    if ('}])'.includes(ch)) d2--;
    if (ch === ',' && d2 === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  const out = {};
  for (const p of parts) {
    const mm = p.trim().match(/^([A-Za-z_$][\w$]*)\s*(?:=\s*([\s\S]*))?$/);
    if (mm) out[mm[1]] = mm[2] === undefined ? null : mm[2].trim();
  }
  return out;
}

const norm = (v) => (v === null || v === undefined || v === '') ? null : String(v).replace(/\s+/g, '');
// 外壳与透传 prop 不强制登记（每个组件都有，登记了也只是噪音）
const SKIP_IMPL = new Set(['children', 'style', 'className']);

test('登记表里每个 prop 的默认值，都与组件实现的真实默认值一致', () => {
  for (const c of REGISTRY) {
    const implPath = c.dts.replace(/\.d\.ts$/, '.jsx').replace(/^\.\.\//, '');
    const src = read(implPath);
    const impl = parseImplDefaults(src, c.id);
    for (const p of c.props || []) {
      assert.ok(p.name in impl, `${c.id}: 登记表写了 prop "${p.name}"，实现的解构里没有它`);
      const implDef = norm(impl[p.name]);
      const docDef = norm(p.def);
      assert.equal(docDef, implDef,
        `${c.id}.${p.name}: 登记表默认值 ${JSON.stringify(p.def)}，实现里却是 ${JSON.stringify(impl[p.name])}`);
    }
  }
});

test('实现里解构出来的 prop，登记表一个都不许漏（事件处理器也算）', () => {
  for (const c of REGISTRY) {
    const implPath = c.dts.replace(/\.d\.ts$/, '.jsx').replace(/^\.\.\//, '');
    const impl = parseImplDefaults(read(implPath), c.id);
    for (const k of Object.keys(impl)) {
      if (SKIP_IMPL.has(k)) continue;
      assert.ok((c.props || []).some(p => p.name === k),
        `${c.id}: 实现里有 prop "${k}"，登记表没收录`);
    }
  }
});

test('登记表与 d.ts 双向对齐：prop 集合必须相同', () => {
  for (const c of REGISTRY) {
    const dts = read(c.dts.replace(/^\.\.\//, ''));
    const interfaceBody = dts.match(/interface \w+Props \{([\s\S]*?)\n\}/);
    assert.ok(interfaceBody, `${c.id}: d.ts 里找不到 Props 接口`);
    const dtsProps = [...interfaceBody[1].matchAll(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??:/gm)]
      .map(m => m[1]).filter(n => !SKIP_IMPL.has(n));
    const regProps = (c.props || []).map(p => p.name).filter(n => !SKIP_IMPL.has(n));
    for (const n of regProps) {
      assert.ok(dtsProps.includes(n), `${c.id}: 登记表有 "${n}"，d.ts 没有`);
    }
    for (const n of dtsProps) {
      assert.ok(regProps.includes(n), `${c.id}: d.ts 有 "${n}"，登记表没有`);
    }
  }
});

test('登记表登记的 d.ts 与演示卡路径都真实存在', () => {
  for (const c of REGISTRY) {
    for (const rel of new Set([c.dts, c.card])) {
      assert.ok(fs.existsSync(path.join(ROOT, 'docs', rel)),
        `${c.id}: ${rel} 在磁盘上不存在`);
    }
  }
});
