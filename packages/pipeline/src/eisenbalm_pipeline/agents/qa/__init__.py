"""Phase 5 QA — orchestrates Layer-1 hard rules + Layer-2 LLM-as-judge.

Runs ONCE over all six section bodies (D-03). Writes one qaCorrections row
per finding (D-01). NEVER mutates section state (D-02). NEVER blocks the
draft (D-04) — always returns success state regardless of finding severity.

Three defense layers, listed in the order they fire:

  1. lib/voice.py VOICE_CONSTRAINTS injected at every section-writer's
     prompt-assembly time (preventative).
  2. agents/qa/rules.py — Layer-1 deterministic predicates (curative
     rule-based backstop). Phase 36 (§36.2): each predicate's true axis
     (gravity/sentiment/irony-signaling/precision) is written verbatim —
     the prior single-literal axis collapse is retired so Voice Pass's
     axis filter can see these findings.
  3. agents/qa/judge.py — Layer-2 LLM-as-judge (curative judgment).
     Emits findings on the five evaluative axes from rubric.md.

emit_event='qa-correction': the @agent_node wrapper emits one summary
deliberationEvents row on the success path. Per-finding observability is
the qaCorrections table itself (one row per finding, queried by runId).

Layout pattern mirrors agents/design/ (Plan 05-04): the package
``__init__.py`` IS the orchestrator (exports the ``qa`` agent function);
``rules.py`` + ``judge.py`` + ``rubric.md`` are submodules.
"""
from __future__ import annotations

import logging

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.agents.qa.judge import run_llm_judge
from eisenbalm_pipeline.agents.qa.rules import QAFinding, run_all_predicates
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe

log = logging.getLogger(__name__)


def _qa_payload(state: DispatchState) -> dict:
    """Summary payload for the single deliberationEvents:insert row.

    Per-finding observability lives in the qaCorrections table itself —
    this payload is a roll-up Andrew sees in the live deliberation UI.
    """
    corrections = state.get("qa_corrections") or []
    return {
        "totalCorrections": len(corrections),
        "errorCount": sum(
            1 for c in corrections if c.get("severity") == "error"
        ),
        "warningCount": sum(
            1 for c in corrections if c.get("severity") == "warning"
        ),
        "infoCount": sum(
            1 for c in corrections if c.get("severity") == "info"
        ),
    }


def _body_to_text(body) -> str:
    """Extract plain text from a section body field.

    Phase 18 RESEARCH Pitfall 2: after Phase 18, long-read writer bodies are
    list[dict] (Portable Text blocks) not str. QA judge sees concatenated prose
    so it can evaluate sub-head wording and pull-quote authenticity without
    parsing block JSON itself.

    Handles both legacy str (BigBudget/Jingle body, stubs) and new list[dict]
    (Phase 18 OriginStory/Problem/FounderBio/CaseStudy/SpecAd bodies).
    """
    if isinstance(body, str):
        return body
    if isinstance(body, list):
        parts: list[str] = []
        for block in body:
            for child in (block.get('children') or []) if isinstance(block, dict) else []:
                parts.append(child.get('text', ''))
        return ' '.join(parts)
    return ''


def _extract_sections(state: DispatchState) -> dict[str, str]:
    """Pull the six section bodies into a flat ``{section_id: body}`` dict.

    Section-id strings match the rubric.md ``Input Format`` example and the
    Layer-1 ``check_unverified_name`` branches (founder_bio / case_study).

    Note the state-field-to-section-id mapping:
      - state['problem_statement'] -> 'problem' (two-name convention; the
        agent_id is 'problem' but the DispatchState field is
        'problem_statement' per Plan 05-10 SUMMARY)
      - state['game'].description (not .body) — GameContent has no 'body'

    Phase 18 Pitfall 2: body fields are now list[dict] for long-read sections;
    _body_to_text() handles both str (BigBudget/Jingle/stubs) and list[dict].
    """
    origin = state.get("origin_story") or {}
    problem = state.get("problem_statement") or {}
    founder = state.get("founder_bio") or {}
    case_st = state.get("case_study") or {}
    game = state.get("game") or {}
    bonus = state.get("bonus") or {}
    return {
        "origin_story": _body_to_text(origin.get("body", "") or ""),
        "problem":      _body_to_text(problem.get("body", "") or ""),
        "founder_bio":  _body_to_text(founder.get("body", "") or ""),
        "case_study":   _body_to_text(case_st.get("body", "") or ""),
        "game":         game.get("description", "") or "",
        "bonus":        _body_to_text(bonus.get("body", "") or ""),
    }


# Maps QA snake_case section name -> DispatchState field holding the raw
# Portable Text block list (block ordinal is 1:1 with the draft-read
# `blocks` rows, because pt_to_blocks maps each block -> one row).
_SECTION_STATE_FIELD = {
    "origin_story": "origin_story",
    "problem": "problem_statement",
    "founder_bio": "founder_bio",
    "case_study": "case_study",
    "bonus": "bonus",
}


