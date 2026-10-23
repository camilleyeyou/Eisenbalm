'use client'
/**
 * Phase 56-07 — pure Past issues view. Props only; no Convex.
 * Listed rows open that issue's Home view; stopped/unfinished issues sit in a
 * collapsed section at the bottom with a plain reason.
 */
import { useState } from 'react'
import Link from 'next/link'
import DocumentTitle from '@/components/ui/DocumentTitle'
import { SkeletonLine } from '@/components/ui/Skeleton'
import NextStepSlab from '@/components/editor/NextStepSlab'
import StatusWord from '@/components/editor/StatusWord'
import { COPY, type ArchiveRowVM } from '@/lib/editorState'
import { adminRunHref, issueOpenHref } from '@/lib/issueRouteResolver'

export interface ArchiveBodyProps {
  rows: { listed: ArchiveRowVM[]; unfinished: ArchiveRowVM[] } | undefined
  currentRunId: string | null
  /** Turns a row's relative published path into a full public URL (or null). */
  websiteUrlFor: (publishedUrl: string | null | undefined) => string | null
}

function matches(row: ArchiveRowVM, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  if (row.title.toLowerCase().includes(q)) return true
  const digits = q.replace(/\D/g, '')
  return digits !== '' && String(row.issueNumber) === digits
}

const LINK_CLS =
  'min-h-[48px] inline-flex items-center font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-cobalt)] underline editor-focus'

export function ArchiveBody({ rows, currentRunId, websiteUrlFor }: ArchiveBodyProps) {
  const [query, setQuery] = useState('')

  const listed = rows ? rows.listed.filter((r) => matches(r, query)) : []
  const unfinished = rows ? rows.unfinished.filter((r) => matches(r, query)) : []
  const waiting = rows?.listed.find((r) => r.current && r.word === 'Waiting for you')
  const slabSentence = waiting
    ? COPY.archiveSlabWaiting.replace('{N}', String(waiting.issueNumber))
    : COPY.archiveSlab
  const none = rows !== undefined && rows.listed.length === 0 && rows.unfinished.length === 0
  const noMatch = rows !== undefined && !none && listed.length === 0 && unfinished.length === 0

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-6 sm:px-6">
      <DocumentTitle title="Past issues" />
      <NextStepSlab sentence={slabSentence} ghost={{ label: COPY.thisWeeksIssue, href: '/' }} />

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-[32px] sm:text-[42px] font-semibold leading-[1.1]">
          Past issues
        </h1>
        <p className="mt-2 font-[family-name:var(--font-body)] text-[17px] text-[color:var(--color-ink-soft)]">
          Every issue so far, newest first.
        </p>
        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="archive-search" className="font-[family-name:var(--font-ui)] text-[15px] font-semibold">
            Find an issue
          </label>
          <input
            id="archive-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Charity name or issue number"
            className="min-h-[48px] w-full sm:w-[360px] border border-[color:var(--color-ink)] bg-[color:var(--color-card)] px-4 font-[family-name:var(--font-ui)] text-[17px] focus:outline-[3px] focus:outline-[color:var(--color-cobalt)]"
          />
        </div>
      </div>

      {rows === undefined && (
        <div className="flex flex-col gap-4" aria-busy="true">
          <SkeletonLine />
          <SkeletonLine />
          <SkeletonLine />
          <SkeletonLine />
        </div>
      )}

      {none && (
        <p className="font-[family-name:var(--font-body)] text-[17px] text-[color:var(--color-ink-soft)]">
          {COPY.emptyArchive}
        </p>
      )}
      {noMatch && (
        <p className="font-[family-name:var(--font-body)] text-[17px] text-[color:var(--color-ink-soft)]">
          {COPY.emptySearch.replace('{query}', query.trim())}
        </p>
      )}

      {listed.length > 0 && (
        <ol className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-card)] divide-y divide-[color:var(--color-line)]">
          {listed.map((row) => {
            const site = row.word === 'Done' ? websiteUrlFor(row.publishedUrl) : null
            return (
              <li
                key={row.runId}
                className={`min-h-[64px] px-4 sm:px-6 py-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6 ${
                  row.current ? 'bg-[color:var(--color-current)]' : ''
                }`}
              >
                <span className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)] sm:w-[200px] sm:shrink-0">
                  {row.dateLine}
                </span>
                <Link
                  href={issueOpenHref(row.runId, currentRunId)}
                  className="min-h-[48px] inline-flex items-center sm:flex-1 font-[family-name:var(--font-display)] text-[23px] font-medium text-[color:var(--color-ink)] underline editor-focus"
                >
                  {row.title}
                </Link>
                <StatusWord word={row.word} text={row.statusText} />
                {site && (
                  <a href={site} target="_blank" rel="noopener noreferrer" className={LINK_CLS}>
                    Read on the website
                  </a>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {unfinished.length > 0 && (
        <details className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-card)]">
          <summary className="min-h-[48px] w-full cursor-pointer px-4 sm:px-6 py-3 font-[family-name:var(--font-ui)] text-[17px] font-semibold editor-focus">
            Stopped or unfinished issues ({unfinished.length})
          </summary>
          <ul className="divide-y divide-[color:var(--color-line)] border-t border-[color:var(--color-line)]">
            {unfinished.map((row) => (
              <li key={row.runId} className="px-4 sm:px-6 py-4 flex flex-col gap-1">
                <span className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">
                  {row.dateLine} · {row.title}
                </span>
                {row.reason && (
                  <span className="font-[family-name:var(--font-body)] text-[18px] italic">{row.reason}</span>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <StatusWord word={row.word} text={row.statusText} />
                  {row.word === 'Problem' && (
                    <Link href={adminRunHref(row.runId)} className={LINK_CLS}>
                      What happened
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
