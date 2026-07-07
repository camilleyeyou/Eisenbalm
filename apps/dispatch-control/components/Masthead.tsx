'use client'
/**
 * Persistent 52px ink masthead (CHR-02, Plan 30-04).
 *
 * Mounted above the sidebar+main row in `(dashboard)/layout.tsx` so it
 * appears on every dashboard route. Renders four live chips sourced from
 * already-existing Convex queries (RESEARCH Pattern 2 — no new backend):
 *   - Issue number: `pipelineRuns.byRunId` cross-referenced off `runs.latest`
 *     (issueNumber lives on the older `pipelineRuns` table, not `runs`)
 *   - Pipeline-state chip: `runs.latest.status`
 *   - Month-to-date spend vs cap: `runs.monthToDateCost` + `pipelineConfig`
 *     row keyed `monthly_cap_usd` (the SAME canonical cap key
 *     `BudgetCapsPanel.tsx` reads/writes — NOT the pipeline-side env var)
 *   - Auto-publish lock chip: `pipelineConfig` row keyed `auto_publish`
 *
 * The Awaiting-you trigger is a static button in this plan — Plan 30-06
 * wires its dropdown. `AwaitingYouTrigger` is exported standalone so 30-06
 * can attach open/close state without re-authoring the button markup.
 */
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { UserButton } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import AwaitingYouInbox from './AwaitingYouInbox'

const STATUS_LABELS: Record<string, string> = {
  running: 'Running',
  'awaiting-review': 'Awaiting review',
  complete: 'Complete',
  failed: 'Failed',
}

type ConfigRow = { key: string; value: string }

function readConfigValue<T>(rows: ConfigRow[] | undefined, key: string): T | undefined {
  const row = rows?.find(r => r.key === key)
  if (!row) return undefined
  try {
    return JSON.parse(row.value) as T
  } catch {
    return undefined
  }
}

/**
 * The Awaiting-you trigger button. Exported standalone so Plan 30-06 can
 * wire the inbox dropdown's open/close state without re-authoring the
 * button markup here.
 */
export function AwaitingYouTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto cursor-pointer rounded-[2px] bg-[color:var(--color-vermilion)] px-[12px] py-[5px] font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-masthead-text)]"
    >
      Awaiting you
    </button>
  )
}

export default function Masthead() {
  const [inboxOpen, setInboxOpen] = useState(false)
  const latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })
  const pipelineRun = useQuery(
    api.pipelineRuns.byRunId,
    latest ? { runId: latest.runId } : 'skip',
  )
  const mtd = useQuery(api.runs.monthToDateCost, { workspace_id: DEFAULT_WORKSPACE_ID })
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id: DEFAULT_WORKSPACE_ID })

  const cap = readConfigValue<number>(configRows, 'monthly_cap_usd')
  const autoPublish = readConfigValue<boolean>(configRows, 'auto_publish')

  const issueNumber = pipelineRun?.issueNumber
  const statusLabel = latest ? STATUS_LABELS[latest.status] ?? latest.status : undefined

  return (
    <header className="flex h-[52px] items-center gap-4 bg-[color:var(--color-ink)] px-[22px] text-[color:var(--color-masthead-text)]">
      {/* Wordmark */}
      <span className="font-[family-name:var(--font-ui)] text-[15.5px] font-bold tracking-[.03em]">
        DISPATCH<span className="text-[color:var(--color-vermilion)]">/</span>CONTROL
      </span>

      {/* Issue number chip */}
      <span className="font-[family-name:var(--font-mono)] text-[color:var(--color-masthead-muted)]">
        {issueNumber != null ? `Issue ${issueNumber}` : 'Issue —'}
      </span>

      {/* Pipeline-state chip */}
      {statusLabel && (
        <span className="rounded-[2px] bg-[color:var(--color-marigold)] px-[9px] py-[3px] font-[family-name:var(--font-ui)] text-[9.5px] font-semibold uppercase tracking-[.1em] text-[color:var(--color-ink)]">
          {statusLabel}
        </span>
      )}

      {/* Month-to-date spend vs cap — ambient warning at cap, not a hard stop */}
      {mtd !== undefined && cap !== undefined && (
        <span className="font-[family-name:var(--font-mono)]">
          <span
            className={
              mtd.mtdUsd >= cap ? 'text-[color:var(--color-vermilion)]' : undefined
            }
          >
            ${mtd.mtdUsd.toFixed(2)}
          </span>
          {` / $${cap}`}
        </span>
      )}

      {/* Auto-publish lock chip — OFF is the safe/expected state, ON is the friction/danger state */}
      {autoPublish !== undefined && (
        <span
          className={
            autoPublish
              ? 'font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-vermilion)]'
              : 'font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-green)]'
          }
        >
          Auto-publish {autoPublish ? 'ON' : 'OFF'}
        </span>
      )}

      {/* Awaiting-you trigger + dropdown — `relative` anchors the inbox's
          `absolute top-[52px]` positioning under this chip. A full-screen
          transparent backdrop below the dropdown (but above page content)
          closes it on outside click. */}
      <div className="relative">
        <AwaitingYouTrigger onClick={() => setInboxOpen(v => !v)} />
        {inboxOpen && (
          <button
            type="button"
            aria-label="Close awaiting-you inbox"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setInboxOpen(false)}
          />
        )}
        <AwaitingYouInbox open={inboxOpen} onClose={() => setInboxOpen(false)} />
      </div>

      <UserButton
        appearance={{
          elements: {
            avatarBox: 'h-8 w-8',
          },
        }}
      />
    </header>
  )
}
