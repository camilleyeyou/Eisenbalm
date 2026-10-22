/**
 * Phase 52 Plan 01 — pure tests for `lib/homeSections.ts` (front-door selector
 * + footer model). Fixtures only; node environment.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveHomeSections,
  deriveHomeFooter,
  rowNote,
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
    d.sections.originStory!.headline = ''
    delete d.sections.founderBio!.headline
    const res = derive({ draft: d })
    expect(row(res, 'originStory').headline).toBe('Origin Story')
    expect(row(res, 'founderBio').headline).toBe('Founder Bio')
  })
})

describe('state', () => {
  it('open error findings and contradicted claims never produce a fix state', () => {
    const res = derive({ qaFindings: [finding()], claimRows: [claim()] })
    expect(res!.rows.map((r) => r.state)).not.toContain('fix')
    expect(row(res, 'game').state).toBe('clean')
  })

  it('counts agent-applied findings and removed contradicted claims per section', () => {
    const res = derive({
      qaFindings: [
        finding({ _id: 'a', resolution: 'agent-applied' }),
        finding({ _id: 'b', resolution: 'agent-applied' }),
        finding({ _id: 'c', resolution: 'agent-skipped' }),
        finding({ _id: 'd', resolution: 'dismissed' }),
        finding({ _id: 'e', resolution: 'agent-applied', sectionName: 'origin_story' }),
      ],
      claimRows: [
        claim({ _id: 'c1', status: 'removed' }),
        claim({ _id: 'c2', status: 'skipped' }),
        claim({ _id: 'c3', status: 'removed', verdict: 'verified' }),
      ],
    })
    expect(row(res, 'game').agentChanges).toBe(3)
    expect(row(res, 'originStory').agentChanges).toBe(1)
    expect(row(res, 'caseStudy').agentChanges).toBe(0)
  })

  it('absent section: running -> writing, otherwise not-written', () => {
    const d = fullDraft()
    delete d.sections.founderBio
    expect(row(derive({ draft: d, runStatus: 'running' }), 'founderBio').state).toBe('writing')
    expect(row(derive({ draft: d, runStatus: 'awaiting-review' }), 'founderBio').state).toBe('not-written')
  })

  it('rowNote copy', () => {
    expect(rowNote({ state: 'clean', agentChanges: 0 })).toBe('Written')
    expect(rowNote({ state: 'clean', agentChanges: 1 })).toBe('Written · agents made 1 change')
    expect(rowNote({ state: 'clean', agentChanges: 3 })).toBe('Written · agents made 3 changes')
    expect(rowNote({ state: 'writing', agentChanges: 0 })).toBe('Being written…')
    expect(rowNote({ state: 'not-written', agentChanges: 0 })).toBe('Not written yet')
  })
})

describe('href', () => {
  it('always links to the section (no finding anchors)', () => {
    const res = derive({ qaFindings: [finding({ _id: 'f9' })], claimRows: [claim()] })
    expect(row(res, 'game').href).toBe('/s/game')
    expect(row(derive(), 'originStory').href).toBe('/s/originStory')
  })
})

describe('footer', () => {
  const base = {
    stateKind: 'run' as const,
    issue: { held: false, published: false } as { held: boolean; published: boolean } | null | undefined,
    publishedAt: undefined as number | null | undefined,
    runStatus: 'awaiting-review' as string | undefined,
    runCompletedAt: 1000 as number | undefined,
  }

  it('copy constants', () => {
    expect(RUNNING_SENTENCE).toBe('Still writing — Publish turns on when the agents finish.')
    expect(READY_SENTENCE).toBe('Ready to publish. The agents reviewed every section and fixed what they found.')
  })

  it('is ready even with open findings and contradicted claims (nothing blocks)', () => {
    const sections = derive({ qaFindings: [finding()], claimRows: [claim()] })
    expect(deriveHomeFooter({ ...base, sections })).toEqual({ kind: 'ready' })
  })

  it('is ready even when a story is not written in a completed run', () => {
    const d = fullDraft()
    delete d.sections.caseStudy
    expect(deriveHomeFooter({ ...base, sections: derive({ draft: d }) })).toEqual({ kind: 'ready' })
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

  it('a cancelled run reads as stopped (never an endless skeleton)', () => {
    expect(deriveHomeFooter({ ...base, sections: derive(), runStatus: 'cancelled' })).toEqual({ kind: 'stopped' })
    const t = { ...base, sections: undefined, issue: undefined }
    expect(deriveHomeFooter({ ...t, runStatus: 'cancelled' }).kind).toBe('stopped')
  })

  it('runStatus complete reads as published even when issues.published is false', () => {
    const f = deriveHomeFooter({ ...base, sections: derive(), runStatus: 'complete', publishedAt: undefined })
    expect(f).toEqual({ kind: 'published', publishedAt: null })
  })

  it('terminal kinds resolve before content inputs load', () => {
    const t = { ...base, sections: undefined, issue: undefined }
    expect(deriveHomeFooter({ ...t, runStatus: 'failed' }).kind).toBe('failed')
    expect(deriveHomeFooter({ ...t, runStatus: 'running' }).kind).toBe('running')
    expect(deriveHomeFooter({ ...t, runStatus: 'complete' }).kind).toBe('published')
    expect(deriveHomeFooter({ ...t, runStatus: 'awaiting-review', runCompletedAt: undefined }).kind).toBe('gate1')
    expect(deriveHomeFooter({ ...t, stateKind: 'none', runStatus: undefined }).kind).toBe('none')
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
    expect(deriveHomeFooter({ ...ok, issue: undefined })).toEqual({ kind: 'loading' })
  })
})
