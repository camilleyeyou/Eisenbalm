---
phase: 55-public-site-redesign
plan: 12
type: execute
wave: 4
depends_on: [55-11]
files_modified:
  - apps/web/components/issue/IssueMasthead.tsx
  - apps/web/components/issue/IssueBriefing.tsx
  - apps/web/components/issue/MissionBand.tsx
  - apps/web/components/issue/SectionRail.tsx
  - apps/web/components/issue/ScrollProgressBar.tsx
  - apps/web/components/issue/StatCountUp.tsx
  - apps/web/components/issue/ThemeApplier.tsx
  - apps/web/components/issue/DelibChat.tsx
  - apps/web/components/issue/DelibScoreboard.tsx
  - apps/web/components/issue/ConfidenceBar.tsx
  - apps/web/components/issue/DeliberationSlot.tsx
  - apps/web/components/issue/ShopBand.tsx
  - apps/web/components/issue/ShopCallout.tsx
  - apps/web/components/issue/IssueHero.tsx
  - apps/web/components/issue/ScrollReveal.tsx
  - apps/web/components/issue/EditorialSection.tsx
  - apps/web/components/issue/CaseStudySection.tsx
  - apps/web/__tests__/deliberation-agent-cards.test.ts
  - apps/web/__tests__/deliberation-conversation.test.ts
  - apps/web/__tests__/deliberation-advocate-scores.test.ts
  - apps/web/__tests__/deliberation-qa-severity.test.ts
  - apps/web/__tests__/deliberation-subscriptions.test.ts
  - apps/web/__tests__/deliberation-no-model-names.test.ts
  - apps/web/__tests__/machine-editorial-components.test.ts
  - apps/web/__tests__/motion-polish.test.ts
  - apps/web/__tests__/issue-hero-motion.test.ts
  - apps/web/__tests__/narrator-chip.test.ts
  - apps/web/__tests__/issue-page-shop-callout.test.ts
  - apps/web/__tests__/issue-page-typography.test.ts
  - apps/web/__tests__/issue-page-dispatch.test.ts
  - apps/web/__tests__/phase19-retired.test.ts
  - apps/web/lib/sanity/queries.ts
  - apps/web/lib/sanity/types.ts
  - docs/API_CONTRACTS.md
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [P55-SC3, P55-SC6, PUB-06, PUB-15]

must_haves:
  truths:
    - "The DelibChat transcript, scoreboard and fake 80% ConfidenceBar no longer exist anywhere in apps/web"
    - "The public issue queries no longer project selectionDeliberation.conversation (schema field kept; stored data untouched)"
    - "Every Phase 19 public-page component that the Dispatch tree replaced is deleted with zero remaining importers, and each test that pinned it is rewritten to guard the replacement or deleted when its coverage moved (recorded per file)"
    - "Narrator chip rule (NRR-08) and CMR-09 shop tripwire still guarded — now against Hero.tsx and BuyBand.tsx"
  artifacts:
    - path: "apps/web/__tests__/phase19-retired.test.ts"
      provides: "Retirement guard: files absent, no importers, no conversation projection"
  key_links:
    - from: "apps/web/__tests__/narrator-chip.test.ts"
      to: "apps/web/components/dispatch/Hero.tsx"
      via: "source-scan re-pointed"
      pattern: "components/dispatch/Hero.tsx"
---

