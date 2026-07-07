/**
 * Phase 32 (GLY-02, Plan 32-01 Wave 0 RED) — span-resolver algorithm tests.
 *
 * Encodes 32-RESEARCH.md's Pattern 2 (per-block, per-section quotedSpan
 * resolution — never whole-section concatenation) and CONTEXT.md's
 * D-11/D-12/D-13/Pitfall-3/Pitfall-5 rules:
 *   - blockIndexHint disambiguates but is never authoritative (D-11)
 *   - ambiguous match (with or without a disambiguating hint) -> unresolved,
 *     never a guess (D-12)
 *   - normalization fallback (curly quotes / whitespace) is narrow: exact
 *     match first, then a single normalized pass, never fuzzy (Pitfall 5) —
 *     and offsets MUST still index the ORIGINAL (un-normalized) block text
 *   - a quotedSpan that only exists when blocks are joined together must
 *     never falsely resolve (cross-block ambiguity is impossible by design
 *     because the resolver searches one block at a time)
 *
 * RED at authoring time: `../lib/galley/spanResolver` does not exist yet.
 * Turns GREEN in Plan 32-04.
 */
import { describe, it, expect } from 'vitest'
import { resolveSectionFindings } from '../lib/galley/spanResolver'

/** Mirrors the shape produced by `qaSectionToGalleyId`-mapped Convex qaCorrections rows. */
interface FindingFixture {
  _id: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
  blockIndexHint?: number
  accepted: boolean
}

/** Narrow, deterministic normalization matching CONTEXT's own suggested fallback
 * (Pitfall 5): curly quotes -> straight, whitespace collapse. Used ONLY to
 * assert the resolver's offsets slice the ORIGINAL text correctly — this is
 * a test-side helper, not an import of the implementation's internals. */
