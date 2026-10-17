'use client'

import { useState, type FormEvent } from 'react'
import './footer.css'
import {
  NEWSLETTER_BUTTON,
  NEWSLETTER_ERROR,
  NEWSLETTER_LABEL,
  NEWSLETTER_SENDING,
  NEWSLETTER_SUCCESS,
} from '@/lib/dispatch/copy'

type Status = 'idle' | 'sending' | 'success' | 'error'

export function NewsletterForm() {
  const [status, setStatus] = useState<Status>('idle')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') ?? '')
    const company = String(data.get('company') ?? '')
    setStatus('sending')
    try {
      const res = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company }),
      })
      const body = res.ok ? await res.json() : null
      if (body && body.ok === true) {
        setStatus('success')
        form.reset()
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <form className="d-newsletter" onSubmit={onSubmit}>
      <label htmlFor="d-nl-email" className="d-label">
        {NEWSLETTER_LABEL}
      </label>
      <div className="d-newsletter-row">
        <input
          id="d-nl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="d-input d-input--wide"
        />
        <button type="submit" className="d-pill d-pill--ink" disabled={status === 'sending'}>
          {status === 'sending' ? NEWSLETTER_SENDING : NEWSLETTER_BUTTON}
        </button>
      </div>
      <div className="d-hp" aria-hidden="true">
        <label htmlFor="d-nl-company">Company</label>
        <input id="d-nl-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="d-label d-newsletter-status" aria-live="polite">
        {status === 'success' ? NEWSLETTER_SUCCESS : status === 'error' ? NEWSLETTER_ERROR : ''}
      </p>
    </form>
  )
}
