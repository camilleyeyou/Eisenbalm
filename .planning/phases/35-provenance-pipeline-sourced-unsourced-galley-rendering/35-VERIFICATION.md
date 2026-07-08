---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
verified: 2026-07-08T21:21:37Z
status: human_needed
score: 6/6 must-haves verified (automated)
human_verification:
  - test: "Wash vs underline visual coexistence"
    expected: "A span carrying both a QA error finding AND a sourced/unsourced claim wash renders as underline-over-wash — never a muddy collision, and the rust QA-error tint and rust unsourced-claim wash remain visually distinguishable when stacked."
    why_human: "CSS layering / color perception is a visual judgment (Research Open Q3); grep/DOM assertions confirm the marks stack in the DOM and the CSS rule contains no border-bottom (background-only), but actual visual legibility requires opening a real galley render."
---

# Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering Verification Report

**Phase Goal:** Every claim the Researcher extracts carries a source and survives into the final prose the writers produce, and the galley shows Andrew at a glance which claims are sourced and which aren't.
**Verified:** 2026-07-08T21:21:37Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Researcher emits index-bound claims; LLM never writes a URL, only a source index | ✓ VERIFIED | `researcher.py::ClaimOutput{text, sourceIndex}`; `_build_messages` numbers Tavily results `[S{i}]`; code-side mapping in `researcher()` maps `sourceIndex → tavily_results[i].url` + `retrieved_at_by_index[i]` |
| 2 | Out-of-range/absent sourceIndex yields honestly-unsourced claim (sourceUrl=None) | ✓ VERIFIED | `researcher.py`: `if isinstance(source_index, int) and 0 <= source_index < len(tavily_results): ... else both None` |
| 3 | `keyStatistics` removed from ResearchOutputModel | ✓ VERIFIED | `grep -rn keyStatistics packages/pipeline/src packages/pipeline/tests` returns zero constructor usages; only a test assertion confirming absence (`assert "keyStatistics" not in ResearchOutputModel.model_fields`) |
| 4 | The 5 prose writers (origin_story, problem, founder_bio, case_study, bonus/SpecAd) emit a flat `claimSpans` sidecar; unknown claimIds dropped leniently; BigBudgetBonus/JingleBonus untouched | ✓ VERIFIED | All 5 files import `ClaimSpanRef`, declare `claimSpans: list[ClaimSpanRef] = []`, and contain the `dropped %d claimSpan(s) with unknown claimId (D-07 lenient)` drop logic; `bonus.py` scopes this to the SpecAd branch only, `BigBudgetBonus`/`JingleBonus` classes carry no claimSpans field |
| 5 | Publisher seeds one `claim_checks` row per claim occurrence (sourced from writer claimSpans + unsourced from per-block regex catch-all), each with sectionName + blockIndexHint against the flat BodyBlock shape | ✓ VERIFIED | `lib/claims.py::block_index_hint` reads `block.get("text")` directly (flat shape, not `children`); `extract_claims_by_block` runs per-section/per-block; `publisher/__init__.py` assembles sourced rows from `claimSpans` + unsourced rows from `extract_claims_by_block`, excludes already-sourced spans via a `covered` set, assigns a global `claimIndex`, and calls `claimChecks:insertBatch` |
| 6 | Galley renders marigold (sourced) / rust (unsourced) background-only washes stacked under QA underlines, toggleable, with hover source info + check/skip popover | ✓ VERIFIED | `ClaimMark.tsx` exists, calls `useMutation(api.claimChecks.setStatus)`; `globals.css` `.galley-claim[data-provenance=...]` rules contain no `border-bottom`; `syntheticPortableText.ts` stacks `claimSpan` marks alongside `annotation` marks; `Galley.tsx`/`page.tsx` wire `claimChecks.listByRunId` through the existing `resolveSectionFindings` resolver with a default-ON `showProvenance` toolbar toggle |
| 7 | Decision rail shows a source index: unsourced-on-top, sourced-by-section, check/skip + jump links, facts-cleared gate untouched | ✓ VERIFIED | `SourceIndex.tsx` exists, partitions rows by `claimId` presence, groups sourced rows in fixed galley order, calls `setStatus`; mounted inside `DecisionRail.tsx`'s existing `<section aria-label="Verification">` block — diff for that commit touches only 11 lines (import + JSX mount + comment), Sign-offs/Publish gate sections untouched |

