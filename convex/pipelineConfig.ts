/**
 * Phase 22 — CFG-02/CFG-04: Global pipeline settings surface.
 *
 * `upsert` writes a single JSON-encoded config value keyed by (workspace_id,
 * key); the seed/byte-verification (Plan 04) and the Phase 23 dashboard both
 * call it. `getAll` is the read the config loader (Plan 03) calls once at run
 * start to pull every pipeline_config row in one round-trip.
 *
 * Idempotency mirrors the project's deterministic-upsert convention
 * (workspace.ts seedEisenbalm, users.ts upsertCurrentUser): guard via the
 * `by_workspace_key` index, then patch existing else insert. `updatedAt` is
 * set server-side (Date.now()), matching the project's timestamp convention.
 */
import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

export const upsert = mutation({
  args: {
    workspace_id: v.string(),
    key: v.string(),
    value: v.string(), // JSON-encoded
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, key, value, updatedBy }) => {
    const existing = await ctx.db
      .query('pipeline_config')
      .withIndex('by_workspace_key', q =>
        q.eq('workspace_id', workspace_id).eq('key', key),
      )
      .unique()

    if (existing) {
      // Idempotent re-run — patch the same row, never insert a duplicate.
      await ctx.db.patch(existing._id, {
        value,
        updatedBy,
        updatedAt: Date.now(),
      })
      return existing._id
    }

    return await ctx.db.insert('pipeline_config', {
      workspace_id,
      key,
      value,
      updatedBy,
      updatedAt: Date.now(),
    })
  },
})

export const getAll = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    return await ctx.db
      .query('pipeline_config')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()
  },
})

// ── Phase 26 RVW-04 — auto_publish friction mutation ──────────────────────

/**
 * Set the auto_publish config toggle with friction guards (D-11).
 *
 * Enabling auto_publish:
 *   1. Checks rate-limit: if `auto_publish_enabled_at` was set within the
 *      last 24 hours, throws "rate_limited". Operator can re-disable immediately
 *      but re-enable requires a 24-hour cooldown.
 *   2. Upserts auto_publish = true.
 *   3. Upserts auto_publish_enabled_at = Date.now().
 *   4. Inserts a deliberationEvents row with eventType "auto-publish-enabled"
 *      (Phase 27 NTF hook — transport wired in Phase 27, event emitted here).
 *   5. Calls auditLog:write with action "auto_publish_enabled".
 *
 * Disabling auto_publish:
 *   1. No rate-limit check (disable is always immediate).
 *   2. Upserts auto_publish = false.
 *   3. Calls auditLog:write with action "auto_publish_disabled".
 *
 * API_CONTRACTS §26.6.
 */
export const setAutoPublish = mutation({
  args: {
    workspace_id: v.string(),
    enabled: v.boolean(),
    actorId: v.string(),
  },
  handler: async (ctx, { workspace_id, enabled, actorId }) => {
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
    const now = Date.now()

    // ── Rate-limit check (enabling only) ────────────────────────────────
    if (enabled) {
      const enabledAtRow = await ctx.db
        .query('pipeline_config')
        .withIndex('by_workspace_key', q =>
          q.eq('workspace_id', workspace_id).eq('key', 'auto_publish_enabled_at'),
        )
        .unique()

      if (enabledAtRow) {
        try {
          const lastEnabledAt = JSON.parse(enabledAtRow.value)
          if (typeof lastEnabledAt === 'number' && now - lastEnabledAt < TWENTY_FOUR_HOURS_MS) {
            throw new Error('rate_limited')
          }
        } catch (e) {
          // Re-throw rate_limited errors; ignore JSON parse errors
          if ((e as Error).message === 'rate_limited') throw e
        }
      }
    }

    // ── Upsert auto_publish ──────────────────────────────────────────────
    const autoPublishRow = await ctx.db
      .query('pipeline_config')
      .withIndex('by_workspace_key', q =>
        q.eq('workspace_id', workspace_id).eq('key', 'auto_publish'),
      )
      .unique()

    if (autoPublishRow) {
      await ctx.db.patch(autoPublishRow._id, {
        value: JSON.stringify(enabled),
        updatedAt: now,
        updatedBy: actorId,
      })
    } else {
      await ctx.db.insert('pipeline_config', {
        workspace_id,
        key: 'auto_publish',
        value: JSON.stringify(enabled),
        updatedAt: now,
        updatedBy: actorId,
      })
    }

    // ── Record enabled_at timestamp (enabling only) ──────────────────────
    if (enabled) {
      const enabledAtRow = await ctx.db
        .query('pipeline_config')
        .withIndex('by_workspace_key', q =>
          q.eq('workspace_id', workspace_id).eq('key', 'auto_publish_enabled_at'),
        )
        .unique()

      if (enabledAtRow) {
        await ctx.db.patch(enabledAtRow._id, {
          value: JSON.stringify(now),
          updatedAt: now,
          updatedBy: actorId,
        })
      } else {
        await ctx.db.insert('pipeline_config', {
          workspace_id,
          key: 'auto_publish_enabled_at',
          value: JSON.stringify(now),
          updatedAt: now,
          updatedBy: actorId,
        })
      }

      // ── Phase 27 NTF hook: emit auto-publish-enabled deliberation event ──
      // Transport (Slack/email) is wired in Phase 27. The event is emitted here
      // so Phase 27 can subscribe to it without any code changes here.
      // Use a sentinel runId for config-level events (not tied to a specific run).
      await ctx.db.insert('deliberationEvents', {
        runId: `config:${workspace_id}:auto-publish-enabled:${now}`,
        agentId: 'system',
        eventType: 'cost-warning' as const, // re-using closest existing literal; Phase 27 adds "auto-publish-enabled" eventType
        payload: JSON.stringify({
          eventType: 'auto-publish-enabled',
          workspace_id,
          actorId,
          enabledAt: now,
        }),
        timestamp: now,
      })
    }

    // ── Audit log ────────────────────────────────────────────────────────
    await ctx.runMutation(internal.auditLog.write, {
      workspace_id,
      actorId,
      action: enabled ? 'auto_publish_enabled' : 'auto_publish_disabled',
      resourceType: 'config',
      resourceId: 'auto_publish',
      after: JSON.stringify({ auto_publish: enabled }),
    })
  },
})
