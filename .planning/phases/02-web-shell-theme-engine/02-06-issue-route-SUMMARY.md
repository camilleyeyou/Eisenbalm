---
phase: 02-web-shell-theme-engine
plan: "06"
subsystem: apps/web
tags: [issue-route, theme-engine, components, json-ld, seo, reading-time, anchors]
dependency_graph:
  requires: ["02-01", "02-02", "02-03", "02-05"]
  provides: ["apps/web/app/issue/[slug]/page.tsx", "apps/web/app/issue/[slug]/layout.tsx", "apps/web/components/issue/*", "apps/web/components/AnchorCopyButton.tsx"]
  affects: ["02-09 (ShopCallout imported)", "02-07 (deliberation slot placeholder)", "Phase 7 (GameSlot hardens iframe)", "Phase 9 (DeliberationSlot, PodcastSlot wired)"]
tech_stack:
  added: []
  patterns:
    - "@portabletext/react v4 component map with editorial type scale"
    - "Two-layer theme injection: server serializeThemeCss() + client applyTheme() useEffect"
    - "shadcn Tooltip controlled open={copied} for 1500ms anchor feedback"
    - "details/summary for zero-JS collapsible slots (deliberation, podcast transcript)"
    - "iframe sandbox='allow-scripts' never allow-same-origin (security-correct from Phase 2)"
    - "ISR revalidate=60 on issue page"
    - "generateStaticParams fetches all published issue slugs at build time"
    - "JSON-LD Article schema via existing JsonLd component"
key_files:
  created:
    - apps/web/app/issue/[slug]/layout.tsx
    - apps/web/app/issue/[slug]/page.tsx
    - apps/web/components/issue/ThemeApplier.tsx
    - apps/web/components/issue/IssueHero.tsx
    - apps/web/components/issue/EditorialSection.tsx
    - apps/web/components/issue/CaseStudySection.tsx
    - apps/web/components/issue/GameSlot.tsx
    - apps/web/components/issue/BonusSection.tsx
    - apps/web/components/issue/DeliberationSlot.tsx
    - apps/web/components/issue/PodcastSlot.tsx
    - apps/web/components/issue/ShopCallout.tsx
    - apps/web/components/issue/PortableTextRenderer.tsx
    - apps/web/components/AnchorCopyButton.tsx
  modified: []
decisions:
  - "Used details/summary for deliberation accordion instead of shadcn Accordion — zero-JS progressive enhancement fits the dry Jesse register better than a shadcn animated component"
  - "BonusSection bigBudget uses max-w-[860px] (editorial wide), jingle/specAd use max-w-[680px] per UI-SPEC §Spacing"
  - "IssueHero formats publishDate in UTC with Date.UTC() to prevent day-shift on timezone boundaries"
  - "GameSlot hides iframe (display:none) in Phase 2 — security attribute sandbox='allow-scripts' is correct from Phase 2 so Phase 7 validator has the right foundation without allow-same-origin ever appearing"
  - "Build failure noted below is pre-existing env gate (NEXT_PUBLIC_SANITY_PROJECT_ID not set in CI), not caused by this plan's code"
metrics:
  duration: "7 minutes"
  completed_date: "2026-05-12"
  tasks_completed: 7
  tasks_total: 7
  files_created: 13
  files_modified: 0
---

# Phase 02 Plan 06: Issue Route Summary

Issue route with full 10-section layout, two-layer theme injection, JSON-LD, and reading time.

## What Was Built

The full `/issue/[slug]` reader experience for The Eisenbalm Dispatch.

### Components Created

**`apps/web/components/issue/PortableTextRenderer.tsx`**
`@portabletext/react` v4 component map matching the Jesse-voice editorial contract. h2/h3 use display font with primary color; p uses body font 18px/1.65; links get accent underline; ul/ol standard; strong/em marks. No decorative paragraph styling.

**`apps/web/components/AnchorCopyButton.tsx`**
Client component. `navigator.clipboard.writeText(origin + pathname + '#' + sectionId)`. shadcn Tooltip with `open={copied}` controlled state. Feedback text "Copied" fades after 1500ms. Accent color on the icon in copied state. `aria-label="Copy link to this section"`.

**`apps/web/components/issue/ThemeApplier.tsx`**
`'use client'`. `useEffect(() => { applyTheme(document.documentElement, theme) }, [theme])`. Defense-in-depth re-validation per CONTEXT.md D-10/D-11. Returns null.

**`apps/web/components/issue/IssueHero.tsx`**
Charity name as `<h1>` (Display 36px/28px mobile). Focus area, location, Est. year (UI 14px muted). Mission statement 3-line clamp. Reading time right-aligned. Issue label "Issue N — Month D, YYYY". Conditional PDF download link.

