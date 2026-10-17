import type { PortableTextBlock } from '@portabletext/react'
import { NumberedSection } from '../NumberedSection'
import { PullQuote } from '../PullQuote'
import { PortableTextRenderer } from '@/components/issue/PortableTextRenderer'
import { sectionMeta } from '@/lib/dispatch/copy'
import '../sections.css'

export function OriginSection({
  headline,
  body,
  pullQuote,
}: {
  headline: string | null | undefined
  body: PortableTextBlock[] | null | undefined
  pullQuote: string | null
}) {
  const m = sectionMeta('origin')
  return (
    <NumberedSection id="origin" number={m.number} label={m.label} title={headline}>
      {body && body.length > 0 ? <PortableTextRenderer value={body} className="d-prose" /> : null}
      {pullQuote ? <PullQuote text={pullQuote} tone="green" /> : null}
    </NumberedSection>
  )
}
