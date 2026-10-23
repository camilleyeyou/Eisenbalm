/**
 * Phase 56 Plan 05 — IssueHomeView (pure) across every Home state.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { IssueHomeView, type IssueHomeViewProps } from '@/app/(editorial)/_components/IssueHomeView'
import { deriveEditorHome, homeSlabCopy, EDITOR_BANNED_PATTERN, RUN_ID_PATTERN } from '@/lib/editorState'
import type { HomeFooter, HomeSectionRow } from '@/lib/homeSections'
import { PART_ORDER } from '@/lib/editorState'

afterEach(cleanup)

const THURSDAY = Date.UTC(2026, 9, 29, 12) // Thu 29 Oct 2026
const NOW = Date.UTC(2026, 9, 27, 12)

function rows(state: 'clean' | 'writing' | 'pending' = 'clean'): HomeSectionRow[] {
  return PART_ORDER.map((id) => ({
    id,
    label: id,
    headline: `Headline ${id}`,
    state,
    agentChanges: 0,
    href: `/s/${id}`,
  })) as HomeSectionRow[]
}

type Case = 'ready' | 'ready-collab' | 'writing' | 'held' | 'published' | 'empty' | 'problem' | 'stuck' | 'loading'

function makeProps(c: Case, over: Partial<IssueHomeViewProps> = {}): IssueHomeViewProps {
  const footerFor: Record<Case, HomeFooter> = {
    ready: { kind: 'ready' },
    'ready-collab': { kind: 'ready' },
    writing: { kind: 'running' },
    held: { kind: 'ready' },
    published: { kind: 'published', publishedAt: THURSDAY },
    empty: { kind: 'none' },
    problem: { kind: 'failed' },
    stuck: { kind: 'gate1' },
    loading: { kind: 'loading' },
  }
  const r = c === 'writing' ? rows('writing').map((x, i) => (i < 3 ? { ...x, state: 'clean' as const } : x)) : rows()
  const vm = deriveEditorHome({
    footer: footerFor[c],
    held: c === 'held' ? true : false,
    role: c === 'ready-collab' ? 'Collaborator' : 'Editor-in-chief',
    rows: c === 'empty' || c === 'loading' ? [] : r,
  })
  const number = c === 'published' ? 47 : 48
  const slab = homeSlabCopy(vm, { issueNumber: number, startedAt: NOW, publishedAt: THURSDAY, now: NOW })
  return {
    vm,
    slab,
    issueLine:
      c === 'published' ? 'Issue 47 · Thursday 29 October 2026 · Published' : 'Issue 48 · Thursday 29 October 2026',
    charityName: 'The Quiet Ledger',
    blurb: 'A two-person water lab.',
    rows: c === 'empty' || c === 'loading' ? undefined : r,
    hrefFor: (row) => `/s/${row.id}`,
    onPrimary: vi.fn(),
    primaryBusy: false,
    actionError: null,
    links: {
      preview: 'https://preview.example/issue-48',
      website: 'https://site.example/issue/issue-47',
      whatHappened: '/admin/runs/a1b2c3d4e5f6',
    },
    footer: null,
    draftError: null,
    onReload: vi.fn(),
    live: null,
    ...over,
  }
}

const primaries = (c: HTMLElement) => c.querySelectorAll('[data-primary]')

describe('IssueHomeView states', () => {
  it('ready: one Publish button, preview link, header, nine parts', () => {
    const { container } = render(<IssueHomeView {...makeProps('ready', { footer: <p>FOOT</p> })} />)
    expect(screen.getByText('Read the issue, then publish it.')).toBeTruthy()
    expect(primaries(container).length).toBe(1)
    expect(primaries(container)[0]!.textContent).toBe('Publish Issue 48')
    expect(screen.getByRole('link', { name: 'Preview the issue first' })).toBeTruthy()
    expect(screen.getByText('Issue 48 · Thursday 29 October 2026')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('The Quiet Ledger')
    expect(screen.getByRole('list', { name: 'Progress on this issue' })).toBeTruthy()
    expect(container.querySelectorAll('ol')[1]!.querySelectorAll('li').length).toBe(9)
    expect(screen.getByText('FOOT')).toBeTruthy()
  })

  it('writing: Working in the slab, no primary, parts hint', () => {
    const { container } = render(<IssueHomeView {...makeProps('writing')} />)
    expect(primaries(container).length).toBe(0)
    expect(screen.getAllByText('Working').length).toBeGreaterThan(0)
    expect(screen.getByText("Finished parts open as soon as they're written.")).toBeTruthy()
  })

  it('held: Release this issue is the primary', () => {
    const { container } = render(<IssueHomeView {...makeProps('held')} />)
    expect(primaries(container)[0]!.textContent).toBe('Release this issue')
    expect(screen.getAllByRole('button', { name: 'Release this issue' }).length).toBe(1)
  })

  it('published: start next week, website link opens in a new tab, no footer', () => {
    const { container } = render(<IssueHomeView {...makeProps('published')} />)
    expect(primaries(container)[0]!.textContent).toBe("Start next week's issue")
    const link = screen.getByRole('link', { name: 'Read Issue 47 on the website' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(screen.getByText(/ · Published$/)).toBeTruthy()
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0)
  })

  it('ready-collab: waiting sentence, no primary', () => {
    const { container } = render(<IssueHomeView {...makeProps('ready-collab')} />)
    expect(screen.getByText('Waiting for the editor-in-chief to publish.')).toBeTruthy()
    expect(primaries(container).length).toBe(0)
  })

  it('empty: start the first issue, no stations or parts', () => {
    const { container } = render(<IssueHomeView {...makeProps('empty')} />)
    expect(screen.getByText('No issue yet this week')).toBeTruthy()
    expect(primaries(container)[0]!.textContent).toBe('Start the first issue')
    expect(screen.queryByRole('list', { name: 'Progress on this issue' })).toBeNull()
    expect(screen.queryByText('The nine parts')).toBeNull()
    expect(container.querySelectorAll('h1').length).toBe(1)
  })

  it('problem: start a new issue and a What happened link', () => {
    const { container } = render(<IssueHomeView {...makeProps('problem')} />)
    expect(primaries(container)[0]!.textContent).toBe('Start a new issue')
    expect(screen.getByRole('link', { name: 'What happened' }).getAttribute('href')).toBe('/admin/runs/a1b2c3d4e5f6')
  })

  it('stuck: Stop this issue', () => {
    const { container } = render(<IssueHomeView {...makeProps('stuck')} />)
    expect(primaries(container)[0]!.textContent).toBe('Stop this issue')
  })

  it('loading: skeleton, no primary, no collaborator sentence', () => {
    const { container } = render(<IssueHomeView {...makeProps('loading')} />)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(primaries(container).length).toBe(0)
    expect(screen.queryByText(/Waiting for the editor-in-chief/)).toBeNull()
  })

  it('draft error: plain sentence and a reload button', () => {
    const props = makeProps('ready', { draftError: 'boom' })
    render(<IssueHomeView {...props} />)
    expect(screen.getByText("This page didn't load. Check your connection, then press Reload this page.")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reload this page' }))
    expect(props.onReload).toHaveBeenCalled()
  })

  it('primary press calls onPrimary', () => {
    const props = makeProps('ready')
    render(<IssueHomeView {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Publish Issue 48' }))
    expect(props.onPrimary).toHaveBeenCalledTimes(1)
  })

  it.each(['ready', 'ready-collab', 'writing', 'held', 'published', 'empty', 'problem', 'stuck', 'loading'] as Case[])(
    '%s: no banned words and no run id',
    (c) => {
      const { container } = render(<IssueHomeView {...makeProps(c)} />)
      const text = container.textContent ?? ''
      expect(text).not.toMatch(EDITOR_BANNED_PATTERN)
      expect(text).not.toMatch(RUN_ID_PATTERN)
      expect(text).not.toContain('a1b2c3d4e5f6')
    },
  )
})
