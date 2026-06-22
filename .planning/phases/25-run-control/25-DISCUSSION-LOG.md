# Phase 25: Run Control - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 25-run-control
**Areas discussed:** Cancel behavior, Re-roll blast radius, Budget + alerts, Scheduler timing

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel behavior | Partial-state + fan-out handling on cancel | ✓ |
| Re-roll blast radius | Which agents, when allowed, downstream invalidation | ✓ |
| Budget + alerts | Start-gate, mid-run breach, alert boundary vs Phase 27 | ✓ |
| Scheduler timing | DB-cadence vs Railway-fixed, timezone, concurrency | ✓ |

**User's choice:** All four areas.

---

## Cancel behavior

### Q: On cancel, what happens to the partial Sanity draft + run state?

| Option | Description | Selected |
|--------|-------------|----------|
| Mark cancelled, leave partials | Status=cancelled, stop cleanly, leave partials untouched | ✓ |
| Mark cancelled + clean up draft | Also delete/blank the partial Sanity draft | |
| Mark cancelled + tombstone note | Leave partials but write a visible marker | |

**User's choice:** Mark cancelled, leave partials (recommended). → D-01

### Q: How should cancel handle a fan-out (7 concurrent section writers) in progress?

| Option | Description | Selected |
|--------|-------------|----------|
| Let in-flight nodes finish, block the rest | In-flight nodes complete; flag stops advancing/new nodes | ✓ |
| Hard-cancel the asyncio task immediately | Kill background task + in-flight LLM calls at once | |

**User's choice:** Let in-flight nodes finish, block the rest (recommended). → D-02

---

## Re-roll blast radius

### Q: Which agents/nodes should be re-rollable this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Section writers only | 7 content nodes; smallest blast radius | ✓ |
| Section writers + QA/editor_final | Add post-content nodes | |
| Any node | Allow upstream re-rolls (scout/researcher/chronicler) | |

**User's choice:** Section writers only (recommended). → D-03

### Q: When is re-roll allowed relative to run state?

| Option | Description | Selected |
|--------|-------------|----------|
| Only on a finished/awaiting-review run | Operates on a completed run's checkpoint | ✓ |
| Anytime including mid-run | Allow re-roll while executing | |

**User's choice:** Only on a finished/awaiting-review run (recommended). → D-04

### Q: On a section re-roll, what happens to the other sections?

| Option | Description | Selected |
|--------|-------------|----------|
| Isolated — only that section regenerates | Re-run target node, siblings untouched | ✓ |
| Re-run target + dependent downstream nodes | Also re-run QA/editor_final | |

**User's choice:** Isolated — only that section regenerates (recommended). → D-05

---

## Budget + alerts

### Q: How is a run gated against the monthly cap before it starts?

| Option | Description | Selected |
|--------|-------------|----------|
| Trailing-average projection, refuse if it'd exceed | Project from recent real run costs | ✓ |
| Fixed per-run estimate constant | Single configured expected-cost number | |
| Only block when already over cap | No projection; block only once over | |

**User's choice:** Trailing-average projection (recommended). → D-06

### Q: What happens when cost crosses a cap mid-run?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-run cap hard-stops; monthly = alert only | Keep cost.py hard-stop; monthly alerts | ✓ |
| Both caps hard-stop | Auto-cancel on either breach | |
| Alert only, never auto-stop | Never auto-cancel | |

**User's choice:** Per-run cap hard-stops; monthly alert only (recommended). → D-07

### Q: Alert boundary vs Phase 27 (Notifications)?

| Option | Description | Selected |
|--------|-------------|----------|
| Emit alert event + dashboard; defer transport to 27 | Convex event + dashboard now, Slack/email later | ✓ |
| Wire a minimal email/Slack alert now | Real channel in Phase 25 | |

**User's choice:** Emit alert event + dashboard surface; defer transport to Phase 27 (recommended). → D-09

---

## Scheduler timing

### Q: How much should the dashboard cadence control timing (Railway cron not API-reconfigurable)?

| Option | Description | Selected |
|--------|-------------|----------|
| DB cadence drives it; Railway ticks often | Tick checks schedule_enabled + cadence, fires when due | ✓ |
| Railway fixed-weekly; cadence display-only | Keep 0 14 * * 4; cadence is just UI | |

**User's choice:** DB cadence drives it; Railway ticks often (recommended). → D-10

### Q: How is the next scheduled run displayed?

| Option | Description | Selected |
|--------|-------------|----------|
| Operator local tz, with UTC alongside | e.g. "Thu 2:00 PM PDT (21:00 UTC)" | ✓ |
| UTC only | Single UTC display | |

**User's choice:** Operator local tz with UTC alongside (recommended). → D-11

### Q: Concurrency guard when a run is already active?

| Option | Description | Selected |
|--------|-------------|----------|
| One run at a time — reject if active | 409/no-op if a run is running | ✓ |
| Allow concurrent runs | Permit multiple in-flight runs | |

**User's choice:** One run at a time — reject if active (recommended). → D-12

---

## Claude's Discretion

- Endpoint names/shapes (amend API_CONTRACTS.md first), cancel-flag mechanism,
  LangGraph re-roll mechanics, `triggered_by` plumbing, which actions emit audit
  rows, trailing-average window, cadence representation, all dashboard UI.

## Deferred Ideas

- Slack/email transport (Phase 27), review gate + charity registry (Phase 26),
  Stripe reconciliation / model_pricing staleness (Phase 27), upstream re-rolls /
  auto QA re-run, DB-driven per-agent enable toggle, graph-as-data (Phase 28),
  pending-trigger queue (rejected for block-with-explanation).
