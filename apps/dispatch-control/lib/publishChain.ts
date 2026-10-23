/**
 * Phase 52 HOME-07 — one-click Publish for the front door.
 *
 * Quick 261021-7aw: publishes with ONE call (publishIssue). Sign-offs are no
 * longer a prerequisite on the client or the server; the server
 * (review.py `_require_editor`) still gates role, hold and run status.
 *
 * NEVER call publish-manual (pipelineControlClient) here — that is the restart
 * path. Publish is non-idempotent, so callers must disable on first click.
 * Schedule-publish stays only on /issues/[n]/approval (DecisionRail) by design.
 */
import { SignOffApiError } from '@/lib/signOffClient'
import { publishIssue, ReviewApiError } from '@/lib/reviewClient'
import type { Role } from '@/lib/role'
import type { HomeFooter } from '@/lib/homeSections'

export const NETWORK_FAILURE_MESSAGE =
  "Publishing didn't go through, and nothing has reached readers. Press Publish again to try again. If it keeps happening, tell Andrew."
export const COLLABORATOR_LOCK_LABEL = 'Waiting for the editor-in-chief to publish.'
export const HELD_REASON = 'This issue is on hold. Release it to publish.'
export const PUBLISH_SLOW_MS = 75_000
export const PUBLISH_SLOW_NOTICE = 'Publishing is taking longer than usual. Nothing is lost. This page will update when it is done.'

export type PublishChainStep = 'publish'
export type PublishChainResult = { ok: true } | { ok: false; step: PublishChainStep; message: string }

function plain(e: unknown): string {
  return e instanceof SignOffApiError || e instanceof ReviewApiError ? e.message : NETWORK_FAILURE_MESSAGE
}

export async function publishChain(opts: {
  getToken: () => Promise<string | null>
  runId: string
}): Promise<PublishChainResult> {
  try {
    await publishIssue(await opts.getToken(), opts.runId)
  } catch (e) {
    return { ok: false, step: 'publish', message: plain(e) }
  }
  return { ok: true }
}

export type PublishGate =
  | { enabled: true }
  | { enabled: false; reason: 'not-ready' | 'loading' | 'role-unknown' | 'collaborator' | 'held' | 'busy' }

export function derivePublishGate(args: {
  footer: HomeFooter
  role: Role | undefined
  held: boolean | undefined
  busy: boolean
}): PublishGate {
  if (args.footer.kind !== 'ready') return { enabled: false, reason: 'not-ready' }
  if (args.busy) return { enabled: false, reason: 'busy' }
  if (args.held === undefined) return { enabled: false, reason: 'loading' }
  if (args.held) return { enabled: false, reason: 'held' }
  if (args.role === undefined) return { enabled: false, reason: 'role-unknown' }
  // A Collaborator cannot publish (server enforces Editor-in-chief too).
  if (args.role !== 'Editor-in-chief') return { enabled: false, reason: 'collaborator' }
  return { enabled: true }
}
