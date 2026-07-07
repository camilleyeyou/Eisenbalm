---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 04
type: execute
wave: 2
depends_on: ["30-01"]
files_modified:
  - apps/dispatch-control/components/Masthead.tsx
  - apps/dispatch-control/app/(dashboard)/layout.tsx
  - apps/dispatch-control/__tests__/Masthead.test.tsx
autonomous: true
requirements: [CHR-02]
must_haves:
  truths:
    - "Every dashboard screen shows a persistent 52px ink masthead"
    - "The masthead shows the current issue number, a pipeline-state chip, month-to-date spend vs cap, and the auto-publish lock chip — all from live Convex queries"
    - "The masthead carries the Awaiting-you trigger and a sign-out affordance"
  artifacts:
    - path: "apps/dispatch-control/components/Masthead.tsx"
      provides: "Persistent 1c masthead with 4 live chips + Awaiting-you trigger + UserButton"
      contains: "monthToDateCost"
    - path: "apps/dispatch-control/app/(dashboard)/layout.tsx"
      provides: "Column layout mounting <Masthead/> above the sidebar+main row"
      contains: "Masthead"
  key_links:
    - from: "apps/dispatch-control/components/Masthead.tsx"
      to: "convex api.runs.monthToDateCost / api.pipelineConfig.getAll / api.runs.latest"
      via: "useQuery with DEFAULT_WORKSPACE_ID"
      pattern: "useQuery\\("
---

<objective>
Build the persistent black masthead (CHR-02) to dc.html fidelity and mount it above the sidebar+content row so it appears on every dashboard route. Four live chips: issue number + pipeline-state chip, month-to-date spend vs cap, and the auto-publish lock chip — plus the Awaiting-you trigger (its dropdown is built in Plan 30-06) and the Clerk sign-out affordance.

Purpose: The masthead + inbox carry the real operator signal (D-04) while Review Desk is still a placeholder.
Output: `Masthead.tsx` wired to existing Convex queries; a rewritten `(dashboard)/layout.tsx` with the masthead on top; a component test asserting the chips render from mocked query data.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md
@apps/dispatch-control/app/(dashboard)/layout.tsx
@apps/dispatch-control/lib/workspace.ts
@convex/runs.ts
@convex/pipelineConfig.ts
</context>

