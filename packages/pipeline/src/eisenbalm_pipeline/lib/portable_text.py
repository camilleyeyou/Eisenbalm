"""Portable Text helper — convert plain text to Sanity Portable Text blocks.

DO NOT bypass this helper. Manual block construction silently produces
malformed blocks that render as blank in Sanity Studio.

Source: docs/API_CONTRACTS.md §2.4 (verbatim).
"""
from __future__ import annotations

import logging
import uuid

log = logging.getLogger(__name__)


def text_to_portable_text(text: str) -> list[dict]:
    """Convert plain text (paragraphs separated by blank lines) to Sanity
    Portable Text block array.

    Args:
        text: Plain text. Paragraphs separated by ``\\n\\n``.

    Returns:
        List of Portable Text block dicts ready to write to Sanity.
    """
    paragraphs = [p.strip() for p in text.strip().split('\n\n') if p.strip()]
    return [
        {
            '_type': 'block',
            '_key': f'block-{uuid.uuid4().hex[:8]}',
            'style': 'normal',
            'markDefs': [],
            'children': [
                {
                    '_type': 'span',
                    '_key': f'span-{uuid.uuid4().hex[:8]}',
                    'text': para,
                    'marks': [],
                }
            ],
        }
        for para in paragraphs
    ]


# ────────────────────────────────────────────────────────────────────────
# Phase 18: typed block builders + compose_section_body serializer
#
# Source: docs/API_CONTRACTS.md §2.4 + CONTEXT D-01 + RESEARCH §Pattern 3.
#
# Long-read writer Pydantic models emit list[BodyBlock] (discriminated union
# over Paragraph | Heading | Blockquote — see graph/blocks.py). The Sanity
# write path in lib/sanity_client.py calls compose_section_body(body_blocks)
# which dispatches each block on its `type` field to the matching builder.
#
# `text_to_portable_text` (above) stays in this module as a tombstone:
#   - BigBudgetBonus.body remains str (D-04 — visual variety from storyboards[])
#   - JingleBonus.body remains str (D-04 — visual variety from lyrics+sunoPrompt)
#   - Stub fixtures may still emit body: str until Plan 18-06 updates them
# ────────────────────────────────────────────────────────────────────────


def block_paragraph(text: str) -> dict:
    """Emit one Sanity Portable Text block with style='normal'."""
    return {
        '_type': 'block',
        '_key': f'block-{uuid.uuid4().hex[:8]}',
        'style': 'normal',
        'markDefs': [],
        'children': [
            {
                '_type': 'span',
                '_key': f'span-{uuid.uuid4().hex[:8]}',
                'text': text,
                'marks': [],
            }
        ],
    }


def block_h2(text: str) -> dict:
    """Emit one Sanity Portable Text block with style='h2' (sub-header)."""
    return {
        '_type': 'block',
        '_key': f'block-{uuid.uuid4().hex[:8]}',
        'style': 'h2',
        'markDefs': [],
        'children': [
            {
                '_type': 'span',
                '_key': f'span-{uuid.uuid4().hex[:8]}',
                'text': text,
                'marks': [],
            }
        ],
    }


def block_h3(text: str) -> dict:
    """Emit one Sanity Portable Text block with style='h3' (nested sub-header)."""
    return {
        '_type': 'block',
        '_key': f'block-{uuid.uuid4().hex[:8]}',
        'style': 'h3',
        'markDefs': [],
        'children': [
            {
                '_type': 'span',
                '_key': f'span-{uuid.uuid4().hex[:8]}',
                'text': text,
                'marks': [],
            }
        ],
    }


def block_blockquote(text: str) -> dict:
    """Emit one Sanity Portable Text block with style='blockquote' (pull-quote)."""
    return {
        '_type': 'block',
        '_key': f'block-{uuid.uuid4().hex[:8]}',
        'style': 'blockquote',
        'markDefs': [],
        'children': [
            {
                '_type': 'span',
                '_key': f'span-{uuid.uuid4().hex[:8]}',
                'text': text,
                'marks': [],
            }
        ],
    }


def compose_section_body(blocks: list) -> list[dict]:
    """Dispatch a list of typed body blocks to the matching Portable Text builder.

    Args:
        blocks: A list whose elements are either:
          - dicts with 'type' and 'text' keys (production path: writer Pydantic
            model_dump() output), OR
          - Pydantic instances with .type and .text attributes (defensive path:
            tests / direct agent calls).

          Block 'type' values map to builders:
            - 'h2'         -> block_h2
            - 'h3'         -> block_h3
            - 'blockquote' -> block_blockquote
            - 'paragraph'  -> block_paragraph (default for any unknown type)

    Returns:
        A list of Sanity Portable Text block dicts ready to write to Sanity.
    """
    result: list[dict] = []
    for b in blocks:
        if isinstance(b, dict):
            t = b.get('type')
            text = b.get('text', '')
        else:
            t = getattr(b, 'type', None)
            text = getattr(b, 'text', '')
        if t == 'h2':
            result.append(block_h2(text))
        elif t == 'h3':
            result.append(block_h3(text))
        elif t == 'blockquote':
            result.append(block_blockquote(text))
        else:
            # 'paragraph', None, or any unknown value falls back to paragraph
            result.append(block_paragraph(text))
    return result


# ────────────────────────────────────────────────────────────────────────
# Phase 31 — pt_to_blocks(): reverse mapper (Portable Text -> block rows)
#
# Source: docs/API_CONTRACTS.md §31.7. The inverse of compose_section_body,
# needed by the content-patch draft-read GET (EDT-01) so the operator editor
# can round-trip existing Sanity content back into the {type, text}[] shape
# the PATCH endpoints accept.
# ────────────────────────────────────────────────────────────────────────


def pt_to_blocks(pt_blocks: list[dict]) -> tuple[list[dict], bool]:
    """Inverse of compose_section_body. Returns ({type,text}[] rows, lossy).

    lossy=True if ANY block had markDefs (len>0) or multiple children spans —
    those marks/spans are flattened by the naive text-join (v1 limitation:
    the block model was never inline-WYSIWYG). See API_CONTRACTS §31.7.
    """
    style_to_type = {"h2": "h2", "h3": "h3", "blockquote": "blockquote"}
    rows: list[dict] = []
    lossy = False
    for b in pt_blocks or []:
        children = b.get("children") or []
        if (b.get("markDefs") or []) or len(children) > 1:
            lossy = True
        block_type = style_to_type.get(b.get("style"), "paragraph")
        text = "".join(c.get("text", "") for c in children)
        rows.append({"type": block_type, "text": text})
    if lossy:
        log.warning(
            "pt_to_blocks: lossy conversion — a stored block had markDefs "
            "or multiple children spans that were flattened by the "
            "naive text-join. See API_CONTRACTS.md §31.7."
        )
    return rows, lossy
