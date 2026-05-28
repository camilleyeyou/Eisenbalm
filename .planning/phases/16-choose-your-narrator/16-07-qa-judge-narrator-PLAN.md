---
phase: 16-choose-your-narrator
plan: 07
type: execute
wave: 2
depends_on: ["16-01", "16-02", "16-04"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
autonomous: true
requirements: [NRR-06]
must_haves:
  truths:
    - "run_llm_judge accepts narrator: Optional[dict] = None as kwarg-only parameter"
    - "When narrator is set AND active, the system message includes narrator.voiceRubric + narrator.exampleSamples[:3] appended after rubric.md content"
    - "When narrator is None OR inactive, the system message is BYTE-IDENTICAL to the legacy rubric.md content (NRR-10 zero-regression)"
    - "QA orchestrator (qa/__init__.py) reads state.get('narrator') and forwards it to run_llm_judge"
    - "rubric.md is unchanged at the file level (universal axes preserved) — narrator content layered on at call time, not via multi-file split (Research §D Option 1)"
    - "Wave 0 test_qa_judge_narrator (3 tests) flips GREEN"
    - "All Phase 5 QA tests stay GREEN (the per-call rubric load preserves the current Layer 2 LLM judge contract)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py"
      provides: "Per-call narrator-aware rubric assembly"
      contains: "narrator: Optional[dict]"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py"
      provides: "QA orchestrator forwards state['narrator'] to run_llm_judge"
      contains: "narrator=state.get"
  key_links:
    - from: "qa/judge.py run_llm_judge"
      to: "narrator.voiceRubric + narrator.exampleSamples"
      via: "appended to rubric_core at call time"
      pattern: "voiceRubric"
    - from: "qa/__init__.py orchestrator"
      to: "qa/judge.run_llm_judge narrator kwarg"
      via: "kwarg forwarding from state.get('narrator')"
      pattern: "narrator=state.get"
---

<objective>
Make the QA judge narrator-aware per CONTEXT D-06 implication + NRR-06. Adds a narrator: Optional[dict] kwarg to run_llm_judge; when set, appends narrator.voiceRubric + narrator.exampleSamples[:3] to the rubric.md universal axes at call time. When unset, byte-identical to existing Jesse behavior.

Per Research §D Option 1: keep rubric.md as the universal Andrew-editable foundation. Don't split it into per-narrator files (Option 2 / Option 3 rejected — file-system proliferation + Andrew's edit surface gets fragmented). The Jesse "voice" prose register in rubric.md stays as the default when narrator is None; when narrator is set, the narrator's voiceRubric replaces the persona register portion conceptually (operationally: it's appended after the universal axes, and the LLM is given clear framing).

This plan touches qa/judge.py (per-call rubric assembly) AND qa/__init__.py (orchestrator forwards state['narrator'] to the judge). It does NOT touch rubric.md (Research §D Resolution: the existing structure is correct).

Output: 2 files modified; 1 Wave 0 test file flips GREEN (test_qa_judge_narrator with 3 tests); Phase 5 QA tests stay GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@.planning/phases/05-agent-quality/05-CONTEXT.md

<interfaces>
<!-- Current contract (judge.py): -->
async def run_llm_judge(sections: dict[str, str], *, run_id: str) -> tuple[list[QAFinding], str]: ...

<!-- New contract (this plan ships): -->
async def run_llm_judge(
    sections: dict[str, str],
    *,
    run_id: str,
    narrator: Optional[dict] = None,
) -> tuple[list[QAFinding], str]: ...

