---
phase: 40-issue-entity-issues-home
plan: 05
type: execute
wave: 3
depends_on: ["40-02", "40-03", "40-04"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/StageStrip.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/HeldIssueRow.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/RecentlyPublishedRow.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx
autonomous: true
requirements: [ISS-01, ISS-03, ISS-06]

must_haves:
  truths:
    - "Issues home shows the in-progress issue as a card with a 5-stage strip, issue status, open-task count, claim coverage, voice state, estimated work remaining, and this issue's run cost"
    - "The operator sees the next scheduled slot with the Calibrator's repetition note and can start it early (triggerRun with the reserved issueNumber)"
    - "When issue status fails to load the card reads 'State unknown — refresh', never a silently stale 'ready'; loading preserves the stage-strip geometry; empty state opens the Create panel"
    - "Recently-published rows render the real verification record (claim coverage + who cleared facts/approved voice + when) — never a blank slot"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/page.tsx"
      provides: "Issues home orchestration: queries, derivation, lazy slot ensure, empty/loading/error"
      min_lines: 60
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx"
      provides: "in-progress card — 5-stage strip + all seven ISS-01 readouts + ISS-06 error/loading states"
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx"
      provides: "next-slot card + repetition note + Start #n early"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/issues/page.tsx"
      to: "apps/dispatch-control/lib/derivedState.ts"
      via: "deriveIssueStatus / deriveStageStates / deriveTasks / estimateWorkMinutes over live query results"
      pattern: "deriveStageStates|deriveTasks"
    - from: "apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx"
      to: "apps/dispatch-control/lib/pipelineControlClient.ts"
      via: "triggerRun({ issueNumber }) on Start early"
      pattern: "triggerRun"
---

<objective>
Build the Issues home screen (`/issues`) — the destination that answers "what's the state of the operation, and does it need me?" at a glance. In-progress card with its 5-stage strip and all readouts (ISS-01), the next scheduled slot with the repetition note and Start-early (ISS-03), held-issue rows with Reopen, recently-published rows with the real verification record, and a Create panel. Loading, empty, and error states per the UI-SPEC (ISS-06).

Purpose: This is the primary editorial surface of v4.0. Every readout derives from existing data via `lib/derivedState.ts` (Plan 40-04); zero new persisted fields.
Output: `/issues/page.tsx` + seven `_components`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md
@docs/API_CONTRACTS.md

<interfaces>
Consume (do NOT re-derive):
```typescript
// lib/derivedState.ts (Plan 40-04)
deriveIssueStatus(i): IssueStatus            // 'unknown'|'draft'|'needs-review'|'ready'|'published'|'held'
deriveStageStates(i): [StageStateResult × 5] // each { state: 'not-generated'|'in-progress'|'needs-you'|'clean'; openCount }
deriveTasks(i): DerivedTask[]                 // .length is the open-task count
estimateWorkMinutes(tasks): number           // rendered "~{n} min"
// lib/issueRouteResolver.ts (Plan 40-04): issueHref, issueRunHref
// lib/repetitionNoteClient.ts (Plan 40-04): fetchRepetitionNote(token) → { note, avoid, sampleSize }
// lib/pipelineControlClient.ts (existing): triggerRun({ issueNumber?, narratorSlug? }, token) → { runId }
```

Convex queries (existing + Plan 40-02):
```typescript
api.issues.listForWorkspace({ workspace_id })          // Doc<'issues'>[] — issueNumber DESC (40-02)
api.issues.byIssueNumber({ workspace_id, issueNumber })
api.issues.ensureByNumber (mutation)                   // lazy slot reservation (D-11)
api.issues.reopen (mutation)                           // HeldIssueRow "Reopen"
api.pipelineRuns.byIssueNumber({ issueNumber })        // the run for an issue (40-02)
api.runs.latest / api.runs.byRunId / api.runs.listForWorkspace
api.signOffs.activeByRunId({ runId })                  // factDone/voiceDone + who/when
api.claimChecks.allSignedOff({ runId }) / listByRunId  // claim coverage "checked X of Y"
api.qaCorrections.byRunId({ runId })
api.pitchLog.byRunId({ runId })
api.pipelineConfig.getAll({ workspace_id })            // schedule_cadence / schedule_next_run_at
```

Cost parsing: `parseCostJson(run.cost).total` from `lib/costRollup.ts` (existing) — the same helper the review page uses; render `$${total.toFixed(2)}`.

Workspace id: `DEFAULT_WORKSPACE_ID` from `@/lib/workspace`.
</interfaces>

<ui_contract>
State & Icon Contract (40-UI-SPEC §"State & Icon Contract") — every state renders LABEL + ICON (never color alone). lucide-react import names are exact:
- Issue status: Draft `FileEdit` ink-soft · Needs review `AlertTriangle` marigold-text · Ready `CheckCircle2` green · Published `BadgeCheck` green · Held `PauseCircle` vermilion.
- Stage segment: Not generated `Circle` faint · In progress `CircleDot` marigold (STATIC — never `Loader2`/spin) · Needs you `AlertTriangle`+count vermilion · Clean `CheckCircle2` green.
- Error (ISS-06): `AlertTriangle` vermilion, text `State unknown — refresh` (clicking re-runs the query).
Copy (verbatim): primary CTA `Find a story with agents`; `Start #{n} early`; `Open issue`; `Reopen`; empty heading `No issue in progress`; empty body `No issue in progress — discovery scheduled {day} {time}.`; repetition note shape `avoid {X} · avoid {Y}`; published verification `Facts cleared by {actor} · {time}` / `Voice approved by {actor} · {time}` / `{checked} of {total} claims checked`. An empty verification slot is NEVER rendered (D-29).
Visual hierarchy: in-progress `IssueCard` is the single focal point (full-width `--color-card`, Display heading, the only stage strip). Scheduled slot narrower/marigold-wash. Held + published are quiet rows. Create panel placed AFTER the lists. Empty-state inversion: no in-progress card → CreatePanel's CTA takes the focal point.
Chip padding uses the existing pixel-exact arbitrary values (`px-[9px] py-[3px]` etc.), matching Masthead/AppSidebar; all interactive targets `min-h-[44px]`.
</ui_contract>
</context>

<tasks>

<task type="auto">
  <name>Task 1: StageStrip + IssueCard (ISS-01 readouts + ISS-06 states)</name>

  <read_first>
    - apps/dispatch-control/__tests__/IssueCard.test.tsx (the RED spec from 40-01 — IssueCard is PRESENTATIONAL, takes derived values as props, no Convex mock; it must render 5 `data-testid="stage-segment"` elements, all readouts, and the exact error/loading behavior)
    - .planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md (State & Icon Contract + Visual Hierarchy + Typography/Color tables)
    - apps/dispatch-control/components/Masthead.tsx (the chip/label styling conventions — font-mono for numeric readouts, px-[9px] py-[3px] chip padding, color-var usage)
    - apps/dispatch-control/lib/derivedState.ts (the StageState/IssueStatus/StageStateResult types IssueCard's props use)
  </read_first>

  <action>
Create two PRESENTATIONAL client components (they take already-derived values — the page in Task 3 does all querying/derivation).

`_components/StageStrip.tsx` — renders 5 segments from a `stages: StageStateResult[]` prop (length 5, labels `['Story','Draft','Fact Check','Voice','Approval']`). Each segment is a node with `data-testid="stage-segment"` carrying: the stage name, the state ICON per the State & Icon Contract (Not generated `Circle` faint / In progress `CircleDot` marigold STATIC / Needs you `AlertTriangle` vermilion + `· {openCount}` / Clean `CheckCircle2` green), and the state LABEL text (`Not generated`/`In progress`/`Needs you`/`Clean`). NEVER use `Loader2` here (that is reserved for System Activity "Running"). Each segment `min-h-[44px]`. Preserve the 5-segment geometry so a skeleton can reuse it.

`_components/IssueCard.tsx` — the in-progress focal card. Props (presentational): `{ issueNumber, status: IssueStatus, stages: StageStateResult[], openTaskCount: number, claimCoverage: { checked: number; total: number }, voiceState: StageState, workMinutes: number, runCostDisplay: string, state?: { kind: 'loading' } | { kind: 'error' } | { kind: 'ok' } }`.
- `state.kind === 'error'` OR `status === 'unknown'`: render ONLY the ISS-06 error body — `AlertTriangle` (vermilion) + a button/link reading exactly `State unknown — refresh` (an `onRefresh` prop callback). Render NO status label, NO stage clean/ready text. This is structural: a stale value must never survive.
- `state.kind === 'loading'`: render a skeleton that still contains a `<StageStrip>`-shaped 5-segment row (geometry preserved), no readout text.
- otherwise (ok): full card — Display-size heading `Issue {n}` (`font-display`), the issue-status readout (icon+label per contract), `<StageStrip stages={stages} />`, and the six remaining readouts each with a label: open-task count (`{openTaskCount} open`), claim coverage (`{checked} of {total} claims checked`), voice state (label from the contract), estimated work (`~{workMinutes} min`), run cost (`{runCostDisplay}` in `font-mono`), and an `Open issue` cobalt link to `issueHref(n)`.
Full-width `--color-card` surface; the card is the page's only Display heading and only stage strip (Visual Hierarchy).
  </action>

  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/IssueCard.test.tsx</automated>
  </verify>

  <acceptance_criteria>
    - `_components/StageStrip.tsx` and `_components/IssueCard.tsx` exist
    - StageStrip renders exactly 5 elements with `data-testid="stage-segment"`, each with a text label from `Not generated|In progress|Needs you|Clean`
    - `grep -q "Loader2" apps/dispatch-control/app/(dashboard)/issues/_components/StageStrip.tsx` returns nothing (no spinner in the stage strip)
    - IssueCard renders the literal `State unknown — refresh` when `state.kind==='error'` OR `status==='unknown'`, and in that branch renders neither `Ready` nor `Clean`
    - IssueCard loading state still renders 5 stage segments (geometry preserved)
    - `pnpm --filter dispatch-control test -- __tests__/IssueCard.test.tsx` exits 0 (was RED in 40-01)
  </acceptance_criteria>

  <done>The in-progress card and stage strip render all ISS-01 readouts and the ISS-06 error/loading states; the 40-01 IssueCard spec is GREEN.</done>
</task>

<task type="auto">
  <name>Task 2: ScheduledSlotCard + HeldIssueRow + RecentlyPublishedRow + CreatePanel</name>

  <read_first>
    - apps/dispatch-control/__tests__/ScheduledSlotCard.test.tsx (the RED spec from 40-01 — Start #{n} early calls triggerRun with the reserved issueNumber; renders the repetition note; renders nothing when note is null)
    - apps/dispatch-control/lib/pipelineControlClient.ts (triggerRun signature — `triggerRun(body, token)`)
    - apps/dispatch-control/components/AwaitingYouInbox.tsx (the row/link styling + min-h-[44px] convention for the held/published rows)
    - .planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md (Copywriting Contract — the exact verification-record and empty-state copy; the "no dead button", "layout holds two Create cards" rule)
  </read_first>

  <action>
Create four components:

`_components/ScheduledSlotCard.tsx` (client) — props `{ issueNumber: number; scheduledForLabel: string; note: string | null }` plus it obtains a token via `useAuth().getToken()`. Renders the marigold-wash slot card (Heading size, NO stage strip, narrower than IssueCard), the `scheduledForLabel`, the repetition note text VERBATIM (`{note}`, e.g. `avoid US-SE · avoid weather`) ONLY when `note` is non-null (render no placeholder chip when null), and a `Start #{issueNumber} early` cobalt link/button. On click: call `triggerRun({ issueNumber }, token)` then `router.push(issueHref(issueNumber))`. The card owns a small `busy` state so a double-click can't double-fire.

`_components/HeldIssueRow.tsx` (client) — props `{ issue: { issueNumber, heldReason?, heldBy?, heldAt? } }`. Renders a quiet ROW (not a card): the `Held` badge (`PauseCircle` vermilion) + `Held · {heldReason} · {heldBy} · {relativeTime(heldAt)}` + a single-click `Reopen` cobalt link that calls `useMutation(api.issues.reopen)({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber })` — NO confirmation dialog (D-17). `min-h-[44px]`.

`_components/RecentlyPublishedRow.tsx` (client) — props `{ issue: { issueNumber, publishedAt? }, verification: { checked: number; total: number; factsClearedBy?: string; factsClearedAt?: number; voiceApprovedBy?: string; voiceApprovedAt?: number } }`. Renders the quietest row: `Issue {n}` + `{checked} of {total} claims checked` + `Facts cleared by {factsClearedBy} · {time}` (green `CheckCircle2`) + `Voice approved by {voiceApprovedBy} · {time}`. **Never render an empty verification slot** — if a field is absent, render a plain-language `—` fallback WITH its label (e.g. `Facts cleared by —`) so absence never reads as "verified" (D-29). Do not omit the whole line.

`_components/CreatePanel.tsx` (client) — the ONE Create path this phase ships. A card with the primary CTA `Find a story with agents`. On click: compute the next issue number is done by the PAGE (Task 3) and passed in as a prop `nextIssueNumber`; the panel's handler calls `useMutation(api.issues.ensureByNumber)({ workspace_id, issueNumber: nextIssueNumber })` then `triggerRun({ issueNumber: nextIssueNumber }, token)` then `router.push(issueHref(nextIssueNumber))`. Build the layout as a row/grid that can hold a SECOND card later (Phase 48 "Start from my brief") — render only the one enabled card now, no dead/disabled second button (the slot is simply absent). `min-h-[44px]` on the CTA.

Provide a tiny `relativeTime(ms)` helper (inline or in the component) rendering `just now` / `{n}m ago` / `{n}h ago` / `{n}d ago`.
  </action>

  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/ScheduledSlotCard.test.tsx</automated>
  </verify>

  <acceptance_criteria>
    - All four components exist under `app/(dashboard)/issues/_components/`
    - ScheduledSlotCard calls `triggerRun` with `expect.objectContaining({ issueNumber })` and renders `Start #{n} early`
    - ScheduledSlotCard renders no `avoid`-text and no placeholder chip when `note` is null
    - RecentlyPublishedRow never renders a verification line without its label (grep the source: each of `Facts cleared by`, `Voice approved by`, `claims checked` is always present, guarded by a `—` fallback not an omission)
    - HeldIssueRow's Reopen calls `api.issues.reopen` and renders no confirmation dialog
    - CreatePanel renders exactly one enabled CTA `Find a story with agents` and no disabled/dead second button
    - `pnpm --filter dispatch-control test -- __tests__/ScheduledSlotCard.test.tsx` exits 0 (was RED in 40-01)
  </acceptance_criteria>

  <done>The scheduled-slot, held, recently-published, and create components render and wire their actions; the 40-01 ScheduledSlotCard spec is GREEN.</done>
</task>

<task type="auto">
  <name>Task 3: /issues/page.tsx — home orchestration (queries → derivation → render)</name>

  <read_first>
    - .planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md (Visual Hierarchy order, empty/loading/error contracts, section spacing 2xl between groups)
    - apps/dispatch-control/lib/derivedState.ts (the DerivationInputs shape the page must assemble from live query results)
    - apps/dispatch-control/app/(dashboard)/config/_components/AutomationPanel.tsx (how `schedule_cadence` / `schedule_next_run_at` are parsed out of `pipelineConfig.getAll` — reuse that exact parse for the scheduled-slot label)
    - apps/dispatch-control/lib/costRollup.ts (parseCostJson — the run-cost parse)
    - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx (the existing `'use client'` + useQuery + DEFAULT_WORKSPACE_ID page pattern to follow)
  </read_first>

  <action>
Create `apps/dispatch-control/app/(dashboard)/issues/page.tsx` (`'use client'`). It orchestrates all data and passes DERIVED values to the Task 1/2 components. Logic:

1. **Read issues + config:** `issuesList = useQuery(api.issues.listForWorkspace, { workspace_id })`; `configRows = useQuery(api.pipelineConfig.getAll, { workspace_id })`.
2. **In-progress issue:** the highest-issueNumber issues row that is `!published && !held` (the current draft). Resolve its run via `api.pipelineRuns.byIssueNumber({ issueNumber })`, then subscribe to `signOffs.activeByRunId`, `claimChecks.allSignedOff`, `claimChecks.listByRunId`, `qaCorrections.byRunId`, `pitchLog.byRunId`, `runs.byRunId` (for cost) and `runs.latest` (for `runStatus`) — skip each with `'skip'` when there is no runId.
3. **Assemble `DerivationInputs`** and compute `deriveIssueStatus`, `deriveStageStates`, `deriveTasks` (→ `.length` = open-task count), `estimateWorkMinutes(tasks)`. Claim coverage from `allSignedOff` → `{ checked: signedOff, total }`. Run cost from `parseCostJson(run.cost).total` → `$${total.toFixed(2)}`. Pass all to `<IssueCard state={{ kind: 'ok' }} ... />`.
4. **ISS-06 error/loading wiring:** while the in-progress issue exists but its status inputs (`signOffs`/`issue`) are still `undefined`, render `<IssueCard state={{ kind: 'loading' }} .../>`. If a query is in an error state (or `deriveIssueStatus` returns `'unknown'` with a runId present), render `<IssueCard state={{ kind: 'error' }} onRefresh={...} />`. `onRefresh` forces a re-subscribe (e.g. bump a `refreshKey` state used in a query arg or `window.location.reload()` as the documented last resort). NEVER show a prior value.
5. **Next scheduled slot (D-11):** compute `nextIssueNumber = (max existing issueNumber) + 1`. Compute `scheduledForLabel` from `schedule_next_run_at` (or `compute` from `schedule_cadence`) parsed exactly as AutomationPanel does, formatted `{weekday} {HH:MM}`. **Lazily ensure** the slot row: in a `useEffect`, call `useMutation(api.issues.ensureByNumber)({ workspace_id, issueNumber: nextIssueNumber, scheduledFor })` once (guard with a ref so it fires at most once per mount). Fetch the repetition note: on mount, `fetchRepetitionNote(await getToken())` into state (tolerate a thrown `RepetitionNoteError` by rendering `note={null}`). Render `<ScheduledSlotCard issueNumber={nextIssueNumber} scheduledForLabel={...} note={note} />`.
6. **Held list:** `issuesList.filter(i => i.held && !i.published)` → `<HeldIssueRow>` each.
7. **Recently published:** `issuesList.filter(i => i.published)` (newest first, cap ~5). For each, resolve its run (`pipelineRuns.byIssueNumber`) and read `signOffs.activeByRunId` + `claimChecks.allSignedOff` to build the verification record → `<RecentlyPublishedRow>`.
8. **Create panel:** `<CreatePanel nextIssueNumber={nextIssueNumber} />`, placed AFTER the lists.
9. **Empty state (D-30):** when there is NO in-progress issue, hide the IssueCard, show heading `No issue in progress` + body `No issue in progress — discovery scheduled {scheduledForLabel}.`, and render the CreatePanel OPEN/promoted as the focal point (Visual-Hierarchy inversion).
10. **Layout:** page gutter `lg`, `2xl` section breaks between in-progress / scheduled / held / recently-published groups, `xl` page top/bottom padding, on `--color-rail`.

Keep the file focused; extract no new shared logic beyond what's already in derivedState/resolver/clients.
  </action>

  <verify>
    <automated>cd apps/dispatch-control && test -f "app/(dashboard)/issues/page.tsx" && grep -q "deriveStageStates" "app/(dashboard)/issues/page.tsx" && grep -q "ensureByNumber" "app/(dashboard)/issues/page.tsx" && grep -q "fetchRepetitionNote" "app/(dashboard)/issues/page.tsx" && pnpm exec tsc --noEmit -p tsconfig.json
</automated>
  </verify>

  <acceptance_criteria>
    - `apps/dispatch-control/app/(dashboard)/issues/page.tsx` exists and is a `'use client'` component
    - It imports and calls `deriveIssueStatus`, `deriveStageStates`, `deriveTasks`, `estimateWorkMinutes` from `@/lib/derivedState`
    - It calls `api.issues.ensureByNumber` inside a once-guarded `useEffect` (lazy slot reservation, D-11)
    - It calls `fetchRepetitionNote` and tolerates a thrown error by passing `note={null}`
    - It renders the empty-state copy `No issue in progress — discovery scheduled` when there is no in-progress issue
    - It never passes a prior/stale value to IssueCard when status is unknown — it passes `state={{ kind: 'error' }}` or `state={{ kind: 'loading' }}`
    - `pnpm --filter dispatch-control exec tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>The Issues home renders the in-progress card, scheduled slot, held + recently-published rows, and Create panel, with correct empty/loading/error states, all derived from existing data.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/IssueCard.test.tsx __tests__/ScheduledSlotCard.test.tsx` both GREEN.
- `pnpm --filter dispatch-control exec tsc --noEmit` exits 0 for the whole app.
- Manual (deferred to 40-09 build gate): `/issues` renders the card + slot + lists; greyscale still distinguishes every readout by label+icon.
</verification>

<success_criteria>
- ISS-01: the in-progress card shows all seven readouts derived from existing data.
- ISS-03: the scheduled slot shows the repetition note and starts the reserved issueNumber early.
- ISS-06: status-load failure reads "State unknown — refresh"; loading preserves geometry; empty state opens Create.
</success_criteria>

<output>
After completion, create `.planning/phases/40-issue-entity-issues-home/40-05-SUMMARY.md`.
</output>
