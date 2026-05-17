---
phase: 05-agent-quality
plan: 11
subsystem: pipeline
tags: [bonus-writer, game-writer, agt-11, agt-12, agt-17, d-19, d-20, sonnet, structured-output, voice-isolation, security-prompt]

# Dependency graph
requires:
  - phase: 04-pipeline-skeleton
    provides: "@agent_node decorator (kwargs-only signature, locked), Phase 4 BonusWriter + GameWriter stub bodies (replaced), DispatchState['bonus'] + ['game'] fields, fixtures.bonus_output()/game_output() stub paths (no longer called)"
  - phase: 05-agent-quality
    provides: "lib/voice.VOICE_CONSTRAINTS, lib/openrouter_client.acomplete (kwargs-only with agent_id+run_id+messages+response_format), lib/llm_config MODEL_BY_AGENT['bonus']=Sonnet + MODEL_BY_AGENT['game']=Sonnet, Plan 05-04 skip-marked test skeletons (test_bonus.py + test_game.py — replaced)"
provides:
  - "Real Sonnet-driven BonusWriter body — replaces Phase 4 stub. Three-branch routing on state['style_brief']['bonusType']"
  - "Three Pydantic shapes: BigBudgetBonus (storyboards 3-5), JingleBonus (sunoAudioUrl always ''), SpecAdBonus (headline + body only)"
  - "Three internal prompt builders: _build_big_budget_prompt, _build_jingle_prompt, _build_spec_ad_prompt (D-19)"
  - "bonusType key tagged onto every emitted bonus dict so downstream (QA, Publisher, Studio) routes without re-reading style_brief"
  - "Jingle branch enforces sunoAudioUrl='' even if the model returned a URL (V2-01 deferred — Andrew fills manually)"
  - "Real Sonnet-driven GameWriter body — replaces Phase 4 stub"
  - "FORBIDDEN_CONSTRUCTS module-level constant: 10 deny-list entries verbatim (D-20). Mirrors Phase 7's renderer-level validator deny-list."
  - "_build_messages embeds FORBIDDEN_CONSTRUCTS in the system prompt verbatim (prompt-level defense; Phase 7 ships renderer-level enforcement)"
  - "GameOutput Pydantic: headline + description (50-100 word a11y summary) + embedCode (self-contained HTML/JS string for iframe srcdoc)"
  - "AGT-17 modelVersions['bonus'] + modelVersions['game'] capture (inherits pattern from Plans 05-05/05-08/05-09)"
affects: [05-13-qa-and-editor-final, 05-14-real-mode-integration-test, 06-pdf-and-webhook, 07-game-validator-and-renderer]

# Tech tracking
tech-stack:
  added: []  # no new pip deps; reuses Plan 05-03 lib scaffolding (acomplete + voice)
  patterns:
    - "Three-branch routing via internal prompt builders: a single @agent_node entry dispatches to _build_big_budget_prompt / _build_jingle_prompt / _build_spec_ad_prompt based on state['style_brief']['bonusType']. Each builder returns its own message list; the agent then calls acomplete() once with the branch-specific Pydantic schema. Future writers needing routing (e.g., podcast variants in V2) should follow this template."
    - "Branch-tagged output: BonusWriter writes out_dict['bonusType']=bonus_type onto the emitted dict so downstream consumers (QA layer-2 prompt assembly, Publisher's Sanity write, Studio's conditional field rendering) can route on a single key. Avoids re-reading state['style_brief'] in three different places."
    - "Manual-fill enforcement at the writer level: BonusWriter overwrites out_dict['sunoAudioUrl'] = '' for the jingle branch regardless of what the model returned. V2-01 is deferred to manual paste by Andrew. The writer doesn't trust the model not to invent a placeholder URL."
    - "Prompt-level defense constant: GameWriter declares FORBIDDEN_CONSTRUCTS as a module-level string and embeds it verbatim in the system prompt. The same string is asserted in tests for presence. Phase 7's renderer-level validator will mirror this constant (validator code will lift the deny-list from here or grep-match against the same strings). Single source of truth for the security contract."
    - "Sonnet + structured output: both writers use ChatOpenAI.with_structured_output(<PydanticModel>) via lib/openrouter_client.acomplete with response_format=. Stub-mode falls through to model_construct() (Pydantic defaults), so unit tests succeed under EISENBALM_STUB_MODE=true. Pattern inherited from Plans 05-05/05-07/05-09."

