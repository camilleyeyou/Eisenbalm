/**
 * Phase 13 Wave 0 — Deliberation conversation render contract tests.
 *
 * Covers DEL-CONV-04 + DEL-CONV-06 render contract (DEL-P13-04).
 *
 * Phase 19 UPDATE (Plan 03): DeliberationSlot rewritten as the dark-band
 * centerpiece. The conversation render is now in DelibChat.tsx:
 *   - class="del-conversation" was the Phase 13 wrapper class (now replaced
 *     by DelibChat component with role="log" + aria-live="polite")
 *   - role="log" is in DelibChat.tsx (not DeliberationSlot.tsx directly)
 *   - conversation prop is still wired through DeliberationSlot → DelibChat
 *   - dangerouslySetInnerHTML is still absent (D-12)
 *
 * Two sections:
 *
 *   1. DEL-04 re-assertion (NOT skipped) — guards that the conversation
 *      render code does not introduce model names.
 *
 *   2. Plan 13-03 conversation render assertions — updated for Phase 19:
 *      checks both DeliberationSlot.tsx (conversation prop) and DelibChat.tsx
 *      (role="log", aria-live, no dangerouslySetInnerHTML).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const DELIB_SLOT_PATH = resolve(
  __dirname,
  '../components/issue/DeliberationSlot.tsx'
)

const DELIB_CHAT_PATH = resolve(
  __dirname,
  '../components/issue/DelibChat.tsx'
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
// the rewritten DeliberationSlot. Running them at all times ensures DEL-04
// is met before and after Phase 19.

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

// ─── Plan 13-03 / Phase 19 conversation render contract ─────────────────────
//
// Phase 19 Plan 03 UPDATE: conversation render moved to DelibChat.tsx.
// Assertions updated to check the right component.

describe('Phase 19 conversation render (DelibChat.tsx + DeliberationSlot)', () => {
  it('DelibChat.tsx has role="log" (ARIA live region for staggered reveal)', () => {
    // Phase 19 Plan 03: role="log" is on the motion.div container in DelibChat.tsx
    const src = readFileSync(DELIB_CHAT_PATH, 'utf-8')
    expect(src).toContain('role="log"')
  })

  it('DelibChat.tsx has aria-live="polite" for screen reader compat', () => {
    const src = readFileSync(DELIB_CHAT_PATH, 'utf-8')
    expect(src).toContain('aria-live="polite"')
  })

  it('DeliberationSlot accepts a conversation prop (IssueDeliberationTurn[])', () => {
    const src = readFileSync(DELIB_SLOT_PATH, 'utf-8')
    // The prop appears as: conversation: ConversationTurn[] | null
    expect(src).toContain('conversation')
  })

  it('DelibChat.tsx does not use dangerouslySetInnerHTML (D-12 safety)', () => {
    const src = readFileSync(DELIB_CHAT_PATH, 'utf-8')
    expect(codeOnly(src)).not.toContain('dangerouslySetInnerHTML')
  })

  it('DeliberationSlot does not use dangerouslySetInnerHTML (D-12 safety)', () => {
    const src = readFileSync(DELIB_SLOT_PATH, 'utf-8')
    expect(codeOnly(src)).not.toContain('dangerouslySetInnerHTML')
  })
})
