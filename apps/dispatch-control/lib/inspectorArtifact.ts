/**
 * Pure artifact -> step resolver (INS-01/INS-04, Phase 44 Plan 44-03).
 *
 * Maps an `InspectorArtifactKey` (docs/API_CONTRACTS.md §44.1) to the exact
 * step it anchors to -- an `agent_runs` / `agent_run_payloads` `agentKey`
 * plus the `prompt_versions` / prompt-lab `promptKey` (§44.3). Section
 * -anchored, not span-anchored (DERIVED-STATE-CONTRACT §8, the Phase
 * 40/42/43 "derived over stored" discipline). This module is PURE: no
 * Convex React hooks, no data fetching -- the panel container (Plan
 * 44-06) does the fetching and calls this resolver with the row data
 * already in scope.
 *
 * Reuses the EXISTING `sectionName <-> galley section id` bridge
 * (`lib/galley/sectionIdMap.ts`, GLY-02) for the `founder`/`claim`
 * section resolution -- do NOT rebuild a second table
 * (44-RESEARCH.md "Don't Hand-Roll").
 *
 * Bridges the one hard namespace split the codebase has never needed to
 * cross before Phase 44: `agent_runs`'s literal graph-node key
 * `editor_gate_1` (underscore before 1) vs `prompt_versions` /
 * `VARIABLE_REGISTRY`'s `editor_gate1` (no underscore) -- see
 * `runKeyToPromptKey` below, the resolver's one explicit alias
 * (§44.RECONCILIATION).
 */

import { galleyIdToQaSection } from './galley/sectionIdMap'

export type InspectorArtifactType = 'founder' | 'claim' | 'rec' | 'org' | 'signal' | 'qa'

export interface InspectorArtifactKey {
  type: InspectorArtifactType
  runId: string
  locator: string
}

export interface ResolvedStep {
  /** agent_runs / agent_run_payloads namespace key. */
  agentKey: string
  /**
   * prompt_versions / VARIABLE_REGISTRY / prompt-lab namespace key, or null
   * when the agent is not externalized to prompt-lab (§44.9) -- a permanent
   * state for 5 of the 7 section writers/judge, not an error.
   */
  promptKey: string | null
  /**
   * true when the run has no such step (signal/org until Phase 46/47, or an
   * unresolvable `founder` locator). Never throws -- an honest degrade
   * instead.
   */
  degraded: boolean
  /** Optional "appears in: Founder Bio" label (claim artifacts). */
  sectionContext?: string
}

/**
 * Section writers whose agent_runs/agent_run_payloads agentKey is already
 * expressed in the qa/run-vocabulary snake_case name. `resolveInspectorStep`
 * tolerates a `founder` locator supplied either as the galley camelCase
 * section id (`founderBio`) OR this run-key vocabulary directly
 * (`founder_bio`) -- §44.3's `founder` resolution row.
 */
const KNOWN_RUN_KEYS = new Set([
  'origin_story',
  'problem',
  'founder_bio',
  'case_study',
  'game',
  'bonus',
])

/**
 * The 5 agentKeys deliberately NOT externalized to prompt_versions /
 * prompt-lab -- `config_loader.py`'s `SYSTEM_PROMPT_KEYS` excludes them; they
 * build their prompts via direct Python f-string interpolation
 * (`lib/voice.py::build_section_writer_prompt`), never an externalized
 * `.replace()` template (§44.9). `promptKey === null` for these is their
 * PERMANENT state, not a loading/error state.
 */
const NON_EXTERNALIZED = new Set(['origin_story', 'problem', 'founder_bio', 'case_study', 'qa'])

/**
 * `bonus`'s agent_runs/agent_run_payloads key is literally `"bonus"` (a
 * single graph node); its prompt-lab Instructions-tab variant is selected at
 * runtime from the run's `outputSnapshot.bonusType` (§44.3 corollary).
 */
const BONUS_VARIANT: Record<string, string> = {
  bigBudget: 'bonus_big_budget',
  jingle: 'bonus_jingle',
  specAd: 'bonus_spec_ad',
}

