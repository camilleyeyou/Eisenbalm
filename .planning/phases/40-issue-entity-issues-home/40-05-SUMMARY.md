---
phase: 40-issue-entity-issues-home
plan: 05
subsystem: ui
tags: [react, nextjs, convex, dispatch-control, derived-state, vitest]

# Dependency graph
requires:
  - phase: 40-02
    provides: "convex/issues.ts (byIssueNumber, listForWorkspace, ensureByNumber, hold, reopen) + convex/pipelineRuns.ts issue-keyed queries"
  - phase: 40-03
    provides: "GET /registry/repetition-note pipeline endpoint (D-10)"
  - phase: 40-04
    provides: "lib/derivedState.ts (deriveIssueStatus/deriveStageStates/deriveTasks/estimateWorkMinutes), lib/issueRouteResolver.ts, lib/repetitionNoteClient.ts"
provides:
  - "Issues home screen (/issues) — in-progress IssueCard (5-stage strip + all seven ISS-01 readouts), ScheduledSlotCard (repetition note + Start-early), HeldIssueRow, RecentlyPublishedRow (D-29 verification record), CreatePanel (D-28 one Create path)"
  - "The ISS-06 structural loading/error contract wired end-to-end: page.tsx normalizes skip-produced undefined into loaded-and-empty {} once a run-lookup genuinely resolves to 'no run', so a fresh draft issue shows 'Draft' — not 'State unknown' forever"
affects: [40-06-routing-inversion, 40-07-issue-overview-hold, 40-08-masthead-nav-chrome, 40-09-integration-gate, 41-issue-workspace]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational component contract: IssueCard/StageStrip/ScheduledSlotCard/HeldIssueRow/RecentlyPublishedRow/CreatePanel take pre-derived values as props; page.tsx owns all Convex querying + lib/derivedState.ts derivation"
    - "List-item-owns-its-own-subscriptions pattern for RecentlyPublishedRowContainer (rules-of-hooks: a .map() cannot call hooks conditionally per row, so each row is its own component)"
    - "undefined-vs-null-vs-{} normalization at the page boundary: a skipped Convex query is not the same as a loaded-and-empty result — deriveIssueStatus's ISS-06 guard only works correctly when the caller performs this translation"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/issues/_components/StageStrip.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/HeldIssueRow.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/RecentlyPublishedRow.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx
    - apps/dispatch-control/app/(dashboard)/issues/page.tsx
    - scripts/check-deploy-parity.mjs
  modified:
    - convex/_generated/api.d.ts
    - convex/README.md
    - package.json
    - .planning/phases/40-issue-entity-issues-home/deferred-items.md

key-decisions:
  - "IssueCard's primary CTA ('Find a story with agents' in CreatePanel) uses the existing ink-filled-button convention (bg-[color:var(--color-ink)]), not a cobalt-filled background — the UI-SPEC explicitly reserves cobalt for link-style navigation only ('never used for a filled button background in this phase')"
  - "signOffs is normalized to {} (not left undefined) once the in-progress issue's run-lookup has resolved to genuinely no run — deriveIssueStatus checks signOffs===undefined before it ever looks at runId, so leaving a skip-produced undefined in place would show 'State unknown — refresh' forever for a brand-new draft issue with no run yet"
  - "onRefresh calls window.location.reload() — Convex queries are already live-subscribed with no client-side retry lever to pull; a full reload re-establishes the websocket connection, the documented last resort per the plan's Claude's-discretion note"
  - "Moved convex/scripts/check-deploy-parity.mjs to repo-root scripts/ (Rule 3 blocking-issue fix) — it is a standalone Node CLI diagnostic using node: builtins without a \"use node\" directive, which made convex codegen fail its esbuild bundling step for every file under convex/, which meant convex/_generated/api.d.ts could never be regenerated locally to pick up Plan 40-02's issues module, which blocked this plan's own tsc --noEmit check"

patterns-established:
  - "Pattern: Issues-home list rows that need their own per-item Convex subscriptions (RecentlyPublishedRowContainer) live as a small wrapper component defined alongside the page, not as a separate _components file, since they only exist to satisfy rules-of-hooks around a .map()"

requirements-completed: [ISS-01, ISS-03, ISS-06]

# Metrics
duration: 28min
completed: 2026-07-14
---

# Phase 40 Plan 05: Issues Home Screen Summary

