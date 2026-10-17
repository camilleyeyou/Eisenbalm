---
phase: 55-public-site-redesign
plan: 06
type: execute
wave: 2
depends_on: [55-01, 55-02, 55-03]
files_modified:
  - apps/web/components/dispatch/DispatchMasthead.tsx
  - apps/web/components/dispatch/Ticker.tsx
  - apps/web/components/dispatch/Hero.tsx
  - apps/web/components/dispatch/HowStrip.tsx
  - apps/web/components/dispatch/IssueNav.tsx
  - apps/web/components/dispatch/top.css
  - apps/web/__tests__/dispatch-top.test.tsx
autonomous: true
requirements: [P55-SC1, P55-SC2, P55-SC6, PUB-04, PUB-11, PUB-13, PUB-14]

must_haves:
  truths:
    - "A first-time visitor sees the issue line, the wordmark, a ticker, and an accent-coloured hero naming this week's nonprofit with a 'Fund them · $8.99' path, in seconds"
    - "The hero h1 is the only h1; the masthead wordmark is not a heading"
    - "Fact chips, dek and hero photo appear only when data exists; without a photo the geometric accent artwork shows (never the mockup's dog or 'goes here' caption)"
    - "The sticky in-issue nav lists the 8 sections in order, highlights the current one with aria-current, and never causes page-level horizontal scroll at 375px"
    - "The ticker stops and wraps under prefers-reduced-motion"
  artifacts:
    - path: "apps/web/components/dispatch/Hero.tsx"
      provides: "#story accent hero with h1, dek, chips, CTAs, art, sticker, narrator chip"
      exports: ["Hero"]
    - path: "apps/web/components/dispatch/IssueNav.tsx"
      provides: "Sticky in-issue nav with scroll-spy (client)"
      exports: ["IssueNav"]
    - path: "apps/web/components/dispatch/DispatchMasthead.tsx"
      provides: "Top bar (header, nav Main, Fund pill) + wordmark/tagline"
      exports: ["DispatchMasthead"]
    - path: "apps/web/components/dispatch/Ticker.tsx"
      provides: "aria-hidden CSS marquee"
      exports: ["Ticker"]
    - path: "apps/web/components/dispatch/HowStrip.tsx"
      provides: "#how three-step strip"
      exports: ["HowStrip"]
  key_links:
    - from: "apps/web/components/dispatch/Hero.tsx"
      to: "#buy and #origin"
      via: "anchor pills"
      pattern: "href=\"#buy\""
    - from: "apps/web/components/dispatch/IssueNav.tsx"
      to: "SECTION_META ids"
      via: "href={`#${s.id}`}"
      pattern: "SECTION_META"
---

