---
phase: 05-agent-quality
plan: 10
subsystem: agents
tags: [openrouter, sonnet, pydantic, voice-isolation, langgraph, weasyprint-contract]

# Dependency graph
requires:
  - phase: 05-agent-quality
    provides: build_section_writer_prompt (Plan 05-03), ResearchOutput verified booleans (Plan 05-09), @agent_node wrapper (Plan 04-06)
provides:
  - OriginStoryWriter, ProblemWriter, FounderBioWriter, CaseStudyWriter — all four section writers driven by Sonnet via OpenRouter
  - Voice-isolated prompt assembly across all four (single call site each to lib.voice.build_section_writer_prompt)
  - PdfContent Pydantic schema locking Phase 6 WeasyPrint contract (problemStatement, keyDataPoints[3]{stat,source}, interventionMechanism)
  - Verified/anonymous branching for FounderBio (founderNameVerified) and CaseStudy (subjectNameVerified) per CONTEXT D-12 / RESEARCH Pitfall 5
  - model_versions population for origin_story, problem, founder_bio, case_study (AGT-17)
affects: [phase-05-bonus-game, phase-05-qa-editor-final, phase-05-real-mode-integration, phase-06-publisher, phase-09-andrew-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Section-writer skeleton: @agent_node + build_section_writer_prompt + acomplete(response_format=PydanticModel) + model_versions write"
    - "Verified/anonymous branching helper (_select_guidance_and_scrub) returning (guidance_str, scrubbed_research_dict)"
    - "Pydantic min_length/max_length list constraint for forward-contract enforcement (PdfContent.keyDataPoints)"
    - "Pydantic default-empty fields so model_construct() succeeds in EISENBALM_STUB_MODE=true regression tests"

key-files:
  created:
    - packages/pipeline/tests/agents/test_origin_story.py
    - packages/pipeline/tests/agents/test_problem.py
    - packages/pipeline/tests/agents/test_case_study.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
    - packages/pipeline/tests/agents/test_founder_bio.py

key-decisions:
  - "Wrote state['problem_statement'] not state['problem']: plan example said `result['problem']` but DispatchState §7 + validate_sections.REQUIRED_FIELDS name the field `problem_statement`. CLAUDE.md rule: do not modify field names without checking API_CONTRACTS.md first."
  - "Preserved Phase 4 payload_builder functions (_origin_story_payload etc.) so deliberationEvents.payload still carries sectionName + headline + wordCount. Plan did not mention them; dropping them would have broken the live UI."
  - "agent_node name= switched from kebab-case (Phase 4 stubs) to snake_case to match MODEL_BY_AGENT keys in llm_config.py. Plan 05-08 SUMMARY established the precedent."
  - "Pydantic models use field defaults (default='', default_factory=list, default_factory=PdfContent) so FakeOpenRouterClient.model_construct() succeeds without validation — inherited from Plan 05-05 Calibrator pattern."
  - "Voice isolation enforced both by single call site to build_section_writer_prompt AND by an explicit test (test_*_voice_isolation) that captures kwargs and asserts only the 4 whitelisted slices appear."

patterns-established:
  - "Section writer pattern: messages = build_section_writer_prompt(...) → out_obj, usage = acomplete(agent_id=, run_id=, messages=, response_format=) → out_dict via model_dump fallback → model_versions[agent_id] = usage['resolved_model']"
  - "Verified-name branching pattern: _select_guidance_and_scrub(research) → (guidance, scrubbed_research) tuple; True path preserves name; False path scrubs name to None AND returns role-formatted guidance"
  - "Voice-isolation test pattern: patch build_section_writer_prompt with side_effect=_capture, pollute state with sibling sections, assert captured.keys() ⊆ {section_id, section_title, section_guidance, charity, research, style_brief}"

requirements-completed: [AGT-09, AGT-10]

# Metrics
duration: 12min
completed: 2026-05-17
---

# Phase 05 Plan 10: Section Writers Summary

**Four Sonnet-driven section writers (origin_story, problem, founder_bio, case_study) with voice-isolated prompts and verified/anonymous name branching for founder/case-study subjects.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-17T18:39:24Z
- **Completed:** 2026-05-17T18:51:03Z
- **Tasks:** 5 (4 TDD writer replacements + 1 test consolidation, all completed)
- **Files modified:** 8 (4 agents + 4 tests)

## Accomplishments

- Replaced four Phase 4 stub bodies with real Sonnet-driven agents (origin_story, problem, founder_bio, case_study)
- Locked Phase 6 WeasyPrint contract: `PdfContent` Pydantic model with exactly 3 keyDataPoints (min_length=3, max_length=3) and locked field names
- Implemented verified/anonymous branching for FounderBio (`founderNameVerified`) and CaseStudy (`subjectNameVerified`) via `_select_guidance_and_scrub(research)` helper
- Voice isolation maintained: every writer reads only `{winning_charity, research, style_brief}` from state — never sibling-section drafts (asserted in dedicated `test_*_voice_isolation` tests for all 4)
- 21 new unit tests pass (4 in origin_story, 5 in problem, 6 in founder_bio, 6 in case_study); full agents suite green (80 passed, 10 skipped, 0 failed)

## Task Commits

Each task was committed atomically:

1. **Task 1: OriginStoryWriter Sonnet body** — `ff31dab` (feat)
2. **Task 2: ProblemWriter Sonnet body + pdfContent** — `2724914` (feat)
3. **Task 3: FounderBioWriter verified/anonymous branching** — `05a6db0` (feat)
4. **Task 4: CaseStudyWriter verified/anonymous branching** — `be29236` (feat)

Task 5 (test files) was satisfied inline with each TDD cycle: every implementation commit includes its corresponding test file in the same atomic commit.

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` — Sonnet body with single build_section_writer_prompt call site; `OriginStoryOutput` Pydantic = `{headline, body}`
- `packages/pipeline/src/eisenbalm_pipeline/agents/problem.py` — Sonnet body + `PdfContent`/`KeyDataPoint` Pydantic models locking Phase 6 WeasyPrint contract; writes `state['problem_statement']`
- `packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py` — Sonnet body + `_select_guidance_and_scrub` helper that branches on `founderNameVerified` and scrubs `founderName` to None when unverified
- `packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` — Mirror of founder_bio with `subjectNameVerified` / `subjectName` / `subjectRole`
- `packages/pipeline/tests/agents/test_origin_story.py` — NEW: 4 tests (guidance content, schema shape, run smoke, voice isolation)
- `packages/pipeline/tests/agents/test_problem.py` — NEW: 5 tests (pdfContent shape locked, keyDataPoints must be 3, guidance mentions pdfContent, run smoke, voice isolation)
- `packages/pipeline/tests/agents/test_founder_bio.py` — REPLACED Wave 0 skeleton: 6 tests (verified path, role framing, default role, run smoke, voice isolation, scrub-when-unverified)
- `packages/pipeline/tests/agents/test_case_study.py` — NEW: 6 tests (verified path, anonymous path, default role 'a program participant', run smoke, voice isolation, scrub-when-unverified)

## Decisions Made

- **State field is `problem_statement` not `problem`** — preserved DispatchState §7 + validate_sections REQUIRED_FIELDS; the plan's example code used `result["problem"]` but the canonical field name takes precedence per CLAUDE.md "do not modify field names without checking API_CONTRACTS.md first." `acomplete(agent_id="problem", ...)` still uses `"problem"` because that matches the `MODEL_BY_AGENT` key.
- **Kept Phase 4 payload_builder functions** — plan said "REPLACE" the file but did not specify whether to keep the `_origin_story_payload` etc. helpers. Kept them with the new module so `deliberationEvents.payload` still carries `sectionName + headline + wordCount` for the live UI; dropping them would silently break the deliberation visualization.
- **snake_case `agent_node(name=...)` keys** — Phase 4 stubs used kebab-case ("origin-story"), but `MODEL_BY_AGENT` keys are snake_case ("origin_story"). Plan example used snake_case; following the canonical model-config key naming so `acomplete()` resolves correctly. Plan 05-08 SUMMARY established this precedent.
- **Default-valued Pydantic fields** — every field on every output model has a sensible default so `FakeOpenRouterClient.model_construct()` returns a populated-shape object in `EISENBALM_STUB_MODE=true`. Real-mode validation still rejects malformed LLM JSON via `with_structured_output`. Pattern inherited from Plan 05-05 Calibrator.
- **Explicit voice-isolation tests** — added a dedicated `test_*_voice_isolation` test per writer that patches `build_section_writer_prompt` with a side_effect capture, pollutes the state with sibling-section content, and asserts only the four whitelisted kwargs reach the helper. This is a stronger guarantee than grep-style code review.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `acomplete()` is kwargs-only; plan examples used positional args**
- **Found during:** Task 1 (OriginStoryWriter — pre-implementation read of `lib/openrouter_client.py`)
- **Issue:** Plan example called `acomplete("origin_story", messages, response_format=...)`. The real signature is `acomplete(*, agent_id, run_id, messages, response_format=None)` — kwargs-only with a required `run_id` parameter. STATE.md Plan 05-09 SUMMARY already flagged this as a "systemic plan-quality issue" (5/5 Phase-5 plans so far). Calling with positional args would have raised `TypeError`.
- **Fix:** Used kwargs-only in all four writers: `acomplete(agent_id="origin_story", run_id=run_id, messages=messages, response_format=OriginStoryOutput)`.
- **Files modified:** All 4 agent files
- **Verification:** All 21 unit tests pass in `EISENBALM_STUB_MODE=true`
- **Committed in:** ff31dab, 2724914, 05a6db0, be29236

**2. [Rule 2 - Missing critical] Plan example wrote `result["problem"]`, but `validate_sections` requires `state['problem_statement']`**
- **Found during:** Task 2 (ProblemWriter — cross-check with `agents/validate.py`)
- **Issue:** Plan's verify command and acceptance criteria mentioned `result["problem"]["pdfContent"]`. But `agents/validate.py:REQUIRED_FIELDS` lists `"problem_statement"` (not `"problem"`), and DispatchState §7 defines the field as `problem_statement: Optional[SectionContent]`. Using the wrong key would have made `validate_sections` fail with `partial-failure: missing sections ['problem_statement']`.
- **Fix:** ProblemWriter writes `state["problem_statement"]`; test_problem.py asserts `result["problem_statement"]["pdfContent"]…`. `acomplete(agent_id="problem", …)` still uses "problem" because that matches `MODEL_BY_AGENT["problem"]`. Two-name convention (agent_id "problem" ↔ state field `problem_statement`) coexists, mirroring Plan 05-08's `editor_gate_1` ↔ `editor_gate1` precedent.
- **Files modified:** `src/eisenbalm_pipeline/agents/problem.py`, `tests/agents/test_problem.py`
- **Verification:** `EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_problem.py -v` passes (5/5); `agents/validate.py:REQUIRED_FIELDS` lookup satisfied
- **Committed in:** 2724914

**3. [Rule 2 - Missing critical] Kept Phase 4 payload_builder functions**
- **Found during:** Task 1 (OriginStoryWriter — read of pre-existing stub)
- **Issue:** Plan's prescribed file content omits the `_origin_story_payload` / `_problem_payload` / etc. functions that Phase 4 stubs registered on `@agent_node(... payload_builder=...)`. Removing them would silently change deliberationEvents.payload from `{sectionName, headline, wordCount}` to `{}` — breaking the live deliberation UI's section-draft visualization without any test catching it (no unit test asserts payload shape).
- **Fix:** Preserved the four payload_builder functions verbatim from Phase 4 stubs, registered on the new `@agent_node` calls.
- **Files modified:** All 4 agent files
- **Verification:** Module imports cleanly; `agent_node` decorator accepts `payload_builder` kwarg; full agents suite stays green
- **Committed in:** ff31dab, 2724914, 05a6db0, be29236

---

**Total deviations:** 3 auto-fixed (1 bug from plan signature mismatch, 2 missing critical from plan omission)
**Impact on plan:** All three deviations are mechanical corrections required for the code to function correctly with the existing codebase. No scope creep. Voice isolation, verification branching, pdfContent contract, and AGT-17 modelVersions recording all delivered as specified.

## Issues Encountered

None. Plan structure (TDD task ordering, single-call-site invariant, paired test files) mapped cleanly onto existing Plan 05-03 (`build_section_writer_prompt`), Plan 05-04 (Wave 0 test infrastructure), and Plan 05-09 (verify_research booleans) outputs. All 21 unit tests written via TDD (RED → GREEN) on first try after the three auto-fixes were applied.

## User Setup Required

None — no external service configuration required. The four writers run unattended in `EISENBALM_STUB_MODE=true` (default for tests) and through OpenRouter when `EISENBALM_STUB_MODE=false` (the Phase 5 runtime default that Plan 05-14 owns flipping).

## Next Phase Readiness

- Plans 05-11 (BonusWriter + GameWriter), 05-12 (DesignAgent), and 05-13 (QA + EditorFinal) can now run in parallel — their inputs (origin_story, problem_statement, founder_bio, case_study) are populated by real Sonnet output rather than Phase 4 fixtures.
- Plan 05-14 (real-mode integration test) is unblocked from the writer side; it still depends on Plan 05-11 + 05-12 + 05-13 closing before end-to-end real-OpenRouter runs can be measured.
- Phase 6 (Publisher + WeasyPrint) can now write the locked `pdfContent` shape into Sanity's `weeklyIssue.problem.pdfContent` field without rework; the Pydantic constraints (3 keyDataPoints, locked field names) survive into Sanity through the JSON round-trip.

## Self-Check: PASSED

All 8 files exist on disk. All 4 task commits (ff31dab, 2724914, 05a6db0, be29236) exist in `git log --all`. 21 new unit tests pass; 80 total agents-suite tests pass (10 skipped for unrelated Wave-2 plans).

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
