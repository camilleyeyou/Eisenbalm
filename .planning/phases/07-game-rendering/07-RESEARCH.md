# Phase 7: Game Rendering — Research

**Researched:** 2026-05-18
**Domain:** iframe security, HTML/JS static analysis, Convex mutations from Next.js client components
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GAM-01 | iframe uses exactly `sandbox="allow-scripts"` (never `allow-same-origin`); codebase rule prevents `allow-same-origin` from ever appearing in the game component | Sandbox threat model section + ESLint approach section |
| GAM-02 | Automated validator rejects embedCode containing any banned pattern; CSP meta tag injected into every srcdoc | HTML/JS static analysis section + CSP injection section |
| GAM-03 | ESLint or codebase-level rule prevents `allow-same-origin` from being added to the iframe sandbox attribute | ESLint approach section — Jest/Vitest source-scan test recommended |
| GAM-04 | CSP `<meta>` tag restricting external resources injected into srcdoc HTML | CSP injection section — exact directives documented |
| GAM-05 | Validation failure shows "Game unavailable" fallback; Convex `qaCorrections` entry written with rejection reason | Convex write pattern section |
| GAM-06 | Game renders correctly at ≥360px without horizontal scroll | Mobile responsiveness section |
</phase_requirements>

---

## Summary

Phase 7 wires the game iframe that was built as a hidden stub in Phase 2. The `GameSlot` component at `apps/web/components/issue/GameSlot.tsx` already renders a `sandbox="allow-scripts"` iframe (hidden behind a placeholder), and `apps/web/lib/sanity/types.ts` already defines `IssueGame` with `{headline, description, embedCode}`. Phase 7's job is: (1) surface the iframe by replacing the Phase 2 placeholder with real render logic, (2) insert a CSP meta tag into every srcdoc HTML document, (3) run a static validator against the embedCode before rendering, (4) wire the fallback path — "Game unavailable" UI + a `qaCorrections` Convex write — when validation fails, and (5) enforce that `allow-same-origin` can never be introduced to the sandbox attribute via a lightweight test.

The GameWriter (Phase 5, `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`) already embeds the FORBIDDEN_CONSTRUCTS deny-list in its system prompt. Phase 7 adds the renderer-level enforcement layer the GameWriter summary explicitly reserved for this phase. The constant `FORBIDDEN_CONSTRUCTS` is importable from the pipeline package, but the validator lives in `apps/web/` (frontend) and must duplicate or mirror the list — the frontend cannot import from the pipeline Python package. The deny-list is short and stable; duplication is correct.

**Primary recommendation:** Implement the validator as a TypeScript module (`apps/web/lib/game-validator.ts`) using string-matching (not an HTML/JS parser), inject a hard-coded CSP meta tag as the first element of every srcdoc document, surface the iframe when validation passes and the fallback when it fails, and guard `allow-same-origin` with a Vitest source-scan test (not an ESLint plugin, since ESLint is not configured for the web app).

---

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 7. The constraints below come from CLAUDE.md (project-wide), API_CONTRACTS.md, and locked decisions in STATE.md.

### Locked Decisions Affecting Phase 7

- Stack: Next.js 15 App Router (`apps/web`), Convex, Sanity — locked, no substitutions.
- `GameSlot` component: `apps/web/components/issue/GameSlot.tsx` — already scaffolded with `sandbox="allow-scripts"` and a hidden iframe stub. Phase 7 replaces the placeholder, does not rename or move the component.
- `IssueGame` type: `{headline: string, description: string | null, embedCode: string} | null` — defined in `apps/web/lib/sanity/types.ts`. Do not add fields here (would require API_CONTRACTS.md amendment).
- `qaCorrections` Convex mutation shape (Phase 5 D-01): `{runId, sectionName, reason, severity: 'info'|'warning'|'error', accepted: boolean}` plus optional `{agentId, axis, quotedSpan, suggestedFix}`. Phase 7 writes a `severity='error'` row with `sectionName='game'`, `accepted=false`, `agentId='game-validator'`.
- ESLint: not configured in `apps/web/`. No `.eslintrc` or `eslint.config.*` file exists. A Vitest source-scan test is the correct implementation of GAM-03.
- Vitest: not currently in `apps/web/`. Phase 7 must install it (or use `jest`) as a dev dependency to run the source-scan test. See Environment Availability section.
- Voice: "Game unavailable" copy must match Jesse's dry, precise tone. No exclamation marks, no warmth, no "sorry for the inconvenience."
- Convex write must be idempotent — a game that fails validation on every page render must not create unbounded `qaCorrections` rows.

### Claude's Discretion

- Exact validator implementation approach (string-match vs HTML parser vs AST) — research determines this; recommendation is string-match.
- Whether to add the `csp` attribute on the iframe element in addition to the meta tag (Chromium only; Firefox ignores it).
- Mobile responsive implementation: whether to hardcode a pixel-height container or use `aspect-ratio`.
- Idempotency mechanism for the Convex write.

### Deferred (OUT OF SCOPE)

- Playwright e2e visual regression test for mobile (Phase 7 does not own Playwright infrastructure; smoke test is manual).
- In-pipeline re-validation of embedCode before writing to Sanity (that would be a Phase 5 QA change; Phase 7 is frontend-only).
- Allowing `window.postMessage` receive from iframe (not needed for v1 games).

---

## Current State of the Codebase

### What Exists (relevant to Phase 7)

