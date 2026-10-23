/**
 * Phase 56-12 — render-level copy scan over all seven screens. Every state
 * must be free of banned words, run ids and raw errors (outside <pre>), have
 * exactly one h1 and at most one [data-primary], and no disabled controls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { DraftResponse } from '@/lib/contentPatchClient'
import { IssueHomeView, type IssueHomeViewProps } from '@/app/(editorial)/_components/IssueHomeView'
import { ArchiveBody } from '../app/(editorial)/archive/_components/ArchiveBody'
import BehindHubView from '../app/admin/_components/BehindHubView'
import BehindRunView from '../app/admin/runs/_components/BehindRunView'
import {
  deriveEditorHome,
  homeSlabCopy,
  deriveArchiveRows,
  deriveBehindSteps,
  formatCostLine,
  PART_ORDER,
  EDITOR_BANNED_PATTERN,
  RUN_ID_PATTERN,
  COPY,
} from '@/lib/editorState'
import type { HomeFooter, HomeSectionRow } from '@/lib/homeSections'
import { ADMIN_ITEMS } from '../lib/nav'

const h = vi.hoisted(() => ({ getDraft: vi.fn() }))

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: vi.fn(async () => 'tok') }) }))
vi.mock('@/components/ui/ConfirmDialog', () => ({ useConfirm: () => vi.fn(async () => true) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }))
vi.mock('@/lib/contentPatchClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/contentPatchClient')>('@/lib/contentPatchClient')
  return { ...actual, getDraft: h.getDraft, patchSection: vi.fn(), patchBonus: vi.fn() }
})
vi.mock('@/components/galley/Galley', () => ({
  default: ({ sections }: { sections: string[] }) => <div data-testid="galley">galley {sections.join(',')}</div>,
}))

function runWith(published: boolean) {
  return {
    state: { kind: 'run' as const },
    runId: 'a1b2c3d4e5f6a7b8',
    issueNumber: 48,
    title: 'Kumasi Roofless Schools Trust',
    qaFindings: [],
    claimRows: [],
    derivationInputs: {
      issueNumber: 48,
      runId: 'a1b2c3d4e5f6a7b8',
      issue: { held: false, published },
      signOffs: {},
      claimRows: [],
      qaFindings: [],
      pitchRows: [],
      runStatus: published ? 'complete' : 'awaiting-review',
      runStartedAt: 1,
      runCompletedAt: 2,
    },
  }
}
let mockRun: Record<string, unknown> = runWith(false)
vi.mock('@/lib/useCurrentRun', () => ({ useCurrentRun: () => mockRun }))

const para = (text: string) => ({ type: 'paragraph' as const, text })
const draft: DraftResponse = {
  revisionId: 'rev_1',
  sections: {
    originStory: { headline: 'A Quiet Beginning', blocks: [para('One.')], lossy: false },
    problemStatement: { headline: 'The Problem', blocks: [para('Prob.')], lossy: false },
    founderBio: { headline: 'The Founder', blocks: [para('Alpha words.')], lossy: false },
    caseStudy: { headline: 'The Case', blocks: [para('Case.')], lossy: false },
  },
  theme: { fontDisplay: 'Newsreader', fontBody: 'Lora' },
  game: { headline: 'Play', description: 'd', embedCode: '<canvas></canvas>' },
  bonus: { headline: 'Spec Ad', body: [para('Imagine lip balm.')] },
  bonusType: 'specAd',
  podcast: { transcript: 'Host: hello.' },
  conversation: [{ speaker: 'Scout', text: 'Found one.' }],
}

beforeEach(() => {
  h.getDraft.mockReset().mockResolvedValue(draft)
  mockRun = runWith(false)
})
afterEach(cleanup)

function outsidePre(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll('pre').forEach((p) => p.remove())
  return clone.textContent ?? ''
}

function assertClean(container: HTMLElement, opts: { skeleton?: boolean } = {}) {
  const text = outsidePre(container)
  expect(text).not.toMatch(EDITOR_BANNED_PATTERN)
  expect(text).not.toMatch(RUN_ID_PATTERN)
  expect(text).not.toContain('Interrupt(')
  // The loading skeleton is the one state allowed to have no heading yet.
  expect(container.querySelectorAll('h1').length).toBe(opts.skeleton ? 0 : 1)
  expect(container.querySelectorAll('[data-primary]').length).toBeLessThanOrEqual(1)
  expect(container.querySelectorAll('[disabled]').length).toBe(0)
}

// ── Home ────────────────────────────────────────────────────────────────────
const THURSDAY = Date.UTC(2026, 9, 29, 12)
const NOW = Date.UTC(2026, 9, 27, 12)
const rows = (state: 'clean' | 'writing' = 'clean'): HomeSectionRow[] =>
  PART_ORDER.map((id) => ({
    id,
    label: id,
    headline: `Headline ${id}`,
    state,
    agentChanges: 0,
    href: `/s/${id}`,
  })) as HomeSectionRow[]

type Case = 'ready' | 'ready-collab' | 'writing' | 'held' | 'published' | 'empty' | 'problem' | 'stuck' | 'stopped' | 'loading'
const FOOTER: Record<Case, HomeFooter> = {
  ready: { kind: 'ready' },
  'ready-collab': { kind: 'ready' },
  writing: { kind: 'running' },
  held: { kind: 'ready' },
  published: { kind: 'published', publishedAt: THURSDAY },
  empty: { kind: 'none' },
  problem: { kind: 'failed' },
  stuck: { kind: 'gate1' },
  stopped: { kind: 'stopped' },
  loading: { kind: 'loading' },
}

function homeProps(c: Case): IssueHomeViewProps {
  const noRows = c === 'empty' || c === 'loading'
  const r = c === 'writing' ? rows('writing') : rows()
  const vm = deriveEditorHome({
    footer: FOOTER[c],
    held: c === 'held',
    role: c === 'ready-collab' ? 'Collaborator' : 'Editor-in-chief',
    rows: noRows ? [] : r,
  })
  const slab = homeSlabCopy(vm, { issueNumber: 48, startedAt: NOW, publishedAt: THURSDAY, now: NOW })
  return {
    vm,
    slab,
    issueLine: 'Issue 48 · Thursday 29 October 2026',
    charityName: 'Kumasi Roofless Schools Trust',
    blurb: 'A two-person water lab.',
    rows: noRows ? undefined : r,
    hrefFor: (row) => `/s/${row.id}`,
    onPrimary: vi.fn(),
    primaryBusy: false,
    actionError: null,
    links: { preview: 'https://preview.example/i', website: 'https://site.example/i', whatHappened: '/admin/runs/a1b2c3d4e5f6a7b8' },
    footer: null,
    draftError: null,
    onReload: vi.fn(),
    live: null,
  }
}

describe('copy scan: Home', () => {
  const cases: Case[] = ['ready', 'ready-collab', 'writing', 'held', 'published', 'empty', 'problem', 'stuck', 'stopped', 'loading']
  it.each(cases)('%s', (c) => {
    const { container } = render(<IssueHomeView {...homeProps(c)} />)
    assertClean(container, { skeleton: c === 'loading' })
  })
})

// ── Section ─────────────────────────────────────────────────────────────────
describe('copy scan: Section', () => {
  async function renderSection(section: string) {
    const { default: Page } = await import('../app/(editorial)/s/[section]/page')
    return render(<Page params={{ section }} searchParams={undefined} />)
  }
  it('founderBio', async () => {
    const { container } = await renderSection('founderBio')
    await screen.findByText('Alpha words.')
    assertClean(container)
  })
  it('game', async () => {
    const { container } = await renderSection('game')
    await screen.findByTestId('galley')
    assertClean(container)
  })
  it('founderBio, published', async () => {
    mockRun = runWith(true)
    const { container } = await renderSection('founderBio')
    await screen.findByText('Alpha words.')
    assertClean(container)
  })
})

// ── Archive ─────────────────────────────────────────────────────────────────
describe('copy scan: Archive', () => {
  const T = Date.UTC(2026, 9, 22, 12)
  const issue = (n: number, title: string | null, runId: string, published = false) => ({
    issueNumber: n, title, published, runId,
    publishedAt: published ? T : null, runStartedAt: T, scheduledFor: null,
    slug: published ? `issue-${n}` : null,
  })
  const run = (runId: string, status: string, completedAt?: number) => ({ runId, status, startedAt: T, completedAt })
  const site = (u?: string | null) => (u ? `https://web.example${u}` : null)

  it('with rows', () => {
    const archiveRows = deriveArchiveRows({
      issues: [
        issue(48, 'The Kumasi Roofless Schools Audit', 'aaaaaaaaaa48'),
        issue(47, 'Seed Bank of Tamil Nadu', 'aaaaaaaaaa47', true),
        issue(46, 'Bicycle Library', 'aaaaaaaaaa46'),
      ],
      runs: [run('aaaaaaaaaa48', 'awaiting-review', T), run('aaaaaaaaaa47', 'complete', T), run('aaaaaaaaaa46', 'failed')],
      currentRunId: 'aaaaaaaaaa48',
    })
    const { container } = render(<ArchiveBody rows={archiveRows} currentRunId="aaaaaaaaaa48" websiteUrlFor={site} />)
    assertClean(container)
  })
  it('empty', () => {
    const { container } = render(<ArchiveBody rows={{ listed: [], unfinished: [] }} currentRunId={null} websiteUrlFor={site} />)
    assertClean(container)
  })
})

// ── Behind the scenes ───────────────────────────────────────────────────────
describe('copy scan: Behind', () => {
  it('hub', () => {
    const steps = deriveBehindSteps({ agentRuns: [], runStatus: 'running' })!
    const costLine = formatCostLine({ costUsd: 0.58, startedAt: 0, completedAt: 39 * 60000, mode: 'finished' })
    const { container } = render(
      <BehindHubView slabSentence="Nothing here needs you this week." issueLine="Issue 7" steps={steps} costLine={costLine} items={ADMIN_ITEMS} />,
    )
    assertClean(container)
  })
})

describe('copy scan: Behind-Run', () => {
  const INTERRUPT = "Interrupt(value={'candidates': [{'charityName': 'Foo'}]})"
  const RAW = 'verify_research: 3 of 7 claims unverifiable'
  const done = (agentKey: string) => ({ agentKey, status: 'done', completedAt: 1 })
  const problem = deriveBehindSteps({
    agentRuns: [done('signal_editor'), done('scout'), done('verify_candidates'), done('editor_gate_1'), done('researcher'),
      { agentKey: 'verify_research', status: 'failed', error: RAW }],
    runStatus: 'failed',
  })!
  const paused = deriveBehindSteps({
    agentRuns: [done('signal_editor'), done('scout'), done('verify_candidates'),
      { agentKey: 'editor_gate_1', status: 'failed', error: INTERRUPT }],
    runStatus: 'failed',
  })!
  const running = deriveBehindSteps({ agentRuns: [done('signal_editor')], runStatus: 'running' })!
  const costLine = formatCostLine({ costUsd: 0.21, mode: 'stopped' })

  const cases = [
    ['problem', 'problem', problem, 'verify-research', RAW],
    ['paused', 'paused', paused, null, INTERRUPT],
    ['stuck', 'stuck', running, null, null],
  ] as const

  it.each(cases)('%s', (_n, mode, steps, problemKey, rawError) => {
    const { container } = render(
      <BehindRunView
        mode={mode}
        issueNumber={42}
        issueLine="Issue 42 · Thursday 17 September 2026"
        issueHref="/?run=abc"
        steps={steps}
        costLine={costLine}
        problemKey={problemKey}
        rawError={rawError}
        onPrimary={() => {}}
        primaryBusy={false}
        actionError={null}
      />,
    )
    assertClean(container)
  })
})

describe('COPY strings (quick 261023-1i8)', () => {
  it('every COPY string is plain words', () => {
    for (const v of Object.values(COPY)) {
      if (typeof v !== 'string') continue
      expect(v).not.toMatch(EDITOR_BANNED_PATTERN)
      expect(v).not.toMatch(RUN_ID_PATTERN)
    }
  })
})
