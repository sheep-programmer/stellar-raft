/* 星图 Stellar Raft — 构建产物（_ds_bundle.js / _ds_manifest.json）测试
   · 现场跑一次 scripts/build-bundle.mjs（输出到临时目录，不动仓库文件）
   · 断言 bundle 头部元数据 / manifest / 磁盘源文件三方一致
     （sourceHashes = sha256 前 12 位 hex；组件、卡片一一登记）
   · 用 new Function + 最小 window/document/customElements mock 加载 bundle，
     断言命名空间下组件齐全、组件与 assets 分节零加载错误
   · 校验仓库里已提交的产物自身一致（bundle 头部 == manifest 对应字段） */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAMESPACE = 'StellarRaftDesignSystem_2866af';

const sha12 = (p) =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex').slice(0, 12);

function parseHeader(bundleSrc) {
  const m = bundleSrc.match(/^\/\* @ds-bundle: (\{.*\}) \*\/$/m);
  assert.ok(m, 'bundle 必须以 @ds-bundle 头部注释开头');
  return JSON.parse(m[1]);
}

/* --------------------- 现场构建（到临时目录） --------------------- */

let outDir;
let bundleSrc;
let header;
let manifest;

test.before(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-raft-build-'));
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-bundle.mjs'), '--out', outDir], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  bundleSrc = fs.readFileSync(path.join(outDir, '_ds_bundle.js'), 'utf8');
  header = parseHeader(bundleSrc);
  manifest = JSON.parse(fs.readFileSync(path.join(outDir, '_ds_manifest.json'), 'utf8'));
});

test.after(() => {
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
});

/* ------------------------------ 断言 ------------------------------ */

test('bundle 头部：format 3 + 命名空间', () => {
  assert.equal(header.format, 3);
  assert.equal(header.namespace, NAMESPACE);
  assert.deepEqual(header.inlinedExternals, []);
});

test('sourceHashes 与磁盘文件一致（sha256 前 12 位）', () => {
  const entries = Object.entries(header.sourceHashes);
  assert.ok(entries.length >= 11, 'sourceHashes 至少覆盖 starfield + 10 组件');
  for (const [file, hash] of entries) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `sourceHashes 引用了不存在的文件 ${file}`);
    assert.equal(sha12(file), hash, `${file} 的哈希与磁盘不符`);
  }
});

test('components/ 下每个 .jsx 都被打包并登记', () => {
  const compRoot = path.join(ROOT, 'components');
  const onDisk = [];
  for (const group of fs.readdirSync(compRoot, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(compRoot, group.name))) {
      if (f.endsWith('.jsx')) onDisk.push(`components/${group.name}/${f}`);
    }
  }
  for (const f of onDisk) {
    assert.ok(header.sourceHashes[f], `${f} 未进入 sourceHashes`);
    assert.ok(bundleSrc.includes(`// ${f}\ntry { (() => {`), `${f} 缺少 bundle 分节`);
  }
  // 每个组件名 = 与文件同名的导出
  const byPath = new Map(header.components.map((c) => [c.sourcePath, c.name]));
  for (const f of onDisk) {
    const base = path.basename(f, '.jsx');
    assert.equal(byPath.get(f), base, `${f} 应登记组件 ${base}`);
  }
  assert.ok(header.sourceHashes['assets/starfield.js'], 'starfield 必须被打包');
});

test('manifest 与 bundle 头部一致，卡片与磁盘一致', () => {
  assert.equal(manifest.namespace, NAMESPACE);
  assert.deepEqual(manifest.components, header.components);
  assert.deepEqual(manifest.sourceHashes, header.sourceHashes);

  // 磁盘上每个 *.card.html 都已登记，登记的每张卡片都存在
  const cardsOnDisk = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir || '.'), { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.card.html')) cardsOnDisk.push(p);
    }
  };
  walk('');
  const registered = new Set(manifest.cards.map((c) => c.path));
  for (const p of cardsOnDisk) assert.ok(registered.has(p), `卡片未登记：${p}`);
  for (const c of manifest.cards) {
    assert.ok(fs.existsSync(path.join(ROOT, c.path)), `manifest 卡片不存在：${c.path}`);
    assert.ok(c.group && c.name !== undefined && /^\d+x\d+$/.test(c.viewport), `卡片元数据不完整：${c.path}`);
  }
});

