# Phase 27: Money + Notifications - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning
**Mode:** Auto (`--auto`) — all gray areas auto-resolved with recommended defaults; review decisions below before planning.

<domain>
## Phase Boundary

This phase delivers two operator-facing capabilities, both read/observe-first (no new money movement):

1. **Financial reconciliation (RCN-01/02):** a dashboard finance view showing, per published issue, gross sales / Stripe fees / net-to-charity computed from **actual** recorded `stripeOrders` rows + the Stripe API (never from `model_pricing` estimates), plus per-issue payout tracking so the "100% of proceeds" promise is auditable. The existing `model_pricing` view is labeled projection-only with a 30-day staleness indicator.
2. **Operational notifications (NTF-01/02):** the operator receives a Slack and/or email notification within 5 minutes of a run completing, failing, entering `awaiting_review`, or crossing a budget threshold.

**Out of scope (new capabilities → other phases):** new payment/checkout flows, actually *executing* payouts (we only *track* status), sending the Phase 20 weekly newsletter, carrier/shipment tracking, editing model pricing rows, multi-currency normalization beyond display.
</domain>

<decisions>
## Implementation Decisions

### Notifications — transport & origin (NTF-01/02)
- **D-01:** Notifications originate **Convex-side**, not from the pipeline. The pipeline already writes run state to Convex (`runs:updateStatus`) and emits budget `cost-warning` deliberationEvents — so the notifier hangs off those existing writes. No new outbound HTTP egress is added to the Python pipeline.
- **D-02:** Reuse the Phase 20 email transport abstraction (`packages/emails` — `SendEmailProvider` / `selectProvider(env)` / `ResendProvider` / `FakeEmailProvider`) and the `convex/emailActions.ts` `internalAction` pattern (only `internalAction` may make external HTTP calls). Add a **Slack incoming-webhook provider** alongside the email provider behind the same selection seam. Do NOT fork a second email path.
- **D-03:** Both channels are independently toggleable; the system supports "Slack and/or email" — either, both, or (degenerate) neither.

### Notifications — triggers & timing
- **D-04:** Fire from the events that already exist, so latency is effectively instant (well within the 5-minute bar):
  - run **complete** / **failed** / **awaiting-review** → from `runs:updateStatus` (the status write the publisher/graph already performs).
  - **budget threshold** → from the existing `cost-warning` seam in `lib/cost.py` / `api/control.py` (frozen `deliberationEvents.eventType` union — reuse it, do not invent a new event type without an API_CONTRACTS amendment).
- **D-05:** Dispatch the external HTTP send via `scheduler.runAfter(0, internalAction)` (mirror Phase 20) so the triggering mutation stays non-blocking and a transport failure never wedges a run's status write.

### Notifications — config, routing & dedup
- **D-06:** Channel config lives in `pipeline_config` keys: `notify_email` (recipient), `notify_slack_webhook_url` (webhook secret), and per-event-type enable flags (e.g. `notify_on_complete`, `notify_on_failed`, `notify_on_awaiting_review`, `notify_on_budget`). `convex/pipelineConfig.ts:167` already marks this as the Phase 27 transport seam.
- **D-07:** Idempotent **notifications ledger** table keyed on `(runId or eventKey) + eventType + channel` so each event sends at most once per channel (mirror the `emailSends` idempotency pattern). Re-fires / retries are safe.

### Financial reconciliation — data source (RCN-01)
- **D-08:** Gross and net come from **recorded `stripeOrders` rows**: gross = `amountTotal`, net-to-charity = `donationAmount` (== `amountSubtotal`, the 100%-to-charity figure). Stripe **fees** come from the **Stripe API** (balance-transaction per `payment_intent`), fetched server-side and cached. Reconciliation is computed from actuals — **never** from `model_pricing`.
- **D-09:** Stripe access is **read-only** reconciliation against the Stripe API using the existing (test-mode) keys. No new payment flows, no live-key assumptions in build.

### Financial reconciliation — per-issue attribution (RCN-01)
- **D-10:** Attribute each order to an issue via `stripeOrders.charitySlug` + `createdAt` falling within that issue's **active sales window** (issue published → next issue published). The `weeklyIssue.charity` reference resolves the slug → issue. Surface a clear fallback bucket for orders that don't map to a window (e.g. pre-launch / between issues).

### Payout tracking (RCN-02)
- **D-11:** Add an **additive** Convex `payouts` table keyed by issue (issueNumber/issueId + charitySlug): `amount`, `status` (`pending` | `sent`), `sentAt`, `reference`, `actor`, timestamps. Operator marks a payout **sent** with date + reference from the finance view. Dashboard shows payout status across **all** issues at a glance.
- **D-12:** Payout mutations are Clerk-JWT-guarded and **audit-logged** (reuse the AUD-01 `auditLog:write` pattern — actor, timestamp, before/after).

### model_pricing staleness view (success criterion 3)
- **D-13:** The finance view renders the existing `model_pricing` table **read-only**, labeled **"Projection pricing (not actual cost)"**, with a staleness badge when a row's `updatedAt` is older than **30 days**. Editing pricing rows is out of scope this phase.

### Contract & schema discipline (carried forward — non-negotiable)
- **D-14:** **Contract-first (CLAUDE.md hard rule):** amend `docs/API_CONTRACTS.md` with a new §27 (finance queries, payout table + mutations, notifications ledger, notification config keys, Slack provider shape) **before** touching schema or code. All Convex schema changes are **additive only** (new tables / optional fields — never rename existing fields; `stripeOrders`, `model_pricing`, `emailSends` shapes are frozen).
- **D-15:** Preserve the Phase 25 cost invariants: single-cost-writer rule and the once-snapshotted per-run budget cap remain untouched; the budget notification only *reads* the existing `cost-warning` signal.

