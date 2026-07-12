# Stellar Raft — UI Kit (星图 桌面端)

High-fidelity, interactive recreation of the 星图 desktop app (1440px). One SPA (`index.html`) composing the design-system primitives. Open it and click through:

**Flow:** star map → click a star → summary card (near-zoom) → 费曼内化 (drawer) → 点亮这颗星 (ignite burst + toast). Use the sidebar to switch to 列表视图 (list management) or open any note in the full block editor; the bottom tool capsule opens 亮度鸟瞰 (aerial heat map).

**收件箱 (Inbox)** — two tabs. **待整理**: quick capture (⌘Enter), search + 全部/有建议/无建议 filters, one-click 按建议归入, batch select → file-into-one-domain / dismiss; filing genuinely creates a knowledge star near that domain's centroid (visible in map/3D at once), and the toast offers 在星图中查看. **收藏**: every favorited note (the ☆ in the editor top bar persists to `star.fav`), with 打开笔记 / 在星图中定位 / 取消收藏. **星际来信** — 待整理顶部多出服务端信箱（`inbox_messages`，`/api/inbox/*`）：好友寄来的造访邀请（「去造访」一键预填密文跳星际漫游）与赠星，以及自己造访好友星系时「收纳这颗星」收进的星名/大纲（按主人可见度裁剪、服务端剥 HTML），「收纳到星域」经 `adoptShared` 落成新星——一律从未点亮起步（S=2.5）；后端未运行时整区静默隐藏.

**黑洞 (Black hole / trash)** — every deleted star or domain (from map right-click, editor 更多▸删除, or list view) falls into `BlackHole.jsx`: a CSS black hole (event horizon + tilted accretion disk + photon ring + lensing arcs) with the swallowed items orbiting as debris. Restore brings a star/domain back with its position and connections; 彻底销毁 / 清空 are confirmed and irreversible. Shared helpers live in `data.js` (`trashStar` / `trashDomain` / `restoreTrash` / `purgeTrash`), and sidebar badges for 收件箱/黑洞 are live counts.

## The 8 briefed screens, and where each lives
1. **星图主界面 (创作态·中景)** — `StarMap.jsx` — **infinite pannable/zoomable canvas**: drag empty space to pan, wheel/±buttons to zoom (toward cursor), drag any star to reposition, semantic-zoom domain (星域) halos + names, right-click empty space to **create a 星域 or knowledge star**. Plus top HUD, zoom pill, tool actions.
2. **亮度鸟瞰 (极远景)** — `AerialView.jsx` — mirrors the user's own map arrangement exactly: live wx/wy positions, uniform (aspect-preserving) scale, the same sun/star/connection language as the map, memory-temperature star coloring, a cold→warm legend, and a flight-style zoom-out entrance. Click a domain to fly back in.
   - Bonus screen: **三维星系 (Galaxy3D)** — `Galaxy3D.jsx`, Three.js. Constellations as glowing suns at their real map centroids, notes as memory-colored orbiting planets, twin-arm dust disc, gold 融会贯通 arcs with traveling light points, camera-facing domain nameplates, and a 俯瞰 (top-down) camera preset that reproduces the 2D arrangement point-for-point.
