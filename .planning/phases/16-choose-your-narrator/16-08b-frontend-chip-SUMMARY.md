---
phase: 16-choose-your-narrator
plan: 08b
type: execute
status: complete
requirements: [NRR-08]
dependency_graph:
  requires:
    - 16-01 (narratorProfile schema + canonical narrator GROQ projection in docs/API_CONTRACTS.md §1.2)
    - 16-03 (apps/web/__tests__/narrator-chip.test.ts source-scan tripwire — RED in Wave 1)
  provides:
    - "Reader-facing narrator surface on the issue masthead (chip above publish-date)"
    - "Canonical no-leak GROQ projection: narrator->{name, slug, active} only"
    - "Issue.narrator? TypeScript shape (apps/web/lib/sanity/types.ts) consumed by IssueHero + future narrator-aware UI"
  affects:
    - apps/web/lib/sanity/queries.ts (QUERY_ISSUE_BY_SLUG)
    - apps/web/lib/sanity/types.ts (IssueNarrator + Issue.narrator?)
    - apps/web/components/issue/IssueHero.tsx (chip render + <time> upgrade)
    - apps/web/app/issue/[slug]/page.tsx (narrator prop wiring)
tech-stack:
  added: []
  patterns:
    - "Source-scan tripwire (Phase 7 GAM-03 / Phase 13 deliberation-conversation pattern) gates chip JSX position, no-leak projection, and styling convention — already-passing Vitest source-scan, no DOM render needed"
    - "MED-04 machine-readout styling reuse (font-ui / 11px / uppercase / 0.18em tracking / --color-text-mute) from BonusSection.tsx — no new design surface"
    - "Optional + nullable typed field (narrator?: T | null) handles three suppression states with one signature: undefined (older issues), null (explicit no-narrator), Jesse default, and inactive (parked)"
key-files:
  created: []
  modified:
    - apps/web/lib/sanity/queries.ts
    - apps/web/lib/sanity/types.ts
    - apps/web/components/issue/IssueHero.tsx
    - apps/web/app/issue/[slug]/page.tsx
decisions:
  - "Followed canonical docs/API_CONTRACTS.md §1.2 schema (name + slug + active) over stale plan text (displayName + slug !== 'jesse'). Plan 16-08b was drafted before the iteration-2 schema alignment commit (4c60712 'align Plans 16-05/16-06/16-07/16-08a to canonical narratorProfile schema'). The test (apps/web/__tests__/narrator-chip.test.ts), API_CONTRACTS, narratorProfile.ts schema, and Phase 16-08a seed all agree: canonical is name. CLAUDE.md precedence applied: API_CONTRACTS.md is the canonical schema source."
  - "Chip suppression guard is three-way: narrator && narrator.active && narrator.name !== 'Jesse Eisenbalm'. Covers (a) absent/null narrator, (b) parked (active=false) narrator → silent Jesse fallback per CONTEXT D-14, (c) explicit Jesse narrator. The test's source-scan regex tolerates the extra `narrator.active` term — it only requires `narrator && ... name !== 'Jesse Eisenbalm'` somewhere in the conditional."
  - "Chip placed ABOVE the eyebrow (publish-date line) — NOT between byline and time as the plan's stale verified_dom_baseline suggested. The current hero (post-Phase 12 restyle) has eyebrow→h1→byline ordering, with the publish date carried by the eyebrow at the top. Per D-19 'above the publish-date line', the chip's correct position is above the eyebrow. The byline ('by Jesse A. Eisenbalm') is the author byline (Jesse-as-publisher), unrelated to per-issue narrator — keeping it as-is preserves the masthead identity."
  - "Eyebrow upgraded to wrap the publish date in a semantic <time dateTime={publishDate}> element. Two birds: (1) NRR-08(e) source-scan now has a real <time> anchor to test chipPos < timePos against, (2) accessibility/SEO win — screen readers and crawlers now have the canonical publish-date anchor."
  - "Reused BonusSection.tsx:145 styling convention verbatim (font-ui / 11px / uppercase / 0.18em tracking / --color-text-mute). No new font, no new token, no new design system surface. Phase 12 MED-04 machine-readout aesthetic preserved."
metrics:
  duration: ~12min
  completed_at: "2026-05-29"
  tasks_count: 3
  files_count: 4
---

# Phase 16 Plan 08b: Frontend Narrator Chip Summary

Wire the per-issue narrator surface end-to-end on the frontend: canonical GROQ projection (name + slug + active), Issue.narrator? TypeScript shape, and a conditional masthead chip in IssueHero positioned above the publish-date line per CONTEXT D-19, gated behind a three-way suppression check (absent / inactive / Jesse → no chip).

## Deviations from Plan

### Auto-fixed: schema drift between plan text and canonical contract (Rule 2 — required for correctness)

