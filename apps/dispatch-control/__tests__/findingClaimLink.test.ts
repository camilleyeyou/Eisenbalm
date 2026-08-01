/**
 * Phase 51 (READ-03, D-20, Plan 51-07 Task 1) -- findingClaimLink.ts unit tests.
 *
 * Pure function, no jsdom -- runs in the default `node` environment (only
 * `*.test.tsx` gets the jsdom override in vitest.config.ts).
 */
import { describe, it, expect } from 'vitest'
import { claimForFinding, buildFindingClaimMap, type SpanLike } from '@/lib/galley/findingClaimLink'

interface TestClaim extends SpanLike {
  claimIndex: number
  label: string
}

interface TestFinding extends SpanLike {
  findingId: string
}

describe('claimForFinding', () => {
  it('links a finding and a claim in the same block whose character ranges overlap', () => {
    const finding: TestFinding = { findingId: 'f1', blockIndex: 0, start: 5, end: 15 }
    const claim: TestClaim = { claimIndex: 0, label: 'c1', blockIndex: 0, start: 10, end: 20 }
    expect(claimForFinding(finding, [claim])).toBe(claim)
  })

  it('does NOT link a finding and a claim in the same block whose ranges do not overlap', () => {
    const finding: TestFinding = { findingId: 'f1', blockIndex: 0, start: 0, end: 5 }
    const claim: TestClaim = { claimIndex: 0, label: 'c1', blockIndex: 0, start: 5, end: 10 }
    expect(claimForFinding(finding, [claim])).toBeNull()
  })

  it('does NOT link a finding and a claim with equal ranges but different blockIndex', () => {
    const finding: TestFinding = { findingId: 'f1', blockIndex: 0, start: 5, end: 10 }
    const claim: TestClaim = { claimIndex: 0, label: 'c1', blockIndex: 1, start: 5, end: 10 }
    expect(claimForFinding(finding, [claim])).toBeNull()
  })

  it('when two claims overlap, the one with the greater overlap length wins', () => {
    const finding: TestFinding = { findingId: 'f1', blockIndex: 0, start: 0, end: 20 }
    const bigOverlap: TestClaim = { claimIndex: 5, label: 'big', blockIndex: 0, start: 0, end: 10 }
    const smallOverlap: TestClaim = { claimIndex: 2, label: 'small', blockIndex: 0, start: 15, end: 20 }
    expect(claimForFinding(finding, [smallOverlap, bigOverlap])).toBe(bigOverlap)
  })

  it('breaks a tied overlap length on the lower claimIndex, deterministically regardless of input order', () => {
    const finding: TestFinding = { findingId: 'f1', blockIndex: 0, start: 0, end: 20 }
    const higherIndex: TestClaim = { claimIndex: 5, label: 'higher', blockIndex: 0, start: 0, end: 10 }
    const lowerIndex: TestClaim = { claimIndex: 3, label: 'lower', blockIndex: 0, start: 0, end: 10 }
    expect(claimForFinding(finding, [higherIndex, lowerIndex])).toBe(lowerIndex)
    expect(claimForFinding(finding, [lowerIndex, higherIndex])).toBe(lowerIndex)
  })

  it('returns null for a finding with no overlapping claim -- never a nearest-neighbour guess', () => {
    const finding: TestFinding = { findingId: 'f1', blockIndex: 0, start: 0, end: 5 }
    const distantClaim: TestClaim = { claimIndex: 0, label: 'far', blockIndex: 0, start: 100, end: 110 }
    expect(claimForFinding(finding, [distantClaim])).toBeNull()
  })

  it('returns null when the claims array is empty', () => {
    const finding: TestFinding = { findingId: 'f1', blockIndex: 0, start: 0, end: 5 }
    expect(claimForFinding(finding, [])).toBeNull()
  })
})

describe('buildFindingClaimMap', () => {
  it('returns a Map<findingId, claim> containing only findings that actually matched', () => {
    const findings: TestFinding[] = [
      { findingId: 'matched', blockIndex: 0, start: 0, end: 10 },
      { findingId: 'unmatched', blockIndex: 0, start: 100, end: 110 },
    ]
    const claim: TestClaim = { claimIndex: 0, label: 'c1', blockIndex: 0, start: 5, end: 15 }
    const map = buildFindingClaimMap(findings, [claim])
    expect(map.size).toBe(1)
    expect(map.get('matched')).toBe(claim)
    expect(map.has('unmatched')).toBe(false)
  })

  it('returns an empty Map when findings is empty', () => {
    const claim: TestClaim = { claimIndex: 0, label: 'c1', blockIndex: 0, start: 5, end: 15 }
    const map = buildFindingClaimMap([], [claim])
    expect(map.size).toBe(0)
  })

  it('returns an empty Map when no finding overlaps any claim', () => {
    const findings: TestFinding[] = [{ findingId: 'f1', blockIndex: 0, start: 0, end: 5 }]
    const claim: TestClaim = { claimIndex: 0, label: 'c1', blockIndex: 0, start: 100, end: 110 }
    const map = buildFindingClaimMap(findings, [claim])
    expect(map.size).toBe(0)
  })
})
