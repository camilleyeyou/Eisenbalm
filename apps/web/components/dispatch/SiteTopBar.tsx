'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import './top.css'
import './site.css'
import { FUND_CTA, MASTHEAD_WORDMARK, SITE_TOPBAR_LINKS } from '@/lib/dispatch/copy'

const PREFIX_ACTIVE = ['/archive', '/charities', '/about', '/shop']

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname || !PREFIX_ACTIVE.includes(href)) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Dispatch top bar for every route except / and /issue/*. Nothing is hidden at any width. */
export function SiteTopBar() {
  const pathname = usePathname()
  return (
    <header data-site-header className="dispatch d-sitebar">
      <div className="d-container d-sitebar-row">
        <Link href="/" className="d-sitebar-mark">
          <span className="d-dots" aria-hidden="true">
            <span className="d-dot d-dot--green" />
            <span className="d-dot d-dot--blue" />
            <span className="d-dot d-dot--red" />
            <span className="d-dot d-dot--yellow" />
          </span>
          {MASTHEAD_WORDMARK}
        </Link>
        <nav aria-label="Main" className="d-sitebar-nav">
          <ul className="d-topbar-links">
            {SITE_TOPBAR_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="d-tap d-label d-link"
                  aria-current={isActive(pathname, l.href) ? 'page' : undefined}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/shop" className="d-pill d-pill--ink d-pill--compact">{FUND_CTA}</Link>
      </div>
    </header>
  )
}