**1. [Rule 2 — Correctness] Followed canonical docs/API_CONTRACTS.md schema, not stale plan text**

- **Found during:** Task 1 (queries.ts) read-first phase
- **Issue:** Plan 16-08b body uses the stale field names: `narrator->{ "slug": slug.current, displayName }`, chip text `Narrated by {displayName}`, suppression guard `slug !== 'jesse'`. But docs/API_CONTRACTS.md §1.2 (canonical) projects `narrator-> { name, "slug": slug.current, active }`, apps/studio/schemas/narratorProfile.ts has the field as `name` (not `displayName`), and apps/web/__tests__/narrator-chip.test.ts (Plan 16-03 RED tripwire) explicitly source-scans for `narrator.name`, `name !== 'Jesse Eisenbalm'`, and `name + slug + active` in the projection.
- **Root cause:** Plan 16-08b was authored before commit 4c60712 ("align Plans 16-05/16-06/16-07/16-08a to canonical narratorProfile schema (name/active/voiceConstraints/voiceRubric as text)") aligned the rest of Phase 16 to the canonical shape. Plan 16-08b was not patched in that iteration.
- **Fix:** Implemented per the canonical contract: `narrator->{name, "slug": slug.current, active}` projection, `IssueNarrator { name, slug, active }` type, chip guard `narrator && narrator.active && narrator.name !== 'Jesse Eisenbalm'`, chip text `Narrated by {narrator.name}`. CLAUDE.md precedence applied: docs/API_CONTRACTS.md is canonical schema source.
- **Files modified:** apps/web/lib/sanity/queries.ts, apps/web/lib/sanity/types.ts, apps/web/components/issue/IssueHero.tsx
- **Commits:** 3a19d09 (queries), 03ad0ec (types), 903724d (hero)

**2. [Rule 2 — Correctness] Chip placed above eyebrow, not between byline and time**

- **Found during:** Task 3 read of current IssueHero.tsx
- **Issue:** Plan's `<verified_dom_baseline>` envisioned a hero structure of `h1 → byline → chip → <time>`, with the chip between byline and a stand-alone `<time>` element. The current hero (post-Phase 12 restyle) is `eyebrow (with date) → h1 → byline → mission → meta-row` — there is no stand-alone `<time>` element, and the byline is the masthead "By Jesse A. Eisenbalm" publisher identity, not a per-issue date line. The plan explicitly anticipated this drift ("If the executor finds IssueHero.tsx has been restructured so that there is no `<time>` element after a byline, STOP and surface the discrepancy") and authorized the fix: "find the equivalent 'publish-date line'."
- **Fix:** (a) Wrapped the date portion of the eyebrow in a semantic `<time dateTime={publishDate}>` element — gives screen readers / crawlers the canonical publish-date anchor AND gives NRR-08(e) source-scan a real `<time>` anchor to test against. (b) Placed the chip JSX ABOVE the eyebrow, satisfying D-19 "above the publish-date line" intent. The byline (publisher identity) was left untouched.
- **Files modified:** apps/web/components/issue/IssueHero.tsx (chip block + eyebrow `<time>` wrap)
- **Commit:** 903724d

### Auto-fixed: comment containing `<time>` text broke source-scan (Rule 1 — bug)

**3. [Rule 1 — Bug] Comment text "<time> publish-date element" tripped NRR-08(e) source-scan**

- **Found during:** Task 3 first test run
- **Issue:** The NRR-08(e) test does `src.indexOf('<time')` to find the first `<time` occurrence in the IssueHero source and asserts `chipPos < timePos`. My initial comment block ABOVE the chip JSX said: `* <time> publish-date element), per CONTEXT D-19`. That ASCII string matched `<time` and was found at character 3476, BEFORE the actual `Narrated by` chip JSX at 4451 — failing the test.
- **Fix:** Rephrased the comment to "semantic publish-date timestamp" (no `<time` substring) above the chip. The first `<time` in the file is now in a comment AFTER the chip (line 114) — correctly ordered. All 9 assertions pass.
- **Files modified:** apps/web/components/issue/IssueHero.tsx (comment scrub)
- **Commit:** 903724d (squashed with original chip render)

## Final DOM Placement (IssueHero.tsx final state)

```tsx
<div className="relative" style={{ zIndex: 1 }}>
  {/* Lines 104-111 — NARRATOR CHIP, above publish-date line per CONTEXT D-19 */}
  {narrator && narrator.active && narrator.name !== 'Jesse Eisenbalm' && (
    <p
      data-testid="narrator-chip"
      className="mb-6 font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em] text-[color:var(--color-text-mute)]"
    >
      Narrated by {narrator.name}
    </p>
  )}

  {/* Lines 117-120 — Eyebrow (publish-date line) with semantic <time> */}
  <p className="eyebrow mb-9 flex items-center gap-[14px] text-[color:var(--color-primary)]">
    <span className="inline-block h-px w-9 bg-[color:var(--color-primary)]" aria-hidden="true" />
    {issueLabel} —{' '}
    <time dateTime={publishDate}>{formattedDate}</time>
  </p>

  {/* h1 charity name, byline, mission, meta-row, PDF link — all unchanged */}
</div>
```

