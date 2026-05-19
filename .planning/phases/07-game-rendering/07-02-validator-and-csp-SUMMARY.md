---
phase: 07-game-rendering
plan: 02
subsystem: testing
tags: [game-validator, csp, iframe-sandbox, xss-defense, content-security-policy, vitest]

requires:
  - phase: 07-game-rendering
    provides: vitest infrastructure (vitest.config.ts + apps/web/__tests__ directory + test:unit script + stub game-validator.test.ts placeholder from Plan 07-01)
  - phase: 05-agent-quality
    provides: packages/pipeline/.../agents/game.py FORBIDDEN_CONSTRUCTS module-level string (Plan 05-11 D-20) — frontend BANNED_PATTERNS mirrors it

provides:
  - validateEmbedCode(s) — pure validator returning {valid:true} or {valid:false, reason:'Forbidden construct: ...'}
  - injectGameHead(s) — pure srcdoc head injector (CSP meta + viewport + mobile CSS reset)
  - BANNED_PATTERNS — 13-entry readonly deny-list (10 mirrored from Python + 3 GAM-02 extras)
  - GAME_CSP_POLICY — 9-directive CSP policy string ending in connect-src 'none' / form-action 'none'
  - 24 passing vitest assertions covering every banned pattern, every CSP directive, viewport meta, and mobile reset

affects: [07-03 (GameSlot consumes validateEmbedCode + injectGameHead), 07-04 (sandbox attribute scan reads BANNED_PATTERNS list awareness), 07-05 (smoke test references the validator), future Python edits to FORBIDDEN_CONSTRUCTS]

tech-stack:
  added: []
  patterns:
    - "Hand-mirrored deny-list — frontend TypeScript cannot import Python module; both lists describe the same threat surface, kept in sync by convention + this SUMMARY footer"
    - "Always-prepend head injection (Pitfall 4) — never relies on <head> match, works with malformed LLM HTML"
    - "Parametric per-pattern tests via for/of loop — vitest output names each rejected construct, regression points to exact pattern"
    - "BANNED_PATTERNS length tripwire — adding an entry without updating BANNED_SAMPLES fails the suite"

key-files:
  created:
    - "apps/web/lib/game-validator.ts (validator + injector module — exports validateEmbedCode, injectGameHead, BANNED_PATTERNS, GAME_CSP_POLICY)"
  modified:
    - "apps/web/__tests__/game-validator.test.ts (replaced 07-01 stub with full coverage — 24 passing assertions)"
    - "apps/web/tsconfig.json (deviation: extended include to cover __tests__/**/*.ts so vite-tsconfig-paths can resolve @/lib aliases)"

key-decisions:
  - "13-entry deny-list, not 10 — mirrors the 10 Python FORBIDDEN_CONSTRUCTS entries plus the 3 GAM-02 ROADMAP extras (top., parent., document.domain) called out by the requirement text"
  - "Word-boundary regex for top. and parent. (\\btop\\., \\bparent\\.) — prevents false positives on phrases like 'top tier' or 'margin-top.5rem' (Pitfall 5)"
  - "Always-prepend head injection — does not attempt to match <head> in LLM output; the LLM may omit it entirely. Browser meta CSP is applied at parse time, but prepending is the only safe guarantee"
  - "CSP includes script-src 'unsafe-inline' AND style-src 'unsafe-inline' because game JS/CSS are dynamic — no nonce/hash possible. connect-src 'none' is the network backstop that catches obfuscated forms (window['fetch'], new Function-driven calls, etc.)"
  - "tsconfig.json include extended to __tests__ — required for vite-tsconfig-paths to resolve @/lib alias; without it the test file fails to load. package.json + vitest.config.ts left untouched (07-01's territory per coordination notes)"

patterns-established:
  - "Pure-function validator + injector: zero React, zero Convex, zero I/O. Plan 07-03 GameSlot is responsible for the Convex deliberationEvents:insert write on validation failure"
  - "Mirror-list discipline: deny-list lives in two places (Python game.py + TypeScript game-validator.ts); the source-of-truth comment in each file points at the other"

requirements-completed:
  - GAM-02
  - GAM-04
  - GAM-06

duration: 8min
completed: 2026-05-19
---

# Phase 07 Plan 02: Validator and CSP Summary

**Game embed-code validator + CSP/head injector with 24-test vitest coverage proving every banned construct is rejected and every CSP directive is injected**

## Performance

