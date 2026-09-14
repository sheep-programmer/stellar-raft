/* 星图 Stellar Raft — 移动端适配自检

   与其它 .jsx 测试同一路数：浏览器端编译的 JSX 没有可 import 的产物，React 组件
   做不了单元测试，所以对源码做结构性断言，守住这些回归点：
   一套断点（组件不各自写 matchMedia）· 安全区变量集中定义 · 外壳在手机上换成
   抽屉 + 底部标签栏 · 星图改用指针事件（触摸能拖动）· 各视图与弹层挂上窄屏钩子。 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const KIT = 'ui_kits/stellar-raft/';

const RESP = read(KIT + 'responsive.js');
const SHELL = read(KIT + 'MobileShell.jsx');
const APP = read(KIT + 'app.jsx');
const SIDEBAR = read(KIT + 'Sidebar.jsx');
const MAP = read(KIT + 'StarMap.jsx');
const HTML = read(KIT + 'index.html');

/* ---------------------------- 断点底座 ---------------------------- */

test('一套断点：phone 720 · tablet 1024，暴露在 SRScreen 上', () => {
  assert.match(RESP, /phone: 720/);
  assert.match(RESP, /tablet: 1024/);
  assert.match(RESP, /window\.SRScreen = /);
  assert.match(RESP, /useScreen\(\)/);
  // 跨断点才广播，resize 抖动不触发整树重渲染
  assert.match(RESP, /if \(Object\.keys\(next\)\.every\(k => next\[k\] === state\[k\]\)\) return/);
  // html 上落属性，纯 CSS 也能挂钩
  assert.match(RESP, /el\.dataset\.screen = state\.phone \? 'phone'/);
});

test('组件不各自写 matchMedia —— 断点只有一处真源', () => {
  const files = readdirSync(join(ROOT, KIT)).filter(f => /\.(jsx|js)$/.test(f));
  const offenders = files.filter(f => {
    if (f === 'responsive.js') return false;                 // 唯一允许的地方
    const src = readFileSync(join(ROOT, KIT, f), 'utf8');
    // 动效偏好（prefers-reduced-motion）不算断点，放行
    return /matchMedia\((?!.*prefers-reduced-motion)/.test(src);
  });
  assert.deepEqual(offenders, [], '这些文件绕开了 SRScreen 自己写 matchMedia：' + offenders.join(', '));
});

test('viewport 与安全区：铺到刘海之下，但不禁用捏合放大', () => {
  // 只看 meta 标签自身的 content，别把旁边解释「为什么不写 user-scalable」的注释也算进来
  const meta = HTML.match(/<meta\s+name="viewport"\s+content="([^"]*)"/);
  assert.ok(meta, '找不到 viewport meta');
  const content = meta[1];
  assert.match(content, /viewport-fit=cover/);
  assert.equal(/user-scalable\s*=\s*no/.test(content), false, '禁用缩放会踩无障碍底线');
  assert.equal(/maximum-scale\s*=\s*1/.test(content), false);
  for (const v of ['--sr-safe-top', '--sr-safe-bottom', '--sr-topbar', '--sr-tabbar']) {
    assert.ok(HTML.includes(v), '缺少变量 ' + v);
  }
  // 地址栏吞高度：优先 dvh，老浏览器退回量出来的 --sr-vh
  assert.match(HTML, /@supports \(height: 100dvh\)/);
  assert.match(RESP, /--sr-vh/);
  // responsive.js 必须先于任何 .jsx 加载（jsx 里要用 SRKit.useScreen）
  assert.ok(HTML.indexOf('responsive.js') < HTML.indexOf('.jsx'), 'responsive.js 要排在 jsx 之前');
});

/* ---------------------------- SRScreen 真跑一遍 ----------------------------
   responsive.js 是纯 JS（不是 JSX），可以在 vm 里配一套最小 window/document/
   matchMedia 真跑，断点判定与广播不靠读源码猜。 */

function bootScreen(width, height, coarse) {
  const listeners = new Map();          // query → Set<fn>
  const state = { width, height, coarse };
  const mkMq = (q) => {
    const match = () => {
      let m = /\(max-width: (\d+)px\)/.exec(q);
      if (m && !q.includes('max-height')) return state.width <= Number(m[1]);
      if (q.includes('pointer: coarse')) return state.coarse;
      m = /\(max-height: (\d+)px\)/.exec(q);
      if (m) return state.height <= Number(m[1]) && state.width > state.height;
      return false;
    };
    const obj = {
      get matches() { return match(); },
      addEventListener(_, fn) { if (!listeners.has(q)) listeners.set(q, new Set()); listeners.get(q).add(fn); },
      removeEventListener(_, fn) { const s = listeners.get(q); if (s) s.delete(fn); },
    };
    return obj;
  };
  const docEl = { dataset: {}, style: { setProperty(k, v) { this[k] = v; } } };
  const win = {
    matchMedia: mkMq,
    innerWidth: width, innerHeight: height,
    addEventListener() { }, dispatchEvent() { return true; },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    document: { documentElement: docEl },
  };
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.document = win.document;
  vm.runInContext(RESP, ctx);
  return {
    SRScreen: ctx.SRScreen, docEl,
    resize(w, h) {
      state.width = w; state.height = h;
      win.innerWidth = w; win.innerHeight = h;
      listeners.forEach(set => set.forEach(fn => fn()));
    },
  };
}

