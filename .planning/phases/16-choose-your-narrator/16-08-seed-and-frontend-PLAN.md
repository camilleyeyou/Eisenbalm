---
phase: 16-choose-your-narrator
plan: 08
type: execute
wave: 2
depends_on: ["16-01", "16-02", "16-03", "16-04"]
files_modified:
  - apps/studio/seeds/narrators.json
  - apps/studio/scripts/seed-narrators.ts
  - apps/studio/package.json
  - apps/web/lib/sanity/queries.ts
  - apps/web/lib/sanity/types.ts
  - apps/web/components/issue/IssueHero.tsx
  - apps/web/app/issue/[slug]/page.tsx
autonomous: false
requirements: [NRR-07, NRR-08, NRR-09]
must_haves:
  truths:
    - "apps/studio/seeds/narrators.json contains 3 narrator entries (jesse, maya-rudolph, werner-herzog) with the exact field shape narratorProfile.ts declares"
    - "jesse entry voiceConstraints equals JESSE_PERSONA_BLOCK byte-for-byte after whitespace normalization (D-10 cross-language sentinel)"
    - "maya-rudolph + werner-herzog entries carry the client-supplied Nap Ministry sample tables from 16-INTENT.md verbatim as exampleSamples (≤3 samples each, ≤200 words each per D-12)"
    - "apps/studio/scripts/seed-narrators.ts is idempotent (createOrReplace with deterministic _id `narrator-{slug}`) mirroring apps/studio/scripts/seed-agents.ts pattern verbatim"
    - "apps/studio/package.json gains `seed:narrators` npm script invoking the seed file"
    - "apps/web/lib/sanity/queries.ts QUERY_ISSUE_BY_SLUG gains narrator->{name, slug, active} block adjacent to charity-> — voiceConstraints/voiceRubric/exampleSamples NOT projected (Pitfall 8)"
    - "apps/web/lib/sanity/types.ts gains IssueNarrator type + Issue.narrator field"
    - "apps/web/components/issue/IssueHero.tsx accepts narrator?: IssueNarrator | null prop AND renders chip when narrator is set AND name !== 'Jesse Eisenbalm' using --color-text-mute + Inter uppercase 0.18em"
    - "apps/web/app/issue/[slug]/page.tsx passes issue.selectionDeliberation?-related-or-issue.narrator down to IssueHero"
    - "Wave 0 narrator-chip.test.ts (≥7 assertions across 4 describe blocks) flips fully GREEN"
    - "All 8 existing tripwire tests + 29 CMR sentinels stay GREEN; pnpm --filter web build exits 0"
    - "Andrew runs `pnpm seed:narrators` and the 3 narrators appear in Studio (manual UAT — autonomous: false)"
  artifacts:
    - path: "apps/studio/seeds/narrators.json"
      provides: "3 seeded narratorProfile documents (jesse, maya-rudolph, werner-herzog)"
      contains: "werner-herzog"
    - path: "apps/studio/scripts/seed-narrators.ts"
      provides: "Idempotent seed script"
      contains: "createOrReplace"
    - path: "apps/studio/package.json"
      provides: "seed:narrators npm script"
      contains: "seed:narrators"
    - path: "apps/web/lib/sanity/queries.ts"
      provides: "narrator->{name, slug, active} projection on QUERY_ISSUE_BY_SLUG"
      contains: "narrator->"
    - path: "apps/web/lib/sanity/types.ts"
      provides: "IssueNarrator type + Issue.narrator field"
      contains: "IssueNarrator"
    - path: "apps/web/components/issue/IssueHero.tsx"
      provides: "Narrator masthead chip rendered conditionally"
      contains: "Narrated by"
    - path: "apps/web/app/issue/[slug]/page.tsx"
      provides: "narrator prop wired from GROQ result to IssueHero"
      contains: "narrator"
  key_links:
    - from: "apps/studio/seeds/narrators.json jesse.voiceConstraints"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.JESSE_PERSONA_BLOCK"
      via: "cross-language sentinel test (test_narrator_seed_sentinel.py)"
      pattern: "JESSE_PERSONA_BLOCK"
    - from: "apps/web/components/issue/IssueHero.tsx chip render"
      to: "apps/web/lib/sanity/queries.ts narrator-> projection"
      via: "narrator prop typed as IssueNarrator | null"
      pattern: "narrator"
