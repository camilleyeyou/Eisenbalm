---
phase: 44-inspect-how-this-was-made
verified: 2026-07-15T21:52:19Z
status: human_needed
score: 6/6 must-haves verified (automated); 4 items pending live human verification (already tracked in 44-UAT.md)
human_verification: # carried forward from 44-UAT.md — not automated failures, no gaps recorded
  - test: "Open the inspector from all six surfaces (brief org card, draft passage finding/section header, fact-check claim, voice finding, approval recommendation, My Tasks 'Inspect context') on a real run and confirm it is the SAME panel each time with the correct resolved artifact."
    expected: "Identical InspectorPanel component mounts each time; artifact content matches the surface (org/scout, founder, claim/researcher, founder, rec/editor_final, and the deep-linked artifact respectively); the two sign-off task rows in My Tasks stay reserved/disabled (no insp key)."
    why_human: "Cross-screen visual/interaction identity and live-session navigation cannot be asserted in jsdom."
  - test: "On each of the seven tabs, confirm human-readable prose/labels lead and raw JSON only appears on Technical."
    expected: "No tab other than Technical ever shows raw JSON as the leading content; Technical is reached only by explicit operator click."
    why_human: "Readability is a qualitative judgment call."
  - test: "Inspect a real drafted section on a live run and read the 'Missing expected inputs' call-out."
    expected: "The call-out lists real, meaningful DECLARED_STATE_INPUTS names with glosses (or explicitly states all supplied) — never every declared variable flagged regardless of what was actually supplied (the Pitfall-1 failure mode)."
    why_human: "Diagnostic usefulness on real production data is qualitative; unit tests already prove the diff algorithm is correct against synthetic fixtures."
  - test: "On a resolved artifact with a non-null promptKey, confirm 'Improve this agent →' deep-links to the correct prompt-lab page; confirm 'Restart from this step' and 'Ask agent to revise' render visibly reserved/disabled with explanatory titles on every artifact type."
    expected: "Live navigation succeeds; reserved controls are visually distinguishable (not silently missing, not accidentally wired)."
    why_human: "Live routing + visual affordance state; unit tests already assert the href/disabled/title attributes in jsdom."
---

# Phase 44: Inspect How This Was Made Verification Report

**Phase Goal:** One universal 7-tab inspector panel is reachable from six places in the product, surfacing the missing-expected-input diff as the single highest-leverage diagnostic in the design.

