'use client'
/**
 * Phase 44 Plan 44-06 (INS-01..INS-06, docs/API_CONTRACTS.md §44.2/§44.3/
 * §44.4/§44.9) — the data-fetching container.
 *
 * Turns an `InspectorArtifactKey` into a fully-assembled `InspectorArtifact`
 * by composing the pure resolver (`lib/inspectorArtifact.ts`, 44-03) with
 * on-demand (NON-subscribed) Convex reads — mirroring `AgentIOPanel`'s
 * `payloadByRunIdAgentKey` pattern (Phase 23/37, RESEARCH Pattern 4) — plus
 * the redefined missing-inputs diff (44-04) and output-divergence predicate
 * (44-04). This is the ONLY place `InspectorArtifact.instructionVersion` /
 * `.instructions` / `.sharedRules` are assembled (§44.9, INS-04's honesty
 * crux) — a fetched-but-unmapped `prompt_versions` row would leave the
 * Instructions tab falsely blank for the 11 externalized agents, which is
 * forbidden (D-07/D-14).
 *
 * Never throws: an unresolvable/degraded step, an absent agentRun/payload
 * row, or a missing active `prompt_versions` row all render honest "not
 * recorded"/"—" states through InspectorPanel's own undefined-safe field
 * rendering — never a crash, never a guess.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import {
  resolveInspectorStep,
  runKeyToPromptKey,
  type InspectorArtifactKey,
} from '@/lib/inspectorArtifact'
import { computeMissingInputs } from '@/lib/inspector/missingInputsDiff'
import { computeOutputDivergence } from '@/lib/inspector/outputDivergence'
import { summarize, prettyJson } from '@/lib/inspector/summarize'
import { PIPELINE_EDGES } from '@/app/(dashboard)/run-monitor/graph/_components/pipelineTopology'
import { displayNameForAgentKey } from '@/app/(dashboard)/prompt-lab/_components/agentList'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import type { ProseBlockLike } from '@/lib/firstProseExcerpt'
import { InspectorPanel, type InspectorArtifact } from './InspectorPanel'
import { useInspector } from './InspectorProvider'

/**
 * §44.9 — the 5 agentKeys deliberately NOT externalized to prompt-lab
 * (`config_loader.py`'s `SYSTEM_PROMPT_KEYS` excludes them; they build
 * their prompts via direct Python f-string interpolation, never an
 * externalized `.replace()` template). The 4 narrative writers always
 * reference these two code-defined shared rules; `qa` references the
 * fetchable `rubric` singleton asset (resolved via a gated query below).
 * Exact name — reproduced verbatim from docs/API_CONTRACTS.md §44.9.
 */
const NON_EXTERNALIZED_SHARED_RULES: Record<string, string[]> = {
  origin_story: ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  problem: ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  founder_bio: ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  case_study: ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  qa: ['rubric'],
}

export interface InspectorContainerProps {
  artifactKey: InspectorArtifactKey
  onClose: () => void
}

function formatDuration(durationMs: number | undefined): string {
  return durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : ''
}

function formatCost(costUsd: number | undefined): string {
  return costUsd != null ? `$${costUsd.toFixed(4)}` : ''
}

/** Best-effort `outputSnapshot.bonusType` extraction — never throws on malformed/truncated JSON. */
function extractBonusType(outputSnapshot: string | undefined): string | undefined {
  if (!outputSnapshot) return undefined
  try {
    const parsed: unknown = JSON.parse(outputSnapshot)
    if (parsed && typeof parsed === 'object' && 'bonusType' in parsed) {
      const value = (parsed as Record<string, unknown>).bonusType
      if (typeof value === 'string') return value
    }
  } catch {
    // Truncated/malformed snapshot — bonusType stays undefined; the
    // Instructions-tab promptKey falls back to null (honest degrade,
    // never a guessed variant).
  }
  return undefined
}

/**
 * Phase 45 (REV-01, D-18) — maps a drafted-section agentKey (the
 * `agent_runs`/`agent_run_payloads` run-key vocabulary) to the top-level key
 * its own outputSnapshot nests its result under. Identical to the agentKey
 * for every writer EXCEPT `problem`, whose result nests under
 * `problem_statement` (packages/pipeline/.../agents/problem.py:210-212 —
 * the exact same run-key/section-id mismatch `lib/galley/sectionIdMap.ts`
 * already documents for `problem` vs `problemStatement`).
 */
const RUN_KEY_TO_OUTPUT_KEY: Record<string, string> = {
  origin_story: 'origin_story',
  problem: 'problem_statement',
  founder_bio: 'founder_bio',
  case_study: 'case_study',
  game: 'game',
  bonus: 'bonus',
}

