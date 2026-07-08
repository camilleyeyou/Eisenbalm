# Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering - Research

**Researched:** 2026-07-08
**Domain:** LangGraph pipeline structured-output schema evolution + Convex-backed span provenance rendering in a native (non-iframe) galley
**Confidence:** HIGH (all findings verified against live source, not training-data assumption)

## Summary

This phase wires a claim-provenance thread through five layers that already exist and already cooperate on an almost-identical problem: QA severity annotations. The Researcher (`researcher.py`) already proves the "index-bound source" pattern works — `founderNameSourceUrl`/`subjectNameSourceUrl` are paired fields the LLM fills from search results it was shown. D-01 generalizes this to a full claims list bound by **source index** (S1/S2…) rather than a raw URL field, which is strictly safer (the LLM can't hallucinate a URL if it never sees or writes one — it only picks a number).

The riskier engineering surface is not the Researcher — it's getting a claim ID from a writer's structured output, through Convex, to a rendered span in the galley, without ever guessing. Phase 32/33 already built exactly this pipeline for QA findings (`quotedSpan` + `blockIndexHint` + a three-stage exact → quote-normalized → whitespace-tolerant resolver, "never guess" is a hard contract). The correct move for Phase 35 is to **mirror that pattern for claims, not invent a new one**: writers emit `claimSpans: [{claimId, asWritten}]` as a sibling field next to `body` (never inside the Portable Text itself); the publisher computes a `blockIndexHint` for each span the same way QA does (with a caught, verified bug in the existing helper — see Pitfalls); the resolved span renders as a second, independent `@portabletext/react` mark type living happily alongside `marks.annotation` (spans already carry a `marks: string[]` array, so stacking a wash mark under/over an underline mark is a solved layering problem, not a new one).

The regex catch-all (`lib/claims.py::extract_claims`) already runs at publish time and already writes to `claim_checks`. It currently dedupes and flattens ALL sections into one global ordinal list with no section/block affiliation — this is the one piece of real re-engineering the phase requires, because the galley needs to know *which section, which block* an unsourced claim lives in to tint it, and the current extractor throws that information away by joining every section's text into one string before matching. Fixing this (per-section, per-block extraction while preserving full recall) is the single largest scope item hiding inside an otherwise "wire two existing things together" phase.

**Primary recommendation:** Extend `claim_checks` with additive optional fields (`claimId`, `sourceUrl`, `retrievedAt`, `sectionName`, `blockIndexHint`) exactly as Phase 32/33 extended `qaCorrections`. Run the regex catch-all **per-section, per-block** (not globally joined) so every row — sourced or unsourced — carries a resolvable anchor. Keep claim provenance entirely inside Convex; do not touch the Sanity draft schema or the `GET /issues/{run_id}/draft` read shape at all.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Claim model & Researcher binding**
- D-01: Index-bound sources — the LLM never writes a URL. Code numbers each Tavily result (S1, S2…) before the parse call; the Researcher's output model emits claims with a source index, and code maps index → the real result URL + `retrievedAt` (the actual search timestamp, stamped code-side). A claim with no valid index is honestly unsourced. Hallucinated/mangled URLs are structurally impossible.
- D-02: The claims list absorbs `keyStatistics`. `keyStatistics` (unsourced strings) is replaced by the sourced claims list. Founder and subject names become claims too, but the existing `founderName`/`founderNameSourceUrl`/`subjectName`/`subjectNameSourceUrl` paired fields stay as-is for back-compat with writers/consumers that read them. One canonical claim store; no parallel unsourced stats list.
- D-03: `claim_checks` upgrades in place. Add optional fields (`claimId`, `sourceUrl`, `retrievedAt`, and whatever span-anchor fields planning needs) to the existing Convex `claim_checks` table. The checklist, source index, galley tints, and the Phase 34 facts-cleared prerequisite all keep reading ONE table. Legacy rows (no source fields) degrade honestly to unsourced. No new table, no join.
- D-04: Regex catch-all defines "unsourced." The existing deterministic extractor (`lib/claims.py`) still runs over final prose. Any extracted claim-looking span NOT covered by a writer claim reference becomes an unsourced claim (rust). Sourced = writer-referenced binding; unsourced = everything else the regex finds. Nothing factual escapes the checklist.

**Writer claim-carrying mechanics**
- D-05: Claim-span sidecar on writer output. Prose writer output models gain a flat field: `claimSpans: [{claimId, asWritten}]` — `asWritten` is the verbatim phrase as the writer wrote it in the body. Resolved in the galley by the existing Phase 32 span-resolver machinery. Schema must stay `oneOf`-free.
- D-06: Prose writers only. `claimSpans` lands on the BodyBlock-emitting writers (origin_story, problem, founder_bio, case_study, bonus). The game and other non-prose outputs are exempt; their factual content still gets regex-extracted into the checklist as unsourced-by-default rows.
- D-07: Lenient enforcement, honest fallback. Invalid `claimId` references are dropped at validation (logged, never fatal); bound facts the writer wrote without referencing simply fall through to the D-04 regex catch-all and show as unsourced. No hard validator, no retry loop on claim coverage.
- D-08: Post-edit behavior is a natural consequence, not new machinery. After Andrew edits a section, spans re-resolve statelessly. A reworded sourced claim loses its highlight and the regex catch-all re-tints the new text as unsourced. No re-binding UI this phase.

**Galley rendering**
- D-09: Wash vs underline. Provenance renders as a background wash (marigold = sourced, rust = unsourced). QA severity annotations keep their Phase 32 underlines. A span carrying both reads as underline-over-wash.
- D-10: Provenance layer on by default, toggleable. A galley-toolbar toggle switches the provenance layer off. Mirrors the existing galley/iframe toggle pattern on this screen.
- D-11: Hover info + click to act. Hover on a sourced claim = tooltip (source URL + retrieved date). Click = popover (AnnotationMark pattern) with "Open source" link and Mark checked / Skip — writing the same `claim_checks` status the rail reads.

**Source index & checklist upgrade**
- D-12: Same gate contract, faster to satisfy. Every claim — sourced or not — still requires a human check/skip; a source existing ≠ verified. Phase 34's facts-cleared prerequisite is untouched; no gate rework, no bulk-check, no auto-check.
- D-13: The source index IS the checklist. The rail's new source index merges index + checklist into one surface: each row = claim text + sourced/unsourced state + check/skip control + jump link to its galley span. Unsourced group pinned on top. The Phase 26 `ClaimsChecklist.tsx` stays byte-functional as the fallback.
- D-14: Sourced claims ordered by section, reading order. Below the unsourced group, sourced claims group by section in galley order, each showing its source.

### Claude's Discretion
- Exact claim ID scheme, `ResearchOutputModel` claims-field shape, and the Tavily source-index plumbing (S1/S2 enumeration in the prompt, index→URL mapping).
- `claim_checks` new-field names and any index changes; where seeding happens in the pipeline — contract-first: amend `docs/API_CONTRACTS.md` before schema/endpoint code.
- Whether claimSpan galley resolution reuses `spanResolver.ts` directly or a parallel resolve pass with the same normalization/never-guess rules; how sourced-claim spans and regex-unsourced spans are matched/deduplicated against each other.
- Tooltip/popover implementation details, wash CSS treatment within the 1c token system, toggle placement, checked-claim visual state (e.g., dimmed wash).
- How the D-04 regex pass runs client-side vs pipeline-side for the galley tints — planner decides where extraction for rendering happens, keeping full-recall parity with the checklist seeding.
- Migration posture for in-flight/legacy runs (optional fields mean old runs render all-unsourced — acceptable; no backfill required).
- Whether the game/bonus/podcast sections show a per-section "n unsourced claims (not highlightable)" note in the index vs plain rows.

### Deferred Ideas (OUT OF SCOPE)
- Voice Pass machine-tell screen — Phase 36.
- hookClaim/hookVerified + Signal Desk — Phase 37.
- Unsourced-claims-escalate gate (skip-with-reason required) — not chosen.
- Bulk-check sourced claims — not chosen (invites rubber-stamping).
- Manual re-binding UI for claims orphaned by edits — not chosen.
- Distinct provenance colors outside marigold/rust — not chosen.
- claimSpans on the game/non-prose writers — not chosen.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRV-01 | Researcher emits per-claim `{claim, sourceUrl, retrievedAt}` bindings | §"Researcher — exact current shape" below: `ResearchOutputModel` fully read; index-binding mechanics and `retrievedAt` sourcing identified (Tavily has no timestamp field — must be code-stamped at query time). |
| PRV-02 | Section writers carry claim references forward via structured output, established at generation time | §"Writer claim-carrying mechanics" below: `build_section_writer_prompt` whitelist read; all 5 prose writer files read; `graph/blocks.py` flat-schema constraint (verified production incident) documented; blockIndexHint computation path identified (with a verified pre-existing bug in the pattern being mirrored). |
| PRV-03 | Galley renders sourced (marigold) / unsourced (rust) as first-class visual states | §"Galley rendering mechanics" below: `GallerySection.tsx`, `syntheticPortableText.ts`, `AnnotationMark.tsx`, `globals.css` all read; exact mark-stacking mechanism for wash-under-underline identified. |
| PRV-04 | Decision rail source index + source-bound checklist | §"Decision rail & claim_checks" below: `DecisionRail.tsx` Verification section (today a one-line summary, must expand to full per-claim index) and `ClaimsChecklist.tsx` (legacy, byte-functional fallback) both read; Convex `claimChecks.ts` mutations read in full. |

## Standard Stack

No new libraries are required. This phase is 100% additive wiring inside the existing stack:

| Component | Already in use | Role in this phase |
|-----------|----------------|---------------------|
| Pydantic v2 (flat models only, no `oneOf`) | `graph/blocks.py`, all writer output models | `claimSpans: list[ClaimSpanRef]` sidecar field, same flat-schema discipline |
| `@portabletext/react` | `GallerySection.tsx` | Second `marks.*` component type for the wash layer, stacked with the existing `marks.annotation` |
| Convex (`claim_checks` table) | `convex/claimChecks.ts` | Additive optional fields; no new table |
| httpx (`agents/verify.py`) | Founder/subject name verification | Pattern precedent only — NOT reused directly (claim source verification is index-binding, not fetch-and-substring-search) |

**Installation:** none required.

**Version verification:** N/A — no new dependencies.

## Architecture Patterns

### Recommended data flow

```
Tavily results (SearchResult[])
        │  code numbers them S1..Sn, stamps retrievedAt = time of that query
        ▼
Researcher LLM call → ResearchOutputModel.claims: list[{text, sourceIndex}]
        │  code maps sourceIndex -> {sourceUrl, retrievedAt}; index out of range -> unsourced
        ▼
state["research"]["claims"]: list[{claimId, text, sourceUrl|None, retrievedAt|None}]
        │  claimId assigned by code (not the LLM) at this step — stable, collision-free
        ▼
build_section_writer_prompt(...) — inject a claims whitelist (claimId + text) into the
        user prompt for the 5 prose writers (origin_story, problem, founder_bio,
        case_study, bonus-specAd)
        ▼
Writer Pydantic output: {headline, body: list[BodyBlock], claimSpans: list[{claimId, asWritten}]}
        │  writer agent body (mirrors existing dead-letter pattern): drop any claimId
        │  not present in the claims whitelist (D-07, log + continue, never raise)
        ▼
state["<section>"]["claimSpans"]  — NEW sibling key, alongside "headline"/"body"
        (NEVER forwarded to Sanity — write_issue_draft whitelists headline/body only,
        verified: this is a feature, not a gap to fix)
        ▼
Publisher node (agents/publisher/__init__.py, after existing extract_claims call):
   1. For each section, compute blockIndexHint for each claimSpan by searching
      state[section]["body"][i]["text"] for asWritten (flat BodyBlock text field —
      NOT children[].text, see Pitfalls)
   2. Resolve claimId -> sourceUrl/retrievedAt from state["research"]["claims"]
   3. Run extract_claims PER SECTION PER BLOCK (not globally joined) for the
      unsourced catch-all; dedupe WITHIN a section+block, not across the whole run
   4. Any regex-extracted span whose normalized text matches a bound claimSpan's
      asWritten in the SAME block is excluded (already sourced)
   5. Insert ALL rows (sourced + unsourced) into claim_checks via one
      claimChecks:insertBatch call (additive fields populated where known)
        ▼
Convex claim_checks: one row per occurrence, workspace-scoped, run-scoped
        ▼
Galley (GallerySection.tsx): useQuery claimChecks:listByRunId, filter by sectionName,
        resolve via spanResolver-equivalent (quotedSpan = asWritten|text,
        blockIndexHint as hint), render marks.claimSpan wash alongside marks.annotation
        ▼
DecisionRail.tsx "Verification" section expands into the full source index (D-13):
        unsourced group (pinned top) + sourced-by-section group (D-14), both driven
        by the SAME claim_checks query already wired in
```

### Pattern: mirror the qaCorrections provenance model exactly

`qaCorrections` already solved "a fact needs to point at an exact, possibly-stale span in a possibly-edited document, and must never guess." Its shape:

```typescript
// convex/schema.ts (existing, verified)
qaCorrections: defineTable({
  ...
  sectionName: v.string(),
  quotedSpan: v.optional(v.string()),
  blockIndexHint: v.optional(v.number()),   // Phase 32 D-11 — hint only, never authoritative
  ...
})
```

Recommended `claim_checks` additive fields (mirrors this 1:1):

```typescript
claim_checks: defineTable({
  // ── existing (Phase 26/33, unchanged) ──
  workspace_id: v.string(),
  runId: v.string(),
  claimIndex: v.number(),
  text: v.string(),
  claimType: v.string(),
  context: v.string(),
  status: v.string(),
  checkedAt: v.optional(v.number()),
  // ── NEW additive (Phase 35) ──
  claimId: v.optional(v.string()),        // present only for writer-bound (sourced) claims
  sourceUrl: v.optional(v.string()),      // present only when index-bound to a real Tavily result
  retrievedAt: v.optional(v.number()),    // Unix ms, code-stamped at Tavily query time
  sectionName: v.optional(v.string()),    // 'originStory' | 'problemStatement' | ... — NEW for ALL rows (sourced + unsourced), not just legacy global rows
  blockIndexHint: v.optional(v.number()), // mirrors qaCorrections' hint-only semantics
})
```

A row with `claimId` present = sourced (marigold). A row with `claimId` absent = unsourced (rust), regardless of how old the run is — this gives you the "legacy rows degrade honestly to unsourced" behavior (D-03) for free, with zero migration.

### Pattern: mark-stacking for wash-under-underline (D-09)

`toSyntheticBlocks` (`lib/galley/syntheticPortableText.ts`) already builds a `marks: string[]` array per span and supports arbitrary additional `markDefs` — nothing about it is QA-specific. Confirmed by reading the source: a span's `marks` array can carry both an `ann-<findingId>` key (resolved by `components.marks.annotation`) and a new `claim-<claimId-or-occurrence>` key (resolved by a new `components.marks.claimSpan`). `@portabletext/react` nests mark components according to their order in the `marks` array — verify nesting order empirically in a throwaway story/test before committing to a CSS approach, because "underline-over-wash" (D-09) requires the underline-producing component to render as the *outer* (or visually-on-top) element. The simplest robust approach: give the wash a `background-color` only (no z-index tricks needed — backgrounds under text render behind glyphs, borders on `.galley-anno` render as `border-bottom` which will show regardless of nesting order since it's a 2D box property, not a stacking-context fight).

