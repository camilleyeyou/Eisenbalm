/**
 * Phase 35 (PRV-03, Plan 35-05 Wave 0 RED) — claim-provenance galley wash tests.
 *
 * Two things this file locks down:
 *   1. Mark stacking: `toSyntheticBlocks` must be able to carry a
 *      `claimSpan` mark ALONGSIDE an existing `annotation` mark on the same
 *      span (D-09 -- underline-over-wash, never a collision).
 *   2. The claim-resolution mapping Galley.tsx performs: `claim_checks` rows
 *      are mapped into the SAME `QaFinding` shape the QA resolver already
 *      accepts (quotedSpan = row.text, blockIndexHint = row.blockIndexHint),
 *      resolved via the existing `resolveSectionFindings` (never a new
 *      fuzzy matcher), then re-hydrated with the claim's provenance fields
 *      (claimId presence => sourced, absence => unsourced) plus a
 *      legacy-row-safety guarantee: a row with no blockIndexHint/sectionName
 *      never throws -- it resolves when the text is unique in the section,
 *      or is silently dropped (unresolved) otherwise -- never a guess.
 *
 * RED at authoring time: `toSyntheticBlocks`'s `claimAnnotations` param and
 * `ClaimSpanMarkDef`/`ResolvedClaim` do not exist yet. Turns GREEN in Task 2.
 *
 * Phase 42 (FCT-04, Plan 42-07 Task 1) extends `ResolvedClaim`/`ClaimSpanMarkDef`
 * with `text`/`importance`/`context` (mirroring the provenance fields above)
 * so the shared `ClaimProvenanceCard` reused by `ClaimMark` never renders
 * blank. The `resolveClaims` fixture helper below is updated to thread them
 * exactly like `Galley.tsx::resolveClaimsFor` now does.
 */
import { describe, it, expect } from 'vitest'
import { toSyntheticBlocks, type ResolvedClaim } from '../lib/galley/syntheticPortableText'
import { resolveSectionFindings, type QaFinding } from '../lib/galley/spanResolver'

/** Mirrors a live `claim_checks` row (Phase 35 additive fields + Phase 42 importance/context). */
interface ClaimCheckRowFixture {
  claimIndex: number
  text: string
  status: string
  claimId?: string
  sourceUrl?: string
  retrievedAt?: number
  sectionName?: string
  blockIndexHint?: number
  importance?: 'Load-bearing' | 'Supporting' | 'Incidental'
  context?: string
}

/**
 * The exact mapping Galley.tsx performs (Task 3): claim_checks row ->
 * ResolvedClaim, reusing the existing `resolveSectionFindings` -- never a
 * new matcher.
 */
function resolveClaims(
  blocks: Array<{ type: string; text: string }>,
  rows: ClaimCheckRowFixture[],
  sectionId: string,
): ResolvedClaim[] {
  const claimFindings: QaFinding[] = rows.map((row) => ({
    _id: String(row.claimIndex),
    severity: 'info',
    reason: '',
    quotedSpan: row.text,
    blockIndexHint: row.blockIndexHint,
  }))
  const { resolved } = resolveSectionFindings(blocks, claimFindings, sectionId)
  return resolved.map((r) => {
    const row = rows.find((cr) => String(cr.claimIndex) === r.findingId)
    return {
      claimIndex: row ? row.claimIndex : Number(r.findingId),
      sectionId,
      blockIndex: r.blockIndex,
      start: r.start,
      end: r.end,
      provenance: row?.claimId ? 'sourced' : 'unsourced',
      sourceUrl: row?.sourceUrl,
      retrievedAt: row?.retrievedAt,
      status: row?.status ?? 'pending',
      // Phase 42 (FCT-04) -- threaded exactly like Galley.tsx::resolveClaimsFor.
      text: row?.text ?? '',
      importance: row?.importance,
      context: row?.context,
    }
  })
}

