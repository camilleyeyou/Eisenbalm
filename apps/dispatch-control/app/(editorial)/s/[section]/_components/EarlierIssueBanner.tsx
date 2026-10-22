'use client'
/**
 * Quick 261022-cr6 — shown above the section header when the editor opened an
 * earlier issue via `?run=<runId>`.
 */
import Link from 'next/link'

interface EarlierIssueBannerProps {
  issueNumber: number | null
  title: string | null | undefined
}

export default function EarlierIssueBanner({ issueNumber, title }: EarlierIssueBannerProps) {
  const label = [issueNumber != null ? `Issue ${issueNumber}` : null, title].filter(Boolean).join(' — ')
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-3 py-2 text-[13px] text-[color:var(--color-ink-soft)]">
      <span>You&apos;re editing an earlier issue{label ? `: ${label}` : ''}.</span>
      <Link href="/archive" className="underline">
        ← Past issues
      </Link>
      <Link href="/" className="underline">
        This week&apos;s issue →
      </Link>
    </p>
  )
}
