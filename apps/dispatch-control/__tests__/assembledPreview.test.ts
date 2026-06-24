/**
 * Phase 28 (PRC-06, CONTEXT D-14) — substitution-correctness tests for the
 * assembled-with-sample-values preview.
 *
 * Runs in node. Guards the module import so collection succeeds. The core
 * invariant: assembleWithSamples replaces `{name}` with the sample value via the
 * canonical replace-all chain, leaves unrelated literal braces intact, and never
 * calls a server (pure function).
 */
import { describe, it, expect } from 'vitest'

let assembleWithSamples:
  | ((draft: string, allowed: string[]) => string)
  | undefined
let VARIABLE_SAMPLES: Record<string, string> | undefined

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../app/(dashboard)/prompts/_components/AssembledPreview')
  assembleWithSamples = mod.assembleWithSamples
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const reg = require('../app/(dashboard)/prompts/_components/VariableRegistry')
  VARIABLE_SAMPLES = reg.VARIABLE_SAMPLES
} catch {
  assembleWithSamples = undefined
  VARIABLE_SAMPLES = undefined
}

describe('assembleWithSamples (PRC-06 client-side substitution)', () => {
  it('substitutes the sample value and removes the raw placeholder', () => {
    expect(assembleWithSamples).toBeDefined()
    expect(VARIABLE_SAMPLES).toBeDefined()
    const out = assembleWithSamples!('Hi {charity_name}', ['charity_name'])
    expect(out).toContain(VARIABLE_SAMPLES!['charity_name'])
    expect(out).not.toContain('{charity_name}')
  })

  it('replaces every occurrence (replace-all, not first-only)', () => {
    const out = assembleWithSamples!(
      '{charity_name} and {charity_name}',
      ['charity_name'],
    )
    expect(out).not.toContain('{charity_name}')
  })

  it('leaves an unrelated literal brace intact', () => {
    const out = assembleWithSamples!('keep this { literal', ['charity_name'])
    expect(out).toBe('keep this { literal')
  })

  it('leaves a placeholder intact when no sample exists', () => {
    const out = assembleWithSamples!('Hi {__no_sample__}', ['__no_sample__'])
    expect(out).toBe('Hi {__no_sample__}')
  })
})
