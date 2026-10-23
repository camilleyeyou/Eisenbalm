/**
 * Phase 56-07 — pure ArchiveBody over rows from the real deriveArchiveRows.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ArchiveBody } from '../app/(editorial)/archive/_components/ArchiveBody'
import { deriveArchiveRows, EDITOR_BANNED_PATTERN, RUN_ID_PATTERN } from '@/lib/editorState'

afterEach(() => cleanup())

const T = Date.UTC(2026, 9, 22, 12)
const issue = (n: number, title: string | null, runId: string, published = false) => ({
  issueNumber: n,
  title,
  published,
  runId,
  publishedAt: published ? T : null,
  runStartedAt: T,
  scheduledFor: null,
  slug: published ? `issue-${n}` : null,
})
const run = (runId: string, status: string, completedAt?: number) => ({ runId, status, startedAt: T, completedAt })

function rowsFor(withUnfinished = true) {
  const issues = [
    issue(48, 'The Kumasi Roofless Schools Audit', 'aaaaaaaaaa48'),
    issue(47, 'Seed Bank of Tamil Nadu', 'aaaaaaaaaa47', true),
    ...(withUnfinished ? [issue(46, 'Bicycle Library', 'aaaaaaaaaa46'), issue(45, null, 'aaaaaaaaaa45')] : []),
  ]
  const runs = [
    run('aaaaaaaaaa48', 'awaiting-review', T),
    run('aaaaaaaaaa47', 'complete', T),
    ...(withUnfinished ? [run('aaaaaaaaaa46', 'failed'), run('aaaaaaaaaa45', 'cancelled')] : []),
  ]
  return deriveArchiveRows({ issues, runs, currentRunId: 'aaaaaaaaaa48' })
}

const site = (u?: string | null) => (u ? `https://web.example${u}` : null)

function renderBody(rows = rowsFor()) {
  return render(<ArchiveBody rows={rows} currentRunId="aaaaaaaaaa48" websiteUrlFor={site} />)
}

describe('ArchiveBody', () => {
  it('renders heading, subtitle and labelled search', () => {
    renderBody()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Past issues')
    expect(screen.getByText('Every issue so far, newest first.')).toBeTruthy()
    expect(screen.getByLabelText('Find an issue').getAttribute('placeholder')).toBe('Charity name or issue number')
  })

  it('links charity names to the issue and shows the website link for published', () => {
    renderBody()
    expect(screen.getByRole('link', { name: 'The Kumasi Roofless Schools Audit' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Seed Bank of Tamil Nadu' }).getAttribute('href')).toBe('/?run=aaaaaaaaaa47')
    const web = screen.getByRole('link', { name: 'Read on the website' })
    expect(web.getAttribute('href')).toBe('https://web.example/issue/issue-47')
    expect(web.getAttribute('target')).toBe('_blank')
    expect(screen.getByText('Waiting for you · this week')).toBeTruthy()
    expect(screen.getByText('Issue 48 is waiting for you.')).toBeTruthy()
  })

  it('tints the current row', () => {
    const { container } = renderBody()
    expect(container.querySelectorAll('li.bg-\\[color\\:var\\(--color-current\\)\\]').length).toBe(1)
  })

  it('filters by name and issue number; shows empty search copy', () => {
    renderBody()
    const input = screen.getByLabelText('Find an issue')
    fireEvent.change(input, { target: { value: 'kumasi' } })
    expect(screen.queryByText('Seed Bank of Tamil Nadu')).toBeNull()
    expect(screen.getByText('The Kumasi Roofless Schools Audit')).toBeTruthy()
    fireEvent.change(input, { target: { value: '47' } })
    expect(screen.getByText('Seed Bank of Tamil Nadu')).toBeTruthy()
    expect(screen.queryByText('The Kumasi Roofless Schools Audit')).toBeNull()
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByText('No issue matches "zzz". Try a charity name or an issue number.')).toBeTruthy()
  })

  it('puts stopped and problem issues in a closed details with reasons', () => {
    const { container } = renderBody()
    const details = container.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(screen.getByText('Stopped or unfinished issues (2)')).toBeTruthy()
    expect(screen.getByText('Hit a problem while it was being written')).toBeTruthy()
    expect(screen.getByText('Stopped before a charity was chosen')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'What happened' }).getAttribute('href')).toBe('/admin/runs/aaaaaaaaaa46')
  })

  it('omits the unfinished section when none', () => {
    const { container } = renderBody(rowsFor(false))
    expect(container.querySelector('details')).toBeNull()
  })

  it('shows empty copy when nothing exists', () => {
    renderBody({ listed: [], unfinished: [] })
    expect(screen.getByText('No past issues yet. Once you publish an issue it will be listed here.')).toBeTruthy()
    expect(screen.getByText('Nothing is waiting here. Open an issue to read it or change its words.')).toBeTruthy()
    expect(screen.getByRole('link', { name: "This week's issue" }).getAttribute('href')).toBe('/')
  })

  it('has no primary button and no banned wording or run ids', () => {
    const { container } = renderBody()
    expect(container.querySelectorAll('[data-primary]').length).toBe(0)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(EDITOR_BANNED_PATTERN)
    expect(text).not.toMatch(RUN_ID_PATTERN)
  })
})
