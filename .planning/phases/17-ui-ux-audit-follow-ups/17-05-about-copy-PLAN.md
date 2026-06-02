---
phase: 17-ui-ux-audit-follow-ups
plan: 05
type: execute
wave: 2
depends_on: [17-01]
files_modified:
  - apps/web/app/about/page.tsx
autonomous: false
requirements: [P17-05, P17-07]
user_setup: []

must_haves:
  truths:
    - "The /about page no longer displays the 'This page is being written' placeholder"
    - "The page shows real Jesse-voice interim copy (dry, precise, no irony, no exclamation) inside the existing <article> wrapper"
    - "Any not-yet-final paragraph is marked with a greppable TODO(Andrew) comment so Andrew can swap it in one line"
    - "about-page.test.ts is GREEN; the page is code-complete before Andrew's voice approval (Andrew approval is a non-blocking manual gate)"
  artifacts:
    - path: "apps/web/app/about/page.tsx"
      provides: "About page with <article> wrapper, h1, Jesse-voice interim prose, TODO(Andrew) marker; no placeholder string"
      contains: "TODO(Andrew)"
  key_links:
    - from: "apps/web/app/about/page.tsx"
      to: "Jesse voice constraints (CLAUDE.md / brief)"
      via: "interim prose: dry, precise, no exclamation, no AI self-reference, ≤4 sentences/paragraph"
      pattern: "<article"
---

<objective>
Replace the "This page is being written" placeholder on /about with real Jesse-voice interim copy inside the existing structural JSX, marked with a greppable `TODO(Andrew)` comment for final approval. Per 17-RESEARCH Open Question 1, this plan is `autonomous: false`: the developer ships code-complete structure + interim copy; Andrew approves the final voice in a non-blocking manual gate.

Purpose: The about page is the publication's statement of self; the placeholder reads as broken in UAT. Interim Jesse-voice copy makes the page presentable now, while the TODO(Andrew) marker keeps the final wording an editorial decision.
Output: about/page.tsx with no placeholder, real interim prose, TODO(Andrew) marker; about-page.test.ts GREEN. Andrew's voice approval recorded in the checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md

