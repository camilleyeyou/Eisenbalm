/**
 * Phase 39 Plan 01 (MEM-02) — functional convex-test for charityCorrections.
 *
 * Runs in edge-runtime (convex-test requirement; registered in vitest.config.ts).
 * Mirrors saveVersion.test.ts's harness — a real requireOperator-gated mutation
 * assertion, NOT source-presence alone (plan-review Warning 3).
 *
 * charityCorrections must:
 *   - reject `append` when called WITHOUT an operator identity (requireOperator
 *     gate is real, not just present in source)
 *   - insert a charity_corrections row AND an audit_log row (action
 *     'charity_correction.added') when called WITH an operator identity
 *   - `listByCharityKey` returns only rows for the given (workspace_id,
 *     charityKey) in createdAt-ascending (insertion) order, excluding rows
 *     under a different charityKey
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires a literal import.meta.glob in the calling file.
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const KEY = 'the quiet foundation|quietfoundation.org'
const OTHER_KEY = 'a different charity|other.org'

describe('charityCorrections (MEM-02)', () => {
  it('append throws without an operator identity', async () => {
    const t = convexTest({ schema, modules })

    await expect(
      t.mutation(api.charityCorrections.append, {
        workspace_id: WS,
        charityKey: KEY,
        text: 'Should not be allowed.',
      }),
    ).rejects.toThrow()
  })

  it('append (with operator identity) inserts a row and an audit_log row', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.charityCorrections.append, {
      workspace_id: WS,
      charityKey: KEY,
      text: 'Founder left the org in 2024 — confirm before citing them.',
    })

    const rows = await t.run(async ctx =>
      ctx.db
        .query('charity_corrections')
        .withIndex('by_workspace_charityKey', q =>
          q.eq('workspace_id', WS).eq('charityKey', KEY),
        )
        .collect(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('Founder left the org in 2024 — confirm before citing them.')
    expect(rows[0].author).toBe('user_operator')

    const audit = await t.run(async ctx =>
      ctx.db
        .query('audit_log')
        .withIndex('by_workspace', q => q.eq('workspace_id', WS))
        .collect(),
    )
    expect(audit.some(r => r.action === 'charity_correction.added')).toBe(true)
  })

  it('listByCharityKey returns only rows for the given charityKey, createdAt-ascending', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator' })

    await asOperator.mutation(api.charityCorrections.append, {
      workspace_id: WS,
      charityKey: KEY,
      text: 'First correction.',
    })
    await asOperator.mutation(api.charityCorrections.append, {
      workspace_id: WS,
      charityKey: KEY,
      text: 'Second correction.',
    })
    await asOperator.mutation(api.charityCorrections.append, {
      workspace_id: WS,
      charityKey: OTHER_KEY,
      text: 'Correction for a different charity.',
    })

    const rows = await t.query(api.charityCorrections.listByCharityKey, {
      workspace_id: WS,
      charityKey: KEY,
    })

    expect(rows).toHaveLength(2)
    expect(rows[0].text).toBe('First correction.')
    expect(rows[1].text).toBe('Second correction.')
    expect(rows[0].createdAt).toBeLessThanOrEqual(rows[1].createdAt)
    expect(rows.every(r => r.charityKey === KEY)).toBe(true)
  })
})
