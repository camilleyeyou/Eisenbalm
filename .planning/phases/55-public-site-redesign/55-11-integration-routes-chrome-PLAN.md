---
phase: 55-public-site-redesign
plan: 11
type: execute
wave: 3
depends_on: [55-06, 55-07, 55-08, 55-09, 55-10]
files_modified:
  - apps/web/components/issue/IssueLayout.tsx
  - apps/web/app/page.tsx
  - apps/web/app/issue/[slug]/layout.tsx
  - apps/web/app/issue/[slug]/page.tsx
  - apps/web/app/issue/[slug]/preview/page.tsx
  - apps/web/app/issue/[slug]/loading.tsx
  - apps/web/app/layout.tsx
  - apps/web/__tests__/issue-front-page.test.tsx
  - apps/web/__tests__/home-page.test.ts
  - apps/web/__tests__/fund-cta-wiring.test.ts
  - apps/web/__tests__/issue-page-dispatch.test.ts
  - apps/web/__tests__/issue-page-typography.test.ts
  - apps/web/__tests__/issue-page-shop-callout.test.ts
autonomous: true
requirements: [P55-SC1, P55-SC3, P55-SC4, P55-SC5, P55-SC6, PUB-03, PUB-04, PUB-05, PUB-08, PUB-13, PUB-14]

must_haves:
  truths:
    - "Visiting / shows the full front page of the latest issue (no redirect), with canonical pointing at /issue/<slug>; with no published issue it shows the dry empty state"
    - "/issue/[slug] and /issue/[slug]/preview render the identical Dispatch tree from the shared IssueLayout, wearing the issue's weekly accent"
    - "Per-issue DesignAgent theme is no longer injected on the public issue pages (no serializeThemeCss(theme), no ThemeApplier); lib/theme.ts unchanged"
    - "Page order: masthead, ticker, hero, how strip, sticky nav, sections 01-08, buy band, back issues, then footer outside <main>; exactly one <main> and one h1"
    - "Every 'Fund them' CTA is either an in-page anchor to #buy or the FundButton inside #buy"
  artifacts:
    - path: "apps/web/components/issue/IssueLayout.tsx"
      provides: "Dispatch composition shared by published, home and preview"
      contains: "serializeAccentCss"
    - path: "apps/web/app/page.tsx"
      provides: "Home renders the latest issue front page"
      contains: "IssueLayout"
    - path: "apps/web/app/layout.tsx"
      provides: "ChromeSwitch header/footer around the single main#main"
      contains: "ChromeSwitch"
  key_links:
    - from: "apps/web/app/page.tsx"
      to: "apps/web/components/issue/IssueLayout.tsx"
      via: "render with latest issue + archive + initial balms"
      pattern: "<IssueLayout"
    - from: "apps/web/components/issue/IssueLayout.tsx"
      to: "apps/web/lib/brand.ts"
      via: "serializeAccentCss(issue.issueNumber) in a <style> inside .dispatch"
      pattern: "serializeAccentCss\\(issue\\.issueNumber\\)"
    - from: "apps/web/app/layout.tsx"
      to: "DispatchFooter"
      via: "ChromeSwitch dispatch slot after </main>"
      pattern: "dispatch=\\{<DispatchFooter"
---

<objective>
Compose all Wave 2 components into the shared `IssueLayout`, make `/` render the latest issue's front page, drop per-issue theme injection on issue routes, hide the old site chrome on `/` and `/issue/*` (swapping in DispatchFooter outside `<main>`), re-skin the loading skeleton, and update the source-scan tests that pinned the replaced wiring — in the same plan that breaks them.