**The `/issues` home screen — an in-progress IssueCard with a 5-stage strip and all seven ISS-01 readouts, a ScheduledSlotCard with the repetition note and "Start early," held/recently-published rows, and a Create panel — all derived from existing Convex data via `lib/derivedState.ts`, with the ISS-06 "State unknown — refresh" contract wired structurally end-to-end.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-07-14T17:01:00-07:00
- **Completed:** 2026-07-14T17:28:37-07:00
- **Tasks:** 3
- **Files modified:** 7 created (dispatch-control) + 1 created (repo-root script) + 4 modified (Convex codegen fix)

## Accomplishments
- `StageStrip.tsx` + `IssueCard.tsx`: the 5-segment stage strip (never the spinner reserved for System Activity) and the in-progress focal card rendering all seven ISS-01 readouts, structurally unable to show a stale status when `state.kind==='error'` or `status==='unknown'` (ISS-06)
- `ScheduledSlotCard.tsx` + `HeldIssueRow.tsx` + `RecentlyPublishedRow.tsx` + `CreatePanel.tsx`: the next-slot card wired to `triggerRun` with the reserved issueNumber (D-13), single-click Reopen with no confirmation dialog (D-17), the D-29 verification record that always renders its three labeled lines with a `—` fallback (never an omitted line), and the one enabled Create CTA (D-28)
- `page.tsx`: full home orchestration — resolves the in-progress issue, assembles `DerivationInputs` from seven live Convex queries, lazily ensures the next scheduled slot (D-11), fetches the repetition note tolerating failure, and renders the D-30 empty/loading/error states
- Fixed a Rule-3 blocking issue: `convex codegen` was failing entirely (unrelated `convex/scripts/check-deploy-parity.mjs` violated Convex's Node-API bundling rule), which meant the Plan 40-02 `issues` Convex module never made it into `_generated/api.d.ts` locally — moved the script to repo-root `scripts/`, regenerated codegen, and confirmed this plan's new files type-check cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: StageStrip + IssueCard (ISS-01 readouts + ISS-06 states)** - `9913a73` (feat)
2. **Task 2: ScheduledSlotCard + HeldIssueRow + RecentlyPublishedRow + CreatePanel** - `2af0bdf` (feat)
3. **Task 3: /issues/page.tsx — home orchestration** - `15d04ea` (feat, includes the Rule-3 Convex-codegen blocking-issue fix)

_Plan metadata commit (this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates) follows._

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/issues/_components/StageStrip.tsx` — 5-segment stage strip, label+icon per the State & Icon Contract
- `apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx` — in-progress focal card, presentational, ISS-01/ISS-06
- `apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx` — next slot, repetition note, "Start #{n} early"
- `apps/dispatch-control/app/(dashboard)/issues/_components/HeldIssueRow.tsx` — held-issue row + Reopen (no confirmation)
- `apps/dispatch-control/app/(dashboard)/issues/_components/RecentlyPublishedRow.tsx` — D-29 verification record, never a blank slot
- `apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx` — the one enabled Create path (D-28)
- `apps/dispatch-control/app/(dashboard)/issues/page.tsx` — home orchestration: queries → `DerivationInputs` → render
- `scripts/check-deploy-parity.mjs` — moved from `convex/scripts/` (Rule 3 fix, see Deviations)
- `convex/_generated/api.d.ts` — regenerated to include the `issues` module
- `convex/README.md`, `package.json` — updated the moved script's path references
- `.planning/phases/40-issue-entity-issues-home/deferred-items.md` — logs the broader pre-existing `tsc` error surface unmasked after the codegen fix, plus the blocking-issue fix itself

## Decisions Made
See `key-decisions` in frontmatter — cobalt-vs-ink button color per the UI-SPEC's accent-reserved rule, the `signOffs` `{}`-normalization for ISS-06 correctness, `onRefresh` using a full reload, and the Convex-codegen script relocation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `convex codegen` failed on an unrelated standalone script, blocking this plan's own `tsc --noEmit` check**
- **Found during:** Task 3 (`/issues/page.tsx`) — running the plan's own `<verify>` command
- **Issue:** `convex/scripts/check-deploy-parity.mjs` (added by an unrelated earlier `/gsd:quick` job, commit `5895732`) is a standalone Node CLI diagnostic using `node:child_process`/`node:fs`/`node:path`/`node:url` without a `"use node"` directive. Convex's bundler tries to bundle every file under `convex/` as a potential Convex function regardless of whether it exports `query`/`mutation`/`action`, so this script's Node-API usage broke `convex codegen`'s esbuild bundling step entirely. That meant `convex/_generated/api.d.ts` could never be regenerated locally, so Plan 40-02's `issues` module never appeared in the generated `api` object, so every `api.issues.*` reference in this plan's new files failed to type-check.
- **Fix:** Moved the script to repo-root `scripts/check-deploy-parity.mjs` (it was never meant to be a Convex function — it shells out to `npx convex function-spec` itself), updating its internal path derivation (`scriptDir`/`repoRoot`/`convexDir`), `package.json`'s `check:convex-parity` script, and `convex/README.md`'s reference. Verified the moved script still runs correctly (confirms `issues:ensureByNumber`/`issues:markPublished` are called by the pipeline but not yet live-deployed — expected, since the actual `dev:once` live sync is Plan 40-09's job, not this fix's). Ran `pnpm --filter @eisenbalm/convex codegen`, which succeeded and regenerated `_generated/api.d.ts` (2-line diff).
- **Files modified:** `scripts/check-deploy-parity.mjs` (new), `convex/scripts/check-deploy-parity.mjs` (deleted), `package.json`, `convex/README.md`, `convex/_generated/api.d.ts`
- **Verification:** `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -E "app/\(dashboard\)/issues/(page|_components)"` returns only the pre-existing 40-01 RED scaffold reference to Plan 40-07's not-yet-built `HoldDialog.tsx` — none of this plan's own files have any remaining type errors. `node scripts/check-deploy-parity.mjs` runs correctly from its new location.
- **Committed in:** `15d04ea` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking-issue fix)
**Impact on plan:** The fix was necessary to complete this plan's own verification step and unblocks Convex codegen for every subsequent plan in this phase (40-06 through 40-09), not just this one. No scope creep — the script itself was not modified in behavior, only relocated.

## Issues Encountered
- After the codegen fix, a full untruncated `tsc --noEmit` run surfaced a much broader pre-existing error set across unrelated test files (mostly `import.meta.glob`-on-`ImportMeta` typing gaps and assorted possibly-undefined errors) than Plan 40-04's SUMMARY logged — 40-04's own tail was truncated to 100 lines and never saw the full list. Confirmed via targeted grep that none originate in this plan's files. Logged in full to `.planning/phases/40-issue-entity-issues-home/deferred-items.md` rather than fixed (out of scope per the executor's scope boundary).
- The plan's overall `<verification>` section states `pnpm --filter dispatch-control exec tsc --noEmit` should exit 0 "for the whole app" — this remains non-zero due entirely to the pre-existing, out-of-scope errors above (same situation 40-04 already documented and treated as acceptable). This plan's own new files are confirmed clean.

## Known Stubs

None — all six presentational components and the page orchestration are fully wired to real derived data; no hardcoded empty values or placeholder copy paths.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/issues` renders the in-progress card, scheduled slot, held/recently-published rows, and Create panel end-to-end against the Plan 40-02 Convex schema and Plan 40-04 derivation libs.
- `convex/_generated/api.d.ts` now includes the `issues` module locally — Plan 40-09's integration gate still needs its own `pnpm --filter @eisenbalm/convex dev:once` to actually deploy `issues.ts` to `dev:modest-magpie-797` (confirmed still missing live via `node scripts/check-deploy-parity.mjs`) before any dashboard call against `api.issues.*` works in the browser — unchanged from what Plan 40-02 already flagged.
- Both target RED test suites (`__tests__/IssueCard.test.tsx`, `__tests__/ScheduledSlotCard.test.tsx`) are green (10/10 tests); the full dispatch-control suite is green except the pre-existing 40-01 `HoldDialog.test.tsx` RED scaffold (Plan 40-07 scope).
- No blockers for Plan 40-06 (routing inversion), which can now link into `/issues` and `/issues/[n]` with a working home screen already in place.

---
*Phase: 40-issue-entity-issues-home*
*Completed: 2026-07-14*

## Self-Check: PASSED

All created files confirmed present on disk (7 dispatch-control files, 1 repo-root script, this SUMMARY, and deferred-items.md). All three task commits (`9913a73`, `2af0bdf`, `15d04ea`) confirmed present in git history.
