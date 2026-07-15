/**
 * Phase 43 Plan 43-04 (§43.6, TSK-05) — the pure client-side
 * supersession/resolution predicate.
 *
 * RESEARCH Pitfall 2 is the load-bearing fact this module encodes:
 * `rerun_agent` (packages/pipeline/.../api/control.py:470-594, the only
 * in-scope restart mechanism) does NOT clear stale `qaCorrections`/
 * `claim_checks` rows for the re-rolled section — a rerolled task does NOT
 * vanish from `deriveTasks()`'s output on the next render. The only
 * queryable reroll signal is the `audit_log` row
 * `action: "run.section_rerolled"`, `resourceId: "{runId}:{agentKey}"`
 * (`_emit_audit` inside `rerun_agent`, control.py:583-589). Simple
 * vanish-diffing is therefore insufficient on its own; this predicate
 * cross-references that audit signal against each task's `openedAt`.
 *
 * `resolved`/`superseded` live ONLY on the `DisplayTask` wrapper below —
 * they are NEVER added to `TaskSeverity`/`SEVERITY_MINUTES`/`SEVERITY_ORDER`
 * (derivedState.ts), which stay the closed, exhaustive
 * `'must-fix' | 'review-recommended' | 'information'` union (Pitfall 4).
 *
 * Pure: no Convex, no Date.now() — `now` is injected by the caller so this
 * module is testable without mounting a screen or mocking the clock. The
 * caller (43-05) owns fetching reroll rows (client-filtered
 * `auditLog.listForWorkspace` results) and maintaining `prevSnapshot`
 * across renders (e.g. in a ref).
 */
import { qaSectionToGalleyId } from './galley/sectionIdMap'
import type { DerivedTask } from './derivedState'

// screen-local wrapper — verbatim shape from API_CONTRACTS.md §43.6.
export type DisplayTask = DerivedTask & {
  sessionState: 'active' | 'resolved' | 'superseded'
  supersededBy?: string
}

/**
 * A single `run.section_rerolled` audit-log row, already parsed by the
 * caller from `resourceId: "{runId}:{agentKey}"` (agentKey is snake_case,
 * e.g. `'origin_story'`) and `timestamp`. `href`, when supplied, is the
 * link to the new step the superseded task should point at; when absent,
 * callers fall back to the task's own `stage`.
 */
export interface RerollSignal {
  agentKey: string
  timestamp: number
  href?: string
}

/**
 * Finds the newest reroll whose `agentKey` matches `section` — matching
 * either directly (QA-finding sections are already snake_case and equal
 * `agentKey`) or via the claim vocab bridge (`claim_checks.sectionName` is
 * camelCase, so `qaSectionToGalleyId(agentKey)` must equal `section`
 * instead). Returns `undefined` when `section` is unknown or no reroll
 * matches.
 */
function findMatchingReroll(
  section: string | undefined,
  rerolls: RerollSignal[],
): RerollSignal | undefined {
  if (section === undefined) return undefined
  let best: RerollSignal | undefined
  for (const reroll of rerolls) {
    const matchesDirect = reroll.agentKey === section
    const matchesClaimVocab = qaSectionToGalleyId(reroll.agentKey) === section
    if (!matchesDirect && !matchesClaimVocab) continue
    if (!best || reroll.timestamp > best.timestamp) best = reroll
  }
  return best
}

function supersededDisplay(task: DerivedTask, reroll: RerollSignal): DisplayTask {
  return {
    ...task,
    sessionState: 'superseded',
    supersededBy: reroll.href ?? String(task.stage),
  }
}

/**
 * Computes each task's session display state (§43.6):
 *
 * - Every `current` task: 'superseded' when a matching reroll (by section,
 *   via `taskSection`) has `timestamp` strictly newer than the task's own
 *   `openedAt` (an `openedAt`-less task is treated as always-old, i.e.
 *   `0`); otherwise 'active'.
 * - Every task present in `prevSnapshot` but absent from `current`
 *   (vanished): 'superseded' under the same newer-reroll rule (precedence
 *   over 'resolved' — a vanished task whose section was rerolled points at
 *   the replacement, it never silently reads as merely "resolved"), else
 *   'resolved'. These session-carried entries are appended after the
 *   current set and kept only for this render — the caller drops them on
 *   the next snapshot.
 * - Resolved entries have their `openedAt` stamped to the injected `now`,
 *   so a caller re-using `formatTaskAge` for display renders "just now"
 *   immediately after resolution without this module needing its own
 *   age-formatting/labeling logic.
 */
export function computeSessionStates(
  current: DerivedTask[],
  prevSnapshot: DerivedTask[] | null,
  rerolls: RerollSignal[],
  now: number,
  taskSection: (t: DerivedTask) => string | undefined,
): DisplayTask[] {
  const result: DisplayTask[] = []
  const currentIds = new Set(current.map((t) => t.id))

  for (const task of current) {
    const reroll = findMatchingReroll(taskSection(task), rerolls)
    if (reroll && reroll.timestamp > (task.openedAt ?? 0)) {
      result.push(supersededDisplay(task, reroll))
    } else {
      result.push({ ...task, sessionState: 'active' })
    }
  }

  for (const task of prevSnapshot ?? []) {
    if (currentIds.has(task.id)) continue // still present -- handled above
    const reroll = findMatchingReroll(taskSection(task), rerolls)
    if (reroll && reroll.timestamp > (task.openedAt ?? 0)) {
      result.push(supersededDisplay(task, reroll))
    } else {
      result.push({ ...task, sessionState: 'resolved', openedAt: now })
    }
  }

  return result
}
