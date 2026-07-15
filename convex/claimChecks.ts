/**
 * Phase 26 — RVW-05: Factual-claims storage + sign-off mutations/queries.
 *
 * The claims extraction step runs at pipeline run-end and persists a flat list
 * of factual claims (numbers, dates, proper nouns) to this table. The operator
 * checks or skips each claim before the approve action is enabled.
 *
 * API_CONTRACTS §26.6 — all exported function signatures match exactly.
 *
 * Approve gate: `allSignedOff` returns false when NO claims exist (conservative —
 * prevents the race window where the dashboard approve button is briefly enabled
 * before claims load from Convex, per Pitfall 5). The dashboard must distinguish
 * "claims not loaded yet" (query.status !== 'success') from "all signed off"
 * (allSignedOff === true) — only enable approve when both conditions are met.
 */
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { v } from 'convex/values'
import { requireOperator, requirePipelineSecret } from './lib/auth'

// ── insertBatch ─────────────────────────────────────────────────────────────

/**
 * Idempotent batch insert. First deletes all existing claim_checks for the
 * runId (allows re-extraction), then inserts each claim with status:"pending".
 *
 * Called by the pipeline at run-end (publisher node, before setting
 * pipelineRuns.status = "awaiting-review").
 */
export const insertBatch = mutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    claims: v.array(
      v.object({
        claimIndex: v.number(),
        text: v.string(),
        claimType: v.string(), // "number" | "date" | "proper_noun"
        context: v.string(),
        // Phase 35 provenance (PRV-01/03/04) — additive optional; absent => legacy/unsourced shape
        claimId: v.optional(v.string()),
        sourceUrl: v.optional(v.string()),
        retrievedAt: v.optional(v.number()),
        sectionName: v.optional(v.string()),
        blockIndexHint: v.optional(v.number()),
        // Phase 42 (FCT-01) — additive; absent => 'Supporting' fallback applied by
        // consumers (D-03), never persisted as a fabricated value here. §42.1/§42.3
        importance: v.optional(v.union(
          v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental'),
        )),
      }),
    ),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, runId, claims, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

    // Idempotent: delete any existing rows for this runId before re-inserting.
    const existing = await ctx.db
      .query('claim_checks')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()
    await Promise.all(existing.map(row => ctx.db.delete(row._id)))

    // Insert each claim with status:"pending"
    await Promise.all(
      claims.map(claim =>
        ctx.db.insert('claim_checks', {
          workspace_id,
          runId,
          claimIndex: claim.claimIndex,
          text: claim.text,
          claimType: claim.claimType,
          context: claim.context,
          status: 'pending',
          // Phase 35 provenance — pass through when present; Convex omits undefined optionals
          claimId: claim.claimId,
          sourceUrl: claim.sourceUrl,
          retrievedAt: claim.retrievedAt,
          sectionName: claim.sectionName,
          blockIndexHint: claim.blockIndexHint,
          importance: claim.importance,
        }),
      ),
    )
  },
})

// ── setStatus ───────────────────────────────────────────────────────────────

/**
 * Operator checks or skips a single claim. Validates status before patching.
 * Called by the dashboard review screen when the operator clicks a claim row.
 */
