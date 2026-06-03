---
phase: 19-issue-page-redesign-dispatch-magazine-layout
plan: 05
type: execute
wave: 4
depends_on: [19-04]
files_modified:
  - apps/web/app/issue/[slug]/page.tsx
  - apps/web/app/issue/[slug]/layout.tsx
  - apps/web/components/issue/ThemeApplier.tsx
  - apps/web/__tests__/issue-page-dispatch.test.ts
  - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-VALIDATION.md
autonomous: false
requirements: [P19-03, P19-05, P19-06, WEB-06, DES-06, DEL-01, GAM-05, POD-01]
must_haves:
  truths:
    - "page.tsx fetches the live issue via QUERY_ISSUE_BY_SLUG (MOCK_ISSUE removed) without changing the approved structure/motion"
    - "issue/[slug]/layout.tsx re-enables per-issue theming unconditionally — themeCss is no longer gated on DESIGNAGENT_SUPPRESSED"
    - "A valid Sanity theme overrides accent + type tokens; structure/motion stay byte-identical across issues"
    - "DeliberationSlot receives live runId so the 5 Convex subscriptions feed real data; GameSlot receives runId for GAM-05"
    - "theme.ts security tests pass unmodified; full suite + typecheck + build green"
  artifacts:
    - path: "apps/web/app/issue/[slug]/page.tsx"
      provides: "Live Sanity fetch feeding the Dispatch layout; problemPdfUrl + runId threaded"
      contains: "QUERY_ISSUE_BY_SLUG"
    - path: "apps/web/app/issue/[slug]/layout.tsx"
      provides: "Unconditional serializeThemeCss(theme); no suppression gate on theming"
      contains: "serializeThemeCss(theme)"
  key_links:
    - from: "apps/web/app/issue/[slug]/page.tsx"
      to: "QUERY_ISSUE_BY_SLUG (sanityClient.fetch)"
      via: "live issue fetch replacing MOCK_ISSUE"
      pattern: "QUERY_ISSUE_BY_SLUG"
    - from: "apps/web/app/issue/[slug]/layout.tsx"
      to: "serializeThemeCss(theme)"
      via: "unconditional per-issue theme emission"
      pattern: "serializeThemeCss\\(theme\\)"
---

<objective>
Stage B — wire live data WITHOUT changing the user-approved Stage A structure or motion. Swap MOCK_ISSUE for the live Sanity fetch (QUERY_ISSUE_BY_SLUG — already projects everything needed including `selectionDeliberation.conversation[]`), thread `runId` to DeliberationSlot (Convex subs) + GameSlot (GAM-05) and `problemPdfUrl` to the Problem section PDF button, and re-enable per-issue theming in issue/[slug]/layout.tsx by removing the DESIGNAGENT_SUPPRESSED gate from the theming path. Then run the full verification matrix and flip 19-VALIDATION.md to nyquist_compliant.

Purpose: This completes the two-stage delivery. The diff from Stage A must be minimal (data source swap + theme un-suppression) — no component restructuring. The pipeline-side DESIGNAGENT_SUPPRESSED flag (packages/pipeline) is OUT OF SCOPE — only the web theming side reverses.
Output: live-wired page.tsx + un-suppressed layout.tsx + ThemeApplier update + activated suppression-off tripwire + validation sign-off.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
QUERY_ISSUE_BY_SLUG (apps/web/lib/sanity/queries.ts) — already projects (API_CONTRACTS §1.2): charity, originStory/problemStatement/founderBio/caseStudy/bonus bodies, game, podcast, runId, problemPdfUrl, narrator, and `selectionDeliberation { candidates[]{charity->{name,slug,location}, scoutSummary, advocateArgument, advocateScore}, editorDecision, runnerUpNotes, conversation[]{speaker,text} }`. NO GROQ CHANGE NEEDED for Stage B.

issue/[slug]/layout.tsx CURRENT (apps/web/app/issue/[slug]/layout.tsx line 57, 70):
```ts
const suppressed = process.env.DESIGNAGENT_SUPPRESSED === 'true'
const themeCss = suppressed ? '' : serializeThemeCss(theme)
// ...
<ThemeApplier theme={theme} suppressed={suppressed} />
```
Phase 19 target (RESEARCH Pattern 5 + Pitfall 6):
```ts
const themeCss = serializeThemeCss(theme)   // unconditional
<ThemeApplier theme={theme} suppressed={false} />
```
Per RESEARCH Open Q1: keep ThemeApplier (defense-in-depth); set suppressed always false (or remove the prop). The pipeline-side flag stays — only web theming reverses.

