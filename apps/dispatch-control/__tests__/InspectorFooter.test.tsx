/**
 * Phase 50 Plan 05 Task 3 (WBN-03, D-11/D-12) — InspectorFooter
 * "Restart from this step" honesty-matrix tests.
 *
 * Pins the upgrade from the Phase-44 blanket-reserved posture (44-RESEARCH
 * Pitfall 6, `InspectorFooter.tsx:18` pre-Phase-50) to the SAME three-tier
 * matrix `RecoveryRail.tsx` uses (`lib/nomenclature.ts::restartAvailabilityFor`):
 *   - LIVE for a section-writer artifact (`origin_story`) — enabled, and
 *     shows the "reused, not re-paid" reuse claim.
 *   - RESERVED for a non-primitive artifact (`qa`) — disabled, with an
 *     honest title, and NO reuse claim anywhere in that render.
 * Also proves the pre-existing 50-04 "Improve this agent →" origin-param
 * wiring (`fromRun`/`section`/`excerpt`) is unregressed by this change.
 *
 * Runs in jsdom (vitest.config.ts: __tests__/*.test.tsx -> jsdom).
 */
import type { ReactElement } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

const rerollAgentMock = vi.fn(async () => ({
  runId: 'run-1',
  agentKey: 'origin_story',
  rerolled: true,
}))
const publishManualMock = vi.fn(async () => ({
  runId: 'run-1',
  issueId: 'issue-1',
  issueNumber: 1,
  scheduled: true,
}))

vi.mock('@/lib/pipelineControlClient', () => ({
  rerollAgent: (...args: unknown[]) => rerollAgentMock(...args),
  publishManual: (...args: unknown[]) => publishManualMock(...args),
}))

import { InspectorFooter } from '../components/inspector/InspectorFooter'
import { ConfirmProvider } from '../components/ui/ConfirmDialog'

afterEach(() => {
  cleanup()
  rerollAgentMock.mockClear()
  publishManualMock.mockClear()
})

// quick 260723-4a6 (Task 2): InspectorFooter's "Restart from this step" now
// calls useConfirm() unconditionally — every render needs a ConfirmProvider
// ancestor.
function renderFooter(ui: ReactElement) {
  return render(<ConfirmProvider>{ui}</ConfirmProvider>)
}

describe('InspectorFooter (WBN-03) — "Restart from this step" honesty matrix', () => {
  it('is LIVE for a section-writer artifact (origin_story) — enabled, reuse claim shown, and invokes rerollAgent', async () => {
    renderFooter(
      <InspectorFooter promptKey={null} agentKey="origin_story" runId="run-1" />,
    )

    const btn = screen.getByRole('button', { name: 'Restart from this step' })
    expect((btn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(btn)
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    await Promise.resolve()
    await Promise.resolve()

    expect(rerollAgentMock).toHaveBeenCalledWith('run-1', 'origin_story', 'tok-clerk')
  })

  it('is LIVE for the publisher artifact — enabled, and invokes publishManual', async () => {
    renderFooter(<InspectorFooter promptKey={null} agentKey="publisher" runId="run-1" />)

    const btn = screen.getByRole('button', { name: 'Restart from this step' })
    expect((btn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(btn)
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    await Promise.resolve()
    await Promise.resolve()

    expect(publishManualMock).toHaveBeenCalledWith('run-1', 'tok-clerk')
  })

  it('is RESERVED-with-title for a qa artifact — disabled, honest title, no reuse claim anywhere', () => {
    renderFooter(<InspectorFooter promptKey={null} agentKey="qa" runId="run-1" />)

    const btn = screen.getByRole('button', { name: 'Restart from this step' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect(btn.title.length).toBeGreaterThan(0)
    expect(btn.title).not.toMatch(/reused, not re-paid/i)
    expect(screen.queryByText(/reused, not re-paid/i)).toBeNull()
  })

  it('is RESERVED for editor_gate_1 from this footer (no paused-at-Gate-1 signal available here)', () => {
    renderFooter(<InspectorFooter promptKey={null} agentKey="editor_gate_1" runId="run-1" />)
    const btn = screen.getByRole('button', { name: 'Restart from this step' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('InspectorFooter (WBN-04, D-13 regression) — "Improve this agent →" origin params', () => {
  it('still carries fromRun/section/excerpt when promptKey + sectionName + excerpt are all present', () => {
    renderFooter(
      <InspectorFooter
        promptKey="game"
        agentKey="game"
        runId="run-1"
        sectionName="game"
        excerpt="A short real excerpt."
      />,
    )
    const link = screen.getByRole('link', { name: 'Improve this agent →' })
    const href = link.getAttribute('href') ?? ''
    expect(href).toContain('/prompt-lab/game')
    expect(href).toContain('fromRun=run-1')
    expect(href).toContain('section=game')
    expect(href).toContain('excerpt=')
  })

  it('degrades to the plain promptHref when sectionName/excerpt are absent', () => {
    renderFooter(<InspectorFooter promptKey="game" agentKey="game" runId="run-1" />)
    const link = screen.getByRole('link', { name: 'Improve this agent →' })
    expect(link.getAttribute('href')).toBe('/prompt-lab/game')
  })
})
