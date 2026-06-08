/**
 * CMR-03 REFINED source-scan: /shop/thank-you contract.
 *
 * The thank-you page MAY do a server-side Sanity read of the current
 * featured charity (to name the beneficiary inline). It MUST NOT:
 *   - look anything up by session_id (invites enumeration attacks)
 *   - import or call any Convex client
 *   - call the Stripe API
 *
 * The webhook at /api/stripe/webhook remains the authoritative fulfillment
 * event. The Sanity read is purely editorial — naming the cause the buyer
 * just funded — and does not touch order or session data.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const THANK_YOU_PATH = resolve(__dirname, '../app/shop/thank-you/page.tsx')

describe('CMR-03: /shop/thank-you refined contract', () => {
  it('thank-you page file exists at the expected path', () => {
    expect(existsSync(THANK_YOU_PATH)).toBe(true)
  })

  it('does NOT import convex modules (no Convex query)', () => {
    const source = readFileSync(THANK_YOU_PATH, 'utf8')
    expect(source).not.toMatch(/from\s+['"]convex\//)
    expect(source).not.toMatch(/from\s+['"]@convex\//)
    expect(source).not.toMatch(/ConvexHttpClient/)
    expect(source).not.toMatch(/convex\.(query|mutation)/)
  })

  it('does NOT call stripe.checkout.sessions.retrieve (no Stripe API call)', () => {
    const source = readFileSync(THANK_YOU_PATH, 'utf8')
    expect(source).not.toMatch(/sessions\.retrieve/)
    expect(source).not.toMatch(/stripe\.checkout/)
  })

  it('does NOT call a raw global fetch() — no arbitrary HTTP; sanityClient.fetch is allowed', () => {
    const source = readFileSync(THANK_YOU_PATH, 'utf8')
    // Bans bare global fetch( but not sanityClient.fetch( or similar method calls.
    expect(source).not.toMatch(/(?<![.\w])fetch\s*\(/)
  })

  it('does NOT reference session_id (no session-based lookup)', () => {
    const source = readFileSync(THANK_YOU_PATH, 'utf8')
    // session_id lookups are forbidden — they invite enumeration attacks.
    // Task 1 removes the searchParams param entirely, so this string must not appear.
    expect(source).not.toMatch(/session_id/)
  })
})
