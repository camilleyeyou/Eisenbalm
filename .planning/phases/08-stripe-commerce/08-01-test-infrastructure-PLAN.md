---
phase: 08-stripe-commerce
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/web/__tests__/shop-page.test.ts
  - apps/web/__tests__/checkout-create-session.test.ts
  - apps/web/__tests__/thank-you-source.test.ts
  - apps/web/__tests__/stripe-webhook.test.ts
  - apps/web/__tests__/stripe-webhook-source.test.ts
  - apps/web/__tests__/stripe-webhook-idempotency.test.ts
  - apps/web/__tests__/legal-pages.test.ts
  - apps/web/__tests__/issue-page-shop-callout.test.ts
autonomous: true
requirements:
  - CMR-01
  - CMR-02
  - CMR-03
  - CMR-04
  - CMR-05
  - CMR-06
  - CMR-07
  - CMR-08
  - CMR-09
  - CMR-10
must_haves:
  truths:
    - "Eight Vitest test files exist in apps/web/__tests__/ with executable describe/it blocks (no syntax errors)"
    - "Every test file references its target requirement (CMR-NN) in a describe block or comment"
    - "Source-scan tests (stripe-webhook-source, thank-you-source, issue-page-shop-callout) use fs.readFileSync against an absolute path to the file under test"
    - "Tests for files not yet created use describe.skip OR have a fail-fast assertion that documents the missing file path"
    - "Running `pnpm --filter web test:unit` exits non-zero (because target files do not yet exist) — this is expected Wave 0 behavior"
  artifacts:
    - path: "apps/web/__tests__/stripe-webhook-source.test.ts"
      provides: "CMR-05 source-scan tripwire; mirrors Phase 7 game-sandbox.test.ts shape"
      contains: "FORBIDDEN_BYPASS"
    - path: "apps/web/__tests__/stripe-webhook.test.ts"
      provides: "CMR-04 signature verification unit test"
      contains: "stripe.webhooks.generateTestHeaderString"
    - path: "apps/web/__tests__/checkout-create-session.test.ts"
      provides: "CMR-02 + CMR-10 session create assertion"
      contains: "shipping_address_collection"
    - path: "apps/web/__tests__/thank-you-source.test.ts"
      provides: "CMR-03 no-DB-query source-scan"
      contains: "thank-you"
    - path: "apps/web/__tests__/stripe-webhook-idempotency.test.ts"
      provides: "CMR-06 dedup unit test"
      contains: "firstTime"
    - path: "apps/web/__tests__/legal-pages.test.ts"
      provides: "CMR-07 + CMR-08 page existence"
      contains: "legal"
    - path: "apps/web/__tests__/issue-page-shop-callout.test.ts"
      provides: "CMR-09 source-scan asserting ShopCallout is rendered in issue page"
      contains: "ShopCallout"
    - path: "apps/web/__tests__/shop-page.test.ts"
      provides: "CMR-01 server-component assertion"
      contains: "ShopPage"
  key_links:
    - from: "apps/web/__tests__/stripe-webhook-source.test.ts"
      to: "apps/web/app/api/stripe/webhook/route.ts (created in Plan 08-05)"
      via: "readFileSync absolute path resolved via node:path"
      pattern: "api/stripe/webhook/route\\.ts"
    - from: "apps/web/__tests__/issue-page-shop-callout.test.ts"
      to: "apps/web/app/issue/[slug]/page.tsx (Phase 2 — exists)"
      via: "readFileSync grep for ShopCallout component"
      pattern: "ShopCallout"
---

