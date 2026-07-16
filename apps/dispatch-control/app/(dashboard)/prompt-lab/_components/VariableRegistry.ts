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
  researcher_user: ['charity', 'results_block', 'corrections', 'source_material'],
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
    const name = (m[1] ?? '').trim()
    if (!allowedSet.has(name) && !seen.has(name)) {
      seen.add(name)
      unknown.push(name)
    }
  }
  return unknown
}

/**
 * Phase 28 (PRC-05/PRC-06/PRC-07, CONTEXT D-13/D-14/D-15) — ADDITIVE.
 *
 * The maps below are keyed by VARIABLE NAME (not agentKey): a shared token like
 * `{VOICE_CONSTRAINTS}` or `{charity_name}` means the same thing wherever it
 * appears, so it is described/sampled once (DRY, D-13). VARIABLE_REGISTRY's
 * `Record<agentKey, string[]>` shape is UNCHANGED — the highlight extension and
 * the Phase 24 unknown-var save gate keep working untouched.
 *
 * These are CONSOLE-SIDE, brand-agnostic helpers. The sample map mirrors the
 * spirit of the server `SAMPLE_FIXTURES` but as per-VARIABLE strings; it never
 * imports server fixtures and never makes a server call (D-14 — the assembled
 * preview is a readability aid, not an execution).
 */
export const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  // ── shared voice / constraint blocks ──────────────────────────────────────
  VOICE_CONSTRAINTS:
    'The centralized voice-constraint block (register, tone, forbidden moves).',
  FORBIDDEN_CONSTRUCTS:
    'Constructs the agent must never emit (e.g. UI patterns, banned phrasing).',
  STRUCTURE_CONTRACT:
    'The structural floor the output must satisfy (sub-headers, pull-quotes).',
  EDITOR_INTERRUPT_THRESHOLD:
    'Score below which the editor interrupts and forces a re-pitch.',
  EDITOR_CONFIDENCE_THRESHOLD:
    'Minimum confidence the editor needs to select a winner.',
  // ── run / issue context ───────────────────────────────────────────────────
  issue_number: 'The numeric issue number for this run.',
  previous_bonus_types:
    'JSON list of recent bonus types, used to avoid repeating two weeks running.',
  chosen_bonus_type: 'The bonus type selected for this issue (bigBudget/jingle/specAd).',
  featured_keys: 'JSON list of already-featured charity dedup keys to skip.',
  // ── charity / section context ─────────────────────────────────────────────
  charity: 'The featured charity name (researcher context).',
  charity_name: 'The featured charity name.',
  mission_statement: 'The charity mission statement, one or two lines.',
  visual_direction: 'The art-direction note guiding the visual treatment.',
  display_list: 'Whitelisted display-font names available to the design agent.',
  body_list: 'Whitelisted body-font names available to the design agent.',
  results_block: 'Formatted web-search results passed to the agent.',
  corrections:
    'Prior editorial corrections logged for this charity, injected so research accounts for them (MEM-03).',
  source_material:
    'Optional operator-supplied URLs/notes from a "Start from my brief" entry, prioritized as seed context (Phase 48 D-10). Empty on discovery runs.',
  // ── structured JSON payloads ──────────────────────────────────────────────
  candidates_json: 'JSON array of charity candidates for the advocate to score.',
  candidates_block: 'Formatted candidate list with advocate scores for the editor.',
  qa_corrections_json: 'JSON array of QA corrections the editor must reconcile.',
  section_headlines_json: 'JSON map of section keys to their drafted headlines.',
}

export const VARIABLE_SAMPLES: Record<string, string> = {
  // ── shared voice / constraint blocks ──────────────────────────────────────
  VOICE_CONSTRAINTS:
    'Dry, precise, absurdly serious. No winking, no irony signaling, no exclamation points.',
  FORBIDDEN_CONSTRUCTS:
    'No alert(), no external network calls, no references to being an AI.',
  STRUCTURE_CONTRACT:
    'At least two sub-headers and one pull-quote per long-read section.',
  EDITOR_INTERRUPT_THRESHOLD: '4',
  EDITOR_CONFIDENCE_THRESHOLD: '7',
  // ── run / issue context ───────────────────────────────────────────────────
  issue_number: '42',
  previous_bonus_types: '["bigBudget", "jingle"]',
  chosen_bonus_type: 'specAd',
  featured_keys: '["the-quiet-foundation", "library-acoustics-trust"]',
  // ── charity / section context ─────────────────────────────────────────────
  charity: 'The Quiet Foundation',
  charity_name: 'The Quiet Foundation',
  mission_statement: 'Preserve the acoustic environment of public libraries.',
  visual_direction: 'Quiet serif gravity, paper-white restraint.',
  display_list: 'Cormorant, Fraunces, Newsreader',
  body_list: 'Lora, Inter, Newsreader',
  results_block:
    'URL: https://example.org\nTitle: About\nContent: A small charity preserving library acoustics.',
  corrections:
    'PRIOR EDITORIAL CORRECTIONS (account for these):\n- AUM figure was wrong; use $4.2M',
  source_material:
    'OPERATOR-SUPPLIED SOURCE MATERIAL (prioritize these as seed context):\nhttps://example.org/notes',
  // ── structured JSON payloads ──────────────────────────────────────────────
  candidates_json:
    '[{"name": "The Quiet Foundation", "location": "Vermont", "focusArea": "library acoustics"}]',
  candidates_block: '[{"name": "The Quiet Foundation", "advocateScore": 8}]',
  qa_corrections_json: '[]',
  section_headlines_json: '{"origin_story": "Origin"}',
}

/**
 * Look up a human-readable description for a variable name. Returns `''` when
 * the name is unknown (so chip tooltips degrade gracefully).
 */
export function descriptionForVariable(name: string): string {
  return VARIABLE_DESCRIPTIONS[name] ?? ''
}

/**
 * Complement of {@link findUnknownVariables} (PRC-07 advisory): return the
 * `allowed` variables that do NOT appear as `{name}` in `text`, deterministically
 * in the first-seen order of `allowed`. This is an advisory hint only — it is
 * NOT a save gate (the Phase 24 unknown-var gate stays the only gate).
 */
export function findUnusedVariables(text: string, allowed: string[]): string[] {
  const unused: string[] = []
  for (const name of allowed) {
    if (!text.includes('{' + name + '}')) {
      unused.push(name)
    }
  }
  return unused
}
