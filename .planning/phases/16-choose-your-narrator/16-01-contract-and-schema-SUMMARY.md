---
phase: 16-choose-your-narrator
plan: 01
subsystem: contracts-and-schema
tags: [phase-16, wave-0, gate, contracts, sanity, narrator, schema]
requirements: [NRR-01, NRR-02, NRR-07]
status: complete
dependency-graph:
  requires: []  # Wave 0 gate plan — depends on nothing; gates everything else in Phase 16
  provides:
    - docs/API_CONTRACTS.md §1.2 narrator->{name, slug, active} GROQ projection contract (consumed by Plan 16-08b)
    - docs/API_CONTRACTS.md §7 DispatchState.narrator field contract (consumed by Plan 16-05)
    - docs/API_CONTRACTS.md §2.2 Phase 16 note confirming narrator stays out of write path (CONTEXT D-15)
    - apps/studio/schemas/narratorProfile.ts Sanity document type (6 fields — consumed by Plan 16-05 load_narrator_from_issue + Plan 16-07 QA judge rubric assembly + Plan 16-08a seed script + Plan 16-08b GROQ projection)
    - apps/studio/schemas/weeklyIssue.ts narrator optional reference field (consumed by Plan 16-05 GROQ load + Plan 16-08b masthead chip)
    - apps/studio/schemas/index.ts schemaTypes registration of narratorProfile (consumed by Sanity Studio at runtime + TypeGen)
  affects:
    - Plan 16-04 (lib/voice.py refactor) — JESSE_PERSONA_BLOCK seeded narrator content shape locked here
    - Plan 16-05 (DispatchState + Calibrator + writers) — DispatchState.narrator field is now contracted in §7
    - Plan 16-06 (Chronicler narrator-aware) — consumes assemble_voice(narrator) signature via state['style_brief']['voice']
    - Plan 16-07 (QA judge narrator) — voiceRubric + exampleSamples fields locked here in schema
    - Plan 16-08a (seed narrators) — narratorProfile schema is the seed target; 6-field shape locked
    - Plan 16-08b (frontend chip) — QUERY_ISSUE_BY_SLUG narrator->{name, slug, active} contract locked here; Pitfall 8 (no voiceConstraints/voiceRubric/exampleSamples leak) encoded
    - Plan 16-09 (verification + UAT) — every downstream plan now cites this contract as authoritative shape
tech-stack:
  added: []
  patterns:
    - "Additive contract amendment — no field rename; Phase 16 comment style mirrors Phase 13 (`# ── Phase 16: ... ──`)"
    - "narratorProfile mirrors agentProfile.ts builder pattern verbatim (defineType + defineField + preview block)"
    - "Studio dropdown defaults to no selection per D-16 (no initialValue, no required Rule) — narrator absence = default Jesse voice (Pitfall 4 mitigation)"
    - "Security guard: §1.2 GROQ projection contains ONLY name/slug/active — voiceConstraints/voiceRubric/exampleSamples are pipeline-only (Pitfall 8)"
    - "TypeGen attestation pattern: sanity.types.ts is gitignored (Phase 1 D-08), so TypeGen execution is human-verify checkpoint (Phase 1 Pitfall 5 — requires live Sanity credentials)"
key-files:
  created:
    - "apps/studio/schemas/narratorProfile.ts"
    - ".planning/phases/16-choose-your-narrator/16-01-contract-and-schema-SUMMARY.md"
  modified:
    - "docs/API_CONTRACTS.md"  # §1.2 + §7 + §2.2 additive amendments
    - "apps/studio/schemas/weeklyIssue.ts"  # narrator optional reference field added before pipelineMetadata group
    - "apps/studio/schemas/index.ts"  # import + schemaTypes export extended to 4 entries
