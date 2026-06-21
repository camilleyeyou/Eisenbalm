# Phase 21: Auth + App Shell + Convex Schema — Research

**Researched:** 2026-06-21
**Domain:** Clerk authentication (Next.js 15 App Router) · ConvexProviderWithClerk · FastAPI JWT verification · Convex schema extension · pnpm monorepo scaffolding
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — New app is `apps/dispatch-control`, Next.js 15 App Router, no pages router.
- **D-02** — Full-shape tables (all fields defined now): `workspaces`, `users`, `runs`, `audit_log`.
- **D-03** — Stub tables (schema shape only, mutations come later): `agents`, `prompt_versions`, `pipeline_config`, `agent_runs`, `charities`, `model_pricing`, `review_actions`.
- **D-04** — All 11 new tables appended inline to `convex/schema.ts` using the existing ASCII section-header comment convention.
- **D-05** — `.index('by_workspace', ['workspace_id'])` on every new table. No exceptions.
- **D-06** — Append inline to `convex/schema.ts` with ASCII section-header comments (not a new file, not a separate schema module).
- **D-07** — `apps/web` stays completely unauthenticated. No Clerk imports, no middleware, no provider. Smoke test: unauthenticated access to any `apps/web` route must still work.
- **D-08** — `dispatch-control` is the ONLY app with Clerk.
- **D-09** — FastAPI dashboard-control endpoints (`/pipeline/*`, future dashboard endpoints) get a new `Depends(require_clerk_jwt)` guard. Railway cron path (`X-Pipeline-Trigger-Secret`) is untouched.
- **D-10** — Auth is implemented FIRST in `dispatch-control` before any other dashboard functionality. Nothing else is merged until auth smoke test passes.
- **D-11** — No Turborepo. pnpm workspaces only.
- **D-12** — `dispatch-control` shares the SAME Convex deployment (`modest-magpie-797`). No second deployment.
- **D-13** — Signed-in operator's `clerkUserId` (from `ctx.auth.getUserIdentity()?.subject`) is the `actorId` on every `audit_log` row and the `triggeredBy` on every `runs` row from day one.
- **D-14** — `workspace_id` is a plain string slug `"eisenbalm"`, NOT `v.id('workspaces')`. Foreign-key semantics deferred to Phase 28 multi-tenancy.
- **D-15** — Seed via an idempotent Convex seed mutation (skip if `workspace_id="eisenbalm"` already exists).
- **D-16** — No hardcoded `"eisenbalm"` string in control-plane code paths. The string lives only in seeded data + a `DEFAULT_WORKSPACE_ID` constant.
- **D-17** — `pipelineRuns` schema is FROZEN. `deliberationEvents.eventType` union is FROZEN. All API_CONTRACTS.md §4 contracts unchanged.
- **D-18** — New `runs` table augments (does not replace) `pipelineRuns`. Same `run_id` join key. Both written at run start.

### Claude's Discretion

- Exact placeholder page copy and styling for the 7 nav routes.
- Which Lucide icons to use for each nav item.
- Precise field names within full-shape tables (as long as they satisfy the requirements).
- Whether `dispatch-control` needs its own Vercel project (resolve at Phase 21 execution time based on env-var isolation needs).
- Whether to use shadcn `Sidebar` primitive or a hand-rolled CSS sidebar.

### Deferred Ideas (OUT OF SCOPE)

- Clerk Organizations / multi-tenancy (Phase 28).
- Role-based access control beyond simple "is authenticated" (Phase 28).
- `workspace_secrets` AES-256-GCM encryption (Phase 28).
- Config externalization / prompt loader swap (Phase 22).
- Node wrappers / agent_runs emissions / live run observability (Phase 23).
- Prompt editor / CodeMirror (Phase 24).
- Run control / cooperative cancel / schedule editor (Phase 25).
- Review gate / charity registry (Phase 26).
- Stripe reconciliation / Slack notifications (Phase 27).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Operator sign-in; every dashboard route protected; apps/web stays unauthenticated | Clerk `clerkMiddleware` + `createRouteMatcher` for dispatch-control; apps/web has zero Clerk code confirmed |
| AUTH-02 | Unauthenticated requests redirect to sign-in or return 401 | `auth.protect()` in middleware handles redirect; FastAPI `HTTPException(401)` handles API case |
| AUTH-03 | FastAPI dashboard endpoints verify Clerk JWT; Railway cron keeps X-Pipeline-Trigger-Secret | `require_clerk_jwt` Depends() using PyJWT + JWKS; existing `_require_trigger_secret()` untouched |
| AUTH-04 | Actions attributed to signed-in operator from day one | `ctx.auth.getUserIdentity()?.subject` = Clerk userId = `actorId` in audit_log + `triggeredBy` in runs |
| CFG-05 | Every new table has workspace_id; "eisenbalm" seeded; no Eisenbalm-specific logic hardcoded | `workspace_id: v.string()` + `.index('by_workspace', ['workspace_id'])` on all 11 tables; idempotent seed mutation; `DEFAULT_WORKSPACE_ID` constant pattern |
</phase_requirements>

---

## Summary

Phase 21 stands up the `apps/dispatch-control` Next.js 15 app from scratch, gates every route behind Clerk auth, adds 11 new Convex tables to the existing `convex/schema.ts`, protects FastAPI dashboard endpoints with Clerk JWT verification, and seeds the "eisenbalm" workspace. This is the auth foundation that every subsequent Mission Control phase builds on.

