---
phase: quick-260710-fxx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/scripts/check-deploy-parity.mjs
  - package.json
  - convex/README.md
  - packages/pipeline/README.md
autonomous: true
requirements: [PARITY-01, PARITY-02, PARITY-03]
must_haves:
  truths:
    - "Running `pnpm check:convex-parity` from repo root exits 0 right now (backend synced this session; all called functions present on dev:modest-magpie-797)"
    - "When a called `module:function` path is absent from the deployment, the guard exits 1 and prints the offending path plus its file:line references"
    - "When the Convex deployment is unreachable (offline / unauthenticated / CLI missing / non-JSON), the guard prints a SKIP message and exits 2 — a code DISTINCT from a real parity failure"
    - "The guard never runs `convex dev`, `convex deploy`, or any mutation — it only reads `convex function-spec`"
    - "No new npm dependency is added to any package.json; only a single script line is added to the root package.json"
    - "convex/README.md and packages/pipeline/README.md document WHY the drift is invisible locally and the phase-done RULE for Convex-touching phases"
  artifacts:
    - path: "convex/scripts/check-deploy-parity.mjs"
      provides: "Dependency-free Node ESM deploy-parity guard (report-only)"
      contains: "function-spec"
      min_lines: 60
    - path: "package.json"
      provides: "Root script alias check:convex-parity"
      contains: "check:convex-parity"
    - path: "convex/README.md"
      provides: "Deploy parity section (why + phase-done rule)"
      contains: "Deploy parity"
    - path: "packages/pipeline/README.md"
      provides: "One-line cross-reference to the parity guard"
      contains: "check:convex-parity"
  key_links:
    - from: "convex/scripts/check-deploy-parity.mjs"
      to: "convex deployment (dev:modest-magpie-797)"
      via: "npx convex function-spec run with cwd=convex/"
      pattern: "function-spec"
    - from: "convex/scripts/check-deploy-parity.mjs"
      to: "packages/pipeline/src"
      via: "recursive *.py scan collecting module:function string literals"
      pattern: "packages/pipeline/src"
---

<objective>
Add a REPORT-ONLY Convex deploy-parity guard that flags Convex functions CALLED in the Python pipeline but NOT present on the live `dev:modest-magpie-797` backend, before a Convex-touching phase is marked done. Prevents recurrence of the 2026-07-10 production 500 (`charities:listRecentFeatured` was committed to git but never synced to the deployment, so `GET /registry/coverage-strip` on the Railway pipeline threw `Could not find public function for 'charities:listRecentFeatured'`).

Purpose: `convex/_generated/api.d.ts` lists MODULES, not function names, so a missing function looks fine locally — only a live check against the deployed function-spec catches the drift.
Output: One dependency-free Node ESM script (`convex/scripts/check-deploy-parity.mjs`), one root `package.json` script line, and short docs in `convex/README.md` + `packages/pipeline/README.md`. The guard NEVER auto-deploys — it only reports drift and exits non-zero.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

Verified environment (do NOT re-audit — these facts were confirmed this session):

- ONE dev-tier Convex deployment. `convex/.env.local` contains
  `CONVEX_DEPLOYMENT=dev:modest-magpie-797`. Both the Railway pipeline and the
  dispatch-control app query it.
- `npx convex function-spec` — run with cwd=`convex/` so it reads
  `convex/.env.local` — prints JSON for the DEPLOYED deployment. Top-level
  `.url` (string) and `.functions[]` (array). Each function has `.identifier`
  in the form `module.js:fn` (e.g. `charities.js:listRecentFeatured`,
  `agentVotes.js:byRunId`) and `.visibility.kind` (`public`/`internal`).
  Normalize identifiers to `module:fn` by stripping the `.js` that precedes the
  `:` separator. Convex CLI is a devDependency of `@eisenbalm/convex`
  (`convex ^1.38.0`), so `npx convex` resolves the local binary.
- The pipeline (Python) is the risky untyped surface. Convex helpers live in
  `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`:
  `convex_query(http, path, args)` / `convex_mutation(http, path, args)` take
  `http` FIRST then path; the `_safe` variants take `path` FIRST. So do NOT
  parse argument position. Function paths are string literals shaped
  `"module:function"` and are frequently on the line AFTER the call opener
  (multi-line calls span several lines) — e.g. `api/registry.py:51` has
  `"charities:listRecentFeatured"` on its own line. A plain string-literal scan
  (below) is therefore the robust approach.
- Over-collection is intentional: a few `module:function`-shaped strings live
  in docstrings (e.g. `charities:listForDedup` in `convex_client.py`). That is
  fine — those are real deployed functions, so they will not false-flag.
  Hyphenated strings like `dev:modest-magpie-797` do NOT match the regex
  (hyphen is not in `[A-Za-z0-9_]`), so the deployment name itself is ignored.
  Header names like `"Content-Type"` / `"application/json"` also do not match
  (no `word:word` colon).

