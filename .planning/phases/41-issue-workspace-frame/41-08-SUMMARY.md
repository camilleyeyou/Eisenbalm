---
phase: 41-issue-workspace-frame
plan: 08
subsystem: ui
tags: [next-app-router, react, galley, dispatch-control, workspace-frame]

# Dependency graph
requires:
  - phase: 41-issue-workspace-frame
    provides: "onUnsourcedClaimClick prop threaded through Galley -> GallerySection -> ClaimMark (41-03); draftSectionIdsFromDraft + issueDraftHref/issueFactCheckHref (41-01); the workspace frame layout.tsx with a Draft stage tab already pointed at issueDraftHref (41-06)"
provides:
  - "issues/[issueNumber]/draft/page.tsx — the issue-keyed Stage 2 (Draft) mount, renamed from the Phase 40 /review wrapper, passing issueNumber into ReviewDeskRunView"
  - "ReviewDeskRunView.tsx recomposed for Stage 2: standalone page-chrome header + rerun advisory removed, DecisionRail mount + import removed (moves to Stage 5 in 41-09), onUnsourcedClaimClick wired to router.push(issueFactCheckHref(issueNumber))"
  - "review/page.tsx rewritten as a redirect to issueDraftHref(n) — the D-06 legacy /review -> /draft redirect"
  - "Galley.tsx WSP-07 'Not generated' Editor's-note block for long-read + specAd-bonus sections whose blocks array is empty/absent, rendered inside the section's own galley-{id} anchor"