- **Duration:** 8 min (499s)
- **Started:** 2026-05-19T07:32:30Z
- **Completed:** 2026-05-19T07:40:49Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Shipped `apps/web/lib/game-validator.ts` with `validateEmbedCode()` rejecting all 13 banned constructs (10 mirrored from Python + 3 GAM-02 extras) and `injectGameHead()` prepending CSP + viewport + mobile reset to every srcdoc
- Replaced Plan 07-01's three `it.todo` stubs with 24 passing vitest assertions: 13 parametric per-pattern tests + empty-input + safe-doc + 13-entry mirror tripwire + word-boundary false-positive guard + 8 CSP/inject behaviour tests
- Locked Phase 7 renderer-level enforcement: Phase 5 GameWriter prompt-level defense is now backed by a real second wall that rejects LLM hallucinations the prompt missed and adds the `connect-src 'none'` network backstop

## Task Commits

Each task was committed atomically:

1. **Task 1: Write game-validator.ts with deny-list + CSP + head injector** — `5cc8ae6` (feat)
2. **Task 2: Replace stub assertions in __tests__/game-validator.test.ts with real coverage** — `f4b3394` (test, includes Rule 3 deviation on tsconfig.json)

**Plan metadata:** _(committed after self-check + state updates)_

## Files Created/Modified

- `apps/web/lib/game-validator.ts` (new, 131 lines) — Module exporting `validateEmbedCode`, `injectGameHead`, `BANNED_PATTERNS` (13 entries), `GAME_CSP_POLICY` (9 directives joined by `; `), plus the internal `GAME_HEAD` string and module-level documentation noting the Python mirror relationship
- `apps/web/__tests__/game-validator.test.ts` (modified, 122 lines) — Full coverage: 13 parametric `rejects: <label>` tests + empty-input test + safe-doc accept test + 13-entry mirror length test + word-boundary safety test + 7 inject/CSP tests. 24 passing, 0 todo
- `apps/web/tsconfig.json` (modified, +2 lines) — Extended `include` glob with `__tests__/**/*.ts` and `__tests__/**/*.tsx` so the TypeScript compiler (and by extension `vite-tsconfig-paths`) can resolve the `@/lib/game-validator` path alias inside the test file

## Decisions Made

- **13-entry deny-list, not 10:** The Python `FORBIDDEN_CONSTRUCTS` in `packages/pipeline/src/eisenbalm_pipeline/agents/game.py` enumerates 10 constructs. The GAM-02 ROADMAP requirement text adds three more that the prompt didn't already cover but the renderer MUST reject: `top.`, `parent.`, `document.domain`. The frontend list mirrors the Python 10 verbatim plus these three.
- **Word-boundary regex for `top.` and `parent.`:** `\btop\.` rather than `top.` avoids false-positives on `margin-top.5rem` style strings or natural-language phrases like "top tier". Tested explicitly via the "does not false-positive on words" assertion.
- **Always-prepend head injection (Pitfall 4):** The function does not attempt to insert into `<head>` because LLM output may omit it. The CSP meta tag, viewport meta, and mobile CSS reset are all prepended to the input string. Tests verify CSP appears before `<!DOCTYPE html>` and before `<body>` even in malformed HTML.
- **CSP directive set:** Includes `script-src 'unsafe-inline'` + `style-src 'unsafe-inline'` because game JS/CSS are dynamic (no nonce/hash possible), but locks down everything else with `default-src 'none'` and explicit `connect-src 'none'` (network backstop), `frame-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `img-src data:` (base64 sprites only).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended apps/web/tsconfig.json `include` to cover `__tests__/**/*.ts`**
- **Found during:** Task 2 (running `pnpm --filter web test:unit` for the first time)
- **Issue:** The initial test run failed with `Cannot find package '@/lib/game-validator' imported from .../__tests__/game-validator.test.ts`. Vite's `vite-tsconfig-paths` plugin loads path aliases from `tsconfig.json` but only applies them to files inside the `include` globs. `apps/web/tsconfig.json` listed `app/**`, `components/**`, `lib/**` but not `__tests__/**`, so the alias was effectively unavailable to the test file.
- **Fix:** Added two lines (`"__tests__/**/*.ts"` and `"__tests__/**/*.tsx"`) to the `include` array. After this change all 24 tests pass and `pnpm --filter web typecheck` still exits 0.
- **Files modified:** `apps/web/tsconfig.json`
- **Verification:** `pnpm --filter web test:unit` → 24 passed; `pnpm --filter web typecheck` → exit 0
- **Committed in:** `f4b3394` (same commit as Task 2 — these two changes are inseparable: the test file is meaningless without the alias resolution)
- **Why not 07-01's territory:** Plan 07-01's owned files (per coordination notes) are `apps/web/package.json` and `apps/web/vitest.config.ts`. `apps/web/tsconfig.json` is not listed; the include glob was scoped to runtime code only, which is reasonable for 07-01's scope. The test directory only exists after 07-02 fills it. Extending include here is the minimal change.