### Recommended writer-side implementation shape

```python
# packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py — NEW sibling class,
# flat, no oneOf (same discipline as BodyBlock).
class ClaimSpanRef(BaseModel):
    claimId: str
    asWritten: str = ""

# Each of origin_story.py / problem.py / founder_bio.py / case_study.py /
# bonus.py (SpecAdBonus branch only, per D-06):
class OriginStoryOutput(BaseModel):
    headline: str = ""
    body: list[BodyBlock] = []
    claimSpans: list[ClaimSpanRef] = []   # NEW, additive, defaults to []

    @field_validator('claimSpans')
    @classmethod
    def _drop_unknown_claim_ids(cls, spans, info):
        # D-07: lenient — this validator CANNOT see the whitelist (Pydantic
        # field validators are schema-local). Do the whitelist-drop in the
        # AGENT FUNCTION after acomplete() returns, not in the Pydantic model —
        # the model has no access to state["research"]["claims"].
        return spans
```

The claimId-whitelist drop (D-07) must happen in each writer's agent function body, immediately after `out_dict = out_obj.model_dump()`, by intersecting `out_dict["claimSpans"]` against the set of valid claimIds from `state["research"]["claims"]`. This is a ~5-line addition per writer (5 files), not a schema-level concern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Anchoring a quoted phrase to a block+offset in edited prose | A new claim-specific fuzzy matcher | The existing 3-stage `spanResolver.ts` algorithm (exact → quote-normalized → whitespace-tolerant), ported or directly reused | It already solves "never guess" for this exact document model; a second independent implementation risks disagreeing with the QA resolver on the same text |
| Deciding which of several textual matches is "the" match | A confidence-scored fuzzy-match heuristic | `blockIndexHint` (hint-only, never authoritative) + disambiguation-to-unresolved on ambiguity | Matches D-12's "never guess" house rule; a scored heuristic would be the first place in the codebase that *does* guess |
| Popover/tooltip interaction (hover + click + keyboard + outside-click) | A new popover component from scratch | `AnnotationMark.tsx`'s existing open/close/keyboard/outside-click state machine, parameterized for claim content instead of QA content | Byte-identical accessibility behavior (Escape, outside-click, `role="dialog"`, 44px targets) already ships and is tested |
| Per-claim check/skip mutation | A new Convex mutation | `claimChecks:setStatus` (existing, unchanged args) | Already stamps `checkedAt` correctly (§33.2) and is the exact mutation D-11 says the galley popover should reuse |

