---
phase: quick-260710-k8y
plan: 01
subsystem: ui
tags: [dispatch-control, prompt-lab, nomenclature, copy, react, vitest]

requires: []
provides:
  - "agentList.ts — GROUP_LABELS renamed to House Rules/Job Descriptions/Section Briefs/Assignment Memos, plus new GROUP_DESCRIPTORS, AGENT_DISPLAY_NAMES map, and displayNameForAgentKey() resolver"
  - "page.tsx — GROUP_ORDER reordered to [asset, system, section-guidance, user-template] (highest-leverage group first)"
  - "PromptsListClient.tsx — group descriptors rendered under each header, display names in cards + search, 'Edits only' filter, 'edited since launch' badge"
  - "TestRunPanel.tsx — panel retitled 'Rehearsal'; modes relabeled Sample week / Your own input / Replay a real run with per-mode MODE_DESCRIPTORS; 'Draft vs. live' compare action with its own descriptor; ResultColumn 'Active' -> 'Live'"
  - "AssembledPreview.tsx — disclosure retitled 'What the agent sees' with the model-input descriptor"
  - "PromptSaveDialog.tsx — heading resolves 'Save draft as v{n}' from listForAgent; note is now REQUIRED (Confirm save disabled until non-whitespace note)"
  - "PromptEditor.tsx — 'Save draft as new version' button; unknown-variable warning + button title use the actionable '{token} isn't supplied by the pipeline...' copy"
  - "VersionHistoryPanel.tsx — LIVE badge, 'Make live' / 'Restore this version' controls, '(live)' compare markers"
  - "__tests__/PromptSaveDialog.test.tsx — new test proving the required-note gate + resolved v{n} heading"
affects: [dispatch-control/prompt-lab]

tech-stack:
  added: []
  patterns:
    - "Rename-map provenance: PROPOSAL.md committed alongside the first task's code change as the source-of-truth artifact for a copy-only rename pass"
    - "Display-name resolver with fallback: displayNameForAgentKey(key) = AGENT_DISPLAY_NAMES[key] ?? humanizeAgentKey(key), keeping the deterministic humanizer as a safety net for any agentKey not in the curated map"
    - "Required-field gate on a Convex mutation input: rather than changing the Convex-side optional `note` field, the client computes noteEmpty = note.trim().length === 0 and gates the Confirm button + early-returns in the handler — the contract (`note?: string`) stays optional, only the UI enforces non-empty"
    - "Next-version-number preview: a second useQuery(listForAgent) in the save dialog derives nextVersion = max(existing versions) + 1 purely for the heading label, with no effect on the actual saveVersion increment logic"

key-files:
  created:
    - apps/dispatch-control/__tests__/PromptSaveDialog.test.tsx
  modified:
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/agentList.ts"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptsListClient.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AssembledPreview.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptEditor.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptSaveDialog.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx"
    - .planning/quick/260710-k8y-implement-prompt-lab-nomenclature-propos/PROPOSAL.md
    - .planning/quick/260710-k8y-implement-prompt-lab-nomenclature-propos/260710-k8y-PLAN.md

key-decisions:
  - "Kept PromptEditor.tsx free of any unconditional useQuery for the v{n} number (per the plan's explicit note) — the 'Save draft as v{n}' resolution lives only in PromptSaveDialog, so PromptEditor's existing Convex-provider-less smoke test (__tests__/PromptEditor.test.tsx) keeps passing unmodified."
  - "Used a plain JS string literal (`{\"isn't supplied...\"}`) for the unknown-variable copy rather than the JSX `&apos;` HTML-entity convention seen elsewhere in this codebase (e.g. TestRunPanel's pre-existing `run&apos;s`), because the plan's verify gate greps for a literal straight apostrophe in the source; confirmed no ESLint config exists in the repo to enforce entity-escaping, so this is safe."
  - "Left api.promptVersions.activate/saveVersion Convex mutation names, the runInProgress guard, the eval-gate override-with-reason block, and the 'Run evals for v{N}' producer completely untouched — only JSX labels and doc comments describing them were updated, per the plan's explicit 'labels only' instruction."

