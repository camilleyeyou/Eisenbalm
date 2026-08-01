/**
 * Phase 51 (READ-04, Plan 51-05 Task 2) -- findingGroups.ts unit tests.
 *
 * Pure function, no jsdom -- runs in the default `node` environment (only
 * `*.test.tsx` gets the jsdom override in vitest.config.ts).
 */
import { describe, it, expect } from 'vitest'
import { groupFindings, groupForFinding, type GroupableFinding } from '@/lib/galley/findingGroups'

describe('groupFindings', () => {
  it('groups two findings sharing axis + byte-identical suggestedFix even when their quoted span differs', () => {
    const rows: Array<GroupableFinding & { quotedSpan?: string }> = [
      { _id: 'a', axis: 'precision', suggestedFix: 'Name the mechanism.', quotedSpan: 'in a garage' },
      { _id: 'b', axis: 'precision', suggestedFix: 'Name the mechanism.', quotedSpan: 'the first winter' },
    ]
    const groups = groupFindings(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.findingIds).toEqual(['a', 'b'])
  })

  it('does NOT group two findings with the same suggestedFix but different axis', () => {
    const rows: GroupableFinding[] = [
      { _id: 'a', axis: 'precision', suggestedFix: 'Name the mechanism.' },
      { _id: 'b', axis: 'gravity', suggestedFix: 'Name the mechanism.' },
    ]
    const groups = groupFindings(rows)
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.findingIds)).toEqual([['a'], ['b']])
  })

  it('a finding with no suggestedFix never groups with anything else', () => {
    const rows: GroupableFinding[] = [
      { _id: 'a', axis: 'precision', suggestedFix: 'Name the mechanism.' },
      { _id: 'b', axis: 'precision' },
      { _id: 'c', axis: 'precision' },
    ]
    const groups = groupFindings(rows)
    expect(groups).toHaveLength(3)
    expect(groups.find((g) => g.findingIds.includes('b'))!.findingIds).toEqual(['b'])
    expect(groups.find((g) => g.findingIds.includes('c'))!.findingIds).toEqual(['c'])
  })

  it('suggestedFix differing only by a trailing space does NOT group (byte-identical means byte-identical)', () => {
    const rows: GroupableFinding[] = [
      { _id: 'a', axis: 'precision', suggestedFix: 'Name the mechanism.' },
      { _id: 'b', axis: 'precision', suggestedFix: 'Name the mechanism. ' },
    ]
    const groups = groupFindings(rows)
    expect(groups).toHaveLength(2)
  })

  it('returns [] for empty input', () => {
    expect(groupFindings([])).toEqual([])
  })

  it('preserves input order within a group and returns groups in first-appearance order', () => {
    const rows: GroupableFinding[] = [
      { _id: 'x', axis: 'gravity', suggestedFix: 'Say it plainly.' },
      { _id: 'a', axis: 'precision', suggestedFix: 'Name the mechanism.' },
      { _id: 'b', axis: 'precision', suggestedFix: 'Name the mechanism.' },
    ]
    const groups = groupFindings(rows)
    expect(groups.map((g) => g.findingIds)).toEqual([['x'], ['a', 'b']])
  })

  it('has no notion of "section" -- scoping is the caller\'s responsibility', () => {
    // Two rows with identical axis+fix but conceptually from different
    // sections still group here; the caller is expected to have already
    // filtered `rows` down to one section before calling this.
    const rows: GroupableFinding[] = [
      { _id: 'from-section-a', axis: 'precision', suggestedFix: 'Name the mechanism.' },
      { _id: 'from-section-b', axis: 'precision', suggestedFix: 'Name the mechanism.' },
    ]
    expect(groupFindings(rows)).toHaveLength(1)
  })
})

describe('groupForFinding', () => {
  it('returns the full group (length > 1) for a member of a recurring correction', () => {
    const rows: GroupableFinding[] = [
      { _id: 'a', axis: 'precision', suggestedFix: 'Name the mechanism.' },
      { _id: 'b', axis: 'precision', suggestedFix: 'Name the mechanism.' },
      { _id: 'c', axis: 'precision', suggestedFix: 'Name the mechanism.' },
    ]
    expect(groupForFinding(rows, 'b').findingIds).toEqual(['a', 'b', 'c'])
  })

  it('returns a group of one (findingIds.length === 1) for a lone finding', () => {
    const rows: GroupableFinding[] = [{ _id: 'solo', axis: 'precision', suggestedFix: 'Name the mechanism.' }]
    const group = groupForFinding(rows, 'solo')
    expect(group.findingIds).toEqual(['solo'])
  })

  it('falls back to a synthetic group-of-one for an unknown findingId rather than throwing', () => {
    const group = groupForFinding([], 'missing')
    expect(group.findingIds).toEqual(['missing'])
  })
})
