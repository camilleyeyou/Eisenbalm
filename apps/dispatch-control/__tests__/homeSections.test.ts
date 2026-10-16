/**
 * Phase 52 Plan 01 — pure tests for `lib/homeSections.ts` (front-door selector
 * + footer model). Fixtures only; node environment.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveHomeSections,
  deriveHomeFooter,
  rowNote,
  fixSentencePrefix,
  RUNNING_SENTENCE,
  READY_SENTENCE,
  type HomeSectionsResult,
} from '../lib/homeSections'
import { EDITABLE_SECTIONS } from '../lib/editableSections'
import type { DraftResponse } from '../lib/contentPatchClient'
import type { DerivationInputs } from '../lib/derivedState'

type Finding = NonNullable<DerivationInputs['qaFindings']>[number]
type Claim = NonNullable<DerivationInputs['claimRows']>[number]

const para = [{ _type: 'block', _key: 'k', children: [{ _type: 'span', text: 'x' }] }]

function fullDraft(): DraftResponse {
  const longRead = (headline: string) => ({
    headline,
    blocks: para as unknown as DraftResponse['sections'][string]['blocks'],
    lossy: false,
  })
  return {
    revisionId: 'rev-1',
    sections: {
      originStory: longRead('Origin Headline'),
      problemStatement: longRead('Problem Headline'),
      founderBio: longRead('Founder Headline'),
      caseStudy: longRead('Case Headline'),
    },
    theme: { fontDisplay: 'Newsreader' },
    game: { headline: 'The Filtration Layer', embedCode: '<canvas></canvas>' },
    bonus: { headline: 'Spec Ad', body: [] },
    bonusType: 'specAd',
    podcast: { transcript: 'x' },
    conversation: [{ speaker: 'Scout', text: 'x' }],
  }
}

function finding(over: Partial<Finding> = {}): Finding {
  return { _id: 'f1', severity: 'error', sectionName: 'game', reason: 'r', ...over }
}

function claim(over: Partial<Claim> = {}): Claim {
  return {
    _id: 'c1',
    status: 'pending',
    verdict: 'contradicted',
    sectionName: 'game',
    ...over,
  }
}

function derive(
  over: {
    draft?: DraftResponse | null | undefined
    qaFindings?: Finding[] | undefined
    claimRows?: Claim[] | undefined
    runStatus?: string
  } = {},
) {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(over, k)
  return deriveHomeSections({
    draft: has('draft') ? over.draft : fullDraft(),
    qaFindings: has('qaFindings') ? over.qaFindings : [],
    claimRows: has('claimRows') ? over.claimRows : [],
    runStatus: over.runStatus ?? 'awaiting-review',
  })
}

function row(res: HomeSectionsResult | undefined, id: string) {
  const r = res?.rows.find((x) => x.id === id)
  if (!r) throw new Error(`no row ${id}`)
  return r
}

describe('headline', () => {
  it('returns nine rows in EDITABLE_SECTIONS order', () => {
    const res = derive()!
    expect(res.rows.map((r) => r.id)).toEqual(EDITABLE_SECTIONS.map((s) => s.id))
  })

  it('uses the produced headline for long-reads, game and bonus', () => {
    const res = derive()
    expect(row(res, 'originStory').headline).toBe('Origin Headline')
    expect(row(res, 'game').headline).toBe('The Filtration Layer')
    expect(row(res, 'bonus').headline).toBe('Spec Ad')
  })

  it('uses fixed descriptors for deliberation, podcast and theme', () => {
    const res = derive()
    expect(row(res, 'deliberation-conversation').headline).toBe('How the agents chose this charity')
    expect(row(res, 'podcast').headline).toBe('This week’s episode')
    expect(row(res, 'theme').headline).toBe('Colours and fonts for this issue')
  })

  it('falls back to the label when a long-read headline is empty or missing', () => {
    const d = fullDraft()
    d.sections.originStory.headline = ''
    delete d.sections.founderBio.headline
    const res = derive({ draft: d })
    expect(row(res, 'originStory').headline).toBe('Origin Story')
    expect(row(res, 'founderBio').headline).toBe('Founder Bio')
  })
})

describe('state', () => {
  it('open error finding -> fix with count 1', () => {
    const res = derive({ qaFindings: [finding()] })
    expect(row(res, 'game').state).toBe('fix')
    expect(row(res, 'game').blockingCount).toBe(1)
    expect(res!.totalBlocking).toBe(1)
  })

  it('voice-axis (any axis) error findings also block', () => {
    const res = derive({ qaFindings: [finding({ axis: 'voice' })] })
    expect(row(res, 'game').blockingCount).toBe(1)
  })

  it('warnings and infos never block', () => {
    const res = derive({
      qaFindings: [finding({ _id: 'a', severity: 'warning' }), finding({ _id: 'b', severity: 'info' })],
    })
    expect(row(res, 'game').state).toBe('clean')
    expect(row(res, 'game').blockingCount).toBe(0)
  })

  it('dismissed / accepted findings are not counted', () => {
    const res = derive({
      qaFindings: [
        finding({ _id: 'a', resolution: 'dismissed' }),
        finding({ _id: 'b', resolution: 'accepted' }),
        finding({ _id: 'c', accepted: true, resolution: 'accepted' }),
      ],
    })
    expect(row(res, 'game').blockingCount).toBe(0)
  })

  it('open contradicted claims count; others do not', () => {
    const res = derive({
      qaFindings: [finding()],
      claimRows: [
        claim({ _id: 'c1' }),
        claim({ _id: 'c2', verdict: 'supported' }),
        claim({ _id: 'c3', status: 'signed-off' }),
        claim({ _id: 'c4', changedSinceCheck: true }),
      ],
    })
    expect(row(res, 'game').blockingCount).toBe(2)
    expect(res!.attributedClaims).toBe(1)
  })

  it('absent section: running -> writing, otherwise not-written', () => {
    const d = fullDraft()
    delete d.sections.founderBio
    expect(row(derive({ draft: d, runStatus: 'running' }), 'founderBio').state).toBe('writing')
    expect(row(derive({ draft: d, runStatus: 'awaiting-review' }), 'founderBio').state).toBe('not-written')
  })

  it('absent section with a blocking finding is fix', () => {
    const d = fullDraft()
    delete d.sections.originStory
    const res = derive({ draft: d, qaFindings: [finding({ sectionName: 'origin_story' })] })
    expect(row(res, 'originStory').state).toBe('fix')
  })

  it('null-mapped error findings are unattributed, not bucketed', () => {
    const res = derive({
      qaFindings: [finding({ _id: 'a', sectionName: 'podcast' }), finding({ _id: 'b', sectionName: 'unknown_section' })],
    })
    expect(res!.unattributedFindings).toBe(2)
    expect(res!.rows.every((r) => r.blockingCount === 0)).toBe(true)
    expect(res!.unattributedFindingSections).toEqual(['podcast'])
    expect(res!.unknownSectionFindings).toBe(1)
  })

  it('recovers theme and deliberation targets for the footer link only', () => {
    expect(derive({ qaFindings: [finding({ sectionName: 'theme' })] })!.unattributedFindingSections).toEqual(['theme'])
    expect(derive({ qaFindings: [finding({ sectionName: 'deliberation' })] })!.unattributedFindingSections).toEqual([
      'deliberation-conversation',
    ])
  })

  it('documented gap: accepted:true with no resolution is NOT counted (fails safe via server)', () => {
    const res = derive({ qaFindings: [finding({ accepted: true, resolution: undefined })] })
    expect(row(res, 'game').blockingCount).toBe(0)
  })

  it('claims with missing or unknown sectionName are unattributed', () => {
    const res = derive({
      claimRows: [
        claim({ _id: 'a', sectionName: undefined }),
        claim({ _id: 'b', sectionName: 'nonsense' }),
      ],
    })
    expect(res!.unattributedClaims).toBe(2)
    expect(res!.attributedClaims).toBe(0)
  })

  it('rowNote copy', () => {
    expect(rowNote({ state: 'fix', blockingCount: 1 })).toBe('1 thing to fix →')
    expect(rowNote({ state: 'fix', blockingCount: 3 })).toBe('3 things to fix →')
    expect(rowNote({ state: 'clean', blockingCount: 0 })).toBe('Reads clean')
    expect(rowNote({ state: 'writing', blockingCount: 0 })).toBe('Being written…')
    expect(rowNote({ state: 'not-written', blockingCount: 0 })).toBe('Not written yet')
  })
})

describe('href', () => {
  it('links to the first blocking finding anchor', () => {
    const res = derive({ qaFindings: [finding({ _id: 'f9' }), finding({ _id: 'f10' })] })
    expect(row(res, 'game').href).toBe('/s/game#finding-f9')
    expect(row(res, 'game').firstFindingId).toBe('f9')
  })

  it('first finding follows array order', () => {
    const res = derive({ qaFindings: [finding({ _id: 'late' }), finding({ _id: 'early' })] })
    expect(row(res, 'game').firstFindingId).toBe('late')
  })

  it('claim-only blocker links to the section top', () => {
    const res = derive({ claimRows: [claim()] })
    expect(row(res, 'game').href).toBe('/s/game')
    expect(row(res, 'game').firstFindingId).toBeNull()
  })

  it('clean row links to the section', () => {
    expect(row(derive(), 'originStory').href).toBe('/s/originStory')
  })
})

describe('footer', () => {
  const base = {
    stateKind: 'run' as const,
    signOffsLoaded: true,
    issue: { held: false, published: false },
    publishedAt: undefined as number | null | undefined,
    runStatus: 'awaiting-review' as string | undefined,
    runCompletedAt: 1000 as number | undefined,
    claimSummaryBlocking: 0 as number | undefined,
  }

  it('copy constants and prefix', () => {
    expect(RUNNING_SENTENCE).toBe('Still writing — Publish turns on once every story is written and nothing needs fixing.')
    expect(READY_SENTENCE).toBe('Ready to publish. Nothing left to fix. The agents checked the facts; none were contradicted.')
    expect(fixSentencePrefix(1)).toBe('1 story has something to fix: ')
    expect(fixSentencePrefix(2)).toBe('2 stories have something to fix: ')
  })

  it('names the exact blocking story', () => {
    const sections = derive({ qaFindings: [finding({ _id: 'f9' })] })
    const f = deriveHomeFooter({ ...base, sections, claimSummaryBlocking: 0 })
    expect(f).toMatchObject({
      kind: 'fix',
      stories: [{ id: 'game', label: 'Game', href: '/s/game#finding-f9' }],
    })
  })

  it('ready only when everything is loaded, present and clean', () => {
    expect(deriveHomeFooter({ ...base, sections: derive() })).toEqual({ kind: 'ready' })
  })

  it('server claim summary wins over attributed count', () => {
    const sections = derive({ claimRows: [claim()] })
    const f = deriveHomeFooter({ ...base, sections, claimSummaryBlocking: 2 })
    expect(f).toMatchObject({ kind: 'fix', unattributedClaims: 1 })
  })

  it('running / failed / gate1 / published', () => {
    const sections = derive()
    expect(deriveHomeFooter({ ...base, sections, runStatus: 'running' }).kind).toBe('running')
    expect(deriveHomeFooter({ ...base, sections, runStatus: 'failed' }).kind).toBe('failed')
    expect(deriveHomeFooter({ ...base, sections, runCompletedAt: undefined }).kind).toBe('gate1')
    expect(deriveHomeFooter({ ...base, sections, issue: { held: false, published: true }, publishedAt: 5 })).toEqual({
      kind: 'published',
      publishedAt: 5,
    })
  })

  it('runStatus complete reads as published even when issues.published is false', () => {
    const f = deriveHomeFooter({ ...base, sections: derive(), runStatus: 'complete', publishedAt: undefined })
    expect(f).toEqual({ kind: 'published', publishedAt: null })
  })

  it('terminal kinds resolve before content inputs load', () => {
    const t = { ...base, sections: undefined, claimSummaryBlocking: undefined, signOffsLoaded: false, issue: undefined }
    expect(deriveHomeFooter({ ...t, runStatus: 'failed' }).kind).toBe('failed')
    expect(deriveHomeFooter({ ...t, runStatus: 'running' }).kind).toBe('running')
    expect(deriveHomeFooter({ ...t, runStatus: 'complete' }).kind).toBe('published')
    expect(deriveHomeFooter({ ...t, runStatus: 'awaiting-review', runCompletedAt: undefined }).kind).toBe('gate1')
    expect(deriveHomeFooter({ ...t, stateKind: 'none', runStatus: undefined }).kind).toBe('none')
  })

  it('unattributed findings: link only when a single known section', () => {
    const one = deriveHomeFooter({
      ...base,
      sections: derive({ qaFindings: [finding({ sectionName: 'podcast' })] }),
    })
    expect(one).toMatchObject({ kind: 'fix', unattributedFindings: 1, unattributedFindingHref: '/s/podcast' })
    const mixed = deriveHomeFooter({
      ...base,
      sections: derive({
        qaFindings: [finding({ _id: 'a', sectionName: 'podcast' }), finding({ _id: 'b', sectionName: 'unknown_section' })],
      }),
    })
    expect(mixed).toMatchObject({ kind: 'fix', unattributedFindingHref: null })
  })

  it('a not-written story in a completed run is fix with notWritten', () => {
    const d = fullDraft()
    delete d.sections.caseStudy
    const f = deriveHomeFooter({ ...base, sections: derive({ draft: d }) })
    expect(f).toMatchObject({ kind: 'fix', notWritten: [{ id: 'caseStudy', label: 'Case Study' }] })
  })
})

describe('loading', () => {
  it('deriveHomeSections is undefined while any input is undefined', () => {
    expect(derive({ draft: undefined })).toBeUndefined()
    expect(derive({ qaFindings: undefined })).toBeUndefined()
    expect(derive({ claimRows: undefined })).toBeUndefined()
  })

  const ok = {
    stateKind: 'run' as const,
    sections: derive(),
    claimSummaryBlocking: 0 as number | undefined,
    signOffsLoaded: true,
    issue: { held: false, published: false } as { held: boolean; published: boolean } | null | undefined,
    publishedAt: undefined as number | null | undefined,
    runStatus: 'awaiting-review' as string | undefined,
    runCompletedAt: 1000 as number | undefined,
  }

  it('baseline is ready', () => {
    expect(deriveHomeFooter(ok).kind).toBe('ready')
  })

  it('never ready while anything is undefined', () => {
    expect(deriveHomeFooter({ ...ok, stateKind: 'loading' })).toEqual({ kind: 'loading' })
    expect(deriveHomeFooter({ ...ok, sections: undefined })).toEqual({ kind: 'loading' })
    expect(deriveHomeFooter({ ...ok, claimSummaryBlocking: undefined })).toEqual({ kind: 'loading' })
    expect(deriveHomeFooter({ ...ok, signOffsLoaded: false })).toEqual({ kind: 'loading' })
    expect(deriveHomeFooter({ ...ok, issue: undefined })).toEqual({ kind: 'loading' })
  })
})
