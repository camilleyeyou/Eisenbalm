---
phase: 26-review-gate-charity-registry
plan: 05
subsystem: dispatch-control
tags: [review-gate, preview-iframe, claims-checklist, approve-gate, pipeline-decisions]
dependency_graph:
  requires: [26-01, 26-03, 26-04]
  provides: [review-queue-panel, review-screen, claims-checklist, review-decision-panel]
  affects: [apps/dispatch-control/app/(dashboard)/runs]
tech_stack:
  added: []
  patterns:
    - Server Component with ConvexHttpClient for server-side run metadata fetch
    - HMAC preview token (server-only, PREVIEW_SECRET never in client)
    - Convex useQuery/useMutation via type-asserted api (claimChecks not yet in generated API)
    - Inline confirm panels (project convention, no shadcn Dialog installed)
key_files:
  created:
    - apps/dispatch-control/lib/reviewClient.ts
    - apps/dispatch-control/lib/previewToken.ts
    - apps/dispatch-control/app/(dashboard)/runs/_components/ReviewQueue.tsx
    - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx
    - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/PreviewIframe.tsx
    - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ClaimsChecklist.tsx
    - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ReviewDecisionPanel.tsx
    - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/SchedulePublishDialog.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/runs/page.tsx
decisions:
  - reviewClient.ts duplicates pipelineBaseUrl() (private in pipelineControlClient, not exported) — consistent pattern, no coupling
  - buildPreviewUrl() throws when PREVIEW_SECRET/NEXT_PUBLIC_WEB_PREVIEW_BASE unset; review page catches and shows inline fallback message
  - Slug resolution chain: ?slug= search param → pipelineRuns.sanityIssueId → runId fallback (TODO D-slug: add explicit issueSlug to runs schema)
  - Inline confirm panels used instead of shadcn Dialog (not installed; PromptSaveDialog is the project convention)
  - claimChecks Convex module referenced via type-asserted (api as any) — awaiting npx convex dev regeneration of _generated/api.d.ts
metrics:
  duration: 10 minutes
  tasks_completed: 3
  files_created: 8
  files_modified: 1
  completed_date: "2026-06-23"
---

# Phase 26 Plan 05: Dashboard Review Screen Summary

**One-liner:** Review screen with HMAC-signed preview iframe, per-claim sign-off checklist (Convex-persisted), and four decisions (approve/schedule/reject/re-roll) gated on full claims sign-off.

## What Was Built

### Task 1 — reviewClient.ts + previewToken.ts + ReviewQueue panel
- `reviewClient.ts`: Typed Clerk-authed client for `publishIssue`, `scheduleIssue`, `rejectIssue` calling Plan 26-03 endpoints. `ReviewApiError` surfaces a `reason` string (`claims_not_signed_off`, `wrong_status`, `schedule_in_past`) so the UI can show UI-SPEC copy directly.
- `previewToken.ts`: Server-only `buildPreviewUrl(runId, slug)` — HMAC_SHA256 with 300_000ms window matching `apps/web/lib/preview-token.ts`.
- `ReviewQueue.tsx`: Client component using `api.runs.listForWorkspace` filtered to `status === "awaiting-review"`. Amber panel with per-run cost, relative timestamp, amber badge, and "Review →" link. Empty state per UI-SPEC copy.
- `runs/page.tsx`: `<ReviewQueue workspace_id={workspace_id} />` mounted above `<RunsTable />` (RVW-01).

### Task 2 — ClaimsChecklist + PreviewIframe
- `ClaimsChecklist.tsx`: `role="log" aria-live="polite"` list of per-claim rows. Each row shows text, claimType label, context snippet, Pending/Verified/Skipped badge, and Verified + Skip buttons (each ≥44px). Loading / empty / all-resolved states with UI-SPEC copy. Persists to Convex via `claimChecks:setStatus`.
- `PreviewIframe.tsx`: Skeleton loader until `onLoad`; 30s timeout fallback; "Preview unavailable" error state. `title="Issue preview"`, fills container edge-to-edge.

