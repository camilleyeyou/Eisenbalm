---
status: partial
phase: 21-auth-app-shell-convex-schema
source: [21-VERIFICATION.md]
started: 2026-06-21
updated: 2026-06-21
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live Clerk sign-in flow (Plans 21-03 + 21-05 checkpoints)
expected: With real Clerk keys in `apps/dispatch-control/.env.local`, a Clerk JWT template named exactly `convex`, and `CLERK_JWT_ISSUER_DOMAIN` set on the Convex deployment — visiting `http://localhost:3001/graph` in an incognito window redirects to the Clerk sign-in page; after signing in you land on `/graph`; the left sidebar shows all 7 nav items in order (Graph, Runs, Config, Prompts, Registry, Finance, Settings); each nav item routes to a rendering placeholder page; the active item is highlighted; the Clerk `UserButton` appears in the sidebar footer and opens the account/sign-out menu; no Convex 401 appears in the browser console; and `http://localhost:3000/` (apps/web) still loads with no sign-in prompt.
result: [pending]

### 2. seedEisenbalm idempotency CLI proof
expected: `npx convex run workspace:seedEisenbalm` returns `{ seeded: true }` on the first call and `{ seeded: false }` on the second; querying `workspaces` by `workspace_id="eisenbalm"` returns exactly one record. (`convex-test` is not installed, so this is verified via the CLI per 21-02-SUMMARY.md.)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
