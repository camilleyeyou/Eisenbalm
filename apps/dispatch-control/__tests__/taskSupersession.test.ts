/**
 * Phase 43 Plan 43-04 (§43.6, TSK-05) — RED scaffold for the pure
 * supersession/resolution predicate. Plain `DerivedTask` fixtures — no
 * Convex, node env. Mirrors derivedState.test.ts's fixture style.
 *
 * RESEARCH Pitfall 2 / §43.6: `rerun_agent` does NOT clear stale
 * `qaCorrections`/`claim_checks` rows for the re-rolled section, so a
 * rerolled task does NOT vanish on the next render. The only queryable
 * reroll signal is the `audit_log` row `action: "run.section_rerolled"`,
 * `resourceId: "{runId}:{agentKey}"` — this module cross-references that
 * signal (as a caller-supplied `RerollSignal[]`) against each task's
 * `openedAt`, rather than relying on simple vanish-diffing.
 *
 * RED until Task 2 implements `apps/dispatch-control/lib/taskSupersession.ts`.
 */
import { describe, it, expect } from 'vitest'
import { computeSessionStates, type RerollSignal } from '../lib/taskSupersession'
import type { DerivedTask } from '../lib/derivedState'

function makeTask(overrides: Partial<DerivedTask> = {}): DerivedTask {
  return {
    id: 'qa-1',
    sev: 'must-fix',
    title: 'Fix something',
    where: 'origin_story',
    why: 'reason',
    primary: { label: 'Review', href: '/x' },
    stage: 2,
    openedAt: 1000,
    ...overrides,
  }
}

// `taskSection` mirrors the caller's responsibility (§43.6 / plan interfaces
// note): DerivedTask.where already carries the raw sectionName (snake_case
// for QA findings, camelCase for claims) — the predicate itself does the
// qaSectionToGalleyId bridging when matching against a reroll's agentKey.
const taskSection = (t: DerivedTask): string | undefined => t.where

describe('computeSessionStates (§43.6, TSK-05)', () => {
  it('active: a current task with no matching reroll, present in both current and prev snapshot, stays "active"', () => {
    const task = makeTask()
    const result = computeSessionStates([task], [task], [], 5000, taskSection)
    expect(result).toHaveLength(1)
    expect(result[0]?.sessionState).toBe('active')
  })

  it('superseded (finding): openedAt T + section origin_story, with a run.section_rerolled row for origin_story newer than T -> "superseded" with supersededBy set', () => {
    const task = makeTask({ id: 'qa-1', where: 'origin_story', openedAt: 1000 })
    const rerolls: RerollSignal[] = [{ agentKey: 'origin_story', timestamp: 2000, href: '/new-step' }]
    const result = computeSessionStates([task], null, rerolls, 5000, taskSection)
    expect(result).toHaveLength(1)
    expect(result[0]?.sessionState).toBe('superseded')
    expect(result[0]?.supersededBy).toBe('/new-step')
  })

  it('superseded (claim, vocab bridge): claim section "originStory" matches reroll agentKey "origin_story" via qaSectionToGalleyId -> "superseded"', () => {
    const task = makeTask({ id: 'claim-1', where: 'originStory', openedAt: 1000 })
    const rerolls: RerollSignal[] = [{ agentKey: 'origin_story', timestamp: 2000 }]
    const result = computeSessionStates([task], null, rerolls, 5000, taskSection)
    expect(result[0]?.sessionState).toBe('superseded')
  })

  it('NOT superseded: a run.section_rerolled row OLDER than the task openedAt does not supersede -> "active"', () => {
    const task = makeTask({ id: 'qa-1', where: 'origin_story', openedAt: 5000 })
    const rerolls: RerollSignal[] = [{ agentKey: 'origin_story', timestamp: 2000 }]
    const result = computeSessionStates([task], null, rerolls, 9000, taskSection)
    expect(result[0]?.sessionState).toBe('active')
  })

  it('resolved: a task present in prevSnapshot but absent from current, with no matching reroll -> "resolved", kept for the session, not "active"', () => {
    const vanished = makeTask({ id: 'qa-2', where: 'founder_bio', openedAt: 1000 })
    const result = computeSessionStates([], [vanished], [], 5000, taskSection)
    expect(result).toHaveLength(1)
    expect(result[0]?.sessionState).toBe('resolved')
    expect(result[0]?.sessionState).not.toBe('active')
  })

  it('resolved tasks are stamped with the injected `now` as their display age anchor ("resolved just now")', () => {
    const vanished = makeTask({ id: 'qa-2', where: 'founder_bio', openedAt: 1000 })
    const now = 7777
    const result = computeSessionStates([], [vanished], [], now, taskSection)
    expect(result[0]?.openedAt).toBe(now)
  })

  it('superseded precedence over resolved: a task that vanished AND has a newer matching run.section_rerolled row -> "superseded", not "resolved"', () => {
    const vanished = makeTask({ id: 'qa-3', where: 'origin_story', openedAt: 1000 })
    const rerolls: RerollSignal[] = [{ agentKey: 'origin_story', timestamp: 2000, href: '/new-step' }]
    const result = computeSessionStates([], [vanished], rerolls, 5000, taskSection)
    expect(result).toHaveLength(1)
    expect(result[0]?.sessionState).toBe('superseded')
    expect(result[0]?.supersededBy).toBe('/new-step')
  })

  it('no reroll rows + no prev snapshot -> every current task is "active"', () => {
    const taskA = makeTask({ id: 'qa-1', where: 'origin_story' })
    const taskB = makeTask({ id: 'qa-2', where: 'founder_bio' })
    const result = computeSessionStates([taskA, taskB], null, [], 5000, taskSection)
    expect(result).toHaveLength(2)
    expect(result.every((t) => t.sessionState === 'active')).toBe(true)
  })
})
