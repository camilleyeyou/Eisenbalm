/**
 * Phase 49 (ROL-03) Plan 49-07 Task 3 — RevisionFlow integration role-gate
 * smoke test (SC-3).
 *
 * Proves the ROL-03 rendering contract at the INTEGRATION level: mounting
 * the real `<RevisionFlow>` (not the LockedControl unit in isolation) with
 * `useRole()` mocked to 'Collaborator' shows the REAL "Apply" button
 * present in the DOM, force-disabled, and labeled with the verbatim §6
 * text — never hidden (D-09).
 *
 * Reuses RevisionFlow.test.tsx's exact mock harness (clerk,
 * '@/lib/revisionClient', '@/lib/contentPatchClient') and adds ONLY the
 * role mock.
 */
import { describe, it, expect, afterEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/role', () => ({ useRole: () => 'Collaborator' }))

// Class + mock fns defined INSIDE the factory (vi.mock is hoisted above
// module top-level const/class declarations) — mirrors RevisionFlow.test.tsx.
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
import { previewRevision } from '@/lib/revisionClient'

const mockPreviewRevision = previewRevision as unknown as Mock

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const passage = {
  sectionName: 'founder_bio',
  quotedText: 'a mysterious stranger',
  blockIndexHint: 2,
}

describe('RevisionFlow role gate (ROL-03, SC-3)', () => {
  it('a Collaborator sees the real Apply button present + disabled + labeled with the verbatim §6 text', async () => {
    mockPreviewRevision.mockResolvedValueOnce({
      proposedText: 'a former county clerk',
      whatChanged: 'Replaced unverifiable characterization with a sourced fact.',
      claimDelta: { added: [], removed: [], altered: ['founder occupation'] },
    })

    render(
      <RevisionFlow
        runId="run-1"
        passage={passage}
        onApplied={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Make clearer' }))
    await screen.findByTestId('revision-comparison-card')

    const apply = (await screen.findByRole('button', { name: 'Apply' })) as HTMLButtonElement
    // Real element force-disabled, not just a wrapper (a11y-safe pattern).
    expect(apply.disabled).toBe(true)
    expect(apply.getAttribute('aria-disabled')).toBe('true')
    // Present + visible, never hidden (D-09).
    expect(screen.getByText('Apply revision 🔒 editor only')).toBeDefined()
  })
})
