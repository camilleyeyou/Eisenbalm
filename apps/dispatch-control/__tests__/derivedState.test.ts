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
  SEVERITY_MINUTES,
  type DerivationInputs,
  type DerivedTask,
  type SectionState,
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
    expect(result.originStory.state).toBe('clean')
    expect(result.originStory.state).not.toBe('not-generated')
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
