---
phase: 55-public-site-redesign
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/lib/site.ts
  - apps/web/lib/dispatch/copy.ts
  - apps/web/components/dispatch/NumberedSection.tsx
  - apps/web/components/dispatch/ChromeSwitch.tsx
  - apps/web/__tests__/dispatch-voice.test.ts
  - apps/web/__tests__/numbered-section.test.tsx
  - apps/web/__tests__/chrome-switch.test.ts
autonomous: true
requirements: [P55-SC1, P55-SC2, P55-SC6, PUB-04, PUB-05, PUB-16]

must_haves:
  truths:
    - "Every reader-facing string on the new front page comes from one constants file in Jesse's dry voice; cadence copy says Thursday"
    - "The price label is derived from a single BALM_PRICE_CENTS = 899 constant; no '8.99' literal exists in copy.ts or components/dispatch"
    - "No mockup placeholder string (Monday, [LIVE COUNT], Release 001, panel of AIs, goes here, ...) can ship — a denylist test fails the suite if one appears"
    - "Every numbered section renders exactly one h2 (the title, or the label when there is no title) and a decorative number disc"
    - "Site chrome can be switched off for / and /issue/* without a second <main>"
  artifacts:
    - path: "apps/web/lib/dispatch/copy.ts"
      provides: "All Phase 55 copy constants + SECTION_META + bonusLabel + fundButtonLabel + buyLead"
      contains: "Thursday"
    - path: "apps/web/lib/site.ts"
      provides: "BALM_PRICE_CENTS + formatUsd"
      contains: "BALM_PRICE_CENTS = 899"
    - path: "apps/web/components/dispatch/NumberedSection.tsx"
      provides: "Colour-block section wrapper (disc + eyebrow + h2)"
      exports: ["NumberedSection"]
    - path: "apps/web/components/dispatch/ChromeSwitch.tsx"
      provides: "isDispatchRoute + ChromeSwitch client component"
      exports: ["ChromeSwitch", "isDispatchRoute"]
  key_links:
    - from: "apps/web/lib/dispatch/copy.ts"
      to: "apps/web/lib/site.ts"
      via: "PRICE_LABEL = formatUsd(BALM_PRICE_CENTS)"
      pattern: "formatUsd\\(BALM_PRICE_CENTS\\)"
---

<objective>
Create the shared copy constants (Jesse voice, verbatim from UI-SPEC §Copywriting), the single price constant, and the two structural primitives every section/route plan needs: `NumberedSection` and `ChromeSwitch`. Add the phase-wide voice denylist test (locked decision 2).

Purpose: Wave 2 plans import labels and the section wrapper from here instead of inventing copy; the denylist test guards SC-2 for the rest of the phase.
Output: site.ts additions, copy.ts, NumberedSection.tsx, ChromeSwitch.tsx, 3 tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/55-public-site-redesign/55-UI-SPEC.md
@apps/web/lib/site.ts

