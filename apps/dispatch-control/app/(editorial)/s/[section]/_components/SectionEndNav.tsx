'use client'
/**
 * Phase 51 (READ-07/READ-08, D-15/D-16/D-17) — the end-of-prose prev/next
 * nav plus the derived "still need you" count. Renders once, after the last
 * paragraph (and after the Clean-state "No open findings" line, when
 * applicable) — never in the header, never duplicated (D-15).
 *
 * `deriveSectionStates` is the ONE shared selector (`lib/derivedState.ts`,
 * D-17) — the same one Review Desk's chip counts and Phase 52's future
 * table of contents read. No second tally is computed here.
 */
import Link from 'next/link'
import { EDITABLE_SECTIONS } from '@/lib/editableSections'
import { deriveSectionStates, type DerivationInputs } from '@/lib/derivedState'

interface SectionEndNavProps {
  sectionId: string
  derivationInputs: DerivationInputs
  /** Already computed once by the page (`draftSectionIdsFromDraft`) — passed
   * in rather than recomputed here, so this file's only derived-state call
   * is `deriveSectionStates` itself. */
  draftSectionIds: ReadonlySet<string>
}

const NAV_LINK_CLASSES =
  'inline-flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1'

export default function SectionEndNav({ sectionId, derivationInputs, draftSectionIds }: SectionEndNavProps) {
  const i = EDITABLE_SECTIONS.findIndex((s) => s.id === sectionId)
  const prev = i > 0 ? EDITABLE_SECTIONS[i - 1] : null
  const next = i >= 0 && i < EDITABLE_SECTIONS.length - 1 ? EDITABLE_SECTIONS[i + 1] : null

  const states = deriveSectionStates(derivationInputs, draftSectionIds)
  const needCount = Object.values(states).filter((s) => s.openCount > 0).length

  return (
    <div style={{ marginTop: 32 }} className="flex flex-col gap-4">
      <p className="galley-body">
        {needCount > 0
          ? `${needCount} of ${EDITABLE_SECTIONS.length} sections still need you.`
          : `All ${EDITABLE_SECTIONS.length} sections are clean — nothing needs you.`}
      </p>
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
