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
 *
 * Phase 50 (WBN-04, D-13, docs/API_CONTRACTS.md §4A.2c): renders "why this
 * draft exists" — a stored back-reference to the issue output that
 * motivated a draft, carried in from the inspector's "Improve this agent →"
 * deep link (`deepLinkOrigin`, via [agentKey]/page.tsx's `fromRun`/`section`/
 * `excerpt` query params) or already persisted on the active version
 * (`active.originRef`, once a deep-linked save has landed). The persisted
 * value wins once it exists — the deep-link params are the pre-save preview
 * of the same fact. No origin from either source => renders nothing (D-13:
 * a stored reference, never a guess).
 *
 * quick 260724-lp1: restyled to the mockup-06 editor-card idiom (bg card,
 * 1px faint border, mono kicker + Newsreader heading, hard-edged
 * ghost/primary buttons, card-alt code pane, square chips for
 * drift/unsaved/variable badges). Same save/test/history handlers, same
 * effects, same state.
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import { useUser } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import { PromptEditor } from './PromptEditor'
import VersionHistoryPanel from './VersionHistoryPanel'
import TestRunPanel from './TestRunPanel'
import EvalDrawer from './EvalDrawer'
import PromptMarkerExport from './PromptMarkerExport'
import VariableChips from './VariableChips'
import AssembledPreview from './AssembledPreview'
import { VARIABLE_REGISTRY } from './VariableRegistry'
import { descriptionFor } from './promptDescriptions'
import type { PromptOriginRef } from './promptOrigin'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const CHIP_BASE =
  'inline-block border px-2 py-[3px] font-[family-name:var(--font-mono)] text-[9.5px] tracking-[.09em] uppercase whitespace-nowrap'

function DriftBadge() {
  return (
    <span
      className={`${CHIP_BASE} border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] text-[color:var(--color-marigold-text)]`}
    >
      edited since seed
    </span>
  )
}

/**
 * Phase 50 (WBN-04, D-13) — the "why this draft exists" bridge. Split out as
 * its own named export (rather than inlined in the default export below) so
 * it can be unit-tested in isolation from the rest of this view's heavy
 * dependency tree (VersionHistoryPanel -> useRole/useUser/EvalDrawer, etc.)
 * — see __tests__/promptVersionOrigin.test.ts. Renders NOTHING when
 * `originRef` is absent (D-13: a stored reference, never a guess).
 */
export function OriginBanner({ originRef }: { originRef?: PromptOriginRef }) {
  if (!originRef) return null
  return (
    <div
      aria-label="why this draft exists"
      className="border border-[color:var(--color-marigold)] border-l-[3px] bg-[color:var(--color-marigold)]/10 p-3 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-marigold-text)]"
    >
      <p className="font-semibold">why this draft exists</p>
      <p className="mt-1">
        This draft exists because of {originRef.sectionName} in run{' '}
        <span className="font-[family-name:var(--font-mono)]">{originRef.runId}</span>:{' '}
        <span className="italic">&ldquo;{originRef.excerpt}&rdquo;</span>
      </p>
      <Link
        href={`/run-monitor/runs/${encodeURIComponent(originRef.runId)}`}
        className="mt-1 inline-block font-semibold underline underline-offset-2"
      >
        View the motivating output →
      </Link>
    </div>
  )
}

