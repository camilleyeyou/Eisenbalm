# Phase 52: Issue — The Front Door - Research

**Researched:** 2026-10-16
**Domain:** Next.js 15 App Router page in `apps/dispatch-control` composing existing Convex reads + pipeline sign-off/publish endpoints
**Confidence:** HIGH (all findings are from reading this repo; no external libraries are introduced)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Publishing (LOCKED — user chose "One Publish button")**
- The footer has exactly ONE primary action: **Publish**.
- Publish is enabled only when: the run is complete/awaiting review (not running, not failed), every story's content is loaded, there are zero open must-fix findings, and zero open contradicted claims (Phase 51.1 shared predicate `convex/lib/claimGate.ts` / `claimChecks:allSignedOff` `blocking === 0`).
- One click performs, in sequence, through the EXISTING endpoints and server enforcement: record facts-cleared sign-off -> record voice sign-off -> publish. No parallel/new publish path, no client-side bypass of the server gate, role check unchanged (Editor-in-chief may publish; Collaborator may not — show the disabled button with a plain reason).
- If a step fails, stop, show the server's reason in plain words in the footer, and leave already-recorded sign-offs as-is (they are idempotent server state).
- Before publishing, a one-step confirm inside the page (no browser `confirm()`): "Publish Issue N now?" with Publish / Cancel. A "Preview the issue" link stays available.
- No per-claim clicks, no per-gate buttons, no checklist on this page.