---

**Total deviations:** 1 auto-fixed (Rule 3 — Blocking)
**Impact on plan:** Necessary to make the test suite runnable; no scope creep. The fix is a 2-line tsconfig glob extension with no behavioral side effects on the Next.js build (Next 15 uses its own resolution layer for runtime code).

## Issues Encountered

- **Cross-agent file contention (handled cleanly via coordination notes):** Plan 07-01 was running in parallel and shipped its `apps/web/__tests__/game-validator.test.ts` stub between Task 1 and Task 2 of this plan. The stub appeared exactly as 07-01 specified (3 `it.todo` calls inside the right describe blocks). The `Write` tool refused the overwrite without a prior `Read`, which surfaced this state — I re-read the stub, then overwrote it with the full coverage version. No merge conflict, no lost work.

## User Setup Required

None — no external services configured.

## Frontend ↔ Python Deny-list Mirror (FUTURE ENGINEERS, READ THIS)

The forbidden-construct deny-list lives in **two places** and must be kept in sync **manually**:

1. **Python (source of truth for the prompt):** `packages/pipeline/src/eisenbalm_pipeline/agents/game.py` — the module-level string `FORBIDDEN_CONSTRUCTS` (lines 24-40) — 10 entries: `<script src=`, `<link href=`, `fetch(`, `XMLHttpRequest`, `window.parent`, `window.top`, `document.cookie`, `localStorage`, `eval(`, `import(`.
2. **TypeScript (source of truth for the renderer):** `apps/web/lib/game-validator.ts` — `BANNED_PATTERNS` — 13 entries: the 10 Python ones PLUS `top.` (regex), `parent.` (regex), `document.domain` (string).

The TypeScript file cannot `import` from the Python module (cross-language barrier). Both files contain header comments pointing at the other. **If you edit either list, edit the other in the same PR.** The 13-entry mirror tripwire test (`mirrors all 13 banned-pattern entries exactly`) in `__tests__/game-validator.test.ts` will fail if `BANNED_PATTERNS` grows or shrinks without updating `BANNED_SAMPLES`, which forces you to acknowledge the count change.

The full `GAME_CSP_POLICY` string verbatim:

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
```

## Test Pass Count

`pnpm --filter web test:unit` reports:

```
 ✓ __tests__/game-validator.test.ts (24 tests) 11ms
 ↓ __tests__/game-sandbox.test.ts (1 test | 1 skipped)

 Test Files  1 passed | 1 skipped (2)
      Tests  24 passed | 1 todo (25)
```

The `1 todo` is the placeholder in `game-sandbox.test.ts` owned by Plan 07-04.

## Next Phase Readiness

- **Plan 07-03 (GameSlot wiring) unblocked:** Can `import { validateEmbedCode, injectGameHead } from '@/lib/game-validator'` and consume the validator's result to decide whether to render the iframe or the fallback. GameSlot owns the Convex `deliberationEvents:insert` write on validation failure.
- **Plan 07-04 (sandbox source scan):** Can grep the renderer-level enforcement story for completeness. The 13-pattern deny-list is the documented contract.
- **No blockers:** typecheck clean, all 24 unit tests pass, no `it.todo` remaining in `game-validator.test.ts`.

## Self-Check: PASSED

- File exists: `apps/web/lib/game-validator.ts` — FOUND
- File exists: `apps/web/__tests__/game-validator.test.ts` — FOUND
- File modified: `apps/web/tsconfig.json` — FOUND (Rule 3 deviation tracked above)
- Commit exists: `5cc8ae6` — FOUND (`feat(07-02): add game-validator module with deny-list + CSP + head injector`)
- Commit exists: `f4b3394` — FOUND (`test(07-02): replace stub assertions with full game-validator coverage`)
- Acceptance criteria (Task 1): all 18 greps pass + typecheck exits 0
- Acceptance criteria (Task 2): import path resolves, 24 tests pass, 0 `it.todo` remain, parametric `rejects:` labels appear in vitest output

---
*Phase: 07-game-rendering*
*Completed: 2026-05-19*
