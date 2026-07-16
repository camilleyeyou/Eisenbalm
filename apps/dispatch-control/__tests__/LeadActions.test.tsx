/**
 * Phase 47 (BRF-02) — LeadActions behavior tests.
 *
 * `LeadActions` renders "Require this lead" / "Remove — add reason" for a
 * `story_leads` row. Require calls `requireLead` (no reason). Remove is
 * disabled while the reason textarea is empty; submitting with a non-empty
 * reason calls `removeLead` and the removal surfaces in the shared Decision
 * log (`components/decision-log/DecisionLog.tsx`) via the pipeline's
 * `_emit_audit` call (docs/API_CONTRACTS.md §47.5) — mirrors
 * `factcheck.py::keep_claim`/`delete_claim` (reason mandatory on Remove).
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/pipelineControlClient', () => ({
  requireLead: vi.fn(async () => ({ leadId: 'lead-1', status: 'required' })),
  removeLead: vi.fn(async () => ({ leadId: 'lead-1', status: 'removed' })),
}))

// LeadActions mounts the shared DecisionLog component (mirrors
// ApprovalPanelContent's "always mounted, scoped to the run" idiom) — mock
// its Convex subscriptions exactly like CandidateSlate.test.tsx does.
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    auditLog: { listDecisions: 'auditLog:listDecisions' },
    users: { byClerkUserId: 'users:byClerkUserId' },
  },
}))

import { useQuery } from 'convex/react'
import { requireLead, removeLead } from '@/lib/pipelineControlClient'
import { LeadActions } from '../app/(dashboard)/story-brief/_components/LeadActions'

let decisionRows: Array<Record<string, unknown>> = []

beforeEach(() => {
  decisionRows = []
  ;(useQuery as unknown as Mock).mockImplementation((query: unknown) => {
    if (query === 'auditLog:listDecisions') return decisionRows
    return undefined
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LeadActions (BRF-02)', () => {
  it('clicking "Require this lead" calls requireLead(runId, leadId) with no reason required', async () => {
    render(<LeadActions runId="run-1" leadId="lead-1" />)

    fireEvent.click(screen.getByRole('button', { name: /require this lead/i }))

    await waitFor(() => {
      expect(requireLead).toHaveBeenCalledWith('run-1', 'lead-1', 'tok-clerk')
    })
  })

  it('the Remove button is disabled while the reason textarea is empty', () => {
    render(<LeadActions runId="run-1" leadId="lead-1" />)

    const removeButton = screen.getByRole('button', { name: /^remove$/i })
    expect(removeButton.hasAttribute('disabled')).toBe(true)
  })

  it('Remove is enabled once a non-empty reason is entered', () => {
    render(<LeadActions runId="run-1" leadId="lead-1" />)

    fireEvent.change(screen.getByLabelText(/remove — add reason/i), {
      target: { value: 'Duplicate of another lead.' },
    })

    expect(screen.getByRole('button', { name: /^remove$/i }).hasAttribute('disabled')).toBe(false)
  })

  it('keeps Remove disabled when the reason is whitespace only', () => {
    render(<LeadActions runId="run-1" leadId="lead-1" />)

    fireEvent.change(screen.getByLabelText(/remove — add reason/i), {
      target: { value: '   ' },
    })

    expect(screen.getByRole('button', { name: /^remove$/i }).hasAttribute('disabled')).toBe(true)
  })

  it('submitting Remove with a reason calls removeLead(runId, leadId, reason, token)', async () => {
    render(<LeadActions runId="run-1" leadId="lead-1" />)

    fireEvent.change(screen.getByLabelText(/remove — add reason/i), {
      target: { value: 'Duplicate of another lead.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }))

    await waitFor(() => {
      expect(removeLead).toHaveBeenCalledWith(
        'run-1',
        'lead-1',
        'Duplicate of another lead.',
        'tok-clerk',
      )
    })
  })

  it('a successful Remove surfaces the reason in the shared Decision log (DecisionLog component)', async () => {
    decisionRows = [
      {
        _id: 'audit-1',
        actorId: 'pipeline',
        action: 'lead_removed',
        reason: 'Duplicate of another lead.',
        timestamp: 1_700_000_000_000,
        runId: 'run-1',
      },
    ]

    render(<LeadActions runId="run-1" leadId="lead-1" />)

    fireEvent.change(screen.getByLabelText(/remove — add reason/i), {
      target: { value: 'Duplicate of another lead.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }))

    await waitFor(() => {
      expect(removeLead).toHaveBeenCalled()
    })

    // The shared DecisionLog component (not a bespoke re-implementation)
    // renders the removal's reason, sourced from auditLog.listDecisions.
    expect(screen.getByText('Duplicate of another lead.')).toBeDefined()
  })

  it('a failed requireLead call surfaces an error message, not a silent failure', async () => {
    ;(requireLead as unknown as Mock).mockRejectedValueOnce(
      new Error('require-lead failed (404): Lead not found'),
    )

    render(<LeadActions runId="run-1" leadId="lead-1" />)
    fireEvent.click(screen.getByRole('button', { name: /require this lead/i }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('require-lead failed')
    })
  })

  it('a failed removeLead call surfaces an error message, not a silent failure', async () => {
    ;(removeLead as unknown as Mock).mockRejectedValueOnce(
      new Error('remove-lead failed (422): A reason is required to remove this lead.'),
    )

    render(<LeadActions runId="run-1" leadId="lead-1" />)
    fireEvent.change(screen.getByLabelText(/remove — add reason/i), {
      target: { value: 'Duplicate of another lead.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('remove-lead failed')
    })
  })
})
