---
phase: quick-260621-d31
verified: 2026-06-21T00:00:00Z
status: human_needed
score: 7/7 must-haves verified (extraction logic); 1 live-smoke follow-up
re_verification:
  previous_status: none
  previous_score: n/a
human_verification:
  - test: "Run one real OpenRouter call (live, EISENBALM_STUB_MODE=false, real OPENROUTER_API_KEY) for any anthropic/* agent and inspect the recorded cost payload."
    expected: "response_metadata['token_usage']['cost'] is present and > 0 for this account/model, so recorded usd > 0 and the per-run cap can actually trip in production."
    why_human: "Unit tests prove the EXTRACTION LOGIC against a fake AIMessage. Whether OpenRouter emits a non-zero usage.cost live for this specific account/model/provider-route is account-dependent and cannot be verified without a real key + network call. Acceptable as a follow-up, not a code gap."
---

# Quick 260621-d31: Real OpenRouter token + USD capture in acomplete — Verification Report

**Goal:** Make `acomplete`'s structured-output path record REAL OpenRouter token counts and USD (was hardcoded $0/0), re-arming the inert per-run cost cap.
**Verified:** 2026-06-21
**Status:** human_needed (all automated must-haves verified; one live-smoke follow-up)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Structured path records REAL token counts (not hardcoded 0) | ✓ VERIFIED | `openrouter_client.py:220` calls `_usage_from_message(raw, ...)`; helper (L125-126) reads `usage_metadata.input_tokens/output_tokens`. Test `test_structured_capture_records_real_cost` asserts `tokens_in==1200, tokens_out==350`. PASS. |
| 2 | Records REAL USD from `token_usage.cost` for structured AND plain-text | ✓ VERIFIED | Helper L121-123 reads `response_metadata["token_usage"]["cost"]`; used by both structured (L220) and plain-text (L232) paths. Old `input_cost/output_cost` math removed. Tests `test_structured_..._real_cost` + `test_plain_text_..._real_cost` assert `usd≈0.0271`. PASS. |
| 3 | Schema miss (parsed is None) → exactly one corrective retry; second miss propagates | ✓ VERIFIED | L199 detects `result["parsed"] is None` (not try/except), appends corrective message (L204-211), re-invokes once (L212); L215-218 raises `parsing_error or RuntimeError` on second None. Test `test_schema_miss_retries_once_and_records_once` asserts `call_count==2`. PASS. |
| 4 | Cost recorded exactly once per call (no double-count) | ✓ VERIFIED | Single `record_cost` from final successful `raw` (L221-224 structured / L235-238 plain). Retry test asserts recorded usd is 0.0271 (second raw) not 0.99 (failed attempt) — proves no double-count. PASS. |
| 5 | Recorded usd crossing cap → `check_cap()` raises `CostCapExceeded` (cap re-armed) | ✓ VERIFIED | `record_cost` then `get_recorder(...).check_cap()` (L221-227 / L235-241). Test `test_cap_trips_after_real_usd` sets cap 0.01 < 0.0271 and `pytest.raises(CostCapExceeded)`. PASS. |
| 6 | Stub-mode still returns $0/0 + `resolved_model='fake-openrouter-stub'` | ✓ VERIFIED | Stub short-circuit L164-184 untouched: `record_cost(...,0,0,0.0)` + returns `resolved_model="fake-openrouter-stub"`. Regression `test_stub_mode_acomplete_short_circuits` PASS. |
| 7 | `test_vercel_client.py` runs without `--with respx` after respx in test deps | ✓ VERIFIED | `respx>=0.21` in `[dependency-groups].dev` (pyproject L29). Ran `uv run --group dev ... test_vercel_client.py` with no `--with respx` → passes. |

