# Milestones

## v2.0 Mission Control Dashboard — Complete (2026-07-04)

**Goal:** A single-tenant, review-gated no-code control plane that lets a non-coder run, watch, cost, and govern the Eisenbalm Dispatch agent pipeline — built with multi-tenant bones so it can later become a standalone product.

**Phases:** 21–29 (auth + app shell + Convex schema, config externalization, node wrappers + read-only dashboard, prompt editor + versioning, run control, review gate + charity registry, money + notifications, prompt console, deployment hardening). Phases 1–20 built the public site, pipeline, commerce, and email lifecycle (pre-milestone-tracking; recorded in PROJECT.md Evolution notes).

**Shipped:** `apps/dispatch-control` (Next.js + Clerk + Convex) with runs dashboard, per-node forensics (`agent_runs`/`agent_run_payloads`), prompt versioning read by the pipeline at run start, test-run + voice scoring, run control (trigger/cancel/re-roll/kill switch), review gate (`awaiting-review` → approve/schedule/reject with server-enforced claims signoff), charity registry with dedup, Stripe reconciliation + payouts, notifications (email/Slack), budget caps, audit log.

---

## v3.0 Dispatch Control v2 — Editorial Operator Console — Complete (2026-07-10)

**Goal:** Rebuild `apps/dispatch-control` into the complete editorial surface (committed 1c "bold anti-SaaS magazine" design), so Andrew reviews, edits, de-slops, and publishes an entire weekly issue from the dashboard — Sanity reduced to a pass-through datastore, Studio retired to a read-only fallback.

**Phases:** 30–39 (design-system + chrome foundation, content-patch write boundary + full editing, native galley + span-resolver, accept-fix + decision rail, two-sign-off publish gate + Studio bypass retirement, provenance pipeline + sourced/unsourced galley, Voice Pass de-slop screen, Run Monitor v2 + Signal Desk, Prompt Lab evals + Eval Center, Registry coverage-memory strip).

**Stats:** 10 phases · 62 plans · 2026-07-06 → 2026-07-10 (5 days) · 335 commits · 467 files changed (+59,480 / −2,833). Requirements: 234/234 checked (all v3.0 blocks CHR/GLY/EDT/PUB/VOX/PRV/MON/SIG/EVL/MEM complete).

**Shipped:**
- **Native Review Desk** — the preview iframe replaced by a `@portabletext/react` galley rendering the Sanity draft with existing QA findings resolved inline as severity-colored span annotations (`quotedSpan` text-match + `blockIndexHint`); unresolved findings are visibly marked, never dropped (Phases 32–33).
- **Scoped write boundary** — every console content mutation (per-section prose, structured fields, asset uploads) flows through a pipeline-API patch to Sanity; an EDT-05 source-scan proves zero direct Sanity writes from the dashboard, and each mutation logs to `audit_log` (Phase 31).
- **Two-sign-off publish gate + Studio bypass retirement** — publishing requires server-enforced "Facts cleared" + "Sounds human" sign-offs; the publish webhook re-validates sign-off state before running the publisher, closing the Studio status-flip bypass; Studio flagged to read-only (Phase 34).
- **End-to-end provenance** — the Researcher emits per-claim `{claim, sourceUrl, retrievedAt}` bindings that survive into writer prose via index-bound claim IDs; the galley renders sourced (marigold) vs. unsourced (rust) claims and the claims sign-off is upgraded to source-bound (Phase 35).
- **Voice Pass de-slop screen** — a dedicated machine-tell screen reusing the two-layer QA detector (deterministic `agents/qa/rules.py` + Opus judge), as-written vs. house-voice rewrite popovers, and its own "Sounds human" sign-off feeding the publish gate (Phase 36).
- **Forensic Run Monitor v2 + Signal Desk** — run rendered as a vertical spine (agents as dots, code gates as marigold diamonds) with a handoff inspector, per-writer strength scores, run-vs-last-8 drift strip, and Gate 1 candidate-slate adjudication that resumes via `POST /run/{id}/resume` (Phase 37).
- **Prompt Lab evals + Eval Center + Registry memory** — golden-scenario eval drawer with a commit gate (target-up/no-regression + logged override) and an append-only Eval Center drift scoreboard + shadow runs (Phase 38); a Registry coverage-memory strip (last-8 cause/geo/signal) and an append-only charity-corrections log the Researcher re-reads on any future mention (Phase 39).
- **Foundation** — 1c design tokens/fonts on every screen, a persistent masthead (issue/state/spend/lock chips), workflow-ordered nav + How-to-use screen, a cross-screen Awaiting-you inbox, and the production `NEXT_PUBLIC_PIPELINE_URL` fix (Phase 30).

Archived: `milestones/v3.0-ROADMAP.md` (full phase details), `milestones/v3.0-REQUIREMENTS.md` (frozen requirements snapshot). Tag: `v3.0`.

**Deferred:** Studio deletion + full Sanity-removal follow-up milestone (gated on real weekly cycles); Signal Editor agent + REAL/OBSCURE/SPECIFIC/TELLABLE gates; Suno + NotebookLM API automation (V3-DEF-05). Open human/visual UAT items persisted per phase in `*-HUMAN-UAT.md` / `*-VERIFICATION.md`.
