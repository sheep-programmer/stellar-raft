---
name: stellar-raft-design
description: Use this skill to generate well-branded interfaces and assets for 星图 / Stellar Raft, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping a deep-space "living knowledge" note app.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Fast orientation
- **Brand in one line:** knowledge is the only light in a deep-space sky; remembered = bright/warm, forgotten = dim/cold. Restrained, high-end, dark-stage. ≤ 3–4 hues.
- **Tokens & global CSS:** link `styles.css` (it `@import`s everything in `tokens/`). Key vars: `--bg-deepspace`, `--space-*`, `--star-blue`, `--gold`, the `--mem-*` memory ramp, `--glass-*`, `--glow-*`.
- **Components (18):** built into `_ds_bundle.js` under `window.StellarRaftDesignSystem_2866af` —
  - core: `Icon`, `IconButton`, `Button`, `GlassPanel`, `Badge`, `Tag`, `Input`
  - knowledge: `StarNode`, `MemoryBar`, `ConstellationItem`
  - overlay: `Modal`, `Toast` + imperative `toast(message, {tone, icon, duration})` (also on the namespace), `Tooltip`, `ContextMenu`
  - form: `Select`, `Switch`, `Checkbox`, `Tabs`
  - See `components/*/*.prompt.md`; regenerate the bundle with `npm run build` after editing any `.jsx`.
- **Icons:** Lucide via CDN (`https://unpkg.com/lucide@latest`). Star-blue idle → gold on hover/active. **Never** emoji or unicode glyph icons.
- **Starfield + organic connections:** `assets/starfield.js` → `<sr-starfield>` element + `window.SRConnect(...)` path generator.
- **Full app recreation:** `ui_kits/stellar-raft/` (8 screens, interactive) — memory strength now decays for real (FSRS-lite in `data.js`) and every edit persists (localStorage mirror + optional `node server/server.js` sync).
- **Docs site:** `docs/index.html` — zero-build static pages (brand / getting started / foundations / component gallery / showcase). Register new components by appending to `REGISTRY` in `docs/registry.js`.
- **Foundations:** specimen cards in `guidelines/`.
- **Build & QA:** `npm install` once, then `npm run build` (rebuild `_ds_bundle.js` + `_ds_manifest.json` — never hand-edit those), `npm test` (server / tokens / bundle suites), `npm run lint`.

## Non-negotiables
- Dark stage, bold negative (black) space, low density, breathing.
- Every visual encodes meaning (brightness = memory, size = importance, color temp = age). No decoration-only flourishes.
- Gold is reserved for reward / ignition / mastery. Don't spray it around.
- Connections are organic curves with flowing light points — never straight arrows.
- Motion is slow and calm (`--ease-flight`); the ignite moment is the only high-energy beat.
