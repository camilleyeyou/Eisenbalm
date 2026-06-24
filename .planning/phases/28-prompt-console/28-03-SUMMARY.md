---
phase: 28-prompt-console
plan: 03
subsystem: pipeline-api
tags: [scoring, voice-rubric, qa-judge, fastapi, contract-first]
requires:
  - "judge._load_rubric + rubric.md (active rubric asset, Phase 24/22)"
  - "acomplete usage path (tokens_in/out/usd/resolved_model)"
  - "_require_operator Clerk-operator gate (Phase 24)"
  - "promptVersions:getActive Convex query"
provides:
  - "API_CONTRACTS §3A.2 POST /agents/{agent_key}/score contract"
  - "judge.score_output single-output voice scorer (VoiceScore/VoiceAxisScore)"
  - "POST /agents/{agent_key}/score endpoint (ScoreRequest/ScoreResponse)"
affects:
  - "Plan 28-04 (UI + draft-vs-active compare wires this endpoint)"
tech-stack:
  added: []
  patterns:
    - "active-row-then-disk rubric resolution (mirrors config_loader._hydrate_asset)"
    - "single acomplete call advisory scorer (no second cost recorder, no real-table writes)"
key-files:
  created:
    - "packages/pipeline/tests/api/test_score.py"
  modified:
    - "docs/API_CONTRACTS.md"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py"
    - "packages/pipeline/src/eisenbalm_pipeline/api/agents.py"
decisions:
  - "Bare-app disk-fallback is the default stub-mode test path: get_client() raises (no set_client), _resolve_rubric catches and returns rubric_source='disk'"
  - "score_output returns (VoiceScore, usage) so the endpoint reads cost from the same acomplete usage dict — no second recorder"
metrics:
  duration: 9
  completed: "2026-06-24"
  tasks: 3
  files: 4
---

# Phase 28 Plan 03: Voice-Rubric Scoring Endpoint (Contract-First) Summary

PRC-09 backend: a brand-agnostic single-output voice scorer that loads the live
active rubric (disk fallback) and returns a per-axis breakdown + overall headline
+ 1-2 line rationale + rubric_source + cost — advisory-only, no second cost
recorder, no real-table writes. Contract documented in API_CONTRACTS §3A.2 BEFORE
any endpoint code (CLAUDE.md hard rule).

## What Was Built

**Task 1 — API_CONTRACTS §3A.2 (contract-first)** [b05c46a]
Added `### 3A.2 — POST /agents/{agent_key}/score` immediately after §3A.1 and
before §3B. Documents the `ScoreRequest`/`ScoreResponse` shapes (per-axis `axes`,
`overall`, `rationale`, `rubric_source`, four cost fields) plus an isolation
contract mirroring §3A.1: same rubric as the judge (active→disk), single-output
(NOT the six-section batch), advisory-only, no second cost recorder, additive to
frozen `pipelineRuns`.

**Task 2 — `judge.score_output` scorer** [faf3882]
Added `VoiceAxisScore` (with `pass_` aliased to JSON `pass`) and `VoiceScore`
(overall + axes + rationale) Pydantic models, plus an `async score_output(*,
output, rubric, run_id, agent_key)` that builds a TWO-message single-output list
(system = the passed rubric, user = score-this-one-output instruction), calls
`acomplete(agent_id="qa", response_format=VoiceScore)`, and normalizes the result
(Pydantic / dict / stub-empty) into a `VoiceScore`. Returns `(VoiceScore, usage)`.
`run_llm_judge` is byte-unchanged.

**Task 3 — endpoint + pytest** [1374abb]
Added `ScoreRequest`, `AxisOut`, `ScoreResponse`, `_resolve_rubric` (active
`rubric` row via `promptVersions:getActive` → disk `judge._load_rubric` fallback,
recording `rubric_source`), and `POST /agents/{agent_key}/score`
(`_require_operator` gated). The handler times the call, maps `VoiceScore` →
`ScoreResponse`, and populates the four cost fields from the `acomplete` usage
dict. `tests/api/test_score.py` covers the response shape + 4 cost fields, the
disk-fallback path (`rubric_source == "disk"` with no live Convex), and the
advisory-only no-write isolation contract — all header-free under stub mode.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `<read_first>`/verify referenced `tests/api/test_test_run.py`, but the
actual file lives at `tests/test_test_run.py`; the new test was created at the
plan's specified path `tests/api/test_score.py` and mirrors the real harness.

## Deferred Issues

- `tests/lib/test_vercel_client.py` fails collection with
  `ModuleNotFoundError: No module named 'respx'`. Pre-existing, unrelated to this
  plan (missing dev dependency). Logged to `deferred-items.md`. Out of scope.

## Verification

- `EISENBALM_STUB_MODE=1 pytest tests/api/test_score.py tests/test_test_run.py
  tests/test_voice.py tests/test_section_writer_voice_propagation.py -q` →
  **13 passed**.
- §3A.2 (line 830) precedes §3B (line 892) in API_CONTRACTS.md.
- `score_output` builds no `sections_json` batch payload; `run_llm_judge`
  unchanged; `judge.py` parses (ast).
- Score handler has zero `pipelineRuns`/`deliberationEvents`/`agent_runs` writes.
- Rubric resolves via `promptVersions:getActive` with `_load_rubric` disk fallback.

## Self-Check: PASSED
