import { describe, it, expect } from 'vitest'
import {
  firstSentences, tickerLines, heroHeadline, heroDek, factChips, keyFigure, statTiles,
  readTimeLabel, deliberationCards, editorConfidence, caseTimeline, adSummary, pullQuote,
  impactRange, impactProgress, balmsFromCents, filterIssues, backIssues, issueDateLabel,
  monthYearLabel,
} from '@/lib/dispatch/derive'
import { fullIssue, sparseIssue, oneCandidateIssue, archiveIssues } from './fixtures/issue'

describe('firstSentences', () => {
  it('splits sentences', () => {
    expect(firstSentences('A. B. C.', 1)).toBe('A.')
    expect(firstSentences('Acme Inc. repairs chairs. It is old.', 1)).toBe('Acme Inc. repairs chairs.')
    expect(firstSentences('no period here', 1)).toBe('no period here')
    expect(firstSentences('   ', 1)).toBeNull()
    expect(firstSentences(null)).toBeNull()
  })
  it.each(['e.g.', 'i.e.', 'Co.', 'Corp.', 'Ltd.', 'St.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'U.S.', 'No.', 'vs.', 'etc.'])(
    'does not split on %s', (abbr) => {
      const t = `We met ${abbr} Arthur at noon. Then left.`
      expect(firstSentences(t, 1)).toBe(`We met ${abbr} Arthur at noon.`)
    })
})

describe('hero / ticker', () => {
  it('ticker uses frontPage lines', () => {
    expect(tickerLines(fullIssue)).toEqual(fullIssue.frontPage!.tickerLines)
  })
  it('ticker trims, drops empties, caps at 8', () => {
    const i = { ...fullIssue, frontPage: { ...fullIssue.frontPage!, tickerLines: [' a ', '', ...Array(10).fill('x')] } }
    const t = tickerLines(i)
    expect(t[0]).toBe('a')
    expect(t).toHaveLength(8)
  })
  it('ticker derives when no frontPage', () => {
    const i = { ...fullIssue, frontPage: undefined }
    expect(tickerLines(i)).toEqual([
      'This week: Acme Mobility Cooperative', 'Wheelchair repair', 'Dayton, Ohio', 'Founded 1998',
      '42% of chairs wait over 90 days for repair', '$1,200 average repair cost', 'Most repair shops closed in the last decade',
    ])
  })
  it('headline and dek', () => {
    expect(heroHeadline(fullIssue)).toBe('The Chair Is Not Optional')
    expect(heroHeadline(sparseIssue)).toBe('Bare Charity')
    expect(heroDek(fullIssue)).toBe('Wheelchairs wait. Acme does not.')
    expect(heroDek({ ...fullIssue, frontPage: undefined })).toBe(
      'Acme repairs wheelchairs for people who cannot wait. It has done so since 1998.')
    expect(heroDek(sparseIssue)).toBeNull()
  })
})

describe('chips / figures', () => {
  it('factChips', () => {
    expect(factChips(fullIssue.charity).map((c) => c.label)).toEqual(['What they do', 'Size', 'Based in', 'Founded'])
    expect(factChips(sparseIssue.charity)).toEqual([{ label: 'Based in', value: 'Nowhere, Ohio' }])
  })
  it('keyFigure', () => {
    expect(keyFigure('42% of chairs wait over 90 days')).toEqual({ figure: '42%', caption: 'of chairs wait over 90 days' })
    expect(keyFigure('$1,200 average repair cost')).toEqual({ figure: '$1,200', caption: 'average repair cost' })
    expect(keyFigure('$1.2 billion in deferred repairs')).toEqual({ figure: null, caption: '$1.2 billion in deferred repairs' })
    expect(keyFigure('Most shops closed')).toEqual({ figure: null, caption: 'Most shops closed' })
  })
  it('statTiles', () => {
    expect(statTiles(fullIssue)).toHaveLength(3)
    expect(statTiles(sparseIssue)).toEqual([])
  })
  it('readTimeLabel', () => {
    expect(readTimeLabel(0)).toBe('1-minute read')
    expect(readTimeLabel(7.4)).toBe('7-minute read')
  })
})

describe('deliberation', () => {
  it('cards', () => {
    const c = deliberationCards(fullIssue)
    expect(c.map((x) => x.kind)).toEqual(['picked', 'runner-up', 'also', 'also'])
    expect(c[0]!.name).toBe('Acme Mobility Cooperative')
    expect(c[0]!.blurb).toBe('Acme was selected.')
    expect(c[1]!.name).toBe('Second Street Pantry')
    expect(c[1]!.blurb).toBe('Second Street Pantry came close. It will be reconsidered.')
  })
  it('one candidate / sparse', () => {
    expect(deliberationCards(oneCandidateIssue).map((x) => x.kind)).toEqual(['picked'])
    expect(deliberationCards(sparseIssue)).toEqual([])
  })
  it('missing runnerUpNotes -> null blurb', () => {
    const i = { ...fullIssue, selectionDeliberation: { ...fullIssue.selectionDeliberation!, runnerUpNotes: null } }
    expect(deliberationCards(i)[1]!.blurb).toBeNull()
  })
  it('confidence', () => {
    expect(editorConfidence(fullIssue)).toBe(0.8)
    expect(editorConfidence(oneCandidateIssue)).toBeNull()
    expect(editorConfidence(sparseIssue)).toBeNull()
    for (const v of [NaN, 1.5, -0.1, null]) {
      expect(editorConfidence({ ...fullIssue, selectionDeliberation: { ...fullIssue.selectionDeliberation!, editorConfidence: v } })).toBeNull()
    }
  })
})

describe('case / ad / quotes', () => {
  it('caseTimeline', () => {
    expect(caseTimeline(fullIssue)).toHaveLength(4)
    expect(caseTimeline(sparseIssue)).toEqual([])
    const i = { ...fullIssue, frontPage: { ...fullIssue.frontPage!, caseTimeline: [{ label: '', value: 'x' }, { label: 'a', value: 'b' }] } }
    expect(caseTimeline(i)).toEqual([{ label: 'a', value: 'b' }])
  })
  it('adSummary', () => {
    expect(adSummary(fullIssue)!.rows).toHaveLength(3)
    expect(adSummary({ ...fullIssue, bonusType: 'jingle' })).toBeNull()
    expect(adSummary(sparseIssue)).toBeNull()
  })
  it('pullQuote', () => {
    expect(pullQuote(fullIssue, 'origin')).toBe('It has not left the garage in spirit.')
    expect(pullQuote(sparseIssue, 'case')).toBeNull()
  })
})

describe('impact', () => {
  it('range', () => {
    expect(impactRange(fullIssue, 899)).toEqual({ min: 14, max: 21, unit: 'wheelchair' })
    expect(impactRange(sparseIssue, 899)).toBeNull()
    const mk = (u: object) => ({ ...fullIssue, frontPage: { ...fullIssue.frontPage!, impactUnit: u as never } })
    expect(impactRange(mk({ label: '', costMinUsd: 1, costMaxUsd: 2 }), 899)).toBeNull()
    expect(impactRange(mk({ label: 'x', costMinUsd: 0, costMaxUsd: 2 }), 899)).toBeNull()
    expect(impactRange(mk({ label: 'x', costMinUsd: 5, costMaxUsd: 2 }), 899)).toBeNull()
  })
  it('progress / balms', () => {
    const r = { min: 14, max: 21, unit: 'w' }
    expect(impactProgress(7, r)).toBe(0.5)
    expect(impactProgress(40, r)).toBe(1)
    expect(impactProgress(-3, r)).toBe(0)
    expect(balmsFromCents(1798, 899)).toBe(2)
    expect(balmsFromCents(-5, 899)).toBe(0)
  })
})

describe('archive', () => {
  it('filter', () => {
    expect(filterIssues(archiveIssues, '')).toHaveLength(10)
    expect(filterIssues(archiveIssues, '  CHARITY NUMBER 7 ').map((i) => i.issueNumber)).toEqual([7])
    for (const q of ['3', 'no. 3', 'No.3', '#3']) {
      expect(filterIssues(archiveIssues, q).map((i) => i.issueNumber)).toEqual([3])
    }
    expect(filterIssues(archiveIssues, 'literacy').length).toBeGreaterThan(0)
    expect(filterIssues(archiveIssues, 'toledo').length).toBeGreaterThan(0)
  })
  it('backIssues', () => {
    const b = backIssues(archiveIssues, 10)
    expect(b).toHaveLength(8)
    expect(b.some((i) => i.issueNumber === 10)).toBe(false)
    expect(b[0]!.issueNumber).toBe(9)
  })
  it('dates', () => {
    expect(issueDateLabel('2026-10-15')).toBe('Thursday, October 15, 2026')
    expect(monthYearLabel('2026-10-15')).toBe('October 2026')
    expect(issueDateLabel('nope')).toBeNull()
    expect(monthYearLabel(null)).toBeNull()
  })
})