**Key insight:** every piece of machinery this phase needs to render, resolve, and act on a claim span already exists for QA findings. The work is almost entirely about producing claim data in the right shape at the right pipeline stage, not building new rendering or resolution infrastructure.

## Common Pitfalls

### Pitfall 1: The existing `_block_index_hint` QA helper is verified broken against real BodyBlock shape

**What goes wrong:** If you copy `agents/qa/__init__.py::_block_index_hint` verbatim for claims, your blockIndexHint will always be `None` in production.
**Why it happens:** `_block_index_hint` does `block.get("children")` and reads `children[].text` — that's the shape of a fully-composed Sanity Portable Text block. But `state["origin_story"]["body"]` (and every other section) holds the RAW writer output at the point QA/publisher runs: flat `{"type": "paragraph", "text": "..."}` dicts (verified in `graph/blocks.py::BodyBlock` and every writer's `_enforce_structural_floor` validator, which reads `b.type` directly on flat objects, never `b["children"]`). The existing unit test for `_block_index_hint` (`tests/agents/qa/test_block_index_hint.py`) uses a fixture helper `_block(text) -> {"children": [{"text": text}]}` — i.e., the test itself constructs the WRONG shape, so it passes while the production code path (real `state[section]["body"]`) would never match.
**How to avoid:** When computing `blockIndexHint` for claim spans in the publisher, read `block.get("text", "")` directly (the actual field on a raw BodyBlock dict), not `children`. Do not copy `_block_index_hint` as-is; write a corrected sibling function, and consider fixing the QA one too (flag as a bonus fix if in scope, or leave a comment noting the discrepancy if not — but do NOT propagate the bug into new code).
**Warning signs:** If a test for claim blockIndexHint uses a `children`-shaped fixture and passes, it is testing the wrong shape — cross-check any new fixture against an actual writer's `model_dump()` output.

