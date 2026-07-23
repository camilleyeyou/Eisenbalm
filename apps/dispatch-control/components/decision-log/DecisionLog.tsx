'use client'
/**
 * Phase 43 — Plan 43-06 (TSK-06, D-08/D-09/D-12). The ONE shared,
 * human-readable Decision Log component. This is a NEW purpose-built
 * component — it does NOT generalize or import the raw Settings
 * `AuditLogViewer.tsx` (technical actorId/JSON table, `listForWorkspace`,
 * unchanged by this phase). `DecisionLog` is the opposite surface:
 * reason-first, actor-as-name, issue/run-scoped, and legacy-tolerant.
 *
 * Two exports:
 *   `DecisionLogRows` — the PURE render (docs/API_CONTRACTS.md §43.3/§43.4
 *     projection contract, rendered from already-resolved data). Takes
 *     `rows` + a synchronous `resolveActor(actorId): string` closure so it
 *     never needs a live Convex subscription to be tested or rendered.
 *   `DecisionLog` (default) — the data wrapper: subscribes to
 *     `auditLog.listDecisions` (the reason-bearing projection, Plan 43-02)
 *     scoped by `runId`/`issueNumber`, resolves each row's `actorId` to a
 *     display name (human via `users.byClerkUserId`; system/agent via a
 *     small static map local to this component — §43.4), and renders
 *     `DecisionLogRows`.
 *
 * Actor resolution (§43.4): a human `actorId` (Clerk `sub`) has no entry in
 * SYSTEM_ACTOR_NAMES and isn't `system:*`-prefixed — one `ActorNameResolver`
 * child per DISTINCT human actorId present in the current row set does the
 * `users.byClerkUserId` lookup (one `useQuery` call each — Rules-of-Hooks
 * safe because each is its own component instance, not a hook called in a
 * loop inside one component body) and reports the resolved name up via a
 * plain callback. A system/agent id resolves synchronously from the static
 * map, never a Convex query (no such row exists in `users`). Any id that
 * resolves to neither falls back to the raw id itself — explicit, never
 * blank (the "blank never means verified" honesty rule extended to actors).
 *
 * quick 260722-tv1: every value `<dd>` in the `Who/Action/When/Issue-Run/
 * Instruction ver./Before/After` grid gets `min-w-0 break-words` — long
 * runId/JSON snapshot values were overflowing the fixed `[auto_1fr]` value
 * column instead of wrapping.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { FileText } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

// ── shape ────────────────────────────────────────────────────────────────

/**
 * The subset of `Doc<'audit_log'>` (convex/schema.ts §43.1) this component
 * renders. Declared locally (rather than importing the generated `Doc`
 * type) so `DecisionLogRows` stays a pure, Convex-free unit the RED test
 * (Plan 43-06 Task 1) can render with plain fixture objects. `useQuery(
 * api.auditLog.listDecisions, ...)`'s return type is structurally
 * compatible (a strict superset) and is passed straight through.
 */
export interface DecisionLogRow {
  _id: string
  actorId: string
  action: string
  timestamp: number
  reason?: string
  before?: string
  after?: string
  issueNumber?: number
  runId?: string
  instructionVersion?: string
}

// ── system/agent actor names (§43.4 — static, local, NOT a Convex query) ───

const SYSTEM_ACTOR_NAMES: Record<string, string> = {
  pipeline: 'Pipeline',
  cron: 'Scheduler',
  webhook: 'Webhook',
  scout: 'Scout',
  advocate: 'Advocate',
  editor_gate1: 'Editor (Gate 1)',
  editor_final: 'Editor (Final)',
  researcher: 'Researcher',
  calibrator: 'Calibrator',
  game: 'Game Writer',
  bonus_jingle: 'Bonus Writer (Jingle)',
  bonus_spec_ad: 'Bonus Writer (Spec Ad)',
  bonus_big_budget: 'Bonus Writer (Big Budget)',
  origin_story: 'Origin Story Writer',
  problem: 'Problem Writer',
  founder_bio_verified: 'Founder Bio Writer',
  founder_bio_anonymous: 'Founder Bio Writer',
  case_study_verified: 'Case Study Writer',
  case_study_anonymous: 'Case Study Writer',
  design: 'Design Agent',
  qa: 'QA',
}

/** A known system/agent id never needs a `users.byClerkUserId` lookup. */
function isSystemActorId(actorId: string): boolean {
  return actorId in SYSTEM_ACTOR_NAMES || actorId.startsWith('system:')
}

function systemActorName(actorId: string): string {
  const named = SYSTEM_ACTOR_NAMES[actorId]
  if (named) return named
  if (actorId.startsWith('system:')) {
    const rest = actorId.slice('system:'.length)
    return rest || actorId
  }
  return actorId
}

// ── legacy-tolerant reason extraction (mirrors §43.3's isDecisionRow) ──────

/**
 * The reason shown for a row: the structured `reason` field when present,
 * else parsed from `after` JSON (`reason` or `heldReason` key — the same
 * two keys `convex/auditLog.ts::isDecisionRow` checks to qualify a row as a
 * decision in the first place). Never throws on malformed/non-JSON `after`.
 */
