---
phase: 16-choose-your-narrator
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - apps/studio/schemas/narratorProfile.ts
  - apps/studio/schemas/weeklyIssue.ts
  - apps/studio/schemas/index.ts
autonomous: false
requirements: [NRR-01, NRR-02, NRR-07]
must_haves:
  truths:
    - "docs/API_CONTRACTS.md declares narrator on DispatchState (§7) AND narrator->{name, slug, active} projection on QUERY_ISSUE_BY_SLUG (§1.2) AND confirms §2.2 write path does NOT add narrator (editorial-only)"
    - "apps/studio/schemas/narratorProfile.ts exists with 6 fields (name, slug, voiceConstraints, voiceRubric, exampleSamples, active) mirroring agentProfile.ts pattern"
    - "apps/studio/schemas/weeklyIssue.ts has an additive narrator optional reference field — no existing field renamed"
    - "apps/studio/schemas/index.ts registers narratorProfile in schemaTypes export"
    - "pnpm --filter @eisenbalm/studio typegen exits 0 and apps/studio/sanity.types.ts contains NarratorProfile type"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "Contract amendments for narrator DispatchState field + narrator->{...} GROQ projection"
      contains: "narrator"
    - path: "apps/studio/schemas/narratorProfile.ts"
      provides: "Sanity document type for Narrator Profile"
      contains: "name: 'narratorProfile'"
    - path: "apps/studio/schemas/weeklyIssue.ts"
      provides: "Additive narrator optional reference field"
      contains: "name: 'narrator'"
    - path: "apps/studio/schemas/index.ts"
      provides: "schemaTypes export with narratorProfile registered"
      contains: "narratorProfile"
  key_links:
    - from: "apps/studio/schemas/weeklyIssue.ts narrator field"
      to: "apps/studio/schemas/narratorProfile.ts"
      via: "type: 'reference', to: [{ type: 'narratorProfile' }]"
      pattern: "narratorProfile"
    - from: "docs/API_CONTRACTS.md §1.2"
      to: "apps/web/lib/sanity/queries.ts (consumed by Plan 16-08)"
      via: "narrator->{name, slug, active} projection contract"
      pattern: "narrator->"
    - from: "docs/API_CONTRACTS.md §7"
      to: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py (consumed by Plan 16-05)"
      via: "narrator: NotRequired[Optional[dict]] contract"
      pattern: "narrator"
---

<objective>
Settle the shared data contract for Phase 16 BEFORE any pipeline or frontend code touches narrator. Per CLAUDE.md hard rule, no schema or contract change ships without updating docs/API_CONTRACTS.md first. This plan is the Wave 0 gating task — Plans 16-02 through 16-09 cannot proceed until this lands.

This plan:
1. Amends docs/API_CONTRACTS.md §7 (DispatchState gains narrator), §1.2 (QUERY_ISSUE_BY_SLUG gains narrator->{...}), and §2.2 (explicit note: write path does NOT add narrator — editorial-only field).
2. Creates apps/studio/schemas/narratorProfile.ts with the 6 fields locked in CONTEXT D-08 (name, slug, voiceConstraints, voiceRubric, exampleSamples, active).
3. Adds the additive `narrator` optional reference field to apps/studio/schemas/weeklyIssue.ts under the pipelineMetadata group (D-09 + Research §B placement recommendation).
4. Registers narratorProfile in apps/studio/schemas/index.ts.
5. Runs `pnpm --filter @eisenbalm/studio typegen` to regenerate sanity.types.ts so downstream plans can consume NarratorProfile type-safely (autonomous: false — requires Sanity project credentials per Pitfall 5).

Purpose: a single source of truth for the narrator data shape so Plans 16-05 (pipeline state), 16-08 (frontend GROQ), and 16-07 (QA judge load) all consume an agreed contract.
Output: amended contract doc, new schema file, additive field on weeklyIssue, registered schema, regenerated TypeGen artifact.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@.planning/phases/16-choose-your-narrator/16-VALIDATION.md
@.planning/phases/16-choose-your-narrator/16-INTENT.md

<interfaces>
<!-- The agreed narrator shapes this plan declares. Plans 16-05 + 16-07 + 16-08 consume these directly. -->

