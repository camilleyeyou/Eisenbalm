/**
 * Phase 21 — CFG-05: Workspace seed mutation.
 *
 * Seeds the single "eisenbalm" workspace record on first run.
 * Safe to re-run — idempotent (matches the project's deterministic-upsert
 * convention established in stripeEvents.ts claim and stripeOrders.ts insert).
 *
 * Run via Convex dashboard or CLI:
 *   npx convex run workspace:seedEisenbalm
 *
 * Expected output on first run:  { seeded: true }
 * Expected output on repeat run: { seeded: false, message: "eisenbalm workspace already exists" }
 */
import { mutation } from './_generated/server'
import { v } from 'convex/values'

export const seedEisenbalm = mutation({
  args: {},
  handler: async (ctx) => {
    // NOTE: the literal 'eisenbalm' is allowed here because this is SEED DATA,
    // not control-plane logic (D-16). The string lives in seeded data; code
    // reads it from the DEFAULT_WORKSPACE_ID constant (see convex/users.ts).
    const existing = await ctx.db
      .query('workspaces')
      .withIndex('by_workspace', q => q.eq('workspace_id', 'eisenbalm'))
      .first()

    if (existing) {
      return { seeded: false, message: 'eisenbalm workspace already exists' }
    }

    await ctx.db.insert('workspaces', {
      workspace_id: 'eisenbalm',
      name: 'The Eisenbalm Dispatch',
      createdAt: Date.now(),
    })

    // Log the seed event to audit_log with a sentinel actorId.
    // This proves the audit_log write path and operator attribution shape
    // are correct from day one (AUTH-04, Phase 21 D-04).
    await ctx.db.insert('audit_log', {
      workspace_id: 'eisenbalm',
      actorId: 'system:seed',
      action: 'workspace.seed',
      resourceType: 'workspace',
      resourceId: 'eisenbalm',
      timestamp: Date.now(),
    })

    return { seeded: true }
  },
})