test('bundle 可被 new Function 加载：命名空间组件齐全、核心分节零错误', () => {
  const noop = () => {};
  const el = () => ({
    style: {},
    dataset: {},
    appendChild: noop,
    setAttribute: noop,
    getContext: () => null,
    addEventListener: noop,
    querySelector: () => null,
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  });
  const documentMock = {
    createElement: el,
    documentElement: { dataset: {}, style: {} },
    getElementById: el,
    body: el(),
    addEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const hookState = () => [undefined, noop];
  const ReactMock = {
    createElement: (...args) => ({ $$mock: true, args }),
    Fragment: Symbol('Fragment'),
    useState: hookState,
    useReducer: hookState,
    useEffect: noop,
    useLayoutEffect: noop,
    useMemo: (f) => f(),
    useCallback: (f) => f,
    useRef: () => ({ current: null }),
    useContext: () => ({}),
    createContext: () => ({ Provider: noop, Consumer: noop }),
    forwardRef: (f) => f,
    memo: (f) => f,
    cloneElement: (e) => e,
    Children: { map: (c, f) => (Array.isArray(c) ? c.map(f) : c ? [f(c)] : []) },
  };
  const ReactDOMMock = { createRoot: () => ({ render: noop, unmount: noop }) };
  const windowMock = {
    React: ReactMock,
    ReactDOM: ReactDOMMock,
    document: documentMock,
    devicePixelRatio: 1,
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: true, addEventListener: noop }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: noop,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { sendBeacon: () => true },
    location: { href: 'http://localhost/', search: '' },
    setTimeout: () => 0,
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
  };

  const load = new Function(
    'window',
    'document',
    'customElements',
    'HTMLElement',
    'matchMedia',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'React',
    'ReactDOM',
    'localStorage',
    'navigator',
    'location',
    'fetch',
    'addEventListener',
    'removeEventListener',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    bundleSrc,
  );
  load(
    windowMock,
    documentMock,
    { get: () => true, define: noop }, // 已注册 → starfield 直接跳过重复定义
    class HTMLElement {},
    windowMock.matchMedia,
    windowMock.requestAnimationFrame,
    noop,
    ReactMock,
    ReactDOMMock,
    windowMock.localStorage,
    windowMock.navigator,
    windowMock.location,
    () => Promise.reject(new Error('no network in tests')),
    noop,
    noop,
    windowMock.setTimeout,
    noop,
    windowMock.setInterval,
    noop,
  );

  const ns = windowMock[NAMESPACE];
  assert.ok(ns, '命名空间未挂载');

  // 组件齐全且可调用
  for (const { name } of header.components) {
    assert.equal(typeof ns[name], 'function', `命名空间缺少组件 ${name}`);
  }

  // 命令式 helper（exposedHelpers，如 toast()）也必须挂到命名空间
  for (const { name } of header.exposedHelpers || []) {
    assert.equal(typeof ns[name], 'function', `命名空间缺少 helper ${name}`);
  }
  assert.equal(typeof ns.toast, 'function', 'toast() 必须暴露在命名空间上（卡片与使用方依赖）');

  // 组件与 assets 分节必须零错误（ui_kits 快照允许依赖浏览器环境）
  const coreErrors = (ns.__errors || []).filter(
    (e) => e.path.startsWith('components/') || e.path.startsWith('assets/'),
  );
  assert.deepEqual(coreErrors, []);

  // 冒烟：Badge 能以 mock React 渲染出 createElement 调用
  const out = ns.Badge({ children: '12', tone: 'gold' });
  assert.ok(out && out.$$mock, 'Badge 渲染未走 React.createElement');
});