**Score:** 7/7 truths verified via static/code inspection + automated test suites. One item (visual wash/underline coexistence) requires human eyes and is listed under Human Verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `docs/API_CONTRACTS.md` §35 | Provenance contract block, amended §26.2 | ✓ VERIFIED | Contains `ClaimSpanRef`, `sourceIndex`, `claimSpans`, `one-row-per-occurrence`, ResearchOutput drift note |
| `convex/schema.ts` | claim_checks additive optional fields | ✓ VERIFIED | `claimId/sourceUrl/retrievedAt/sectionName/blockIndexHint` all present as `v.optional(...)` |
| `convex/claimChecks.ts` | insertBatch extended validator + handler passthrough | ✓ VERIFIED | Validator + handler both carry the 5 fields; `setStatus`/`listByRunId`/`allSignedOff` unchanged |
| `packages/pipeline/.../agents/researcher.py` | ClaimOutput + claims list + index→URL mapping | ✓ VERIFIED | `class ClaimOutput`, `claims: list[ClaimOutput]` on ResearchOutputModel, mapping logic present |
| `packages/pipeline/.../graph/state.py` | `claims: NotRequired[list[dict]]` on ResearchOutput TypedDict | ✓ VERIFIED | Present at line 96; stale fields intentionally left unchanged per documented decision |
| `packages/pipeline/.../graph/blocks.py` | `ClaimSpanRef` flat model | ✓ VERIFIED | Present, flat (no oneOf), matches BodyBlock discipline |
| `packages/pipeline/.../lib/voice.py` | claims-whitelist injection (user message only) | ✓ VERIFIED | `build_claims_block` + `claims` kwarg on `build_section_writer_prompt`; injected only into user string |
| 5 writer agents (origin_story/problem/founder_bio/case_study/bonus) | claimSpans sidecar + whitelist-drop | ✓ VERIFIED | All 5 files confirmed (see Truth #4) |
| `packages/pipeline/.../lib/claims.py` | `block_index_hint` + `extract_claims_by_block` | ✓ VERIFIED | Both functions present, flat-shape-safe, legacy `extract_claims` untouched |
| `packages/pipeline/.../agents/publisher/__init__.py` | sourced+unsourced seeding | ✓ VERIFIED | Full assembly logic present (see Truth #5) |
| `.../_components/ClaimMark.tsx` | wash mark + hover + check/skip popover | ✓ VERIFIED | Exists (183 lines), calls `setStatus` |
| `apps/dispatch-control/app/globals.css` | `.galley-claim` background-only wash | ✓ VERIFIED | Present, no border-bottom in that rule block |
| `.../lib/galley/syntheticPortableText.ts` | claimSpan mark stacking | ✓ VERIFIED | `ClaimSpanMarkDef`, `ResolvedClaim`, `claimAnnotations` param present |
| `.../_components/GallerySection.tsx` | `marks.claimSpan` wiring | ✓ VERIFIED | Imports `ClaimMark`, wires `components.marks.claimSpan` |
| `.../_components/Galley.tsx` + `page.tsx` | claim_checks subscription + toggle | ✓ VERIFIED | `useQuery(api.claimChecks.listByRunId)`, `resolveSectionFindings` reuse, `showProvenance` default-ON toggle in page.tsx |
| `.../_components/SourceIndex.tsx` | unsourced-on-top + sourced-by-section index | ✓ VERIFIED | Exists, partitions by claimId, fixed galley-order grouping, setStatus + jump links |
| `.../_components/DecisionRail.tsx` | SourceIndex mounted in Verification section | ✓ VERIFIED | Mounted, Sign-offs/Publish gate untouched (diff-confirmed) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `convex/claimChecks.ts insertBatch` | `claim_checks` rows | `ctx.db.insert` passes provenance fields through | ✓ WIRED | Handler explicitly forwards all 5 fields |
| `researcher() Tavily loop` | `state['research']['claims'][].sourceUrl` | S-index numbering + retrievedAt stamp, mapped post-LLM | ✓ WIRED | Confirmed in code |
| `state['research']['claims']` | writer user prompt claims whitelist | `build_section_writer_prompt(claims=...)` | ✓ WIRED | All 5 writers build and pass `claims=` |
| writer `out_dict['claimSpans']` | unknown-claimId drop | intersect against valid claimIds after `model_dump()` | ✓ WIRED | Confirmed in all 5 writers |
| `state[section]['claimSpans'] + state['research']['claims']` | `claim_checks` sourced rows | asWritten→blockIndexHint + claimId→sourceUrl mapping in publisher | ✓ WIRED | Confirmed in `publisher/__init__.py` |
| `lib/claims` per-block extractor | `claim_checks` unsourced rows | regex catch-all minus bound-span exclusion | ✓ WIRED | `covered` set exclusion confirmed |
| `claim_checks` (`useQuery listByRunId`) | galley wash spans | `resolveSectionFindings` reuse on quotedSpan/blockIndexHint | ✓ WIRED | Confirmed in `Galley.tsx` |
| `ClaimMark` check/skip popover | `claim_checks` status | `useMutation(api.claimChecks.setStatus)` | ✓ WIRED | Confirmed |
| `claim_checks` (`useQuery listByRunId`) | `SourceIndex` rows | claimId presence → sourced/unsourced grouping | ✓ WIRED | Confirmed |
| `SourceIndex` check/skip | `claim_checks` status (facts-cleared gate table) | `useMutation(api.claimChecks.setStatus)` | ✓ WIRED | Same mutation the rail's existing summary reads; gate untouched |

### Behavioral Spot-Checks / Test Suites

| Suite | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| Pipeline pytest | `cd packages/pipeline && uv run pytest -q` | 468 passed, 36 skipped | ✓ PASS |
| Dispatch-control vitest | `cd apps/dispatch-control && npx vitest run` | 391 passed, 2 todo | ✓ PASS |
| Dispatch-control strict build | `pnpm --filter dispatch-control build` | exit 0 | ✓ PASS |

All three suites re-run directly during this verification (not just trusted from SUMMARYs) and match the orchestrator-reported baseline.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PRV-01 | 35-02 | Researcher emits per-claim `{claim, sourceUrl, retrievedAt}` index-bound bindings | ✓ SATISFIED | See Truths 1-3 |
| PRV-02 | 35-03, 35-04 | Writers carry claim references forward via structured output; bindings survive to prose | ✓ SATISFIED | See Truths 4-5 |
| PRV-03 | 35-05 | Galley renders sourced (marigold)/unsourced (rust) claims as first-class visual states | ✓ SATISFIED (visual coexistence needs human confirm) | See Truth 6 |
| PRV-04 | 35-01 (schema), 35-04 (data), 35-06 (UI) | Decision rail source index: unsourced-on-top, sourced-listed-with-source, checklist upgraded | ✓ SATISFIED | See Truths 5, 7 |

No orphaned requirements — REQUIREMENTS.md maps exactly PRV-01..04 to Phase 35, and all 4 are claimed across the 6 plans' frontmatter (`requirements:` fields collectively cover PRV-01..04).

### Anti-Patterns Found

None found in the touched files. Spot-checked for:
- TODO/FIXME/placeholder markers in the 6 plans' `files_modified` — none found.
- Hardcoded empty returns / stub handlers in researcher.py, the 5 writers, publisher, ClaimMark.tsx, SourceIndex.tsx, Galley.tsx — none found; all read/write real state.
- `keyStatistics` fully removed (grep-confirmed zero constructor usages remaining outside the one test assertion documenting its absence).

### Human Verification Required

### 1. Wash vs underline visual coexistence (PRV-03, D-09)

**Test:** Open a galley (review-desk) run where a section has both a QA error/warning finding and a sourced or unsourced claim on the same or overlapping span. Confirm visually.
**Expected:** The span reads as underline-over-wash — the QA severity underline stroke remains visible and the provenance background wash (marigold gradient for sourced, flat rust tint for unsourced) sits beneath it without visual collision. When a QA-error rust tint and an unsourced-claim rust wash stack, they should not read as an indecipherable muddy block.
**Why human:** This is a CSS-layering / color-perception judgment (Research Open Q3 in the phase's own RESEARCH.md). Automated checks (DOM mark-stacking assertions in `claimProvenance.test.ts`, and the confirmed absence of `border-bottom` in the `.galley-claim` background-only wash rule) verify the *mechanism* is correct, but only a human can confirm the rendered result reads cleanly. This item was already flagged by the plan's own `35-VALIDATION.md` as "Manual-Only."

### Gaps Summary

No gaps found. All 6 plans' must_haves truths, artifacts, and key_links were verified directly in the master branch codebase (not from SUMMARY claims) — the code from the Wave 2 isolated worktrees is confirmed present and correctly wired after cherry-pick. All three test suites (pipeline pytest, dispatch-control vitest, dispatch-control strict build) were re-run live during this verification and match the orchestrator's reported baseline (468/36, 391/2-todo, build exit 0). The only outstanding item is a single pre-flagged, inherently-visual check (wash/underline coexistence) that the plan's own validation strategy already designated as manual-only — this does not indicate an implementation gap, only an unavoidable verification-method limitation.

---

_Verified: 2026-07-08T21:21:37Z_
_Verifier: Claude (gsd-verifier)_