requirements-completed: [NOM-01, NOM-02, NOM-03, NOM-04, NOM-05]

duration: ~25min
completed: 2026-07-10
---

# Quick Task 260710-k8y: Implement Prompt Lab Nomenclature Proposal Summary

**Renamed the dispatch-control Prompt Lab's system vocabulary ("Agent system prompts", "Test run", "Activate") to newsroom copy ("Job Descriptions", "Rehearsal", "Make live") across 8 components, added a required save-note gate (blocking Confirm save on an empty/whitespace note) and actionable unknown-variable microcopy, with all strings copied verbatim from PROPOSAL.md — no data-model, Convex, route-slug, or enum changes.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-10T14:46:00-07:00 (approx.)
- **Completed:** 2026-07-10T15:18:00-07:00
- **Tasks:** 3
- **Files modified:** 10 (1 created, 9 modified — excluding this SUMMARY)

## Accomplishments

- **Task 1 — Group taxonomy + agent display names:** `agentList.ts` GROUP_LABELS renamed to House Rules / Job Descriptions / Section Briefs / Assignment Memos; added `GROUP_DESCRIPTORS` (one-liner per group) and `AGENT_DISPLAY_NAMES` (12 curated titles, e.g. "Editor — Picks the Winner" vs "Editor — Publish Brief" to disambiguate the two Editor agents) plus a `displayNameForAgentKey()` resolver that falls back to the existing `humanizeAgentKey()`. `page.tsx`'s `GROUP_ORDER` reordered to put House Rules (highest editorial leverage) first and Assignment Memos (plumbing) last. `PromptsListClient.tsx` renders the new descriptors under each group header, uses display names in cards and the search haystack (raw slug still searchable), renames the "Drift only" filter to "Edits only", and the drift badge to "edited since launch".
- **Task 2 — Rehearsal panel + assembled preview:** `TestRunPanel.tsx`'s "Test run" heading becomes "Rehearsal"; the three input modes are relabeled Sample week / Your own input / Replay a real run (enum values `fixture`/`manual`/`prior` untouched) with a new `MODE_DESCRIPTORS` line shown beneath the radiogroup; the fixture inline copy drops the stale word "canned"; the compare action is relabeled "Draft vs. live" with its own descriptor caption; the result column and score-delta text read "Live" / "vs live" instead of "Active" / "vs active". `AssembledPreview.tsx`'s disclosure summary becomes "What the agent sees" with the full model-input descriptor, preserving the "not a test-run" caveat.
- **Task 3 — Required save note + versioning copy + unknown-variable microcopy:** `PromptSaveDialog.tsx` now resolves the next version number via a `listForAgent` query and shows "Save draft as v{n}"; the note field is required — Confirm save is disabled (`disabled={disabled || saving || noteEmpty}`) until a non-whitespace note is typed, with an inline hint. `PromptEditor.tsx`'s save button reads "Save draft as new version"; the unknown-variable warning banner and button title now read `"{token} isn't supplied by the pipeline — remove it or ask your developer to wire it"` per token. `VersionHistoryPanel.tsx`'s active badge reads "LIVE", the activate/rollback controls read "Make live" / "Restore this version" (with "Making live…" transient), and compare-selector markers read "(live)". All activation/override/rollback mutation logic is untouched — labels only.
- New `__tests__/PromptSaveDialog.test.tsx` (5 tests) mirrors the `AddCorrectionDialog.test.tsx` Convex-mock pattern and proves: the heading resolves "Save draft as v3" from a mocked 2-version history; Confirm save is disabled on empty note; enabled once a real note is typed; disabled again on whitespace-only; and clicking Confirm with a real note calls `saveVersion` exactly once with the trimmed note.
- Full sweep for all 15 stale strings named in the plan's verification section (`"Test run"`, `"Canned fixture"`, `"Manual variables"`, `"Prior-real input"`, `"Compare against active"`, `"Assembled preview"`, `"Note (optional)"`, `"Rollback to this version"`, `"Drift only"`, `"edited since seed"`, `"Resolve unknown variables"`, `"Agent system prompts"`, `"User templates"`, `"Section guidance"`, `"Shared assets"`) across all 8 edited component files returns clean, including lowercase doc-comment echoes found and updated along the way (`TestRunPanel.tsx` internal comments, `VersionHistoryPanel.tsx` top docblock, `PromptSaveDialog.tsx` top docblock).
- `pnpm --filter dispatch-control build` exits 0 and the full vitest suite is green (517 tests passed, 2 todo, 1 file skipped) after every task.

