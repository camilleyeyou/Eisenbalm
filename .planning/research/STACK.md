# Technology Stack

**Project:** The Eisenbalm Dispatch — Mission Control Dashboard (v2.0)
**Researched:** 2026-06-21
**Scope:** NEW additions only for the `dispatch-control` Next.js app. The v1.0 stack (Next.js 15.3.x, React 19, Sanity v5, Convex ^1.38, FastAPI + LangGraph, OpenRouter, Stripe, Resend) is LOCKED and is not re-researched here. This document covers only what is NEW for the admin dashboard.

---

## Foundational Decisions (Locked — Inherit from v1)

The `dispatch-control` app shares a pnpm monorepo with the existing `apps/web` and `apps/studio`. It inherits:

- **Runtime:** Next.js 15.3.x (App Router) — same constraint as `apps/web`; stay at 15.x to avoid the `next-sanity` SanityLive overage bug on Next.js 16
- **React:** 19.2.6 — required by Next.js 15+
- **TypeScript:** 5.6.x
- **Tailwind CSS:** 4.3.x with `@theme` directives
- **Convex:** `^1.38.0` (deployment: `modest-magpie-797`) — the real-time and dashboard state layer
- **Stripe SDK:** `^21.0.0` — already present in `apps/web`; reuse for reconciliation reads
- **Resend SDK:** `^6.12.4` — already in `packages/emails`; reuse for notification delivery

No package listed above needs re-installing or re-versioning. The `dispatch-control` app adds them as workspace peer dependencies.

---

## 1. Auth — Recommendation and Rationale

### Recommendation: **Clerk** (`@clerk/nextjs ^7.x`, Core 3)

**Do not use Auth.js (NextAuth v5), Convex Auth, or Better Auth for this project.**

#### Why Clerk

The `dispatch-control` dashboard is a **single-operator admin app** (Andrew, one user, zero public signups). Clerk's free tier (50,000 MAU, updated February 2026) means zero cost at this scale indefinitely. The auth requirement is simple: one Google / email login, protect all routes, done.

Clerk's Core 3 release (March 2026) ships native React 19 concurrent-mode support (transitions, Suspense, streaming SSR) — the exact environment Next.js 15.3 + React 19 runs. The `@clerk/nextjs` v7 package requires `next >=15.2.3`, which this codebase satisfies.

**Convex integration is first-class.** Clerk issues JWTs that Convex validates natively via `ConvexProviderWithClerk`. The integration pattern is:

```
ClerkProvider (Server Component, app/layout.tsx)
  └── ConvexClientProvider (Client Component, 'use client')
        └── ConvexProviderWithClerk (wraps ConvexReactClient, passes useAuth)
              └── rest of app
```

Convex calls in the dashboard can then gate on `ctx.auth.getUserIdentity()` — no separate Convex auth layer needed. This is the documented, tested Clerk+Convex pattern.

**Multi-tenant-bones are free.** Clerk ships `<CreateOrganization>`, `<OrganizationProfile>`, and `<OrganizationSwitcher>` out of the box. When productization arrives (Phase 6), enabling Organizations in Clerk maps cleanly to the `workspace_id` field threaded through Convex and the pipeline. No auth rewrite is needed.

**Middleware is a single function call:**

```typescript
// apps/dispatch-control/middleware.ts  (NOT proxy.ts — that's Next.js 16+)
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
const isPublicRoute = createRouteMatcher(['/sign-in(.*)'])
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect()
})
export const config = { matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'] }
```

#### Why not Auth.js v5

Auth.js v5 remains in "beta" as of June 2026, with a community thread running since 2023 asking when it will stabilize. The Better Auth team (which now maintains Auth.js) explicitly directs new projects to Better Auth, not Auth.js v5. It only makes sense for migration of existing codebases. This project has zero auth code — there is nothing to migrate.

#### Why not Convex Auth

Convex Auth is a Convex-specific auth layer, but it lacks Clerk's productization primitives (Organizations, switchable workspaces). Migrating from Convex Auth to something organization-aware when Phase 6 productization arrives would require rewriting auth. Clerk avoids that rewrite.

#### Why not Better Auth

Better Auth is the best choice for self-hosted projects with full data ownership. But it requires a secondary database (or a Convex adapter that is still in early community support). It adds infrastructure complexity for a one-person admin app that will eventually become a hosted SaaS product. Clerk's managed approach and productization primitives are the better tradeoff for this trajectory.

### Installation

```bash
pnpm --filter dispatch-control add @clerk/nextjs
```

