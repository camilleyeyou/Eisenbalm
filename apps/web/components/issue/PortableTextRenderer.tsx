/**
 * Portable Text renderer for editorial prose sections.
 *
 * Component map matches the Jesse-voice copy contract (UI-SPEC §Typography):
 *   - h2/h3: display font (var(--font-display)), primary color
 *   - p: body font (var(--font-body)), text color, 18px, 1.65 line-height
 *   - a: body font, text color, accent underline
 *   - ul/ol: body font, standard list indent
 *   - strong: semibold (weight 600)
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
      <p className="mb-4 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)] last:mb-0">
        {children}
      </p>
    ),
    h2: ({ children }) => (
      <h2 className="mb-3 mt-8 font-display text-[22px] font-semibold leading-[1.25] text-[color:var(--color-primary)]">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-6 font-display text-[18px] font-semibold leading-[1.25] text-[color:var(--color-primary)]">
        {children}
      </h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-2 border-[color:var(--color-border)] pl-4 font-body text-[18px] italic leading-[1.65] text-[color:var(--color-text)]">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="mb-4 list-disc pl-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="mb-4 list-decimal pl-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        {children}
      </ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="mb-1">{children}</li>,
    number: ({ children }) => <li className="mb-1">{children}</li>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    // External links: text color with accent underline (UI-SPEC Color System §Accent Reserved For)
    link: ({ value, children }) => (
      <a
        href={value?.href ?? '#'}
        target={value?.href?.startsWith('http') ? '_blank' : undefined}
        rel={value?.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="decoration-[color:var(--color-accent)] underline underline-offset-2 transition-opacity hover:opacity-75"
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