test('仓库中已提交的产物自身一致（头部 == manifest）', () => {
  const committedBundle = fs.readFileSync(path.join(ROOT, '_ds_bundle.js'), 'utf8');
  const committedManifest = JSON.parse(fs.readFileSync(path.join(ROOT, '_ds_manifest.json'), 'utf8'));
  const committedHeader = parseHeader(committedBundle);
  assert.equal(committedHeader.namespace, committedManifest.namespace);
  assert.deepEqual(committedManifest.components, committedHeader.components);
});

/* ---------------- 组件缺陷回归（Tag 键盘语义 / ContextMenu aria） ----------------
   用一个可脚本化状态的 React mock 重新加载 bundle，直接调用组件函数并检查
   createElement 树 —— 结构与处理器逻辑层面的回归网；端到端行为另由无头
   浏览器冒烟覆盖。 */

function makeScriptedReact(stateQueue = []) {
  const noop = () => {};
  const queue = [...stateQueue];
  return {
    createElement: (type, props, ...children) => ({
      $$mock: true,
      type,
      props: props || {},
      children: children.flat(Infinity).filter((c) => c != null && c !== false),
    }),
    Fragment: 'Fragment',
    useState: () => [queue.length ? queue.shift() : undefined, noop],
    useReducer: () => [undefined, noop],
    useEffect: noop,
    useLayoutEffect: noop,
    useMemo: (f) => f(),
    useCallback: (f) => f,
    useRef: (init) => ({ current: init === undefined ? null : init }),
    useId: () => ':t:',
    useContext: () => ({}),
    createContext: () => ({ Provider: noop, Consumer: noop }),
    forwardRef: (f) => f,
    memo: (f) => f,
    cloneElement: (e) => e,
    Children: { map: (c, f) => (Array.isArray(c) ? c.map(f) : c ? [f(c)] : []) },
  };
}

function loadBundleWith(ReactMock) {
  const noop = () => {};
  const el = () => ({
    style: {},
    dataset: {},
    appendChild: noop,
    setAttribute: noop,
    getContext: () => null,
    addEventListener: noop,
    querySelector: () => null,
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  });
  const documentMock = {
    createElement: el,
    documentElement: { dataset: {}, style: {} },
    getElementById: el,
    body: el(),
    addEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const windowMock = {
    React: ReactMock,
    ReactDOM: { createRoot: () => ({ render: noop, unmount: noop }) },
    document: documentMock,
    devicePixelRatio: 1,
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: true, addEventListener: noop }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: noop,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { sendBeacon: () => true },
    location: { href: 'http://localhost/', search: '' },
    setTimeout: () => 0,
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
  };
  const load = new Function(
    'window', 'document', 'customElements', 'HTMLElement', 'matchMedia',
    'requestAnimationFrame', 'cancelAnimationFrame', 'React', 'ReactDOM',
    'localStorage', 'navigator', 'location', 'fetch',
    'addEventListener', 'removeEventListener',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    bundleSrc,
  );
  load(
    windowMock, documentMock,
    { get: () => true, define: noop },
    class HTMLElement {},
    windowMock.matchMedia, windowMock.requestAnimationFrame, noop,
    ReactMock, windowMock.ReactDOM,
    windowMock.localStorage, windowMock.navigator, windowMock.location,
    () => Promise.reject(new Error('no network in tests')),
    noop, noop, windowMock.setTimeout, noop, windowMock.setInterval, noop,
  );
  return windowMock[NAMESPACE];
}

const findNode = (node, pred) => {
  if (!node || typeof node !== 'object') return null;
  if (node.$$mock && pred(node)) return node;
  const kids = [...(node.children || [])];
  if (node.props && node.props.children) kids.push(...[].concat(node.props.children));
  for (const k of kids) {
    const hit = findNode(k, pred);
    if (hit) return hit;
  }
  return null;
};

