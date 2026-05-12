# Phase 3: Convex Deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 03-convex-deployment
**Mode:** auto (user requested no clarifying questions)
**Areas analyzed:** Convex CLI init checkpoint, Monorepo placement, Deployment topology, Function file layout, Generated artifacts, Web app provider scope, CVX-05 verification surface, Env var provisioning, Smoke test, Documentation

---

## Convex CLI init checkpoint

| Option | Description | Selected |
|--------|-------------|----------|
| Manual interactive checkpoint by Andrew (mirrors Phase 1 D-20 sanity-init) | Andrew runs `npx convex dev --once --configure` once; plan ships everything around it. | ✓ |
| Automated via script | Try to script the OAuth + deployment creation. | |

**Reasoning:** Convex CLI requires OAuth (browser-based) auth on first run. Scripting it is unreliable. Phase 1 already established the "manual interactive checkpoint" pattern with `npx sanity@latest init`; reuse it.

---

## Monorepo placement of `convex/`

| Option | Description | Selected |
|--------|-------------|----------|
| Install `convex` in `apps/web` only | Web is the only frontend consumer; CLI runs via `pnpm --filter web exec convex`. | |
| Promote `convex/` to its own workspace (`@eisenbalm/convex`) | Adds `convex/package.json` so the CLI has a proper workspace home; respects brief's "keep at repo root" rule. | ✓ |
| Install `convex` at the repo root | Add `convex` as a root dep; no new workspace. | |

**Reasoning:** Brief locks `convex/` at repo root. Phase 1 D-05 established a monorepo with workspaces. Promoting `convex/` itself to a workspace cleanly satisfies both constraints — the directory stays where the brief wants it, but the CLI is owned by a real package. Cleaner than rooting `convex` deps under `apps/web` (which logically owns frontend, not the Convex deployment).

---

## Deployment topology

| Option | Description | Selected |
|--------|-------------|----------|
| Single `production` Convex deployment | Mirrors Phase 2 D-15 (`production` Sanity dataset only). | ✓ |
| Dev + prod deployments (Convex's per-developer dev deployment pattern) | Each engineer gets a dev deployment; prod separate. | |

**Reasoning:** Single-engineer ops (Andrew). Weekly cadence. v1 doesn't need staging. Matches Phase 2's "production dataset only" decision.

---

## Function file layout

| Option | Description | Selected |
|--------|-------------|----------|
| One file per table (5 files: pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections) — exact API_CONTRACTS §4 match | Copies the contract verbatim. | ✓ |
| Consolidated into fewer files (e.g. `convex/queries.ts` + `convex/mutations.ts`) | Less mirror of contract; harder to audit. | |

**Reasoning:** API_CONTRACTS §4 spells out the EXACT file structure (§4.1 = pipelineRuns.ts, §4.2 = pitchLog.ts, etc.). The contract IS the implementation. No creativity needed.

---

## Generated artifacts policy

| Option | Description | Selected |
|--------|-------------|----------|
| Check `convex/_generated/` into git | Mirrors Phase 1 D-08 + D-14 (Sanity TypeGen artifacts checked in for stability). | ✓ |
| Gitignore `convex/_generated/` | Common Convex pattern; engineers regenerate locally. | |

**Reasoning:** Consistency with Phase 1's Sanity TypeGen decision. Type stability across CI / fresh clones outweighs the diff noise from regenerated files.

---

## Web app provider scope

| Option | Description | Selected |
|--------|-------------|----------|
| Mount `ConvexProvider` in root `apps/web/app/layout.tsx` | Single shared client; future-proofs Phase 9. | ✓ |
| Scope to `apps/web/app/issue/[slug]/layout.tsx` only | No Convex overhead on `/archive`, `/charities`, etc. | |

**Reasoning:** Convex client is cheap when no `useQuery` is mounted (idle websocket). Root layout means one configuration point. Phase 9's deliberation UI lives on `/issue/[slug]` but other surfaces (e.g. a future admin view) might also want subscriptions.

---

## CVX-05 verification surface

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden `/_debug/convex` route running all 5 `useQuery` calls | Clean separation; explicitly removed in Phase 9; not linked from nav/sitemap/RSS. | ✓ |
| Wire `useQuery` directly into `DeliberationSlot` now | Advances Phase 9 prematurely; mingles Phase 3 and Phase 9 concerns. | |
| Server-side health-check route (`/api/health/convex`) | Doesn't exercise `useQuery` — doesn't satisfy CVX-05 wording. | |
| Convex dashboard only, defer all web wiring to Phase 9 | Conflicts with CVX-05 wording ("Web app `useQuery` subscriptions"). | |

**Reasoning:** CVX-05 explicitly requires `useQuery` to fire in the web app. The cleanest path is a debug route that's clearly marked as Phase 3 scaffolding (TODO(Phase 9): remove) and excluded from public surfaces.

---

## Env var provisioning (Vercel + Railway)

| Option | Description | Selected |
|--------|-------------|----------|
| Manual, documented in README (`vercel env add`, `railway variables set`) | Mirrors Phase 2 D-27 manual-deploy pattern. | ✓ |
| Automated via plan tasks | Risk: Vercel/Railway projects may not be linked yet; failure mode worse than friction. | |

**Reasoning:** Andrew owns infra provisioning. Phase 2 already locked in "manual, documented" for Vercel deploys. Convex env vars follow the same pattern.

---

## Smoke test approach

| Option | Description | Selected |
|--------|-------------|----------|
| End-of-phase manual smoke test in README (6-step checklist, including curl mutation) | Mirrors Phase 1 + Phase 2 end-of-phase manual smoke tests. | ✓ |
| Automated integration test | Would need a test Convex deployment + fixtures — overkill for v1. | |

**Reasoning:** Pattern match to Phase 1 (`apps/studio/README.md` smoke) and Phase 2 (`apps/web/README.md` smoke). v1 holds the line on no CI / no automated integration tests.

---

## Documentation

| Option | Description | Selected |
|--------|-------------|----------|
| New `convex/README.md` + new Convex section in `apps/web/README.md` | Two READMEs: one for the Convex workspace, one for the web app's Convex consumer. | ✓ |
| Single `apps/web/README.md` update | Less duplication but ambiguous ownership of the Convex workspace. | |

**Reasoning:** Each workspace owns its README. `convex/` is now a workspace, so it gets its own onboarding doc.

---

## Claude's Discretion

- Exact tsconfig path-alias shape (`@convex/*` vs `~convex/*` vs relative imports) — planner picks.
- Exact wording of the `/_debug/convex` page table (Jesse voice) — planner drafts.
- Lazy vs eager `ConvexReactClient` instantiation — planner picks based on Next 15 RSC compatibility.
- Whether to silence Convex's verbose websocket logging in production — planner decides.

## Deferred Ideas

- `@eisenbalm/convex-types` shared export
- Convex auth (no logged-in readers in v1)
- Per-developer Convex dev deployments
- Convex HTTP actions, crons, Vector / Search / File Storage
- CI gate on `convex typecheck`
- `useQuery` performance tuning for large arrays (Phase 9 problem)
- Convex dashboard alerting
- PIP-06 integration test asserting Sanity↔Convex `runId` consistency (Phase 4 scope)
