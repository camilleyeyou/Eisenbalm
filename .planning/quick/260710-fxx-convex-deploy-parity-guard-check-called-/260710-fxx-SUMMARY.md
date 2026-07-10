---
phase: quick-260710-fxx
plan: 01
subsystem: infra
tags: [convex, ci-guard, node, deploy-drift, pipeline]

requires: []
provides:
  - "convex/scripts/check-deploy-parity.mjs — dependency-free Node ESM report-only guard diffing live `convex function-spec` against `module:function` calls in the Python pipeline"
  - "pnpm check:convex-parity root script alias"
  - "convex/README.md 'Deploy parity' section documenting the why + phase-done rule"
affects: [convex, packages/pipeline]

tech-stack:
  added: []
  patterns:
    - "Report-only drift guard: reads live deployment metadata (`convex function-spec`), never deploys/mutates; exit codes 0/1/2 distinguish success/failure/could-not-check"
    - "String-literal scan (not AST/regex-on-call-site) for detecting cross-language (Python -> Convex) call references, deliberately over-collecting to stay robust against multi-line call sites"

key-files:
  created:
    - convex/scripts/check-deploy-parity.mjs
  modified:
    - package.json
    - convex/README.md
    - packages/pipeline/README.md

key-decisions:
  - "Hardcoded the deployment name (dev:modest-magpie-797) in guard output messages rather than deriving it from `.url`, matching the plan's exact wording since there is currently only one dev-tier deployment"
  - "Used a plain per-line quoted-string-literal regex scan over packages/pipeline/src/**/*.py instead of trying to detect convex_query/convex_mutation call sites specifically — robust against multi-line calls and intentionally over-collects (docstring references to real functions never false-flag)"

requirements-completed: [PARITY-01, PARITY-02, PARITY-03]

duration: 20min
completed: 2026-07-10
---

# Quick Task 260710-fxx: Convex deploy-parity guard Summary

**Dependency-free Node ESM script (`pnpm check:convex-parity`) that diffs live `convex function-spec` against every `module:function` string called in the Python pipeline, catching committed-but-unsynced Convex functions before they cause a production 500.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-10T18:45:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Built `convex/scripts/check-deploy-parity.mjs` using only Node built-ins (`node:child_process`, `node:fs`, `node:path`, `node:url`) — no new npm dependency
- Confirmed the real `convex function-spec` output shape live against `dev:modest-magpie-797` (`.url` string, `.functions[].identifier` as `module.js:fn`, `.visibility.kind`) before finalizing the parser — matched the plan's documented shape exactly
- Wired `pnpm check:convex-parity` as a single new root `package.json` script line
- Proved all three exit-code paths live against the real repo: `0` (45 called functions / 110 deployed, all present), `1` (temporary bogus `module:function` literal named with its `file:line`, then cleaned up with tree verified clean and exit back to `0`), and `2` (simulated unreachable deployment via a broken `PATH`, distinct SKIP message)
- Documented the "why the drift is invisible" + phase-done rule in `convex/README.md`, citing the 2026-07-10 `charities:listRecentFeatured` production 500 incident, and cross-referenced it from `packages/pipeline/README.md`

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the deploy-parity guard script and wire the root package.json alias** - `5895732` (feat)
2. **Task 2: Document the deploy-parity rule in convex/README.md and cross-reference from packages/pipeline/README.md** - `a723010` (docs)

_No plan-metadata commit yet — this SUMMARY.md is created after both task commits; per this quick task's constraints, ROADMAP.md is not touched and the final STATE.md/artifact commit is handled by the `/gsd:quick` orchestrator (Step 7/8), not this executor._

## Files Created/Modified

- `convex/scripts/check-deploy-parity.mjs` — the guard itself: builds the DEPLOYED set from live `convex function-spec` (normalizing `module.js:fn` → `module:fn`), builds the CALLED set by recursively scanning `packages/pipeline/src/**/*.py` for quoted `module:function`-shaped string literals, diffs them, and reports with exit 0/1/2
- `package.json` — added `"check:convex-parity": "node convex/scripts/check-deploy-parity.mjs"` (one line, no new deps)
- `convex/README.md` — new `## Deploy parity` section (why the drift is invisible + the 2026-07-10 incident + what the guard does + the phase-done rule)
- `packages/pipeline/README.md` — one-line cross-reference to the guard added to the existing "Cross-references" section

