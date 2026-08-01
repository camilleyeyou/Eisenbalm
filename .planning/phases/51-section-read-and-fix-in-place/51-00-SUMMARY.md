---
phase: 51-section-read-and-fix-in-place
plan: 00
subsystem: testing
tags: [vitest, testing-library, react, dispatch-control, tdd-scaffolding]

# Dependency graph
requires:
  - phase: 45-review-desk-passage-toolbar-inspector-wiring
    provides: Galley/AnnotationMark/ClaimMark/ClaimProvenanceCard/GallerySection shared galley components
provides:
  - Wave 0 test scaffolding for every Phase 51 requirement (READ-01..05, READ-07, Pitfall 1, Pitfall 2, Pitfall 3, D-09, D-20)
  - A Voice-Pass on-demand-rewrite regression guard proven green BEFORE the label-independent trigger fix lands
  - A Review-Desk-default-unchanged regression guard for D-09's markSourcedClaims addition
  - A real Galley -> resolveClaimsFor -> AnnotationMark pipeline test that plan-level component-isolation tests cannot catch
affects: [51-01-shared-primitives, 51-04-section-reader-page, 51-07-evidence-in-the-finding-popover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() for mock vi.fn() instances referenced inside vi.mock() factories (avoids TDZ errors from vi.mock's file-top hoisting)"
    - "Non-literal dynamic import specifier + /* @vite-ignore */ to defer a not-yet-existing page module's resolution to runtime, inside an existsSync-gated describe.skip"

key-files:
  created:
    - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx
  modified:
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx
    - apps/dispatch-control/__tests__/ClaimMark.test.tsx
    - apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx
    - apps/dispatch-control/__tests__/Galley.test.tsx

key-decisions:
  - "SectionReaderPage.test.tsx's page import must be a non-literal specifier (with /* @vite-ignore */) — a literal dynamic import of a nonexistent module hard-fails Vite's import-analysis transform even inside a skipped describe block, since Vite statically resolves literal import() specifiers regardless of whether the code path executes."
  - "Case-by-case Wave-0 red/green status is reported honestly rather than forced: two of the three new evidence-card cases in AnnotationMark.test.tsx and one of the two D-09 Galley cases are negative assertions ('no card renders', 'no block elements appear') that are trivially true before the referenced feature exists, so they read GREEN today even though the plan's summary framed the whole block as red-until-51-07. This is not a weakened test — the assertions are exactly as specified; they simply describe absence-of-behavior that happens to hold both before and after the feature ships in the negative direction."

requirements-completed: [READ-01, READ-02, READ-03, READ-04, READ-05, READ-07]

# Metrics
duration: 25min
completed: 2026-07-31
---

# Phase 51 Plan 00: Wave 0 Test Scaffolds Summary

**Wave 0 Vitest scaffolding for every Phase 51 requirement — 15 new cases across 4 existing galley test files plus one new 18-case skip-guarded `SectionReaderPage.test.tsx` — giving every later 51-0X plan a real, pre-existing automated verify command.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-31T21:55:00-07:00 (approx, from session start)
- **Completed:** 2026-07-31T22:15:45-07:00
- **Tasks:** 2
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments

- Added Pitfall-2 (label-independent accept trigger), Fact/Voice-tag (READ-02), and evidence-card (READ-03/D-20) cases to `AnnotationMark.test.tsx`
- Added Pitfall-1 (phrasing-safe popover) and Source-tag cases to `ClaimMark.test.tsx`
- Added `phrasingSafe`-mode cases to `ClaimProvenanceCard.test.tsx`
- Added D-09 (`markSourcedClaims`) cases and one real-pipeline `Galley -> resolveClaimsFor -> AnnotationMark` chain case to `Galley.test.tsx` (the one case in the whole plan that cannot be satisfied by a mocked/isolated component test)
- Created `SectionReaderPage.test.tsx` — 18 specs across 5 `describe` groups (`renders`/`nav`/`in-place edit`/`group accept`/`inspect`) for the not-yet-built `/s/[section]` page, entirely gated behind an `existsSync`-driven `describe.skip` so the file is a clean no-op today and starts running for real automatically once plan 51-04 lands
- Confirmed the two required "green today" regression guards hold: `AnnotationMark.test.tsx`'s Voice Pass regression case and `Galley.test.tsx`'s "Review Desk default still marks both provenances" case
- Ran the full `pnpm --filter dispatch-control test` suite and confirmed the only failures are the 10 intentionally-red Wave 0 cases — zero pre-existing tests regressed

## Task Commits

1. **Task 1: Add the Pitfall-1 and Pitfall-2 cases to the three existing galley test files** - `6383b93` (test)
2. **Task 2: Create __tests__/SectionReaderPage.test.tsx with skip-guarded specs for the new page** - `9fb3f67` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `apps/dispatch-control/__tests__/AnnotationMark.test.tsx` - Added 3 describe blocks: Pitfall 2 accept-trigger regression, READ-02 Fact/Voice tag, READ-03/D-20 evidence card
- `apps/dispatch-control/__tests__/ClaimMark.test.tsx` - Added 1 describe block: Pitfall 1 phrasing-safe popover structural proxy + Source tag
- `apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx` - Added 1 describe block: `phrasingSafe` mode (2 cases)
- `apps/dispatch-control/__tests__/Galley.test.tsx` - Added 2 describe blocks: D-09 `markSourcedClaims`, and the real-pipeline D-09/D-20-independence case; added `fireEvent` to the existing RTL import
- `apps/dispatch-control/__tests__/SectionReaderPage.test.tsx` - New file, 18 specs, skip-guarded until plan 51-04

## Test Status: Green Today vs. Red Until a Later Plan

Per the execution notes, tests covering not-yet-built behavior are *supposed* to be red — that is the entire point of Wave 0. Below is the exact green/red state observed after this plan, and which plan turns each red case green.

### Green today (must stay green — regression guards)

| Test | File | Why it's already green |
|---|---|---|
| `Voice Pass regression: Accept rewrite label still offers Accept with no stored suggestedFix` | AnnotationMark.test.tsx | Documents Phase 36's existing string-matched `isRewriteVariant` behavior — proves 51-01's coming label-independent trigger doesn't need to (and must not) break this path |
| `neutral label without generateFixOnAccept keeps the Review Desk unavailable message` | AnnotationMark.test.tsx | Current behavior — neutral label + no stored fix + no `generateFixOnAccept` already shows the unavailable message |
| `no showAxisTag renders neither Fact nor Voice` | AnnotationMark.test.tsx | `showAxisTag` doesn't exist yet, so it's never rendered regardless |
| `renders no card when no claim is supplied` | AnnotationMark.test.tsx | Negative assertion — no claim prop exists yet, so no card renders either way (trivially true pre- and post-51-07) |
| `the evidence card inside the popover contains no block-level elements` | AnnotationMark.test.tsx | Negative assertion — no card renders yet, so there are no block elements to find (trivially true pre-51-07; 51-07 must additionally keep it green by using a phrasing-safe mount) |
| `Review Desk default still marks both provenances` | Galley.test.tsx | D-24 regression guard — `showProvenance` alone (no `markSourcedClaims`) already renders both provenance washes today |
| `default mode is unchanged` | ClaimProvenanceCard.test.tsx | Default (non-`phrasingSafe`) render already produces block markup |

### Red today — turns green in the named plan

| Test | File | Turns green in |
|---|---|---|
| `neutral label plus generateFixOnAccept still offers Accept with no stored suggestedFix` | AnnotationMark.test.tsx | 51-01 (Task 3 — label-independent `generateFixOnAccept` trigger) |
| `showAxisTag with a FACTUAL_AXES axis renders "Fact"` | AnnotationMark.test.tsx | 51-01 (Task 3 — Fact/Voice tag) |
| `showAxisTag with a VOICE_AXES axis renders "Voice"` | AnnotationMark.test.tsx | 51-01 |
| `showAxisTag with axis undefined renders "Fact" (conservative default)` | AnnotationMark.test.tsx | 51-01 |
| `renders the claim provenance card beneath the reason when the finding links to a claim` | AnnotationMark.test.tsx | 51-07 (evidence card mounted in the popover) |
| `the open claim popover contains no block-level elements` | ClaimMark.test.tsx | 51-01 (Task 2 — `phrasingSafe` `ClaimProvenanceCard` mount inside `ClaimMark`) |
| `Source tag renders for an unsourced claim only when showAxisTag is set` | ClaimMark.test.tsx | 51-01 |
| `phrasingSafe renders no div, p, h3, ul or li` | ClaimProvenanceCard.test.tsx | 51-01 (Task 2 — `phrasingSafe` prop) |
| `markSourcedClaims false renders no mark element for a sourced claim` | Galley.test.tsx | 51-01 (Task 3f — `markSourcedClaims` wired through `Galley`) |
| `D-09 suppresses the sourced wash while D-20 still surfaces its evidence in the finding popover` | Galley.test.tsx | 51-01 AND 51-07 both (this single test exercises both changes together through the real pipeline) |

### Skip-guarded — activates automatically in 51-04

All 18 specs in `SectionReaderPage.test.tsx` are currently `describe.skip`'d as a whole (the page they test does not exist). No individual red/green status applies — the whole file reports "18 skipped" and exits 0. Once `app/(editorial)/s/[section]/page.tsx` lands in plan 51-04, the `existsSync` guard flips and every spec runs for real with no edit to this file's guard logic required (though the fixture/interaction details inside each `it` may need adjustment to match the real page's actual DOM/props contract, since those details were not yet decided at Wave-0 time).

## Decisions Made

- **Dynamic import of the not-yet-existing page uses a non-literal specifier.** A literal `await import('../app/(editorial)/s/[section]/page')` hard-fails Vite's import-analysis transform (`Failed to resolve import ... Does the file exist?`) even when the containing code never executes (it's inside a `describe.skip`'d suite) — Vite statically resolves literal dynamic-import specifiers at transform time regardless of runtime reachability. Fixed by storing the specifier in a `const` and adding `/* @vite-ignore */`, which defers resolution to actual runtime execution (which never happens today).
- **`generateFixOnAccept`/`showAxisTag`/`claim`/`markSourcedClaims`/`showClaimEvidenceInFindings` are all passed as plain extra JSX props to components that don't destructure them yet.** Since Vitest doesn't type-check and React silently ignores unrecognized props on function components (rather than warning, since they're never spread onto a DOM node here), this is a safe, zero-crash way to write forward-looking assertions against props that land in 51-01/51-07.
- **`pitfall2Value` needed an explicit `suggestedFix: undefined` key**, not just an absent key — `renderMark`'s `{ ...value, ...overrides }` spread only overwrites keys *present* in `overrides`; an absent key silently lets the base fixture's `suggestedFix: 'State it plainly.'` leak through. Caught and fixed during self-verification (see Issues Encountered).
- **Deviated from a strict reading of "all red cases must fail"**: two AnnotationMark evidence-card cases and one D-09 Galley "Review Desk default" case are negative assertions that are trivially true before their feature exists. Rather than force artificial failure (which would misrepresent what the test actually checks), the SUMMARY documents this honestly per the execution notes' instruction to report accurately rather than weaken/force tests.

## Deviations from Plan

None requiring the Rule 1-4 process — this is Wave-0 test-only scaffolding with no production code touched, so there was nothing to auto-fix beyond the fixture bug described in Issues Encountered (a test-authoring correction, not a deviation from the plan's design).

## Issues Encountered

- **Fixture bug (self-caught, fixed before commit):** `pitfall2Value` in `AnnotationMark.test.tsx` initially omitted a `suggestedFix` key entirely (intending "no suggested fix"), but the shared `renderMark` helper's `{ ...value, ...overrides }` spread only overwrites keys present in the overrides object — an absent key doesn't clear the base fixture's `suggestedFix: 'State it plainly.'`. This caused two Pitfall-2 cases (`neutral label plus generateFixOnAccept...` and `neutral label without generateFixOnAccept...`) to assert against the wrong DOM state. Fixed by adding `suggestedFix: undefined` explicitly to the fixture, re-ran, and confirmed all three Pitfall-2 cases now report the expected green/red split (case 1 green, case 2 red-until-51-01, case 3 green).
- **Vite import-analysis hard-fail on the page's dynamic import** — see Decisions Made above; resolved with a non-literal specifier + `@vite-ignore`.

## User Setup Required

None - no external service configuration required.

## Requirements Note

This plan's frontmatter declares `requirements: [READ-01, READ-02, READ-03, READ-04, READ-05, READ-07]`, but `requirements mark-complete` was deliberately NOT run. REQUIREMENTS.md's traceability table shows every READ-* requirement mapped across plans 51-00 through 51-07, with plan 51-06 ("integration-gate-strict-build") redeclaring the full set as the phase's actual completion gate — the per-plan declarations here signal "contributes to," not "completes." Since this plan is pure test scaffolding (most new cases are intentionally red, and the page itself doesn't exist), checking these off now would contradict the project's own "never claim clean while still loading" discipline. Leave them unchecked until the plan(s) that make the underlying behavior real report them done.

## Next Phase Readiness

- Plan 51-01 (shared primitives: `phrasingSafe`, `generateFixOnAccept`, `showAxisTag`, `markSourcedClaims`) has 9 real automated verify commands waiting for it, all currently red for the correct reason.
- Plan 51-04 (the `/s/[section]` page itself) can build directly against `SectionReaderPage.test.tsx`'s `-t` filter names (`renders`, `nav`, `in-place edit`, `group accept`, `inspect`) — the whole file activates the moment the page file is created at the exact path this scaffold checks (`app/(editorial)/s/[section]/page.tsx`).
- Plan 51-07 (evidence in the finding popover) has 2 dedicated red cases in `AnnotationMark.test.tsx` plus the combined real-pipeline case in `Galley.test.tsx` that only that plan (together with 51-01) can turn fully green.
- No blockers. `git diff --name-only` for this plan's commits is scoped entirely to `apps/dispatch-control/__tests__/`.

---
*Phase: 51-section-read-and-fix-in-place*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/__tests__/SectionReaderPage.test.tsx
- FOUND: apps/dispatch-control/__tests__/AnnotationMark.test.tsx
- FOUND: apps/dispatch-control/__tests__/ClaimMark.test.tsx
- FOUND: apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx
- FOUND: apps/dispatch-control/__tests__/Galley.test.tsx
- FOUND: .planning/phases/51-section-read-and-fix-in-place/51-00-SUMMARY.md
- FOUND commit: 6383b93 (Task 1)
- FOUND commit: 9fb3f67 (Task 2)
