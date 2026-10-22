/** Quick 261022-cr6 (client bug 4) — pure run-label helpers. */
import { describe, it, expect } from 'vitest'
import { formatRunLabel, splitStaleRuns } from '../lib/runLabels'

const t = new Date(2026, 10, 2, 12).getTime() // Nov 2

describe('formatRunLabel', () => {
  it('issue + charity + date', () => {
    expect(formatRunLabel({ issueNumber: 12, charityName: 'GRACE', startedAt: t })).toBe('Issue 12 — GRACE · Nov 2')
  })
  it('missing charity', () => {
    expect(formatRunLabel({ issueNumber: 12, charityName: null, startedAt: t })).toBe('Issue 12 · Nov 2')
  })
  it('missing issue', () => {
    expect(formatRunLabel({ startedAt: t })).toBe('Started Nov 2')
  })
})

describe('splitStaleRuns', () => {
  const now = Date.UTC(2026, 9, 22)
  const day = 24 * 60 * 60 * 1000
  const runs = [
    { id: 'a', startedAt: now - 1 * day, status: 'running' },
    { id: 'b', startedAt: now - 20 * day, status: 'awaiting-review' },
    { id: 'c', startedAt: now - 30 * day, status: 'complete' },
    { id: 'd', startedAt: now - 15 * day, status: 'failed' },
  ]
  it('puts old unpublished runs in older, preserving order', () => {
    const { recent, older } = splitStaleRuns(runs, now, 14)
    expect(recent.map(r => r.id)).toEqual(['a', 'c'])
    expect(older.map(r => r.id)).toEqual(['b', 'd'])
  })
})
