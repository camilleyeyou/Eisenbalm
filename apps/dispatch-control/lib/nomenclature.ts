/**
 * Phase 50 (D-06) — the shared Workbench nomenclature source of truth.
 *
 * Introduces ONE module for the renamed System Workbench nav labels and the
 * §7 action-named Run Details steps, so later Phase 50 waves consume a
 * single source instead of scattering inline JSX strings (CONTEXT D-06,
 * extending the `prompt-lab/_components/agentList.ts` humanized-label
 * precedent).
 *
 * Sources (verbatim contracts — do not paraphrase):
 *   - docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md
 *     §Workbench nomenclature table + §Nav (WORKBENCH_NAV_LABELS)
 *   - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §7 (the 11
 *     action-named Run Details steps — RUN_STEP_MAP)
 *
 * This module is NOT wired into any screen by this plan (Wave 0 scaffolding
 * only) — Wave 1 plans (50-01..50-06) consume it.
 */
import { GATE_KEYS } from '../app/(dashboard)/run-monitor/graph/_components/pipelineTopology'

// ── nav labels ───────────────────────────────────────────────────────────────

/**
 * The renamed System Workbench nav labels + page headings (WBN-01), verbatim
 * from the binding nomenclature table:
 *   Run Monitor -> Run Details, Prompt Lab -> Agent Instructions,
 *   Eval Center -> Quality Tests, Registry -> Editorial Memory.
 *
 * Keyed by the UNCHANGED route-folder name (D-02 — routes are not renamed;
 * only the displayed label is).
 */
export const WORKBENCH_NAV_LABELS = {
  run_monitor: 'Run Details',
  prompt_lab: 'Agent Instructions',
  eval_center: 'Quality Tests',
  registry: 'Editorial Memory',
} as const

// ── run steps (§7) ──────────────────────────────────────────────────────────

export interface RunStep {
  /** Primary label — the action, per spec §7 (e.g. "Find story leads"). */
  actionLabel: string
  /** Secondary metadata — the agent/mechanism (e.g. "Signal Editor"). */
  agentLabel: string
  /** Renders as a marigold diamond — derived from GATE_KEYS, never redefined. */
  isDeterministicCheck: boolean
  /** true = one of §7's 11 named steps; false = a supporting node rendered
   * with a plain fallback label, never claiming a §7 verbatim name. */
  named: boolean
}

type RunStepSource = Omit<RunStep, 'isDeterministicCheck'>

/**
 * §7's verbatim action/agent labels, keyed by pipeline node/agent key.
 *
 * `isDeterministicCheck` is deliberately NOT set here — it is derived below
 * from `GATE_KEYS` (pipelineTopology.ts), the single diamond source of
 * truth, so this module can never define a second, driftable diamond set.
 *
 * `calibrator` and `chronicler` have no §7 entry (RESEARCH Pitfall 5) — they
 * get their own agent name as both action and agent label, `named: false`.
 * `validate_sections` folds into "Draft sections" as the join point, also
 * `named: false` (RESEARCH Open Q #3) — it is NOT a separate visible step.
 * The seven parallel writers all collapse to the single §7 "Draft sections"
 * step (RESEARCH Pitfall 4).
 */
const RUN_STEP_SOURCE: Record<string, RunStepSource> = {
  calibrator: { actionLabel: 'Calibrator', agentLabel: 'Calibrator', named: false },
  signal_editor: { actionLabel: 'Find story leads', agentLabel: 'Signal Editor', named: true },
  scout: { actionLabel: 'Find organizations', agentLabel: 'Scout', named: true },
  verify_candidates: {
    actionLabel: 'Verify organizations',
    agentLabel: 'deterministic check',
    named: true,
  },
  advocate: { actionLabel: 'Make the case', agentLabel: 'Advocate', named: true },
  editor_gate_1: {
    actionLabel: 'Choose recommended story',
    agentLabel: 'Agent Editor',
    named: true,
  },
  chronicler: { actionLabel: 'Chronicler', agentLabel: 'Chronicler', named: false },
  researcher: { actionLabel: 'Research the issue', agentLabel: 'Researcher', named: true },
  verify_research: {
    actionLabel: 'Verify research',
    agentLabel: 'deterministic check',
    named: true,
  },
  // 7 parallel section writers — all collapse to ONE displayed §7 step.
  origin_story: { actionLabel: 'Draft sections', agentLabel: 'seven writing agents', named: true },
  problem: { actionLabel: 'Draft sections', agentLabel: 'seven writing agents', named: true },
  founder_bio: { actionLabel: 'Draft sections', agentLabel: 'seven writing agents', named: true },
  case_study: { actionLabel: 'Draft sections', agentLabel: 'seven writing agents', named: true },
  game: { actionLabel: 'Draft sections', agentLabel: 'seven writing agents', named: true },
  bonus: { actionLabel: 'Draft sections', agentLabel: 'seven writing agents', named: true },
  design: { actionLabel: 'Draft sections', agentLabel: 'seven writing agents', named: true },
  validate_sections: {
    actionLabel: 'Draft sections',
    agentLabel: 'section validation',
    named: false,
  },
  qa: { actionLabel: 'Check the draft', agentLabel: 'QA', named: true },
  editor_final: {
    actionLabel: 'Recommend publication',
    agentLabel: 'Agent Editor Final',
    named: true,
  },
  publisher: { actionLabel: 'Prepare publication', agentLabel: 'Publisher', named: true },
}

