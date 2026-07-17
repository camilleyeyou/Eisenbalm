/**
 * Phase 22 — CFG-02: Active prompt store surface.
 *
 * `upsertActive` is the v1 seed/write mutation Plan 04 calls to migrate the 12
 * file-externalized prompts into the DB. Phase 22 seeds v1 ONLY — versioning,
 * diff, and rollback UI are Phase 24. Re-running the seed is idempotent: it
 * patches the existing row's content and leaves `version == 1, isActive == true`
 * (no version increment, no duplicate row).
 *
 * `getActive` is the read the config loader (Plan 03) calls per agent to pull
 * the active prompt content via the `by_workspace_agentKey` index.
 *
 * NOTE: agentKey is the canonical key (e.g. "editor_gate1"), NOT a prompt
 * filename. The seed (Plan 04) is responsible for mapping files → keys.
 */
import { query, mutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireOperator, requireEditor } from './lib/auth'

// ── Phase 38 §38.3 (EVL-03): commit gate tolerance ───────────────────────────
// 0-10 scale. Absorbs LLM-judge scoring non-determinism (Research Pitfall 7) —
// a regression smaller than this is noise, not a real quality drop.
const EVAL_REGRESSION_TOLERANCE = 0.5

/**
 * evaluateEvalGate (§38.3) — reads `eval_scores` for the target version being
 * committed and the currently-active version, and decides whether `activate`
 * should block.
 *
 * Freshness: the target version needs at least one eval_scores row recorded
 * AT OR AFTER its own `createdAt` (i.e. run against the actual saved prompt
 * text, not a stale run from before this version existed).
 *
 * Regression / aggregate: only scenarios present on BOTH sides are compared
 * (using each side's most-recently-run score per scenarioId) — a scenario
 * with no active-side score simply isn't part of the comparison.
 */
async function evaluateEvalGate(
  ctx: MutationCtx,
  args: {
    workspace_id: string
    agentKey: string
    targetVersion: number
    targetCreatedAt: number
    activeVersion: number
  },
): Promise<{ blocked: boolean; reason?: string }> {
  const { workspace_id, agentKey, targetVersion, targetCreatedAt, activeVersion } = args

  const targetRows = await ctx.db
    .query('eval_scores')
    .withIndex('by_workspace_agentKey_version', q =>
      q
        .eq('workspace_id', workspace_id)
        .eq('agentKey', agentKey)
        .eq('promptVersion', String(targetVersion)),
    )
    .collect()

  const hasFreshTargetRow = targetRows.some(r => r.ranAt >= targetCreatedAt)
  if (!hasFreshTargetRow) {
    return {
      blocked: true,
      reason: `No fresh eval results for v${targetVersion} — run the scenario evals against this saved version before activating.`,
    }
  }

  const activeRows = await ctx.db
    .query('eval_scores')
    .withIndex('by_workspace_agentKey_version', q =>
      q
        .eq('workspace_id', workspace_id)
        .eq('agentKey', agentKey)
        .eq('promptVersion', String(activeVersion)),
    )
    .collect()

  // Most-recently-run score per scenarioId, for each side.
  function latestByScenario(rows: typeof targetRows) {
    const map = new Map<string, { overall: number; ranAt: number }>()
    for (const row of rows) {
      const existing = map.get(row.scenarioId)
      if (!existing || row.ranAt > existing.ranAt) {
        map.set(row.scenarioId, { overall: row.overall, ranAt: row.ranAt })
      }
    }
    return map
  }

  const targetByScenario = latestByScenario(targetRows)
  const activeByScenario = latestByScenario(activeRows)
  const pairedScenarioIds = [...targetByScenario.keys()].filter(id =>
    activeByScenario.has(id),
  )

  for (const scenarioId of pairedScenarioIds) {
    const targetOverall = targetByScenario.get(scenarioId)!.overall
    const activeOverall = activeByScenario.get(scenarioId)!.overall
    if (targetOverall < activeOverall - EVAL_REGRESSION_TOLERANCE) {
      return {
        blocked: true,
        reason: `Scenario '${scenarioId}' regressed: v${targetVersion} scored ${targetOverall.toFixed(1)} vs active v${activeVersion}'s ${activeOverall.toFixed(1)} (tolerance ${EVAL_REGRESSION_TOLERANCE}).`,
      }
    }
  }

  if (pairedScenarioIds.length > 0) {
    const avgTarget =
      pairedScenarioIds.reduce((sum, id) => sum + targetByScenario.get(id)!.overall, 0) /
      pairedScenarioIds.length
    const avgActive =
      pairedScenarioIds.reduce((sum, id) => sum + activeByScenario.get(id)!.overall, 0) /
      pairedScenarioIds.length
    if (avgTarget < avgActive) {
      return {
        blocked: true,
        reason: `Target metric not up (v${targetVersion} avg ${avgTarget.toFixed(2)} < active v${activeVersion} avg ${avgActive.toFixed(2)}).`,
      }
    }
  }

  return { blocked: false }
}

