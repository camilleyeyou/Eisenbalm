/**
 * Phase 45 (REV-04, docs/API_CONTRACTS.md §45.2/§45.4) — RevisionFlow tests.
 * Converts the Wave-0 (45-01) it.todo scaffold into real orchestration
 * assertions (Plan 45-04 Task 3). All pipeline calls
 * (previewRevision/applyRevision/getDraft) are mocked via vi.mock — no live
 * network.
 */
import { describe, it, expect, afterEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

// Phase 49 (ROL-03, Plan 49-07): RevisionFlow now resolves useRole() to
// decide whether Apply is rendered locked. This suite exercises the
// pre-existing (pre-Phase-49) editor behavior, so it stubs the role
// hook directly to 'Editor-in-chief' rather than reaching through Clerk's
// useUser() (which this file's '@clerk/nextjs' mock above doesn't provide).
vi.mock('@/lib/role', () => ({ useRole: () => 'Editor-in-chief' }))

// Class + mock fns are defined INSIDE the factory (vi.mock is hoisted above
// module top-level const/class declarations — mirrors
// DecisionRail.test.tsx's vi.mock('@/lib/signOffClient'/'@/lib/reviewClient')
// pattern) so `instanceof RevisionError` branching inside RevisionFlow works
// exactly as it does against the real module.
vi.mock('@/lib/revisionClient', () => {
  class RevisionError extends Error {
    constructor(
      public status: number,
      public reason: string,
      message: string,
      public spentUsd?: number,
      public projectedUsd?: number,
      public capUsd?: number,
    ) {
      super(message)
      this.name = 'RevisionError'
    }
  }
  return {
    RevisionError,
    previewRevision: vi.fn(),
    applyRevision: vi.fn(),
  }
})

vi.mock('@/lib/contentPatchClient', () => ({
  getDraft: vi.fn(),
  ContentPatchError: class ContentPatchError extends Error {},
}))

import { RevisionFlow } from '../components/revision/RevisionFlow'
import { previewRevision, applyRevision, RevisionError } from '@/lib/revisionClient'
import { getDraft } from '@/lib/contentPatchClient'

const mockPreviewRevision = previewRevision as unknown as Mock
const mockApplyRevision = applyRevision as unknown as Mock
const mockGetDraft = getDraft as unknown as Mock

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const passage = {
  sectionName: 'founder_bio',
  quotedText: 'a mysterious stranger',
  blockIndexHint: 2,
}

function renderFlow() {
  const onApplied = vi.fn()
  const onClose = vi.fn()
  render(<RevisionFlow runId="run-1" passage={passage} onApplied={onApplied} onClose={onClose} />)
  return { onApplied, onClose }
}

describe('RevisionFlow (§45.2/§45.4)', () => {
  it('fetches a fresh ifRevisionID immediately before calling apply', async () => {
    mockPreviewRevision.mockResolvedValueOnce({
      proposedText: 'a former county clerk',
      whatChanged: 'Replaced unverifiable characterization with a sourced fact.',
      claimDelta: { added: [], removed: [], altered: ['founder occupation'] },
    })
    mockGetDraft.mockResolvedValueOnce({ revisionId: 'rev-fresh-1' })
    mockApplyRevision.mockResolvedValueOnce({ revisionId: 'rev-fresh-1', resolution: 'revision_applied' })

    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: 'Make clearer' }))
    await screen.findByTestId('revision-comparison-card')

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(mockApplyRevision).toHaveBeenCalled())
    expect(mockGetDraft).toHaveBeenCalledWith('run-1', 'tok-clerk')
    expect(mockApplyRevision.mock.calls[0]![1]).toMatchObject({
      ifRevisionID: 'rev-fresh-1',
      newText: 'a former county clerk',
    })
  })

  it('priorProposals accumulates across successive Try another approach clicks (D-05)', async () => {
    mockPreviewRevision
      .mockResolvedValueOnce({
        proposedText: 'proposal one',
        whatChanged: 'first pass',
        claimDelta: { added: [], removed: [], altered: [] },
      })
      .mockResolvedValueOnce({
        proposedText: 'proposal two',
        whatChanged: 'second pass',
        claimDelta: { added: [], removed: [], altered: [] },
      })

    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: 'Make clearer' }))
    await screen.findByTestId('revision-comparison-card')
    expect(mockPreviewRevision.mock.calls[0]![1]).toMatchObject({ priorProposals: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Try another approach' }))
    await waitFor(() => expect(mockPreviewRevision).toHaveBeenCalledTimes(2))
    expect(mockPreviewRevision.mock.calls[1]![1]).toMatchObject({ priorProposals: ['proposal one'] })
  })

  it('edit-before-applying sends the operator-edited newText through the same apply route (D-11)', async () => {
    mockPreviewRevision.mockResolvedValueOnce({
      proposedText: 'a former county clerk',
      whatChanged: 'first pass',
      claimDelta: { added: [], removed: [], altered: [] },
    })
    mockGetDraft.mockResolvedValueOnce({ revisionId: 'rev-fresh-2' })
    mockApplyRevision.mockResolvedValueOnce({ revisionId: 'rev-fresh-2', resolution: 'revision_applied' })

    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: 'Make clearer' }))
    await screen.findByTestId('revision-comparison-card')

    fireEvent.click(screen.getByRole('button', { name: 'Edit before applying' }))
    const textarea = screen.getByLabelText(/edit proposed text/i)
    fireEvent.change(textarea, { target: { value: 'a former county clerk from Berkeley County' } })
    fireEvent.click(screen.getByRole('button', { name: /apply edited text/i }))

    await waitFor(() => expect(mockApplyRevision).toHaveBeenCalled())
    expect(mockApplyRevision.mock.calls[0]![1]).toMatchObject({
      newText: 'a former county clerk from Berkeley County',
    })
    // Never the agent's original proposedText once edited (D-11).
    expect(mockApplyRevision.mock.calls[0]![1]).not.toMatchObject({
      newText: 'a former county clerk',
    })
  })

  it('a cost_cap_exceeded 409 from preview disables the direction chips with an explanation (D-14)', async () => {
    mockPreviewRevision.mockRejectedValueOnce(
      new RevisionError(409, 'cost_cap_exceeded', 'Revision spend cap reached.', 9.5, 0.2, 10),
    )

    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: 'Make clearer' }))

    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Make clearer' }) as HTMLButtonElement
      expect(button.disabled).toBe(true)
    })
    const button = screen.getByRole('button', { name: 'Make clearer' }) as HTMLButtonElement
    expect(button.title).toMatch(/9\.50/)
    expect(button.title).toMatch(/10\.00/)
    // No comparison card should be shown once cost-capped.
    expect(screen.queryByTestId('revision-comparison-card')).toBeNull()
  })

  it('apply success calls onApplied (the workspace reflects the touched-claims reset and revoked sign-offs via its own Convex subscriptions) and closes the flow', async () => {
    mockPreviewRevision.mockResolvedValueOnce({
      proposedText: 'a former county clerk',
      whatChanged: 'first pass',
      claimDelta: { added: [], removed: [], altered: [] },
    })
    mockGetDraft.mockResolvedValueOnce({ revisionId: 'rev-fresh-3' })
    mockApplyRevision.mockResolvedValueOnce({ revisionId: 'rev-fresh-3', resolution: 'revision_applied' })

    const { onApplied, onClose } = renderFlow()

    fireEvent.click(screen.getByRole('button', { name: 'Make clearer' }))
    await screen.findByTestId('revision-comparison-card')
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(onApplied).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })
})
