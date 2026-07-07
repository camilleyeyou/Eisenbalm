# Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox - Research

**Researched:** 2026-07-06
**Domain:** Next.js 15 App Router design-system retheme + chrome rebuild + read-aggregation inbox, for a single-operator internal console (`apps/dispatch-control`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Nav & routes**
- D-01: Left nav follows the dc.html spec — two groups (*Workflow:* Review Desk · Signal Desk · Run Monitor · Voice Pass; *Craft & memory:* Prompt Lab · Eval Center · Registry) with "How to use" pinned at bottom — **plus a third quiet group ("Operations": Config · Finance · Settings)** styled to match.
- D-02: Not-yet-built screens (Review Desk, Signal Desk, Voice Pass, Eval Center) render **1c-styled, phase-labeled placeholder pages** ("coming in Phase X") — same honest-placeholder pattern Phase 21 used.
- D-03: **Final route structure lands now**: `/review-desk`, `/signal-desk`, `/run-monitor`, `/voice-pass`, `/prompt-lab`, `/eval-center`, `/registry`, `/how-to-use` (+ Operations routes), with **redirects from the old paths** (`/graph`, `/runs`, `/prompts`, …).
- D-04: **Home = Review Desk** — `/` redirects to `/review-desk` even while it's a placeholder. (Supersedes Phase 21 D-09, which made Graph home.)
- D-05: `/run-monitor` hosts the **existing Runs list and Graph visualizer as two tabs/sub-routes** under one nav item.

**Restyle depth**
- D-06: **Token swap + chrome rebuild.** Masthead + left nav rebuilt to dc.html fidelity (52px ink masthead, vermilion `/` in wordmark, 210px `#e3e5e8` nav, active item = ink bg + 3px vermilion left border). Existing screens keep their current layouts but get the 1c skin via the global CSS-variable/font swap. Per-screen re-layout belongs to each screen's owning phase.
- D-07: Config, Finance, Settings (no owning rebuild phase) get **token swap only** in this phase. If layouts look off, note as follow-ups — do not re-lay-out here.

**Awaiting-you inbox**
- D-08: "Unresolved blocker" = **unaccepted error-severity `qaCorrections` + open claim-check sign-offs** on the current draft.
- D-09: **Pure derivation lifecycle** — no dismiss/snooze, no new Convex tables.
- D-10: **Scope window: active runs only.** Awaiting-review and interrupted runs always show; failed runs surface only from the current issue cycle / most recent run.
- D-11: **Items route to wherever the action can be taken today** — never a dead end into a placeholder.

**Spec ingestion & How-to-use**
- D-12: **Commit the full design handoff bundle into the repo** at `docs/design/dispatch-control-v2/` (all 7 files). Planner: make this an early task.
- D-13: **Claude drafts the How-to-use content** from the handoff README/DECISIONS.md/color legend. Andrew reviews/edits at UAT.

**Ops fix (CHR-05)**
- D-14: `NEXT_PUBLIC_PIPELINE_URL` must be set in the deployed dashboard's Vercel project and verified live. Requires a **human checkpoint** (Andrew). Researcher must check CORS on the FastAPI side.

### Claude's Discretion
- Font role mapping (which of the 4 fonts styles UI vs data vs content) — follow `Dispatch Control.dc.html`; Space Grotesk for wordmark/UI chrome, IBM Plex Mono for data readouts.
- Exact chip styling, inbox dropdown internals (360px, white, 3px vermilion top border per spec), empty state copy.
- Spend-cap source: `pipeline_config` `cost_cap_usd` vs `PIPELINE_COST_CAP_USD` env — use whichever the existing finance/config code treats as canonical.
- Redirect implementation (next.config redirects vs route-level), Operations group label, `/run-monitor` tab mechanics.
- Preserving the Phase 24 CodeMirror `.cm-prompt-editor` variable-highlight styles through the globals.css retheme.

### Deferred Ideas (OUT OF SCOPE)
- Layout follow-ups for Config/Finance/Settings if the token swap makes current layouts read poorly (D-07: note, don't fix).
- Graph visualizer retirement/merge — deferred to Phase 37.
- Re-pointing inbox routes to Review Desk/Signal Desk when those phases land — Phases 32/37 (D-11).
- EIC assignable seat, notifications for "stuck" states — later phases; inbox here is display-only aggregation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHR-01 | 1c design system (tokens + 4 fonts) on every console screen, hard-edged anti-SaaS surfaces | Exact token values + font stack extracted from `Dispatch Control.dc.html`; `apps/web`'s Phase 19 `next/font/google` pattern is a proven reference; **critical finding**: only 1 shadcn primitive (`switch.tsx`) uses CSS-variable Tailwind classes — all other existing screens use literal `neutral-*` classes, so a `globals.css :root` remap alone will NOT reskin existing screen bodies (see Pitfall 1) |
| CHR-02 | Persistent masthead: issue #, pipeline-state chip, MTD spend vs cap, auto-publish lock chip | Exact Convex query wiring verified: `runs.latest` (issue/state), `runs.monthToDateCost` (spend), `pipelineConfig.getAll` filtered to key `monthly_cap_usd` (canonical cap — see Architecture Pattern 2) and `auto_publish` |
| CHR-03 | Workflow-ordered left nav + "How to use" screen | Exact nav item styling formula extracted from dc.html's `nav_*_style` generator; full "How to use" screen copy (weekly loop, color legend, 4 house rules) extracted verbatim from dc.html for D-13 |
| CHR-04 | Awaiting-you inbox aggregating awaiting-review runs, Gate 1 interrupts, unresolved blockers, failed runs; each item routes to owning screen | Verified: Gate-1-interrupt and full-awaiting-review are NOT distinguished by any status literal in the schema (both write `status:'awaiting-review'` + `awaitingHumanAt`) — existing `ReviewQueue.tsx` already conflates them and links both to `/review`; no resume UI exists anywhere in dispatch-control today (see Pitfall 2 / Open Question 1) |
| CHR-05 | `NEXT_PUBLIC_PIPELINE_URL` configured + verified live in production | Fix is two-sided and already fully documented in `apps/dispatch-control/DEPLOY.md`: Vercel env var (dashboard) + `DASHBOARD_ALLOWED_ORIGINS` (Railway pipeline CORS) — see Architecture Pattern 4 |
</phase_requirements>

## Summary

This phase reskins and re-chromes an already-working, already-authenticated Next.js 15 App Router dashboard (`apps/dispatch-control`) — it does not build new screens or touch the pipeline's business logic. The binding visual spec is a static HTML file (`Dispatch Control.dc.html`) with a small proprietary `<script type="text/x-dc">` block; both were read directly and every needed value (colors, font stack, exact pixel measurements, the nav active/inactive style formula, and the full "How to use" copy) was extracted verbatim below so the planner can put them straight into task actions without re-deriving anything.

Two findings materially change how "token swap" (D-06/D-07) should be scoped. First, `apps/dispatch-control` has only one shadcn primitive wired to CSS-variable Tailwind classes (`components/ui/switch.tsx`); all 13 files across `config/`, `finance/`, and `settings/` use literal `neutral-*`/`white` Tailwind classes. A `globals.css :root` variable remap will restyle the new chrome (masthead + nav, built from scratch) but will **not** visually touch existing screen bodies at all — satisfying ROADMAP Success Criterion 1 ("no leftover default styling remains") requires a mechanical literal-class pass across those files, not just a CSS variable edit. Second, the Convex schema does not distinguish a Gate-1 interrupt from an end-of-pipeline "ready for review" state — both write `pipelineRuns.status = "awaiting-review"` plus `awaitingHumanAt`; the only structural difference is whether `sanityIssueId` has been set yet (by the Publisher, much later in the graph). The existing `ReviewQueue.tsx` component already ignores this distinction and routes every `awaiting-review` run to `/runs/{runId}/review` — and no resume-from-interrupt UI exists anywhere in the dashboard today. The inbox this phase builds should follow that same existing simplification (route by `status` alone) rather than inventing new Gate-1-specific handling, and the planner should flag the Gate-1-resume UI gap as an explicit, scoped-out follow-up for Signal Desk (Phase 37).

The `NEXT_PUBLIC_PIPELINE_URL` fix (CHR-05) is not undiscovered territory — `apps/dispatch-control/DEPLOY.md` already documents the exact two-sided fix (Vercel env var on the dashboard project + `DASHBOARD_ALLOWED_ORIGINS` on the Railway pipeline service, which the FastAPI `CORSMiddleware` already reads at `packages/pipeline/src/eisenbalm_pipeline/api/main.py:171-184`). This phase's job is to verify both are actually set in the live deployments (not just documented) and confirm the test-run panel works end-to-end in production — a human checkpoint for Andrew, not new code.

**Primary recommendation:** Build the masthead + nav as new, 1c-token-native components (no dependency on the existing shadcn variable shim); do a source-scan-verified literal-class pass across Config/Finance/Settings for the token-swap-only requirement; derive the inbox as a pure client-side aggregation over three existing Convex queries (`runs.listForWorkspace`, `qaCorrections.byRunId`, `claim_checks.allSignedOff`) with zero new backend; and treat the `NEXT_PUBLIC_PIPELINE_URL`/CORS fix as a verification-and-checkpoint task against already-written deploy documentation, not a code task.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next/font/google` | ships with `next@^15.3.9` (already installed) | Self-host Newsreader / Lora / Space Grotesk / IBM Plex Mono, zero CDN/CLS | Already the proven pattern in `apps/web/app/layout.tsx` (Fraunces/Newsreader/IBM Plex Mono loaded exactly this way in Phase 19); no new dependency |
| Tailwind v4 `@theme` | `^4.3.0` (already installed) | 1c design tokens as first-class Tailwind utilities/CSS variables | CSS-first, no `tailwind.config.js` needed; add token block directly to `apps/dispatch-control/app/globals.css` |
| Convex `useQuery` | `^1.38.0` (already installed) | Masthead chips + inbox live data | Already the app's only data-fetching pattern; zero new wiring pattern needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | `^1.14.0` (already installed) | Any icon needs in nav/masthead (dc.html uses none — type+rule+color only) | Optional; dc.html spec has zero icons, only Unicode glyphs (`●`, `▷`, `?`) and CSS shapes — prefer matching that over adding icon usage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Literal-class pass on Config/Finance/Settings | A blanket CSS override remapping Tailwind's `neutral-*` scale globally | Fragile and un-debuggable — `neutral-50`..`neutral-900` are used all over for genuinely neutral UI chrome (borders, disabled states) as well as backgrounds; remapping the whole scale risks unintended side effects on things that should stay neutral. A scoped, source-scan-verified literal-class swap on the ~13 known files is safer and matches D-07's narrow intent |
| New masthead/nav built without touching `AppSidebar.tsx` | Extending the existing `AppSidebar.tsx` in place | The existing sidebar is 210px-adjacent-width already but uses `rounded-md`/`neutral-*` classes and a single ungrouped nav array; the dc.html spec's grouped nav + active-state formula (ink bg + 3px vermilion left border, no rounding) is different enough that a rewrite (new component, same file path) is cleaner than incremental patching |

**Installation:**
No new packages required for this phase. All fonts, styling, and data-fetching mechanisms are already present in `apps/dispatch-control`.

**Version verification:** `next@^15.3.9`, `tailwindcss@^4.3.0`, `convex@^1.38.0`, `lucide-react@^1.14.0` — all confirmed installed via `apps/dispatch-control/package.json` (read directly, 2026-07-06). No registry lookup needed since nothing new is added.

## Architecture Patterns

### Recommended Project Structure
```
apps/dispatch-control/
├── app/
│   ├── layout.tsx                       # ADD: 4 next/font/google loaders (Newsreader/Lora/Space Grotesk/IBM Plex Mono) as CSS vars
│   ├── globals.css                      # ADD: 1c @theme token block; PRESERVE .cm-prompt-editor rules verbatim
│   ├── page.tsx                         # NEW/CHANGE: root redirect → /review-desk (D-04, currently doesn't exist — root has no page.tsx today, only (dashboard)/page.tsx)
│   ├── (dashboard)/
│   │   ├── layout.tsx                   # REWRITE: mount new <Masthead /> above <AppSidebar />+<main>
│   │   ├── page.tsx                     # CHANGE: redirect target /graph → /review-desk (D-04 supersedes Phase 21 D-09)
│   │   ├── review-desk/page.tsx         # NEW: 1c placeholder ("coming in Phase 32-33") — D-02
│   │   ├── signal-desk/page.tsx         # NEW: 1c placeholder ("coming in Phase 37") — D-02
│   │   ├── run-monitor/
│   │   │   ├── page.tsx                 # NEW: tab shell hosting Runs + Graph (D-05)
│   │   │   ├── runs/...                 # MOVE existing runs/ tree here (or tab-switch, Claude's discretion)
│   │   │   └── graph/...                # MOVE existing graph/ tree here
│   │   ├── voice-pass/page.tsx          # NEW: 1c placeholder ("coming in Phase 36") — D-02
│   │   ├── prompt-lab/                  # RENAME from prompts/ (route only; component logic untouched)
│   │   ├── eval-center/page.tsx         # NEW: 1c placeholder ("coming in Phase 38") — D-02
│   │   ├── registry/                    # UNCHANGED route, token-swap only
│   │   ├── how-to-use/page.tsx          # NEW: full content from dc.html (weekly loop + color legend + 4 house rules)
│   │   ├── config/ finance/ settings/   # UNCHANGED routes, literal-class token-swap pass (D-07)
│   │   └── graph/ runs/ prompts/        # OLD paths — replaced by redirects (D-03), do not leave dangling
│   └── (root) — old /graph, /runs, /prompts paths → next.config.ts redirects() to new homes
├── components/
│   ├── Masthead.tsx                     # NEW: issue#/state chip/spend/lock chip/inbox trigger
│   ├── AwaitingYouInbox.tsx             # NEW: dropdown, pure-derivation aggregation
│   └── AppSidebar.tsx                   # REWRITE: 3-group nav (Workflow/Craft & memory/Operations) + How-to-use pinned bottom
├── lib/
│   └── nav.ts                           # REWRITE: grouped NAV_ITEMS shape (breaking change — __tests__/nav.test.ts must be rewritten alongside)
└── next.config.ts                       # ADD: redirects() array for D-03 old→new paths
```

### Pattern 1: `next/font/google` → Tailwind v4 `@theme` (4-font variant)
**What:** Load each Google Font as a Next.js font object with a `variable` CSS custom property, then reference those variables inside Tailwind v4's CSS-first `@theme` block.
**When to use:** Root layout font wiring for the entire console.
**Example (mirrors the proven `apps/web` Phase 19 pattern, extended to 4 fonts):**
```typescript
// apps/dispatch-control/app/layout.tsx
import { Newsreader, Lora, Space_Grotesk, IBM_Plex_Mono } from 'next/font/google'

const fontDisplay = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
  axes: ['opsz'],       // variable font — omit `weight` when axes present (per apps/web precedent)
  style: ['normal', 'italic'],
})
const fontBody = Lora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lora',
  weight: ['400', '500', '600'],   // Lora is NOT a variable font in next/font/google — declare weights explicitly
})
const fontUi = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
})
const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ibm-plex-mono',
  weight: ['400', '500'],
})
// <body className={`${fontDisplay.variable} ${fontBody.variable} ${fontUi.variable} ${fontMono.variable}`}>
```
```css
/* apps/dispatch-control/app/globals.css */
@theme {
  --font-display: var(--font-newsreader), serif;
  --font-body: var(--font-lora), Georgia, serif;
  --font-ui: var(--font-space-grotesk), sans-serif;
  --font-mono: var(--font-ibm-plex-mono), monospace;

  --color-ink: #17140e;
  --color-ink-soft: #55514a;
  --color-faint: #8b8778;
  --color-paper: #e9eaec;
  --color-nav: #e3e5e8;
  --color-rail: #f1f0ea;
  --color-card: #ffffff;
  --color-card-alt: #fbfaf6;
  --color-cobalt: #253ad4;
  --color-cobalt-dark: #1b2ba6;
  --color-vermilion: #e8471d;
  --color-marigold: #f2b01e;
  --color-marigold-text: #9a6f04;
  --color-green: #148a52;
  --color-masthead-text: #f4f2ec;
  --color-masthead-muted: #c9c3b5;
}
```
**Source:** `apps/web/app/layout.tsx` (Fraunces/Newsreader/IBM Plex Mono pattern, Phase 19); Google Fonts weight availability confirmed via the dc.html `<link>` tag itself (`family=Newsreader:ital,opsz,wght@...;family=Lora:ital,wght@0,400;0,500;0,600;1,400;family=Space+Grotesk:wght@400;500;600;700;family=IBM+Plex+Mono:wght@400;500`).

### Pattern 2: Masthead data wiring (exact query map)
**What:** Every masthead chip maps to an already-existing, already-verified Convex query — no new backend.
**When to use:** `components/Masthead.tsx`.
```typescript
// Issue number + pipeline-state chip
const latestRun = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })
// latestRun.status: 'running' | 'awaiting-review' | 'complete' | 'failed'
// latestRun does NOT carry issueNumber (that lives on pipelineRuns, not runs) —
// cross-reference api.pipelineRuns.byRunId({ runId: latestRun.runId }) for issueNumber if needed,
// OR confirm whether Andrew accepts "no issue # shown until pipelineRuns lookup wired" (flag to planner).