Repo facts:
- Root `package.json` name `eisenbalm`, pnpm@9 workspaces (`pnpm-workspace.yaml`
  present). Existing filter scripts use `pnpm --filter @eisenbalm/convex ...`.
- `@eisenbalm/convex` (`convex/package.json`) exposes `dev:once` →
  `convex dev --once` (the sync command referenced in the fix message).
- `convex/scripts/` does NOT exist yet — create it.
- `convex/README.md` (~16KB) and `packages/pipeline/README.md` (~31KB) both
  exist — insert/append a section, do NOT overwrite.

Exit-code contract (bake into the script exactly):
- 0 → all CALLED paths present on the deployment (success)
- 1 → at least one CALLED path missing (real parity failure)
- 2 → could not reach / parse the deployment (SKIP — "couldn't check", NOT "all clear")
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write the deploy-parity guard script and wire the root package.json alias</name>
  <files>convex/scripts/check-deploy-parity.mjs, package.json</files>
  <action>
Create `convex/scripts/check-deploy-parity.mjs` — a dependency-free Node ESM
script using ONLY Node built-ins (`node:child_process`, `node:fs`,
`node:path`, `node:url`). It must run correctly regardless of the cwd it is
invoked from.

Path resolution (robust, cwd-independent):
- `scriptDir = path.dirname(fileURLToPath(import.meta.url))` → `<repo>/convex/scripts`
- `convexDir = path.dirname(scriptDir)` → `<repo>/convex`
- `repoRoot = path.dirname(convexDir)` → `<repo>`
- `pipelineSrc = path.join(repoRoot, 'packages/pipeline/src')`

Build the DEPLOYED set:
- Run `npx convex function-spec` via `execFileSync('npx', ['convex', 'function-spec'], { cwd: convexDir, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 20 * 1024 * 1024 })`.
- Wrap in try/catch. On ANY throw (non-zero exit, timeout, ENOENT/CLI missing) →
  print `SKIP: could not reach Convex deployment (convex function-spec failed) — parity NOT checked` (include the error message on a second line) and `process.exit(2)`.
- Parse stdout as JSON. Be tolerant: try `JSON.parse(stdout.trim())`; if that
  throws, fall back to parsing the substring from the first `{` to the last `}`.
  If still not parseable, or `.functions` is not an array → same SKIP message +
  `process.exit(2)`.
- Map each `.functions[].identifier` (`module.js:fn`) to `module:fn` by removing
  the `.js` that immediately precedes the `:` (e.g. `identifier.replace(/\.js:/, ':')`);
  collect into a `Set`. Capture `.url` and the deployed count for the success line.

Build the CALLED set:
- Recursively walk `pipelineSrc` for `*.py` files (skip `__pycache__`). If
  `pipelineSrc` does not exist → SKIP + exit 2 with a clear message.
- For each file, read line-by-line. On each line, find every quoted string
  literal (both `"..."` and `'...'`) and test the INNER content against
  `/^[A-Za-z_][A-Za-z0-9_]*:[A-Za-z_][A-Za-z0-9_]*$/`. On match, record the path
  in a `Map<string, string[]>` keyed by the `module:function` path, appending
  `` `${relPath}:${lineNo}` `` (relPath relative to repoRoot). This over-collects
  by design — do NOT try to detect the convex_* helper or arg position.

DIFF + report:
- `missing = [...calledMap.keys()].filter(p => !deployedSet.has(p))` (sorted).
- If `missing.length > 0`: print a header explaining the fix, then for each
  missing path print the path and an indented list of its `file:line`
  references. The fix header MUST instruct:
  `Run: pnpm --filter @eisenbalm/convex dev:once   (syncs convex/ to dev:modest-magpie-797), then re-run pnpm check:convex-parity`.
  Also print `total called: <N>, total deployed: <M>`. Then `process.exit(1)`.
- Else: print a concise success line, e.g.
  `✓ convex deploy parity: <N> called functions all present on dev:modest-magpie-797 (<M> deployed)`, then `process.exit(0)`.

CONSTRAINTS the script must honor: report-only — it must NEVER invoke
`convex dev`, `convex deploy`, or any mutation; it only reads `function-spec`.
Keep output readable and grouped. Match the repo's JS conventions (ESM,
2-space indent).

Then edit the root `package.json`: add ONE line to `scripts` (place it near the
other `*:convex` scripts):
`"check:convex-parity": "node convex/scripts/check-deploy-parity.mjs"`.
Add NO dependencies.