<interfaces>
<!-- Current about/page.tsx structure (preserve the metadata export + <article>/<h1> shell): -->
<!--   export default function AboutPage() returns: -->
<!--     <article className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-16"> -->
<!--       <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">About</h1> -->
<!--       <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">The Eisenbalm Dispatch publishes weekly. This page is being written.</p>  <-- REMOVE this string -->
<!--     </article> -->
<!-- Jesse voice (CLAUDE.md / brief): dry, precise, absurdly serious. No winking, no irony signaling, no exclamation marks. Charities treated with Fortune 500 gravity. -->
<!-- The two new -text AA-safe tokens exist (--color-primary-text, --color-accent-text) if a link is needed; body prose uses --color-text. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace placeholder with Jesse-voice interim copy + TODO(Andrew) marker</name>
  <files>apps/web/app/about/page.tsx</files>
  <read_first>
    - apps/web/app/about/page.tsx (full file — metadata export L4-21, <article>/<h1> shell L30-33, placeholder <p> at L34-36 with the exact string "The Eisenbalm Dispatch publishes weekly. This page is being written.")
    - .planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md (Pattern 4 — /about copy structure with TODO(Andrew) marker; Pitfall 6 — Jesse-voice drift, avoid marketing register)
    - apps/web/app/charities/page.tsx (reference for Jesse-voice register already in the codebase — "No charities indexed yet." dry, no exclamation)
    - apps/web/__tests__/about-page.test.ts (the two assertions: no "This page is being written" + <article> present)
  </read_first>
  <action>
    In apps/web/app/about/page.tsx, keep the `metadata` export and the `<article className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-16">` + `<h1 ...>About</h1>` shell verbatim. Replace ONLY the single placeholder `<p>` (the one containing "This page is being written.") with:

    1. A JSX comment immediately before the prose, exactly:
       `{/* TODO(Andrew): Replace the interim paragraphs below with your approved /about copy. Voice: Jesse — dry, precise, no irony signaling, no exclamation marks. Max 3-4 paragraphs. */}`
    2. Two or three interim Jesse-voice paragraphs, each `<p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">`. Content must be dry, precise, factual, no exclamation marks, no AI self-reference, no marketing superlatives, ≤4 sentences per paragraph. Cover, in this register:
       - What the Dispatch is: a weekly editorial that selects one overlooked charity, produces an eight-section issue about it, and donates one hundred percent of Jesse A. Eisenbalm lip balm proceeds to that charity.
       - The editorial posture: each charity is treated with the gravity ordinarily reserved for a Fortune 500 company; the question the issue answers is why the organization deserves to exist, answered without sentiment.
       - (Optional third paragraph) The cadence: a new issue ships every Thursday after editorial review.

    Use ONLY `var(--color-*)` tokens for color (the existing classes already do). Do NOT add a 'use client' directive, do NOT change the metadata export, do NOT introduce new imports or hardcoded hex. The interim copy must NOT contain the substring "This page is being written".
  </action>
  <acceptance_criteria>
    - `grep -c "This page is being written" apps/web/app/about/page.tsx` returns 0
    - `grep -q "<article" apps/web/app/about/page.tsx` exits 0
    - `grep -q "TODO(Andrew)" apps/web/app/about/page.tsx` exits 0
    - `grep -c "!" apps/web/app/about/page.tsx` returns 0 inside the prose (no exclamation marks in copy — verify visually; `!` may appear only in JSX/TS syntax, not in the paragraph text)
    - `grep -c "#[0-9a-fA-F]\{6\}" apps/web/app/about/page.tsx` returns 0 (no hardcoded hex)
    - `pnpm --filter web test:unit -- --run about-page` exits 0 (no-placeholder + <article> assertions GREEN)
  </acceptance_criteria>
  <verify>
    <automated>cd apps/web && pnpm test:unit -- --run about-page 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>about/page.tsx shows Jesse-voice interim copy inside the <article> shell, contains a TODO(Andrew) marker, no "This page is being written" string, and about-page.test.ts is GREEN. The page is code-complete.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew approves /about voice (non-blocking manual gate)</name>
  <files>apps/web/app/about/page.tsx</files>
  <action>
    PAUSE for Andrew's editorial sign-off on the interim /about copy. Code is already complete and about-page.test.ts is GREEN after Task 1 — this checkpoint changes no code unless Andrew supplies different wording. Present the rendered /about page to Andrew, capture his decision (approve interim copy as-is, or replace with his wording), apply any wording change to the same <p> elements, then remove the TODO(Andrew) marker once the copy is final. This is a non-blocking editorial gate, NOT a code blocker — phase code-completion does not depend on this approval.
  </action>
  <what-built>
    The /about page now renders real Jesse-voice interim copy (dry, precise, no irony) inside the existing article/typography shell, replacing the "This page is being written" placeholder. A TODO(Andrew) marker flags the prose for final approval. Code is complete and about-page.test.ts is GREEN — this checkpoint is editorial sign-off only.
  </what-built>
  <how-to-verify>
    1. Run `pnpm --filter web dev` and open http://localhost:3000/about (or review the deployed preview).
    2. Read the interim paragraphs. Confirm the voice is Jesse: dry, precise, absurdly serious, no winking, no exclamation marks, no AI self-reference, no marketing superlatives.
    3. If the wording is approved as-is: remove the `TODO(Andrew)` JSX comment in apps/web/app/about/page.tsx (one-line delete) to mark the copy final.
    4. If different wording is wanted: replace the interim paragraph text with your approved copy (same <p> classes), then remove the TODO(Andrew) comment. Do not reintroduce the "This page is being written" string and keep the <article> wrapper.
    5. Re-run `pnpm --filter web test:unit -- --run about-page` and confirm it stays GREEN.
  </how-to-verify>
  <verify>
    <automated>cd apps/web && pnpm test:unit -- --run about-page 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <acceptance_criteria>
    - Andrew has reviewed the rendered /about copy and confirmed the Jesse voice (or supplied replacement copy).
    - `grep -c "This page is being written" apps/web/app/about/page.tsx` returns 0 (placeholder still gone).
    - `pnpm --filter web test:unit -- --run about-page` exits 0 after any copy edit.
  </acceptance_criteria>
  <done>Andrew has signed off on the /about voice (or replaced the interim copy); the TODO(Andrew) marker is removed; about-page.test.ts stays GREEN.</done>
  <resume-signal>Type "approved" (interim copy stands) or paste/commit the final copy, then confirm about-page.test.ts is green.</resume-signal>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` — about-page.test.ts GREEN; all prior 234 tests GREEN.
- `pnpm --filter web build` exits 0.
- P17-05 code half (placeholder removed, structure ready) is complete after Task 1; the voice half is Andrew's non-blocking manual gate (Task 2) per 17-VALIDATION Manual-Only Verifications.
</verification>

<success_criteria>
- /about renders Jesse-voice interim copy in the <article> shell; no "This page is being written"; TODO(Andrew) marker present until Andrew approves.
- about-page.test.ts GREEN; 234 baseline + build green; Andrew sign-off recorded.
</success_criteria>

<output>
After completion, create `.planning/phases/17-ui-ux-audit-follow-ups/17-05-SUMMARY.md`
</output>
