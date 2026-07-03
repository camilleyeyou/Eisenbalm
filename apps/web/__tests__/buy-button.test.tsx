/**
 * D-9 — BuyButton checkout-failure behavioral test.
 *
 * Phase 29 (D-9) added a dry, on-voice inline message on checkout failure
 * and re-enables the button so the reader can retry (previously the error
 * path only console.error'd, a silent dead-end). This test renders the real
 * component (no source-scan), mocks a rejecting fetch, clicks the button,
 * and asserts:
 *   - the inline failure message renders
 *   - the button re-enables (not stuck on "Redirecting…")
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx → jsdom, apps/web/vitest.config.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

import { BuyButton, CHECKOUT_FAILURE_MESSAGE } from '@/components/marketing/BuyButton'
import { ShopQtyProvider } from '@/components/marketing/ShopQtyProvider'

describe('D-9: BuyButton checkout-failure UX', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the dry inline failure message and re-enables the button when checkout fails', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ error: 'Checkout failed' }),
    })

    render(
      <ShopQtyProvider>
        <BuyButton />
      </ShopQtyProvider>,
    )

    const btn = screen.getByRole('button', { name: /buy the lip balm/i })
    fireEvent.click(btn)

    // Loading state fires synchronously on click.
    expect((btn as HTMLButtonElement).disabled).toBe(true)

    // Wait for the rejected checkout call to resolve and the inline message to render.
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(CHECKOUT_FAILURE_MESSAGE)
    })

    // Button re-enables so the reader can retry.
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    expect(btn.textContent).toBe('Buy the lip balm')
  })

  it('the failure message contains no exclamation mark (dry voice, CLAUDE.md)', () => {
    expect(CHECKOUT_FAILURE_MESSAGE).not.toContain('!')
  })

  it('does not render the failure message before any click', () => {
    render(
      <ShopQtyProvider>
        <BuyButton />
      </ShopQtyProvider>,
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('redirects on a successful checkout response (no failure message)', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ url: 'https://checkout.stripe.com/test-session' }),
    })

    // jsdom does not implement navigation; stub window.location.href assignment
    // via Object.defineProperty so the type stays `Location` (no unsafe cast).
    const original = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...original, href: '' },
    })

    render(
      <ShopQtyProvider>
        <BuyButton />
      </ShopQtyProvider>,
    )

    const btn = screen.getByRole('button', { name: /buy the lip balm/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(window.location.href).toBe('https://checkout.stripe.com/test-session')
    })
    expect(screen.queryByRole('alert')).toBeNull()

    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: original,
    })
  })
})
