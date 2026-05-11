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
})
