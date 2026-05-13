/**
 * Convex smoke-test route — Phase 3 evidence surface for CVX-05.
 *
 * TODO(Phase 9): REMOVE THIS FILE.
 * Phase 9 replaces this debug page with live <DeliberationSlot> Convex
 * subscriptions on each /issue/[slug] page. When that lands:
 *   1. Delete this file
 *   2. Delete apps/web/app/_debug/ if no other debug routes were added
 *   3. Remove the `Disallow: /_debug/` line from apps/web/public/robots.txt
 *   4. Update apps/web/README.md to drop the "/_debug/convex" mention
 *
 * Contract source: .planning/phases/03-convex-deployment/03-CONTEXT.md D-18, D-24.
 *
 * This page calls all 5 byRunId queries with a synthetic runId guaranteed
 * to have no matching rows ("phase-3-smoke-test"). Expected output:
 *   - pipelineRuns.byRunId returns null (uses .first())
 *   - the other four return [] (use .collect())
 * The rowCount helper renders "0" for both empty cases and "—" while loading.
 */
'use client'

import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

const SMOKE_TEST_RUN_ID = 'phase-3-smoke-test'

function rowCount(data: unknown): string {
  if (data === undefined) return '—'
  if (Array.isArray(data)) return String(data.length)
  if (data === null) return '0'
  return '1'
}

export default function DebugConvexPage() {
  const run = useQuery(api.pipelineRuns.byRunId, { runId: SMOKE_TEST_RUN_ID })
  const pitches = useQuery(api.pitchLog.byRunId, { runId: SMOKE_TEST_RUN_ID })
  const events = useQuery(api.deliberationEvents.byRunId, { runId: SMOKE_TEST_RUN_ID })
  const votes = useQuery(api.agentVotes.byRunId, { runId: SMOKE_TEST_RUN_ID })
  const corrections = useQuery(api.qaCorrections.byRunId, { runId: SMOKE_TEST_RUN_ID })

  const rows: [string, unknown][] = [
    ['pipelineRuns', run],
    ['pitchLog', pitches],
    ['deliberationEvents', events],
    ['agentVotes', votes],
    ['qaCorrections', corrections],
  ]

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <meta name="robots" content="noindex,nofollow" />
      <h1 className="font-display text-2xl mb-2">Convex smoke test</h1>
      <p className="font-ui text-sm opacity-60 mb-6">
        Run ID: {SMOKE_TEST_RUN_ID}. Empty by design.
      </p>
      <table className="w-full font-ui text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Query</th>
            <th className="text-right py-2">Rows</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, data]) => (
            <tr key={name} className="border-b last:border-b-0">
              <td className="py-2">{name}.byRunId</td>
              <td className="py-2 text-right">{rowCount(data)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
