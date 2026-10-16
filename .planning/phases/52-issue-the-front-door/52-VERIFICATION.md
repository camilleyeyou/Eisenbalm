---
phase: 52-issue-the-front-door
verified: 2026-10-16T00:00:00Z
status: passed
score: 5/5 success criteria verified (HOME-01..HOME-09)
re_verification: false
gaps: []
---

# Phase 52: Issue - The Front Door Verification Report

**Goal:** Editor lands on the current issue's real title/subject, sees nine sections as a derived-state table of contents, publishes from the footer through the unchanged gate.
**Status:** passed. Deployed read-through approved by user 2026-10-16 (52-HUMAN-UAT.md, 8/8).

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Real title/subject via runs.latest -> byRunId -> issueNumber | VERIFIED | `IssueHome.tsx` takes issue only from `useCurrentRun()`; subject from `pitchLog.selectedByRunId`; no max(issueNumber). `none` state renders honest sentence. |
| 2 | Nine-section TOC with produced headline + derived state | VERIFIED | `deriveHomeSections` maps `EDITABLE_SECTIONS` (9), headline from draft, state derived from open error findings + blocking claims; nothing stored/tickable. |
| 3 | Per-story note, opens first problem, no task list | VERIFIED | `rowNote` ("1 thing to fix ->"), href `/s/{id}#finding-{id}`; section page `useEffect` scrolls to hash after loading clears. |
| 4 | One Publish button; disabled reason sentence naming/linking stories; enabled when no blockers; one click chains existing endpoints | VERIFIED | `deriveHomeFooter` (fix/running/gate1/failed/ready), `publishChain` = recordSignOff facts-cleared -> sounds-human -> publishIssue (skips already-recorded; never publish-manual); `derivePublishGate` adds held/role/busy, only stricter than server. |
| 5 | Honest none/running/failed; never clean while loading | VERIFIED | Selector returns undefined if draft/findings/claims undefined; footer -> loading unless sections, claimSummary, signOffs, issue, title all loaded; `rowsReady` gates rows; failed footer offers no sign-off action. |

## Client/server gate parity
`homeSections.ts` blocking = open `severity==='error'` on any axis + open contradicted claims. `signoffs.py` (lines ~159, ~216) blocks on `severity=="error"` and no `resolution`. Match. Known documented gap: legacy `accepted:true` without `resolution` may look resolved client-side while server still blocks; fails safe (chain stops with the server's sentence). Not a blocker.

## Artifacts / wiring
- lib/homeSections.ts, lib/publishChain.ts, (editorial)/page.tsx -> IssueHome -> IssueHomeView/StoryRow/PublishFooter: all exist, substantive, wired.
- `app/(dashboard)/page.tsx` deleted (only one group owns `/`); (dashboard) /run, /issues, /issues/[n]/approval and other routes still present - no old URL broken (UAT step 8 confirmed live).
- Level 4: data from Convex hooks and `getDraft`; no hardcoded empties.

## Spot-checks
vitest homeSections/publishChain/IssueHomeView/IssueHome/homeRoute: 5 files, 98/98 pass. `tsc --noEmit`: zero errors outside `__tests__/` (pre-existing test typing noise; not part of build).

## Requirements
HOME-01..HOME-09 all SATISFIED; no orphaned IDs.

## Anti-patterns
None blocking. Info: REQUIREMENTS.md traceability table still says "Planned" for HOME rows (checkboxes are ticked) - bookkeeping only.

## Human verification
Completed: 8/8 approved on deployed site 2026-10-16; no issue was published.

_Verifier: Claude (gsd-verifier)_
