---
phase: 51-section-read-and-fix-in-place
plan: 06
type: execute
wave: 5
depends_on: ["51-03", "51-05"]
files_modified:
  - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx
autonomous: false
requirements: [READ-01, READ-02, READ-03, READ-04, READ-05, READ-06, READ-07, READ-08]

must_haves:
  truths:
    - "The full Vitest suite is green — no Review Desk or Voice Pass regression"
    - "pnpm --filter dispatch-control build is green — the class of break Vitest cannot catch is provably absent"
    - "No manual-mark bookkeeping and no backend change shipped with this phase"
    - "The v4.0 console still resolves at /run, /issues/[n], /review-desk and /voice-pass"
  artifacts:
    - path: "apps/dispatch-control/__tests__/SectionReaderPage.test.tsx"
      provides: "the phase's live requirement coverage, no longer skip-guarded"
      contains: "describe"
  key_links:
    - from: "apps/dispatch-control"
      to: "next build"
      via: "strict TypeScript gate, mandatory per project rule"
      pattern: "pnpm --filter dispatch-control build"
---

<objective>
Close the phase: prove nothing regressed, prove the strict build passes, and prove the three "must not have happened" invariants actually did not happen.

Purpose: this app's own recorded lesson is that Vitest does not type-check and a prior phase shipped two latent bugs that only failed on Vercel/Linux because `pnpm --filter dispatch-control build` was skipped. That gate is non-negotiable here — it is also the only thing that catches the D-25 missing-required-prop class of break (Pitfall 4).

Output: a green full suite, a green strict build, a verified-invariants report, and a human confirmation of the three things a test cannot judge.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/51-section-read-and-fix-in-place/51-VALIDATION.md
@.planning/phases/51-section-read-and-fix-in-place/51-CONTEXT.md
@.planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full suite, strict build, and the invariant source-scan</name>
  <files>apps/dispatch-control/__tests__/SectionReaderPage.test.tsx</files>
  <read_first>
    - .planning/phases/51-section-read-and-fix-in-place/51-VALIDATION.md (the Per-Task Verification Map — every row must now be ✅)
    - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx (confirm the `existsSync` guard now resolves true and every describe is LIVE, not skipped)
    - apps/dispatch-control/package.json (confirm `test` and `build` scripts; `test` maps to `vitest run` with no `tsc` step — that is why the build gate exists)
  </read_first>
  <action>
Run, in this order, and fix anything red before proceeding:

1. `pnpm --filter dispatch-control test` — the full Vitest suite. Must be green. This confirms no Review Desk / Voice Pass regression (D-24) and includes the `edge-runtime` Convex-test files unrelated to this phase.
2. `pnpm --filter dispatch-control build` — **MANDATORY, non-negotiable.** This is the only gate that catches a missing/dangling required prop after the D-25 deletion (Pitfall 4) and any mis-spelled new prop name in the galley threading. If it fails, fix the source, never the gate.

Then run this invariant source-scan and record the output in the summary. Every one of these must produce the stated result:

- `git diff --stat origin/master -- packages/pipeline convex schemas` → **empty**. The backend is untouched this milestone; zero schema changes, zero pipeline changes, zero Sanity schema changes.
- `git diff --name-only origin/master -- apps/dispatch-control/package.json pnpm-lock.yaml package-lock.json` → **empty**. No new npm dependency was needed.
- `grep -rn "useReviewedSections\|reviewDesk:reviewed\|Mark reviewed\|onToggleReviewed\|reviewedIds" apps/dispatch-control --include=*.ts --include=*.tsx` → **no matches**. D-25's bookkeeping layer is gone.
- `grep -rn "localStorage" "apps/dispatch-control/app/(editorial)/"` → **no matches**. No bookkeeping on the new surface.
- `grep -rn "includeAxes" "apps/dispatch-control/app/(editorial)/"` → **no matches**. D-06: all axes render together on this surface.
- `grep -rn "lucide-react" "apps/dispatch-control/app/(editorial)/" apps/dispatch-control/components/galley/` → **no matches**. Zero new icons in the galley/annotation surfaces.
- `grep -rn "max(issueNumber)\|Math.max" "apps/dispatch-control/app/(editorial)/"` → **no matches**. D-02: the current run resolves via `runs.latest → pipelineRuns.byRunId → issueNumber` only.
- `grep -rn "/run\"\|/review-desk\|/voice-pass\|/issues/" "apps/dispatch-control/app/(editorial)/"` → **no matches**. DOOR-03: the editorial surface never links into operational tooling or the old console.
- `test ! -f "apps/dispatch-control/app/(editorial)/page.tsx"` → **succeeds**. Phase 51 does not claim `/` in the new group; that is Phase 52's conflict.
- `grep -c "font-size: 16.5px" apps/dispatch-control/app/globals.css` → **at least 1**, and `grep -c "scroll-margin-top: 88px" apps/dispatch-control/app/globals.css` → **at least 1**. The shared galley rules Review Desk and Voice Pass depend on are unchanged.

