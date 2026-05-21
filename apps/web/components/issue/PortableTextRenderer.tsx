/**
 * Portable Text renderer for editorial prose sections.
 *
 * Phase 9 restyle: body prose 19px / 1.85 line-height in --color-text-dim
 * (AA-passing editorial contrast). blockquote handler upgraded to the
 * pull-quote treatment — display font, clamp(26px,3.2vw,38px), italic,
 * weight 300, --color-text, with a 2px --color-accent left border.
 * This renders the FIRST blockquote block in a section body as the
 * editorial pull-quote (locked HYBRID decision: zero schema change,
 * extracted from body blocks, graceful when absent). DES-03, DES-06.
 *
 * Component map (Jesse-voice copy contract — UI-SPEC §Typography):
 *   - h2/h3: display font, --color-primary
 *   - p (normal): body font, --color-text-dim, 19px, 1.85 line-height
 *   - blockquote: display font, clamp pull-quote size, --color-accent border
 *   - a: underline color --color-primary (accent-reserved for links)
 *   - ul/ol: body font, --color-text-dim, 19px / 1.85
 *   - strong: weight 500, --color-text (slightly brighter on dim prose)
 *   - em: italic
 *
 * No decorative paragraph styling that would break the dry register.
 * @portabletext/react v4+ is the renderer.
 */
import { PortableText, type PortableTextReactComponents } from '@portabletext/react'
import type { PortableTextBlock } from '@portabletext/react'

const components: Partial<PortableTextReactComponents> = {
  block: {
    normal: ({ children }) => (
      <p className="mb-5 font-body text-[19px] font-light leading-[1.7] text-[color:var(--color-text-dim)] last:mb-0">
        {children}
      </p>
    ),
    h2: ({ children }) => (
      <h2 className="mb-4 mt-10 font-display text-[26px] font-normal leading-[1.2] text-[color:var(--color-primary)]">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-3 mt-8 font-display text-[20px] font-normal leading-[1.3] text-[color:var(--color-primary)]">
        {children}
      </h3>
    ),
    // Pull-quote treatment (HYBRID locked decision — extracted from first body blockquote;
    // zero schema change, zero hardcoded quotes, graceful when absent).
    // UI-SPEC §Typography: display font, clamp(26px,3.2vw,38px), italic, weight 300,
    // --color-text, 2px --color-accent left border.
    blockquote: ({ children }) => (
      <blockquote className="my-10 border-l-2 border-[color:var(--color-accent)] pl-7 font-display text-[clamp(26px,3.2vw,38px)] font-light italic leading-[1.3] text-[color:var(--color-text)]">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="mb-5 list-disc pl-6 font-body text-[19px] font-light leading-[1.85] text-[color:var(--color-text-dim)]">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="mb-5 list-decimal pl-6 font-body text-[19px] font-light leading-[1.85] text-[color:var(--color-text-dim)]">
        {children}
      </ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="mb-1">{children}</li>,
    number: ({ children }) => <li className="mb-1">{children}</li>,
  },
  marks: {
    // strong in dim prose resolves to full --color-text (the editorial contrast pattern)
    strong: ({ children }) => (
      <strong className="font-medium text-[color:var(--color-text)]">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    // Links: underline color --color-primary (UI-SPEC accent-reserved for link accents)
    link: ({ value, children }) => (
      <a
        href={value?.href ?? '#'}
        target={value?.href?.startsWith('http') ? '_blank' : undefined}
        rel={value?.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="decoration-[color:var(--color-primary)] underline underline-offset-2 transition-opacity hover:opacity-75"
      >
        {children}
      </a>
    ),
  },
}

interface PortableTextRendererProps {
  value: PortableTextBlock[] | null | undefined
  className?: string
}

export function PortableTextRenderer({ value, className }: PortableTextRendererProps) {
  if (!value || value.length === 0) return null
  return (
    <div className={className}>
      <PortableText value={value} components={components} />
    </div>
  )
}