export const upsertActive = mutation({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
    content: v.string(),
    createdBy: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, agentKey, content, createdBy, note }) => {
    // Phase 29 D-1: dashboard-only mutation — Clerk identity required.
    await requireOperator(ctx)

    const existing = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey),
      )
      .first()

    if (existing) {
      // Idempotent v1 seed semantics: refresh content, keep version, stay active.
      // Do NOT increment version — Phase 22 seeds v1 only (versioning is Phase 24).
      await ctx.db.patch(existing._id, {
        content,
        isActive: true,
        ...(createdBy !== undefined ? { createdBy } : {}),
        ...(note !== undefined ? { note } : {}),
      })
      return existing._id
    }

    return await ctx.db.insert('prompt_versions', {
      workspace_id,
      agentKey,
      version: 1,
      content,
      isActive: true,
      createdAt: Date.now(),
      createdBy,
      note,
    })
  },
})

export const getActive = query({
  args: { workspace_id: v.string(), agentKey: v.string() },
  handler: async (ctx, { workspace_id, agentKey }) => {
    return await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey),
      )
      .filter(q => q.eq(q.field('isActive'), true))
      .first()
  },
})

// ── Phase 24 versioning control surface (PRM-03, PRM-04) ─────────────────────

/**
 * saveVersion (PRM-03) — immutable versioning.
 *
 * Computes the next version number for (workspace_id, agentKey) and inserts a
 * NEW row. Never patches/overwrites an existing version. The new version is NOT
 * auto-activated (isActive: false) — activation is an explicit, guarded step.
 * Emits an audit_log row with action 'prompt_version.saved'.
 */
export const saveVersion = mutation({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
    content: v.string(),
    createdBy: v.optional(v.string()),
    note: v.optional(v.string()),
    // Phase 50 (WBN-04, D-13) ADD — additive/optional "why this draft
    // exists" back-reference (docs/API_CONTRACTS.md §4A.2c). Omitted on
    // every save NOT initiated from the inspector's "Improve this agent"
    // deep link — the overwhelmingly common case.
    originRef: v.optional(
      v.object({
        runId: v.string(),
        sectionName: v.string(),
        excerpt: v.string(),
        issueNumber: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { workspace_id, agentKey, content, createdBy, note, originRef }) => {
    // Phase 29 D-1: dashboard-only mutation — Clerk identity required. The
    // audit row uses the VERIFIED actor from the JWT, not the caller-supplied
    // `createdBy` (kept as free-text row metadata only).
    const actor = await requireOperator(ctx)

    const rows = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey),
      )
      .collect()

    const maxVersion = rows.length ? Math.max(...rows.map(r => r.version)) : 0
    const nextVersion = maxVersion + 1

    const id = await ctx.db.insert('prompt_versions', {
      workspace_id,
      agentKey,
      version: nextVersion,
      content,
      isActive: false,
      createdAt: Date.now(),
      createdBy,
      note,
      ...(originRef !== undefined ? { originRef } : {}),
    })

    await ctx.runMutation(internal.auditLog.write, {
      workspace_id,
      actorId: actor,
      action: 'prompt_version.saved',
      resourceType: 'prompt_version',
      resourceId: `${agentKey}:${nextVersion}`,
      after: JSON.stringify({ agentKey, version: nextVersion }),
    })

    return id
  },
})