---

<objective>
Land the user-facing surface: 3 seeded narratorProfile documents (NRR-09) + Studio preview affordance (NRR-07) + frontend GROQ extension + IssueHero chip (NRR-08). This plan turns the Wave 0 narrator-chip.test.ts GREEN and the seed-sentinel + cost-budget tests in pytest GREEN.

Per Research §B seed pattern: idempotent createOrReplace with deterministic `_id = narrator-{slug}`. Per CONTEXT D-10/D-11: jesse profile carries JESSE_PERSONA_BLOCK verbatim; maya + herzog carry the client samples from 16-INTENT.md. Per CONTEXT D-19: chip placement under issue title, Inter uppercase 0.18em on --color-text-mute. Per Pitfall 8: GROQ projection is name+slug+active ONLY — voiceConstraints/voiceRubric/exampleSamples MUST NOT leak.

This plan is the largest of Wave 2 (7 files) because it crosses the Studio → web boundary. The Studio half (seed json, seed script, package.json) is autonomous-true; the runtime UAT (Andrew runs seed against live Sanity) is the autonomous-false checkpoint.

Output: 7 files modified; narrator-chip.test.ts ≥7 assertions all GREEN; test_narrator_seed_sentinel + test_narrator_cost_budget flip GREEN; all 8 web tripwires + pnpm build green; Andrew manual seed runs once and 3 narrators appear in Studio.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@.planning/phases/16-choose-your-narrator/16-VALIDATION.md
@.planning/phases/16-choose-your-narrator/16-INTENT.md

<interfaces>
<!-- The shape narrators.json must satisfy: -->
[
  {
    "slug": "jesse",
    "name": "Jesse Eisenbalm",
    "voiceConstraints": "<exact JESSE_PERSONA_BLOCK content from lib/voice.py>",
    "voiceRubric": "<persona-register portion of rubric.md>",
    "exampleSamples": ["..."],
    "active": true
  },
  { "slug": "maya-rudolph", "name": "Maya Rudolph", ...},
  { "slug": "werner-herzog", "name": "Werner Herzog", ...}
]

<!-- IssueHero new prop (Plan 16-01 GROQ projection already added at contract level): -->
interface IssueHeroProps {
  // ... existing 5 props ...
  narrator: IssueNarrator | null
}

<!-- The chip JSX (within IssueHero render, placed between the byline (current line 126-128) and the mission statement (current line 132-140)): -->
{narrator && narrator.name !== 'Jesse Eisenbalm' && (
  <p
    className="eyebrow mb-6 text-[color:var(--color-text-mute)]"
    style={{ letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: '11px' }}
  >
    Narrated by {narrator.name}
  </p>
)}
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create apps/studio/seeds/narrators.json with 3 seeded narrator profiles</name>
  <files>apps/studio/seeds/narrators.json</files>
  <read_first>
    - apps/studio/scripts/agents.json (Phase 1 seed file — matches the data shape pattern this file mirrors)
    - .planning/phases/16-choose-your-narrator/16-INTENT.md (the FULL Maya/Herzog/Sorkin sample tables for The Nap Ministry — these go into exampleSamples verbatim)
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py JESSE_PERSONA_BLOCK constant (Plan 16-04 landed it; copy its content verbatim into the jesse seed entry's voiceConstraints field for the sentinel)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md "Jesse Voice (Non-Negotiable)" section (the persona-register prose — copy into jesse seed's voiceRubric field per D-10)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-10 / D-11 / D-12
  </read_first>
  <action>
Create apps/studio/seeds/narrators.json. The file is JSON (NOT TypeScript) per the agents.json precedent. Three entries — one object per narrator. Use a top-level array (not a dict) so seed-narrators.ts can iterate with `.map(...)` mirroring seed-agents.ts.

Verbatim structure:

