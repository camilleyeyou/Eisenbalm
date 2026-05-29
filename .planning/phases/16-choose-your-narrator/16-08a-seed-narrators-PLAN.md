---
phase: 16-choose-your-narrator
plan: 08a
type: execute
wave: 4
depends_on: [16-01, 16-02, 16-04]
files_modified:
  - apps/studio/seeds/narrators.json
  - apps/studio/scripts/seed-narrators.ts
  - apps/studio/package.json
autonomous: false
requirements:
  - NRR-07
  - NRR-09
must_haves:
  truths:
    - "narrators.json contains three records: jesse, maya-rudolph, werner-herzog"
    - "Each record carries the 6 canonical narratorProfile fields verbatim: name, slug, voiceConstraints, voiceRubric, exampleSamples, active"
    - "Jesse voiceConstraints == JESSE_PERSONA_BLOCK (cross-language sentinel — test_narrator_seed_sentinel.py asserts this)"
    - "Maya + Herzog voiceConstraints are plain-prose persona registers (~3-6 lines each)"
    - "Each narrator's voiceRubric is plain prose (~5-10 lines), NOT a structured object"
    - "Each narrator's exampleSamples is a list of plain strings (NOT Portable Text)"
    - "Each narrator's active field is a boolean true (NOT a status string)"
    - "seed-narrators.ts writes documents with _type:'narratorProfile' (NOT 'narrator') and the 6 canonical fields"
    - "seed-narrators.ts performs idempotent createOrReplace upserts via Sanity client"
  artifacts:
    - path: "apps/studio/seeds/narrators.json"
      provides: "static narrator seed records (D-08 + D-11)"
      contains: "jesse, maya-rudolph, werner-herzog with canonical fields"
    - path: "apps/studio/scripts/seed-narrators.ts"
      provides: "idempotent upsert script invoked via pnpm seed:narrators; writes _type:'narratorProfile'"
    - path: "apps/studio/package.json"
      provides: "seed:narrators script entry"
  key_links:
    - from: "apps/studio/scripts/seed-narrators.ts"
      to: "apps/studio/schemas/narratorProfile.ts (Plan 16-01)"
      via: "createOrReplace mutation with _type:'narratorProfile' and the 6 canonical fields"
      pattern: "_type: 'narratorProfile', name, slug, voiceConstraints, voiceRubric, exampleSamples, active"
    - from: "apps/studio/seeds/narrators.json jesse.voiceConstraints"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.JESSE_PERSONA_BLOCK"
      via: "cross-language byte-equality (test_narrator_seed_sentinel.py asserts)"
      pattern: "verbatim string equality after .strip()"
---

<objective>
Create the static narrator seed file (`narrators.json`) and the idempotent seed script (`seed-narrators.ts`), then pause for an Andrew checkpoint to confirm seeded records preview correctly in Sanity Studio with exampleSamples visible.

**Canonical schema alignment (CRITICAL):** narrators.json and seed-narrators.ts MUST write documents matching the `narratorProfile` Sanity schema defined in Plan 16-01 + CONTEXT D-08. That means:
- `_type: 'narratorProfile'` (NOT `'narrator'`)
- 6 fields exactly: `name` (NOT `displayName`), `slug`, `voiceConstraints` (the persona block), `voiceRubric` (plain text), `exampleSamples` (array of plain strings, NOT Portable Text), `active` (boolean, NOT a `status` string).

Jesse's `voiceConstraints` MUST be byte-identical to `JESSE_PERSONA_BLOCK` from `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` (Plan 16-04). The Plan 16-02 sentinel test (`test_narrator_seed_sentinel.py`) asserts `jesse_entry.voiceConstraints.strip() == JESSE_PERSONA_BLOCK.strip()`.

Maya Rudolph and Werner Herzog `voiceConstraints` are plain-prose persona registers (3-6 lines each) describing their voice; `voiceRubric` is plain-prose QA scoring guidance (5-10 lines); `exampleSamples` are 2-3 short prose passages (~100-200 words each) anchoring the QA judge. Andrew can replace these in Studio post-seed without re-running this plan.

Purpose: Per D-11, narrators are static, versioned config. Per CONTEXT canonical_refs, Andrew picks the active narrator in Studio at runtime (NRR-09). This plan establishes the three seed records and confirms they render correctly for Andrew before any frontend chip work or end-to-end UAT runs.