// MTD spend vs cap
const mtd = useQuery(api.runs.monthToDateCost, { workspace_id: DEFAULT_WORKSPACE_ID })
// mtd.mtdUsd is the numerator.
const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id: DEFAULT_WORKSPACE_ID })
// CANONICAL cap key: 'monthly_cap_usd' (JSON-encoded number) — this is the SAME key
// apps/dispatch-control/app/(dashboard)/config/_components/BudgetCapsPanel.tsx already
// reads/writes today (Phase 25 RUN-06). Resolves the CONTEXT "Claude's Discretion" question:
// use 'monthly_cap_usd' from pipeline_config, NOT the PIPELINE_COST_CAP_USD env var (that's a
// pipeline-side PER-RUN fallback constant read only in packages/pipeline/src/.../lib/cost.py,
// not exposed to the dashboard at all).

// Auto-publish lock chip
// configRows also contains key 'auto_publish' (JSON-encoded boolean) — Phase 26 RVW-04.
```
**Source:** `convex/runs.ts` (`latest`, `monthToDateCost`), `convex/pipelineConfig.ts` (`getAll`, `setAutoPublish`), `apps/dispatch-control/app/(dashboard)/config/_components/BudgetCapsPanel.tsx` (confirms `monthly_cap_usd` + `auto_publish` are the live, UI-editable keys).

### Pattern 3: Awaiting-you inbox — pure derivation (no new backend)
**What:** Aggregate 4 categories client-side from 3 existing queries; every item is a projection, nothing is stored.
**When to use:** `components/AwaitingYouInbox.tsx`.
```typescript
// 1. Awaiting-review + Gate-1-interrupt runs (SAME status literal — see Pitfall 2)
const runs = useQuery(api.runs.listForWorkspace, { workspace_id })
const awaitingReview = runs?.filter(r => r.status === 'awaiting-review') ?? []
// D-11 routing: mirror the EXISTING ReviewQueue.tsx pattern — every awaiting-review
// row routes to /runs/{runId}/review (soon /run-monitor/runs/{runId}/review after D-05
// tab restructure). Do NOT attempt to special-case Gate-1 interrupts differently in
// this phase — no distinguishing field exists cheaply, and no resume UI exists to
// route to even if you could distinguish them (see Open Question 1).

