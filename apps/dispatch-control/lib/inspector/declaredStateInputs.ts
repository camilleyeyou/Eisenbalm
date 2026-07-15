/**
 * DECLARED_STATE_INPUTS — a TypeScript port of the Python `_INPUT_KEYS`
 * whitelist, speaking the SAME `DispatchState` top-level field-name
 * vocabulary as `agent_run_payloads.inputSnapshot`/`inputKeys`'s actual keys
 * (docs/API_CONTRACTS.md §44.4).
 *
 * Source of authority (mirror this VERBATIM — do not hand-edit without
 * checking both sides for drift):
 *   packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py:33-53
 *   (`_INPUT_KEYS: dict[str, list[str]]`)
 *
 * This is deliberately NOT `VARIABLE_REGISTRY` (VariableRegistry.ts) — that
 * table declares fine-grained `{token}` prompt-substitution names (e.g.
 * `charity_name`, `VOICE_CONSTRAINTS`), a different abstraction layer that
 * never intersects with these coarse `DispatchState` field names (44-RESEARCH
 * .md Pitfall 1). `lib/inspector/missingInputsDiff.ts` diffs against THIS
 * vocabulary only.
 */
export const DECLARED_STATE_INPUTS: Record<string, string[]> = {
  calibrator: ['run_id'],
  scout: ['style_brief'],
  advocate: ['candidates'],
  editor_gate_1: ['candidates'],
  chronicler: ['candidates', 'winning_charity', 'editor_decision'],
  researcher: ['winning_charity'],
  verify_research: ['research'],
  origin_story: ['research', 'winning_charity', 'style_brief'],
  problem: ['research', 'winning_charity', 'style_brief'],
  founder_bio: ['research', 'winning_charity', 'style_brief'],
  case_study: ['research', 'winning_charity', 'style_brief'],
  game: ['research', 'winning_charity', 'style_brief'],
  bonus: ['research', 'winning_charity', 'style_brief'],
  design: ['research', 'winning_charity', 'style_brief'],
  validate_sections: ['run_id'],
  qa: ['origin_story', 'problem_statement', 'founder_bio', 'case_study', 'game', 'bonus'],
  editor_final: ['qa_corrections', 'winning_charity'],
  publisher: ['sanity_issue_id', 'winning_charity'],
}
