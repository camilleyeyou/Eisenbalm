---
phase: 52-issue-the-front-door
plan: 05
type: execute
wave: 5
depends_on: ["52-01", "52-02", "52-03", "52-04"]
files_modified:
  - .planning/phases/52-issue-the-front-door/52-VALIDATION.md
  - .planning/phases/52-issue-the-front-door/52-HUMAN-UAT.md
autonomous: false
requirements: [HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-07, HOME-08, HOME-09]

must_haves:
  truths:
    - "Full dispatch-control suite, typecheck and strict build are green on master"
    - "No convex/, packages/pipeline/ or schemas/ file changed in Phase 52 (backend unchanged, no Convex sync needed)"
    - "master is pushed and the Vercel deployment of dispatch-control is live"
    - "A human read-through on the deployed URL compared / against the three canvas boards and followed a fix link to the problem"
    - "No issue was published as part of verification unless the user explicitly said so"
  artifacts:
    - path: ".planning/phases/52-issue-the-front-door/52-HUMAN-UAT.md"
      provides: "Read-through record (boards checked, phone width, deep link, result)"
    - path: ".planning/phases/52-issue-the-front-door/52-VALIDATION.md"
      provides: "nyquist_compliant: true, wave_0_complete: true, per-row status"
  key_links:
    - from: "git push origin master"
      to: "Vercel dispatch-control deployment"
      via: "Git integration auto-deploy"
      pattern: "eisenbalm-dispatch-control"
---

<objective>
Close the phase: prove it with the full gate, deploy, and have a human read the real page.

Purpose: vitest does not type-check and macOS can pass a build Vercel fails (memory: run-strict-build-before-frontend-phase-done); local dev cannot load drafts (pipeline CORS excludes localhost:3001), so the visual check MUST happen on the deployed Vercel URL (Phase 51 closed `human_needed` for exactly this reason).
Output: green gate, pushed master, 52-HUMAN-UAT.md, VALIDATION.md signed off.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-issue-the-front-door/52-CONTEXT.md
@.planning/phases/52-issue-the-front-door/52-VALIDATION.md
@.planning/phases/52-issue-the-front-door/52-04-SUMMARY.md
@.planning/phases/51-section-read-and-fix-in-place/51-HUMAN-UAT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full gate + backend-unchanged check + validation sign-off</name>
  <files>.planning/phases/52-issue-the-front-door/52-VALIDATION.md, .planning/phases/52-issue-the-front-door/52-HUMAN-UAT.md</files>
  <read_first>
    - .planning/phases/52-issue-the-front-door/52-VALIDATION.md
    - .planning/phases/51-section-read-and-fix-in-place/51-HUMAN-UAT.md (format precedent)
    - apps/dispatch-control/DEPLOY.md (Vercel project / URL, env var table)
  </read_first>
  <action>
    1. Run, from the repo root, and fix any failure at its root (do not skip/weaken tests): `pnpm --filter dispatch-control test`, `pnpm --filter dispatch-control typecheck`, `pnpm --filter dispatch-control build`. If a failure is in a file no Phase 52 commit touched (`git log --oneline <first-52-01-commit>^..HEAD -- <failing test and its subject>` is empty), record it in the SUMMARY as pre-existing with that evidence instead of fixing it; anything Phase 52 touched must be fixed.
    2. Backend-unchanged check: `git diff --name-only <first-52-01-commit>^..HEAD -- convex packages/pipeline schemas` must print nothing (52-CONTEXT: backend unchanged; therefore no `pnpm --filter @eisenbalm/convex dev:once` sync is needed). If anything prints, stop and report.
    3. Grep checks over the phase's code: `grep -rn "window.confirm" "apps/dispatch-control/app/(editorial)"` -> nothing; `grep -rn "publish-manual\|publishManual" "apps/dispatch-control/app/(editorial)" apps/dispatch-control/lib/publishChain.ts apps/dispatch-control/lib/homeSections.ts` -> only the docstring warning in publishChain.ts.
    4. Update `52-VALIDATION.md`: frontmatter `status: green`, `nyquist_compliant: true`, `wave_0_complete: true`; set every row's Status to `✅ green`, confirm the per-task map still matches the test files that exist (it was corrected during planning revision); tick the Wave 0 and Sign-Off checkboxes; `**Approval:** automated gate green <date>; manual read-through pending (52-HUMAN-UAT.md)`.
    5. Create `52-HUMAN-UAT.md` (frontmatter `status: pending`, `phase: 52-issue-the-front-door`, `source: [52-05-PLAN.md]`, started/updated ISO timestamps) listing the read-through checks from Task 3 as unchecked items, each with Result: pending.
    Commit only these two .planning files plus any fix files with explicit paths: `docs(52-05): integration gate green; UAT checklist`.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test && pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - All three commands exit 0
    - `grep -n "nyquist_compliant: true" .planning/phases/52-issue-the-front-door/52-VALIDATION.md` matches
    - `test -f .planning/phases/52-issue-the-front-door/52-HUMAN-UAT.md` and it contains `status: pending`
    - The backend diff command prints nothing
  </acceptance_criteria>
  <done>Automated gate green and recorded; UAT checklist exists.</done>
</task>