The good news is that every piece of this stack is well-established with solid documentation. `@clerk/nextjs ^7.5.7` (Core 3) is installed at the workspace root. `ConvexProviderWithClerk` is confirmed present in `convex@1.38.0` at the subpath `convex/react-clerk`. The existing `convex/schema.ts` provides clear conventions to follow. The FastAPI codebase has a working `_require_trigger_secret()` pattern to model the new `require_clerk_jwt` dependency on.

The two items requiring careful attention are: (1) the Convex `auth.config.ts` must be created inside the `convex/` package (not `apps/dispatch-control/`) because Convex auth is deployment-level configuration, and (2) Clerk dashboard configuration requires a manual step — creating a JWT template named exactly `"convex"` — before `ConvexProviderWithClerk` will work.

**Primary recommendation:** Scaffold auth first (Clerk middleware + `ClerkProvider` + `ConvexProviderWithClerk` + verify unauthenticated redirect works), then add Convex tables, then add FastAPI guard, then add the app shell. Never merge until the auth smoke test passes.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@clerk/nextjs` | `^7.5.7` | Auth provider, middleware, server helpers | Core 3; native React 19 concurrent mode; ships `ConvexProviderWithClerk`; confirmed latest 7.x |
| `convex` | `^1.38.0` | Realtime DB + `ConvexProviderWithClerk` | Already in workspace; `react-clerk` subpath confirmed present |
| `next` | `^15.3.9` | App Router, middleware, server components | Locked stack; already in `apps/web` |
| `react` / `react-dom` | `^19.2.6` | Core framework | Matches `apps/web` |
| `PyJWT[crypto]` | `^2.x` (pipeline venv) | FastAPI Clerk JWT verification via JWKS | Already vendored in pipeline; RS256 support via `cryptography` extra |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | `^1.14.0` | Nav icons | Same version as `apps/web`; no new install |
| `tailwindcss` | `^4.3.0` | Styling | Same version as `apps/web` |
| `clsx` / `tailwind-merge` | as in `apps/web` | Class utilities | Copy from `apps/web/package.json` |
| shadcn/ui components | installed per-use | Sidebar, nav primitives | `npx shadcn@latest add sidebar` after init |
| `class-variance-authority` | `^0.7.1` | Variant styling | Same as `apps/web` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Clerk `^7` | Auth.js v5 (beta) | Auth.js v5 is still beta; no org primitives for Phase 28; Clerk chosen — do not revisit |
| Clerk `^7` | Convex Auth | No org primitives; different Convex integration path; Clerk chosen — do not revisit |
| `convex/react-clerk` | Custom JWT token provider | Hand-rolling breaks with Convex reactive auth; `ConvexProviderWithClerk` is the standard path |

**Installation for `apps/dispatch-control`:**
```bash
pnpm --filter dispatch-control add @clerk/nextjs convex next react react-dom lucide-react clsx tailwind-merge class-variance-authority tailwindcss-animate
pnpm --filter dispatch-control add -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss vitest @vitest/ui vite-tsconfig-paths
```

**Version verification:** Confirmed against npm registry 2026-06-21. `@clerk/nextjs@7.5.7` is the latest 7.x release. `convex@1.38.0` is installed in the workspace; `ConvexProviderWithClerk` at `convex/react-clerk` is confirmed present in that version.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/dispatch-control/
├── app/
│   ├── layout.tsx          # ClerkProvider (Server) → ConvexClientProvider (Client)
│   ├── sign-in/
│   │   └── [[...sign-in]]/
│   │       └── page.tsx    # <SignIn /> component — catch-all slug required
│   ├── (dashboard)/
│   │   ├── layout.tsx      # Sidebar shell layout
│   │   ├── page.tsx        # Redirect → /graph
│   │   ├── graph/page.tsx
│   │   ├── runs/page.tsx
│   │   ├── config/page.tsx
│   │   ├── prompts/page.tsx
│   │   ├── registry/page.tsx
│   │   ├── finance/page.tsx
│   │   └── settings/page.tsx
│   └── globals.css
├── components/
│   ├── ConvexClientProvider.tsx   # 'use client' — ConvexProviderWithClerk wrapper
│   └── AppSidebar.tsx             # Left nav with 7 routes
├── lib/
│   └── workspace.ts               # DEFAULT_WORKSPACE_ID constant + getCurrentWorkspace()
├── middleware.ts                   # clerkMiddleware + createRouteMatcher
├── package.json
├── next.config.ts
├── tsconfig.json
└── components.json                 # shadcn config (copy from apps/web, adjust aliases)
```

### Pattern 1: Clerk Middleware (Next.js 15)

**What:** Protect all routes except sign-in. Next.js 15 uses `middleware.ts` (not `proxy.ts`, which is Next.js 16+).
**When to use:** Every request to `dispatch-control` passes through this.

```typescript
// apps/dispatch-control/middleware.ts
// Source: https://clerk.com/docs/references/nextjs/clerk-middleware
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
```

Key: `auth.protect()` automatically redirects unauthenticated users to the sign-in URL set in `NEXT_PUBLIC_CLERK_SIGN_IN_URL`. No manual redirect logic needed.

### Pattern 2: Provider Hierarchy (Next.js App Router)

**What:** `ClerkProvider` must be a Server Component at the root. `ConvexProviderWithClerk` must be a Client Component. Split into two files.