key-files:
  created:
    - .planning/phases/05-agent-quality/05-11-bonus-and-game-SUMMARY.md
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/game.py
    - packages/pipeline/tests/agents/test_bonus.py
    - packages/pipeline/tests/agents/test_game.py
    - .planning/phases/05-agent-quality/deferred-items.md

key-decisions:
  - "BonusWriter agent_id='bonus' (kebab name 'bonus' for @agent_node, matches MODEL_BY_AGENT['bonus']). GameWriter agent_id='game'. No naming divergence (unlike editor's editor_gate_1 vs editor_gate1 in Plan 05-08)."
  - "All Pydantic models (BigBudgetBonus, JingleBonus, SpecAdBonus, GameOutput, Storyboard) have field defaults on every scalar field. Same model_construct()-safety rationale as Plan 05-05's StyleBriefOutput and Plan 05-09's ResearchOutputModel — required for FakeOpenRouterClient stub-mode path."
  - "BigBudgetBonus.storyboards keeps min_length=3, max_length=5 validation from D-19 (defaults to empty list for stub-mode construct(), but real-mode JSON parse will reject lists outside that range). Test exercises a 4-storyboard fixture to confirm the assertion path."
  - "JingleBonus model has sunoAudioUrl as a regular str field with default=''; the agent body overwrites it to '' post-parse. Two-layer enforcement: schema default + body assignment. The body assignment is the load-bearing guard (the test passes 'https://attempted.example/x.mp3' to confirm the body clears it)."
  - "Tag bonusType onto the emitted dict (not just into the deliberationEvents payload). The payload-builder _bonus_payload already reads from the section dict, so this means the same key is visible to Sanity write code (Publisher), QA prompt assembly, and Studio rendering — all of which read state['bonus'] directly."
  - "GameWriter does NOT do any embedCode validation in Phase 5. Per D-20, prompt-level defense only; renderer-level enforcement is Phase 7. Tests assert FORBIDDEN_CONSTRUCTS is in the prompt but do NOT inspect the model's actual embedCode output for compliance — that's Phase 7's job (GAM-02 validator)."
  - "Decorator: bonus uses @agent_node(name='bonus', emit_event='section-draft', payload_builder=_bonus_payload). game uses @agent_node(name='game', emit_event='section-draft', payload_builder=_game_payload). Both emit one deliberationEvents row per successful run. Preserves Phase 4 stub decorator contract verbatim."
  - "Both writers consume only state['style_brief'], state['winning_charity'], and state['research'] (via prompt builders' callers — though Plan 05-11's builders don't read research directly; they could be extended later if Plan 05-13's QA flags missing mission grounding). Voice isolation (AGT-09) preserved by code: the prompt builders never read state['origin_story'] or any other section's output."

patterns-established:
  - "Three-branch routing template for any future multi-shape writer: keep one @agent_node entry, three (or N) private prompt builders, dispatch on a state field, tag the branch key onto the output."
  - "Security-critical prompt constants as module-level strings: declared once (FORBIDDEN_CONSTRUCTS), embedded verbatim in prompts, asserted directly in tests. Phase 7 renderer-level validator can lift the same constant or grep-match against it — single source of truth."

requirements-completed: [AGT-11, AGT-12]

# Metrics
duration: ~5min
completed: 2026-05-17
---

# Phase 5 Plan 11: BonusWriter + GameWriter Summary

