/**
 * Phase 45 Plan 45-05 Task 3 (REV-01, D-18) — `firstProseExcerpt` pure
 * helper. Guards the checker-mandated fix: the inspector-footer "Ask agent
 * to revise" entry point must NEVER seed an empty `quotedText` (that 409s
 * `span_not_resolved` the moment a direction chip is picked).
 */
import { describe, it, expect } from 'vitest'
import { firstProseExcerpt } from '../lib/firstProseExcerpt'

describe('firstProseExcerpt', () => {
  it('returns the first sentence of the first non-empty block', () => {
    const excerpt = firstProseExcerpt([
      { text: 'A former county clerk built the registry by hand. It grew from there.' },
    ])
    expect(excerpt).toBe('A former county clerk built the registry by hand.')
  })

  it('skips leading blocks with no text (e.g. a heading with an empty string)', () => {
    const excerpt = firstProseExcerpt([{ text: '' }, { text: 'The founder never gave interviews.' }])
    expect(excerpt).toBe('The founder never gave interviews.')
  })

  it('caps at ~140 characters when no sentence boundary appears within the cap', () => {
    const longRun = 'x'.repeat(200)
    const excerpt = firstProseExcerpt([{ text: longRun }])
    expect(excerpt.length).toBe(140)
    expect(longRun.startsWith(excerpt)).toBe(true)
  })

  it('is a contiguous, unmodified substring of the original text — never rewritten', () => {
    const text = 'The founder anonymized their name; the charity did not.'
    const excerpt = firstProseExcerpt([{ text }])
    expect(text.includes(excerpt)).toBe(true)
  })

  it('returns "" for an empty blocks array (never a placeholder string)', () => {
    expect(firstProseExcerpt([])).toBe('')
  })

  it('returns "" for undefined blocks', () => {
    expect(firstProseExcerpt(undefined)).toBe('')
  })

  it('returns "" when every block is blank (e.g. a non-prose artifact)', () => {
    expect(firstProseExcerpt([{ text: '' }, { text: '   ' }])).toBe('')
  })
})