**Problems on the page (LOCKED — user chose "Stories flagged in the list")**
- The nine stories (lib/editableSections.ts order: Origin Story, Problem, Founder Bio, Case Study, Bonus, Game, Deliberation, Podcast, Theme) render as rows: label · actual produced headline · state.
- Row state is DERIVED from open findings / contradicted claims (reuse Phase 51 per-section derivation, e.g. lib/derivedState / the section page's counts — never re-implement, never localStorage "reviewed" marks).
- A story that needs the editor shows a plain note: "1 thing to fix ->" / "N things to fix ->" (count distinct problems the same way the Phase 51 section page does) linking straight to `/s/[section]` at the first problem. Clean stories show "Reads clean". While writing: "Being written…".
- No separate "needs you" list or task inbox on the page.

**Footer sentence (one plain sentence, never a checklist)**
- Not ready: "1 story has something to fix: Game." (story names are links) / "N stories have something to fix: A, B." — contradicted claims count as something to fix in their story.
- Running: "Still writing — Publish turns on once every story is written and nothing needs fixing."
- Ready: "Ready to publish. Nothing left to fix. The agents checked the facts; none were contradicted."
- Failed run: honest statement + where to go (Admin -> Run Details); no Publish/sign-off action offered.
- Already published: "Published <date>." with a link to the live issue; no Publish button.
- Loading: neutral skeleton; NEVER show "Reads clean"/"Ready" until findings, claims and sign-offs have loaded (HOME-09).

**Navigation & chrome**
- Header: "The Eisenbalm Dispatch" wordmark, links "Past issues" (-> existing archive/issues list until Phase 54) and "Admin" (-> the existing operational console; Phase 53 will consolidate). No sidebar, no stage tabs, no operational tooling on this page.
- The old console stays reachable at its existing URLs (fallback publish path per Phase 53 SC-4) — additive first, subtractive later.
- Issue resolution the locked way: `runs.latest -> pipelineRuns.byRunId -> issueNumber`, never `max(issueNumber)`.

**Visual design (LOCKED — approved canvas)**
- Design contract: "Dispatch Home" canvas https://claude.ai/artifact/KSPqMJof6iYHnAr9NP3SbZ — board 1 "Something needs you", board 2 "Ready to publish", board 3 "Agents still writing".
- Layout: single column, max-width 880px, page ground --color-paper (#e9eaec); stories in one white card with 1px --color-faint border, rows separated by 1px --color-nav; footer is its own white card below (2px ink border when ready). Hard edges, no rounded corners, no shadows.
- Type: issue title Newsreader (--font-display) ~52px; subject Lora 18px soft ink; row label --font-ui 13px soft ink; headline --font-display 21px; eyebrow/section labels --font-mono 11px uppercase .12em tracking.
- Colours: fix note = white text on dark vermilion (>=4.5:1, e.g. #c43a14); "Reads clean" in darkened green (>=4.5:1, e.g. #11764a); Publish enabled = --color-cobalt bg white text; disabled = #d6d3cb bg / soft ink text.
- Touch targets >=44px; whole row is a real `<a>`; Publish is a real `<button>`; works at ~400px width (rows wrap, footer stacks).

### Claude's Discretion
- How `/` is moved from the old console's `(dashboard)/page.tsx` to the new `(editorial)` surface (route-group ownership of `/`, where the old home goes, redirects) — pick the least disruptive option and keep every old URL working.
- Exact data hooks/composition, provided they reuse existing derivations and endpoints.
- Copy for edge states not listed above, in the same plain voice.

### Deferred Ideas (OUT OF SCOPE)
- Moving every operational surface behind one /admin door — Phase 53.
- Archive by title/subject — Phase 54.
- Removing the old console — after Phase 53 proves the new path.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOME-01 | Lands on current issue's real title+subject, never invented/empty/reserved | `useCurrentRun()` (`apps/dispatch-control/lib/useCurrentRun.ts:53-125`) already does `runs.latest -> pipelineRuns.byRunId -> issueNumber` via `resolveCurrentRun` (`lib/currentRun.ts:23-40`); `title` = `pitchLog.selectedByRunId.charityName`; subject = `selectedPitch.scoutSummary` (needs the raw row — see Q2) |
| HOME-02 | Nine sections as ToC with actual headline | `EDITABLE_SECTIONS` + `DraftResponse` via `getDraft()`; per-section headline map in Q4 |
| HOME-03 | State derived from open findings, nothing to tick | `isOpenFinding`, `qaSectionToGalleyId`, `isOpenBlocking` (Q3) |
| HOME-04 | Per-row plain note, no task list | Row component; counts from the Q3 selector |
| HOME-05 | Straight into first thing needing editor | `/s/{id}#finding-{findingId}` (+ small hash-scroll addition to the section page — Q3) |
| HOME-06 | ONE Publish button; disabled -> one plain sentence naming/linking stories | Q3 selector + Q5 gate parity |
| HOME-07 | Enabled when none blocking; one click = facts sign-off + voice sign-off + publish | `recordSignOff` + `publishIssue` (Q5) |
| HOME-08 | Honest states: nothing running / running / failed | Q6 state matrix |
| HOME-09 | Never "clean" while loading | Q6 loading predicate |
</phase_requirements>

## Summary

This phase is almost entirely **composition**. Everything needed already exists: `useCurrentRun()` assembles all Convex subscriptions (run, title, findings, claims, claim summary, sign-offs, issue row); Phase 51's `/s/[section]` page already resolves the current issue and loads the draft; `recordSignOff` / `publishIssue` already wrap the two pipeline endpoints; `LockedControl` + `useRole()` already express the Editor-in-chief gate. The new work is one client page, one pure per-section selector, one sequential "publish chain" function, and a route move.

**Route ownership of `/` is trivial.** The old "console home" at `/` is only a 1-line redirect: `app/(dashboard)/page.tsx` does `redirect('/run')`. The real old home is `/run` (The Run) and is already reachable at its own URL, inside the (dashboard) shell. So the least disruptive move is: **delete `app/(dashboard)/page.tsx`, add `app/(editorial)/page.tsx`**. Both cannot exist (route groups add no URL segment — this exact collision already broke a Vercel build once, commit `1430b98f`, memory `run-strict-build-before-frontend-phase-done`). No old URL breaks; `/run` simply stops being the post-login landing page. `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/` (DEPLOY.md:47) will now land on the Issue page with zero change.

**The one real design trap is gate parity.** The server blocks Publish on a *union* the existing client helpers each only partly cover: facts sign-off blocks on open `severity==='error'` findings with a **non-voice** axis + open contradicted claims; voice sign-off blocks on open `severity==='error'` findings with a **voice** axis. `deriveRunSectionFindings` / `DecisionRail.blockers` / `RunScreen.mustFixTotal` are all factual-only, and `deriveSectionStates.openCount` counts *all severities* (warnings and infos too). Phase 52 must compute "blocking" as **open error-severity findings on ANY axis + open contradicted claims** or the chained click will 409 on the voice step (the Phase 34 client-gate-vs-server-gate drift class).

**Primary recommendation:** Build `app/(editorial)/page.tsx` as a thin client page over `useCurrentRun()` + `getDraft()` + a new pure `lib/homeSections.ts` selector (`deriveHomeSections`) that returns per-section `{headline, state, blockingCount, firstFindingId}` and a footer summary; publish via a new pure-ish `lib/publishChain.ts` that records only the *missing* sign-offs then calls `publishIssue`. Delete `(dashboard)/page.tsx` in the same plan.

## Project Constraints (from CLAUDE.md)

- Read `docs/CLAUDE_CODE_BRIEF.md` and `docs/API_CONTRACTS.md` first; do not rename schema fields without checking API_CONTRACTS.md.
- Stack locked (Next.js 14+ App Router, Sanity, FastAPI, LangGraph, Convex, Stripe) — no substitution.
- Jesse's voice rule applies to agent output, not to this UI; UI copy should still be plain/dry, no winking.
- GSD workflow enforcement: file edits happen via a GSD command (`/gsd:execute-phase`), not ad hoc.
- Conventions: `camelCase` identifiers, `kebab-case` status literals, `// ─── Name ───` ASCII section headers in large files.
- Memory-derived rules (treat as CLAUDE.md-grade): run `pnpm --filter dispatch-control build` (strict) before declaring done; Convex functions need live sync only if Convex files change (this phase should NOT change `convex/`); local dev cannot load drafts (CORS) — verify visually on Vercel.

## Standard Stack

No new dependencies. Everything is already in `apps/dispatch-control/package.json`.

| Library | Version (package.json) | Purpose | Use |
|---------|---------|---------|-----|
| next | ^15.3.9 | App Router, `redirect`, `Link` | page + routing |
| react | ^19.2.6 | client page | |
| convex | ^1.38.0 | `useQuery` subscriptions | via `useCurrentRun` |
| @clerk/nextjs | ^7.5.7 | `useAuth().getToken`, `useUser` (role) | |
| vitest ^3.2 + @testing-library/react ^16.3 + jsdom ^26 | | component tests (`__tests__/*.test.tsx` -> jsdom automatically) | |

**Do not add** a data-fetching lib, a state lib, or a modal lib. The confirm step is inline page state (CONTEXT: no browser `confirm()`; no new dialog). `components/ui/ConfirmDialog` exists (`ConfirmProvider` is mounted by the (editorial) layout) but CONTEXT asks for an in-page "Publish Issue N now?" step; render it inside the footer card.

## Architecture Patterns

### Recommended structure
```
apps/dispatch-control/
├── app/(editorial)/
│   ├── layout.tsx                  # UNCHANGED (providers only, no chrome)
│   ├── page.tsx                    # NEW  — "/" Issue page (server wrapper: `export const dynamic = 'force-dynamic'` + metadata, renders <IssueHome/>)
│   ├── _components/                # NEW
│   │   ├── IssueHome.tsx           # 'use client' data wrapper (useCurrentRun + getDraft + publish state)
│   │   ├── StoryRow.tsx            # <a> row
│   │   └── PublishFooter.tsx       # sentence + Publish button + inline confirm
│   └── s/[section]/page.tsx        # + ~8-line hash-scroll effect (Q3)
├── app/(dashboard)/page.tsx        # DELETE (redirect('/run') stub)
└── lib/
    ├── homeSections.ts             # NEW pure selector (deriveHomeSections, deriveHomeFooter)
    └── publishChain.ts             # NEW sequential sign-off -> publish
```
Mirror the `RunBody` (pure, props-only, unit-testable) / `RunScreen` (thin data wrapper) split from `app/(dashboard)/run/_components/RunScreen.tsx:363,582` — it is the established testing seam.

### Q1 — Route ownership of `/` (every reference listed)

| Fact | Evidence |
|------|----------|
| Old `/` is a redirect stub, not a console home | `app/(dashboard)/page.tsx:12-14` `redirect('/run')` (docstring: "supersedes `/desk`") |
| Real old home = The Run at `/run` | `app/(dashboard)/run/page.tsx` -> `RunScreen`; `lib/nav.ts:63` `{label:'The Run', href:'/run'}` |
| Route groups add no URL segment; two `/` pages break the build | memory `run-strict-build-before-frontend-phase-done` (Phase 27: stale `app/page.tsx` + `(dashboard)/page.tsx` -> Vercel `ENOENT page_client-reference-manifest.js`); fix commit `1430b98f` |
| Root layout supplies Clerk + Convex to BOTH groups | `app/layout.tsx:55-70` (`ClerkProvider > ConvexClientProvider`) — the new `/` page needs no extra provider |
| (dashboard) shell | `app/(dashboard)/layout.tsx`: `ConfirmProvider > CommandPaletteProvider > InspectorProvider > OnboardingProvider`, `MobileNavDrawer`, `Masthead` (52px ink chrome), `AppSidebar`, `AutoPublishBanner`, `OnboardingTour`, `h-screen overflow-hidden` |
| (editorial) shell | `app/(editorial)/layout.tsx:30-42`: `ConfirmProvider > CommandPaletteProvider > InspectorProvider` + a bare `min-h-screen` div. No masthead/sidebar/onboarding. Its docstring already says "Phases 52 (`/`) and 54 (`/archive`) drop in as siblings sharing this shell." |
| Auth identical for both | `middleware.ts:9-19` — `clerkMiddleware` protects everything except `/sign-in(.*)`; `__tests__/middleware-matcher.test.ts:39-41` already asserts `/` is NOT public. No change needed. |

**Every reference to the old home route `/`:**
1. `app/(dashboard)/page.tsx` — the redirect itself (**delete**).
2. `app/(editorial)/s/[section]/_components/SectionHeader.tsx:39` — `<Link href="/">` back-link; docstring (lines 11-15) says it "starts resolving correctly with zero code change" once `/` is the front door. **No edit needed**; today it bounces through the redirect to `/run`.
3. `app/(dashboard)/run/page.tsx:3` — docstring comment only ("root redirects here").
4. `apps/dispatch-control/DEPLOY.md:47` — `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL = /` (post-sign-in lands on `/`; becomes the Issue page — desired).
5. `__tests__/middleware-matcher.test.ts:40` — `/` protected (stays true).
6. `__tests__/Masthead.test.tsx:283-289` — the vermilion "/" *glyph* in the wordmark, unrelated.
7. No `lib/nav.ts`, `AppSidebar`, `MobileNavDrawer`, `CommandPalette`, `Masthead` link to `/` (grep clean). No test imports `DashboardIndexPage` (grep clean).

**Plan consequence:** "old home reachable" is already satisfied by `/run` (and `/issues`, `/my-tasks`, `/issues/[n]/approval`, `/review-desk/...`). The page's "Admin" link should point at **`/run`** until Phase 53 creates `/admin`; "Past issues" -> **`/issues`** (`lib/nav.ts:65` "Archive"). Add a test (or a static route-conflict assertion) that exactly one `page.tsx` resolves `/`. The retirement-half lesson applies: the *deletion* of the stub is a deliverable and must be verified by the strict build.

### Q2 — Current-issue resolution (reuse point)

- Hook: **`useCurrentRun()`** from `@/lib/useCurrentRun` (`lib/useCurrentRun.ts:53`). Returns `state` (`{kind:'loading'|'none'|'run'}`), `runId`, `issueNumber`, `title` (`undefined`=loading, `null`=no subject), `derivationInputs`, `issueStatus`, `claimSummary` (`ClaimGateSummary|undefined`), `signOffs`, `qaFindings`, `claimRows` (already `projectClaimRow`-projected), `runRow`.
- It is what `/s/[section]` uses (`app/(editorial)/s/[section]/page.tsx:208`). Pure core: `resolveCurrentRun(latest, pipelineRun)` in `lib/currentRun.ts:23` — takes no issues list, so `max(issueNumber)` is structurally impossible.
- **Subject gap:** the hook exposes only `charityName` (`title`), not `scoutSummary`. The subject line ("Lora 18px") needs `useQuery(api.pitchLog.selectedByRunId, runId ? {runId} : 'skip')` in the page (returns `{charityName, scoutSummary,...}|null|undefined`; same call `DecisionRail` makes at line ~213). It is the same subscription the hook already holds, so Convex dedupes it. Do not change the hook's public shape (many tests mock it).
- **`publishedAt` gap:** `derivationInputs.issue` is only `{held, published}`. For "Published <date>." add `useQuery(api.issues.byIssueNumber, {workspace_id: DEFAULT_WORKSPACE_ID, issueNumber})` in the page (row has `publishedAt`, `convex/schema.ts` issues table) — again a deduped subscription; or fall back to `runRow.completedAt`.
- Existing tests mock the hook as `vi.mock('@/lib/useCurrentRun', () => ({ useCurrentRun: () => mockCurrentRun }))` (`__tests__/SectionReaderPage.test.tsx:121-123`) — copy that.

### Q3 — Per-section derived state, "N things to fix", "first problem" link

**What exists (exact signatures):**
- `deriveSectionStates(i: DerivationInputs, draftSectionIds: ReadonlySet<string>): Record<string, SectionStateResult>` — `lib/derivedState.ts:298`. `SectionState = 'clean'|'review'|'must-fix'|'changed-since-review'|'not-generated'`. `openCount` = **all open QA findings in the section regardless of severity** (`'must-fix'` iff any is `severity:'error'`, else `'review'`). **QA findings only; no claims.** Used by `SectionEndNav` (`needCount = states with openCount>0`).
- `draftSectionIdsFromDraft(draft: DraftResponse): ReadonlySet<string>` — `lib/derivedState.ts:351` (presence of generated content; "absent never clean").
- `isOpenFinding(row)` — `lib/galley/findingState.ts` (`accepted !== true && resolution == null`). THE open predicate (Pitfall 9).
- `qaSectionToGalleyId(qaName): string|null` — `lib/galley/sectionIdMap.ts:28`. QA names are snake_case (`origin_story`, `problem`…); **`podcast`/`theme`/`deliberation-conversation` get no QA findings** (map returns null -> drop, never bucket).
- `isOpenBlocking(row)` / `isEditorFlagged(row)` / `summarizeClaimGate(rows)` — `convex/lib/claimGate.ts`, re-exported from `lib/derivedState.ts:419`. `isOpenBlocking = verdict==='contradicted' && status==='pending' && changedSinceCheck!==true`. `claimChecks.allSignedOff` -> `ClaimGateSummary{total,signedOff,blocking,flagged,allSignedOff}` (exposed as `useCurrentRun().claimSummary`).
- Claim rows carry `sectionName` **already in galley-id vocabulary** (`packages/pipeline/.../lib/claims.py:381-443`, `Galley.tsx:313-325`), and `projectClaimRow` (`lib/derivedState.ts:386`) keeps `sectionName`+`verdict`+`status`+`changedSinceCheck` — so `claimRows.filter(isOpenBlocking).filter(r => r.sectionName === id)` is safe. **Always use `projectClaimRow`'s output (the hook already does); a lean projection that drops `verdict` makes the client show nothing while the server blocks (51.1 Pitfall 2).**
- `deriveRunSectionFindings` (`lib/runSections.ts:75`) is **factual-axis `mustFix` + voice buckets only** — do NOT use it for the Publish gate.

**Gate-parity rule (verified against the server, `api/signoffs.py`):**

| Server gate | Predicate | 409 reason |
|---|---|---|
| facts-cleared | `allSignedOff` (blocking==0) | `claims_not_signed_off` |
| facts-cleared | open `severity=='error'`, `axis not in VOICE_AXES` (axis None => factual) | `open_error_findings` |
| sounds-human | open `severity=='error'`, `axis in VOICE_AXES` | `open_voice_findings` |

Hence **blocking findings = `isOpenFinding(row) && row.severity === 'error'` on ANY axis**, and blocking claims = `isOpenBlocking`. Warnings/infos never block the server.

**New pure selector to write — `lib/homeSections.ts` (do not fork the primitives above, compose them):**
```ts
// Source: composes lib/derivedState.ts + lib/galley/* + convex/lib/claimGate.ts (this repo)
export interface HomeSectionRow {
  id: string; label: string
  state: 'unknown' | 'writing' | 'not-written' | 'fix' | 'clean'
  blockingCount: number          // open error findings (any axis) + open contradicted claims in this section
  advisoryCount: number          // open warning/info findings (non-blocking) — see Open Question 1
  firstFindingId: string | null  // anchor target; null => link to section top
  headline: string | null
}
export function deriveHomeSections(args: {
  draft: DraftResponse | null; qaFindings: DerivationInputs['qaFindings'];
  claimRows: DerivationInputs['claimRows']; runStatus: string | undefined
}): HomeSectionRow[] | undefined   // undefined === something not loaded (HOME-09)
```
Return `undefined`/`'unknown'` for any section while `qaFindings`, `claimRows` or `draft` is `undefined`/`null` — mirror `deriveRunSections` (`lib/runSections.ts:122-216`) never-clean discipline.

**Deep link to "first problem" — what exists vs. what must be added:**
- `/s/[section]` takes only the path param (`params.section`); **no query/hash handling anywhere** in the page (grep: no `useSearchParams`/`location.hash`/`scrollIntoView` in `app/(editorial)`).
- Finding marks already carry a DOM anchor: `AnnotationMark.tsx:357` `id={`finding-${findingId}`}` and `data-finding-id`; sections carry `galley-{id}` anchors (`galleyAnchorFor`, `lib/galley/sectionIdMap.ts`). `StoryFindingsRail`'s "Jump to it" uses these.
- Because the draft loads asynchronously, the browser's native `#hash` scroll fires before the mark exists. **Required small edit to `app/(editorial)/s/[section]/page.tsx`:** after `isLoading` becomes false, an effect `useEffect(() => { const h = window.location.hash.slice(1); if (h) document.getElementById(h)?.scrollIntoView({block:'center'}) }, [isLoading])` (all hooks must stay before the early returns — the page documents this at line ~205). Link format: `/s/${id}#finding-${firstFindingId}`; fall back to `/s/${id}` when no resolvable finding id (claim-only blocker, or orphan finding) — the section page already renders `UnresolvedFindingCard` for orphans and the "Related facts" claim UI, so landing at section top is still honest. Pick `firstFindingId` = first open `error` finding in `qaFindings` order (QA emission order), else null. Claim marks have no `id` attribute (`ClaimMark.tsx` grep: none) — claim-only blockers link to section top.
- Add a test to `SectionReaderPage.test.tsx` for the hash scroll (jsdom has `scrollIntoView` undefined — stub `Element.prototype.scrollIntoView = vi.fn()`).

### Q4 — Headline per section

`getDraft(runId, token)` (`lib/contentPatchClient.ts:349`) -> `GET {NEXT_PUBLIC_PIPELINE_URL}/issues/{runId}/draft` (Bearer Clerk token) -> `DraftResponse` (`lib/contentPatchClient.ts:155`): `{revisionId, sections:Record<string,{headline?,blocks,lossy}>, theme, game, bonus, bonusType, podcast, conversation: DeliberationTurn[]}`. Page-load pattern to copy: `RunScreen.tsx:582-625` (effect keyed on `run.runId`, `getToken` excluded from deps deliberately, cancelled-flag) or `/s/[section]`'s `reloadDraft`.

| Section | Source of produced headline | Evidence |
|---|---|---|
| originStory / problemStatement / founderBio / caseStudy | `draft.sections[id].headline` | `lib/runSections.ts:175` |
| bonus | `draft.bonus.headline` (all three bonusTypes render it) | `components/galley/Galley.tsx:478,509,529` |
| game | `draft.game.headline` | `components/galley/GalleryGameSlot.tsx:33`; `GamePatchPayload.headline` |
| deliberation-conversation | **none exists** — only `draft.conversation[]` turns | `RunScreen` uses `turns[0].text` as excerpt |
| podcast | **none exists** — `draft.podcast.audioUrl`/`transcript` only | `Galley.tsx:536-543` |
| theme | **none exists** — colours + fonts only | `ThemeSwatches` in section page |

Recommendation (Open Question 2): rows with no produced headline show a short **derived descriptor, never a fabricated title** — Deliberation: `"{n} turns of agent conversation"` (n = `conversation.length`); Podcast: `"Audio ready"` / `"Transcript only"`; Theme: `"{fontDisplay} on {backgroundColor}"` fallback `"Colours and fonts"`. For long-reads with `headline` absent, fall back to the section label (same as `RunScreen` `row.headline ?? row.label`).

### Q5 — Sign-off + publish (client + server)

**Client functions (reuse, do not rewrite):**
- `recordSignOff(token: string|null, runId: string, kind: 'facts-cleared'|'sounds-human'): Promise<{runId,kind,signedAt}>` — `lib/signOffClient.ts:112`. `POST {PIPELINE}/issues/{runId}/sign-off`, JSON `{kind}`, header `Authorization: Bearer <Clerk JWT>`. Throws `SignOffApiError(status, reason, message)`; envelope-unwrap handles FastAPI `{detail:{reason,message}}` (`signOffClient.ts:62-85`; regression test `__tests__/errorEnvelope.test.ts`).
- `publishIssue(token, runId): Promise<{issueId, published:true}>` — `lib/reviewClient.ts:122`. `POST /issues/{runId}/publish`, **no body**, same Bearer. Throws `ReviewApiError(status, reason, message)`.
- Token: `const { getToken } = useAuth()` from `@clerk/nextjs`; `await getToken()` **per call** (fresh token between the three requests).
- Role (client hint): `useRole()` / `useIsEditor()` (`lib/role.ts`) — `undefined` while Clerk loads, so treat `undefined` as "unknown, disabled with neutral reason", NOT as Collaborator (avoids lock flash). Wrap Publish in `LockedControl` (`components/LockedControl.tsx`; prop `isLocked`, `lockedLabel` — existing verbatim string `"Collaborators can review and comment, not publish."` used by `DecisionRail`). `LockedControl` clones the single child button (needs `disabled`-capable `<button>`).
- Existing precedent chain: `DecisionRail.tsx:253-293` (`handlePublish`, `handleSignOff`); `DecisionRail` `publishDisabled = blockers.length>0 || !factsActive || !humanActive || !!held || busy` (line ~493). **There is no existing chained call anywhere** — `RunScreen.tsx:20-24` explicitly states `recordSignOff`/`publishIssue` live "exclusively" in `DecisionRail`. Phase 52 is the second caller; that comment/rule should be updated, and `__tests__/publishNoTypedConfirm.test.ts` (scans `DecisionRail.tsx` for `<input>`) is unaffected as long as the new footer has no input.

**Server (all in `packages/pipeline/src/eisenbalm_pipeline/api/`):**

| Endpoint | Guard | 409/4xx reasons |
|---|---|---|
| `POST /issues/{run_id}/sign-off` (`signoffs.py`, dep `_require_clerk_jwt_control` — **any signed-in user**) | run exists (404); **`sanityIssueId` present** | `no_sanity_issue` |
| …`kind=facts-cleared` (**not role-gated**) | `claimChecks:allSignedOff`; open factual error findings | `claims_not_signed_off` (count=blocking), `open_error_findings` (count) |
| …`kind=sounds-human` (**role-gated in handler**, `claims.role=='Editor-in-chief'` or `sub=='local-dev-operator'`) | role; run not failed / not Gate-1-paused; open voice error findings | 403 `forbidden_role`; `run_not_reviewable`; `open_voice_findings` |
| `POST /issues/{run_id}/publish` (`review.py:69`, dep `_require_editor` -> 403 `forbidden_role`) | **`pipelineRuns.status == 'awaiting-review'`**; both sign-offs active; `sanityIssueId` | `wrong_status`, `missing_signoffs` (+`missing[]`), `no_sanity_issue` |

- Sign-off is an **upsert by (runId, kind)** (`signOffs:record`; "upsert by (runId,kind) on the Convex side", `signoffs.py`) — re-recording is idempotent. Publish is **not** idempotent: after the Sanity flip the publisher sets `pipelineRuns.status='complete'` and `issues.published=true` (`issues:markPublished`), so a second publish 409s `wrong_status`. Treat `wrong_status` immediately after a successful first publish as success-ish; better: disable the button as soon as the chain starts and rely on `issue.published`/`runStatus` subscriptions.
- **Auto-revoke D-08:** any content mutation revokes sign-offs. Not a risk for a chain that runs within seconds, but if the editor fixes something in `/s/...` after an earlier sign-off, the active-sign-off map changes — which is why the chain must compute "what's missing" from the live `signOffs` map, not remember it.
- **Schedule vs publish-now:** `POST /issues/{id}/schedule` (`scheduleIssue`, `SchedulePublishDialog`) is a separate path with the identical gate. The locked decision is a single publish-now button; **schedule stays only on `/issues/[n]/approval`** (DecisionRail). Not carried into this page (note in plan so nobody assumes it is lost: the Phase 34 retirement lesson).
- **Held issue:** `DecisionRail` disables on `issues.held`, but the **server publish endpoint does not check held**. Mirror the client gate (disable with reason "This issue is on hold — release it from the issue page") exactly like the rail; do not invent a server dependency.

**Safe to chain client-side? Yes**, if and only if:
1. Order: `facts-cleared` -> `sounds-human` -> `publish` (publish needs both; voice step depends on nothing from facts but sequencing yields a clean "first failure" message).
2. Only record sign-offs not already in the live `signOffs` map (skip = no wasted 409s, e.g. `run_not_reviewable`).
3. Stop at first failure, show `error.message` (server text is already plain: `"{n} claim(s) contradicted by sources must be fixed or dismissed before clearing facts."`, `"Both sign-offs (Facts cleared + Sounds human) are required before publishing."`, `"This run cannot be published in its current state."`, `"Editor-in-chief only."`). Map 401/network (non-`*ApiError`) to "Couldn't reach the server — try again." Never retry automatically.
4. Never use `publish-manual` (`pipelineControlClient.ts:278`) — it is the restart path, not a publish.
5. Client enablement predicate must be a *subset-or-equal* of what the server allows (Phase 34 lesson): `runStatus==='awaiting-review' && completedAt != null && !isPausedAtGate1 && !held && blockingFindings===0 && claimSummary.blocking===0 && all nine sections present && all data loaded && role===Editor-in-chief`.

Suggested pure helper (testable with mocked clients):
```ts
// lib/publishChain.ts — Source: composes lib/signOffClient.ts + lib/reviewClient.ts (this repo)
export async function publishChain(opts: {
  getToken: () => Promise<string | null>; runId: string
  activeSignOffs: Record<string, unknown>   // from useCurrentRun().signOffs
}): Promise<{ ok: true } | { ok: false; step: 'facts-cleared'|'sounds-human'|'publish'; message: string }>
```

### Q6 — Run states + loading patterns

- Status source: `useCurrentRun().derivationInputs.runStatus` = `runs.latest.status` (mirrors `pipelineRuns.status`): `'running' | 'awaiting-review' | 'complete' | 'failed'` (`convex/schema.ts:9-14`). `runCompletedAt` distinguishes **Gate-1 pause** (`awaiting-review` && `completedAt==null` -> `isPausedAtGate1(i)`, `derivedState.ts:181`) from **final review** (`awaiting-review` with `completedAt`). `issueStatus` (`deriveIssueStatus`) gives `'unknown'|'draft'|'needs-review'|'ready'|'published'|'held'|'failed'`.
- Published: `derivationInputs.issue?.published === true` (`issues` table, set by `markPublished`). Note the window between a successful `publishIssue` and `markPublished` (publisher does PDF + deploy): show "Publishing…" locally (component state) until `issue.published` flips; don't reset the button.
- Surface kinds to implement (the `RunSurfaceKind` pattern, `RunScreen.tsx:57,634-646`): 

| Condition | Render |
|---|---|
| `state.kind==='loading'` or any gate input `undefined` | skeleton, footer neutral, no Publish |
| `state.kind==='none'` | "There is no current issue yet." (same copy as `/s/[section]`) + link to Admin |
| `runStatus==='failed'` (and not published) | honest failure + "Admin -> Run Details" link, **no Publish, no sign-off** (matches `deriveStageStates`/`deriveTasks` failed guard, quick 260718-51o) |
| `isPausedAtGate1` | "The agents are waiting for you to choose the charity." + link `issueStoryHref(n)` (`lib/issueRouteResolver.ts`); no ToC clean marks |
| `runStatus==='running'` | rows: present-in-draft -> normal row; absent -> "Being written…"; footer = Running sentence; no Publish enable |
| `issue.published` | "Published <date>." + live link; no Publish |
| else (awaiting-review, completed) | blocking>0 -> fix sentence; else Ready |

- **HOME-09 loading predicate** (the page must compute once and gate every "clean/ready" string on it), copied from `/s/[section]/page.tsx:262-267`:
  `loaded = state.kind==='run' && title!==undefined && draft!==null && derivationInputs.qaFindings!==undefined && derivationInputs.claimRows!==undefined && claimSummary!==undefined && signOffs!==undefined && derivationInputs.issue!==undefined`.
  Note `issue` is `null` when loaded-and-absent (valid) and `undefined` when loading. Draft load error -> show the error sentence (role="alert"), never "clean".
- Loading primitive: `SkeletonLine` from `@/components/ui/Skeleton` with `aria-busy="true"` (section page `LoadingSkeleton`). Use the same.
- Draft fetch while running: `getDraft` may return partial/empty sections or error — `draftSectionIdsFromDraft` already reports absent sections as not present; show "Being written…" for absent sections while `runStatus==='running'`, "Not written" otherwise (and Publish stays disabled — spec: "every story's content is loaded").

### Q7 — Test + build infra

- Framework: **vitest ^3.2** (`vitest.config.ts`): `include: ['__tests__/**/*.test.{ts,tsx}']`, `*.test.tsx` -> **jsdom** automatically (`environmentMatchGlobs` last entry); `.test.ts` that render React need an explicit jsdom entry (see `registryDoNotUse.test.ts` precedent) — **name new component tests `.test.tsx`**. `esbuild.jsx = automatic`. Setup: `__tests__/registerTsRequire.ts`. Path alias `@/` via `vite-tsconfig-paths`.
- Page-test mocking pattern (copy `__tests__/SectionReaderPage.test.tsx:36-123`): `vi.mock('convex/react', () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }))`; `vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: vi.fn(async () => 'tok') }), useUser: ... }))` (**add `useUser` if anything imports `lib/role.ts`**: `useRole` reads `useUser().user.publicMetadata.role` + `isLoaded`); `vi.mock('@convex/_generated/api', () => ({ api: { pitchLog: {selectedByRunId:'pitchLog:selectedByRunId'}, issues: {byIssueNumber:'issues:byIssueNumber'} } }))`; `vi.hoisted` for `getDraft`/`recordSignOff`/`publishIssue` fns; `vi.mock('next/navigation', ...)`; mutable `mockCurrentRun` for `@/lib/useCurrentRun`. If the page renders inside `InspectorProvider`-dependent children, wrap (51-04 deviation: `useInspector` throws without provider) — the new page should NOT use the inspector, so no wrapper needed.
- Existing tests to keep green / re-check: `SectionReaderPage.test.tsx` (hash-scroll edit), `derivedState.test.ts`, `runSections.test.ts`, `claimGateParity.test.ts`, `middleware-matcher.test.ts`, `errorEnvelope.test.ts`, `publishNoTypedConfirm.test.ts`, `nav.test.ts`.
- Strict build: **`pnpm --filter dispatch-control build`** (next build = strict tsc incl. route-conflict detection, not `__tests__`); full type coverage of tests: **`pnpm --filter dispatch-control typecheck`** (`tsc --noEmit`). Memory: vitest does not type-check; macOS can pass a build Vercel fails — trust Vercel log.
- Quick run: `pnpm --filter dispatch-control exec vitest run __tests__/IssueHome.test.tsx __tests__/homeSections.test.ts __tests__/publishChain.test.ts`. Full: `pnpm --filter dispatch-control test`.

### Q8 — Pitfalls from summaries/memory

1. **Route collision** (memory `run-strict-build-before-frontend-phase-done`): add `(editorial)/page.tsx` and delete `(dashboard)/page.tsx` in the **same** commit/plan, then run the strict build.
2. **Retirement half is a deliverable** (memory `phase34-retirement-half-done`): verify every old entry point still resolves (`/run`, `/issues`, `/issues/[n]/approval`, `/my-tasks`, `/review-desk/...`), and that the new page's enablement predicate cannot drift from the server (Q5). Add a parity test enumerating the 409 reasons.
3. **Local dev cannot load drafts** (memory `local-dev-pipeline-cors-gap`): Phase 51 closed with its entire human read-through unverified (`51-HUMAN-UAT.md`, status `human_needed`). Before planning visual verification, either set `DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001` in `packages/pipeline/.env` + `NEXT_PUBLIC_PIPELINE_URL=http://localhost:8000` (Route A) or plan verification on the deployed Vercel URL. Plan this as Wave 0/precondition, not at the checkpoint.
4. **Claim projection drift** (51.1 Pitfall 2): only consume `useCurrentRun().claimRows` (already `projectClaimRow`); never hand-slim claim docs.
5. **`useInspector` throws outside provider** (51-04): the (editorial) layout already provides one; new page doesn't need it — don't import components that do (e.g. `Galley`).
6. **Hooks before early returns** (section page convention): all hooks (`useQuery`, `useState`, `useEffect`, `useRole`) unconditionally at top.
7. **`deriveSectionStates.openCount` includes warnings**; `SectionEndNav` copy ("N of 9 sections still need you") therefore disagrees with a server-parity blocking count if warnings exist. See Open Question 1.
8. **Sign-offs auto-revoke on any content mutation** (D-08); use live `signOffs`, never a remembered local flag.
9. **Two publish clicks / double-submit**: disable on first click; publish is non-idempotent (`wrong_status` on repeat).
10. **Vercel-only failures**: `next/font` and `force-dynamic`: new page wrapper must `export const dynamic = 'force-dynamic'` like `run/page.tsx` (Convex `useQuery` needs live provider) — a `'use client'` page cannot also export `metadata`; use a server `page.tsx` rendering a client component (as `run/page.tsx` does).
11. **Collaborator can still record facts-cleared** (not role-gated server-side) but not voice/publish; the chain should be **disabled entirely** for non-editors (don't leave a half-recorded facts sign-off from a Collaborator click).

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Which issue is current | `max(issueNumber)` / own query | `useCurrentRun()` | the locked rule; bug class fixed in quick 260730-ldn |
| Open finding / open claim predicates | inline `accepted !== true`, `status==='pending'` | `isOpenFinding`, `isOpenBlocking`, `isEditorFlagged` | client/server drift caused a 9-day outage |
| QA->galley section ids | string map | `qaSectionToGalleyId` | `problem` !== `problemStatement` |
| Section presence | check findings/claims | `draftSectionIdsFromDraft` | clean sections legitimately have no rows |
| Auth/role gate UI | custom disabled+tooltip | `LockedControl` + `useRole` | a11y-safe pattern, verbatim copy |
| Sign-off / publish HTTP | new fetch | `recordSignOff`, `publishIssue` | envelope-unwrapping, typed errors |
| Skeleton | custom shimmer | `SkeletonLine` | consistent loading a11y |
| Preview URL signing | client HMAC | `GET /api/review-desk/{runId}/preview-url` -> `{previewUrl|null}` (server route, `PREVIEW_SECRET` stays server-side) | secret must not reach browser |

**Key insight:** every predicate this page needs already has a single owner; the failure mode of this phase is a *second* definition of "blocking" or "current".

## Runtime State Inventory

> Route move only; no rename of data. Included because `/` ownership changes.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified: no Convex/Sanity data keys on the `/` route | none |
| Live service config | Clerk env `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/` (Vercel project env, DEPLOY.md:47) | none — now resolves to Issue page (intended); no UI edit |
| OS-registered state | None — verified | none |
| Secrets/env vars | `NEXT_PUBLIC_PIPELINE_URL` (required at call time by all clients); `NEXT_PUBLIC_WEB_PREVIEW_BASE`/`PREVIEW_SECRET` only if a "Preview" link is built through the existing route | none new; confirm `NEXT_PUBLIC_PIPELINE_URL` set on Vercel (memory says now set to Railway prod) |
| Build artifacts | `.next` route manifest stale after deleting `(dashboard)/page.tsx` | rebuild (strict build covers) |

## Common Pitfalls

### Pitfall 1: Voice-axis blockers invisible to the footer
**What goes wrong:** page enables Publish; chain's step 2 (`sounds-human`) 409s `open_voice_findings`.
**Why:** `deriveRunSectionFindings`/`DecisionRail.blockers`/`RunScreen.mustFixTotal` are factual-only.
**Avoid:** blocking = open `severity==='error'` on any axis (+ contradicted claims). Test with a voice-axis error fixture.
**Warning signs:** footer says "Ready" but the click ends with "N voice finding(s) must be accepted or dismissed…".

### Pitfall 2: Counting warnings as "things to fix" while Publish is enabled
Disabled-reason sentence and Publish state must come from the **same** number. Never show "1 thing to fix" with an enabled button (or the reverse).

### Pitfall 3: Collaborator half-chain
Facts sign-off is not role-gated; a Collaborator click would record facts then 403 on voice. Disable for non-editors up front.

### Pitfall 4: Optimistic "Published" before `markPublished`
Between publish response and publisher completion, `issue.published` is still false and `runStatus` still `awaiting-review`. Hold a local `publishing` state; do not let the page flip back to "Ready to publish" with an enabled button.

### Pitfall 5: Hash anchor never scrolls
Native hash scroll runs before async draft render. Needs the effect in Q3.

### Pitfall 6: Unattributed contradicted claims
A claim with empty/unknown `sectionName` is counted in `claimSummary.blocking` but belongs to no row. Footer must still disable and say so ("1 contradicted claim isn't tied to a story — open Run Details"), else footer shows no named story yet Publish is off.

## Code Examples

### Chain with skip-already-signed (sketch)
```ts
// lib/publishChain.ts
import { recordSignOff, SignOffApiError, type SignOffKind } from '@/lib/signOffClient'
import { publishIssue, ReviewApiError } from '@/lib/reviewClient'

const KINDS: SignOffKind[] = ['facts-cleared', 'sounds-human']

export async function publishChain({ getToken, runId, activeSignOffs }: Opts) {
  for (const kind of KINDS) {
    if (activeSignOffs[kind] !== undefined) continue
    try { await recordSignOff(await getToken(), runId, kind) }
    catch (e) { return { ok: false, step: kind, message: plain(e) } }
  }
  try { await publishIssue(await getToken(), runId) }
  catch (e) { return { ok: false, step: 'publish', message: plain(e) } }
  return { ok: true }
}
const plain = (e: unknown) =>
  e instanceof SignOffApiError || e instanceof ReviewApiError ? e.message
  : "Couldn't reach the server. Nothing was published — try again."
```

### Row link
```tsx
<Link href={row.firstFindingId ? `/s/${row.id}#finding-${row.firstFindingId}` : `/s/${row.id}`} className="block min-h-[44px] ...">
```

## State of the Art

| Old | Current | Impact |
|---|---|---|
| Stage-tabbed console (Story->Draft->Fact Check->Voice->Approval) | Section reader `/s/[section]` + this front door | Phase 52 replaces the default landing only; old stages remain (fallback) |
| Per-claim ledger clicks | Phase 51.1: agent verdict; only open contradicted claims block | no per-claim UI on this page |
| `localStorage` "reviewed" marks | deleted in 51-03; derive only | none on this page |

## Open Questions

1. **What counts as "N things to fix" — blocking only, or all open findings?**
   - Known: server blocks only `severity==='error'` findings (any axis) + open contradicted claims. `SectionEndNav` / `deriveSectionStates.openCount` count all severities. CONTEXT says "count the way the Phase 51 section page does" AND "Publish enabled iff zero open must-fix".
   - Unclear: whether QA actually emits `warning`/`info` rows in production (not verified here).
   - **Recommendation:** drive row note, footer sentence and Publish from **blocking** (error findings + contradicted claims). Show advisory (warning/info) findings as a quieter, non-blocking suffix ("+2 suggestions") or not at all; never let them disable Publish or contradict an enabled button. Planner should confirm with the user if advisory display is wanted; defaulting to blocking-only is safe and parity-correct.
2. **Headline for Deliberation / Podcast / Theme** — no produced headline exists. Recommendation in Q4 (derived descriptor, never invented title). Confirm copy.
3. **Live issue link ("Published <date>." link)** — dashboard has no stored public URL/slug; slug format appears to be `issue-{n}` / `issue-{n}-{title}` (`lib/previewToken.ts` docs; `issueRouteResolver` comment) and `NEXT_PUBLIC_WEB_PREVIEW_BASE` is the public-web origin used only for preview. Confidence LOW on the exact public path. Recommendation: link "Preview the issue" through `GET /api/review-desk/{runId}/preview-url` (works today, returns `null` on error -> hide link), and for the published link use `${NEXT_PUBLIC_WEB_PREVIEW_BASE}/issue/issue-${n}` only after verifying an actual published slug, else link to `/issues/${n}`. Needs a one-off check against Sanity/apps-web before planning that task.
4. **Unattributed contradicted claims** (Pitfall 6) — confirm acceptable footer copy.
5. **Past-issue/Admin targets** — assumed `/issues` and `/run` (verified to exist). Phase 53 will repoint.

## Environment Availability

| Dependency | Required By | Available | Notes |
|---|---|---|---|
| pnpm workspace + node | build/test | assumed (repo scripts) | `pnpm --filter dispatch-control build/test` |
| Pipeline API reachable from browser | draft load, sign-off, publish | Vercel origin only | local localhost:3001 blocked by CORS (memory); Route A fix documented |
| Convex dev deployment `modest-magpie-797` | live subscriptions | yes (memory) | **No Convex file changes in this phase -> no `dev:once` sync needed** |

**Missing with fallback:** local browser verification -> use deployed Vercel URL or Route A CORS fix (decide in Wave 0).

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.2 + @testing-library/react ^16.3 + jsdom ^26 |
| Config file | `apps/dispatch-control/vitest.config.ts` |
| Quick run command | `pnpm --filter dispatch-control exec vitest run __tests__/IssueHome.test.tsx __tests__/homeSections.test.ts __tests__/publishChain.test.ts` |
| Full suite command | `pnpm --filter dispatch-control test` |
| Type/build gate | `pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOME-01 | `/` renders title+subject from `useCurrentRun`/`pitchLog.selectedByRunId`; `state.kind==='none'` shows no invented issue; one `page.tsx` owns `/` | component + static | `vitest run __tests__/IssueHome.test.tsx -t "title"`; strict build (route conflict) | ❌ Wave 0 |
| HOME-02 | nine rows in `EDITABLE_SECTIONS` order with produced headline / descriptor fallbacks | unit (selector) | `vitest run __tests__/homeSections.test.ts -t "headline"` | ❌ Wave 0 |
| HOME-03 | state derived: fix / clean / writing / not-written; absent => never clean; QA-null sections (podcast/theme/deliberation) not bucketed | unit | `... -t "state"` | ❌ Wave 0 |
| HOME-04 | row note "1 thing to fix ->"/"N things to fix ->"/"Reads clean"/"Being written…"; no checklist/list role elsewhere | component | `vitest run __tests__/IssueHome.test.tsx -t "note"` | ❌ Wave 0 |
| HOME-05 | row `<a href>` = `/s/{id}#finding-{firstId}`; claim-only => `/s/{id}`; section page scrolls to hash after load | unit + component | `... -t "href"`; `vitest run __tests__/SectionReaderPage.test.tsx -t "hash"` | ❌ Wave 0 (new spec in existing file) |
| HOME-06 | exactly one `<button>` Publish; sentence "1 story has something to fix: Game." with linked names; running / failed / published sentences | component | `... -t "footer"` | ❌ Wave 0 |
| HOME-07 | enablement parity (voice-axis error blocks; warnings don't; contradicted claim blocks; held blocks; Collaborator locked w/ verbatim label); chain order facts->voice->publish, skips already-signed, stops at first failure and surfaces server message; inline confirm "Publish Issue N now?" Publish/Cancel; no `window.confirm` | unit (mocks) + component | `vitest run __tests__/publishChain.test.ts`; `... IssueHome -t "publish"` | ❌ Wave 0 |
| HOME-08 | none / running / failed (no Publish, no sign-off call, Admin->Run Details pointer) / Gate-1-paused / published | component | `... -t "states"` | ❌ Wave 0 |
| HOME-09 | with each of qaFindings/claimRows/claimSummary/signOffs/issue/draft `undefined`: no "Reads clean"/"Ready to publish"/"Nothing left to fix" text, skeleton `aria-busy` present | component (table-driven) | `... -t "loading"` | ❌ Wave 0 |
| (route move) | old URLs still resolve: `/run`, `/issues`, `/issues/[n]/approval` pages exist; `(dashboard)/page.tsx` deleted | static fs test + build | `vitest run __tests__/homeRoute.test.ts`; strict build | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** quick run command above (< 30 s).
- **Per wave merge:** `pnpm --filter dispatch-control test`.
- **Phase gate:** full suite + `typecheck` + strict `build` green; then deployed-URL read-through (3 boards: Something needs you / Ready / Still writing) recorded in a HUMAN-UAT note (do not claim `passed` on jsdom alone — see 51-VERIFICATION precedent).

### Wave 0 Gaps
- [ ] `__tests__/homeSections.test.ts` — selector (HOME-02/03/05/06 sentence builder)
- [ ] `__tests__/publishChain.test.ts` — chain (HOME-07), include a 409-reason table: `claims_not_signed_off`, `open_error_findings`, `open_voice_findings`, `run_not_reviewable`, `forbidden_role`, `missing_signoffs`, `wrong_status`, `no_sanity_issue`
- [ ] `__tests__/IssueHome.test.tsx` — component (HOME-01/04/06/07/08/09); mocks per Q7
- [ ] `__tests__/homeRoute.test.ts` — fs assertion: `app/(editorial)/page.tsx` exists, `app/(dashboard)/page.tsx` does not, `app/page.tsx` does not
- [ ] new `-t "hash"` spec in `__tests__/SectionReaderPage.test.tsx`
- [ ] Decide verification environment (CORS Route A vs Vercel) before the checkpoint

## Sources

### Primary (HIGH — read directly in repo)
- `apps/dispatch-control/app/(dashboard)/page.tsx`, `layout.tsx`; `app/(editorial)/layout.tsx`, `s/[section]/page.tsx`, `_components/SectionHeader.tsx`, `SectionEndNav.tsx`; `app/layout.tsx`; `middleware.ts`; `DEPLOY.md`
- `lib/useCurrentRun.ts`, `currentRun.ts`, `derivedState.ts`, `runSections.ts`, `editableSections.ts`, `signOffClient.ts`, `reviewClient.ts`, `contentPatchClient.ts`, `role.ts`, `nav.ts`, `galley/findingState.ts`, `galley/sectionIdMap.ts`
- `components/LockedControl.tsx`, `galley/AnnotationMark.tsx`, `Galley.tsx`, `GalleryGameSlot.tsx`
- `app/(dashboard)/run/_components/RunScreen.tsx`, `review-desk/[runId]/_components/DecisionRail.tsx`, `PublishPreviewDialog.tsx`
- `convex/lib/claimGate.ts`, `convex/schema.ts`, `convex/signOffs.ts`, `convex/issues.ts`, `convex/runs.ts`
- `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py`, `review.py`, `control.py` (`_require_editor`)
- `.planning/phases/51-section-read-and-fix-in-place/51-VERIFICATION.md`, `51-04-SUMMARY.md`, `51-06-SUMMARY.md`; `.planning/ROADMAP.md` Phase 52; `.planning/REQUIREMENTS.md` HOME-01..09
- Memory: `phase34-retirement-half-done`, `run-strict-build-before-frontend-phase-done`, `local-dev-pipeline-cors-gap`

### Secondary / Tertiary
- None. Public live-issue URL shape (Open Question 3) is LOW confidence — inferred from doc comments, not verified against apps/web.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all reuse verified in source.
- Architecture / route move: HIGH — redirect stub confirmed, no other references to `/`.
- Gate parity (Q5): HIGH — read server handlers line by line.
- Headlines for podcast/theme/deliberation + live-issue URL: MEDIUM/LOW — product decisions, flagged.
- Pitfalls: HIGH — from repo memory + code.

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 (stable internal code; re-check if Phase 53 lands or `signoffs.py` changes)
