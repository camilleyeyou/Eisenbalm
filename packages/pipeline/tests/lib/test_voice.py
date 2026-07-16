"""Phase 5 lib/voice.py unit test — implementation in Plan 05-03.

Validation source: .planning/phases/05-agent-quality/05-VALIDATION.md
REQ-ID: AGT-09

Phase 47 (BRF-05, Plan 47-03) additions: ``build_section_writer_prompt``
gains a 5th optional ``brief`` keyword param — the six-field Story Brief.
These tests assert (a) ``brief=None`` is byte-identical to the pre-Phase-47
shape, (b) a supplied brief's six values appear in the USER message and
NEVER the system message, and (c) ``build_brief_block`` (the shared
formatter reused by the 3 bespoke writer prompt builders — game, bonus,
design) is None-safe.
"""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.lib.voice import (
    build_brief_block,
    build_section_writer_prompt,
)


@pytest.mark.skip(reason="Wave 0: pending — Plan 05-03 implements")
def test_prompt_isolation() -> None:
    """Asserted by Plan 05-03. Remove skip marker when body lands."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0: pending — Plan 05-03 implements")
def test_voice_constants_present() -> None:
    """Asserted by Plan 05-03. Remove skip marker when body lands."""
    raise NotImplementedError


# ─── Phase 47 (BRF-05): brief=None is byte-identical to pre-Phase-47 ───────


def _base_kwargs() -> dict:
    return {
        "section_id": "origin_story",
        "section_title": "Origin Story",
        "section_guidance": "400-600 words.",
        "charity": {
            "name": "The Nap Ministry",
            "location": "Atlanta",
            "focusArea": "rest",
            "missionStatement": "Rest is resistance.",
        },
        "research": {
            "foundingMoment": "founded in 2016",
            "founderBackground": "a background",
        },
        "style_brief": {"bonusType": "specAd", "visualDirection": "muted"},
    }


def test_brief_none_is_byte_identical_to_prior_shape() -> None:
    """Calling with brief=None (the default) must produce the exact same
    message list as calling with no brief kwarg at all — the Phase 47
    addition must not alter output for any pre-existing call site."""
    kwargs = _base_kwargs()
    messages_explicit_none = build_section_writer_prompt(**kwargs, brief=None)
    messages_omitted = build_section_writer_prompt(**kwargs)
    assert messages_explicit_none == messages_omitted
    # No "STORY BRIEF" header should appear anywhere when brief is absent.
    for message in messages_omitted:
        assert "STORY BRIEF" not in message["content"]


def test_brief_values_render_in_user_message_only() -> None:
    """A supplied six-field brief's values must appear in the USER message
    content and must NEVER leak into the system message (voice isolation,
    mirrors the claims-block discipline)."""
    brief = {
        "premise": "PREMISE_SENTINEL",
        "currentPeg": "PEG_SENTINEL",
        "centralClaim": "CLAIM_SENTINEL",
        "readerEffect": "EFFECT_SENTINEL",
        "knownRisks": "RISKS_SENTINEL",
        "voiceIntention": "INTENTION_SENTINEL",
    }
    messages = build_section_writer_prompt(**_base_kwargs(), brief=brief)
    system_content = next(m["content"] for m in messages if m["role"] == "system")
    user_content = next(m["content"] for m in messages if m["role"] == "user")

    for value in brief.values():
        assert value in user_content, f"{value!r} missing from USER message"
        assert value not in system_content, f"{value!r} leaked into SYSTEM message"

    assert "STORY BRIEF (draft from this):" in user_content


def test_build_section_writer_prompt_accepts_brief_keyword() -> None:
    """Signature check: brief is keyword-only (the function is entirely
    keyword-only per its `*,` marker) and optional."""
    import inspect

    sig = inspect.signature(build_section_writer_prompt)
    assert "brief" in sig.parameters
    param = sig.parameters["brief"]
    assert param.kind == inspect.Parameter.KEYWORD_ONLY
    assert param.default is None


# ─── build_brief_block — the shared formatter (game/bonus/design reuse) ───


def test_build_brief_block_none_safe() -> None:
    assert build_brief_block(None) == ""
    assert build_brief_block({}) == ""


def test_build_brief_block_renders_all_six_fields() -> None:
    brief = {
        "premise": "p",
        "currentPeg": "cp",
        "centralClaim": "cc",
        "readerEffect": "re",
        "knownRisks": "kr",
        "voiceIntention": "vi",
    }
    block = build_brief_block(brief)
    for value in brief.values():
        assert value in block
    assert block.endswith("\n\n")
