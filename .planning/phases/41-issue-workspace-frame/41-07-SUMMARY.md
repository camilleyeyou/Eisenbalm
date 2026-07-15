---
phase: 41-issue-workspace-frame
plan: 07
subsystem: ui
tags: [next-app-router, convex, dispatch-control, signal-desk, fact-check, voice-pass]

# Dependency graph
requires:
  - phase: 41-issue-workspace-frame
    provides: "layout.tsx frame (41-06) mounting stage tabs/outline/panel; SignalDeskScreen additive runId? prop (41-04); issueStoryHref/issueFactCheckHref + parseIssueNumber/issueHref (41-01)"
provides:
  - "story/page.tsx — issue-keyed Stage 1 mount: resolves issueNumber->runId server-side then mounts SignalDeskScreen with the 41-04 runId prop (candidate slate + Gate 1 adjudication scoped to THIS issue's run)"
  - "fact-check/page.tsx + FactCheckPlaceholder.tsx — Stage 3 first-class placeholder: reads api.claimChecks.listByRunId and renders the SAME 'checked X/Y / not yet checked / No claims extracted yet' honest coverage the DecisionRail Verification block shows, plus a read-only claim listing (unsourced + by-section groups, mirroring SourceIndex minus its Check/Skip write actions)"
  - "VoicePassRunView.tsx standalone page header (\"Voice Pass — Run {runId}\" + advisory) stripped (D-07); tellCount badge relocated into the retained Run-deep-check toolbar row, no capability lost"