DispatchState field (Python — graph/state.py addition, declared here as contract, written by Plan 16-05):
```python
# ── Phase 16: Narrator ────────────────────────────────────────────────────
narrator: NotRequired[Optional[dict]]
# Loaded narratorProfile dict: {name, slug, voiceConstraints, voiceRubric, exampleSamples, active} or None.
# VERBATIM from docs/API_CONTRACTS.md §7 (Phase 16 addition).
```

Sanity narratorProfile schema fields (CONTEXT D-08 + Research §B):
- name (string, required) — display name e.g. "Werner Herzog"
- slug (slug, required, source=name, maxLength=96)
- voiceConstraints (text, rows=8, required) — PERSONA_BLOCK content for the pipeline
- voiceRubric (text, rows=8, required) — narrator-specific QA scoring rubric
- exampleSamples (array of `{ type: 'text' }`, validation min(1).max(5)) — PLAIN strings NOT Portable Text (D-12)
- active (boolean, default true) — Andrew parks without delete

Sanity weeklyIssue.narrator field (additive, optional reference, placed inside pipelineMetadata group OR just before the existing pipelineMetadata group definition — Research §B recommendation: under pipelineMetadata since it is an editorial configuration input that influences the pipeline run):
```typescript
defineField({
  name: 'narrator',
  title: 'Narrator',
  type: 'reference',
  to: [{ type: 'narratorProfile' }],
  description: 'Optional narrator profile. Leave unset for default Jesse voice. Set to override all four narrative sections (Origin Story, Problem, Founder Bio, Case Study) + the deliberation conversation.',
})
```

GROQ projection addition to QUERY_ISSUE_BY_SLUG selectionDeliberation block in API_CONTRACTS §1.2 — exactly these 3 fields, no voiceConstraints/voiceRubric/exampleSamples leak (Research Pitfall 8):
```groq
narrator-> {
  name,
  "slug": slug.current,
  active,
},
```

API_CONTRACTS §2.2 confirmation note — the Python write path does NOT add narrator. Sanity revision history covers narrator change tracking (CONTEXT D-15).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md (§7 DispatchState narrator + §1.2 GROQ narrator-> + §2.2 write-path no-narrator note)</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md lines 47-129 (§1.2 QUERY_ISSUE_BY_SLUG current text — the selectionDeliberation block ends at line 123 with `conversation[] { speaker, text }` from Phase 13)
    - docs/API_CONTRACTS.md lines 1236-1354 (§7 DispatchState current text — Phase 13 added deliberation_conversation at line 1329)
    - docs/API_CONTRACTS.md lines 297-404 (§2.2 write_issue_draft — confirm narrator is NOT in the write doc; it is editorial-only)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md (D-09 narrator is optional reference; D-15 mid-draft swaps go through Sanity revision history not pipeline state; D-20 confirm chat thread chip unchanged)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §B + §I + Pitfall 7 + Pitfall 8 (frontend projection contains ONLY name/slug/active — voiceConstraints/voiceRubric/exampleSamples MUST NOT leak)
    - .planning/STATE.md Phase 06 + Phase 13 entries (API_CONTRACTS amendment convention — additive insertions with clear Phase comment, no strikethrough needed for new fields)
    - CLAUDE.md (hard rule: contract first; this plan IS the gate)
  </read_first>
  <action>
Edit docs/API_CONTRACTS.md in three places.

(A) §1.2 — extend QUERY_ISSUE_BY_SLUG. Insert (between the `charity-> { ... }` block at lines 57-67 and the `theme { ... }` block at line 69) a new narrator projection block — placed adjacent to charity-> because both are top-level document references the page consumes for masthead rendering:

```groq
  narrator-> {
    name,
    "slug": slug.current,
    active,
  },   // Phase 16 (NRR-08): masthead narrator chip projection — name + slug + active ONLY; voiceConstraints / voiceRubric / exampleSamples are pipeline-only and MUST NOT be projected to the reader-facing query (security: no system prompt leak).
```

(B) §7 — extend DispatchState. After the existing `deliberation_conversation: Optional[list[dict]]` line at line 1329, add a new Phase 16 section block (mirrors the Phase 13 comment style):

