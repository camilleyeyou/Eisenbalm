/**
 * Phase 26 — REG-01/REG-02: Charity registry mutations + dedup/list queries.
 *
 * The charities table is the authoritative dedup/state layer for the Scout
 * and the dispatch-control registry UI. Sanity charity docs remain the
 * canonical CONTENT record (name, mission, etc.); this registry owns
 * dedup/state (candidate/featured/blocklisted lifecycle).
 *
 * API_CONTRACTS §26.6 — all exported function signatures match exactly.
 *
 * CRITICAL guard (Pitfall 3): `upsertCandidate` MUST NOT downgrade
 * featured|blocklisted → candidate. Check status before patching.
 *
 * Dedup key: `"{name.trim().toLowerCase()}|{bareDomain(website)}"`
 * Mirrors the existing scout.py:104-110 `_candidate_keys()` logic.
 */
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// ── Local helper: bare domain normalization ─────────────────────────────────
// Mirrors scout.py:96 `_domain_of()`: strip scheme, take host, lowercase,
// strip leading www.  Returns empty string for falsy/empty input.

function bareDomain(url?: string): string {
  if (!url) return ''
  try {
    // Strip scheme prefix if present
    const withoutScheme = url.replace(/^https?:\/\//i, '')
    // Take host (everything before first /)
    const host = withoutScheme.split('/')[0] ?? ''
    // Lowercase + strip leading www.
    return host.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

// ── upsertCandidate ─────────────────────────────────────────────────────────

/**
 * Scout calls this for each pitched charity. Idempotent candidate registration.
 *
 * Guards (Pitfall 3): if an existing row has status "featured" or "blocklisted",
 * the status is NOT changed — the Scout logging a candidate never downgrades a
 * featured/blocklisted charity back to candidate status.
 *
 * New inserts: {workspace_id, name, status:"candidate", website, domain,
 * dedupKey, firstSeenRunId: runId, timesFeatured:0}
 *
 * Existing candidate rows: patch website + domain only (idempotent re-candidate).
 */
export const upsertCandidate = mutation({
  args: {
    workspace_id: v.string(),
    name: v.string(),
    website: v.optional(v.string()),
    runId: v.string(),
  },
  handler: async (ctx, { workspace_id, name, website, runId }) => {
    const domain = bareDomain(website)
    const dedupKey = `${name.trim().toLowerCase()}|${domain}`

    const existing = await ctx.db
      .query('charities')
      .withIndex('by_workspace_dedupKey', q =>
        q.eq('workspace_id', workspace_id).eq('dedupKey', dedupKey),
      )
      .first()

    if (existing) {
      // Critical guard: never downgrade featured|blocklisted → candidate
      if (existing.status === 'featured' || existing.status === 'blocklisted') {
        return // No-op — status protected
      }
      // Existing candidate: patch website/domain only (not status, not firstSeenRunId)
      await ctx.db.patch(existing._id, { website, domain })
      return
    }

    // New insert
    await ctx.db.insert('charities', {
      workspace_id,
      name,
      status: 'candidate',
      website,
      domain,
      dedupKey,
      firstSeenRunId: runId,
      timesFeatured: 0,
    })
  },
})

// ── upsertFeatured ──────────────────────────────────────────────────────────

/**
 * Called on publish (D-01 path). Upserts a charity as featured, incrementing
 * timesFeatured and setting lastFeaturedAt. Creates a new row if the charity
 * was not previously in the registry.
 */
export const upsertFeatured = mutation({
  args: {
    workspace_id: v.string(),
    name: v.string(),
    website: v.optional(v.string()),
    sanityCharityId: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, name, website, sanityCharityId }) => {
    const domain = bareDomain(website)
    const dedupKey = `${name.trim().toLowerCase()}|${domain}`

    const existing = await ctx.db
      .query('charities')
      .withIndex('by_workspace_dedupKey', q =>
        q.eq('workspace_id', workspace_id).eq('dedupKey', dedupKey),
      )
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: 'featured',
        timesFeatured: (existing.timesFeatured ?? 0) + 1,
        lastFeaturedAt: now,
        ...(sanityCharityId !== undefined ? { sanityCharityId } : {}),
        // Backfill domain/website if missing
        ...(website && !existing.website ? { website } : {}),
        ...(domain && !existing.domain ? { domain } : {}),
      })
      return
    }

    // New insert — charity not previously seen
    await ctx.db.insert('charities', {
      workspace_id,
      name,
      status: 'featured',
      website,
      domain,
      dedupKey,
      sanityCharityId,
      timesFeatured: 1,
      lastFeaturedAt: now,
    })
  },
})

