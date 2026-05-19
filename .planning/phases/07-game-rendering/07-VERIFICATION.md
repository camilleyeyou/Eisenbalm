---
phase: 07-game-rendering
verified: 2026-05-19T01:38:00Z
status: human_needed
score: 6/6 must-haves verified (automated); 2/6 GAM-* requirements require Andrew's manual smoke (GAM-05, GAM-06)
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "GAM-06 — 360px mobile rendering of an LLM-generated game"
    expected: |
      At Chrome DevTools viewport 360 x 640px on the latest published issue's
      /issue/[slug] page, the #game section shows the game iframe with NO
      horizontal scrollbar; game content stays within the rounded container
      (h-[280px] mobile / sm:h-[360px] desktop); "THE GAME" label, headline,
      and description are readable without horizontal scroll.
    why_human: |
      Requires a real browser at a real viewport against a real published
      issue. Vitest cannot evaluate visual layout, real font metrics, or
      the rendered output of LLM-generated HTML inside the iframe. The
      Vitest unit suite (GAM-06 substrate) only proves that injectGameHead
      prepends `overflow-x: hidden`, `max-width: 100%`, and the viewport
      meta — not that the final rendered game stays within the box.
  - test: "GAM-05 — Validation failure → fallback UI + Convex qaCorrections row"
    expected: |
      1. Andrew authors a fixture weeklyIssue draft in Sanity Studio with
         game.embedCode = `<script>document.cookie = "x";</script>` and
         publishes it. The issue's pipelineMetadata.runId must be set
         (manually or via a stub pipeline run).
      2. Opening /issue/<fixture-slug> shows "Game unavailable." (no iframe
         in the DOM; no console errors).
      3. The Convex qaCorrections table has a new row with:
         - runId = matching fixture runId
         - sectionName = 'game'
         - severity = 'error'
         - agentId = 'game-validator'
         - axis = 'hard-rule'
         - accepted = false
         - reason contains "Forbidden construct: cookie access (document.cookie)"
      4. Refreshing the page does NOT create a second row in production
         (Strict Mode off); dev mode may show 2 rows due to Strict Mode
         double-invocation, which is acceptable.
      5. Fixture issue is deleted or set to status='draft' afterwards.
    why_human: |
      Requires Sanity Studio access to author a fixture, a real Convex
      deployment to receive the mutation, and inspection of the Convex
      dashboard for the qaCorrections row. The useEffect-driven Convex
      write fires only in a real browser with the React tree mounted and
      the ConvexClientProvider active. The Vitest source-scan and the
      Convex schema unit shape can be verified statically, but the
      end-to-end mutation flow cannot.
---

# Phase 7: Game Rendering Verification Report

**Phase Goal (ROADMAP §Phase 7):** GameWriter output renders inside a correctly-sandboxed iframe with no `allow-same-origin`; an automated validator rejects any unsafe HTML/JS patterns before the output reaches a reader; a CSP meta tag is injected into the srcdoc; the game is mobile-responsive; a fallback "Game unavailable" placeholder appears when validation fails and Andrew is notified via Convex.

