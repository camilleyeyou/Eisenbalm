/**
 * quick 260730-ldn (Task 2a) — THE one current-run resolution.
 *
 * The bug this module exists to make unrepresentable: the old Desk asked
 * `issues.filter(!published && !held).sort(by issueNumber desc)[0]` — a
 * reserved slot with no run, invented into "the current issue" — while the
 * Masthead asked `runs.latest -> pipelineRuns.byRunId -> issueNumber` and
 * got a DIFFERENT answer. Two surfaces, two definitions of "the current
 * issue", contradicting each other on one screen.
 *
 * The rule, applied everywhere from now on: **follow the run, never the
 * issue number.** `resolveCurrentRun` takes NO issues list — `max(issueNumber)`
 * is structurally impossible to reconstruct from its inputs. A reserved slot
 * with no run is a future slot; it belongs in the Archive, never on the
 * front door.
 *
 * Pure — no React, no Convex imports.
 */

export type CurrentRunState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'run'; runId: string; issueNumber: number | null }

export function resolveCurrentRun(
  latest: { runId: string } | null | undefined,
  pipelineRun: { issueNumber: number } | null | undefined,
): CurrentRunState {
  // `runs.latest` hasn't loaded yet.
  if (latest === undefined) return { kind: 'loading' }
  // Loaded-and-confirmed: no run exists for this workspace at all.
  if (latest === null) return { kind: 'none' }
  // A run exists, but its pipelineRuns row (and therefore its issueNumber)
  // has not resolved yet — never report a run with a null issueNumber while
  // still loading; wait for the lookup to settle (either a row or `null`).
  if (pipelineRun === undefined) return { kind: 'loading' }
  return {
    kind: 'run',
    runId: latest.runId,
    issueNumber: pipelineRun === null ? null : pipelineRun.issueNumber,
  }
}
