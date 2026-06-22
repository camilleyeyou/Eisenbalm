---
phase: 24-prompt-editor-versioning
plan: 08
subsystem: ui
tags: [react, nextjs, convex, clerk, diff, codemirror, prompt-versioning, fastapi-client]

# Dependency graph
requires:
  - phase: 24-02
    provides: promptVersions.activate / listForAgent / getByVersion Convex functions (activate returns { blocked, reason })
  - phase: 24-06
    provides: POST /agents/{key}/test-run pipeline endpoint contract (API_CONTRACTS §3A)
  - phase: 24-07
    provides: PromptEditor + AgentPromptEditorView + VersionHistoryPanel mount points; the test-scaffold alias fix pattern
provides:
  - Side-by-side two-column DiffViewer (diff v9 + custom renderer) with A/B version-compare selector
  - One-click activate / "Rollback to this version" controls guarded by in-progress runs (D-02) with defensive server-block surface
  - TestRunPanel test-running the unsaved draft (D-03) across four input modes (D-04) showing output + cost
  - testRunClient.runAgentTest (Clerk-bearer POST to /agents/{key}/test-run)
affects: [phase-24-verifier, future-prompt-console-work, pipeline-test-run-endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-column diff: diffLines → parallel left/right arrays with data-side attribute + per-line tint"
    - "Client→pipeline fetch with Clerk getToken() bearer + NEXT_PUBLIC_PIPELINE_URL base"
    - "In-progress-run guard reused from api.runs.latest.status==='running' (mirrors the Convex activate guard)"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/prompts/_components/DiffViewer.tsx
    - apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx
    - apps/dispatch-control/lib/testRunClient.ts
  modified:
    - apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx
    - apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx
    - apps/dispatch-control/app/(dashboard)/prompts/[agentKey]/page.tsx
    - apps/dispatch-control/__tests__/DiffViewer.test.tsx
    - apps/dispatch-control/.env.example

key-decisions:
  - "Introduced NEXT_PUBLIC_PIPELINE_URL (no pipeline base-URL env existed) and documented it in .env.example"
  - "Mounted TestRunPanel inside AgentPromptEditorView (owner of the live draft state) rather than the server page.tsx; page.tsx documents the wiring"
  - "Rollback IS activate(olderVersion) — single mutation, label switches to 'Rollback to this version' for versions below the active one"

patterns-established:
  - "DiffViewer two-column renderer: drop trailing empty line from diffLines EOF-newline split before column mapping"
  - "Test-run modes: fixture (empty vars + no prior_run_id → server SAMPLE_FIXTURES), manual (VARIABLE_REGISTRY form), prior-real (prior_run_id), unsaved-draft (always sent)"

requirements-completed: [PRM-04, PRM-05]

# Metrics
duration: 8min
completed: 2026-06-22
---

# Phase 24 Plan 08: Diff / Rollback / Test-Run UI Summary

**Side-by-side `diffLines` DiffViewer + A/B compare, one-click activate/rollback guarded mid-run, and a four-mode TestRunPanel that POSTs the unsaved editor draft to the pipeline test-run endpoint for output + cost — completing the PRM-04/PRM-05 prompt console.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-22T22:03:32Z
- **Completed:** 2026-06-22T22:12:00Z
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- **DiffViewer** (`diff` v9 `diffLines` + custom two-column renderer): removed-left / added-right / context-both, each column carrying `data-side`, red/green/neutral per-line tint. Turned the Wave-0 RED `DiffViewer.test.tsx` GREEN.
- **VersionHistoryPanel** gained an A/B compare selector (default A = active, B = newest other) rendering the DiffViewer for any pair, plus per-version **Activate / "Rollback to this version"** controls wired to `promptVersions.activate`, disabled while a run is in progress (`api.runs.latest.status === 'running'`) with an inline "A run is in progress…" explanation, and a defensive inline surface of any server-side `{ blocked, reason }` (TOCTOU race, Pitfall 2).
- **TestRunPanel** + **testRunClient**: tests the CURRENT unsaved draft (D-03) across four input modes (D-04 — canned fixture / manual `VARIABLE_REGISTRY` entry / prior-real `prior_run_id` / implicit unsaved draft), POSTing to `/agents/{key}/test-run` with a Clerk bearer token and rendering output + cost (cost_usd / model / tokens_in/out / duration_ms) in the AgentIOPanel style. It does NOT run the pipeline.

## Task Commits

Each task was committed atomically, immediately after verification (per the resilience directive):

1. **Task 1: Side-by-side DiffViewer + version-compare wiring** - `74f3f56` (feat)
2. **Task 2: Activate / rollback controls with in-progress-run guard** - `2de2e0d` (feat)
3. **Task 3: TestRunPanel — four input modes against unsaved draft, output + cost** - `d569930` (feat)

**Plan metadata:** (final docs commit — see below)

## Files Created/Modified

- `app/(dashboard)/prompts/_components/DiffViewer.tsx` — two-column `diffLines` diff renderer (`data-side`, grid-cols-2).
- `app/(dashboard)/prompts/_components/TestRunPanel.tsx` — four-mode test-run UI + output/cost display.
- `lib/testRunClient.ts` — `runAgentTest(agentKey, body, token)` Clerk-bearer POST to the pipeline test-run endpoint.
- `app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx` — A/B compare selector + DiffViewer + guarded activate/rollback controls.
- `app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx` — mounts TestRunPanel wired to the live editor draft.
- `app/(dashboard)/prompts/[agentKey]/page.tsx` — doc note on the test-run wiring + pipeline-URL env.
- `__tests__/DiffViewer.test.tsx` — scaffold JSX fix (alias the require-guarded component; `<DiffViewer! .../>` → `const Diff = DiffViewer!`).
- `.env.example` — documented `NEXT_PUBLIC_PIPELINE_URL`.

## Decisions Made

- **`NEXT_PUBLIC_PIPELINE_URL`**: no pipeline base-URL env existed in dispatch-control; introduced it (the name the plan/interfaces anticipated) and documented it in `.env.example`. The client throws a clear error if unset.
- **TestRunPanel mount point**: mounted inside `AgentPromptEditorView` (which owns the controlled `draft` state) so the unsaved buffer is what gets tested; `page.tsx` (a server component, listed in files_modified) carries a documentation note rather than the live state.
- **Rollback == activate**: rollback reuses `promptVersions.activate(olderVersion)` — no separate mutation; the button label switches to "Rollback to this version" for versions below the active one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scaffold JSX in DiffViewer.test.tsx never compiled**
- **Found during:** Task 1 (DiffViewer)
- **Issue:** The Wave-0 RED scaffold used `<DiffViewer! .../>` — a non-null assertion in JSX tag position, which esbuild rejects ("Expected > but found !"); the test could not even collect.
- **Fix:** Aliased the require-guarded component to `const Diff = DiffViewer!` and rendered `<Diff .../>` in both `it` blocks — the exact behavior-preserving fix 24-07 applied to PromptEditor.test.tsx. Assertions unchanged.
- **Files modified:** `__tests__/DiffViewer.test.tsx`
- **Verification:** `vitest run __tests__/DiffViewer.test.tsx` → 2 passed.
- **Committed in:** `74f3f56`

**2. [Rule 1 - Bug] activate `{ blocked, reason }` return widened `reason` to `string | undefined`**
- **Found during:** Task 2 (activate/rollback)
- **Issue:** `setBlockedReason(result.reason)` failed tsc — the Convex-inferred return type does not narrow `reason` to `string` on the `blocked` branch.
- **Fix:** Coalesced to the canonical in-progress message when `reason` is absent.
- **Files modified:** `VersionHistoryPanel.tsx`
- **Verification:** changed files produce zero tsc errors.
- **Committed in:** `2de2e0d`

---

**Total deviations:** 2 auto-fixed (1 blocking scaffold fix, 1 type bug).
**Impact on plan:** Both necessary for the plan's own verification bar. No scope creep.

## Issues Encountered

- **Project-wide `tsc --noEmit` is not clean (53 pre-existing errors).** Confirmed identical count at HEAD~3 (before any 24-08 commit) — they live in `__tests__/*` (possibly-undefined access + untyped `import.meta.glob`) and in Phase-24 Plan-01/07 `variableHighlightExtension.ts` / `VariableRegistry.ts`. Out of scope per the SCOPE BOUNDARY rule; logged to `deferred-items.md`. All five 24-08 files are tsc-clean and the plan's bar ("tsc clean for the changed files" + "full vitest suite green") is met.
- **PromptEditor.test.tsx emits a benign jsdom/CodeMirror `getClientRects` stderr** — the test still passes; predates this plan.

## Verification

- `DiffViewer.test.tsx` — **GREEN** (2 passed).
- Changed-file `tsc --noEmit` — **clean** (0 errors across all 5 source files).
- Full `npx vitest run` in apps/dispatch-control — **16 passed | 1 skipped (17 files); 73 tests passed | 2 todo**. No regressions (DiffViewer was the only RED; now green).
- Acceptance greps — all pass (diffLines / grid-cols-2 / data-side; promptVersions.activate / "in progress" / blocked; /agents/ / Bearer / test-run / prior_run_id / VARIABLE_REGISTRY / draft_prompt / cost_usd).

## User Setup Required

**External configuration needed before the test-run UI works end-to-end:**
- Set `NEXT_PUBLIC_PIPELINE_URL` in `apps/dispatch-control/.env.local` to the deployed pipeline base URL (FastAPI on Railway). The `POST /agents/{key}/test-run` endpoint (Plan 24-06) must be live and reachable.

## Next Phase Readiness

- PRM-04 and PRM-05 UI complete — the prompt console can diff/activate/rollback versions (guarded mid-run) and test-run the unsaved draft for output + cost without running the pipeline. This is the final plan of Phase 24.
- Phase-24 verifier should note the seeded `prompt_versions` table is still empty (deferred seeding 401) — the compare/activate UI renders an empty-state until versions exist; automated tests do not depend on seeded data.

---
*Phase: 24-prompt-editor-versioning*
*Completed: 2026-06-22*

## Self-Check: PASSED

- Created files verified on disk: DiffViewer.tsx, TestRunPanel.tsx, testRunClient.ts, 24-08-diff-rollback-testrun-ui-SUMMARY.md — all FOUND.
- Task commits verified in git log: `74f3f56`, `2de2e0d`, `d569930` — all FOUND.
