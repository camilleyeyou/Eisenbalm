/**
 * Phase 36 — Plan 36-01: Convex-mutation-level regression guard for the
 * closed-union silent-drop failure (36-RESEARCH.md Pitfall 1).
 *
 * `convex_mutation_safe` (the pipeline's write path) swallows ANY exception
 * and only logs a warning — a Convex ArgumentValidationError from an unknown
 * `axis` literal never surfaces as a pipeline failure, it just silently
 * drops the finding. This test proves the fix at the REAL mutation boundary
 * (not a Python-only unit test on the predicate), per API_CONTRACTS.md §36.1.
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

const RUN_ID = 'run-voice-pass-axis-36'

async function insertWithAxis(t: ReturnType<typeof convexTest>, axis: string) {
  // `insert` is the public GAM-05 exception — no pipeline secret needed.
  return await t.mutation(api.qaCorrections.insert, {
    runId: RUN_ID,
    agentId: 'qa',
    sectionName: 'origin_story',
    reason: 'Machine-tell lexicon hit: "delve"',
    severity: 'error',
    accepted: false,
    axis: axis as never,
    quotedSpan: 'delve',
    suggestedFix: 'dig into',
  })
}

describe('Phase 36 — qaCorrections axis union gains machine-tell (36-01)', () => {
  it("insert with axis: 'machine-tell' succeeds and round-trips through byRunId", async () => {
    const t = convexTest({ schema, modules })

    await insertWithAxis(t, 'machine-tell')

    const rows = await t.query(api.qaCorrections.byRunId, { runId: RUN_ID })
    expect(rows).toHaveLength(1)
    expect(rows[0].axis).toBe('machine-tell')
  })

  it("insert with axis: 'structural-variety' also succeeds (closes the pre-existing Phase 18 gap)", async () => {
    const t = convexTest({ schema, modules })

    await insertWithAxis(t, 'structural-variety')

    const rows = await t.query(api.qaCorrections.byRunId, { runId: RUN_ID })
    expect(rows).toHaveLength(1)
    expect(rows[0].axis).toBe('structural-variety')
  })

  it("insert with an unrecognized axis still REJECTS (the union stays closed)", async () => {
    const t = convexTest({ schema, modules })

    await expect(insertWithAxis(t, 'not-a-real-axis')).rejects.toThrow()
  })
})
