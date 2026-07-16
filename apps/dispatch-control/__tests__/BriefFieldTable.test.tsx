/**
 * Phase 47 (BRF-05) — BriefFieldTable behavior tests.
 *
 * `BriefFieldTable` renders the six Brief fields (premise, currentPeg,
 * centralClaim, readerEffect, knownRisks, voiceIntention — read from
 * `ws.brief`, passed in as the `brief` prop) as an editable table. Editing a
 * field and saving calls `patchBrief(runId, field, value, token)` — the
 * guarded content boundary (Clerk -> `briefs:patch` -> `audit_log`, §47.5).
 *
 * `patch_brief` (api/brief.py) emits its audit row WITHOUT a `reason=`
 * kwarg — a content edit, not a reason-required decision — so it does NOT
 * project into the shared Decision log (`auditLog.ts::isDecisionRow`
 * requires a `reason`/`heldReason` key). A save instead surfaces an inline
 * "Saved." confirmation, never a silent no-op — the "nothing silent"
 * discipline applied at the UI level for a non-decision content edit.
 * (`BriefFieldStrengthen.tsx`, BRF-06, is the action that DOES carry a
 * reason and DOES surface in the shared Decision log.)
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/briefClient', () => ({
  patchBrief: vi.fn(async () => ({ resolution: 'brief_field_edited' })),
}))

import { patchBrief } from '@/lib/briefClient'
import { BriefFieldTable, type Brief } from '../app/(dashboard)/story-brief/_components/BriefFieldTable'

function baseBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    premise: 'A quiet food bank has quietly fed a third of the county for a decade.',
    currentPeg: 'Their annual harvest drive starts next Tuesday.',
    centralClaim: 'Unglamorous, reliable infrastructure deserves the same coverage as crisis.',
    readerEffect: 'The reader should feel quiet respect, not pity.',
    knownRisks: 'Founder has declined interviews before; confirm willingness first.',
    voiceIntention: 'Dry, precise, Fortune-500 register — no sentiment.',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BriefFieldTable (BRF-05)', () => {
  it('renders all six Brief fields: premise, currentPeg, centralClaim, readerEffect, knownRisks, voiceIntention', () => {
    render(<BriefFieldTable runId="run-1" brief={baseBrief()} />)

    expect(screen.getByText('Premise')).toBeDefined()
    expect(screen.getByText('Current peg')).toBeDefined()
    expect(screen.getByText('Central claim')).toBeDefined()
    expect(screen.getByText('Reader effect')).toBeDefined()
    expect(screen.getByText('Known risks')).toBeDefined()
    expect(screen.getByText('Voice intention')).toBeDefined()
  })

  it('renders each field value read from the brief prop (sourced from briefs:byRunId)', () => {
    const brief = baseBrief()
    render(<BriefFieldTable runId="run-1" brief={brief} />)

    expect((screen.getByTestId('brief-field-input-premise') as HTMLTextAreaElement).value).toBe(
      brief.premise,
    )
    expect(
      (screen.getByTestId('brief-field-input-currentPeg') as HTMLTextAreaElement).value,
    ).toBe(brief.currentPeg)
    expect(
      (screen.getByTestId('brief-field-input-voiceIntention') as HTMLTextAreaElement).value,
    ).toBe(brief.voiceIntention)
  })

  it('editing a field and saving calls patchBrief(runId, field, value, token)', async () => {
    render(<BriefFieldTable runId="run-1" brief={baseBrief()} />)

    const input = screen.getByTestId('brief-field-input-premise')
    fireEvent.change(input, { target: { value: 'A sharper premise.' } })

    const row = screen.getByTestId('brief-field-row-premise')
    fireEvent.click(row.querySelector('button') as HTMLButtonElement)

    await waitFor(() => {
      expect(patchBrief).toHaveBeenCalledWith('run-1', 'premise', 'A sharper premise.', 'tok-clerk')
    })
  })

  it('a successful edit surfaces an inline "Saved." confirmation, not a silent no-op', async () => {
    render(<BriefFieldTable runId="run-1" brief={baseBrief()} />)

    const input = screen.getByTestId('brief-field-input-currentPeg')
    fireEvent.change(input, { target: { value: 'A fresher peg.' } })

    const row = screen.getByTestId('brief-field-row-currentPeg')
    fireEvent.click(row.querySelector('button') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByTestId('brief-field-row-currentPeg').textContent).toContain('Saved.')
    })
  })

  it('the Save button stays disabled until the field value actually changes', () => {
    render(<BriefFieldTable runId="run-1" brief={baseBrief()} />)

    const row = screen.getByTestId('brief-field-row-premise')
    const saveButton = row.querySelector('button') as HTMLButtonElement
    expect(saveButton.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByTestId('brief-field-input-premise'), {
      target: { value: 'Changed.' },
    })
    expect(saveButton.hasAttribute('disabled')).toBe(false)
  })

  it('renders a loading state (no crash) while briefs:byRunId is still loading', () => {
    render(<BriefFieldTable runId="run-1" brief={undefined} />)
    expect(screen.getByText(/loading brief/i)).toBeDefined()
    expect(screen.queryByTestId('brief-field-table')).toBeNull()
  })

  it('renders gracefully (no crash) when briefs:byRunId has not yet produced a row for this run', () => {
    render(<BriefFieldTable runId="run-1" brief={null} />)
    expect(screen.getByText(/hasn.t been produced for this run yet/i)).toBeDefined()
    expect(screen.queryByTestId('brief-field-table')).toBeNull()
  })
})
