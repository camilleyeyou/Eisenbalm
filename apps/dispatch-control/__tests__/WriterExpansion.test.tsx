/**
 * Phase 37 (MON-03, Plan 37-04 Task 2) — WriterExpansion behavior tests.
 *
 * Covers:
 *   - One row per section writer (6 keys), each with a strength bar + flag
 *     counts + a re-run button.
 *   - A section with no findings shows 100/green.
 *   - The re-run button POSTs to /runs/{runId}/agents/{sectionName}/rerun
 *     via the existing `rerollAgent` client.
 *   - The re-run button is disabled while the run status is 'running'.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: { byRunId: 'qaCorrections:byRunId' },
  },
}))

vi.mock('@/lib/pipelineControlClient', () => ({
  rerollAgent: vi.fn(async () => ({ runId: 'run-1', agentKey: 'origin_story', rerolled: true })),
}))

import { rerollAgent } from '@/lib/pipelineControlClient'
import {
  WriterExpansion,
  WRITER_SECTIONS,
} from '../app/(dashboard)/run-monitor/graph/_components/WriterExpansion'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function mockRows(rows: Array<Record<string, unknown>>) {
  ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => rows)
}

describe('WriterExpansion (MON-03)', () => {
  it('renders one row per section writer with strength bar, score, and flag counts', () => {
    mockRows([])
    render(<WriterExpansion runId="run-1" runStatus="complete" />)

    for (const section of WRITER_SECTIONS) {
      expect(screen.getByTestId(`strength-bar-${section}`)).toBeDefined()
      expect(screen.getByTestId(`strength-score-${section}`)).toBeDefined()
      expect(screen.getByTestId(`flag-counts-${section}`)).toBeDefined()
    }
    // 6 re-run buttons — one per section.
    expect(screen.getAllByRole('button', { name: /re-run/i })).toHaveLength(
      WRITER_SECTIONS.length,
    )
  })

  it('shows 100/green for a section with no findings', () => {
    mockRows([])
    render(<WriterExpansion runId="run-1" runStatus="complete" />)

    const scoreEl = screen.getByTestId('strength-score-origin_story')
    expect(scoreEl.textContent).toBe('100')
    const barEl = screen.getByTestId('strength-bar-origin_story')
    expect(barEl.getAttribute('data-band')).toBe('green')
  })

  it('lowers the score and shows flag counts for a section with an open error', () => {
    mockRows([
      { sectionName: 'problem', severity: 'error', accepted: false },
    ])
    render(<WriterExpansion runId="run-1" runStatus="complete" />)

    expect(screen.getByTestId('strength-score-problem').textContent).toBe('75')
    expect(screen.getByTestId('strength-bar-problem').getAttribute('data-band')).toBe('amber')
    expect(screen.getByTestId('flag-counts-problem').textContent).toContain('E:1')
  })

  it('excludes closed findings from the score (accepted:true)', () => {
    mockRows([
      { sectionName: 'game', severity: 'error', accepted: true },
    ])
    render(<WriterExpansion runId="run-1" runStatus="complete" />)

    expect(screen.getByTestId('strength-score-game').textContent).toBe('100')
  })

  it('calls rerollAgent with the sectionName as agentKey when Re-run is clicked', async () => {
    mockRows([])
    render(<WriterExpansion runId="run-1" runStatus="complete" />)

    const buttons = screen.getAllByRole('button', { name: /re-run/i })
    // First button corresponds to WRITER_SECTIONS[0] === 'origin_story'.
    fireEvent.click(buttons[0])

    await waitFor(() => {
      expect(rerollAgent).toHaveBeenCalledWith('run-1', 'origin_story', 'tok-clerk')
    })
  })

  it('disables the re-run button while the run status is "running"', () => {
    mockRows([])
    render(<WriterExpansion runId="run-1" runStatus="running" />)

    const buttons = screen.getAllByRole('button', { name: /re-run/i })
    for (const button of buttons) {
      expect(button.hasAttribute('disabled')).toBe(true)
    }
  })
})