ThemeApplier.tsx (apps/web/components/issue/ThemeApplier.tsx) — client component running applyTheme() with a `suppressed` prop short-circuit. applyTheme was extended in Plan 01 to also set --color-bg/--color-text.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Re-enable per-issue theming in layout.tsx + ThemeApplier (remove suppression from theming path)</name>
  <read_first>
    - apps/web/app/issue/[slug]/layout.tsx (FULL — current suppression gate lines 53-88)
    - apps/web/components/issue/ThemeApplier.tsx (FULL — suppressed prop short-circuit)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md (Pattern 5 lines 348-366, Pitfall 6 lines 452-455, Open Q1 lines 603-606)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§Security Invariants lines 779-790)
  </read_first>
  <action>
    1. In apps/web/app/issue/[slug]/layout.tsx:
       - Remove the `const suppressed = process.env.DESIGNAGENT_SUPPRESSED === 'true'` line (theming no longer reads it).
       - Change `const themeCss = suppressed ? '' : serializeThemeCss(theme)` to `const themeCss = serializeThemeCss(theme)` (unconditional — re-enables per-issue theming, WEB-06/DES-06).
       - Change `<ThemeApplier theme={theme} suppressed={suppressed} />` to `<ThemeApplier theme={theme} suppressed={false} />` (per RESEARCH Open Q1 — keep ThemeApplier for defense-in-depth, suppression always off on the web side).
       - Update the file's top-comment block: replace the MED-01/MED-02 suppression note with a Phase 19 note that per-issue theming is re-enabled and `DESIGNAGENT_SUPPRESSED` now affects ONLY the pipeline (whether the DesignAgent node runs), not web theming (Pitfall 6).
       - Keep the QUERY_ISSUE_THEME fetch + serializeThemeCss security path (validated values only) unchanged.
    2. In ThemeApplier.tsx: with `suppressed={false}` always passed, the short-circuit becomes inert; leave the prop accepted (so the call site type-checks) but confirm the no-suppress path calls applyTheme normally. No applyTheme logic change needed (Plan 01 already extended it to set --color-bg/--color-text).
    Do NOT touch packages/pipeline — the pipeline suppression flag is out of scope.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck 2>&1 | tail -5; grep -c "suppressed ? '' :" app/issue/\[slug\]/layout.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "serializeThemeCss(theme)" "apps/web/app/issue/[slug]/layout.tsx"` returns 1
    - `grep -c "suppressed ? '' :" "apps/web/app/issue/[slug]/layout.tsx"` returns 0
    - `grep -c "DESIGNAGENT_SUPPRESSED" "apps/web/app/issue/[slug]/layout.tsx"` returns 0 or only inside the comment (no live read in the theming path)
    - `grep -c "suppressed={false}" "apps/web/app/issue/[slug]/layout.tsx"` returns 1
    - `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>Per-issue theming re-enabled unconditionally; suppression removed from web theming path; pipeline flag untouched; typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 2: Swap MOCK_ISSUE for live Sanity fetch in page.tsx; thread runId + problemPdfUrl</name>
  <read_first>
    - apps/web/app/issue/[slug]/page.tsx (FULL — Stage A MOCK_ISSUE + render body from Plans 02/03)
    - apps/web/lib/sanity/queries.ts (QUERY_ISSUE_BY_SLUG — confirm projection)
    - apps/web/lib/sanity/types.ts (Issue type)
    - docs/API_CONTRACTS.md §1.2 (deliberation projection lines 119-129)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§Delivery Stage B lines 769-776, §7 PDF button lines 469-475)
  </read_first>
  <action>
    Minimal-diff swap of the data source — NO structural or motion change from the approved Stage A shell:
    1. In the IssuePage component body, replace the `MOCK_ISSUE` usage with the live fetch already present in the original page: `const issue = await sanityClient.fetch<Issue>(QUERY_ISSUE_BY_SLUG, { slug })`; `if (!issue) notFound()`. Compute `readingTime(...)` from the live bodies (as the original did).
    2. Delete the `MOCK_ISSUE` constant entirely.
    3. Re-point each section's props from `MOCK_ISSUE.*` to `issue.*`, preserving the exact same component tree + order + ids established in Plans 02/03:
       - IssueMasthead: issueNumber, charity.name, tagline (charity.missionStatement or tagline field), publishDate, readingTimeMinutes=minutes.
       - IssueBriefing: derive why/stats/toc from issue fields (why = charity.missionStatement/whyOverlooked; stats from charity foundedYear/assetRange etc. as available; toc = the section list). Keep StatCountUp `plain` for year values.
       - MissionBand: constant copy (no Sanity field).
       - EditorialSection origin/problem/founder: headline + body from issue.originStory/problemStatement/founderBio, `lead`. Problem section gets the PDF download button when `issue.problemPdfUrl` is populated (UI-SPEC §7, "↓  Download the Problem Statement Deck (PDF)", min-height 44px).
       - CaseStudySection: issue.caseStudy.subjectName/headline/body.
       - GameSlot: game={issue.game} runId={issue.runId ?? null} (GAM-05 QA write path).
       - BonusSection: bonus={issue.bonus} bonusType={issue.bonusType}.
       - DeliberationSlot: runId={issue.runId ?? null} conversation={issue.selectionDeliberation?.conversation ?? null} candidates={issue.selectionDeliberation?.candidates?.map(c => ({ name:c.charity.name, location:c.charity.location, score:c.advocateScore ?? null, note:c.advocateArgument ?? c.scoutSummary ?? '', winning:<first/highest-score>, runnerUp:<...> })) ?? null}.
       - PodcastSlot: podcast={issue.podcast}.
       - ShopBand: charityName={issue.charity.name}.
    4. Keep generateMetadata, generateStaticParams, JsonLd, `export const revalidate = 60` exactly as-is.
    The component tree, ids, and framer-motion wrappers from Stage A are unchanged — only the data binding flips from mock to live.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck 2>&1 | tail -5; grep -c "MOCK_ISSUE" "app/issue/[slug]/page.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "MOCK_ISSUE" "apps/web/app/issue/[slug]/page.tsx"` returns 0
    - `grep -c "QUERY_ISSUE_BY_SLUG" "apps/web/app/issue/[slug]/page.tsx"` returns 1 or more
    - `grep -c "issue.runId" "apps/web/app/issue/[slug]/page.tsx"` returns 2 or more (GameSlot + DeliberationSlot)
    - `grep -c "problemPdfUrl" "apps/web/app/issue/[slug]/page.tsx"` returns 1 or more
    - `grep -c 'id="origin"\|id="problem"\|id="founder"\|id="case"\|id="game"\|id="bonus"\|id="delib"\|id="pod"' "apps/web/app/issue/[slug]/page.tsx"` returns 8 (order preserved)
    - `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>page.tsx renders the Dispatch layout from live Sanity data; MOCK_ISSUE removed; runId threaded to GameSlot + DeliberationSlot; PDF button wired; structure/order/motion identical to approved Stage A.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Stage B full-suite verification + validation sign-off + live-data UAT</name>
  <what-built>
    The fully live-wired Dispatch issue page: real Sanity content, per-issue theme re-enabled (accent + type tokens override oxblood/cream defaults per issue while structure/motion stay constant), live Convex deliberation subscriptions, GameSlot QA-write runId, and the Problem PDF download button. Plus: the suppression-off tripwire in issue-page-dispatch.test.ts is activated, and 19-VALIDATION.md is flipped to nyquist_compliant.
  </what-built>
  <how-to-verify>
    1. Activate the final tripwire: in apps/web/__tests__/issue-page-dispatch.test.ts, convert the remaining `it.todo` (DESIGNAGENT_SUPPRESSED not gating themeCss in layout.tsx) to a real assertion: source-scan layout.tsx asserts `serializeThemeCss(theme)` appears and `suppressed ? '' :` does NOT.
    2. Run the full gate: `pnpm --filter web test:unit && pnpm --filter web typecheck && pnpm --filter web build` — all must be green (≥ prior baseline + new tripwires; theme.ts security tests unmodified).
    3. Update 19-VALIDATION.md: populate the Per-Task Verification Map with the Phase 19 tasks→tests, and set `nyquist_compliant: true` + `wave_0_complete: true` in frontmatter.
    4. Live UAT: deploy/preview and open a real published issue at `/issue/[real-slug]`. Confirm: real charity content renders in all 10 sections; the deliberation shows real candidate scores + the live chat conversation; the game iframe loads (sandbox intact); the podcast player reflects real audio/empty state.
    5. Per-issue theme check: open two issues with different Sanity `theme.accentColor` values — confirm accent (links, eyebrows, drop cap, pull-quote border) changes between them while the layout/grid/motion are identical (DES-06). If only one published issue exists, set a distinct `theme.accentColor` on it in Sanity and confirm it overrides the oxblood default.
    6. Reduced-motion re-check on live data: all sections fully visible with reduced motion enabled.
  </how-to-verify>
  <acceptance_criteria>
    - `grep -c "it.todo" apps/web/__tests__/issue-page-dispatch.test.ts` returns 0
    - `pnpm --filter web test:unit` exits 0
    - `pnpm --filter web typecheck` exits 0
    - `pnpm --filter web build` exits 0
    - `grep -c "nyquist_compliant: true" .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-VALIDATION.md` returns 1
    - User confirms live issue renders all 10 sections + per-issue accent override works + reduced-motion content visible
  </acceptance_criteria>
  <resume-signal>Type "verified" once the full suite is green and the live per-issue-theme + reduced-motion UAT passes, or describe failures to fix.</resume-signal>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit && pnpm --filter web typecheck && pnpm --filter web build` all exit 0
- theme.ts security tests unmodified and green
- per-issue theme override visibly works (DES-06)
- live Convex subscriptions feed the deliberation
- 19-VALIDATION.md nyquist_compliant: true
</verification>

<success_criteria>
- Stage B wires live data without changing approved structure/motion (P19-05)
- Per-issue theming re-enabled; structure constant across issues (P19-03, WEB-06, DES-06)
- runId threaded for Convex subs + GAM-05 (DEL-01, GAM-05)
- Zero-regression matrix green (P19-06)
</success_criteria>

<output>
After completion, create `.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-05-SUMMARY.md`
</output>