// 2. Failed runs — D-10 scope window: current cycle / most recent run ONLY
const latest = useQuery(api.runs.latest, { workspace_id })
const failedItem = latest?.status === 'failed' ? latest : null
// Do NOT surface older failed runs from listForWorkspace — D-10 is explicit that
// history lives in Run Monitor, not the inbox.

// 3 & 4. Unresolved blockers — D-08: unaccepted error-severity qaCorrections +
// open claim-check sign-offs, scoped to the CURRENT draft (i.e. the run that is
// awaiting-review, if any — a run mid-flight or already complete has no "current
// draft" to check blockers against)
const currentDraftRunId = awaitingReview[0]?.runId // there should only ever be ~1
const qaFindings = useQuery(
  api.qaCorrections.byRunId,
  currentDraftRunId ? { runId: currentDraftRunId } : 'skip',
)
const unresolvedErrors = qaFindings?.filter(f => f.severity === 'error' && !f.accepted) ?? []
const claimStatus = useQuery(
  api.claimChecks.allSignedOff, // convex/claimChecks.ts
  currentDraftRunId ? { runId: currentDraftRunId } : 'skip',
)
const openSignOffs = claimStatus && !claimStatus.allSignedOff && claimStatus.total > 0
```
**Note on `'skip'`:** Convex's `useQuery` accepts the string `'skip'` as the args parameter to conditionally not run a query — confirm this exact API against the installed `convex@^1.38.0` client docs before use (HIGH confidence this is correct for Convex's React client, but not independently re-verified against v1.38 changelog in this pass — flag for a 30-second doc check during planning, not a research gap that blocks planning).
**Source:** `convex/runs.ts`, `convex/qaCorrections.ts`, `convex/claimChecks.ts` (all read in full), `apps/dispatch-control/app/(dashboard)/runs/_components/ReviewQueue.tsx` (existing routing precedent).

### Pattern 4: `NEXT_PUBLIC_PIPELINE_URL` + CORS fix — verification, not code
**What:** The fix is fully documented already; this phase verifies + executes it, doesn't invent it.
**When to use:** CHR-05 task.
- **Dashboard side (Vercel, `dispatch-control` project):** set `NEXT_PUBLIC_PIPELINE_URL` to the live Railway pipeline URL. All 4 client files (`lib/testRunClient.ts`, `lib/pipelineControlClient.ts`, `lib/reviewClient.ts`, `lib/scoreClient.ts`) already throw a clear error at call time if unset (`pipelineBaseUrl()` helper, shared logic).
- **Pipeline side (Railway, pipeline service):** set `DASHBOARD_ALLOWED_ORIGINS` to the dispatch-control production origin (comma-separated if multiple). Already read at `packages/pipeline/src/eisenbalm_pipeline/api/main.py:171-184`:
```python
_dashboard_origins = [
    origin.strip()
    for origin in os.environ.get("DASHBOARD_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if not _dashboard_origins:
    _dashboard_origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_dashboard_origins,
    allow_credentials=True,   # forbids wildcard "*" — MUST be an explicit origin list
    allow_methods=["*"],
    allow_headers=["*"],
)
```
- **Verification:** with both set, open the deployed dashboard's test-run panel (`/prompt-lab/{agentKey}` post-rename) in production and confirm a real POST to `/agents/{key}/test-run` succeeds (no CORS error in browser console, no "NEXT_PUBLIC_PIPELINE_URL is not set" thrown error).
**Source:** `apps/dispatch-control/DEPLOY.md` (already documents this exact two-sided fix), `packages/pipeline/src/eisenbalm_pipeline/api/main.py` lines 160-189 (read in full), all 4 `lib/*Client.ts` files (grepped, confirmed identical `pipelineBaseUrl()` pattern).

### Anti-Patterns to Avoid
- **Assuming a `globals.css :root` variable remap reskins the whole app:** It doesn't — see Pitfall 1. Only components using CSS-variable-based Tailwind classes (currently just `switch.tsx`) respond to a variable remap.
- **Distinguishing Gate-1 interrupt from awaiting-review at the data layer for this phase:** The schema doesn't cheaply support it (see Pitfall 2), and no UI exists to route a distinguished interrupt item to. Follow the existing `ReviewQueue.tsx` precedent instead.
- **Building new Convex tables/mutations for the inbox:** Explicitly forbidden by D-09. Every inbox item must be a `useQuery` projection.
- **Leaving old routes (`/graph`, `/runs`, `/prompts`) as orphaned live pages alongside the new ones:** D-03 requires redirects, and `__tests__/nav.test.ts`'s existing "every href has a page file" assertion will need a parallel update or it will pass on stale hrefs while missing the new ones — rewrite the test alongside `lib/nav.ts`, don't leave it stale.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading with zero FOUT | A `<link>`-based Google Fonts import (what the raw dc.html prototype uses) | `next/font/google` (already used in `apps/web`) | Self-hosts + subsets automatically, zero CLS, already proven at this exact Next/React version pairing in this monorepo |
| Grouped/active nav styling | A new CSS framework or nav library | Plain conditional Tailwind classes (or inline styles matching dc.html's generated formula) driven by `usePathname()` — same mechanism `AppSidebar.tsx` already uses | The active-state formula is fully specified (exact colors/weights/border) — this is a lookup table problem, not a component-library problem |
| Inbox "what's blocking me" aggregation | A new notifications/queue service or Convex table | Client-side `useQuery` composition over 3 existing read endpoints | D-09 explicitly locks this as pure derivation; a stored/materialized inbox would need invalidation logic this phase doesn't need |
| Redirects from old to new routes | Manual `redirect()` calls sprinkled in every old page component | `next.config.ts` `redirects()` array (permanent: true) OR a single old-path `page.tsx` that calls `redirect()` — Claude's discretion per CONTEXT | `next.config.ts` redirects are declarative, testable via a single source-of-truth array, and don't require keeping a dead page component file around |

**Key insight:** Nothing in this phase requires new infrastructure — every "don't hand-roll" item above is really "don't invent a new mechanism when the existing `useQuery`/`next/font`/Tailwind mechanisms already solve it."

## Common Pitfalls

### Pitfall 1: A CSS-variable remap in `globals.css` will not reskin most existing screens
**What goes wrong:** Planner assumes "shadcn vars remapped in globals.css" (per CONTEXT D-06) is sufficient to retheme Config/Finance/Settings, then ROADMAP Success Criterion 1 ("no leftover default styling remains") fails at verification because those screens still show `neutral-*` gray, not 1c tokens.
**Why it happens:** `apps/dispatch-control` has `components.json` configured for shadcn with `cssVariables: true`, but only ONE component (`components/ui/switch.tsx`) has actually been generated and uses the variable-based classes (`bg-primary`, etc). All 13 files across `config/`, `finance/`, and `settings/` (verified via `grep -rl "neutral-"`) use literal Tailwind classes like `bg-white`, `border-neutral-200`, `text-neutral-900` directly — these are static utility classes compiled to fixed hex values, not CSS-variable references, and are completely unaffected by changing `:root { --background: ... }`.
**How to avoid:** Scope D-07's "token swap" as a literal, mechanical find-and-replace pass across the known file list (13 files today) that swaps `neutral-*`/`white` classes for 1c-token arbitrary-value classes (e.g. `bg-[color:var(--color-card)]`, `border-[color:var(--color-ink)]/20`) or new Tailwind `@theme`-registered utility names. Budget this as real task-level work, not a side effect of the CSS variable edit.
**Warning signs:** A visual UAT pass where Config/Finance/Settings still look like plain gray shadcn defaults while the masthead/nav look like the 1c spec.

### Pitfall 2: Gate-1 interrupt and full-awaiting-review are the same `status` value with no cheap distinguishing field
**What goes wrong:** CHR-04 / ROADMAP SC4 asks for the inbox to list "awaiting-review runs, Gate 1 interrupts, unresolved blockers, and failed runs" as if they're 4 cleanly separable categories with 4 different routing targets. In the actual schema, both `editor.py`'s Gate-1 `interrupt()` call and the Publisher's end-of-run "ready for Andrew" state write the identical `pipelineRuns.status = "awaiting-review"` + `awaitingHumanAt` timestamp (verified: `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` lines 313-328). The only structural difference is whether `sanityIssueId` has been set (by the Publisher, much later in the graph) — and even that's a fragile signal to build UI routing on.
**Why it happens:** The Gate 1 interrupt/resume feature (PIP-10, built in Phase 4) predates the dashboard's review UI (Phase 26) and was apparently never wired into any dashboard screen — `grep -rln "resume"` across `apps/dispatch-control/lib` and `app` returns zero results. The existing `ReviewQueue.tsx` (Phase 26) already just treats every `awaiting-review` row identically and links all of them to `/runs/{runId}/review`, which would presumably render an empty/broken review page if actually hit by a genuine Gate-1 interrupt (no draft content exists yet at that point).
**How to avoid:** For this phase, treat "awaiting-review runs" and "Gate 1 interrupts" as ONE inbox category (matching existing app behavior) rather than inventing a distinguishing UI the rest of the app doesn't have. Route it exactly where `ReviewQueue.tsx` already routes it. Explicitly flag the missing Gate-1 resume UI as a known gap for Signal Desk (Phase 37) rather than silently building around it — see Open Question 1.
**Warning signs:** Any plan that proposes a new Convex field, a new query filter, or new routing logic specifically to detect "is this row a Gate-1 interrupt vs a normal awaiting-review" — that's over-scoping a Phase 30 chrome task into Phase 37's territory.

### Pitfall 3: Root route currently has no `page.tsx` outside the `(dashboard)` group
**What goes wrong:** D-04 says `/` should redirect to `/review-desk`. Today, `apps/dispatch-control/app/` has no top-level `page.tsx` at all — the only redirect-on-load page is `app/(dashboard)/page.tsx`, which redirects `/` (matched via the route group, which doesn't add a URL segment) to `/graph`. A plan that assumes there's an existing root page to edit outside the dashboard group will look in the wrong place.
**How to avoid:** The single edit point for D-04 is `app/(dashboard)/page.tsx` — change its `redirect('/graph')` to `redirect('/review-desk')`. No new root-level file is needed since the `(dashboard)` route group already owns `/`.
**Warning signs:** A task that says "create `app/page.tsx`" — that would create a route conflict with the existing `app/(dashboard)/page.tsx`, both of which resolve to `/`.

### Pitfall 4: Rewriting `lib/nav.ts`'s shape breaks the existing `__tests__/nav.test.ts` coverage gate
**What goes wrong:** `__tests__/nav.test.ts` hard-asserts `NAV_ITEMS` is a flat 7-item array with specific labels/hrefs in order, AND that every href resolves to a real `page.tsx` on disk. D-01 requires a grouped shape (3 groups + How-to-use pinned separately) — a flat array won't express that, so `NAV_ITEMS`'s type will need to change, and this test will need a parallel rewrite in the SAME task/commit, not left stale (a stale-but-passing version of this test would be actively misleading).
**How to avoid:** Treat `nav.test.ts` as part of the `lib/nav.ts` deliverable, not a separate follow-up. Since the test's core value (no dead links) is worth preserving, the rewritten version should still walk every route (across all 3 groups + How-to-use) and assert a real `page.tsx` exists — including the new placeholder pages from D-02.
**Warning signs:** A plan wave that touches `lib/nav.ts` without also listing `__tests__/nav.test.ts` as a file to change.

## Code Examples

### Nav item active/inactive styling (exact formula, extracted from `Dispatch Control.dc.html`)
```
// Source: Dispatch Control.dc.html, <script type="text/x-dc"> renderVals(), lines ~636-644
// This is the EXACT formula the committed spec generates per nav item — recreate faithfully.
display: flex; align-items: center; gap: 11px; padding: 8px 16px; margin: 1px 0; cursor: pointer;
font-family: 'Space Grotesk', sans-serif; font-size: 12.5px; letter-spacing: .01em;
font-weight: 600 (active) | 500 (inactive);
border-left: 3px solid #e8471d (active) | transparent (inactive);
background: #17140e (active) | transparent (inactive);
color: #f4f2ec (active) | #4a453b (inactive);
```
Group labels (e.g. "Workflow", "Craft & memory") use:
```
font-family: 'Space Grotesk', sans-serif; font-size: 9px; letter-spacing: .14em;
text-transform: uppercase; color: #8b8778; padding: 4px 16px 8px (first group) | 16px 16px 8px (subsequent groups);
```

### Masthead measurements (exact, extracted from dc.html)
```
Masthead: height 52px, background #17140e, color #f4f2ec, padding: 0 22px, display:flex, gap:16px
Wordmark: font-family 'Space Grotesk', font-weight 700, font-size 15.5px, letter-spacing .03em
          "DISPATCH" + <span color:#e8471d>/</span> + "CONTROL"
Pipeline-state chip (e.g. "Awaiting review"): Space Grotesk 600 9.5px uppercase .1em tracking,
          background #f2b01e, color #17140e, padding 3px 9px, border-radius 2px
Awaiting-you chip: Space Grotesk 600 10.5px uppercase .04em, color #f4f2ec,
          background #e8471d, padding 5px 12px, border-radius 2px, cursor pointer
Inbox dropdown: position absolute, top 52px, width 360px, background #fff,
          border 1px solid rgba(20,20,26,.16), border-top 3px solid #e8471d,
          box-shadow 0 24px 50px -20px rgba(20,16,10,.5)
Nav: width 210px, background #e3e5e8, border-right 1px solid rgba(20,20,26,.13), padding 14px 0
```

### "How to use" screen — full copy (verbatim from dc.html, for D-13 drafting)
The weekly loop (5 numbered steps), color legend (4 entries), and 4 house rules were extracted in full from `Dispatch Control.dc.html` lines 565-618 during this research pass. Rather than re-paste the full HTML here, the planner/implementer should pull this content directly from the committed bundle once D-12 lands it at `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — search for `disp_howto` in that file. Key facts to preserve verbatim in the rewritten React version:
- 5 loop steps: (1) Steer discovery · Signal Desk, (2) Watch the run · Run Monitor, (3) Clear the facts · Review Desk, (4) De-slop it · Voice Pass, (5) Improve the machine · Prompt Lab + Eval Center.
- Color legend: green `#148a52` = "Verified/cleared — a check ran and passed"; vermilion `#e8471d` = "Error/blocking/unsourced — needs you"; marigold `#f2b01e` = "Warning/sourced-claim/code gate"; cobalt `#253ad4` = "Interactive/links/the current selection".
- 4 house rules (verbatim headlines): "Silence is never 'verified.'", "Nothing silent.", "JSON is never the default.", "The irreversible ones ask twice."

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Flat `NAV_ITEMS` array, single group, Graph as home (Phase 21 D-07/D-09) | Grouped 3-section nav (Workflow / Craft & memory / Operations), Review Desk as home | This phase (D-01, D-04) | `lib/nav.ts` shape change; `AppSidebar.tsx` rewrite; `nav.test.ts` rewrite |
| No masthead — bare sidebar + content shell (`(dashboard)/layout.tsx`) | Persistent 52px ink masthead on every route | This phase (D-06) | `(dashboard)/layout.tsx` gains a new top-level chrome element above the flex row |
| `/graph`, `/runs`, `/prompts` as canonical paths | `/run-monitor` (tabs), `/prompt-lab`, final route set | This phase (D-03) | Old paths become redirects; internal links (e.g. `ReviewQueue.tsx`'s `/runs/{runId}/review`) need auditing for continued validity post-move |

**Deprecated/outdated:**
- Phase 21 D-09 ("Graph is the default home view") — explicitly superseded by D-04.

## Open Questions

1. **Where does a Gate-1 interrupt route today, if not to a working review page?**
   - What we know: No dashboard UI calls the pipeline's `/run/{runId}/resume` endpoint anywhere. `ReviewQueue.tsx` links every `awaiting-review` row (interrupt or not) to `/runs/{runId}/review`.
   - What's unclear: Whether a Gate-1 interrupt has ever actually been hit in a real run against this dashboard version, and whether `/review` degrades gracefully (empty state) or errors when there's no draft yet.
   - Recommendation: Follow the existing precedent (route Gate-1-interrupt items to the same review page as any other awaiting-review item) for this phase; add an explicit note in the phase's plan that a dedicated Gate-1 adjudication UI is Signal Desk's job (Phase 37), and that this is a pre-existing gap this phase does not need to fix, just not make worse.

2. **Does `runs.latest`/`runs.listForWorkspace` need an `issueNumber` join for the masthead's "current issue number" chip?**
   - What we know: `pipelineRuns` (the older, Phase-4-era table) has `issueNumber`; the newer `runs` table (Phase 21+, which `latest`/`listForWorkspace` query) does not.
   - What's unclear: Whether the masthead should do a second query (`pipelineRuns.byRunId`) to resolve `issueNumber` from the `runId` `runs.latest` returns, or whether "issue number" can be approximated/omitted for now.
   - Recommendation: Plan a small cross-reference (`pipelineRuns.byRunId({ runId })` after getting `runs.latest`) — both queries already exist, this is composition, not new backend work. Confirm with Andrew during UAT whether the shown number matches his expectation.

3. **Convex `useQuery` conditional-skip syntax for the inbox's blocker queries.**
   - What we know: Convex's React client conventionally supports passing the string `'skip'` in place of args to conditionally not run a query.
   - What's unclear: Not independently re-verified against the exact installed `convex@^1.38.0` client in this pass (all verification here was code-reading, not live doc-fetching for this specific API surface).
   - Recommendation: A 30-second check of `node_modules/convex/react` types (or the Convex docs) during planning/implementation is sufficient — this is a well-known, stable Convex API and not expected to be a real blocker, just flagged for completeness per the "verify before asserting" discipline.

## Environment Availability

This phase's only external dependency is the Vercel + Railway deployment environment for CHR-05, which is a human-executed checkpoint, not a locally-runnable tool dependency. No CLI tools, runtimes, or services need to be probed in the local dev environment for this phase — everything else (fonts, Convex, Tailwind) is an existing, already-working local dependency of `apps/dispatch-control`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel project env var access | CHR-05 (`NEXT_PUBLIC_PIPELINE_URL`) | Human checkpoint (Andrew) | — | None — this is the explicit D-14 human checkpoint, not automatable |
| Railway service env var access | CHR-05 (`DASHBOARD_ALLOWED_ORIGINS`) | Human checkpoint (Andrew) | — | None — same checkpoint |

**Missing dependencies with no fallback:** None that block local build/dev work — only the production verification step (CHR-05) requires human action outside the repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^3.2.0` (`apps/dispatch-control/vitest.config.ts`) |
| Config file | `apps/dispatch-control/vitest.config.ts` (existing — `environmentMatchGlobs` pattern for jsdom/edge-runtime per-file overrides) |
| Quick run command | `pnpm --filter dispatch-control test:unit` |
| Full suite command | `pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHR-01 | 1c tokens present in `globals.css`; no literal `neutral-*` classes remain in `config/finance/settings` | source-scan (Vitest, reads file content) | `pnpm --filter dispatch-control test:unit -- design-tokens` | ❌ Wave 0 — new file, e.g. `__tests__/design-tokens.test.ts` |
| CHR-01 | 4 fonts loaded via `next/font/google` in `app/layout.tsx` | source-scan | same file as above | ❌ Wave 0 |
| CHR-02 | Masthead renders issue #, state chip, spend, lock chip using live Convex queries | component test (jsdom + convex-test, mirroring `costRollup.test.ts`/`agentRuns.test.ts` pattern) | `pnpm --filter dispatch-control test:unit -- Masthead` | ❌ Wave 0 — new file `__tests__/Masthead.test.tsx` |
| CHR-03 | `NAV_ITEMS` grouped shape + every href has a real page | unit + fs-existence (same pattern as current `nav.test.ts`) | `pnpm --filter dispatch-control test:unit -- nav` | ✅ exists, needs rewrite (`__tests__/nav.test.ts`) |
| CHR-03 | How-to-use page renders the 5 loop steps + color legend + 4 house rules | component/source-scan test | `pnpm --filter dispatch-control test:unit -- how-to-use` | ❌ Wave 0 |
| CHR-04 | Inbox aggregates awaiting-review/failed/blocker items with zero new Convex writes (source-scan: no new `mutation(` in inbox-related files) | source-scan + convex-test | `pnpm --filter dispatch-control test:unit -- AwaitingYouInbox` | ❌ Wave 0 |
| CHR-04 | Inbox item click navigates to the correct existing route | component test (`next/navigation` mock, same pattern as `runControl.test.tsx`) | same command | ❌ Wave 0 |
| CHR-05 | `pipelineBaseUrl()` throws a clear error when `NEXT_PUBLIC_PIPELINE_URL` unset (regression only — behavior already exists) | existing behavior, no new test strictly required | N/A | ✅ behavior already covered by existing `lib/*Client.ts` implementations |
| CHR-05 | Production verification: test-run panel succeeds against live pipeline | manual UAT (Andrew, post-deploy) | N/A — not automatable (requires live deployed environments) | — |

### Sampling Rate
- **Per task commit:** `pnpm --filter dispatch-control test:unit` (fast, <30s per the project's existing Vitest suite size)
- **Per wave merge:** `pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build`
- **Phase gate:** Full suite green + manual visual UAT against `Dispatch Control.dc.html` side-by-side + Andrew's CHR-05 production checkpoint, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/design-tokens.test.ts` — covers CHR-01 (token presence + literal-class absence in Config/Finance/Settings)
- [ ] `__tests__/Masthead.test.tsx` — covers CHR-02
- [ ] `__tests__/nav.test.ts` — REWRITE (not new) — covers CHR-03, must be updated in the same task that changes `lib/nav.ts`'s shape
- [ ] `__tests__/how-to-use.test.ts` — covers CHR-03 content requirements
- [ ] `__tests__/AwaitingYouInbox.test.tsx` — covers CHR-04
- [ ] No new test file needed for CHR-05 beyond existing `lib/*Client.ts` behavior; add a DEPLOY.md checklist item instead (already exists — just needs execution + a "verified live on {date}" note)

## Sources

### Primary (HIGH confidence — direct code/file reads, this repo, 2026-07-06)
- `~/Downloads/design_handoff_dispatch_control/Dispatch Control.dc.html` — the committed 1c visual spec (full file read, including the `<script type="text/x-dc">` state/style-generation logic)
- `~/Downloads/design_handoff_dispatch_control/README.md` — screen-by-screen spec, Global chrome section, design tokens table
- `~/Downloads/design_handoff_dispatch_control/DECISIONS.md` — binding editorial decisions (two sign-offs, forensic Run Monitor, pause/notify/resume, machine-tell two-layer detection)
- `apps/dispatch-control/components/AppSidebar.tsx`, `lib/nav.ts` — current nav implementation
- `apps/dispatch-control/app/globals.css`, `components.json` — current shadcn variable shim + config
- `apps/dispatch-control/app/(dashboard)/layout.tsx`, `app/(dashboard)/page.tsx`, `app/layout.tsx` — current shell/redirect structure
- `apps/dispatch-control/app/(dashboard)/runs/[runId]/page.tsx`, `runs/[runId]/review/page.tsx`, `runs/_components/ReviewQueue.tsx` — existing review-flow routing precedent
- `apps/dispatch-control/DEPLOY.md` — CHR-05 fix already fully documented
- `apps/dispatch-control/lib/testRunClient.ts`, `pipelineControlClient.ts`, `reviewClient.ts`, `scoreClient.ts` — `NEXT_PUBLIC_PIPELINE_URL` consumers (grepped)
- `apps/dispatch-control/package.json`, `vitest.config.ts`, `middleware.ts`, `next.config.ts` — dependency/test/routing baseline
- `apps/dispatch-control/__tests__/nav.test.ts` — existing coverage gate that will need rewriting
- `convex/schema.ts`, `convex/runs.ts`, `convex/pipelineRuns.ts`, `convex/pipelineConfig.ts`, `convex/qaCorrections.ts`, `convex/claimChecks.ts` — full reads for data-model verification
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` (lines 160-189) — CORS middleware configuration
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` (lines 300-330) — Gate-1 interrupt write path
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — `PIPELINE_COST_CAP_USD` env fallback vs. `per_run_cap_usd`/`monthly_cap_usd` Convex keys
- `apps/dispatch-control/app/(dashboard)/config/_components/BudgetCapsPanel.tsx` — confirms canonical `monthly_cap_usd`/`auto_publish` config keys
- `apps/web/app/layout.tsx` — proven `next/font/google` multi-font pattern to extend
- `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 30 section), `.planning/research/SUMMARY.md`, `.planning/research/STACK.md` — upstream planning inputs

### Secondary (MEDIUM confidence)
- Convex `useQuery({...}, 'skip')` conditional-skip pattern — standard, well-known Convex React client convention, not independently re-verified against the exact installed `convex@^1.38.0` types in this pass (see Open Question 3)

### Tertiary (LOW confidence)
- None — all findings in this document are grounded in direct reads of this repository's code or the committed design bundle, not external web search.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nothing new is added; every technology cited is already installed and verified via `package.json`
- Architecture: HIGH — every data-wiring claim (masthead queries, inbox derivation, CORS fix) is grounded in direct reads of the actual Convex functions and FastAPI middleware config, not assumption
- Pitfalls: HIGH — Pitfall 1 (CSS variable scope) and Pitfall 2 (Gate-1/awaiting-review conflation) were discovered by direct code inspection (grep + file reads), not inferred

**Research date:** 2026-07-06
**Valid until:** No external dependency volatility in this phase (no new npm packages, no external API version drift) — valid until the underlying `apps/dispatch-control` code changes significantly (e.g., if Phase 31+ lands before Phase 30 is planned, re-verify the review-routing precedent in `ReviewQueue.tsx` hasn't moved)
