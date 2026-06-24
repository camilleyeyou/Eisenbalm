/**
 * Phase 28 (PRC-05/PRC-06/PRC-07, CONTEXT D-13/D-14/D-15) — coverage tests for
 * the variable-name-keyed description + sample maps and findUnusedVariables.
 *
 * Runs in node. Guards the module import so collection succeeds. The core
 * invariant: every variable NAME used anywhere in VARIABLE_REGISTRY has BOTH a
 * description and a sample (so chips + assembled preview are fully covered), and
 * findUnusedVariables is the deterministic complement of the save-gate scan.
 */
import { describe, it, expect } from 'vitest'

let VARIABLE_REGISTRY: Record<string, string[]> | undefined
let VARIABLE_DESCRIPTIONS: Record<string, string> | undefined
let VARIABLE_SAMPLES: Record<string, string> | undefined
let descriptionForVariable: ((name: string) => string) | undefined
let findUnusedVariables:
  | ((text: string, allowed: string[]) => string[])
  | undefined

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../app/(dashboard)/prompts/_components/VariableRegistry')
  VARIABLE_REGISTRY = mod.VARIABLE_REGISTRY
  VARIABLE_DESCRIPTIONS = mod.VARIABLE_DESCRIPTIONS
  VARIABLE_SAMPLES = mod.VARIABLE_SAMPLES
  descriptionForVariable = mod.descriptionForVariable
  findUnusedVariables = mod.findUnusedVariables
} catch {
  VARIABLE_REGISTRY = undefined
  VARIABLE_DESCRIPTIONS = undefined
  VARIABLE_SAMPLES = undefined
  descriptionForVariable = undefined
  findUnusedVariables = undefined
}

function usedVariableNames(): string[] {
  const seen = new Set<string>()
  for (const names of Object.values(VARIABLE_REGISTRY!)) {
    for (const n of names) seen.add(n)
  }
  return [...seen]
}

describe('VARIABLE_DESCRIPTIONS + VARIABLE_SAMPLES coverage (PRC-05/06)', () => {
  it('every used variable name has a description', () => {
    expect(VARIABLE_REGISTRY).toBeDefined()
    expect(VARIABLE_DESCRIPTIONS).toBeDefined()
    const described = new Set(Object.keys(VARIABLE_DESCRIPTIONS!))
    const missing = usedVariableNames().filter(n => !described.has(n))
    expect(missing).toEqual([])
  })

  it('every used variable name has a sample', () => {
    expect(VARIABLE_SAMPLES).toBeDefined()
    const sampled = new Set(Object.keys(VARIABLE_SAMPLES!))
    const missing = usedVariableNames().filter(n => !sampled.has(n))
    expect(missing).toEqual([])
  })

  it('every description and sample is a non-empty string', () => {
    for (const [k, v] of Object.entries(VARIABLE_DESCRIPTIONS!)) {
      expect(typeof v, k).toBe('string')
      expect(v.trim().length, k).toBeGreaterThan(0)
    }
    for (const [k, v] of Object.entries(VARIABLE_SAMPLES!)) {
      expect(typeof v, k).toBe('string')
      expect(v.trim().length, k).toBeGreaterThan(0)
    }
  })
})

describe('descriptionForVariable (safe lookup)', () => {
  it('returns the description for a known variable', () => {
    expect(descriptionForVariable).toBeDefined()
    expect(descriptionForVariable!('charity_name')).toBe(
      'The featured charity name.',
    )
  })

  it('returns empty string for an unknown variable (never throws)', () => {
    expect(descriptionForVariable!('__nope__')).toBe('')
  })
})

describe('findUnusedVariables (PRC-07 advisory complement)', () => {
  it('returns allowed variables absent from the text, in allowed order', () => {
    expect(findUnusedVariables).toBeDefined()
    expect(findUnusedVariables!('uses {a}', ['a', 'b'])).toEqual(['b'])
  })

  it('returns [] when every allowed variable is used', () => {
    expect(findUnusedVariables!('{a} {b}', ['a', 'b'])).toEqual([])
  })
})
