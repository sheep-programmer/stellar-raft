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
- **Components:** built into `_ds_bundle.js` under `window.StellarRaftDesignSystem_2866af` — `StarNode`, `MemoryBar`, `GlassPanel`, `Button`, `IconButton`, `Icon`, `Input`, `Tag`, `Badge`, `ConstellationItem`. See `components/*/*.prompt.md`.
- **Icons:** Lucide via CDN (`https://unpkg.com/lucide@latest`). Star-blue idle → gold on hover/active. **Never** emoji or unicode glyph icons.
- **Starfield + organic connections:** `assets/starfield.js` → `<sr-starfield>` element + `window.SRConnect(...)` path generator.
- **Full app recreation:** `ui_kits/stellar-raft/` (8 screens, interactive).
- **Foundations:** specimen cards in `guidelines/`.

## Non-negotiables
- Dark stage, bold negative (black) space, low density, breathing.
- Every visual encodes meaning (brightness = memory, size = importance, color temp = age). No decoration-only flourishes.
- Gold is reserved for reward / ignition / mastery. Don't spray it around.
- Connections are organic curves with flowing light points — never straight arrows.
- Motion is slow and calm (`--ease-flight`); the ignite moment is the only high-energy beat.
