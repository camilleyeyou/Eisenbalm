/**
 * Phase 24 — the canonical set of editable prompt assets.
 *
 * Brand-agnostic + data-driven (CONTEXT specifics): the editor's left nav is
 * sourced from the union of the pipeline topology node keys and the variable
 * registry keys, NOT a hand-maintained Eisenbalm-specific label list. The
 * registry already enumerates every editable surface — system-prompt agents,
 * `*_user` templates, section-guidance keys, `rubric`, and `voice_constraints`.
 */
import { PIPELINE_NODES } from '../../run-monitor/graph/_components/pipelineTopology'
import { VARIABLE_REGISTRY } from './VariableRegistry'

/**
 * Coarse grouping for the nav, derived purely from key shape (no brand labels).
 */
export type EditableAgentGroup =
  | 'system'
  | 'user-template'
  | 'section-guidance'
  | 'asset'

const SECTION_GUIDANCE_KEYS = new Set([
  'origin_story',
  'problem',
  'founder_bio_verified',
  'founder_bio_anonymous',
  'case_study_verified',
  'case_study_anonymous',
])

const STANDALONE_ASSET_KEYS = new Set(['rubric', 'voice_constraints'])

export function groupForAgentKey(agentKey: string): EditableAgentGroup {
  if (STANDALONE_ASSET_KEYS.has(agentKey)) return 'asset'
  if (SECTION_GUIDANCE_KEYS.has(agentKey)) return 'section-guidance'
  if (agentKey.endsWith('_user')) return 'user-template'
  return 'system'
}

/**
 * Every editable agentKey, sorted stably. Topology node keys that have a
 * registry entry are included; all registry keys are included (this is the
 * authoritative editable set). The union keeps the nav complete even for keys
 * that exist only in the registry (e.g. `*_user`, `rubric`).
 */
export function listEditableAgentKeys(): string[] {
  const keys = new Set<string>()
  for (const k of Object.keys(VARIABLE_REGISTRY)) keys.add(k)
  for (const k of PIPELINE_NODES) {
    if (k in VARIABLE_REGISTRY) keys.add(k)
  }
  return Array.from(keys).sort()
}

export const GROUP_LABELS: Record<EditableAgentGroup, string> = {
  system: 'Agent system prompts',
  'user-template': 'User templates',
  'section-guidance': 'Section guidance',
  asset: 'Shared assets',
}

/**
 * Humanize an agentKey into a Title Case display label (quick 260624-4ru).
 *
 * Deterministic, no deps: splits on underscores, Title-Cases each word, e.g.
 *   editor_gate1          → "Editor Gate1"
 *   origin_story          → "Origin Story"
 *   founder_bio_verified  → "Founder Bio Verified"
 *   calibrator_user       → "Calibrator User"
 *   voice_constraints     → "Voice Constraints"
 */
export function humanizeAgentKey(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
