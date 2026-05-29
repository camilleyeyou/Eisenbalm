---
phase: 16-choose-your-narrator
plan: 05
subsystem: pipeline
tags: [narrator, calibrator, writers, voice, state, NRR-01, NRR-03, NRR-05, NRR-04, NRR-10, D-13, D-14]
requirements: [NRR-01, NRR-03, NRR-05]
dependency-graph:
  requires:
    - "16-01 (Sanity narratorProfile schema + docs/API_CONTRACTS.md §7 narrator field)"
    - "16-02 (RED tests for calibrator narrator + section writer voice propagation)"
    - "16-04 (assemble_voice, JESSE_PERSONA_BLOCK, UNIVERSAL_CORE)"
  provides:
    - "DispatchState.narrator + .narrator_slug TypedDict slots"
    - "calibrator._resolve_narrator (D-13 precedence + D-14 inactive fallback)"
    - "lib/sanity_client.fetch_narrator_by_slug (GROQ projection of 6 canonical fields)"
    - "style_brief['voice'] now carries narrator-aware composition (calibrator → 4 writers)"
    - "voice_constraints kwarg propagated by origin_story, problem, founder_bio, case_study"
  affects:
    - "16-06 (chronicler) — will consume state['narrator']"
    - "16-07 (qa judge) — will consume state['narrator'] + narrator.voiceRubric / .exampleSamples"
    - "16-08a (seed-narrators) — must match Narrator TypedDict field surface byte-for-byte"
tech-stack:
  added: []
  patterns:
    - "module-level convex_mutation_safe import for unittest.mock.patch interception"
    - "kwarg-only convex_mutation_safe call so test side_effect=lambda **kwargs accepts the call"
    - "GROQ inner-string slug projection ('slug': slug.current) — never the wrapper object"
key-files:
  created: []
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py"
    - "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/problem.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py"
    - "packages/pipeline/tests/agents/test_origin_story.py"
    - "packages/pipeline/tests/agents/test_problem.py"
    - "packages/pipeline/tests/agents/test_founder_bio.py"
    - "packages/pipeline/tests/agents/test_case_study.py"
decisions:
  - "D-08 honored: Narrator TypedDict has 6 plain fields (name, slug, voiceConstraints, voiceRubric, exampleSamples, active). voiceRubric is `str` (plain text), active is `bool`. No NarratorVoiceRubric wrapper, no `status: Literal['active','inactive']`."
  - "D-13 enforced: calibrator precedence is state['narrator'] (direct) → state['narrator_slug'] → winning_charity.narratorSlug → Jesse default."
  - "D-14 enforced: narrator_record.get('active') is False triggers a non-blocking deliberationEvents:insert warning + Jesse fallback. Detection uses the boolean `active` field NOT a status string."
  - "NRR-01 + NRR-04 enforced by construction: 4 narrative writers forward style_brief['voice'] via voice_constraints kwarg — never read state['narrator'] themselves. Bonus stays narrator-agnostic per CONTEXT D-19."
  - "NRR-10 holds: assemble_voice(None) == VOICE_CONSTRAINTS and style_brief['voice'] defaults to VOICE_CONSTRAINTS when no narrator is set — Phase 14 baseline byte-preserved."
  - "convex_mutation_safe called with kwargs (path=, args=) so the Plan 16-02 test mock's def _capture_event(**kwargs) shape works without coupling to positional-arg shape."
metrics:
  duration_minutes: 15
  tasks_completed: 3
  files_modified: 12
  files_created: 0
  tests_turned_green: 6
  commits: 3
  completed_date: "2026-05-29"
---

# Phase 16 Plan 05: State, Calibrator, Writers Summary

One-liner: Narrator state slots + calibrator D-13 precedence + D-14 inactive fallback + 4 narrative writers forward style_brief['voice'] — all 7 Plan 16-02 RED tests now green.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add Narrator TypedDict + DispatchState narrator fields | 1074971 | graph/state.py |
| 2 | Calibrator narrator resolution + D-14 inactive fallback + fetch_narrator_by_slug | 2d8f310 | agents/calibrator.py, lib/sanity_client.py |
| 3 | Propagate narrator voice to 4 narrative writers + NRR-01 header pins | a6eebee | agents/origin_story.py, problem.py, founder_bio.py, case_study.py, bonus.py + 4 voice-isolation tests |

## What Landed

### Narrator TypedDict (graph/state.py)

The 6 fields mirror `apps/studio/schemas/narratorProfile.ts` verbatim:

