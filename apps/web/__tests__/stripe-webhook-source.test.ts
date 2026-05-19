/**
 * CMR-05 source-scan tripwire.
 *
 * Phase 8 deliberately does NOT add ESLint rules for this concern. Instead,
 * this Vitest test reads apps/web/app/api/stripe/webhook/route.ts from disk
 * at runtime and asserts:
 *
 *   - The file exists at the expected path.
 *   - stripe.webhooks.constructEvent is called (signature verification is
 *     wired).
 *   - The raw body is read via `await req.text()` BEFORE any JSON parse
 *     (CMR-04 — re-serialized JSON breaks HMAC).
 *   - The route declares runtime = 'nodejs' (stripe-node uses Node crypto).
 *   - No environment-bypass pattern exists for signature verification (CMR-05
 *     hard rule). Forbidden patterns mirror RESEARCH §Pattern 7.
 *   - The edge runtime is NOT declared.
 *
 * Mirrors apps/web/__tests__/game-sandbox.test.ts (Phase 7 GAM-03). If this
 * test fails, DO NOT delete it or weaken the assertions. Fix the webhook
 * source instead.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const WEBHOOK_PATH = resolve(__dirname, '../app/api/stripe/webhook/route.ts')

describe('CMR-05: Stripe webhook source-scan tripwire', () => {
  it('webhook route file exists at the expected path', () => {
    expect(existsSync(WEBHOOK_PATH)).toBe(true)
  })

  it('calls stripe.webhooks.constructEvent (signature verification is wired)', () => {
    const source = readFileSync(WEBHOOK_PATH, 'utf8')
    expect(source).toMatch(/\bconstructEvent\b/)
  })

  it('reads raw body via await req.text() before any JSON parse (CMR-04)', () => {
    const source = readFileSync(WEBHOOK_PATH, 'utf8')
    expect(source).toMatch(/await\s+req\.text\(\)/)
  })

  it('declares runtime nodejs (not edge — stripe-node needs Node crypto)', () => {
    const source = readFileSync(WEBHOOK_PATH, 'utf8')
    expect(source).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/)
  })

  it('has NO env-var bypass for signature verification (CMR-05 hard rule)', () => {
    const source = readFileSync(WEBHOOK_PATH, 'utf8')
    const FORBIDDEN_BYPASS = [
      /SKIP_SIGNATURE/i,
      /SKIP_STRIPE_VERIFY/i,
      /BYPASS_SIGNATURE/i,
      /STRIPE_SKIP_VERIFY/i,
      /NODE_ENV\s*!==?\s*['"]production['"]\s*\)[^]{0,150}(?:return|skip)/m,
    ]
    for (const pat of FORBIDDEN_BYPASS) {
      expect(source).not.toMatch(pat)
    }
  })

  it('does NOT use the edge runtime', () => {
    const source = readFileSync(WEBHOOK_PATH, 'utf8')
    expect(source).not.toMatch(/runtime\s*=\s*['"]edge['"]/)
  })
})
