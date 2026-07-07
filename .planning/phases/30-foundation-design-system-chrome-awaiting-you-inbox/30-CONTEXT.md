# Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Restyle the entire `apps/dispatch-control` console to the committed 1c design system (ink `#17140e`, cobalt `#253ad4`, vermilion `#e8471d`, marigold `#f2b01e`, green `#148a52`; Newsreader/Lora/Space Grotesk/IBM Plex Mono via `next/font`; hard-edged anti-SaaS surfaces), rebuild the chrome — persistent black masthead (issue #, pipeline-state chip, MTD spend vs cap, auto-publish lock chip) + workflow-ordered left nav + "How to use" screen — build the cross-screen Awaiting-you inbox as a masthead dropdown, and fix `NEXT_PUBLIC_PIPELINE_URL` so the deployed dashboard's test-run panel reaches the pipeline API in production.

**Explicitly NOT in scope:** the interiors of Review Desk (Phase 32–33), Signal Desk (Phase 37 track), Voice Pass (36), Eval Center (38), Run Monitor v2 (37), Registry upgrades (39), any content-mutation endpoints (31). This phase is skin + chrome + inbox + one ops fix.

</domain>

<decisions>
## Implementation Decisions

### Nav & routes
- **D-01:** Left nav follows the dc.html spec — two groups (*Workflow:* Review Desk · Signal Desk · Run Monitor · Voice Pass; *Craft & memory:* Prompt Lab · Eval Center · Registry) with "How to use" pinned at bottom — **plus a third quiet group ("Operations": Config · Finance · Settings)** styled to match. Small deliberate deviation from the spec so no working screen becomes unreachable.
- **D-02:** Not-yet-built screens (Review Desk, Signal Desk, Voice Pass, Eval Center) render **1c-styled, phase-labeled placeholder pages** ("coming in Phase X") — same honest-placeholder pattern Phase 21 used.
- **D-03:** **Final route structure lands now**: `/review-desk`, `/signal-desk`, `/run-monitor`, `/voice-pass`, `/prompt-lab`, `/eval-center`, `/registry`, `/how-to-use` (+ Operations routes), with **redirects from the old paths** (`/graph`, `/runs`, `/prompts`, …). Phases 31–39 build straight into their final homes.
- **D-04:** **Home = Review Desk** — `/` redirects to `/review-desk` even while it's a placeholder; masthead + inbox carry the real signal until Phase 32. (Supersedes Phase 21 D-09, which made Graph home.)
- **D-05:** `/run-monitor` hosts the **existing Runs list and Graph visualizer as two tabs/sub-routes** under one nav item. Nothing lost, one nav slot; Phase 37 replaces the interior.

### Restyle depth
- **D-06:** **Token swap + chrome rebuild.** The masthead and left nav are rebuilt to dc.html fidelity (52px ink masthead, vermilion `/` in the wordmark, 210px `#e3e5e8` nav, active item = ink bg + 3px vermilion left border). Existing screens keep their current layouts but get the 1c skin via the global CSS-variable/font swap (shadcn vars remapped in `globals.css`, Tailwind v4 `@theme`, hard edges). Per-screen re-layout belongs to each screen's owning phase.
- **D-07:** Config, Finance, Settings (no owning rebuild phase) get **token swap only** in this phase. If their layouts look off in the new skin, note as follow-ups — do not re-lay-out here.

### Awaiting-you inbox
- **D-08:** "Unresolved blocker" = **unaccepted error-severity `qaCorrections` + open claim-check sign-offs** on the current draft — i.e., exactly what blocks Publish today.
- **D-09:** **Pure derivation lifecycle** — an item exists iff the underlying state is unresolved; resolving the thing removes the item. No dismiss/snooze, no new Convex tables (honors the locked "pure read-aggregation, no new backend" research decision).
- **D-10:** **Scope window: active runs only.** Awaiting-review and interrupted runs always show (live states); failed runs surface only from the current issue cycle / most recent run — older failures live in Run Monitor history, not the inbox.
- **D-11:** **Items route to wherever the action can be taken today** (e.g. awaiting-review run → existing run review page), re-pointed to Review Desk / Signal Desk when those phases land. The inbox is never a dead end into a placeholder.

