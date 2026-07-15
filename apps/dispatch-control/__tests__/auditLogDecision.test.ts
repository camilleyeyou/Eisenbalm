/**
 * Phase 43 — Plan 43-02: audit_log decision substrate convex-test coverage.
 * Runs in edge-runtime environment (required by convex-test).
 *
 * Pins the TSK-06 substrate contract (docs/API_CONTRACTS.md §43.1-§43.4) RED
 * before implementation:
 *   writeDecision  -> inserts a structured decision row (reason REQUIRED)
 *   listDecisions  -> returns ONLY reason-bearing rows (structured `reason`
 *                      OR after-JSON `heldReason` fallback), newest-first,
 *                      runId-scopable — a plain `run.triggered` row (no
 *                      reason, no after) is excluded
 *   users.byClerkUserId -> resolves a Clerk sub to a users row, or null
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { internal, api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

describe('auditLog: writeDecision + listDecisions', () => {
  it('writeDecision inserts a row carrying reason/issueNumber/runId/instructionVersion', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.auditLog.writeDecision, {
      workspace_id: 'eisenbalm',
      actorId: 'user_operator',
      action: 'issue.held',
      resourceType: 'run',
      resourceId: 'run-001',
      reason: 'Waiting on charity confirmation',
      issueNumber: 42,
      runId: 'run-001',
      instructionVersion: 'v3',
    })

    const rows = await t.query(api.auditLog.listDecisions, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('issue.held')
    expect(rows[0].reason).toBe('Waiting on charity confirmation')
    expect(rows[0].issueNumber).toBe(42)
    expect(rows[0].runId).toBe('run-001')
    expect(rows[0].instructionVersion).toBe('v3')
  })

  it('excludes a plain non-reason row (e.g. run.triggered) from listDecisions', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.auditLog.writeDecision, {
      workspace_id: 'eisenbalm',
      actorId: 'user_operator',
      action: 'issue.held',
      reason: 'Held for review',
    })

    // No reason, no after JSON — a plain audit row, not a decision.
    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'pipeline',
      action: 'run.triggered',
    })

    const rows = await t.query(api.auditLog.listDecisions, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('issue.held')
  })

  it('legacy tolerance: an after-JSON heldReason row is included by listDecisions', async () => {
    const t = convexTest({ schema, modules })

    // Legacy-shaped row (predates Phase 43): no structured `reason`, the
    // reason lives inside the `after` JSON snapshot instead.
    await t.mutation(internal.auditLog.write, {
      workspace_id: 'eisenbalm',
      actorId: 'user_operator',
      action: 'run.held',
      after: JSON.stringify({ heldReason: 'Legacy hold reason' }),
    })

    const rows = await t.query(api.auditLog.listDecisions, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('run.held')
  })

  it('scopes to runId when provided, excluding a decision for a different runId', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.auditLog.writeDecision, {
      workspace_id: 'eisenbalm',
      actorId: 'user_operator',
      action: 'issue.held',
      reason: 'Reason A',
      runId: 'run-A',
    })

    await t.mutation(internal.auditLog.writeDecision, {
      workspace_id: 'eisenbalm',
      actorId: 'user_operator',
      action: 'issue.held',
      reason: 'Reason B',
      runId: 'run-B',
    })

    const rows = await t.query(api.auditLog.listDecisions, {
      workspace_id: 'eisenbalm',
      runId: 'run-A',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].reason).toBe('Reason A')
  })

  it('returns rows newest-first', async () => {
    const t = convexTest({ schema, modules })

    await t.mutation(internal.auditLog.writeDecision, {
      workspace_id: 'eisenbalm',
      actorId: 'user_operator',
      action: 'issue.held',
      reason: 'First',
    })

    await t.mutation(internal.auditLog.writeDecision, {
      workspace_id: 'eisenbalm',
      actorId: 'user_operator',
      action: 'issue.held',
      reason: 'Second',
    })

    const rows = await t.query(api.auditLog.listDecisions, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(2)
    expect(rows[0].reason).toBe('Second')
    expect(rows[1].reason).toBe('First')
  })
})

describe('auditLog: writeDecision retrofit (§43.7, D-11/D-13)', () => {
  it('issues.hold writes a decision row carrying structured reason + issueNumber, returned by listDecisions', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: 'eisenbalm',
      issueNumber: 42,
    })
    await asOperator.mutation(api.issues.hold, {
      workspace_id: 'eisenbalm',
      issueNumber: 42,
      reason: 'Charity site is down — verifying before publishing.',
    })

    const rows = await t.query(api.auditLog.listDecisions, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('issue.held')
    expect(rows[0].reason).toBe('Charity site is down — verifying before publishing.')
    expect(rows[0].issueNumber).toBe(42)
  })

  it('issues.reopen writes a decision row carrying a structured reason + issueNumber', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: 'eisenbalm',
      issueNumber: 42,
    })
    await asOperator.mutation(api.issues.hold, {
      workspace_id: 'eisenbalm',
      issueNumber: 42,
      reason: 'Pausing to double-check a claim.',
    })
    await asOperator.mutation(api.issues.reopen, {
      workspace_id: 'eisenbalm',
      issueNumber: 42,
    })

    const rows = await t.query(api.auditLog.listDecisions, {
      workspace_id: 'eisenbalm',
      issueNumber: 42,
    })

    const reopened = rows.find(r => r.action === 'issue.reopened')
    expect(reopened).toBeDefined()
    expect(reopened?.reason).toContain('Pausing to double-check a claim.')
    expect(reopened?.issueNumber).toBe(42)
  })

  it('charityCorrections.append writes a decision row carrying the correction text as reason', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.charityCorrections.append, {
      workspace_id: 'eisenbalm',
      charityKey: 'the quiet foundation|quietfoundation.org',
      text: 'Founder left the org in 2024 — confirm before citing them.',
    })

    const rows = await t.query(api.auditLog.listDecisions, {
      workspace_id: 'eisenbalm',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('charity_correction.added')
    expect(rows[0].reason).toBe('Founder left the org in 2024 — confirm before citing them.')
  })
})

describe('users: byClerkUserId', () => {
  it('resolves a users row for a known Clerk sub', async () => {
    const t = convexTest({ schema, modules })
    const asUser = t.withIdentity({ subject: 'user_operator' })

    await asUser.mutation(api.users.upsertCurrentUser, {
      email: 'andrew@example.com',
      displayName: 'Andrew',
    })

    const row = await t.query(api.users.byClerkUserId, {
      workspace_id: 'eisenbalm',
      clerkUserId: 'user_operator',
    })

    expect(row).not.toBeNull()
    expect(row?.displayName).toBe('Andrew')
    expect(row?.email).toBe('andrew@example.com')
  })

  it('returns null for an unknown Clerk sub', async () => {
    const t = convexTest({ schema, modules })

    const row = await t.query(api.users.byClerkUserId, {
      workspace_id: 'eisenbalm',
      clerkUserId: 'user_does_not_exist',
    })

    expect(row).toBeNull()
  })
})
