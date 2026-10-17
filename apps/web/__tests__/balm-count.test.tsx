import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const queryMock = vi.fn()
vi.mock('convex/react', () => ({ useQuery: (...a: unknown[]) => queryMock(...a) }))
vi.mock('@convex/_generated/api', () => ({ api: { stripeOrders: { balmsForCharity: 'balmsForCharity' } } }))
const clientQuery = vi.fn()
vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    query(...a: unknown[]) {
      return clientQuery(...a)
    }
  },
}))

import { BalmTile, BalmCounter } from '@/components/dispatch/BalmCounter'
import { fetchBalms } from '@/lib/dispatch/balms-server'

beforeEach(() => {
  queryMock.mockReset()
  clientQuery.mockReset()
  delete process.env.NEXT_PUBLIC_CONVEX_URL
})
afterEach(cleanup)

describe('BalmTile', () => {
  it('renders nothing for undefined', () => {
    const { container } = render(<BalmTile value={undefined} label="L" />)
    expect(container.innerHTML).toBe('')
  })
  it('renders 0 and formatted numbers', () => {
    const { container, rerender } = render(<BalmTile value={0} label="Balms sold" />)
    expect(container.querySelector('.d-count-value')?.textContent).toBe('0')
    expect(container.textContent).toContain('Balms sold')
    rerender(<BalmTile value={1234} label="L" />)
    expect(container.querySelector('.d-count-value')?.textContent).toBe('1,234')
  })
  it('renders impact meter', () => {
    const { container } = render(<BalmTile value={7} label="L" impact={{ min: 14, max: 21, unit: 'wheelchair' }} />)
    expect(container.textContent).toContain('Progress toward the next wheelchair')
    const m = container.querySelector('[role="meter"]')!
    expect(m.getAttribute('aria-valuenow')).toBe('50')
    expect(m.getAttribute('aria-valuemin')).toBe('0')
    expect(m.getAttribute('aria-valuemax')).toBe('100')
  })
  it('no meter without impact', () => {
    const { container } = render(<BalmTile value={7} label="L" />)
    expect(container.querySelector('[role="meter"]')).toBeNull()
  })
})

describe('BalmCounter', () => {
  it('skips useQuery without Convex URL', () => {
    const { container } = render(<BalmCounter charitySlug="c" initial={3} label="L" />)
    expect(queryMock).not.toHaveBeenCalled()
    expect(container.querySelector('.d-count-value')?.textContent).toBe('3')
  })
  it('uses initial then live', () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://x.convex.cloud'
    queryMock.mockReturnValue(undefined)
    const { container, rerender } = render(<BalmCounter charitySlug="c" initial={3} label="L" />)
    expect(container.querySelector('.d-count-value')?.textContent).toBe('3')
    queryMock.mockReturnValue({ balms: 9 })
    rerender(<BalmCounter charitySlug="c" initial={3} label="L" />)
    expect(container.querySelector('.d-count-value')?.textContent).toBe('9')
  })
})

describe('fetchBalms', () => {
  it('undefined when URL unset', async () => {
    expect(await fetchBalms('c')).toBeUndefined()
  })
  it('undefined on throw, balms otherwise, sinceMs only when defined', async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://x.convex.cloud'
    clientQuery.mockRejectedValueOnce(new Error('x'))
    expect(await fetchBalms('c')).toBeUndefined()
    clientQuery.mockResolvedValue({ balms: 5 })
    expect(await fetchBalms('c')).toBe(5)
    expect(clientQuery.mock.calls[1]?.[1]).toEqual({ charitySlug: 'c' })
    await fetchBalms('c', 100)
    expect(clientQuery.mock.calls[2]?.[1]).toEqual({ charitySlug: 'c', sinceMs: 100 })
  })
})