```typescript
// apps/dispatch-control/app/layout.tsx (Server Component — no 'use client')
// Source: https://docs.convex.dev/auth/clerk
import { ClerkProvider } from '@clerk/nextjs'
import ConvexClientProvider from '@/components/ConvexClientProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
```

```typescript
// apps/dispatch-control/components/ConvexClientProvider.tsx
'use client'
// Source: https://docs.convex.dev/auth/clerk
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useAuth } from '@clerk/nextjs'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export default function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
```

Critical: `ConvexProviderWithClerk` takes `useAuth` from `@clerk/nextjs`, NOT from `@clerk/clerk-react`. Import path matters.

### Pattern 3: Convex Auth Config (Deployment-Level)

**What:** Tells the Convex deployment to trust Clerk-issued JWTs. Must be in the `convex/` workspace package, not in `apps/dispatch-control`.

```typescript
// convex/auth.config.ts  (NEW FILE — goes in convex/ package, not in dispatch-control)
// Source: https://docs.convex.dev/auth/clerk
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",  // MUST match the JWT template name in Clerk Dashboard
    },
  ],
}
```

`CLERK_JWT_ISSUER_DOMAIN` = the Clerk Frontend API URL (e.g., `https://verb-noun-00.clerk.accounts.dev`). Set this on the Convex deployment:
```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-frontend-api.clerk.accounts.dev
```

Then sync: `npx convex dev` (or `deploy`).

### Pattern 4: FastAPI Clerk JWT Dependency

**What:** `Depends(require_clerk_jwt)` guard for dashboard-control FastAPI routes. Models the existing `_require_trigger_secret()` pattern, adds Clerk JWKS verification.

```python
# packages/pipeline/src/eisenbalm_pipeline/api/auth.py  (NEW FILE)
# Source: Clerk manual JWT verification + PyJWT[crypto]
import os
import logging
from functools import lru_cache

import jwt
import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

log = logging.getLogger(__name__)
security = HTTPBearer()


@lru_cache(maxsize=1)
def _get_clerk_jwks_url() -> str:
    """Derive JWKS URL from CLERK_JWT_ISSUER_DOMAIN env var."""
    domain = os.environ.get("CLERK_JWT_ISSUER_DOMAIN", "")
    if not domain:
        raise RuntimeError("CLERK_JWT_ISSUER_DOMAIN not set")
    return f"{domain.rstrip('/')}/.well-known/jwks.json"


def _fetch_public_key(kid: str) -> str:
    """Fetch and cache the PEM public key for a given key ID from Clerk JWKS."""
    jwks = requests.get(_get_clerk_jwks_url(), timeout=5).json()
    from jwt.algorithms import RSAAlgorithm
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            return RSAAlgorithm.from_jwk(key_data)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unknown kid in JWT header",
    )


async def require_clerk_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """FastAPI dependency: verify Clerk JWT, return decoded claims.

    Usage: @router.post("/pipeline/...") async def handler(claims=Depends(require_clerk_jwt))
    claims["sub"] is the Clerk user ID (actorId for audit rows).

    If CLERK_JWT_ISSUER_DOMAIN is unset (local dev), logs a warning and
    skips verification — same degraded-boot pattern as _require_trigger_secret().
    """
    if not os.environ.get("CLERK_JWT_ISSUER_DOMAIN"):
        log.warning("CLERK_JWT_ISSUER_DOMAIN unset — skipping Clerk JWT check (local dev).")
        return {"sub": "local-dev-operator"}

    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        public_key = _fetch_public_key(header["kid"])
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk tokens have no standard aud
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except Exception as exc:
        log.warning("Clerk JWT verification failed: %r", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
```

The `sub` claim in the decoded payload is the Clerk user ID — the `actorId` for audit_log rows and `triggeredBy` for runs rows.

### Pattern 5: Convex Schema Extension (11 New Tables)

**What:** Append inline to existing `convex/schema.ts` using established ASCII section-header comment convention. `workspace_id: v.string()` + `.index('by_workspace', ['workspace_id'])` on every table.

Full-shape tables have all fields defined. Stub tables have minimal schema (workspace_id + one sentinel field). Validators use `v.optional()` for fields that are populated in later phases.

