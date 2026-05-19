---
phase: 06-pdf-generation-webhook-chain
plan: 03
type: execute
wave: 0
depends_on: []
files_modified:
  - packages/pipeline/pyproject.toml
  - packages/pipeline/uv.lock
  - packages/pipeline/.env.example
  - packages/pipeline/fonts/LICENSES/README.md
  - packages/pipeline/fonts/PlayfairDisplay-Regular.ttf
  - packages/pipeline/fonts/PlayfairDisplay-Bold.ttf
  - packages/pipeline/fonts/SourceSerifPro-Regular.ttf
  - packages/pipeline/fonts/SourceSerifPro-Bold.ttf
  - packages/pipeline/src/eisenbalm_pipeline/cli.py
  - packages/pipeline/railway.toml
autonomous: true
requirements_addressed:
  - PDF-02
  - WHK-04
  - WHK-05

must_haves:
  truths:
    - "WeasyPrint and Jinja2 are installed and pinned in pyproject.toml; uv sync succeeds offline against uv.lock"
    - "The two Phase-5-fallback Google Fonts (Playfair Display Regular+Bold, Source Serif Pro Regular+Bold) exist as TTF binaries under packages/pipeline/fonts/"
    - "Running `python -m eisenbalm_pipeline.cli setup-webhook-idempotency` against a fresh Supabase Postgres creates the webhook_idempotency table with a UNIQUE(source, idempotency_key) constraint"
    - "railway.toml preDeployCommand runs BOTH checkpointer setup AND webhook_idempotency setup on every deploy (idempotent)"
    - ".env.example documents SANITY_WEBHOOK_SECRET and VERCEL_DEPLOY_HOOK_URL as required for Phase 6"
  artifacts:
    - path: "packages/pipeline/fonts/"
      provides: "Vendored TTF assets for WeasyPrint base64 inline (~4 files × ~150KB each)"
    - path: "packages/pipeline/fonts/LICENSES/README.md"
      provides: "SIL OFL license attribution per Google Fonts vendoring requirements"
    - path: "packages/pipeline/src/eisenbalm_pipeline/cli.py"
      provides: "Extended CLI with setup-webhook-idempotency subcommand (idempotent DDL)"
    - path: "packages/pipeline/railway.toml"
      provides: "preDeployCommand chains setup-checkpointer + setup-webhook-idempotency"
    - path: "packages/pipeline/pyproject.toml"
      provides: "weasyprint==68.1 + jinja2==3.1.6 added to dependencies"
    - path: "packages/pipeline/.env.example"
      provides: "Phase 6 env section: SANITY_WEBHOOK_SECRET + VERCEL_DEPLOY_HOOK_URL"
  key_links:
    - from: "packages/pipeline/railway.toml"
      to: "packages/pipeline/src/eisenbalm_pipeline/cli.py::setup_webhook_idempotency"
      via: "preDeployCommand"
      pattern: "setup-webhook-idempotency"
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py (Plan 06-05)"
      to: "packages/pipeline/fonts/"
      via: "_font_to_base64 reads from FONTS_DIR"
      pattern: "fonts/PlayfairDisplay"
---