**Line numbers (final file):**
- Chip JSX block: lines 104–111
- Chip "Narrated by" string: line 109
- First `<time` occurrence in source: line 114 (a comment); first JSX `<time>` element: line 120

## NRR-08(e) Source-Scan DOM-Order Verification

`apps/web/__tests__/narrator-chip.test.ts` lines 130–151 assert:

```ts
const chipPos = src.indexOf('Narrated by')   // 4538 in final file
const timePos = src.indexOf('<time')         // 4731 in final file (in comment)
expect(timePos).toBeGreaterThan(0)            // ✓ pass
expect(chipPos).toBeLessThan(timePos)         // ✓ 4538 < 4731 → pass
```

Because React renders sibling children in source order, the source-position assertion `chipPos < timePos` is a sufficient proxy for the rendered DOM-order invariant from CONTEXT D-19 ("chip above publish-date line"). **Verified passing.**

## Test Results

**Plan target test (apps/web/__tests__/narrator-chip.test.ts):**
- Before this plan (Wave 1 RED state): 6 failed / 3 passed (the 3 "skip-on-missing-file" early-return assertions)
- After this plan: **9 passed / 0 failed** — all NRR-08(a)/(b)/(c)/(d)/(e) + DEL-04 no-model-names assertions green

**Full web test suite regression check:** `pnpm --filter web test:unit`
- **26 files, 234/234 tests passing** — including all 54 hero / typography / shop-callout / motion / theme tests
- **Zero regressions**

**TypeScript:** `pnpm tsc --noEmit` — all errors pre-existing in unrelated files (checkout-create-session.test.ts, theme.test.ts); my modified files (queries.ts, types.ts, IssueHero.tsx, page.tsx) compile cleanly.

## Cross-References

- **Forward**: Phase 16-09 (verification-and-uat) — UAT path includes Andrew picking a non-Jesse narrator in Studio and verifying the chip surfaces on the rendered issue page. Will also exercise the active=false silent-fallback path (CONTEXT D-14).
- **Backward**: Phase 16-01 (canonical narratorProfile schema), Phase 16-03 (web test scaffold — RED tripwire that now turns GREEN), Phase 16-08a (seed narrators — when seed runs in production, the test fixture issues with non-Jesse narrators light up the chip).
- **Sibling (parallel Wave 4)**: Phase 16-06 (chronicler narrator), Phase 16-07 (qa judge narrator) — concurrent work on the pipeline side. This plan touches only the frontend surface and shares no files with those plans.

## Commits

| Task | Commit  | Files                                                                         |
| ---- | ------- | ----------------------------------------------------------------------------- |
| 1    | 3a19d09 | apps/web/lib/sanity/queries.ts                                                |
| 2    | 03ad0ec | apps/web/lib/sanity/types.ts                                                  |
| 3    | 903724d | apps/web/components/issue/IssueHero.tsx, apps/web/app/issue/[slug]/page.tsx   |

## Success Criteria

- [x] D-19 satisfied: chip rendered above publish-date in the issue hero (chipPos < timePos in source = DOM-order proxy).
- [x] NRR-08 satisfied: non-Jesse narrators surface visibly on the issue page (data-testid="narrator-chip", text "Narrated by {narrator.name}").
- [x] NRR-08 satisfied: Jesse is implicit (no chip when narrator is null/undefined OR active=false OR name='Jesse Eisenbalm'); non-Jesse + active is explicit.
- [x] NRR-08(d) satisfied: GROQ projection contains ONLY name + slug + active. voiceConstraints / voiceRubric / exampleSamples MUST NOT and DO NOT appear in queries.ts — verified by source-scan + inline lock comment.
- [x] No regression on existing hero or commerce tests (234/234 passing).
- [x] All 9 narrator-chip.test.ts assertions pass (was 6 failed / 3 passed in Wave 1 RED).

## Self-Check: PASSED

- apps/web/lib/sanity/queries.ts → FOUND (commit 3a19d09, narrator-> projection on QUERY_ISSUE_BY_SLUG)
- apps/web/lib/sanity/types.ts → FOUND (commit 03ad0ec, IssueNarrator type + Issue.narrator? field)
- apps/web/components/issue/IssueHero.tsx → FOUND (commit 903724d, chip + <time> wrap)
- apps/web/app/issue/[slug]/page.tsx → FOUND (commit 903724d, narrator prop wiring)
- Commits 3a19d09, 03ad0ec, 903724d → all present in `git log --all`
- narrator-chip.test.ts → 9/9 passing (verified)
- Full web suite → 234/234 passing (verified)
