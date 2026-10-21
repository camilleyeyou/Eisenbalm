/**
 * Phase 52 Plan 03 — IssueHomeView (props-only front door) component tests.
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import { EDITABLE_SECTIONS } from '@/lib/editableSections'
import {
  FAILED_SENTENCE,
  GATE1_SENTENCE,
  READY_SENTENCE,
  RUNNING_SENTENCE,
  type HomeSectionRow,
  type HomeSectionsResult,
} from '@/lib/homeSections'
import { COLLABORATOR_LOCK_LABEL, HELD_REASON } from '@/lib/publishChain'
import {
  IssueHomeView,
  formatPublishedDate,
  type IssueHomeViewProps,
} from '../app/(editorial)/_components/IssueHomeView'

afterEach(() => cleanup())

function cleanRows(): HomeSectionRow[] {
  return EDITABLE_SECTIONS.map(({ id, label }) => ({
    id,
    label,
    headline: `${label} headline`,
    state: 'clean' as const,
    agentChanges: 0,
    href: `/s/${id}`,
  }))
}

function sectionsOf(rows: HomeSectionRow[]): HomeSectionsResult {
  return {
    rows,
  }
}

function baseProps(over: Partial<IssueHomeViewProps> = {}): IssueHomeViewProps {
  return {
    issueNumber: 7,
    title: 'The Quiet Ledger',
    subject: 'A two-person water lab in the Ozarks.',
    sections: sectionsOf(cleanRows()),
    footer: { kind: 'ready' },
    gate: { enabled: true },
    draftError: null,
    publishing: false,
    publishError: null,
    publishNotice: null,
    confirming: false,
    onRequestPublish: vi.fn(),
    onConfirmPublish: vi.fn(),
    onCancelPublish: vi.fn(),
    links: {
      admin: '/admin',
      pastIssues: '/archive',
      runDetails: '/admin/runs/run_1',
      liveIssue: 'https://web.example/issue/issue-7',
      preview: 'https://web.example/issue/issue-7/preview?token=x',
    },
    ...over,
  }
}

function changedRows(): HomeSectionRow[] {
  return cleanRows().map((r) =>
    r.id === 'game' ? { ...r, headline: 'The Filtration Layer', agentChanges: 2, href: '/s/game' } : r,
  )
}

const publishButtons = () => screen.queryAllByRole('button', { name: 'Publish' })

describe('IssueHomeView title', () => {
  it('shows the real title, subject, eyebrow and header links with no console chrome', () => {
    const { container } = render(<IssueHomeView {...baseProps()} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('The Quiet Ledger')
    expect(screen.getByText('A two-person water lab in the Ozarks.')).toBeTruthy()
    expect(screen.getByText('Issue 7')).toBeTruthy()
    expect(screen.getByText('The Eisenbalm Dispatch')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Past issues' }).getAttribute('href')).toBe('/archive')
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin')
    expect(container.querySelector('aside')).toBeNull()
    expect(container.querySelector('[role="tablist"]')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('[role="checkbox"]')).toBeNull()
  })
})

describe('IssueHomeView note', () => {
  it('renders an agent-changed row as one link with a quiet change count', () => {
    render(<IssueHomeView {...baseProps({ sections: sectionsOf(changedRows()), footer: { kind: 'ready' } })} />)
    const link = screen.getByRole('link', { name: /Game.*The Filtration Layer.*Written · agents made 2 changes/ })
    expect(link.getAttribute('href')).toBe('/s/game')
    expect(screen.queryByText(/to fix/)).toBeNull()
  })

  it('shows Written for clean rows and Being written… for writing rows', () => {
    const rows = cleanRows().map((r) => (r.id === 'podcast' ? { ...r, state: 'writing' as const } : r))
    render(<IssueHomeView {...baseProps({ sections: sectionsOf(rows) })} />)
    expect(screen.getAllByText('Written')).toHaveLength(8)
    expect(screen.getByText('Being written…')).toBeTruthy()
  })

  it('renders exactly nine row links in the story list', () => {
    render(<IssueHomeView {...baseProps()} />)
    const list = screen.getByRole('list', { name: 'Stories in this issue' })
    expect(within(list).getAllByRole('link')).toHaveLength(9)
  })
})

describe('IssueHomeView footer', () => {
  it('shows the running and ready sentences', () => {
    const { unmount } = render(<IssueHomeView {...baseProps({ footer: { kind: 'running' } })} />)
    expect(screen.getByText(RUNNING_SENTENCE)).toBeTruthy()
    unmount()
    render(<IssueHomeView {...baseProps({ footer: { kind: 'ready' } })} />)
    expect(screen.getByText(READY_SENTENCE)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Publish' }).getAttribute('data-ready')).toBe('true')
  })
})

describe('IssueHomeView publish', () => {
  it('has exactly one Publish button in ready and running', () => {
    for (const footer of [{ kind: 'ready' as const }, { kind: 'running' as const }]) {
      const { unmount } = render(<IssueHomeView {...baseProps({ footer })} />)
      expect(publishButtons()).toHaveLength(1)
      unmount()
    }
  })

  it('disables the button when the gate is closed and explains a collaborator lock', () => {
    render(<IssueHomeView {...baseProps({ gate: { enabled: false, reason: 'collaborator' } })} />)
    expect((publishButtons()[0] as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(COLLABORATOR_LOCK_LABEL)).toBeTruthy()
    expect(COLLABORATOR_LOCK_LABEL).toBe('Collaborators can read and edit. Only the Editor-in-chief can publish.')
  })

  it('explains a held issue', () => {
    render(<IssueHomeView {...baseProps({ gate: { enabled: false, reason: 'held' } })} />)
    expect((publishButtons()[0] as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(HELD_REASON)).toBeTruthy()
    expect(HELD_REASON).toBe('This issue is held — release the hold to publish.')
  })

  it('requests publish on click and confirms inline without window.confirm', () => {
    const confirmSpy = vi.fn()
    ;(window as unknown as { confirm: unknown }).confirm = confirmSpy
    const onRequestPublish = vi.fn()
    const onConfirmPublish = vi.fn()
    const onCancelPublish = vi.fn()
    const { unmount } = render(<IssueHomeView {...baseProps({ onRequestPublish })} />)
    fireEvent.click(publishButtons()[0]!)
    expect(onRequestPublish).toHaveBeenCalledTimes(1)
    unmount()

    render(<IssueHomeView {...baseProps({ confirming: true, onConfirmPublish, onCancelPublish })} />)
    expect(screen.getByText('Publish Issue 7 now?')).toBeTruthy()
    expect(publishButtons()).toHaveLength(1)
    fireEvent.click(publishButtons()[0]!)
    expect(onConfirmPublish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancelPublish).toHaveBeenCalledTimes(1)
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('offers Preview the issue for running and ready only when a preview URL exists', () => {
    for (const footer of [{ kind: 'ready' as const }, { kind: 'running' as const }]) {
      const { unmount } = render(<IssueHomeView {...baseProps({ footer })} />)
      expect(screen.getByRole('link', { name: 'Preview the issue' }).getAttribute('href')).toBe(
        'https://web.example/issue/issue-7/preview?token=x',
      )
      unmount()
    }
    const base = baseProps()
    const { unmount } = render(<IssueHomeView {...base} links={{ ...base.links, preview: null }} />)
    expect(screen.queryByRole('link', { name: 'Preview the issue' })).toBeNull()
    unmount()
    for (const footer of [
      { kind: 'failed' as const },
      { kind: 'published' as const, publishedAt: 1 },
      { kind: 'gate1' as const },
      { kind: 'none' as const },
    ]) {
      const r = render(<IssueHomeView {...baseProps({ footer })} />)
      expect(screen.queryByRole('link', { name: 'Preview the issue' })).toBeNull()
      r.unmount()
    }
  })

  it('shows the slow notice as status, Publishing… as disabled, and errors as alert', () => {
    const notice = 'Publishing is taking longer than usual — check Admin → Run Details.'
    render(
      <IssueHomeView
        {...baseProps({
          publishing: true,
          publishNotice: notice,
          publishError: 'Both sign-offs are required.',
          gate: { enabled: false, reason: 'busy' },
        })}
      />,
    )
    expect(screen.getByRole('status').textContent).toBe(notice)
    expect(screen.getByRole('alert').textContent).toContain('Both sign-offs are required.')
    const btn = screen.getByRole('button', { name: 'Publishing…' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})

describe('IssueHomeView states', () => {
  it('failed: honest sentence, Run Details link, no Publish', () => {
    render(<IssueHomeView {...baseProps({ footer: { kind: 'failed' } })} />)
    expect(screen.getByRole('region', { name: 'Publish' }).textContent).toContain(FAILED_SENTENCE)
    expect(screen.getByRole('link', { name: 'See why in Admin →' }).getAttribute('href')).toBe('/admin/runs/run_1')
    expect(publishButtons()).toHaveLength(0)
  })

  it('published: dated sentence and live link, no Publish', () => {
    const ts = Date.UTC(2026, 9, 16, 12)
    const { unmount } = render(<IssueHomeView {...baseProps({ footer: { kind: 'published', publishedAt: ts } })} />)
    const region = screen.getByRole('region', { name: 'Publish' })
    expect(region.textContent).toContain(`Published ${formatPublishedDate(ts)}`)
    expect(screen.getByRole('link', { name: 'Read the live issue →' }).getAttribute('href')).toBe(
      'https://web.example/issue/issue-7',
    )
    expect(publishButtons()).toHaveLength(0)
    unmount()
    const base = baseProps({ footer: { kind: 'published', publishedAt: ts } })
    render(<IssueHomeView {...base} links={{ ...base.links, liveIssue: null }} />)
    expect(screen.queryByRole('link', { name: 'Read the live issue →' })).toBeNull()
  })

  it('gate1: waiting sentence and charity link, no Publish', () => {
    render(<IssueHomeView {...baseProps({ footer: { kind: 'gate1' } })} />)
    expect(screen.getByRole('region', { name: 'Publish' }).textContent).toContain(GATE1_SENTENCE)
    expect(screen.getByRole('link', { name: 'Open the run in Admin →' }).getAttribute('href')).toBe('/admin/runs/run_1')
    expect(screen.queryByText(/Choose the charity/)).toBeNull()
    expect(publishButtons()).toHaveLength(0)
  })

  it('none: honest copy, no story list, no Publish', () => {
    render(
      <IssueHomeView
        {...baseProps({ footer: { kind: 'none' }, issueNumber: null, title: null, subject: null, sections: undefined })}
      />,
    )
    expect(screen.getAllByText('There is no current issue yet.')).toHaveLength(1)
    expect(screen.queryByRole('list', { name: 'Stories in this issue' })).toBeNull()
    expect(publishButtons()).toHaveLength(0)
  })
})

describe('IssueHomeView loading', () => {
  it('shows an aria-busy skeleton and never claims clean or ready', () => {
    const { container } = render(
      <IssueHomeView {...baseProps({ footer: { kind: 'loading' }, sections: undefined, title: undefined, subject: undefined })} />,
    )
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText(/Written|Ready to publish|reviewed every section/)).toBeNull()
    expect(publishButtons()).toHaveLength(0)
  })

  it('shows a draft error as an alert without claiming clean', () => {
    render(<IssueHomeView {...baseProps({ footer: { kind: 'loading' }, sections: undefined, draftError: 'boom' })} />)
    expect(screen.getByRole('alert').textContent).toContain('boom')
    expect(screen.queryByText(/Written/)).toBeNull()
  })
})
