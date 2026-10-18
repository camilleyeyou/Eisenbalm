import type { ReactNode } from 'react'
import './site.css'

type Tone = 'paper' | 'green' | 'blue' | 'red' | 'yellow'

/**
 * Shared .dispatch page shell for non-front-page routes. Pure (no client or
 * server-only imports) so the client error boundary can use it too. When
 * `title` is set it renders the toned header band with the page's single h1.
 */
export function SitePage({
  eyebrow,
  title,
  lead,
  tone = 'paper',
  narrow,
  children,
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  lead?: ReactNode
  tone?: Tone
  narrow?: boolean
  children: ReactNode
}) {
  const headClass = ['d-page-head', tone === 'paper' ? '' : `d-tone-${tone}`, tone === 'blue' ? 'd-on-dark' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className="dispatch d-page">
      {title ? (
        <header className={headClass}>
          <div className="d-container">
            {eyebrow ? <p className="d-eyebrow">{eyebrow}</p> : null}
            <h1 className="d-display">{title}</h1>
            {lead ? <p className="d-body d-page-lead">{lead}</p> : null}
          </div>
        </header>
      ) : null}
      <div className="d-container d-page-body">
        {narrow ? <div className="d-page-narrow">{children}</div> : children}
      </div>
    </div>
  )
}
