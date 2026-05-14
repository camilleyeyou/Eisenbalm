"""Portable Text helper — convert plain text to Sanity Portable Text blocks.

DO NOT bypass this helper. Manual block construction silently produces
malformed blocks that render as blank in Sanity Studio.

Source: docs/API_CONTRACTS.md §2.4 (verbatim).
"""
from __future__ import annotations

import uuid


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