test('Tag：可点 + 可移除时 role=button 不再嵌套原生 button，键盘事件校验来源', () => {
  const ns = loadBundleWith(makeScriptedReact());
  let clicks = 0;
  let removes = 0;
  const tree = ns.Tag({
    children: '术语',
    onClick: () => { clicks += 1; },
    removable: true,
    onRemove: () => { removes += 1; },
  });

  // 外层不再是 button role；激活语义移到内层 span
  assert.equal(tree.type, 'span');
  assert.equal(tree.props.role, undefined, '可移除时外层 span 不应再挂 role=button');
  const action = findNode(tree, (n) => n.props.role === 'button');
  assert.ok(action, '必须存在承担激活语义的 role=button 节点');
  assert.equal(action.props.tabIndex, 0);
  assert.equal(findNode(action, (n) => n.type === 'button'), null, 'role=button 内不得嵌套原生 button');
  const removeBtn = findNode(tree, (n) => n.type === 'button');
  assert.ok(removeBtn, '移除按钮仍需存在（作为兄弟节点）');

  // onKeyDown 必须校验事件来源：来自后代的 Enter 不触发 onClick
  const bubbled = { key: 'Enter', target: {}, currentTarget: {}, preventDefault: () => {} };
  action.props.onKeyDown(bubbled);
  assert.equal(clicks, 0, '来自后代（如移除按钮）的按键不得触发 onClick');
  const self = {};
  action.props.onKeyDown({ key: 'Enter', target: self, currentTarget: self, preventDefault: () => {} });
  action.props.onKeyDown({ key: ' ', target: self, currentTarget: self, preventDefault: () => {} });
  assert.equal(clicks, 2, '自身的 Enter/Space 应触发 onClick');

  // 移除按钮点击：阻断冒泡并回调 onRemove
  let stopped = false;
  removeBtn.props.onClick({ stopPropagation: () => { stopped = true; } });
  assert.ok(stopped, '移除按钮 click 必须 stopPropagation');
  assert.equal(removes, 1);
  assert.equal(clicks, 2, '点移除不触发 onClick');

  // 仅可点（不可移除）时：外层自身就是 button role
  const plain = ns.Tag({ children: '术语', onClick: () => {} });
  assert.equal(plain.props.role, 'button');
  assert.equal(plain.props.tabIndex, 0);
});

test('ContextMenu：菜单容器挂 aria-activedescendant，指向带 id 的活动 MenuRow', () => {
  const items = [{ id: 'a', label: '甲' }, { id: 'b', label: '乙', disabled: true }, { id: 'c', label: '丙' }];

  // useState 顺序：at（打开位置）、active（活动索引）
  const nsActive = loadBundleWith(makeScriptedReact([{ x: 20, y: 20 }, 2]));
  const tree = nsActive.ContextMenu({ items, children: null });
  const menu = findNode(tree, (n) => n.props.role === 'menu');
  assert.ok(menu, '打开状态必须渲染 role=menu 容器');
  const aid = menu.props['aria-activedescendant'];
  assert.equal(typeof aid, 'string', 'active >= 0 时必须设置 aria-activedescendant');

  // 活动行（MenuRow 是函数组件）必须拿到同一个 id，且渲染出的 div 带该 id
  const rowEl = findNode(menu, (n) => typeof n.type === 'function' && n.props.id === aid);
  assert.ok(rowEl, 'aria-activedescendant 必须指向某个 MenuRow 的 id');
  assert.equal(rowEl.props.item.id, 'c', 'active=2 时指向第三项');
  const rendered = rowEl.type(rowEl.props);
  assert.equal(rendered.props.id, aid, 'MenuRow 渲染出的 DOM 节点必须带该 id');
  assert.equal(rendered.props.role, 'menuitem');

  // active = -1 时不设 aria-activedescendant
  const nsIdle = loadBundleWith(makeScriptedReact([{ x: 20, y: 20 }, -1]));
  const idleMenu = findNode(nsIdle.ContextMenu({ items, children: null }), (n) => n.props.role === 'menu');
  assert.ok(idleMenu);
  assert.equal(idleMenu.props['aria-activedescendant'], undefined);
});