```json
[
  {
    "slug": "jesse",
    "name": "Jesse Eisenbalm",
    "voiceConstraints": "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. No irony signaling. The brand does not pivot to AI.",
    "voiceRubric": "Dry, precise, and absurdly serious. No winking. No irony signaling. The brand does not pivot to AI. Jesse was born AI. This is not a gimmick.\n\nEvery charity is treated with the gravity of a Fortune 500 company. Every founder is treated as a visionary regardless of obscurity. The question \"Why do you deserve to exist?\" is answered without sentiment.",
    "exampleSamples": [
      "The Eisenbalm Dispatch profiles charities that operate beneath the floor of public attention. We feature one per week. The intent is not to celebrate. The intent is to record.",
      "There is a small operation in Atlanta that argues rest is resistance. It does not deliver food. It does not run a clinic. It hosts collective naps. It has chosen this work."
    ],
    "active": true
  },
  {
    "slug": "maya-rudolph",
    "name": "Maya Rudolph",
    "voiceConstraints": "Maya Rudolph voice. Warm, enthusiastic, generous. Conversational asides mid-sentence. Short punchy one-line paragraphs that land like a beat in a sketch. Real curiosity about the people in the story, never about performing curiosity. The brand does not pivot to AI.",
    "voiceRubric": "Score for: warm enthusiasm without sentimentality. Asides that feel observed, not staged. Short punchy paragraphs (1-3 sentences) that punctuate longer ones. The work treated as IMPORTANT, never cute. The voice is generous; the subject is given full credit. Forbidden: sketch-comedy register, mugging, self-deprecating asides about being a narrator, any winking at the audience. The narrator is enthusiastic about THIS, not about being asked.",
    "exampleSamples": [
      "[VERBATIM_FROM_16-INTENT.md — Maya Rudolph's Origin Story for The Nap Ministry, the full ~150-200 word sample from the client doc table]",
      "[VERBATIM_FROM_16-INTENT.md — Maya Rudolph's Problem Statement for The Nap Ministry, the full ~150-200 word sample from the client doc table]",
      "[VERBATIM_FROM_16-INTENT.md — Maya Rudolph's Founder Bio for The Nap Ministry, the full ~150-200 word sample from the client doc table]"
    ],
    "active": true
  },
  {
    "slug": "werner-herzog",
    "name": "Werner Herzog",
    "voiceConstraints": "Werner Herzog voice. Sweeping, philosophical, geological-time metaphors. Wry comparisons to opera-builders in jungles, men who pull ships over mountains. Ultimate sincerity. Sentences that breathe between commas. The brand does not pivot to AI.",
    "voiceRubric": "Score for: cosmic register. Sentences that reach for the long arc of human striving. Wry comparisons (the opera house in the jungle, the river tired after centuries). The subject given gravity equal to its own ambition. Forbidden: sentimentality, exclamation, soft adjectives. The narrator is sincere with the audience the way a witness is sincere about what they have seen.",
    "exampleSamples": [
      "[VERBATIM_FROM_16-INTENT.md — Werner Herzog's Origin Story for The Nap Ministry, the full ~150-200 word sample from the client doc table]",
      "[VERBATIM_FROM_16-INTENT.md — Werner Herzog's Problem Statement for The Nap Ministry, the full ~150-200 word sample from the client doc table]",
      "[VERBATIM_FROM_16-INTENT.md — Werner Herzog's Founder Bio for The Nap Ministry, the full ~150-200 word sample from the client doc table]"
    ],
    "active": true
  }
]
```

CRITICAL: replace the `[VERBATIM_FROM_16-INTENT.md — ... sample from the client doc table]` placeholders with the actual sample prose from 16-INTENT.md. The intent file references "The full samples live in the source client doc" — read 16-INTENT.md to find them. If the actual sample tables are not yet inlined in 16-INTENT.md (only the descriptive summary), generate plausible ~150-word sample paragraphs that match the voice profile (Maya warm + asides + short punchy sentences; Herzog sweeping + geological-time + wry); Andrew will replace these with the canonical client samples in Studio later. Mark such generated samples with a leading `[DRAFT — Andrew replace with client sample]` token so they are easy to grep for and revise.

