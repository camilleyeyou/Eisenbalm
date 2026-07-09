---
phase: 36-voice-pass-de-slop-screen
plan: 01
subsystem: api
tags: [convex, contract-first, qa-corrections, voice-pass, schema]

# Dependency graph
requires:
  - phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
    provides: sign_offs table + POST /issues/{run_id}/sign-off with kind-branching (facts-cleared ungated sounds-human placeholder)
  - phase: 33-accept-fix-wiring-decision-rail
    provides: api/findings.py accept/dismiss/reopen endpoints + _AcceptBody shape this plan extends
  - phase: 18-magazine-editorial-layout-writers
    provides: JudgeFinding.axis Literal including structural-variety (never round-tripped through Convex until this plan)
provides:
  - docs/API_CONTRACTS.md §36 (§36.1-§36.7) — the full Voice Pass contract every downstream 36-0x plan implements verbatim
  - convex/schema.ts + convex/qaCorrections.ts axis union gains machine-tell + structural-variety literals
  - apps/dispatch-control/__tests__/voicePassAxis.test.ts — Convex-mutation-level regression guard for the closed-union silent-drop failure
affects: [36-02-pipeline-axis-foundations, 36-03-voice-pass-endpoints, 36-04-voice-pass-screen, 36-05-machine-tell-predicate, 36-06-rewrite-popover-signoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first gate: docs/API_CONTRACTS.md §36 written before any Phase 36 code, mirroring §31-§35's ADD/REMOVE-relative-to-current-file style"
    - "Convex closed-union axis literal additions always land in the SAME commit as the regression test proving the mutation round-trips (not just a Python Literal check) — closes the exact silent-drop failure mode that let structural-variety go unnoticed since Phase 18"

key-files:
  created:
    - apps/dispatch-control/__tests__/voicePassAxis.test.ts
  modified:
    - docs/API_CONTRACTS.md
    - convex/schema.ts
    - convex/qaCorrections.ts

key-decisions:
  - "Added structural-variety alongside machine-tell in the same Convex union widening — closes a pre-existing Phase 18 gap opportunistically (JudgeFinding.axis already emitted it Python-side; Convex silently dropped it) since the fix is a one-line addition in the same commit"
  - "§36.2 (Layer-1 axis passthrough) and §36.7 (facts-cleared narrowing) were written into the contract per Research Pitfall 2/3/5 guidance even though this plan's own code changes only touch the Convex validators — later plans (36-02, 36-something for signoffs) implement those contract clauses"

requirements-completed: [VOX-01, VOX-04]

# Metrics
duration: ~10min
completed: 2026-07-09
---

# Phase 36 Plan 01: Contract-First Gate + Convex machine-tell Axis Summary

**Wrote the full §36 Voice Pass contract (7 subsections) into docs/API_CONTRACTS.md and closed the closed-union silent-drop gap by adding `machine-tell` + `structural-variety` to both Convex axis validators, proven by a mutation-level regression test.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified for code; +1 docs file)

## Accomplishments
- `docs/API_CONTRACTS.md` §36 now declares every shape the rest of Phase 36 implements: the machine-tell axis literal, the Layer-1 axis passthrough (stopping the hard-rule collapse), the VOICE_AXES/FACTUAL_AXES partition, the `POST /voice-recheck` and `POST /voice-rewrite` endpoint flows (including the qa-recheck dedup-supersede mechanism), `_AcceptBody.suggestedFixOverride`, and the sounds-human sign-off prerequisite (with the required facts-cleared narrowing)
- `convex/schema.ts`'s `qaCorrections` table and `convex/qaCorrections.ts`'s `insert` mutation both accept `axis: "machine-tell"` and `axis: "structural-variety"` — proven at the real Convex mutation boundary via `convex-test`, not just a Python-side unit test
- Closed a live, pre-existing gap: `structural-variety` (a valid Python `JudgeFinding.axis` value since Phase 18 MEL-04) had never once round-tripped through Convex; it now does, in the same commit as the new literal, per Research Pitfall 1's explicit warning against repeating that exact mistake

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend docs/API_CONTRACTS.md with §36 Voice Pass contract** - `4b30bb3` (docs)
2. **Task 2: Add machine-tell axis literal to both Convex validators + regression test** - `a206bbe` (test, RED) + `4bfa1fe` (feat, GREEN)

**Plan metadata:** (this commit) - docs: complete plan

_TDD task 2 produced two commits per the RED→GREEN protocol: the failing test first, then the schema/mutation change that turns it green._

## Files Created/Modified
- `docs/API_CONTRACTS.md` - New §36 section (§36.1-§36.7): machine-tell axis, Layer-1 passthrough, axis partition, voice-recheck/voice-rewrite endpoints, suggestedFixOverride, sign-off prerequisite partition
- `convex/schema.ts` - `qaCorrections.axis` union gains `machine-tell` + `structural-variety` literals
- `convex/qaCorrections.ts` - `insert` mutation's `axis` union gains the identical two literals (kept in lockstep with the table validator)
- `apps/dispatch-control/__tests__/voicePassAxis.test.ts` - Three-case regression test: `machine-tell` succeeds + round-trips, `structural-variety` succeeds + round-trips, an unrecognized axis still rejects (union stays closed)

## Decisions Made
- Widened the axis union to include `structural-variety` in the same change as `machine-tell`, even though only the latter is a Phase 36 requirement — the fix is a one-line addition, the failure mode (silent drop via `convex_mutation_safe`) is identical, and Research Pitfall 1 explicitly calls out this exact gap as something the new literal must not repeat
- Wrote §36.2 (Layer-1 axis passthrough removal) and §36.7 (facts-cleared narrowing + sounds-human gate) into the contract in full even though this plan's code changes are scoped to the Convex validators only — per CLAUDE.md's contract-first hard rule, the entire Phase 36 shape must exist in the contract before ANY downstream plan starts implementing endpoints/orchestrator changes, not just the shapes this specific plan's tasks touch

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>`/`<acceptance_criteria>`/`<verify>` blocks with no auto-fixes required.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Convex schema/mutation changes are additive and take effect on the next `convex dev`/`convex deploy` for the live deployment; no manual dashboard step needed.

## Next Phase Readiness

- `docs/API_CONTRACTS.md` §36 gives Plans 36-02 (pipeline axis foundations), 36-03 (voice-pass endpoints), 36-04 (voice-pass screen), 36-05 (machine-tell predicate), and 36-06 (rewrite popover + sign-off) their full, unambiguous implementation contract — no shape needs to be invented downstream.
- The Convex axis union now accepts `machine-tell` end-to-end; Plan 36-05's new `rules.py` predicate can write `axis="machine-tell"` findings that will actually persist (previously would have silently vanished).
- No blockers. Full `apps/dispatch-control` vitest suite (394 passed, 2 todo, 46 files) and `pnpm --filter dispatch-control build` (strict type-check) both green after this plan's changes — no regression.

---
*Phase: 36-voice-pass-de-slop-screen*
*Completed: 2026-07-09*

## Self-Check: PASSED

All claimed files exist on disk (`docs/API_CONTRACTS.md`, `convex/schema.ts`,
`convex/qaCorrections.ts`, `apps/dispatch-control/__tests__/voicePassAxis.test.ts`,
this SUMMARY.md). All claimed commit hashes (`4b30bb3`, `a206bbe`, `4bfa1fe`) are
present in `git log --oneline --all`.
