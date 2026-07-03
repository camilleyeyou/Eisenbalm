# @eisenbalm/convex — Convex schema + queries + mutations

**Status:** Phase 3 deployed. Live backend for the Pipeline's deliberation stream and the web app's `useQuery` subscriptions.
**Stack:** Convex 1.38.x (cloud production deployment).
**Owns:** the schema (`convex/schema.ts`) and the five query/mutation modules.
**Consumed by:**
- `apps/web` — via `@convex/_generated/api` (browser `useQuery` subscriptions)
- `packages/pipeline` (Phase 4) — via the Convex HTTP API (`POST /api/mutation`, `Authorization: Convex <DEPLOY_KEY>`)

---

## Tables

Defined in [`convex/schema.ts`](./schema.ts). Five tables, one row per logical event:

| Table | Purpose | Indexes |
|---|---|---|
| `pipelineRuns` | One row per weekly pipeline run; status flips `running → awaiting-review → complete` (or `failed`) | `by_runId`, `by_issueNumber` |
| `deliberationEvents` | Every agent event during a run — the raw deliberation stream (scout-finding, advocate-argument, editor-decision, section-draft, qa-correction, editor-final, publisher-deploy) | `by_runId`, `by_runId_and_type` |
| `agentVotes` | Subset of deliberationEvents but queryable — for/against/abstain with reasoning | `by_runId`, `by_runId_and_charity` |
| `qaCorrections` | What QA caught and why — severity minor/moderate/major | `by_runId`, `by_runId_and_section` |
| `pitchLog` | Scout's candidate pitches before deliberation — `selected` flag flipped after Editor gate 1 | `by_runId`, `by_runId_and_selected` |

Do not modify `schema.ts` field names without checking [`docs/API_CONTRACTS.md`](../docs/API_CONTRACTS.md) §3 (mutation call shapes) and §4 (query handler bodies) first. Field names are locked across schema + contracts + types per [`CLAUDE.md`](../CLAUDE.md).

---

## Phase 20 — Email lifecycle tables

Two new tables added in Phase 20 (Plans 20-02). Both are **additive** — no existing table or field was modified.

| Table | Purpose | Indexes |
|---|---|---|
| `emailSubscribers` | Consent ledger — one row per email address; tracks `consentState` (subscribed/unsubscribed), the 64-char hex `unsubscribeToken`, and `source`. Unsubscribing suppresses all marketing emails (E4–E8) while transactional emails (E1–E3) continue. | `by_email`, `by_token` |
| `emailSends` | Idempotent send ledger — one row per `(orderId, step)` pair; the primary idempotency key for the 8-email flow. Carries `scheduledFnId` (the Convex scheduled-function id) so the unsubscribe path can call `ctx.scheduler.cancel()` on pending steps. | `by_orderId`, `by_orderId_step` (**the idempotency lookup**), `by_email_step`, `by_status` |

Function modules:

| File | Queries | Mutations |
|---|---|---|
| `emailSubscribers.ts` | `getByEmail`, `getByToken` | `upsertSubscriber` |
| `emailSends.ts` | `getByOrderStep` | `insertScheduled`, `markSent`, `markFailed`, `markSkipped` |

All functions are **internal** (`internalQuery`/`internalMutation`) — not callable from the browser client.

---

## Phase 4 additions (Pipeline Skeleton)

Two optional fields were added to the `pipelineRuns` table:

- `durationMs: v.optional(v.number())` — pipeline wall-clock duration in ms (PIP-12).
- `cost: v.optional(v.string())` — JSON-stringified per-agent cost summary (PIP-11 + OPS-03). The string mirrors the `modelVersions` pattern; nested object validation may come in Phase 5 (CONTEXT D-22).

Both fields are also accepted by `pipelineRuns:updateStatus` mutation args.

See [`.planning/phases/04-pipeline-skeleton/04-CONTEXT.md`](../.planning/phases/04-pipeline-skeleton/04-CONTEXT.md) D-22, D-23, D-39 for the full context.

---

## Function files

One file per table — five files total. Filenames are the API surface: `convex/pipelineRuns.ts` produces `api.pipelineRuns.byRunId`, etc. Each file is a verbatim copy of `docs/API_CONTRACTS.md` §4.

