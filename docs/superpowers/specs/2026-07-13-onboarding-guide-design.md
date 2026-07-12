# 星图手册 · 新手引导 — 设计文档

> 日期：2026-07-13 · 主题：onboarding-guide
> 目标：为星图桌面端 UI Kit 增加一套「新手引导」——首次打开自动弹出的分页导览册，
> 讲清所有功能与用法，末页可切换到聚光实地导览；随时可在设置里回看。

---

## 1. 目标与范围

**要解决的问题**：新用户打开 `ui_kits/stellar-raft/` 应用时，面对一片「知识深空」与大量
隐喻化交互（建星、点亮、衰减、复习、漫游）无从下手。需要一套引导，介绍所有主要功能和用法，
并且能在设置里随时回看。

**形态（已确认）**：两者结合——
1. 一本分页玻璃导览册（carousel modal），完整覆盖 11 页功能主题；
2. 末页「实地看看」按钮触发聚光实地导览，高亮星图主界面的少数稳定元素。

**触发（已确认）**：首次自动弹出 + 设置里可回看。**不**加侧栏帮助入口。

**覆盖深度（已确认）**：完整 11 页，每个主要功能一页。

**非目标（YAGNI）**：
- 不做跨全部 8 个视图的分步实地导览（脆弱、易随视图切换错位）——聚光只在星图主界面。
- 不做多语言（应用本就中文优先）。
- 不做服务端持久化引导进度——`localStorage` 足矣。
- 不用真实截图作插画——用内联 SVG 迷你场景，贴合品牌、零外部依赖。

---

## 2. 架构总览

沿用应用现有的 overlay 模式（`Settings` / `CommandPalette` / `AIConfig` 都是在 `app.jsx`
用状态开关挂载的居中玻璃 modal）。

新增两个组件，注册到 `window.SRKit`：
- `Onboarding` —— 分页导览册 modal。
- `OnboardingTour` —— 聚光实地导览 overlay。

两者都放在**新文件 `ui_kits/stellar-raft/Onboarding.jsx`**，在 `index.html` 里以
`text/babel` 脚本加载（放在 `Settings.jsx` 之后、`app.jsx` 之前，带 `?v=1` 缓存位）。

---

## 3. 组件设计

### 3.1 `Onboarding`（导览册 modal）

**Props**：`{ onClose, onSpotlight }`
- `onClose()` —— 关闭并标记已读（跳过 / 开始使用 / Esc / 点遮罩 都走它）。
- `onSpotlight()` —— 末页「实地看看」：请求 App 关册子、回到星图、开启聚光导览。

**内部状态**：`page`（当前页索引，0 起）。

**视觉**（对齐 `Settings.jsx`）：
- 居中玻璃：`GlassPanel strong radius="lg" glow`，`animation: sr-cardin var(--dur-base) var(--ease-flight)`。
- 尺寸约 `width 560、maxWidth 94vw、height 约 520`（比 Settings 略窄，聚焦单页内容）。
- 遮罩 `rgba(3,4,12,0.55)` + `backdrop-filter: blur(4px)`，`zIndex 120`（与 Settings 同级层）。
- 复用 `window.SRKit.useModalFocus(ref, { swallowCmdK: true })` 做移焦入内 / Tab 圈禁 / 关闭还原焦点 / 吞 ⌘K。

**单页布局**（三段）：
- **顶部**：左 HUD 大写微标（`kicker`，`font-mono` + `--ls-hud`，如 `KNOWLEDGE STARS`）；
  右「跳过」文字按钮 + `x` IconButton。中间一排**进度点**（当前页金色实心、其余灰点，可点跳页）。
- **中部**：内联 SVG **迷你插画**（约 200×140，克制三色）+ 标题（Sora 细体，faint glow）
  + 1–2 句诗意短文（`--text-2`，行高 1.8）。
- **底部**：`←上一页`（首页禁用）/ `下一页→`。末页把「下一页」换成两枚按钮：
  `Button variant="ghost" icon="compass"`「实地看看」→ `onSpotlight`；
  `Button variant="primary" glow icon="check"`「开始使用」→ `onClose`。

