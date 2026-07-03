---
phase: 29-deployment-hardening-code-fixes
plan: 05
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - packages/pipeline/.env.example
  - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py
  - packages/pipeline/src/eisenbalm_pipeline/cli.py
  - apps/dispatch-control/.env.example
  - apps/dispatch-control/DEPLOY.md
autonomous: true
requirements: [D-6, D-13]
must_haves:
  truths:
    - "No .env.example or error string still instructs the operator to use the Supabase session pooler for SUPABASE_POSTGRES_URL (it points at Railway Postgres now)"
    - "dispatch-control .env.example + DEPLOY.md document PREVIEW_SECRET and NEXT_PUBLIC_WEB_PREVIEW_BASE, and NEXT_PUBLIC_PIPELINE_URL is no longer labeled optional"
    - "pipeline .env.example documents DESIGNAGENT_SUPPRESSED and LOG_LEVEL"
  artifacts:
    - path: "packages/pipeline/.env.example"
      provides: "Railway-accurate Postgres guidance + DESIGNAGENT_SUPPRESSED + LOG_LEVEL"
    - path: "apps/dispatch-control/.env.example"
      provides: "PREVIEW_SECRET + NEXT_PUBLIC_WEB_PREVIEW_BASE entries"
  key_links:
    - from: "packages/pipeline/.env.example / checkpointer.py / cli.py"
      to: "operator"
      via: "Railway Postgres guidance (not Supabase)"
      pattern: "Railway"
---

<objective>
Docs-only hygiene (no real secret values set): (D-6) the `SUPABASE_POSTGRES_URL` var now points at Railway Postgres (moved 2026-06-12) but `.env.example` + two error strings still say "Supabase session pooler" — fix the misleading guidance without renaming the var; (D-13) document env vars that silently degrade features when unset — dispatch-control `PREVIEW_SECRET` + `NEXT_PUBLIC_WEB_PREVIEW_BASE` (preview silently "not configured") and correct DEPLOY.md's wrong "optional" label on `NEXT_PUBLIC_PIPELINE_URL` (clients THROW without it); pipeline `DESIGNAGENT_SUPPRESSED` (operationally significant Railway toggle, current live posture = true) + `LOG_LEVEL`.

Purpose: an operator reading the tracked env docs gets accurate, complete guidance.
Output: corrected pipeline env docs + dispatch-control env/deploy docs.

This plan depends on Plan 01 because both edit `packages/pipeline/.env.example` (Plan 01 adds the Convex secret var). Run after Plan 01 to avoid a merge collision. Do NOT set real secret values — this is documentation only.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/29-deployment-hardening-code-fixes/29-RESEARCH.md

