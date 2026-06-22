/**
 * Phase 24 Wave 0 — RED smoke test for the PromptEditor wrapper (PRM-01).
 *
 * Runs in jsdom (matched by environmentMatchGlobs *.test.tsx → jsdom).
 *
 * PromptEditor wraps CodeMirror via next/dynamic({ ssr: false }) (24-RESEARCH
 * Pattern 1). In jsdom (no browser worker), the dynamic import resolves to the
 * loading skeleton rather than the full editor — so the smoke test accepts
 * EITHER the loading skeleton OR a mounted editor, asserting only that the
 * component mounts without throwing.
 *
 * RED until Plan 07 lands
 * app/(dashboard)/prompts/_components/PromptEditor. The import is guarded so the
 * file import-executes; the render runs only when the module exists.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

// Guard the not-yet-existing component.
let PromptEditor: React.ComponentType<{
  value: string
  onChange: (v: string) => void
  allowedVariables: string[]
}> | undefined

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PromptEditor = require('../app/(dashboard)/prompts/_components/PromptEditor').PromptEditor
} catch {
  PromptEditor = undefined
}

describe('PromptEditor smoke render (PRM-01)', () => {
  it('mounts without throwing and renders the dynamic placeholder or editor', () => {
    expect(PromptEditor).toBeDefined()

    // `PromptEditor` is `T | undefined` behind the require-guard; alias to a
    // capitalized const so it can be used as a JSX element (a non-null
    // assertion in tag position — `<PromptEditor!>` — is invalid TS syntax).
    const Editor = PromptEditor!
    const { container } = render(
      <Editor
        value={'You are {charity_name}.'}
        onChange={() => {}}
        allowedVariables={['charity_name']}
      />,
    )

    // Accept either the ssr:false loading skeleton or the mounted CodeMirror.
    expect(container.firstChild).not.toBeNull()
  })
})
