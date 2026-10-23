import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import PartsList from '../components/editor/PartsList'
import { PART_ORDER } from '../lib/editorState'
import type { HomeSectionRow } from '../lib/homeSections'

afterEach(cleanup)

function rows(over: Partial<HomeSectionRow> = {}): HomeSectionRow[] {
  return PART_ORDER.map((id, i) => ({
    id,
    label: id,
    headline: `Headline ${i + 1}`,
    state: 'clean' as const,
    agentChanges: 2,
    href: `/part/${id}`,
    ...(i === 0 ? over : {}),
  }))
}

describe('PartsList', () => {
  it('renders nine rows with the heading and hint', () => {
    const { container } = render(<PartsList rows={rows()} published={false} hint="Click a part." />)
    expect(container.querySelectorAll('ol > li').length).toBe(9)
    expect(screen.getByRole('heading', { name: 'The nine parts' })).toBeTruthy()
    expect(screen.getByText('Click a part.')).toBeTruthy()
    expect(screen.getByText('Origin story')).toBeTruthy()
    expect(screen.getByText('Look')).toBeTruthy()
  })

  it('clean rows are full-row links with the written status', () => {
    render(<PartsList rows={rows()} published={false} hint="" />)
    const a = screen.getAllByRole('link')[0]
    expect(a.getAttribute('href')).toBe('/part/originStory')
    expect(a.textContent).toContain('Headline 1')
    expect(a.textContent).toContain('Written · 2 fixes by the writers')
  })

  it('writing and not-written rows are not links', () => {
    const { container } = render(<PartsList rows={rows({ state: 'writing' })} published={false} hint="" />)
    expect(container.querySelectorAll('a').length).toBe(8)
    expect(screen.getByText('Working')).toBeTruthy()
    cleanup()
    const r2 = render(<PartsList rows={rows({ state: 'not-written', headline: '' })} published={false} hint="" />)
    expect(r2.container.querySelectorAll('a').length).toBe(8)
    expect(screen.getByText('Not yet')).toBeTruthy()
  })

  it('published shows Published on clean rows', () => {
    render(<PartsList rows={rows()} published hint="" />)
    expect(screen.getAllByText('Published').length).toBe(9)
  })

  it('every row has min-h-[64px]', () => {
    const { container } = render(<PartsList rows={rows()} published={false} hint="" />)
    container.querySelectorAll('ol > li > a').forEach((a) => expect(a.className).toContain('min-h-[64px]'))
  })
})