**Verified:** 2026-07-15T21:52:19Z
**Status:** human_needed (all automated checks pass; 4 cross-surface behaviors already tracked as pending in 44-UAT.md per the phase's own integration gate — not new gaps)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Same inspector panel opens from all six surfaces (INS-01) | VERIFIED (code) / pending (live visual) | Exactly one `<InspectorProvider>` mounted at `app/(dashboard)/layout.tsx`; all six call sites use the same `useInspector().openInspector` — `StoryPanelContent.tsx` (org), `ReviewDeskRunView.tsx`→`Galley`→`AnnotationMark` (draft passage, founder), `VoicePassRunView.tsx`→`AnnotationMark` (voice finding, founder), `FactCheckScreen.tsx` (claim), `DecisionRail.tsx` mounted by both `review-desk` and `issues/[n]/approval/ApprovalStage.tsx` (rec), `MyTasksScreen.tsx` (insp-key driven). `InspectorProvider.test.tsx` proves exactly one panel instance renders regardless of caller count. Live cross-surface visual confirmation is UAT item 1 (pending). |
| 2 | Seven tabs, human-readable first, raw JSON never default (INS-02) | VERIFIED | `InspectorPanel.tsx` defines `TABS = [Summary, Inputs, Instructions, Output, Sources, Diagnostics, Technical]`; `useState<Tab>('Summary')` is the sole initial value; Technical is the only tab rendering `prettyJson`. `InspectorPanel.test.tsx` asserts Summary has `aria-current=page` on mount, Technical does not, and the raw-JSON marker is absent until Technical is clicked. |
| 3 | Inputs tab calls out missing expected inputs using the redefined vocabulary, truncation-honest (INS-03) | VERIFIED | `lib/inspector/missingInputsDiff.ts` imports `DECLARED_STATE_INPUTS` (a verbatim TS port of `agent_wrapper.py::_INPUT_KEYS`) and only `VARIABLE_DESCRIPTIONS` for glosses — grep confirms zero import of `VARIABLE_REGISTRY`. `computeMissingInputs` prefers the additive `agent_run_payloads.inputKeys` field (schema line 370, `convex/schema.ts`), falls back to parsing `inputSnapshot` with an explicit "approximate — snapshot truncated" note, and never asserts a definitive "missing" when truncation could have hidden the key (verified via 8 passing tests in `missingInputsDiff.test.ts`, incl. the truncated-snapshot case). `agent_wrapper.py::_snapshot_input_keys()` computes the untruncated key list independently of `_truncate()` and is emitted in the same `savePayload` mutation (`agent_wrapper.py:193-195`); `pytest tests/test_agent_wrapper.py -x` green (6 passed). |
| 4 | Instructions tab shows active version + shared rules + "Improve this agent" link, never a dishonest blank (INS-04) | VERIFIED | `InspectorContainer.tsx` maps `promptVersion.version → instructionVersion` / `promptVersion.content → instructions` for the 11 externalized agents, and assembles `sharedRules` from `NON_EXTERNALIZED_SHARED_RULES` (`origin_story`/`problem`/`founder_bio`/`case_study` → `['VOICE_CONSTRAINTS','STRUCTURE_CONTRACT']`, `qa` → fetched `rubric` active version) for the 5 code-defined agents. `InspectorPanel.tsx`'s `InstructionsTab` renders the "code-defined, not editable here" state FOLLOWED BY `SharedRulesBlock` — never a bare one-liner — and renders real active-version content + version number for externalized agents. `InspectorPanel.test.tsx` asserts both branches with real content assertions (not just presence checks). |
| 5 | Output tab shows full output + divergence note, never falsely "unchanged" (INS-05) | VERIFIED | `lib/inspector/outputDivergence.ts::computeOutputDivergence` returns `'diverged' \| 'unchanged' \| 'unknown'`; the default fall-through (no positive evidence) is `'unknown'`, and `'unchanged'` is only returned when `hasChangeAudit === true` with a completedAt boundary — it is structurally impossible to reach `'unchanged'` from silent/absent inputs. 5 passing tests in `outputDivergence.test.ts` confirm this, including the no-evidence → 'unknown' case. |
| 6 | Footer offers all six actions on every artifact type (INS-06) | VERIFIED | `InspectorFooter.tsx` always renders all six actions: 4 live-capable (`Improve this agent →`, `Compare instruction versions`, `Related quality tests` — all gated on `promptKey !== null`; `Prior & downstream steps` — always live via `/run-monitor/graph`) and 2 permanently reserved (`Ask agent to revise` — "Arrives in Phase 45"; `Restart from this step` — Gate-1-only resume rationale documented in both the component header and §44.7). `InspectorPanel.test.tsx` asserts disabled state + title text for both reserved controls and the correct `editor_gate1` (not `editor_gate_1`) promptKey namespace on the live link href. |

**Score:** 6/6 truths verified by code + automated tests. Cross-surface *visual* confirmation is explicitly deferred to a live operator session (UAT item 1), consistent with the phase's own integration gate design.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/API_CONTRACTS.md` §44 | Contract for InspectorArtifact shape, resolver, redefined diff, footer table, shared-rules map | VERIFIED | 9 subsections present (§44.1–§44.9 + §44.RECONCILIATION), all grep acceptance criteria from 44-01's plan satisfied (`DECLARED_STATE_INPUTS`, `runKeyToPromptKey`, `inputKeys`, `NON_EXTERNALIZED_SHARED_RULES`, `editor_gate1`/`editor_gate_1`, `instructionVersion`/`promptVersion`). |
| `apps/dispatch-control/lib/inspectorArtifact.ts` | Pure artifact→step resolver, `encodeArtifactKey`/`parseArtifactKey` | VERIFIED | 6 artifact types resolved; `editor_gate_1 → editor_gate1` alias; bonus-variant selection; honest `degraded: true` for unresolvable/unbuilt (signal) steps; reuses `sectionIdMap.ts` (no second table). 13 passing tests. |
| `apps/dispatch-control/lib/inspector/declaredStateInputs.ts` | Verbatim TS port of `_INPUT_KEYS` | VERIFIED | 18-agent map matches `agent_wrapper.py::_INPUT_KEYS` field-for-field (spot-checked). |
| `apps/dispatch-control/lib/inspector/missingInputsDiff.ts` | Redefined, truncation-honest diff | VERIFIED | Does NOT import `VARIABLE_REGISTRY`; imports `DECLARED_STATE_INPUTS` + `VARIABLE_DESCRIPTIONS` only. 8 passing tests. |
| `apps/dispatch-control/lib/inspector/outputDivergence.ts` | 'diverged'\|'unchanged'\|'unknown' predicate | VERIFIED | Default branch is `'unknown'`; 5 passing tests. |
| `apps/dispatch-control/components/inspector/InspectorPanel.tsx` | 7-tab pure presentation component | VERIFIED | All 7 tabs, Summary default, Instructions honesty logic, Diagnostics "not recorded" model field. 9 passing tests. |
| `apps/dispatch-control/components/inspector/InspectorFooter.tsx` | 6 footer actions, live-vs-reserved | VERIFIED | All 6 actions always rendered; reserved controls carry explanatory `title`. |
| `apps/dispatch-control/components/inspector/InspectorProvider.tsx` | Single context, one panel instance | VERIFIED | `activeKey` singleton state; `InspectorContainer` mounted only when non-null. 4 passing tests. |
| `apps/dispatch-control/components/inspector/InspectorContainer.tsx` | Data-fetching assembly layer | VERIFIED | Maps `promptVersion` fields, assembles `sharedRules`, computes diff + divergence, never throws on absent rows. |
| `app/(dashboard)/layout.tsx` | Single `<InspectorProvider>` mount point | VERIFIED | Wraps all `(dashboard)` routes including `/my-tasks`. |
| `convex/schema.ts` `agent_run_payloads.inputKeys` | Additive-optional untruncated key list | VERIFIED | `v.optional(v.array(v.string()))` at line 370; confirmed live via `dev:once` sync per 44-VALIDATION.md Integration Gate Results. |
| `packages/pipeline/.../agent_wrapper.py` `_snapshot_input_keys` | Computed pre-truncation | VERIFIED | Independent of `_snapshot_input()`'s truncated string; emitted in the same `savePayload` call. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Six entry-point components | `InspectorProvider.openInspector` | `useInspector()` hook call | WIRED | Confirmed via grep across all 6 files; matches the resolved artifact type expected at each surface (org/founder/claim/founder/rec/insp-key). |
| `InspectorProvider` | `InspectorContainer` | conditional mount on `activeKey !== null` | WIRED | Single mount point, no duplicate provider found anywhere else in the app tree. |
| `InspectorContainer` | Convex (`agentRuns.byRunId`, `agentRuns.payloadByRunIdAgentKey`, `promptVersions.getActive`) | `useQuery` (non-subscribed on-demand pattern) | WIRED | All three query functions exist and are exported; container never throws on undefined/null results. |
| `missingInputsDiff.ts` | `agent_run_payloads.inputKeys` / `inputSnapshot` | `computeMissingInputs(agentKey, payload?.inputKeys, payload?.inputSnapshot)` | WIRED | Confirmed in `InspectorContainer.tsx` line 122. |
| `MyTasksScreen`/`derivedState.ts` | `insp` artifact key | `encodeArtifactKey` for qa-finding + claim tasks only | WIRED | Sign-off rows deliberately omit `insp` (stays reserved); qa/claim rows populate it. |
| `InspectorFooter` | `/prompt-lab/${promptKey}` | `Link href` when `promptKey !== null` | WIRED | Uses the resolved promptKey namespace (`editor_gate1`, not `editor_gate_1`) — test-asserted. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `InspectorArtifact.missing` (Inputs tab) | `computeMissingInputs()` result | `agent_run_payloads.inputKeys` (real Convex query row) with fallback to `inputSnapshot` parse | Yes — live Convex query, not a static stub | FLOWING |
| `InspectorArtifact.instructions`/`instructionVersion` | `promptVersion` | `api.promptVersions.getActive` (real Convex query, `'skip'`-gated when `promptKey === null`) | Yes | FLOWING |
| `InspectorArtifact.sharedRules` (qa) | `rubricVersion.content` | second `api.promptVersions.getActive({agentKey:'rubric',...})` query | Yes | FLOWING |
| `InspectorArtifact.output`/`json` | `agentRun`/`payload` | `api.agentRuns.byRunId` + `api.agentRuns.payloadByRunIdAgentKey` | Yes | FLOWING |

No hardcoded-empty props found at any of the six call sites (all pass a real `runId`/`locator` derived from live component state, never a literal `[]`/`{}`/`''`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Inspector Wave-0→live test suite (39 tests across 5 inspector files) | `pnpm --filter dispatch-control test -- --run __tests__/{inspectorArtifact,missingInputsDiff,outputDivergence,InspectorPanel,InspectorProvider}.test.{ts,tsx}` | 39/39 passed | PASS |
| Full console suite regression | `pnpm --filter dispatch-control test` | 96 files, 834 tests passed, 1 pre-existing skip, 2 pre-existing unrelated todos (`workspace-upsert.test.ts`) | PASS |
| Strict Next build | `pnpm --filter dispatch-control build` | Compiled successfully, 31 routes, zero type errors | PASS |
| Pipeline `inputKeys` emission | `packages/pipeline/.venv/bin/python -m pytest tests/test_agent_wrapper.py -x` | 6/6 passed | PASS |
| No-Sanity-write tripwire | `vitest run __tests__/dispatch-control-no-sanity-write.test.ts` | 2/2 passed | PASS |
| Zero `it.todo` remaining in inspector test files | `grep -rc "it.todo" __tests__/{inspectorArtifact,missingInputsDiff,outputDivergence,InspectorPanel,InspectorProvider}.test.{ts,tsx}` | all return 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| INS-01 | 44-01, 44-03, 44-06, 44-07, 44-08 | One inspector reachable from six surfaces | SATISFIED | Single `InspectorProvider` at dashboard root layout; 6 grep-confirmed `openInspector` call sites matching each named surface; `InspectorProvider.test.tsx` proves single-instance invariant. |
| INS-02 | 44-01, 44-05 | Seven tabs, human-readable first, no default raw JSON | SATISFIED | `InspectorPanel.tsx` TABS array + `useState('Summary')`; `InspectorPanel.test.tsx` tab-default assertions. |
| INS-03 | 44-01, 44-02, 44-04 | Inputs tab missing-expected-input diff, redefined vocabulary, truncation-honest | SATISFIED | `missingInputsDiff.ts` confirmed NOT importing `VARIABLE_REGISTRY`; `inputKeys` additive field live in schema + emitted pre-truncation in `agent_wrapper.py`. |
| INS-04 | 44-01, 44-03, 44-05, 44-06 | Instructions tab: active version + shared rules + link, never dishonest blank | SATISFIED | `NON_EXTERNALIZED_SHARED_RULES` map in `InspectorContainer.tsx`; `promptVersion.version/content` mapping; both branches rendered + tested. |
| INS-05 | 44-04, 44-05 | Output tab full output + divergence note, never falsely "unchanged" | SATISFIED | `outputDivergence.ts` structurally cannot return `'unchanged'` from silence (default is `'unknown'`); 5 passing tests. |
| INS-06 | 44-05 | Footer offers all six actions on every artifact type | SATISFIED | `InspectorFooter.tsx` always renders all 6; reserved controls carry explanatory titles; live links gated on `promptKey`. |

**Note (bookkeeping only, not a functional gap):** `.planning/REQUIREMENTS.md`'s summary table (near line 826) still lists INS-01..INS-06 as "Planned" even though the phase's own top-of-file checklist (line 379-384) already marks all six `[x]` and ROADMAP.md marks Phase 44 complete. This is the documented multi-milestone ROADMAP.md/REQUIREMENTS.md sync quirk (see MEMORY "Roadmap multi-milestone CLI quirk") — a stale summary-table row, not evidence of unmet requirements. No orphaned requirements were found: all six IDs referenced in REQUIREMENTS.md map to plans that declare them in frontmatter, and all are satisfied by code.

### Anti-Patterns Found

None. Scanned all `components/inspector/*.tsx`, `lib/inspector/*.ts`, and `lib/inspectorArtifact.ts` for TODO/FIXME/HACK/placeholder/"coming soon"/"not yet implemented" markers and hardcoded-empty stub patterns — zero matches. Reserved footer controls (`Ask agent to revise`, `Restart from this step`) are intentionally disabled with explanatory titles per the phase's own design (documented reserved-for-Phase-45 / Gate-1-only-resume rationale in both code comments and §44.7) — this is a documented design decision, not a stub.

### Human Verification Required

These four items were already identified and persisted by the phase's own integration gate (44-09) in `44-UAT.md` (status: partial, all `result: pending`) — carried forward here rather than duplicated as new findings:

### 1. Six-surface panel identity on a live run

**Test:** Sign in to dispatch-control with a real Clerk session against a real pipeline run. Open the inspector from all six entry points (brief org card, draft passage finding + section header, fact-check claim, voice finding, approval recommendation, My Tasks) and confirm it is the SAME panel each time with the correct resolved artifact; confirm the two sign-off task rows in My Tasks stay reserved/disabled.
**Expected:** Identical panel component, correct artifact per surface.
**Why human:** Cross-screen visual/interaction identity cannot be asserted in jsdom.

### 2. Human-readable-first reads correctly on every tab

**Test:** On each of the seven tabs, confirm prose/labels lead and raw JSON only appears on Technical.
**Expected:** No tab but Technical ever shows raw JSON as leading content.
**Why human:** Readability is a qualitative judgment call.

### 3. Missing-inputs call-out is genuinely useful, not noise

**Test:** Inspect a real drafted section on a live run; read the "Missing expected inputs" call-out.
**Expected:** Meaningful, real state-input names with glosses (or "all supplied") — not every declared variable flagged regardless of what was supplied.
**Why human:** Usefulness on real production data is qualitative; the diff algorithm itself is already unit-proven correct.

### 4. Footer actions render live vs. reserved correctly

**Test:** On a resolved artifact with a non-null promptKey, confirm "Improve this agent →" deep-links correctly; confirm "Restart from this step"/"Ask agent to revise" render visibly reserved on every artifact type.
**Expected:** Live navigation works; reserved controls are visually distinguishable.
**Why human:** Live routing + visual affordance state; attribute-level correctness is already jsdom-tested.

### Gaps Summary

No gaps found. All six INS-01..INS-06 requirements are satisfied by real, substantive, wired code — verified by direct file reads (not SUMMARY claims alone), 39 passing unit/component tests specific to the inspector (part of a 834-test green full suite), a green strict Next build, and a green pipeline pytest run for the additive `inputKeys` substrate. The phase's headline diagnostic (INS-03's missing-inputs diff) was independently confirmed to use the redefined `DECLARED_STATE_INPUTS` vocabulary and to never import the broken `VARIABLE_REGISTRY` literal diff. The Instructions tab's honesty crux (INS-04) was confirmed to never render a dishonest blank for either the 5 non-externalized or 11 externalized agents. The Output tab's divergence predicate (INS-05) was confirmed structurally incapable of asserting "unchanged" from silence. The four remaining open items are pre-existing, already-tracked live-session UAT checks (not new findings) that the phase's own integration gate correctly deferred rather than fake-passed — they gate final human sign-off, not the phase's code-level goal achievement.

---

*Verified: 2026-07-15T21:52:19Z*
*Verifier: Claude (gsd-verifier)*