### Claude's Discretion
- Exact finance-view layout/components in `dispatch-control` (the `finance/page.tsx` placeholder is ready to replace); Stripe-fee cache TTL + storage location; Slack message formatting/blocks vs plain text; whether the notifications ledger is its own table or folded into an existing events table (planner decides from the §27 contract); how the sales-window boundary handles the current (latest) issue with no "next" issue yet.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 27: Money + Notifications" — goal + 4 success criteria (the exact reconciliation/notification truths to satisfy)
- `.planning/REQUIREMENTS.md` — RCN-01, RCN-02, NTF-01, NTF-02 (and AUD-01 for the audit-log pattern reused by payout actions)

### Contracts (amend before code)
- `docs/API_CONTRACTS.md` — add §27 (finance queries, payouts table + mutations, notifications ledger + config keys, Slack provider) BEFORE schema/code per CLAUDE.md; line 2110 already names the "Phase 27 NTF hook"

### Reusable infrastructure (read to reuse, not re-derive)
- `packages/emails/src/provider.ts` — `SendEmailProvider` / `ResendProvider` / `FakeEmailProvider` / `selectProvider(env)` — extend with a Slack provider behind the same seam
- `convex/emailActions.ts` — `internalAction` send pattern + `scheduler.runAfter` dispatch + idempotency (the model for the notifier)
- `convex/emailSends.ts`, `convex/emailSubscribers.ts`, `convex/crons.ts`, `convex/emailFlow.ts` — Phase 20 ledger/idempotency/cron patterns to mirror for the notifications ledger
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` (`cost-warning` emission, monthly + per-run, dedup) and `packages/pipeline/src/eisenbalm_pipeline/api/control.py:332` — the budget-threshold signal NTF-02 consumes
- `convex/pipelineConfig.ts:167` — the marked Phase 27 transport seam + config-key home
- `convex/schema.ts` — `stripeOrders` (134), `model_pricing` (341), `emailSends`/`emailSubscribers`; additive home for `payouts` + notifications ledger
- `apps/dispatch-control/app/(dashboard)/finance/page.tsx` — placeholder finance view to replace
- `apps/studio/schemas/weeklyIssue.ts` — `issueNumber`, `slug` (`issue-{n}`), `charity` reference — basis for order→issue attribution

### Prior phase context (decisions that bind this phase)
- `.planning/phases/25-run-control/25-CONTEXT.md` — D-09: Slack/email alert transport explicitly deferred to Phase 27; budget alert is event-only in Phase 25
- `.planning/phases/26-review-gate-charity-registry/26-CONTEXT.md` — D-11: `auto_publish` enable emits the Convex event that is the Phase 27 notification hook; `awaiting-review` status semantics
- Phase 20 email lifecycle (`.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/`) — Resend/React-Email/Convex-scheduler architecture this phase's notifier reuses
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Email transport** (`packages/emails` + `convex/emailActions.ts`): provider-abstracted, idempotent, `internalAction`-based external send — directly extensible to Slack and to operational notifications.
- **Budget signal** (`lib/cost.py` `cost-warning` deliberationEvents, dedup'd one-per-run + monthly): NTF-02 trigger already exists as an event; only transport is missing.
- **Idempotency/cron patterns** (`emailSends`, `crons.ts`): template for the notifications ledger + any sweep.
- **`stripeOrders`**: rich recorded data (`amountTotal`, `amountSubtotal`, `amountShipping`, `donationAmount`, `charitySlug`, `currency`, `createdAt`) — gross/net without Stripe API; only **fees** require the API.
- **`model_pricing`** table + **`finance/page.tsx`** placeholder: scaffolding already present for the finance view.

### Established Patterns
- Convex `internalAction` for all external HTTP (Resend/Stripe/Slack); mutations stay pure and dispatch via `scheduler.runAfter`.
- Clerk-JWT-guarded dashboard mutations + `auditLog:write` (AUD-01) for any operator write — apply to payout actions.
- Contract-first additive schema changes (CLAUDE.md); frozen field names.

### Integration Points
- `runs:updateStatus` (run state writes) → notification trigger for complete/failed/awaiting-review.
- `cost-warning` event path → notification trigger for budget threshold.
- `pipeline_config` → notification channel config + enable flags.
- `dispatch-control` `finance` route → reconciliation + payout + pricing-staleness UI.
</code_context>

<specifics>
## Specific Ideas

- "100% of proceeds" auditability is the product-level reason RCN exists — net-to-charity must read from `donationAmount`/`amountSubtotal` (the 100% figure), with Stripe fees shown as the gap between gross charged and net donated.
- Notifications should be near-instant (event-driven), not polled — the 5-minute bar is a ceiling, not a target.
</specifics>

<deferred>
## Deferred Ideas

- **Executing payouts** (vs tracking status) — Phase 27 only records that a payout was sent; actual disbursement integration is a separate future capability.
- **Weekly newsletter send** (Phase 20 captured consent only) — out of scope here.
- **Carrier/shipment tracking** for delivery-anchored email timing — explicitly deferred in Phase 20.
- **Editing `model_pricing` rows** from the dashboard — Phase 27 view is read-only; pricing maintenance is its own future task.
- **Multi-currency normalization** beyond display of the recorded `currency`.

None of the above were folded into scope — discussion stayed within the RCN/NTF boundary.
</deferred>

---

*Phase: 27-money-notifications*
*Context gathered: 2026-06-23*