<interfaces>
<!-- Masthead data wiring — all queries already exist, verified in RESEARCH Pattern 2: -->
<!-- import { api } from '@convex/_generated/api'  ·  import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace' -->
<!-- const latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })  → { runId, status: 'running'|'awaiting-review'|'complete'|'failed', startedAt } | null -->
<!-- issueNumber lives on the OLDER pipelineRuns table, NOT runs. Cross-ref: useQuery(api.pipelineRuns.byRunId, latest ? { runId: latest.runId } : 'skip') → { issueNumber, ... } | null -->
<!-- const mtd = useQuery(api.runs.monthToDateCost, { workspace_id }) → { mtdUsd: number, completedCount, trailingCosts } -->
<!-- const config = useQuery(api.pipelineConfig.getAll, { workspace_id }) → Array<{ key, value(JSON-encoded string) }>. Cap = row key 'monthly_cap_usd' (JSON.parse → number). Lock = row key 'auto_publish' (JSON.parse → boolean). CANONICAL per RESEARCH Pattern 2 — NOT the env var. -->
<!-- Verify Convex useQuery 'skip' sentinel against node_modules/convex/react types (Open Question 3, 30-second check). -->
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Masthead.tsx — 4 live chips + Awaiting-you trigger + sign-out</name>
  <read_first>
    - convex/runs.ts (latest, monthToDateCost return shapes)
    - convex/pipelineConfig.ts (getAll — key/value rows)
    - convex/pipelineRuns.ts (byRunId — issueNumber source)
    - apps/dispatch-control/components/AppSidebar.tsx (existing UserButton usage to reuse)
    - apps/dispatch-control/__tests__/costRollup.test.ts (component-test + convex-mock precedent)
  </read_first>
  <files>apps/dispatch-control/components/Masthead.tsx, apps/dispatch-control/__tests__/Masthead.test.tsx</files>
  <behavior>
    - Given mocked useQuery returning latest.status='awaiting-review', the masthead renders a marigold "Awaiting review" state chip
    - Given mtd.mtdUsd=12.4 and config 'monthly_cap_usd'=200, it renders "$12.40 / $200"
    - Given config 'auto_publish'=false, it renders an "Auto-publish OFF" lock chip
    - Given pipelineRuns.byRunId.issueNumber=42, it renders "Issue 42" (or a graceful dash when null)
    - The wordmark renders "DISPATCH", a vermilion "/", and "CONTROL"
  </behavior>
  <action>
    Create `components/Masthead.tsx` as a Client Component (`'use client'`). Wire the four data sources per the interfaces block (useQuery with DEFAULT_WORKSPACE_ID; cross-ref pipelineRuns.byRunId with the `'skip'` sentinel when latest is null). Render to dc.html measurements (RESEARCH "Masthead measurements"):
    - Bar: `h-[52px] bg-[color:var(--color-ink)] text-[color:var(--color-masthead-text)] px-[22px] flex items-center gap-4`.
    - Wordmark: Space Grotesk 700, 15.5px, `tracking-[.03em]` — `DISPATCH` + `<span class="text-[color:var(--color-vermilion)]">/</span>` + `CONTROL`.
    - Issue number chip: `Issue {issueNumber}` in IBM Plex Mono (`font-[family-name:var(--font-mono)]`), muted `--color-masthead-muted`; show `Issue —` when unresolved.
    - Pipeline-state chip: Space Grotesk 600, 9.5px, uppercase, `tracking-[.1em]`, `bg-[color:var(--color-marigold)] text-[color:var(--color-ink)] px-[9px] py-[3px] rounded-[2px]`; label = the status ("Awaiting review", "Running", "Complete", "Failed").
    - Spend: render `${mtdUsd.toFixed(2)} / ${cap}` in IBM Plex Mono; if mtdUsd ≥ cap, tint the numerator `text-[color:var(--color-vermilion)]` (ambient warning at cap, not a hard stop — DECISIONS.md).
    - Auto-publish lock chip: `Auto-publish OFF` (or ON) — OFF in `--color-green`-tinted text, ON in `--color-vermilion` (the friction/danger state).
    - Awaiting-you trigger: a `<button>` styled per spec (Space Grotesk 600 10.5px uppercase `tracking-[.04em]`, `bg-[color:var(--color-vermilion)] text-[color:var(--color-masthead-text)] px-[12px] py-[5px] rounded-[2px] cursor-pointer`), pushed to the right (`ml-auto`). For THIS plan it is a static trigger — Plan 30-06 wires the dropdown. Leave a clear insertion point (e.g. render `{/* AwaitingYouInbox mounts here in 30-06 */}` and export the trigger so 30-06 can attach state).
    - Sign-out: mount the Clerk `<UserButton />` (import from `@clerk/nextjs`) at the far right after the Awaiting-you trigger.
    Author `__tests__/Masthead.test.tsx` per the behavior block, mocking `convex/react`'s `useQuery` (mirror the costRollup.test.ts mock pattern) and Clerk's UserButton.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run Masthead</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "monthToDateCost" apps/dispatch-control/components/Masthead.tsx`
    - `grep -q "monthly_cap_usd" apps/dispatch-control/components/Masthead.tsx`
    - `grep -q "auto_publish" apps/dispatch-control/components/Masthead.tsx`
    - `grep -q "var(--color-vermilion)" apps/dispatch-control/components/Masthead.tsx` (wordmark slash)
    - `grep -q "h-\[52px\]" apps/dispatch-control/components/Masthead.tsx`
    - Masthead.test.tsx passes all behavior assertions
  </acceptance_criteria>
  <done>Masthead renders all 4 live chips + Awaiting-you trigger + sign-out from mocked queries; test green.</done>
</task>

<task type="auto">
  <name>Task 2: Mount Masthead in the dashboard layout (persistent on every route)</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/layout.tsx (current flex-row shell + AutoPublishBanner)
  </read_first>
  <files>apps/dispatch-control/app/(dashboard)/layout.tsx</files>
  <action>
    Rewrite `(dashboard)/layout.tsx` from a single flex-row into a column: top-level `<div className="flex h-screen flex-col overflow-hidden bg-[color:var(--color-rail)]">` containing (1) `<Masthead />` (imported from `@/components/Masthead`) and (2) a `<div className="flex flex-1 overflow-hidden">` holding `<AppSidebar />` + `<main className="flex-1 overflow-y-auto p-6">…</main>`. Keep the existing `<AutoPublishBanner workspace_id={DEFAULT_WORKSPACE_ID} />` inside `<main>` unchanged (do not remove functionality — D-07). The masthead spans full width above the sidebar+main row.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "import Masthead" apps/dispatch-control/app/(dashboard)/layout.tsx` (or `from '@/components/Masthead'`)
    - `grep -q "<Masthead" apps/dispatch-control/app/(dashboard)/layout.tsx`
    - `grep -q "flex-col" apps/dispatch-control/app/(dashboard)/layout.tsx` (column layout)
    - `grep -q "AutoPublishBanner" apps/dispatch-control/app/(dashboard)/layout.tsx` (preserved)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Masthead is mounted above the sidebar+main row on every dashboard route; AutoPublishBanner preserved; build green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run Masthead` green
- `pnpm --filter dispatch-control build` exits 0
</verification>

<success_criteria>
CHR-02: persistent 52px ink masthead on every screen with issue #, state chip, spend vs cap, and auto-publish lock chip from live Convex data.
</success_criteria>

<output>
After completion, create `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-04-SUMMARY.md`
</output>
