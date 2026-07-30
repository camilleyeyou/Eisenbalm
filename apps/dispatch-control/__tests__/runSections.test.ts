/**
 * quick 260730-ldn (Task 3) — pure tests for `lib/runSections.ts`. Fixtures
 * only — no Convex, no DOM (node environment, default per vitest.config.ts).
 */
import { describe, it, expect } from 'vitest'
import { deriveRunSectionFindings, deriveRunSections, type RunSectionFindingRow } from '../lib/runSections'
import type { DraftResponse } from '../lib/contentPatchClient'

const SECTION_ID_ORDER = [
  'originStory',
  'problemStatement',
  'founderBio',
  'caseStudy',
  'bonus',
  'game',
  'deliberation-conversation',
  'podcast',
  'theme',
]

function makeDraft(overrides: Partial<DraftResponse> = {}): DraftResponse {
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

function makeFinding(overrides: Partial<RunSectionFindingRow> = {}): RunSectionFindingRow {
  return {
    _id: 'f1',
    sectionName: 'origin_story',
    severity: 'error',
    ...overrides,
  }
}

describe('deriveRunSectionFindings', () => {
  it('buckets a factual-axis error finding as mustFix', () => {
    const counts = deriveRunSectionFindings([
      makeFinding({ sectionName: 'origin_story', severity: 'error', axis: 'precision' }),
    ])
    expect(counts?.originStory).toEqual({ mustFix: 1, voice: 0 })
  })

  it('treats an axis-undefined error finding as factual (must-fix), not voice — §36.3 conservative default', () => {
    const counts = deriveRunSectionFindings([
      makeFinding({ sectionName: 'origin_story', severity: 'error', axis: undefined }),
    ])
    expect(counts?.originStory).toEqual({ mustFix: 1, voice: 0 })
  })

  it('buckets a voice-axis finding as voice regardless of severity', () => {
    const counts = deriveRunSectionFindings([
      makeFinding({ sectionName: 'origin_story', severity: 'info', axis: 'gravity' }),
    ])
    expect(counts?.originStory).toEqual({ mustFix: 0, voice: 1 })
  })

  it('excludes accepted/dismissed findings from both counts (via isOpenFinding)', () => {
    const counts = deriveRunSectionFindings([
      makeFinding({ _id: 'f1', axis: 'precision', resolution: 'accepted' }),
      makeFinding({ _id: 'f2', axis: 'precision', resolution: 'dismissed' }),
    ])
    expect(counts?.originStory).toBeUndefined()
  })

  it('drops a finding whose sectionName maps to null (e.g. podcast) — never bucketed into an adjacent section', () => {
    const counts = deriveRunSectionFindings([makeFinding({ sectionName: 'podcast' })])
    expect(counts).toEqual({})
  })

  it('returns undefined (not an all-zero map) when qaFindings has not loaded', () => {
    expect(deriveRunSectionFindings(undefined)).toBeUndefined()
  })
})

describe('deriveRunSections — draft === null (not loaded / failed to load)', () => {
  it('reports every row as unavailable — unknown state, not generated, never "pending"', () => {
    const rows = deriveRunSections(null, {})
    expect(rows).toHaveLength(9)
    for (const row of rows) {
      expect(row.state).toBe('unknown')
      expect(row.generated).toBe(false)
      expect(row.headline).toBeNull()
      expect(row.meta).toBe('Unavailable')
    }
  })
})

describe('deriveRunSections — row order and shape', () => {
  it('returns exactly 9 rows in EDITABLE_SECTIONS order', () => {
    const rows = deriveRunSections(makeDraft(), {})
    expect(rows.map(r => r.id)).toEqual(SECTION_ID_ORDER)
  })

  it('never carries a "last edited" value on any row — no data source exists for it', () => {
    const draft = makeDraft({
      sections: {
        originStory: { headline: 'H', blocks: [{ type: 'paragraph', text: 'Hello world.' }], lossy: false },
      },
    })
    const rows = deriveRunSections(draft, {})
    for (const row of rows) {
      expect('lastEdited' in row).toBe(false)
      expect('editedAt' in row).toBe(false)
    }
  })
})

describe('deriveRunSections — a generated long-read section', () => {
  it('reads headline, excerpt, word count, and a word-count-shaped meta from the draft', () => {
    const draft = makeDraft({
      sections: {
        originStory: {
          headline: 'The Ledger Nobody Kept',
          blocks: [
            { type: 'paragraph', text: 'Margaret Osei spent thirty-one years reconciling ledgers.' },
          ],
          lossy: false,
        },
      },
    })
    const row = deriveRunSections(draft, {}).find(r => r.id === 'originStory')!
    expect(row.generated).toBe(true)
    expect(row.headline).toBe('The Ledger Nobody Kept')
    expect(row.excerpt).toBe('Margaret Osei spent thirty-one years reconciling ledgers.')
    expect(row.wordCount).toBe(7)
    expect(row.meta).toBe('7 words')
  })
})

describe('deriveRunSections — a section absent from the draft', () => {
  it('is not generated, pending, headline null, "Not generated" meta', () => {
    const row = deriveRunSections(makeDraft(), {}).find(r => r.id === 'theme')!
    expect(row.generated).toBe(false)
    expect(row.state).toBe('pending')
    expect(row.headline).toBeNull()
    expect(row.meta).toBe('Not generated')
  })
})

describe('deriveRunSections — state precedence on a generated section', () => {
  const draft = makeDraft({
    sections: { originStory: { blocks: [{ type: 'paragraph', text: 'Hello world.' }], lossy: false } },
  })

  it('mustFix > 0 -> "must-fix"', () => {
    const row = deriveRunSections(draft, { originStory: { mustFix: 1, voice: 2 } }).find(
      r => r.id === 'originStory',
    )!
    expect(row.state).toBe('must-fix')
  })

  it('mustFix === 0 && voice > 0 -> "voice"', () => {
    const row = deriveRunSections(draft, { originStory: { mustFix: 0, voice: 1 } }).find(
      r => r.id === 'originStory',
    )!
    expect(row.state).toBe('voice')
  })

  it('mustFix === 0 && voice === 0 -> "clean"', () => {
    const row = deriveRunSections(draft, { originStory: { mustFix: 0, voice: 0 } }).find(
      r => r.id === 'originStory',
    )!
    expect(row.state).toBe('clean')
  })
})

describe('deriveRunSections — counts === undefined (findings not loaded)', () => {
  it('reports every GENERATED row as "unknown", never "clean" — a non-generated row stays "pending"', () => {
    const draft = makeDraft({
      sections: { originStory: { blocks: [{ type: 'paragraph', text: 'Hello world.' }], lossy: false } },
    })
    const rows = deriveRunSections(draft, undefined)
    const originStory = rows.find(r => r.id === 'originStory')!
    expect(originStory.state).toBe('unknown')
    expect(originStory.state).not.toBe('clean')
    const theme = rows.find(r => r.id === 'theme')!
    expect(theme.state).toBe('pending')
  })
})

describe('deriveRunSections — game', () => {
  it('generated true, wordCount null (not a meaningful measure), meta "Interactive"', () => {
    const draft = makeDraft({ game: { embedCode: '<div>play</div>' } })
    const row = deriveRunSections(draft, {}).find(r => r.id === 'game')!
    expect(row.generated).toBe(true)
    expect(row.wordCount).toBeNull()
    expect(row.meta).toBe('Interactive')
  })
})

describe('deriveRunSections — deliberation-conversation', () => {
  it('excerpt = first turn text, wordCount summed across all turns', () => {
    const draft = makeDraft({
      conversation: [
        { speaker: 'Advocate', text: 'Kumasi deserves the spot.' },
        { speaker: 'Editor', text: 'Agreed, unanimously.' },
      ],
    })
    const row = deriveRunSections(draft, {}).find(r => r.id === 'deliberation-conversation')!
    expect(row.generated).toBe(true)
    expect(row.excerpt).toBe('Kumasi deserves the spot.')
    expect(row.wordCount).toBe(6)
  })
})

describe('deriveRunSections — bonus', () => {
  it('specAd with body blocks reads excerpt/word count from bonus.body', () => {
    const draft = makeDraft({
      bonusType: 'specAd',
      bonus: { body: [{ type: 'paragraph', text: 'Corrugate, thatch, tarpaulin.' }] },
    })
    const row = deriveRunSections(draft, {}).find(r => r.id === 'bonus')!
    expect(row.generated).toBe(true)
    expect(row.excerpt).toBe('Corrugate, thatch, tarpaulin.')
    expect(row.wordCount).toBe(3)
  })

  it('any other bonusType is still generated (payload non-empty) but wordCount is null', () => {
    const draft = makeDraft({
      bonusType: 'jingle',
      bonus: { lyrics: 'La la la', sunoPrompt: 'upbeat, warm' },
    })
    const row = deriveRunSections(draft, {}).find(r => r.id === 'bonus')!
    expect(row.generated).toBe(true)
    expect(row.wordCount).toBeNull()
  })
})

describe('deriveRunSections — theme / podcast', () => {
  it('non-empty payloads: generated true, headline null, wordCount null', () => {
    const draft = makeDraft({
      theme: { primaryColor: '#111111' },
      podcast: { transcript: 'hello' },
    })
    const rows = deriveRunSections(draft, {})
    for (const id of ['theme', 'podcast']) {
      const row = rows.find(r => r.id === id)!
      expect(row.generated).toBe(true)
      expect(row.headline).toBeNull()
      expect(row.wordCount).toBeNull()
    }
  })
})