| File | Queries | Mutations |
|---|---|---|
| `pipelineRuns.ts` | `byRunId` | `create`, `updateStatus` |
| `pitchLog.ts` | `byRunId` | `insert`, `markSelected` |
| `deliberationEvents.ts` | `byRunId`, `byRunIdAndType` | `insert` |
| `agentVotes.ts` | `byRunId`, `byRunIdAndCharity` | `insert` |
| `qaCorrections.ts` | `byRunId` | `insert` |

Every insertion mutation sets `timestamp: Date.now()` server-side — never trust the caller's clock. Every enum-like argument uses `v.literal(...)` unions matching `schema.ts` byte-for-byte.

---

## First-time setup (one machine, one time)

### Prerequisites

- Node.js ≥ 18.18 — `node -v`
- pnpm ≥ 9 — `pnpm -v`
- A Convex Cloud account — free tier is fine, sign up at https://dashboard.convex.dev (GitHub OAuth recommended)

All commands run from the repository root unless stated.

### 1. Install dependencies

```bash
pnpm install
```

pnpm resolves the new `@eisenbalm/convex` workspace (added in Phase 3) plus the existing `studio`, `web`, `pipeline`, `@eisenbalm/shared`.

### 2. Provision the Convex deployment (interactive, one time)

From the repo root:

```bash
pnpm --filter @eisenbalm/convex exec convex dev --once --configure
```

The CLI is interactive. Choose:
- **A new project**
- Project name suggestion: `eisenbalm-dispatch`
- Pick your Convex team
- For "How would you like to use Convex?" → **Cloud** (we run a single deployment per project decision D-02; no separate staging cloud deployment)

The CLI writes:
- `convex/convex.json` (CLI config — committed)
- `convex/.env.local` (deployment hint — gitignored, contains `CONVEX_DEPLOYMENT=<deployment-name>`)
- `convex/_generated/{api,server,dataModel}.{ts,d.ts,js}` (codegen output — committed per project decision D-08)

The CLI also pushes `schema.ts` to the new deployment.

> **Note on dev vs production deployments:** Convex's `--configure` flow auto-provisions a **dev** deployment (Plan 03-02 Deviation 1). The resulting Deploy Key starts with `dev:`, NOT `prod:`. This is the single environment Phase 3 uses; D-02's "single deployment" intent is honored (we have exactly one Convex environment). When/if a production deployment is later promoted via the Convex dashboard, regenerate the deploy key — it will then start with `prod:`.

### 3. Verify `convex.json` has `"functions": "./"`

Our layout has `convex/package.json` and `convex/schema.ts` as siblings, NOT under a nested `convex/convex/`. The CLI defaults assume the nested layout, so `convex.json` may need a hand-correction (this is 03-RESEARCH Pitfall 6):

```bash
cat convex/convex.json
```

If the file does not contain `"functions": "./"`, replace its contents with:

```json
{
  "$schema": "https://convex.dev/schemas/convex.json",
  "functions": "./"
}
```

Commit `convex/convex.json`.

### 4. Capture the deployment URL and Deploy Key

Open https://dashboard.convex.dev → your new project → **Settings**.

- **Deployment URL** — looks like `https://<adjective>-<animal>-<number>.convex.cloud`. This is `NEXT_PUBLIC_CONVEX_URL` (public).
- **Deploy Keys** section → **Generate Deploy Key** → in Phase 3's dev-deployment posture this starts with `dev:`. (After Andrew promotes to production it will start with `prod:`.) This is `CONVEX_DEPLOY_KEY` (SECRET). **You will not see it again** — save it somewhere safe immediately.

> ⚠️ `CONVEX_DEPLOY_KEY` grants full read/write to every Convex mutation. **Treat it like a database password. NEVER commit. NEVER expose via `NEXT_PUBLIC_*`. NEVER log.**

Add both values to `apps/web/.env.local` (gitignored):

```bash
echo "NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud" >> apps/web/.env.local
echo "CONVEX_DEPLOY_KEY=dev:<your-key>" >> apps/web/.env.local
```

### 5. Push the function files

```bash
pnpm deploy:convex
```

The CLI pushes the 5 modules (pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections) and regenerates `convex/_generated/`. Commit any changes to `convex/_generated/` after this step (per project decision D-08).

### 6. Verify in the Convex dashboard

Open https://dashboard.convex.dev → your project:

1. **Data** tab: 5 tables visible, each with 0 rows.
2. **Functions** tab: 5 modules visible. Click each — confirm the expected query/mutation exports are listed (see the **Function files** table above).
3. Pick `pipelineRuns:byRunId` → **Run Query** pane → enter `{"runId": "nonexistent"}` → click Run → expected result: `null`.
4. Pick any of the four `.collect()` queries (e.g. `pitchLog:byRunId`) → same args → expected result: `[]`.

