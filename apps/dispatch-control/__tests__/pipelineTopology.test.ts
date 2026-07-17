/**
 * Phase 23 — pipelineTopology unit tests.
 * Phase 50 (WBN-02, D-08): reconciled to the live 20-node graph.
 *
 * Asserts that the static DAG definition matches builder.py exactly:
 * - 20 nodes (calibrator … publisher, including signal_editor +
 *   verify_candidates, design always included)
 * - Every edge endpoint is a known node
 * - The four new discovery-chain edges (calibrator->signal_editor->scout->
 *   verify_candidates->advocate) are present
 * - Exactly 7 edges originate from verify_research (fan-out)
 * - Exactly 7 edges terminate at validate_sections (fan-in)
 * - 'design' is present in both PIPELINE_NODES and SECTION_WRITER_KEYS
 * - GATE_KEYS is the reconciled 3-member diamond set
 *   {verify_candidates, verify_research, publisher}
 */
import { describe, it, expect } from 'vitest'
import {
  PIPELINE_NODES,
  PIPELINE_EDGES,
  SECTION_WRITER_KEYS,
  GATE_KEYS,
} from '../app/(dashboard)/run-monitor/graph/_components/pipelineTopology'

describe('pipelineTopology', () => {
  it('PIPELINE_NODES has exactly 20 entries (matches builder.py node count)', () => {
    expect(PIPELINE_NODES).toHaveLength(20)
  })

  it("includes 'signal_editor' in PIPELINE_NODES (Phase 46 discovery-chain agent)", () => {
    expect(PIPELINE_NODES).toContain('signal_editor')
  })

  it("includes 'verify_candidates' in PIPELINE_NODES (Phase 46 non-LLM bottleneck)", () => {
    expect(PIPELINE_NODES).toContain('verify_candidates')
  })

  it("includes 'design' in PIPELINE_NODES (always present, dimmed when suppressed)", () => {
    expect(PIPELINE_NODES).toContain('design')
  })

  it("includes 'design' in SECTION_WRITER_KEYS", () => {
    expect(SECTION_WRITER_KEYS).toContain('design')
  })

  it('SECTION_WRITER_KEYS has exactly 7 entries (the 7 parallel section writers)', () => {
    expect(SECTION_WRITER_KEYS).toHaveLength(7)
  })

  it('every edge [source, target] endpoint is a known PIPELINE_NODE', () => {
    const nodeSet = new Set(PIPELINE_NODES)
    for (const [source, target] of PIPELINE_EDGES) {
      expect(nodeSet.has(source), `Unknown source: "${source}"`).toBe(true)
      expect(nodeSet.has(target), `Unknown target: "${target}"`).toBe(true)
    }
  })

  // ── discovery-chain edges (Phase 46 signal_editor/verify_candidates) ───────

  it('contains the four reconciled discovery-chain edges (calibrator->signal_editor->scout->verify_candidates->advocate)', () => {
    const edgeSet = new Set(PIPELINE_EDGES.map(([s, t]) => `${s}->${t}`))
    expect(edgeSet.has('calibrator->signal_editor')).toBe(true)
    expect(edgeSet.has('signal_editor->scout')).toBe(true)
    expect(edgeSet.has('scout->verify_candidates')).toBe(true)
    expect(edgeSet.has('verify_candidates->advocate')).toBe(true)
  })

  it('does NOT contain the stale direct calibrator->scout or scout->advocate edges', () => {
    const edgeSet = new Set(PIPELINE_EDGES.map(([s, t]) => `${s}->${t}`))
    expect(edgeSet.has('calibrator->scout')).toBe(false)
    expect(edgeSet.has('scout->advocate')).toBe(false)
  })

  it('exactly 7 edges originate from verify_research (7-way fan-out)', () => {
    const fanOut = PIPELINE_EDGES.filter(([src]) => src === 'verify_research')
    expect(fanOut).toHaveLength(7)
  })

  it('exactly 7 edges terminate at validate_sections (7-way fan-in)', () => {
    const fanIn = PIPELINE_EDGES.filter(([, tgt]) => tgt === 'validate_sections')
    expect(fanIn).toHaveLength(7)
  })

  it('fan-out targets from verify_research exactly match SECTION_WRITER_KEYS', () => {
    const fanOutTargets = PIPELINE_EDGES
      .filter(([src]) => src === 'verify_research')
      .map(([, tgt]) => tgt)
      .sort()
    const writerKeys = [...SECTION_WRITER_KEYS].sort()
    expect(fanOutTargets).toEqual(writerKeys)
  })

  it('fan-in sources to validate_sections exactly match SECTION_WRITER_KEYS', () => {
    const fanInSources = PIPELINE_EDGES
      .filter(([, tgt]) => tgt === 'validate_sections')
      .map(([src]) => src)
      .sort()
    const writerKeys = [...SECTION_WRITER_KEYS].sort()
    expect(fanInSources).toEqual(writerKeys)
  })

  // ── GATE_KEYS (Phase 37 MON-01/D-02, reconciled Phase 50 D-08) ─────────────

  it('GATE_KEYS is the reconciled 3-member diamond set: verify_candidates, verify_research, publisher', () => {
    expect(GATE_KEYS.size).toBe(3)
    expect(GATE_KEYS.has('verify_candidates')).toBe(true)
    expect(GATE_KEYS.has('verify_research')).toBe(true)
    expect(GATE_KEYS.has('publisher')).toBe(true)
  })

  it('does NOT include validate_sections (§7 does not name it as a distinct step)', () => {
    expect(GATE_KEYS.has('validate_sections')).toBe(false)
    expect([...GATE_KEYS].sort()).toEqual(['publisher', 'verify_candidates', 'verify_research'])
  })

  it('every GATE_KEYS member is a known PIPELINE_NODE', () => {
    const nodeSet = new Set(PIPELINE_NODES)
    for (const key of GATE_KEYS) {
      expect(nodeSet.has(key), `Unknown gate key: "${key}"`).toBe(true)
    }
  })
})
