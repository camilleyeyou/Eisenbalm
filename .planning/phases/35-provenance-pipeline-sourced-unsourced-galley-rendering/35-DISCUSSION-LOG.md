# Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 35-provenance-pipeline-sourced-unsourced-galley-rendering
**Areas discussed:** Claim model & Researcher binding, Writer claim-carrying mechanics, Galley sourced/unsourced rendering, Source index & checklist upgrade

---

## Claim model & Researcher binding

### How should the Researcher bind sources to claims?

| Option | Description | Selected |
|--------|-------------|----------|
| Index-bound (Recommended) | Code numbers each Tavily result (S1, S2…); LLM emits claims with a source INDEX; code maps index → real URL + retrievedAt (actual search timestamp). LLM can never hallucinate a URL. | ✓ |
| LLM emits URLs directly | Generalize paired-field pattern literally; URLs can be invented or mangled. | |
| LLM URLs + code validation | LLM emits URLs, code validates against Tavily result set. More code for the same guarantee. | |

### How do existing fields (keyStatistics, founder/subject paired fields) relate to the claims list?

| Option | Description | Selected |
|--------|-------------|----------|
| Claims list absorbs them (Recommended) | keyStatistics replaced by sourced claims list; founder/subject names become claims too, paired fields kept for back-compat. | ✓ |
| Claims list added alongside | New field next to untouched keyStatistics — two overlapping stores of facts. | |
| Full restructure | Rebuild ResearchOutputModel around claims — touches every consumer in one phase. | |

### Where do claim bindings persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Upgrade claim_checks in place (Recommended) | Optional claimId/sourceUrl/retrievedAt fields on the existing table; one table for checklist, index, tints, and gate; legacy rows degrade honestly. | ✓ |
| New claims table + thin checklist | Cleaner separation, two tables to sync, gate rewiring. | |
| State-only, materialize at review | Least schema change; no live provenance during the run. | |

### What counts as an UNSOURCED claim in the final prose?

| Option | Description | Selected |
|--------|-------------|----------|
| Regex catches the rest (Recommended) | Existing deterministic extractor still runs; extracted spans not covered by a writer claim reference are unsourced (rust). Full recall preserved. | ✓ |
| Only Researcher leftovers | Writer-invented facts invisible — violates the at-a-glance goal. | |
| QA judge detects unsourced | LLM recall not guaranteed; deterministic extractor exists precisely for full recall. | |

---

## Writer claim-carrying mechanics

### How do writers reference claim IDs in structured output?

| Option | Description | Selected |
|--------|-------------|----------|
| Claim-span sidecar (Recommended) | claimSpans: [{claimId, asWritten}] — verbatim phrase as the writer wrote it; handles rewording; resolves via Phase 32 span resolver; oneOf-free. | ✓ |
| Inline markers in prose | [C3] tokens stripped at serialization — pollutes prose seen by voice validators; leak risk. | |
| Per-block claimIds list | Block-level only; locating claim within block breaks the moment the writer rewords. | |

### Which writers carry claimSpans?

| Option | Description | Selected |
|--------|-------------|----------|
| Prose writers only (Recommended) | BodyBlock-emitting writers; game exempt (sandboxed iframe can't highlight); game facts still regex-extracted as unsourced checklist rows. | ✓ |
| All 7 including game | Schema consistency; references that mostly can't resolve visually. | |
| Prose + structured fields | Headline/deck also claim-matchable; each surface needs its own resolution path. | |

### What happens when claimSpans are imperfect?

| Option | Description | Selected |
|--------|-------------|----------|
| Lenient + honest fallback (Recommended) | Invalid claimIds dropped at validation (logged); unreferenced facts fall through to regex catch-all as unsourced. No retry loops. | ✓ |
| Hard validator + retry | Reject + retry once like structural floor; fuzzy bar, burns cost. | |
| QA flags gaps as findings | Redundant with the rust tint. | |

**Notes:** Confirmed post-edit behavior as a natural consequence: after an edit, spans re-resolve statelessly; a reworded sourced claim loses its highlight and regex re-tints the new text as unsourced. No re-binding UI this phase.

---

## Galley sourced/unsourced rendering

### How do provenance states stay distinct from QA severity annotations (same marigold/rust ink)?

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight vs underline (Recommended) | Provenance = background wash (marigold sourced, rust unsourced); QA keeps underlines. Same ink, different stroke; overlap reads as underline-over-wash. | ✓ |
| Distinct provenance colors | Contradicts the requirement's explicit color language. | |
| Mutually exclusive layers | Loses the combined at-a-glance read. | |

### Always-on, or toggleable?

| Option | Description | Selected |
|--------|-------------|----------|
| On by default, toggleable (Recommended) | Washes render by default; galley-toolbar toggle for clean reading. Mirrors the iframe/galley toggle pattern. | ✓ |
| Always on, no toggle | Painted-everything can drown QA underlines during a voice read. | |
| Unsourced always, sourced on demand | "Sourced at a glance" is half the requirement. | |

### Read-only hover, or actions too?

| Option | Description | Selected |
|--------|-------------|----------|
| Hover info + click to act (Recommended) | Hover tooltip (source URL + retrieved date); click popover with Open source + Mark checked/Skip writing the same claim_checks status. | ✓ |
| Hover info only | Andrew ping-pongs between prose and rail for every claim. | |
| Full popover on click only | Loses the frictionless hover-scan the requirement describes. | |

---

## Source index & checklist upgrade

### Does source-binding change the facts-cleared prerequisite?

| Option | Description | Selected |
|--------|-------------|----------|
| Same contract, faster to satisfy (Recommended) | Every claim still needs human check/skip; a source existing ≠ verified. Honors Phase 34's "same gate contract" literally. | ✓ |
| Unsourced claims escalate | Skip-with-reason required; changes the gate contract Phase 34 just stabilized. | |
| Bulk-check sourced claims | Invites rubber-stamping. | |

### Where does the source-bound checklist live?

| Option | Description | Selected |
|--------|-------------|----------|
| Source index IS the checklist (Recommended) | Rail index merges both: claim text + state + check/skip + jump link; unsourced pinned on top; Phase 26 page stays byte-functional fallback. | ✓ |
| Index and checklist separate | Two screens for one job. | |
| Index as expandable rail drawer | Overlay pattern the Review Desk doesn't use yet. | |

### How are sourced claims organized below the unsourced group?

| Option | Description | Selected |
|--------|-------------|----------|
| By section, reading order (Recommended) | Index mirrors the read; consistent with chip strip and rail blockers. | ✓ |
| By source | Verify-a-whole-source-at-once at the cost of prose order. | |
| Claude's discretion | | |

---

## Claude's Discretion

- Claim ID scheme, ResearchOutputModel claims-field shape, Tavily source-index plumbing
- claim_checks field names/indexes; where seeding happens (contract-first)
- claimSpan resolution reuse of spanResolver.ts vs parallel pass; dedup of sourced vs regex-unsourced spans
- Tooltip/popover details, wash CSS, toggle placement, checked-claim visual state
- Where the regex pass runs for galley tints (Python extractor vs TS galley — full-recall parity required)
- Migration posture for legacy runs (all-unsourced render acceptable, no backfill)
- Non-prose sections' representation in the index

## Deferred Ideas

- Unsourced-claims-escalate gate (skip-with-reason) — revisit if unsourced claims keep shipping
- Bulk-check sourced claims
- Manual re-binding UI for claims orphaned by edits
- Distinct provenance colors outside marigold/rust
- claimSpans on game/non-prose writers
