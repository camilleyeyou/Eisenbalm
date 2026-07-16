/**
 * Phase 49 Plan 08 (ROL-04, §49.2/§49.3) — IssueComments tests.
 *
 * TDD RED-then-GREEN: written before app/(dashboard)/issues/[issueNumber]/
 * _components/IssueComments.tsx exists. Mocks `convex/react` (useQuery/
 * useMutation) + `@convex/_generated/api`, mirroring the established
 * component-test pattern (EvalDrawer.test.tsx, DecisionRail.roleGate.test.tsx).
 *
 * Asserts the ROL-04 behavior contract:
 *   - a mocked comment list renders oldest-first
 *   - the empty state renders a legible "no comments yet" affordance (never
 *     blank/undefined-crash)
 *   - submitting calls comments.add with { workspace_id, issueNumber, stage,
 *     text } and clears the input afterward
 *   - the add affordance is available regardless of role — this file never
 *     mocks '@/lib/role' or wraps anything in LockedControl, unlike the
 *     six-gated-action tests (RevisionFlow.roleGate.test.tsx etc.)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    comments: {
      listByIssueNumber: 'comments:listByIssueNumber',
      add: 'comments:add',
    },
  },
}))

import { useQuery, useMutation } from 'convex/react'
import IssueComments from '../app/(dashboard)/issues/[issueNumber]/_components/IssueComments'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('IssueComments (ROL-04)', () => {
  it('renders comments oldest-first from the mocked query', () => {
    vi.mocked(useQuery).mockReturnValue([
      { _id: 'c1', text: 'First comment.', authorId: 'user_a', createdAt: 1 },
      { _id: 'c2', text: 'Second comment.', authorId: 'user_b', createdAt: 2 },
    ])
    vi.mocked(useMutation).mockReturnValue(vi.fn())

    render(<IssueComments issueNumber={42} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toContain('First comment.')
    expect(items[1]?.textContent).toContain('Second comment.')
  })

  it('renders a legible empty state, never a blank/crash', () => {
    vi.mocked(useQuery).mockReturnValue([])
    vi.mocked(useMutation).mockReturnValue(vi.fn())

    render(<IssueComments issueNumber={42} />)

    expect(screen.getByText(/no comments yet/i)).toBeDefined()
  })

  it('submitting calls comments.add with workspace_id/issueNumber/stage/text and clears the input', async () => {
    const addMock = vi.fn(async () => 'new-comment-id')
    vi.mocked(useQuery).mockReturnValue([])
    vi.mocked(useMutation).mockReturnValue(addMock)

    render(<IssueComments issueNumber={42} stage="draft" />)

    const textbox = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textbox, { target: { value: 'A new comment' } })

    const button = screen.getByRole('button', { name: /post comment/i })
    fireEvent.click(button)

    await waitFor(() =>
      expect(addMock).toHaveBeenCalledWith({
        workspace_id: 'eisenbalm',
        issueNumber: 42,
        stage: 'draft',
        text: 'A new comment',
      }),
    )

    await waitFor(() => expect(textbox.value).toBe(''))
  })

  it('never wraps the submit affordance in LockedControl — commenting is not editor-gated', () => {
    vi.mocked(useQuery).mockReturnValue([])
    vi.mocked(useMutation).mockReturnValue(vi.fn())

    render(<IssueComments issueNumber={42} />)

    // The real, enabled button must be present and NOT force-disabled —
    // LockedControl always renders disabled+aria-disabled (see
    // LockedControl.test.tsx) which this affordance must never do.
    const button = screen.getByRole('button', { name: /post comment/i }) as HTMLButtonElement
    expect(button.getAttribute('aria-disabled')).not.toBe('true')
  })
})