### Spec ingestion & How-to-use
- **D-12:** **Commit the full design handoff bundle into the repo** at `docs/design/dispatch-control-v2/` (all 7 files, ~190KB: `Dispatch Control.dc.html`, `DECISIONS.md`, `Dispatch Control - Audit.dc.html`, `Dispatch Control - Review Desk Directions.dc.html`, `README.md`, design brief, wireframe). Source location today: `~/Downloads/design_handoff_dispatch_control/`. **Planner: make this an early task** — every downstream phase (30–39) depends on these being readable in-repo.
- **D-13:** **Claude drafts the How-to-use content** from the handoff README (the 4 priorities, weekly loop), DECISIONS.md house rules (two sign-offs, nothing-silent logging, pause/notify/resume), and the 1c color legend. Andrew reviews/edits the copy at UAT.

### Ops fix (CHR-05)
- **D-14:** `NEXT_PUBLIC_PIPELINE_URL` must be set in the deployed dashboard's Vercel project and verified live (test-run panel calls the Railway pipeline API from production). This requires a **human checkpoint** (Andrew sets the Vercel env var / confirms the Railway domain). Planner should also have the researcher check CORS on the FastAPI side — a browser call from the dashboard's production origin must be allowed.

### Claude's Discretion
- Font role mapping (which of the 4 fonts styles UI vs data vs content) — follow what `Dispatch Control.dc.html` does; Space Grotesk for wordmark/UI chrome and IBM Plex Mono for data readouts per the spec.
- Exact chip styling, inbox dropdown internals (360px, white, 3px vermilion top border per spec), empty state copy.
- Spend-cap source: `pipeline_config` `cost_cap_usd` vs `PIPELINE_COST_CAP_USD` env — use whichever the existing finance/config code treats as canonical.
- Redirect implementation (next.config redirects vs route-level), Operations group label, `/run-monitor` tab mechanics.
- Preserving the Phase 24 CodeMirror `.cm-prompt-editor` variable-highlight styles through the globals.css retheme (they must keep working).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Binding design spec (D-12 commits these to `docs/design/dispatch-control-v2/`; until then they are at `~/Downloads/design_handoff_dispatch_control/`)
- `Dispatch Control.dc.html` — THE committed 1c visual spec: masthead (52px, bg `#17140e`, wordmark `DISPATCH/CONTROL` with vermilion `/`), Awaiting-you chip + dropdown (360px, vermilion top border), left nav (210px, `#e3e5e8`, two groups + How-to-use pinned, active = ink bg + vermilion left border), all tokens/type/spacing. Recreate closely.
- `DECISIONS.md` — binding editor decisions (two sign-offs, forensic Run Monitor, provenance-per-claim, pause/notify/resume, EIC seat, cost metering "ambient warning at cap, not hard stop").
- `Dispatch Control - Audit.dc.html` — design rationale (v1 gaps, risks R1–R6). README says "read this first."
- `README.md` — screen-by-screen spec incl. the Global chrome section (masthead/inbox/nav measurements quoted above) and the 4 console priorities (source material for How-to-use, D-13).

### v3.0 research
- `.planning/research/SUMMARY.md` — Phase-30-relevant: `next/font/google` → Tailwind v4 `@theme`; inbox = pure read-aggregation over existing `awaiting-review`/`awaitingHumanAt`/interrupt/failed state, no new backend.
- `.planning/research/STACK.md`, `.planning/research/PITFALLS.md` — stack additions and failure modes for the milestone.

### Project/milestone framing
- `.planning/PROJECT.md` §Current Milestone — locked decisions incl. design fidelity and the reconciliation facts (18-node pipeline, `NEXT_PUBLIC_PIPELINE_URL` known-dead in prod).
- `.planning/ROADMAP.md` §Phase 30 — goal + 5 success criteria.
- `.planning/phases/21-auth-app-shell-convex-schema/21-CONTEXT.md` — the shell decisions this phase extends/supersedes (D-08 sidebar, D-09 Graph-home superseded by D-04 here).

