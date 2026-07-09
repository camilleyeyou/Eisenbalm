/**
 * Phase 36 (§36.3, Plan 36-04 Task 2) — the Voice/factual axis partition.
 *
 * Voice Pass lights findings whose axis is in `VOICE_AXES`; the Review Desk
 * galley lights findings whose axis is in `FACTUAL_AXES`. Per §36.3, a
 * finding whose axis is `undefined`/absent (legacy rows, pre-Phase-5 shapes)
 * counts as FACTUAL for gating purposes (DecisionRail, Task 4) — the
 * conservative default so no finding is ever silently invisible to both
 * screens. `Galley`'s own `includeAxes` render filter (Task 2) is stricter
 * than that: ANY includeAxes whitelist omits an undefined-axis row (only
 * known-axis rows are ever whitelisted onto a specific surface); the
 * undefined-as-factual rule is applied one layer up, in DecisionRail's own
 * scoping (Task 4), not here.
 */

export const VOICE_AXES: ReadonlySet<string> = new Set([
  'gravity',
  'sentiment',
  'irony-signaling',
  'machine-tell',
])

export const FACTUAL_AXES: ReadonlySet<string> = new Set([
  'precision',
  'cross-section-consistency',
  'structural-variety',
  'hard-rule',
])
