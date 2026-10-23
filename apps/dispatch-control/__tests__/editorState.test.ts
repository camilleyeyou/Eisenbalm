import { describe, it, expect } from 'vitest'
import type { HomeFooter, HomeSectionRow } from '../lib/homeSections'
import {
  deriveEditorHome,
  homeSlabCopy,
  partRowStatus,
  partsHint,
  runStatusWord,
  deriveArchiveRows,
  canRewrite,
  formatCostLine,
  EDITOR_BANNED_PATTERN,
  RUN_ID_PATTERN,
  COPY,
  PART_ORDER,
  PART_LABELS,
  AGENT_FOR_SECTION,
  type HomeState,
} from '../lib/editorState'

const row = (state: HomeSectionRow['state'], agentChanges = 0): HomeSectionRow => ({
  id: 'x', label: 'X', headline: 'X', state, agentChanges, href: '/s/x',
})
const rows = (clean: number, changes = 0): HomeSectionRow[] =>
  Array.from({ length: 9 }, (_, i) => row(i < clean ? 'clean' : 'not-written', i === 0 ? changes : 0))
const EIC = 'Editor-in-chief' as const

const home = (footer: HomeFooter, o: Partial<Parameters<typeof deriveEditorHome>[0]> = {}) =>
  deriveEditorHome({ footer, held: false, role: EIC, rows: rows(0), ...o })

describe('deriveEditorHome states', () => {
  it('loading / empty', () => {
    expect(home({ kind: 'loading' }).state).toBe('loading')
    const e = home({ kind: 'none' })
    expect(e.state).toBe('empty')
    expect(e.word).toBeNull()
  })
  it('writing and checking are Working', () => {
    const w = home({ kind: 'running' }, { rows: rows(5) })
    expect(w.state).toBe('writing')
    expect(w.word).toBe('Working')
    expect(home({ kind: 'running' }, { rows: rows(9) }).state).toBe('checking')
  })
  it('ready by role', () => {
    const r = home({ kind: 'ready' }, { rows: rows(9) })
    expect(r.state).toBe('ready')
    expect(r.word).toBe('Waiting for you')
    expect(r.publishable).toBe(true)
    const c = home({ kind: 'ready' }, { rows: rows(9), role: 'Collaborator' })
    expect(c.state).toBe('ready-collab')
    expect(c.word).toBe('Not yet')
    expect(c.publishable).toBe(false)
    const u = home({ kind: 'ready' }, { rows: rows(9), role: undefined })
    expect(u.state).toBe('ready')
    expect(u.publishable).toBe(false)
    expect(homeSlabCopy(u, { issueNumber: 48, now: 0 }).action).toBeUndefined()
    expect(homeSlabCopy(u, { issueNumber: 48, now: 0 }).sentence).not.toMatch(/editor-in-chief/)
  })
  it('held for any role, ready or running', () => {
    expect(home({ kind: 'ready' }, { held: true, role: 'Collaborator' }).state).toBe('held')
    expect(home({ kind: 'running' }, { held: true }).state).toBe('held')
    expect(home({ kind: 'ready' }, { held: true }).word).toBe('Waiting for you')
  })
  it('terminal states', () => {
    expect(home({ kind: 'published', publishedAt: 1 }).word).toBe('Done')
    expect(home({ kind: 'stopped' }).word).toBe('Stopped')
    expect(home({ kind: 'failed' }).word).toBe('Problem')
  })
  it('gate1 → stuck, never Problem', () => {
    const s = home({ kind: 'gate1' })
    expect(s.state).toBe('stuck')
    expect(s.word).toBe('Waiting for you')
    expect(s.stations.some((x) => x.word === 'Problem')).toBe(false)
  })
  it('pinned older is read-only', () => {
    const o = home({ kind: 'ready' }, { rows: rows(9), pinnedOlder: true })
    expect(o.state).toBe('older')
    expect(o.publishable).toBe(false)
    expect(home({ kind: 'failed' }, { pinnedOlder: true }).state).toBe('problem')
  })
})

