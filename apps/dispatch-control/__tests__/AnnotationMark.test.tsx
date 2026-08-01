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
 * Phase 36 (VOX-02, D-10, Plan 36-06 Task 1) adds a voice-tell label variant
 * (below, second describe block):
 *   - An explicit `labels` prop renders custom button text (Accept rewrite /
 *     Write my own / Keep (not a tell)) instead of the Review Desk defaults.
 *   - Accept rewrite on a finding WITH a stored suggestedFix uses it as-is
 *     (no on-demand rewrite call; suggestedFixOverride stays undefined).
 *   - Accept rewrite on a finding with NO suggestedFix first calls
 *     voicePassClient.rewrite, then applies the result via
 *     suggestedFixOverride.
 *   - "Keep (not a tell)" prefills the dismiss reason from
 *     labels.dismissReasonDefault and submits it unchanged.
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

vi.mock('@/lib/voicePassClient', () => ({
  rewrite: vi.fn(async () => ({ findingId: 'f1', suggestedFix: 'Rewritten in house voice.' })),
}))

import { acceptFinding, dismissFinding, FindingsError } from '@/lib/findingsClient'
import { rewrite } from '@/lib/voicePassClient'
import AnnotationMark, {
  type AnnotationMarkDef,
} from '../components/galley/AnnotationMark'
// Phase 51 (READ-03, D-20) — the shared claim shape the evidence card will be
// fed once it mounts inside this popover (plan 51-07). Imported here purely
// for fixture typing; AnnotationMark does not accept a `claim` prop yet.
import type { ClaimProvenanceView } from '@/components/provenance/ClaimProvenanceCard'

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

const VOICE_LABELS = {
  accept: 'Accept rewrite',
  editInline: 'Write my own',
  dismiss: 'Keep (not a tell)',
  dismissReasonDefault: 'not a tell',
}

