---
phase: 22
slug: config-externalization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seams derived from the "## Validation Architecture" section of `22-RESEARCH.md`.
> The planner fills the Per-Task Verification Map once tasks exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Pipeline framework** | pytest (existing `packages/pipeline/tests/`, `pyproject.toml`) |
| **Convex** | `pnpm --filter @eisenbalm/convex typecheck` + `codegen` (schema + seed/query compile) |
| **Byte-verification** | `verify_prompt_seed.py` standalone (live Convex) + pytest parametrize (mocked Convex) — both per research |
| **Config files** | `packages/pipeline/pyproject.toml` (exists) |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/lib/test_config_loader.py tests/api/test_runs.py -q` |
| **Full suite command** | `cd packages/pipeline && uv run pytest -q && pnpm --filter @eisenbalm/convex typecheck` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (pipeline pytest OR convex typecheck)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Success-Criterion → Validation Seam (from RESEARCH §Validation Architecture)

| # | Success Criterion | Requirement | How it's validated | Type |
|---|-------------------|-------------|--------------------|------|
| 1 | `runs.configSnapshot` JSON contains the exact prompt text + model settings used, matching active prompt versions | CFG-01, CFG-04 | pytest: `load_run_config()` returns a `RunConfig` whose per-agent systemPrompt == `load_prompt(name)` for all 11; snapshot JSON round-trips to the same values | unit (pytest) |
| 2 | Snapshot written + confirmed BEFORE `graph.ainvoke()`; mid-run edit doesn't change in-flight behavior | CFG-04 | pytest: ordering test asserting `snapshot_config()` is awaited in the HTTP handler BEFORE `asyncio.create_task()`/`ainvoke` (mock both, assert call order); a "mutate after snapshot → state unchanged" test | unit (pytest) |
| 3 | All 11 `.md` files appear in `prompt_versions` as v1 active rows; byte-comparison shows ZERO diff | CFG-02 | `verify_prompt_seed.py` (live) + pytest parametrize (mocked): for each of 11, seeded `content` == `load_prompt(name)` output byte-for-byte; assert `version==1`, `isActive==true` | unit + standalone |
| 4 | Convex unreachable at run start → fall back to disk `.md` + `llm_config.py`, log WARNING, no crash | CFG-03 | pytest: hard-failure path (Convex raises) → `RunConfig` from disk/code defaults + single WARNING logged (caplog); per-key path (one row missing) → that agent falls back + per-agent WARNING; process does not raise | unit (pytest) |

---

## Per-Task Verification Map

*Planner fills this once PLAN.md tasks exist. Every task maps to an automated command or a Wave 0 dependency.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | — | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/pipeline/tests/lib/test_config_loader.py` — stubs for CFG-01/CFG-03 (load_run_config happy path + two-tier fallback)
- [ ] `packages/pipeline/tests/lib/test_config_snapshot.py` (or in test_runs.py) — stub for CFG-04 (snapshot-before-invoke ordering)
- [ ] `packages/pipeline/tests/lib/test_prompt_seed_byte_parity.py` — parametrized stub for CFG-02 (11-file byte comparison)
- [ ] `packages/pipeline/tests/conftest.py` — shared fixtures (mock Convex query/mutation, caplog) if not already present

*If existing pipeline test infra covers fixtures, note that and only add the new test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live seed against the real Convex deployment | CFG-02 | Needs the live `modest-magpie-797` deployment | Run the seed mutation, then `uv run python verify_prompt_seed.py` against live Convex → expect zero diff across 11 rows |
| End-to-end live run shows a real `configSnapshot` | CFG-01/CFG-04 | Needs a full pipeline run on live infra | Trigger a run; inspect the `runs` record's `configSnapshot` field; confirm it matches the active prompt versions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (new pipeline test files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
