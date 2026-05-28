---
phase: 16
slug: choose-your-narrator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 16-RESEARCH.md §Validation Architecture (verified against existing pytest + vitest infrastructure).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | pytest 7.x (pipeline) + Vitest (web) |
| **Pipeline config file** | `packages/pipeline/pyproject.toml` (pytest section) |
| **Web config file** | `apps/web/vitest.config.ts` |
| **Pipeline quick run** | `uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q` |
| **Pipeline full suite** | `uv run --project packages/pipeline pytest packages/pipeline/tests/ -v` |
| **Web quick run** | `pnpm --filter web test:unit` |
| **Web full suite** | `pnpm --filter web test:unit && pnpm --filter web build` |
| **Estimated runtime** | pipeline ~30s, web ~45s (quick); ~2 min each (full) |

---

## Sampling Rate

- **After every task commit:** Run pipeline quick (`uv run … pytest -x -q`) AND web quick (`pnpm … test:unit`) — both must exit 0.
- **After every plan wave:** Run pipeline full suite + web full suite — both must exit 0.
- **Before `/gsd:verify-work`:** Both full suites green, narrator-chip tripwire green, byte-equivalence invariants green.
- **Max feedback latency:** ~75 seconds (per-task quick run of both stacks).

---

## Per-Task Verification Map

