"""Phase 18 MEL-01 + MEL-02 — Writer structural-floor RED tests.

Asserts each of the 5 long-read writers' response Pydantic model rejects
bodies with < 2 sub-headers OR < 1 blockquote, and accepts conforming bodies.

RED at commit (Wave 0); turns GREEN after Plan 18-04 lands writer Pydantic
changes. Until then, expect ImportError on Annotated[Union[...], discriminator]
OR ValidationError NOT raised (the current `body: str` field accepts any string).

Source: CONTEXT.md D-01 + D-02; RESEARCH §Pattern 2.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

# Imports below will fail at Wave 0 commit because the writers still have
# `body: str`. After Plan 18-04, they import `list[BodyBlock]` and the
# validator. The conftest skip-on-import pattern is intentionally NOT used
# — these tests are SUPPOSED to fail until Wave 2.
from eisenbalm_pipeline.agents.origin_story import OriginStoryOutput
from eisenbalm_pipeline.agents.problem import ProblemOutput
from eisenbalm_pipeline.agents.founder_bio import FounderBioOutput
from eisenbalm_pipeline.agents.case_study import CaseStudyOutput
from eisenbalm_pipeline.agents.bonus import SpecAdBonus


VALID_BODY = [
    {"type": "paragraph", "text": "Burlington, Vermont. 1987."},
    {"type": "h2",        "text": "The founding moment"},
    {"type": "paragraph", "text": "A librarian made a recording."},
    {"type": "blockquote","text": "The silence is the product."},
    {"type": "h2",        "text": "Why not something else"},
    {"type": "paragraph", "text": "Acoustic data has no institutional home."},
]

INVALID_NO_HEADINGS = [
    {"type": "paragraph", "text": "All paragraphs, no headings."},
    {"type": "paragraph", "text": "Still flat."},
    {"type": "blockquote","text": "One pull-quote."},
]

INVALID_ONE_HEADING_NO_BLOCKQUOTE = [
    {"type": "paragraph", "text": "Only one h2."},
    {"type": "h2",        "text": "Movement"},
    {"type": "paragraph", "text": "Final paragraph."},
]

INVALID_TWO_HEADINGS_NO_BLOCKQUOTE = [
    {"type": "paragraph", "text": "Two h2s but no blockquote."},
    {"type": "h2",        "text": "First movement"},
    {"type": "paragraph", "text": "Middle prose."},
    {"type": "h2",        "text": "Second movement"},
    {"type": "paragraph", "text": "Final prose."},
]


# Per-writer construction helpers — each writer's required fields differ;
# we instantiate with the minimum legal set + the body fixture under test.
def _make(writer_cls, body):
    if writer_cls is OriginStoryOutput:
        return writer_cls(headline="H", body=body)
    if writer_cls is ProblemOutput:
        return writer_cls(
            headline="H",
            body=body,
            pdfContent={
                "problemStatement": "p",
                "keyDataPoints": [
                    {"stat": "1", "source": "s"},
                    {"stat": "2", "source": "s"},
                    {"stat": "3", "source": "s"},
                ],
                "interventionMechanism": "i",
            },
        )
    if writer_cls is FounderBioOutput:
        return writer_cls(headline="H", body=body)
    if writer_cls is CaseStudyOutput:
        return writer_cls(subjectName="S", headline="H", body=body)
    if writer_cls is SpecAdBonus:
        return writer_cls(headline="H", body=body)
    raise ValueError(f"Unknown writer class: {writer_cls}")


WRITERS = [
    pytest.param(OriginStoryOutput, id="origin_story"),
    pytest.param(ProblemOutput,    id="problem"),
    pytest.param(FounderBioOutput, id="founder_bio"),
    pytest.param(CaseStudyOutput,  id="case_study"),
    pytest.param(SpecAdBonus,      id="bonus[specAd]"),
]


@pytest.mark.parametrize("writer_cls", WRITERS)
def test_structural_floor_headings_required(writer_cls):
    """MEL-01: writer rejects body with < 2 h2/h3 sub-headers."""
    with pytest.raises(ValidationError) as exc_info:
        _make(writer_cls, INVALID_NO_HEADINGS)
    assert "structural-floor" in str(exc_info.value)
    assert "sub-headers" in str(exc_info.value)


@pytest.mark.parametrize("writer_cls", WRITERS)
def test_structural_floor_blockquote_required(writer_cls):
    """MEL-02: writer rejects body with < 1 blockquote."""
    with pytest.raises(ValidationError) as exc_info:
        _make(writer_cls, INVALID_TWO_HEADINGS_NO_BLOCKQUOTE)
    assert "structural-floor" in str(exc_info.value)
    assert "blockquote" in str(exc_info.value)


@pytest.mark.parametrize("writer_cls", WRITERS)
def test_structural_floor_one_heading_rejected(writer_cls):
    """MEL-01 edge: one heading is not enough (need >= 2)."""
    with pytest.raises(ValidationError):
        _make(writer_cls, INVALID_ONE_HEADING_NO_BLOCKQUOTE)


@pytest.mark.parametrize("writer_cls", WRITERS)
def test_structural_floor_valid_body_accepted(writer_cls):
    """MEL-01 + MEL-02 happy path: 2 h2 + 1 blockquote passes."""
    out = _make(writer_cls, VALID_BODY)
    # body is a list[BodyBlock]; each block has a `type` and `text`
    # (either as dict keys after model_dump, or as attrs on Pydantic instances)
    assert len(out.body) == len(VALID_BODY)
    # accept either dict-shaped (model_dump) or attr-shaped (Pydantic instance)
    first = out.body[0]
    first_type = first.get("type") if isinstance(first, dict) else getattr(first, "type", None)
    assert first_type == "paragraph"
