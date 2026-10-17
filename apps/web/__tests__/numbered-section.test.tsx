import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { NumberedSection } from '@/components/dispatch/NumberedSection'

afterEach(cleanup)

describe('NumberedSection', () => {
  it('renders title as the single h2 with disc and eyebrow', () => {
    const { container } = render(
      <NumberedSection id="origin" number="01" label="How it started" title="A garage in Ohio">
        <p>body</p>
      </NumberedSection>,
    )
    const sec = container.querySelector('section')!
    expect(sec.id).toBe('origin')
    expect(sec.className).toContain('d-sec')
    expect(sec.className).toContain('d-sec--origin')
    expect(sec.getAttribute('aria-labelledby')).toBe('origin-title')
    const disc = container.querySelector('.d-disc')!
    expect(disc.textContent).toBe('01')
    expect(disc.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('p.d-eyebrow')!.textContent).toBe('How it started')
    const h2s = container.querySelectorAll('h2')
    expect(h2s).toHaveLength(1)
    expect(h2s[0]!.textContent).toBe('A garage in Ohio')
    expect(h2s[0]!.id).toBe('origin-title')
    expect(container.querySelector('.d-container > p')!.textContent).toBe('body')
  })

  it.each([undefined, null, '   '])('label becomes the h2 when title is %j', (t) => {
    const { container } = render(<NumberedSection id="pod" number="08" label="The Dispatch podcast" title={t} />)
    const h2s = container.querySelectorAll('h2')
    expect(h2s).toHaveLength(1)
    expect(h2s[0]!.className).toBe('d-eyebrow')
    expect(h2s[0]!.id).toBe('pod-title')
    expect(container.querySelector('p.d-eyebrow')).toBeNull()
  })

  it('compact adds class', () => {
    const { container } = render(<NumberedSection id="game" number="05" label="The game" compact />)
    expect(container.querySelector('section')!.className).toContain('d-sec--compact')
  })
})