interface AgentPromptEditorViewProps {
  workspaceId: string
  agentKey: string
  /** Phase 50 (WBN-04, D-13) — assembled from the "Improve this agent →" deep-link query params. */
  deepLinkOrigin?: PromptOriginRef
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
  deepLinkOrigin,
}: AgentPromptEditorViewProps) {
  const allowedVariables = VARIABLE_REGISTRY[agentKey] ?? []
  const { user } = useUser()
  const confirm = useConfirm()

  const active = useQuery(api.promptVersions.getActive, {
    workspace_id: workspaceId,
    agentKey,
  })

  // Phase 50 (WBN-04, D-13) — the persisted origin (once a deep-linked save
  // has landed on the active version) wins over the deep-link params still
  // sitting in the URL for this session; either alone is enough to render
  // "why this draft exists". Neither present => undefined => renders nothing.
  const originRef: PromptOriginRef | undefined = active?.originRef ?? deepLinkOrigin

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

  // PRC-03 dirty tracking: the draft diverges from the active version, or (for
  // an unseeded key) has any content. Used by the visible indicator + guards.
  const dirty =
    active != null ? draft !== active.content : draft.trim().length > 0

  // Keep a ref of the latest dirty value so the agentKey-switch effect (which
  // only runs on [agentKey]) can read it without re-subscribing.
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const prevAgentKeyRef = useRef(agentKey)

  // Seed the draft from the active version once it loads. Re-seed when the
  // agentKey changes (new editor target). Also reset to view-first on switch.
  // PRC-03: when the prior key's draft was dirty, fire an in-app confirm before
  // discarding it. The route has already navigated to the new key by the time
  // this effect runs, so the reset proceeds regardless of the operator's
  // choice — the requirement is that the CONFIRM fires (a visible heads-up that
  // unsaved work on the previous prompt is being abandoned).
  useEffect(() => {
    if (prevAgentKeyRef.current !== agentKey && dirtyRef.current) {
      // Fire-and-forget: the route has already navigated to the new key by
      // the time this effect runs, so the reset below proceeds regardless of
      // the operator's choice — this is a visible heads-up, not a gate.
      void confirm({ title: 'Unsaved changes', body: 'You have unsaved changes. Leave the editor?' })
    }
    prevAgentKeyRef.current = agentKey
    setSeeded(false)
    setDraft('')
    setEditing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey])

  useEffect(() => {
    if (active === undefined) return
    if (seeded) return
    setDraft(active?.content ?? '')
    setSeeded(true)
  }, [active, seeded])

  // PRC-03: view-toggle guard — confirm before leaving the editor when dirty.
  async function requestStopEditing() {
    if (dirty) {
      const confirmed = await confirm({
        title: 'Unsaved changes',
        body: 'You have unsaved changes. Leave the editor?',
        confirmLabel: 'Leave anyway',
        tone: 'danger',
      })
      if (!confirmed) return
    }
    setEditing(false)
  }

  const loading = active === undefined && !seeded

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div>
          <span className="font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.1em] text-[color:var(--color-cobalt)]">
            Agent instruction
          </span>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="font-[family-name:var(--font-display)] text-[20px] font-semibold text-[color:var(--color-ink)]">
              {agentKey}
            </h1>
            {allowedVariables.length > 0 ? (
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
                {allowedVariables.length} known variable
                {allowedVariables.length !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
                no variables
              </span>
            )}
          </div>
        </div>

        {description && (
          <p className="font-[family-name:var(--font-body)] italic text-[13px] text-[color:var(--color-ink-soft)]">
            {description}
          </p>
        )}

        {/* Phase 50 (WBN-04, D-13) — the Flow-C bridge: renders ONLY when a
            real origin exists (deep-link params or a persisted originRef),
            never a guess, never rendered for the common no-origin case. */}
        <OriginBanner originRef={originRef} />

        {allowedVariables.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allowedVariables.map(name => (
              <span
                key={name}
                className={`${CHIP_BASE} border-[color:var(--color-green)] bg-[color:var(--color-green)]/[0.07] text-[color:var(--color-green)]`}
              >
                {`{${name}}`}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <div className="h-64 bg-[color:var(--color-card-alt)] animate-pulse" />
        ) : editing ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-[color:var(--color-faint)] pb-2">
              <span className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
                {active
                  ? `Editing — active v${active.version} · updated ${formatTimestamp(active.createdAt)}`
                  : 'Editing — no active version yet'}
                {drifted && <DriftBadge />}
                {dirty && (
                  <span
                    className={`${CHIP_BASE} border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] text-[color:var(--color-marigold-text)]`}
                  >
                    unsaved changes
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={requestStopEditing}
                className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-card)] px-3 py-1 font-[family-name:var(--font-ui)] text-[12px] font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
              >
                Done / View
              </button>
            </div>

            {/* PRC-05: click-to-insert variable chips + unused hint above the
                editor. Append-at-end insertion (CodeMirror cursor insertion is
                optional polish). */}
            <VariableChips
              allowed={allowedVariables}
              draft={draft}
              onInsert={t => setDraft(d => d + t)}
            />

            <PromptEditor
              value={draft}
              onChange={setDraft}
              allowedVariables={allowedVariables}
              agentKey={agentKey}
              workspaceId={workspaceId}
              createdBy={user?.id}
              // Phase 50 (WBN-04, D-13) — ONLY the deep-link's own origin is
              // forwarded to the save mutation (not the merged `originRef`,
              // which may already be the persisted value from a PRIOR save —
              // re-stamping it on every subsequent edit would misattribute
              // later, unrelated edits to the original motivating output).
              originRef={deepLinkOrigin}
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

            {/* Phase 38 (EVL-02, D-04/D-05) — the quality test drawer:
                auto-selects this agent's standard test cases and runs the
                N-scenario draft-vs-active scoreboard on demand. No
                targetVersion here — this is the normal iteration loop (draft
                side tags promptVersion:'draft', source:'drawer'). §38.3
                freshness workflow: after Save-as-version, test changes again
                against the SAVED version's content from VersionHistoryPanel's
                "Test changes for v{N}" producer (Task 3) BEFORE activating
                it, so the activation check has a fresh, target-version-tagged
                score to read. */}
            <EvalDrawer
              workspaceId={workspaceId}
              agentKey={agentKey}
              draftPrompt={draft}
            />

            {/* PRC-06: instant client-side assembled-with-sample-values preview.
                Readability aid only — no server call. */}
            <AssembledPreview draft={draft} allowed={allowedVariables} />
          </>
        ) : active ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-[color:var(--color-faint)] pb-2">
              <span className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
                active v{active.version} · updated{' '}
                {formatTimestamp(active.createdAt)}
                {drifted && <DriftBadge />}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1 font-[family-name:var(--font-ui)] text-[12px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
              >
                Edit
              </button>
            </div>

            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] p-4 font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-ink)]">
              {active.content}
            </pre>

            <PromptMarkerExport content={active.content} />
          </>
        ) : (
          /* EMPTY / no starting version yet: loaded with no active version. */
          <div className="space-y-3 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-6 text-center">
            <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
              This prompt has no starting version yet.
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1 font-[family-name:var(--font-ui)] text-[12px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
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
