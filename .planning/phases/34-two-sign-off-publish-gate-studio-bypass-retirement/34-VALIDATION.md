---
phase: 34
slug: two-sign-off-publish-gate-studio-bypass-retirement
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-08
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (async via `pytest.mark.anyio`, in-process ASGITransport `client` fixture) |
| **Config file** | `packages/pipeline/pyproject.toml` (existing — no changes needed) |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/test_review_endpoints.py tests/api/test_webhook_sanity.py -x -q` |
| **Full suite command** | `cd packages/pipeline && uv run pytest -x -q` |
| **Estimated runtime** | ~60 seconds (quick) / several minutes (full) |

Frontend (dispatch-control) has its own Vitest suite; no existing `DecisionRail.test.tsx` (consistent with Phase 33 pattern).

---

## Sampling Rate

- **After every task commit:** Run `cd packages/pipeline && uv run pytest tests/test_review_endpoints.py tests/api/test_webhook_sanity.py -x -q`
- **After every plan wave:** Run `cd packages/pipeline && uv run pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|-----------|-------------------|------|--------|
| 34-03 T1 | 34-03 | 2 | PUB-01, PUB-04 | unit | `uv run pytest tests/test_signoffs_endpoints.py -x -q` | ✅ new (created in task) | ⬜ pending |
| 34-03 T3 | 34-03 | 2 | PUB-01 | unit | `uv run pytest tests/test_review_endpoints.py -x -q` | ✅ extend existing | ⬜ pending |
| 34-04 T2 | 34-04 | 3 | PUB-02, PUB-04 | unit | `uv run pytest tests/api/test_webhook_sanity.py -x -q` | ✅ extend existing | ⬜ pending |
| 34-05 T2 | 34-05 | 3 | PUB-01, PUB-04 | unit | `uv run pytest tests/test_content_patch_endpoints.py tests/test_findings_endpoints.py -x -q` | ✅ extend existing | ⬜ pending |
| 34-06 T1 | 34-06 | 3 | PUB-01 | build | `pnpm --filter dispatch-control build` | ✅ strict type-check | ⬜ pending |
| 34-06 T2 | 34-06 | 3 | PUB-03 | manual | Studio flag flip (SANITY_STUDIO_DISABLE_PUBLISH) — soak mechanism non-automatable | N/A (grep + UAT) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Test creation is co-located in the implementing task (tdd-style), not a separate Wave 0 plan — the pipeline test files already exist to extend, and the one new module (test_signoffs_endpoints.py) is created inside 34-03 Task 1, matching the Phase 33 precedent.*

---

## Wave 0 Requirements

Test coverage is co-created with implementation (tdd-style), not a separate Wave 0 plan:

- [x] `packages/pipeline/tests/test_signoffs_endpoints.py` — NEW, created in **34-03 Task 1** (sign-off record + relocated facts prerequisites; PUB-01/PUB-04)
- [x] `packages/pipeline/tests/test_review_endpoints.py` — extended in **34-03 Task 3** (missing_signoffs gate on publish + schedule; PUB-01)
- [x] `packages/pipeline/tests/api/test_webhook_sanity.py` — extended in **34-04 Task 2** (D-07 re-validation + revert + run-less block; PUB-02)
- [x] `packages/pipeline/tests/test_content_patch_endpoints.py` + `test_findings_endpoints.py` — extended in **34-05 Task 2** (D-08 auto-revoke assertions; PUB-01)

*Convex mutations are validated via FastAPI-level tests that monkeypatch `_cc.convex_query`/`convex_mutation` — existing project convention, no phase-specific gap.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Studio publish-action removal behind flag | PUB-03 | No Studio test harness exists; flag/soak mechanism depends on real weekly usage | Set `SANITY_STUDIO_DISABLE_PUBLISH=true`, rebuild Studio, confirm publish action absent for `weeklyIssue` and present for other types; unset → action returns |
| DecisionRail sign-off controls live-update | PUB-01 | Convex reactivity + Clerk auth in browser | Sign both in rail → Publish enables; edit a section → sign-offs revoke live |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
