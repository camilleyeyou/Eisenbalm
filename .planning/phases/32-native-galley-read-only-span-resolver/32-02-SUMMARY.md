---
phase: 32-native-galley-read-only-span-resolver
plan: 02
subsystem: api
tags: [convex, sanity, groq, pipeline, qa, python, typescript]

# Dependency graph
requires:
  - phase: 32-01
    provides: test scaffold + dependency setup for the galley span-resolver work
provides:
  - _DRAFT_GROQ dereferences podcast.audioUrl and bonus.storyboards[].asset.url so
    draft-read is a complete galley data source (no second fetch needed)
  - Convex qaCorrections.blockIndexHint optional field (schema + insert mutation)
  - QA agent computes and records a non-authoritative blockIndexHint per finding
affects: [32-03, 32-04, span-resolver, galley-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first: docs/API_CONTRACTS.md amended before schema/endpoint code (CLAUDE.md hard rule)"
    - "Non-authoritative resolver hints: server records a best-effort hint, client always falls back to full search on mismatch/absence"

key-files:
  created:
    - packages/pipeline/tests/agents/qa/test_block_index_hint.py
  modified:
    - docs/API_CONTRACTS.md
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
    - convex/schema.ts
    - convex/qaCorrections.ts
    - convex/_generated/api.d.ts
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py

key-decisions:
  - "Locked the RESEARCH-recommended post-hoc blockIndexHint computation inside qa() (zero changes to rules.py/judge.py/rubric.md or the LLM judge output schema)"
  - "blockIndexHint is only added to the Convex mutation payload when a unique block match is found — ambiguous or absent matches omit the key entirely rather than recording a guess"
  - "Convex codegen also picked up a pre-existing, unrelated lib/auth.ts module-listing drift in api.d.ts; committed alongside since it's a byproduct of the required codegen run"

patterns-established:
  - "Resolver hint contract: optional server-computed hints must degrade gracefully — legacy rows without the field, and any stale/wrong hint, must still resolve correctly"

requirements-completed: [GLY-01, GLY-02]

# Metrics
duration: 7min
completed: 2026-07-07
---

# Phase 32 Plan 02: BlockIndexHint and Asset URLs Summary

**Draft-read now dereferences podcast/storyboard Sanity asset URLs, and QA runs record an optional, non-authoritative blockIndexHint per finding — both amended in API_CONTRACTS.md before the code changed.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-07T21:21:00Z (approx, first commit 14:21:25 -0700)
- **Completed:** 2026-07-07T21:27:33Z (approx, last commit 14:27:33 -0700)
- **Tasks:** 3
- **Files modified:** 6 (+1 created)

## Accomplishments
- `_DRAFT_GROQ` now projects `podcast.audioUrl` (dereferenced `audioFile.asset->url`) and `bonus.storyboards[].asset.url`, mirroring the existing `apps/web/lib/sanity/queries.ts` pattern — the galley can render `<audio>`/`<img>` directly from draft-read
- Convex `qaCorrections` gained an optional `blockIndexHint: v.optional(v.number())` field on both the schema and the `insert` mutation, flowing through the existing `...args` spread with no handler-logic change
- QA agent (`agents/qa/__init__.py::qa()`) computes a unique-substring block ordinal per finding and records it only when exactly one block matches — ambiguous or absent matches record no hint (never guess)
- Every change was documented in `docs/API_CONTRACTS.md` (§31.7 addendum + new §32.1) BEFORE the corresponding code edit, per CLAUDE.md's contract-first hard rule

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend API_CONTRACTS §31.7 + `_DRAFT_GROQ` for asset URLs** - `f1b576b` (feat)
2. **Task 2: Add blockIndexHint to Convex qaCorrections (schema + insert) + document in contract** - `5865d60` (feat)
3. **Task 3: QA agent computes + records blockIndexHint per finding** - `d05dd07` (feat)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP updates follow in the final commit._

## Files Created/Modified
- `docs/API_CONTRACTS.md` - §31.7 addendum documenting additive `podcast.audioUrl` / `bonus.storyboards[].asset.url`; new §32.1 documenting `blockIndexHint` as a non-authoritative resolver hint
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` - `_DRAFT_GROQ` now dereferences podcast audio + storyboard asset URLs
- `convex/schema.ts` - `qaCorrections.blockIndexHint: v.optional(v.number())`
- `convex/qaCorrections.ts` - `insert` mutation args accept `blockIndexHint`
- `convex/_generated/api.d.ts` - regenerated via `pnpm --filter @eisenbalm/convex codegen`
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` - `_SECTION_STATE_FIELD` map + `_block_index_hint()` helper; write loop conditionally adds `blockIndexHint` to the mutation payload
- `packages/pipeline/tests/agents/qa/test_block_index_hint.py` - new unit tests (unique match, no match, ambiguous match, game section, unknown section, empty quotedSpan)

## Decisions Made
- Post-hoc computation in `qa()` locked over any judge/rules.py change (RESEARCH-recommended; keeps LLM judge schema and cost profile unchanged)
- `blockIndexHint` omitted from payload (not sent as `null`) when no unique match exists, keeping payloads clean and Convex-optional-field semantics natural
- Regenerated `convex/_generated/api.d.ts` committed as part of Task 2, including an incidental pre-existing `lib/auth.ts` module-listing fix surfaced by the same codegen run (out-of-scope drift, but a direct byproduct of running the required tool — not separately "fixed")

## Deviations from Plan

None - plan executed exactly as written. The one incidental change (unrelated `lib/auth.ts` entry appearing in the regenerated `api.d.ts`) was a mechanical byproduct of running the Convex codegen command the plan explicitly required (Task 2), not a manual fix — included for accuracy rather than left as a dangling uncommitted diff.

## Issues Encountered
- Initial ambiguous-match unit test used mismatched casing between the two candidate blocks, causing a false single-match; fixed the test fixture to use identical casing so both blocks genuinely contain the quoted substring (test-authoring issue, not a code defect).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Draft-read (`GET /issues/{run_id}/draft`) is now a complete galley data source for asset-backed sections (podcast audio, bigBudget storyboards)
- `qaCorrections` rows going forward carry an optional disambiguating `blockIndexHint`; the client-side span resolver (Plan 32-03/32-04 work) can consume it as a hint while still falling back to full unique-substring search for legacy or stale hints
- No blockers for the remaining Phase 32 plans

---
*Phase: 32-native-galley-read-only-span-resolver*
*Completed: 2026-07-07*

## Self-Check: PASSED

All 6 modified/created files confirmed present on disk; all 3 task commit hashes
(`f1b576b`, `5865d60`, `d05dd07`) confirmed present in git history.