Version: `^7.5.7` (Core 3, latest as of 2026-06-21)

### Required environment variables (`apps/dispatch-control/.env.local`)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
```

### Confidence: HIGH
Sources: [Clerk Core 3 changelog](https://clerk.com/changelog/2026-03-03-core-3), [Clerk pricing](https://clerk.com/pricing), [Convex + Clerk docs](https://docs.convex.dev/auth/clerk), [LogRocket Next.js auth 2026](https://blog.logrocket.com/best-auth-library-nextjs-2026/)

---

## 2. Secrets Store — Per-Workspace API Keys (§4.7 / §6 BYO Keys)

### Recommendation: **Convex-encrypted rows in Convex** (Phase 1 start); graduate to Railway environment variables for pipeline-level secrets

The dashboard's secrets requirement has two distinct use cases with different solutions:

#### 2a. Per-workspace user-supplied API keys (future BYO keys — Phase 6)

Use Convex document storage with AES-256-GCM encryption, keyed from a `WORKSPACE_ENCRYPTION_KEY` environment variable stored in Vercel/Railway. The `workspace_secrets` table holds `{ workspaceId, name, encryptedValue, iv, tag }` rows. This is the correct pattern for multi-tenant secrets that must be isolated per workspace and are read back at pipeline runtime.

**Do NOT add a third-party secrets service (Doppler, Infisical, Vault, AWS Secrets Manager) in Phase 1.** They add operational complexity and an external dependency for a single-tenant app. The encryption-in-Convex pattern is zero-infrastructure and is the approach documented in the Convex community.

For the pipeline to read user-supplied keys at run time, the FastAPI endpoint decrypts the relevant secret from Convex using `WORKSPACE_ENCRYPTION_KEY` and passes it as a transient environment variable to the agent. No plaintext secrets are stored in Convex documents.

```typescript
// convex/schema.ts addition (Phase 6 only — thread workspace_id now but no secrets table yet)
workspaceSecrets: defineTable({
  workspaceId: v.string(),
  name: v.string(),            // e.g. 'OPENROUTER_API_KEY'
  encryptedValue: v.string(),  // AES-256-GCM ciphertext, base64
  iv: v.string(),              // initialization vector, base64
  authTag: v.string(),         // GCM auth tag, base64
  createdAt: v.number(),
  rotatedAt: v.optional(v.number()),
})
  .index('by_workspace_name', ['workspaceId', 'name'])
