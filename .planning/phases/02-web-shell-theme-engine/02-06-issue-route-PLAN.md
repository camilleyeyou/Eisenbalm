---
phase: 02-web-shell-theme-engine
plan: 06
type: execute
wave: 3
depends_on: ["02-01", "02-02", "02-03", "02-05"]
files_modified:
  - apps/web/app/issue/[slug]/page.tsx
  - apps/web/app/issue/[slug]/layout.tsx
  - apps/web/components/issue/IssueHero.tsx
  - apps/web/components/issue/EditorialSection.tsx
  - apps/web/components/issue/CaseStudySection.tsx
  - apps/web/components/issue/GameSlot.tsx
  - apps/web/components/issue/BonusSection.tsx
  - apps/web/components/issue/DeliberationSlot.tsx
  - apps/web/components/issue/PodcastSlot.tsx
  - apps/web/components/issue/ShopCallout.tsx
  - apps/web/components/issue/PortableTextRenderer.tsx
  - apps/web/components/issue/ThemeApplier.tsx
  - apps/web/components/AnchorCopyButton.tsx
autonomous: true
requirements: [WEB-02, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10, WEB-11, WEB-14, WEB-15, WEB-16]
must_haves:
  truths:
    - "/issue/[slug] renders 10 sections in the locked order from UI-SPEC §'/issue/[slug]'"
    - "Per-issue theme is injected via inline <style> with serializeThemeCss() (validated, no FOUC)"
    - "<ThemeApplier> client component re-runs applyTheme() on hydration as defense-in-depth (CONTEXT.md D-10/D-11)"
    - "Each section has an id (origin-story, problem, founder-bio, case-study, game, bonus, deliberation, podcast) and an <AnchorCopyButton> client-side button"
    - "<AnchorCopyButton> uses shadcn <Tooltip> (installed in Plan 02-05) to render the 'Copied' feedback per UI-SPEC §9"
    - "JSON-LD schema.org/Article includes charity name, founder, publish date, author=Jesse"
    - "OG + Twitter card tags are emitted via generateMetadata"
    - "Reading time '{N} min read' renders in IssueHero from Portable Text body word count"
    - "Bonus section branches by bonusType (bigBudget | jingle | specAd) per UI-SPEC §5"
    - "Game / deliberation / podcast slots render the Phase 2 empty-state copy"
  artifacts:
    - path: apps/web/app/issue/[slug]/page.tsx
      provides: "Full issue RSC: GROQ fetch, generateMetadata, generateStaticParams, 10-section render, JSON-LD, ThemeApplier mount"
      min_lines: 100
    - path: apps/web/app/issue/[slug]/layout.tsx
      provides: "Inline <style> theme injection before children render (no FOUC)"
    - path: apps/web/components/issue/ThemeApplier.tsx
      provides: "Client component: useEffect re-runs applyTheme(document.documentElement, theme) on hydration — defense-in-depth per CONTEXT.md D-10/D-11"
    - path: apps/web/components/issue/IssueHero.tsx
      provides: "Charity header: name, location, focus, founding, reading time, publish label, PDF download"
    - path: apps/web/components/issue/EditorialSection.tsx
      provides: "Reusable section: label, headline, Portable Text body, anchor copy button"
    - path: apps/web/components/issue/CaseStudySection.tsx
      provides: "Case study with optional subject name + body"
    - path: apps/web/components/issue/GameSlot.tsx
      provides: "Phase 2 placeholder with 'Interactive version of this section is loading.'"
    - path: apps/web/components/issue/BonusSection.tsx
      provides: "Branches on bonusType — bigBudget/jingle/specAd"
    - path: apps/web/components/issue/DeliberationSlot.tsx
      provides: "Collapsed accordion with 'How this issue was made'"
    - path: apps/web/components/issue/PodcastSlot.tsx
      provides: "'Audio coming soon.' empty state with collapsible transcript toggle"
    - path: apps/web/components/issue/ShopCallout.tsx
      provides: "Static one-sentence + 'Buy the lip balm' link (Phase 8 wires Stripe; Plan 02-09 upgrades to shadcn Button)"
    - path: apps/web/components/issue/PortableTextRenderer.tsx
      provides: "@portabletext/react renderer with editorial component map"
    - path: apps/web/components/AnchorCopyButton.tsx
      provides: "Client component: navigator.clipboard.writeText + shadcn <Tooltip> 'Copied' feedback (1500ms)"
  key_links:
    - from: apps/web/app/issue/[slug]/layout.tsx
      to: apps/web/lib/theme.ts (serializeThemeCss)
      via: "inline <style> built from validated theme"
      pattern: "serializeThemeCss\\(.*theme"
    - from: apps/web/components/issue/ThemeApplier.tsx
      to: apps/web/lib/theme.ts (applyTheme)
      via: "useEffect on mount + theme change"
      pattern: "applyTheme\\("
    - from: apps/web/app/issue/[slug]/page.tsx
      to: apps/web/lib/sanity/queries.ts (QUERY_ISSUE_BY_SLUG)
      via: "sanityClient.fetch with $slug param"
      pattern: "QUERY_ISSUE_BY_SLUG"
    - from: apps/web/components/AnchorCopyButton.tsx
      to: apps/web/components/ui/tooltip.tsx (shadcn Tooltip)
      via: "<Tooltip>/<TooltipTrigger>/<TooltipContent> wrapper for 'Copied' feedback"
      pattern: "components/ui/tooltip"
    - from: apps/web/components/AnchorCopyButton.tsx
      to: navigator.clipboard.writeText
      via: "client-side onClick"
      pattern: "navigator\\.clipboard\\.writeText"
    - from: apps/web/app/issue/[slug]/page.tsx
      to: apps/web/components/JsonLd.tsx
      via: "schema.org/Article render"
      pattern: "@type.*Article"
---

<objective>
Ship the issue route — the central reader experience. Render `/issue/[slug]` with all 10 sections in the locked UI-SPEC order, inject the per-issue theme via validated CSS variables both server-side (inline `<style>` for FOUC-free first paint) AND client-side (`<ThemeApplier>` defense-in-depth per CONTEXT.md D-10/D-11), compute reading time, emit `schema.org/Article` JSON-LD plus OG/Twitter metadata, and wire every section's anchor-copy button with shadcn `<Tooltip>` "Copied" feedback.

This plan delivers the highest density of WEB-* requirements in Phase 2. Slot placeholders for game (Phase 7), deliberation (Phase 9), and podcast (Phase 9) match UI-SPEC empty-state copy exactly. shadcn `<Tooltip>` is installed by Plan 02-05; this plan only consumes it.

Purpose: This is the magazine. Wave 2 built the chrome; Wave 3's issue route makes the chrome show actual editorial content.
Output: A fully rendered `/issue/[slug]` page that loads against the demo seed from Plan 02-04 and shows the cream/navy/mustard theme.

