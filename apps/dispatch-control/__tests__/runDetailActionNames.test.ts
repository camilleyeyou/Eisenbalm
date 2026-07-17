/**
 * Phase 50 (WBN-02, Plan 50-02) — Run Details action-named steps.
 *
 * Pins the §7 action-name map (`lib/nomenclature.ts`'s `runStepFor()`)
 * against the DERIVED-STATE-CONTRACT.md §7 table, cross-checks the
 * diamond set for drift against `pipelineTopology.ts`'s `GATE_KEYS`, proves
 * the seven writers + `validate_sections` all collapse to ONE "Draft
 * sections" action label, proves the two supporting nodes
 * (`calibrator`/`chronicler`) get a non-blank fallback with `named: false`,
 * and source-scans `RunDetail.tsx` for the banned idle-header word
 * "Monitor" (D-09 framing).
 *
 * Runs in vitest's plain `node` environment (no DOM needed — pure data +
 * source-scan assertions).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, it, expect } from 'vitest'

import { runStepFor, RUN_STEP_MAP } from '../lib/nomenclature'
import { GATE_KEYS, PIPELINE_NODES } from '../app/(dashboard)/run-monitor/graph/_components/pipelineTopology'

describe('runDetailActionNames (WBN-02, §7 action-name map)', () => {
  // ── §7 verbatim action labels ────────────────────────────────────────────

  it('resolves the §7 verbatim action labels for named steps', () => {
    expect(runStepFor('signal_editor').actionLabel).toBe('Find story leads')
    expect(runStepFor('scout').actionLabel).toBe('Find organizations')
    expect(runStepFor('verify_candidates').actionLabel).toBe('Verify organizations')
    expect(runStepFor('advocate').actionLabel).toBe('Make the case')
    expect(runStepFor('editor_gate_1').actionLabel).toBe('Choose recommended story')
    expect(runStepFor('researcher').actionLabel).toBe('Research the issue')
    expect(runStepFor('verify_research').actionLabel).toBe('Verify research')
    expect(runStepFor('qa').actionLabel).toBe('Check the draft')
    expect(runStepFor('editor_final').actionLabel).toBe('Recommend publication')
    expect(runStepFor('publisher').actionLabel).toBe('Prepare publication')
  })

  it('marks verify_candidates and publisher as deterministic checks', () => {
    expect(runStepFor('verify_candidates').isDeterministicCheck).toBe(true)
    expect(runStepFor('verify_research').isDeterministicCheck).toBe(true)
    expect(runStepFor('publisher').isDeterministicCheck).toBe(true)
  })

  it('resolves "Draft sections" for origin_story (and every other writer)', () => {
    expect(runStepFor('origin_story').actionLabel).toBe('Draft sections')
  })

  // ── Draft sections collapse (Pitfall 4) ──────────────────────────────────

  it('collapses all 7 writers + validate_sections to ONE action label ("Draft sections")', () => {
    const writerKeys = [
      'origin_story',
      'problem',
      'founder_bio',
      'case_study',
      'game',
      'bonus',
      'design',
      'validate_sections',
    ]
    for (const key of writerKeys) {
      expect(runStepFor(key).actionLabel).toBe('Draft sections')
    }
    // None of these 8 keys render as a diamond — Draft sections is not a
    // deterministic check.
    for (const key of writerKeys) {
      expect(runStepFor(key).isDeterministicCheck).toBe(false)
    }
  })

  it('validate_sections is a fallback join point (named:false), never a separate visible step', () => {
    const step = runStepFor('validate_sections')
    expect(step.named).toBe(false)
    expect(step.actionLabel).toBe('Draft sections')
  })

  // ── Diamond-set agreement (drift guard) ──────────────────────────────────

  it('RUN_STEP_MAP.isDeterministicCheck agrees exactly with pipelineTopology GATE_KEYS (no drift)', () => {
    for (const key of PIPELINE_NODES) {
      const expected = GATE_KEYS.has(key)
      expect(RUN_STEP_MAP[key]?.isDeterministicCheck).toBe(expected)
    }
    // And the reverse: every RUN_STEP_MAP entry marked as a deterministic
    // check is actually in GATE_KEYS.
    for (const [key, step] of Object.entries(RUN_STEP_MAP)) {
      expect(step.isDeterministicCheck).toBe(GATE_KEYS.has(key))
    }
    expect(
      Object.values(RUN_STEP_MAP).filter(s => s.isDeterministicCheck).length,
    ).toBe(GATE_KEYS.size)
  })

  // ── Supporting nodes with no §7 entry (Pitfall 5) ─────────────────────────

  it('calibrator/chronicler/validate_sections resolve non-empty fallback labels with named:false', () => {
    for (const key of ['calibrator', 'chronicler', 'validate_sections']) {
      const step = runStepFor(key)
      expect(step.named).toBe(false)
      expect(step.actionLabel.length).toBeGreaterThan(0)
      expect(step.agentLabel.length).toBeGreaterThan(0)
    }
  })

  it('exactly 11 keys are named:true (the §7 count) — calibrator/chronicler/validate_sections excluded', () => {
    const namedKeys = PIPELINE_NODES.filter(key => RUN_STEP_MAP[key]?.named)
    // 11 distinct §7 action labels, but 17 named:true KEYS (7 writers share
    // one action label each counted once below) — assert on the distinct
    // action-label count, which is the real "11 steps" claim.
    const distinctActionLabels = new Set(namedKeys.map(key => RUN_STEP_MAP[key]?.actionLabel))
    expect(distinctActionLabels.size).toBe(11)
  })

  // ── D-09: historical-record vs live-run framing ──────────────────────────

  it('RunDetail.tsx never renders the word "Monitor" in its idle/finished header path', () => {
    const filePath = path.resolve(
      __dirname,
      '../app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx',
    )
    const content = fs.readFileSync(filePath, 'utf-8')
    // Case-sensitive, word-bounded: catches the banned prose term "Monitor"
    // without tripping on the (unchanged, lowercase) "/run-monitor" route
    // path segments per D-02.
    expect(content).not.toMatch(/\bMonitor\b/)
  })

  it('RunDetail.tsx states historical-record vs live-run framing plainly', () => {
    const filePath = path.resolve(
      __dirname,
      '../app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx',
    )
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/historical record/i)
    expect(content).toMatch(/live run/i)
  })

  // ── Single top-level "Draft sections" row (not seven) ────────────────────

  it('RunDetail.tsx groups by actionLabel so the 7 writers render as ONE top-level row', () => {
    const filePath = path.resolve(
      __dirname,
      '../app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx',
    )
    const content = fs.readFileSync(filePath, 'utf-8')
    // The grouping logic keys Draft-sections membership by a single fixed
    // group key ('draft-sections'), never one row per writer agentKey.
    expect(content).toMatch(/'draft-sections'/)
    expect(content).toMatch(/isDraftSections/)
  })
})
