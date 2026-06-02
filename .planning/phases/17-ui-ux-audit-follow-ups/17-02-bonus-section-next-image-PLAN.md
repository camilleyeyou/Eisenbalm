---
phase: 17-ui-ux-audit-follow-ups
plan: 02
type: execute
wave: 2
depends_on: [17-01]
files_modified:
  - apps/web/components/issue/BonusSection.tsx
autonomous: true
requirements: [P17-01, P17-02, P17-07]
user_setup: []

must_haves:
  truths:
    - "BonusSection storyboard frames render via next/image (optimized, lazy, CLS-safe) instead of raw <img>"
    - "No raw <img> element and no @next/next/no-img-element eslint-disable remain in BonusSection.tsx"
    - "The storyboard wrapper div has `relative` so next/image fill is contained in its aspect-video box"
    - "bonus-section-image.test.ts is GREEN; the 234-test baseline + dep count (17) unchanged"
  artifacts:
    - path: "apps/web/components/issue/BonusSection.tsx"
      provides: "BigBudgetBonus storyboard grid using <Image fill sizes=... className='object-cover'>"
      contains: "next/image"
  key_links:
    - from: "apps/web/components/issue/BonusSection.tsx"
      to: "apps/web/next.config.ts (cdn.sanity.io remotePatterns)"
      via: "next/image src={sb.asset.url} — already-allowed remote host"
      pattern: "<Image"
---

<objective>
Convert the BigBudgetBonus storyboard image grid in BonusSection.tsx from a raw `<img>` (CLS risk, eslint-disabled) to `next/image` with `fill` layout inside the existing `aspect-video` container. This completes backlog item 999.1 and eliminates the largest cumulative-layout-shift element from the storyboard grid (P17-02).

Purpose: next/image gives automatic WebP, srcset, lazy loading, and a reserved aspect-ratio box — removing layout shift and the eslint-disable that the audit flagged.
Output: BonusSection.tsx with a CLS-safe storyboard grid; bonus-section-image.test.ts goes GREEN. No GROQ, type, dep, or next.config change.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md

<interfaces>
<!-- Confirmed in codebase — no change needed to these: -->
<!-- next.config.ts ALREADY lists cdn.sanity.io in remotePatterns (next/image needs no config edit). -->
<!-- IssueBonus.storyboards type is Array<{ asset: { url: string } | null }> — `url` is the full Sanity CDN URL, sufficient for fill mode. NO type change, NO API_CONTRACTS.md edit. -->

Current BigBudgetBonus storyboard block (BonusSection.tsx L47-67) to replace:
```tsx
{storyboards.map((sb, i) => {
  const url = sb.asset?.url
  if (!url) return null
  return (
    <div key={i} className="aspect-video overflow-hidden rounded border border-[color:var(--color-line)] bg-[color:var(--color-card)]">
      {/* next/image conversion is backlog item 999.1 — keep <img> with eslint-disable */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Storyboard ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
    </div>
  )
})}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convert storyboard grid to next/image fill</name>
  <files>apps/web/components/issue/BonusSection.tsx</files>
  <read_first>
    - apps/web/components/issue/BonusSection.tsx (full file — current raw <img> at L56, eslint-disable at L55, file header LOCKED-constraints comment at L9-19 mentions "Storyboard <img> stays" which must be updated)
    - apps/web/next.config.ts (confirm cdn.sanity.io is in remotePatterns — do NOT edit it, just verify)
    - .planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md (Pattern 1 + Code Examples "next/image fill — complete storyboard conversion"; Pitfall 1 missing `relative`, Pitfall 2 missing `sizes`)
    - apps/web/__tests__/bonus-section-image.test.ts (the 6 assertions this task must satisfy — read them so the edit matches exactly)
  </read_first>
  <action>
    1. Add `import Image from 'next/image'` to the top of BonusSection.tsx (after the existing imports, around L23).
    2. In BigBudgetBonus, replace the storyboard wrapper + raw <img> with:
       ```tsx
       <div
         key={i}
         className="relative aspect-video overflow-hidden rounded border border-[color:var(--color-line)] bg-[color:var(--color-card)]"
       >
         <Image
           src={url}
           alt={`Storyboard ${i + 1}`}
           fill
           sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 430px"
           className="object-cover"
         />
       </div>
       ```
       Key changes vs. current: ADD `relative` to the wrapper className (Pitfall 1 — fill child is position:absolute and escapes a non-relative parent); REMOVE the two comment lines (`/* next/image conversion is backlog... */` and `/* eslint-disable-next-line @next/next/no-img-element */`); REMOVE `h-full w-full` and `loading="lazy"` from the image (fill handles sizing + lazy internally).
    3. Update the file-header LOCKED-constraints comment (L14): change the line `*   - Storyboard <img> stays (next/image conversion is backlog 999.1).` to `*   - Storyboards render via next/image fill in the aspect-video container (P17-01; CLS-safe).`
    Do NOT touch JingleBonus, SpecAdBonus, subLabel, containerClass, or the section markup. Do NOT change the GROQ projection or the IssueBonus type.
  </action>
  <acceptance_criteria>
    - `grep -q "from 'next/image'" apps/web/components/issue/BonusSection.tsx` exits 0
    - `grep -q "<Image" apps/web/components/issue/BonusSection.tsx` exits 0
    - `grep -q "relative aspect-video" apps/web/components/issue/BonusSection.tsx` exits 0
    - `grep -q 'sizes="(max-width: 640px) 100vw' apps/web/components/issue/BonusSection.tsx` exits 0
    - `grep -c "<img" apps/web/components/issue/BonusSection.tsx` returns 0
    - `grep -c "@next/next/no-img-element" apps/web/components/issue/BonusSection.tsx` returns 0
    - `pnpm --filter web test:unit -- --run bonus-section-image` exits 0 (all 6 P17-01 assertions GREEN)
  </acceptance_criteria>
  <verify>
    <automated>cd apps/web && pnpm test:unit -- --run bonus-section-image 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>BonusSection.tsx renders storyboards with `<Image fill>`, no raw `<img>` or eslint-disable remains, wrapper has `relative`, and bonus-section-image.test.ts is fully GREEN.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` — bonus-section-image.test.ts GREEN; all prior 234 tests still GREEN.
- `pnpm --filter web build` exits 0 (confirms next/image + remotePatterns resolve; no TS error).
- P17-02 (CLS) is verified MANUALLY post-merge via Lighthouse on a preview `/issue/[slug]` and recorded in VERIFICATION.md — NOT a blocker for this plan's code completion.
</verification>

<success_criteria>
- Storyboard grid uses next/image fill with sizes hint; no raw <img>; no eslint-disable; wrapper is `relative aspect-video`.
- bonus-section-image.test.ts GREEN, 234 baseline GREEN, dep count still 17, build exits 0.
</success_criteria>

<output>
After completion, create `.planning/phases/17-ui-ux-audit-follow-ups/17-02-SUMMARY.md`
</output>