### Pitfall 2: `keyStatistics` removal is low-risk but must still be grepped before deletion

**What goes wrong:** Assuming `keyStatistics` is consumed somewhere downstream (prompts, templates) because it "sounds load-bearing."
**Verified finding:** `keyStatistics` appears in exactly 3 places in the whole repo: the `ResearchOutputModel` field definition itself, and two test files (`tests/test_pipeline_real_mode.py`, `tests/agents/test_researcher.py`) that merely construct fixture data with it. It is NOT read by `build_section_writer_prompt`, not read by any writer, not referenced in `docs/API_CONTRACTS.md`'s actual prose (only in the stale `ResearchOutput` TypedDict — see Pitfall 3). Absorbing it into the claims list is safe; the only required edits are the two test fixtures.
**How to avoid:** Still re-grep at implementation time in case a branch/PR added a new consumer since this research was written.

### Pitfall 3: `docs/API_CONTRACTS.md` §7 `ResearchOutput` TypedDict is stale — it does not match runtime reality

**What goes wrong:** Planning claim-list placement against the documented `ResearchOutput` TypedDict (`foundingMoment`, `founderBackground`, `caseStudySubject`, `caseStudyOutcome`, `verifiedFacts`, `sources`) instead of the actual Pydantic model the Researcher emits.
**Verified finding:** `graph/state.py`'s `ResearchOutput` TypedDict (and its byte-identical copy in `API_CONTRACTS.md` §7) lists fields that **do not exist** on `researcher.py`'s actual `ResearchOutputModel` (`summary`, `foundingYear`, `annualBudget`, `founderName`, `founderNameSourceUrl`, `founderRole`, `founderBio`, `subjectName`, `subjectNameSourceUrl`, `subjectRole`, `subjectStory`, `keyStatistics`, `fundingSources`). `build_section_writer_prompt` even reads `research.get("foundingMoment")`, `research.get("caseStudySubject")`, `research.get("verifiedFacts")` — fields that are ALWAYS absent from the real research dict, meaning that whole `research_lines` block in the writer prompt has been silently empty since Phase 5. This is pre-existing drift, not something Phase 35 caused — but Phase 35 amends `ResearchOutputModel` and (per CLAUDE.md contract-first rule) must touch §7 anyway. **Recommendation:** when amending §7 for the new claims field, reconcile the whole `ResearchOutput`/`ResearchOutputModel` naming drift in the same pass (or explicitly scope it out with a comment) rather than layering a new field onto a contract that's already known-wrong. This is a planning decision, not a blocker, but silently leaving it makes the contract doc worse, not better.
**How to avoid:** Diff `ResearchOutputModel` (researcher.py) against the `ResearchOutput` TypedDict (state.py) and `API_CONTRACTS.md` §7 before editing either; decide explicitly whether Phase 35 fixes the drift or documents it as known and out of scope.

