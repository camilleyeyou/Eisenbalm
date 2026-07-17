'use client'
/**
 * View-first prompt list cards (quick 260624-4ru) + Phase 28 editorial surface.
 *
 * Client Component that owns the live subscriptions to
 * api.promptVersions.listActiveForWorkspace (active content) and
 * api.promptVersions.listSeedV1ForWorkspace (v1 seed) and overlays each
 * editable key's preview + version/date + editorial description + drift badge
 * onto the server-grouped card grid. Adds name/group/drift filtering (PRC-04).
 *
 * Grouping stays server-side: the parent (page.tsx) passes pre-grouped key
 * lists in GROUP_ORDER; this component only renders + overlays live data.
 */
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import {
  GROUP_LABELS,
  GROUP_DESCRIPTORS,
  displayNameForAgentKey,
  type EditableAgentGroup,
} from './agentList'
import { descriptionFor } from './promptDescriptions'

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

const GROUP_FILTER_OPTIONS: EditableAgentGroup[] = [
  'asset',
  'system',
  'section-guidance',
  'user-template',
]

export default function PromptsListClient({
  workspaceId,
  groups,
}: PromptsListClientProps) {
  const activeRows = useQuery(api.promptVersions.listActiveForWorkspace, {
    workspace_id: workspaceId,
  })
  const seedRows = useQuery(api.promptVersions.listSeedV1ForWorkspace, {
    workspace_id: workspaceId,
  })

  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState<'all' | EditableAgentGroup>(
    'all',
  )
  const [driftOnly, setDriftOnly] = useState(false)

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

  const seedByKey = useMemo(() => {
    const map = new Map<string, string>()
    if (!seedRows) return map
    for (const row of seedRows) map.set(row.agentKey, row.content)
    return map
  }, [seedRows])

  // PRC-02 content-compare (D-10): drifted when both are loaded and differ.
  // When seed/active not yet loaded, treat as not-drifted.
  const isDrifted = (key: string): boolean => {
    const activeContent = byKey.get(key)?.content
    const seedContent = seedByKey.get(key)
    return (
      activeContent !== undefined &&
      seedContent !== undefined &&
      activeContent !== seedContent
    )
  }

  const loading = activeRows === undefined

  // PRC-04 — apply the three filters to a key.
  const q = query.trim().toLowerCase()
  const matchesFilters = (group: EditableAgentGroup, key: string): boolean => {
    if (groupFilter !== 'all' && group !== groupFilter) return false
    if (driftOnly && !isDrifted(key)) return false
    if (q) {
      const haystack = `${key} ${displayNameForAgentKey(key)}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  }

  const visibleGroups = groups
    .map(({ group, keys }) => ({
      group,
      keys: keys.filter(key => matchesFilters(group, key)),
    }))
    .filter(({ keys }) => keys.length > 0)

  const anyVisible = visibleGroups.length > 0

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search prompts…"
          aria-label="Search prompts by name"
          className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        />
        <select
          value={groupFilter}
          onChange={e =>
            setGroupFilter(e.target.value as 'all' | EditableAgentGroup)
          }
          aria-label="Filter by group"
          className="min-h-[44px] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <option value="all">All groups</option>
          {GROUP_FILTER_OPTIONS.map(g => (
            <option key={g} value={g}>
              {GROUP_LABELS[g]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={driftOnly}
          onClick={() => setDriftOnly(v => !v)}
          className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            driftOnly
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          Edits only
        </button>
      </div>

      {!anyVisible ? (
        <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-500">
          No prompts match.
        </p>
      ) : (
        visibleGroups.map(({ group, keys }) => (
          <section key={group} className="space-y-2">
            <div className="space-y-0.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {GROUP_LABELS[group]}
              </h2>
              <p className="text-xs text-neutral-500">
                {GROUP_DESCRIPTORS[group]}
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {keys.map(key => {
                const active = byKey.get(key)
                const drifted = isDrifted(key)
                const description = descriptionFor(key)
                return (
                  <li key={key}>
                    <Link
                      href={`/prompt-lab/${encodeURIComponent(key)}`}
                      className="flex min-h-[44px] flex-col gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                    >
                      <div className="space-y-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="block text-sm font-medium text-neutral-900">
                            {displayNameForAgentKey(key)}
                          </span>
                          {drifted && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
                              edited since launch
                            </span>
                          )}
                        </span>
                        <span className="block font-mono text-xs text-neutral-400">
                          {key}
                        </span>
                        {description && (
                          <span className="block truncate text-xs text-neutral-500">
                            {description}
                          </span>
                        )}
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
                            : 'no starting version'}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </>
  )
}
