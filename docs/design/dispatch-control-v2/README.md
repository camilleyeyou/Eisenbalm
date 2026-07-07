# Handoff: Dispatch Control — editorial operator console

## Overview
Dispatch Control is the single-operator console for **The Eisenbalm Dispatch**: a weekly, agent-produced editorial issue (a digital magazine that is also an e-commerce site selling lip balm, donating proceeds to one obscure, verified charity per issue). A pipeline of ~11 LLM agents plus 3 deterministic code gates produces each issue; **one human editor** reviews, de-slops, and publishes.

The console's job, in priority order:
1. **Review an issue in under 5 minutes** — everything blocking, sourced, and decidable on one screen.
2. **Make it not read like AI** — a dedicated human line-edit (Voice Pass) with its own sign-off.
3. **Improve the agents safely** — edit prompt → eval → scoreboard → commit/rollback, without paid pipeline runs.
4. **Trust the self-checks** — verification, provenance, and drift visible everywhere; a check that *ran* says so.

## About the design files
The files in this bundle are **design references authored in HTML** — prototypes that show intended look and behavior. They are **not production code to copy**. The `.dc.html` files are self-contained "Design Component" prototypes: they open directly in a browser (double-click) and use React + inline styles internally, but you should treat them as **visual + interaction specs**, not a component library.

**The task:** recreate these designs in the target codebase's environment using its established patterns and libraries. There is **no existing production app** yet beyond a v1 that is CRUD-over-prompts (see "What exists" below), so the developer should also **choose the stack** — a React/Next.js SPA with a typed backend and a job/queue system for the agent pipeline is the natural fit, but that's an open decision (see Decisions).

## Fidelity
**High-fidelity.** `Dispatch Control.dc.html` is the committed design: final palette, typography, spacing, layout, and interaction model. Recreate it closely. The two companion files are context, not build targets:
- `Dispatch Control — Review Desk Directions.dc.html` — the three visual directions we compared. **Direction 1c (bold anti-SaaS magazine) was chosen** and is what the main file implements. Included so the dev sees what was rejected and why.
- `Dispatch Control — Audit.dc.html` — the design rationale (v1 gaps, v2 risks R1–R6, the fixes baked into the design). **Read this first** — it explains *why* the UI is shaped this way.
- `4 - Design Brief - Dispatch Control v2.md` and `4 - Wireframe ... .html` — the original product/functionality spec. The source of truth for behavior the prototype only gestures at.

## What exists today (v1)
A deployed v1 (`/graph`) that is essentially CRUD over prompts and pipeline runs plus a DAG visualizer. It exposes the plumbing, not the product — the audit documents its gaps. Treat v2 as a ground-up rebuild of the operator surface; the underlying agent pipeline / prompt store may be reusable.

---

## Screens / Views

The app is a persistent chrome (masthead + left nav) with a swappable main pane. Eight views.

### Global chrome
- **Masthead** (fixed, height 52px, bg `#17140e`, text `#f4f2ec`): wordmark `DISPATCH/CONTROL` (Space Grotesk 700, the `/` in vermilion `#e8471d`); issue number; pipeline-state chip (`Awaiting review`, marigold `#f2b01e` bg / ink text); right side → **Awaiting-you** chip (vermilion bg, clickable, opens inbox dropdown), month-to-date spend `$12.40 / $200`, and an `Auto-publish OFF` lock chip.
- **Awaiting-you inbox** (dropdown under the chip, 360px, white, 3px vermilion top border): list of everything blocked on the human across issues/stages; each item routes to the relevant screen. This is the cross-screen answer to "what needs me right now."
- **Left nav** (210px, bg `#e3e5e8`): two groups — *Workflow* (1 Review Desk, 2 Signal Desk, 3 Run Monitor, 4 Voice Pass) and *Craft & memory* (5 Prompt Lab, 6 Eval Center, 7 Registry); *How to use* pinned at bottom. Active item: bg `#17140e`, text `#f4f2ec`, 3px vermilion left border, weight 600.

