import type { ReactNode } from 'react'
import type { SectionId } from '@/lib/dispatch/copy'

/**
 * Colour-block section wrapper. Section ids are the fixed nav anchors
 * (origin problem founder case game bonus delib pod). Field/disc colours come
 * from `.d-sec--{id}` in app/dispatch.css; never pass colours as props.
 * Exactly one h2 per section: the title, or the label when there is no title.
 */
export function NumberedSection({
  id,
  number,
  label,
  title,
  compact,
  className,
  children,
}: {
  id: SectionId
  number: string
  label: string
  title?: string | null
  compact?: boolean
  className?: string
  children?: ReactNode
}) {
  const hasTitle = typeof title === 'string' && title.trim().length > 0
  const headingId = `${id}-title`
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={['d-sec', `d-sec--${id}`, compact ? 'd-sec--compact' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="d-container">
        <div className="d-sec-head">
          <span className="d-disc" aria-hidden="true">
            {number}
          </span>
          {hasTitle ? (
            <p className="d-eyebrow">{label}</p>
          ) : (
            <h2 id={headingId} className="d-eyebrow">
              {label}
            </h2>
          )}
        </div>
        {hasTitle && (
          <h2 id={headingId} className="d-heading d-sec-title">
            {title}
          </h2>
        )}
        {children}
      </div>
    </section>
  )
}
