/**
 * Phase 41 (WSP-04, Plan 41-03 Task 1) — ClaimMark focus-parity +
 * click-through tests.
 *
 * Net-new file (no ClaimMark.test.tsx existed before this plan — the leaf
 * component previously only had coverage indirectly via Galley.test.tsx).
 *
 * Covers:
 *   - Firing `focus` on the `<mark>` opens the source popover (role="dialog"),
 *     the hover-equivalent reveal for keyboard users (research Pattern 8);
 *     firing `blur` closes it.
 *   - A click-opened popover is NOT force-closed by an unrelated blur — click
 *     sets `open`, blur only clears `focusOpen`; the popover renders on
 *     `open || focusOpen`.
 *   - When `value.status === 'pending'` (unchecked) AND `onUnsourcedClaimClick`
 *     is provided, clicking the mark calls it with `value.claimIndex` instead
 *     of toggling the popover.
 *   - When `onUnsourcedClaimClick` is undefined, clicking preserves today's
 *     toggle-popover behavior.
 *   - A checked (status !== 'pending') claim click still toggles the popover
 *     even if the callback is provided — click-through is unsourced/unchecked
 *     only.
 *
 * Phase 42 (FCT-04, Plan 42-07 Task 1) adds coverage for the popover's
 * CONTENT: it must render the SAME shared `ClaimProvenanceCard` fed the real
 * (non-empty) `text`/`importance` threaded onto `ClaimSpanMarkDef` — the
 * checker-mandated guard against the "silently blank" failure mode.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// ── Module mocks (mirrors Galley.test.tsx's convex/react harness) ──────────

vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn()),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    claimChecks: {
      setStatus: 'claimChecks:setStatus',
    },
  },
}))

import ClaimMark from '../components/galley/ClaimMark'
import type { ClaimSpanMarkDef } from '@/lib/galley/syntheticPortableText'

const pendingValue: ClaimSpanMarkDef = {
  _type: 'claimSpan',
  _key: 'claim-1',
  claimIndex: 1,
  provenance: 'unsourced',
  status: 'pending',
  text: 'demand outpaces supply four to one',
}

const checkedValue: ClaimSpanMarkDef = {
  _type: 'claimSpan',
  _key: 'claim-2',
  claimIndex: 2,
  provenance: 'sourced',
  sourceUrl: 'https://example.org/source',
  retrievedAt: 1700000000000,
  status: 'checked',
  text: 'the founder started the charity in a garage in 1974',
  importance: 'Load-bearing',
  context: 'as documented by the founding trust records',
  sectionId: 'originStory',
}

function renderMark(value: ClaimSpanMarkDef, onUnsourcedClaimClick?: (claimIndex: number) => void) {
  render(
    <ClaimMark value={value} runId="run-1" onUnsourcedClaimClick={onUnsourcedClaimClick}>
      the claim text
    </ClaimMark>,
  )
}

function getMark() {
  return screen.getByRole('button', { name: /claim/i })
}

afterEach(() => {
  cleanup()
})

describe('ClaimMark focus-parity (WSP-04)', () => {
  it('opens the source popover on focus and closes it on blur', () => {
    renderMark(pendingValue)
    const mark = getMark()

    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.focus(mark)
    expect(screen.getByRole('dialog')).toBeDefined()

    fireEvent.blur(mark)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not force-close a click-opened popover on an unrelated blur', () => {
    renderMark(checkedValue)
    const mark = getMark()

    fireEvent.click(mark)
    expect(screen.getByRole('dialog')).toBeDefined()

    fireEvent.blur(mark)
    // click set `open`; blur only clears `focusOpen` — popover persists.
    expect(screen.getByRole('dialog')).toBeDefined()
  })
})

describe('ClaimMark click-through (WSP-04)', () => {
  it('calls onUnsourcedClaimClick with claimIndex for a pending claim, and does not toggle the popover', () => {
    const onUnsourcedClaimClick = vi.fn()
    renderMark(pendingValue, onUnsourcedClaimClick)
    const mark = getMark()

    fireEvent.click(mark)

    expect(onUnsourcedClaimClick).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('preserves toggle-popover behavior when onUnsourcedClaimClick is undefined', () => {
    renderMark(pendingValue)
    const mark = getMark()

    fireEvent.click(mark)
    expect(screen.getByRole('dialog')).toBeDefined()

    fireEvent.click(mark)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('still toggles the popover for a checked claim even when the callback is provided (click-through is unchecked-only)', () => {
    const onUnsourcedClaimClick = vi.fn()
    renderMark(checkedValue, onUnsourcedClaimClick)
    const mark = getMark()

    fireEvent.click(mark)

    expect(onUnsourcedClaimClick).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeDefined()
  })
})

describe('ClaimMark shared provenance card (FCT-04, Plan 42-07)', () => {
  it('renders the SAME shared ClaimProvenanceCard, fed the real (non-empty) claim text and importance tier -- never blank', () => {
    renderMark(checkedValue)
    const mark = getMark()

    fireEvent.click(mark)

    // The shared card (components/provenance/ClaimProvenanceCard.tsx) renders,
    // not a forked popover body.
    expect(screen.getByTestId('claim-provenance-card')).toBeDefined()
    // The checker-mandated guard: the exact threaded claim text and importance
    // tier reach the card -- not `text: ''`/`importance: undefined`.
    expect(screen.getByText(checkedValue.text)).toBeDefined()
    expect(screen.getByText('Load-bearing')).toBeDefined()
  })

  it('still renders a Skip control alongside the shared card (a Draft-only action outside the card\'s six-action set)', () => {
    renderMark(checkedValue)
    const mark = getMark()

    fireEvent.click(mark)

    expect(screen.getByRole('button', { name: 'Skip' })).toBeDefined()
  })
})

// ── Phase 51 (READ-02/READ-03, D-07/D-09, section-read-and-fix-in-place) ────
//
// Written before their implementations land (plan 51-01). Case 1 is
// intentionally RED today (ClaimMark's popover currently mounts the
// block-markup `ClaimProvenanceCard`, not a phrasing-safe variant); case 2
// is RED today (no `showAxisTag` prop exists yet).

describe('Phase 51 — phrasing-safe popover (Pitfall 1)', () => {
  it('the open claim popover contains no block-level elements', () => {
    // jsdom does NOT validate HTML content models (it will happily nest a
    // <div> inside a <span> with no parse error) — this structural assertion
    // is only a PROXY for DOM validity, not a proof of it. The real check is
    // manual: open a claim popover in Chrome DevTools and confirm no <p>
    // auto-close/reparent occurs in the rendered tree (51-VALIDATION.md
    // Manual-Only Verifications row 3).
    const { container } = render(
      <ClaimMark value={checkedValue} runId="run-1">
        the claim text
      </ClaimMark>,
    )
    fireEvent.click(getMark())

    const popover = container.querySelector('.galley-popover')
    expect(popover).not.toBeNull()
    expect(popover!.querySelector('div')).toBeNull()
    expect(popover!.querySelector('p')).toBeNull()
    expect(popover!.querySelector('h3')).toBeNull()
  })

  it('Source tag renders for an unsourced claim only when showAxisTag is set', () => {
    render(
      <ClaimMark value={pendingValue} runId="run-1" showAxisTag>
        the claim text
      </ClaimMark>,
    )
    expect(screen.getByText('Source')).toBeDefined()
    cleanup()

    render(
      <ClaimMark value={checkedValue} runId="run-1" showAxisTag>
        the claim text
      </ClaimMark>,
    )
    expect(screen.queryByText('Source')).toBeNull()
    cleanup()

    render(
      <ClaimMark value={pendingValue} runId="run-1">
        the claim text
      </ClaimMark>,
    )
    expect(screen.queryByText('Source')).toBeNull()
  })
})
