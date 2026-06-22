---
phase: 24
slug: prompt-editor-versioning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Pipeline framework** | pytest (`uv run pytest`) |
| **Frontend framework** | vitest (`pnpm --filter dispatch-control test:unit` / `npx vitest run`) |
| **Convex tests** | `pnpm --filter @eisenbalm/convex test` (if vitest configured) |
| **Pipeline quick run** | `cd packages/pipeline && uv run pytest -x -q -k "test_voice or test_prompt_version"` |
| **Pipeline full suite** | `cd packages/pipeline && uv run pytest -x -q` |
| **Frontend quick run** | `cd apps/dispatch-control && npx vitest run <testfile>` |
| **Config file** | `packages/pipeline/pyproject.toml`; dispatch-control vitest config in repo |

---

## Sampling Rate

- **After every task commit:** Run the scoped quick command for the touched area (e.g. `uv run pytest tests/test_voice.py -x -q`, or `npx vitest run __tests__/<X>.test.ts`)
- **After every plan wave:** Run the full pipeline suite + the dispatch-control vitest suite
- **Before `/gsd:verify-work`:** Full pipeline suite + dispatch-control suite must be green
- **Max feedback latency:** scoped pytest/vitest runs complete in seconds; full pipeline suite per wave

---

## Per-Task Verification Map