### Pitfall 4: Global cross-section dedup in `extract_claims` throws away the section/block affiliation the galley needs

**What goes wrong:** Assuming the existing `extract_claims(sections)` function can be reused unchanged and just needs new fields bolted onto its output rows.
**Verified finding:** `extract_claims` joins ALL five sections' text into one string (`combined_text = "\n".join(combined_parts)`) BEFORE running the regex+dedup pass. The resulting rows have a single global `claimIndex` and zero section/block information — there is no way to know from the current output which section (let alone which block) an unsourced claim came from. The checklist UI (`ClaimsChecklist.tsx`) never needed this because it's a flat list with no jump links. The galley DOES need it (to tint the right span in the right section) and the new rail source index DOES need it (D-14: "sourced claims group by section in galley order" — implicitly unsourced claims need the same for jump links, since D-13 says every row gets "a jump link to its galley span").
**How to avoid:** Restructure extraction to run per-section, per-block (iterate `state[section]["body"]` block-by-block, run `_extract_and_dedup` on each block's own text), so every row can carry `sectionName` + `blockIndexHint` (computed trivially — it IS the loop index, no post-hoc search needed for the unsourced path, unlike the sourced-claimSpan path which needs QA-style post-hoc search since the writer doesn't emit a block index). Decide (and document) whether dedup happens within a block only, within a section only, or is removed entirely in favor of one row per occurrence — see Open Questions.

### Pitfall 5: `write_issue_draft` whitelists fields per section — `claimSpans` will NOT silently ride along to Sanity, and that's correct, not a gap

**What goes wrong:** Worrying that a new `claimSpans` key on `state[section]` needs an explicit strip-before-Sanity-write step.
**Verified finding:** `lib/sanity_client.py::write_issue_draft` builds each section's Sanity payload as an explicit dict literal (`{"headline": ..., "body": compose_section_body(...)}`) — it never spreads `state[section]` wholesale. Any extra key on the writer's output dict (like `claimSpans`) is automatically ignored at the Sanity-write boundary with zero code changes required. The publisher reads `claimSpans` directly from `state[section]` (which is still the full DispatchState at that point, before `write_issue_draft` runs) for the Convex write, and Sanity never sees it.
**How to avoid:** Don't add defensive stripping code — it's unnecessary. Do verify this stays true if a future refactor changes `write_issue_draft` to spread state generically.

### Pitfall 6: Dedup granularity is a real design tension the CONTEXT doesn't fully resolve

