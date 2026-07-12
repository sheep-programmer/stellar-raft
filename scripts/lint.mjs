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
  result = spawnSync(OXLINT, runArgs(targets.length ? targets : ['scripts', 'server', 'tests', 'components', 'assets']), {
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
