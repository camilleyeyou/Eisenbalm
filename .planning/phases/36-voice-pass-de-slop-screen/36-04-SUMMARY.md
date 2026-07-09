---
phase: 36-voice-pass-de-slop-screen
plan: 04
subsystem: ui
tags: [next.js, react, convex, galley, voice-pass, review-desk, axis-partition]

# Dependency graph
requires:
  - phase: 36-voice-pass-de-slop-screen
    plan: 01
    provides: "docs/API_CONTRACTS.md §36 contract (§36.3 axis partition, §36.4 voice-recheck shape) + Convex qaCorrections.axis gains machine-tell/structural-variety literals"
  - phase: 36-voice-pass-de-slop-screen
    plan: 02
    provides: "agents/qa axis passthrough (true per-predicate axis) + api/signoffs.py VOICE_AXES facts-cleared narrowing this plan mirrors client-side"
  - phase: 36-voice-pass-de-slop-screen
    plan: 03
    provides: "POST /issues/{run_id}/voice-recheck (§36.4) this plan's voicePassClient.recheck() calls"
  - phase: 36-voice-pass-de-slop-screen
    plan: 05
    provides: "agents/qa/rules.py check_machine_tell predicate writing axis='machine-tell' findings this screen lights"
  - phase: 32-native-galley-read-only-span-resolver
    provides: "Galley/GallerySection/AnnotationMark/GalleryGameSlot/UnresolvedFindingCard render+resolver stack this plan promotes and reuses"
  - phase: 33-accept-fix-wiring-decision-rail
    provides: "DecisionRail/ResolvedFindingsList blockers-first rail this plan axis-scopes"
provides:
  - "apps/dispatch-control/components/galley/* — the promoted, route-agnostic galley render stack (6 files) imported by both Review Desk and Voice Pass"
  - "apps/dispatch-control/lib/galley/axisPartition.ts — VOICE_AXES/FACTUAL_AXES (§36.3), the single source of truth both screens and the decision rail import"
  - "Galley's includeAxes prop — one component now serves two axis-partitioned reading surfaces"
  - "apps/dispatch-control/lib/voicePassClient.ts — recheck(runId, token) -> POST /issues/{runId}/voice-recheck"
  - "/voice-pass and /voice-pass/[runId] — the real Voice Pass screen (VOX-01), replacing the Phase 30 placeholder"
  - "DecisionRail + ResolvedFindingsList scoped to FACTUAL_AXES — Review Desk's factual sign-off is now genuinely distinct from Voice Pass's voice sign-off at the UI layer"
