/**
 * /charities — Loading skeleton.
 *
 * App Router auto-wraps this in <Suspense>; do NOT add <Suspense> here.
 * Root element is <div> — never a main landmark (root layout owns main#main).
 * Dispatch skeleton blocks (.d-skel) inside the .dispatch page shell.
 */
import '@/components/dispatch/pages.css'
import '@/components/dispatch/site.css'

export default function CharitiesLoading() {
  return (
    <div className="dispatch d-page d-skel-pulse" aria-busy="true">
      <div className="d-container d-page-body">
        {/* Title */}
        <div className="d-skel d-skel--title" aria-hidden="true" />
        {/* Subtitle */}
        <div className="d-skel d-skel--line" style={{ maxWidth: 288, marginTop: 16 }} aria-hidden="true" />

        {/* Card grid — mirrors CharityCard layout */}
        <div className="d-skel-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="d-skel d-skel--card" aria-hidden="true" />
          ))}
        </div>
      </div>
    </div>
  )
}