/**
 * Maps an `agent_runs`/`agent_run_payloads` agentKey to its
 * `prompt_versions` / `VARIABLE_REGISTRY` / prompt-lab promptKey (§44.3).
 * The single explicit `editor_gate_1 -> editor_gate1` alias lives HERE and
 * only here -- no other code may assume the two strings are interchangeable
 * (§44.RECONCILIATION).
 */
export function runKeyToPromptKey(agentKey: string, bonusType?: string): string | null {
  if (agentKey === 'editor_gate_1') return 'editor_gate1'
  if (NON_EXTERNALIZED.has(agentKey)) return null
  if (agentKey === 'bonus') {
    if (!bonusType) return null
    return BONUS_VARIANT[bonusType] ?? null
  }
  return agentKey
}

/**
 * Resolves an `InspectorArtifactKey` to the step it anchors to (§44.3).
 * Pure -- no data fetching. `opts.bonusType` is supplied by the caller (read
 * from the run's `bonus` `agent_run_payloads.outputSnapshot`) only when
 * resolving a `founder` artifact whose locator is `bonus`.
 */
export function resolveInspectorStep(
  key: InspectorArtifactKey,
  opts?: { bonusType?: string },
): ResolvedStep {
  switch (key.type) {
    case 'founder': {
      const runKey =
        galleyIdToQaSection(key.locator) ?? (KNOWN_RUN_KEYS.has(key.locator) ? key.locator : null)
      if (runKey === null) {
        // Unresolvable locator -- honest degrade, never a crash or a guess.
        return { agentKey: key.locator, promptKey: null, degraded: true }
      }
      return {
        agentKey: runKey,
        promptKey: runKeyToPromptKey(runKey, opts?.bonusType),
        degraded: false,
      }
    }
    case 'claim': {
      // claim_checks has NO `agent` field (§44.RECONCILIATION) -- claim
      // sourcing is a Researcher-owned operation (api/factcheck.py:570).
      // sectionContext is best-effort "appears in" metadata, never the
      // resolution target itself.
      return {
        agentKey: 'researcher',
        promptKey: 'researcher',
        degraded: false,
        sectionContext: galleyIdToQaSection(key.locator) ?? (key.locator || undefined),
      }
    }
    case 'rec':
      return { agentKey: 'editor_final', promptKey: 'editor_final', degraded: false }
    case 'qa':
      return { agentKey: 'qa', promptKey: null, degraded: false }
    case 'org':
      // The pitch/candidate data itself resolves to Scout, which runs on
      // every issue today -- NOT blocked on Phase 46/47 (44-RESEARCH.md
      // "State of the Art" correction to CONTEXT.md's D-03 characterization).
      return { agentKey: 'scout', promptKey: 'scout', degraded: false }
    case 'signal':
      // No Signal Editor step exists in any run until Phase 46 -- degrades
      // structurally, never a crash.
      return { agentKey: 'signal_editor', promptKey: 'signal_editor', degraded: true }
  }
}

const VALID_ARTIFACT_TYPES = new Set<InspectorArtifactType>([
  'founder',
  'claim',
  'rec',
  'org',
  'signal',
  'qa',
])

/** `${type}:${runId}:${locator}` (§44.1). `locator` may itself contain `:`. */
export function encodeArtifactKey(k: InspectorArtifactKey): string {
  return `${k.type}:${k.runId}:${k.locator}`
}

/**
 * Splits into at most 3 parts via the FIRST TWO colons only -- everything
 * after the second colon is the locator, verbatim, even if it contains
 * further colons (§44.1). Returns null on malformed input (missing colon,
 * unknown type) -- never throws.
 */
export function parseArtifactKey(s: string): InspectorArtifactKey | null {
  const firstColon = s.indexOf(':')
  if (firstColon === -1) return null
  const secondColon = s.indexOf(':', firstColon + 1)
  if (secondColon === -1) return null

  const type = s.slice(0, firstColon)
  const runId = s.slice(firstColon + 1, secondColon)
  const locator = s.slice(secondColon + 1)

  if (!VALID_ARTIFACT_TYPES.has(type as InspectorArtifactType)) return null

  return { type: type as InspectorArtifactType, runId, locator }
}
