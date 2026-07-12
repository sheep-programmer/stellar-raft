# 星图手册 · 新手引导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给星图桌面端 UI Kit 增加「新手引导」——首次打开自动弹出的 11 页分页导览册（介绍所有功能），末页可切换到聚光实地导览，并能在设置里随时回看。

**Architecture:** 沿用应用现有 overlay 模式（`Settings`/`CommandPalette` 都是 `app.jsx` 里状态开关挂载的居中玻璃 modal）。新增 `Onboarding.jsx`，导出 `Onboarding`（分页册 modal）+ `OnboardingTour`（聚光 overlay）到 `window.SRKit`。首次判断用 `localStorage['sr.onboarded']`。聚光只指向星图主界面的稳定 chrome，靠 `data-tour` 锚点定位。

**Tech Stack:** React 18（浏览器内 `@babel/standalone` 编译的 `text/babel` JSX）· 设计系统 bundle `window.StellarRaftDesignSystem_2866af`（GlassPanel/Button/Icon/IconButton）· Lucide 图标 · localStorage 持久化。

## Global Constraints

- **无 emoji、无 unicode 符号字形做图标**——绝对品牌律；图标一律走 Lucide（`Icon`/`IconButton`）。
- **三色预算**：冷星蓝 `#9fc6ff`（结构）· 暖金 `#ffd98a→#ffb86b`（奖励/点亮）· 深空背景。别的不给色。
- **文案**：天文台叙述者口吻，第二人称「你」，安静诗意，不催促、不 hype、不过度解释隐喻。中文优先。
- **玻璃拟态 + `--ease-flight` 缓动**；`prefers-reduced-motion` 下静音。
- 组件注册到 `window.SRKit`（`window.SRKit = Object.assign(window.SRKit || {}, { … })`）。
- JSX 文件在 `index.html` 以 `<script type="text/babel" src="X.jsx?v=N">` 加载；改动文件后递增其 `?v=`。
- 这是 cosmetic recreation——交互可 faked；React 组件无法在 node 单测，自动化测试退化为对源码的结构性断言，行为验证靠浏览器实地 drive。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `ui_kits/stellar-raft/Onboarding.jsx` | **新增**。`SR_GUIDE_PAGES`（11 页数据）· `SR_TOUR_STEPS`（聚光步骤）· `GuideArt`（复用插画）· `Onboarding`（册 modal）· `OnboardingTour`（聚光 overlay）。注册到 `window.SRKit`。 |
| `ui_kits/stellar-raft/app.jsx` | **改**。新增 `onboard`/`tour` state、首弹 effect、`finishOnboard`/`startTour`/`replayGuide` 回调、overlay 挂载、给 `<Settings>` 传 `onReplayGuide`。 |
| `ui_kits/stellar-raft/Settings.jsx` | **改**。左侧导航新增「上手引导」分区 + 「重新观看引导」按钮，接 `onReplayGuide` prop。 |
| `ui_kits/stellar-raft/Sidebar.jsx` | **改**。搜索框容器加 `data-tour="search"`；`NavRow` 加 `dataTour` prop，复习行传 `dataTour="review"`。 |
| `ui_kits/stellar-raft/StarMap.jsx` | **改**。底部缩放/工具胶囊容器加 `data-tour="tools"`。 |
| `ui_kits/stellar-raft/index.html` | **改**。新增 `Onboarding.jsx?v=1` 脚本行；递增 `app.jsx`/`Settings.jsx`/`Sidebar.jsx`/`StarMap.jsx` 的 `?v=`。 |
| `tests/onboarding.test.js` | **新增**。对 `Onboarding.jsx` 源码的结构性断言（页数、无 emoji、SRKit 注册、data-tour 锚点存在）。 |
| `ui_kits/stellar-raft/README.md` | **改**（收尾）。补一段引导说明。 |

---

## Task 1: Onboarding 骨架 + 首次自动弹出（端到端可 drive 的最小闭环）

先立起「首次打开 → 一个玻璃 modal 出现 → 关闭后不再自动弹」的最小闭环。此 Task 后可在浏览器实地看到弹窗（内容为占位单页，Task 2 填满）。

