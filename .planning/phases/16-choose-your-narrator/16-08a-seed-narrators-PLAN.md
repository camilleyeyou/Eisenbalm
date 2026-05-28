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
    - "Each record has slug, displayName, status, voiceRubric, exampleSamples"
    - "Jesse exampleSamples ground the QA rubric in real Jesse prose (no placeholder tokens)"
    - "Maya + Herzog exampleSamples are draft prose Andrew can replace with verbatim copy in the Studio UAT step"
    - "seed-narrators.ts performs idempotent createOrReplace upserts via Sanity client"
  artifacts:
    - path: "apps/studio/seeds/narrators.json"
      provides: "static narrator seed records (D-11)"
      contains: "jesse, maya-rudolph, werner-herzog"
    - path: "apps/studio/scripts/seed-narrators.ts"
      provides: "idempotent upsert script invoked via pnpm seed:narrators"
    - path: "apps/studio/package.json"
      provides: "seed:narrators script entry"
  key_links:
    - from: "apps/studio/scripts/seed-narrators.ts"
      to: "Sanity narrator schema (Plan 16-01)"
      via: "createOrReplace mutation with deterministic _id"
      pattern: "client.createOrReplace({_id: `narrator.${slug}`, _type: 'narrator', ...})"
---

<objective>
Create the static narrator seed file (`narrators.json`) and the idempotent seed script (`seed-narrators.ts`), then pause for an Andrew checkpoint to confirm seeded records preview correctly in Sanity Studio with exampleSamples visible. Sample text for Jesse is anchored to real Phase 5+ chronicler prose. Sample text for Maya Rudolph and Werner Herzog is realistic draft prose written at the budget envelope the cost-budget test enforces (Plan 16-02 Task 3 `test_narrator_cost_budget`) — Andrew can replace the Maya/Herzog samples post-seed via Studio without re-running this plan.

Purpose: Per D-11, narrators are static, versioned config. Per CONTEXT canonical_refs, Andrew picks the active narrator in Studio at runtime (NRR-09). This plan establishes the three seed records and confirms they render correctly for Andrew before any frontend chip work or end-to-end UAT runs.

Output:
- `apps/studio/seeds/narrators.json` with three real records (no placeholders).
- `apps/studio/scripts/seed-narrators.ts` idempotent upsert script.
- `apps/studio/package.json` `seed:narrators` script wired.
- Andrew has confirmed the seeded records preview correctly in Studio.

Implements: D-11 (static seed), NRR-07 (Andrew picks narrator in Studio with exampleSamples preview), NRR-09 (narrator is Studio-curated content).
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
@apps/studio/schemas/narrator.ts                 # <-- created by Plan 16-01
@packages/pipeline/src/eisenbalm_pipeline/lib/voice.py  # <-- post-16-04 (JESSE_PERSONA_BLOCK exists)

<decisions_implemented>
- **D-01**: Three narrators: Jesse (default, active), Maya Rudolph (active), Werner Herzog (active).
- **D-11**: Narrators are static seed records. Authored in `narrators.json` under version control, upserted by `seed-narrators.ts`.
- **D-09**: Each narrator has 2-3 exampleSamples (sample paragraphs). Andrew curates them.
- **NRR-07**: Andrew can pick a narrator in Studio with exampleSamples preview rendering — confirmed in this plan's checkpoint task.
- **NRR-09**: Narrator is Studio-curated content. The seed script establishes initial state; future edits happen in Studio.
- **Andrew replacement allowed**: Maya/Herzog sample prose in narrators.json is realistic DRAFT content sized to fit the cost-budget guard (Plan 16-02 Task 3). Andrew may rewrite these in Studio after the checkpoint without invalidating downstream tests, so long as each rewritten sample stays under ~1200 tokens (the cost-budget ceiling).
</decisions_implemented>