> Task IDs (`16-NN-NN`) will be assigned by `/gsd:plan-phase` when PLAN.md files are created.
> This table establishes the required test coverage per NRR-* requirement — every plan task
> MUST map to one or more rows below before the plan-checker passes.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | NRR-03, NRR-10 | unit | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py::test_voice_constants_byte_equivalence` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | NRR-03, NRR-10 | unit | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py::test_jesse_explicit_narrator_byte_equivalence` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | NRR-09 | cross-lang unit | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_narrator_seed_sentinel.py` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | NRR-10 (cost ≤10%) | unit | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_narrator_cost_budget.py` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | NRR-02, NRR-08 | source-scan + DOM | `pnpm --filter web test:unit -- narrator-chip.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | NRR-01 | schema compile | `pnpm --filter @eisenbalm/studio typegen` (zero errors) + presence of `NarratorProfile` in `apps/studio/sanity.types.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | NRR-02 | source-scan | grep for `narrator` field in `apps/studio/schemas/weeklyIssue.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | NRR-03 (Calibrator) | unit | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | NRR-04 (4 writers) | unit | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_section_writer_voice_propagation.py` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | NRR-05 (Chronicler) | unit | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler.py::test_narrator_voice_propagation` | ❌ W0 (extend existing) | ⬜ pending |
| TBD | TBD | 1+ | NRR-06 (QA rubric) | unit | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | NRR-08 (frontend chip) | DOM + source-scan | `pnpm --filter web test:unit -- narrator-chip.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | NRR-09 (seed) | manual + automated | `pnpm seed:narrators` (idempotent createOrReplace) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | NRR-10 (tripwires) | all existing | `pnpm --filter web test:unit && uv run --project packages/pipeline pytest` | ✅ existing | ⬜ pending |
| TBD | TBD | 1+ | NRR-10 (inactive warning) | unit | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py::test_inactive_narrator_falls_back_to_jesse_with_warning` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All of the following MUST exist before any implementation task in Wave 1+ begins:

- [ ] **`docs/API_CONTRACTS.md §7`** — `DispatchState` extended with `narrator: NotRequired[Optional[dict]]`. Hard rule per CLAUDE.md: contract MUST be updated BEFORE any pipeline code touches the field.
- [ ] **`docs/API_CONTRACTS.md §1.2`** — `QUERY_ISSUE_BY_SLUG` GROQ updated with `narrator->{name, slug, active}` projection (only these 3 fields — no voiceConstraints/voiceRubric/exampleSamples leak).
- [ ] **`docs/API_CONTRACTS.md §2.2`** — confirm `weeklyIssue` Python write path does NOT add `narrator` (editorial-only field set in Studio).
- [ ] **`apps/studio/schemas/narratorProfile.ts`** — schema file (NRR-01).
- [ ] **`apps/studio/schemas/index.ts`** — register `narratorProfile` in `schemaTypes` export.
- [ ] **`apps/studio/scripts/seed-narrators.ts` + `apps/studio/seeds/narrators.json`** — seed script + data (3 narrators: jesse, maya-rudolph, werner-herzog).
- [ ] **`packages/pipeline/tests/test_voice.py`** — byte-equivalence invariants (`test_voice_constants_byte_equivalence`, `test_jesse_explicit_narrator_byte_equivalence`). RED-first.
- [ ] **`packages/pipeline/tests/test_narrator_seed_sentinel.py`** — cross-language Jesse voiceConstraints check against narrators.json. RED-first.
- [ ] **`packages/pipeline/tests/test_narrator_cost_budget.py`** — token count ratio assertion (≤10% delta NRR-10 criterion 7). RED-first.
- [ ] **`packages/pipeline/tests/test_calibrator_narrator.py`** — Calibrator merges narrator into StyleBrief; inactive narrator fallback + warning event. RED-first.
- [ ] **`packages/pipeline/tests/test_section_writer_voice_propagation.py`** — 4 narrative writers pass `voice_constraints=style_brief["voice"]` kwarg. RED-first.
- [ ] **`packages/pipeline/tests/test_qa_judge_narrator.py`** — QA judge layers narrator.voiceRubric + exampleSamples at call time. RED-first.
- [ ] **`apps/web/__tests__/narrator-chip.test.ts`** — chip presence/absence/copy + source-scan no-leak. RED-first.
- [ ] **Extend `packages/pipeline/tests/test_chronicler.py`** — add `test_narrator_voice_propagation` (chronicler reads `style_brief["voice"]`, NOT direct `VOICE_CONSTRAINTS` import).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Studio narrator dropdown renders + `exampleSamples` preview is visible | NRR-07 | Sanity Studio UX surface — not unit-testable | Andrew opens a `weeklyIssue` draft in Studio; confirms narrator picker shows 3 seeded profiles; clicking opens a preview affordance showing exampleSamples; choosing one and saving persists `narrator._ref`. Captured in `16-HUMAN-UAT.md`. |
| Herzog-narrator issue reads as Herzog (not Jesse-in-disguise) | NRR-04 + Success Criterion 1 | Voice judgment is human-only above a QA score | Andrew runs the pipeline with `narrator = werner-herzog`; reads Origin Story / Problem / Founder Bio / Case Study aloud; confirms it sounds like Herzog. Sample bar: client-supplied Werner Herzog sample for The Nap Ministry in [.planning/phases/16-choose-your-narrator/16-INTENT.md](.planning/phases/16-choose-your-narrator/16-INTENT.md). Captured in `16-HUMAN-UAT.md`. |
| Frontend narrator chip visual + placement on `IssueHero` | NRR-08 + Success Criterion 5 | Visual regression is human-only | Andrew loads a published issue with narrator set; confirms chip reads "Narrated by Werner Herzog" under the issue title, above publish date, in Inter uppercase 0.18em on `--color-text-mute`. No chip on Jesse-default issues. Captured in `16-HUMAN-UAT.md`. |
| Inactive narrator silently falls back + Convex warning event surfaces in deliberation log | NRR-10 (D-14) | Convex live-event visual surface | Andrew sets a narrator profile `active: false`, references it on a draft issue, triggers a pipeline run; confirms run completes with Jesse voice + Convex `pipelineRuns` shows a `editor-decision` event with `warning` payload. Captured in `16-HUMAN-UAT.md`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (PLAN.md tasks pending)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (✓ all 14 W0 gaps listed above)
- [ ] No watch-mode flags in test commands (✓ all use `-x -q` or default run)
- [ ] Feedback latency < 75s (✓ pipeline quick ~15s + web quick ~30s = ~45s)
- [ ] `nyquist_compliant: true` set in frontmatter (pending PLAN.md creation)

**Approval:** pending — Task IDs assigned by `/gsd:plan-phase`; revisit after PLAN.md creation to verify task-to-requirement coverage.