**Files:**
- Create: `ui_kits/stellar-raft/Onboarding.jsx`
- Modify: `ui_kits/stellar-raft/app.jsx`（state + effect + 挂载）
- Modify: `ui_kits/stellar-raft/index.html`（新增脚本行 + bump app.jsx）

**Interfaces:**
- Produces: `window.SRKit.Onboarding`，props `{ onClose: () => void, onSpotlight: () => void }`。本 Task 里 `onSpotlight` 可传入但按钮 Task 2 才出现。
- Produces（app.jsx 内部）：`finishOnboard()` 写 `localStorage['sr.onboarded']='1'` 并 `setOnboard(false)`。

- [ ] **Step 1: 创建 `Onboarding.jsx` 最小骨架**

```jsx
/* Onboarding — 星图手册 · 新手引导。
   分页玻璃导览册（Onboarding）+ 末页聚光实地导览（OnboardingTour）。
   首次打开自动弹出（app.jsx 判 localStorage['sr.onboarded']），设置里可回看。
   props: Onboarding { onClose, onSpotlight } · OnboardingTour { onClose } */
const { Button, GlassPanel, Icon, IconButton } = window.StellarRaftDesignSystem_2866af;

// 11 页内容（Task 2 填满 body 与配图 icon）。此处先放 1 页占位，保证组件可渲染。
const SR_GUIDE_PAGES = [
  { id: 'welcome', kicker: 'WELCOME', icon: 'sparkles', warm: true,
    title: '知识是唯一的光', body: '别人的笔记堆在仓库里；你的笔记是一片活着的深空。' },
];

function Onboarding({ onClose, onSpotlight }) {
  const [page, setPage] = React.useState(0);
  const total = SR_GUIDE_PAGES.length;
  const last = page === total - 1;
  const p = SR_GUIDE_PAGES[page];

  const modalRef = React.useRef(null);
  (window.SRKit && window.SRKit.useModalFocus ? window.SRKit.useModalFocus : () => {})(modalRef, { swallowCmdK: true });

  React.useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setPage(v => Math.min(v + 1, total - 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setPage(v => Math.max(v - 1, 0)); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose, total]);

  return (
    <div ref={modalRef} onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="新手引导"
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(3,4,12,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: '94vw', height: 520, maxHeight: '92vh', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="lg" pad="none" glow style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* header: kicker + 进度点 + 跳过 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', flex: 'none' }}>
            <span style={{ fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{p.kicker}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {SR_GUIDE_PAGES.map((_, i) => (
                <button key={i} type="button" onClick={() => setPage(i)} aria-label={'第 ' + (i + 1) + ' 页'}
                  style={{ width: i === page ? 16 : 7, height: 7, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)',
                    background: i === page ? 'var(--gold)' : 'var(--text-3)', opacity: i === page ? 1 : 0.4,
                    boxShadow: i === page ? '0 0 8px rgba(255,217,138,0.55)' : 'none',
                    transition: 'width var(--dur-base) var(--ease-flight), background var(--dur-fast), opacity var(--dur-fast)' }} />
              ))}
            </div>
            <button type="button" onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>跳过</button>
          </div>

          {/* body: 插画 + 标题 + 短文（Task 2 接入 GuideArt） */}
          <div key={page} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px 40px 20px', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
            <Icon name={p.icon} size={40} color={p.warm ? 'var(--gold)' : 'var(--star-blue)'} />
            <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-1)', marginTop: 22, letterSpacing: '0.02em', textShadow: '0 0 16px rgba(159,198,255,0.18)' }}>{p.title}</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.85, marginTop: 14, maxWidth: 420 }}>{p.body}</div>
          </div>

          {/* footer: 上一页 / 下一页；末页换 实地看看 + 开始使用 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderTop: '1px solid var(--line)', flex: 'none' }}>
            <Button size="sm" variant="ghost" icon="chevron-left" disabled={page === 0} onClick={() => setPage(v => Math.max(v - 1, 0))}>上一页</Button>
            {last ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <Button size="sm" variant="ghost" icon="compass" onClick={onSpotlight}>实地看看</Button>
                <Button size="sm" variant="primary" glow icon="check" onClick={onClose}>开始使用</Button>
              </div>
            ) : (
              <Button size="sm" variant="primary" icon="chevron-right" iconRight onClick={() => setPage(v => Math.min(v + 1, total - 1))}>下一页</Button>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

// OnboardingTour 占位（Task 3 实现）——先注册，避免 app.jsx 解构 undefined。
function OnboardingTour({ onClose }) { return null; }

window.SRKit = Object.assign(window.SRKit || {}, { Onboarding, OnboardingTour });
```

