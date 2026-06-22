/**
 * Phase 24 (PRM-02, CONTEXT D-05) — per-agent variable registry.
 *
 * The canonical source of truth that drives BOTH the editor highlight color
 * (known vs unknown/mangled) AND the pre-save unknown-variable warning gate.
 *
 * Token sets are enumerated from call-site source inspection (24-RESEARCH
 * Pattern 8 + a direct grep of `.replace("{...}", ...)` across
 * packages/pipeline/.../agents/*.py). This is a CODE constant, not a Convex
 * row — variable names derive from source at build time, not dynamically.
 *
 * Key conventions:
 *   - System-prompt agentKeys (e.g. `calibrator`, `game`) carry the tokens the
 *     agent's SYSTEM prompt substitutes.
 *   - `*_user` agentKeys carry the tokens the agent's USER template substitutes
 *     (these are distinct sets — a system prompt and its user template rarely
 *     share tokens).
 *   - Section-guidance keys (`origin_story`, `problem`, `founder_bio_*`,
 *     `case_study_*`), `rubric`, and `voice_constraints` are plain prose with
 *     NO `{token}` substitution → empty arrays.
 *   - `advocate` (system) has NO tokens → `[]`; its `advocate_user` template
 *     carries `{candidates_json}` (confirmed in agents/advocate.py).
 */

export const VARIABLE_REGISTRY: Record<string, string[]> = {
  // ── system-prompt agents ──────────────────────────────────────────────────
  calibrator: [
    'VOICE_CONSTRAINTS',
    'issue_number',
    'previous_bonus_types',
    'chosen_bonus_type',
  ],
  scout: ['featured_keys'],
  advocate: [], // system prompt has no .replace tokens (agents/advocate.py)
  editor_gate1: [
    'VOICE_CONSTRAINTS',
    'EDITOR_INTERRUPT_THRESHOLD',
    'EDITOR_CONFIDENCE_THRESHOLD',
  ],
  editor_final: ['VOICE_CONSTRAINTS'],
  researcher: ['VOICE_CONSTRAINTS'],
  game: ['charity_name', 'VOICE_CONSTRAINTS', 'FORBIDDEN_CONSTRUCTS'],
  design: ['display_list', 'body_list'],
  bonus_big_budget: ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  bonus_jingle: ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  bonus_spec_ad: ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],

  // ── user-prompt templates (distinct token sets from their system prompts) ──
  calibrator_user: [], // used verbatim — no .replace tokens (calibrator.py)
  scout_user: ['results_block'],
  advocate_user: ['candidates_json'],
  editor_gate1_user: ['issue_number', 'candidates_block'],
  editor_final_user: ['qa_corrections_json', 'section_headlines_json'],
  researcher_user: ['charity', 'results_block'],
  game_user: ['charity_name', 'mission_statement'],
  design_user: ['charity_name', 'visual_direction'],
  bonus_big_budget_user: ['charity_name', 'mission_statement', 'visual_direction'],
  bonus_jingle_user: ['charity_name', 'mission_statement', 'visual_direction'],
  bonus_spec_ad_user: ['charity_name', 'mission_statement', 'visual_direction'],

  // ── section-guidance assets (plain prose, no tokens) ──────────────────────
  origin_story: [],
  problem: [],
  founder_bio_verified: [],
  founder_bio_anonymous: [],
  case_study_verified: [],
  case_study_anonymous: [],

  // ── rubric + voice (plain prose, no tokens) ───────────────────────────────
  rubric: [],
  voice_constraints: [],
}

/**
 * Scan `text` for `{token}` occurrences and return the trimmed token names that
 * are NOT in `allowed`, deduplicated and in first-seen order.
 *
 * Drives the PRM-02 save-blocking warning: a non-empty result means the buffer
 * contains an unknown/mangled variable and save must be disabled.
 */
export function findUnknownVariables(text: string, allowed: string[]): string[] {
  const allowedSet = new Set(allowed)
  const seen = new Set<string>()
  const unknown: string[] = []
  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim()
    if (!allowedSet.has(name) && !seen.has(name)) {
      seen.add(name)
      unknown.push(name)
    }
  }
  return unknown
}