def _block_index_hint(state: DispatchState, section: str, quoted: str | None) -> int | None:
    """Return the ordinal of the ONLY block whose text contains `quoted`,
    else None (0 or 2+ matches -> no hint; game/None -> no hint). Mirrors
    the client resolver's unique-substring rule (D-12: never guess)."""
    if not quoted:
        return None
    field = _SECTION_STATE_FIELD.get(section)
    if field is None:
        return None
    body = (state.get(field) or {}).get("body")
    if not isinstance(body, list):
        return None
    matches = []
    for i, block in enumerate(body):
        if not isinstance(block, dict):
            continue
        text = " ".join(
            (c.get("text", "") for c in (block.get("children") or [])
             if isinstance(c, dict))
        )
        if quoted in text:
            matches.append(i)
    return matches[0] if len(matches) == 1 else None


def _finding_to_qa_correction(f: QAFinding) -> dict:
    """Convert a QAFinding NamedTuple to the QACorrection dict shape
    written into ``state['qa_corrections']`` (graph/state.QACorrection).

    The Convex insert call uses a slightly different (post-05-01) field
    set: ``sectionName`` + ``axis`` + ``quotedSpan`` + ``suggestedFix``;
    field-name mapping happens at the call site in ``qa()`` below.
    """
    return {
        "sectionName": f.section,
        "severity": f.severity,
        "axis": f.axis,
        "quotedSpan": f.quotedSpan,
        "reason": f.reason,
        "suggestedFix": f.suggestedFix,
        "accepted": False,
        # legacy-shape fields (now optional on Convex; left empty in Phase 5)
        "fieldName": "",
        "original": "",
        "corrected": "",
    }


@agent_node(name="qa", emit_event="qa-correction", payload_builder=_qa_payload)
async def qa(state: DispatchState) -> DispatchState:
    """Two-layer QA pass. Annotation-only. Never blocks the draft.

    D-02: NEVER mutates section content — only writes ``state['qa_corrections']``.
    D-03: ONE holistic pass over all six sections after fan-out.
    D-04: NEVER raises on findings — only on infrastructure errors.
    """
    run_id = state["run_id"]
    sections = _extract_sections(state)
    research = state.get("research") or {}

    # Layer 1: deterministic predicates (per-section, in-process; no I/O).
    # §36.2: each raw finding already carries its predicate's true axis
    # (gravity/sentiment/irony-signaling/precision) — no override. The prior
    # single-literal axis collapse silently hid the axis from Voice Pass's
    # axis filter and is retired for new rows.
    layer1_raw: list[QAFinding] = run_all_predicates(sections, research)
    layer1: list[QAFinding] = layer1_raw

    # Layer 2: LLM-as-judge (one Opus call, all sections concatenated).
    # Phase 16 (NRR-09): pass the resolved narrator (if any) so the judge can
    # evaluate against the narrator's voice rubric. When ``state['narrator']``
    # is None (legacy Jesse-default path), run_llm_judge produces byte-identical
    # Phase 5 messages (NRR-10).
    narrator = state.get("narrator")
    # Phase 24 (PRM-01): read the operator-editable rubric from RunConfig (loaded
    # once at run start), with disk fallback inside run_llm_judge when absent.
    cfg = state.get("config")
    rubric = cfg.rubric if cfg else None
    layer2, resolved_model = await run_llm_judge(
        sections, run_id=run_id, narrator=narrator, rubric=rubric,
    )

    all_findings = layer1 + layer2

    # Write each finding to Convex (QA never blocks; always writes+continues).
    # Canonical Phase 5 payload (post-Plan 05-01 schema patch):
    #   - 'sectionName' (NOT 'section') — matches Convex validator field name
    #   - 'reason' (NOT 'reasoning') — Pydantic field is `reason`
    #   - 'accepted: False' boolean (D-02 annotation-only); Andrew flips in Phase 9
    #   - 'axis' carries each finding's true predicate/judge axis (§36.2 —
    #     Layer-1 no longer collapses to a single literal)
    for f in all_findings:
        hint = _block_index_hint(state, f.section, f.quotedSpan)
        payload = {
            "runId": run_id,
            "agentId": "qa",
            "sectionName": f.section,
            "severity": f.severity,
            "axis": f.axis,
            "quotedSpan": f.quotedSpan,
            "reason": f.reason,
            "suggestedFix": f.suggestedFix,
            "accepted": False,
        }
        if hint is not None:
            payload["blockIndexHint"] = hint
        await convex_mutation_safe("qaCorrections:insert", payload)

    # AGT-17: record resolved model under the llm_config key.
    model_versions = dict(state.get("model_versions") or {})
    model_versions["qa"] = resolved_model

    log.info(
        "QA complete: %d findings (Layer-1=%d, Layer-2=%d) — annotation-only, "
        "draft continues to editor_final",
        len(all_findings),
        len(layer1),
        len(layer2),
    )

    return {
        **state,
        "qa_corrections": [_finding_to_qa_correction(f) for f in all_findings],
        "model_versions": model_versions,
    }


__all__ = ["qa"]