export function reasonOf(row: Pick<DecisionLogRow, 'reason' | 'after'>): string | undefined {
  if (row.reason !== undefined) return row.reason
  if (!row.after) return undefined
  try {
    const parsed: unknown = JSON.parse(row.after)
    if (parsed !== null && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      if (typeof obj.reason === 'string') return obj.reason
      if (typeof obj.heldReason === 'string') return obj.heldReason
    }
  } catch {
    // malformed/non-JSON `after` — no reason recoverable, fall through
  }
  return undefined
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

/** Compact, human single-line rendering of a before/after JSON snapshot —
 * never a raw `<pre>` dump (the raw AuditLogViewer's treatment). */
function formatSnapshot(json: string | undefined): string {
  if (!json) return '—'
  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed !== null && typeof parsed === 'object') {
      const entries = Object.entries(parsed as Record<string, unknown>)
      if (entries.length === 0) return '—'
      return entries
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' · ')
    }
    return String(parsed)
  } catch {
    return json
  }
}

// ── DecisionLogRows (PURE render — the RED-pinned contract) ────────────────

export interface DecisionLogRowsProps {
  rows: DecisionLogRow[]
  resolveActor: (actorId: string) => string
}

export function DecisionLogRows({ rows, resolveActor }: DecisionLogRowsProps) {
  if (rows.length === 0) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        No decisions recorded yet.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map(row => {
        const reason = reasonOf(row) ?? '—'
        return (
          <li
            key={row._id}
            className="flex flex-col gap-1.5 border-b border-[color:var(--color-ink)]/[.08] pb-3 last:border-b-0 last:pb-0"
          >
            <p className="flex items-start gap-1.5 font-[family-name:var(--font-ui)] text-[13px] font-medium text-[color:var(--color-ink)]">
              <FileText size={13} className="mt-[2px] shrink-0" aria-hidden="true" />
              <span>{reason}</span>
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink-soft)]">
              <dt>Who</dt>
              <dd className="min-w-0 break-words">{resolveActor(row.actorId)}</dd>
              <dt>Action</dt>
              <dd className="min-w-0 break-words">{row.action}</dd>
              <dt>When</dt>
              <dd className="min-w-0 break-words">{formatTimestamp(row.timestamp)}</dd>
              <dt>Issue / Run</dt>
              <dd className="min-w-0 break-words">
                {row.issueNumber !== undefined ? `Issue ${row.issueNumber}` : '—'} ·{' '}
                {row.runId ?? '—'}
              </dd>
              <dt>Instruction ver.</dt>
              <dd className="min-w-0 break-words">{row.instructionVersion ?? '—'}</dd>
              <dt>Before</dt>
              <dd className="min-w-0 break-words">{formatSnapshot(row.before)}</dd>
              <dt>After</dt>
              <dd className="min-w-0 break-words">{formatSnapshot(row.after)}</dd>
            </dl>
          </li>
        )
      })}
    </ul>
  )
}

// ── DecisionLog (default export — the data wrapper) ────────────────────────

export interface DecisionLogProps {
  runId?: string
  issueNumber?: number
}

interface ActorNameResolverProps {
  actorId: string
  onResolved: (actorId: string, name: string | null) => void
}

/**
 * Renders nothing — exists purely to hold ONE `useQuery` call per distinct
 * human actorId (Rules-of-Hooks safe: each row/actorId gets its own
 * component instance, so the hook count per component body never varies).
 * Reports the resolved name up via `onResolved` once the query settles.
 */
function ActorNameResolver({ actorId, onResolved }: ActorNameResolverProps) {
  const user = useQuery(api.users.byClerkUserId, {
    workspace_id: DEFAULT_WORKSPACE_ID,
    clerkUserId: actorId,
  })
  useEffect(() => {
    if (user === undefined) return // still loading
    onResolved(actorId, user ? (user.displayName ?? user.email) : null)
  }, [actorId, user, onResolved])
  return null
}

export default function DecisionLog({ runId, issueNumber }: DecisionLogProps) {
  const rows = useQuery(api.auditLog.listDecisions, {
    workspace_id: DEFAULT_WORKSPACE_ID,
    runId,
    issueNumber,
  })

  const humanActorIds = useMemo(() => {
    if (!rows) return []
    const ids = new Set<string>()
    for (const row of rows) {
      if (!isSystemActorId(row.actorId)) ids.add(row.actorId)
    }
    return Array.from(ids)
  }, [rows])

  const [resolvedNames, setResolvedNames] = useState<Record<string, string | null>>({})

  const handleResolved = useCallback((actorId: string, name: string | null) => {
    setResolvedNames(prev => (prev[actorId] === name ? prev : { ...prev, [actorId]: name }))
  }, [])

  const resolveActor = useCallback(
    (actorId: string): string => {
      if (isSystemActorId(actorId)) return systemActorName(actorId)
      const resolved = resolvedNames[actorId]
      // Explicit raw-id fallback while loading/unresolved — never blank.
      return resolved ?? actorId
    },
    [resolvedNames],
  )

  if (rows === undefined) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-[13px] italic text-[color:var(--color-ink-soft)]">
        Loading decision log…
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {humanActorIds.map(id => (
        <ActorNameResolver key={id} actorId={id} onResolved={handleResolved} />
      ))}
      <DecisionLogRows rows={rows} resolveActor={resolveActor} />
    </div>
  )
}