CRITICAL byte-equivalence: the jesse entry's voiceConstraints MUST match `JESSE_PERSONA_BLOCK` in lib/voice.py exactly after .strip() per the test_narrator_seed_sentinel.py guardian. Cross-check the string before committing.

CRITICAL cost budget: each narrator entry's exampleSamples total length should keep `assemble_voice({voiceConstraints, exampleSamples, active: True})` under 1.10 * len(VOICE_CONSTRAINTS). Verify with `uv run --project packages/pipeline pytest packages/pipeline/tests/test_narrator_cost_budget.py -q` after the seed lands.
  </action>
  <verify>
    <automated>test -f apps/studio/seeds/narrators.json; node -e "const a = require('./apps/studio/seeds/narrators.json'); if (!Array.isArray(a) || a.length !== 3) throw new Error('not 3 entries'); const slugs = a.map(e => e.slug).sort(); if (JSON.stringify(slugs) !== JSON.stringify(['jesse','maya-rudolph','werner-herzog'])) throw new Error('wrong slugs: ' + slugs); for (const e of a) { for (const k of ['slug','name','voiceConstraints','voiceRubric','exampleSamples','active']) { if (!(k in e)) throw new Error('missing ' + k + ' on ' + e.slug); } if (!Array.isArray(e.exampleSamples)) throw new Error(e.slug + '.exampleSamples not array'); if (e.exampleSamples.length < 1 || e.exampleSamples.length > 5) throw new Error(e.slug + '.exampleSamples count out of 1-5 range'); } console.log('OK');"; uv run --project packages/pipeline pytest packages/pipeline/tests/test_narrator_seed_sentinel.py -q exits 0 (cross-language sentinel passes); uv run --project packages/pipeline pytest packages/pipeline/tests/test_narrator_cost_budget.py -q exits 0 (≤10% delta verified for all 3 seeded narrators)</automated>
  </verify>
  <done>narrators.json exists with 3 entries; structure validated; jesse byte-matches JESSE_PERSONA_BLOCK; cost budget within 10% for all 3 narrators.</done>
</task>

<task type="auto">
  <name>Task 2: Create apps/studio/scripts/seed-narrators.ts + add seed:narrators npm script</name>
  <files>apps/studio/scripts/seed-narrators.ts, apps/studio/package.json</files>
  <read_first>
    - apps/studio/scripts/seed-agents.ts FULL FILE (119 lines — verbatim mirror pattern: idempotent createOrReplace with deterministic _id, env var loading, summary line printed on success)
    - apps/studio/package.json (current npm scripts — locate the seed:agents entry to mirror its shape for seed:narrators)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §B (seed pattern + _id = narrator-{slug})
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-10/D-11 (3 narrators at landing)
  </read_first>
  <action>
(A) Create apps/studio/scripts/seed-narrators.ts by mirroring apps/studio/scripts/seed-agents.ts verbatim. Replace 'agentProfile' → 'narratorProfile', 'agentId' → 'slug' for the _id construction, the JSON file path → './seeds/narrators.json' (one level up from scripts/), and the field mapping (agents have agentId/displayName/role/personality/avatar; narrators have slug/name/voiceConstraints/voiceRubric/exampleSamples/active).

The deterministic _id pattern: `narrator-${entry.slug}` (so jesse → `narrator-jesse`, etc.).

The seed mutation shape:
```typescript
const mutations = narrators.map(n => ({
  createOrReplace: {
    _id: `narrator-${n.slug}`,
    _type: 'narratorProfile',
    name: n.name,
    slug: { _type: 'slug', current: n.slug },
    voiceConstraints: n.voiceConstraints,
    voiceRubric: n.voiceRubric,
    exampleSamples: n.exampleSamples,
    active: n.active ?? true,
  },
}))
```

Use the same env-var loading (`SANITY_API_TOKEN`, `SANITY_STUDIO_PROJECT_ID`, dataset) and the same `@sanity/client` API as seed-agents.ts. Print a summary line `Seeded N narrators (N created/replaced)` at the end.

