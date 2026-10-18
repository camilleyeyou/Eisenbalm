import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const pathnameMock = vi.fn(() => '/archive')
vi.mock('next/navigation', () => ({ usePathname: () => pathnameMock() }))

import { SiteTopBar } from '@/components/dispatch/SiteTopBar'
import { SitePage } from '@/components/dispatch/SitePage'
import { FUND_CTA, SITE_TOPBAR_LINKS, TOPBAR_LINKS } from '@/lib/dispatch/copy'

afterEach(cleanup)

const EXPECTED = [
  ["This week's nonprofit", '/'],
  ['Past nonprofits', '/archive'],
  ['Charities', '/charities'],
  ['How it works', '/#how'],
  ['About', '/about'],
  ['Shop', '/shop'],
]

describe('SITE_TOPBAR_LINKS', () => {
  it('matches the six locked links; front-page TOPBAR_LINKS unchanged', () => {
    expect(SITE_TOPBAR_LINKS.map((l) => [l.label, l.href])).toEqual(EXPECTED)
    expect(TOPBAR_LINKS[0].href).toBe('#story')
  })
})

describe('SiteTopBar', () => {
  it('renders wordmark, six nav links in order, and the Fund pill', () => {
    pathnameMock.mockReturnValue('/archive')
    const { container } = render(<SiteTopBar />)
    const header = container.querySelector('header[data-site-header]')
    expect(header).not.toBeNull()
    expect(header!.classList.contains('dispatch')).toBe(true)
    const navs = container.querySelectorAll('nav[aria-label="Main"]')
    expect(navs.length).toBe(1)
    const mark = container.querySelector('a.d-sitebar-mark')!
    expect(mark.textContent).toContain('The Eisenbalm Dispatch')
    expect(mark.getAttribute('href')).toBe('/')
    const links = Array.from(navs[0]!.querySelectorAll('a'))
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual(EXPECTED)
    links.forEach((a) => expect(a.classList.contains('d-tap')).toBe(true))
    const pill = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === FUND_CTA)!
    expect(pill.getAttribute('href')).toBe('/shop')
    expect(container.querySelector('.hidden, [aria-hidden="true"]:not(.d-dots)')).toBeNull()
  })

  it('marks only Past nonprofits current on /archive', () => {
    pathnameMock.mockReturnValue('/archive')
    const { container } = render(<SiteTopBar />)
    const cur = Array.from(container.querySelectorAll('nav a[aria-current="page"]'))
    expect(cur.map((a) => a.textContent)).toEqual(['Past nonprofits'])
  })

  it('marks Charities current on /charities/some-slug', () => {
    pathnameMock.mockReturnValue('/charities/some-slug')
    const { container } = render(<SiteTopBar />)
    const cur = Array.from(container.querySelectorAll('nav a[aria-current="page"]'))
    expect(cur.map((a) => a.textContent)).toEqual(['Charities'])
  })
})

describe('SitePage', () => {
  it('renders a toned header band with one h1', () => {
    const { container } = render(
      <SitePage eyebrow="Legal" title="Terms" tone="blue">x</SitePage>,
    )
    const root = container.firstElementChild!
    expect(root.classList.contains('dispatch')).toBe(true)
    expect(root.classList.contains('d-page')).toBe(true)
    expect(container.querySelectorAll('h1').length).toBe(1)
    expect(container.querySelector('h1')!.textContent).toBe('Terms')
    const head = container.querySelector('header')!
    expect(head.classList.contains('d-tone-blue')).toBe(true)
    expect(head.classList.contains('d-on-dark')).toBe(true)
  })

  it('renders no h1 and no header band without a title', () => {
    const { container } = render(<SitePage>x</SitePage>)
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('header')).toBeNull()
  })
})
