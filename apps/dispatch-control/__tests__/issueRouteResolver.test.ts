/**
 * Phase 40 Plan 40-01 (§40.7, ISS-02) — RED scaffold for the pure
 * issueNumber<->URL resolver. No Convex import, node env.
 *
 * RED until Plan 40-04 implements `apps/dispatch-control/lib/issueRouteResolver.ts`.
 */
import { describe, it, expect } from 'vitest'
import {
  parseIssueNumber,
  issueHref,
  issueReviewHref,
  issueVoiceHref,
  issueRunHref,
  legacyRedirectTarget,
} from '../lib/issueRouteResolver'

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

describe('href builders (§40.7)', () => {
  it('issueHref builds /issues/{n}', () => {
    expect(issueHref(7)).toBe('/issues/7')
  })

  it('issueReviewHref builds /issues/{n}/review', () => {
    expect(issueReviewHref(7)).toBe('/issues/7/review')
  })

  it('issueVoiceHref builds /issues/{n}/voice', () => {
    expect(issueVoiceHref(7)).toBe('/issues/7/voice')
  })

  it('issueRunHref URL-encodes the runId segment', () => {
    expect(issueRunHref(7, 'a b/c')).toBe('/issues/7/runs/a%20b%2Fc')
  })
})

describe('legacyRedirectTarget (§40.7)', () => {
  it('resolves to the issue-keyed review/voice URL when issueNumber is known', () => {
    expect(legacyRedirectTarget('review', 7)).toBe('/issues/7/review')
    expect(legacyRedirectTarget('voice', 7)).toBe('/issues/7/voice')
  })

  it('falls back to /issues (never a run-keyed URL) when issueNumber is null or undefined', () => {
    const withNull = legacyRedirectTarget('review', null)
    const withUndefined = legacyRedirectTarget('review', undefined)
    expect(withNull).toBe('/issues')
    expect(withUndefined).toBe('/issues')
    expect(withNull).not.toContain('review-desk')
    expect(withUndefined).not.toContain('review-desk')
  })
})
