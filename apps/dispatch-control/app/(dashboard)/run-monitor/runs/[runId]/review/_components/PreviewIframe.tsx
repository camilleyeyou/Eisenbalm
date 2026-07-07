'use client'
/**
 * Phase 26 (RVW-02) — Preview iframe wrapper.
 *
 * Renders the apps/web draft preview in an iframe. Shows a skeleton loader
 * until the iframe signals load, then displays the full preview edge-to-edge.
 * Shows an error state if load fails or takes too long.
 *
 * Props:
 *   previewUrl — fully-signed URL computed server-side by buildPreviewUrl()
 *
 * The iframe fills its container exactly (D-10):
 *   width: 100%, height: 100%, border: none
 */
import { useState, useEffect } from 'react'

interface PreviewIframeProps {
  previewUrl: string
}

/** Maximum ms to wait before declaring the iframe failed to load. */
const LOAD_TIMEOUT_MS = 30_000

export default function PreviewIframe({ previewUrl }: PreviewIframeProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  // Fallback: if the iframe doesn't fire onLoad within LOAD_TIMEOUT_MS, show the
  // error state. iframes don't expose HTTP status codes directly; the timeout
  // catches cases where the iframe loads a 4xx/5xx page silently.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded) {
        setError(true)
      }
    }, LOAD_TIMEOUT_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLoad() {
    setLoaded(true)
    setError(false)
  }

  function handleError() {
    setError(true)
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-50 text-center px-8">
        <div>
          <p className="text-sm font-medium text-neutral-700">Preview unavailable.</p>
          <p className="mt-1 text-sm text-neutral-500">
            The draft issue may not be ready yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {/* Skeleton loader — hidden once iframe loads */}
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 animate-pulse bg-neutral-100"
        />
      )}

      <iframe
        src={previewUrl}
        title="Issue preview"
        onLoad={handleLoad}
        onError={handleError}
        className="h-full w-full border-0"
        style={{ display: 'block' }}
      />
    </div>
  )
}