## Task Commits

Each task was committed atomically:

1. **Task 1: Group taxonomy, descriptors, agent display names, page order + list microcopy** - `aa818f5` (feat)
2. **Task 2: Rehearsal (test-run) panel + assembled preview copy** - `9400024` (feat)
3. **Task 3: Versioning controls copy + required-note gate + unknown-variable microcopy** - `e3bdb0d` (feat)

_No separate plan-metadata commit — this SUMMARY.md is the only remaining artifact; per this quick task's constraints, ROADMAP.md is not touched._

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/agentList.ts` - renamed `GROUP_LABELS`, added `GROUP_DESCRIPTORS`, `AGENT_DISPLAY_NAMES`, `displayNameForAgentKey()`
- `apps/dispatch-control/app/(dashboard)/prompt-lab/page.tsx` - `GROUP_ORDER` reordered to `[asset, system, section-guidance, user-template]`
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptsListClient.tsx` - group descriptors rendered, display names in cards/search, "Edits only" filter, "edited since launch" badge, reordered `GROUP_FILTER_OPTIONS`
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx` - "Rehearsal" heading, relabeled modes + `MODE_DESCRIPTORS`, "Draft vs. live" compare action + descriptor, "Live" result column/score-delta labels, updated internal doc comments
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AssembledPreview.tsx` - "What the agent sees" disclosure + descriptor
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptEditor.tsx` - "Save draft as new version" button, actionable unknown-variable copy (banner + title)
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptSaveDialog.tsx` - `useQuery(listForAgent)` for `nextVersion`, "Save draft as v{n}" heading, required-note gate (`noteEmpty`), inline hint
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` - "LIVE" badge, "Make live"/"Restore this version" controls, "(live)" compare markers
- `apps/dispatch-control/__tests__/PromptSaveDialog.test.tsx` - new test file, 5 tests
- `.planning/quick/260710-k8y-implement-prompt-lab-nomenclature-propos/PROPOSAL.md` - committed as provenance (Task 1)
- `.planning/quick/260710-k8y-implement-prompt-lab-nomenclature-propos/260710-k8y-PLAN.md` - committed alongside PROPOSAL.md (Task 1)

## Decisions Made

- Followed the plan's explicit instruction to keep `PromptEditor.tsx` free of any unconditional `useQuery` — the v{n} number is resolved only inside `PromptSaveDialog`, preserving the existing Convex-provider-less smoke test for `PromptEditor`.
- Used a plain string literal for the "isn't supplied by the pipeline" copy instead of the `&apos;` HTML-entity pattern seen elsewhere in this codebase, since the plan's verify gate greps for a literal straight apostrophe and no ESLint config in this repo enforces entity-escaping.
- Extended the "no stale strings" sweep beyond the plan's literal grep list to catch lowercase doc-comment echoes of the same renamed concepts (e.g. `// Compare against active` internal comment in `TestRunPanel.tsx`, the "Rollback to this version" mention in `VersionHistoryPanel.tsx`'s top docblock) — updated for consistency even though the plan's exact-case grep wouldn't have caught them, since stale internal comments describing renamed UI would otherwise mislead the next developer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `toBeDisabled` matcher unavailable in this test config**
- **Found during:** Task 3, first vitest run of the new `PromptSaveDialog.test.tsx`
- **Issue:** The plan's described assertions implied jest-dom's `toBeDisabled()` matcher; this repo's vitest setup does not extend `expect` with `@testing-library/jest-dom` matchers (confirmed by grepping the existing test suite, which asserts `button.disabled` as a plain boolean property, e.g. `DecisionRail.test.tsx`).
- **Fix:** Rewrote the three disabled-state assertions to cast the queried button to `HTMLButtonElement` and assert `.disabled` directly (`expect(confirmButton.disabled).toBe(true/false)`), matching this codebase's established convention.
- **Files modified:** `apps/dispatch-control/__tests__/PromptSaveDialog.test.tsx`
- **Verification:** All 5 tests pass; full suite green.
- **Committed in:** `e3bdb0d` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (test-infrastructure adjustment, no product-code impact).
**Impact on plan:** None beyond the test file itself — the required-note gate logic exactly matches the plan's spec.

