---
phase: 27-money-notifications
plan: 04
subsystem: finance-dashboard-ui
tags: [dispatch-control, finance, reconciliation, payouts, convex, react, RCN-01, RCN-02]
requires:
  - ".planning/phases/27-money-notifications/27-UI-SPEC.md (approved design contract)"
  - "convex/finance.ts perIssueRevenue (27-02)"
  - "convex/payouts.ts markPayoutSent + listByWorkspace (27-02)"
  - "convex/schema.ts model_pricing + payouts + stripeOrders (27-01)"
provides:
  - "apps/dispatch-control /finance route — FinanceSummaryCard + IssueRevenueTable + ModelPricingCard + PayoutRow"
  - "convex/finance.ts — publishedIssues query (Convex-derived issue list) + listModelPricing query"
affects:
  - "Operator finance reconciliation view (RCN-01/RCN-02) — replaces the /finance placeholder"
  - "VALIDATION row 27-04-02 (manual mark-sent verify) is now actionable"
tech-stack:
  added: []
  patterns:
    - "Convex-derived published-issue list (finance:publishedIssues from payouts + stripeOrders) so dispatch-control needs no Sanity client"
    - "Convex query chaining with 'skip' guard: publishedIssues → perIssueRevenue({issues})"
    - "Inline (no-modal) mark-sent confirmation mirroring RegistryTable blocklist pattern"
    - "useMutation authed automatically via ConvexProviderWithClerk (no manual getToken)"
    - "Self-fetching client cards keep the page a thin server component (force-dynamic)"
key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/finance/_components/FinanceSummaryCard.tsx"
    - "apps/dispatch-control/app/(dashboard)/finance/_components/IssueRevenueTable.tsx"
    - "apps/dispatch-control/app/(dashboard)/finance/_components/ModelPricingCard.tsx"
    - "apps/dispatch-control/app/(dashboard)/finance/_components/PayoutRow.tsx"
  modified:
    - "apps/dispatch-control/app/(dashboard)/finance/page.tsx"
    - "convex/finance.ts"
decisions:
  - "Added two read-only queries to convex/finance.ts (publishedIssues + listModelPricing) — the UI had no way to source the issue list or model_pricing rows. dispatch-control has no Sanity dependency, so publishedIssues derives the issue windows from Convex data (payouts = one row per published issue; earliest stripeOrders.createdAt per charitySlug as the publishedAt proxy). Rule 3 (blocking: missing referenced query)."
  - "FinanceSummaryCard self-fetches (workspace_id prop) rather than taking a pre-resolved row prop, so the page stays a thin async server component that just resolves the workspace and stacks three independently-loading client sections."
  - "Mark-sent confirm captures a reference via an inline text input (not a modal), matching the UI-SPEC inline-confirmation contract and the RegistryTable precedent."
metrics:
  duration: 18 min
  tasks: 2
  files: 6
  completed: 2026-06-23
requirements: [RCN-01, RCN-02]
---

# Phase 27 Plan 04: Finance Dashboard UI Summary

Replaced the `/finance` placeholder in `apps/dispatch-control` with the approved 27-UI-SPEC finance view: a **FinanceSummaryCard** ("This Issue" gross / Stripe fees / net-to-charity — the primary anchor), an **IssueRevenueTable** (9-column per-issue reconciliation + an Unattributed-orders fallback bucket + inline mark-sent payout action), and a read-only **ModelPricingCard** (Projection Pricing with a 30-day amber staleness badge). All figures are computed from actual `stripeOrders` via `finance:perIssueRevenue` — never from `model_pricing` (D-08). dispatch-control `next build` passes clean.

## What Was Built

**Convex read queries (blocking deviation).** Added `finance:publishedIssues` (derives the published-issue list — issueNumber/issueId/charitySlug/charityName/publishedAt — from the `payouts` table joined with the earliest `stripeOrders.createdAt` per charitySlug, so dispatch-control feeds `perIssueRevenue` without a Sanity client) and `finance:listModelPricing` (read-only `model_pricing` rows for the staleness card).

**Task 1 — FinanceSummaryCard + ModelPricingCard.** FinanceSummaryCard self-fetches `publishedIssues → perIssueRevenue`, picks the latest issue window (highest issueNumber), and renders three stat cells (`Gross sales` / `Stripe fees` / `Net to charity`) at `text-xl font-semibold tabular-nums` — fees show `—` when `feeCents` is null; skeleton + no-orders empty state included; no `text-2xl`. ModelPricingCard renders the `Projection Pricing` table (model / input $/1K / output $/1K / last updated) with the projection sub-label and an amber `role="alert"` staleness badge (`bg-amber-50 border border-amber-200 text-amber-800`) when any row's `updatedAt` exceeds the `30 * 24 * 60 * 60 * 1000` threshold.

