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
    blockingCount: 0,
    firstFindingId: null,
    href: `/s/${id}`,
  }))
}

function sectionsOf(rows: HomeSectionRow[]): HomeSectionsResult {
  return {
    rows,
    attributedClaims: 0,
    unattributedClaims: 0,
    unattributedFindings: 0,
    unattributedFindingSections: [],
    unknownSectionFindings: 0,
    totalBlocking: 0,
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
      admin: '/run',
      pastIssues: '/issues',
      runDetails: '/issues/7/runs/run_1',
      factCheck: '/issues/7/fact-check',
      approval: '/issues/7/approval',
      storyChoice: '/issues/7/story',
      liveIssue: 'https://web.example/issue/issue-7',
      preview: 'https://web.example/issue/issue-7/preview?token=x',
    },
    ...over,
  }
}

function fixRows(): HomeSectionRow[] {
  return cleanRows().map((r) =>
    r.id === 'game'
      ? {
          ...r,
          headline: 'The Filtration Layer',
          state: 'fix' as const,
          blockingCount: 1,
          firstFindingId: 'f9',
          href: '/s/game#finding-f9',
        }
      : r,
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
    expect(screen.getByRole('link', { name: 'Past issues' }).getAttribute('href')).toBe('/issues')
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/run')
    expect(container.querySelector('aside')).toBeNull()
    expect(container.querySelector('[role="tablist"]')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('[role="checkbox"]')).toBeNull()
  })
})

describe('IssueHomeView note', () => {
  it('renders a fix row as one link with label, headline and count note', () => {
    render(<IssueHomeView {...baseProps({ sections: sectionsOf(fixRows()), footer: { kind: 'ready' } })} />)
    const link = screen.getByRole('link', { name: /Game.*The Filtration Layer.*1 thing to fix →/ })
    expect(link.getAttribute('href')).toBe('/s/game#finding-f9')
  })

  it('pluralises the count', () => {
    const rows = fixRows().map((r) => (r.id === 'game' ? { ...r, blockingCount: 3 } : r))
    render(<IssueHomeView {...baseProps({ sections: sectionsOf(rows) })} />)
    expect(screen.getByText('3 things to fix →')).toBeTruthy()
  })

  it('shows Reads clean for clean rows and Being written… for writing rows', () => {
    const rows = cleanRows().map((r) => (r.id === 'podcast' ? { ...r, state: 'writing' as const } : r))
    render(<IssueHomeView {...baseProps({ sections: sectionsOf(rows) })} />)
    expect(screen.getAllByText('Reads clean')).toHaveLength(8)
    expect(screen.getByText('Being written…')).toBeTruthy()
  })

  it('renders exactly nine row links in the story list', () => {
    render(<IssueHomeView {...baseProps()} />)
    const list = screen.getByRole('list', { name: 'Stories in this issue' })
    expect(within(list).getAllByRole('link')).toHaveLength(9)
  })
})

describe('IssueHomeView footer', () => {
  it('names a single story with a link to its first problem', () => {
    render(
      <IssueHomeView
        {...baseProps({
          sections: sectionsOf(fixRows()),
          footer: {
            kind: 'fix',
            stories: [{ id: 'game', label: 'Game', href: '/s/game#finding-f9' }],
            notWritten: [],
            unattributedClaims: 0,
            unattributedFindings: 0,
            unattributedFindingHref: null,
          },
        })}
      />,
    )
    const section = screen.getByRole('region', { name: 'Publish' })
    expect(section.textContent).toContain('1 story has something to fix: Game.')
    expect(within(section).getByRole('link', { name: 'Game' }).getAttribute('href')).toBe('/s/game#finding-f9')
  })

  it('joins several stories and lists unattributed claims and findings', () => {
    render(
      <IssueHomeView
        {...baseProps({
          footer: {
            kind: 'fix',
            stories: [
              { id: 'origin-story', label: 'Origin Story', href: '/s/origin-story' },
              { id: 'game', label: 'Game', href: '/s/game' },
            ],
            notWritten: [],
            unattributedClaims: 1,
            unattributedFindings: 1,
            unattributedFindingHref: '/s/podcast',
          },
        })}
      />,
    )
    const section = screen.getByRole('region', { name: 'Publish' })
    expect(section.textContent).toContain('2 stories have something to fix: Origin Story, Game.')
    expect(
      within(section).getByRole('link', { name: '1 fact the agents found contradicted needs checking.' }).getAttribute('href'),
    ).toBe('/issues/7/fact-check')
    expect(
      within(section).getByRole('link', { name: '1 thing to fix isn’t tied to a story.' }).getAttribute('href'),
    ).toBe('/s/podcast')
  })

  it('falls back to the approval screen when the finding section is unknown', () => {
    render(
      <IssueHomeView
        {...baseProps({
          footer: {
            kind: 'fix',
            stories: [],
            notWritten: [],
            unattributedClaims: 0,
            unattributedFindings: 1,
            unattributedFindingHref: null,
          },
        })}
      />,
    )
    expect(
      screen.getByRole('link', { name: '1 thing to fix isn’t tied to a story.' }).getAttribute('href'),
    ).toBe('/issues/7/approval')
  })

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
  const fixFooter = {
    kind: 'fix' as const,
    stories: [{ id: 'game', label: 'Game', href: '/s/game' }],
    notWritten: [],
    unattributedClaims: 0,
    unattributedFindings: 0,
    unattributedFindingHref: null,
  }

  it('has exactly one Publish button in ready, fix and running', () => {
    for (const footer of [{ kind: 'ready' as const }, fixFooter, { kind: 'running' as const }]) {
      const { unmount } = render(<IssueHomeView {...baseProps({ footer })} />)
      expect(publishButtons()).toHaveLength(1)
      unmount()
    }
  })

  it('disables the button when the gate is closed and explains a collaborator lock', () => {
    render(<IssueHomeView {...baseProps({ gate: { enabled: false, reason: 'collaborator' } })} />)
    expect((publishButtons()[0] as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(COLLABORATOR_LOCK_LABEL)).toBeTruthy()
    expect(COLLABORATOR_LOCK_LABEL).toBe('Collaborators can review and comment, not publish.')
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

  it('offers Preview the issue for fix, running and ready only when a preview URL exists', () => {
    for (const footer of [{ kind: 'ready' as const }, fixFooter, { kind: 'running' as const }]) {
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
    expect(screen.getByRole('link', { name: 'Admin → Run Details' }).getAttribute('href')).toBe('/issues/7/runs/run_1')
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
    expect(screen.getByRole('link', { name: 'Choose the charity →' }).getAttribute('href')).toBe('/issues/7/story')
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
    expect(screen.queryByText(/Reads clean|Ready to publish|Nothing left to fix/)).toBeNull()
    expect(publishButtons()).toHaveLength(0)
  })

  it('shows a draft error as an alert without claiming clean', () => {
    render(<IssueHomeView {...baseProps({ footer: { kind: 'loading' }, sections: undefined, draftError: 'boom' })} />)
    expect(screen.getByRole('alert').textContent).toContain('boom')
    expect(screen.queryByText(/Reads clean/)).toBeNull()
  })
})