**Verified:** 2026-05-19T01:38:00Z
**Status:** human_needed (4/6 GAM-* automated and green; 2/6 deferred to Andrew's manual smoke per Plan 07-05)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | An iframe rendering GameWriter output on any issue page uses exactly `sandbox="allow-scripts"` (never `allow-same-origin`); a codebase-level ESLint rule or test fails if `allow-same-origin` appears anywhere in the game rendering component | VERIFIED | `apps/web/components/issue/GameSlot.tsx:135` uses `sandbox="allow-scripts"`; `grep -c "allow-same-origin"` returns 0 on that file; `apps/web/__tests__/game-sandbox.test.ts` source-scan tripwire passing (3 tests) |
| 2 | The automated validator rejects embedCode containing any of: `window.parent`, `top.`, `parent.`, `fetch(`, `XMLHttpRequest`, `document.cookie`, `document.domain`, external `<script src=...>`, external `<link href=...>` | VERIFIED | `apps/web/lib/game-validator.ts` `BANNED_PATTERNS` has 13 entries covering all required patterns + 3 GAM-02 extras (`top.`, `parent.`, `document.domain`); `apps/web/__tests__/game-validator.test.ts` has 13 per-pattern rejection tests, all passing |
| 3 | A CSP `<meta>` tag restricting external resources is injected into every srcdoc | VERIFIED | `injectGameHead` prepends `<meta http-equiv="Content-Security-Policy">` with 9-directive `GAME_CSP_POLICY` (default-src 'none', connect-src 'none', etc.); unit tests assert all 9 directives literally |
| 4 | A game produced by GameWriter renders correctly at 360px viewport width without horizontal scroll or broken layout | UNCERTAIN | Substrate verified: viewport meta + `overflow-x: hidden` + `max-width: 100%` injected by `injectGameHead` (unit-tested); GameSlot container preserves Phase 2 `h-[280px] w-full overflow-hidden sm:h-[360px]`. Visual confirmation at real 360px viewport requires Andrew's manual smoke (Plan 07-05 deferred to HUMAN-UAT). |
| 5 | When the validator rejects a game, the issue page shows "Game unavailable" and a `qaCorrections` entry is written to Convex with the rejection reason | UNCERTAIN | Static evidence verified: `GameFallback.tsx` renders literal "Game unavailable."; GameSlot.tsx fires `api.qaCorrections.insert` with `sectionName='game'`, `severity='error'`, `agentId='game-validator'`, `axis='hard-rule'`, `accepted=false`, `reason="Game validator rejected embedCode: ${reason}"`, guarded by `useRef`. Convex mutation signature in `convex/qaCorrections.ts:15-47` accepts all passed args. End-to-end browser+Convex confirmation requires Andrew's manual smoke (Plan 07-05 deferred to HUMAN-UAT). |

**Score:** 3/5 truths fully VERIFIED via automation; 2/5 UNCERTAIN pending manual smoke. No truths FAILED.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/web/lib/game-validator.ts` | Exports validateEmbedCode, injectGameHead, BANNED_PATTERNS, GAME_CSP_POLICY; 80+ lines | VERIFIED | 132 lines; all 4 symbols exported; 13 BANNED_PATTERNS entries; 9-directive CSP policy; viewport+CSS reset injected |
| `apps/web/components/issue/GameSlot.tsx` | Client Component, calls validator, sandbox="allow-scripts" only (NO allow-same-origin); 80+ lines | VERIFIED | 158 lines; `'use client'` on line 1; imports `validateEmbedCode` + `injectGameHead` from `@/lib/game-validator`, `useMutation` + `api.qaCorrections.insert` from `convex/react` + `@convex/_generated/api`, `GameFallback`; sandbox token = exactly `"allow-scripts"`; zero occurrences of forbidden same-origin token; useRef-guarded one-shot Convex write on validation failure with runId-null skip |
| `apps/web/components/issue/GameFallback.tsx` | Exists; renders "Game unavailable." | VERIFIED | 23 lines; pure display component; literal copy `Game unavailable.` (period, no exclamation, no apology); typography mirrors Phase 2 placeholder |
| `apps/web/app/issue/[slug]/page.tsx` | Threads issue.runId into `<GameSlot runId={...} />` | VERIFIED | Line 225: `<GameSlot game={issue.game} runId={issue.runId ?? null} />`; runId is already typed as `string \| null` on the Issue type; GROQ query projects `"runId": pipelineMetadata.runId` (queries.ts:26) |
| `apps/web/__tests__/game-validator.test.ts` | 24 passing assertions | VERIFIED | 24 tests, all passing (Vitest output confirms `__tests__/game-validator.test.ts (24 tests) 10ms`) |
| `apps/web/__tests__/game-sandbox.test.ts` | 3 passing assertions (GAM-03 source-scan tripwire) | VERIFIED | 3 tests, all passing; uses `readFileSync` against `../components/issue/GameSlot.tsx`; both negative (`not.toContain('allow-same-origin')`) and positive (`toContain('sandbox="allow-scripts"')`) assertions present |
| `apps/web/vitest.config.ts` | Exists with vite-tsconfig-paths | VERIFIED | 12 lines; `tsconfigPaths()` plugin; environment: 'node'; globals: false; include patterns match `__tests__/**/*.test.ts(x)` |
| `apps/web/package.json` (test:unit script) | Has `test:unit` script and three new devDeps | VERIFIED | `"test:unit": "vitest run"`; devDependencies include `vitest@^3.2.0`, `@vitest/ui@^3.2.0`, `vite-tsconfig-paths@^5.1.0` |
| `apps/web/README.md` Phase 7 section | Phase 7 doc section with validator, CSP, sandbox, tripwire, smoke runbook | VERIFIED | `## Phase 7 — Game Rendering` heading present (1 match); `allow-same-origin` (7), `FORBIDDEN_CONSTRUCTS` (2), `Game unavailable.` (5), `360` (4), `qaCorrections` (4+), smoke runbook documented verbatim |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `apps/web/components/issue/GameSlot.tsx` | `apps/web/lib/game-validator.ts` | `import { injectGameHead, validateEmbedCode } from '@/lib/game-validator'` | WIRED | Import present (line 38); both symbols invoked in render (lines 51, 56) |
| `apps/web/components/issue/GameSlot.tsx` | `convex/qaCorrections.ts` (insert mutation) | `useMutation(api.qaCorrections.insert)` via `@convex/_generated/api` alias | WIRED | Hook bound on line 46; call shape matches mutation's args schema (runId, agentId, sectionName, reason, severity, accepted, axis) |
| `apps/web/components/issue/GameSlot.tsx` | `apps/web/components/issue/GameFallback.tsx` | `import { GameFallback } from '@/components/issue/GameFallback'` + JSX `<GameFallback />` | WIRED | Import on line 37; renders on line 143 when `game?.embedCode` is present and `srcdoc` is null (validation failure branch) |
| `apps/web/app/issue/[slug]/page.tsx` | `apps/web/components/issue/GameSlot.tsx` | Props: `game={issue.game} runId={issue.runId ?? null}` | WIRED | Single call site at line 225; both props passed; matches GameSlot's `{game: IssueGame, runId: string \| null}` interface |
| GROQ projection (`queries.ts:26`) | Issue.runId on Sanity client | `"runId": pipelineMetadata.runId` | WIRED | Projection returns string or null depending on whether the issue has a pipelineMetadata document |
| Root layout (`apps/web/app/layout.tsx`) | ConvexClientProvider mount | `<ConvexClientProvider>{children}</ConvexClientProvider>` | WIRED | Provider wraps children at line 109-117; useMutation in GameSlot resolves through this context |
| `apps/web/__tests__/game-sandbox.test.ts` | `apps/web/components/issue/GameSlot.tsx` | `readFileSync` at test runtime | WIRED | Test reads the actual file from disk; both negative + positive assertions exercise the current file state |
| `apps/web/__tests__/game-validator.test.ts` | `apps/web/lib/game-validator.ts` | `import { BANNED_PATTERNS, GAME_CSP_POLICY, injectGameHead, validateEmbedCode } from '@/lib/game-validator'` | WIRED | All four symbols imported and exercised; vite-tsconfig-paths resolves `@/*` alias correctly (24 tests pass) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| GameSlot.tsx | `game` (IssueGame prop) | `issue.game` from page.tsx → GROQ projection in Sanity client | YES — real Sanity data when present, `null` for issues without a game block | FLOWING |
| GameSlot.tsx | `runId` prop | `issue.runId ?? null` from page.tsx → `pipelineMetadata.runId` in GROQ projection | YES — real string from Sanity when pipelineMetadata exists, `null` otherwise (gracefully handled — skip Convex write) | FLOWING |
| GameSlot.tsx | `validation` (local) | `validateEmbedCode(game.embedCode)` (pure function) | YES — derived from real Sanity embedCode | FLOWING |
| GameSlot.tsx | `srcdoc` (local) | `injectGameHead(game.embedCode)` (pure function) when valid | YES — derived from real embedCode + injected CSP/viewport/CSS reset | FLOWING |
| GameSlot.tsx → Convex | qaCorrections row | `useMutation(api.qaCorrections.insert)` triggered in useEffect on validation failure | UNCERTAIN at end-to-end — static mutation shape verified against Convex schema, but real Convex insert observation deferred to GAM-05 manual smoke | STATIC (verified via Convex schema match; live confirmation pending) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Vitest test:unit suite passes | `pnpm --filter web test:unit` | `Test Files 2 passed (2); Tests 27 passed (27); Duration 734ms` | PASS |
| TypeScript clean (no errors in apps/web) | `pnpm --filter web typecheck` | Exit 0; no output | PASS |
| GameSlot.tsx contains no forbidden sandbox token | `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` | 0 | PASS |
| GameSlot.tsx uses positive sandbox contract | `grep -c "allow-scripts" apps/web/components/issue/GameSlot.tsx` | 4 (1 attribute + 3 references in comments) | PASS |
| BANNED_PATTERNS list has 13 entries (10 mirrored + 3 GAM-02 extras) | Tested via `expect(BANNED_PATTERNS).toHaveLength(BANNED_SAMPLES.length)` in test suite | Sample list = 13 entries; assertion green | PASS |
| Python deny-list source exists at expected path | `grep "FORBIDDEN_CONSTRUCTS" packages/pipeline/src/eisenbalm_pipeline/agents/game.py` | 3 matches (declaration + 2 references) | PASS |

### Requirements Coverage

All six GAM-* requirement IDs are declared across Plans 07-02, 07-03, 07-04, 07-05 and traceable back to REQUIREMENTS.md.

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| GAM-01 | 07-03 | Iframe renders with `sandbox="allow-scripts"` (NEVER `allow-same-origin`) | SATISFIED | GameSlot.tsx:135 uses exactly `sandbox="allow-scripts"`; source-scan tripwire (Plan 07-04) enforces it; 0 occurrences of forbidden token |
| GAM-02 | 07-02 | Automated validator rejects 10+ banned patterns | SATISFIED | `validateEmbedCode` + 13-entry `BANNED_PATTERNS` cover all 9 patterns named in REQUIREMENTS.md plus 4 implementation-derived defenses; 13 per-pattern unit tests passing |
| GAM-03 | 07-04 | Codebase-level rule prevents `allow-same-origin` | SATISFIED | `__tests__/game-sandbox.test.ts` reads GameSlot.tsx at test runtime; both `not.toContain('allow-same-origin')` and `toContain('sandbox="allow-scripts"')` assertions are green; tripwire fails the build if either invariant breaks (ESLint substitute) |
| GAM-04 | 07-02 | CSP `<meta>` tag injected into srcdoc | SATISFIED | `injectGameHead` prepends `<meta http-equiv="Content-Security-Policy" content="...">` with 9-directive policy; unit tests assert each directive literally including `default-src 'none'`, `connect-src 'none'`, `script-src 'unsafe-inline'` |
| GAM-05 | 07-03 (impl) + 07-05 (smoke) | Validation failure → "Game unavailable" + Convex notification | NEEDS HUMAN | Implementation verified statically: `GameFallback` renders correct copy; GameSlot fires `qaCorrections.insert` with correct shape (sectionName='game', severity='error', agentId='game-validator', axis='hard-rule', accepted=false, reason prefixed); useRef-guarded; runId-null skip path present. End-to-end verification of the Convex row creation requires Andrew's manual smoke against a fixture issue + the live Convex dashboard (Plan 07-05 Task 2 deferred to HUMAN-UAT). |
| GAM-06 | 07-02 (substrate) + 07-05 (smoke) | Game iframe responsive ≥360px | NEEDS HUMAN | Substrate verified via unit tests: viewport meta + `overflow-x: hidden` + `max-width: 100%` + canvas/svg/img sizing injected by `injectGameHead`; GameSlot container preserves `overflow-hidden h-[280px] sm:h-[360px]`. Visual confirmation at real 360px viewport against an LLM-generated game requires Andrew's manual smoke (Plan 07-05 Task 2 deferred to HUMAN-UAT). |

No orphaned requirements detected — every GAM-* mapped to a Phase 7 plan and accounted for in the table above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (none) | — | — | — | No blocker, warning, or info-level anti-patterns detected in Phase 7 artifacts. Files use real implementations, no TODO/FIXME, no placeholder returns, no hardcoded empty arrays in user-facing render paths. The GameFallback is a deliberate fallback (not a stub) and the no-game `Game coming soon.` branch is the Phase 2-defined empty state. |

### Human Verification Required

Two GAM-* requirements depend on infrastructure that cannot be exercised in CI:

#### 1. GAM-06 — 360px mobile rendering (visual)

**Test:** With the dev server running (`pnpm --filter web dev`) or against the deployed Vercel URL, open the latest published issue's `/issue/<slug>` page. In Chrome (or Safari) DevTools, set viewport to 360 × 640 px (iPhone SE preset). Scroll to the `#game` section.
**Expected:**
- The iframe container shows the rendered game with no horizontal scrollbar.
- Game content stays inside the rounded `h-[280px]` container (or `sm:h-[360px]` if the breakpoint elevates).
- The "THE GAME" label, headline, and description above the iframe are readable without horizontal scroll.
**Why human:** Visual layout, real font metrics, and the rendered output of LLM-generated HTML cannot be evaluated programmatically. The unit suite proves the CSS reset is injected, not that the resulting render is correct.

#### 2. GAM-05 — Fallback UI + Convex qaCorrections row

**Test:** In Sanity Studio, create a fixture `weeklyIssue` draft titled "Phase 7 fixture — DELETE AFTER SMOKE". Set minimal required fields; in the `game` object set `embedCode: '<script>document.cookie = "x";</script>'`. Ensure `pipelineMetadata.runId` is set (manually or via a stub pipeline run). Publish. Open `/issue/<fixture-slug>` in a browser.
**Expected:**
1. The page renders "Game unavailable." in the `#game` section (no `<iframe>` element in the DOM); no JavaScript console errors.
2. The Convex dashboard `qaCorrections` table shows a new row with: `runId` matching the fixture, `sectionName='game'`, `severity='error'`, `agentId='game-validator'`, `axis='hard-rule'`, `accepted=false`, and `reason` containing "Forbidden construct: cookie access (document.cookie)".
3. Refreshing the page does NOT create a second row in production (Strict Mode off); dev mode may show 2 rows under Strict Mode (acceptable).
4. Cleanup: fixture issue is deleted or set to status='draft' afterwards.
**Why human:** Requires Sanity Studio access (create fixture), live Convex deployment (receive mutation), and Convex dashboard inspection. The useEffect-driven write fires only in a real browser with the React tree mounted and the ConvexClientProvider active.

### Gaps Summary

No gaps blocking the goal. All six GAM-* requirements are accounted for: GAM-01, GAM-02, GAM-03, GAM-04 are fully covered by automated tests (27/27 Vitest assertions green); GAM-05 and GAM-06 have their substrate fully implemented and unit-tested, with the end-to-end visual and Convex-dashboard observations explicitly deferred to Andrew per Plan 07-05's deferred-to-HUMAN-UAT design decision. The phase verifier status is `human_needed` rather than `passed` to surface those two manual smoke items.

Once Andrew runs the two smoke tests documented in `apps/web/README.md` § "Andrew's manual smoke test" and confirms the expected outcomes, Phase 7 closes cleanly with zero outstanding work.

---

_Verified: 2026-05-19T01:38:00Z_
_Verifier: Claude (gsd-verifier)_
