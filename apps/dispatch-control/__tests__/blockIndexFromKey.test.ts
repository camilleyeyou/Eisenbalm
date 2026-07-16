/**
 * Phase 45 Plan 45-01 Task 2 (REV-01) — `blockIndexFromKey` pure helper.
 */
import { describe, it, expect } from 'vitest'
import { blockIndexFromKey } from '../lib/blockIndexFromKey'

describe('blockIndexFromKey', () => {
  it('parses a founderBio row key', () => {
    expect(blockIndexFromKey('row-founderBio-2')).toBe(2)
  })

  it('parses a zero-index originStory row key', () => {
    expect(blockIndexFromKey('row-originStory-0')).toBe(0)
  })

  it('parses a multi-digit problemStatement row key', () => {
    expect(blockIndexFromKey('row-problemStatement-11')).toBe(11)
  })

  it('returns null for a non-row key (claim key)', () => {
    expect(blockIndexFromKey('claim-3')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(blockIndexFromKey('')).toBeNull()
  })

  it('returns null for a non-numeric tail', () => {
    expect(blockIndexFromKey('row-founderBio-x')).toBeNull()
  })
})
