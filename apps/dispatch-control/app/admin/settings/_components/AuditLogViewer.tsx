'use client'
/**
 * Phase 23 — AUD-01: Read-only audit-log viewer.
 *
 * Displays audit_log rows for the workspace via api.auditLog.listForWorkspace.
 * Renders: timestamp, actorId, action, resourceType, resourceId, before/after
 * (before/after are collapsed JSON in <details><summary> for readability).
 *
 * This phase builds the infrastructure + viewer only (AUD-01). Audit event
 * emissions (config changes, review decisions, kill-switch flips) land in
 * Phases 24-26 when those actions are implemented.
 *
 * Read-only — NO write controls or mutation buttons rendered here.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

interface AuditLogViewerProps {
  workspace_id: string
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AuditLogViewer({ workspace_id }: AuditLogViewerProps) {
  const rows = useQuery(api.auditLog.listForWorkspace, {
    workspace_id,
    limit: 50,
  })

  if (rows === undefined) {
    return (
      <div className="text-sm text-[color:var(--color-faint)] py-4">Loading audit log…</div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[color:var(--color-ink)]">Audit Log</h2>
        <span className="text-xs text-[color:var(--color-faint)]">
          {rows.length === 0 ? 'No events' : `${rows.length} event${rows.length !== 1 ? 's' : ''}`}
          {rows.length === 50 ? ' (showing latest 50)' : ''}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)] p-8 text-center">
          <p className="text-sm text-[color:var(--color-faint)]">
            No audit events yet — actions are recorded starting in Phase 24.
          </p>
          <p className="text-xs text-[color:var(--color-faint)] mt-2">
            Config changes, review decisions, and kill-switch flips will appear
            here once the Phase 24-26 operator controls are implemented.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-ink)]/15 bg-[color:var(--color-card-alt)] text-left">
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Timestamp</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Actor</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Action</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Resource</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Before / After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-ink)]/10">
              {rows.map(row => (
                <tr key={row._id} className="hover:bg-[color:var(--color-card-alt)] transition-colors align-top">
                  <td className="px-4 py-3 text-[color:var(--color-ink-soft)] whitespace-nowrap">
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-ink-soft)] whitespace-nowrap">
                    {row.actorId}
                  </td>
                  <td className="px-4 py-3 font-medium text-[color:var(--color-ink)] whitespace-nowrap">
                    {row.action}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-faint)] text-xs">
                    {row.resourceType && (
                      <span className="block">{row.resourceType}</span>
                    )}
                    {row.resourceId && (
                      <span className="block font-mono">{row.resourceId}</span>
                    )}
                    {!row.resourceType && !row.resourceId && '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[color:var(--color-faint)] min-w-[200px]">
                    {(row.before || row.after) ? (
                      <div className="space-y-1">
                        {row.before && (
                          <details>
                            <summary className="cursor-pointer text-[color:var(--color-faint)] hover:text-[color:var(--color-ink-soft)] select-none">
                              Before
                            </summary>
                            <pre className="mt-1 p-2 bg-[color:var(--color-card-alt)] rounded-none text-xs overflow-x-auto max-w-xs whitespace-pre-wrap break-all">
                              {(() => {
                                try {
                                  return JSON.stringify(JSON.parse(row.before!), null, 2)
                                } catch {
                                  return row.before
                                }
                              })()}
                            </pre>
                          </details>
                        )}
                        {row.after && (
                          <details>
                            <summary className="cursor-pointer text-[color:var(--color-faint)] hover:text-[color:var(--color-ink-soft)] select-none">
                              After
                            </summary>
                            <pre className="mt-1 p-2 bg-[color:var(--color-card-alt)] rounded-none text-xs overflow-x-auto max-w-xs whitespace-pre-wrap break-all">
                              {(() => {
                                try {
                                  return JSON.stringify(JSON.parse(row.after!), null, 2)
                                } catch {
                                  return row.after
                                }
                              })()}
                            </pre>
                          </details>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
