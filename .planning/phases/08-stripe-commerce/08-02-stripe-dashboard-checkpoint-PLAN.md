---
phase: 08-stripe-commerce
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/.env.local
autonomous: false
requirements:
  - CMR-02
  - CMR-04
  - CMR-10
must_haves:
  truths:
    - "Andrew has logged into the Stripe Dashboard in test mode and created a Product representing Jesse A. Eisenbalm lip balm"
    - "A Price exists with id matching pattern `price_test_<id>`; Andrew has recorded it for STRIPE_PRICE_ID env var"
    - "At least one Shipping Rate is configured in the Stripe Dashboard (Settings -> Shipping)"
    - "A test-mode Webhook Endpoint exists at the planned deployed URL (or a placeholder URL for local dev) with `checkout.session.completed` and `payment_intent.payment_failed` events subscribed"
    - "Andrew has recorded STRIPE_SECRET_KEY (sk_test_...) and STRIPE_WEBHOOK_SECRET (whsec_...) into apps/web/.env.local — gitignored, never committed"
    - "STRIPE_PRICE_ID env var value matches the Stripe Dashboard price id exactly"
    - "If Andrew is testing locally, the Stripe CLI is installed and `stripe login` succeeds"
  artifacts:
    - path: "apps/web/.env.local"
      provides: "Local-only Stripe secrets resolved from Stripe Dashboard"
      contains: "STRIPE_SECRET_KEY="
  key_links:
    - from: "apps/web/.env.local"
      to: "Stripe Dashboard (test mode)"
      via: "STRIPE_PRICE_ID matches the Dashboard Price object's id"
      pattern: "STRIPE_PRICE_ID=price_[a-zA-Z0-9_]+"
    - from: "apps/web/.env.local"
      to: "Stripe Webhook Endpoint"
      via: "STRIPE_WEBHOOK_SECRET matches the signing secret shown for the configured endpoint"
      pattern: "STRIPE_WEBHOOK_SECRET=whsec_[a-zA-Z0-9]+"
---

<objective>
Capture Andrew's mandatory manual setup in the Stripe Dashboard before Phase 8 runtime tests can pass. This step provisions the four Dashboard-side artifacts that no CLI/API can fully automate:

1. Product + Price (Jesse A. Eisenbalm lip balm)
2. Shipping rate(s) (CMR-10)
3. Webhook endpoint configuration (CMR-04)
4. API key generation (test-mode secret + webhook signing secret)

This plan is `autonomous: false`. It is the equivalent of Phase 1 Plan 01-02 (Sanity init), Phase 3 Plan 03-02 (Convex init), and Phase 4 Plan 04-12 (Railway provisioning) — the Dashboard work blocks real end-to-end testing but does NOT block code landing in earlier waves. The Wave 0 mocked tests (Plan 08-01) run without these credentials; the Andrew UAT in Plan 08-08 requires them.

Purpose: Honors STATE.md's existing Phase 6 carryover blocker ("Andrew must configure Stripe product, price ID, and shipping rates in the Stripe dashboard before Phase 8 code can complete"). Provisions CMR-02 (Price), CMR-04 (Webhook secret), CMR-10 (Shipping rates).

