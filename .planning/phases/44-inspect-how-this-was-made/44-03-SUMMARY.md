---
phase: 44-inspect-how-this-was-made
plan: 03
subsystem: ui
tags: [typescript, resolver, convex, inspector, dispatch-control]

# Dependency graph
requires:
  - phase: 44-01
    provides: "InspectorArtifactKey/ResolvedStep contract shapes (§44.1/§44.3) and the Wave-0 inspectorArtifact.test.ts scaffold this plan fills in"
provides:
  - "lib/inspectorArtifact.ts — the pure artifact->step resolver (resolveInspectorStep, runKeyToPromptKey, encodeArtifactKey, parseArtifactKey)"
  - "Live vitest coverage (13 assertions) proving the resolver's editor_gate_1/editor_gate1 alias, bonus-variant selection, non-externalized promptKey nulling, and signal/org degrade behavior"
affects: [44-04, 44-05, 44-06, 44-inspect-how-this-was-made]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure selector module (no Convex hooks) that reuses an existing bidirectional lookup table (sectionIdMap.ts) instead of building a second one"
    - "Explicit single-alias reconciliation function (runKeyToPromptKey) for a two-namespace split, rather than assuming string equality anywhere else"

key-files:
  created:
    - apps/dispatch-control/lib/inspectorArtifact.ts
  modified:
    - apps/dispatch-control/__tests__/inspectorArtifact.test.ts

key-decisions:
  - "parseArtifactKey returns InspectorArtifactKey | null (never throws) on malformed input, following docs/API_CONTRACTS.md §44.1 verbatim — the PLAN.md task prose said 'throw a clear error on an unknown type,' which contradicts the binding contract; the contract's null-return, non-throwing signature was implemented as the authoritative spec (CLAUDE.md: API_CONTRACTS.md governs interface shapes; the phase's own §44 preamble states plans implement its shapes 'verbatim')"
  - "org resolves to agentKey 'scout' with degraded:false (not degraded) since Scout runs on every issue today; only 'signal' is unconditionally degraded (no Signal Editor step exists until Phase 46) — matches API_CONTRACTS.md §44.3's resolution table exactly, correcting CONTEXT.md D-03's more general 'signal and org both degrade' framing"

patterns-established:
  - "Two-namespace key aliasing lives in exactly one function (runKeyToPromptKey); no other code may assume editor_gate_1 == editor_gate1"

requirements-completed: [INS-01, INS-04]

# Metrics
duration: ~15min
completed: 2026-07-15
---

# Phase 44 Plan 03: Pure Artifact-to-Step Resolver Summary

