---
phase: 44
slug: inspect-how-this-was-made
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
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
| INS-01 | Resolver maps all 6 artifact types (incl. `editor_gate_1`/`editor_gate1` alias, `bonus` variant, `founder_bio` sectionId round-trip) to the correct agentKey | unit | `vitest run __tests__/inspectorArtifact.test.ts` | ❌ W0 |
| INS-01 | All 6 entry points call the same `openInspector` (one panel instance, not six) | unit/integration | `vitest run __tests__/InspectorProvider.test.tsx` | ❌ W0 |
| INS-02 | Technical tab is never the default; every other tab has non-JSON content first | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ❌ W0 |
| INS-03 | Missing-inputs diff never falsely reports a supplied-but-truncated key as missing (feed >2000-char state slice, assert no false "missing") | unit | `vitest run __tests__/missingInputsDiff.test.ts` | ❌ W0 |
| INS-03 | Diff degrades honestly when an agent's declared-state-inputs constant is empty/unknown | unit | `vitest run __tests__/missingInputsDiff.test.ts` | ❌ W0 |
| INS-04 | Instructions tab renders "not externalized" (not blank/broken) for `origin_story`/`problem`/`founder_bio`/`case_study`/`qa` (no `prompt_versions` row) | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ❌ W0 |
| INS-04 | `editor_gate_1` artifact deep-links using the `editor_gate1` alias | unit | `vitest run __tests__/inspectorArtifact.test.ts` | ❌ W0 |
| INS-05 | Output tab never asserts "unchanged"/"current" without positive evidence | unit | `vitest run __tests__/outputDivergence.test.ts` | ❌ W0 |
| INS-06 | "Restart from this step" renders reserved (disabled + explanatory title), not wired to `/run/{id}/resume` | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ❌ W0 |
| INS-06 | Live footer actions (Improve this agent, Compare versions, Related tests, Prior/downstream) deep-link with the correct agentKey namespace | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — plans assign concrete Task IDs.*

---

## Wave 0 Requirements

- [ ] `apps/dispatch-control/__tests__/inspectorArtifact.test.ts` — INS-01 (resolver correctness incl. `editor_gate_1`/`editor_gate1` alias + `bonus` variant selection)
- [ ] `apps/dispatch-control/__tests__/missingInputsDiff.test.ts` — INS-03 (truncation-honesty, redefined declared-state-inputs diff)
- [ ] `apps/dispatch-control/__tests__/InspectorPanel.test.tsx` — INS-02/INS-04/INS-06 (tab defaults, degradation states, footer live-vs-reserved)
- [ ] `apps/dispatch-control/__tests__/outputDivergence.test.ts` — INS-05
- [ ] `apps/dispatch-control/__tests__/InspectorProvider.test.tsx` — one-instance / `openInspector` context contract
- [ ] Pipeline: no new file unless the `inputKeys` additive field is taken — then extend existing `packages/pipeline/tests/test_agent_wrapper.py` (already tests `savePayload` emission end-to-end), do not create a new file.

*Existing infrastructure (vitest + pytest) covers execution; the above are the missing test stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The same panel visibly opens from all six surfaces with correct artifact content | INS-01 | Cross-screen visual/interaction flow not fully assertable in jsdom | Open inspector from brief org card, draft passage, fact-check claim, voice finding, approval recommendation, My Tasks; confirm identical panel + correct artifact |
| Human-readable-first reads correctly (not just "not-JSON") | INS-02 | Readability is a judgment call | Open each tab on a real run's artifact; confirm prose/labels lead, raw JSON only on Technical |
| Missing-inputs call-out is genuinely useful on a real run | INS-03 | Usefulness of the diagnostic is qualitative | Inspect a real drafted section; confirm the missing-state-inputs list is meaningful, not noise |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test references
- [ ] No watch-mode flags (use `vitest run`, not `vitest`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (planner/executor sets when satisfied)

**Approval:** pending