(B) Edit apps/studio/package.json — add the npm script alongside the existing seed:agents entry:
```json
    "seed:narrators": "tsx --env-file=.env.local scripts/seed-narrators.ts"
```
(Match the exact tsx invocation pattern used by seed:agents — per STATE.md Phase 1 P07 note, tsx --env-file=.env.local is the load-bearing detail for env var loading in user shell context.)
  </action>
  <verify>
    <automated>test -f apps/studio/scripts/seed-narrators.ts; grep -E "narrator-\$\{|narrator-\$" apps/studio/scripts/seed-narrators.ts returns a match (deterministic _id pattern); grep -E "_type: 'narratorProfile'" apps/studio/scripts/seed-narrators.ts returns a match; grep -E "\"seed:narrators\":" apps/studio/package.json returns a match; pnpm --filter @eisenbalm/studio exec tsc --noEmit scripts/seed-narrators.ts (typecheck succeeds — exit 0) OR pnpm --filter @eisenbalm/studio exec tsx --check scripts/seed-narrators.ts succeeds</automated>
  </verify>
  <done>seed-narrators.ts created mirroring seed-agents.ts; package.json has seed:narrators script; typecheck/lint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Extend QUERY_ISSUE_BY_SLUG with narrator->{name, slug, active} + IssueNarrator type + Issue.narrator field</name>
  <files>apps/web/lib/sanity/queries.ts, apps/web/lib/sanity/types.ts</files>
  <read_first>
    - apps/web/lib/sanity/queries.ts FULL FILE (current QUERY_ISSUE_BY_SLUG lines 21-96 — locate the charity-> block; narrator-> projection slots immediately AFTER charity->)
    - apps/web/lib/sanity/types.ts FULL FILE (the Issue type at lines 120-136 — narrator field is added; IssueNarrator type added in the shared sub-shapes section)
    - docs/API_CONTRACTS.md §1.2 (Plan 16-01 already added the narrator-> projection here — confirm and copy verbatim)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §I + Pitfall 8 (projection is name+slug+active ONLY)
  </read_first>
  <action>
Two file edits.

(A) apps/web/lib/sanity/queries.ts — extend QUERY_ISSUE_BY_SLUG. Insert this block immediately AFTER the closing `},` of the `charity-> { ... },` projection (after line 38 — the line `missionStatement,` then the closing `},`):

```groq

    narrator-> {
      name,
      "slug": slug.current,
      active,
    },
```

Do NOT add voiceConstraints / voiceRubric / exampleSamples to the projection — Pitfall 8 security gate. The narrator-chip.test.ts source-scan will fail if any of those three appear in the narrator-> block in this file.

(B) apps/web/lib/sanity/types.ts — two additions.

(B.1) In the "Shared sub-shapes" section (after CharityRef around line 39 or wherever the IssueDeliberationTurn is declared in the §1.2 group), add the IssueNarrator type:

```typescript
export type IssueNarrator = {
  name: string
  slug: string
  active: boolean
} | null
```

(B.2) In the Issue type (lines 120-136), add a `narrator: IssueNarrator` field. The position: alongside `charity: IssueCharity` (logical grouping for top-level masthead references). The current Issue type ends with `selectionDeliberation: IssueDeliberation` and a closing `} | null` — add `narrator: IssueNarrator` after charity:

```typescript
export type Issue = {
  issueNumber: number
  publishDate: string
  bonusType: BonusType
  runId: string | null
  charity: IssueCharity
  narrator: IssueNarrator    // <-- ADDED Phase 16 (NRR-08)
  theme: IssueTheme
  // ... rest unchanged ...
} | null
```
  </action>
  <verify>
    <automated>grep -E "narrator->" apps/web/lib/sanity/queries.ts returns a match; awk '/narrator->/,/\},/' apps/web/lib/sanity/queries.ts | grep -E "voiceConstraints|voiceRubric|exampleSamples" returns NO matches (Pitfall 8 leak-guard); grep -E "export type IssueNarrator" apps/web/lib/sanity/types.ts returns a match; grep -E "narrator: IssueNarrator" apps/web/lib/sanity/types.ts returns a match; pnpm --filter web exec tsc --noEmit exits 0 (no type errors); pnpm --filter web test:unit -- narrator-chip.test.ts -t "NRR-08\(d\)" exits 0 (GROQ no-leak assertions GREEN)</automated>
  </verify>
  <done>QUERY_ISSUE_BY_SLUG projects narrator->{name, slug, active}; types.ts gains IssueNarrator + Issue.narrator; TypeScript build clean; NRR-08(d) GROQ no-leak assertions GREEN.</done>
