# Milestones

## v2.0 Mission Control Dashboard — Complete (2026-07-04)

**Goal:** A single-tenant, review-gated no-code control plane that lets a non-coder run, watch, cost, and govern the Eisenbalm Dispatch agent pipeline — built with multi-tenant bones so it can later become a standalone product.

**Phases:** 21–29 (auth + app shell + Convex schema, config externalization, node wrappers + read-only dashboard, prompt editor + versioning, run control, review gate + charity registry, money + notifications, prompt console, deployment hardening). Phases 1–20 built the public site, pipeline, commerce, and email lifecycle (pre-milestone-tracking; recorded in PROJECT.md Evolution notes).

**Shipped:** `apps/dispatch-control` (Next.js + Clerk + Convex) with runs dashboard, per-node forensics (`agent_runs`/`agent_run_payloads`), prompt versioning read by the pipeline at run start, test-run + voice scoring, run control (trigger/cancel/re-roll/kill switch), review gate (`awaiting-review` → approve/schedule/reject with server-enforced claims signoff), charity registry with dedup, Stripe reconciliation + payouts, notifications (email/Slack), budget caps, audit log.

---

## v3.0 Dispatch Control v2 — Editorial Operator Console — In progress (started 2026-07-06)

See PROJECT.md Current Milestone.