**Task 2 — IssueRevenueTable + PayoutRow + page assembly.** IssueRevenueTable chains `publishedIssues → perIssueRevenue({issues})` + `payouts:listByWorkspace`, rendering all 9 columns (currency cells `text-sm tabular-nums text-neutral-900`, `—` for unresolved fees, `{date} — ongoing` for the latest open window), the `Unattributed orders` fallback row, and the no-issues empty state. PayoutRow renders the Pending (yellow) / Sent (green) badge and the action cell: a `Mark sent` primary button (`bg-neutral-900 text-white`) that replaces itself **inline** (no modal) with the audit-log confirm prompt + a reference input + `Mark as sent` / `Keep pending`; confirm calls `payouts:markPayoutSent` (Clerk auth supplied by `ConvexProviderWithClerk`) and the Convex subscription flips the row to `Sent {Mon DD, YYYY}` with no reload. `page.tsx` resolves the workspace and stacks the three sections with `space-y-4` under the `Finance` h1. All interactive elements carry `min-h-[44px] min-w-[44px]` + `focus-visible:ring-2`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added finance:publishedIssues + finance:listModelPricing queries**
- **Found during:** Pre-task wiring (both tasks depend on them)
- **Issue:** The plan/UI-SPEC wire ModelPricingCard to "the existing pricing query" and IssueRevenueTable to `perIssueRevenue` — but no Convex query exposed `model_pricing` rows, and `perIssueRevenue` requires a Sanity-sourced `issues` array that dispatch-control (no Sanity client) had no way to supply.
- **Fix:** Added `publishedIssues` (Convex-derived issue list from `payouts` + earliest `stripeOrders.createdAt` per charitySlug) and `listModelPricing` (read-only `model_pricing` rows) to `convex/finance.ts`; ran `convex codegen`. `publishedIssues` is an approximation of the canonical Sanity list — accurate for gross/net/payout reconciliation (what the view audits); the exact Sanity publish timestamp / charityName can be threaded in once dispatch-control reads Sanity directly.
- **Files modified:** convex/finance.ts
- **Commit:** c6570a4

**2. [Deviation] FinanceSummaryCard takes workspace_id and self-fetches**
- **Found during:** Task 2 (page assembly)
- **Issue:** The plan sketched FinanceSummaryCard as taking a pre-resolved `row` prop, but the page is an async server component and the data is client-side (Convex subscriptions).
- **Fix:** FinanceSummaryCard accepts `workspace_id`, self-fetches `publishedIssues → perIssueRevenue`, and derives the latest-issue row internally — keeping the page a thin server component with three independently-loading client sections (no full-page spinner). `formatCents` + `IssueRevenueRow` are still exported for reuse by IssueRevenueTable.
- **Files modified:** FinanceSummaryCard.tsx
- **Commit:** 14267ae / 0c97b23

## Authentication Gates

None. The `payouts:markPayoutSent` Clerk-JWT guard is satisfied transparently by `ConvexProviderWithClerk` — no manual `getToken()` plumbing required in the UI.

## Verification

- `cd apps/dispatch-control && next build` → exit 0; `/finance` route compiled (ƒ dynamic, 2.92 kB).
- `tsc --noEmit` filtered to finance files → no errors (pre-existing `__tests__/*` strictness errors are out of scope per the scope boundary).
- Task 1 + Task 2 acceptance greps pass: `This Issue`, `Projection Pricing`, `bg-amber-50`, `30 * 24 * 60 * 60 * 1000`, `perIssueRevenue`, `markPayoutSent`, `Unattributed orders`, `Keep pending`, both payout badge color pairs, `min-h-[44px]`, no Dialog/Modal import, placeholder text gone.
- Manual verify (VALIDATION 27-04-02): click Mark sent → confirm → green Sent badge + audit row in Convex dashboard; fee column resolves from `—` once `STRIPE_SECRET_KEY` is set — deferred to operator.

## Known Stubs

None that block the plan goal. One documented approximation: `finance:publishedIssues` uses the earliest order's `createdAt` per charitySlug as the `publishedAt` window-start proxy and falls back `charityName = charitySlug` (no name source in Convex). Reconciliation totals (gross/net/payout) are exact; only the displayed window-start date / charity display name are approximate until dispatch-control reads the canonical Sanity issue list (a future enhancement, not required by RCN-01/RCN-02).

## Self-Check: PASSED

Files verified present: page.tsx, FinanceSummaryCard.tsx, IssueRevenueTable.tsx, ModelPricingCard.tsx, PayoutRow.tsx, convex/finance.ts.
Commits verified on branch: c6570a4 (convex queries), 14267ae (cards), 0c97b23 (table + page).
