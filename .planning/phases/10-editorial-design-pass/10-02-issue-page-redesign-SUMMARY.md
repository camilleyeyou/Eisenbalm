---
plan: 10-02-issue-page-redesign
phase: 10-editorial-design-pass
status: complete
completed: 2026-05-19
tasks_completed: 5
tasks_total: 5
---

# Plan 10-02 — Issue Page Redesign — SUMMARY

## Outcome

Issue page (`/issue/[slug]`) now reads as an editorial magazine. Five
component files refactored to consume the Phase 10 utility classes
from Plan 10-01. Origin Story is the lead section (drop cap). Phase 2
(theme injection), Phase 7 (game iframe), and Phase 8 (CMR-09
ShopCallout) contracts all preserved — locked components byte-unchanged.

## Files Modified

| File | What changed |
|------|--------------|
| `apps/web/components/issue/EditorialSection.tsx` | Refactored to consume `.prose-measure`, `.eyebrow`, `.ornament-divider`. Added `lead?: boolean` prop that passes `.drop-cap` to PortableTextRenderer's wrapper. Headline bumped to 32/44px (was 28/36). AnchorCopyButton retained (WEB-16). |
| `apps/web/components/issue/CaseStudySection.tsx` | Subject metadata now renders in a `.metadata-block <dl>/<dt>/<dd>` panel (DES-05). Other surface aligned with EditorialSection. |
| `apps/web/components/issue/IssueHero.tsx` | Masthead treatment — eyebrow issue label, 44/64px charity name, italic "by Jesse A. Eisenbalm" byline, metadata row uses `.eyebrow` utility. h1 still the charity name (WEB-10 JSON-LD pair preserved). |
| `apps/web/components/issue/PortableTextRenderer.tsx` | Body prose bumped to 19px / 1.7 line-height. In-prose h2 bumped to 26px. Blockquote now uses `var(--color-accent)` left border (DES-06 — per-issue accent reaches into blockquote treatment). |
| `apps/web/app/issue/[slug]/page.tsx` | `lead` prop added to the Origin Story EditorialSection only (DES-02 single drop cap). Comment updated. Server Component preserved. |

## Files Verified Byte-Unchanged (Locked Contracts)

| File | Contract preserved |
|------|--------------------|
| `apps/web/components/issue/ShopCallout.tsx` | Phase 2 + Phase 8 CMR-09 (issue-page-shop-callout.test.ts: 5/5 still green) |
| `apps/web/components/issue/GameSlot.tsx` | Phase 7 GAM-03 (game-sandbox.test.ts: 3/3 still green) |
| `apps/web/app/issue/[slug]/layout.tsx` | Phase 2 serializeThemeCss theme injection mechanism untouched |
| `apps/web/app/globals.css` | NOT re-modified — utilities from Plan 10-01 consumed as-is |

`git diff --stat apps/web/components/issue/ShopCallout.tsx apps/web/components/issue/GameSlot.tsx` returns empty.

## Decisions / Deviations

1. **Optional ornament divider between BonusSection and DeliberationSlot (Task 5 Step 7)** — skipped. Per the plan's discretion clause, the current page reads cleanly between bonus and deliberation; adding a divider mid-page would compete with section-header ornament dividers above. If the redesign reveals a flat transition in UAT, this is a 1-line follow-up.
2. **`<h2>` headline size** — bumped to 32/44px (was 28/36 in Phase 2) per plan spec. Display hierarchy now reads: charity name 44/64 → section headlines 32/44 → in-prose h2 26 → body 19. Cleaner stepwise hierarchy than Phase 2's overlapping 28→22 range.
3. **Two `lead` matches in page.tsx** — one in a doc comment (`lead = drop cap per DES-02`), one in the JSX prop. The semantic intent (only ONE EditorialSection has the prop) is satisfied; the comment is intentional self-documentation. grep `<EditorialSection.*lead` returns exactly 1.

## Verification

- `pnpm --filter web build` exits 0 (Next.js 15.5.18, 20 routes, ~11s compile)
- `pnpm --filter web test:unit`: 37 pass / 29 fail — same count as pre-Phase 10. The 29 fails are Phase 8 Wave 0 sentinel tests (checkout-create-session, legal-pages, stripe-webhook-*, shop-page BuyButton) waiting for Phase 8 Plans 08-04..08-07 to land. Phase 2, 7, and 8 CMR-09 + CMR-01-server-component tests all still green.
- `grep -r "fonts.googleapis.com" apps/web` returns 0 (next/font/google is the only font loader)
- `! head -3 apps/web/app/issue/\[slug\]/page.tsx | grep -q "use client"` — Server Component preserved
- `grep -c "lead" apps/web/app/issue/\[slug\]/page.tsx` returns 2 (1 comment + 1 prop on Origin Story only)

## Commits

| Hash | Task | Title |
|------|------|-------|
| `b24bda0` | 1 | feat(10-02): refactor EditorialSection to consume Phase 10 utilities + lead prop |
| `bb5024b` | 2 | feat(10-02): render CaseStudy subjectName in .metadata-block dl panel |
| `5175391` | 3 | feat(10-02): refactor IssueHero into masthead-style charity header |
| `a568590` | 4 | feat(10-02): tune PortableTextRenderer body prose for editorial measure |
| `dc07a1d` | 5 | feat(10-02): wire lead prop onto Origin Story for drop cap (DES-02) |

## Next

Plan 10-03 (visual-regression-tests) — source-scan tripwire that locks
this redesign in place. Once 10-03 lands, the test file goes green
because the contract it scans for has been established by this plan.

Then 10-04 — README + Andrew UAT.
