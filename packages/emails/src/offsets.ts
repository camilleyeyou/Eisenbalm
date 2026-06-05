const DAY_MS = 24 * 3600_000

// Index 0 == step 1. Purchase-anchored offsets per 20-BRIEF.
export const OFFSETS_MS: readonly number[] = [
  0,             // E1 Order confirmation +0
  1 * DAY_MS,    // E2 Shipping +1d
  4 * DAY_MS,    // E3 Delivered estimate +4d
  7 * DAY_MS,    // E4 The ritual +7d
  9 * DAY_MS,    // E5 Charity receipt +9d
  14 * DAY_MS,   // E6 Review ask +14d
  21 * DAY_MS,   // E7 Newsletter opt-in +21d
  42 * DAY_MS,   // E8 Replenishment +42d
] as const

export type EmailStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const STEP_STREAM: Record<number, 'transactional' | 'marketing'> = {
  1: 'transactional',
  2: 'transactional',
  3: 'transactional',
  4: 'marketing',
  5: 'marketing',
  6: 'marketing',
  7: 'marketing',
  8: 'marketing',
}

export function isMarketingStep(step: number): boolean {
  return step >= 4
}

export function offsetForStep(step: number): number {
  return OFFSETS_MS[step - 1] as number
}
