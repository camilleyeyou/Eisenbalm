/**
 * Phase 43 — Plan 43-06 (TSK-06, D-08/D-09/D-12). RED component test for the
 * PURE `DecisionLogRows` render function — reason-first layout, actor-as-name
 * resolution (the row NEVER shows a bare Clerk sub / raw system id — the
 * component only knows the resolved name, injected via `resolveActor`, mirrors
 * how §43.4 splits resolution: human via `users.byClerkUserId`, system/agent
 * via a static map — both collapse to the SAME `resolveActor(actorId): string`
 * seam this pure function consumes), and legacy after-JSON reason tolerance
 * (§43.3's `heldReason` fallback, mirrored client-side by `reasonOf`).
 *
 * `DecisionLog.tsx` does not exist yet — this file is RED until Task 2.
 * Runs in jsdom (environmentMatchGlobs '__tests__/*.test.tsx' -> jsdom).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DecisionLogRows, type DecisionLogRow } from '../components/decision-log/DecisionLog'

afterEach(() => {
  cleanup()
})

/** Fake resolveActor — the component never resolves actors itself (that's
 * `DecisionLog`'s job); the pure `DecisionLogRows` only consumes whatever
 * this function returns. */
function resolveActor(actorId: string): string {
  const names: Record<string, string> = {
    clerk_sub_1: 'Andrew',
    clerk_sub_2: 'Jordan',
    pipeline: 'Pipeline',
  }
  return names[actorId] ?? actorId
}

describe('DecisionLogRows', () => {
  it('shows the resolved actor NAME ("Andrew"), never the raw Clerk sub', () => {
    const rows: DecisionLogRow[] = [
      {
        _id: 'a1',
        actorId: 'clerk_sub_1',
        action: 'issue.held',
        reason: 'Waiting on charity confirmation',
        timestamp: 1_700_000_000_000,
        issueNumber: 42,
        runId: 'run-1',
        instructionVersion: 'v3',
      },
    ]
    render(<DecisionLogRows rows={rows} resolveActor={resolveActor} />)

    expect(screen.getByText('Andrew')).toBeDefined()
    expect(screen.queryByText('clerk_sub_1')).toBeNull()
  })

  it('resolves a system actor id ("pipeline") to its display name', () => {
    const rows: DecisionLogRow[] = [
      {
        _id: 'a2',
        actorId: 'pipeline',
        action: 'charity.blocklisted',
        reason: 'Org confirmed defunct',
        timestamp: 1_700_000_100_000,
      },
    ]
    render(<DecisionLogRows rows={rows} resolveActor={resolveActor} />)

    expect(screen.getByText('Pipeline')).toBeDefined()
    expect(screen.queryByText('pipeline')).toBeNull()
  })

  it('shows the structured reason as the primary visible field', () => {
    const rows: DecisionLogRow[] = [
      {
        _id: 'a3',
        actorId: 'clerk_sub_1',
        action: 'issue.held',
        reason: 'Waiting on charity confirmation',
        timestamp: 1_700_000_000_000,
      },
    ]
    render(<DecisionLogRows rows={rows} resolveActor={resolveActor} />)

    expect(screen.getByText('Waiting on charity confirmation')).toBeDefined()
  })

  it('legacy tolerance: a row with no structured reason falls back to the after-JSON heldReason', () => {
    const rows: DecisionLogRow[] = [
      {
        _id: 'a4',
        actorId: 'clerk_sub_2',
        action: 'issue.held',
        after: JSON.stringify({ heldReason: 'ran long' }),
        timestamp: 1_700_000_200_000,
      },
    ]
    render(<DecisionLogRows rows={rows} resolveActor={resolveActor} />)

    expect(screen.getByText('ran long')).toBeDefined()
  })

  it('renders an explicit placeholder for a missing instructionVersion — never a blank cell', () => {
    const rows: DecisionLogRow[] = [
      {
        _id: 'a5',
        actorId: 'clerk_sub_1',
        action: 'promptVersions.activate',
        reason: 'Regression accepted for tone tightening',
        timestamp: 1_700_000_300_000,
      },
    ]
    render(<DecisionLogRows rows={rows} resolveActor={resolveActor} />)

    // instructionVersion (and issue/run) are absent -> explicit dash(es), never blank.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('shows action, a formatted time, and issue/run when present', () => {
    const timestamp = new Date('2026-01-15T12:00:00Z').getTime()
    const rows: DecisionLogRow[] = [
      {
        _id: 'a6',
        actorId: 'clerk_sub_1',
        action: 'issue.held',
        reason: 'Waiting on charity confirmation',
        timestamp,
        issueNumber: 42,
        runId: 'run-42',
      },
    ]
    render(<DecisionLogRows rows={rows} resolveActor={resolveActor} />)

    expect(screen.getByText('issue.held')).toBeDefined()
    expect(screen.getByText(/Issue 42/)).toBeDefined()
    expect(screen.getByText(/run-42/)).toBeDefined()
    // A formatted date string renders — never the raw epoch number.
    expect(screen.queryByText(String(timestamp))).toBeNull()
  })

  it('renders an explicit empty state ("No decisions recorded yet.") for an empty row list', () => {
    render(<DecisionLogRows rows={[]} resolveActor={resolveActor} />)
    expect(screen.getByText('No decisions recorded yet.')).toBeDefined()
  })
})
