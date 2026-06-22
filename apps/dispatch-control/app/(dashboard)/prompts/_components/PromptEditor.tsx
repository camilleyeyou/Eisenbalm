'use client'
/**
 * Phase 24 (PRM-01/PRM-02/PRM-03) — the variable-aware prompt editor.
 *
 * SSR-safe: the CodeMirror body is dynamically imported with { ssr: false }
 * (24-RESEARCH Pattern 1) so the server never touches window/document — in
 * jsdom (no browser worker) the dynamic import resolves to the loading
 * skeleton, which is why the smoke test accepts either skeleton or editor.
 *
 * Variable awareness (PRM-02):
 *   - The CodeMirror body highlights known vs unknown/mangled {tokens}.
 *   - This component computes `findUnknownVariables(value, allowedVariables)`
 *     live and renders a warning banner listing any unknown tokens.
 *   - The "Save as new version" button is DISABLED whenever unknown tokens are
 *     present (the save-blocking gate) — distinct from the visual decoration.
 *
 * Controlled value is required (`value`/`onChange`) so the host page owns the
 * draft. When `agentKey` + `workspaceId` are supplied, the save-as-version
 * flow (PromptSaveDialog → promptVersions.saveVersion) is rendered too.
 */
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { findUnknownVariables } from './VariableRegistry'
import { PromptSaveDialog } from './PromptSaveDialog'

const CodeMirrorEditor = dynamic(() => import('./_CodeMirrorInner'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-neutral-100 animate-pulse rounded" aria-hidden />
  ),
})

interface PromptEditorProps {
  value: string
  onChange: (value: string) => void
  allowedVariables: string[]
  /** When provided, enables the save-as-new-version flow. */
  agentKey?: string
  workspaceId?: string
  createdBy?: string
  /** Called after a version is saved (host clears its dirty flag / refreshes). */
  onSaved?: () => void
}

export function PromptEditor({
  value,
  onChange,
  allowedVariables,
  agentKey,
  workspaceId,
  createdBy,
  onSaved,
}: PromptEditorProps) {
  const [showSave, setShowSave] = useState(false)

  const unknown = findUnknownVariables(value, allowedVariables)
  const hasUnknown = unknown.length > 0
  const canSave = Boolean(agentKey && workspaceId) && !hasUnknown

  return (
    <div className="space-y-3">
      <CodeMirrorEditor
        value={value}
        onChange={onChange}
        allowedVariables={allowedVariables}
      />

      {hasUnknown && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <p className="font-medium">
            Unknown variable{unknown.length > 1 ? 's' : ''} — fix before saving:
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {unknown.map(name => (
              <li
                key={name}
                className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs"
              >
                {`{${name}}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {agentKey && workspaceId && (
        <div className="space-y-3">
          {!showSave ? (
            <button
              type="button"
              onClick={() => setShowSave(true)}
              disabled={!canSave}
              className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              title={
                hasUnknown
                  ? 'Resolve unknown variables before saving'
                  : 'Save the current draft as a new version'
              }
            >
              Save as new version
            </button>
          ) : (
            <PromptSaveDialog
              workspaceId={workspaceId}
              agentKey={agentKey}
              content={value}
              createdBy={createdBy}
              disabled={hasUnknown}
              onSaved={() => {
                setShowSave(false)
                onSaved?.()
              }}
              onCancel={() => setShowSave(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}
