/**
 * Phase 40 Plan 40-01 (§40.1/§40.2, ISS-01/ISS-04) — RED scaffold for the
 * `issues` Convex table: ensureByNumber idempotency (including the D-04
 * held-issue guard), hold/reopen (required-reason validation + audit_log
 * envelope), and markPublished.
 *
 * RED until Plan 40-02 implements `convex/issues.ts` per docs/API_CONTRACTS.md
 * §40.1/§40.2. Runs in edge-runtime (convex-test requirement; registered in
 * vitest.config.ts).
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires a literal import.meta.glob in the calling file.
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const ISSUE_NUMBER = 7

describe('issues (§40.1/§40.2, ISS-01/ISS-04)', () => {
  it('ensureByNumber inserts a row with held:false, published:false and returns { created: true }', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    const result = await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })

    expect(result).toEqual({ issueNumber: ISSUE_NUMBER, created: true })

    const row = await t.query(api.issues.byIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    expect(row?.held).toBe(false)
    expect(row?.published).toBe(false)
  })

  it('ensureByNumber called twice for the same issueNumber returns { created: false } the second time and leaves exactly ONE row', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    const second = await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })

    expect(second).toEqual({ issueNumber: ISSUE_NUMBER, created: false })

    const rows = await t.query(api.issues.listForWorkspace, { workspace_id: WS })
    expect(rows).toHaveLength(1)
  })

  it('D-04 guard: ensureByNumber on an already-held issue is a strict no-op — held/heldReason survive', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    await asOperator.mutation(api.issues.hold, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
      reason: 'Needs another source before this can run.',
    })

    // A stray/defensive pipeline call must NEVER resurrect a Held issue.
    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })

    const row = await t.query(api.issues.byIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    expect(row?.held).toBe(true)
    expect(row?.heldReason).toBe('Needs another source before this can run.')
  })

  it('hold with a blank/whitespace-only reason is rejected', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })

    await expect(
      asOperator.mutation(api.issues.hold, {
        workspace_id: WS,
        issueNumber: ISSUE_NUMBER,
        reason: '   ',
      }),
    ).rejects.toThrow(/reason is required/i)
  })

  it('hold with a real reason sets held/heldReason/heldBy/heldAt and writes an issue.held audit_log row', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    await asOperator.mutation(api.issues.hold, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
      reason: 'Charity site is down — verifying before publishing.',
    })

    const row = await t.query(api.issues.byIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    expect(row?.held).toBe(true)
    expect(row?.heldReason).toBe('Charity site is down — verifying before publishing.')
    expect(row?.heldBy).toBe('user_operator')
    expect(row?.heldAt).toBeGreaterThan(0)

    const audit = await t.query(api.auditLog.listForWorkspace, { workspace_id: WS })
    const heldRow = audit.find((r: { action: string }) => r.action === 'issue.held')
    expect(heldRow).toBeDefined()
    expect(heldRow?.resourceId).toBe(String(ISSUE_NUMBER))
  })

  it('reopen clears held/heldReason/heldBy/heldAt and writes an issue.reopened audit_log row', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    await asOperator.mutation(api.issues.hold, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
      reason: 'Pausing to double-check a claim.',
    })
    await asOperator.mutation(api.issues.reopen, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })

    const row = await t.query(api.issues.byIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    expect(row?.held).toBe(false)
    expect(row?.heldReason).toBeUndefined()
    expect(row?.heldBy).toBeUndefined()
    expect(row?.heldAt).toBeUndefined()

    const audit = await t.query(api.auditLog.listForWorkspace, { workspace_id: WS })
    expect(audit.some((r: { action: string }) => r.action === 'issue.reopened')).toBe(true)
  })

  it('hold without a Clerk identity throws Unauthorized', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })

    await expect(
      t.mutation(api.issues.hold, {
        workspace_id: WS,
        issueNumber: ISSUE_NUMBER,
        reason: 'Should not be allowed without an identity.',
      }),
    ).rejects.toThrow(/Unauthorized/)
  })

  it('markPublished sets published:true and publishedAt', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.issues.ensureByNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    await asOperator.mutation(api.issues.markPublished, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
      sanityIssueId: 'weeklyIssue-7',
    })

    const row = await t.query(api.issues.byIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE_NUMBER,
    })
    expect(row?.published).toBe(true)
    expect(row?.publishedAt).toBeGreaterThan(0)
  })
})
