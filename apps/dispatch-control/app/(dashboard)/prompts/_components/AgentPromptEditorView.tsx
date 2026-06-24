'use client'
/**
 * Phase 24 (PRM-01/PRM-02/PRM-03/PRM-06) + quick 260624-4ru (view-first).
 *
 * Client Component: loads the active version for the agent
 * (api.promptVersions.getActive), seeds the CodeMirror draft, and renders a
 * view-first read-only pane FIRST (active prompt + metadata + variable chips).
 * An explicit Edit button reveals the variable-aware PromptEditor (highlight +
 * unknown-var save gate + save-as-version) and TestRunPanel — all existing
 * editing behavior preserved. VersionHistoryPanel stays mounted in both states.
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
import PromptMarkerExport from './PromptMarkerExport'
import { VARIABLE_REGISTRY } from './VariableRegistry'
import { descriptionFor } from './promptDescriptions'

function DriftBadge() {
  return (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
      edited since seed
    </span>
  )
}

interface AgentPromptEditorViewProps {
  workspaceId: string
  agentKey: string
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

  // PRC-02 drift: compare active content against the v1 seed for this key.
  const seedV1 = useQuery(api.promptVersions.getByVersion, {
    workspace_id: workspaceId,
    agentKey,
    version: 1,
  })
  const drifted =
    active != null && seedV1 != null && active.content !== seedV1.content

  const description = descriptionFor(agentKey)

  const [draft, setDraft] = useState('')
  const [seeded, setSeeded] = useState(false)
  // View-first: default to the read-only pane; Edit reveals the editor.
  const [editing, setEditing] = useState(false)

  // Seed the draft from the active version once it loads. Re-seed when the
  // agentKey changes (new editor target). Also reset to view-first on switch.
  useEffect(() => {
    setSeeded(false)
    setDraft('')
    setEditing(false)
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

        {description && (
          <p className="text-sm text-neutral-500">{description}</p>
        )}

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
        ) : editing ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs text-neutral-500">
                {active
                  ? `Editing — active v${active.version} · updated ${formatTimestamp(active.createdAt)}`
                  : 'Editing — no active version yet'}
                {drifted && <DriftBadge />}
              </span>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 min-h-[44px]"
              >
                Done / View
              </button>
            </div>

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

            {/* Test-run the CURRENT unsaved draft (D-03) — does NOT run the
                pipeline. Wired to the live editor draft state above. */}
            <TestRunPanel
              workspaceId={workspaceId}
              agentKey={agentKey}
              draftPrompt={draft}
            />
          </>
        ) : active ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs text-neutral-500">
                active v{active.version} · updated{' '}
                {formatTimestamp(active.createdAt)}
                {drifted && <DriftBadge />}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 min-h-[44px]"
              >
                Edit
              </button>
            </div>

            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-4 font-mono text-sm text-neutral-800">
              {active.content}
            </pre>

            <PromptMarkerExport content={active.content} />
          </>
        ) : (
          /* EMPTY / never-seeded: loaded with no active version. */
          <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-6 text-center">
            <p className="text-sm text-neutral-500">
              This prompt has not been seeded yet.
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 min-h-[44px]"
            >
              Create first version
            </button>
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <VersionHistoryPanel workspaceId={workspaceId} agentKey={agentKey} />
      </div>
    </div>
  )
}
