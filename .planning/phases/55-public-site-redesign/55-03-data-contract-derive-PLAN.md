---
phase: 55-public-site-redesign
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/studio/schemas/weeklyIssue.ts
  - apps/studio/schema.json
  - apps/studio/sanity.types.ts
  - apps/web/lib/sanity/queries.ts
  - apps/web/lib/sanity/types.ts
  - docs/API_CONTRACTS.md
  - apps/web/__tests__/fixtures/issue.ts
  - apps/web/__tests__/groq-parity.test.ts
  - apps/web/lib/dispatch/derive.ts
  - apps/web/__tests__/dispatch-derive.test.ts
autonomous: true
requirements: [P55-SC1, P55-SC2, P55-SC3, PUB-06, PUB-11, PUB-12]

must_haves:
  truths:
    - "Andrew can author dek, ticker lines, pull quotes, case timeline, ad summary, hero image (with required alt) and impact unit in one optional frontPage object in Studio"
    - "selectionDeliberation.editorConfidence (0-1, optional) exists in the schema and both public GROQ queries"
    - "The published and preview issue queries stay identical except for the status filter"
    - "Every Scope-B block derives null/[] when its data is absent, so components omit it instead of showing a placeholder"
    - "Deliberation cards are Picked / Runner-up / Also considered from real Sanity data; confidence is null unless a finite 0-1 number exists (no 80% default)"
  artifacts:
    - path: "apps/studio/schemas/weeklyIssue.ts"
      provides: "frontPage object + selectionDeliberation.editorConfidence"
      contains: "name: 'frontPage'"
    - path: "apps/web/lib/sanity/queries.ts"
      provides: "QUERY_ISSUE_BY_SLUG + QUERY_ISSUE_PREVIEW_BY_SLUG projecting frontPage, editorConfidence, keyDataPoints"
      contains: "editorConfidence"
    - path: "apps/web/lib/dispatch/derive.ts"
      provides: "Pure derivations for every Scope-B block"
      exports: ["firstSentences", "tickerLines", "heroHeadline", "heroDek", "factChips", "keyFigure", "statTiles", "readTimeLabel", "deliberationCards", "editorConfidence", "caseTimeline", "adSummary", "pullQuote", "impactRange", "impactProgress", "balmsFromCents", "filterIssues", "backIssues", "issueDateLabel", "monthYearLabel"]
    - path: "apps/web/__tests__/fixtures/issue.ts"
      provides: "fullIssue, sparseIssue, longWordIssue, oneCandidateIssue, archiveIssues fixtures"
  key_links:
    - from: "apps/web/lib/sanity/queries.ts"
      to: "apps/studio/schemas/weeklyIssue.ts"
      via: "GROQ projection of new fields"
      pattern: "frontPage \\{"
    - from: "apps/web/lib/dispatch/derive.ts"
      to: "apps/web/lib/sanity/types.ts"
      via: "typed over Issue / ArchiveIssue"
      pattern: "from '@/lib/sanity/types'"
---

<objective>
Make the data the mockup needs exist and be typed: add the additive Sanity fields (`frontPage` editor-authored object, `selectionDeliberation.editorConfidence`), project them (plus `problemStatement.pdfContent.keyDataPoints`) in BOTH public issue queries, document them in API_CONTRACTS, and build the pure `lib/dispatch/derive.ts` that turns an issue into ready-to-render blocks — with test fixtures every later plan reuses.

Purpose: SC-3 (real deliberation data + confidence), SC-2 (no placeholder copy — absent data is omitted), SC-1 (content for every mockup block).
Output: schema + typegen, GROQ + types, API_CONTRACTS §55, fixtures, derive.ts + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@docs/API_CONTRACTS.md
@.planning/phases/55-public-site-redesign/55-RESEARCH.md
@apps/studio/schemas/weeklyIssue.ts
@apps/web/lib/sanity/queries.ts
@apps/web/lib/sanity/types.ts

