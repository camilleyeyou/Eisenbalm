'use client'
/**
 * Phase 41 (WSP-05/WSP-06, D-13/D-15, Plan 41-09 Task 1) — Stage 5
 * (Approval) client inner.
 *
 * Reads `held` from the frame's `useWorkspaceState()` (Plan 41-05) rather
 * than re-querying `api.issues.byIssueNumber` for it — the provider already
 * subscribes to `held` once for the whole Workspace frame (41-RESEARCH
 * Pitfall 3 — no duplicated Convex subscriptions across the frame + stage
 * pages).
 *
 * Mounts the full-width, held-aware `DecisionRail` — Stage 5 IS the decision
 * rail (D-13). The frame's `layout.tsx` already gives the canvas slot
 * (`{children}`) the full center-column grid width; the rail's old
 * `lg:w-[336px]` sidebar sizing lived on ReviewDeskRunView's aside wrapper
 * (removed in Plan 41-08), never on the rail itself, so no extra sizing
 * wrapper is needed here.
 *
 * quick 260722-n5r: the frame's canvas column widened considerably
 * (`layout.tsx`'s `minmax(0,1fr)` track), so the rail is now wrapped in a
 * `max-w-[760px]` readability measure — otherwise its decision copy and
 * controls would stretch edge-to-edge across the enlarged canvas.
 */
import { useWorkspaceState } from '../../_components/WorkspaceStateProvider'
import DecisionRail from '../../../review-desk/[runId]/_components/DecisionRail'

interface ApprovalStageProps {
  runId: string
  issueNumber: number
}

export default function ApprovalStage({ runId, issueNumber }: ApprovalStageProps) {
  const { held } = useWorkspaceState()

  return (
    <div className="max-w-[760px]">
      <DecisionRail runId={runId} issueNumber={issueNumber} held={held} />
    </div>
  )
}