3. **近景语义缩放** — `StarMap.jsx` `SummaryCard` (star → summary card)
4. **费曼内化模式 (右抽屉)** — `FeynmanDrawer.jsx`
5. **点亮高潮瞬间** — `FeynmanDrawer.jsx` `IgniteBurst` + `IgniteToast` (1.3s)
6. **左侧边栏 Sidebar** — `Sidebar.jsx` (collapsible 260 ⇄ 64)
7. **笔记管理 (俯瞰态·列表视图)** — `ListView.jsx`
8. **专业笔记编辑页** — `Editor.jsx` + `EditorMenus.jsx`. Block-driven editor with mainstream note-app coverage (Notion/Obsidian/Craft-level):
   - **Blocks:** H1–H3, text, to-do, bulleted/numbered/toggle lists, quote, callout, code (lang + copy + syntax), LaTeX math, editable table, divider, image — all contentEditable.
   - **Typing feels like Typora/Notion:** markdown prefixes auto-convert (`#`/`##`/`###` + space → heading, `-`/`1.`/`>`/`[]` → list/quote/todo, ` ``` ` → code, `$$` → math, `---` → divider); inline `**bold**` / `*italic*` / `` `code` `` / `~~strike~~` convert in place on space (IME-safe); Enter splits at the caret and continues lists (empty item exits); Tab/⇧Tab indents list blocks (nesting persists, exports as 2-space md); Backspace at block start demotes → merges → deletes; ↑/↓ cross block edges; Alt+↑↓ moves a block; drag the ⋮⋮ handle to reorder; pasting markdown parses into real blocks (nested lists keep levels); outline & word count update live while typing; export keeps inline bold/italic/code/links.
   - **⌘F find & replace** inside the note: match count + prev/next (Enter/⇧Enter), all-match highlight via CSS Custom Highlight (never touches block HTML), replace one / replace all (undoable), Esc returns focus to the text.
   - **Markdown import & export:** 更多 ▸ 导入/导出 Markdown (or drop a `.md` file onto the note) — YAML frontmatter round-trips properties/tags; code language picker is the DS `Select`; word/reading stats count 中文字 and western words separately (code folded in by lines). Markdown core lives in `mdcore.js` (`window.SRMd`, pure string, unit-tested in `tests/mdcore.test.js`).
   - **Right-click context menu** (`EditorMenus.jsx`): 询问 AI · 转换为▸ (15 types) · 复制为副本 · 复制块链接 · 移动到星座▸ · 颜色▸ (text + bg) · 评论 · 加入复习队列 · 删除.
   - **Slash menu** (`/` insert), **selection toolbar** (bold/italic/highlight/link + color), hover **⊕/⋮⋮ block handles**.
   - **Obsidian-style:** Properties/frontmatter block (类型/状态/来源/别名/下次复习), Outline (大纲, clickable TOC), Backlinks (反向链接 with `[[wikilink]]` context), word-count **status bar** (块/字/阅读时长/⌘P).
   - **Right knowledge rail:** 大纲 · 连接的星 (relation sentences) · 反向链接 · 记忆 (forgetting curve) · 在星图中定位 minimap.

## 记忆衰减（会生长也会遗忘）

每颗星维护 `sr = { S: 稳定度(天), last: 上次成功复习(ms), due: 复习队列覆盖, lit: 0|点亮时刻, ember: 0|熄灭时刻 }`，
可提取率 **R = exp(−Δt天 / S)** 直接作为 `star.strength` 喂给星图 / 鸟瞰 / 3D / 列表 / MemoryBar
（映射到 `--mem-*` 温度梯）——放几天不看，星真的会变暗。打开应用、切换视图、每分钟心跳
（`sr-memory` 事件）都会按真实时间重算。种子数据的 `lastReview / stability` 由 strength
相对当前时间反推生成，demo 一打开就有正发光 / 正变暗的层次。重算只改数值、不加动画，
`prefers-reduced-motion` 下同样安静。

**点亮状态机（认证轴，独立于亮度轴）** —— 三态：未点亮（缺省，旧档案不追溯）·
已点亮（`lit>0`，费曼讲透授予）· 待重燃（`lit=0 ∧ ember>0`）。已点亮星也会衰减：
R < 0.35 自动熄灭转待重燃，被评「忘了」立即熄灭；重燃走费曼快速通道（门槛减半），
成功即 `lit=now, ember=0`。复习成功 S ×= 增长因子 + (1−R)·0.6，档位：点亮/重燃 2.5 ·
lit 星「记得」2.2 · 普通 1.8；失败 ×0.45（lit 星 0.55 且熄灭）。稳定度封顶：曾点亮星 365 天，
从未点亮星只封顶生长到 60。星域实时重算 `litRatio`（已点亮占比），光环转金 =
litRatio ≥ 0.5 ∧ health ≥ 0.5；融会贯通金弧要求两端均已点亮。导出 `isLit / isEmber /
litRatio / hasSubstance / emberStars / todayTodo` 等；访客视图（server 同参）只透传
lit/ember 布尔与 litRatio，不泄露时间戳。

**费曼抽屉（`FeynmanDrawer.jsx`）** —— 「点亮」按认证态分三条边：未点亮→点亮
（显式门槛：有效讲解 ≥ 60 字 ∧ (≥2 轮 ∨ 覆盖要点)，金色时刻 + 「记忆稳定度升至 N 天」）·
待重燃→重燃（门槛减半 40 字 / 1 轮，金 toast「重燃 · 星光归位」）· 已点亮→巩固
（不带 ignite 的成功复习，蓝 toast，无爆发）。内容门槛（摘要 ≥ 20 字或 ≥ 2 内容块，
`hasSubstance`）不足时点亮区禁用 + 「去写笔记」；「还没讲透」= 一次失败复习，
对 lit 星出冷色熄灭 toast。金色只出现在点亮 / 重燃两次状态跃迁。

**复习会话（`ReviewSession.jsx`）** — 间隔重复的闭环。入口：侧栏「复习」（带到期计数角标）
和体检报告到期队列头部的「开始复习」。到期星按到期先后取卡：回忆（只有星名 + 星座）→
空格 / 「展开笔记」翻开摘要与大纲 → 三档自评：忘了 (1/←) `reviewFail` · 模糊 (2/↓)
`reviewPartial`（S ×1.2，R 回到 ~0.85）· 记得 (3/→) `reviewSuccess`。已点亮 / 待重燃卡片
带金发丝 / 暗金余烬徽标与三档差异 hint（忘了 =「将熄灭 · 转待重燃」），结束页对本轮熄灭 /
待重燃星逐颗给「去重燃」出口（就地叠开费曼抽屉）。评分即持久化并广播 `sr-memory`，
星图 / 角标就地读回新亮度；Esc 退出，reduced-motion 下卡片瞬切。

**今日待办（`Checkup.jsx` 顶部）** —— 统一入口：到期复习 / 待重燃 / 收件箱三行
（`todayTodo`，due 与 ember 可重叠），每行一句自解释 + 直达动作，空态
「星空明亮，观测台今夜无事。」；随 `sr-memory` / `sr-data` / `sr-ignite` 就地刷新，
侧栏体检角标同口径。

## 持久化

所有写操作（建星 / 编辑 / 点亮 / 复习 / 移动 / 删除 / 回收站 / 收藏 / 收件箱）经 `SRNet.schedule()`
防抖 1.2s 落盘：先镜像进 `localStorage`（key `sr.galaxy.v1`），再 PUT 给本地后端
（`node server/server.js`，node:sqlite）。无后端（file:// 直接打开）时 localStorage 就是
唯一存储；启动时两份快照按 `savedAt / updated_at` 新者优先，本地较新则回推服务器。

## Files
- `index.html` — entry; loads React + Babel + Lucide + the DS bundle + `data.js` + screens.
- `data.js` — constellations / stars / connections / notes (plain global `window.SR_DATA`) + 记忆衰减模型（FSRS-lite）、点亮状态机（lit/ember）与全部写操作入口。
- `api.js` — `window.SRNet`：REST 同步 + localStorage 降级镜像。
- `app.jsx` — router/state orchestrator.
- One `*.jsx` per screen, each registering onto `window.SRKit`. `EditorMenus.jsx` carries the editor's slash/selection/context menus.

## 键盘与反馈（体验修复轮）

- **键盘闭环**：星图上的知识星与星域主星都在 Tab 序列里（`StarNode` 的 role=button + Enter/Space），Enter 打开摘要卡 / 星域菜单——「建星→写笔记→复习→点亮」不再是鼠标专属。
- **Esc 统一词汇**：摘要卡、费曼抽屉（app 层捕获，永远先关最上层）、亮度鸟瞰、三维星系、体检报告都响应 Escape；层叠通过 `e.defaultPrevented` 协调。
- **右键菜单**：StarMap 的两个自绘菜单换成共用 `PopMenu` 基座，与 DS `ContextMenu` 同一套键盘词汇（↑↓/Home/End/Enter/Esc + 焦点还原），任意按键不再误关菜单。
- **toast**：星图 / 黑洞的操作反馈走 DS `toast()`（自带 role=status/aria-live）；黑洞带动作的 toast 保留自绘但加 role=status、动作是真按钮。
- **焦点环**：应用层裸 `<button>` / 输入统一挂 DS 注入的 `.sr-focus-ring`；`tip.js` 对 `:focus-visible` 也出提示（按元素定位，Esc 可隐藏），收起态侧栏不再对键盘盲开。
- **LOD（几百颗星）**：>120 星时连线不再逐条模糊辉光/流光（流光只留给金色融会贯通），远景整层隐去星-主星连线、标签只在近景常显；视口外的星与连线剔除。
- **空态**：星图 0 星 0 星域时渲染教学空态（「你的星空还很暗」+ 创建第一个星域）；三维星系 0 星复用同一句文案。
- **启动帧**：`index.html` 内联静态启动帧（logo + 「正在点亮你的星空…」+ 微星点），app 挂载后淡出；8s 未就绪转为断网兜底提示。
- **sr-data 事件**：删除/恢复/建星等写操作即时广播，侧栏「黑洞/复习」角标不再等每分钟心跳。

## 新手引导（星图手册）

首次打开自动弹出的分页导览册（`Onboarding.jsx`，11 页）——星图 / 记忆衰减 / 费曼点亮 / 复习 / 收件箱 / 编辑器 / 鸟瞰·3D / 黑洞 / 星际漫游 / 快捷键，逐页讲清。看过/跳过后写 `localStorage['sr.onboarded']`，不再自动弹。末页「实地看看」切到聚光实地导览（`OnboardingTour`，靠 `data-tour` 锚点高亮星图主界面的搜索 / 复习 / 工具胶囊）。随时可在设置「上手引导」里回看。

## Conventions
- Components come from the DS bundle (`window.StellarRaftDesignSystem_2866af`): `StarNode`, `MemoryBar`, `GlassPanel`, `Button`, `IconButton`, `Icon`, `Input`, `Tag`, `Badge`, `ConstellationItem`.
- Icons are Lucide via CDN. No emoji, no unicode glyph icons.
- Connections use `window.SRConnect(x1,y1,x2,y2,bow)` from `assets/starfield.js`; background twinkle via `<sr-starfield>`.
- This is a cosmetic recreation, not production code — interactions are faked where needed.
