import { defineCliConfig } from 'sanity/cli'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  // ─── Sanity v5 TypeGen ────────────────────────────────────────────
  // `pnpm schema:extract` runs `sanity schema extract --enforce-required-fields`,
  // which reads `schema.path` below and writes apps/studio/schema.json
  // (gitignored intermediate artifact).
  //
  // `pnpm typegen` runs schema:extract first (per package.json) then
  // `sanity typegen generate`, which reads schema.json and emits
  // apps/studio/sanity.types.ts to the package root (Sanity's default
  // typegen output location — no separate config needed).
  //
  // The generated sanity.types.ts is committed to git (per D-08, D-14)
  // so CI/dev parity is guaranteed. schema.json is an intermediate
  // build artifact and is gitignored.
  schema: {
    path: './schema.json',
  },
  graphql: [],
})