decisions:
  - "narrator field placed as TOP-LEVEL field on weeklyIssue (not nested inside pipelineMetadata group) — Andrew sees the picker as an editorial-input control adjacent to charity selection, before drilling into technical pipelineMetadata. Inserted immediately BEFORE pipelineMetadata to keep it visually adjacent (Research §B recommendation)."
  - "GROQ projection narrator->{name, slug, active} declared in API_CONTRACTS §1.2 — exactly 3 fields, voiceConstraints/voiceRubric/exampleSamples explicitly excluded (Pitfall 8 security: system-prompt content must never leak to reader-facing query)."
  - "§2.2 write_issue_draft amended with Phase 16 note (NOT a field addition) — narrator is editorial-only; pipeline READS via load_narrator_from_issue but never WRITES. Sanity revision history covers narrator change tracking (CONTEXT D-15) — no pipeline-side audit field."
  - "Andrew's TypeGen execution attested verbatim per the human-verify checkpoint contract (Task 4 resume-signal). sanity.types.ts is gitignored (Phase 1 D-08) so no Claude-side regeneration is possible without live Sanity project credentials in apps/studio/.env.local (Phase 1 Pitfall 5). Approval recorded; no commit of regenerated types required."
metrics:
  duration_minutes: ~20
  tasks_completed: 4
  files_created: 1
  files_modified: 3
  commits: 3  # tasks 1-3 (task 4 = human-verify checkpoint, no commit)
  completed_date: "2026-05-29"
---

# Phase 16 Plan 01: Contract and Schema Summary

## One-Liner

Wave 0 contract gate for Phase 16 — amended docs/API_CONTRACTS.md (§7 DispatchState.narrator + §1.2 GROQ narrator-> projection + §2.2 write-path no-narrator note), created apps/studio/schemas/narratorProfile.ts (6 fields mirroring agentProfile pattern), added weeklyIssue.narrator optional reference, and registered narratorProfile in schemaTypes — unblocking Plans 16-04 through 16-09.

## Outcome

The shared data contract for Phase 16 is now settled and committed BEFORE any pipeline or frontend code touches narrator (CLAUDE.md hard rule honored). Three documents were amended additively in lockstep:

1. **docs/API_CONTRACTS.md §1.2** — QUERY_ISSUE_BY_SLUG gains `narrator->{name, slug, active}` projection adjacent to the existing `charity->{...}` block. Comment marks the security guard: voiceConstraints/voiceRubric/exampleSamples are pipeline-only and MUST NOT be projected to the reader-facing query.
2. **docs/API_CONTRACTS.md §7** — DispatchState gains `narrator: Optional[dict]` after the Phase 13 `deliberation_conversation` field, with a Phase 16 comment block matching the Phase 13 comment style. Verbatim contract for Plan 16-05's DispatchState patch.
3. **docs/API_CONTRACTS.md §2.2** — write_issue_draft preamble gains a "Phase 16 note" paragraph confirming narrator is intentionally NOT part of the write payload. Sanity revision history covers change tracking per CONTEXT D-15.

The Sanity schema layer was extended in lockstep:

4. **apps/studio/schemas/narratorProfile.ts** — new document type with 6 fields (name, slug, voiceConstraints, voiceRubric, exampleSamples, active) — mirrors agentProfile.ts builder pattern. exampleSamples uses plain `{ type: 'text' }` strings (D-12), not Portable Text. active defaults to true with initialValue. Preview block truncates voiceConstraints to 80 chars for Studio card readability.
5. **apps/studio/schemas/weeklyIssue.ts** — narrator optional reference field added immediately BEFORE the existing pipelineMetadata group (around line 423). No `validation: Rule => Rule.required()` (D-09: optional); no `initialValue` (D-16: Studio defaults to no selection — footgun mitigation).
6. **apps/studio/schemas/index.ts** — extended from 3 schemaTypes entries to 4 (charity, weeklyIssue, agentProfile, narratorProfile). Studio sidebar ordering preserved.

