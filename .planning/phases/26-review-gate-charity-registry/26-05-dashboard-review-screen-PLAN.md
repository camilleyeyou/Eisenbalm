---
phase: 26-review-gate-charity-registry
plan: 05
type: execute
wave: 3
depends_on: [26-01, 26-03, 26-04]
files_modified:
  - apps/dispatch-control/lib/reviewClient.ts
  - apps/dispatch-control/lib/previewToken.ts
  - apps/dispatch-control/app/(dashboard)/runs/page.tsx
  - apps/dispatch-control/app/(dashboard)/runs/_components/ReviewQueue.tsx
  - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx
  - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/PreviewIframe.tsx
  - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ClaimsChecklist.tsx
  - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ReviewDecisionPanel.tsx
  - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/SchedulePublishDialog.tsx
autonomous: true
requirements: [RVW-01, RVW-02, RVW-03, RVW-05]
user_setup:
  - service: vercel-dispatch-control
    why: "Review screen iframes the apps/web preview route via a signed token"
    env_vars:
      - name: PREVIEW_SECRET
        source: "Must match apps/web PREVIEW_SECRET"
      - name: NEXT_PUBLIC_WEB_PREVIEW_BASE
        source: "apps/web production origin (e.g. https://eisenbalm-web.vercel.app)"

must_haves:
  truths:
    - "Finished runs in awaiting-review appear in a review queue on the /runs page with charity, cost, and a Review link"
    - "The review screen shows the apps/web draft preview in an iframe (real Phase 19 layout) plus run cost in dashboard chrome"
    - "The factual-claims checklist lists every extracted claim; each can be Verified or Skipped; state persists in Convex across reloads"
    - "Approve and Publish is disabled until claims have loaded AND every claim is checked or skipped"
    - "Operator can approve-and-publish, schedule-for-later, reject, and re-roll a section from the review screen"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx"
      provides: "Preview-centric review screen (iframe + cost + claims + decisions)"
    - path: "apps/dispatch-control/lib/reviewClient.ts"
      provides: "Clerk-authed publish/schedule/reject calls to the pipeline"
      exports: ["publishIssue", "scheduleIssue", "rejectIssue"]
    - path: "apps/dispatch-control/app/(dashboard)/runs/_components/ReviewQueue.tsx"
      provides: "Awaiting-review queue panel above run history"
  key_links:
    - from: "ReviewDecisionPanel approve button"
      to: "claimChecks:allSignedOff guard"
      via: "disabled until claims loaded AND allSignedOff"
      pattern: "allSignedOff"
    - from: "PreviewIframe src"
      to: "apps/web /issue/[slug]/preview"
      via: "signed preview token + NEXT_PUBLIC_WEB_PREVIEW_BASE"
      pattern: "/preview"
    - from: "ReviewDecisionPanel re-roll"
      to: "rerollAgent (Phase 25 RUN-05)"
      via: "reuse existing pipelineControlClient.rerollAgent"
      pattern: "rerollAgent"
---

<objective>
Build the operator review screen in `dispatch-control` (RVW-01/02/03/05): a review queue of awaiting-review runs, and a preview-centric review screen that iframes the real `apps/web` draft preview, shows run cost, renders the factual-claims sign-off checklist, and exposes the four decisions (approve-and-publish, schedule, reject, re-roll). The approve action is gated on full claims sign-off.

Purpose: This is the human gate the brand intentionally requires. Re-roll reuses Phase 25 RUN-05; publish/schedule/reject call the Plan 03 endpoints; the preview is the Plan 04 route. This plan wires them into one screen per the UI-SPEC.
Output: review queue panel, review screen + 5 components, Clerk-authed review client, preview-token generator.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-review-gate-charity-registry/26-CONTEXT.md
@.planning/phases/26-review-gate-charity-registry/26-UI-SPEC.md
@.planning/phases/26-review-gate-charity-registry/26-RESEARCH.md
@CLAUDE.md