> 注：`Button` 的 `iconRight` prop 若设计系统不支持，去掉即可（图标默认在左，不影响功能）；实现时对照 `_ds_bundle.js` 里 `Button` 的实际 props，以 bundle 为准。

- [ ] **Step 2: 在 `index.html` 注册脚本**

在 `Settings.jsx` 脚本行（`<script type="text/babel" src="Settings.jsx?v=67"></script>`）之后、`AIConfig.jsx` 行之前，新增一行：

```html
    <script type="text/babel" src="Onboarding.jsx?v=1"></script>
```

同时把 `app.jsx` 的版本位递增（`app.jsx?v=75` → `app.jsx?v=76`）。

- [ ] **Step 3: 在 `app.jsx` 接入 state、首弹 effect 与挂载**

在解构 `window.SRKit` 那行（`const { Sidebar, …, ReviewSession } = window.SRKit;`）末尾补上 `Onboarding, OnboardingTour`。

在 `const [aiConfigOpen, setAiConfigOpen] = React.useState(false);` 之后新增：

```jsx
  const [onboard, setOnboard] = React.useState(false); // 新手引导册
  const [tour, setTour] = React.useState(false);       // 聚光实地导览
```

在「淡出 sr-boot」的 effect 之后新增首弹 effect 与回调：

```jsx
  // 首次打开自动弹出新手引导（看过/跳过后写标记，不再自动弹）
  React.useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem('sr.onboarded') === '1'; } catch (e) {}
    if (!seen) setOnboard(true);
  }, []);

  const finishOnboard = () => {
    try { localStorage.setItem('sr.onboarded', '1'); } catch (e) {}
    setOnboard(false);
  };
  const startTour = () => { finishOnboard(); backToMap(); setTour(true); };
  const replayGuide = () => { setSettingsOpen(false); setOnboard(true); };
```

> `backToMap` 已在 app.jsx 定义（`const backToMap = () => { setView('map'); … }`）。`startTour` 须定义在 `backToMap` 之后（JS 函数表达式，注意顺序；`backToMap` 是 `const` 箭头，放在其后即可）。

在 overlay 挂载区（`{aiConfigOpen && <AIConfig … />}` 那一带）新增：

```jsx
      {onboard && <Onboarding onClose={finishOnboard} onSpotlight={startTour} />}
      {tour && <OnboardingTour onClose={() => setTour(false)} />}
```

- [ ] **Step 4: 浏览器实地验证（本 Task 的行为测试）**

```bash
# 服务若未开：npm run serve （后台）
# 关键：清掉标记以触发首弹
```
在浏览器 devtools console 执行 `localStorage.removeItem('sr.onboarded')` 后刷新 `http://localhost:8756/ui_kits/stellar-raft/`。
Expected：启动帧淡出后，居中出现玻璃 modal，显示「知识是唯一的光」占位页；点「跳过」关闭；刷新后**不再**自动弹（因已写 `sr.onboarded='1'`）。截图确认。

- [ ] **Step 5: Commit**

```bash
git add ui_kits/stellar-raft/Onboarding.jsx ui_kits/stellar-raft/app.jsx ui_kits/stellar-raft/index.html
git commit -m "feat(onboarding): 首弹骨架 + 分页册 modal 外壳"
```

---

## Task 2: 填满 11 页内容 + 复用插画 GuideArt

把占位单页扩成完整 11 页，并给每页配一枚复用的发光插画。

**Files:**
- Modify: `ui_kits/stellar-raft/Onboarding.jsx`（`SR_GUIDE_PAGES` 扩为 11 项；新增 `GuideArt`；body 接入 `GuideArt`）
- Modify: `ui_kits/stellar-raft/index.html`（bump `Onboarding.jsx?v=1` → `?v=2`）

**Interfaces:**
- Consumes: Task 1 的 `Onboarding` 外壳。
- Produces: `SR_GUIDE_PAGES` 定长 11、每项 `{ id, kicker, icon, warm, title, body }`；`GuideArt({ icon, warm })`。

