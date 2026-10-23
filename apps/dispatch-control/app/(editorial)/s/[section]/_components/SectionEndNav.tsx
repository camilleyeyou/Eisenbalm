'use client'
/**
 * Phase 56 -- Previous / All nine parts / Next at the end of a part.
 */
import Link from 'next/link'

export interface NavTarget {
  href: string
  /** 1-based part number */
  index: number
  label: string
}

interface SectionEndNavProps {
  prev: NavTarget | null
  next: NavTarget | null
  allHref: string
}

const BLOCK =
  'flex flex-col justify-center min-h-[56px] px-5 py-2 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] editor-focus'

export default function SectionEndNav({ prev, next, allHref }: SectionEndNavProps) {
  return (
    <nav
      aria-label="Other parts"
      className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      {prev ? (
        <Link href={prev.href} className={`${BLOCK} order-1 sm:order-1`}>
          <span className="text-[17px] font-semibold">Previous · Part {prev.index}</span>
          <span className="text-[15px] text-[color:var(--color-ink-soft)]">{prev.label}</span>
        </Link>
      ) : (
        <span className="hidden sm:order-1 sm:block" aria-hidden="true" />
      )}
      <Link
        href={allHref}
        className="order-3 sm:order-2 inline-flex min-h-[56px] items-center justify-center text-[17px] font-semibold underline editor-focus"
      >
        All nine parts
      </Link>
      {next ? (
        <Link href={next.href} className={`${BLOCK} order-2 sm:order-3 sm:text-right`}>
          <span className="text-[17px] font-semibold">Next · Part {next.index}</span>
          <span className="text-[15px] text-[color:var(--color-ink-soft)]">{next.label}</span>
        </Link>
      ) : (
        <span className="hidden sm:order-3 sm:block" aria-hidden="true" />
      )}
    </nav>
  )
}
