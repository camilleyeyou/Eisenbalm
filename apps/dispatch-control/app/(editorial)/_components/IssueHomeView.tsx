'use client'
/**
 * Phase 52 (HOME-01, HOME-04, HOME-06..09) — the front door body.
 * Canvas: https://claude.ai/artifact/KSPqMJof6iYHnAr9NP3SbZ (boards: Something
 * needs you / Ready to publish / Agents still writing).
 *
 * Pure props only (the RunBody/RunScreen seam): no Convex, Clerk, fetch or
 * inspector hooks. Plan 52-04 wires data in. Hard edges, flat.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { SkeletonLine } from '@/components/ui/Skeleton'
import type { HomeFooter, HomeSectionsResult } from '@/lib/homeSections'
import type { PublishGate } from '@/lib/publishChain'
import { PublishFooter } from './PublishFooter'
import { StoryRow } from './StoryRow'

export interface IssueHomeLinks {
  admin: string
  pastIssues: string
  runDetails: string | null
  liveIssue: string | null
  preview: string | null
}

export interface IssueHomeViewProps {
  issueNumber: number | null
  title: string | null | undefined
  subject: string | null | undefined
  sections: HomeSectionsResult | undefined
  footer: HomeFooter
  gate: PublishGate
  draftError: string | null
  publishing: boolean
  publishError: string | null
  publishNotice: string | null
  confirming: boolean
  onRequestPublish: () => void
  onConfirmPublish: () => void
  onCancelPublish: () => void
  links: IssueHomeLinks
  /** Start issue + Hold/Release, rendered directly under the publish footer. */
  controls?: ReactNode
  /** Stop control, shown in the Gate-1 (paused) footer state. */
  stopSlot?: ReactNode
}

export function formatPublishedDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const NAV_LINK =
  'inline-flex min-h-[44px] items-center px-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] underline-offset-4 hover:underline'

export function IssueHomeView(props: IssueHomeViewProps) {
  const { issueNumber, title, subject, sections, footer, draftError, links } = props
  const showStory = footer.kind !== 'none'
  const titleLoading = title === undefined || subject === undefined
  const noCharity = title === null || subject === null

  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      <main className="mx-auto w-full max-w-[880px] px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3 pb-8">
          <span className="font-[family-name:var(--font-display)] text-[22px] text-[color:var(--color-ink)]">
            The Eisenbalm Dispatch
          </span>
          <nav aria-label="Site" className="flex items-center gap-2">
            <Link href={links.pastIssues} className={NAV_LINK}>
              Past issues
            </Link>
            <Link href={links.admin} className={NAV_LINK}>
              Admin
            </Link>
          </nav>
        </header>

        {showStory ? (
          <>
            {titleLoading ? (
              <div aria-busy="true" className="flex flex-col gap-3">
                <SkeletonLine className="w-24" />
                <SkeletonLine className="h-10 w-2/3" />
                <SkeletonLine className="w-1/2" />
              </div>
            ) : (
              <div>
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[color:var(--color-ink-soft)]">
                  Issue {issueNumber}
                </p>
                <h1 className="mt-2 font-[family-name:var(--font-display)] text-[40px] leading-[1.05] text-[color:var(--color-ink)] sm:text-[52px]">
                  {title ?? `Issue ${issueNumber}`}
                </h1>
                <p className="mt-3 font-[family-name:var(--font-body)] text-[18px] text-[color:var(--color-ink-soft)]">
                  {noCharity ? 'The agents haven’t chosen this issue’s charity yet.' : subject}
                </p>
              </div>
            )}

            <h2 className="mb-3 mt-10 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[color:var(--color-ink-soft)]">
              In this issue
            </h2>
            {draftError ? (
              <p
                role="alert"
                className="border border-[color:var(--color-faint)] bg-white p-5 font-[family-name:var(--font-ui)] text-[14px] text-[#c43a14]"
              >
                Couldn’t load this issue’s stories: {draftError}
              </p>
            ) : sections === undefined ? (
              <div aria-busy="true" className="border border-[color:var(--color-faint)] bg-white">
                {Array.from({ length: 9 }, (_, i) => (
                  <div
                    key={i}
                    className={`min-h-[64px] px-5 py-4 ${i > 0 ? 'border-t border-[color:var(--color-nav)]' : ''}`}
                  >
                    <SkeletonLine className="w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <ol aria-label="Stories in this issue" className="border border-[color:var(--color-faint)] bg-white">
                {sections.rows.map((row, i) => (
                  <StoryRow key={row.id} row={row} divided={i > 0} />
                ))}
              </ol>
            )}
          </>
        ) : null}

        <div className="mt-6">
          <PublishFooter
            issueNumber={issueNumber}
            footer={footer}
            gate={props.gate}
            publishing={props.publishing}
            publishError={props.publishError}
            publishNotice={props.publishNotice}
            confirming={props.confirming}
            onRequestPublish={props.onRequestPublish}
            onConfirmPublish={props.onConfirmPublish}
            onCancelPublish={props.onCancelPublish}
            links={links}
            stopSlot={props.stopSlot}
          />
          {props.controls}
        </div>
      </main>
    </div>
  )
}