**`apps/web/components/issue/EditorialSection.tsx`**
Reusable section: divider + label + AnchorCopyButton + headline + PortableTextRenderer. Used for origin-story, problem, founder-bio.

**`apps/web/components/issue/CaseStudySection.tsx`**
Extends EditorialSection pattern with optional "Subject: {subjectName}" sub-label. id="case-study".

**`apps/web/components/issue/GameSlot.tsx`**
Editorial wide (860px). Fixed height 360px/280px. Phase 2 placeholder: "Interactive version of this section is loading." Hidden iframe with `sandbox="allow-scripts"` (never allow-same-origin) present but display:none — security-correct from Phase 2.

**`apps/web/components/issue/BonusSection.tsx`**
Branches on bonusType: bigBudget (860px, storyboard image grid), jingle (680px, HTML5 audio + lyrics block, empty state copy), specAd (680px, body only). Labels per UI-SPEC copywriting contract.

**`apps/web/components/issue/DeliberationSlot.tsx`**
details/summary accordion. Trigger: "How this issue was made". Empty state: "Deliberation data will appear here when the pipeline is connected." Phase 9 wires Convex.

**`apps/web/components/issue/PodcastSlot.tsx`**
If audioUrl: `<audio controls>` + description. Else "Audio coming soon." Collapsible transcript toggle "Read the deliberation transcript".

**`apps/web/components/issue/ShopCallout.tsx`**
Full-width surface. Exact copy: "Jesse A. Eisenbalm lip balm. 100% of proceeds go to this week's featured charity." + "Buy the lip balm" link. Phase 8 wires Stripe href.

### Route Files

**`apps/web/app/issue/[slug]/layout.tsx`**
Layer 1 (server): fetches issue theme via QUERY_ISSUE_THEME, calls `serializeThemeCss(theme)`, inlines `<style dangerouslySetInnerHTML>` before children. Layer 2 (client): renders `<ThemeApplier theme={theme} />`. Graceful fallback to brand defaults on fetch error.

**`apps/web/app/issue/[slug]/page.tsx`**
- `export const revalidate = 60` (ISR)
- `generateStaticParams`: fetches all published issue slugs
- `generateMetadata`: per-issue title, description, OG/Twitter card, canonical URL, static OG image fallback
- 10 sections in locked order per docs/CLAUDE_CODE_BRIEF.md
- JSON-LD Article schema: headline, datePublished, author (Organization: Jesse A. Eisenbalm), about (NGO), publisher
- `readingTime()` from originStory + problemStatement + founderBio + caseStudy + bonus body fields
- `notFound()` on null/unpublished issue

## Deviations from Plan

None — plan executed exactly as written. All critical rules honored:
- 10-section order matches CLAUDE_CODE_BRIEF.md and UI-SPEC
- Two-layer theme injection present (server + client)
- sandbox="allow-scripts" on iframe, never allow-same-origin
- No exclamation marks in any copy string
- No model name mentions in any UI string

## Build Note

`pnpm --filter web build` fails with `Error: Configuration must contain 'projectId'` originating from `apps/web/app/feed.xml/route.ts` (plan 02-07) because `NEXT_PUBLIC_SANITY_PROJECT_ID` is not set in the shell environment. This is the documented env gate from CONTEXT.md D-28 ("Copy apps/web/.env.example to apps/web/.env.local and fill in the project ID"). The failure is pre-existing and not caused by this plan's code. `pnpm --filter web typecheck` exits 0.

## Self-Check: PASSED

Files created (spot check):
- apps/web/app/issue/[slug]/layout.tsx — present
- apps/web/app/issue/[slug]/page.tsx — present
- apps/web/components/issue/ThemeApplier.tsx — present (has 'use client', useEffect, applyTheme)
- apps/web/components/AnchorCopyButton.tsx — present (has 'use client', navigator.clipboard, Tooltip)

Commits (7 task commits):
- 2a7a3db feat(02-06): PortableTextRenderer with editorial component map
- a73cddd feat(02-06): AnchorCopyButton + ThemeApplier client components
- 1f6ea18 feat(02-06): IssueHero, EditorialSection, CaseStudySection
- 21e022e feat(02-06): GameSlot, BonusSection, DeliberationSlot, PodcastSlot
- 65df8dc feat(02-06): ShopCallout component
- 983b894 feat(02-06): issue layout with two-layer theme injection
- 318451e feat(02-06): full issue page with 10 sections, JSON-LD, generateMetadata
