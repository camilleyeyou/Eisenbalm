/**
 * /charities/[slug] — Loading skeleton.
 *
 * App Router auto-wraps this in <Suspense>; do NOT add <Suspense> here.
 * Root element is <div> — never a main landmark (root layout owns main#main).
 * Dispatch skeleton blocks (.d-skel) inside the .dispatch page shell.
 */
import '@/components/dispatch/pages.css'
import '@/components/dispatch/site.css'

export default function CharityDetailLoading() {
  return (
    <div className="dispatch d-page d-skel-pulse" aria-busy="true">
      <div className="d-container d-page-body">
        <div className="d-page-narrow">
          {/* Charity name */}
          <div className="d-skel d-skel--title" aria-hidden="true" />
          {/* Meta row (location / focus area) */}
          <div className="d-skel d-skel--line" style={{ maxWidth: 160, marginTop: 16 }} aria-hidden="true" />

          {/* Prose lines */}
          <div className="d-skel-stack">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="d-skel d-skel--line"
                style={i === 4 ? { maxWidth: '75%' } : undefined}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
