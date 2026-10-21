/**
 * Phase 40 Plan 40-01 (§40.7, ISS-02) — RED scaffold for the pure
 * issueNumber<->URL resolver. No Convex import, node env.
 *
 * Quick 261021-j83 trimmed the resolver to parseIssueNumber + adminRunHref.
 */
import { describe, it, expect } from 'vitest'
import { parseIssueNumber, adminRunHref } from '../lib/issueRouteResolver'

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
