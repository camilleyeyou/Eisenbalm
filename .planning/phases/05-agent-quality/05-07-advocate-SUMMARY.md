---
phase: 05-agent-quality
plan: 07
subsystem: pipeline
tags: [agent, advocate, openrouter, haiku, convex, agentVotes, deliberationEvents]
requires:
  - "05-03 (lib/openrouter_client.acomplete, lib/convex_client.convex_mutation_safe)"
  - "05-04 (tests/conftest.py mock fixtures: sample_dispatch_state)"
  - "05-06 (Scout produces state['candidates'] — currently still stub-fed; real Scout body lands in 05-06)"
provides:
  - "Real Haiku-driven Advocate body (single LLM call over all candidates)"
  - "Per-candidate agentVotes:insert write (canonical Convex schema)"
  - "Per-candidate deliberationEvents:insert eventType='advocate-argument'"
  - "state['model_versions']['advocate'] populated (AGT-17)"
  - "AdvocateOutput / AdvocateVote Pydantic schemas (re-usable by Editor Gate-1)"
affects:
  - "Editor Gate-1 (Plan 05-08) — consumes state['advocate_votes'] for winner selection"
  - "Frontend deliberation layer (Phase 9) — renders advocate-argument event rows"
tech-stack:
  added:
    - "pydantic AdvocateVote/AdvocateOutput (per-candidate score + argument + strengths)"
  patterns:
    - "Per-candidate Convex writes with emit_event=None on @agent_node (mirrors Scout pattern)"
    - "Single LLM call over all candidates (cost containment per CONTEXT D-08)"
    - "Deterministic charity _id via python-slugify (matches Scout's lib/sanity_client)"
key-files:
  created: []
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py"
    - "packages/pipeline/tests/agents/test_advocate.py"
    - ".planning/phases/05-agent-quality/deferred-items.md"
decisions:
  - "Used vote='for' (NOT 'yes' from plan prose) — canonical Convex schema + API_CONTRACTS §3.5 win per CLAUDE.md 'do not modify field names without checking API_CONTRACTS.md'"
  - "Removed score from agentVotes:insert payload — Convex agentVotes table has no score field; score lives on deliberationEvents.payload JSON instead"
  - "Single Haiku call over all candidates (not per-candidate) — cost cap discipline per CONTEXT D-08; AdvocateOutput.votes preserves input order"
  - "_charity_id_for uses python-slugify (collapses repeated whitespace) — matches Scout's lib/sanity_client.write_charity slug pattern exactly so Advocate's agentVotes.charityId resolves to the same Sanity row Scout already wrote"
  - "acomplete called with kwargs-only signature (agent_id, run_id, messages, response_format) — the plan's positional draft would have raised TypeError"
metrics:
  duration_min: 4
  tasks: 2
  files: 3
  completed: 2026-05-17
---

# Phase 5 Plan 07: Advocate Summary

Replaced the Phase 4 Advocate stub with a real Haiku-driven implementation that scores each Scout candidate, writes one canonical `agentVotes:insert` + one `advocate-argument` deliberation event per candidate, and records the resolved model into `state['model_versions']['advocate']` for AGT-17 observability.

## What landed

- **`agents/advocate.py` (rewritten, 172 lines)** — single `acomplete(agent_id='advocate', ...)` call with `response_format=AdvocateOutput` (Pydantic), then a per-vote loop emitting two Convex mutations per candidate (`agentVotes:insert` and `deliberationEvents:insert` with `eventType='advocate-argument'`). `emit_event=None` on `@agent_node` so the decorator's single-event emission is suppressed; per-candidate events are explicit. State return includes `advocate_votes` (serialized vote dicts) and `model_versions` (with `'advocate'` key populated).
- **`tests/agents/test_advocate.py` (rewritten, 5 tests, all green)** — unit-test surface for AGT-05 (scoring + agentVotes + deliberationEvents) and AGT-17 (model recording). Uses `mock_convex_mutation` style direct patching with `unittest.mock.AsyncMock`. Tests verify per-candidate counts, `vote='for'` canonical value, denormalized `charityName`, and JSON payload contents.

## Architecture choices

- **Single LLM call, not per-candidate.** The plan body and CONTEXT D-08 both emphasize cost containment. One Haiku call over all candidates lets the model reason about relative scoring (which is what Advocate is supposed to surface) while keeping per-run cost bounded.
- **Pydantic `AdvocateOutput` shape.** `votes: list[AdvocateVote]` where each vote carries `charityName`, `score` (1-10, Pydantic-validated), `argument` (150-250 words), `keyStrengths` (2-4 items), `primaryConcern`. The shape is identical to what RESEARCH §Advocate specified. Score bounds are enforced at parse time so malformed model output fails fast.
- **`_charity_id_for(name)` uses python-slugify.** Same library Scout (`lib/sanity_client.write_charity`) uses for its deterministic `_id`. This guarantees Advocate's `agentVotes.charityId` field resolves to the exact same Sanity row Scout already wrote (Phase 1 D-17 + Phase 4 D-18 deterministic-_id pattern).
- **`emit_event=None` on `@agent_node`.** The wrapper emits zero events for Advocate; the body explicitly emits N events (one per candidate). This is the same pattern Scout uses for per-candidate `pitchLog:insert` writes, and is required because the wrapper's single-emit mechanism doesn't know about candidate iteration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed `vote='yes'` to `vote='for'`**