**Two Phase 4 stub bodies replaced with real Sonnet-driven writers that emit structurally distinct outputs: BonusWriter routes on `state['style_brief']['bonusType']` to one of three branch-specific Pydantic shapes (storyboards / lyrics+sunoPrompt / plain copy); GameWriter emits self-contained HTML/JS for iframe srcdoc with the full forbidden-construct deny-list enumerated in its prompt.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-17T18:42:30Z
- **Completed:** 2026-05-17T18:46:57Z
- **Tasks:** 3 (TDD RED+GREEN for BonusWriter, TDD RED+GREEN for GameWriter, test bodies — Task 3 was satisfied by the TDD pairs)
- **Files modified:** 4 (bonus.py, game.py, test_bonus.py, test_game.py)
- **Tests added:** 5 (3 BonusWriter + 2 GameWriter). All pass. Full pipeline suite: 79 passed / 32 skipped / 0 failed.

## Accomplishments

### BonusWriter (AGT-11, D-19)

- Replaced the Phase 4 stub (3-line return of `fixtures.bonus_output()`) with a real Sonnet-driven body that:
  - Routes on `state['style_brief']['bonusType']` to one of three internal prompt builders.
  - **bigBudget** → `_build_big_budget_prompt(charity, style_brief)` → returns `BigBudgetBonus`: `{headline, body (200-400 words), storyboards: list[Storyboard]}` where `storyboards` has `min_length=3, max_length=5` and each `Storyboard` is `{shotNumber: int >= 1, description: str}`.
  - **jingle** → `_build_jingle_prompt(charity, style_brief)` → returns `JingleBonus`: `{headline, body (100-200 words), lyrics (8-16 lines), sunoPrompt (40-80 words, no AI reference), sunoAudioUrl: str = ""}`. Body code overwrites `sunoAudioUrl=""` post-parse regardless of model output (V2-01 deferred).
  - **specAd** → `_build_spec_ad_prompt(charity, style_brief)` → returns `SpecAdBonus`: `{headline, body (200-400 words)}` — simplest shape.
  - Tags `out_dict['bonusType'] = bonus_type` onto the emitted dict so downstream consumers (QA, Publisher, Studio) can route without re-reading `state['style_brief']`.
  - Records resolved model into `state['model_versions']['bonus']` (AGT-17).

### GameWriter (AGT-12, D-20)

- Replaced the Phase 4 stub with a real Sonnet-driven body that:
  - Declares `FORBIDDEN_CONSTRUCTS` as a module-level string containing all 10 deny-list entries from D-20 verbatim: `<script src="...">`, `<link href="...">`, `fetch(`, `XMLHttpRequest`, `window.parent`, `window.top`, `document.cookie`, `localStorage`, `eval(`, `import(`.
  - `_build_messages(charity)` embeds `FORBIDDEN_CONSTRUCTS` in the system prompt verbatim. Mirrors Phase 7's renderer-level validator deny-list at the prompt level (D-20).
  - Returns `GameOutput`: `{headline, description (50-100 word plain-text a11y summary), embedCode (self-contained HTML/JS for iframe srcdoc sandbox)}`.
  - Records resolved model into `state['model_versions']['game']` (AGT-17).
  - Phase 5 does NOT validate the embedCode output (no string-search against FORBIDDEN_CONSTRUCTS, no AST parse). That's Phase 7's GAM-02 validator — Phase 5 ships prompt-level defense only.

## Task Commits

1. **RED — BonusWriter failing tests** — `d9bdcf2` (`test(05-11): add failing tests for BonusWriter three-branch routing`)
2. **GREEN — BonusWriter implementation** — `c320e8a` (`feat(05-11): replace BonusWriter stub with three-branch routing (AGT-11, D-19)`)
3. **RED — GameWriter failing tests** — `3a3a187` (`test(05-11): add failing tests for GameWriter forbidden-construct prompt`)
4. **GREEN — GameWriter implementation** — `878155c` (`feat(05-11): replace GameWriter stub with forbidden-construct prompt (AGT-12, D-20)`)