The TypeGen step was completed by Andrew per the Task 4 human-verify checkpoint contract: `sanity.types.ts` is gitignored (Phase 1 D-08) and TypeGen requires live Sanity project credentials in `apps/studio/.env.local` (Phase 1 Pitfall 5), so the regeneration runs in Andrew's environment, not in the Claude-side commit graph.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Amend docs/API_CONTRACTS.md (§7 DispatchState narrator + §1.2 GROQ narrator-> + §2.2 write-path no-narrator note) | `ed2d512` | docs/API_CONTRACTS.md |
| 2 | Create apps/studio/schemas/narratorProfile.ts (6 fields, mirrors agentProfile pattern) | `5231bb3` | apps/studio/schemas/narratorProfile.ts |
| 3 | Wire weeklyIssue.narrator optional reference + register narratorProfile in schemaTypes | `1796194` | apps/studio/schemas/weeklyIssue.ts, apps/studio/schemas/index.ts |
| 4 | Andrew runs `pnpm --filter @eisenbalm/studio typegen` to regenerate sanity.types.ts | — (human-verify checkpoint; attested by Andrew via "approved" resume-signal) | apps/studio/sanity.types.ts (gitignored — Phase 1 D-08) |

## API_CONTRACTS Amendment Diff Summary

**§1.2 QUERY_ISSUE_BY_SLUG** — inserted between `charity->{...}` block and `theme {...}` block:

```groq
  narrator-> {
    name,
    "slug": slug.current,
    active,
  },   // Phase 16 (NRR-08): masthead narrator chip projection — name + slug + active ONLY;
       // voiceConstraints / voiceRubric / exampleSamples are pipeline-only and MUST NOT be
       // projected to the reader-facing query (security: no system prompt leak).
```

**§7 DispatchState** — inserted after Phase 13 `deliberation_conversation: Optional[list[dict]]` line:

```python
    # ── Phase 16: Narrator (editorial-only, loaded from Sanity at pipeline start) ──
    narrator: Optional[dict]  # Loaded narratorProfile dict {name, slug, voiceConstraints,
                              # voiceRubric, exampleSamples, active} or None — VERBATIM from
                              # docs/API_CONTRACTS.md §7 (Phase 16 addition). Set unset = default
                              # Jesse voice. The Calibrator is the single agent that reads this
                              # (CONTEXT D-05); all downstream agents consume style_brief['voice']
                              # which Calibrator assembles via lib/voice.assemble_voice(narrator).
```

**§2.2 write_issue_draft** — inserted as a paragraph in the preamble:

> **Phase 16 note:** `narrator` is intentionally NOT part of the write payload. Narrator is an editorial-only Sanity field that Andrew sets in Studio; the pipeline READS it (via `load_narrator_from_issue` in `lib/sanity_client.py`) but never writes it. Narrator change history is preserved by Sanity's built-in revision tracking — no pipeline-side audit field needed (CONTEXT D-15).

No existing field renamed. No Phase 13 conversation[] line touched. Additive only.

## narratorProfile.ts Schema Field List

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | yes | Display name shown on the masthead chip and in the Studio narrator picker, e.g. "Werner Herzog" or "Jesse Eisenbalm" |
| slug | slug | yes | source=name, maxLength=96. Used in seed _id (`narrator-{slug}`) and future `/narrators/[slug]` route |
| voiceConstraints | text (rows=8) | yes | PERSONA_BLOCK content. Merged with UNIVERSAL_CORE in `lib/voice.assemble_voice()` and pushed into `style_brief['voice']` by Calibrator. Replaces JESSE_PERSONA_BLOCK when set. Universal rules (no exclamation marks, Fortune-500 gravity, no AI references, forbidden sentimentality words) live in UNIVERSAL_CORE and apply to every narrator including Jesse |
| voiceRubric | text (rows=8) | yes | Narrator-specific QA scoring rubric. Appended at call time to rubric.md universal axes. When unset, QA falls back to existing Jesse rubric |
| exampleSamples | array of `{ type: 'text' }` | min(1).max(5) | PLAIN strings, NOT Portable Text (D-12 — consistent with chronicler turn shape). Few-shot anchors for QA judge + Studio preview affordance (NRR-07) |
| active | boolean | initialValue=true | When false, pipeline silently falls back to Jesse and emits non-blocking warning on deliberation event log. Lets Andrew park a narrator without delete |

