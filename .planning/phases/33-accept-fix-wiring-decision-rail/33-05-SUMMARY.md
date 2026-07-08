---
phase: 33-accept-fix-wiring-decision-rail
plan: 05
subsystem: dispatch-control
tags: [react, decision-rail, publish-gate, reopen, convex, clerk, review-desk]
requires:
  - 33-01 (§33 frozen contract — memo key `notes`, findings endpoint shapes)
  - 33-02 (pitchLog.selectedByRunId + claimChecks.checkedAt — hook card + verification data)
  - 33-03 (publish endpoint 409 open_error_findings — the D-14 server half)
  - 33-04 (findingsClient.reopenFinding + isOpenFinding shared predicate)
  - Phase 26 reviewClient (publishIssue/rejectIssue) + Phase 25 pipelineControlClient (rerollAgent)
provides:
  - apps/dispatch-control/.../DecisionRail.tsx (blockers-first rail — GLY-04, D-10..D-17)
  - apps/dispatch-control/.../ResolvedFindingsList.tsx (collapsed reopen surface — D-04)
  - Rail mounted as the design's 336px right column in galley mode (page.tsx)
  - reopenFinding is now operator-reachable (was dead code after 33-04)
affects:
  - Phase 34 (two-sign-off gate layers on the same Publish button + D-14 server check)
  - Phase 35 (source index joins the rail); Phase 37 (hook card upgrades in place)
tech-stack:
  added: []
  patterns:
    - rail self-fetches via useQuery(api.*) + useAuth().getToken() (page conventions)
    - never-blank affirmative-state ladder for every rail block (D-13 rule)
    - galleyAnchorFor replicated locally (private in page.tsx) for jump links
key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx
    - apps/dispatch-control/__tests__/ResolvedFindingsList.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
decisions:
  - "publishIssue/rejectIssue take (token, runId) — token FIRST; the plan's pseudo-code had the order reversed, the real reviewClient signature wins"
  - "api.deliberationEvents.byRunIdAndType returns an ARRAY (collect); the rail parses the LAST editor-final row's payload for the memo"
  - "Memo key is `notes` per §33.6 wave-context correction (33-CONTEXT D-16's `editor_final_notes` was superseded by the frozen contract)"
  - "ResolvedFindingsList empty state renders even while collapsed — expanding an empty disclosure to learn it's empty would violate the never-blank rule"
  - "Hold calls rejectIssue directly with a status message (no note prompt) — the Phase 26 review page remains the place for annotated rejections"
  - "Reopen success performs NO local state change — Convex reactivity drops the row from resolved and re-adds it to galley/chips/blockers (D-04, no text rollback, no draft refetch)"
metrics:
  duration: 15min
  completed: 2026-07-08
---

# Phase 33 Plan 05: Decision Rail Summary

Blockers-first 336px decision rail beside the galley: jump-linked error-finding checklist gating a wired Publish (client half of D-14), editor memo/hook card/verification blocks with never-blank affirmative states, all four actions on existing backends, and a collapsed resolved-findings list making reopenFinding operator-reachable.

## What was built

### Task 1 — DecisionRail component (TDD)
`DecisionRail.tsx` (`'use client'`, props `{runId}`) self-fetches four Convex queries and composes the design's D-17 order:

1. **Headline count** — "N blocker(s) to clear · M warning(s)" with info folded into a muted affix (only when >0, never inflated).
2. **Blocking items** — one ≥44px jump-link row per open error-severity finding (`isOpenFinding` + `severity === 'error'` — the same predicate as the galley/chips, Pitfall 9); click scrollIntoViews the finding's galley anchor via `qaSectionToGalleyId` + a local `galleyAnchorFor` replica. Zero blockers → affirmative "No blockers — clear to publish."
3. **Editor's memo** — parses `JSON.parse(payload).notes` from the LAST `editor-final` deliberationEvents row inside try/catch; absent/malformed → "No editor memo for this run" (never crashes).
4. **Hook card** (D-12) — `pitchLog.selectedByRunId` → charityName + scoutSummary; null → "No charity selected yet".
5. **Verification** (D-13) — "X/Y claims checked · N open" + "checked Nm ago" from max(checkedAt); ladder covers Loading… / "No claims extracted yet" / "not yet checked" — never blank.
6. **Actions** (D-15) — Publish (`disabled` while blockers > 0 with the visible reason beneath; onClick `publishIssue(token, runId)`, `ReviewApiError` messages — including the 33-03 409 `open_error_findings` — surfaced inline), Hold (`rejectIssue`), Re-run section ▾ (select of the 7 writer agent keys + `rerollAgent`), Transcript (scroll to `#galley-deliberation`).
7. **ResolvedFindingsList** at the rail foot.

