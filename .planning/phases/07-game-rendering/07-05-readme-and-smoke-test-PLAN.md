---
phase: 07-game-rendering
plan: 05
type: execute
wave: 4
depends_on:
  - "07-02"
  - "07-03"
  - "07-04"
files_modified:
  - apps/web/README.md
autonomous: false
requirements:
  - GAM-05
  - GAM-06
must_haves:
  truths:
    - "apps/web/README.md contains a '## Phase 7 — Game Rendering' section that documents the validator deny-list, the CSP policy, the fallback contract, and the GAM-03 source-scan tripwire"
    - "The README explicitly states: 'NEVER add allow-same-origin to the iframe sandbox attribute in GameSlot.tsx — the GAM-03 test will fail the build'"
    - "The README documents Andrew's manual smoke test for GAM-05 (Convex dashboard check) and GAM-06 (360px viewport) verbatim from 07-VALIDATION.md"
    - "Andrew runs the smoke test against the current published issue (issue 999 from Phase 5) and confirms (a) no horizontal scroll at 360px, (b) iframe shows the game (validator passed), and (c) records the result in the SUMMARY"
    - "If Andrew authors a deliberately-broken fixture issue (embedCode containing document.cookie), he confirms (a) the GameFallback 'Game unavailable.' copy renders, AND (b) a row appears in Convex qaCorrections with sectionName='game', severity='error', agentId='game-validator'"
  artifacts:
    - path: "apps/web/README.md"
      provides: "Phase 7 onboarding section: validator contract, CSP policy reference, fallback behavior, smoke test runbook"
      contains: "Phase 7"
      min_lines: 40
  key_links:
    - from: "apps/web/README.md"
      to: "apps/web/lib/game-validator.ts"
      via: "README references the canonical deny-list source by file path"
      pattern: "lib/game-validator\\.ts"
    - from: "apps/web/README.md"
      to: "packages/pipeline/src/eisenbalm_pipeline/agents/game.py"
      via: "README cross-references the Python FORBIDDEN_CONSTRUCTS that the frontend mirrors"
      pattern: "FORBIDDEN_CONSTRUCTS"
---

<objective>
Document Phase 7 in `apps/web/README.md` and execute Andrew's manual smoke test for the two requirements that cannot be fully automated (GAM-05 Convex write + GAM-06 mobile rendering). The README addition is the canonical onboarding doc for future engineers (and Claude in future sessions) — it explains the validator architecture, the CSP policy, the locked sandbox contract, and the smoke runbook.

Purpose: Phase 7 has automated coverage for GAM-01, GAM-02, GAM-03, GAM-04 via Vitest (Plans 07-02 + 07-04). GAM-05 (Convex write on validation failure) and GAM-06 (mobile rendering of LLM-generated game HTML) require a real browser + real Convex deployment + a real issue. The smoke test is the closing gate; the README captures the runbook so Andrew (or any future operator) can re-run it after future GameSlot edits.

Output: Updated `apps/web/README.md` with a Phase 7 section + Andrew's smoke test results captured in the SUMMARY.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/07-game-rendering/07-RESEARCH.md
@.planning/phases/07-game-rendering/07-VALIDATION.md

@apps/web/README.md
@apps/web/lib/game-validator.ts
@apps/web/components/issue/GameSlot.tsx
@apps/web/components/issue/GameFallback.tsx
@apps/web/__tests__/game-sandbox.test.ts
@apps/web/__tests__/game-validator.test.ts
@packages/pipeline/src/eisenbalm_pipeline/agents/game.py