**Why 7 tasks (at the warning threshold):** All seven tasks build components in the same `apps/web/components/issue/` namespace against the same UI-SPEC sections. Each task depends on the prior (PortableTextRenderer → EditorialSection → IssueHero → page.tsx etc.) and shares the same UI-SPEC §1-§9 read context. Splitting would force the executor to re-read UI-SPEC and re-establish the section ID/copy contract in each sub-plan. The per-file complexity is low — most tasks are template-following file creation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md
@.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md
@CLAUDE.md
@docs/CLAUDE_CODE_BRIEF.md
@docs/API_CONTRACTS.md
@apps/studio/schemas/weeklyIssue.ts
@apps/studio/schemas/charity.ts
@apps/web/lib/sanity/client.ts
@apps/web/lib/sanity/queries.ts
@apps/web/lib/sanity/types.ts
@apps/web/lib/theme.ts
@apps/web/lib/reading-time.ts
@apps/web/lib/site.ts
@apps/web/lib/format.ts
@apps/web/components/JsonLd.tsx
@apps/web/components/ui/tooltip.tsx

<interfaces>
<!-- Section IDs (UI-SPEC §EditorialSection — used by AnchorCopyButton and print rules): -->
- origin-story, problem, founder-bio, case-study, game, bonus, deliberation, podcast

<!-- Copy strings (UI-SPEC Copywriting Contract — exact, no edits): -->
- Reading time format:            "{N} min read"
- Issue label:                    "Issue {N} — {Month D, YYYY}"
- PDF download link:              "Download the problem framework"
- Game slot message:              "Interactive version of this section is loading."
- Jingle empty audio:             "The audio for this jingle is being produced. Lyrics below."
- Deliberation accordion trigger: "How this issue was made"
- Deliberation empty state:       "Deliberation data will appear here when the pipeline is connected."
- Podcast empty audio:            "Audio coming soon."
- Podcast transcript toggle:      "Read the deliberation transcript"
- Shop callout sentence:          "Jesse A. Eisenbalm lip balm. 100% of proceeds go to this week's featured charity."
- Shop button:                    "Buy the lip balm"
- Anchor tooltip:                 "Copied"
- Anchor aria-label:              "Copy link to this section"
- Case study subject prefix:      "Subject: {subjectName}"
- Bonus sub-labels:               "BIG BUDGET TREATMENT" | "THE JINGLE" | "THE SPEC AD"
- Bonus label:                    "THE BONUS"
- Game label:                     "THE GAME"
- Origin story label:             "ORIGIN STORY"
- Problem label:                  "THE PROBLEM"
- Founder bio label:              "FOUNDER BIO"
- Case study label:               "CASE STUDY"
- Podcast label:                  "THE PODCAST"

