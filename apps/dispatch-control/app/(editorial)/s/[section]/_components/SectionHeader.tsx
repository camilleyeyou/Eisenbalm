'use client'
/**
 * Phase 56 -- the Section page heading: breadcrumb row, title and subtitle.
 */
import Link from 'next/link'

interface SectionHeaderProps {
  /** e.g. 'Issue 48 · Kumasi Roofless Schools Trust' */
  issueLabel: string
  issueHref: string
  /** 1-based */
  partIndex: number
  partLabel: string
  title: string
  subtitle?: string | null
}

export default function SectionHeader({
  issueLabel,
  issueHref,
  partIndex,
  partLabel,
  title,
  subtitle,
}: SectionHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between gap-2 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">
        <Link href={issueHref} className="hover:text-[color:var(--color-cobalt)] editor-focus">
          {issueLabel}
        </Link>
        <span>
          Part {partIndex} of 9 · {partLabel}
        </span>
      </div>
      <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] font-semibold">
        {title}
      </h1>
      {subtitle ? (
        <p className="max-w-[720px] font-[family-name:var(--font-lora)] italic text-[18px] sm:text-[23px] leading-[1.4] text-[color:var(--color-ink-soft)]">
          {subtitle}
        </p>
      ) : null}
    </header>
  )
}