_TDD pattern: RED commits fail at module import (ImportError on the new Pydantic symbols + FORBIDDEN_CONSTRUCTS constant); GREEN commits land the implementation and exercise it. REFACTOR pass skipped — implementations matched spec on first GREEN. Task 3 (test files) is satisfied by the test bodies already written in the RED commits._

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` — replaced Phase 4 stub. New module-level symbols: `Storyboard`, `BigBudgetBonus`, `JingleBonus`, `SpecAdBonus` (Pydantic models); `_build_big_budget_prompt`, `_build_jingle_prompt`, `_build_spec_ad_prompt` (private prompt builders); `_bonus_payload` (decorator payload builder). Total 217 lines (plan min: 130).
- `packages/pipeline/src/eisenbalm_pipeline/agents/game.py` — replaced Phase 4 stub. New module-level symbols: `FORBIDDEN_CONSTRUCTS` (deny-list constant), `GameOutput` (Pydantic model), `_build_messages` (private prompt builder), `_game_payload` (decorator payload builder, preserved from Phase 4). Total 121 lines (plan min: 100).
- `packages/pipeline/tests/agents/test_bonus.py` — replaced the 3 Plan 05-04 skip-marked stubs with 3 real assertions covering each branch (AGT-11). All pass.
- `packages/pipeline/tests/agents/test_game.py` — replaced the 1 Plan 05-04 skip-marked stub with 2 real assertions: forbidden-construct enumeration (sync) + GameOutput shape (async, AGT-12). All pass.
- `.planning/phases/05-agent-quality/deferred-items.md` — appended Plan 05-11 out-of-scope discoveries (pre-existing collection failures in test_problem.py + test_design.py — owned by Plans 05-10 + 05-12 respectively, both running in parallel and both committed during Plan 05-11 execution).

## Decisions Made

1. **Branch literal style:** code uses double-quoted Python string literals (`"bigBudget"`, `"jingle"`, `"specAd"`); plan verification grep used single-quoted shell strings. Both Python literals are semantically identical to the plan's intent (router on three branch keys). All three branch names appear in `bonus.py`.

2. **Field defaults on every Pydantic scalar.** `BigBudgetBonus.headline = ""`, `BigBudgetBonus.body = ""`, `Storyboard.shotNumber = 1`, `Storyboard.description = ""`, etc. Same `model_construct()`-safety rationale as Plan 05-05's `StyleBriefOutput` (recorded in STATE.md). Real-mode `with_structured_output` still enforces non-empty + length constraints via the LLM regenerate-on-fail path.

3. **`min_length=3, max_length=5` on `BigBudgetBonus.storyboards` retained.** Default value is `default_factory=list` (empty list, which fails the min_length constraint). Stub-mode `model_construct()` bypasses Pydantic validation entirely — so the empty default doesn't crash construction. Real-mode validation enforces the 3-5 range; tests exercise the path with a 4-storyboard fixture.

4. **`sunoAudioUrl=""` enforced at body level, not schema level alone.** `JingleBonus.sunoAudioUrl: str = ""` is a regular field with a default. The agent body has an explicit `if bonus_type == "jingle": out_dict["sunoAudioUrl"] = ""` line after the Pydantic parse. Two-layer enforcement matters because the test deliberately constructs a `JingleBonus(sunoAudioUrl="https://attempted.example/x.mp3")` to prove the body clears it. The schema default alone wouldn't protect against a model that hallucinates a URL.

5. **`bonusType` tagged on output (key extension beyond plan's documented shape).** Plan's `<interfaces>` block specified the three branch shapes but didn't mention `bonusType` as an output field. Tagging it serves three downstream consumers: QA layer-2 prompt assembly (which needs to know which fields to evaluate), Publisher's Sanity write (which conditionally serializes `lyrics`/`sunoPrompt`/`storyboards`), and Studio rendering (which uses `bonusType` to drive the radio button + conditional field visibility). Adds 1 line; saves three downstream re-reads of `state['style_brief']`.

6. **`FORBIDDEN_CONSTRUCTS` is a single module-level string (not a list).** Plan template wrote it as a triple-quoted multi-line string. Implementation matches verbatim. Phase 7's renderer-level validator can lift this constant directly (`from eisenbalm_pipeline.agents.game import FORBIDDEN_CONSTRUCTS`) or duplicate the same string in its own validator module. The constant-style declaration is the canonical form; tests grep for each token's presence inside the string.

7. **Decorator preserves `payload_builder=_bonus_payload` and `payload_builder=_game_payload` from Phase 4 stubs.** Plan template omitted the payload builders. Preserving them keeps the deliberationEvents payload format identical between Phase 4 stub and Phase 5 real mode (`{sectionName, bonusType, headline, wordCount}` for bonus; `{sectionName, headline, description}` for game). The live deliberation layer (Phase 9) reads these payloads; not changing the shape avoids a Phase 9 contract break.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `acomplete()` signature must use kwargs-only with `agent_id` + `run_id`**
- **Found during:** Task 1 implementation
- **Issue:** Plan's example code in `<action>` block called `acomplete("bonus", messages, response_format=response_format)` with positional args. Actual `lib/openrouter_client.acomplete` signature (Plan 05-03, locked) is kwargs-only AND requires `run_id` (used for cost recording + check_cap). Plan-as-written would raise `TypeError`. Same systemic plan-quality issue logged in Plan 05-09 SUMMARY ("acomplete kwargs-only signature mismatched in 5 of 5 voice-critical / Tavily-using agent plans").
- **Fix:** Used real signature `acomplete(agent_id="bonus", run_id=run_id, messages=messages, response_format=response_format)` in both `bonus.py` and `game.py`. Same correction Plans 05-05, 05-06, 05-07, 05-08, 05-09 all made.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py`, `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`
- **Verification:** 5/5 plan tests pass.
- **Committed in:** `c320e8a` (bonus) + `878155c` (game)

