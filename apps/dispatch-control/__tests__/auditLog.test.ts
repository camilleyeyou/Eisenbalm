/**
 * Phase 23 — AUD-01: auditLog Convex integration tests.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Tests the auditLog mutation/query contract:
 *   write → inserts a row with timestamp injected server-side
 *   listForWorkspace → returns rows newest-first
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { internal, api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

describe('auditLog: write + listForWorkspace', () => {
  it('inserts a row with timestamp and retrieves it', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'user_clerk123',
      action: 'dashboard.viewed',
      resourceType: 'run',
      resourceId: 'run-001',
    })

    const rows = await t.query(api.auditLog.listForWorkspace, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('dashboard.viewed')
    expect(rows[0].actorId).toBe('user_clerk123')
    expect(rows[0].resourceType).toBe('run')
    expect(rows[0].resourceId).toBe('run-001')
    expect(typeof rows[0].timestamp).toBe('number')
    expect(rows[0].timestamp).toBeGreaterThan(0)
  })

  it('returns rows newest-first', async () => {
    const t = convexTest({ schema, modules })

    // Insert two rows
    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'user_clerk123',
      action: 'config.updated',
    })

    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'user_clerk456',
      action: 'run.triggered',
    })

    const rows = await t.query(api.auditLog.listForWorkspace, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(2)
    // Newest first: run.triggered was inserted after config.updated
    expect(rows[0].action).toBe('run.triggered')
    expect(rows[1].action).toBe('config.updated')
  })

  it('respects the limit parameter', async () => {
    const t = convexTest({ schema, modules })

    for (let i = 0; i < 5; i++) {
      await t.mutation(internal.auditLog.write, {
        workspace_id: 'eisenbalm',
        actorId: 'system',
        action: `action.${i}`,
      })
    }

    const rows = await t.query(api.auditLog.listForWorkspace, {
      workspace_id: 'eisenbalm',
      limit: 3,
    })

    expect(rows).toHaveLength(3)
  })

  it('only returns rows for the requested workspace', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.auditLog.write, {
      workspace_id: 'workspace-a',
      actorId: 'user1',
      action: 'a.action',
    })

    await t.mutation(internal.auditLog.write, {
      workspace_id: 'workspace-b',
      actorId: 'user2',
      action: 'b.action',
    })

    const rowsA = await t.query(api.auditLog.listForWorkspace, {
      workspace_id: 'workspace-a',
    })
    expect(rowsA).toHaveLength(1)
    expect(rowsA[0].action).toBe('a.action')

    const rowsB = await t.query(api.auditLog.listForWorkspace, {
      workspace_id: 'workspace-b',
    })
    expect(rowsB).toHaveLength(1)
    expect(rowsB[0].action).toBe('b.action')
  })

  it('writes optional before/after JSON snapshots', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'user_clerk123',
      action: 'config.updated',
      resourceType: 'config',
      resourceId: 'schedule_enabled',
      before: '{"schedule_enabled":true}',
      after: '{"schedule_enabled":false}',
    })

    const rows = await t.query(api.auditLog.listForWorkspace, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].before).toBe('{"schedule_enabled":true}')
    expect(rows[0].after).toBe('{"schedule_enabled":false}')
  })
})
