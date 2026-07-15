---
phase: 41-issue-workspace-frame
plan: 09
subsystem: ui
tags: [next-app-router, react, convex, dispatch-control, workspace-frame, publish-gate]

# Dependency graph
requires:
  - phase: 41-issue-workspace-frame
    provides: "useWorkspaceState().held (41-05) — consumed directly, never re-queried; the frame layout.tsx's {children} canvas slot (41-06) already gives the mounted stage full center-column width; DecisionRail.tsx untouched-since-Phase-33 rail internals (41-08 confirmed the galley no longer mounts it)"
provides:
  - "issues/[issueNumber]/approval/page.tsx — the issue-keyed Stage 5 server wrapper (runId resolution + no-run redirect only, no held query)"
  - "issues/[issueNumber]/approval/ApprovalStage.tsx — the client inner reading held from useWorkspaceState() and mounting the full-width DecisionRail"
  - "DecisionRail.tsx recomposed for WSP-05/WSP-06: optional issueNumber/held props, a held term in the publish gate, a net-new Readiness board section, the memo section relabeled to 'Agent editor's recommendation', the section order reordered to blockers -> readiness board -> recommendation -> hook -> verification -> sign-offs -> actions -> resolved, and the written 'Unlocks when' unlock condition"
  - "PublishPreviewDialog.tsx — the exact-preview publish interstitial (destination/title/time/consequences + one confirm), net-new UI sitting between the Publish button and the UNCHANGED publishIssue(token, runId)"
