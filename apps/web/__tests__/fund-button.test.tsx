import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('convex/react', () => ({ useQuery: vi.fn() }))
vi.mock('@convex/_generated/api', () => ({ api: { stripeOrders: { balmsForCharity: 'balmsForCharity' } } }))

import { FundButton } from '@/components/dispatch/FundButton'
import { BuyBand } from '@/components/dispatch/BuyBand'
import { startCheckout, CHECKOUT_FAILURE_MESSAGE } from '@/lib/checkout-client'
import { fundButtonLabel } from '@/lib/dispatch/copy'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  delete process.env.NEXT_PUBLIC_CONVEX_URL
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('startCheckout', () => {
  it('POSTs quantity 1 and redirects on url', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ url: 'https://stripe.test/x' }) })
    const loc = { href: '' }
    vi.stubGlobal('location', loc)
    expect(await startCheckout(1)).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('/api/checkout/create-session')
    expect(init.body).toBe('{"quantity":1}')
    expect(loc.href).toBe('https://stripe.test/x')
  })
  it('resolves ok:false on missing url and on rejection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce({ json: async () => ({ error: 'x' }) })
    expect(await startCheckout(1)).toEqual({ ok: false })
    fetchMock.mockRejectedValueOnce(new Error('net'))
    expect(await startCheckout(1)).toEqual({ ok: false })
  })
})

describe('FundButton', () => {
  it('is a link to /shop, not a checkout button', () => {
    render(<FundButton label="Fund them" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/shop')
    expect(link.textContent).toBe('Fund them')
    expect(link.classList.contains('d-fund-btn')).toBe(true)
    expect(screen.queryByRole('button')).toBeNull()
    fireEvent.click(link)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('BuyBand', () => {
  it('renders the #buy band', () => {
    const { container } = render(
      <BuyBand charityName="Test Charity" charitySlug="test" countLabel="Balms sold" initialBalms={undefined} impact={null} />,
    )
    const sec = container.querySelector('section#buy')!
    expect(sec.hasAttribute('data-shop-callout')).toBe(true)
    expect(container.querySelectorAll('h2').length).toBe(1)
    const fund = container.querySelector('a.d-fund-btn')!
    expect(fund.textContent).toBe(fundButtonLabel('Test Charity'))
    expect(fund.getAttribute('href')).toBe('/shop')
    expect(container.querySelector('a[href="/shop"]')).not.toBeNull()
    expect(container.querySelector('.d-count')).toBeNull()
  })
})
