---
phase: 07-game-rendering
plan: 03
subsystem: web-rendering
tags: [gameslot, iframe-sandbox, csp, validator-wiring, convex-mutation, client-component]

requires:
  - phase: 07-game-rendering
    provides: validateEmbedCode + injectGameHead pure functions (Plan 07-02) — consumed via `import { validateEmbedCode, injectGameHead } from '@/lib/game-validator'`
  - phase: 07-game-rendering
    provides: Vitest + vite-tsconfig-paths infra (Plan 07-01) — no new tests added in this plan, but typecheck/test:unit gates rely on the toolchain
  - phase: 05-agent-quality
    provides: convex/qaCorrections.ts insert mutation (Phase 5 schema with severity + axis + agentId fields) — called via `useMutation(api.qaCorrections.insert)`
  - phase: 03-convex-deployment
    provides: ConvexClientProvider mounted at root layout — `useMutation` resolves in any descendant Client Component
  - phase: 02-web-shell-theme-engine
    provides: Phase 2 GameSlot scaffolding with correct sandbox attribute + AnchorCopyButton + Issue.runId already typed string|null

provides:
  - "Production GameSlot Client Component that conditionally renders iframe / GameFallback / coming-soon based on validateEmbedCode result"
  - "GameFallback pure display component with locked Jesse-voice copy 'Game unavailable.'"
  - "One-shot guarded Convex qaCorrections.insert write on validation failure (useRef + runId null check)"
  - "page.tsx wires issue.runId (?? null defensive) into the new GameSlot prop"
  - "File shape ready for Plan 07-04 source-scan tripwire (no allow-same-origin literal anywhere in GameSlot.tsx)"

affects:
  - "07-04 (sandbox-source-scan): GameSlot.tsx is now in its Phase 7 final shape — the source-scan test in __tests__/game-sandbox.test.ts will scan this exact file for forbidden tokens"
  - "07-05 (readme-and-smoke-test): README documentation + Andrew smoke test target the conditional rendering tree shipped here"
  - "Phase 9 (deliberation layer): qaCorrections rows with agentId='game-validator' + axis='hard-rule' will surface in the live deliberation UI"

tech-stack:
  added: []
  patterns:
    - "Client Component validator + Convex write co-located (GameSlot owns Convex side effect; validator + injector are pure)"
    - "useRef-as-idempotency-guard for fire-and-forget mutations under React Strict Mode (set ref BEFORE await/catch so re-render during in-flight mutation can't double-fire)"
    - "?? null defensive coalesce on RSC→Client prop boundary even when type is already string|null (protects against future GROQ projection drift to undefined)"
    - "Sandbox token literal forbidden in renderer file body — comments use indirect phrasing ('the same-origin escape token', 'forbidden token literal') so Plan 07-04 source-scan can grep for the literal without false-positive on docstrings"

key-files:
  created:
    - "apps/web/components/issue/GameFallback.tsx (22 lines — pure display, no hooks, no 'use client', locked 'Game unavailable.' copy)"
  modified:
    - "apps/web/components/issue/GameSlot.tsx (157 lines — promoted to 'use client', validator + injector consumption, useEffect-guarded Convex write, preserves Phase 2 section wrapper byte-for-byte)"
    - "apps/web/app/issue/[slug]/page.tsx (one-line edit — `<GameSlot game={issue.game} runId={issue.runId ?? null} />`)"

key-decisions:
  - "'use client' moved to line 1 ABOVE the docstring (plan said line 1, and `head -1` acceptance check is unambiguous — Next.js requires the directive before any other code/comments)"
  - "Sandbox security comments rewritten to use indirect phrasing ('the same-origin escape token', 'forbidden token literal', 'escape token') instead of the literal forbidden string — Plan 07-04's source-scan test will grep this file for the exact literal, so docstrings must not contain it"
  - "useRef guard placed BEFORE the await/catch (reportedRef.current = true is set on the synchronous path before insertQaCorrection().catch fires) — ensures Strict Mode double-render in dev doesn't double-fire the mutation"
  - "Convex mutation arg shape matches Phase 5 qaCorrections.insert validator exactly: runId/sectionName/reason/severity/accepted/agentId/axis are passed; legacy fieldName/original/corrected and Plan 5 quotedSpan/suggestedFix are omitted (NOT undefined-passed)"
  - "?? null coalesce on issue.runId — Issue.runId is already string|null on the type, but the RSC→Client boundary coalesce protects against future GROQ projection changes drifting to undefined"
  - "Phase 2 section wrapper preserved byte-for-byte (mx-auto max-w-[860px], top divider, label row + AnchorCopyButton, headline, description, container with h-[280px] sm:h-[360px], bottom mt-8 spacer) — only the inner placeholder + hidden iframe stub were replaced"