affects: [41-10-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server wrapper resolves runId + redirects only; the client inner reads frame-level derived state (held) from useWorkspaceState() instead of re-querying — the same centralization discipline 41-05/41-06/41-08 established, now applied to Stage 5"
    - "A publish-preview interstitial as a plain controlled dialog component (open/confirm/cancel props) inserted between an existing button and an existing unchanged handler — zero server-contract change, confirmed by leaving lib/reviewClient.ts and docs/API_CONTRACTS.md untouched"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/PublishPreviewDialog.tsx
    - apps/dispatch-control/__tests__/PublishPreviewDialog.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx

key-decisions:
  - "The Readiness board's 'no data yet' rows use distinct copy from the existing Verification/Hook sections' identical-purpose fallbacks ('No claims yet' vs 'No claims extracted yet'; 'None selected yet' vs 'No charity selected yet') — the two sections describe the same underlying state but render as two independent DOM elements, and RTL's getByText requires unique text; differentiating the copy avoided ambiguous double-matches without touching the pre-existing sections' wording"
  - "The 'Unlocks when' unlock condition renders as ONE additional always-shown line whenever Publish is disabled (for any of blockers/sign-offs/held), layered ON TOP of the existing per-reason messages (blockerReason / 'Both sign-offs required' / the new held message) rather than replacing them — this kept every pre-existing DecisionRail.test.tsx assertion about those specific messages passing unmodified while still satisfying WSP-06's literal requirement"
  - "Organization verification has no data source this phase (per 41-CONTEXT/41-RESEARCH) — its readiness-board row renders an explicit italic 'Not tracked yet', never a blank cell or a fake green, matching the plan's never-blank/never-fake-verified discipline"
  - "PublishPreviewDialog is a fully generic controlled component (issueNumber/charityName/onConfirm/onCancel/busy props) with zero Convex/Clerk imports of its own — DecisionRail owns all data-fetching and passes down only the two literal values (issueNumber, pitch?.charityName) the preview needs to compose its title"

requirements-completed: [WSP-05, WSP-06]

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 41 Plan 09: Stage 5 Approval + Publish Preview Dialog Summary

**Stage 5 (Approval) now mounts the full-width, held-aware decision rail behind a blockers-first -> readiness board -> "Agent editor's recommendation" layout, and Publish opens a net-new exact-preview dialog (destination/title/time/consequences, one confirm click, zero typed input) instead of calling the publish endpoint directly — the endpoint itself, `lib/reviewClient.ts`, and `docs/API_CONTRACTS.md` are all byte-unchanged.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-15
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- **Task 1 — Stage 5 route + held-aware full-width mount:** new `approval/page.tsx` (server wrapper, the same `parseIssueNumber` -> `ConvexHttpClient(api.pipelineRuns.byIssueNumber)` -> redirect-on-no-run shape as the sibling `draft`/`voice`/`story` wrappers) does ONLY runId resolution — it never queries `held`. The new client inner `ApprovalStage.tsx` reads `held` from `useWorkspaceState()` (Plan 41-05's provider, already subscribed once for the whole frame) and mounts `<DecisionRail runId issueNumber held />` — no second `held` subscription anywhere (41-RESEARCH Pitfall 3 honored). `DecisionRail.tsx` gained optional `issueNumber`/`held` props; the publish `disabled` expression gained the `held` term (`blockers.length > 0 || !factsActive || !humanActive || !!held || busy`), with a visible "This issue is held — release the hold to publish." reason. The frame's `layout.tsx` grid already gives the mounted stage the full center-column width — no sizing wrapper was needed (the old `lg:w-[336px]` sidebar sizing lived in `ReviewDeskRunView`, already stripped in Plan 41-08).
- **Task 2 — Readiness board + "Agent editor's recommendation" + PublishPreviewDialog (WSP-05/WSP-06):** `DecisionRail.tsx` gained a net-new Readiness board section (Fact check X/Y, Voice signed y/n, Hook & peg selected y/n, Organization verification — explicit "Not tracked yet" since no data source exists this phase, Open decisions blocker count) inserted between Blocking items and the recommendation, per D-14's blockers-first -> readiness board -> recommendation order. The existing "Editor's memo" section (same editor-final `notes` data) is relabeled "Agent editor's recommendation" (D-16/SC-4 — "editor" unqualified stays reserved for the human) with its honest fallback updated to match. New `PublishPreviewDialog.tsx` renders the four exact-preview fields and a single "Publish now" + Cancel — no `<input>`/typed-confirmation anywhere; the Publish button now opens this dialog (`setShowPreview(true)`) instead of calling `handlePublish` directly, and the dialog's confirm calls that SAME unchanged `handlePublish`/`publishIssue(token, runId)`. A written "Unlocks when: Must fix = 0 · Fact Check complete · Voice approved current[ · Not held]" line renders next to the control whenever Publish is disabled, layered on top of (not replacing) the pre-existing per-reason messages.

## Task Commits

Each task was committed atomically to master:

1. **Task 1: Stage 5 route + held-aware, full-width DecisionRail mount** - `75a97d3` (feat)
2. **Task 2: Readiness board + "Agent editor's recommendation" + PublishPreviewDialog wiring** - `7356e30` (feat)

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx` — Stage 5 server wrapper: runId resolution + no-run redirect only
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx` — client inner: reads `held` from `useWorkspaceState()`, mounts the full-width `DecisionRail`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` — `issueNumber`/`held` props, held-aware publish gate, Readiness board section, "Agent editor's recommendation" relabel, reordered sections, "Unlocks when" unlock text, `PublishPreviewDialog` wiring
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/PublishPreviewDialog.tsx` — the exact-preview publish interstitial
- `apps/dispatch-control/__tests__/DecisionRail.test.tsx` — updated ordering/publish-gate/memo-relabel tests, new Readiness board describe block, new held-aware and preview-flow assertions
- `apps/dispatch-control/__tests__/PublishPreviewDialog.test.tsx` — new: four-field render, single-confirm, no-typed-input, busy-disables-both, accessible dialog role

## Decisions Made

- See `key-decisions` in frontmatter — the two copy-differentiation calls (Readiness board vs. Verification/Hook fallback text) and the additive (not replacing) "Unlocks when" line were the only judgment calls needed; both were made to avoid RTL ambiguous-match failures and to protect the large pre-existing `DecisionRail.test.tsx` suite without weakening any assertion.

## Deviations from Plan

None - plan executed exactly as written. One in-flight self-correction (not a deviation): the first pass of the two new Readiness-board tests used the SAME fallback strings as the adjacent Verification/Hook sections ("No claims extracted yet" / "No charity selected yet"), which made 3 pre-existing/new tests fail on ambiguous multi-match; resolved by giving the Readiness board its own distinct copy ("No claims yet" / "None selected yet") before finalizing, per the "never blank, never ambiguous" discipline the plan itself calls for.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm --filter dispatch-control test -- DecisionRail.test.tsx PublishPreviewDialog.test.tsx` — 2 files, 44 tests, all green.
- `pnpm --filter dispatch-control test` (full suite) — 81 files passed / 1 skipped, 637 tests passed / 2 todo — no regressions vs. the 41-08 baseline.
- `pnpm --filter dispatch-control exec tsc --noEmit` — zero errors in any file this plan touched; the same pre-existing baseline errors (`syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `WriterExpansion.test.tsx`) documented since 41-01 are unchanged and untouched by this plan.
- `pnpm --filter dispatch-control build` — compiled successfully; route table confirms `/issues/[issueNumber]/approval` (6.96 kB, dynamic) is live.
- Grep guards (all pass): "Agent editor's recommendation" present in `DecisionRail.tsx`; `PublishPreviewDialog.tsx` contains "public Dispatch site", "Issue ", "Now"/"immediately", "locks further edits", and zero `<input`; `DecisionRail.tsx` mounts `PublishPreviewDialog` and contains "Unlocks when".
- No change to `lib/reviewClient.ts`'s publish signature or `docs/API_CONTRACTS.md` (confirmed via `git diff` against both commits) — the server two-sign-off gate is reused unchanged, per PROJECT.md's "DO NOT REBUILD the publish gate."

## Roadmap Note

`node gsd-tools.cjs roadmap get-phase 41` returns `malformed_roadmap` (the known multi-milestone ROADMAP.md CLI quirk for phases 40-50, documented in project memory `roadmap-multi-milestone-cli-quirk`). The Phase 41 plan-progress table and the `41-09` plan checkbox were updated directly in `ROADMAP.md`'s `### Phase 41:` block instead of via the CLI helper.

## Next Phase Readiness

- Stage 5 (Approval) is fully recomposed: blockers-first -> readiness board -> agent editor's recommendation -> hook -> verification -> sign-offs -> actions -> resolved, held-aware, with a one-click exact-preview publish flow and zero server-contract change.
- All five Workspace stages (Story, Draft, Fact Check placeholder, Voice, Approval) now have issue-keyed mounts inside the shared frame (`layout.tsx`, Plan 41-06) — Plan 41-10 (integration gate) can exercise the full Workspace end-to-end.
- No blockers identified for Plan 41-10.

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 6 claimed files found on disk (plus this SUMMARY.md); both task commits (`75a97d3`, `7356e30`) confirmed in git log.