### Task 3 — ReviewDecisionPanel + SchedulePublishDialog + review page
- `ReviewDecisionPanel.tsx`: Queries `claimChecks:allSignedOff`; approve button uses `disabled={!canApprove}` where `canApprove = signoffQuery !== undefined && signoffQuery.allSignedOff === true` (Pitfall 5 loading guard). `aria-disabled` + `title="Sign off all factual claims before publishing."` on disabled state. Four decisions: Approve/Schedule/Reject/Re-roll. Re-roll reuses `rerollAgent` from Phase 25 RUN-05 with two-step inline confirm.
- `SchedulePublishDialog.tsx`: `datetime-local` input, past-time validation client-side + server error surfacing.
- `review/page.tsx`: Server Component (`force-dynamic`). Fetches run cost from `api.runs.byRunId` and `pipelineRuns.byRunId` server-side via `ConvexHttpClient`. `buildPreviewUrl` called server-side (PREVIEW_SECRET never in client). Two-column layout: LEFT 64% `<PreviewIframe>`, RIGHT 36% sticky stack (cost card + ClaimsChecklist + ReviewDecisionPanel). Narrow-viewport bottom bar stub.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pipelineBaseUrl not exported from pipelineControlClient**
- **Found during:** Task 1
- **Issue:** `pipelineBaseUrl()` is a private function in `pipelineControlClient.ts` (no `export` keyword). Attempting to re-export it caused TS2459.
- **Fix:** Duplicated the function in `reviewClient.ts` with identical behavior.
- **Files modified:** `apps/dispatch-control/lib/reviewClient.ts`
- **Commit:** 97200ea

**2. [Rule 2 - Missing] shadcn Dialog not installed**
- **Found during:** Task 3
- **Issue:** UI-SPEC mentions shadcn Dialog for Schedule + Reject confirmations, but `apps/dispatch-control/components/ui/` has no Dialog primitive.
- **Fix:** Used inline confirm panels (the project convention per `PromptSaveDialog.tsx`). Functionally equivalent; no external dep needed.
- **Files modified:** SchedulePublishDialog.tsx, ReviewDecisionPanel.tsx
- **Commit:** 7c7c52e

**3. [Rule 2 - Missing] claimChecks not in generated api.d.ts**
- **Found during:** Tasks 2 and 3
- **Issue:** `convex/claimChecks.ts` exists and the schema has `claim_checks`, but the `_generated/api.d.ts` file was not regenerated to include it (pending `npx convex dev` run).
- **Fix:** Used `(api as any).claimChecks.*` type assertions in `ClaimsChecklist.tsx` and `ReviewDecisionPanel.tsx` with a comment explaining this is temporary until the deployment regenerates the types.
- **Files modified:** ClaimsChecklist.tsx, ReviewDecisionPanel.tsx
- **Commit:** e08b935

**4. [Rule 2 - Missing] No issueSlug field in runs/pipelineRuns schema**
- **Found during:** Task 3
- **Issue:** The plan states "run metadata carries the issue slug" but neither `runs` nor `pipelineRuns` Convex tables have an `issueSlug` field. `pipelineRuns.sanityIssueId` is the Sanity doc `_id`, not the slug.
- **Fix:** Implemented a slug resolution chain: `?slug=` search param → `pipelineRuns.sanityIssueId` → `runId` as last resort. Preview shows gracefully as "unavailable" when token verification fails. Added TODO(D-slug) comment.
- **Files modified:** `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx`
- **Commit:** 7c7c52e

## Known Stubs

- `review/page.tsx` narrow-viewport bottom bar is a structural stub — the `<ReviewDecisionPanel>` in the stacked right column handles all actions on narrow viewports, but the fixed bottom bar does not replicate the approve button at small breakpoints. Acceptable for MVP; the full stacked layout is functional.
- Slug resolution falls back to `runId` when no slug is available — the preview will show "Unauthorized preview request" from `apps/web` in this case. Resolves when the pipeline writes `issueSlug` to run metadata (TODO D-slug).

## Self-Check

See below.