<interfaces>
<!-- Existing dispatch-control patterns to reuse. -->
apps/dispatch-control/lib/pipelineControlClient.ts — Clerk-authed fetch wrapper: pipelineBaseUrl(), triggerRun(token,body), cancelRun(token,runId), rerollAgent(token,runId,agentKey). Each gets the Clerk token via getToken() in the caller. REUSE rerollAgent for re-roll.
apps/dispatch-control/app/(dashboard)/runs/page.tsx — Server Component; renders BudgetAlertBanner, RunControlBar, CostRollup, RunsTable. Add ReviewQueue above RunsTable.
apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx — Convex useQuery pattern + status badges (reuse badge style).
apps/dispatch-control/lib/workspace.ts — getCurrentWorkspace().
Convex queries (from useQuery via @convex):
  runs:listForWorkspace({workspace_id}) -> rows (status, cost, startedAt, runId)
  runs:byRunId({runId}) -> run (status, cost, sanityIssueId?)
  pipelineRuns:byRunId({runId}) -> {sanityIssueId, status}
  claimChecks:listByRunId({runId}) -> [{claimIndex, text, claimType, context, status}]
  claimChecks:allSignedOff({runId}) -> {total, signedOff, allSignedOff}
Convex mutations: claimChecks:setStatus({runId, claimIndex, status})
Pipeline endpoints (Plan 03): POST /issues/{runId}/publish, /schedule {scheduledAt}, /reject {note?}.
UI-SPEC copy: Approve and Publish / Schedule for Later / Reject Run / Re-roll Section; claims "Verified"/"Skip"; disabled tooltip "Sign off all factual claims before publishing."

<!-- Preview token formula (must match apps/web Plan 26-04 verifyPreviewToken):
HMAC_SHA256(PREVIEW_SECRET, `${runId}:${slug}:${floor(Date.now()/300000)}`).hex
Preview URL: `${NEXT_PUBLIC_WEB_PREVIEW_BASE}/issue/${slug}/preview?token=${hmac}&runId=${runId}` -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: reviewClient.ts (publish/schedule/reject) + previewToken.ts (HMAC generator) + ReviewQueue panel</name>
  <read_first>
    - apps/dispatch-control/lib/pipelineControlClient.ts (fetch wrapper, pipelineBaseUrl, auth header shape — copy for the new review calls)
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx (Convex useQuery + status badge style to reuse in ReviewQueue)
    - apps/web/lib/preview-token.ts (the previewToken formula — dispatch-control must produce a token apps/web verifies)
    - .planning/phases/26-review-gate-charity-registry/26-UI-SPEC.md (Review Queue copy + Awaiting-review card fields)
  </read_first>
  <action>
1. Create `apps/dispatch-control/lib/reviewClient.ts` mirroring pipelineControlClient.ts:
   - `publishIssue(token, runId)` → POST `${pipelineBaseUrl()}/issues/${runId}/publish` with `Authorization: Bearer ${token}`. Parse 200 `{issueId, published}`; on 409 surface `body.reason` (e.g. "claims_not_signed_off", "wrong_status") so the UI shows the UI-SPEC error copy.
   - `scheduleIssue(token, runId, scheduledAt: number)` → POST `/issues/${runId}/schedule` body `{scheduledAt}`. Handle 400 reason "schedule_in_past".
   - `rejectIssue(token, runId, note?: string)` → POST `/issues/${runId}/reject` body `{note}`.
   Export typed result interfaces. Reuse `pipelineBaseUrl()` (re-export or import from pipelineControlClient).