describe('stations', () => {
  it('always four, correct names', () => {
    for (const f of [{ kind: 'loading' }, { kind: 'none' }, { kind: 'ready' }, { kind: 'failed' }] as HomeFooter[]) {
      expect(home(f).stations.map((s) => s.name)).toEqual(['Pick charity', 'Write', 'Check', 'Publish'])
    }
  })
  it('writing w=5', () => {
    const s = home({ kind: 'running' }, { rows: rows(5) }).stations
    expect(s[0].word).toBe('Done')
    expect(s[1]).toMatchObject({ line: 'Working · 5 of 9 parts', current: true, word: 'Working' })
    expect(s[2].line).toBe('Not yet')
    expect(s[3].line).toBe('Not yet')
  })
  it('checking', () => {
    const s = home({ kind: 'running' }, { rows: rows(9) }).stations
    expect(s[1].line).toBe('Done · all nine parts')
    expect(s[2]).toMatchObject({ word: 'Working', current: true })
  })
  it('ready fixes pluralise', () => {
    const six = home({ kind: 'ready' }, { rows: rows(9, 6) }).stations
    expect(six[2].line).toBe('Done · 6 fixes made')
    expect(six[3]).toMatchObject({ line: 'Now — waiting for you', current: true })
    expect(home({ kind: 'ready' }, { rows: rows(9, 1) }).stations[2].line).toBe('Done · 1 fix made')
  })
  it('collaborator publish line', () => {
    const s = home({ kind: 'ready' }, { rows: rows(9), role: 'Collaborator' }).stations
    expect(s[3].line).toBe('Now — waiting for the editor-in-chief')
  })
  it('published', () => {
    const thu = Date.UTC(2026, 9, 22, 18, 0)
    const s = home({ kind: 'published', publishedAt: thu }, { rows: rows(9) })
    expect(s.stations[3].line).toBe('Done · Thursday 22 October')
    expect(s.stations.some((x) => x.current)).toBe(false)
  })
  it('problem and stopped land on the right station', () => {
    expect(home({ kind: 'failed' }, { rows: rows(4) }).stations[1].word).toBe('Problem')
    expect(home({ kind: 'failed' }, { rows: rows(9) }).stations[2].word).toBe('Problem')
    expect(home({ kind: 'stopped' }, { rows: rows(4) }).stations[1].word).toBe('Stopped')
  })
  it('exactly one current station in active states', () => {
    for (const f of [{ kind: 'running' }, { kind: 'ready' }, { kind: 'failed' }, { kind: 'gate1' }] as HomeFooter[]) {
      expect(home(f, { rows: rows(3) }).stations.filter((s) => s.current)).toHaveLength(1)
    }
    expect(home({ kind: 'loading' }).stations.some((s) => s.current)).toBe(false)
  })
})

describe('partRowStatus', () => {
  it('clean rows', () => {
    expect(partRowStatus({ state: 'clean', agentChanges: 0 }, { published: false }).text).toBe('Written')
    expect(partRowStatus({ state: 'clean', agentChanges: 1 }, { published: false }).text).toBe('Written · 1 fix by the writers')
    expect(partRowStatus({ state: 'clean', agentChanges: 2 }, { published: false }).text).toBe('Written · 2 fixes by the writers')
  })
  it('not linked until written', () => {
    expect(partRowStatus({ state: 'writing', agentChanges: 0 }, { published: false })).toEqual({ text: 'Working', word: 'Working', linked: false })
    expect(partRowStatus({ state: 'not-written', agentChanges: 0 }, { published: false })).toEqual({ text: 'Not yet', word: 'Not yet', linked: false })
  })
  it('published', () => {
    expect(partRowStatus({ state: 'clean', agentChanges: 3 }, { published: true })).toEqual({ text: 'Published', word: 'Done', linked: true })
  })
  it('nine parts in order', () => {
    expect(PART_ORDER).toHaveLength(9)
    expect(PART_ORDER.every((k) => PART_LABELS[k])).toBe(true)
    expect(partsHint('writing')).toContain('as soon as')
  })
})

