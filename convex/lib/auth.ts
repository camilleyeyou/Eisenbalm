/**
 * Phase 29 — D-1: Shared Convex authorization guards.
 *
 * Three caller lanes reach Convex mutations in this project (29-RESEARCH.md):
 *   A. Browser (dispatch-control, Clerk-authenticated) — `ctx.auth.getUserIdentity()`
 *      returns the real Clerk identity (JWT forwarded via ConvexProviderWithClerk).
 *   B. FastAPI pipeline (admin deploy-key HTTP client, `/api/mutation`) —
 *      `ctx.auth.getUserIdentity()` returns `null`; the deploy key is not a
 *      recognized JWT provider. The pipeline instead sends a shared secret
 *      argument on every mutation call (packages/pipeline/.../convex_client.py).
 *   C. Stripe webhook (apps/web, no Clerk installed) — also has no identity;
 *      sends a DIFFERENT shared secret argument (rotates independently of the
 *      pipeline's).
 *
 * These are PLAIN FUNCTIONS, not Convex functions — call them from inside a
 * mutation handler. They are not registered in the generated Convex API.
 *
 * IMPORTANT: never trust an incoming `actorId`/`workspace_id`-style argument
 * for identity. For the operator lane, the actor IS `identity.subject` from
 * the verified Clerk JWT.
 */
import type { MutationCtx } from '../_generated/server'
import { ConvexError } from 'convex/values'

/**
 * Constant-time string compare.
 *
 * Convex's default (V8) runtime has no `crypto.timingSafeEqual`, so this
 * XOR-accumulates char codes instead of a short-circuiting `===`/`!==`
 * compare (which leaks timing information proportional to the length of the
 * matching prefix — the same class of bug `hmac.compare_digest` closes on
 * the Python/pipeline side, per 29-RESEARCH.md).
 *
 * Returns false immediately on a length mismatch. This does not reintroduce
 * a timing side-channel of practical concern here: secret length is not
 * itself sensitive (both secrets are fixed-length, generated values), only
 * the *contents* comparison needs to run in constant time.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Dashboard (operator) lane. Throws 'Unauthorized' when no Clerk identity is
 * present; otherwise returns `identity.subject` (the Clerk userId) to use as
 * the actor for attribution/audit — NEVER trust an incoming `actorId` arg.
 */
export async function requireOperator(ctx: MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthorized')
  return identity.subject
}

/**
 * Editor-in-chief lane (Phase 49 ROL-01/ROL-02). Sibling to requireOperator,
 * NOT a wrapper — both independently call getUserIdentity(). Fails CLOSED:
 * no identity OR role !== 'Editor-in-chief' both reject (Convex has no
 * local-dev sentinel; an absent/unmigrated role must never grant editor).
 */
export async function requireEditor(ctx: MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: 'unauthorized', message: 'Not authenticated' })
  if ((identity as { role?: string }).role !== 'Editor-in-chief') {
    throw new ConvexError({ code: 'forbidden_role', message: 'Editor-in-chief only.' })
  }
  return identity.subject
}

/**
 * Pipeline lane. Validates the `pipelineSecret` argument the FastAPI pipeline
 * sends on every outgoing mutation (injected centrally in
 * packages/pipeline/.../lib/convex_client.py::convex_mutation) against the
 * Convex-side `PIPELINE_CONVEX_SECRET` env var.
 *
 * Fails closed: an unset/blank env var, a missing `secret` argument, or a
 * mismatch all throw 'Unauthorized' — this must never silently allow a call
 * through just because the deployment hasn't been configured yet.
 */
export function requirePipelineSecret(secret?: string): void {
  const expected = process.env.PIPELINE_CONVEX_SECRET
  if (!expected || !secret || !constantTimeEqual(secret, expected)) {
    throw new Error('Unauthorized')
  }
}

/**
 * Dual lane. Two mutations (`pipelineConfig.upsert`, `charities.upsertCandidate`)
 * have two legitimate live callers: a Clerk-authenticated dashboard operator
 * AND the pipeline (admin deploy-key, no identity — e.g. `/pipeline/tick`'s
 * cron-driven config write, or the Scout registering a candidate). Accepts
 * EITHER a valid Clerk identity OR the correct pipeline secret; throws
 * 'Unauthorized' only when neither is present/valid.
 */
export async function requireOperatorOrPipeline(
  ctx: MutationCtx,
  secret?: string,
): Promise<{ actor: string; isPipeline: boolean }> {
  const identity = await ctx.auth.getUserIdentity()
  if (identity) return { actor: identity.subject, isPipeline: false }

  const expected = process.env.PIPELINE_CONVEX_SECRET
  if (expected && secret && constantTimeEqual(secret, expected)) {
    return { actor: 'pipeline', isPipeline: true }
  }
  throw new Error('Unauthorized')
}

/**
 * Webhook lane. Validates the `webhookSecret` argument
 * `apps/web/lib/stripe/handlers.ts` sends on `stripeEvents.claim` and
 * `stripeOrders.insert` against the Convex-side `STRIPE_TO_CONVEX_SECRET` env
 * var. This is a single-caller lane (only the Next.js Stripe webhook route
 * calls these two functions) so no identity/dual-lane branch is needed — just
 * the secret check, same fail-closed shape as `requirePipelineSecret`.
 */
export function requireWebhookSecret(secret: string): void {
  const expected = process.env.STRIPE_TO_CONVEX_SECRET
  if (!expected || !secret || !constantTimeEqual(secret, expected)) {
    throw new Error('Unauthorized')
  }
}