```python
    # ── Phase 16: Narrator (editorial-only, loaded from Sanity at pipeline start) ──
    narrator: Optional[dict]                # Loaded narratorProfile dict {name, slug, voiceConstraints, voiceRubric, exampleSamples, active} or None — VERBATIM from docs/API_CONTRACTS.md §7 (Phase 16 addition). Set unset = default Jesse voice. The Calibrator is the single agent that reads this (CONTEXT D-05); all downstream agents consume style_brief["voice"] which Calibrator assembles via lib/voice.assemble_voice(narrator).
```

(C) §2.2 — add a write-path note. After the existing write_issue_draft function header / preamble (around line 304 where the docstring is), add a short Phase 16 note paragraph (do NOT add a narrator field to the doc body — confirm it stays out):

```markdown
**Phase 16 note:** `narrator` is intentionally NOT part of the write payload. Narrator is an editorial-only Sanity field that Andrew sets in Studio; the pipeline READS it (via load_narrator_from_issue in lib/sanity_client.py) but never writes it. Narrator change history is preserved by Sanity's built-in revision tracking — no pipeline-side audit field needed (CONTEXT D-15).
```

Do not rename any existing field. Do not delete the Phase 13 conversation[] line or the Phase 13 deliberation_conversation field. Additive only.
  </action>
  <verify>
    <automated>grep -E "narrator->" docs/API_CONTRACTS.md | head -1 returns a match in §1.2 block; grep -E "narrator: Optional\[dict\]" docs/API_CONTRACTS.md returns a match in §7 block; grep -E "Phase 16 note" docs/API_CONTRACTS.md returns a match in §2.2 area; grep -E "voiceConstraints|voiceRubric|exampleSamples" docs/API_CONTRACTS.md inside the §1.2 GROQ projection returns NO matches (security: pipeline-only fields stay out of frontend projection)</automated>
  </verify>
  <done>docs/API_CONTRACTS.md has additive narrator field in §7 DispatchState, additive narrator-> projection in §1.2 (name+slug+active only), and the §2.2 Phase 16 note confirming narrator stays out of the write path. No existing field renamed.</done>
</task>

<task type="auto">
  <name>Task 2: Create apps/studio/schemas/narratorProfile.ts (mirrors agentProfile.ts pattern)</name>
  <files>apps/studio/schemas/narratorProfile.ts</files>
  <read_first>
    - apps/studio/schemas/agentProfile.ts (verbatim mirror pattern — defineType/defineField, type:'document', preview block)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-08 (6 fields locked: name, slug, voiceConstraints, voiceRubric, exampleSamples, active)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-12 (exampleSamples = plain strings NOT Portable Text; consistent with chronicler turn shape)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §B (full schema field specification with validation rules)
  </read_first>
  <action>
Create the new file apps/studio/schemas/narratorProfile.ts with this verbatim content (note: TypeScript `Rule` parameter typing follows the existing agentProfile.ts convention — Rule is inferred by Sanity types):

