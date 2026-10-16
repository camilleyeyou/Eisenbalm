# Phase 52: Issue — The Front Door - Context

**Gathered:** 2026-10-16
**Status:** Ready for planning
**Source:** User decisions in conversation (2026-10-14 → 2026-10-16) + approved design canvas

<domain>
## Phase Boundary

Build the editor's home page at `/` in `apps/dispatch-control`: the current issue's real title and subject, the nine stories as a table of contents with derived per-story state and plain notes, and ONE Publish button in the footer. It replaces the old stage-tabbed console (Story → Draft → Fact Check → Voice → Approval) as the editor's default landing page. Backend (pipeline, agents, Convex schema, Sanity, sign-off/publish endpoints) is unchanged — this phase composes existing reads and gates.

Trigger: the editor (non-technical) could not find where to fix a "must fix" in the old Draft stage and asked for a process "a non technical person won't find hard to run and publish".
</domain>

<decisions>
## Implementation Decisions

### Publishing (LOCKED — user chose "One Publish button")
- The footer has exactly ONE primary action: **Publish**.
- Publish is enabled only when: the run is complete/awaiting review (not running, not failed), every story's content is loaded, there are zero open must-fix findings, and zero open contradicted claims (Phase 51.1 shared predicate `convex/lib/claimGate.ts` / `claimChecks:allSignedOff` `blocking === 0`).
- One click performs, in sequence, through the EXISTING endpoints and server enforcement: record facts-cleared sign-off → record voice sign-off → publish. No parallel/new publish path, no client-side bypass of the server gate, role check unchanged (Editor-in-chief may publish; Collaborator may not — show the disabled button with a plain reason).
- If a step fails, stop, show the server's reason in plain words in the footer, and leave already-recorded sign-offs as-is (they are idempotent server state).
- Before publishing, a one-step confirm inside the page (no browser `confirm()`): "Publish Issue N now?" with Publish / Cancel. A "Preview the issue" link stays available.
- No per-claim clicks, no per-gate buttons, no checklist on this page.

