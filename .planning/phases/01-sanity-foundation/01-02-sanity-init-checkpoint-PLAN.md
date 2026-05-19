---
phase: 01-sanity-foundation
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/studio/.env.local
autonomous: false
requirements:
  - FND-01
  - FND-04
must_haves:
  truths:
    - "Andrew has run `npx sanity@latest init` and accepted/created a Sanity project"
    - "A `production` dataset exists in that project"
    - "`apps/studio/.env.local` contains the resulting `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET=production`"
    - "Andrew has access to the Sanity manage console for that project"
  artifacts:
    - path: "apps/studio/.env.local"
      provides: "Local-only Studio env values resolved from Sanity init"
      contains: "SANITY_STUDIO_PROJECT_ID="
  key_links:
    - from: "apps/studio/.env.local"
      to: "Sanity hosted project"
      via: "projectId + dataset values match the init result"
      pattern: "SANITY_STUDIO_PROJECT_ID=[a-z0-9]+"
---

<objective>
Capture Andrew's mandatory manual step: run `npx sanity@latest init` once to provision the Sanity project + `production` dataset, then write the resulting projectId/dataset values into `apps/studio/.env.local` so Plans 03+ can wire them into the Studio config.

This plan is `autonomous: false`. It is the only Phase 1 step that requires human interaction (per D-20, "the CLI is interactive").

Purpose: Honors decisions D-02 through D-04 and D-20/D-21. Sanity Cloud must hold the project before any Studio code can connect to it.
Output: A populated `apps/studio/.env.local` (gitignored) with the real `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET=production`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-sanity-foundation/01-CONTEXT.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew runs `npx sanity@latest init` and creates the production dataset</name>
  <files>(none — Andrew works in their terminal and on sanity.io/manage)</files>
  <read_first>
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-20: Andrew runs `npx sanity@latest init --project-id <new-id>` once; CLI is interactive)
    - (Note: apps/studio/.env.example is created in Plan 03 — runs AFTER this plan. Andrew populates apps/studio/.env.local directly using the variable names listed in <how-to-verify> below.)
  </read_first>
  <what-built>
    Plan 01 created the repo skeleton (root package.json, pnpm-workspace.yaml, tsconfig.base.json, .gitignore). Plan 03 (later, in Wave 2) creates apps/studio/.env.example as the canonical checked-in env template — but this plan runs in Wave 1 and only needs the variable NAMES, which are documented inline below. Andrew populates the gitignored apps/studio/.env.local with values minted by sanity.io.
  </what-built>
  <how-to-verify>
    Andrew, please complete the following steps in order. The executor will resume only after you confirm.

    1. Ensure you are logged in to a Sanity account (free tier is fine):
       - Open https://www.sanity.io/login in a browser. Sign in with Google/GitHub.
    2. From the repo root in a terminal, run:
       ```bash
       mkdir -p apps/studio
       cd apps/studio
       npx sanity@latest init
       ```
       - When prompted "Create new project or select existing?", choose **Create new project**.
       - Project name suggestion: `Eisenbalm Dispatch` (anything readable; this is just the dashboard label).
       - Use the default dataset name: `production`. Confirm it should be **public** (the brief has no auth wall — public reads are correct per the research notes).
       - When prompted "Project output path", point at `.` (the current directory `apps/studio`). It is fine if the CLI scaffolds files; Plan 03 will overwrite the config with the canonical version that wires our existing schemas.
       - When prompted to add the project to existing TypeScript Sanity setup, you can accept defaults — Plan 03 will rewrite anyway.
    3. After init completes, the CLI prints a `projectId` (an 8-character lowercase string, e.g. `pj9k2lm3`). Copy it.
    4. Open https://www.sanity.io/manage and confirm:
       - The new project appears in your dashboard
       - It has a dataset named `production`
       - You are listed as a member with admin/editor permissions
    5. From the repo root, create the env file:
       ```bash
       cat > apps/studio/.env.local <<EOF
       SANITY_STUDIO_PROJECT_ID=<paste-the-projectId-here>
       SANITY_STUDIO_DATASET=production
       EOF
       ```
       Replace `<paste-the-projectId-here>` with the value from step 3. Do NOT commit this file (Plan 01's `.gitignore` excludes `.env.local`).
    6. Verify locally:
       ```bash
       test -f apps/studio/.env.local && grep -E "^SANITY_STUDIO_PROJECT_ID=[a-z0-9]+" apps/studio/.env.local && grep -E "^SANITY_STUDIO_DATASET=production" apps/studio/.env.local && echo OK
       ```
       Expected output: `OK`. If anything is missing or empty, fix the file before approving.
  </how-to-verify>
  <acceptance_criteria>
    - `apps/studio/.env.local` exists (file present on disk)
    - `apps/studio/.env.local` contains a non-empty `SANITY_STUDIO_PROJECT_ID=<value>` line where `<value>` matches `[a-z0-9]+`
    - `apps/studio/.env.local` contains exactly `SANITY_STUDIO_DATASET=production`
    - The value of `SANITY_STUDIO_PROJECT_ID` matches the project shown at https://www.sanity.io/manage
    - `apps/studio/.env.local` is NOT committed to git (verify with `git check-ignore apps/studio/.env.local` returning 0)
  </acceptance_criteria>
  <resume-signal>
    Type "approved" once `apps/studio/.env.local` exists with the correct values, or describe any issue (e.g. "the init failed with an error" or "I want to use a different project").
  </resume-signal>
</task>

</tasks>

<verification>
After Andrew approves:
- `test -f apps/studio/.env.local` exits 0
- `grep -E "^SANITY_STUDIO_PROJECT_ID=[a-z0-9]+" apps/studio/.env.local` exits 0
- `grep -E "^SANITY_STUDIO_DATASET=production" apps/studio/.env.local` exits 0
- `git check-ignore apps/studio/.env.local` exits 0 (file is gitignored)

Note: The Sanity init CLI may scaffold extraneous files (sanity.config.ts, package.json, etc.) inside `apps/studio/`. Plan 03 explicitly overwrites those with our canonical versions; do not worry about them here.
</verification>

<success_criteria>
- A real Sanity project + `production` dataset exists in Andrew's Sanity organization
- `apps/studio/.env.local` carries the projectId and dataset values for Plans 03+ to consume
- File is gitignored (D-21 + Plan 01 `.gitignore`)
- Andrew has confirmed access to https://www.sanity.io/manage for the project
</success_criteria>

<output>
After completion, create `.planning/phases/01-sanity-foundation/01-02-SUMMARY.md` recording (a) the projectId Andrew chose (or a placeholder note if Andrew prefers not to record it in the summary — the value lives only in `apps/studio/.env.local`), (b) the dataset name (`production`), and (c) any extraneous files the Sanity init CLI scaffolded that Plan 03 will need to overwrite.
</output>
