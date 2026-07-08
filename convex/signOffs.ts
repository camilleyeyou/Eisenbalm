/**
 * Phase 34 — PUB-01/PUB-04: Two-sign-off publish gate storage.
 *
 * `sign_offs` holds ONE active row per (runId, kind), kind constrained to
 * "facts-cleared" | "sounds-human". Both kinds active (unrevoked) is the
 * publish/schedule gate (§34.4) and the webhook re-check (§34.5). Content
 * mutations revoke both (§34.6, D-08 auto-revoke). Re-signing after a
 * revocation PATCHES the same row and clears the revocation.
 *
 * API_CONTRACTS §34.2 — all exported function signatures match exactly.
 *
 * Lane split (mirrors reviewActions.ts / claimChecks.ts):
 *   - `record` / `revokeAll` are pipeline-lane mutations, secret-guarded via
 *     `requirePipelineSecret`. They are called ONLY by the FastAPI
 *     sign-off/revoke paths (api/signoffs.py, §34.3/§34.6), which have
 *     already verified the operator's Clerk JWT themselves before calling
 *     Convex as the pipeline — so `actorId` here is a verified-upstream
 *     attribution string, not a spoofable client-supplied claim.
 *   - `activeByRunId` / `listByRunId` are PUBLIC queries (no guard), per the
 *     existing unguarded-read convention of `claimChecks:allSignedOff` /
 *     `qaCorrections:byRunId` (Research Pitfall 2) — the webhook re-check
 *     (§34.5) calls `activeByRunId` with no Clerk JWT in play.
 */
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requirePipelineSecret } from './lib/auth'

// ── record ──────────────────────────────────────────────────────────────────

/**
 * Upsert a sign-off by (runId, kind) via the `by_runId_and_kind` index.
 *
 * If a row exists (previously signed, possibly revoked since): PATCH
 * `{ actorId, signedAt: Date.now(), revokedAt: undefined, revokedReason: undefined }`
 * — re-signing always clears any prior revocation.
 * Else: INSERT a fresh row.
 */
export const record = mutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    kind: v.union(v.literal('facts-cleared'), v.literal('sounds-human')),
    actorId: v.string(),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, runId, kind, actorId, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

    const existing = await ctx.db
      .query('sign_offs')
      .withIndex('by_runId_and_kind', q => q.eq('runId', runId).eq('kind', kind))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        actorId,
        signedAt: Date.now(),
        revokedAt: undefined,
        revokedReason: undefined,
      })
    } else {
      await ctx.db.insert('sign_offs', {
        workspace_id,
        runId,
        kind,
        actorId,
        signedAt: Date.now(),
      })
    }
  },
})

// ── revokeAll ───────────────────────────────────────────────────────────────

/**
 * Revoke every currently-active sign-off for a run (both kinds, whichever
 * are active). Called on content mutation (§34.6 auto-revoke) — content
 * changed, so both greens go void. No-op when none are active.
 */
export const revokeAll = mutation({
  args: {
    runId: v.string(),
    reason: v.string(),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, reason, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)

    const rows = await ctx.db
      .query('sign_offs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()

    const active = rows.filter(row => row.revokedAt === undefined)
    await Promise.all(
      active.map(row =>
        ctx.db.patch(row._id, { revokedAt: Date.now(), revokedReason: reason }),
      ),
    )
  },
})

// ── activeByRunId ───────────────────────────────────────────────────────────

/**
 * Returns an object keyed by kind for ACTIVE (unrevoked) rows only, e.g.
 * `{ 'facts-cleared': { actorId, signedAt }, 'sounds-human': { actorId, signedAt } }`.
 * A kind absent from the returned object = not signed (or revoked).
 *
 * PUBLIC — no guard. The webhook re-check (§34.5) calls this with no Clerk
 * JWT, same unguarded-read convention as `claimChecks:allSignedOff`.
 */
export const activeByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const rows = await ctx.db
      .query('sign_offs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()

    const active: Record<string, { actorId: string; signedAt: number }> = {}
    for (const row of rows) {
      if (row.revokedAt === undefined) {
        active[row.kind] = { actorId: row.actorId, signedAt: row.signedAt }
      }
    }
    return active
  },
})

// ── listByRunId ─────────────────────────────────────────────────────────────

/**
 * Returns all sign_offs rows for a run (active + revoked), sorted by
 * signedAt descending (newest first), for the rail's who-signed-when
 * display.
 */
export const listByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const rows = await ctx.db
      .query('sign_offs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()
    return rows.sort((a, b) => b.signedAt - a.signedAt)
  },
})