Also confirm every row of `51-VALIDATION.md`'s Per-Task Verification Map now has a real, passing command, and update its status column and the `nyquist_compliant`/`wave_0_complete` frontmatter flags to reflect reality.

Do not weaken, skip or `--filter` past any failing assertion to reach green. If something genuinely cannot pass, stop and report it rather than editing the test to match the code.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test` exits 0
    - `pnpm --filter dispatch-control build` exits 0
    - `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx` reports 0 skipped tests (the `existsSync` guard now resolves true)
    - `grep -rn "useReviewedSections\|reviewDesk:reviewed\|Mark reviewed" apps/dispatch-control --include=*.ts --include=*.tsx` returns NO matches
    - `grep -rn "includeAxes\|lucide-react\|localStorage\|Math.max" "apps/dispatch-control/app/(editorial)/"` returns NO matches
    - `test ! -f "apps/dispatch-control/app/(editorial)/page.tsx"` succeeds
    - `git status --porcelain packages/pipeline convex schemas` returns NO lines
    - `git status --porcelain apps/dispatch-control/package.json pnpm-lock.yaml` returns NO lines
    - `.planning/phases/51-section-read-and-fix-in-place/51-VALIDATION.md` has `nyquist_compliant: true` and no ⬜ pending rows remaining
  </acceptance_criteria>
  <done>Full suite green, strict build green, every invariant scan produces its stated result, and 51-VALIDATION.md reflects the real state.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Read the surface and confirm the three things a test cannot judge</name>
  <what-built>
`/s/[section]` — a full-width reading surface for one section of the current issue, with fact, voice and unsourced-claim problems marked in the sentence they affect, each openable in place with the agent's reasoning and evidence, acceptable in one action (including where the same correction recurs), editable by hand, and dismissible with a reason. Prev/next at the end of the prose, plus one sentence counting the sections that still need you. The Review Desk's manual "mark reviewed" bookkeeping is deleted and its progress, badges and footer nav now derive from open findings.
  </what-built>
  <how-to-verify>
1. Start the dev server: `pnpm --filter dispatch-control dev`.
2. Open `/s/originStory`. Confirm: the reading column measures roughly 760px, the body is Lora and noticeably larger than the Review Desk's galley, and there is NO sidebar, NO masthead, NO tab strip, NO stage nav and NO form field above the prose. The header scrolls away — it is not sticky. Ask the phrase the whole phase was tested against: does this read as **a page to read, not a workspace to navigate**?
3. Find a section carrying fact, voice and source problems together (or check them across two sections). Confirm each marked span carries a readable word — Fact, Voice or Source — beside it, WITHOUT opening anything. Then view the page in greyscale (macOS: System Settings → Accessibility → Display → Color Filters → Grayscale) and confirm you can still tell the three kinds apart. Colour must never be the only signal.
4. Open a marked claim in Chrome DevTools with the popover showing. Inspect the rendered tree and confirm the browser has NOT auto-closed or reparented a `<p>` around the popover contents. jsdom does not validate HTML content models, so the Vitest structural assertion is only a proxy — this is the real check (51-VALIDATION Manual-Only row 3).
5. Accept a suggestion; edit a passage yourself and save it; dismiss a finding (confirm the one-line reason is still required). Confirm none of the three took you off the paragraph.
6. Click through prev/next to the first and last sections. Confirm the first shows only a next control, the last only a previous, each naming its destination — never a bare "Previous"/"Next", never a greyed placeholder.
7. Open `/s/game`, `/s/podcast`, `/s/theme` and `/s/deliberation-conversation`. Confirm each states plainly what it is and that it carries no inline findings — none of them should look empty or broken.
8. Open the v4.0 console at `/run`, `/review-desk/{runId}` and `/voice-pass/{runId}`. Confirm they still work, that the Review Desk shows a clean-based progress header and badge with NO "Mark reviewed" button anywhere, and that its footer offers "Next that needs you".
  </how-to-verify>
  <action>Pause here. The steps above are the human verification; nothing is automated in this task. Do not proceed past this checkpoint without an explicit approval from the user. If any step reads wrong, record it verbatim in the summary and stop — do not "fix" a design judgement without a new decision.</action>
  <read_first>
    - .planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md (the visual and copy contract being confirmed against)
    - .planning/phases/51-section-read-and-fix-in-place/51-VALIDATION.md § Manual-Only Verifications (the three checks that cannot be automated and why)
  </read_first>
  <acceptance_criteria>
    - The user has replied "approved" or has listed specific issues
    - The reply is recorded verbatim in 51-06-SUMMARY.md
  </acceptance_criteria>
  <resume-signal>Type "approved" or describe what reads wrong.</resume-signal>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test` exits 0
- `pnpm --filter dispatch-control build` exits 0
- Human confirmation recorded for the reading measure, the greyscale label check, and the popover DOM-validity check
</verification>

<success_criteria>
- Every one of READ-01 … READ-08 has a passing automated command or a recorded human confirmation.
- The strict Next.js build is green — the documented project rule is satisfied, not skipped.
- The backend, the lockfile and every v4.0 route are provably untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/51-section-read-and-fix-in-place/51-06-SUMMARY.md`
</output>
