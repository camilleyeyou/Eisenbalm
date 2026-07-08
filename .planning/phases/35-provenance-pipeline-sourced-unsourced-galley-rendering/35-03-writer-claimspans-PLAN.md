---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
  - packages/pipeline/tests/agents/test_origin_story.py
  - packages/pipeline/tests/agents/test_problem.py
  - packages/pipeline/tests/agents/test_founder_bio.py
  - packages/pipeline/tests/agents/test_case_study.py
  - packages/pipeline/tests/agents/test_bonus.py
autonomous: true
requirements: [PRV-02]
must_haves:
  truths:
    - "The 5 prose writers (origin_story, problem, founder_bio, case_study, bonus SpecAd) accept and emit a flat claimSpans: list[ClaimSpanRef] sidecar next to body, with no oneOf in the schema"
    - "Each writer receives a terse claims whitelist (claimId + text) in its user prompt so it can reference claim IDs at generation time"
    - "claimIds the writer references that are not in the run's claims whitelist are dropped at validation (logged, never fatal)"
    - "The system message byte-equivalence voice-isolation invariant is unchanged (claims injection is user-prompt only)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py"
      provides: "ClaimSpanRef flat model"
      contains: "class ClaimSpanRef"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py"
      provides: "build_section_writer_prompt claims-whitelist injection"
      contains: "claimSpans"
  key_links:
    - from: "state['research']['claims']"
      to: "writer user prompt claims whitelist"
      via: "build_section_writer_prompt(claims=...)"
      pattern: "claims"
    - from: "writer out_dict['claimSpans']"
      to: "unknown-claimId drop"
      via: "intersect against valid claimIds after model_dump()"
      pattern: "claimId"
---

<objective>
Carry claim references forward from the Researcher into the writers' structured output at generation time (PRV-02, D-05/D-06/D-07). Prose writers gain a flat `claimSpans: [{claimId, asWritten}]` sidecar; they receive a terse claims whitelist in their user prompt so they can bind a body phrase to a real claim ID. Enforcement is lenient (drop unknown IDs, never raise).

Purpose: bindings survive into prose as generation-time declarations (the writer declares its own as-written phrase), never post-hoc fuzzy matching.
Output: `ClaimSpanRef` model, prompt injection, per-writer sidecar + whitelist-drop.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-CONTEXT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- blocks.py: flat BodyBlock; ClaimSpanRef must obey the same NO-oneOf discipline -->
class BodyBlock(BaseModel):
    type: Literal['paragraph', 'h2', 'h3', 'blockquote']
    text: str = ""

<!-- writer output model pattern (origin_story.py) -->
class OriginStoryOutput(BaseModel):
    headline: str = ""
    body: list[BodyBlock] = []
    @field_validator('body')  # _enforce_structural_floor
# writer returns: return {"origin_story": out_dict, "model_versions": {...}}  # claimSpans rides in out_dict

<!-- voice.py build_section_writer_prompt(*, section_id, section_title, section_guidance, charity, research, style_brief, voice_constraints=VOICE_CONSTRAINTS) -> [{role,content}] -->
<!-- research_lines block reads non-existent fields (foundingMoment/caseStudySubject/verifiedFacts) — KNOWN drift, leave as-is (§35). Only ADD the claims whitelist. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests — claimSpans emitted, unknown claimId dropped, claims whitelist injected</name>
  <files>packages/pipeline/tests/agents/test_origin_story.py, test_problem.py, test_founder_bio.py, test_case_study.py, test_bonus.py</files>
  <read_first>
    - packages/pipeline/tests/agents/test_origin_story.py (assertion + fake-acomplete style)
    - packages/pipeline/tests/agents/test_bonus.py (SpecAd branch handling)
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
  </read_first>
  <behavior>
    - build_section_writer_prompt(..., claims=[{"claimId":"a-0","text":"$2.3M budget"}]) puts "a-0" AND "$2.3M budget" into the USER message content (system message unchanged).
    - build_section_writer_prompt with no claims still returns a valid 2-message list (no crash, no claims header).
    - Each of the 5 prose writers, run with research claims [{"claimId":"a-0",...}] and a fake output whose claimSpans = [{"claimId":"a-0","asWritten":"x"},{"claimId":"ZZZ","asWritten":"y"}], produces state[<section>]["claimSpans"] containing ONLY the "a-0" span (the unknown "ZZZ" dropped, run does not raise).
    - The system message from build_section_writer_prompt is byte-identical whether or not claims are passed (voice isolation).
  </behavior>
  <action>
    Extend the 5 writer test files (test_origin_story.py, test_problem.py, test_founder_bio.py, test_case_study.py, test_bonus.py) with the drop-unknown-claimId assertion, and add a build_section_writer_prompt claims-injection test (place it in test_origin_story.py or the existing voice test that imports build_section_writer_prompt). Use the existing fake-acomplete plumbing; for bonus, exercise the SpecAd branch (D-06). These must be RED now.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/agents/test_origin_story.py -x -q; test $? -ne 0 && echo "RED-as-expected"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "claimSpans" packages/pipeline/tests/agents/test_origin_story.py packages/pipeline/tests/agents/test_bonus.py` matches
    - `grep -rn "ZZZ\|unknown\|drop" packages/pipeline/tests/agents/test_origin_story.py` shows the drop-unknown assertion
    - Running test_origin_story.py currently FAILS (RED gate)
  </acceptance_criteria>
  <done>RED assertions encode claimSpans emission, unknown-claimId drop, and user-prompt-only claims injection.</done>
</task>

<task type="auto">
  <name>Task 2: Add ClaimSpanRef model + claims-whitelist injection in build_section_writer_prompt</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py, packages/pipeline/src/eisenbalm_pipeline/lib/voice.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py (full — mirror BodyBlock flat discipline)
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py L216-291 (build_section_writer_prompt)
    - docs/API_CONTRACTS.md §35 (ClaimSpanRef + claims shape)
  </read_first>
  <action>
    1. In graph/blocks.py, add below BodyBlock (NO oneOf / no discriminated union — same reason as BodyBlock's docstring incident):
    ```python
    class ClaimSpanRef(BaseModel):
        """Phase 35 D-05 — a writer's declaration that a body phrase carries a research claim.
        claimId references state['research']['claims'][].claimId; asWritten is the verbatim
        phrase as the writer wrote it in the body (handles rewording)."""
        claimId: str = ""
        asWritten: str = ""
    ```
    2. In voice.py::build_section_writer_prompt, add keyword param `claims: list[dict[str, Any]] | None = None` (list of {claimId, text} — terse; per Research Pitfall 7 cost note, claimId + text only, no URL/context). Build a claims block ONLY in the USER message (never the system message). Format:
    ```
    SOURCEABLE CLAIMS (reference by id in claimSpans when you state one in the body):
      [a-0] $2.3M budget
      [a-1] founded 1998
    For every sourceable claim you state in the body, add a claimSpans entry {claimId, asWritten} where asWritten is the exact phrase as you wrote it.
    ```
    Append it to the user string BEFORE the "Return valid JSON…" line. When claims is None/empty, emit nothing. Do NOT modify the `system` string or the existing (known-empty) research_lines block.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/test_voice.py tests/test_section_writer_voice_propagation.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "class ClaimSpanRef" packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` matches
    - `grep -n "claims:" packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` shows the new param on build_section_writer_prompt
    - `grep -n "SOURCEABLE CLAIMS\|claimSpans" packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` shows user-message injection
    - `uv run pytest tests/test_voice.py tests/test_section_writer_voice_propagation.py -x -q` passes (system-message byte-equivalence guard still green)
  </acceptance_criteria>
  <done>ClaimSpanRef exists; build_section_writer_prompt injects a terse claims whitelist into the user prompt only; voice byte-equivalence preserved.</done>