```typescript
import { defineField, defineType } from 'sanity'

// Phase 16 (NRR-01): Per-issue editorial voice variation. Andrew picks a narrator
// from these documents on weeklyIssue.narrator; the Calibrator merges the
// voiceConstraints into the StyleBrief and the QA judge layers in voiceRubric +
// exampleSamples at call time.
// Mirrors the agentProfile.ts pattern verbatim — same defineType/defineField
// builder, same preview shape.

export default defineType({
  name: 'narratorProfile',
  title: 'Narrator Profile',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Display name shown on the masthead chip and in the Studio narrator picker, e.g. "Werner Herzog" or "Jesse Eisenbalm"',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'Used in seed _id (narrator-{slug}) and future /narrators/[slug] route. Auto-generated from name.',
      options: { source: 'name', maxLength: 96 },
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'voiceConstraints',
      title: 'Voice Constraints (PERSONA_BLOCK)',
      type: 'text',
      rows: 8,
      description: 'The narrator-controlled persona register. Merged with UNIVERSAL_CORE in lib/voice.assemble_voice() and pushed into style_brief["voice"] by the Calibrator. Replaces the JESSE_PERSONA_BLOCK portion when set. Universal rules (no exclamation marks, Fortune-500 gravity, no AI references, forbidden sentimentality words) are NOT here — they live in UNIVERSAL_CORE and apply to every narrator including Jesse.',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'voiceRubric',
      title: 'Voice Rubric (QA persona register)',
      type: 'text',
      rows: 8,
      description: 'Narrator-specific QA scoring rubric. Appended at call time to rubric.md universal axes (gravity, sentiment, irony-signaling, precision, cross-section-consistency). When unset, QA falls back to the existing Jesse rubric.',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'exampleSamples',
      title: 'Example Samples',
      type: 'array',
      of: [{ type: 'text' }],
      description: 'Short prose samples proving the voice. Used as few-shot anchors in the QA system prompt and as preview affordance in Studio. PLAIN strings, NOT Portable Text (consistent with chronicler turn shape).',
      validation: Rule => Rule.min(1).max(5),
    }),
    defineField({
      name: 'active',
      title: 'Active',
      type: 'boolean',
      description: 'When false, the pipeline silently falls back to Jesse and emits a non-blocking warning on the deliberation event log. Lets Andrew park a narrator without deleting it.',
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'voiceConstraints',
    },
    prepare({ title, subtitle }) {
      // Truncate the persona block in the Studio card preview so the list view stays readable.
      const short = typeof subtitle === 'string' && subtitle.length > 80
        ? subtitle.slice(0, 80) + '…'
        : subtitle || ''
      return { title: title || 'Untitled narrator', subtitle: short }
    },
  },
})
```
  </action>
  <verify>
    <automated>test -f apps/studio/schemas/narratorProfile.ts; grep -c "defineField" apps/studio/schemas/narratorProfile.ts returns 6; grep -E "name: 'narratorProfile'" apps/studio/schemas/narratorProfile.ts returns a match; grep -E "name: 'voiceConstraints'|name: 'voiceRubric'|name: 'exampleSamples'|name: 'active'|name: 'name'|name: 'slug'" apps/studio/schemas/narratorProfile.ts returns 6 matches</automated>
  </verify>
  <done>apps/studio/schemas/narratorProfile.ts created with 6 fields matching CONTEXT D-08 + preview block + plain-string exampleSamples + initialValue:true on active.</done>
</task>

