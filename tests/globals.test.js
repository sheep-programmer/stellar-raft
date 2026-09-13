/* 星图 Stellar Raft — 全局作用域的重名检查

   零构建的代价里最隐蔽的一条：index.html 用 <script type="text/babel"> 加载全部
   .jsx，而 @babel/standalone 的做法是把转译产物塞进一个**普通 <script>** 再 append
   到 head（见其 run()：`scriptEl.text = transformCode(...)`）。普通 script 就是全局
   作用域 —— 25 个文件共用一张名字表，后加载的静悄悄覆盖先加载的，不报错、不警告。

   真实踩过的坑：EditorMenus.jsx 的 `function Row({icon,label,onClick,…})` 被
   AdminConsole.jsx 的 `function Row({k,v})` 覆盖，于是编辑器的斜杠菜单、右键菜单、
   「更多」下拉里每一行都变成了没有图标、没有文字、**没有 onClick** 的键值行 ——
   转换块型、删除块、导出 Markdown 全部点不动，而控制台一声不吭。

   构建产物没有这个问题（build-bundle 把每个文件包进 IIFE），只有浏览器直载这条
   路会踩。所以这条测试盯的是「源码里有没有跨文件重名」。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(ROOT, 'ui_kits', 'stellar-raft');
const require = createRequire(import.meta.url);
const Babel = require('@babel/standalone');

/* Babel 自己内联的助手（ownKeys / asyncGeneratorStep / _extends …）在每个文件里
   是同一份实现，互相覆盖没有后果，不算重名。用户代码不许重。 */
const BABEL_HELPERS = /^(ownKeys|asyncGeneratorStep|_.*)$/;
/* 各文件都写一遍、取的是同一个值的只读常量：盖来盖去都一样。
   放行它们要有据可依 —— 每一个都必须是「从同一个全局取同一样东西」。 */
const SAME_VALUE_CONSTS = new Set(['SRK']);

function topLevelNames(file) {
  const src = readFileSync(join(KIT, file), 'utf8');
  // 与浏览器同一套 preset（index.html 没写 data-presets，standalone 默认 react+env）
  const code = Babel.transform(src, { presets: ['react', 'env'], filename: file }).code;
  const names = new Set();
  for (const m of code.matchAll(/^(?:var|let|const|function|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of code.matchAll(/^var\s+\{([^}]*)\}\s*=/gm)) {
    for (const part of m[1].split(',')) {
      const n = part.split(':').pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n);
    }
  }
  return names;
}

test('浏览器直载的 .jsx 之间没有顶层重名（全局作用域是共用的）', () => {
  const html = readFileSync(join(KIT, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script[^>]*src="([^"?]+\.jsx)/g)].map(m => m[1]);
  assert.ok(files.length >= 20, 'index.html 里该登记 20 个以上的 .jsx，实得 ' + files.length);

  const owner = new Map();
  const clashes = [];
  for (const f of files) {
    for (const name of topLevelNames(f)) {
      if (BABEL_HELPERS.test(name) || SAME_VALUE_CONSTS.has(name)) continue;
      if (owner.has(name)) clashes.push(`${name}：${owner.get(name)} 被 ${f} 覆盖`);
      else owner.set(name, f);
    }
  }
  assert.deepEqual(clashes, [],
    '这些顶层名字在多个文件里重复，后加载的会静悄悄盖掉先加载的：\n  ' + clashes.join('\n  '));
});

test('放行名单本身是站得住的：SRK 在每个文件里取的都是同一样东西', () => {
  // 放行只对「同值常量」成立。哪天有人用 SRK 装了别的，这条会先红
  const files = ['Settings.jsx', 'Onboarding.jsx', 'KeysHelp.jsx'];
  for (const f of files) {
    const src = readFileSync(join(KIT, f), 'utf8');
    if (!/\bSRK\b/.test(src)) continue;
    assert.match(src, /const SRK = window\.SRKeys;/, `${f} 里的 SRK 不再是 window.SRKeys`);
  }
});
