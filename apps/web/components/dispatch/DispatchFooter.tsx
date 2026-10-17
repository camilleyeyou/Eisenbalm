import Link from 'next/link'
import './footer.css'
import { NewsletterForm } from './NewsletterForm'
import { COPYRIGHT_HOLDER, FOOTER_BLURB, MASTHEAD_WORDMARK } from '@/lib/dispatch/copy'

export function DispatchFooter() {
  return (
    <footer id="about" className="dispatch d-footer">
      <div className="d-container d-footer-grid">
        <div className="d-footer-brand">
          <p className="d-heading">{MASTHEAD_WORDMARK}</p>
          <p className="d-body d-muted">{FOOTER_BLURB}</p>
        </div>
        <NewsletterForm />
      </div>
      <div className="d-container">
        <p className="d-label d-muted d-footer-legal">
          © {new Date().getUTCFullYear()} {COPYRIGHT_HOLDER} ·{' '}
          <Link href="/legal/privacy" className="d-tap d-link">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link href="/legal/terms" className="d-tap d-link">
            Terms
          </Link>
        </p>
      </div>
    </footer>
  )
}