affects: [36-06-rewrite-popover-signoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route-agnostic shared component promotion: a component imported by 2+ routes moves out of a route's private _components/ folder into components/ the first time a second consumer needs it (galley: review-desk -> components/galley/)"
    - "One render surface, N axis-scoped consumers: Galley's includeAxes?: ReadonlySet<string> prop lets a single component serve Review Desk (FACTUAL_AXES) and Voice Pass (VOICE_AXES) with zero duplicated render/resolver code"
    - "Undefined-axis-as-factual conservative default (§36.3): every axis-scoping filter in this plan uses `axis === undefined || WHITELIST.has(axis)` for gating/blocking surfaces (DecisionRail, ResolvedFindingsList) so a legacy pre-Phase-36 row still counts as factual and is never silently invisible to both screens — but Galley's own render-level includeAxes filter is stricter (`axis !== undefined && WHITELIST.has(axis)`), per the plan's explicit Task 2 spec, since an unscoped row rendering on BOTH screens at once would be a worse failure than omitting it from one
    - "Testable Next.js 15 async-params pages: the default export's `use(params)` unwrapping is a thin wrapper around a named, directly-testable inner component (VoicePassScreen(runId)) — avoids requiring a Suspense boundary + real promise-resolution timing in unit tests"

key-files:
  created:
    - apps/dispatch-control/components/galley/Galley.tsx (moved + includeAxes prop)
    - apps/dispatch-control/components/galley/GallerySection.tsx (moved)
    - apps/dispatch-control/components/galley/AnnotationMark.tsx (moved)
    - apps/dispatch-control/components/galley/GalleryGameSlot.tsx (moved)
    - apps/dispatch-control/components/galley/UnresolvedFindingCard.tsx (moved)
    - apps/dispatch-control/components/galley/ClaimMark.tsx (moved)
    - apps/dispatch-control/lib/galley/axisPartition.ts
    - apps/dispatch-control/lib/voicePassClient.ts
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx
    - apps/dispatch-control/__tests__/VoicePassScreen.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (Galley import path + includeAxes={FACTUAL_AXES} + chip-count scoping)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (factualOpen scoping)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx (FACTUAL_AXES scoping)
    - apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx (placeholder -> auto-focus redirect)
    - apps/dispatch-control/__tests__/Galley.test.tsx (+includeAxes tests, import path update)
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx (import path update)
    - apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx (import path update)
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (+axis scoping tests)
    - apps/dispatch-control/__tests__/ResolvedFindingsList.test.tsx (+axis scoping tests)

key-decisions:
  - "Test 4 of Task 4's four behavior tests (\"ResolvedFindingsList shows only resolved FACTUAL_AXES rows\") was placed in __tests__/ResolvedFindingsList.test.tsx rather than DecisionRail.test.tsx, since DecisionRail.test.tsx deliberately mocks ResolvedFindingsList as a stub (Task 1 assertions run standalone) — the assertion belongs in the file that actually exercises that component's own filtering logic"
  - "Extracted a named VoicePassScreen(runId) export from voice-pass/[runId]/page.tsx's default use(params) wrapper after discovering React 19's use()+Suspense does not resolve within this repo's vitest/jsdom/RTL harness (confirmed with a minimal repro outside this component) — this is a pre-existing environment gap, not something introduced by this plan, and no other page in the codebase has a precedent unit test for a use(params) page component"
  - "Chip-count tally in review-desk/[runId]/page.tsx applies the exact same axis rule as Galley's own includeAxes filter (axis present AND in FACTUAL_AXES, not the undefined-as-factual DecisionRail rule) so the chip badges never disagree with what the mounted Galley actually lights"

requirements-completed: [VOX-01, VOX-04]

# Metrics
duration: ~22min
completed: 2026-07-09
---

# Phase 36 Plan 04: Voice Pass Screen Summary

**Promoted the Phase 32 galley render stack to a route-agnostic `components/galley/`, added an axis-partition filter so one `Galley` instance serves both Review Desk and Voice Pass, stood up the real `/voice-pass/[runId]` screen (tell count + on-demand "Run deep check"), and scoped Review Desk's DecisionRail/ResolvedFindingsList to `FACTUAL_AXES` so the two sign-offs are genuinely distinct at the UI layer.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-09T13:56:00Z (approx.)
- **Completed:** 2026-07-09T14:18:29Z
- **Tasks:** 4 completed
- **Files modified:** 19 (10 created, 9 modified)

## Accomplishments
- `Galley.tsx`/`GallerySection.tsx`/`AnnotationMark.tsx`/`GalleryGameSlot.tsx`/`UnresolvedFindingCard.tsx`/`ClaimMark.tsx` moved out of Review Desk's private `_components/` into `apps/dispatch-control/components/galley/` — a pure move with zero behavior change, proven by all 3 pre-existing test files passing unchanged after the import-path update
- `lib/galley/axisPartition.ts` (§36.3) exports `VOICE_AXES`/`FACTUAL_AXES`; `Galley` gained an `includeAxes?: ReadonlySet<string>` prop (undefined = render everything, back-compat; set = axis-present-and-whitelisted only) proven by 4 new tests (VOICE_AXES-only, FACTUAL_AXES-only, back-compat, undefined-axis omission)
- `/voice-pass` is a real screen: the placeholder route now auto-focuses the current awaiting-review run (mirroring Review Desk's pattern exactly); `/voice-pass/[runId]` mounts the SAME promoted Galley scoped to `VOICE_AXES` (provenance off), computes the per-screen tell count (VOX-01) from the identical `isOpenFinding` + `VOICE_AXES` predicate the galley itself applies, and a "Run deep check" button (VOX-04) POSTs `voice-recheck` via the new `voicePassClient.ts`
- Review Desk's `DecisionRail` (blockers, headline counts, blocking-items jump-link list, the "Facts cleared" gate) and `ResolvedFindingsList` are now scoped to `FACTUAL_AXES` (a `undefined`-axis legacy row still counts as factual, per §36.3's conservative default) — mirrors 36-02's server-side facts-cleared narrowing, proven by 9 new tests across both components including the legacy-no-axis-still-blocks case

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote the shared galley components to components/galley/** - `4a9fd3b` (refactor)
2. **Task 2: Axis-filter prop on Galley + VOICE_AXES/FACTUAL_AXES partition** - `9f789ce` (test, RED) + `ea376fc` (feat, GREEN)
3. **Task 3: /voice-pass/[runId] screen — VOICE_AXES galley + tell count + Run deep check** - `d1e19e0` (feat)
4. **Task 4: Axis-scope the Review Desk DecisionRail + ResolvedFindingsList to FACTUAL_AXES** - `6da0fee` (test, RED) + `4146a8a` (feat, GREEN, DecisionRail) + `e166685` (test, RED) + `f887431` (feat, GREEN, ResolvedFindingsList)

**Plan metadata:** (this commit) - docs: complete plan

_TDD tasks (2 and 4) produced RED→GREEN commit pairs per task; Task 4 needed two RED→GREEN pairs since it touches two components (DecisionRail, then ResolvedFindingsList)._

## Files Created/Modified
- `apps/dispatch-control/components/galley/{Galley,GallerySection,AnnotationMark,GalleryGameSlot,UnresolvedFindingCard,ClaimMark}.tsx` - Moved from `review-desk/[runId]/_components/`; `Galley.tsx` additionally gains the `includeAxes` prop and scoping logic
- `apps/dispatch-control/lib/galley/axisPartition.ts` - `VOICE_AXES`/`FACTUAL_AXES` per §36.3
- `apps/dispatch-control/lib/voicePassClient.ts` - `recheck(runId, token)` client for `POST /issues/{runId}/voice-recheck` (§36.4)
- `apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx` - Auto-focus redirect (placeholder retired)
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` - The Voice Pass screen: VOICE_AXES galley mount, tell count, Run deep check
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` - Galley import path, `includeAxes={FACTUAL_AXES}` mount, FACTUAL_AXES-scoped chip tally
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` - `factualOpen` scoping for blockers/warnings/infos/blocking-items/Facts-cleared gate
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx` - FACTUAL_AXES scoping on the resolved list
- `apps/dispatch-control/__tests__/{Galley,AnnotationMark,UnresolvedFindingCard,DecisionRail,ResolvedFindingsList}.test.tsx` - Import-path updates + new axis-scoping/includeAxes test coverage
- `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx` - New: voice-axis-only rendering, tell count (incl. resolved-exclusion), Run deep check -> recheck()

## Decisions Made
- Test 4 of Task 4 ("ResolvedFindingsList shows only resolved FACTUAL_AXES rows") lives in `ResolvedFindingsList.test.tsx`, not `DecisionRail.test.tsx` — the latter deliberately stubs that component out for its own Task 1 assertions, so the real filtering behavior can only be proven in the component's own test file
- Extracted a named `VoicePassScreen(runId)` component from the default `use(params)` export after confirming (via an isolated repro outside this component) that React 19's `use()` + `Suspense` does not resolve within this repo's vitest/jsdom/RTL harness — a pre-existing environment gap with no precedent test in the codebase for any `use(params)` page component, not a regression introduced by this plan. The default export stays the real Next.js 15 page contract; only the testable inner component is exported for direct unit testing
- The review-desk page's chip-count tally reuses the exact same axis rule as `Galley`'s `includeAxes` filter (`axis !== undefined && FACTUAL_AXES.has(axis)`), not the `DecisionRail`/`ResolvedFindingsList` undefined-as-factual rule — so the chip badges and the mounted Galley's own annotations never disagree (per the plan's explicit Task 2 instruction to mirror the galley's own filter, not the rail's)

## Deviations from Plan

None architecturally — all four tasks match their `<action>`/`<acceptance_criteria>`/`<verify>` blocks. Two minor test-authoring adjustments (documented above under Decisions Made) were made within Rule 1/3 discretion: relocating one behavior test to the component file that actually exercises it, and splitting the Voice Pass page component so it could be unit-tested at all given an environment limitation unrelated to this plan's code.

## Issues Encountered
- React 19's `use(promise)` + `Suspense` did not resolve inside this repo's vitest/jsdom + `@testing-library/react` setup (confirmed with an isolated minimal repro, not specific to this component) — resolved by extracting a named, directly-testable `VoicePassScreen(runId)` component and testing that instead of the `use(params)`-wrapped default export.

## Known Stubs

- **`apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx:144-145`** — `handleEditSection()` is an intentional no-op stub passed to the mounted `<Galley onEditSection={...}>`. Voice Pass's own tells still fully open/close their popover and can be Dismissed (the shared `AnnotationMark`/`UnresolvedFindingCard` dismiss action already works, since it calls the existing `dismissFinding` pipeline endpoint independent of `onEditSection`); only the "Edit inline" deep-link and the rewrite-popover flow are inert. This is explicitly in scope for Plan 36-06 (Wave 4, "rewrite-popover-signoff") per the phase's own wave breakdown and this plan's task description ("wire it to a no-op-safe handler for now (36-06 finalizes the rewrite/edit actions)") — not a gap in this plan's own VOX-01/VOX-04 goal, which is fully wired (lighting voice tells, tell count, on-demand deep check).

## User Setup Required

None - no external service configuration required. The new `/voice-pass` and `/voice-pass/[runId]` routes and `voicePassClient.ts` reuse the already-configured Clerk auth, Convex client, and `NEXT_PUBLIC_PIPELINE_URL` env var — no new environment variables.

## Next Phase Readiness

- The galley promotion + `voice-pass/[runId]/page.tsx` are committed directly to `master` (this plan ran on the MAIN checkout, no worktree) — Plan 36-06 (Wave 4: rewrite popover + sign-off) can safely edit `components/galley/AnnotationMark.tsx` (voice-tell variant) and `voice-pass/[runId]/page.tsx` (wiring the "Sounds human" sign-off + replacing the current no-op `onEditSection`/rewrite stub) without any reconciliation step.
- `axisPartition.ts`'s `VOICE_AXES`/`FACTUAL_AXES` are now the single client-side source of truth for the voice/factual split, consumed by `Galley`, `DecisionRail`, `ResolvedFindingsList`, and the Voice Pass screen — Plan 36-06 can import the same constants for the sign-off gating UI.
- Full `apps/dispatch-control` vitest suite: **47 files passed | 1 skipped, 411 passed | 2 todo** (no regressions from the promotion or the axis filter). `pnpm --filter dispatch-control build` (strict type-check) exits 0.
- `onEditSection` on the Voice Pass screen is currently a safe no-op stub (documented in the component's own doc comment) — Plan 36-06 is expected to wire the rewrite popover / edit-inline action for voice tells; this is not a stub blocking THIS plan's own goal (the screen's core VOX-01/VOX-04 behavior — lighting voice tells with a tell count and an on-demand judge trigger — is fully wired and tested), it is explicitly scoped to the next plan per the phase's own wave breakdown.

---
*Phase: 36-voice-pass-de-slop-screen*
*Completed: 2026-07-09*

## Self-Check: PASSED

All claimed files exist on disk (`components/galley/{Galley,GallerySection,
AnnotationMark,GalleryGameSlot,UnresolvedFindingCard,ClaimMark}.tsx`,
`lib/galley/axisPartition.ts`, `lib/voicePassClient.ts`,
`voice-pass/page.tsx`, `voice-pass/[runId]/page.tsx`,
`__tests__/VoicePassScreen.test.tsx`, `review-desk/[runId]/page.tsx`,
`review-desk/[runId]/_components/{DecisionRail,ResolvedFindingsList}.tsx`,
this SUMMARY.md). All claimed commit hashes (`4a9fd3b`, `9f789ce`,
`ea376fc`, `d1e19e0`, `6da0fee`, `4146a8a`, `e166685`, `f887431`) are
present in `git log --oneline --all`.
