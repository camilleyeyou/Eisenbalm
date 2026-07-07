---
phase: 31
slug: content-patch-endpoints-full-editing
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------------|
| **Framework** | pytest + pytest-asyncio + httpx.MockTransport (pipeline) · vitest (dispatch-control) |
| **Config file** | `packages/pipeline/pyproject.toml` · `apps/dispatch-control/vitest.config.ts` |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -q` · `pnpm --filter dispatch-control test -- --run` |
| **Full suite command** | `cd packages/pipeline && uv run pytest -x -q` · `pnpm --filter dispatch-control test -- --run` · `pnpm --filter dispatch-control build` |
| **Estimated runtime** | ~60–120 seconds combined |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the affected package
- **After every plan wave:** Run both full suites
- **Before `/gsd:verify-work`:** Full suite must be green + `pnpm --filter dispatch-control build` exits 0
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01 T1 (§31 contract) | 31-01 | 1 | EDT-01/02/03/05 | doc grep | `grep -q "## Phase 31" docs/API_CONTRACTS.md && grep -q "revision_mismatch" docs/API_CONTRACTS.md` | contract doc | ⬜ pending |
| 31-01 T2 (pt_to_blocks + validators) | 31-01 | 1 | EDT-01/02 | unit (inline python asserts) | inline `uv run python -c "...pt_to_blocks/validate_theme_fields/structural_floor_warnings..."` | new libs | ⬜ pending |
| 31-01 T3 (_emit_audit + scaffold) | 31-01 | 1 | D-09 | unit | `uv run pytest tests/test_content_patch_endpoints.py -q` (audit test green + 10 skipped) | ❌ W0 (this task creates it) | ⬜ pending |
| 31-02 T1 (patch_issue_field) | 31-02 | 2 | EDT-01, D-10 | unit (MockTransport) | `uv run pytest ...::test_patch_section_scoped ...::test_patch_revision_mismatch -q` | scaffold from 31-01 | ⬜ pending |
| 31-02 T2 (get_issue_draft) | 31-02 | 2 | EDT-01 | unit (MockTransport) | `uv run pytest ...::test_draft_read_lossy_flag -q` | scaffold from 31-01 | ⬜ pending |
| 31-02 T3 (upload_asset) | 31-02 | 2 | EDT-03 | unit (MockTransport) | `uv run pytest ...::test_upload_asset_patches_reference ...::test_asset_overwrite_audit_swap -q` | scaffold from 31-01 | ⬜ pending |
| 31-03 T1 (patch endpoints) | 31-03 | 3 | EDT-01/02, D-08 | unit/integration | `uv run pytest ...::test_theme_patch_validation ...::test_structural_floor_warns_not_blocks ...::test_audit_row_truncated_snapshot ...::test_bonus_patch_variant_shaped -q` | scaffold from 31-01 | ⬜ pending |
| 31-03 T2 (assets POST + draft GET) | 31-03 | 3 | EDT-03 | integration | `uv run pytest tests/test_content_patch_endpoints.py -q` (0 skipped; incl. test_asset_overwrite_audit_swap_records_audit, test_suno_audio_sets_url_string, storyboard set-path test) | scaffold from 31-01 | ⬜ pending |
| 31-03 T3 (router mount) | 31-03 | 3 | EDT-01/02/03 | import/smoke | `uv run python -c "from eisenbalm_pipeline.api.main import app; ..."` + full `uv run pytest -x -q` | app | ⬜ pending |
| 31-04 T1 (client + EDT-05 scan) | 31-04 | 2 | EDT-05 | source-scan (vitest) | `pnpm --filter dispatch-control test -- --run dispatch-control-no-sanity-write` | ❌ W0 (this task creates it) | ⬜ pending |
| 31-04 T2 (route shell) | 31-04 | 2 | EDT-01 (UI home, D-01/D-02) | strict build | `pnpm --filter dispatch-control build` | app | ⬜ pending |
| 31-04 T3 (SectionChipList) | 31-04 | 2 | EDT-01 (jump nav) | strict build | `pnpm --filter dispatch-control build` | app | ⬜ pending |
| 31-05 T1 (BlockEditor/TurnList) | 31-05 | 3 | EDT-01, D-04/D-06 | unit (vitest) | `pnpm --filter dispatch-control test -- --run review-desk-editors` | ❌ created in-plan | ⬜ pending |
| 31-05 T2 (StructuredFieldEditor + AssetUploadSlot) | 31-05 | 3 | EDT-02/03, D-05/D-11/12/13 | strict build | `pnpm --filter dispatch-control build` | app | ⬜ pending |
| 31-05 T3 (panel harness + inbox + gate) | 31-05 | 3 | EDT-01/02/03, D-07/D-10 | unit + strict build | `pnpm --filter dispatch-control test -- --run review-desk-editors && pnpm --filter dispatch-control build` | app | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/pipeline/tests/test_content_patch_endpoints.py` scaffold (Plan 31-01 Task 3): green `_emit_audit` before/after test + 10 named skipped placeholders (patch scoped, revision 409, theme validation, floor warn, upload reference, audit snapshot, overwrite swap [helper], overwrite swap records audit [endpoint], bonus variant, draft lossy)
- [ ] `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts` (Plan 31-04 Task 1): EDT-05 source-scan, passes immediately on the clean baseline (zero @sanity/* deps verified 2026-07-07)
- [ ] `docs/API_CONTRACTS.md` §31 (Plan 31-01 Task 1) — contract-first, lands before any endpoint/UI code

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live end-to-end save against real Sanity dataset | EDT-01/02 | Needs real Sanity project + Convex + Clerk session | Edit a section in the console, save, confirm change in Sanity + audit row (with before/after) in Convex |
| Storyboard positional patch addressing (RESEARCH Open Question 3) | EDT-03 | Sanity array-index `set` path not doc-confirmed | Patch one storyboard slot on the real dataset; confirm it lands on the right index without touching siblings; if it fails, switch to `_key`-predicate addressing per Plan 31-03 Task 2 |
| Live asset upload playback | EDT-03 | Needs a real audio/image file + Sanity CDN | Upload podcast audio via console, confirm inline `<audio>` player works and asset attached to draft; upload suno audio and confirm `bonus.sunoAudioUrl` holds a plain URL string that plays on the live issue page |
| Preview iframe reflects saved edit | EDT-01 | Visual check | Save an edit, refresh/observe preview iframe shows updated prose |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-filled 2026-07-07 (revision 1)
