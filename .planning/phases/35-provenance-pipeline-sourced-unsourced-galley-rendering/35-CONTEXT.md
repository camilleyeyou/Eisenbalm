# Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Every claim the Researcher extracts carries `{claim, sourceUrl, retrievedAt}` and survives into the final prose: the Researcher emits per-claim bindings (generalizing the founder/subject paired-field pattern), the section writers reference claim IDs in their structured output at generation time (never post-hoc fuzzy matching), the galley renders sourced claims (marigold highlight, hover → source URL + retrieval date) and unsourced claims (rust tint) as first-class visual states, and the decision rail gains a source index — unsourced claims grouped on top with jump links, sourced claims with their sources — with the claims sign-off checklist upgraded to source-bound claims. Requirements: PRV-01, PRV-02, PRV-03, PRV-04.

**Explicitly NOT in scope:** the Voice Pass screen (Phase 36); Run Monitor v2 / Signal Desk (Phase 37, incl. hookClaim/hookVerified); changing the Phase 34 facts-cleared gate contract (D-10 keeps it identical); Studio retirement work.

</domain>

<decisions>
## Implementation Decisions

### Claim model & Researcher binding
- **D-01: Index-bound sources — the LLM never writes a URL.** Code numbers each Tavily result (S1, S2…) before the parse call; the Researcher's output model emits claims with a **source index**, and code maps index → the real result URL + `retrievedAt` (the actual search timestamp, stamped code-side). A claim with no valid index is honestly unsourced. Hallucinated/mangled URLs are structurally impossible.
- **D-02: The claims list absorbs `keyStatistics`.** `keyStatistics` (unsourced strings) is replaced by the sourced claims list. Founder and subject names become claims too, **but the existing `founderName`/`founderNameSourceUrl`/`subjectName`/`subjectNameSourceUrl` paired fields stay as-is** for back-compat with writers/consumers that read them. One canonical claim store; no parallel unsourced stats list. (Check `keyStatistics` consumers before removal — prompts, templates, tests.)
- **D-03: `claim_checks` upgrades in place.** Add optional fields (`claimId`, `sourceUrl`, `retrievedAt`, and whatever span-anchor fields planning needs) to the existing Convex `claim_checks` table. The checklist, source index, galley tints, and the Phase 34 facts-cleared prerequisite all keep reading ONE table. Legacy rows (no source fields) degrade honestly to unsourced. No new table, no join.
- **D-04: Regex catch-all defines "unsourced."** The existing deterministic extractor (`lib/claims.py` — numbers/dates/proper nouns, full recall) still runs over final prose. Any extracted claim-looking span NOT covered by a writer claim reference becomes an unsourced claim (rust). Sourced = writer-referenced binding; unsourced = everything else the regex finds. Nothing factual escapes the checklist.

### Writer claim-carrying mechanics
- **D-05: Claim-span sidecar on writer output.** Prose writer output models gain a flat field: `claimSpans: [{claimId, asWritten}]` — `asWritten` is the verbatim phrase **as the writer wrote it in the body** (handles rewording: "$2.3M annual budget" → "a budget of $2.3 million"). Resolved in the galley by the existing Phase 32 span-resolver machinery. Schema must stay `oneOf`-free (hard constraint: Anthropic structured-output rejects `oneOf` — see `graph/blocks.py` docstring for the production incident).
- **D-06: Prose writers only.** `claimSpans` lands on the BodyBlock-emitting writers (origin_story, problem, founder_bio, case_study, bonus). The game (sandboxed HTML/JS — no span annotation possible inside its iframe) and other non-prose outputs are exempt; their factual content still gets regex-extracted into the checklist as unsourced-by-default rows, so nothing escapes review — it just can't highlight in-galley.
- **D-07: Lenient enforcement, honest fallback.** Invalid `claimId` references are dropped at validation (logged, never fatal); bound facts the writer wrote without referencing simply fall through to the D-04 regex catch-all and show as unsourced. No hard validator, no retry loop on claim coverage. Matches the house rule: never guess, surface honestly.
- **D-08: Post-edit behavior is a natural consequence, not new machinery.** After Andrew edits a section, spans re-resolve statelessly (Phase 32 D-13 resolver). A reworded sourced claim loses its highlight and the regex catch-all re-tints the new text as unsourced. Honest by default; no re-binding UI this phase.

### Galley rendering
- **D-09: Wash vs underline.** Provenance renders as a background wash (highlighter-pen feel): **marigold wash = sourced, rust wash = unsourced**. QA severity annotations keep their Phase 32 underlines (marigold underline = warning, rust underline+tint = error). Same ink, different stroke — the two systems coexist and a span carrying both reads as underline-over-wash.
- **D-10: Provenance layer on by default, toggleable.** Washes render by default (the at-a-glance requirement), with a galley-toolbar toggle to switch the provenance layer off for clean reading. Mirrors the existing galley/iframe toggle pattern on this screen.
- **D-11: Hover info + click to act.** Hover on a sourced claim = lightweight tooltip (source URL + retrieved date, per roadmap language). Click = small popover (AnnotationMark pattern) with "Open source" link and **Mark checked / Skip** — the checklist action available in context, writing the same `claim_checks` status the rail reads. Checking claims where you read them.