### 1. Review Desk (home)
The 5-minute publish review. Two columns: **Galley** (left, flexible) + **Decision rail** (right, 336px, bg `#f1f0ea`).
- **Galley**: the issue rendered as the reader will see it (theme fonts). Section-status chip strip at top (jump nav). Provenance: sourced claims carry a **marigold highlight** (`linear-gradient(transparent 60%, rgba(242,176,30,.5) 60%)`), hover → source URL + retrieval date; **unsourced claims = rust tint** (`rgba(232,71,29,.13)` + dotted rust underline) — a first-class visual state. QA findings underline the offending span in rust; clicking opens a popover (axis · severity · reason · suggested fix · **Accept fix / Edit inline / Dismiss+reason**). Game section is a sandboxed iframe placeholder.
- **Decision rail** (blockers-first): headline count ("1 blocker to clear · 2 warnings · 1 unsourced · ~4 min"); **Blocking items** checklist (each must resolve before Publish enables); Editor's memo; Hook card (with `hookVerified`); **Verification** block with *affirmative* state ("checked 2m ago", "10/11 sourced · 1 open"); Actions (Publish — disabled until blockers clear; Hold; Re-run section ▾; Transcript).

### 2. Signal Desk
Discovery as an editorial decision.
- **Signals** (3 cards from the Signal Editor): signal, dated peg + source link, angle, category chip, **brand-risk chip** (rust, never auto-hidden). Actions: Pin / Kill+reason.
- **Candidate slate** (grouped by signal): name, hookClaim, the four gate badges (REAL / OBSCURE / SPECIFIC / TELLABLE), verification strip (domain / EIN / press), Advocate score 1–10, and **primaryConcern always visible** (never truncated).
- **Gate 1 decision**: winner, confidence meter (0–1), editor reasoning. **Interrupt state** (`requiresHumanInput=true`): the decision area switches to side-by-side adjudication of the top two candidates; the human picks; rationale is logged to the deliberation transcript. (Prototype: "▷ Simulate interrupt" toggles this.)

### 3. Run Monitor
The pipeline drawn so checks-and-balances are legible. Vertical spine: **agents = black dots**, **the 3 code gates = marigold diamonds** (Verify Candidates, Verify Research, Validate Sections). Run summary (cost, duration, gates passed, where it paused). Click any node → **inspector** (right, 372px): model/kind, cost/latency/retries, **the handoff** (from → this → to), human-readable output (raw JSON behind a toggle), **Re-run from this node**, and a "this run vs last 8" drift sparkline.

### 4. Voice Pass  *(added per audit R2 — the de-slop step)*
The human line-edit. Facts are already cleared; this is about the ear. Machine-tells lit inline (rust dotted underline); clicking one opens an **as-written vs house-voice rewrite** popover (Accept ↵ / Write my own / Keep — not a tell). Right rail: machine-tells list, the **voice law** (reference to `voice_constraints`, not a restatement), and **two separate sign-offs**: "Facts cleared" (from Review Desk) and "Sounds human" (this pass). **Publish requires both greens.**

### 5. Prompt Lab
Safe iteration. Three columns: **asset rail** (agent prompts / section guidance / shared, with status chips: eval-passed / never-evaluated / **never-seeded** ⚠ / single-source); **editor** (monospace; variable pills validated against what the pipeline actually injects — valid = green, undeclared = rust "code does not supply this"; single-source guardrail warns if you restate `voice_constraints`); **eval drawer** (auto-selected affected scenarios → scoreboard with v-vs-draft deltas → **commit gated** on "target up, no regressions", with an **Override + reason** escape hatch per audit R5).

