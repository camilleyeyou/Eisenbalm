"""Quick 261021-7aw — QA self-fix behaviors."""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.agents.qa import qa
from eisenbalm_pipeline.agents.qa import self_fix
from eisenbalm_pipeline.agents.qa.rules import QAFinding
from eisenbalm_pipeline.agents.qa.self_fix import apply_self_fixes, correct_theme

pytestmark = pytest.mark.anyio


def _f(section="origin_story", span="bad phrase", fix="good phrase", axis="precision"):
    return QAFinding(section=section, severity="warning", axis=axis,
                     quotedSpan=span, reason="r", suggestedFix=fix)


def _state():
    return {
        "run_id": "r1",
        "origin_story": {"body": [{"type": "paragraph", "text": "One bad phrase here."},
                                  {"type": "paragraph", "text": "Second block."}]},
        "problem_statement": {"body": [{"type": "paragraph", "text": "dup dup"}]},
        "game": {"description": "A bad phrase in a game."},
        "deliberation_conversation": [{"speaker": "a", "text": "turn with bad phrase"}],
        "deliberation_transcript": "podcast bad phrase transcript",
    }


async def test_unique_span_applied_without_mutating_state():
    st = _state()
    updates, res = await apply_self_fixes(st, [_f()])
    assert res[0]["resolution"] == "agent-applied"
    assert updates["origin_story"]["body"][0]["text"] == "One good phrase here."
    assert st["origin_story"]["body"][0]["text"] == "One bad phrase here."


async def test_missing_and_ambiguous_and_empty_skipped():
    st = _state()
    _, res = await apply_self_fixes(
        st, [_f(span="nope"), _f(section="problem", span="dup"), _f(span="")]
    )
    assert [r["resolution"] for r in res] == ["agent-skipped"] * 3
    assert res[0]["resolutionReason"] == "span not found"
    assert res[1]["resolutionReason"] == "ambiguous span"


async def test_voice_axis_without_fix_generates_rewrite(monkeypatch):
    async def fake(span, reason, run_id):
        return "good phrase"
    monkeypatch.setattr(self_fix, "generate_voice_rewrite", fake)
    updates, res = await apply_self_fixes(_state(), [_f(fix=None, axis="gravity")])
    assert res[0]["resolution"] == "agent-applied"
    assert res[0]["suggestedFix"] == "good phrase"
    assert "good phrase" in updates["origin_story"]["body"][0]["text"]


async def test_voice_rewrite_failure_or_empty_is_skipped(monkeypatch):
    async def boom(*a):
        raise RuntimeError("llm down")
    monkeypatch.setattr(self_fix, "generate_voice_rewrite", boom)
    _, res = await apply_self_fixes(_state(), [_f(fix=None, axis="machine-tell")])
    assert res[0]["resolution"] == "agent-skipped"

    async def empty(*a):
        return ""
    monkeypatch.setattr(self_fix, "generate_voice_rewrite", empty)
    _, res = await apply_self_fixes(_state(), [_f(fix=None, axis="sentiment")])
    assert res[0]["resolution"] == "agent-skipped"


async def test_non_voice_without_fix_skipped():
    _, res = await apply_self_fixes(_state(), [_f(fix=None, axis="precision")])
    assert res[0]["resolution"] == "agent-skipped"


async def test_conversation_podcast_and_game_fixable():
    updates, res = await apply_self_fixes(
        _state(),
        [_f(section="deliberation_conversation"), _f(section="podcast"), _f(section="game")],
    )
    assert [r["resolution"] for r in res] == ["agent-applied"] * 3
    assert updates["deliberation_conversation"][0]["text"] == "turn with good phrase"
    assert updates["deliberation_transcript"] == "podcast good phrase transcript"
    assert updates["game"]["description"] == "A good phrase in a game."


def test_theme_correction():
    theme = {"primaryColor": "red", "accentColor": "#112233", "fontDisplay": "Comic Sans",
             "fontBody": "Lora"}
    new, findings = correct_theme(theme)
    assert new["primaryColor"] == "#2D5016"
    assert new["fontDisplay"] == "Playfair Display"
    assert {f["quotedSpan"] for f in findings} == {"red", "Comic Sans"}
    assert all(f["section"] == "theme" for f in findings)
    valid = {"primaryColor": "#112233", "fontBody": "Lora"}
    assert correct_theme(valid) == (valid, [])


async def _run_qa(monkeypatch, state, fix_impl=None):
    calls = []

    async def fake_mut(path, args):
        calls.append((path, args))

    async def fake_judge(sections, *, run_id, narrator=None, rubric=None):
        return [_f()], "m"

    monkeypatch.setattr("eisenbalm_pipeline.agents.qa.convex_mutation_safe", fake_mut)
    monkeypatch.setattr("eisenbalm_pipeline.agents._wrapper.convex_mutation_safe", fake_mut)
    monkeypatch.setattr("eisenbalm_pipeline.agents.qa.run_llm_judge", fake_judge)
    if fix_impl:
        monkeypatch.setattr("eisenbalm_pipeline.agents.qa.apply_self_fixes", fix_impl)
    out = await qa(state)
    return out, [a for p, a in calls if p == "qaCorrections:insert"]


async def test_qa_inserts_closed_rows_and_applies_fix(monkeypatch):
    st = _state()
    st["theme"] = {"primaryColor": "red"}
    out, inserts = await _run_qa(monkeypatch, st)
    assert out["origin_story"]["body"][0]["text"] == "One good phrase here."
    assert out["theme"]["primaryColor"] == "#2D5016"
    assert inserts and all(
        i["resolution"] in {"agent-applied", "agent-skipped"}
        and i["resolvedBy"] == "pipeline-agent"
        and isinstance(i["resolvedAt"], int)
        for i in inserts
    )
    assert any(i["sectionName"] == "theme" for i in inserts)


async def test_qa_survives_self_fix_exception(monkeypatch):
    async def boom(state, findings):
        raise RuntimeError("bad state")
    out, inserts = await _run_qa(monkeypatch, _state(), fix_impl=boom)
    assert out["origin_story"]["body"][0]["text"] == "One bad phrase here."
    assert inserts and all(i["resolution"] == "agent-skipped" for i in inserts)
