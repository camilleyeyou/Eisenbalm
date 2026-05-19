---
phase: 01-sanity-foundation
plan: 06
type: execute
wave: 3
depends_on:
  - "01-03"
files_modified:
  - apps/studio/scripts/agents.json
  - apps/studio/scripts/seed-agents.ts
autonomous: true
requirements:
  - FND-03
must_haves:
  truths:
    - "Running `pnpm --filter studio seed:agents` creates exactly 14 agentProfile documents in the production dataset"
    - "Each document has `_id` of the form `agent-{agentId}` (deterministic — re-runs use createOrReplace and do not duplicate)"
    - "All 14 canonical agentIds from the brief are seeded in the order from CONTEXT.md"
    - "Re-running the seed script (idempotent) produces no errors and no duplicate documents"
    - "Seed copy is on-voice (Jesse — dry, precise, no winking) per the 'Specifics' section in CONTEXT.md"
  artifacts:
    - path: "apps/studio/scripts/agents.json"
      provides: "Editable seed payload — Andrew can tweak copy without TypeScript"
      contains: '"agentId": "calibrator"'
    - path: "apps/studio/scripts/seed-agents.ts"
      provides: "Idempotent seed script using @sanity/client createOrReplace with deterministic _id"
      contains: "createOrReplace"
  key_links:
    - from: "apps/studio/scripts/seed-agents.ts"
      to: "apps/studio/scripts/agents.json"
      via: "JSON import / read"
      pattern: "agents\\.json"
    - from: "apps/studio/scripts/seed-agents.ts"
      to: "Sanity production dataset"
      via: "@sanity/client with SANITY_API_TOKEN"
      pattern: "createClient"
---

<objective>
Seed all 14 canonical agentProfile documents into the production Sanity dataset using a deterministic, idempotent script. Copy is curated to Jesse's voice now (rather than placeholder) because — per CONTEXT.md "Specifics" — the seed copy becomes part of the deliberation layer in Phase 9, and getting it right now saves a Phase 9 rewrite.

Purpose: Honors decisions D-16 through D-19. Resolves requirement FND-03.
Output: A re-runnable `pnpm seed:agents` command that lands 14 agentProfile docs visible in Sanity Studio.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-sanity-foundation/01-CONTEXT.md
@CLAUDE.md
@docs/CLAUDE_CODE_BRIEF.md
@apps/studio/schemas/agentProfile.ts
@apps/studio/package.json
</context>

<interfaces>
<!-- agentProfile schema fields (from apps/studio/schemas/agentProfile.ts after Plan 03 fix) -->
<!-- Each seed document MUST shape itself to match these fields. _id is set by the seed script (NOT by the schema). -->

Document type: `agentProfile`
Required fields:
  - `agentId` (slug) — `{ _type: 'slug', current: '<kebab-case-id>' }` — must be one of the 14 canonical IDs
  - `displayName` (string) — required
  - `role` (string) — required
Optional fields:
  - `personality` (text, ~4 rows)
  - `avatar` (image) — leave undefined; frontend renders placeholder

Canonical 14 agentIds in order (from CONTEXT.md "Specifics"):
  1.  calibrator
  2.  scout
  3.  advocate
  4.  editor
  5.  researcher
  6.  origin-story
  7.  problem-statement
  8.  founder-bio
  9.  case-study
  10. game
  11. bonus
  12. design
  13. qa
  14. publisher

