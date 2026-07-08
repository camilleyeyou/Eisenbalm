import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemas'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'

if (!projectId) {
  throw new Error(
    'Missing SANITY_STUDIO_PROJECT_ID. ' +
    'Run `npx sanity@latest init` (see apps/studio/README.md) and ' +
    'populate apps/studio/.env.local before starting the Studio.',
  )
}

export default defineConfig({
  name: 'eisenbalm-dispatch',
  title: 'The Eisenbalm Dispatch',
  projectId,
  dataset,
  plugins: [
    structureTool(),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
  },
  document: {
    actions: (prev, context) => {
      // Phase 34 (§34.9, PUB-03, D-10) — remove Studio's publish button for
      // weeklyIssue once the soak ends. Flag defaults OFF; flipping it +
      // redeploying Studio is the only change to end the soak (D-11). The
      // webhook re-check (§34.5) protects the gate regardless of flag state.
      const disablePublish = process.env.SANITY_STUDIO_DISABLE_PUBLISH === 'true'
      if (disablePublish && context.schemaType === 'weeklyIssue') {
        return prev.filter(({ action }) => action !== 'publish')
      }
      return prev
    },
  },
})