requirements-completed:
  - GAM-01
  - GAM-05
  - GAM-06

metrics:
  duration: 4min
  tasks-completed: 3
  files-created: 1
  files-modified: 2
  completed: 2026-05-19
---

# Phase 07 Plan 03: GameSlot Wiring Summary

Phase 7 GameSlot lit up: real iframe with validator-gated srcdoc, fallback on rejection, one-shot Convex qaCorrections write, and `issue.runId` threaded from the RSC page. The Phase 2 hidden-iframe placeholder is gone; the editorial section now renders one of three states based on `validateEmbedCode` + Phase 5 `IssueGame` data.

## Performance

- **Duration:** 4 min (~232s)
- **Started:** 2026-05-19T07:45:06Z
- **Completed:** 2026-05-19T07:48:58Z
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Shipped `apps/web/components/issue/GameFallback.tsx` (new, 22 lines) — pure display component with the locked Jesse-voice copy `Game unavailable.`. Typography mirrors Phase 2 placeholder so visual rhythm is unchanged.
- Rewrote `apps/web/components/issue/GameSlot.tsx` as a `'use client'` Client Component that:
  1. Calls `validateEmbedCode(game.embedCode)` (Plan 07-02 pure function)
  2. When valid: renders `<iframe sandbox="allow-scripts" srcDoc={injectGameHead(embedCode)} ...>` — no escape token anywhere in the file
  3. When invalid: renders `<GameFallback />` AND fires a one-shot, useRef-guarded `useMutation(api.qaCorrections.insert)` Convex write with `{runId, sectionName:'game', severity:'error', accepted:false, agentId:'game-validator', axis:'hard-rule', reason:'Game validator rejected embedCode: <validator-reason>'}`
  4. When `game === null`: renders the `Game coming soon.` empty-state placeholder
- One-line edit to `apps/web/app/issue/[slug]/page.tsx`: `<GameSlot game={issue.game} runId={issue.runId ?? null} />` — Issue.runId was already `string|null` from Phase 2, no type change.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GameFallback.tsx (validation-failed display component)** — `7174e0a` (`feat(07-03): add GameFallback component for validator-rejected games`)
2. **Task 2: Rewrite GameSlot.tsx as a Client Component with validator + Convex wiring** — `5ab22da` (`feat(07-03): rewrite GameSlot as Client Component with validator + Convex wiring`)
3. **Task 3: Thread issue.runId from page.tsx into GameSlot via new runId prop** — `5105a2f` (`feat(07-03): thread issue.runId into GameSlot via new runId prop`)

## Verification

### Greppable Phase 7 Security Invariants

| Invariant | Command | Result |
| --- | --- | --- |
| Forbidden escape token NEVER in GameSlot.tsx | `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` | **0** ✓ |
| `sandbox="allow-scripts"` present | `grep -c 'sandbox="allow-scripts"' apps/web/components/issue/GameSlot.tsx` | **2** ✓ (1 JSX + 1 security comment using the literal — see Decision below) |
| `'use client'` on line 1 | `head -1 apps/web/components/issue/GameSlot.tsx` | **'use client'** ✓ |
| Convex insert call wired | `grep -c "api.qaCorrections.insert" apps/web/components/issue/GameSlot.tsx` | **1** ✓ |
| GameFallback rendered | `grep -c "GameFallback" apps/web/components/issue/GameSlot.tsx` | **3** ✓ (1 import + 2 JSX) |
| runId prop wired in page.tsx | `grep -c "runId={issue.runId" apps/web/app/issue/[slug]/page.tsx` | **1** ✓ |
| Old GameSlot call gone | `grep -c "<GameSlot game={issue.game} />" apps/web/app/issue/[slug]/page.tsx` | **0** ✓ |

### Typecheck

```
$ pnpm --filter web typecheck
> web@0.0.0 typecheck /Users/user/Desktop/Eisenbalm/apps/web
> tsc --noEmit
[exit 0]
```

### Unit Tests (no regressions in Plan 07-02 coverage)

```
$ pnpm --filter web test:unit
 ↓ __tests__/game-sandbox.test.ts (1 test | 1 skipped)   # owned by Plan 07-04
 ✓ __tests__/game-validator.test.ts (24 tests) 10ms

 Test Files  1 passed | 1 skipped (2)
      Tests  24 passed | 1 todo (25)
```

All 24 game-validator assertions still green. The 1 todo in `game-sandbox.test.ts` is the Plan 07-04 anchor.

## Convex Mutation Arg Shape (verbatim)

