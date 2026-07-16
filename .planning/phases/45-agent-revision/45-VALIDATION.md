---
phase: 45
slug: agent-revision
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
gate_completed: 2026-07-16
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 45-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (`asyncio_mode="auto"`) for pipeline · Vitest for console |
| **Config file** | `packages/pipeline/pyproject.toml` · `apps/dispatch-control/package.json` (`"test": "vitest run"`) |
| **Quick run command** | `cd packages/pipeline && python -m pytest tests/test_revision_endpoints.py -x` · `cd apps/dispatch-control && npx vitest run __tests__/RevisionComparisonCard.test.tsx` |
| **Full suite command** | `cd packages/pipeline && python -m pytest` · `cd apps/dispatch-control && npm run test` |
| **Estimated runtime** | ~60–120s pipeline · ~30–60s console |

---

## Sampling Rate

- **After every task commit:** Run the relevant single test file (`pytest tests/test_revision_endpoints.py -x` or the matching `vitest run __tests__/<Component>.test.tsx`)
- **After every plan wave:** Run full pipeline pytest (`python -m pytest`) + full console vitest (`npm run test`)
- **Before `/gsd:verify-work`:** Full suite must be green; the EDT-05 `dispatch-control-no-sanity-write` tripwire + all prior tripwires must remain green with zero regressions
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 45-05 T1 | 45-05 | 2 | REV-01 | component | `npx vitest run __tests__/PassageToolbar.test.tsx` | ✅ | ✅ green |
| 45-01 T2 | 45-01 | 0 | REV-01 | unit | `npx vitest run __tests__/blockIndexFromKey.test.ts` | ✅ | ✅ green |
| 45-04 T2 | 45-04 | 2 | REV-02 | component | `npx vitest run __tests__/DirectionChips.test.tsx` | ✅ | ✅ green |
| 45-03 T1 | 45-03 | 2 | REV-02 | unit (pytest) | `python -m pytest tests/test_revision_endpoints.py -k directive -x` | ✅ | ✅ green |
| 45-03 T1 | 45-03 | 2 | REV-03 | integration (pytest) | `python -m pytest tests/test_revision_endpoints.py -k preview -x` | ✅ | ✅ green |
| 45-03 T2 | 45-03 | 2 | REV-04 | integration (pytest) | `python -m pytest tests/test_revision_endpoints.py -k apply -x` | ✅ | ✅ green |
| 45-02/45-03 | 45-02 | 2 | REV-04 | source-scan tripwire | `npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts` | ✅ existing | ✅ green |
| 45-02 T2 | 45-02 | 1 | REV-05 | unit (pytest) | `python -m pytest tests/test_budget.py -k run_cap -x` | ✅ | ✅ green |
| 45-03 T1 | 45-03 | 2 | REV-05 | integration (pytest) | `python -m pytest tests/test_revision_endpoints.py -k cost_attribution -x` | ✅ | ✅ green |
| 45-06 T2 | 45-06 | 3 | REV-05 | component | `npx vitest run __tests__/FrameChromeCostReadout.test.tsx` | ✅ | ✅ green |
| 45-04 T2 | 45-04 | 2 | REV-03 | component | `npx vitest run __tests__/RevisionComparisonCard.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Confirmed green as part of the 45-07 integration gate (full pipeline pytest 585 passed/0 failed excl. the pre-existing respx gap; full console vitest 884 passed/0 failed, incl. `dispatch-control-no-sanity-write.test.ts`).*

---

## Wave 0 Requirements

- [x] `packages/pipeline/tests/test_revision_endpoints.py` — new pytest file, mirrors `tests/test_factcheck_endpoints.py` (monkeypatched `_cc.convex_query`/`convex_mutation`, `_sc._groq`, `patch_issue_field`) — covers REV-02 directive, REV-03 preview, REV-04 apply, REV-05 cost-attribution — landed 45-01 (scaffold), activated 45-03
- [x] `packages/pipeline/tests/test_budget.py` — extend if it exists (verify presence in Wave 0; Phase 25 RUN-06 shipped `would_exceed_monthly_cap`), else create — covers REV-05 `would_exceed_run_cap` predicate against durable `agent_runs` summation — landed 45-01 (scaffold), activated 45-02
- [x] `apps/dispatch-control/__tests__/PassageToolbar.test.tsx` — REV-01 six-action toolbar; Compare/Restore reserved-with-title — landed 45-01 (scaffold), activated 45-05
- [x] `apps/dispatch-control/__tests__/DirectionChips.test.tsx` — REV-02 fixed chip copy, never "Regenerate", disabled-with-title when cost-capped — landed 45-01 (scaffold), activated 45-04
- [x] `apps/dispatch-control/__tests__/RevisionComparisonCard.test.tsx` — REV-03 original/proposed/what-changed/claim-delta + Apply/Edit/Try-another/Discard — landed 45-01 (scaffold), activated 45-04
- [x] `apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx` — REV-05 never-blank header readout — landed 45-01 (scaffold), activated 45-06
- [x] `apps/dispatch-control/lib/blockIndexFromKey.ts` + `__tests__/blockIndexFromKey.test.ts` — REV-01 pure helper (parse `row-{sectionId}-{blockIndex}` → block index), independently testable outside DOM selection — landed 45-01, real from the start
- Framework install: none — pytest and vitest are already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full Annotations header demo leg | REV-01…REV-05 | End-to-end browser flow spanning selection, LLM revision, content patch, and cross-stage sign-off revocation — not reproducible in a single automated harness | Draft/Voice → select the founder phrase → Ask agent to revise → apply "a former county clerk" → comparison card names the claim delta → Apply → confirm Voice Pass returns to "Review needed" (sign-off revoked) → header cost-vs-budget increments. Documented as the load-bearing human check in 45-VERIFICATION.md. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test_revision_endpoints.py, test_budget.py, 4 console test files, blockIndexFromKey helper+test)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — 45-07 integration gate, 2026-07-16. Full pipeline pytest (585 passed / 36 skipped / 0 failed, `--ignore=tests/lib/test_vercel_client.py` for the pre-existing unrelated `respx` collection error), full console vitest (884 passed / 2 todo / 0 failed, incl. `dispatch-control-no-sanity-write.test.ts`), and the strict `npm run build` (dispatch-control) all green. Convex confirmed unchanged this phase (no `convex/*.ts` diff since 45-01's first commit `4e4156e`).