| Field | Type | Source |
| ----- | ---- | ------ |
| `name` | `str` | narratorProfile.name |
| `slug` | `str` | narratorProfile.slug.current (inner string) |
| `voiceConstraints` | `str` | narratorProfile.voiceConstraints (Sanity 'text') |
| `voiceRubric` | `str` | narratorProfile.voiceRubric (Sanity 'text') — PLAIN STRING, NOT a structured wrapper |
| `exampleSamples` | `list[str]` | narratorProfile.exampleSamples (array of 'text') |
| `active` | `bool` | narratorProfile.active (default True). D-14 fallback when False — boolean check, NOT a status string |

**Confirmed explicitly:** `voiceRubric` is `str` (plain text). `active` is `bool`. No `NarratorVoiceRubric` wrapper. No `status: Literal['active','inactive']`. No `displayName`.

### DispatchState fields added

```python
narrator: Optional[Narrator]                 # resolved by calibrator; None until calibrator runs
narrator_slug: Optional[str]                 # D-13 override; takes precedence over charity.narratorSlug
```

### Calibrator narrator-resolution precedence chain (D-13)

`agents/calibrator.py::_resolve_narrator` evaluates in this strict order:

1. **`state["narrator"]` (direct)** — pre-populated record (test path / future upstream code). Skips Sanity round-trip entirely.
2. **`state["narrator_slug"]` (override)** — D-13 override input; fetched via `fetch_narrator_by_slug`.
3. **`winning_charity.narratorSlug`** — per-issue charity-level narrator slug; fetched via Sanity.
4. **Jesse default** — `assemble_voice(None) == VOICE_CONSTRAINTS` (byte-equivalent to Phase 14 baseline, NRR-10).

After resolution, if the resolved narrator's `active` field is `False`:

- **D-14**: `_emit_inactive_narrator_warning` calls `convex_mutation_safe(path="deliberationEvents:insert", args={...})` with an `eventType="editor-decision"` row whose payload carries `warning: "inactive_narrator_fallback"`, `originalSlug`, `originalName`, `fellBackTo: "jesse"`, and a `reason` string. The convex call is best-effort (lib/convex_client semantics: logs on failure, never raises).
- Calibrator continues with `assemble_voice(None)` = Jesse voice and writes `state["narrator"] = None`.

The detection condition is `narrator_record.get("active") is False` — boolean field per Plan 16-01 schema, NOT `status == "inactive"` (the prior plan-revision wrong-schema artifact).

### `convex_mutation_safe` import

Module-level import — required so `unittest.mock.patch("eisenbalm_pipeline.agents.calibrator.convex_mutation_safe", ...)` intercepts at the bound name (Python "patch where it's looked up"). No inline import inside the function body.

### `fetch_narrator_by_slug` GROQ projection (lib/sanity_client.py)

```groq
*[_type == "narratorProfile" && slug.current == $slug][0]{
  name,
  "slug": slug.current,
  voiceConstraints,
  voiceRubric,
  exampleSamples,
  active
}
```

`_type` is `"narratorProfile"` (Plan 16-01 schema name) — never bare `"narrator"`. Output field surface matches the Narrator TypedDict byte-for-byte; no rename layer between Sanity and Python state.

### Narrative-writer voice propagation (NRR-04)

The 4 narrative writers (origin_story, problem, founder_bio, case_study) now pass:

```python
voice_constraints=style_brief.get("voice") or VOICE_CONSTRAINTS
```

