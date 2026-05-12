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