Output:
- `apps/studio/seeds/narrators.json` with three real records aligned to the Plan 16-01 schema.
- `apps/studio/scripts/seed-narrators.ts` idempotent upsert script writing `_type: 'narratorProfile'`.
- `apps/studio/package.json` `seed:narrators` script wired.
- Andrew has confirmed the seeded records preview correctly in Studio.

Implements: D-08 (Sanity narratorProfile field surface), D-10 (Jesse seed sentinel), D-11 (Maya/Herzog seed content), D-12 (exampleSamples count + length budget), NRR-07 (Andrew picks narrator in Studio with exampleSamples preview), NRR-09 (narrator is Studio-curated content).
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
@.planning/phases/16-choose-your-narrator/16-INTENT.md
@apps/studio/schemas/narratorProfile.ts                  # <-- CREATED BY PLAN 16-01 — SOURCE OF TRUTH for field names + _type
@packages/pipeline/src/eisenbalm_pipeline/lib/voice.py   # <-- post-16-04: JESSE_PERSONA_BLOCK is the cross-language anchor
@packages/pipeline/tests/test_narrator_seed_sentinel.py  # <-- Plan 16-02 Task 1: contract this plan honors

<decisions_implemented>
- **D-01**: Three narrators: Jesse (default, active), Maya Rudolph (active), Werner Herzog (active).
- **D-08**: Sanity narratorProfile schema fields are `name`, `slug`, `voiceConstraints` (text), `voiceRubric` (text — plain string), `exampleSamples` (array of `text` — plain strings), `active` (boolean). These are the canonical field names; this seed plan MUST write them verbatim.
- **D-10**: Jesse `voiceConstraints` field == `JESSE_PERSONA_BLOCK` content (Python string copied verbatim into the seed). Sentinel test in 16-02 enforces this byte-equally.
- **D-11**: Narrators are static seed records. Authored in `narrators.json` under version control, upserted by `seed-narrators.ts`.
- **D-12**: 3 exampleSamples × ~150 words each as the seed default; budget envelope ≤10% cost delta vs Jesse default (Plan 16-02 Task 3 cost-budget test).
- **NRR-07**: Andrew can pick a narrator in Studio with exampleSamples preview rendering — confirmed in this plan's checkpoint task.
- **NRR-09**: Narrator is Studio-curated content. The seed script establishes initial state; future edits happen in Studio.
- **Andrew replacement allowed**: Maya/Herzog sample prose in narrators.json is realistic DRAFT content sized to fit the cost-budget guard (Plan 16-02 Task 3). Andrew may rewrite these in Studio after the checkpoint without invalidating downstream tests, so long as each rewritten sample stays under ~1200 tokens (the cost-budget ceiling).
</decisions_implemented>

<note_on_source_of_truth>
The Phase 16 INTENT document (`16-INTENT.md`) explicitly marks "Real sample content (verbatim Maya/Herzog samples from Andrew)" as TBD. Rather than commit placeholder tokens (which would let the cost-budget test pass vacuously on tiny strings while real Andrew prose blows past the budget in production), this plan ships REALISTIC DRAFT prose at the actual budget envelope. The Andrew UAT checkpoint task (Task 3) gates promotion: Andrew either accepts the drafts as-is or rewrites them in Studio before this plan is marked complete.

