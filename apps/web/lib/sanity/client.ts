/**
 * Sanity client factory.
 *
 * Two clients per CONTEXT.md D-14:
 *   - sanityClient: runtime reads (useCdn: true) for fast, cached editorial reads.
 *   - sanityBuildClient: build-time / Publisher webhook context (useCdn: false)
 *     so freshly-published content bypasses the Sanity CDN.
 *
 * Phase 6's Publisher webhook (Sanity → Railway) will import sanityBuildClient
 * to read the just-published issue for PDF generation.
 */
import { createClient, type SanityClient } from '@sanity/client'

export const SANITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? ''
export const SANITY_DATASET =
  process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
// Pin api version — bump only after testing GROQ behavior on new dates.
export const SANITY_API_VERSION = '2024-01-01'

if (!SANITY_PROJECT_ID) {
  // Fast-fail at module load so misconfiguration surfaces early.
  // Mirrors the pattern landed in apps/studio/sanity.config.ts (Phase 1).
  // Use console.error rather than throw so build/dev still surfaces the
  // error message to the developer without crashing the whole Next.js
  // server on a transient missing env (e.g. preview environments).
  console.error(
    '[sanity/client] NEXT_PUBLIC_SANITY_PROJECT_ID is not set. ' +
      'Copy apps/web/.env.example to apps/web/.env.local and fill in the project ID.',
  )
}

/**
 * Runtime client — used by all RSC page components and Route Handlers
 * (sitemap.xml, feed.xml). CDN-cached for low-latency reads.
 */
export const sanityClient: SanityClient = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: SANITY_API_VERSION,
  useCdn: true,
  perspective: 'published',
})

/**
 * Build-time / Publisher webhook client — bypasses CDN. Use only when
 * freshness matters more than latency (Phase 6 PDF generation, build-time
 * static generation if we discover CDN propagation race issues).
 */
export const sanityBuildClient: SanityClient = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: SANITY_API_VERSION,
  useCdn: false,
  perspective: 'published',
})
