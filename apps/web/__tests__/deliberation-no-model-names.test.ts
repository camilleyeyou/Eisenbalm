/**
 * DEL-04 — Security tripwire: no model names in DeliberationSlot render path.
 *
 * This describe is NOT skipped. It guards DeliberationSlot.tsx at all times —
 * including now (Phase 2 stub), through the Phase 9 rewrite, and beyond.
 *
 * Asserted behaviors:
 *   DEL-04: modelVersions JSON field never reaches the render path.
 *   DEL-04: pipelineRuns.cost JSON field never read via run?.cost.
 *   DEL-04: No model-name literals (claude, gpt, sonnet, haiku, openrouter)
 *           appear in code — comment-stripped to prevent documentation bypass.
 *
 * Mirrors the intent of game-sandbox.test.ts (Phase 7 GAM-03):
 * readFileSync at module scope so the tripwire fires immediately on test run.
 * DO NOT delete or weaken these assertions. Fix the source instead.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')

/**
 * Strip block, JSX block, and line comments so model-name literals in
 * documentation prose do not trip the negative assertions.
 * Mirrors the codeOnly() helper in issue-page-typography.test.ts.
 */
function codeOnly(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')        // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')    // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')      // line comments (don't eat URL ://)
}

describe('DEL-04: no model names in DeliberationSlot render path', () => {
  const source = readFileSync(PATH, 'utf-8')

  it('does not access modelVersions (model-version JSON must not reach render)', () => {
    expect(codeOnly(source)).not.toContain('modelVersions')
  })

  it('does not access run?.cost or run.cost (cost JSON must not reach render)', () => {
    expect(codeOnly(source)).not.toMatch(/run[?.]*.\.cost\b/)
  })

  it('contains no model-name literals in code (comment-stripped)', () => {
    const code = codeOnly(source).toLowerCase()
    for (const modelName of ['claude', 'gpt', 'sonnet', 'haiku', 'openrouter']) {
      expect(code).not.toContain(modelName)
    }
  })
})
