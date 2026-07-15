/**
 * Phase 41 — WSP-01: convex-test coverage for `issues.setLastVisitedStage`.
 *
 * Proves the mutation is the sole, operator-guarded, patch-only writer of
 * `issues.lastVisitedStage` (41-RESEARCH Pitfall 6):
 *   1. Patches lastVisitedStage on an existing row.
 *   2. Overwrites on a second call (idempotent last-write-wins).
 *   3. Is a strict no-op (does not throw, creates no row) when the
 *      issueNumber has no existing row.
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires import.meta.glob to resolve Convex modules at test time.
// This glob must be a literal in the calling file (Vite static analysis requirement).
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'

describe('issues.setLastVisitedStage (Phase 41 WSP-01)', () => {
  async function seedIssue(t: ReturnType<typeof convexTest>, issueNumber: number) {
    await t.run(async (ctx) => {
      await ctx.db.insert('issues', {
        workspace_id: WS,
        issueNumber,
        held: false,
        published: false,
        createdAt: Date.now(),
      })
    })
  }

  it('patches lastVisitedStage on an existing row', async () => {
    const t = convexTest({ schema, modules })
    await seedIssue(t, 7)

    await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.issues.setLastVisitedStage,
      { workspace_id: WS, issueNumber: 7, stage: 'voice' },
    )

    const row = await t.query(api.issues.byIssueNumber, {
      workspace_id: WS,
      issueNumber: 7,
    })
    expect(row?.lastVisitedStage).toBe('voice')
  })

  it('overwrites on a second call (idempotent last-write-wins)', async () => {
    const t = convexTest({ schema, modules })
    await seedIssue(t, 7)

    await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.issues.setLastVisitedStage,
      { workspace_id: WS, issueNumber: 7, stage: 'voice' },
    )
    await t.withIdentity({ subject: 'user_operator' }).mutation(
      api.issues.setLastVisitedStage,
      { workspace_id: WS, issueNumber: 7, stage: 'approval' },
    )

    const row = await t.query(api.issues.byIssueNumber, {
      workspace_id: WS,
      issueNumber: 7,
    })
    expect(row?.lastVisitedStage).toBe('approval')
  })

  it('is a no-op when the issue row is absent (no throw, no row created)', async () => {
    const t = convexTest({ schema, modules })

    await expect(
      t.withIdentity({ subject: 'user_operator' }).mutation(
        api.issues.setLastVisitedStage,
        { workspace_id: WS, issueNumber: 999, stage: 'story' },
      ),
    ).resolves.toBeNull()

    const row = await t.query(api.issues.byIssueNumber, {
      workspace_id: WS,
      issueNumber: 999,
    })
    expect(row).toBeNull()
  })

  it('rejects a call with no Clerk identity', async () => {
    const t = convexTest({ schema, modules })
    await seedIssue(t, 7)

    await expect(
      t.mutation(api.issues.setLastVisitedStage, {
        workspace_id: WS,
        issueNumber: 7,
        stage: 'draft',
      }),
    ).rejects.toThrow(/Unauthorized/)
  })
})
