/**
 * Phase 49 Plan 05 (ROL-04) — functional convex-test for comments.
 *
 * Mirrors charityCorrections.test.ts's harness — a real convex-test
 * assertion, NOT source-presence alone. `comments` is a THIRD auth lane:
 * `add` accepts ANY authenticated identity (both Editor-in-chief AND
 * Collaborator can comment — commenting is the one write a Collaborator
 * may make, per D-12/D-13). `listByIssueNumber` is unguarded.
 *
 * comments must:
 *   - reject `add` when called WITHOUT any identity at all (comments still
 *     require SOME authenticated user, just not a specific role)
 *   - succeed for BOTH an Editor-in-chief identity AND a Collaborator
 *     identity (positive proof of ROL-04's one-write-a-collaborator-can-make)
 *   - insert `authorId` from the VERIFIED identity subject — never any
 *     client-supplied value
 *   - `listByIssueNumber` is unguarded (no identity needed to read) and
 *     returns rows oldest-first by createdAt
 *   - `stage` filter: rows added with stage='draft' are returned when
 *     stage='draft' is passed, and excluded otherwise
 */
import { describe, it, expect } from 'vitest'
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'

// convex-test requires a literal import.meta.glob in the calling file.
const modules = import.meta.glob('../../../convex/**/*.*s')

const WS = 'eisenbalm'
const ISSUE = 42

describe('comments (ROL-04)', () => {
  it('add throws without ANY identity', async () => {
    const t = convexTest({ schema, modules })

    await expect(
      t.mutation(api.comments.add, {
        workspace_id: WS,
        issueNumber: ISSUE,
        text: 'Should not be allowed.',
      }),
    ).rejects.toThrow()
  })

  it('add succeeds for an Editor-in-chief identity', async () => {
    const t = convexTest({ schema, modules })
    const asEditor = t.withIdentity({ subject: 'user_editor', role: 'Editor-in-chief' })

    const id = await asEditor.mutation(api.comments.add, {
      workspace_id: WS,
      issueNumber: ISSUE,
      text: 'Editor comment.',
    })
    expect(id).toBeTruthy()

    const rows = await t.query(api.comments.listByIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('Editor comment.')
    expect(rows[0].authorId).toBe('user_editor')
  })

  it('add ALSO succeeds for a Collaborator identity (the one write a Collaborator may make)', async () => {
    const t = convexTest({ schema, modules })
    const asCollaborator = t.withIdentity({ subject: 'user_collab', role: 'Collaborator' })

    const id = await asCollaborator.mutation(api.comments.add, {
      workspace_id: WS,
      issueNumber: ISSUE,
      text: 'Collaborator comment.',
    })
    expect(id).toBeTruthy()

    const rows = await t.query(api.comments.listByIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('Collaborator comment.')
    expect(rows[0].authorId).toBe('user_collab')
  })

  it('authorId comes from the verified identity, never any client-supplied value', async () => {
    const t = convexTest({ schema, modules })
    const asEditor = t.withIdentity({ subject: 'user_real', role: 'Editor-in-chief' })

    // No `authorId`-shaped argument is even accepted by the mutation's args
    // validator (it isn't part of §49.3's signature) — this proves the
    // stored row's authorId can ONLY come from ctx.auth.getUserIdentity().
    await asEditor.mutation(api.comments.add, {
      workspace_id: WS,
      issueNumber: ISSUE,
      text: 'Trust the server.',
    })

    const rows = await t.query(api.comments.listByIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].authorId).toBe('user_real')
  })

  it('listByIssueNumber is unguarded (no identity needed) and returns rows oldest-first', async () => {
    const t = convexTest({ schema, modules })
    const asEditor = t.withIdentity({ subject: 'user_editor', role: 'Editor-in-chief' })

    await asEditor.mutation(api.comments.add, {
      workspace_id: WS,
      issueNumber: ISSUE,
      text: 'First comment.',
    })
    await asEditor.mutation(api.comments.add, {
      workspace_id: WS,
      issueNumber: ISSUE,
      text: 'Second comment.',
    })

    // No withIdentity() at all on this call — proves the read is unguarded.
    const rows = await t.query(api.comments.listByIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE,
    })

    expect(rows).toHaveLength(2)
    expect(rows[0].text).toBe('First comment.')
    expect(rows[1].text).toBe('Second comment.')
    expect(rows[0].createdAt).toBeLessThanOrEqual(rows[1].createdAt)
  })

  it('stage filter: rows added with stage=draft are returned when stage=draft is passed, excluded otherwise', async () => {
    const t = convexTest({ schema, modules })
    const asEditor = t.withIdentity({ subject: 'user_editor', role: 'Editor-in-chief' })

    await asEditor.mutation(api.comments.add, {
      workspace_id: WS,
      issueNumber: ISSUE,
      stage: 'draft',
      text: 'Draft-stage comment.',
    })
    await asEditor.mutation(api.comments.add, {
      workspace_id: WS,
      issueNumber: ISSUE,
      stage: 'voice',
      text: 'Voice-stage comment.',
    })
    await asEditor.mutation(api.comments.add, {
      workspace_id: WS,
      issueNumber: ISSUE,
      text: 'No-stage (overview) comment.',
    })

    const draftRows = await t.query(api.comments.listByIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE,
      stage: 'draft',
    })
    expect(draftRows).toHaveLength(1)
    expect(draftRows[0].text).toBe('Draft-stage comment.')

    const allRows = await t.query(api.comments.listByIssueNumber, {
      workspace_id: WS,
      issueNumber: ISSUE,
    })
    expect(allRows).toHaveLength(3)
  })
})
