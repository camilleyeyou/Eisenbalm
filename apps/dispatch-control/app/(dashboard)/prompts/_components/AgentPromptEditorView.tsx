'use client'
/**
 * Phase 24 (PRM-01/PRM-02/PRM-03/PRM-06) — per-agent editor view.
 *
 * Client Component: loads the active version for the agent
 * (api.promptVersions.getActive), seeds the CodeMirror draft, and renders the
 * variable-aware PromptEditor (highlight + unknown-var save gate + save-as-
 * version) beside the VersionHistoryPanel.
 *
 * allowedVariables come from VARIABLE_REGISTRY[agentKey] (empty array when the
 * asset has no {tokens}, e.g. voice_constraints / rubric / section guidance).
 */
import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { useUser } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import { PromptEditor } from './PromptEditor'
import VersionHistoryPanel from './VersionHistoryPanel'
import TestRunPanel from './TestRunPanel'
import { VARIABLE_REGISTRY } from './VariableRegistry'

interface AgentPromptEditorViewProps {
  workspaceId: string
  agentKey: string
}

export default function AgentPromptEditorView({
  workspaceId,
  agentKey,
}: AgentPromptEditorViewProps) {
  const allowedVariables = VARIABLE_REGISTRY[agentKey] ?? []
  const { user } = useUser()

  const active = useQuery(api.promptVersions.getActive, {
    workspace_id: workspaceId,
    agentKey,
  })

  const [draft, setDraft] = useState('')
  const [seeded, setSeeded] = useState(false)

  // Seed the draft from the active version once it loads. Re-seed when the
  // agentKey changes (new editor target).
  useEffect(() => {
    setSeeded(false)
    setDraft('')
  }, [agentKey])

  useEffect(() => {
    if (active === undefined) return
    if (seeded) return
    setDraft(active?.content ?? '')
    setSeeded(true)
  }, [active, seeded])

  const loading = active === undefined && !seeded

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-neutral-900 font-mono">
            {agentKey}
          </h1>
          {allowedVariables.length > 0 ? (
            <span className="text-xs text-neutral-400">
              {allowedVariables.length} known variable
              {allowedVariables.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-xs text-neutral-400">no variables</span>
          )}
        </div>

        {allowedVariables.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allowedVariables.map(name => (
              <span
                key={name}
                className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs text-green-800"
              >
                {`{${name}}`}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <div className="h-64 bg-neutral-100 animate-pulse rounded" />
        ) : (
          <PromptEditor
            value={draft}
            onChange={setDraft}
            allowedVariables={allowedVariables}
            agentKey={agentKey}
            workspaceId={workspaceId}
            createdBy={user?.id}
            onSaved={() => {
              /* version list updates reactively via useQuery */
            }}
          />
        )}

        {/* Test-run the CURRENT unsaved draft (D-03) — does NOT run the
            pipeline. Wired to the live editor draft state above. */}
        {!loading && (
          <TestRunPanel
            workspaceId={workspaceId}
            agentKey={agentKey}
            draftPrompt={draft}
          />
        )}
      </div>

      <div className="lg:col-span-1">
        <VersionHistoryPanel workspaceId={workspaceId} agentKey={agentKey} />
      </div>
    </div>
  )
}
