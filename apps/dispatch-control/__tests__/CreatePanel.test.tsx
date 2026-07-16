/**
 * Phase 48 Wave 0 (ENT-01, D-13/D-14) — CreatePanel "Start from my brief"
 * second-card scaffold.
 *
 * D-13 fills CreatePanel.tsx's reserved second grid cell (Phase 40 D-28 —
 * "no dead button in the primary CTA") with a peer "Start from my brief"
 * card. This is a Wave 0 scaffold, not a regression gate: the second-card
 * block below is source-scan skip-guarded (`SECOND_CARD_SHIPPED`, reading
 * CreatePanel.tsx's own source text — mirrors the pytest source-scan
 * skip-guard idiom used throughout the pipeline suite, adapted for a
 * vitest/TS component test) and only RUNS once CreatePanel.tsx actually
 * renders "Start from my brief" (Plan 48-05). Until then those assertions
 * are SKIPPED, not failing.
 *
 * The EXISTING "Find a story with agents" path (D-14's sibling, unchanged)
 * runs unconditionally — CreatePanel.tsx already ships that card today, so
 * this is real regression coverage, not a scaffold.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// ── Module mocks ─────────────────────────────────────────────────────────

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

const ensureByNumberMock = vi.fn(async () => ({ ok: true }))
vi.mock('convex/react', () => ({
  useMutation: () => (...args: unknown[]) => ensureByNumberMock(...args),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    issues: { ensureByNumber: 'issues:ensureByNumber' },
  },
}))

const triggerRunMock = vi.fn(async () => ({ runId: 'run-1' }))
const triggerBriefRunMock = vi.fn(async () => ({ runId: 'run-2' }))
vi.mock('@/lib/pipelineControlClient', () => ({
  triggerRun: (...args: unknown[]) => triggerRunMock(...args),
  triggerBriefRun: (...args: unknown[]) => triggerBriefRunMock(...args),
}))

import CreatePanel from '../app/(dashboard)/issues/_components/CreatePanel'
import { issueHref } from '@/lib/issueRouteResolver'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

// ── Source-scan skip-guard (Wave 0 -> Wave 4, Plan 48-05) ──────────────────
//
// NOTE: CreatePanel.tsx's OWN doc-comment already mentions the string
// "Start from my brief" (describing the reserved-but-absent second cell,
// Phase 40 D-28) — matching on that phrase alone would false-positive on the
// comment itself. `triggerBriefRun` is a code-only symbol (the client Plan
// 48-05 imports from `@/lib/pipelineControlClient`, D-14) with zero
// occurrences in CreatePanel.tsx today, so it is a reliable "the second card
// actually shipped" signal.

const CREATE_PANEL_SRC = fs.readFileSync(
  path.resolve(__dirname, '../app/(dashboard)/issues/_components/CreatePanel.tsx'),
  'utf-8',
)
const SECOND_CARD_SHIPPED = /triggerBriefRun/.test(CREATE_PANEL_SRC)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ── Existing path (D-14, unchanged) ────────────────────────────────────────

describe('CreatePanel — "Find a story with agents" (existing path, unchanged)', () => {
  it('calls ensureByNumber, then triggerRun, then router.push, in order — never triggerBriefRun', async () => {
    render(<CreatePanel nextIssueNumber={13} />)
    fireEvent.click(screen.getByRole('button', { name: /find a story with agents/i }))

    await waitFor(() => {
      expect(ensureByNumberMock).toHaveBeenCalledWith({
        workspace_id: DEFAULT_WORKSPACE_ID,
        issueNumber: 13,
      })
    })
    await waitFor(() => {
      expect(triggerRunMock).toHaveBeenCalledWith({ issueNumber: 13 }, 'tok-clerk')
    })
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(issueHref(13))
    })
    expect(triggerBriefRunMock).not.toHaveBeenCalled()
  })
})

// ── "Start from my brief" second card (ENT-01, D-13/D-14 — Wave 4) ─────────

describe.skipIf(!SECOND_CARD_SHIPPED)(
  'CreatePanel — "Start from my brief" (ENT-01, D-13/D-14, Phase 48 — Wave 4)',
  () => {
    it('renders two peer Create cards: "Find a story with agents" AND "Start from my brief"', () => {
      render(<CreatePanel nextIssueNumber={13} />)
      expect(screen.getByRole('button', { name: /find a story with agents/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /start from my brief/i })).toBeDefined()
    })

    it('clicking "Start from my brief" reveals the intake form (premise, peg, organization name)', () => {
      render(<CreatePanel nextIssueNumber={13} />)
      fireEvent.click(screen.getByRole('button', { name: /start from my brief/i }))

      expect(screen.getByLabelText(/premise/i)).toBeDefined()
      expect(screen.getByLabelText(/peg/i)).toBeDefined()
      expect(screen.getByLabelText(/organization/i)).toBeDefined()
    })

    it('submitting the brief form calls ensureByNumber, then triggerBriefRun, then router.push, in order', async () => {
      const callOrder: string[] = []
      ensureByNumberMock.mockImplementation(async () => {
        callOrder.push('ensureByNumber')
        return { ok: true }
      })
      triggerBriefRunMock.mockImplementation(async () => {
        callOrder.push('triggerBriefRun')
        return { runId: 'run-2' }
      })
      pushMock.mockImplementation(() => {
        callOrder.push('push')
      })

      render(<CreatePanel nextIssueNumber={13} />)
      fireEvent.click(screen.getByRole('button', { name: /start from my brief/i }))

      fireEvent.change(screen.getByLabelText(/premise/i), {
        target: { value: 'A quiet food bank quietly feeds a third of the county.' },
      })
      fireEvent.change(screen.getByLabelText(/peg/i), {
        target: { value: 'Their annual harvest drive starts next Tuesday.' },
      })
      fireEvent.change(screen.getByLabelText(/organization/i), {
        target: { value: 'Quiet Harvest Food Bank' },
      })

      fireEvent.click(screen.getByRole('button', { name: /submit|start this run|create issue/i }))

      await waitFor(() => {
        expect(callOrder).toEqual(['ensureByNumber', 'triggerBriefRun', 'push'])
      })
      expect(triggerRunMock).not.toHaveBeenCalled()

      const briefBody = triggerBriefRunMock.mock.calls[0]?.[0] as
        | { premise?: string; peg?: string; organization?: { name?: string } }
        | undefined
      expect(briefBody?.premise).toBe('A quiet food bank quietly feeds a third of the county.')
      expect(briefBody?.peg).toBe('Their annual harvest drive starts next Tuesday.')
      expect(briefBody?.organization?.name).toBe('Quiet Harvest Food Bank')
      expect(triggerBriefRunMock.mock.calls[0]?.[1]).toBe('tok-clerk')

      expect(pushMock).toHaveBeenCalledWith(issueHref(13))
    })
  },
)
