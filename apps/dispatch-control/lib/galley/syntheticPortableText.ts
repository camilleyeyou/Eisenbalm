/**
 * Phase 32 (GLY-01) — synthetic-PortableText adapter.
 *
 * `GET /issues/{run_id}/draft` does not return real Sanity Portable Text —
 * `pt_to_blocks()` flattens every block to a single-joined-string row
 * (`{type, text}`), losing marks/multi-span structure. This module
 * synthesizes a minimal valid PortableText block per flat row and injects
 * one `markDef` per resolved annotation touching that block, splitting
 * `children` at every annotation boundary so `@portabletext/react`'s
 * native mark-component API can render (and stack) severity-colored spans.
 *
 * Pure module — the `ResolvedAnnotation` shape is declared locally (rather
 * than imported from the span-resolver module built in a sibling plan) so
 * this file has zero cross-plan coupling; the shape mirrors the resolver's
 * documented output exactly (findingId, blockIndex, start, end, severity,
 * axis?, reason, suggestedFix?, quotedSpan?).
 *
 * Phase 35 (PRV-03) extends this same breakpoint machinery with a SECOND,
 * independent mark family — `claimSpan` — so a span can carry a claim
 * provenance wash STACKED alongside a QA `annotation` mark (D-09:
 * underline-over-wash, never a collision, because the wash is a background
 * treatment and the annotation is a border-bottom treatment on separate
 * nested DOM elements). `ResolvedClaim` mirrors `ResolvedAnnotation`
 * (blockIndex/start/end) plus the claim's provenance fields; it is declared
 * locally for the same zero-coupling reason. Passing an empty/omitted
 * `claimAnnotations` array keeps `toSyntheticBlocks`'s output byte-identical
 * to its pre-Phase-35 shape.
 */

export interface ResolvedAnnotation {
  findingId: string
  sectionId?: string
  blockIndex: number
  start: number
  end: number
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
}

/** Phase 35 (PRV-03) — a claim_checks row resolved onto exact block offsets. */
export interface ResolvedClaim {
  claimIndex: number
  sectionId?: string
  blockIndex: number
  start: number
  end: number
  /** claimId present on the source row => 'sourced'; absent => 'unsourced'. */
  provenance: 'sourced' | 'unsourced'
  sourceUrl?: string
  retrievedAt?: number
  /** claim_checks.status — "pending" | "checked" | "skipped". */
  status: string
}

export interface SyntheticRow {
  type: string
  text: string
}

export interface PortableTextSpan {
  _type: 'span'
  _key: string
  text: string
  marks: string[]
}

export interface AnnotationMarkDef {
  _type: 'annotation'
  _key: string
  findingId: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
}

/** Phase 35 (PRV-03) — the claimSpan markDef stacked alongside `annotation`. */
export interface ClaimSpanMarkDef {
  _type: 'claimSpan'
  _key: string
  claimIndex: number
  provenance: 'sourced' | 'unsourced'
  sourceUrl?: string
  retrievedAt?: number
  status: string
}

export type SyntheticMarkDef = AnnotationMarkDef | ClaimSpanMarkDef

export interface SyntheticPortableTextBlock {
  _type: 'block'
  _key: string
  style: string
  markDefs: SyntheticMarkDef[]
  children: PortableTextSpan[]
}

/**
 * Convert flat `{type,text}` draft rows plus per-block resolved annotations
 * (and, Phase 35, resolved claim spans) into synthetic PortableText blocks.
 * `sectionId` disambiguates `_key` values across sections rendered in the
 * same galley. `claimAnnotations` defaults to `[]` so pre-Phase-35 callers
 * (and the existing annotation-only test suite) see byte-identical output.
 */
export function toSyntheticBlocks(
  rows: SyntheticRow[],
  annotations: ResolvedAnnotation[],
  sectionId = 'section',
  claimAnnotations: ResolvedClaim[] = [],
): SyntheticPortableTextBlock[] {
  return rows.map((row, blockIndex) => {
    const style = row.type === 'paragraph' ? 'normal' : row.type
    const blockKey = `row-${sectionId}-${blockIndex}`
    const anns = annotations.filter((a) => a.blockIndex === blockIndex)
    const claims = claimAnnotations.filter((c) => c.blockIndex === blockIndex)

    if (anns.length === 0 && claims.length === 0) {
      return {
        _type: 'block',
        _key: blockKey,
        style,
        markDefs: [],
        children: [
          { _type: 'span', _key: `${blockKey}-span-0`, text: row.text, marks: [] },
        ],
      }
    }

    const annMarkDefs: AnnotationMarkDef[] = anns.map((a) => ({
      _type: 'annotation',
      _key: `ann-${a.findingId}`,
      findingId: a.findingId,
      severity: a.severity,
      axis: a.axis,
      reason: a.reason,
      suggestedFix: a.suggestedFix,
      quotedSpan: a.quotedSpan,
    }))
    const claimMarkDefs: ClaimSpanMarkDef[] = claims.map((c) => ({
      _type: 'claimSpan',
      _key: `claim-${c.claimIndex}`,
      claimIndex: c.claimIndex,
      provenance: c.provenance,
      sourceUrl: c.sourceUrl,
      retrievedAt: c.retrievedAt,
      status: c.status,
    }))
    const markDefs: SyntheticMarkDef[] = [...annMarkDefs, ...claimMarkDefs]

    const breakpoints = new Set<number>([0, row.text.length])
    for (const a of anns) {
      breakpoints.add(a.start)
      breakpoints.add(a.end)
    }
    for (const c of claims) {
      breakpoints.add(c.start)
      breakpoints.add(c.end)
    }
    const sorted = Array.from(breakpoints).sort((a, b) => a - b)

    const children: PortableTextSpan[] = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const s = sorted[i] as number
      const e = sorted[i + 1] as number
      if (s >= e) continue
      const text = row.text.slice(s, e)
      if (text.length === 0) continue
      const annMarks = anns
        .map((a, idx) => ({ key: (annMarkDefs[idx] as AnnotationMarkDef)._key, covers: a.start <= s && a.end >= e }))
        .filter((m) => m.covers)
        .map((m) => m.key)
      const claimMarks = claims
        .map((c, idx) => ({ key: (claimMarkDefs[idx] as ClaimSpanMarkDef)._key, covers: c.start <= s && c.end >= e }))
        .filter((m) => m.covers)
        .map((m) => m.key)
      children.push({
        _type: 'span',
        _key: `${blockKey}-span-${i}`,
        text,
        marks: [...annMarks, ...claimMarks],
      })
    }

    return { _type: 'block', _key: blockKey, style, markDefs, children }
  })
}