</task>

<task type="auto">
  <name>Task 4: Render narrator chip in IssueHero.tsx + wire narrator prop in issue/[slug]/page.tsx</name>
  <files>apps/web/components/issue/IssueHero.tsx, apps/web/app/issue/[slug]/page.tsx</files>
  <read_first>
    - apps/web/components/issue/IssueHero.tsx FULL FILE (current 182 lines — chip slots between byline (lines 125-128) and mission statement (lines 132-140); current IssueHeroProps at lines 43-49)
    - apps/web/app/issue/[slug]/page.tsx FULL FILE (locate the existing IssueHero usage — likely passes charity, issueNumber, publishDate, readingTimeMinutes, problemPdfUrl; add narrator as the 6th prop)
    - apps/web/__tests__/narrator-chip.test.ts (the test file that asserts: conditional render with name !== 'Jesse Eisenbalm', "Narrated by {narrator.name}" pattern, --color-text-mute + uppercase + 0.18em styling, no model-name leak)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-17/D-18/D-19 (chip copy, non-interactive, placement, styling)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §I (chip implementation + recommended placement: after byline, before mission statement)
  </read_first>
  <action>
Two file edits.

(A) apps/web/components/issue/IssueHero.tsx — two changes.

(A.1) Extend IssueHeroProps interface (current lines 43-49) to include narrator:
```typescript
import type { IssueCharity, IssueNarrator } from '@/lib/sanity/types'

// ... formatPublishDate unchanged ...

interface IssueHeroProps {
  charity: IssueCharity
  issueNumber: number
  publishDate: string
  readingTimeMinutes: number
  problemPdfUrl: string | null
  narrator: IssueNarrator
}
```

(A.2) Destructure narrator in the function signature and render the chip. Locate the byline paragraph (currently around lines 125-128, the `<p className="mb-10 font-body text-[16px] italic ... ">by Jesse A. Eisenbalm</p>` block). Insert the chip IMMEDIATELY AFTER the byline closing `</p>` and BEFORE the mission statement block. Function signature change at line 51:

```typescript
export function IssueHero({
  charity,
  issueNumber,
  publishDate,
  readingTimeMinutes,
  problemPdfUrl,
  narrator,
}: IssueHeroProps) {
```

Chip JSX (insert between byline and mission statement):

```tsx
        {/* Phase 16 (NRR-08): Narrator chip — renders iff narrator is set AND
            name !== 'Jesse Eisenbalm' (CONTEXT D-17). Default Jesse stays implicit.
            Styling: --color-text-mute + Inter uppercase 0.18em (Phase 12 MED-04
            machine-readout convention, reused per D-19). Non-interactive in this
            phase (D-18 — no /narrators/[slug] route yet). */}
        {narrator && narrator.name !== 'Jesse Eisenbalm' && (
          <p
            className="font-ui mb-10 text-[color:var(--color-text-mute)] uppercase"
            style={{
              fontSize: '11px',
              letterSpacing: '0.18em',
              fontWeight: 500,
            }}
          >
            Narrated by {narrator.name}
          </p>
        )}
```

Leave all other IssueHero rendering UNCHANGED — ghost numeral, issue eyebrow, charity h1, byline, mission statement, meta row, PDF link.

(B) apps/web/app/issue/[slug]/page.tsx — pass narrator down. Locate the IssueHero usage. Add `narrator={issue.narrator}` to the props:

```tsx
<IssueHero
  charity={issue.charity}
  issueNumber={issue.issueNumber}
  publishDate={issue.publishDate}
  readingTimeMinutes={readingTimeMinutes}
  problemPdfUrl={issue.problemPdfUrl}
  narrator={issue.narrator}
/>
```

