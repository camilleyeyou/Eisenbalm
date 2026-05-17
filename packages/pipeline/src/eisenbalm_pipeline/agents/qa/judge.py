"""Phase 5 D-01 Layer 2: LLM-as-judge — single Opus call per run.

Loads ``rubric.md`` from disk (version-controlled prompt — Andrew edits when
voice drift surfaces), concatenates all section bodies into JSON, returns
Pydantic-validated findings list. Findings are mapped back to the same
``QAFinding`` NamedTuple used by Layer-1 so the orchestrator does not need to
branch — Layer-1 + Layer-2 produce a homogeneous list.

D-03: exactly one acomplete call per run. The user prompt carries all six
section bodies as a single JSON payload — the judge needs cross-section
context to evaluate the ``cross-section-consistency`` axis.

Tokens + cost are recorded by ``acomplete`` (lib/openrouter_client.py) so this
module does not touch ``CostRecorder`` directly.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from eisenbalm_pipeline.agents.qa.rules import QAFinding
from eisenbalm_pipeline.lib.openrouter_client import acomplete


# Resolved at import time — keeps the rubric load free of per-call I/O.
_RUBRIC_PATH: Path = Path(__file__).parent / "rubric.md"


class JudgeFinding(BaseModel):
    """LLM-judge structured output (one entry per QA finding).

    Fields mirror Convex ``qaCorrections:insert`` surface 1:1 (post-Plan
    05-01 schema patch). ``reason`` (not ``reasoning``) — same naming
    convention as Layer-1 ``QAFinding.reason``.
    """

    section: str
    severity: Literal["info", "warning", "error"]
    axis: Literal[
        "gravity",
        "sentiment",
        "irony-signaling",
        "precision",
        "cross-section-consistency",
    ]
    quotedSpan: str
    reason: str
    suggestedFix: str


class JudgeFindings(BaseModel):
    """LLM's top-level response envelope — a list of JudgeFinding entries.

    The rubric.md ``Output Format`` section instructs the model to return
    ``{"findings": [...]}``. An empty list is the passing-grade signal.
    """

    findings: list[JudgeFinding]


def _load_rubric() -> str:
    """Read rubric.md from disk (version-controlled prompt)."""
    return _RUBRIC_PATH.read_text(encoding="utf-8")


async def run_llm_judge(
    sections: dict[str, str],
    *,
    run_id: str,
) -> tuple[list[QAFinding], str]:
    """Single Opus call over all section bodies concatenated.

    Args:
        sections: ``{section_id: body}`` flat dict — must include all six
            sections (origin_story, problem, founder_bio, case_study, game,
            bonus). Empty bodies are tolerated.
        run_id: ``state['run_id']`` — required by ``acomplete`` for cost
            recording (D-08 / lib/cost.CostRecorder).

    Returns:
        ``(findings, resolved_model)`` — findings as QAFinding NamedTuples
        (mapped from JudgeFinding Pydantic instances) so the orchestrator
        sees a homogeneous list. ``resolved_model`` is the AGT-17 surface
        for ``state['model_versions']['qa']``.
    """
    rubric = _load_rubric()
    sections_json = json.dumps(sections, indent=2)
    messages = [
        {"role": "system", "content": rubric},
        {
            "role": "user",
            "content": (
                "Evaluate these section bodies against the Jesse voice rubric. "
                "Return JSON JudgeFindings with a `findings` array. "
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