<objective>
Provision the runtime substrate Phase 6 needs: install WeasyPrint + Jinja2, vendor the four TTF binaries the renderer needs (Playfair Display + Source Serif Pro, both Regular + Bold — the fallback fonts every issue can land on via DesignAgent's safe defaults), extend the CLI with a `setup-webhook-idempotency` subcommand that creates the Supabase Postgres dedup table, wire it into `railway.toml preDeployCommand` so it runs idempotently on every deploy, and document the two new env vars (SANITY_WEBHOOK_SECRET, VERCEL_DEPLOY_HOOK_URL).

Purpose: every downstream plan (06-04 libs, 06-05 renderer, 06-07 webhook handler) depends on these prerequisites. Bundling them in one Wave-0 plan keeps the parallel Wave-1 plans unblocked.

Scope note: Phase 6 ships ONLY the two fallback fonts as TTF (PDF-02 says "fonts come from the Phase 5 whitelist" — but only the two the issue actually uses need inlining, and DesignAgent's fallback path guarantees these two specific families always work). Adding the other 15 fonts is a v2 follow-up; the renderer raises a clear FileNotFoundError so future PRs surface "vendor font X" tasks naturally.

Output: 2 deps + 4 TTFs + 1 license file + 1 CLI subcommand + railway.toml update + .env.example update.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md
@packages/pipeline/pyproject.toml
@packages/pipeline/src/eisenbalm_pipeline/cli.py
@packages/pipeline/railway.toml
@packages/pipeline/.env.example
@packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py
@packages/pipeline/Dockerfile

<interfaces>
From 06-RESEARCH.md §"Pattern 2: Idempotency-key dedup":
```sql
CREATE TABLE IF NOT EXISTS webhook_idempotency (
    id              BIGSERIAL   PRIMARY KEY,
    idempotency_key TEXT        NOT NULL,
    source          TEXT        NOT NULL,
    run_id          TEXT        NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT webhook_idempotency_key_source UNIQUE (source, idempotency_key)
);
CREATE INDEX IF NOT EXISTS webhook_idempotency_received_at_idx
    ON webhook_idempotency (received_at);
```

From agents/design/font_whitelist.py:
```python
FALLBACK_FONT_DISPLAY: str = "Playfair Display"
FALLBACK_FONT_BODY:    str = "Source Serif Pro"
```

Existing railway.toml preDeployCommand (Phase 4):
```toml
preDeployCommand = ["python -m eisenbalm_pipeline.cli setup-checkpointer"]
```

Existing CLI dispatcher (cli.py main()):
```python
def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] != "setup-checkpointer":
        print("Usage: python -m eisenbalm_pipeline.cli setup-checkpointer", file=sys.stderr)
        sys.exit(1)
    asyncio.run(setup_checkpointer())
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add weasyprint + jinja2 to pyproject.toml and append Phase 6 env vars to .env.example</name>
  <read_first>
    - packages/pipeline/pyproject.toml (current dependencies block — note version pin style)
    - packages/pipeline/.env.example (current structure — Phase sections appended at bottom)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md ("Standard Stack" → versions)
  </read_first>
  <files>
    - packages/pipeline/pyproject.toml
    - packages/pipeline/uv.lock
    - packages/pipeline/.env.example
  </files>
  <action>
1. In `packages/pipeline/pyproject.toml`, add two new pins inside the `dependencies = [...]` array (preserve existing entries and trailing comments). Insert after `"selectolax==0.4.9"`:

```toml
  "weasyprint==68.1",            # Phase 6 PDF-01 — HTML→PDF renderer
  "jinja2==3.1.6",               # Phase 6 PDF-01 — HTML template engine
```

2. Run `cd packages/pipeline && uv lock` to regenerate `uv.lock` with the new pins. Do NOT run `uv sync` yet — let Docker rebuild handle the install path; the dev box should still pick up the new deps next time anyone runs `uv sync`.

3. Append a new section to `packages/pipeline/.env.example` (at the END of the file, after the Phase 5 block):

```bash

# ─── Phase 6 — PDF Generation + Webhook Chain ─────────────────────────────

# Sanity webhook signing secret (WHK-02).
# Generate in Sanity Studio → API → Webhooks → "Add webhook" → Secret.
# Same value must be set as SANITY_WEBHOOK_SECRET in Sanity's webhook config
# and in Railway env. Algorithm: HMAC-SHA256 over f"{timestamp_ms}.{body}",
# base64url-no-pad encoded. Header format: t={ts_ms},v1={base64url}.
# Reference: 06-RESEARCH.md Pattern 1 + Pitfall 1.
SANITY_WEBHOOK_SECRET=CHANGE-ME-32-BYTES-RANDOM

# Vercel deploy hook URL (WHK-05).
# Create in Vercel project → Settings → Git → Deploy Hooks → "Create Hook".
# Set hook name "Eisenbalm Publisher" and target the production branch.
# Pipeline POSTs to this URL with no body, no auth (URL is the credential).
# TODO(ops): per-environment URLs — staging Railway must NEVER point at
#   the production hook. Reference: 06-RESEARCH.md Pitfall 10.
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/CHANGE-ME
```
  </action>
  <verify>
    <automated>grep -c "weasyprint==68.1" packages/pipeline/pyproject.toml && grep -c "jinja2==3.1.6" packages/pipeline/pyproject.toml && grep -c "SANITY_WEBHOOK_SECRET" packages/pipeline/.env.example && grep -c "VERCEL_DEPLOY_HOOK_URL" packages/pipeline/.env.example && cd packages/pipeline && uv lock --check 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "weasyprint==68.1" packages/pipeline/pyproject.toml` returns `1`
    - `grep -c "jinja2==3.1.6" packages/pipeline/pyproject.toml` returns `1`
    - `grep -c "SANITY_WEBHOOK_SECRET" packages/pipeline/.env.example` returns at least `1`
    - `grep -c "VERCEL_DEPLOY_HOOK_URL" packages/pipeline/.env.example` returns at least `1`
    - `packages/pipeline/uv.lock` contains `name = "weasyprint"` and `name = "jinja2"` (`grep -c 'name = "weasyprint"' packages/pipeline/uv.lock` returns at least `1`)
    - `cd packages/pipeline && uv lock --check` exits 0 (lock matches pyproject)
  </acceptance_criteria>
  <done>
    pyproject.toml + uv.lock + .env.example all consistent; Docker rebuild will install WeasyPrint and Jinja2 on next deploy.
  </done>
</task>

<task type="auto">
  <name>Task 2: Vendor 4 TTF fonts under packages/pipeline/fonts/ with SIL OFL license</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py (which 2 families are the canonical fallbacks)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 3 — TTF over WOFF2; Pitfall 9 — deterministic filename normalization)
    - https://fonts.google.com/specimen/Playfair+Display (source of TTF assets)
    - https://fonts.google.com/specimen/Source+Serif+Pro (note: redirects to Source Serif 4 — use the v15 TTF release)
  </read_first>
  <files>
    - packages/pipeline/fonts/PlayfairDisplay-Regular.ttf
    - packages/pipeline/fonts/PlayfairDisplay-Bold.ttf
    - packages/pipeline/fonts/SourceSerifPro-Regular.ttf
    - packages/pipeline/fonts/SourceSerifPro-Bold.ttf
    - packages/pipeline/fonts/LICENSES/README.md
  </files>
  <action>
1. Create directory `packages/pipeline/fonts/LICENSES/`.

2. Download the four TTF files. Two sources, in priority order:

   **Option A — Google Fonts ZIP download (preferred, deterministic):**
   ```bash
   mkdir -p /tmp/fonts-dl && cd /tmp/fonts-dl
   curl -L "https://fonts.google.com/download?family=Playfair+Display" -o playfair.zip
   curl -L "https://fonts.google.com/download?family=Source+Serif+Pro" -o sourceserif.zip
   unzip -o playfair.zip -d playfair
   unzip -o sourceserif.zip -d sourceserif
   ```
   Then copy the four files renaming as needed:
   ```bash
   cp playfair/static/PlayfairDisplay-Regular.ttf      packages/pipeline/fonts/
   cp playfair/static/PlayfairDisplay-Bold.ttf         packages/pipeline/fonts/
   cp sourceserif/static/SourceSerifPro-Regular.ttf    packages/pipeline/fonts/  # v15 release
   cp sourceserif/static/SourceSerifPro-Bold.ttf       packages/pipeline/fonts/
   ```
   If Google Fonts ZIP names differ (e.g., variable font instead of static), use the static/ subdirectory; the names above are the canonical Google Fonts static TTF names.

   **Option B — direct fonts.gstatic.com (fallback):**
   If the ZIP download fails or static files are missing, fetch each TTF directly. Inspect a current Google Fonts CSS via:
   ```bash
   curl -s "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap"
   ```
   The CSS contains direct URLs to `fonts.gstatic.com/s/.../*.ttf`. Use those URLs to fetch each weight.

3. Verify each file is a valid TrueType (binary starts with `0x00 0x01 0x00 0x00`):
   ```bash
   for f in packages/pipeline/fonts/*.ttf; do
     file "$f" | grep -q "TrueType" || { echo "INVALID: $f"; exit 1; }
   done
   ```
   Each file should be 100KB-500KB. If any file is HTML (download error page) the file command will say "HTML" and the check fails.

4. Write `packages/pipeline/fonts/LICENSES/README.md` with this content:

```markdown
# Font Licenses (SIL Open Font License 1.1)

The TTF files in `packages/pipeline/fonts/` are vendored under the SIL Open Font License 1.1 (OFL-1.1). Source: https://fonts.google.com.

## Vendored Fonts

| Family | Weight | File | Source |
|--------|--------|------|--------|
| Playfair Display | Regular (400) | PlayfairDisplay-Regular.ttf | Google Fonts — by Claus Eggers Sørensen |
| Playfair Display | Bold (700) | PlayfairDisplay-Bold.ttf | Google Fonts — by Claus Eggers Sørensen |
| Source Serif Pro | Regular (400) | SourceSerifPro-Regular.ttf | Google Fonts — by Frank Grießhammer / Adobe |
| Source Serif Pro | Bold (700) | SourceSerifPro-Bold.ttf | Google Fonts — by Frank Grießhammer / Adobe |

## License Text

Full SIL OFL 1.1 text: https://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=OFL_web

Both families are distributed under SIL OFL 1.1; redistribution is permitted with attribution preserved. We use the fonts to render PDFs server-side; no Reserved Font Name is altered.

## How to Vendor a New Font

When DesignAgent's whitelist gains a new font (Andrew's call), download the static TTFs from Google Fonts, place them in `packages/pipeline/fonts/` with the deterministic filename pattern (`{FamilyNoSpaces}-{Weight}.ttf`), and append the family/weight/license attribution to the table above.
```

5. Verify the LICENSES README exists and references all four font files:
```bash
grep -c "PlayfairDisplay-Regular.ttf" packages/pipeline/fonts/LICENSES/README.md
grep -c "SourceSerifPro-Bold.ttf" packages/pipeline/fonts/LICENSES/README.md
```
Both must return >= 1.
  </action>
  <verify>
    <automated>for f in packages/pipeline/fonts/PlayfairDisplay-Regular.ttf packages/pipeline/fonts/PlayfairDisplay-Bold.ttf packages/pipeline/fonts/SourceSerifPro-Regular.ttf packages/pipeline/fonts/SourceSerifPro-Bold.ttf; do file "$f" | grep -q "TrueType" || exit 1; done && test -f packages/pipeline/fonts/LICENSES/README.md && echo ok</automated>
  </verify>
  <acceptance_criteria>
    - `ls packages/pipeline/fonts/*.ttf | wc -l` returns `4`
    - `file packages/pipeline/fonts/PlayfairDisplay-Regular.ttf` output contains `TrueType`
    - `file packages/pipeline/fonts/PlayfairDisplay-Bold.ttf` output contains `TrueType`
    - `file packages/pipeline/fonts/SourceSerifPro-Regular.ttf` output contains `TrueType`
    - `file packages/pipeline/fonts/SourceSerifPro-Bold.ttf` output contains `TrueType`
    - Each TTF is between 100000 and 500000 bytes
    - `test -f packages/pipeline/fonts/LICENSES/README.md` exits 0
    - `grep -c "SIL Open Font License" packages/pipeline/fonts/LICENSES/README.md` returns >= `1`
    - All four font files are valid TrueType readable by WeasyPrint (test via: `cd packages/pipeline && uv run python -c "from pathlib import Path; ttf = Path('fonts/PlayfairDisplay-Regular.ttf').read_bytes(); assert ttf[:4] == b'\\x00\\x01\\x00\\x00', 'not TrueType'; print('ok')"`)
  </acceptance_criteria>
  <done>
    Four TTF binaries plus LICENSES/README.md committed under packages/pipeline/fonts/; downstream renderer (Plan 06-05) can read them via base64 inline without network.
  </done>
</task>

<task type="auto">
  <name>Task 3: Extend CLI with setup-webhook-idempotency and update railway.toml preDeployCommand</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/cli.py (existing setup_checkpointer pattern — async-with from_conn_string)
    - packages/pipeline/railway.toml (existing preDeployCommand structure)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 2 — exact DDL)
    - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py (_conn_string error message style for parity)
  </read_first>
  <files>
    - packages/pipeline/src/eisenbalm_pipeline/cli.py
    - packages/pipeline/railway.toml
  </files>
  <action>