/**
 * activate (PRM-04) — flip exactly one version active, guarded by in-progress
 * runs AND (Phase 38 §38.3, EVL-03) an eval-gate on target-metric-up-with-no-
 * regressions.
 *
 * D-02 in-progress guard: if any run in this workspace has status === 'running',
 * activation is blocked (no isActive flip) and a { blocked: true, reason } is
 * returned. This guard runs FIRST and is NEVER bypassable — not even by
 * `override`.
 *
 * §38.3 eval gate: when there IS a currently-active version for this agentKey
 * (and it differs from the target — reactivating the already-active version
 * is a no-op with nothing to regress against), the target version must have a
 * FRESH eval_scores row and must not regress vs the active version's scores
 * (see evaluateEvalGate). First-ever activation always passes (nothing to
 * regress against). A red gate can be bypassed by supplying
 * `override: { reason }` — this ONLY skips the eval gate, never the
 * in-progress guard — and writes an ADDITIONAL `prompt_version.activate_override`
 * audit row (alongside, not instead of, the normal `prompt_version.activated`
 * row — "nothing silent").
 *
 * Otherwise: every currently-active row is set isActive:false, the target
 * version is set isActive:true, and an audit_log row with action
 * 'prompt_version.activated' is emitted. Rollback is just activate(olderVersion).
 */
export const activate = mutation({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
    version: v.number(),
    actorId: v.string(),
    override: v.optional(v.object({ reason: v.string() })),
  },
  handler: async (ctx, { workspace_id, agentKey, version, actorId: _actorId, override }) => {
    // Phase 49 §49.4 (ROL-01/ROL-02): dashboard-only mutation gated to
    // Editor-in-chief. The audit row uses the VERIFIED actor from the JWT;
    // the caller-supplied `actorId` arg is intentionally ignored (never
    // trust an incoming arg for identity/attribution) but stays in the
    // signature for compatibility.
    const actor = await requireEditor(ctx)

    // D-02: block activation while a run is in progress. This guard always
    // wins — it is checked BEFORE the eval gate and is never bypassed by
    // `override` (§38.3).
    const runningRun = await ctx.db
      .query('runs')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .filter(q => q.eq(q.field('status'), 'running'))
      .first()

    if (runningRun) {
      return {
        blocked: true,
        reason:
          'A run is in progress — activation will be available when it finishes.',
      }
    }

    const rows = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey),
      )
      .collect()

    const previousActive = rows.find(r => r.isActive)?.version

    const target = rows.find(r => r.version === version)
    if (!target) {
      throw new Error(
        `prompt_versions: no version ${version} for agentKey '${agentKey}' in workspace '${workspace_id}'`,
      )
    }

    // §38.3 eval gate — only applies when there's a DIFFERENT currently-active
    // version to regress against. No active version (first-ever activation)
    // or reactivating the already-active version both skip the gate.
    let overridden = false
    if (previousActive !== undefined && previousActive !== version) {
      const gate = await evaluateEvalGate(ctx, {
        workspace_id,
        agentKey,
        targetVersion: version,
        targetCreatedAt: target.createdAt,
        activeVersion: previousActive,
      })

      if (gate.blocked) {
        if (override?.reason) {
          overridden = true
        } else {
          return { blocked: true, reason: gate.reason }
        }
      }
    }

    // Deactivate any currently-active rows, then activate the target.
    for (const row of rows) {
      if (row.isActive && row._id !== target._id) {
        await ctx.db.patch(row._id, { isActive: false })
      }
    }
    await ctx.db.patch(target._id, { isActive: true })

    if (overridden && override) {
      // "Nothing silent" — logged ALONGSIDE (not instead of) the normal
      // activated row below, per §38.3.
      //
      // Phase 43 §43.7 (D-11/D-13): routed through the ONE shared
      // decision-write helper — the override reason is promoted from
      // after-JSON into the structured `reason` field, alongside
      // `instructionVersion`, so this row projects uniformly through
      // auditLog.listDecisions.
      await ctx.runMutation(internal.auditLog.writeDecision, {
        workspace_id,
        actorId: actor,
        action: 'prompt_version.activate_override',
        resourceType: 'prompt_version',
        resourceId: `${agentKey}:${version}`,
        after: JSON.stringify({ agentKey, version, reason: override.reason }),
        reason: override.reason,
        instructionVersion: String(version),
      })
    }

    await ctx.runMutation(internal.auditLog.write, {
      workspace_id,
      actorId: actor,
      action: 'prompt_version.activated',
      resourceType: 'prompt_version',
      resourceId: `${agentKey}:${version}`,
      before: JSON.stringify({ agentKey, previousActive }),
      after: JSON.stringify({ agentKey, version }),
    })

    return overridden ? { blocked: false, overridden: true } : { blocked: false }
  },
})

