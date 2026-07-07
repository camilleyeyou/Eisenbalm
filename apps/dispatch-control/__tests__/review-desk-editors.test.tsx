/**
 * Phase 31 (EDT-01/EDT-02/EDT-03, Plan 31-05) — Review Desk editor tests.
 *
 * Covers:
 *   - BlockEditor: add/delete/reorder mutate the emitted blocks array;
 *     the lossy banner renders conditionally.
 *   - TurnListEditor: add/delete mutate the emitted turns array.
 *   - SectionEditorPanel: editing a field marks the section dirty; a
 *     successful Save clears dirty (D-07); a `revision_mismatch` error
 *     surfaces the reload-and-reapply prompt (D-10).
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'mock-token') }),
}))

vi.mock('@/lib/contentPatchClient', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/contentPatchClient')>(
      '@/lib/contentPatchClient',
    )
  return {
    ...actual,
    getDraft: vi.fn(),
    patchHeadline: vi.fn(),
    patchSection: vi.fn(),
    patchPdfDataPoints: vi.fn(),
    patchBonus: vi.fn(),
    patchGame: vi.fn(),
    patchDeliberationConversation: vi.fn(),
    patchPodcastTranscript: vi.fn(),
    patchTheme: vi.fn(),
    uploadAsset: vi.fn(),
  }
})

import BlockEditor from '../app/(dashboard)/review-desk/[runId]/_components/BlockEditor'
import TurnListEditor from '../app/(dashboard)/review-desk/[runId]/_components/TurnListEditor'
import SectionEditorPanel from '../app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel'
import {
  patchHeadline,
  patchSection,
  patchPdfDataPoints,
  patchBonus,
  ContentPatchError,
  type ContentBlock,
  type DraftResponse,
} from '@/lib/contentPatchClient'

afterEach(() => {
  cleanup()
})

// ── BlockEditor ────────────────────────────────────────────────────────────────

describe('BlockEditor', () => {
  const blocks: ContentBlock[] = [
    { type: 'paragraph', text: 'First' },
    { type: 'paragraph', text: 'Second' },
  ]

  it('emits a new array with an added block', () => {
    const onChange = vi.fn()
    render(<BlockEditor blocks={blocks} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText(/add block after 1/i))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as ContentBlock[]
    expect(next.length).toBe(3)
    expect(next[1]).toEqual({ type: 'paragraph', text: '' })
  })

  it('emits a new array with a block removed on delete', () => {
    const onChange = vi.fn()
    render(<BlockEditor blocks={blocks} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText(/delete block 1/i))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as ContentBlock[]
    expect(next.length).toBe(1)
    expect(next[0].text).toBe('Second')
  })

  it('reorders blocks when moving a block down', () => {
    const onChange = vi.fn()
    render(<BlockEditor blocks={blocks} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText(/move block 1 down/i))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as ContentBlock[]
    expect(next.map(b => b.text)).toEqual(['Second', 'First'])
  })

  it('does not render a drag-and-drop library banner and shows the lossy warning when flagged', () => {
    render(<BlockEditor blocks={blocks} lossy onChange={vi.fn()} />)
    expect(screen.getByText(/rich formatting/i)).toBeDefined()
  })

  it('does not show the lossy banner when lossy is false', () => {
    render(<BlockEditor blocks={blocks} lossy={false} onChange={vi.fn()} />)
    expect(screen.queryByText(/rich formatting/i)).toBeNull()
  })
})

// ── TurnListEditor ─────────────────────────────────────────────────────────────

describe('TurnListEditor', () => {
  it('emits a new array with a turn removed on delete', () => {
    const onChange = vi.fn()
    render(
      <TurnListEditor
        turns={[
          { speaker: 'Scout', text: 'Found one.' },
          { speaker: 'Editor', text: 'Approved.' },
        ]}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByLabelText(/delete turn 1/i))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0]
    expect(next.length).toBe(1)
    expect(next[0].speaker).toBe('Editor')
  })

  it('adds a blank turn', () => {
    const onChange = vi.fn()
    render(<TurnListEditor turns={[{ speaker: 'Scout', text: 'Found one.' }]} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText(/add turn after 1/i))

    const next = onChange.mock.calls[0][0]
    expect(next.length).toBe(2)
    expect(next[1]).toEqual({ speaker: '', text: '' })
  })
})

// ── SectionEditorPanel ───────────────────────────────────────────────────────

function makeDraft(): DraftResponse {
  return {
    revisionId: 'rev-1',
    sections: {
      originStory: {
        headline: 'Old headline',
        blocks: [{ type: 'paragraph', text: 'Hello' }],
        lossy: false,
      },
      problemStatement: { headline: '', blocks: [], lossy: false },
      founderBio: { headline: '', blocks: [], lossy: false },
      caseStudy: { headline: '', blocks: [], lossy: false },
    },
    theme: {},
    game: {},
    bonus: {},
    bonusType: 'specAd',
    podcast: {},
    conversation: [],
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDraftWithPdf(pdfContent?: Record<string, any>): DraftResponse {
  const draft = makeDraft()
  draft.sections = {
    ...draft.sections,
    problemStatement: {
      headline: 'Problem headline',
      blocks: [{ type: 'paragraph', text: 'Problem body' }],
      lossy: false,
      ...(pdfContent ? { pdfContent } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  }
  return draft
}

function makeSpecAdBonusDraft(): DraftResponse {
  const draft = makeDraft()
  draft.bonusType = 'specAd'
  draft.bonus = {
    headline: 'Bonus headline',
    body: [{ type: 'paragraph', text: 'Bonus body' }],
    bodyLossy: false,
  }
  return draft
}

describe('SectionEditorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks the section dirty on edit, then clears dirty after a successful save (D-07)', async () => {
    ;(patchHeadline as ReturnType<typeof vi.fn>).mockResolvedValue({ revisionId: 'rev-2' })
    ;(patchSection as ReturnType<typeof vi.fn>).mockResolvedValue({ revisionId: 'rev-3' })

    const onDirtyChange = vi.fn()
    render(
      <SectionEditorPanel
        runId="run-1"
        selectedSection="originStory"
        draft={makeDraft()}
        onDirtyChange={onDirtyChange}
      />,
    )

    const headlineInput = screen.getByDisplayValue('Old headline')
    fireEvent.change(headlineInput, { target: { value: 'New headline' } })

    await waitFor(() => {
      const lastCall = onDirtyChange.mock.calls.at(-1)?.[0]
      expect(lastCall.originStory).toBe(true)
    })

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    expect(saveButton.hasAttribute('disabled')).toBe(false)
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(patchHeadline).toHaveBeenCalled()
      expect(patchSection).toHaveBeenCalled()
    })

    await waitFor(() => {
      const lastCall = onDirtyChange.mock.calls.at(-1)?.[0]
      expect(lastCall.originStory).toBe(false)
    })
  })

  it('shows a reload-and-reapply prompt on a revision_mismatch save error (D-10)', async () => {
    ;(patchHeadline as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ContentPatchError(409, 'revision_mismatch', 'This section changed since you loaded it.'),
    )

    render(<SectionEditorPanel runId="run-1" selectedSection="originStory" draft={makeDraft()} />)

    const headlineInput = screen.getByDisplayValue('Old headline')
    fireEvent.change(headlineInput, { target: { value: 'New headline' } })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reload and reapply/i })).toBeDefined()
    })
  })
})

// ── Plan 31-06 gap-closure tests ─────────────────────────────────────────────

describe('SectionEditorPanel — pdf prefill + dirty-gated saves', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefills working.pdf from draft.sections.problemStatement.pdfContent; missing pdfContent yields 3 blank rows', () => {
    const pdfContent = {
      problemStatement: 'Real PDF prose.',
      keyDataPoints: [
        { stat: '42%', source: 'GAO 2024' },
        { stat: '9,000', source: 'internal audit' },
        { stat: '$3.2M', source: 'IRS 990' },
      ],
      interventionMechanism: 'Direct cash transfer.',
    }

    render(
      <SectionEditorPanel
        runId="run-1"
        selectedSection="problemStatement"
        draft={makeDraftWithPdf(pdfContent)}
      />,
    )

    expect(screen.getByDisplayValue('Real PDF prose.')).toBeDefined()
    expect(screen.getByDisplayValue('Direct cash transfer.')).toBeDefined()
    expect(screen.getByLabelText('Key data point 1 stat')).toHaveProperty('value', '42%')
    expect(screen.getByLabelText('Key data point 1 source')).toHaveProperty('value', 'GAO 2024')

    cleanup()

    // No pdfContent on the draft -> 3 blank stat/source rows, not a crash.
    render(
      <SectionEditorPanel runId="run-1" selectedSection="problemStatement" draft={makeDraftWithPdf()} />,
    )
    expect(screen.getByLabelText('Key data point 1 stat')).toHaveProperty('value', '')
    expect(screen.getByLabelText('Key data point 2 stat')).toHaveProperty('value', '')
    expect(screen.getByLabelText('Key data point 3 stat')).toHaveProperty('value', '')
  })

  it('a prose-only problemStatement save does NOT call patchPdfDataPoints', async () => {
    ;(patchHeadline as ReturnType<typeof vi.fn>).mockResolvedValue({ revisionId: 'rev-2' })
    ;(patchSection as ReturnType<typeof vi.fn>).mockResolvedValue({ revisionId: 'rev-3' })

    render(
      <SectionEditorPanel runId="run-1" selectedSection="problemStatement" draft={makeDraftWithPdf()} />,
    )

    const headlineInput = screen.getByDisplayValue('Problem headline')
    fireEvent.change(headlineInput, { target: { value: 'New problem headline' } })

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(patchHeadline).toHaveBeenCalled()
      expect(patchSection).toHaveBeenCalled()
    })

    expect(patchPdfDataPoints).not.toHaveBeenCalled()
  })

  it('a problemStatement save with an edited pdf sub-state DOES call patchPdfDataPoints with the edited values', async () => {
    ;(patchHeadline as ReturnType<typeof vi.fn>).mockResolvedValue({ revisionId: 'rev-2' })
    ;(patchSection as ReturnType<typeof vi.fn>).mockResolvedValue({ revisionId: 'rev-3' })
    ;(patchPdfDataPoints as ReturnType<typeof vi.fn>).mockResolvedValue({ revisionId: 'rev-4' })

    render(
      <SectionEditorPanel runId="run-1" selectedSection="problemStatement" draft={makeDraftWithPdf()} />,
    )

    const pdfProblemStatementInput = screen.getByLabelText(/problem statement \(pdf\)/i)
    fireEvent.change(pdfProblemStatementInput, { target: { value: 'Edited PDF prose.' } })

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(patchPdfDataPoints).toHaveBeenCalled()
    })

    const call = (patchPdfDataPoints as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1]).toMatchObject({ problemStatement: 'Edited PDF prose.' })
  })
})

describe('SectionEditorPanel — specAd bonus payload contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a headline-only specAd bonus save sends variant + headline and NO blocks/body key', async () => {
    ;(patchBonus as ReturnType<typeof vi.fn>).mockResolvedValue({ revisionId: 'rev-2' })

    render(<SectionEditorPanel runId="run-1" selectedSection="bonus" draft={makeSpecAdBonusDraft()} />)

    const headlineInput = screen.getByDisplayValue('Bonus headline')
    fireEvent.change(headlineInput, { target: { value: 'New bonus headline' } })

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(patchBonus).toHaveBeenCalled()
    })

    const payload = (patchBonus as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(payload).toMatchObject({ variant: 'specAd', headline: 'New bonus headline' })
    expect('blocks' in payload).toBe(false)
    expect('body' in payload).toBe(false)
  })

  it('a specAd bonus save with an edited block body includes blocks in the payload', async () => {
    ;(patchBonus as ReturnType<typeof vi.fn>).mockResolvedValue({ revisionId: 'rev-2' })

    render(<SectionEditorPanel runId="run-1" selectedSection="bonus" draft={makeSpecAdBonusDraft()} />)

    fireEvent.click(screen.getByLabelText(/add block after 1/i))

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(patchBonus).toHaveBeenCalled()
    })

    const payload = (patchBonus as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(payload.variant).toBe('specAd')
    expect(Array.isArray(payload.blocks)).toBe(true)
    expect(payload.blocks.length).toBe(2)
  })
})