**2. [Rule 2 — Auto-add critical functionality] Field defaults on every Pydantic scalar**
- **Found during:** Task 1 + Task 2 implementation (writing the Pydantic models)
- **Issue:** Plan's Pydantic shapes in `<interfaces>` showed `headline: str`, `body: str`, `lyrics: str`, etc. as required (no default). But `lib/openrouter_client.acomplete` stub-mode branch uses `response_format.model_construct()` which would TypeError on missing required fields. Same issue Plans 05-05 + 05-09 hit and resolved (recorded in STATE.md).
- **Fix:** Added `default=""` to every string field, `default_factory=list` to list fields, `default=1` to `Storyboard.shotNumber`. Tests still exercise full-content construction (e.g., `BigBudgetBonus(headline='H', body='B'*300, storyboards=sb)`).
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py`, `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`
- **Verification:** `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.bonus import BigBudgetBonus; BigBudgetBonus.model_construct()"` → no error ✓
- **Committed in:** `c320e8a` (bonus) + `878155c` (game)

**3. [Rule 2 — Auto-add critical functionality] Preserve `payload_builder` from Phase 4 stub decorators**
- **Found during:** Task 1 + Task 2 implementation
- **Issue:** Plan's `<action>` block decorator omitted `payload_builder=` — wrote `@agent_node(name="bonus", emit_event="section-draft")` instead of preserving the Phase 4 stub's `payload_builder=_bonus_payload`. Without a payload builder, the deliberationEvents row's `payload` field would be an empty `{}` instead of the structured `{sectionName, bonusType, headline, wordCount}` shape that the Phase 9 deliberation UI subscribes to.
- **Fix:** Preserved both `_bonus_payload` and `_game_payload` helper functions (kept from Phase 4 stub bodies, updated `_bonus_payload` to prefer `section.get('bonusType')` over `state['style_brief']['bonusType']` since the body now tags `bonusType` onto the section dict). Decorator: `@agent_node(name="bonus", emit_event="section-draft", payload_builder=_bonus_payload)`.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py`, `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`
- **Verification:** Decorator preserved verbatim from Phase 4; deliberationEvents payload shape unchanged across Phase 4 → Phase 5.
- **Committed in:** `c320e8a` (bonus) + `878155c` (game)

**4. [Rule 2 — Auto-add critical functionality] Defensive `out_obj` dict extraction**
- **Found during:** Task 1 + Task 2 implementation
- **Issue:** Plan's `<action>` block used `out_obj.model_dump() if hasattr(out_obj, "model_dump") else dict(out_obj)`. But stub-mode can return a non-dict, non-Pydantic object (e.g., a raw string when `response_format` is not a Pydantic class — though in this plan's case it always is). Defensive third branch handles edge cases.
- **Fix:** Used Plan 05-09's three-branch pattern: `if hasattr(out_obj, "model_dump"): out_dict = out_obj.model_dump()` / `elif isinstance(out_obj, dict): out_dict = dict(out_obj)` / `else: out_dict = {}`. Matches Researcher pattern.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py`, `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`
- **Verification:** Tests pass under stub-mode (model_construct path) and real-mode mocks.
- **Committed in:** `c320e8a` (bonus) + `878155c` (game)

