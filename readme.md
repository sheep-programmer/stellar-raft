# 星图 · Stellar Raft — Design System

> 别人的笔记是仓库，星图是一片活着的「知识深空」。
> Other apps store notes in a warehouse. Stellar Raft grows them in a living, breathing **deep space of knowledge** — where knowledge is the only light. Remember something well and its star blazes; stop reviewing and it cools, dims, and eventually goes dark.

**For:** university students, STEM-leaning.
**Core promise:** a knowledge map that both **grows and forgets** — memory made visible.
**Brand feel:** observatory star chart · deep-space photography · aurora · Apple-keynote dark stage · sci-fi HUD precision — but always **restrained**. This is a *work of art*, not another white-background office notebook.

---

## Sources

This system was authored **from a detailed written brief** (Chinese-language product spec for 「星图」). There was **no attached codebase, Figma, or existing asset library** — Stellar Raft is a greenfield brand and this design system *is* its source of truth. If a real codebase or Figma later exists, record the links here:

- Codebase: _none provided_
- Figma: _none provided_
- Product spec: pasted brief (8 hi-fi desktop screens, 1440px)

---

## The aesthetic laws (obey throughout)

1. **Every visual element carries information, never just decoration.** Brightness = memory strength · size = importance · distance = relatedness · color temperature = age. Beauty must be *readable*.
2. **Less is more.** ≤ 3–4 hues total. No rainbow, no cartoon, no skeuomorphic kitsch.
3. **Dark stage first.** Bold negative *black* space, low information density, room to breathe.
4. **The editor is professional and usable first, beautiful second** — but beauty never drops out.

---

## CONTENT FUNDAMENTALS — how Stellar Raft writes

The product is **Chinese-first**. Copy is quiet, precise, and a little poetic — like a planetarium narrator, never a hype salesman.

- **Voice:** calm, confident, spatial. We speak *with* the user about *their* universe ("你的星空", "这颗星"), rarely about ourselves. Second person ("你") is warm and frequent; first-person product voice is nearly invisible.
- **Tone:** understated wonder. We let the metaphor do the work — "点亮", "变暗", "融会贯通", "飞入" — verbs of light and motion, not feature jargon.
- **Casing (Latin):** Title Case for product nouns (Stellar Raft, Feynman Mode); sentence case for body. HUD micro-labels are UPPERCASE with wide tracking (e.g. `KNOWLEDGE STARS`, `THIS WEEK`).
- **Numbers:** mono, tabular, terse. "本周新增 12 颗 · 点亮 5 颗".
- **No emoji. No unicode symbol glyphs as icons.** Ever. (See Iconography.)
- **Example microcopy:**
  - Empty state: 「你的星空还很暗。写下第一颗星，让它发光。」
  - Light-up toast: 「点亮 +1 · 融会贯通」
  - Dimming nudge: 「这片星座正在变暗 — 该回来看看了。」
  - Sidebar section: 「我的星座」 / 「收件箱（待整理）」
  - Stat strip: 「正发光 · 正变暗 · 连接数」

**Avoid:** exclamation spam, growth-hack urgency, cutesy gamification ("恭喜你获得金币！"), and over-explaining the metaphor — show it, don't narrate it.

---

## VISUAL FOUNDATIONS

**Color** — a three-hue budget, all semantic. Deep-space blue/black backdrop · cold **star-blue** `#9fc6ff` for structure, connections, default icons · warm **gold** `#ffd98a → #ffb86b` reserved for reward, ignition, mastery. Knowledge stars ride a **memory-temperature ramp** from cold dim blue `#7896cd` (forgetting) to warm gold-white `#fff4d6` (mastered). Nothing else gets a hue. Destructive actions use a single low-saturation warm `#e8917a`, sparingly.

**Background** — never flat. The `--bg-deepspace` gradient stacks faint nebula radials over a near-black `#03040c → #05060f` field. An empty account is *almost entirely black*; knowledge is the only light introduced. No photographic imagery, no stock textures — the "imagery" is generated starfield + glow.

**Type** — Sora (Latin/display) + Noto Sans SC (Chinese) + JetBrains Mono (HUD/code). Weights stay **thin → medium**; headlines are light with a *faint* glow, never bold neon. The 「星图」logo is a gold→white→blue gradient wordmark. Editor body runs loose line-height (1.8) with comfortable measure (~720px).

**Spacing** — 8px rhythm, deliberately low density. White space is black space; we leave the void empty on purpose.

**Corner radii** — soft everywhere (`14–24px` on panels), full **pills** for tool capsules and chips. Nothing sharp-cornered.

**Cards & panels** — **glassmorphism**: semi-transparent deep blue (`rgba(14,19,44,.55)`), 14px backdrop blur + saturate, a **1px** cool hairline border (`rgba(159,198,255,.14)`), a soft deep drop shadow plus a 1px inner light edge. They *float* in the void; they do not sit on a surface.

**Glow & shadow** — two systems. **Glow** is additive light bleeding from stars, the logo, and active icons (`--glow-blue`, `--glow-gold`). **Shadow** is deep and soft for elevation (`--shadow-md/lg`). Use protection via blur/darkening under HUD bars, not hard scrims.

