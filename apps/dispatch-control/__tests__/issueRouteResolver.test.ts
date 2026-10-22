/**
 * Phase 40 Plan 40-01 (§40.7, ISS-02) — RED scaffold for the pure
 * issueNumber<->URL resolver. No Convex import, node env.
 *
 * Quick 261021-j83 trimmed the resolver to parseIssueNumber + adminRunHref; quick 261022-cr6 adds issueOpenHref + sectionEditHref.
 */
import { describe, it, expect } from 'vitest'
import { parseIssueNumber, adminRunHref, issueOpenHref, sectionEditHref } from '../lib/issueRouteResolver'

describe('parseIssueNumber (§40.7)', () => {
  it('parses a plain positive integer', () => {
    expect(parseIssueNumber('7')).toBe(7)
  })

  it('accepts a leading-zero-padded number (Sanity slug + operator convention)', () => {
    expect(parseIssueNumber('07')).toBe(7)
  })

  it('rejects empty string, non-numeric, negative, decimal, trailing-garbage, and whitespace-padded input', () => {
    for (const input of ['', 'abc', '-1', '1.5', '07x', ' 7 ']) {
      expect(parseIssueNumber(input)).toBeNull()
    }
  })
})

describe('adminRunHref', () => {
  it('builds /admin/runs/{runId}', () => {
    expect(adminRunHref('run_1')).toBe('/admin/runs/run_1')
  })

  it('URL-encodes the runId segment', () => {
    expect(adminRunHref('a/b c')).toBe('/admin/runs/a%2Fb%20c')
  })
})

describe('issueOpenHref / sectionEditHref (quick 261022-cr6)', () => {
  it('opens the front door for the current run', () => {
    expect(issueOpenHref('r1', 'r1')).toBe('/')
  })
  it('pins an earlier run, or an unknown current run', () => {
    expect(issueOpenHref('r1', 'r2')).toBe('/s/originStory?run=r1')
    expect(issueOpenHref('r1', undefined)).toBe('/s/originStory?run=r1')
  })
  it('builds per-section edit links', () => {
    expect(sectionEditHref('founderBio', 'r1', 'r1')).toBe('/s/founderBio')
    expect(sectionEditHref('founderBio', 'r1', 'r2')).toBe('/s/founderBio?run=r1')
    expect(sectionEditHref('founderBio', 'a/b', 'r2')).toBe('/s/founderBio?run=a%2Fb')
  })
})
