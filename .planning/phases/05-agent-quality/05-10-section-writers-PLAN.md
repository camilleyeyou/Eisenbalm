---
phase: 05-agent-quality
plan: 10
type: execute
wave: 5
depends_on:
  - "05-09"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
  - packages/pipeline/tests/agents/test_origin_story.py
  - packages/pipeline/tests/agents/test_problem.py
  - packages/pipeline/tests/agents/test_founder_bio.py
  - packages/pipeline/tests/agents/test_case_study.py
autonomous: true
requirements_addressed:
  - AGT-09
  - AGT-10
must_haves:
  truths:
    - "All four section writers (OriginStory, Problem, FounderBio, CaseStudy) call lib/voice.build_section_writer_prompt() — no writer assembles its own prompt ad-hoc (AGT-09 / D-13)"
    - "FounderBioWriter switches to role-based framing when state['research']['founderNameVerified']=False (AGT-10 / D-12)"
    - "CaseStudyWriter switches to role-based framing when state['research']['subjectNameVerified']=False (AGT-10 / D-12)"
    - "When *Verified=False, the writer omits *Name from the research dict passed into build_section_writer_prompt (RESEARCH Pitfall 5)"
    - "ProblemWriter emits pdfContent {problemStatement, keyDataPoints (3 items), interventionMechanism} — Phase 6 contract surface (do NOT rename fields)"
    - "Section writers run on Sonnet (D-05); modelVersions populated per writer (AGT-17)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py"
      provides: "Real Sonnet-driven OriginStoryWriter body"
      min_lines: 70
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/problem.py"
      provides: "Real Sonnet-driven ProblemWriter with pdfContent (Phase 6 contract)"
      min_lines: 80
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py"
      provides: "Real Sonnet-driven FounderBioWriter with verified/anonymous branching"
      min_lines: 80
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py"
      provides: "Real Sonnet-driven CaseStudyWriter with verified/anonymous branching"
      min_lines: 80
  key_links:
    - from: "agents/{origin_story,problem,founder_bio,case_study}.py"
      to: "lib/voice.build_section_writer_prompt"
      via: "single canonical prompt assembler (D-13)"
      pattern: "build_section_writer_prompt"
    - from: "agents/founder_bio.py + agents/case_study.py"
      to: "state['research']['founderNameVerified'] / ['subjectNameVerified']"
      via: "conditional prompt branching + research-dict scrubbing (D-12)"
      pattern: "founderNameVerified"
---

<objective>
Replace four Phase 4 stub bodies with real Sonnet-driven section writers. These four are grouped because they all consume `state['research']` + `state['style_brief']` + `state['winning_charity']` and all call the same `lib/voice.build_section_writer_prompt()` helper. BonusWriter (Plan 05-11) and GameWriter (Plan 05-11) get their own plan because they emit structurally distinct outputs.

Three concerns:

1. **Voice isolation (AGT-09, D-13):** Every writer assembles its prompt through `lib/voice.build_section_writer_prompt(voice_constraints, section_id, section_title, section_guidance, charity, research, style_brief)`. The function receives ONLY the four whitelisted state slices — never `state['origin_story']` or any other section's output. This is enforced by code: writers never read sibling-section state.

2. **Conditional anonymous framing (AGT-10, D-12):** FounderBioWriter and CaseStudyWriter receive an additional `bool` (`founderNameVerified` / `subjectNameVerified`) extracted from `state['research']`. Two prompt guidance strings live inside each writer module — one for the verified path, one for the role-only path. Critically per RESEARCH Pitfall 5: when verified=False, the writer SCRUBS `founderName` / `subjectName` from the `research` dict it passes to `build_section_writer_prompt` to prevent model hallucination.

3. **ProblemWriter pdfContent (forward-link to Phase 6):** ProblemWriter's Pydantic output includes a nested `PdfContent { problemStatement, keyDataPoints: list[dict] (exactly 3 items, each {stat, source}), interventionMechanism }`. Field names are Phase 6's WeasyPrint template contract — do NOT rename without coordinating Phase 6. Same shape lives in `weeklyIssue.problem.pdfContent` per docs/API_CONTRACTS §2.2.

