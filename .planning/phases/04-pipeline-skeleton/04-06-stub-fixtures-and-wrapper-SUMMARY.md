---
phase: 04-pipeline-skeleton
plan: 06
subsystem: pipeline
tags: [langgraph, agents, wrapper, stubs, fixtures, contract]
requires:
  - 04-02   # graph/state.py DispatchState + lib/convex_client.py + lib/cost.py
  - 04-03   # Convex schema patches that pipelineRuns:updateStatus addendum lives under
provides:
  - "@agent_node decorator at agents/_wrapper.py — Phase 4 → Phase 5 stable contract (CONTEXT D-15)"
  - "15 deterministic stub fixture functions at stubs/fixtures.py covering all 14 agents in the brief's sequence"
  - "FakeOpenRouterClient placeholder at stubs/fake_openrouter.py — Phase 5 swap point (CONTEXT D-17)"
affects:
  - 04-07   # 14 stub agent modules import @agent_node + the matching fixture
  - 04-08   # graph/builder.py wires the decorated agents into StateGraph
  - 04-10   # parametrized integration tests over the fixtures verify PIP-04 evidence
  - "Phase 5 (real LLM agents) — decorator signature is locked; only function bodies change"
requirements:
  - PIP-04
tech-stack:
  added: []   # no new deps; pure Python on Plan 04-02 foundations
  patterns:
    - "Decorator factory with kwargs-only signature (CONTEXT D-15)"
    - "Try/except + fire-and-forget Convex emission (lib.convex_mutation_safe) per CONTEXT D-20"
    - "Function-attribute iteration limit (_max_tool_calls) — Phase 5 reads on entry (CONTEXT D-25, AGT-18)"
    - "errorMessage format f'{agentId}: {ExceptionClass}: {msg}' (CONTEXT D-27)"
    - "Re-entry idempotency for interrupt() — emit fires only on successful return, not on the pre-interrupt pass (RESEARCH §2)"
    - "Deterministic stub fixtures reusing Phase 2 demo charity to avoid DB pollution (CONTEXT D-16 + Phase 02-04 SUMMARY)"
key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/agents/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py
    - packages/pipeline/src/eisenbalm_pipeline/stubs/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py
  modified: []
decisions:
  - "agent_node signature is kwargs-only (name, emit_event, payload_builder, max_tool_calls) — locked for Phase 5; only agent bodies change"
  - "Emit fires AFTER fn returns so interrupt() in fn skips emit on the pre-resume pass and emit fires exactly once on the successful resume (RESEARCH §2 idempotency-before-interrupt)"
  - "Editor split into 2 fixtures (editor_decision_output + editor_final_output) — 15 functions cover the 14-agent sequence per CONTEXT D-05 gate-1+final convention"
  - "Demo charity 'The Quiet Foundation' (Sanity _id=charity-the-quiet-foundation) is the deterministic winner in stub mode — reuses Phase 02-04 seeded charity"
  - "Stub fake_openrouter is reserved for Phase 5 wiring; Phase 4 agents never instantiate it"
metrics:
  duration: "12 min"
  tasks: 3
  files_created: 5
  completed: "2026-05-14T02:46:24Z"
---

# Phase 04 Plan 06: Stub Fixtures and Wrapper Summary

One-liner: Landed the `@agent_node` decorator (Phase 4 → Phase 5 stability contract) and 15 deterministic stub fixture functions, plus a `FakeOpenRouterClient` placeholder reserved for the Phase 5 stub-mode toggle.

## What shipped

### 1. `@agent_node` decorator (agents/_wrapper.py)

The single most important architectural artifact in Phase 4. Phase 5 changes ONLY the agent function bodies; the decorator stays as-is.

**Signature (locked):**

```python
def agent_node(
    *,
    name: str,
    emit_event: Optional[str] = None,
    payload_builder: Optional[Callable[[DispatchState], dict]] = None,
    max_tool_calls: Optional[int] = None,
) -> Callable: ...
```

**Cross-cutting concerns owned:**

| Concern | Implementation | Source |
|---------|----------------|--------|
| try/except around fn body | wrapped function | CONTEXT D-15 |
| Convex `deliberationEvents:insert` on success | `convex_mutation_safe(...)` when `emit_event` set | CONTEXT D-15, D-20 |
| Cost recording | `record_cost(run_id, name, ...)` (stub: 0 tokens) | CONTEXT D-22 |
| Iteration-limit attribute | `wrapped._max_tool_calls = max_tool_calls` | CONTEXT D-25, AGT-18 |
| `_force_fail_agent` test toggle | raises before fn runs | CONTEXT D-37 |
| `errorMessage` format | `f'{name}: {type(e).__name__}: {e}'` | CONTEXT D-27 |
| Failure path | `pipelineRuns:updateStatus status='failed'` then re-raise | CONTEXT D-15, D-20 |
| Idempotency on resume | emit fires AFTER fn returns; interrupt() skips emit | RESEARCH §2 |

**Re-entry idempotency:** The wrapper does NOT emit duplicate deliberation events when a node runs twice on `interrupt()` resume. LangGraph's `interrupt()` raises out of `fn`, so the success path (which contains the emit) never runs on the pre-interrupt pass. On resume, `fn` re-runs from the top; `interrupt()` returns the resume value; `fn` returns normally; emit fires exactly once.

### 2. 15 deterministic stub fixtures (stubs/fixtures.py)

Each function returns the FIELDS THIS AGENT WRITES (not the full state); LangGraph merges them into the running state.

