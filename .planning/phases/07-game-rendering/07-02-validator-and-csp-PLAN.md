---
phase: 07-game-rendering
plan: 02
type: execute
wave: 1
depends_on:
  - "07-01"
files_modified:
  - apps/web/lib/game-validator.ts
  - apps/web/__tests__/game-validator.test.ts
autonomous: true
requirements:
  - GAM-02
  - GAM-04
  - GAM-06
must_haves:
  truths:
    - "Calling validateEmbedCode with a string containing any of the 10 banned patterns returns {valid:false, reason:'Forbidden construct: ...'}"
    - "Calling validateEmbedCode with safe inline HTML+JS returns {valid:true}"
    - "Calling injectGameHead returns a string that contains both the CSP meta tag and a viewport meta tag"
    - "The injected CSP contains connect-src 'none' and script-src 'unsafe-inline' literally"
    - "The injected style block contains overflow-x:hidden and max-width:100% so 360px viewports cannot scroll horizontally"
  artifacts:
    - path: "apps/web/lib/game-validator.ts"
      provides: "validateEmbedCode() pure validator + injectGameHead() srcdoc head injector for Plan 07-03"
      exports: ["validateEmbedCode", "injectGameHead", "BANNED_PATTERNS", "GAME_CSP_POLICY"]
      min_lines: 80
    - path: "apps/web/__tests__/game-validator.test.ts"
      provides: "Vitest unit tests proving each banned pattern is rejected and the head injection contains CSP + viewport + reset CSS"
      contains: "validateEmbedCode"
  key_links:
    - from: "apps/web/lib/game-validator.ts (BANNED_PATTERNS)"
      to: "packages/pipeline/src/eisenbalm_pipeline/agents/game.py (FORBIDDEN_CONSTRUCTS)"
      via: "Hand-maintained mirror — frontend cannot import Python module; both lists describe the same threat surface"
      pattern: "window.parent|document.cookie|fetch\\("
    - from: "apps/web/__tests__/game-validator.test.ts"
      to: "apps/web/lib/game-validator.ts"
      via: "Vitest import via @/lib/game-validator path alias (vite-tsconfig-paths resolves)"
      pattern: "from '@/lib/game-validator'"
---

<objective>
Create the renderer-level validator and CSP injection module that GameSlot (Plan 07-03) calls before deciding whether to render the iframe or the fallback. This plan owns the deny-list (mirroring `FORBIDDEN_CONSTRUCTS` in `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`), the CSP policy string, the head-injection function (CSP + viewport + mobile CSS reset), and the unit tests that prove each banned pattern is rejected and that the injected head contains the required directives.

Purpose: Phase 5's GameWriter ships prompt-level defense only. Phase 7's renderer-level enforcement layer is the second wall — it catches LLM hallucinations that slipped past the prompt and adds the CSP backstop so even obfuscated banned calls fail at the network layer. The mobile CSS reset (viewport meta + `overflow-x:hidden` + `max-width:100%` on canvas/img) is the substrate for GAM-06; the iframe container in GameSlot has `overflow-hidden` but the rendered game's own HTML can still break out without the reset.

Output: `apps/web/lib/game-validator.ts` with `validateEmbedCode`, `injectGameHead`, `BANNED_PATTERNS`, and `GAME_CSP_POLICY` exports. Full Vitest coverage for every banned pattern and every required CSP directive.
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

@packages/pipeline/src/eisenbalm_pipeline/agents/game.py
@apps/web/lib/sanity/types.ts
@apps/web/vitest.config.ts
@apps/web/__tests__/game-validator.test.ts

