---
phase: 55-public-site-redesign
plan: 08
type: execute
wave: 2
depends_on: [55-01, 55-02, 55-03, 55-04]
files_modified:
  - apps/web/components/dispatch/BackIssues.tsx
  - apps/web/components/dispatch/NewsletterForm.tsx
  - apps/web/components/dispatch/DispatchFooter.tsx
  - apps/web/components/dispatch/footer.css
  - apps/web/__tests__/back-issues-search.test.tsx
  - apps/web/__tests__/newsletter-form.test.tsx
autonomous: true
requirements: [P55-SC1, P55-SC2, P55-SC6, PUB-10, PUB-12]

must_haves:
  truths:
    - "A visitor sees up to 8 earlier nonprofits as colour cards (each in its own issue's accent) and can search them by name, cause or issue number"
    - "Search results are announced via aria-live; a no-match state reads in Jesse's voice"
    - "A visitor can submit an email in the footer and gets one generic success line whether or not they were already subscribed"
    - "The footer is a contentinfo landmark outside <main>, with Privacy/Terms links that are >= 44px targets"
  artifacts:
    - path: "apps/web/components/dispatch/BackIssues.tsx"
      provides: "#back-issues grid + client search"
      exports: ["BackIssues"]
    - path: "apps/web/components/dispatch/NewsletterForm.tsx"
      provides: "Labelled email form posting to /api/email/subscribe"
      exports: ["NewsletterForm"]
    - path: "apps/web/components/dispatch/DispatchFooter.tsx"
      provides: "<footer id=about class=dispatch> with wordmark, blurb, form, legal"
      exports: ["DispatchFooter"]
  key_links:
    - from: "apps/web/components/dispatch/NewsletterForm.tsx"
      to: "/api/email/subscribe"
      via: "fetch POST { email, company }"
      pattern: "/api/email/subscribe"
    - from: "apps/web/components/dispatch/BackIssues.tsx"
      to: "lib/dispatch/derive.ts filterIssues + lib/brand.ts toneForIssue"
      via: "imports"
      pattern: "filterIssues|toneForIssue"
---

<objective>
Build the bottom of the front page: the back-issues grid with client-side search, the working newsletter form, and the Dispatch footer.

Purpose: SC-1 (back-issues grid + footer from the mockup), the "archive search" and "working email signup" scope items, SC-6 a11y.
Output: 3 components, footer.css, 2 jsdom tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/55-public-site-redesign/55-UI-SPEC.md
@apps/web/app/dispatch.css
@apps/web/lib/dispatch/copy.ts
@apps/web/lib/dispatch/derive.ts
@apps/web/lib/brand.ts