- **Found during:** Task 1 implementation review against the canonical Convex schema
- **Issue:** Plan 05-07 body (line 245 of the plan) and acceptance criteria specified `vote='yes'`. The Convex `agentVotes` schema validator (`convex/schema.ts` lines 55-59) accepts ONLY `'for' | 'against' | 'abstain'`. API_CONTRACTS §3.5 line 699 also explicitly says `'vote': 'for'`. Shipping `'yes'` would have raised a Convex validator error at the first real run.
- **Fix:** Used `vote='for'` (canonical schema). Updated test `test_agent_votes_written` to assert `c.args[1]['vote'] == 'for'`.
- **Files modified:** `agents/advocate.py`, `tests/agents/test_advocate.py`
- **Commit:** `88d4078`, `dfe4c22`
- **Precedence:** CLAUDE.md says "do not modify field names without checking API_CONTRACTS.md first." API_CONTRACTS §3.5 wins over plan prose.

**2. [Rule 1 - Bug] Removed `score` from `agentVotes:insert` payload**

- **Found during:** First test run — `KeyError: 'score'` on the agentVotes call assertion
- **Issue:** Plan body specified `"score": v.score` in the `agentVotes:insert` arg dict. The Convex `agentVotes` schema has NO `score` field — only `runId`, `agentId`, `charityId`, `charityName`, `vote`, `reasoning`. Convex validator would reject the extra field.
- **Fix:** Removed `score` from `agentVotes:insert` payload. Score is recoverable from the parallel `deliberationEvents:insert` payload JSON (which has it). Updated `test_agent_votes_written` to assert `'score' not in c.args[1]` and moved the score assertion into `test_argument_event_emitted` where it correctly verifies the JSON payload.
- **Files modified:** `agents/advocate.py`, `tests/agents/test_advocate.py`
- **Commit:** `dfe4c22`

**3. [Rule 3 - Blocking] Used kwargs-only signature for `acomplete`**

- **Found during:** Task 1 implementation
- **Issue:** Plan body called `acomplete("advocate", messages, response_format=AdvocateOutput)` (positional args). The real signature is `acomplete(*, agent_id, run_id, messages, response_format=None)` — keyword-only, and `run_id` is required. The positional draft would have raised `TypeError` at the first invocation.
- **Fix:** Called as `acomplete(agent_id='advocate', run_id=run_id, messages=messages, response_format=AdvocateOutput)`.
- **Files modified:** `agents/advocate.py`
- **Commit:** `88d4078`

**4. [Rule 1 - Bug] Added denormalized `charityName` field to `agentVotes:insert`**

- **Found during:** Convex schema review (cross-checked against existing stub)
- **Issue:** Plan body omitted `charityName` from `agentVotes:insert`. Convex schema requires it (`charityName: v.string()`, line 54 of `convex/schema.ts`).
- **Fix:** Added `"charityName": v.charityName` to the agentVotes payload. Matches what the Phase 4 stub already did.
- **Files modified:** `agents/advocate.py`
- **Commit:** `88d4078`

**5. [Rule 3 - Blocking] Adjusted `_charity_id_for` test assertion for python-slugify behavior**

- **Found during:** Test write
- **Issue:** Plan's draft test asserted `_charity_id_for("Bar  Org") == "charity-bar--org"` (double-hyphen from naive `.replace(" ", "-")`). Production uses `python-slugify` (already a project dep, used by Scout). python-slugify collapses repeated whitespace, returning `"charity-bar-org"` (single hyphen).
- **Fix:** Test asserts `"charity-bar-org"`. The production behavior matches Scout's `lib/sanity_client.write_charity` slug pattern exactly, which is the load-bearing invariant (agentVotes.charityId must resolve to the Sanity row Scout wrote).
- **Files modified:** `tests/agents/test_advocate.py`
- **Commit:** `dfe4c22`

## Deferred Issues (out of scope for 05-07)

- **`tests/agents/test_editor.py` collection error.** `cannot import name 'EDITOR_CONFIDENCE_THRESHOLD' from 'eisenbalm_pipeline.agents.editor'`. Pre-existing parallel-execution artifact from Plan 05-08 (Editor Gate-1), still listed as incomplete in STATE.md. Logged to `.planning/phases/05-agent-quality/deferred-items.md`. Worked around in Plan 05-07's full-suite verification with `--ignore=tests/agents/test_editor.py`; the advocate suite (5/5) passes cleanly.

## Verification

```bash
$ EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_advocate.py -x -v
tests/agents/test_advocate.py::test_charity_id_for PASSED
tests/agents/test_advocate.py::test_scoring PASSED
tests/agents/test_advocate.py::test_agent_votes_written PASSED
tests/agents/test_advocate.py::test_argument_event_emitted PASSED
tests/agents/test_advocate.py::test_model_version_recorded PASSED
============================== 5 passed in 0.17s ===============================

$ EISENBALM_STUB_MODE=true uv run pytest tests/ -q --ignore=tests/agents/test_editor.py
33 passed, 42 skipped in 0.57s

$ grep -c "advocate-argument" packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
4
$ grep -c "agentVotes:insert" packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
4
```

## Self-Check: PASSED

- File `packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py` exists (172 lines)
- File `packages/pipeline/tests/agents/test_advocate.py` exists (5 tests)
- Commit `88d4078` (feat: Advocate implementation) found in `git log`
- Commit `dfe4c22` (test: Advocate test suite) found in `git log`
- All 5 Advocate tests pass; full suite green (33 passed, 42 skipped, 1 pre-existing collection error excluded)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `88d4078` | feat | Replace Advocate stub with Haiku-driven implementation |
| `dfe4c22` | test | Land Advocate unit tests with real assertions (AGT-05, AGT-17) |