```

#### 2b. System-level secrets (OpenRouter API key, Sanity token, Convex deploy key)

These are already environment variables on Railway (pipeline) and Vercel (frontend). No change needed. **Use what's already in the repo — add nothing.**

The dashboard UI for Phase 1 shows a masked last-4-chars display (like Stripe key management) — no new library required, this is a pattern not a package.

### Confidence: MEDIUM
The encryption-in-Convex pattern is community-validated but not a Convex first-party component. A first-party option (Convex API Keys component, `npm install convex-api-keys`) exists but is oriented toward API key issuance (keys your app gives to external callers), not storage of user-supplied third-party API credentials. That component solves a different problem.

---

## 3. Prompt Editor — Variable Highlighting and Diffing

### 3a. Editor with variable template highlighting

**Recommendation: `@uiw/react-codemirror ^4.23` + custom `@codemirror/view` extension**

`@uiw/react-codemirror` is the standard React wrapper for CodeMirror 6. It ships as a React component and exposes the full CodeMirror 6 extension API. Version 4.23+ (latest is 4.25.x as of 2026-06-21) uses CodeMirror 6 internally (`@codemirror/view ^6.43`, `@codemirror/state ^6.6`).

The prompt templates in `packages/pipeline/src/eisenbalm_pipeline/prompts/` use `{token}` substitution (curly-brace tokens: `{VOICE_CONSTRAINTS}`, `{charity_name}`, etc.). Variable highlighting is a custom CodeMirror `StateField` + `Decoration` extension — a well-documented CodeMirror pattern. The extension uses `EditorView.decorations.compute` with a regex matching `\{[A-Z_]+\}` and applies a `Decoration.mark({ class: 'cm-prompt-variable' })`. No third-party plugin needed for this.

```bash
pnpm --filter dispatch-control add @uiw/react-codemirror @codemirror/view @codemirror/state
```

The `@uiw/react-codemirror` package brings `@codemirror/view` and `@codemirror/state` as peer dependencies. Install them explicitly for the custom extension.

**Do NOT install a full code editor framework** (Monaco, Ace) for prompt editing. They are multiple megabytes of JavaScript and optimized for source code, not plain text with custom decorations. CodeMirror 6 is the correct weight for this use case.

### 3b. Prompt version diffing

**Recommendation: `react-diff-viewer-continued ^4.2.2`**

The original `react-diff-viewer` package is abandoned (last published 6 years ago). `react-diff-viewer-continued` is the actively maintained fork, last published 2 months ago, supports React 18/19, and renders side-by-side or inline diffs using `diff` under the hood.

```bash
pnpm --filter dispatch-control add react-diff-viewer-continued
```

For the side-by-side prompt diff view (two versions of a prompt, highlighted changes), pass `oldValue` and `newValue` as plain strings. Use `splitView={true}` and `useDarkTheme={false}` to match the dashboard palette. No additional diff library (jsdiff, diff2html) is needed.

### Confidence: HIGH for CodeMirror 6 (well-documented, industry standard); MEDIUM for `react-diff-viewer-continued` (actively maintained fork but fork, not original)
Sources: [CodeMirror decoration example](https://codemirror.net/examples/decoration/), [react-diff-viewer-continued npm](https://www.npmjs.com/package/react-diff-viewer-continued), [@uiw/react-codemirror GitHub](https://github.com/uiwjs/react-codemirror)

---

## 4. Notifications — Slack + Email

### 4a. Email notifications

**Use what's already in the repo — add nothing.**

`resend ^6.12.4` is already installed in `packages/emails`. The `SendEmailProvider` abstraction with a `Resend` implementation already exists. The notification email type is just another email type in `packages/emails/src/templates/`. Route it through the existing `emailActions.sendEmailStep` Convex action or a new parallel action for pipeline events.

### 4b. Slack notifications

**Recommendation: `@slack/webhook ^7.0.9`**

The official Slack SDK's incoming-webhook package. It is minimal (single class, no full-SDK overhead), Node 18+ compatible, and actively maintained (last published 15 days ago as of 2026-06-21). It wraps Slack's Incoming Webhooks API.

```bash
pnpm --filter dispatch-control add @slack/webhook
```

OR install on the pipeline side if notifications originate from Python:

```bash
# In packages/pipeline — Python equivalent
uv add slack_sdk   # httpx-backed, async-friendly
```

The Slack notification flow belongs in a Convex action (`notifySlack`) or a FastAPI background task, not in the Next.js frontend. The Slack webhook URL is a pipeline/backend environment variable.

**Pattern:** Convex `pipelineRuns` already tracks run status changes. A Convex action or mutation can trigger a Slack notification via the `@slack/webhook` `IncomingWebhook.send()` call when status transitions to `awaiting-review`, `failed`, or `complete`. Route through a Next.js API route (`POST /api/notify/slack`) if the notification must originate from the frontend, or call from Convex's Node runtime directly.

```typescript
// In a Convex action (Node runtime, not V8)
import { IncomingWebhook } from '@slack/webhook'
const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL!)
await webhook.send({ text: `Run ${runId} is awaiting review.` })
```

**Do NOT add a full Slack app / Bot Token integration for notifications.** Incoming webhooks are sufficient. Bot tokens add OAuth complexity for no benefit when all you need is push-only messages to a channel.

### Confidence: HIGH for `@slack/webhook` (official Slack SDK, actively maintained); HIGH for Resend reuse (already integrated)
Sources: [@slack/webhook npm](https://www.npmjs.com/package/@slack/webhook), [Slack Incoming Webhooks docs](https://docs.slack.dev/tools/node-slack-sdk/webhook/)

---

## 5. Stripe Reconciliation

**Use what's already in the repo — add nothing.**

`stripe ^21.0.0` is already in `apps/web`. The Stripe Node.js library provides all APIs needed for donation reconciliation. Specifically:

- `stripe.charges.list({ created: { gte: windowStart, lte: windowEnd }, limit: 100 })` — paginate charges for a date window
- `stripe.balanceTransactions.list({ created: { gte: ... }, type: 'charge' })` — get gross/fee/net breakdown per transaction
- `stripe.paymentIntents.list({ created: { gte: ... } })` — alternatively, paginate by PaymentIntent

The Convex `stripeOrders` table (already present in `convex/schema.ts`) stores `amountTotal`, `amountSubtotal`, `amountShipping`, `donationAmount`, and `charitySlug`. For per-issue reconciliation:

1. Query `stripeOrders` by `charitySlug` and `createdAt` range — all orders are already captured at webhook time
2. Sum `donationAmount` (= `amountSubtotal`) for gross-to-charity
3. For Stripe fees (not stored locally), use `stripe.balanceTransactions.list` filtered by `source` (the charge ID) to get Stripe's fee breakdown

The dashboard reconciliation view is primarily a **read from `stripeOrders` in Convex** with a supplementary Stripe API call for fee details. No additional package needed. The reconciliation API route in `dispatch-control` will be a Next.js Route Handler that uses the already-installed `stripe` singleton.

### Confidence: HIGH — Stripe SDK already installed, Convex schema already captures the necessary data fields
Sources: [Stripe API: list charges](https://docs.stripe.com/api/charges/list?lang=node), [Stripe API: balance transactions](https://docs.stripe.com/api/balance_transactions/list?lang=node)

---

## 6. Complete New Dependencies for `apps/dispatch-control`

This is the exhaustive list of packages that do NOT already exist anywhere in the monorepo and must be installed in the new `dispatch-control` app.

| Package | Version | Purpose |
|---------|---------|---------|
| `@clerk/nextjs` | `^7.5.7` | Auth middleware, `<ClerkProvider>`, `clerkMiddleware()`, `auth()` |
| `@uiw/react-codemirror` | `^4.23.0` | React wrapper for CodeMirror 6 prompt editor |
| `@codemirror/view` | `^6.43.0` | Custom variable-highlighting decoration extension |
| `@codemirror/state` | `^6.6.0` | `StateField.define()` for the decoration extension |
| `react-diff-viewer-continued` | `^4.2.2` | Side-by-side prompt version diff |
| `@slack/webhook` | `^7.0.9` | Slack incoming webhook for pipeline notifications |

All other required capabilities come from packages already in the monorepo:
- Convex (`^1.38.0`) — real-time dashboard state, run history, agent config
- Stripe (`^21.0.0`) — reconciliation reads (from `apps/web`, re-add to `dispatch-control`)
- Resend (`^6.12.4`) — email notifications (from `packages/emails`)
- Tailwind CSS (`^4.3.x`) — styling
- Next.js + React + TypeScript — app framework

### Installation

```bash
# Create the app
mkdir -p apps/dispatch-control
cd apps/dispatch-control
# ... init Next.js app, then:

pnpm add @clerk/nextjs @uiw/react-codemirror @codemirror/view @codemirror/state react-diff-viewer-continued @slack/webhook
pnpm add convex stripe resend                    # re-add shared deps
pnpm add next react react-dom                    # app framework
pnpm add -D typescript tailwindcss @tailwindcss/postcss vitest
```

---

## 7. What NOT to Add

| Do NOT add | Why | What to use instead |
|------------|-----|-------------------|
| Auth.js / NextAuth v5 | Still in "beta" as of June 2026; maintainers direct new projects to Better Auth; no org/workspace primitives for productization | Clerk `@clerk/nextjs ^7.x` |
| Better Auth | Excellent for self-hosted data ownership, but Convex adapter is early-community; adds complexity for a future-hosted-SaaS trajectory | Clerk — managed auth with first-class organization support |
| Convex Auth | No organization/workspace primitives; would require rewrite at productization | Clerk — natively integrates with Convex via JWT |
| Doppler / Infisical / Vault / AWS Secrets Manager | Operational overhead for single-tenant. Convex-encrypted rows are sufficient until multi-tenant Phase 6 | AES-256-GCM encryption in Convex rows + `WORKSPACE_ENCRYPTION_KEY` env var |
| `convex-api-keys` npm package | Solves the wrong problem — it manages keys your app ISSUES to external callers, not keys your users supply for third-party services | Encrypted Convex rows (custom, minimal) |
| Monaco Editor | ~4MB bundle, built for code, not plain-text prompt editing with custom decorations | `@uiw/react-codemirror` (~120KB) |
| `react-diff-viewer` (original) | Abandoned, last published 6 years ago | `react-diff-viewer-continued ^4.2.2` |
| Full Slack Bot Token / OAuth | Bot tokens require Slack app creation + OAuth flow; overkill for push-only notifications | `@slack/webhook` incoming webhooks |
| `jsdiff` directly | `react-diff-viewer-continued` already wraps it and provides a rendered component | `react-diff-viewer-continued` |
| Any new CMS / admin framework (Adminjs, Refine, Payload) | Brief locks Next.js; admin frameworks impose their own data model and conflict with Convex as the state layer | Next.js App Router + Convex + Tailwind + shadcn primitives |
| Vercel AI SDK | Brief explicitly locks stack; also architecturally wrong — agent test-runs go through the existing FastAPI `/agents/{key}/test-run` endpoint | Existing FastAPI endpoint |

---

## 8. Convex Schema Additions for the Dashboard

The dashboard requires new Convex tables. These are additive — no existing tables are modified. The `workspace_id` field is added to every new table now (even with one workspace) to avoid a later migration.

```typescript
// convex/schema.ts additions (new tables only)

