---
phase: 24-prompt-editor-versioning
verified: 2026-06-22T15:25:00Z
status: passed
score: 6/6 must-haves verified
human_verification:
  - test: "Editor UI end-to-end (open agent, edit, highlight, save, diff, activate/rollback, test-run)"
    expected: "All flows render and behave per success criteria"
    why_human: "Visual/interactive UI behavior — performed by Andrew in-browser (24-07) and APPROVED"
warnings:
  - item: "tsc --noEmit type-strictness errors in 2 Phase-24 source files"
    files:
      - "apps/dispatch-control/app/(dashboard)/prompts/_components/variableHighlightExtension.ts:23"
      - "apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts:88"
    detail: "noUncheckedIndexedAccess flags regex match-group access (m[1]) as possibly-undefined. Runtime-correct (capture group always present when exec returns non-null) and all behavioral tests pass, but the project's `typecheck` script does not run clean. The context-block claim of 'tsc --noEmit = 0 errors' is accurate only for the changed files in isolation, not the full include set. Tracked in deferred-items.md as a type-hardening follow-up. Not a goal blocker."
---

# Phase 24: Prompt Editor + Versioning Verification Report

**Phase Goal:** Operator can edit any agent's system prompt and user-prompt template in a CodeMirror editor with `{variable}` highlighting; saving creates an immutable new version; operator can diff any two versions, activate a version, or rollback — with activation blocked while a run is in progress; `VOICE_CONSTRAINTS` is a versioned first-class config entry; operator can test-run a single agent against sample input.
**Verified:** 2026-06-22T15:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Save creates a new version row (author, timestamp, optional note); prior version still accessible & unchanged | ✓ VERIFIED | `convex/promptVersions.ts:84` saveVersion inserts `version = maxVersion+1`, never patches prior rows; `listForAgent`/`getByVersion` expose all versions. `saveVersion.test.ts` 3/3 green. |
| 2 | Editor highlights `{variable}` tokens; unknown/mangled tokens warn & block save | ✓ VERIFIED | `VariableRegistry.ts` VARIABLE_REGISTRY + findUnknownVariables; `PromptEditor.tsx:56-57,95` computes unknown live and disables Save when present; `variableHighlightExtension.ts` known/unknown Decoration marks. `PromptEditor.test.tsx` green. |
| 3 | Activation blocked while run in progress; immediate otherwise | ✓ VERIFIED | `promptVersions.ts:148` filters runs `status==='running'` → returns `{blocked:true,reason}`; `VersionHistoryPanel.tsx:54,188` disables control with explanation when `latestRun.status==='running'`. `activate.test.ts` 4/4 green. |
| 4 | Select any two versions → side-by-side diff | ✓ VERIFIED | `DiffViewer.tsx:16` `diffLines` (diff v9) two-column render. `DiffViewer.test.tsx` 2/2 green. |
| 5 | Test-run single agent (sample/prior-real input) → output + cost, no full pipeline | ✓ VERIFIED | `api/agents.py` POST `/agents/{key}/test-run` calls `acomplete` directly under transient `run_id`, writes nothing to real tables; `TestRunPanel.tsx` 4 input modes via `testRunClient`. |
| 6 | `VOICE_CONSTRAINTS` editable & versioned via same save-as-version flow | ✓ VERIFIED | `agentList.ts:30` voice_constraints is a standalone 'asset' nav entry from VARIABLE_REGISTRY; `voice.py:157,207` `db_voice_override`; `config_loader.py:120,273` hydrates voice_constraints from `getActive`. `voice_constraints.md` present + byte-test green. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `convex/promptVersions.ts` | saveVersion/activate/listForAgent/getByVersion/getActive | ✓ VERIFIED | All 5 exports present + substantive; audit-log writes on save+activate |
| `convex/schema.ts` | by_workspace_agentKey_version index | ✓ VERIFIED | Index at line 278 |
| `packages/pipeline/.../lib/config_loader.py` | RunConfig asset fields + getActive hydration + disk fallback | ✓ VERIFIED | voice_constraints/user_templates/section_guidance/rubric fields; getActive per key |
| `packages/pipeline/.../lib/voice.py` | assemble_voice db_voice_override | ✓ VERIFIED | Param + passthrough codepath, Phase-16 sentinel preserved |
| `packages/pipeline/.../api/agents.py` | POST /agents/{key}/test-run | ✓ VERIFIED | Router calls acomplete directly; no real-table writes (only docstring mentions) |
| 18+ externalized `prompts/*.md` | user templates + section guidance + rubric + voice | ✓ VERIFIED | 31 .md files present incl. all Phase-24 assets |
| `packages/pipeline/scripts/seed_phase24_assets.py` | idempotent byte-verified upsertActive seed | ✓ VERIFIED | USER_TEMPLATE_KEYS + SECTION_GUIDANCE_KEYS + rubric + voice |
| `apps/dispatch-control/.../PromptEditor.tsx` | CodeMirror editor + highlight + save gate | ✓ VERIFIED | use client; findUnknownVariables save-gate wired |
| `apps/dispatch-control/.../VariableRegistry.ts` | per-agent allowed-var map + findUnknownVariables | ⚠️ VERIFIED (tsc warning) | Functional + tested; line 88 flagged by noUncheckedIndexedAccess |
| `apps/dispatch-control/.../DiffViewer.tsx` | two-column diff (diff v9) | ✓ VERIFIED | diffLines render |
| `apps/dispatch-control/.../TestRunPanel.tsx` | input modes + output/cost | ✓ VERIFIED | 4 modes, POST to test-run via testRunClient + Clerk token |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| promptVersions.activate | auditLog.write | internal.auditLog.write | ✓ WIRED (line 183) |
| promptVersions.activate | runs status | in-progress guard `status==='running'` | ✓ WIRED (line 148) |
| load_run_config | promptVersions:getActive (per key) | convex_query + disk fallback | ✓ WIRED |
| calibrator assemble_voice | RunConfig.voice_constraints | db_voice_override | ✓ WIRED |
| test-run endpoint | acomplete | direct call, no @agent_node | ✓ WIRED |
| PromptSaveDialog | promptVersions.saveVersion | useMutation | ✓ WIRED |
| VersionHistoryPanel activate | promptVersions.activate | useMutation; disabled while running | ✓ WIRED |
| TestRunPanel | POST /agents/{key}/test-run | testRunClient fetch + Clerk token | ✓ WIRED |
| agent _build_messages | RunConfig.user_templates / section_guidance / rubric | state['config'] + disk fallback | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| VersionHistoryPanel | versions | useQuery listForAgent (convex) | Yes (real prompt_versions rows) | ✓ FLOWING |
| TestRunPanel | output/cost | POST /agents/{key}/test-run → acomplete | Yes at runtime; requires NEXT_PUBLIC_PIPELINE_URL set | ⚠️ RUNTIME-CONFIG (documented in .env.example; not a code gap) |
| Pipeline agents | prompts | config_loader getActive + disk fallback | Yes (disk fallback guarantees data even pre-seed) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Pipeline suite | pytest -q | 311 passed, 33 skipped | ✓ PASS |
| Byte-equivalence seeds | pytest test_prompt_version_seeds.py | 15 passed | ✓ PASS |
| dispatch-control suite | vitest run | 73 passed, 2 todo, 1 skipped | ✓ PASS |
| Phase-24 convex+UI tests | vitest saveVersion/activate/DiffViewer/PromptEditor | 10 passed | ✓ PASS |
| Type check (full include) | tsc --noEmit | 53 errors (51 pre-existing test files, 2 net-new Phase-24 source) | ⚠️ WARN |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| PRM-01 | 24-03/04a/04b/05a/05b/07 | Edit system + user-prompt template in UI | ✓ SATISFIED | CodeMirror editor + externalized .md assets + config_loader |
| PRM-02 | 24-07 | Highlight available variables, warn on unknown before save | ✓ SATISFIED | VariableRegistry + highlight extension + save-gate (REQUIREMENTS.md still `[ ]` — implemented, doc checkbox lags) |
| PRM-03 | 24-02/07 | Save creates new version, never overwrites | ✓ SATISFIED | saveVersion insert-only + audit row (REQUIREMENTS.md still `[ ]` — implemented, doc checkbox lags) |
| PRM-04 | 24-02/08 | Diff + activate/rollback one click; blocked while run in progress | ✓ SATISFIED | DiffViewer + activate guard + VersionHistoryPanel |
| PRM-05 | 24-06/08 | Test-run single agent → output + cost | ✓ SATISFIED | /agents/{key}/test-run + TestRunPanel |
| PRM-06 | 24-03/06/07 | VOICE_CONSTRAINTS editable + versioned first-class | ✓ SATISFIED | voice_constraints asset entry + db_voice_override + versioning |