Purpose: SC-1 (home + issue pages match mockup structure), SC-3/SC-4/SC-5 wired end-to-end, SC-6 (single main, one h1).
Blast radius: `/issue/[slug]/preview` is the dispatch-control review iframe — it shares IssueLayout and changes look identically (D-09 fidelity). Non-dispatch routes (/shop /archive /charities /about /legal) keep SiteHeader/SiteFooter and the Phase 19 look.
Output: rewritten IssueLayout + 5 route files + root layout, 3 new tests, 3 updated tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/55-public-site-redesign/55-UI-SPEC.md
@.planning/phases/55-public-site-redesign/55-RESEARCH.md
@apps/web/components/issue/IssueLayout.tsx
@apps/web/app/page.tsx
@apps/web/app/layout.tsx
@apps/web/app/issue/[slug]/layout.tsx
@apps/web/app/issue/[slug]/page.tsx
@apps/web/app/issue/[slug]/preview/page.tsx

<interfaces>
Components (Plans 06–10):
```typescript
DispatchMasthead({ issueNumber, dateLabel, compact? }); Ticker({ lines }); Hero({ issueNumber, charityName, headline, dek, chips, readTime, heroImage, narrator }); HowStrip(); IssueNav({ charityName, bonusType })
OriginSection({ headline, body, pullQuote }); ProblemSection({ headline, body, tiles, pdfUrl }); FounderSection({ headline, body }); CaseSection({ headline, subjectName, body, timeline, pullQuote })
GameSlot({ game, runId }); BonusSection({ bonus, bonusType, adSummary }); DelibCards({ cards, confidence }); PodcastSlot({ podcast })
BuyBand({ charityName, charitySlug, sinceMs, countLabel, initialBalms, impact }); BackIssues({ issues, currentIssueNumber }); DispatchFooter()
ChromeSwitch({ site, dispatch? }); fetchBalms(charitySlug, sinceMs?) -> Promise<number | undefined>
```
derive.ts: tickerLines, heroHeadline, heroDek, factChips, readTimeLabel, statTiles, caseTimeline, pullQuote, adSummary, deliberationCards, editorConfidence, impactRange, issueDateLabel
brand.ts: serializeAccentCss(issueNumber); site.ts: BALM_PRICE_CENTS; copy.ts: COUNT_LABEL_CURRENT, COUNT_LABEL_LIFETIME, EMPTY_HOME_HEADING, EMPTY_HOME_BODY
queries.ts: QUERY_LATEST_ISSUE_SLUG, QUERY_ISSUE_BY_SLUG, QUERY_ARCHIVE; types: Issue, ArchiveIssue, LatestIssueSlug

