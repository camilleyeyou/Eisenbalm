/**
 * DEL-06 (ROUTE side) — /agents/[agentId] route file source-scan.
 *
 * Unskipped in Plan 09-03 when apps/web/app/agents/[agentId]/page.tsx was created.
 * All assertions are active (no skipped blocks).
 *
 * Asserted behaviors (against app/agents/[agentId]/page.tsx source):
 *   DEL-06: Route uses the agent-profile query (QUERY_AGENT_PROFILE_BY_ID or
 *            QUERY_AGENT_PROFILES) so the agent identity page resolves correctly.
 *   DEL-06: Route calls notFound() for graceful 404 on unknown/synthetic agent IDs.
 *   DEL-04: No model-name literals in the route code path (comment-stripped).
 *   DEL-04: Route never reads pipelineRuns.cost (no run?.cost access).
 *
 * Mirrors the source-scan style of game-sandbox.test.ts (Phase 7 GAM-03).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Strip block, JSX block, and line comments so model-name literals in
 * documentation prose do not trip the negative assertions.
 * Mirrors the codeOnly() helper in issue-page-typography.test.ts.
 * Defined at module scope so it is available inside it() callbacks.
 */
function codeOnly(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')        // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')    // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')      // line comments (don't eat URL ://)
}

describe('DEL-06: /agents/[agentId] route', () => {
  // readFileSync is inside each it() callback — safe now that the file exists.
  const PATH = resolve(__dirname, '../app/agents/[agentId]/page.tsx')

  it('uses the agent-profile query (QUERY_AGENT_PROFILE_BY_ID or QUERY_AGENT_PROFILES)', () => {
    const source = readFileSync(PATH, 'utf-8')
    expect(source).toMatch(/QUERY_AGENT_PROFILE_BY_ID|QUERY_AGENT_PROFILES/)
  })

  it('calls notFound() for graceful 404 on unknown/synthetic agent IDs', () => {
    const source = readFileSync(PATH, 'utf-8')
    expect(source).toContain('notFound(')
  })

  it('contains no model-name literals in the route code path (comment-stripped)', () => {
    const source = readFileSync(PATH, 'utf-8')
    const code = codeOnly(source).toLowerCase()
    for (const modelName of ['modelversions', 'claude', 'sonnet', 'haiku', 'gpt', 'openrouter']) {
      expect(code).not.toContain(modelName)
    }
  })

  it('never reads pipelineRuns.cost (no run?.cost access in route)', () => {
    const source = readFileSync(PATH, 'utf-8')
    expect(codeOnly(source)).not.toMatch(/run[?.]*.\.cost\b/)
  })
})