<objective>
Build the top-of-page Dispatch components — top bar + masthead, ticker, accent hero, "How the Dispatch works" strip and the sticky in-issue nav — as presentational components driven by props (data comes from derive.ts in Plan 11's composition).

Purpose: SC-1 structure (masthead → ticker → hero → how strip → sticky nav) with SC-2 voice and SC-6 a11y baked in.
Output: 5 components, top.css, one jsdom test file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/55-public-site-redesign/55-UI-SPEC.md
@.planning/phases/55-public-site-redesign/MOCKUP-Main.dc.html
@apps/web/app/dispatch.css
@apps/web/lib/dispatch/copy.ts
@apps/web/lib/dispatch/derive.ts

<interfaces>
From Plans 01–03:
```typescript
// lib/dispatch/copy.ts: MASTHEAD_WORDMARK, MASTHEAD_TAGLINE, TOPBAR_LINKS, FUND_CTA, READ_STORY_CTA, HERO_EYEBROW, HOW_EYEBROW, HOW_STEPS, TICKER_CONSTANT_LINE, STICKER_LINES, SECTION_META, bonusLabel, type SectionId, type BonusKind
// lib/dispatch/derive.ts: type FactChip = { label: string; value: string }
// lib/sanity/types.ts: IssueNarrator = { name: string; slug: string; active: boolean }; IssueFrontPage['heroImage'] = { url; alt: string | null; width: number | null; height: number | null } | null
// dispatch.css classes: .d-container .d-label .d-eyebrow .d-body .d-heading .d-display .d-tap .d-pill(--ink|--paper|--accent|--compact) .d-link .d-dot(--green|blue|red|yellow) .d-sr-only
// CSS vars inside .dispatch: --d-accent --d-accent-ink --d-second --d-third --d-fourth --d-fourth-ink --d-ink --d-paper --d-green --d-blue --d-red --d-yellow
```
Props this plan CREATES (Plan 11 composes):
```typescript
export function DispatchMasthead(p: { issueNumber: number | null; dateLabel: string | null; compact?: boolean }): JSX.Element
export function Ticker(p: { lines: string[] }): JSX.Element
export function Hero(p: { issueNumber: number; charityName: string; headline: string; dek: string | null; chips: FactChip[]; readTime: string; heroImage: { url: string; alt: string | null; width: number | null; height: number | null } | null; narrator?: IssueNarrator | null }): JSX.Element
export function HowStrip(): JSX.Element
export function IssueNav(p: { charityName: string; bonusType: BonusKind }): JSX.Element   // 'use client'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: DispatchMasthead + Ticker + HowStrip</name>
  <files>apps/web/components/dispatch/DispatchMasthead.tsx, apps/web/components/dispatch/Ticker.tsx, apps/web/components/dispatch/HowStrip.tsx, apps/web/components/dispatch/top.css, apps/web/__tests__/dispatch-top.test.tsx</files>
  <read_first>
    - apps/web/app/dispatch.css (class contract — use, never redefine)
    - apps/web/lib/dispatch/copy.ts
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure" items 1, 2, 3, 5 and §Typography
    - .planning/phases/55-public-site-redesign/MOCKUP-Main.dc.html (top bar, masthead, ticker, how-strip markup — LAYOUT ONLY, never copy its text)
    - apps/web/__tests__/buy-button.test.tsx (jsdom render pattern)
  </read_first>
  <behavior>
    - DispatchMasthead({issueNumber: 2, dateLabel: 'Thursday, October 15, 2026'}): renders `<header>` containing text 'Issue 2 · Thursday, October 15, 2026', a `nav` with aria-label 'Main' holding 4 links with hrefs '#story', '/archive', '#how', '#about', and a link with text FUND_CTA and href '#buy'; wordmark 'The Eisenbalm Dispatch' is a `p` (no h1/h2 in the masthead); 4 decorative dots inside an aria-hidden wrapper; tagline text equals MASTHEAD_TAGLINE
    - compact: true hides the nav and the Fund pill (used by the empty home state)
    - Ticker({lines: ['A','B']}): root has aria-hidden="true"; contains two `.d-ticker-set` lists, the second with class `d-ticker-set--dup`; last item of each set is TICKER_CONSTANT_LINE
    - HowStrip: `section#how` with an h2 'How the Dispatch works', an `ol` of 3 items whose textContent equals the UI-SPEC step sentences; first item contains 'Thursday'
  </behavior>
  <action>
    1. DispatchMasthead.tsx (server component): `<header className="d-topbar"><div className="d-container d-topbar-row"><p className="d-label">{issueNumber != null ? `Issue ${issueNumber}` : ''}{issueNumber != null && dateLabel ? ' · ' : ''}{dateLabel ?? ''}</p>{!compact && <nav aria-label="Main"><ul className="d-topbar-links">{TOPBAR_LINKS.map(l => <li key={l.href}><a href={l.href} className="d-tap d-label d-link">{l.label}</a></li>)}</ul></nav>}{!compact && <a href="#buy" className="d-pill d-pill--ink d-pill--compact">{FUND_CTA}</a>}</div></header>` then `<div className="d-masthead"><div className="d-container d-masthead-row"><p className="d-display d-wordmark">{MASTHEAD_WORDMARK}</p><div className="d-tagline-row"><span className="d-dots" aria-hidden="true"><span className="d-dot d-dot--green" /><span className="d-dot d-dot--blue" /><span className="d-dot d-dot--red" /><span className="d-dot d-dot--yellow" /></span><p className="d-body d-tagline">{MASTHEAD_TAGLINE}</p></div></div></div>`. Wrap both in a fragment.
    2. Ticker.tsx (server): `const items = [...lines, TICKER_CONSTANT_LINE]`; `const TEXT = ['paper','green','yellow'] as const; const DOT = ['green','blue','red','yellow'] as const`; render `<div className="d-ticker" aria-hidden="true"><div className="d-ticker-track">{[0,1].map(set => <ul key={set} className={set ? 'd-ticker-set d-ticker-set--dup' : 'd-ticker-set'}>{items.map((t,i) => <li key={i} className="d-ticker-item"><span className={`d-dot d-dot--${DOT[i%4]}`} /><span className={`d-ticker-text d-ticker-text--${TEXT[i%3]}`}>{t}</span></li>)}</ul>)}</div></div>`. Blue is used for dots only, never ticker words (3.75:1 on ink).
    3. HowStrip.tsx (server): `<section id="how" aria-labelledby="how-title" className="d-how"><div className="d-container"><h2 id="how-title" className="d-eyebrow">{HOW_EYEBROW}</h2><ol className="d-how-steps">{HOW_STEPS.map((s,i) => <li key={i} className="d-how-step"><span className={`d-how-disc d-how-disc--${i+1}`} aria-hidden="true">{i+1}</span><p className="d-body"><strong>{s.lead}</strong>{s.rest}</p></li>)}</ol></div></section>`.
    4. top.css (import it at the top of each of the 5 components with `import './top.css'`; only `var(--d-*)` colours, no hex): `.d-topbar{border-bottom:1px solid var(--d-ink)} .d-topbar-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 24px;padding-block:8px} .d-topbar-links{display:flex;flex-wrap:wrap;gap:0 16px;list-style:none;margin:0;padding:0}` · `.d-masthead{border-bottom:4px solid var(--d-ink)} .d-masthead-row{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:24px;padding-block:48px} .d-wordmark{max-width:12ch} .d-tagline-row{display:flex;align-items:center;gap:16px;max-width:470px} .d-tagline{font-weight:800;margin:0} .d-dots{display:inline-flex;gap:4px} .d-dots .d-dot{width:14px;height:14px}` · Ticker: `.d-ticker{background:var(--d-ink);color:var(--d-paper);height:44px;overflow:hidden;display:flex;align-items:center} .d-ticker-track{display:flex;width:max-content;animation:d-marquee 45s linear infinite} .d-ticker-set{display:flex;align-items:center;gap:24px;list-style:none;margin:0;padding:0 12px;white-space:nowrap} .d-ticker-item{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em} .d-ticker-text--paper{color:var(--d-paper)} .d-ticker-text--green{color:var(--d-green)} .d-ticker-text--yellow{color:var(--d-yellow)} @keyframes d-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}} @media (prefers-reduced-motion: reduce){.d-ticker{height:auto}.d-ticker-track{animation:none;width:auto}.d-ticker-set--dup{display:none}.d-ticker-set{flex-wrap:wrap;white-space:normal;padding-block:8px}}` · How: `.d-how{border-bottom:1px solid var(--d-ink);padding-block:48px} .d-how-steps{display:flex;flex-wrap:wrap;gap:24px;list-style:none;margin:16px 0 0;padding:0} .d-how-step{flex:1 1 min(100%, 260px);display:flex;gap:16px;align-items:flex-start} .d-how-step p{margin:0} .d-how-step strong{font-weight:800} .d-how-disc{flex:0 0 auto;width:44px;height:44px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800} .d-how-disc--1{background:var(--d-green);color:var(--d-ink)} .d-how-disc--2{background:var(--d-blue);color:var(--d-paper)} .d-how-disc--3{background:var(--d-red);color:var(--d-ink)}`.
    5. Start apps/web/__tests__/dispatch-top.test.tsx (jsdom) with these component behaviours (Task 2 adds Hero/IssueNav cases to the same file).
  </action>
  <verify>
    <automated>pnpm --filter web test -- dispatch-top dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test -- dispatch-top dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens` exits 0
    - `grep -n 'aria-hidden="true"' apps/web/components/dispatch/Ticker.tsx` matches
    - `grep -cE "<h1|<h2" apps/web/components/dispatch/DispatchMasthead.tsx` returns 0
    - `grep -n "prefers-reduced-motion: reduce" apps/web/components/dispatch/top.css` matches
    - `grep -cE "#[0-9a-fA-F]{6}" apps/web/components/dispatch/top.css` returns 0
  </acceptance_criteria>
  <done>Top bar, masthead, ticker and how strip render per spec with guard tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Hero (accent field, h1, chips, art, narrator chip) + IssueNav (sticky, scroll-spy)</name>
  <files>apps/web/components/dispatch/Hero.tsx, apps/web/components/dispatch/IssueNav.tsx, apps/web/components/dispatch/top.css, apps/web/__tests__/dispatch-top.test.tsx</files>
  <read_first>
    - apps/web/components/issue/IssueHero.tsx L90–115 (NRR-08 narrator chip guard: `narrator && narrator.active && narrator.name !== 'Jesse Eisenbalm'`, `data-testid="narrator-chip"`, copy 'Narrated by ') — re-home this rule into Hero
    - apps/web/__tests__/narrator-chip.test.ts (rules Plan 12 will re-point at Hero.tsx)
    - apps/web/lib/sanity/image.ts and apps/web/next.config.ts remotePatterns (cdn.sanity.io allowed for next/image)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure" items 4 and 6, §"Accent reserved for", §"Responsive contract"
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Responsive & a11y risks" (hero art, sticky nav rows)
  </read_first>
  <behavior>
    - Hero: root `section#story` with class d-hero; exactly one h1 whose text is `headline`; text `Issue 2 · 7-minute read`; HERO_EYEBROW pill; charity name in a `p`; dek paragraph only when dek non-null
    - chips render as `dl` with one dt/dd pair per chip; `dl` absent when chips is []
    - CTA links: READ_STORY_CTA -> '#origin'; FUND_CTA -> '#buy'
    - heroImage null -> `.d-hero-art--shapes` element with aria-hidden="true" and no img; heroImage set -> an img with the provided alt (fall back to `${charityName}` when alt null)
    - sticker shows STICKER_LINES[0] and [1]; no text 'goes here' or 'Illustration'
    - narrator chip (data-testid narrator-chip, text 'Narrated by Ada') renders only for { name 'Ada', active true }; absent for inactive, for name 'Jesse Eisenbalm', for null
    - IssueNav: nav aria-label 'In this issue'; 8 links in SECTION_META order with hrefs '#origin'…'#pod'; bonus link text = bonusLabel(bonusType); each link has an aria-hidden dot; a FUND_CTA link to '#buy'; no link has aria-current before any intersection; rendering in jsdom without IntersectionObserver does not throw
  </behavior>
  <action>
    1. Hero.tsx (server component): `<section id="story" aria-labelledby="story-title" className="d-hero"><div className="d-container d-hero-grid"><div className="d-hero-copy"><div className="d-hero-eyebrow"><span className="d-pill d-pill--ink d-pill--compact">{HERO_EYEBROW}</span><span className="d-label">{`Issue ${issueNumber} · ${readTime}`}</span>{narrator && narrator.active && narrator.name !== 'Jesse Eisenbalm' && (<span className="d-label" data-testid="narrator-chip">Narrated by {narrator.name}</span>)}</div><p className="d-body d-hero-charity">{charityName}</p><h1 id="story-title" className="d-display">{headline}</h1>{dek && <p className="d-body d-hero-dek">{dek}</p>}{chips.length > 0 && (<dl className="d-chips">{chips.map(c => <div key={c.label} className="d-chip"><dt className="d-label">{c.label}</dt><dd>{c.value}</dd></div>)}</dl>)}<div className="d-hero-ctas"><a href="#origin" className="d-pill d-pill--ink">{READ_STORY_CTA}</a><a href="#buy" className="d-pill d-pill--paper">{FUND_CTA}</a></div></div><div className="d-hero-art-wrap">{heroImage ? (<div className="d-hero-art"><Image src={heroImage.url} alt={heroImage.alt ?? charityName} fill sizes="(max-width: 640px) 100vw, 380px" className="d-hero-photo" /></div>) : (<div className="d-hero-art d-hero-art--shapes" aria-hidden="true"><span className="d-hero-circle" /><span className="d-hero-shape d-hero-shape--a" /><span className="d-hero-shape d-hero-shape--b" /></div>)}<p className="d-sticker" aria-hidden="true"><span>{STICKER_LINES[0]}</span><span>{STICKER_LINES[1]}</span></p></div></div></section>`. `import Image from 'next/image'`.
    2. IssueNav.tsx ('use client'): state `active: SectionId | null`; `useEffect`: `if (typeof IntersectionObserver === 'undefined') return`; observe `document.getElementById(id)` for each SECTION_META id with `{ rootMargin: '-64px 0px -60% 0px', threshold: 0 }`; on entries, set active to the intersecting id with the lowest SECTION_META index; disconnect on cleanup. Render `<nav aria-label="In this issue" className="d-issuenav"><div className="d-container d-issuenav-row"><p className="d-label d-issuenav-name">{charityName}</p><ul className="d-issuenav-links">{SECTION_META.map(s => <li key={s.id}><a href={`#${s.id}`} className="d-tap d-label d-issuenav-link" aria-current={active === s.id ? 'true' : undefined}><span className={`d-dot d-dot--${s.dot}`} aria-hidden="true" />{s.id === 'bonus' ? bonusLabel(bonusType) : s.navLabel}</a></li>)}</ul><a href="#buy" className="d-pill d-pill--accent d-pill--compact d-issuenav-fund">{FUND_CTA}</a></div></nav>`. No animation on active change.
    3. Append to top.css: Hero `.d-hero{background:var(--d-accent);color:var(--d-accent-ink);padding-block:48px} .d-hero-grid{display:flex;flex-wrap:wrap;gap:48px;align-items:center} .d-hero-copy{flex:1 1 min(100%, 560px);min-width:0} .d-hero-eyebrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-bottom:24px} .d-hero-charity{font-weight:800;margin:0 0 8px} .d-hero-dek{max-width:720px;line-height:1.45;margin:24px 0 0} .d-chips{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 0;padding:0} .d-chip{background:var(--d-paper);color:var(--d-ink);border:2px solid var(--d-ink);border-radius:14px;padding:8px 16px} .d-chip dt{margin:0} .d-chip dd{margin:0;font-size:18px;font-weight:800} .d-hero-ctas{display:flex;flex-wrap:wrap;gap:16px;margin-top:32px} .d-hero-art-wrap{position:relative;flex:0 1 min(100%, 380px);width:min(100%, 380px)} .d-hero-art{position:relative;width:100%;aspect-ratio:1;border:3px solid var(--d-ink);border-radius:24px;overflow:hidden;background:var(--d-paper)} .d-hero-photo{object-fit:cover} .d-hero-circle{position:absolute;inset:8%;border-radius:50%;background:var(--d-second)} .d-hero-shape{position:absolute;background:var(--d-third)} .d-hero-shape--a{left:8%;bottom:8%;width:28%;height:28%} .d-hero-shape--b{right:8%;top:8%;width:18%;height:18%;border-radius:50%} .d-sticker{position:absolute;right:-8px;bottom:-16px;width:clamp(112px, 38%, 150px);aspect-ratio:1;border-radius:50%;border:2px solid var(--d-ink);background:var(--d-fourth);color:var(--d-fourth-ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transform:rotate(10deg);font-size:14px;font-weight:800;text-align:center;margin:0}` · Nav `.d-issuenav{position:sticky;top:0;z-index:10;background:var(--d-paper);color:var(--d-ink);border-bottom:1px solid var(--d-ink)} .d-issuenav-row{display:flex;align-items:center;gap:16px} .d-issuenav-name{flex:0 0 auto;margin:0;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .d-issuenav-links{flex:1 1 auto;min-width:0;display:flex;gap:16px;overflow-x:auto;list-style:none;margin:0;padding:0;scrollbar-width:thin} .d-issuenav-link{gap:8px;white-space:nowrap;min-height:48px;color:inherit;text-decoration:none} .d-issuenav-link[aria-current="true"]{text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:6px} .d-issuenav-fund{flex:0 0 auto} @media (max-width:639px){.d-issuenav-name{display:none}}`.
    4. Extend dispatch-top.test.tsx with the Hero/IssueNav behaviours; mock next/image: `vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))`.
  </action>
  <verify>
    <automated>pnpm --filter web test -- dispatch-top dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test -- dispatch-top dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens` exits 0
    - `grep -c "<h1" apps/web/components/dispatch/Hero.tsx` returns 1
    - `grep -n "narrator.name !== 'Jesse Eisenbalm'" apps/web/components/dispatch/Hero.tsx` matches
    - `grep -n 'aria-label="In this issue"' apps/web/components/dispatch/IssueNav.tsx` matches
    - `grep -n "typeof IntersectionObserver" apps/web/components/dispatch/IssueNav.tsx` matches
    - `grep -n "position:sticky" apps/web/components/dispatch/top.css` matches and `grep -n "overflow-x:auto" apps/web/components/dispatch/top.css` matches
  </acceptance_criteria>
  <done>Hero and sticky nav render per spec; accent only in reserved slots; narrator rule preserved; tests green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test` full suite green; `pnpm --filter web typecheck` clean
- Components are not yet mounted on any route (Plan 11 composes them)
</verification>

<success_criteria>
Five top-of-page components exist, prop-driven, voice-clean, responsive-guarded and tested.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-06-SUMMARY.md`
</output>
