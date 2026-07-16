---
phase: 48-brief-entry-point
plan: 05
type: execute
wave: 2
depends_on: ["48-01", "48-02"]
files_modified:
  - apps/dispatch-control/lib/pipelineControlClient.ts
  - apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx
autonomous: true
requirements: [ENT-01]

must_haves:
  truths:
    - "The Create panel shows two equal peer cards: 'Find a story with agents' and 'Start from my brief'"
    - "The brief card reveals an intake form: premise, peg, organization name (+ optional website, optional source material)"
    - "Submitting the brief form chains ensureByNumber → triggerBriefRun → router.push(issueHref(n)), landing at Stage 1"
    - "The existing 'Find a story with agents' path is unchanged (still calls triggerRun)"
  artifacts:
    - path: "apps/dispatch-control/lib/pipelineControlClient.ts"
      provides: "triggerBriefRun client + TriggerBriefRunBody interface"
      contains: "triggerBriefRun"
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx"
      provides: "second peer card + inline brief-intake form + submit chain"
      contains: "Start from my brief"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx"
      to: "POST /pipeline/run/brief"
      via: "triggerBriefRun(body, token) on brief-form submit"
      pattern: "triggerBriefRun"
---

<objective>
Fill the reserved-but-absent second grid cell in `CreatePanel.tsx` with the "Start from my brief" peer card (ENT-01: two EQUAL paths, not a muted secondary), reveal an inline intake form collecting exactly ENT-02's set (premise, peg, organization, optional source material), and add the `triggerBriefRun` client (sibling of `triggerRun`) that posts to `POST /pipeline/run/brief` with the Clerk token. On submit both paths land in the Issue Workspace at Stage 1.

Purpose: turn `CreatePanel.test.tsx` (48-02) green.
Output: `triggerBriefRun` client + the second Create card with its intake form.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-brief-entry-point/48-RESEARCH.md
@apps/dispatch-control/lib/pipelineControlClient.ts
@apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx
@docs/API_CONTRACTS.md

<interfaces>
<!-- Exact current shapes the new work mirrors. -->

triggerRun (pipelineControlClient.ts L63-84): fetches `${pipelineBaseUrl()}/pipeline/run` POST with
`Authorization: Bearer ${token}` when token present; throws Error(`trigger-run failed (${status})...`)
on !res.ok; returns `TriggerRunResult { runId: string }`. `pipelineBaseUrl()` reads
NEXT_PUBLIC_PIPELINE_URL (throws if unset).

CreatePanel.tsx (L30-83): `handleCreate` does `await ensureByNumber({workspace_id: DEFAULT_WORKSPACE_ID,
issueNumber: nextIssueNumber})` → `const token = await getToken()` → `await triggerRun({issueNumber:
nextIssueNumber}, token)` → `router.push(issueHref(nextIssueNumber))`. The grid is
`<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">` with ONE card + a JSX comment placeholder
(L79-80) for the second cell. Button styling: `min-h-[44px] ... bg-[color:var(--color-ink)] ...`.

The §48 endpoint body (from 48-01 contract): `{ issueNumber?, premise, peg,
organization: { name, website?, charityNavigatorUrl?, guidestarUrl? }, sourceMaterial? }`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add triggerBriefRun client to pipelineControlClient.ts</name>
  <files>apps/dispatch-control/lib/pipelineControlClient.ts</files>
  <read_first>
    - apps/dispatch-control/lib/pipelineControlClient.ts (triggerRun L63-84 — the sibling to mirror exactly)
    - docs/API_CONTRACTS.md §48 (the request body shape)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Frontend" (~L379-406)
  </read_first>
  <action>
    Add `export interface TriggerBriefRunBody { issueNumber?: number; premise: string; peg: string; organization: { name: string; website?: string; charityNavigatorUrl?: string; guidestarUrl?: string }; sourceMaterial?: string }`.
    Add `export async function triggerBriefRun(body: TriggerBriefRunBody, token: string | null): Promise<TriggerRunResult>` mirroring `triggerRun` EXACTLY: POST `${pipelineBaseUrl()}/pipeline/run/brief`, `Content-Type: application/json` + `Authorization: Bearer ${token}` when token present, `JSON.stringify(body)`; on `!res.ok` throw `Error(\`trigger-brief-run failed (${res.status})${detail ? \`: ${detail}\` : ''}\`)`; return `(await res.json()) as TriggerRunResult`. Reuse the existing `TriggerRunResult` type. Do NOT modify `triggerRun`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i "pipelineControlClient" || echo "no client type errors"</automated>
  </verify>
  <acceptance_criteria>
    - `grep "export async function triggerBriefRun" apps/dispatch-control/lib/pipelineControlClient.ts` matches.
    - `grep "/pipeline/run/brief" apps/dispatch-control/lib/pipelineControlClient.ts` matches.
    - `grep "export interface TriggerBriefRunBody" apps/dispatch-control/lib/pipelineControlClient.ts` matches.
    - The existing `triggerRun` function is unchanged (`grep -c "export async function triggerRun" ...` still returns 1).
  </acceptance_criteria>
  <done>The console can POST a human brief payload to /pipeline/run/brief with the Clerk token, mirroring triggerRun. (ENT-01 client seam.)</done>