**Score:** 7/7 truths verified (extraction logic).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/openrouter_client.py` | Real token+USD capture, include_raw rework, usage-accounting extra_body | ✓ VERIFIED | Contains `include_raw=True` (L193); `_usage_from_message` helper present; `extra_body = {"usage": {"include": True}}` (L96). Substantive (258 lines), wired (sole LLM call site). |
| `tests/lib/test_openrouter_cost_capture.py` | Unit tests patching `_build_chat_model` | ✓ VERIFIED | 144 lines, 5 tests, patches `eisenbalm_pipeline.lib.openrouter_client._build_chat_model`. All pass. |
| `pyproject.toml` | `respx` in dev group (verify present) | ✓ VERIFIED | `respx>=0.21` at L29. NOTE: file UNCHANGED by d31 commits — respx was already present (matches plan's "confirmed already present"). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| acomplete structured path | `raw.response_metadata['token_usage']['cost']` | `_usage_from_message` | ✓ WIRED | L121-123 reads `rm.get("token_usage").get("cost")`; pattern `response_metadata...token_usage` matched. |
| acomplete (real usd) | `CostRecorder.check_cap` → `CostCapExceeded` | `record_cost` then `check_cap()` | ✓ WIRED | L221-227 / L235-241; cap-trip test confirms exception raised. |
| `_build_chat_model` extra_body | OpenRouter usage accounting | `usage={"include": True}` | ✓ WIRED | L96 `extra_body: dict = {"usage": {"include": True}}`; Anthropic provider pin merged after. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Targeted suite (cost+openrouter+vercel) | `uv run --group dev python -m pytest tests/lib/test_openrouter_cost_capture.py tests/lib/test_cost.py tests/lib/test_vercel_client.py -q` | 17 passed in 0.37s | ✓ PASS |
| Stub-mode regression | `pytest ...::test_stub_mode_acomplete_short_circuits` | 1 passed | ✓ PASS |
| Full pipeline suite (regression) | `uv run --group dev python -m pytest -q` | 247 passed, 33 skipped, 6 warnings | ✓ PASS |

(Warnings are pre-existing Pydantic `BodyBlock` serialization warnings in unrelated graph tests; not introduced by d31.)

### Change-Surface / UNCHANGED Confirmation (git)

| File / area | Expectation | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| `lib/cost.py` | UNCHANGED | ✓ | `git diff a0fdcd3 HEAD -- ...cost.py` empty. `record_cost` additive; `check_cap`/`CostCapExceeded` intact. |
| `agents/_wrapper.py` | UNCHANGED (duration-only, tokens/usd=0 → no double-count) | ✓ | empty diff; L121-128 still `record_cost(...,0,0,0.0,duration_ms)`. |
| `pyproject.toml` | may or may not have changed | ✓ REPORTED | UNCHANGED by d31 — respx already present (plan Task 3 was confirm-only). |
| web app (`apps/web`) | UNCHANGED | ✓ | empty diff. |
| Convex (`convex/`) | UNCHANGED | ✓ | empty diff. |
| Sanity schema (`schemas/`) | UNCHANGED | ✓ | empty diff. |
| Tracked change surface | only openrouter_client.py + new test file | ✓ | `git diff --stat a0fdcd3 HEAD` = exactly those 2 files (+203/-47). Working tree matches HEAD for both (no drift). |

### Anti-Patterns Found

None blocking. No TODO/placeholder/`return null`/stub patterns in the structured or plain-text paths. The prior hardcoded-zero TODO is removed. `usd = float(cost) if cost is not None else 0.0` is intentional defensive handling (covered by `test_cost_absent_records_zero`), not a stub.

### Human Verification Required

1. **Live OpenRouter cost smoke** — Make one real call (`EISENBALM_STUB_MODE=false`, real `OPENROUTER_API_KEY`) for an `anthropic/*` agent and inspect the recorded cost payload.
   - Expected: `response_metadata['token_usage']['cost']` present and > 0, so recorded `usd > 0` and the cap can trip in production.
   - Why human: Unit tests prove the EXTRACTION LOGIC against a fake AIMessage. Whether OpenRouter emits non-zero `usage.cost` live for this account/model/provider-route is account-dependent and needs a real key + network. **Acceptable as follow-up, not a code gap.**

### Gaps Summary

No code gaps. All seven must-have truths are verified against the actual working-tree code on `master`, the change surface is limited exactly to `openrouter_client.py` + the new test file, all designated UNCHANGED files are confirmed unchanged, and the full suite is green (247 passed). The only open item is a live-smoke confirmation that OpenRouter emits `usd > 0` for this account — an environment/account property, not an implementation defect — recorded as `human_needed`.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
