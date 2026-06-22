/**
 * Phase 24 Wave 0 — RED tests for convex/promptVersions.saveVersion (PRM-03).
 *
 * Runs in edge-runtime (convex-test requirement; registered in vitest.config.ts).
 *
 * saveVersion must:
 *   - create v2 when v1 exists, NEVER overwriting v1
 *   - start at v1 when no prior version exists
 *   - insert the new row with isActive === false
 *   - emit an audit_log row with action 'prompt_version.saved'
 *
 * RED until Plan 02 lands convex/promptVersions.saveVersion. `api.promptVersions.saveVersion`
 * is undefined until then, so each `t.mutation(api.promptVersions.saveVersion, …)` throws —
 * the intended RED. The file import-executes (no top-level access of the missing symbol),
 * so vitest discovers all cases.
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires a literal import.meta.glob in the calling file.
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const AGENT = 'scout'

describe('promptVersions.saveVersion (PRM-03)', () => {
  it('creates v2 when v1 exists and never overwrites v1', async () => {
    const t = convexTest({ schema, modules })

    // Seed v1 active via the existing Phase-22 seed mutation.
    await t.mutation(api.promptVersions.upsertActive, {
      workspace_id: WS,
      agentKey: AGENT,
      content: 'V1 BODY',
      note: 'v1 seed',
    })

    await t.mutation(api.promptVersions.saveVersion, {
      workspace_id: WS,
      agentKey: AGENT,
      content: 'V2 BODY',
      createdBy: 'user_operator',
      note: 'second edit',
    })

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('prompt_versions')
        .withIndex('by_workspace_agentKey', (q) =>
          q.eq('workspace_id', WS).eq('agentKey', AGENT),
        )
        .collect(),
    )

    const v1 = rows.find((r) => r.version === 1)
    const v2 = rows.find((r) => r.version === 2)

    expect(v1).toBeDefined()
    expect(v1!.content).toBe('V1 BODY') // unchanged — never overwritten
    expect(v2).toBeDefined()
    expect(v2!.content).toBe('V2 BODY')
    expect(v2!.isActive).toBe(false) // new version is NOT auto-activated
  })

  it('saveVersion starts at v1 when no prior version', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(api.promptVersions.saveVersion, {
      workspace_id: WS,
      agentKey: 'advocate',
      content: 'FIRST',
    })

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('prompt_versions')
        .withIndex('by_workspace_agentKey', (q) =>
          q.eq('workspace_id', WS).eq('agentKey', 'advocate'),
        )
        .collect(),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].version).toBe(1)
  })

  it('saveVersion writes an audit_log row with action prompt_version.saved', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(api.promptVersions.saveVersion, {
      workspace_id: WS,
      agentKey: AGENT,
      content: 'BODY',
      createdBy: 'user_operator',
    })

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query('audit_log')
        .withIndex('by_workspace', (q) => q.eq('workspace_id', WS))
        .collect(),
    )

    expect(audit.some((r) => r.action === 'prompt_version.saved')).toBe(true)
  })
})