**`apps/web/components/issue/GameSlot.tsx`** — Scaffolded in Phase 2. Contains:
- The section container (`id="game"`, `max-w-[860px]`, `print:hidden`)
- Headline and description rendering (already wired)
- A placeholder `<div>` that shows "Interactive version of this section is loading."
- A hidden `<iframe style={{display:'none'}} sandbox="allow-scripts" srcDoc={game.embedCode}>` when `game?.embedCode` is truthy
- `AnchorCopyButton` wired to `#game`

**Phase 7's job:** Remove the placeholder, show the iframe (or fallback), inject CSP, run validator.

**`apps/web/lib/sanity/types.ts`** — `IssueGame` type defined: `{headline: string, description: string | null, embedCode: string} | null`.

**`apps/web/app/issue/[slug]/page.tsx`** — Server component. Passes `issue.game` to `<GameSlot game={issue.game} />`. The issue page is a React Server Component with `revalidate = 60`.

**`apps/web/components/providers/ConvexClientProvider.tsx`** — `ConvexProvider` mounted at root layout. `useMutation` hooks work in any `'use client'` descendant.

**`convex/qaCorrections.ts`** — `insert` mutation exists with Phase 5 shape. Called from Python pipeline. Phase 7 calls it from the frontend via `useMutation`.

**`packages/pipeline/src/eisenbalm_pipeline/agents/game.py`** — `FORBIDDEN_CONSTRUCTS` constant (module-level string) enumerates 10 deny-list entries. Phase 7 mirrors this list in the frontend validator (TypeScript string array).

### What Does Not Exist Yet

- `apps/web/lib/game-validator.ts` — the validator module
- Vitest (or Jest) in `apps/web/` — needed for GAM-03 source-scan test
- Any Convex write from a frontend component (all existing Convex writes are from the Python pipeline)
- The `runId` is available on `issue.runId` (from GROQ query §1.2 projection: `"runId": pipelineMetadata.runId`). The game component needs to receive it to write the `qaCorrections` row.

---

## Threat Model

### What `sandbox="allow-scripts"` Without `allow-same-origin` Prevents

Source: [MDN iframe sandbox documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)

When `allow-same-origin` is omitted, the sandboxed iframe is treated as having a **null/opaque origin** that always fails same-origin policy checks. This prevents:

1. **Cookie access**: `document.cookie` throws / returns empty — the null origin cannot access the embedding page's cookie jar.
2. **localStorage/sessionStorage access**: Origin-based storage is unavailable to the null origin.
3. **Parent DOM access**: `window.parent.document` is denied — cross-origin restriction applies because the iframe's origin is null (different from the parent's real origin).
4. **IndexedDB**: Blocked by null origin.
5. **Top-level navigation by default**: `sandbox` without `allow-top-navigation` prevents navigation of the parent frame.
6. **Form submission**: `sandbox` without `allow-forms` prevents form submission.
7. **Popups**: `sandbox` without `allow-popups` prevents `window.open()`.

### What Remains Possible (Accepted Residual Risk)

1. **`postMessage` to parent**: The sandbox does not block `window.parent.postMessage(...)`. The iframe can send arbitrary messages to the parent. Mitigation: the parent page does NOT add a `message` event listener for game messages (Phase 7 adds no `window.addEventListener('message', ...)`), so these messages are silently dropped. The validator also bans `window.parent` references, which would block the most direct postMessage call.

2. **Outbound network calls via `fetch()` or `XMLHttpRequest`**: The null origin means cookie-based auth fails, but anonymous/CORS-permitted network calls can succeed. The validator bans `fetch(` and `XMLHttpRequest`. A determined LLM-generated script could use `fetch` with obfuscation (e.g., `window["fetch"]`). The meta CSP (`connect-src 'none'`) provides the enforcement layer that makes these calls fail regardless of how the JS is written.

3. **CPU/memory exhaustion**: Infinite loops or heavy computation in the iframe can impact the tab. Not mitigated — acceptable residual risk for a staff-reviewed pipeline.

4. **Rendering attacks within iframe bounds**: The embedded content controls its own visual output. Not a concern for the parent page's security.

5. **`window.parent` property access attempt**: With `allow-scripts` but without `allow-same-origin`, `window.parent` IS accessible as a reference but cross-origin restrictions apply — the script cannot read parent properties. The validator bans the string `window.parent` at the static analysis level, which is defense-in-depth.

6. **Obfuscation of banned patterns**: A LLM could write `window["parent"]` instead of `window.parent`. The validator uses string-match, which catches the literal form. The CSP is the second layer that catches what string-match misses at the network level.

### Accepted Risk Summary

The threat model for this project is **not adversarial** (LLM output is structured, not adversarially crafted). The GameWriter runs in a staff-controlled pipeline reviewed by Andrew. The validation prevents accidental inclusion of forbidden patterns from hallucination, not sophisticated bypass attempts. String-match + CSP is the appropriate pragmatic level.

---

## Standard Stack

### Core (No New Major Libraries)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `convex/react` | `^1.38.0` (already installed) | `useMutation` hook for writing `qaCorrections` | Already in `apps/web/package.json` |
| Next.js | `^15.3.9` (already installed) | Server component for game data fetch | Already used |

### Dev Dependencies to Add

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `vitest` | `^3.x` (latest) | Source-scan test for GAM-03 | No test runner in `apps/web` yet; lightweight, Vite-compatible |
| `@vitest/ui` | optional | Dev convenience | Optional |