**Preview block:** Selects `name` (title) + `voiceConstraints` (subtitle, truncated to 80 chars + ellipsis). Untitled-narrator fallback when `name` is empty.

## weeklyIssue.narrator Placement Decision

The narrator reference field is placed at the **top level of weeklyIssue** (NOT nested inside the pipelineMetadata group), inserted **immediately BEFORE** the existing `defineField({ name: 'pipelineMetadata', ... })` block.

**Rationale (Research §B):**
- Andrew sees the picker as an editorial-input control before drilling into the technical pipelineMetadata group
- Top-level placement matches the position of `charity` (the other editorial-input reference field that drives the pipeline)
- Adjacent-to-pipelineMetadata placement preserves the conceptual grouping (narrator is a pipeline-run input) while keeping the picker discoverable

**Constraints honored:**
- D-09: optional reference — no `validation: Rule => Rule.required()`
- D-16: Studio defaults to no selection — no `initialValue`
- D-20: chat thread chip unchanged (Phase 13 frontend conversation pattern preserved)

**Field definition committed verbatim:**

```typescript
defineField({
  name: 'narrator',
  title: 'Narrator',
  type: 'reference',
  to: [{ type: 'narratorProfile' }],
  description: 'Optional narrator profile. Leave unset for default Jesse voice. Set to override all four narrative sections (Origin Story, Problem, Founder Bio, Case Study) + the deliberation conversation. Clicking the linked profile opens the Studio card showing exampleSamples (NRR-07 preview affordance).',
}),
```

## TypeGen Run Outcome (Task 4 Checkpoint)

**Type:** `checkpoint:human-verify` (autonomous: false — requires Sanity project credentials per Phase 1 Pitfall 5)

**Resume signal received:** Andrew typed "approved" — meaning TypeGen succeeded in his environment with live Sanity credentials.

**What Andrew confirmed:**
1. `pnpm --filter @eisenbalm/studio typegen` exited 0 with no "Schema validation failed" messages
2. `apps/studio/sanity.types.ts` contains the NarratorProfile interface
3. `apps/studio/sanity.types.ts` contains the `narrator?: { _type: 'reference'; _ref: string }` field on WeeklyIssue
4. `pnpm --filter web build` exits 0 (no TS errors from the new Sanity type surface)

**Why no commit:** `apps/studio/sanity.types.ts` is gitignored per Phase 1 D-08 (TypeGen artifact regenerated locally on each schema change). The regenerated file is intentionally NOT committed; each engineer / CI pipeline regenerates it from the canonical schema files (`schemas/*.ts`) on demand. This is the established Phase 1 contract and is preserved verbatim here.

**Downstream consumption:** Plans 16-04 through 16-09 can now import the `NarratorProfile` type and the `WeeklyIssue['narrator']` field from `@eisenbalm/shared` (the Sanity-types re-export shim) without manual type definition.

## Deviations from Plan

None — plan executed exactly as written. All three task action blocks landed verbatim:
- §1.2 narrator-> block inserted at the documented position (adjacent to charity->)
- §7 narrator field inserted after the Phase 13 deliberation_conversation line with matching Phase 13 comment style
- §2.2 Phase 16 note appended to the write_issue_draft preamble
- narratorProfile.ts created with 6 defineField invocations verbatim from the plan's action block
- weeklyIssue.ts narrator field inserted immediately BEFORE pipelineMetadata group (no `validation` rule, no `initialValue` — D-09 + D-16 honored)
- index.ts extended from 3 → 4 entries in schemaTypes export