**Borders** — hairlines only (`rgba(159,198,255,.10–.18)`). No heavy outlines, no colored left-border accent cards.

**Transparency & blur** — used whenever UI overlaps the living canvas (top HUD, bottom tool capsule, sidebar, drawers, slash menu). Blur protects legibility without a solid block.

**Imagery color vibe** — cool, deep, with the faintest warm nebula. Think long-exposure astrophotography: black, blue, a breath of gold. No grain filters, no warm Instagram cast.

**Connections** — **organic mycelium/synapse curves**, never straight arrows. Variable thickness, gentle pulse, a moving light point flowing along the path. Same-constellation links are star-blue; cross-constellation "融会贯通" links are **gold**.

**Animation** — soft, slow, deep-space calm. One global easing: `cubic-bezier(.2,.8,.2,1)`. **Zoom = flight** (parallax + depth, never a hard scale). Stars **breathe** (subtle scale pulse), background stars **twinkle**. Hover: icons warm to gold + faint glow; cards lift slightly. Press: gentle shrink (scale .97) + dim. The **light-up moment** is the *only* place high-energy motion is allowed — glow burst + particle ring in 1.3s. Everything else stays quiet. Respect `prefers-reduced-motion`.

**Themes** — dark-first. An opt-in lighter theme **「黎明 Dawn」** ships as a `data-theme` token scope (`tokens/themes.css`): set `<html data-theme="dawn">` and every token re-maps to a pale twilight (cool off-white surfaces, a faint warm horizon, deep-navy ink), keeping the same semantics — gold = reward, star-blue = structure — with glows giving way to soft shadows and the memory ramp's dim end darkened so forgetting stars stay legible on light. The starfield + `memoryColor` read the theme at runtime. The UI kit sidebar has a 黎明/深空 toggle.

---

## ICONOGRAPHY

- **No emoji. No unicode symbol characters as icons.** This is an absolute brand law.
- **Icon set:** [**Lucide**](https://lucide.dev) — open-source linear icons, ~1.5–2px stroke, rounded caps, 24px grid. This is an exact match for the brief's "self-drawn linear vector icons, benchmarked against Lucide" and is loaded from CDN. **⚠ Substitution flag:** the brief asked for a *bespoke* hand-drawn set; Lucide stands in until a custom library exists. If you want the real thing, commission/replace the icon layer — everything references it through one `<IconButton>` / `data-icon` seam.
- **Default state:** star-blue `#9fc6ff` at ~70% opacity. **Hover/active:** warm gold `#ffd98a` + a very faint glow. (`IconButton` handles this.)
- **Sizing:** 24px box default; 18px inline; 20px in tool capsules. Stroke stays ~1.6px. Icon-to-label gap and baseline alignment are unified via components.
- **Collapsed sidebar:** icons only at 64px width.
- No PNG icons, no icon font of our own — Lucide SVG via the CDN web component / React package. In static HTML cards we use the Lucide CDN script.

---

## INDEX — what's in this system

- **`styles.css`** — the single entry point consumers link (imports only).
- **`tokens/`** — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `themes.css` (opt-in 黎明 Dawn light theme). Effects file also carries the `.sr-glass*` utilities and all `@keyframes` (breathe, twinkle, flow, ignite burst/ring/toast, drawer/card-in).
- **`assets/`** — `starfield.js` → the `<sr-starfield>` web component (parallax depth layers, stellar-temperature star colors, diffraction-spike bright stars, a faint Milky-Way band of pre-rendered haze + star dust, rare meteor streaks; all reduced-motion aware) + `window.SRConnect()` organic-connection path generator.
- **`components/`** — 10 reusable primitives, namespace **`window.StellarRaftDesignSystem_2866af`**:
  - `core/` — `Icon`, `IconButton`, `Button`, `GlassPanel`, `Badge`, `Tag`, `Input`
  - `knowledge/` — `MemoryBar` (+ `memoryColor`), `StarNode`, `ConstellationItem`
  - Each ships `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`; one `*.card.html` per group.
- **`ui_kits/stellar-raft/`** — interactive recreation of the desktop app covering all 8 briefed screens (`index.html` + `data.js` + `app.jsx` + per-screen JSX). See its `README.md` for the screen→file map.
- **`guidelines/`** — 14 foundation specimen cards (Colors / Type / Spacing / Brand).
- **`SKILL.md`** — Agent-Skill wrapper for use in Claude Code.

See the **Design System** tab for live specimen cards of every color, type, spacing, component, and the full app.

### Substitutions to resolve (flagged)
- **Fonts** are Google-Fonts stand-ins loaded via `@import` in `tokens/fonts.css` (Sora · Noto Sans SC · JetBrains Mono) — the compiler therefore reports 0 self-hosted `@font-face`. Swap in real brand binaries when available.
- **Icons** are **Lucide** (CDN), the closest match to the brief's "linear vector icons benchmarked against Lucide." Replace with a bespoke set later — everything routes through `Icon` / `IconButton`.