// ── setStatus ───────────────────────────────────────────────────────────────

/**
 * Operator manually sets candidate/featured/blocklisted from the registry UI.
 * Validates status before patching; throws on invalid value.
 */
export const setStatus = mutation({
  args: {
    workspace_id: v.string(),
    charityId: v.id('charities'),
    status: v.string(),
  },
  handler: async (ctx, { workspace_id, charityId, status }) => {
    const validStatuses = ['candidate', 'featured', 'blocklisted']
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid charity status: "${status}". Must be one of: ${validStatuses.join(', ')}`,
      )
    }
    const charity = await ctx.db.get(charityId)
    if (!charity || charity.workspace_id !== workspace_id) {
      throw new Error(`Charity not found: ${charityId}`)
    }
    await ctx.db.patch(charityId, { status })
  },
})

// ── listByWorkspace ─────────────────────────────────────────────────────────

/**
 * Registry list query. Optional status filter. Sorted by name ascending.
 * Used by the dispatch-control /charities registry UI.
 */
export const listByWorkspace = query({
  args: {
    workspace_id: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, status }) => {
    const rows = await ctx.db
      .query('charities')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()

    const filtered = status ? rows.filter(r => r.status === status) : rows
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  },
})

// ── listForDedup ────────────────────────────────────────────────────────────

/**
 * Scout dedup query. Returns only featured + blocklisted rows.
 * Projects minimal shape to keep response small: {_id, dedupKey, name, domain, status}.
 *
 * The Scout uses this to build the set of keys to skip when selecting candidates.
 * Candidates are NOT included (the Scout should pitch candidates, but not re-pitch
 * featured/blocklisted ones).
 */
export const listForDedup = query({
  args: {
    workspace_id: v.string(),
  },
  handler: async (ctx, { workspace_id }) => {
    const rows = await ctx.db
      .query('charities')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()

    return rows
      .filter(r => r.status === 'featured' || r.status === 'blocklisted')
      .map(r => ({
        _id: r._id,
        dedupKey: r.dedupKey,
        name: r.name,
        domain: r.domain,
        status: r.status,
      }))
  },
})

// ── getByDedupKey ───────────────────────────────────────────────────────────

/**
 * Direct dedup lookup by the compound key. Used by the Scout and upsert helpers.
 */
export const getByDedupKey = query({
  args: {
    workspace_id: v.string(),
    dedupKey: v.string(),
  },
  handler: async (ctx, { workspace_id, dedupKey }) => {
    return await ctx.db
      .query('charities')
      .withIndex('by_workspace_dedupKey', q =>
        q.eq('workspace_id', workspace_id).eq('dedupKey', dedupKey),
      )
      .first()
  },
})

// ── seedFromPublished ───────────────────────────────────────────────────────

/**
 * One-time backfill: idempotent upsert of featured charities from existing
 * published Sanity issues. The script at packages/pipeline/scripts/backfill_charity_registry.py
 * (uv-runnable) calls this with the result of the Scout's GROQ query.
 *
 * Also available as an operator-triggered "Seed registry" button in dispatch-control.
 *
 * Rows are processed sequentially to avoid Convex concurrency issues.
 */
export const seedFromPublished = mutation({
  args: {
    workspace_id: v.string(),
    rows: v.array(
      v.object({
        name: v.string(),
        website: v.optional(v.string()),
        sanityCharityId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { workspace_id, rows }) => {
    for (const row of rows) {
      const domain = bareDomain(row.website)
      const dedupKey = `${row.name.trim().toLowerCase()}|${domain}`

      const existing = await ctx.db
        .query('charities')
        .withIndex('by_workspace_dedupKey', q =>
          q.eq('workspace_id', workspace_id).eq('dedupKey', dedupKey),
        )
        .first()

      const now = Date.now()

      if (existing) {
        await ctx.db.patch(existing._id, {
          status: 'featured',
          timesFeatured: (existing.timesFeatured ?? 0) + 1,
          lastFeaturedAt: now,
          ...(row.sanityCharityId ? { sanityCharityId: row.sanityCharityId } : {}),
          ...(row.website && !existing.website ? { website: row.website } : {}),
          ...(domain && !existing.domain ? { domain } : {}),
        })
      } else {
        await ctx.db.insert('charities', {
          workspace_id,
          name: row.name,
          status: 'featured',
          website: row.website,
          domain,
          dedupKey,
          sanityCharityId: row.sanityCharityId,
          timesFeatured: 1,
          lastFeaturedAt: now,
        })
      }
    }
  },
})
