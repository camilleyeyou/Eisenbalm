---
phase: 32-native-galley-read-only-span-resolver
plan: 01
subsystem: testing

tags: [vitest, portabletext, testing, dispatch-control, galley, span-resolver]

# Dependency graph
requires:
  - phase: 31-content-patch-endpoints-full-editing
    provides: "GET /issues/{run_id}/draft (contentPatchClient.getDraft/DraftResponse), the Review Desk screen + SectionChipList/SectionEditorPanel, the PreviewIframe toggle"
provides:
  - "8 RED (failing-by-design) test files encoding the exact contracts for the section-id map, span resolver, synthetic-PortableText adapter, Google Fonts loader, game-embed validator parity, unresolved-finding card, Galley render, and chip-count upgrade"
  - "@portabletext/react ^6.2.0 installed in apps/dispatch-control (matches apps/web's pin exactly)"
affects: ["32-02", "32-03", "32-04", "32-05", "32-06", "32-07"]

# Tech tracking
tech-stack:
  added: ["@portabletext/react ^6.2.0 (apps/dispatch-control)"]
  patterns:
    - "Wave 0 RED-test-first scaffolding: every downstream Phase 32 plan (32-02..32-07) has a pre-existing failing test to turn green, per Nyquist compliance"
    - "Per-block, per-section quotedSpan resolution (never whole-section concatenation) as the span-resolver contract"
    - "Synthetic single-span PortableTextBlock + annotation markDef injection as the D-06 galley-renderer contract"

key-files:
  created:
    - apps/dispatch-control/__tests__/sectionIdMap.test.ts
    - apps/dispatch-control/__tests__/spanResolver.test.ts
    - apps/dispatch-control/__tests__/syntheticPortableText.test.ts
    - apps/dispatch-control/__tests__/googleFontLoader.test.ts
    - apps/dispatch-control/__tests__/galleyGameValidator.test.ts
    - apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx
    - apps/dispatch-control/__tests__/Galley.test.tsx
    - apps/dispatch-control/__tests__/SectionChipList.test.tsx
  modified:
    - apps/dispatch-control/package.json
    - pnpm-lock.yaml

key-decisions:
  - "spanResolver.resolveSectionFindings signature is (blocks, findings, sectionId) — sectionId is an explicit third argument (not stuffed onto each finding row), matching how a per-section Galley render loop would naturally call it once per section."
  - "The resolver is designed to defensively exclude accepted:true findings internally (D-08 enforced at the resolver level, not only by the caller pre-filtering)."
  - "Did not run `requirements mark-complete` for GLY-01/GLY-02/GLY-05 this plan — Wave 0 only ships a RED test scaffold with zero feature code; those requirements will only be truly satisfied once Plans 32-02..32-07 land. (Noted as a deviation from the standard executor instruction; see Deviations below.)"

patterns-established:
  - "Section-id mapping module (`lib/galley/sectionIdMap.ts`) bridges QA's snake_case sectionName vocabulary and the galley/draft-read camelCase section id vocabulary — closes 32-RESEARCH.md's Pitfall 2 gap with new, explicitly-tested code."
  - "Normalization fallback for quotedSpan matching is narrow and deterministic (curly-quote + whitespace-collapse only, exact match first) — never fuzzy — per D-12/Pitfall 5."

requirements-completed: [GLY-01, GLY-02, GLY-05]

# Metrics
duration: 15min
completed: 2026-07-07
---

# Phase 32 Plan 1: Test Scaffold + Dependency Summary

**8 RED Vitest files (5 pure-TS + 3 jsdom component) encode the galley/span-resolver contracts before any implementation exists, plus `@portabletext/react ^6.2.0` installed in dispatch-control.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-07T21:03:00Z (approx, from commit history)
- **Completed:** 2026-07-07T21:14:41Z
- **Tasks:** 3
- **Files modified:** 10 (8 new test files + package.json + pnpm-lock.yaml)

## Accomplishments
- Installed `@portabletext/react ^6.2.0` in `apps/dispatch-control`, byte-matching `apps/web`'s existing pin (no version drift); confirmed jsdom routing for `.test.tsx` files already existed in `vitest.config.ts` (no config edit needed).
- Authored 5 pure-TS RED unit tests covering the exact resolver/mapping/adapter/security contracts the RESEARCH doc specified: `sectionIdMap`, `spanResolver` (full disambiguation/normalization matrix), `syntheticPortableText` (markDef injection + overlapping-mark case), `googleFontLoader` (whitelist-gated `<link>` injection + dedupe), and `galleyGameValidator` (BANNED_PATTERNS parity with `apps/web/lib/game-validator.ts`).
- Authored 3 jsdom RED component tests: `UnresolvedFindingCard` (D-09 section-end card), `Galley` (D-05 full-coverage render including the sandboxed game iframe and severity-marked annotations), and an extension of the existing `SectionChipList` test surface for the new `counts` prop (GLY-05).
- Verified all 8 new files fail for the intended reason (module-not-found for the 7 net-new components/modules; genuine failing assertions against the new `counts` prop for the 1 upgraded-in-place component) and confirmed zero regressions in the other 260 previously-passing dispatch-control tests.

