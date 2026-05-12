/**
 * Site-level constants. Used by metadata, sitemap, RSS, JSON-LD.
 *
 * Voice: Jesse's register — dry, factual, no exclamation marks. SITE_DESCRIPTION
 * is the single-sentence tagline reused across <meta description>, OG, Twitter,
 * RSS channel description, and the homepage empty state.
 */
export const SITE_NAME = 'The Eisenbalm Dispatch'
export const SITE_AUTHOR = 'Jesse A. Eisenbalm'
export const SITE_DESCRIPTION = 'A weekly editorial on one obscure charity. One product. 100% donated.'

/**
 * Read the canonical site URL from env. Falls back to localhost for dev.
 * Plan 02-01 documents this var in apps/web/.env.example.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  return raw && raw.length > 0 ? raw : 'http://localhost:3000'
}
