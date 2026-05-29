/**
 * Phase 16 — idempotent narrator seed (Plan 16-08a Task 2).
 *
 * Reads apps/studio/seeds/narrators.json and upserts each record via
 * Sanity client.createOrReplace with a deterministic _id: `narrator-${slug}`
 * (matches the Phase 1 agentProfile naming convention from seed-agents.ts).
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
 *   pnpm --filter studio seed:narrators:dry-run   # validate JSON only
 *
 * Requires SANITY_STUDIO_PROJECT_ID + SANITY_API_TOKEN (write access) loaded
 * from apps/studio/.env.local via `tsx --env-file=.env.local`.
 */
import { createClient } from '@sanity/client'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const seedPath = resolve(__dirname, '..', 'seeds', 'narrators.json')

/**
 * Canonical narratorProfile field surface (Plan 16-01 + CONTEXT D-08).
 * Use exactly: name, slug, voiceConstraints, voiceRubric, exampleSamples,
 * active. No legacy display-name / status-string / structured-rubric
 * variants — those were wrong-schema artifacts of an earlier revision.
 */
interface NarratorSeed {
  slug: string
  name: string
  active: boolean
  voiceConstraints: string
  voiceRubric: string
  exampleSamples: string[]
}

interface SeedFile {
  narrators: NarratorSeed[]
}

const dryRun = process.argv.includes('--dry-run')

function fail(message: string): never {
  console.error(`\n✗ seed-narrators: ${message}\n`)
  process.exit(1)
}

// ─── Validation ──────────────────────────────────────────────────────────
function validate(record: unknown, index: number): NarratorSeed {
  if (typeof record !== 'object' || record === null) {
    fail(`narrators[${index}] is not an object`)
  }
  const r = record as Record<string, unknown>
  const ctx = `narrators[${index}] (slug="${String(r.slug ?? '<missing>')}")`

  if (typeof r.slug !== 'string' || r.slug.length === 0) {
    fail(`${ctx}: slug must be a non-empty string`)
  }
  if (typeof r.name !== 'string' || r.name.trim().length === 0) {
    fail(`${ctx}: name must be a non-empty string (canonical field — see Plan 16-01)`)
  }
  if (typeof r.active !== 'boolean') {
    fail(`${ctx}: active must be a boolean (NOT a "active"|"inactive" string)`)
  }
  if (typeof r.voiceConstraints !== 'string' || r.voiceConstraints.trim().length === 0) {
    fail(`${ctx}: voiceConstraints must be a non-empty string`)
  }
  if (typeof r.voiceRubric !== 'string' || r.voiceRubric.trim().length === 0) {
    fail(
      `${ctx}: voiceRubric must be a non-empty plain string ` +
        `(NOT a structured {register, cadence, constraints} object — that was a wrong-schema artifact of an earlier revision)`,
    )
  }
  if (!Array.isArray(r.exampleSamples) || r.exampleSamples.length === 0) {
    fail(`${ctx}: exampleSamples must be a non-empty array of strings`)
  }
  for (let i = 0; i < r.exampleSamples.length; i++) {
    const s = r.exampleSamples[i]
    if (typeof s !== 'string' || s.length === 0) {
      fail(`${ctx}: exampleSamples[${i}] must be a non-empty string (NOT Portable Text)`)
    }
  }
  return r as unknown as NarratorSeed
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // 1. Read + parse the seed JSON.
  let raw: string
  try {
    raw = readFileSync(seedPath, 'utf-8')
  } catch (err) {
    fail(`Failed to read ${seedPath}: ${(err as Error).message}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    fail(`Failed to parse ${seedPath}: ${(err as Error).message}`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    fail(`${seedPath}: expected a top-level object {"narrators": [...]}`)
  }
  const data = parsed as Partial<SeedFile>
  if (!Array.isArray(data.narrators)) {
    fail(`${seedPath}: expected a "narrators" array at the top level`)
  }

  // 2. Validate every record before touching the network.
  const records: NarratorSeed[] = data.narrators.map((r, i) => validate(r, i))
  console.log(`Validated ${records.length} narrator seed record(s):`)
  for (const n of records) {
    console.log(
      `  - narrator-${n.slug} (${n.name}) — ${n.exampleSamples.length} sample(s), active=${n.active}`,
    )
  }

  if (dryRun) {
    console.log('\n[dry-run] Validation only. No writes performed.')
    return
  }

  // 3. Load env. Same env-var names as seed-agents.ts so .env.local is shared.
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID
  const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'
  const token = process.env.SANITY_API_TOKEN

  if (!projectId) {
    fail(
      'Missing SANITY_STUDIO_PROJECT_ID. Populate apps/studio/.env.local ' +
        '(see apps/studio/.env.example) or pass --dry-run to validate without writes.',
    )
  }
  if (!token) {
    fail(
      'Missing SANITY_API_TOKEN. Create a write-scoped token at ' +
        'https://www.sanity.io/manage > project > API > Tokens (Editor role) ' +
        'and add it to apps/studio/.env.local as SANITY_API_TOKEN=...',
    )
  }

  console.log(
    `\nSeeding ${records.length} narratorProfile documents into ${projectId}/${dataset}…`,
  )

  // 4. Create the client. apiVersion + useCdn match seed-agents.ts.
  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2024-01-01',
    useCdn: false,
  })

  // 5. Upsert each record. createOrReplace keyed by deterministic
  //    _id=`narrator-${slug}` makes repeat runs idempotent.
  let succeeded = 0
  for (const n of records) {
    const _id = `narrator-${n.slug}`
    try {
      await client.createOrReplace({
        _id,
        _type: 'narratorProfile',
        name: n.name,
        slug: { _type: 'slug', current: n.slug },
        voiceConstraints: n.voiceConstraints,
        voiceRubric: n.voiceRubric,
        exampleSamples: n.exampleSamples,
        active: n.active,
      })
      succeeded += 1
      console.log(`  ✓ ${_id} (${n.name})`)
    } catch (err) {
      console.error(`  ✗ ${_id}: ${(err as Error).message}`)
      throw err
    }
  }

  console.log(
    `\nSeeded ${succeeded}/${records.length} narratorProfile documents.\n` +
      `Verify in Sanity Studio:\n` +
      `  - Narrator Profile list shows all 3 documents.\n` +
      `  - The default (narrator-jesse) is present and active.\n` +
      `  - exampleSamples render as plain-text strings (no JSON blobs, no Portable Text blocks).`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
