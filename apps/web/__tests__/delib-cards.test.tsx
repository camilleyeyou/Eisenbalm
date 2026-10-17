import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DelibCards } from '@/components/dispatch/DelibCards'
import { deliberationCards } from '@/lib/dispatch/derive'
import { DELIB_INTRO } from '@/lib/dispatch/copy'
import { fullIssue } from './fixtures/issue'

afterEach(cleanup)

describe('DelibCards', () => {
  const cards = deliberationCards(fullIssue)

  it('renders picked / runner-up / also cards and a real meter', () => {
    const { container } = render(<DelibCards cards={cards} confidence={0.8} />)
    const sec = container.querySelector('section#delib.d-sec--delib')!
    expect(sec).not.toBeNull()
    expect(sec.querySelector('.d-disc')!.textContent).toBe('07')
    expect(sec.textContent).toContain(DELIB_INTRO)
    const arts = container.querySelectorAll('article')
    expect(arts).toHaveLength(cards.length)
    expect(cards.length).toBeGreaterThanOrEqual(2)
    expect(arts[0]!.className).toContain('d-delib-card--picked')
    expect(arts[0]!.textContent).toContain('Picked')
    expect(arts[0]!.querySelector('h3')!.textContent).toBe(cards[0]!.name)
    expect(arts[1]!.textContent).toContain('Runner-up')
    const meter = container.querySelector('[role="meter"]')!
    expect(meter.getAttribute('aria-valuenow')).toBe('80')
    expect(meter.getAttribute('aria-valuemin')).toBe('0')
    expect(meter.getAttribute('aria-valuemax')).toBe('100')
    expect(container.querySelector('#delib-confidence-label')!.textContent).toBe("Editor's confidence")
    expect(container.textContent).toContain('80%')
  })

  it('omits the meter when confidence is null', () => {
    const { container } = render(<DelibCards cards={cards} confidence={null} />)
    expect(container.querySelector('[role="meter"]')).toBeNull()
    expect(container.textContent).not.toContain("Editor's confidence")
  })

  it('shows the empty-state sentence when there are no cards', () => {
    const { container } = render(<DelibCards cards={[]} confidence={null} />)
    expect(container.querySelectorAll('article')).toHaveLength(0)
    expect(container.textContent).toContain('This issue predates the open deliberation record.')
  })
})

describe('DelibCards source contract', () => {
  const raw = readFileSync(resolve(__dirname, '../components/dispatch/DelibCards.tsx'), 'utf-8')
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  it('has no subscriptions, transcript or model names', () => {
    for (const bad of ['useQuery', 'convex/react', '@convex/_generated', 'conversation', 'DelibChat', 'modelVersions', '?? 80', 'role="log"'])
      expect(code, bad).not.toContain(bad)
    const lower = code.toLowerCase()
    for (const bad of ['claude', 'gpt', 'sonnet', 'haiku', 'openrouter']) expect(lower, bad).not.toContain(bad)
  })
})