```typescript
// convex/schema.ts — APPEND BELOW existing tables
// (existing 9 tables from pipelineRuns through emailSends unchanged)

// ── Mission Control v2.0 — Phase 21 ─────────────────────────────────────────

// ── workspaces: single-tenant seed (Phase 21 CFG-05) ────────────────────────
workspaces: defineTable({
  workspace_id: v.string(),    // slug — "eisenbalm"
  name: v.string(),            // "The Eisenbalm Dispatch"
  createdAt: v.number(),       // Unix ms
})
  .index('by_workspace', ['workspace_id']),

// ── users: JIT upsert on first authenticated load (Phase 21 AUTH-04) ────────
users: defineTable({
  workspace_id: v.string(),
  clerkUserId: v.string(),     // Clerk "sub" claim — primary lookup key
  email: v.string(),
  displayName: v.optional(v.string()),
  role: v.optional(v.string()),  // "admin" | "operator" — RBAC deferred to Phase 28
  createdAt: v.number(),
  lastSeenAt: v.number(),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_clerkUserId', ['clerkUserId']),

// ── runs: dashboard superset of frozen pipelineRuns (Phase 21 AUTH-04, Phase 23) ──
runs: defineTable({
  workspace_id: v.string(),
  runId: v.string(),           // same UUID as pipelineRuns.runId (join key)
  triggerSource: v.string(),   // "manual" | "cron" | "webhook"
  triggeredBy: v.optional(v.string()), // Clerk userId — optional until Phase 23 wires trigger
  configSnapshot: v.optional(v.string()), // JSON — populated by Phase 22
  status: v.string(),          // mirrors pipelineRuns.status; updated alongside it
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  cost: v.optional(v.string()),    // JSON cost summary — sourced from pipelineRuns.cost
  durationMs: v.optional(v.number()),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_runId', ['runId']),

// ── audit_log: operator action trail (Phase 21 AUTH-04) ─────────────────────
audit_log: defineTable({
  workspace_id: v.string(),
  actorId: v.string(),         // Clerk userId from ctx.auth.getUserIdentity()?.subject
  action: v.string(),          // "workspace.seed" | "run.triggered" | etc.
  resourceType: v.optional(v.string()),  // "run" | "prompt_version" | "config" | etc.
  resourceId: v.optional(v.string()),
  before: v.optional(v.string()),  // JSON snapshot
  after: v.optional(v.string()),   // JSON snapshot
  timestamp: v.number(),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_timestamp', ['workspace_id', 'timestamp']),

// ── STUB TABLES (shape only — mutations added in later phases) ───────────────

// ── agents: per-agent config (Phase 22) ─────────────────────────────────────
agents: defineTable({
  workspace_id: v.string(),
  agentKey: v.string(),        // "scout" | "advocate" | "editor" | etc.
  enabled: v.boolean(),
  model: v.optional(v.string()),
  temperature: v.optional(v.number()),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_agentKey', ['workspace_id', 'agentKey']),

// ── prompt_versions: versioned prompt store (Phase 24) ──────────────────────
prompt_versions: defineTable({
  workspace_id: v.string(),
  agentKey: v.string(),
  version: v.number(),
  content: v.string(),
  isActive: v.boolean(),
  createdAt: v.number(),
  createdBy: v.optional(v.string()),  // Clerk userId
  note: v.optional(v.string()),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_agentKey', ['workspace_id', 'agentKey']),

// ── pipeline_config: global pipeline settings (Phase 22) ────────────────────
pipeline_config: defineTable({
  workspace_id: v.string(),
  key: v.string(),             // "schedule_enabled" | "cost_cap_usd" | etc.
  value: v.string(),           // JSON-encoded
  updatedAt: v.number(),
  updatedBy: v.optional(v.string()),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_key', ['workspace_id', 'key']),

// ── agent_runs: per-node live progress (Phase 23) ───────────────────────────
agent_runs: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  agentKey: v.string(),
  status: v.string(),          // "queued" | "running" | "done" | "failed"
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  costUsd: v.optional(v.number()),
  durationMs: v.optional(v.number()),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_runId', ['runId']),

// ── charities: registry with dedup (Phase 26) ────────────────────────────────
charities: defineTable({
  workspace_id: v.string(),
  name: v.string(),
  status: v.string(),          // "candidate" | "featured" | "blocklisted"
  timesFeatureD: v.optional(v.number()),
  lastFeaturedAt: v.optional(v.number()),
})
  .index('by_workspace', ['workspace_id']),

// ── model_pricing: cost projection table (Phase 27) ─────────────────────────
model_pricing: defineTable({
  workspace_id: v.string(),
  model: v.string(),
  inputPricePer1M: v.number(),   // USD
  outputPricePer1M: v.number(),  // USD
  updatedAt: v.number(),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_model', ['workspace_id', 'model']),

// ── review_actions: content review trail (Phase 26) ─────────────────────────
review_actions: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  actorId: v.string(),
  action: v.string(),          // "approved" | "rejected" | "requested_changes"
  note: v.optional(v.string()),
  timestamp: v.number(),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_runId', ['runId']),
```

### Pattern 6: Idempotent Workspace Seed Mutation

**What:** Called once after `convex dev` first run. Safe to re-run.

```typescript
// convex/workspace.ts (NEW FILE)
import { mutation } from './_generated/server'

export const seedEisenbalm = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('workspaces')
      .withIndex('by_workspace', q => q.eq('workspace_id', 'eisenbalm'))
      .first()
    if (existing) {
      return { seeded: false, message: 'eisenbalm workspace already exists' }
    }
    await ctx.db.insert('workspaces', {
      workspace_id: 'eisenbalm',
      name: 'The Eisenbalm Dispatch',
      createdAt: Date.now(),
    })
    // Log the seed to audit_log with a sentinel actorId
    await ctx.db.insert('audit_log', {
      workspace_id: 'eisenbalm',
      actorId: 'system:seed',
      action: 'workspace.seed',
      resourceType: 'workspace',
      resourceId: 'eisenbalm',
      timestamp: Date.now(),
    })
    return { seeded: true }
  },
})
```

Run via Convex dashboard or: `npx convex run workspace:seedEisenbalm`

### Pattern 7: JIT User Upsert

**What:** On first authenticated load in `dispatch-control`, upsert a `users` row keyed by Clerk user ID. Called from a Convex mutation using `ctx.auth.getUserIdentity()`.

