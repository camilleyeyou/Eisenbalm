---
phase: quick-261021-7aw
plan: 01
subsystem: pipeline-qa, publish-gates, dispatch-control
tags: [qa, self-fix, publish-gate, convex, editor-ux]
requirements: [QUICK-261021-7aw]
key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/self_fix.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/claim_fixes.py
    - packages/pipeline/tests/agents/qa/test_self_fix.py
    - packages/pipeline/tests/test_claim_fixes.py
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/AgentChangesNote.tsx
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/api/{signoffs,review,control,webhooks,voice_pass}.py
    - convex/{schema,qaCorrections,claimChecks}.ts
    - apps/dispatch-control/lib/{homeSections,publishChain}.ts and the front-door / section-reader / DecisionRail components
decisions:
  - "Contradicted claims are fixed by removing the sentence (no extra LLM call, cost containment); row status removed or skipped, never pending."
  - "Not-written sections do not block Publish; the row still reads 'Not written yet'."
  - "Theme safe font defaults are Playfair Display / Lora (design's Source Serif Pro fails the render whitelist)."
metrics:
  tasks: 3
  completed: 2026-10-21
---

# Quick 261021-7aw: Agents review and self-fix every section; remove all content gates from publishing

The pipeline now fixes its own QA findings, theme values and contradicted claims before the Sanity draft is written. Publish, schedule, publish-manual and the Sanity webhook no longer refuse on findings, claims or sign-offs. The editor path lost its must-fix and remix UX.

## What changed

**Task 1 (commit 7fa74808): pipeline self-fix**
- `agents/qa/self_fix.py`: `apply_self_fixes` applies a finding only when its `quotedSpan` occurs exactly once in the section (D-12). Voice-axis findings without a fix get an LLM house-voice rewrite via the shared `generate_voice_rewrite`, which the Voice Pass endpoint now also uses. `correct_theme` replaces invalid hex colors and fonts with safe defaults. Every failure becomes `agent-skipped`.
- `agents/qa/__init__.py`: reviews 8 text sections (adds `deliberation_conversation` and `podcast`) plus theme. Every `qaCorrections` row is inserted closed (`agent-applied` or `agent-skipped`, `resolvedBy: pipeline-agent`). A self-fix exception degrades to all-skipped and the run continues.
- `lib/claim_fixes.py`, wired into the publisher before `write_issue_draft`: cuts the sentence carrying each contradicted claim. Row status is `removed`, or `skipped` when the sentence cannot be located uniquely. Sibling `blockIndexHint`s are kept aligned when a whole block is dropped.
- Convex: `resolution` union gains `agent-applied` and `agent-skipped`. `qaCorrections:insert` accepts the resolution fields. `claimChecks:insertBatch` accepts an optional `status`.

**Task 2 (commit 5f14897e): server gates removed**
- `signoffs.py`: the facts-cleared claim and error-finding gates and the sounds-human voice gate are gone. Role, `run_not_reviewable`, `no_sanity_issue` and 404 are kept.
- `review.py` (publish and schedule), `control.py` (publish-manual) and `webhooks.py`: the `missing_signoffs` checks are gone. The webhook still reverts and alerts on a missing `runId` (`blocked: no_run_id`).
- `prompts/rubric.md` mirrors the new `rubric.md` input keys (a byte-equivalence test requires this).
- `docs/API_CONTRACTS.md` amended (§26.7, §34.3, §34.4, §34.5, §36.7, §51.1.8 plus a new section). Studio README and EDITOR_GUIDE reworded.

**Task 3 (commit 9971274e): client**
- `homeSections.ts`: no `fix` state or footer; every row links to `/s/{id}`; footer is `ready` once the run is finished and inputs are loaded; rows carry `agentChanges`.
- `publishChain.ts` calls `publishIssue` only.
- `/s/[section]`: `Galley hideFindings` (also hides the "Ask agent to revise" toolbar action), no Accept/Dismiss/revise UI, read-only `AgentChangesNote`. Hand-edit via the passage toolbar still works.
- `DecisionRail`: `publishDisabled = held || busy`, sign-offs relabelled "(optional)", the "unlocks when" and "both sign-offs required" copy removed.
- `FindingResolution` type exported from `lib/galley/findingState.ts` and used in all 11 places that declared the resolution literal.

## Verification

| Check | Result |
| --- | --- |
| Pipeline pytest, full suite | 939 passed, 38 skipped (skips need `SUPABASE_POSTGRES_URL`) |
| dispatch-control vitest, full suite | 1367 passed, 2 todo (157 files passed, 1 skipped) |
| `pnpm --filter dispatch-control build` (strict) | Succeeded |
| Convex `dev:once` | Ran after the Task 1 Convex edits. Succeeded (dev:modest-magpie-797), no credential errors |
| grep for the old gate reasons in `api/` | Clean except the amendment docstring in `review.py` |
| grep for "things to fix" and similar copy in `apps/dispatch-control` | Clean |

## Deviations from Plan

1. **[Rule 3] Voice Pass test patch target.** `test_voice_pass_endpoints.py` now patches `agents.qa.self_fix.acomplete`, because the helper moved there.
2. **[Rule 3] Prompt seed mirror.** `prompts/rubric.md` had to be updated alongside `agents/qa/rubric.md` (`test_rubric_seed_byte_equivalence`). That file landed in the Task 2 commit, so the full pipeline suite was briefly red at the Task 1 commit.
3. **Claim section ids.** The plan said kebab-case galley ids, but `lib/claims.py` emits camelCase (`originStory`). `claim_fixes` maps both.
4. **`PassageToolbar.hideRevise`.** Added so "Ask agent to revise" disappears from `/s/[section]`; the toolbar always rendered it otherwise.
5. **`SectionReaderPage` tests rewritten.** Hand-edit tests now open the editor through a mocked text selection instead of a finding mark. The old group-accept and hash-scroll tests were replaced by "no must-fix UX" tests.

## Notes for the orchestrator

- `SectionEndNav` on `/s/[section]` was not in the plan's file list and is unchanged. Legacy runs with open findings can still show "N of 9 sections still need you" there; new runs have no open rows, so it reads "All 9 sections are clean".
- `ResolvedFindingsList` in the old console will now list `agent-applied` and `agent-skipped` rows with that badge.
- `qaCorrections:insert` remains the deliberately public mutation (GAM-05). It now also accepts the resolution fields.
- Not pushed, not deployed. Pre-existing working-tree changes (`.planning/config.json`, the .docx, other planning files) were left unstaged.

## Self-Check: PASSED

Files and commits verified: 7fa74808, 5f14897e, 9971274e.
