# Deploying dispatch-control

`dispatch-control` is the **operator dashboard** (Andrew's surface): run control,
review gate, prompt editor, `/finance`, and `/settings`. It is a separate Next.js
app from the public `apps/web` site and **must be its own Vercel project**.

> **Security rule (do not break):** dispatch-control holds `CLERK_SECRET_KEY`.
> It must live in a **dedicated Vercel project** so that secret never enters the
> `apps/web` project or its client bundle. Never copy these env vars into `apps/web`.

---

## 1. Backend: sync Convex functions

The dashboard reads from the single Convex deployment `modest-magpie-797`
(dev-tier, used as the v1 live environment). After any change under `convex/`:

```bash
cd convex && npx convex dev --once
```

Do **not** use `convex deploy` — that targets a separate production deployment
this project does not use.

## 2. Public site (apps/web)

`apps/web` already has its own Vercel project that auto-deploys from `master`.
Its production build runs **strict type-checking** (`next build`), which vitest
does not — always run `pnpm --filter web build` locally before pushing schema/
helper changes.

## 3. dispatch-control Vercel project (one-time)

Create a NEW Vercel project (Add New Project → import this repo):

- **Root Directory:** `apps/dispatch-control`
- **Framework preset:** Next.js (auto-detected; pnpm workspace install is automatic)

### Environment variables

| Var | Value / source |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `https://modest-magpie-797.convex.cloud` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk `pk_test_...` (from `.env.local`) |
| `CLERK_SECRET_KEY` | Clerk `sk_test_...` — **server secret, dispatch-control only** |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` |
| `NEXT_PUBLIC_PIPELINE_URL` | **Required** — Railway pipeline URL. The test-run, scoring, run-control, and review clients throw at call time without it (not optional despite older docs) |
| `PREVIEW_SECRET` | Server-only secret that signs review-gate preview tokens (`lib/previewToken.ts`). Without it, the review preview silently shows "not configured" |
| `NEXT_PUBLIC_WEB_PREVIEW_BASE` | Base URL of the public `apps/web` site the review preview iframe points at. Paired with `PREVIEW_SECRET` |

> **Pipeline-side CORS (different service):** for the prompt test-run, scoring,
> run-control, and review features to work from the browser, the **Railway
> pipeline service** (not this dispatch-control Vercel project) must set
> `DASHBOARD_ALLOWED_ORIGINS` to the dispatch-control Vercel domain
> (comma-separated if more than one origin). This env var belongs to the
> pipeline service — do **not** add it to the dispatch-control Vercel env vars in
> the table above. It pairs with `NEXT_PUBLIC_PIPELINE_URL`: the dashboard URL
> points at the pipeline, and the pipeline must allow the dashboard's origin back.

Deploy. You get a URL like `eisenbalm-dispatch-control.vercel.app` — this is the
link you send Andrew.

## 4. Give Andrew access (Clerk)

The dashboard is auth-gated:

1. Clerk dashboard → add the new Vercel domain to allowed origins.
2. Clerk → Users → **Invite** Andrew.
3. He signs in at `/sign-in` with that invite.

---

## Pre-deploy checklist

```bash
cd convex && npx convex dev --once        # functions live on modest-magpie-797
cd .. && pnpm --filter web build          # public site strict build (must pass)
pnpm --filter dispatch-control build      # dashboard build (must pass)
```

- `next build` for both apps does **not** type-check `__tests__/*`; run
  `pnpm --filter <app> typecheck` separately if you want full `tsc` coverage.
  (dispatch-control currently has pre-existing `tsc`-only errors in Phase 24/25
  test files — they do not block the Vercel build.)

## Notes for Andrew

- **Stripe is in test mode** — `/finance` numbers reflect test orders, not real
  revenue.
- Two operator-only checks remain unexercised until real traffic exists
  (live Stripe fee resolution, live `markPayoutSent` audit emission); the UI
  works regardless. See `.planning/phases/27-money-notifications/27-VERIFICATION.md`.