<!-- Section order (UI-SPEC §/issue/[slug] — LOCKED): -->
1. IssueHero          (charity header)
2. EditorialSection   (originStory, id=#origin-story)
3. EditorialSection   (problemStatement, id=#problem)
4. EditorialSection   (founderBio, id=#founder-bio)
5. CaseStudySection   (caseStudy, id=#case-study)
6. GameSlot           (id=#game)
7. BonusSection       (id=#bonus)
8. DeliberationSlot   (id=#deliberation)
9. PodcastSlot        (id=#podcast)
10. ShopCallout       (no id — not an anchor target)

<!-- JSON-LD Article shape (UI-SPEC §"JSON-LD"): -->
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{issue.originStory.headline or charity.name}",
  "datePublished": "{issue.publishDate}",
  "author": { "@type": "Organization", "name": "Jesse A. Eisenbalm" },
  "about": {
    "@type": "NGO",
    "name": "{charity.name}",
    "url": "{charity.website}",
    "location": "{charity.location}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "The Eisenbalm Dispatch",
    "url": "https://eisenbalm.com"   ← use getSiteUrl() at runtime
  }
}

<!-- Container widths (UI-SPEC Spacing): -->
- editorial:       max-width 680px
- editorial-wide:  max-width 860px

<!-- Theme injection pattern (CONTEXT.md D-10 + D-11 + UI-SPEC §"/issue/[slug]"): -->
TWO LAYERS — both required:
1. SERVER LAYER (FOUC-free first paint): /issue/[slug]/layout.tsx emits
   <style dangerouslySetInnerHTML={{__html: serializeThemeCss(theme)}} /> in
   the layout's returned JSX. serializeThemeCss validates every value; safe to inline.
2. CLIENT LAYER (defense-in-depth re-validation): <ThemeApplier theme={issue.theme} />
   client component runs applyTheme(document.documentElement, theme) inside useEffect
   on mount + when theme changes. This is the D-10 requirement: applyTheme runs both
   server-side (via the inline <style>) AND client-side (this component) so that any
   client-side mutation that bypasses the inline style still re-validates against the
   hex regex, font whitelist, and WCAG contrast check.

<!-- shadcn Tooltip pattern (installed by Plan 02-05): -->
Plan 02-05 installs components/ui/tooltip.tsx (shadcn) and wraps the root layout in
<TooltipProvider delayDuration={0}>. <AnchorCopyButton> imports:
  import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
and renders:
  <Tooltip open={copied}>
    <TooltipTrigger asChild><button .../></TooltipTrigger>
    <TooltipContent side="top">Copied</TooltipContent>
  </Tooltip>
The `open={copied}` controlled mode makes the tooltip appear only when the local
state flips, matching UI-SPEC §"Component Inventory": "Delay: 0ms (appears immediately
on 'Copied' state change, not on hover). Placement: top."
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: AnchorCopyButton client component (with shadcn Tooltip)</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §9 AnchorCopyButton
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-07 shadcn scope, D-25 anchor copy behavior)
    - apps/web/components/ui/tooltip.tsx (installed by Plan 02-05 — confirm shape: Tooltip / TooltipTrigger / TooltipContent / TooltipProvider exports)
  </read_first>
  <files>apps/web/components/AnchorCopyButton.tsx</files>
  <action>
    Create `apps/web/components/AnchorCopyButton.tsx`. Client component. lucide-react `Link` + `Check` icons. 1500ms "Copied" state. Uses shadcn `<Tooltip>` (installed in Plan 02-05) for the "Copied" feedback, per CONTEXT.md D-07 and UI-SPEC §"Component Inventory".

    ```typescript
    'use client'

    import { useState, useCallback } from 'react'
    import { Link as LinkIcon, Check } from 'lucide-react'
    import {
      Tooltip,
      TooltipTrigger,
      TooltipContent,
    } from '@/components/ui/tooltip'

    export function AnchorCopyButton({ sectionId }: { sectionId: string }) {
      const [copied, setCopied] = useState(false)

      const handleClick = useCallback(async () => {
        try {
          const url =
            typeof window !== 'undefined'
              ? `${window.location.origin}${window.location.pathname}#${sectionId}`
              : `#${sectionId}`
          await navigator.clipboard.writeText(url)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch {
          // Per UI-SPEC: silent no-op on clipboard failure. Do not crash.
        }
      }, [sectionId])

      // shadcn Tooltip in controlled mode: `open={copied}` makes the tooltip
      // appear only when state flips to true, matching UI-SPEC §"Component
      // Inventory": Delay 0ms, on copy state change (not hover). The
      // <TooltipProvider> is mounted once in the root layout (Plan 02-05).
      return (
        <Tooltip open={copied}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              aria-label="Copy link to this section"
              data-anchor-copy
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--color-text-muted)] hover:text-[color:var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] focus-visible:outline-offset-2"
            >
              {copied ? (
                <>
                  <Check size={16} aria-hidden="true" />
                  <span className="sr-only">Copied</span>
                </>
              ) : (
                <LinkIcon size={16} aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" role="status" aria-live="polite">
            Copied
          </TooltipContent>
        </Tooltip>
      )
    }
    ```

    Notes:
    - `data-anchor-copy` is the print-stylesheet selector defined in Plan 02-05 globals.css.
    - 44x44px touch target via `h-11 w-11` (Tailwind 11 = 44px).
    - Tooltip is CONTROLLED via `open={copied}` — it does NOT respond to hover. This matches UI-SPEC §"Component Inventory": "tooltip appears immediately on 'Copied' state change, not on hover."
    - `<TooltipTrigger asChild>` lets the button be the trigger element directly (no extra DOM node).
    - `<TooltipContent role="status" aria-live="polite">` ensures screen readers announce "Copied" without needing the visible tooltip to be focused.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/components/AnchorCopyButton.tsx && \
      grep -q "'use client'" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "navigator\.clipboard\.writeText" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "Copy link to this section" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "Copied" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "data-anchor-copy" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "1500" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "lucide-react" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "@/components/ui/tooltip" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "TooltipTrigger" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "TooltipContent" apps/web/components/AnchorCopyButton.tsx && \
      grep -q "open={copied}" apps/web/components/AnchorCopyButton.tsx
    </automated>
  </verify>
  <done>
    Client component copies `origin + pathname + #sectionId` to clipboard, shows shadcn `<Tooltip>` with "Copied" content for 1500ms via controlled `open={copied}`, falls back silently on clipboard API failure, carries the print-hide data attribute. Imports `<Tooltip>` from `@/components/ui/tooltip` (installed by Plan 02-05).
  </done>
</task>

<task type="auto">
  <name>Task 2: PortableTextRenderer with editorial component map</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md (Typography Body row; "no decorative paragraph styling")
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-04)
  </read_first>
  <files>apps/web/components/issue/PortableTextRenderer.tsx</files>
  <action>
    Create `apps/web/components/issue/PortableTextRenderer.tsx`:

    ```typescript
    import { PortableText, type PortableTextComponents } from '@portabletext/react'
    import type { PortableTextBlock } from '@portabletext/react'

    /**
     * Editorial Portable Text renderer. Plain, restrained — no decorative
     * paragraph styles that would break Jesse's dry register.
     */
    const components: PortableTextComponents = {
      block: {
        normal: ({ children }) => (
          <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
            {children}
          </p>
        ),
        h2: ({ children }) => (
          <h2 className="mt-10 font-display text-[22px] font-semibold text-[color:var(--color-text)]">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-8 font-display text-[20px] font-semibold text-[color:var(--color-text)]">
            {children}
          </h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mt-6 border-l-2 border-[color:var(--color-border)] pl-4 italic text-[color:var(--color-text)]">
            {children}
          </blockquote>
        ),
      },
      marks: {
        link: ({ value, children }) => {
          const href = typeof value?.href === 'string' ? value.href : '#'
          const isExternal = /^https?:\/\//.test(href)
          return (
            <a
              href={href}
              className="underline decoration-[color:var(--color-accent)] underline-offset-4 hover:text-[color:var(--color-accent)]"
              {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {children}
            </a>
          )
        },
        em: ({ children }) => <em className="italic">{children}</em>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      },
      list: {
        bullet: ({ children }) => (
          <ul className="mt-4 list-disc pl-6 text-[18px] text-[color:var(--color-text)]">
            {children}
          </ul>
        ),
        number: ({ children }) => (
          <ol className="mt-4 list-decimal pl-6 text-[18px] text-[color:var(--color-text)]">
            {children}
          </ol>
        ),
      },
      listItem: {
        bullet: ({ children }) => <li className="mt-2">{children}</li>,
        number: ({ children }) => <li className="mt-2">{children}</li>,
      },
    }

    export function PortableTextRenderer({
      value,
    }: {
      value: PortableTextBlock[] | null | undefined
    }) {
      if (!value || value.length === 0) return null
      return <PortableText value={value} components={components} />
    }
    ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/components/issue/PortableTextRenderer.tsx && \
      grep -q "@portabletext/react" apps/web/components/issue/PortableTextRenderer.tsx && \
      grep -q "PortableTextRenderer" apps/web/components/issue/PortableTextRenderer.tsx && \
      grep -q "blockquote" apps/web/components/issue/PortableTextRenderer.tsx && \
      grep -q "rel=\"noopener noreferrer\"" apps/web/components/issue/PortableTextRenderer.tsx
    </automated>
  </verify>
  <done>
    `<PortableTextRenderer value={blocks} />` renders the editorial component map: normal p with body font 18px/1.65, h2/h3, blockquote, marks (link with external rel, em, strong), bullet/number lists. External links carry `rel="noopener noreferrer"`.
  </done>
</task>

<task type="auto">
  <name>Task 3: EditorialSection + CaseStudySection components</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §2 EditorialSection, §3 CaseStudySection
  </read_first>
  <files>apps/web/components/issue/EditorialSection.tsx, apps/web/components/issue/CaseStudySection.tsx</files>
  <action>
    1. Create `apps/web/components/issue/EditorialSection.tsx`:

       ```typescript
       import type { PortableTextBlock } from '@portabletext/react'
       import { AnchorCopyButton } from '../AnchorCopyButton'
       import { PortableTextRenderer } from './PortableTextRenderer'

       type Props = {
         sectionId: 'origin-story' | 'problem' | 'founder-bio' | 'bonus' | 'podcast' | 'deliberation' | 'game' | 'case-study'
         label: string  // UPPERCASE per UI-SPEC (e.g. "ORIGIN STORY")
         headline: string | null | undefined
         body: PortableTextBlock[] | null | undefined
         /** Override container width — default 680px (editorial). */
         wide?: boolean
       }

       export function EditorialSection({ sectionId, label, headline, body, wide }: Props) {
         const containerClass = wide
           ? 'mx-auto max-w-[860px] px-4 md:px-6 lg:px-8'
           : 'mx-auto max-w-[680px] px-4 md:px-6 lg:px-8'

         return (
           <section id={sectionId} className="mt-12 border-t border-[color:var(--color-border)] pt-8">
             <div className={containerClass}>
               <div className="flex items-start justify-between gap-4">
                 <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                   {label}
                 </p>
                 <AnchorCopyButton sectionId={sectionId} />
               </div>
               <h2 className="mt-2 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-primary)]">
                 {headline ?? 'Untitled Section'}
               </h2>
               <PortableTextRenderer value={body} />
             </div>
           </section>
         )
       }
       ```

    2. Create `apps/web/components/issue/CaseStudySection.tsx`:

       ```typescript
       import type { PortableTextBlock } from '@portabletext/react'
       import { AnchorCopyButton } from '../AnchorCopyButton'
       import { PortableTextRenderer } from './PortableTextRenderer'

       type Props = {
         subjectName: string | null | undefined
         headline: string | null | undefined
         body: PortableTextBlock[] | null | undefined
       }

       export function CaseStudySection({ subjectName, headline, body }: Props) {
         return (
           <section id="case-study" className="mt-12 border-t border-[color:var(--color-border)] pt-8">
             <div className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8">
               <div className="flex items-start justify-between gap-4">
                 <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                   CASE STUDY
                 </p>
                 <AnchorCopyButton sectionId="case-study" />
               </div>
               {subjectName ? (
                 <p className="mt-2 font-ui text-[14px] text-[color:var(--color-text-muted)]">
                   Subject: {subjectName}
                 </p>
               ) : null}
               <h2 className="mt-2 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-primary)]">
                 {headline ?? 'Untitled Section'}
               </h2>
               <PortableTextRenderer value={body} />
             </div>
           </section>
         )
       }
       ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/components/issue/EditorialSection.tsx && \
      test -f apps/web/components/issue/CaseStudySection.tsx && \
      grep -q "AnchorCopyButton" apps/web/components/issue/EditorialSection.tsx && \
      grep -q "PortableTextRenderer" apps/web/components/issue/EditorialSection.tsx && \
      grep -q 'CASE STUDY' apps/web/components/issue/CaseStudySection.tsx && \
      grep -q "Subject:" apps/web/components/issue/CaseStudySection.tsx && \
      grep -q 'id="case-study"' apps/web/components/issue/CaseStudySection.tsx
    </automated>
  </verify>
  <done>
    EditorialSection renders label + headline + Portable Text body + anchor copy. CaseStudySection adds the optional "Subject: {name}" line above the headline. Both use 680px container by default; EditorialSection accepts a `wide` flag for 860px.
  </done>
</task>

<task type="auto">
  <name>Task 4: GameSlot, DeliberationSlot, PodcastSlot — Phase 2 placeholders</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §4 GameSlot, §6 DeliberationSlot, §7 PodcastSlot
  </read_first>
  <files>apps/web/components/issue/GameSlot.tsx, apps/web/components/issue/DeliberationSlot.tsx, apps/web/components/issue/PodcastSlot.tsx</files>
  <action>
    1. `apps/web/components/issue/GameSlot.tsx`:

       ```typescript
       import { AnchorCopyButton } from '../AnchorCopyButton'

       type Props = {
         headline: string | null | undefined
         description: string | null | undefined
       }

       export function GameSlot({ headline, description }: Props) {
         return (
           <section
             id="game"
             data-game-slot
             className="mt-12 border-t border-[color:var(--color-border)] pt-8"
           >
             <div className="mx-auto max-w-[860px] px-4 md:px-6 lg:px-8">
               <div className="flex items-start justify-between gap-4">
                 <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                   THE GAME
                 </p>
                 <AnchorCopyButton sectionId="game" />
               </div>
               {headline ? (
                 <h2 className="mt-2 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-primary)]">
                   {headline}
                 </h2>
               ) : null}
               {description ? (
                 <p className="mt-4 font-body text-[18px] text-[color:var(--color-text)]">
                   {description}
                 </p>
               ) : null}
               <div
                 className="mt-6 flex items-center justify-center rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-center font-ui text-[14px] text-[color:var(--color-text-muted)]"
                 style={{ minHeight: 280 }}
               >
                 <p className="px-6 py-12">
                   Interactive version of this section is loading.
                 </p>
               </div>
             </div>
           </section>
         )
       }
       ```

    2. `apps/web/components/issue/DeliberationSlot.tsx` (uses native `<details>`/`<summary>`):

       ```typescript
       import { AnchorCopyButton } from '../AnchorCopyButton'
       import { ChevronDown } from 'lucide-react'

       type Props = {
         editorDecision: string | null | undefined
       }

       export function DeliberationSlot({ editorDecision }: Props) {
         const body = editorDecision && editorDecision.trim().length > 0
           ? editorDecision
           : 'Deliberation data will appear here when the pipeline is connected.'

         return (
           <section
             id="deliberation"
             data-deliberation-slot
             className="mt-12 border-t border-[color:var(--color-border)] pt-8"
           >
             <div className="mx-auto max-w-[860px] px-4 md:px-6 lg:px-8">
               <div className="flex items-start justify-between gap-4">
                 <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                   THE DELIBERATION
                 </p>
                 <AnchorCopyButton sectionId="deliberation" />
               </div>
               <details className="group mt-2">
                 <summary className="flex cursor-pointer items-center gap-2 font-body text-[18px] text-[color:var(--color-text)] list-none [&::-webkit-details-marker]:hidden">
                   <span>How this issue was made</span>
                   <ChevronDown
                     size={18}
                     aria-hidden="true"
                     className="transition-transform group-open:rotate-180"
                   />
                 </summary>
                 <p className="mt-4 font-ui text-[14px] text-[color:var(--color-text-muted)]">
                   {body}
                 </p>
               </details>
             </div>
           </section>
         )
       }
       ```

    3. `apps/web/components/issue/PodcastSlot.tsx`:

       ```typescript
       import { AnchorCopyButton } from '../AnchorCopyButton'

       type Props = {
         audioUrl: string | null | undefined
         podcastDescription: string | null | undefined
         deliberationTranscript: string | null | undefined
       }

       export function PodcastSlot({ audioUrl, podcastDescription, deliberationTranscript }: Props) {
         return (
           <section
             id="podcast"
             data-podcast-slot
             className="mt-12 border-t border-[color:var(--color-border)] pt-8"
           >
             <div className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8">
               <div className="flex items-start justify-between gap-4">
                 <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                   THE PODCAST
                 </p>
                 <AnchorCopyButton sectionId="podcast" />
               </div>
               <div className="mt-4 min-h-[80px]">
                 {audioUrl ? (
                   <audio
                     controls
                     src={audioUrl}
                     aria-label="Podcast episode"
                     className="w-full"
                   />
                 ) : (
                   <p className="font-ui text-[14px] text-[color:var(--color-text-muted)]">
                     Audio coming soon.
                   </p>
                 )}
                 {podcastDescription ? (
                   <p className="mt-4 font-body text-[18px] text-[color:var(--color-text)]">
                     {podcastDescription}
                   </p>
                 ) : null}
                 {deliberationTranscript ? (
                   <details className="mt-6">
                     <summary className="cursor-pointer font-ui text-[14px] underline underline-offset-4 hover:text-[color:var(--color-accent)]">
                       Read the deliberation transcript
                     </summary>
                     <p className="mt-4 whitespace-pre-wrap font-body text-[18px] text-[color:var(--color-text)]">
                       {deliberationTranscript}
                     </p>
                   </details>
                 ) : null}
               </div>
             </div>
           </section>
         )
       }
       ```
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/components/issue/GameSlot.tsx && \
      test -f apps/web/components/issue/DeliberationSlot.tsx && \
      test -f apps/web/components/issue/PodcastSlot.tsx && \
      grep -q 'data-game-slot' apps/web/components/issue/GameSlot.tsx && \
      grep -q 'data-deliberation-slot' apps/web/components/issue/DeliberationSlot.tsx && \
      grep -q 'data-podcast-slot' apps/web/components/issue/PodcastSlot.tsx && \
      grep -q "Interactive version of this section is loading\." apps/web/components/issue/GameSlot.tsx && \
      grep -q "How this issue was made" apps/web/components/issue/DeliberationSlot.tsx && \
      grep -q "Deliberation data will appear here when the pipeline is connected\." apps/web/components/issue/DeliberationSlot.tsx && \
      grep -q "Audio coming soon\." apps/web/components/issue/PodcastSlot.tsx && \
      grep -q "Read the deliberation transcript" apps/web/components/issue/PodcastSlot.tsx && \
      grep -q 'id="game"' apps/web/components/issue/GameSlot.tsx && \
      grep -q 'id="deliberation"' apps/web/components/issue/DeliberationSlot.tsx && \
      grep -q 'id="podcast"' apps/web/components/issue/PodcastSlot.tsx
    </automated>
  </verify>
  <done>
    All three slot components ship UI-SPEC-locked empty-state copy and the correct section IDs (`#game`, `#deliberation`, `#podcast`). Print-stylesheet selectors (`data-game-slot`, `data-deliberation-slot`, `data-podcast-slot`) are attached. Phase 7/9 swap implementations later.
  </done>
</task>

<task type="auto">
  <name>Task 5: BonusSection — branches on bonusType + ShopCallout (NOTE: <ShopCallout> upgraded by Plan 02-09 to use shadcn Button)</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §5 BonusSection, §8 ShopCallout
    - apps/studio/schemas/weeklyIssue.ts (bonus object shape)
  </read_first>
  <files>apps/web/components/issue/BonusSection.tsx, apps/web/components/issue/ShopCallout.tsx</files>
  <action>
    1. `apps/web/components/issue/BonusSection.tsx`:

       ```typescript
       import type { PortableTextBlock } from '@portabletext/react'
       import { AnchorCopyButton } from '../AnchorCopyButton'
       import { PortableTextRenderer } from './PortableTextRenderer'
       import type { BonusType, IssueBonus } from '@/lib/sanity/types'

       type Props = {
         bonusType: BonusType
         bonus: IssueBonus
       }

       const SUB_LABEL: Record<BonusType, string> = {
         bigBudget: 'BIG BUDGET TREATMENT',
         jingle: 'THE JINGLE',
         specAd: 'THE SPEC AD',
       }

       export function BonusSection({ bonusType, bonus }: Props) {
         if (!bonus) return null
         const wide = bonusType === 'bigBudget' || bonusType === 'specAd'
         const containerClass = wide
           ? 'mx-auto max-w-[860px] px-4 md:px-6 lg:px-8'
           : 'mx-auto max-w-[680px] px-4 md:px-6 lg:px-8'

         return (
           <section id="bonus" className="mt-12 border-t border-[color:var(--color-border)] pt-8">
             <div className={containerClass}>
               <div className="flex items-start justify-between gap-4">
                 <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                   THE BONUS
                 </p>
                 <AnchorCopyButton sectionId="bonus" />
               </div>
               <p className="mt-1 font-ui text-[12px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                 {SUB_LABEL[bonusType]}
               </p>
               <h2 className="mt-2 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-primary)]">
                 {bonus.headline}
               </h2>
               <PortableTextRenderer value={bonus.body as PortableTextBlock[] | null} />

               {bonusType === 'jingle' ? (
                 <>
                   {bonus.sunoAudioUrl ? (
                     <audio
                       controls
                       src={bonus.sunoAudioUrl}
                       aria-label="Jingle"
                       className="mt-6 w-full"
                     />
                   ) : (
                     <p className="mt-6 font-ui text-[14px] text-[color:var(--color-text-muted)]">
                       The audio for this jingle is being produced. Lyrics below.
                     </p>
                   )}
                   {bonus.lyrics ? (
                     <pre className="mt-6 whitespace-pre-wrap rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 font-ui text-[14px] text-[color:var(--color-text)]">
                       {bonus.lyrics}
                     </pre>
                   ) : null}
                 </>
               ) : null}

               {bonusType === 'bigBudget' && Array.isArray(bonus.storyboards) && bonus.storyboards.length > 0 ? (
                 <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                   {bonus.storyboards.map((board, i) =>
                     board?.asset?.url ? (
                       /* eslint-disable-next-line @next/next/no-img-element */
                       <img
                         key={i}
                         src={board.asset.url}
                         alt={`Storyboard ${i + 1}`}
                         className="w-full rounded border border-[color:var(--color-border)]"
                       />
                     ) : null,
                   )}
                 </div>
               ) : null}
             </div>
           </section>
         )
       }
       ```

       Note: uses `<img>` rather than `next/image` for storyboards in Phase 2 — Sanity-hosted images via `@sanity/image-url` are an option but adding the URL-builder + sizing logic here is scope creep for Phase 2.

    2. `apps/web/components/issue/ShopCallout.tsx` — this plan ships a baseline using shadcn `<Button asChild>` (installed by Plan 02-05). Plan 02-09 is responsible for the full shop-page button work; here we only need the issue-page-bottom callout. Per CONTEXT.md D-07, shop callout button MUST be the shadcn primitive.

       ```typescript
       import Link from 'next/link'
       import { Button } from '@/components/ui/button'

       export function ShopCallout() {
         return (
           <section
             data-shop-callout
             className="mt-16 bg-[color:var(--color-surface)] py-12"
           >
             <div className="mx-auto flex max-w-[860px] flex-col items-start gap-6 px-4 md:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
               <p className="font-body text-[18px] text-[color:var(--color-text)]">
                 Jesse A. Eisenbalm lip balm. 100% of proceeds go to this week's
                 featured charity.
               </p>
               {/*
                 Use shadcn Button via asChild so the underlying element is a
                 Next.js <Link> (no wrapping <a><button></button></a>).
                 Button styles come from shadcn defaults; theme-engine CSS
                 variables override the relevant tokens via the globals.css
                 shim (if Plan 02-05 installed one).
               */}
               <Button asChild size="lg">
                 <Link href="/shop">Buy the lip balm</Link>
               </Button>
             </div>
           </section>
         )
       }
       ```

       Notes:
       - `<Button asChild>` from shadcn delegates rendering to the child — here, a Next.js `<Link>`. This is the canonical shadcn pattern for "button that's a link."
       - No shop-specific Tailwind overrides on `<Button>` itself per Blocker 1 fix — it inherits shadcn defaults, themed via the CSS variable shim in globals.css.
       - `data-shop-callout` is the print-stylesheet selector defined in Plan 02-05 globals.css.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/components/issue/BonusSection.tsx && \
      test -f apps/web/components/issue/ShopCallout.tsx && \
      grep -q "BIG BUDGET TREATMENT" apps/web/components/issue/BonusSection.tsx && \
      grep -q "THE JINGLE" apps/web/components/issue/BonusSection.tsx && \
      grep -q "THE SPEC AD" apps/web/components/issue/BonusSection.tsx && \
      grep -q "THE BONUS" apps/web/components/issue/BonusSection.tsx && \
      grep -q "The audio for this jingle is being produced. Lyrics below\." apps/web/components/issue/BonusSection.tsx && \
      grep -q 'id="bonus"' apps/web/components/issue/BonusSection.tsx && \
      grep -q "Jesse A. Eisenbalm lip balm. 100% of proceeds go to this week's featured charity\." apps/web/components/issue/ShopCallout.tsx && \
      grep -q "Buy the lip balm" apps/web/components/issue/ShopCallout.tsx && \
      grep -q 'data-shop-callout' apps/web/components/issue/ShopCallout.tsx && \
      grep -q 'href="/shop"' apps/web/components/issue/ShopCallout.tsx && \
      grep -q "@/components/ui/button" apps/web/components/issue/ShopCallout.tsx && \
      grep -q "Button asChild" apps/web/components/issue/ShopCallout.tsx
    </automated>
  </verify>
  <done>
    BonusSection branches by bonusType: bigBudget/specAd use 860px container, jingle uses 680px. Jingle empty-audio state matches UI-SPEC. BigBudget storyboards render in 2-up grid when present. ShopCallout uses shadcn `<Button asChild>` wrapping a Next.js `<Link>` to `/shop` (per CONTEXT.md D-07).
  </done>
</task>

<task type="auto">
  <name>Task 6: IssueHero + ThemeApplier (client-side defense-in-depth)</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §1 IssueHero
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-10, D-11 — applyTheme runs both server AND client)
    - apps/web/lib/theme.ts (applyTheme signature)
    - apps/web/lib/format.ts (formatIssueLabel)
    - apps/web/lib/sanity/types.ts (Issue + IssueCharity + IssueTheme types)
  </read_first>
  <files>apps/web/components/issue/IssueHero.tsx, apps/web/components/issue/ThemeApplier.tsx</files>
  <action>
    1. Create `apps/web/components/issue/IssueHero.tsx`:

       ```typescript
       import { formatIssueLabel } from '@/lib/format'
       import type { IssueCharity } from '@/lib/sanity/types'

       type Props = {
         issueNumber: number
         publishDate: string
         readingTimeMin: number
         charity: IssueCharity
         problemPdfUrl: string | null
       }

       export function IssueHero({
         issueNumber,
         publishDate,
         readingTimeMin,
         charity,
         problemPdfUrl,
       }: Props) {
         const issueLabel = formatIssueLabel(issueNumber, publishDate)

         return (
           <section
             aria-labelledby="issue-hero-heading"
             className="border-b border-[color:var(--color-border)] pt-16 pb-12"
           >
             <div className="mx-auto max-w-[860px] px-4 md:px-6 lg:px-8">
               <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
                 {issueLabel}
               </p>
               <h1
                 id="issue-hero-heading"
                 className="mt-4 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]"
               >
                 {charity.name}
               </h1>
               <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-ui text-[14px] text-[color:var(--color-text-muted)]">
                 {charity.focusArea ? <span>{charity.focusArea}</span> : null}
                 <span>{charity.location}</span>
                 {charity.foundingYear ? <span>Est. {charity.foundingYear}</span> : null}
                 {readingTimeMin > 0 ? (
                   <span className="md:ml-auto">{readingTimeMin} min read</span>
                 ) : null}
               </div>
               {charity.missionStatement ? (
                 <p
                   className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]"
                   style={{
                     display: '-webkit-box',
                     WebkitLineClamp: 3,
                     WebkitBoxOrient: 'vertical',
                     overflow: 'hidden',
                   }}
                 >
                   {charity.missionStatement}
                 </p>
               ) : null}
               {problemPdfUrl ? (
                 <a
                   href={problemPdfUrl}
                   className="mt-6 inline-block font-ui text-[14px] underline underline-offset-4 text-[color:var(--color-primary)] hover:text-[color:var(--color-accent)]"
                   rel="noopener noreferrer"
                   target="_blank"
                 >
                   Download the problem framework
                 </a>
               ) : null}
             </div>
           </section>
         )
       }
       ```

    2. Create `apps/web/components/issue/ThemeApplier.tsx` — the CLIENT-SIDE defense-in-depth layer per CONTEXT.md D-10/D-11:

       ```typescript
       'use client'

       import { useEffect } from 'react'
       import { applyTheme } from '@/lib/theme'
       import type { IssueTheme } from '@/lib/sanity/types'

       /**
        * Defense-in-depth client-side theme re-validation per CONTEXT.md D-10:
        *   "applyTheme(theme) runs both server-side (via the inline <style> in
        *    /issue/[slug]/layout.tsx for FOUC prevention) AND client-side on
        *    hydration."
        *
        * The server <style> tag is sufficient for first paint. This component
        * runs applyTheme() against document.documentElement after hydration,
        * which:
        *   1. Re-validates the same hex regex + font whitelist + WCAG contrast
        *      that the server already validated.
        *   2. Catches any client-side mutation that bypasses the inline style
        *      (e.g. browser extensions, devtools tampering, future code paths
        *      that manipulate :root variables).
        *   3. Calls element.style.setProperty per validated value — NEVER
        *      template-literal CSS strings (D-10 step 4).
        *
        * Returns null — this component does not render any DOM.
        */
       export function ThemeApplier({ theme }: { theme: IssueTheme | null }) {
         useEffect(() => {
           if (typeof document === 'undefined') return
           applyTheme(document.documentElement, theme ?? null)
         }, [theme])
         return null
       }
       ```

       NOTE: `applyTheme` is exported from `apps/web/lib/theme.ts` (Plan 02-03). Its signature is `applyTheme(element: HTMLElement, theme: IssueTheme | null) => void`. If the actual signature differs, adjust the call — but the executor must NOT modify lib/theme.ts in this plan; that's Plan 02-03's contract.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/components/issue/IssueHero.tsx && \
      test -f apps/web/components/issue/ThemeApplier.tsx && \
      grep -q "formatIssueLabel" apps/web/components/issue/IssueHero.tsx && \
      grep -q '{readingTimeMin} min read' apps/web/components/issue/IssueHero.tsx && \
      grep -q "Download the problem framework" apps/web/components/issue/IssueHero.tsx && \
      grep -q "Est. {charity.foundingYear}" apps/web/components/issue/IssueHero.tsx && \
      grep -q "issue-hero-heading" apps/web/components/issue/IssueHero.tsx && \
      grep -q "'use client'" apps/web/components/issue/ThemeApplier.tsx && \
      grep -q "applyTheme" apps/web/components/issue/ThemeApplier.tsx && \
      grep -q "useEffect" apps/web/components/issue/ThemeApplier.tsx && \
      grep -q "document.documentElement" apps/web/components/issue/ThemeApplier.tsx
    </automated>
  </verify>
  <done>
    `<IssueHero>` renders the issue label, charity name as <h1>, focus/location/Est./reading time metadata row, mission statement clamped to 3 lines, optional PDF download link. `<ThemeApplier>` is a `'use client'` component that runs `applyTheme(document.documentElement, theme)` inside `useEffect`, providing the client-side defense-in-depth layer required by CONTEXT.md D-10/D-11.
  </done>
