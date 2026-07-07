/**
 * Phase 24 Wave 0 — RED tests for the per-agent variable registry (PRM-02).
 *
 * Runs in node (no convex, no DOM). The registry is the canonical source of
 * truth (CONTEXT D-05) that drives both the editor highlight color and the
 * unknown/mangled-variable save-warning.
 *
 * RED until Plan 07 lands
 * app/(dashboard)/prompt-lab/_components/VariableRegistry.{ts,tsx} exporting:
 *   - VARIABLE_REGISTRY: Record<string, string[]>  (agentKey → allowed {tokens})
 *   - findUnknownVariables(text, allowed): string[]  (tokens in text NOT in allowed)
 *
 * The import is guarded so the file import-executes cleanly (RED), and every
 * assertion is reached only when the module exists.
 */
import { describe, it, expect } from 'vitest'

// Guard the not-yet-existing module so collection succeeds.
let VARIABLE_REGISTRY: Record<string, string[]> | undefined
let findUnknownVariables:
  | ((text: string, allowed: string[]) => string[])
  | undefined

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../app/(dashboard)/prompt-lab/_components/VariableRegistry')
  VARIABLE_REGISTRY = mod.VARIABLE_REGISTRY
  findUnknownVariables = mod.findUnknownVariables
} catch {
  VARIABLE_REGISTRY = undefined
  findUnknownVariables = undefined
}

describe('VARIABLE_REGISTRY (PRM-02, CONTEXT D-05)', () => {
  it('has the calibrator allowed-variable set (24-RESEARCH Pattern 8)', () => {
    expect(VARIABLE_REGISTRY).toBeDefined()
    const calibrator = VARIABLE_REGISTRY!['calibrator']
    expect(calibrator).toBeDefined()
    for (const v of [
      'VOICE_CONSTRAINTS',
      'issue_number',
      'previous_bonus_types',
      'chosen_bonus_type',
    ]) {
      expect(calibrator).toContain(v)
    }
  })

  it('has the game allowed-variable set', () => {
    const game = VARIABLE_REGISTRY!['game']
    expect(game).toBeDefined()
    for (const v of ['charity_name', 'VOICE_CONSTRAINTS', 'FORBIDDEN_CONSTRUCTS']) {
      expect(game).toContain(v)
    }
  })
})

describe('findUnknownVariables (PRM-02 save-warning gate)', () => {
  it('returns only the {tokens} not in the allowed set', () => {
    expect(findUnknownVariables).toBeDefined()
    expect(findUnknownVariables!('{charity_name} {bogus}', ['charity_name'])).toEqual([
      'bogus',
    ])
  })

  it('returns [] when every token is allowed', () => {
    expect(
      findUnknownVariables!('{charity_name} text {issue_number}', [
        'charity_name',
        'issue_number',
      ]),
    ).toEqual([])
  })
})
