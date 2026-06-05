/**
 * Pure GROQ query builders for charity personalization in email steps.
 *
 * No fetch — these build query strings only. Fetching happens in the
 * Convex internalAction (emailActions.ts). All slug/date interpolations
 * defensively strip `"` to prevent GROQ injection.
 *
 * Exports:
 *   buildFundedCharityQuery  — steps 1-6: the charity this order funded
 *   buildOtherCharitiesQuery — step 7: 2-3 OTHER recently-featured charities
 *   buildFundedSinceCountQuery — step 8: count of issues published since order
 *   orderMsToIsoDate         — convert Unix ms timestamp to YYYY-MM-DD
 */

function sanitize(value: string): string {
  return value.replace(/"/g, '')
}

/**
 * Build a GROQ query to fetch the charity that funded this order (steps 1-6).
 * Returns null when charitySlug is falsy — callers should skip the fetch.
 */
export function buildFundedCharityQuery(
  charitySlug: string | undefined | null,
): string | null {
  if (!charitySlug) return null
  const s = sanitize(charitySlug)
  return `*[_type == "charity" && slug.current == "${s}"][0]{name, location, focusArea, missionStatement}`
}

/**
 * Build a GROQ query to fetch 2-3 OTHER recently-featured charities (step 7).
 * Excludes the buyer's own slug — shows charities the buyer hasn't funded yet.
 * When charitySlug is undefined, excludes an empty string (no-op exclusion).
 */
export function buildOtherCharitiesQuery(
  charitySlug: string | undefined | null,
): string {
  const s = sanitize(charitySlug ?? '')
  return (
    `*[_type == "weeklyIssue" && status == "published" && charity->slug.current != "${s}"]` +
    ` | order(issueNumber desc)[0...3]` +
    `{ "charity": charity->{name, "slug": slug.current, location, focusArea, missionStatement} }`
  )
}

/**
 * Build a GROQ count query for issues published AFTER the order date (step 8).
 * Returns a count of weeklyIssues with publishDate > orderDateIso.
 */
export function buildFundedSinceCountQuery(orderDateIso: string): string {
  const d = sanitize(orderDateIso)
  return `count(*[_type == "weeklyIssue" && status == "published" && publishDate > "${d}"])`
}

/**
 * Convert a Unix millisecond timestamp to a YYYY-MM-DD ISO date string.
 * Used to build the orderDateIso argument for buildFundedSinceCountQuery.
 */
export function orderMsToIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
