import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn().mockResolvedValue(null),
}))
vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: { insert: 'qaCorrections:insert' },
    stripeOrders: { balmsForCharity: 'stripeOrders:balmsForCharity' },
  },
}))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))

import { heroHeadline } from '@/lib/dispatch/derive'
import { IssueLayout } from '@/components/issue/IssueLayout'
import { fullIssue, sparseIssue, longWordIssue, archiveIssues } from './fixtures/issue'

afterEach(cleanup)

const ORDER = ['story', 'how', 'origin', 'problem', 'founder', 'case', 'game', 'bonus', 'delib', 'pod', 'buy', 'back-issues']

function renderFull() {
  return render(<IssueLayout issue={fullIssue} slug="issue-2" archive={archiveIssues} isCurrent initialBalms={3} />)
}

describe('IssueLayout Dispatch composition', () => {
  it('wraps in .dispatch with the weekly accent style', () => {
    const { container } = renderFull()
    expect(container.querySelector('.dispatch')).not.toBeNull()
    const css = Array.from(container.querySelectorAll('style')).map((s) => s.textContent).join('')
    expect(css).toContain('--d-accent:#00FF79')
  })

  it('renders section ids once, in order', () => {
    const { container } = renderFull()
    const positions = ORDER.map((id) => {
      expect(container.querySelectorAll(`#${id}`).length).toBe(1)
      return Array.from(container.querySelectorAll('[id]')).findIndex((el) => el.id === id)
    })
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('has one h1, no main, an In this issue nav, a meter and no log', () => {
    const { container, getByText } = renderFull()
    expect(container.querySelectorAll('h1').length).toBe(1)
    expect(container.querySelectorAll('main').length).toBe(0)
    expect(container.querySelector('nav[aria-label="In this issue"]')).not.toBeNull()
    expect(container.querySelector('[role="log"]')).toBeNull()
    expect(container.querySelector('[role="meter"]')).not.toBeNull()
    expect(getByText(/Picked/)).toBeTruthy()
  })

  it('degrades for a sparse issue and keeps section ids (bonus is omitted when absent, pre-existing)', () => {
    const { container } = render(<IssueLayout issue={sparseIssue} slug="s" />)
    const ids = Array.from(container.querySelectorAll('[id]')).map((e) => e.id)
    for (const id of ['origin', 'problem', 'founder', 'case', 'game', 'delib', 'pod']) {
      expect(ids, `missing #${id}`).toContain(id)
    }
    expect(container.querySelectorAll('.d-chips > *').length).toBeLessThanOrEqual(1) // location only
    for (const sel of ['.d-stats', '.d-timeline', '.d-pullquote', '[role="meter"]']) {
      expect(container.querySelector(sel)).toBeNull()
    }
  })

  it('nav only links to ids that render (no dangling #bonus on a sparse issue)', () => {
    const { container } = render(<IssueLayout issue={sparseIssue} slug="s" />)
    const hrefs = Array.from(container.querySelectorAll('nav[aria-label="In this issue"] a[href^="#"]')).map((a) =>
      a.getAttribute('href')!.slice(1),
    )
    expect(hrefs).not.toContain('bonus')
    for (const id of hrefs) expect(container.querySelector(`#${id}`), `dangling #${id}`).not.toBeNull()
  })

  it('nav keeps the bonus link when the issue has a bonus', () => {
    const { container } = renderFull()
    expect(container.querySelector('nav[aria-label="In this issue"] a[href="#bonus"]')).not.toBeNull()
  })

  it('renders a long charity name in the h1 without inline widths', () => {
    const { container } = render(<IssueLayout issue={longWordIssue} slug="l" />)
    const h1 = container.querySelector('h1')!
    expect(h1.textContent).toContain(heroHeadline(longWordIssue))
    expect(h1.getAttribute('style')).toBeNull()
  })

  it('omits back issues when archive is undefined', () => {
    const { container } = render(<IssueLayout issue={fullIssue} slug="issue-2" noindex />)
    expect(container.querySelector('#back-issues')).toBeNull()
  })
})
