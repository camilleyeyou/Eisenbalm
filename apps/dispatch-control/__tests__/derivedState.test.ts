/**
 * Phase 40 Plan 40-01 (§40.6, ISS-01/ISS-06) — RED scaffold for the pure
 * derived-state selector module. Plain fixtures over the `DerivationInputs`
 * shape from docs/API_CONTRACTS.md §40.6 — no Convex import, node env.
 *
 * RED until Plan 40-04 implements `apps/dispatch-control/lib/derivedState.ts`.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveIssueStatus,
  deriveStageStates,
  deriveTasks,
  estimateWorkMinutes,
  SEVERITY_MINUTES,
  type DerivationInputs,
  type DerivedTask,
} from '../lib/derivedState'

function baseInputs(overrides: Partial<DerivationInputs> = {}): DerivationInputs {
  return {
    issueNumber: 7,
    runId: 'run-1',
    issue: { held: false, published: false },
    signOffs: {},
    claimRows: [],
    qaFindings: [],
    pitchRows: [],
    runStatus: 'complete',
    ...overrides,
  }
}

describe('deriveIssueStatus (§40.6, ISS-06)', () => {
  it('returns "unknown" when issue is undefined (not loaded) — never a stale value', () => {
    const status = deriveIssueStatus(baseInputs({ issue: undefined }))
    expect(status).toBe('unknown')
    expect(status).not.toBe('ready')
    expect(status).not.toBe('draft')
  })

  it('returns "unknown" when signOffs is undefined (not loaded/failed) — never a stale value', () => {
    const status = deriveIssueStatus(baseInputs({ signOffs: undefined }))
    expect(status).toBe('unknown')
    expect(status).not.toBe('ready')
    expect(status).not.toBe('draft')
  })

  it('published:true returns "published" even when held is also true', () => {
    const status = deriveIssueStatus(
      baseInputs({
        issue: { held: true, published: true },
        signOffs: {
          'facts-cleared': { actorId: 'a', signedAt: 1 },
          'sounds-human': { actorId: 'a', signedAt: 1 },
        },
      }),
    )
    expect(status).toBe('published')
  })

  it('held:true returns "held" even when both sign-offs are present (D-15)', () => {
    const status = deriveIssueStatus(
      baseInputs({
        issue: { held: true, published: false },
        signOffs: {
          'facts-cleared': { actorId: 'a', signedAt: 1 },
          'sounds-human': { actorId: 'a', signedAt: 1 },
        },
      }),
    )
    expect(status).toBe('held')
  })

  it('both sign-offs present, not held, not published returns "ready"', () => {
    const status = deriveIssueStatus(
      baseInputs({
        signOffs: {
          'facts-cleared': { actorId: 'a', signedAt: 1 },
          'sounds-human': { actorId: 'a', signedAt: 1 },
        },
      }),
    )
    expect(status).toBe('ready')
  })

  it('no sign-offs and runId null returns "draft"', () => {
    const status = deriveIssueStatus(baseInputs({ signOffs: {}, runId: null }))
    expect(status).toBe('draft')
  })

  it('no sign-offs and a real runId returns "needs-review"', () => {
    const status = deriveIssueStatus(baseInputs({ signOffs: {}, runId: 'r1' }))
    expect(status).toBe('needs-review')
  })
})

describe('deriveStageStates (§40.6, D-19)', () => {
  it('completed run with zero checked claims is NOT clean', () => {
    const result = deriveStageStates(
      baseInputs({
        runStatus: 'complete',
        claimRows: [
          { _id: 'c1', status: 'pending' },
          { _id: 'c2', status: 'pending' },
        ],
      }),
    )
    expect(result[2]).toEqual({ state: 'needs-you', openCount: 2 })
  })

  it('an empty claimRows array is "not-generated" for Fact Check, never "clean"', () => {
    const result = deriveStageStates(baseInputs({ claimRows: [] }))
    expect(result[2]).toEqual({ state: 'not-generated', openCount: 0 })
  })

  it('stage 2 (Draft) counts only non-voice open findings; stage 4 (Voice) counts only voice-axis open findings', () => {
    const qaFindings = [
      {
        _id: 'q1',
        severity: 'error' as const,
        axis: 'precision',
        sectionName: 'Origin',
        reason: 'unsourced number',
      },
      {
        _id: 'q2',
        severity: 'warning' as const,
        axis: 'hard-rule',
        sectionName: 'Problem',
        reason: 'banned word',
      },
      {
        _id: 'q3',
        severity: 'error' as const,
        axis: 'gravity',
        sectionName: 'Origin',
        reason: 'winking tone',
      },
      {
        _id: 'q4',
        severity: 'warning' as const,
        axis: 'machine-tell',
        sectionName: 'Bonus',
        reason: 'AI reference',
      },
    ]
    const result = deriveStageStates(
      baseInputs({
        qaFindings,
        signOffs: {},
        claimRows: [{ _id: 'c1', status: 'checked' }],
      }),
    )
    expect(result[1]).toEqual({ state: 'needs-you', openCount: 2 })
    expect(result[3]).toEqual({ state: 'needs-you', openCount: 2 })
  })

  it('findings with resolution:"dismissed" or accepted:true are excluded from every stage count', () => {
    const qaFindings = [
      {
        _id: 'q1',
        severity: 'error' as const,
        axis: 'precision',
        sectionName: 'Origin',
        reason: 'x',
        resolution: 'dismissed' as const,
      },
      {
        _id: 'q2',
        severity: 'error' as const,
        axis: 'gravity',
        sectionName: 'Origin',
        reason: 'y',
        accepted: true,
      },
    ]
    const result = deriveStageStates(
      baseInputs({
        qaFindings,
        signOffs: {},
        claimRows: [{ _id: 'c1', status: 'checked' }],
      }),
    )
    expect(result[1].openCount).toBe(0)
    expect(result[3].openCount).toBe(0)
  })
})

describe('deriveTasks (§40.6, D-21)', () => {
  it('returns [] when runId is null', () => {
    const tasks = deriveTasks(baseInputs({ runId: null }))
    expect(tasks).toEqual([])
  })

  it('length equals open findings + pending claims + missing sign-offs on a non-running run', () => {
    const qaFindings = [
      {
        _id: 'q1',
        severity: 'error' as const,
        axis: 'precision',
        sectionName: 'Origin',
        reason: 'unsourced number',
      },
      {
        _id: 'q2',
        severity: 'warning' as const,
        axis: 'gravity',
        sectionName: 'Origin',
        reason: 'winking tone',
      },
    ]
    const claimRows = [
      { _id: 'c1', status: 'pending', claimText: 'a claim without a source' },
      {
        _id: 'c2',
        status: 'pending',
        sourceUrl: 'https://example.org',
        claimText: 'a sourced claim',
      },
      { _id: 'c3', status: 'checked' },
    ]
    const tasks = deriveTasks(
      baseInputs({
        runStatus: 'complete',
        qaFindings,
        claimRows,
        signOffs: {},
      }),
    )
    // 2 open findings + 2 pending claims + 2 missing sign-offs (facts-cleared, sounds-human) = 6
    expect(tasks).toHaveLength(6)
  })

  it('a pending claim with no sourceUrl is must-fix; with a sourceUrl it is review-recommended', () => {
    const claimRows = [
      { _id: 'c1', status: 'pending', claimText: 'no source claim' },
      {
        _id: 'c2',
        status: 'pending',
        sourceUrl: 'https://example.org',
        claimText: 'has source claim',
      },
    ]
    const tasks = deriveTasks(
      baseInputs({
        runStatus: 'complete',
        claimRows,
        signOffs: {
          'facts-cleared': { actorId: 'a', signedAt: 1 },
          'sounds-human': { actorId: 'a', signedAt: 1 },
        },
      }),
    )
    const withoutSource = tasks.find((t: DerivedTask) => t.title.includes('no source claim'))
    const withSource = tasks.find((t: DerivedTask) => t.title.includes('has source claim'))
    expect(withoutSource?.sev).toBe('must-fix')
    expect(withSource?.sev).toBe('review-recommended')
  })
})

describe('estimateWorkMinutes + SEVERITY_MINUTES (§40.6, D-22)', () => {
  it('sums severity-weighted minutes across a mixed task list', () => {
    const tasks: DerivedTask[] = [
      {
        id: '1',
        sev: 'must-fix',
        title: 't1',
        where: 'w',
        why: 'y',
        primary: { label: 'l', href: 'h' },
        stage: 2,
      },
      {
        id: '2',
        sev: 'review-recommended',
        title: 't2',
        where: 'w',
        why: 'y',
        primary: { label: 'l', href: 'h' },
        stage: 2,
      },
      {
        id: '3',
        sev: 'information',
        title: 't3',
        where: 'w',
        why: 'y',
        primary: { label: 'l', href: 'h' },
        stage: 2,
      },
    ]
    expect(estimateWorkMinutes(tasks)).toBe(10)
  })

  it('SEVERITY_MINUTES exports exactly three keys', () => {
    expect(Object.keys(SEVERITY_MINUTES).sort()).toEqual(
      ['information', 'must-fix', 'review-recommended'].sort(),
    )
  })
})
