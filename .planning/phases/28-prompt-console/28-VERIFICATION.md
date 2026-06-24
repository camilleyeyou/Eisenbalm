---
phase: 28-prompt-console
verified: 2026-06-24T05:46:00Z
status: passed
score: 13/13 must-haves verified
human_verification:
  - test: "Open /prompts in dispatch-control and confirm each card shows the editorial description + an 'edited since seed' badge on any prompt edited away from v1; filter by name/group/drift"
    expected: "Descriptions render, drift badge appears only on edited keys, filters narrow the list and show an empty state when nothing matches"
    why_human: "Visual rendering + live Convex drift compare cannot be exercised without a running app + seeded workspace"
  - test: "Edit a prompt, click a variable chip, view the assembled preview, then attempt to switch agentKey / toggle view with a dirty draft"
    expected: "Chip inserts {token}, assembled preview substitutes sample values instantly, a confirm dialog + 'unsaved changes' pill appear on dirty navigation"
    why_human: "Interactive insertion, instant client substitution, and window.confirm dialog behavior need a browser"
  - test: "With NEXT_PUBLIC_PIPELINE_URL pointing at a reachable pipeline, run a draft test, then 'Compare against active'"
    expected: "Draft output scored (per-axis + overall + rationale + rubric source caption); compare runs the active version on demand and shows both outputs/costs side-by-side with a signed score delta; no action blocked by a score"
    why_human: "End-to-end scoring + side-by-side compare requires a live pipeline endpoint and real OpenRouter call (stub path verified programmatically)"
---

# Phase 28: Prompt Console Verification Report

**Phase Goal:** Make dispatch-control `/prompts` a best-in-class editorial authoring console for Jesse's voice — Andrew can understand, safely edit, and validate any agent prompt before it ships across four capability areas (editorial context + safety, variable tooling, the authoring loop, source-of-truth sync).
**Verified:** 2026-06-24T05:46:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth (PRC) | Status     | Evidence |
| --- | ----------- | ---------- | -------- |
| 1 | Editorial role/description on every card + detail pane (PRC-01) | ✓ VERIFIED | `promptDescriptions.ts` exports `PROMPT_DESCRIPTIONS` + `descriptionFor`; wired in `PromptsListClient.tsx` (2 refs) and `AgentPromptEditorView.tsx` (2 refs); superset-coverage test passes (4 tests) |
| 2 | "Edited since seed" drift badge on cards + detail (PRC-02) | ✓ VERIFIED | Additive `listSeedV1ForWorkspace` in `convex/promptVersions.ts`; list compares active vs v1 + renders "edited since seed"; detail uses `getByVersion` + same badge |
| 3 | List filterable by name text, group, and drift (PRC-04) | ✓ VERIFIED | `PromptsListClient.tsx` has text `<input>`, group `<select>`, and `aria-pressed` drift toggle |
| 4 | Copyable exact `.md`-marker export for copy→commit (PRC-10) | ✓ VERIFIED | `PromptMarkerExport.tsx` builds `<!-- PROMPT START -->\n…\n<!-- PROMPT END -->`; `markerExport.test.ts` asserts byte form + round-trip (2 tests); rendered in detail read-only state |
| 5 | Click-to-insert variable chips with description tooltips (PRC-05) | ✓ VERIFIED | `VariableChips.tsx` uses `onInsert`, `title=`, `descriptionForVariable`; `VARIABLE_DESCRIPTIONS` added additively (registry shape unchanged) |
| 6 | Instant client-side assembled-with-sample-values preview (PRC-06) | ✓ VERIFIED | `AssembledPreview.tsx` exports `assembleWithSamples` (split/join, no fetch); `assembledPreview.test.ts` passes (4 tests) |
| 7 | Passive unused-variable advisory hint, non-blocking (PRC-07) | ✓ VERIFIED | `findUnusedVariables` + "Allowed but not used" advisory in chips; no save-gate added; `variableMaps.test.ts` passes (7 tests) |
| 8 | In-app unsaved-changes guard, no native beforeunload (PRC-03) | ✓ VERIFIED | `AgentPromptEditorView.tsx` has "unsaved changes" pill + `window.confirm` (2 refs); `beforeunload` count = 0 (D-11 honored) |
| 9 | Draft-vs-active side-by-side compare, 1× default (PRC-08) | ✓ VERIFIED | `runActiveVersionTest` called ONLY in `handleCompare`, not `handleRun`; "Compare against active" button; both outputs/costs rendered side-by-side |
| 10 | Voice-rubric score backend: per-axis + overall + rationale, advisory (PRC-09 backend) | ✓ VERIFIED | `score_output` + `VoiceScore` in `judge.py` (single-output, reuses `acomplete`, `run_llm_judge` intact); `POST /agents/{key}/score` resolves rubric via `getActive`→`_load_rubric`; `test_score.py` 3 passing |
| 11 | Voice-rubric score UI on draft (always) + active (compared) with delta (PRC-09 UI) | ✓ VERIFIED | `scoreClient.scoreOutput` POSTs `/score`; `TestRunPanel.tsx` scores draft + active, computes delta (line 172), shows "advisory — does not gate" caption |