<objective>
Retire the Phase 19 artifacts the new Dispatch tree replaced — components, the transcript projection, and the source-scan tests pinned to them — as a first-class deliverable (project lesson: Phase 34's half-done retirement caused a 9-day outage).

Purpose: SC-3 ("the transcript view is gone from the public issue page" — gone from the codebase, not just unmounted) and SC-6 hygiene.
Output: 17 component deletions, test rewrites/deletions with a disposition table in the SUMMARY, GROQ/type cleanup, retirement guard test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/55-public-site-redesign/55-RESEARCH.md
@apps/web/lib/sanity/queries.ts
@apps/web/lib/sanity/types.ts
@docs/API_CONTRACTS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete replaced components; re-point/rewrite their pinned tests</name>
  <files>apps/web/components/issue/{IssueMasthead,IssueBriefing,MissionBand,SectionRail,ScrollProgressBar,StatCountUp,ThemeApplier,DelibChat,DelibScoreboard,ConfidenceBar,DeliberationSlot,ShopBand,ShopCallout,IssueHero,ScrollReveal,EditorialSection,CaseStudySection}.tsx, apps/web/__tests__/narrator-chip.test.ts, apps/web/__tests__/issue-page-shop-callout.test.ts, apps/web/__tests__/issue-page-typography.test.ts, apps/web/__tests__/issue-page-dispatch.test.ts</files>
  <read_first>
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Retirement inventory"
    - each of the four test files listed (full content)
    - apps/web/components/dispatch/Hero.tsx and BuyBand.tsx (replacement targets)
  </read_first>
  <action>
    1. For each of the 17 component files: run `grep -rln "<Name>" apps/web/app apps/web/components apps/web/lib --include=*.ts --include=*.tsx` (excluding the file itself). Delete with `git rm` only when there are zero importers. If an importer exists outside the issue/home/preview tree (e.g. a page under /charities), do NOT delete that file — record it in the SUMMARY as "kept: importer <path>". Do NOT touch components/marketing/ShopCallout.tsx, GameSlot.tsx, GameFallback.tsx, BonusSection.tsx, PodcastSlot.tsx, PortableTextRenderer.tsx, AnchorCopyButton, JsonLd, or apps/web/app/globals.css (other routes still use its classes; theme-aa-tones stays green untouched).
    2. narrator-chip.test.ts: re-point the IssueHero path at `../components/dispatch/Hero.tsx`; keep the guard assertions (`narrator &&`, `!== 'Jesse Eisenbalm'` / active check, 'Narrated by' + `narrator.name`); replace the `--color-text-mute` + 0.18em styling assertion with `src.includes('d-label')`; keep the queries.ts projection assertions (name, slug, active only).
    3. issue-page-shop-callout.test.ts: CMR-09 now guards BuyBand: file exists; contains `data-shop-callout` and `href="/shop"`; IssueLayout renders `<BuyBand`; BuyBand.tsx and BalmCounter.tsx comment-stripped code contain none of /banner|modal|popup|countdown|hurry/i. Remove ShopCallout/ShopBand assertions.
    4. issue-page-typography.test.ts: remove `it` blocks whose subject file was deleted (EditorialSection, CaseStudySection, IssueHero, ShopCallout); keep fonts (DES-01), no-Google-link, globals.css blocks, PortableTextRenderer leading-[1.7], GameSlot sandbox cross-check, page server-component check; add `it('root layout loads Manrope as --font-dispatch')`.
    5. issue-page-dispatch.test.ts: delete the "Plan 02: … exist" and "Plan 03: DelibChat/useReducedMotion" describes and the Atmosphere/SectionNavigator page checks only where they read deleted files; replace with one describe "Phase 55: retired Phase 19 motion components are absent" asserting existsSync false for ScrollProgressBar, SectionRail, ScrollReveal, DelibChat, StatCountUp, ConfidenceBar. Keep the GameSlot aria-label 'Play' check, fonts, FONT_WHITELIST, BRAND_DEFAULTS, framer-motion dependency, theme.ts security, and the Phase 55 layout describe from Plan 11.
  </action>
  <verify>
    <automated>pnpm --filter web test -- narrator-chip issue-page-shop-callout issue-page-typography issue-page-dispatch && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `ls apps/web/components/issue/` no longer lists DelibChat.tsx, DelibScoreboard.tsx, ConfidenceBar.tsx, DeliberationSlot.tsx, ThemeApplier.tsx, SectionRail.tsx, ScrollProgressBar.tsx
    - `grep -rln "DelibChat\|DeliberationSlot\|ConfidenceBar\|ThemeApplier" apps/web/app apps/web/components apps/web/lib` returns nothing
    - `grep -n "components/dispatch/Hero.tsx" apps/web/__tests__/narrator-chip.test.ts` matches
  </acceptance_criteria>
  <done>Replaced components deleted (or recorded as kept with reason); pinned tests guard the new tree.</done>
</task>

<task type="auto">
  <name>Task 2: Remove dedicated Phase 19 tests, drop conversation projection, add retirement guard</name>
  <files>apps/web/__tests__/deliberation-agent-cards.test.ts, apps/web/__tests__/deliberation-conversation.test.ts, apps/web/__tests__/deliberation-advocate-scores.test.ts, apps/web/__tests__/deliberation-qa-severity.test.ts, apps/web/__tests__/deliberation-subscriptions.test.ts, apps/web/__tests__/deliberation-no-model-names.test.ts, apps/web/__tests__/machine-editorial-components.test.ts, apps/web/__tests__/motion-polish.test.ts, apps/web/__tests__/issue-hero-motion.test.ts, apps/web/__tests__/phase19-retired.test.ts, apps/web/lib/sanity/queries.ts, apps/web/lib/sanity/types.ts, docs/API_CONTRACTS.md, .planning/REQUIREMENTS.md</files>
  <read_first>
    - each listed test file (decide per `it` block: target file deleted -> remove; target still exists, e.g. globals.css -> keep)
    - apps/web/__tests__/delib-cards.test.tsx (confirms DEL-04 / zero-subscription / no-transcript coverage moved there — required before deleting the old ones)
    - apps/web/lib/sanity/queries.ts, types.ts; docs/API_CONTRACTS.md §1.2; .planning/REQUIREMENTS.md WEB-01 and WEB-06 lines
  </read_first>
  <action>
    1. For each of the 9 listed test files: if every `it` targets a deleted file, `git rm` it; otherwise remove only the `it`/`describe` blocks targeting deleted files and keep the rest (e.g. motion-polish globals.css assertions). Record a disposition table (file | deleted/trimmed | where coverage now lives) in the SUMMARY — deliberation-no-model-names and deliberation-subscriptions coverage lives in delib-cards.test.tsx.
    2. queries.ts: remove `conversation[] { speaker, text },` from BOTH QUERY_ISSUE_BY_SLUG and QUERY_ISSUE_PREVIEW_BY_SLUG (parity preserved). types.ts: remove `conversation` from IssueDeliberation and delete `IssueDeliberationTurn` if unused (`grep -rn IssueDeliberationTurn apps/web`). Keep the Sanity schema field and the pipeline writer untouched.
    3. docs/API_CONTRACTS.md: remove the conversation line from the §1.2 GROQ block and add to §55 a note "§55.7 — public queries no longer project selectionDeliberation.conversation (Phase 55); field retained in schema and still written by the pipeline for the podcast/dispatch-control."
    4. .planning/REQUIREMENTS.md: append to WEB-01 "(superseded Phase 55: `/` renders the latest issue front page)" and to WEB-06 "(superseded on public pages Phase 55: fixed Dispatch brand + weekly accent; theme.ts invariants unchanged)". Do not change checkbox states.
    5. phase19-retired.test.ts (node): assert existsSync false for every component deleted in Task 1 (read the list from a constant; skip any recorded as kept); assert no file under app/, components/, lib/ imports them (`readdirSync` recursive scan for `from '@/components/issue/<Name>'`); assert both public queries do not contain `conversation[]`; assert IssueLayout.tsx contains no `role="log"`.
  </action>
  <verify>
    <automated>pnpm --filter web test && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test` exits 0 and `pnpm --filter web typecheck` exits 0
    - `grep -c "conversation\[\]" apps/web/lib/sanity/queries.ts` returns 0
    - `grep -n "name: 'conversation'" apps/studio/schemas/weeklyIssue.ts` still matches
    - `pnpm --filter web test -- phase19-retired groq-parity delib-cards` exits 0
    - SUMMARY contains a disposition table covering all 9 test files
  </acceptance_criteria>
  <done>Phase 19 transcript/theme artifacts fully retired with explicit, recorded test dispositions.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test` full suite green; `pnpm --filter web typecheck` clean
- `grep -rn "DelibChat\|DelibScoreboard\|ConfidenceBar\|ThemeApplier\|SectionRail" apps/web --include=*.ts --include=*.tsx | grep -v node_modules` returns only test-file absence assertions
- `pnpm --filter web build` (network flake rule from Plan 11 applies)
</verification>

<success_criteria>
No Phase 19 transcript/theme code remains on the public path; every removed test's coverage is accounted for.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-12-SUMMARY.md`
</output>
