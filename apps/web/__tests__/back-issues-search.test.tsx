import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { BackIssues } from '@/components/dispatch/BackIssues'
import { archiveIssues } from './fixtures/issue'
import { toneForIssue } from '@/lib/brand'
import { ARCHIVE_EMPTY, BACK_ISSUES_HEADING, SEARCH_EMPTY, SEARCH_LABEL, SEARCH_PLACEHOLDER } from '@/lib/dispatch/copy'

afterEach(cleanup)

describe('BackIssues', () => {
  it('renders 8 tone cards for earlier issues', () => {
    const { container } = render(<BackIssues issues={archiveIssues} currentIssueNumber={10} />)
    expect(container.querySelector('section#back-issues h2')?.textContent).toBe(BACK_ISSUES_HEADING)
    const cards = container.querySelectorAll('a.d-backcard')
    expect(cards.length).toBe(8)
    expect(cards[0]!.getAttribute('href')).toBe('/issue/issue-9')
    expect(cards[0]!.className).toContain(`d-tone-${toneForIssue(9)}`)
    expect(cards[0]!.textContent).toContain('No. 9')
    expect(cards[0]!.textContent).toContain('Charity Number 9')
    const input = screen.getByLabelText(SEARCH_LABEL) as HTMLInputElement
    expect(input.type).toBe('search')
    expect(input.placeholder).toBe(SEARCH_PLACEHOLDER)
    const all = container.querySelector('a[href="/archive"]')!
    expect(all.className).toContain('d-tap')
  })

  it('filters by issue number, announces, and restores', () => {
    const { container } = render(<BackIssues issues={archiveIssues} currentIssueNumber={10} />)
    const input = screen.getByLabelText(SEARCH_LABEL)
    fireEvent.change(input, { target: { value: '3' } })
    expect(container.querySelectorAll('a.d-backcard').length).toBe(1)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('1 nonprofit')
    fireEvent.change(input, { target: { value: '' } })
    expect(container.querySelectorAll('a.d-backcard').length).toBe(8)
  })

  it('matches cause case-insensitively', () => {
    const focus = archiveIssues[1]!.charity.focusArea!
    const { container } = render(<BackIssues issues={archiveIssues} currentIssueNumber={10} />)
    fireEvent.change(screen.getByLabelText(SEARCH_LABEL), { target: { value: focus.toUpperCase() } })
    expect(container.querySelectorAll('a.d-backcard').length).toBeGreaterThan(0)
  })

  it('shows no-match state', () => {
    const { container } = render(<BackIssues issues={archiveIssues} currentIssueNumber={10} />)
    fireEvent.change(screen.getByLabelText(SEARCH_LABEL), { target: { value: 'zzzz' } })
    expect(container.textContent).toContain(SEARCH_EMPTY)
  })

  it('shows empty state without search', () => {
    const { container } = render(<BackIssues issues={archiveIssues.slice(0, 1)} currentIssueNumber={10} />)
    expect(container.textContent).toContain(ARCHIVE_EMPTY)
    expect(container.querySelector('input')).toBeNull()
  })
})