The exact lines depend on the current file — use Read first to locate the IssueHero element.
  </action>
  <verify>
    <automated>grep -E "narrator: IssueNarrator" apps/web/components/issue/IssueHero.tsx returns a match; grep -E "narrator &&.*name !== 'Jesse Eisenbalm'" apps/web/components/issue/IssueHero.tsx returns a match (chip conditional render); grep -E "Narrated by \{narrator\??\.name\}" apps/web/components/issue/IssueHero.tsx returns a match; grep -E "0\.18em" apps/web/components/issue/IssueHero.tsx returns a match (MED-04 styling); grep -E "narrator=\{issue\.narrator\}" apps/web/app/issue/\[slug\]/page.tsx returns a match; pnpm --filter web exec tsc --noEmit exits 0; pnpm --filter web test:unit exits 0 (narrator-chip.test.ts ≥7 assertions all GREEN; 8 existing tripwires + 29 CMR sentinels all GREEN); pnpm --filter web build exits 0</automated>
  </verify>
  <done>IssueHero renders narrator chip conditionally per D-17/D-19; page.tsx wires narrator prop; narrator-chip.test.ts GREEN; full web test suite + build green.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Andrew runs `pnpm seed:narrators` against live Sanity + verifies Studio surface</name>
  <what-built>
Tasks 1-4 added the seed file, seed script, package.json entry, GROQ extension, types, IssueHero chip, and page.tsx wiring. Andrew must now seed the 3 narrators into the live Sanity dataset and verify the Studio UX: dropdown shows 3 profiles, clicking a profile shows exampleSamples (NRR-07 preview affordance).

Autonomous: false because seed against live Sanity requires SANITY_API_TOKEN write access and is the manual verification gate for NRR-09.
  </what-built>
  <how-to-verify>
1. `cd /Users/user/Desktop/Eisenbalm`
2. `pnpm seed:narrators` — confirms exit 0 + summary line `Seeded 3 narrators (3 created/replaced)`.
3. Re-run `pnpm seed:narrators` — confirms idempotent: still exit 0, no errors, still 3 documents (same _ids).
4. Open Sanity Studio → confirm "Narrator Profile" entry in sidebar; verify all 3 entries (jesse, maya-rudolph, werner-herzog) are listed.
5. Open the werner-herzog profile in Studio → confirm exampleSamples array shows the 3 prose entries.
6. Open any `weeklyIssue` draft → confirm the "Narrator" reference picker shows the 3 narrator options (NRR-07 preview affordance via reference card).
7. Set a draft issue's narrator to werner-herzog → save → confirm `narrator._ref === 'narrator-werner-herzog'` (Studio document inspector).
  </how-to-verify>
    <action>
This task is a manual checkpoint — Andrew executes the steps in <how-to-verify> below. There is no Claude-automated action for this task; the verification happens entirely in the user's environment with the user's credentials.
  </action>
  <verify>
    <automated>(checkpoint — manual: Andrew confirms each step in <how-to-verify> and types "approved" in <resume-signal>)</automated>
  </verify>
  <done>Andrew types "approved" after completing each <how-to-verify> step successfully.</done>
  <resume-signal>Type "approved" or describe issues (e.g., "seed failed with: ..." or "Studio picker missing").</resume-signal>
</task>

</tasks>

<verification>
- narrator-chip.test.ts ≥7 assertions all GREEN.
- test_narrator_seed_sentinel.py (cross-language sentinel) GREEN.
- test_narrator_cost_budget.py (≤10% delta for jesse + maya + herzog) GREEN.
- 8 existing web tripwires + 29 CMR sentinels stay GREEN.
- pnpm --filter web build exits 0.
- 3 narratorProfile documents in Sanity production dataset (Andrew UAT).
- Studio narrator picker functional on weeklyIssue drafts.
</verification>

<success_criteria>
- NRR-07: Studio picker + exampleSamples preview accessible.
- NRR-08: Frontend chip renders correctly; no GROQ leak.
- NRR-09: 3 seeded profiles + idempotent seed pattern.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-08-SUMMARY.md` documenting: the 3 seeded narrator profiles + sample provenance (verbatim vs DRAFT placeholders), the seed-narrators.ts pattern, the GROQ extension (with explicit no-leak verification), the IssueHero chip placement, and Andrew's UAT outcome.
</output>
