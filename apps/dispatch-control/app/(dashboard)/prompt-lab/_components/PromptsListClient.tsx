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
 *
 * quick 260724-lp1: cards restyled to the mockup-06 status-rule "agent" card
 * (bg card, 1px faint border, 3px top border — nav at rest / cobalt on hover
 * / marigold when edited-since-launch; mono kicker -> Newsreader h3 -> Lora
 * italic description -> footer Stock/Edited chip + mono version meta). Same
 * subscription, same filters, same links — className/markup only.
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
          className="min-h-[44px] flex-1 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-3 py-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
        />
        <select
          value={groupFilter}
          onChange={e =>
            setGroupFilter(e.target.value as 'all' | EditableAgentGroup)
          }
          aria-label="Filter by group"
          className="min-h-[44px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-3 py-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
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
          className={`min-h-[44px] border px-3 py-2 font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] ${
            driftOnly
              ? 'border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] text-[color:var(--color-marigold-text)]'
              : 'border-[color:var(--color-faint)] bg-[color:var(--color-card)] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card-alt)]'
          }`}
        >
          Edits only
        </button>
      </div>

      {!anyVisible ? (
        <p className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-4 py-6 text-center font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
          No prompts match.
        </p>
      ) : (
        visibleGroups.map(({ group, keys }) => (
          <section key={group} className="space-y-2">
            <div className="space-y-0.5">
              <h2 className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
                {GROUP_LABELS[group]}
              </h2>
              <p className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink-soft)]">
                {GROUP_DESCRIPTORS[group]}
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {keys.map(key => {
                const active = byKey.get(key)
                const drifted = isDrifted(key)
                const description = descriptionFor(key)
                return (
                  <li key={key}>
                    <Link
                      href={`/prompt-lab/${encodeURIComponent(key)}`}
                      className={`flex min-h-[44px] flex-col gap-1.5 border border-[color:var(--color-faint)] border-t-[3px] bg-[color:var(--color-card)] px-4 py-3.5 transition-colors hover:bg-[color:var(--color-card-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] ${
                        drifted
                          ? 'border-t-[color:var(--color-marigold)]'
                          : 'border-t-[color:var(--color-nav)] hover:border-t-[color:var(--color-cobalt)]'
                      }`}
                    >
                      <span className="font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.1em] text-[color:var(--color-cobalt)]">
                        {GROUP_LABELS[group]}
                      </span>
                      <span className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-[color:var(--color-ink)]">
                        {displayNameForAgentKey(key)}
                      </span>
                      <span className="block font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
                        {key}
                      </span>
                      {description && (
                        <span className="block font-[family-name:var(--font-body)] italic text-[12.5px] leading-snug text-[color:var(--color-ink-soft)]">
                          {description}
                        </span>
                      )}

                      {active && (
                        <p className="font-[family-name:var(--font-ui)] text-[11.5px] leading-snug text-[color:var(--color-ink-soft)]">
                          {buildPreview(active.content)}
                        </p>
                      )}

                      <span className="mt-auto flex items-center gap-2 pt-1">
                        <span
                          className={`inline-block border px-2 py-[3px] font-[family-name:var(--font-mono)] text-[9.5px] tracking-[.09em] uppercase ${
                            drifted
                              ? 'border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] text-[color:var(--color-marigold-text)]'
                              : 'border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]'
                          }`}
                        >
                          {drifted ? 'Edited' : 'Stock'}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
                          {loading
                            ? '…'
                            : active
                              ? `active v${active.version} · updated ${formatDate(active.updatedAt)}`
                              : 'no starting version'}
                        </span>
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