OriginStoryWriter and ProblemWriter have no verification branching (they don't name people). FounderBioWriter and CaseStudyWriter each get a conditional branch.

Output: 4 agent files replaced + 4 test files replaced.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
@packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
@packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
@packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
@packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@docs/CLAUDE_CODE_BRIEF.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- lib/voice.build_section_writer_prompt (Plan 05-03) -->
```python
def build_section_writer_prompt(
    *,
    voice_constraints: str = VOICE_CONSTRAINTS,
    section_id: str,
    section_title: str,
    section_guidance: str,
    charity: dict,
    research: dict,
    style_brief: dict,
) -> list[dict]: ...
```

<!-- Per-writer Pydantic outputs (RESEARCH lines 588-666) -->
```python
class OriginStoryOutput(BaseModel):
    headline: str
    body: str

class PdfContent(BaseModel):
    problemStatement: str       # <=150 words
    keyDataPoints: list[dict]   # exactly 3 items: [{"stat": str, "source": str}]
    interventionMechanism: str  # <=100 words

class ProblemOutput(BaseModel):
    headline: str
    body: str
    pdfContent: PdfContent  # Phase 6 contract — do NOT rename

class FounderBioOutput(BaseModel):
    headline: str
    body: str

class CaseStudyOutput(BaseModel):
    headline: str
    body: str
```

<!-- Conditional guidance strings (RESEARCH lines 624-660) -->
<!-- FounderBio: -->
<!--   IF founderNameVerified: "400-600 word biography of {founderName}..." -->
<!--   ELSE: "400-600 word biography of the {founderRole}... -->
<!--          CRITICAL: Do NOT use or guess a name. Refer by role only..." -->
<!-- CaseStudy: same pattern with subjectName/subjectRole -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace OriginStoryWriter stub with real Sonnet-driven body</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"OriginStoryWriter" lines 579-595
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (build_section_writer_prompt)
    - docs/CLAUDE_CODE_BRIEF.md lines 158-167 (OriginStory contract)
  </read_first>

  <action>
  REPLACE `packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` with:

  ```python
  """Phase 5 OriginStoryWriter — Sonnet via OpenRouter.

  Replaces Phase 4 stub. Voice-isolation enforced by lib/voice.build_section_writer_prompt().
  """
  from __future__ import annotations

  from pydantic import BaseModel

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.voice import build_section_writer_prompt


  SECTION_GUIDANCE: str = (
      "400-600 words. Cover: the founding moment, early obstacles, the "
      "\"why this and not something else\" question answered without "
      "sentiment. Fortune-500 treatment: precision over poetry. No "
      "adjectives that are also compliments."
  )


  class OriginStoryOutput(BaseModel):
      headline: str
      body: str


  @agent_node(name="origin_story", emit_event="section-draft")
  async def origin_story(state: DispatchState) -> DispatchState:
      messages = build_section_writer_prompt(
          section_id="origin_story",
          section_title="Origin Story",
          section_guidance=SECTION_GUIDANCE,
          charity=state.get("winning_charity") or {},
          research=state.get("research") or {},
          style_brief=state.get("style_brief") or {},
      )
      out_obj, usage = await acomplete(
          "origin_story", messages, response_format=OriginStoryOutput,
      )
      out_dict = (
          out_obj.model_dump() if hasattr(out_obj, "model_dump") else dict(out_obj)
      )
      model_versions = dict(state.get("model_versions") or {})
      model_versions["origin_story"] = usage["resolved_model"]
      return {
          **state,
          "origin_story": out_dict,
          "model_versions": model_versions,
      }
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.origin_story import origin_story, OriginStoryOutput, SECTION_GUIDANCE; assert 'Fortune-500' in SECTION_GUIDANCE; assert OriginStoryOutput.model_fields.keys() == {'headline','body'}; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/origin_story.py` imports `build_section_writer_prompt` from `lib.voice`
    - `agents/origin_story.py` calls `build_section_writer_prompt` exactly once
    - Decorator: `@agent_node(name="origin_story", emit_event="section-draft")`
    - Return dict contains `origin_story` (headline + body) and `model_versions`
    - `agents/origin_story.py` does NOT read `state['problem']`, `state['founder_bio']`, or any other sibling section (voice isolation; verify by grep)
  </acceptance_criteria>

  <done>
  OriginStoryWriter runs via build_section_writer_prompt; voice-isolated.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace ProblemWriter stub with real Sonnet-driven body (pdfContent included)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/problem.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"ProblemWriter" lines 597-619
    - docs/CLAUDE_CODE_BRIEF.md lines 169-179 (Problem contract — pdfContent forward-link to Phase 6)
    - docs/API_CONTRACTS.md §2.2 weeklyIssue.problem.pdfContent shape
  </read_first>

  <action>
  REPLACE `packages/pipeline/src/eisenbalm_pipeline/agents/problem.py` with:

  ```python
  """Phase 5 ProblemWriter — Sonnet via OpenRouter.

  Replaces Phase 4 stub. Emits pdfContent — Phase 6 WeasyPrint contract.
  Field names locked: problemStatement, keyDataPoints (exactly 3 items each
  with stat + source), interventionMechanism. DO NOT rename.
  """
  from __future__ import annotations

  from pydantic import BaseModel, Field

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.voice import build_section_writer_prompt


  SECTION_GUIDANCE: str = (
      "400-600 words. Cover: the precise problem (with statistics), why "
      "existing institutions fail to solve it, and how the charity's "
      "approach differs. Include pdfContent: problemStatement (<=150 words), "
      "keyDataPoints (exactly 3 items, each with `stat` and `source`), "
      "interventionMechanism (<=100 words). pdfContent is the Phase 6 "
      "WeasyPrint template input — do not rename fields."
  )


  class KeyDataPoint(BaseModel):
      stat: str
      source: str


  class PdfContent(BaseModel):
      problemStatement: str = Field(description="<=150 words")
      keyDataPoints: list[KeyDataPoint] = Field(min_length=3, max_length=3)
      interventionMechanism: str = Field(description="<=100 words")


  class ProblemOutput(BaseModel):
      headline: str
      body: str
      pdfContent: PdfContent


  @agent_node(name="problem", emit_event="section-draft")
  async def problem(state: DispatchState) -> DispatchState:
      messages = build_section_writer_prompt(
          section_id="problem",
          section_title="Problem Statement",
          section_guidance=SECTION_GUIDANCE,
          charity=state.get("winning_charity") or {},
          research=state.get("research") or {},
          style_brief=state.get("style_brief") or {},
      )
      out_obj, usage = await acomplete(
          "problem", messages, response_format=ProblemOutput,
      )
      out_dict = (
          out_obj.model_dump() if hasattr(out_obj, "model_dump") else dict(out_obj)
      )
      model_versions = dict(state.get("model_versions") or {})
      model_versions["problem"] = usage["resolved_model"]
      return {
          **state,
          "problem": out_dict,
          "model_versions": model_versions,
      }
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.problem import problem, ProblemOutput, PdfContent, KeyDataPoint; pc = PdfContent(problemStatement='x', keyDataPoints=[KeyDataPoint(stat='s', source='u')]*3, interventionMechanism='y'); assert len(pc.keyDataPoints) == 3; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/problem.py` defines `PdfContent` with exactly 3 fields: `problemStatement`, `keyDataPoints`, `interventionMechanism`
    - `PdfContent.keyDataPoints` is `list[KeyDataPoint]` with `min_length=3, max_length=3` Pydantic constraint
    - `ProblemOutput` includes `headline`, `body`, `pdfContent`
    - Decorator: `@agent_node(name="problem", emit_event="section-draft")`
    - Return dict contains `problem` (with pdfContent) and `model_versions`
    - **Prompt-isolation invariant (W4):** `agents/problem.py` does NOT read `state['origin_story']`, `state['founder_bio']`, `state['case_study']`, `state['game']`, or `state['bonus']` (no cross-section state leakage in the prompt; verify by `grep -E "state\[.(origin_story|founder_bio|case_study|game|bonus)." agents/problem.py` returns zero matches)
  </acceptance_criteria>

  <done>
  ProblemWriter emits Phase 6-compatible pdfContent shape.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Replace FounderBioWriter with verified/anonymous branching</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"FounderBioWriter" lines 623-644
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Pitfall 5" lines 1594-1602 (scrub name when unverified)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-12 (anonymous-by-role framing)
  </read_first>

  <behavior>
    - Test 1 (test_verified_path): research has founderName='Jane Doe', founderNameVerified=True; assert prompt contains "Jane Doe".
    - Test 2 (test_anonymous_path): research has founderName='Jane Doe', founderNameVerified=False; assert prompt does NOT contain "Jane Doe" AND contains role-only guidance.
  </behavior>

  <action>
  REPLACE `packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py` with:

  ```python
  """Phase 5 FounderBioWriter — Sonnet via OpenRouter.

  Replaces Phase 4 stub. Branches on state['research']['founderNameVerified']:
    - True  → write biography by name (Fortune-500 treatment)
    - False → role-only framing; scrub founderName from research dict before
              passing to build_section_writer_prompt (Pitfall 5)
  """
  from __future__ import annotations

  from pydantic import BaseModel

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.voice import build_section_writer_prompt


  GUIDANCE_VERIFIED: str = (
      "400-600 word biography of the named founder. Fortune-500 treatment. "
      "Present professional trajectory with precision. Do not editorialize. "
      "The name is verified; use it freely."
  )

  GUIDANCE_ANONYMOUS: str = (
      "400-600 word biography of the {role} of the charity. "
      "CRITICAL: Do NOT use or guess a name. Refer by role only: "
      "\"The {role}\", \"they\", \"their\". The anonymity is intentional "
      "and professional — frame it as standard Fortune-500 anonymity."
  )


  class FounderBioOutput(BaseModel):
      headline: str
      body: str


  def _select_guidance_and_scrub(research: dict) -> tuple[str, dict]:
      """Return (guidance, scrubbed_research). Per Pitfall 5: when
      founderNameVerified=False, REMOVE founderName from research before
      passing into the prompt to prevent model hallucination."""
      verified = bool(research.get("founderNameVerified"))
      if verified:
          return GUIDANCE_VERIFIED, dict(research)

      role = research.get("founderRole") or "founder"
      scrubbed = {k: v for k, v in research.items() if k != "founderName"}
      scrubbed["founderName"] = None  # explicit null
      return GUIDANCE_ANONYMOUS.format(role=role), scrubbed


  @agent_node(name="founder_bio", emit_event="section-draft")
  async def founder_bio(state: DispatchState) -> DispatchState:
      research = state.get("research") or {}
      guidance, scrubbed_research = _select_guidance_and_scrub(research)

      messages = build_section_writer_prompt(
          section_id="founder_bio",
          section_title="Founder Bio",
          section_guidance=guidance,
          charity=state.get("winning_charity") or {},
          research=scrubbed_research,
          style_brief=state.get("style_brief") or {},
      )
      out_obj, usage = await acomplete(
          "founder_bio", messages, response_format=FounderBioOutput,
      )
      out_dict = (
          out_obj.model_dump() if hasattr(out_obj, "model_dump") else dict(out_obj)
      )
      model_versions = dict(state.get("model_versions") or {})
      model_versions["founder_bio"] = usage["resolved_model"]
      return {
          **state,
          "founder_bio": out_dict,
          "model_versions": model_versions,
      }
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.founder_bio import _select_guidance_and_scrub, GUIDANCE_VERIFIED, GUIDANCE_ANONYMOUS; g1, r1 = _select_guidance_and_scrub({'founderName': 'Jane', 'founderNameVerified': True}); assert 'verified; use it' in g1; assert r1['founderName'] == 'Jane'; g2, r2 = _select_guidance_and_scrub({'founderName': 'Jane', 'founderNameVerified': False, 'founderRole': 'director'}); assert 'Do NOT use or guess' in g2; assert r2['founderName'] is None; assert 'director' in g2; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/founder_bio.py` defines both `GUIDANCE_VERIFIED` and `GUIDANCE_ANONYMOUS`
    - `_select_guidance_and_scrub({...verified=True})` returns guidance containing "verified" (or similar) AND research with founderName preserved
    - `_select_guidance_and_scrub({...verified=False, ..., role='X'})` returns guidance containing "Do NOT use or guess a name" AND research with founderName=None
    - Decorator: `@agent_node(name="founder_bio", emit_event="section-draft")`
    - **Prompt-isolation invariant (W4):** `agents/founder_bio.py` does NOT read `state['origin_story']`, `state['problem']`, `state['case_study']`, `state['game']`, or `state['bonus']` (no cross-section state leakage in the prompt; verify by `grep -E "state\[.(origin_story|problem|case_study|game|bonus)." agents/founder_bio.py` returns zero matches)
  </acceptance_criteria>

  <done>
  FounderBioWriter correctly branches on founderNameVerified; scrubs founderName when unverified.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Replace CaseStudyWriter with verified/anonymous branching</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"CaseStudyWriter" lines 646-666
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-12 (anonymous-by-role framing)
  </read_first>

  <action>
  REPLACE `packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` with:

  ```python
  """Phase 5 CaseStudyWriter — Sonnet via OpenRouter.

  Replaces Phase 4 stub. Branches on state['research']['subjectNameVerified']:
    - True  → case study by subject name
    - False → role-only framing; scrub subjectName from research dict
              (Pitfall 5 mirror)
  """
  from __future__ import annotations

  from pydantic import BaseModel

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.voice import build_section_writer_prompt


  GUIDANCE_VERIFIED: str = (
      "400-600 word case study about the named subject. Present situation "
      "before and after the charity's intervention with measurable outcomes. "
      "The name is verified; use it freely."
  )

  GUIDANCE_ANONYMOUS: str = (
      "400-600 word case study about {role}. "
      "CRITICAL: Do NOT name the subject. Refer by role: "
      "\"a {role}\", \"they\", \"their\". This is standard privacy practice "
      "for this category of charity."
  )


  class CaseStudyOutput(BaseModel):
      headline: str
      body: str


  def _select_guidance_and_scrub(research: dict) -> tuple[str, dict]:
      verified = bool(research.get("subjectNameVerified"))
      if verified:
          return GUIDANCE_VERIFIED, dict(research)

      role = research.get("subjectRole") or "a program participant"
      scrubbed = {k: v for k, v in research.items() if k != "subjectName"}
      scrubbed["subjectName"] = None
      return GUIDANCE_ANONYMOUS.format(role=role), scrubbed


  @agent_node(name="case_study", emit_event="section-draft")
  async def case_study(state: DispatchState) -> DispatchState:
      research = state.get("research") or {}
      guidance, scrubbed_research = _select_guidance_and_scrub(research)

      messages = build_section_writer_prompt(
          section_id="case_study",
          section_title="Case Study",
          section_guidance=guidance,
          charity=state.get("winning_charity") or {},
          research=scrubbed_research,
          style_brief=state.get("style_brief") or {},
      )
      out_obj, usage = await acomplete(
          "case_study", messages, response_format=CaseStudyOutput,
      )
      out_dict = (
          out_obj.model_dump() if hasattr(out_obj, "model_dump") else dict(out_obj)
      )
      model_versions = dict(state.get("model_versions") or {})
      model_versions["case_study"] = usage["resolved_model"]
      return {
          **state,
          "case_study": out_dict,
          "model_versions": model_versions,
      }
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.case_study import _select_guidance_and_scrub; g, r = _select_guidance_and_scrub({'subjectName': 'Alex', 'subjectNameVerified': False, 'subjectRole': 'a parent'}); assert 'Do NOT name the subject' in g; assert r['subjectName'] is None; assert 'a parent' in g; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/case_study.py` defines both `GUIDANCE_VERIFIED` and `GUIDANCE_ANONYMOUS`
    - `_select_guidance_and_scrub({...verified=False})` returns research with `subjectName=None`
    - Decorator: `@agent_node(name="case_study", emit_event="section-draft")`
    - **Prompt-isolation invariant (W4):** `agents/case_study.py` does NOT read `state['origin_story']`, `state['problem']`, `state['founder_bio']`, `state['game']`, or `state['bonus']` (no cross-section state leakage in the prompt; verify by `grep -E "state\[.(origin_story|problem|founder_bio|game|bonus)." agents/case_study.py` returns zero matches)
  </acceptance_criteria>

  <done>
  CaseStudyWriter correctly branches on subjectNameVerified; scrubs subjectName when unverified.
  </done>
</task>

<task type="auto">
  <name>Task 5: Implement four section-writer test files</name>
  <files>packages/pipeline/tests/agents/test_origin_story.py, packages/pipeline/tests/agents/test_problem.py, packages/pipeline/tests/agents/test_founder_bio.py, packages/pipeline/tests/agents/test_case_study.py</files>

  <read_first>
    - packages/pipeline/tests/agents/{test_origin_story.py,test_problem.py,test_founder_bio.py,test_case_study.py} (Plan 05-04 skeletons)
    - packages/pipeline/src/eisenbalm_pipeline/agents/{origin_story,problem,founder_bio,case_study}.py (just-implemented from Tasks 1-4)
  </read_first>

  <action>
  Implement each test file. The test pattern is identical for all four; here's the canonical FounderBio test (the verification-branching test required by AGT-10) — adapt for the other three by stripping the verification branch logic.

  **`tests/agents/test_origin_story.py`:**
  ```python
  from unittest.mock import AsyncMock, patch
  import pytest
  from eisenbalm_pipeline.agents.origin_story import OriginStoryOutput, origin_story

  @pytest.mark.asyncio
  async def test_origin_story_runs(sample_dispatch_state) -> None:
      """AGT-09: writer calls build_section_writer_prompt (voice isolation)."""
      out = OriginStoryOutput(headline="H", body="B")
      with patch(
          "eisenbalm_pipeline.agents.origin_story.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6",
          })),
      ):
          result = await origin_story(sample_dispatch_state)
      assert result["origin_story"]["headline"] == "H"
      assert result["origin_story"]["body"] == "B"
      assert "origin_story" in result["model_versions"]
  ```

  **`tests/agents/test_problem.py`:** Same shape, plus an assertion that `result["problem"]["pdfContent"]["keyDataPoints"]` has length 3:
  ```python
  from unittest.mock import AsyncMock, patch
  import pytest
  from eisenbalm_pipeline.agents.problem import KeyDataPoint, PdfContent, ProblemOutput, problem

  @pytest.mark.asyncio
  async def test_problem_pdf_content(sample_dispatch_state) -> None:
      """AGT-09 + Phase 6 contract: pdfContent shape passes through."""
      pdf = PdfContent(
          problemStatement="ps",
          keyDataPoints=[KeyDataPoint(stat="s1", source="u1"),
                         KeyDataPoint(stat="s2", source="u2"),
                         KeyDataPoint(stat="s3", source="u3")],
          interventionMechanism="im",
      )
      out = ProblemOutput(headline="H", body="B", pdfContent=pdf)
      with patch(
          "eisenbalm_pipeline.agents.problem.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6",
          })),
      ):
          result = await problem(sample_dispatch_state)
      assert len(result["problem"]["pdfContent"]["keyDataPoints"]) == 3
      assert "problemStatement" in result["problem"]["pdfContent"]
      assert "interventionMechanism" in result["problem"]["pdfContent"]
  ```

  **`tests/agents/test_founder_bio.py`:** Includes role_framing test required by AGT-10:
  ```python
  from unittest.mock import AsyncMock, patch
  import pytest
  from eisenbalm_pipeline.agents.founder_bio import (
      FounderBioOutput, _select_guidance_and_scrub, founder_bio,
      GUIDANCE_ANONYMOUS, GUIDANCE_VERIFIED,
  )


  def test_select_guidance_verified() -> None:
      g, r = _select_guidance_and_scrub({
          "founderName": "Jane Doe", "founderNameVerified": True,
      })
      assert g == GUIDANCE_VERIFIED
      assert r["founderName"] == "Jane Doe"


  def test_role_framing() -> None:
      """AGT-10: unverified founderName → role framing + name scrubbed."""
      g, r = _select_guidance_and_scrub({
          "founderName": "Jane Doe", "founderNameVerified": False,
          "founderRole": "executive director",
      })
      assert "Do NOT use or guess a name" in g
      assert "executive director" in g
      assert r["founderName"] is None


  @pytest.mark.asyncio
  async def test_founder_bio_runs(sample_dispatch_state) -> None:
      sample_dispatch_state["research"] = {
          "founderName": "Jane Doe", "founderNameVerified": True,
          "founderBio": "bio", "summary": "s",
      }
      out = FounderBioOutput(headline="H", body="B")
      with patch(
          "eisenbalm_pipeline.agents.founder_bio.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6",
          })),
      ):
          result = await founder_bio(sample_dispatch_state)
      assert result["founder_bio"]["headline"] == "H"
  ```

  **`tests/agents/test_case_study.py`:** Mirror founder_bio shape with subject fields:
  ```python
  from unittest.mock import AsyncMock, patch
  import pytest
  from eisenbalm_pipeline.agents.case_study import (
      CaseStudyOutput, _select_guidance_and_scrub, case_study,
      GUIDANCE_ANONYMOUS, GUIDANCE_VERIFIED,
  )


  def test_select_guidance_anonymous() -> None:
      g, r = _select_guidance_and_scrub({
          "subjectName": "Alex", "subjectNameVerified": False,
          "subjectRole": "a parent",
      })
      assert "Do NOT name the subject" in g
      assert r["subjectName"] is None


  @pytest.mark.asyncio
  async def test_case_study_runs(sample_dispatch_state) -> None:
      sample_dispatch_state["research"] = {
          "subjectName": "Alex Park", "subjectNameVerified": True,
          "subjectStory": "story", "summary": "s",
      }
      out = CaseStudyOutput(headline="H", body="B")
      with patch(
          "eisenbalm_pipeline.agents.case_study.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6",
          })),
      ):
          result = await case_study(sample_dispatch_state)
      assert result["case_study"]["headline"] == "H"
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_origin_story.py tests/agents/test_problem.py tests/agents/test_founder_bio.py tests/agents/test_case_study.py -x -v 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - All 4 test files pass
    - `test_founder_bio.py::test_role_framing` asserts `'Do NOT use or guess a name' in g` AND `r['founderName'] is None`
    - `test_problem.py::test_problem_pdf_content` asserts `keyDataPoints` length == 3
    - No `@pytest.mark.skip` remains in any of the four files
  </acceptance_criteria>

  <done>
  All four section writers verified for voice-isolated prompt assembly + (where applicable) role-framing branching.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=true pytest tests/agents/test_origin_story.py tests/agents/test_problem.py tests/agents/test_founder_bio.py tests/agents/test_case_study.py -x` exits 0
- `grep -c 'build_section_writer_prompt' packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` returns 1
- `grep -c 'build_section_writer_prompt' packages/pipeline/src/eisenbalm_pipeline/agents/problem.py` returns 1
- `grep -c 'build_section_writer_prompt' packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py` returns 1
- `grep -c 'build_section_writer_prompt' packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` returns 1
- `grep -c 'founderNameVerified' packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py` returns ≥ 1
- `grep -c 'subjectNameVerified' packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` returns ≥ 1
</verification>

<success_criteria>
- All 4 writers call build_section_writer_prompt (no ad-hoc prompt assembly)
- FounderBio + CaseStudy branch on *Verified bools
- *Name fields scrubbed from research dict when verified=False
- ProblemWriter emits Phase-6-compatible pdfContent (3 keyDataPoints)
- All 4 writers populate model_versions for their agent_id
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-10-section-writers-SUMMARY.md`.
</output>