---

**Total deviations:** 4 auto-fixed (1 Rule 3 blocking — acomplete signature; 3 Rule 2 defensive add-ons). No scope creep; no architectural change. Pattern matches the 4 deviations Plan 05-09 hit, the 5 Plan 05-08 hit, and the 3 Plan 05-06 hit — all are plan-vs-actual-codebase mismatches caused by the plan author writing against an idealized contract rather than the actual locked code.

## Issues Encountered

- **The `acomplete` kwargs-only signature has now caused mismatches in 6 of 6 voice-critical / writer plans (05-05, 05-06, 05-07, 05-08, 05-09, 05-11).** Logged to STATE.md by Plan 05-09; this plan re-confirms the pattern. Future plans (05-10 Section Writers, 05-12 DesignAgent, 05-13 QA + Editor Final) should grep `acomplete(` in `agents/researcher.py` or `agents/calibrator.py` before publishing.

- **Pre-existing test_problem.py + test_design.py collection failures (out of scope):** When running the full pipeline test suite at Plan 05-11 start, `tests/agents/test_problem.py` and `tests/agents/test_design.py` failed at collection time with ImportError on symbols owned by Plans 05-10 (Section Writers) and 05-12 (DesignAgent). Pre-existed Plan 05-11 (verified via `git stash`). These errors resolved themselves when the parallel executor agents for Plans 05-10 and 05-12 pushed their GREEN commits (`ff31dab` + `e7d5005` + `2724914`) during Plan 05-11's execution window. By end of Plan 05-11, the full pipeline suite is 79 passed / 32 skipped / 0 failed.

- **No LLM live exercise.** All 5 tests run with `EISENBALM_STUB_MODE=true` and mock `acomplete` returns. The real Sonnet call path is exercised only by Plan 05-14's real-mode integration test. Plan 05-11 scope is correct here — unit tests should not hit OpenRouter.

## User Setup Required

None — no external service configuration required. Real OpenRouter calls require `OPENROUTER_API_KEY` (documented in Plan 05-03 `.env.example`). Plan 05-11 tests run entirely in stub mode.

## Next Phase Readiness