### Plan-verify grep false negatives (not deviations — documented for the record)

Two of the plan's literal single-line `grep -q` checks reported false negatives against otherwise-correct, semantically-verified code, both due to pre-existing multi-line JSX/array formatting conventions already present in the files before this task:

1. **T1: `grep -q "'asset', 'system', 'section-guidance', 'user-template'"` against `page.tsx`** — `GROUP_ORDER` was already formatted as a multi-line array (one literal per line, matching the original file's style) both before and after this edit; the literal single-line grep pattern can't match across newlines. Verified semantically correct via `tr '\n' ' ' | grep -oE "GROUP_ORDER: EditableAgentGroup\[\] = \[[^]]*\]"`, which confirms the exact order `asset, system, section-guidance, user-template`.
2. **T1: `! grep -qi "prompt lab" docs/API_CONTRACTS.md`** — this check already fails on the unmodified baseline: `docs/API_CONTRACTS.md` contains a pre-existing `## §38 — Prompt Lab Evals + Eval Center (Phase 38)` heading, unrelated to this nomenclature task and predating it (from an earlier Phase 38 commit). Confirmed via `git diff --stat -- docs/API_CONTRACTS.md` showing zero changes across all three of this task's commits — the file is genuinely untouched by this work.
3. **T3: `grep -q ">LIVE<"` against `VersionHistoryPanel.tsx`** — the `LIVE` badge's JSX text sits on its own line inside the `<span>` (matching the pre-existing multi-line formatting the original "Active" text used), so `>LIVE<` never appears as contiguous characters in the source. Verified semantically via `tr -s ' \n' ' ' | grep -oE ">[[:space:]]*LIVE[[:space:]]*<"`, confirming the rendered text content is exactly "LIVE".

None of these represent an actual defect in the implementation; all three are artifacts of literal single-line grep patterns applied to genuinely correct, Prettier-consistent multi-line source. No code changes were made in response to these three false negatives beyond what was already correct.

## Issues Encountered

- None beyond the plan-verify grep false negatives and the `toBeDisabled` test-matcher adjustment documented above.

## User Setup Required

None — this is a pure UI copy/microcopy change with one deliberate, self-contained behavior change (required save note). No new dependencies, environment variables, or infrastructure.

## Next Phase Readiness

- The Prompt Lab now speaks the newsroom register end-to-end (group taxonomy, agent titles, rehearsal panel, versioning controls, unknown-variable guidance) per PROPOSAL.md.
- Slugs, routes, the `InputMode` enum (`'prior' | 'manual' | 'fixture'`), `TestRunBody` payload keys, and all Convex mutation/query signatures are unchanged — verified via `docs/API_CONTRACTS.md` having zero diff across all three commits and via `grep -qF "InputMode = 'prior' | 'manual' | 'fixture'"` still matching.
- No further follow-up work is implied by this task; it is a complete, self-contained copy pass.

---
*Quick task: 260710-k8y*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/app/(dashboard)/prompt-lab/_components/agentList.ts
- FOUND: apps/dispatch-control/app/(dashboard)/prompt-lab/page.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptsListClient.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AssembledPreview.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptEditor.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptSaveDialog.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
- FOUND: apps/dispatch-control/__tests__/PromptSaveDialog.test.tsx
- FOUND: .planning/quick/260710-k8y-implement-prompt-lab-nomenclature-propos/PROPOSAL.md
- FOUND: commit aa818f5 (Task 1)
- FOUND: commit 9400024 (Task 2)
- FOUND: commit e3bdb0d (Task 3)
