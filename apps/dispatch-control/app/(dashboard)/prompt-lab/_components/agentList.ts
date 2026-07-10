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
  system: 'Job Descriptions',
  'user-template': 'Assignment Memos',
  'section-guidance': 'Section Briefs',
  asset: 'House Rules',
}

/**
 * One-line descriptor shown under each group header (Prompt Lab Nomenclature
 * Proposal, quick 260710-k8y). Copied verbatim from PROPOSAL.md.
 */
export const GROUP_DESCRIPTORS: Record<EditableAgentGroup, string> = {
  system:
    'Who each agent is and the rules it never breaks. Edit these to change judgment and behavior.',
  'user-template':
    "The note each agent gets every run, carrying that week's data. Plumbing — edit only to change what an agent is handed.",
  'section-guidance':
    'The standing brief for each section of the issue: its job, its length, what it owns, what it must not do.',
  asset:
    'Law that many prompts inherit. Edit once, everyone obeys — the most powerful lever on this page.',
}

/**
 * Human display titles for known agent slugs (Prompt Lab Nomenclature
 * Proposal, quick 260710-k8y). Copied verbatim from PROPOSAL.md ("Agent
 * display names" table; bonus_* expanded to the three concrete slugs).
 */
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  editor_gate1: 'Editor — Picks the Winner',
  editor_final: 'Editor — Publish Brief',
  scout: 'Scout — Finds Candidates',
  advocate: 'Advocate — Argues the Case',
  researcher: 'Researcher — Builds the Dossier',
  calibrator: "Calibrator — Sets the Week's Style",
  game: 'Game Writer',
  bonus_jingle: 'Bonus Writer — Jingle',
  bonus_spec_ad: 'Bonus Writer — Spec Ad',
  bonus_big_budget: 'Bonus Writer — Big Budget',
  rubric: "QA Judge's Rubric",
  voice_constraints: 'The Voice (House Style)',
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

/**
 * Resolve the editor-facing display name for an agentKey (quick 260710-k8y):
 * a curated human title when one exists (AGENT_DISPLAY_NAMES), falling back
 * to the deterministic humanizeAgentKey for *_user, design, and
 * section-guidance keys not covered by the curated map.
 */
export function displayNameForAgentKey(key: string): string {
  return AGENT_DISPLAY_NAMES[key] ?? humanizeAgentKey(key)
}
