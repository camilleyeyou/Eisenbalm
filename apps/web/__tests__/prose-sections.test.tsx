import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PullQuote } from '@/components/dispatch/PullQuote'
import { OriginSection } from '@/components/dispatch/sections/OriginSection'
import { FounderSection } from '@/components/dispatch/sections/FounderSection'
import { ProblemSection } from '@/components/dispatch/sections/ProblemSection'
import { CaseSection } from '@/components/dispatch/sections/CaseSection'
import { caseTimeline, pullQuote, statTiles } from '@/lib/dispatch/derive'
import { fullIssue, longWordIssue } from './fixtures/issue'

afterEach(cleanup)
const f = fullIssue!

describe('PullQuote', () => {
  it('renders blockquote with tone mark', () => {
    const { container } = render(<PullQuote text="Hello." tone="red" />)
    expect(container.querySelector('blockquote.d-pullquote .d-pullquote-mark--red')?.textContent).toBe('Hello.')
  })
})

describe('OriginSection', () => {
  it('renders full content', () => {
    const { container } = render(
      <OriginSection headline={f.originStory!.headline} body={f.originStory!.body} pullQuote={pullQuote(f, 'origin')} />,
    )
    const s = container.querySelector('section#origin.d-sec--origin')!
    expect(s.querySelector('.d-disc')?.textContent).toBe('01')
    expect(s.querySelector('h2')?.textContent).toBe('The Chair Is Not Optional')
    expect(s.querySelectorAll('.d-prose p').length).toBe(2)
    expect(s.querySelector('blockquote')?.textContent).toContain('garage in spirit')
  })
  it('degrades by omission', () => {
    const { container } = render(<OriginSection headline={null} body={null} pullQuote={null} />)
    expect(container.querySelectorAll('section#origin h2').length).toBe(1)
    expect(container.querySelector('blockquote')).toBeNull()
    expect(container.querySelector('.d-prose')).toBeNull()
  })
  it('long-word headline stays in .d-heading with no inline styles', () => {
    const { container } = render(
      <OriginSection headline={longWordIssue!.originStory!.headline} body={null} pullQuote={null} />,
    )
    expect(container.querySelector('h2.d-heading')).not.toBeNull()
    expect(container.querySelector('[style]')).toBeNull()
  })
})

describe('FounderSection', () => {
  it('two-column wrapper, one h2', () => {
    const { container } = render(<FounderSection headline={f.founderBio!.headline} body={f.founderBio!.body} />)
    const s = container.querySelector('section#founder.d-sec--founder')!
    expect(s.querySelector('.d-disc')?.textContent).toBe('03')
    expect(s.querySelectorAll('h2').length).toBe(1)
    expect(s.querySelector('.d-founder-cols')?.children.length).toBe(2)
  })
  it('empty renders section only', () => {
    const { container } = render(<FounderSection headline={null} body={null} />)
    expect(container.querySelector('section#founder')).not.toBeNull()
    expect(container.querySelector('.d-founder-cols')).toBeNull()
  })
})

describe('ProblemSection', () => {
  it('renders tiles and pdf link', () => {
    const tiles = statTiles(f)
    const { container } = render(
      <ProblemSection headline="H" body={f.problemStatement!.body} tiles={tiles} pdfUrl="https://x.test/a.pdf" />,
    )
    const s = container.querySelector('section#problem.d-sec--problem')!
    expect(s.querySelector('.d-disc')?.textContent).toBe('02')
    expect(s.querySelectorAll('.d-stat').length).toBe(3)
    expect(s.querySelectorAll('.d-stat-figure').length).toBeGreaterThanOrEqual(1)
    expect(s.querySelector('.d-stat-caption--solo')).not.toBeNull()
    expect(s.querySelector('a[aria-label="Download the Problem Statement Deck as PDF"]')).not.toBeNull()
  })
  it('omits stats and pdf when absent', () => {
    const { container } = render(<ProblemSection headline={null} body={null} tiles={[]} pdfUrl={null} />)
    expect(container.querySelector('.d-stats')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('section#problem')).not.toBeNull()
  })
})

describe('CaseSection', () => {
  it('renders timeline with result step and red quote', () => {
    const { container } = render(
      <CaseSection
        headline={f.caseStudy!.headline}
        subjectName="Marta"
        body={f.caseStudy!.body}
        timeline={caseTimeline(f)}
        pullQuote={pullQuote(f, 'case')}
      />,
    )
    const s = container.querySelector('section#case.d-sec--case')!
    expect(s.querySelector('.d-disc')?.textContent).toBe('04')
    const lis = s.querySelectorAll('ol.d-timeline li')
    expect(lis.length).toBe(4)
    expect(lis[3]!.className).toContain('d-timeline-step--result')
    expect(s.querySelector('.d-pullquote-mark--red')).not.toBeNull()
    expect(s.querySelector('.d-case-subject')?.textContent).toBe('Marta')
  })
  it('omits timeline and quote when absent', () => {
    const { container } = render(
      <CaseSection headline={null} subjectName={null} body={null} timeline={[]} pullQuote={null} />,
    )
    expect(container.querySelector('ol')).toBeNull()
    expect(container.querySelector('blockquote')).toBeNull()
  })
})
