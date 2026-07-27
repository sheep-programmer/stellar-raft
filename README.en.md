<div align="center">

# Stellar Raft · 星图

**Other apps store notes in a warehouse — Stellar Raft grows them in a living deep space of knowledge.**

![Node](https://img.shields.io/badge/Node-%E2%89%A5%2022.5-9fc6ff?style=flat-square&labelColor=05060f)
![Tests](https://img.shields.io/badge/tests-236%20passing-ffd98a?style=flat-square&labelColor=05060f)
![Build](https://img.shields.io/badge/build-zero--config-9fc6ff?style=flat-square&labelColor=05060f)
![Components](https://img.shields.io/badge/components-18%20primitives-9fc6ff?style=flat-square&labelColor=05060f)
![Backend](https://img.shields.io/badge/backend-zero--dependency-ffd98a?style=flat-square&labelColor=05060f)
![Status](https://img.shields.io/badge/status-private-8a94a8?style=flat-square&labelColor=05060f)

English · [中文](README.md)

<br/>

<img src="docs/screenshots/starmap.webp" alt="Star map — the deep-space knowledge canvas" width="860"/>

</div>

---

## What this is

**Stellar Raft** is the brand and **design system** for a knowledge-notes app aimed at STEM-leaning university students.

Knowledge becomes a living deep space: every note is a star that blazes when remembered and cools, dims, and finally goes dark when neglected.

This repository is three things at once:

- **The single source of truth for the design system** — tokens + 18 component primitives + a zero-build docs site
- **A complete interactive app** — all 8 hi-fi screens, across desktop / tablet / phone breakpoints
- **A zero-dependency backend** — Node's built-in `node:sqlite` only, no third-party packages

> **Core promise** — a knowledge map that both **grows and forgets**: memory made visible.

---

## Contents

| | |
| --- | --- |
| [Getting started](#getting-started) · [Tech stack](#tech-stack) · [Project structure](#project-structure) · [Scripts](#scripts) | Get it running |
| [The memory model](#the-memory-model) · [Design philosophy](#design-philosophy) | Why it works this way |
| [Features](#features) · [On phones](#on-phones) · [Admin console](#admin-console) | What it does |

---

## Getting started

**Prerequisites** — Node.js **≥ 22.5** (for the built-in `node:sqlite`).

```bash
npm install     # only two dev deps: Babel standalone, oxlint
npm run serve   # local backend + static hosting
```

Open **http://localhost:8756/ui_kits/stellar-raft/** to click through the full app.

On its **first boot** the server seeds an admin account and prints the credentials (defaults: `admin` / `stellar-admin`). For any public deployment, set them before that first boot so the default password never exists:

```bash
SR_ADMIN_USER=captain SR_ADMIN_PASS='your own strong password' npm run serve
```

**Environment variables**

| Variable | Effect |
| --- | --- |
| `PORT` | Listen port (default `8756`) |
| `SR_DB` | Database location (default `server/stellar.db`; missing parent directories are created) |
| `SR_ADMIN_USER` / `SR_ADMIN_PASS` | Admin credentials seeded on first boot |
| `SR_TRUST_PROXY=1` | Trust the first `X-Forwarded-For` hop as the source IP (**required behind a reverse proxy**) |
| `SR_GUEST_PER_IP` | Initial guests-per-IP limit (default `1`, `0` = unlimited; the console setting wins afterwards) |
| `SR_GUEST_GATES=off` | Turn all four feature gates off initially (on by default) |

> Point `SR_DB` at a data volume in production and upgrades never have to move data; locally, give a second instance a throwaway database and it won't touch the one you're using:
>
> ```bash
> PORT=8757 SR_DB=/tmp/probe/stellar.db npm run serve
> ```

---

## The memory model

Each star holds `sr = { S stability, last review, lit timestamp, ember timestamp }`.

**Retrievability** `R = exp(−Δt / S)` is used directly as brightness — recomputed on every open, every view switch, and a per-minute heartbeat, against real elapsed time. Skip your reviews and stars genuinely go dark.

```
Brightness R = exp(−Δt / S)     cold blue (forgetting) → warm gold-white (mastered)
On success   S ×= growth + (1−R)·0.6
On failure   S ×= 0.45
Stability cap   365 days once lit · 60 days if never lit
```

**Ignition** is a certification axis independent of brightness — a star is truly lit only after you explain it in Feynman mode. Lit stars decay too, extinguishing into a re-kindle "ember" state below threshold.

<div align="center">
<img src="docs/diagrams/ignite-state.svg" alt="Ignite state machine" width="820"/>
</div>

**Four review strategies** genuinely drive the due queue and desktop notifications: forgetting-curve cooling · the classic 1·3·7·15-day ladder · daily · off.

---

## Design philosophy

Stellar Raft is a *work of art*, not another white-background office notebook. Four aesthetic laws hold throughout:

1. **Every visual element carries information, never mere decoration** — brightness = memory strength · size = importance · distance = relatedness · color temperature = age. Beauty must be *readable*.
2. **Less is more** — 3–4 hues total; no rainbow, no cartoon, no skeuomorphic kitsch.
3. **Dark stage first** — bold black negative space, low density, room to breathe. An empty account is almost entirely black; **knowledge is the only light introduced**.
4. **The editor is professional-first, beautiful-second** — but beauty never drops out.

**Palette**

| Role | Value | Meaning |
| --- | --- | --- |
| Star-blue | `#9fc6ff` | Structure, links, default icons |
| Gold | `#ffd98a → #ffb86b` | Reward, ignition, mastery |
| Deep space | `#03040c → #05060f` | The backdrop field |

---

## Features

### Knowledge itself

- **A star map that forgets** — memory strength decays against real time and drives each star's brightness and color temperature.
- **Ignite by teaching** — explain a star in Feynman mode and it truly lights up (a golden ignition moment).
- **Spaced-repetition review** — due cards, three-way self-grading (forgot / fuzzy / got it), closing the loop that keeps stars alive.
- **Window of time** — the checkup page previews which stars will extinguish or fall due within 7 days, one click queues them; forgetting becomes a **forewarning**, not a post-mortem. A 16-week activity heatmap and streak derive live from the timeline.

### Writing and reading

- **8 hi-fi screens** — star map · aerial heat map · 3D galaxy (Three.js) · semantic-zoom card · Feynman drawer · sidebar · list management · pro block editor.
- **Pro block editor** — headings / todos / lists / quote / code / LaTeX / tables / images, live markdown conversion, ⌘F find-and-replace, backlinks and outline.
- **Knowledge flows both ways** — ⌘K full-text search reaches into note bodies (highlighted snippets); export your galaxy as an Obsidian-style Markdown vault (zip, zero-dependency packaging), and **import one back** — a .zip or a batch of .md files grows into a galaxy (folders→constellations, frontmatter→props, `[[wikilinks]]`→connections, merged incrementally). Import/export round-trips with real GFM, aligned with GitHub · Typora · Obsidian.
- **Press `?`** for a full shortcut cheatsheet, anywhere.

### Social and AI

- **Interstellar roaming & knowledge resonance** — visit friends' galaxies via share ciphers (server-side cropping; **note bodies never leave the owner's database**); while visiting, the stars you both own — or both ignited — light up as resonance; leave a one-line star-note, gift stars, collect them; owners see visitor footprints and mail.
- **Real AI integration** — plug in OpenAI / Anthropic / any OpenAI-compatible gateway (one-api, Ollama…): the Feynman "AI student" asks real follow-up questions, and the editor can summarize, suggest tags, and propose cross-constellation links. Falls back gracefully to a local rule-based student when unconfigured.

### Accounts and engineering

- **Accounts & multi-device** — username/email login (scrypt + sessions); registering folds your anonymous galaxy **into the account in place**, losing nothing; every local trace (API keys included) is wiped on account switch.
- **Onboarding guide** — an 11-page carousel on first run plus a spotlight walkthrough, re-openable from Settings anytime.
- **Zero-build · zero-dependency** — JSX compiled in the browser by Babel; the backend uses only Node's built-in `node:sqlite`.

<div align="center">
<img src="docs/screenshots/onboarding.webp" alt="Onboarding guide" width="720"/>
<br/>
<sub>The onboarding guide</sub>
</div>

---

## On phones

The kit was drawn for 1440×900. One set of breakpoints now runs through the whole app — phones get a different **layout and gesture set**, not a stripped-down build.

| Breakpoint | Width | Layout |
| --- | --- | --- |
| `phone` | ≤ 720px | Sidebar folds into a drawer · bottom tab bar (map/list/review/inbox/more) · top bar · single column · full-bleed overlays |
| `tablet` | ≤ 1024px | Collapsible sidebar · the editor's right-hand knowledge rail steps aside |
| `desktop` | > 1024px | The original desktop layout, unchanged |

**Gestures** — the star map moved wholesale from mouse events to pointer events, which is what makes touch actually work:

| Action | Phone | Desktop |
| --- | --- | --- |
| Pan the canvas | Drag empty space | Drag empty space |
| Zoom | Pinch | Wheel |
| New constellation / star | Long-press 520ms | Right-click |
| Move a star / whole constellation | Drag the node / anchor star | Same |
| Inspect a star | Tap (card docks to the bottom, never covering the map) | Click (card follows the star) |

**Deliberate trade-offs**

- **Pinch-to-zoom is never disabled** — `user-scalable=no` crosses an accessibility line. The map's own zoom is a two-finger gesture and doesn't conflict with the browser's.
- **Safe areas live in four `--sr-safe-*` variables**, so no component writes its own `env()`. The top bar absorbs the notch, the tab bar absorbs the home indicator, and views receive a clean rectangle.
- **`100vh` gets eaten by the address bar** — prefer `100dvh`, fall back to a measured `--sr-vh` on older browsers.
- **Breakpoints have exactly one source of truth** (`SRScreen` in `responsive.js`); components all call `SRKit.useScreen()`. A test watches specifically for anyone sneaking in their own `matchMedia`.
- **No tab bar in the editor** — it only gets in the way once the keyboard is up; the way back lives in the editor's own header.

---

## Admin console

Sign in as an admin and a **星港管理台 / Admin Console** entry appears at the bottom of the sidebar — visible to admins only. Admins are **exactly like everyone else** inside the app; the console is simply an extra layer.

While the factory password is still in use, a warning stays pinned to the console and the sidebar entry until you change it under **Settings → Account**.

**Eight sections**

| Section | What it does |
| --- | --- |
| **Overview** | Account composition · total and lit stars · 14-day arrival/registration/login trends · guests and source IPs · shares and mail · process and disk · site toggles, with runtime figures refreshing every 10s |
| **Travelers** | Search (name/username/email/IP), filter, sort, paginate; expand any row for that person's constellations, memory strength, source IP, last login, shares, visitors and sessions; ban, grant/revoke admin, reset password, edit profile, force sign-out, cascade delete |
| **Guests** | Anonymous guests grouped by source IP · per-IP limit · individual toggles for the four feature gates · one-click purge of empty accounts (never touching one that has saved anything) |
| **Shares** | Who has opened a galaxy to the outside, how far, and how many visitors; force-close (the cipher survives, so the owner can reopen) |
| **Sessions** | Every device that has signed in; tokens surface as a fingerprint only — the full token never leaves the database |
| **Broadcast** | Site-wide announcements (three tones + live preview, shown once per user) · registration switch · maintenance mode |
| **System** | Database size breakdown · one-click backup download (full `.db`) · WAL checkpoint · VACUUM · expired-session cleanup |
| **Audit log** | Every ban, deletion, password change and site change (last 2000 entries) |

Every figure is computed server-side from the database on request — never cached, never estimated.

**Hard rules** — admins cannot ban or delete themselves; the last admin cannot be demoted; to ban or delete another admin you must revoke their admin status first; deletion requires retyping the target's username exactly; a ban takes effect immediately, leaving the banned user only a sign-out button.

> Every `/api/admin/*` route is guarded server-side, so flipping a client-side boolean to `true` gets you nothing.

### Guests and feature gates

**One guest per IP** — a single unregistered anonymous account is allowed per source address. The second visitor is stopped and invited to sign in or register; registering frees the slot immediately. The limit is adjustable in the console's **Guests** section (`0` = unlimited).

> **Read this if you use a reverse proxy** — Stellar Raft judges origin by the direct socket address. Behind nginx / Caddy every request looks like `127.0.0.1`, and the limit would lock the whole server to one guest. Start with `SR_TRUST_PROXY=1` to read the first `X-Forwarded-For` hop instead — **only when your own proxy really sits in front**, since that header can be forged.

**Four capabilities require an account** (all on by default, individually switchable)

| Gate | Enforced at | Why |
| --- | --- | --- |
| Note editing | Client entry point | Notes are things you come back to; they deserve an account you can take with you |
| Markdown vault import/export | Client entry point | Bulk movement of an entire galaxy |
| Galaxy sharing | **Server-side** | Once a cipher is out, people can find you through it — there should be an owner first |
| Interstellar roaming | **Server-side** | Visiting leaves footprints in someone's galaxy and lets them write back |

A guest who reaches a gated feature never meets a broken button — they get an explanation card and the line "registering folds your current galaxy into the account in place, losing nothing", with the sign-in page one tap away.

---

## Architecture

Layered bottom-up: design tokens → component library → app UI kit, with a zero-dependency backend and a zero-build docs site alongside.

<div align="center">
<img src="docs/diagrams/architecture.svg" alt="Architecture" width="820"/>
</div>

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 18 (compiled in-browser by `@babel/standalone` · zero build) |
| 3D | Three.js (the Galaxy3D view) |
| Icons | Lucide (line icons · no emoji) |
| Styling | Native CSS design tokens · glassmorphism · dual `data-theme` themes |
| Memory | FSRS-lite (`R = exp(−Δt/S)`) |
| Backend | Node ≥ 22.5 built-in `node:sqlite` (zero third-party deps) |
| Tests | `node --test` (18 suites, 236 tests) · oxlint |

---

## Project structure

```text
stellar-raft/
├─ styles.css              # the only entry consumers import (imports only)
├─ tokens/                 # design tokens: colors · spacing · typography · effects · themes (Dawn)
├─ assets/                 # <sr-starfield> web component + SRConnect link curves
├─ components/             # 18 reusable primitives · core / knowledge / overlay / form
├─ ui_kits/stellar-raft/   # the interactive app (8 screens + console · 3 breakpoints · memory model)
├─ server/                 # zero-dependency backend (node:sqlite)
│   ├─ server.js           #   request pipeline: identity → ban/maintenance/gates → dispatch
│   ├─ config.js           #   port, paths, database location (env vars only)
│   ├─ db.js               #   schema, migrations, every prepared statement
│   ├─ core.js             #   shared: replies · identity · site settings · audit · decay · delivery
│   ├─ seed.js             #   first-boot seeds: demo friend and default admin
│   └─ routes/admin.js     #   admin console (/api/admin/*, guard runs first)
├─ docs/                   # zero-build static docs site + screenshots + diagrams
├─ guidelines/             # 15 foundation spec cards (color / type / spacing / icons / brand)
├─ scripts/                # build · lint (artifacts are generated — never hand-edit _ds_bundle.js)
└─ tests/                  # node --test: 18 suites (server / auth / admin / responsive / compile / tokens …)
```

**Design system** — 18 primitives on the `window.StellarRaftDesignSystem_2866af` namespace:

- `core/` — Icon · IconButton · Button · GlassPanel · Badge · Tag · Input
- `knowledge/` — MemoryBar (+ memoryColor) · StarNode · ConstellationItem
- `overlay/` — Modal · Toast (+ imperative `toast()`) · Tooltip · ContextMenu
- `form/` — Select · Switch · Checkbox · Tabs

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run serve` | Start the local backend + static hosting (`server/server.js`) |
| `npm test` | Run `node --test` — 18 suites, 236 tests |
| `npm run build` | Rebuild `_ds_bundle.js` + `_ds_manifest.json` from source |
| `npm run build:check` | Detect drift between artifacts and source (for CI) |
| `npm run lint` | Run oxlint against the derived rule config |

---

## License

This repository is currently **private and all rights are reserved**; no open-source license is attached yet. To open it up, add a `LICENSE` file at the root.

<div align="center">
<br/>
<sub>Stellar Raft · 星图 — Memory, made to shine.</sub>
</div>
