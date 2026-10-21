'use client'
/**
 * Phase 51 (READ-07/READ-08, D-15/D-16/D-17) — the end-of-prose prev/next
 * nav. Renders once, after the last paragraph — never in the header, never
 * duplicated (D-15).
 *
 * Quick 261021-ind: the derived per-section "needs you" tally is
 * removed — the agents fix every finding and nothing blocks Publish, so the
 * tally only told readers there was work that does not exist.
 */
import Link from 'next/link'
import { EDITABLE_SECTIONS } from '@/lib/editableSections'

interface SectionEndNavProps {
  sectionId: string
}

const NAV_LINK_CLASSES =
  'inline-flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1'

export default function SectionEndNav({ sectionId }: SectionEndNavProps) {
  const i = EDITABLE_SECTIONS.findIndex((s) => s.id === sectionId)
  const prev = i > 0 ? EDITABLE_SECTIONS[i - 1] : null
  const next = i >= 0 && i < EDITABLE_SECTIONS.length - 1 ? EDITABLE_SECTIONS[i + 1] : null

  return (
    <div style={{ marginTop: 32 }} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        {prev && (
          <Link href={`/s/${prev.id}`} className={NAV_LINK_CLASSES}>
            ← {prev.label}
          </Link>
        )}
        {next && (
          <Link href={`/s/${next.id}`} className={`${NAV_LINK_CLASSES} ml-auto`}>
            {next.label} →
          </Link>
        )}
      </div>
    </div>
  )
}
