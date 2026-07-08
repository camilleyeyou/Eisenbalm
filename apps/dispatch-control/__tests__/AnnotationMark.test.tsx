/**
 * Phase 33 (EDT-04, Plan 33-04 Task 3) — AnnotationMark action-row tests.
 *
 * The popover gains Accept fix / Edit inline / Dismiss:
 *   - Accept renders ONLY when suggestedFix is present (D-07); otherwise an
 *     inline note states why Accept is unavailable.
 *   - Accept invokes acceptFinding with {ifRevisionID} then reloadDraft()
 *     (EDT-06 — re-resolution must run against fresh text).
 *   - A revision_mismatch 409 ALSO triggers reloadDraft() + a retry note.
 *   - Dismiss reveals a reason input whose submit stays disabled until the
 *     trimmed reason is non-empty.
 *   - Edit inline calls onEditSection(sectionId, findingId).
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/findingsClient', () => {
  class FindingsError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'FindingsError'
    }
  }
  return {
    FindingsError,
    acceptFinding: vi.fn(async () => ({ revisionId: 'rev-2', findingId: 'f1', resolution: 'accepted' })),
    dismissFinding: vi.fn(async () => ({ findingId: 'f1', resolution: 'dismissed' })),
    reopenFinding: vi.fn(async () => ({ findingId: 'f1', resolution: null })),
  }
})

import { acceptFinding, dismissFinding, FindingsError } from '@/lib/findingsClient'
import AnnotationMark, {
  type AnnotationMarkDef,
} from '../app/(dashboard)/review-desk/[runId]/_components/AnnotationMark'

const value: AnnotationMarkDef = {
  findingId: 'f1',
  severity: 'error',
  axis: 'gravity',
  reason: 'Too flippant for the founding moment.',
  suggestedFix: 'State it plainly.',
  quotedSpan: 'in a garage',
}

function renderMark(overrides: Partial<AnnotationMarkDef> = {}, props: Record<string, unknown> = {}) {
  const reloadDraft = vi.fn(async () => {})
  const onEditSection = vi.fn()
  render(
    <AnnotationMark
      value={{ ...value, ...overrides }}
      runId="run-1"
      sectionId="originStory"
      revisionId="rev-1"
      reloadDraft={reloadDraft}
      onEditSection={onEditSection}
      {...props}
    >
      in a garage
    </AnnotationMark>,
  )
  return { reloadDraft, onEditSection }
}

function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: /qa error finding/i }))
}

beforeEach(() => {
  vi.mocked(acceptFinding).mockClear()
  vi.mocked(dismissFinding).mockClear()
})

afterEach(() => {
  cleanup()
})

describe('AnnotationMark action row (EDT-04)', () => {
  it('renders Accept fix / Edit inline / Dismiss in the opened popover', () => {
    renderMark()
    openPopover()

    expect(screen.getByRole('button', { name: /accept fix/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /edit inline/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /^dismiss$/i })).toBeDefined()
  })

  it('hides Accept and states why when suggestedFix is absent (D-07)', () => {
    renderMark({ suggestedFix: undefined })
    openPopover()

    expect(screen.queryByRole('button', { name: /accept fix/i })).toBeNull()
    expect(screen.getByText(/accept unavailable/i)).toBeDefined()
  })

  it('Accept invokes acceptFinding with {ifRevisionID} then reloadDraft (EDT-06)', async () => {
    const { reloadDraft } = renderMark()
    openPopover()

    fireEvent.click(screen.getByRole('button', { name: /accept fix/i }))

    await waitFor(() => {
      expect(acceptFinding).toHaveBeenCalledWith(
        'run-1',
        'f1',
        { ifRevisionID: 'rev-1' },
        'tok-clerk',
      )
      expect(reloadDraft).toHaveBeenCalled()
    })
  })

  it('on a revision_mismatch 409, calls reloadDraft and shows a retry note', async () => {
    vi.mocked(acceptFinding).mockRejectedValueOnce(
      new FindingsError(409, 'revision_mismatch', 'Draft changed.'),
    )
    const { reloadDraft } = renderMark()
    openPopover()

    fireEvent.click(screen.getByRole('button', { name: /accept fix/i }))

    await waitFor(() => {
      expect(reloadDraft).toHaveBeenCalled()
      expect(screen.getByText(/draft changed/i)).toBeDefined()
    })
  })

  it('on span_not_resolved, points the operator at Edit inline', async () => {
    vi.mocked(acceptFinding).mockRejectedValueOnce(
      new FindingsError(409, 'span_not_resolved', "Couldn't locate this text."),
    )
    renderMark()
    openPopover()

    fireEvent.click(screen.getByRole('button', { name: /accept fix/i }))

    await waitFor(() => {
      expect(screen.getByText(/use edit inline/i)).toBeDefined()
    })
  })

  it('Edit inline calls onEditSection(sectionId, findingId)', () => {
    const { onEditSection } = renderMark()
    openPopover()

    fireEvent.click(screen.getByRole('button', { name: /edit inline/i }))

    expect(onEditSection).toHaveBeenCalledWith('originStory', 'f1')
  })

  it('Dismiss reveals a reason input whose submit is disabled until a reason is typed', async () => {
    renderMark()
    openPopover()

    fireEvent.click(screen.getByRole('button', { name: /^dismiss$/i }))

    const input = screen.getByLabelText(/dismissal reason/i)
    const submit = screen.getByRole('button', { name: /confirm dismiss/i }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.change(input, { target: { value: '   ' } })
    expect((screen.getByRole('button', { name: /confirm dismiss/i }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'Stylistic; fine as-is.' } })
    expect((screen.getByRole('button', { name: /confirm dismiss/i }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /confirm dismiss/i }))
    await waitFor(() => {
      expect(dismissFinding).toHaveBeenCalledWith(
        'run-1',
        'f1',
        { reason: 'Stylistic; fine as-is.' },
        'tok-clerk',
      )
    })
  })

  it('the popover action row contains no block elements (Pitfall 5 — phrasing content only)', () => {
    const { container } = ((): { container: HTMLElement } => {
      const reloadDraft = vi.fn()
      const onEditSection = vi.fn()
      return render(
        <p>
          <AnnotationMark
            value={value}
            runId="run-1"
            sectionId="originStory"
            revisionId="rev-1"
            reloadDraft={reloadDraft}
            onEditSection={onEditSection}
          >
            in a garage
          </AnnotationMark>
        </p>,
      )
    })()
    openPopover()

    expect(container.querySelector('div')).toBeNull()
    expect(container.querySelector('form')).toBeNull()
    // The wrapping <p> is the test's own; no nested <p> inside the mark.
    expect(container.querySelectorAll('p').length).toBe(1)
  })
})
