"""Phase 18 — shared BodyBlock discriminated union for long-read writer schemas.

All five long-read writer response models (OriginStoryOutput, ProblemOutput,
FounderBioOutput, CaseStudyOutput, SpecAdBonus) import BodyBlock from here.
One definition, five consumers — no drift risk.

Used by: agents/{origin_story,problem,founder_bio,case_study,bonus}.py
Serialized by: lib/portable_text.compose_section_body
Documented in: docs/API_CONTRACTS.md §7 + §2.4 + CONTEXT.md D-01.

Pydantic v2.13.4 discriminator pattern; Literal['h2','h3'] is the multi-value
discriminator on Heading. The Phase 13 chronicler turns module uses the same
`Field(discriminator='type')` pattern (no drift from established codebase style).
"""
from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class Paragraph(BaseModel):
    """Plain prose block — renders as <p> in Sanity Portable Text."""

    type: Literal['paragraph'] = 'paragraph'
    text: str = ""


class Heading(BaseModel):
    """Sub-header block — renders as <h2> or <h3> in Sanity Portable Text.

    The writer picks h2 (top-level movement) or h3 (nested sub-point) per
    local hierarchy. Phase 18 structural floor counts both as "sub-headers".
    """

    type: Literal['h2', 'h3']
    text: str = ""


class Blockquote(BaseModel):
    """Pull-quote block — renders as <blockquote> in Sanity Portable Text.

    Phase 18 requires every long-read section to lift ONE sentence from body
    prose into a blockquote. Editorial register; per CONTEXT D-05 the QA judge
    evaluates pull-quote authenticity (vs. generic restatement) qualitatively.
    """

    type: Literal['blockquote'] = 'blockquote'
    text: str = ""


BodyBlock = Annotated[
    Union[Paragraph, Heading, Blockquote],
    Field(discriminator='type'),
]
