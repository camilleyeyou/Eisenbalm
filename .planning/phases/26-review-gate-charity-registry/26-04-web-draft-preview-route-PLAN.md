---
phase: 26-review-gate-charity-registry
plan: 04
type: execute
wave: 2
depends_on: [26-01]
files_modified:
  - apps/web/lib/sanity/preview-client.ts
  - apps/web/lib/sanity/queries.ts
  - apps/web/lib/preview-token.ts
  - apps/web/app/issue/[slug]/preview/page.tsx
  - apps/web/next.config.ts
  - apps/web/.env.example
  - apps/web/__tests__/preview-route.test.ts
autonomous: true
requirements: [RVW-02]
user_setup:
  - service: vercel-apps-web
    why: "Draft-preview route needs server-only Sanity read token + HMAC secret + allowed iframe origin"
    env_vars:
      - name: SANITY_API_TOKEN
        source: "Sanity manage → API → Tokens (read-only Viewer token)"
      - name: PREVIEW_SECRET
        source: "Shared HMAC secret — must match dispatch-control PREVIEW_SECRET"
      - name: PREVIEW_ALLOWED_ORIGIN
        source: "Production dispatch-control origin (+ http://localhost:3001 for dev)"

must_haves:
  truths:
    - "GET /issue/[slug]/preview returns the full Phase 19 magazine layout rendered from the Sanity DRAFT (no published-status filter)"
    - "The preview route verifies a 5-minute HMAC token and returns 401 for a missing or invalid token"
    - "The route reads Sanity with the previewDrafts perspective using a server-only token client (token never reaches the browser)"
    - "A frame-ancestors CSP is emitted ONLY for the preview route, scoped to PREVIEW_ALLOWED_ORIGIN; public issue pages are unaffected"
  artifacts:
    - path: "apps/web/app/issue/[slug]/preview/page.tsx"
      provides: "Token-guarded draft preview of the issue"
    - path: "apps/web/lib/preview-token.ts"
      provides: "HMAC verify (shared formula with dispatch-control generator)"
      exports: ["verifyPreviewToken", "previewToken"]
    - path: "apps/web/lib/sanity/preview-client.ts"
      provides: "Server-only previewDrafts Sanity client"
      exports: ["sanityPreviewClient"]
  key_links:
    - from: "preview/page.tsx"
      to: "verifyPreviewToken"
      via: "401 on invalid token before any Sanity read"
      pattern: "verifyPreviewToken"
    - from: "next.config.ts headers()"
      to: "/issue/:slug/preview"
      via: "frame-ancestors CSP scoped to PREVIEW_ALLOWED_ORIGIN"
      pattern: "frame-ancestors"
    - from: "preview/page.tsx"
      to: "sanityPreviewClient (previewDrafts)"
      via: "QUERY_ISSUE_PREVIEW_BY_SLUG (no status filter)"
      pattern: "previewDrafts"
---

<objective>
Add the token-guarded draft-preview route on `apps/web` that the dispatch-control review screen iframes (D-09). It renders the exact Phase 19 magazine component tree from the Sanity DRAFT (`previewDrafts` perspective, no `status == "published"` filter), gated by a 5-minute HMAC token, and emits a per-route `frame-ancestors` CSP so only the dashboard origin can embed it.

Purpose: The review gate's headline value is fidelity — the operator must see exactly what ships. Re-rendering in the dashboard would drift from `apps/web`; iframing the real page is true WYSIWYG.
Output: server-only previewDrafts client, HMAC verifier, the preview route, per-route CSP, env documentation, green preview tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-review-gate-charity-registry/26-CONTEXT.md
@.planning/phases/26-review-gate-charity-registry/26-RESEARCH.md
@CLAUDE.md