### 6. Eval Center
The drift detector. 8 golden-scenario cards (normal week, dry well, famous bait, ghost charity, radioactive week, repeat pressure, voice gauntlet, hallucination trap) each with description + last result. **Shadow run** card (runs scenario 1 against this week's real news before paying for a live run). **Append-only scoreboard** time-series (gates, fact n/5, voice violations, machine-tells, review minutes).

### 7. Registry
Institutional memory. **Coverage memory** strip (last 8 issues' cause/geo/signal — what the Calibrator reads so adjacent weeks don't rhyme). Charities table (status, cause, geo, verification, corrections count). **Append-only corrections log** (re-read by the Researcher on future mentions). Blocklisting requires typed confirmation.

### 8. How to use
In-app operator guide: the weekly loop (5 steps), a color legend, and four house rules. Good source for onboarding copy.

---

## Interactions & behavior
- **Navigation**: left-nav click swaps the main pane (client-side routing; give each screen a URL so the inbox and deep links work).
- **Awaiting-you inbox**: toggle dropdown; items route to the blocking screen.
- **Run Monitor**: node click sets a selected node and repaints the inspector; selected node gets a 2px cobalt border.
- **Signal Desk interrupt**: toggles the decision panel between "resolved winner" and "adjudication" layouts.
- **Review Desk QA popover / Voice Pass rewrite**: Accept applies the suggested text to that block and logs it; Dismiss requires a one-line reason.
- **Publish** and other irreversible actions (blocklist, auto-publish toggle) require **typed confirmation**.
- No animations of note beyond simple show/hide; keep it calm.

## State management (client)
Selected screen; selected Run Monitor node; inbox open/closed; interrupt vs resolved (Signal Desk); per-finding resolution status (accepted/edited/dismissed); the two Review/Voice sign-off booleans (Publish gate). Server state: current issue + pipeline status, findings, provenance, signals/candidates, run graph, prompt versions + eval results, registry + logs.

## Design tokens
**Color**
- Ink `#17140e` · ink-soft `#55514a` · faint `#8b8778`
- App paper `#e9eaec` · nav `#e3e5e8` · rail `#f1f0ea` · card `#ffffff` / `#fbfaf6`
- Hairline `rgba(20,20,26,.13)`
- **Cobalt** `#253ad4` (interactive / links / current selection), dark `#1b2ba6`
- **Vermilion** `#e8471d` (error / blocking / unsourced / urgent)
- **Marigold** `#f2b01e` (warning / sourced-claim highlight / code gates); text-on-light variant `#9a6f04`
- **Green** `#148a52` (verified — a check that ran and passed)
- Masthead text `#f4f2ec` · muted-on-dark `#c9c3b5`

**Type** (all Google Fonts, OFL — free to embed)
- **Newsreader** — display / headlines / big numerals (weights 400–600, incl. italic)
- **Lora** — body serif
- **Space Grotesk** — UI labels, chips, buttons, nav (weights 400–700; used uppercase w/ `.04–.14em` tracking at 9–12px)
- **IBM Plex Mono** — code, JSON, metrics, EINs

**Scale / misc**
- Screen header h1: Newsreader 27px. Galley headline: Newsreader 52px/.98. Deck: Newsreader italic 22px. Body: 16.5px/1.7.
- Micro-labels: Space Grotesk 9–9.5px, uppercase, tracked.
- Borders are mostly 1–2px hard lines; **no rounded corners** on the magazine surfaces; buttons use hard edges and occasional offset shadows (`5px 5px 0` in cobalt/vermilion) as a deliberate anti-SaaS move.
- Rail width 336px; Run inspector 372px; nav 210px; masthead 52px.

## Assets
No raster assets or custom icons — the design is type + rule + color only. Fonts load from Google Fonts. The "game" is a sandboxed iframe you'll need to define separately.

## Files in this bundle
- `Dispatch Control.dc.html` — **the design to build** (hifi, all 8 screens).
- `Dispatch Control — Review Desk Directions.dc.html` — the 3 compared directions (1c chosen).
- `Dispatch Control — Audit.dc.html` — design rationale (read first).
- `4 - Design Brief - Dispatch Control v2.md` — functional spec / source of truth.
- `4 - Wireframe - Dispatch Control v2.html` — low-fi structural companion.
- `DECISIONS.md` — the open decisions you must resolve (below).