### Installation

```bash
pnpm --filter apps/web add -D vitest
```

**Version verification needed at plan time:**
```bash
npm view vitest version
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest is heavier; Vitest works natively with TypeScript/ESM; no babel config needed |
| Vitest | ESLint plugin | ESLint not configured in `apps/web/`; adding it creates a larger footprint; Vitest source-scan is simpler |
| String-match validator | `parse5` HTML parser | parse5 is ~200KB; overkill for deny-list checking of structured LLM output; string-match is adequate |
| String-match validator | `acorn` JS AST parser | acorn would catch obfuscation like `window["parent"]` but adds complexity; the CSP handles the obfuscated-form threat anyway |

---

## Architecture Patterns

### Recommended File Layout

```
apps/web/
├── components/
│   └── issue/
│       ├── GameSlot.tsx          ← replace placeholder with real render logic
│       └── GameFallback.tsx      ← new: "Game unavailable" UI (pure display, no logic)
├── lib/
│   └── game-validator.ts         ← new: validateEmbedCode(embedCode) → ValidationResult
├── __tests__/
│   └── game-validator.test.ts    ← new: unit tests for validator (Vitest)
│   └── game-sandbox.test.ts      ← new: GAM-03 source-scan test
└── vitest.config.ts              ← new: minimal Vitest config
```

### Pattern 1: Validator Module

**What:** A pure TypeScript function that takes `embedCode: string` and returns `{valid: boolean, reason?: string}`.

**When to use:** Called synchronously before deciding whether to show the iframe or the fallback.

```typescript
// apps/web/lib/game-validator.ts