<interfaces>
<!-- Existing apps/web pieces to reuse. -->
apps/web/app/issue/[slug]/page.tsx — Phase 19 published issue page; imports sanityClient + QUERY_ISSUE_BY_SLUG, renders the 14-node component tree (IssueMasthead, IssueBriefing, MissionBand, EditorialSection, CaseStudySection, GameSlot, BonusSection, DeliberationSlot, PodcastSlot, ShopBand). The preview page renders the SAME tree.
apps/web/lib/sanity/client.ts — sanityClient (useCdn:true). SANITY_PROJECT_ID/SANITY_DATASET/SANITY_API_VERSION exported. createClient from '@sanity/client'.
apps/web/lib/sanity/queries.ts — QUERY_ISSUE_BY_SLUG filters `status == "published"`. The preview needs a sibling query WITHOUT that filter.
apps/web/next.config.ts — NextConfig with no headers() today; serverExternalPackages + images already configured. Add headers() additively.

<!-- HMAC contract (must match dispatch-control generator in Plan 26-05):
token = HMAC_SHA256(PREVIEW_SECRET, `${runId}:${slug}:${floor(Date.now()/300000)}`).hex
5-minute sliding window — verify accepts current AND previous window (clock skew). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: HMAC token lib + server-only previewDrafts client + no-filter preview query</name>
  <read_first>
    - apps/web/lib/sanity/client.ts (createClient config — replicate projectId/dataset/apiVersion; preview client adds token + perspective + useCdn:false)
    - apps/web/lib/sanity/queries.ts (QUERY_ISSUE_BY_SLUG — copy its field projection EXACTLY, only removing the `&& status == "published"` clause)
    - .planning/phases/26-review-gate-charity-registry/26-RESEARCH.md (Pattern 1 token formula + previewDrafts client + Pitfall 1 no-filter query)
  </read_first>
  <action>
1. Create `apps/web/lib/preview-token.ts` (server-only — imports node crypto):
   - `export function previewToken(secret, runId, slug, windowMs = Date.now()): string` — `createHmac('sha256', secret).update(`${runId}:${slug}:${Math.floor(windowMs/300000)}`).digest('hex')`.
   - `export function verifyPreviewToken(token, runId, slug): boolean` — read `process.env.PREVIEW_SECRET`; return false when secret or token absent. Compare token against the current window AND the previous window (`now` and `now - 300000`) using `crypto.timingSafeEqual` (guard equal length first). Returns true on either window match.

2. Create `apps/web/lib/sanity/preview-client.ts` with a top comment "SERVER ONLY — never import from a 'use client' component (carries SANITY_API_TOKEN)":
   ```ts
   import { createClient } from '@sanity/client'
   import { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION } from './client'
   export const sanityPreviewClient = createClient({
     projectId: SANITY_PROJECT_ID || 'placeholder',
     dataset: SANITY_DATASET,
     apiVersion: SANITY_API_VERSION,
     useCdn: false,
     token: process.env.SANITY_API_TOKEN,
     perspective: 'previewDrafts',
   })
   ```

