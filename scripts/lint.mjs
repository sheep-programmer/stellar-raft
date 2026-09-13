#!/usr/bin/env node
/* 星图 Stellar Raft — lint runner.
   `_adherence.oxlintrc.json` 由设计系统编译器生成（不要改它），但 oxlint 的
   严格解析会拒绝其中两类内容：
     · 工具链私有的 `x-omelette` 元数据段（未知字段）
     · 当前 oxlint 版本尚未实现的规则（如 eslint/no-restricted-syntax）
   这里派生一份可被 oxlint 接受的临时配置（.oxlintrc.derived.json，已被
   .gitignore 忽略）：剥离 x-* 字段，再按 oxlint 的报错迭代剔除不被支持的
   规则，然后正式调起 oxlint。 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '_adherence.oxlintrc.json');
const DERIVED = path.join(ROOT, '.oxlintrc.derived.json');
const OXLINT = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'oxlint.cmd' : 'oxlint');

if (!fs.existsSync(OXLINT)) {
  console.error('[lint] oxlint 未安装，请先执行 npm install');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(SRC, 'utf8'));
for (const key of Object.keys(config)) if (key.startsWith('x-')) delete config[key];

/* ——— 仓库自带的加固层 ———
   生成的规范配置只声明了 react / import 两个插件，而 oxlint 的 plugins 是「换掉」
   而非「追加」默认值——于是 eslint / unicorn 那组 correctness 规则全部离线，
   `npm run lint` 几乎什么都查不出来。这里把它们补回去。

   no-undef 是重点：server.js 里 ADMIN_USER 漏导入，管理员一改密码就 500，
   正是这条规则能在提交前当场拦下的那类错。

   与本仓库既有写法冲突的几条先关掉，不为了 lint 去改几百处与本次无关的旧代码：
     · no-unused-vars        —— 全站 `catch (e) { }` 的降级写法（约 90 处）
     · no-unused-expressions —— `cond && fn()` 这种副作用短路（约 26 处）
     · no-useless-fallback-in-spread —— `...(x || {})` 是本仓库一贯的显式兜底写法
     · prefer-string-starts-ends-with —— 纯风格，mdcore 的正则与相邻几条同族，留作一体
     · react-hooks/exhaustive-deps —— 全站 52 处，多数是刻意省略的依赖；机械补齐会改行为
   生成配置里的规则后合入，永远盖过这里的默认值。 */
const HARDEN = {
  plugins: ['eslint', 'unicorn', 'oxc'],
  env: { browser: true, node: true, es2024: true },
  globals: { React: 'readonly', ReactDOM: 'readonly' },   // 浏览器内 Babel 编译，React 走全局
  categories: { correctness: 'error' },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': 'off',
    'no-unused-expressions': 'off',
    'unicorn/no-useless-fallback-in-spread': 'off',
    'unicorn/prefer-string-starts-ends-with': 'off',
    'react-hooks/exhaustive-deps': 'off',
  },
};
/* 测试里的 api(token, method, path, body) 是一个通吃的小助手，GET 传进去的 body
   实际是 undefined；规则只看得见字面量，拦的是假阳性。应用代码里这条继续开着。 */
const HARDEN_OVERRIDES = [
  { files: ['tests/**'], rules: { 'unicorn/no-invalid-fetch-options': 'off' } },
];
config.plugins = [...new Set([...HARDEN.plugins, ...(config.plugins || [])])];
config.env = { ...HARDEN.env, ...(config.env || {}) };
config.globals = { ...HARDEN.globals, ...(config.globals || {}) };
config.categories = { ...HARDEN.categories, ...(config.categories || {}) };
config.rules = { ...HARDEN.rules, ...(config.rules || {}) };
config.overrides = [...HARDEN_OVERRIDES, ...(config.overrides || [])];

const dropRule = (name) => {
  delete (config.rules || {})[name];
  for (const ov of config.overrides || []) delete (ov.rules || {})[name];
};

const targets = process.argv.slice(2);
const runArgs = (extra) => ['--config', DERIVED, ...extra];

/* 迭代：oxlint 对配置里未实现的规则直接报 parse 错误 —— 逐条剔除直至可用。 */
let result;
for (let attempt = 0; attempt < 20; attempt++) {
  fs.writeFileSync(DERIVED, JSON.stringify(config, null, 2));
  result = spawnSync(OXLINT, runArgs(targets.length ? targets : ['scripts', 'server', 'tests', 'components', 'assets', 'ui_kits', 'docs', 'guidelines']), {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const out = (result.stdout || '') + (result.stderr || '');
  const m = out.match(/Rule '([^']+)' not found in plugin/);
  if (m && out.includes('Failed to parse oxlint configuration')) {
    console.warn(`[lint] 当前 oxlint 未实现规则 ${m[1]}，已从派生配置中剔除`);
    dropRule(m[1]);
    continue;
  }
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  process.exit(result.status ?? 1);
}
console.error('[lint] 无法得到 oxlint 可接受的派生配置');
process.exit(1);
