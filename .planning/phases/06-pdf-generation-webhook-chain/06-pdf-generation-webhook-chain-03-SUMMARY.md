---
phase: 06-pdf-generation-webhook-chain
plan: 03
subsystem: pipeline
tags:
  - phase-6
  - pdf-generation
  - webhook
  - dependencies
  - fonts
  - cli
  - idempotency
  - railway
dependency-graph:
  requires:
    - "Plan 04-01 (Phase 4 railway.toml preDeployCommand + cli.py setup-checkpointer)"
    - "Plan 05-04 (agents/design/font_whitelist.py FALLBACK_FONT_DISPLAY/BODY constants)"
  provides:
    - "weasyprint==68.1 + jinja2==3.1.6 pinned in pyproject.toml/uv.lock (Plan 06-05 renderer can import)"
    - "packages/pipeline/fonts/*.ttf — 4 vendored TTFs for WeasyPrint base64 inline (Plan 06-05 _font_to_base64)"
    - "setup-webhook-idempotency CLI subcommand (Plan 06-04 idempotency lib + Plan 06-07 webhook handler depend on the table)"
    - "railway.toml chains both DDL setups (every deploy creates/verifies webhook_idempotency table)"
    - ".env.example documents SANITY_WEBHOOK_SECRET + VERCEL_DEPLOY_HOOK_URL (Plan 06-04 + 06-05 + 06-07 read these)"
  affects:
    - "Plan 06-04 webhook signature verification + idempotency library (consumes webhook_idempotency table)"
    - "Plan 06-05 PDF renderer (reads fonts/*.ttf + imports weasyprint/jinja2)"
    - "Plan 06-07 webhook handler wiring (uses Sanity webhook secret env var)"
tech-stack:
  added:
    - "weasyprint==68.1"
    - "jinja2==3.1.6"
    - "(transitive) pillow, fonttools, pydyf, pyphen, tinycss2, tinyhtml5, cssselect2, brotli, brotlicffi, fonttools, markupsafe, webencodings, zopfli — 14 new packages in uv.lock"
  patterns:
    - "Subcommand dispatch via _SUBCOMMANDS table (extensible — future setup-* commands plug in via dict)"
    - "psycopg AsyncConnection.connect(..., autocommit=True) for DDL (avoids Supabase pooler transaction-rejection edge case)"
    - "Multi-statement DDL split on ';' so errors localize to the failing statement"
    - "Idempotent CREATE TABLE/INDEX IF NOT EXISTS chained in railway.toml preDeployCommand (safe on every deploy)"
key-files:
  created:
    - "packages/pipeline/fonts/PlayfairDisplay-Regular.ttf (123,240 bytes)"
    - "packages/pipeline/fonts/PlayfairDisplay-Bold.ttf (123,536 bytes)"
    - "packages/pipeline/fonts/SourceSerifPro-Regular.ttf (159,600 bytes)"
    - "packages/pipeline/fonts/SourceSerifPro-Bold.ttf (160,504 bytes)"
    - "packages/pipeline/fonts/LICENSES/README.md (SIL OFL attribution + vendoring guide)"
  modified:
    - "packages/pipeline/pyproject.toml (+2 deps)"
    - "packages/pipeline/uv.lock (+225 lines / 14 new package entries)"
    - "packages/pipeline/.env.example (+18 lines — Phase 6 env section)"
    - "packages/pipeline/src/eisenbalm_pipeline/cli.py (rewrite — adds setup_webhook_idempotency + dispatch table)"
    - "packages/pipeline/railway.toml (preDeployCommand chains both setup commands)"
decisions:
  - "Font source: fonts.gstatic.com direct URLs via Google Fonts CSS API (the /download?family= endpoint returned HTML for our UA, so used the planned Option B fallback path)"
  - "Live setup-webhook-idempotency was NOT run against a real Supabase from this plan — SUPABASE_POSTGRES_URL is not provisioned in the local dev environment; Railway's preDeployCommand will run it on the next deploy (idempotent by design)"
  - "Fonts files were inadvertently committed as part of the parallel 06-04 commit (aac888b) because the parallel agent staged its work after this plan dropped the fonts on disk but before this plan could git add them — work is in master regardless; recorded for traceability"
metrics:
  duration: "~5min"
  completed: "2026-05-18T19:53:13Z"
---

# Phase 6 Plan 03: Fonts, Deps and Idempotency CLI Summary

