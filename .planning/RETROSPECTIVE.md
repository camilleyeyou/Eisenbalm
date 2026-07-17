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

## Milestone: v4.0 — Dispatch Control v3 (The Editorial Workspace)

**Shipped:** 2026-07-17
**Phases:** 11 (40–50) | **Plans:** 92 | **Commits:** ~406 (window since 2026-07-14) | **Diff:** ~556 files (+79,142 / −1,747)

### What Was Built
- The console inverted from run-keyed to **issue-keyed**: an Issues home, then one **Issue Workspace** (stage tabs 1–5, persistent outline, collapsible context panel) that recomposed the shipped galley / voice-pass / decision-rail endpoints into Stages 2/4/5 — three nav items collapsed into one, no capability lost.
- The only genuinely new stage, **Fact Check** (Stage 3): Researcher-emitted claim `importance`, an affirmative coverage summary ("blank never means verified"), a filterable claim table, and a provenance card reused across Draft/Approval/inspector.
- Cross-cutting workspace mechanics: **My Tasks** as a *derived projection* (not a table), a console-wide **Decision log**, a universal **7-tab inspector** (headline: the missing-expected-input diff), and **agent revision** as a passage-level editing verb with direction chips + a claim-delta comparison card.
- A self-contained pipeline change (**18→20 nodes**: Signal Editor + `verify_candidates`), **Stage 1 Story & Brief** on real leads + verification records, a real second entry point (**Start from my brief**), **Roles & permissions** (six server-enforced gated actions, self-explaining locked controls), and the milestone-closing **Workbench rename + nomenclature pass** (display-copy only, with a failed-run recovery rail + "why this draft exists" bridge).

### What Worked
- **Contract-first held again.** Every schema/endpoint touch amended `docs/API_CONTRACTS.md` first — Phase 50's `prompt_versions.originRef` (§4A.2c) and Publisher-restart bridge (§50.1) were both documented in a separate earlier commit before code, and the Convex change was live-synced via `dev:once`. Zero schema drift across the 27-table Convex surface.
- **The plan-checker earned its keep.** On Phase 50 it caught two real pre-execution defects a human sweep would likely have missed: a replacement string ("quality-test **gate**") that still contained a banned word and would have failed the phase's *own* tripwire, and three live nomenclature-table rows ("Coverage memory", "never seeded", "blocking") absent from the banned set. Both fixed in one revision iteration.
- **Research grounded the plan in reality.** Phase 50's research overturned two planning assumptions before they cost anything: the frontend `pipelineTopology.ts` was silently stale (18 nodes, a load-bearing prerequisite), and "Restart from this step" only had a real reuse primitive for 3 of 11 step-types — which turned into an honest per-step availability matrix (`restartAvailabilityFor`) instead of a false blanket claim.
- **Source-scan tripwires as durable invariants.** The nomenclature and rename-preservation tripwires don't just pass once — they *stay* in the suite, so a future re-introduction of "gate"/"blocklisted" or a route/enum rename fails loudly. Same discipline as v3.0's EDT-05/FORBIDDEN_BYPASS.
- **Single-source-of-truth modules beat scattered literals.** `lib/nomenclature.ts` (labels, the §7 `RUN_STEP_MAP`, `GATE_KEYS`-derived diamonds, the restart matrix) is consumed by nav, Run Details, the recovery rail, and the inspector — the diamond set is derived once, never hand-typed twice.

### What Was Inefficient
- **The multi-milestone ROADMAP.md is a persistent tooling trap.** Across this session, `init phase-op`, `roadmap get-phase`, `phase complete`, `roadmap analyze`, AND `milestone complete` all misreported on the v4.0 (Phases 40–50) section — `roadmap analyze` sees only the v2.0 milestone. Every phase op required reading the `### Phase N:` block directly, and the milestone archival had to be done **entirely by hand** because the CLI would have mis-sliced or corrupted the ROADMAP. This is real drag and should be fixed before v5.0.
- **Rename churn produced recurring test-fixture deviations.** Nearly every Phase 50 plan hit a Rule-1 deviation where a pre-existing test pinned the old copy/topology (calibrator→scout, "node"→"step", Masthead auto-publish string). Correct to fix, but a signal that display-string assertions are brittle against a rename sweep.
- **STATE.md metrics are still not instrumented** — the same gap v3.0 flagged. The velocity table remains uncaptured, and the milestone frontmatter had drifted to a stale `v2.0` label (fixed during archival).

