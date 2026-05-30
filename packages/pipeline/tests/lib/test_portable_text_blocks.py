"""Phase 18 lib-layer — block builders + compose_section_body RED tests.

Asserts:
  - block_paragraph emits style='normal'
  - block_h2 emits style='h2'
  - block_h3 emits style='h3'
  - block_blockquote emits style='blockquote'
  - Every block has unique _key + _type='block' + markDefs=[] + single span
  - compose_section_body dispatches list[dict] inputs to the right builder
  - compose_section_body accepts attr-style Pydantic instances too (defensive)

RED at commit (Wave 0); turns GREEN after Plan 18-03 ships the helpers.

Source: RESEARCH §Pattern 3.
"""
from __future__ import annotations

from eisenbalm_pipeline.lib.portable_text import (
    block_blockquote,
    block_h2,
    block_h3,
    block_paragraph,
    compose_section_body,
)


def _assert_block_shape(block: dict, expected_style: str, expected_text: str) -> None:
    assert block["_type"] == "block"
    assert block["style"] == expected_style
    assert block["markDefs"] == []
    assert block["_key"].startswith("block-")
    children = block["children"]
    assert len(children) == 1
    span = children[0]
    assert span["_type"] == "span"
    assert span["_key"].startswith("span-")
    assert span["text"] == expected_text
    assert span["marks"] == []


def test_block_paragraph_shape():
    b = block_paragraph("Hello.")
    _assert_block_shape(b, "normal", "Hello.")


def test_block_h2_shape():
    b = block_h2("First movement")
    _assert_block_shape(b, "h2", "First movement")


def test_block_h3_shape():
    b = block_h3("Sub-point")
    _assert_block_shape(b, "h3", "Sub-point")


def test_block_blockquote_shape():
    b = block_blockquote("The silence is the product.")
    _assert_block_shape(b, "blockquote", "The silence is the product.")


def test_unique_keys_across_blocks():
    """Sanity Studio renders blank for duplicate _keys — each block must be unique."""
    blocks = [block_paragraph(f"p{i}") for i in range(10)]
    keys = [b["_key"] for b in blocks]
    assert len(set(keys)) == 10


def test_compose_section_body_dispatches_dict_input():
    """The production path: writer Pydantic emits list[dict] via model_dump()."""
    blocks_input = [
        {"type": "paragraph", "text": "p1"},
        {"type": "h2",        "text": "h2a"},
        {"type": "blockquote","text": "q1"},
        {"type": "h3",        "text": "h3a"},
        {"type": "paragraph", "text": "p2"},
    ]
    out = compose_section_body(blocks_input)
    assert len(out) == 5
    assert [b["style"] for b in out] == ["normal", "h2", "blockquote", "h3", "normal"]
    assert [b["children"][0]["text"] for b in out] == ["p1", "h2a", "q1", "h3a", "p2"]


def test_compose_section_body_unknown_type_falls_back_to_paragraph():
    """Defensive: unknown 'type' value coerces to paragraph (style='normal')."""
    out = compose_section_body([{"type": "weirdtype", "text": "x"}])
    assert out[0]["style"] == "normal"
    assert out[0]["children"][0]["text"] == "x"


def test_compose_section_body_attr_style_input():
    """Defensive: accept Pydantic-instance-style inputs (attr access on .type/.text)."""

    class FakeBlock:
        def __init__(self, type_: str, text: str):
            self.type = type_
            self.text = text

    out = compose_section_body([
        FakeBlock("h2", "movement"),
        FakeBlock("paragraph", "prose"),
    ])
    assert out[0]["style"] == "h2"
    assert out[1]["style"] == "normal"


def test_compose_section_body_empty_input():
    assert compose_section_body([]) == []