/**
 * Best-effort extraction of a drafted section's raw prose `body` blocks from
 * its agentKey's `outputSnapshot` — mirrors `extractBonusType`'s defensive
 * JSON.parse (never throws). The ~2000-char truncation cap (§44.5) can cut
 * the JSON off mid-object; that failure mode, and any non-drafted-section
 * agentKey, both fall through to `undefined` here — the exact honest-degrade
 * input `firstProseExcerpt` already expects (undefined/empty blocks -> ''),
 * which in turn leaves the inspector footer's "Ask agent to revise" reserved
 * rather than guessing at a passage.
 */
function extractSectionBlocks(
  outputSnapshot: string | undefined,
  agentKey: string,
): ProseBlockLike[] | undefined {
  const outputKey = RUN_KEY_TO_OUTPUT_KEY[agentKey]
  if (!outputSnapshot || !outputKey) return undefined
  try {
    const parsed: unknown = JSON.parse(outputSnapshot)
    if (!parsed || typeof parsed !== 'object') return undefined
    const section = (parsed as Record<string, unknown>)[outputKey]
    if (!section || typeof section !== 'object') return undefined
    const body = (section as Record<string, unknown>).body
    return Array.isArray(body) ? (body as ProseBlockLike[]) : undefined
  } catch {
    return undefined
  }
}