Provisioned the Phase 6 runtime substrate: pinned WeasyPrint + Jinja2 in pyproject.toml/uv.lock, vendored the four canonical fallback-font TTFs (Playfair Display + Source Serif Pro, Regular + Bold) under packages/pipeline/fonts/, extended cli.py with a new setup-webhook-idempotency subcommand that creates the Supabase Postgres dedup table idempotently, chained the new setup into railway.toml preDeployCommand, and documented SANITY_WEBHOOK_SECRET + VERCEL_DEPLOY_HOOK_URL in .env.example.

## One-Liner

Wave-0 prerequisites bundle for Phase 6: WeasyPrint+Jinja2 deps + 4 vendored TTFs + setup-webhook-idempotency CLI + railway.toml chain — unblocks all parallel Wave-1 plans (06-04, 06-05, 06-07).

## What Shipped

### Task 1 — Dependencies + env scaffolding
- `weasyprint==68.1` and `jinja2==3.1.6` added to `pyproject.toml` dependencies (after selectolax==0.4.9).
- `uv lock` regenerated; +14 transitive packages (pillow, fonttools, pydyf, pyphen, tinycss2, tinyhtml5, cssselect2, brotli, brotlicffi, markupsafe, webencodings, zopfli, etc.) — uv.lock grew by 225 lines.
- `.env.example` got a new `# ─── Phase 6 — PDF Generation + Webhook Chain ───` section documenting:
  - `SANITY_WEBHOOK_SECRET` — HMAC-SHA256 algorithm hint, header format `t={ts_ms},v1={base64url}`, reference to research Pattern 1 + Pitfall 1.
  - `VERCEL_DEPLOY_HOOK_URL` — provisioning steps in Vercel UI, TODO(ops) per-environment warning per Pitfall 10 (staging must never point at production hook).

### Task 2 — Vendored TTF fonts
- Four TTF binaries committed under `packages/pipeline/fonts/`:
  - `PlayfairDisplay-Regular.ttf` — 123,240 bytes
  - `PlayfairDisplay-Bold.ttf` — 123,536 bytes
  - `SourceSerifPro-Regular.ttf` — 159,600 bytes
  - `SourceSerifPro-Bold.ttf` — 160,504 bytes
- All four verified as valid TrueType: magic bytes `0x00 0x01 0x00 0x00`, `file(1)` reports "TrueType Font data".
- `fonts/LICENSES/README.md` written with SIL OFL 1.1 attribution table per Google Fonts vendoring requirement; includes "How to Vendor a New Font" guide referencing the deterministic `{FamilyNoSpaces}-{Weight}.ttf` filename pattern.
- Font source: `fonts.gstatic.com` direct URLs resolved via Google Fonts CSS API (`https://fonts.googleapis.com/css2?family=...`). The planned Option A (Google Fonts ZIP download) returned HTML pages — fell back to Option B as documented in the plan.

### Task 3 — CLI subcommand + Railway chain
- `cli.py` rewritten with:
  - `_SUBCOMMANDS` dispatch table (`setup-checkpointer` + `setup-webhook-idempotency`).
  - `_require_postgres_url()` helper extracted (deduped between subcommands).
  - `setup_webhook_idempotency()` uses `psycopg.AsyncConnection.connect(..., autocommit=True)` so the DDL is not wrapped in a transaction the Supabase pooler may reject.
  - `WEBHOOK_IDEMPOTENCY_DDL` module-level constant — multi-statement DDL split on `;` and executed one statement at a time so any DDL error points at the right statement.
  - Constraint name `webhook_idempotency_key_source` matches research Pattern 2 verbatim.
- `railway.toml` `preDeployCommand` now a 2-item list chaining both setup subcommands. Comment cross-references both phases ("Phase 4 + Phase 6: idempotent DDL on every deploy").

## Self-Check

- **uv lock --check**: exits 0 — lock matches pyproject.
- **Fonts**: `ls packages/pipeline/fonts/*.ttf | wc -l` returns 4; `file packages/pipeline/fonts/*.ttf | grep -cv TrueType` returns 0 (all valid).
- **CLI smoke**:
  - `uv run python -m eisenbalm_pipeline.cli` → exits 1 with usage (both subcommands listed).
  - `uv run python -m eisenbalm_pipeline.cli help-me` → exits 1 with usage.
  - `uv run python -m eisenbalm_pipeline.cli setup-webhook-idempotency` (no env) → exits 2 with documented error.
  - `uv run python -c "from eisenbalm_pipeline.cli import setup_webhook_idempotency; print('importable')"` → exits 0.
