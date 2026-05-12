/**
 * SiteFooter — wordmark, copyright, legal links. UI-SPEC §17.
 * Single row desktop; stacked mobile.
 * data-site-footer attribute used by print stylesheet selector.
 */
import Link from 'next/link'

export function SiteFooter() {
  const year = new Date().getUTCFullYear()
  return (
    <footer
      data-site-footer
      className="mt-auto border-t border-[color:var(--color-border)] font-ui text-[14px] text-[color:var(--color-text-muted)]"
      aria-label="Site footer"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-4 md:px-6 lg:px-8 py-8 md:flex-row md:justify-between">
        <span>The Eisenbalm Dispatch</span>
        <span className="text-center">
          © {year} Jesse A. Eisenbalm. All proceeds go to the featured charity.
        </span>
        <nav aria-label="Legal" className="flex gap-4">
          <Link href="/legal/privacy" className="hover:text-[color:var(--color-text)]">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-[color:var(--color-text)]">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  )
}
