/**
 * Phase 49 — ROL-04: flat read+comment capability.
 *
 * `comments` is a THIRD auth lane, distinct from both of the guard helpers
 * in convex/lib/auth.ts: `add` accepts ANY authenticated identity —
 * commenting is the one write BOTH Editor-in-chief AND Collaborator may
 * perform (D-12/D-13). This mirrors users.ts's upsertCurrentUser inline
 * `ctx.auth.getUserIdentity()` check rather than calling either shared
 * helper (neither name fits "any identity, no role check" — see
 * 49-RESEARCH.md Open Question 4).
 *
 * `listByIssueNumber` is UNGUARDED (matches charityCorrections:listByCharityKey,
 * §39.2's "queries are unguarded" convention) — both roles read everything.
 *
 * APPEND-ONLY invariant (§49.2): only `add` is defined here — no
 * update/patch/remove/delete function is ever defined against this table.
 * Flat comments only — no threading/mentions/notifications (D-13).
 *
 * API_CONTRACTS §49.2/§49.3 — signatures match exactly.
 */
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// ── add ──────────────────────────────────────────────────────────────────────

/**
 * ANY authenticated identity may call this (neither of the role-gate
 * helpers applies — see the module docstring above). `authorId` is ALWAYS
 * the verified `identity.subject` — never a client-supplied argument
 * (there is no `authorId` in the args validator at all).
 */
export const add = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    stage: v.optional(v.string()),
    anchorRef: v.optional(v.string()),
    text: v.string(),
  },
  handler: async (ctx, { workspace_id, issueNumber, stage, anchorRef, text }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthorized')

    return await ctx.db.insert('comments', {
      workspace_id,
      issueNumber,
      stage,
      anchorRef,
      text,
      authorId: identity.subject, // verified — NEVER client-supplied
      createdAt: Date.now(),
    })
  },
})

// ── listByIssueNumber ────────────────────────────────────────────────────────

/**
 * Unguarded (read-only) query. Returns the full chronological comment log
 * for one (workspace_id, issueNumber) pair, oldest-first (createdAt
 * ascending). When `stage` is supplied, only rows with that exact stage are
 * returned (screen-level comments with no stage are excluded from a
 * stage-filtered read, matching §49.3).
 */
export const listByIssueNumber = query({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    stage: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, issueNumber, stage }) => {
    const rows = await ctx.db
      .query('comments')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .collect()

    const filtered = stage === undefined ? rows : rows.filter(r => r.stage === stage)
    return filtered.sort((a, b) => a.createdAt - b.createdAt) // oldest-first
  },
})
