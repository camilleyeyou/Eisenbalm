/**
 * Phase 42 Plan 42-06 Task 2 (FCT-03, D-12/D-13) — the 7 Stage 3 claim-table
 * filter predicates.
 */
import { describe, it, expect } from 'vitest'
import {
  FACT_CHECK_FILTERS,
  applyFilters,
  isOrgClaim,
  isWeakSource,
  type FactCheckFilterRow,
} from '../lib/factCheckFilters'

function row(overrides: Partial<FactCheckFilterRow> = {}): FactCheckFilterRow {
  return {
    status: 'pending',
    claimType: 'number',
    text: 'Serves 400 families annually.',
    ...overrides,
  }
}

function findFilter(id: string) {
  const f = FACT_CHECK_FILTERS.find(f => f.id === id)
  if (!f) throw new Error(`filter not registered: ${id}`)
  return f
}

describe('FACT_CHECK_FILTERS — the 7 predicates', () => {
  it('registers exactly 7 filters', () => {
    expect(FACT_CHECK_FILTERS).toHaveLength(7)
  })

  it('must fix: matches an unsourced Load-bearing pending claim', () => {
    const r = row({ importance: 'Load-bearing', sourceUrl: undefined })
    expect(findFilter('must-fix').predicate(r)).toBe(true)
  })

  it('must fix: does not match an unsourced Supporting pending claim', () => {
    const r = row({ importance: 'Supporting', sourceUrl: undefined })
    expect(findFilter('must-fix').predicate(r)).toBe(false)
  })

  it('unchecked: matches any pending row', () => {
    expect(findFilter('unchecked').predicate(row({ status: 'pending' }))).toBe(true)
    expect(findFilter('unchecked').predicate(row({ status: 'checked' }))).toBe(false)
  })

  it('changed: matches only rows with changedSinceCheck === true', () => {
    expect(findFilter('changed').predicate(row({ changedSinceCheck: true }))).toBe(true)
    expect(findFilter('changed').predicate(row({ changedSinceCheck: false }))).toBe(false)
    expect(findFilter('changed').predicate(row({}))).toBe(false)
  })

  it('numbers & dates: matches claimType number or date, not proper_noun', () => {
    expect(findFilter('numbers-dates').predicate(row({ claimType: 'number' }))).toBe(true)
    expect(findFilter('numbers-dates').predicate(row({ claimType: 'date' }))).toBe(true)
    expect(findFilter('numbers-dates').predicate(row({ claimType: 'proper_noun' }))).toBe(false)
  })

  it('people & titles: matches proper_noun claims without an org-suffix', () => {
    const r = row({ claimType: 'proper_noun', text: 'Jane Doe was appointed director.' })
    expect(findFilter('people-titles').predicate(r)).toBe(true)
  })

  it('people & titles: excludes proper_noun claims WITH an org-suffix', () => {
    const r = row({ claimType: 'proper_noun', text: 'The Acme Foundation funded the program.' })
    expect(findFilter('people-titles').predicate(r)).toBe(false)
  })

  it('organization claims: matches proper_noun claims WITH an org-suffix', () => {
    const r = row({ claimType: 'proper_noun', text: 'Acme Trust provided the grant.' })
    expect(findFilter('organization-claims').predicate(r)).toBe(true)
  })

  it('organization claims: excludes proper_noun claims without an org-suffix', () => {
    const r = row({ claimType: 'proper_noun', text: 'Jane Doe was appointed director.' })
    expect(findFilter('organization-claims').predicate(r)).toBe(false)
  })

  it('weak source: matches an unsourced claim', () => {
    expect(findFilter('weak-source').predicate(row({ sourceUrl: undefined }))).toBe(true)
  })

  it('weak source: matches a low-authority-TLD source', () => {
    expect(findFilter('weak-source').predicate(row({ sourceUrl: 'https://example.xyz/a' }))).toBe(
      true,
    )
  })

  it('weak source: does not match a well-formed, non-low-authority source', () => {
    expect(
      findFilter('weak-source').predicate(row({ sourceUrl: 'https://www.postandcourier.com/a' })),
    ).toBe(false)
  })
})

describe('isOrgClaim / isWeakSource (exported pure helpers, D-13)', () => {
  it('isOrgClaim recognizes Foundation and Trust suffixes (acceptance criterion)', () => {
    expect(isOrgClaim({ text: 'The Example Foundation announced funding.' })).toBe(true)
    expect(isOrgClaim({ text: 'The Example Trust announced funding.' })).toBe(true)
    expect(isOrgClaim({ text: 'Jane Doe announced her retirement.' })).toBe(false)
  })

  it('isWeakSource treats an unparsable URL as weak, never throwing', () => {
    expect(() => isWeakSource({ sourceUrl: 'not a url' })).not.toThrow()
    expect(isWeakSource({ sourceUrl: 'not a url' })).toBe(true)
  })
})

describe('applyFilters', () => {
  const rows: FactCheckFilterRow[] = [
    {
      status: 'pending',
      importance: 'Load-bearing',
      claimType: 'number',
      text: 'Demand outpaces supply four to one.',
    },
    {
      status: 'checked',
      importance: 'Supporting',
      claimType: 'proper_noun',
      text: 'Jane Doe founded the program in 1998.',
      sourceUrl: 'https://www.postandcourier.com/a',
    },
    {
      status: 'pending',
      claimType: 'proper_noun',
      text: 'The Acme Foundation matched every donation.',
    },
    {
      status: 'removed',
      importance: 'Load-bearing',
      claimType: 'number',
      text: 'A withdrawn claim.',
    },
  ]

  it('with zero active filters, returns every live (non-removed) row', () => {
    const result = applyFilters(rows, [])
    expect(result).toHaveLength(3)
    expect(result.every(r => r.status !== 'removed')).toBe(true)
  })

  it('always excludes removed rows, even with filters active', () => {
    const result = applyFilters(rows, ['must-fix'])
    expect(result.some(r => r.status === 'removed')).toBe(false)
  })

  it('with one active filter, returns only matching rows', () => {
    const result = applyFilters(rows, ['organization-claims'])
    expect(result).toHaveLength(1)
    expect(result[0]?.text).toBe('The Acme Foundation matched every donation.')
  })

  it('with 2+ active filters, applies an OR-union across them (documented default)', () => {
    // 'must-fix' matches row[0]; 'organization-claims' matches row[2]. Neither
    // alone matches row[1] (checked, sourced, person). The union should
    // return exactly rows 0 and 2, not require both predicates simultaneously.
    const result = applyFilters(rows, ['must-fix', 'organization-claims'])
    expect(result).toHaveLength(2)
    expect(result.map(r => r.text)).toEqual([
      'Demand outpaces supply four to one.',
      'The Acme Foundation matched every donation.',
    ])
  })
})
