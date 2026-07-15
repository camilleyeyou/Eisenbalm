---
phase: 44
slug: inspect-how-this-was-made
status: gate-passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
gate_run: 2026-07-15
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 44-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (console)** | Vitest (`apps/dispatch-control`) |
| **Config file** | `apps/dispatch-control/vitest.config.ts` |
| **Framework (pipeline, only if `inputKeys` additive field is taken)** | pytest (`packages/pipeline`, `pyproject.toml` `testpaths = ["tests"]`) |
| **Quick run command** | `pnpm --filter dispatch-control test -- __tests__/<file>.test.ts` |
| **Full suite command** | `pnpm --filter dispatch-control test` (= `vitest run`) |
| **Pipeline quick run (if schema change taken)** | `cd packages/pipeline && pytest tests/test_agent_wrapper.py -x` |
| **Estimated runtime** | Console full suite ~30–60s; single file <5s |

---

## Sampling Rate

- **After every task commit:** Run the relevant single test file from the Per-Task map below.
- **After every plan wave:** Run `pnpm --filter dispatch-control test` (full console suite — must stay green across prior-phase tripwires: `claimProvenance.test.ts`, `sectionIdMap.test.ts`, `derivedState.test.ts`).
- **Before `/gsd:verify-work`:** Full console suite green, plus `cd packages/pipeline && pytest tests/test_agent_wrapper.py` green **if** the `inputKeys` schema change is taken.
- **Max feedback latency:** ~60 seconds (full console suite).

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| INS-01 | Resolver maps all 6 artifact types (incl. `editor_gate_1`/`editor_gate1` alias, `bonus` variant, `founder_bio` sectionId round-trip) to the correct agentKey | unit | `vitest run __tests__/inspectorArtifact.test.ts` | ✅ green |
| INS-01 | All 6 entry points call the same `openInspector` (one panel instance, not six) | unit/integration | `vitest run __tests__/InspectorProvider.test.tsx` | ✅ green |
| INS-02 | Technical tab is never the default; every other tab has non-JSON content first | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ✅ green |
| INS-03 | Missing-inputs diff never falsely reports a supplied-but-truncated key as missing (feed >2000-char state slice, assert no false "missing") | unit | `vitest run __tests__/missingInputsDiff.test.ts` | ✅ green |
| INS-03 | Diff degrades honestly when an agent's declared-state-inputs constant is empty/unknown | unit | `vitest run __tests__/missingInputsDiff.test.ts` | ✅ green |
| INS-04 | Instructions tab renders "not externalized" (not blank/broken) for `origin_story`/`problem`/`founder_bio`/`case_study`/`qa` (no `prompt_versions` row) | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ✅ green |
| INS-04 | `editor_gate_1` artifact deep-links using the `editor_gate1` alias | unit | `vitest run __tests__/inspectorArtifact.test.ts` | ✅ green |
| INS-05 | Output tab never asserts "unchanged"/"current" without positive evidence | unit | `vitest run __tests__/outputDivergence.test.ts` | ✅ green |
| INS-06 | "Restart from this step" renders reserved (disabled + explanatory title), not wired to `/run/{id}/resume` | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ✅ green |
| INS-06 | Live footer actions (Improve this agent, Compare versions, Related tests, Prior/downstream) deep-link with the correct agentKey namespace | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ✅ green |
| INS-01..06 | Whole-phase integration gate (full console suite + strict build + Convex `dev:once` sync + pipeline pytest) | integration gate | see Integration Gate Results below | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — plans assign concrete Task IDs.*

---

## Integration Gate Results (44-09, run 2026-07-15)