<objective>
Wave 0 Nyquist gate. Create eight Vitest test files that will be wired to passing assertions by Plans 08-04, 08-05, 08-06, 08-07. These tests fail initially (target source files don't exist yet); subsequent plans drive them green one-by-one. This plan is the Wave 0 sentinel that proves every CMR-* requirement has a planned automated check.

Purpose: Establish the test surface BEFORE writing production code so executors of later plans cannot ship without a corresponding verification. Mirrors Phase 7 Plan 07-01 (Wave 0 Vitest stubs) and Phase 6 Plan 06-01 (Wave 0 pytest skeletons).

Output: Eight `.test.ts` files in `apps/web/__tests__/` that load without import errors but currently fail because the target production files do not yet exist. Each test contains the exact assertion shape it will check once the production file lands.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/08-stripe-commerce/08-RESEARCH.md
@.planning/phases/08-stripe-commerce/08-VALIDATION.md
@apps/web/__tests__/game-sandbox.test.ts
@apps/web/__tests__/game-validator.test.ts
@apps/web/vitest.config.ts
@apps/web/package.json

<interfaces>
<!-- Phase 7 Vitest infrastructure (already wired):
       apps/web/vitest.config.ts — node environment, includes __tests__/**/*.test.ts(x)
       apps/web/package.json — "test:unit": "vitest run"
       apps/web/__tests__/game-sandbox.test.ts — canonical source-scan pattern (readFileSync + expect(source).toMatch/not.toMatch)

     This plan emits 8 new test files following the same pattern. They will
     reference target source files at paths that DO NOT YET EXIST:
       apps/web/app/api/stripe/webhook/route.ts        (created in Plan 08-05)
       apps/web/app/api/checkout/create-session/route.ts (created in Plan 08-04)
       apps/web/app/shop/page.tsx                       (rewritten in Plan 08-06)
       apps/web/app/shop/thank-you/page.tsx             (created in Plan 08-07)
       apps/web/app/legal/privacy/page.tsx              (created in Plan 08-07)
       apps/web/app/legal/terms/page.tsx                (created in Plan 08-07)
       apps/web/lib/stripe/server.ts                    (created in Plan 08-04)
       apps/web/lib/stripe/handlers.ts                  (created in Plan 08-05)

     For tests that import production code (vs. source-scan), gate the import
     behind `try { ... } catch { describe.skip }` OR use dynamic `await import()`
     inside the it() body so import failures don't break test collection. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create source-scan + render test stubs (5 files — CMR-01, CMR-03, CMR-05, CMR-07, CMR-08, CMR-09)</name>
  <read_first>
    - apps/web/__tests__/game-sandbox.test.ts (canonical source-scan pattern — readFileSync + expect.toMatch/not.toMatch + path.resolve(__dirname, '../...'))
    - apps/web/app/issue/[slug]/page.tsx (verify ShopCallout import + render call already present from Phase 2)
    - apps/web/app/shop/page.tsx (the current Phase 2 placeholder being rewritten in 08-06)
    - apps/web/vitest.config.ts (confirm environment: node)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 7 (source-scan forbidden-patterns list)
  </read_first>
  <files>apps/web/__tests__/stripe-webhook-source.test.ts, apps/web/__tests__/thank-you-source.test.ts, apps/web/__tests__/issue-page-shop-callout.test.ts, apps/web/__tests__/legal-pages.test.ts, apps/web/__tests__/shop-page.test.ts</files>
  <action>
    Create five Vitest test files. All use `readFileSync` + `path.resolve(__dirname, '../...')` like `apps/web/__tests__/game-sandbox.test.ts` does. Each test file must compile as TypeScript and load without errors; assertions may fail (that's expected — target files don't yet exist).

    **File 1: `apps/web/__tests__/stripe-webhook-source.test.ts` (CMR-05 — the tripwire)**

    Mirror `apps/web/__tests__/game-sandbox.test.ts` exactly. Read `apps/web/app/api/stripe/webhook/route.ts`. Assert four contracts:
    ```typescript
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
    ```

    **File 2: `apps/web/__tests__/thank-you-source.test.ts` (CMR-03 — no DB query)**

    ```typescript
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
        // Allow the literal word fetch in comments/strings? No — be strict.
        // The thank-you page is decorative; if you need fetch you're doing it wrong.
        expect(source).not.toMatch(/\bfetch\s*\(/)
      })

      it('does NOT call stripe.checkout.sessions.retrieve (no Stripe API call)', () => {
        const source = readFileSync(THANK_YOU_PATH, 'utf8')
        expect(source).not.toMatch(/sessions\.retrieve/)
        expect(source).not.toMatch(/stripe\.checkout/)
      })
    })
    ```

    **File 3: `apps/web/__tests__/issue-page-shop-callout.test.ts` (CMR-09 — ShopCallout still rendered)**

    ```typescript
    import { readFileSync, existsSync } from 'node:fs'
    import { resolve } from 'node:path'
    import { describe, it, expect } from 'vitest'

    const ISSUE_PAGE_PATH = resolve(__dirname, '../app/issue/[slug]/page.tsx')
    const SHOP_CALLOUT_PATH = resolve(__dirname, '../components/issue/ShopCallout.tsx')

    describe('CMR-09: Persistent ShopCallout on every issue page', () => {
      it('issue page file exists', () => {
        expect(existsSync(ISSUE_PAGE_PATH)).toBe(true)
      })

      it('ShopCallout component file exists (Phase 2 artifact)', () => {
        expect(existsSync(SHOP_CALLOUT_PATH)).toBe(true)
      })

      it('issue page imports ShopCallout component', () => {
        const source = readFileSync(ISSUE_PAGE_PATH, 'utf8')
        expect(source).toMatch(/import\s+\{\s*ShopCallout\s*\}\s+from\s+['"]@\/components\/issue\/ShopCallout['"]/)
      })

      it('issue page renders <ShopCallout /> in JSX', () => {
        const source = readFileSync(ISSUE_PAGE_PATH, 'utf8')
        expect(source).toMatch(/<ShopCallout\s*(?:\s+[^>]*)?\/?>/)
      })

      it('ShopCallout component does NOT contain banner/modal/popup/countdown patterns (brand voice)', () => {
        const source = readFileSync(SHOP_CALLOUT_PATH, 'utf8')
        expect(source).not.toMatch(/banner/i)
        expect(source).not.toMatch(/modal/i)
        expect(source).not.toMatch(/popup/i)
        expect(source).not.toMatch(/countdown/i)
        // Note: the Phase 2 ShopCallout already passes this check.
      })
    })
    ```

    **File 4: `apps/web/__tests__/legal-pages.test.ts` (CMR-07 + CMR-08)**

    ```typescript
    import { existsSync, readFileSync } from 'node:fs'
    import { resolve } from 'node:path'
    import { describe, it, expect } from 'vitest'

    const PRIVACY_PATH = resolve(__dirname, '../app/legal/privacy/page.tsx')
    const TERMS_PATH = resolve(__dirname, '../app/legal/terms/page.tsx')

    describe('CMR-07: /legal/privacy page exists', () => {
      it('privacy page file exists at the expected path', () => {
        expect(existsSync(PRIVACY_PATH)).toBe(true)
      })

      it('privacy page exports a default React component', () => {
        const source = readFileSync(PRIVACY_PATH, 'utf8')
        expect(source).toMatch(/export\s+default\s+function/)
      })
    })

    describe('CMR-08: /legal/terms page exists', () => {
      it('terms page file exists at the expected path', () => {
        expect(existsSync(TERMS_PATH)).toBe(true)
      })

      it('terms page exports a default React component', () => {
        const source = readFileSync(TERMS_PATH, 'utf8')
        expect(source).toMatch(/export\s+default\s+function/)
      })
    })
    ```

    **File 5: `apps/web/__tests__/shop-page.test.ts` (CMR-01 — server-rendered, no client flicker)**

    ```typescript
    import { readFileSync, existsSync } from 'node:fs'
    import { resolve } from 'node:path'
    import { describe, it, expect } from 'vitest'

    const SHOP_PAGE_PATH = resolve(__dirname, '../app/shop/page.tsx')

    describe('CMR-01: /shop server-rendered with charity callout (no client flicker)', () => {
      it('shop page file exists', () => {
        expect(existsSync(SHOP_PAGE_PATH)).toBe(true)
      })

      it('does NOT declare "use client" at the top of file', () => {
        const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
        // Strip leading comments/whitespace then check first non-comment line.
        const firstNonCommentLine = source
          .split(/\n/)
          .find((l) => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('/*') && !l.trim().startsWith('*'))
        expect(firstNonCommentLine ?? '').not.toMatch(/^['"]use client['"]/)
      })

      it('imports sanityClient (server-side Sanity read)', () => {
        const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
        expect(source).toMatch(/from\s+['"]@\/lib\/sanity\/client['"]/)
      })

      it('exports an async default function (server component)', () => {
        const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
        expect(source).toMatch(/export\s+default\s+async\s+function/)
      })

      it('renders a BuyButton component (client-only purchase trigger)', () => {
        const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
        expect(source).toMatch(/<BuyButton/)
      })

      it('declares ISR with export const revalidate', () => {
        const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
        expect(source).toMatch(/export\s+const\s+revalidate\s*=\s*\d+/)
      })
    })
    ```

    All five files: pure source-scan / fs reads. No Stripe SDK import. No production code import. Tests fail when target file doesn't exist (existsSync returns false → first assertion fails fast).
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/stripe-webhook-source.test.ts __tests__/thank-you-source.test.ts __tests__/issue-page-shop-callout.test.ts __tests__/legal-pages.test.ts __tests__/shop-page.test.ts 2>&1 | tail -30; ls apps/web/__tests__/stripe-webhook-source.test.ts apps/web/__tests__/thank-you-source.test.ts apps/web/__tests__/issue-page-shop-callout.test.ts apps/web/__tests__/legal-pages.test.ts apps/web/__tests__/shop-page.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/__tests__/stripe-webhook-source.test.ts` exits 0
    - `test -f apps/web/__tests__/thank-you-source.test.ts` exits 0
    - `test -f apps/web/__tests__/issue-page-shop-callout.test.ts` exits 0
    - `test -f apps/web/__tests__/legal-pages.test.ts` exits 0
    - `test -f apps/web/__tests__/shop-page.test.ts` exits 0
    - `grep -q "FORBIDDEN_BYPASS" apps/web/__tests__/stripe-webhook-source.test.ts` exits 0
    - `grep -q "constructEvent" apps/web/__tests__/stripe-webhook-source.test.ts` exits 0
    - `grep -q "runtime\\s*=\\s*['\\\"]nodejs['\\\"]" apps/web/__tests__/stripe-webhook-source.test.ts` exits 0
    - `grep -q "@sanity/client" apps/web/__tests__/thank-you-source.test.ts` exits 0 (asserts the IMPORT is absent — pattern appears in the .not.toMatch call)
    - `grep -q "ShopCallout" apps/web/__tests__/issue-page-shop-callout.test.ts` exits 0
    - The CMR-09 test passes immediately because the Phase 2 issue page already imports + renders ShopCallout — verify by running `npx vitest run __tests__/issue-page-shop-callout.test.ts` from apps/web and confirming exit 0
    - The four other tests fail because target files don't yet exist (existsSync returns false) — failures are expected Wave 0 behavior
    - No TypeScript compile errors in any test file (`pnpm --filter web tsc --noEmit` does not regress)
  </acceptance_criteria>
  <done>Five source-scan / render test files exist with the assertions documented above. CMR-09 test is already green (Phase 2 issue page passes); the other four fail until later plans create their target files.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create Stripe SDK + Convex idempotency unit test stubs (3 files — CMR-02, CMR-04, CMR-06, CMR-10)</name>
  <read_first>
    - apps/web/__tests__/game-validator.test.ts (canonical unit test pattern using vitest + dynamic imports + mocking)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 4 (webhook test approach using stripe.webhooks.generateTestHeaderString)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 5 (idempotency claim mutation shape)
    - apps/web/package.json (note: stripe SDK not yet installed — Plan 08-03 installs it)
  </read_first>
  <files>apps/web/__tests__/stripe-webhook.test.ts, apps/web/__tests__/checkout-create-session.test.ts, apps/web/__tests__/stripe-webhook-idempotency.test.ts</files>
  <action>
    Create three Vitest unit test files. These tests dynamically import production code via `await import(...)` inside `it()` bodies so the test files themselves load even when target source + stripe SDK are not yet installed. They use vitest mocking (`vi.mock`, `vi.fn`) to isolate the route handlers from real Stripe / Convex.

    **File 1: `apps/web/__tests__/stripe-webhook.test.ts` (CMR-04 — signature verify uses raw body)**

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest'

    /**
     * Tests construct a synthetic Stripe webhook payload and signature using
     * stripe.webhooks.generateTestHeaderString (a real SDK helper). The route
     * handler must call constructEvent on the raw body and reject mutated bodies.
     */

    describe('CMR-04: Stripe webhook signature verification', () => {
      beforeEach(() => {
        // Ensure required env vars present for the route handler.
        // The webhook secret here is dummy — only generateTestHeaderString
        // needs to know it for the matching pair.
        process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy'
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy_secret_for_unit_tests'
        process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud'
        vi.resetModules()
      })

      it('accepts a valid signature on raw body and returns 200', async () => {
        // Mock convex/browser so handleStripeEvent's Convex mutation never runs
        vi.doMock('convex/browser', () => ({
          ConvexHttpClient: class {
            mutation = vi.fn(async () => ({ firstTime: true }))
          },
        }))
        vi.doMock('@convex/_generated/api', () => ({
          api: { stripeEvents: { claim: 'claim' }, stripeOrders: { insert: 'insert' } },
        }))

        const Stripe = (await import('stripe')).default
        const stripe = new Stripe('sk_test_dummy', { apiVersion: '2025-04-30.basil' as never })
        const payload = JSON.stringify({ id: 'evt_test_1', type: 'checkout.session.completed', data: { object: {} }, livemode: false })
        const timestamp = Math.floor(Date.now() / 1000)
        const sig = stripe.webhooks.generateTestHeaderString({
          payload,
          secret: process.env.STRIPE_WEBHOOK_SECRET!,
          timestamp,
        })

        const { POST } = await import('@/app/api/stripe/webhook/route')
        const req = new Request('http://localhost/api/stripe/webhook', {
          method: 'POST',
          headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
          body: payload,
        })
        const res = await POST(req)
        expect(res.status).toBe(200)
      })

      it('rejects a forged signature with 4xx', async () => {
        vi.doMock('convex/browser', () => ({
          ConvexHttpClient: class { mutation = vi.fn() },
        }))
        vi.doMock('@convex/_generated/api', () => ({ api: { stripeEvents: { claim: 'claim' } } }))

        const { POST } = await import('@/app/api/stripe/webhook/route')
        const req = new Request('http://localhost/api/stripe/webhook', {
          method: 'POST',
          headers: { 'stripe-signature': 't=0,v1=forged_garbage' },
          body: JSON.stringify({ id: 'evt_test_2' }),
        })
        const res = await POST(req)
        expect(res.status).toBeGreaterThanOrEqual(400)
        expect(res.status).toBeLessThan(500)
      })

      it('rejects a missing signature header with 400', async () => {
        vi.doMock('convex/browser', () => ({ ConvexHttpClient: class { mutation = vi.fn() } }))
        vi.doMock('@convex/_generated/api', () => ({ api: { stripeEvents: { claim: 'claim' } } }))

        const { POST } = await import('@/app/api/stripe/webhook/route')
        const req = new Request('http://localhost/api/stripe/webhook', {
          method: 'POST',
          body: '{}',
        })
        const res = await POST(req)
        expect(res.status).toBe(400)
      })

      it('rejects when STRIPE_WEBHOOK_SECRET env var is unset (no bypass — CMR-05)', async () => {
        delete process.env.STRIPE_WEBHOOK_SECRET
        vi.doMock('convex/browser', () => ({ ConvexHttpClient: class { mutation = vi.fn() } }))
        vi.doMock('@convex/_generated/api', () => ({ api: { stripeEvents: { claim: 'claim' } } }))

        const { POST } = await import('@/app/api/stripe/webhook/route')
        const req = new Request('http://localhost/api/stripe/webhook', {
          method: 'POST',
          headers: { 'stripe-signature': 't=0,v1=anything' },
          body: '{}',
        })
        const res = await POST(req)
        // Misconfigured — must NOT silently process; return non-2xx.
        expect(res.status).toBeGreaterThanOrEqual(400)
      })
    })
    ```

    **File 2: `apps/web/__tests__/checkout-create-session.test.ts` (CMR-02 + CMR-10)**

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest'

    describe('CMR-02 + CMR-10: POST /api/checkout/create-session', () => {
      const sessionCreate = vi.fn()

      beforeEach(() => {
        process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
        process.env.STRIPE_PRICE_ID = 'price_test_lipbalm_001'
        process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
        sessionCreate.mockReset()
        sessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_abc' })

        vi.resetModules()
        vi.doMock('@/lib/stripe/server', () => ({
          getStripeServer: () => ({
            checkout: { sessions: { create: sessionCreate } },
          }),
        }))
      })

      it('returns 200 with { url } pointing at Stripe-hosted checkout', async () => {
        const { POST } = await import('@/app/api/checkout/create-session/route')
        const req = new Request('http://localhost/api/checkout/create-session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
        const res = await POST(req)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//)
      })

      it('passes mode=payment, quantity=1, and STRIPE_PRICE_ID to Stripe', async () => {
        const { POST } = await import('@/app/api/checkout/create-session/route')
        await POST(new Request('http://localhost/api/checkout/create-session', { method: 'POST', body: '{}' }))
        expect(sessionCreate).toHaveBeenCalledOnce()
        const args = sessionCreate.mock.calls[0][0]
        expect(args.mode).toBe('payment')
        expect(args.line_items).toEqual([{ price: 'price_test_lipbalm_001', quantity: 1 }])
      })

      it('enables shipping_address_collection (CMR-10)', async () => {
        const { POST } = await import('@/app/api/checkout/create-session/route')
        await POST(new Request('http://localhost/api/checkout/create-session', { method: 'POST', body: '{}' }))
        const args = sessionCreate.mock.calls[0][0]
        expect(args.shipping_address_collection).toBeDefined()
        expect(Array.isArray(args.shipping_address_collection.allowed_countries)).toBe(true)
        expect(args.shipping_address_collection.allowed_countries.length).toBeGreaterThan(0)
      })

      it('sets success_url to /shop/thank-you with {CHECKOUT_SESSION_ID} placeholder', async () => {
        const { POST } = await import('@/app/api/checkout/create-session/route')
        await POST(new Request('http://localhost/api/checkout/create-session', { method: 'POST', body: '{}' }))
        const args = sessionCreate.mock.calls[0][0]
        expect(args.success_url).toContain('/shop/thank-you')
        expect(args.success_url).toContain('{CHECKOUT_SESSION_ID}')
      })

      it('sets cancel_url to /shop', async () => {
        const { POST } = await import('@/app/api/checkout/create-session/route')
        await POST(new Request('http://localhost/api/checkout/create-session', { method: 'POST', body: '{}' }))
        const args = sessionCreate.mock.calls[0][0]
        expect(args.cancel_url).toMatch(/\/shop$/)
      })

      it('returns 500 when STRIPE_PRICE_ID is unset', async () => {
        delete process.env.STRIPE_PRICE_ID
        const { POST } = await import('@/app/api/checkout/create-session/route')
        const res = await POST(new Request('http://localhost/api/checkout/create-session', { method: 'POST', body: '{}' }))
        expect(res.status).toBe(500)
      })
    })
    ```

    **File 3: `apps/web/__tests__/stripe-webhook-idempotency.test.ts` (CMR-06)**

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest'

    /**
     * Idempotency contract: when the Convex claim mutation returns
     * { firstTime: false }, the handler must NOT execute downstream
     * fulfillment logic (no stripeOrders insert).
     */

    describe('CMR-06: Stripe webhook idempotency on event.id', () => {
      const claimMutation = vi.fn()
      const ordersInsert = vi.fn()

      beforeEach(() => {
        process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy_secret_for_unit_tests'
        process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud'
        claimMutation.mockReset()
        ordersInsert.mockReset()
        vi.resetModules()

        vi.doMock('convex/browser', () => ({
          ConvexHttpClient: class {
            constructor(_url: string) {}
            mutation = (ref: unknown, args: unknown) => {
              if (ref === 'claim') return claimMutation(args)
              if (ref === 'insert') return ordersInsert(args)
              return Promise.resolve(null)
            }
          },
        }))
        vi.doMock('@convex/_generated/api', () => ({
          api: { stripeEvents: { claim: 'claim' }, stripeOrders: { insert: 'insert' } },
        }))
      })

      async function buildSignedRequest(eventId: string) {
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe('sk_test_dummy', { apiVersion: '2025-04-30.basil' as never })
        const payload = JSON.stringify({
          id: eventId,
          type: 'checkout.session.completed',
          livemode: false,
          data: { object: { id: 'cs_test_abc', amount_total: 1200, currency: 'usd', customer_details: { email: 'r@example.com' } } },
        })
        const sig = stripe.webhooks.generateTestHeaderString({
          payload,
          secret: process.env.STRIPE_WEBHOOK_SECRET!,
          timestamp: Math.floor(Date.now() / 1000),
        })
        return new Request('http://localhost/api/stripe/webhook', {
          method: 'POST',
          headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
          body: payload,
        })
      }

      it('first delivery: claim returns firstTime=true, fulfillment runs', async () => {
        claimMutation.mockResolvedValue({ firstTime: true })
        const { POST } = await import('@/app/api/stripe/webhook/route')
        const res = await POST(await buildSignedRequest('evt_idem_first'))
        expect(res.status).toBe(200)
        expect(claimMutation).toHaveBeenCalledOnce()
      })

      it('replay: claim returns firstTime=false, fulfillment is SKIPPED', async () => {
        claimMutation.mockResolvedValue({ firstTime: false })
        const { POST } = await import('@/app/api/stripe/webhook/route')
        const res = await POST(await buildSignedRequest('evt_idem_replay'))
        expect(res.status).toBe(200)
        // The replay must NOT trigger ordersInsert.
        expect(ordersInsert).not.toHaveBeenCalled()
      })

      it('claim is called with event.id, event.type, event.livemode', async () => {
        claimMutation.mockResolvedValue({ firstTime: true })
        const { POST } = await import('@/app/api/stripe/webhook/route')
        await POST(await buildSignedRequest('evt_idem_args'))
        const args = claimMutation.mock.calls[0][0]
        expect(args.eventId).toBe('evt_idem_args')
        expect(args.eventType).toBe('checkout.session.completed')
        expect(typeof args.livemode).toBe('boolean')
      })
    })
    ```

    These three test files require:
    - `stripe` npm package installed (Plan 08-03 installs it). Until then, dynamic `await import('stripe')` will throw at test runtime → tests fail. The files themselves load (no top-level import errors) because all stripe usage is inside `await import()`.
    - Production route handlers at `apps/web/app/api/stripe/webhook/route.ts` and `apps/web/app/api/checkout/create-session/route.ts` (created in 08-04 and 08-05).
    - `apps/web/lib/stripe/server.ts` (created in 08-04).
  </action>
  <verify>
    <automated>ls apps/web/__tests__/stripe-webhook.test.ts apps/web/__tests__/checkout-create-session.test.ts apps/web/__tests__/stripe-webhook-idempotency.test.ts && grep -q "generateTestHeaderString" apps/web/__tests__/stripe-webhook.test.ts && grep -q "shipping_address_collection" apps/web/__tests__/checkout-create-session.test.ts && grep -q "firstTime" apps/web/__tests__/stripe-webhook-idempotency.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/__tests__/stripe-webhook.test.ts` exits 0
    - `test -f apps/web/__tests__/checkout-create-session.test.ts` exits 0
    - `test -f apps/web/__tests__/stripe-webhook-idempotency.test.ts` exits 0
    - `grep -q "generateTestHeaderString" apps/web/__tests__/stripe-webhook.test.ts` exits 0
    - `grep -q "shipping_address_collection" apps/web/__tests__/checkout-create-session.test.ts` exits 0
    - `grep -q "mode === 'payment'\\|mode: 'payment'\\|mode.*payment" apps/web/__tests__/checkout-create-session.test.ts` exits 0
    - `grep -q "firstTime" apps/web/__tests__/stripe-webhook-idempotency.test.ts` exits 0
    - `grep -q "vi.doMock" apps/web/__tests__/stripe-webhook-idempotency.test.ts` exits 0
    - All three test files load (no syntax errors) — running `npx vitest run __tests__/stripe-webhook.test.ts` from apps/web returns either pass results OR runtime failures (NOT collection errors that show "PARSE ERROR" or "TypeError: Cannot read property of undefined" at the top level)
    - Tests currently FAIL at runtime because target route handlers and `stripe` SDK do not exist yet — failure mode acceptable for Wave 0
  </acceptance_criteria>
  <done>Three unit test files exist with vitest assertions for CMR-02, CMR-04, CMR-06, CMR-10. Files load without import errors; runtime failures are expected until later plans wire in production code and the Stripe SDK.</done>
</task>

</tasks>

<verification>
After both tasks complete:
- 8 test files exist in apps/web/__tests__/
- `pnpm --filter web test:unit` runs all 8 (plus pre-existing Phase 7 game tests) without collection errors
- CMR-09 test (issue-page-shop-callout) passes immediately because Phase 2 ShopCallout is already in place
- The other 7 fail because target source files don't exist — this is the Wave 0 sentinel state
- No TypeScript errors: `pnpm --filter web typecheck` exits 0
</verification>

<success_criteria>
- Every CMR-NN requirement has at least one test file referencing it (by name or by source-scan target)
- Source-scan tests for CMR-03 and CMR-05 mirror Phase 7's `game-sandbox.test.ts` pattern verbatim (readFileSync + expect.toMatch/not.toMatch)
- Unit tests for CMR-02, CMR-04, CMR-06, CMR-10 use vitest's `vi.doMock` + dynamic `await import()` so the test files load even when production code is absent
- Wave 0 establishes the exact set of automated checks that subsequent plans (08-04 through 08-07) drive to green
</success_criteria>

<output>
After completion, create `.planning/phases/08-stripe-commerce/08-01-test-infrastructure-SUMMARY.md` recording:
- The 8 files created and their assertion counts
- Which test (if any) already passes (expect: issue-page-shop-callout — Phase 2 inheritance)
- The current Vitest run output (counts of pass/fail/skipped)
- Confirmation that the CMR-05 source-scan FORBIDDEN_BYPASS list matches RESEARCH §Pattern 7
</output>
</content>
