'use client'
/**
 * Phase 50 Plan 05 (WBN-03, D-10/D-11/D-12) — the failed-run recovery rail.
 *
 * Mounted by `RunDetail.tsx` when a run has failed. Renders the four §7
 * plain-language sections (DERIVED-STATE-CONTRACT.md §7) in this order:
 *
 *   1. What happened          — the failed step (vermilion) + a plain reason
 *   2. What completed successfully — steps before the failure, by action name
 *   3. What did not happen    — downstream steps, dimmed, labeled "Skipped"
 *      (never blank — every downstream named step is listed explicitly)
 *   4. Recommended recovery   — the two bridge actions: Restart from this
 *      step + Improve this agent
 *
 * "Restart from this step" honesty (D-11/D-12, RESEARCH Pitfall 1): wired
 * through `lib/nomenclature.ts::restartAvailabilityFor` — the SAME function
 * `InspectorFooter.tsx` (Task 3) consumes, so the two surfaces can never
 * drift. LIVE for exactly 3 of the 11 §7 step-types (the 7 section writers
 * via `rerollAgent`/`rerun_agent`; `editor_gate_1` ONLY when the run is
 * genuinely paused at the Gate-1 interrupt, via the Signal Desk adjudication
 * surface; `publisher` via the Phase 50 `publishManual`/`publish-manual`
 * bridge, §50.1). The other 8 step-types render RESERVED — disabled, with an
 * honest explanation that never claims completed work is reused (that claim
 * — "reused, not re-paid" — is rendered ONLY in the LIVE branches below).
 *
 * "Improve this agent" deep-links `/prompt-lab/{promptKey}` via the SAME
 * `runKeyToPromptKey` resolver the inspector uses (`lib/inspectorArtifact.ts`,
 * §44.3) — honest degrade to a reserved control when the failed step has no
 * externalized prompt (e.g. `qa`), never a guessed link.
 */
import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { rerollAgent, publishManual } from '@/lib/pipelineControlClient'
import { runKeyToPromptKey } from '@/lib/inspectorArtifact'
import {
  runStepFor,
  restartAvailabilityFor,
  PRODUCT_TERMS,
  RESTART_LIVE_WRITER_KEYS,
} from '@/lib/nomenclature'
import { PIPELINE_NODES } from '../../graph/_components/pipelineTopology'

export interface RecoveryRailAgentRun {
  agentKey: string
  status: string
  error?: string
}

export interface RecoveryRailProps {
  runId: string
  agentRuns: RecoveryRailAgentRun[]
  /**
   * True ONLY when this specific run is genuinely paused at the Gate-1
   * interrupt (§37.4(c): `status === 'awaiting-review' && completedAt ==
   * null`) — NOT the same condition as a hard "failed" run. Supplied
   * explicitly by the caller so the honesty matrix never guesses; a failed
   * run (the rail's normal mount condition) always resolves `editor_gate_1`
   * to RESERVED since a failure and a pause are mutually exclusive states.
   * Defaults to false.
   */
  isPausedAtGate1?: boolean
}

interface NamedStep {
  /** Representative raw agentKey for this §7 step (the first topology key
   * mapping to this actionLabel — e.g. "origin_story" for "Draft sections"). */
  agentKey: string
  actionLabel: string
  agentLabel: string
}

/** The 11 §7 named steps, in pipeline order, deduped by actionLabel so the
 * 7 parallel writers collapse into ONE "Draft sections" entry (mirrors
 * RunDetail.tsx's buildStepGroups grouping). */
function namedStepSequence(): NamedStep[] {
  const seen = new Set<string>()
  const out: NamedStep[] = []
  for (const agentKey of PIPELINE_NODES) {
    const step = runStepFor(agentKey)
    if (!step.named) continue
    if (seen.has(step.actionLabel)) continue
    seen.add(step.actionLabel)
    out.push({ agentKey, actionLabel: step.actionLabel, agentLabel: step.agentLabel })
  }
  return out
}

/** First `agent_runs` row with status "failed", resolved in pipeline order
 * (deterministic even if the caller's array isn't topologically sorted). */
function findFailedAgentKey(agentRuns: RecoveryRailAgentRun[]): string | null {
  const failedKeys = new Set(agentRuns.filter(r => r.status === 'failed').map(r => r.agentKey))
  for (const key of PIPELINE_NODES) {
    if (failedKeys.has(key)) return key
  }
  return null
}

// Deliberately does NOT claim "completed steps are reused, not re-paid" —
// that copy is reserved for the 3 step-types with a real primitive (D-11/
// D-12). This step has none: a full pipeline re-run or an agent-instruction
// fix is the honest path forward.
const RESERVED_TITLE =
  'This step has no restart primitive yet — re-run the whole pipeline, or improve the agent and try again next run.'
const NOT_EXTERNALIZED_TITLE = "This agent's instructions are code-defined, not editable here."

const LIVE_BUTTON_CLASSES =
  'inline-flex min-h-[36px] items-center gap-1.5 rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[.03em] text-neutral-900 hover:bg-neutral-50'
const RESERVED_BUTTON_CLASSES =
  'inline-flex min-h-[36px] items-center gap-1.5 rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[.03em] text-neutral-400 cursor-not-allowed opacity-60'

