---
phase: 36
slug: voice-pass-de-slop-screen
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-08
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (packages/pipeline) + vitest (apps/dispatch-control, incl. convex-test) |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/ -x -q` / `cd apps/dispatch-control && npx vitest run` |
| **Full suite command** | both of the above + `pnpm --filter dispatch-control build` (strict type-check — vitest does not type-check) |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched package (pipeline → pytest; frontend/convex → vitest).
- **After every plan wave:** Run BOTH full suites — this phase touches pipeline (rules/judge/endpoints/signoffs) and frontend (Voice Pass screen + Convex axis).
- **Before `/gsd:verify-work`:** Both full suites green + `pnpm --filter dispatch-control build` exits 0 + the two manual checks below.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|-----------|-------------------|-------------|--------|
| §36 contract amendment | 36-01 | 1 | VOX-01, VOX-04 | grep tripwire | `grep -Eq "§36 — Voice Pass" docs/API_CONTRACTS.md && grep -q voice-recheck docs/API_CONTRACTS.md` | ✅ (edit) | ⬜ |
| machine-tell axis in Convex validators + regression | 36-01 | 1 | VOX-01, VOX-04 | convex-test | `cd apps/dispatch-control && npx vitest run __tests__/voicePassAxis.test.ts` | ❌ Wave-0 new | ⬜ |
| Layer-1 axis passthrough (remove hard-rule collapse) | 36-02 | 2 | VOX-04 | pytest | `cd packages/pipeline && uv run pytest tests/agents/qa/test_qa_axis_passthrough.py tests/agents/qa/test_rules.py -x -q` | ❌ new | ⬜ |
| Sign-off axis partition (facts-cleared narrow + sounds-human 409) | 36-02 | 2 | VOX-03 | pytest | `cd packages/pipeline && uv run pytest tests/test_signoffs_endpoints.py -x -q` | ✅ (extend) | ⬜ |
| voice-recheck endpoint (on-demand judge + dedup) | 36-03 | 2 | VOX-04 | pytest | `cd packages/pipeline && uv run pytest tests/test_voice_pass_endpoints.py -k recheck -x -q` | ❌ new | ⬜ |
| voice-rewrite endpoint (house-voice suggestion) | 36-03 | 2 | VOX-02 | pytest | `cd packages/pipeline && uv run pytest tests/test_voice_pass_endpoints.py -k rewrite -x -q` | ❌ new | ⬜ |
| accept suggestedFixOverride | 36-03 | 2 | VOX-02 | pytest | `cd packages/pipeline && uv run pytest tests/test_findings_endpoints.py -x -q` | ✅ (extend) | ⬜ |
| Promote galley components → components/galley/ | 36-04 | 3 | VOX-01 | vitest + build | `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx __tests__/AnnotationMark.test.tsx __tests__/UnresolvedFindingCard.test.tsx` | ✅ (move+extend) | ⬜ |
| Galley includeAxes filter + VOICE/FACTUAL partition | 36-04 | 3 | VOX-01 | vitest | `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx` | ✅ (extend) | ⬜ |
| /voice-pass/[runId] screen + tell count + Run deep check | 36-04 | 3 | VOX-01, VOX-04 | vitest + build | `cd apps/dispatch-control && npx vitest run __tests__/VoicePassScreen.test.tsx && pnpm --filter dispatch-control build` | ❌ new | ⬜ |
| DecisionRail + ResolvedFindingsList scoped to FACTUAL_AXES (client mirror of 36-02 server narrowing) | 36-04 | 3 | VOX-03 | vitest + build | `cd apps/dispatch-control && npx vitest run __tests__/DecisionRail.test.tsx && pnpm --filter dispatch-control build` | ✅ (extend) | ⬜ |
| AnnotationMark voice variant + rewrite-on-accept | 36-06 | 4 | VOX-02 | vitest | `cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx` | ✅ (extend) | ⬜ |
| VoicePassRail — Sounds-human sign-off (server-gated) | 36-06 | 4 | VOX-03 | vitest + build | `cd apps/dispatch-control && npx vitest run __tests__/VoicePassRail.test.tsx && pnpm --filter dispatch-control build` | ❌ new | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 / Wave 1 Requirements

The structural foundations the research confirmed (or every downstream task silently fails) land across Waves 1-2, RED-tests-first, before ANY feature/UI task:

- [x] Planned — Add `"machine-tell"` to the Convex `qaCorrections.axis` union (`convex/schema.ts` + `convex/qaCorrections.ts`) — **36-01 Task 2** (with a convex-test regression guard, since a missing literal silently drops writes via `convex_mutation_safe`). Also closes the pre-existing `structural-variety` gap.
- [x] Planned — Fix `agents/qa/__init__.py::qa()` axis-collapse so per-predicate axis survives to Convex (research Pitfall 3) — **36-02 Task 1** (RED `test_qa_axis_passthrough.py`).
- [x] Planned — Narrow the `facts-cleared` prerequisite in `api/signoffs.py` to factual axes so voice errors don't double-gate (research Pitfall 2 / Open Q1) — **36-02 Task 2** (RED in `test_signoffs_endpoints.py`).
- [x] Planned — Contract-first: `docs/API_CONTRACTS.md` §36 precedes all endpoint/schema code — **36-01 Task 1** (Wave 1, before every code plan).

Note: `wave_0_complete: false` remains until these tasks are executed and green; it flips during execution, not at plan time.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Machine-tell lighting reads over clean prose | VOX-01 | Visual judgment | Open /voice-pass for a run; confirm tells light inline, per-screen count is accurate, and the conservative lexicon doesn't over-fire on legitimate prose |
| Two independent sign-off greens | VOX-03 | Cross-screen state | Sign Facts cleared on Review Desk + Sounds human on Voice Pass; confirm both greens are required for Publish, are independent, and an open voice error blocks only Sounds human (not Facts cleared) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0/1 covers the axis-union + axis-collapse + facts-cleared-narrowing foundations (36-01, 36-02)
- [x] No watch-mode flags (all `vitest run` / `pytest`, never `--watch`)
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved (pending execution)
