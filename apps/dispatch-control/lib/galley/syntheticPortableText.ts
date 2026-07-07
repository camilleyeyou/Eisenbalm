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

export interface SyntheticPortableTextBlock {
  _type: 'block'
  _key: string
  style: string
  markDefs: AnnotationMarkDef[]
  children: PortableTextSpan[]
}

/**
 * Convert flat `{type,text}` draft rows plus per-block resolved annotations
 * into synthetic PortableText blocks. `sectionId` disambiguates `_key`
 * values across sections rendered in the same galley.
 */
export function toSyntheticBlocks(
  rows: SyntheticRow[],
  annotations: ResolvedAnnotation[],
  sectionId = 'section'
): SyntheticPortableTextBlock[] {
  return rows.map((row, blockIndex) => {
    const style = row.type === 'paragraph' ? 'normal' : row.type
    const blockKey = `row-${sectionId}-${blockIndex}`
    const anns = annotations.filter((a) => a.blockIndex === blockIndex)

    if (anns.length === 0) {
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

    const markDefs: AnnotationMarkDef[] = anns.map((a) => ({
      _type: 'annotation',
      _key: `ann-${a.findingId}`,
      findingId: a.findingId,
      severity: a.severity,
      axis: a.axis,
      reason: a.reason,
      suggestedFix: a.suggestedFix,
      quotedSpan: a.quotedSpan,
    }))

    const breakpoints = new Set<number>([0, row.text.length])
    for (const a of anns) {
      breakpoints.add(a.start)
      breakpoints.add(a.end)
    }
    const sorted = Array.from(breakpoints).sort((a, b) => a - b)

    const children: PortableTextSpan[] = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const s = sorted[i] as number
      const e = sorted[i + 1] as number
      if (s >= e) continue
      const text = row.text.slice(s, e)
      if (text.length === 0) continue
      const marks = anns
        .map((a, idx) => ({ key: (markDefs[idx] as AnnotationMarkDef)._key, covers: a.start <= s && a.end >= e }))
        .filter((m) => m.covers)
        .map((m) => m.key)
      children.push({ _type: 'span', _key: `${blockKey}-span-${i}`, text, marks })
    }

    return { _type: 'block', _key: blockKey, style, markDefs, children }
  })
}