1. Rewrite `packages/pipeline/src/eisenbalm_pipeline/cli.py` ENTIRELY (the file is small; full rewrite is cleaner than patching). New content:

```python
"""CLI entrypoint for one-time operations.

Subcommands:
  setup-checkpointer            - Runs AsyncPostgresSaver.setup() against
                                  Supabase. Idempotent. CONTEXT D-12 +
                                  research Pitfall 3.
  setup-webhook-idempotency     - Creates the webhook_idempotency table for
                                  WHK-04 dedup. Idempotent (CREATE TABLE IF
                                  NOT EXISTS + UNIQUE constraint).
                                  Phase 6 Plan 06-03 + research Pattern 2.

Invocation:
  python -m eisenbalm_pipeline.cli setup-checkpointer
  python -m eisenbalm_pipeline.cli setup-webhook-idempotency

Used by:
  - railway.toml preDeployCommand (Phase 4 + Phase 6 — both subcommands run)
  - Andrew's manual provisioning (CONTEXT D-29 — railway run ...)
"""
from __future__ import annotations

import asyncio
import os
import sys

import psycopg
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

USAGE = (
    "Usage:\n"
    "  python -m eisenbalm_pipeline.cli setup-checkpointer\n"
    "  python -m eisenbalm_pipeline.cli setup-webhook-idempotency"
)


def _require_postgres_url() -> str:
    try:
        return os.environ["SUPABASE_POSTGRES_URL"]
    except KeyError:
        print(
            "ERROR: SUPABASE_POSTGRES_URL is not set. "
            "See packages/pipeline/.env.example for the session pooler format.",
            file=sys.stderr,
        )
        sys.exit(2)


async def setup_checkpointer() -> None:
    """Run AsyncPostgresSaver.setup() against the configured Supabase Postgres.

    Idempotent. Creates the 4 LangGraph checkpoint tables if they don't exist.
    """
    db_url = _require_postgres_url()
    async with AsyncPostgresSaver.from_conn_string(db_url) as cp:
        await cp.setup()
        print("Checkpointer tables created / verified.")


# Phase 6 PLan 06-03 — webhook_idempotency table (research Pattern 2)
WEBHOOK_IDEMPOTENCY_DDL = """
CREATE TABLE IF NOT EXISTS webhook_idempotency (
    id              BIGSERIAL   PRIMARY KEY,
    idempotency_key TEXT        NOT NULL,
    source          TEXT        NOT NULL,
    run_id          TEXT        NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT webhook_idempotency_key_source UNIQUE (source, idempotency_key)
);
CREATE INDEX IF NOT EXISTS webhook_idempotency_received_at_idx
    ON webhook_idempotency (received_at);
"""


async def setup_webhook_idempotency() -> None:
    """Create the webhook_idempotency table for WHK-04 dedup.

    Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS. Safe
    to run on every Railway deploy via preDeployCommand. The UNIQUE
    constraint on (source, idempotency_key) is the atomic dedup guarantee
    Sanity retries cannot defeat (research Pattern 2 + Pitfall 6).
    """
    db_url = _require_postgres_url()
    # psycopg autocommit so the DDL is not wrapped in a transaction the
    # Supabase pooler may reject.
    async with await psycopg.AsyncConnection.connect(
        db_url, autocommit=True
    ) as conn:
        async with conn.cursor() as cur:
            # Execute the multi-statement DDL one statement at a time so any
            # error points at the right line.
            for stmt in [s.strip() for s in WEBHOOK_IDEMPOTENCY_DDL.split(";") if s.strip()]:
                await cur.execute(stmt)
    print("webhook_idempotency table created / verified.")


_SUBCOMMANDS = {
    "setup-checkpointer": setup_checkpointer,
    "setup-webhook-idempotency": setup_webhook_idempotency,
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in _SUBCOMMANDS:
        print(USAGE, file=sys.stderr)
        sys.exit(1)
    asyncio.run(_SUBCOMMANDS[sys.argv[1]]())


if __name__ == "__main__":
    main()
```

