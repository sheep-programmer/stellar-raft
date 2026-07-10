# Stellar Raft — UI Kit (星图 桌面端)

High-fidelity, interactive recreation of the 星图 desktop app (1440px). One SPA (`index.html`) composing the design-system primitives. Open it and click through:

**Flow:** star map → click a star → summary card (near-zoom) → 费曼内化 (drawer) → 点亮这颗星 (ignite burst + toast). Use the sidebar to switch to 列表视图 (list management) or open any note in the full block editor; the bottom tool capsule opens 亮度鸟瞰 (aerial heat map).

**收件箱 (Inbox)** — two tabs. **待整理**: quick capture (⌘Enter), search + 全部/有建议/无建议 filters, one-click 按建议归入, batch select → file-into-one-domain / dismiss; filing genuinely creates a knowledge star near that domain's centroid (visible in map/3D at once), and the toast offers 在星图中查看. **收藏**: every favorited note (the ☆ in the editor top bar persists to `star.fav`), with 打开笔记 / 在星图中定位 / 取消收藏.

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
   - **Typing feels like Typora/Notion:** markdown prefixes auto-convert (`#`/`##`/`###` + space → heading, `-`/`1.`/`>`/`[]` → list/quote/todo, ` ``` ` → code, `$$` → math, `---` → divider); Enter splits at the caret and continues lists (empty item exits); Backspace at block start demotes → merges → deletes; ↑/↓ cross block edges; Alt+↑↓ moves a block; drag the ⋮⋮ handle to reorder; pasting markdown parses into real blocks; outline & word count update live while typing; export keeps inline bold/italic/code/links.
   - **Right-click context menu** (`EditorMenus.jsx`): 询问 AI · 转换为▸ (15 types) · 复制为副本 · 复制块链接 · 移动到星座▸ · 颜色▸ (text + bg) · 评论 · 加入复习队列 · 删除.
   - **Slash menu** (`/` insert), **selection toolbar** (bold/italic/highlight/link + color), hover **⊕/⋮⋮ block handles**.
   - **Obsidian-style:** Properties/frontmatter block (类型/状态/来源/别名/下次复习), Outline (大纲, clickable TOC), Backlinks (反向链接 with `[[wikilink]]` context), word-count **status bar** (块/字/阅读时长/⌘P).
   - **Right knowledge rail:** 大纲 · 连接的星 (relation sentences) · 反向链接 · 记忆 (forgetting curve) · 在星图中定位 minimap.

## Files
- `index.html` — entry; loads React + Babel + Lucide + the DS bundle + `data.js` + screens.
- `data.js` — mock constellations / stars / connections / notes (plain global `window.SR_DATA`).
- `app.jsx` — router/state orchestrator.
- One `*.jsx` per screen, each registering onto `window.SRKit`. `EditorMenus.jsx` carries the editor's slash/selection/context menus.

## Conventions
- Components come from the DS bundle (`window.StellarRaftDesignSystem_2866af`): `StarNode`, `MemoryBar`, `GlassPanel`, `Button`, `IconButton`, `Icon`, `Input`, `Tag`, `Badge`, `ConstellationItem`.
- Icons are Lucide via CDN. No emoji, no unicode glyph icons.
- Connections use `window.SRConnect(x1,y1,x2,y2,bow)` from `assets/starfield.js`; background twinkle via `<sr-starfield>`.
- This is a cosmetic recreation, not production code — interactions are faked where needed.
