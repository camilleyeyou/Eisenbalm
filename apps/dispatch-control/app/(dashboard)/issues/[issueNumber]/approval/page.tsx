/**
 * Phase 41 (WSP-05/WSP-06, D-13, Plan 41-09 Task 1) — issue-keyed Stage 5
 * (Approval) server wrapper.
 *
 * Same resolution shape as the draft/voice/story wrappers: resolve
 * `issueNumber` -> the most recent `runId` for that issue server-side via
 * `api.pipelineRuns.byIssueNumber` (a server-side `ConvexHttpClient` call, so
 * the redirect/render decision never depends on a client-side subscription
 * racing the first paint). This wrapper does ONLY the runId resolution + the
 * no-run redirect — it does NOT read `held` (or any other issue field). The
 * frame's `WorkspaceStateProvider` (Plan 41-05) already subscribes to
 * `held` once for the whole Workspace; the client inner `ApprovalStage`
 * reads it from `useWorkspaceState()` instead of a second query
 * (41-RESEARCH Pitfall 3 — no duplicated subscriptions).
 *
 * - `parseIssueNumber` fails -> redirect to `/issues` (unknown/garbage param).
 * - No run yet for a real issue -> redirect to the issue overview
 *   (`/issues/[n]`) rather than showing a broken rail.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ConvexHttpClient } from 'convex/browser'
import { AlertTriangle } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueHref, issueStoryHref } from '@/lib/issueRouteResolver'
import ApprovalStage from './ApprovalStage'
import ApprovalPanelPublisher from './ApprovalPanelContent'

export const dynamic = 'force-dynamic'

interface IssueApprovalPageProps {
  params: Promise<{ issueNumber: string }>
}

// quick 260718-51o (FAILED-RUN-TERMINAL-STATE) — a failed run is terminal:
// nothing was produced to review, so the sign-off buttons in DecisionRail
// can only 409 (claims_not_signed_off over 0 claims; the draft endpoint
// 409s no_sanity_issue). Render an honest explanation + a real onward path
// instead of silently bouncing the operator (mirrors RunDetail.tsx's
// existing failed treatment / RecoveryRail).
function FailedRunPanel({ issueNumber: n, runId, errorMessage }: { issueNumber: number; runId: string; errorMessage?: string }) {
  return (
    <div className="w-full rounded-[2px] border border-[color:var(--color-vermilion)]/40 bg-[color:var(--color-card)] p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle
          size={18}
          className="shrink-0 text-[color:var(--color-vermilion)]"
          aria-hidden="true"
        />
        <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[color:var(--color-ink)]">
          This run failed
        </h2>
      </div>
      <p className="mt-3 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        This issue&rsquo;s most recent pipeline run failed before producing anything to review, so there
        is nothing to approve here.
      </p>
      {errorMessage && (
        <pre className="mt-3 whitespace-pre-wrap rounded-[2px] border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] p-3 font-[family-name:var(--font-mono)] text-[12px] text-[color:var(--color-ink)]">
          {errorMessage}
        </pre>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link
          href={`/run-monitor/runs/${encodeURIComponent(runId)}`}
          className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
        >
          Open Run Monitor — restart options
        </Link>
        <Link
          href={issueHref(n)}
          className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink-soft)]"
        >
          Back to issue
        </Link>
      </div>
    </div>
  )
}

// quick 260719-w6o (F3) — a run paused at the Gate-1 interrupt
// (status==='awaiting-review' && completedAt==null, §37.4(c)) is a DIFFERENT
// status than 'failed', so it shared none of the FailedRunPanel guard above:
// it would fall through to DecisionRail and render a dead "clear to
// publish" screen (nothing was drafted yet — no claims, no findings, no
// sanityIssueId). Mirrors FailedRunPanel's styling exactly.
function PausedAtGate1Panel({ issueNumber: n, runId }: { issueNumber: number; runId: string }) {
  return (
    <div className="w-full rounded-[2px] border border-[color:var(--color-vermilion)]/40 bg-[color:var(--color-card)] p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle
          size={18}
          className="shrink-0 text-[color:var(--color-vermilion)]"
          aria-hidden="true"
        />
        <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[color:var(--color-ink)]">
          Paused at the story decision
        </h2>
      </div>
      <p className="mt-3 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        This run paused before choosing a charity — pick the story first, then the rest of the pipeline
        runs.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link
          href={issueStoryHref(n)}
          className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)]"
        >
          Go to the story decision
        </Link>
        <Link
          href="/signal-desk"
          className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink-soft)]"
        >
          Open Signal Desk
        </Link>
      </div>
    </div>
  )
}

export default async function IssueApprovalPage({ params }: IssueApprovalPageProps) {
  const { issueNumber: rawIssueNumber } = await params
  const n = parseIssueNumber(rawIssueNumber)
  if (n === null) redirect('/issues')

  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const run = url
    ? await new ConvexHttpClient(url).query(api.pipelineRuns.byIssueNumber, { issueNumber: n })
    : null
  if (!run) redirect(issueHref(n))

  // quick 260718-51o — a failed run never mounts DecisionRail (ApprovalStage);
  // it renders the terminal panel above instead.
  if (run.status === 'failed') {
    return <FailedRunPanel issueNumber={n} runId={run.runId} errorMessage={run.errorMessage} />
  }

  // quick 260719-w6o (F3) — a run paused at Gate 1 never mounts DecisionRail
  // (ApprovalStage/ApprovalPanelPublisher); it renders the paused panel
  // above instead. A finished run has completedAt set, so this branch never
  // catches a genuinely reviewable run.
  if (run.status === 'awaiting-review' && run.completedAt == null) {
    return <PausedAtGate1Panel issueNumber={n} runId={run.runId} />
  }

  return (
    <>
      <ApprovalPanelPublisher />
      <ApprovalStage runId={run.runId} issueNumber={n} />
    </>
  )
}
