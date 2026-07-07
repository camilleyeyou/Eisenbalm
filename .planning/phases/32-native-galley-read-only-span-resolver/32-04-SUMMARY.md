---
phase: 32-native-galley-read-only-span-resolver
plan: 04
subsystem: ui
tags: [portabletext, dom, security, galley, review-desk, sandbox]

# Dependency graph
requires:
  - phase: 32-01
    provides: RED unit test scaffold for syntheticPortableText, googleFontLoader, galleyGameValidator
provides:
  - toSyntheticBlocks(rows, annotations, sectionId) — flat draft rows + resolved annotations -> annotate-able PortableTextBlock[] with per-instance markDefs
  - ensureThemeFont(fontName) / applyThemeAccent(accent, el) — whitelist-validated, deduped, setProperty-only theme injection for the galley
  - validateEmbedCode / injectGameHead / BANNED_PATTERNS / GAME_CSP_POLICY — galley-local duplicate of the reader site's game-embed sandbox validator (parity maintained)
affects: [32-05-annotation-primitives, 32-06-galley-assembly, 32-07-chip-counts-and-page-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Breakpoint-slicing algorithm for synthesizing PortableText spans from flat text + interval annotations (sorted union of {0, starts, ends, length}, marks computed per-run by interval coverage)"
    - "Cross-app decoupling via verbatim duplication (D-06) — dispatch-control galley never imports from apps/web; security-critical modules (font whitelist, hex validation, game-embed deny-list) are copied, not shared, with KEEP-IN-SYNC docstring notes"

key-files:
  created:
    - apps/dispatch-control/lib/galley/syntheticPortableText.ts
    - apps/dispatch-control/lib/galley/googleFontLoader.ts
    - apps/dispatch-control/lib/galley/galleyGameValidator.ts
  modified: []

key-decisions:
  - "ResolvedAnnotation type declared locally in syntheticPortableText.ts (not imported from the sibling spanResolver.ts module built by parallel Plan 32-03) to keep this plan's three modules fully self-contained and avoid a hard file-existence dependency between concurrently-executing plans in the same wave; the local shape mirrors 32-03's documented ResolvedAnnotation field-for-field (findingId, blockIndex, start, end, severity, axis?, reason, suggestedFix?, quotedSpan?)."
  - "Avoided the literal substring \"apps/web\" anywhere in the two duplicated security modules' source (comments included), per each module's own acceptance criterion (grep -c \"apps/web\" == 0); KEEP-IN-SYNC intent is preserved by referring to \"the reader site\"/\"the reader app\" in prose instead of the literal path."

patterns-established:
  - "Pattern 1: Breakpoint-slicing description above — reusable for any future flat-text + interval-annotation rendering need."

requirements-completed: [GLY-01]

# Metrics
duration: 6min
completed: 2026-07-07
---

# Phase 32 Plan 04: Render Helpers Summary

**Three pure render-helper modules for the native galley — synthetic PortableText span synthesis with markDef injection, a whitelist-validated dynamic Google Fonts loader, and a duplicated (parity-proven) game-embed sandbox validator — all TDD'd green against the Plan 32-01 RED specs.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-07T21:26:00Z (approx, from prior commit `2e807ef`)
- **Completed:** 2026-07-07T21:28:08Z
- **Tasks:** 3
- **Files modified:** 3 (all new)

## Accomplishments
- `toSyntheticBlocks` converts flat `{type,text}` draft rows into synthetic PortableText blocks, injecting one `_type:'annotation'` markDef per resolved finding and slicing `children` spans at every annotation boundary — overlapping annotations correctly stack both markDef keys on the shared run
- `ensureThemeFont` validates a theme's font name against a duplicated 9-entry `FONT_WHITELIST` before injecting a deduped `<link>` Google Fonts tag; `applyThemeAccent` validates a 6-digit hex before the only permitted DOM mutation (`setProperty`)
- `galleyGameValidator.ts` duplicates the reader site's 131-line game-validator verbatim (14 banned patterns, CSP head injection) so the galley's sandboxed game preview gets identical defence-in-depth before Plan 32-06 mounts the iframe

## Task Commits

Each task was committed atomically:

1. **Task 1: syntheticPortableText.ts — flat row + annotations → PT block with markDef injection** - `faa675d` (feat)
2. **Task 2: googleFontLoader.ts — whitelist-validated dynamic font `<link>` injection** - `014a765` (feat)
3. **Task 3: galleyGameValidator.ts — duplicated embed-code validator (parity with apps/web)** - `a4bbc2e` (feat)

_No TDD RED/GREEN split commits — the RED tests already existed from Plan 32-01; each task here is a single GREEN-producing commit._

## Files Created/Modified
- `apps/dispatch-control/lib/galley/syntheticPortableText.ts` - `toSyntheticBlocks(rows, annotations, sectionId)`; local `ResolvedAnnotation`/`SyntheticRow`/`PortableTextSpan`/`AnnotationMarkDef`/`SyntheticPortableTextBlock` types
- `apps/dispatch-control/lib/galley/googleFontLoader.ts` - `FONT_WHITELIST`, `HEX_REGEX`, `validateFont`, `validateHex`, `ensureThemeFont`, `applyThemeAccent`
- `apps/dispatch-control/lib/galley/galleyGameValidator.ts` - `BANNED_PATTERNS`, `ValidationResult`, `validateEmbedCode`, `GAME_CSP_POLICY`, `GAME_HEAD`, `injectGameHead`

## Decisions Made
- Declared `ResolvedAnnotation` locally in `syntheticPortableText.ts` rather than importing it from the sibling `spanResolver.ts` module (built by the concurrently-executing Plan 32-03), to avoid a file-existence race between parallel wave-1 plans. The local shape is field-for-field identical to 32-03's documented `ResolvedAnnotation`, so no adapter is needed once both modules are composed together in Plan 32-06.
- In both duplicated security modules, referred to the reader site generically in prose ("the reader site's theme module", "the reader app") instead of writing the literal path `apps/web`, satisfying each module's own "zero apps/web references" acceptance grep while preserving the KEEP-IN-SYNC intent from the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed `noUncheckedIndexedAccess` TypeScript errors in the breakpoint-slicing loop**
- **Found during:** Task 1 (syntheticPortableText.ts) — post-implementation `tsc --noEmit` check
- **Issue:** `sorted[i]`, `sorted[i+1]`, and `markDefs[idx]` are typed `T | undefined` under the project's `noUncheckedIndexedAccess` strict flag, even though the loop bounds guarantee they are always defined; `tsc` reported 5 errors (`TS18048`/`TS2532`).
- **Fix:** Added explicit `as number` / `as AnnotationMarkDef` assertions at the three index sites, since the surrounding loop invariants (`i < sorted.length - 1`, `idx` sourced from the same-length `anns`/`markDefs` arrays) make the underlying values provably defined.
- **Files modified:** `apps/dispatch-control/lib/galley/syntheticPortableText.ts`
- **Verification:** `./node_modules/.bin/tsc --noEmit -p tsconfig.json` shows zero errors attributable to the three galley files created in this plan (pre-existing unrelated errors, e.g. a missing `Galley.tsx` component from a not-yet-executed sibling plan, are out of scope per the SCOPE BOUNDARY rule).
- **Committed in:** `faa675d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for build-clean TypeScript compilation under this project's strict indexed-access setting. No scope creep — logic and test behavior unchanged.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three render helpers exist, are pure/duplicated (no apps/web coupling), and pass their unit specs (19/19 green across the three test files).
- Plan 32-05 (annotation primitives / `Galley.tsx` component) can now import `toSyntheticBlocks`, `ensureThemeFont`/`applyThemeAccent`, and `validateEmbedCode`/`injectGameHead` directly.
- Once Plan 32-03's `spanResolver.ts` is composed in Plan 32-06, the caller there is responsible for mapping `spanResolver.ts`'s `ResolvedAnnotation` (same field shape) into the array this module expects — no adapter code needed, but worth a quick type-shape sanity check at that integration point since the two files declare the interface independently.

---
*Phase: 32-native-galley-read-only-span-resolver*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/galley/syntheticPortableText.ts
- FOUND: apps/dispatch-control/lib/galley/googleFontLoader.ts
- FOUND: apps/dispatch-control/lib/galley/galleyGameValidator.ts
- FOUND: faa675d
- FOUND: 014a765
- FOUND: a4bbc2e
