---
phase: 51-section-read-and-fix-in-place
plan: 06
subsystem: testing
tags: [vitest, nextjs-build, cors, integration-gate, dispatch-control]

# Dependency graph
requires:
  - phase: 51-section-read-and-fix-in-place
    provides: "All seven prior plans (51-00 through 51-05, 51-07) — the full section-reader surface, shared primitives, route group shell, derived-state bookkeeping deletion, in-place editor/group-accept, and the finding-popover evidence card this gate verifies"
provides:
  - "Independent (not-taken-on-trust) confirmation that the full Vitest suite is green (148 files / 1245 tests passed, 0 failed, 1 skipped, 2 todo) and pnpm --filter dispatch-control build exits 0"
  - "All 10 invariant source-scans from 51-06-PLAN.md re-run and confirmed: backend/lockfile untouched, D-25 bookkeeping strings absent, no localStorage/includeAxes/lucide-react/Math.max on the editorial surface, no links into the old console, no (editorial)/page.tsx, shared galley CSS rules unchanged"
  - "51-VALIDATION.md's Per-Task Verification Map, Wave 0 checklist, and Validation Sign-Off updated to nyquist_compliant: true / wave_0_complete: true, with every row backed by a command re-run in this plan, not copied from a prior SUMMARY"
  - "A diagnosed, independently-verified, and documented local-dev CORS blocker (DASHBOARD_ALLOWED_ORIGINS has no localhost entry on the production Railway pipeline) that prevents any browser-based human read-through of /s/[section] today, plus two recorded unblock routes for a future session"
affects: [52]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/51-section-read-and-fix-in-place/51-06-SUMMARY.md
  modified:
    - .planning/phases/51-section-read-and-fix-in-place/51-VALIDATION.md

key-decisions:
  - "Human-verification checkpoint (Task 2) NOT self-approved despite workflow.auto_advance: true in .planning/config.json. The plan's own frontmatter sets autonomous: false and the orchestrator's execution notes explicitly forbade auto-approving this specific checkpoint, because it exists to produce a real human reaction after three prior UI passes were rejected. A fabricated approval would have defeated the plan's purpose."
  - "When the checkpoint could not be completed because of an environment blocker (not a code defect), the coordinator diagnosed the root cause and the user was offered two concrete unblock routes plus a skip option. The user chose to skip after the orchestrator recommended against it and the user reaffirmed. This executor independently verified the coordinator's diagnosis (pipeline CORS source read + live preflight request) before accepting it and closing the plan on that basis, rather than transcribing the claim untested."
  - "51-VALIDATION.md's status field is left at 'automated-gates-passed / human-demo-path-pending' rather than 'complete' — the automated portion is genuinely done and verified; the perceptual portion is genuinely not. Both facts are recorded plainly rather than one obscuring the other."

requirements-completed: [READ-01, READ-02, READ-03, READ-04, READ-05, READ-06, READ-07, READ-08]

# Metrics
duration: ~50min active work (spans a blocking checkpoint pause of unknown wall-clock length while the coordinator diagnosed the CORS blocker and the user made a decision)
completed: 2026-08-01
---

# Phase 51 Plan 06: Integration Gate / Strict Build Summary

**Full suite (1245/1245) and strict build independently re-verified green with zero fixes needed; the plan's human-verification checkpoint could not be run because of a pre-existing local-dev CORS gap between `apps/dispatch-control` (port 3001) and the production Railway pipeline's `DASHBOARD_ALLOWED_ORIGINS` allowlist (no `localhost` entry) — the user chose to close the phase without that read-through after being offered two unblock routes.**

## Performance

