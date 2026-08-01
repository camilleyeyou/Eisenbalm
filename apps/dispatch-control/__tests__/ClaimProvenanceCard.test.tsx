/**
 * Phase 42 Plan 42-06 Task 1 (FCT-04, D-08/D-09/D-10/D-11) — the shared
 * ClaimProvenanceCard tests.
 *
 * Locks down the never-blank guarantees, the D-08 chip vocabulary (label +
 * icon, never color alone), the two exported field-sourcing pure helpers
 * (`deriveSourcePublisher`/`deriveClaimAgent`, reused verbatim by Plan
 * 42-07), and that all six actions + Open source + Inspect render as
 * isolated, never-hidden controls.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ClaimProvenanceCard, {
  deriveSourcePublisher,
  deriveClaimAgent,
  deriveClaimChipState,
  type ClaimProvenanceView,
} from '../components/provenance/ClaimProvenanceCard'

afterEach(() => {
  cleanup()
})

const BASE_CLAIM: ClaimProvenanceView = {
  text: 'Demand outpaces supply four to one.',
  status: 'pending',
}

describe('deriveSourcePublisher (pure, D-10)', () => {
  it('derives a known publisher from a curated host map', () => {
    expect(deriveSourcePublisher('https://www.postandcourier.com/some/article')).toBe(
      'Post and Courier',
    )
  })

  it('falls back to the bare host for an unknown outlet', () => {
    expect(deriveSourcePublisher('https://example.org/story')).toBe('example.org')
  })

  it('returns "Unsourced" (never blank) when sourceUrl is absent', () => {
    expect(deriveSourcePublisher(undefined)).toBe('Unsourced')
  })

  it('returns "Unsourced" (never a crash) on an unparsable URL', () => {
    expect(deriveSourcePublisher('not a url')).toBe('Unsourced')
  })
})

describe('deriveClaimAgent (pure, D-10, Pattern 5 reuse)', () => {
  it('derives "Problem Writer" from the problemStatement galley section', () => {
    expect(deriveClaimAgent('problemStatement')).toBe('Problem Writer')
  })

  it('derives "Origin Story Writer" from originStory', () => {
    expect(deriveClaimAgent('originStory')).toBe('Origin Story Writer')
  })

  it('derives "Founder Bio Writer" from founderBio', () => {
    expect(deriveClaimAgent('founderBio')).toBe('Founder Bio Writer')
  })

  it('derives "Case Study Writer" from caseStudy', () => {
    expect(deriveClaimAgent('caseStudy')).toBe('Case Study Writer')
  })

  it('derives "Bonus Writer" from bonus', () => {
    expect(deriveClaimAgent('bonus')).toBe('Bonus Writer')
  })

  it('returns "—" (never a guess) for an absent sectionName', () => {
    expect(deriveClaimAgent(undefined)).toBe('—')
  })

  it('returns "—" for an unknown/non-writer sectionName', () => {
    expect(deriveClaimAgent('game')).toBe('—')
  })
})

describe('deriveClaimChipState (D-08 — 5-state vocabulary, reused by the Stage 3 table)', () => {
  it('a pending Load-bearing unsourced claim is "must-fix"', () => {
    expect(
      deriveClaimChipState({ text: 'x', status: 'pending', importance: 'Load-bearing' }),
    ).toBe('must-fix')
  })

  it('a pending unsourced Supporting claim is "review-recommended"', () => {
    expect(
      deriveClaimChipState({ text: 'x', status: 'pending', importance: 'Supporting' }),
    ).toBe('review-recommended')
  })

  it('a pending sourced claim (any importance) is "unchecked"', () => {
    expect(
      deriveClaimChipState({
        text: 'x',
        status: 'pending',
        importance: 'Load-bearing',
        sourceUrl: 'https://example.org',
      }),
    ).toBe('unchecked')
  })

  it('a non-pending claim is "checked"', () => {
    expect(deriveClaimChipState({ text: 'x', status: 'checked' })).toBe('checked')
  })

  it('changedSinceCheck overrides everything else as "changed"', () => {
    expect(
      deriveClaimChipState({
        text: 'x',
        status: 'pending',
        importance: 'Load-bearing',
        changedSinceCheck: true,
      }),
    ).toBe('changed')
  })
})

describe('ClaimProvenanceCard — never-blank field rendering', () => {
  it('renders "Unsourced" (not blank) when sourceUrl is absent', () => {
    render(<ClaimProvenanceCard claim={BASE_CLAIM} />)
    expect(screen.getByText('Unsourced')).toBeDefined()
  })

  it('renders "—" for confidence (never blank, never invented — §42.6)', () => {
    render(<ClaimProvenanceCard claim={BASE_CLAIM} />)
    expect(screen.getByText('—', { selector: 'span.normal-case' })).toBeDefined()
  })

  it('renders "Supporting" for a legacy row with importance undefined (D-03, never blank)', () => {
    render(<ClaimProvenanceCard claim={BASE_CLAIM} />)
    expect(screen.getByText('Supporting')).toBeDefined()
  })

  it('renders "—" for agent when sectionName is absent (never a guess)', () => {
    render(<ClaimProvenanceCard claim={BASE_CLAIM} />)
    const agentHeading = screen.getByText('Agent')
    expect(agentHeading.nextElementSibling?.textContent).toBe('—')
  })

  it('renders the claim text', () => {
    render(<ClaimProvenanceCard claim={BASE_CLAIM} />)
    expect(screen.getByText(BASE_CLAIM.text)).toBeDefined()
  })

  it('renders the D-08 chip label text for a must-fix claim (never color alone)', () => {
    render(
      <ClaimProvenanceCard
        claim={{ ...BASE_CLAIM, importance: 'Load-bearing' }}
      />,
    )
    expect(screen.getByText(/Must fix/)).toBeDefined()
  })
})

describe('ClaimProvenanceCard — six actions + Open source + Inspect (D-11, none hidden)', () => {
  it('renders all eight action controls even with no actions/handlers wired', () => {
    render(<ClaimProvenanceCard claim={BASE_CLAIM} />)
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Edit claim' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Replace source' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Ask agent for better evidence' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Remove claim' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Keep as written' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Open source' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeDefined()
  })

  it('Confirm calls onConfirm', () => {
    const onConfirm = vi.fn()
    render(<ClaimProvenanceCard claim={BASE_CLAIM} actions={{ onConfirm }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('Ask agent for better evidence calls onAskAgent', () => {
    const onAskAgent = vi.fn()
    render(<ClaimProvenanceCard claim={BASE_CLAIM} actions={{ onAskAgent }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask agent for better evidence' }))
    expect(onAskAgent).toHaveBeenCalledOnce()
  })

  it('Keep as written reveals a reason input and calls onKeep with the trimmed reason', () => {
    const onKeep = vi.fn()
    render(<ClaimProvenanceCard claim={BASE_CLAIM} actions={{ onKeep }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep as written' }))
    fireEvent.change(screen.getByLabelText('Reason for keeping as written'), {
      target: { value: '  already sourced elsewhere  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm keep' }))
    expect(onKeep).toHaveBeenCalledWith('already sourced elsewhere')
  })

  it('Confirm keep stays disabled until a non-empty reason is entered', () => {
    const onKeep = vi.fn()
    render(<ClaimProvenanceCard claim={BASE_CLAIM} actions={{ onKeep }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep as written' }))
    expect(screen.getByRole('button', { name: 'Confirm keep' })).toHaveProperty('disabled', true)
  })

  it('Replace source reveals a URL input and calls onReplaceSource', () => {
    const onReplaceSource = vi.fn()
    render(<ClaimProvenanceCard claim={BASE_CLAIM} actions={{ onReplaceSource }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Replace source' }))
    fireEvent.change(screen.getByLabelText('Replacement source URL'), {
      target: { value: 'https://www.postandcourier.com/x' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm replace' }))
    expect(onReplaceSource).toHaveBeenCalledWith('https://www.postandcourier.com/x')
  })

  it('Edit claim reveals a textarea pre-filled with the claim text and calls onEdit', () => {
    const onEdit = vi.fn()
    render(<ClaimProvenanceCard claim={BASE_CLAIM} actions={{ onEdit }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit claim' }))
    const textarea = screen.getByLabelText('Edit claim text') as HTMLTextAreaElement
    expect(textarea.value).toBe(BASE_CLAIM.text)
    fireEvent.change(textarea, { target: { value: 'A revised claim.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }))
    expect(onEdit).toHaveBeenCalledWith('A revised claim.')
  })

  it('Remove claim allows an empty (optional) reason and calls onRemove(undefined)', () => {
    const onRemove = vi.fn()
    render(<ClaimProvenanceCard claim={BASE_CLAIM} actions={{ onRemove }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove claim' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }))
    expect(onRemove).toHaveBeenCalledWith(undefined)
  })

  it('Open source is a disabled control (never hidden) when sourceUrl is absent', () => {
    render(<ClaimProvenanceCard claim={BASE_CLAIM} />)
    const openSource = screen.getByRole('button', { name: 'Open source' })
    expect(openSource).toHaveProperty('disabled', true)
  })

  it('Open source is a real link when sourceUrl is present', () => {
    render(<ClaimProvenanceCard claim={{ ...BASE_CLAIM, sourceUrl: 'https://example.org/a' }} />)
    const openSource = screen.getByRole('link', { name: 'Open source' })
    expect(openSource.getAttribute('href')).toBe('https://example.org/a')
  })
})

// ── Phase 51 (READ-03, D-20, Pitfall 1, section-read-and-fix-in-place) ──────
//
// Written before its implementation lands (plan 51-01 Task 2). This card's
// current markup returns nested block-level <div>/<p>/<h3> elements
// throughout, so it cannot legally mount inside AnnotationMark's popover
// (which renders as phrasing content only, inside the galley's <p>
// elements — 51-UI-SPEC.md "Popover Evidence Rendering"). RED until then.

describe('Phase 51 — phrasingSafe mode', () => {
  it('phrasingSafe renders no div, p, h3, ul or li', () => {
    const { container } = render(<ClaimProvenanceCard claim={BASE_CLAIM} phrasingSafe />)
    expect(container.querySelector('div')).toBeNull()
    expect(container.querySelector('p')).toBeNull()
    expect(container.querySelector('h3')).toBeNull()
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelector('li')).toBeNull()
  })

  it('default mode is unchanged', () => {
    // GREEN before AND after 51-01 — proves the default branch keeps
    // today's block markup byte-for-byte (Stage 3 Fact Check / Approval
    // callers are unaffected by the new phrasingSafe mode).
    const { container } = render(<ClaimProvenanceCard claim={BASE_CLAIM} />)
    expect(container.querySelector('div')).not.toBeNull()
  })
})
