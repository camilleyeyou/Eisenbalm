import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

import { DispatchMasthead } from '@/components/dispatch/DispatchMasthead'
import { Ticker } from '@/components/dispatch/Ticker'
import { HowStrip } from '@/components/dispatch/HowStrip'
import { Hero } from '@/components/dispatch/Hero'
import { IssueNav } from '@/components/dispatch/IssueNav'
import {
  FUND_CTA,
  HERO_EYEBROW,
  HOW_STEPS,
  MASTHEAD_TAGLINE,
  READ_STORY_CTA,
  SECTION_META,
  STICKER_LINES,
  TICKER_CONSTANT_LINE,
  bonusLabel,
} from '@/lib/dispatch/copy'

afterEach(cleanup)

describe('DispatchMasthead', () => {
  it('renders issue line, nav, fund pill, wordmark as p', () => {
    const { container } = render(
      <DispatchMasthead issueNumber={2} dateLabel="Thursday, October 15, 2026" />,
    )
    const header = container.querySelector('header')!
    expect(header.textContent).toContain('Issue 2 · Thursday, October 15, 2026')
    const nav = header.querySelector('nav[aria-label="Main"]')!
    expect([...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '#story',
      '/archive',
      '#how',
      '#about',
    ])
    const fund = [...header.querySelectorAll('a')].find((a) => a.textContent === FUND_CTA)!
    expect(fund.getAttribute('href')).toBe('#buy')
    expect(container.querySelector('h1,h2')).toBeNull()
    expect(container.querySelector('p.d-wordmark')!.textContent).toBe('The Eisenbalm Dispatch')
    const dots = container.querySelector('.d-dots')!
    expect(dots.getAttribute('aria-hidden')).toBe('true')
    expect(dots.querySelectorAll('.d-dot')).toHaveLength(4)
    expect(container.querySelector('.d-tagline')!.textContent).toBe(MASTHEAD_TAGLINE)
  })

  it('compact hides nav and fund pill', () => {
    const { container } = render(<DispatchMasthead issueNumber={null} dateLabel={null} compact />)
    expect(container.querySelector('nav')).toBeNull()
    expect(container.querySelector('header a')).toBeNull()
  })
})

describe('Ticker', () => {
  it('is aria-hidden with duplicate set ending in the constant line', () => {
    const { container } = render(<Ticker lines={['A', 'B']} />)
    expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true')
    const sets = container.querySelectorAll('.d-ticker-set')
    expect(sets).toHaveLength(2)
    expect(sets[1]!.classList.contains('d-ticker-set--dup')).toBe(true)
    for (const s of sets) {
      const items = s.querySelectorAll('li')
      expect(items[items.length - 1]!.textContent).toBe(TICKER_CONSTANT_LINE)
    }
  })
})

describe('HowStrip', () => {
  it('renders three steps under an h2', () => {
    const { container } = render(<HowStrip />)
    expect(container.querySelector('section#how')).not.toBeNull()
    expect(container.querySelector('h2')!.textContent).toBe('How the Dispatch works')
    const lis = container.querySelectorAll('ol li')
    expect(lis).toHaveLength(3)
    HOW_STEPS.forEach((s, i) => {
      expect(lis[i]!.querySelector('p')!.textContent).toBe(s.lead + s.rest)
    })
    expect(lis[0]!.textContent).toContain('Thursday')
  })
})

const heroProps = {
  issueNumber: 2,
  charityName: 'Quiet Harbor',
  headline: 'A harbor nobody asked about',
  dek: 'Dek text.',
  chips: [{ label: 'Founded', value: '1999' }],
  readTime: '7-minute read',
  heroImage: null,
}