| # | Function | Returns | Notes |
|---|----------|---------|-------|
| 1 | `calibrator_output` | `style_brief` | hardcoded `bonusType='bigBudget'` (CONTEXT D-16) |
| 2 | `scout_candidates` | `candidates` (list of 3) | "The Quiet Foundation" first |
| 3 | `advocate_scored(candidates)` | `candidates` scored | demo charity = 9, others = 6 |
| 4 | `editor_decision_output(winner)` | `editor_decision` + `runner_up_notes` + `deliberation_transcript` | default winner = demo charity |
| 5 | `research_output` | `research` | Margaret Whitlock + Edenwold Township Library |
| 6 | `origin_story_output` | `origin_story` | SectionContent |
| 7 | `problem_output` | `problem_statement` + `problem_pdf_content` | SectionContent + raw text for PDF |
| 8 | `founder_bio_output` | `founder_bio` | SectionContent |
| 9 | `case_study_output` | `case_study` | CaseStudyContent |
| 10 | `game_output` | `game` | self-contained `<html>` embedCode |
| 11 | `bonus_output` | `bonus` | bigBudget shape (lyrics/sunoPrompt = None) |
| 12 | `design_output` | `theme` | valid 6-digit hex + Google Fonts |
| 13 | `qa_output` | `qa_corrections` | `[]` in stub mode (CONTEXT D-37) |
| 14 | `editor_final_output` | `editor_final_notes` | approves, no edits |
| 15 | `publisher_output` | `sanity_issue_id=None` | Sanity write happens in pipeline-end node |

Demo charity reuse (CONTEXT D-16): `QUIET_FOUNDATION_SANITY_ID = "charity-the-quiet-foundation"` matches the Phase 02-04 seeded document, so stub runs do not pollute the charity database with new fake entries on every run.

### 3. `FakeOpenRouterClient` placeholder (stubs/fake_openrouter.py)

Reserved Phase 5 swap point. Phase 4 agents never instantiate this. Phase 5 will:

1. Create `lib/openrouter_client.py` with real `ChatOpenAI` instance.
2. Branch on `EISENBALM_STUB_MODE` env var (default `'true'` for Phase 4).
3. Return `FakeOpenRouterClient()` when stub mode is on; real client otherwise.

`acomplete(prompt, **kwargs)` returns `{content, tokens_in=0, tokens_out=0, usd=0.0}` — never hits the network, mirrors CONTEXT D-22 stub-mode contract.

`is_stub_mode()` helper reads `EISENBALM_STUB_MODE` env var with safe default `'true'`.

## Verification

```bash
cd packages/pipeline && uv run python -c "
from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.stubs.fixtures import (
    calibrator_output, scout_candidates, advocate_scored,
    editor_decision_output, research_output, origin_story_output,
    problem_output, founder_bio_output, case_study_output,
    game_output, bonus_output, design_output, qa_output,
    editor_final_output, publisher_output,
)
from eisenbalm_pipeline.stubs.fake_openrouter import FakeOpenRouterClient, is_stub_mode
print('ok')
"
# → ok
```

| Check | Result |
|-------|--------|
| `from eisenbalm_pipeline.agents._wrapper import agent_node` | OK |
| 15 fixture functions importable | OK |
| `bonusType == 'bigBudget'` (CONTEXT D-16) | OK |
| Scout returns 3 candidates with demo charity first | OK |
| Advocate scores demo charity = 9, others = 6 | OK |
| Theme primaryColor is 6-digit hex | OK |
| Game embedCode contains `<html` | OK |
| Bonus lyrics/sunoPrompt = None (bigBudget shape) | OK |
| QA returns 0 corrections (CONTEXT D-37) | OK |
| `FakeOpenRouterClient().acomplete()` returns canned shape | OK |
| `grep "convex_mutation_safe"` in _wrapper.py | OK |
| `grep "_force_fail_agent"` in _wrapper.py | OK |
| `grep "The Quiet Foundation"` in fixtures.py | OK |
| `uv run pytest -q` → 25 skipped (no regression) | OK |

## Deviations from Plan

None — plan executed exactly as written.

The plan's task body included an explicit `read_first` reference to RESEARCH §Pattern 5 with the verbatim decorator implementation. I followed that reference verbatim, including the `_max_tool_calls` set on both `fn` and `wrapped` for introspection-through-decorator-chain support, and the comment block documenting re-entry idempotency.

## Forward links

- **Plan 04-07 (Wave 2):** Will import `@agent_node` and the matching fixture function in each of the 14 agent modules. Each stub body is one line: `return {**state, **fixture_output(...)}`. The decorator handles the rest.
- **Plan 04-08 (Wave 2):** Wires the decorated agents into `graph/builder.py` `StateGraph`. The `_max_tool_calls` attribute is preserved through the decorator so Phase 5's graph builder can read it for AGT-18 enforcement.
- **Plan 04-10 (Wave 3):** Parametrizes pytest cases over the 15 fixture functions to verify PIP-04 (each stub returns structurally valid DispatchState fields).
- **Phase 5 (real LLM agents):** The `@agent_node` signature is locked. Only the function bodies change. `lib/openrouter_client.py` will be created and will return `FakeOpenRouterClient()` when `EISENBALM_STUB_MODE='true'`, real client otherwise.

## Commits

| Hash | Message |
|------|---------|
| 0257f04 | feat(04-06): add @agent_node wrapper decorator (Phase 4->5 stable contract) |
| 3428a81 | feat(04-06): add 15 deterministic stub fixtures reusing Phase 2 demo charity |
| 5d10071 | feat(04-06): add FakeOpenRouterClient placeholder (Phase 5 swap point) |

## Self-Check: PASSED

All 5 created files present on disk; all 3 commit hashes (0257f04, 3428a81, 5d10071) in git log.