**What goes wrong:** Treating "one canonical claim store" (D-03) as meaning "one row per unique claim text across the whole run," which is the CURRENT checklist behavior but is incompatible with per-occurrence galley tinting (the same fact stated in two sections needs two independent, independently-resolvable spans).
**Recommendation:** Move to one-row-per-occurrence (matching `qaCorrections`' per-finding, never-deduped-across-findings precedent) for BOTH sourced and unsourced rows. This is a checklist-size increase for repeated facts (e.g., a founding year mentioned in both origin story and founder bio becomes 2 checklist rows instead of 1) but is the only way to satisfy "jump link to its galley span" for every row without inventing a one-to-many row-to-span shape. Document this as a deliberate behavior change in the plan, since it's a visible UX difference from Phase 26.

### Pitfall 7: Prompt-size cost of injecting the claims list into 5 writer prompts

**What goes wrong:** Assuming this is free. Each of the 5 prose writers must now receive the claims whitelist (claimId + text) in its user prompt so it can reference IDs — Researcher output could easily be 15-30 claims, each needing at least an ID + short text to be useful to the writer. Injected into 5 separate prompts, this is a real, measurable token/cost increase per run (mirrors Phase 18's MEL-07 "cost rises at most 15%" pattern — Phase 35 should set and verify a similar budget in its own success criteria/plan, since none is specified in ROADMAP.md for this phase).
**How to avoid:** Keep the injected claims list terse (claimId + text only, no context/source metadata — the writer doesn't need the URL to reference a claim). Consider capping list length or truncating claim text. Measure actual token delta in a real-mode run before considering the phase done, the same way Plan 18 did for STRUCTURE_CONTRACT.

### Pitfall 8: Legacy runs with no `claimId` fields must not break `allSignedOff` or the rail

**What goes wrong:** A run predating this phase has `claim_checks` rows with no `claimId`/`sourceUrl`/`retrievedAt`/`sectionName`/`blockIndexHint` — all additive fields absent.
**Verified finding:** All new fields are `v.optional(...)`; `claimChecks:allSignedOff` only inspects `status`, which is unaffected. The rail's new source-index rendering must treat `claimId` absence as "unsourced" (not as an error) and `sectionName`/`blockIndexHint` absence as "no jump link available for this row" (render the row without a functioning jump target, never crash or hide the row — matches "nothing silent").
**How to avoid:** Explicit fallback branches in the new rail component for each optional field, tested with a legacy-shaped fixture (no new fields at all).

### Pitfall 9: `claimChecks:setStatus` is a dashboard-direct Convex mutation, not routed through the pipeline API — this is correct, not a violation of EDT-05

**What goes wrong:** Assuming EDT-05 ("dashboard has no direct Sanity write path... all content writes flow dashboard → pipeline API → Sanity") means the new galley popover's check/skip action must go through a pipeline endpoint.
**Verified finding:** `ClaimsChecklist.tsx` already calls `useMutation(api.claimChecks.setStatus)` directly against Convex — no pipeline API hop. This is correct and intentional: `claim_checks` is a Convex-only table (never touches Sanity), so EDT-05's write-boundary rule (which is specifically about the Sanity content store) does not apply. `requireOperator(ctx)` inside the mutation is the auth guard, not a pipeline-secret guard. D-11's galley popover should call the exact same mutation the exact same way.
**How to avoid:** Don't route claim check/skip through a new FastAPI endpoint "to be consistent with EDT-05" — that would be inconsistent with the actual precedent and add unnecessary latency/complexity.

### Pitfall 10: Sign-off auto-revoke does NOT fire on claim checking — verified, not assumed

**What goes wrong:** Assuming you need to add `claimChecks:setStatus` to some revoke-trigger list to prevent claim-checking from voiding sign-offs, or conversely assuming it might already be wrongly wired to revoke.
**Verified finding:** §34.6's `_revoke_active_signoffs` call is wired into exactly 13 named endpoints (9 `content.py` routes, 3 `findings.py` routes, `control.py::rerun_agent`) — `claimChecks:setStatus` is a Convex mutation, not a FastAPI endpoint, and is not and cannot be in that list. D-12/D-08's non-interaction is already structurally guaranteed by the existing architecture; there is no code to write for this, only a test to add confirming it (check a claim, assert `signOffs:activeByRunId` unchanged).

## Code Examples

### Researcher — current verified shape (to be extended, not replaced)

```python
# packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (verified live shape)
class ResearchOutputModel(BaseModel):
    summary: str = ""
    foundingYear: int | None = None
    annualBudget: str | None = None
    founderName: str | None = None
    founderNameSourceUrl: str | None = None      # KEEP verbatim (D-02 back-compat)
    founderRole: str = "founder"
    founderBio: str = ""
    subjectName: str | None = None
    subjectNameSourceUrl: str | None = None       # KEEP verbatim (D-02 back-compat)
    subjectRole: str = "a program participant"
    subjectStory: str = ""
    keyStatistics: list[str] = Field(default_factory=list)   # REMOVE (D-02) — 3 call sites total, 2 are tests
    fundingSources: list[str] = Field(default_factory=list)
    # NEW (D-01): claims: list[ClaimOutput] — each {text: str, sourceIndex: int | None}
```

### Tavily results are held per-query, not accumulated with any timestamp

```python
# researcher.py — verified: this loop is where S1..Sn numbering + retrievedAt
# stamping must happen. `web_search()` returns `SearchResult(url, title,
# content, score)` — NO timestamp field exists anywhere in the Tavily wrapper.
tool_calls = 0
tavily_results: list[SearchResult] = []
for q in queries:
    tool_calls += 1
    batch = await web_search(q, max_results=4)
    tavily_results.extend(batch)   # <-- retrievedAt must be stamped HERE, per-batch
                                    #     (time.time() at the point of the call),
                                    #     since SearchResult itself carries none.
```

### verify_research — the existing "code gate, not agent" precedent for MON-01-style forensic-spine framing

```python
# agents/verify.py (verified) — NOT an @agent_node: no LLM call, no
# deliberationEvents emission, no cost recording. This IS the shape of a
# "code gate" the Run Monitor v2 (Phase 37, out of scope) will visualize as
# a marigold diamond. Relevant to Phase 35 only as confirmation that
# non-LLM verification/mapping steps between agent nodes are an established,
# already-graph-wired pattern (verify_research sits between researcher and
# the fan-out) — the claimId->sourceUrl mapping step belongs in the SAME
# style of place (inside researcher() itself, post-LLM-call, pre-return;
# no new graph node is needed since it's a pure dict transform, unlike
# verify_research which needs an HTTP fetch).
async def verify_research(state: DispatchState) -> dict:
    ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Founder/subject name verified by post-hoc HTTP fetch + substring search (`agents/verify.py`) | Index-bound claims (D-01) — the LLM never sees or writes a URL | Phase 35 (this phase) | Stronger guarantee: verify.py can still false-negative (site changed, fetch failed) even for a real name; index-binding makes a *hallucinated* source structurally impossible, a strictly different and stronger failure mode elimination |
| `qaCorrections` is the only span-anchored, Convex-resolved factual surface in the galley | `claim_checks` becomes a second, parallel span-anchored surface using the identical resolver contract | Phase 35 (this phase) | Establishes a repeatable pattern: any future "annotate a span in the galley" feature should extend this same quotedSpan/blockIndexHint/sectionName shape rather than invent a third one |

**Deprecated/outdated:**
- `keyStatistics` field on `ResearchOutputModel` — absorbed into the claims list (D-02). Only 3 call sites, 2 of them test fixtures.

## Open Questions

1. **Dedup granularity for claim_checks rows (occurrence vs unique-text)**
   - What we know: `qaCorrections` never dedupes (one row per finding, even if two findings quote the same text in different sections). The current claim checklist (`extract_claims`) globally dedupes across the whole run (one row per unique normalized text, first-occurrence wins).
   - What's unclear: D-03's "ONE canonical claim store... galley tints... all keep reading ONE table" doesn't explicitly resolve whether that one table has one row per unique claim or one row per occurrence.
   - Recommendation: one row per occurrence (matches qaCorrections precedent, and is the only shape that supports "jump link to its galley span" per row, per D-13, without a one-to-many row model). Document as a deliberate, visible checklist-size change from Phase 26 behavior.

2. **Where exactly does the claimId → sourceUrl/retrievedAt mapping happen — inside `researcher()` or in a new tiny post-step?**
   - What we know: `verify_research` shows the graph already supports a plain (non-`@agent_node`) function between `researcher` and the fan-out for post-processing.
   - What's unclear: whether the index→URL mapping (a pure dict transform, no I/O) belongs inside `researcher()` itself (simpler, one fewer graph node) or as a new tiny step mirroring `verify_research`'s position (more consistent with the existing "verification is a separate step" convention, but adds a graph node for something with no I/O).
   - Recommendation: inside `researcher()`, immediately after `acomplete()` returns and before the function returns state — it's pure, synchronous, and doesn't need its own graph node or event.

3. **Does the wash mark visually collide with the existing error-severity background tint?**
   - What we know: `.galley-anno[data-severity="error"]` already applies `background: rgba(232, 71, 29, 0.13)` in addition to its underline. A rust-tinted unsourced span that's ALSO an error-severity QA finding would stack two rust-ish backgrounds.
   - What's unclear: whether this reads as "clearly two problems, both flagged" (acceptable, arguably desirable) or as visually muddy without a design pass.
   - Recommendation: build the wash CSS first, screenshot a span carrying both mark types, and make an explicit call in the plan's verification step — this is a 10-minute visual check, not a research gap, but should not be left to accidental discovery during implementation.

## Environment Availability

No new external dependencies. Existing dependencies this phase touches (Tavily via `TAVILY_API_KEY`, OpenRouter via `acomplete`, Convex) are already live and required by phases 5/22/26 respectively — no new environment provisioning needed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Pipeline framework | pytest 8.3 + pytest-asyncio (auto mode) |
| Pipeline config file | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| Pipeline quick run | `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py tests/test_claims_extractor.py -x -q` |
| Pipeline full suite | `cd packages/pipeline && uv run pytest -x -q` (477 tests collected at time of research — baseline to preserve) |
| Frontend framework | Vitest (`apps/dispatch-control/package.json` `"test:unit": "vitest run"`) |
| Frontend quick run | `cd apps/dispatch-control && npx vitest run __tests__/spanResolver.test.ts __tests__/syntheticPortableText.test.ts __tests__/Galley.test.tsx __tests__/DecisionRail.test.tsx` |
| Frontend full suite | `cd apps/dispatch-control && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRV-01 | Researcher emits index-bound claims; out-of-range index → unsourced | unit | `uv run pytest tests/agents/test_researcher.py -x -q` | ✅ (extend existing file) |
| PRV-01 | `keyStatistics` removal doesn't break existing fixtures | unit | `uv run pytest tests/agents/test_researcher.py tests/test_pipeline_real_mode.py -x -q` | ✅ (existing files, need fixture updates) |
| PRV-02 | Each of the 5 prose writers accepts/emits `claimSpans`; unknown claimId dropped, never fatal | unit | `uv run pytest tests/agents/test_origin_story.py tests/agents/test_problem.py tests/agents/test_founder_bio.py tests/agents/test_case_study.py tests/agents/test_bonus.py -x -q` | ⚠️ Wave 0 — verify exact test filenames exist before assuming; new assertions needed regardless |
| PRV-02 | `blockIndexHint` computed correctly against flat BodyBlock `{type,text}` shape (NOT `children`) | unit | New test file, e.g. `tests/agents/test_claim_block_index_hint.py` | ❌ Wave 0 — write fresh, do not copy `test_block_index_hint.py`'s fixture shape |
| PRV-02 | Publisher writes sourced + unsourced rows to `claim_checks` with correct additive fields | integration | `uv run pytest tests/agents/test_publisher.py -x -q` (or equivalent existing publisher test) | ⚠️ Wave 0 — locate/confirm exact existing publisher test file |
| PRV-03 | Galley renders a marigold wash for a sourced claim, rust for unsourced, both toggleable | unit (vitest) | `npx vitest run __tests__/Galley.test.tsx` | ✅ (extend existing file) |
| PRV-03 | Wash + severity underline stack correctly on an overlapping span (D-09) | unit (vitest) | New assertions in `__tests__/syntheticPortableText.test.ts` or a new `__tests__/claimSpanResolver.test.ts` | ⚠️ Wave 0 — likely needs a new small test file mirroring `spanResolver.test.ts` |
| PRV-04 | Rail source index groups unsourced on top, sourced by section below, both with working jump links | unit (vitest) | `npx vitest run __tests__/DecisionRail.test.tsx` | ✅ (extend existing file — currently only tests the one-line summary) |
| PRV-04 | Legacy claim_checks rows (no new fields) render as unsourced, never crash | unit (vitest) | Same file, new fixture case | ⚠️ Wave 0 — add legacy-shaped fixture |
| D-08/D-12 | Checking/skipping a claim does NOT revoke active sign-offs | integration | New test asserting `signOffs:activeByRunId` unchanged after `claimChecks:setStatus` | ❌ Wave 0 — write fresh, this is the verified-safe-by-construction claim from Pitfall 10, worth a regression test |

### Sampling Rate
- **Per task commit:** the relevant quick-run command above for whichever layer (pipeline vs frontend) the task touched.
- **Per wave merge:** both full suites (`uv run pytest -x -q` AND `npx vitest run`) — this phase touches both layers in almost every wave.
- **Phase gate:** Full suite green on both layers before `/gsd:verify-work`, plus the Pitfall 3 visual check (wash/underline overlap) done manually and noted in verification.

### Wave 0 Gaps
- [ ] `tests/agents/test_claim_block_index_hint.py` — covers PRV-02's blockIndexHint-against-flat-shape assertion (Pitfall 1's fix, verified needed).
- [ ] A new or extended vitest file covering claim-span resolution + mark-stacking — covers PRV-03.
- [ ] A signoff-non-revocation regression test — covers the D-08/D-12 non-interaction (currently true by construction but untested).
- [ ] Confirm exact existing test filenames for the 5 prose writers and the publisher node before writing the plan's task list (this research read the agent source files but did not enumerate every existing test file name in `tests/agents/`).

## Sources

### Primary (HIGH confidence — direct source read)
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` — `ResearchOutputModel`, Tavily query loop, `MAX_TOOL_CALLS`.
- `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` — full read of `extract_claims`, `extract_all_claim_types`, the regex patterns, and the global-join-then-dedup behavior (Pitfall 4).
- `packages/pipeline/src/eisenbalm_pipeline/agents/verify.py` — code-gate precedent, `founderNameVerified`/`subjectNameVerified` computation.
- `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` — `BodyBlock` flat-schema, documented `oneOf` production incident.
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` — exact `extract_claims` call site and `claimChecks:insertBatch` payload shape.
- `packages/pipeline/src/eisenbalm_pipeline/agents/{origin_story,founder_bio,case_study}.py` — writer output models, structural-floor validator pattern, `build_section_writer_prompt` call sites.
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — `build_section_writer_prompt` signature and the four-field whitelist (AGT-09 isolation).
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` + `docs/API_CONTRACTS.md` §7 — `ResearchOutput` TypedDict drift finding (Pitfall 3), diffed directly against `ResearchOutputModel`.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` + `packages/pipeline/tests/agents/qa/test_block_index_hint.py` — `_block_index_hint` implementation AND its test fixture, cross-checked against `graph/blocks.py`'s actual flat BodyBlock shape to confirm the bug in Pitfall 1.
- `packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py` — `SearchResult` dataclass shape (no timestamp field), confirming `retrievedAt` must be code-stamped.
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — `write_issue_draft` per-field whitelist, confirming Pitfall 5.
- `docs/API_CONTRACTS.md` §26.2, §32.1, §33.2, §33.5, §33.7, §34.1-34.6 — `claim_checks` shape, `qaCorrections.blockIndexHint`, span-resolver contract, sign-off gate contract, auto-revoke endpoint list.
- `convex/schema.ts` + `convex/claimChecks.ts` — full read of the existing table and all three mutations/queries.
- `apps/dispatch-control/lib/galley/spanResolver.ts` + `syntheticPortableText.ts` — full read of the 3-stage resolver and the mark-stacking mechanism.
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/{Galley,GallerySection,AnnotationMark,DecisionRail}.tsx` — full read of render/action/rail composition.
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ClaimsChecklist.tsx` — legacy checklist, direct `useMutation(claimChecks.setStatus)` call confirming Pitfall 9.
- `apps/dispatch-control/app/globals.css` — exact color tokens (`--color-marigold #f2b01e`, `--color-vermilion #e8471d`) and existing `.galley-anno`/`.galley-popover` CSS.
- `.planning/phases/32-.../32-CONTEXT.md`, `33-.../33-CONTEXT.md`, `34-.../34-CONTEXT.md` (via CONTEXT.md canonical_refs, already loaded into this phase's CONTEXT.md) — decision lineage for the span-resolver, rail, and sign-off gate.
- `packages/pipeline` test collection (`uv run pytest --collect-only -q`) — 477 tests baseline, verified live.

### Secondary (MEDIUM confidence)
- None — all findings in this document were verified directly against source, not inferred from documentation or training data.

### Tertiary (LOW confidence)
- `@portabletext/react`'s exact mark-nesting order when a span carries two different mark `_type`s — not verified empirically in this research pass (no live render was executed); flagged as Open Question 3 with a concrete verification step for the plan/implementation stage.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every component read directly from source.
- Architecture: HIGH — the qaCorrections/spanResolver mirror pattern is verified end-to-end (schema → mutation → resolver → render → rail), not assumed.
- Pitfalls: HIGH — every pitfall in this document (including the `_block_index_hint` bug, the `ResearchOutput` contract drift, and the global-dedup extraction gap) was confirmed by reading the actual implementation and, where applicable, its test fixture — not inferred from naming or docstrings alone.

**Research date:** 2026-07-08
**Valid until:** 30 days (stable codebase area; re-verify if Phase 32/33/34 span-resolver or claim_checks shapes are touched by an intervening phase before Phase 35 executes)
