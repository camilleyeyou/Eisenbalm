"""Phase 18 — flat BodyBlock model for long-read writer schemas.

All five long-read writer response models (OriginStoryOutput, ProblemOutput,
FounderBioOutput, CaseStudyOutput, SpecAdBonus) import BodyBlock from here.
One definition, five consumers — no drift risk.

Used by: agents/{origin_story,problem,founder_bio,case_study,bonus}.py
Serialized by: lib/portable_text.compose_section_body
Documented in: docs/API_CONTRACTS.md §7 + §2.4 + CONTEXT.md D-01.

────────────────────────────────────────────────────────────────────────────
Phase 18 post-launch fix — flat single-class shape (no discriminated union)
────────────────────────────────────────────────────────────────────────────
The original Pydantic v2 discriminated union pattern
(``Annotated[Union[Paragraph, Heading, Blockquote], Field(discriminator='type')]``)
emitted JSON Schema with ``oneOf`` + discriminator mapping. Anthropic's
structured-output API rejects ``oneOf`` with HTTP 400:

    "output_config.format.schema: Schema type 'oneOf' is not supported"

(observed on first production run, runId 42e91ca09c4f4c548d79580928fce09f,
case_study writer, 2026-05-30). The retry-once path could not help because
the schema is rejected BEFORE any model output is generated.

Fix: collapse the three subclasses into a single ``BodyBlock`` class with
``type: Literal['paragraph', 'h2', 'h3', 'blockquote']``. Generates a single
object schema with a string-enum on ``type`` — accepted by every provider.
Semantics unchanged:

  - ``lib/portable_text.compose_section_body`` dispatches on ``b.type``
  - The ``_enforce_structural_floor`` validator counts headings + blockquote
    by ``b.type`` predicate
  - All test fixtures already use plain dicts ({"type": "h2", "text": ...})
    so this is a zero-impact change at the call-site layer

Tradeoff: loses per-shape Pydantic class precision (a ``BodyBlock`` with
``type='paragraph'`` could theoretically be constructed with any text content,
including an empty string — same as before — no new failure modes). Gains:
works against Anthropic, OpenAI, and every other structured-output provider.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class BodyBlock(BaseModel):
    """A single Portable-Text-shaped block emitted by a long-read writer.

    Fields:
        type: One of 'paragraph' (rendered <p>), 'h2' / 'h3' (rendered as
              sub-headers via PortableTextRenderer.h2 / h3), 'blockquote'
              (rendered as a pull-quote via PortableTextRenderer.blockquote).
              The Phase 18 structural floor (writer @field_validator) counts
              type in ('h2', 'h3') as "sub-headers" and type == 'blockquote'
              as "pull-quotes".
        text: Plain prose for the block. No Markdown, no inline HTML — Sanity
              Portable Text serialization happens downstream in
              lib/portable_text.compose_section_body.
    """

    type: Literal['paragraph', 'h2', 'h3', 'blockquote']
    text: str = ""
