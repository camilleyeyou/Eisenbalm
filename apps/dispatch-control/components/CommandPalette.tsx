'use client'
/**
 * quick 260723-4a6 (Task 2) — the ⌘K command palette: an in-house, zero-deps
 * overlay for jumping to routes, issues (and their 5 stages), and recent
 * runs from anywhere in the dashboard.
 *
 * `CommandPaletteProvider` mounts a single window `keydown` listener for
 * `(metaKey || ctrlKey) && key === 'k'` — the ONE listener in this console
 * allowed to fire while a modifier is held — and renders ONE `<CommandPalette
 * />` instance. Mounted in `(dashboard)/layout.tsx`, wrapping the shell
 * `<div>` (a sibling of `ConfirmProvider`), so the Masthead ⌘K chip and every
 * route share the same `open()`/`close()`.
 *
 * z-order: `z-[75]` — top of the stack, above ConfirmDialog (`z-[70]`),
 * HelpTip (`z-[60]`), and the inspector panel (`z-40`).
 *
 * Data sources are EXISTING Convex queries only (no new backend):
 *   - static routes: `lib/nav.ts`'s `NAV_GROUPS` + `NAV_PINNED` (the SAME
 *     source AppSidebar/SidebarNav render — no second hardcoded list)
 *   - issues: `api.issues.listForWorkspace` → `Issue {n}` (+ 5 stage
 *     sub-entries once the operator has typed a matching query)
 *   - recent runs: `api.runs.listRecentForWorkspace` → `Run {id·8} · {status}`
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { NAV_GROUPS, NAV_PINNED } from '@/lib/nav'
import {
  issueHref,
  issueStoryHref,
  issueDraftHref,
  issueFactCheckHref,
  issueVoiceHref,
  issueApprovalHref,
} from '@/lib/issueRouteResolver'

interface PaletteItem {
  id: string
  label: string
  group: string
  href: string
}

interface CommandPaletteContextValue {
  open: () => void
  close: () => void
  isOpen: boolean
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

const STAGE_SUFFIXES: Array<{ label: string; hrefFor: (n: number) => string }> = [
  { label: 'Story', hrefFor: issueStoryHref },
  { label: 'Draft', hrefFor: issueDraftHref },
  { label: 'Fact Check', hrefFor: issueFactCheckHref },
  { label: 'Voice', hrefFor: issueVoiceHref },
  { label: 'Approval', hrefFor: issueApprovalHref },
]

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  )
}

/** Case-insensitive substring scoring: `startsWith` ranks above `includes`. */
function scoreLabel(label: string, query: string): number {
  const l = label.toLowerCase()
  const q = query.toLowerCase()
  if (!q) return 0
  if (l.startsWith(q)) return 2
  if (l.includes(q)) return 1
  return -1
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const issues = useQuery(api.issues.listForWorkspace, { workspace_id: DEFAULT_WORKSPACE_ID })
  const runs = useQuery(api.runs.listRecentForWorkspace, { workspace_id: DEFAULT_WORKSPACE_ID })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const staticItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = []
    for (const group of NAV_GROUPS) {
      for (const navItem of group.items) {
        items.push({ id: `route-${navItem.href}`, label: navItem.label, group: 'Routes', href: navItem.href })
      }
    }
    items.push({ id: `route-${NAV_PINNED.href}`, label: NAV_PINNED.label, group: 'Routes', href: NAV_PINNED.href })
    return items
  }, [])

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim()
    const result: PaletteItem[] = []

    for (const item of staticItems) {
      if (q === '' || scoreLabel(item.label, q) >= 0) result.push(item)
    }

    for (const row of issues ?? []) {
      const label = `Issue ${row.issueNumber}`
      if (q === '' || scoreLabel(label, q) >= 0) {
        result.push({ id: `issue-${row.issueNumber}`, label, group: 'Issues', href: issueHref(row.issueNumber) })
      }
      // Sub-entries for the 5 stages — only once the operator has typed
      // something (an empty query would otherwise flood the list).
      if (q !== '') {
        for (const stage of STAGE_SUFFIXES) {
          const stageLabel = `${label} · ${stage.label}`
          if (scoreLabel(stageLabel, q) >= 0) {
            result.push({
              id: `issue-${row.issueNumber}-${stage.label}`,
              label: stageLabel,
              group: 'Issues',
              href: stage.hrefFor(row.issueNumber),
            })
          }
        }
      }
    }

    for (const run of (runs ?? []).slice(0, 20)) {
      const label = `Run ${run.runId.slice(0, 8)} · ${run.status}`
      if (q === '' || scoreLabel(label, q) >= 0) {
        result.push({
          id: `run-${run.runId}`,
          label,
          group: 'Recent runs',
          href: `/run-monitor/runs/${run.runId}`,
        })
      }
    }

    if (q === '') return result.slice(0, 10)

    // startsWith ranks above includes; stable otherwise (Array.sort is stable).
    return result
      .map((item) => ({ item, score: scoreLabel(item.label, q) }))
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
      .slice(0, 10)
  }, [query, staticItems, issues, runs])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function navigateTo(item: PaletteItem | undefined) {
    if (!item) return
    router.push(item.href)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      navigateTo(items[activeIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const activeId = items[activeIndex] ? `command-palette-option-${items[activeIndex].id}` : undefined

  return (
    <div className="fixed inset-0 z-[75] flex justify-center pt-[15vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="fixed inset-0 z-[75] cursor-default bg-[color:var(--color-ink)]/40"
        onClick={onClose}
      />
      <div className="relative z-[75] h-fit w-[min(640px,calc(100vw-32px))] rounded-[2px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          aria-activedescendant={activeId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a route, issue, or run…"
          className="w-full border-b border-[color:var(--color-faint)] bg-transparent px-4 py-3 font-[family-name:var(--font-ui)] text-[14px] text-[color:var(--color-ink)] outline-none placeholder:text-[color:var(--color-faint)]"
        />
        <ul
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          className="max-h-[360px] overflow-y-auto py-1"
        >
          {items.length === 0 && (
            <li className="px-4 py-3 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
              No matches.
            </li>
          )}
          {items.map((item, i) => (
            <li key={item.id} data-index={i}>
              <button
                type="button"
                id={`command-palette-option-${item.id}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => navigateTo(item)}
                className={`flex min-h-[40px] w-full items-center justify-between gap-2 px-4 py-2 text-left font-[family-name:var(--font-ui)] text-[13px] ${
                  i === activeIndex
                    ? 'bg-[color:var(--color-card-alt)] text-[color:var(--color-ink)]'
                    : 'text-[color:var(--color-ink-soft)]'
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[10.5px] uppercase tracking-[.06em] text-[color:var(--color-faint)]">
                  {item.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-[color:var(--color-faint)] px-4 py-2 font-[family-name:var(--font-ui)] text-[10.5px] uppercase tracking-[.04em] text-[color:var(--color-faint)]">
          ↑↓ navigate · ↵ open · esc close
        </div>
      </div>
    </div>
  )
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      isOpen,
    }),
    [isOpen],
  )

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {isOpen && <CommandPalette onClose={() => setIsOpen(false)} />}
    </CommandPaletteContext.Provider>
  )
}

/** Throws if used outside a `<CommandPaletteProvider>`. */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (ctx === null) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider')
  }
  return ctx
}

// Re-exported for callers that only need the typing-target guard (Task 2d's
// stage 1-5 shortcuts reuse this exact predicate so the two keyboard
// listeners in this console never disagree about what counts as "typing").
export { isTypingTarget }