export function InspectorContainer({ artifactKey, onClose }: InspectorContainerProps) {
  const { runId } = artifactKey

  // Phase 45 (REV-01, D-18) — the shared revise-request channel. The galley
  // toolbar (Plan 45-05 Task 2, ReviewDeskRunView/VoicePassRunView) and this
  // footer both call the SAME `requestRevision`, so either entry point opens
  // the SAME `RevisionFlow` instance (mounted by whichever surface owns
  // `reloadDraft` — never mounted here, InspectorProvider's own doc-comment).
  const { requestRevision } = useInspector()

  // 1. Pure resolution (44-03) — no data dependency. `step.promptKey` is
  // already correct for every artifact type except `bonus`, whose variant
  // is only knowable once the run's own outputSnapshot is in scope (below).
  const step = resolveInspectorStep(artifactKey)

  // 2. On-demand reads (non-subscribed — mirrors AgentIOPanel's node-click
  // pattern, RESEARCH Pattern 4). Always called (Rules of Hooks) — args are
  // conditionally 'skip'ped, never the hook call itself.
  const agentRuns = useQuery(api.agentRuns.byRunId, { runId })
  const agentRun = agentRuns?.find((r) => r.agentKey === step.agentKey)

  const payload = useQuery(api.agentRuns.payloadByRunIdAgentKey, {
    runId,
    agentKey: step.agentKey,
  })

  // 3. Bonus-variant finalization (§44.3 corollary) — the agent_runs/
  // agent_run_payloads key is literally "bonus"; the Instructions-tab
  // promptKey is selected from the run's own outputSnapshot.bonusType.
  const bonusType = step.agentKey === 'bonus' ? extractBonusType(payload?.outputSnapshot) : undefined
  const promptKey = step.agentKey === 'bonus' ? runKeyToPromptKey('bonus', bonusType) : step.promptKey

  const promptVersion = useQuery(
    api.promptVersions.getActive,
    promptKey !== null ? { agentKey: promptKey, workspace_id: DEFAULT_WORKSPACE_ID } : 'skip',
  )

  // The qa Instructions tab's `rubric` shared-rule content (§44.9) — gated
  // to the `qa` artifact only, a second, independent getActive query.
  const rubricVersion = useQuery(
    api.promptVersions.getActive,
    step.agentKey === 'qa' ? { agentKey: 'rubric', workspace_id: DEFAULT_WORKSPACE_ID } : 'skip',
  )

  // 4. The redefined, truncation-honest missing-inputs diff (§44.4, INS-03).
  const missing = computeMissingInputs(step.agentKey, payload?.inputKeys, payload?.inputSnapshot)

  // 5. Output divergence (§44.2 outputNote, D-11's bounding rule). No
  // changed-since signal is fetched by this container for any artifact type
  // today (out of this plan's scoped Convex reads) — the honest default is
  // 'unknown' unless a future plan wires the claim/section change-audit
  // machinery through here. NEVER asserts 'unchanged' from silence.
  const divergence = computeOutputDivergence({ completedAt: agentRun?.completedAt })

  // 6. instructionsExternalized distinguishes "code-defined" (promptKey ===
  // null — a PERMANENT state, §44.9) from "seeded but no active version yet"
  // (promptKey !== null but getActive returned null) — the panel renders
  // "No active version yet." for the latter, never a blank tab either way.
  const instructionsExternalized = promptKey !== null

  // 7. Assemble sharedRules (§44.9's resolution rule) — EVERY artifact type
  // gets a sharedRules entry, never omitted, never a bare one-liner.
  const sharedRules: InspectorArtifact['sharedRules'] =
    promptKey !== null
      ? []
      : step.agentKey === 'qa'
        ? [{ label: 'rubric', content: rubricVersion?.content }]
        : (NON_EXTERNALIZED_SHARED_RULES[step.agentKey] ?? []).map((label) => ({ label }))

  // 8. upstream/downstream from the static topology (reuses AgentIOPanel's
  // filter logic against the same PIPELINE_EDGES source of truth).
  const upstream = PIPELINE_EDGES.filter(([, tgt]) => tgt === step.agentKey)
    .map(([src]) => src)
    .join(', ')
  const downstream = PIPELINE_EDGES.filter(([src]) => src === step.agentKey)
    .map(([, tgt]) => tgt)
    .join(', ')

  // 9. Loading gate — undefined means "still resolving"; null/absent means
  // "resolved, nothing recorded" (an honest degrade, not a loading state).
  const stillLoading = agentRuns === undefined || payload === undefined

  const title = displayNameForAgentKey(promptKey ?? step.agentKey)
  const meta = [
    `step: ${step.agentKey}`,
    `agent: ${step.agentKey}`,
    promptVersion?.version != null ? `instructions v${promptVersion.version}` : null,
    `run #${runId}`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  const rawTechnicalJson =
    agentRun || payload ? JSON.stringify({ agentRun, payload }) : undefined

  // Phase 45 (REV-01, D-18) — the SAME `payload.outputSnapshot` already read
  // above (no new subscription), best-effort-parsed for the section's raw
  // prose `body` blocks + its galley/draft section id. Both are `undefined`
  // for any non-drafted-section artifact (claim/rec/org/signal/qa) or when
  // extraction fails — `InspectorPanel` treats that as "no revisable
  // passage" and leaves the footer honestly reserved.
  const sectionBlocks = extractSectionBlocks(payload?.outputSnapshot, step.agentKey)
  const sectionName = qaSectionToGalleyId(step.agentKey) ?? undefined

  const artifact: InspectorArtifact | undefined = stillLoading
    ? undefined
    : {
        title,
        meta,
        asked: summarize(payload?.inputSnapshot ?? undefined),
        result: summarize(payload?.outputSnapshot ?? undefined),
        confidence: '',
        warning: step.degraded
          ? 'This step is not recorded in this run.'
          : agentRun?.status === 'failed'
            ? (agentRun.error ?? 'This step failed.')
            : '',
        upstream: upstream || (step.sectionContext ? `appears in: ${step.sectionContext}` : ''),
        downstream,
        inputs: missing.supplied.join(', '),
        missing: missing.missing.map((m) => m.key).join(', '),
        // §44.9 instruction-version mapping — the exact data the
        // Instructions tab reads when instructionsExternalized === true.
        // Never left unset when promptVersion is present (the falsely-
        // blank D-07/D-14 state this container exists to close).
        instructionVersion: promptVersion?.version != null ? `v${promptVersion.version}` : '',
        instructions: promptVersion?.content ?? '',
        sectionGuidance: '',
        sharedRules,
        output: prettyJson(payload?.outputSnapshot ?? undefined),
        outputNote:
          divergence === 'diverged'
            ? 'The issue text has changed since this output.'
            : divergence === 'unknown'
              ? 'Unknown whether this still matches the issue.'
              : '',
        sources: [],
        // §44.8 — agent_runs has no `model` field; always "not recorded".
        model: 'not recorded',
        timing: formatDuration(agentRun?.durationMs),
        cost: formatCost(agentRun?.costUsd),
        latency: formatDuration(agentRun?.durationMs),
        validation: agentRun?.status ?? '',
        json: prettyJson(rawTechnicalJson),
      }

  return (
    <InspectorPanel
      artifact={artifact}
      agentKey={step.agentKey}
      promptKey={promptKey}
      runId={runId}
      missing={missing}
      instructionsExternalized={instructionsExternalized}
      divergence={divergence}
      onClose={onClose}
      sectionBlocks={sectionBlocks}
      sectionName={sectionName}
      onRequestRevision={requestRevision}
    />
  )
}