**Field-name fidelity:** The previous revision of this plan ("checker iteration 1") drifted from the Sanity schema in two ways: it wrote `_type: 'narrator'` (the Sanity schema is `'narratorProfile'`); and it used `displayName` + `status` + a structured `voiceRubric` object — none of which match Plan 16-01 + CONTEXT D-08. Sanity would have rejected the documents; the seed-sentinel test would have failed by definition. This revision re-aligns every field name to the canonical schema.
</note_on_source_of_truth>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Author narrators.json with three real records using the canonical narratorProfile schema fields</name>
  <files>apps/studio/seeds/narrators.json</files>

  <read_first>
    1. READ `apps/studio/schemas/narratorProfile.ts` (created by Plan 16-01 in Wave 0). This file is the SOURCE OF TRUTH for field names. The 6 `defineField` names — `name`, `slug`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active` — are what `narrators.json` MUST use verbatim. The Sanity document _type is `'narratorProfile'`.
    2. READ `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` post-16-04. Locate `JESSE_PERSONA_BLOCK` — its exact string content is what `narrators[jesse].voiceConstraints` MUST equal (after `.strip()`).
    3. READ `packages/pipeline/tests/test_narrator_seed_sentinel.py` (Plan 16-02 Task 1). The test reads `narrators.json`, finds the entry where `slug == "jesse"`, and asserts `jesse_entry.get("voiceConstraints").strip() == JESSE_PERSONA_BLOCK.strip()`. This is the cross-language contract this task honors.
    4. READ `.planning/phases/16-choose-your-narrator/16-CONTEXT.md`:
       - D-08 for the canonical 6 fields + types.
       - D-11 for Maya Rudolph + Werner Herzog register descriptions.
       - D-12 for exampleSamples count + length budget (~150 words × 3 samples).
    5. READ `.planning/phases/16-choose-your-narrator/16-INTENT.md`. Note the "Real sample content … TBD" line. This task ships DRAFT content for Maya/Herzog and ANCHORED content for Jesse, as documented in `<note_on_source_of_truth>` above.
  </read_first>

  <action>
    Create `apps/studio/seeds/narrators.json` with this content. The string value for `jesse.voiceConstraints` MUST be the EXACT content of `JESSE_PERSONA_BLOCK` from `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` (post-Plan 16-04) — copy it verbatim from that file's Python string literal. Do NOT paraphrase or reformat.

    Template (replace `<JESSE_PERSONA_BLOCK_VERBATIM>` with the actual JESSE_PERSONA_BLOCK string content from voice.py):

    ```json
    {
      "$schema": "../schemas/narratorProfile.schema.json",
      "narrators": [
        {
          "slug": "jesse",
          "name": "Jesse A. Eisenbalm",
          "active": true,
          "voiceConstraints": "<JESSE_PERSONA_BLOCK_VERBATIM — copy the exact string from packages/pipeline/src/eisenbalm_pipeline/lib/voice.py JESSE_PERSONA_BLOCK constant; this is the cross-language sentinel anchor (D-10) and test_narrator_seed_sentinel.py compares this field byte-for-byte against the Python constant after .strip()>",
          "voiceRubric": "QA scoring rubric for Jesse voice. Score sections against these axes:\n- Dryness: sentences land facts without commentary; no winking, no irony signaling.\n- Gravity: the subject is treated with Fortune-500 seriousness regardless of obscurity.\n- Precision: dates, dollar figures, named programmes appear in place of vague gestures.\n- Sentiment ban: zero use of the forbidden sentimentality word list (heartwarming, inspiring, etc.) and zero passive hedging.\n- Cadence: short declarative sentences as the default; one well-placed comma per sentence; no exclamation marks anywhere.\nReturn warning-severity findings for any drift toward warmth, irony, or vagueness.",
          "exampleSamples": [
            "The Nap Ministry was founded in 2016 by Tricia Hersey, who at the time was a Master of Divinity student at Emory University in Atlanta. The organisation's stated thesis is straightforward: rest is a form of resistance. Hersey treats this as a doctrinal position, not a wellness trend. The Ministry operates collective rest experiences, gallery installations, and a publishing programme. It has declined multiple corporate partnerships.",
            "In 2022, the Ministry published Rest Is Resistance: A Manifesto through Little, Brown Spark. The book entered the New York Times bestseller list in its first week. It did not appear on any business or self-help list. Hersey was specific on this point in subsequent interviews."
          ]
        },
        {
          "slug": "maya-rudolph",
          "name": "Maya Rudolph",
          "active": true,
          "voiceConstraints": "Speak with warmth, enthusiasm, and a precise asides-driven register. Affection for the subject sits underneath every sentence but is never broadcast directly. Pause slightly before the specific detail — the rhythm matters as much as the fact. Conversational cadence with one well-placed comma per sentence. Occasional one-word sentences for emphasis. Punchy short sentences are the default; the gravity of the subject is conveyed through specificity, not volume. No exclamation marks anywhere — the warmth is in the syntax, not the punctuation.",
          "voiceRubric": "QA scoring rubric for Maya Rudolph voice. Score sections against these axes:\n- Warmth without sentiment: affection is implied through specificity, never stated.\n- Aside cadence: at least one well-placed parenthetical or comma-led aside per paragraph.\n- Precision: dates, dollar figures, named programmes — never paraphrased away.\n- No celebrity-impersonation tells (no SNL callbacks, no '80s/'90s sitcom references, no on-the-nose warmth).\n- Punctuation: zero exclamation marks; warmth lives in the syntax.\nReturn warning-severity findings for any drift toward overt warmth-broadcasting or generic affection.",
          "exampleSamples": [
            "Tricia Hersey started The Nap Ministry in 2016, while she was getting a Master of Divinity at Emory. The pitch was, well, exactly what it sounds like. Rest is resistance. She has not budged on that since. The Ministry runs collective rest events, gallery installations, a publishing arm. It has turned down corporate money more than once, which is the part that interests me.",
            "Her 2022 book, Rest Is Resistance: A Manifesto, hit the New York Times bestseller list its first week out. Not the business list. Not the self-help list. The actual list. She has been precise about that distinction in every interview since, which, frankly, is the move."
          ]
        },
        {
          "slug": "werner-herzog",
          "name": "Werner Herzog",
          "active": true,
          "voiceConstraints": "Speak with sweeping philosophical gravity. Every mundane fact is treated as ontologically significant — a small confrontation with the human condition. Reach for geological-time metaphors, the indifference of the cosmos, wry comparisons that take the long view. Long, weighted sentences with frequent appositives. Occasional one-word fragment to puncture the gravity. The sincerity beneath the sweep is total — this is not parody. Comma-spliced clauses are permitted when the thought requires it. No exclamation marks: gravity does not require them.",
          "voiceRubric": "QA scoring rubric for Werner Herzog voice. Score sections against these axes:\n- Gravity: every sentence treats the subject with cosmic-scale seriousness.\n- Geological-time framing: at least one passage in the section uses long-time-horizon language (decades, centuries, the human condition).\n- Sincerity: zero parody, zero quoted Herzog catchphrases ('the obscenity of the jungle', etc.), zero knowing winks.\n- Specificity: dates, dollar figures, named programmes — treated as small philosophical confrontations.\n- Cadence: long weighted sentences with appositives; occasional one-word fragment; zero exclamation marks.\nReturn warning-severity findings for any drift toward Herzog self-parody or shortened glib sentences.",
          "exampleSamples": [
            "It was 2016, in Atlanta, that Tricia Hersey, then a student of divinity at Emory University, established what she would call The Nap Ministry. The premise was, on its surface, simple. Rest, she proposed, was a form of resistance. One must understand that she meant this not as a metaphor, not as an aphorism for a marketing department, but as a doctrinal position — one she has maintained, without compromise, for almost a decade. The Ministry has refused corporate partnerships. It has done so repeatedly.",
            "In the year 2022, her book, titled Rest Is Resistance: A Manifesto, was published by Little, Brown Spark. It entered the bestseller list of the New York Times in its first week. Not, I should say, the business list. Not the self-help list. The general list. She has been, in every subsequent interview, exact about this distinction. This exactness is, in itself, a kind of statement."
          ]
        }
      ]
    }
    ```

    Notes for the executor:
    - The JESSE_PERSONA_BLOCK substitution is non-negotiable. If you cannot find `JESSE_PERSONA_BLOCK` in `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py`, STOP and surface the blocker — Plan 16-04 must land first (Wave dependency: this plan declares `depends_on: [16-04]`).
    - The field name `name` is correct (NOT `displayName`).
    - The field `active` is a boolean `true`/`false` (NOT a string `"active"`/`"inactive"`).
    - The field `voiceRubric` is a plain string (NOT a structured `{register, cadence, constraints}` object — that was a wrong-schema artifact of the prior revision).
    - The field `exampleSamples` is a list of plain strings (NOT Portable Text blocks — D-12).
    - These are realistic DRAFTS sized to approximate the cost-budget ceiling (each sample is ~80-150 words; the cost-budget test in Plan 16-02 Task 3 enforces a ≤10% delta vs VOICE_CONSTRAINTS length).
    - Do NOT shorten the samples to "pass" the cost-budget test more easily. The whole point is to fail loudly if Andrew's eventual replacements exceed the envelope.
    - Do NOT add placeholder tokens like `[VERBATIM_FROM…]`, `TODO`, `PLACEHOLDER`, or `DRAFT — Andrew`. The grep guard in `<verify>` rejects these.
  </action>

  <verify>
    <automated>
      # 1. File exists and is valid JSON.
      python -c "import json; json.load(open('apps/studio/seeds/narrators.json'))"

      # 2. Three narrators present with expected slugs.
      python -c "import json; d = json.load(open('apps/studio/seeds/narrators.json')); slugs = sorted(n['slug'] for n in d['narrators']); assert slugs == ['jesse', 'maya-rudolph', 'werner-herzog'], slugs"

      # 3. No placeholder tokens (B5 guard).
      ! grep -E "VERBATIM_FROM|JESSE_PERSONA_BLOCK_VERBATIM|DRAFT[ —-]+Andrew|TODO|PLACEHOLDER|XXX" apps/studio/seeds/narrators.json

      # 4. Each narrator has at least one exampleSample, and each sample is at least 200 characters (no trivial placeholders).
      python -c "import json; d=json.load(open('apps/studio/seeds/narrators.json')); 
      assert all(len(n.get('exampleSamples',[])) >= 1 for n in d['narrators']);
      assert all(all(len(s) >= 200 for s in n['exampleSamples']) for n in d['narrators']), 'sample too short'"

      # 5. Each record has the 6 canonical narratorProfile fields with correct types.
      python -c "import json; d=json.load(open('apps/studio/seeds/narrators.json'));
      for n in d['narrators']:
          assert isinstance(n.get('name'), str) and n['name'], f'{n[\"slug\"]}: name missing/empty'
          assert isinstance(n.get('slug'), str) and n['slug'], f'{n[\"slug\"]}: slug missing'
          assert isinstance(n.get('voiceConstraints'), str) and n['voiceConstraints'], f'{n[\"slug\"]}: voiceConstraints missing/empty'
          assert isinstance(n.get('voiceRubric'), str) and n['voiceRubric'], f'{n[\"slug\"]}: voiceRubric missing/empty — MUST be plain str, not a structured object'
          assert isinstance(n.get('exampleSamples'), list) and len(n['exampleSamples']) >= 1, f'{n[\"slug\"]}: exampleSamples missing'
          assert all(isinstance(s, str) for s in n['exampleSamples']), f'{n[\"slug\"]}: exampleSamples must be list of plain strings (NOT Portable Text)'
          assert isinstance(n.get('active'), bool), f'{n[\"slug\"]}: active must be a bool (NOT a status string)'"

      # 6. No wrong-schema field names (the previous revision used these — must be absent now).
      ! grep -E '"displayName"' apps/studio/seeds/narrators.json
      ! grep -E '"status"\s*:\s*"(active|inactive)"' apps/studio/seeds/narrators.json

      # 7. CROSS-LANGUAGE SENTINEL (D-10 / NRR-09): Jesse's voiceConstraints byte-equals JESSE_PERSONA_BLOCK (the test_narrator_seed_sentinel.py contract).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_narrator_seed_sentinel.py -v

      # 8. Cost-budget test passes for all 3 seeded narrators (NRR-10 criterion 7).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_narrator_cost_budget.py -v
    </automated>
  </verify>

  <done>
    - `narrators.json` exists, parses as JSON, has 3 records.
    - All 6 canonical fields present in every record: `name` (str), `slug` (str), `voiceConstraints` (str), `voiceRubric` (str — plain prose, NOT structured), `exampleSamples` (list[str] — plain strings, NOT Portable Text), `active` (bool).
    - No `displayName`, no `status: "active"|"inactive"` string, no structured rubric object.
    - No placeholder tokens.
    - Jesse `voiceConstraints` byte-equals `JESSE_PERSONA_BLOCK` (sentinel test green).
    - Cost-budget test green for all 3 narrators.
    - All exampleSamples are non-trivial (≥200 chars).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create idempotent seed-narrators.ts script writing _type:'narratorProfile' with canonical fields + wire pnpm seed:narrators</name>
  <files>
    apps/studio/scripts/seed-narrators.ts
    apps/studio/package.json
  </files>

  <read_first>
    1. READ `apps/studio/schemas/narratorProfile.ts` (created by Plan 16-01 in Wave 0). The Sanity document _type is `'narratorProfile'` — the seed script MUST write that exact `_type` or Sanity will reject the documents. The 6 `defineField` names (`name`, `slug`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`) are the canonical field surface this script writes.
    2. READ `apps/studio/package.json` to note existing scripts (e.g., `dev`, `build`, `deploy`). Find the right block to add `"seed:narrators"`.
    3. READ any existing seed scripts in `apps/studio/scripts/` (if present) for the established pattern. Reuse the client init / env loading pattern.
    4. READ the (just-written) `apps/studio/seeds/narrators.json` to confirm the field-name + type surface this script transforms into a Sanity document.
  </read_first>

  <action>
    1. Create `apps/studio/scripts/seed-narrators.ts`:
       ```typescript
       /**
        * Phase 16 — idempotent narrator seed (Plan 16-08a).
        *
        * Reads apps/studio/seeds/narrators.json and upserts each record via
        * Sanity client.createOrReplace with a deterministic _id: `narrator-${slug}`
        * (matches the Phase 1 agentProfile naming convention).
        *
        * The Sanity document _type is `'narratorProfile'` — matching the schema
        * defined in apps/studio/schemas/narratorProfile.ts (Plan 16-01). Writing
        * any other _type causes Sanity to reject the document silently or attach
        * it to a stray type.
        *
        * The 6 fields written are exactly the schema's defineField names:
        *   name, slug, voiceConstraints, voiceRubric, exampleSamples, active.
        *
        * Usage:
        *   pnpm --filter studio seed:narrators
        *
        * Requires SANITY_STUDIO_API_TOKEN or SANITY_API_TOKEN with write access
        * to the configured dataset. Loads from .env.local automatically.
        */
       import { createClient } from '@sanity/client';
       import * as fs from 'node:fs';
       import * as path from 'node:path';

       const projectId =
         process.env.SANITY_STUDIO_PROJECT_ID || process.env.SANITY_PROJECT_ID;
       const dataset =
         process.env.SANITY_STUDIO_DATASET || process.env.SANITY_DATASET || 'production';
       const token =
         process.env.SANITY_STUDIO_API_TOKEN || process.env.SANITY_API_TOKEN;

       if (!projectId) throw new Error('SANITY_STUDIO_PROJECT_ID not set');
       if (!token) throw new Error('SANITY_STUDIO_API_TOKEN not set (need write access)');

       const client = createClient({
         projectId,
         dataset,
         token,
         apiVersion: '2024-01-01',
         useCdn: false,
       });

       /**
        * Canonical narratorProfile field surface (Plan 16-01 + CONTEXT D-08).
        * Do NOT add displayName, status, or a structured voiceRubric object —
        * those were wrong-schema artifacts of an earlier revision.
        */
       interface NarratorSeed {
         slug: string;
         name: string;
         active: boolean;
         voiceConstraints: string;
         voiceRubric: string;
         exampleSamples: string[];
       }

       interface SeedFile {
         narrators: NarratorSeed[];
       }

       async function main() {
         const seedPath = path.resolve(__dirname, '..', 'seeds', 'narrators.json');
         const raw = fs.readFileSync(seedPath, 'utf-8');
         const data: SeedFile = JSON.parse(raw);

         console.log(`Seeding ${data.narrators.length} narrators into ${dataset}...`);
         for (const n of data.narrators) {
           const _id = `narrator-${n.slug}`;
           await client.createOrReplace({
             _id,
             _type: 'narratorProfile',
             name: n.name,
             slug: { _type: 'slug', current: n.slug },
             voiceConstraints: n.voiceConstraints,
             voiceRubric: n.voiceRubric,
             exampleSamples: n.exampleSamples,
             active: n.active,
           });
           console.log(`  upserted ${_id} (${n.name})`);
         }
         console.log('Done.');
       }

       main().catch((err) => {
         console.error(err);
         process.exit(1);
       });
       ```

    2. Edit `apps/studio/package.json` — add to the `scripts` block:
       ```json
       "seed:narrators": "tsx scripts/seed-narrators.ts"
       ```
       (Use `ts-node` if that is already the established pattern in this repo; pick whichever the existing dev/build scripts use. Do not introduce a new toolchain.)

    3. If `tsx` (or `ts-node`) is not already a devDependency, add it. Do NOT introduce other new deps.

    4. Document the env vars required at the top of `seed-narrators.ts` (already included above).
  </action>

  <verify>
    <automated>
      # 1. Script file exists and TypeScript parses.
      [ -f apps/studio/scripts/seed-narrators.ts ]
      cd apps/studio && pnpm tsc --noEmit scripts/seed-narrators.ts

      # 2. package.json has the seed:narrators script entry.
      python -c "import json; p=json.load(open('apps/studio/package.json')); assert 'seed:narrators' in p.get('scripts', {}), p.get('scripts')"

      # 3. Sanity document _type is 'narratorProfile' (NOT 'narrator').
      grep -c "_type: 'narratorProfile'" apps/studio/scripts/seed-narrators.ts | grep -q -E '^[1-9]'
      # And the wrong _type 'narrator' (without 'Profile') must NOT appear as a document _type.
      ! grep -E "_type:\s*'narrator'[^P]" apps/studio/scripts/seed-narrators.ts

      # 4. No legacy field names in the script body.
      ! grep -E "displayName" apps/studio/scripts/seed-narrators.ts
      # `status:` may appear in JSDoc/comments but NOT as a written document property.
      ! grep -E "^\s+status:\s*n\.status" apps/studio/scripts/seed-narrators.ts

      # 5. The script writes all 6 canonical narratorProfile fields.
      for field in name voiceConstraints voiceRubric exampleSamples active; do
        grep -q "${field}:" apps/studio/scripts/seed-narrators.ts || (echo "MISSING field $field in seed-narrators.ts" && exit 1)
      done

      # 6. Idempotency: running the script twice (in a dry-run mode if available) does not duplicate documents.
      # NOTE: For a real Sanity dataset, determinism is enforced by `_id: narrator-${slug}` + createOrReplace.
      # This check is implicit — no automated test, but createOrReplace is idempotent by Sanity's contract.

      # 7. Lint passes.
      cd apps/studio && pnpm lint scripts/seed-narrators.ts 2>/dev/null || true
    </automated>
  </verify>

  <done>
    - `scripts/seed-narrators.ts` exists and type-checks.
    - `package.json` exposes `seed:narrators`.
    - Script writes `_type: 'narratorProfile'` (NOT `'narrator'`).
    - Script writes the 6 canonical fields: `name`, `slug` (as `{_type:'slug', current: ...}`), `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`.
    - No `displayName`, no `status: n.status`, no structured voiceRubric writes.
    - Script uses deterministic `_id` (`narrator-${slug}`) for idempotent upserts.
    - Required env vars documented.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Andrew Studio UAT — confirm seeded narrators render with exampleSamples preview (NRR-07)</name>
  <files>(manual UAT — no Claude-side files modified)</files>

  <what-built>
    Three narrator documents (Jesse, Maya Rudolph, Werner Herzog) have been seeded into the active Sanity dataset via `pnpm --filter studio seed:narrators`. Each record carries the 6 canonical narratorProfile fields (`name`, `slug`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`).

    Sanity Studio's existing weeklyIssue editor (Phase 1+) should now expose a narrator reference field (per Plan 16-01 schema additions). When Andrew picks a narrator in that picker, the Studio should render a preview of the selected narrator (Plan 16-01 Task 2's `preview.prepare` shows `name` as title + truncated `voiceConstraints` as subtitle).
  </what-built>

  <how-to-verify>
    1. Run the seed script against the dev / preview dataset:
       ```bash
       pnpm --filter studio seed:narrators
       ```
       Expect three log lines, one per narrator. Expect no errors. (If you see "Schema validation failed" with the message "Document _type 'narrator' is unknown" — STOP, the schema/script have drifted again; check that `_type: 'narratorProfile'` is the value written, matching `apps/studio/schemas/narratorProfile.ts`.)

    2. Open Sanity Studio (`pnpm --filter studio dev`) and navigate to the Narrator Profile list.
       - Expect to see three documents: Jesse A. Eisenbalm, Maya Rudolph, Werner Herzog.
       - Each document opens with all 6 fields populated (name, slug, voiceConstraints, voiceRubric, exampleSamples, active=true).
       - exampleSamples render as readable prose, not as JSON-string blobs or Portable Text blocks.

    3. Open the current draft weeklyIssue document (or create a test draft) and locate the `narrator` reference field added by Plan 16-01.
       - Expect a dropdown / reference picker listing the three narratorProfile documents.
       - Selecting Maya Rudolph should show a Studio preview of her voiceConstraints (truncated) + access to her full exampleSamples.
       - Selecting Werner Herzog should show his preview.
       - Selecting Jesse should show his preview.

    4. Confirm exampleSamples for Maya and Herzog read as plausible voice samples. Andrew may rewrite either or both samples in Studio at this point — the seed is the floor, not the ceiling. If Andrew rewrites, note the substitution in the resume signal.

    5. Confirm the rendered exampleSamples DO NOT contain any placeholder tokens (e.g., "[VERBATIM_FROM…]", "JESSE_PERSONA_BLOCK_VERBATIM"). If they do, the seed script ran against stale narrators.json and must be re-run.
  </how-to-verify>

  <resume-signal>
    Type "approved" once the three narrators are visible in Studio with rendered exampleSamples, OR describe any issue. If Andrew rewrites Maya/Herzog samples in Studio during this checkpoint, note "rewrote {slug}" in the resume signal so the SUMMARY captures it.
  </resume-signal>

  <action>
    This task is a manual checkpoint. Andrew executes the steps in `<how-to-verify>` above. There is no Claude-automated action; verification happens entirely in the user's environment with the user's Sanity credentials.
  </action>

  <verify>
    <automated>(checkpoint — manual: Andrew confirms each step in &lt;how-to-verify&gt; and types "approved" in &lt;resume-signal&gt;)</automated>
  </verify>

  <done>
    Andrew types "approved" after the three narratorProfile documents are visible in Studio with rendered exampleSamples. If Andrew rewrites Maya/Herzog samples in Studio during this checkpoint, the rewrite is noted in the SUMMARY.
  </done>
</task>

</tasks>

<verification>
- `narrators.json` validates and uses the 6 canonical fields (Task 1 verify).
- `seed-narrators.ts` writes `_type:'narratorProfile'` with the 6 canonical fields and type-checks (Task 2 verify).
- `test_narrator_seed_sentinel.py` (Plan 16-02) passes — Jesse `voiceConstraints` byte-equals `JESSE_PERSONA_BLOCK`.
- `test_narrator_cost_budget.py` (Plan 16-02) passes — all 3 narrators fit the ≤10% budget.
- Andrew confirms Studio renders all three narratorProfile documents with previewable exampleSamples (Task 3).
- `grep -E "VERBATIM_FROM|TODO|PLACEHOLDER|JESSE_PERSONA_BLOCK_VERBATIM" apps/studio/seeds/narrators.json` returns 0 matches.
- `grep -E "displayName" apps/studio/seeds/narrators.json` returns 0 matches.
- `grep -E "displayName" apps/studio/scripts/seed-narrators.ts` returns 0 matches.
- `grep -E '"status"\s*:\s*"(active|inactive)"' apps/studio/seeds/narrators.json` returns 0 matches.
</verification>

<success_criteria>
- D-08 satisfied: every Sanity narratorProfile field is present in narrators.json and the seed script with the canonical name + type.
- D-10 satisfied: cross-language Jesse sentinel green.
- D-11 satisfied: narrators are versioned static seed records (3 entries).
- D-12 satisfied: each narrator's exampleSamples fit the cost-budget ceiling.
- NRR-07 satisfied (verified by Andrew): narrator picker + exampleSamples preview works in Studio.
- NRR-09 satisfied: any future narrator additions or sample rewrites happen via Studio (or via re-running the seed script against an updated `narrators.json`).
- Plan 16-09 cost-budget verification can run against real prose (not placeholders).
- Zero schema drift between Plan 16-01 (Sanity narratorProfile schema), Plan 16-05 (Python Narrator TypedDict), Plan 16-02 test fixtures, and Plan 16-08a seed file.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-08a-seed-narrators-SUMMARY.md`. Record:
- Confirmation that all three narratorProfile documents were seeded with `_type: 'narratorProfile'` and the 6 canonical fields.
- Whether Andrew rewrote Maya or Herzog samples in Studio during Task 3.
- Confirmation that the Jesse cross-language sentinel test passed.
- Cross-reference to 16-08b (frontend chip plan that consumes the `name` (NOT `displayName`) from these records).
- Cross-reference to 16-09 (verification + UAT that exercises the full chain).
</output>
</content>
</invoke>