into `build_section_writer_prompt`. The calibrator (Task 2) wrote the narrator-aware voice into `style_brief["voice"]` (always — even when narrator is None, in which case it's byte-identical to `VOICE_CONSTRAINTS`). Writers stay narrator-agnostic at the source level — they never read `state["narrator"]` directly.

A 9-line **NRR-01 invariant header** comment was added above the docstring in all 5 writer agents (origin_story, problem, founder_bio, case_study, bonus) pinning this guarantee for future reviewers. The bonus header notes its different status (CONTEXT D-19: bonus + game are NOT narrator-aware in Phase 16; they continue to use `VOICE_CONSTRAINTS` directly).

## Cross-References to Downstream Plans

- **Plan 16-06 (chronicler)** will read `state["narrator"]` to set the dialogue voice for the deliberation conversation. Calibrator stores it; chronicler consumes it. Inactive-fallback runs reach the chronicler with `state["narrator"] = None` (Jesse default).
- **Plan 16-07 (qa judge)** will read `state["narrator"]["voiceRubric"]` + `["exampleSamples"]` to append narrator-specific judging axes to the existing rubric.md content. Same null-fallback semantics.
- **Plan 16-08a (seed-narrators)** will write the Jesse + Maya Rudolph + Werner Herzog records into Sanity. The seed JSON field-name surface MUST match the Narrator TypedDict here (NRR-08 test asserts this).

## Deviations from Plan

### [Rule 3 - Blocking] Plan-file state.py path was a typo

- **Found during:** Task 1
- **Issue:** Plan frontmatter `files_modified[0]` listed `packages/pipeline/src/eisenbalm_pipeline/state.py`, but no top-level state.py exists. The actual module is `packages/pipeline/src/eisenbalm_pipeline/graph/state.py`.
- **Fix:** Applied all Task 1 edits to `graph/state.py`. The plan-spec verify command (`from eisenbalm_pipeline.state import ...`) updated implicitly — tests already import from `eisenbalm_pipeline.graph.state` (or transitively via agent modules).
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/graph/state.py`
- **Commit:** 1074971

### [Rule 3 - Blocking] convex_mutation_safe positional-vs-kwargs call shape

- **Found during:** Task 2 (test_inactive_narrator_falls_back_to_jesse_with_warning failed with `TypeError: _capture_event() takes 0 positional arguments but 2 were given`).
- **Issue:** The Plan 16-02 test mock uses `async def _capture_event(**kwargs)` (kwargs only). `convex_mutation_safe(path: str, args: dict)` accepts positional args. Calling positionally tripped the test mock.
- **Fix:** Called `convex_mutation_safe(path="...", args={...})` with explicit kwargs. The 2-positional API still works; the Plan 16-02 test contract is honored.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py`
- **Commit:** 2d8f310

### [Rule 1 - Bug] Phase 5 voice-isolation tests' allowlist needed extension

- **Found during:** Task 3 (after adding `voice_constraints` kwarg propagation, 4 Phase 5 voice-isolation tests began failing because their `allowed` set capped at 6 kwargs).
- **Issue:** Phase 5 tests (`test_origin_story.py::test_origin_story_voice_isolation` and mirrors in test_problem.py / test_founder_bio.py / test_case_study.py) enforced "only 6 kwargs go into build_section_writer_prompt" — predating Phase 16's `voice_constraints` 7th kwarg.
- **Fix:** Extended each `allowed` set to include `voice_constraints` with a Phase 16 explanatory comment. Voice-isolation property still holds — `voice_constraints` is the narrator-aware voice string, NOT a sibling-section's output, so no leak.
- **Files modified:** `packages/pipeline/tests/agents/test_origin_story.py`, `test_problem.py`, `test_founder_bio.py`, `test_case_study.py`
- **Commit:** a6eebee

### [Rule 1 - Bug] Plan Task 3 said "no code changes" but the test contract requires them

- **Found during:** Task 3 read-through.
- **Issue:** Plan 16-05 Task 3 claimed "NO CODE CHANGES" to the 4 narrative writers, asserting they were already narrator-agnostic. But the Plan 16-02 test (`test_section_writer_voice_propagation.py`) explicitly demands the `voice_constraints` kwarg be passed through to `build_section_writer_prompt`. Without that change, the test stays RED.
- **Fix:** Added `voice_constraints=style_brief.get("voice") or VOICE_CONSTRAINTS` to all 4 narrative writers' `build_section_writer_prompt` calls. The narrator-agnosticism claim is preserved at the source level — writers don't read `state["narrator"]`, they forward `style_brief["voice"]` which the calibrator set. This matches the spirit of NRR-01 (no writer-level branching on narrator identity) while satisfying the contract.
- **Files modified:** 4 writer agents (origin_story, problem, founder_bio, case_study)
- **Commit:** a6eebee

## Test Results

| Test file | Before plan | After plan |
| --------- | ----------- | ---------- |
| test_calibrator_narrator.py | 1 pass / 2 fail | 3 pass / 0 fail |
| test_section_writer_voice_propagation.py | 0 pass / 4 fail | 4 pass / 0 fail |
| Phase 5 voice-isolation tests (4 files) | 4 pass | 4 pass (allowlist extended) |
| All other pipeline tests | 171 pass / 0 fail (incl. 35 skipped, 1 xfailed) | 175 pass / 0 fail (no regressions in scope) |
| **Total pipeline suite** | 176 pass / 9 fail / 35 skip / 1 xfail | 182 pass / 3 fail / 35 skip / 1 xfail |

The 3 remaining failures (`test_qa_judge_narrator.py`) belong to **Plan 16-07** (qa-judge-narrator), NOT this plan.

## Authentication Gates

None encountered.

## Known Stubs

None introduced. The narrator data path is wired end-to-end through the calibrator. Seed records (Jesse / Maya / Herzog) land in Plan 16-08a — until then, `fetch_narrator_by_slug` returns None for any real slug and `_resolve_narrator` cleanly falls back to Jesse default.

## Self-Check: PASSED
