import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Stations from '../components/editor/Stations'
import type { StationVM } from '../lib/editorState'

afterEach(cleanup)

const stations: StationVM[] = [
  { name: 'Pick charity', word: 'Done', line: 'Done', current: false, complete: true },
  { name: 'Write', word: 'Working', line: 'Working', current: true, complete: false },
  { name: 'Check', word: 'Not yet', line: 'Not yet', current: false, complete: false },
  { name: 'Publish', word: 'Not yet', line: 'Not yet', current: false, complete: false },
]

describe('Stations', () => {
  it('renders four labelled items in order with lines', () => {
    render(<Stations stations={stations} />)
    const ol = screen.getByRole('list', { name: 'Progress on this issue' })
    const lis = ol.querySelectorAll(':scope > li')
    expect(lis.length).toBe(4)
    expect(Array.from(lis).map((l) => l.querySelector('p')?.textContent)).toEqual(['Pick charity', 'Write', 'Check', 'Publish'])
    expect(screen.getByText('Working')).toBeTruthy()
  })

  it('marks only the current station', () => {
    const { container } = render(<Stations stations={stations} />)
    const cur = container.querySelectorAll('[aria-current="step"]')
    expect(cur.length).toBe(1)
    expect(cur[0].textContent).toContain('Write')
  })

  it('is one column on phone and four from sm', () => {
    const { container } = render(<Stations stations={stations} />)
    const cls = container.querySelector('ol')!.className
    expect(cls).toContain('grid-cols-1')
    expect(cls).toContain('sm:grid-cols-4')
  })
})