test('SRScreen 真跑：375×812 手机判成 phone，并在 html 上落属性', () => {
  const { SRScreen, docEl } = bootScreen(375, 812, true);
  const s = SRScreen.get();
  assert.equal(s.phone, true);
  assert.equal(s.tablet, true, 'phone 同时满足 tablet（阈值是包含关系）');
  assert.equal(s.desktop, false);
  assert.equal(s.touch, true);
  assert.equal(docEl.dataset.screen, 'phone');
  assert.equal(docEl.dataset.pointer, 'coarse');
  assert.equal(SRScreen.isPhone(), true);
});

test('SRScreen 真跑：1440×900 桌面是 desktop，且不是 touch', () => {
  const { SRScreen, docEl } = bootScreen(1440, 900, false);
  const s = SRScreen.get();
  assert.equal(s.phone, false);
  assert.equal(s.desktop, true);
  assert.equal(s.touch, false);
  assert.equal(docEl.dataset.screen, 'desktop');
  assert.equal(docEl.dataset.pointer, undefined);
});

test('SRScreen 真跑：跨断点才广播，同一档内 resize 不惊动订阅者', () => {
  const boot = bootScreen(1440, 900, false);
  let fired = 0;
  boot.SRScreen.subscribe(() => { fired++; });

  boot.resize(1200, 900);                 // 还是 desktop
  assert.equal(fired, 0, '同一档内不该广播');

  boot.resize(900, 900);                  // → tablet
  assert.equal(fired, 1);
  assert.equal(boot.SRScreen.get().tablet, true);
  assert.equal(boot.docEl.dataset.screen, 'tablet');

  boot.resize(700, 900);                  // → phone
  assert.equal(fired, 2);
  assert.equal(boot.docEl.dataset.screen, 'phone');

  boot.resize(680, 900);                  // 仍是 phone
  assert.equal(fired, 2, '同一档内不该再广播');

  // 退订之后不再收到
  const off = boot.SRScreen.subscribe(() => { fired += 100; });
  off();
  boot.resize(1440, 900);
  assert.equal(fired, 3, '退订的订阅者不该被调用');
});

test('SRScreen 真跑：横屏矮屏单独标出来（顶部条 + 底部栏会把内容挤没）', () => {
  const { SRScreen, docEl } = bootScreen(844, 390, true);   // 手机横过来
  assert.equal(SRScreen.get().short, true);
  assert.equal('short' in docEl.dataset, true);
  const up = bootScreen(390, 844, true);                    // 竖着就不是
  assert.equal(up.SRScreen.get().short, false);
});

/* ---------------------------- 外壳 ---------------------------- */

