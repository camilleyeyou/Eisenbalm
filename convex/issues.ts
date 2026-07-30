/**
 * Phase 40 — ISS-01/ISS-02/ISS-03/ISS-04: the `issues` Convex table functions.
 *
 * `issues` is the operational-state substrate every other Phase 40 plan reads
 * (§40.1/§40.2). One row per issueNumber, created either by the console (D-03)
 * or defensively by the pipeline at run start (D-04) via `ensureByNumber` —
 * an idempotent insert-if-absent mutation that is a STRICT NO-OP on an
 * existing row (it must never resurrect a Held issue).
 *
 * `held` and `published` are the ONLY stored status inputs (D-18) — issue
 * status is derived elsewhere (lib/derivedState.ts, §40.6), never stored here.
 *
 * Lane split (mirrors pipelineConfig.ts / sign_offs pattern):
 *   - `byIssueNumber` / `listForWorkspace` are PUBLIC unguarded reads, same
 *     convention as `claimChecks:allSignedOff`.
 *   - `ensureByNumber` / `markPublished` are DUAL LANE via
 *     `requireOperatorOrPipeline` — both the console and the pipeline call
 *     them.
 *   - `hold` / `reopen` are OPERATOR-ONLY via `requireOperator` — these are
 *     human editorial decisions, never made by the pipeline.
 *
 * API_CONTRACTS §40.2 — all exported function signatures match exactly.
 */
import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireOperator, requireOperatorOrPipeline } from './lib/auth'

// ── byIssueNumber (public query) ───────────────────────────────────────────

export const byIssueNumber = query({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
  },
  handler: async (ctx, { workspace_id, issueNumber }) => {
    return await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()
  },
})

// ── listForWorkspace (public query) ────────────────────────────────────────

export const listForWorkspace = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const rows = await ctx.db
      .query('issues')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()
    return rows.sort((a, b) => b.issueNumber - a.issueNumber)
  },
})

// ── ensureByNumber (dual lane — console D-03 + pipeline D-04) ──────────────

export const ensureByNumber = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    scheduledFor: v.optional(v.number()),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, issueNumber, scheduledFor, pipelineSecret }) => {
    await requireOperatorOrPipeline(ctx, pipelineSecret)

    const existing = await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()

    // D-04 guard: a stray run (POST /run/weekly with an empty body, a curl, a
    // future cron) must NEVER silently resurrect a Held issue. Strict NO-OP —
    // do not patch held/heldReason/heldBy/heldAt/published on an existing row.
    if (existing) {
      return { issueNumber, created: false }
    }

    await ctx.db.insert('issues', {
      workspace_id,
      issueNumber,
      scheduledFor,
      held: false,
      published: false,
      createdAt: Date.now(),
    })
    return { issueNumber, created: true }
  },
})

// ── hold (operator-only) ────────────────────────────────────────────────────

export const hold = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { workspace_id, issueNumber, reason }) => {
    const actor = await requireOperator(ctx)

    const trimmedReason = reason.trim()
    if (trimmedReason === '') {
      throw new Error('A reason is required to hold this issue.')
    }

    const existing = await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()
    if (!existing) throw new Error('Issue not found')

    await ctx.db.patch(existing._id, {
      held: true,
      heldReason: trimmedReason,
      heldBy: actor,
      heldAt: Date.now(),
    })

    // D-14: "also stop the run in progress" is a SEPARATE client-side call to
    // the existing runs:requestCancel mutation — hold does NOT touch
    // runs.cancelRequested. The two state systems stay distinct in the model.
    //
    // Phase 43 §43.7 (D-11/D-13): routed through the ONE shared decision-write
    // helper — the reason is promoted from after-JSON into the structured
    // `reason` field (alongside issueNumber) so this row projects uniformly
    // through auditLog.listDecisions.
    await ctx.runMutation(internal.auditLog.writeDecision, {
      workspace_id,
      actorId: actor,
      action: 'issue.held',
      resourceType: 'issue',
      resourceId: String(issueNumber),
      before: JSON.stringify({ held: false }),
      after: JSON.stringify({ held: true, heldReason: trimmedReason }),
      reason: trimmedReason,
      issueNumber,
    })

    return null
  },
})

// ── reopen (operator-only) ──────────────────────────────────────────────────

export const reopen = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
  },
  handler: async (ctx, { workspace_id, issueNumber }) => {
    const actor = await requireOperator(ctx)

    const existing = await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()
    if (!existing) throw new Error('Issue not found')

    await ctx.db.patch(existing._id, {
      held: false,
      heldReason: undefined,
      heldBy: undefined,
      heldAt: undefined,
    })

    // D-17: status re-derives on its own — no "restore previous status"
    // bookkeeping.
    //
    // Phase 43 §43.7 (D-11/D-13): routed through the ONE shared decision-write
    // helper. `reopen` itself takes no reason arg — the structured `reason`
    // describes the reopen and carries the prior heldReason forward so the
    // Decision Log row is self-explanatory without a join back to the held row.
    const reopenReason = existing.heldReason
      ? `Reopened (previously held: ${existing.heldReason})`
      : 'Issue reopened'

    await ctx.runMutation(internal.auditLog.writeDecision, {
      workspace_id,
      actorId: actor,
      action: 'issue.reopened',
      resourceType: 'issue',
      resourceId: String(issueNumber),
      before: JSON.stringify({ held: true, heldReason: existing.heldReason }),
      after: JSON.stringify({ held: false }),
      reason: reopenReason,
      issueNumber,
    })

    return null
  },
})

