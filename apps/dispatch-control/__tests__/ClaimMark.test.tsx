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
}

const checkedValue: ClaimSpanMarkDef = {
  _type: 'claimSpan',
  _key: 'claim-2',
  claimIndex: 2,
  provenance: 'sourced',
  sourceUrl: 'https://example.org/source',
  retrievedAt: 1700000000000,
  status: 'checked',
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
