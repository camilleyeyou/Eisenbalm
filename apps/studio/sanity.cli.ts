import { defineCliConfig } from 'sanity/cli'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  // Sanity v5 TypeGen — finalized in Plan 05.
  // Plan 05 adds the explicit `schema: { path: './schema.json' }` block that
  // `sanity schema extract` reads, then `sanity typegen generate` consumes
  // schema.json and emits apps/studio/sanity.types.ts.
  // Files: schema.json (intermediate, gitignored)
  //        sanity.types.ts (committed per D-08, D-14).
})