/**
 * The D-06/D-07 single source of truth: §7's verbatim action-name map, one
 * entry per pipeline node/agent key. `isDeterministicCheck` is derived from
 * `GATE_KEYS` at module-load time (never hand-duplicated).
 */
export const RUN_STEP_MAP: Record<string, RunStep> = Object.fromEntries(
  Object.entries(RUN_STEP_SOURCE).map(([key, step]) => [
    key,
    { ...step, isDeterministicCheck: GATE_KEYS.has(key) },
  ]),
)

/**
 * Deterministic Title-Case fallback for any key with no RUN_STEP_MAP entry —
 * mirrors `agentList.ts`'s `humanizeAgentKey`. Nothing ever renders blank.
 */
export function humanizeAgentKey(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Resolve the §7 run-step metadata for an agentKey, falling back to a
 * deterministic humanized label (still diamond-correct via GATE_KEYS) for
 * any key not in RUN_STEP_MAP.
 */
export function runStepFor(agentKey: string): RunStep {
  const known = RUN_STEP_MAP[agentKey]
  if (known) return known
  const fallback = humanizeAgentKey(agentKey)
  return {
    actionLabel: fallback,
    agentLabel: fallback,
    isDeterministicCheck: GATE_KEYS.has(agentKey),
    named: false,
  }
}

// ── renamed-term constants (WBN-05/D-14) ────────────────────────────────────

/**
 * Verbatim renamed terms for reuse by later sweep plans (50-01..50-06), so
 * every copy reference to these product terms points at one place instead of
 * being retyped ad hoc across components.
 */
export const PRODUCT_TERMS = {
  deterministicCheck: 'deterministic check',
  restartStep: 'Restart from this step',
  makeActive: 'Make active',
  restoreVersion: 'Restore version',
  qualityTest: 'Quality test',
  testChanges: 'Test changes',
  standardTestCase: 'Standard test case',
  previewNextRun: 'Preview next run',
  doNotUse: 'Do not use',
  mustFix: 'Must fix',
  humanApprovalRequired: 'Human approval required',
} as const

// ── "Restart from this step" honesty matrix (WBN-03, D-11/D-12) ────────────

/**
 * Phase 50 (WBN-03, D-11/D-12, docs/API_CONTRACTS.md §50.1,
 * 50-RESEARCH.md Pitfall 1) — of the 11 §7 Run Details steps, exactly 3
 * have a real "completed steps are reused, not re-paid" reuse primitive:
 *
 *   - the 7 section writers (LIVE, `POST /runs/{id}/agents/{key}/rerun`,
 *     `rerun_agent` — RerollButton already wires this)
 *   - `editor_gate_1`, ONLY when the run is genuinely paused at the Gate-1
 *     interrupt (LIVE, `POST /issues/{run_id}/adjudicate` — the Signal Desk
 *     adjudication surface)
 *   - `publisher` (LIVE, `POST /issues/{run_id}/publish-manual`, the Phase
 *     50 Clerk-guarded bridge around `_run_publisher` — §50.1)
 *
 * The other 8 (signal_editor, scout, verify_candidates, advocate,
 * researcher, verify_research, qa, editor_final) have NO reuse primitive —
 * they MUST render reserved-with-explanation (the InspectorFooter
 * RESERVED_CLASSES/disabledTitle pattern), never a blanket "Restart from
 * this step" claim. ONE source of truth — both RecoveryRail.tsx and
 * InspectorFooter.tsx consume this function so the two surfaces can never
 * drift out of sync with each other.
 */
export const RESTART_LIVE_WRITER_KEYS = new Set<string>([
  'origin_story',
  'problem',
  'founder_bio',
  'case_study',
  'game',
  'bonus',
  'design',
])

export type RestartAvailability = 'live' | 'reserved'

/**
 * Resolve whether "Restart from this step" is LIVE (a real reuse primitive
 * backs it) or RESERVED (no primitive exists — render disabled with an
 * honest explanation, never a false-live button) for a given pipeline
 * agentKey.
 *
 * `opts.isPausedAtGate1` must be supplied by the caller from the ACTUAL
 * paused-at-Gate-1 predicate (§37.4(c): `status === 'awaiting-review' &&
 * completedAt == null`) — this function never infers it, so a genuinely
 * FAILED run (not paused) always resolves `editor_gate_1` to RESERVED.
 */
export function restartAvailabilityFor(
  agentKey: string,
  opts: { isPausedAtGate1?: boolean } = {},
): RestartAvailability {
  if (RESTART_LIVE_WRITER_KEYS.has(agentKey)) return 'live'
  if (agentKey === 'editor_gate_1') return opts.isPausedAtGate1 ? 'live' : 'reserved'
  if (agentKey === 'publisher') return 'live'
  return 'reserved'
}