- **railway.toml**: contains both `setup-checkpointer` and `setup-webhook-idempotency` exactly once each in the preDeployCommand list.
- **pytest**: 137 passed, 18 skipped — no regressions from Phase 5.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Coordination] Fonts committed by parallel agent**
- **Found during:** Task 2 commit step.
- **Issue:** When `git commit` was invoked for fonts, the parallel 06-04 agent had already staged and committed its work — picking up our fonts files (which were on disk but not yet staged) into its commit (`aac888b feat(06-04): add Sanity webhook signature verifier`).
- **Fix:** No corrective action — the work landed in master correctly; the file paths, sizes, and license attribution are exactly what this plan specified. Recorded the deviation for traceability.
- **Files modified:** `packages/pipeline/fonts/PlayfairDisplay-{Regular,Bold}.ttf`, `packages/pipeline/fonts/SourceSerifPro-{Regular,Bold}.ttf`, `packages/pipeline/fonts/LICENSES/README.md` — all live in commit `aac888b` rather than a dedicated 06-03 commit.
- **Commit:** `aac888b` (parallel agent 06-04).

### Plan-Specified Deferrals

- **Google Fonts ZIP source unavailable.** The plan's Option A (`https://fonts.google.com/download?family=...`) returned HTML pages with our user-agent (not a ZIP archive — `file(1)` reported "HTML document text"). Used the plan's Option B fallback: resolved the four TTF URLs from the Google Fonts CSS API (`https://fonts.googleapis.com/css2?family=...` with a Mozilla/5.0 UA) and downloaded each TTF directly from `fonts.gstatic.com`. Resulting binaries are valid TrueType (verified by magic bytes + `file(1)`). This is the second-priority source in the plan; documented per the output requirement.
- **Live setup-webhook-idempotency execution deferred to Railway deploy.** Local environment has no `SUPABASE_POSTGRES_URL` provisioned (Andrew's responsibility per CONTEXT D-29). The CLI smoke test confirmed the "ERROR: SUPABASE_POSTGRES_URL is not set" exit-2 path works; the live DDL execution against Supabase will fire on the next Railway preDeployCommand. Both DDL statements are idempotent (`CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`) so re-running is safe.

### Open TODOs

- None for this plan. The deferred live-DDL run is by design (preDeployCommand pattern); the missing per-environment Vercel deploy hook config is a Plan 06-07 / ops follow-up flagged in `.env.example`.

## uv.lock Delta

```
packages/pipeline/uv.lock | 225 ++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 225 insertions(+)
```

14 new transitive packages added (weasyprint pulls in pillow, fonttools, pydyf, pyphen, tinycss2, tinyhtml5, cssselect2, brotli, brotlicffi, markupsafe, webencodings, zopfli; jinja2 pulls in markupsafe — already present).

## Commits

- `786021f` chore(06-03): add weasyprint+jinja2 deps and Phase 6 env vars
- `aac888b` feat(06-04): add Sanity webhook signature verifier — also picked up the 4 TTFs + LICENSES/README.md (deviation 1 above)
- `49cb271` feat(06-03): extend CLI with setup-webhook-idempotency and chain on Railway

## Self-Check: PASSED

All claimed files exist on disk:
- packages/pipeline/pyproject.toml (modified, weasyprint+jinja2 pins present)
- packages/pipeline/uv.lock (modified, weasyprint+jinja2 entries)
- packages/pipeline/.env.example (modified, Phase 6 section appended)
- packages/pipeline/fonts/PlayfairDisplay-Regular.ttf (TrueType, 123,240 bytes)
- packages/pipeline/fonts/PlayfairDisplay-Bold.ttf (TrueType, 123,536 bytes)
- packages/pipeline/fonts/SourceSerifPro-Regular.ttf (TrueType, 159,600 bytes)
- packages/pipeline/fonts/SourceSerifPro-Bold.ttf (TrueType, 160,504 bytes)
- packages/pipeline/fonts/LICENSES/README.md (SIL OFL attribution table)
- packages/pipeline/src/eisenbalm_pipeline/cli.py (rewrite, both subcommands)
- packages/pipeline/railway.toml (preDeployCommand chains both)

All claimed commits exist in `git log --all`:
- 786021f ✓
- aac888b ✓ (carries 06-03 fonts work)
- 49cb271 ✓
