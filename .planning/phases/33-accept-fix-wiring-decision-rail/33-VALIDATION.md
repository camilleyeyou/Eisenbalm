---
phase: 33
slug: accept-fix-wiring-decision-rail
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (packages/pipeline) + vitest (apps/dispatch-control) |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `pnpm --filter dispatch-control test -- --run` / `cd packages/pipeline && uv run pytest -q` |
| **Full suite command** | both of the above + `pnpm --filter dispatch-control build` (strict type-check — required before phase done) |
| **Estimated runtime** | ~60–120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the affected side's quick command
- **After every plan wave:** Run both suites
- **Before `/gsd:verify-work`:** Full suite green + `pnpm --filter dispatch-control build` green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01·T1 | 33-01 | 1 | GLY-03, GLY-04, EDT-04, EDT-06 | grep-contract | `grep -q "## Phase 33 — Accept-Fix Wiring + Decision Rail" docs/API_CONTRACTS.md && grep -q "findings/{finding_id}/accept" docs/API_CONTRACTS.md && grep -q "open_error_findings" docs/API_CONTRACTS.md && grep -q "setResolution" docs/API_CONTRACTS.md && grep -q "checkedAt" docs/API_CONTRACTS.md && grep -q "span_not_resolved" docs/API_CONTRACTS.md` | ✅ docs/API_CONTRACTS.md | ⬜ pending |
| 33-02·T1 | 33-02 | 2 | EDT-04, EDT-06, GLY-04 | grep-schema | `grep -q "setResolution" convex/qaCorrections.ts && grep -q "requirePipelineSecret" convex/qaCorrections.ts && grep -q "selectedByRunId" convex/pitchLog.ts && grep -q "checkedAt" convex/schema.ts && grep -q "resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed')))" convex/schema.ts` | ✅ convex/* | ⬜ pending |
| 33-02·T2 | 33-02 | 2 | EDT-04, GLY-04 | grep-generated | `grep -q "checkedAt = Date.now()" convex/claimChecks.ts && grep -q "setResolution" convex/_generated/api.d.ts && grep -q "selectedByRunId" convex/_generated/api.d.ts` | ✅ convex/_generated | ⬜ pending |
| 33-02·T3 | 33-02 | 2 | EDT-04, EDT-06 | unit (convex-test) | `pnpm --filter dispatch-control test:unit __tests__/qaCorrectionsResolution.test.ts -- --run` | ❌ W0 → __tests__/qaCorrectionsResolution.test.ts | ⬜ pending |
| 33-03·T1 | 33-03 | 2 | EDT-04 | unit (pytest) | `cd packages/pipeline && uv run pytest tests/test_span_resolver.py -x -q` | ❌ W0 → tests/test_span_resolver.py | ⬜ pending |
| 33-03·T2 | 33-03 | 2 | EDT-04 | integration (pytest) | `cd packages/pipeline && uv run pytest tests/test_findings_endpoints.py -x -q` | ❌ W0 → tests/test_findings_endpoints.py | ⬜ pending |
| 33-03·T3 | 33-03 | 2 | GLY-04 | integration (pytest) | `cd packages/pipeline && uv run pytest tests/test_review_endpoints.py -x -q` | ✅ tests/test_review_endpoints.py (extended) | ⬜ pending |
| 33-04·T1 | 33-04 | 3 | GLY-03, EDT-04 | unit (vitest) | `pnpm --filter dispatch-control test:unit __tests__/findingsClient.test.ts -- --run` | ❌ W0 → __tests__/findingsClient.test.ts | ⬜ pending |
| 33-04·T2 | 33-04 | 3 | EDT-06 | unit + typecheck | `pnpm --filter dispatch-control test:unit __tests__/Galley.test.tsx -- --run && pnpm --filter dispatch-control typecheck` | ✅ __tests__/Galley.test.tsx (extended) | ⬜ pending |
| 33-04·T3 | 33-04 | 3 | GLY-03, EDT-04 | unit + build | `pnpm --filter dispatch-control test:unit __tests__/AnnotationMark.test.tsx __tests__/UnresolvedFindingCard.test.tsx -- --run && pnpm --filter dispatch-control build` | ❌ W0 → __tests__/AnnotationMark.test.tsx | ⬜ pending |
| 33-05·T1 | 33-05 | 4 | GLY-04 | unit (jsdom) | `pnpm --filter dispatch-control test:unit __tests__/DecisionRail.test.tsx -- --run` | ❌ W0 → __tests__/DecisionRail.test.tsx | ⬜ pending |
| 33-05·T2 | 33-05 | 4 | GLY-04 (D-04 reopen) | unit (jsdom) | `pnpm --filter dispatch-control test:unit __tests__/ResolvedFindingsList.test.tsx -- --run` | ❌ W0 → __tests__/ResolvedFindingsList.test.tsx | ⬜ pending |
| 33-05·T3 | 33-05 | 4 | GLY-04 | typecheck + build | `pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build` | ✅ page.tsx (mount) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Requirement coverage: GLY-03 (33-04·T1/T3), GLY-04 (33-01·T1, 33-02·T1/T2, 33-03·T3, 33-05·T1/T2/T3), EDT-04 (33-01·T1, 33-02·T1/T2/T3, 33-03·T1/T2, 33-04·T1/T3), EDT-06 (33-01·T1, 33-02·T1/T3, 33-04·T2) — every phase requirement has ≥1 automated verify.*

---

## Wave 0 Requirements

- [ ] Pipeline: test module for the findings accept/dismiss/reopen endpoints (clone Phase 26 review-endpoint test pattern) → `tests/test_findings_endpoints.py`
- [ ] Pipeline: server span-resolution unit tests (exact / curly-quote / whitespace-tolerant / ambiguous → 409) → `tests/test_span_resolver.py`
- [ ] Dashboard: vitest stubs for findings client, popover action row, rail blockers, resolved-findings reopen → `__tests__/findingsClient.test.ts`, `__tests__/AnnotationMark.test.tsx`, `__tests__/DecisionRail.test.tsx`, `__tests__/ResolvedFindingsList.test.tsx`, `__tests__/qaCorrectionsResolution.test.ts`

*Existing pytest + vitest infrastructure covers frameworks; no installs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Popover accept round-trip against live draft | EDT-04 | Needs live Sanity draft + Convex run | On a real awaiting-review run, accept a fix; confirm galley text updates and audit row appears |
| Rail affirmative timestamps render | GLY-04 | Visual recency state | Open Review Desk; verify "checked Nm ago" never blank |
| Reopen returns a resolved finding to the galley | GLY-04 (D-04) | Needs live Convex reactivity across surfaces | Resolve a finding, expand the rail's Resolved list, click Reopen; confirm it reappears in the galley/blockers without a page reload and no text revert |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
</content>
