'use client'
/**
 * Eval Center — the drift detector (Phase 38, EVL-04/EVL-05, D-08/D-10/D-13).
 * Replaces the Phase 30 placeholder stub.
 *
 * A Client Component (mirrors voice-pass/page.tsx's precedent: a dashboard
 * screen whose ENTIRE body is Convex-subscription/fetch-driven can be a plain
 * `'use client'` page with no `force-dynamic` Server Component wrapper — there
 * is no server-only data to resolve here beyond the single-tenant workspace
 * constant, so `getCurrentWorkspace()`'s async round-trip buys nothing).
 *
 * Fetches the 8 standard test cases once via `fetchScenarios(undefined,
 * token)` (D-01: repo-fixture-sourced, no scenario data duplicated into
 * Convex), then renders:
 *   - a ScenarioCard grid (description + whatItCatches + latest eval_scores
 *     "last result" per scenario, D-08)
 *   - a DriftScoreboard (the FULL append-only eval_scores time-series per
 *     scenario — the actual drift detector, D-09/D-10)
 *   - a ShadowRunPanel (the read-only preview-next-run affordance, D-11/D-13
 *     — triggers POST /eval/shadow-run and shows the preview inline)
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { WORKBENCH_NAV_LABELS } from '@/lib/nomenclature'
import { fetchScenarios, type EvalScenario } from '@/lib/evalScenarioClient'
import ScenarioCard from './_components/ScenarioCard'
import DriftScoreboard from './_components/DriftScoreboard'
import ShadowRunPanel from './_components/ShadowRunPanel'

export default function EvalCenterPage() {
  const { getToken } = useAuth()
  const [scenarios, setScenarios] = useState<EvalScenario[] | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Fetch once on mount — the standard-test-case fixture set does not change
  // within a session (D-01: repo-sourced, read-only from the dashboard).
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const token = await getToken()
        const list = await fetchScenarios(undefined, token)
        if (!cancelled) setScenarios(list)
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : String(e))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--color-ink)]">
          {WORKBENCH_NAV_LABELS.eval_center}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
          The drift detector: standard test case cards, an append-only
          scoreboard time-series across prompt versions, and a read-only
          preview next run against this week&apos;s real news.
        </p>
      </div>

      {fetchError && (
        <div
          role="alert"
          className="border border-[color:var(--color-vermilion)] bg-white p-3 text-sm text-[color:var(--color-vermilion)]"
        >
          {fetchError}
        </div>
      )}

      {scenarios === null && !fetchError && (
        <p className="text-sm text-[color:var(--color-ink-soft)]">Loading scenarios…</p>
      )}

      {scenarios !== null && (
        <>
          <section aria-label="Standard test cases">
            <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]">
              Standard test cases
            </h2>
            {scenarios.length === 0 ? (
              <p className="mt-2 text-[13px] italic text-[color:var(--color-ink-soft)]">
                No standard test cases yet.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scenarios.map(scenario => (
                  <ScenarioCard
                    key={scenario.id}
                    workspaceId={DEFAULT_WORKSPACE_ID}
                    scenario={scenario}
                  />
                ))}
              </div>
            )}
          </section>

          <DriftScoreboard workspaceId={DEFAULT_WORKSPACE_ID} scenarios={scenarios} />
        </>
      )}

      <ShadowRunPanel />
    </div>
  )
}