2. Update `packages/pipeline/railway.toml` preDeployCommand. The current line is:

```toml
preDeployCommand = ["python -m eisenbalm_pipeline.cli setup-checkpointer"]
```

Replace it with:

```toml
# Phase 4 + Phase 6: idempotent DDL on every deploy. The list-form runs the
# items in order; both subcommands are safe under concurrent invocation
# (Postgres advisory lock for checkpoints; CREATE TABLE IF NOT EXISTS for
# webhook_idempotency).
preDeployCommand = [
    "python -m eisenbalm_pipeline.cli setup-checkpointer",
    "python -m eisenbalm_pipeline.cli setup-webhook-idempotency",
]
```

3. Smoke-verify the CLI parses both subcommands (without actually connecting to Postgres):
```bash
cd packages/pipeline
uv run python -m eisenbalm_pipeline.cli           # exits 1 with usage
uv run python -m eisenbalm_pipeline.cli help-me   # exits 1 with usage (unknown subcommand)
```
The actual DDL execution against a live Supabase is verified in Plan 06-04's idempotency tests (which TRUNCATE the table); for now the CLI smoke is "does the dispatch table accept the new subcommand string."

If SUPABASE_POSTGRES_URL is set locally, also run:
```bash
uv run python -m eisenbalm_pipeline.cli setup-webhook-idempotency
# Expected: prints "webhook_idempotency table created / verified."
```
Verify the table exists by running it a second time — same output, no error (idempotency confirmation).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -m eisenbalm_pipeline.cli 2>&1 | grep -q "setup-webhook-idempotency" && grep -c "setup-webhook-idempotency" railway.toml && grep -c "WEBHOOK_IDEMPOTENCY_DDL\|webhook_idempotency_key_source" src/eisenbalm_pipeline/cli.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "setup-webhook-idempotency" packages/pipeline/src/eisenbalm_pipeline/cli.py` returns at least `2` (subcommand registration + function name)
    - `grep -c "setup-webhook-idempotency" packages/pipeline/railway.toml` returns `1`
    - `grep -c "setup-checkpointer" packages/pipeline/railway.toml` returns `1` (preserved from Phase 4)
    - `grep -c "WEBHOOK_IDEMPOTENCY_DDL" packages/pipeline/src/eisenbalm_pipeline/cli.py` returns `1`
    - `grep -c "webhook_idempotency_key_source" packages/pipeline/src/eisenbalm_pipeline/cli.py` returns `1`
    - `cd packages/pipeline && uv run python -m eisenbalm_pipeline.cli` (no args) exits with code `1` AND prints "Usage:" to stderr
    - `cd packages/pipeline && uv run python -m eisenbalm_pipeline.cli setup-webhook-idempotency 2>&1 | head -3` — if SUPABASE_POSTGRES_URL is set, prints "webhook_idempotency table created / verified."; if unset, prints "ERROR: SUPABASE_POSTGRES_URL is not set." and exits 2
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.cli import setup_webhook_idempotency; print('importable')"` exits 0
  </acceptance_criteria>
  <done>
    CLI has two subcommands; railway.toml chains them; running setup-webhook-idempotency twice is a no-op the second time (idempotent); imports do not break Phase 4's existing setup-checkpointer behavior.
  </done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv lock --check` exits 0
- `cd packages/pipeline && uv run python -m eisenbalm_pipeline.cli setup-webhook-idempotency` either succeeds (with live DB) or exits with the documented "SUPABASE_POSTGRES_URL not set" error
- `cd packages/pipeline && ls fonts/*.ttf | wc -l` returns `4`
- `cd packages/pipeline && file fonts/*.ttf | grep -cv "TrueType"` returns `0` (every file is valid TrueType)
- `cd packages/pipeline && uv run pytest tests/ -x 2>&1 | tail -1` — Phase 5 suite still green (no regressions)
</verification>

<success_criteria>
1. weasyprint + jinja2 installed and lock-pinned
2. 4 TTFs vendored with SIL OFL license attribution
3. setup-webhook-idempotency CLI subcommand creates the table idempotently
4. railway.toml preDeployCommand chains both setup commands
5. .env.example documents SANITY_WEBHOOK_SECRET + VERCEL_DEPLOY_HOOK_URL with the algorithm hint + Pitfall 10 warning
</success_criteria>

<output>
After completion, create `.planning/phases/06-pdf-generation-webhook-chain/06-pdf-generation-webhook-chain-03-SUMMARY.md` documenting:
  - Which font ZIP source was used (Google Fonts download vs fonts.gstatic.com direct)
  - Whether the live setup-webhook-idempotency ran against a real Supabase or was deferred to Railway deploy
  - uv.lock delta size (run `git diff --stat packages/pipeline/uv.lock`)
  - Any deviations from the LICENSES/README.md template (extra families / different versions)
</output>
