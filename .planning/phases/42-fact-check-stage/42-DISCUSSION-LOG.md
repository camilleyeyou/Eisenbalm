# Phase 42: Fact Check Stage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 42-fact-check-stage
**Mode:** `--auto` (recommended defaults auto-selected; no interactive prompts)
**Areas discussed:** importance field · summary counters & severity · reused provenance card · claim filters · six claim actions & write boundaries · Ask-agent-for-better-evidence endpoint · revision→unchecked & changedCount

---

## `importance` field (FCT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| New optional `claim_checks.importance`, Researcher-emitted, publisher-joined via `claimId` | Additive optional field (mirrors Phase 35 provenance fields); LLM Researcher tags facts, publisher binds onto sourced rows; deterministic/legacy rows get a `Supporting` fallback | ✓ |
| Compute importance heuristically at extraction time (no LLM) | Cheaper, but the requirement explicitly says "the Researcher emits" and heuristics can't judge editorial load-bearingness | |
| Store importance only on sourced rows, leave unsourced blank | Breaks `mustFix = unsourced load-bearing` math and violates "blank never means verified" | |

**Auto-selected:** Option 1 (recommended). **Notes:** `mustFix = unsourced load-bearing` (DERIVED-STATE-CONTRACT §4) forces a resolvable importance on every row; fallback = `Supporting` so a deterministic unsourced number never fabricates a must-fix. Exact Researcher plumbing → phase-researcher.

## Summary counters & severity (FCT-02, FCT-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Pure derived selector (`deriveFactCheckSummary`) over `claim_checks`, §4 verbatim | No stored counters; one mutation propagates to all surfaces via Convex reactivity; mirrors `lib/derivedState.ts` | ✓ |
| Store counters on the run/issue record | Faster reads, but stale-state risk (the exact anti-pattern Phase 40 banned) and manual fan-out on every action | |

**Auto-selected:** Option 1. **Notes:** severity derived (`Must fix = importance==='Load-bearing' && !sourceUrl`). `conflictsCount`/`checksNotRunCount` get honest pragmatic derivations; never blank-as-verified.

## Reused provenance card (FCT-04)

| Option | Description | Selected |
|--------|-------------|----------|
| One shared `ClaimProvenanceCard`, consumed by Draft/Fact Check/Approval/inspector | FCT-04 names "the same component reused"; refactor SourceIndex/ClaimMark to feed it | ✓ |
| Three per-stage claim cards | Faster to write, but violates the FCT-04 "same component" requirement and diverges Phase 44 | |

**Auto-selected:** Option 1. **Notes:** only `importance` is a new stored field (§5); `sourcePublisher`/`agent`/`confidence`/`supportingPassage` derive.

## Claim filters (FCT-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side derived predicates over the loaded list | No new Convex queries; multi-select chips | ✓ |
| Server-side filtered Convex queries per filter | Unneeded round-trips for a bounded per-run list | |

**Auto-selected:** Option 1. **Notes:** people/title vs org and weak-source use documented heuristics (proper_noun split via org-suffix; weak = unsourced/low-authority); refinement deferred, no stored `claimType` subtype without contract amendment.

## Six claim actions & write boundaries (FCT-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Status-only → Convex operator mutations; content-touching → pipeline API + `audit_log` | Confirm/Keep are Convex `setStatus`; Edit/Replace/Remove go dashboard→pipeline→Sanity/Convex, EDT-05 boundary | ✓ |
| All six through the pipeline API | Uniform, but needless round-trips for pure status flips already served by `setStatus` | |
| All six as direct Convex/Sanity writes from the console | Violates EDT-05 + the `dispatch-control-no-sanity-write.test.ts` tripwire | |

**Auto-selected:** Option 1. **Notes:** no explicit cross-surface wiring — counters/My Tasks/readiness/header are derived; one mutation propagates.

## Ask-agent-for-better-evidence endpoint (FCT-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Two-step (preview → atomic apply) span-scoped endpoint, built to generalize | Step 1 returns replacement source + rewritten claim (no mutation); step 2 applies content-patch + claim-update atomically + decision-log; Phase 45 extends the SAME endpoint | ✓ |
| One-shot apply (no preview) | No comparison card; contradicts §5/§9 "comparison before apply" | |
| Build a second, separate endpoint in Phase 45 | Contract note forbids it — Phase 45 generalizes, does not duplicate | |

**Auto-selected:** Option 1. **Notes:** contract-first §42; EDT-05 boundary; decision-log = `audit_log` for now (Phase 43 formalizes).

## Revision → unchecked + changedCount (FCT-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `content.py` patch endpoints with `_reset_touched_claims`, new `changedSinceCheck` marker | Rides the existing sign-off-revocation hook point; block-level touched-counter via `sectionName`+`blockIndexHint`; increments even when replacement is sourced (§4) | ✓ |
| Console-side reset after each edit | Would miss Sanity edits made from other surfaces; wrong layer | |
| Re-run verification on touched blocks | §4 says block-level touched-counter, NOT re-verification | |

**Auto-selected:** Option 1. **Notes:** additive-optional `claim_checks.changedSinceCheck`; `changedCount` counts set rows; cleared on next check.

## Claude's Discretion (deferred to planning/research)
- Researcher `importance` prompt/schema + publisher `claimId`→importance join.
- `Supporting` fallback vs light load-bearing heuristic for unsourced deterministic claims.
- `conflictsCount`/`checksNotRunCount` predicates; whether `conflict` needs a stored field.
- people/title vs org and weak-source heuristics.
- Endpoint home (`api/factcheck.py` new vs extend `content.py`); FCT-06 request/apply split.
- What "Edit claim" splits between `claim_checks` and Sanity content.
- Provenance card file location + Draft/Approval refactor path.
- Copy for summary line, filter chips, zero states, comparison card.

## Deferred Ideas (out of scope — future phases)
- Generalizing the FCT-06 endpoint to arbitrary passage revision → Phase 45.
- The 7-tab "Inspect how this was made" panel → Phase 44.
- My Tasks screen + formal Decision Log component → Phase 43.
- Role/permission locked-control rendering → Phase 49.
- Console-wide nomenclature ripple → Phase 50.
- Stored person/org `claimType` subtype → deferred (heuristic-only in Phase 42).
