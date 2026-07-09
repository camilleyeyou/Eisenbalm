/**
 * Phase 23 — pipelineTopology unit tests.
 *
 * Asserts that the static DAG definition matches builder.py exactly:
 * - 18 nodes (calibrator … publisher, design always included)
 * - Every edge endpoint is a known node
 * - Exactly 7 edges originate from verify_research (fan-out)
 * - Exactly 7 edges terminate at validate_sections (fan-in)
 * - 'design' is present in both PIPELINE_NODES and SECTION_WRITER_KEYS
 */
import { describe, it, expect } from 'vitest'
import {
  PIPELINE_NODES,
  PIPELINE_EDGES,
  SECTION_WRITER_KEYS,
  GATE_KEYS,
} from '../app/(dashboard)/run-monitor/graph/_components/pipelineTopology'

describe('pipelineTopology', () => {
  it('PIPELINE_NODES has exactly 18 entries (matches builder.py node count)', () => {
    expect(PIPELINE_NODES).toHaveLength(18)
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

  // ── GATE_KEYS (Phase 37, MON-01, D-02) ─────────────────────────────────────

  it('GATE_KEYS contains exactly verify_research and validate_sections', () => {
    expect(GATE_KEYS.size).toBe(2)
    expect(GATE_KEYS.has('verify_research')).toBe(true)
    expect(GATE_KEYS.has('validate_sections')).toBe(true)
  })

  it('does NOT introduce a third gate (design brief\'s "Verify Candidates" is stale)', () => {
    expect(GATE_KEYS.has('verify_candidates' as string)).toBe(false)
    expect([...GATE_KEYS].sort()).toEqual(['validate_sections', 'verify_research'])
  })

  it('every GATE_KEYS member is a known PIPELINE_NODE', () => {
    const nodeSet = new Set(PIPELINE_NODES)
    for (const key of GATE_KEYS) {
      expect(nodeSet.has(key), `Unknown gate key: "${key}"`).toBe(true)
    }
  })
})