- [ ] **Step 1: 新增复用插画组件 `GuideArt`**

在 `SR_GUIDE_PAGES` 之后、`Onboarding` 之前插入。图标居中于两层发光同心环 + 几点星尘，冷蓝或暖金二选一：

```jsx
/* 复用插画：Lucide 图标居中 + 同心发光环 + 星尘。冷蓝(结构)/暖金(奖励)二选一。 */
function GuideArt({ icon, warm }) {
  const c = warm ? '255,217,138' : '159,198,255';
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: 132, height: 132, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'absolute', width: 132, height: 132, borderRadius: '50%', border: '1px solid rgba(' + c + ',0.14)' }} />
      <span style={{ position: 'absolute', width: 92, height: 92, borderRadius: '50%', border: '1px solid rgba(' + c + ',0.22)',
        boxShadow: '0 0 22px rgba(' + c + ',0.16), inset 0 0 18px rgba(' + c + ',0.10)',
        animation: reduce ? 'none' : 'sr-breathe 5.2s var(--ease-flight) infinite' }} />
      <span style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', background: 'rgba(' + c + ',0.06)', filter: 'blur(2px)' }} />
      <Icon name={icon} size={30} color={warm ? 'var(--gold)' : 'var(--star-blue)'} />
      {[[-46, -30, 1.6], [44, -20, 1.2], [30, 42, 1.4], [-38, 34, 1.1]].map((s, i) => (
        <span key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: s[2] * 2, height: s[2] * 2, borderRadius: '50%',
          transform: 'translate(' + s[0] + 'px,' + s[1] + 'px)', background: 'rgba(' + c + ',0.8)', boxShadow: '0 0 6px rgba(' + c + ',0.7)' }} />
      ))}
    </div>
  );
}
```

> `sr-breathe` 是设计系统既有 keyframe（星辰呼吸）。若名称不符，实现时用 `tokens/effects.css` 里实际的呼吸/发光 keyframe 名替换；找不到就删掉该 `animation` 行（静态也成立）。

- [ ] **Step 2: body 区接入 `GuideArt`**

把 Task 1 body 里的 `<Icon name={p.icon} … />` 一行替换为：

```jsx
            <GuideArt icon={p.icon} warm={p.warm} />
```

- [ ] **Step 3: 把 `SR_GUIDE_PAGES` 扩成完整 11 页**

整体替换 `SR_GUIDE_PAGES` 常量（文案遵守 Global Constraints；icon 用 Lucide 名）：

```jsx
const SR_GUIDE_PAGES = [
  { id: 'welcome',  kicker: 'WELCOME',      icon: 'sparkles',  warm: true,
    title: '知识是唯一的光',   body: '别人的笔记堆在仓库里；你的笔记是一片活着的深空。记得越牢，星越亮；久不回望，它会慢慢变暗。' },
  { id: 'map',      kicker: 'STAR MAP',     icon: 'orbit',     warm: false,
    title: '你的星图',         body: '拖空白平移，滚轮缩放就像飞行般靠近或远离。在空白处右键，建一片星域，或点亮一颗新的知识星。' },
  { id: 'memory',   kicker: 'MEMORY',       icon: 'activity',  warm: false,
    title: '会生长，也会遗忘', body: '每颗星的亮度就是你此刻的记忆强度，按真实时间衰减。放着不看，它会一天天冷下去——这是提醒，不是责备。' },
  { id: 'ignite',   kicker: 'IGNITE',       icon: 'flame',     warm: true,
    title: '点亮一颗星',       body: '在费曼内化模式里把这颗星讲透，它才被真正「点亮」——一次金色的时刻，记忆稳定度随之升起。' },
  { id: 'review',   kicker: 'REVIEW',       icon: 'repeat',    warm: false,
    title: '让星不熄灭',       body: '复习会话按到期先后取卡：忘了 · 模糊 · 记得。间隔重复让亮起来的星，不再悄悄熄灭。' },
  { id: 'inbox',    kicker: 'INBOX',        icon: 'inbox',     warm: false,
    title: '随手收，慢慢理',   body: '灵光一现先 ⌘Enter 收进收件箱，之后按建议一键归入星域。好友的星际来信也落在这里。' },
  { id: 'editor',   kicker: 'EDITOR',       icon: 'pen-line',  warm: false,
    title: '专业的编辑台',     body: '块编辑、markdown 快捷输入、⌘F 查找替换、导入导出——像主流笔记软件一样顺手，又始终安静好看。' },
  { id: 'views',    kicker: 'AERIAL · 3D',  icon: 'satellite', warm: false,
    title: '换一个视角',       body: '亮度鸟瞰把整片星空摊成一张热图，一眼看清哪里正亮、哪里正暗；三维星系则让你在星海里绕行。' },
  { id: 'trash',    kicker: 'BLACK HOLE',   icon: 'aperture',  warm: false,
    title: '删掉的去了哪',     body: '删除的星与星域坠入黑洞，绕着事件视界打转。想它回来，随时把它捞出，位置与连接都还在。' },
  { id: 'visit',    kicker: 'VISIT',        icon: 'telescope', warm: true,
    title: '星与星的相逢',     body: '用分享码邀请好友造访你的星系，也去看看别人的深空。遇到心动的星，把它收进自己的星域。' },
  { id: 'shortcuts', kicker: 'SHORTCUTS',   icon: 'keyboard',  warm: true,
    title: '就这些，去点亮吧', body: '⌘K 跳转任意星 · ⌘F 笔记内查找 · / 唤起块菜单 · Esc 收起浮层。想再看这份手册，去设置里找「上手引导」。' },
];
```