describe('Hero', () => {
  it('renders one h1, eyebrow, ctas, shapes art and sticker', () => {
    const { container } = render(<Hero {...heroProps} />)
    const root = container.querySelector('section#story')!
    expect(root.classList.contains('d-hero')).toBe(true)
    expect(root.querySelectorAll('h1')).toHaveLength(1)
    expect(root.querySelector('h1')!.textContent).toBe(heroProps.headline)
    expect(root.textContent).toContain('Issue 2 · 7-minute read')
    expect(root.textContent).toContain(HERO_EYEBROW)
    expect(root.querySelector('p.d-hero-charity')!.textContent).toBe('Quiet Harbor')
    expect(root.querySelector('p.d-hero-dek')!.textContent).toBe('Dek text.')
    expect(root.querySelectorAll('dl dt')).toHaveLength(1)
    expect(root.querySelectorAll('dl dd')).toHaveLength(1)
    const links = [...root.querySelectorAll('a')]
    expect(links.find((a) => a.textContent === READ_STORY_CTA)!.getAttribute('href')).toBe('#origin')
    expect(links.find((a) => a.textContent === FUND_CTA)!.getAttribute('href')).toBe('#buy')
    const art = root.querySelector('.d-hero-art--shapes')!
    expect(art.getAttribute('aria-hidden')).toBe('true')
    expect(root.querySelector('img')).toBeNull()
    const sticker = root.querySelector('.d-sticker')!
    expect(sticker.textContent).toContain(STICKER_LINES[0])
    expect(sticker.textContent).toContain(STICKER_LINES[1])
    expect(root.textContent).not.toMatch(/goes here|Illustration/)
  })

  it('omits dek and chips when absent', () => {
    const { container } = render(<Hero {...heroProps} dek={null} chips={[]} />)
    expect(container.querySelector('.d-hero-dek')).toBeNull()
    expect(container.querySelector('dl')).toBeNull()
  })

  it('renders photo with alt, falling back to charity name', () => {
    const img = { url: 'https://cdn.sanity.io/x.jpg', alt: 'Boats', width: 10, height: 10 }
    const a = render(<Hero {...heroProps} heroImage={img} />)
    expect(a.container.querySelector('img')!.getAttribute('alt')).toBe('Boats')
    expect(a.container.querySelector('.d-hero-art--shapes')).toBeNull()
    cleanup()
    const b = render(<Hero {...heroProps} heroImage={{ ...img, alt: null }} />)
    expect(b.container.querySelector('img')!.getAttribute('alt')).toBe('Quiet Harbor')
  })

  it('narrator chip only for active non-Jesse narrators', () => {
    const chip = (n: Parameters<typeof Hero>[0]['narrator']) => {
      const r = render(<Hero {...heroProps} narrator={n} />)
      const el = r.container.querySelector('[data-testid="narrator-chip"]')
      cleanup()
      return el
    }
    expect(chip({ name: 'Ada', slug: 'ada', active: true })).not.toBeNull()
    const r = render(<Hero {...heroProps} narrator={{ name: 'Ada', slug: 'ada', active: true }} />)
    expect(r.container.querySelector('[data-testid="narrator-chip"]')!.textContent).toBe('Narrated by Ada')
    cleanup()
    expect(chip({ name: 'Ada', slug: 'ada', active: false })).toBeNull()
    expect(chip({ name: 'Jesse Eisenbalm', slug: 'jesse', active: true })).toBeNull()
    expect(chip(null)).toBeNull()
  })
})

describe('IssueNav', () => {
  it('lists 8 sections in order with bonus label and fund link', () => {
    const { container } = render(<IssueNav charityName="Quiet Harbor" bonusType="jingle" />)
    const nav = container.querySelector('nav[aria-label="In this issue"]')!
    const links = [...nav.querySelectorAll('ul a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual(SECTION_META.map((s) => `#${s.id}`))
    expect(links[5]!.textContent).toBe(bonusLabel('jingle'))
    for (const a of links) {
      expect(a.querySelector('.d-dot')!.getAttribute('aria-hidden')).toBe('true')
      expect(a.hasAttribute('aria-current')).toBe(false)
    }
    const fund = [...nav.querySelectorAll('a')].find((a) => a.textContent === FUND_CTA)!
    expect(fund.getAttribute('href')).toBe('#buy')
  })
})