describe('runStatusWord', () => {
  it('maps', () => {
    expect(runStatusWord({ status: 'complete' })).toBe('Done')
    expect(runStatusWord({ status: 'cancelled' })).toBe('Stopped')
    expect(runStatusWord({ status: 'failed' })).toBe('Problem')
    expect(runStatusWord({ status: 'failed', interrupt: true })).toBe('Waiting for you')
    expect(runStatusWord({ status: 'running' })).toBe('Working')
    expect(runStatusWord({ status: 'awaiting-review' })).toBe('Waiting for you')
    expect(runStatusWord({ status: 'queued' })).toBe('Not yet')
  })
})

describe('deriveArchiveRows', () => {
  const T = Date.UTC(2026, 9, 22, 18, 0)
  const issues = [
    { issueNumber: 47, title: 'Alpha Trust', published: true, runId: 'r47', publishedAt: T },
    { issueNumber: 48, title: 'Beta Fund', published: false, runId: 'r48', runStartedAt: Date.UTC(2026, 9, 26, 16, 2) },
    { issueNumber: 46, title: null, published: false, runId: 'r46', runStartedAt: T - 7 * 86400000 },
    { issueNumber: 45, title: 'Gamma', published: false, runId: 'r45', runStartedAt: T - 14 * 86400000 },
    { issueNumber: 44, title: null, published: false, runId: null },
    { issueNumber: 43, title: 'Delta', published: false, runId: 'r43', runStartedAt: T - 21 * 86400000 },
  ]
  const runs = [
    { runId: 'r47', status: 'complete', startedAt: T },
    { runId: 'r48', status: 'awaiting-review', startedAt: T, completedAt: T + 1 },
    { runId: 'r46', status: 'cancelled', startedAt: T },
    { runId: 'r45', status: 'failed', startedAt: T },
    { runId: 'r43', status: 'awaiting-review', startedAt: T, completedAt: T },
  ]
  it('undefined while runs load', () => {
    expect(deriveArchiveRows({ issues, runs: undefined, currentRunId: 'r48' })).toBeUndefined()
  })
  it('groups, flags and sorts', () => {
    const r = deriveArchiveRows({ issues, runs, currentRunId: 'r48' })!
    expect(r.listed.map((x) => x.issueNumber)).toEqual([48, 47])
    expect(r.listed[0]).toMatchObject({ current: true, statusText: 'Waiting for you · this week', word: 'Waiting for you' })
    expect(r.listed[1]).toMatchObject({ statusText: 'Published', word: 'Done', dateLine: 'Issue 47 · 22 October 2026' })
    expect(r.unfinished.map((x) => x.issueNumber)).toEqual([46, 45, 43])
    expect(r.unfinished[0]).toMatchObject({ word: 'Stopped', reason: 'Stopped before a charity was chosen', title: 'Charity not chosen yet' })
    expect(r.unfinished[1]).toMatchObject({ word: 'Problem', reason: 'Hit a problem while it was being written' })
    expect(r.unfinished[2].reason).toBe('Never finished')
    expect([...r.listed, ...r.unfinished].some((x) => x.issueNumber === 44)).toBe(false)
  })
  it('running current row is Working', () => {
    const r = deriveArchiveRows({ issues, runs: [{ runId: 'r48', status: 'running', startedAt: T }], currentRunId: 'r48' })!
    expect(r.listed.find((x) => x.current)).toMatchObject({ word: 'Working', statusText: 'Working' })
  })
})

