/**
 * Phase 28 (PRC-01, D-09) — coverage tests for the editorial descriptions map.
 *
 * Runs in node. Guards the not-yet-existing modules so collection succeeds.
 * The core invariant (D-09 "no half-covered keys"): PROMPT_DESCRIPTIONS must be
 * a SUPERSET of the canonical editable set (VARIABLE_REGISTRY keys), and every
 * description must be a non-empty string.
 */
import { describe, it, expect } from 'vitest'

let PROMPT_DESCRIPTIONS: Record<string, string> | undefined
let descriptionFor: ((agentKey: string) => string) | undefined
let VARIABLE_REGISTRY: Record<string, string[]> | undefined

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../app/(dashboard)/prompts/_components/promptDescriptions')
  PROMPT_DESCRIPTIONS = mod.PROMPT_DESCRIPTIONS
  descriptionFor = mod.descriptionFor
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const reg = require('../app/(dashboard)/prompts/_components/VariableRegistry')
  VARIABLE_REGISTRY = reg.VARIABLE_REGISTRY
} catch {
  PROMPT_DESCRIPTIONS = undefined
  descriptionFor = undefined
  VARIABLE_REGISTRY = undefined
}

describe('PROMPT_DESCRIPTIONS (PRC-01, D-09 uniform coverage)', () => {
  it('covers every editable key (superset of VARIABLE_REGISTRY keys)', () => {
    expect(PROMPT_DESCRIPTIONS).toBeDefined()
    expect(VARIABLE_REGISTRY).toBeDefined()
    const described = new Set(Object.keys(PROMPT_DESCRIPTIONS!))
    const missing = Object.keys(VARIABLE_REGISTRY!).filter(
      k => !described.has(k),
    )
    expect(missing).toEqual([])
  })

  it('has a non-empty string description for every key', () => {
    expect(PROMPT_DESCRIPTIONS).toBeDefined()
    for (const [key, value] of Object.entries(PROMPT_DESCRIPTIONS!)) {
      expect(typeof value, key).toBe('string')
      expect(value.trim().length, key).toBeGreaterThan(0)
    }
  })
})

describe('descriptionFor (safe lookup)', () => {
  it('returns the description for a known key', () => {
    expect(descriptionFor).toBeDefined()
    expect(descriptionFor!('rubric')).toBe(
      'The voice rubric the QA judge scores section bodies against.',
    )
  })

  it('returns empty string for an unknown key (never throws)', () => {
    expect(descriptionFor!('__nope__')).toBe('')
  })
})