</task>

<task type="auto">
  <name>Task 7: Issue layout (theme injection) + page (10-section render + JSON-LD + metadata + ThemeApplier mount)</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §"/issue/[slug]" page-level spec
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-10, D-11, D-22)
    - apps/web/lib/theme.ts (serializeThemeCss, applyTheme)
    - apps/web/lib/sanity/queries.ts (QUERY_ISSUE_BY_SLUG, QUERY_LATEST_ISSUE_SLUG)
    - apps/web/lib/sanity/types.ts (Issue type)
    - docs/API_CONTRACTS.md §1.2 (canonical query shape)
  </read_first>
  <files>apps/web/app/issue/[slug]/layout.tsx, apps/web/app/issue/[slug]/page.tsx</files>
  <action>
    1. Create `apps/web/app/issue/[slug]/layout.tsx` (server layer of the two-layer theme injection):

       ```typescript
       /**
        * Per-issue layout: injects the theme CSS variables via inline <style> in
        * the rendered <head>. This is the SERVER-side FOUC-prevention layer
        * (CONTEXT.md D-11). The client-side defense-in-depth re-validation
        * happens via <ThemeApplier> mounted inside page.tsx.
        *
        * Falls back to brand defaults if the issue is missing or has no theme.
        */
       import { sanityClient } from '@/lib/sanity/client'
       import { groq } from 'next-sanity'
       import { serializeThemeCss } from '@/lib/theme'
       import type { IssueTheme } from '@/lib/sanity/types'

       const QUERY_ISSUE_THEME = groq`
         *[_type == "weeklyIssue" && slug.current == $slug && status == "published"][0] {
           theme {
             primaryColor,
             accentColor,
             backgroundColor,
             textColor,
             fontDisplay,
             fontBody,
             visualDirection,
           }
         }
       `

       export default async function IssueLayout({
         children,
         params,
       }: {
         children: React.ReactNode
         params: Promise<{ slug: string }>
       }) {
         const { slug } = await params
         const result = await sanityClient.fetch<{ theme: IssueTheme } | null>(
           QUERY_ISSUE_THEME,
           { slug },
         )
         const themeCss = serializeThemeCss(result?.theme ?? null)

         return (
           <>
             {/*
               Inline theme as a server-rendered <style>. The values inside
               serializeThemeCss are pre-validated; safe to embed.
               Per CONTEXT.md D-11 this is the FOUC-prevention server layer.
               The client-side defense-in-depth re-validation lives in
               <ThemeApplier> inside page.tsx.
             */}
             <style dangerouslySetInnerHTML={{ __html: themeCss }} />
             {children}
           </>
         )
       }
       ```

    2. Create `apps/web/app/issue/[slug]/page.tsx`. This is the high-density file: 10 sections + JSON-LD + metadata + static params + ThemeApplier mount.

       ```typescript
       import type { Metadata } from 'next'
       import { notFound } from 'next/navigation'
       import { sanityClient } from '@/lib/sanity/client'
       import {
         QUERY_ARCHIVE,
         QUERY_ISSUE_BY_SLUG,
       } from '@/lib/sanity/queries'
       import type { ArchiveIssue, Issue } from '@/lib/sanity/types'
       import { readingTime } from '@/lib/reading-time'
       import { SITE_NAME, SITE_AUTHOR, getSiteUrl } from '@/lib/site'
       import { JsonLd } from '@/components/JsonLd'
       import { IssueHero } from '@/components/issue/IssueHero'
       import { EditorialSection } from '@/components/issue/EditorialSection'
       import { CaseStudySection } from '@/components/issue/CaseStudySection'
       import { GameSlot } from '@/components/issue/GameSlot'
       import { BonusSection } from '@/components/issue/BonusSection'
       import { DeliberationSlot } from '@/components/issue/DeliberationSlot'
       import { PodcastSlot } from '@/components/issue/PodcastSlot'
       import { ShopCallout } from '@/components/issue/ShopCallout'
       import { ThemeApplier } from '@/components/issue/ThemeApplier'

       // ─── Static params ────────────────────────────────────────────────────────

       export async function generateStaticParams() {
         const archive = await sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE)
         return archive.map((issue) => ({ slug: issue.slug }))
       }

       export const revalidate = 60

       // ─── Metadata ─────────────────────────────────────────────────────────────

       async function fetchIssue(slug: string): Promise<Issue> {
         return await sanityClient.fetch<Issue>(QUERY_ISSUE_BY_SLUG, { slug })
       }

       export async function generateMetadata({
         params,
       }: {
         params: Promise<{ slug: string }>
       }): Promise<Metadata> {
         const { slug } = await params
         const issue = await fetchIssue(slug)
         if (!issue) {
           return { title: 'Issue not found' }
         }
         const title = `${issue.charity.name} — Issue ${issue.issueNumber}`
         const description =
           (issue.charity.missionStatement ?? '').slice(0, 160) ||
           'A weekly editorial on one obscure charity.'
         const url = `${getSiteUrl()}/issue/${slug}`
         return {
           title,
           description,
           alternates: { canonical: url },
           openGraph: {
             type: 'article',
             title,
             description,
             url,
             siteName: SITE_NAME,
             publishedTime: issue.publishDate,
             images: [{ url: '/og-default.png', width: 1200, height: 630, alt: title }],
           },
           twitter: {
             card: 'summary_large_image',
             title,
             description,
             images: ['/og-default.png'],
           },
         }
       }

       // ─── Page ────────────────────────────────────────────────────────────────

       export default async function IssuePage({
         params,
       }: {
         params: Promise<{ slug: string }>
       }) {
         const { slug } = await params
         const issue = await fetchIssue(slug)
         if (!issue) notFound()

         const minutes = readingTime(
           issue.originStory?.body,
           issue.problemStatement?.body,
           issue.founderBio?.body,
           issue.caseStudy?.body,
           issue.bonus?.body,
         )

         // ─── JSON-LD Article (UI-SPEC §SEO + Structured Data) ────────────────
         const articleLd: Record<string, unknown> = {
           '@context': 'https://schema.org',
           '@type': 'Article',
           headline: issue.originStory?.headline ?? issue.charity.name,
           datePublished: issue.publishDate,
           author: { '@type': 'Organization', name: SITE_AUTHOR },
           about: {
             '@type': 'NGO',
             name: issue.charity.name,
             ...(issue.charity.website ? { url: issue.charity.website } : {}),
             location: issue.charity.location,
           },
           publisher: {
             '@type': 'Organization',
             name: SITE_NAME,
             url: getSiteUrl(),
           },
         }

         return (
           <>
             {/*
               Client-side theme re-validation (defense-in-depth, CONTEXT.md D-10).
               Runs alongside the server-rendered inline <style> in layout.tsx.
             */}
             <ThemeApplier theme={issue.theme ?? null} />

             <JsonLd data={articleLd} />

             <IssueHero
               issueNumber={issue.issueNumber}
               publishDate={issue.publishDate}
               readingTimeMin={minutes}
               charity={issue.charity}
               problemPdfUrl={issue.problemPdfUrl}
             />

             <EditorialSection
               sectionId="origin-story"
               label="ORIGIN STORY"
               headline={issue.originStory?.headline ?? null}
               body={issue.originStory?.body ?? null}
             />

             <EditorialSection
               sectionId="problem"
               label="THE PROBLEM"
               headline={issue.problemStatement?.headline ?? null}
               body={issue.problemStatement?.body ?? null}
             />

             <EditorialSection
               sectionId="founder-bio"
               label="FOUNDER BIO"
               headline={issue.founderBio?.headline ?? null}
               body={issue.founderBio?.body ?? null}
             />

             {issue.caseStudy ? (
               <CaseStudySection
                 subjectName={issue.caseStudy.subjectName}
                 headline={issue.caseStudy.headline}
                 body={issue.caseStudy.body}
               />
             ) : null}

             <GameSlot
               headline={issue.game?.headline ?? null}
               description={issue.game?.description ?? null}
             />

             <BonusSection bonusType={issue.bonusType} bonus={issue.bonus} />

             <DeliberationSlot
               editorDecision={issue.selectionDeliberation?.editorDecision ?? null}
             />

             <PodcastSlot
               audioUrl={issue.podcast?.audioUrl ?? null}
               podcastDescription={issue.podcast?.podcastDescription ?? null}
               deliberationTranscript={issue.podcast?.deliberationTranscript ?? null}
             />

             <ShopCallout />
           </>
         )
       }
       ```

       NOTE: If `Issue` type doesn't expose `theme` at the top level (i.e., QUERY_ISSUE_BY_SLUG doesn't project the theme), either (a) extend the query and type to include it, or (b) keep `issue.theme ?? null` to satisfy the ThemeApplier signature; the client-side `applyTheme(null)` will reapply brand defaults. Either path satisfies D-10.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/app/issue/\[slug\]/layout.tsx && \
      test -f apps/web/app/issue/\[slug\]/page.tsx && \
      grep -q "serializeThemeCss" "apps/web/app/issue/[slug]/layout.tsx" && \
      grep -q 'dangerouslySetInnerHTML' "apps/web/app/issue/[slug]/layout.tsx" && \
      grep -q "QUERY_ISSUE_BY_SLUG" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "generateStaticParams" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "generateMetadata" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "readingTime" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "ThemeApplier" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "'@type': 'Article'" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "'@type': 'NGO'" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "IssueHero" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "EditorialSection" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "CaseStudySection" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "GameSlot" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "BonusSection" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "DeliberationSlot" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "PodcastSlot" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q "ShopCallout" "apps/web/app/issue/[slug]/page.tsx" && \
      grep -q 'notFound()' "apps/web/app/issue/[slug]/page.tsx" && \
      pnpm --filter web typecheck 2>&1 | tail -3 && \
      pnpm --filter web build 2>&1 | tail -10
    </automated>
  </verify>
  <done>
    `/issue/[slug]` renders all 10 sections in the locked UI-SPEC order with two-layer theme injection: SERVER inline `<style>` from layout.tsx (FOUC prevention) + CLIENT `<ThemeApplier>` mounted in page.tsx (defense-in-depth re-validation per D-10). `generateStaticParams` enumerates all published issues. `generateMetadata` emits OG + Twitter + canonical. `<JsonLd>` includes schema.org/Article with charity, founder=Jesse, publish date. notFound() handles missing slug. Build succeeds.
  </done>
