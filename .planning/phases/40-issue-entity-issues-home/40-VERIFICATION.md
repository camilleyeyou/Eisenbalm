---
phase: 40-issue-entity-issues-home
verified: 2026-07-15T01:38:55Z
status: human_needed
score: 6/6 must-haves verified (automated); 2 sub-items manual-only per project convention
human_verification:
  - test: "ISS-02 live redirect: visit an old run-keyed URL (e.g. /review-desk/{runId}) in a signed-in browser session"
    expected: "Server issues a 307 and lands on /issues/{issueNumber}/review — never a run-keyed loop target"
    why_human: "Next.js redirect() mechanics require a live server + a real Clerk dev-browser cookie (__clerk_db_jwt); curl against the Clerk-protected route returns 404 with x-clerk-auth-reason: dev-browser-missing in this environment, confirmed empirically during 40-09. The underlying resolver function (legacyRedirectTarget) IS unit-tested (issueRouteResolver.test.ts, 9 passing tests) — only the live HTTP redirect mechanics are unverifiable headlessly."
  - test: "ISS-05 greyscale legibility: load the console, apply a greyscale filter, confirm all four Masthead readouts (Issue status / System activity / My Tasks / Cost vs budget) remain distinguishable by label + icon alone"
    expected: "No two readouts become ambiguous once color is removed"
    why_human: "Visual/perceptual judgment — Masthead.test.tsx (14 passing tests) structurally confirms four separate DOM nodes each carrying a label + a lucide-react icon, but cannot assess human perceptual legibility under color removal."
---

# Phase 40: Issue Entity & Issues Home Verification Report