### Patterns Established
- **Sequential-in-main execution as the deliberate anti-strand mode.** Rather than parallel worktree executors (which strand code on per-agent branches — the standing v3.0 lesson), all 7 Phase-50 plans ran one-at-a-time committing directly to master in wave order. Slower, but zero reconciliation risk in an autonomous chain. This is the right default for this repo until the worktree-strand problem is solved.
- **Display-copy rename with a preservation tripwire.** Rename what the operator reads; keep routes, stored enums (`charities.status='blocklisted'`), node ids, and audit actions frozen — and prove it with an active `rename-preservation.test.ts`, not a one-time grep.
- **Wave-0 prerequisite plan** for cross-cutting phases: fix the load-bearing substrate (stale topology) + author the tripwire scaffolds *before* the feature waves that turn them green.
- **Honest per-capability affordances.** When only 3 of 11 restart paths are backed, the UI offers real reuse for those 3 and reserves-with-explanation for the other 8 — the "nothing silent / blank never means done" house rule applied to a control's own honesty.

### Key Lessons
1. **Fix the multi-milestone ROADMAP tooling before the next milestone.** The `## vX.Y Phase Details` layout defeats the GSD CLI's single-milestone parser; either split ROADMAP per milestone or teach the CLI the headings. Until then, every phase/milestone op on 40+ needs manual verification.
2. **A stale "constant" is more dangerous than a missing one.** `pipelineTopology.ts` passed its own test while being wrong by two nodes; only research cross-checking it against `graph/builder.py` caught it. Pin derived constants to their source, and prefer deriving over duplicating.
3. **Let the plan-checker gate copy-sweeps.** For a nomenclature phase, the checker verifying that *replacement* strings don't reintroduce banned words — and that the banned set covers every live table row — is worth a full revision cycle.
4. **Sequential-in-main is the safe autonomous default here** until parallel-worktree strand reconciliation is automated.

### Cost Observations
- Model mix / session count / token spend: **still not instrumented** (STATE.md metrics gap unchanged from v3.0 — now two milestones running).
- Zero new npm dependencies. Phase 50 was a pure copy/reconciliation phase; the only schema addition was one additive optional Convex field (`prompt_versions.originRef`).
- Milestone intentionally **not git-tagged** (owner's choice); archived to `milestones/v4.0-*.md` with the master ROADMAP/REQUIREMENTS preserved (snapshot-plus-master pattern).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v2.0 Mission Control | 21–29 (9) | — | Stood up `dispatch-control` (Clerk + Convex), config externalized to Convex, review gate + registry |
| v3.0 Dispatch Control v2 | 30–39 (10) | 62 | Dashboard becomes the full editorial surface; Sanity → pass-through; contract-first + parallel tracks + append-only audit tables |
| v4.0 Dispatch Control v3 | 40–50 (11) | 92 | Console becomes issue-centric (one Workspace, derived My Tasks, universal inspector); pipeline 18→20 nodes; roles; nomenclature + Workbench rename; sequential-in-main execution to dodge worktree strand |

### Cumulative Quality (v4.0 close)

| Suite | Passing |
|-------|---------|
| pipeline pytest | 698 |
| dispatch-control vitest | 1024 |
| Requirements checked (cumulative) | 296/296 (v3.0 234 + v4.0 62) |

### Top Lessons (Verified Across Milestones)

1. Contract-first amendment of `docs/API_CONTRACTS.md` before code — verified valuable across v2.0 and v3.0.
2. Strict production build (not just vitest) gates a "done" frontend phase — verified by Phase 27 latent-bug escape and applied throughout v3.0.
3. GSD parallel-worktree runs strand code on per-agent branches while bookkeeping leaks to master — reconcile/cherry-pick before the next wave (operational lesson to watch in future parallel phases). **v4.0 acted on this: ran sequential-in-main, zero strand.**
4. The multi-milestone `## vX.Y Phase Details` ROADMAP layout defeats the GSD CLI's single-milestone parser (`roadmap analyze`/`get-phase`/`phase complete`/`milestone complete` all misreport on Phases 40+) — verified across v3.0→v4.0; needs a tooling fix (per-milestone ROADMAP split or a multi-heading-aware parser) before v5.0.