### Source index & checklist upgrade
- **D-12: Same gate contract, faster to satisfy.** Every claim — sourced or not — still requires a human check/skip; a source existing ≠ verified. Provenance makes checking fast (source one click away). Phase 34's facts-cleared prerequisite ("all claim checks checked/skipped") is untouched; no gate rework, no bulk-check, no auto-check.
- **D-13: The source index IS the checklist.** The rail's new source index merges index + checklist into one surface: each row = claim text + sourced/unsourced state + check/skip control + jump link to its galley span. Unsourced group pinned on top. One surface, one table. The Phase 26 review page's ClaimsChecklist stays byte-functional as the fallback (D-03's optional fields degrade honestly there).
- **D-14: Sourced claims ordered by section, reading order.** Below the unsourced group, sourced claims group by section in galley order, each showing its source — the index mirrors the read; jump links land where expected. Consistent with how the chip strip and rail blockers organize.

### Claude's Discretion
- Exact claim ID scheme, `ResearchOutputModel` claims-field shape, and the Tavily source-index plumbing (S1/S2 enumeration in the prompt, index→URL mapping).
- `claim_checks` new-field names and any index changes; where seeding happens in the pipeline (claims flow from research state → Convex rows) — contract-first: amend `docs/API_CONTRACTS.md` before schema/endpoint code (CLAUDE.md hard rule).
- Whether claimSpan galley resolution reuses `spanResolver.ts` directly or a parallel resolve pass with the same normalization/never-guess rules; how sourced-claim spans and regex-unsourced spans are matched/deduplicated against each other.
- Tooltip/popover implementation details, wash CSS treatment within the 1c token system, toggle placement, checked-claim visual state (e.g., dimmed wash).
- How the D-04 regex pass runs client-side vs pipeline-side for the galley tints (the extractor is Python; the galley is TS — planner decides where extraction for rendering happens, keeping full-recall parity with the checklist seeding).
- Migration posture for in-flight/legacy runs (optional fields mean old runs render all-unsourced — acceptable; no backfill required).
- Whether the game/bonus/podcast sections show a per-section "n unsourced claims (not highlightable)" note in the index vs plain rows.

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 35 — goal + 4 success criteria (per-claim bindings, generation-time claim refs, marigold/rust galley states, source index + source-bound checklist).
- `.planning/REQUIREMENTS.md` — PRV-01..PRV-04 (VOX-*/MON-* are Phases 36/37 — do not pull them in).
- `.planning/PROJECT.md` §Current Milestone — locked v3.0 decisions (write boundary, "nothing silent").

### Prior phase contexts (decisions carried forward)
- `.planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md` — D-07 (QA severity underline colors this phase must not collide with), D-12 (never guess a span), D-13 (stateless client resolver — D-08 here relies on it).
- `.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md` — D-13 (`claim_checks.checkedAt`), D-17 (rail composition the source index joins), rail/endpoint patterns.
- `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md` — D-01 (facts-cleared prerequisite reads claim_checks state — D-12 here keeps that contract identical), D-08 (sign-offs auto-revoke on content mutation — claim checking is NOT a content mutation and must not revoke).

### Design handoff (binding)
- `docs/design/dispatch-control-v2/README.md` §Review Desk — galley + rail spec; provenance states join this layout.
- `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — 1c tokens (marigold `#f2b01e`, vermilion/rust `#e8471d`) for the wash treatments.
- `docs/design/dispatch-control-v2/DECISIONS.md` — house rules ("nothing silent").

### Contract boundary (hard rule)
- `docs/API_CONTRACTS.md` — amend BEFORE code: `ResearchOutputModel` claims shape (§7 research schema), writer output `claimSpans` field (§7/§2.4 writer schemas), `claim_checks` new fields (§26.2), any new/changed endpoints for claim seeding or galley reads.

### Existing code (build on these)
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` — `ResearchOutputModel` (paired-field precedent, `keyStatistics` to absorb per D-02), Tavily loop where the S1/S2 source enumeration lands (D-01).
- `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` — the deterministic full-recall extractor (D-04's catch-all; Phase 26 acceptance bar was full recall — keep it).
- `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` — BodyBlock + the `oneOf` rejection incident docstring; `claimSpans` must obey the same flat-schema constraint (D-05).
- `packages/pipeline/src/eisenbalm_pipeline/agents/{origin_story,problem,founder_bio,case_study,bonus}.py` — the prose writers gaining `claimSpans` (D-06); note the structural-floor validator pattern and the "own keys only" state-merge rule (Phase 4-12 fix).
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — `build_section_writer_prompt` (where claim-reference instructions + the claims list reach the writers).
- `convex/schema.ts` — `claim_checks` (~L401; D-03 fields land here), `qaCorrections` (severity annotation shape the galley already renders).
- `apps/dispatch-control/lib/galley/spanResolver.ts` — the stateless resolver claimSpan resolution mirrors (D-05/D-08; never-guess normalization rules).
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/` — `Galley.tsx`, `GallerySection.tsx` (wash render layer), `AnnotationMark.tsx` (popover pattern for D-11), `DecisionRail.tsx` (source index home, D-13), `SectionChipList.tsx`.
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ClaimsChecklist.tsx` — the legacy checklist that stays byte-functional (D-13 fallback); its status-flip mutation is what D-11's galley popover reuses.
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` — where `extract_claims` currently seeds `claim_checks` rows (seeding upgrades to source-bound here).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Paired-field precedent** — `founderNameSourceUrl`/`subjectNameSourceUrl` already prove the Researcher can bind sources; D-01 generalizes with index-binding instead of trusting LLM URLs.
- **Tavily results in hand** — the Researcher's search loop already holds `SearchResult` objects with real URLs at a known time; `retrievedAt` is free.
- **Full-recall extractor** — `lib/claims.py` regex extraction (numbers/dates/proper nouns) is the unsourced catch-all (D-04); no new detection needed.
- **Span-resolution machinery** — Phase 32's resolver + normalization rules + unresolved-honesty pattern transfer directly to claimSpan resolution.
- **AnnotationMark popover** — keyboard/outside-click/escape handling exists; D-11's claim popover follows the same pattern.
- **DecisionRail + claim_checks reactivity** — rail already subscribes to claim state live; the source index slots in as a rail section reading the same upgraded table.
- **Structural-floor validator pattern** — writers already validate structured output with retry-once; D-07's lenient claimId validation is lighter than that (drop + log, never fatal).

### Established Patterns
- Contract-first: amend `docs/API_CONTRACTS.md` before schema/endpoint code.
- "Nothing silent": dropped claim references get logged; unsourced states render loudly, never hidden.
- Never guess a span — ambiguous resolution surfaces honestly (Phase 32 D-12).
- Flat structured-output schemas only — no `oneOf`/discriminated unions (Anthropic constraint, production-proven).
- Optional Convex fields for zero-migration upgrades (blockIndexHint, checkedAt precedents) — legacy rows degrade honestly.
- Parallel writers return only owned state keys (Phase 4-12 InvalidUpdate fix) — `claimSpans` rides inside each writer's own section output.

### Integration Points
- `ResearchOutputModel` → writer prompts → writer output models → `compose_section_body`/Sanity draft — the claim ID thread through the pipeline.
- Publisher's `extract_claims` seeding → upgraded `claim_checks` rows (claimId/sourceUrl/retrievedAt populated for bound claims).
- `/review-desk/[runId]` galley — provenance wash layer over the existing PortableText render; toggle in the galley toolbar.
- `DecisionRail.tsx` — source index section; Phase 34's facts-cleared prerequisite keeps reading the same checked/skipped state (D-12).
- Phase 36/37 downstream: Voice Pass and Signal Desk build on the same rail; the hook card (Phase 37) is unrelated to this index.

</code_context>

<specifics>
## Specific Ideas

- The gate philosophy carried from Phases 26/33/34 applies to provenance: **the system never asserts verification it didn't earn.** Index-binding (D-01) exists so a URL in the UI is always a URL the pipeline actually fetched; "sourced" never means "checked" (D-12).
- Roadmap language honored literally: sourced hover reveals "source URL + retrieval date"; unsourced claims are "grouped on top with jump links"; writer references are "established at generation time, not free prose" — the claimSpan sidecar is generation-time establishment because the writer itself declares the as-written phrase.
- The marigold/rust color language is required by PRV-03 but must not collide with Phase 32's severity underlines — hence wash vs underline (D-09): same ink, different stroke.

</specifics>

<deferred>
## Deferred Ideas

- **Voice Pass machine-tell screen** — Phase 36.
- **hookClaim/hookVerified + Signal Desk** — Phase 37.
- **Unsourced-claims-escalate gate (skip-with-reason required)** — considered, not chosen (D-12); revisit if unsourced claims keep shipping despite the rust tint.
- **Bulk-check sourced claims** — considered, not chosen (D-12); invites rubber-stamping.
- **Manual re-binding UI for claims orphaned by edits** — not chosen (D-08 relies on honest fallback); revisit if weekly use shows heavy re-checking churn after edits.
- **Distinct provenance colors outside marigold/rust** — considered, not chosen (D-09); requirement's color language kept.
- **claimSpans on the game/non-prose writers** — considered, not chosen (D-06); regex catch-all covers their facts in the checklist.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering*
*Context gathered: 2026-07-08*