**Score:** 11/11 truths verified (mapping to 13 PRC requirement coverages across PRC-01..10)

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `promptDescriptions.ts` | ✓ VERIFIED | 93L, `PROMPT_DESCRIPTIONS`+`descriptionFor`, superset test green |
| `convex/promptVersions.ts` | ✓ VERIFIED | 306L, additive `listSeedV1ForWorkspace`; existing exports intact |
| `PromptMarkerExport.tsx` | ✓ VERIFIED | 66L, exact marker byte form + `buildMarkerExport` |
| `PromptsListClient.tsx` | ✓ VERIFIED | 234L, description + drift badge + 3 filters |
| `AgentPromptEditorView.tsx` | ✓ VERIFIED | 261L, description + drift + export + chips + preview + unsaved guard |
| `VariableRegistry.ts` | ✓ VERIFIED | 198L, additive maps; `Record<string, string[]>` shape unchanged |
| `VariableChips.tsx` | ✓ VERIFIED | 72L, click-to-insert + tooltips + unused hint |
| `AssembledPreview.tsx` | ✓ VERIFIED | 58L, `assembleWithSamples` client-side |
| `docs/API_CONTRACTS.md` | ✓ VERIFIED | §3A.2 at L830 (after §3A.1 L785, before §3B L892) — contract-first honored |
| `agents.py` | ✓ VERIFIED | 399L, `ScoreRequest/ScoreResponse`, `_require_operator`, rubric resolution; no real-table write in handler (refs are docstrings) |
| `judge.py` | ✓ VERIFIED | 309L, `score_output`+`VoiceScore`; `run_llm_judge` unchanged |
| `test_score.py` | ✓ VERIFIED | 119L, 3 passing |
| `testRunClient.ts` | ✓ VERIFIED | 108L, additive `runActiveVersionTest` |
| `scoreClient.ts` | ✓ VERIFIED | 75L, `scoreOutput` POSTs `/score` |
| `TestRunPanel.tsx` | ✓ VERIFIED | 483L, compare + score + delta |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| PromptsListClient | `listSeedV1ForWorkspace` + `descriptionFor` | useQuery drift compare + import | ✓ WIRED |
| AgentPromptEditorView | VariableChips + AssembledPreview | render in editing pane, insert into draft | ✓ WIRED |
| AssembledPreview | VARIABLE_SAMPLES | `assembleWithSamples` substitution | ✓ WIRED |
| api/agents `/score` | `judge.score_output` + `_load_rubric` | getActive→disk fallback, single acomplete | ✓ WIRED |
| judge.score_output | `acomplete` | single LLM call, usage cost (no 2nd recorder) | ✓ WIRED |
| TestRunPanel | `scoreClient.scoreOutput` | score draft always + active when compared | ✓ WIRED |
| TestRunPanel | `runActiveVersionTest` | compare-on-demand only (1× default preserved) | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Score endpoint stub-mode | `pytest tests/api/test_score.py -q` | 3 passed | ✓ PASS |
| Console unit suite | `vitest run promptDescriptions markerExport variableMaps assembledPreview scoreClient` | 20 passed (5 files) | ✓ PASS |
| Marker round-trip | markerExport.test.ts | byte-form + strip-newline round-trip green | ✓ PASS |
| Live /prompts UI + drift + compare | (browser) | not run | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| PRC-01 | 28-01 | ✓ SATISFIED | descriptions map + card/detail render + superset test |
| PRC-02 | 28-01 | ✓ SATISFIED | listSeedV1ForWorkspace drift compare + badge both surfaces |
| PRC-03 | 28-02 | ✓ SATISFIED | window.confirm guard + pill, no beforeunload |
| PRC-04 | 28-01 | ✓ SATISFIED | name/group/drift filters |
| PRC-05 | 28-02 | ✓ SATISFIED | click-to-insert chips + tooltips |
| PRC-06 | 28-02 | ✓ SATISFIED | client-side assembleWithSamples preview |
| PRC-07 | 28-02 | ✓ SATISFIED | findUnusedVariables advisory, non-gating |
| PRC-08 | 28-04 | ✓ SATISFIED | compare-on-demand side-by-side, 1× default preserved |
| PRC-09 | 28-03 + 28-04 | ✓ SATISFIED | score_output backend + endpoint + UI score/delta, advisory |
| PRC-10 | 28-01 | ✓ SATISFIED | exact marker export, no repo write |

No orphaned requirements — all PRC-01..10 declared across the four plans' `requirements` frontmatter and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | Scan of all 15 new/modified files found no TODO/FIXME/placeholder/stub; "advisory — does not gate" matches are intentional contract comments, not gating logic |

### Human Verification Required

3 interactive items routed to human (rendering, dirty-navigation confirm dialog, live end-to-end scoring/compare against a running pipeline). All underlying logic verified programmatically via unit/endpoint tests and stub-mode runs.

### Gaps Summary

No gaps. All 10 PRC requirements are accounted for and verified at the artifact, wiring, and behavioral levels. Locked decisions honored: contract-first (§3A.2 precedes §3B), no native beforeunload (D-11), VARIABLE_REGISTRY shape unchanged (D-13), additive Convex query only, advisory-only scoring with no second cost recorder and no real-table writes, and the exact marker byte form with no repo write (D-01/02/03). Score endpoint tests (3), console unit tests (20), and per context the combined dispatch-control strict build + 120-passing vitest suite all pass.

---

_Verified: 2026-06-24T05:46:00Z_
_Verifier: Claude (gsd-verifier)_