- **Task 1 commit:** `2026-08-01T07:51:46Z`
- **Plan closed:** `2026-08-01T09:11:05Z` (elapsed wall-clock includes a blocking checkpoint pause of unknown length while the coordinator diagnosed the environment blocker and relayed the user's decision — this is not active execution time)
- **Tasks:** 2 (Task 1 auto, fully executed; Task 2 checkpoint, closed unapproved per explicit user/coordinator instruction)
- **Files modified:** 2 (`51-VALIDATION.md` in Task 1's commit, plus this SUMMARY and a follow-up `51-VALIDATION.md` edit in the plan-metadata commit)

## Accomplishments

- **Independently re-ran, not quoted from any prior SUMMARY:**
  - `pnpm --filter dispatch-control test` → **148 test files passed / 1 skipped (149), 1245 tests passed / 2 todo (1247), 0 failed.** Matches plan 51-07's self-report exactly — an honest match, not an assumed one.
  - `pnpm --filter dispatch-control build` → **exit 0.** Route manifest confirms `/s/[section]` and every v4.0 console route (`/run`, `/review-desk`, `/review-desk/[runId]`, `/voice-pass`, `/voice-pass/[runId]`, `/issues/[issueNumber]/{story,draft,fact-check,voice,approval}`) present and compiled.
  - `npx vitest run __tests__/SectionReaderPage.test.tsx` → 18/18 passed, 0 skipped — the Wave 0 `existsSync` guard now resolves live.
- **All 10 invariant source-scans from `51-06-PLAN.md` run and confirmed** — every one produced its stated (empty or passing) result: backend (`packages/pipeline`, `convex`, `schemas`) and the lockfile untouched vs `origin/master`; `useReviewedSections`/`Mark reviewed`/`reviewedIds` strings absent repo-wide; no `localStorage`, `includeAxes`, `lucide-react`, or `Math.max` on the `(editorial)` surface; no links into `/run`/`/review-desk`/`/voice-pass`/`/issues/` from the editorial surface; no `(editorial)/page.tsx`; both `font-size: 16.5px` and `scroll-margin-top: 88px` still present in `globals.css`.
- **Every row of the Per-Task Verification Map re-run individually** (READ-01 through READ-08, Pitfall 2, Pitfall 3, D-17, D-25) — all green, all with real per-row test counts recorded in `51-VALIDATION.md`, replacing the ⬜ pending placeholders left by Wave 0.
- **No production code required a fix.** This integration gate found nothing wrong with the prior seven plans' work — the only file Task 1 modified was `51-VALIDATION.md` itself, updating its own status/table to reflect the now-confirmed reality.
- **Dev server started for the checkpoint** (`pnpm --filter dispatch-control dev`, port 3001) per the automation-first checkpoint protocol, then stopped once the plan closed.
- **The human-verification checkpoint (Task 2) could not be exercised — documented below rather than fabricated as a pass.**

## Task Commits

1. **Task 1: Full suite, strict build, and the invariant source-scan** - `00f9c77` (docs)
2. **Task 2: Read the surface and confirm the three things a test cannot judge** - NOT COMPLETED. No implementation commit exists for this task; see Human Verification Status below.

**Plan metadata:** (this commit — includes this SUMMARY, the follow-up `51-VALIDATION.md` edit documenting the blocker, `STATE.md`, and `ROADMAP.md`)

## Files Created/Modified

- `.planning/phases/51-section-read-and-fix-in-place/51-VALIDATION.md` - Per-Task Verification Map, Wave 0 checklist, Validation Sign-Off, and frontmatter (`nyquist_compliant: true`, `wave_0_complete: true`) updated to reflect the independently-confirmed automated results; Manual-Only Verifications table and Approval line updated to record the blocker rather than a pass
- `.planning/phases/51-section-read-and-fix-in-place/51-06-SUMMARY.md` - this file

## Decisions Made

See frontmatter `key-decisions` for full rationale on: (1) not self-approving the checkpoint despite `auto_advance: true`, (2) independently re-verifying the coordinator's CORS diagnosis before accepting it, (3) leaving `51-VALIDATION.md`'s status honest rather than flipping it to "complete".

## Human Verification Status: NOT PERFORMED

**The plan's blocking `checkpoint:human-verify` task (Task 2) was never exercised in a browser.** This is recorded as a blocker, not a pass, and not silently skipped.

### Root cause (independently verified, not taken on the coordinator's word alone)

1. **Source confirmed:** `packages/pipeline/src/eisenbalm_pipeline/api/main.py` gates CORS on `DASHBOARD_ALLOWED_ORIGINS` (comma-separated env var), defaulting to `["http://localhost:3000"]` only when unset.
2. **Port confirmed:** `apps/dispatch-control/package.json` runs its dev server on port **3001** by design (`"dev": "next dev --port 3001"`) — never 3000.
3. **Target confirmed:** `apps/dispatch-control/.env.local` sets `NEXT_PUBLIC_PIPELINE_URL=https://eisenbalm-pipeline-production.up.railway.app` — the dashboard talks to the live production pipeline, not a local one, in this environment.
4. **Live preflight run by this executor (not copied from the coordinator's report):**
   ```
   curl -s -D - -o /dev/null -X OPTIONS \
     "https://eisenbalm-pipeline-production.up.railway.app/runs/" \
     -H "Origin: http://localhost:3001" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: authorization"
   ```
   Response for `Origin: http://localhost:3001`: `HTTP/2 400`, headers include `access-control-allow-credentials`, `access-control-allow-headers`, `access-control-allow-methods` — but **no `access-control-allow-origin` header at all.** Repeated with `Origin: http://localhost:3000`: identical result, **no `access-control-allow-origin` header.**
5. **Conclusion:** Railway's live `DASHBOARD_ALLOWED_ORIGINS` allowlist (set as a Railway env var, overriding the source default) contains only the production Vercel domain(s) — no `localhost` entry of any port. Every `/issues/{runId}/draft` (and other pipeline-backed) fetch from `apps/dispatch-control`'s local dev server fails silently at the CORS layer. No draft prose can render in a local browser today.
6. **Scope confirmed clean:** `git log --name-only` across all eight Phase 51 plans' commits, scoped to `packages/pipeline`, `convex`, `schemas`, returns empty. The backend is untouched, as the milestone requires — **this is a pre-existing local-dev environment gap, not a Phase 51 defect,** and it would have blocked a browser read-through of any phase's dashboard work, not just this one.

### All 8 checkpoint items from `51-06-PLAN.md` Task 2 — unverified by a human

1. `/s/originStory` reading measure (~760px), Lora body, no sidebar/masthead/tabs/stage-nav/form field, non-sticky header — **NOT verified**
2. Fact/Voice/Source label readable beside each marked span without opening it, distinguishable in greyscale — **NOT verified**
3. Chrome DevTools inspection of the popover's rendered DOM tree for `<p>` auto-close/reparent — **NOT verified**
4. Accept a suggestion, edit a passage and save, dismiss a finding with a required reason, without leaving the paragraph — **NOT verified**
5. Prev/next at the first and last sections, each naming its destination, never a bare "Previous"/"Next" — **NOT verified**
6. `/s/game`, `/s/podcast`, `/s/theme`, `/s/deliberation-conversation` state plainly what they are and carry no inline findings — **NOT verified**
7. `/run`, `/review-desk/{runId}`, `/voice-pass/{runId}` still work; Review Desk shows a clean-based progress header/badge with no "Mark reviewed" button and a "Next that needs you" footer — **NOT verified**
8. The `ClaimProvenanceCard` shared-card question below — **undecided**

### The three Manual-Only Verifications already named in `51-VALIDATION.md` — carried forward, unverified

- ~760px reading measure / Lora 16.5px/1.7, no side rails (READ-01 SC-1) — **NOT PERFORMED**
- Label-not-colour-alone distinguishability, verified in greyscale (READ-02 SC-2) — **NOT PERFORMED**
- DOM validity of the popover — no block-in-phrasing content (READ-03 / Pitfall 1) — **NOT PERFORMED**

### ClaimProvenanceCard shared-card question — undecided

Plan 51-07 extended the ONE shared `ClaimProvenanceCard` component (rendered by Review Desk's Stage 3 Fact Check and Stage 5 Approval, Voice Pass, `ClaimMark`, and this plan's new finding popover) so its Source field now also shows the raw `sourceUrl` as visible text, where previously it showed only a derived publisher name (the URL existed only as an invisible `href`). No existing test broke and the build stayed clean, so this shipped silently as an additive change. **Nobody has judged whether a raw URL where a publisher name used to be is acceptable on the v4.0 surfaces (Review Desk, Voice Pass, Fact Check) that also render this card.** This question remains open pending a future browser read-through.

### Recorded user decision

Per the coordinator's relayed message: the user was offered three routes — (a) run the pipeline locally with a matching `DASHBOARD_ALLOWED_ORIGINS`, (b) add `http://localhost:3001` to the Railway service's allowlist, or (c) skip the human read-through and close the plan on automated verification alone. The orchestrator recommended against skipping. The user reaffirmed the choice to skip. This executor proceeded on that explicit basis, after independently confirming the technical diagnosis was accurate (see above) rather than accepting the recommendation to skip on trust.

### Open follow-ups to unblock a future human read-through

1. **Local pipeline route:** add `DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001` to `packages/pipeline/.env` (no such file exists today — would need to be created from `packages/pipeline/.env.example`), run `pnpm --filter pipeline dev`, and point `apps/dispatch-control/.env.local`'s `NEXT_PUBLIC_PIPELINE_URL` at `http://localhost:8000` for the session.
2. **Railway allowlist route:** append `http://localhost:3001` to the `DASHBOARD_ALLOWED_ORIGINS` environment variable on the Railway pipeline service (dashboard or `railway variables set`), then a browser at `http://localhost:3001` can talk to production directly.

Either route is sufficient to unblock a future `/s/[section]` read-through; neither has been executed as part of this plan.

## Deviations from Plan

**None from an engineering standpoint** — Task 1 executed exactly as written, and no auto-fix (Rules 1-3) or architectural question (Rule 4) arose; the integration gate found the prior seven plans' work already correct.

**Task 2 (the checkpoint) deviates from its written form** only in that it could not be completed as a pass/fail human judgment — it was closed as **not performed, blocked, with the blocker and two unblock routes recorded** per explicit instruction from the coordinator relaying the user's decision. This is not a Rule 1-4 deviation (no code was changed to work around it); it is an honestly-recorded incomplete verification.

## Issues Encountered

- Local dev server (`pnpm --filter dispatch-control dev`, port 3001) started successfully and served Clerk-protected routes correctly (401/redirect behavior confirmed sane for a signed-out `curl` request) — the server itself was never the problem. The blocker is entirely at the pipeline's CORS layer for any localhost origin, not in this app's build or runtime.

## User Setup Required

**Yes — see "Open follow-ups" above.** Either the local-pipeline route or the Railway-allowlist route must be completed before `/s/[section]` (or any dispatch-control page that calls the pipeline) can be read-through in a local browser. Neither is optional busywork: this same CORS gap will block verification of any future phase's dashboard-facing work until resolved.

## Next Phase Readiness

- All engineering work in Phase 51 (plans 51-00 through 51-07) is automated-gate-clean: full suite green, strict build green, every invariant scan and Per-Task Verification Map row green, independently re-confirmed by this gate.
- **Phase 51 is closing without the human perceptual sign-off its own plan required.** Three Manual-Only Verifications (reading measure, label-not-colour-alone, popover DOM validity) and the `ClaimProvenanceCard` shared-card URL-display question are open, unverified, and must be revisited — most naturally as the first item of whichever phase (52+) next touches `/s/[section]` or the shared galley/provenance components, once one of the two CORS unblock routes above is completed.
- `51-VALIDATION.md` reflects this honestly: `status: automated-gates-passed / human-demo-path-pending`, not `complete`.
- No blockers to Phase 52 starting — the CORS gap is a local-dev-verification concern, not a shipped-code defect, and does not affect production (Vercel's origin is already allowlisted on Railway).

---
*Phase: 51-section-read-and-fix-in-place*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: .planning/phases/51-section-read-and-fix-in-place/51-VALIDATION.md
- FOUND: .planning/phases/51-section-read-and-fix-in-place/51-06-SUMMARY.md
- FOUND commit: 00f9c77 (Task 1)
