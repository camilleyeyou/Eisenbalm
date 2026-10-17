'use client'

import { useState } from 'react'
import './footer.css'
import type { ArchiveIssue } from '@/lib/sanity/types'
import { backIssues, filterIssues, monthYearLabel } from '@/lib/dispatch/derive'
import { toneForIssue } from '@/lib/brand'
import {
  ARCHIVE_EMPTY,
  BACK_ISSUES_HEADING,
  SEARCH_EMPTY,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SEE_ALL,
  searchStatus,
} from '@/lib/dispatch/copy'

export function BackIssues({
  issues,
  currentIssueNumber,
}: {
  issues: ArchiveIssue[]
  currentIssueNumber: number | null
}) {
  const [query, setQuery] = useState('')
  const base = issues.filter((i) => i.issueNumber !== currentIssueNumber)
  const searching = query.trim().length > 0
  const shown = searching ? filterIssues(base, query) : backIssues(issues, currentIssueNumber, 8)

  return (
    <section id="back-issues" aria-labelledby="back-issues-title" className="d-back">
      <div className="d-container">
        <div className="d-back-head">
          <h2 id="back-issues-title" className="d-heading">
            {BACK_ISSUES_HEADING}
          </h2>
          {base.length > 0 && (
            <div className="d-back-search">
              <label htmlFor="d-back-search" className="d-label">
                {SEARCH_LABEL}
              </label>
              <input
                id="d-back-search"
                type="search"
                className="d-input"
                placeholder={SEARCH_PLACEHOLDER}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          <a href="/archive" className="d-tap d-label d-link">
            {SEE_ALL}
          </a>
        </div>
        <p role="status" aria-live="polite" className="d-sr-only">
          {searching ? searchStatus(shown.length) : ''}
        </p>
        {base.length === 0 ? (
          <p className="d-body">{ARCHIVE_EMPTY}</p>
        ) : shown.length === 0 ? (
          <p className="d-body">{SEARCH_EMPTY}</p>
        ) : (
          <ul className="d-back-grid">
            {shown.map((i) => {
              const my = monthYearLabel(i.publishDate)
              return (
                <li key={i.slug}>
                  <a href={`/issue/${i.slug}`} className={`d-backcard d-tone-${toneForIssue(i.issueNumber)}`}>
                    <p className="d-label">{`No. ${i.issueNumber}${my ? ` · ${my}` : ''}`}</p>
                    <p className="d-backcard-title">{i.charity.name}</p>
                    {i.charity.focusArea && <p className="d-body d-backcard-sub">{i.charity.focusArea}</p>}
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