<!-- When narrator is set + active, append at call time: -->
"""
## Narrator Register: {narrator['name']}
{narrator['voiceRubric']}

## Voice Examples (few-shot anchors)
{narrator['exampleSamples'][0]}

---

{narrator['exampleSamples'][1]}
... (up to 3 samples)
"""
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add narrator kwarg to run_llm_judge in qa/judge.py with per-call rubric assembly</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py</files>
  <behavior>
    - run_llm_judge signature: `async def run_llm_judge(sections, *, run_id, narrator: Optional[dict] = None)`
    - When narrator is None OR narrator.get('active') is False: rubric variable == _load_rubric() byte-identical (current behavior)
    - When narrator is set + active: rubric = _load_rubric() + narrator_block where narrator_block embeds voiceRubric + up to 3 exampleSamples
    - exampleSamples block separator between entries: "\n\n---\n\n"
    - narrator block prefix headings: `## Narrator Register: {name}\n` then voiceRubric, then `\n\n## Voice Examples (few-shot anchors)\n` then samples
    - When narrator has no voiceRubric (empty string), narrator block is omitted — preserves byte-equivalence safety
    - When narrator has empty exampleSamples list, the "## Voice Examples" header is omitted
    - test_qa_judge_narrator 3 tests GREEN
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py FULL FILE (134 lines — function under edit at lines 69-133, plus the _load_rubric helper at line 64-66 stays as-is)
    - packages/pipeline/tests/test_qa_judge_narrator.py (the 3 RED tests this task turns GREEN)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md FULL FILE (87 lines — confirms universal axes stay in rubric.md unchanged; only the persona-register block is conceptually narrator-controlled)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §D (Option 1 implementation pattern — rubric_core stays universal, narrator content appended at call time)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-12 (exampleSamples: 3 × ~150 words; ~600 tokens added to QA judge prompt — fits the ≤10% cost budget)
  </read_first>
  <action>
Edit packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py.

(A) Update imports at line 20 — change `from typing import Literal` to:
```python
from typing import Literal, Optional
```

(B) Replace the `run_llm_judge` function (lines 69-133) — preserve the docstring's existing description but extend it for the narrator kwarg, and replace the rubric assembly to layer in narrator content at call time:

```python
async def run_llm_judge(
    sections: dict[str, str],
    *,
    run_id: str,
    narrator: Optional[dict] = None,
) -> tuple[list[QAFinding], str]:
    """Single Opus call over all section bodies concatenated.

    Args:
        sections: ``{section_id: body}`` flat dict — must include all six
            sections (origin_story, problem, founder_bio, case_study, game,
            bonus). Empty bodies are tolerated.
        run_id: ``state['run_id']`` — required by ``acomplete`` for cost
            recording (D-08 / lib/cost.CostRecorder).
        narrator: Phase 16 (NRR-06) optional loaded narratorProfile dict
            ({name, slug, voiceConstraints, voiceRubric, exampleSamples, active}).
            When set + active, narrator.voiceRubric + up to 3 exampleSamples are
            appended to the rubric.md universal axes as the QA system message.
            When None or active=False, the system message is byte-identical to
            the existing Phase 5 Jesse-default behavior (NRR-10 zero-regression).

    Returns:
        ``(findings, resolved_model)`` — findings as QAFinding NamedTuples
        (mapped from JudgeFinding Pydantic instances) so the orchestrator
        sees a homogeneous list. ``resolved_model`` is the AGT-17 surface
        for ``state['model_versions']['qa']``.
    """
    rubric_core = _load_rubric()

    # Phase 16 (NRR-06): per-call narrator-aware rubric assembly.
    rubric = rubric_core
    if isinstance(narrator, dict) and narrator.get("active", True):
        persona_rubric = (narrator.get("voiceRubric") or "").strip()
        samples = narrator.get("exampleSamples") or []
        name = narrator.get("name") or "Unknown"
        if persona_rubric:
            narrator_block = f"\n\n## Narrator Register: {name}\n{persona_rubric}"
            if isinstance(samples, list) and samples:
                # Up to 3 samples (CONTEXT D-12 cost budget). Plain strings, no Markdown.
                anchor_block = "\n\n---\n\n".join(str(s) for s in samples[:3])
                narrator_block += (
                    "\n\n## Voice Examples (few-shot anchors)\n" + anchor_block
                )
            rubric = rubric_core + narrator_block

    sections_json = json.dumps(sections, indent=2)
    user_intro = (
        f"Evaluate these section bodies against the {name} voice rubric. "
        if isinstance(narrator, dict) and narrator.get("active", True) and narrator.get("voiceRubric")
        else "Evaluate these section bodies against the Jesse voice rubric. "
    )
    messages = [
        {"role": "system", "content": rubric},
        {
            "role": "user",
            "content": (
                user_intro
                + "Return JSON JudgeFindings with a `findings` array. "
                "An empty array is a passing grade.\n\n"
                f"SECTIONS:\n{sections_json}"
            ),
        },
    ]
    result_obj, usage = await acomplete(
        agent_id="qa",
        run_id=run_id,
        messages=messages,
        response_format=JudgeFindings,
    )

    # Normalize the result: with_structured_output returns a Pydantic
    # instance; FakeOpenRouterClient (stub mode) may return a dict-like or a
    # model_construct'd instance with an empty findings list.
    if hasattr(result_obj, "findings"):
        findings_raw = result_obj.findings
    elif isinstance(result_obj, dict):
        findings_raw = result_obj.get("findings", [])
    else:
        findings_raw = []

    findings: list[QAFinding] = []
    for f_raw in findings_raw:
        f = f_raw if isinstance(f_raw, JudgeFinding) else JudgeFinding(**f_raw)
        findings.append(
            QAFinding(
                section=f.section,
                severity=f.severity,
                axis=f.axis,
                quotedSpan=f.quotedSpan,
                reason=f.reason,
                suggestedFix=f.suggestedFix,
            )
        )
    return findings, usage["resolved_model"]
```