<interfaces>
<!-- The Python pipeline source-of-truth for the deny-list is the
     FORBIDDEN_CONSTRUCTS module-level string in
     packages/pipeline/src/eisenbalm_pipeline/agents/game.py, which
     enumerates exactly 10 forbidden constructs:

       <script src="...">    no external scripts
       <link href="...">     no external stylesheets
       fetch(                no network calls
       XMLHttpRequest        no AJAX
       window.parent         no parent frame access
       window.top            no top frame access
       document.cookie       no cookie access
       localStorage          no storage access
       eval(                 no dynamic evaluation
       import(               no dynamic imports

     The ROADMAP requirement (GAM-02) adds two additional patterns that
     the prompt doesn't already mention but the renderer MUST reject:

       top.                  property access on top global
       parent.               property access on parent global
       document.domain       same-origin policy bypass attempt

     Frontend TypeScript cannot import from Python; the list is
     hand-mirrored. The Phase 7 SUMMARY must explicitly note both
     locations so future edits stay in sync. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write game-validator.ts with deny-list + CSP + head injector</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/game.py (lines 24-40 — FORBIDDEN_CONSTRUCTS verbatim; the source of truth this module mirrors)
    - apps/web/lib/sanity/types.ts (IssueGame shape — embedCode is the string this module validates)
    - .planning/phases/07-game-rendering/07-RESEARCH.md (sections: Pattern 1 Validator Module, Pattern 2 CSP Meta Tag Injection, Mobile Responsiveness Approach, Pitfall 4 and Pitfall 5)
  </read_first>
  <behavior>
    - validateEmbedCode("<script>alert(1)</script>") → {valid: true}
    - validateEmbedCode("<script>document.cookie</script>") → {valid: false, reason: "Forbidden construct: cookie access (document.cookie)"}
    - validateEmbedCode("<script>fetch('https://evil')</script>") → {valid: false, reason: "Forbidden construct: network request (fetch)"}
    - validateEmbedCode(s) rejects each of these literal substrings: "window.parent", "window.top", "document.cookie", "document.domain", "fetch(", "XMLHttpRequest", "localStorage", "eval(", "import("
    - validateEmbedCode(s) rejects `<script src="...">` and `<link href="...">` via case-insensitive regex (catches `<script SRC=`, `<Script src=`, `<link  href=`)
    - validateEmbedCode(s) rejects `top.location` and `parent.foo` via word-boundary regex (`\btop\.` and `\bparent\.`)
    - injectGameHead("<html><head></head><body>x</body></html>") returns a string that starts with the CSP meta tag (prepended — Pitfall 4 says always prepend, do not rely on <head> matching)
    - The returned string contains the literal substring `<meta http-equiv="Content-Security-Policy"`
    - The returned string contains the literal substring `<meta name="viewport"`
    - The returned string contains the literal substring `overflow-x:hidden` (or `overflow-x: hidden` — either spacing) in the injected style
    - The returned string contains the literal substring `max-width:100%` (or `max-width: 100%`) in the injected style applied to canvas/svg/img
  </behavior>
  <files>apps/web/lib/game-validator.ts (new)</files>
  <action>
    Create `apps/web/lib/game-validator.ts` with this exact content (you may format comments/whitespace differently but all exported symbols and literal strings must appear verbatim):

    ```ts
    /**
     * Phase 7 game embed-code validator and srcdoc head injector.
     *
     * Threat surface (07-RESEARCH §Threat Model): the iframe is sandboxed
     * with `sandbox="allow-scripts"` (no allow-same-origin), so the page
     * has a null origin and cannot reach the parent cookie jar, storage,
     * or DOM. This module adds two defence layers:
     *
     *   1. validateEmbedCode — static string/regex scan that rejects known
     *      forbidden constructs before the iframe ever mounts. Mirrors
     *      FORBIDDEN_CONSTRUCTS in
     *      packages/pipeline/src/eisenbalm_pipeline/agents/game.py.
     *      KEEP IN SYNC if either list changes.
     *
     *   2. injectGameHead — prepends a CSP meta tag (connect-src 'none')
     *      plus a viewport meta and mobile CSS reset into the srcdoc.
     *      The CSP backstop catches obfuscated forms the validator misses
     *      (e.g. `window["fetch"]`). The CSS reset prevents the embedded
     *      game from overflowing a 360px viewport (GAM-06).
     *
     * Both functions are pure (no I/O, no React, no Convex). The Convex
     * write on validation failure lives in GameSlot.tsx (Plan 07-03).
     */

    // ─── Deny-list (mirrors Python FORBIDDEN_CONSTRUCTS) ──────────────────────
    //
    // Order matters only for the reason string returned on first match.
    // The 13 entries below cover the 10 Python entries PLUS the 3 extras
    // called out in the ROADMAP requirement text (GAM-02):
    //   top.          property access on top global
    //   parent.       property access on parent global
    //   document.domain   same-origin policy bypass
    export const BANNED_PATTERNS: ReadonlyArray<{
      readonly pattern: string | RegExp
      readonly label: string
    }> = [
      { pattern: 'window.parent',    label: 'parent frame access (window.parent)' },
      { pattern: 'window.top',       label: 'top frame access (window.top)' },
      { pattern: /\btop\./,          label: 'top global property access (top.)' },
      { pattern: /\bparent\./,       label: 'parent global property access (parent.)' },
      { pattern: 'fetch(',           label: 'network request (fetch)' },
      { pattern: 'XMLHttpRequest',   label: 'network request (XMLHttpRequest)' },
      { pattern: 'document.cookie',  label: 'cookie access (document.cookie)' },
      { pattern: 'document.domain',  label: 'document.domain' },
      { pattern: 'localStorage',     label: 'storage access (localStorage)' },
      { pattern: 'eval(',            label: 'dynamic evaluation (eval)' },
      { pattern: 'import(',          label: 'dynamic import' },
      { pattern: /<script[^>]+src\s*=/i,  label: 'external script (<script src=...>)' },
      { pattern: /<link[^>]+href\s*=/i,   label: 'external stylesheet (<link href=...>)' },
    ]

    export type ValidationResult =
      | { valid: true }
      | { valid: false; reason: string }

    export function validateEmbedCode(embedCode: string): ValidationResult {
      if (typeof embedCode !== 'string' || embedCode.length === 0) {
        return { valid: false, reason: 'Embed code is empty' }
      }
      for (const { pattern, label } of BANNED_PATTERNS) {
        const found = typeof pattern === 'string'
          ? embedCode.includes(pattern)
          : pattern.test(embedCode)
        if (found) {
          return { valid: false, reason: `Forbidden construct: ${label}` }
        }
      }
      return { valid: true }
    }

    // ─── CSP policy ───────────────────────────────────────────────────────────
    //
    // Why each directive (07-RESEARCH §CSP Injection — Detailed Notes):
    //   default-src 'none'        deny by default; every unlisted directive
    //                             falls back to none.
    //   script-src 'unsafe-inline'  required — game JS is inline and dynamic;
    //                             no nonce/hash possible.
    //   style-src 'unsafe-inline'   inline <style> in the game.
    //   img-src data:             allow base64 sprites; block HTTP images.
    //   connect-src 'none'        BACKSTOP for fetch/XHR/WebSocket. Catches
    //                             obfuscated forms the deny-list misses.
    //   frame-src 'none'          no nested iframes.
    //   object-src 'none'         no plugins.
    //   base-uri 'none'           no <base> tag redirect of relative URLs.
    //   form-action 'none'        no form submission.
    export const GAME_CSP_POLICY = [
      "default-src 'none'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
      "img-src data:",
      "connect-src 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ')

    // ─── Head injection (CSP + viewport + mobile reset) ───────────────────────
    //
    // Pitfall 4 (07-RESEARCH): the meta CSP MUST appear before any inline
    // <script>. Always prepend to the document rather than chasing <head>
    // — browsers apply meta CSP at parse time, not DOM-order time, but
    // prepending is the only guarantee for malformed LLM HTML output.
    //
    // The mobile reset (GAM-06 substrate):
    //   * { box-sizing: border-box }       prevent width-overflow surprises
    //   html, body { overflow-x:hidden; max-width:100%; margin:0; padding:0 }
    //   canvas, svg, img { max-width:100% !important; height:auto }
    //
    // The iframe container in GameSlot has overflow-hidden, but a game
    // with a hardcoded 800px canvas would be clipped — partial render.
    // The reset coerces the canvas to fit, which is the correct UX even
    // if it means the canvas re-rasterizes at the smaller size.
    const GAME_HEAD: string = [
      `<meta http-equiv="Content-Security-Policy" content="${GAME_CSP_POLICY}">`,
      `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      `<style>`,
      `  * { box-sizing: border-box; }`,
      `  html, body { margin: 0; padding: 0; overflow-x: hidden; max-width: 100%; }`,
      `  canvas, svg, img { max-width: 100% !important; height: auto; }`,
      `</style>`,
    ].join('\n')

    /**
     * Prepend the CSP meta tag, viewport tag, and mobile CSS reset to the
     * embed code. Always prepend (Pitfall 4) — do not try to match <head>
     * because LLM output may omit it.
     */
    export function injectGameHead(embedCode: string): string {
      return `${GAME_HEAD}\n${embedCode}`
    }
    ```

    Verify after writing:
    - The file contains the literal export `export const BANNED_PATTERNS`
    - The file contains the literal export `export function validateEmbedCode`
    - The file contains the literal export `export function injectGameHead`
    - The file contains the literal export `export const GAME_CSP_POLICY`
    - The file contains the literal substring `connect-src 'none'`
    - The file contains the literal substring `<meta name="viewport"`
    - The file contains the literal substring `overflow-x: hidden`
  </action>
  <verify>
    <automated>pnpm --filter apps/web typecheck 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/lib/game-validator.ts` exists
    - `grep "export function validateEmbedCode" apps/web/lib/game-validator.ts` returns 1 match
    - `grep "export function injectGameHead" apps/web/lib/game-validator.ts` returns 1 match
    - `grep "export const BANNED_PATTERNS" apps/web/lib/game-validator.ts` returns 1 match
    - `grep "export const GAME_CSP_POLICY" apps/web/lib/game-validator.ts` returns 1 match
    - `grep "window.parent" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "window.top" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "document.cookie" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "document.domain" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "XMLHttpRequest" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "localStorage" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep -E "'eval\\('" apps/web/lib/game-validator.ts` returns at least 1 match (the literal `'eval('` in the pattern entry)
    - `grep -E "'import\\('" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "'fetch('" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "connect-src 'none'" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "script-src 'unsafe-inline'" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep '<meta name="viewport"' apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "overflow-x: hidden" apps/web/lib/game-validator.ts` returns at least 1 match
    - `grep "max-width: 100%" apps/web/lib/game-validator.ts` returns at least 1 match
    - `pnpm --filter apps/web typecheck` exits with code 0 (no TypeScript errors introduced)
  </acceptance_criteria>
  <done>Validator module compiles, exports all four required symbols, and embeds every required deny-list pattern + CSP directive + mobile reset rule.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace stub assertions in __tests__/game-validator.test.ts with real coverage</name>
  <read_first>
    - apps/web/lib/game-validator.ts (the module under test — must exist from Task 1)
    - apps/web/__tests__/game-validator.test.ts (current stub from Plan 07-01 — Task 1 here overwrites the `it.todo` calls)
    - apps/web/vitest.config.ts (proves vite-tsconfig-paths is wired so `@/lib/game-validator` resolves)
  </read_first>
  <files>apps/web/__tests__/game-validator.test.ts (modified)</files>
  <action>
    Overwrite `apps/web/__tests__/game-validator.test.ts` with this content:

    ```ts
    import { describe, it, expect } from 'vitest'

    import {
      BANNED_PATTERNS,
      GAME_CSP_POLICY,
      injectGameHead,
      validateEmbedCode,
    } from '@/lib/game-validator'

    // Fixtures — one expected-rejection sample per banned construct.
    // The label string is what validateEmbedCode returns inside `reason`,
    // so the test pulls the labels straight off BANNED_PATTERNS to avoid
    // double-maintaining the list.
    const BANNED_SAMPLES: ReadonlyArray<{ label: string; sample: string }> = [
      { label: 'parent frame access (window.parent)',     sample: '<script>window.parent.foo</script>' },
      { label: 'top frame access (window.top)',           sample: '<script>window.top.foo</script>' },
      { label: 'top global property access (top.)',       sample: '<script>top.location.href</script>' },
      { label: 'parent global property access (parent.)', sample: '<script>parent.location.href</script>' },
      { label: 'network request (fetch)',                 sample: '<script>fetch("/x")</script>' },
      { label: 'network request (XMLHttpRequest)',        sample: '<script>new XMLHttpRequest()</script>' },
      { label: 'cookie access (document.cookie)',         sample: '<script>document.cookie</script>' },
      { label: 'document.domain',                         sample: '<script>document.domain = "evil"</script>' },
      { label: 'storage access (localStorage)',           sample: '<script>localStorage.getItem("x")</script>' },
      { label: 'dynamic evaluation (eval)',               sample: '<script>eval("alert(1)")</script>' },
      { label: 'dynamic import',                          sample: '<script>import("./x")</script>' },
      { label: 'external script (<script src=...>)',      sample: '<script src="https://evil/x.js"></script>' },
      { label: 'external stylesheet (<link href=...>)',   sample: '<link href="https://evil/x.css" rel="stylesheet">' },
    ]

    describe('game-validator', () => {
      describe('validateEmbedCode (GAM-02)', () => {
        it('rejects empty embedCode', () => {
          expect(validateEmbedCode('')).toEqual({ valid: false, reason: 'Embed code is empty' })
        })

        it('accepts safe inline HTML+JS with no banned constructs', () => {
          const safe = `<!DOCTYPE html><html><head></head><body>
            <canvas id="c"></canvas>
            <script>
              const ctx = document.getElementById('c').getContext('2d');
              let x = 0;
              setInterval(() => { x = (x + 1) % 100; }, 100);
            </script>
          </body></html>`
          expect(validateEmbedCode(safe)).toEqual({ valid: true })
        })

        it('mirrors all 13 banned-pattern entries exactly', () => {
          // If BANNED_PATTERNS grows or shrinks the sample list must follow.
          // This is the tripwire between game.py FORBIDDEN_CONSTRUCTS and
          // this module.
          expect(BANNED_PATTERNS).toHaveLength(BANNED_SAMPLES.length)
        })

        for (const { label, sample } of BANNED_SAMPLES) {
          it(`rejects: ${label}`, () => {
            const result = validateEmbedCode(sample)
            expect(result).toEqual({
              valid: false,
              reason: `Forbidden construct: ${label}`,
            })
          })
        }

        it('does not false-positive on words containing "parent" or "top" without dot access', () => {
          // GAM-02 Pitfall 5: \btop\. and \bparent\. use word boundaries.
          // Strings like "the most important moment" or "in the top tier"
          // should pass.
          const safe = `<p>the most important moment in the top tier</p>`
          expect(validateEmbedCode(safe)).toEqual({ valid: true })
        })
      })

      describe('injectGameHead (GAM-04, GAM-06 substrate)', () => {
        const sampleDoc = '<!DOCTYPE html><html><head></head><body><p>game</p></body></html>'

        it('returns a string longer than the input (head was injected)', () => {
          expect(injectGameHead(sampleDoc).length).toBeGreaterThan(sampleDoc.length)
        })

        it('injects a CSP meta tag with connect-src none and script-src unsafe-inline', () => {
          const out = injectGameHead(sampleDoc)
          expect(out).toContain('<meta http-equiv="Content-Security-Policy"')
          expect(out).toContain("connect-src 'none'")
          expect(out).toContain("script-src 'unsafe-inline'")
          expect(out).toContain("default-src 'none'")
        })

        it('GAME_CSP_POLICY contains every required directive', () => {
          expect(GAME_CSP_POLICY).toContain("default-src 'none'")
          expect(GAME_CSP_POLICY).toContain("script-src 'unsafe-inline'")
          expect(GAME_CSP_POLICY).toContain("style-src 'unsafe-inline'")
          expect(GAME_CSP_POLICY).toContain("img-src data:")
          expect(GAME_CSP_POLICY).toContain("connect-src 'none'")
          expect(GAME_CSP_POLICY).toContain("frame-src 'none'")
          expect(GAME_CSP_POLICY).toContain("object-src 'none'")
          expect(GAME_CSP_POLICY).toContain("base-uri 'none'")
          expect(GAME_CSP_POLICY).toContain("form-action 'none'")
        })

        it('injects a viewport meta tag (GAM-06)', () => {
          const out = injectGameHead(sampleDoc)
          expect(out).toContain('<meta name="viewport"')
          expect(out).toContain('width=device-width')
        })

        it('injects a CSS reset that prevents horizontal overflow at 360px (GAM-06)', () => {
          const out = injectGameHead(sampleDoc)
          expect(out).toContain('overflow-x: hidden')
          expect(out).toContain('max-width: 100%')
        })

        it('prepends the head injection (Pitfall 4 — never relies on <head> match)', () => {
          // The function must put its injection BEFORE the user document
          // so the CSP applies even when LLM HTML lacks a <head>.
          const out = injectGameHead(sampleDoc)
          const cspIdx = out.indexOf('Content-Security-Policy')
          const docIdx = out.indexOf('<!DOCTYPE html>')
          expect(cspIdx).toBeGreaterThanOrEqual(0)
          expect(docIdx).toBeGreaterThan(cspIdx)
        })

        it('handles malformed HTML without <head> (still prepends head)', () => {
          const malformed = '<body><canvas></canvas></body>'
          const out = injectGameHead(malformed)
          expect(out).toContain('Content-Security-Policy')
          expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<body>'))
        })
      })
    })
    ```

    Notes:
    - Parametric `for (const ... of BANNED_SAMPLES) it(...)` creates one Vitest test per banned pattern — the per-pattern test names appear in the runner output, making it trivial to see which pattern regressed.
    - The `mirrors all 13 banned-pattern entries exactly` test catches drift between the deny-list and the sample fixtures — if someone adds an entry to BANNED_PATTERNS without a sample, the suite fails loudly.
    - The "false-positive on words" test is the safety net for Pitfall 5 (`\btop\.` vs `margin-top.5rem`).
    - Run the test suite to confirm all assertions pass.
  </action>
  <verify>
    <automated>pnpm --filter apps/web test:unit 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/__tests__/game-validator.test.ts` contains the import `from '@/lib/game-validator'`
    - `grep "BANNED_SAMPLES" apps/web/__tests__/game-validator.test.ts` returns at least 2 matches
    - `grep "it(\`rejects:" apps/web/__tests__/game-validator.test.ts` returns 1 match (the parametric per-pattern test)
    - `grep "it.todo" apps/web/__tests__/game-validator.test.ts` returns 0 matches (every stub from Plan 07-01 replaced)
    - `pnpm --filter apps/web test:unit` exits with code 0
    - Test output reports at least 18 passing assertions across game-validator.test.ts (13 banned-pattern parametric + safe-doc + length mirror + 7+ CSP/inject)
    - Test output contains the string `rejects: parent frame access (window.parent)` (proves the parametric test ran with the right label)
    - Test output contains the string `rejects: cookie access (document.cookie)`
    - Test output contains the string `rejects: dynamic evaluation (eval)`
    - Test output contains the string `injects a CSP meta tag`
    - Test output contains the string `injects a viewport meta tag`
  </acceptance_criteria>
  <done>Validator unit suite is comprehensive: every banned construct has a dedicated test, CSP directives are individually asserted, viewport + mobile reset are asserted, and the suite passes end-to-end.</done>
</task>

</tasks>

<verification>
- `pnpm --filter apps/web typecheck` exits 0
- `pnpm --filter apps/web test:unit` exits 0
- game-validator test file has 18+ passing assertions
- BANNED_PATTERNS has exactly 13 entries (10 mirrored from Python + top./parent./document.domain extras called out by GAM-02)
- GAME_CSP_POLICY contains all 9 required directives literally
</verification>

<success_criteria>
- GAM-02: validator rejects all banned constructs from the requirement text and from FORBIDDEN_CONSTRUCTS — proven by the parametric test
- GAM-04: a CSP meta tag with `connect-src 'none'` is injected into every srcdoc — proven by `injects a CSP meta tag` test
- GAM-06 (substrate): viewport meta + overflow:hidden + max-width:100% CSS reset are present in the injected head — proven by `injects a viewport meta tag` and `injects a CSS reset` tests
- Module is consumable by Plan 07-03 via `import { validateEmbedCode, injectGameHead } from '@/lib/game-validator'`
</success_criteria>

<output>
After completion, create `.planning/phases/07-game-rendering/07-02-validator-and-csp-SUMMARY.md` documenting:
- Final count of BANNED_PATTERNS entries (must equal 13)
- Full GAME_CSP_POLICY string verbatim
- Test pass count from `pnpm --filter apps/web test:unit` output
- Confirmation that frontend deny-list mirrors Python FORBIDDEN_CONSTRUCTS plus the 3 GAM-02 extras
- Note for future engineers: edits to either deny-list must be mirrored in the other file
</output>
