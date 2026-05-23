/**
 * Phase 13 Wave 0 — Deliberation conversation render contract tests.
 *
 * Covers DEL-CONV-04 + DEL-CONV-06 render contract (DEL-P13-04).
 *
 * Two sections:
 *
 *   1. DEL-04 re-assertion (NOT skipped) — guards that the new conversation
 *      render code does not introduce model names. Runs immediately at Wave 1.
 *      (Complements the never-skipped deliberation-no-model-names.test.ts.)
 *
 *   2. Plan 13-03 conversation render assertions (SKIPPED until Plan 13-03) —
 *      gate that the DeliberationSlot gains the chat-thread markup:
 *        - class="del-conversation" thread wrapper
 *        - role="log" on the thread container
 *        - conversation prop wired
 *        - no dangerouslySetInnerHTML (safety rule D-12)
 *      Plan 13-03 removes the describe.skip.
 *
 * Pattern: readFileSync INSIDE each it() callback (Phase 9 rule — Vitest evaluates
 * describe bodies during collection, so module-scope reads of future files cause
 * collection errors; per-callback reads fail at run time only).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const DELIB_SLOT_PATH = resolve(
  __dirname,
  '../components/issue/DeliberationSlot.tsx'
)

/**
 * Strip block, JSX block, and line comments so model-name literals in
 * documentation prose do not trip the negative assertions.
 * Copied verbatim from issue-page-typography.test.ts (Phase 10).
 */
function codeOnly(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')       // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')   // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')     // line comments (don't eat URL ://)
}

// ─── DEL-04 re-assertion (always runs) ──────────────────────────────────────
//
// These assertions mirror deliberation-no-model-names.test.ts but apply to
// the extended DeliberationSlot that Plan 13-03 produces. Running them at
// Wave 1 ensures that the CURRENT file already satisfies DEL-04 before Plan
// 13-03 adds new code that could regress it.

describe('DEL-04 re-assertion: no model names in conversation render path', () => {
  it('does not access modelVersions in comment-stripped source', () => {
    const src = readFileSync(DELIB_SLOT_PATH, 'utf-8')
    expect(codeOnly(src)).not.toContain('modelVersions')
  })

  it('contains no model-name literals in code (scout/advocate/editor speakers only)', () => {
    const src = readFileSync(DELIB_SLOT_PATH, 'utf-8')
    const code = codeOnly(src).toLowerCase()
    for (const modelName of ['claude', 'gpt', 'sonnet', 'haiku', 'openrouter']) {
      expect(code).not.toContain(modelName)
    }
  })
})

// ─── Plan 13-03 conversation render contract (skip until Plan 13-03) ────────
//
// Un-skip this describe block in Plan 13-03 after extending DeliberationSlot
// with the chat-thread render. Each assertion below represents a concrete
// markup / prop contract for the conversation thread.

describe.skip('Plan 13-03 conversation render (un-skip when DeliberationSlot extended)', () => {
  it('contains class del-conversation (thread wrapper class for CSS targeting)', () => {
    const src = readFileSync(DELIB_SLOT_PATH, 'utf-8')
    expect(src).toContain('del-conversation')
  })

  it('contains role="log" (ARIA live region for the conversation thread)', () => {
    const src = readFileSync(DELIB_SLOT_PATH, 'utf-8')
    expect(src).toContain('role="log"')
  })

  it('accepts a conversation prop (new IssueDeliberationTurn[] prop from Plan 13-03)', () => {
    const src = readFileSync(DELIB_SLOT_PATH, 'utf-8')
    // The prop may appear as: conversation, conversation:, conversation?,
    // conversation =, etc. — a simple substring check is sufficient.
    expect(src).toContain('conversation')
  })

  it('does not use dangerouslySetInnerHTML in the conversation render path (D-12 safety)', () => {
    const src = readFileSync(DELIB_SLOT_PATH, 'utf-8')
    expect(codeOnly(src)).not.toContain('dangerouslySetInnerHTML')
  })
})
