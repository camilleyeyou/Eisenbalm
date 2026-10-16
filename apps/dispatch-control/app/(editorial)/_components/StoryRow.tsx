'use client'
/**
 * Phase 52 (HOME-04) — one story row of the front door, a real link.
 * Canvas: https://claude.ai/artifact/KSPqMJof6iYHnAr9NP3SbZ
 * The note text always comes from rowNote() so the row cannot disagree with
 * the selector. Pure props: no data hooks.
 */
import Link from 'next/link'
import { rowNote, type HomeSectionRow } from '@/lib/homeSections'

export function StoryRow({ row, divided = false }: { row: HomeSectionRow; divided?: boolean }) {
  const note = rowNote(row)
  return (
    <li className={divided ? 'border-t border-[color:var(--color-nav)]' : undefined}>
      <Link
        href={row.href}
        className="flex min-h-[64px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-[color:var(--color-paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-cobalt)]"
      >
        <span className="w-[120px] shrink-0 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
          {row.label}
        </span>
        <span className="min-w-[200px] flex-1 font-[family-name:var(--font-display)] text-[21px] leading-snug text-[color:var(--color-ink)]">
          {row.headline}
        </span>
        {row.state === 'fix' ? (
          <span className="bg-[#c43a14] px-2 py-1 font-[family-name:var(--font-ui)] text-[13px] font-medium text-white">
            {note}
          </span>
        ) : row.state === 'clean' ? (
          <span className="font-[family-name:var(--font-ui)] text-[13px] text-[#11764a]">{note}</span>
        ) : (
          <span className="font-[family-name:var(--font-ui)] text-[13px] italic text-[color:var(--color-ink-soft)]">
            {note}
          </span>
        )}
      </Link>
    </li>
  )
}