**Phase Goal:** The console stops being run-keyed and becomes issue-keyed — a run is reachable only as a historical record under an issue — and an Issues home answers "what's the state of the operation, and does it need me?" at a glance.
**Verified:** 2026-07-15T01:38:55Z
**Status:** human_needed (all automated checks pass; two items are irreducibly manual per 40-VALIDATION.md's own classification, both already attempted and confirmed manual-only during 40-09)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (the six ISS success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (ISS-01) | Issues home shows the in-progress issue as a card with 5-stage strip, status, open-task count, claim coverage, voice state, estimated work remaining, run cost | ✓ VERIFIED | `IssueCard.tsx` renders `StageStrip` (5-segment) + status readout + `Readout` components for "Open tasks", "Claim coverage", "Voice", "Est. work remaining", "Run cost" — all wired from `page.tsx`'s live query→`derivedState.ts` pipeline. `issues.test.ts` (8), `derivedState.test.ts` (16), `IssueCard.test.tsx` (6) all pass. |
| 2 (ISS-02) | Every console URL for the active issue is issue-keyed; a run is reachable only as a historical record, never a top-level nav destination | ✓ VERIFIED (structural) / ? MANUAL (live redirect) | Route tree confirmed on disk: `/issues`, `/issues/[issueNumber]`, `/issues/[issueNumber]/review`, `/issues/[issueNumber]/voice`, `/issues/[issueNumber]/runs/[runId]` all exist and appear in `next build` output. `/review-desk/[runId]`, `/voice-pass/[runId]`, `/review-desk`, `/voice-pass`, and dashboard index `/` are redirect-only (`redirect(...)`, verified by reading each file). `lib/nav.ts` has no Review Desk/Signal Desk/Voice Pass/Run entries — only "Issues" under Editorial and "Run Monitor" under System Workbench (not the editorial object). `issueRouteResolver.test.ts` (9), `nav.test.ts` (6) pass. Live 307 mechanics are manual-only (see Human Verification). |
| 3 (ISS-03) | Operator sees next scheduled slot with repetition note and can start it early | ✓ VERIFIED | `ScheduledSlotCard.tsx` renders the reserved issueNumber, `scheduledForLabel`, the note (absent, not a stub, when null), and "Start #{n} early" wired to `triggerRun({issueNumber})`. Pipeline `GET /registry/repetition-note` confirmed deterministic (no LLM call — reads `charities:listRecentFeatured` + Sanity `groq_query`, counts cause/geo over-representation). `test_repetition_note.py` (5 passed via `pytest -k repetition`), `ScheduledSlotCard.test.tsx` (4) pass. |
| 4 (ISS-04) | Operator can hold with required reason; held issue shows reason/who/when; can be reopened | ✓ VERIFIED | `convex/issues.ts` `hold` mutation rejects empty/whitespace reason with `throw new Error('A reason is required...')` and writes `audit_log` via `ctx.runMutation(internal.auditLog.write, ...)` inside the mutation (never the client). `HoldDialog.tsx` client-side check is UX-only, deferring authority to the mutation. `HeldIssueRow.tsx` and `/issues/[issueNumber]/page.tsx` both render `heldReason`/`heldBy`/`relativeTime(heldAt)` and a one-click Reopen calling `issues:reopen`. `issues.test.ts` hold/reopen cases + `HoldDialog.test.tsx` (6) pass. |
| 5 (ISS-05) | Global header shows 4 separate never-blended readouts (issue status / system activity / My Tasks / cost vs budget), each label+icon | ✓ VERIFIED (structural) / ? MANUAL (greyscale) | `Masthead.tsx` renders `IssueStatusReadout`, `SystemActivityReadout`, an inline cost-vs-budget `<span>`, and `MyTasksTrigger` as four visibly separate DOM nodes — none share a container; each carries a `lucide-react` icon + text label. `Masthead.test.tsx` (14 tests) pass, including "renders four SEPARATE readouts" and "every readout carries an icon...never color alone" assertions. Perceptual greyscale legibility is manual-only (see Human Verification). |
| 6 (ISS-06) | Failed issue-status load reads "State unknown — refresh", never a stale "ready" | ✓ VERIFIED | `deriveIssueStatus` in `derivedState.ts` returns `'unknown'` for `issue === undefined \|\| signOffs === undefined` and for `issue === null` — structural, not a special-cased branch. `IssueCard.tsx` and `/issues/[issueNumber]/page.tsx` both gate on `status === 'unknown' \|\| kind === 'error'` BEFORE any status/stage rendering path, making a stale value unreachable by construction. Exact copy "State unknown — refresh" confirmed present in both `Masthead.tsx` and `IssueCard.tsx`. `IssueCard.test.tsx` explicitly asserts both the `error` kind and `status="unknown"` cases render this exact text. |

**Score:** 6/6 truths structurally verified by automated tests + direct code inspection; 2 sub-items (live 307 redirect, greyscale perceptual check) are irreducibly manual, consistent with 40-VALIDATION.md's own pre-declared manual-only classification (not a gap introduced by incomplete work).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` `issues` table | operational fields only, no denormalized status/stage | ✓ VERIFIED | `workspace_id, issueNumber, scheduledFor?, held, heldReason?, heldBy?, heldAt?, published, publishedAt?, sanityIssueId?, lastVisitedStage?, createdAt` + `by_workspace`/`by_workspace_issueNumber` indexes. No `status`/`stage` field present — confirms derivation is computed, never stored. |
| `convex/issues.ts` | byIssueNumber, listForWorkspace, ensureByNumber, hold, reopen, markPublished | ✓ VERIFIED | All six exported; 220 lines. `hold`/`reopen` write `audit_log` inside the mutation via `internal.auditLog.write`; `hold` throws on empty/whitespace reason; `ensureByNumber` is a strict no-op on an existing row (never resurrects Held). |
| `convex/pipelineRuns.ts` +2 queries | byIssueNumber, listByIssueNumber over `by_issueNumber` index | ✓ VERIFIED | Both present, both use the `by_issueNumber` index. |
| `packages/pipeline/.../api/registry.py` repetition-note | deterministic, no LLM, no run required | ✓ VERIFIED | `GET /registry/repetition-note` reads `charities:listRecentFeatured` + Sanity `groq_query`, counts cause/geo occurrence, no LLM/agent call anywhere in the function. `test_repetition_note.py` 5/5 pass. |
| `packages/pipeline/.../api/runs.py` ensureByNumber call | defensive ensure at run start | ✓ VERIFIED | `_start_run` calls `issues:ensureByNumber` before `pipelineRuns:create`, per the documented CFG-04 ordering. |
| `packages/pipeline/scripts/backfill_issues.py` | one-shot backfill | ✓ VERIFIED + RUN | 248 lines. Confirmed executed against the LIVE deployment: `npx convex run issues:listForWorkspace` independently returns exactly 4 rows (999603-999606), #999603 `published: true`/`sanityIssueId: "issue-999603"` — matches SUMMARY's claimed backfill result verbatim. |
| `apps/dispatch-control/lib/derivedState.ts` | pure selectors, no Convex import | ✓ VERIFIED | 278 lines. Exports `deriveIssueStatus`, `deriveStageStates`, `deriveTasks`, `estimateWorkMinutes`, `SEVERITY_MINUTES`. No `convex/react` import — only imports `galley/findingState`, `galley/axisPartition`, `issueRouteResolver` (all pure). |
| `apps/dispatch-control/lib/issueRouteResolver.ts` | pure route resolver | ✓ VERIFIED | 56 lines, no Convex import. Exports `parseIssueNumber`, `issueHref`, `issueReviewHref`, `issueVoiceHref`, `issueRunHref`, `legacyRedirectTarget`. |
| `apps/dispatch-control/lib/repetitionNoteClient.ts` | fetch-only client | ✓ VERIFIED | 89 lines, no Convex import — plain `fetch()` client. |
| `.../issues/page.tsx` | Issues home orchestration | ✓ VERIFIED | 301 lines (min 60 required). Full query→derivation→render pipeline; lazy next-slot `ensureByNumber`; loading/empty/error states; held rows; recently-published rows with real verification records (not blank slots). |
| `.../issues/_components/IssueCard.tsx`, `ScheduledSlotCard.tsx` | per plan 40-05 | ✓ VERIFIED | Both match spec exactly (see truths table). |
| `.../issues/[issueNumber]/review\|voice\|runs/[runId]/page.tsx` | issue-keyed wrappers | ✓ VERIFIED | All three exist; `review/page.tsx` renders the co-located `ReviewDeskRunView`; confirmed in `next build` route list. |
| Legacy redirect pages (`review-desk/page.tsx`, `review-desk/[runId]/page.tsx`, `voice-pass/page.tsx`, `voice-pass/[runId]/page.tsx`, dashboard `page.tsx`) | redirect-only | ✓ VERIFIED | All five contain only a `redirect(...)` call (two dynamic runId→issueNumber lookups via `legacyRedirectTarget`, three static `/issues` redirects). |
| `apps/dispatch-control/components/Masthead.tsx` | four separate label+icon readouts | ✓ VERIFIED | Rebuilt; four distinct rendered nodes, none sharing a container; `Masthead.test.tsx` 14/14 pass. |
| `apps/dispatch-control/lib/nav.ts` | Editorial / System Workbench / Operations restructure | ✓ VERIFIED | Exactly this structure; Review Desk/Signal Desk/Voice Pass absent from nav; Run Monitor present only under System Workbench. |
| `docs/API_CONTRACTS.md` §40 | contract-first binding spec | ✓ VERIFIED | `## §40 — Issue Entity & Issues Home (Phase 40)` present at line 3960, predates the implementation commits per the phase's Wave-0 convention. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `convex/issues.ts hold` | `convex/auditLog.ts write` | `ctx.runMutation(internal.auditLog.write, ...)` | ✓ WIRED | Confirmed inline in `hold` and `reopen` handlers. |
| `convex/issues.ts ensureByNumber` | `convex/schema.ts by_workspace_issueNumber` | query-then-insert idempotent guard | ✓ WIRED | Confirmed — strict no-op on existing row. |
| `apps/dispatch-control/lib/derivedState.ts` | `lib/galley/findingState.ts` | `isOpenFinding` | ✓ WIRED | Imported and used in `countOpen`/stage derivations. |
| `apps/dispatch-control/lib/derivedState.ts deriveTasks` | `lib/issueRouteResolver.ts` | `issueReviewHref`/`issueVoiceHref` | ✓ WIRED | Confirmed via import line. |
| `.../issues/page.tsx` | `lib/derivedState.ts` | `deriveIssueStatus`/`deriveStageStates`/`deriveTasks`/`estimateWorkMinutes` | ✓ WIRED | All four called over live query results. |
| `.../issues/_components/ScheduledSlotCard.tsx` | `lib/pipelineControlClient.ts` | `triggerRun({issueNumber})` | ✓ WIRED | Confirmed in `handleStartEarly`. |
| `.../issues/[issueNumber]/review/page.tsx` | `convex pipelineRuns:byIssueNumber` | server-side resolve before render | ✓ WIRED | Confirmed present in route wrapper (also present in build output). |
| `.../review-desk/[runId]/page.tsx` | `legacyRedirectTarget` | runId→issueNumber lookup then redirect() | ✓ WIRED | Confirmed — reads `pipelineRuns.byRunId`, then calls `legacyRedirectTarget('review', ...)`. |
| `.../issues/[issueNumber]/page.tsx` | `convex issues:hold`/`issues:reopen` | `useMutation` on confirm; reason required; audit written server-side | ✓ WIRED | Confirmed. |
| HoldDialog checkbox | `convex runs:requestCancel` | separate call via `cancelRun()`/`pipelineControlClient.ts` | ✓ WIRED (documented deviation) | `runs:requestCancel` is single-lane pipeline-secret-guarded; the page correctly uses the existing Clerk-JWT `cancelRun()` HTTP path instead of a direct client mutation call — documented in file header and `deferred-items.md`. This is the correct, secure pattern (matches Phase 25 precedent), not a gap. |
| `components/Masthead.tsx` | `lib/derivedState.ts` | `deriveIssueStatus` + `deriveTasks(...).length` | ✓ WIRED | Confirmed. |
| `components/Masthead.tsx` My Tasks readout | `components/AwaitingYouInbox.tsx` | click opens existing dropdown | ✓ WIRED | Confirmed — `MyTasksTrigger` onClick toggles `inboxOpen`, `AwaitingYouInbox` receives `open`/`onClose`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `IssueCard` (via `issues/page.tsx`) | `inProgressIssue`, `stages`, `tasks`, `claimSummary`, `runCostRow` | live `useQuery(api.issues.listForWorkspace)` + `api.pipelineRuns.byIssueNumber` + `api.claimChecks.*` + `api.runs.byRunId`, all against `dev:modest-magpie-797` | Yes — independently confirmed via `npx convex run issues:listForWorkspace` returning 4 real rows (999603 published, 999604-999606 in-progress/scheduled) | ✓ FLOWING |
| `ScheduledSlotCard` note | `repetitionNote` | `fetchRepetitionNote()` → `GET /registry/repetition-note` → `charities:listRecentFeatured` (Convex) + Sanity `groq_query` | Yes — real Convex/Sanity join, no static fallback in the happy path (fetch failure yields `null`, rendered as an absent row, not a fake "avoid —" stub) | ✓ FLOWING |
| `Masthead` four readouts | `issueStatus`, `systemActivity`, `taskCount`, `mtd`/`cap` | `deriveIssueStatus`/`deriveTasks` over live `api.runs.latest`, `api.issues.byIssueNumber`, `api.signOffs.activeByRunId`, etc.; `api.runs.monthToDateCost` unchanged wiring | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 40 dashboard test files (8 files) | `pnpm --filter dispatch-control test -- __tests__/{issues,derivedState,issueRouteResolver,IssueCard,ScheduledSlotCard,HoldDialog,Masthead,nav}*` | 8 files / 69 tests — all pass | ✓ PASS |
| Full dashboard suite (regression) | `pnpm --filter dispatch-control test` | 72 files passed + 1 skipped (73 total), 573 tests passed + 2 todo — matches SUMMARY's claimed count exactly | ✓ PASS |
| Strict type-check build | `pnpm --filter dispatch-control build` | `next build` exits 0; all 26 routes generated including full `/issues` tree | ✓ PASS |
| Pipeline repetition-note test | `cd packages/pipeline && uv run pytest -k repetition -q` | 5 passed | ✓ PASS |
| Full pipeline suite (regression) | `cd packages/pipeline && uv run pytest -q` | 531 passed, 36 skipped — matches SUMMARY's claimed count exactly | ✓ PASS |
| Convex live deploy verification | `npx convex run issues:listForWorkspace '{"workspace_id":"eisenbalm"}'` (via `pnpm --filter @eisenbalm/convex exec`) | Returns 4 real rows from `dev:modest-magpie-797` — proves genuine deploy, not just a commit | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| ISS-01 | 40-01, 40-02, 40-03, 40-04, 40-05, 40-09 | Issues home in-progress card with 5-stage strip + 6 readouts | ✓ SATISFIED | `IssueCard.tsx` + `derivedState.ts` + `issues.ts`; all named tests pass. |
| ISS-02 | 40-01, 40-02, 40-04, 40-06, 40-07, 40-08, 40-09 | Console routes issue-keyed; run reachable only as historical record | ✓ SATISFIED (automated) / ? human sign-off pending for live 307 | Route tree + redirects + nav confirmed on disk; `issueRouteResolver.test.ts`/`nav.test.ts` pass. Live redirect mechanics manual-only. |
| ISS-03 | 40-01, 40-03, 40-04, 40-05, 40-09 | Next scheduled slot + repetition note + start early | ✓ SATISFIED | `ScheduledSlotCard.tsx` + `registry.py` endpoint; tests pass. |
| ISS-04 | 40-01, 40-02, 40-07, 40-09 | Hold with required reason; reopen | ✓ SATISFIED | `issues.ts` hold/reopen + audit_log write; `HoldDialog.tsx`; `/issues/[issueNumber]/page.tsx`; tests pass. |
| ISS-05 | 40-01, 40-08, 40-09 | Header 4 separate never-blended readouts, label+icon | ✓ SATISFIED (automated) / ? human sign-off pending for greyscale | `Masthead.tsx`; `Masthead.test.tsx` 14/14 pass. Perceptual check manual-only. |
| ISS-06 | 40-01, 40-04, 40-05, 40-09 | Failed load reads "State unknown — refresh" | ✓ SATISFIED | Structural in `deriveIssueStatus`; exact copy in `IssueCard.tsx`/`Masthead.tsx`; tests pass. |

No orphaned requirements — REQUIREMENTS.md lines 345-350 list exactly ISS-01..ISS-06 for Phase 40, and all six appear in the `requirements:` frontmatter of one or more of the nine plans (cross-checked against every plan's frontmatter). All six are marked `[x]` in REQUIREMENTS.md and `Complete` in its coverage table (lines 800-805).

### Anti-Patterns Found

None found in the Phase-40-authored files. No `TODO`/`FIXME`/`PLACEHOLDER`/"not yet implemented" strings, no empty stub handlers (`onClick={() => {}}`), no hardcoded-empty props feeding rendered output, no static `return Response.json([])` in the new endpoint. The `deferred-items.md` file documents pre-existing `tsc --noEmit` errors in unrelated test files (`spanResolver.test.ts`, `syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `VoicePassScreen.test.tsx`, `WriterExpansion.test.tsx`) — confirmed via the executor's own before/after A-B diffs that these predate Phase 40 and are not introduced by it. This verifier independently confirms `pnpm --filter dispatch-control build` (Next's own stricter, app-scoped type-check) exits 0, which is the actual mandatory gate — `tsc --noEmit` includes `__tests__/` files that `next build` does not, so these are correctly out of scope for this phase's pass/fail.

### Scope-Boundary Sanity Check

No downstream-phase artifacts leaked into Phase 40: no stage-tab Workspace frame (`grep` for `StageTabs`/`WorkspaceFrame` under `app/(dashboard)/issues/` returns nothing), no Fact Check claim table/filter component, no My Tasks projection screen (`find -iname "*my-tasks*"` returns nothing). Their absence is correct per the phase boundary.

### Human Verification Required

### 1. ISS-02: Live redirect 307 confirmation

**Test:** Sign in to the dashboard in a real browser, visit an old run-keyed URL for one of the four real runs backfilled in this phase (`6ba26a029f3345b5963565c62ad5ab98`, `03d1f3fba2974315b04c90dd7f0c07bc`, `d9c09fa783634313944337be37fde482`, `42d0d6b2a65049d4b51f73f3fa75f209`) at `/review-desk/{runId}`.
**Expected:** Browser lands on `/issues/{issueNumber}/review` — no redirect loop, no run-keyed URL surviving the hop.
**Why human:** Next.js `redirect()` issues a 307 that requires a live server and a signed-in Clerk session (`__clerk_db_jwt` dev-browser cookie) that only a real browser sets. `curl` against the route returns 404 with `x-clerk-auth-reason: dev-browser-missing` in this environment — confirmed empirically, not a bug. The resolver function it depends on (`legacyRedirectTarget`) is unit-tested and passing.

### 2. ISS-05: Greyscale legibility of the four Masthead readouts

**Test:** Load the console, apply a greyscale filter (OS-level or browser devtools), confirm Issue status / System activity / My Tasks / Cost vs budget remain distinguishable from one another.
**Expected:** No two readouts become ambiguous or indistinguishable once color is removed — each carries a distinct label + a distinct lucide-react icon shape.
**Why human:** Perceptual/visual judgment. `Masthead.test.tsx` structurally confirms four separate DOM nodes each with a label and an icon element, but cannot assess human-perceived legibility.

### Gaps Summary

No gaps. All six ISS success criteria are structurally implemented, wired to live data, and covered by passing automated tests (independently re-run by this verifier, not merely trusted from the SUMMARY). The Convex deployment was independently confirmed live (not just committed) by directly querying `dev:modest-magpie-797` and getting back the exact 4-row backfilled dataset the SUMMARY describes. The full dashboard vitest suite (573 tests), the full pipeline pytest suite (531 tests), and the strict `next build` were all independently re-run by this verifier and match the SUMMARY's claimed pass counts exactly. The only outstanding items are the two manual-only checks (live 307 redirect, greyscale legibility) that 40-VALIDATION.md pre-declared as irreducibly manual before any code was written — these are not gaps in the implementation, they are checks that structurally cannot be automated in this environment, and the phase's own artifacts (unit-tested resolver, unit-tested Masthead structure) are the correct proxy proof available short of a human browser session.

---

*Verified: 2026-07-15T01:38:55Z*
*Verifier: Claude (gsd-verifier)*
