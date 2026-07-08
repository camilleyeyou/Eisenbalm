---
phase: 34
slug: two-sign-off-publish-gate-studio-bypass-retirement
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PUB-01 | unit | `uv run pytest tests/test_review_endpoints.py -k signoff -x -q` | ❌ W0 (extend existing file) | ⬜ pending |
| TBD | TBD | TBD | PUB-01 | unit | sign-off record endpoint prerequisite 409s | ❌ W0 (new test module) | ⬜ pending |
| TBD | TBD | TBD | PUB-02 | unit | `uv run pytest tests/api/test_webhook_sanity.py -k signoff -x -q` | ❌ W0 (extend existing file) | ⬜ pending |
| TBD | TBD | TBD | PUB-03 | manual | Studio flag flip verification (soak mechanism non-automatable) | N/A | ⬜ pending |
| TBD | TBD | TBD | PUB-04 | unit | `_emit_audit` call assertions for sign-off/revoke/block actions | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*(Planner fills Task IDs when plans are created.)*

---

## Wave 0 Requirements

- [ ] `packages/pipeline/tests/test_review_endpoints.py` — extend with sign-off-gate cases for `publish_issue`/`schedule_issue` (PUB-01)
- [ ] `packages/pipeline/tests/api/test_webhook_sanity.py` — extend with D-07 re-validation + revert cases (PUB-02)
- [ ] New test module for the sign-off record/revoke endpoints (PUB-01/PUB-04) — no existing file to extend

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
