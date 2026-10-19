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
  return (
    <NumberedSection id="founder" number={m.number} label={m.label} title={headline}>
      {body && body.length > 0 ? <PortableTextRenderer value={body} className="d-prose" /> : null}
    </NumberedSection>
  )
}
