# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v3.0 — Dispatch Control v2 (Editorial Operator Console)

**Shipped:** 2026-07-10
**Phases:** 10 (30–39) | **Plans:** 62 | **Commits:** 335 | **Diff:** 467 files (+59,480 / −2,833)

### What Was Built
- A dashboard-native Review Desk: `@portabletext/react` galley with an inline span-resolver overlaying live QA findings, replacing the preview iframe (kept as a one-cycle fallback).
- A scoped content-patch write boundary — every console mutation goes dashboard → pipeline API → Sanity, audited, with a source-scan proving zero direct Sanity writes.
- A server-enforced two-sign-off publish gate ("Facts cleared" + "Sounds human") with webhook re-validation that closed the Studio status-flip bypass.
- End-to-end provenance (index-bound per-claim `{claim, sourceUrl, retrievedAt}` surviving into prose), a Voice Pass de-slop screen, a forensic Run Monitor v2 + Signal Desk, Prompt Lab evals + Eval Center, and the Registry coverage-memory strip.

### What Worked
- **Contract-first discipline held.** Every cross-boundary phase amended `docs/API_CONTRACTS.md` (§31/§33/§34/§35/§38) BEFORE producer/consumer code. This is the CLAUDE.md hard rule and it prevented schema drift across a 24-table Convex surface + Sanity + pipeline.
- **Parallel tracks paid off.** Phases 37 (Run Monitor v2 + Signal Desk) and 38 (Prompt Lab Evals) were built over existing backend substrate with no schema dependency on the Review Desk track (30–36), compressing a 10-phase milestone into ~5 calendar days.
- **The write-boundary decision was strategic, not just tidy.** Forcing all mutations through the pipeline API is what makes the deferred full-Sanity-removal a contained adapter swap rather than a rewrite.
- **Wave-0 RED test scaffolds** (author failing tests first, then turn green) gave each phase an objective completion signal.

### What Was Inefficient
- **Gap-closure plans recurred** (31-06, 34-07). Plan-review caught real blockers pre-execution (e.g. a wrong `groq_query` signature, an unregistered prompt variable in Phase 39), but some completeness gaps (draft-read fields, a broken test mock) still slipped to follow-up plans instead of landing in the original.
- **STATE.md performance metrics are stale/garbled** — the velocity table reads 0 plans / "—" while 62 shipped. The metrics instrumentation isn't tracking real durations.
- **Human/visual UAT backlog accumulates.** Many phases close with `*-HUMAN-UAT.md` items at `status: partial` (galley fidelity, live iframe-fallback, repeat-charity corrections reuse). These are real verification debt surfaced only via `/gsd:audit-uat`.

### Patterns Established
- **§-amendment contract gate** as Wave-0 of any cross-boundary phase.
- **Append-only Convex tables** for audit-shaped data (`eval_scores`, `charity_corrections`, `sign_offs`) — record/list only, no update/patch/remove, proven by convex-test asserting auth-throw + audit + ordering.
- **Server-side joins where dispatch-control has no Sanity access** (Phase 39 coverage strip: Convex recent-featured × one Sanity GROQ, mapped to an already-persisted field rather than a fabricated taxonomy).
- **Reuse existing detectors/keys, don't reimplement** — Voice Pass reuses `agents/qa/rules.py` + Opus judge; Researcher reuses `make_dedup_key()` to avoid silent key drift.

### Key Lessons
1. **Run the strict production build before declaring a frontend phase done.** vitest doesn't type-check; latent bugs surface only on Vercel/Linux (carried lesson from Phase 27). Applies to every dispatch-control phase.
2. **Contract-first is the cheapest insurance** on a multi-datastore system — the amendment step caught shape mismatches before they became runtime bugs.
3. **Fold completeness into the original plan.** Recurring gap-closure plans suggest plan-check should push harder on draft-read completeness and test-mock fidelity up front.

### Cost Observations
- Model mix / session count / token spend: **not instrumented this milestone** (metrics table in STATE.md is not capturing real values — a process gap to close before the next milestone).
- Zero new npm dependencies added across the Review Desk work beyond the deliberate `@portabletext/react` (Phase 32).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v2.0 Mission Control | 21–29 (9) | — | Stood up `dispatch-control` (Clerk + Convex), config externalized to Convex, review gate + registry |
| v3.0 Dispatch Control v2 | 30–39 (10) | 62 | Dashboard becomes the full editorial surface; Sanity → pass-through; contract-first + parallel tracks + append-only audit tables |

### Cumulative Quality (v3.0 close)

| Suite | Passing |
|-------|---------|
| pipeline pytest | 519 |
| dispatch-control vitest | 510 |
| Requirements checked (cumulative) | 234/234 |

### Top Lessons (Verified Across Milestones)

1. Contract-first amendment of `docs/API_CONTRACTS.md` before code — verified valuable across v2.0 and v3.0.
2. Strict production build (not just vitest) gates a "done" frontend phase — verified by Phase 27 latent-bug escape and applied throughout v3.0.
3. GSD parallel-worktree runs strand code on per-agent branches while bookkeeping leaks to master — reconcile/cherry-pick before the next wave (operational lesson to watch in future parallel phases).
