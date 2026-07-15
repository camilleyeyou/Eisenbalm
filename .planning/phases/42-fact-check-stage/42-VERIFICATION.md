---
phase: 42-fact-check-stage
plan: 08
gate: integration
verified: 2026-07-15T14:00:36Z
status: human_needed
score: 7/7 code-level must-haves verified (1 human-only live demo-leg outstanding)
human_verification:
  - test: "Live 8-step demo leg: My Tasks → Stage 3 Fact Check claim detail → Ask agent for better evidence → Confirm replacement → live counters/header/My-Tasks/Approval-readiness/publish-lock update without manual refresh; then the FCT-07 revision→unchecked/changed-since-check flip; then Draft galley popover ↔ Approval SourceIndex shared-card parity"
    expected: "Every step completes live with no manual refresh; the single Convex mutation propagates to counters, My Tasks, Approval readiness, and header/publish-lock simultaneously (D-16)"
    why_human: "End-to-end reactive-UI walkthrough across Convex + FastAPI pipeline + Sanity spanning four screens at once; the live cross-surface propagation guarantee can only be proven in a running browser session, which an autonomous pass cannot drive. Every unit/integration test underneath it is independently green."
---

# Phase 42 Verification

**Phase Goal (ROADMAP §Phase 42):** Stage 3 (Fact Check) goes live inside the Phase 41 Issue Workspace frame — the only genuinely new stage in the v4.0 milestone — built on the Phase 35 provenance substrate plus one new Researcher-emitted field (`importance`). It replaces the Phase 41 placeholder.

**Verdict:** All 7 automated gate checks green AND all 7 code-level requirement/success-criterion must-haves independently re-verified goal-backward against the actual codebase. The single remaining item is the live operator demo-leg (inherently human). Status: **human_needed**.

---

## Part A — Automated Integration Gate (Plan 42-08 Task 1)

**Gate:** full pipeline pytest, full console vitest, the no-Sanity-write tripwire, the strict dispatch-control build, the Convex typecheck, and the Convex dev-deployment sync. Re-executed live during this goal-backward verification pass (not merely read from the prior record) — all results matched exactly, no drift.

| # | Check | Command | Result | Status |
|---|-------|---------|--------|--------|
| 1 | Full pipeline pytest suite | `cd packages/pipeline && uv run pytest -x -q` | 578 passed, 36 skipped, 0 failed (14.34s). Targeted re-run this pass: `-k "factcheck or content_patch or researcher_importance or publisher_importance"` → 67 passed | ✅ PASS |
| 2 | Full console vitest suite | `pnpm --filter dispatch-control test:unit` | 86 files passed \| 1 skipped (87); 743 passed \| 2 todo (745) — re-run this pass, identical | ✅ PASS |
| 3 | no-Sanity-write tripwire (explicit, isolated run) | `npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts` | 1 file passed, 2/2 tests passed | ✅ PASS |
| 4 | Strict dispatch-control build | `pnpm --filter dispatch-control build` | Compiled successfully; `/issues/[issueNumber]/fact-check` route generated (4.28 kB); exit 0 — re-run this pass | ✅ PASS |
| 5 | Convex typecheck | `pnpm --filter @eisenbalm/convex typecheck` (`tsc --noEmit`) | Exit 0, no errors — re-run this pass | ✅ PASS |
| 6 | Convex dev-deployment sync | `pnpm --filter @eisenbalm/convex dev:once` | `✔ Convex functions ready! (5.7s)` against `dev:modest-magpie-797` | ✅ PASS (synced live) |
| 7 | Convex deploy-parity guard (memory-note tripwire, 260710-fxx) | `pnpm check:convex-parity` | `✓ 53 called functions all present on dev:modest-magpie-797 (124 deployed)` — re-run this pass | ✅ PASS |

**All 7 automated checks green.** The two project-memory tripwires this gate exists to close — "vitest doesn't type-check" (item 4) and "committing convex/*.ts ≠ deployed" (items 6-7) — are both explicitly exercised and both pass.

---

## Part B — Goal-Backward Verification (6 ROADMAP success criteria)

Each criterion checked against the ACTUAL code artifact that delivers it, not the SUMMARY claim.

