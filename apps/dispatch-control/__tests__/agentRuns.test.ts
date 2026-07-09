/**
 * Phase 23 — OBS-03: agentRuns Convex integration tests.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Tests the agentRuns mutation/query contract:
 *   started → inserts/patches a row with status 'running'
 *   completed → patches the same row to status 'done' with costUsd/tokensIn/tokensOut
 *   byRunId → returns the row(s) for a run
 *   queueForRun → idempotently pre-populates queued rows
 *   failed → records failure with error string
 *   savePayload / payloadByRunIdAgentKey → I/O snapshot upsert + fetch
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { internal, api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

describe('agentRuns: started → completed → byRunId', () => {
  it('inserts a running row and patches to done', async () => {
    const t = convexTest({ schema, modules })

    const RUN_ID = 'test-run-001'
    const AGENT_KEY = 'scout'
    const WS_ID = 'eisenbalm'

    // started: inserts a row with status 'running'
    await t.mutation(internal.agentRuns.started, {
      workspace_id: WS_ID,
      runId: RUN_ID,
      agentKey: AGENT_KEY,
      startedAt: 1000000,
    })

    // completed: patches to 'done' with cost fields
    await t.mutation(internal.agentRuns.completed, {
      workspace_id: WS_ID,
      runId: RUN_ID,
      agentKey: AGENT_KEY,
      completedAt: 1010000,
      costUsd: 0.021,
      durationMs: 8400,
      tokensIn: 8200,
      tokensOut: 2100,
    })

    // byRunId: returns the row
    const rows = await t.query(api.agentRuns.byRunId, { runId: RUN_ID })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('done')
    expect(rows[0].costUsd).toBe(0.021)
    expect(rows[0].tokensIn).toBe(8200)
    expect(rows[0].tokensOut).toBe(2100)
    expect(rows[0].durationMs).toBe(8400)
    expect(rows[0].agentKey).toBe(AGENT_KEY)
  })
})

describe('agentRuns: retryCount (Phase 37 §37.1)', () => {
  it('stores retryCount when provided', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.agentRuns.started, {
      workspace_id: 'eisenbalm',
      runId: 'test-run-retry-001',
      agentKey: 'calibrator',
      startedAt: 1000000,
    })

    await t.mutation(internal.agentRuns.completed, {
      workspace_id: 'eisenbalm',
      runId: 'test-run-retry-001',
      agentKey: 'calibrator',
      completedAt: 1010000,
      costUsd: 0.01,
      durationMs: 5000,
      tokensIn: 100,
      tokensOut: 50,
      retryCount: 1,
    })

    const rows = await t.query(api.agentRuns.byRunId, { runId: 'test-run-retry-001' })
    expect(rows).toHaveLength(1)
    expect(rows[0].retryCount).toBe(1)
  })

  it('leaves retryCount undefined when omitted (legacy compat) and still upserts', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.agentRuns.completed, {
      workspace_id: 'eisenbalm',
      runId: 'test-run-retry-002',
      agentKey: 'scout',
      completedAt: 2010000,
      costUsd: 0.02,
      durationMs: 3000,
      tokensIn: 200,
      tokensOut: 80,
    })

    const rows = await t.query(api.agentRuns.byRunId, { runId: 'test-run-retry-002' })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('done')
    expect(rows[0].retryCount).toBeUndefined()
  })
})

describe('agentRuns: queueForRun', () => {
  it('pre-populates queued rows for all agentKeys', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.agentRuns.queueForRun, {
      workspace_id: 'eisenbalm',
      runId: 'test-run-002',
      agentKeys: ['calibrator', 'scout', 'advocate'],
    })

    const rows = await t.query(api.agentRuns.byRunId, { runId: 'test-run-002' })
    expect(rows).toHaveLength(3)
    expect(rows.every(r => r.status === 'queued')).toBe(true)
  })

  it('is idempotent — does not insert duplicate rows', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.agentRuns.queueForRun, {
      workspace_id: 'eisenbalm',
      runId: 'test-run-003',
      agentKeys: ['calibrator', 'scout'],
    })

    // Second call with overlapping keys
    await t.mutation(internal.agentRuns.queueForRun, {
      workspace_id: 'eisenbalm',
      runId: 'test-run-003',
      agentKeys: ['calibrator', 'advocate'],
    })

    const rows = await t.query(api.agentRuns.byRunId, { runId: 'test-run-003' })
    // calibrator appears once, scout once, advocate once = 3 total
    expect(rows).toHaveLength(3)
  })
})

describe('agentRuns: failed', () => {
  it('records a failure with error string', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.agentRuns.started, {
      workspace_id: 'eisenbalm',
      runId: 'test-run-004',
      agentKey: 'researcher',
      startedAt: 2000000,
    })

    await t.mutation(internal.agentRuns.failed, {
      workspace_id: 'eisenbalm',
      runId: 'test-run-004',
      agentKey: 'researcher',
      error: 'OpenRouter rate limit exceeded',
      completedAt: 2005000,
    })

    const rows = await t.query(api.agentRuns.byRunId, { runId: 'test-run-004' })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('failed')
    expect(rows[0].error).toBe('OpenRouter rate limit exceeded')
  })
})

describe('agentRuns: savePayload + payloadByRunIdAgentKey', () => {
  it('upserts I/O snapshot and retrieves on node click', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.agentRuns.savePayload, {
      workspace_id: 'eisenbalm',
      runId: 'test-run-005',
      agentKey: 'scout',
      inputSnapshot: '{"run_id":"test-run-005","style_brief":"..."}',
      outputSnapshot: '{"candidates":[{"name":"Test Charity"}]}',
    })

    const payload = await t.query(api.agentRuns.payloadByRunIdAgentKey, {
      runId: 'test-run-005',
      agentKey: 'scout',
    })
    expect(payload).not.toBeNull()
    expect(payload?.inputSnapshot).toContain('test-run-005')
    expect(payload?.outputSnapshot).toContain('Test Charity')
  })

  it('returns null when no payload exists', async () => {
    const t = convexTest({ schema, modules })

    const payload = await t.query(api.agentRuns.payloadByRunIdAgentKey, {
      runId: 'nonexistent-run',
      agentKey: 'scout',
    })
    expect(payload).toBeNull()
  })
})
