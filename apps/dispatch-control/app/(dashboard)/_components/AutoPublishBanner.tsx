'use client'
/**
 * Phase 26 — RVW-04: Auto-publish enabled warning banner.
 * Reworded Phase 50-03 (D-16) — drops switch-framing ("Runs will publish
 * automatically without review" read like a lever flipped on this page); the
 * setting itself is owned by Administration (Config), not this banner.
 *
 * Persistent red layout-level banner rendered at the top of the dashboard
 * when auto_publish is enabled. Appears on every page (injected in layout.tsx).
 *
 * Mirrors BudgetAlertBanner pattern but is non-dismissible and red (not amber)
 * because the auto_publish state is alarming and must remain visible until
 * the operator explicitly disables it in Administration (Config).
 *
 * Renders nothing when auto_publish is disabled.
 * role="alert" so screen readers announce the banner on appearance.
 */
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

interface AutoPublishBannerProps {
  workspace_id: string
}

export default function AutoPublishBanner({ workspace_id }: AutoPublishBannerProps) {
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id })

  if (configRows === undefined) {
    // Still loading — render nothing to avoid flash
    return null
  }

  // Parse auto_publish value from config rows
  const autoPublishRow = configRows.find(r => r.key === 'auto_publish')
  let autoPublishEnabled = false
  if (autoPublishRow) {
    try {
      autoPublishEnabled = JSON.parse(autoPublishRow.value) === true
    } catch {
      autoPublishEnabled = false
    }
  }

  if (!autoPublishEnabled) return null

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
      <p className="flex-1">
        Publishing is automatic. This setting is managed in Administration, not here.
      </p>
      <Link
        href="/config"
        className="shrink-0 font-medium underline hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 rounded"
      >
        Open Administration
      </Link>
    </div>
  )
}