<interfaces>
```typescript
// lib/sanity/types.ts
export type ArchiveIssue = { issueNumber: number; publishDate: string; slug: string; bonusType: BonusType; charity: { name: string; slug: string; location: string; focusArea: string | null; assetRange: string | null } }
// derive.ts: filterIssues(issues, query), backIssues(archive, currentIssueNumber, limit = 8), monthYearLabel(publishDate)
// brand.ts: toneForIssue(n): 'green'|'blue'|'red'|'yellow'  (dispatch.css has .d-tone-green|blue|red|yellow incl. ink colour)
// copy.ts: BACK_ISSUES_HEADING, SEARCH_LABEL, SEARCH_PLACEHOLDER, SEE_ALL, searchStatus, SEARCH_EMPTY, ARCHIVE_EMPTY, NEWSLETTER_LABEL, NEWSLETTER_BUTTON, NEWSLETTER_SENDING, NEWSLETTER_SUCCESS, NEWSLETTER_ERROR, FOOTER_BLURB, MASTHEAD_WORDMARK, COPYRIGHT_HOLDER
// POST /api/email/subscribe body { email, company? } -> 200 { ok: true } | 4xx/5xx { ok: false, error }
```
Created:
```typescript
export function BackIssues(p: { issues: ArchiveIssue[]; currentIssueNumber: number | null }): JSX.Element   // 'use client'
export function NewsletterForm(): JSX.Element                                                              // 'use client'
export function DispatchFooter(): JSX.Element                                                              // server
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: BackIssues grid + search</name>
  <files>apps/web/components/dispatch/BackIssues.tsx, apps/web/components/dispatch/footer.css, apps/web/__tests__/back-issues-search.test.tsx</files>
  <read_first>
    - apps/web/lib/dispatch/derive.ts (filterIssues, backIssues, monthYearLabel)
    - apps/web/__tests__/fixtures/issue.ts (archiveIssues fixture)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure" item 9 and "Back-issues search" row
  </read_first>
  <behavior>
    - With archiveIssues and currentIssueNumber 10: renders `section#back-issues` with h2 BACK_ISSUES_HEADING; 8 card links (issues 9..2) each `href="/issue/{slug}"`, class `d-tone-{toneForIssue(n)}`, meta text `No. {n} · {Month YYYY}`, title = charity name, subtitle = focusArea when present
    - The search input has a visible `<label>` SEARCH_LABEL, type="search", placeholder SEARCH_PLACEHOLDER
    - Typing '3' shows only issue 3 and the `[role="status"]` region reads '1 nonprofit'; typing a cause substring in different case matches; clearing restores the latest 8
    - Typing 'zzzz' shows SEARCH_EMPTY inside the grid area
    - issues [] (or only the current issue) shows ARCHIVE_EMPTY and no search input
    - 'See them all →' link points to '/archive' and has class d-tap
  </behavior>
  <action>
    'use client'; `import './footer.css'`. `const base = issues.filter(i => i.issueNumber !== currentIssueNumber)`; `const shown = query.trim() ? filterIssues(base, query) : backIssues(issues, currentIssueNumber, 8)`. Markup: `<section id="back-issues" aria-labelledby="back-issues-title" className="d-back"><div className="d-container"><div className="d-back-head"><h2 id="back-issues-title" className="d-heading">{BACK_ISSUES_HEADING}</h2>{base.length > 0 && <div className="d-back-search"><label htmlFor="d-back-search" className="d-label">{SEARCH_LABEL}</label><input id="d-back-search" type="search" className="d-input" placeholder={SEARCH_PLACEHOLDER} value={query} onChange={e => setQuery(e.target.value)} /></div>}<a href="/archive" className="d-tap d-label d-link">{SEE_ALL}</a></div><p role="status" aria-live="polite" className="d-sr-only">{query.trim() ? searchStatus(shown.length) : ''}</p>{base.length === 0 ? <p className="d-body">{ARCHIVE_EMPTY}</p> : shown.length === 0 ? <p className="d-body">{SEARCH_EMPTY}</p> : <ul className="d-back-grid">{shown.map(i => <li key={i.slug}><a href={`/issue/${i.slug}`} className={`d-backcard d-tone-${toneForIssue(i.issueNumber)}`}><p className="d-label">{`No. ${i.issueNumber}${monthYearLabel(i.publishDate) ? ` · ${monthYearLabel(i.publishDate)}` : ''}`}</p><p className="d-backcard-title">{i.charity.name}</p>{i.charity.focusArea && <p className="d-body d-backcard-sub">{i.charity.focusArea}</p>}</a></li>)}</ul>}</div></section>`.
    footer.css (vars only): `.d-back{padding-block:64px;background:var(--d-paper);color:var(--d-ink)} .d-back-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px 24px;border-bottom:4px solid var(--d-ink);padding-bottom:16px;margin-bottom:24px} .d-back-search{display:flex;flex-direction:column;gap:4px;flex:1 1 min(100%, 240px);max-width:240px} .d-input{min-height:44px;width:100%;max-width:240px;border:2px solid var(--d-ink);border-radius:999px;padding:0 16px;font:inherit;font-size:18px;background:var(--d-paper);color:var(--d-ink)} .d-back-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(min(100%, 200px), 1fr));gap:24px;list-style:none;margin:0;padding:0} .d-backcard{display:flex;flex-direction:column;gap:8px;min-height:168px;padding:24px;border:2px solid var(--d-ink);border-radius:20px;text-decoration:none} .d-backcard p{margin:0} .d-backcard-title{font-size:18px;font-weight:800;line-height:1.35;overflow-wrap:anywhere} .d-backcard-sub{line-height:1.45}`. Card text colour comes from `.d-tone-*` (ink or white per inkFor); no `.d-muted` on coloured cards.
  </action>
  <verify>
    <automated>pnpm --filter web test -- back-issues-search dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -n 'type="search"' apps/web/components/dispatch/BackIssues.tsx` and `grep -n 'htmlFor="d-back-search"' apps/web/components/dispatch/BackIssues.tsx` match
    - `grep -n 'aria-live="polite"' apps/web/components/dispatch/BackIssues.tsx` matches
    - `grep -n "minmax(min(100%, 200px), 1fr)" apps/web/components/dispatch/footer.css` matches
  </acceptance_criteria>
  <done>Back-issues grid with accessible, tested search.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: NewsletterForm + DispatchFooter</name>
  <files>apps/web/components/dispatch/NewsletterForm.tsx, apps/web/components/dispatch/DispatchFooter.tsx, apps/web/components/dispatch/footer.css, apps/web/__tests__/newsletter-form.test.tsx</files>
  <read_first>
    - apps/web/components/SiteFooter.tsx (current footer content/links — legal paths)
    - apps/web/app/legal (confirm /legal/privacy and /legal/terms routes exist)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md "Newsletter form" row, Footer item 10
    - apps/web/app/api/email/subscribe/route.ts (contract from Plan 04; if not yet merged use the interface above)
  </read_first>
  <behavior>
    - Form has a visible label NEWSLETTER_LABEL bound to an input type="email" required name="email"; a honeypot input name="company" inside an aria-hidden wrapper with tabIndex -1 and autoComplete off
    - Submit posts JSON { email, company } to '/api/email/subscribe'; while pending the button is disabled and reads NEWSLETTER_SENDING
    - 200 { ok: true } -> `[aria-live="polite"]` reads NEWSLETTER_SUCCESS and the input clears; any non-ok or thrown fetch -> NEWSLETTER_ERROR and the button re-enables
    - DispatchFooter: `footer#about` with classes `dispatch d-footer`; contains wordmark text (not a heading element h1), FOOTER_BLURB, the form, `© {current UTC year} Jesse A. Eisenbalm`, links '/legal/privacy' and '/legal/terms' with class d-tap
  </behavior>
  <action>
    1. NewsletterForm.tsx ('use client'; `import './footer.css'`): status state 'idle'|'sending'|'success'|'error'; `onSubmit(e)`: preventDefault; read FormData; `fetch('/api/email/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, company }) })`; `res.ok && (await res.json()).ok === true` -> success + form.reset(); else error. Markup: `<form className="d-newsletter" onSubmit={onSubmit} noValidate={false}><label htmlFor="d-nl-email" className="d-label">{NEWSLETTER_LABEL}</label><div className="d-newsletter-row"><input id="d-nl-email" name="email" type="email" required autoComplete="email" className="d-input d-input--wide" /><button type="submit" className="d-pill d-pill--ink" disabled={status === 'sending'}>{status === 'sending' ? NEWSLETTER_SENDING : NEWSLETTER_BUTTON}</button></div><div className="d-hp" aria-hidden="true"><label htmlFor="d-nl-company">Company</label><input id="d-nl-company" name="company" type="text" tabIndex={-1} autoComplete="off" /></div><p className="d-label d-newsletter-status" aria-live="polite">{status === 'success' ? NEWSLETTER_SUCCESS : status === 'error' ? NEWSLETTER_ERROR : ''}</p></form>`. Do not promise cadence or delivery.
    2. DispatchFooter.tsx (server; `import Link from 'next/link'`; `import './footer.css'`): `<footer id="about" className="dispatch d-footer"><div className="d-container d-footer-grid"><div className="d-footer-brand"><p className="d-heading">{MASTHEAD_WORDMARK}</p><p className="d-body d-muted">{FOOTER_BLURB}</p></div><NewsletterForm /></div><div className="d-container"><p className="d-label d-muted d-footer-legal">© {new Date().getUTCFullYear()} {COPYRIGHT_HOLDER} · <Link href="/legal/privacy" className="d-tap d-link">Privacy</Link> · <Link href="/legal/terms" className="d-tap d-link">Terms</Link></p></div></footer>`. (It carries its own `.dispatch` class because it renders outside the issue wrapper.)
    3. Append to footer.css: `.d-footer{border-top:4px solid var(--d-ink);padding-block:48px} .d-footer-grid{display:flex;flex-wrap:wrap;gap:48px;justify-content:space-between} .d-footer-brand{flex:1 1 min(100%, 420px)} .d-newsletter{flex:1 1 min(100%, 420px);display:flex;flex-direction:column;gap:8px} .d-newsletter-row{display:flex;flex-wrap:wrap;gap:8px} .d-input--wide{max-width:none;flex:1 1 min(100%, 240px)} .d-hp{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden} .d-newsletter-status{min-height:1.35em;margin:0} .d-footer-legal{margin:24px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:0 8px}`.
    4. newsletter-form.test.tsx (jsdom) with mocked global fetch for both components' behaviours.
  </action>
  <verify>
    <automated>pnpm --filter web test -- newsletter-form back-issues-search dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -n 'type="email"' apps/web/components/dispatch/NewsletterForm.tsx` and `grep -n 'name="company"' apps/web/components/dispatch/NewsletterForm.tsx` match
    - `grep -n "/api/email/subscribe" apps/web/components/dispatch/NewsletterForm.tsx` matches
    - `grep -n 'id="about"' apps/web/components/dispatch/DispatchFooter.tsx` matches and `grep -c "<main" apps/web/components/dispatch/DispatchFooter.tsx` returns 0
    - `grep -ciE "weekly email|every thursday we will email|inbox" apps/web/components/dispatch/NewsletterForm.tsx` returns 0 (no delivery promise)
  </acceptance_criteria>
  <done>Footer and working signup form exist, accessible and tested.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test` full suite green; `pnpm --filter web typecheck` clean
</verification>

<success_criteria>
Back issues + search, newsletter form and footer built to UI-SPEC; tests green.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-08-SUMMARY.md`
</output>
