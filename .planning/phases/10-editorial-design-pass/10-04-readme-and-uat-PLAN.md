---
phase: 10-editorial-design-pass
plan: 04
type: execute
wave: 2
depends_on:
  - 10-01
  - 10-02
  - 10-03
files_modified:
  - apps/web/README.md
autonomous: false
requirements:
  - DES-01
  - DES-02
  - DES-03
  - DES-04
  - DES-05
  - DES-06
must_haves:
  truths:
    - "apps/web/README.md gains a `## Phase 10 — Editorial Design Pass` section documenting the typography utilities and how to maintain them"
    - "The README section lists every utility added in 10-01 (.prose-measure, .drop-cap, .ornament-divider, .eyebrow, .metadata-block) with one-line semantics and where it's consumed"
    - "The README documents that next/font/google is the ONLY font loader (no HTTP Google Fonts <link>)"
    - "Andrew manually verifies the live deploy of /issue/[any-slug] against the six DES success criteria and signs off"
    - "All six DES requirements (DES-01..DES-06) move from Pending to Complete in REQUIREMENTS.md after Andrew's sign-off"
  artifacts:
    - path: "apps/web/README.md"
      provides: "Phase 10 onboarding section + utility class reference"
      contains: "Phase 10"
  key_links:
    - from: "apps/web/README.md"
      to: "apps/web/app/globals.css"
      via: "Documentation references the .prose-measure, .drop-cap, etc. utilities by name"
      pattern: "prose-measure|drop-cap|ornament-divider"
---

<objective>
Close Phase 10. Two tasks: (1) document the redesign in apps/web/README.md so future
engineers and Andrew know which utility classes drive the editorial typography, and
(2) Andrew runs the six-step UAT against a live deploy of the issue page and signs
off. This plan is `autonomous: false` because Task 2 is the human verification gate.

Purpose: Without documentation, the next plan that touches issue rendering will
re-derive the typography by reading components rather than by reading globals.css —
losing the named-utility contract. Without Andrew's UAT, Phase 10 ships without a
human eye on the actual rendered output.

