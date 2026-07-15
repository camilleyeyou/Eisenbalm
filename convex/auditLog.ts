/**
 * Phase 23 — AUD-01: Audit log infrastructure.
 * Phase 43 — TSK-06: additive decision fields + writeDecision + listDecisions
 * (docs/API_CONTRACTS.md §43.1-§43.3). Decisions are NOT a new store — they
 * are a filtered projection over this same `audit_log` trail (D-09).
 *
 * `write` is an `internalMutation` callable from any other Convex mutation
 * that needs to log an operator action. Phase 23 builds the infrastructure;
 * actual emissions (config changes, review decisions, kill-switch flips)
 * land in Phases 24–26 when those actions are implemented.
 *
 * `record` is a public `mutation` for callers outside Convex (e.g. the
 * FastAPI pipeline) that need to emit an audit row directly via the HTTP API.
 * It has the same args as `write` and delegates to the same db.insert.
 * Added in Phase 25 (RUN-01/RUN-02) so /pipeline/run and /pipeline/tick
 * can emit operator-attributed audit rows without going through an internal
 * mutation chain.
 *
 * `writeDecision` is the ONE shared Convex-side decision-write helper (D-11).
 * Every reason-requiring, status-only dashboard mutation (Hold, Do-not-use,
 * etc.) calls this directly instead of hand-rolling
 * `ctx.runMutation(internal.auditLog.write, {...})`. Content-touching actions
 * keep going through the dashboard → pipeline API → `_emit_audit` →
 * `record` write boundary (EDT-05, unchanged) — both paths converge on the
 * same `audit_log` row shape.
 *
 * `listForWorkspace` is a public `query` returning ALL audit rows
 * newest-first for the read-only audit viewer in the dashboard Settings or
 * Config page (`AuditLogViewer.tsx`) — UNCHANGED by Phase 43 (D-08).
 *
 * `listDecisions` is a public `query` returning ONLY the reason-bearing
 * subset of `audit_log`, newest-first, optionally scoped by `runId` /
 * `issueNumber` — the substrate the `DecisionLog` component (Plan 43-06)
 * renders.
 *
 * Table: `audit_log` — already defined in schema.ts (Phase 21 AUTH-04;
 * decision fields added Phase 43 §43.1). Indexes used:
 * `by_workspace_timestamp` (compound — for newest-first order). No new index
 * is required for `listDecisions` — it filters/scopes in memory after the
 * same newest-first scan (§43.1).
 */
import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requirePipelineSecret } from './lib/auth'
import type { Doc } from './_generated/dataModel'

// ── decision field args (shared shape, additive) ──────────────────────────────

const decisionFieldArgs = {
  reason: v.optional(v.string()),
  issueNumber: v.optional(v.number()),
  runId: v.optional(v.string()),
  instructionVersion: v.optional(v.string()),
}

// ── write (internal — called from other mutations) ───────────────────────────

/**
 * Insert one audit log row. Timestamp is injected server-side (Date.now()).
 *
 * `actorId` should be the Clerk userId (ctx.auth.getUserIdentity()?.subject)
 * from the calling mutation's context, or a system identifier like
 * "pipeline" / "cron" for automated actions.
 *
 * `before` and `after` are JSON strings (stringify before passing).
 *
 * The four decision fields (Phase 43) are additive-optional and forwarded
 * into the insert only when the caller provides them — mirrors the existing
 * before/after optional-arg pattern (§43.2).
 */
export const write = internalMutation({
  args: {
    workspace_id: v.string(),
    actorId: v.string(),
    action: v.string(),              // e.g. "workspace.seeded", "run.triggered"
    resourceType: v.optional(v.string()),  // "run" | "prompt_version" | "config" | etc.
    resourceId: v.optional(v.string()),
    before: v.optional(v.string()),  // JSON snapshot
    after: v.optional(v.string()),   // JSON snapshot
    ...decisionFieldArgs,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('audit_log', { ...args, timestamp: Date.now() })
  },
})

// ── record (public mutation — called from FastAPI pipeline, Phase 25) ───────

/**
 * Public mutation version of `write`. Called by the FastAPI pipeline via the
 * Convex HTTP API when /pipeline/run or /pipeline/tick fires, to emit an
 * operator-attributed or cron-attributed audit row without going through an
 * internal mutation chain.
 *
 * Args are identical to `write`, plus a `pipelineSecret` guard arg (Phase 29
 * D-1 — injected centrally by convex_client.py::convex_mutation; never
 * persisted) and the same additive decision fields (Phase 43 §43.2 —
 * forwarded from `_emit_audit`'s new optional kwargs).
 */