```typescript
// convex/users.ts (NEW FILE)
import { mutation } from './_generated/server'
import { v } from 'convex/values'

const DEFAULT_WORKSPACE_ID = 'eisenbalm'

export const upsertCurrentUser = mutation({
  args: {
    email: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const clerkUserId = identity.subject  // Clerk "sub" claim

    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', q => q.eq('clerkUserId', clerkUserId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: Date.now() })
      return existing._id
    }

    return await ctx.db.insert('users', {
      workspace_id: DEFAULT_WORKSPACE_ID,
      clerkUserId,
      email: args.email,
      displayName: args.displayName,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    })
  },
})
```

### Pattern 8: Sign-In Page (Clerk-Hosted vs. Embedded)

Clerk's `<SignIn />` component requires a catch-all route segment:

```
apps/dispatch-control/app/sign-in/[[...sign-in]]/page.tsx
```

```typescript
// Source: https://clerk.com/docs/quickstarts/nextjs
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
```

Required env var: `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`

### Anti-Patterns to Avoid

- **`proxy.ts` middleware:** This is Next.js 16+. For Next.js 15, always use `middleware.ts`.
- **`ClerkProvider` as Client Component:** `ClerkProvider` can and should be a Server Component in the root layout. Only the Convex provider wrapper needs `'use client'`.
- **Importing `useAuth` from `@clerk/clerk-react`:** In Next.js, always import from `@clerk/nextjs`. They are different packages.
- **Hardcoding `"eisenbalm"` in mutation handlers:** Use the `DEFAULT_WORKSPACE_ID` constant from `lib/workspace.ts`. The string lives in seeded data; code reads it from context/constant.
- **Calling `ctx.auth.getUserIdentity()` and ignoring null:** On unauthenticated calls, this returns null. Always check and throw if null in protected mutations.
- **Using `v.id('workspaces')` as the workspace_id type:** D-14 is explicit — plain `v.string()`. FK semantics deferred.
- **Putting `auth.config.ts` in `apps/dispatch-control/`:** It belongs in the `convex/` workspace package. Convex auth config is deployment-level, not app-level.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth redirect on unauthenticated | Custom redirect middleware | `auth.protect()` in `clerkMiddleware` | Handles redirect URL, cookie state, and the `NEXT_PUBLIC_CLERK_SIGN_IN_URL` env var automatically |
| Sign-in form | Custom login form | `<SignIn />` Clerk component | Email/pass, OAuth, MFA, session management, CSRF — complex to hand-roll securely |
| Convex JWT token passing | Custom `Authorization` header wiring | `ConvexProviderWithClerk` | Handles token refresh, expiry, React concurrent mode correctly |
| User session in Convex mutations | Custom auth context | `ctx.auth.getUserIdentity()` | Built into Convex's auth system; returns `subject` (Clerk userId) reliably |
| JWKS key fetching + rotation | Custom key store | PyJWT + requests to Clerk JWKS endpoint | Clerk rotates keys; fetching fresh from JWKS on each unique `kid` handles this |
| Sidebar navigation | Pure CSS sidebar from scratch | shadcn `Sidebar` primitive (or simple flex layout) | Keyboard navigation, mobile collapse, accessibility attributes |

**Key insight:** Clerk's SDK absorbs the hardest parts of auth — token refresh races, concurrent-mode React issues, JWKS rotation. Don't bypass it.

---

## Common Pitfalls

### Pitfall 1: Missing JWT Template "convex" in Clerk Dashboard (CRITICAL)

**What goes wrong:** `ConvexProviderWithClerk` sends Clerk tokens to Convex, but Convex rejects them with auth errors because no Convex JWT template is configured.

**Why it happens:** The JWT template named `"convex"` must be manually created in the Clerk Dashboard under JWT Templates. `applicationID: "convex"` in `auth.config.ts` must match this template name exactly.

**How to avoid:** After creating the Clerk application, navigate to Clerk Dashboard → JWT Templates → Add Template → choose "Convex". This is a one-time manual setup step that no code can automate.

**Warning signs:** `ConvexProviderWithClerk` throws "Unauthorized" or Convex mutations/queries fail with 401 even though Clerk sign-in works.

### Pitfall 2: `apps/web` Accidentally Gets Clerk Code

**What goes wrong:** `apps/web` becomes auth-gated, breaking the public site.

**Why it happens:** Monorepo workspace packages are shared. If Clerk imports or middleware accidentally land in `apps/web`, the public site breaks.

**How to avoid:** `apps/web` must have ZERO Clerk imports, no `middleware.ts`, no `ClerkProvider`. Smoke test: `curl -s http://localhost:3000 | grep -i "sign in"` should return no matches. Verify after every Phase 21 PR.

**Warning signs:** Public Eisenbalm site redirects to login, or `apps/web` build fails mentioning `@clerk/nextjs`.

### Pitfall 3: Wrong Provider Order / Missing `'use client'` on ConvexClientProvider

**What goes wrong:** React hydration errors, or "useAuth must be used within ClerkProvider" runtime error.

**Why it happens:** `ConvexProviderWithClerk` calls `useAuth()` from `@clerk/nextjs`, which requires `ClerkProvider` to be an ancestor. If `ClerkProvider` is missing or the `'use client'` directive is missing on the wrapper, Next.js server-renders the hook call.

**How to avoid:** Root layout (`app/layout.tsx`) is a Server Component containing `<ClerkProvider>` wrapping a `ConvexClientProvider` (Client Component marked `'use client'`). Never add `'use client'` to `app/layout.tsx`.