/**
 * listForAgent (PRM-04) — all versions for an agent, newest-first.
 */
export const listForAgent = query({
  args: { workspace_id: v.string(), agentKey: v.string() },
  handler: async (ctx, { workspace_id, agentKey }) => {
    const rows = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey),
      )
      .collect()

    return rows.sort((a, b) => b.version - a.version)
  },
})

/**
 * listActiveForWorkspace (quick 260624-4ru) — one active row per agentKey.
 *
 * Additive read for the view-first /prompts list cards: collects every row in
 * the workspace via the `by_workspace` index, filters to isActive === true, and
 * returns one compact row per agentKey shaped for list previews. The seed
 * guarantees exactly one active row per key; if duplicates ever exist we keep
 * the FIRST active row encountered per agentKey (defensive). `updatedAt` maps to
 * `createdAt` — the prompt_versions table has no separate updatedAt field, and
 * createdAt is the version's timestamp.
 */
export const listActiveForWorkspace = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const rows = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()

    const byKey = new Map<
      string,
      { agentKey: string; version: number; content: string; updatedAt: number }
    >()
    for (const row of rows) {
      if (!row.isActive) continue
      if (byKey.has(row.agentKey)) continue
      byKey.set(row.agentKey, {
        agentKey: row.agentKey,
        version: row.version,
        content: row.content,
        updatedAt: row.createdAt,
      })
    }

    return Array.from(byKey.values())
  },
})

/**
 * listSeedV1ForWorkspace (Phase 28, PRC-02) — one v1 SEED row per agentKey.
 *
 * Additive drift oracle for the /prompts console. Collects every row in the
 * workspace via the `by_workspace` index, keeps only `version === 1` (the
 * Phase 22 seed, which persists because saveVersion increments and never
 * overwrites v1), and returns a compact `{ agentKey, content }[]`.
 *
 * A key has DRIFTED when its active content (listActiveForWorkspace) differs
 * from its v1 seed content (this query) — a pure content compare that stays
 * exact even after a rollback re-activates v1 (D-10). If duplicate v1 rows
 * ever exist we keep the FIRST encountered per agentKey (defensive).
 */
export const listSeedV1ForWorkspace = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => {
    const rows = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .collect()

    const byKey = new Map<string, { agentKey: string; content: string }>()
    for (const row of rows) {
      if (row.version !== 1) continue
      if (byKey.has(row.agentKey)) continue
      byKey.set(row.agentKey, { agentKey: row.agentKey, content: row.content })
    }

    return Array.from(byKey.values())
  },
})

/**
 * getByVersion (PRM-04) — fetch one exact version via the compound index.
 */
export const getByVersion = query({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { workspace_id, agentKey, version }) => {
    const row = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey_version', q =>
        q
          .eq('workspace_id', workspace_id)
          .eq('agentKey', agentKey)
          .eq('version', version),
      )
      .first()

    return row ?? null
  },
})