export const record = mutation({
  args: {
    workspace_id: v.string(),
    actorId: v.string(),
    action: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    pipelineSecret: v.optional(v.string()),
    ...decisionFieldArgs,
  },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)
    await ctx.db.insert('audit_log', { ...args, timestamp: Date.now() })
  },
})

// ── writeDecision (internal — the ONE shared decision-write helper, D-11) ───

/**
 * Insert one audit log row that IS a decision — `reason` is required (a
 * decision always has a reason). This is the single Convex-side helper every
 * reason-requiring, status-only dashboard mutation calls (Hold, Do-not-use,
 * etc.) instead of hand-rolling `ctx.runMutation(internal.auditLog.write,
 * {...})`. Wraps the same `audit_log` insert `write` uses so both converge on
 * an identical row shape (§43.2).
 */
export const writeDecision = internalMutation({
  args: {
    workspace_id: v.string(),
    actorId: v.string(),
    action: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    reason: v.string(),               // REQUIRED — a decision always has a reason
    issueNumber: v.optional(v.number()),
    runId: v.optional(v.string()),
    instructionVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('audit_log', { ...args, timestamp: Date.now() })
  },
})

// ── listForWorkspace (public query — dashboard read-only viewer) ─────────────

/**
 * Returns audit rows for a workspace, newest-first.
 * Default limit: 50 rows. Pass a higher limit for pagination (Phase 24+).
 *
 * UNCHANGED by Phase 43 (D-08) — the raw technical Settings audit viewer
 * (`AuditLogViewer.tsx`) keeps reading ALL rows through this query;
 * `listDecisions` below is a new sibling, not a modification of this one.
 */
export const listForWorkspace = query({
  args: {
    workspace_id: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspace_id, limit }) => {
    return ctx.db
      .query('audit_log')
      .withIndex('by_workspace_timestamp', q => q.eq('workspace_id', workspace_id))
      .order('desc')
      .take(limit ?? 50)
  },
})

// ── listDecisions (public query — the Decision Log projection, D-09) ────────

/**
 * The "is a decision" predicate (§43.3): a row qualifies as a decision if
 * EITHER (a) it carries the structured `reason` field, OR (b) its `after`
 * string parses as JSON to an object containing a reason-like key (`reason`
 * or `heldReason`). Branch (b) is what makes legacy reason-in-`after` rows
 * (Hold, the `promptVersions.activate` override) project as decisions BOTH
 * before and after their §43.7 retrofit lands, with zero backfill required.
 * Non-reason rows (`run.triggered`, `run.section_rerolled`,
 * `workspace.seeded`) are excluded — they carry no reason under either
 * branch. The JSON.parse is wrapped in try/catch: a malformed/non-JSON
 * `after` string never qualifies a row as a decision.
 */
function isDecisionRow(row: Doc<'audit_log'>): boolean {
  if (row.reason !== undefined) return true
  if (!row.after) return false
  try {
    const parsed = JSON.parse(row.after)
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      ('reason' in parsed || 'heldReason' in parsed)
    )
  } catch {
    return false
  }
}

/**
 * Returns ONLY the reason-bearing (decision) subset of `audit_log` for a
 * workspace, newest-first — the substrate the `DecisionLog` component
 * renders (D-08/D-09). A new sibling query; `listForWorkspace` and
 * `AuditLogViewer.tsx` are unchanged.
 *
 * When `runId` or `issueNumber` is passed, scopes to rows whose matching NEW
 * structured field equals it. Legacy rows that predate the new fields (and
 * therefore can never match a scoped query) fall back to being visible only
 * in the unscoped, workspace-wide call — a scoped call is a stricter subset,
 * never a superset, of the unscoped call (§43.3).
 */
export const listDecisions = query({
  args: {
    workspace_id: v.string(),
    runId: v.optional(v.string()),
    issueNumber: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspace_id, runId, issueNumber, limit }) => {
    const rows = await ctx.db
      .query('audit_log')
      .withIndex('by_workspace_timestamp', q => q.eq('workspace_id', workspace_id))
      .order('desc')
      .take(limit ?? 200)

    let decisions = rows.filter(isDecisionRow)

    if (runId !== undefined) {
      decisions = decisions.filter(row => row.runId === runId)
    }
    if (issueNumber !== undefined) {
      decisions = decisions.filter(row => row.issueNumber === issueNumber)
    }

    return decisions
  },
})
