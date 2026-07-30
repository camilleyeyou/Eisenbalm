/**
 * quick 260730-ldn (Task 4) — pure tests for `RunBody` (fixture props only,
 * no Convex, no fetch — the `DeskBody`/`MyTasksList` precedent). Runs in
 * jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import {
  RunBody,
  type RunBodyProps,
  type RunGateInputs,
  type RunSwitcherRow,
} from '../app/(dashboard)/run/_components/RunScreen'
import type { RunSectionRow } from '../lib/runSections'

afterEach(() => {
  cleanup()
})

function baseSections(): RunSectionRow[] {
  return [
    {
      id: 'originStory',
      label: 'Origin Story',
      generated: true,
      headline: 'The Ledger Nobody Kept',
      excerpt: 'Margaret Osei spent thirty-one years reconciling ledgers.',
      wordCount: 842,
      meta: '842 words',
      state: 'must-fix',
      mustFix: 1,
      voice: 0,
    },
    {
      id: 'problemStatement',
      label: 'Problem',
      generated: true,
      headline: 'Four Hundred Pages, No Reply',
      excerpt: 'The ministry received the audit in March.',
      wordCount: 610,
      meta: '610 words',
      state: 'clean',
      mustFix: 0,
      voice: 0,
    },
    {
      id: 'founderBio',
      label: 'Founder Bio',
      generated: true,
      headline: "The Accountant Who Wouldn't Retire",
      excerpt: 'There is no origin myth here.',
      wordCount: 738,
      meta: '738 words',
      state: 'must-fix',
      mustFix: 2,
      voice: 0,
    },
    {
      id: 'caseStudy',
      label: 'Case Study',
      generated: true,
      headline: 'Eleven Districts, Counted By Hand',
      excerpt: 'She walked them herself.',
      wordCount: 905,
      meta: '905 words',
      state: 'voice',
      mustFix: 0,
      voice: 1,
    },
    {
      id: 'bonus',
      label: 'Bonus',
      generated: true,
      headline: 'A Field Guide to Roof Types',
      excerpt: 'Corrugate, thatch, tarpaulin.',
      wordCount: 320,
      meta: '320 words',
      state: 'clean',
      mustFix: 0,
      voice: 0,
    },
    {
      id: 'game',
      label: 'Game',
      generated: true,
      headline: 'Count the Roofs',
      excerpt: 'An interactive tally.',
      wordCount: null,
      meta: 'Interactive',
      state: 'clean',
      mustFix: 0,
      voice: 0,
    },
    {
      id: 'deliberation-conversation',
      label: 'Deliberation',
      generated: true,
      headline: null,
      excerpt: 'Advocate and Editor disagreed twice.',
      wordCount: 1204,
      meta: '1204 words',
      state: 'clean',
      mustFix: 0,
      voice: 0,
    },
    {
      id: 'podcast',
      label: 'Podcast',
      generated: false,
      headline: null,
      excerpt: null,
      wordCount: null,
      meta: 'Not generated',
      state: 'pending',
      mustFix: 0,
      voice: 0,
    },
    {
      id: 'theme',
      label: 'Theme',
      generated: false,
      headline: null,
      excerpt: null,
      wordCount: null,
      meta: 'Not generated',
      state: 'pending',
      mustFix: 0,
      voice: 0,
    },
  ]
}

function baseGates(overrides: Partial<RunGateInputs> = {}): RunGateInputs {
  return {
    loaded: true,
    factsSignedBy: null,
    factsSignedAt: null,
    voiceSignedBy: null,
    voiceSignedAt: null,
    claimsUnchecked: 4,
    claimsTotal: 19,
    voiceOpenCount: 1,
    mustFixTotal: 3,
    held: false,
    ...overrides,
  }
}

function baseSwitcher(): RunSwitcherRow[] {
  return [
    {
      issueNumber: 999717,
      title: 'The Kumasi Roofless Schools Audit',
      hasDrafts: true,
      isCurrent: true,
      meta: 'This week · needs review',
    },
    {
      issueNumber: 999716,
      title: 'The Bicycle Ambulance Corps of Rukungiri',
      hasDrafts: true,
      isCurrent: false,
      meta: 'Last week · published',
    },
    {
      issueNumber: 999720,
      title: null,
      hasDrafts: false,
      isCurrent: false,
      meta: 'Scheduled Thu 14:00 · no drafts',
    },
  ]
}

function baseProps(overrides: Partial<RunBodyProps> = {}): RunBodyProps {
  return {
    surfaceKind: 'run',
    runStatus: 'awaiting-review',
    scheduledForLabel: 'Thu 14:00',
    issueNumber: 999717,
    runId: 'run-999717',
    title: 'The Kumasi Roofless Schools Audit',
    statusChip: { label: 'Needs review', color: 'var(--color-marigold-text)' },
    elapsedLabel: '41m 12s',
    runCostUsd: 4.12,
    capUsd: 8,
    claimsChecked: 15,
    claimsTotal: 19,
    sections: baseSections(),
    draftError: null,
    switcher: baseSwitcher(),
    gates: baseGates(),
    ...overrides,
  }
}

describe('RunBody — identity', () => {
  it('renders the title as the display h1, and "Issue 999717" as mono metadata (never the h1)', () => {
    const { container } = render(<RunBody {...baseProps()} />)
    expect(container.querySelector('h1')?.textContent).toBe('The Kumasi Roofless Schools Audit')
    expect(screen.getByText('Issue 999717').tagName).not.toBe('H1')
  })

  it('renders neither the title nor "Not yet chosen" while title is still loading (undefined)', () => {
    // switcher: [] — isolates this assertion to the identity h1 itself; the
    // switcher legitimately renders "Not yet chosen" for OTHER, unrelated
    // scheduled-slot rows regardless of the current issue's own title state.
    const { container } = render(<RunBody {...baseProps({ title: undefined, switcher: [] })} />)
    expect(container.querySelector('h1')).toBeNull()
    expect(screen.queryByText('Not yet chosen')).toBeNull()
  })

  it('the h1 reads "Not yet chosen" when title is null (loaded-and-absent)', () => {
    const { container } = render(<RunBody {...baseProps({ title: null })} />)
    expect(container.querySelector('h1')?.textContent).toBe('Not yet chosen')
  })
})

describe('RunBody — state: no run (the exact regression this task exists to fix)', () => {
  it('renders "Nothing is running." + the next-discovery label; NO issue number, status chip, section rows, or gates; NEVER "Nothing needs you"', () => {
    render(
      <RunBody {...baseProps({ surfaceKind: 'no-run', scheduledForLabel: 'Thursday 14:00 UTC' })} />,
    )
    expect(screen.getByText('Nothing is running.')).toBeDefined()
    expect(screen.getByText(/Thursday 14:00 UTC/)).toBeDefined()
    expect(screen.queryByText(/Issue 999717/)).toBeNull()
    expect(screen.queryByText('Needs review')).toBeNull()
    expect(screen.queryByText('Origin Story')).toBeNull()
    expect(screen.queryByText('Before it can publish')).toBeNull()
    expect(screen.queryByText(/nothing needs you/i)).toBeNull()
  })

  it('offers exactly one action, linking to /issues', () => {
    render(<RunBody {...baseProps({ surfaceKind: 'no-run' })} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toBe('/issues')
  })
})

describe('RunBody — state: loading', () => {
  it('renders a loading affordance and neither "Nothing is running." nor any section state', () => {
    render(<RunBody {...baseProps({ surfaceKind: 'loading' })} />)
    expect(screen.getByText(/loading/i)).toBeDefined()
    expect(screen.queryByText('Nothing is running.')).toBeNull()
    expect(screen.queryByText('Clean')).toBeNull()
    expect(screen.queryByText('Origin Story')).toBeNull()
  })
})

describe('RunBody — state: running', () => {
  it('status chip reads Running, renders produced-so-far rows + progress copy, and NO gates', () => {
    render(
      <RunBody
        {...baseProps({
          surfaceKind: 'run',
          runStatus: 'running',
          statusChip: { label: 'Running', color: 'var(--color-cobalt)' },
        })}
      />,
    )
    expect(screen.getByText('Running')).toBeDefined()
    expect(screen.getByText('Origin Story')).toBeDefined()
    expect(screen.getByText(/of 9 written/)).toBeDefined()
    expect(screen.queryByText('Before it can publish')).toBeNull()
  })
})

describe('RunBody — state: failed', () => {
  it('status chip reads Run failed, NO gates, NO sign-off affordance, offers a re-run pointer', () => {
    render(
      <RunBody
        {...baseProps({
          surfaceKind: 'failed',
          statusChip: { label: 'Run failed', color: 'var(--color-vermilion)' },
        })}
      />,
    )
    expect(screen.getByText('Run failed')).toBeDefined()
    expect(screen.queryByText('Before it can publish')).toBeNull()
    expect(screen.queryByText('Locked')).toBeNull()
    expect(screen.getByRole('link', { name: /re-run/i })).toBeDefined()
  })
})

describe('RunBody — the work', () => {
  it('renders exactly 9 rows in EDITABLE_SECTIONS order, each labelled with its section label', () => {
    render(<RunBody {...baseProps()} />)
    const expectedLabels = [
      'Origin Story',
      'Problem',
      'Founder Bio',
      'Case Study',
      'Bonus',
      'Game',
      'Deliberation',
      'Podcast',
      'Theme',
    ]
    for (const label of expectedLabels) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('a generated row links to /issues/999717/draft?story=originStory&tab=draft', () => {
    render(<RunBody {...baseProps()} />)
    const link = screen.getByRole('link', { name: /the ledger nobody kept/i })
    expect(link.getAttribute('href')).toBe('/issues/999717/draft?story=originStory&tab=draft')
  })

  it('a state:"pending" row renders "Not generated", is dimmed, and is NOT a link', () => {
    render(<RunBody {...baseProps()} />)
    const row = screen.getByTestId('section-row-podcast')
    expect(row.tagName).not.toBe('A')
    expect(row.textContent).toContain('Not generated')
  })

  it('a state:"unknown" row renders "Unavailable", never "Not generated" nor "Clean" on that row', () => {
    const sections = baseSections().map(s =>
      s.id === 'theme' ? { ...s, state: 'unknown' as const, meta: 'Unavailable' } : s,
    )
    render(<RunBody {...baseProps({ sections })} />)
    const row = screen.getByTestId('section-row-theme')
    expect(row.textContent).toContain('Unavailable')
    expect(row.textContent).not.toContain('Not generated')
    expect(row.textContent).not.toContain('Clean')
  })

  it('renders per-row state as label + colour: Clean / N must fix / N voice / Pending', () => {
    render(<RunBody {...baseProps()} />)
    expect(screen.getAllByText('Clean').length).toBeGreaterThan(0)
    expect(screen.getByText('1 must fix')).toBeDefined()
    expect(screen.getByText('2 must fix')).toBeDefined()
    expect(screen.getByText('1 voice')).toBeDefined()
    expect(screen.getAllByText('Pending').length).toBe(2)
  })

  it('when draftError is set, an honest banner carries the message and no row claims Clean', () => {
    const unavailableSections = baseSections().map(s => ({
      ...s,
      state: 'unknown' as const,
      meta: 'Unavailable',
    }))
    render(
      <RunBody
        {...baseProps({ draftError: 'Failed to load the draft.', sections: unavailableSections })}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('Failed to load the draft.')
    expect(screen.queryByText('Clean')).toBeNull()
  })
})

describe('RunBody — gates', () => {
  it('facts gate unsigned reads the unchecked-claim count and links to fact-check', () => {
    render(<RunBody {...baseProps({ gates: baseGates({ claimsUnchecked: 4, claimsTotal: 19 }) })} />)
    expect(screen.getByText(/4 of 19 claims still unchecked/)).toBeDefined()
    const link = screen.getByRole('link', { name: /check claims/i })
    expect(link.getAttribute('href')).toBe('/issues/999717/fact-check')
  })

  it('voice gate unsigned reads the open voice-finding count and links to voice', () => {
    render(<RunBody {...baseProps({ gates: baseGates({ voiceOpenCount: 2 }) })} />)
    expect(screen.getByText(/2 voice findings open/)).toBeDefined()
    const link = screen.getByRole('link', { name: /voice pass/i })
    expect(link.getAttribute('href')).toBe('/issues/999717/voice')
  })

  it('voice gate at zero open findings reads "Voice sign-off outstanding" (not "0 voice findings")', () => {
    render(<RunBody {...baseProps({ gates: baseGates({ voiceOpenCount: 0 }) })} />)
    expect(screen.getByText(/voice sign-off outstanding/i)).toBeDefined()
  })

  it('publish gate with both signed + zero must-fix + not held links to approval', () => {
    render(
      <RunBody
        {...baseProps({
          gates: baseGates({
            factsSignedBy: 'andrew',
            factsSignedAt: Date.now(),
            voiceSignedBy: 'andrew',
            voiceSignedAt: Date.now(),
            mustFixTotal: 0,
            held: false,
          }),
        })}
      />,
    )
    const link = screen.getByRole('link', { name: /approve & publish/i })
    expect(link.getAttribute('href')).toBe('/issues/999717/approval')
  })

  it('publish gate with either sign-off missing is a non-interactive Locked element, with a stated reason', () => {
    render(<RunBody {...baseProps({ gates: baseGates({ factsSignedBy: null, voiceSignedBy: null }) })} />)
    const locked = screen.getByText('Locked')
    expect(locked.tagName).not.toBe('A')
    expect(locked.tagName).not.toBe('BUTTON')
    expect(screen.getByText(/outstanding/i)).toBeDefined()
  })

  it('publish gate with both signed but must-fix remaining stays locked, naming the must-fix count', () => {
    render(
      <RunBody
        {...baseProps({
          gates: baseGates({
            factsSignedBy: 'andrew',
            factsSignedAt: Date.now(),
            voiceSignedBy: 'andrew',
            voiceSignedAt: Date.now(),
            mustFixTotal: 3,
            held: false,
          }),
        })}
      />,
    )
    expect(screen.getByText('Locked')).toBeDefined()
    expect(screen.getByText(/3 must-fix findings remain/)).toBeDefined()
  })

  it('signOffsLoaded === false: every gate reads "Checking…", never Locked, never a cleared state', () => {
    render(<RunBody {...baseProps({ gates: baseGates({ loaded: false }) })} />)
    expect(screen.getAllByText('Checking…').length).toBe(3)
    expect(screen.queryByText('Locked')).toBeNull()
    expect(screen.queryByText(/cleared by/i)).toBeNull()
  })

  it('no <button> anywhere fires a publish or sign-off — the gates are readouts and links only', () => {
    const { container } = render(<RunBody {...baseProps()} />)
    const buttons = Array.from(container.querySelectorAll('button'))
    for (const btn of buttons) {
      expect(btn.textContent).not.toMatch(/publish|sign.?off/i)
    }
  })
})

describe('RunBody — switcher', () => {
  it('lists items by title with a relative-week label; a hasDrafts:false scheduled row is dimmed, reads "Not yet chosen", and is NOT a link', () => {
    render(<RunBody {...baseProps()} />)
    const publishedRow = screen.getByTestId('switcher-row-999716')
    expect(publishedRow.textContent).toContain('The Bicycle Ambulance Corps of Rukungiri')
    expect(publishedRow.textContent).toContain('Last week')

    const scheduledRow = screen.getByTestId('switcher-row-999720')
    expect(scheduledRow.textContent).toContain('Not yet chosen')
    expect(scheduledRow.tagName).not.toBe('A')
  })

  it('the current issue row is marked current and is not a link', () => {
    render(<RunBody {...baseProps()} />)
    const currentRow = screen.getByTestId('switcher-row-999717')
    expect(currentRow.getAttribute('aria-current')).toBe('true')
    expect(currentRow.tagName).not.toBe('A')
  })
})