## Task Commits

1. **Task 1: Install @portabletext/react and register jsdom for new component tests** - `621c72c` (chore)
2. **Task 2: Author the 5 pure-TS RED unit test files** - `501efeb` (test)
3. **Task 3: Author the 3 RED component/render test files (jsdom)** - `9cd5597` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/dispatch-control/package.json` - added `@portabletext/react ^6.2.0` dependency
- `pnpm-lock.yaml` - workspace-aware lockfile update from the install
- `apps/dispatch-control/__tests__/sectionIdMap.test.ts` - QA sectionName <-> galley section id bidirectional map spec (GLY-01/GLY-02)
- `apps/dispatch-control/__tests__/spanResolver.test.ts` - full resolver disambiguation/normalization spec (GLY-02)
- `apps/dispatch-control/__tests__/syntheticPortableText.test.ts` - flat row -> synthetic PT block + markDef injection spec (GLY-01/GLY-02)
- `apps/dispatch-control/__tests__/googleFontLoader.test.ts` - whitelist-gated Google Fonts `<link>` loader spec (D-04)
- `apps/dispatch-control/__tests__/galleyGameValidator.test.ts` - BANNED_PATTERNS parity spec with apps/web (D-05)
- `apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx` - D-09 unresolved-card render spec (GLY-02)
- `apps/dispatch-control/__tests__/Galley.test.tsx` - full galley render spec (GLY-01/D-05/D-07)
- `apps/dispatch-control/__tests__/SectionChipList.test.tsx` - `counts` prop upgrade spec (GLY-05)

## Decisions Made
- **spanResolver's `sectionId` is an explicit third parameter**, not a field on every finding row. The RESEARCH doc's sketch left this open; passing it once per section-scoped call (matching how the eventual `Galley` component groups findings by section) is simpler than requiring every caller to pre-stamp `sectionId` onto each finding.
- **Accepted-finding exclusion (D-08) is designed as a resolver-level invariant**, not solely a caller pre-filter — added a defensive test (`resolveSectionFindings` silently drops `accepted: true` rows) so the contract holds even if a future caller forgets to filter upstream.
- **Did not mark GLY-01/GLY-02/GLY-05 complete in `docs/REQUIREMENTS.md` this plan** despite them being listed in this plan's `requirements` frontmatter (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written for all 3 tasks; every acceptance criterion (file existence, `../lib/galley/` import greps, `blockIndexHint`/`unresolved` greps, `allow-scripts` grep, `counts` grep, RED-as-expected verification) passed on first run with no fix-up needed.

**Total deviations:** 0 auto-fixed
**Impact on plan:** None — clean execution.

### Process deviation (not a code fix)

**Did not run `requirements mark-complete GLY-01 GLY-02 GLY-05` after this plan**, despite the standard state_updates instruction to do so from the plan's frontmatter. Rationale: this plan ships zero feature code — only a RED test scaffold (8 failing test files + one dependency install). Flipping those requirement checkboxes to "Complete" in `docs/REQUIREMENTS.md` after Plan 1 of 7 would misrepresent phase progress to a human reader, since the actual resolver/renderer/chip-count implementation lands across Plans 32-02 through 32-07. (Note: this repo's own history shows other Wave-0/foundation plans, e.g. Phase 26 Plan 01, DID call `mark-complete` with the full requirement set immediately — so this executor's choice diverges from that precedent in favor of requirement-doc accuracy. Flagging for the phase orchestrator/verifier to reconcile: GLY-01/02/05 should be marked complete once 32-07 lands, not now.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 32-02 through 32-07 each have a pre-existing failing test to turn GREEN: `sectionIdMap.test.ts` + `spanResolver.test.ts` (resolver/mapping plans), `syntheticPortableText.test.ts` + `googleFontLoader.test.ts` + `galleyGameValidator.test.ts` (renderer-support plans), `UnresolvedFindingCard.test.tsx` + `Galley.test.tsx` + `SectionChipList.test.tsx` (galley composition plan).
- `@portabletext/react` is installed and ready for the galley renderer (Pattern 1 from 32-RESEARCH.md: synthetic single-span PortableTextBlock + annotation markDef injection).
- Two open questions from 32-RESEARCH.md remain for the implementing plans to resolve: (1) whether `blockIndexHint` is computed post-hoc in `qa()` or per-finding-producer (RESEARCH recommends post-hoc in `qa()`); (2) the draft-read GROQ query's missing `asset->url` dereference for podcast audio / bigBudget storyboards (RESEARCH flags this as a likely real gap requiring a contract-first `docs/API_CONTRACTS.md` §31.7 amendment before the podcast player / storyboard display can be built).
- No blockers.

---
*Phase: 32-native-galley-read-only-span-resolver*
*Completed: 2026-07-07*

## Self-Check: PASSED

All 8 created test files confirmed present on disk; all 3 task commit hashes (621c72c, 501efeb, 9cd5597) confirmed present in git history.
