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
  deriveSectionStates,
  draftSectionIdsFromDraft,
  estimateWorkMinutes,
  isMustFix,
  deriveFactCheckSummary,
  SEVERITY_MINUTES,
  type DerivationInputs,
  type DerivedTask,
  type SectionState,
  type FactCheckClaimRow,
} from '../lib/derivedState'
import type { DraftResponse } from '../lib/contentPatchClient'

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

describe('deriveSectionStates + draftSectionIdsFromDraft (Phase 41 Plan 41-01, WSP-02/WSP-07)', () => {
  function baseDraft(overrides: Partial<DraftResponse> = {}): DraftResponse {
    return {
      revisionId: 'rev-1',
      sections: {},
      theme: {},
      game: {},
      bonus: {},
      bonusType: 'specAd',
      podcast: {},
      conversation: [],
      ...overrides,
    }
  }

  it('a section with an open error-severity finding is "must-fix"', () => {
    const draftSectionIds = new Set(['originStory'])
    const result = deriveSectionStates(
      baseInputs({
        qaFindings: [
          {
            _id: 'q1',
            severity: 'error' as const,
            sectionName: 'origin_story',
            reason: 'unsourced number',
          },
        ],
      }),
      draftSectionIds,
    )
    expect(result.originStory).toEqual({ state: 'must-fix', openCount: 1 })
  })

  it('a section with an open warning/info finding (no error) is "review"', () => {
    const draftSectionIds = new Set(['originStory'])
    const result = deriveSectionStates(
      baseInputs({
        qaFindings: [
          {
            _id: 'q1',
            severity: 'warning' as const,
            sectionName: 'origin_story',
            reason: 'banned word',
          },
        ],
      }),
      draftSectionIds,
    )
    expect(result.originStory).toEqual({ state: 'review', openCount: 1 })
  })

  it('a section present in the draft with zero open findings is "clean"', () => {
    const draftSectionIds = new Set(['originStory'])
    const result = deriveSectionStates(baseInputs({ qaFindings: [] }), draftSectionIds)
    expect(result.originStory).toEqual({ state: 'clean', openCount: 0 })
  })

  it('a section absent from draftSectionIds is "not-generated"', () => {
    const draftSectionIds = new Set<string>()
    const result = deriveSectionStates(baseInputs({ qaFindings: [] }), draftSectionIds)
    expect(result.originStory).toEqual({ state: 'not-generated', openCount: 0 })
  })

  it('resolved (accepted/dismissed) findings are excluded, matching deriveDraftStage', () => {
    const draftSectionIds = new Set(['originStory'])
    const result = deriveSectionStates(
      baseInputs({
        qaFindings: [
          {
            _id: 'q1',
            severity: 'error' as const,
            sectionName: 'origin_story',
            reason: 'x',
            resolution: 'dismissed' as const,
          },
          {
            _id: 'q2',
            severity: 'error' as const,
            sectionName: 'origin_story',
            reason: 'y',
            accepted: true,
          },
        ],
      }),
      draftSectionIds,
    )
    expect(result.originStory).toEqual({ state: 'clean', openCount: 0 })
  })

  it('SAME-SOURCE anti-regression: a clean, claim-less, finding-less GENERATED section reads "clean", never "not-generated"', () => {
    // The section has real, non-empty draft blocks but zero claims and zero
    // open findings anywhere in the run — a legitimately clean, freshly
    // generated section. Presence MUST come from draftSectionIdsFromDraft's
    // real-content check, never be inferred absent because side-tables
    // (claims/findings) a clean section legitimately lacks are also empty.
    const draft = baseDraft({
      sections: {
        originStory: { blocks: [{ type: 'paragraph', text: 'Real content.' }], lossy: false },
      },
    })
    const draftSectionIds = draftSectionIdsFromDraft(draft)
    const result = deriveSectionStates(
      baseInputs({ qaFindings: [], claimRows: [] }),
      draftSectionIds,
    )
    expect(result.originStory?.state).toBe('clean')
    expect(result.originStory?.state).not.toBe('not-generated')
  })

  it('a section whose draft blocks are empty/absent is omitted by draftSectionIdsFromDraft, and deriveSectionStates reports "not-generated" (canvas parity)', () => {
    const draft = baseDraft({
      sections: {
        originStory: { blocks: [{ type: 'paragraph', text: 'Real content.' }], lossy: false },
        founderBio: { blocks: [], lossy: false },
        // caseStudy absent entirely from `sections`
      },
    })
    const draftSectionIds = draftSectionIdsFromDraft(draft)
    expect(draftSectionIds.has('founderBio')).toBe(false)
    expect(draftSectionIds.has('caseStudy')).toBe(false)
    const result = deriveSectionStates(baseInputs({ qaFindings: [] }), draftSectionIds)
    expect(result.founderBio).toEqual({ state: 'not-generated', openCount: 0 })
    expect(result.caseStudy).toEqual({ state: 'not-generated', openCount: 0 })
  })

  it('INVARIANT (WSP-07 + 41-RESEARCH Open Q3): deriveSectionStates NEVER returns "changed-since-review" in Phase 41 — it is a reserved legend label only', () => {
    const draft = baseDraft({
      sections: {
        originStory: { blocks: [{ type: 'paragraph', text: 'Real content.' }], lossy: false },
        problemStatement: { blocks: [{ type: 'paragraph', text: 'More content.' }], lossy: false },
      },
      bonus: { headline: 'A bonus' },
    })
    const draftSectionIds = draftSectionIdsFromDraft(draft)
    const result = deriveSectionStates(
      baseInputs({
        qaFindings: [
          {
            _id: 'q1',
            severity: 'error' as const,
            sectionName: 'origin_story',
            reason: 'x',
          },
          {
            _id: 'q2',
            severity: 'warning' as const,
            sectionName: 'problem',
            reason: 'y',
          },
        ],
      }),
      draftSectionIds,
    )
    const states: SectionState[] = Object.values(result).map((r) => r.state)
    expect(states).not.toContain('changed-since-review')
    // Every section resolves to one of the four reachable states.
    for (const state of states) {
      expect(['clean', 'review', 'must-fix', 'not-generated']).toContain(state)
    }
  })

  it('draftSectionIdsFromDraft includes bonus/game/podcast/deliberation-conversation/theme when their top-level payload is non-empty', () => {
    const draft = baseDraft({
      bonus: { headline: 'A bonus' },
      game: { embedCode: '<div></div>' },
      podcast: { transcript: 'hello' },
      conversation: [{ speaker: 'Scout', text: 'Found one.' }],
      theme: { primaryColor: '#000000' },
    })
    const draftSectionIds = draftSectionIdsFromDraft(draft)
    expect(draftSectionIds.has('bonus')).toBe(true)
    expect(draftSectionIds.has('game')).toBe(true)
    expect(draftSectionIds.has('podcast')).toBe(true)
    expect(draftSectionIds.has('deliberation-conversation')).toBe(true)
    expect(draftSectionIds.has('theme')).toBe(true)
  })

  it('draftSectionIdsFromDraft omits bonus/game/podcast/deliberation-conversation/theme when their top-level payload is empty', () => {
    const draft = baseDraft()
    const draftSectionIds = draftSectionIdsFromDraft(draft)
    expect(draftSectionIds.has('bonus')).toBe(false)
    expect(draftSectionIds.has('game')).toBe(false)
    expect(draftSectionIds.has('podcast')).toBe(false)
    expect(draftSectionIds.has('deliberation-conversation')).toBe(false)
    expect(draftSectionIds.has('theme')).toBe(false)
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

  it('an unsourced Load-bearing pending claim is must-fix; a sourced Load-bearing claim is review-recommended', () => {
    const claimRows = [
      { _id: 'c1', status: 'pending', importance: 'Load-bearing' as const, claimText: 'no source claim' },
      {
        _id: 'c2',
        status: 'pending',
        importance: 'Load-bearing' as const,
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

  it('42-RESEARCH REQUIRED CORRECTION (D-05): an unsourced Incidental pending claim is review-recommended, NOT must-fix — severity is importance-aware, not sourceUrl-presence-alone', () => {
    const claimRows = [
      { _id: 'c1', status: 'pending', importance: 'Incidental' as const, claimText: 'unsourced atmospheric detail' },
    ]
    const tasks = deriveTasks(baseInputs({ runStatus: 'complete', claimRows, signOffs: {} }))
    const task = tasks.find((t: DerivedTask) => t.title.includes('unsourced atmospheric detail'))
    expect(task?.sev).toBe('review-recommended')
    expect(task?.sev).not.toBe('must-fix')
  })

  it('a legacy unsourced pending claim with NO importance field defaults to Supporting and is review-recommended, not must-fix', () => {
    const claimRows = [{ _id: 'c1', status: 'pending', claimText: 'legacy unsourced claim' }]
    const tasks = deriveTasks(baseInputs({ runStatus: 'complete', claimRows, signOffs: {} }))
    const task = tasks.find((t: DerivedTask) => t.title.includes('legacy unsourced claim'))
    expect(task?.sev).toBe('review-recommended')
  })
})

describe('isMustFix + deriveFactCheckSummary (Phase 42 Plan 42-05, FCT-02, D-04..D-08)', () => {
  function claimRow(overrides: Partial<FactCheckClaimRow> = {}): FactCheckClaimRow {
    return { status: 'pending', ...overrides }
  }

  describe('isMustFix', () => {
    it('true for a pending, unsourced, Load-bearing claim', () => {
      expect(isMustFix(claimRow({ importance: 'Load-bearing' }))).toBe(true)
    })

    it('false for a pending, unsourced, Incidental claim', () => {
      expect(isMustFix(claimRow({ importance: 'Incidental' }))).toBe(false)
    })

    it('false for a pending, unsourced, Supporting claim', () => {
      expect(isMustFix(claimRow({ importance: 'Supporting' }))).toBe(false)
    })

    it('false for a pending, unsourced claim with NO importance field (defaults to Supporting, D-03)', () => {
      expect(isMustFix(claimRow({}))).toBe(false)
    })

    it('false for a Load-bearing claim that HAS a sourceUrl', () => {
      expect(isMustFix(claimRow({ importance: 'Load-bearing', sourceUrl: 'https://example.org' }))).toBe(
        false,
      )
    })

    it('false for any non-pending row, even Load-bearing and unsourced', () => {
      expect(isMustFix(claimRow({ importance: 'Load-bearing', status: 'checked' }))).toBe(false)
    })

    it('false for a "removed" (soft-deleted) row, even Load-bearing and unsourced', () => {
      expect(isMustFix(claimRow({ importance: 'Load-bearing', status: 'removed' }))).toBe(false)
    })
  })

  describe('deriveFactCheckSummary', () => {
    it('every counter is defined (never omitted) for an empty row set', () => {
      const summary = deriveFactCheckSummary([])
      expect(summary).toEqual({
        factCoverage: '0 of 0',
        total: 0,
        checked: 0,
        mustFixCount: 0,
        changedCount: 0,
        uncheckedCount: 0,
        conflictsCount: 0,
        checksNotRunCount: 0,
        lastVerifiedAt: null,
      })
    })

    it('factCoverage is "checked of total" using status !== "pending" as the checked predicate', () => {
      const rows = [
        claimRow({ status: 'checked' }),
        claimRow({ status: 'pending' }),
        claimRow({ status: 'pending' }),
      ]
      expect(deriveFactCheckSummary(rows).factCoverage).toBe('1 of 3')
    })

    it('mustFixCount counts only unsourced pending Load-bearing rows', () => {
      const rows = [
        claimRow({ importance: 'Load-bearing' }), // must-fix
        claimRow({ importance: 'Load-bearing', sourceUrl: 'https://x.org' }), // sourced, not must-fix
        claimRow({ importance: 'Incidental' }), // not must-fix
        claimRow({ importance: 'Load-bearing', status: 'checked' }), // not pending
      ]
      expect(deriveFactCheckSummary(rows).mustFixCount).toBe(1)
    })

    it('changedCount counts rows with changedSinceCheck:true regardless of status', () => {
      const rows = [
        claimRow({ changedSinceCheck: true }),
        claimRow({ changedSinceCheck: true, status: 'checked' }),
        claimRow({ changedSinceCheck: false }),
        claimRow({}),
      ]
      expect(deriveFactCheckSummary(rows).changedCount).toBe(2)
    })

    it('uncheckedCount counts pending rows only', () => {
      const rows = [claimRow({ status: 'pending' }), claimRow({ status: 'checked' }), claimRow({ status: 'removed' })]
      expect(deriveFactCheckSummary(rows).uncheckedCount).toBe(1)
    })

    it('conflictsCount counts rows with an explicit conflict:true marker, 0 until set', () => {
      expect(deriveFactCheckSummary([claimRow({}), claimRow({})]).conflictsCount).toBe(0)
      expect(deriveFactCheckSummary([claimRow({ conflict: true }), claimRow({})]).conflictsCount).toBe(1)
    })

    it('checksNotRunCount counts pending, unsourced, not-yet-changed rows', () => {
      const rows = [
        claimRow({}), // pending, no sourceUrl, no changedSinceCheck -> counted
        claimRow({ sourceUrl: 'https://x.org' }), // sourced -> not counted
        claimRow({ changedSinceCheck: true }), // changed -> not counted
        claimRow({ status: 'checked' }), // not pending -> not counted
      ]
      expect(deriveFactCheckSummary(rows).checksNotRunCount).toBe(1)
    })

    it('lastVerifiedAt is the max checkedAt across rows, or null when none have been checked', () => {
      expect(deriveFactCheckSummary([claimRow({}), claimRow({})]).lastVerifiedAt).toBeNull()
      const rows = [
        claimRow({ status: 'checked', checkedAt: 100 }),
        claimRow({ status: 'checked', checkedAt: 300 }),
        claimRow({ status: 'checked', checkedAt: 200 }),
      ]
      expect(deriveFactCheckSummary(rows).lastVerifiedAt).toBe(300)
    })

    it('REGRESSION INVARIANT: when every row status !== "pending" (the allSignedOff-true condition), mustFixCount is always 0', () => {
      const rows = [
        claimRow({ importance: 'Load-bearing', status: 'checked' }),
        claimRow({ importance: 'Load-bearing', status: 'removed' }),
        claimRow({ importance: 'Load-bearing', status: 'skipped' }),
      ]
      expect(rows.every((r) => r.status !== 'pending')).toBe(true)
      expect(deriveFactCheckSummary(rows).mustFixCount).toBe(0)
    })

    it('a "removed" status row is excluded from mustFix and does not inflate uncheckedCount', () => {
      const rows = [claimRow({ importance: 'Load-bearing', status: 'removed' })]
      const summary = deriveFactCheckSummary(rows)
      expect(summary.mustFixCount).toBe(0)
      expect(summary.uncheckedCount).toBe(0)
    })
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