| # | ROADMAP Success Criterion | Status | Delivering artifact + evidence |
|---|---------------------------|--------|-------------------------------|
| 1 | Researcher emits an `importance` tier (Load-bearing/Supporting/Incidental) on every claim | ✅ VERIFIED | `agents/researcher.py:64` `ClaimOutput.importance: Literal[...] = 'Supporting'`; `_map_claims()` threads it; `agents/publisher/__init__.py:159` sourced rows copy it via the `claimId`→`research_claims` lookup (Supporting fallback, never fabricated Load-bearing), line 172 stamps unsourced rows Supporting. `convex/claimChecks.ts::insertBatch` passes `importance` through. 12 pytest tests green. |
| 2 | Stage 3 affirmative summary (checked X of Y · must fix · conflicting sources · checks not run · changed since check · last verified); blank never means verified | ✅ VERIFIED | `lib/derivedState.ts:327` `deriveFactCheckSummary` returns all 7 fields unconditionally (even 0); `FactCheckScreen.tsx:370-388` renders every counter + explicit "not yet verified" / "Loading…" / "No claims extracted yet" — never a blank render. 45+5 tests green. |
| 3 | Operator filters by must fix / unchecked / changed / numbers & dates / people & titles / organization claims / weak source | ✅ VERIFIED | `lib/factCheckFilters.ts` `FACT_CHECK_FILTERS` = exactly these 7 predicates (reusing shared `isMustFix`; org/weak-source heuristics per D-13); `applyFilters` OR-union, excludes `removed`; `FactCheckScreen.tsx:394` renders all 7 as toggle chips. 19 tests green. |
| 4 | Selecting a claim opens a provenance card (9 fields) — the SAME component reused in Draft, Approval, inspector | ✅ VERIFIED | `components/provenance/ClaimProvenanceCard.tsx` renders all 9 §42.6 fields with never-blank fallbacks + all 6 actions + Open source + Inspect (Phase 44 entry point). Reused: Stage 3 (`FactCheckScreen.tsx`), Draft (`ClaimMark.tsx:200` popover body), Approval (`SourceIndex.tsx:153` via compact `ClaimProvenanceRow`, same helpers). `FactCheckPlaceholder.tsx` confirmed deleted. No fork found. |
| 5 | "Ask agent for better evidence" returns replacement source AND rewritten claim together; confirming applies both (content patch + claim update) + decision-log entry | ✅ VERIFIED | `api/factcheck.py` `evidence/preview` (read-only, returns `{sourceUrl, sourcePublisher, retrievedAt, rewrittenClaim}` via LLM index-selection — no hallucinated URL) + `evidence/apply` (atomic: `_patch_claim_prose` + `claimChecks:updateClaim` + reset-before-terminal + `signOffs:revokeAll` + one `auditLog:record` `claim_evidence_applied`). `test_evidence_apply_happy_path...` asserts the exact CONTEXT demo scenario ("outpaces supply four to one" → "…installations roughly four to one" + Post & Courier). `FactCheckScreen.tsx` renders §9-style comparison card wired to `evidenceApply` with fresh `ifRevisionID`. |
| 6 | A revision touching a claim's block returns it to unchecked + increments "changed since check", even when the replacement text is itself sourced | ✅ VERIFIED | `api/content.py:160` `_touched_block_indices` + `:180` `_reset_touched_claims` (calls `claimChecks:markChanged` unconditionally — no check on whether NEW text is sourced), wired into `patch_section` (352-353) and `patch_bonus` specAd (639-640). `markChanged` sets `status:'pending'` + `changedSinceCheck:true`; `deriveFactCheckSummary.changedCount` counts it; `setStatus`/`keepAsWritten` clear it on next check. 9 pytest cases green incl. bigBudget-never-resets regression. |

---

## Part C — Requirement Coverage (FCT-01 … FCT-07)

Every FCT ID in `.planning/REQUIREMENTS.md`'s "Fact Check Stage (FCT)" section is claimed by ≥1 plan's `requirements:` frontmatter and traces to tested code. No orphaned requirements.