### 7. Verify from the web app

```bash
pnpm dev:web
```

Browse to an issue page (`/issue/[slug]`) and confirm the "Watch the Machines Decide" deliberation band renders without console errors. As of Phase 29 (D-7/D-8), this render path is Sanity props only — `DeliberationSlot.tsx` no longer opens Convex subscriptions, so there is no dedicated debug route to visit. Verify Convex writes directly via the dashboard steps above.

---

## Day-to-day workflow

| Task | Command (run from repo root) |
|---|---|
| Open the Convex dashboard | `pnpm --filter @eisenbalm/convex dashboard` |
| Deploy schema + functions after edits | `pnpm deploy:convex` |
| Regenerate `_generated/` only (no deploy) | `pnpm codegen:convex` |
| Typecheck the workspace | `pnpm typecheck:convex` |
| Watch mode (rare — Phase 4+) | `pnpm dev:convex` |

After editing `convex/schema.ts` or any function file:

1. Run `pnpm deploy:convex` (pushes + regenerates `_generated/`)
2. Commit both the source change AND the updated `convex/_generated/` files

No CI gate is currently configured (project decision D-22 / Phase 1 D-15). Engineers run typechecks locally.

---

## Environment variables

Defined in [`convex/.env.local`](./.env.local) (gitignored, auto-managed by the CLI) and at the workspaces that consume Convex:

| Variable | Value | Required by |
|---|---|---|
| `CONVEX_DEPLOYMENT` | CLI-managed deployment name (e.g. `dev:adjective-animal-NNN`) | Convex CLI (auto-written to `convex/.env.local` by `--configure`) |
| `NEXT_PUBLIC_CONVEX_URL` | `https://<deployment>.convex.cloud` | `apps/web` (browser `ConvexReactClient`), and Phase 4 pipeline (HTTP API base URL) |
| `CONVEX_DEPLOY_KEY` | `dev:<key>` (or `prod:<key>` after promotion) — SECRET | `convex deploy` (CI / build step), Phase 4 pipeline (`Authorization: Convex <key>` for HTTP API mutations) |

The two env vars Andrew populates manually are documented in:
- [`apps/web/.env.example`](../apps/web/.env.example) — for the web app
- [`.env.example`](../.env.example) at repo root — for the Phase 4 pipeline reference

---

## Vercel + Railway env provisioning (manual)

Project decision **D-22**: env provisioning to remote services is Andrew's manual step. The plan does NOT automate it. Documented here so a fresh hand can complete it.

**Vercel** (when the `apps/web` Vercel project exists — Phase 2 did not require it):

```bash
cd apps/web
npx vercel env add NEXT_PUBLIC_CONVEX_URL production
npx vercel env add CONVEX_DEPLOY_KEY production
```

Paste the values when prompted. (`CONVEX_DEPLOY_KEY` is needed by the Vercel build step — the official Convex hosting pattern is `npx convex deploy --cmd 'npm run build'`, which uses the deploy key to push functions before Next.js builds. Not in scope for Phase 3, but the env var should be present.)

**Railway** (when the Phase 4 pipeline service exists — Phase 4 sets this):

```bash
railway variables set NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
railway variables set CONVEX_DEPLOY_KEY=dev:<key>
```

---

## HTTP API smoke (Phase 4 readiness)

Phase 4 (Pipeline Skeleton) will call Convex mutations from Python via HTTP. The same Deploy Key authenticates that channel. To verify the pathway works before Phase 4 lands, run this curl:

```bash
source apps/web/.env.local
curl -X POST "${NEXT_PUBLIC_CONVEX_URL}/api/mutation" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Convex ${CONVEX_DEPLOY_KEY}" \
  -d "{
    \"path\": \"pipelineRuns:create\",
    \"args\": {
      \"runId\": \"smoke-test-curl-$(date +%s)\",
      \"issueNumber\": 0,
      \"startedAt\": $(node -e 'console.log(Date.now())')
    },
    \"format\": \"json\"
  }"
```

Expected response: `{"status":"success","value":"<convex_id>","logLines":[]}`.

Cleanup: delete the test row via the Convex dashboard (Data → pipelineRuns → row → ⋯ → Delete) or another mutation call. The synthetic `runId` does not correspond to any Sanity document, so it is safe to leave but tidy to remove.

