/**
 * quick 260730-ldn (Task 2) — pure tests for `lib/currentRun.ts`. No Convex,
 * no DOM — node environment (default per vitest.config.ts).
 */
import { describe, it, expect } from 'vitest'
import { resolveCurrentRun } from '../lib/currentRun'

describe('resolveCurrentRun', () => {
  it('is loading when runs.latest has not loaded yet', () => {
    expect(resolveCurrentRun(undefined, undefined)).toEqual({ kind: 'loading' })
  })

  it('is "none" when runs.latest has confirmed resolved to no run', () => {
    expect(resolveCurrentRun(null, undefined)).toEqual({ kind: 'none' })
  })

  it('stays loading when a run exists but its pipelineRuns lookup has not resolved', () => {
    expect(resolveCurrentRun({ runId: 'r1' }, undefined)).toEqual({ kind: 'loading' })
  })

  it('is an honest run state (issueNumber: null) for a run with no pipelineRuns row', () => {
    expect(resolveCurrentRun({ runId: 'r1' }, null)).toEqual({
      kind: 'run',
      runId: 'r1',
      issueNumber: null,
    })
  })

  it('resolves the run + issueNumber once both queries have loaded', () => {
    expect(resolveCurrentRun({ runId: 'r1' }, { issueNumber: 999717 })).toEqual({
      kind: 'run',
      runId: 'r1',
      issueNumber: 999717,
    })
  })

  // ── Regression: the exact bug this module exists to make unrepresentable ──
  // The old Desk asked issues.filter(!published && !held).sort(desc)[0] and
  // got 999720 (an empty reserved slot). The Masthead asked
  // runs.latest -> pipelineRuns.byRunId -> issueNumber and got 999717 (the
  // run that actually exists). `resolveCurrentRun` takes NO issues list at
  // all — its signature is (latest, pipelineRun) — so a max(issueNumber)
  // scan is structurally impossible to reconstruct from its inputs. Given
  // the SAME two-query resolution the Masthead used, it returns 999717,
  // never 999720, regardless of what a parallel issues list might contain.
  it('REGRESSION (the selection bug): follows the run to 999717, never a reserved-slot max(issueNumber) like 999720', () => {
    const latest = { runId: 'run-999717' }
    const pipelineRun = { issueNumber: 999717 }
    const result = resolveCurrentRun(latest, pipelineRun)
    expect(result).toEqual({ kind: 'run', runId: 'run-999717', issueNumber: 999717 })
    if (result.kind === 'run') {
      expect(result.issueNumber).not.toBe(999720)
    }
    // Structural guarantee: the function accepts exactly 2 parameters — an
    // issues list has no parameter slot to be threaded through even if a
    // caller wanted to.
    expect(resolveCurrentRun.length).toBe(2)
  })
})
