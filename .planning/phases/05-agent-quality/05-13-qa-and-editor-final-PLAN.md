---
phase: 05-agent-quality
plan: 13
type: execute
wave: 6
depends_on:
  - "05-10"
  - "05-11"
  - "05-12"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/tests/agents/qa/__init__.py
  - packages/pipeline/tests/agents/qa/test_rules.py
  - packages/pipeline/tests/agents/qa/test_judge.py
  - packages/pipeline/tests/agents/test_editor_final.py
autonomous: true
requirements_addressed:
  - AGT-15
  - AGT-16
  - AGT-17
must_haves:
  truths:
    - "agents/qa/rules.py exports deterministic predicates: check_exclamation_marks, check_sentiment_keywords, check_winking, check_ai_reference, check_unverified_name, run_all_predicates"
    - "agents/qa/judge.py runs ONE Opus call over all six section bodies concatenated; returns Pydantic-validated findings list"
    - "agents/qa.py orchestrates Layer 1 + Layer 2 in a single holistic pass after fan-out (D-03)"
    - "QA writes one qaCorrections:insert row per finding with severity ∈ {info|warning|error} (post-05-01 schema)"
    - "Layer-1 predicates run on Phase 4 stub fixture text produce zero findings (baseline integrity)"
    - "Every qaCorrections row uses severity ∈ {info|warning|error} (matches Plan 05-01 schema enum)"
    - "Every qaCorrections row sets accepted=False (D-02 annotation-only; Andrew flips via Studio in Phase 9)"
    - "Every qaCorrections row uses sectionName (not section) and reason (not reasoning) per Plan 05-01 schema field names"
    - "QA NEVER mutates section state — only writes state['qa_corrections'] (D-02)"
    - "QA NEVER blocks the draft — always returns success state (D-04)"
    - "Editor Final consumes state['qa_corrections']; emits editor-final event; never rewrites section bodies"
    - "QA + Editor Final run on Opus (voice-critical per D-05); modelVersions populated (AGT-17)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py"
      provides: "Layer-1 deterministic predicates (Jesse-voice hard rules)"
      min_lines: 130
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py"
      provides: "Layer-2 LLM-as-judge orchestrator (single Opus call)"
      min_lines: 60
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md"
      provides: "Version-controlled LLM-judge prompt — Andrew edits when voice drift surfaces"
      min_lines: 80
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa.py"
      provides: "Orchestrates both QA layers + Convex writes"
      min_lines: 70
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py"
      provides: "editor_final body completed (gate1 unchanged from Plan 05-08)"
      contains: "editor_final"
  key_links:
    - from: "agents/qa.py"
      to: "agents/qa/rules.run_all_predicates + agents/qa/judge.run_llm_judge"
      via: "single orchestrator runs both layers; never blocks (D-02, D-04)"
      pattern: "run_all_predicates"
    - from: "agents/qa.py per-finding loop"
      to: "Convex qaCorrections:insert"
      via: "severity ∈ {info|warning|error} (post-05-01 schema)"
      pattern: "qaCorrections:insert"
    - from: "agents/editor.py editor_final"
      to: "state['qa_corrections']"
      via: "Editor Final reads but does not mutate; emits editor-final event"
      pattern: "qa_corrections"
---

<objective>
Replace the Phase 4 QA stub with a real two-layer rubric (Layer-1 deterministic predicates + Layer-2 LLM-as-judge) AND replace the Phase 4 Editor Final stub with a real Opus-driven advisory pass. This plan is the last "agent body" plan in Wave 6 — Plan 05-14 (real-mode integration test) and Plan 05-15 (Andrew smoke) follow.

Five concerns:

1. **Layer 1 deterministic predicates (AGT-15, D-01):** Copy `agents/qa/rules.py` VERBATIM from RESEARCH §"Layer 1: Deterministic Hard Rules" lines 832-978. Five predicate functions (exclamation marks, sentiment keywords, winking constructions, AI self-reference, unverified-name leakage). Each violation produces a `QAFinding` NamedTuple with `severity='error'` and `axis ∈ {gravity, sentiment, irony-signaling, precision}`.

2. **Layer 2 LLM-as-judge (AGT-15, D-01):** `agents/qa/judge.py` runs ONE Opus call with the rubric.md prompt as the system message and all section bodies concatenated as the user message. Returns a Pydantic `JudgeFindings { findings: list[JudgeFinding] }` mapping to the same fields.

3. **Rubric prompt (AGT-15, D-01):** Copy `agents/qa/rubric.md` VERBATIM from RESEARCH §"Layer 2: LLM-as-Judge" lines 982-1071. This is the highest-risk prompt in the project per RESEARCH §"Specific Ideas" — version-controlled artifact Andrew edits as voice drift surfaces.

4. **Orchestrator (AGT-15, D-02, D-03, D-04):** `agents/qa.py` runs Layer 1 + Layer 2 in a single holistic pass after the parallel section-writer fan-out. Per finding writes a `qaCorrections:insert` row. ALWAYS returns success state — never mutates section bodies, never blocks. Copy logic from RESEARCH §"qa.py — Orchestrating Both Layers" lines 1635-1677.