affects: [41-09-stage5-approval-publish-preview, 41-10-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Byte-identical presence predicate shared across two independent surfaces (Galley.tsx's not-generated check and derivedState.ts's draftSectionIdsFromDraft) kept in lockstep via an explicit code comment cross-reference rather than a shared runtime import, since one is a render-time JSX check and the other a pure selector"
    - "Route rename via full page relocation (draft/page.tsx net-new) + the old route degraded to a bare redirect, rather than an alias/rewrite, so the old URL's Server Component logic (issueNumber parse, run resolution) is fully retired in favor of the new page"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx
    - apps/dispatch-control/__tests__/DraftNotGenerated.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
    - apps/dispatch-control/components/galley/Galley.tsx

key-decisions:
  - "onUnsourcedClaimClick is passed unconditionally from ReviewDeskRunView to Galley (guarding issueNumber != null inside the closure) rather than conditionally omitting the prop, since draft/page.tsx is now the only caller that ever mounts ReviewDeskRunView (review/page.tsx is a pure redirect) — this still satisfies 'wired only in the Draft mount' without a second code path"
  - "The Not-generated block is rendered via a lightweight standalone <section id=\"galley-{id}\"> in Galley.tsx itself (not a new prop on GallerySection), keeping the change scoped to the one file this plan's frontmatter lists — GallerySection.tsx is untouched"
  - "The specAd bonus section gets the same Not-generated treatment (rows.length === 0) even though it isn't part of the 41-01 lockstep guarantee (which covers only the four long-read sections) — matches the plan's literal action text ('for each long-read section (and the bonus section)') without disturbing the lockstep predicate itself"

patterns-established:
  - "Pattern: a shared presence predicate enforced across two files via an explicit doc-comment cross-reference (draftSectionIdsFromDraft <-> Galley.tsx's not-generated check) when a runtime import isn't practical (one is a pure TS selector, the other JSX)"

requirements-completed: [WSP-04, WSP-07]

# Metrics
duration: ~9min
completed: 2026-07-15
---

# Phase 41 Plan 08: Stage 2 Draft Recomposition Summary

**Stage 2 (Draft) is now the galley canvas alone — no decision rail, no standalone page chrome — with unchecked-claim clicks routing to Fact Check and absent sections rendering a first-class "Not generated" Editor's-note instead of a blank.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-14T23:45Z (immediately after 41-07 commit)
- **Completed:** 2026-07-14T23:55:06-07:00
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Renamed the issue-keyed `/review` wrapper to `/draft` (`draft/page.tsx`, net-new), resolving `issueNumber -> runId` server-side exactly like the Story/Fact-Check wrappers and passing `issueNumber` into `ReviewDeskRunView` so the galley's click-through can build a Fact Check href without a second Convex round trip.
- Stripped `ReviewDeskRunView`'s standalone page chrome — the "Review Desk — Run {runId}" `<h1>` and the rerun-clobber advisory paragraph — since the workspace frame (`layout.tsx`, 41-06) now supplies page chrome for every stage.
- Removed the `DecisionRail` mount (the `lg:w-[336px]` aside) and its import entirely from `ReviewDeskRunView.tsx`; the rail moves to Stage 5 (Approval) in Plan 41-09. `DecisionRail.tsx` itself is untouched and still exists for that future import.
- Wired `onUnsourcedClaimClick` on the `<Galley>` mount to `router.push(issueFactCheckHref(issueNumber))` — clicking an unchecked (rust-tinted) claim in Draft now navigates straight to the Fact Check tab (D-12/WSP-04's click-through half; the marigold/hover/focus half shipped in 41-03).
- Rewrote `/review/page.tsx` as a pure redirect to `issueDraftHref(n)` (D-06) — old bookmarked `/review` links keep working.
- Added a WSP-07 "Not generated" Editor's-note block to `Galley.tsx`: any long-read section (or the specAd bonus) whose `blocks` array is empty/absent now renders a visible "— Not generated. The {Section} will appear here once the agents write it." paragraph inside its own `<section id="galley-{id}">` anchor, so the workspace outline's jump-to-section still lands somewhere even before the section has content — never a blank/skipped section. The presence check (`(section?.blocks ?? []).length === 0`) is byte-identical to `draftSectionIdsFromDraft`'s long-read predicate (41-01), kept in lockstep via an explicit doc-comment cross-reference in both files.

## Task Commits

Each task was committed atomically to master:

1. **Task 1: Rename to /draft, strip chrome, remove rail, wire click-through (D-06/D-07/D-13/WSP-04)** - `b107da9` (feat)
2. **Task 2: "Not generated" Editor's-note canvas block (WSP-07)** - `10be126` (test)

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx` — new Stage 2 mount: resolves `issueNumber -> runId` server-side, mounts `ReviewDeskRunView` with both `params` and `issueNumber`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx` — rewritten as a redirect to `issueDraftHref(n)` (D-06 legacy URL)
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` — added optional `issueNumber` prop; removed the standalone header/advisory and the `DecisionRail` mount + import; wired `onUnsourcedClaimClick` via `useRouter` + `issueFactCheckHref`
- `apps/dispatch-control/components/galley/Galley.tsx` — added `NotGeneratedBlock` helper; long-read sections and the specAd bonus section render it (inside their own `galley-{id}`/`galley-bonus` anchor) when their rows array is empty, instead of `GallerySection`
- `apps/dispatch-control/__tests__/DraftNotGenerated.test.tsx` — new test file (3 tests): absent section renders the Not-generated block inside its anchor, present section does not, and a section with an explicit empty `blocks: []` array also renders it

## Decisions Made

- `onUnsourcedClaimClick` is passed unconditionally into `<Galley>` from `ReviewDeskRunView` (with an internal `issueNumber != null` guard) rather than only conditionally spreading the prop — simpler, and equivalent in practice since `draft/page.tsx` is the only remaining caller of `ReviewDeskRunView` (the old `/review` mount is now a pure redirect, never rendering the component).
- The Not-generated block lives entirely inside `Galley.tsx` as a standalone `<section>` (bypassing `GallerySection`) rather than adding a new prop to `GallerySection.tsx` — keeps the change scoped to exactly the one galley file this plan's frontmatter lists, and avoids touching `GallerySection`'s `PortableText`/`components` machinery for what is a simple presence check.
- Extended the Not-generated treatment to the specAd bonus section (rows-empty check) per the plan's literal action text, even though the bonus section is outside the 41-01 lockstep guarantee (which only covers the four long-read sections) — this is additive UI polish, not a change to the shared presence predicate.

## Deviations from Plan

None - plan executed exactly as written. One in-flight self-correction (not a deviation from the plan's intent, just an implementation fix during authoring): the first attempt at documenting the chrome removal in `ReviewDeskRunView.tsx`'s module docstring literally contained the strings "DecisionRail" and the removed header text, which would have failed the plan's own grep-based verify guard (`! grep -q "DecisionRail"`); reworded the comment to describe the removal without repeating the literal strings before running the verify command, so the guard passes as intended.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Stage 2 (Draft) is fully recomposed: `pnpm --filter dispatch-control build` compiles `/issues/[issueNumber]/draft` (9.04 kB) and confirms `/issues/[issueNumber]/review` is now redirect-only (157 B).
- `DecisionRail.tsx` is untouched and ready for Plan 41-09 to import into the Stage 5 (Approval) canvas — no capability was lost, only relocated.
- The WSP-07 "Not generated" presence check in `Galley.tsx` and `draftSectionIdsFromDraft` in `lib/derivedState.ts` (41-01) are cross-documented as byte-identical; any future change to either predicate must update both.
- No blockers identified for Plan 41-09 (Stage 5 Approval/Publish preview) or 41-10 (integration gate).

## Verification

- `pnpm --filter dispatch-control test -- DraftNotGenerated.test.tsx ClaimMark.test.tsx Galley.test.tsx` — 3 files, 20 tests, all green.
- Grep guards: `issueFactCheckHref` present, `DecisionRail` absent, and `issueDraftHref` present in `review/page.tsx` — all confirmed via the plan's exact automated verify command.
- `pnpm --filter dispatch-control build` — compiled successfully; route table confirms `/issues/[issueNumber]/draft` (9.04 kB, dynamic) and `/issues/[issueNumber]/review` (157 B, redirect-only).
- `pnpm --filter dispatch-control exec tsc --noEmit` — zero errors in any file this plan touched. The pre-existing ~20 errors in `syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, and `WriterExpansion.test.tsx` are the same baseline documented in 41-01/41-03/41-06's summaries — out of scope, untouched by this plan.

## Roadmap Note

`node gsd-tools.cjs roadmap get-phase 41` returns `malformed_roadmap` (the known multi-milestone ROADMAP.md CLI quirk for phases 40-50, documented in project memory `roadmap-multi-milestone-cli-quirk`). The Phase 41 plan-progress table and the `41-08` plan checkbox were updated directly in `ROADMAP.md`'s `### Phase 41:` block instead of via the CLI helper.

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 5 claimed files found on disk; both task commits (`b107da9`, `10be126`) confirmed in git log.