Output:
- apps/web/README.md gains a `## Phase 10 — Editorial Design Pass` section.
- HUMAN-UAT artifact (Andrew's verbal sign-off, recorded in the plan SUMMARY).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@apps/web/README.md
@apps/web/app/globals.css
@apps/web/app/layout.tsx
@apps/web/components/issue/EditorialSection.tsx
@apps/web/components/issue/CaseStudySection.tsx
@apps/web/components/issue/IssueHero.tsx
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add `Phase 10 — Editorial Design Pass` section to apps/web/README.md</name>
  <files>apps/web/README.md</files>
  <read_first>
    - apps/web/README.md (the file being modified — find the existing Phase 7 section at line 314 to confirm formatting convention; insert the Phase 10 section AFTER any later phase section or at the end-of-file if Phase 10 is the last)
    - apps/web/app/globals.css (confirm the exact CSS utility class names — must match docs verbatim)
    - apps/web/app/layout.tsx (confirm exact font names — Playfair Display + Lora — referenced in docs)
  </read_first>
  <action>
Append the following section to apps/web/README.md. Locate the file's last existing
phase section (currently `## Phase 8 — …` or `## Phase 7 — Game Rendering` based on
which one ships last) and add Phase 10 BELOW it, separated by a blank line. If the
README already has a `## Phase 10` placeholder, replace its body with this content.

```markdown
## Phase 10 — Editorial Design Pass

The issue page reads as an editorial magazine, not a SaaS landing page. Phase 10
locks the typographic hierarchy via five named CSS utilities and one prop on
`EditorialSection`. To change the look, edit the utilities — not the components.

### Typography stack

- **Display serif** — Playfair Display, loaded via `next/font/google` in
  `apps/web/app/layout.tsx`. Weights: 400, 600, 700. Used for the charity name
  (`IssueHero`), all section headlines (`EditorialSection`, `CaseStudySection`),
  in-prose h2/h3 from Portable Text, and the drop-cap initial letter.
- **Body serif** — Lora, loaded via `next/font/google`. Weights: 400, 500, 700;
  styles: normal + italic. Used for paragraph prose (`PortableTextRenderer`),
  the masthead byline, and blockquotes.
- **UI sans** — Inter (unchanged from Phase 2). Used for the `.eyebrow` label,
  `.metadata-block` panels, and site chrome.

`next/font/google` is the ONLY font loader. Never add a
`<link href="https://fonts.googleapis.com/...">` tag — the source-scan test in
`apps/web/__tests__/issue-page-typography.test.ts` (DES-01 block) fails the build
if you do.

### Utility classes (defined in `apps/web/app/globals.css`)

| Utility | Purpose | Where consumed |
|---|---|---|
| `.prose-measure` | Constrain prose column to `max-width: 68ch` with mobile padding. | `EditorialSection`, `CaseStudySection`, `IssueHero` |
| `.drop-cap` | Style the first paragraph's first letter as a 3.5em editorial drop cap. Apply to the WRAPPER div that contains the `<p>` — the selector is `.drop-cap > p:first-of-type::first-letter`. | `PortableTextRenderer` wrapper, gated by `EditorialSection`'s `lead` prop |
| `.ornament-divider` | Centered FLEURON ❦ glyph used between sections in place of `<hr>`. | Top of every editorial section |
| `.eyebrow` | Small-caps, letter-spaced UI label above section headlines. | `EditorialSection`, `CaseStudySection`, `IssueHero` |
| `.metadata-block` | Footnote-style dl/dt/dd panel for structured metadata with accent left-border + tabular numerals. | `CaseStudySection` (subject); slot for future Sanity metadata fields |

All five utilities reference CSS variables (`var(--color-primary)`,
`var(--color-accent)`, `var(--color-text)`, `var(--font-display)`,
`var(--font-body)`, `var(--font-ui)`) so per-issue theme injection (Phase 2's
`serializeThemeCss`) still drives palette without breaking the typographic
hierarchy.

### The drop cap

Exactly ONE EditorialSection per issue receives `lead`:

```tsx
<EditorialSection
  id="origin-story"
  label="ORIGIN STORY"
  headline={issue.originStory?.headline}
  body={issue.originStory?.body}
  lead
/>
```

The `lead` prop adds `drop-cap` as the className on the `PortableTextRenderer`
wrapper div, which makes the rendered `<p>` a direct child — the
`.drop-cap > p:first-of-type::first-letter` selector then applies.

To move the drop cap to a different section, move the `lead` prop. To remove
the drop cap entirely, delete the `lead` prop. The DES-02 source-scan test
asserts that exactly ONE `lead` occurrence exists in
`apps/web/app/issue/[slug]/page.tsx`.

### What you must NOT touch (locked artifacts)

- `apps/web/components/issue/ShopCallout.tsx` — Phase 2 + CMR-09 contract. One
  sentence + one button. No banner, modal, popup, or countdown. Source-scan
  tripwire: `apps/web/__tests__/issue-page-shop-callout.test.ts`.
- `apps/web/components/issue/GameSlot.tsx` — Phase 7 GAM-03 contract.
  `sandbox="allow-scripts"` only; never `allow-same-origin`. Source-scan
  tripwire: `apps/web/__tests__/game-sandbox.test.ts`.
- The per-issue theme injection mechanism in `apps/web/app/issue/[slug]/layout.tsx`
  (`serializeThemeCss` + `ThemeApplier`). Phase 10 utilities consume the
  `--color-*` variables it emits — do not hardcode hex in component classNames.

### Verifying the redesign

```bash
pnpm --filter web build
pnpm --filter web test:unit
```

The unit suite includes the Phase 10 source-scan tripwire
(`__tests__/issue-page-typography.test.ts`), which asserts the contracts above.
If it fails, fix the source — do not weaken the assertions.
```

Constraints:
- The section header is exactly `## Phase 10 — Editorial Design Pass`.
- The em-dash is `—` (U+2014), matching the other phase section headers (`## Phase 7 — Game Rendering` precedent).
- The table is GitHub-flavored markdown.
- The code block language is `markdown` for the outer block? No — write the section content as plain markdown, NOT inside a code fence. The block above is the literal section to insert (without an outer fence).
- Do NOT remove or modify any existing README section.
- Length target: ~110 lines, comparable to the existing Phase 7 section (~200 lines per STATE.md).
  </action>
  <verify>
    <automated>grep -q "^## Phase 10" apps/web/README.md && grep -q "prose-measure" apps/web/README.md && grep -q "drop-cap" apps/web/README.md && grep -q "ornament-divider" apps/web/README.md && grep -q "metadata-block" apps/web/README.md && grep -q "next/font/google" apps/web/README.md</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "^## Phase 10" apps/web/README.md
    - grep -q "Editorial Design Pass" apps/web/README.md
    - grep -q "prose-measure" apps/web/README.md
    - grep -q "drop-cap" apps/web/README.md
    - grep -q "ornament-divider" apps/web/README.md
    - grep -q "metadata-block" apps/web/README.md
    - grep -q "eyebrow" apps/web/README.md
    - grep -q "Playfair Display" apps/web/README.md
    - grep -q "Lora" apps/web/README.md
    - grep -q "next/font/google" apps/web/README.md
    - grep -q "ShopCallout.tsx" apps/web/README.md (locked artifacts section)
    - grep -q "GameSlot.tsx" apps/web/README.md (locked artifacts section)
    - grep -q "fonts.googleapis.com" apps/web/README.md (the prohibition is documented)
    - grep -q "lead" apps/web/README.md (the drop cap mechanism is documented)
    - grep -q "issue-page-typography.test.ts" apps/web/README.md (the source-scan tripwire is referenced)
    - The pre-existing Phase 7 section is still present: grep -q "^## Phase 7" apps/web/README.md
  </acceptance_criteria>
  <done>
    apps/web/README.md has a `## Phase 10 — Editorial Design Pass` section
    documenting the five utilities, the drop-cap mechanism, the next/font/google
    contract, the locked artifacts (ShopCallout + GameSlot + theme injection),
    and the build + test commands. Pre-existing phase sections preserved.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew UAT — visit a deployed issue and verify the six DES success criteria</name>
  <read_first>
    - apps/web/README.md (the "Phase 10" section added in Task 1 — Andrew references it as the runbook)
    - .planning/REQUIREMENTS.md (DES-01..DES-06 — the six criteria Andrew is verifying)
  </read_first>
  <files>(none — read-only UAT against deployed app; outcomes captured in SUMMARY)</files>
  <action>Pause the executor. Andrew performs the six DES checks documented in &lt;how-to-verify&gt; against the live Vercel deploy of /issue/[slug]. This is a checkpoint:human-verify gate; the executor resumes only on the resume-signal. Pre-deploy gate (the executor runs these once before pausing): `pnpm --filter web build` and `pnpm --filter web test:unit` — both must exit 0 before Andrew is asked to look at the deployed page.</action>
  <verify>
    <automated>pnpm --filter web build &amp;&amp; pnpm --filter web test:unit</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web build` exits 0 (build sanity pre-UAT)
    - `pnpm --filter web test:unit` exits 0 (Phase 10 typography source-scan + Phase 7 game-sandbox + Phase 8 CMR-09 + Phase 2 tests all pass)
    - Andrew confirms DES-01 (Playfair Display + Lora visibly serif, no FOUT) on the deployed issue page
    - Andrew confirms DES-02 (drop cap on Origin Story first paragraph; NOT on subsequent sections; renders cleanly at 360px viewport)
    - Andrew confirms DES-03 (comfortable measure on ≥768px; full-width with padding on mobile; generous line-height)
    - Andrew confirms DES-04 (ornament ❦ between sections; small-caps eyebrow labels)
    - Andrew confirms DES-05 (case study Subject in visually distinct .metadata-block panel)
    - Andrew confirms DES-06 (per-issue theme accent colors change between two issues; typographic hierarchy stable across themes)
    - Andrew confirms cross-checks: ShopCallout still present at bottom (no banner/modal/popup/countdown); Game iframe (if any) still sandboxed with no overflow
    - Andrew types "approved" at the resume-signal
  </acceptance_criteria>
  <done>Andrew signs off on all six DES criteria + cross-checks; the SUMMARY records the URL tested, the issue slugs used to verify theme switching (DES-06), and the date. REQUIREMENTS.md DES-01..DES-06 move from Pending to Complete.</done>
  <what-built>
    - Playfair Display + Lora paired Google Fonts via next/font/google (Plan 10-01)
    - .prose-measure, .drop-cap, .ornament-divider, .eyebrow, .metadata-block utilities in globals.css (Plan 10-01)
    - Refactored IssueHero (masthead), EditorialSection (eyebrow + ornament + lead-prop drop cap), CaseStudySection (metadata block), PortableTextRenderer (19px/1.7 body, accent blockquote border) (Plan 10-02)
    - Source-scan tripwire test issue-page-typography.test.ts with 6 describe blocks (Plan 10-03)
    - apps/web/README.md Phase 10 section (Task 1 above)
  </what-built>
  <how-to-verify>
    Pre-deploy gate: from the project root, run:

    ```
    pnpm --filter web build
    pnpm --filter web test:unit
    ```

    Both must exit 0. Then deploy to Vercel (or visit the existing latest deploy
    URL if 10-01..10-03 were already merged).

    Visit `/issue/issue-1` (or whichever slug is the latest published issue at
    `https://huggingface.co/papers/2602.08025` — sorry, wrong domain; visit your
    deployed Eisenbalm Dispatch URL `/issue/<latest-slug>`). Confirm each of the
    six DES success criteria by EYE:

    1. **DES-01** (typography): The charity name and section headlines render in
       a serif display face (Playfair Display). Body paragraphs render in a
       serif body face (Lora). No flash of unstyled text on first load.

    2. **DES-02** (drop cap): The first paragraph of the Origin Story section
       has an oversized initial letter (~3x body size) hanging into the left
       margin. The drop cap should NOT appear on The Problem, Founder Bio,
       Case Study, or any other section's first paragraph.

       Resize the browser to ~360px width — the drop cap should still render
       cleanly (slightly smaller per the mobile media query) without breaking
       the paragraph layout.

    3. **DES-03** (measure + line-height): On desktop (≥768px), body paragraph
       columns are comfortably narrow — not edge-to-edge. On mobile, full width
       with breathing-room padding. Body line-height is generous; paragraphs
       don't feel cramped.

    4. **DES-04** (dividers + eyebrow): Between sections, you see a small
       centered ❦ glyph instead of a 1px horizontal line. Above each section
       headline, you see a small-caps, letter-spaced label like ORIGIN STORY or
       THE PROBLEM in a UI sans font (not the body serif).

    5. **DES-05** (case study metadata): The Case Study section's Subject
       metadata renders in a visually distinct panel — accent-colored left
       border, smaller type, monospaced numerals (if any), separated from the
       running prose.

    6. **DES-06** (theme preservation): The page's accent colors (links,
       dividers, eyebrows borders) reflect the issue's theme. Visit a SECOND
       issue (different slug, different theme); the accent color changes
       visibly while the typographic hierarchy stays identical.

    Cross-checks:
    - Scroll to the bottom of the issue. The ShopCallout block (one sentence +
      one button) is still there, exactly as in Phase 2 — no banner, no modal,
      no countdown. The button leads to /shop.
    - The Game section iframe (if the issue has a game) still renders inside
      its sandboxed container, no layout overflow. The deliberation accordion
      stub (Phase 9 placeholder) still renders without overlap.

    If everything looks correct, reply "approved" in the conversation.
    If anything looks wrong, describe what you see (which DES criterion, what
    you observed) and we revise.
  </how-to-verify>
  <resume-signal>Type "approved" to close Phase 10, or describe specific issues you see (e.g. "DES-02 drop cap missing on issue-2", "DES-04 ornament divider not visible on mobile") and we will spawn a gap-closure plan.</resume-signal>
</task>

</tasks>

<verification>
- apps/web/README.md has a `## Phase 10 — Editorial Design Pass` section with the
  utility table, drop-cap mechanism, locked artifacts, and build/test commands
- Andrew has visited a deployed issue page and confirmed all six DES success criteria
- REQUIREMENTS.md DES-01..DES-06 are marked Complete after sign-off
- STATE.md Phase 10 row reflects 4/4 plans complete
</verification>

<success_criteria>
- README Phase 10 section landed with all five utility names + locked-artifact reminders
- Andrew's UAT sign-off recorded in the plan SUMMARY (with date)
- All Phase 10 requirements (DES-01..DES-06) marked Complete in REQUIREMENTS.md
- Phase 10 row in STATE.md updated to Complete
</success_criteria>

<output>
After completion, create `.planning/phases/10-editorial-design-pass/10-04-readme-and-uat-SUMMARY.md`
recording: the README diff summary, the URL Andrew tested against, the date of
sign-off, and any deferred items observed during UAT (which would feed a future
gap-closure plan or v2 backlog).
</output>
