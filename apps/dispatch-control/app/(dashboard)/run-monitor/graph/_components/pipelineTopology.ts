/**
 * Phase 23 — static pipeline DAG topology for the Graph view.
 *
 * Mirrors packages/pipeline/src/eisenbalm_pipeline/graph/builder.py exactly.
 * 18 nodes: sequential spine + 7-writer fan-out from verify_research +
 * fan-in to validate_sections + post-fan-in spine.
 *
 * IMPORTANT (Pitfall 4): the `design` node is ALWAYS in the topology even
 * when DESIGNAGENT_SUPPRESSED=true. When suppressed, the `agents` table row
 * has enabled=false — the graph dims the node rather than removing it, so
 * dagre layout stays stable.
 */

// ── node list ────────────────────────────────────────────────────────────────

/**
 * All 18 pipeline agent keys in topological order (matches builder.py).
 * design is always included — see Pitfall 4 note above.
 */
export const PIPELINE_NODES: string[] = [
  'calibrator',
  'scout',
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
 * Phase 37 (MON-01, D-02) — the two real code-gate nodes, rendered as
 * marigold diamonds on the forensic spine (everything else is a dot).
 *
 * SCOPE CORRECTION (Research Pitfall 8): the design brief describes THREE
 * code-gate diamonds — that phantom third gate name is stale and does not
 * exist in `builder.py`. Only two nodes are wrapped as code gates. Do NOT
 * add a third gate to this set.
 */
export const GATE_KEYS: Set<string> = new Set<string>([
  'verify_research',
  'validate_sections',
])

export const PIPELINE_EDGES: [string, string][] = [
  // Sequential pre-fan-out spine
  ['calibrator', 'scout'],
  ['scout', 'advocate'],
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