**键盘**：`←/→` 翻页（末页 `→` 不越界）；Esc 由 modal 自身监听走 `onClose`（`stopPropagation`，
与 Settings 同法，避免穿透到 app 层 Esc 词汇）。

**内容数据**：模块内常量 `SR_GUIDE_PAGES`（数组），每项：
```
{ id, kicker, title, body, art }   // art: 一个返回 SVG 的迷你插画 key 或函数
```
文案遵守品牌文案守则（见 §6）。11 页大纲见 §5。

### 3.2 `OnboardingTour`（聚光实地导览）

**Props**：`{ onClose }`（走完或跳过都调用）。

**步骤数据**：模块内常量 `SR_TOUR_STEPS`（3–4 步），每项：
```
{ target: '[data-tour="sidebar"]', title, body, placement: 'right'|'top'|... }
```

**目标锚点**（只指向星图主界面的稳定 chrome，需在对应组件加 `data-tour`）：
- `sidebar` —— 左侧边栏（`Sidebar.jsx` 根容器）。
- `search` —— 顶部搜索 / ⌘K 入口（`StarMap.jsx` 顶部 HUD 的搜索元素）。
- `tools` —— 底部工具胶囊（`StarMap.jsx` 鸟瞰 / 3D 按钮容器）。
- `review` —— 侧栏「复习」入口（`Sidebar.jsx` 复习项）。

**渲染**：
- 全屏暗遮罩（`position: fixed; inset: 0; zIndex 140`）。
- 按当前步 `document.querySelector(target)` 取 `getBoundingClientRect()`，在该矩形处「挖光洞」：
  用一个描边发光的圆角框覆盖目标 + 四周暗化（实现用一个定位到目标矩形、带超大 `box-shadow`
  spread 的元素形成周边暗场；或 SVG mask，二选一，实现时取更稳的一种）。
- 目标旁玻璃气泡：`GlassPanel` + 标题 + 短文 + `下一步`（末步换 `完成`）+ 步进指示 `n / N`。
- **兜底**：`querySelector` 找不到目标（视图差异 / 侧栏收起）→ 该步优雅跳过（不渲染光洞，
  或直接 advance）。收起态侧栏对 `sidebar`/`review` 步：若元素不可见则跳过。
- `prefers-reduced-motion`：无过渡动画，直接定位。
- Esc / 点暗场 → `onClose`。

---

## 4. App 集成（`app.jsx`）

**新增 state**：
```
const [onboard, setOnboard] = React.useState(false); // 导览册开
const [tour, setTour]       = React.useState(false); // 聚光导览开
```

**首次自动弹出**：新 effect，在启动帧淡出后判断——
```
React.useEffect(() => {
  let seen = false;
  try { seen = localStorage.getItem('sr.onboarded') === '1'; } catch {}
  if (!seen) setOnboard(true);
}, []);
```
（与既有「淡出 sr-boot」effect 并列即可；无需等 hydration，导览册不依赖数据。）

**回调**：
```
const finishOnboard = () => {
  try { localStorage.setItem('sr.onboarded', '1'); } catch {}
  setOnboard(false);
};
const startTour = () => { finishOnboard(); backToMap(); setTour(true); };
const replayGuide = () => { setSettingsOpen(false); setOnboard(true); };
```

**挂载**（overlay 层，与 Settings 同级）：
```
{onboard && <Onboarding onClose={finishOnboard} onSpotlight={startTour} />}
{tour && <OnboardingTour onClose={() => setTour(false)} />}
```

**Settings 回看入口**：给 `<Settings>` 传 `onReplayGuide={replayGuide}`。

---

## 5. 内容大纲（11 页）

