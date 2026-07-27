/* 星图 Stellar Raft — 应用源码编译自检

   ui_kits 里的 .jsx 是浏览器里由 @babel/standalone 现场编译的，没有构建步骤，
   也就没有任何一步会在提交前发现语法错误——写坏了要等到打开页面白屏才知道。
   这里用同一个 Babel、同一套 preset 把每个文件都编译一遍，把「能不能跑起来」
   这条底线挪到测试里。

   真实抓到过的例子：在 CSS 模板字符串的注释里写了一对反引号，
   模板字符串当场被截断，整个 MobileShell.jsx 无法编译。 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Babel = require('@babel/standalone');

const KIT = join(ROOT, 'ui_kits', 'stellar-raft');

test('ui_kits 里的每个 .jsx 都能被浏览器同款 Babel 编译', () => {
  const files = readdirSync(KIT).filter(f => f.endsWith('.jsx')).sort();
  assert.ok(files.length >= 20, '应用组件不该少于 20 个，实得 ' + files.length);

  const broken = [];
  for (const f of files) {
    try {
      Babel.transform(readFileSync(join(KIT, f), 'utf8'), { presets: ['react'], filename: f });
    } catch (e) {
      broken.push(`${f}: ${e.message}`);
    }
  }
  assert.deepEqual(broken, [], '这些文件编译不过：\n' + broken.join('\n'));
});

test('ui_kits 里的每个 .js（非 JSX 的全局模块）都是合法脚本', () => {
  const files = readdirSync(KIT).filter(f => f.endsWith('.js')).sort();
  assert.ok(files.length >= 5);

  const broken = [];
  for (const f of files) {
    try {
      // 只解析不执行：这些文件的顶层就要碰 window/document，跑不起来也不该跑
      new (require('node:vm').Script)(readFileSync(join(KIT, f), 'utf8'), { filename: f });
    } catch (e) {
      broken.push(`${f}: ${e.message}`);
    }
  }
  assert.deepEqual(broken, [], '这些文件语法有误：\n' + broken.join('\n'));
});

test('设计系统组件源码同样能编译（bundle 之外的第二道保险）', () => {
  const dirs = ['core', 'form', 'knowledge', 'overlay'];
  const broken = [];
  for (const d of dirs) {
    const dir = join(ROOT, 'components', d);
    for (const f of readdirSync(dir).filter(x => x.endsWith('.jsx'))) {
      try {
        Babel.transform(readFileSync(join(dir, f), 'utf8'), { presets: ['react'], filename: f });
      } catch (e) {
        broken.push(`${d}/${f}: ${e.message}`);
      }
    }
  }
  assert.deepEqual(broken, [], '这些组件编译不过：\n' + broken.join('\n'));
});

test('index.html 登记的每个本地脚本都真实存在（版本号不影响解析）', () => {
  const html = readFileSync(join(KIT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])
    .filter(s => !s.startsWith('http'));
  assert.ok(srcs.length >= 20);

  const missing = srcs.filter(s => {
    const p = join(KIT, s.split('?')[0]);
    try { readFileSync(p); return false; } catch { return true; }
  });
  assert.deepEqual(missing, [], '这些登记的脚本在磁盘上找不到：' + missing.join(', '));
});
