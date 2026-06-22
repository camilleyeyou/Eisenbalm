'use client'
/**
 * Phase 24 (PRM-04) — version-history list for one agent.
 *
 * Subscribes to api.promptVersions.listForAgent (newest-first) and renders each
 * version's number, author, timestamp, note, and an Active badge.
 *
 * Diff + activate/rollback controls land in Plan 08 — this panel leaves a
 * clearly-marked mount point (`data-rollback-mount`) for them rather than
 * shipping the controls now.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

interface VersionHistoryPanelProps {
  workspaceId: string
  agentKey: string
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function VersionHistoryPanel({
  workspaceId,
  agentKey,
}: VersionHistoryPanelProps) {
  const versions = useQuery(api.promptVersions.listForAgent, {
    workspace_id: workspaceId,
    agentKey,
  })

  if (versions === undefined) {
    return (
      <div className="text-sm text-neutral-500 py-4">Loading versions…</div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">
          Version history
        </h2>
        <span className="text-xs text-neutral-400">
          {versions.length === 0
            ? 'No versions'
            : `${versions.length} version${versions.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {versions.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm text-neutral-500">
            No versions yet — save the current draft to create version 1.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {versions.map(v => (
            <li key={v._id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-neutral-900">
                  v{v.version}
                </span>
                {v.isActive && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Active
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-neutral-500">
                <span className="whitespace-nowrap">
                  {formatTimestamp(v.createdAt)}
                </span>
                {v.createdBy && (
                  <span className="font-mono whitespace-nowrap">
                    {v.createdBy}
                  </span>
                )}
              </div>
              {v.note && (
                <p className="mt-1 text-xs text-neutral-600">{v.note}</p>
              )}
              {/* Plan 08 mounts diff + activate/rollback controls here. */}
              <div data-rollback-mount={`${agentKey}:${v.version}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