### Existing code (chrome + data sources)
- `apps/dispatch-control/components/AppSidebar.tsx`, `apps/dispatch-control/lib/nav.ts` — current nav to be replaced.
- `apps/dispatch-control/app/globals.css` — shadcn CSS-var shim to remap to 1c; contains Phase 24 `.cm-prompt-editor` styles that must survive.
- `apps/dispatch-control/app/(dashboard)/layout.tsx` — where the masthead mounts.
- `convex/runs.ts` — `monthToDateCost` (spend chip), `latest` (issue #/state chip), status fields.
- `convex/pipelineConfig.ts` — `getAll` / `setAutoPublish` (lock chip).
- `convex/qaCorrections.ts`, `convex/claimChecks.ts` — blocker derivation (D-08).
- `apps/dispatch-control/lib/testRunClient.ts`, `lib/pipelineControlClient.ts`, `lib/reviewClient.ts`, `lib/scoreClient.ts` — all read `NEXT_PUBLIC_PIPELINE_URL` (CHR-05).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Working app shell** — `apps/dispatch-control` (Next 15 / React 19 / Tailwind v4 / shadcn / Clerk) with 8 live route groups: graph, runs, config, finance, prompts, registry, settings + review flows. This phase re-skins and re-chromes it; it does not rebuild screens.
- **Masthead data queries already exist** — `runs.monthToDateCost`, `runs.latest`, `pipelineConfig.getAll`/`setAutoPublish`; inbox sources (`awaiting-review` status, `awaitingHumanAt`, failed status, `qaCorrections.accepted`, claim-check sign-off state) are all queryable today.
- **Clerk `<UserButton />`** already in the sidebar footer — keep a sign-out affordance in the new chrome.

### Established Patterns
- shadcn CSS-variable theming in `globals.css` — the 1c retheme is a variable remap plus `@theme` font wiring, not a component rewrite.
- `NAV_ITEMS` config-array pattern in `lib/nav.ts` — extend to grouped nav (Workflow / Craft & memory / Operations) rather than hardcoding in the sidebar.
- Phase 21 placeholder-page pattern for unbuilt routes.
- `next/font` already used in `apps/web` (Phase 19 loaded Newsreader + IBM Plex Mono there) — same mechanism here.

### Integration Points
- `app/(dashboard)/layout.tsx` — masthead + restructured sidebar mount here; every route inherits.
- `next.config.ts` — redirects from old route paths (D-03).
- Vercel project env (`NEXT_PUBLIC_PIPELINE_URL`) + Railway FastAPI CORS — the CHR-05 production fix (human checkpoint for the env var).
- Convex live queries (`useQuery`) power all masthead chips + inbox — real-time by default, no polling needed.

</code_context>

<specifics>
## Specific Ideas

- The masthead per spec: wordmark `DISPATCH/CONTROL` in Space Grotesk 700 with the `/` in vermilion; pipeline-state chip in marigold bg/ink text for `Awaiting review`; spend rendered like `$12.40 / $200`; `Auto-publish OFF` lock chip; Awaiting-you chip in vermilion, clickable, opens the 360px dropdown.
- "Hard-edged anti-SaaS" — the dc.html look has no soft rounded-card SaaS styling; expect `--radius` at/near 0 and flat surfaces.
- The inbox answers one question: "what needs me right now" — cross-issue, cross-screen, blockers first.

</specifics>

<deferred>
## Deferred Ideas

- **Layout follow-ups for Config/Finance/Settings** if the token swap makes their current layouts read poorly (D-07 says note, don't fix here).
- **Graph visualizer retirement or merge** — deferred to Phase 37 (Run Monitor v2) which replaces the `/run-monitor` interior.
- **Re-pointing inbox routes** to Review Desk / Signal Desk — happens in Phases 32/37 when those screens become real (D-11).
- **EIC assignable seat, notifications for "stuck" states** — later phases per DECISIONS.md; the inbox here is display-only aggregation.

</deferred>

---

*Phase: 30-foundation-design-system-chrome-awaiting-you-inbox*
*Context gathered: 2026-07-06*
