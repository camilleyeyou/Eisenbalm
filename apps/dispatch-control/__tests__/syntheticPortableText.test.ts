/**
 * Phase 32 (GLY-01/GLY-02, Plan 32-01 Wave 0 RED) — synthetic-PortableText
 * adapter tests.
 *
 * `GET /issues/{run_id}/draft` does NOT return real Sanity Portable Text —
 * `pt_to_blocks()` flattens every block to a single-joined-string row
 * (`{type, text}`), losing marks/multi-span structure (that's what `lossy`
 * flags; 32-RESEARCH.md §Pitfall 1). This module synthesizes a minimal
 * valid `PortableTextBlock` per flat row and injects one `markDef` per
 * resolved annotation touching that block, splitting `children` at every
 * annotation boundary (32-RESEARCH.md Pattern 1) so `@portabletext/react`'s
 * native mark-component API can render (and stack) severity-colored spans.
 *
 * RED at authoring time: `../lib/galley/syntheticPortableText` does not
 * exist yet. Turns GREEN in Plan 32-04/32-05.
 */
import { describe, it, expect } from 'vitest'
import { toSyntheticBlocks } from '../lib/galley/syntheticPortableText'

interface RowFixture {
  type: string
  text: string
}

interface ResolvedAnnotationFixture {
  findingId: string
  blockIndex: number
  start: number
  end: number
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
}

describe('toSyntheticBlocks — zero-annotation rows', () => {
  it('produces one PT block with style "normal" for a paragraph row with no annotations', () => {
    const rows: RowFixture[] = [{ type: 'paragraph', text: 'The facility opened in 1974.' }]

    const blocks = toSyntheticBlocks(rows, [])

    expect(blocks).toHaveLength(1)
    const block = blocks[0]
    expect(block._type).toBe('block')
    expect(block.style).toBe('normal')
    expect(block.markDefs).toEqual([])
    expect(block.children).toHaveLength(1)
    expect(block.children[0]._type).toBe('span')
    expect(block.children[0].text).toBe('The facility opened in 1974.')
    expect(block.children[0].marks).toEqual([])
  })

  it('maps type "h2" -> style "h2"', () => {
    const rows: RowFixture[] = [{ type: 'h2', text: 'A Quiet Beginning' }]
    const blocks = toSyntheticBlocks(rows, [])
    expect(blocks[0].style).toBe('h2')
  })

  it('maps type "blockquote" -> style "blockquote"', () => {
    const rows: RowFixture[] = [{ type: 'blockquote', text: 'We simply kept showing up.' }]
    const blocks = toSyntheticBlocks(rows, [])
    expect(blocks[0].style).toBe('blockquote')
  })
})

describe('toSyntheticBlocks — single annotation', () => {
  it('splits children at the annotation boundary and injects one annotation markDef', () => {
    const text = 'The facility opened its doors in 1974.'
    const rows: RowFixture[] = [{ type: 'paragraph', text }]
    const start = text.indexOf('opened its doors')
    const end = start + 'opened its doors'.length
    const resolved: ResolvedAnnotationFixture[] = [
      {
        findingId: 'f1',
        blockIndex: 0,
        start,
        end,
        severity: 'error',
        axis: 'precision',
        reason: 'vague date',
        suggestedFix: 'Specify the exact date.',
        quotedSpan: 'opened its doors',
      },
    ]

    const blocks = toSyntheticBlocks(rows, resolved)

    expect(blocks).toHaveLength(1)
    const block = blocks[0]

    // At most 3 spans: before / covered / after.
    expect(block.children.length).toBeLessThanOrEqual(3)
    expect(block.children.length).toBeGreaterThanOrEqual(1)

    // Reassembling the span texts in order must reproduce the original text.
    expect(block.children.map((c: { text: string }) => c.text).join('')).toBe(text)

    // Exactly one markDef, of type 'annotation', carrying the full finding payload.
    expect(block.markDefs).toHaveLength(1)
    const markDef = block.markDefs[0]
    expect(markDef._type).toBe('annotation')
    expect(markDef.findingId).toBe('f1')
    expect(markDef.severity).toBe('error')
    expect(markDef.axis).toBe('precision')
    expect(markDef.reason).toBe('vague date')
    expect(markDef.suggestedFix).toBe('Specify the exact date.')

    // The span covering "opened its doors" must carry the markDef's _key.
    const coveredSpan = block.children.find((c: { text: string }) => c.text === 'opened its doors')
    expect(coveredSpan).toBeDefined()
    expect(coveredSpan.marks).toContain(markDef._key)

    // Spans NOT covering the annotation must carry no marks.
    const uncoveredSpans = block.children.filter((c: { text: string }) => c.text !== 'opened its doors')
    for (const span of uncoveredSpans) {
      expect(span.marks).toEqual([])
    }
  })
})

describe('toSyntheticBlocks — two overlapping annotations', () => {
  it('the overlap-region span carries BOTH markDef keys', () => {
    const text = 'The facility opened its doors quietly in 1974.'
    const rows: RowFixture[] = [{ type: 'paragraph', text }]

    // Annotation A: "opened its doors quietly" (gravity axis)
    const aStart = text.indexOf('opened its doors quietly')
    const aEnd = aStart + 'opened its doors quietly'.length
    // Annotation B: "doors quietly in 1974" (precision axis) -- overlaps A
    // over "doors quietly".
    const bStart = text.indexOf('doors quietly in 1974')
    const bEnd = bStart + 'doors quietly in 1974'.length

    const resolved: ResolvedAnnotationFixture[] = [
      {
        findingId: 'fA',
        blockIndex: 0,
        start: aStart,
        end: aEnd,
        severity: 'warning',
        axis: 'gravity',
        reason: 'tonal drift',
      },
      {
        findingId: 'fB',
        blockIndex: 0,
        start: bStart,
        end: bEnd,
        severity: 'error',
        axis: 'precision',
        reason: 'vague date',
      },
    ]

    const blocks = toSyntheticBlocks(rows, resolved)
    const block = blocks[0]

    expect(block.markDefs).toHaveLength(2)
    const markDefA = block.markDefs.find((m: { findingId: string }) => m.findingId === 'fA')
    const markDefB = block.markDefs.find((m: { findingId: string }) => m.findingId === 'fB')
    expect(markDefA).toBeDefined()
    expect(markDefB).toBeDefined()

    // Reassembling all span texts in order must still reproduce the original text.
    expect(block.children.map((c: { text: string }) => c.text).join('')).toBe(text)

    // The overlap region ("doors quietly") must be its own span carrying
    // BOTH markDef keys.
    const overlapText = text.slice(bStart, aEnd)
    const overlapSpan = block.children.find((c: { text: string }) => c.text === overlapText)
    expect(overlapSpan).toBeDefined()
    expect(overlapSpan.marks).toContain(markDefA._key)
    expect(overlapSpan.marks).toContain(markDefB._key)
  })
})