<interfaces>
Existing (apps/web/lib/sanity/types.ts) — keep all existing names; ADD only:
```typescript
export type IssueKeyDataPoint = { stat: string; source: string | null }
export type IssueProblem = { headline: string; body: PortableTextBlock[]; keyDataPoints: IssueKeyDataPoint[] | null } | null
export type FrontPageRow = { label: string; value: string }
export type IssueFrontPage = {
  dek: string | null
  tickerLines: string[] | null
  pullQuotes: { origin: string | null; case: string | null } | null
  caseTimeline: FrontPageRow[] | null
  adSummary: { title: string | null; rows: FrontPageRow[] | null } | null
  heroImage: { url: string; alt: string | null; width: number | null; height: number | null } | null
  impactUnit: { label: string | null; costMinUsd: number | null; costMaxUsd: number | null } | null
} | null
// Issue: problemStatement becomes IssueProblem (superset of IssueSection); add `frontPage?: IssueFrontPage`
// IssueDeliberation: add `editorConfidence?: number | null` (keep `conversation` until Plan 12)
```

derive.ts contract this plan CREATES (consumed by plans 06–11):
```typescript
type FullIssue = NonNullable<Issue>
export type FactChip = { label: string; value: string }
export type StatTile = { figure: string | null; caption: string; source: string | null }
export type DelibCardKind = 'picked' | 'runner-up' | 'also'
export type DelibCard = { kind: DelibCardKind; name: string; location: string | null; blurb: string | null; score: number | null }
export type ImpactRange = { min: number; max: number; unit: string }
export function firstSentences(text: string | null | undefined, max?: number): string | null
export function tickerLines(issue: FullIssue): string[]
export function heroHeadline(issue: FullIssue): string
export function heroDek(issue: FullIssue): string | null
export function factChips(charity: FullIssue['charity']): FactChip[]
export function keyFigure(stat: string): { figure: string | null; caption: string }
export function statTiles(issue: FullIssue): StatTile[]
export function readTimeLabel(minutes: number): string
export function deliberationCards(issue: FullIssue): DelibCard[]
export function editorConfidence(issue: FullIssue): number | null
export function caseTimeline(issue: FullIssue): FrontPageRow[]
export function adSummary(issue: FullIssue): { title: string | null; rows: FrontPageRow[] } | null
export function pullQuote(issue: FullIssue, which: 'origin' | 'case'): string | null
export function impactRange(issue: FullIssue, priceCents: number): ImpactRange | null
export function impactProgress(balms: number, range: ImpactRange): number
export function balmsFromCents(cents: number, unitCents: number): number
export function filterIssues<T extends ArchiveIssue>(issues: T[], query: string): T[]
export function backIssues<T extends ArchiveIssue>(archive: T[], currentIssueNumber: number | null, limit?: number): T[]
export function issueDateLabel(publishDate: string | null | undefined): string | null
export function monthYearLabel(publishDate: string | null | undefined): string | null
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sanity schema additions + typegen + API_CONTRACTS §55</name>
  <files>apps/studio/schemas/weeklyIssue.ts, apps/studio/schema.json, apps/studio/sanity.types.ts, docs/API_CONTRACTS.md</files>
  <read_first>
    - apps/studio/schemas/weeklyIssue.ts (whole file; note the `// ─── Name ───` section-separator convention and the selectionDeliberation block ~L343)
    - docs/API_CONTRACTS.md §1.2 (L47–137), §2.2 (L304–437), §6 (L1721–1806) and the appended phase sections (e.g. "## Phase 26 — Review Gate", §37.2) for the append-a-phase-section convention
    - CLAUDE.md rule: no field renames; additive only; update API_CONTRACTS in the same plan
  </read_first>
  <action>
    1. weeklyIssue.ts — inside `selectionDeliberation.fields`, after `runnerUpNotes`, add:
       `defineField({ name: 'editorConfidence', title: "Editor's Confidence (0–1)", type: 'number', description: 'Editor Gate 1 confidence, written by the pipeline. Leave empty on older issues: the public confidence bar is hidden when empty.', validation: Rule => Rule.min(0).max(1) })`.
       Add a new top-level field after selectionDeliberation, preceded by `// ─── Front Page (editor-authored) ───…` separator:
       `defineField({ name: 'frontPage', title: 'Front Page (editor-authored)', type: 'object', description: 'Written by the editor in Studio. The pipeline never generates these fields; it carries this object forward unchanged when it re-runs this issue number, so your edits survive re-runs.', options: { collapsible: true, collapsed: true }, fields: [...] })` with fields:
       - `dek` text rows 2, description 'Hero sub-headline, at most two sentences. Overrides the mission statement.', validation `Rule.max(280)`
       - `tickerLines` array of `{ type: 'string' }`, description 'Replaces the derived ticker facts. Each fact must also appear on the page.', validation `Rule.max(8)`
       - `pullQuotes` object with `origin` (text rows 2) and `case` (text rows 2), description 'One line lifted verbatim from the section.'
       - `caseTimeline` array of object `{ label: string required, value: string required }` (preview select title label subtitle value), validation `Rule.max(4)`, description 'Up to four steps. The last step is shown as the result.'
       - `adSummary` object `{ title: string, rows: array of { label: string required, value: string required } max 4 }`, description 'Shown only when the bonus is a spec ad.'
       - `heroImage` image `options: { hotspot: true }`, fields `[defineField({ name: 'alt', title: 'Alt text', type: 'string', validation: Rule => Rule.custom((alt, ctx) => ((ctx.parent as { asset?: unknown } | undefined)?.asset && !alt ? 'Alt text is required when an image is set' : true)) })]`, description 'Optional photo. Without it the page uses the geometric accent artwork.'
       - `impactUnit` object `{ label: string, costMinUsd: number min 0, costMaxUsd: number min 0 }`, description 'What one unit of help costs, e.g. "wheelchair", 120, 180. Drives "About N to M balms covers one …".'
       Do not rename or remove any existing field (theme, conversation stay).
    2. Run `pnpm --filter studio typegen` to regenerate apps/studio/schema.json and apps/studio/sanity.types.ts. If the command fails for a non-code reason (auth/network), record the exact error in the SUMMARY and continue; the web app uses hand-written types.
    3. docs/API_CONTRACTS.md: (a) in §1.2's GROQ block add the three projections exactly as Task 2 writes them; (b) in §2.2 add `'editorConfidence': state['editor_confidence']  # Phase 55 — omitted when None/out of range` inside selectionDeliberation; (c) append a new section `## Phase 55 — Public Site Redesign` with: §55.1 `weeklyIssue.frontPage` shape (editor-authored; the pipeline never generates it, but `write_issue_draft` fetches `issue-N` and `drafts.issue-N` before `createOrReplace` and carries an existing frontPage forward, draft preferred, so edits survive re-runs; a lookup failure logs a warning and writes without it); §55.2 `selectionDeliberation.editorConfidence` (number 0–1, optional, pipeline-written; web hides bar when absent); §55.3 Convex public query `stripeOrders:balmsForCharity({ charitySlug: string, sinceMs?: number }) -> { orders: number; balms: number; donationCents: number }` (aggregates only, no PII; balms = Σ round((donationAmount ?? amountSubtotal ?? amountTotal ?? 0) / 899)); §55.4 Convex public mutation `emailSubscribers:subscribeNewsletter({ email, unsubscribeToken, webhookSecret }) -> null` (requireWebhookSecret lane, source 'newsletter-optin', idempotent, preserves prior unsubscribe); §55.5 `POST /api/email/subscribe` body `{ email: string, company?: string }` -> 200 `{ ok: true }` (also for honeypot hits, no enumeration) | 400 `{ ok: false, error: 'invalid-email' }` | 500 `{ ok: false, error: 'misconfigured' }` | 502 `{ ok: false, error: 'unavailable' }`; §55.6 `/` renders the latest issue front page (no redirect; supersedes §1.1 "homepage redirect target" wording) with canonical `/issue/<slug>`.
  </action>
  <verify>
    <automated>grep -n "name: 'frontPage'" apps/studio/schemas/weeklyIssue.ts && grep -n "name: 'editorConfidence'" apps/studio/schemas/weeklyIssue.ts && grep -n "## Phase 55" docs/API_CONTRACTS.md && pnpm --filter studio exec tsc --noEmit -p . 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "name: 'frontPage'" apps/studio/schemas/weeklyIssue.ts` returns 1
    - `grep -c "name: 'editorConfidence'" apps/studio/schemas/weeklyIssue.ts` returns 1
    - `grep -n "name: 'conversation'" apps/studio/schemas/weeklyIssue.ts` still matches (no removals)
    - `grep -n "balmsForCharity" docs/API_CONTRACTS.md` and `grep -n "subscribeNewsletter" docs/API_CONTRACTS.md` and `grep -n "/api/email/subscribe" docs/API_CONTRACTS.md` all match
    - `grep -n "frontPage" apps/studio/schema.json` matches (or SUMMARY records the typegen failure verbatim)
    - `grep -n "survive re-runs" apps/studio/schemas/weeklyIssue.ts` matches and `grep -c "replaces the whole document" apps/studio/schemas/weeklyIssue.ts` returns 0
    - `grep -n "carries an existing frontPage forward" docs/API_CONTRACTS.md` matches
  </acceptance_criteria>
  <done>Studio schema has both additive fields; contracts documented in API_CONTRACTS §55 and §1.2/§2.2.</done>
</task>

<task type="auto">
  <name>Task 2: GROQ projections + web types + shared fixtures + parity test</name>
  <files>apps/web/lib/sanity/queries.ts, apps/web/lib/sanity/types.ts, apps/web/__tests__/fixtures/issue.ts, apps/web/__tests__/groq-parity.test.ts</files>
  <read_first>
    - apps/web/lib/sanity/queries.ts (QUERY_ISSUE_BY_SLUG and QUERY_ISSUE_PREVIEW_BY_SLUG — intentionally identical except the status filter)
    - apps/web/lib/sanity/types.ts
    - apps/web/__tests__/preview-route.test.ts L85–128 (existing preview-query invariants that must stay green)
    - apps/web/__tests__/narrator-chip.test.ts (narrator projection must remain name, slug, active only)
  </read_first>
  <action>
    1. In BOTH queries make identical edits:
       - replace `problemStatement { headline, body },` with `problemStatement { headline, body, "keyDataPoints": pdfContent.keyDataPoints[]{ stat, source } },`
       - inside `selectionDeliberation { … }` add `editorConfidence,` after `runnerUpNotes,` (keep `conversation[] { speaker, text },` — removed in Plan 12)
       - after the selectionDeliberation block add:
       ```
       frontPage {
         dek,
         tickerLines,
         pullQuotes { origin, case },
         caseTimeline[] { label, value },
         adSummary { title, rows[] { label, value } },
         "heroImage": select(defined(heroImage.asset) => {
           "url": heroImage.asset->url,
           "alt": heroImage.alt,
           "width": heroImage.asset->metadata.dimensions.width,
           "height": heroImage.asset->metadata.dimensions.height
         }, null),
         impactUnit { label, costMinUsd, costMaxUsd },
       },
       ```
       Do not touch narrator, theme or other projections.
    2. types.ts: add the types from <interfaces>; change `Issue.problemStatement` to `IssueProblem`; add `frontPage?: IssueFrontPage` to Issue; add `editorConfidence?: number | null` to IssueDeliberation.
    3. apps/web/__tests__/fixtures/issue.ts (NOT a *.test file): export `fullIssue: NonNullable<Issue>` (issueNumber 2, publishDate '2026-10-15', bonusType 'specAd', charity { name 'Acme Mobility Cooperative', slug 'acme-mobility-cooperative', location 'Dayton, Ohio', website, foundingYear 1998, assetRange '$100K–$500K', focusArea 'Wheelchair repair', missionStatement 'Acme repairs wheelchairs for people who cannot wait. It has done so since 1998. It intends to continue.' }, originStory/founderBio/caseStudy with headline + 2 Portable Text blocks each (use `{ _type: 'block', _key, style: 'normal', markDefs: [], children: [{ _type: 'span', _key, text, marks: [] }] }`), problemStatement with 3 keyDataPoints [`{ stat: '42% of chairs wait over 90 days for repair', source: 'Survey 2025' }`, `{ stat: '$1,200 average repair cost', source: null }`, `{ stat: 'Most repair shops closed in the last decade', source: null }`], game { headline 'Wheel Fix', description, embedCode '<!doctype html><html><body><canvas></canvas></body></html>' }, bonus specAd, podcast with audioUrl null, selectionDeliberation with 4 candidates (winner slug = charity slug, scores 9,7,6,null; runner-up with name 'Second Street Pantry'), editorDecision 'Acme was selected. The others were also good.', runnerUpNotes 'Second Street Pantry came close. It will be reconsidered.', editorConfidence 0.8, frontPage fully populated incl. caseTimeline 4 rows, adSummary 3 rows, impactUnit { label 'wheelchair', costMinUsd 120, costMaxUsd 180 }, heroImage null); `sparseIssue` (all optional sections null, selectionDeliberation null, frontPage undefined, charity optional fields null); `longWordIssue` (fullIssue with charity name 'Pneumonoultramicroscopicsilicovolcanoconiosis Mobilization Collective' and origin headline containing a 40-char word); `oneCandidateIssue` (only the winner candidate, editorConfidence undefined); `archiveIssues: ArchiveIssue[]` with 10 entries, issueNumber 1..10 descending order, varied focusArea/location.
    4. apps/web/__tests__/groq-parity.test.ts: import both queries; normalise each (strip `//…` line comments, collapse whitespace); assert `normalise(published).replace(' && status == "published"', '') === normalise(preview)`; assert both contain `editorConfidence`, `frontPage {`, `"keyDataPoints": pdfContent.keyDataPoints[]`, `heroImage.alt`; assert the narrator projection is still exactly `narrator-> { name, "slug": slug.current, active, }` (whitespace-normalised).
  </action>
  <verify>
    <automated>pnpm --filter web test -- groq-parity preview-route narrator-chip && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "editorConfidence" apps/web/lib/sanity/queries.ts` returns 2
    - `grep -c "frontPage {" apps/web/lib/sanity/queries.ts` returns 2
    - `grep -c "keyDataPoints" apps/web/lib/sanity/queries.ts` returns 2
    - `grep -n "export type IssueFrontPage" apps/web/lib/sanity/types.ts` matches
    - `pnpm --filter web test -- groq-parity preview-route narrator-chip` exits 0 and `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>Both public queries project the new data identically; types and fixtures are in place for all later plans.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: lib/dispatch/derive.ts pure derivations (TDD)</name>
  <files>apps/web/lib/dispatch/derive.ts, apps/web/__tests__/dispatch-derive.test.ts</files>
  <read_first>
    - apps/web/__tests__/fixtures/issue.ts (just written)
    - apps/web/components/issue/IssueLayout.tsx (existing candidate sort: winner first, then advocateScore desc — reproduce)
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Scope-B Content Classification" and §"Deliberation data"
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Deliberation summary cards" and §"Interaction and State Contract" (back-issues search)
  </read_first>
  <behavior>
    - firstSentences('A. B. C.', 1) === 'A.'; firstSentences('Acme Inc. repairs chairs. It is old.', 1) === 'Acme Inc. repairs chairs.'; firstSentences('no period here', 1) === 'no period here'; firstSentences('   ', 1) === null; firstSentences(null) === null; abbreviations e.g., i.e., Inc., Co., Corp., Ltd., St., Dr., Mr., Mrs., Ms., U.S., No., vs., etc. never split
    - tickerLines(fullIssue) === fullIssue.frontPage.tickerLines (trimmed, empties dropped, max 8); tickerLines(issue without frontPage) === ['This week: {name}', focusArea, location, 'Founded {year}', up to 3 keyDataPoints stats] with nulls dropped; never contains TICKER constant (component appends it)
    - heroHeadline: originStory.headline trimmed, else charity.name
    - heroDek: frontPage.dek trimmed, else firstSentences(missionStatement, 2), else null
    - factChips order What they do (focusArea) · Size (assetRange) · Based in (location) · Founded (String(foundingYear)); null fields omitted; sparseIssue -> only 'Based in'
    - keyFigure('42% of chairs wait over 90 days') -> { figure: '42%', caption: 'of chairs wait over 90 days' }; keyFigure('$1,200 average repair cost') -> { figure: '$1,200', caption: 'average repair cost' }; keyFigure('$1.2 billion in deferred repairs') -> figure '$1.2 billion' is > 8 chars so { figure: null, caption: whole stat }; keyFigure('Most shops closed') -> { figure: null, caption: 'Most shops closed' }
    - statTiles max 3, [] when keyDataPoints null
    - readTimeLabel(0) === '1-minute read'; readTimeLabel(7.4) === '7-minute read'
    - deliberationCards(fullIssue): [picked(name=charity.name, blurb='Acme was selected.'), runner-up(name='Second Street Pantry', blurb=firstSentences(runnerUpNotes,2)), also, also]; oneCandidateIssue -> [picked] only; sparseIssue -> []; candidates whose charity is null are skipped; max 4 'also' cards; missing runnerUpNotes -> runner-up blurb null
    - editorConfidence: 0.8 -> 0.8; undefined/null/NaN/1.5/-0.1 -> null
    - caseTimeline max 4 with empty label/value rows dropped; adSummary null unless bonusType === 'specAd' and (title or ≥1 row); pullQuote trimmed or null
    - impactRange(fullIssue, 899) -> { min: 14, max: 21, unit: 'wheelchair' } (ceil(12000/899)=14, ceil(18000/899)=21); null when label empty, costMin <= 0, costMax < costMin, or impactUnit absent
    - impactProgress(7, {min:14,…}) === 0.5; impactProgress(40, …) === 1; never < 0
    - balmsFromCents(1798, 899) === 2; balmsFromCents(-5, 899) === 0
    - filterIssues(archiveIssues, '') returns all; matches case-insensitively and trimmed on charity.name, focusArea, location; '3', 'no. 3', 'No.3', '#3' each return exactly the issue numbered 3
    - backIssues(archiveIssues, 10) excludes issue 10, returns at most 8, newest first
    - issueDateLabel('2026-10-15') === 'Thursday, October 15, 2026' (UTC); monthYearLabel('2026-10-15') === 'October 2026'; invalid -> null
  </behavior>
  <action>
    RED: write apps/web/__tests__/dispatch-derive.test.ts covering every behaviour, importing fixtures from './fixtures/issue'; run, confirm failure.
    GREEN: implement apps/web/lib/dispatch/derive.ts to the <interfaces> contract. Implementation notes:
    - firstSentences: protect abbreviations by replacing their dots with a sentinel (`\u0000`) before splitting on `/(?<=[.?!])\s+(?=[A-Z0-9"“(])/`, restore after; join first `max` (default 1) sentences.
    - keyFigure: regex `/^\s*([~≈]?[$€£]?\d[\d,.]*\s?(?:%|percent|million|billion|thousand|[kKmMbB]\b)?)\s+(.+)$/`; figure trimmed; if figure.length > 8 return `{ figure: null, caption: stat.trim() }`.
    - deliberationCards: filter candidates with `c.charity?.name`; winner = candidate whose `charity.slug === issue.charity.slug`; others sorted by `advocateScore ?? -Infinity` desc. Return [] when there are no candidates AND no editorDecision. Picked card always uses `issue.charity.name` / `issue.charity.location`, blurb `firstSentences(editorDecision, 1)`, score = winner?.advocateScore ?? null. No literal 80 anywhere in the file.
    - issueDateLabel/monthYearLabel: `new Date(publishDate + (publishDate.length === 10 ? 'T00:00:00Z' : ''))`, `toLocaleDateString('en-US', { …, timeZone: 'UTC' })`; NaN -> null.
    - No React, no fetches, no imports other than '@/lib/sanity/types' (types only). File comment: "Pure derivations. Every function returns null/[] when data is absent so components omit the block (never a placeholder)."
  </action>
  <verify>
    <automated>pnpm --filter web test -- dispatch-derive && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test -- dispatch-derive` exits 0
    - `grep -c "export function" apps/web/lib/dispatch/derive.ts` >= 20
    - `grep -cE "\\b80\\b" apps/web/lib/dispatch/derive.ts` returns 0
    - `grep -cE "from 'react'|fetch\\(" apps/web/lib/dispatch/derive.ts` returns 0
  </acceptance_criteria>
  <done>All Scope-B derivations are pure, fully tested against full/sparse/long-word/one-candidate fixtures.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test` full suite green; `pnpm --filter web typecheck` clean
- Studio schema change is additive (`git diff apps/studio/schemas/weeklyIssue.ts` shows only additions)
- Deployment of the Studio schema is NOT done here — Plan 13 checkpoint
</verification>

<success_criteria>
New fields exist in schema, GROQ (both queries), types and API_CONTRACTS; derive.ts green; fixtures available for Wave 2.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-03-SUMMARY.md`
</output>