describe('claim-resolution mapping', () => {
  const SECTION_ID = 'originStory'
  const blocks = [{ type: 'paragraph', text: 'The founder started in a garage in 1974.' }]

  it('a claimId-bearing row resolves to provenance "sourced"', () => {
    const rows: ClaimCheckRowFixture[] = [
      {
        claimIndex: 0,
        text: 'in a garage',
        status: 'pending',
        claimId: 'c-0',
        sourceUrl: 'https://example.com/history',
        retrievedAt: 1700000000000,
        sectionName: SECTION_ID,
        blockIndexHint: 0,
        importance: 'Load-bearing',
        context: 'The founder started in a garage in 1974.',
      },
    ]

    const resolved = resolveClaims(blocks, rows, SECTION_ID)

    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.provenance).toBe('sourced')
    expect(resolved[0]?.sourceUrl).toBe('https://example.com/history')
    expect(resolved[0]?.claimIndex).toBe(0)
    // Phase 42 (FCT-04) -- the fields the shared ClaimProvenanceCard needs
    // reach the resolved claim, never blank.
    expect(resolved[0]?.text).toBe('in a garage')
    expect(resolved[0]?.importance).toBe('Load-bearing')
    expect(resolved[0]?.context).toBe('The founder started in a garage in 1974.')
  })

  it('a claimId-absent row resolves to provenance "unsourced"', () => {
    const rows: ClaimCheckRowFixture[] = [
      { claimIndex: 1, text: '1974', status: 'pending', sectionName: SECTION_ID, blockIndexHint: 0 },
    ]

    const resolved = resolveClaims(blocks, rows, SECTION_ID)

    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.provenance).toBe('unsourced')
    expect(resolved[0]?.sourceUrl).toBeUndefined()
  })

  it('a legacy row with no blockIndexHint/sectionName never throws -- it resolves when the text is unique', () => {
    const rows: ClaimCheckRowFixture[] = [{ claimIndex: 2, text: 'garage', status: 'pending' }]

    expect(() => resolveClaims(blocks, rows, SECTION_ID)).not.toThrow()
    const resolved = resolveClaims(blocks, rows, SECTION_ID)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.provenance).toBe('unsourced')
  })

  it('a legacy row whose text cannot be found anywhere resolves to zero entries (dropped, never a guess)', () => {
    const rows: ClaimCheckRowFixture[] = [
      { claimIndex: 3, text: 'a phrase that does not appear anywhere', status: 'pending' },
    ]

    expect(() => resolveClaims(blocks, rows, SECTION_ID)).not.toThrow()
    expect(resolveClaims(blocks, rows, SECTION_ID)).toHaveLength(0)
  })
})

describe('toSyntheticBlocks -- claimSpan mark stacking', () => {
  it('a span covered by both a QA annotation and a sourced claim carries BOTH mark keys', () => {
    const text = 'The founder started in a garage in 1974.'
    const rows = [{ type: 'paragraph', text }]

    const annStart = text.indexOf('started in a garage')
    const annEnd = annStart + 'started in a garage'.length
    const annotations = [
      {
        findingId: 'qa-1',
        blockIndex: 0,
        start: annStart,
        end: annEnd,
        severity: 'warning' as const,
        reason: 'tonal drift',
      },
    ]

    const claimStart = text.indexOf('in a garage')
    const claimEnd = claimStart + 'in a garage'.length
    const claims: ResolvedClaim[] = [
      {
        claimIndex: 0,
        sectionId: 'originStory',
        blockIndex: 0,
        start: claimStart,
        end: claimEnd,
        provenance: 'sourced',
        sourceUrl: 'https://example.com',
        retrievedAt: 1700000000000,
        status: 'pending',
        text: 'in a garage',
        importance: 'Load-bearing',
        context: text,
      },
    ]

    const blocks = toSyntheticBlocks(rows, annotations, 'originStory', claims)
    const block = blocks[0]
    if (!block) throw new Error('expected a synthesized block')

    expect(block.markDefs.some((m) => m._type === 'claimSpan')).toBe(true)
    expect(block.markDefs.some((m) => m._type === 'annotation')).toBe(true)

    // Reassembling all span texts in order must still reproduce the original text.
    expect(block.children.map((c) => c.text).join('')).toBe(text)

    // The overlap region ("in a garage") must carry both mark keys.
    const overlapSpan = block.children.find((c) => c.text === 'in a garage')
    expect(overlapSpan).toBeDefined()
    const overlapMarkTypes = overlapSpan!.marks.map(
      (key) => block.markDefs.find((m) => m._key === key)?._type,
    )
    expect(overlapMarkTypes).toContain('annotation')
    expect(overlapMarkTypes).toContain('claimSpan')

    // Phase 42 (FCT-04) -- text/importance/context/sectionId are copied onto
    // the claimSpan markDef, not dropped, so ClaimMark can feed the shared card.
    const claimMarkDef = block.markDefs.find((m) => m._type === 'claimSpan') as {
      text: string
      importance?: string
      context?: string
      sectionId?: string
    }
    expect(claimMarkDef.text).toBe('in a garage')
    expect(claimMarkDef.importance).toBe('Load-bearing')
    expect(claimMarkDef.context).toBe(text)
    expect(claimMarkDef.sectionId).toBe('originStory')
  })

  it('an unsourced claim carries markDef.provenance === "unsourced"', () => {
    const text = 'Funding dried up after the regional bank closed.'
    const rows = [{ type: 'paragraph', text }]
    const start = text.indexOf('the regional bank closed')
    const end = start + 'the regional bank closed'.length
    const claims: ResolvedClaim[] = [
      {
        claimIndex: 5,
        blockIndex: 0,
        start,
        end,
        provenance: 'unsourced',
        status: 'pending',
        text: 'the regional bank closed',
      },
    ]

    const blocks = toSyntheticBlocks(rows, [], 'problemStatement', claims)
    const markDef = blocks[0]?.markDefs.find((m) => m._type === 'claimSpan')
    expect(markDef).toBeDefined()
    expect((markDef as { provenance: string }).provenance).toBe('unsourced')
  })

  it('claimAnnotations defaults to empty -- existing annotation-only behavior is byte-identical', () => {
    const rows = [{ type: 'paragraph', text: 'No claims here.' }]
    const withDefault = toSyntheticBlocks(rows, [])
    const withExplicitEmpty = toSyntheticBlocks(rows, [], 'section', [])
    expect(withDefault).toEqual(withExplicitEmpty)
  })
})