CRITICAL byte-equivalence detail: when narrator is None (the default behavior), the rubric variable equals rubric_core which equals _load_rubric(). The system message content is byte-identical to the existing Phase 5 implementation. Verify this by running test_judge_narrator_none_byte_equivalent_to_legacy.
  </action>
  <verify>
    <automated>uv run --project packages/pipeline python -c "from eisenbalm_pipeline.agents.qa.judge import run_llm_judge; import inspect; sig = inspect.signature(run_llm_judge); assert 'narrator' in sig.parameters; assert sig.parameters['narrator'].default is None; print('OK')" prints 'OK'; uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py -q exits 0 (3 tests GREEN); uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q exits 0 (full pipeline suite green — Phase 5 QA tests + voice byte-equivalence all GREEN)</automated>
  </verify>
  <done>run_llm_judge accepts narrator kwarg; per-call assembly layers voiceRubric + exampleSamples[:3]; null/inactive narrator path byte-identical to Phase 5; 3 Wave 0 QA tests GREEN.</done>
</task>

<task type="auto">
  <name>Task 2: QA orchestrator forwards state['narrator'] to run_llm_judge</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py FULL FILE (the orchestrator — locate the call site to run_llm_judge and the surrounding state access)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-05 (only Calibrator reads state['narrator'] — but per NRR-06 the QA judge is the second narrator-aware agent because rubric needs per-run narrator content; the orchestrator forwards state['narrator'] to the judge as a kwarg, not as a re-read of narrator)
  </read_first>
  <action>
Edit packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py. Locate the call site to `run_llm_judge(...)` (likely something like `await run_llm_judge(sections=..., run_id=...)`).

Add the narrator kwarg:
```python
await run_llm_judge(
    sections=...,
    run_id=run_id,
    narrator=state.get("narrator"),
)
```

The exact line numbers depend on the current orchestrator file structure — use Read first to find the call site. Preserve every other existing kwarg and the surrounding orchestration logic (Layer 1 rules + Layer 2 judge + finding merge).
  </action>
  <verify>
    <automated>grep -E "narrator=state.get\(.narrator.\)" packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py returns a match OR grep -E "narrator=state\[.narrator.\]" packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py returns a match; uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q exits 0 (full suite green); uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py -q exits 0 (3 tests still GREEN after orchestrator wiring)</automated>
  </verify>
  <done>QA orchestrator forwards state['narrator'] to run_llm_judge; full pipeline suite green.</done>
</task>

</tasks>

<verification>
- test_qa_judge_narrator (3 tests: signature, narrator-set appendage, narrator-None byte-equivalence) all GREEN.
- Phase 5 QA tests stay GREEN — the per-call rubric assembly is byte-equivalent for the narrator=None path.
- rubric.md file content is unchanged (Research §D Option 1).
- The qa orchestrator → judge interface gains the narrator kwarg without changing Layer 1 deterministic predicate flow.
</verification>

<success_criteria>
- NRR-06 verified: QA scores against narrator.voiceRubric + exampleSamples when set; existing Jesse rubric when unset.
- NRR-10 zero-regression: narrator=None path byte-identical to Phase 5.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-07-SUMMARY.md` documenting: the per-call rubric assembly pattern, the narrator block format with samples, the byte-equivalence guarantee for narrator=None, and confirmation that rubric.md was not modified.
</output>
