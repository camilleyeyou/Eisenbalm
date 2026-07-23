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
 *
 * quick 260722-v01 (audit item 9): mechanical class-token swap onto the
 * `var(--color-*)` / bracket-pixel system — no structural change. (The
 * Draft-stage collapsed-iframe height fix lives at the ReviewDeskRunView.tsx
 * mount site, item 2g — this file's internals are untouched structurally.)
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
  //
  // The effect depends on [loaded] and early-returns once loaded: when
  // handleLoad() sets loaded=true, this effect re-runs, hits the early
  // return, and its cleanup clears the still-pending timer from the
  // PREVIOUS (loaded=false) run — so a successfully-loaded preview is never
  // flipped to the error state by a stale timer.
  useEffect(() => {
    if (loaded) return
    const timer = setTimeout(() => {
      setError(true)
    }, LOAD_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [loaded])

  function handleLoad() {
    setLoaded(true)
    setError(false)
  }

  function handleError() {
    setError(true)
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[color:var(--color-card-alt)] text-center px-8">
        <div>
          <p className="font-[family-name:var(--font-ui)] text-[13px] font-medium text-[color:var(--color-ink-soft)]">Preview unavailable.</p>
          <p className="mt-1 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
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
          className="absolute inset-0 z-10 animate-pulse bg-[color:var(--color-card-alt)]"
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
