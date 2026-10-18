'use client'

import { SitePage } from '@/components/dispatch/SitePage'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <SitePage title="This issue could not be loaded." tone="yellow" narrow>
      <p className="d-body">Try refreshing.</p>
      <div className="d-page-actions">
        <button type="button" onClick={reset} className="d-pill d-pill--ink">
          Try again
        </button>
      </div>
    </SitePage>
  )
}
