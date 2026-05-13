---
phase: 03-convex-deployment
plan: 07
subsystem: docs
status: complete
type: execute
tags: [docs, convex, onboarding, phase-9-cleanup-contract]
completed: 2026-05-13
duration_minutes: 4
requirements: [CVX-04, CVX-05]
dependency_graph:
  requires:
    - "03-06 (Phase 9 cleanup TODO landed in apps/web/app/%5Fdebug/convex/page.tsx)"
    - "03-05 (ConvexClientProvider exists and is referenced)"
    - "03-04 (deploy workflow exists)"
    - "03-02 (init checkpoint completed; CONVEX_DEPLOY_KEY semantics known — dev: not prod:)"
    - "03-01 (workspace scaffold + root pnpm scripts)"
  provides:
    - "convex/README.md — canonical onboarding doc for the @eisenbalm/convex workspace"
    - "apps/web/README.md ## Convex section — env vars, provider mount, /_debug/convex contract"
    - "Phase 9 cleanup contract documented in 3 locations (page.tsx TODO + both READMEs)"
    - "Andrew can bootstrap from a fresh clone using only the new READMEs"
  affects:
    - "Plan 03-08 (smoke test) — README is the script the smoke test follows"
    - "Phase 9 — cleanup contract is locked and greppable"
tech-stack:
  added: []
  patterns:
    - "Workspace-level README onboarding doc (mirrors apps/studio/README.md)"
    - "Additive-only diff to existing READMEs (preserves Phase 2 content byte-for-byte)"
    - "Phase 9 cleanup contract documented in 3 redundant locations"
key-files:
  created:
    - convex/README.md (305 lines)
  modified:
    - apps/web/README.md (228 → 306 lines; 53 insertions, 1 deletion)
decisions:
  - "Used PRIMARY placement for ## Convex section in apps/web/README.md (after ### Reading time, before ### SEO and structured data) — both anchor headings exist (verified via grep before edit)"
  - "Documented CONVEX_DEPLOY_KEY as starting with 'dev:' in Phase 3 (per Plan 03-02 Deviation 1) — noted that the same env var slot accepts 'prod:' after Andrew promotes the deployment"
  - "Phase 9 cleanup contract is documented in 4 places (was originally 3): (1) TODO(Phase 9) comment at top of apps/web/app/%5Fdebug/convex/page.tsx, (2) convex/README.md /_debug/convex section, (3) apps/web/README.md ## Convex section, (4) convex/README.md Phase 9 forward-pointer footer. Redundant by design — any of the 4 will surface to Phase 9's planner."
  - "Documented the %5Fdebug Next.js 15 private-folder escape in both READMEs so future engineers don't 'fix' it back to _debug and break the route"
metrics:
  duration: "4 minutes"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
---

# Phase 3 Plan 07: Documentation Summary

Documentation-only plan delivering the canonical onboarding doc for the new `@eisenbalm/convex` workspace and extending the existing `apps/web/README.md` with the Phase 3 Convex section. No code files were touched.

## What was built

### `convex/README.md` (new, 305 lines)

The canonical bootstrap doc for the Convex workspace. A fresh engineer (or future Andrew after weeks away) can take a clean clone to a working deployment + a green `/_debug/convex` page by following this file alone. Sections:

- **Tables** — 5 tables with their indexes (sourced from `convex/schema.ts`)
- **Function files** — 5 files with their query/mutation exports (sourced from `docs/API_CONTRACTS.md §4`)
- **First-time setup** — 7-step Andrew bootstrap sequence (matches D-23):
  1. `pnpm install`
  2. `pnpm --filter @eisenbalm/convex exec convex dev --once --configure`
  3. Verify `convex.json` has `"functions": "./"` (Pitfall 6)
  4. Capture deployment URL + Deploy Key, populate `apps/web/.env.local`
  5. `pnpm deploy:convex`
  6. Verify in Convex dashboard
  7. `pnpm dev:web` → `/_debug/convex`
- **Day-to-day workflow** — 5 pnpm workspace commands
- **Env vars** — three vars (`CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`)
- **Vercel + Railway manual provisioning** — D-22, `vercel env add` and `railway variables set` shapes
- **HTTP API smoke** — curl pattern Phase 4 will adopt
- **`/_debug/convex` route** — Phase 3 → Phase 9 cleanup contract (4 explicit steps)
- **What lives where** — 10 files in `convex/` indexed
- **Reference** — links to `docs/API_CONTRACTS.md §3-§4`, `CLAUDE.md`, brief
- **Troubleshooting** — 7 failure modes with resolutions

### `apps/web/README.md` (extended; 228 → 306 lines)

Three targeted additions plus one row update — strictly additive elsewhere:

1. **Routes table** — new row for `/_debug/convex` flagged as Phase 3 evidence only / Phase 9 removal target
2. **Environment variables table** — two new rows: `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOY_KEY` (SECRET, NEVER commit, NEVER expose via NEXT_PUBLIC_*)
3. **New `## Convex` section** — placed AFTER `### Reading time` and BEFORE `### SEO and structured data` (primary placement; both anchors verified to exist before edit). Subsections: Provider mount, Type imports, `/_debug/convex` Phase 9 cleanup, Vercel env provisioning, What happens in Phase 9.
4. **"What is not in Phase 2" table** — one row updated to clarify Phase 3 has delivered the Convex infrastructure (provider + queries + path alias + env wiring); Phase 9 only wires the live `<DeliberationSlot>` UI.

## Plan output answers

**(a) Two files touched and final line counts:**
- `convex/README.md` — NEW — 305 lines
- `apps/web/README.md` — MODIFIED — 306 lines (was 228 → 53 insertions, 1 deletion)

