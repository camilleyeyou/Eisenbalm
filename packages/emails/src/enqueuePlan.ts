/**
 * Pure helper: decide whether to enqueue 8 email steps or skip them.
 *
 * Used by both the Convex internalMutation (server-side) and unit tests
 * (Node env, no Convex runtime). Keeping it pure makes the enqueue decision
 * trivially testable without a Convex mock.
 */

export interface OrderLike {
  customerEmail?: string | null
}

export interface EnqueuePlan {
  /** When true, all 8 steps should be marked skipped (EMAIL-09: no email address). */
  skip: boolean
  /** The steps to process (always 1-8). */
  steps: number[]
}

export function planEnqueue(order: OrderLike): EnqueuePlan {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8]
  return { skip: !order.customerEmail, steps }
}