</task>

<task type="auto">
  <name>Task 3: Add claimSpans to the 5 prose writers + wire claims + drop unknown claimIds</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/{origin_story,problem,founder_bio,case_study,bonus}.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py (full — canonical pattern)
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py (SpecAdBonus branch only — D-06)
  </read_first>
  <action>
    Apply the SAME change to each of origin_story.py, problem.py, founder_bio.py, case_study.py, and bonus.py (SpecAdBonus output model + SpecAd code path ONLY):
    1. Import ClaimSpanRef from eisenbalm_pipeline.graph.blocks (alongside BodyBlock).
    2. On the writer's Output Pydantic model, add `claimSpans: list[ClaimSpanRef] = []` (additive; NOT part of _enforce_structural_floor).
    3. In the agent function, compute and pass the claims whitelist:
    ```python
    claims = [{"claimId": c["claimId"], "text": c["text"]}
              for c in (state.get("research") or {}).get("claims", [])]
    ```
    and pass `claims=claims` into build_section_writer_prompt(...).
    4. After `out_dict = out_obj.model_dump()` (after the existing defensive dict extraction), add the D-07 lenient drop:
    ```python
    valid_ids = {c["claimId"] for c in (state.get("research") or {}).get("claims", [])}
    spans = out_dict.get("claimSpans") or []
    kept = [s for s in spans if s.get("claimId") in valid_ids]
    if len(spans) != len(kept):
        import logging
        logging.getLogger(__name__).info(
            "%s: dropped %d claimSpan(s) with unknown claimId (D-07 lenient)",
            "<section_id>", len(spans) - len(kept),
        )
    out_dict["claimSpans"] = kept
    ```
    (replace "<section_id>" with the writer's id string).
    5. claimSpans rides inside out_dict, returned under the writer's own section key — no change to the return-only-owned-keys rule. Do NOT forward claimSpans to Sanity (write_issue_draft already whitelists headline/body — Research Pitfall 5; nothing to do).
    For bonus.py: apply steps 1-4 ONLY to the SpecAdBonus output model / SpecAd path. Leave BigBudgetBonus and JingleBonus untouched (D-06 — non-prose exempt).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/agents/test_origin_story.py tests/agents/test_problem.py tests/agents/test_founder_bio.py tests/agents/test_case_study.py tests/agents/test_bonus.py tests/test_writer_structural_floor.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rln "claimSpans: list\[ClaimSpanRef\]" packages/pipeline/src/eisenbalm_pipeline/agents/{origin_story,problem,founder_bio,case_study,bonus}.py` lists all 5 files
    - `grep -rn "unknown claimId (D-07" packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` matches (drop logging present)
    - `grep -n "BigBudgetBonus\|JingleBonus" packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` confirms those models are NOT given claimSpans (D-06)
    - `uv run pytest tests/agents/test_origin_story.py tests/agents/test_problem.py tests/agents/test_founder_bio.py tests/agents/test_case_study.py tests/agents/test_bonus.py tests/test_writer_structural_floor.py -x -q` passes (GREEN)
  </acceptance_criteria>
  <done>All 5 prose writers emit claimSpans, receive the claims whitelist, and drop unknown claimIds leniently; structural-floor + writer tests green; bonus non-prose branches untouched.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/agents -x -q` passes for all writer tests.
- Regression: `cd packages/pipeline && uv run pytest -x -q` stays green; the Phase 16 voice byte-equivalence sentinel + test_section_writer_voice_propagation stay green.
</verification>

<success_criteria>
PRV-02 (writer half): claim references established at generation time via the claimSpans sidecar; lenient enforcement; voice isolation preserved.
</success_criteria>

<output>
After completion, create `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-03-SUMMARY.md`
</output>
