---
phase: 02-web-shell-theme-engine
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/studio/scripts/seed-demo-content.ts
  - apps/studio/scripts/demo-content.json
  - apps/studio/package.json
  - package.json
autonomous: true
requirements: [WEB-01, WEB-02, WEB-06]
must_haves:
  truths:
    - "Engineers can run `pnpm seed:demo` from repo root to populate one stub charity + one stub published weeklyIssue against the live Sanity production dataset"
    - "Seed is idempotent — running it twice produces the same documents (deterministic _ids + createOrReplace)"
    - "The seeded issue has a recognizable non-default theme so the theme engine's CSS-variable injection is visible on first dev run"
    - "Seeded weeklyIssue has all required schema fields populated, no validation errors"
  artifacts:
    - path: apps/studio/scripts/seed-demo-content.ts
      provides: "Idempotent Sanity writer using @sanity/client; deterministic _ids charity-demo-quiet-foundation and issue-001-demo"
      exports: []
    - path: apps/studio/scripts/demo-content.json
      provides: "Source content (Jesse-voice placeholder copy + theme values + bonus type) — separated from logic so non-dev edits are easy"
      contains: "name, location, missionStatement, theme.primaryColor, theme.fontDisplay, originStory.headline"
    - path: apps/studio/package.json
      provides: "seed:demo script using tsx --env-file=.env.local"
  key_links:
    - from: apps/studio/scripts/seed-demo-content.ts
      to: apps/studio/scripts/seed-agents.ts
      via: "shared client init + tsx --env-file pattern"
      pattern: "tsx --env-file=\\.env\\.local"
    - from: package.json (root)
      to: apps/studio/scripts/seed-demo-content.ts
      via: "seed:demo script forwarder"
      pattern: "seed:demo.*pnpm --filter studio"
---

<objective>
Ship the demo content seed script that gives engineers (and Andrew) a working `/issue/[slug]` to render against during local dev. One stub charity + one stub published `weeklyIssue` are written to the live Sanity production dataset (the same `6h1vd9mf/production` dataset Phase 1 wired) via deterministic `_id`s and `createOrReplace`, mirroring the Phase 1 `seed-agents.ts` pattern.

The seeded issue must have a recognizable non-default theme (warm cream bg, deep navy primary, mustard accent) per CONTEXT.md specifics — so the theme engine's CSS-variable injection is visible the first time Andrew runs `pnpm dev:web` after Wave 2/3 land.

Purpose: Wave 3 routes (issue, archive, charities) need at least one published issue + one charity to render anything other than the empty state. Demo content is OPTIONAL — production-quality issues from Phase 4+5 replace it.
Output: `apps/studio/scripts/seed-demo-content.ts`, `demo-content.json`, plus pnpm scripts wired at both studio and root levels.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md
@.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md
@CLAUDE.md
@docs/CLAUDE_CODE_BRIEF.md
@apps/studio/schemas/charity.ts
@apps/studio/schemas/weeklyIssue.ts
@apps/studio/scripts/seed-agents.ts
@apps/studio/scripts/agents.json
@apps/studio/package.json
@package.json

<interfaces>
<!-- Seed pattern from Phase 1 (apps/studio/scripts/seed-agents.ts): -->
<!--   - tsx --env-file=.env.local -->
<!--   - createOrReplace with deterministic _id -->
<!--   - Reads JSON from sibling file -->
<!--   - Fast-fail on missing env -->

Required env (from apps/studio/.env.local — already in place from Phase 1):
- SANITY_STUDIO_PROJECT_ID  (= 6h1vd9mf)
- SANITY_STUDIO_DATASET     (= production)
- SANITY_API_TOKEN          (write-scoped token)

