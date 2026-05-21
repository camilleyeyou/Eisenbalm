/**
 * DEL-02 — QA severity → color token mapping source-scan.
 *
 * UNSKIP in Plan 09-02 when DeliberationSlot.tsx gets its Phase 9 implementation.
 * The describe.skip keeps this suite green at scaffold time.
 *
 * Asserted behaviors (against DeliberationSlot.tsx source):
 *   DEL-02: All three schema severities (info / warning / error) are mapped.
 *           Source: convex/schema.ts qaCorrections.severity union.
 *   DEL-02: Each severity maps to a CSS token (no hardcoded hex).
 *   DEL-02: Text labels are always rendered (no color-only WCAG signal).
 *   DEL-02: Legacy severity names (minor / moderate / major) from the stale
 *           API_CONTRACTS §3.6 are NOT present — guard against drift.
 *
 * readFileSync is INSIDE the describe.skip callback so collection never
 * throws against the current Phase 2 stub which lacks these patterns.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')

describe('DEL-02: QA severity color map', () => {
  const source = readFileSync(PATH, 'utf-8')

  // ─── Schema severity values (info / warning / error) ────────────────────────

  it('maps severity "info"', () => {
    expect(source).toContain("'info'")
  })

  it('maps severity "warning"', () => {
    expect(source).toContain("'warning'")
  })

  it('maps severity "error"', () => {
    expect(source).toContain("'error'")
  })

  // ─── CSS variable tokens (no hardcoded hex) ──────────────────────────────────

  it('maps to var(--color-text-dim) token (info severity)', () => {
    expect(source).toContain('var(--color-text-dim)')
  })

  it('maps to var(--color-primary) token (warning severity)', () => {
    expect(source).toContain('var(--color-primary)')
  })

  it('maps to var(--color-accent) token (error severity)', () => {
    expect(source).toContain('var(--color-accent)')
  })

  // ─── Text labels (WCAG: no color-only signal) ────────────────────────────────

  it('renders "Info" text label (not color-only)', () => {
    expect(source).toContain('Info')
  })

  it('renders "Warning" text label (not color-only)', () => {
    expect(source).toContain('Warning')
  })

  it('renders "Error" text label (not color-only)', () => {
    expect(source).toContain('Error')
  })

  // ─── Guard against stale API_CONTRACTS §3.6 legacy severities ────────────────

  it('does NOT contain legacy severity "minor" (stale API_CONTRACTS §3.6 — use schema truth)', () => {
    expect(source).not.toContain('minor')
  })

  it('does NOT contain legacy severity "moderate" (stale API_CONTRACTS §3.6 — use schema truth)', () => {
    expect(source).not.toContain('moderate')
  })

  it('does NOT contain legacy severity "major" (stale API_CONTRACTS §3.6 — use schema truth)', () => {
    expect(source).not.toContain('major')
  })
})
