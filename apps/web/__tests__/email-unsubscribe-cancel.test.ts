/**
 * Phase 20 Plan 05 — Task 1: shouldCancelOnUnsubscribe pure helper
 *
 * Decision logic: only cancel a send row when it is BOTH
 *   - a marketing step (step >= 4), AND
 *   - still 'scheduled' (not yet sent/cancelled/etc.)
 *
 * Transactional steps (1-3) are NEVER cancelled regardless of status.
 * Non-'scheduled' marketing rows are left untouched.
 */
import { describe, it, expect } from 'vitest'
import { shouldCancelOnUnsubscribe } from '@eisenbalm/emails'

describe('shouldCancelOnUnsubscribe', () => {
  // ── Marketing + scheduled → CANCEL ────────────────────────────────────────

  it('cancels step 4 when scheduled', () => {
    expect(shouldCancelOnUnsubscribe({ step: 4, status: 'scheduled' })).toBe(true)
  })

  it('cancels step 5 when scheduled', () => {
    expect(shouldCancelOnUnsubscribe({ step: 5, status: 'scheduled' })).toBe(true)
  })

  it('cancels step 6 when scheduled', () => {
    expect(shouldCancelOnUnsubscribe({ step: 6, status: 'scheduled' })).toBe(true)
  })

  it('cancels step 7 when scheduled', () => {
    expect(shouldCancelOnUnsubscribe({ step: 7, status: 'scheduled' })).toBe(true)
  })

  it('cancels step 8 when scheduled', () => {
    expect(shouldCancelOnUnsubscribe({ step: 8, status: 'scheduled' })).toBe(true)
  })

  // ── Transactional steps → NEVER cancel ────────────────────────────────────

  it('does NOT cancel step 1 (transactional) even when scheduled', () => {
    expect(shouldCancelOnUnsubscribe({ step: 1, status: 'scheduled' })).toBe(false)
  })

  it('does NOT cancel step 2 (transactional) even when scheduled', () => {
    expect(shouldCancelOnUnsubscribe({ step: 2, status: 'scheduled' })).toBe(false)
  })

  it('does NOT cancel step 3 (transactional) even when scheduled', () => {
    expect(shouldCancelOnUnsubscribe({ step: 3, status: 'scheduled' })).toBe(false)
  })

  // ── Marketing but already sent → leave untouched ──────────────────────────

  it('does NOT cancel step 5 when already sent', () => {
    expect(shouldCancelOnUnsubscribe({ step: 5, status: 'sent' })).toBe(false)
  })

  it('does NOT cancel step 4 when already sent', () => {
    expect(shouldCancelOnUnsubscribe({ step: 4, status: 'sent' })).toBe(false)
  })

  // ── Already cancelled ──────────────────────────────────────────────────────

  it('does NOT cancel step 6 when already cancelled', () => {
    expect(shouldCancelOnUnsubscribe({ step: 6, status: 'cancelled' })).toBe(false)
  })

  // ── Failed / skipped rows → leave untouched ───────────────────────────────

  it('does NOT cancel step 7 when failed', () => {
    expect(shouldCancelOnUnsubscribe({ step: 7, status: 'failed' })).toBe(false)
  })

  it('does NOT cancel step 8 when skipped', () => {
    expect(shouldCancelOnUnsubscribe({ step: 8, status: 'skipped' })).toBe(false)
  })
})