16 tests: D-17 DOM ordering (Blocking items before memo via compareDocumentPosition), publish gate both ways + call-shape + 409 surfacing, the full D-13 never-blank ladder, §33.6 memo key + malformed fallback, D-12 hook card, rail-foot mount.

### Task 2 — ResolvedFindingsList (TDD, D-04)
Collapsed (`useState(false)`) disclosure "Resolved (K)" where K = complement of `isOpenFinding`. Expanded rows show sectionName, truncated reason, the resolutionReason quote when present, and an accepted/dismissed badge (`resolution ?? (accepted ? 'accepted' : 'dismissed')`). Reopen calls `reopenFinding(runId, findingId, token)`; a 409 `not_resolved` shows an inline "already open" note; success relies purely on Convex reactivity. Empty state "No resolved findings yet" renders even while collapsed. Muted/tertiary styling; `grep 'revert|reload|reloadDraft|patchSection'` returns 0. 7 tests.

### Task 3 — 336px right-column mount
`page.tsx` renders `<DecisionRail runId={runId} />` in a `w-full shrink-0 lg:w-[336px]` third column inside the existing `flex-col lg:flex-row` container, scoped to `viewMode === 'galley'` only (not edit/iframe). Mobile stacks below the galley.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ResolvedFindingsList stub created in Task 1**
- **Found during:** Task 1
- **Issue:** DecisionRail imports `./ResolvedFindingsList`, which Task 2 creates — the import would fail module resolution before Task 2 ran.
- **Fix:** Task 1 shipped a minimal stub (returns null, marked as Task 2's placeholder); Task 2 replaced it with the full implementation. The Task 1 test mocks the module either way, per plan.
- **Files modified:** ResolvedFindingsList.tsx
- **Commit:** 8783bd6 (stub) → eebee8a (full)

**2. [Rule 1 - Bug] Plan pseudo-code had publishIssue/rejectIssue argument order reversed**
- **Found during:** Task 1 read-first
- **Issue:** Plan wrote `publishIssue(runId, await getToken())`; the real Phase 26 signature is `publishIssue(token, runId)` (token first).
- **Fix:** Used the actual client signatures; the test asserts `publishIssue('tok-clerk', 'run-1')`.
- **Files modified:** DecisionRail.tsx, DecisionRail.test.tsx
- **Commit:** 8783bd6

**3. [Rule 1 - Bug] Editor-final query returns an array, not a row**
- **Found during:** Task 1 read-first
- **Issue:** Plan pseudo-code treated `byRunIdAndType` as returning a single row (`ef?.payload`); the Convex query `.collect()`s an array.
- **Fix:** Rail takes the last row of the array before parsing.
- **Files modified:** DecisionRail.tsx
- **Commit:** 8783bd6

**4. [Rule 1 - Bug] Empty state hidden behind the collapsed disclosure**
- **Found during:** Task 2 GREEN run
- **Issue:** "No resolved findings yet" only rendered after expanding — the test (and the never-blank rule) require it visible by default.
- **Fix:** Empty-state line renders unconditionally when K === 0.
- **Files modified:** ResolvedFindingsList.tsx
- **Commit:** eebee8a

## Verification

- `pnpm --filter dispatch-control test:unit __tests__/DecisionRail.test.tsx -- --run` — 16/16 green
- `pnpm --filter dispatch-control test:unit __tests__/ResolvedFindingsList.test.tsx -- --run` — 7/7 green
- `pnpm --filter dispatch-control test:unit -- --run` — full suite 44 files passed / 1 skipped, 371 passed / 2 todo (incl. `dispatch-control-no-sanity-write.test.ts` tripwire)
- `pnpm --filter dispatch-control build` — exit 0 (the enforceable strict gate)
- `pnpm --filter dispatch-control typecheck` — 133 errors, ALL in `__tests__/` — byte-identical to the documented pre-existing baseline (deferred-items.md); zero errors in source files
- All acceptance-criteria greps pass (isOpenFinding / editor-final / .notes / selectedByRunId / checkedAt / disabled / ResolvedFindingsList / reopenFinding / "No resolved findings yet" / DecisionRail + 336px in page.tsx; forbidden revert/reload grep = 0)

## Known Stubs

None — every rail block is wired to live data sources; absence states are honest copy, not placeholders (the D-13 affirmative-state rule).

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 (RED) | 03501c9 | failing DecisionRail tests |
| 1 (GREEN) | 8783bd6 | DecisionRail + ResolvedFindingsList stub |
| 2 (RED) | 1f002ae | failing ResolvedFindingsList tests |
| 2 (GREEN) | eebee8a | ResolvedFindingsList full implementation |
| 3 | e766a7b | 336px rail mount in page.tsx (galley mode only) |

## Self-Check: PASSED

All 4 created files + SUMMARY exist on disk; all 5 task commits (03501c9, 8783bd6, 1f002ae, eebee8a, e766a7b) present in git log.
