/**
 * Phase 50 Plan 50-04 (WBN-04, D-13, docs/API_CONTRACTS.md §4A.2c) — the
 * "why this draft exists" origin back-reference.
 *
 * Runs in jsdom (explicit environmentMatchGlobs override in vitest.config.ts
 * — named `.test.ts` per the plan's file list, not `.test.tsx`, mirroring
 * the `registryDoNotUse.test.ts` precedent). Named `.test.ts` => JSX syntax
 * is unavailable, so every render uses `React.createElement` (same
 * precedent).
 *
 * Three things proven here:
 *   1. InspectorFooter's "Improve this agent →" deep link carries
 *      `fromRun`/`section`/`excerpt` query params when a real sectionName +
 *      excerpt are supplied, and degrades to the plain promptHref otherwise
 *      — "Compare instruction versions" is unaffected either way.
 *   2. PromptSaveDialog forwards its `originRef` prop verbatim into the
 *      `promptVersions.saveVersion` mutation call (the "insert" side of the
 *      round trip) — mirrors PromptSaveDialog.test.tsx's convex-mock
 *      pattern.
 *   3. AgentPromptEditorView's exported `OriginBanner` renders "why this
 *      draft exists" from that SAME originRef object (the "read back" side
 *      of the round trip) and renders nothing when no origin is present.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    promptVersions: {
      saveVersion: 'promptVersions:saveVersion',
      listForAgent: 'promptVersions:listForAgent',
    },
  },
}))

// Phase 50 (WBN-03): InspectorFooter's "Restart from this step" now calls
// useAuth() unconditionally (Rules of Hooks) on every render — this file
// renders InspectorFooter directly, so both need mocking even though no
// test here exercises the Restart action's click path (that honesty matrix
// is covered end-to-end by __tests__/InspectorFooter.test.tsx).
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))
vi.mock('@/lib/pipelineControlClient', () => ({
  rerollAgent: vi.fn(async () => ({ runId: 'run-1', agentKey: 'scout', rerolled: true })),
  publishManual: vi.fn(async () => ({
    runId: 'run-1',
    issueId: 'issue-1',
    issueNumber: 1,
    scheduled: true,
  })),
}))

import { useMutation, useQuery } from 'convex/react'
import { InspectorFooter } from '../components/inspector/InspectorFooter'
import { PromptSaveDialog } from '../app/(dashboard)/prompt-lab/_components/PromptSaveDialog'
import { OriginBanner } from '../app/(dashboard)/prompt-lab/_components/AgentPromptEditorView'
import { ConfirmProvider } from '../components/ui/ConfirmDialog'

afterEach(() => {
  cleanup()
})

// quick 260723-4a6 (Task 2): InspectorFooter's "Restart from this step" now
// calls useConfirm() unconditionally — every render needs a ConfirmProvider
// ancestor, even though no test in this file exercises that click path.
function renderWithConfirm(element: React.ReactElement) {
  return render(React.createElement(ConfirmProvider, null, element))
}

// ── 1. InspectorFooter — "Improve this agent →" carries the origin ─────────

describe('InspectorFooter — "Improve this agent" carries origin (WBN-04, D-13)', () => {
  it('includes fromRun, section, and excerpt params when sectionName + excerpt are supplied', () => {
    renderWithConfirm(
      React.createElement(InspectorFooter, {
        promptKey: 'scout',
        agentKey: 'scout',
        runId: 'run_abc123',
        sectionName: 'founderBio',
        excerpt: 'The founder said the quiet part out loud.',
      }),
    )

    const improveLink = screen.getByRole('link', {
      name: /improve this agent/i,
    }) as HTMLAnchorElement
    expect(improveLink.getAttribute('href')).toBe(
      '/prompt-lab/scout?fromRun=run_abc123&section=founderBio&excerpt=' +
        encodeURIComponent('The founder said the quiet part out loud.'),
    )
  })

  it('falls back to the plain promptHref when sectionName/excerpt are absent', () => {
    renderWithConfirm(
      React.createElement(InspectorFooter, {
        promptKey: 'scout',
        agentKey: 'scout',
        runId: 'run_abc123',
      }),
    )

    const improveLink = screen.getByRole('link', {
      name: /improve this agent/i,
    }) as HTMLAnchorElement
    expect(improveLink.getAttribute('href')).toBe('/prompt-lab/scout')
  })

  it('does not carry origin params on "Compare instruction versions"', () => {
    renderWithConfirm(
      React.createElement(InspectorFooter, {
        promptKey: 'scout',
        agentKey: 'scout',
        runId: 'run_abc123',
        sectionName: 'founderBio',
        excerpt: 'The founder said the quiet part out loud.',
      }),
    )

    const compareLink = screen.getByRole('link', {
      name: /compare instruction versions/i,
    }) as HTMLAnchorElement
    expect(compareLink.getAttribute('href')).toBe('/prompt-lab/scout')
  })
})

// ── 2 & 3. saveVersion round-trip: insert with originRef -> read back ──────

const ORIGIN_REF = {
  runId: 'run_xyz789',
  sectionName: 'founderBio',
  excerpt: 'The founder said the quiet part out loud.',
}

describe('prompt_versions.originRef round-trips through save + render (WBN-04, D-13)', () => {
  let saveSpy: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    saveSpy = vi.fn(async () => 'v-id')
    ;(useMutation as unknown as Mock).mockReturnValue(saveSpy)
    ;(useQuery as unknown as Mock).mockReturnValue([{ version: 1 }])
  })

  it('PromptSaveDialog forwards originRef into the saveVersion call (insert side)', async () => {
    render(
      React.createElement(PromptSaveDialog, {
        workspaceId: 'eisenbalm',
        agentKey: 'scout',
        content: 'prompt body',
        originRef: ORIGIN_REF,
        onSaved: () => {},
        onCancel: () => {},
      }),
    )

    const noteInput = screen.getByPlaceholderText(/what changed and why/i)
    fireEvent.change(noteInput, { target: { value: 'Applied the origin fix' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm save/i }))

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: 'eisenbalm',
        agentKey: 'scout',
        content: 'prompt body',
        originRef: ORIGIN_REF,
      }),
    )
  })

  it('omits originRef entirely from the saveVersion call when none was supplied', async () => {
    render(
      React.createElement(PromptSaveDialog, {
        workspaceId: 'eisenbalm',
        agentKey: 'scout',
        content: 'prompt body',
        onSaved: () => {},
        onCancel: () => {},
      }),
    )

    const noteInput = screen.getByPlaceholderText(/what changed and why/i)
    fireEvent.change(noteInput, { target: { value: 'An ordinary edit' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm save/i }))

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
    expect(saveSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ originRef: expect.anything() }),
    )
  })

  it('OriginBanner reads back the SAME originRef object and renders "why this draft exists"', () => {
    // The exact object handed to saveVersion above, now read back as if it
    // were the active version's persisted `originRef` — the round trip.
    render(React.createElement(OriginBanner, { originRef: ORIGIN_REF }))

    const banner = screen.getByLabelText(/why this draft exists/i)
    expect(banner.textContent).toContain(ORIGIN_REF.sectionName)
    expect(banner.textContent).toContain(ORIGIN_REF.runId)
    expect(banner.textContent).toContain(ORIGIN_REF.excerpt)

    const link = screen.getByRole('link', {
      name: /view the motivating output/i,
    }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe(`/run-monitor/runs/${ORIGIN_REF.runId}`)
  })

  it('OriginBanner renders nothing when no origin is present', () => {
    const { container } = render(React.createElement(OriginBanner, {}))
    expect(container.innerHTML).toBe('')
    expect(screen.queryByLabelText(/why this draft exists/i)).toBeNull()
  })
})