- [ ] **Step 4: bump 版本 + 浏览器实地验证**

`index.html` 里 `Onboarding.jsx?v=1` → `?v=2`。
console 执行 `localStorage.removeItem('sr.onboarded')` 后刷新。
Expected：11 页可用「下一页/上一页」「←/→」「进度点」翻阅；每页图标、标题、短文、发光插画正确；首页「上一页」禁用；末页出现「实地看看」+「开始使用」。逐页检查**无 emoji**。截图首页 + 中间页 + 末页。

- [ ] **Step 5: Commit**

```bash
git add ui_kits/stellar-raft/Onboarding.jsx ui_kits/stellar-raft/index.html
git commit -m "feat(onboarding): 完整 11 页内容 + 复用发光插画"
```

---

## Task 3: 聚光实地导览 OnboardingTour + data-tour 锚点

实现末页「实地看看」触发的聚光高亮，指向星图主界面的稳定 chrome。

**Files:**
- Modify: `ui_kits/stellar-raft/Onboarding.jsx`（实现 `OnboardingTour` + `SR_TOUR_STEPS`）
- Modify: `ui_kits/stellar-raft/Sidebar.jsx`（加 `data-tour` 锚点）
- Modify: `ui_kits/stellar-raft/StarMap.jsx`（加 `data-tour="tools"`）
- Modify: `ui_kits/stellar-raft/index.html`（bump `Onboarding.jsx?v=2`→`?v=3`、`Sidebar.jsx`、`StarMap.jsx` 版本）

**Interfaces:**
- Consumes: `startTour`（Task 1，已 `backToMap()` 确保在星图视图）。
- Produces: `SR_TOUR_STEPS` 数组，每项 `{ target: string(css选择器), title, body }`。

- [ ] **Step 1: Sidebar 加 data-tour 锚点**

`Sidebar.jsx` 中：
1. 给搜索容器 `<div style={{ cursor: 'pointer' }} onClick={onSearch}>`（约 line 146）加属性 → `<div data-tour="search" style={{ cursor: 'pointer' }} onClick={onSearch}>`。
2. 给 `NavRow` 增加 `dataTour` 支持：函数签名 `function NavRow({ icon, label, active, badge, collapsed, onClick, dawn, tip })` 加入 `dataTour`；在 `<button …>` 上增加属性 `data-tour={dataTour}`。
3. 复习那行（约 line 165）传入：`<NavRow icon="repeat" label="复习" dataTour="review" … />`。

- [ ] **Step 2: StarMap 加 data-tour="tools"**

`StarMap.jsx` 底部缩放/工具胶囊容器（约 line 714）：
`<div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 26, right: 24, zIndex: 30 }}>`
→ 加属性 `data-tour="tools"`。

- [ ] **Step 3: 定义 `SR_TOUR_STEPS`（Onboarding.jsx，紧跟 `SR_GUIDE_PAGES` 之后）**