**Built `lib/inspectorArtifact.ts`, the single pure resolver mapping any of the six InspectorArtifactKey types to their `agent_runs` agentKey + `prompt_versions` promptKey, reusing the existing `sectionIdMap.ts` bridge and owning the one `editor_gate_1`/`editor_gate1` alias.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-15 (approx, not explicitly timestamped at session start)
- **Completed:** 2026-07-15T19:58:36Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `resolveInspectorStep` correctly resolves all six artifact types (`founder`, `claim`, `rec`, `qa`, `org`, `signal`) to their `agentKey`/`promptKey`/`degraded` triple, per §44.3's exact resolution table
- `founder` resolution reuses `galleyIdToQaSection` from the existing `sectionIdMap.ts` — no second lookup table built — and tolerates either the galley camelCase locator or the run-vocabulary snake_case locator, degrading honestly (never throwing) for an unresolvable locator
- `runKeyToPromptKey` is the single explicit `editor_gate_1 -> editor_gate1` alias in the codebase, plus the bonus-variant selector (`bigBudget`/`jingle`/`specAd` → `bonus_big_budget`/`bonus_jingle`/`bonus_spec_ad`) and the 5-agent non-externalized `promptKey === null` set
- `encodeArtifactKey`/`parseArtifactKey` round-trip exactly, including an empty locator and a locator containing embedded `:` characters, splitting only on the first two colons
- All 8 Wave-0 `it.todo` scaffold cases converted to live, passing assertions plus 5 additional edge-case tests (13 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the resolver + namespace helpers + artifact-key encoding** - `8089aec` (feat)
2. **Task 2: Convert inspectorArtifact.test.ts todos into live assertions** - `e8fbca2` (test)

## Files Created/Modified

- `apps/dispatch-control/lib/inspectorArtifact.ts` - pure resolver: `resolveInspectorStep`, `runKeyToPromptKey`, `encodeArtifactKey`, `parseArtifactKey`; imports only `galleyIdToQaSection` from `./galley/sectionIdMap`, no Convex/React import
- `apps/dispatch-control/__tests__/inspectorArtifact.test.ts` - 13 live assertions replacing the 8 Wave-0 `it.todo` cases

## Decisions Made

- **`parseArtifactKey` never throws.** The PLAN.md task prose describes throwing "a clear error on an unknown type," but `docs/API_CONTRACTS.md` §44.1 (the binding, contract-first spec this plan's own `<read_first>` points to) specifies `parseArtifactKey(s: string): InspectorArtifactKey | null` returning `null` on malformed input (missing colon or unknown type), never throwing. Implemented per the contract, since §44's preamble states downstream plans implement its shapes "verbatim" and CLAUDE.md directs API_CONTRACTS.md to govern interface shapes. Documented here as a Rule 1 (bug/inconsistency) auto-fix rather than silently picking one reading.
- **`org` is not degraded; only `signal` is.** Confirmed against §44.3's literal resolution table (`org` → `{agentKey: 'scout', promptKey: 'scout', degraded: false}`, `signal` → `{agentKey: 'signal_editor', promptKey: 'signal_editor', degraded: true}`), which itself corrects CONTEXT.md D-03's broader "signal and org both degrade" framing per 44-RESEARCH.md's "State of the Art" finding (the org/brief-card entry point is live today via Scout's real pitch data, unblocked by Phase 46/47).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed the literal substring "convex/react" from a doc comment so the acceptance-criteria grep passes correctly**
- **Found during:** Task 1 (Build the resolver)
- **Issue:** The module's header docstring explained the module is pure by literally writing the words "`convex/react` import" — this is prose describing the absence of an import, but the plan's own acceptance criteria uses a naive string grep (`grep -q "convex/react" ... exits 1`) that cannot distinguish prose from a real import statement, so the check would have falsely failed.
- **Fix:** Reworded the comment to "Convex React hooks" (no literal `convex/react` substring) while preserving the same meaning.
- **Files modified:** `apps/dispatch-control/lib/inspectorArtifact.ts`
- **Verification:** `grep -q "convex/react" apps/dispatch-control/lib/inspectorArtifact.ts` now exits 1, as the acceptance criteria requires.
- **Committed in:** `8089aec` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/inconsistency), plus 2 judgment calls documented above under Decisions Made (parseArtifactKey throwing behavior, org/signal degrade asymmetry) resolved in favor of the binding `docs/API_CONTRACTS.md` §44 contract over PLAN.md's own prose where the two diverged.
**Impact on plan:** All resolved in favor of the project's own stated source of truth (API_CONTRACTS.md §44, explicitly "verbatim"-binding per its own preamble). No scope creep; no behavior added beyond what §44.3 specifies.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/inspectorArtifact.ts` is ready for Plan 44-06 (the panel container) to import `resolveInspectorStep`/`runKeyToPromptKey` alongside its own Convex queries — the resolver itself performs zero fetching, exactly as D-01/D-09 require.
- `encodeArtifactKey`/`parseArtifactKey` are ready for the six entry-point wirings (44-05/44-07+) and for `DerivedTask.insp` (43-CONTEXT.md) to carry the string-encoded form.
- No blockers. `pnpm --filter dispatch-control test` (92 files / 799 assertions passing, 21 todo in other not-yet-built Wave-0 scaffolds for later 44-xx plans) and `pnpm --filter dispatch-control build` both green.

---
*Phase: 44-inspect-how-this-was-made*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/inspectorArtifact.ts
- FOUND: apps/dispatch-control/__tests__/inspectorArtifact.test.ts
- FOUND: 8089aec (Task 1 commit)
- FOUND: e8fbca2 (Task 2 commit)