### Problems on the page (LOCKED — user chose "Stories flagged in the list")
- The nine stories (lib/editableSections.ts order: Origin Story, Problem, Founder Bio, Case Study, Bonus, Game, Deliberation, Podcast, Theme) render as rows: label · actual produced headline · state.
- Row state is DERIVED from open findings / contradicted claims (reuse Phase 51 per-section derivation, e.g. lib/derivedState / the section page's counts — never re-implement, never localStorage "reviewed" marks).
- A story that needs the editor shows a plain note: "1 thing to fix →" / "N things to fix →" (count distinct problems the same way the Phase 51 section page does) linking straight to `/s/[section]` at the first problem. Clean stories show "Reads clean". While writing: "Being written…".
- No separate "needs you" list or task inbox on the page.

### Footer sentence (one plain sentence, never a checklist)
- Not ready: "1 story has something to fix: Game." (story names are links) / "N stories have something to fix: A, B." — contradicted claims count as something to fix in their story.
- Running: "Still writing — Publish turns on once every story is written and nothing needs fixing."
- Ready: "Ready to publish. Nothing left to fix. The agents checked the facts; none were contradicted."
- Failed run: honest statement + where to go (Admin → Run Details); no Publish/sign-off action offered.
- Already published: "Published <date>." with a link to the live issue; no Publish button.
- Loading: neutral skeleton; NEVER show "Reads clean"/"Ready" until findings, claims and sign-offs have loaded (HOME-09).

### Navigation & chrome
- Header: "The Eisenbalm Dispatch" wordmark, links "Past issues" (→ existing archive/issues list until Phase 54) and "Admin" (→ the existing operational console; Phase 53 will consolidate). No sidebar, no stage tabs, no operational tooling on this page.
- The old console stays reachable at its existing URLs (fallback publish path per Phase 53 SC-4) — additive first, subtractive later.
- Issue resolution the locked way: `runs.latest → pipelineRuns.byRunId → issueNumber`, never `max(issueNumber)`.

### Visual design (LOCKED — approved canvas)
- Design contract: "Dispatch Home" canvas https://claude.ai/artifact/KSPqMJof6iYHnAr9NP3SbZ — board 1 "Something needs you", board 2 "Ready to publish", board 3 "Agents still writing". The executor reproduces it from this description.
- Layout: single column, max-width 880px, page ground --color-paper (#e9eaec); stories in one white card with 1px --color-faint border, rows separated by 1px --color-nav; footer is its own white card below (2px ink border when ready). Hard edges, no rounded corners, no shadows (Uniform System Sheet rules).
- Type: issue title Newsreader (--font-display) ~52px; subject Lora 18px soft ink; row label --font-ui 13px soft ink; headline --font-display 21px; eyebrow/section labels --font-mono 11px uppercase .12em tracking.
- Colours: fix note = white text on dark vermilion (≥4.5:1 — darker than --color-vermilion, e.g. #c43a14); "Reads clean" in a darkened green (≥4.5:1, e.g. #11764a); Publish enabled = --color-cobalt bg white text; disabled = #d6d3cb bg / soft ink text.
- Touch targets ≥44px; whole row is a real `<a>`; Publish is a real `<button>`; works at ~400px width (rows wrap, footer stacks).

### Resolved after research (2026-10-16, orchestrator defaults — LOCKED)
- "Things to fix" counts BLOCKING problems only, exactly the server's gate: open `severity === 'error'` findings on any axis + open contradicted claims (`isOpenBlocking`). Warnings/advisories never count and never disable Publish. A story with only warnings reads "Reads clean" (warnings remain visible on the section page).
- Headline-less rows use fixed descriptors, never invented titles: Deliberation → "How the agents chose this charity"; Podcast → "This week's episode"; Theme → "Colours and fonts for this issue".
- Live issue link: `${NEXT_PUBLIC_WEB_PREVIEW_BASE}/issue/${slug}` (same origin as `lib/previewToken.ts`); omit the link if the slug or base is unavailable.
- A contradicted claim not attributable to any story adds to the footer sentence: "1 fact the agents found contradicted needs checking." linking to the existing Fact Check screen for the run.
- Route: delete `app/(dashboard)/page.tsx` (it is only `redirect('/run')`) and add `app/(editorial)/page.tsx` in the SAME commit (two groups owning `/` broke a Vercel build before — 1430b98f). "Admin" → `/run`, "Past issues" → `/issues`.
- Publish chain order: facts-cleared → sounds-human → publish, recording only sign-offs missing from the live map, stopping at the first failure; disabled entirely for non Editor-in-chief; mirror the DecisionRail `held` disable; "Publishing…" state until `markPublished` lands.
- Deep link: add a hash-scroll effect to `/s/[section]` so `#finding-{id}` scrolls to the mark once the draft loads.

### Claude's Discretion
- How `/` is moved from the old console's `(dashboard)/page.tsx` to the new `(editorial)` surface (route-group ownership of `/`, where the old home goes, redirects) — pick the least disruptive option and keep every old URL working.
- Exact data hooks/composition, provided they reuse existing derivations and endpoints.
- Copy for edge states not listed above, in the same plain voice.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — HOME-01…HOME-09 (HOME-04/06/07 amended 2026-10-16)
- `.planning/ROADMAP.md` — `### Phase 52` block (SC-3/SC-4 amended 2026-10-16)
- `docs/API_CONTRACTS.md` — sign-off and publish endpoint contracts (facts-cleared / voice sign-offs, publish; §51.1 claim gate)

### Reused surfaces (compose, never fork)
- `apps/dispatch-control/app/(editorial)/` — Phase 51 editorial route group (`layout.tsx`, `s/[section]/page.tsx`)
- `apps/dispatch-control/lib/editableSections.ts` — section ids/labels/order
- `apps/dispatch-control/lib/derivedState.ts` — derived per-section/run state (51.1 flagged-only semantics)
- `convex/lib/claimGate.ts`, `convex/claimChecks.ts` (`allSignedOff`) — contradicted-claim gate
- `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` — server sign-off enforcement
- Existing Approval/publish UI in `apps/dispatch-control/app/(dashboard)/` (find the current sign-off + publish client calls and role checks; reuse them)
- `.planning/phases/51-*/` and `.planning/phases/51.1-claims-carry-verdicts/` SUMMARYs — what Phase 51/51.1 built

### Prior lessons
- Run the strict build (`pnpm --filter dispatch-control build`) before declaring done — vitest does not type-check.
- Local dev cannot load drafts (pipeline CORS excludes localhost:3001) — visual verification must use the deployed Vercel URL.
- Retirement halves are deliverables: if the old home moves, verify every old entry point still resolves.
</canonical_refs>

<specifics>
## Specific Ideas
- Real blocked state from production: game story "The Filtration Layer" had a must-fix "operating in that watershed since 2009" contradicting the 1994/1995 founding date — the row reads "Game · The Filtration Layer · 1 thing to fix →" and the footer "1 story has something to fix: Game."
</specifics>

<deferred>
## Deferred Ideas
- Moving every operational surface behind one /admin door — Phase 53.
- Archive by title/subject — Phase 54.
- Removing the old console — after Phase 53 proves the new path.
</deferred>

---
*Phase: 52-issue-the-front-door*
*Context gathered: 2026-10-16 from user decisions + approved canvas*
