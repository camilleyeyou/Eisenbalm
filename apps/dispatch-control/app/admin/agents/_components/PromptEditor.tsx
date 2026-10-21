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
 *   - The "Save draft as new version" button is DISABLED whenever unknown
 *     tokens are present (the save-blocking gate) — distinct from the visual
 *     decoration.
 *
 * Controlled value is required (`value`/`onChange`) so the host page owns the
 * draft. When `agentKey` + `workspaceId` are supplied, the save-as-version
 * flow (PromptSaveDialog → promptVersions.saveVersion) is rendered too.
 */
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { findUnknownVariables } from './VariableRegistry'
import { PromptSaveDialog } from './PromptSaveDialog'
import type { PromptOriginRef } from './promptOrigin'

const CodeMirrorEditor = dynamic(() => import('./_CodeMirrorInner'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-[color:var(--color-card-alt)] animate-pulse" aria-hidden />
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
  /**
   * Phase 50 (WBN-04, D-13) — when the host's draft was opened from the
   * inspector's "Improve this agent →" deep link, forwarded straight
   * through to `promptVersions.saveVersion` so the "why this draft exists"
   * bridge persists on the new version. Undefined for every ordinary
   * (non-deep-linked) save.
   */
  originRef?: PromptOriginRef
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
  originRef,
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
          className="border border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)]/[0.08] px-3 py-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-vermilion)]"
        >
          <ul className="mt-1 space-y-1">
            {unknown.map(name => (
              <li key={name}>
                <span className="border border-[color:var(--color-vermilion)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px]">
                  {`{${name}}`}
                </span>{' '}
                {
                  "isn't supplied by the pipeline — remove it or ask your developer to wire it"
                }
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
              className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-2 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                hasUnknown
                  ? `{${unknown[0]}} isn't supplied by the pipeline — remove it or ask your developer to wire it`
                  : 'Save the current draft as a new version'
              }
            >
              Save draft as new version
            </button>
          ) : (
            <PromptSaveDialog
              workspaceId={workspaceId}
              agentKey={agentKey}
              content={value}
              createdBy={createdBy}
              originRef={originRef}
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
