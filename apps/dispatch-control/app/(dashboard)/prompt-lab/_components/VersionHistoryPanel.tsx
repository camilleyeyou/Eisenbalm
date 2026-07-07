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
 *   - per-version Activate / "Rollback to this version" controls wired to
 *     api.promptVersions.activate. Rollback IS activate(olderVersion) — no
 *     separate call. The control is DISABLED while a run is in progress
 *     (api.runs.latest.status === 'running'), with an inline explanation
 *     (D-02 block-with-explanation, no queue). On a server-side `{ blocked }`
 *     return (TOCTOU race, Pitfall 2) the reason is surfaced inline.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useUser } from '@clerk/nextjs'
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

  const { user } = useUser()
  const activateVersion = useMutation(api.promptVersions.activate)

  // In-progress signal: reuse the dashboard's existing runs query. A run with
  // status 'running' for this workspace disables activation (D-02).
  const latestRun = useQuery(api.runs.latest, { workspace_id: workspaceId })
  const runInProgress = latestRun?.status === 'running'

  // Per-version activation state (which version is mid-activation) + any
  // server-returned block reason (defensive TOCTOU surface, Pitfall 2).
  const [activating, setActivating] = useState<number | null>(null)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)

  async function handleActivate(version: number) {
    setBlockedReason(null)
    setActivating(version)
    try {
      const result = await activateVersion({
        workspace_id: workspaceId,
        agentKey,
        version,
        actorId: user?.id ?? 'unknown',
      })
      if (result?.blocked) {
        setBlockedReason(
          result.reason ??
            'A run is in progress — activation will be available when it finishes.',
        )
      }
    } finally {
      setActivating(null)
    }
  }

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

      {runInProgress && (
        <div
          role="status"
          className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          A run is in progress — activation will be available when it finishes.
        </div>
      )}

      {blockedReason && (
        <div
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          {blockedReason}
        </div>
      )}

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
              {/* Activate / rollback control (PRM-04). Rollback == activate of
                  an older version; same mutation, label differs. */}
              <div
                data-rollback-mount={`${agentKey}:${v.version}`}
                className="mt-2"
              >
                {v.isActive ? (
                  <span className="text-xs text-neutral-400">
                    Currently active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleActivate(v.version)}
                    disabled={runInProgress || activating !== null}
                    title={
                      runInProgress
                        ? 'A run is in progress — activation will be available when it finishes.'
                        : activeVersion !== null && v.version < activeVersion
                          ? `Roll back to v${v.version}`
                          : `Activate v${v.version}`
                    }
                    className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 min-h-[44px]"
                  >
                    {activating === v.version
                      ? 'Activating…'
                      : activeVersion !== null && v.version < activeVersion
                        ? 'Rollback to this version'
                        : 'Activate'}
                  </button>
                )}
              </div>
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