Before finalizing the JSON parser, run `npx convex function-spec` once from
`convex/` to confirm the actual stdout shape (`.url`, `.functions[].identifier`,
`.visibility.kind`); adjust the parse ONLY if the real shape differs.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm check:convex-parity; echo "SUCCESS_EXIT=$?"</automated>
    <automated>cd /Users/user/Desktop/Eisenbalm && printf 'x = "bogusmod:bogusfn"\n' > packages/pipeline/src/eisenbalm_pipeline/_parity_probe_tmp.py && OUT=$(pnpm check:convex-parity 2>&1); RC=$?; echo "$OUT"; echo "FAIL_EXIT=$RC"; echo "$OUT" | grep -q "bogusmod:bogusfn" && echo "NAMED_OK"; rm -f packages/pipeline/src/eisenbalm_pipeline/_parity_probe_tmp.py; pnpm check:convex-parity; echo "CLEAN_EXIT=$?"</automated>
  </verify>
  <done>
`pnpm check:convex-parity` exits 0 today (SUCCESS_EXIT=0) with a success line naming dev:modest-magpie-797. The bogus-path probe makes it exit 1 (FAIL_EXIT=1) and prints `bogusmod:bogusfn` with its `_parity_probe_tmp.py:1` reference (NAMED_OK); after removing the temp file the guard exits 0 again (CLEAN_EXIT=0) and the tree is clean (no probe file left). An unreachable deployment yields the SKIP message + exit 2. Root package.json has exactly one added script line and no new deps.
  </done>
</task>

<task type="auto">
  <name>Task 2: Document the deploy-parity rule in convex/README.md and cross-reference from packages/pipeline/README.md</name>
  <files>convex/README.md, packages/pipeline/README.md</files>
  <action>
Add a short `## Deploy parity` section to `convex/README.md` (insert after the
intro/Tables area — do NOT overwrite existing content). It must explain:

- WHY the drift is invisible: git-committed `convex/*.ts` is NOT live on the
  single `dev:modest-magpie-797` backend until synced; `_generated/api.d.ts`
  lists MODULES (not function names), so a missing function looks current
  locally. Cite the 2026-07-10 incident (`charities:listRecentFeatured`
  committed but unsynced → production 500 on `GET /registry/coverage-strip`).
- WHAT the guard does: `pnpm check:convex-parity` runs
  `convex/scripts/check-deploy-parity.mjs`, which reads the DEPLOYED
  `convex function-spec` and diffs it against every `module:function` string
  literal called in `packages/pipeline/src/**/*.py`. Report-only — it never
  deploys. Exit codes: 0 = all present, 1 = missing (drift), 2 = could not
  check (offline/unauth).
- The RULE (phase-done gate): any phase touching `convex/` MUST run
  `pnpm --filter @eisenbalm/convex dev:once` (sync), then
  `pnpm check:convex-parity` (must exit 0) BEFORE being marked done.

Then add a ONE-LINE cross-reference to `packages/pipeline/README.md` (in a
sensible spot near its Convex/deploy notes) pointing to the parity guard and
the phase-done rule — e.g. mention that any Convex path added here must be
synced and verified with `pnpm check:convex-parity`, see `convex/README.md`
"Deploy parity".

Match each file's existing Markdown style. No other content changes.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "Deploy parity" convex/README.md && grep -q "check:convex-parity" convex/README.md && grep -q "dev:once" convex/README.md && grep -q "check:convex-parity" packages/pipeline/README.md && echo "DOCS_OK"</automated>
  </verify>
  <done>
`convex/README.md` has a `## Deploy parity` section stating WHY (modules-not-functions + the 2026-07-10 incident) and the phase-done RULE (`dev:once` then `pnpm check:convex-parity` must exit 0). `packages/pipeline/README.md` has a one-line cross-reference to the guard. `grep` prints DOCS_OK.
  </done>
</task>

</tasks>

<verification>
- `pnpm check:convex-parity` exits 0 from repo root today (backend synced this session).
- Failure path proven real via a temporary bogus `module:function` literal → exit 1 + path named → temp file removed → exit 0 again (no scaffolding left behind).
- SKIP path (unreachable/unparseable deployment) exits 2, distinct from failure.
- No npm dependency added to any package.json; only one root script line added.
- No Convex function or schema modified; nothing auto-deployed.
- Docs present in both READMEs (grep DOCS_OK).
</verification>

<success_criteria>
- `convex/scripts/check-deploy-parity.mjs` exists, dependency-free, report-only, exit codes 0/1/2 as specified.
- Root `package.json` has `check:convex-parity` → `node convex/scripts/check-deploy-parity.mjs` and no new deps.
- `convex/README.md` documents the why + the phase-done rule; `packages/pipeline/README.md` cross-references it.
- Working tree clean after verification (no probe/scratch files).
</success_criteria>

<output>
After completion, create `.planning/quick/260710-fxx-convex-deploy-parity-guard-check-called-/260710-fxx-SUMMARY.md`.
</output>