// Mirrors FORBIDDEN_CONSTRUCTS from packages/pipeline/src/eisenbalm_pipeline/agents/game.py
// Update both if the deny-list changes. (Frontend cannot import Python module.)
const BANNED_PATTERNS: Array<{pattern: string | RegExp, label: string}> = [
  { pattern: 'window.parent',         label: 'parent frame access (window.parent)' },
  { pattern: 'window.top',            label: 'parent frame access (window.top)' },
  { pattern: /\btop\./,               label: 'top frame access (top.)' },
  { pattern: /\bparent\./,            label: 'parent frame access (parent.)' },
  { pattern: 'fetch(',                label: 'network request (fetch)' },
  { pattern: 'XMLHttpRequest',        label: 'network request (XMLHttpRequest)' },
  { pattern: 'document.cookie',       label: 'cookie access' },
  { pattern: 'document.domain',       label: 'document.domain' },
  { pattern: /localStorage/,          label: 'storage access (localStorage)' },
  { pattern: /<script[^>]+src=/i,     label: 'external script (<script src=...)' },
  { pattern: /<link[^>]+href=/i,      label: 'external stylesheet (<link href=...)' },
]

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export function validateEmbedCode(embedCode: string): ValidationResult {
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
```

**Confidence:** HIGH — string-match is the correct approach for this threat model. The ROADMAP requirement text lists exact string forms for the banned patterns (GAM-02 requirement text verbatim uses the same patterns as the FORBIDDEN_CONSTRUCTS constant).

**Note on `top.` and `parent.`:** The ROADMAP requirement says "top., parent." — these are property accesses on the global scope, not attribute substrings. Use regex `\btop\.` and `\bparent\.` to avoid false positives on strings like "top.chart" in game content. The word-boundary `\b` prevents matching "laptop." or "important.".

### Pattern 2: CSP Meta Tag Injection

**What:** Before passing `embedCode` to `srcDoc`, prepend a `<meta http-equiv="Content-Security-Policy">` as the very first element of the HTML document.

**Why:** If the embedCode is a complete `<!DOCTYPE html>` document (which LLM output typically is), the CSP meta tag must be inside the `<head>` to be parsed early. The safest approach: inject it at string level unconditionally.

```typescript
// apps/web/lib/game-validator.ts (or inline in GameSlot.tsx)

const GAME_CSP_POLICY = [
  "default-src 'none'",          // deny everything by default
  "script-src 'unsafe-inline'",  // allow inline <script> tags (the game itself)
  "style-src 'unsafe-inline'",   // allow inline <style> tags
  "img-src data:",               // allow data: URIs for images (common in games)
  "connect-src 'none'",          // NO network requests
  "frame-src 'none'",            // no nested iframes
  "object-src 'none'",           // no plugins
  "base-uri 'none'",             // prevent base tag injection
  "form-action 'none'",          // no form submission
].join('; ')

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${GAME_CSP_POLICY}">`

export function injectCsp(embedCode: string): string {
  // If the document has a <head>, inject after <head>
  if (/<head[^>]*>/i.test(embedCode)) {
    return embedCode.replace(/(<head[^>]*>)/i, `$1\n${CSP_META}`)
  }
  // If no <head>, prepend to the whole document
  return `${CSP_META}\n${embedCode}`
}
```

**CSP directive notes:**
- `script-src 'unsafe-inline'` is required because the game is inline `<script>` — no nonce/hash is available since the content is dynamic.
- `connect-src 'none'` is the enforcement backstop against `fetch()` / `XMLHttpRequest` even if the string-match validator misses an obfuscated form.
- `img-src data:` allows LLM-generated games to embed base64 images, which is common.
- `frame-src 'none'` prevents nested iframes.

**Meta CSP vs HTTP header CSP:** A `<meta>` CSP inside srcdoc applies only to the iframe document, not to the parent page. It cannot use `frame-ancestors` (meta CSP limitation), but `frame-ancestors` is not needed here. The meta tag's restriction on `connect-src` is the critical clause.

**`csp` iframe attribute (Chromium-only defense-in-depth):** The `<iframe csp="...">` attribute is supported in Chromium but not Firefox. Adding it adds defense-in-depth on Chrome at no cost. However, since the meta tag provides the same policy cross-browser, the `csp` attribute is optional. Do not add it if it causes TypeScript JSX type errors — React's iframe typings may not include it yet.

### Pattern 3: GameSlot Render Logic

**What:** The `GameSlot` component becomes a `'use client'` component to support the Convex `useMutation` call when validation fails.

**When to use:** On every issue page render where `game?.embedCode` is truthy.

```tsx
// apps/web/components/issue/GameSlot.tsx (Phase 7 replacement)
'use client'

import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { validateEmbedCode, injectCsp } from '@/lib/game-validator'
import { GameFallback } from './GameFallback'
import { useEffect, useRef } from 'react'

interface GameSlotProps {
  game: IssueGame
  runId: string | null  // from issue.runId — passed from the RSC page
}

export function GameSlot({ game, runId }: GameSlotProps) {
  const insertQaCorrection = useMutation(api.qaCorrections.insert)
  const reported = useRef(false)  // idempotency guard

  const validationResult = game?.embedCode
    ? validateEmbedCode(game.embedCode)
    : null

  const srcdoc = game?.embedCode && validationResult?.valid
    ? injectCsp(game.embedCode)
    : null

  // Write qaCorrections on validation failure — once per mount per issue
  useEffect(() => {
    if (
      !validationResult ||
      validationResult.valid ||
      reported.current ||
      !runId
    ) return
    reported.current = true
    insertQaCorrection({
      runId,
      sectionName: 'game',
      reason: validationResult.reason,
      severity: 'error',
      accepted: false,
      agentId: 'game-validator',
    }).catch(console.error)
  }, [validationResult, runId, insertQaCorrection])

  // ... section structure identical to Phase 2 ...
  return (
    <section id="game" ...>
      {/* ... label row, headline, description ... */}
      <div className="relative w-full overflow-hidden rounded ...">
        {srcdoc ? (
          <iframe
            sandbox="allow-scripts"
            srcDoc={srcdoc}
            title={game?.headline ?? 'Game'}
            className="absolute inset-0 h-full w-full border-none"
          />
        ) : game?.embedCode ? (
          <GameFallback />  {/* validation failed */}
        ) : (
          <div ...>Game coming soon.</div>  {/* no game this issue */}
        )}
      </div>
    </section>
  )
}
```

**Key architectural note:** `GameSlot` is currently a Server Component in Phase 2 (no `'use client'`). Converting it to a Client Component is required because `useMutation` is a React hook. The page component (`issue/[slug]/page.tsx`) is an RSC — it passes `game` and `runId` as props to the Client Component, which is the standard Next.js RSC/client component boundary pattern.

**The `runId` prop:** The issue page GROQ query (`§1.2`) already projects `"runId": pipelineMetadata.runId`. The `Issue` type in `types.ts` should already have this field — check `apps/web/lib/sanity/types.ts`. If it's missing from the `Issue` type, add `runId: string | null` to the `Issue` type (this is additive and does not affect the GROQ contract). Pass it from `page.tsx`: `<GameSlot game={issue.game} runId={issue.runId ?? null} />`.

### Pattern 4: GameFallback Component

**What:** A pure display component for the validation-failed state.

```tsx
// apps/web/components/issue/GameFallback.tsx
export function GameFallback() {
  return (
    <div className="flex h-full items-center justify-center px-8">
      <p className="text-center font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
        Game unavailable.
      </p>
    </div>
  )
}
```

**Voice note:** "Game unavailable." is the correct copy. Dry, precise. No "we're sorry," no "please try again," no exclamation mark.

### Pattern 5: GAM-03 Source-Scan Test

**What:** A Vitest test that reads the `GameSlot.tsx` source file and asserts `allow-same-origin` does not appear anywhere in it. This is a codebase-level tripwire.

```typescript
// apps/web/__tests__/game-sandbox.test.ts
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

describe('GAM-03: GameSlot sandbox security', () => {
  it('never contains allow-same-origin in any form', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/issue/GameSlot.tsx'),
      'utf-8',
    )
    expect(src).not.toContain('allow-same-origin')
  })
})
```

**Why a test, not ESLint:** ESLint has no config in `apps/web/`. Installing an ESLint plugin requires `eslint.config.js`, eslint itself, and parsing plugins. The Vitest source-scan achieves the same tripwire at far lower setup cost. If ESLint is introduced in a future phase, the rule can be added then; the test remains as a belt-and-suspenders guard.

### Anti-Patterns to Avoid

- **Parsing embedCode with DOMParser in the browser:** DOMParser runs client-side and would mean the browser partially evaluates the HTML before validation completes. Use string-match on the raw string server-side or at component-load time.
- **Calling `useMutation` on every render:** Use `useEffect` with a `ref` guard so the Convex write fires at most once per component mount, not on every re-render.
- **Passing `runId` as `undefined` to the Convex mutation:** The `runId` field is `v.string()` in the Convex schema — passing undefined will throw a Convex validation error. Guard with `if (!runId) return` before the mutation call.
- **`allow-same-origin` + `allow-scripts` together:** This combination defeats the sandbox entirely — the sandboxed page can remove its own `sandbox` attribute. The Phase 2 comment already says "DO NOT remove sandbox='allow-scripts'" but the test (GAM-03) is the machine-readable guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Convex write from frontend | Custom HTTP call to Convex API | `useMutation(api.qaCorrections.insert)` | Already has the correct auth; retry logic built in |
| Reading game data | Custom fetch | GROQ query already in `QUERY_ISSUE_BY_SLUG` | The `game` object is already fetched by the page |
| iframe mobile sizing | JavaScript resize observer | CSS `aspect-ratio` or fixed heights with `sm:` breakpoints | Already done in Phase 2 (`h-[280px] sm:h-[360px]`) |

---

## CSP Injection — Detailed Notes

### Recommended Directives (Confidence: HIGH)

```
default-src 'none';
script-src 'unsafe-inline';
style-src 'unsafe-inline';
img-src data:;
connect-src 'none';
frame-src 'none';
object-src 'none';
base-uri 'none';
form-action 'none';
```

**Rationale per directive:**

- `default-src 'none'`: deny-by-default. Any directive not explicitly listed falls back to `'none'`.
- `script-src 'unsafe-inline'`: The game IS inline JS. Cannot use nonces (content is dynamic LLM output). `'unsafe-inline'` is the required permission for the game to run at all.
- `style-src 'unsafe-inline'`: Same rationale — game CSS is inline `<style>` tags.
- `img-src data:`: Many simple HTML5 games encode sprites as base64 data URIs. Without this, images are blocked.
- `connect-src 'none'`: Blocks `fetch()`, `XMLHttpRequest`, `WebSocket`, `EventSource` — all outbound network requests. This is the key enforcement layer on top of the string-match validator.
- `frame-src 'none'`: Prevents nested iframes (defense-in-depth).
- `object-src 'none'`: Blocks Flash/plugin objects (not used in modern games, but defense-in-depth).
- `base-uri 'none'`: Prevents `<base href="...">` injection which could redirect relative URLs.
- `form-action 'none'`: Blocks form submission (the sandbox also blocks forms without `allow-forms`, but defense-in-depth).

**What `img-src data:` explicitly does NOT allow:** HTTP/HTTPS image URLs (`img-src 'none'` would block everything; `img-src data:` allows only data URIs). If a game needs external images, it will fail the connect-src policy and also the validator's `<link href=...>` check.

### Meta CSP Limitations

- Cannot use `frame-ancestors` (meta CSP limitation — frame-ancestors requires HTTP header). This is fine; we control the parent page.
- Cannot set CSP violation reporting endpoints (`report-uri`, `report-to`). Fine for v1.
- Must appear before any inline scripts to take effect — the `injectCsp` function injects after `<head>` which precedes any `<script>` tags in well-formed LLM output.
- If the LLM outputs malformed HTML without a `<head>`, the fallback prepends the meta tag before all content — still effective.

Sources:
- [MDN: Content-Security-Policy meta element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name)
- [content-security-policy.com frame-src](https://content-security-policy.com/frame-src/)
- [W3C CSP issue #700: srcdoc and CSP inheritance](https://github.com/w3c/webappsec-csp/issues/700)

---

## Mobile Responsiveness Approach

**Requirement (GAM-06):** Game renders correctly at ≥360px without horizontal scroll.

**What Phase 2 already sets:** `h-[280px] sm:h-[360px]` on the iframe container. The iframe is `width: 100%` via `w-full`. At 360px, the container is 360px wide, height 280px.

**The actual risk:** The game's internal HTML/CSS may have fixed pixel widths wider than 360px (e.g., `width: 800px` on a canvas element), which would create horizontal scroll WITHIN the iframe. The `overflow-hidden` on the container clips this, but the game would then be partially invisible — not "renders correctly."

**Mitigation approach:** Inject a viewport meta tag and a CSS reset into the srcdoc, in addition to the CSP meta tag:

```typescript
const GAME_HEAD_INJECTION = `
<meta http-equiv="Content-Security-Policy" content="${GAME_CSP_POLICY}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; overflow-x: hidden; max-width: 100%; }
  canvas, svg, img { max-width: 100% !important; height: auto; }
</style>
`.trim()
```

This injects into the srcdoc and prevents most fixed-width overflows. It does not solve games that use `canvas` with a hard-coded pixel width and redraw at that resolution (the game would be clipped). This is an accepted limitation — the GameWriter prompt can be updated separately to emit `width="100%"` on canvas elements.

**Automated validation of mobile rendering:** A full Playwright test that spins up a real browser at 360px, loads the game inside an iframe, and checks `scrollWidth <= 360` would be the gold standard. However:

1. Playwright is not installed in the project.
2. The game is LLM-generated per run — testing it statically is not possible without a live Sanity issue.
3. The Phase 5 smoke test (Plan 05-15) already exercised real GameWriter output and Andrew approved it.

**Decision:** Mobile responsiveness for Phase 7 is validated by:
1. The CSS injection above (automated, in-code)
2. A unit test that the `injectCsp` / `injectGameHead` function correctly injects the viewport meta and CSS reset
3. Andrew's manual smoke test on a real game render (already in the Phase 5 approval — Andrew reviewed the game section)

GAM-06 is satisfied by the CSS injection + the `overflow-hidden` container + Andrew's smoke test. Full Playwright e2e is deferred (no Playwright in the project).

---

## Convex Write Pattern

### Mutation Shape

The existing `convex/qaCorrections.ts` `insert` mutation accepts (from `convex/schema.ts` Phase 5 shape):

```typescript
{
  runId: v.string(),                    // REQUIRED — phase 7 passes issue.runId
  sectionName: v.string(),              // 'game'
  reason: v.string(),                   // the validator's rejection reason
  severity: v.union(v.literal('info'), v.literal('warning'), v.literal('error')),
  accepted: v.boolean(),                // false
  // optional Phase 5 fields:
  agentId: v.optional(v.string()),      // 'game-validator'
  axis: v.optional(v.union(...)),       // 'hard-rule'
  quotedSpan: v.optional(v.string()),   // the matched forbidden string
  suggestedFix: v.optional(v.string()), // not applicable; omit
}
```

Phase 7 will write:
```typescript
insertQaCorrection({
  runId,
  sectionName: 'game',
  reason: `Game validator rejected embedCode: ${validationResult.reason}`,
  severity: 'error',
  accepted: false,
  agentId: 'game-validator',
  axis: 'hard-rule',
  quotedSpan: undefined,  // omit — the pattern match doesn't preserve position
})
```

**Note on `fieldName`, `original`, `corrected`:** These are optional legacy fields (Phase 5 D-01 comment: "Phase 5 unused; legacy compat"). Do not pass them.

### Idempotency Strategy

The Convex `insert` mutation has no built-in dedup. A broken game will fail validation on every page load, potentially creating many `qaCorrections` rows for the same issue.

**Approach:** Use a React `useRef` flag inside the `GameSlot` component to ensure the mutation fires at most once per component mount. If the page is navigated away and back, the component unmounts and remounts — this creates at most one row per page visit, which is acceptable (the row is identical content and Andrew can ignore duplicates).

**Alternative considered:** Check if a `qaCorrections` row with `sectionName='game'` already exists for this `runId` before inserting. This would require a `useQuery` call to `qaCorrections.byRunId`, adding a loading state. The `useRef` approach is simpler and sufficient — Convex does not charge per row, and Andrew can filter the deliberation layer by type.

**Edge case:** `runId` may be `null` for issues authored manually in Sanity Studio without a pipeline run. In that case, skip the Convex write entirely (the guard `if (!runId) return` handles this). This matches the Phase 6 Publisher pattern for `run_id is None`.

### Convex from Client Component in Next.js App Router

The `ConvexClientProvider` is mounted in the root layout (Phase 3, Plan 03-05). Any `'use client'` component descending from it can use `useMutation`. The `GameSlot` component is nested inside the issue page layout which is inside the root layout — the provider is available.

Source: [Convex Next.js docs](https://docs.convex.dev/client/react/nextjs)

---

## Andrew Notification Approach

**What ROADMAP says:** "a fallback 'Game unavailable' placeholder appears when validation fails and Andrew is notified via Convex."

**What STATE.md says:** No specific notification mechanism decided. No Slack/email webhook decided.

**What Convex provides:** The `qaCorrections` table is already queryable by `runId`. Andrew views `qaCorrections` in the deliberation layer (Phase 9, DEL-02). The `severity='error'` + `sectionName='game'` rows are color-coded in the Phase 9 deliberation UI.

**For Phase 7:** The Convex write IS the notification mechanism. Andrew will see the `qaCorrections` row with `severity='error'` in the deliberation layer. No email/Slack integration is in scope for v1. This is consistent with how QA corrections work throughout the system.

**Recommendation:** The Convex `qaCorrections` row with `agentId='game-validator'`, `severity='error'`, and a human-readable reason IS the Andrew notification. Document this clearly in the component comment so Phase 9 knows to surface `agentId='game-validator'` rows distinctively in the deliberation UI.

---

## Validation Architecture (Nyquist Framework)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (to be installed) |
| Config file | `apps/web/vitest.config.ts` (Wave 0 gap) |
| Quick run command | `pnpm --filter apps/web test:unit` |
| Full suite command | `pnpm --filter apps/web test:unit --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAM-01 | iframe renders with `sandbox="allow-scripts"` and not `allow-same-origin` | Source-scan (Vitest) | `pnpm --filter apps/web test:unit game-sandbox` | ❌ Wave 0 |
| GAM-02 | Validator rejects each of the 10 banned patterns | Unit (Vitest) | `pnpm --filter apps/web test:unit game-validator` | ❌ Wave 0 |
| GAM-02 | CSP meta tag contains `connect-src 'none'` and `script-src 'unsafe-inline'` | Unit (Vitest) | Same as above | ❌ Wave 0 |
| GAM-03 | `allow-same-origin` does not appear in `GameSlot.tsx` source | Source-scan (Vitest) | `pnpm --filter apps/web test:unit game-sandbox` | ❌ Wave 0 |
| GAM-04 | `injectCsp` adds meta tag before first script in srcdoc | Unit (Vitest) | `pnpm --filter apps/web test:unit game-validator` | ❌ Wave 0 |
| GAM-05 | Validation failure shows `GameFallback` (not iframe) | Component render (manual smoke) | Manual Andrew smoke | N/A — manual |
| GAM-05 | `qaCorrections` Convex row written with correct shape on failure | Integration (manual smoke) | Manual Convex dashboard check | N/A — manual |
| GAM-06 | Game renders without horizontal scroll at 360px | Manual smoke test | Andrew smoke on real game | N/A — manual |