5. **Editor Final (AGT-16):** Receives `state['qa_corrections']`. Emits a 100-300 word memo (`editorFinalNotes`) to Andrew describing what QA found and what to review. Does NOT rewrite any section. Decorator: `@agent_node(name="editor_final", emit_event="editor-final")`. Copy prompt verbatim from RESEARCH §"Editor Final" lines 802-826.

Output: 5 source files (rules.py, judge.py, rubric.md, qa.py, editor.py for editor_final body) + 4 test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/qa.py
@packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@docs/CLAUDE_CODE_BRIEF.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- QAFinding NamedTuple (RESEARCH §"Layer 1" line 841) -->
```python
class QAFinding(NamedTuple):
    section: str
    severity: str         # 'info' | 'warning' | 'error'
    axis: str             # 'gravity' | 'sentiment' | 'irony-signaling' | 'precision' | 'cross-section-consistency' | 'hard-rule'
    quotedSpan: str
    reason: str           # Phase 5: field renamed from 'reasoning' to 'reason' so it maps 1:1 to Convex qaCorrections.reason
    suggestedFix: str
```

<!-- qaCorrections:insert (API_CONTRACTS §3.6; post-05-01 schema) -->
```python
await convex_mutation_safe("qaCorrections:insert", {
    "runId": run_id,
    "agentId": "qa",
    "sectionName": ...,                          # use 'sectionName' (existing schema field name; NOT 'section')
    "severity": "info" | "warning" | "error",
    "axis": ...,                                 # 6-literal union including 'hard-rule' for Layer-1 findings
    "quotedSpan": ...,
    "reason": ...,                               # Pydantic `reason` field maps 1:1 to schema `reason`
    "suggestedFix": ...,
    "accepted": False,                           # boolean (D-02 annotation-only); Andrew flips in Phase 9
    # NOTE: do NOT send fieldName/original/corrected — they are now optional and unused in Phase 5
})
```

