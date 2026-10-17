import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { NewsletterForm } from '@/components/dispatch/NewsletterForm'
import { DispatchFooter } from '@/components/dispatch/DispatchFooter'
import {
  COPYRIGHT_HOLDER,
  FOOTER_BLURB,
  NEWSLETTER_ERROR,
  NEWSLETTER_LABEL,
  NEWSLETTER_SENDING,
  NEWSLETTER_SUCCESS,
} from '@/lib/dispatch/copy'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NewsletterForm', () => {
  it('has labelled email, honeypot', () => {
    const { container } = render(<NewsletterForm />)
    const input = screen.getByLabelText(NEWSLETTER_LABEL) as HTMLInputElement
    expect(input.type).toBe('email')
    expect(input.required).toBe(true)
    const hp = container.querySelector('input[name="company"]') as HTMLInputElement
    expect(hp.tabIndex).toBe(-1)
    expect(hp.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('posts and shows success', async () => {
    let resolve!: (v: unknown) => void
    const fetchMock = vi.fn(() => new Promise((r) => (resolve = r)))
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<NewsletterForm />)
    const input = screen.getByLabelText(NEWSLETTER_LABEL) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a@b.co' } })
    fireEvent.submit(container.querySelector('form')!)
    const btn = container.querySelector('button')!
    await waitFor(() => expect(btn.textContent).toBe(NEWSLETTER_SENDING))
    expect(btn.disabled).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/email/subscribe')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.co', company: '' })
    resolve({ ok: true, json: async () => ({ ok: true }) })
    await waitFor(() => expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(NEWSLETTER_SUCCESS))
    expect(input.value).toBe('')
  })

  it('shows error on non-ok and on throw, re-enabling button', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false }) }))
    const { container } = render(<NewsletterForm />)
    fireEvent.change(screen.getByLabelText(NEWSLETTER_LABEL), { target: { value: 'a@b.co' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(NEWSLETTER_ERROR))
    expect(container.querySelector('button')!.disabled).toBe(false)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(NEWSLETTER_ERROR))
  })
})

describe('DispatchFooter', () => {
  it('is a contentinfo footer with legal links', () => {
    const { container } = render(<DispatchFooter />)
    const f = container.querySelector('footer#about')!
    expect(f.className).toContain('dispatch')
    expect(f.querySelector('h1')).toBeNull()
    expect(f.textContent).toContain(FOOTER_BLURB)
    expect(f.textContent).toContain(`© ${new Date().getUTCFullYear()} ${COPYRIGHT_HOLDER}`)
    for (const href of ['/legal/privacy', '/legal/terms'])
      expect(f.querySelector(`a[href="${href}"]`)?.className).toContain('d-tap')
  })
})
