/**
 * Phase 47 (BRF-06) — BriefFieldStrengthen behavior tests.
 *
 * "Ask an agent to strengthen" a single Brief field: clicking the button
 * calls `strengthenBriefFieldPreview` (read-only, no mutation), the
 * proposal renders via the shared `RevisionComparisonCard`, Apply calls
 * `strengthenBriefFieldApply` (writes the field via `briefs:patch` +
 * `audit_log`), and Discard leaves the field unchanged (no apply call).
 *
 * quick 260722-v01 (audit item 6): `BriefFieldStrengthen` no longer mounts
 * its own `<DecisionLog>` — StoryBriefScreen.tsx now mounts exactly ONE
 * consolidated Decision log for the whole Story stage. A successful Apply's
 * reasoned audit row still surfaces there (StoryBriefScreen-level, not this
 * component's concern); this file's assertions are scoped to the
 * preview/apply/discard behavior only.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, afterEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/briefClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/briefClient')>('@/lib/briefClient')
  return {
    ...actual,
    strengthenBriefFieldPreview: vi.fn(async () => ({
      proposedText: 'A sharper, more concrete premise.',
      whatChanged: 'Tightened the opening line and cut the hedge word.',
    })),
    strengthenBriefFieldApply: vi.fn(async () => ({ resolution: 'brief_field_strengthened' })),
  }
})

import { strengthenBriefFieldPreview, strengthenBriefFieldApply } from '@/lib/briefClient'
import { BriefFieldStrengthen } from '../app/(dashboard)/story-brief/_components/BriefFieldStrengthen'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BriefFieldStrengthen (BRF-06)', () => {
  it('clicking "Ask an agent to strengthen" calls the field-scoped strengthen/preview client (read-only, no mutation)', async () => {
    render(<BriefFieldStrengthen runId="run-1" field="premise" currentValue="A quiet food bank." />)

    fireEvent.click(screen.getByRole('button', { name: /ask an agent to strengthen/i }))

    await waitFor(() => {
      expect(strengthenBriefFieldPreview).toHaveBeenCalledWith(
        'run-1',
        'premise',
        'A quiet food bank.',
        'tok-clerk',
      )
    })
    expect(strengthenBriefFieldApply).not.toHaveBeenCalled()
  })

  it('renders the preview (proposedText + whatChanged) without writing anything', async () => {
    render(<BriefFieldStrengthen runId="run-1" field="premise" currentValue="A quiet food bank." />)

    fireEvent.click(screen.getByRole('button', { name: /ask an agent to strengthen/i }))

    await waitFor(() => {
      expect(screen.getByText('A sharper, more concrete premise.')).toBeDefined()
    })
    expect(screen.getByText(/tightened the opening line/i)).toBeDefined()
    expect(strengthenBriefFieldApply).not.toHaveBeenCalled()
  })

  it('Apply calls the field-scoped strengthen/apply client and writes the field via briefs:patch', async () => {
    render(<BriefFieldStrengthen runId="run-1" field="premise" currentValue="A quiet food bank." />)

    fireEvent.click(screen.getByRole('button', { name: /ask an agent to strengthen/i }))
    await waitFor(() => screen.getByText('A sharper, more concrete premise.'))

    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))

    await waitFor(() => {
      expect(strengthenBriefFieldApply).toHaveBeenCalledWith(
        'run-1',
        'premise',
        'A sharper, more concrete premise.',
        'tok-clerk',
      )
    })
  })

  it('a successful Apply resolves (resolution: "brief_field_strengthened") and signals onApplied', async () => {
    const onApplied = vi.fn()
    render(
      <BriefFieldStrengthen
        runId="run-1"
        field="premise"
        currentValue="A quiet food bank."
        onApplied={onApplied}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /ask an agent to strengthen/i }))
    await waitFor(() => screen.getByText('A sharper, more concrete premise.'))

    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))

    await waitFor(() => {
      expect(strengthenBriefFieldApply).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(onApplied).toHaveBeenCalled()
    })

    // Apply clears the preview back to the "Ask an agent" idle state — the
    // reasoned audit row now surfaces one level up, in StoryBriefScreen's
    // consolidated Decision log, not inside this component.
    expect(screen.queryByText('A sharper, more concrete premise.')).toBeNull()
  })

  it('Discard/cancel leaves the Brief field unchanged', async () => {
    render(<BriefFieldStrengthen runId="run-1" field="premise" currentValue="A quiet food bank." />)

    fireEvent.click(screen.getByRole('button', { name: /ask an agent to strengthen/i }))
    await waitFor(() => screen.getByText('A sharper, more concrete premise.'))

    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }))

    expect(screen.queryByText('A sharper, more concrete premise.')).toBeNull()
    expect(screen.getByRole('button', { name: /ask an agent to strengthen/i })).toBeDefined()
    expect(strengthenBriefFieldApply).not.toHaveBeenCalled()
  })

  it('a failed strengthen/preview call surfaces an error message, not a silent failure', async () => {
    ;(strengthenBriefFieldPreview as unknown as Mock).mockRejectedValueOnce(
      new Error('HTTP 500'),
    )

    render(<BriefFieldStrengthen runId="run-1" field="premise" currentValue="A quiet food bank." />)
    fireEvent.click(screen.getByRole('button', { name: /ask an agent to strengthen/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('HTTP 500')
    })
  })
})
