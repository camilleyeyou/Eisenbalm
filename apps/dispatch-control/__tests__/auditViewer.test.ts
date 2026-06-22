/**
 * Phase 23 — AUD-01: auditViewer Convex integration tests.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Validates the AUD-01 row shape: actor + timestamp + action + before/after.
 * Uses internal.auditLog.write to insert a row, then asserts the shape
 * returned by api.auditLog.listForWorkspace.
 *
 * This validates the audit-log infrastructure that the AuditLogViewer
 * component reads from — ensuring the row shape is correct before the
 * viewer wires in Phases 24-26 emissions.
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { internal, api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

describe('auditViewer: AUD-01 row shape validation', () => {
  it('write + listForWorkspace returns row with action and numeric timestamp', async () => {
    const t = convexTest({ schema, modules })

    // Write the dashboard.viewed event as described in the plan spec
    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'user_x',
      action: 'dashboard.viewed',
      before: undefined,
      after: undefined,
    })

    const rows = await t.query(api.auditLog.listForWorkspace, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('dashboard.viewed')
    // AUD-01: timestamp must be a numeric (server-side Date.now())
    expect(typeof rows[0].timestamp).toBe('number')
    expect(rows[0].timestamp).toBeGreaterThan(0)
  })

  it('row shape includes actor + timestamp + action + optional before/after', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'user_operator',
      action: 'config.schedule_enabled.changed',
      resourceType: 'config',
      resourceId: 'schedule_enabled',
      before: '{"schedule_enabled":true}',
      after: '{"schedule_enabled":false}',
    })

    const rows = await t.query(api.auditLog.listForWorkspace, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(1)
    const row = rows[0]

    // All AUD-01 required fields present
    expect(row.actorId).toBe('user_operator')
    expect(row.action).toBe('config.schedule_enabled.changed')
    expect(typeof row.timestamp).toBe('number')
    expect(row.timestamp).toBeGreaterThan(0)

    // Optional before/after JSON snapshots
    expect(row.before).toBe('{"schedule_enabled":true}')
    expect(row.after).toBe('{"schedule_enabled":false}')
    expect(row.resourceType).toBe('config')
    expect(row.resourceId).toBe('schedule_enabled')
  })

  it('listForWorkspace returns rows newest-first', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'user_x',
      action: 'first.action',
    })

    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'user_x',
      action: 'second.action',
    })

    const rows = await t.query(api.auditLog.listForWorkspace, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(2)
    // Newest-first: second.action inserted after first.action
    expect(rows[0].action).toBe('second.action')
    expect(rows[1].action).toBe('first.action')
  })
})