<interfaces>
D-6 locations (verified):
- packages/pipeline/.env.example line ~19 (SUPABASE_POSTGRES_URL=postgres://...pooler.supabase.com...) + commented alternates ~22/25 describe a Supabase pooler shape
- packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py line ~39 — error string "See ...env.example" / Supabase-flavored guidance
- packages/pipeline/src/eisenbalm_pipeline/cli.py line ~62 — same
Keep the env var NAME `SUPABASE_POSTGRES_URL` unchanged (renaming is deferred). Only fix the example value/comments + the two error strings to Railway-accurate wording.

D-13 locations (verified):
- apps/dispatch-control/.env.example — no PREVIEW_SECRET / NEXT_PUBLIC_WEB_PREVIEW_BASE (lib/previewToken.ts throws naming both)
- apps/dispatch-control/DEPLOY.md line ~48 — mislabels NEXT_PUBLIC_PIPELINE_URL as "_(optional)_" (review/control clients throw without it)
- packages/pipeline/.env.example — no DESIGNAGENT_SUPPRESSED (graph/builder.py line ~71 reads it; live posture = true) or LOG_LEVEL (api/main.py logging.basicConfig reads it)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix Railway Postgres guidance + add pipeline toggles (D-6, D-13 pipeline)</name>
  <files>packages/pipeline/.env.example, packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py, packages/pipeline/src/eisenbalm_pipeline/cli.py</files>
  <read_first>
    - packages/pipeline/.env.example (SUPABASE_POSTGRES_URL block + commented alternates)
    - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py (~line 39 error string)
    - packages/pipeline/src/eisenbalm_pipeline/cli.py (~line 62 error string)
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (~line 71 — DESIGNAGENT_SUPPRESSED usage)
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (LOG_LEVEL usage in logging.basicConfig)
  </read_first>
  <action>
    In `packages/pipeline/.env.example`, replace the Supabase-session-pooler example value + comments for `SUPABASE_POSTGRES_URL` with Railway-Postgres-accurate guidance (keep the var NAME unchanged; note in a comment that the name is a legacy misnomer now pointing at Railway Postgres). Update the error strings in `graph/checkpointer.py` (~line 39) and `cli.py` (~line 62) to Railway-accurate wording (drop "Supabase session pooler"). Add `DESIGNAGENT_SUPPRESSED=true` (comment: "operationally significant Railway toggle; current live posture = true — skips the design LangGraph node") and `LOG_LEVEL=INFO` entries to `packages/pipeline/.env.example`.
  </action>
  <verify>
    <automated>! grep -rq "pooler.supabase.com\|Supabase session pooler" packages/pipeline/.env.example packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py packages/pipeline/src/eisenbalm_pipeline/cli.py && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rc "pooler.supabase.com\|Supabase session pooler" packages/pipeline/.env.example packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py packages/pipeline/src/eisenbalm_pipeline/cli.py` totals 0
    - `grep -qi "Railway" packages/pipeline/.env.example` (Railway guidance present)
    - `grep -q "DESIGNAGENT_SUPPRESSED" packages/pipeline/.env.example` && `grep -q "LOG_LEVEL" packages/pipeline/.env.example`
    - `SUPABASE_POSTGRES_URL` still present (var not renamed): `grep -q "SUPABASE_POSTGRES_URL" packages/pipeline/.env.example`
    - `cd packages/pipeline && uv run pytest -q tests/api -k "not slow" 2>/dev/null || true` — no import breakage from the error-string edits (string-only changes)
  </acceptance_criteria>
  <done>Pipeline env docs and error strings give Railway-accurate Postgres guidance and document the two operational toggles; the var name is unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Document dispatch-control preview + pipeline URL vars (D-13 dispatch-control)</name>
  <files>apps/dispatch-control/.env.example, apps/dispatch-control/DEPLOY.md</files>
  <read_first>
    - apps/dispatch-control/.env.example
    - apps/dispatch-control/DEPLOY.md (line ~48 NEXT_PUBLIC_PIPELINE_URL label)
    - apps/dispatch-control/lib/previewToken.ts (throws naming PREVIEW_SECRET + NEXT_PUBLIC_WEB_PREVIEW_BASE)
  </read_first>
  <action>
    Add `PREVIEW_SECRET=` (comment: "signs review-gate preview tokens; review preview degrades to 'not configured' when unset") and `NEXT_PUBLIC_WEB_PREVIEW_BASE=` (comment: "base URL the review preview iframe points at") to `apps/dispatch-control/.env.example`. In `apps/dispatch-control/DEPLOY.md`, add both vars to the documented env list and correct the `NEXT_PUBLIC_PIPELINE_URL` "_(optional)_" label to "required" (the review/control clients throw without it). Do NOT set real values.
  </action>
  <verify>
    <automated>grep -q "PREVIEW_SECRET" apps/dispatch-control/.env.example && grep -q "NEXT_PUBLIC_WEB_PREVIEW_BASE" apps/dispatch-control/.env.example && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "PREVIEW_SECRET" apps/dispatch-control/.env.example` && `grep -q "NEXT_PUBLIC_WEB_PREVIEW_BASE" apps/dispatch-control/.env.example`
    - `grep -q "PREVIEW_SECRET" apps/dispatch-control/DEPLOY.md` && `grep -q "NEXT_PUBLIC_WEB_PREVIEW_BASE" apps/dispatch-control/DEPLOY.md`
    - `NEXT_PUBLIC_PIPELINE_URL` no longer labeled optional in DEPLOY.md (`grep -A1 "NEXT_PUBLIC_PIPELINE_URL" apps/dispatch-control/DEPLOY.md` shows it not marked "(optional)")
    - `pnpm --filter dispatch-control build` exits 0 (docs-only change, build stays green)
  </acceptance_criteria>
  <done>dispatch-control env docs and DEPLOY.md document the preview vars and correctly mark NEXT_PUBLIC_PIPELINE_URL required.</done>
</task>

</tasks>

<verification>
- grep confirms no Supabase-pooler guidance remains and all four new vars are documented
- `pnpm --filter dispatch-control build` exits 0
</verification>

<success_criteria>
An operator reading the tracked `.env.example` files and DEPLOY.md gets accurate Railway Postgres guidance and a complete list of the vars whose absence silently degrades preview/logging/design-suppression — with no real secret values committed.
</success_criteria>

<output>
After completion, create `.planning/phases/29-deployment-hardening-code-fixes/29-05-SUMMARY.md`
</output>
