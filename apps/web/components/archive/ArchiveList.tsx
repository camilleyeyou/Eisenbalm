'use client'

import { useMemo, useState } from 'react'
import type { ArchiveIssue } from '@/lib/sanity/types'
import { ArchiveItem } from './ArchiveItem'

type SortOrder = 'newest' | 'oldest'

export function ArchiveList({ issues }: { issues: ArchiveIssue[] }) {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<SortOrder>('newest')

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

  return (
    <div>
      <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by charity or focus area"
          aria-label="Search the archive"
          className="h-11 w-full rounded border border-[color:var(--color-border)] bg-transparent px-3 font-ui text-[14px] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] focus-visible:outline-offset-2 md:w-80"
        />
        <div className="flex gap-4 font-ui text-[14px]">
          <button
            type="button"
            onClick={() => setOrder('newest')}
            className={
              order === 'newest'
                ? 'inline-flex items-center min-h-11 underline underline-offset-4 text-[color:var(--color-text)]'
                : 'inline-flex items-center min-h-11 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
            }
          >
            Newest first
          </button>
          <button
            type="button"
            onClick={() => setOrder('oldest')}
            className={
              order === 'oldest'
                ? 'inline-flex items-center min-h-11 underline underline-offset-4 text-[color:var(--color-text)]'
                : 'inline-flex items-center min-h-11 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
            }
          >
            Oldest first
          </button>
        </div>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="mt-6 font-ui text-[14px] text-[color:var(--color-text-muted)]"
      >
        Showing {filtered.length} {filtered.length === 1 ? 'issue' : 'issues'}
      </p>
      {filtered.length === 0 ? (
        <p className="mt-8 text-center font-ui text-[14px] text-[color:var(--color-text-muted)]">
          No issues match that search.
        </p>
      ) : (
        <ul className="mt-4">
          {filtered.map((issue) => (
            <ArchiveItem key={issue.slug} issue={issue} />
          ))}
        </ul>
      )}
    </div>
  )
}