## Decisions Made

- Hardcoded `DEPLOYMENT_NAME = 'dev:modest-magpie-797'` in the script's user-facing messages (success line + fix instruction) rather than deriving it from the function-spec response's `.url` field — matches the plan's exact required wording and this repo currently has exactly one dev-tier deployment.
- Chose a plain per-line quoted-string-literal scan (`/^[A-Za-z_][A-Za-z0-9_]*:[A-Za-z_][A-Za-z0-9_]*$/` tested against every `"..."`/`'...'` match) over trying to parse `convex_query`/`convex_mutation` call sites specifically. The plan explicitly called this out as the robust approach given multi-line call sites in `convex_client.py`; over-collection (e.g. docstring references to real deployed functions) is safe because those functions are genuinely deployed and never false-flag.

## Deviations from Plan

None — plan executed exactly as written. The "confirm the real `convex function-spec` shape before finalizing the parser" instruction in Task 1 was followed as a pre-implementation check (see verification transcript below) and the shape matched the plan's documented expectation, so no parser adjustment was needed.

## Issues Encountered

None. One test artifact worth noting for future readers: piping `npx convex function-spec` through `head -c 2000` during the manual shape-confirmation step produced a benign `EPIPE` stderr trace from the Convex CLI (expected when a downstream pipe closes early) — this is unrelated to the guard's own `stdio: ['ignore', 'pipe', 'ignore']` invocation, which does not pipe to `head` and was verified separately with the full un-truncated output.

## User Setup Required

None — no external service configuration required. The guard reads the existing `convex/.env.local` (`CONVEX_DEPLOYMENT=dev:modest-magpie-797`), already present and gitignored in this environment.

## Verification Transcript (for traceability)

```
$ pnpm check:convex-parity
✓ convex deploy parity: 45 called functions all present on dev:modest-magpie-797 (110 deployed)
SUCCESS_EXIT=0

$ printf 'x = "bogusmod:bogusfn"\n' > packages/pipeline/src/eisenbalm_pipeline/_parity_probe_tmp.py
$ pnpm check:convex-parity
✗ convex deploy parity FAILED — function(s) called from the pipeline are missing from the live deployment
Run: pnpm --filter @eisenbalm/convex dev:once   (syncs convex/ to dev:modest-magpie-797), then re-run pnpm check:convex-parity
  bogusmod:bogusfn
    - packages/pipeline/src/eisenbalm_pipeline/_parity_probe_tmp.py:1
total called: 46, total deployed: 110
FAIL_EXIT=1
NAMED_OK

$ rm -f packages/pipeline/src/eisenbalm_pipeline/_parity_probe_tmp.py
$ pnpm check:convex-parity
✓ convex deploy parity: 45 called functions all present on dev:modest-magpie-797 (110 deployed)
CLEAN_EXIT=0

$ PATH=/nonexistent node convex/scripts/check-deploy-parity.mjs
SKIP: could not reach Convex deployment (convex function-spec failed) — parity NOT checked
spawnSync npx ENOENT
EXIT=2
```

Working tree confirmed clean of probe/scratch files after the failure-path proof (`git status --short` showed no leftover `_parity_probe_tmp.py`).

## Next Phase Readiness

`pnpm check:convex-parity` is ready to be adopted as a phase-done gate for any future phase touching `convex/`, per the rule now documented in `convex/README.md`. No blockers.

---
*Quick task: 260710-fxx*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: convex/scripts/check-deploy-parity.mjs
- FOUND: package.json script line (`check:convex-parity`)
- FOUND: convex/README.md "Deploy parity" section
- FOUND: packages/pipeline/README.md cross-reference
- FOUND: commit 5895732 (Task 1)
- FOUND: commit a723010 (Task 2)
