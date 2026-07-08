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
    const patch: { status: string; checkedAt?: number } = { status }
    if (status === 'checked' || status === 'skipped') patch.checkedAt = Date.now()
    await ctx.db.patch(row._id, patch)
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