<task type="auto">
  <name>Task 2: Push master and confirm the Vercel deploy</name>
  <files>none (git push only; no file edits)</files>
  <read_first>
    - apps/dispatch-control/DEPLOY.md (deployed URL `eisenbalm-dispatch-control.vercel.app`, required env vars incl. NEXT_PUBLIC_PIPELINE_URL, NEXT_PUBLIC_WEB_PREVIEW_BASE)
  </read_first>
  <action>
    Pushing master is explicitly part of this phase's plan (orchestrator instruction: final plan pushes master, which deploys Vercel). Steps: `git status --short` (confirm the unrelated dirty files listed at session start are NOT staged/committed — push only moves commits); `git log --oneline origin/master..master` and list every commit that will go out in the SUMMARY (there were 3 pre-existing unpushed docs commits before Phase 52 began — they ship too; say so). Then `git push origin master`. Never force-push. Wait for the deployment: if the `vercel` CLI is available and authenticated, `vercel ls dispatch-control` / `vercel inspect <url>` until state is READY; otherwise poll `curl -s -o /dev/null -w "%{http_code}" https://eisenbalm-dispatch-control.vercel.app/sign-in` until 200 and the deployment is newer than the push (check the Vercel dashboard link reported by GitHub checks via `gh run list` / `gh api repos/:owner/:repo/commits/master/status` if available). If the Vercel build fails, fetch the build log, fix the cause on master, re-run Task 1's gate, push again.
    Do NOT publish an issue, record a sign-off, or click Publish on the deployed site.
  </action>
  <verify>
    <automated>git fetch origin && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)" && curl -s -o /dev/null -w "%{http_code}" https://eisenbalm-dispatch-control.vercel.app/sign-in | grep -E "^(200|307|308)$"</automated>
  </verify>
  <acceptance_criteria>
    - `git rev-parse HEAD` equals `git rev-parse origin/master`
    - Vercel deployment for the pushed SHA is READY (CLI/state check) or the production URL serves the new build
    - The SUMMARY lists every pushed commit
  </acceptance_criteria>
  <done>master pushed; deployed build is live.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human read-through on the deployed URL</name>
  <files>.planning/phases/52-issue-the-front-door/52-HUMAN-UAT.md</files>
  <read_first>
    - .planning/phases/52-issue-the-front-door/52-HUMAN-UAT.md (checklist from Task 1)
    - .planning/phases/52-issue-the-front-door/52-CONTEXT.md ("Visual design", "Footer sentence")
  </read_first>
  <action>Present the steps below to the user and wait. On their reply, record each step's result in 52-HUMAN-UAT.md; set `status: passed` only on an explicit "approved", otherwise `status: partial` with each reported problem listed (board/step, what was seen). Commit 52-HUMAN-UAT.md by explicit path: `docs(52-05): record front-door read-through`. Never click Publish/confirm on the user's behalf.</action>
  <verify><automated>grep -E "^status: (passed|partial)$" .planning/phases/52-issue-the-front-door/52-HUMAN-UAT.md</automated></verify>
  <acceptance_criteria>
    - 52-HUMAN-UAT.md status is `passed` (explicit approval) or `partial` with listed issues
    - Every how-to-verify step has a recorded result
  </acceptance_criteria>
  <done>User response recorded in 52-HUMAN-UAT.md and committed.</done>
  <what-built>
    The Issue front door at `/` on https://eisenbalm-dispatch-control.vercel.app: wordmark + Past issues + Admin; current issue title and subject; nine story rows with plain notes; one Publish button in the footer with a one-sentence reason; inline confirm; deep links into `/s/[section]#finding-…`. Old console still at /run, /issues, /issues/N/approval.
  </what-built>
  <how-to-verify>
    Do NOT click the final confirm Publish unless you intend to publish this issue now.
    1. Sign in at https://eisenbalm-dispatch-control.vercel.app — you should land on `/` (not /run). The heading is the current issue's real charity name and the line under it is its subject; the eyebrow says the right issue number.
    2. Compare with the "Dispatch Home" canvas (https://claude.ai/artifact/KSPqMJof6iYHnAr9NP3SbZ): board 1 "Something needs you" if any story has a must-fix (e.g. "Game · The Filtration Layer · 1 thing to fix →" and footer "1 story has something to fix: Game."), board 2 "Ready to publish" if nothing blocks (footer card has the heavier ink border, Publish is cobalt), board 3 "Agents still writing" if a run is in progress ("Being written…" rows, Still-writing sentence). Check: single column ≤880px, grey paper ground, white cards, no rounded corners/shadows, no sidebar/tabs/checklist.
    3. Click a "N things to fix →" note (if any): the section page opens and scrolls to the highlighted problem. Use the browser Back button to return.
    4. Click a story name inside the footer sentence: it opens that story.
    5. Click Publish (only if enabled): an inline "Publish Issue N now?" appears with Publish / Cancel. Click **Cancel** (unless you want to publish now). Confirm nothing was published.
    6. Narrow the window to ~400px (or open on a phone): rows wrap, the footer stacks, buttons stay easy to tap.
    7. Open any story, then use its back link at the top of the section page: it returns to the front door at `/` (not The Run).
    8. Check "Admin" opens The Run and "Past issues" opens the issues list; /issues/N/approval still loads.
    Record each result in `.planning/phases/52-issue-the-front-door/52-HUMAN-UAT.md` (or tell Claude and it will record them).
  </how-to-verify>
  <resume-signal>Type "approved" or describe what looks wrong (which board/step and what you saw)</resume-signal>
</task>

</tasks>

<verification>
Automated gate green (Task 1), master == origin/master with a READY deploy (Task 2), human approval recorded in 52-HUMAN-UAT.md (Task 3; status `passed` only on explicit approval, else `partial` with the issues listed).
</verification>

<success_criteria>
Phase 52 is shippable: tests/typecheck/build green, backend untouched, deployed, and a person has read the real page against the canvas without publishing anything unintended.
</success_criteria>

<output>
After completion, create `.planning/phases/52-issue-the-front-door/52-05-SUMMARY.md` and update 52-HUMAN-UAT.md status from the user's response.
</output>
