import Link from 'next/link'
import type { ArchiveIssue, BonusType } from '@/lib/sanity/types'
import { formatMonthYear } from '@/lib/format'
import '@/components/dispatch/pages.css'

const BONUS_LABEL: Record<BonusType, string> = {
  bigBudget: 'Big Budget',
  jingle: 'Jingle',
  specAd: 'Spec Ad',
}

export function ArchiveItem({ issue }: { issue: ArchiveIssue }) {
  return (
    <li className="d-row">
      <p className="d-eyebrow d-muted">
        Issue {issue.issueNumber}
      </p>
      <h2 className="d-row-title">
        <Link href={`/issue/${issue.slug}`} className="d-row-link">
          {issue.charity.name}
        </Link>
      </h2>
      <div className="d-row-meta">
        {issue.charity.focusArea ? (
          <span>{issue.charity.focusArea}</span>
        ) : null}
        <span>{issue.charity.location}</span>
        <span>{formatMonthYear(issue.publishDate)}</span>
        {issue.charity.assetRange ? (
          <span>{issue.charity.assetRange} assets</span>
        ) : null}
        <span>{BONUS_LABEL[issue.bonusType]}</span>
      </div>
    </li>
  )
}
