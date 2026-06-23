/**
 * SERVER ONLY — never import from a 'use client' component (carries SANITY_API_TOKEN).
 *
 * Sanity previewDrafts client for the token-guarded preview route (Plan 26-04).
 * Uses the `previewDrafts` perspective so DRAFT documents are readable before
 * they are published. The SANITY_API_TOKEN must be a read-only Viewer token
 * (Sanity manage → API → Tokens) — it is never exposed to the browser.
 */
import { createClient } from '@sanity/client'
import { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION } from './client'

export const sanityPreviewClient = createClient({
  projectId: SANITY_PROJECT_ID || 'placeholder',
  dataset: SANITY_DATASET,
  apiVersion: SANITY_API_VERSION,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
  perspective: 'previewDrafts',
})
