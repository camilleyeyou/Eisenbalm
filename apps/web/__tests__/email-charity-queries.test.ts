import { describe, it, expect } from 'vitest'
import {
  buildFundedCharityQuery,
  buildOtherCharitiesQuery,
  buildFundedSinceCountQuery,
  orderMsToIsoDate,
} from '@eisenbalm/emails'

describe('buildFundedCharityQuery', () => {
  it('returns null when charitySlug is undefined', () => {
    expect(buildFundedCharityQuery(undefined)).toBeNull()
  })

  it('returns null when charitySlug is null', () => {
    expect(buildFundedCharityQuery(null as unknown as undefined)).toBeNull()
  })

  it('returns null when charitySlug is empty string', () => {
    expect(buildFundedCharityQuery('')).toBeNull()
  })

  it('contains _type == "charity"', () => {
    const q = buildFundedCharityQuery('nap-ministry')
    expect(q).toContain('_type == "charity"')
  })

  it('contains slug.current == "nap-ministry"', () => {
    const q = buildFundedCharityQuery('nap-ministry')
    expect(q).toContain('slug.current == "nap-ministry"')
  })

  it('contains name, location, focusArea, missionStatement fields', () => {
    const q = buildFundedCharityQuery('nap-ministry')
    expect(q).toContain('name')
    expect(q).toContain('location')
    expect(q).toContain('focusArea')
    expect(q).toContain('missionStatement')
  })

  it('strips double-quotes from an injected slug to prevent query injection', () => {
    const q = buildFundedCharityQuery('slug"with"quotes')
    expect(q).not.toContain('"with"')
  })
})

describe('buildOtherCharitiesQuery', () => {
  it('excludes buyer\'s own slug (!= "nap-ministry")', () => {
    const q = buildOtherCharitiesQuery('nap-ministry')
    expect(q).toContain('!= "nap-ministry"')
  })

  it('contains _type == "weeklyIssue"', () => {
    const q = buildOtherCharitiesQuery('nap-ministry')
    expect(q).toContain('_type == "weeklyIssue"')
  })

  it('contains status == "published"', () => {
    const q = buildOtherCharitiesQuery('nap-ministry')
    expect(q).toContain('status == "published"')
  })

  it('orders by issueNumber desc', () => {
    const q = buildOtherCharitiesQuery('nap-ministry')
    expect(q).toContain('issueNumber desc')
  })

  it('limits to 3 results [0...3]', () => {
    const q = buildOtherCharitiesQuery('nap-ministry')
    expect(q).toContain('[0...3]')
  })

  it('includes charity reference with slug field', () => {
    const q = buildOtherCharitiesQuery('nap-ministry')
    expect(q).toContain('charity->')
    expect(q).toContain('slug')
  })

  it('works when charitySlug is undefined (defaults to empty exclusion)', () => {
    const q = buildOtherCharitiesQuery(undefined)
    expect(q).toContain('_type == "weeklyIssue"')
  })
})

describe('buildFundedSinceCountQuery', () => {
  it('contains count(', () => {
    const q = buildFundedSinceCountQuery('2026-06-01')
    expect(q).toContain('count(')
  })

  it('contains publishDate > "2026-06-01"', () => {
    const q = buildFundedSinceCountQuery('2026-06-01')
    expect(q).toContain('publishDate > "2026-06-01"')
  })

  it('contains _type == "weeklyIssue"', () => {
    const q = buildFundedSinceCountQuery('2026-06-01')
    expect(q).toContain('_type == "weeklyIssue"')
  })

  it('contains status == "published"', () => {
    const q = buildFundedSinceCountQuery('2026-06-01')
    expect(q).toContain('status == "published"')
  })

  it('strips double-quotes from injected date', () => {
    const q = buildFundedSinceCountQuery('2026-06-01"injected')
    expect(q).not.toContain('"injected')
  })
})

describe('orderMsToIsoDate', () => {
  it('returns 1970-01-01 for epoch 0', () => {
    expect(orderMsToIsoDate(0)).toBe('1970-01-01')
  })

  it('returns a YYYY-MM-DD date string', () => {
    // 2026-06-05 in ms (approximate)
    const result = orderMsToIsoDate(1749081600000)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns exactly 10 characters', () => {
    expect(orderMsToIsoDate(0).length).toBe(10)
  })
})