<interfaces>
Contract this plan CREATES (consumed by plans 06–11):
```typescript
// apps/web/lib/site.ts (additions; existing exports unchanged)
export const BALM_PRICE_CENTS = 899
export function formatUsd(cents: number): string   // 899 -> '$8.99'

// apps/web/lib/dispatch/copy.ts
export type SectionId = 'origin' | 'problem' | 'founder' | 'case' | 'game' | 'bonus' | 'delib' | 'pod'
export type DotTone = 'green' | 'blue' | 'red' | 'yellow'
export type BonusKind = 'specAd' | 'jingle' | 'bigBudget'
export const PRICE_LABEL: string                    // '$8.99'
export const FUND_CTA: string                       // 'Fund them · $8.99'
export function fundButtonLabel(name: string | null | undefined): string
export const SECTION_META: ReadonlyArray<{ id: SectionId; number: string; label: string; navLabel: string; dot: DotTone }>
export function sectionMeta(id: SectionId): { id: SectionId; number: string; label: string; navLabel: string; dot: DotTone }
export function bonusLabel(kind: BonusKind): string
export function buyLead(charity: string, impact?: { min: number; max: number; unit: string } | null): string
export function buyEyebrow(charity: string): string
export function impactCaption(unit: string): string
export function searchStatus(n: number): string
// + the string constants listed in Task 1

// apps/web/components/dispatch/NumberedSection.tsx
export function NumberedSection(props: {
  id: SectionId; number: string; label: string; title?: string | null;
  compact?: boolean; className?: string; children?: React.ReactNode
}): JSX.Element

// apps/web/components/dispatch/ChromeSwitch.tsx ('use client')
export function isDispatchRoute(pathname: string | null | undefined): boolean
export function ChromeSwitch(props: { site: React.ReactNode; dispatch?: React.ReactNode }): JSX.Element
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: BALM_PRICE_CENTS + copy.ts constants + voice denylist test</name>
  <files>apps/web/lib/site.ts, apps/web/lib/dispatch/copy.ts, apps/web/__tests__/dispatch-voice.test.ts</files>
  <read_first>
    - apps/web/lib/site.ts (append only; do not change SITE_NAME / SITE_DESCRIPTION / getSiteUrl)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Copywriting Contract" (copy is verbatim from this table) and §"Fixed section colour map"
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Pitfall 8: Voice leakage via the mockup"
  </read_first>
  <behavior>
    - formatUsd(899) === '$8.99'; PRICE_LABEL === '$8.99'; FUND_CTA === 'Fund them · $8.99'
    - fundButtonLabel('Acme Wheels') === 'Fund Acme Wheels · $8.99'; fundButtonLabel('x'.repeat(29)) === FUND_CTA; fundButtonLabel(null) === FUND_CTA
    - HOW_STEPS.map(s => s.lead + s.rest) equals the three UI-SPEC step sentences exactly
    - SECTION_META ids in order: origin, problem, founder, case, game, bonus, delib, pod; numbers '01'..'08'
    - bonusLabel('specAd') === 'The ad we made them'; 'jingle' -> 'The jingle we made them'; 'bigBudget' -> 'The production we made them'
    - buyLead('Acme', null) === 'Every lip balm sold this week sends its full $8.99 to Acme.'; with { min: 12, max: 20, unit: 'wheelchair' } appends ' About 12 to 20 balms covers one wheelchair.'
    - searchStatus(1) === '1 nonprofit'; searchStatus(3) === '3 nonprofits'
  </behavior>
  <action>
    1. apps/web/lib/site.ts — append: `export const BALM_PRICE_CENTS = 899` (doc comment: "Single source for the $8.99 price (Phase 55; approved wording). The Convex balms query mirrors this value.") and `export function formatUsd(cents: number): string { return `$${(cents / 100).toFixed(2)}` }`.
    2. apps/web/lib/dispatch/copy.ts — the types/functions from <interfaces> plus these constants, values verbatim:
       `PRICE_LABEL = formatUsd(BALM_PRICE_CENTS)`; `FUND_CTA = \`Fund them · ${PRICE_LABEL}\``; `fundButtonLabel(name)`: trimmed name non-empty and length <= 28 ? \`Fund ${name} · ${PRICE_LABEL}\` : FUND_CTA;
       `READ_STORY_CTA = 'Read their story ↓'`; `MASTHEAD_WORDMARK = 'The Eisenbalm Dispatch'`; `MASTHEAD_TAGLINE = 'One overlooked nonprofit on the front page each week. Funded in full.'`;
       `TOPBAR_LINKS = [{ label: "This week's nonprofit", href: '#story' }, { label: 'Past nonprofits', href: '/archive' }, { label: 'How it works', href: '#how' }, { label: 'About', href: '#about' }] as const`;
       `HERO_EYEBROW = "This week's nonprofit"`; `HOW_EYEBROW = 'How the Dispatch works'`;
       `HOW_STEPS = [{ lead: 'Each Thursday', rest: ' we select one small nonprofit most people have not heard of.' }, { lead: 'We tell its story,', rest: ' start to finish, on this page.' }, { lead: 'Every lip balm sold that week funds it.', rest: \` The full ${PRICE_LABEL}. 100% to them.\` }] as const`;
       `TICKER_CONSTANT_LINE = 'Every balm sold this week goes to them'`; `STICKER_LINES = [\`Your ${PRICE_LABEL}\`, '100% to them'] as const`;
       `SECTION_META` = origin '01' 'How it started' nav 'How it started' dot green · problem '02' 'The problem' nav 'The problem' dot blue · founder '03' 'The founder' nav 'The founder' dot yellow · case '04' 'The case' nav 'The case' dot red · game '05' 'The game' nav 'The game' dot green · bonus '06' 'The bonus' nav 'The bonus' dot red (consumers override with bonusLabel(bonusType)) · delib '07' 'Why we selected them' nav 'Why them' dot blue · pod '08' 'The Dispatch podcast' nav 'Podcast' dot green. Freeze it.
       `DELIB_INTRO = 'Each week a scout, an advocate and an editor argue over the shortlist. The result is published here.'`; `DELIB_CARD_LABELS = { picked: 'Picked', 'runner-up': 'Runner-up', also: 'Also considered' } as const`; `CONFIDENCE_LABEL = "Editor's confidence"`;
       `buyEyebrow = (c) => \`How you can help ${c}\``; `BUY_HEADLINE = 'Buy a lip balm. Fund the work.'`; `buyLead(c, impact)` per <behavior>; `BALM_LINE = 'The balm: Jesse A. Eisenbalm. Beeswax and shea butter, no petrolatum. Stop. Breathe. Balm.'`; `SHIPPING_NOTE = 'Flat-rate shipping, continental US'`; `MORE_THAN_ONE_LINK = 'More than one? Choose a quantity'`; `CHECKOUT_LOADING = 'Opening checkout'`;
       `COUNT_LABEL_CURRENT = 'Balms sold this week'`; `COUNT_LABEL_LIFETIME = 'Balms sold'`; `impactCaption = (u) => \`Progress toward the next ${u}\``;
       `BACK_ISSUES_HEADING = "Nonprofits we've featured"`; `SEARCH_LABEL = 'Find a nonprofit'`; `SEARCH_PLACEHOLDER = 'Name, cause or issue no.'`; `SEE_ALL = 'See them all →'`; `searchStatus(n)`; `SEARCH_EMPTY = 'No nonprofit matches that. Try a name, a cause or an issue number.'`; `ARCHIVE_EMPTY = 'This is the first issue. The archive begins next Thursday.'`;
       `NEWSLETTER_LABEL = 'Be told when a new nonprofit is selected'`; `NEWSLETTER_BUTTON = 'Subscribe to the Dispatch'`; `NEWSLETTER_SENDING = 'Sending'`; `NEWSLETTER_SUCCESS = 'Recorded. You are on the list.'`; `NEWSLETTER_ERROR = 'That did not go through. Check the address and try again.'`;
       `FOOTER_BLURB = "A weekly front page for one nonprofit that deserves one. Paid for by Jesse A. Eisenbalm lip balm. Every sale goes to that week's nonprofit."`; `EMPTY_HOME_HEADING = 'No issue is published yet.'`; `EMPTY_HOME_BODY = 'The next Dispatch arrives Thursday. Check back then.'`; `COPYRIGHT_HOLDER = 'Jesse A. Eisenbalm'`.
       No '8.99' literal anywhere in copy.ts. No exclamation marks in any string.
    3. apps/web/__tests__/dispatch-voice.test.ts (node env): behaviours above, plus source-scan of copy.ts and every file under apps/web/components/dispatch/** (recursive, tolerate missing dir): none contains (case-insensitive) `Monday`, `[LIVE COUNT]`, `Release 001`, `hand-numbered`, `panel of AIs`, `Cats. Also on wheels`, `Illustration ·`, `goes here`, `coming soon`, `lorem`; none contains the literal `8.99`; string literals in copy.ts (extract with `/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g`) contain no `!`; copy.ts contains `Thursday`.
  </action>
  <verify>
    <automated>pnpm --filter web test -- dispatch-voice && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export const BALM_PRICE_CENTS = 899" apps/web/lib/site.ts` matches
    - `grep -c "8.99" apps/web/lib/dispatch/copy.ts` returns 0
    - `grep -c "Thursday" apps/web/lib/dispatch/copy.ts` >= 2
    - `grep -n "Monday" apps/web/lib/dispatch/copy.ts` returns nothing
    - `pnpm --filter web test -- dispatch-voice` exits 0
  </acceptance_criteria>
  <done>All UI-SPEC copy lives in copy.ts, price derived from one constant, voice denylist test green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: NumberedSection + ChromeSwitch primitives</name>
  <files>apps/web/components/dispatch/NumberedSection.tsx, apps/web/components/dispatch/ChromeSwitch.tsx, apps/web/__tests__/numbered-section.test.tsx, apps/web/__tests__/chrome-switch.test.ts</files>
  <read_first>
    - apps/web/lib/dispatch/copy.ts (SectionId type)
    - apps/web/app/layout.tsx (current SiteHeader / main#main / SiteFooter structure ChromeSwitch will wrap in Plan 11)
    - apps/web/__tests__/buy-button.test.tsx (jsdom + @testing-library/react pattern used in this repo)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure" item 7 and §Accessibility (one h2 per section, cards h3)
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Pattern 2: Chrome switch"
  </read_first>
  <behavior>
    - NumberedSection with title: root `<section id={id}>` has classes `d-sec d-sec--{id}`; contains `.d-disc` with text number and aria-hidden="true"; label rendered as `<p class="d-eyebrow">`; exactly one h2 with text = title and id `${id}-title`; section has aria-labelledby `${id}-title`
    - NumberedSection without title (undefined, null or whitespace): the label itself is the single h2 (`<h2 class="d-eyebrow" id="{id}-title">`)
    - compact adds class `d-sec--compact`; children render inside `.d-container`
    - isDispatchRoute('/') true; '/issue/abc' true; '/issue/abc/preview' true; '/issues' false; '/shop' false; '/archive' false; null false; undefined false
  </behavior>
  <action>
    1. NumberedSection.tsx (server-safe, no hooks, no 'use client' so it can be imported by both server and client components):
       ```tsx
       const hasTitle = typeof title === 'string' && title.trim().length > 0
       const headingId = `${id}-title`
       return (
         <section id={id} aria-labelledby={headingId} className={['d-sec', `d-sec--${id}`, compact ? 'd-sec--compact' : '', className ?? ''].filter(Boolean).join(' ')}>
           <div className="d-container">
             <div className="d-sec-head">
               <span className="d-disc" aria-hidden="true">{number}</span>
               {hasTitle ? <p className="d-eyebrow">{label}</p> : <h2 id={headingId} className="d-eyebrow">{label}</h2>}
             </div>
             {hasTitle && <h2 id={headingId} className="d-heading d-sec-title">{title}</h2>}
             {children}
           </div>
         </section>
       )
       ```
       Doc comment: section ids are the fixed nav anchors (`origin problem founder case game bonus delib pod`); field/disc colours come from `.d-sec--{id}` in app/dispatch.css; never pass colours as props.
    2. ChromeSwitch.tsx (`'use client'`): `isDispatchRoute(p) = !!p && (p === '/' || p.startsWith('/issue/'))`; `ChromeSwitch({ site, dispatch = null })` uses `usePathname()` from 'next/navigation' and returns `<>{isDispatchRoute(pathname) ? dispatch : site}</>`. Doc comment: renders header/footer slots only; the root layout keeps the single `<main id="main">` (WCAG 1.3.1); footer slot sits outside main so it is a contentinfo landmark.
    3. numbered-section.test.tsx (jsdom) per behaviours; chrome-switch.test.ts (node) unit-tests isDispatchRoute only.
  </action>
  <verify>
    <automated>pnpm --filter web test -- numbered-section chrome-switch && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test -- numbered-section chrome-switch` exits 0
    - `grep -n "aria-hidden=\"true\"" apps/web/components/dispatch/NumberedSection.tsx` matches
    - `head -3 apps/web/components/dispatch/ChromeSwitch.tsx | grep -n "use client"` matches
    - `grep -c "use client" apps/web/components/dispatch/NumberedSection.tsx` returns 0
    - `grep -c "<main" apps/web/components/dispatch/ChromeSwitch.tsx apps/web/components/dispatch/NumberedSection.tsx` totals 0
  </acceptance_criteria>
  <done>Both primitives exist with tests; every numbered section is guaranteed exactly one h2.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test` full suite green; `pnpm --filter web typecheck` clean
</verification>

<success_criteria>
copy.ts, BALM_PRICE_CENTS, NumberedSection and ChromeSwitch exist per contract; voice denylist active for the whole phase.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-02-SUMMARY.md`
</output>
