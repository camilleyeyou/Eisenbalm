/**
 * /issue/[slug] — Loading skeleton (Phase 55 Dispatch).
 *
 * App Router auto-wraps this in <Suspense>; do NOT add <Suspense> here.
 * Root element is <article> — never a main landmark (root layout owns the
 * single main#main; WCAG 1.3.1). Blocks mirror masthead / ticker / hero heights
 * so there is no content jump. Colours come from .dispatch tokens only.
 */
export default function IssueLoading() {
  return (
    <article className="dispatch animate-pulse" aria-hidden="true">
      <div style={{ background: 'var(--d-ink)', height: '48px' }} />
      <div style={{ background: 'var(--d-ink)', height: '44px', opacity: 0.85 }} />
      <div style={{ background: 'var(--d-accent)', height: '420px' }}>
        <div className="d-container">
          <div style={{ background: 'var(--d-ink)', height: '16px', width: '96px', opacity: 0.2, marginTop: '48px' }} />
          <div style={{ background: 'var(--d-ink)', height: '48px', width: '75%', opacity: 0.2, marginTop: '24px' }} />
          <div style={{ background: 'var(--d-ink)', height: '48px', width: '50%', opacity: 0.2, marginTop: '12px' }} />
        </div>
      </div>
    </article>
  )
}