```ts
insertQaCorrection({
  runId,                                                       // string (skipped when null)
  sectionName: 'game',
  reason: `Game validator rejected embedCode: ${validation.reason}`,
  severity: 'error',
  accepted: false,
  agentId: 'game-validator',
  axis: 'hard-rule',
})
```

Notes:
- `fieldName`, `original`, `corrected` (legacy Phase 4 args) — NOT passed
- `quotedSpan`, `suggestedFix` (Phase 5 optional args) — NOT passed (pattern match doesn't preserve position; no fix to suggest)
- The mutation returns a promise; `.catch((err) => console.error(...))` swallows failures so a transient Convex outage cannot break the page render. The fallback UI is already on screen by the time the mutation fires.

## useRef Guard Placement (one-shot semantics)

The guard set order is:

```ts
if (!validation || validation.valid) return    // early return on success/no-game
if (reportedRef.current) return                 // early return on re-render after first fire
if (!runId) return                              // skip write when issue has no pipeline run
reportedRef.current = true                      // set ref BEFORE await/catch
insertQaCorrection({...}).catch(...)            // fire-and-forget
```

`reportedRef.current = true` is set on the **synchronous** path before the mutation promise resolves or rejects. This means:

- React Strict Mode double-invocation in dev: ref is `true` by the time the second invocation runs → second invocation early-returns at line 2 → no double-fire.
- Production single-render: ref is `true` after first commit → subsequent re-renders (e.g. from parent state changes) early-return → no double-fire.
- Failed Convex write: `.catch` logs but does NOT reset `reportedRef.current` → the fallback UI is still on-screen, and Andrew has the console log to investigate. We deliberately accept "fire-once-then-give-up" semantics over "fire-until-success" to avoid retry storms on persistent Convex outages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] Sandbox security comments rewrote to avoid the literal forbidden token string**

- **Found during:** Task 2 verification
- **Issue:** The plan's action block embedded the literal forbidden token string TWICE in security comments inside `GameSlot.tsx` ("NEVER add allow-same-origin to this attribute", "sandbox MUST NEVER contain allow-same-origin"). But Plan 07-04's source-scan test will fail the build if that exact literal appears anywhere in `GameSlot.tsx` — comments included (it scans the raw file contents, not the parsed AST). The plan's own acceptance criterion `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` returns 0 confirms this contract.
- **Fix:** Rewrote the docstring and inline security comment to use indirect phrasing ("the same-origin escape token", "forbidden escape token", "forbidden token literal"). The substantive security contract is unchanged; only the comment wording changed. Final grep count: **0** for the forbidden literal.
- **Files modified:** `apps/web/components/issue/GameSlot.tsx`
- **Verification:** `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` returns **0**
- **Why Rule 2:** Without this fix, the file would NOT pass Plan 07-04's source-scan tripwire — failing GAM-03 enforcement at the build level. The plan's action block contradicted its own acceptance criterion. Rule 2 (security-critical missing functionality) applies because passing the source-scan is the renderer-level GAM-03 enforcement.

**2. [Rule 3 — Plan-vs-itself acceptance criterion edge case] GameFallback.tsx contains "Game unavailable." 2x not 1x**

- **Found during:** Task 1 verification
- **Issue:** The plan's action block explicitly includes a docstring that says `Copy is locked to "Game unavailable."` (the locked-copy contract documented in prose), AND the JSX renders the same literal. So `grep -F "Game unavailable." apps/web/components/issue/GameFallback.tsx` returns 2, but the plan's acceptance criterion says "returns exactly 1 match".
- **Fix:** Kept the file content exactly as the plan's action block prescribes — the docstring quoting the locked copy is intentional (it documents the contract for future readers) and the JSX is the actual rendered output. The plan's action block is more specific than the acceptance criterion, and the spirit of the criterion (locked Jesse-voice copy must appear in the rendered output, no apology, no exclamation) is preserved exactly: 0 matches for "Game unavailable!", 0 for "sorry", 0 for "please try".
- **Files modified:** None (no fix applied — plan-vs-itself inconsistency, not a code bug)
- **Verification:** `grep -c "Game unavailable!" apps/web/components/issue/GameFallback.tsx` = 0; `grep -c "sorry" ...` = 0; `grep -c "please try" ...` = 0; JSX renders the literal copy as locked.

**3. [Rule 1 — Documentation clarity] `'use client'` placed on line 1, ABOVE the docstring**

- **Found during:** Task 2 first verification pass
- **Issue:** The plan's action block put the docstring (lines 1–22) BEFORE `'use client'` (line 23). But the plan's acceptance criterion says `head -1 apps/web/components/issue/GameSlot.tsx returns a line containing 'use client'`, and Next.js requires the `'use client'` directive to be the FIRST line in the file (before any imports, comments, or code) for the boundary to be recognized.
- **Fix:** Rewrote the file with `'use client'` on line 1, blank line on line 2, then the docstring starting on line 3. This satisfies both Next.js's requirement and the plan's acceptance criterion.
- **Files modified:** `apps/web/components/issue/GameSlot.tsx`
- **Verification:** `head -1` returns `'use client'`; typecheck still exits 0.

