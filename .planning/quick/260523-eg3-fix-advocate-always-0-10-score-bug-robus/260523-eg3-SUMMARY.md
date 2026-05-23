---
phase: quick-260523-eg3
plan: 01
subsystem: pipeline/advocate
tags: [bug-fix, advocate, score-matching, regression-test]
dependency_graph:
  requires: []
  provides: [advocate-score-reattachment]
  affects: [editor-gate-1-ranking, deliberation-transcript-keystrengths]
tech_stack:
  added: []
  patterns: [positional-alignment, slugify-keyed-fallback]
key_files:
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
    - packages/pipeline/tests/agents/test_advocate.py
decisions:
  - "Positional match is the primary path (prompt guarantees same-order votes); slugify fallback handles dropped/added votes"
  - "keyStrengths/primaryConcern propagated as extra dict keys (not TypedDict fields) — editor.py already reads via .get(), pattern is pre-existing"
  - "_vote_fields() helper defined as inner function to avoid polluting module namespace"
metrics:
  duration: 2 min
  completed: 2026-05-23
  tasks: 2
  files: 2
---

# Quick Task 260523-eg3: Fix Advocate Always-0/10 Score Bug (Robust Matching)

One-liner: Two-tier positional+slugify vote-to-candidate matching replaces the broken exact-name dict lookup that collapsed all scores to 0 when the LLM normalized charity names.

## What Was Fixed

The Advocate agent reattached LLM votes to Scout candidates via exact string matching on `charityName` vs `candidate["name"]`. When the LLM normalized a name (dropping "The", stripping punctuation, changing casing), `.get(name, 0)` returned 0 for every candidate. All scores collapsed to 0, and `editor.py`'s `_sort_candidates_by_score` fell back to alphabetical tiebreak — picking the wrong winner while its LLM rationale described a different charity.

Additionally, `keyStrengths` and `primaryConcern` from each vote were never propagated onto candidate dicts. `editor.py`'s `_format_deliberation_transcript` already reads them via `.get()` but always received empty/None.

## Changes Made

### `packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py`

Replaced the fragile name-keyed dict block (~lines 184-193) with a two-tier matching strategy:

- **Primary (positional):** When `len(votes_serialized) == len(candidates)`, match by position (`zip(candidates, votes_serialized)`). The prompt instructs "one AdvocateVote per candidate, same order as input" — positional is reliable in the normal case and survives any name normalization.
- **Fallback (slugify-keyed):** When counts differ (dropped or added vote), build `{slugify(vote["charityName"]): vote}` and look up each candidate via `slugify(candidate["name"])`. Uses the same `slugify` already imported (line 30) for consistent normalization.
- **Safe default:** Unmatched candidates (genuinely missing vote) receive `advocateScore=0, advocateArgument="", keyStrengths=[], primaryConcern=""`.

Also extended the reattachment to propagate `keyStrengths` and `primaryConcern` alongside the existing `advocateScore` and `advocateArgument`.

The `agentVotes:insert`, `deliberationEvents:insert` emission loop, and `model_versions` write are byte-unchanged.

### `packages/pipeline/tests/agents/test_advocate.py`

Added two regression tests after the existing four:

**Test A — `test_score_attaches_despite_name_normalization`:**
- Scout candidates: `["The Foo Foundation", "Bar Org"]`
- LLM emits: `charityName="Foo Foundation"` (score 9), `charityName="Bar Org"` (score 4)
- Asserts: score 9 on `"The Foo Foundation"`, score 4 on `"Bar Org"` (not 0)
- Asserts: `keyStrengths` and `primaryConcern` propagated onto both candidates

**Test B — `test_slugify_fallback_when_count_differs`:**
- Scout candidates: `["A & B!", "Zeta Org"]`; LLM emits 3 votes (extra to force count mismatch)
- Vote for `"a b"` (slugify → `"a-b"`) matches candidate `"A & B!"` (also → `"a-b"`)
- Asserts: score 7 on `"A & B!"` via slug, score 3 on `"Zeta Org"` via exact slug

## Test Output

```
uv run pytest tests/agents/test_advocate.py -q

.......
7 passed in 0.20s
```

All 7 tests passing:
1. `test_charity_id_for` (existing)
2. `test_scoring` (existing)
3. `test_agent_votes_written` (existing)
4. `test_argument_event_emitted` (existing)
5. `test_model_version_recorded` (existing)
6. `test_score_attaches_despite_name_normalization` (new — Test A)
7. `test_slugify_fallback_when_count_differs` (new — Test B)

## Scope Confirm

```
git diff --stat HEAD~2 HEAD
  packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py  |  57 ++++++---
  packages/pipeline/tests/agents/test_advocate.py               | 132 +++++++++++++++++++++
  2 files changed, 172 insertions(+), 17 deletions(-)
```

Only `advocate.py` and `test_advocate.py` changed. No schema field renames, no edits to `editor.py`, no changes to the Convex emission loop.

## Commits

- `18c0e9c` — `fix(260523-eg3): robust vote-to-candidate matching in advocate.py`
- `a1353f4` — `test(260523-eg3): regression tests for advocate vote-to-candidate matching`

## Deviations from Plan

None. Plan executed exactly as written.

## Known Stubs

None introduced by this task.

## Self-Check: PASSED

- `/Users/user/Desktop/Eisenbalm/packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py` — FOUND
- `/Users/user/Desktop/Eisenbalm/packages/pipeline/tests/agents/test_advocate.py` — FOUND
- Commit `18c0e9c` — FOUND
- Commit `a1353f4` — FOUND
- All 7 tests passing — CONFIRMED