test('手机外壳：抽屉 + 顶部条 + 底部标签栏，且都让开安全区', () => {
  for (const c of ['MobileTopBar', 'MobileTabBar', 'MobileDrawer', 'MobileSheet']) {
    assert.ok(SHELL.includes('function ' + c), '缺少 ' + c);
  }
  assert.match(SHELL, /window\.SRKit = Object\.assign\(window\.SRKit \|\| \{\}, \{ MobileTopBar, MobileTabBar, MobileDrawer, MobileSheet/);
  assert.match(SHELL, /padding-top: var\(--sr-safe-top\)/);
  assert.match(SHELL, /padding-bottom: var\(--sr-safe-bottom\)/);

  // app 只在 phone 挂这三件，桌面完全不渲染（是不挂载，不是隐藏）
  assert.match(APP, /\{!phone && sidebar\}/);
  assert.match(APP, /\{phone && <MobileDrawer/);
  assert.match(APP, /phone && view !== 'editor' && \(\s*<MobileTopBar/);
  assert.match(APP, /phone && view !== 'editor' && \(\s*<MobileTabBar/);
  // 主区域给两条栏让位
  assert.match(APP, /paddingTop: phone && view !== 'editor'/);
  assert.match(APP, /paddingBottom: phone && view !== 'editor'/);
});

test('抽屉与常驻侧栏是同一个组件、同一份状态——两处导航不会各说各话', () => {
  const uses = APP.match(/<Sidebar/g) || [];
  assert.equal(uses.length, 1, '侧栏只该实例化一次（sidebar 常量），实得 ' + uses.length);
  assert.match(APP, /const sidebar = \(/);
  // 手机上选中任一目的地就顺手收起抽屉
  assert.match(APP, /onView=\{\(v\) => \{ closeDrawer\(\); openView\(v\); \}\}/);
  // 变宽到桌面时抽屉自动收掉
  assert.match(APP, /if \(!phone\) setDrawer\(false\)/);
});

test('底部标签栏的角标与侧边栏同口径', () => {
  assert.match(APP, /D\.dueStars \? D\.dueStars\(\)\.length : 0/);
  assert.match(APP, /D\.unclaimedMail \? D\.unclaimedMail\(\) : 0/);
  assert.match(SIDEBAR, /D\.dueStars \? D\.dueStars\(\)\.length : 0/);
  assert.match(SIDEBAR, /D\.unclaimedMail \? D\.unclaimedMail\(\) : 0/);
});

test('侧栏在抽屉里铺满并让开安全区，触摸目标撑到 46px', () => {
  assert.match(SIDEBAR, /width: mobile \? '100%'/);
  assert.match(SIDEBAR, /paddingTop: mobile \? 'var\(--sr-safe-top\)'/);
  assert.match(SIDEBAR, /const rowH = mobile \? 46 : 40/);
});

test('抽屉永远给右侧留一条活口——不能糊满整屏变成「整页跳转」', () => {
  assert.match(SHELL, /width: min\(282px, calc\(100vw - 68px\)\)/);
  // 百分比宽度在窄屏会退化成几乎全屏（282px / 308px ≈ 91%），不能再用
  assert.equal(/\.sr-m-panel[^}]*max-width:\s*\d+vw/.test(SHELL), false, '抽屉不该用 vw 百分比定宽');
});

test('手机上整条侧栏一起滚——星域列表不再被压成两行、被页脚截断', () => {
  assert.match(SIDEBAR, /overflowY: mobile \? 'auto' : 'visible'/);
  // 星域区在手机上不自成滚动区（否则它就是那个被挤扁的窗口）
  assert.match(SIDEBAR, /flex: mobile \? 'none' : 1, minHeight: 0, overflow: mobile \? 'visible' : 'auto'/);
  // 整体滚动后把标题行钉住，关闭按钮任何时候都够得着
  assert.match(SIDEBAR, /position: mobile \? 'sticky' : 'static', top: 0/);
});

/* ---------------------------- 星图触摸 ---------------------------- */

test('星图改用指针事件——鼠标事件在触摸端根本不会触发拖拽', () => {
  assert.equal(/onMouseDown/.test(MAP), false, 'StarMap 里不该再有 onMouseDown');
  assert.match(MAP, /addEventListener\('pointermove'/);
  assert.match(MAP, /addEventListener\('pointerup'/);
  assert.match(MAP, /addEventListener\('pointercancel'/);   // 手指被系统手势夺走时要收尾
  assert.match(MAP, /onPointerDown=\{\(e\) => \{ trackDown\(e\); bgDown\(e\); \}\}/);
});

test('星图：双指捏合缩放，且与滚轮同一套缩放上下限', () => {
  assert.match(MAP, /pinch\.current = \{ dist:/);
  assert.match(MAP, /Math\.hypot\(a\.x - b\.x, a\.y - b\.y\)/);
  // 捏合与滚轮都钳在 0.34–2.6，两种输入不会缩到不同的世界
  const clamps = MAP.match(/clamp\([^)]*0\.34, 2\.6\)/g) || [];
  assert.ok(clamps.length >= 2, '捏合与滚轮应共用同一组缩放上下限');
  // 画布自己接管手势，否则一拖整页跟着滚
  assert.match(MAP, /touchAction: 'none'/);
  // 第二根手指落下即取消拖拽，不会一边缩放一边把星拖走
  assert.match(MAP, /drag\.current = null;\s*\/\/ 第二根手指落下/);
});

test('星图：触摸端用长按代替右键，且移动超过阈值即取消', () => {
  assert.match(MAP, /longPress\.current = setTimeout/);
  assert.match(MAP, /if \(e\.pointerType === 'mouse'\) return/);
  assert.match(MAP, /> 8\) \{\s*clearTimeout\(longPress\.current\)/);
});

test('星图：手势提示随输入方式改口径，手机不谈滚轮和右键', () => {
  assert.match(MAP, /scr\.touch\s*\?\s*'拖动=平移 · 双指捏合=缩放 · 长按空白=新建'/);
});

test('星图落地按内容取景，且只会比原来更远，不会更近', () => {
  assert.match(MAP, /const fitView = React\.useCallback/);
  // 上限不超过从前写死的 0.82（手机再收紧到 0.7）——取景只往后拉镜头
  assert.match(MAP, /0\.34, phone \? 0\.7 : 0\.82\)/);
  // 复位按钮与初始取景走同一条路，不再各算各的
  assert.match(MAP, /const resetView = \(\) => \{[^}]*fitView\(el\)/);
  assert.equal(/setView\(\{ k: 0\.82, x: \(w - WORLD\.w \* 0\.82\)/.test(MAP), false, '不该再有写死 0.82 的取景');
  // 空星空另有分支：没有内容可框时摆正世界中心
  assert.match(MAP, /if \(!boxes\.length\)/);
});

test('星图底部只许有一层：摘要卡出现时，提示条与缩放胶囊让位', () => {
  // 手机上摘要卡贴屏底，提示条与工具胶囊原本也钉在那儿——三层会叠在一起
  const guards = MAP.match(/\{!\(phone && sel\) && \(/g) || [];
  assert.equal(guards.length, 2, '提示条与缩放胶囊都该在卡片出现时收起，实得 ' + guards.length);
  assert.match(MAP, /bottom: 'calc\(var\(--sr-tabbar\) \+ var\(--sr-safe-bottom\) \+ 10px\)'/);
});

test('星图：多指在场时不装长按——双指停顿不该弹出「在此创建」', () => {
  // trackDown 先清了长按计时，紧接着的 bgDown 若不拦就会把它重新装上
  assert.match(MAP, /if \(touches\.current\.size >= 2\) \{ drag\.current = null; return; \}/);
  assert.match(MAP, /if \(touches\.current\.size >= 2\) return;\s*\/\/ 多指在场时不装长按/);
});

/* ---------------------------- 视图与弹层 ---------------------------- */

test('六个视图挂上 .sr-view，一处收掉桌面留白', () => {
  for (const f of ['ListView.jsx', 'Timeline.jsx', 'Inbox.jsx', 'Checkup.jsx', 'AdminConsole.jsx', 'VisitView.jsx']) {
    assert.match(read(KIT + f), /className="sr-view"/, f + ' 少了 .sr-view');
  }
  assert.match(SHELL, /html\[data-screen="phone"\] \.sr-view \{ padding: 14px 14px 32px !important; \}/);
});

test('弹层在手机上铺满：Modal 与四个自绘弹层都挂了 .sr-modal-panel', () => {
  assert.match(read('components/overlay/Modal.jsx'), /className="sr-focus-ring sr-modal-panel"/);
  assert.match(read('components/overlay/Modal.jsx'), /className="sr-modal-mask"/);
  for (const f of ['Settings.jsx', 'AIConfig.jsx', 'KeysHelp.jsx', 'Onboarding.jsx']) {
    assert.match(read(KIT + f), /className="sr-modal-panel"/, f + ' 少了 .sr-modal-panel');
  }
  assert.match(SHELL, /html\[data-screen="phone"\] \.sr-modal-panel/);
});

test('费曼抽屉在手机上铺满——392px 的缝里写不下一句讲解', () => {
  const FEY = read(KIT + 'FeynmanDrawer.jsx');
  assert.match(FEY, /left: phone \? 0 : 'auto', width: phone \? 'auto' : 392/);
  assert.match(FEY, /useScreen\(\)\.phone/);
});

test('编辑器的浮动菜单在手机上改成底部弹层——不再算坐标、不抢层叠', () => {
  const EM = read(KIT + 'EditorMenus.jsx');
  assert.match(EM, /const sheetMode = phone && !!Sheet/);
  assert.match(EM, /if \(sheetMode\) \{\s*return \(\s*<Sheet open onClose=\{onClose\} title=\{title\}>/);
  // 定位与「点外面关闭」在 sheet 模式下都要让开（sheet 自带遮罩与 Esc）
  assert.equal((EM.match(/if \(sheetMode\) return;/g) || []).length, 2);
  /* 每处菜单都要给标题，否则底部弹层顶上是一块无名的空白。
     不能用 /<Floating [^>]*title=/ 去匹配——属性值里的箭头函数 `() =>` 自带 `>`，
     正则会在那儿提前收尾。按花括号深度扫到真正的标签结束符。 */
  const tagEnd = (src, from) => {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) return i;
    }
    return -1;
  };
  const tags = [];
  for (let i = EM.indexOf('<Floating'); i >= 0; i = EM.indexOf('<Floating', i + 1)) {
    tags.push(EM.slice(i, tagEnd(EM, i)));
  }
  // 计数只是绊线：数字变了要顺手确认新菜单也给了标题（下一条断言就是干这个的）
  assert.equal(tags.length, 8, '编辑器共有 8 处浮动菜单，实得 ' + tags.length);
  const untitled = tags.filter(t => !t.includes('title=')).length;
  assert.equal(untitled, 0, `${tags.length} 处菜单里有 ${untitled} 处没给标题`);
  // hook 顺序不能因分支改变：分支只在 return 处发生
  assert.ok(EM.indexOf('const sheetMode') < EM.indexOf('React.useLayoutEffect'));
  // sheet 模式下 ref 是空的，键盘漫游不能去解 null
  assert.match(EM, /const root = ref\.current \|\| e\.currentTarget;/);
});

test('编辑器：窄屏收掉 52px 留白，块手柄改浮到右上角', () => {
  const ED = read(KIT + 'Editor.jsx');
  assert.match(ED, /html\[data-screen="phone"\] \.sr-ed-page/);
  assert.match(ED, /className="sr-ed-page"/);
  assert.match(ED, /html\[data-screen="phone"\] \.sr-blk-tools/);
  assert.match(ED, /className="sr-blk-tools"/);
});

test('触摸端不印键盘提示——手机上没有空格键与 ⌘', () => {
  assert.match(SHELL, /html\[data-pointer="coarse"\] \.sr-kbd-only \{ display: none !important; \}/);
  // 复习会话：键帽与底部整条提示
  const RS = read(KIT + 'ReviewSession.jsx');
  assert.match(RS, /function RSKbd\([^)]*\) \{[\s\S]{0,200}className="sr-kbd-only"/);
  assert.match(RS, /\{star && \(\s*<div className="sr-kbd-only"/);
  // 收件箱的 ⌘Enter
  const IB = read(KIT + 'Inbox.jsx');
  assert.equal((IB.match(/sr-kbd-only/g) || []).length, 2, '收件箱两处组合键提示都要挂钩子');
  // 侧栏搜索框的 ⌘K 键帽在手机上不给
  assert.match(SIDEBAR, /kbd=\{mobile \? undefined : window\.SRKeys\.combo\('K'\)\}/);
  // 设置页整个「快捷键」分区在触摸端不出现
  const ST = read(KIT + 'Settings.jsx');
  assert.match(ST, /id: 'keys',[^}]*desktopOnly: true/);
  assert.match(ST, /SR_SET_NAV\.filter\(n => !\(n\.desktopOnly && window\.SRScreen\.isTouch\(\)\)\)/);
});

test('触摸热区不许改变元素自身尺寸——两次踩过的坑', () => {
  // 断言前先剥掉注释：这几条规则的「反面教材」就写在注释里，
  // 不剥的话正则会命中说明文字，测出一个根本不存在的错误
  const css = SHELL.replace(/\/\*[\s\S]*?\*\//g, '');
  // 只能用 ::after 覆盖层；min-height / padding 都会把可见的方框一起放大
  assert.match(css, /\.sr-hit-pad::after \{[\s\S]{0,160}position: absolute/);
  assert.equal(/\.sr-hit-pad \{[^}]*min-height/.test(css), false);
  assert.equal(/\.sr-hit-pad \{[^}]*padding:/.test(css), false);
  assert.equal(/button\.sr-focus-ring \{[^}]*min-height/.test(css), false, '不许再对所有按钮设 min-height');
});

test('列表视图在窄屏改卡片：六列网格拆成三行，表头隐去', () => {
  const LV = read(KIT + 'ListView.jsx');
  // 桌面的六列固定宽在 414px 屏上会把标题列压到 0（标签被逼成一字一行）
  assert.match(LV, /const GRID = '30px 1fr 156px 150px 116px 78px'/);
  assert.match(LV, /html\[data-narrow\] \.sr-list-head \{ display: none/);
  assert.match(LV, /html\[data-narrow\] \.sr-list-row \{\s*display: flex !important/);
  // 六个单元格都要有落点，否则 flex 排布会乱序
  for (const c of ['sr-lc-check', 'sr-lc-title', 'sr-lc-mem', 'sr-lc-con', 'sr-lc-review', 'sr-lc-links']) {
    assert.ok(LV.includes('className="' + c + '"'), '缺少 ' + c);
    assert.ok(LV.includes('.' + c), c + ' 没有对应的窄屏规则');
  }
  // 记忆强度条独占一行，标题才有完整宽度
  assert.match(LV, /\.sr-lc-mem\s*\{ flex: 1 1 100%; \}/);
  // 亮度档胶囊横滑而不是折成两行高的方块
  assert.match(LV, /\.sr-list-bands \{\s*overflow-x: auto/);
});

/* 这一条是拿算术钉住那个真实的坑，而不是钉住某个选择器。
   曾经卡片布局只挂在 data-screen="phone"（≤720px），于是 721~1180px
   之间「标题」那一列的 1fr 被固定列吃干净——量出来 900px 以下**就是 0 宽**，
   一行里只剩两枚标签竖着排，标题整个不见。而那一段正是 iPad 竖屏 768 / 810、
   手机横屏 844、半屏窗口，绝不是边角。
   所以这里自己算一遍：网格换成卡片的那个阈值，必须宽到让标题还剩得下字。 */
test('卡片布局的阈值宽到标题列还排得下字', () => {
  const LV = read(KIT + 'ListView.jsx');

  const grid = LV.match(/const GRID = '([^']+)'/)[1].split(/\s+/);
  const fixed = grid.filter(c => c.endsWith('px')).reduce((a, c) => a + parseFloat(c), 0);
  const gap = (grid.length - 1) * 14;                 // gridTemplateColumns 的 gap: 14
  const rowPad = 16 * 2;                              // 行自己的左右内边距
  assert.equal(grid.filter(c => c === '1fr').length, 1, '标题应当是唯一那根 1fr');

  // 换布局的阈值：JS 与 CSS 认同一个数
  const bp = Number(RESP.match(/narrow:\s*(\d+)/)[1]);
  assert.ok(LV.includes('html[data-narrow]'), '列表要挂 data-narrow，别再写死 phone');
  assert.ok(RESP.includes('el.dataset.narrow'), 'SRScreen 要把 narrow 落成 html 属性');

  /* 阈值那一刻，标题还剩多少？容器宽度 ≈ 视口 − 侧栏 260 − 视图内边距 30×2。
     留给标题的是：容器 − 固定列 − 间距 − 行内边距。 */
  const left = bp - 260 - 60 - fixed - gap - rowPad;
  assert.ok(left >= 120,
    `阈值 ${bp}px 处标题列只剩 ${Math.round(left)}px（固定列 ${fixed} + 间距 ${gap}）——` +
    '宽到这里就该换卡片了，否则标题会被挤没');
});

/* iOS 的规矩：聚焦一个字号 < 16px 的输入框，Safari 会把整页放大去凑那 16px，
   而且不会自己缩回来——点一下搜索框，整个星图就歪着，得自己双指捏回去。
   站里的输入框在桌面上是 13/14/14.5px，所以这条不是「顺手加的」，是必须的。 */
test('触摸端的输入框字号不低于 16px（否则 iOS 聚焦即放大整页）', () => {
  const m = SHELL.match(/html\[data-pointer="coarse"\] input[^{]*\{([^}]*)\}/);
  assert.ok(m, '缺少触摸端输入框的字号规则');
  /* 字号全站用 rem（浏览器「仅放大文字」要生效就得是 rem）。这里钉的是成因：
     默认 16px 根字号下 ≥16px——px 直接比，rem 换算后比。 */
  const fs = m[1].match(/font-size:\s*([\d.]+)(px|rem)\s*!important/);
  assert.ok(fs, '触摸端输入框规则里要有 !important 的字号');
  const px = fs[2] === 'rem' ? parseFloat(fs[1]) * 16 : parseFloat(fs[1]);
  assert.ok(px >= 16, `触摸端输入框字号折合 ${px}px，低于 16px`);
  // 复选框 / 单选 / 滑块不该被拉大（它们的尺寸不是字号决定的）
  const sel = SHELL.match(/(html\[data-pointer="coarse"\] input[^{]*)\{/)[1];
  for (const t of ['checkbox', 'radio', 'range']) {
    assert.ok(sel.includes(`:not([type="${t}"])`), `应当排除 type=${t}`);
  }
});

/* 星核在世界坐标里只有 12×importance，画布整层还 scale(k)，落地取景常在
   0.34~0.7——屏幕上只剩 4~12px，手指按不着任何一颗星。
   热区必须除掉 k 才是「屏幕上的 44px」：写死一个 44 会随缩放一起缩。 */
test('星与星域主星在触摸端有 44px 的屏幕热区', () => {
  const SN = read('components/knowledge/StarNode.jsx');
  const SM = read(KIT + 'StarMap.jsx');
  assert.match(SN, /hit = 0,/, 'StarNode 要接受 hit');
  assert.match(SN, /onClick && hit > core/, '热区只在可点且比星核大时才铺');
  assert.match(SN, /width: hit, height: hit/);
  // 除以 k：这是这条测试真正要钉的东西
  assert.match(SM, /44 \/ Math\.max\(0\.2, view\.k\)/, '知识星的热区要除掉缩放');
  assert.match(SM, /44 \/ Math\.max\(0\.2, k\)/, '星域主星的热区要除掉缩放');
  assert.match(SM, /scr\.touch \? 44/, '只给触摸端：鼠标点得准，加了反而抢画布的平移');
  assert.match(SM, /hit=\{touchHit\}/);
});

/* 知识栏那六块（大纲 / 连接的星 / 反向链接 / 记忆 / 在星图中定位 / AI 助手）
   原先在 ≤1180px 一句 display:none 就没了——不是收起来，是没有入口。
   栏体必须是同一份 JSX：复制两份迟早长歪。 */
test('编辑器的知识栏在窄屏有入口，且与桌面共用同一份栏体', () => {
  const ED = read(KIT + 'Editor.jsx');
  assert.match(ED, /const railBody = \(/, '栏体要抽成常量');
  assert.equal((ED.match(/\{railBody\}/g) || []).length, 2, '桌面 aside 与窄屏弹层各用一次');
  assert.match(ED, /<MobileSheet open onClose=\{\(\) => setRailOpen\(false\)\}/);
  assert.match(ED, /narrow && railOpen/);
  assert.match(ED, /name="panel-right"/, '窄屏头部要有打开知识栏的按钮');
  assert.match(ED, /html\[data-narrow\] \.sr-ed-rail \{ display: none/);
  // 按钮的出现条件与 CSS 的收栏条件必须是同一个数，否则中间有一段「栏没了、按钮也没有」
  assert.match(ED, /window\.SRKit\.useScreen\(\)\.narrow/);
});

test('编辑器底部状态栏让开 Home 指示条', () => {
  const ED = read(KIT + 'Editor.jsx');
  const m = ED.match(/html\[data-screen="phone"\] \.sr-ed-status \{([^}]*)\}/);
  assert.ok(m, '缺少手机上的状态栏规则');
  assert.match(m[1], /padding-bottom: calc\(7px \+ var\(--sr-safe-bottom\)\)/);
  // 那条 ⌘K 提示是纯键盘话术，且在 390px 上会溢出——归 .sr-kbd-only 管
  assert.match(ED, /className="sr-kbd-only" title=\{window\.SRKeys\.combo\('K'\)/);
});

/* 这份样式表从前只由三个 phone 断点才挂载的组件在 useEffect 里注入，
   于是它在别的尺寸上根本不存在，两头都坏：
     · 桌面少了 `.sr-touch-only { display:none }`，黑洞提示条把两句互斥的话连着印成
       「滚轮缩放双指捏合缩放」；
     · iPad 的 pointer:coarse 明明为真，`.sr-hit-pad` 的热区与 `.sr-kbd-only` 却全是空文。
   表里每条都自带 html[data-screen] / html[data-pointer] 前缀，本来就自己看门。 */
test('移动端样式表加载即注入，不由「谁挂载了」决定', () => {
  // 模块层面调用一次：不在任何组件的 useEffect 里
  assert.match(SHELL, /^injectMobileCss\(\);/m, '应当在模块加载时就注入');
  // 每条规则都得自带前缀，否则「一律注入」会误伤桌面
  const css = SHELL.match(/const SR_MOBILE_CSS = `([\s\S]*?)`;/)[1];
  const rules = css.split('\n').filter(l => /^[.\w[]/.test(l.trim()) && l.includes('{'));
  for (const r of rules) {
    const sel = r.split('{')[0].trim();
    const scoped = /html\[data-(screen|pointer|narrow|short)/.test(sel)
      || /^\.sr-m-/.test(sel)                       // 外壳自己的类，只有手机才渲染
      || /^\.sr-touch-only/.test(sel)               // 成对的那一半，默认隐藏即是本意
      || /^@|^\s*from|^\s*to/.test(sel);
    assert.ok(scoped, `「${sel}」没有断点前缀，全局注入会误伤桌面`);
  }
});

test('体检页写死列数的网格在窄屏收口', () => {
  const CK = read(KIT + 'Checkup.jsx');
  assert.match(CK, /className="sr-ck-2col"/);
  assert.match(CK, /className="sr-ck-4col"/);
  assert.match(SHELL, /\.sr-ck-2col \{ grid-template-columns: 1fr !important; \}/);
  assert.match(SHELL, /\.sr-ck-4col \{ grid-template-columns: 1fr 1fr !important; \}/);
});

/* 这条是「别再漏」的守门人：定宽单元格（width: N + flex:'none'）一旦在窄屏
   排不下，容器里的中文就会被压成一字一行。所以凡是有定宽格的行，都必须挂上
   窄屏钩子（.sr-adm-cell / .sr-lc-* / 各视图自己的规则）。
   新写一张表却忘了适配时，这条测试会点名指出是哪个文件。 */
test('每个有定宽单元格的视图都必须有窄屏落点——不许再漏一张表', () => {
  const files = readdirSync(join(ROOT, KIT)).filter(f => f.endsWith('.jsx'));
  const HOOKS = ['sr-adm-cell', 'sr-lc-', 'sr-bh-list', 'sr-ed-rail', 'data-screen="phone"', 'sr-modal-panel', 'sr-set-nav'];
  const offenders = [];
  for (const f of files) {
    const src = readFileSync(join(ROOT, KIT, f), 'utf8');
    const fixed = [...src.matchAll(/width: (\d{2,3}), flex: 'none'/g)].map(m => Number(m[1]));
    const total = fixed.reduce((a, b) => a + b, 0);
    if (total <= 320) continue;                       // 窄屏放得下，不必适配
    if (HOOKS.some(h => src.includes(h))) continue;   // 已经有窄屏落点
    offenders.push(`${f}（定宽合计 ${total}px）`);
  }
  assert.deepEqual(offenders, [], '这些视图有排不下的定宽列，却没有任何窄屏适配：\n' + offenders.join('\n'));
});

test('管理台四张表全部卡片化——不只是「旅客」那一张', () => {
  const ADM = read(KIT + 'AdminConsole.jsx');
  // 旅客 / 分享 / 会话 / 游客 IP / 游客明细，共五处行容器
  // 认的是「挂了这个类」，不是「className 里只有这个类」——有的行还并着 .sr-focus-ring
  assert.equal((ADM.match(/className="[^"]*\bsr-adm-row\b[^"]*"/g) || []).length, 5,
    '五处行容器（旅客·分享·会话·游客IP·游客明细）都要挂 .sr-adm-row');
  // 名字格要允许换行，否则被压窄时中文一个字一行地竖下来
  assert.match(ADM, /\.sr-adm-name > \* \{ white-space: normal !important; \}/);
  assert.match(ADM, /\.sr-adm-head-bar \{ flex-direction: column !important/);
});

test('黑洞视图在窄屏上下叠——404px 的列表会把视觉挤没', () => {
  const BH = read(KIT + 'BlackHole.jsx');
  assert.match(BH, /html\[data-screen="phone"\] \.sr-bh-stage \{ flex-direction: column !important/);
  assert.match(BH, /\.sr-bh-list \{\s*width: 100% !important/);
  assert.match(BH, /className="sr-bh-visual"/);
});

test('管理台表格在窄屏改卡片：表头隐去，每格自带标签', () => {
  const ADM = read(KIT + 'AdminConsole.jsx');
  assert.match(ADM, /html\[data-screen="phone"\] \.sr-adm-head \{ display: none/);
  assert.match(ADM, /\.sr-adm-cell\[data-k\]::before/);
  assert.match(ADM, /className="[^"]*\bsr-adm-row\b[^"]*"/);
  const cells = ADM.match(/className="sr-adm-cell"/g) || [];
  assert.ok(cells.length >= 4, '用户行的各列都该挂 .sr-adm-cell，实得 ' + cells.length);
});

/* ——— 跨平台：玻璃在旧 iOS Safari 上不能塌掉 ———
   玻璃拟态是这套设计的地基。`backdrop-filter` 在 Safari 18 之前只认带前缀的
   `-webkit-backdrop-filter`——少了它，iPhone 上那些玻璃面不是「少个效果」，
   而是整块变成半透明色块，换了一副面孔。
   这条把「每一处都成对出现」钉住：新写一处玻璃时忘了前缀，这里当场红。 */
test('每一处 backdrop-filter 都配了 -webkit- 前缀（旧版 iOS Safari）', () => {
  const files = [
    'tokens/effects.css', 'docs/docs.css',
    ...readdirSync(join(ROOT, 'components')).flatMap(d => {
      const dir = join(ROOT, 'components', d);
      try { return readdirSync(dir).filter(f => f.endsWith('.jsx')).map(f => `components/${d}/${f}`); }
      catch { return []; }
    }),
    ...readdirSync(join(ROOT, KIT)).filter(f => /\.(jsx|js)$/.test(f)).map(f => KIT + f),
  ];
  const unpaired = [];
  for (const rel of files) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    // 独立成行的 CSS 声明：上一行必须是前缀版
    const lines = src.split('\n');
    lines.forEach((l, i) => {
      if (/^\s*backdrop-filter:/.test(l) && !/-webkit-backdrop-filter/.test(lines[i - 1] || '')) {
        unpaired.push(`${rel}:${i + 1}（CSS 声明）`);
      }
    });
    // 同一行里的 CSS 串 / JSX 内联对象：前面不远处必须有前缀版
    for (const m of src.matchAll(/(?<!-)backdrop-filter:/g)) {
      if (!src.slice(Math.max(0, m.index - 90), m.index).includes('-webkit-backdrop-filter:')) {
        if (!/^\s*backdrop-filter:/m.test(src.slice(src.lastIndexOf('\n', m.index) + 1, m.index + 20))) {
          unpaired.push(`${rel}（CSS 串 @${m.index}）`);
        }
      }
    }
    for (const m of src.matchAll(/(?<!Webkit)backdropFilter:/g)) {
      if (!src.slice(Math.max(0, m.index - 90), m.index).includes('WebkitBackdropFilter:')) {
        unpaired.push(`${rel}（JSX 内联 @${m.index}）`);
      }
    }
  }
  assert.deepEqual(unpaired, [], '这些地方少了 -webkit- 前缀：\n  ' + unpaired.join('\n  '));
});