function RestartAction({
  runId,
  agentKey,
  isPausedAtGate1,
}: {
  runId: string
  agentKey: string
  isPausedAtGate1: boolean
}) {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorText, setErrorText] = useState<string | null>(null)

  const availability = restartAvailabilityFor(agentKey, { isPausedAtGate1 })

  if (availability === 'reserved') {
    return (
      <div>
        <button type="button" disabled title={RESERVED_TITLE} className={RESERVED_BUTTON_CLASSES}>
          {PRODUCT_TERMS.restartStep}
        </button>
        <p className="mt-1 text-[11px] text-neutral-400">{RESERVED_TITLE}</p>
      </div>
    )
  }

  // LIVE — editor_gate_1's paused case routes to the Signal Desk
  // adjudication surface (the real candidate-slate picker lives there, not
  // here — this rail never re-implements it inline).
  if (agentKey === 'editor_gate_1') {
    return (
      <div>
        <Link href="/signal-desk" className={LIVE_BUTTON_CLASSES}>
          {PRODUCT_TERMS.restartStep}
        </Link>
        <p className="mt-1 text-[11px] text-neutral-500">
          Completed steps are reused, not re-paid — go to Signal Desk to choose the recommended
          story and resume.
        </p>
      </div>
    )
  }

  const isWriter = RESTART_LIVE_WRITER_KEYS.has(agentKey)
  const isPublisher = agentKey === 'publisher'

  async function handleRestart() {
    const confirmed = window.confirm(
      isPublisher
        ? 'Restart Prepare publication? This re-renders and re-publishes from the already-written draft.'
        : `Restart this step? This regenerates just this section; other completed sections are unchanged.`,
    )
    if (!confirmed) return

    setStatus('loading')
    setErrorText(null)
    try {
      const token = await getToken()
      if (isPublisher) {
        await publishManual(runId, token)
      } else {
        await rerollAgent(runId, agentKey, token)
      }
      setStatus('done')
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  if (status === 'done') {
    return <span className="text-xs text-green-600">Restarted ✓</span>
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRestart}
        disabled={status === 'loading'}
        className={LIVE_BUTTON_CLASSES}
      >
        {status === 'loading' ? 'Restarting…' : PRODUCT_TERMS.restartStep}
      </button>
      <p className="mt-1 text-[11px] text-neutral-500">
        Completed steps are reused, not re-paid — {isWriter ? 'sibling sections are' : 'upstream work is'}{' '}
        untouched.
      </p>
      {status === 'error' && errorText && (
        <p className="mt-1 text-[11px] text-red-600">{errorText}</p>
      )}
    </div>
  )
}

function ImproveAgentAction({ agentKey }: { agentKey: string }) {
  const promptKey = runKeyToPromptKey(agentKey)
  if (!promptKey) {
    return (
      <button
        type="button"
        disabled
        title={NOT_EXTERNALIZED_TITLE}
        className={RESERVED_BUTTON_CLASSES}
      >
        Improve this agent
      </button>
    )
  }
  return (
    <Link href={`/prompt-lab/${encodeURIComponent(promptKey)}`} className={LIVE_BUTTON_CLASSES}>
      Improve this agent
    </Link>
  )
}

export default function RecoveryRail({
  runId,
  agentRuns,
  isPausedAtGate1 = false,
}: RecoveryRailProps) {
  const failedAgentKey = findFailedAgentKey(agentRuns)
  const sequence = namedStepSequence()

  if (!failedAgentKey) {
    return (
      <div className="rounded-lg border border-[color:var(--color-vermilion)] bg-white p-5">
        <h3 className="text-sm font-semibold text-[color:var(--color-vermilion)]">
          What happened
        </h3>
        <p className="mt-1 text-sm text-neutral-700">
          This run failed, but no specific step is recorded as failed.
        </p>
      </div>
    )
  }

  const failedRow = agentRuns.find(r => r.agentKey === failedAgentKey)
  const failedStep = runStepFor(failedAgentKey)
  const failedTopoIndex = PIPELINE_NODES.indexOf(failedAgentKey)

  const completed = sequence.filter(
    s => s.actionLabel !== failedStep.actionLabel && PIPELINE_NODES.indexOf(s.agentKey) < failedTopoIndex,
  )
  const downstream = sequence.filter(
    s => s.actionLabel !== failedStep.actionLabel && PIPELINE_NODES.indexOf(s.agentKey) > failedTopoIndex,
  )

  const reason = failedRow?.error?.trim() || 'This step failed without a specific error message.'

  return (
    <div className="space-y-4 rounded-lg border border-[color:var(--color-vermilion)] bg-white p-5">
      {/* 1. What happened */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
          What happened
        </h3>
        <p className="mt-1 text-sm font-medium text-[color:var(--color-vermilion)]">
          {failedStep.actionLabel}
          {failedStep.named && <span className="font-normal text-neutral-500"> — {failedStep.agentLabel}</span>}
        </p>
        <p className="mt-1 text-sm text-neutral-700">{reason}</p>
      </section>

      {/* 2. What completed successfully */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[.06em] text-neutral-500">
          What completed successfully
        </h3>
        {completed.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">Nothing completed before this step failed.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-sm text-neutral-700">
            {completed.map(s => (
              <li key={s.actionLabel}>
                {s.actionLabel} <span className="text-neutral-400">— {s.agentLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. What did not happen — downstream steps dim + read "Skipped" */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[.06em] text-neutral-500">
          What did not happen
        </h3>
        {downstream.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">
            This was the last step — nothing downstream was skipped.
          </p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-sm text-neutral-400 opacity-70">
            {downstream.map(s => (
              <li key={s.actionLabel} data-testid={`skipped-${s.actionLabel}`}>
                {s.actionLabel} <span className="italic">— Skipped</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Recommended recovery */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[.06em] text-neutral-500">
          Recommended recovery
        </h3>
        <div className="mt-2 flex flex-wrap items-start gap-4">
          <RestartAction runId={runId} agentKey={failedAgentKey} isPausedAtGate1={isPausedAtGate1} />
          <ImproveAgentAction agentKey={failedAgentKey} />
        </div>
      </section>
    </div>
  )
}
