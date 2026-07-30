/**
 * quick 260730-ldn (Task 5) — pure tests for `ArchiveBody` (fixture rows
 * only, no Convex — the `RunBody` precedent). No Convex mocking is set up
 * anywhere in this file; if `ArchiveBody`/`ArchiveRowView` performed any
 * per-row subscription, these renders would throw (no `ConvexProvider` is
 * mounted here) — that absence IS the structural N+1 guard. Runs in jsdom
 * (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ArchiveBody, type ArchiveRow } from '../app/(dashboard)/issues/page'

afterEach(() => {
  cleanup()
})

function makeRows(): ArchiveRow[] {
  return [
    {
      issueNumber: 999717,
      title: 'The Kumasi Roofless Schools Audit',
      dek: 'An accountant retired, walked eleven districts, and counted the schools with no roof.',
      hasDrafts: true,
      runId: 'run-717',
      published: false,
      held: false,
      relativeWeek: 'This week',
    },
    {
      issueNumber: 999716,
      title: 'The Bicycle Ambulance Corps of Rukungiri',
      dek: 'Forty volunteers, twelve bicycles, and a district hospital eleven kilometres away.',
      hasDrafts: true,
      runId: 'run-716',
      published: true,
      held: false,
      relativeWeek: 'Last week',
    },
    {
      issueNumber: 999714,
      title: 'A Library Kept in Four Suitcases',
      dek: 'Held — the founder asked us to wait until the trial concludes.',
      hasDrafts: true,
      runId: 'run-714',
      published: false,
      held: true,
      relativeWeek: '4 weeks ago',
    },
    {
      issueNumber: 999720,
      title: null,
      dek: 'Discovery runs Thursday 14:00 UTC. No drafts yet.',
      hasDrafts: false,
      runId: null,
      published: false,
      held: false,
      relativeWeek: 'Thu 14:00',
    },
  ]
}

describe('ArchiveBody — groups', () => {
  it('renders four group headings in order: In progress, Published, Held, Scheduled', () => {
    render(<ArchiveBody rows={makeRows()} />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(headings).toEqual(['In progress', 'Published', 'Held', 'Scheduled'])
  })

  it('omits a heading whose group is empty', () => {
    const rows = makeRows().filter(r => !r.held)
    render(<ArchiveBody rows={rows} />)
    // Scoped to the heading role — the filter-chip button also reads "Held".
    expect(screen.queryByRole('heading', { level: 2, name: 'Held' })).toBeNull()
  })
})

describe('ArchiveBody — row rendering', () => {
  it('a row leads with its title in the display font, and carries the issue number as mono metadata', () => {
    render(<ArchiveBody rows={makeRows()} />)
    expect(screen.getByTestId('archive-row-999717-title').textContent).toBe(
      'The Kumasi Roofless Schools Audit',
    )
    expect(screen.getByTestId('archive-row-999717-number').textContent).toBe('999717')
  })

  it('a row whose title is null reads "Not yet chosen" — never a fabricated title, never a bare number', () => {
    render(<ArchiveBody rows={makeRows()} />)
    expect(screen.getByTestId('archive-row-999720-title').textContent).toBe('Not yet chosen')
  })

  it("a row's dek renders subtitle when present; a held row's dek carries the held reason", () => {
    render(<ArchiveBody rows={makeRows()} />)
    const inProgressRow = screen.getByTestId('archive-row-999717')
    expect(inProgressRow.textContent).toContain(
      'An accountant retired, walked eleven districts, and counted the schools with no roof.',
    )
    const heldRow = screen.getByTestId('archive-row-999714')
    expect(heldRow.textContent).toContain(
      'Held — the founder asked us to wait until the trial concludes.',
    )
  })

  it('renders the relative-week label for each row', () => {
    render(<ArchiveBody rows={makeRows()} />)
    expect(screen.getByTestId('archive-row-999717').textContent).toContain('This week')
    expect(screen.getByTestId('archive-row-999716').textContent).toContain('Last week')
    expect(screen.getByTestId('archive-row-999714').textContent).toContain('4 weeks ago')
  })

  it('a hasDrafts:false scheduled row is dimmed and is NOT a link', () => {
    render(<ArchiveBody rows={makeRows()} />)
    const row = screen.getByTestId('archive-row-999720')
    expect(row.tagName).not.toBe('A')
  })

  it('a hasDrafts:true row IS a link to its draft desk', () => {
    render(<ArchiveBody rows={makeRows()} />)
    const row = screen.getByTestId('archive-row-999717')
    expect(row.tagName).toBe('A')
    expect(row.getAttribute('href')).toBe('/issues/999717/draft')
  })
})

describe('ArchiveBody — search', () => {
  it('typing "kumasi" filters to titles matching case-insensitively', () => {
    render(<ArchiveBody rows={makeRows()} />)
    fireEvent.change(screen.getByLabelText('Search titles'), { target: { value: 'kumasi' } })
    expect(screen.getByTestId('archive-row-999717')).toBeDefined()
    expect(screen.queryByTestId('archive-row-999716')).toBeNull()
  })

  it('typing "999716" matches by issue number', () => {
    render(<ArchiveBody rows={makeRows()} />)
    fireEvent.change(screen.getByLabelText('Search titles'), { target: { value: '999716' } })
    expect(screen.getByTestId('archive-row-999716')).toBeDefined()
    expect(screen.queryByTestId('archive-row-999717')).toBeNull()
  })

  it('a query matching nothing renders an explicit empty message, not a blank page', () => {
    render(<ArchiveBody rows={makeRows()} />)
    fireEvent.change(screen.getByLabelText('Search titles'), {
      target: { value: 'zzz-no-match-anywhere' },
    })
    expect(screen.getByText(/no issues match/i)).toBeDefined()
    expect(screen.queryByTestId('archive-row-999717')).toBeNull()
  })
})

describe('ArchiveBody — filter chips', () => {
  it('"All" is the default and shows every row', () => {
    render(<ArchiveBody rows={makeRows()} />)
    for (const n of [999717, 999716, 999714, 999720]) {
      expect(screen.getByTestId(`archive-row-${n}`)).toBeDefined()
    }
  })

  it('"Published" narrows to published rows only', () => {
    render(<ArchiveBody rows={makeRows()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Published' }))
    expect(screen.getByTestId('archive-row-999716')).toBeDefined()
    expect(screen.queryByTestId('archive-row-999717')).toBeNull()
    expect(screen.queryByTestId('archive-row-999714')).toBeNull()
  })

  it('"Held" narrows to held rows only', () => {
    render(<ArchiveBody rows={makeRows()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Held' }))
    expect(screen.getByTestId('archive-row-999714')).toBeDefined()
    expect(screen.queryByTestId('archive-row-999717')).toBeNull()
  })

  it('"Has drafts" keeps only hasDrafts:true rows', () => {
    render(<ArchiveBody rows={makeRows()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Has drafts' }))
    expect(screen.getByTestId('archive-row-999717')).toBeDefined()
    expect(screen.queryByTestId('archive-row-999720')).toBeNull()
  })
})

describe('ArchiveBody — structural guard against N+1', () => {
  it('renders from ONE fixture array with zero Convex mocking required', () => {
    // No `vi.mock('convex/react', ...)` exists anywhere in this file. If the
    // row component performed its own per-row subscription (the
    // `RecentlyPublishedRowContainer` pattern this list must never repeat),
    // this render would throw for lack of a ConvexProvider.
    expect(() => render(<ArchiveBody rows={makeRows()} />)).not.toThrow()
  })
})
