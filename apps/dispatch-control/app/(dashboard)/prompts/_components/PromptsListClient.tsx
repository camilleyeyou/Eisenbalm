'use client'
/**
 * View-first prompt list cards (quick 260624-4ru).
 *
 * Client Component that owns the single live subscription to
 * api.promptVersions.listActiveForWorkspace and overlays each editable key's
 * active prompt preview + version/date onto the server-grouped card grid.
 *
 * Grouping stays server-side: the parent (page.tsx) passes pre-grouped key
 * lists in GROUP_ORDER; this component only renders + overlays live data.
 */
import Link from 'next/link'
import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import {
  GROUP_LABELS,
  humanizeAgentKey,
  type EditableAgentGroup,
} from './agentList'

interface ActiveRow {
  version: number
  content: string
  updatedAt: number
}

interface PromptsListClientProps {
  workspaceId: string
  groups: { group: EditableAgentGroup; keys: string[] }[]
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildPreview(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= 120) return collapsed
  return `${collapsed.slice(0, 120).trimEnd()}…`
}

export default function PromptsListClient({
  workspaceId,
  groups,
}: PromptsListClientProps) {
  const activeRows = useQuery(api.promptVersions.listActiveForWorkspace, {
    workspace_id: workspaceId,
  })

  const byKey = useMemo(() => {
    const map = new Map<string, ActiveRow>()
    if (!activeRows) return map
    for (const row of activeRows) {
      map.set(row.agentKey, {
        version: row.version,
        content: row.content,
        updatedAt: row.updatedAt,
      })
    }
    return map
  }, [activeRows])

  const loading = activeRows === undefined

  return (
    <>
      {groups.map(({ group, keys }) => {
        if (keys.length === 0) return null
        return (
          <section key={group} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {GROUP_LABELS[group]}
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {keys.map(key => {
                const active = byKey.get(key)
                return (
                  <li key={key}>
                    <Link
                      href={`/prompts/${encodeURIComponent(key)}`}
                      className="flex min-h-[44px] flex-col gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                    >
                      <div className="space-y-0.5">
                        <span className="block text-sm font-medium text-neutral-900">
                          {humanizeAgentKey(key)}
                        </span>
                        <span className="block font-mono text-xs text-neutral-400">
                          {key}
                        </span>
                      </div>

                      {active && (
                        <p className="text-xs leading-snug text-neutral-600">
                          {buildPreview(active.content)}
                        </p>
                      )}

                      <span className="mt-auto text-xs text-neutral-500">
                        {loading
                          ? '…'
                          : active
                            ? `active v${active.version} · updated ${formatDate(active.updatedAt)}`
                            : 'never seeded'}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}
