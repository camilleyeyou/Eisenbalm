/**
 * Phase 23 — static pipeline DAG topology for the Graph view.
 *
 * Phase 50 (WBN-02, D-08 — Wave 0 prerequisite): reconciled to the live 20-node
 * graph. Mirrors packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
 * exactly: sequential spine (now including `signal_editor` + `verify_candidates`,
 * added by Phase 46) + 7-writer fan-out from verify_research + fan-in to
 * validate_sections + post-fan-in spine.
 *
 * IMPORTANT (Pitfall 4): the `design` node is ALWAYS in the topology even
 * when DESIGNAGENT_SUPPRESSED=true. When suppressed, the `agents` table row
 * has enabled=false — the graph dims the node rather than removing it, so
 * dagre layout stays stable.
 */

// ── node list ────────────────────────────────────────────────────────────────

/**
 * All 20 pipeline agent keys in topological order (matches builder.py).
 * design is always included — see Pitfall 4 note above. `signal_editor`
 * (after calibrator) and `verify_candidates` (after scout) were added in
 * Phase 46 and reconciled into this static topology in Phase 50.
 */
export const PIPELINE_NODES: string[] = [
  'calibrator',
  'signal_editor',
  'scout',
  'verify_candidates',
  'advocate',
  'editor_gate_1',
  'chronicler',
  'researcher',
  'verify_research',
  'origin_story',
  'problem',
  'founder_bio',
  'case_study',
  'game',
  'bonus',
  'design',
  'validate_sections',
  'qa',
  'editor_final',
  'publisher',
]

// ── section writers ──────────────────────────────────────────────────────────

/**
 * The 7 parallel section writers that fan out from verify_research and
 * fan in to validate_sections. design is included (always shown, dimmed
 * when suppressed — not removed).
 */
export const SECTION_WRITER_KEYS: string[] = [
  'origin_story',
  'problem',
  'founder_bio',
  'case_study',
  'game',
  'bonus',
  'design',
]

// ── edge list ────────────────────────────────────────────────────────────────

/**
 * All edges in the pipeline DAG as [source, target] pairs.
 * Encoding:
 *   - Sequential pre-fan-out spine: calibrator → scout → … → verify_research
 *   - 7-way fan-out: verify_research → each SECTION_WRITER_KEY
 *   - 7-way fan-in: each SECTION_WRITER_KEY → validate_sections
 *   - Sequential post-fan-in spine: validate_sections → qa → editor_final → publisher
 */
// ── code gates ───────────────────────────────────────────────────────────────

/**
 * Phase 37 (MON-01, D-02) — the deterministic-check ("code gate") nodes,
 * rendered as marigold diamonds on the forensic spine (everything else is
 * a dot).
 *
 * Phase 50 (D-08) reconciles this set to spec §7's diamond marks
 * (DERIVED-STATE-CONTRACT.md §7: "Verify organizations ◆", "Verify research
 * ◆", "Prepare publication ◆") against the live 20-node graph:
 *   - `verify_candidates` (Phase 46's non-LLM bottleneck between scout and
 *     advocate) is ADDED — it did not exist when this set was first defined.
 *   - `publisher` is ADDED — §7 marks it as a deterministic check despite
 *     doing real (irreversible) publish work; follow the spec verbatim.
 *   - `validate_sections` is DROPPED — §7 does not name it as a distinct
 *     step; it folds into "Draft sections" (see RESEARCH Open Q #3).
 *
 * This is the single diamond source of truth — `lib/nomenclature.ts`
 * imports GATE_KEYS rather than defining a second diamond set.
 */
export const GATE_KEYS: Set<string> = new Set<string>([
  'verify_candidates',
  'verify_research',
  'publisher',
])

export const PIPELINE_EDGES: [string, string][] = [
  // Sequential pre-fan-out spine (calibrator -> signal_editor -> scout ->
  // verify_candidates -> advocate — Phase 46's discovery-chain additions)
  ['calibrator', 'signal_editor'],
  ['signal_editor', 'scout'],
  ['scout', 'verify_candidates'],
  ['verify_candidates', 'advocate'],
  ['advocate', 'editor_gate_1'],
  ['editor_gate_1', 'chronicler'],
  ['chronicler', 'researcher'],
  ['researcher', 'verify_research'],
  // 7-way fan-out from verify_research to all section writers
  ['verify_research', 'origin_story'],
  ['verify_research', 'problem'],
  ['verify_research', 'founder_bio'],
  ['verify_research', 'case_study'],
  ['verify_research', 'game'],
  ['verify_research', 'bonus'],
  ['verify_research', 'design'],
  // 7-way fan-in from all section writers to validate_sections
  ['origin_story', 'validate_sections'],
  ['problem', 'validate_sections'],
  ['founder_bio', 'validate_sections'],
  ['case_study', 'validate_sections'],
  ['game', 'validate_sections'],
  ['bonus', 'validate_sections'],
  ['design', 'validate_sections'],
  // Sequential post-fan-in spine
  ['validate_sections', 'qa'],
  ['qa', 'editor_final'],
  ['editor_final', 'publisher'],
]