3. In `apps/web/lib/sanity/queries.ts` add `QUERY_ISSUE_PREVIEW_BY_SLUG` — byte-copy QUERY_ISSUE_BY_SLUG's projection but filter `*[_type == "weeklyIssue" && slug.current == $slug][0] { ...same projection... }` (NO status filter — Pitfall 1). Keep QUERY_ISSUE_BY_SLUG unchanged.
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && test -f apps/web/lib/preview-token.ts && test -f apps/web/lib/sanity/preview-client.ts && grep -q "verifyPreviewToken" apps/web/lib/preview-token.ts && grep -q "timingSafeEqual" apps/web/lib/preview-token.ts && grep -q "previewDrafts" apps/web/lib/sanity/preview-client.ts && grep -q "QUERY_ISSUE_PREVIEW_BY_SLUG" apps/web/lib/sanity/queries.ts && echo PREVIEW_LIB_OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "timingSafeEqual" apps/web/lib/preview-token.ts` succeeds (constant-time compare)
    - `grep -q "now - 300000\|300000" apps/web/lib/preview-token.ts` succeeds (sliding window)
    - `grep -q "perspective: 'previewDrafts'" apps/web/lib/sanity/preview-client.ts` succeeds
    - `grep -q "SERVER ONLY" apps/web/lib/sanity/preview-client.ts` succeeds
    - QUERY_ISSUE_PREVIEW_BY_SLUG exists and has NO `status == "published"` substring within its body (verify by reading)
    - QUERY_ISSUE_BY_SLUG still filters published (unchanged)
  </acceptance_criteria>
  <done>HMAC verify, server-only previewDrafts client, and a no-filter preview query exist.</done>
</task>

<task type="auto">
  <name>Task 2: Create the preview route page (token gate + draft render)</name>
  <read_first>
    - apps/web/app/issue/[slug]/page.tsx (the FULL Phase 19 page — the preview page imports the same component tree and renders identically; only the data client + query differ and the published-only generateStaticParams/metadata are omitted)
    - apps/web/lib/preview-token.ts (verifyPreviewToken from Task 1)
    - apps/web/lib/sanity/preview-client.ts (sanityPreviewClient from Task 1)
    - apps/web/lib/sanity/queries.ts (QUERY_ISSUE_PREVIEW_BY_SLUG)
  </read_first>
  <action>
Create `apps/web/app/issue/[slug]/preview/page.tsx` — a Server Component. Add `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` (preview must never be cached/ISR'd).

1. Read `searchParams` for `token` and `runId` (Next 15 async params/searchParams — await them).
2. Call `verifyPreviewToken(token, runId, slug)`. If false → render a minimal 401 response: use Next's `notFound()` is NOT right (that is 404). Instead return a `<main>` with status text "Unauthorized preview request." AND set the status to 401 via a route segment — simplest: import `{ unauthorized }` is unstable; so render an explicit 401 by throwing in a wrapper is awkward. Use this approach: export a tiny boolean gate and render `<PreviewUnauthorized />` (a small inline component returning the 401 copy) while ALSO ensuring tests can assert the gate — keep the token check as the first statement and return the unauthorized UI early. (The acceptance test asserts the file contains the verify call before any sanity fetch and that an unauthorized branch exists.)
3. On valid token: `const issue = await sanityPreviewClient.fetch(QUERY_ISSUE_PREVIEW_BY_SLUG, { slug })`. If null → render "Preview unavailable. The draft issue may not be ready yet." (the UI-SPEC error copy).
4. Render the SAME component tree as the published page (import the identical components and lay them out in the identical section order). Reuse the published page's render body — extract it into a shared `IssueLayout` component the published page also uses, OR duplicate the JSX faithfully. PREFER extracting a shared `apps/web/components/issue/IssueLayout.tsx` that both `page.tsx` and `preview/page.tsx` import, so the preview can never drift (D-09 fidelity). If extracting, update the published page to use it (byte-equivalent render).
5. Do NOT emit generateMetadata/generateStaticParams on the preview route (drafts are not indexed). Add `<meta name="robots" content="noindex,nofollow">` to the preview head.
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && test -f "apps/web/app/issue/[slug]/preview/page.tsx" && grep -q "verifyPreviewToken" "apps/web/app/issue/[slug]/preview/page.tsx" && grep -q "QUERY_ISSUE_PREVIEW_BY_SLUG" "apps/web/app/issue/[slug]/preview/page.tsx" && grep -q "force-dynamic" "apps/web/app/issue/[slug]/preview/page.tsx" && pnpm --filter web typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/web/app/issue/[slug]/preview/page.tsx` exists
    - `grep -q "verifyPreviewToken" "apps/web/app/issue/[slug]/preview/page.tsx"` succeeds and the call precedes any `sanityPreviewClient.fetch` (verify by reading order)
    - `grep -q "force-dynamic" "apps/web/app/issue/[slug]/preview/page.tsx"` succeeds (no caching)
    - `grep -q "noindex" "apps/web/app/issue/[slug]/preview/page.tsx"` succeeds
    - An unauthorized branch exists (grep for "Unauthorized" or the 401 copy)
    - `pnpm --filter web typecheck` exits 0
    - If IssueLayout extracted: `apps/web/app/issue/[slug]/page.tsx` imports the same IssueLayout (fidelity preserved)
  </acceptance_criteria>
  <done>The preview route renders the real magazine layout from the Sanity draft, gated by the HMAC token.</done>