**Warning signs:** `Error: useAuth() must be used within a <ClerkProvider>` or `Error: React hooks cannot be used in server components`.

### Pitfall 4: JWKS Fetch Blocks FastAPI Startup

**What goes wrong:** `require_clerk_jwt` fetches JWKS synchronously on every request or at startup, adding latency or causing startup errors if Clerk is unreachable.

**Why it happens:** Naive JWKS fetch with no caching.

**How to avoid:** Cache JWKS responses using `lru_cache` or a module-level dict keyed by `kid`. Refresh only when a new `kid` is seen (Clerk rotates keys infrequently). The pattern in Pattern 4 above uses `lru_cache(maxsize=1)` on the URL getter; for the key itself, use a dict cache with TTL or a lazy-load approach per unique kid.

**Warning signs:** Slow FastAPI response times on authenticated routes; timeout errors if Clerk JWKS endpoint has latency.

### Pitfall 5: Forgetting `workspace_id` on Any New Table

**What goes wrong:** A table without `workspace_id` cannot be scoped for Phase 28 multi-tenancy, requiring a destructive migration over live data.

**Why it happens:** It's easy to skip on stub tables that won't be written to in Phase 21.

**How to avoid:** Every table definition in the new schema block must have `workspace_id: v.string()` and `.index('by_workspace', ['workspace_id'])` before the PR is merged. This is non-negotiable per D-05 and CFG-05. Use a checklist during implementation.

**Warning signs:** Any of the 11 new table definitions missing `workspace_id` in schema.ts.

### Pitfall 6: `dispatch-control` env vars Bleeding Into `apps/web` Vercel Project

**What goes wrong:** `CLERK_SECRET_KEY` appears in `apps/web` Vercel environment, potentially exposing admin credentials to the public Next.js build.

**Why it happens:** If both apps share one Vercel project, Vercel applies all env vars to all builds.

**How to avoid:** `dispatch-control` needs its own Vercel project with its own environment variable set. `apps/web` must never have `CLERK_SECRET_KEY` or `CLERK_PUBLISHABLE_KEY`.

**Warning signs:** Vercel build logs for `apps/web` showing Clerk env vars; `apps/web` bundle including `@clerk/nextjs` code.

### Pitfall 7: NEXT_PUBLIC_CLERK_SIGN_IN_URL Not Set

**What goes wrong:** `auth.protect()` redirects to `undefined` or throws a runtime error instead of `/sign-in`.

**Why it happens:** The redirect URL is read from this env var. Without it, Clerk has no destination.

**How to avoid:** Always set in `.env.local` for dev and in Vercel env vars for prod:
```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
```

---

## Code Examples

### Sign-In Page (Catch-All Route)

```typescript
// Source: Clerk Next.js Quickstart — https://clerk.com/docs/quickstarts/nextjs
// File: apps/dispatch-control/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <SignIn />
    </div>
  )
}
```

### Getting Current User in Server Component / API Route

```typescript
// Source: @clerk/nextjs/server
import { auth, currentUser } from '@clerk/nextjs/server'

// Option A: just the userId
const { userId } = await auth()
if (!userId) redirect('/sign-in')

// Option B: full user object
const user = await currentUser()
const clerkUserId = user?.id  // same as "sub" in JWT
```

### Workspace Constant (D-16)

```typescript
// apps/dispatch-control/lib/workspace.ts
// Source: CONTEXT.md D-16
export const DEFAULT_WORKSPACE_ID = 'eisenbalm'

// Server utility — never hardcode 'eisenbalm' in mutation handlers
export async function getCurrentWorkspace(): Promise<string> {
  // Phase 28: derive from Clerk org slug or session claim
  // Phase 21: single-tenant, always returns the constant
  return DEFAULT_WORKSPACE_ID
}
```

### Triggering Seed from Convex Dashboard / CLI

```bash
# After convex dev is running and schema is synced:
npx convex run workspace:seedEisenbalm
# Expected output: { seeded: true }
# Re-run: { seeded: false, message: 'eisenbalm workspace already exists' }
```

### FastAPI Route Using Both Auth Guards