| Req | Source plan(s) | Status | Evidence |
|-----|----------------|--------|----------|
| FCT-01 | 42-01, 42-02 | ✅ VERIFIED | Researcher `importance` field + publisher merge (Part B #1). |
| FCT-02 | 42-05, 42-06 | ✅ VERIFIED | `deriveFactCheckSummary` + Stage 3 render (Part B #2). |
| FCT-03 | 42-06 | ✅ VERIFIED | 7-filter `factCheckFilters.ts` + chips (Part B #3). |
| FCT-04 | 42-06, 42-07 | ✅ VERIFIED | ONE shared `ClaimProvenanceCard`, 3 real consumers, zero forks (Part B #4). |
| FCT-05 | 42-01, 42-04, 42-06 | ✅ VERIFIED (code); live cross-surface propagation is the human item | Six actions at correct write boundaries: Confirm→`claimChecks:setStatus` (dashboard); Edit/Replace-source/Remove/Keep/Ask-agent→`api/factcheck.py` (Clerk-guarded, each `_emit_audit`). Keep 422s on empty reason. All 4 downstream surfaces are pure selectors over one Convex source (D-16), so propagation is structural. 26 endpoint tests green. |
| FCT-06 | 42-01, 42-04, 42-06 | ✅ VERIFIED | `evidence/preview`+`apply` pair, atomic apply + audit row (Part B #5). |
| FCT-07 | 42-01, 42-03 | ✅ VERIFIED | `_reset_touched_claims` unconditional on new-text sourcing (Part B #6). |

**Key-link / write-boundary integrity:** `lib/factCheckClient.ts` has zero Sanity import (grep-confirmed); the 4 content-touching `claimChecks:*` mutations are all registered in `convex_client.py::_PIPELINE_SECRET_GUARDED_PATHS` (closing the "guarded Convex-side but unregistered Python-side" class of gap the SUMMARYs auto-fixed); `factcheck.router` mounted in `api/main.py:210`. Deploy-parity confirms all called Convex functions are LIVE on `dev:modest-magpie-797`, not merely committed.

**Data-flow (Level 4):** Stage 3 subscribes to FULL `claim_checks` rows via `useQuery(api.claimChecks.listByRunId)` (not the lean provider projection); Draft threads real `text`/`importance`/`context` through `Galley.tsx::resolveClaimsFor` (regression-guarded against silent-blank by `ClaimMark.test.tsx`); evidence preview flows from real Tavily search. No hollow props or hardcoded-empty data sources found.

**Anti-patterns:** Zero. `grep TODO|FIXME|XXX|HACK|PLACEHOLDER|not yet implemented|coming soon` across all Phase 42 net-new files returned no matches.

---

## Part D — Human Verification Required (the one outstanding item)

### 1. Live 8-step demo-leg UAT (Plan 42-08 Task 2 / DERIVED-STATE-CONTRACT §5 walkthrough)

Operator-driven, on a real/seeded issue run containing an unsourced Load-bearing claim (e.g. an "outpaces supply four to one"-style statistic):

1. My Tasks shows "Resolve an unsupported statistic" (Must fix) for that claim, and does NOT show a task for an unsourced Incidental claim.
2. Stage 3 Fact Check affirmative summary renders every counter — nothing blank.
3. The must-fix / numbers-and-dates / organization-claims filters each narrow the table correctly.
4. Selecting the claim opens the provenance card with all 9 fields, never blank.
5. "Ask agent for better evidence" returns a replacement source + rewritten claim together.
6. **Confirm replacement** → the claim's prose, chip, must-fix counter, My Tasks task, header/publish-lock status, AND Approval readiness all update **LIVE** with no manual refresh (FCT-05 / D-16).
7. Editing that section's prose flips the claim back to "Changed"/unchecked and increments "changed since check" (FCT-07) — even though step 6's replacement was itself sourced.
8. The Draft galley popover and the Approval SourceIndex render the SAME provenance card content as Stage 3 (FCT-04 parity).

**Expected:** every step completes live, no manual refresh.

**Why human:** end-to-end reactive-UI across Convex + FastAPI pipeline + Sanity spanning My Tasks, Fact Check, Draft, and Approval simultaneously. Every unit underneath is green (Parts A–C); the live cross-surface propagation is only provable in a running browser. Perform on a real or seeded run before Phase 42 is human-signed-off.

---

## Gaps Summary

**No code-level gaps found.** All 6 ROADMAP success criteria and all 7 FCT-01..07 requirements are implemented, wired at the correct EDT-05 write boundary, covered by passing tests re-executed live this pass (67 targeted pipeline tests, 743 console tests, strict build exit 0, Convex typecheck exit 0, deploy-parity 53/53 confirming live Convex functions), and free of stub/placeholder anti-patterns. The one outstanding item is the live operator demo-leg — a genuine human-only verification of live cross-surface reactivity, not a defect.

---
*Phase: 42-fact-check-stage*
*Verified goal-backward: 2026-07-15T14:00:36Z*
*Verifier: Claude (gsd-verifier)*