---

## /_debug/convex route (removed in Phase 29)

Phase 3 added `apps/web/app/%5Fdebug/convex/page.tsx` (URL: `/_debug/convex`) as a CVX-05 evidence surface — it called all five `byRunId` queries with a synthetic `runId: "phase-3-smoke-test"` and rendered a five-row table. **Phase 29 (D-7) removed this route entirely**: the file, the `Disallow: /_debug/` robots.txt entry, and the mentions in `apps/web/README.md` and this file are gone. It was publicly routable with no auth gate, so it stayed a live liability past the point real deliberation data ships from Sanity. Do not recreate an unauthenticated debug route under this or a similar name.

---

## What lives where

- [`convex/schema.ts`](./schema.ts) — 5 table definitions + indexes (existing from before Phase 3, do not modify)
- [`convex/pipelineRuns.ts`](./pipelineRuns.ts) — `byRunId` query + `create`/`updateStatus` mutations
- [`convex/pitchLog.ts`](./pitchLog.ts) — `byRunId` query + `insert`/`markSelected` mutations
- [`convex/deliberationEvents.ts`](./deliberationEvents.ts) — `byRunId`/`byRunIdAndType` queries + `insert` mutation
- [`convex/agentVotes.ts`](./agentVotes.ts) — `byRunId`/`byRunIdAndCharity` queries + `insert` mutation
- [`convex/qaCorrections.ts`](./qaCorrections.ts) — `byRunId` query + `insert` mutation
- [`convex/_generated/`](./_generated/) — codegen output, committed to git (project decision D-08)
- [`convex/convex.json`](./convex.json) — CLI config (`"functions": "./"`)
- [`convex/package.json`](./package.json) — workspace manifest (`@eisenbalm/convex`)
- [`convex/tsconfig.json`](./tsconfig.json) — TS config extending `tsconfig.base.json`
- [`convex/.env.local`](./.env.local) — CLI-managed local deployment hint (gitignored)

---

## Reference

- [`docs/API_CONTRACTS.md`](../docs/API_CONTRACTS.md) §3 — Pipeline → Convex mutation call shapes (Python-side). Used as the EXACT input shapes the mutation argument validators must accept.
- [`docs/API_CONTRACTS.md`](../docs/API_CONTRACTS.md) §4 — Next.js → Convex TypeScript query files. Copied verbatim into the five function files in this workspace.
- [`docs/CLAUDE_CODE_BRIEF.md`](../docs/CLAUDE_CODE_BRIEF.md) — Convex usage notes (deliberation stream, run status, no auth).
- [`CLAUDE.md`](../CLAUDE.md) — Top-level project directive: "do not modify field names without checking API_CONTRACTS.md first."

---

## Troubleshooting

**`pnpm --filter @eisenbalm/convex exec convex dev` says "not in a Convex project".**
Run from repo root (not from inside `convex/`). The `--filter @eisenbalm/convex` selects the right workspace.

**`convex.json` was written with `"functions": "convex/"`.**
The CLI defaults assume the nested layout. Hand-correct to `"functions": "./"` per step 3 above (Pitfall 6).

**`convex deploy` fails with `Cannot find module './_generated/server'`.**
Expected on the FIRST deploy after the function files land — the CLI generates `_generated/` as part of deploy. Retry; should succeed.

**Convex data isn't showing up on an issue page.**
`NEXT_PUBLIC_CONVEX_URL` is not set in `apps/web/.env.local`, or it points at a different deployment than the one the function files are deployed to. Re-run step 4. Note: the deliberation band on `/issue/[slug]` renders from Sanity props, not a live Convex subscription (Phase 29 D-8) — check Sanity content first if that section looks empty.

**`401 Unauthorized` from `/api/mutation` curl.**
The `CONVEX_DEPLOY_KEY` is from a different deployment or is malformed. Regenerate at dashboard → Settings → Deploy Keys.

**`convex deploy` reports "Schema validation failed" with kebab-case literal errors.**
A function file's `v.literal(...)` union does not match `schema.ts` exactly. `awaiting-review` (not `awaitingReview`), `scout-finding` (not `scoutFinding`), etc.

---

*Phase 3 owner: gsd-planner.*
*Phase 4 (next): Pipeline Skeleton — will write to all five tables via HTTP API.*
*Phase 29: removed `/_debug/convex` and the dead `<DeliberationSlot>` Convex subscriptions (D-7/D-8); deliberation renders from Sanity props.*