*Pre-populated by gsd-planner from RESEARCH.md "Validation Architecture" (Phase Requirements → Test Map + Byte-Equivalence Oracles) and each PLAN.md task's `<verify>`. Each task maps to PRM-01..PRM-06. Statuses flip to ✅ during execution; Plan 06 Task 3 finalizes `nyquist_compliant` after the backend is green.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T1 | 24-01 | 1 | PRM-01..06 (scaffold) | scaffold/contract | `cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py tests/test_voice_db_override.py tests/test_test_run.py -q` (xfail/skipped scaffolds) | ✅ Plan 01 | ⬜ pending |
| 02-T* | 24-02 | 2 | PRM-03, PRM-04 | Convex unit | `pnpm --filter @eisenbalm/convex test -- saveVersion` and `... -- activate_blocked` | ✅ Plan 01 | ⬜ pending |
| 03-T* | 24-03 | 2 | PRM-01, PRM-06 | unit | `cd packages/pipeline && uv run pytest tests/test_config_loader_assets.py -x -q` | ✅ Plan 01 | ⬜ pending |
| 04a-T1 | 24-04a | 3 | PRM-01 | byte-equivalence unit | `cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py::test_user_template_seed_byte_equivalence -x -q` | ✅ Plan 01 | ⬜ pending |
| 04b-T1 | 24-04b | 4 | PRM-01 | integration/regression | `cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py tests/test_voice.py tests/test_section_writer_voice_propagation.py -x -q` | ✅ Plan 01 | ⬜ pending |
| 04b-T2 | 24-04b | 4 | PRM-01 (seed) | static/parse | `cd packages/pipeline && uv run python -c "import ast; ast.parse(open('scripts/seed_phase24_assets.py').read())"` + grep `upsertActive`/`USER_TEMPLATE_KEYS` | ✅ Plan 04b | ⬜ pending |
| 05a-T1 | 24-05a | 4 | PRM-01 | byte-equivalence unit | `cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py::test_section_guidance_seed_byte_equivalence tests/test_prompt_version_seeds.py::test_rubric_seed_byte_equivalence -x -q` | ✅ Plan 01 | ⬜ pending |
| 05b-T1 | 24-05b | 5 | PRM-01 | regression | `cd packages/pipeline && uv run pytest tests/test_voice.py tests/test_section_writer_voice_propagation.py -x -q` + full suite | ✅ Plan 01 | ⬜ pending |
| 05b-T2 | 24-05b | 5 | PRM-01 (seed) | static/parse | `cd packages/pipeline && uv run python -c "import ast; ast.parse(open('scripts/seed_phase24_assets.py').read())"` + grep `SECTION_GUIDANCE_KEYS` | ✅ Plan 04b | ⬜ pending |
| 06-T1 | 24-06 | 6 | PRM-06 | unit + sentinel | `cd packages/pipeline && uv run pytest tests/test_voice.py tests/test_voice_db_override.py tests/test_prompt_version_seeds.py::test_voice_constraints_seed_byte_equivalence -x -q` | ✅ Plan 01 | ⬜ pending |
| 06-T2 | 24-06 | 6 | PRM-05 | integration (isolation+cost) | `cd packages/pipeline && uv run pytest tests/test_test_run.py -x -q` | ✅ Plan 01 | ⬜ pending |
| 06-T3 | 24-06 | 6 | PRM-01..06 (gate) | full regression | `cd packages/pipeline && uv run pytest -x -q` | ✅ exists | ⬜ pending |
| 07-T1 | 24-07 | 3 | PRM-02 | unit | `cd apps/dispatch-control && npx vitest run __tests__/VariableRegistry.test.ts` | ✅ Plan 01 | ⬜ pending |
| 07-T2 | 24-07 | 3 | PRM-01, PRM-02, PRM-03 | smoke/render | `cd apps/dispatch-control && npx vitest run __tests__/PromptEditor.test.tsx` | ✅ Plan 01 (or Plan 07) | ⬜ pending |
| 07-T3 | 24-07 | 3 | PRM-01, PRM-06 | typecheck + unit | `cd apps/dispatch-control && npx tsc --noEmit` + `npx vitest run __tests__/PromptEditor.test.tsx __tests__/VariableRegistry.test.ts` | ✅ Plan 07 | ⬜ pending |
| 07-T4 | 24-07 | 3 | PRM-01, PRM-02 (visual) | checkpoint:human-verify | Andrew opens /prompts, confirms editor render + highlight + save gate (manual) | n/a | ⬜ pending |
| 08-T1 | 24-08 | 7 | PRM-04 | unit | `cd apps/dispatch-control && npx vitest run __tests__/DiffViewer.test.tsx` | ✅ Plan 01 | ⬜ pending |
| 08-T2 | 24-08 | 7 | PRM-04 | typecheck + grep | `cd apps/dispatch-control && npx tsc --noEmit` + grep activate/in-progress/blocked | ✅ Plan 08 | ⬜ pending |
| 08-T3 | 24-08 | 7 | PRM-05 | typecheck + full vitest | `cd apps/dispatch-control && npx tsc --noEmit` + `npx vitest run` | ✅ Plan 08 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Byte-equivalence oracle tests for each newly-externalized asset (user-templates → 04a, SECTION_GUIDANCE + qa/rubric.md → 05a, VOICE_CONSTRAINTS → 06) — assert migrated v1 row == on-disk/in-code source
- [ ] Preserve existing `test_voice.py` invariants (`assemble_voice(None) == VOICE_CONSTRAINTS`) and Phase-16 import-time sentinel
- [ ] Convex mutation tests for `saveVersion` (increments, never overwrites) / `activate` (in-progress guard)
- [ ] dispatch-control component test harness — confirm/install if absent (used by 07/08 vitest)

*Scaffolds created in Plan 01 (Wave 1); filled GREEN across Waves 3-7 per the map above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `{variable}` highlight color rendering in CodeMirror | PRM-02 | Visual rendering inside editor | Plan 07 Task 4 checkpoint: open editor, confirm known vars highlighted distinctly, unknown var triggers warning + disables save |
| CodeMirror editor renders (no SSR/hydration error) | PRM-01 | First write UI surface, in-browser only | Plan 07 Task 4 checkpoint: open /prompts/[agentKey], confirm editor renders the active version |
| Side-by-side diff visual layout | PRM-04 | Visual side-by-side comparison | Select two versions, confirm true two-column diff (logic auto-tested in DiffViewer.test.tsx) |

*The warning/validation/save-gate LOGIC is auto-tested (VariableRegistry + PromptEditor); only visual rendering stays manual via the Plan 07 checkpoint.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 scaffold dependency (only 07-T4 is a deliberate human-verify checkpoint)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Plan 01 scaffolds)
- [ ] No watch-mode flags (all runs use `--run` / `-x -q` / `run`)
- [ ] `nyquist_compliant: true` set in frontmatter (flipped by Plan 06 Task 3 after backend green)

**Approval:** pending