agents: defineTable({
  workspaceId: v.string(),
  key: v.string(),             // e.g. 'scout', 'calibrator'
  displayName: v.string(),
  enabled: v.boolean(),
  model: v.string(),
  temperature: v.number(),
  maxTokens: v.optional(v.number()),
  description: v.optional(v.string()),
  activePromptVersionId: v.optional(v.id('promptVersions')),
})
  .index('by_workspace', ['workspaceId'])
  .index('by_workspace_key', ['workspaceId', 'key']),

promptVersions: defineTable({
  workspaceId: v.string(),
  agentKey: v.string(),
  promptType: v.union(v.literal('system'), v.literal('user')),
  content: v.string(),
  version: v.number(),
  authorId: v.optional(v.string()),  // Clerk userId
  note: v.optional(v.string()),
  createdAt: v.number(),
})
  .index('by_agent', ['workspaceId', 'agentKey'])
  .index('by_agent_version', ['workspaceId', 'agentKey', 'version']),

pipelineConfig: defineTable({
  workspaceId: v.string(),
  scheduleEnabled: v.boolean(),
  requireReview: v.boolean(),
  autoPublish: v.boolean(),
  monthlyBudgetCap: v.optional(v.number()),  // USD
  perRunBudgetCap: v.optional(v.number()),   // USD
  scheduleDay: v.optional(v.number()),       // 0-6, day of week
  scheduleHour: v.optional(v.number()),      // 0-23 UTC
  updatedAt: v.number(),
  updatedBy: v.optional(v.string()),         // Clerk userId
})
  .index('by_workspace', ['workspaceId']),

reviewActions: defineTable({
  workspaceId: v.string(),
  runId: v.string(),
  action: v.union(
    v.literal('approve'),
    v.literal('reject'),
    v.literal('reroll'),
    v.literal('schedule'),
  ),
  actorId: v.string(),           // Clerk userId
  note: v.optional(v.string()),
  timestamp: v.number(),
})
  .index('by_run', ['workspaceId', 'runId']),

auditLog: defineTable({
  workspaceId: v.string(),
  actorId: v.string(),           // Clerk userId
  action: v.string(),            // e.g. 'prompt.update', 'killswitch.toggle'
  resourceType: v.string(),      // 'agent', 'pipelineConfig', 'promptVersion', etc.
  resourceId: v.optional(v.string()),
  before: v.optional(v.string()), // JSON snapshot
  after: v.optional(v.string()),  // JSON snapshot
  timestamp: v.number(),
})
  .index('by_workspace_time', ['workspaceId', 'timestamp']),
```

**Note:** The Clerk `userId` from `ctx.auth.getUserIdentity()?.subject` is the natural `actorId` for audit rows and review actions. No separate users table is needed in Phase 1.

---

## 9. Monorepo Layout — New App

```
apps/
├── web/                 # existing public site (unchanged)
├── studio/              # existing Sanity Studio (unchanged)
└── dispatch-control/    # NEW: admin dashboard
    ├── app/
    │   ├── layout.tsx              # ClerkProvider + ConvexClientProvider
    │   ├── middleware.ts           # clerkMiddleware() — protects all routes
    │   ├── sign-in/[[...rest]]/    # Clerk hosted sign-in
    │   ├── (dashboard)/            # route group for all admin pages
    │   │   ├── layout.tsx          # shell: sidebar + header
    │   │   ├── page.tsx            # run overview / live run view
    │   │   ├── agents/
    │   │   │   ├── page.tsx        # agent card grid
    │   │   │   └── [key]/page.tsx  # prompt editor + version history
    │   │   ├── runs/
    │   │   │   ├── page.tsx        # run history table
    │   │   │   └── [runId]/page.tsx # live run detail
    │   │   ├── config/page.tsx     # kill switch + schedule + budget caps
    │   │   ├── charities/page.tsx  # charity registry
    │   │   ├── issues/page.tsx     # issue review board
    │   │   └── reconciliation/page.tsx # Stripe donation per issue
    │   └── api/
    │       └── notify/slack/route.ts   # POST → Slack webhook
    ├── components/
    │   ├── PromptEditor.tsx            # @uiw/react-codemirror + variable extension
    │   ├── PromptDiff.tsx              # react-diff-viewer-continued
    │   └── ConvexClientProvider.tsx    # 'use client' wrapper for ConvexProviderWithClerk
    └── package.json
