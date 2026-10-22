'use client'
/**
 * Phase 52 (HOME-06, HOME-07, HOME-09) — the footer: one plain sentence and
 * the ONE Publish button, with an inline confirm (never a browser dialog).
 * Canvas: https://claude.ai/artifact/KSPqMJof6iYHnAr9NP3SbZ
 *
 * Quick 261021-7aw: no fix sentences — the footer is ready whenever the run
 * has finished. Pure props: no data hooks.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { LockedControl } from '@/components/LockedControl'
import { SkeletonLine } from '@/components/ui/Skeleton'
import {
  FAILED_SENTENCE,
  GATE1_SENTENCE,
  NONE_SENTENCE,
  STOPPED_SENTENCE,
  READY_SENTENCE,
  RUNNING_SENTENCE,
} from '@/lib/homeSections'
import { COLLABORATOR_LOCK_LABEL, HELD_REASON } from '@/lib/publishChain'
import { formatPublishedDate, type IssueHomeViewProps } from './IssueHomeView'

type Props = Pick<
  IssueHomeViewProps,
  | 'issueNumber'
  | 'footer'
  | 'gate'
  | 'publishing'
  | 'publishError'
  | 'publishNotice'
  | 'confirming'
  | 'onRequestPublish'
  | 'onConfirmPublish'
  | 'onCancelPublish'
  | 'links'
  | 'stopSlot'
>

const ENABLED =
  'min-h-[44px] w-full sm:w-auto bg-[color:var(--color-cobalt)] px-6 font-[family-name:var(--font-ui)] text-[15px] font-medium text-white'
const DISABLED =
  'min-h-[44px] w-full sm:w-auto cursor-not-allowed bg-[#d6d3cb] px-6 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]'
const LINK = 'underline underline-offset-2 text-[color:var(--color-cobalt)]'
const SMALL = 'font-[family-name:var(--font-ui)] text-[13px]'

export function PublishFooter(props: Props) {
  const { footer, gate, publishing, publishError, publishNotice, confirming, links, issueNumber } = props
  const ready = footer.kind === 'ready'
  const hasButton = footer.kind === 'running' || ready

  let sentence: ReactNode
  switch (footer.kind) {
    case 'loading':
      sentence = (
        <div aria-busy="true" className="flex flex-col gap-2">
          <SkeletonLine className="w-72" />
          <SkeletonLine className="w-48" />
        </div>
      )
      break
    case 'none':
      sentence = (
        <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-ink)]">
          {NONE_SENTENCE}
        </p>
      )
      break
    case 'failed':
      sentence = (
        <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-ink)]">
          {FAILED_SENTENCE}{' '}
          <Link href={links.runDetails ?? links.admin} className={LINK}>
            See why in Admin →
          </Link>
        </p>
      )
      break
    case 'gate1':
      sentence = (
        <div>
          <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-ink)]">
            {GATE1_SENTENCE}{' '}
            <Link href={links.runDetails ?? links.admin} className={LINK}>
              Details in Admin →
            </Link>
          </p>
          {props.stopSlot ? <div className="mt-3">{props.stopSlot}</div> : null}
        </div>
      )
      break
    case 'stopped':
      sentence = (
        <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-ink)]">
          {STOPPED_SENTENCE}
        </p>
      )
      break
    case 'published':
      sentence = (
        <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-ink)]">
          {footer.publishedAt != null ? `Published ${formatPublishedDate(footer.publishedAt)}.` : 'Published.'}
          {links.liveIssue ? (
            <>
              {' '}
              <a href={links.liveIssue} className={LINK}>
                Read the live issue →
              </a>
            </>
          ) : null}
        </p>
      )
      break
    case 'running':
      sentence = (
        <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-ink)]">{RUNNING_SENTENCE}</p>
      )
      break
    case 'ready':
      sentence = (
        <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-ink)]">{READY_SENTENCE}</p>
      )
      break
  }

  const showPreview = hasButton && links.preview != null

  return (
    <section
      aria-label="Publish"
      data-ready={ready ? 'true' : 'false'}
      className={
        'flex flex-col gap-4 bg-white p-5 sm:flex-row sm:items-center sm:justify-between ' +
        (ready ? 'border-2 border-[color:var(--color-ink)]' : 'border border-[color:var(--color-faint)]')
      }
    >
      <div className="flex-1">
        {sentence}
        {publishError ? (
          <p role="alert" className={`mt-2 ${SMALL} text-[#c43a14]`}>
            {publishError}
          </p>
        ) : null}
        {!gate.enabled && gate.reason === 'held' && hasButton ? (
          <p className={`mt-2 ${SMALL} text-[color:var(--color-ink-soft)]`}>{HELD_REASON}</p>
        ) : null}
        {publishNotice ? (
          <p role="status" className={`mt-2 ${SMALL} text-[color:var(--color-ink-soft)]`}>
            {publishNotice}
          </p>
        ) : null}
        {showPreview ? (
          <a
            href={links.preview ?? undefined}
            target="_blank"
            rel="noreferrer"
            className={`mt-1 inline-flex min-h-[44px] items-center ${SMALL} ${LINK}`}
          >
            Preview the issue
          </a>
        ) : null}
      </div>
      {hasButton ? (
        confirming && gate.enabled ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]">
              Publish Issue {issueNumber} now?
            </p>
            <button type="button" onClick={props.onConfirmPublish} className={ENABLED}>
              Publish
            </button>
            <button
              type="button"
              onClick={props.onCancelPublish}
              className="min-h-[44px] border border-[color:var(--color-ink)] bg-white px-5 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <LockedControl
            isLocked={!gate.enabled && gate.reason === 'collaborator'}
            lockedLabel={COLLABORATOR_LOCK_LABEL}
          >
            <button
              type="button"
              disabled={!gate.enabled || publishing}
              onClick={props.onRequestPublish}
              className={gate.enabled && !publishing ? ENABLED : DISABLED}
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </LockedControl>
        )
      ) : null}
    </section>
  )
}
