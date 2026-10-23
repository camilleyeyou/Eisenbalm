'use client'
/**
 * Phase 56 — the front door body (Main / Home-Writing / Home-Published).
 * Pure props only: no Convex, Clerk, fetch or router. IssueHome wires data.
 * Order: next-step slab, issue header, four stations, nine parts, footer.
 */
import type { ReactNode } from 'react'
import NextStepSlab from '@/components/editor/NextStepSlab'
import Stations from '@/components/editor/Stations'
import PartsList from '@/components/editor/PartsList'
import { SkeletonLine } from '@/components/ui/Skeleton'
import type { HomeSectionRow } from '@/lib/homeSections'
import { COPY, partsHint, type EditorHomeVM, type SlabCopy } from '@/lib/editorState'

export interface IssueHomeLinks {
  preview: string | null
  website: string | null
  whatHappened: string | null
}

export interface IssueHomeViewProps {
  vm: EditorHomeVM
  slab: SlabCopy
  issueLine: string
  /** undefined = still loading */
  charityName: string | null | undefined
  blurb: string | null | undefined
  rows: HomeSectionRow[] | undefined
  hrefFor: (row: HomeSectionRow) => string
  onPrimary: () => void
  primaryBusy: boolean
  actionError: string | null
  links: IssueHomeLinks
  footer: ReactNode | null
  draftError: string | null
  onReload: () => void
  live: string | null
}

export function IssueHomeView(props: IssueHomeViewProps) {
  const { vm, slab, links } = props
  const loading = vm.state === 'loading'
  const empty = vm.state === 'empty'

  let link: { label: string; href: string; external?: boolean } | undefined
  if (slab.link && slab.linkLabel) {
    const href =
      slab.link === 'preview' ? links.preview : slab.link === 'website' ? links.website : links.whatHappened
    if (href) link = { label: slab.linkLabel, href, external: slab.link === 'website' }
  }

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      {loading ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <SkeletonLine className="h-8 w-2/3" />
          <SkeletonLine className="w-1/2" />
          <SkeletonLine className="w-1/3" />
        </div>
      ) : (
        <NextStepSlab
          sentence={slab.sentence}
          explanation={slab.explanation}
          primary={
            slab.action && slab.actionLabel
              ? { label: slab.actionLabel, onClick: props.onPrimary, busy: props.primaryBusy }
              : undefined
          }
          working={slab.working}
          link={link}
          error={props.actionError}
          live={props.live ?? undefined}
        />
      )}

      {empty ? <h1 className="sr-only">{COPY.thisWeeksIssue}</h1> : null}

      {!loading && !empty ? (
        <header>
          <p className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">
            {props.issueLine}
          </p>
          {props.charityName === undefined ? (
            <div aria-busy="true" className="mt-3 flex flex-col gap-3">
              <SkeletonLine className="h-10 w-2/3" />
              <SkeletonLine className="w-1/2" />
            </div>
          ) : (
            <>
              <h1
                className="mt-2 font-[family-name:var(--font-display)] text-[32px] leading-[1.1] sm:text-[48px] sm:leading-[1.04] font-semibold text-[color:var(--color-ink)]"
                style={{ letterSpacing: '-0.01em' }}
              >
                {props.charityName ?? 'Charity not chosen yet'}
              </h1>
              {props.blurb ? (
                <p className="mt-3 max-w-[760px] font-[family-name:var(--font-body)] text-[17px] sm:text-[18px] leading-[1.5] text-[color:var(--color-ink-soft)]">
                  {props.blurb}
                </p>
              ) : null}
            </>
          )}
        </header>
      ) : null}

      {!loading && !empty ? <Stations stations={vm.stations} /> : null}

      {!loading && !empty ? (
        props.draftError ? (
          <div role="alert" className="flex flex-col items-start gap-4">
            <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.5] text-[color:var(--color-ink)]">
              {COPY.loadFailed}
            </p>
            <button
              type="button"
              onClick={props.onReload}
              className="min-h-[48px] px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] font-[family-name:var(--font-ui)] text-[17px] font-semibold editor-focus"
            >
              {COPY.reloadButton}
            </button>
          </div>
        ) : props.rows === undefined ? (
          <div aria-busy="true" className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-card)]">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="min-h-[64px] px-6 py-5">
                <SkeletonLine className="w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <PartsList
            rows={props.rows}
            published={vm.state === 'published'}
            hint={partsHint(vm.state)}
            hrefFor={props.hrefFor}
          />
        )
      ) : null}

      {props.footer}
    </div>
  )
}