Deterministic `_id` format: `agent-{agentId}` (e.g. `agent-calibrator`, `agent-origin-story`, `agent-problem-statement`).
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Author apps/studio/scripts/agents.json with all 14 canonical agents</name>
  <files>apps/studio/scripts/agents.json</files>
  <read_first>
    - apps/studio/schemas/agentProfile.ts (confirm field names: agentId, displayName, role, personality, avatar)
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-18: payload includes agentId, displayName, role, personality; voice tone — "dry, precise, absurdly serious — no winking")
    - docs/CLAUDE_CODE_BRIEF.md (voice notes and agent role descriptions — source for seed copy)
    - CLAUDE.md (project preface — voice rules: "Dry, precise, and absurdly serious. No winking. No irony signaling.")
  </read_first>
  <action>
    Create directory: `mkdir -p apps/studio/scripts`.

    Create `apps/studio/scripts/agents.json` with EXACTLY this content. The JSON is an array of 14 objects, in the canonical order, using kebab-case `agentId` and Jesse-voice copy. Andrew can edit this file later without touching TypeScript (per D-18).

    ```json
    [
      {
        "agentId": "calibrator",
        "displayName": "The Calibrator",
        "role": "Sets the issue's voice constants and rotates the bonus type",
        "personality": "Treats brand voice as a constant, not a vibe. Generates the style brief at the start of every run and refuses to revisit it once the writers are working. Has never used an exclamation mark on purpose."
      },
      {
        "agentId": "scout",
        "displayName": "The Scout",
        "role": "Finds the charities nobody else bothers looking for",
        "personality": "Searches the parts of the web that the rest of the internet has stopped indexing. Returns three to five candidates per run, with notes on why each one was overlooked. Rejects anything Charity Navigator already ranks."
      },
      {
        "agentId": "advocate",
        "displayName": "The Advocate",
        "role": "Argues a one-to-ten case for every candidate the Scout brings back",
        "personality": "Writes a single paragraph and a single number. Treats the score as a wager, not an opinion. Refuses to break ties — that work belongs to the Editor."
      },
      {
        "agentId": "editor",
        "displayName": "The Editor",
        "role": "Selects the week's charity and pauses the run if the field is unclear",
        "personality": "Holds the gate. Writes a structured deliberation transcript explaining the selection and the runners-up, then either advances the run or calls for Andrew. Believes a tie means the work is not done."
      },
      {
        "agentId": "researcher",
        "displayName": "The Researcher",
        "role": "Builds the shared research dossier the section writers consume",
        "personality": "Will not name a founder without a source URL on the charity's own website. Falls back to anonymous framing rather than guess. Treats httpx fetches as receipts."
      },
      {
        "agentId": "origin-story",
        "displayName": "The Origin Story Writer",
        "role": "Writes the weird, specific moment someone said \"I guess I'm doing this now\"",
        "personality": "Refuses the polished About-page version. Looks for the unguarded sentence — the one the founder almost did not include. Writes plainly, without sentiment."
      },
      {
        "agentId": "problem-statement",
        "displayName": "The Problem Writer",
        "role": "States the broken thing precisely, and how small the fix actually is",
        "personality": "Writes the section that becomes the PDF. No sentiment. No softening. Treats the problem like a Fortune 500 quarterly note: the diagnosis, the lever, the cost of inaction."
      },
      {
        "agentId": "founder-bio",
        "displayName": "The Founder Bio Writer",
        "role": "Treats every founder with the gravity of a Fortune 500 CEO",
        "personality": "Plays it completely straight. The fact that the subject runs a five-person nonprofit out of a borrowed office is reported in the same register as a 10-K filing."
      },
      {
        "agentId": "case-study",
        "displayName": "The Case Study Writer",
        "role": "Documents one real person and one real outcome — proof of existence",
        "personality": "Insists on a verifiable subject. If the name cannot be confirmed against a primary source, drops to anonymous framing rather than fabricate. Will not embellish a quote it did not get."
      },
      {
        "agentId": "game",
        "displayName": "The Game Writer",
        "role": "Builds a self-contained HTML/JS game that gamifies the charity's mission",
        "personality": "Writes inline HTML, inline CSS, inline JS. No external scripts, no CDN, no fetch. Treats the iframe sandbox as the only level of the game it actually has to win."
      },
      {
        "agentId": "bonus",
        "displayName": "The Bonus Writer",
        "role": "Produces the rotating bonus: big-budget treatment, jingle, or spec ad",
        "personality": "Branches on bonusType and emits exactly the shape that branch needs. Never produces a jingle when the type is specAd. Never reuses last week's category."
      },
      {
        "agentId": "design",
        "displayName": "The Design Agent",
        "role": "Specifies the issue's theme: hex colors and whitelisted fonts",
        "personality": "Outputs four six-digit hex strings and two font names from the approved list. Will not invent a font. Treats WCAG AA contrast as a precondition, not a polish step."
      },
      {
        "agentId": "qa",
        "displayName": "Quality Assurance",
        "role": "Audits every section against the Jesse-voice rubric and factual accuracy",
        "personality": "Writes corrections, not opinions. Records severity and acceptance status for each finding. Treats one warning the same as ten warnings: the section either passes or it does not."
      },
      {
        "agentId": "publisher",
        "displayName": "The Publisher",
        "role": "Renders the Problem Statement to PDF and ships the issue",
        "personality": "Triggered by Andrew, not the clock. Verifies the webhook signature, waits the thirty seconds for Sanity's CDN, then calls the deploy hook. Considers a deploy that does not finalize a failed deploy."
      }
    ]
    ```

    Validation: Exactly 14 objects, in this exact order, with kebab-case `agentId` values matching the canonical list. The file MUST parse as valid JSON. Each object MUST have `agentId`, `displayName`, `role`, `personality` (per D-18). No `avatar` (optional; frontend uses placeholder).
  </action>
  <verify>
    <automated>test -f apps/studio/scripts/agents.json && node -e "const a=JSON.parse(require('fs').readFileSync('apps/studio/scripts/agents.json','utf8')); if(!Array.isArray(a)||a.length!==14){process.exit(1)} const expected=['calibrator','scout','advocate','editor','researcher','origin-story','problem-statement','founder-bio','case-study','game','bonus','design','qa','publisher']; for(let i=0;i<14;i++){if(a[i].agentId!==expected[i])process.exit(2); if(!a[i].displayName||!a[i].role||!a[i].personality)process.exit(3)}"</automated>
  </verify>
  <done>
    - `apps/studio/scripts/agents.json` exists with exactly 14 entries
    - Entries are in the canonical order: calibrator, scout, advocate, editor, researcher, origin-story, problem-statement, founder-bio, case-study, game, bonus, design, qa, publisher
    - Each entry has non-empty `agentId`, `displayName`, `role`, `personality`
    - Copy is on-voice (dry, precise, no exclamation marks, no winking)
  </done>