export const setStatus = mutation({
  args: {
    runId: v.string(),
    claimIndex: v.number(),
    status: v.string(), // "pending" | "checked" | "skipped"
  },
  handler: async (ctx, { runId, claimIndex, status }) => {
    // Phase 29 D-1: dashboard-only mutation — Clerk identity required.
    await requireOperator(ctx)

    const validStatuses = ['pending', 'checked', 'skipped']
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid claim status: "${status}". Must be one of: ${validStatuses.join(', ')}`,
      )
    }

    const rows = await ctx.db
      .query('claim_checks')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()

    const row = rows.find(r => r.claimIndex === claimIndex)
    if (!row) {
      throw new Error(`Claim not found: runId=${runId}, claimIndex=${claimIndex}`)
    }

    // Phase 33 D-13 (§33.2): stamp checkedAt only when the claim flips to a
    // completed state. A re-open back to 'pending' must NOT falsely record a
    // check time.
    const patch: { status: string; checkedAt?: number; changedSinceCheck?: boolean } = { status }
    if (status === 'checked' || status === 'skipped') {
      patch.checkedAt = Date.now()
      // Phase 42 D-20 (§42.3): a fresh check clears the "changed since check"
      // marker — `undefined` removes the optional field via ctx.db.patch.
      patch.changedSinceCheck = undefined
    }
    await ctx.db.patch(row._id, patch)
  },
})

// ── byRunIdAndIndex ─────────────────────────────────────────────────────────

/**
 * Phase 42 §42.3 — single-claim public read by (runId, claimIndex). Used by
 * the pipeline-lane mutations below and by api/factcheck.py to resolve a
 * claim's current row before acting on it.
 */
export const byRunIdAndIndex = query({
  args: { runId: v.string(), claimIndex: v.number() },
  handler: async (ctx, { runId, claimIndex }) => {
    const rows = await ctx.db
      .query('claim_checks')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()
    return rows.find(r => r.claimIndex === claimIndex) ?? null
  },
})

async function _findRowOrThrow(ctx: MutationCtx, runId: string, claimIndex: number) {
  const rows = await ctx.db
    .query('claim_checks')
    .withIndex('by_runId', q => q.eq('runId', runId))
    .collect()
  const row = rows.find(r => r.claimIndex === claimIndex)
  if (!row) {
    throw new Error(`Claim not found: runId=${runId}, claimIndex=${claimIndex}`)
  }
  return row
}

// ── updateClaim ─────────────────────────────────────────────────────────────

/**
 * Phase 42 §42.3 — pipeline-lane claim-record patch (Edit claim / Replace
 * source). Guarded by requirePipelineSecret — reachable ONLY through
 * api/factcheck.py, so every write gets a real _emit_audit row (Pattern 3,
 * mirrors qaCorrections.ts::setResolution).
 */
export const updateClaim = mutation({
  args: {
    runId: v.string(),
    claimIndex: v.number(),
    text: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    retrievedAt: v.optional(v.number()),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, claimIndex, text, sourceUrl, retrievedAt, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)
    const row = await _findRowOrThrow(ctx, runId, claimIndex)

    const patch: { text?: string; sourceUrl?: string; retrievedAt?: number } = {}
    if (text !== undefined) patch.text = text
    if (sourceUrl !== undefined) patch.sourceUrl = sourceUrl
    if (retrievedAt !== undefined) patch.retrievedAt = retrievedAt
    await ctx.db.patch(row._id, patch)
  },
})

// ── markChanged ──────────────────────────────────────────────────────────────

/**
 * Phase 42 §42.3/§42.5 (D-19/D-20) — returns a claim to unchecked and sets the
 * "changed since check" marker. Called by api/content.py's
 * `_reset_touched_claims` hook whenever a content patch touches the claim's
 * anchored block, even when the replacement text is itself sourced.
 */
export const markChanged = mutation({
  args: {
    runId: v.string(),
    claimIndex: v.number(),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, claimIndex, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)
    const row = await _findRowOrThrow(ctx, runId, claimIndex)
    await ctx.db.patch(row._id, { status: 'pending', changedSinceCheck: true })
  },
})

// ── keepAsWritten ────────────────────────────────────────────────────────────

/**
 * Phase 42 §42.3 (D-14/D-18) — pipeline-lane "Keep as written" terminal
 * status. Reuses `status: 'checked'` by default (D-08's locked chip
 * vocabulary has no separate "Kept" state); the mandatory-reason + audit_log
 * row (written by api/factcheck.py) is the distinguishing record, not a new
 * stored status literal.
 */
export const keepAsWritten = mutation({
  args: {
    runId: v.string(),
    claimIndex: v.number(),
    status: v.optional(v.string()),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, claimIndex, status, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)
    const row = await _findRowOrThrow(ctx, runId, claimIndex)
    await ctx.db.patch(row._id, {
      status: status ?? 'checked',
      changedSinceCheck: undefined,
      checkedAt: Date.now(),
    })
  },
})

// ── remove ───────────────────────────────────────────────────────────────────

/**
 * Phase 42 §42.3 (D-14/D-15, 42-RESEARCH.md Pitfall 4) — soft-delete via a
 * terminal 'removed' status. Satisfies allSignedOff's `status !== 'pending'`
 * gate with zero code change to that function or to listByRunId.
 */
export const remove = mutation({
  args: {
    runId: v.string(),
    claimIndex: v.number(),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, claimIndex, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)
    const row = await _findRowOrThrow(ctx, runId, claimIndex)
    await ctx.db.patch(row._id, { status: 'removed' })
  },
})

// ── listByRunId ─────────────────────────────────────────────────────────────

/**
 * Returns all claim_checks for a run, sorted by claimIndex ascending.
 * Used by the dashboard review screen to render the sign-off checklist.
 */
export const listByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const rows = await ctx.db
      .query('claim_checks')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()
    return rows.sort((a, b) => a.claimIndex - b.claimIndex)
  },
})

// ── allSignedOff ────────────────────────────────────────────────────────────

/**
 * Returns {total, signedOff, allSignedOff} for the approve gate.
 *
 * allSignedOff = total > 0 AND every row status !== "pending"
 *
 * IMPORTANT: Empty list → {total:0, signedOff:0, allSignedOff:false}
 * This is intentionally conservative: if no claims have been extracted yet,
 * the gate treats it as "not ready" rather than "trivially satisfied".
 * The dashboard distinguishes "no claims" separately — the server gate
 * treats no-claims-yet conservatively.
 *
 * The FastAPI publish endpoint also calls this server-side check before
 * patching Sanity status (Pitfall 6 guard).
 */
export const allSignedOff = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const rows = await ctx.db
      .query('claim_checks')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()

    const total = rows.length
    const signedOff = rows.filter(r => r.status !== 'pending').length

    return {
      total,
      signedOff,
      // Conservative: empty list → false (extraction hasn't run yet)
      allSignedOff: total > 0 && signedOff === total,
    }
  },
})