---

**Total deviations:** 3 (2 inline fixes + 1 documented plan-vs-itself inconsistency)
**Impact on plan:** No scope creep. Two fixes are textbook Rule 1/2/3 inline corrections; one is a documented acceptance-criterion edge case where the plan's action block and acceptance criterion are mutually inconsistent — kept the action block content per plan precedence rules.

## Issues Encountered

- IDE diagnostics emitted `suggestCanonicalClasses` warnings (10+) for arbitrary Tailwind classes like `max-w-[860px]`, `h-[280px]`, `text-[color:var(--color-text)]`. These are NON-blocking warnings, and the plan's acceptance criteria explicitly require these arbitrary-value classes byte-for-byte (Phase 2 design-token contract). Other issue components (BonusSection, EditorialSection, etc.) emit the same warnings — it's a project-wide stylistic choice, not a per-file issue. Ignored.

## User Setup Required

None. All work was code-only.

## Note for Plan 07-04 (source-scan tripwire)

`apps/web/components/issue/GameSlot.tsx` is now in its **Phase 7 final shape**. Plan 07-04 should:

1. Read the file in the test via `readFileSync(path.resolve(__dirname, '../components/issue/GameSlot.tsx'), 'utf8')`
2. Assert the literal forbidden escape token string is NOT present (`expect(source).not.toContain('allow-same-origin')`)
3. Assert `sandbox="allow-scripts"` IS present (`expect(source).toMatch(/sandbox=["']allow-scripts["']/)`)

The current file body has been audited:
- Forbidden literal count: **0** (the security comments use indirect phrasing — see Deviation 1)
- `sandbox="allow-scripts"` count: **2** (1 JSX attribute + 1 indirect security comment that names the only allowed token)

If Plan 07-04 chooses to scan for additional tokens (e.g. `allow-modals`, `allow-popups`), the current file is also clean of those.

## Test Pass Count

`pnpm --filter web test:unit` final state:

```
 ✓ __tests__/game-validator.test.ts (24 tests) 10ms
 ↓ __tests__/game-sandbox.test.ts (1 test | 1 skipped)

 Test Files  1 passed | 1 skipped (2)
      Tests  24 passed | 1 todo (25)
```

No new tests added in this plan (per coordination — Plan 07-04 owns the GameSlot source-scan test, not this plan). All Plan 07-02 assertions still green.

## Next Phase Readiness

- **Plan 07-04 (source-scan tripwire) unblocked:** `GameSlot.tsx` is in final shape with `allow-same-origin` count = 0 and `sandbox="allow-scripts"` count ≥ 1. The Vitest `readFileSync`-based source-scan can land its assertion against this file directly.
- **Plan 07-05 (README + smoke):** Andrew's smoke test can now load a published issue, paste a valid game `embedCode`, and verify (a) the iframe renders, (b) banned constructs cause the fallback + a Convex `qaCorrections` row, (c) `game === null` renders "Game coming soon.".
- **Phase 9 (deliberation layer):** When implemented, `agentId='game-validator'` rows with `axis='hard-rule'` + `severity='error'` will surface in the live deliberation UI on the issue page. The Convex row shape is locked by this plan.
- **No blockers:** typecheck clean, all 24 unit tests pass, no `it.todo` regression in `game-validator.test.ts`, security invariants satisfied.

## Self-Check: PASSED

- File exists: `apps/web/components/issue/GameFallback.tsx` — FOUND
- File modified: `apps/web/components/issue/GameSlot.tsx` — FOUND
- File modified: `apps/web/app/issue/[slug]/page.tsx` — FOUND
- Commit exists: `7174e0a` — FOUND (`feat(07-03): add GameFallback component for validator-rejected games`)
- Commit exists: `5ab22da` — FOUND (`feat(07-03): rewrite GameSlot as Client Component with validator + Convex wiring`)
- Commit exists: `5105a2f` — FOUND (`feat(07-03): thread issue.runId into GameSlot via new runId prop`)
- `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` returns **0** ✓
- `grep -c 'sandbox="allow-scripts"' apps/web/components/issue/GameSlot.tsx` returns **2** ✓ (≥1 required)
- `pnpm --filter web typecheck` exits **0** ✓
- `pnpm --filter web test:unit` exits **0** ✓ (24 passed, 1 todo unchanged)

---
*Phase: 07-game-rendering*
*Completed: 2026-05-19*
