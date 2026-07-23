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
import re
import time

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.agents.qa.judge import run_llm_judge
from eisenbalm_pipeline.agents.qa.rules import QAFinding, run_all_predicates
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe, convex_query_safe

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
    list[dict] (BodyBlock-shaped blocks) not str. QA judge sees concatenated
    prose so it can evaluate sub-head wording and pull-quote authenticity
    without parsing block JSON itself.

    Handles both legacy str (BigBudget/Jingle body, stubs) and new list[dict]
    (Phase 18 OriginStory/Problem/FounderBio/CaseStudy/SpecAd bodies).

    Bug fix (stale-empty-section-qa-findings, 2026-07-23): graph/blocks.py's
    ``BodyBlock`` is a FLAT ``{"type": ..., "text": ...}`` shape (Phase 18's
    "post-launch fix" collapsed the original discriminated-union
    Paragraph/Heading/Blockquote classes into one flat class specifically
    because Anthropic's structured-output API rejects `oneOf` schemas — see
    graph/blocks.py's docstring). It has NO ``children`` key. This function
    was written in the SAME Phase 18-04 commit that shipped the flat
    BodyBlock shape everywhere else, but assumed the OLDER nested
    Sanity-Portable-Text shape (``{"children": [{"text": ...}]}``) — a
    same-commit authoring mistake that made this helper return "" for EVERY
    list-bodied section, on EVERY run, silently feeding empty prose to the
    Layer-2 LLM judge. Whether the judge then explicitly flags "this section
    is empty" as a finding is a non-deterministic LLM judgment call, which is
    why the visible symptom is intermittent even though the underlying
    extraction bug fires every single time.

    Each list element is checked for a direct ``"text"`` key FIRST (the real,
    current BodyBlock shape); the legacy ``children[].text`` shape is
    supported as a fallback only, for any old fixture/back-compat caller that
    still emits the nested Portable-Text-like shape.
    """
    if isinstance(body, str):
        return body
    if isinstance(body, list):
        parts: list[str] = []
        for block in body:
            if not isinstance(block, dict):
                continue
            if 'children' in block:
                # Legacy nested Portable-Text-like shape (fallback only).
                for child in block.get('children') or []:
                    if isinstance(child, dict):
                        parts.append(child.get('text', ''))
            else:
                # Current flat BodyBlock shape: {"type": ..., "text": ...}.
                parts.append(block.get('text', ''))
        return ' '.join(p for p in parts if p)
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
    the client resolver's unique-substring rule (D-12: never guess).

    Bug fix (stale-empty-section-qa-findings, 2026-07-23): same shape
    mismatch as ``_body_to_text`` above — ``BodyBlock`` blocks are flat
    ``{"type": ..., "text": ...}`` dicts with no ``children`` key. Reads
    ``block.get("text", "")`` directly; falls back to the legacy nested
    ``children[].text`` shape only when a block actually has a ``children``
    key (defensive back-compat, not the production shape).
    """
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
        if 'children' in block:
            text = " ".join(
                (c.get("text", "") for c in (block.get("children") or [])
                 if isinstance(c, dict))
            )
        else:
            text = block.get("text", "")
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


async def heal_stale_empty_section_findings(
    run_id: str, sections: dict[str, str],
) -> int:
    """Auto-dismiss any OPEN "{section} section is empty" QA finding whose
    section now demonstrably has content (heal path — bug session
    ``stale-empty-section-qa-findings``, 2026-07-23).

    Root cause: ``_body_to_text``/``_block_index_hint`` above used to
    silently extract "" for every list-bodied section (a same-commit Phase
    18-04 shape-mismatch bug — see their docstrings), so the Layer-2 LLM
    judge sometimes hallucinated an "empty section" finding despite the
    writer having produced real content the whole time. That extraction bug
    is fixed above; this function is defense-in-depth for TWO cases the fix
    above does not retroactively cover:

      1. qaCorrections rows already inserted by runs that executed BEFORE
         this fix landed — this is the only path that can retract them.
      2. Any future run where the Layer-2 judge independently hallucinates
         an "empty section" claim despite receiving correct, non-empty
         input (an LLM judgment error, not an extraction bug) — rare, but a
         factually self-contradictory finding should never survive to block
         a human sign-off.

    Called from ``agents/publisher`` immediately after ``write_issue_draft``
    persists the section content this function checks against — i.e. only
    once the content is genuinely, durably non-empty.

    Conservative by design: only dismisses a finding when BOTH (a) its
    ``reason`` matches "the {sectionName} section is empty" for its OWN
    ``sectionName`` (never a fuzzy/cross-section match) and (b) the
    freshly-extracted section text is non-empty. Never touches any other
    finding — voice/precision/structural findings on real content are left
    untouched (they are not this bug), and any finding already resolved
    (accepted/dismissed) is skipped.

    Returns the number of findings healed (0 on no-op, including when the
    qaCorrections read fails — convex_query_safe degrades to None/[]).
    """
    rows = await convex_query_safe("qaCorrections:byRunId", {"runId": run_id}) or []
    healed = 0
    now_ms = int(time.time() * 1000)
    for row in rows:
        if row.get("resolution"):
            continue  # already resolved — never touch
        section = row.get("sectionName") or ""
        reason = row.get("reason") or ""
        if not re.search(
            rf"\bthe\s+{re.escape(section)}\s+section is empty\b",
            reason,
            re.IGNORECASE,
        ):
            continue
        current_text = (sections.get(section) or "").strip()
        if not current_text:
            continue  # genuinely still empty — do not heal
        await convex_mutation_safe(
            "qaCorrections:setResolution",
            {
                "id": row["_id"],
                "resolution": "dismissed",
                "resolutionReason": (
                    "Auto-resolved: write_issue_draft persisted non-empty "
                    "content for this section. This finding was produced "
                    "under a QA extraction bug that fed an empty body to "
                    "the judge despite the writer's real output "
                    "(stale-empty-section-qa-findings) — it no longer "
                    "reflects the draft."
                ),
                "resolvedBy": "pipeline-auto-heal",
                "resolvedAt": now_ms,
            },
        )
        healed += 1
    if healed:
        log.info(
            "heal_stale_empty_section_findings: auto-dismissed %d stale "
            "'section is empty' finding(s) for run_id=%s",
            healed,
            run_id,
        )
    return healed


__all__ = ["qa", "heal_stale_empty_section_findings"]