Schema field requirements (REQUIRED fields per apps/studio/schemas/weeklyIssue.ts):
- issueNumber          (Rule.required().integer().positive())
- slug                 (Rule.required())
- publishDate          (Rule.required())
- status               (Rule.required(); set to 'published' for demo)
- charity (reference)  (Rule.required())
- bonusType            (Rule.required(); 'bigBudget' | 'jingle' | 'specAd')
- originStory.headline + body                  (Rule.required())
- problemStatement.headline + body             (Rule.required())
- founderBio.headline + body                   (Rule.required())
- caseStudy.headline + body                    (Rule.required())
- game.headline                                (Rule.required())
- game.embedCode                               (Rule.required())
- bonus.headline                               (Rule.required())

Charity required fields:
- name, slug, location

Portable Text shape (Sanity v3+; same as Phase 1 agent profiles handled via plain
strings). For demo seed, each body field is an array of one block:
  {
    _type: 'block',
    _key: '<unique-key>',
    style: 'normal',
    markDefs: [],
    children: [{ _type: 'span', _key: '<unique-key>', text: '...', marks: [] }],
  }

UI-SPEC demo theme guidance (CONTEXT.md specifics):
- Warm cream bg, deep navy primary, mustard accent — so Andrew SEES theme injection
  working on first dev run. Suggested values that pass WCAG AA with the suggested
  text color (assert in script that contrast >= 4.5:1 by running the same WCAG
  math used in apps/web/lib/theme.ts — or simply pick a pair where the math is
  trivially obvious like #F5EEDC bg / #14213D text — contrast ~14:1):
  - primaryColor:    '#14213D'   (deep navy)
  - accentColor:     '#FCA311'   (mustard)
  - backgroundColor: '#F5EEDC'   (warm cream)
  - textColor:       '#1A1A18'   (near-black)
  - fontDisplay:     'DM Serif Display'
  - fontBody:        'Merriweather'
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create apps/studio/scripts/demo-content.json with Jesse-voice placeholder copy</name>
  <read_first>
    - apps/studio/schemas/charity.ts (required fields)
    - apps/studio/schemas/weeklyIssue.ts (required fields, theme shape, bonus shape)
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md (Copywriting Contract — Jesse voice rules)
    - CLAUDE.md ("Dry, precise, and absurdly serious. No winking.")
    - docs/CLAUDE_CODE_BRIEF.md (Jesse voice notes — search "Voice" or "Jesse")
  </read_first>
  <files>apps/studio/scripts/demo-content.json</files>
  <action>
    Create `apps/studio/scripts/demo-content.json`. Voice: dry, precise, played straight; no exclamation marks; no winking. Fictional charity called "The Quiet Foundation" — sounds plausibly real, gives Fortune 500 gravity.

    ```json
    {
      "charity": {
        "name": "The Quiet Foundation",
        "slug": "the-quiet-foundation",
        "location": "Gallup, NM",
        "website": "https://example.org/quiet-foundation",
        "foundingYear": 1987,
        "assetRange": "$250K–$500K",
        "focusArea": "Rural acoustic preservation",
        "missionStatement": "The Quiet Foundation preserves quiet places in the rural United States by measuring ambient sound and intervening when human noise crosses a documented threshold.",
        "scoutNotes": "Founded by a former NOAA acoustician who realized federal noise regulations stop at 65 decibels. Operates a fleet of seven calibrated microphones across the Four Corners region. Has never accepted federal funding."
      },
      "issue": {
        "issueNumber": 1,
        "publishDate": "2026-06-05",
        "status": "published",
        "bonusType": "jingle",
        "theme": {
          "primaryColor": "#14213D",
          "accentColor": "#FCA311",
          "backgroundColor": "#F5EEDC",
          "textColor": "#1A1A18",
          "fontDisplay": "DM Serif Display",
          "fontBody": "Merriweather",
          "visualDirection": "Warm cream paper stock. Deep navy headlines. The accent appears once — on the shop button. Nothing decorative."
        },
        "originStory": {
          "headline": "She drove to a place where the only sound was wind",
          "body": "Margaret Holloway worked at NOAA for nineteen years measuring weather data. In 2014 she took a sabbatical and drove a calibrated microphone to a clearing in McKinley County. The sound floor was thirteen decibels. She submitted a memo. The memo went nowhere. She founded The Quiet Foundation eight months later."
        },
        "problemStatement": {
          "headline": "Federal noise regulations stop at sixty-five decibels",
          "body": "The Environmental Protection Agency monitors noise above sixty-five decibels in populated areas. Nothing in the federal code addresses what happens to a place that is naturally quieter than that. A natural sound floor of thirteen decibels can rise to thirty-five over a decade — measurable as a four-fold increase in ambient pressure — and remain entirely legal. The Quiet Foundation documents this by parking calibrated microphones in undocumented quiet zones for thirty-day intervals."
        },
        "founderBio": {
          "headline": "Margaret Holloway",
          "body": "Holloway is a senior fellow at the Acoustical Society of America. She holds a PhD in atmospheric physics from Colorado State. She has published twelve papers on the propagation of low-frequency sound across high-elevation desert. She lives in Gallup. She does not give interviews."
        },
        "caseStudy": {
          "subjectName": "Chaco Culture National Historical Park",
          "headline": "A measurable victory in San Juan County",
          "body": "In 2019 the Foundation deployed three microphones at the perimeter of Chaco Culture National Historical Park. Over forty-five days they documented a fourteen-decibel rise in ambient sound correlated with a regional helicopter tourism contract. The data was provided to the National Park Service. The contract was not renewed."
        },
        "game": {
          "headline": "How quiet can you stand it",
          "description": "Move the cursor to keep the sound meter below thirty-five decibels for sixty seconds.",
          "embedCode": "<div style=\"font-family:monospace;padding:24px;background:#F5EEDC;color:#1A1A18\"><p>Phase 7 wires the interactive game. This is a placeholder render only.</p></div>"
        },
        "bonus": {
          "headline": "A jingle for The Quiet Foundation",
          "lyrics": "Drive past the city limits / past the last good signal / past the last gas station / where the air stops humming / where the road stops talking / The Quiet Foundation is listening.",
          "sunoPrompt": "Sparse acoustic guitar. Single voice, no harmony. Sixty-second runtime. No drums.",
          "sunoAudioUrl": ""
        },
        "podcast": {
          "podcastDescription": "Phase 9 will wire the NotebookLM audio player here. The transcript field is populated by the pipeline.",
          "deliberationTranscript": "Scout proposed three candidates: a rural literacy nonprofit in West Virginia, an acoustic preservation organization in New Mexico, and a community microgrid co-op in Vermont. Advocate scored the acoustic preservation organization highest because its work is measurable, its scope is bounded, and its founder is on record refusing federal funding. Editor selected it on the strength of the original NOAA memo."
        },
        "selectionDeliberation": {
          "editorDecision": "Selected on the strength of measurability and the founder's refusal of federal funding. The runner-up was a rural literacy nonprofit in West Virginia.",
          "runnerUpNotes": "The literacy nonprofit was strong but lacked the documentary record this issue needs. Returns to the queue for a future issue."
        }
      }
    }
    ```

    Bonus type set to `'jingle'` so the demo exercises the lyrics + sunoPrompt path. The empty `sunoAudioUrl` triggers the "audio coming soon" empty state — useful for testing both states.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/studio/scripts/demo-content.json && \
      node -e "const j=require('./apps/studio/scripts/demo-content.json'); \
        if (j.charity.name !== 'The Quiet Foundation') process.exit(1); \
        if (j.charity.slug !== 'the-quiet-foundation') process.exit(2); \
        if (j.issue.issueNumber !== 1) process.exit(3); \
        if (j.issue.status !== 'published') process.exit(4); \
        if (j.issue.bonusType !== 'jingle') process.exit(5); \
        if (j.issue.theme.primaryColor !== '#14213D') process.exit(6); \
        if (j.issue.theme.backgroundColor !== '#F5EEDC') process.exit(7); \
        if (j.issue.theme.fontDisplay !== 'DM Serif Display') process.exit(8); \
        if (!j.issue.originStory.body) process.exit(9); \
        if (!j.issue.problemStatement.body) process.exit(10); \
        if (!j.issue.founderBio.body) process.exit(11); \
        if (!j.issue.caseStudy.body) process.exit(12); \
        if (!j.issue.game.embedCode) process.exit(13); \
        if (!j.issue.bonus.headline) process.exit(14); \
        console.log('demo-content.json shape OK')"
    </automated>
  </verify>
  <done>
    `demo-content.json` exists with one charity object and one issue object. Every Sanity-required field is populated. Theme uses the cream/navy/mustard palette so the theme engine's CSS-variable injection is visible. Voice matches the Jesse rules (no exclamation marks, no winking, founder treated with Fortune 500 gravity).
  </done>
</task>

<task type="auto">
  <name>Task 2: Create apps/studio/scripts/seed-demo-content.ts (idempotent writer)</name>
  <read_first>
    - apps/studio/scripts/seed-agents.ts (the source pattern — copy structure verbatim where appropriate)
    - apps/studio/schemas/charity.ts (field shapes)
    - apps/studio/schemas/weeklyIssue.ts (field shapes; Portable Text helper)
  </read_first>
  <files>apps/studio/scripts/seed-demo-content.ts</files>
  <action>
    Create `apps/studio/scripts/seed-demo-content.ts`. Mirror the structure of `seed-agents.ts`. Two `createOrReplace` calls in sequence (charity first because issue references it).

    Use `randomUUID()` from node:crypto for Portable Text `_key` values — each block and span needs a unique key per Sanity Portable Text shape.

    ```typescript
    /**
     * Seeds one stub charity + one stub published weeklyIssue into the
     * configured Sanity dataset, so apps/web Phase 2 routes have something
     * to render during local dev. Mirrors apps/studio/scripts/seed-agents.ts.
     *
     * Run from repo root: `pnpm seed:demo`
     * Or from apps/studio:  `pnpm seed:demo`
     *
     * Idempotent: deterministic _ids + createOrReplace.
     *   _id 'charity-demo-quiet-foundation'  (charity)
     *   _id 'issue-001-demo'                 (weeklyIssue)
     *
     * Required env vars (loaded from apps/studio/.env.local):
     *   SANITY_STUDIO_PROJECT_ID
     *   SANITY_STUDIO_DATASET (defaults to 'production')
     *   SANITY_API_TOKEN
     */
    import { createClient } from '@sanity/client'
    import { randomUUID } from 'node:crypto'
    import { readFileSync } from 'node:fs'
    import { resolve, dirname } from 'node:path'
    import { fileURLToPath } from 'node:url'

    type DemoCharity = {
      name: string
      slug: string
      location: string
      website: string
      foundingYear: number
      assetRange: string
      focusArea: string
      missionStatement: string
      scoutNotes: string
    }

    type DemoIssue = {
      issueNumber: number
      publishDate: string
      status: 'draft' | 'in-review' | 'published'
      bonusType: 'bigBudget' | 'jingle' | 'specAd'
      theme: {
        primaryColor: string
        accentColor: string
        backgroundColor: string
        textColor: string
        fontDisplay: string
        fontBody: string
        visualDirection: string
      }
      originStory: { headline: string; body: string }
      problemStatement: { headline: string; body: string }
      founderBio: { headline: string; body: string }
      caseStudy: { subjectName: string; headline: string; body: string }
      game: { headline: string; description: string; embedCode: string }
      bonus: {
        headline: string
        lyrics: string
        sunoPrompt: string
        sunoAudioUrl: string
      }
      podcast: { podcastDescription: string; deliberationTranscript: string }
      selectionDeliberation: { editorDecision: string; runnerUpNotes: string }
    }

    type DemoContent = { charity: DemoCharity; issue: DemoIssue }

    const __dirname = dirname(fileURLToPath(import.meta.url))
    const contentPath = resolve(__dirname, 'demo-content.json')

    const projectId = process.env.SANITY_STUDIO_PROJECT_ID
    const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'
    const token = process.env.SANITY_API_TOKEN

    function fail(message: string): never {
      console.error(`\n✗ seed-demo: ${message}\n`)
      process.exit(1)
    }

    if (!projectId) {
      fail(
        'Missing SANITY_STUDIO_PROJECT_ID. Run `npx sanity@latest init` ' +
          '(see apps/studio/README.md) and populate apps/studio/.env.local.',
      )
    }
    if (!token) {
      fail(
        'Missing SANITY_API_TOKEN. Create a write-scoped token at ' +
          'https://www.sanity.io/manage > project > API > Tokens (Editor role) ' +
          'and add it to apps/studio/.env.local as SANITY_API_TOKEN=...',
      )
    }

    const raw = readFileSync(contentPath, 'utf8')
    const content = JSON.parse(raw) as DemoContent

    /**
     * Convert a plain-text paragraph to a single Portable Text block.
     * Each block + span needs a unique _key.
     */
    function textToPortableTextBlock(text: string): Record<string, unknown> {
      return {
        _type: 'block',
        _key: randomUUID().slice(0, 12),
        style: 'normal',
        markDefs: [],
        children: [
          {
            _type: 'span',
            _key: randomUUID().slice(0, 12),
            text,
            marks: [],
          },
        ],
      }
    }

    /** Wrap a text string in a single-block Portable Text array. */
    function pt(text: string): Record<string, unknown>[] {
      return [textToPortableTextBlock(text)]
    }

    const CHARITY_ID = 'charity-demo-quiet-foundation'
    const ISSUE_ID = 'issue-001-demo'

    const client = createClient({
      projectId,
      dataset,
      token,
      apiVersion: '2024-01-01',
      useCdn: false,
    })

    async function main(): Promise<void> {
      console.log(`Seeding demo content into ${projectId}/${dataset}…`)

      // 1. Charity
      const charityDoc = {
        _id: CHARITY_ID,
        _type: 'charity' as const,
        name: content.charity.name,
        slug: { _type: 'slug' as const, current: content.charity.slug },
        location: content.charity.location,
        website: content.charity.website,
        foundingYear: content.charity.foundingYear,
        assetRange: content.charity.assetRange,
        focusArea: content.charity.focusArea,
        missionStatement: content.charity.missionStatement,
        scoutNotes: content.charity.scoutNotes,
      }
      await client.createOrReplace(charityDoc)
      console.log(`  ✓ ${CHARITY_ID}`)

      // 2. Weekly issue (references the charity by _id)
      const issueDoc = {
        _id: ISSUE_ID,
        _type: 'weeklyIssue' as const,
        issueNumber: content.issue.issueNumber,
        slug: { _type: 'slug' as const, current: `issue-${content.issue.issueNumber}` },
        publishDate: content.issue.publishDate,
        status: content.issue.status,
        charity: {
          _type: 'reference' as const,
          _ref: CHARITY_ID,
        },
        theme: content.issue.theme,
        bonusType: content.issue.bonusType,
        originStory: {
          headline: content.issue.originStory.headline,
          body: pt(content.issue.originStory.body),
        },
        problemStatement: {
          headline: content.issue.problemStatement.headline,
          body: pt(content.issue.problemStatement.body),
        },
        founderBio: {
          headline: content.issue.founderBio.headline,
          body: pt(content.issue.founderBio.body),
        },
        caseStudy: {
          subjectName: content.issue.caseStudy.subjectName,
          headline: content.issue.caseStudy.headline,
          body: pt(content.issue.caseStudy.body),
        },
        game: {
          headline: content.issue.game.headline,
          description: content.issue.game.description,
          embedCode: content.issue.game.embedCode,
        },
        bonus: {
          headline: content.issue.bonus.headline,
          // Jingle bonus: no body Portable Text required; lyrics is plain text.
          lyrics: content.issue.bonus.lyrics,
          sunoPrompt: content.issue.bonus.sunoPrompt,
          sunoAudioUrl: content.issue.bonus.sunoAudioUrl,
        },
        podcast: {
          podcastDescription: content.issue.podcast.podcastDescription,
          deliberationTranscript: content.issue.podcast.deliberationTranscript,
        },
        selectionDeliberation: {
          editorDecision: content.issue.selectionDeliberation.editorDecision,
          runnerUpNotes: content.issue.selectionDeliberation.runnerUpNotes,
        },
      }
      await client.createOrReplace(issueDoc)
      console.log(`  ✓ ${ISSUE_ID}`)

      console.log(`\nSeeded 2/2 demo documents.`)
      console.log(`\nVisit /issue/issue-${content.issue.issueNumber} to render the demo issue.`)
    }

    main().catch((err) => {
      console.error(err)
      process.exit(1)
    })
    ```

    Notes:
    - Issue slug is `issue-1` (matches the schema's auto-generation rule: `source: (doc) => \`issue-${doc.issueNumber}\`` in weeklyIssue.ts).
    - We DO NOT set `pipelineMetadata.runId` — Phase 4+ populates that. The Convex deliberation slot will show the empty-state copy for this demo issue.
    - `firstFeaturedIn` back-reference on the charity is intentionally left unset; the Publisher agent (Phase 6) handles that. Wave 3 `<CharityCard>` handles the null `featuredIn` case gracefully.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/studio/scripts/seed-demo-content.ts && \
      grep -q "import { createClient } from '@sanity/client'" apps/studio/scripts/seed-demo-content.ts && \
      grep -q "import { randomUUID } from 'node:crypto'" apps/studio/scripts/seed-demo-content.ts && \
      grep -q "charity-demo-quiet-foundation" apps/studio/scripts/seed-demo-content.ts && \
      grep -q "issue-001-demo" apps/studio/scripts/seed-demo-content.ts && \
      grep -q "createOrReplace" apps/studio/scripts/seed-demo-content.ts && \
      grep -q "_type: 'weeklyIssue'" apps/studio/scripts/seed-demo-content.ts && \
      grep -q "_type: 'charity'" apps/studio/scripts/seed-demo-content.ts && \
      grep -q "status: content.issue.status" apps/studio/scripts/seed-demo-content.ts && \
      grep -q "SANITY_STUDIO_PROJECT_ID" apps/studio/scripts/seed-demo-content.ts && \
      grep -q "SANITY_API_TOKEN" apps/studio/scripts/seed-demo-content.ts
    </automated>
  </verify>
  <done>
    `seed-demo-content.ts` exists. Mirrors `seed-agents.ts` structure: env loading, fast-fail, createOrReplace with deterministic _ids. Writes one charity then one published weeklyIssue with Portable Text body fields and the cream/navy/mustard theme.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add seed:demo script to apps/studio/package.json + forwarder to root package.json + execute seed live</name>
  <read_first>
    - apps/studio/package.json (existing "seed:agents" script — pattern: tsx --env-file=.env.local)
    - package.json (root — pattern: pnpm --filter studio forwarders)
  </read_first>
  <files>apps/studio/package.json, package.json</files>
  <action>
    1. Add `"seed:demo": "tsx --env-file=.env.local scripts/seed-demo-content.ts"` to `apps/studio/package.json` `scripts` section, immediately after `"seed:agents"`. Preserve all other scripts and dependencies verbatim.

       Final `apps/studio/package.json` scripts block:
       ```json
       "scripts": {
         "dev": "sanity dev",
         "start": "sanity start",
         "build": "sanity build",
         "deploy": "sanity deploy",
         "deploy-graphql": "sanity graphql deploy",
         "schema:extract": "sanity schema extract --enforce-required-fields",
         "typegen": "pnpm schema:extract && sanity typegen generate",
         "seed:agents": "tsx --env-file=.env.local scripts/seed-agents.ts",
         "seed:demo": "tsx --env-file=.env.local scripts/seed-demo-content.ts"
       }
       ```

    2. Add `"seed:demo": "pnpm --filter studio seed:demo"` to root `package.json` `scripts` section, immediately after `"seed:agents"`. Preserve every other script (including the four web scripts added in Plan 02-01).

       Final root `package.json` scripts block (assuming Plan 02-01 has merged):
       ```json
       "scripts": {
         "dev:studio": "pnpm --filter studio dev",
         "build:studio": "pnpm --filter studio build",
         "deploy:studio": "pnpm --filter studio deploy",
         "typegen": "pnpm --filter studio typegen",
         "seed:agents": "pnpm --filter studio seed:agents",
         "seed:demo": "pnpm --filter studio seed:demo",
         "dev:web": "pnpm --filter web dev",
         "build:web": "pnpm --filter web build",
         "lint:web": "pnpm --filter web lint",
         "typecheck:web": "pnpm --filter web typecheck"
       }
       ```

    3. Execute the seed live against the production dataset. This is the same execution pattern Phase 1 Plan 06 used for `seed:agents` — confirmed via STATE.md that production writes are expected.

       Run: `pnpm seed:demo`

       Expected output: two `✓` lines (charity then issue), final `Seeded 2/2`. Re-running the command must produce identical output (idempotency confirmed).

       If the command fails with a missing-env error, stop and report — the executor should NOT attempt to write env files; that's Andrew's manual setup.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      node -e "const p=require('./apps/studio/package.json'); if(!p.scripts['seed:demo']) process.exit(1); if(!p.scripts['seed:demo'].includes('seed-demo-content.ts')) process.exit(2); console.log('apps/studio seed:demo OK')" && \
      node -e "const p=require('./package.json'); if(!p.scripts['seed:demo']) process.exit(1); if(!p.scripts['seed:demo'].includes('pnpm --filter studio')) process.exit(2); console.log('root seed:demo OK')" && \
      pnpm seed:demo 2>&1 | tee /tmp/seed-demo.log && \
      grep -q "✓ charity-demo-quiet-foundation" /tmp/seed-demo.log && \
      grep -q "✓ issue-001-demo" /tmp/seed-demo.log && \
      grep -q "Seeded 2/2" /tmp/seed-demo.log && \
      # Re-run idempotency check:
      pnpm seed:demo 2>&1 | tee /tmp/seed-demo-2.log && \
      grep -q "Seeded 2/2" /tmp/seed-demo-2.log
    </automated>
  </verify>
  <done>
    `pnpm seed:demo` succeeds against the live production dataset. Re-running produces identical output. Both `apps/studio/package.json` and root `package.json` expose the script. Andrew can `pnpm seed:demo` from repo root.
  </done>
</task>

</tasks>

<verification>
- `apps/studio/scripts/seed-demo-content.ts` and `apps/studio/scripts/demo-content.json` exist
- `pnpm seed:demo` writes two documents and is idempotent on re-run
- Issue is queryable at `/issue/issue-1` once Wave 3 lands (manual check in Plan 02-11 smoke test)
- Demo theme uses the cream/navy/mustard palette so theme injection is visible
</verification>

<success_criteria>
- One charity (`charity-demo-quiet-foundation`) and one published issue (`issue-001-demo`, slug `issue-1`) exist in Sanity production
- All Sanity-required fields populated; no schema validation errors
- Voice matches Jesse rules (no exclamation marks; founder bio Fortune 500 gravity)
- Idempotent: 2nd `pnpm seed:demo` produces same docs (no duplicates)
- Script structure mirrors seed-agents.ts (tsx --env-file, fast-fail on missing env, createOrReplace)
</success_criteria>

<output>
After completion, create `.planning/phases/02-web-shell-theme-engine/02-04-demo-content-seed-SUMMARY.md` recording: the two deterministic _ids, the demo theme hex values, the slug (`issue-1`), and a note that the demo issue exercises the `bonusType: 'jingle'` + empty `sunoAudioUrl` path for testing the "audio coming soon" empty state in Plan 02-06.
</output>
