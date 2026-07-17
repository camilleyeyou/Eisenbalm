/**
 * Phase 28 (PRC-01) — per-key editorial role descriptions.
 *
 * Brand-agnostic one-line descriptions of WHAT each editable prompt controls,
 * keyed by the canonical agentKey. The map MUST cover every editable key (the
 * full `Object.keys(VARIABLE_REGISTRY)` set: system-prompt agents, every
 * `*_user` template, the six section-guidance keys, and the two shared assets
 * `rubric` + `voice_constraints`) so no card or detail pane is ever left
 * without context (D-09 — no half-covered keys; `promptDescriptions.test.ts`
 * asserts the superset).
 *
 * Phrasing stays brand-agnostic: it describes the prompt's pipeline ROLE, not
 * Eisenbalm-specific copy, so this surface ports cleanly to a future SaaS
 * tenant.
 */

export const PROMPT_DESCRIPTIONS: Record<string, string> = {
  // ── system-prompt agents ──────────────────────────────────────────────────
  calibrator:
    'Sets the issue style brief and selects the bonus type for the run.',
  scout:
    'Finds candidate charities via web search and writes each to the pitch log.',
  advocate:
    'Argues for and scores each scouted candidate before the editor decides.',
  editor_gate1:
    'Picks exactly one winning charity with reasoning and runner-up notes.',
  editor_final:
    'Reviews QA corrections and gives the final sign-off before the draft is written.',
  researcher:
    'Compiles the shared research dossier that every section writer draws from.',
  game:
    'Writes the self-contained interactive game rendered in the sandboxed iframe.',
  design:
    'Produces the per-issue theme: validated colors and whitelisted font choices.',
  bonus_big_budget:
    'Writes the big-budget bonus concept as a storyboarded ad treatment.',
  bonus_jingle:
    'Writes the jingle bonus: lyrics plus an audio-generation prompt.',
  bonus_spec_ad:
    'Writes the spec-ad bonus as a structured, scannable advertisement.',
  signal_editor:
    'Finds dated story leads from current news before Scout searches for organizations.',

  // ── user-prompt templates ─────────────────────────────────────────────────
  calibrator_user:
    'User message that frames the calibration request for the style brief.',
  scout_user:
    'User message that hands the scout its web-search results to triage.',
  signal_editor_user:
    'User message that hands the signal editor its web-search results to triage.',
  advocate_user:
    'User message that passes the candidate list to the advocate for scoring.',
  editor_gate1_user:
    'User message that presents the scored candidates for the gate-1 decision.',
  editor_final_user:
    'User message that supplies QA corrections and headlines for final review.',
  researcher_user:
    'User message that gives the researcher the chosen charity and search results.',
  game_user:
    'User message that briefs the game writer on the charity and its mission.',
  design_user:
    'User message that conveys the charity and visual direction to the designer.',
  bonus_big_budget_user:
    'User message that briefs the big-budget bonus on charity and visual direction.',
  bonus_jingle_user:
    'User message that briefs the jingle bonus on charity and visual direction.',
  bonus_spec_ad_user:
    'User message that briefs the spec-ad bonus on charity and visual direction.',

  // ── section-guidance assets ───────────────────────────────────────────────
  origin_story:
    'Editorial guidance shaping the origin-story section of the issue.',
  problem:
    'Editorial guidance shaping the problem-statement section of the issue.',
  founder_bio_verified:
    'Editorial guidance for the founder bio when the founder is named and verified.',
  founder_bio_anonymous:
    'Editorial guidance for the founder bio when the founder stays anonymous.',
  case_study_verified:
    'Editorial guidance for the case study when its subject is named and verified.',
  case_study_anonymous:
    'Editorial guidance for the case study when its subject stays anonymous.',

  // ── shared assets ─────────────────────────────────────────────────────────
  rubric:
    'The voice rubric the QA judge scores section bodies against.',
  voice_constraints:
    'The shared voice constraints injected into every voice-critical prompt.',
}

/**
 * Look up the editorial description for an agentKey. Returns an empty string
 * for unknown keys — never throws — so callers can render unconditionally.
 */
export function descriptionFor(agentKey: string): string {
  return PROMPT_DESCRIPTIONS[agentKey] ?? ''
}
