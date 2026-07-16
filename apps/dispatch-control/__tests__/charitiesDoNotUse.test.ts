/**
 * Phase 43 — Plan 43-08 (TSK-06, 43-RESEARCH.md Pitfall 3): Do-not-use
 * reason-capture convex-test coverage.
 *
 * Runs in edge-runtime (convex-test requirement; registered in
 * vitest.config.ts).
 *
 * This is NET-NEW coverage, not a promotion: `charities.setStatus` today has
 * NO reason param and writes ZERO audit_log rows when blocklisting a charity
 * (docs/API_CONTRACTS.md §43.7). Pins:
 *   - blocklisting WITHOUT a reason throws
 *   - blocklisting WITH a reason patches status AND emits a structured
 *     `charity.blocklisted` decision row via the shared writeDecision helper
 *   - non-blocklist transitions (e.g. unblocklist back to 'candidate') do
 *     NOT require a reason and still work
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires a literal import.meta.glob in the calling file.
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'

async function seedCharity(t: ReturnType<typeof convexTest>, asOperator: ReturnType<typeof t.withIdentity>) {
  await asOperator.mutation(api.charities.upsertCandidate, {
    workspace_id: WS,
    name: 'The Quiet Foundation',
    website: 'https://quietfoundation.org',
    runId: 'run-001',
  })
  const rows = await asOperator.query(api.charities.listByWorkspace, {
    workspace_id: WS,
  })
  const charity = rows.find(r => r.name === 'The Quiet Foundation')
  if (!charity) throw new Error('Seed charity not found')
  return charity
}

describe('charities.setStatus — Do-not-use reason capture (TSK-06)', () => {
  it('throws when blocklisting with an empty/missing reason', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator', role: 'Editor-in-chief' })
    const charity = await seedCharity(t, asOperator)

    await expect(
      asOperator.mutation(api.charities.setStatus, {
        workspace_id: WS,
        charityId: charity._id,
        status: 'blocklisted',
      }),
    ).rejects.toThrow()

    await expect(
      asOperator.mutation(api.charities.setStatus, {
        workspace_id: WS,
        charityId: charity._id,
        status: 'blocklisted',
        reason: '   ',
      }),
    ).rejects.toThrow()
  })

  it('blocklisting with a reason patches status AND emits a charity.blocklisted decision row', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator', role: 'Editor-in-chief' })
    const charity = await seedCharity(t, asOperator)

    await asOperator.mutation(api.charities.setStatus, {
      workspace_id: WS,
      charityId: charity._id,
      status: 'blocklisted',
      reason: 'Financials could not be verified — see corrections log.',
    })

    const rows = await asOperator.query(api.charities.listByWorkspace, {
      workspace_id: WS,
    })
    const updated = rows.find(r => r._id === charity._id)
    expect(updated?.status).toBe('blocklisted')

    const decisions = await asOperator.query(api.auditLog.listDecisions, {
      workspace_id: WS,
    })
    const decision = decisions.find(d => d.action === 'charity.blocklisted')
    expect(decision).toBeDefined()
    expect(decision?.reason).toBe('Financials could not be verified — see corrections log.')
    expect(decision?.resourceType).toBe('charity')
    expect(decision?.resourceId).toBe(charity._id)
  })

  it('non-blocklist transitions (e.g. unblocklist back to candidate) do not require a reason', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator', role: 'Editor-in-chief' })
    const charity = await seedCharity(t, asOperator)

    await asOperator.mutation(api.charities.setStatus, {
      workspace_id: WS,
      charityId: charity._id,
      status: 'blocklisted',
      reason: 'Duplicate entry — see corrections log.',
    })

    // Unblocklist: back to 'candidate', NO reason supplied — must succeed.
    await asOperator.mutation(api.charities.setStatus, {
      workspace_id: WS,
      charityId: charity._id,
      status: 'candidate',
    })

    const rows = await asOperator.query(api.charities.listByWorkspace, {
      workspace_id: WS,
    })
    const updated = rows.find(r => r._id === charity._id)
    expect(updated?.status).toBe('candidate')
  })

  it('rejects a Collaborator-role identity with forbidden_role (Phase 49 ROL-01/ROL-02)', async () => {
    const t = convexTest({ schema, modules })
    const asOperator = t.withIdentity({ subject: 'user_operator', role: 'Editor-in-chief' })
    const charity = await seedCharity(t, asOperator)

    const asCollaborator = t.withIdentity({ subject: 'user_collab', role: 'Collaborator' })

    await expect(
      asCollaborator.mutation(api.charities.setStatus, {
        workspace_id: WS,
        charityId: charity._id,
        status: 'blocklisted',
        reason: 'Attempted by a non-editor identity.',
      }),
    ).rejects.toThrow(/forbidden_role|Editor-in-chief/)

    const rows = await asOperator.query(api.charities.listByWorkspace, {
      workspace_id: WS,
    })
    const unchanged = rows.find(r => r._id === charity._id)
    expect(unchanged?.status).toBe('candidate')
  })
})