</task>

<task type="auto">
  <name>Task 2: Write apps/studio/scripts/seed-agents.ts (idempotent createOrReplace)</name>
  <files>apps/studio/scripts/seed-agents.ts</files>
  <read_first>
    - apps/studio/scripts/agents.json (just created in Task 1)
    - apps/studio/package.json (confirms `seed:agents` script invokes `tsx scripts/seed-agents.ts`)
    - apps/studio/.env.local (provides SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET; SANITY_API_TOKEN must be added by Andrew before running — script must validate and instruct on missing token)
    - apps/studio/schemas/agentProfile.ts (confirms field shape — slug `_type: 'slug'`, current is the kebab id)
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-17: deterministic _id `agent-{agentId}`; D-18: payload shape)
    - .planning/research/STACK.md (verifies @sanity/client@^7.22.0)
  </read_first>
  <action>
    Create `apps/studio/scripts/seed-agents.ts` with EXACTLY this content:

    ```typescript
    /**
     * Seeds the 14 canonical agentProfile documents into the configured
     * Sanity dataset. Idempotent: uses deterministic `_id` of the form
     * `agent-{agentId}` and `createOrReplace` so re-runs do not duplicate.
     *
     * Run from repo root: `pnpm seed:agents`
     * Or from apps/studio:  `pnpm seed:agents`
     *
     * Required env vars (loaded from apps/studio/.env.local):
     *   SANITY_STUDIO_PROJECT_ID — project to write to
     *   SANITY_STUDIO_DATASET    — defaults to 'production'
     *   SANITY_API_TOKEN          — write-scoped token from sanity.io/manage
     */
    import { createClient } from '@sanity/client'
    import { readFileSync } from 'node:fs'
    import { resolve, dirname } from 'node:path'
    import { fileURLToPath } from 'node:url'

    type AgentSeed = {
      agentId: string
      displayName: string
      role: string
      personality: string
    }

    const __dirname = dirname(fileURLToPath(import.meta.url))
    const agentsPath = resolve(__dirname, 'agents.json')

    const projectId = process.env.SANITY_STUDIO_PROJECT_ID
    const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'
    const token = process.env.SANITY_API_TOKEN

    function fail(message: string): never {
      console.error(`\n✗ seed-agents: ${message}\n`)
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

    const raw = readFileSync(agentsPath, 'utf8')
    const agents = JSON.parse(raw) as AgentSeed[]

    if (!Array.isArray(agents) || agents.length !== 14) {
      fail(`Expected exactly 14 agents in agents.json, found ${agents.length}.`)
    }

    const expectedOrder = [
      'calibrator',
      'scout',
      'advocate',
      'editor',
      'researcher',
      'origin-story',
      'problem-statement',
      'founder-bio',
      'case-study',
      'game',
      'bonus',
      'design',
      'qa',
      'publisher',
    ]
    for (let i = 0; i < 14; i++) {
      if (agents[i]?.agentId !== expectedOrder[i]) {
        fail(
          `agents.json[${i}] has agentId "${agents[i]?.agentId}", expected ` +
          `"${expectedOrder[i]}". Order must match the canonical 14-agent list.`,
        )
      }
    }

    const client = createClient({
      projectId,
      dataset,
      token,
      apiVersion: '2024-01-01',
      useCdn: false,
    })

    async function main(): Promise<void> {
      console.log(`Seeding ${agents.length} agentProfile documents into ${projectId}/${dataset}…`)
      let succeeded = 0
      for (const agent of agents) {
        const docId = `agent-${agent.agentId}`
        try {
          await client.createOrReplace({
            _id: docId,
            _type: 'agentProfile',
            agentId: { _type: 'slug', current: agent.agentId },
            displayName: agent.displayName,
            role: agent.role,
            personality: agent.personality,
          })
          succeeded += 1
          console.log(`  ✓ ${docId}`)
        } catch (err) {
          console.error(`  ✗ ${docId}: ${(err as Error).message}`)
          throw err
        }
      }
      console.log(`\nSeeded ${succeeded}/${agents.length} agent profiles.`)
    }

    main().catch((err) => {
      console.error(err)
      process.exit(1)
    })
    ```

    Notes:
    - `createOrReplace` with deterministic `_id: 'agent-{agentId}'` (D-17) makes the script idempotent. Re-running overwrites, never duplicates.
    - The script validates the `agents.json` shape at startup so a typo in copy edits surfaces a clear error before any network call.
    - Env var validation surfaces a helpful message if Andrew hasn't yet added `SANITY_API_TOKEN` to `apps/studio/.env.local`.
    - `apiVersion: '2024-01-01'` is the explicit pinned API version per Sanity's "always pin apiVersion" guidance.
    - The `apps/studio/package.json` from Plan 03 already invokes `tsx scripts/seed-agents.ts` for `seed:agents`, and `tsx` is a dependency. No further wiring needed.

    Reminder for Andrew (documented in Plan 07's README): the seed needs `SANITY_API_TOKEN` to be added to `apps/studio/.env.local` BEFORE running. Plan 07 captures this in `apps/studio/README.md`.
  </action>
  <verify>
    <automated>test -f apps/studio/scripts/seed-agents.ts && grep -q "createOrReplace" apps/studio/scripts/seed-agents.ts && grep -q "agent-" apps/studio/scripts/seed-agents.ts && grep -q "SANITY_API_TOKEN" apps/studio/scripts/seed-agents.ts && grep -q "agents.json" apps/studio/scripts/seed-agents.ts && grep -q "_type: 'agentProfile'" apps/studio/scripts/seed-agents.ts && grep -q "_type: 'slug'" apps/studio/scripts/seed-agents.ts && grep -q "apiVersion: '2024-01-01'" apps/studio/scripts/seed-agents.ts</automated>
  </verify>
  <done>
    - `apps/studio/scripts/seed-agents.ts` exists and uses `@sanity/client`'s `createOrReplace` with deterministic `_id` of the form `agent-{agentId}`
    - Script validates the 14-entry shape and canonical order before writing
    - Script provides a helpful error if `SANITY_API_TOKEN` is missing
    - Script writes documents with the correct `_type: 'agentProfile'` and slug-shaped `agentId` field
    - Script is invoked by `pnpm --filter studio seed:agents` (wired in Plan 03's `package.json`)
  </done>
</task>

</tasks>

<verification>
After both tasks (and after Andrew has added `SANITY_API_TOKEN` to `apps/studio/.env.local` per Plan 07's README):
- `pnpm --filter studio seed:agents` exits 0
- Sanity Studio (`pnpm dev:studio`) shows 14 agentProfile documents in the sidebar's "Agent Profile" list
- Each document's `_id` is of the form `agent-{agentId}` (visible at https://www.sanity.io/manage > project > Datasets > production)
- Re-running `pnpm --filter studio seed:agents` exits 0 with no duplicate documents created
- `apps/studio/scripts/agents.json` parses as valid JSON and contains all 14 canonical agentIds in order

Note: This plan does NOT require live execution of the seed during plan completion — Plan 07 handles the smoke-test instructions for Andrew. The script's correctness is verified by inspecting the file and confirming `agents.json` matches the canonical contract.
</verification>

<success_criteria>
- All 14 canonical agentIds are present in `agents.json` in the documented order
- Seed copy is on-voice (Jesse — dry, precise, no winking) so Phase 9's deliberation layer renders correctly without rewrite
- `seed-agents.ts` is idempotent via deterministic `_id` and `createOrReplace`
- Missing-env-var failures produce actionable error messages instead of cryptic stack traces
</success_criteria>

<output>
After completion, create `.planning/phases/01-sanity-foundation/01-06-SUMMARY.md` recording the 14 canonical agentIds, the deterministic _id pattern, and a one-line note that Andrew runs `pnpm seed:agents` after adding `SANITY_API_TOKEN` to `apps/studio/.env.local` (full instructions land in Plan 07's README).
</output>
