/**
 * quick 260730-ldn (Task 1) — pure tests for `lib/issueTitle.ts`. No Convex,
 * no DOM — node environment (default per vitest.config.ts).
 */
import { describe, it, expect } from 'vitest'
import { issueTitleLabel, relativeWeekLabel, NO_TITLE_LABEL } from '../lib/issueTitle'

describe('issueTitleLabel', () => {
  it('returns the title verbatim when present', () => {
    expect(issueTitleLabel('The Kumasi Roofless Schools Audit')).toBe(
      'The Kumasi Roofless Schools Audit',
    )
  })

  it('returns NO_TITLE_LABEL for null (loaded-and-absent)', () => {
    expect(issueTitleLabel(null)).toBe('Not yet chosen')
    expect(issueTitleLabel(null)).toBe(NO_TITLE_LABEL)
  })

  it('returns NO_TITLE_LABEL for undefined (never-loaded, collapses with absent)', () => {
    expect(issueTitleLabel(undefined)).toBe(NO_TITLE_LABEL)
  })

  it('returns NO_TITLE_LABEL for a whitespace-only string', () => {
    expect(issueTitleLabel('   ')).toBe(NO_TITLE_LABEL)
  })
})

describe('relativeWeekLabel', () => {
  const now = Date.UTC(2026, 6, 30, 12, 0, 0)
  const DAY = 24 * 60 * 60 * 1000

  it('renders "This week" at zero elapsed', () => {
    expect(relativeWeekLabel(now, now)).toBe('This week')
  })

  it('renders "Last week" at 8 days elapsed', () => {
    expect(relativeWeekLabel(now - 8 * DAY, now)).toBe('Last week')
  })

  it('renders "2 weeks ago" at 20 days elapsed', () => {
    expect(relativeWeekLabel(now - 20 * DAY, now)).toBe('2 weeks ago')
  })

  it('renders "8 weeks ago" at 60 days elapsed', () => {
    expect(relativeWeekLabel(now - 60 * DAY, now)).toBe('8 weeks ago')
  })

  it('renders "Unknown" for an absent timestamp — never a fabricated date', () => {
    expect(relativeWeekLabel(undefined, now)).toBe('Unknown')
  })

  it('clamps a future timestamp to "This week" — never a negative-week string', () => {
    expect(relativeWeekLabel(now + 3 * DAY, now)).toBe('This week')
  })
})