Output: A populated `apps/web/.env.local` (gitignored) with all four Stripe env vars, and a Stripe Dashboard configuration that the deployed app can talk to.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/08-stripe-commerce/08-RESEARCH.md
@apps/web/.env.example
@.planning/phases/01-sanity-foundation/01-02-sanity-init-checkpoint-PLAN.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew configures Stripe Dashboard + writes secrets to apps/web/.env.local</name>
  <read_first>
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Environment Availability (the dependency table flags "Stripe Dashboard config: product, price, shipping rates — NOT YET CREATED — BLOCKING")
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Don't Hand-Roll (note that Andrew configures rates in Dashboard, code only sets `shipping_address_collection.allowed_countries`)
    - .planning/STATE.md Blockers/Concerns section (existing Phase 6 carryover blocker about Stripe Dashboard setup)
  </read_first>
  <files>apps/web/.env.local (gitignored; populate with Stripe values)</files>
  <action>This is a checkpoint:human-action task — Andrew performs the manual Stripe Dashboard setup documented in <files>apps/web/.env.local (gitignored; populate with Stripe values)</files>lt;how-to-verify<files>apps/web/.env.local (gitignored; populate with Stripe values)</files>gt; below. The executor pauses; the action IS the runbook in <files>apps/web/.env.local (gitignored; populate with Stripe values)</files>lt;how-to-verify<files>apps/web/.env.local (gitignored; populate with Stripe values)</files>gt;. After Andrew approves, the executor resumes and the SUMMARY captures the outcome.</action>
  <what-built>
    Plan 08-01 created Wave 0 test stubs that can run with mocked Stripe SDK. Subsequent plans (08-03 through 08-07) write production code that ALSO runs against mocked Stripe in unit tests. None of those plans REQUIRE Andrew to finish Dashboard setup first. However, Andrew's UAT smoke (Plan 08-08) and any real test purchase requires the Stripe Dashboard to be configured. This plan does that setup and records the resulting secrets so the deployed app + local dev can both talk to Stripe.
  </what-built>
  <how-to-verify>
    Andrew, please complete the following steps in order. The executor will resume only after you confirm.

    **Prerequisites**
    1. You have access to a Stripe account. Free tier is fine for test-mode work.
    2. Decide between two postures:
       - **Posture A (recommended for now): test-mode only.** All keys start with `sk_test_` / `whsec_` / `price_test_...`. Real cards rejected; test cards (`4242 4242 4242 4242`) accepted. No real charges.
       - **Posture B: live-mode for production deploy.** You will create both test + live versions of every artifact. For Phase 8 closure, only test mode is required. Live mode happens at launch.

    Proceed in **test mode** for everything below. Confirm the dashboard banner reads "Viewing test data" at the top.

    **Step 1 — Create the Product + Price**

    1. Go to https://dashboard.stripe.com/test/products
    2. Click "Add product" (or "+ Add product").
    3. Product name: `Jesse A. Eisenbalm lip balm`
    4. Description: `One tube. 100% of proceeds go to the featured charity each week.`
    5. Optionally upload an image (placeholder is fine — Andrew can swap later).
    6. Under "Pricing":
       - Pricing model: `Standard pricing`
       - Price: pick the actual retail price (Andrew's discretion; e.g., `$12.00`)
       - Billing period: **one-time** (NOT recurring)
       - Currency: `USD`
    7. Click "Add product".
    8. On the resulting product page, find the Price section. The price object id starts with `price_test_...`. Copy this exact string — it is `STRIPE_PRICE_ID`.

    **Step 2 — Configure Shipping Rates (CMR-10)**

    1. Go to https://dashboard.stripe.com/test/settings/shipping-rates
    2. Click "Add shipping rate".
    3. Display name: `Standard shipping` (or "Domestic — 5–7 business days", at Andrew's discretion)
    4. Type: `Fixed rate`
    5. Amount: pick a flat shipping cost (e.g. `$4.50`). The brief locks no specific amount — Andrew's call.
    6. Currency: `USD`
    7. Delivery estimate: optional (e.g. 5–7 business days).
    8. Click "Add". You should now have at least one shipping rate.
    9. (Optional) Add a second rate (e.g. "Expedited"). One is the minimum.

    NOTE: Stripe Checkout will surface configured shipping rates automatically when the session has `shipping_address_collection` enabled (CMR-10 — the code from Plan 08-04). You do NOT need to attach the rate to the product manually.

    **Step 3 — Generate API keys**

    1. Go to https://dashboard.stripe.com/test/apikeys
    2. Under "Standard keys":
       - Copy the "Publishable key" (`pk_test_...`). Per RESEARCH Open Question 3, the publishable key is NOT required for hosted Checkout — we will NOT configure it. Skip recording it.
       - Reveal and copy the "Secret key" (`sk_test_...`). This is `STRIPE_SECRET_KEY`.
    3. Treat the secret key like a database password. NEVER commit. NEVER paste into chat with anyone outside Andrew + the deployment.

    **Step 4 — Configure Webhook Endpoint + capture signing secret**

    1. Go to https://dashboard.stripe.com/test/webhooks
    2. Click "Add endpoint".
    3. Endpoint URL: this depends on where Andrew is testing.
       - If testing locally with Stripe CLI: SKIP creating a Dashboard endpoint. Instead run `stripe login` (one-time) then `stripe listen --forward-to localhost:3000/api/stripe/webhook` in a terminal — the CLI prints `whsec_...` to use as `STRIPE_WEBHOOK_SECRET`.
       - If testing against a deployed Vercel preview: enter `https://<vercel-preview-domain>/api/stripe/webhook`. Andrew may not know the preview domain yet — that's fine, create the endpoint with a placeholder URL like `https://example.com/api/stripe/webhook` and update it later, OR skip Step 4 entirely until Plan 08-08 smoke.
    4. Events to send: select two:
       - `checkout.session.completed`
       - `payment_intent.payment_failed`
    5. API version: leave at default (Stripe's current version).
    6. Click "Add endpoint".
    7. On the resulting endpoint page, find the "Signing secret" section. Click "Reveal" and copy. This is `STRIPE_WEBHOOK_SECRET` (`whsec_...`).

    **Step 5 — Write secrets to `apps/web/.env.local`**

    From the repo root, append these lines (or update existing ones):

    ```bash
    cat >> apps/web/.env.local <<EOF
    # ── Stripe (Phase 8 — Plan 08-02) ────────────────────────────────────────
    # Test-mode secrets. NEVER commit. Treat like database passwords.
    STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_VALUE_FROM_DASHBOARD
    STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_VALUE_FROM_DASHBOARD_OR_CLI
    STRIPE_PRICE_ID=price_test_REPLACE_WITH_PRICE_ID_FROM_DASHBOARD
    # Optional: feature flag from RESEARCH Open Question 2 — default true
    STRIPE_RECORD_ORDERS=true
    EOF
    ```

    Replace the three `REPLACE_WITH_*` placeholders with the actual values from Steps 1, 3, and 4. Do NOT commit `apps/web/.env.local` — `.gitignore` at the repo root already excludes `.env.local`.

    **Step 6 — Verify locally**

    ```bash
    grep -E "^STRIPE_SECRET_KEY=sk_test_" apps/web/.env.local && echo "secret OK"
    grep -E "^STRIPE_WEBHOOK_SECRET=whsec_" apps/web/.env.local && echo "webhook OK"
    grep -E "^STRIPE_PRICE_ID=price_" apps/web/.env.local && echo "price OK"
    git check-ignore apps/web/.env.local && echo "gitignored OK"
    ```

    Expected output: four `OK` lines. If any are missing, fix the file before approving.

    **Step 7 — (Optional) Install Stripe CLI**

    For local webhook testing in Plan 08-08:
    ```bash
    # macOS:
    brew install stripe/stripe-cli/stripe
    # Other: https://docs.stripe.com/stripe-cli

    stripe login
    # follow browser prompt
    stripe --version  # confirm install
    ```

    The CLI is not required for code landing; it IS required for Plan 08-08 manual UAT.
  </what-built>
  <acceptance_criteria>
    - `apps/web/.env.local` exists and is gitignored (`git check-ignore apps/web/.env.local` exits 0)
    - `apps/web/.env.local` contains a non-empty line matching `^STRIPE_SECRET_KEY=sk_test_[A-Za-z0-9]+` (test mode — never commit a live `sk_live_` key in this phase)
    - `apps/web/.env.local` contains a non-empty line matching `^STRIPE_WEBHOOK_SECRET=whsec_[A-Za-z0-9]+`
    - `apps/web/.env.local` contains a non-empty line matching `^STRIPE_PRICE_ID=price_[A-Za-z0-9_]+`
    - The Stripe Dashboard at https://dashboard.stripe.com/test/products shows a "Jesse A. Eisenbalm lip balm" product with a one-time price
    - The Stripe Dashboard at https://dashboard.stripe.com/test/settings/shipping-rates shows at least one configured shipping rate
    - The Stripe Dashboard at https://dashboard.stripe.com/test/webhooks shows a webhook endpoint subscribed to at least `checkout.session.completed` (NOTE: if Andrew is using only Stripe CLI for local dev, the Dashboard endpoint can be deferred — but the CLI `whsec_...` must be in `.env.local`)
    - `STRIPE_RECORD_ORDERS=true` is present in `.env.local` (RESEARCH Open Question 2 default)
    - Andrew confirms the dashboard banner read "Viewing test data" at the top when the artifacts were created (no live-mode artifacts created this plan)
  </acceptance_criteria>
  <verify>
    <automated>MISSING — Plan 08-08 manual smoke test verifies these env vars work against real Stripe Dashboard. This plan's success is Andrew's confirmation that the Dashboard is configured and `apps/web/.env.local` contains the four env vars with correct prefixes (sk_test_, whsec_, price_, true).</automated>
  </verify>
  <done>
    Andrew confirms (a) Product + Price exist in test mode, (b) shipping rate exists, (c) webhook endpoint OR Stripe CLI is providing whsec, (d) `apps/web/.env.local` contains the four env vars matching the expected prefixes, (e) Andrew has access to the Stripe Dashboard for the configured account.
  </done>
  <resume-signal>
    Type "approved" once `apps/web/.env.local` contains all four Stripe env vars and the Dashboard artifacts exist in test mode. Or describe issues (e.g. "I want to defer the webhook endpoint until 08-08 smoke — using Stripe CLI for local only").
  </resume-signal>
</task>

</tasks>

<verification>
After Andrew approves:
- `test -f apps/web/.env.local` exits 0
- `grep -E '^STRIPE_SECRET_KEY=sk_test_' apps/web/.env.local` exits 0
- `grep -E '^STRIPE_WEBHOOK_SECRET=whsec_' apps/web/.env.local` exits 0
- `grep -E '^STRIPE_PRICE_ID=price_' apps/web/.env.local` exits 0
- `grep -E '^STRIPE_RECORD_ORDERS=true$' apps/web/.env.local` exits 0
- `git check-ignore apps/web/.env.local` exits 0
- Stripe Dashboard manually inspected (Andrew's word): Product, Price, Shipping Rate, Webhook Endpoint all configured in test mode

Note: this plan does NOT verify the live deployed webhook URL works end-to-end. Plan 08-08 smoke test does that.
</verification>

<success_criteria>
- Stripe Dashboard test-mode configuration is complete enough that Plans 08-04 through 08-07's code (when deployed) can talk to Stripe successfully
- `apps/web/.env.local` carries the secrets so local dev (Stripe CLI + `pnpm --filter web dev`) can do a smoke test
- Vercel env-var provisioning is documented (will be repeated in Plan 08-08 README addendum)
- Andrew is the single source of truth for the Stripe artifacts — no automation creates them
- Live-mode setup is explicitly deferred to launch
</success_criteria>

<output>
After completion, create `.planning/phases/08-stripe-commerce/08-02-stripe-dashboard-checkpoint-SUMMARY.md` recording:
- Stripe account email Andrew used (or a placeholder note if Andrew prefers not to record it)
- The 4 Dashboard artifacts created (or deferred — e.g. "webhook endpoint deferred until Plan 08-08 smoke; using Stripe CLI for local")
- The exact retail price chosen for the lip balm (so future plans/UAT know what amount to expect on Checkout)
- The shipping rate(s) configured (name + amount)
- The 4 env vars confirmed in `apps/web/.env.local` (do NOT record the actual values — record only the prefix and presence)
- Whether Stripe CLI is installed (yes/no)
- Whether STATE.md Blockers section should be updated to mark the existing "Phase 6 carryover" Stripe blocker as RESOLVED (it should — this plan resolves it)
</output>
</content>
