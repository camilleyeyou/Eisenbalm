'use client'
/**
 * Phase 24 (PRM-04) — version-history list + compare for one agent.
 *
 * Subscribes to api.promptVersions.listForAgent (newest-first) and renders each
 * version's number, author, timestamp, note, and an "Active" badge.
 *
 * Plan 08 adds:
 *   - a two-version compare selector (pick A + B) that renders <DiffViewer> for
 *     the chosen pair (default A = active version, B = the selected version).
 *   - per-version "Make active" / "Restore this version" controls (Phase 50
 *     WBN-05 renamed from "Make live") wired to api.promptVersions.activate.
 *     Restore IS activate(olderVersion) — no separate call. The control is
 *     DISABLED while a run is in progress (api.runs.latest.status ===
 *     'running'), with an inline explanation (D-02 block-with-explanation, no
 *     queue). On a server-side `{ blocked }` return (TOCTOU race, Pitfall 2)
 *     the reason is surfaced inline.
 *
 * Phase 38 Plan 38-04 (§38.3, EVL-03) adds:
 *   - when a `{ blocked: true, reason }` comes back from the NEW eval
 *     deterministic check (not the in-progress guard — that keeps the run
 *     disabled entirely, per D-02), a typed-reason override affordance
 *     appears: an input for the operator's justification + "Make active
 *     anyway (override)" button (Phase 50 WBN-05 renamed from "Commit
 *     anyway"). Submitting calls activate again with `override: { reason }`;
 *     a `{ overridden: true }` response clears the blocked state. The
 *     override is NEVER offered while a run is in progress — that guard is
 *     unbypassable by design.
 *
 * Phase 38 Plan 38-05 Task 3 (closes the plan-review Blocker 1) adds:
 *   - a "Test changes for v{N}" affordance (Phase 50 WBN-05 renamed from "Run
 *     evals for v{N}") on every NON-active version row. It toggles an inline
 *     <EvalDrawer> mounted with `draftPrompt = that version's SAVED content`
 *     and `targetVersion={{ version: N }}` — this is the producer that writes
 *     the activation-tagged (`promptVersion: String(N)`, `source: 'commit'` —
 *     the STORED enum value stays byte-unchanged, D-14) eval_scores rows the
 *     §38.3 check above reads before allowing Activate(N) to pass without an
 *     override. Without this affordance, every activation after the first
 *     would force-block into the override path (there is never a fresh
 *     scored row for the version being activated). Does NOT alter the
 *     Activate/override logic itself.
 *
 * quick 260722-tv1: the version list caps to the latest 20 (`versions` is
 * newest-first, so `slice(0, 20)`) with a "Show older" toggle — an unbounded
 * list ran indefinitely long for an agent with a long version history.
 *
 * quick 260724-lp1: token/radius hygiene — off the generic Tailwind grey/
 * amber/red/green/blue palette and onto 1c tokens, hard edges (no
 * rounded-lg / rounded-full). Same subscriptions, mutations, handlers, and
 * state.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useUser } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import { DiffViewer } from './DiffViewer'
import EvalDrawer from './EvalDrawer'
import { useRole } from '@/lib/role'
import { LockedControl } from '@/components/LockedControl'
import HelpTip from '@/components/ui/HelpTip'
import { HELP_COPY } from '@/components/help/helpCopy'

interface VersionHistoryPanelProps {
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

export default function VersionHistoryPanel({
  workspaceId,
  agentKey,
}: VersionHistoryPanelProps) {
  const versions = useQuery(api.promptVersions.listForAgent, {
    workspace_id: workspaceId,
    agentKey,
  })

  const { user } = useUser()
  const activateVersion = useMutation(api.promptVersions.activate)
  // ROL-03 (D-09): presentation-only client hint — the server
  // `requireEditor` Convex helper (Plan 49-04) is the authoritative gate.
  const isLocked = useRole() !== 'Editor-in-chief'

  // In-progress signal: reuse the dashboard's existing runs query. A run with
  // status 'running' for this workspace disables activation (D-02).
  const latestRun = useQuery(api.runs.latest, { workspace_id: workspaceId })
  const runInProgress = latestRun?.status === 'running'

  // Per-version activation state (which version is mid-activation) + any
  // server-returned block reason (defensive TOCTOU surface, Pitfall 2).
  const [activating, setActivating] = useState<number | null>(null)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  // Phase 38 §38.3: which version the eval-gate blocked, so the override
  // affordance re-submits activation for the SAME version. Never set while
  // runInProgress — that guard stays a hard disable, no override offered.
  const [blockedVersion, setBlockedVersion] = useState<number | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  // Phase 38 Plan 38-05 Task 3: which non-active version's eval-producer
  // drawer is currently expanded (at most one at a time — toggled per row).
  const [evalOpenVersion, setEvalOpenVersion] = useState<number | null>(null)

  // quick 260722-tv1: latest-20 cap for the version list below.
  const [showAllVersions, setShowAllVersions] = useState(false)

  async function handleActivate(version: number, override?: { reason: string }) {
    if (!override) {
      setBlockedReason(null)
      setBlockedVersion(null)
    }
    setActivating(version)
    try {
      const result = await activateVersion({
        workspace_id: workspaceId,
        agentKey,
        version,
        actorId: user?.id ?? 'unknown',
        ...(override ? { override } : {}),
      })
      if (result?.blocked) {
        setBlockedVersion(version)
        setBlockedReason(
          result.reason ??
            'A run is in progress — activation will be available when it finishes.',
        )
      } else {
        // Clean pass OR a successful override — clear any blocked state.
        setBlockedReason(null)
        setBlockedVersion(null)
        setOverrideReason('')
      }
    } finally {
      setActivating(null)
    }
  }

  // Compare selector state: which two versions to diff. Null until the user
  // picks; defaults are derived (A = active, B = newest non-active) below.
  const [compareA, setCompareA] = useState<number | null>(null)
  const [compareB, setCompareB] = useState<number | null>(null)

  const activeVersion = useMemo(
    () => versions?.find(v => v.isActive)?.version ?? null,
    [versions],
  )

  // Resolve the effective pair: explicit selection, else sensible defaults.
  const effectiveA = compareA ?? activeVersion ?? versions?.[0]?.version ?? null
  const effectiveB =
    compareB ??
    versions?.find(v => v.version !== effectiveA)?.version ??
    effectiveA

  const rowA = versions?.find(v => v.version === effectiveA) ?? null
  const rowB = versions?.find(v => v.version === effectiveB) ?? null
  const canCompare =
    rowA !== null && rowB !== null && rowA.version !== rowB.version

  if (versions === undefined) {
    return (
      <div className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] py-4">
        Loading versions…
      </div>
    )
  }

  // versions is newest-first — the first 20 are the most recent.
  const visibleVersions = showAllVersions ? versions : versions.slice(0, 20)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[color:var(--color-ink)]">
            Version history
          </h2>
          <HelpTip text={HELP_COPY.promptLab.activate} label="Explain make active / restore" />
        </div>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
          {versions.length === 0
            ? 'No versions'
            : `${versions.length} version${versions.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {runInProgress && (
        <div
          role="status"
          className="border border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-marigold-text)]"
        >
          A run is in progress — activation will be available when it finishes.
        </div>
      )}

      {blockedReason && (
        <div
          role="alert"
          className="border border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[0.1] px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-marigold-text)]"
        >
          {blockedReason}
        </div>
      )}

      {/* Phase 38 §38.3 — quality-test override-with-reason escape hatch.
          NEVER shown while a run is in progress: that guard is unbypassable,
          so no override is offered for it (D-02 stays a hard block). */}
      {blockedReason && blockedVersion !== null && !runInProgress && (
        <div className="space-y-2 border border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)]/[0.06] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="font-[family-name:var(--font-ui)] text-[12px] font-medium text-[color:var(--color-vermilion)]">
              Quality-test override
            </span>
            <HelpTip text={HELP_COPY.promptLab.evalGate} label="Explain the eval gate" />
          </div>
          <label className="block font-[family-name:var(--font-ui)] text-[12px] font-medium text-[color:var(--color-vermilion)]">
            Override reason (required to make active anyway)
            <input
              type="text"
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="Why activate despite the failing quality test?"
              className="mt-1 block w-full min-h-[44px] border border-[color:var(--color-vermilion)] bg-[color:var(--color-card)] px-2 py-1.5 font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              handleActivate(blockedVersion, { reason: overrideReason.trim() })
            }
            disabled={overrideReason.trim().length === 0 || activating !== null}
            className="min-h-[44px] border border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)] px-3 py-1 font-[family-name:var(--font-ui)] text-[12px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
          >
            {activating === blockedVersion
              ? 'Making active anyway…'
              : 'Make active anyway (override)'}
          </button>
        </div>
      )}

      {versions.length === 0 ? (
        <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-6 text-center">
          <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            No versions yet — save the current draft to create version 1.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-faint)] border border-[color:var(--color-faint)] bg-[color:var(--color-card)]">
          {visibleVersions.map(v => (
            <li key={v._id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[color:var(--color-ink)]">
                  v{v.version}
                </span>
                {v.isActive && (
                  <span className="inline-block border border-[color:var(--color-green)] bg-[color:var(--color-green)]/[0.07] px-2 py-[3px] font-[family-name:var(--font-mono)] text-[9.5px] tracking-[.09em] uppercase text-[color:var(--color-green)]">
                    Active
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 font-[family-name:var(--font-mono)] text-[10.5px] text-[color:var(--color-ink-soft)]">
                <span className="whitespace-nowrap">
                  {formatTimestamp(v.createdAt)}
                </span>
                {v.createdBy && (
                  <span className="whitespace-nowrap">
                    {v.createdBy}
                  </span>
                )}
              </div>
              {v.note && (
                <p className="mt-1 font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink-soft)]">
                  {v.note}
                </p>
              )}
              {/* Activate / restore control (PRM-04, Phase 50 WBN-05: "Make
                  active" / "Restore version"). Restore == activate of an
                  older version; same mutation, label differs. */}
              <div
                data-rollback-mount={`${agentKey}:${v.version}`}
                className="mt-2"
              >
                {v.isActive ? (
                  <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-[color:var(--color-faint)]">
                    Currently active
                  </span>
                ) : (
                  <LockedControl
                    isLocked={isLocked}
                    lockedLabel="Make active 🔒 Editor-in-chief only"
                  >
                    <button
                      type="button"
                      onClick={() => handleActivate(v.version)}
                      disabled={runInProgress || activating !== null}
                      title={
                        runInProgress
                          ? 'A run is in progress — activation will be available when it finishes.'
                          : activeVersion !== null && v.version < activeVersion
                            ? `Restore v${v.version}`
                            : `Make active v${v.version}`
                      }
                      className="min-h-[44px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-2.5 py-1 font-[family-name:var(--font-ui)] text-[12px] font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {activating === v.version
                        ? 'Making active…'
                        : activeVersion !== null && v.version < activeVersion
                          ? 'Restore this version'
                          : 'Make active'}
                    </button>
                  </LockedControl>
                )}
              </div>

              {/* Phase 38 Plan 38-05 Task 3 — freshness producer. Only on
                  non-active rows (the active version has nothing to commit;
                  it's already the baseline the gate compares against). */}
              {!v.isActive && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEvalOpenVersion(prev => (prev === v.version ? null : v.version))
                    }
                    className="min-h-[44px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-2.5 py-1 font-[family-name:var(--font-ui)] text-[12px] font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
                  >
                    {evalOpenVersion === v.version
                      ? 'Hide quality test'
                      : `Test changes for v${v.version}`}
                  </button>

                  {evalOpenVersion === v.version && (
                    <div className="mt-2">
                      <EvalDrawer
                        workspaceId={workspaceId}
                        agentKey={agentKey}
                        draftPrompt={v.content}
                        targetVersion={{ version: v.version }}
                      />
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {versions.length > 20 && !showAllVersions && (
        <button
          type="button"
          onClick={() => setShowAllVersions(true)}
          className="font-[family-name:var(--font-ui)] text-[12px] font-medium text-[color:var(--color-cobalt)] hover:underline"
        >
          Show older ({versions.length})
        </button>
      )}

      {/* ── Compare two versions (PRM-04 side-by-side diff) ──────────────── */}
      {versions.length >= 2 && (
        <div className="space-y-2 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-3">
          <h3 className="font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[.1em] text-[color:var(--color-faint)]">
            Compare versions
          </h3>
          <div className="flex flex-wrap items-center gap-2 font-[family-name:var(--font-ui)] text-[12px]">
            <label className="flex items-center gap-1">
              <span className="text-[color:var(--color-ink-soft)]">A</span>
              <select
                className="border border-[color:var(--color-faint)] px-1.5 py-1"
                value={effectiveA ?? ''}
                onChange={e => setCompareA(Number(e.target.value))}
                aria-label="Compare version A"
              >
                {versions.map(v => (
                  <option key={v._id} value={v.version}>
                    v{v.version}
                    {v.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[color:var(--color-faint)]">vs</span>
            <label className="flex items-center gap-1">
              <span className="text-[color:var(--color-ink-soft)]">B</span>
              <select
                className="border border-[color:var(--color-faint)] px-1.5 py-1"
                value={effectiveB ?? ''}
                onChange={e => setCompareB(Number(e.target.value))}
                aria-label="Compare version B"
              >
                {versions.map(v => (
                  <option key={v._id} value={v.version}>
                    v{v.version}
                    {v.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {canCompare && rowA && rowB ? (
            <DiffViewer
              left={{ label: `v${rowA.version}`, content: rowA.content }}
              right={{ label: `v${rowB.version}`, content: rowB.content }}
            />
          ) : (
            <p className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-faint)]">
              Pick two different versions to see a side-by-side diff.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
