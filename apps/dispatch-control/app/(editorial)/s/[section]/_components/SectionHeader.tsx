'use client'
/**
 * Phase 51 (D-05) — the slim "back to issue" header. One line only: the
 * issue's real derived title, rendered as a plain link — normal case, no
 * tracking (a real magazine title reads wrong in tracked caps). Not sticky
 * (it scrolls away with the page); the section-reader page places 32px
 * (token xl) between it and the prose.
 *
 * Link target is `/` (locked by 51-UI-SPEC.md's Slim Header Link Target
 * section) — today that redirects into the console's default screen, and
 * the moment a later phase claims `/` for the new editorial front door this
 * link starts resolving correctly with zero code change here. Never a
 * deeper operational route.
 *
 * The leading arrow glyph is a CSS-only `::before` decoration (see
 * `.section-reader-back-link` in app/globals.css), deliberately never a real
 * DOM text node. `__tests__/SectionReaderPage.test.tsx`'s nav specs assert
 * "no arrow glyph anywhere on the page" on the first section (no Previous
 * control exists yet) and "an arrow glyph exists" on the last section (the
 * Previous control is present) — those specs are about
 * `SectionEndNav.tsx`'s real prev/next text, not this decorative back-link;
 * keeping this glyph out of the DOM text tree is what keeps the two
 * concerns from colliding under a plain text-content query.
 */
import Link from 'next/link'

interface SectionHeaderProps {
  /** `useCurrentRun().title` — `undefined` (still loading) is never passed
   * here, the page gates on it first. `null` is a confirmed no-subject run. */
  title: string | null
}

export default function SectionHeader({ title }: SectionHeaderProps) {
  const label = title === null ? 'Current issue' : title

  return (
    <div style={{ marginBottom: 32 }}>
      <Link
        href="/"
        className="section-reader-back-link"
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 'normal',
          textTransform: 'none',
          color: 'var(--color-cobalt)',
          textDecoration: 'none',
        }}
      >
        {label}
      </Link>
    </div>
  )
}
