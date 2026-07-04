/**
 * Phase 27 — Money + Notifications: Wave 0 RED scaffold (D-13).
 *
 * Covers the model_pricing staleness boundary specified in
 * docs/API_CONTRACTS.md §27 close + CONTEXT D-13: the finance view renders
 * `model_pricing` read-only ("Projection pricing (not actual cost)") with a
 * staleness badge when a row's `updatedAt` is older than 30 days.
 *
 *   - isStale(updatedAt, now): false at exactly 30 days, false when < 30 days,
 *     true when > 30 days. Threshold = 30 * 24 * 60 * 60 * 1000 ms.
 *
 * RED-by-design: `isStale` does NOT exist yet. This import path IS the contract
 * the Wave 2 finance plan implements (`apps/web/lib/finance/staleness.ts`).
 * Until then this file is RED — correct Wave 0 behavior. If it fails, implement
 * the helper; do NOT weaken it.
 *
 * Requirements covered: D-13 (30-day staleness boundary).
 */
import { describe, it, expect } from 'vitest'

import { isStale } from '@/lib/finance/staleness'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const NOW = 1_800_000_000_000 // fixed reference instant (Unix ms)

describe('D-13: model_pricing staleness boundary (30 days)', () => {
  it('is NOT stale when updatedAt is exactly 30 days ago (boundary inclusive)', () => {
    expect(isStale(NOW - THIRTY_DAYS_MS, NOW)).toBe(false)
  })

  it('is NOT stale when updatedAt is less than 30 days ago', () => {
    expect(isStale(NOW - (THIRTY_DAYS_MS - 1), NOW)).toBe(false)
  })

  it('is stale when updatedAt is more than 30 days ago (one ms over the threshold)', () => {
    expect(isStale(NOW - (THIRTY_DAYS_MS + 1), NOW)).toBe(true)
  })

  it('is stale for a clearly old row (60 days)', () => {
    expect(isStale(NOW - 2 * THIRTY_DAYS_MS, NOW)).toBe(true)
  })

  it('is NOT stale for a row just written (updatedAt === now)', () => {
    expect(isStale(NOW, NOW)).toBe(false)
  })
})