2. Create `apps/dispatch-control/lib/previewToken.ts` (server-only) exporting `buildPreviewUrl(runId: string, slug: string): string`:
   - `const secret = process.env.PREVIEW_SECRET`
   - `const win = Math.floor(Date.now()/300000)`
   - `const hmac = createHmac('sha256', secret).update(`${runId}:${slug}:${win}`).digest('hex')`
   - return `${process.env.NEXT_PUBLIC_WEB_PREVIEW_BASE}/issue/${slug}/preview?token=${hmac}&runId=${runId}`
   This MUST be called server-side (the secret must not reach the browser); the review page is a Server Component that computes the URL and passes it to the client PreviewIframe as a prop.

3. Create `apps/dispatch-control/app/(dashboard)/runs/_components/ReviewQueue.tsx` (client component, `'use client'`):
   - useQuery `runs:listForWorkspace({workspace_id})`; filter to `status === "awaiting-review"`.
   - Section heading "Awaiting Review" (UI-SPEC). Empty state heading "No runs awaiting review" + body "Finished runs will appear here for your approval before publishing."
   - Each card: issue number + charity name (from run metadata if present), started-at relative, "Estimated run cost" reading the run's cost (parse JSON cost summary → total USD), amber "Awaiting Review" badge, and a "Review" link to `/runs/${runId}/review`. All interactive targets ≥44px; focus-visible ring per UI-SPEC accessibility.
   Mount `<ReviewQueue workspace_id={workspace_id} />` in runs/page.tsx ABOVE `<RunsTable />`.
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && test -f apps/dispatch-control/lib/reviewClient.ts && grep -q "publishIssue" apps/dispatch-control/lib/reviewClient.ts && grep -q "claims_not_signed_off" apps/dispatch-control/lib/reviewClient.ts && grep -q "buildPreviewUrl" apps/dispatch-control/lib/previewToken.ts && grep -q "ReviewQueue" "apps/dispatch-control/app/(dashboard)/runs/page.tsx" && pnpm --filter dispatch-control typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "publishIssue\|scheduleIssue\|rejectIssue" apps/dispatch-control/lib/reviewClient.ts` matches all three
    - `grep -q "claims_not_signed_off" apps/dispatch-control/lib/reviewClient.ts` (409 reason surfaced)
    - `grep -q "createHmac" apps/dispatch-control/lib/previewToken.ts` AND `grep -q "300000" apps/dispatch-control/lib/previewToken.ts` (same window as apps/web)
    - `grep -q "ReviewQueue" "apps/dispatch-control/app/(dashboard)/runs/page.tsx"` (mounted)
    - `grep -q "Awaiting Review" "apps/dispatch-control/app/(dashboard)/runs/_components/ReviewQueue.tsx"`
    - `pnpm --filter dispatch-control typecheck` exits 0
  </acceptance_criteria>
  <done>Review client + preview-token generator + queue panel exist; queue lists awaiting-review runs with a Review link.</done>
</task>

<task type="auto">
  <name>Task 2: ClaimsChecklist + PreviewIframe components</name>
  <read_first>
    - .planning/phases/26-review-gate-charity-registry/26-UI-SPEC.md (Claims Checklist copy table + ClaimsChecklist component spec + PreviewIframe spec + accessibility role="log")
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx (status badge styling to reuse for claim status badges)
    - convex/_generated/api.d.ts (claimChecks query/mutation names for useQuery/useMutation)
  </read_first>
  <action>
1. Create `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ClaimsChecklist.tsx` (`'use client'`):
   - Props: `{ runId: string }`.
   - useQuery `claimChecks:listByRunId({runId})`; useMutation `claimChecks:setStatus`.
   - Section heading "Factual Claims"; subtext "Check or skip each claim before approving. Approve is disabled until all claims are resolved."
   - Loading (query undefined): "Loading claims…".
   - Empty (query loaded, length 0): "No claims detected in this issue."
   - Render a `<ul role="list">` of rows. Each row: claim text (text-sm), a small type label (number/date/proper_noun, text-xs), context snippet (text-xs muted), a status badge (Pending=amber / Verified=green / Skipped=neutral), and two buttons "Verified" and "Skip" calling setStatus with claimIndex + status ("checked"/"skipped"). Each button ≥44px, focus-visible ring. Row container 40px min height per UI-SPEC.
   - `role="log" aria-live="polite"` on the list container so status changes are announced.
   - When all resolved: render "All claims resolved. Approve is now enabled." line.

2. Create `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/PreviewIframe.tsx` (`'use client'`):
   - Props: `{ previewUrl: string }`.
   - `<iframe src={previewUrl} title="Issue preview" className="w-full h-full border-0" />` — no border, no padding.
   - Skeleton loader shown until `onLoad` fires (track a `loaded` state).
   - On error (track via a timeout or onError): show "Preview unavailable. The draft issue may not be ready yet."
   - The iframe fills its container edge-to-edge (D-10).
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && test -f "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ClaimsChecklist.tsx" && test -f "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/PreviewIframe.tsx" && grep -q "Factual Claims" "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ClaimsChecklist.tsx" && grep -q 'title="Issue preview"' "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/PreviewIframe.tsx" && pnpm --filter dispatch-control typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - ClaimsChecklist uses `claimChecks:setStatus` mutation (grep "setStatus") and `claimChecks:listByRunId` query
    - `grep -q 'role="log"' "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ClaimsChecklist.tsx"`
    - UI-SPEC copy present: `grep -q "No claims detected" ClaimsChecklist.tsx` and `grep -q "All claims resolved" ClaimsChecklist.tsx`
    - PreviewIframe has `title="Issue preview"` and an "Preview unavailable" error branch
    - `pnpm --filter dispatch-control typecheck` exits 0
  </acceptance_criteria>
  <done>Claims checklist persists per-claim sign-off to Convex; preview iframe renders with loading/error states.</done>
</task>

<task type="auto">
  <name>Task 3: ReviewDecisionPanel + SchedulePublishDialog + the review screen page (two-column layout)</name>
  <read_first>
    - .planning/phases/26-review-gate-charity-registry/26-UI-SPEC.md (Screen 2 layout contract, approve disabled states / Pitfall 5, decision actions copy, Schedule/Reject dialogs, Re-roll inline confirm, narrow-viewport bottom bar)
    - apps/dispatch-control/app/(dashboard)/runs/_components/RerollButton.tsx (existing Phase 25 re-roll UI + section selection — reuse pattern / component)
    - apps/dispatch-control/lib/pipelineControlClient.ts (rerollAgent — reuse for re-roll)
    - apps/dispatch-control/lib/reviewClient.ts (publishIssue/scheduleIssue/rejectIssue from Task 1)
    - apps/dispatch-control/app/(dashboard)/config/page.tsx (existing inline-modal / Dialog usage pattern if any, for Reject/Schedule confirm)
  </read_first>
  <action>
1. Create `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ReviewDecisionPanel.tsx` (`'use client'`):
   - Props: `{ runId: string }`. Get the Clerk token via `useAuth().getToken()`.
   - useQuery `claimChecks:allSignedOff({runId})` and `claimChecks:listByRunId({runId})` to compute the gate.
   - **Approve gate (Pitfall 5):** `const canApprove = signoffQuery !== undefined && signoffQuery.allSignedOff === true`. The "Approve and Publish" button is `disabled={!canApprove}`; while disabled add `aria-disabled` + `title="Sign off all factual claims before publishing."`.
   - "Approve and Publish" → `publishIssue(token, runId)`; on success show a toast/inline confirmation; on 409 show the reason copy ("Sign off all factual claims before publishing." / "This run cannot be published in its current state.").
   - "Schedule for Later" → opens `<SchedulePublishDialog />`.
   - "Reject Run" → inline modal: heading "Reject this run?", body "The run will remain in the history log but will not publish. You can add a note below.", optional note textarea (placeholder "Optional note…"), CTA "Confirm Reject" → `rejectIssue(token, runId, note)`.
   - "Re-roll Section" → reuse the Phase 25 RerollButton / rerollAgent pattern: a section selector + two-step inline confirm calling `rerollAgent(token, runId, sectionKey)`. Copy "Re-roll Section"; in-progress "Re-rolling [section]…".
   - All buttons ≥44px, focus-visible ring. The two CTAs (Approve/Schedule) use accent `--primary`; Reject uses `--destructive`.

2. Create `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/SchedulePublishDialog.tsx` (`'use client'`): shadcn Dialog with a datetime-local input ("Publish at"), body "This issue will publish automatically at the scheduled time via the hourly tick.", CTA "Confirm Schedule" → converts the chosen datetime to Unix ms and calls `scheduleIssue(token, runId, ms)`. Reject past times with "Choose a time in the future."

3. Create `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx` (Server Component, `export const dynamic = 'force-dynamic'`):
   - `const workspace_id = await getCurrentWorkspace()`; await params for runId.
   - Resolve the issue slug: query `pipelineRuns:byRunId` (or runs metadata) server-side to get the Sanity slug; if the slug is on the Sanity doc, fetch via the dashboard's Convex server client OR pass the runId and let the preview compute. SIMPLEST per RESEARCH: the run metadata carries the issue slug; read it. Compute `const previewUrl = buildPreviewUrl(runId, slug)` server-side (keeps PREVIEW_SECRET off the client).
   - Layout (UI-SPEC Screen 2): on ≥1280px two columns — LEFT (~64%) `<PreviewIframe previewUrl={previewUrl} />` filling `calc(100vh - 64px)`; RIGHT (~36%, sticky) stack: cost summary card (read run cost), `<ClaimsChecklist runId={runId} />`, `<ReviewDecisionPanel runId={runId} />`. On <1280px single column with the decision controls in a fixed bottom bar (Approve + overflow). Use one `<main>`-free wrapper (the dashboard layout owns `<main>`).
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && test -f "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx" && grep -q "ReviewDecisionPanel" "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx" && grep -q "buildPreviewUrl" "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx" && grep -q "allSignedOff" "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ReviewDecisionPanel.tsx" && grep -q "rerollAgent" "apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ReviewDecisionPanel.tsx" && pnpm --filter dispatch-control build 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "allSignedOff" ReviewDecisionPanel.tsx` AND the approve button uses `disabled={!canApprove}` where canApprove requires the query to be defined (Pitfall 5 — verify by reading)
    - `grep -q "Sign off all factual claims before publishing." ReviewDecisionPanel.tsx` (disabled tooltip)
    - All four decisions present: `grep -E "Approve and Publish|Schedule for Later|Reject Run|Re-roll Section" ReviewDecisionPanel.tsx` matches all four
    - `grep -q "rerollAgent" ReviewDecisionPanel.tsx` (re-roll reuses Phase 25 RUN-05)
    - review/page.tsx computes `buildPreviewUrl` server-side (PREVIEW_SECRET not referenced in any `'use client'` file: `grep -rn "PREVIEW_SECRET" apps/dispatch-control/app` returns 0)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>The review screen renders the preview iframe + cost + claims + four decisions; approve is gated on full claims sign-off; re-roll reuses RUN-05.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control typecheck` + `build` exit 0.
- Review queue lists awaiting-review runs; Review link opens the review screen.
- Approve disabled until claims loaded AND all signed off; publish/schedule/reject call Plan 03 endpoints; re-roll calls rerollAgent.
- PREVIEW_SECRET never appears in a client component.
</verification>

<success_criteria>
- The operator sees a true-WYSIWYG preview + cost and signs off every claim before approving (RVW-02/05).
- All four decisions work from one screen (RVW-03).
- Finished runs land in a visible review queue (RVW-01 surfaced).
</success_criteria>

<output>
After completion, create `.planning/phases/26-review-gate-charity-registry/26-05-SUMMARY.md`.
</output>