<!-- EditorFinalOutput (RESEARCH §"Editor Final" lines 821-824) -->
```python
class EditorFinalOutput(BaseModel):
    editorFinalNotes: str  # 100-300 word memo for Andrew
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create agents/qa/rules.py with Layer-1 deterministic predicates</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py, packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py</files>

  <read_first>
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Layer 1: Deterministic Hard Rules" lines 832-978 (FULL VERBATIM COPY required)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-01 (predicate axes)
    - docs/CLAUDE_CODE_BRIEF.md lines 359-367 (Jesse voice notes — source for keyword lists)
  </read_first>

  <action>
  CREATE `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` (empty file or with `__all__` re-exports).

  CREATE `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py` — COPY VERBATIM from RESEARCH lines 832-978. Do NOT shorten, do NOT paraphrase, do NOT trim the keyword lists. The literal content:

  ```python
  """Layer-1 deterministic QA predicates. Every hit is severity='error'."""
  import re
  from typing import NamedTuple

  class QAFinding(NamedTuple):
      section: str
      severity: str
      axis: str
      quotedSpan: str
      reason: str        # Phase 5: renamed from 'reasoning' so it maps 1:1 to Convex schema's `reason` field
      suggestedFix: str

  SENTIMENT_KEYWORDS = [
      r"\bheartwarming\b",
      r"\binspiring\b",
      r"\bincredible\b",
      r"\bamazing\b",
      r"\btruly\b",
      r"\bsimply\b",
      r"\bjourney of\b",
      r"\bpassion\b",
      r"\btransformative\b",
      r"\bempowering\b",
      r"\blife[-\s]changing\b",
      r"\bremarkable\b",
      r"\bbeautiful work\b",
      r"\bhumbling\b",
  ]

  WINKING_PATTERNS = [
      r"if you can call it that",
      r"believe it or not",
      r"\bof sorts\b",
      r"for lack of a better word",
      r"so to speak",
      r"as they say",
  ]

  AI_SELF_REFERENCE = [
      r"\bas an AI\b",
      r"\blanguage model\b",
      r"\bI was trained\b",
      r"\bmy training\b",
      r"\bI am an AI\b",
      r"\bAI assistant\b",
  ]


  def check_exclamation_marks(section_id: str, body: str) -> list[QAFinding]:
      findings = []
      for m in re.finditer(r"!", body):
          span = body[max(0, m.start() - 40):m.end() + 10].strip()
          findings.append(QAFinding(
              section=section_id, severity="error", axis="gravity",
              quotedSpan=span,
              reason="Exclamation marks are forbidden in Jesse voice.",
              suggestedFix="Replace with a period or rewrite for declarative force.",
          ))
      return findings


  def check_sentiment_keywords(section_id: str, body: str) -> list[QAFinding]:
      findings = []
      for pattern in SENTIMENT_KEYWORDS:
          for m in re.finditer(pattern, body, re.IGNORECASE):
              span = body[max(0, m.start() - 30):m.end() + 30].strip()
              findings.append(QAFinding(
                  section=section_id, severity="error", axis="sentiment",
                  quotedSpan=span,
                  reason=f"Sentiment keyword '{m.group()}' forbidden in Jesse voice.",
                  suggestedFix="Replace with a precise, neutral observation.",
              ))
      return findings


  def check_winking(section_id: str, body: str) -> list[QAFinding]:
      findings = []
      for pattern in WINKING_PATTERNS:
          for m in re.finditer(pattern, body, re.IGNORECASE):
              span = body[max(0, m.start() - 30):m.end() + 30].strip()
              findings.append(QAFinding(
                  section=section_id, severity="error", axis="irony-signaling",
                  quotedSpan=span,
                  reason=f"Winking construction '{m.group()}' breaks Jesse voice.",
                  suggestedFix="State the observation plainly without hedging.",
              ))
      return findings


  def check_ai_reference(section_id: str, body: str) -> list[QAFinding]:
      findings = []
      for pattern in AI_SELF_REFERENCE:
          for m in re.finditer(pattern, body, re.IGNORECASE):
              span = body[max(0, m.start() - 30):m.end() + 30].strip()
              findings.append(QAFinding(
                  section=section_id, severity="error", axis="gravity",
                  quotedSpan=span,
                  reason="AI self-reference breaks the brand. Jesse was born AI; this is not a gimmick.",
                  suggestedFix="Rewrite without any reference to AI, models, or Jesse's nature.",
              ))
      return findings


  def check_unverified_name(section_id: str, body: str, research: dict) -> list[QAFinding]:
      """Catch first-name use when founderNameVerified=False (founder_bio)
      or subjectNameVerified=False (case_study)."""
      findings = []
      if section_id == "founder_bio" and not research.get("founderNameVerified"):
          founder_name = research.get("founderName") or ""
          if founder_name:
              first = founder_name.split()[0]
              if re.search(r"\b" + re.escape(first) + r"\b", body, re.IGNORECASE):
                  findings.append(QAFinding(
                      section=section_id, severity="error", axis="precision",
                      quotedSpan=first,
                      reason=f"founderNameVerified=False but '{first}' appears in body.",
                      suggestedFix="Replace with role-based framing: 'The founder', 'they', 'their'.",
                  ))
      if section_id == "case_study" and not research.get("subjectNameVerified"):
          subject_name = research.get("subjectName") or ""
          if subject_name:
              first = subject_name.split()[0]
              if re.search(r"\b" + re.escape(first) + r"\b", body, re.IGNORECASE):
                  findings.append(QAFinding(
                      section=section_id, severity="error", axis="precision",
                      quotedSpan=first,
                      reason=f"subjectNameVerified=False but '{first}' appears in body.",
                      suggestedFix="Replace with role-based framing: 'a {subjectRole}', 'they', 'their'.",
                  ))
      return findings


  def run_all_predicates(sections: dict[str, str], research: dict) -> list[QAFinding]:
      """Run all Layer-1 predicates over all sections."""
      all_findings: list[QAFinding] = []
      for section_id, body in sections.items():
          all_findings.extend(check_exclamation_marks(section_id, body))
          all_findings.extend(check_sentiment_keywords(section_id, body))
          all_findings.extend(check_winking(section_id, body))
          all_findings.extend(check_ai_reference(section_id, body))
          all_findings.extend(check_unverified_name(section_id, body, research))
      return all_findings
  ```

  Do NOT add or remove any keyword. Do NOT change severity values. Do NOT change axis values.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.qa.rules import check_exclamation_marks, check_sentiment_keywords, check_winking, check_ai_reference, check_unverified_name, run_all_predicates, QAFinding, SENTIMENT_KEYWORDS; assert len(SENTIMENT_KEYWORDS) >= 14; assert len(check_exclamation_marks('s', 'Hello! World')) == 1; assert len(check_sentiment_keywords('s', 'truly heartwarming')) == 2; assert len(check_winking('s', 'if you can call it that')) == 1; assert all(f.severity == 'error' for f in check_exclamation_marks('s', 'Hi!')); print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/qa/__init__.py` exists (empty or with re-exports)
    - `agents/qa/rules.py` exports `QAFinding`, `run_all_predicates`, and all 5 `check_*` functions
    - `SENTIMENT_KEYWORDS` has ≥ 14 entries (matches RESEARCH list exactly)
    - `WINKING_PATTERNS` has ≥ 6 entries
    - `AI_SELF_REFERENCE` has ≥ 6 entries
    - All findings produced by these predicates use `severity='error'`
    - `check_exclamation_marks('s', 'Hello!')` returns one finding
    - `check_sentiment_keywords('s', 'truly heartwarming')` returns 2 findings
  </acceptance_criteria>

  <done>
  Layer-1 hard rules exist, mirror RESEARCH verbatim, ready for orchestrator + tests.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create agents/qa/rubric.md with LLM-judge prompt (verbatim from RESEARCH)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md</files>

  <read_first>
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Layer 2: LLM-as-Judge" lines 982-1071 (FULL VERBATIM COPY required)
    - docs/CLAUDE_CODE_BRIEF.md lines 359-367 (voice notes — source of rubric content)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-01 (rubric is version-controlled artifact)
  </read_first>

  <action>
  CREATE `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` with the following content COPIED VERBATIM from RESEARCH:

  ```markdown
  # QA Judge Prompt — The Eisenbalm Dispatch

  ## Role

  You are the Quality Assurance judge for The Eisenbalm Dispatch.
  You write corrections, not opinions. You record severity and acceptance status
  for each finding. One warning is treated the same as ten: a section either
  passes or it does not.

  ## Jesse Voice (Non-Negotiable)

  Dry, precise, and absurdly serious. No winking. No irony signaling.
  The brand does not pivot to AI. Jesse was born AI. This is not a gimmick.

  Every charity is treated with the gravity of a Fortune 500 company.
  Every founder is treated as a visionary regardless of obscurity.
  The question "Why do you deserve to exist?" is answered without sentiment.

  ## Forbidden

  - Exclamation marks (any)
  - Sentimentality: heartwarming, inspiring, incredible, amazing, truly, simply,
    journey of, passion, transformative, empowering, life-changing, remarkable
  - Winking: "if you can call it that", "believe it or not", "of sorts",
    "for lack of a better word", "so to speak", "as they say"
  - AI self-reference: "as an AI", "language model", "I was trained"
  - Adjectives that are also compliments ("impressive", "wonderful", "great")
  - Passive hedging ("might be", "could perhaps", "seems to")

  ## Evaluation Axes

  1. **gravity** — Is the charity treated with Fortune-500 seriousness?
     Failure: diminutive framing, dismissive aside, condescending tone.

  2. **sentiment** — Is the writing free of sentimentality?
     Failure: emotional appeals, uplifting language, cheerleading.

  3. **irony-signaling** — Is the writing free of winking and irony markers?
     Failure: hedging constructions, "so-called", distancing language.

  4. **precision** — Are all claims specific and verifiable?
     Failure: vague approximations ("many", "often", "some experts"),
     unattributed statistics.

  5. **cross-section-consistency** — Is the tone consistent across all sections?
     Failure: Founder Bio reverential while Problem Statement is cold;
     Case Study uses a different register than Origin Story.

  ## Input Format

  JSON object with section bodies:
  ```json
  {
    "origin_story": "...",
    "problem": "...",
    "founder_bio": "...",
    "case_study": "...",
    "game": "...",
    "bonus": "..."
  }
  ```

  ## Output Format

  JSON object with "findings" array:
  ```json
  {
    "findings": [
      {
        "section": "origin_story",
        "severity": "error" | "warning" | "info",
        "axis": "gravity" | "sentiment" | "irony-signaling" | "precision" | "cross-section-consistency",
        "quotedSpan": "the exact offending text (max 100 chars)",
        "reason": "why this violates Jesse voice (1-2 sentences)",
        "suggestedFix": "concrete alternative (1-2 sentences)"
      }
    ]
  }
  ```

  Severity guide:
  - **error**: clear violation — Andrew must review before publishing
  - **warning**: borderline — voice strained but not broken; Andrew should review
  - **info**: minor suggestion — voice intact; Andrew may ignore

  Empty findings array = passing grade.
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && test -f src/eisenbalm_pipeline/agents/qa/rubric.md && grep -c 'Empty findings array = passing grade' src/eisenbalm_pipeline/agents/qa/rubric.md | grep -q "^1$" && grep -c 'cross-section-consistency' src/eisenbalm_pipeline/agents/qa/rubric.md | grep -q "^2$" && echo OK</automated>
  </verify>

  <acceptance_criteria>
    - File `agents/qa/rubric.md` exists
    - Contains "## Jesse Voice (Non-Negotiable)" section
    - Contains "## Forbidden" section listing exclamation marks + sentimentality + winking + AI self-reference
    - Contains "## Evaluation Axes" section with all 5 axes: gravity, sentiment, irony-signaling, precision, cross-section-consistency
    - Contains "## Output Format" with `findings` JSON shape
    - Contains "Empty findings array = passing grade." sentinel string
  </acceptance_criteria>

  <done>
  Version-controlled rubric prompt exists; Andrew may edit when voice drift surfaces.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create agents/qa/judge.py with single-call LLM-as-judge orchestrator</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md (just-created Task 2)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py (just-created Task 1)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"qa.py — Orchestrating Both Layers" lines 1635-1677 (judge call signature)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-01, D-03 (single Opus call, all sections concatenated)
  </read_first>

  <action>
  CREATE `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py`:

  ```python
  """Layer-2 LLM-as-judge — single Opus call per run.

  Reads rubric.md from disk (version-controlled prompt), concatenates all
  section bodies into JSON, returns Pydantic-validated findings list.

  Returns list[QAFinding] using the same NamedTuple shape as Layer-1.
  """
  from __future__ import annotations

  import json
  from pathlib import Path
  from typing import Literal

  from pydantic import BaseModel

  from eisenbalm_pipeline.agents.qa.rules import QAFinding
  from eisenbalm_pipeline.lib.openrouter_client import acomplete


  _RUBRIC_PATH: Path = Path(__file__).parent / "rubric.md"


  class JudgeFinding(BaseModel):
      section: str
      severity: Literal["info", "warning", "error"]
      axis: Literal[
          "gravity", "sentiment", "irony-signaling",
          "precision", "cross-section-consistency",
      ]
      quotedSpan: str
      reason: str         # Phase 5: renamed from 'reasoning' so it maps 1:1 to Convex qaCorrections.reason
      suggestedFix: str


  class JudgeFindings(BaseModel):
      findings: list[JudgeFinding]


  def _load_rubric() -> str:
      return _RUBRIC_PATH.read_text(encoding="utf-8")


  async def run_llm_judge(sections: dict[str, str]) -> tuple[list[QAFinding], str]:
      """Single Opus call over all section bodies concatenated.

      Returns (findings_list, resolved_model_id).
      """
      rubric = _load_rubric()
      sections_json = json.dumps(sections, indent=2)
      messages = [
          {"role": "system", "content": rubric},
          {"role": "user", "content":
              f"Evaluate these section bodies against the Jesse voice rubric. "
              f"Return JSON JudgeFindings with `findings` array.\n\n"
              f"SECTIONS:\n{sections_json}"
          },
      ]
      result_obj, usage = await acomplete(
          "qa", messages, response_format=JudgeFindings,
      )
      findings_raw = (
          result_obj.findings if hasattr(result_obj, "findings")
          else result_obj["findings"]
      )
      findings: list[QAFinding] = []
      for f_raw in findings_raw:
          f = f_raw if isinstance(f_raw, JudgeFinding) else JudgeFinding(**f_raw)
          findings.append(QAFinding(
              section=f.section, severity=f.severity, axis=f.axis,
              quotedSpan=f.quotedSpan, reason=f.reason,
              suggestedFix=f.suggestedFix,
          ))
      return findings, usage["resolved_model"]
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.qa.judge import run_llm_judge, JudgeFinding, JudgeFindings, _load_rubric; r = _load_rubric(); assert 'Jesse Voice' in r; jf = JudgeFinding(section='origin_story', severity='error', axis='sentiment', quotedSpan='x', reason='y', suggestedFix='z'); assert jf.severity == 'error'; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/qa/judge.py` defines `JudgeFinding` Pydantic with `severity: Literal['info', 'warning', 'error']`
    - `agents/qa/judge.py` defines `JudgeFinding.axis: Literal[...5 axes]`
    - `_load_rubric()` reads from `agents/qa/rubric.md`
    - `run_llm_judge(sections)` returns `tuple[list[QAFinding], str]` (findings + resolved_model)
    - The function makes EXACTLY ONE acomplete call (verifiable by grep showing single `await acomplete` call site in the file)
  </acceptance_criteria>

  <done>
  Layer-2 LLM-as-judge orchestrator complete.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Replace agents/qa.py with orchestrator combining both layers</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"qa.py — Orchestrating Both Layers" lines 1635-1677 (verbatim source)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-02, D-03, D-04 (annotation-only, holistic pass, never blocks)
    - docs/API_CONTRACTS.md §3.6 (qaCorrections:insert shape)
  </read_first>

  <action>
  REPLACE `packages/pipeline/src/eisenbalm_pipeline/agents/qa.py` with (copied with minor adaptation from RESEARCH §"qa.py — Orchestrating Both Layers"):

  ```python
  """Phase 5 QA — orchestrates Layer-1 hard rules + Layer-2 LLM-as-judge.

  Runs ONCE over all six section bodies (D-03). Writes one qaCorrections row
  per finding (D-01). NEVER mutates section state (D-02). NEVER blocks the
  draft (D-04) — always returns success state regardless of finding severity.

  emit_event='qa-correction': @agent_node wrapper emits one summary event;
  per-finding observability is the qaCorrections table itself.
  """
  from __future__ import annotations

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.agents.qa.judge import run_llm_judge
  from eisenbalm_pipeline.agents.qa.rules import QAFinding, run_all_predicates
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe


  def _extract_sections(state: DispatchState) -> dict[str, str]:
      """Pull the six section bodies into a flat {section_id: body} dict."""
      origin = state.get("origin_story") or {}
      problem = state.get("problem") or {}
      founder = state.get("founder_bio") or {}
      case_st = state.get("case_study") or {}
      game = state.get("game") or {}
      bonus = state.get("bonus") or {}
      return {
          "origin_story": origin.get("body", ""),
          "problem":       problem.get("body", ""),
          "founder_bio":   founder.get("body", ""),
          "case_study":    case_st.get("body", ""),
          "game":          game.get("description", ""),  # Game lacks 'body'; use description
          "bonus":         bonus.get("body", ""),
      }


  @agent_node(name="qa", emit_event="qa-correction")
  async def qa(state: DispatchState) -> DispatchState:
      run_id = state["run_id"]
      sections = _extract_sections(state)
      research = state.get("research") or {}

      # Layer 1: deterministic predicates (per-section, in process)
      layer1: list[QAFinding] = run_all_predicates(sections, research)

      # Layer 2: LLM-as-judge (one Opus call, all sections concatenated)
      layer2, resolved_model = await run_llm_judge(sections)

      all_findings = layer1 + layer2

      # Write each finding to Convex (QA never blocks; always writes+continues).
      # Canonical Phase 5 payload — schema patched by Plan 05-01:
      #   - 'sectionName' (NOT 'section') — matches existing schema field name
      #   - 'reason' (NOT 'reasoning') — Pydantic field renamed to map 1:1 to schema
      #   - 'accepted: False' boolean (D-02 annotation-only); Andrew flips in Phase 9
      #   - NO 'fieldName'/'original'/'corrected' — those are now optional + unused in Phase 5
      for f in all_findings:
          await convex_mutation_safe(
              "qaCorrections:insert",
              {
                  "runId": run_id,
                  "agentId": "qa",
                  "sectionName": f.section,
                  "severity": f.severity,
                  "axis": f.axis,
                  "quotedSpan": f.quotedSpan,
                  "reason": f.reason,
                  "suggestedFix": f.suggestedFix,
                  "accepted": False,
              },
          )

      model_versions = dict(state.get("model_versions") or {})
      model_versions["qa"] = resolved_model

      return {
          **state,
          "qa_corrections": [f._asdict() for f in all_findings],
          "model_versions": model_versions,
      }
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.qa import qa, _extract_sections; s = _extract_sections({'origin_story': {'body': 'b1'}, 'game': {'description': 'd1'}}); assert s['origin_story'] == 'b1'; assert s['game'] == 'd1'; assert s['problem'] == ''; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/qa.py` imports `run_all_predicates` from `agents.qa.rules`
    - `agents/qa.py` imports `run_llm_judge` from `agents.qa.judge`
    - `_extract_sections` returns dict with all 6 sections including game.description (not game.body)
    - The body NEVER mutates state['origin_story'], state['problem'], etc. (verifiable by absence of `state["origin_story"] =` or similar assignment to section keys other than `qa_corrections`)
    - Always returns success — no `raise` statement except inside an `except` that re-raises infrastructure errors (verify by line count: no top-level `raise` for QA-finding-based control flow)
    - Decorator: `@agent_node(name="qa", emit_event="qa-correction")`
    - Return dict contains `qa_corrections` (list of dicts) + `model_versions`
  </acceptance_criteria>

  <done>
  QA orchestrator runs both layers, writes one qaCorrections row per finding, never mutates section state, never blocks.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Replace editor_final body in agents/editor.py (preserve editor_gate1 from Plan 05-08)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/editor.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (Plan 05-08 implemented editor_gate1; editor_final is still stub at this point)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Editor Final" lines 802-826
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-02 (Andrew is editorial voice — Editor Final never rewrites)
  </read_first>

  <action>
  APPEND or REPLACE the `editor_final` function at the bottom of `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py`. Preserve the entire Plan 05-08 `editor_gate1` code unchanged. Add:

  ```python
  # ─── Editor Final (Plan 05-13) ──────────────────────────────────────────

  class EditorFinalOutput(BaseModel):
      """RESEARCH §"Editor Final" lines 821-824."""
      editorFinalNotes: str = Field(
          description="100-300 word memo for Andrew describing QA findings "
                      "and recommended review priorities. Advisory only — "
                      "Editor Final does NOT rewrite any section."
      )


  def _build_editor_final_messages(state: DispatchState) -> list[dict]:
      """System prompt embeds Editor Final's advisory mandate verbatim from
      RESEARCH §"Editor Final" lines 803-818."""
      qa_corrections = state.get("qa_corrections") or []
      section_headlines = {
          k: (state.get(k) or {}).get("headline", "")
          for k in ("origin_story", "problem", "founder_bio",
                    "case_study", "game", "bonus")
      }
      import json
      system = (
          "You are the Editor for The Eisenbalm Dispatch. Review the QA "
          "report and write any connective copy needed to unify the issue.\n\n"
          "VOICE CONSTRAINTS:\n"
          f"{VOICE_CONSTRAINTS}\n\n"
          "Your task:\n"
          "1. Read the QA findings. Note severity 'error' items.\n"
          "2. Write editorFinalNotes: a 100-300 word memo to Andrew "
          "describing what QA found, what you recommend he review before "
          "publishing, and any connective context.\n"
          "3. Do NOT rewrite any section. Do NOT reject the draft. "
          "The draft goes to Andrew as-is. Your notes are advisory."
      )
      user = (
          f"QA FINDINGS:\n{json.dumps(qa_corrections, indent=2)}\n\n"
          f"SECTION HEADLINES:\n{json.dumps(section_headlines, indent=2)}\n\n"
          "Return JSON EditorFinalOutput with editorFinalNotes (100-300 words)."
      )
      return [
          {"role": "system", "content": system},
          {"role": "user", "content": user},
      ]


  @agent_node(name="editor_final", emit_event="editor-final")
  async def editor_final(state: DispatchState) -> DispatchState:
      messages = _build_editor_final_messages(state)
      out_obj, usage = await acomplete(
          "editor_final", messages, response_format=EditorFinalOutput,
      )
      notes = (
          out_obj.editorFinalNotes if hasattr(out_obj, "editorFinalNotes")
          else out_obj["editorFinalNotes"]
      )
      model_versions = dict(state.get("model_versions") or {})
      model_versions["editor_final"] = usage["resolved_model"]
      return {
          **state,
          "editor_final_notes": notes,
          "model_versions": model_versions,
      }
  ```

  Ensure all imports at the top of `editor.py` cover both `editor_gate1` and `editor_final` (BaseModel + Field already imported; `VOICE_CONSTRAINTS` already imported from Plan 05-08; `acomplete` already imported).
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.editor import editor_final, editor_gate1, EditorFinalOutput, _build_editor_final_messages; m = _build_editor_final_messages({'qa_corrections': [], 'origin_story': {'headline': 'O'}}); assert 'Do NOT rewrite' in m[0]['content']; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/editor.py` defines `editor_final` as a separate `@agent_node` (does not modify the Plan 05-08 `editor_gate1` body)
    - `EditorFinalOutput` Pydantic has exactly one field: `editorFinalNotes`
    - System prompt contains `"Do NOT rewrite any section"` substring
    - System prompt contains `"Do NOT reject the draft"` substring
    - Return dict contains `editor_final_notes` and `model_versions['editor_final']`
    - Decorator: `@agent_node(name="editor_final", emit_event="editor-final")`
    - Plan 05-08's `editor_gate1` function still exists unchanged in the file (verify via grep `editor_gate1`)
  </acceptance_criteria>

  <done>
  Editor Final writes a 100-300 word advisory memo for Andrew; never rewrites or rejects.
  </done>
