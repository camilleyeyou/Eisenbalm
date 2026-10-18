'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ArchiveIssue } from '@/lib/sanity/types'
import { ArchiveItem } from './ArchiveItem'
import '@/components/dispatch/pages.css'

type SortOrder = 'newest' | 'oldest'

// Initial visible count + increment per "Load more" (P17-03; tunable single source of truth).
const PAGE_SIZE = 10

export function ArchiveList({ issues }: { issues: ArchiveIssue[] }) {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<SortOrder>('newest')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched =
      q === ''
        ? issues
        : issues.filter((issue) => {
            const name = issue.charity.name?.toLowerCase() ?? ''
            const focus = issue.charity.focusArea?.toLowerCase() ?? ''
            return name.includes(q) || focus.includes(q)
          })
    return order === 'newest'
      ? [...matched].sort((a, b) => b.issueNumber - a.issueNumber)
      : [...matched].sort((a, b) => a.issueNumber - b.issueNumber)
  }, [issues, query, order])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  // Reset the visible window when the search query or sort order changes (Pitfall 3 —
  // without this, clearing a search can expose a stale smaller window).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, order])

  return (
    <div>
      <div className="d-toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by charity or focus area"
          aria-label="Search the archive"
          className="d-input d-input--wide"
        />
        <div className="d-toolbar-toggles">
          <button
            type="button"
            onClick={() => setOrder('newest')}
            className={`d-pill d-pill--compact ${order === 'newest' ? 'd-pill--ink' : 'd-pill--paper'}`}
          >
            Newest first
          </button>
          <button
            type="button"
            onClick={() => setOrder('oldest')}
            className={`d-pill d-pill--compact ${order === 'oldest' ? 'd-pill--ink' : 'd-pill--paper'}`}
          >
            Oldest first
          </button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="d-label d-muted d-status">
        Showing {visible.length} of {filtered.length} {filtered.length === 1 ? 'issue' : 'issues'}
      </p>
      {filtered.length === 0 ? (
        <p className="d-label d-muted d-empty">
          No issues match that search.
        </p>
      ) : (
        <>
          <ul className="d-rows">
            {visible.map((issue) => (
              <ArchiveItem key={issue.slug} issue={issue} />
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="d-pill d-pill--ink min-h-11 d-loadmore"
            >
              Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
            </button>
          )}
        </>
      )}
    </div>
  )
}