```python
# packages/pipeline/src/eisenbalm_pipeline/api/runs.py — Phase 21 addition
# Existing cron endpoint keeps _require_trigger_secret (untouched)
# New dashboard-triggered endpoint uses Depends(require_clerk_jwt)
from eisenbalm_pipeline.api.auth import require_clerk_jwt

@router.post("/pipeline/trigger")
async def dashboard_trigger_run(
    request: Request,
    body: RunWeeklyBody,
    claims: dict = Depends(require_clerk_jwt),   # NEW: Clerk JWT guard
) -> dict:
    """Dashboard-triggered run. Operator's clerkUserId goes on the runs row."""
    graph = _require_graph(request)
    operator_id = claims.get("sub")  # Clerk userId for audit trail
    # ... rest of trigger logic, passing operator_id to runs:create
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | dispatch-control scaffolding | ✓ | 18+ (engines field) | — |
| pnpm | workspace install | ✓ | 9.15.4 (packageManager field) | — |
| `@clerk/nextjs` | AUTH-01/02 | ✓ (npm, not yet installed in dispatch-control) | 7.5.7 | — |
| `convex` (react-clerk subpath) | ConvexProviderWithClerk | ✓ (in workspace root node_modules) | 1.38.0 | — |
| PyJWT[crypto] | AUTH-03 FastAPI JWT | Available in pipeline venv (already vendored) | ^2.x | — |
| Clerk Dashboard (JWT template) | Convex auth | Manual step required | — | None — blocks Convex auth |
| Vercel project for dispatch-control | Deployment | Needs creation | — | Local dev works; Vercel project is prod prerequisite |
| `CLERK_JWT_ISSUER_DOMAIN` env var on Convex | auth.config.ts | Not yet set | — | Local dev with `npx convex dev` once set |

**Missing dependencies with no fallback:**
- Clerk Dashboard "Convex" JWT template — must be manually created before `ConvexProviderWithClerk` works.

**Missing dependencies with fallback:**
- Vercel project for dispatch-control — local dev (`next dev --port 3001`) works until prod deployment is needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.2.0 (same as apps/web) |
| Config file | `apps/dispatch-control/vitest.config.ts` — Wave 0 gap |
| Quick run command | `pnpm --filter dispatch-control test:unit` |
| Full suite command | `pnpm --filter dispatch-control test:unit` (same for Phase 21 scope) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | All dashboard routes redirect unauthenticated users | smoke / e2e | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/graph` → 302 | ❌ Wave 0 |
| AUTH-01 | apps/web routes return 200 without auth headers | smoke | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200 | ❌ Wave 0 |
| AUTH-02 | FastAPI dashboard endpoint returns 401 without JWT | unit | `pytest packages/pipeline/tests/test_auth.py::test_require_clerk_jwt_missing -x` | ❌ Wave 0 |
| AUTH-02 | FastAPI dashboard endpoint returns 401 with expired JWT | unit | `pytest packages/pipeline/tests/test_auth.py::test_require_clerk_jwt_expired -x` | ❌ Wave 0 |
| AUTH-03 | Railway cron path (X-Pipeline-Trigger-Secret) still works | unit | `pytest packages/pipeline/tests/api/test_runs.py::test_trigger_secret_accepted -x` | ✅ (existing test) |
| AUTH-04 | audit_log rows carry actorId from Clerk sub claim | unit | `pnpm --filter dispatch-control test:unit -- --grep "audit_log actorId"` | ❌ Wave 0 |
| CFG-05 | All 11 new tables present in schema with workspace_id | static / type check | `pnpm --filter @eisenbalm/convex typecheck` | ✅ (once schema written) |
| CFG-05 | Seed mutation is idempotent (second call no-ops) | unit | Convex test via `npx convex run workspace:seedEisenbalm` x2 | ❌ Wave 0 (manual) |
| CFG-05 | users table upsert on JIT provision | unit | `pnpm --filter dispatch-control test:unit -- --grep "upsertCurrentUser"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter dispatch-control typecheck && pnpm --filter @eisenbalm/convex typecheck`
- **Per wave merge:** `pnpm --filter dispatch-control test:unit` (full unit suite)
- **Phase gate:** Auth smoke tests (unauthenticated redirect + apps/web unaffected) green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/dispatch-control/vitest.config.ts` — Vitest config (copy from apps/web)
- [ ] `apps/dispatch-control/tests/auth.test.ts` — AUTH-01 middleware unit tests (mock Clerk auth state)
- [ ] `packages/pipeline/tests/test_auth.py` — AUTH-02/03 FastAPI JWT dependency unit tests
- [ ] `apps/dispatch-control/tests/workspace.test.ts` — CFG-05 JIT user upsert tests

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `authMiddleware()` from `@clerk/nextjs` | `clerkMiddleware()` + `createRouteMatcher()` | Clerk Core 3 / ^5.x | `authMiddleware` is deprecated and removed in ^7; must use new API |
| `middleware.ts` (Next.js ≤15) | `proxy.ts` (Next.js 16+) | Next.js 16 beta | We are on Next.js 15.3.9 — use `middleware.ts`, NOT `proxy.ts` |
| `import { ConvexProviderWithClerk } from 'convex/react-clerk'` | Same | Current | Confirmed present in convex@1.38.0 at this subpath |
| `jwt.decode()` without verification | `jwt.decode()` + JWKS verify with `jwt.decode()` first for `kid`, then `jwt.decode()` with key | PyJWT ^2 | Always verify signature; `get_unverified_header` for kid lookup only |

**Deprecated/outdated:**
- `authMiddleware` from `@clerk/nextjs`: removed in ^7. Do not use.
- `withClerkMiddleware`: older Clerk pattern, removed.
- `getAuth(req)` (pages router pattern): not applicable to App Router.

---

## Open Questions

1. **Vercel Project Isolation for dispatch-control**
   - What we know: `apps/web` is deployed as one Vercel project. `dispatch-control` needs `CLERK_SECRET_KEY` and other admin env vars that must never appear in `apps/web`.
   - What's unclear: Whether to create a second Vercel project for `dispatch-control` at Phase 21 execution time, or defer to when deployment is needed.
   - Recommendation: Create a separate Vercel project named `eisenbalm-dispatch-control` during Phase 21. The env-var isolation is critical security. The SUMMARY.md open gap explicitly flags this as a Phase 21 action. Do it now rather than risk a security mistake at a later phase.

2. **`pnpm-workspace.yaml` already covers `apps/*`**
   - What we know: `pnpm-workspace.yaml` already has `- 'apps/*'`. Creating `apps/dispatch-control/` is automatically picked up by pnpm workspaces. No changes to the workspace file needed.
   - What's unclear: Nothing — this is resolved. Scaffold the folder; pnpm finds it.
   - Recommendation: No action on workspace config. Just scaffold `apps/dispatch-control/`.

3. **Convex `auth.config.ts` location**
   - What we know: This file configures Convex deployment-level auth. It belongs in the `convex/` package (which is already a workspace package per `pnpm-workspace.yaml`). It is NOT an app-level file.
   - What's unclear: Nothing — verified from Convex docs.
   - Recommendation: Create `convex/auth.config.ts`. Run `npx convex dev` (or `pnpm --filter @eisenbalm/convex dev`) to push the auth config to the `modest-magpie-797` deployment.

---

## Project Constraints (from CLAUDE.md)

The following directives from `./CLAUDE.md` apply to Phase 21 work:

- **Tech stack is locked:** Next.js 14+ (App Router), Sanity v3, FastAPI on Railway, LangGraph, OpenRouter, Supabase, Convex, Stripe, WeasyPrint/Playwright. Do not substitute.
- **Monorepo structure:** `apps/web`, `apps/studio`, `packages/pipeline`, `packages/shared`, `convex/`. `apps/dispatch-control` is the new app being scaffolded.
- **Schema files:** Do not modify field names in `convex/schema.ts` existing tables without checking `docs/API_CONTRACTS.md`. The 9 existing tables are frozen (D-17).
- **GSD workflow enforcement:** All edits must go through a GSD workflow entry point. No direct repo edits outside GSD.
- **Security (Game agent):** Not directly relevant to Phase 21 but the general principle of defense in depth applies. Auth secrets never committed, never in Convex, only in env vars.
- **Convex guidelines:** `convex/CLAUDE.md` instructs to read `convex/_generated/ai/guidelines.md` before writing Convex code. The file does not currently exist (confirmed), but the instruction stands — run `npx convex ai-files install` if Convex patterns are uncertain.
- **camelCase identifiers, kebab-case status literals:** Field naming in new Convex tables should follow `camelCase` for code identifiers. Status literals (e.g., `"manual"`, `"running"`) use `kebab-case` per existing convention.
- **ASCII section headers:** Large schema additions use `// ── Name ──────` separators per `schemas/weeklyIssue.ts` convention. Already incorporated into Pattern 5.

---

## Sources

### Primary (HIGH confidence)

- Clerk Middleware docs — `https://clerk.com/docs/references/nextjs/clerk-middleware` — `clerkMiddleware`, `createRouteMatcher`, `auth.protect()`, `middleware.ts` vs `proxy.ts` distinction, Next.js 15 matcher config
- Convex Clerk integration docs — `https://docs.convex.dev/auth/clerk` — `ConvexProviderWithClerk` import path (`convex/react-clerk`), provider hierarchy, `auth.config.ts` format, `CLERK_JWT_ISSUER_DOMAIN`, JWT template name `"convex"`
- npm registry — `@clerk/nextjs@7.5.7` confirmed latest 7.x, `convex@1.38.0` workspace installed
- `convex/schema.ts` (this repo) — existing 9 tables, ASCII section-header convention, `.index()` naming patterns, `v.*` validator usage
- `apps/web/package.json` (this repo) — `next@^15.3.9`, `react@^19.2.6`, versions to clone
- `apps/web/components.json` (this repo) — shadcn config shape to replicate for dispatch-control
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` (this repo) — `_require_trigger_secret()` pattern to model `require_clerk_jwt` on; `asyncio.create_task` background pattern
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` (this repo) — lifespan, `app.state` pattern, degraded-boot approach
- Convex module inspection (filesystem) — `convex/react-clerk/ConvexProviderWithClerk.js` confirmed present in `node_modules/.pnpm/convex@1.38.0_react@19.2.6/`

### Secondary (MEDIUM confidence)

- Clerk manual JWT verification guide — `https://clerk.com/docs/guides/sessions/manual-jwt-verification` — JWKS endpoints, RS256, claims (`sub`, `exp`, `nbf`, `azp`), Python verification approach verified by Medium article pattern
- Medium article: FastAPI + Clerk JWT — `https://medium.com/@didierlacroix/building-with-clerk-authentication-user-management-part-2-implementing-a-protected-fastapi-f0a727c038e9` — JWKS key fetch pattern, `jwt.get_unverified_header()` for kid extraction, `sub` claim for user ID
- Clerk Next.js Quickstart — `https://clerk.com/docs/quickstarts/nextjs` — `[[...sign-in]]` catch-all route requirement, `ClerkProvider` placement, env var names

### Tertiary (LOW confidence — for validation)

- `https://masteringconvex.com/authentication/clerk` — secondary source confirming `applicationID: "convex"` convention

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed against npm registry and installed node_modules
- Architecture: HIGH — patterns sourced from official Clerk + Convex docs, cross-verified with existing repo patterns
- Convex schema: HIGH — directly modeled on existing `convex/schema.ts` conventions in this repo
- FastAPI JWT guard: MEDIUM-HIGH — Clerk docs confirm JWKS endpoint and RS256; PyJWT pattern confirmed from official PyJWT docs and verified community implementation
- Pitfalls: HIGH — sourced from milestone research PITFALLS.md (which cites real codebase) plus official docs
- Test architecture: MEDIUM — test file gaps identified; Vitest already used in apps/web so framework is not in question

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (Clerk and Convex both have active release cadences; verify patch versions before install)
