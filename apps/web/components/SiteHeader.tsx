/**
 * SiteHeader — wordmark + nav. UI-SPEC §16.
 * Renders on every page. Not sticky (UI-SPEC: editorial content is primary).
 * data-site-header attribute used by print stylesheet selector.
 */
import Link from 'next/link'

const NAV = [
  { href: '/archive', label: 'Archive' },
  { href: '/charities', label: 'Charities' },
  { href: '/about', label: 'About' },
  { href: '/shop', label: 'Shop' },
] as const

export function SiteHeader() {
  return (
    <header
      data-site-header
      className="border-b border-[color:var(--color-border)] font-ui"
      aria-label="Site navigation"
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 md:px-6 lg:px-8 py-6">
        <Link
          href="/"
          className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text)]"
        >
          The Eisenbalm Dispatch
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-6">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-[14px] text-[color:var(--color-text)] hover:text-[color:var(--color-accent)] underline-offset-4"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