**(b) `git diff` confirmation:**
`git diff` on `apps/web/README.md` reports `1 file changed, 53 insertions(+), 1 deletion(-)`. The single deletion is the planned targeted edit to the "Convex deliberation live subscriptions" row in the "What is not in Phase 2" table. All Phase 2 sections (Routes table other rows, Setup, Sanity reader, Theme engine, Issue route, Portable Text, Anchor copy, Reading time, SEO and structured data, Print stylesheet, Tailwind, Deploying to Vercel, Troubleshooting) are preserved byte-for-byte. Verified by `git diff apps/web/README.md | grep -c "^-[^-]"` → 1.

**(c) Phase 9 cleanup contract documented in 3 (actually 4) places — all greppable:**
1. `apps/web/app/%5Fdebug/convex/page.tsx` — TODO(Phase 9) JSDoc block at top of file (landed in Plan 03-06)
2. `convex/README.md` — `## /_debug/convex route (Phase 3 evidence, Phase 9 cleanup)` section with the 4-step cleanup list
3. `apps/web/README.md` — `### /_debug/convex (Phase 3 only — removed in Phase 9)` subsection with the same 4-step cleanup list (worded identically for byte-equivalence)
4. `convex/README.md` footer — `Phase 9: removes /_debug/convex and wires real subscriptions into <DeliberationSlot>`

A Phase 9 planner running `grep -rn "TODO(Phase 9)" .` or `grep -rn "/_debug/convex" .` will hit all four locations.

**(d) Exact wording of the `CONVEX_DEPLOY_KEY` security warning — verbatim for future plans:**

In `convex/README.md`:
> ⚠️ `CONVEX_DEPLOY_KEY` grants full read/write to every Convex mutation. **Treat it like a database password. NEVER commit. NEVER expose via `NEXT_PUBLIC_*`. NEVER log.**

In `apps/web/README.md` (env var table):
> **SECRET. NEVER commit. NEVER expose via NEXT_PUBLIC_*.** Convex Deploy Key (`dev:...` in Phase 3, `prod:...` after Andrew promotes the deployment). Used by `convex deploy` (CI / Vercel build step) and by the Phase 4 pipeline's HTTP API mutation calls. Kept in `apps/web/.env.local` for local HTTP API smoke tests.

The shared SECRET / NEVER commit / NEVER expose via NEXT_PUBLIC_* clause appears verbatim in both files and also in `apps/web/.env.example` (Plan 03-01) and `.env.example` (Plan 03-01). Future plans should lift this 4-element phrase as-is.

**(e) Placement of the new `## Convex` section:**

**PRIMARY** placement was used: AFTER `### Reading time` (line 153 in pre-edit README) and BEFORE `### SEO and structured data` (line 157 in pre-edit README). Both anchor headings were verified to exist via `grep -n` before editing — exit 0 for both. No fallback A or fallback B placement was needed.

The placement does have a side effect worth flagging for future doc maintenance: a new top-level `## Convex` section between two `### `-level subsections of `## Architecture notes` effectively closes the Architecture notes section earlier than before (the SEO subsection now sits as a child of `## Convex` rather than of `## Architecture notes`). The plan explicitly requested this — the acceptance test anchors on `grep -q "^## Convex"` (top-level, not `### Convex`). The visual hierarchy in rendered markdown is slightly different but the content is correct. If a future doc-cleanup plan wants to restore the Architecture-notes hierarchy, it can demote `## Convex` to `### Convex` AND re-promote `### SEO and structured data` placement — both would be safe edits.

## Deviations from Plan

None of substance.

One observation logged for future reference (not a Rules 1-3 fix):
- The plan template's CONVEX_DEPLOY_KEY warning used `prod:<key>` as the example value, but Plan 03-02 Deviation 1 established that Phase 3 actually uses a `dev:`-prefixed key (Convex CLI's `--configure` always provisions a dev deployment first). Both READMEs were written with the `dev:` reality and a note that the same env var slot accepts `prod:` after promotion. This is an editorial correction, not a deviation — the plan author's `prod:` was correct as a future-state, the READMEs document the present-state.

## Self-Check

Verifications performed and passed:

1. **`convex/README.md` exists and ≥100 lines** — 305 lines, `test -f convex/README.md` exits 0
2. **Plan Task 1 verify chain** — 16-element grep chain (init command + all 5 table names + all 4 SECRET wording variants + `/_debug/convex` + `TODO(Phase 9)` + `"functions"`/`"./"` + HTTP API curl + `Authorization: Convex` + line count ≥100) — PASSED
3. **Plan Task 2 verify chain** — 12-element grep chain (`^## Convex` + `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` + `ConvexClientProvider` + `/_debug/convex` + `TODO(Phase 9)` + `DeliberationSlot` + `@convex/*` + `phase-3-smoke-test` + `convex/README.md` link + `Phase 2` preserved + `useCdn: true` preserved) — PASSED
4. **Plan-level verification** — both READMEs reference Phase 9 cleanup contract, both call out CONVEX_DEPLOY_KEY as SECRET, both document NEXT_PUBLIC_CONVEX_URL, no code files modified — PASSED
5. **Additive contract on `apps/web/README.md`** — `git diff --stat` reports 53 insertions, 1 deletion; the single deletion is the planned targeted edit — PASSED
6. **Code files untouched** — `git diff HEAD~2 HEAD --name-only` excludes all of `convex/schema.ts`, `convex/{pipelineRuns,pitchLog,deliberationEvents,agentVotes,qaCorrections}.ts`, `apps/web/components/issue/DeliberationSlot.tsx` — PASSED

## Self-Check: PASSED

Commits:
- `79f1098` — docs(03-07): create convex/README.md workspace onboarding doc
- `da39ba5` — docs(03-07): extend apps/web/README.md with Convex section