**Notes on manual tests:** GAM-05 (Convex write) and GAM-06 (mobile rendering) require a real browser + real Sanity data. They cannot be fully automated without Playwright. The smoke plan for Phase 7 should include Andrew loading an issue at 360px viewport width and confirming no horizontal scroll.

### Sampling Rate

- **Per task commit:** `pnpm --filter apps/web test:unit`
- **Per wave merge:** `pnpm --filter apps/web test:unit --reporter=verbose`
- **Phase gate:** All unit tests green + Andrew manual smoke before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/vitest.config.ts` — Vitest config (create in Wave 0 plan)
- [ ] `apps/web/__tests__/game-validator.test.ts` — unit tests for `validateEmbedCode` and `injectCsp`
- [ ] `apps/web/__tests__/game-sandbox.test.ts` — source-scan test for GAM-01 and GAM-03
- [ ] Framework install: `pnpm --filter apps/web add -D vitest @vitest/ui`

---

## GameSpec Shape (Confirmed from Codebase)

From `apps/web/lib/sanity/types.ts`:
```typescript
export type IssueGame = {
  headline: string
  description: string | null
  embedCode: string  // self-contained HTML/JS; may be a full <!DOCTYPE html> document
} | null
```

From `apps/studio/schemas/weeklyIssue.ts` (the Sanity schema `game` field):
```typescript
// game object fields:
// - headline: string (required)
// - description: string (optional)
// - embedCode: text (required) — "Self-contained HTML/JS. Must work inside a sandboxed iframe."
```

From `docs/API_CONTRACTS.md §7` (LangGraph DispatchState):
```typescript
class GameContent(TypedDict):
    headline: str
    description: str                    # 50-100 word a11y summary
    embedCode: str                      # self-contained HTML/JS for iframe srcdoc
