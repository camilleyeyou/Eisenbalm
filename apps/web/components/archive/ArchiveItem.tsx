import Link from 'next/link'
import type { ArchiveIssue, BonusType } from '@/lib/sanity/types'
import { formatMonthYear } from '@/lib/format'

const BONUS_LABEL: Record<BonusType, string> = {
  bigBudget: 'Big Budget',
  jingle: 'Jingle',
  specAd: 'Spec Ad',
}

export function ArchiveItem({ issue }: { issue: ArchiveIssue }) {
  return (
    <li className="border-b border-[color:var(--color-border)] py-6">
      <div className="flex flex-col gap-2">
        <p className="font-ui text-[14px] text-[color:var(--color-text-muted)]">
          Issue {issue.issueNumber}
        </p>
        <h2 className="font-display text-[22px] font-semibold">
          <Link
            href={`/issue/${issue.slug}`}
            className="text-[color:var(--color-primary)] underline-offset-4 hover:text-[color:var(--color-accent)] hover:underline"
          >
            {issue.charity.name}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[14px] text-[color:var(--color-text-muted)]">
          {issue.charity.focusArea ? (
            <span>{issue.charity.focusArea}</span>
          ) : null}
          <span>{issue.charity.location}</span>
          <span>{formatMonthYear(issue.publishDate)}</span>
          {issue.charity.assetRange ? (
            <span className="text-[12px]">{issue.charity.assetRange} assets</span>
          ) : null}
          <span className="text-[12px] uppercase tracking-[0.05em]">
            {BONUS_LABEL[issue.bonusType]}
          </span>
        </div>
      </div>
    </li>
  )
}