No orphaned requirements: all 6 PRM IDs in REQUIREMENTS.md map to Phase 24 and are claimed by plans.

Note: PRM-02 and PRM-03 are still checkbox `[ ]` and "Pending" in REQUIREMENTS.md lines 235-236/491-492, but the implementing code + tests are present and green. The status doc lags the implementation — recommend updating REQUIREMENTS.md to mark PRM-02/03 Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| variableHighlightExtension.ts | 23 | TS2532 (m[1] possibly undefined under noUncheckedIndexedAccess) | ⚠️ Warning | `typecheck` script fails; runtime correct (regex group guaranteed); tracked in deferred-items.md |
| VariableRegistry.ts | 88 | TS2532 (m[1] possibly undefined) | ⚠️ Warning | Same as above |
| api/agents.py | 8-9, 228 | "agent_runs/deliberationEvents" string matches | ℹ️ Info | Docstring only describing isolation — NOT actual writes (confirmed no insert calls) |

### Human Verification

Editor UI (24-07) was visually verified in-browser by Andrew and APPROVED. No further human verification required for goal achievement.

### Gaps Summary

No goal-blocking gaps. The phase goal is fully achieved in code:
- Convex versioning data layer (insert-only saveVersion, single-flip activate with in-progress guard, audit trail) — verified + convex-test green.
- Pipeline backend (voice db-override, isolated test-run endpoint, config_loader hydration with disk fallback, 18 externalized byte-verified .md assets, idempotent seed) — verified + 311/33 pipeline suite + 15 byte tests green.
- dispatch-control UI (CodeMirror editor, variable highlight + unknown-var save gate, save-as-version, version history, DiffViewer, activate/rollback with in-progress guard, 4-mode TestRunPanel) — verified + 73 vitest green + human-approved.

One non-blocking warning: 2 Phase-24 source files (`variableHighlightExtension.ts`, `VariableRegistry.ts`) emit `tsc --noEmit` errors under the repo's `noUncheckedIndexedAccess` strictness (regex match-group access). These are runtime-correct and all behavioral tests pass, but the project's `typecheck` gate does not run clean for the full include set — contradicting the "0 errors" framing. Already logged in deferred-items.md for a type-hardening pass. Recommend a one-line guard (`m[1] ?? ''`) on both lines to restore a clean `typecheck`.

Two documented runtime-config follow-ups (NOT code gaps, confirmed): live prompt_versions seeding deferred (stale CONVEX_DEPLOY_KEY), and NEXT_PUBLIC_PIPELINE_URL must be set in `.env.local` for the test-run UI at runtime (code + .env.example documentation present).

---

_Verified: 2026-06-22T15:25:00Z_
_Verifier: Claude (gsd-verifier)_
