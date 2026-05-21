/**
 * DEL-01 / DEL-05 — DeliberationSlot Convex subscriptions source-scan.
 *
 * UNSKIP in Plan 09-02 when DeliberationSlot.tsx gets its Phase 9 Convex
 * implementation. The describe.skip keeps this suite green at scaffold time.
 *
 * Asserted behaviors (against DeliberationSlot.tsx source):
 *   DEL-01: All five Convex useQuery subscriptions are wired.
 *   DEL-01: runId null-safety — `"skip"` sentinel guards all queries.
 *   DEL-05: Empty-state copy rendered when no Convex data.
 *
 * readFileSync is INSIDE the describe.skip callback so collection never
 * throws against the current Phase 2 stub which lacks these patterns.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')

// UNSKIP in Plan 09-02
describe.skip('DEL-01/DEL-05: DeliberationSlot Convex subscriptions', () => {
  const source = readFileSync(PATH, 'utf-8')

  it('is a Client Component ("use client" directive present)', () => {
    expect(source).toContain("'use client'")
  })

  it('uses the Convex useQuery subscription hook', () => {
    expect(source).toContain('useQuery')
  })

  it('applies the "skip" sentinel when runId is null (null-runId guard)', () => {
    // Pattern: runId ? { runId } : 'skip'  (or double-quoted 'skip')
    expect(source).toMatch(/runId\s*\?\s*\{\s*runId\s*\}\s*:\s*['"]skip['"]/)
  })

  it('references api.pitchLog.byRunId', () => {
    expect(source).toContain('api.pitchLog.byRunId')
  })

  it('references api.deliberationEvents.byRunId', () => {
    expect(source).toContain('api.deliberationEvents.byRunId')
  })

  it('references api.agentVotes.byRunId', () => {
    expect(source).toContain('api.agentVotes.byRunId')
  })

  it('references api.qaCorrections.byRunId', () => {
    expect(source).toContain('api.qaCorrections.byRunId')
  })

  it('references api.pipelineRuns.byRunId', () => {
    expect(source).toContain('api.pipelineRuns.byRunId')
  })

  it('contains empty-state copy for issues predating the deliberation record (DEL-05)', () => {
    expect(source).toContain('This issue predates the open deliberation record.')
  })
})