```jsx
// 聚光步骤——只指向星图主界面的稳定 chrome；找不到的目标优雅跳过。
const SR_TOUR_STEPS = [
  { target: '[data-tour="search"]', title: '随时跳转', body: '⌘K 或点这里，跳到任意一颗星、任意一个视图。' },
  { target: '[data-tour="review"]', title: '到期复习', body: '角标是今天到期的星数。点它开始一轮复习，让星不熄灭。' },
  { target: '[data-tour="tools"]',  title: '换个视角', body: '这里切换亮度鸟瞰与三维星系，也能缩放、复位画布。' },
];
```

- [ ] **Step 4: 实现 `OnboardingTour`（替换 Task 1 的 `return null` 占位）**

```jsx
function OnboardingTour({ onClose }) {
  const [i, setI] = React.useState(0);
  const [rect, setRect] = React.useState(null);
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 定位当前步目标；找不到则跳过到下一个可见目标，全部找不到就结束。
  const locate = React.useCallback((from) => {
    for (let j = from; j < SR_TOUR_STEPS.length; j++) {
      const el = document.querySelector(SR_TOUR_STEPS[j].target);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { setI(j); setRect(r); return true; }
      }
    }
    return false;
  }, []);

  React.useEffect(() => { if (!locate(0)) onClose(); }, [locate, onClose]);

  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  if (!rect) return null;
  const step = SR_TOUR_STEPS[i];
  const last = i === SR_TOUR_STEPS.length - 1;
  const next = () => { if (last) onClose(); else if (!locate(i + 1)) onClose(); };

  const pad = 8;
  const hole = { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  // 气泡放在光洞右侧；靠右则翻到左侧
  const bubbleLeft = hole.left + hole.width + 14 > window.innerWidth - 300
    ? Math.max(16, hole.left - 300 - 14) : hole.left + hole.width + 14;
  const bubbleTop = Math.min(Math.max(16, hole.top), window.innerHeight - 160);

  return (
    <div onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="实地导览"
      style={{ position: 'fixed', inset: 0, zIndex: 140 }}>
      {/* 挖光洞：目标处透明，四周暗化（超大 spread 阴影）+ 发光描边 */}
      <div style={{ position: 'fixed', left: hole.left, top: hole.top, width: hole.width, height: hole.height,
        borderRadius: 'var(--r-md)', boxShadow: '0 0 0 9999px rgba(3,4,12,0.66), 0 0 22px rgba(159,198,255,0.35)',
        border: '1px solid rgba(159,198,255,0.6)', pointerEvents: 'none',
        transition: reduce ? 'none' : 'left var(--dur-base) var(--ease-flight), top var(--dur-base) var(--ease-flight), width var(--dur-base) var(--ease-flight), height var(--dur-base) var(--ease-flight)' }} />
      {/* 气泡 */}
      <div onMouseDown={(e) => e.stopPropagation()}
        style={{ position: 'fixed', left: bubbleLeft, top: bubbleTop, width: 280, animation: reduce ? 'none' : 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
        <GlassPanel strong radius="md" pad="none" glow>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 14.5, color: 'var(--text-1)', fontWeight: 300 }}>{step.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.75, marginTop: 8 }}>{step.body}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{(i + 1)} / {SR_TOUR_STEPS.length}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" variant="ghost" onClick={onClose}>结束</Button>
                <Button size="sm" variant="primary" glow icon={last ? 'check' : 'chevron-right'} onClick={next}>{last ? '完成' : '下一步'}</Button>
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: bump 版本 + 浏览器实地验证**

`index.html`：`Onboarding.jsx?v=2`→`?v=3`，`Sidebar.jsx`、`StarMap.jsx` 版本各 +1。
清标记刷新 → 翻到末页 → 点「实地看看」。
Expected：册子关闭、回到星图，暗场中依次高亮 搜索框 → 复习 → 工具胶囊，气泡文案正确，「下一步/完成」推进，末步「完成」或 Esc 关闭。侧栏收起时对应步应被跳过而不报错（可先收起侧栏再测一次）。截图聚光态。

- [ ] **Step 6: Commit**

```bash
git add ui_kits/stellar-raft/Onboarding.jsx ui_kits/stellar-raft/Sidebar.jsx ui_kits/stellar-raft/StarMap.jsx ui_kits/stellar-raft/index.html
git commit -m "feat(onboarding): 聚光实地导览 + data-tour 锚点"
```

---

## Task 4: 设置里可回看

在 Settings 左侧导航加「上手引导」分区，提供「重新观看引导」。

**Files:**
- Modify: `ui_kits/stellar-raft/Settings.jsx`（nav 项 + 内容分区 + `onReplayGuide` prop）
- Modify: `ui_kits/stellar-raft/app.jsx`（给 `<Settings>` 传 `onReplayGuide={replayGuide}`）
- Modify: `ui_kits/stellar-raft/index.html`（bump `Settings.jsx`、`app.jsx` 版本）

**Interfaces:**
- Consumes: `replayGuide`（Task 1 已定义：关设置、开册子）。
- Produces: `Settings` 新增 prop `onReplayGuide`。

- [ ] **Step 1: Settings 接受新 prop 并加导航项**

`Settings.jsx`：
1. 函数签名 `function Settings({ onClose, theme, onToggleTheme })` → 加入 `onReplayGuide`。
2. `SR_SET_NAV` 数组在 `keys` 之后、`account` 之前插入一项：
```jsx
  { id: 'guide',   label: '上手引导', icon: 'compass' },
