---
phase: 50-workbench-nomenclature
verified: 2026-07-17T03:38:45Z
status: passed
score: 6/6 success criteria verified
---

# Phase 50: Workbench & Nomenclature Verification Report

**Phase Goal:** The System Workbench gets its final rename and shape — Run Monitor → Run Details, Prompt Lab → Agent Instructions, Eval Center → Quality Tests, Registry → Editorial Memory — and the nomenclature table from the binding spec is applied consistently everywhere in the console.
**Verified:** 2026-07-17T03:38:45Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Nav shows two visibly distinct groups (Editorial / System Workbench) with the four renamed Workbench items over unchanged hrefs, and the signed-in role is shown | ✓ VERIFIED | `apps/dispatch-control/lib/nav.ts` — `NAV_GROUPS` has `'Editorial'` (Issues, Issue Workspace, My Tasks) and `'System Workbench'` (labels sourced from `WORKBENCH_NAV_LABELS`: Run Details/Agent Instructions/Quality Tests/Editorial Memory) with hrefs `/run-monitor` `/prompt-lab` `/eval-center` `/registry` unchanged. `AppSidebar.tsx:53-64` renders `RoleIndicator()` ("Signed in as {role}") in the bottom `mt-auto` block below the pinned "How to use" link, sourced from `useRole()`, returns `null` while loading (never flashes a default role). `__tests__/nav.test.ts` (11 tests) + `__tests__/AppSidebar.test.tsx` pass; full-suite run confirms green. |
| 2 | Run Details names steps by action with agent secondary, renders deterministic checks as diamonds, states historical-record-vs-live-run plainly | ✓ VERIFIED | `lib/nomenclature.ts::RUN_STEP_MAP` holds the verbatim §7 action labels ("Find story leads", "Verify organizations", "Draft sections", etc.); `PipelineGraph.tsx:94/110` and `RunDetail.tsx:160-170` both consume `runStepFor()`, replacing the old `toDisplayName()` title-caser (confirmed removed). `AgentNode.tsx:103-140` renders `isGate ? diamond : dot` sourced from `GATE_KEYS = {verify_candidates, verify_research, publisher}` (`pipelineTopology.ts`) — confirmed against the live 20-node `builder.py` graph (grep of `add_node`/`add_edge` matches exactly). `RunDetail.tsx:262-275` renders "Live run — steps update as they complete" / "Historical record — this run has finished"; `runDetailActionNames.test.ts:118-127` source-scans the whole file and asserts `/\bMonitor\b/` never matches (confirmed 0 hits by direct grep). The 7 writers + `validate_sections` collapse into one "Draft sections" `<tr>` (`RunDetail.tsx:356`, grouped by `actionLabel`). |
| 3 | Failed run shows the 4-part recovery rail (what happened / completed / did not happen / recommended recovery) with honest per-step Restart + Improve this agent; downstream steps dim as Skipped | ✓ VERIFIED | `RecoveryRail.tsx` renders exactly these four `<section>` blocks in order (confirmed by direct read, lines 264-322); downstream steps render in a dimmed `opacity-70` list with `— Skipped` suffix (line 307). Mounted in `RunDetail.tsx:314-323` only `{run.status === 'failed' && <RecoveryRail .../>}`. The Restart honesty matrix (`lib/nomenclature.ts::restartAvailabilityFor`) resolves LIVE for exactly 3 step-types (7 writers, `editor_gate_1` only when `isPausedAtGate1`, `publisher`) and RESERVED for the other 8; the "reused, not re-paid" claim greps only inside the LIVE branches of both `RecoveryRail.tsx` and `InspectorFooter.tsx` (confirmed by grep — comment lines + the two LIVE-branch strings, none in RESERVED copy). New pipeline endpoint `POST /issues/{run_id}/publish-manual` gated by `_require_editor` (`control.py:855-859`) backs the Publisher-restart case; `test_publish_bridge.py` (6/6 pass) proves the auth gate + audit log; the pre-existing trigger-secret `manual_publish` path is untouched (`_require_trigger_secret` still guards `runs.py`'s `/run/{run_id}/publish`). `RecoveryRail.test.tsx` + `InspectorFooter.test.tsx` pass in the full suite. |
| 4 | Agent Instructions shows why a draft instruction exists, linking to the motivating issue output | ✓ VERIFIED | `convex/schema.ts:319-326` — `prompt_versions.originRef` is additive/optional (`v.optional(v.object({runId, sectionName, excerpt, issueNumber?}))`), documented in `docs/API_CONTRACTS.md` §4A.2c (confirmed present) before the schema edit (per SUMMARY's separate `docs` commit `e27d083` preceding the `feat` commit `5a9aec2`). `InspectorFooter.tsx:257` builds `improveHref` with `fromRun`/`section`/`excerpt` query params, only on "Improve this agent →". `AgentPromptEditorView.tsx:57-71` exports `OriginBanner`, rendering "why this draft exists" text + a link back to `/run-monitor/runs/{runId}` when `originRef` (persisted or deep-link) is present, renders `null` otherwise. `convex/promptVersions.ts:205-239` — `saveVersion` accepts + persists `originRef` only when supplied. `promptVersionOrigin.test.ts` passes in the full suite. |
| 5 | Typed confirmation is reserved for Mark Do-not-use (org name + reason, Editor-in-chief); automation toggle relocated off the operator surface to Administration | ✓ VERIFIED | `RegistryTable.tsx:86,107-112,246-296` — `typedName` state gates the "Mark Do not use" confirm button, disabled until `typedName.trim() === charity.name.trim()` AND `blocklistReason` non-empty; the mutation call is byte-unchanged (`status: 'blocklisted'`). `Masthead.tsx:289` — the ON chip reads "Publishing automatically — managed in Administration" (no "Auto-publish ON/OFF" switch phrasing survives — confirmed 0 grep hits); OFF case still reads "Human approval required". `AutoPublishToggle` still lives exclusively under `/config` (confirmed — `grep -rl` returns only `config/page.tsx` and `config/_components/AutoPublishToggle.tsx`, nothing on the operator surface). `publishNoTypedConfirm.test.ts` (7 tests) source-scans `DecisionRail.tsx`/`PublishPreviewDialog.tsx`/`ReviewDecisionPanel.tsx` and confirms zero `<input>` elements / typed-match idioms on either publish surface — confirmed by direct grep (0 `<input>` hits). `registryDoNotUse.test.ts` passes. |
| 6 | Every renamed nomenclature term appears consistently; no legacy term survives in operator-facing copy | ✓ VERIFIED | `nomenclature.test.ts` is un-skipped (`describe.skip` → `describe`, confirmed by grep returning 0 hits for `describe.skip`) and green (`pnpm --filter dispatch-control test -- --run nomenclature` → 1/1 pass). It source-scans `app/`+`components/` JSX text + `title`/`aria-label`/`placeholder` props against 24 `FORBIDDEN_COPY_TERMS` (gate, code gate, node, re-run from node, shadow run, golden scenario, blocklisted, eval, run evals, commit, rollback, plus the 260710-k8y conflict terms Rehearsal/Make live/LIVE badge/Draft vs. live, plus the tail rows Coverage memory/registry record/never seeded/seeded/blocking). Independent spot-check greps for visible "Gate"/"node"/"shadow run"/"golden scenario"/"blocklisted"/"Coverage memory"/"never seeded"/"Blocking items"/"Auto-publish ON"/"Rehearsal"/"Make live"/">LIVE<"/"Draft vs. live" across `app/`+`components/` all returned zero operator-facing hits (only code identifiers and doc comments, which the tripwire correctly allowlists). `how-to-use/page.tsx:46-49` legend corrected from "three deterministic checks" to the accurate two (Verify organizations, Verify research) plus the Publisher's diamond framed as an action, not a check. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/dispatch-control/lib/nomenclature.ts` | D-06 source of truth: `WORKBENCH_NAV_LABELS`, `RUN_STEP_MAP`, `runStepFor`, `PRODUCT_TERMS`, `restartAvailabilityFor` | ✓ VERIFIED | All exports present and consumed by ≥2 real screens each |
| `pipelineTopology.ts` | 20-node topology + reconciled `GATE_KEYS` | ✓ VERIFIED | `PIPELINE_NODES` = 20 entries matching `builder.py` exactly; `GATE_KEYS = {verify_candidates, verify_research, publisher}` |
| `apps/dispatch-control/__tests__/nomenclature.test.ts` | Un-skipped banned-term tripwire | ✓ VERIFIED | `describe(...)`, not `describe.skip`; green |
| `apps/dispatch-control/__tests__/rename-preservation.test.ts` | Route/enum preservation guard | ✓ VERIFIED | 5/5 tests green; routes + `'blocklisted'` + `charity.blocklisted` all intact |
| `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx` | 4-part recovery rail | ✓ VERIFIED | 322 lines; all 4 sections + honesty matrix present |
| `packages/pipeline/src/eisenbalm_pipeline/api/control.py` | Clerk-guarded Publisher-restart bridge | ✓ VERIFIED | `publish_manual` at line 855, `Depends(_require_editor)` |
| `convex/schema.ts` | additive `prompt_versions.originRef` | ✓ VERIFIED | `v.optional(v.object({...}))`, no existing fields touched |
| `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` | typed-confirm Do-not-use over unchanged `'blocklisted'` | ✓ VERIFIED | `typedName` gate + unchanged mutation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `lib/nav.ts` | `lib/nomenclature.ts` | `WORKBENCH_NAV_LABELS` import | ✓ WIRED | `import { WORKBENCH_NAV_LABELS } from './nomenclature'` |
| `PipelineGraph.tsx` | `lib/nomenclature.ts` | `runStepFor(agentKey).actionLabel` | ✓ WIRED | Confirmed at line 94; `toDisplayName` fully removed |
| `AgentNode.tsx` | `pipelineTopology GATE_KEYS` | `isGate` diamond render | ✓ WIRED | Unchanged visual system, reconciled set |
| `RegistryTable.tsx` | `convex charities.setStatus` | `status: 'blocklisted'` unchanged | ✓ WIRED | Confirmed unchanged literal at handler call site |
| `Masthead.tsx` | Administration (Config) | automation setting relocated | ✓ WIRED | `AutoPublishToggle` exclusively under `/config` |
| `InspectorFooter.tsx` | `/prompt-lab/[agentKey]` | origin query params on "Improve this agent →" | ✓ WIRED | `fromRun`/`section`/`excerpt` params confirmed |
| `RecoveryRail.tsx` | `rerollAgent`/`adjudicate`/`publish-manual` | per-step-type Restart via honesty matrix | ✓ WIRED | `restartAvailabilityFor` single source, consumed identically by `InspectorFooter.tsx` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full dispatch-control test suite | `pnpm --filter dispatch-control test -- --run` | 126 files passed, 1 skipped (pre-existing, unrelated); 1024 tests passed, 2 todo | ✓ PASS |
| Strict frontend build | `pnpm --filter dispatch-control build` | exit 0; route list confirms `/run-monitor` `/prompt-lab` `/eval-center` `/registry` unchanged | ✓ PASS |
| Pipeline backend test suite | `cd packages/pipeline && uv run pytest -x -q` | 698 passed, 38 skipped | ✓ PASS |
| Publisher-restart bridge tests | `uv run pytest -x -q tests/test_publish_bridge.py` | 6/6 passed | ✓ PASS |
| Nomenclature tripwire (isolated) | `pnpm --filter dispatch-control test -- --run nomenclature` | 1/1 passed | ✓ PASS |
| 20-node graph cross-check | `grep -n "add_node\|add_edge" builder.py` vs `pipelineTopology.ts` | Exact match: 20 nodes, same edge structure | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| WBN-01 | 50-01 | Nav two-group split + role indicator | ✓ SATISFIED | `nav.ts`, `AppSidebar.tsx`, `nav.test.ts`/`AppSidebar.test.tsx` |
| WBN-02 | 50-00 (scaffold) + 50-02 (delivery) | Action-named Run Details steps + diamonds + historical/live framing | ✓ SATISFIED | `PipelineGraph.tsx`, `AgentNode.tsx`, `RunDetail.tsx`, `runDetailActionNames.test.ts` |
| WBN-03 | 50-05 | Failed-run recovery rail + honest Restart + Improve this agent | ✓ SATISFIED | `RecoveryRail.tsx`, `control.py::publish_manual`, `test_publish_bridge.py`, `RecoveryRail.test.tsx` |
| WBN-04 | 50-04 | "Why this draft exists" origin bridge | ✓ SATISFIED | `convex/schema.ts::originRef`, `InspectorFooter.tsx`, `AgentPromptEditorView.tsx::OriginBanner`, `promptVersionOrigin.test.ts` |
| WBN-05 | 50-00 (scaffold) + 50-03 (partial) + 50-06 (close-out) | Nomenclature sweep, tripwire green | ✓ SATISFIED | `nomenclature.test.ts` un-skipped + green; independent spot-check greps confirm zero legacy-term survivors |
| WBN-06 | 50-03 | Typed confirm scoped to Do-not-use; automation toggle off operator surface | ✓ SATISFIED | `RegistryTable.tsx`, `Masthead.tsx`, `AutoPublishBanner.tsx`, `publishNoTypedConfirm.test.ts` |

All 6 requirement IDs (WBN-01..WBN-06) are declared across plan frontmatter `requirements:` fields, cross-referenced against `.planning/REQUIREMENTS.md`'s "### Workbench & Nomenclature (WBN)" section (all six checked `[x]` there), and confirmed against actual code. No orphaned requirements — every WBN-ID declared in REQUIREMENTS.md is claimed by at least one Phase 50 plan.

Note: `.planning/REQUIREMENTS.md`'s secondary traceability appendix table (~line 856-861) still lists WBN-01..06 as "Planned" — this is a pre-existing, systemic staleness in that specific summary table (the same pattern applies to ROL-01..04/Phase 49 rows immediately above it), not a Phase 50-specific gap. The authoritative checklist (`### Workbench & Nomenclature (WBN)` section, line 420-426) has all six marked `[x]`.

### Anti-Patterns Found

None. Scanned all files listed in the six plans' `files_modified` frontmatter for TODO/FIXME/placeholder/stub patterns and hardcoded-empty-data patterns — none found. The one place a stub-like literal exists (`RUN_STEP_SOURCE`'s `calibrator`/`chronicler`/`validate_sections` `named: false` fallback entries) is an intentional, tested, non-blank fallback, not a stub — `runDetailActionNames.test.ts` explicitly asserts these resolve non-empty labels.

### Human Verification Required

The following are visual/layout judgments the automated checks above cannot fully substitute for. Code-level evidence (CSS classes, DOM structure, conditional render logic) strongly supports each, but a human should confirm actual rendered appearance:

### 1. Nav group visual distinctness

**Test:** Open the Dispatch Control console and view the left sidebar.
**Expected:** "Editorial" and "System Workbench" read as two clearly separate, labeled sections (not visually merged into one list) — per D-04's existing two-group structure, unchanged by this phase's label rename.
**Why human:** `AppSidebar.tsx` renders each `NAV_GROUPS` entry as its own `<div>` with an uppercase group-label `<p>` above its `<ul>`; the code confirms structural separation, but whether the visual spacing/typography reads as "distinct" to a viewer is a design judgment.

### 2. Recovery rail readability under real failure data

**Test:** Trigger or view a genuinely failed run in Run Details and read the 4-part recovery rail top to bottom.
**Expected:** The vermilion "What happened" section, the neutral "What completed successfully" / "What did not happen" (dimmed, Skipped) lists, and "Recommended recovery" actions read as a coherent, plain-language explanation an editor (not an engineer) can act on without confusion.
**Why human:** Automated tests confirm the four sections render with the right data and the honesty matrix resolves correctly, but prose clarity and visual hierarchy (vermilion emphasis, dimming, spacing) are a readability judgment that requires eyes on the actual failed-run data.

### 3. Role-indicator placement and legibility

**Test:** Sign in as each role (Editor-in-chief, Collaborator) and check the bottom-left of the sidebar.
**Expected:** "Signed in as {role}" appears in a location and at a size/contrast that reads as an unobtrusive but discoverable status indicator, never confusable with a nav item or an actionable control.
**Why human:** Code confirms correct conditional render (never a wrong/default role during Clerk load) and DOM placement (`mt-auto` block below the pinned link), but final visual polish (font size `text-[11px]`, color `--color-faint`) is a design judgment.

### Gaps Summary

No gaps found. All 6 ROADMAP success criteria are verified against actual code (not just SUMMARY claims), all 6 WBN requirements are satisfied with direct code evidence, the full frontend test suite (1024 tests), strict build, and backend pytest suite (698 tests) are all green, and the two load-bearing constraints from CONTEXT/RESEARCH — (a) route folders and the stored `'blocklisted'` enum are unchanged (proven by an active, independent `rename-preservation.test.ts` tripwire, not just a one-time grep), and (b) the "Restart from this step" honesty matrix is genuinely 3-of-11 LIVE / 8-of-11 RESERVED (not a blanket claim) — both hold in the shipped code. The nomenclature source-scan tripwire (`nomenclature.test.ts`) is un-skipped and green, which is the primary, ongoing (not one-time) proof for WBN-05. Independent spot-check greps for every banned term across `app/`+`components/` corroborate the tripwire's result with zero surviving operator-facing legacy terms found outside its own allowlist.

---

_Verified: 2026-07-17T03:38:45Z_
_Verifier: Claude (gsd-verifier)_