// ── markPublished (dual lane — D-05 backfill + publisher) ──────────────────

export const markPublished = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    sanityIssueId: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    // Phase 29 D-1: pipeline-lane secret (injected centrally by
    // convex_client.py::convex_mutation). Never persisted.
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, issueNumber, sanityIssueId, publishedAt, pipelineSecret }) => {
    await requireOperatorOrPipeline(ctx, pipelineSecret)

    const existing = await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()
    if (!existing) throw new Error('Issue not found')

    // Idempotent — safe to call more than once with the same or refreshed args.
    await ctx.db.patch(existing._id, {
      published: true,
      publishedAt: publishedAt ?? Date.now(),
      sanityIssueId,
    })

    return null
  },
})

// ── setLastVisitedStage (operator-only) ─────────────────────────────────────
// Phase 41 — WSP-01: the SOLE writer of `issues.lastVisitedStage` (41-RESEARCH
// Pitfall 6 — the schema field existed with no mutation writing it). Backs the
// frame's bare `/issues/[n]` redirect (D-03) and the per-stage "remember where
// I was" behavior (D-04). A stage visit is a human action, not a pipeline
// event, so this mirrors the `hold`/`reopen` OPERATOR-ONLY lane — NOT the dual
// lane `ensureByNumber`/`markPublished` use.
//
// Strict patch-only NO-OP when the row is absent: a stray visit must never
// create/resurrect an issue row — that stays `ensureByNumber`'s guarded job.
export const setLastVisitedStage = mutation({
  args: {
    workspace_id: v.string(),
    issueNumber: v.number(),
    stage: v.union(
      v.literal('story'),
      v.literal('draft'),
      v.literal('fact-check'),
      v.literal('voice'),
      v.literal('approval'),
    ),
  },
  handler: async (ctx, { workspace_id, issueNumber, stage }) => {
    await requireOperator(ctx)

    const existing = await ctx.db
      .query('issues')
      .withIndex('by_workspace_issueNumber', q =>
        q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber),
      )
      .first()
    if (!existing) return null // no row yet — nothing to remember; never create here

    await ctx.db.patch(existing._id, { lastVisitedStage: stage })
    return null
  },
})

// ── listWithTitles (public query, additive — quick 260730-ldn Task 1) ──────
//
// The server-side "issues -> latest pipelineRun -> selected pitchLog" join
// that lets The Run's switcher and the Archive subscribe to ONE query
// instead of N+1ing per row (the pattern `RecentlyPublishedRowContainer`
// already accepts for its bounded 5-row list — unacceptable for the full
// archive). Every read below is index-backed; no new index, no schema
// change, no existing export touched.
//
// HONESTY CONTRACT (load-bearing): `title: null` means the run has NEVER
// chosen a subject — either no run exists for this issue at all, or a run
// exists but Gate 1 has not (yet) recorded a `pitchLog` row with
// `selected: true`. This query must NEVER substitute the issue number, the
// charity's location, an unselected candidate's name, or any other stand-in
// for a missing `charityName`. The client renders `issueTitleLabel(null)`
// ('Not yet chosen').
//
// "Most recent run for this issue" reuses the EXACT rule
// `pipelineRuns.byIssueNumber` already uses (sort by `startedAt` desc, take
// the first) — do not invent a second definition of "the issue's run".
export const listWithTitles = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const issueRows = await ctx.db
      .query('issues')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()

    const results = await Promise.all(
      issueRows.map(async issue => {
        const runRows = await ctx.db
          .query('pipelineRuns')
          .withIndex('by_issueNumber', q => q.eq('issueNumber', issue.issueNumber))
          .collect()
        const run = runRows.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null

        let title: string | null = null
        let subtitle: string | null = null
        let hasDrafts = false

        if (run) {
          const selectedPitch = await ctx.db
            .query('pitchLog')
            .withIndex('by_runId_and_selected', q =>
              q.eq('runId', run.runId).eq('selected', true),
            )
            .first()
          if (selectedPitch) {
            title = selectedPitch.charityName
            subtitle = selectedPitch.scoutSummary
          }

          // "Has drafts to edit" — the presence of at least one section-draft
          // event (emitted by origin_story/problem/founder_bio/case_study/
          // game/bonus/design/researcher via @agent_node(emit_event=
          // 'section-draft')) is the honest "sections were produced" signal.
          // .first(), never .collect() — a boolean needs one row.
          const draftEvent = await ctx.db
            .query('deliberationEvents')
            .withIndex('by_runId_and_type', q =>
              q.eq('runId', run.runId).eq('eventType', 'section-draft'),
            )
            .first()
          hasDrafts = draftEvent !== null
        }

        return {
          _id: issue._id,
          issueNumber: issue.issueNumber,
          held: issue.held,
          heldReason: issue.heldReason,
          heldBy: issue.heldBy,
          heldAt: issue.heldAt,
          published: issue.published,
          publishedAt: issue.publishedAt,
          scheduledFor: issue.scheduledFor,
          createdAt: issue.createdAt,
          lastVisitedStage: issue.lastVisitedStage,
          runId: run ? run.runId : null,
          runStatus: run ? run.status : null,
          runStartedAt: run ? run.startedAt : null,
          runCompletedAt: run?.completedAt ?? null,
          title,
          subtitle,
          hasDrafts,
        }
      }),
    )

    return results.sort((a, b) => b.issueNumber - a.issueNumber)
  },
})
