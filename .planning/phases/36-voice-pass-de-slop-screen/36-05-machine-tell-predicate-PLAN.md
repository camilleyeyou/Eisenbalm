---
phase: 36-voice-pass-de-slop-screen
plan: 05
type: execute
wave: 2
depends_on: [36-01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
  - packages/pipeline/tests/agents/qa/test_rules.py
autonomous: true
requirements: [VOX-01, VOX-04]
must_haves:
  truths:
    - "A draft section containing an AI-slop term (e.g. 'delve', 'tapestry', 'a testament to') produces a QAFinding with axis='machine-tell'"
    - "Clean Jesse-voice prose with none of the lexicon terms produces zero machine-tell findings (no over-fire)"
    - "run_all_predicates includes the machine-tell predicate in its per-section fan-out"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py"
      provides: "check_machine_tell predicate + MACHINE_TELL_LEXICON (axis='machine-tell')"
      contains: "machine-tell"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md"
      provides: "machine-tell lockstep documentation"
      contains: "machine-tell"
    - path: "packages/pipeline/tests/agents/qa/test_rules.py"
      provides: "machine-tell fire + over-fire-guard tests"
      contains: "check_machine_tell"
  key_links:
    - from: "agents/qa/rules.py::run_all_predicates"
      to: "check_machine_tell"
      via: "per-section fan-out call"
      pattern: "check_machine_tell"
    - from: "check_machine_tell finding"
      to: "qaCorrections.axis machine-tell literal (36-01) + Layer-1 passthrough (36-02)"
      via: "axis='machine-tell' emitted verbatim"
      pattern: "axis=\"machine-tell\""
---

<objective>
The D-05 detection core: add a `machine-tell` Layer-1 predicate to `agents/qa/rules.py` carrying an AI-slop lexicon that the existing Jesse-voice forbidden sets (sentiment / winking / AI-reference) do NOT cover. This is the "machine-tells lit inline" half of VOX-01 and the deterministic-rules half of VOX-04.

Purpose: Voice Pass needs a source of `axis="machine-tell"` findings to light. This predicate produces them at pipeline QA time; combined with 36-01 (Convex literal) and 36-02 (axis passthrough), they survive to Convex where Voice Pass reads them instantly (VOX-04 "deterministic rules render instantly").
Output: `check_machine_tell` + `MACHINE_TELL_LEXICON` in `rules.py`, registered in `run_all_predicates`; a lockstep note in `rubric.md`; RED-first tests including an over-fire guard.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-voice-pass-de-slop-screen/36-RESEARCH.md
@.planning/phases/36-voice-pass-de-slop-screen/36-CONTEXT.md
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
@packages/pipeline/tests/agents/qa/test_rules.py

<interfaces>
<!-- Pattern to mirror EXACTLY: check_sentiment_keywords (rules.py:112-130) — iterate a regex list,
     re.finditer(pattern, body, re.IGNORECASE), quotedSpan = body[max(0,start-30):end+30].strip(),
     emit QAFinding(section, severity="error", axis="<axis>", quotedSpan, reason, suggestedFix). -->
<!-- QAFinding NamedTuple (rules.py:30-48): (section, severity, axis, quotedSpan, reason, suggestedFix) -->
<!-- run_all_predicates (rules.py:242-268) currently fans:
     check_exclamation_marks, check_sentiment_keywords, check_winking, check_ai_reference,
     check_unverified_name — ADD check_machine_tell to this loop. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add check_machine_tell predicate + lexicon, register in run_all_predicates</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py (whole file — model on check_sentiment_keywords at 112-130 + the SENTIMENT_KEYWORDS list at 51-67; register in run_all_predicates at 242-268)
    - packages/pipeline/tests/agents/qa/test_rules.py (test patterns: assert len(findings), .severity, .axis, .section; the clean-text baseline test)
    - .planning/phases/36-voice-pass-de-slop-screen/36-CONTEXT.md (D-05 lexicon examples; Claude's-discretion on exact contents + whether writers avoid at generation time)
    - .planning/phases/36-voice-pass-de-slop-screen/36-RESEARCH.md (Secondary sources: cross-verified slop terms)
  </read_first>
  <behavior>
    - Test 1 (RED→GREEN): `check_machine_tell("origin_story", "We delve into the tapestry of local aid.")` returns ≥ 2 findings, each `severity=="error"`, `axis=="machine-tell"`, `section=="origin_story"`.
    - Test 2 (phrase hit): `check_machine_tell("problem", "The shelter is a testament to persistence. It's important to note the gap.")` fires on both "testament to" and "it's important to note".
    - Test 3 (OVER-FIRE GUARD): `check_machine_tell("case_study", "The clinic opened in 1998. It treats 400 patients a year. Funding comes from three county grants.")` returns `[]` — legitimate, plain factual prose must not fire.
    - Test 4: `run_all_predicates({"origin_story": "We delve into it."}, {})` includes at least one `axis=="machine-tell"` finding (registration proof).
  </behavior>
  <action>
    In `agents/qa/rules.py`:
    1. Add a `MACHINE_TELL_LEXICON: list[str]` module constant near `SENTIMENT_KEYWORDS`. Use a CONSERVATIVE, high-precision v1 set (severity is "error" and gates the sounds-human sign-off, so favor precision to avoid over-blocking — Andrew dismisses false positives via "Keep (not a tell)"). Seed with word-boundaried regexes:
       `r"\bdelv(e|es|ing)\b"`, `r"\btapestr(y|ies)\b"`, `r"\ba testament to\b"`, `r"\bin the realm of\b"`, `r"\bit'?s important to note\b"`, `r"\bit'?s worth noting\b"`, `r"\bnavigat\w* the (landscape|complexities|complex)\b"`, `r"\bunderscore(s|d)? the (importance|need|significance)\b"`, `r"\bnot only\b[^.!?]{0,60}\bbut also\b"` (correlative overuse), `r"\bat the end of the day\b"`, `r"\bever[-\s]evolving\b"`, `r"\bplays? a (pivotal|crucial|vital) role\b"`.
       Add a comment: exact contents are Claude's-discretion v1 (36-CONTEXT D-05); Andrew extends over time.
    2. Add `def check_machine_tell(section_id: str, body: str) -> list[QAFinding]:` mirroring `check_sentiment_keywords` verbatim in structure: iterate `MACHINE_TELL_LEXICON`, `re.finditer(pattern, body, re.IGNORECASE)`, `quotedSpan = body[max(0, m.start() - 30):m.end() + 30].strip()`, emit `QAFinding(section=section_id, severity="error", axis="machine-tell", quotedSpan=span, reason=f"Machine-tell '{m.group()}' — reads as AI slop, not Jesse voice.", suggestedFix="Rewrite in Jesse's dry, precise register; delete the tell.")`.
    3. Register it in `run_all_predicates`'s per-section loop: add `all_findings.extend(check_machine_tell(section_id, body))`.
    4. Extend `packages/pipeline/tests/agents/qa/test_rules.py` with the four behavior tests, importing `check_machine_tell` (add to the import block).

    Do NOT add `machine-tell` to `judge.py`'s `JudgeFinding.axis` Literal — machine-tell is a rules-only axis in v1 (the judge keeps its existing axes; adding it there would require a Pydantic Literal change and is out of scope). Do NOT change the orchestrator (36-02 already made Layer-1 axes pass through).
  </action>
  <acceptance_criteria>
    - `grep -q "def check_machine_tell" packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py`
    - `grep -q "MACHINE_TELL_LEXICON" packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py`
    - `grep -q 'axis="machine-tell"' packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py`
    - `grep -q "check_machine_tell(section_id, body)" packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py` (registered in run_all_predicates)
    - `grep -q "check_machine_tell" packages/pipeline/tests/agents/qa/test_rules.py`
    - `cd packages/pipeline && uv run pytest tests/agents/qa/test_rules.py -x -q` exits 0 (over-fire guard green)
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/qa/test_rules.py -x -q</automated>
  </verify>
  <done>check_machine_tell emits axis='machine-tell' findings on the AI-slop lexicon, is registered in run_all_predicates, and does not over-fire on plain factual prose — proven by RED-first tests including an over-fire guard.</done>
</task>

<task type="auto">
  <name>Task 2: Document the machine-tell axis + lockstep note in rubric.md</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md (the "Forbidden" list + "Evaluation Axes" section + the lockstep intent)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py (the lockstep comment at lines 15-17: rules.py ↔ lib/voice.py ↔ rubric.md must not drift)
    - docs/API_CONTRACTS.md §36.1/§36.2 (the axis is additive; machine-tell is rules-only)
  </read_first>
  <action>
    In `rubric.md`, add a short subsection under the "Forbidden" list (or a new "Machine-tells (deterministic, Layer-1)" note) stating that AI-slop machine-tells (delve, tapestry, "a testament to", "it's important to note", correlative/tricolon overuse, etc.) are caught deterministically by `agents/qa/rules.py::check_machine_tell` on the `machine-tell` axis and surfaced on the Voice Pass screen — the LLM judge is NOT asked to emit `machine-tell` (it is a rules-only axis; the judge keeps its existing axes). Include the lockstep reminder: the machine-tell lexicon lives in `rules.py`; if Andrew edits it, this note stays a pointer (do NOT restate the full lexicon here — single source of truth is `rules.py`). Keep it prose-only; do NOT alter the judge's Evaluation Axes list or its Output Format (no new judge axis).
  </action>
  <acceptance_criteria>
    - `grep -q "machine-tell" packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md`
    - `grep -q "check_machine_tell" packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md`
    - `grep -c "structural-variety" packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` still returns ≥ 1 AND `grep -c "machine-tell" packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` returns 0 (judge axis literal unchanged — machine-tell stays rules-only)
  </acceptance_criteria>
  <verify>
    <automated>grep -q "check_machine_tell" packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md && test "$(grep -c 'machine-tell' packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py)" = "0" && echo RUBRIC_OK</automated>
  </verify>
  <done>rubric.md documents the machine-tell axis as a rules-only, Voice-Pass-facing deterministic check with a lockstep pointer to rules.py; the judge's axis Literal is left untouched.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/agents/qa/ -x -q` green (predicate + over-fire guard + rubric checks).
- `cd packages/pipeline && uv run pytest -q` full suite green.
- Reconciliation note (Phase 35 lesson / Pitfall 7): Wave 2 in parallel with 36-02/36-03. This plan's `rules.py` change must be reconciled onto master before Wave 3 (36-04's Voice Pass screen relies on machine-tell findings existing to light).
</verification>

<success_criteria>
Machine-tells are detected deterministically at pipeline QA time on a dedicated axis; the lexicon is conservative (no over-fire); combined with 36-01/36-02 they reach Convex where Voice Pass reads them instantly.
</success_criteria>

<output>
After completion, create `.planning/phases/36-voice-pass-de-slop-screen/36-05-SUMMARY.md`.
</output>