affects: [41-10-integration-gate, 42-fact-check-stage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stage-route server wrapper (repeated a 4th time): parseIssueNumber -> redirect('/issues') on null; ConvexHttpClient(NEXT_PUBLIC_CONVEX_URL).query(api.pipelineRuns.byIssueNumber) -> redirect(issueHref(n)) if no run; mount the stage's client screen with the resolved runId; export const dynamic = 'force-dynamic'."
    - "First-class placeholder over real read data (D-11/WSP-07): rather than a static 'coming soon' stub, FactCheckPlaceholder composes the SAME live Convex query (api.claimChecks.listByRunId) and the SAME never-blank fallback logic (totalClaims===0 -> \"No claims extracted yet\", lastChecked===0 -> \"not yet checked\") an existing shipped surface (DecisionRail) already uses — an honest interim stage is a live data view with a banner, not a mock."
    - "Chrome-strip-and-relocate (not chrome-strip-and-drop): when removing a standalone page header that duplicates frame chrome, any in-canvas content signal it carried (tellCount) is moved into a retained control row, never deleted."

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx
    - apps/dispatch-control/__tests__/FactCheckPlaceholder.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx

key-decisions:
  - "FactCheckPlaceholder is a slimmed READ-ONLY clone of SourceIndex's grouping logic (unsourced pinned on top, sourced grouped by GALLEY_SECTION_ORDER, 'other sourced' trailing group) rather than reusing SourceIndex directly — SourceIndex's Check/Skip buttons call claimChecks:setStatus, a write action Phase 42's real Fact Check stage should own, not this interim placeholder (WSP-07 discipline: never let an interim surface do the real stage's job)."
  - "Stage 1's SignalDeskScreen internal 'Signal Desk' header is an ACCEPTED provisional-mount carryover this phase (per the plan's explicit note) — unlike Stage 4's header, it is NOT stripped now; the full Story redesign replacing this mount is Phase 47, Task 1."
  - "The tellCount badge was relocated (not deleted) into the 'Run deep check' toolbar row when stripping VoicePassRunView's standalone header — it is an in-canvas content signal (VOX-01), not page chrome, so D-07's chrome-stripping rule doesn't apply to it."

patterns-established:
  - "Pattern: a Stage 3-style 'first-class placeholder' — composing a real live Convex query + the shipped never-blank fallback copy from an existing surface into an honest 'arrives next' banner — is the template for any future stage that ships its frame slot before its full feature (contrast with a dead/static stub)."

requirements-completed: [WSP-01, WSP-07]

# Metrics
duration: 18min
completed: 2026-07-15
---

# Phase 41 Plan 07: Stage 1 Story + Stage 3 Fact Check + Voice Header Strip Summary

**Stage 1 (Story) now mounts the issue-keyed Signal Desk (candidate slate + Gate 1 adjudication scoped to THIS issue's run via the 41-04 `runId` prop); Stage 3 (Fact Check) is a first-class honest placeholder composing real `claim_checks` coverage — never blank, never fake-verified — ahead of Phase 42; and Stage 4 (Voice)'s duplicate standalone header is stripped per D-07 with its tell-count signal preserved in the toolbar.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-07-15
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- **Task 1 — Stage 1 (Story):** `story/page.tsx` copies the review/voice server-wrapper shape exactly (`parseIssueNumber` -> `redirect('/issues')` on null; `ConvexHttpClient(NEXT_PUBLIC_CONVEX_URL).query(api.pipelineRuns.byIssueNumber)` -> `redirect(issueHref(n))` if no run) and mounts `<SignalDeskScreen workspace_id={DEFAULT_WORKSPACE_ID} runId={run.runId} />` — the `runId` prop is present (Pitfall 2 guard verified by grep), so the tab shows THIS issue's run, never `runs.latest`.
- **Task 2 — Stage 3 (Fact Check) placeholder:** `fact-check/page.tsx` is the same server-wrapper mounting the new client `FactCheckPlaceholder({ runId })`. The placeholder renders an "arrives next — Phase 42" banner (styled per `_PlaceholderScreen` conventions) plus a Coverage section reading `api.claimChecks.listByRunId({ runId })` with the exact never-blank fallback ladder DecisionRail's Verification block uses: `claims === undefined` -> "Loading…", `totalClaims === 0` -> "No claims extracted yet" (never "verified"), else "checked X of Y · N unchecked" + ("last verified {ago}" or "not yet checked"). Below that, a read-only claim list mirrors `SourceIndex`'s unsourced/by-section grouping (`GALLEY_SECTION_ORDER`) with the Check/Skip mutation buttons removed — this interim surface reads, it does not write. `FactCheckPlaceholder.test.tsx` (mocked `convex/react` `useQuery`) proves: (a) zero claim rows render "No claims extracted yet" with no "verified"/"complete" wording anywhere, and (b) 2-checked-of-5 renders "checked 2 of 5 · 3 unchecked" with the claim rows visibly listed (never a blank region).
- **Task 3 — Stage 4 (Voice) chrome strip (D-07):** `VoicePassRunView.tsx`'s standalone `<h1>Voice Pass — Run {runId}</h1>` + "De-slop it…" advisory `<p>` are deleted — the frame's Voice tab + status mark is now the single chrome. The `tellCount` badge (an in-canvas content signal, not page chrome) is preserved, relocated into the retained "Run deep check" toolbar row alongside the button and `checkMessage` status text. All downstream galley/rail bodies, data fetching, and sign-off wiring are untouched.

## Task Commits

Each task was committed atomically to master:

1. **Task 1: Stage 1 (Story) — issue-keyed Signal Desk mount (D-09/D-10)** — `0f004aa` (feat)
2. **Task 2: Stage 3 (Fact Check) first-class placeholder (D-11/WSP-07)** — `6e0e956` (feat)
3. **Task 3: Stage 4 (Voice) — strip standalone page chrome (D-07)** — `56df709` (fix)

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx` — issue-keyed Stage 1 server wrapper mounting `SignalDeskScreen` with the resolved `runId`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx` — issue-keyed Stage 3 server wrapper mounting `FactCheckPlaceholder`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx` — read-only claim coverage + claim listing, never blank/fake-verified
- `apps/dispatch-control/__tests__/FactCheckPlaceholder.test.tsx` — zero-claims and partial-coverage assertions
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx` — standalone header/advisory removed, `tellCount` relocated into the toolbar row

## Build & Test Verification

- **`pnpm --filter dispatch-control test -- FactCheckPlaceholder.test.tsx`:** PASS — 2/2 tests, exit 0.
- **`pnpm --filter dispatch-control test -- FactCheckPlaceholder.test.tsx VoicePassScreen.test.tsx SignalDeskScreen.test.tsx WorkspaceLayout.test.tsx nav.test.ts`:** PASS — 22/22 tests across 5 files (VoicePassScreen's 6 tests, which exercise the toolbar row/tellCount/Run-deep-check button directly, all green after the strip).
- **`pnpm --filter dispatch-control test` (full suite):** PASS — 79 passed / 1 skipped files, 621 passed / 2 todo tests. No regressions.
- **`pnpm --filter dispatch-control build`:** PASS — compiled successfully, 11/11 static/dynamic routes generated. New routes confirmed in the route table: `/issues/[issueNumber]/story` (135 B) and `/issues/[issueNumber]/fact-check` (1.77 kB).
- **`pnpm --filter dispatch-control exec tsc --noEmit`:** zero errors attributable to any file this plan touched (`story/page.tsx`, `fact-check/page.tsx`, `FactCheckPlaceholder.tsx`, `VoicePassRunView.tsx`).
- Grep verification per plan `<verify>` blocks: Stage 1 passes `runId={run.runId}` to `SignalDeskScreen` (confirmed); Stage 4's `"Voice Pass — Run"` string is gone and `tellCount` is retained (confirmed).

## Decisions Made
- `FactCheckPlaceholder` is a slimmed read-only clone of `SourceIndex`'s grouping (not a direct reuse) — `SourceIndex` calls the `claimChecks:setStatus` mutation via Check/Skip buttons, which is a write action the real Phase 42 Fact Check stage should own. Reusing it directly would let this interim placeholder silently gain write capability it isn't supposed to have.
- Stage 1's `SignalDeskScreen` internal "Signal Desk" header was left as-is (per the plan's explicit carve-out) — it is an accepted provisional-mount exception this phase; Stage 4's header was stripped because Voice is a fully frame-owned shipped stage today, while Story's full redesign is deferred to Phase 47.
- The `tellCount` badge was relocated (not deleted) alongside the "Run deep check" button — it's in-canvas content, not page chrome, so the D-07 strip does not apply to it.

## Deviations from Plan

None — plan executed exactly as written across all three tasks.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- All 5 stage routes now have a mount under `issues/[issueNumber]/{story,draft-or-review,fact-check,voice,approval}/` inside the Plan 41-06 frame; Story and Fact Check (this plan) join the already-mounted Voice (Phase 40) and the review route pending its Plan 41-08 rename to `/draft`.
- Plan 41-08 (Stage 2 Draft recomposition) and 41-09 (Stage 5 Approval) remain the two unmounted stages before Plan 41-10's integration gate.
- Phase 42 (Fact Check Stage) replaces `FactCheckPlaceholder` with the full affirmative-summary/filter/claim-table/provenance-card surface — it inherits the SAME `claim_checks` read and the SAME never-blank discipline this placeholder established; no rework of the coverage-fallback logic should be needed, only additive filters/detail.
- `node gsd-tools roadmap get-phase 41` still returns `malformed_roadmap` (the known multi-milestone ROADMAP.md CLI quirk — see project memory `roadmap-multi-milestone-cli-quirk`). The Phase 41 detail section's 41-07 plan checkbox was updated directly in `.planning/ROADMAP.md`; `roadmap update-plan-progress 41` (the progress-table command, unaffected by the quirk) ran successfully.
- No blockers identified for Plans 41-08/41-09/41-10.

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 6 claimed files found on disk; all 3 task commits (`0f004aa`, `6e0e956`, `56df709`) found in git history.
