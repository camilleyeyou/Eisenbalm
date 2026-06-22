'use client'
/**
 * Phase 24 (PRM-04) — version-history list + compare for one agent.
 *
 * Subscribes to api.promptVersions.listForAgent (newest-first) and renders each
 * version's number, author, timestamp, note, and an Active badge.
 *
 * Plan 08 adds:
 *   - a two-version compare selector (pick A + B) that renders <DiffViewer> for
 *     the chosen pair (default A = active version, B = the selected version).
 *     (activate/rollback controls land in Task 2.)
 */
import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DiffViewer } from './DiffViewer'

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

  // Compare selector state: which two versions to diff. Null until the user
  // picks; defaults are derived (A = active, B = newest non-active) below.
  const [compareA, setCompareA] = useState<number | null>(null)
  const [compareB, setCompareB] = useState<number | null>(null)

  const activeVersion = useMemo(
    () => versions?.find(v => v.isActive)?.version ?? null,
    [versions],
  )

  // Resolve the effective pair: explicit selection, else sensible defaults.
  const effectiveA = compareA ?? activeVersion ?? versions?.[0]?.version ?? null
  const effectiveB =
    compareB ??
    versions?.find(v => v.version !== effectiveA)?.version ??
    effectiveA

  const rowA = versions?.find(v => v.version === effectiveA) ?? null
  const rowB = versions?.find(v => v.version === effectiveB) ?? null
  const canCompare =
    rowA !== null && rowB !== null && rowA.version !== rowB.version

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
              {/* Task 2 mounts activate/rollback controls here. */}
              <div data-rollback-mount={`${agentKey}:${v.version}`} />
            </li>
          ))}
        </ul>
      )}

      {/* ── Compare two versions (PRM-04 side-by-side diff) ──────────────── */}
      {versions.length >= 2 && (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Compare versions
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              <span className="text-neutral-500">A</span>
              <select
                className="rounded border border-neutral-300 px-1.5 py-1"
                value={effectiveA ?? ''}
                onChange={e => setCompareA(Number(e.target.value))}
                aria-label="Compare version A"
              >
                {versions.map(v => (
                  <option key={v._id} value={v.version}>
                    v{v.version}
                    {v.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-neutral-400">vs</span>
            <label className="flex items-center gap-1">
              <span className="text-neutral-500">B</span>
              <select
                className="rounded border border-neutral-300 px-1.5 py-1"
                value={effectiveB ?? ''}
                onChange={e => setCompareB(Number(e.target.value))}
                aria-label="Compare version B"
              >
                {versions.map(v => (
                  <option key={v._id} value={v.version}>
                    v{v.version}
                    {v.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {canCompare && rowA && rowB ? (
            <DiffViewer
              left={{ label: `v${rowA.version}`, content: rowA.content }}
              right={{ label: `v${rowB.version}`, content: rowB.content }}
            />
          ) : (
            <p className="text-xs text-neutral-400">
              Pick two different versions to see a side-by-side diff.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
