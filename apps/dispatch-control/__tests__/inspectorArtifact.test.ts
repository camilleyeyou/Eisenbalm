// Phase 44 Plan 44-03 -- the Wave-0 scaffold (44-01) filled in with live
// assertions. Covers INS-01 -- the pure artifact->step resolver
// (lib/inspectorArtifact.ts, docs/API_CONTRACTS.md §44.1/§44.3).
import { describe, it, expect } from 'vitest'
import {
  resolveInspectorStep,
  runKeyToPromptKey,
  encodeArtifactKey,
  parseArtifactKey,
  type InspectorArtifactKey,
} from '@/lib/inspectorArtifact'

describe('inspectorArtifact resolver (§44.3)', () => {
  it("founder locator 'founderBio' resolves to agentKey 'founder_bio' with promptKey null (not externalized)", () => {
    const result = resolveInspectorStep({ type: 'founder', runId: 'r', locator: 'founderBio' })
    expect(result).toEqual({ agentKey: 'founder_bio', promptKey: null, degraded: false })
  })

  it("founder locator 'game' resolves to agentKey 'game' with promptKey 'game'", () => {
    const result = resolveInspectorStep({ type: 'founder', runId: 'r', locator: 'game' })
    expect(result).toEqual({ agentKey: 'game', promptKey: 'game', degraded: false })
  })

  it("founder locator already in the run/qa vocabulary (snake_case) resolves the same as its galley form", () => {
    const result = resolveInspectorStep({ type: 'founder', runId: 'r', locator: 'origin_story' })
    expect(result).toEqual({ agentKey: 'origin_story', promptKey: null, degraded: false })
  })

  it('founder locator that is unresolvable in either vocabulary degrades honestly, never throws', () => {
    const result = resolveInspectorStep({ type: 'founder', runId: 'r', locator: 'not-a-real-section' })
    expect(result).toEqual({ agentKey: 'not-a-real-section', promptKey: null, degraded: true })
  })

  it("bonus resolves to agentKey 'bonus'; with bonusType 'jingle' promptKey is 'bonus_jingle'", () => {
    const withBonusType = resolveInspectorStep(
      { type: 'founder', runId: 'r', locator: 'bonus' },
      { bonusType: 'jingle' },
    )
    expect(withBonusType).toEqual({ agentKey: 'bonus', promptKey: 'bonus_jingle', degraded: false })
  })

  it('bonus without a bonusType resolves promptKey null (variant not yet known)', () => {
    const withoutBonusType = resolveInspectorStep({ type: 'founder', runId: 'r', locator: 'bonus' })
    expect(withoutBonusType).toEqual({ agentKey: 'bonus', promptKey: null, degraded: false })
  })

  it("editor_gate_1 run key maps to promptKey 'editor_gate1' (the one hard alias)", () => {
    expect(runKeyToPromptKey('editor_gate_1')).toBe('editor_gate1')
    expect(runKeyToPromptKey('scout')).toBe('scout')
    expect(runKeyToPromptKey('founder_bio')).toBeNull()
  })

  it("claim resolves to agentKey 'researcher' (claim_checks has no agent field)", () => {
    const result = resolveInspectorStep({ type: 'claim', runId: 'r', locator: 'claim-123' })
    expect(result.agentKey).toBe('researcher')
    expect(result.promptKey).toBe('researcher')
    expect(result.degraded).toBe(false)
  })

  it('claim sectionContext derives from the locator when it resolves as a galley section id', () => {
    const result = resolveInspectorStep({ type: 'claim', runId: 'r', locator: 'founderBio' })
    expect(result.sectionContext).toBe('founder_bio')
  })

  it("rec resolves to 'editor_final'; qa resolves to 'qa' (promptKey null)", () => {
    const rec = resolveInspectorStep({ type: 'rec', runId: 'r', locator: '' })
    expect(rec).toEqual({ agentKey: 'editor_final', promptKey: 'editor_final', degraded: false })

    const qa = resolveInspectorStep({ type: 'qa', runId: 'r', locator: '' })
    expect(qa).toEqual({ agentKey: 'qa', promptKey: null, degraded: false })
  })

  it('signal/org degrade correctly -- signal has no step in any current run; org resolves live to scout', () => {
    const signal = resolveInspectorStep({ type: 'signal', runId: 'r', locator: '' })
    expect(signal).toEqual({ agentKey: 'signal_editor', promptKey: 'signal_editor', degraded: true })

    const org = resolveInspectorStep({ type: 'org', runId: 'r', locator: '' })
    expect(org).toEqual({ agentKey: 'scout', promptKey: 'scout', degraded: false })
  })

  it(
    "encodeArtifactKey/parseArtifactKey round-trip, including empty locator and a locator containing ':'",
    () => {
      const emptyLocator: InspectorArtifactKey = { type: 'rec', runId: 'abc123', locator: '' }
      expect(parseArtifactKey(encodeArtifactKey(emptyLocator))).toEqual(emptyLocator)

      const colonLocator: InspectorArtifactKey = {
        type: 'claim',
        runId: 'run-1',
        locator: 'claim:with:colons',
      }
      expect(parseArtifactKey(encodeArtifactKey(colonLocator))).toEqual(colonLocator)

      expect(encodeArtifactKey(emptyLocator)).toBe('rec:abc123:')
      expect(encodeArtifactKey(colonLocator)).toBe('claim:run-1:claim:with:colons')
    },
  )

  it('parseArtifactKey returns null on malformed input (missing colon, unknown type)', () => {
    expect(parseArtifactKey('not-enough-colons')).toBeNull()
    expect(parseArtifactKey('founder:onlyOneColon')).toBeNull()
    expect(parseArtifactKey('bogus-type:run-1:locator')).toBeNull()
  })
})
