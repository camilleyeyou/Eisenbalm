import type { PortableTextBlock } from '@portabletext/react'
import { NumberedSection } from '../NumberedSection'
import { PortableTextRenderer } from '@/components/issue/PortableTextRenderer'
import { sectionMeta } from '@/lib/dispatch/copy'
import '../sections.css'

export function FounderSection({
  headline,
  body,
}: {
  headline: string | null | undefined
  body: PortableTextBlock[] | null | undefined
}) {
  const m = sectionMeta('founder')
  const hasHeadline = typeof headline === 'string' && headline.trim().length > 0
  const hasBody = !!body && body.length > 0
  return (
    <NumberedSection id="founder" number={m.number} label={m.label}>
      {hasHeadline || hasBody ? (
        <div className="d-founder-cols">
          {hasHeadline ? <p className="d-heading d-founder-title">{headline}</p> : <div />}
          {hasBody ? <PortableTextRenderer value={body} className="d-founder-body d-prose" /> : null}
        </div>
      ) : null}
    </NumberedSection>
  )
}
