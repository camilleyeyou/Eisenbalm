'use client'

import './top.css'
import { useEffect, useState } from 'react'
import { FUND_CTA, SECTION_META, bonusLabel, type BonusKind, type SectionId } from '@/lib/dispatch/copy'

export function IssueNav({
  charityName,
  bonusType,
  omit = [],
}: {
  charityName: string
  bonusType: BonusKind
  /** Section ids that do not render on this page; their nav links are dropped (no dangling anchors). */
  omit?: SectionId[]
}) {
  const sections = SECTION_META.filter((s) => !omit.includes(s.id))
  const [active, setActive] = useState<SectionId | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const visible = new Set<SectionId>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id as SectionId
          if (e.isIntersecting) visible.add(id)
          else visible.delete(id)
        }
        const first = SECTION_META.find((s) => visible.has(s.id))
        if (first) setActive(first.id)
      },
      { rootMargin: '-64px 0px -60% 0px', threshold: 0 },
    )
    for (const s of SECTION_META) {
      const el = document.getElementById(s.id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [])

  return (
    <nav aria-label="In this issue" className="d-issuenav">
      <div className="d-container d-issuenav-row">
        <p className="d-label d-issuenav-name">{charityName}</p>
        <ul className="d-issuenav-links">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="d-tap d-label d-issuenav-link"
                aria-current={active === s.id ? 'true' : undefined}
              >
                <span className={`d-dot d-dot--${s.dot}`} aria-hidden="true" />
                {s.id === 'bonus' ? bonusLabel(bonusType) : s.navLabel}
              </a>
            </li>
          ))}
        </ul>
        <a href="#buy" className="d-pill d-pill--accent d-pill--compact d-issuenav-fund">
          {FUND_CTA}
        </a>
      </div>
    </nav>
  )
}
