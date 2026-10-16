/**
 * Phase 52 HOME-07 — one-click Publish for the front door.
 *
 * Second caller of recordSignOff/publishIssue (after DecisionRail). It composes
 * the EXISTING endpoints; the server (signoffs.py / review.py `_require_editor`)
 * remains the authoritative gate. The client gate below is only ever stricter.
 *
 * NEVER call publish-manual (pipelineControlClient) here — that is the restart
 * path. Publish is non-idempotent, so callers must disable on first click.
 * Schedule-publish stays only on /issues/[n]/approval (DecisionRail) by design.
 */
import { recordSignOff, SignOffApiError, type SignOffKind } from '@/lib/signOffClient'
import { publishIssue, ReviewApiError } from '@/lib/reviewClient'
import type { Role } from '@/lib/role'
import type { HomeFooter } from '@/lib/homeSections'

export const NETWORK_FAILURE_MESSAGE = 'Couldn’t reach the server. Nothing was published — try again.'
export const COLLABORATOR_LOCK_LABEL = 'Collaborators can review and comment, not publish.'
export const HELD_REASON = 'This issue is held — release the hold to publish.'
export const PUBLISH_SLOW_MS = 75_000
export const PUBLISH_SLOW_NOTICE = 'Publishing is taking longer than usual — check Admin → Run Details.'

const SIGN_OFF_ORDER: readonly SignOffKind[] = ['facts-cleared', 'sounds-human']

export type PublishChainStep = SignOffKind | 'publish'
export type PublishChainResult = { ok: true } | { ok: false; step: PublishChainStep; message: string }

function plain(e: unknown): string {
  return e instanceof SignOffApiError || e instanceof ReviewApiError ? e.message : NETWORK_FAILURE_MESSAGE
}

export async function publishChain(opts: {
  getToken: () => Promise<string | null>
  runId: string
  activeSignOffs: Record<string, unknown>
}): Promise<PublishChainResult> {
  for (const kind of SIGN_OFF_ORDER) {
    if (opts.activeSignOffs[kind] !== undefined) continue
    try {
      await recordSignOff(await opts.getToken(), opts.runId, kind)
    } catch (e) {
      return { ok: false, step: kind, message: plain(e) }
    }
  }
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
  // A Collaborator never starts the chain: facts-cleared is not role-gated
  // server-side, so a click would leave a half-recorded sign-off.
  if (args.role !== 'Editor-in-chief') return { enabled: false, reason: 'collaborator' }
  return { enabled: true }
}
