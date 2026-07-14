---
phase: 40-issue-entity-issues-home
plan: 07
type: execute
wave: 4
depends_on: ["40-02", "40-04", "40-05", "40-06"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/_components/HoldDialog.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx
autonomous: true
requirements: [ISS-04, ISS-02]

must_haves:
  truths:
    - "The operator can hold an issue with a REQUIRED reason from the /issues/[n] overview; an empty reason is rejected"
    - "Holding offers an 'also stop the run in progress' checkbox (default on) that sets the existing runs.cancelRequested cooperative-cancel flag — the two state systems stay distinct"
    - "A held issue shows reason + who + when and can be reopened in one click; status re-derives on its own"
    - "The hold reason + actor + timestamp are written to audit_log BY THE CONVEX MUTATION (Plan 40-02), never by the client"
    - "The overview page IS the issue-keyed landing (D-09): 5-stage strip, status, open tasks, hold control, links into /issues/[n]/review + /issues/[n]/voice, and run history — Phase 41 replaces its CONTENTS at this same URL"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/HoldDialog.tsx"
      provides: "inline-panel hold dialog — required reason + 'also stop the run' checkbox (default on)"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx"
      provides: "issue overview: stage strip, status, tasks, Hold/Reopen control, review/voice/run-history links"
      min_lines: 60
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx"
      to: "convex issues:hold / issues:reopen"
      via: "useMutation on confirm; reason required; audit written in the mutation"
      pattern: "api\\.issues\\.(hold|reopen)"
    - from: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx HoldDialog checkbox"
      to: "convex runs:requestCancel"
      via: "when 'also stop the run' is checked (D-14) — a SEPARATE call from hold"
      pattern: "requestCancel"
---

<objective>
Ship ISS-04 (hold with a required reason, held display, reopen) and the issue overview page (D-09) that is the issue-keyed editorial landing. The hold dialog is an inline panel (project convention — NOT shadcn Dialog); the required-reason validation and the audit_log write live in the Convex `issues:hold` mutation (Plan 40-02), never in the client. The "also stop the run" checkbox (default on) sets the existing `runs.cancelRequested` flag — a separate call, keeping the issue-state and run-state systems distinct (D-14).

Purpose: Held is durable operator state with a required rationale (the record Phase 43's Decision log reads back). The overview page gives Phase 41's Workspace frame a URL to mount on with no second migration.
Output: `HoldDialog.tsx`, `/issues/[issueNumber]/page.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md
@docs/API_CONTRACTS.md

<interfaces>
Convex (Plan 40-02):
```typescript
api.issues.byIssueNumber({ workspace_id, issueNumber })   // { held, heldReason?, heldBy?, heldAt?, published, ... } | null
api.issues.hold ({ workspace_id, issueNumber, reason })    // requireOperator; throws on empty reason; writes audit_log 'issue.held'
api.issues.reopen ({ workspace_id, issueNumber })          // requireOperator; clears hold; writes audit_log 'issue.reopened'
api.pipelineRuns.byIssueNumber({ issueNumber })            // most recent run → { runId, ... } | null
api.pipelineRuns.listByIssueNumber({ issueNumber })        // run history, newest first
api.runs.requestCancel({ runId })                          // existing Phase 25 cooperative-cancel flag (D-14)
api.signOffs.activeByRunId / api.claimChecks.* / api.qaCorrections.byRunId / api.pitchLog.byRunId / api.runs.latest|byRunId
```
Derivation (Plan 40-04): `deriveIssueStatus`, `deriveStageStates`, `deriveTasks`, `estimateWorkMinutes`.
Resolver (Plan 40-04): `parseIssueNumber`, `issueReviewHref`, `issueVoiceHref`, `issueRunHref`.
Components (Plan 40-05): `StageStrip` from `../_components/StageStrip` (reuse — do NOT rebuild the 5-segment strip).
Workspace: `DEFAULT_WORKSPACE_ID` from `@/lib/workspace`.
</interfaces>

<ui_contract>
HoldDialog copy (verbatim, 40-UI-SPEC Copywriting Contract):
- heading `Hold this issue`
- field label `Reason`, required, free text, placeholder `Why are you holding Issue {n}?`
- checkbox `Also stop the run in progress` — DEFAULT CHECKED (D-14)
- confirm button `Hold issue`; cancel button `Cancel`
- validation error `A reason is required to hold this issue.`
Reopen: single-click, NO confirmation dialog (D-17). Held display format: `Held · {reason} · {heldBy} · {relative time}`.
Held badge: `PauseCircle` vermilion + label `Held` (label+icon, never color alone).
Inline panel pattern (NOT shadcn Dialog) — follow `AddCharityDialog.tsx` / `SchedulePublishDialog.tsx`. All interactive targets `min-h-[44px]`; focus ring `focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]`.
Overview visual: the overview page reuses the same StageStrip contract; Held status blocks publish but editing stays open (D-15) — the overview never disables the review/voice links when held.
</ui_contract>
</context>

<tasks>

<task type="auto">
  <name>Task 1: HoldDialog.tsx (inline panel — required reason + stop-run checkbox)</name>

  <read_first>
    - apps/dispatch-control/__tests__/HoldDialog.test.tsx (the RED spec from 40-01 — placeholder `Why are you holding Issue 7?`, checkbox checked by default, empty-reason error `A reason is required to hold this issue.`, `onHold` called with `{ reason, stopRun }`, buttons `Hold issue` / `Cancel`)
    - apps/dispatch-control/app/(dashboard)/registry/... or any existing inline dialog (AddCharityDialog.tsx / SchedulePublishDialog.tsx) — the inline-panel convention, NOT shadcn Dialog
    - .planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md (Copywriting Contract + Registry Safety — shadcn Dialog is intentionally not used)
  </read_first>

  <action>
Create `app/(dashboard)/issues/_components/HoldDialog.tsx` (`'use client'`) as a PRESENTATIONAL inline panel. Props: `{ issueNumber: number; onHold: (args: { reason: string; stopRun: boolean }) => void; onCancel: () => void; busy?: boolean }`. Local state: `reason` (string, default `''`), `stopRun` (boolean, DEFAULT `true`), `error` (string | null).

Render:
- heading `Hold this issue`
- a `Reason` labelled `<textarea>` with placeholder exactly `Why are you holding Issue ${issueNumber}?`
- a checkbox labelled `Also stop the run in progress`, `checked={stopRun}` (default true)
- confirm button `Hold issue` and cancel button `Cancel`, both `min-h-[44px]`

On confirm: if `reason.trim() === ''` set `error` to `A reason is required to hold this issue.` and DO NOT call `onHold` or `onCancel`. Otherwise call `onHold({ reason: reason.trim(), stopRun })`. Cancel calls `onCancel`. This is purely presentational — it performs no Convex calls itself (the overview page wires them in Task 2). The client-side empty check is a UX affordance ONLY; the authoritative required-reason rejection is in the `issues:hold` mutation (Plan 40-02).
  </action>

  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/HoldDialog.test.tsx</automated>
  </verify>

  <acceptance_criteria>
    - `app/(dashboard)/issues/_components/HoldDialog.tsx` exists and is presentational (no `useMutation`, no `api.` import)
    - The textarea placeholder is exactly `Why are you holding Issue {issueNumber}?`
    - The `Also stop the run in progress` checkbox defaults to checked
    - Empty-reason submit renders `A reason is required to hold this issue.` and calls neither prop callback
    - Confirm with a reason calls `onHold` with `{ reason, stopRun }`; the confirm button text is `Hold issue`, cancel is `Cancel`
    - It does NOT import shadcn `Dialog`
    - `pnpm --filter dispatch-control test -- __tests__/HoldDialog.test.tsx` exits 0 (was RED in 40-01)
  </acceptance_criteria>

  <done>The hold dialog matches the 40-01 spec and the UI-SPEC copy, as an inline panel with a default-on stop-run checkbox.</done>
</task>

<task type="auto">
  <name>Task 2: /issues/[issueNumber]/page.tsx — issue overview + hold/reopen wiring</name>

  <read_first>
    - docs/API_CONTRACTS.md §40.8 (the overview is D-09's landing; Phase 41 replaces its CONTENTS at the same URL)
    - apps/dispatch-control/app/(dashboard)/issues/_components/StageStrip.tsx (Plan 40-05 — reuse; do NOT rebuild the strip)
    - apps/dispatch-control/lib/derivedState.ts + lib/issueRouteResolver.ts (Plan 40-04 — derivation + href builders)
    - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx (the `'use client'` + useQuery + DEFAULT_WORKSPACE_ID + useParams page pattern)
    - convex/runs.ts requestCancel (the existing cooperative-cancel mutation the checkbox calls) and convex/issues.ts hold/reopen (Plan 40-02 — confirm the audit write is in the mutation, not the client)
  </read_first>

  <action>
Create `app/(dashboard)/issues/[issueNumber]/page.tsx` (`'use client'`) — the issue overview (D-09). Read the route param via `useParams()`, `const n = parseIssueNumber(String(params.issueNumber))`; if null, render a not-found message with a link back to `/issues`.

Data: `issue = useQuery(api.issues.byIssueNumber, { workspace_id, issueNumber: n })`; `run = useQuery(api.pipelineRuns.byIssueNumber, { issueNumber: n })`; then subscribe (skip when no runId) to `signOffs.activeByRunId`, `claimChecks.allSignedOff`, `claimChecks.listByRunId`, `qaCorrections.byRunId`, `pitchLog.byRunId`, `runs.byRunId`, `runs.latest`; and `history = useQuery(api.pipelineRuns.listByIssueNumber, { issueNumber: n })`.

Assemble `DerivationInputs` and compute `deriveIssueStatus`, `deriveStageStates`, `deriveTasks`, `estimateWorkMinutes` (same assembly as the home page in 40-05).

Render:
1. Header: `Issue {n}` (Display, `font-display`) + the derived issue-status readout (icon+label per the State & Icon Contract; when status is `'unknown'` show `State unknown — refresh`, never a stale value).
2. `<StageStrip stages={stages} />` (reused component).
3. Open tasks: `{deriveTasks(...).length} open` + `~{estimateWorkMinutes} min`.
4. Links: `Open Review` → `issueReviewHref(n)`, `Open Voice` → `issueVoiceHref(n)` (cobalt links; NOT disabled when held — D-15).
5. Run history: `history.map(r => <Link href={issueRunHref(n, r.runId)}>Run {r.runId} · {new Date(r.startedAt)...}</Link>)`.
6. Hold control (persistent):
   - If `issue.held`: render the held banner `Held · {issue.heldReason} · {issue.heldBy} · {relativeTime(issue.heldAt)}` (PauseCircle vermilion) + a single-click `Reopen` link calling `useMutation(api.issues.reopen)({ workspace_id, issueNumber: n })` — NO confirmation.
   - Else: a `Hold issue` button that opens the `<HoldDialog issueNumber={n} .../>` inline panel. On the dialog's `onHold({ reason, stopRun })`:
     a. `await useMutation(api.issues.hold)({ workspace_id, issueNumber: n, reason })` — the mutation enforces the required reason AND writes audit_log (do NOT write audit_log from the client).
     b. If `stopRun` is true AND there is a `run?.runId`: `await requestCancel({ runId: run.runId })` — a SEPARATE call setting the existing cooperative-cancel flag (D-14). Wrap in try/catch; a cancel failure must not block the hold.
     c. Close the dialog.
   - Surface any thrown hold error (e.g. the mutation's `A reason is required to hold this issue.`) inline; keep the dialog open on failure.

Loading: render a light placeholder while `issue === undefined`. The page must NEVER render a stale status when a query is unresolved/failed — mirror the ISS-06 discipline (show `State unknown — refresh` for `deriveIssueStatus === 'unknown'`).

Note in a file-header comment that Phase 41 replaces this page's CONTENTS (the Workspace frame) at this SAME URL — the route does not move.
  </action>

  <verify>
    <automated>cd apps/dispatch-control && test -f "app/(dashboard)/issues/[issueNumber]/page.tsx" && grep -q "api.issues.hold" "app/(dashboard)/issues/[issueNumber]/page.tsx" && grep -q "api.issues.reopen" "app/(dashboard)/issues/[issueNumber]/page.tsx" && grep -q "requestCancel" "app/(dashboard)/issues/[issueNumber]/page.tsx" && grep -q "listByIssueNumber" "app/(dashboard)/issues/[issueNumber]/page.tsx" && pnpm exec tsc --noEmit -p tsconfig.json
</automated>
  </verify>

  <acceptance_criteria>
    - `app/(dashboard)/issues/[issueNumber]/page.tsx` exists
    - It calls `api.issues.hold` and `api.issues.reopen` via `useMutation`
    - It calls `requestCancel` ONLY when the dialog's `stopRun` is true and a runId exists (separate from the hold call)
    - It does NOT write `audit_log` from the client (`grep -q "auditLog" page.tsx` returns nothing) — the audit write is in the Plan 40-02 mutation
    - It renders the held banner format `Held · {reason} · {heldBy} · {time}` and a single-click `Reopen` with no confirmation
    - It reuses `StageStrip` from `../_components/StageStrip` (does not redefine a 5-segment strip)
    - It renders run history via `api.pipelineRuns.listByIssueNumber` and `issueRunHref`
    - It never renders a stale status: `deriveIssueStatus==='unknown'` shows `State unknown — refresh`
    - `pnpm --filter dispatch-control exec tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>The overview page is the issue-keyed landing with a persistent hold control; hold requires a reason (enforced + audited in the mutation), the stop-run checkbox sets runs.cancelRequested separately, and reopen clears the hold in one click.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/HoldDialog.test.tsx` is GREEN.
- `pnpm --filter dispatch-control exec tsc --noEmit` exits 0.
- The `issues:hold` convex-test cases (Plan 40-01 `__tests__/issues.test.ts`) prove the required-reason rejection and the audit_log write happen server-side — this plan does not duplicate that assertion client-side.
</verification>

<success_criteria>
- ISS-04: hold requires a reason, held issues show reason/who/when, reopen works in one click, and the reason is recorded to audit_log by the mutation.
- The "also stop the run" checkbox (default on) sets the existing `runs.cancelRequested` flag as a distinct call.
- ISS-02: `/issues/[n]` is a real overview page linking into review, voice, and run history — the issue-keyed landing Phase 41 recomposes in place.
</success_criteria>

<output>
After completion, create `.planning/phases/40-issue-entity-issues-home/40-07-SUMMARY.md`.
</output>
