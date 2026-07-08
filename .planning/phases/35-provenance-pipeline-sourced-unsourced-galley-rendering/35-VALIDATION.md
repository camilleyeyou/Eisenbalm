---
phase: 35
slug: provenance-pipeline-sourced-unsourced-galley-rendering
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-08
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (packages/pipeline) + vitest (apps/dispatch-control) |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/ -x -q` / `cd apps/dispatch-control && npx vitest run` |
| **Full suite command** | both of the above + `pnpm --filter dispatch-control build` (strict type-check — vitest does not type-check) |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched package (pipeline → pytest; frontend → vitest).
- **After every plan wave:** Run BOTH full suites (`uv run pytest -x -q` AND `npx vitest run`) — this phase touches both layers in almost every wave.
- **Before `/gsd:verify-work`:** Both full suites green + `pnpm --filter dispatch-control build` exits 0 + the manual wash/underline overlap check.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T1 contract §35/§26.2 | 01 | 1 | PRV-01..04 | doc grep | `grep -n "claimSpans\|sourceIndex" docs/API_CONTRACTS.md` | ✅ existing | ⬜ |
| 01-T2 convex schema + insertBatch + codegen | 01 | 1 | PRV-01..04 | build | `pnpm --filter @eisenbalm/convex exec convex codegen && pnpm --filter dispatch-control build` | ✅ existing | ⬜ |
| 02-T1 RED researcher tests | 02 | 2 | PRV-01 | unit | `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py -x -q` | ✅ extend | ⬜ |
| 02-T2 claims model + mapping | 02 | 2 | PRV-01 | unit | `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py -x -q` | ✅ | ⬜ |
| 02-T3 prompt S-index | 02 | 2 | PRV-01 | unit | `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py tests/test_pipeline_real_mode.py -x -q` | ✅ | ⬜ |
| 03-T1 RED writer tests | 03 | 2 | PRV-02 | unit | `cd packages/pipeline && uv run pytest tests/agents/test_origin_story.py -x -q` | ✅ extend | ⬜ |
| 03-T2 ClaimSpanRef + prompt inject | 03 | 2 | PRV-02 | unit | `cd packages/pipeline && uv run pytest tests/test_voice.py tests/test_section_writer_voice_propagation.py -x -q` | ✅ | ⬜ |
| 03-T3 5 writers claimSpans | 03 | 2 | PRV-02 | unit | `cd packages/pipeline && uv run pytest tests/agents/test_{origin_story,problem,founder_bio,case_study,bonus}.py tests/test_writer_structural_floor.py -x -q` | ✅ | ⬜ |
| 04-T1 RED publisher/extractor tests | 04 | 3 | PRV-02/04 | unit | `cd packages/pipeline && uv run pytest tests/agents/test_claim_block_index_hint.py tests/test_claims_extractor.py -x -q` | ❌ NEW `tests/agents/test_claim_block_index_hint.py` | ⬜ |
| 04-T2 per-block extractor + hint | 04 | 3 | PRV-02/04 | unit | `cd packages/pipeline && uv run pytest tests/agents/test_claim_block_index_hint.py tests/test_claims_extractor.py -x -q` | ✅ | ⬜ |
| 04-T3 publisher seeding | 04 | 3 | PRV-02/04 | integration | `cd packages/pipeline && uv run pytest tests/agents/publisher/test_publisher.py -x -q` | ✅ extend | ⬜ |
| 05-T1 RED galley tests | 05 | 2 | PRV-03 | unit (vitest) | `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx __tests__/claimProvenance.test.ts` | ❌ NEW `__tests__/claimProvenance.test.ts` | ⬜ |
| 05-T2 claimSpan marks + ClaimMark + CSS | 05 | 2 | PRV-03 | unit (vitest) | `cd apps/dispatch-control && npx vitest run __tests__/claimProvenance.test.ts __tests__/syntheticPortableText.test.ts` | ✅ | ⬜ |
| 05-T3 Galley wiring + toggle | 05 | 2 | PRV-03 | unit + build | `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx && pnpm --filter dispatch-control build` | ✅ | ⬜ |
| 06-T1 RED rail tests | 06 | 2 | PRV-04 | unit (vitest) | `cd apps/dispatch-control && npx vitest run __tests__/DecisionRail.test.tsx` | ✅ extend | ⬜ |
| 06-T2 SourceIndex + mount | 06 | 2 | PRV-04 | unit + build | `cd apps/dispatch-control && npx vitest run __tests__/DecisionRail.test.tsx && pnpm --filter dispatch-control build` | ✅ | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave-0 RED test authoring is embedded as the first task of each code-producing plan (task-level TDD `tdd="true"` with `<behavior>`), rather than a standalone plan. The NEW test files that must be created (do not exist yet):

- [ ] `packages/pipeline/tests/agents/test_claim_block_index_hint.py` (Plan 04-T1) — flat BodyBlock `{type,text}` shape, NOT `children` (Research Pitfall 1).
- [ ] `apps/dispatch-control/__tests__/claimProvenance.test.ts` (Plan 05-T1) — claim-span resolution + wash mark-stacking + legacy-row safety.

Extended existing files (RED assertions added first): `tests/agents/test_researcher.py`, the 5 writer tests, `tests/test_claims_extractor.py`, `tests/agents/publisher/test_publisher.py`, `__tests__/Galley.test.tsx`, `__tests__/DecisionRail.test.tsx`.

Signoff-non-revocation (D-08/D-12, Research Pitfall 10) is guaranteed by construction (setStatus is a Convex mutation, not in the FastAPI revoke list); Plan 06 covers it via the facts-cleared-gate-untouched acceptance criterion rather than a dedicated pipeline test.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wash vs underline visual coexistence | PRV-03 | CSS layering is visual (Research Open Q3) | Open a galley with a QA error finding overlapping a marigold/rust claim wash; confirm underline-over-wash reads and the two rust backgrounds (error tint + unsourced wash) don't read as muddy. 10-min check, note result in verification. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 RED-first task creating the referenced file
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers the two MISSING/new test files (test_claim_block_index_hint.py, claimProvenance.test.ts)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner)