</task>

<task type="auto">
  <name>Task 3: Per-route frame-ancestors CSP + env docs + green preview tests</name>
  <read_first>
    - apps/web/next.config.ts (current NextConfig — add a headers() async function additively; do NOT change serverExternalPackages/images)
    - apps/web/.env.example (add the three new env vars with comments)
    - apps/web/__tests__/preview-route.test.ts (the Wave 0 skip-guarded test from Plan 26-01 — un-skip and implement assertions)
    - .planning/phases/26-review-gate-charity-registry/26-RESEARCH.md (Pattern 1 CSP block + Pitfall 2 per-route only)
  </read_first>
  <action>
1. In `apps/web/next.config.ts` add an `async headers()` returning a single entry scoped to the preview route:
   ```ts
   async headers() {
     const origin = process.env.PREVIEW_ALLOWED_ORIGIN ?? "'self'"
     return [
       {
         source: '/issue/:slug/preview',
         headers: [
           { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${origin}` },
         ],
       },
     ]
   }
   ```
   Place it inside the existing nextConfig object. Do NOT add any global frame-ancestors (Pitfall 2 — public pages must stay unembeddable by default).

2. In `apps/web/.env.example` add:
   ```
   # Phase 26 — draft-preview route (server-only). Read-only Sanity token.
   SANITY_API_TOKEN=
   # Phase 26 — HMAC secret shared with dispatch-control for preview tokens.
   PREVIEW_SECRET=
   # Phase 26 — dispatch-control origin allowed to iframe the preview (comma OK for dev localhost:3001).
   PREVIEW_ALLOWED_ORIGIN=
   ```

3. Un-skip / fill `apps/web/__tests__/preview-route.test.ts` (vitest):
   - Assert `apps/web/app/issue/[slug]/preview/page.tsx` exists (fs).
   - Assert the preview page source contains `verifyPreviewToken` and does NOT contain `status == "published"`.
   - Assert `next.config.ts` source contains a `headers()` block with `frame-ancestors` and the `/issue/:slug/preview` source.
   - Unit-test the token round-trip: `verifyPreviewToken(previewToken(secret, runId, slug), runId, slug)` is true with `PREVIEW_SECRET` set in the test env; and a tampered token is false. (Import from apps/web/lib/preview-token.ts; set process.env.PREVIEW_SECRET in the test.)
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && grep -q "frame-ancestors" apps/web/next.config.ts && grep -q "PREVIEW_SECRET" apps/web/.env.example && pnpm --filter web test:unit -- --run preview-route 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "frame-ancestors" apps/web/next.config.ts` succeeds AND it is scoped to `/issue/:slug/preview` (verify source string present)
    - No global frame-ancestors: the headers() entry has exactly one source `/issue/:slug/preview` (read to confirm)
    - `grep -q "SANITY_API_TOKEN" apps/web/.env.example && grep -q "PREVIEW_ALLOWED_ORIGIN" apps/web/.env.example` succeed
    - `pnpm --filter web test:unit -- --run preview-route` exits 0 with the token round-trip + source-scan assertions PASSING (not skipped)
    - `pnpm --filter web build` exits 0 (route + headers compile)
  </acceptance_criteria>
  <done>The preview route is the only route with a frame-ancestors CSP; env documented; preview tests pass.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web typecheck` + `pnpm --filter web build` exit 0.
- `pnpm --filter web test:unit -- --run preview-route` green (no skips).
- Preview route renders draft layout, token-gated, with previewDrafts perspective.
- frame-ancestors CSP present ONLY on the preview route.
</verification>

<success_criteria>
- The operator's iframe shows exactly what ships (real Phase 19 layout from the draft).
- Invalid/missing token → 401; valid token within 5 min → full preview.
- Public issue pages remain unembeddable (no global frame-ancestors).
</success_criteria>

<output>
After completion, create `.planning/phases/26-review-gate-charity-registry/26-04-SUMMARY.md`.
</output>