<task type="auto">
  <name>Task 3: Add narrator optional reference field to apps/studio/schemas/weeklyIssue.ts + register narratorProfile in schemas/index.ts</name>
  <files>apps/studio/schemas/weeklyIssue.ts, apps/studio/schemas/index.ts</files>
  <read_first>
    - apps/studio/schemas/weeklyIssue.ts line 423 (existing `name: 'pipelineMetadata'` defineField — narrator field is added immediately before this defineField block so Andrew sees it adjacent to other pipeline-input editorial controls per Research §B recommendation)
    - apps/studio/schemas/weeklyIssue.ts lines 28-100 (top-level fields pattern for reference field reference — see line 70-78 charity defineField as the reference type exemplar)
    - apps/studio/schemas/index.ts (current 3-export pattern — must be extended to 4 exports)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-09 (optional reference to narratorProfile; absence = null = default Jesse) + D-16 (Studio dropdown defaults to no selection — footgun mitigation; no initialValue needed beyond Sanity's default null)
  </read_first>
  <action>
Two file edits.

(A) apps/studio/schemas/weeklyIssue.ts — insert this defineField immediately BEFORE the existing `defineField({ name: 'pipelineMetadata', ... })` block (around line 423). The narrator field is intentionally a top-level field on weeklyIssue (NOT nested inside pipelineMetadata) so Andrew sees the picker as an editorial-input control before drilling into the technical pipelineMetadata group:

```typescript
    defineField({
      name: 'narrator',
      title: 'Narrator',
      type: 'reference',
      to: [{ type: 'narratorProfile' }],
      description: 'Optional narrator profile. Leave unset for default Jesse voice. Set to override all four narrative sections (Origin Story, Problem, Founder Bio, Case Study) + the deliberation conversation. Clicking the linked profile opens the Studio card showing exampleSamples (NRR-07 preview affordance).',
    }),
```

Do NOT add `validation: Rule => Rule.required()` — narrator must stay optional (D-09). Do NOT add `initialValue` — Studio defaults to no selection per D-16.

(B) apps/studio/schemas/index.ts — extend the import + export. Replace the existing 3-line import block + schemaTypes array with this 4-entry version:

```typescript
import charity from './charity'
import weeklyIssue from './weeklyIssue'
import agentProfile from './agentProfile'
import narratorProfile from './narratorProfile'

// Document type order controls Sanity Studio sidebar ordering
export const schemaTypes = [weeklyIssue, charity, agentProfile, narratorProfile]
```
  </action>
  <verify>
    <automated>grep -E "name: 'narrator'" apps/studio/schemas/weeklyIssue.ts returns a match; grep -E "to: \[\{ type: 'narratorProfile' \}\]" apps/studio/schemas/weeklyIssue.ts returns a match; grep -c "narratorProfile" apps/studio/schemas/index.ts returns 2 (one import, one in schemaTypes); awk '/name: .narrator./{p=NR} /name: .pipelineMetadata./{q=NR} END{exit !(p<q)}' apps/studio/schemas/weeklyIssue.ts (narrator field placed BEFORE pipelineMetadata)</automated>
  </verify>
  <done>weeklyIssue.ts has narrator optional reference field immediately before pipelineMetadata; no existing field renamed; index.ts registers narratorProfile in schemaTypes as the 4th entry.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Andrew runs `pnpm --filter @eisenbalm/studio typegen` to regenerate sanity.types.ts</name>
  <what-built>
Tasks 1-3 added the narratorProfile schema, registered it, and added the weeklyIssue.narrator reference. TypeGen must now be run by Andrew (autonomous: false because sanity.types.ts is gitignored per Phase 1 D-08 and TypeGen requires the live Sanity project credentials in apps/studio/.env.local — Pitfall 5).
  </what-built>
  <how-to-verify>
1. `cd /Users/user/Desktop/Eisenbalm`
2. `pnpm --filter @eisenbalm/studio typegen`
3. Confirm exit code 0 and no "Schema validation failed" messages.
4. `grep -E "NarratorProfile|narrator\\?:" apps/studio/sanity.types.ts | head -5` — confirm the NarratorProfile type AND the WeeklyIssue['narrator'] field both appear.
5. `pnpm --filter web build` — confirm Next.js build still passes (no type errors from the new Sanity type surface).
  </how-to-verify>
    <action>
This task is a manual checkpoint — Andrew executes the steps in <how-to-verify> below. There is no Claude-automated action for this task; the verification happens entirely in the user's environment with the user's credentials.
  </action>
  <verify>
    <automated>(checkpoint — manual: Andrew confirms each step in <how-to-verify> and types "approved" in <resume-signal>)</automated>
  </verify>
  <done>Andrew types "approved" after completing each <how-to-verify> step successfully.</done>
  <resume-signal>Type "approved" or describe issues (e.g., "TypeGen failed with: ...")</resume-signal>
</task>

</tasks>

<verification>
- docs/API_CONTRACTS.md §7 + §1.2 + §2.2 updates are committed BEFORE any pipeline or frontend code in Plans 16-02 through 16-09 touches narrator (CLAUDE.md hard rule, Pitfall 7).
- narratorProfile.ts compiles cleanly under Sanity's schema validation (no missing field types, no broken Rule references).
- weeklyIssue.narrator field renders as a reference picker in Studio that lists narratorProfile documents.
- sanity.types.ts after typegen contains a NarratorProfile interface AND a `narrator?: { _type: 'reference'; _ref: string }` field on WeeklyIssue.
- pnpm --filter web build exits 0 (no TS error from the new Sanity type surface).
</verification>

<success_criteria>
- All 4 tasks complete with matching acceptance criteria green.
- The Wave 0 contract gate is closed: Plans 16-02 (pipeline tests), 16-05 (DispatchState + Calibrator), 16-08 (frontend chip + GROQ) can each cite docs/API_CONTRACTS.md §7 or §1.2 as their authoritative shape and execute against a stable contract.
- No existing tripwire test goes red (the schema additions are additive, not renames).
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-01-SUMMARY.md` documenting: API_CONTRACTS amendment diff summary, narratorProfile.ts schema field list, weeklyIssue.narrator placement decision, TypeGen run outcome, any deviations.
</output>