- **Plan 05-13 (QA + Editor Final):** Now sees `state['bonus']` with `bonusType` tagged on the dict — QA layer-2 prompt assembly can branch on this key to decide which fields to evaluate (e.g., evaluate `lyrics` + `sunoPrompt` only when `bonusType=='jingle'`). Same applies to QA's hard-rule layer-1 checking (e.g., the no-exclamation-marks rule applies to `bonus.body` for all branches, but only to `bonus.lyrics` when jingle).
- **Plan 05-14 (Real-mode integration test):** Both writers are ready for `EISENBALM_STUB_MODE=false` exercise. Sonnet structured-output for `BigBudgetBonus` (with nested `list[Storyboard]`) and `GameOutput` (with a long `embedCode` string field) are the most complex structured-output paths in Phase 5 — Plan 05-14 will surface any with_structured_output reliability issues here first.
- **Phase 6 (PDF + webhook):** Publisher's Sanity write code (Phase 6) reads `state['bonus']` and serializes to Sanity's `weeklyIssue.bonus` object. The Sanity schema has all jingle/bigBudget/specAd fields (lyrics, sunoPrompt, sunoAudioUrl, storyboards, body) and conditionally renders them by `bonusType`. The `bonusType` tag on the output dict simplifies that conditional serialization.
- **Phase 7 (Game validator + renderer):** Phase 7's renderer-level validator can `from eisenbalm_pipeline.agents.game import FORBIDDEN_CONSTRUCTS` and grep-match the same constant against the rendered `state['game']['embedCode']` string. Single source of truth for the deny-list — no copy-paste drift risk.
- **Phase 4 PIP-06 stub regression:** Still passes (Phase 4 PIP-06 runs `EISENBALM_STUB_MODE=true`; both writers' defensive dict extraction handles `model_construct()` empty output).

## Known Stubs

None introduced by this plan. The Phase 4 stub paths (`fixtures.bonus_output()` and `fixtures.game_output()`) are no longer called — both writers now run real code in real mode and `model_construct()` in stub mode.

V2-01 deferral (`sunoAudioUrl` left empty for Andrew to fill manually) is an intentional product decision per CONTEXT.md Out of Scope, not a stub. The writer enforces `''` at body level so the deferral is visible and explicit; Andrew sees an empty Sanity Studio field and knows to paste the Suno URL there.

## Self-Check: PASSED

- File `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py`: FOUND.
- File `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`: FOUND.
- File `packages/pipeline/tests/agents/test_bonus.py`: FOUND.
- File `packages/pipeline/tests/agents/test_game.py`: FOUND.
- File `.planning/phases/05-agent-quality/deferred-items.md`: FOUND (appended Plan 05-11 section).
- Commit `d9bdcf2` (test RED BonusWriter): FOUND in `git log --oneline`.
- Commit `c320e8a` (feat GREEN BonusWriter): FOUND in `git log --oneline`.
- Commit `3a3a187` (test RED GameWriter): FOUND in `git log --oneline`.
- Commit `878155c` (feat GREEN GameWriter): FOUND in `git log --oneline`.
- All 5 plan tests pass; full pipeline suite: 79 passed / 32 skipped / 0 failed.
- Plan verification commands:
  - `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.bonus import bonus, BigBudgetBonus, JingleBonus, SpecAdBonus, _build_big_budget_prompt, _build_jingle_prompt, _build_spec_ad_prompt, Storyboard; sb = [Storyboard(shotNumber=i+1, description='d'*100) for i in range(4)]; bb = BigBudgetBonus(headline='H', body='B'*300, storyboards=sb); assert len(bb.storyboards) == 4; j = JingleBonus(headline='H', body='B'*150, lyrics='L', sunoPrompt='S'*60); assert j.sunoAudioUrl == ''; print('OK')"` → `OK` ✓
  - `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.game import game, GameOutput, FORBIDDEN_CONSTRUCTS, _build_messages; assert '<script src' in FORBIDDEN_CONSTRUCTS; assert 'fetch(' in FORBIDDEN_CONSTRUCTS; assert 'XMLHttpRequest' in FORBIDDEN_CONSTRUCTS; assert 'window.parent' in FORBIDDEN_CONSTRUCTS; assert 'localStorage' in FORBIDDEN_CONSTRUCTS; assert 'eval(' in FORBIDDEN_CONSTRUCTS; m = _build_messages({'name': 'Foo'}); assert FORBIDDEN_CONSTRUCTS in m[0]['content']; print('OK')"` → `OK` ✓
  - `wc -l packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` → 217 (≥ 130) ✓
  - `wc -l packages/pipeline/src/eisenbalm_pipeline/agents/game.py` → 121 (≥ 100) ✓
  - `grep -c 'FORBIDDEN_CONSTRUCTS' packages/pipeline/src/eisenbalm_pipeline/agents/game.py` → 3 (≥ 2) ✓
  - `grep -c '"bigBudget"' packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` → 1 (≥ 1) ✓
  - `grep -c '"jingle"' packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` → 2 (≥ 1) ✓
  - `grep -c '"specAd"' packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` → 1 (≥ 1) ✓

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