</task>

<task type="auto">
  <name>Task 2: Fill CreatePanel's second cell with the 'Start from my brief' peer card + inline intake form</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx (the whole file — the grid, handleCreate, and the reserved-cell comment)
    - apps/dispatch-control/__tests__/CreatePanel.test.tsx (the assertions this task must satisfy)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Frontend" (~L379-406) and 48-CONTEXT D-13
  </read_first>
  <action>
    Import `triggerBriefRun` (and `TriggerBriefRunBody` if needed) from `@/lib/pipelineControlClient`. Replace the reserved-cell JSX comment (L79-80) with a SECOND peer card of EQUAL visual weight (same border/surface/`min-h-[44px]` button styling as the first card — ENT-01 "two equal paths", NOT muted): heading "Start from my brief", a one-line description, and a primary button "Start from my brief".
    Add local state: `const [briefOpen, setBriefOpen] = useState(false)` (inline-expand — Claude's discretion within the 1c token system; inline is simplest) and controlled fields `premise`, `peg`, `orgName`, `orgWebsite`, `sourceMaterial` (strings). Clicking the button toggles `briefOpen`; when open, render an inline form with labeled inputs: Premise (textarea, required), Peg (input, required), Organization name (input, required), Organization website (input, optional), Source material (textarea, optional) + a submit button "Start from my brief".
    Add `async function handleCreateBrief()` mirroring `handleCreate`: guard on `busy`; `setBusy(true)`; `setError(null)`; try `await ensureByNumber({workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: nextIssueNumber})` → `const token = await getToken()` → `await triggerBriefRun({ issueNumber: nextIssueNumber, premise, peg, organization: { name: orgName, ...(orgWebsite ? { website: orgWebsite } : {}) }, ...(sourceMaterial ? { sourceMaterial } : {}) }, token)` → `router.push(issueHref(nextIssueNumber))`; catch → `setError(...)` + `setBusy(false)`. Client-side require premise/peg/orgName non-empty before submit (disable the submit button otherwise) so an empty org never reaches the 422.
    Keep the first card + `handleCreate` (triggerRun) path byte-unchanged. Both submit chains end with `router.push(issueHref(nextIssueNumber))` → both land at Stage 1 (ENT-01).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- CreatePanel</automated>
  </verify>
  <acceptance_criteria>
    - `grep "Start from my brief" apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx` matches (card + button label).
    - `grep "triggerBriefRun" apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx` matches inside a `handleCreateBrief`-style submit handler.
    - `grep "handleCreate\b" ...` still present (first path unchanged) and `grep "triggerRun\b" ...` still calls the original client.
    - `pnpm --filter dispatch-control test:unit -- CreatePanel` exits 0 (two-card render + reveal-form + ensureByNumber→triggerBriefRun→router.push order assertions green).
  </acceptance_criteria>
  <done>The Create panel offers two equal paths; the brief path collects premise/peg/org/source-material and lands at Stage 1 via ensureByNumber → triggerBriefRun → issueHref. (ENT-01.)</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit -- CreatePanel` green.
- The brief card is a visual peer of the discovery card (same styling tokens), not a muted/disabled secondary.
- No direct Convex content mutation from the client — content routing goes dashboard → pipeline API (triggerBriefRun) → Convex (the write-boundary rule).
</verification>

<success_criteria>
Create issue offers two equal paths — "Find a story with agents" and "Start from my brief" — and submitting a brief (premise, peg, organization, optional source material) starts a run and lands the operator in the Issue Workspace at Story & Brief.
</success_criteria>

<output>
After completion, create `.planning/phases/48-brief-entry-point/48-05-SUMMARY.md`
</output>