</task>

<task type="auto">
  <name>Task 6: Implement QA + Editor Final test files</name>
  <files>packages/pipeline/tests/agents/qa/__init__.py, packages/pipeline/tests/agents/qa/test_rules.py, packages/pipeline/tests/agents/qa/test_judge.py, packages/pipeline/tests/agents/test_editor_final.py</files>

  <read_first>
    - packages/pipeline/tests/agents/qa/test_rules.py (Plan 05-04 skeleton — if missing, create)
    - packages/pipeline/tests/agents/qa/test_judge.py (Plan 05-04 skeleton)
    - packages/pipeline/tests/agents/test_editor_final.py (Plan 05-04 skeleton)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py (just-implemented Task 1)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py (just-implemented Task 3)
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (Task 5 added editor_final)
  </read_first>

  <action>
  CREATE `packages/pipeline/tests/agents/qa/__init__.py` (empty).

  CREATE/REPLACE `packages/pipeline/tests/agents/qa/test_rules.py`:

  ```python
  """Phase 5 QA Layer-1 predicate tests — Plan 05-13. Validation: AGT-15."""
  from eisenbalm_pipeline.agents.qa.rules import (
      QAFinding,
      check_ai_reference,
      check_exclamation_marks,
      check_sentiment_keywords,
      check_unverified_name,
      check_winking,
      run_all_predicates,
  )


  def test_exclamation_marks_caught() -> None:
      findings = check_exclamation_marks("origin_story", "Hello world!")
      assert len(findings) == 1
      assert findings[0].severity == "error"
      assert findings[0].axis == "gravity"


  def test_multiple_exclamations_caught() -> None:
      findings = check_exclamation_marks("origin_story", "Wow! Amazing! Great!")
      assert len(findings) == 3


  def test_sentiment_keyword_caught() -> None:
      findings = check_sentiment_keywords("problem", "this is truly heartwarming work")
      # 'truly' AND 'heartwarming' both match
      assert len(findings) >= 2
      assert all(f.severity == "error" and f.axis == "sentiment" for f in findings)


  def test_winking_caught() -> None:
      findings = check_winking("bonus", "an organization, if you can call it that")
      assert len(findings) == 1
      assert findings[0].axis == "irony-signaling"


  def test_ai_reference_caught() -> None:
      findings = check_ai_reference("origin_story", "as an AI, I find this fascinating")
      assert len(findings) >= 1
      assert findings[0].axis == "gravity"


  def test_unverified_founder_name_caught() -> None:
      """AGT-10 backstop: Layer 1 catches founderName leak when verified=False."""
      research = {
          "founderName": "Jane Doe", "founderNameVerified": False,
      }
      findings = check_unverified_name(
          "founder_bio", "Jane has led this work since 2003", research,
      )
      assert len(findings) == 1
      assert findings[0].axis == "precision"


  def test_unverified_subject_name_caught() -> None:
      research = {
          "subjectName": "Alex Park", "subjectNameVerified": False,
      }
      findings = check_unverified_name(
          "case_study", "Alex came to the program in 2019", research,
      )
      assert len(findings) == 1


  def test_verified_name_not_flagged() -> None:
      research = {
          "founderName": "Jane Doe", "founderNameVerified": True,
      }
      findings = check_unverified_name("founder_bio", "Jane led...", research)
      assert findings == []


  def test_run_all_predicates_aggregates() -> None:
      sections = {
          "origin_story": "Truly amazing work! They built this incredible thing.",
      }
      research = {}
      findings = run_all_predicates(sections, research)
      assert len(findings) >= 3  # 'Truly', 'amazing', 'incredible', exclamation
      sections_seen = {f.section for f in findings}
      assert sections_seen == {"origin_story"}


  def test_passing_text_yields_no_findings() -> None:
      sections = {
          "origin_story": "The organization was founded in 2003 by a "
                          "former actuary. Its mission is narrow.",
      }
      findings = run_all_predicates(sections, {})
      assert findings == []
  ```

  CREATE/REPLACE `packages/pipeline/tests/agents/qa/test_judge.py`:

  ```python
  """Phase 5 QA Layer-2 judge tests — Plan 05-13. Validation: AGT-15."""
  from unittest.mock import AsyncMock, patch
  import pytest
  from eisenbalm_pipeline.agents.qa.judge import (
      JudgeFinding, JudgeFindings, _load_rubric, run_llm_judge,
  )


  def test_rubric_loads() -> None:
      rubric = _load_rubric()
      assert "Jesse Voice" in rubric
      assert "Empty findings array = passing grade" in rubric


  @pytest.mark.asyncio
  async def test_run_llm_judge_returns_findings() -> None:
      """AGT-15: Layer-2 judge returns Pydantic-validated findings."""
      mock_findings = JudgeFindings(findings=[
          JudgeFinding(
              section="origin_story", severity="warning", axis="sentiment",
              quotedSpan="passion-driven", reason="r", suggestedFix="f",
          ),
      ])
      with patch(
          "eisenbalm_pipeline.agents.qa.judge.acomplete",
          AsyncMock(return_value=(mock_findings, {
              "tokens_in": 100, "tokens_out": 50, "usd": 0.02,
              "resolved_model": "anthropic/claude-opus-4-7",
          })),
      ):
          findings, model = await run_llm_judge({
              "origin_story": "passion-driven work", "problem": "x",
              "founder_bio": "y", "case_study": "z", "game": "g", "bonus": "b",
          })
      assert len(findings) == 1
      assert findings[0].section == "origin_story"
      assert findings[0].severity == "warning"
      assert model == "anthropic/claude-opus-4-7"


  @pytest.mark.asyncio
  async def test_run_llm_judge_empty_findings_is_passing() -> None:
      """AGT-15: empty findings list = passing grade."""
      mock_findings = JudgeFindings(findings=[])
      with patch(
          "eisenbalm_pipeline.agents.qa.judge.acomplete",
          AsyncMock(return_value=(mock_findings, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-opus-4-7",
          })),
      ):
          findings, _ = await run_llm_judge({"origin_story": "good"})
      assert findings == []
  ```

  CREATE/REPLACE `packages/pipeline/tests/agents/test_editor_final.py`:

  ```python
  """Phase 5 Editor Final unit tests — Plan 05-13. Validation: AGT-16."""
  from unittest.mock import AsyncMock, patch
  import pytest
  from eisenbalm_pipeline.agents.editor import (
      EditorFinalOutput, _build_editor_final_messages, editor_final,
  )


  def test_editor_final_prompt_is_advisory() -> None:
      """AGT-16: prompt contains explicit 'Do NOT rewrite' + 'Do NOT reject'."""
      messages = _build_editor_final_messages({
          "qa_corrections": [
              {"sectionName": "problem", "severity": "error",
               "reason": "exclamation mark"},
          ],
          "origin_story": {"headline": "O"},
          "problem": {"headline": "P"},
      })
      system = messages[0]["content"]
      assert "Do NOT rewrite" in system
      assert "Do NOT reject" in system


  @pytest.mark.asyncio
  async def test_editor_final_emits_notes(sample_dispatch_state) -> None:
      """AGT-16: Editor Final writes editor_final_notes; doesn't mutate sections."""
      sample_dispatch_state["qa_corrections"] = []
      sample_dispatch_state["origin_story"] = {"headline": "O", "body": "obody"}

      out = EditorFinalOutput(editorFinalNotes="X" * 150)
      with patch(
          "eisenbalm_pipeline.agents.editor.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-opus-4-7",
          })),
      ):
          result = await editor_final(sample_dispatch_state)

      assert "editor_final_notes" in result
      assert len(result["editor_final_notes"]) == 150
      # Section state unchanged
      assert result["origin_story"]["body"] == "obody"
      assert result["model_versions"]["editor_final"] == "anthropic/claude-opus-4-7"
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/qa/test_rules.py tests/agents/qa/test_judge.py tests/agents/test_editor_final.py -x -v 2>&1 | tail -50</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/agents/qa/test_rules.py tests/agents/qa/test_judge.py tests/agents/test_editor_final.py -x` exits 0 with ≥13 tests passing
    - `test_unverified_founder_name_caught` asserts Layer-1 catches name leak when verified=False
    - `test_passing_text_yields_no_findings` asserts a clean body yields zero findings
    - `test_editor_final_prompt_is_advisory` asserts "Do NOT rewrite" and "Do NOT reject" in system prompt
    - `test_editor_final_emits_notes` asserts section state unchanged (origin_story.body preserved)
  </acceptance_criteria>

  <done>
  QA Layer-1 + Layer-2 + Editor Final test coverage proves AGT-15 + AGT-16 mechanics.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=true pytest tests/agents/qa/ tests/agents/test_editor_final.py -x` exits 0
- `EISENBALM_STUB_MODE=true pytest tests/ -x -q --timeout=30` exits 0 (no regression)
- `grep -c 'run_all_predicates' packages/pipeline/src/eisenbalm_pipeline/agents/qa.py` returns ≥ 1
- `grep -c 'run_llm_judge' packages/pipeline/src/eisenbalm_pipeline/agents/qa.py` returns ≥ 1
- `grep -c 'editor_final' packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` returns ≥ 2 (declaration + decorator)
- `grep -c 'editor_gate1' packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` returns ≥ 2 (preserved from Plan 05-08)
- `test -f packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md`
</verification>

<success_criteria>
- agents/qa/rules.py predicates cover all 5 axes (exclamation, sentiment, winking, AI ref, unverified name)
- agents/qa/judge.py makes exactly ONE Opus call per run over all sections concatenated
- agents/qa/rubric.md exists and contains the full version-controlled prompt
- agents/qa.py NEVER mutates section state; ALWAYS returns success
- Editor Final writes 100-300 word advisory memo for Andrew
- modelVersions['qa'] and modelVersions['editor_final'] populated
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-13-qa-and-editor-final-SUMMARY.md`.
</output>