<interfaces>
<!-- Phase 7 final artifact list (for the README to reference):
       apps/web/lib/game-validator.ts
         exports: validateEmbedCode, injectGameHead, BANNED_PATTERNS, GAME_CSP_POLICY
       apps/web/components/issue/GameSlot.tsx
         Client Component; sandbox="allow-scripts"; calls validateEmbedCode + injectGameHead;
         on failure renders GameFallback + fires qaCorrections.insert
       apps/web/components/issue/GameFallback.tsx
         pure display; copy: "Game unavailable."
       apps/web/__tests__/game-validator.test.ts
         Vitest unit suite: every banned pattern + every CSP directive
       apps/web/__tests__/game-sandbox.test.ts
         Vitest source-scan: no allow-same-origin in GameSlot.tsx; positive sandbox="allow-scripts" assertion

     Cross-package reference: packages/pipeline/src/eisenbalm_pipeline/agents/game.py
       contains FORBIDDEN_CONSTRUCTS — the Python source of truth that
       apps/web/lib/game-validator.ts mirrors. The README must call out
       that edits to either list MUST be mirrored in the other. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add a "Phase 7 — Game Rendering" section to apps/web/README.md</name>
  <read_first>
    - apps/web/README.md (current contents — must not clobber prior phase sections; locate the right insertion point)
    - .planning/phases/07-game-rendering/07-VALIDATION.md (Manual-Only Verifications table — used verbatim in the smoke runbook)
    - apps/web/lib/game-validator.ts (confirms exact symbol names exported)
    - apps/web/__tests__/game-validator.test.ts (confirms test commands)
    - apps/web/__tests__/game-sandbox.test.ts (confirms test commands)
  </read_first>
  <files>apps/web/README.md (additive section)</files>
  <action>
    Open `apps/web/README.md` and append a new `## Phase 7 — Game Rendering` section at the END of the file (after all existing Phase content). Do NOT remove or restructure existing sections — Phase 7 is additive.

    Use this exact markdown content (you may adjust internal heading levels +1/-1 to match the file's existing heading conventions; the content body MUST be verbatim):

    ```markdown
    ## Phase 7 — Game Rendering

    Phase 7 wires the iframe game with security validation, CSP injection,
    a "Game unavailable." fallback, and a Convex notification path for Andrew.

    ### Architecture

    | File | Role |
    |------|------|
    | `apps/web/lib/game-validator.ts` | Pure validator + CSP/head injector (no React, no Convex) |
    | `apps/web/components/issue/GameSlot.tsx` | Client Component: validates embedCode, renders iframe or fallback, fires Convex write on failure |
    | `apps/web/components/issue/GameFallback.tsx` | Pure display: "Game unavailable." |
    | `apps/web/__tests__/game-validator.test.ts` | Unit tests: every banned pattern + every CSP directive (GAM-02, GAM-04) |
    | `apps/web/__tests__/game-sandbox.test.ts` | Source-scan tripwire: fails if `allow-same-origin` appears in GameSlot.tsx (GAM-03) |

    ### Security contract (LOCKED)

    The iframe MUST use exactly `sandbox="allow-scripts"`. It must NEVER
    contain `allow-same-origin` — that combination defeats the sandbox
    (the sandboxed page can rewrite its own sandbox attribute via DOM
    manipulation). The Vitest test in `apps/web/__tests__/game-sandbox.test.ts`
    fails the build if `allow-same-origin` appears anywhere in
    `apps/web/components/issue/GameSlot.tsx` (including comments). DO NOT
    weaken or delete that test.

    ### Validator deny-list (mirrors Python FORBIDDEN_CONSTRUCTS)

    The frontend deny-list in `apps/web/lib/game-validator.ts`
    (`BANNED_PATTERNS`) mirrors the Python `FORBIDDEN_CONSTRUCTS` constant
    in `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`. Edits to
    either list MUST be mirrored in the other (the frontend cannot import
    from the Python package). Current entries (13):

    - `window.parent`, `window.top`, `top.`, `parent.` — parent/top frame access
    - `fetch(`, `XMLHttpRequest` — network requests
    - `document.cookie`, `document.domain` — same-origin policy probes
    - `localStorage` — storage access
    - `eval(`, `import(` — dynamic code execution
    - `<script src="...">`, `<link href="...">` — external resource references

    ### CSP policy

    Every game srcdoc has a `<meta http-equiv="Content-Security-Policy">`
    prepended by `injectGameHead`. The policy is exported as
    `GAME_CSP_POLICY` in `apps/web/lib/game-validator.ts`:

    ```
    default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
    img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none';
    base-uri 'none'; form-action 'none'
    ```

    The `connect-src 'none'` directive is the enforcement backstop against
    `fetch()` / `XHR` / `WebSocket` calls that obfuscation might slip past
    the string-match validator.

    ### Mobile responsiveness (GAM-06)

    `injectGameHead` also prepends:

    - `<meta name="viewport" content="width=device-width, initial-scale=1">`
    - A CSS reset that sets `box-sizing: border-box` on `*`, `overflow-x: hidden`
      + `max-width: 100%` on `html, body`, and `max-width: 100% !important;
      height: auto;` on `canvas, svg, img`.

    Combined with the iframe container's `overflow-hidden` (in `GameSlot.tsx`)
    and the fixed heights `h-[280px] sm:h-[360px]`, this prevents the game
    from breaking out of the 360px-wide viewport on mobile.

    ### Fallback contract (GAM-05)

    When `validateEmbedCode(game.embedCode)` returns `{valid: false}`:

    1. `<GameFallback />` renders with the literal copy `Game unavailable.`
       (period; no exclamation; no "we're sorry"). This is a voice contract
       — see `CLAUDE.md`.
    2. A `qaCorrections.insert` Convex mutation fires exactly once per
       component mount (guarded by `useRef`) with shape:
       ```
       {
         runId,                                       // from issue.runId
         sectionName: 'game',
         reason: `Game validator rejected embedCode: ${reason}`,
         severity: 'error',
         accepted: false,
         agentId: 'game-validator',
         axis: 'hard-rule',
       }
       ```
    3. If `runId` is `null` (issue authored manually in Sanity without a
       pipeline run), the Convex write is skipped — `runId` is `v.string()`
       in the schema; passing undefined throws. The fallback UI still renders.

    Andrew sees the row in the Phase 9 deliberation layer where
    `agentId='game-validator'` is color-coded by `severity='error'`.

    ### Running the tests

    ```bash
    pnpm --filter apps/web test:unit            # full Vitest suite, < 10s
    pnpm --filter apps/web test:unit game-validator   # validator + CSP tests only
    pnpm --filter apps/web test:unit game-sandbox     # source-scan tripwire only
    ```

    No watch mode in CI: the npm script uses `vitest run` (not bare `vitest`).

    ### Andrew's manual smoke test

    Two requirements need a real browser + real Convex deployment:

    **GAM-06 — 360px mobile rendering** (against the current published issue):

    1. Open the current published issue at `https://<vercel-domain>/issue/<latest-slug>`
       (or `http://localhost:3000/issue/<latest-slug>` in dev).
    2. In Chrome DevTools, set viewport to 360 x 640.
    3. Scroll to the `#game` section.
    4. Confirm:
       - The iframe container shows no horizontal scrollbar.
       - The game content is not clipped beyond the rounded container.
       - The "THE GAME" label + headline + description above the iframe
         are readable without horizontal scroll.

    **GAM-05 — Validation failure → Convex write + fallback UI**:

    1. In Sanity Studio, create a fixture `weeklyIssue` draft with a `game`
       object whose `embedCode` field contains the literal string
       `document.cookie` (e.g. `<script>document.cookie</script>`).
    2. Publish the draft (or set status to `published` if your Studio
       workflow requires it).
    3. Open the issue at `/issue/<fixture-slug>` in a browser.
    4. Confirm in the browser:
       - The game section shows `Game unavailable.` (NOT the iframe).
       - No JavaScript errors in the console.
    5. Confirm in the Convex dashboard (`qaCorrections` table):
       - A row exists with `sectionName='game'`, `severity='error'`,
         `agentId='game-validator'`, `accepted=false`.
       - The `reason` field contains "Game validator rejected embedCode:
         Forbidden construct: cookie access (document.cookie)".
       - The `runId` matches the issue's `pipelineMetadata.runId`.
    6. Refresh the page; confirm the React `useRef` guard prevents a second
       row from being written on re-render (the row count for this `runId`
       + `sectionName='game'` remains 1, OR 2 if React Strict Mode is on in
       dev — production has Strict Mode off so it stays at 1 per mount).

    After the smoke test passes, delete the fixture issue (or set its status
    back to draft) so it does not appear in production.

    ### What to do if a test fails

    - `game-validator.test.ts` red → the deny-list or CSP policy was edited
      without updating the test fixtures. Fix the test only if the edit was
      intentional and is mirrored in `packages/pipeline/.../game.py`.
    - `game-sandbox.test.ts` red on `allow-same-origin` → an edit
      reintroduced the forbidden token. Revert the edit; do NOT weaken
      the test.
    - `game-sandbox.test.ts` red on `sandbox="allow-scripts"` → the iframe
      was removed or the sandbox attribute was changed. Restore the
      contract.
    ```

    Notes for the executor:
    - Insert at the END of README.md (preserve every existing section).
    - The exact heading `## Phase 7 — Game Rendering` is required so the README index can be grepped.
    - Code blocks must use triple-backtick fences with explicit language hints (`bash`, no language for tables and free-form blocks) — match the rest of the README's conventions if it uses different fencing (e.g. some READMEs use four backticks for nested blocks). If in doubt, use triple.
    - Do NOT use emojis (CLAUDE.md voice rule).
    - Voice: dry, precise. "Game unavailable." has a period, not an exclamation. The README mirrors that tone — no "Awesome!", no "Pro tip:".
  </action>
  <verify>
    <automated>grep -c "## Phase 7 — Game Rendering" apps/web/README.md && grep -c "allow-same-origin" apps/web/README.md && grep -c "FORBIDDEN_CONSTRUCTS" apps/web/README.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## Phase 7 — Game Rendering" apps/web/README.md` returns exactly 1 (en-dash, not hyphen)
    - `grep -c "allow-same-origin" apps/web/README.md` returns at least 2 (the security warning + the test-failure runbook)
    - `grep -c "FORBIDDEN_CONSTRUCTS" apps/web/README.md` returns at least 1 (cross-reference to Python source)
    - `grep -c "game-validator.ts" apps/web/README.md` returns at least 2 (architecture table + deny-list reference)
    - `grep -c "Game unavailable\." apps/web/README.md` returns at least 1 (the locked fallback copy)
    - `grep -c "connect-src 'none'" apps/web/README.md` returns at least 1 (CSP backstop documented)
    - `grep -c "qaCorrections" apps/web/README.md` returns at least 2 (Convex write contract + smoke test)
    - `grep -c "agentId='game-validator'" apps/web/README.md` returns at least 1 (or `agentId: 'game-validator'` variant)
    - `grep -c "360" apps/web/README.md` returns at least 1 (GAM-06 mobile viewport)
    - `grep -c "useRef" apps/web/README.md` returns at least 1 (idempotency guard documented)
    - `grep -c "pnpm --filter apps/web test:unit" apps/web/README.md` returns at least 2 (test commands documented)
    - `grep -c "sandbox=\"allow-scripts\"" apps/web/README.md` returns at least 1 (positive sandbox contract)
    - No emojis in the new section (`grep -P "[\x{1F300}-\x{1F6FF}]" apps/web/README.md` returns no matches in the appended block — perl-regex check)
    - No exclamation marks in the Phase 7 section copy (`grep -A1 "Phase 7 — Game" apps/web/README.md | grep -c "!"` returns 0 in the body prose — code blocks may contain `!important` CSS which is fine)
    - Existing README sections (Phase 1-6) are preserved (`git diff apps/web/README.md` shows only additions, no deletions)
  </acceptance_criteria>
  <done>Phase 7 section added to README; voice and content match the contract; existing sections untouched.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew runs GAM-05 + GAM-06 manual smoke test</name>
  <read_first>
    - apps/web/README.md (the "Andrew's manual smoke test" section added in Task 1)
    - .planning/phases/07-game-rendering/07-VALIDATION.md (Manual-Only Verifications table)
  </read_first>
  <files>(none — read-only smoke test against running infrastructure; results captured in Task 3 SUMMARY)</files>
  <action>Execute the smoke runbook documented in apps/web/README.md "Andrew's manual smoke test" section (Part A GAM-06 mobile rendering + Part B GAM-05 validation failure path). See &lt;how-to-verify&gt; for the explicit step-by-step. This is a checkpoint:human-verify gate — the executor pauses and Andrew runs the steps manually against real browser + real Convex deployment + real Sanity issue. The pause resumes on the resume-signal.</action>
  <acceptance_criteria>
    - Part A (GAM-06): no horizontal scroll at 360px viewport in the #game section of the latest published issue
    - Part B (GAM-05): fixture issue with embedCode containing `document.cookie` renders the "Game unavailable." fallback (NOT the iframe)
    - Part B (GAM-05): if runId is non-null, a row appears in Convex qaCorrections with sectionName='game', severity='error', agentId='game-validator', axis='hard-rule', reason containing "cookie access (document.cookie)"
    - Part B cleanup: the fixture issue is either deleted or set to status='draft' so it does not leak into production
    - Andrew types "approved" (or "issues: ...") at the resume-signal
  </acceptance_criteria>
  <verify>
    <automated>MISSING — manual smoke test; the verify is the human resume signal; outcomes captured in 07-05 SUMMARY (Task 3)</automated>
  </verify>
  <done>Andrew confirms both GAM-05 (fallback + Convex write) and GAM-06 (no horizontal scroll at 360px) pass; fixture cleaned up; SUMMARY captures observations.</done>
  <what-built>
    Phase 7 ships:
    - `apps/web/lib/game-validator.ts` (validator + CSP/head injector)
    - `apps/web/components/issue/GameSlot.tsx` rewritten as Client Component with sandbox=allow-scripts only, validator-guarded render, useRef-guarded Convex write on failure
    - `apps/web/components/issue/GameFallback.tsx` ("Game unavailable.")
    - Vitest unit suite (validator + CSP) — green
    - Vitest source-scan tripwire (no allow-same-origin in GameSlot) — green
    - README Phase 7 section with full runbook
  </what-built>
  <how-to-verify>
    Run the runbook in `apps/web/README.md` -> "Andrew's manual smoke test" section. Concretely:

    **Part A — GAM-06 (mobile rendering of a real game)**:
    1. Start the dev server: `pnpm --filter apps/web dev` (or use the deployed Vercel URL).
    2. Open the latest published issue (the Phase 5 smoke test produced issue 999 — use that, or the most recent published issue if it has been replaced).
    3. In Chrome (or Safari) DevTools, set viewport to 360 x 640 px (iPhone SE preset is close enough).
    4. Scroll to the `#game` section.
    5. Confirm: the iframe container shows the rendered game with NO horizontal scrollbar visible. The game content stays within the rounded container.
    6. Capture: take a screenshot or note "PASS / FAIL: <reason>" for the SUMMARY.

    **Part B — GAM-05 (validation failure path)**:
    1. In Sanity Studio (`pnpm --filter apps/studio dev` if local; or sanity.studio domain), create a NEW `weeklyIssue` draft. Title it "Phase 7 fixture — DELETE AFTER SMOKE".
    2. Set the minimal required fields (issueNumber, charity ref, publishDate, slug). The exact charity does not matter — reuse an existing one.
    3. In the `game` object, set:
       - headline: "Smoke test"
       - description: "Fixture for Phase 7 validator smoke"
       - embedCode: `<script>document.cookie = "x";</script>`
    4. Publish (status='published') so the GROQ query returns it.
    5. Open `/issue/<fixture-slug>` in the browser.
    6. Confirm in the page:
       - The game section shows `Game unavailable.` (the GameFallback copy).
       - The iframe does NOT mount (inspect element: no `<iframe>` in the game section).
       - No console errors.
    7. Confirm in the Convex dashboard:
       - Open the Convex dashboard for the dev deployment (modest-magpie-797) or whatever deployment the running app points at.
       - Navigate to the `qaCorrections` table.
       - Filter by `runId` matching the fixture issue's `pipelineMetadata.runId` (or scan recent rows by timestamp).
       - Confirm a row exists with `sectionName='game'`, `severity='error'`, `agentId='game-validator'`, `accepted=false`, `axis='hard-rule'`, and `reason` containing "cookie access (document.cookie)".
       - If the fixture issue lacks a `pipelineMetadata.runId` (manually authored, never went through a pipeline run), the Convex write is correctly SKIPPED — verify no error in the browser console and verify the fallback UI still renders. Document this case in the SUMMARY.
    8. Clean up: in Sanity Studio, either delete the fixture draft OR set its status to `draft` so it does not appear in production. Document which.

    **Part C — Capture results in the SUMMARY**:
    Write the SUMMARY (Task 3 of Plan 07-05 — the output block at the bottom of this plan) with the actual observations:
    - GAM-06 PASS / FAIL with viewport screenshot description
    - GAM-05 Part B observations: fallback copy rendered? Convex row created? (and if runId was null, was the write correctly skipped?)
    - Fixture cleanup confirmation
  </how-to-verify>
  <resume-signal>Type "approved" if both smoke tests pass and the fixture is cleaned up. Type "issues: <description>" if any smoke step failed.</resume-signal>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Capture smoke results in the Plan 07-05 SUMMARY</name>
  <read_first>
    - .planning/phases/07-game-rendering/07-RESEARCH.md (for SUMMARY format reference — match prior phase SUMMARYs)
    - .planning/phases/06-pdf-generation-webhook-chain/06-08-readme-and-smoke-test-SUMMARY.md (if exists — closest prior precedent for a README + smoke plan SUMMARY)
  </read_first>
  <files>.planning/phases/07-game-rendering/07-05-readme-and-smoke-test-SUMMARY.md (new)</files>
  <action>
    Create `.planning/phases/07-game-rendering/07-05-readme-and-smoke-test-SUMMARY.md` after the smoke checkpoint resumes with "approved". The SUMMARY must document:

    1. README addition: line range or section title where Phase 7 section was added; word count or line count of the new section.
    2. GAM-06 smoke result: PASS or FAIL; description of what was observed at 360px viewport; which issue was tested (issue number + slug); browser used.
    3. GAM-05 Part B smoke result:
       - Did the fallback "Game unavailable." render? (YES/NO)
       - Did the Convex `qaCorrections` row get created? (YES/NO/SKIPPED-because-runId-null)
       - If created, paste the row's shape (sectionName, severity, agentId, axis, reason, runId).
       - Cleanup status: fixture deleted OR set to draft? Issue number/slug of the fixture for audit trail.
    4. Test suite status: paste output of final `pnpm --filter apps/web test:unit` showing all Phase 7 tests passing.
    5. Phase 7 closure checklist:
       - [ ] GAM-01 (sandbox=allow-scripts in GameSlot) — automated test ✓
       - [ ] GAM-02 (validator rejects 13 banned patterns) — automated test ✓
       - [ ] GAM-03 (source-scan tripwire) — automated test ✓
       - [ ] GAM-04 (CSP meta injected) — automated test ✓
       - [ ] GAM-05 (fallback + Convex write) — manual smoke ✓
       - [ ] GAM-06 (360px mobile) — manual smoke ✓
    6. Any open issues or follow-ups discovered during smoke (e.g. font weight regressions, console warnings, Convex row appearing twice in dev due to Strict Mode).
    7. Reminder: Phase 7 is COMPLETE when all 6 GAM-* requirements are checked. If any failed during smoke, open a gap-closure plan via `/gsd:plan-phase 7 --gaps` — do NOT mark the phase complete.

    The SUMMARY follows the same format as prior `*-SUMMARY.md` files in the .planning/phases/ tree.
  </action>
  <verify>
    <automated>test -f .planning/phases/07-game-rendering/07-05-readme-and-smoke-test-SUMMARY.md && grep -c "GAM-0" .planning/phases/07-game-rendering/07-05-readme-and-smoke-test-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/07-game-rendering/07-05-readme-and-smoke-test-SUMMARY.md` exists
    - File contains a "GAM-05" reference (manual smoke result)
    - File contains a "GAM-06" reference (manual smoke result)
    - File documents the test suite pass count (e.g. "X tests passed")
    - File documents whether the Sanity fixture was cleaned up
    - File contains a Phase 7 closure checklist with all 6 GAM-* items
  </acceptance_criteria>
  <done>SUMMARY captures README change + smoke observations + closure checklist; Phase 7 ready to close (or follow-up plan flagged if smoke failed).</done>
</task>

</tasks>

<verification>
- `apps/web/README.md` has a Phase 7 section that documents the validator, CSP, fallback contract, and smoke runbook
- Andrew's manual smoke test confirms GAM-05 + GAM-06 against either a real published issue or a deliberate fixture
- The Plan 07-05 SUMMARY captures all observations + the Phase 7 closure checklist
</verification>

<success_criteria>
- README documents the locked sandbox contract so future engineers don't accidentally add allow-same-origin
- README cross-references the Python FORBIDDEN_CONSTRUCTS so future deny-list edits stay synchronized
- Andrew's smoke captures the two requirements that cannot be automated (GAM-05 Convex side-effect, GAM-06 real-browser rendering)
- Phase 7 closure criteria are checkable: 4 automated + 2 manual = 6 GAM-* requirements covered
- The fixture issue used for GAM-05 smoke is cleaned up (no leaking smoke test data into production)
</success_criteria>

<output>
After completion, the file `.planning/phases/07-game-rendering/07-05-readme-and-smoke-test-SUMMARY.md` contains the smoke observations + Phase 7 closure checklist. Phase 7 is ready for `/gsd:verify-work` to close it (all GAM-* requirements satisfied).
</output>
</content>
</invoke>