```

**No `height` field exists.** The GameWriter does not emit a height. The container height is CSS-controlled by the `GameSlot` component (`h-[280px] sm:h-[360px]`).

---

## Runtime State Inventory

This phase is a frontend code change. No renames, no migrations.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 18+ | Next.js / Vitest | ✓ | Darwin 23.6.0 (verified) | — |
| pnpm | Package installation | ✓ | 9.15.4 (pinned) | — |
| Vitest | GAM-01, GAM-02, GAM-03 unit tests | ✗ | — | Jest (heavier) |
| Playwright | GAM-06 mobile smoke | ✗ | — | Manual smoke test |
| Convex dev deployment | Convex mutation testing | ✓ | modest-magpie-797 (dev) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- Vitest → Jest (prefer Vitest; lower setup cost)
- Playwright → Manual smoke (acceptable for Phase 7)

---

## Common Pitfalls

### Pitfall 1: Converting GameSlot to Client Component Breaks RSC Caching

**What goes wrong:** `GameSlot` is currently a pure RSC sub-component. Converting it to `'use client'` means its render happens client-side, adding a JS bundle payload.

**Why it happens:** `useMutation` is a React hook — hooks only work in Client Components.

**How to avoid:** This is unavoidable given the Convex write requirement. The impact is minimal — `GameSlot.tsx` is a leaf component; its conversion adds a small client bundle. The parent `page.tsx` remains a Server Component (it passes props to GameSlot). Next.js will code-split the client component automatically.

**Warning signs:** If you see "Error: Hooks can only be called inside a function component" — you forgot `'use client'`.

### Pitfall 2: `srcDoc` vs `srcdoc` in React

**What goes wrong:** The HTML attribute is `srcdoc` (lowercase), but React's JSX attribute is `srcDoc` (camelCase) — `<iframe srcDoc={...}>`.

**Why it happens:** React camelCases all HTML attributes. Using `srcdoc` (lowercase) in JSX silently fails in some React versions.

**How to avoid:** Always use `srcDoc={srcdoc}` in React JSX. The Phase 2 code already uses `srcDoc` correctly.

### Pitfall 3: Convex Mutation Called with `undefined` `runId`

**What goes wrong:** The `runId` Convex field is `v.string()` — passing `undefined` throws `ConvexError: Expected a string, got undefined`.

**Why it happens:** Issues authored manually in Sanity Studio without a pipeline run have `pipelineMetadata.runId = null`. The GROQ projection returns `null`, not a string.

**How to avoid:** Guard: `if (!runId) return` before calling `insertQaCorrection`. The component renders the fallback correctly regardless of whether the Convex write succeeds.

### Pitfall 4: CSP Meta Tag Injected After `<script>` Tag

**What goes wrong:** If the LLM outputs HTML where a `<script>` appears before the `<head>` element, the CSP meta tag injected after `<head>` may parse too late to apply to the first script.

**Why it happens:** Malformed LLM HTML output.

**How to avoid:** Inject the CSP meta tag at the very beginning of the document (before `<!DOCTYPE>`), then handle the `<head>` case as a refinement. Most browsers apply `<meta http-equiv="Content-Security-Policy">` retroactively if it appears before inline script execution, but this is not guaranteed. Prepending is safer.

**Revised injection:**
```typescript
export function injectCsp(embedCode: string): string {
  // Always prepend — browsers apply meta CSP at parse time, not DOM-order time
  return `${CSP_META}\n${embedCode}`
}
```

### Pitfall 5: `\btop\.` Regex Matches Too Broadly

**What goes wrong:** `\btop\.` matches `top.chart` in CSS like `margin-top.5rem` or property names containing "top".

**Why it happens:** Word boundary `\b` treats `.` as a boundary character, so `top.` in "margin-top.5rem" is actually `margin` / `top` / `.5rem` — `top` does not have a `\b` before `.5` because `.` is a non-word character.

**How to avoid:** Test the regex against expected game output patterns. Alternatively, check for `window.top` (already banned as string literal) and `top.location`, `top.document` specifically, rather than the generic `\btop\.`. Update the deny-list if false positives occur during smoke testing.

### Pitfall 6: React Strict Mode Double-Invokes Effects

**What goes wrong:** In development, React Strict Mode mounts → unmounts → remounts components, calling `useEffect` twice. The `useRef` flag is reset on remount, causing two Convex writes.

**Why it happens:** Strict Mode intentionally double-invokes effects to surface bugs.

**How to avoid:** Convex `insert` does not have a unique constraint on `(runId, sectionName)` — duplicate rows are written. Accept this in development. In production (Vercel), Strict Mode effects run once. Document in code comments.

---

## Open Questions

1. **`runId` field on `Issue` type:** The `QUERY_ISSUE_BY_SLUG` projection in `API_CONTRACTS.md §1.2` projects `"runId": pipelineMetadata.runId`, and the `Issue` type in `apps/web/lib/sanity/types.ts` should have this field. If it's absent from the TypeScript type (the file was read to line 100 only), add `runId: string | null` to the `Issue` type. Check the full `types.ts` file before writing code.
   - What we know: GROQ query projects `runId`; `Issue` type is hand-written.
   - What's unclear: Whether `runId` was included in the `Issue` type when it was written.
   - Recommendation: Check `apps/web/lib/sanity/types.ts` lines 100+ before Wave 1.

2. **Vitest config for `apps/web`:** Next.js 15 uses Turbopack (experimental) and the web app uses `moduleResolution: Bundler`. Vitest needs a config that handles the `@/*` path alias. A minimal `vitest.config.ts` with `resolve.alias` from `tsconfig.json` paths is needed.
   - What we know: TypeScript uses `"@/*": ["./*"]` and `"@convex/*": ["../../convex/*"]`.
   - Recommendation: Use `vite-tsconfig-paths` plugin in vitest config to pick up tsconfig paths automatically.

3. **`top.` and `parent.` pattern false positives:** The deny-list uses `\btop\.` and `\bparent\.` as regex patterns. CSS class names like `.parent-container` or `.top-bar` in the game's HTML might not trigger false positives (CSS class attributes are strings but not script identifiers), but `parent.node` in game-world variable names might. Test against actual GameWriter output (issue 999 was approved by Andrew — the embedCode from that run is a good test fixture).
   - Recommendation: During Wave 0, retrieve the Phase 5 smoke run's embedCode from Sanity and run it against the validator. Tune the patterns.

4. **`img-src data:` sufficiency:** If GameWriter starts generating games with SVG sprites encoded in `<use>` elements pointing to external URLs, the `img-src data:` policy would block them. The current `connect-src 'none'` also covers this.
   - Not blocking; note for Phase 9 if games evolve.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No iframe game (Phase 2 placeholder) | Sandboxed iframe with validated srcdoc (Phase 7) | Phase 7 | Game becomes interactive |
| Prompt-level defense only (Phase 5) | Prompt-level + validator + CSP (Phase 7) | Phase 7 | Defense-in-depth |

---

## Sources

### Primary (HIGH confidence)
- [MDN: iframe sandbox attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) — sandbox security model, allow-scripts behavior
- [content-security-policy.com](https://content-security-policy.com/) — CSP directive reference
- `apps/web/components/issue/GameSlot.tsx` — existing Phase 2 scaffolding (read directly)
- `apps/web/lib/sanity/types.ts` — `IssueGame` type definition (read directly)
- `packages/pipeline/src/eisenbalm_pipeline/agents/game.py` — `FORBIDDEN_CONSTRUCTS` constant (read directly)
- `convex/schema.ts` — `qaCorrections` table shape (read directly)
- `docs/API_CONTRACTS.md §1.2, §7` — GROQ projection + DispatchState (read directly)
- `.planning/phases/05-agent-quality/05-11-bonus-and-game-SUMMARY.md` — Phase 5 decisions on GameWriter (read directly)

### Secondary (MEDIUM confidence)
- [Convex Next.js App Router docs](https://docs.convex.dev/client/nextjs/app-router/server-rendering) — `useMutation` in client components
- [W3C CSP issue #700](https://github.com/w3c/webappsec-csp/issues/700) — srcdoc and CSP inheritance behavior
- [csplite.com test188](https://csplite.com/csp/test188/) — srcdoc not governed by frame-src

### Tertiary (LOW confidence, for validation)
- Web searches on iframe sandbox threat model (2024 sources)
- Mozilla Discourse discussions on allow-scripts vs allow-same-origin

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new major libraries; Convex already installed; Vitest is well-understood
- Architecture: HIGH — `GameSlot` path and Convex mutation shape confirmed from source
- Threat model: HIGH — confirmed from MDN authoritative source
- CSP directives: HIGH — confirmed from content-security-policy.com
- Pitfalls: MEDIUM — based on Next.js patterns and Convex docs; some scenarios may surface during execution

**Research date:** 2026-05-18
**Valid until:** 2026-08-18 (stable APIs; iframe sandbox and CSP are not fast-moving)
