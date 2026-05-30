---
phase: 18
slug: magazine-editorial-layout-writers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `18-RESEARCH.md` `## Validation Architecture` section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (existing, `packages/pipeline/`) + vitest (existing, `apps/web/`) |
| **Config file** | `packages/pipeline/pyproject.toml` (pytest) + `apps/web/vitest.config.ts` (vitest) |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py -x -q` |
| **Full suite command (pipeline)** | `cd packages/pipeline && uv run pytest -x -q` |
| **Full suite command (web)** | `pnpm --filter web test:unit` |
| **Estimated runtime (quick)** | ~5 s |
| **Estimated runtime (pipeline full)** | ~45 s (190+ tests, Phase 16 baseline) |
| **Estimated runtime (web full)** | ~30 s (234+ tests, Phase 16 baseline) |

---

## Sampling Rate

- **After every task commit:** `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py -x -q` (quick — under 5 s)
- **After every plan wave:** `cd packages/pipeline && uv run pytest -x -q` (full pipeline) + `pnpm --filter web test:unit` (full web, when web tripwires touched)
- **Before `/gsd:verify-work`:** Full pipeline suite ≥ 200 passing + web vitest ≥ 234 passing + `18-VERIFICATION.md` HTML scan green
- **Max feedback latency:** 5 s (per-task) / 75 s (per-wave full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | MEL-01..MEL-08 contract derivation | unit (RED scaffold) | `uv run pytest tests/agents/test_writer_structural_floor.py -x` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 0 | MEL-04 QA structural axis | unit (RED scaffold) | `uv run pytest tests/agents/test_qa_structural_axis.py -x` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 0 | MEL-08 specAd-only Bonus floor | unit (RED scaffold negative) | `uv run pytest tests/agents/test_bonus_specad_only.py -x` | ❌ W0 | ⬜ pending |
| 18-02-* | 02 | 1 | MEL-01, MEL-02 helper substrate | unit | `uv run pytest tests/lib/test_portable_text_blocks.py -x` | ❌ W0 | ⬜ pending |
| 18-03-* | 03 | 2 | MEL-01, MEL-02, MEL-03 writer Pydantic + prompts | unit + integration | `uv run pytest tests/agents/test_writer_structural_floor.py tests/test_section_writer_voice_propagation.py -x` | partial | ⬜ pending |
| 18-04-* | 04 | 3 | MEL-04 QA judge axis + rubric extension | unit | `uv run pytest tests/agents/test_qa_structural_axis.py -x` | partial | ⬜ pending |
| 18-05-* | 05 | 4 | MEL-05, MEL-06, MEL-07 verification + frontend probe + cost | integration + manual | `uv run pytest -x -q && pnpm --filter web test:unit` + HTML scan + cost diff | partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan IDs assume the 5-plan structure from ROADMAP stub. Planner may renumber.*

---

## Wave 0 Requirements

- [ ] `packages/pipeline/tests/agents/test_writer_structural_floor.py` — parametrized over 5 writers (origin_story, problem, founder_bio, case_study, bonus[specAd]); covers MEL-01 (≥2 h2/h3) + MEL-02 (≥1 blockquote). RED-first; fixtures emit invalid + valid `body: list[BodyBlock]` payloads asserting Pydantic ValidationError on invalid, pass on valid.
- [ ] `packages/pipeline/tests/agents/test_qa_structural_axis.py` — asserts `JudgeFinding.axis` `Literal` includes `"structural-variety"`; asserts rubric.md contains the new axis section. Covers MEL-04.
- [ ] `packages/pipeline/tests/agents/test_bonus_specad_only.py` — negative test: `BigBudgetBonus` and `JingleBonus` Pydantic models do NOT have the structural floor validator (`body` field still accepts flat input). Covers MEL-08.
- [ ] `packages/pipeline/tests/lib/test_portable_text_blocks.py` — unit tests for `block_paragraph`, `block_h2`, `block_h3`, `block_blockquote`, `compose_section_body` helpers. Asserts each emits valid Portable Text block shape with the expected `style` field.

*(The existing test suite covers MEL-03 — `test_section_writer_voice_propagation.py` — and MEL-05 — full suite count — without new files.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live `/issue/[slug]` shows ≥2 `<h2>` + ≥1 `<blockquote>` per long-read section | MEL-06 | Requires a freshly-generated production issue (live pipeline run + Vercel deploy); cannot be done in CI | Run `/run/weekly` against production; after publish, `curl https://eisenbalm-web.vercel.app/issue/[slug]` and grep `<h2>` / `<blockquote>` counts per section. Documented in `18-VERIFICATION.md` shell-out. |
| Per-writer cost stayed ≤+15% over Phase 5 baseline | MEL-07 | Real-mode OpenRouter call required; token capture on structured-output path is approximate (Phase 5 known limitation) | Trigger one controlled real-mode pipeline run; diff `pipelineRuns.cost` per-writer USD totals against Phase 5 baseline; record in `18-VERIFICATION.md` with worst-case retry disclaimer (D-02 retry-once adds at most +1 call per writer per run). |
| Andrew UAT: reading experience qualitatively improved (the actual user-perceived payoff) | MEL-06 | Subjective; the whole point of the phase | Andrew opens a fresh issue on `eisenbalm-web.vercel.app` post-deploy, confirms each long-read no longer reads as a wall. Sign-off in `18-VERIFICATION.md`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (4 new test files identified)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 s (per-task), < 75 s (per-wave)
- [ ] `nyquist_compliant: true` set in frontmatter after all checks above

**Approval:** pending