| Command | Result | Notes |
|---------|--------|-------|
| `pnpm --filter dispatch-control test` | ✅ exit 0 | 96 test files passed, 1 intentionally skipped (`workspace-upsert.test.ts`, pre-existing/unrelated); 834 tests passed, 2 todo (both in `workspace-upsert.test.ts`, pre-existing/unrelated). Includes all five Wave-0 inspector files: `inspectorArtifact.test.ts` (13), `missingInputsDiff.test.ts` (8), `InspectorPanel.test.tsx` (9), `InspectorProvider.test.tsx` (4), `outputDivergence.test.ts` (5) — zero `it.todo` remaining across all five (confirmed via grep). All prior-phase tripwires green: `claimProvenance.test.ts` (7), `sectionIdMap.test.ts` (18), `derivedState.test.ts` (58), `dispatch-control-no-sanity-write.test.ts` (2). |
| `pnpm --filter dispatch-control build` | ✅ exit 0 | Strict production build (Next.js 15.5.18), 31 routes generated, zero type errors. |
| `pnpm --filter @eisenbalm/convex dev:once` | ✅ exit 0 | "Convex functions ready!" against dev:modest-magpie-797. The additive `agent_run_payloads.inputKeys: v.optional(v.array(v.string()))` field (§44.5) confirmed live in `convex/schema.ts` post-sync, no schema-push error. |
| `cd packages/pipeline && ./.venv/bin/python -m pytest tests/test_agent_wrapper.py -x` | ✅ exit 0 | 6 passed — the `inputKeys` emission (`_snapshot_input()`, computed before `_truncate()`) + truncation-honesty coverage. |
| `cd packages/pipeline && ./.venv/bin/python -m pytest -q` (full pipeline suite, scope check) | ✅ exit 0 | 582 passed, 36 skipped (pre-existing skip markers, unrelated) — no regression introduced by the Phase 44 `inputKeys` schema/wrapper change. |
| `dispatch-control-no-sanity-write.test.ts` (within the full suite run) | ✅ green | Read-only boundary intact — the inspector introduced zero `@sanity/client` imports, zero `createClient()` calls, zero `@sanity/*` package.json entries. |

**Verdict:** Zero Phase-44-attributable automated failures. The full console suite, the strict Next build, the pipeline pytest (both scoped and full), and the Convex `inputKeys` sync are all green.

---

## Wave 0 Requirements

- [x] `apps/dispatch-control/__tests__/inspectorArtifact.test.ts` — INS-01 (resolver correctness incl. `editor_gate_1`/`editor_gate1` alias + `bonus` variant selection)
- [x] `apps/dispatch-control/__tests__/missingInputsDiff.test.ts` — INS-03 (truncation-honesty, redefined declared-state-inputs diff)
- [x] `apps/dispatch-control/__tests__/InspectorPanel.test.tsx` — INS-02/INS-04/INS-06 (tab defaults, degradation states, footer live-vs-reserved)
- [x] `apps/dispatch-control/__tests__/outputDivergence.test.ts` — INS-05
- [x] `apps/dispatch-control/__tests__/InspectorProvider.test.tsx` — one-instance / `openInspector` context contract
- [x] Pipeline: the `inputKeys` additive field was taken — extended existing `packages/pipeline/tests/test_agent_wrapper.py` (already tests `savePayload` emission end-to-end), no new file created.

*Existing infrastructure (vitest + pytest) covers execution; the above are the missing test stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The same panel visibly opens from all six surfaces with correct artifact content | INS-01 | Cross-screen visual/interaction flow not fully assertable in jsdom | Open inspector from brief org card, draft passage, fact-check claim, voice finding, approval recommendation, My Tasks; confirm identical panel + correct artifact |
| Human-readable-first reads correctly (not just "not-JSON") | INS-02 | Readability is a judgment call | Open each tab on a real run's artifact; confirm prose/labels lead, raw JSON only on Technical |
| Missing-inputs call-out is genuinely useful on a real run | INS-03 | Usefulness of the diagnostic is qualitative | Inspect a real drafted section; confirm the missing-state-inputs list is meaningful, not noise |
| Footer actions render live vs. reserved correctly on a real run | INS-06 | Requires a resolved artifact + real prompt-lab navigation | Confirm "Improve this agent →" deep-links correctly when `promptKey !== null`; confirm "Restart from this step"/"Ask agent to revise" render reserved on every artifact type |

*Persisted as pending UAT items — see `44-UAT.md` (status: partial, 4 items pending a live operator session).*

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING test references
- [x] No watch-mode flags (use `vitest run`, not `vitest`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter (planner/executor sets when satisfied)

**Approval:** Automated gate green (2026-07-15) — full console suite (834 tests) + strict build + Convex `dev:once` sync + pipeline pytest (582 tests) all pass. The four Manual-Only rows above (six-surface panel identity; human-readable-first tabs; missing-inputs call-out usefulness; footer live-vs-reserved) are pending human verification — see `44-09-integration-gate-PLAN.md` Task 2 checkpoint and `44-UAT.md`.
