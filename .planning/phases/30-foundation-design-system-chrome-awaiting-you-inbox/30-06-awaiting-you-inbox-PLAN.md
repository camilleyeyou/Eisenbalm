---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 06
type: execute
wave: 3
depends_on: ["30-04"]
files_modified:
  - apps/dispatch-control/components/AwaitingYouInbox.tsx
  - apps/dispatch-control/components/Masthead.tsx
  - apps/dispatch-control/__tests__/AwaitingYouInbox.test.tsx
autonomous: true
requirements: [CHR-04]
must_haves:
  truths:
    - "Clicking the masthead Awaiting-you chip opens a 360px dropdown aggregating everything blocked on a human"
    - "The inbox lists awaiting-review runs, the current-cycle failed run, unaccepted error-severity QA findings, and open claim-check sign-offs — blockers first"
    - "Each item routes to the working screen where the action can be taken; the inbox is never a dead end"
    - "The inbox adds zero new Convex tables or mutations — it is pure client-side derivation over existing queries"
  artifacts:
    - path: "apps/dispatch-control/components/AwaitingYouInbox.tsx"
      provides: "Pure-derivation dropdown over runs.listForWorkspace + runs.latest + qaCorrections.byRunId + claimChecks.allSignedOff"
      contains: "listForWorkspace"
  key_links:
    - from: "apps/dispatch-control/components/AwaitingYouInbox.tsx"
      to: "/run-monitor/runs/{runId}/review"
      via: "next/link routing per the existing ReviewQueue precedent (D-11)"
      pattern: "/run-monitor/runs/"
    - from: "apps/dispatch-control/components/Masthead.tsx"
      to: "AwaitingYouInbox"
      via: "the Awaiting-you trigger toggles the dropdown open"
      pattern: "AwaitingYouInbox"
---

<objective>
Build the cross-screen Awaiting-you inbox (CHR-04) as a masthead dropdown that answers "what needs me right now" — aggregating, blockers-first, from existing state only (D-08/D-09/D-10/D-11): awaiting-review + Gate-1-interrupt runs (same status literal — Pitfall 2), the current-cycle failed run, unaccepted error-severity `qaCorrections`, and open claim-check sign-offs. Pure client-side derivation, zero new backend. Each item routes to where the action can be taken today.

Purpose: The inbox is the operator's single "blocked on a human" queue while Review/Signal Desks are placeholders.
Output: `AwaitingYouInbox.tsx` dropdown wired into the masthead trigger; a component test asserting derivation + routing + no new mutations.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md
@convex/runs.ts
@convex/qaCorrections.ts
@convex/claimChecks.ts
@apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/ReviewQueue.tsx
</context>