function normalize(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function finding(overrides: Partial<FindingFixture> & Pick<FindingFixture, '_id'>): FindingFixture {
  return {
    severity: 'warning',
    reason: 'default reason',
    accepted: false,
    ...overrides,
  }
}

describe('resolveSectionFindings', () => {
  const SECTION_ID = 'originStory'

  it('(a) exact single match resolves with correct blockIndex + start + end', () => {
    const blocks = [{ type: 'paragraph', text: 'The facility opened its doors in 1974.' }]
    const findings = [finding({ _id: 'f1', quotedSpan: 'opened its doors', reason: 'vague date' })]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(unresolved).toHaveLength(0)
    expect(resolved).toHaveLength(1)
    const r = resolved[0]
    expect(r.blockIndex).toBe(0)
    expect(blocks[0].text.slice(r.start, r.end)).toBe('opened its doors')
  })

  it('(a) resolved objects carry severity/axis/reason/suggestedFix/quotedSpan/findingId/sectionId', () => {
    const blocks = [{ type: 'paragraph', text: 'The facility opened its doors in 1974.' }]
    const findings = [
      finding({
        _id: 'f1',
        quotedSpan: 'opened its doors',
        severity: 'error',
        axis: 'precision',
        reason: 'vague date',
        suggestedFix: 'Specify the exact date.',
      }),
    ]

    const { resolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(resolved).toHaveLength(1)
    const r = resolved[0]
    expect(r.findingId).toBe('f1')
    expect(r.sectionId).toBe(SECTION_ID)
    expect(r.severity).toBe('error')
    expect(r.axis).toBe('precision')
    expect(r.reason).toBe('vague date')
    expect(r.suggestedFix).toBe('Specify the exact date.')
    expect(r.quotedSpan).toBe('opened its doors')
  })

  it('(b) no match anywhere in the section -> 1 unresolved, 0 resolved', () => {
    const blocks = [{ type: 'paragraph', text: 'The facility opened its doors in 1974.' }]
    const findings = [finding({ _id: 'f1', quotedSpan: 'a phrase that never appears' })]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(resolved).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].findingId).toBe('f1')
    expect(unresolved[0].sectionId).toBe(SECTION_ID)
  })

  it('(c) verbatim duplicate phrase across 2 blocks with no hint -> unresolved (D-12, never guess)', () => {
    const blocks = [
      { type: 'paragraph', text: 'Rent at the aging facility tripled that year.' },
      { type: 'paragraph', text: 'Even so, the aging facility kept its doors open.' },
    ]
    const findings = [finding({ _id: 'f1', quotedSpan: 'the aging facility' })]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(resolved).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].findingId).toBe('f1')
  })

  it('(d) match in 2+ blocks, blockIndexHint disambiguates -> resolved to hinted block', () => {
    const blocks = [
      { type: 'paragraph', text: 'Rent at the aging facility tripled that year.' },
      { type: 'paragraph', text: 'Even so, the aging facility kept its doors open.' },
    ]
    const findings = [finding({ _id: 'f1', quotedSpan: 'the aging facility', blockIndexHint: 1 })]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(unresolved).toHaveLength(0)
    expect(resolved).toHaveLength(1)
    expect(resolved[0].blockIndex).toBe(1)
    expect(blocks[1].text.slice(resolved[0].start, resolved[0].end)).toBe('the aging facility')
  })

  it('(e) hint out of range (Pitfall 3) falls through to full search, resolves if unique elsewhere', () => {
    const blocks = [
      { type: 'paragraph', text: 'Founded quietly, with little fanfare.' },
      { type: 'paragraph', text: 'No press release accompanied the launch.' },
      { type: 'paragraph', text: 'The unique phrase appears only here.' },
    ]
    const findings = [
      finding({ _id: 'f1', quotedSpan: 'The unique phrase appears only here.', blockIndexHint: 99 }),
    ]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(unresolved).toHaveLength(0)
    expect(resolved).toHaveLength(1)
    expect(resolved[0].blockIndex).toBe(2)
  })

  it('(f) hint points at a block that does NOT contain the span -> hint ignored, full search runs', () => {
    const blocks = [
      { type: 'paragraph', text: 'Founded quietly, with little fanfare.' },
      { type: 'paragraph', text: 'No press release accompanied the launch.' },
      { type: 'paragraph', text: 'The unique phrase appears only here.' },
    ]
    const findings = [
      finding({ _id: 'f1', quotedSpan: 'The unique phrase appears only here.', blockIndexHint: 0 }),
    ]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(unresolved).toHaveLength(0)
    expect(resolved).toHaveLength(1)
    expect(resolved[0].blockIndex).toBe(2)
  })

  it('(g) normalization: curly quotes + whitespace difference still resolves, offsets index ORIGINAL text', () => {
    // Block has straight quotes and a DOUBLE space between "hello" and "world".
    const blocks = [{ type: 'paragraph', text: 'She whispered "hello  world" and left.' }]
    // quotedSpan (as QA emitted it) has curly quotes and a SINGLE space.
    const findings = [finding({ _id: 'f1', quotedSpan: '“hello world”' })]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(unresolved).toHaveLength(0)
    expect(resolved).toHaveLength(1)
    const r = resolved[0]
    expect(r.blockIndex).toBe(0)
    // The offsets must index the ORIGINAL (un-normalized, double-spaced,
    // straight-quoted) block text -- naive reuse of a normalized-string
    // index would slice the wrong substring here.
    const rawSlice = blocks[0].text.slice(r.start, r.end)
    expect(normalize(rawSlice)).toBe(normalize('“hello world”'))
    // And the raw slice itself must be the actual original substring, not
    // the normalized string re-inserted in place of the original text.
    expect(rawSlice).toBe('"hello  world"')
  })

  it('(h) still ambiguous after normalization -> unresolved', () => {
    const blocks = [
      { type: 'paragraph', text: 'The board said “we regret this” at the hearing.' },
      { type: 'paragraph', text: 'Later, staff repeated: "we regret this" to the press.' },
    ]
    const findings = [finding({ _id: 'f1', quotedSpan: '“we  regret this”' })]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(resolved).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].findingId).toBe('f1')
  })

  it('(i) cross-block span (only exists when blocks are joined) never falsely resolves', () => {
    const blocks = [
      { type: 'paragraph', text: 'The founder arrived at the shelter early' },
      { type: 'paragraph', text: 'every single morning without fail.' },
    ]
    // This phrase only exists if you concatenate block 0's tail + block 1's
    // head with a joining space -- it must NOT match either block alone.
    const findings = [
      finding({ _id: 'f1', quotedSpan: 'shelter early every single morning' }),
    ]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(resolved).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].findingId).toBe('f1')
  })

  it('(D-08) accepted findings are excluded from resolver output entirely', () => {
    const blocks = [{ type: 'paragraph', text: 'The facility opened its doors in 1974.' }]
    const findings = [
      finding({ _id: 'f1', quotedSpan: 'opened its doors', accepted: true }),
    ]

    const { resolved, unresolved } = resolveSectionFindings(blocks, findings, SECTION_ID)

    expect(resolved).toHaveLength(0)
    expect(unresolved).toHaveLength(0)
  })
})