beforeEach(() => {
  vi.mocked(acceptFinding).mockClear()
  vi.mocked(dismissFinding).mockClear()
  vi.mocked(rewrite).mockClear()
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

  it('renders no Inspect action when onInspect is absent (Phase 44, INS-01)', () => {
    renderMark()
    openPopover()

    expect(screen.queryByRole('button', { name: /inspect how this was made/i })).toBeNull()
  })

  it('renders Inspect how this was made when onInspect is provided, and clicking it calls onInspect(sectionId)', () => {
    const onInspect = vi.fn()
    renderMark({}, { onInspect })
    openPopover()

    const inspectButton = screen.getByRole('button', { name: /inspect how this was made/i })
    fireEvent.click(inspectButton)

    expect(onInspect).toHaveBeenCalledWith('originStory')
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

describe('AnnotationMark voice-tell variant (VOX-02, D-10)', () => {
  it('renders custom voice labels when an explicit labels prop is provided', () => {
    renderMark({}, { labels: VOICE_LABELS })
    openPopover()

    expect(screen.getByRole('button', { name: /accept rewrite/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /write my own/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /keep \(not a tell\)/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /^accept fix$/i })).toBeNull()
  })

  it('Accept rewrite on a finding WITH a stored suggestedFix uses it as-is (no on-demand rewrite call)', async () => {
    renderMark({}, { labels: VOICE_LABELS })
    openPopover()

    fireEvent.click(screen.getByRole('button', { name: /accept rewrite/i }))

    await waitFor(() => {
      expect(acceptFinding).toHaveBeenCalledWith(
        'run-1',
        'f1',
        { ifRevisionID: 'rev-1', suggestedFixOverride: undefined },
        'tok-clerk',
      )
    })
    expect(rewrite).not.toHaveBeenCalled()
  })

  it('Accept rewrite on a finding with NO suggestedFix calls voice-rewrite then accepts with suggestedFixOverride', async () => {
    renderMark({ suggestedFix: undefined }, { labels: VOICE_LABELS })
    openPopover()

    // No stored fix and no diff panel — Accept still renders (rewrite-on-demand
    // covers it) and the "no suggested fix" message never shows in this variant.
    expect(screen.queryByText(/accept unavailable/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /accept rewrite/i }))

    await waitFor(() => {
      expect(rewrite).toHaveBeenCalledWith('run-1', 'f1', 'tok-clerk')
      expect(acceptFinding).toHaveBeenCalledWith(
        'run-1',
        'f1',
        { ifRevisionID: 'rev-1', suggestedFixOverride: 'Rewritten in house voice.' },
        'tok-clerk',
      )
    })
  })

  it('relabels the "Suggested:" line to "Suggested house voice:" in the voice variant', () => {
    renderMark({}, { labels: VOICE_LABELS })
    openPopover()

    expect(screen.getByText(/suggested house voice:/i)).toBeDefined()
  })

  it('"Keep (not a tell)" prefills the dismiss reason from dismissReasonDefault and submits it unchanged', async () => {
    renderMark({}, { labels: VOICE_LABELS })
    openPopover()

    fireEvent.click(screen.getByRole('button', { name: /keep \(not a tell\)/i }))

    const input = screen.getByLabelText(/dismissal reason/i) as HTMLInputElement
    expect(input.value).toBe('not a tell')

    fireEvent.click(screen.getByRole('button', { name: /confirm dismiss/i }))

    await waitFor(() => {
      expect(dismissFinding).toHaveBeenCalledWith(
        'run-1',
        'f1',
        { reason: 'not a tell' },
        'tok-clerk',
      )
    })
  })
})

// ── Phase 51 (READ-01..08, section-read-and-fix-in-place) — Wave 0 scaffolds ──
//
// The three describe blocks below are written BEFORE their implementations
// land (plans 51-01 and 51-07). Per 51-VALIDATION.md, some cases here are
// intentionally RED today and turn GREEN once the referenced plan ships; the
// Voice Pass regression case is the opposite — it documents CURRENT behavior
// and must stay GREEN throughout, proving the coming fix doesn't break it.

/** A finding with a warning severity, so it doesn't collide with the base
 * `value` fixture's 'error' severity aria-label used by `openPopover()`
 * above. `suggestedFix` is explicitly `undefined` (not merely absent) — the
 * spread in `renderMark` (`{ ...value, ...overrides }`) only overwrites keys
 * PRESENT in `overrides`, so an absent key would silently leak the base
 * fixture's `suggestedFix` through. That is the whole point of this fixture
 * (Pitfall 2): no stored suggestedFix. */
const pitfall2Value: AnnotationMarkDef = {
  findingId: 'v1',
  severity: 'warning',
  axis: 'machine-tell',
  reason: 'Machine tell.',
  suggestedFix: undefined,
  quotedSpan: 'in a garage',
}

function openWarningPopover() {
  fireEvent.click(screen.getByRole('button', { name: /qa warning finding/i }))
}

describe('Phase 51 — label-independent accept trigger (Pitfall 2)', () => {
  it('Voice Pass regression: Accept rewrite label still offers Accept with no stored suggestedFix', () => {
    // GREEN BEFORE 51-01 — this is the regression guard for Phase 36's
    // existing string-matched isRewriteVariant, not a new feature.
    renderMark(pitfall2Value, {
      labels: { accept: 'Accept rewrite', editInline: 'Write my own', dismiss: 'Keep (not a tell)' },
    })
    openWarningPopover()

    expect(screen.getByRole('button', { name: 'Accept rewrite' })).toBeDefined()
    expect(screen.queryByText(/Accept unavailable/)).toBeNull()
  })

  it('neutral label plus generateFixOnAccept still offers Accept with no stored suggestedFix', () => {
    // RED until plan 51-01 Task 3 threads a label-independent trigger.
    renderMark(
      pitfall2Value,
      {
        labels: { accept: 'Accept suggestion', editInline: 'Edit myself', dismiss: 'Dismiss' },
        generateFixOnAccept: true,
      },
    )
    openWarningPopover()

    expect(screen.getByRole('button', { name: 'Accept suggestion' })).toBeDefined()
    expect(screen.queryByText(/Accept unavailable/)).toBeNull()
  })

  it('neutral label without generateFixOnAccept keeps the Review Desk unavailable message', () => {
    renderMark(pitfall2Value, { labels: { accept: 'Accept suggestion' } })
    openWarningPopover()

    expect(screen.getByText('Accept unavailable — no suggested fix.')).toBeDefined()
  })
})

describe('Phase 51 — Fact/Voice tag (READ-02, D-07)', () => {
  // The tag must be assertable WITHOUT opening the popover — every assertion
  // below runs immediately after render, never after a click. That is
  // literally what READ-02 requires ("readable without opening the popover").

  it('showAxisTag with a FACTUAL_AXES axis renders "Fact"', () => {
    renderMark({ axis: 'precision' }, { showAxisTag: true })
    expect(screen.getByText('Fact')).toBeDefined()
  })

  it('showAxisTag with a VOICE_AXES axis renders "Voice"', () => {
    renderMark({ axis: 'machine-tell' }, { showAxisTag: true })
    expect(screen.getByText('Voice')).toBeDefined()
  })

  it('showAxisTag with axis undefined renders "Fact" (conservative default)', () => {
    renderMark({ axis: undefined }, { showAxisTag: true })
    expect(screen.getByText('Fact')).toBeDefined()
  })

  it('no showAxisTag renders neither Fact nor Voice', () => {
    renderMark({ axis: 'precision' })
    expect(screen.queryByText('Fact')).toBeNull()
    expect(screen.queryByText('Voice')).toBeNull()
  })
})

describe('Phase 51 — evidence in the finding popover (READ-03, D-20)', () => {
  const claim: ClaimProvenanceView = {
    text: 'Demand outpaces supply four to one.',
    importance: 'Load-bearing',
    status: 'checked',
    sourceUrl: 'https://example.org/report',
    supportingPassage: 'as documented by the founding trust records',
    retrievedAt: 1751328000000,
    sectionName: 'originStory',
  }

  function renderMarkForEvidence(
    overrides: Partial<AnnotationMarkDef> = {},
    props: Record<string, unknown> = {},
  ) {
    const reloadDraft = vi.fn(async () => {})
    const onEditSection = vi.fn()
    return render(
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
  }

  it('renders the claim provenance card beneath the reason when the finding links to a claim', () => {
    // RED until plan 51-07 mounts the evidence card in this popover.
    const { container } = renderMarkForEvidence({}, { claim })
    openPopover()

    expect(screen.getByText(value.reason)).toBeDefined()
    expect(container.textContent).toContain(claim.text)
    expect(container.textContent).toContain(claim.sourceUrl as string)
  })

  it('renders no card when no claim is supplied', () => {
    const { container } = renderMarkForEvidence()
    openPopover()

    expect(screen.getByText(value.reason)).toBeDefined()
    expect(container.textContent).not.toContain(claim.text)
  })

  it('the evidence card inside the popover contains no block-level elements (phrasingSafe, Pitfall 1)', () => {
    const { container } = renderMarkForEvidence({}, { claim })
    openPopover()

    const popover = container.querySelector('.galley-popover')
    expect(popover).not.toBeNull()
    expect(popover!.querySelector('div')).toBeNull()
    expect(popover!.querySelector('p')).toBeNull()
    expect(popover!.querySelector('h3')).toBeNull()
  })
})
