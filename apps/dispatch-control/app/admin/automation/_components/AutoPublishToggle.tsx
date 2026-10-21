'use client'
/**
 * Phase 26 — RVW-04: Auto-publish friction toggle.
 *
 * High-friction toggle for the auto_publish config key.
 *
 * DISABLING: immediate — calls setAutoPublish({enabled:false}) directly.
 *
 * ENABLING: opens a non-dismissible confirmation modal (no X, no outside-click
 * close — the operator must explicitly confirm or cancel). The modal background
 * is NOT blurred (ink at 40% opacity) so the alarming banner context is
 * partially visible. CTA is destructive-vermilion.
 *
 * RATE-LIMIT: if the mutation throws "rate_limited", shows the UI-SPEC error
 * copy: "Auto-publish was recently changed. Wait 24 hours before re-enabling."
 *
 * The toggle button always renders in a vermilion destructive style per
 * UI-SPEC Screen 4 (never neutral — the auto_publish state is always alarming).
 *
 * API_CONTRACTS §26.6 — setAutoPublish({workspace_id, enabled, actorId}).
 */
import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useUser } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'
import { api } from '@convex/_generated/api'

interface AutoPublishToggleProps {
  workspace_id: string
}

export default function AutoPublishToggle({ workspace_id }: AutoPublishToggleProps) {
  const { user } = useUser()
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id })
  const setAutoPublish = useMutation(api.pipelineConfig.setAutoPublish)

  const [showEnableModal, setShowEnableModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (configRows === undefined) {
    return (
      <div className="text-sm text-[color:var(--color-faint)]">Loading…</div>
    )
  }

  // Parse current auto_publish value
  const autoPublishRow = configRows.find(r => r.key === 'auto_publish')
  let autoPublishEnabled = false
  if (autoPublishRow) {
    try {
      autoPublishEnabled = JSON.parse(autoPublishRow.value) === true
    } catch {
      autoPublishEnabled = false
    }
  }

  const actorId = user?.id ?? 'unknown'

  async function handleDisable() {
    setLoading(true)
    setError(null)
    try {
      await setAutoPublish({ workspace_id, enabled: false, actorId })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleEnableConfirm() {
    setLoading(true)
    setError(null)
    try {
      await setAutoPublish({ workspace_id, enabled: true, actorId })
      setShowEnableModal(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('rate_limited') || msg === 'rate_limited') {
        setError('Auto-publish was recently changed. Wait 24 hours before re-enabling.')
      } else {
        setError(msg)
      }
      setShowEnableModal(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          {/* Toggle label + description */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[color:var(--color-ink)]">Auto-publish</p>
            <p className="text-xs text-[color:var(--color-faint)] mt-0.5">
              When enabled, finished runs publish automatically without review. Off by default.
            </p>
          </div>

          {/* Toggle button — always vermilion-destructive per UI-SPEC Screen 4 */}
          {autoPublishEnabled ? (
            <button
              type="button"
              onClick={handleDisable}
              disabled={loading}
              aria-busy={loading}
              aria-label="Disable auto-publish"
              className="min-h-[44px] min-w-[80px] rounded-none bg-[color:var(--color-vermilion)] px-4 text-sm font-medium text-[color:var(--color-masthead-text)] hover:bg-[color:var(--color-vermilion)]/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span className="sr-only">Disabling…</span>
                </span>
              ) : (
                'Enabled'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setShowEnableModal(true)
              }}
              disabled={loading}
              aria-label="Enable auto-publish"
              className="min-h-[44px] min-w-[80px] rounded-none border border-[color:var(--color-vermilion)]/40 bg-[color:var(--color-card)] px-4 text-sm font-medium text-[color:var(--color-vermilion)] hover:bg-[color:var(--color-vermilion)]/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span className="sr-only">Loading…</span>
                </span>
              ) : (
                'Disabled'
              )}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-[color:var(--color-vermilion)]">
            {error}
          </p>
        )}
      </div>

      {/* Non-dismissible enable confirmation modal */}
      {showEnableModal && (
        <div
          // ink/40 overlay — NOT blurred, so the red banner behind is partially visible
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-ink)]/40"
          // Non-dismissible: onInteractOutside intentionally has no handler
          // The operator must explicitly choose Enable or Cancel
          role="presentation"
          onKeyDown={e => {
            // Non-dismissible: Escape key does NOT close this modal
            e.stopPropagation()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="enable-autopublish-heading"
            className="w-full max-w-md mx-4 rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] p-6 shadow-xl space-y-4"
          >
            <h2
              id="enable-autopublish-heading"
              className="text-base font-semibold text-[color:var(--color-ink)]"
            >
              Enable auto-publish?
            </h2>
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              Auto-publish bypasses the review gate. Runs will publish immediately when
              complete. This is audit-logged. You cannot re-enable within 24 hours of a
              disable.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleEnableConfirm}
                disabled={loading}
                aria-busy={loading}
                className="min-h-[44px] rounded-none bg-[color:var(--color-vermilion)] px-4 text-sm font-medium text-[color:var(--color-masthead-text)] hover:bg-[color:var(--color-vermilion)]/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span className="sr-only">Enabling…</span>
                    Enable Auto-publish
                  </span>
                ) : (
                  'Enable Auto-publish'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEnableModal(false)
                  setError(null)
                }}
                disabled={loading}
                className="min-h-[44px] rounded-none border border-[color:var(--color-ink)]/15 px-4 text-sm text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