<interfaces>
<!-- Inbox derivation (RESEARCH Pattern 3, verified against convex source). All are existing queries. import { api } from '@convex/_generated/api'; DEFAULT_WORKSPACE_ID from '@/lib/workspace'. -->
<!-- 1. runs.listForWorkspace({ workspace_id }) → Array<{ runId, status, startedAt }>. awaitingReview = filter status === 'awaiting-review'. Route EACH to /run-monitor/runs/{runId}/review (mirror ReviewQueue precedent; DO NOT special-case Gate-1 interrupts — no distinguishing field, no resume UI exists; flag as Phase 37 follow-up in the SUMMARY). -->
<!-- 2. runs.latest({ workspace_id }) → { runId, status } | null. failedItem = latest?.status === 'failed' ? latest : null. Current-cycle ONLY (D-10) — do NOT surface older failed runs from listForWorkspace. Route to /run-monitor/runs/{runId}. -->
<!-- 3. currentDraftRunId = awaitingReview[0]?.runId. qaCorrections.byRunId({ runId }) [skip if none] → rows with { severity: 'info'|'warning'|'error', accepted: boolean }. unresolvedErrors = filter severity === 'error' && !accepted. Route to the review page for that runId. -->
<!-- 4. claimChecks.allSignedOff({ runId }) [skip if none] → { total, signedOff, allSignedOff }. openSignOffs = total > 0 && !allSignedOff. Route to the review page for that runId. -->
<!-- Convex conditional skip: pass the string 'skip' as args when currentDraftRunId is undefined. Verify against node_modules/convex/react types (Open Question 3). -->
<!-- D-09: NO new Convex table/mutation — inbox files must contain zero `mutation(` or new schema. Every item is a useQuery projection. -->
-->
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: AwaitingYouInbox.tsx — pure-derivation dropdown, blockers-first</name>
  <read_first>
    - convex/runs.ts (listForWorkspace, latest)
    - convex/qaCorrections.ts (byRunId — severity/accepted fields)
    - convex/claimChecks.ts (allSignedOff — total/signedOff/allSignedOff)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/ReviewQueue.tsx (routing precedent — now under run-monitor after 30-02)
    - apps/dispatch-control/__tests__/runControl.test.tsx (next/navigation mock + convex mock precedent)
  </read_first>
  <files>apps/dispatch-control/components/AwaitingYouInbox.tsx, apps/dispatch-control/__tests__/AwaitingYouInbox.test.tsx</files>
  <behavior>
    - Given one run status 'awaiting-review' (runId 'r1'), the inbox lists an "Awaiting review" item linking to /run-monitor/runs/r1/review
    - Given qaCorrections for r1 with one row {severity:'error', accepted:false}, the inbox lists an error-blocker item (blockers ordered above the awaiting-review item)
    - Given claimChecks.allSignedOff = {total:3, signedOff:1, allSignedOff:false}, the inbox lists an "open sign-offs" item
    - Given latest.status 'failed' (runId 'rf'), the inbox lists a failed-run item linking to /run-monitor/runs/rf
    - Given no unresolved state, the inbox renders an empty-state message ("Nothing needs you right now" or similar)
    - Source-scan within the test file itself asserts AwaitingYouInbox.tsx contains no `mutation(` call
  </behavior>
  <action>
    Create `components/AwaitingYouInbox.tsx` (Client Component). Accept props `{ open: boolean; onClose: () => void }` (the masthead owns the trigger + open state). Derive the 4 categories exactly per the interfaces block using `useQuery`. Build a single item list ordered blockers-first: (1) unresolved error-severity QA findings, (2) open claim-check sign-offs, (3) awaiting-review runs, (4) current-cycle failed run. Render each item as a `next/link` with a short label + a severity dot color (`--color-vermilion` for errors/failed/unsourced, `--color-marigold` for warnings/sign-offs, `--color-cobalt` for interactive/awaiting-review) per the dc.html color legend. Route strings: awaiting-review + QA + sign-off items → `/run-monitor/runs/{runId}/review`; failed → `/run-monitor/runs/{runId}`. Style the dropdown to spec: `absolute top-[52px] w-[360px] bg-[color:var(--color-card)] border border-[color:var(--color-ink)]/[.16] border-t-[3px] border-t-[color:var(--color-vermilion)] shadow-[0_24px_50px_-20px_rgba(20,16,10,.5)]`; render only when `open`. Include an empty state. Every navigation call `onClose()`. Do NOT add any Convex mutation, table, or dismiss/snooze state (D-09 — pure derivation).
    Author `__tests__/AwaitingYouInbox.test.tsx` per the behavior block (mock convex/react useQuery + next/navigation, mirror runControl.test.tsx), including the no-`mutation(` source-scan assertion.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run AwaitingYouInbox</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "listForWorkspace" apps/dispatch-control/components/AwaitingYouInbox.tsx`
    - `grep -q "allSignedOff" apps/dispatch-control/components/AwaitingYouInbox.tsx` and `grep -q "byRunId" apps/dispatch-control/components/AwaitingYouInbox.tsx`
    - `grep -q "/run-monitor/runs/" apps/dispatch-control/components/AwaitingYouInbox.tsx`
    - `grep -q "w-\[360px\]" apps/dispatch-control/components/AwaitingYouInbox.tsx`
    - `grep -c "mutation(" apps/dispatch-control/components/AwaitingYouInbox.tsx` returns 0 (D-09 pure derivation)
    - AwaitingYouInbox.test.tsx passes all behavior + no-mutation assertions
  </acceptance_criteria>
  <done>Inbox derives all 4 categories blockers-first, routes to working screens, adds no backend; test green.</done>
</task>

<task type="auto">
  <name>Task 2: Wire the inbox dropdown into the masthead trigger</name>
  <read_first>
    - apps/dispatch-control/components/Masthead.tsx (the Awaiting-you trigger insertion point from 30-04)
    - apps/dispatch-control/components/AwaitingYouInbox.tsx (open/onClose props from Task 1)
  </read_first>
  <files>apps/dispatch-control/components/Masthead.tsx</files>
  <action>
    In `Masthead.tsx` add `useState(false)` for the inbox open state. Wrap the Awaiting-you trigger `<button>` + `<AwaitingYouInbox open={open} onClose={() => setOpen(false)} />` in a `relative` positioned container so the `absolute top-[52px]` dropdown anchors under the chip. The trigger toggles `open`. Optionally reflect a count badge on the chip using the same derivation is NOT required this phase — keep the trigger label static ("Awaiting you"). Ensure clicking outside or a nav item closes it (onClose on navigation is already handled inside the inbox; add a simple backdrop or `onBlur`/click-away if trivial — Claude's discretion).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "AwaitingYouInbox" apps/dispatch-control/components/Masthead.tsx`
    - `grep -q "useState" apps/dispatch-control/components/Masthead.tsx`
    - `grep -q "relative" apps/dispatch-control/components/Masthead.tsx` (dropdown anchor container)
    - `pnpm --filter dispatch-control build` exits 0 and full test suite green
  </acceptance_criteria>
  <done>The masthead Awaiting-you chip opens/closes the inbox dropdown; build + tests green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run AwaitingYouInbox` green
- `pnpm --filter dispatch-control build` exits 0
- No new Convex tables/mutations introduced
</verification>

<success_criteria>
CHR-04: masthead inbox aggregates awaiting-review/Gate-1/failed/blocker items blockers-first from existing queries, routes to working screens, zero new backend.
</success_criteria>

<output>
After completion, create `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-06-SUMMARY.md`. Note in the SUMMARY the scoped-out Gate-1 resume UI gap (Pitfall 2 → Phase 37 Signal Desk).
</output>
