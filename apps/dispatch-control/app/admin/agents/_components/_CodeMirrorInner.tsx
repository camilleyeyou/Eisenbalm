'use client'
/**
 * Phase 24 (PRM-01/PRM-02) — browser-only CodeMirror editor body.
 *
 * Loaded exclusively via next/dynamic({ ssr: false }) from PromptEditor
 * (24-RESEARCH Pattern 1) — never rendered on the server, since CodeMirror
 * touches window/document.
 *
 * The `{variable}` highlight extension is rebuilt via useMemo keyed on
 * `allowedVariables` (Pitfall 1 — without this, switching agents would leave
 * the highlighter closed over the previous agent's allowed set).
 */
import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { variableHighlighter } from './variableHighlightExtension'

interface CodeMirrorInnerProps {
  value: string
  onChange: (value: string) => void
  allowedVariables: string[]
}

export default function CodeMirrorInner({
  value,
  onChange,
  allowedVariables,
}: CodeMirrorInnerProps) {
  // Rebuild the extension array whenever the allowed set changes so the
  // highlighter re-decorates against the current agent's registry (Pitfall 1).
  const extensions = useMemo(
    () => [markdown(), variableHighlighter(allowedVariables)],
    [allowedVariables],
  )

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="light"
      className="cm-prompt-editor border border-[color:var(--color-faint)] font-[family-name:var(--font-mono)] text-sm"
      basicSetup={{ lineNumbers: true, foldGutter: false }}
    />
  )
}
