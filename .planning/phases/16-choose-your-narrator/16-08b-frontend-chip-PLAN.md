---
phase: 16-choose-your-narrator
plan: 08b
type: execute
wave: 4
depends_on: [16-01, 16-03]
files_modified:
  - apps/web/lib/sanity/queries.ts
  - apps/web/lib/sanity/types.ts
  - apps/web/components/issue/IssueHero.tsx
autonomous: true
requirements:
  - NRR-13
  - NRR-14
must_haves:
  truths:
    - "issueQuery GROQ expands narrator->{displayName, slug} on the weeklyIssue document"
    - "IssueDoc TypeScript type includes optional narrator { slug, displayName } | null"
    - "When issue.narrator.slug !== 'jesse', IssueHero renders a narrator chip with text 'Narrated by {displayName}'"
    - "Chip is positioned ABOVE the publish-date element and BELOW the byline (per CONTEXT D-19)"
    - "When narrator is null or slug == 'jesse', no chip renders (Jesse is the implicit default)"
  artifacts:
    - path: "apps/web/lib/sanity/queries.ts"
      provides: "issueQuery extended with narrator-> projection"
    - path: "apps/web/lib/sanity/types.ts"
      provides: "IssueDoc.narrator optional field"
    - path: "apps/web/components/issue/IssueHero.tsx"
      provides: "narrator chip rendered above publish-date"
  key_links:
    - from: "apps/web/components/issue/IssueHero.tsx"
      to: "apps/web/lib/sanity/types.ts (IssueDoc.narrator)"
      via: "props.issue.narrator"
      pattern: "issue.narrator?.displayName"
---

<objective>
Extend the frontend Sanity types + GROQ projection to surface the issue's narrator, then render a narrator chip in `IssueHero.tsx` positioned ABOVE the publish-date line per CONTEXT D-19. Chip is suppressed when narrator is null or when slug == 'jesse' (Jesse is the implicit default — no chip implies Jesse).

Purpose: NRR-13 (frontend surfaces narrator identity on issue pages) and NRR-14 (Jesse is implicit; non-Jesse is explicit via a chip).

Output:
- `lib/sanity/queries.ts`: `issueQuery` extended with `narrator->{slug, displayName}` projection.
- `lib/sanity/types.ts`: `IssueDoc.narrator?: { slug: string; displayName: string } | null`.
- `components/issue/IssueHero.tsx`: chip rendered in the exact DOM slot specified below (above the publish-date `<time>` element).

Implements: D-19 (chip placement: above publish-date line), NRR-13, NRR-14.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@apps/web/components/issue/IssueHero.tsx
@apps/web/lib/sanity/queries.ts
@apps/web/lib/sanity/types.ts
@apps/web/__tests__/issue/narrator-chip.test.ts  # <-- created by Plan 16-03

<decisions_implemented>
- **D-19**: Narrator chip placement is "under the issue title, above the publish-date line". Verified during planning by reading IssueHero.tsx — the chip goes BETWEEN the byline (`<p>By Jesse A. Eisenbalm</p>` or equivalent) and the publish-date `<time>` element. NOT after the byline as a side-by-side element; NOT inside the byline paragraph.
- **NRR-13**: Issue page surfaces narrator identity for non-Jesse issues.
- **NRR-14**: Jesse implicit (no chip when slug='jesse' or narrator is null); non-Jesse explicit (chip with displayName).
</decisions_implemented>

<verified_dom_baseline>
At planning time, `apps/web/components/issue/IssueHero.tsx` had this top-of-hero JSX structure:

```tsx
<header className="issue-hero">
  <h1 className="issue-hero__title">{issue.title}</h1>
  <p className="issue-hero__byline">By Jesse A. Eisenbalm</p>
  {/* ↑↑↑  CHIP GOES BETWEEN THESE TWO ELEMENTS (per CONTEXT D-19)  ↓↓↓ */}
  <time className="issue-hero__date" dateTime={issue.publishedAt}>
    {formatDate(issue.publishedAt)}
  </time>
  {/* ... mission statement and rest of hero ... */}
</header>
```

The exact element class names may differ slightly in the live file — the executor MUST re-read IssueHero.tsx to confirm the exact JSX before editing. The invariants are:
1. Chip is rendered AFTER the byline `<p>` and BEFORE the `<time>` element.
2. Chip is a sibling of byline and time (not nested inside either).
3. Chip is conditional: rendered ONLY when `issue.narrator?.slug && issue.narrator.slug !== 'jesse'`.