describe('canRewrite', () => {
  const ok = { published: false, runStatus: 'awaiting-review' }
  it('text sections and specAd', () => {
    for (const s of ['originStory', 'problemStatement', 'founderBio', 'caseStudy']) expect(canRewrite({ sectionId: s, ...ok })).toBe(true)
    expect(canRewrite({ sectionId: 'bonus', bonusType: 'specAd', ...ok })).toBe(true)
  })
  it('never for the rest', () => {
    for (const s of ['game', 'theme', 'deliberation-conversation', 'podcast']) expect(canRewrite({ sectionId: s, ...ok })).toBe(false)
    expect(canRewrite({ sectionId: 'bonus', bonusType: 'jingle', ...ok })).toBe(false)
    expect(canRewrite({ sectionId: 'bonus', bonusType: 'bigBudget', ...ok })).toBe(false)
    expect(canRewrite({ sectionId: 'originStory', published: true })).toBe(false)
    expect(canRewrite({ sectionId: 'originStory', published: false, runStatus: 'running' })).toBe(false)
    expect(AGENT_FOR_SECTION.originStory).toBe('origin_story')
  })
})

describe('formatCostLine', () => {
  it('finished / stopped / unknown', () => {
    expect(formatCostLine({ costUsd: 0.58, startedAt: 0, completedAt: 39 * 60000, mode: 'finished' })).toBe('This issue cost $0.58 to write and took 39 minutes.')
    expect(formatCostLine({ costUsd: 0.58, mode: 'finished' })).toBe('This issue cost $0.58 to write.')
    expect(formatCostLine({ costUsd: 0.21, mode: 'stopped' })).toBe('This attempt cost $0.21 before it stopped.')
    expect(formatCostLine({ costUsd: undefined, mode: 'finished' })).toBeNull()
  })
})

describe('banned words', () => {
  it('pattern hits jargon and spares plain copy', () => {
    for (const s of ['Trigger Run', 'Re-roll', 'Calibrator', 'agent', 'Failed', 'pipeline']) expect(EDITOR_BANNED_PATTERN.test(s)).toBe(true)
    for (const s of ['Rewrite this part', 'returns', 'Start a new issue']) expect(EDITOR_BANNED_PATTERN.test(s)).toBe(false)
  })
  it('every slab string and COPY value is clean, one action max', () => {
    const states: HomeState[] = ['loading', 'empty', 'writing', 'checking', 'ready', 'ready-collab', 'held', 'published', 'stopped', 'problem', 'stuck', 'older']
    const ctx = { issueNumber: 48, startedAt: Date.UTC(2026, 9, 26, 16, 2), publishedAt: Date.UTC(2026, 9, 22, 18, 0), now: Date.UTC(2026, 9, 26, 20, 0) }
    for (const state of states) {
      const vm = { state, word: null, stations: [], writtenCount: 5, fixCount: 0, publishable: state === 'ready' }
      for (const pinned of [false, true]) {
        const c = homeSlabCopy(vm, { ...ctx, pinned })
        const strings = [c.sentence, c.explanation, c.actionLabel, c.linkLabel].filter(Boolean) as string[]
        for (const s of strings) {
          expect(EDITOR_BANNED_PATTERN.test(s), `${state}: ${s}`).toBe(false)
          expect(RUN_ID_PATTERN.test(s), `${state}: ${s}`).toBe(false)
        }
        expect(Number(Boolean(c.action))).toBeLessThanOrEqual(1)
      }
    }
    for (const [k, v] of Object.entries(COPY)) expect(EDITOR_BANNED_PATTERN.test(v), k).toBe(false)
  })
  it('writing slab wording', () => {
    const vm = home({ kind: 'running' }, { rows: rows(5) })
    const c = homeSlabCopy(vm, { issueNumber: 48, startedAt: Date.UTC(2026, 9, 26, 16, 2), now: Date.UTC(2026, 9, 26, 20, 0) })
    expect(c.explanation).toBe('Issue 48 started at 9:02 this morning. Five of the nine parts are written. This page updates by itself, so come back when it says the issue is ready.')
    expect(c.working).toBe(true)
    expect(homeSlabCopy(home({ kind: 'ready' }, { rows: rows(9) }), { issueNumber: 48, now: 0 }).actionLabel).toBe('Publish Issue 48')
  })
})
