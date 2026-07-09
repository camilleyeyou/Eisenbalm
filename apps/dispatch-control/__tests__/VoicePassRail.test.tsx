/**
 * Phase 36 (VOX-03, Plan 36-06 Task 2) — VoicePassRail tests.
 *
 * The Voice Pass right rail (mirrors DecisionRail, scoped to VOICE_AXES):
 *   (a) an open severity:'error' axis:'machine-tell' finding disables "Sign:
 *       Sounds human" and shows a reason line with the open-tell count
 *   (b) zero open voice-axis errors enables the button; clicking calls
 *       recordSignOff(token, runId, 'sounds-human')
 *   (c) `activeByRunId` reporting `sounds-human` active renders the green
 *       "Sounds human — signed …" state with no button
 *   (d) a SignOffApiError with reason 'open_voice_findings' surfaces its
 *       message (belt-and-suspenders with the disabled state)
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: { byRunId: 'qaCorrections:byRunId' },
    signOffs: { activeByRunId: 'signOffs:activeByRunId' },
  },
}))

vi.mock('@/lib/signOffClient', () => {
  class SignOffApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'SignOffApiError'
    }
  }
  return {
    SignOffApiError,
    recordSignOff: vi.fn(async () => ({
      runId: 'run-1',
      kind: 'sounds-human',
      signedAt: Date.now(),
    })),
  }
})

import { useQuery } from 'convex/react'
import { recordSignOff, SignOffApiError } from '@/lib/signOffClient'
import VoicePassRail from '../app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const voiceErrorFinding = {
  _id: 'v1',
  sectionName: 'origin_story',
  severity: 'error' as const,
  axis: 'machine-tell',
  reason: 'Reads like AI-generated prose.',
}

const factualErrorFinding = {
  _id: 'f1',
  sectionName: 'problem',
  severity: 'error' as const,
  axis: 'precision',
  reason: 'Unverified name.',
}

function mockState({
  findings = [] as unknown[],
  signoffs = undefined as Record<string, unknown> | undefined,
}: { findings?: unknown[]; signoffs?: Record<string, unknown> } = {}) {
  ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation((queryRef: string) => {
    if (queryRef === 'qaCorrections:byRunId') return findings
    if (queryRef === 'signOffs:activeByRunId') return signoffs
    return undefined
  })
}

describe('VoicePassRail (VOX-03)', () => {
  it('disables Sign: Sounds human and shows a reason line while an open voice-axis error remains', () => {
    mockState({ findings: [voiceErrorFinding] })
    render(<VoicePassRail runId="run-1" />)

    const button = screen.getByRole('button', { name: /sign: sounds human/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/1 voice tell/i)).toBeDefined()
  })

  it('a factual-axis error does not block the voice sign-off (VOX-03 distinct-from-factual)', () => {
    mockState({ findings: [factualErrorFinding] })
    render(<VoicePassRail runId="run-1" />)

    const button = screen.getByRole('button', { name: /sign: sounds human/i }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })

  it('enables Sign: Sounds human with zero open voice-axis errors and calls recordSignOff on click', async () => {
    mockState({ findings: [] })
    render(<VoicePassRail runId="run-1" />)

    const button = screen.getByRole('button', { name: /sign: sounds human/i }) as HTMLButtonElement
    expect(button.disabled).toBe(false)

    fireEvent.click(button)

    await waitFor(() => {
      expect(recordSignOff).toHaveBeenCalledWith('tok-clerk', 'run-1', 'sounds-human')
    })
  })

  it('shows the green "Sounds human — signed" state with no button when active', () => {
    mockState({
      findings: [],
      signoffs: { 'sounds-human': { actorId: 'user_1', signedAt: Date.now() } },
    })
    render(<VoicePassRail runId="run-1" />)

    expect(screen.getByText(/sounds human — signed/i)).toBeDefined()
    expect(screen.queryByRole('button', { name: /sign: sounds human/i })).toBeNull()
  })

  it('surfaces a SignOffApiError open_voice_findings message', async () => {
    mockState({ findings: [] })
    vi.mocked(recordSignOff).mockRejectedValueOnce(
      new SignOffApiError(
        409,
        'open_voice_findings',
        '1 voice finding(s) must be accepted or dismissed before signing sounds-human.',
      ),
    )
    render(<VoicePassRail runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /sign: sounds human/i }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(
        /voice finding\(s\) must be accepted/i,
      )
    })
  })
})