No Rule 1/2/3 auto-fixes applied. No Rule 4 architectural escalations. No CLAUDE.md-driven adjustments.

## Verification Evidence

```
# §1.2 narrator-> projection — present
$ grep -c "narrator->" docs/API_CONTRACTS.md
1

# §7 DispatchState narrator — present
$ grep -c "narrator: Optional\[dict\]" docs/API_CONTRACTS.md
1

# §2.2 Phase 16 note — present
$ grep -c "Phase 16 note" docs/API_CONTRACTS.md
1

# narratorProfile.ts — 6 fields
$ grep -c "defineField({" apps/studio/schemas/narratorProfile.ts
6

# weeklyIssue.ts — narrator field added
$ grep -c "name: 'narrator'" apps/studio/schemas/weeklyIssue.ts
1

# index.ts — narratorProfile registered (1 import + 1 in schemaTypes)
$ grep -c "narratorProfile" apps/studio/schemas/index.ts
2

# Git log — all 3 commits present
$ git log --oneline | grep -E "16-01"
1796194 feat(16-01): wire narrator into weeklyIssue + register narratorProfile in schemaTypes
5231bb3 feat(16-01): add narratorProfile Sanity schema (6 fields, mirrors agentProfile pattern)
ed2d512 docs(16-01): amend API_CONTRACTS §1.2 + §7 + §2.2 for Phase 16 narrator
```

## Successor Plans Now Unblocked

| Plan | Wave | What it implements | Contract from 16-01 it consumes |
|------|------|--------------------|---------------------------------|
| 16-04 | 1 | `lib/voice.py` refactor — UNIVERSAL_CORE + JESSE_PERSONA_BLOCK + assemble_voice() | narratorProfile.voiceConstraints field shape (text rows=8) — JESSE_PERSONA_BLOCK content shape inherits this |
| 16-05 | 2 | DispatchState.narrator field + load_narrator_from_issue + Calibrator narrator-awareness + 4 writer voice_constraints kwarg | API_CONTRACTS §7 `narrator: Optional[dict]` (verbatim) + weeklyIssue.narrator reference field (loadable from Sanity) |
| 16-06 | 2 | Chronicler narrator-aware (_build_system_prompt accepts voice_constraints kwarg) | DispatchState.narrator + style_brief['voice'] (Plan 16-05 assembles via assemble_voice) |
| 16-07 | 2 | QA judge narrator (run_llm_judge narrator kwarg + voiceRubric/exampleSamples append) | narratorProfile.voiceRubric + exampleSamples field shapes |
| 16-08a | 2 | Seed 3 narrators (jesse + maya-rudolph + werner-herzog) — narratorProfile documents | narratorProfile schema is the seed target; 6-field shape locked |
| 16-08b | 2 | Frontend chip on issue page masthead + QUERY_ISSUE_BY_SLUG narrator->{...} | API_CONTRACTS §1.2 narrator->{name, slug, active} projection (verbatim, Pitfall 8 guard) |
| 16-09 | 3 | Verification + UAT — full test matrix | All 16-01 contracts as authoritative reference for assertion shapes |

## Self-Check: PASSED

- All 4 created/modified files exist on disk (confirmed via `[ -f ]` checks)
- All 3 commit hashes (ed2d512, 5231bb3, 1796194) resolve in `git log --oneline`
- All 6 grep contract checks return the expected counts (1/1/1/6/1/2)
- Task 4 human-verify checkpoint attested by Andrew via "approved" resume-signal
- Wave 0 contract gate is closed: Plans 16-02 through 16-09 can cite docs/API_CONTRACTS.md §7 / §1.2 / §2.2 as their authoritative shape
- No tripwire test regression introduced (additive-only contract amendments + new schema document, no field rename, no Phase 13 conversation[] field touched)