<note_on_source_of_truth>
The Phase 16 INTENT document (`16-INTENT.md`) explicitly marks "Real sample content (verbatim Maya/Herzog samples from Andrew)" as TBD. Rather than commit placeholder tokens (which would let the cost-budget test pass vacuously on tiny strings while real Andrew prose blows past the budget in production), this plan ships REALISTIC DRAFT prose at the actual budget envelope. The Andrew UAT checkpoint task (Task 3) gates promotion: Andrew either accepts the drafts as-is or rewrites them in Studio before this plan is marked complete.
</note_on_source_of_truth>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Author narrators.json with three real records (no placeholders)</name>
  <files>apps/studio/seeds/narrators.json</files>

  <read_first>
    1. READ `apps/studio/schemas/narrator.ts` (created by Plan 16-01) to confirm field names and types.
    2. READ `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` post-16-04. The Jesse `register` field will quote from `JESSE_PERSONA_BLOCK + UNIVERSAL_CORE` — keep wording aligned.
    3. READ `.planning/phases/16-choose-your-narrator/16-INTENT.md`. Note the "Real sample content … TBD" line. This task ships DRAFT content for Maya/Herzog and ANCHORED content for Jesse, as documented in `<note_on_source_of_truth>` above.
  </read_first>

  <action>
    Create `apps/studio/seeds/narrators.json` with EXACTLY this content (no placeholder tokens, no TODO markers):

    ```json
    {
      "$schema": "../schemas/narrator.schema.json",
      "narrators": [
        {
          "slug": "jesse",
          "displayName": "Jesse A. Eisenbalm",
          "status": "active",
          "voiceRubric": {
            "register": "Dry, precise, and absurdly serious. Treats every subject as if it deserves a Fortune 500 case study. Never winks. Never signals irony. Avoids sentimentality.",
            "cadence": "Short, declarative sentences when possible. Occasional longer sentence for a single specific fact (date, dollar figure, named programme).",
            "constraints": [
              "No jokes that depend on the reader noticing this is funny.",
              "No mockery of charities, founders, or their missions.",
              "No comparisons to consumer brands as punchlines.",
              "No fourth-wall breaks.",
              "No editorialising about the absurdity of the project.",
              "Lean into specifics: dates, dollar figures, geography, named programmes."
            ]
          },
          "exampleSamples": [
            "The Nap Ministry was founded in 2016 by Tricia Hersey, who at the time was a Master of Divinity student at Emory University in Atlanta. The organisation's stated thesis is straightforward: rest is a form of resistance. Hersey treats this as a doctrinal position, not a wellness trend. The Ministry operates collective rest experiences, gallery installations, and a publishing programme. It has declined multiple corporate partnerships.",
            "In 2022, the Ministry published Rest Is Resistance: A Manifesto through Little, Brown Spark. The book entered the New York Times bestseller list in its first week. It did not appear on any business or self-help list. Hersey was specific on this point in subsequent interviews."
          ]
        },
        {
          "slug": "maya-rudolph",
          "displayName": "Maya Rudolph",
          "status": "active",
          "voiceRubric": {
            "register": "Sly, dry, warm but precise. A slight knowing pause before the specific. Affection for the subject sits underneath the dryness — never sentimental, never broadcasted.",
            "cadence": "Conversational rhythm with one well-placed comma per sentence. Occasional one-word sentences for emphasis. Never overlong.",
            "constraints": [
              "No 1980s sitcom callbacks.",
              "No ironic asides.",
              "No celebrity-impersonation tells.",
              "No on-the-nose warmth — affection is implied through specificity, never stated.",
              "No fourth-wall breaks.",
              "Lean into specifics: dates, dollar figures, named programmes."
            ]
          },
          "exampleSamples": [
            "Tricia Hersey started The Nap Ministry in 2016, while she was getting a Master of Divinity at Emory. The pitch was, well, exactly what it sounds like. Rest is resistance. She has not budged on that since. The Ministry runs collective rest events, gallery installations, a publishing arm. It has turned down corporate money more than once, which is the part that interests me.",
            "Her 2022 book, Rest Is Resistance: A Manifesto, hit the New York Times bestseller list its first week out. Not the business list. Not the self-help list. The actual list. She has been precise about that distinction in every interview since, which, frankly, is the move."
          ]
        },
        {
          "slug": "werner-herzog",
          "displayName": "Werner Herzog",
          "status": "active",
          "voiceRubric": {
            "register": "Grave, deliberate, philosophical. Treats the mundane as ontologically significant. Every sentence carries the weight of a man who has seen the jungle and understood it.",
            "cadence": "Long, weighted sentences. Frequent appositives. Occasional one-word fragment to puncture the gravity. Comma-spliced clauses are permitted when the thought requires it.",
            "constraints": [
              "No self-parody.",
              "No references to chickens, jungles, or grizzly bears unless contextually justified.",
              "No quoted Herzog catchphrases ('the obscenity of the jungle', etc.).",
              "No knowing winks to the reader.",
              "No fourth-wall breaks.",
              "Lean into specifics: dates, dollar figures, named programmes — but treat each one as a small philosophical confrontation."
            ]
          },
          "exampleSamples": [
            "It was 2016, in Atlanta, that Tricia Hersey, then a student of divinity at Emory University, established what she would call The Nap Ministry. The premise was, on its surface, simple. Rest, she proposed, was a form of resistance. One must understand that she meant this not as a metaphor, not as an aphorism for a marketing department, but as a doctrinal position — one she has maintained, without compromise, for almost a decade. The Ministry has refused corporate partnerships. It has done so repeatedly.",
            "In the year 2022, her book, titled Rest Is Resistance: A Manifesto, was published by Little, Brown Spark. It entered the bestseller list of the New York Times in its first week. Not, I should say, the business list. Not the self-help list. The general list. She has been, in every subsequent interview, exact about this distinction. This exactness is, in itself, a kind of statement."
          ]
        }
      ]
    }
    ```

    Notes for the executor:
    - These are realistic DRAFTS sized to approximate the cost-budget ceiling (each sample is ~80-150 words; the cost-budget test in Plan 16-02 Task 3 enforces a ~1200-token cap across all exampleSamples per narrator).
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
      ! grep -E "VERBATIM_FROM|DRAFT[ —-]+Andrew|TODO|PLACEHOLDER|XXX" apps/studio/seeds/narrators.json

      # 4. Each narrator has at least one exampleSample, and each sample is at least 200 characters (no trivial placeholders).
      python -c "import json; d=json.load(open('apps/studio/seeds/narrators.json')); 
      assert all(len(n.get('exampleSamples',[])) >= 1 for n in d['narrators']);
      assert all(all(len(s) >= 200 for s in n['exampleSamples']) for n in d['narrators']), 'sample too short'"

      # 5. Each record has voiceRubric.register / cadence / constraints.
      python -c "import json; d=json.load(open('apps/studio/seeds/narrators.json'));
      for n in d['narrators']:
          r = n['voiceRubric']
          assert r.get('register') and r.get('cadence') and isinstance(r.get('constraints'), list) and len(r['constraints']) >= 3, n['slug']"

      # 6. Jesse seed sentinel (cross-language anchor for NRR-09 QA judge byte-equivalence): Jesse's voiceRubric.register references key phrases from JESSE_PERSONA_BLOCK / UNIVERSAL_CORE.
      python -c "import json; d=json.load(open('apps/studio/seeds/narrators.json')); 
      jesse = next(n for n in d['narrators'] if n['slug']=='jesse'); 
      reg = jesse['voiceRubric']['register'].lower(); 
      assert 'dry' in reg and 'precise' in reg and 'absurdly serious' in reg, 'Jesse register drifted from VOICE_CONSTRAINTS anchor'"
    </automated>
  </verify>

  <done>
    - `narrators.json` exists, parses as JSON, has 3 records.
    - No placeholder tokens.
    - Each record has all required fields per Sanity narrator schema (Plan 16-01).
    - Jesse sentinel anchored to VOICE_CONSTRAINTS register phrasing.
    - All exampleSamples are non-trivial (≥200 chars).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create idempotent seed-narrators.ts script + wire pnpm seed:narrators</name>
  <files>
    apps/studio/scripts/seed-narrators.ts
    apps/studio/package.json
  </files>

  <read_first>
    1. READ `apps/studio/package.json` to note existing scripts (e.g., `dev`, `build`, `deploy`). Find the right block to add `"seed:narrators"`.
    2. READ any existing seed scripts in `apps/studio/scripts/` (if present) for the established pattern. Reuse the client init / env loading pattern.
    3. READ `apps/studio/schemas/narrator.ts` for the document type name (likely `'narrator'`).
  </read_first>

  <action>
    1. Create `apps/studio/scripts/seed-narrators.ts`:
       ```typescript
       /**
        * Phase 16 — idempotent narrator seed (Plan 16-08a).
        *
        * Reads apps/studio/seeds/narrators.json and upserts each record via
        * Sanity client.createOrReplace with a deterministic _id: `narrator.${slug}`.
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

       interface NarratorSeed {
         slug: string;
         displayName: string;
         status: 'active' | 'inactive';
         voiceRubric: {
           register: string;
           cadence: string;
           constraints: string[];
         };
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
           const _id = `narrator.${n.slug}`;
           await client.createOrReplace({
             _id,
             _type: 'narrator',
             slug: { _type: 'slug', current: n.slug },
             displayName: n.displayName,
             status: n.status,
             voiceRubric: n.voiceRubric,
             exampleSamples: n.exampleSamples,
           });
           console.log(`  upserted ${_id} (${n.displayName})`);
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

      # 3. Idempotency: running the script twice (in a dry-run mode if available) does not duplicate documents.
      # NOTE: For a real Sanity dataset, the determinism is enforced by `_id: narrator.${slug}` + createOrReplace.
      # This check is implicit — no automated test, but createOrReplace is idempotent by Sanity's contract.

      # 4. Lint passes.
      cd apps/studio && pnpm lint scripts/seed-narrators.ts 2>/dev/null || true
    </automated>
  </verify>

  <done>
    - `scripts/seed-narrators.ts` exists and type-checks.
    - `package.json` exposes `seed:narrators`.
    - Script uses deterministic `_id` for idempotent upserts.
    - Required env vars documented.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Andrew Studio UAT — confirm seeded narrators render with exampleSamples preview (NRR-07)</name>
  <files>(manual UAT — no Claude-side files modified)</files>

  <what-built>
    Three narrator documents (Jesse, Maya Rudolph, Werner Herzog) have been seeded into the active Sanity dataset via `pnpm --filter studio seed:narrators`. Each record carries a voiceRubric and 2 exampleSamples.

    Sanity Studio's existing weeklyIssue editor (Phase 1+) should now expose a narratorSlug picker (per Plan 16-01 schema additions). When Andrew picks a narrator in that dropdown, the Studio should render a preview of the selected narrator's exampleSamples and voiceRubric.
  </what-built>

  <how-to-verify>
    1. Run the seed script against the dev / preview dataset:
       ```bash
       pnpm --filter studio seed:narrators
       ```
       Expect three log lines, one per narrator. Expect no errors.

    2. Open Sanity Studio (`pnpm --filter studio dev`) and navigate to the Narrators list.
       - Expect to see three documents: Jesse A. Eisenbalm, Maya Rudolph, Werner Herzog.
       - Each document opens with all fields populated (slug, displayName, status=active, voiceRubric.register / cadence / constraints, exampleSamples).
       - exampleSamples render as readable prose, not as JSON-string blobs.

    3. Open the current draft weeklyIssue document (or create a test draft) and locate the `narratorSlug` field added by Plan 16-01.
       - Expect a dropdown / reference picker listing the three narrators.
       - Selecting Maya Rudolph should show a Studio preview of her register + cadence + constraints + at least one exampleSample.
       - Selecting Werner Herzog should show his preview.
       - Selecting Jesse should show his preview (and is the default).

    4. Confirm exampleSamples for Maya and Herzog read as plausible voice samples. Andrew may rewrite either or both samples in Studio at this point — the seed is the floor, not the ceiling. If Andrew rewrites, note the substitution in the resume signal.

    5. Confirm the rendered exampleSamples DO NOT contain any placeholder tokens (e.g., "[VERBATIM_FROM…]"). If they do, the seed script ran against stale narrators.json and must be re-run.
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
    Andrew types "approved" after the three narrators are visible in Studio with rendered exampleSamples. If Andrew rewrites Maya/Herzog samples in Studio during this checkpoint, the rewrite is noted in the SUMMARY.
  </done>
</task>

</tasks>

<verification>
- `narrators.json` validates (Task 1 verify).
- `seed-narrators.ts` type-checks and is wired (Task 2 verify).
- Andrew confirms Studio renders all three narrators with previewable exampleSamples (Task 3).
- `grep -E "VERBATIM_FROM|TODO|PLACEHOLDER" apps/studio/seeds/narrators.json` returns 0 matches.
- Plan 16-02 Task 3's `test_narrator_seed_sentinel` test passes against the seeded `jesse` record.
</verification>

<success_criteria>
- D-11 satisfied: narrators are versioned static seed records.
- NRR-07 satisfied (verified by Andrew): narrator picker + exampleSamples preview works in Studio.
- NRR-09 satisfied: any future narrator additions or sample rewrites happen via Studio (or via re-running the seed script against an updated `narrators.json`).
- Plan 16-09 cost-budget verification can run against real prose (not placeholders).
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-08a-seed-narrators-SUMMARY.md`. Record:
- Confirmation that all three narrators were seeded.
- Whether Andrew rewrote Maya or Herzog samples in Studio during Task 3.
- Cross-reference to 16-08b (frontend chip plan that consumes the displayName from these records).
- Cross-reference to 16-09 (verification + UAT that exercises the full chain).
</output>