| # | 页面标题 | kicker | 讲什么 |
|---|---|---|---|
| 1 | 知识是唯一的光 | WELCOME | 品牌开场：这不是仓库，是一片活着的知识深空 |
| 2 | 你的星图 | STAR MAP | 拖拽平移、滚轮缩放=飞行、右键建星域 / 建知识星 |
| 3 | 会生长，也会遗忘 | MEMORY | R=exp 记忆衰减，亮度=记忆强度，放着不看会变暗 |
| 4 | 点亮一颗星 | IGNITE | 费曼内化：把星讲透才「点亮」，金色时刻 |
| 5 | 让星不熄灭 | REVIEW | 复习会话：间隔重复，忘了 / 模糊 / 记得 |
| 6 | 随手收，慢慢理 | INBOX | 收件箱：⌘Enter 速记、按建议归入、星际来信 |
| 7 | 专业的编辑台 | EDITOR | 块编辑、markdown 快捷、⌘F 查找替换、导入导出 |
| 8 | 换一个视角 | AERIAL · 3D | 亮度鸟瞰热图、三维星系 |
| 9 | 删掉的去了哪 | BLACK HOLE | 黑洞回收站：删除即坠入，可恢复 |
| 10 | 星与星的相逢 | VISIT | 分享码、造访好友星系、收纳这颗星 |
| 11 | 就这些，去点亮吧 | SHORTCUTS | 关键快捷键速览 +「实地看看」/「开始使用」 |

每页 1–2 句短文；插画为对应主题的内联 SVG 迷你场景（发光星、连接曲线、记忆条渐暗、
光爆环、卡片翻面、鸟瞰热点、黑洞吸积盘、两星相连的金弧等），克制三色。

---

## 6. 视觉与文案守则（必须遵守）

- **三色预算**：冷星蓝 `#9fc6ff`（结构）· 暖金 `#ffd98a→#ffb86b`（奖励 / 点亮）· 深空背景。别的不给色。
- **玻璃拟态**：半透明深蓝 + 14px blur + 1px 冷发丝边 + 深柔阴影，浮在虚空里。
- **字体**：Sora（显示）· Noto Sans SC（中文）· JetBrains Mono（HUD 微标）。字重细→中，标题带 faint glow。
- **无 emoji、无 unicode 图标字**——图标一律走 Lucide（`Icon` / `IconButton`）。
- **文案**：天文台叙述者口吻，第二人称「你」，安静、精准、一点点诗意；不催促、不 hype、不过度解释隐喻。
- **动效**：`--ease-flight` 统一缓动，卡片轻浮、翻页淡入；`prefers-reduced-motion` 下静音。

---

## 7. index.html 改动

在 `Settings.jsx` 脚本行后新增：
```html
<script type="text/babel" src="Onboarding.jsx?v=1"></script>
```
（`app.jsx` 的 `?v=` 递增以刷新缓存。）

---

## 8. 验证策略

README 定性该 UI Kit 为 cosmetic recreation，交互可 faked。验证分两层：
- **轻量结构自检**：新增 `tests/` 断言或复用现有 node --test 套件，校验
  `SR_GUIDE_PAGES` 页数 / 字段完整、`SR_TOUR_STEPS` target 选择器格式；确认无 emoji / unicode 图标字。
  （若 React 组件难以在 node 环境加载，则退化为对 `Onboarding.jsx` 源文件的静态断言。）
- **实地 drive**：`npm run serve` 后用浏览器打开，清掉 `sr.onboarded` 触发首弹，翻完 11 页，
  点「实地看看」验证聚光定位，再从设置「上手引导」回看。截图确认首屏与聚光渲染。

---

## 9. 涉及文件

| 文件 | 改动 |
|---|---|
| `ui_kits/stellar-raft/Onboarding.jsx` | 新增：`Onboarding` + `OnboardingTour`，含 `SR_GUIDE_PAGES` / `SR_TOUR_STEPS` / 迷你 SVG 插画 |
| `ui_kits/stellar-raft/app.jsx` | 新增 onboard/tour state、首弹 effect、回调、overlay 挂载、给 Settings 传 `onReplayGuide` |
| `ui_kits/stellar-raft/Settings.jsx` | 新增左侧导航「上手引导」分区 + 「重新观看引导」按钮，接 `onReplayGuide` prop |
| `ui_kits/stellar-raft/Sidebar.jsx` | 给根容器 / 复习项加 `data-tour` 锚点 |
| `ui_kits/stellar-raft/StarMap.jsx` | 给顶部搜索 / 底部工具胶囊加 `data-tour` 锚点 |
| `ui_kits/stellar-raft/index.html` | 新增 Onboarding.jsx 脚本行；递增 app/Settings 的 `?v=` |
| `ui_kits/stellar-raft/README.md` | 补一段引导说明（可选，收尾时） |
| `tests/…` | 轻量结构自检（若可行） |