**If the executor finds IssueHero.tsx has been restructured so that there is no `<time>` element after a byline, STOP and surface the discrepancy. The chip placement must still satisfy D-19's intent ("above the publish-date line") — find the equivalent element.**
</verified_dom_baseline>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend issueQuery to project narrator->{slug, displayName}</name>
  <files>apps/web/lib/sanity/queries.ts</files>

  <read_first>
    1. READ the FULL current `apps/web/lib/sanity/queries.ts`. Find the `issueQuery` (or `issueBySlugQuery`) GROQ string. Note the projection block that already pulls `theme`, `charity`, etc.
    2. CONFIRM the Sanity narrator schema (Plan 16-01) defines `narrator` as a reference field on `weeklyIssue`. The projection arrow `narrator->` expands the reference.
  </read_first>

  <action>
    Edit `queries.ts`:

    1. Locate the `issueQuery` projection block.
    2. Add the narrator projection line. If the projection is a list of fields wrapped in `{}`, add:
       ```groq
       narrator->{ "slug": slug.current, displayName }
       ```
    3. If the existing query already uses a coalesce pattern for optional refs (check Phase 14 patterns for `charity` if it was optional), mirror it. Otherwise, the `->` expansion safely yields null if `narrator` is unset.
    4. Do NOT touch any other projection field.
  </action>

  <verify>
    <automated>
      # 1. queries.ts contains the narrator-> projection.
      grep -E 'narrator->.*displayName' apps/web/lib/sanity/queries.ts

      # 2. TypeScript compiles.
      cd apps/web && pnpm tsc --noEmit lib/sanity/queries.ts

      # 3. The narrator chip test (created by Plan 16-03) can find issueQuery and parse it (sanity-check; full chip rendering is verified in Task 3).
      pnpm --filter web test:unit --run apps/web/__tests__/issue/narrator-chip.test.ts -t "issueQuery" 2>&1 | grep -E "(PASS|✓)"
    </automated>
  </verify>

  <done>
    - `issueQuery` projects `narrator->{slug, displayName}`.
    - File compiles.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add IssueDoc.narrator optional field to types.ts</name>
  <files>apps/web/lib/sanity/types.ts</files>

  <read_first>
    1. READ the FULL current `apps/web/lib/sanity/types.ts`. Find the `IssueDoc` (or `WeeklyIssue`) type. Note how other reference-expanded fields (e.g., `theme`, `charity`) are typed.
  </read_first>

  <action>
    Edit `types.ts`:

    1. Add (or extend) the narrator field on `IssueDoc`:
       ```typescript
       narrator?: {
         slug: string;
         displayName: string;
       } | null;
       ```
    2. The optional `?:` and `| null` together cover (a) field absent from older issues (`undefined`) and (b) issue with a null narrator ref (`null`).
    3. Do NOT modify other type fields.
  </action>

  <verify>
    <automated>
      # 1. types.ts has the narrator field on IssueDoc.
      grep -E "narrator\?:|narrator: \{" apps/web/lib/sanity/types.ts

      # 2. TypeScript compiles.
      cd apps/web && pnpm tsc --noEmit lib/sanity/types.ts
    </automated>
  </verify>

  <done>
    - `IssueDoc.narrator` is an optional field with `{ slug, displayName }` shape.
    - File compiles.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Render narrator chip in IssueHero.tsx ABOVE publish-date (per D-19)</name>
  <files>apps/web/components/issue/IssueHero.tsx</files>

  <behavior>
    - When `issue.narrator` is null or undefined → no chip rendered.
    - When `issue.narrator.slug === 'jesse'` → no chip rendered (Jesse is implicit per D-19/NRR-14).
    - When `issue.narrator.slug !== 'jesse'` and `issue.narrator.displayName` is present → chip renders with text `Narrated by {displayName}`, positioned in the DOM order BEFORE the `<time>` (publish-date) element and AFTER the byline `<p>`.
    - Chip carries `data-testid="narrator-chip"` for tests.
    - Chip is semantically a `<span>` or `<p>` (not interactive — no link, no button).
  </behavior>

  <read_first>
    1. READ the FULL current `apps/web/components/issue/IssueHero.tsx` end-to-end. Identify:
       - The exact JSX element representing the byline (currently a `<p>` carrying "By Jesse A. Eisenbalm" or equivalent).
       - The exact JSX element representing the publish date (currently a `<time>` element with `dateTime={issue.publishedAt}`).
       - The className convention used in the hero (BEM, Tailwind, CSS modules, etc.).
    2. CONFIRM the byline → time element order matches `<verified_dom_baseline>` above. If not, locate the equivalent "publish-date line" and adjust.
    3. READ `apps/web/__tests__/issue/narrator-chip.test.ts` (created by Plan 16-03) to understand the exact selectors / assertions the test makes, including any DOM-order assertion.
  </read_first>

  <action>
    Edit `IssueHero.tsx`:

    1. If the file imports `IssueDoc`, no new import is needed (the narrator type comes for free via Plan 16-08b Task 2). Otherwise, import it.

    2. Define a small inline component or render expression for the chip (keep it local — no new file):
       ```tsx
       {issue.narrator && issue.narrator.slug !== 'jesse' && (
         <p
           className="issue-hero__narrator-chip"
           data-testid="narrator-chip"
         >
           Narrated by {issue.narrator.displayName}
         </p>
       )}
       ```

    3. Place this JSX EXACTLY between the byline `<p>` and the publish-date `<time>` element. Final DOM order:
       ```tsx
       <h1 className="issue-hero__title">{issue.title}</h1>
       <p className="issue-hero__byline">By Jesse A. Eisenbalm</p>
       {/* Narrator chip: above publish-date line, below byline (CONTEXT D-19). */}
       {issue.narrator && issue.narrator.slug !== 'jesse' && (
         <p className="issue-hero__narrator-chip" data-testid="narrator-chip">
           Narrated by {issue.narrator.displayName}
         </p>
       )}
       <time className="issue-hero__date" dateTime={issue.publishedAt}>
         {formatDate(issue.publishedAt)}
       </time>
       ```

    4. Add minimal CSS for `.issue-hero__narrator-chip` matching the existing hero typography scale (small caps, subtle accent color, or whatever the Phase 12 hero design system supports). If the project uses Tailwind utility classes inline, use those instead — match the surrounding style approach. Do NOT introduce a new styling system.

    5. Do NOT add the chip to any other element (e.g., the table of contents, the article footer). NRR-13/D-19 specify a single placement.
  </action>

  <verify>
    <automated>
      # 1. Component compiles.
      cd apps/web && pnpm tsc --noEmit components/issue/IssueHero.tsx

      # 2. The narrator chip test passes — this test (from Plan 16-03) MUST include:
      #    - chip absent when narrator is null
      #    - chip absent when narrator.slug === 'jesse'
      #    - chip present with correct text for non-Jesse narrator
      #    - DOM-order assertion: chip's element precedes the <time> publish-date element
      pnpm --filter web test:unit --run apps/web/__tests__/issue/narrator-chip.test.ts

      # 3. No regressions on existing hero tests.
      pnpm --filter web test:unit --run apps/web/__tests__/issue/ 2>&1 | tail -10
    </automated>
  </verify>

  <done>
    - Chip renders conditionally per the behaviour spec.
    - Chip's DOM position is verified to be between byline and `<time>`.
    - All chip tests pass.
    - No regression on Phase 12 hero tests.
  </done>
</task>

</tasks>

<verification>
- `grep -E 'narrator->.*displayName' apps/web/lib/sanity/queries.ts` matches.
- `grep -E "narrator\?:" apps/web/lib/sanity/types.ts` matches.
- `pnpm --filter web test:unit --run apps/web/__tests__/issue/narrator-chip.test.ts` exits 0.
- The Phase 8 commerce sentinel suite still passes (≥29 CMR- tests).
</verification>

<success_criteria>
- D-19 satisfied: chip rendered above publish-date in the issue hero.
- NRR-13 satisfied: non-Jesse narrators surface visibly on the issue page.
- NRR-14 satisfied: Jesse is implicit (no chip); non-Jesse is explicit.
- No regression on existing hero or commerce tests.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-08b-frontend-chip-SUMMARY.md`. Record:
- The exact JSX context of the chip's DOM placement (line numbers in final IssueHero.tsx).
- Confirmation that DOM-order test asserted chip-before-time.
- Cross-reference to 16-09 UAT (Andrew end-to-end pick).
</output>
