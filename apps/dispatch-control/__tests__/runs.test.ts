/**
 * Phase 23 — OBS-02: runs Convex integration tests.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Tests the runs:listForWorkspace query contract:
 *   create → inserts a run row (server-side status + startedAt)
 *   listForWorkspace → returns all workspace runs newest-first
 *
 * Phase 29 D-1: runs.create is pipeline-lane secret-guarded — every call
 * passes the matching pipelineSecret (PIPELINE_CONVEX_SECRET stubbed below).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

const TEST_PIPELINE_SECRET = 'test-pipeline-secret'

describe('runs: listForWorkspace returns all runs newest-first', () => {
  const prevSecret = process.env.PIPELINE_CONVEX_SECRET

  beforeEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = TEST_PIPELINE_SECRET
  })

  afterEach(() => {
    process.env.PIPELINE_CONVEX_SECRET = prevSecret
  })

  it('returns both runs with newest first', async () => {
    const t = convexTest({ schema, modules })

    const WS_ID = 'eisenbalm'

    // Insert first run (older — startedAt will be Date.now() at mutation time)
    await t.mutation(api.runs.create, {
      workspace_id: WS_ID,
      runId: 'run-2024-01',
      triggerSource: 'cron',
      pipelineSecret: TEST_PIPELINE_SECRET,
    })

    // Small delay so the second run gets a later startedAt
    await new Promise(r => setTimeout(r, 2))

    // Insert second run (newer)
    await t.mutation(api.runs.create, {
      workspace_id: WS_ID,
      runId: 'run-2024-02',
      triggerSource: 'manual',
      triggeredBy: 'user_operator',
      pipelineSecret: TEST_PIPELINE_SECRET,
    })

    const runs = await t.query(api.runs.listForWorkspace, {
      workspace_id: WS_ID,
    })

    expect(runs).toHaveLength(2)
    // Newest first: run-2024-02 was inserted after run-2024-01
    expect(runs[0].runId).toBe('run-2024-02')
    expect(runs[1].runId).toBe('run-2024-01')
  })

  it('returns empty array when no runs exist for workspace', async () => {
    const t = convexTest({ schema, modules })

    const runs = await t.query(api.runs.listForWorkspace, {
      workspace_id: 'empty-workspace',
    })

    expect(runs).toHaveLength(0)
  })

  it('only returns runs for the requested workspace', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(api.runs.create, {
      workspace_id: 'workspace-a',
      runId: 'run-a-001',
      triggerSource: 'cron',
      pipelineSecret: TEST_PIPELINE_SECRET,
    })

    await t.mutation(api.runs.create, {
      workspace_id: 'workspace-b',
      runId: 'run-b-001',
      triggerSource: 'cron',
      pipelineSecret: TEST_PIPELINE_SECRET,
    })

    const runsA = await t.query(api.runs.listForWorkspace, {
      workspace_id: 'workspace-a',
    })
    expect(runsA).toHaveLength(1)
    expect(runsA[0].runId).toBe('run-a-001')

    const runsB = await t.query(api.runs.listForWorkspace, {
      workspace_id: 'workspace-b',
    })
    expect(runsB).toHaveLength(1)
    expect(runsB[0].runId).toBe('run-b-001')
  })
})
