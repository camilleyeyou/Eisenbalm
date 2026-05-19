/**
 * CMR-03 source-scan: /shop/thank-you must NOT query the DB.
 *
 * Reads apps/web/app/shop/thank-you/page.tsx and asserts the file does not
 * import or call any DB/HTTP client. The webhook is the authoritative
 * fulfillment event; the thank-you page is decorative confirmation only.
 *
 * Loading state on this page would create the very flicker CMR-01 forbids,
 * and querying by session_id invites enumeration attacks.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const THANK_YOU_PATH = resolve(__dirname, '../app/shop/thank-you/page.tsx')

describe('CMR-03: /shop/thank-you must NOT query the DB', () => {
  it('thank-you page file exists at the expected path', () => {
    expect(existsSync(THANK_YOU_PATH)).toBe(true)
  })

  it('does NOT import from @sanity/client or @/lib/sanity (no Sanity read)', () => {
    const source = readFileSync(THANK_YOU_PATH, 'utf8')
    expect(source).not.toMatch(/from\s+['"]@sanity\/client['"]/)
    expect(source).not.toMatch(/from\s+['"]@\/lib\/sanity/)
    expect(source).not.toMatch(/sanityClient\.fetch/)
  })

  it('does NOT import convex modules (no Convex query)', () => {
    const source = readFileSync(THANK_YOU_PATH, 'utf8')
    expect(source).not.toMatch(/from\s+['"]convex\//)
    expect(source).not.toMatch(/from\s+['"]@convex\//)
    expect(source).not.toMatch(/ConvexHttpClient/)
    expect(source).not.toMatch(/convex\.(query|mutation)/)
  })

  it('does NOT call fetch() (no arbitrary HTTP)', () => {
    const source = readFileSync(THANK_YOU_PATH, 'utf8')
    // The thank-you page is decorative; if you need fetch you're doing it wrong.
    expect(source).not.toMatch(/\bfetch\s*\(/)
  })

  it('does NOT call stripe.checkout.sessions.retrieve (no Stripe API call)', () => {
    const source = readFileSync(THANK_YOU_PATH, 'utf8')
    expect(source).not.toMatch(/sessions\.retrieve/)
    expect(source).not.toMatch(/stripe\.checkout/)
  })
})
