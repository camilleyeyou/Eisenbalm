/**
 * DEL-01 / DEL-05 — DeliberationSlot no-subscriptions source-scan.
 *
 * Phase 29 (D-8) UPDATE: DeliberationSlot.tsx no longer opens any Convex
 * useQuery subscriptions. It previously wired 5 `api.*.byRunId` queries
 * per visitor on the highest-traffic page and discarded every result
 * (`void run; void pitchLog; ...`) — the rendered deliberation has always
 * come from Sanity props via IssueLayout.tsx. This file's contract is now
 * the INVERSE of the original DEL-01: assert the subscriptions and their
 * imports are gone, not that they're wired.
 *
 * DEL-05 (empty-state copy) is unaffected by the removal and is preserved
 * here verbatim.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')

describe('D-8: DeliberationSlot opens zero Convex subscriptions', () => {
  const source = readFileSync(PATH, 'utf-8')

  it('is a Client Component ("use client" directive present)', () => {
    expect(source).toContain("'use client'")
  })

  it('does not use the Convex useQuery subscription hook', () => {
    expect(source).not.toContain('useQuery')
  })

  it('does not import convex/react', () => {
    expect(source).not.toContain("from 'convex/react'")
  })

  it('does not import the generated Convex api object', () => {
    expect(source).not.toContain('@convex/_generated/api')
  })

  it('does not reference any api.*.byRunId subscription', () => {
    expect(source).not.toContain('api.pitchLog.byRunId')
    expect(source).not.toContain('api.deliberationEvents.byRunId')
    expect(source).not.toContain('api.agentVotes.byRunId')
    expect(source).not.toContain('api.qaCorrections.byRunId')
    expect(source).not.toContain('api.pipelineRuns.byRunId')
  })

  it('renders the deliberation from Sanity-sourced props (conversation, candidates)', () => {
    expect(source).toMatch(/conversation:\s*ConversationTurn\[\]\s*\|\s*null/)
    expect(source).toContain('candidates: DelibCandidate[] | null')
  })

  it('contains empty-state copy for issues predating the deliberation record (DEL-05)', () => {
    expect(source).toContain('This issue predates the open deliberation record.')
  })
})
