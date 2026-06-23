---
phase: 27-money-notifications
plan: 04
type: execute
wave: 3
depends_on: ["27-02"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/finance/page.tsx
  - apps/dispatch-control/app/(dashboard)/finance/_components/FinanceSummaryCard.tsx
  - apps/dispatch-control/app/(dashboard)/finance/_components/IssueRevenueTable.tsx
  - apps/dispatch-control/app/(dashboard)/finance/_components/ModelPricingCard.tsx
  - apps/dispatch-control/app/(dashboard)/finance/_components/PayoutRow.tsx
autonomous: true
requirements: [RCN-01, RCN-02]

must_haves:
  truths:
    - "The /finance route shows a top-line This Issue card (Gross sales / Stripe fees / Net to charity) as the primary visual anchor"
    - "A per-issue reconciliation table lists Issue / Charity / Sales window / Orders / Gross / Stripe fees / Net to charity / Payout status / Action, with an Unattributed orders fallback bucket"
    - "Operator can mark a pending payout sent via inline confirmation (no modal); the row flips to a green Sent badge with a sent date without page reload"
    - "model_pricing renders read-only labeled Projection Pricing with a 30-day staleness amber badge"
    - "Stripe fee column shows — until resolved and never blocks gross/net display"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/finance/page.tsx"
      provides: "Finance route replacing the placeholder; three stacked sections space-y-4"
      contains: "FinanceSummaryCard"
    - path: "apps/dispatch-control/app/(dashboard)/finance/_components/IssueRevenueTable.tsx"
      provides: "Per-issue reconciliation table + payout action column"
    - path: "apps/dispatch-control/app/(dashboard)/finance/_components/PayoutRow.tsx"
      provides: "Inline mark-sent confirmation wired to payouts:markPayoutSent"
    - path: "apps/dispatch-control/app/(dashboard)/finance/_components/ModelPricingCard.tsx"
      provides: "Read-only projection pricing table + staleness badge"
  key_links:
    - from: "PayoutRow.tsx"
      to: "convex/payouts.ts markPayoutSent"
      via: "useMutation(api.payouts.markPayoutSent) + Clerk getToken"
      pattern: "markPayoutSent"
    - from: "IssueRevenueTable.tsx"
      to: "convex/finance.ts perIssueRevenue"
      via: "useQuery(api.finance.perIssueRevenue)"
      pattern: "perIssueRevenue"
    - from: "ModelPricingCard.tsx"
      to: "apps/web staleness helper logic"
      via: "isStale 30-day threshold (reimplemented or shared)"
      pattern: "30"
---

<objective>
Replace the `/finance` placeholder in `apps/dispatch-control` with the approved 27-UI-SPEC finance view: a FinanceSummaryCard (This Issue gross/fees/net — the primary anchor), an IssueRevenueTable (per-issue reconciliation + payout status + inline mark-sent action), and a read-only ModelPricingCard (Projection Pricing with 30-day staleness badge). Wire to the Wave 2 Convex `finance:perIssueRevenue` query and `payouts` mutations.

Purpose: Make the "100% of proceeds" promise auditable in one operator view (RCN-01, RCN-02), following the APPROVED UI contract exactly.
Output: page.tsx + 4 components.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/27-money-notifications/27-UI-SPEC.md
@docs/API_CONTRACTS.md

<interfaces>
finance:perIssueRevenue (convex/finance.ts) returns per-issue rows: { issueNumber, issueId, charitySlug, charityName, windowStart, windowEnd (null=open), orderCount, grossCents, netCents, feeCents (nullable) } + an unattributed bucket.
payouts:listByWorkspace (convex/payouts.ts) returns payout rows { _id, issueNumber, charitySlug, amount, status, sentAt?, reference? }.
payouts:markPayoutSent({ payoutId, reference, sentAt }) — Clerk-JWT-guarded mutation.
model_pricing rows: { model, inputPricePer1M, outputPricePer1M, updatedAt }.

UI-SPEC fixed values:
- Page title: `<h1 className="text-xl font-semibold text-neutral-900">Finance</h1>`
- Sections stacked space-y-4. Summary stat values text-xl font-semibold tabular-nums. NO text-2xl.
- Currency columns: text-sm tabular-nums text-neutral-900.
- Payout badges: pending `bg-yellow-100 text-yellow-800`, sent `bg-green-100 text-green-800`.
- Staleness badge: `bg-amber-50 border border-amber-200 text-amber-800`, `role="alert"` if after-load; shown when Date.now()-updatedAt > 30*24*60*60*1000.
- Projection label: `bg-neutral-100 text-neutral-600`; sub-label text-xs text-neutral-400.
- Table style mirrors RegistryTable: w-full text-sm, thead text-xs text-neutral-500 uppercase tracking-wide, tbody rows border-t border-neutral-100, cells py-3 px-4.
- All interactive: min-h-[44px] min-w-[44px] + focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1.
- Single <main> already enforced by (dashboard)/layout.tsx.
- Mark-sent primary button bg-neutral-900 text-white; inline confirm replaces button with [Mark as sent] [Keep pending] same row height (NO modal).

Copy (verbatim from UI-SPEC Copywriting Contract):
- This-issue heading `This Issue`; labels `Gross sales` / `Stripe fees` / `Net to charity`.
- Empty no-orders: `No orders recorded for this issue window yet. Orders appear here as they are processed through Stripe.`
- Empty no-issues: `No published issues found. Reconciliation appears here once the first issue is published and orders are placed.`
- Unattributed: `Unattributed orders` / sub `Orders outside any issue window (pre-launch or between issues).`
- Mark sent button `Mark sent`; confirm prompt `Confirm this payout was sent. This action is audit-logged and cannot be undone automatically.`; confirm `Mark as sent`; cancel `Keep pending`; statuses `Pending`/`Sent`.
- ModelPricing heading `Projection Pricing`; sub `Projection only — not actual cost. Used for run budget estimates.`; staleness `Prices may be outdated — last updated {N} days ago`.
- Fee error: `Stripe fee data unavailable. Gross and net figures are accurate; fee column shows "—". Retry in a moment.`
- Latest open window: Sales window value `{publish date} — ongoing` in text-xs text-neutral-400.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: FinanceSummaryCard + ModelPricingCard</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/finance/page.tsx (the 14-line placeholder being replaced)
    - apps/dispatch-control/app/(dashboard)/runs/_components/CostRollup.tsx (stat-card type scale + card markup reference)
    - apps/dispatch-control/app/(dashboard)/runs/_components/BudgetAlertBanner.tsx (amber badge classes + pipeline_config read pattern + role="alert")
    - .planning/phases/27-money-notifications/27-UI-SPEC.md (FinanceSummaryCard + ModelPricingCard specs, copy)
    - apps/dispatch-control/lib/workspace.ts (getCurrentWorkspace)
  </read_first>
  <action>
    Create `FinanceSummaryCard.tsx`: a `rounded-lg border border-neutral-200 bg-white` card with heading `This Issue` (text-sm font-semibold text-neutral-800) and three stat cells side-by-side. Each cell: label (text-xs text-neutral-500) = `Gross sales` / `Stripe fees` / `Net to charity`; value (text-xl font-semibold tabular-nums text-neutral-900) formatted as currency from cents (helper `formatCents(cents, currency)`); fees cell shows `—` when feeCents is null. Props take the current (latest) issue's reconciliation row. Skeleton state `rounded bg-neutral-100 animate-pulse`. Do NOT use text-2xl.

    Create `ModelPricingCard.tsx`: read-only table of `model_pricing` rows (useQuery `api.modelPricing`-equivalent or the existing pricing query — confirm the existing query name in convex). Heading `Projection Pricing` (text-sm font-semibold text-neutral-800) + sub-label `Projection only — not actual cost. Used for run budget estimates.` (text-xs text-neutral-400). Columns: model / input $/1K / output $/1K / last updated. When any row's `Date.now() - updatedAt > 30*24*60*60*1000`, render an amber staleness badge `Prices may be outdated — last updated {N} days ago` with classes `bg-amber-50 border border-amber-200 text-amber-800` and `role="alert"`. Compute N = floor(daysSinceUpdated). Table markup mirrors RegistryTable.
  </action>
  <verify>
    <automated>test -f "apps/dispatch-control/app/(dashboard)/finance/_components/FinanceSummaryCard.tsx" && test -f "apps/dispatch-control/app/(dashboard)/finance/_components/ModelPricingCard.tsx" && grep -q "This Issue" "apps/dispatch-control/app/(dashboard)/finance/_components/FinanceSummaryCard.tsx" && grep -q "Projection Pricing" "apps/dispatch-control/app/(dashboard)/finance/_components/ModelPricingCard.tsx" && grep -q "bg-amber-50" "apps/dispatch-control/app/(dashboard)/finance/_components/ModelPricingCard.tsx" && echo CARDS_DONE</automated>
  </verify>
  <acceptance_criteria>
    - FinanceSummaryCard.tsx contains `This Issue`, `Gross sales`, `Stripe fees`, `Net to charity`, uses `text-xl` (not text-2xl) for stat values and `tabular-nums`
    - FinanceSummaryCard shows `—` for the fees cell when feeCents is null
    - ModelPricingCard.tsx contains `Projection Pricing`, the projection sub-label copy, the staleness copy `Prices may be outdated — last updated`, the amber classes `bg-amber-50 border border-amber-200 text-amber-800`, and `role="alert"`
    - ModelPricingCard computes staleness with the `30 * 24 * 60 * 60 * 1000` threshold
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: IssueRevenueTable + PayoutRow (inline mark-sent) + finance/page.tsx assembly</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx (inline confirmation pattern: confirmingAction state, no modal; table markup)
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx (STATUS_CLASSES badge pattern + table styling)
    - apps/dispatch-control/lib/reviewClient.ts (Clerk Bearer/getToken pattern for authed dashboard mutations)
    - convex/finance.ts + convex/payouts.ts (perIssueRevenue / listByWorkspace / markPayoutSent signatures)
    - .planning/phases/27-money-notifications/27-UI-SPEC.md (IssueRevenueTable columns, payout interaction contract, copy)
  </read_first>
  <action>
    Create `PayoutRow.tsx` (client component): renders the payout status badge (`Pending` yellow / `Sent` green) and the action cell. For a `pending` payout: a `Mark sent` button (`bg-neutral-900 text-white`, `min-h-[44px] min-w-[44px]`, focus-visible ring). Clicking sets `confirming` state which replaces the button INLINE in the same row (no modal) with the prompt `Confirm this payout was sent. This action is audit-logged and cannot be undone automatically.` and two buttons `Mark as sent` / `Keep pending`. `Mark as sent` calls `useMutation(api.payouts.markPayoutSent)` with `{ payoutId, reference, sentAt: Date.now() }` (capture a reference input inline). On success the Convex subscription flips the row to a green `Sent` badge and shows `Sent {Mon DD, YYYY}` in text-xs text-neutral-400; no page reload. `Keep pending` cancels (clears confirming).

    Create `IssueRevenueTable.tsx` (client component): `useQuery(api.finance.perIssueRevenue, ...)` + `useQuery(api.payouts.listByWorkspace, { workspace_id })`. Columns: Issue # / Charity / Sales window / Orders / Gross / Stripe fees / Net to charity / Payout status / Action. Currency cells `text-sm tabular-nums text-neutral-900`; fees cell shows `—` when feeCents null. Sales window: `{publishDate} — {nextPublishDate}`, and for the latest open window `{publishDate} — ongoing` in text-xs text-neutral-400. Render the `Unattributed orders` fallback row (sub-label copy) when the unattributed bucket has orders. Match each issue to its payout row (by issueNumber) and render `<PayoutRow>` in the Payout status + Action cells. thead `text-xs text-neutral-500 uppercase tracking-wide`; rows `border-t border-neutral-100`, cells `py-3 px-4`. Empty states: no-issues and no-orders copy verbatim. Skeleton: `rounded bg-neutral-100 animate-pulse`.

    Replace `finance/page.tsx`: keep `<h1 className="text-xl font-semibold text-neutral-900">Finance</h1>`, then stack `<FinanceSummaryCard>`, `<IssueRevenueTable>`, `<ModelPricingCard>` with `space-y-4`. Each section loads independently (no full-page spinner). Preserve `force-dynamic` if the existing settings/runs pages use it; resolve workspace via `getCurrentWorkspace()`.

    Then build to confirm it compiles: `cd apps/dispatch-control && npx next build` (or `pnpm --filter dispatch-control build`).
  </action>
  <verify>
    <automated>test -f "apps/dispatch-control/app/(dashboard)/finance/_components/IssueRevenueTable.tsx" && test -f "apps/dispatch-control/app/(dashboard)/finance/_components/PayoutRow.tsx" && grep -q "markPayoutSent" "apps/dispatch-control/app/(dashboard)/finance/_components/PayoutRow.tsx" && grep -q "Keep pending" "apps/dispatch-control/app/(dashboard)/finance/_components/PayoutRow.tsx" && grep -q "FinanceSummaryCard" "apps/dispatch-control/app/(dashboard)/finance/page.tsx" && grep -q "perIssueRevenue" "apps/dispatch-control/app/(dashboard)/finance/_components/IssueRevenueTable.tsx" && grep -q "Unattributed orders" "apps/dispatch-control/app/(dashboard)/finance/_components/IssueRevenueTable.tsx" && echo TABLE_DONE</automated>
  </verify>
  <acceptance_criteria>
    - PayoutRow.tsx calls `api.payouts.markPayoutSent`, uses inline confirmation (no Dialog/Modal import), contains `Mark sent`, `Mark as sent`, `Keep pending`, and the audit-log confirm prompt copy; status badges use `bg-yellow-100 text-yellow-800` (pending) and `bg-green-100 text-green-800` (sent)
    - IssueRevenueTable.tsx queries `api.finance.perIssueRevenue` and `api.payouts.listByWorkspace`, renders all 9 columns, the `Unattributed orders` bucket, the `— ongoing` open-window label, and `—` for unresolved fee cells
    - finance/page.tsx renders the `Finance` h1 + the three sections with `space-y-4` and no longer contains the placeholder text `coming in Phase 27`
    - All interactive elements carry `min-h-[44px]` and `focus-visible:ring-2`
    - `npx next build` (dispatch-control) exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
- dispatch-control builds clean.
- /finance shows the three sections per UI-SPEC; payout mark-sent is inline (no modal).
- Manual verify (VALIDATION.md row 27-04-PAYOUT): click Mark sent, confirm, observe green Sent badge + audit log row in Convex dashboard; fee column resolves from — to a figure once STRIPE_SECRET_KEY is set.
</verification>

<success_criteria>
- RCN-01: per-issue gross/fees/net visible from actuals; This Issue anchor card; staleness-badged read-only projection pricing.
- RCN-02: payout status across all issues at a glance; guarded+audited inline mark-sent.
</success_criteria>

<output>
After completion, create `.planning/phases/27-money-notifications/27-04-SUMMARY.md`
</output>