</task>

</tasks>

<verification>
- All 13 files exist (12 prior + new ThemeApplier.tsx)
- pnpm --filter web typecheck exits 0
- pnpm --filter web build completes (with the demo seed in place, `/issue/issue-1` should generate)
- Section IDs match UI-SPEC: origin-story, problem, founder-bio, case-study, game, bonus, deliberation, podcast
- Theme injection happens via serializeThemeCss in layout (server) AND applyTheme in ThemeApplier (client)
- AnchorCopyButton uses shadcn <Tooltip> (imported from @/components/ui/tooltip, installed by Plan 02-05)
- ShopCallout uses shadcn <Button asChild> wrapping <Link href="/shop">
- JSON-LD Article emitted with charity.name, charity.location, charity.website
</verification>

<success_criteria>
- WEB-02: 10-section issue page in correct order
- WEB-06, WEB-07, WEB-08, WEB-09: theme injection via validated CSS variables, setProperty, WCAG fallback — runs server-side AND client-side (D-10 satisfied)
- WEB-10: schema.org/Article JSON-LD with charity name + founder + publish date + author
- WEB-11: OG + Twitter card metadata via generateMetadata
- WEB-14: every print-hide selector matches (data-anchor-copy, data-game-slot, data-deliberation-slot, data-podcast-slot, data-shop-callout)
- WEB-15: reading time visible in IssueHero
- WEB-16: every section has anchor copy button using shadcn Tooltip
- D-07 honored: shadcn Tooltip used in AnchorCopyButton; shadcn Button used in ShopCallout
- D-10 honored: applyTheme runs both server (inline style) AND client (ThemeApplier useEffect)
</success_criteria>

<output>
After completion, create `.planning/phases/02-web-shell-theme-engine/02-06-issue-route-SUMMARY.md` recording: the two-layer theme injection pattern (server `<style>` + client `<ThemeApplier>`), the shadcn Tooltip wiring in AnchorCopyButton (controlled `open={copied}` mode), the shadcn Button asChild pattern in ShopCallout, the JSON-LD shape Phase 9 deliberation will extend, the demo issue URL (`/issue/issue-1`), and any deviations from UI-SPEC.
</output>
