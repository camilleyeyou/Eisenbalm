/**
 * Phase 49 (ROL-03) Plan 49-07 Task 3 — DecisionRail integration role-gate
 * smoke test (SC-3).
 *
 * Proves the ROL-03 rendering contract at the INTEGRATION level: mounting
 * the real `<DecisionRail>` (not the LockedControl unit in isolation), in
 * the READY state (no open error-severity findings, both sign-offs
 * present, not held — Publish would be enabled for an editor), with
 * `useRole()` mocked to 'Collaborator' shows the REAL "Publish" button
 * present in the DOM, force-disabled, and labeled with the verbatim §6
 * sentence — never hidden (D-09).
 *
 * Reuses DecisionRail.test.tsx's exact mock harness (convex/react, clerk,
 * @convex/_generated/api, reviewClient/signOffClient/pipelineControlClient,
 * the ResolvedFindingsList stub, and the InspectorProvider `renderRail`
 * wrapper) and adds ONLY the role mock.
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import type { ReactElement } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { InspectorProvider } from '@/components/inspector/InspectorProvider'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

// quick 260722-tv1: DecisionRail's handleTranscript/jumpToFinding, and the
// SourceIndex it mounts, now fall back to useRouter().push(...) when a
// jump target's galley anchor isn't in the DOM — mock useRouter so the
// component tree can render.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/role', () => ({ useRole: () => 'Collaborator' }))

vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: { byRunId: 'qaCorrections:byRunId' },
    deliberationEvents: { byRunIdAndType: 'deliberationEvents:byRunIdAndType' },
    pitchLog: { selectedByRunId: 'pitchLog:selectedByRunId' },
    claimChecks: { listByRunId: 'claimChecks:listByRunId', setStatus: 'claimChecks:setStatus' },
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
      kind: 'facts-cleared',
      signedAt: Date.now(),
    })),
  }
})

vi.mock('@/lib/reviewClient', () => {
  class ReviewApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'ReviewApiError'
    }
  }
  return {
    ReviewApiError,
    publishIssue: vi.fn(async () => ({ issueId: 'issue-1', published: true })),
    rejectIssue: vi.fn(async () => ({ issueId: 'issue-1', rejected: true })),
  }
})

vi.mock('@/lib/pipelineControlClient', () => ({
  rerollAgent: vi.fn(async () => ({ runId: 'run-1', agentKey: 'origin_story', rerolled: true })),
}))

vi.mock(
  '../app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList',
  () => ({
    default: () => <div data-testid="resolved-findings-list" />,
  }),
)

import { useQuery, useMutation } from 'convex/react'
import DecisionRail from '../app/(dashboard)/review-desk/[runId]/_components/DecisionRail'

afterEach(() => {
  cleanup()
})

function renderRail(ui: ReactElement) {
  return render(<InspectorProvider>{ui}</InspectorProvider>)
}

const warningFinding = {
  _id: 'f-warn',
  findingId: 'f-warn',
  sectionName: 'problem',
  severity: 'warning' as const,
  reason: 'Minor tonal nit.',
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(useMutation as unknown as Mock).mockImplementation(() => vi.fn())
  // READY state: only a warning-severity finding (no open error blockers),
  // both sign-offs present (default), not held — Publish would be enabled
  // for an editor.
  ;(useQuery as unknown as Mock).mockImplementation((query: unknown) => {
    switch (query) {
      case 'qaCorrections:byRunId':
        return [warningFinding]
      case 'deliberationEvents:byRunIdAndType':
        return []
      case 'pitchLog:selectedByRunId':
        return null
      case 'claimChecks:listByRunId':
        return []
      case 'signOffs:activeByRunId':
        return {
          'facts-cleared': { actorId: 'andrew', signedAt: Date.now() },
          'sounds-human': { actorId: 'andrew', signedAt: Date.now() },
        }
      default:
        return undefined
    }
  })
})

describe('DecisionRail role gate (ROL-03, SC-3)', () => {
  it('a Collaborator sees the real Publish button present + disabled + labeled with the verbatim §6 sentence, even when publish-ready', () => {
    renderRail(<DecisionRail runId="run-1" />)

    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    // Real element force-disabled, not just a wrapper (a11y-safe pattern).
    expect(publish.disabled).toBe(true)
    expect(publish.getAttribute('aria-disabled')).toBe('true')
    // Present + visible, never hidden (D-09).
    expect(
      screen.getByText('Collaborators can review and comment, not publish.'),
    ).toBeDefined()
  })
})