```

- [ ] **Step 2: 加「上手引导」内容分区**

在 `{tab === 'keys' && ( … )}` 块之后、`{tab === 'account' && ( … )}` 之前插入：

```jsx
              {tab === 'guide' && (
                <div>
                  <SRSectionTitle>上手引导</SRSectionTitle>
                  <div style={{ padding: '14px 0 4px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.85 }}>
                    第一次进来的那本「星图手册」——星图、点亮、复习、收件箱、黑洞、漫游，一页页讲清楚。想重温随时翻开。
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Button size="sm" variant="primary" glow icon="book-open"
                      onClick={() => { if (onReplayGuide) onReplayGuide(); }}>重新观看引导</Button>
                  </div>
                </div>
              )}
```

- [ ] **Step 3: app.jsx 传入 prop**

`{settingsOpen && <Settings onClose={() => setSettingsOpen(false)} theme={theme} onToggleTheme={toggleTheme} />}`
→ 加 `onReplayGuide={replayGuide}`。

- [ ] **Step 4: bump 版本 + 浏览器实地验证**

`index.html`：`Settings.jsx`、`app.jsx` 版本各 +1。
先 `localStorage.setItem('sr.onboarded','1')` 刷新（模拟老用户，不自动弹）→ 点左下角头像开设置 → 左侧点「上手引导」→ 点「重新观看引导」。
Expected：设置关闭、导览册重新弹出，可正常翻页。截图设置分区 + 回看弹出。

- [ ] **Step 5: Commit**

```bash
git add ui_kits/stellar-raft/Settings.jsx ui_kits/stellar-raft/app.jsx ui_kits/stellar-raft/index.html
git commit -m "feat(onboarding): 设置内「上手引导」回看入口"
```

---

## Task 5: 结构性自检测试 + README + 全流程 drive

加一个对源码的结构性断言测试守回归，补文档，跑一遍完整流程。

**Files:**
- Create: `tests/onboarding.test.js`
- Modify: `ui_kits/stellar-raft/README.md`

**Interfaces:**
- Consumes: 最终的 `Onboarding.jsx` / `Sidebar.jsx` / `StarMap.jsx` 源码。

- [ ] **Step 1: 写结构性断言测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ONB = read('ui_kits/stellar-raft/Onboarding.jsx');

test('Onboarding 注册 Onboarding 与 OnboardingTour 到 SRKit', () => {
  assert.match(ONB, /window\.SRKit\s*=\s*Object\.assign\(/);
  assert.match(ONB, /\bOnboarding\b/);
  assert.match(ONB, /\bOnboardingTour\b/);
});

test('导览册恰好 11 页，每页字段完整', () => {
  // 用 id: 'xxx' 标记计数（每页对象一个 id）
  const ids = ONB.match(/\bid:\s*'[a-z]+'/g) || [];
  assert.equal(ids.length, 11, '期望 11 页，实得 ' + ids.length);
  // 每页应有 title 与 body
  const titles = ONB.match(/\btitle:\s*'/g) || [];
  const bodies = ONB.match(/\bbody:\s*'/g) || [];
  assert.equal(titles.length, 11);
  assert.equal(bodies.length, 11);
});

test('无 emoji / 无杂色（品牌律）', () => {
  // 基本 emoji 区段扫描
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ONB), 'Onboarding.jsx 含 emoji');
});

test('聚光锚点在源码中成对存在', () => {
  assert.match(ONB, /\[data-tour="search"\]/);
  assert.match(ONB, /\[data-tour="review"\]/);
  assert.match(ONB, /\[data-tour="tools"\]/);
  assert.match(read('ui_kits/stellar-raft/Sidebar.jsx'), /data-tour="search"/);
  assert.match(read('ui_kits/stellar-raft/Sidebar.jsx'), /dataTour="review"/);
  assert.match(read('ui_kits/stellar-raft/StarMap.jsx'), /data-tour="tools"/);
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test`
Expected：新套件 `tests/onboarding.test.js` 全绿；既有套件不受影响仍全绿。若「11 页」断言因 `id:` 计数口径不符而失败，核对 `SR_GUIDE_PAGES`／`SR_TOUR_STEPS` 里 `id:` 出现次数（tour step 无 `id` 字段则不计入，符合预期）。

- [ ] **Step 3: 补 README**

在 `ui_kits/stellar-raft/README.md` 合适处（如「键盘与反馈」段附近）加一段：

```markdown
## 新手引导（星图手册）

首次打开自动弹出的分页导览册（`Onboarding.jsx`，11 页）——星图 / 记忆衰减 / 费曼点亮 / 复习 / 收件箱 / 编辑器 / 鸟瞰·3D / 黑洞 / 星际漫游 / 快捷键，逐页讲清。看过/跳过后写 `localStorage['sr.onboarded']`，不再自动弹。末页「实地看看」切到聚光实地导览（`OnboardingTour`，靠 `data-tour` 锚点高亮星图主界面的搜索 / 复习 / 工具胶囊）。随时可在设置「上手引导」里回看。
```

- [ ] **Step 4: 全流程浏览器 drive**

`localStorage.removeItem('sr.onboarded')` 刷新 → 首弹 → 翻完 11 页 → 实地看看走完聚光 → 刷新确认不再自动弹 → 设置「上手引导」回看。深空 + 黎明两主题各看一眼配色不破。截图留档。

- [ ] **Step 5: Commit**

```bash
git add tests/onboarding.test.js ui_kits/stellar-raft/README.md
git commit -m "test(onboarding): 结构性自检 + README 说明"
```

---

## Self-Review

**Spec coverage（对照设计文档各节）：**
- §3.1 导览册 modal → Task 1（外壳）+ Task 2（内容/插画）✓
- §3.2 聚光 OnboardingTour + 兜底跳过 → Task 3 ✓
- §4 App 集成（state/首弹/回调/挂载/Settings prop）→ Task 1 + Task 4 ✓
- §5 11 页大纲 → Task 2 `SR_GUIDE_PAGES` 逐页对应 ✓
- §6 视觉文案守则 → Global Constraints + 各 Task 文案 ✓
- §7 index.html 注册 → Task 1 Step 2 + 各 Task bump ✓
- §8 验证（结构自检 + 实地 drive）→ Task 5 + 各 Task 的实地验证步 ✓
- §2 触发（首弹 + 设置回看，不加侧栏入口）→ Task 1（首弹）+ Task 4（回看）✓

**Placeholder scan：** 无 TBD/TODO；SVG 插画已具体化为完整的 `GuideArt`；每页 copy 已写全。两处「以 bundle 为准」的注记（`Button.iconRight`、`sr-breathe` keyframe 名）是对既有资产的核对指引，非占位——都给了确定的退化方案。

**Type consistency：** `Onboarding` props `{ onClose, onSpotlight }`、`OnboardingTour` props `{ onClose }`、`Settings` 新 prop `onReplayGuide`、`NavRow` 新 prop `dataTour`、app 回调 `finishOnboard/startTour/replayGuide`——跨 Task 命名一致；`SR_GUIDE_PAGES`/`SR_TOUR_STEPS` 字段一致。