New IssueLayout props:
```typescript
interface IssueLayoutProps {
  issue: NonNullable<Issue>; slug: string; noindex?: boolean
  archive?: ArchiveIssue[]     // undefined -> back-issues section omitted (preview)
  isCurrent?: boolean          // true -> balms counted since publishDate ("this week"); false -> lifetime
  initialBalms?: number        // server-fetched; undefined -> tile hidden until live value arrives
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 0: Pre-swap build baseline (localise failures to Wave 2 vs this plan)</name>
  <files>none (verification only; record results in 55-11-SUMMARY.md)</files>
  <read_first>
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Pitfall 6: Tests that pass while build fails"
    - SUMMARY files of plans 55-06..55-10 (any build notes)
  </read_first>
  <action>
    Before editing any file in this plan, on the merged Wave 2 tree run, in order: `pnpm --filter web test`, `pnpm --filter web typecheck`, `pnpm --filter web build`. Record the last ~30 lines of the build log in the SUMMARY under "Pre-swap baseline".
    - If the build fails with a compile, type or lint error, it belongs to Wave 2 (components are not yet mounted). Fix it in the offending Wave 2 file (note the file and plan in the SUMMARY) BEFORE starting Task 1, then re-run the build.
    - A failure only at static generation with a network error (UND_ERR_SOCKET / fetch failed to Sanity) after "Compiled successfully" and type validation is the known environment flake; record it and continue.
  </action>
  <verify>
    <automated>pnpm --filter web test && pnpm --filter web typecheck && (pnpm --filter web build 2>&1 | tee /tmp/55-11-preswap-build.log | tail -30)</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test` and `pnpm --filter web typecheck` exit 0 before any Task 1 edit
    - The pre-swap build log contains "Compiled successfully" (or the build exits 0); if it failed for non-network reasons, the SUMMARY names the Wave 2 file fixed
    - SUMMARY has a "Pre-swap baseline" section with the log tail
  </acceptance_criteria>
  <done>Wave 2 output is proven to compile and type-check on its own, so any later build failure is attributable to the IssueLayout swap.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 1: Rewrite IssueLayout as the Dispatch composition</name>
  <files>apps/web/components/issue/IssueLayout.tsx, apps/web/__tests__/issue-front-page.test.tsx, apps/web/__tests__/issue-page-typography.test.ts, apps/web/__tests__/issue-page-shop-callout.test.ts</files>
  <read_first>
    - apps/web/components/issue/IssueLayout.tsx (keep: export name, readingTime call, JSON-LD block and noindex behaviour)
    - every component file under apps/web/components/dispatch/ and sections/ (prop names)
    - apps/web/__tests__/issue-page-typography.test.ts — NOTE: this file has an UNCOMMITTED working-tree edit (`git diff` shows it re-points scans at IssueLayout). Keep that edit's intent; commit it with this task
    - apps/web/__tests__/issue-page-shop-callout.test.ts
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure and Component Contract" (order)
  </read_first>
  <behavior>
    - Rendering IssueLayout(fullIssue, archive=archiveIssues, isCurrent, initialBalms 3) in jsdom: root `.dispatch` wrapper; a `<style>` whose text contains `--d-accent:#00FF79` (issue 2); element ids appear exactly once and in this document order: story, how, origin, problem, founder, case, game, bonus, delib, pod, buy, back-issues
    - exactly one h1 (hero headline); zero `main` elements inside the layout; a nav labelled 'In this issue'
    - no element with role="log"; text 'Picked' present; role="meter" present (fixture confidence 0.8)
    - sparseIssue renders without throwing; no `.d-chips`, `.d-stats`, `.d-timeline`, `.d-pullquote`, role="meter"; all 8 section ids still present
    - longWordIssue renders the long charity name inside the h1/hero without inline width styles
    - archive undefined -> no `#back-issues`
  </behavior>
  <action>
    Replace the body of IssueLayout (keep `export function IssueLayout`, JSON-LD logic using SITE_NAME/SITE_AUTHOR/getSiteUrl, `readingTime(...)` minutes). New render:
    ```tsx
    const sinceMs = Date.parse(`${issue.publishDate}T00:00:00Z`)
    const impact = impactRange(issue, BALM_PRICE_CENTS)
    return (
      <div className="dispatch">
        <style dangerouslySetInnerHTML={{ __html: serializeAccentCss(issue.issueNumber) }} />
        {jsonLdData && <JsonLd data={jsonLdData} />}
        <DispatchMasthead issueNumber={issue.issueNumber} dateLabel={issueDateLabel(issue.publishDate)} />
        <Ticker lines={tickerLines(issue)} />
        <Hero issueNumber={issue.issueNumber} charityName={issue.charity.name} headline={heroHeadline(issue)} dek={heroDek(issue)} chips={factChips(issue.charity)} readTime={readTimeLabel(minutes)} heroImage={issue.frontPage?.heroImage ?? null} narrator={issue.narrator ?? null} />
        <HowStrip />
        <IssueNav charityName={issue.charity.name} bonusType={issue.bonusType} />
        <OriginSection headline={issue.originStory?.headline} body={issue.originStory?.body} pullQuote={pullQuote(issue, 'origin')} />
        <ProblemSection headline={issue.problemStatement?.headline} body={issue.problemStatement?.body} tiles={statTiles(issue)} pdfUrl={issue.problemPdfUrl ?? null} />
        <FounderSection headline={issue.founderBio?.headline} body={issue.founderBio?.body} />
        <CaseSection headline={issue.caseStudy?.headline} subjectName={issue.caseStudy?.subjectName} body={issue.caseStudy?.body} timeline={caseTimeline(issue)} pullQuote={pullQuote(issue, 'case')} />
        <GameSlot game={issue.game} runId={issue.runId ?? null} />
        <BonusSection bonus={issue.bonus} bonusType={issue.bonusType} adSummary={adSummary(issue)} />
        <DelibCards cards={deliberationCards(issue)} confidence={editorConfidence(issue)} />
        <PodcastSlot podcast={issue.podcast} />
        <BuyBand charityName={issue.charity.name} charitySlug={issue.charity.slug} sinceMs={isCurrent && Number.isFinite(sinceMs) ? sinceMs : undefined} countLabel={isCurrent ? COUNT_LABEL_CURRENT : COUNT_LABEL_LIFETIME} initialBalms={initialBalms} impact={impact} />
        {archive && <BackIssues issues={archive} currentIssueNumber={issue.issueNumber} />}
      </div>
    )
    ```
    Update the file's header comment to the Phase 55 order. Remove all Phase 19 imports (ScrollProgressBar, SectionRail, IssueMasthead, IssueBriefing, MissionBand, EditorialSection, CaseStudySection, DeliberationSlot, ShopBand) — the files themselves are deleted in Plan 12.
    Tests:
    - issue-front-page.test.tsx (jsdom): behaviours above; mocks for `convex/react` (useQuery -> undefined, useMutation -> () => vi.fn().mockResolvedValue(null)), `@convex/_generated/api`, `next/image`, `next/link` passthrough if needed.
    - issue-page-typography.test.ts: replace the DES-02 assertions that require `<EditorialSection … id="origin" … lead />` in IssueLayout with assertions that IssueLayout renders `<OriginSection` and imports PortableTextRenderer-based sections; replace "issue page still renders GameSlot with runId" to keep matching `<GameSlot[\s\S]*?game=` and `runId=` in IssueLayout (still true). Do NOT delete assertions about globals.css, PortableTextRenderer leading, fonts, or the no-Google-link rule. Assertions about EditorialSection/CaseStudySection/IssueHero/ShopCallout source files stay for now (files still exist; Plan 12 handles them).
    - issue-page-shop-callout.test.ts: change "issue page renders shop component" to assert IssueLayout.tsx contains `<BuyBand` and BuyBand.tsx contains `data-shop-callout` and `/shop`; leave the ShopCallout existence/brand-voice assertions for Plan 12.
  </action>
  <verify>
    <automated>pnpm --filter web test -- issue-front-page issue-page-typography issue-page-shop-callout game-sandbox && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -n "serializeAccentCss(issue.issueNumber)" apps/web/components/issue/IssueLayout.tsx` matches
    - `grep -cE "DeliberationSlot|SectionRail|ScrollProgressBar|IssueMasthead|IssueBriefing|MissionBand|ShopBand|EditorialSection" apps/web/components/issue/IssueLayout.tsx` returns 0
    - `grep -c "<main" apps/web/components/issue/IssueLayout.tsx` returns 0
    - `grep -cE "\\?\\? 80" apps/web/components/issue/IssueLayout.tsx` returns 0
  </acceptance_criteria>
  <done>IssueLayout renders the full Dispatch front page in mockup order with the weekly accent.</done>
</task>

<task type="auto">
  <name>Task 2: Routes — home renders front page, issue layout drops theme, page/preview pass data, loading skeleton</name>
  <files>apps/web/app/page.tsx, apps/web/app/issue/[slug]/layout.tsx, apps/web/app/issue/[slug]/page.tsx, apps/web/app/issue/[slug]/preview/page.tsx, apps/web/app/issue/[slug]/loading.tsx, apps/web/__tests__/home-page.test.ts, apps/web/__tests__/issue-page-dispatch.test.ts</files>
  <read_first>
    - all five route files listed
    - apps/web/__tests__/issue-page-dispatch.test.ts "Plan 05" block (asserts serializeThemeCss(theme) in issue layout — must be rewritten here)
    - apps/web/__tests__/preview-route.test.ts and loading-skeletons.test.ts (must stay green: verifyPreviewToken before fetch, force-dynamic, noindex, no `<main>` in loading.tsx)
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Pitfall 1", §"Pitfall 7", §"Pattern 2"
  </read_first>
  <action>
    1. app/page.tsx: remove `redirect`. Keep `export const revalidate = 60`. Replace static `metadata` with `export async function generateMetadata(): Promise<Metadata>` that fetches QUERY_LATEST_ISSUE_SLUG (try/catch) and returns the existing title/description/openGraph/twitter plus `alternates: { canonical: latest?.slug ? `${getSiteUrl()}/issue/${latest.slug}` : getSiteUrl() }`. Page: fetch latest (try/catch -> null); if no slug render the empty state `<div className="dispatch"><DispatchMasthead issueNumber={null} dateLabel={null} compact /><section className="d-container d-sec" aria-labelledby="empty-title"><h1 id="empty-title" className="d-display">{EMPTY_HOME_HEADING}</h1><p className="d-body">{EMPTY_HOME_BODY}</p></section></div>`; else `Promise.all([sanityClient.fetch<Issue>(QUERY_ISSUE_BY_SLUG, { slug }), sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE)])` (archive failure -> []); issue null -> empty state; `const sinceMs = Date.parse(`${issue.publishDate}T00:00:00Z`)`; `const initialBalms = await fetchBalms(issue.charity.slug, Number.isFinite(sinceMs) ? sinceMs : undefined)`; `return <IssueLayout issue={issue} slug={latest.slug} archive={archive} isCurrent initialBalms={initialBalms} />`.
    2. app/issue/[slug]/layout.tsx: replace with a passthrough segment layout — no Sanity fetch, no serializeThemeCss, no ThemeApplier: `export default function IssueSegmentLayout({ children }: { children: React.ReactNode }) { return <>{children}</> }` with a doc comment: "Phase 55: fixed Dispatch brand. Per-issue DesignAgent theming is not applied on public pages; the weekly accent is emitted inside IssueLayout so published, home and preview cannot diverge. lib/theme.ts is unchanged."
    3. app/issue/[slug]/page.tsx: keep generateStaticParams, generateMetadata, revalidate, notFound. In the page fetch issue, archive and latest slug in parallel (archive/latest failures tolerated); `isCurrent = latest?.slug === slug`; `initialBalms = await fetchBalms(issue.charity.slug, isCurrent && Number.isFinite(sinceMs) ? sinceMs : undefined)`; render `<IssueLayout issue={issue} slug={slug} archive={archive} isCurrent={isCurrent} initialBalms={initialBalms} />`. Update the header comment section order to Phase 55.
    4. preview/page.tsx: keep token verification order, force-dynamic, revalidate 0, noindex. Change the unauthorized/unavailable branches' `<main …>` wrappers to `<section …>` (fixes nested mains). Preview renders `<IssueLayout issue={issue} slug={slug} noindex />` (no archive, initialBalms undefined).
    5. loading.tsx: keep root `<article>` (no `<main>`), remove any IssueHero import; skeleton = `<article className="dispatch animate-pulse" aria-hidden="true">` with blocks using `className="d-container"` and inline `style={{ background: 'var(--d-ink)', height: '…px' }}` bars mirroring masthead (48px), ticker (44px), hero (420px on `var(--d-accent)` background) — no oxblood/cream tokens, no hex literals.
    6. home-page.test.ts (node source-scan): app/page.tsx does not contain `redirect(` nor import from 'next/navigation' redirect; contains `<IssueLayout`, `QUERY_ARCHIVE`, `fetchBalms`, `canonical`, `/issue/`, `EMPTY_HOME_HEADING`, `revalidate = 60`.
    7. issue-page-dispatch.test.ts: rewrite only the "Plan 05" describe to "Phase 55: public issue pages use the fixed Dispatch brand" asserting issue layout.tsx does NOT contain `serializeThemeCss(` nor `ThemeApplier` nor `sanityClient`, and that lib/theme.ts still exports serializeThemeCss/applyTheme (theme.ts unchanged). Leave other describes (fonts, FONT_WHITELIST, BRAND_DEFAULTS, framer-motion, Plan 02/03 file-existence) for Plan 12.
  </action>
  <verify>
    <automated>pnpm --filter web test -- home-page issue-page-dispatch preview-route loading-skeletons issue-front-page && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -c "redirect" apps/web/app/page.tsx` returns 0
    - `grep -cE "serializeThemeCss|ThemeApplier" "apps/web/app/issue/[slug]/layout.tsx"` returns 0
    - `grep -c "<main" "apps/web/app/issue/[slug]/preview/page.tsx" "apps/web/app/issue/[slug]/loading.tsx"` totals 0
    - `git diff --quiet -- apps/web/lib/theme.ts` exits 0
  </acceptance_criteria>
  <done>/ renders the latest front page; issue routes no longer inject per-issue theme; preview matches published.</done>
</task>

<task type="auto">
  <name>Task 3: Root chrome switch + Fund-CTA wiring test + suite/type/build gate</name>
  <files>apps/web/app/layout.tsx, apps/web/__tests__/fund-cta-wiring.test.ts</files>
  <read_first>
    - apps/web/app/layout.tsx (after Plan 01: Manrope + dispatch.css import)
    - apps/web/components/dispatch/ChromeSwitch.tsx, DispatchFooter.tsx
    - apps/web/__tests__/site-header-nav.test.ts (SiteHeader stays for non-dispatch routes)
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Pitfall 6" (build network flake)
  </read_first>
  <action>
    1. app/layout.tsx: import ChromeSwitch and DispatchFooter; replace `<SiteHeader />` with `<ChromeSwitch site={<SiteHeader />} />` and `<SiteFooter />` with `<ChromeSwitch site={<SiteFooter />} dispatch={<DispatchFooter />} />`. Keep the skip link, the single `<main className="flex-1" id="main">`, ConvexClientProvider, TooltipProvider, themeColor and all fonts.
    2. fund-cta-wiring.test.ts (node source-scan, SC-5): over every .tsx under apps/web/components/dispatch/: (a) each occurrence of `{FUND_CTA}` is inside an anchor whose opening tag contains `href="#buy"` (regex `/<a\b[^>]*href="#buy"[^>]*>\s*\{FUND_CTA\}/g` count equals count of `{FUND_CTA}`); (b) only FundButton.tsx references `startCheckout`, and no dispatch component contains `/api/checkout/create-session`; (c) BuyBand.tsx contains `id="buy"` and `<FundButton`; (d) IssueLayout.tsx contains `<BuyBand`; (e) lib/checkout-client.ts posts to `/api/checkout/create-session`; (f) app/layout.tsx contains `<ChromeSwitch`, exactly one `<main`, and `dispatch={<DispatchFooter`.
    3. Gate: run `pnpm --filter web test` (full) and `pnpm --filter web typecheck`; then `pnpm --filter web build`. If the build fails ONLY at static generation with a network error (e.g. UND_ERR_SOCKET / fetch failed to Sanity) AFTER the "Checking validity of types" / "Compiled successfully" lines, record the tail of the log in the SUMMARY as the known environment flake (Pitfall 6) — any compile/type/lint error is a real failure and must be fixed.
  </action>
  <verify>
    <automated>pnpm --filter web test && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test` exits 0 and `pnpm --filter web typecheck` exits 0
    - `grep -c "<main" apps/web/app/layout.tsx` returns 1
    - `grep -n "dispatch={<DispatchFooter" apps/web/app/layout.tsx` matches
    - `pnpm --filter web build` either exits 0 or its log shows "Compiled successfully" and type validation passed before a network-only prerender error (log tail in SUMMARY)
  </acceptance_criteria>
  <done>Chrome switches correctly; every Fund CTA provably reaches checkout; suite + typecheck green; build gate recorded.</done>
</task>

</tasks>

<verification>
- Full web suite + typecheck green; build gate recorded
- Manual smoke (optional, local): `pnpm --filter web dev`, open `/` and `/issue/<slug>`
</verification>

<success_criteria>
Home and issue pages render the Dispatch front page from one shared layout; preview identical; theme injection retired on public pages; tests updated in the same plan.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-11-SUMMARY.md`
</output>