```

---

## 10. Compatibility Notes

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `@clerk/nextjs ^7.x` | `next >=15.2.3`, React 19 | Core 3. Use `middleware.ts` (NOT `proxy.ts` — that is Next.js 16+) |
| `@clerk/nextjs ^7.x` | Convex `^1.38` | `ConvexProviderWithClerk` from `convex/react-clerk` wraps `ConvexReactClient` |
| `@uiw/react-codemirror ^4.23` | React 19 | No known incompatibility; uses standard React ref pattern |
| `@codemirror/view ^6.43` | `@uiw/react-codemirror ^4.23` | Peer dep — install together |
| `react-diff-viewer-continued ^4.2.2` | React 19 | Confirmed React 18/19 support |
| `@slack/webhook ^7.0.9` | Node 18+ | Works in Convex Node actions and Next.js Route Handlers |
| `stripe ^21.0.0` | Next.js App Router | Already used in `apps/web`; same version |

---

## Sources

- [Clerk Core 3 changelog (2026-03-03)](https://clerk.com/changelog/2026-03-03-core-3) — React 19 concurrent mode support; `next >=15.2.3` requirement (HIGH confidence)
- [Clerk @clerk/nextjs npm](https://www.npmjs.com/package/@clerk/nextjs) — v7.5.7 latest (HIGH confidence)
- [Clerk pricing (Feb 2026 update)](https://clerk.com/changelog/2026-02-05-new-plans-more-value) — 50K MAU free (HIGH confidence)
- [Clerk Next.js quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart) — App Router middleware setup (HIGH confidence)
- [Convex + Clerk docs](https://docs.convex.dev/auth/clerk) — `ConvexProviderWithClerk` pattern (HIGH confidence)
- [Convex auth best practices](https://stack.convex.dev/authentication-best-practices-convex-clerk-and-nextjs) — three-layer auth pattern (HIGH confidence)
- [LogRocket: best auth library Next.js 2026](https://blog.logrocket.com/best-auth-library-nextjs-2026/) — Auth.js v5 maintenance-mode note; Better Auth recommendation for new projects (MEDIUM confidence — editorial review, not official)
- [Auth.js v5 beta discussion](https://github.com/nextauthjs/next-auth/discussions/13382) — confirms ongoing beta status as of 2026 (HIGH confidence — official repo)
- [Convex API Keys component](https://www.convex.dev/components/convex-api-keys) — solves key issuance, not third-party key storage (HIGH confidence)
- [Convex secrets encryption pattern](https://medium.com/@jballo/building-server-side-api-key-encryption-with-convex-and-node-js-crypto-29f69e0de8c6) — AES-256-GCM + Convex rows (MEDIUM confidence — community article)
- [@uiw/react-codemirror GitHub](https://github.com/uiwjs/react-codemirror) — v4.25.x latest; 4.23+ uses CodeMirror 6 (HIGH confidence)
- [@codemirror/view npm](https://www.npmjs.com/package/@codemirror/view) — v6.43.0 current (HIGH confidence)
- [CodeMirror decoration example](https://codemirror.net/examples/decoration/) — `StateField` + `Decoration.mark` pattern (HIGH confidence — official docs)
- [react-diff-viewer-continued npm](https://www.npmjs.com/package/react-diff-viewer-continued) — v4.2.2, actively maintained (HIGH confidence)
- [@slack/webhook npm](https://www.npmjs.com/package/@slack/webhook) — v7.0.9 latest (HIGH confidence)
- [Slack incoming webhooks Node SDK](https://docs.slack.dev/tools/node-slack-sdk/webhook/) — `IncomingWebhook` class (HIGH confidence — official docs)
- [Stripe API: list charges](https://docs.stripe.com/api/charges/list?lang=node) — date range pagination (HIGH confidence — official docs)
- [Stripe API: balance transactions](https://docs.stripe.com/api/balance_transactions/list?lang=node) — fee breakdown (HIGH confidence — official docs)

---

*Stack research for: The Eisenbalm Dispatch — Mission Control Dashboard v2.0 additions*
*Researched: 2026-06-21*
*Confidence: HIGH overall — all versions verified via npm registry and official docs; auth recommendation based on verified 2026 ecosystem state*
