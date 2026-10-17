import type { PortableTextBlock } from '@portabletext/react'
import { NumberedSection } from '../NumberedSection'
import { PullQuote } from '../PullQuote'
import { PortableTextRenderer } from '@/components/issue/PortableTextRenderer'
import { sectionMeta } from '@/lib/dispatch/copy'
import type { FrontPageRow } from '@/lib/sanity/types'
import '../sections.css'

export function CaseSection({
  headline,
  subjectName,
  body,
  timeline,
  pullQuote,
}: {
  headline: string | null | undefined
  subjectName: string | null | undefined
  body: PortableTextBlock[] | null | undefined
  timeline: FrontPageRow[]
  pullQuote: string | null
}) {
  const m = sectionMeta('case')
  return (
    <NumberedSection id="case" number={m.number} label={m.label} title={headline}>
      {subjectName ? <p className="d-label d-case-subject">{subjectName}</p> : null}
      {timeline.length > 0 && (
        <ol className="d-timeline">
          {timeline.map((s, i) => (
            <li
              key={i}
              className={i === timeline.length - 1 ? 'd-timeline-step d-timeline-step--result' : 'd-timeline-step'}
            >
              <p className="d-label">{s.label}</p>
              <p className="d-timeline-value">{s.value}</p>
            </li>
          ))}
        </ol>
      )}
      {body && body.length > 0 ? <PortableTextRenderer value={body} className="d-prose" /> : null}
      {pullQuote ? <PullQuote text={pullQuote} tone="red" /> : null}
    </NumberedSection>
  )
}
