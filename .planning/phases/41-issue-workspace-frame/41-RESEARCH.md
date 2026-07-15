# Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval - Research

**Researched:** 2026-07-14
**Domain:** Next.js App Router shared-layout recomposition over already-shipped Convex-backed React screens (no new external libraries, no new backend nodes)
**Confidence:** HIGH — every claim below is verified by reading the actual files in this repo, not inferred from framework docs. There is no third-party-library research needed for this phase; the "unknowns" are entirely about the shape of existing first-party code.

## Summary

Phase 41 is a pure recomposition phase: one net-new shared layout (`issues/[issueNumber]/layout.tsx`), five stage route segments, and a handful of surgical extractions/prop additions to already-shipped components. There is no new npm dependency, no new Convex table beyond what Phase 40 already declared (`issues.lastVisitedStage` exists in `convex/schema.ts` but **no mutation writes it yet** — that mutation is net-new work this phase must add), and no new pipeline node.

The three "watch items" that make this more than a trivial restyle are: (1) the decision rail must be **physically moved** out of `ReviewDeskRunView`'s render tree into a new Stage-5 route — it is currently rendered conditionally inside review-desk's `viewMode === 'galley'` branch; (2) Signal Desk has **zero** issue-keyed plumbing today (it reads `runs.latest` directly) and needs the exact same `issueNumber → runId` resolver pattern Phase 40 already built twice (review, voice) — copy it a third time, don't invent a new pattern; (3) the "publish drops typed confirmation" decision is describing a change **relative to the original design prototype**, not relative to this codebase — the actual `DecisionRail.tsx` `handlePublish()` today has **zero** confirmation step of any kind (no `window.confirm`, no typed input, one click straight to the API call). So WSP-06 is net-new UI work (build an exact-preview step), not a removal.

**Primary recommendation:** Build the frame as a `'use client'` layout that owns Convex subscriptions for `issue`/`run`/`signOffs`/`claimRows`/`qaFindings`/`pitchRows` exactly the way `issues/[issueNumber]/page.tsx` already does (copy that query block verbatim into the layout, then make `page.tsx` a server-side redirect), pass the derived `stages`/`tasks`/`status` down via a small React context (or prop-drill through a client-side sub-tree) so all 5 stage pages and the outline/panel can consume one set of Convex reads instead of five duplicated subscription sets, and mount each stage's existing screen component with only the wrapper chrome stripped.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: The frame is a shared layout** at `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` (net-new). It renders the stage tabs, the persistent issue outline, the collapsible context panel, and the persistent controls, and wraps each stage as a **nested child route** so the frame stays mounted across tab switches and every stage is deep-linkable (Phase 40 D-06: stages are path segments, not query params). Precedent for a layout-based tab bar: `app/(dashboard)/run-monitor/layout.tsx` (active tab via `usePathname`).
- **D-02: Stage tabs reuse `issues/_components/StageStrip.tsx`** for the visual + `lib/derivedState.ts` for the live status marks. `STAGE_LABELS = ['Story','Draft','Fact Check','Voice','Approval']`, `DerivedTask.stage: 1|2|3|4|5`, `deriveStageStates` → 5 `StageStateResult`s. **Consume it; do not re-derive.** Tab mark = the stage state's `Not generated / In progress / Needs you / Clean` + open-item count (Phase 40 D-20), rendered label + icon, never color alone.
- **D-03: Bare `/issues/[n]` redirects into the Workspace at the last-visited stage.** The Phase 40 overview `page.tsx` (which today owns status header, StageStrip, task count, links, run history, Hold/Reopen) becomes a redirect to `lastVisitedStage` (from the `issues` table, Phase 40 D-01) or a default (D-04). The overview's persistent concerns — status, Hold/Reopen, run history link, Decision log, Ask an agent, save state — move into the frame's **persistent controls**, so no capability is lost.
- **D-04: Default landing stage when `lastVisitedStage` is unset** = the earliest stage with real work: Stage 1 if no charity is chosen yet, otherwise Stage 2 (Draft). Deterministic from the same stage states the tabs read.
- **D-05: Stage segments are `story` (1), `draft` (2), `fact-check` (3), `voice` (4), `approval` (5).** New route dirs: `issues/[issueNumber]/{story,draft,fact-check,voice,approval}/page.tsx`.
- **D-06: Rename Phase 40's `/issues/[n]/review` → `/draft`; keep `/voice`; add `/story`, `/fact-check`, `/approval`.** A 301/redirect from `/review` → `/draft` covers any live link. Update `lib/issueRouteResolver.ts` helpers (`issueReviewHref` → `issueDraftHref`, add stage hrefs). The old top-level `/review-desk`, `/voice-pass`, `/signal-desk` redirects from Phase 40 stay as-is.
- **D-07: Mount each shipped screen's inner content into the frame's canvas slot; strip only its standalone page chrome.** Internals are **untouched** (Phase 40 D-07; milestone "DO NOT REBUILD"). Screens already receive a `runId` resolved from `issueNumber` by the Phase 40 route wrappers.
  - **Stage 2 (Draft)** mounts the galley portion of `ReviewDeskRunView.tsx` (`Galley.tsx` + section-chip nav + edit mode) **minus its `DecisionRail`**, which moves to Stage 5 (D-13).
  - **Stage 4 (Voice)** mounts the named `VoicePassScreen` export from `VoicePassRunView.tsx` + `VoicePassRail.tsx`.
  - **Stage 5 (Approval)** mounts `DecisionRail.tsx` + `SourceIndex.tsx` (D-13/D-14).
  - **Stage 1 (Story)** mounts `signal-desk/_components/SignalDeskScreen.tsx` (D-11).
- **D-08: Where a run-keyed view must be mounted issue-keyed, extract the mountable inner component rather than duplicate the page.** Exact extraction boundary is Claude's discretion during planning.
- **D-09: Signal Desk needs net-new issue-keying — it is the odd one out.** `SignalDeskScreen` is still keyed to "latest run for workspace" via `runs.latest` and has **no issue-keyed wrapper and no nav entry**. Phase 41 adds `issues/[issueNumber]/story/page.tsx` that resolves `issueNumber → runId` and mounts `SignalDeskScreen` scoped to that run — **without rebuilding it**.
- **D-10: Stage 1 gets the uniform frame treatment** — a stage tab with a live status mark and an outline presence. The Gate 1 adjudication write path (`adjudicateGate1` via `lib/pipelineControlClient.ts`) is mounted as-is.
- **D-11: Stage 3 is a first-class placeholder, never a blank (WSP-07 discipline).** Phase 41's Stage-3 tab renders a labeled "Fact Check — arrives next / here's what's checked so far" surface that **composes the existing read-only `claim_checks` coverage** (via `convex/claimChecks.ts` `listByRunId` / `allSignedOff`) rather than mounting a page. It must not show a fake "verified" state. Phase 42 replaces this surface with the real stage.
- **D-12: The publish gate's "Fact Check complete" term maps to the existing `facts-cleared` sign-off for this phase.** `ready = factDone && voiceDone && !held`. Phase 42 tightens "Fact Check complete" to real claim coverage; Phase 41 reuses the shipped gate unchanged. Unchecked-claim clicks in the Stage-2 galley (WSP-04) route to the Stage-3 tab.
- **D-13: The decision rail moves from the galley to Stage 5.** `DecisionRail.tsx` (today rendered inside the Review Desk galley) is the home of the two sign-offs + the publish button; in the Workspace it **is** the Approval stage. Stage 2 (Draft) no longer renders the rail; Stage 5 renders it. Rail internals are reused unchanged.
- **D-14: Stage 5 layout is blockers-first (WSP-05):** (1) Must fix / Review recommended / estimated review time with jump links, then (2) the readiness board (fact check, voice, hook + peg, organization verification, open decisions), then (3) the **agent editor's recommendation** — explicitly labeled as agent judgment. Reuse the rail's existing blockers-first ordering; add the readiness board and the recommendation block if not already present.
- **D-15: Publish drops typed confirmation; the two-sign-off gate is the safety.** Replace typed confirmation with an **exact preview** (destination, title, time, consequences) + **one confirmation click**. The unlock condition is written next to the disabled control. Do NOT touch typed confirmation elsewhere (it survives for Mark Do-not-use). Publish endpoint change goes through the existing write boundary; **amend `docs/API_CONTRACTS.md` first if the publish contract changes**.
- **D-16: "editor" unqualified stays reserved for the human (SC-4, in scope this phase).** The agent's recommendation is labeled "Agent editor's recommendation."
- **D-17: Sign-off revocation stays exactly as Phase 34 built it.** No change to revocation here.
- **D-18: The outline is section-level, persistent across all stages, derived from the Phase 40 stage/section state selector.** State vocabulary per section: **clean / review / must fix / changed since review / not generated**. Section identity reuses `lib/galley/sectionIdMap.ts` (`qaSectionToGalleyId`) and `SectionChipList.tsx`'s `EDITABLE_SECTIONS`. Clicking a section jumps to it in the canvas (in Stage 2 Draft; from other stages, switch to Draft and scroll to the section).
- **D-19: One shared collapsible panel shell** with a persistent "Hide panel" control; content is injected per stage. Reuse the existing provenance/finding surfaces (`SourceIndex`, `ResolvedFindingsList`, `AnnotationMark` popovers). No shared collapsible primitive exists — build the shell once in the frame. Hidden-state persistence mechanism is Claude's discretion.
- **D-20: Reuse the shipped provenance rendering; add keyboard-focus parity and the Fact-Check click-through.** Phase 41 **ensures the source popover is reachable on keyboard focus as well as hover** and wires unchecked-claim click → the Stage-3 tab (D-12). If focus parity is missing, add it; do not rebuild the mark components.
- **D-21: A dedicated "Not generated" state in both canvas and outline**, driven by section-artifact absence. Canvas renders an Editor's-note-style block (not a blank); the outline renders the "— not generated" marker. Reuse `components/_PlaceholderScreen.tsx` styling conventions where useful.
- **D-22: Add a single "Issue Workspace" item to the Editorial nav group** in `lib/nav.ts`, linking to the in-progress issue's workspace (`/issues/[n]`) or `/issues` if none. Rendered by the existing `components/AppSidebar.tsx` — no chrome rework.

### Claude's Discretion

- Exact extraction boundary when splitting run-keyed views (`ReviewDeskRunView`, `VoicePassRunView`) into frame-mountable inner components (D-08).
- Context-panel hidden-state persistence mechanism (D-19).
- Whether the Stage-3 placeholder shows read-only `claim_checks` coverage or a plainer "not yet available" note, provided it is never a blank/fake-verified state (D-11).
- Redirect mechanism for `/review` → `/draft` (route-level vs `next.config` rewrite) (D-06).
- Precise copy for the Stage-3 placeholder, the publish exact-preview, and the "Not generated" Editor's note.
- Whether the Draft passage toolbar shows disabled/stubbed "Inspect how this was made" + "Ask agent to revise" entry points (Phases 44/45) or omits them entirely for now.

### Deferred Ideas (OUT OF SCOPE)

- **Stage 3 Fact Check (the real stage)** — Phase 42 (this phase ships only the first-class placeholder).
- **My Tasks screen** — Phase 43 (the derived projection already exists, Phase 40 D-21; Phase 41 renders `.length`-style marks, not the screen).
- **"Inspect how this was made" panel + "Ask agent to revise" / "Ask agent for better evidence"** — Phases 44/45.
- **Full Story & Brief redesign** — Phase 47 (replaces the provisional Signal Desk Stage 1 mounted here).
- **Role/permission gating of the six actions (locked-control rendering)** — Phase 49 (Phase 41 builds the actions for the editor; structure them so 49 can wrap them).
- **Console-wide nomenclature ripple** — Phase 50 (except the "Agent editor's recommendation" label required by SC-4, shipped here).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WSP-01 | One Issue Workspace replaces Review Desk/Signal Desk/Voice Pass nav items, stage tabs 1–5 with live status marks | `lib/nav.ts` already removed the three items in Phase 40 (D-31) — only "Issue Workspace" entry is net-new (D-22). `StageStrip.tsx` is the exact tab visual to reuse; `deriveStageStates` supplies the live marks. See Architecture Pattern 1 & 5 below. |
| WSP-02 | Persistent issue outline, 5-state vocabulary, jumps to section | `deriveStageStates`'s per-stage `StageStateResult` only covers stage-level state, **not per-section** state — see the Gap Analysis in Pattern 5 below; the outline needs a new section-level selector or a documented simplification. `EDITABLE_SECTIONS` + `qaSectionToGalleyId` give section identity; `galleyAnchorFor`-style scroll-to-anchor logic already exists twice (copy it, don't re-derive). |
| WSP-03 | Collapsible context panel, stage-appropriate content | No existing collapsible shell in the codebase (verified — grep for a generic disclosure/accordion primitive found none reusable at this scope). Must build once in the frame; reuse `SourceIndex`, `ResolvedFindingsList`, `AnnotationMark`/`ClaimMark` popovers as content. |
| WSP-04 | Draft galley: checked=marigold+hover+focus, unchecked=rust+click-through | `ClaimMark.tsx` + `.galley-claim` CSS verified — hover already works (native `title`); keyboard focus does NOT reveal source today (no `:focus-visible` CSS rule on `.galley-claim`, unlike `.galley-anno` which has one; the popover only opens on click/Enter/Space, not on bare Tab-focus). Click-through to Fact Check requires a new prop threaded Galley→GallerySection→ClaimMark (chain fully mapped in Pattern 8 below). |
| WSP-05 | Stage 5 blockers-first → readiness board → agent recommendation | `DecisionRail.tsx` already renders blockers-first (headline count → blocking items → memo → hook → verification → sign-offs → actions → resolved). The "readiness board" and "agent editor's recommendation" block do NOT exist yet — net-new additions to (or wrapping of) the rail. See Pattern 3. |
| WSP-06 | Publish: unlock condition shown, exact preview, one click, no typed confirm | **No typed confirmation exists in the current codebase at all** — `handlePublish()` in `DecisionRail.tsx` is a single unconfirmed click today. The "exact preview" (destination/title/time/consequences) is 100% net-new UI. See Pattern 4 for the data available to populate it. |
| WSP-07 | "Not generated" first-class, never blank | `deriveStageStates` already returns `'not-generated'` per stage (used by `StageStrip`); need the analogous **section-level** "not generated" (draft section absent from Sanity) for the canvas + outline — net-new derivation, not present in `derivedState.ts` today. `_PlaceholderScreen.tsx` is the styling precedent. |

## Project Constraints (from CLAUDE.md)

- **GSD Workflow Enforcement**: no direct repo edits outside a GSD workflow (`/gsd:execute-phase` etc.) — the planner should structure tasks accordingly, but this is process, not a code constraint.
- **Locked stack**: Next.js 14+ App Router (Vercel), Sanity v3, FastAPI + LangGraph (Railway), Convex, Stripe, OpenRouter — do not substitute. Phase 41 touches only the Next.js console (`apps/dispatch-control`) and possibly the FastAPI `review.py` publish endpoint (only if the publish *contract* changes, which D-15 does not require — see Pattern 4).
- **Repository monorepo** — `apps/dispatch-control` is the relevant workspace; `convex/` is the shared Convex functions package (`@eisenbalm/convex`), requiring a live `dev:once` sync after any schema/function change (see Pitfall 2 below — this is a memory-flagged repo-wide gotcha, not phase-specific, but directly relevant if a `setLastVisitedStage` mutation is added).
- **Security**: no new attack surface introduced by this phase (no new iframe/sandbox, no new theme injection). N/A beyond existing patterns.
- **"Andrew is single-threaded"**: no change to review/approval single-actor model; Phase 41 does not add a second reviewer path.

## Architecture Patterns

### Recommended Project Structure

```
apps/dispatch-control/app/(dashboard)/issues/
├── [issueNumber]/
│   ├── layout.tsx                 # NET-NEW — the frame (D-01)
│   ├── page.tsx                   # REWRITTEN — redirect-only (D-03)
│   ├── story/page.tsx             # NET-NEW — mounts SignalDeskScreen (D-09)
│   ├── draft/page.tsx             # RENAMED from review/ (D-06)
│   ├── fact-check/page.tsx        # NET-NEW — placeholder (D-11)
│   ├── voice/page.tsx             # UNCHANGED location, mounts VoicePassScreen minus rail-nothing-changes
│   ├── approval/page.tsx          # NET-NEW — mounts DecisionRail + SourceIndex (D-13)
│   ├── review/page.tsx            # BECOMES a redirect to draft/ (D-06) — or deleted + next.config rewrite
│   └── runs/[runId]/page.tsx      # UNCHANGED (Phase 40)
├── _components/
│   ├── StageStrip.tsx             # REUSED as-is for tab visuals (D-02)
│   ├── WorkspaceOutline.tsx        # NET-NEW (D-18/WSP-02)
│   ├── ContextPanel.tsx            # NET-NEW shell (D-19/WSP-03)
│   ├── PublishPreviewDialog.tsx    # NET-NEW (D-15/WSP-06)
│   └── (existing CreatePanel/HeldIssueRow/HoldDialog/IssueCard/...)
```

### Pattern 1: The shared-layout frame (D-01)

**What:** `app/(dashboard)/run-monitor/layout.tsx` is the exact, minimal precedent already in the repo:

```typescript
// Source: apps/dispatch-control/app/(dashboard)/run-monitor/layout.tsx (verbatim, existing code)
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Runs', href: '/run-monitor/runs' },
  { label: 'Graph', href: '/run-monitor/graph' },
]

export default function RunMonitorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-6 border-b ...">
        {TABS.map(tab => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return <Link key={tab.href} href={tab.href} className={cn(...)}>{tab.label}</Link>
        })}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
```

In Next.js App Router, a `layout.tsx` at `issues/[issueNumber]/layout.tsx` wraps **every** nested route under it (`story/`, `draft/`, `fact-check/`, `voice/`, `approval/`, and even `runs/[runId]/`) and — critically — **stays mounted across client-side navigations between its children** (this is the whole point of a layout vs. a page: React does not remount `layout.tsx` when only the `page.tsx` inside it changes, so any `useState`/subscriptions in the layout survive tab switches). `{children}` is the slot the active stage's `page.tsx` renders into.

**Difference from the run-monitor precedent that matters for planning:** the run-monitor layout has **zero Convex subscriptions and zero derived state** — it is pure navigation chrome. The issue-workspace layout must *also* own the Convex reads (`issues.byIssueNumber`, `pipelineRuns.byIssueNumber`, `signOffs.activeByRunId`, `claimChecks.listByRunId`, `qaCorrections.byRunId`, `pitchLog.byRunId`, `runs.byRunId`) and run `deriveIssueStatus`/`deriveStageStates`/`deriveTasks` **once**, then hand the results down to (a) the tab strip, (b) the outline, (c) the context panel, and (d) each stage page — because every stage page currently re-subscribes to the same queries independently (verified: `ReviewDeskRunView`, `VoicePassScreen`, and `IssueOverviewPage` each call `useQuery(api.qaCorrections.byRunId, ...)` separately). Two structurally valid ways to hand this down, both compatible with `'use client'` layouts:
1. **React Context** — a `WorkspaceStateProvider` in the layout wrapping `{children}`, consumed by stage pages and the outline/panel via a hook.
2. **Prop threading through a client wrapper** — since Next.js layouts cannot pass props directly into `{children}` (children is opaque), Context is the only clean mechanism if stage pages need the parent-derived values; the alternative is to accept that stage pages keep their own independent Convex subscriptions (Convex's client cache de-dupes identical queries automatically, so this is not a correctness problem, only a "derive twice" cleanliness question). **Recommend Context** since `derivedState.ts`'s outputs (issue status, 5 stage states, task list) are exactly what the tabs + outline + Stage-5 rail all need simultaneously, and deriving them once avoids the five call-sites silently drifting out of sync over time.

**Persistent controls** (save state, Ask an agent, Decision log, Hold issue) that today live entirely in `IssueOverviewPage` (Phase 40 `page.tsx`) — the `HoldDialog` open/close state, `holdMutation`/`reopenMutation` calls, and the `cancelRun` call — must be lifted into the new `layout.tsx` verbatim (they are self-contained `useState` + Convex `useMutation` + `cancelRun()` calls with no dependency on which stage is active).

### Pattern 2: Mounting run-keyed views issue-keyed (D-07/D-08)

Exact current mount signatures (verified by reading the files):

| Component | File | Signature | Page chrome to strip |
|---|---|---|---|
| `ReviewDeskRunView` | `review-desk/[runId]/ReviewDeskRunView.tsx` | `{ params: Promise<{ runId: string }> }` (default export) — takes an async `params` Promise, unwrapped via React's `use()` | `<h1>Review Desk — Run {runId}</h1>` header + rerun-clobber advisory paragraph (lines 361–370); the outer `flex min-h-[70vh] flex-col gap-4` wrapper is fine to keep. The `DecisionRail` mount at the bottom of the `viewMode === 'galley'` branch (lines 488–492) must be **deleted from this file** (moves to Stage 5). |
| `VoicePassRunView` (default) | `voice-pass/[runId]/VoicePassRunView.tsx` | `{ params: Promise<{ runId: string }> }` — thin wrapper around named `VoicePassScreen` | N/A — the issue-keyed `/issues/[n]/voice/page.tsx` already bypasses this default export and calls `VoicePassScreen` directly. |
| `VoicePassScreen` (named export) | same file | `{ runId: string }` — plain string prop, no Promise | `<h1>Voice Pass — Run {runId}</h1>` header, "Run deep check" button row is fine to keep as-is (it's an in-canvas action, not page chrome). |
| `SignalDeskScreen` | `signal-desk/_components/SignalDeskScreen.tsx` | `{ workspace_id: string }` — **does NOT take a runId at all**; it internally calls `useQuery(api.runs.latest, { workspace_id })` to find its own run | `<h1>Signal Desk</h1>` header + subtitle paragraph (lines 83–90) is page chrome to strip. **Bigger issue: this component ignores any runId you'd pass it** — see Pattern 6. |
| `DecisionRail` | `review-desk/[runId]/_components/DecisionRail.tsx` | `{ runId: string }` | No page chrome of its own (it's already a `<aside>` fragment) — but it currently assumes it renders *beside* the galley (`w-[336px]` sidebar sizing baked into its caller, not itself) — as a Stage-5 full page it likely needs its container width freed up, not the component internals changed. |

**Recommended extraction boundary (D-08):** for `ReviewDeskRunView` and `VoicePassScreen`, the cleanest cut is to leave the *file* where it is and simply delete the `<h1>` header + advisory text (2–3 lines) plus the `DecisionRail` mount (`ReviewDeskRunView` only) — these are not separable "inner components," they're literally page-chrome JSX that can be deleted in place, since the rest of the component (chip nav + galley + edit panel, or galley + VoicePassRail) already *is* the mountable canvas content. No new "inner component" file is structurally required for Draft/Voice — just edit the existing view components down to canvas-only content, since the run-keyed routes that used to render them (`/review-desk/[runId]`, `/voice-pass/[runId]`) are legacy fallbacks Phase 40 already routes around (D-06/D-07: old URLs redirect to the issue-keyed ones), so there is no second live caller that still needs the header.

### Pattern 3: The decision-rail split (D-13)

`DecisionRail.tsx` (`review-desk/[runId]/_components/DecisionRail.tsx`, 486 lines) renders, in order:
1. Headline count line (`N blocker(s) to clear · M warnings`)
2. Blocking items — jump-link list of open error-severity findings scoped to `FACTUAL_AXES`
3. Editor's memo (`editor-final` deliberationEvents payload, key `notes`)
4. Hook card (`pitchLog.selectedByRunId`)
5. Verification block (claims checked X/Y + affirmative timestamp) + `<SourceIndex runId={runId} />`
6. Sign-offs (`facts-cleared`, `sounds-human` — `signOffs.activeByRunId`)
7. Actions: Publish (disabled unless zero blockers + both sign-offs), Hold, Re-run section ▾, Transcript
8. `<ResolvedFindingsList runId={runId} />`

It reads exactly four Convex queries (`qaCorrections.byRunId`, `deliberationEvents.byRunIdAndType`, `pitchLog.selectedByRunId`, `claimChecks.listByRunId`, `signOffs.activeByRunId` — five, correcting count) plus one mutation-adjacent client call each for publish/sign-off/hold/rerun, all via existing `lib/*Client.ts` modules (`reviewClient`, `signOffClient`, `pipelineControlClient`). **None of this needs to change to move it** — it is a self-contained `{ runId }` component today; moving it from `ReviewDeskRunView`'s JSX to `approval/page.tsx`'s JSX is a cut-paste-resize (drop the `lg:w-[336px]` sidebar width, let it take the Stage-5 canvas width) with zero internal changes required for D-13/D-17.

**What WSP-05 requires that doesn't exist yet:** the "readiness board" (fact check / voice / hook+peg / organization verification / open decisions, as a scannable board, not just the existing memo/hook/verification prose blocks) and the "**Agent editor's recommendation**" block (labeled per D-16) are both **net-new** additions. The closest existing raw material for "agent recommendation" is the `editor-final` deliberationEvents payload's `notes` field already read as `memo` — D-16's label should likely wrap that same data source rather than invent a new one, since there is no other "agent editor's recommendation" data anywhere in the schema (verified: no `agentRecommendation` field exists on any table). Flag this as an open question for the planner — see Open Questions.

### Pattern 4: The publish confirmation change (D-15, WSP-06)

**Current flow, fully verified, no typed confirmation anywhere:**
```typescript
// Source: DecisionRail.tsx handlePublish (existing, unchanged today)
async function handlePublish() {
  setBusy(true)
  setActionMessage(null)
  try {
    const token = await getToken()
    await publishIssue(token, runId)   // <-- single call, no dialog, no confirm(), no typed input
    setActionMessage('Published.')
  } catch (e) { /* ... */ } finally { setBusy(false) }
}
```
The button itself is already gated (`disabled={blockers.length > 0 || !factsActive || !humanActive || busy}`) — that IS the D-15 "unlock condition" mechanism, just missing the "written next to the control" text and the preview step.

`lib/reviewClient.ts::publishIssue(token, runId)` POSTs to `/issues/{runId}/publish` (pipeline `api/review.py`). Server-side: `publish_issue()` already re-validates the two-sign-off gate (409 `claims_not_signed_off` / `wrong_status`) independent of the client-side disabled state (belt-and-suspenders, unchanged since Phase 34) — **no server contract change is required for D-15/WSP-06**, because the "exact preview + one click" is purely a client-side interstitial UI step before calling the *same* `publishIssue()` function that exists today. This means **`docs/API_CONTRACTS.md` almost certainly does NOT need amending** for this specific decision (the "amend first if the contract changes" caveat in the CONTEXT.md doesn't trigger unless the planner decides to add new preview-fetching endpoints — see below).

**Data available to populate "destination, title, time, consequences":**
- **Destination**: not stored anywhere as a literal string today — likely a static copy string ("the public Dispatch site") since there's exactly one destination.
- **Title**: `DraftResponse` (from `getDraft()`/`contentPatchClient.ts`) has **no single issue-title field** — only per-section `headline`s (`originStory.headline`, `problemStatement.headline`, etc.). The closest thing to an issue-level "title" is the charity name from `pitchLog.selectedByRunId` (`{ charityName, scoutSummary }`, already read by `DecisionRail` for the Hook card) combined with the issue number. Recommend composing "Issue {n} — {charityName}" client-side rather than adding a new field.
- **Time**: `publishIssue()` publishes immediately — "time" is effectively "now" for the immediate-publish path (there's a separate `scheduleIssue()` for future publish, already wired with its own `scheduledAt` param, unaffected by this phase).
- **Consequences**: static copy (e.g. "This publishes Issue {n} to the live site and locks further edits.") — no data dependency.

**Recommendation:** build `PublishPreviewDialog` as a client-only two-step interaction (open preview → confirm calls the existing `handlePublish`/`publishIssue` unchanged) requiring **zero** new pipeline/Convex work, using data already fetched by `DecisionRail` (charityName, issueNumber, blockers count) plus one new static copy string.

### Pattern 5: Consuming the Phase 40 derived-state selector (D-02, D-18) — and the outline's gap

`lib/derivedState.ts` exports (verified, full file read):
- `deriveIssueStatus(inputs): IssueStatus` — `'unknown'|'draft'|'needs-review'|'ready'|'published'|'held'`
- `deriveStageStates(inputs): [StageStateResult, ×5]` — one result per stage (Story/Draft/Fact Check/Voice/Approval), each `{ state: StageState, openCount: number }` where `StageState = 'not-generated'|'in-progress'|'needs-you'|'clean'`
- `deriveTasks(inputs): DerivedTask[]` — flat task list with `{ id, sev, title, where, why, rec?, primary: {label, href}, insp?, stage: 1|2|3|4|5 }`
- `estimateWorkMinutes(tasks): number`
- `STAGE_LABELS` lives in `StageStrip.tsx` (not `derivedState.ts`), as does `STAGE_STATE_LABELS`

**The gap:** `deriveStageStates` is **stage-level only** — 5 results total, one per stage. WSP-02 requires a **section-level** outline (originStory / problemStatement / founderBio / caseStudy / bonus / game / podcast / theme / deliberation, per `EDITABLE_SECTIONS`) with its own 5-state vocabulary (clean / review / must fix / changed since review / not generated) that is **narrower per stage-vocabulary terms** than `StageState`'s 4 values and uses different words ("must fix" vs "needs-you", "changed since review" has no stage-level analog at all — "changed since check" is a Phase 42/Fact-Check-era concept per `DERIVED-STATE-CONTRACT.md` §4, not something Phase 41's Draft-stage sections can compute without claim-check-touch tracking that doesn't exist yet). **This selector does not exist and must be planned as net-new**, built the same way `deriveDraftStage` is built (open QA findings scoped per-section via `qaSectionToGalleyId`/`resolveSectionFindings`, same primitives, narrower grain) — it is a natural sibling function in `derivedState.ts`, not a rewrite of the existing exports. Flag "changed since review" specifically: with no content-patch-touch tracking, this state may be unreachable in Phase 41 and should either be omitted from the outline's real states (rendering the label but never triggering it) or explicitly scoped as future work — this is a genuine open question, not just an implementation detail.

`StageStrip.tsx` (`issues/_components/StageStrip.tsx`, full file read) is exactly what D-02 says: 5 `data-testid="stage-segment"` nodes, icon + label per `StageState`, deliberately never using the spin-animation reserved for System Activity "Running". Reuse this component **as the tab bar itself** (it already renders `role="list"`/`role="listitem"` — swap in `<Link>` wrapping for tab navigation, or wrap each segment in a `<Link href={stageHref}>`).

### Pattern 6: Stage 1 net-new issue-keying (D-09, D-10)

The existing pattern (copied twice already, in `issues/[issueNumber]/review/page.tsx` and `.../voice/page.tsx`) is a **Server Component** that:
1. Parses `issueNumber` via `parseIssueNumber` (redirect to `/issues` on failure)
2. Resolves the most recent `runId` via a server-side `ConvexHttpClient` call to `api.pipelineRuns.byIssueNumber` (NOT a client-side `useQuery` — this avoids a race between the redirect decision and the first paint)
3. Redirects to the issue overview if no run exists yet
4. Renders the target screen component passed `runId` (or a `params` Promise resolving to it)

```typescript
// Source: apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx (existing, verbatim pattern to copy for story/page.tsx)
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueHref } from '@/lib/issueRouteResolver'
import { VoicePassScreen } from '../../../voice-pass/[runId]/VoicePassRunView'

export const dynamic = 'force-dynamic'

export default async function IssueVoicePage({ params }: { params: Promise<{ issueNumber: string }> }) {
  const { issueNumber: rawIssueNumber } = await params
  const n = parseIssueNumber(rawIssueNumber)
  if (n === null) redirect('/issues')
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const run = url ? await new ConvexHttpClient(url).query(api.pipelineRuns.byIssueNumber, { issueNumber: n }) : null
  if (!run) redirect(issueHref(n))
  return <VoicePassScreen runId={run.runId} />
}
```

`issues/[issueNumber]/story/page.tsx` copies this exact shape, importing `SignalDeskScreen` and passing it a runId. **But `SignalDeskScreen`'s prop signature is `{ workspace_id: string }`, not `{ runId: string }`** — it internally derives its own run via `runs.latest`. This is the actual net-new work for D-09: either (a) add an optional `runId?: string` prop to `SignalDeskScreen` that, when provided, skips the internal `runs.latest` lookup and uses the passed runId directly (preferred — minimal, additive, keeps the existing top-level `/signal-desk` route's `workspace_id`-only behavior untouched), or (b) have the wrapper page pass `workspace_id` unchanged and accept that Stage 1 always shows the *workspace's* latest run rather than *this issue's* run specifically (acceptable only if, in practice, the "current issue" and "latest run" are always the same thing pre-multi-issue-concurrency — but this silently breaks the moment an operator looks at a held/older issue's Story tab while a newer run is in flight). **Recommend (a)** — it's a small, additive, backward-compatible signature change and is the only option that actually satisfies "issue-keyed."

### Pattern 7: Stage 3 Fact-Check placeholder (D-11, D-12)

Available read-only queries (verified in `convex/claimChecks.ts`, full file read for the `insertBatch`/`setStatus` mutations; query names referenced consistently across `SourceIndex.tsx`/`DecisionRail.tsx`):
- `claimChecks.listByRunId({ runId })` → `ClaimCheckRow[]` with `{ claimIndex, text, status, checkedAt?, claimId?, sourceUrl?, retrievedAt?, sectionName? }`
- `claimChecks.allSignedOff` — referenced in comments (§26.6) as the conservative "empty list = false" gate function used by the publish approve path; not read directly by any Stage-3-relevant component today but available for a placeholder's summary line.

The existing `deriveFactCheckStage` in `derivedState.ts` already computes the exact `not-generated / in-progress / needs-you / clean` state for Stage 3 from these same rows (claimRows.length === 0 → not-generated; any `status === 'pending'` → needs-you with count; else clean) — **the Stage-3 placeholder can literally reuse this stage-state result plus a raw `claimRows` count breakdown** (checked X of Y, same shape `DecisionRail`'s Verification block already renders) without needing any new Convex query. Recommend building the Stage-3 placeholder as a slimmed-down read-only clone of `DecisionRail`'s Verification section (X/Y checked, affirmative timestamp, "No claims extracted yet" never-blank copy) plus a static "Full Fact Check arrives in a future phase" banner — this reuses `SourceIndex.tsx`'s exact query and row-rendering pattern (make it read-only by omitting the Check/Skip buttons, or reuse `SourceIndex` wholesale since it's already read-plus-action and the actions are harmless to leave in).

### Pattern 8: Galley claim rendering + keyboard-focus accessibility (D-20, WSP-04)

**Confirmed current behavior** (full files read: `ClaimMark.tsx`, `AnnotationMark.tsx`, `globals.css`):
- `.galley-claim` (the claim-provenance wash) has **no `:focus-visible` CSS rule** — contrast with `.galley-anno` (the QA-finding underline) which explicitly has `.galley-anno:focus-visible { outline: 2px solid var(--color-ink); }`. This is a straightforward, small CSS gap to close: add the analogous rule for `.galley-claim`.
- The source-reveal mechanism today is the native HTML `title` attribute (`tooltip` variable in `ClaimMark.tsx`), which browsers show **only on mouse hover**, not on keyboard `:focus`. The `<mark>` element already has `tabIndex={0}`, `role="button"`, and an `onKeyDown` handler that opens the same click-triggered `.galley-popover` on `Enter`/`Space` — so the claim IS keyboard-**reachable** and keyboard-**activatable** today, but is not keyboard-**hover-equivalent**: a sighted keyboard user must press Enter/Space (an extra step) to see the source, whereas a mouse user sees it on mere hover. To satisfy "source on hover **and** keyboard focus" literally, add an `onFocus`/`onBlur` pair (mirroring the existing open/close state) that opens the same popover purely on focus, closing on blur (careful: must not conflict with the existing click-toggle-and-outside-click-close logic — recommend a separate `focusOpen` boolean OR-ed with the existing `open` state when rendering the popover, so a click-opened popover doesn't get force-closed by a subsequent blur from an unrelated element).
- **Click-through to Fact Check (unchecked claims only) does not exist as a prop anywhere in the chain.** Verified full prop chain: `Galley.tsx` (`GalleyProps` — no such callback) → `GallerySection.tsx` (`GallerySectionProps` — no such callback; the `components.marks.claimSpan` render function only passes `value`/`children`/`runId` to `ClaimMark`) → `ClaimMark.tsx` (no navigation prop at all). Adding this requires a new optional prop threaded through all three files, e.g. `onUnsourcedClaimClick?: (claimIndex: number) => void`, wired in `ClaimMark`'s existing `toggle()`/`onClick` handler: when `value.status === 'pending'` (unchecked) **and** the prop is provided, navigate instead of (or in addition to) opening the popover. Since this is Draft-stage-only behavior (Stage 2 inside the Workspace), pass the callback only from the Stage-2 page's `<Galley>` mount, leaving `undefined` (today's popover-only behavior) for any other caller (Voice Pass's Galley mount, if any legacy `/review-desk/[runId]` route survives).

### Pattern 9: Testing patterns (vitest + RTL, existing conventions)

`apps/dispatch-control/package.json` scripts: `"test": "vitest run"`, `"test:unit": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"build": "next build"`. **62 existing test files** in `apps/dispatch-control/__tests__/`, following two clear conventions verified by reading `derivedState.test.ts`, `nav.test.ts`, and `DecisionRail.test.tsx`:

1. **Pure-selector tests** (`derivedState.test.ts`) — plain Vitest `describe`/`it`/`expect`, no mocks, construct a `DerivationInputs` fixture via a `baseInputs(overrides)` helper, assert on the pure function's return value directly. This is the pattern for any new outline/section-state selector (Pattern 5's gap).
2. **Component tests** (`DecisionRail.test.tsx`) — `vitest` + `@testing-library/react`, with `vi.mock('convex/react', ...)` stubbing `useQuery`/`useMutation`, `vi.mock('@clerk/nextjs', ...)` stubbing `useAuth`, and `vi.mock('@convex/_generated/api', ...)` mapping each `api.table.fn` reference to a string key matched by the `useQuery` mock's `args[0]` dispatch. This is the pattern for the new layout/frame, `WorkspaceOutline`, `ContextPanel`, and `PublishPreviewDialog` components.
3. **Structural/contract tests** (`nav.test.ts`) — assert on exported constants (`NAV_GROUPS`) plus filesystem checks (`fs.existsSync` against `path.join(appRoot, 'app', '(dashboard)', href, 'page.tsx')`) to catch dead nav links. **Directly reusable pattern**: a Phase 41 test should assert every stage segment (`story/draft/fact-check/voice/approval`) has a real `page.tsx` on disk, and that the removed `/issues/[n]/review` route either 404s-and-redirects or no longer exists per D-06.

**Memory-flagged rule** (from project memory, applies here): **vitest does NOT type-check.** Run `pnpm --filter dispatch-control build` (strict `tsc` via Next's build step) before declaring this frontend phase done — Phase 27 shipped 2 latent bugs that only failed on Vercel/Linux because vitest alone didn't catch them. Also: if any Convex schema/function change is made (e.g., a new `setLastVisitedStage` mutation for D-03/D-04), it must be synced live via `pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797` — committing `convex/*.ts` alone does not deploy it (Phase 39 shipped a prod 500 by skipping this, per project memory).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stage-level status derivation | A new "is this stage done" computation per tab | `lib/derivedState.ts::deriveStageStates` | Already exists, already tested (`derivedState.test.ts`), already consumed by `IssueCard`/`IssueOverviewPage`/`StageStrip` — a second derivation would drift from the first over time. |
| Tab visual (icon + label + count) | A new tab-strip component | `issues/_components/StageStrip.tsx` | Its own header comment says it was built *for this exact purpose* ("shared visual contract Phase 41's stage tabs will reuse — build it once, here"). |
| issueNumber→runId resolution | A new resolver hook/pattern for Stage 1 | The exact Server-Component pattern already used twice in `.../review/page.tsx` and `.../voice/page.tsx` | Copy-paste-adapt is correct here — it's proven, handles the redirect-on-no-run edge case, and avoids a client-side race Phase 40 deliberately avoided by using `ConvexHttpClient` server-side. |
| Publish server-side safety | A new publish gate check | The existing `publish_issue()` 409 checks in `api/review.py` (Phase 34, unchanged) | "DO NOT REBUILD the publish gate" is an explicit PROJECT.md instruction; the exact-preview UI is purely client-side additive. |
| Claim popover / annotation popover mechanics | New popover components for the outline or context panel | `ClaimMark.tsx` / `AnnotationMark.tsx` / `.galley-popover` CSS | These already handle open/close, outside-click, Escape, and (with the D-20 focus addition) keyboard parity — the context panel should surface the *same* data via the *same* visual language, not a parallel popover system. |
| Section-jump navigation | New scroll-to-section logic for the outline | The `galleyAnchorFor`/`document.getElementById(anchor)?.scrollIntoView(...)` pattern already implemented twice (in `ReviewDeskRunView.tsx` and `DecisionRail.tsx`, both private copies of the same 6-line function) | Third implementation should extract this into a shared helper (e.g. add to `lib/galley/sectionIdMap.ts`) rather than copy a fourth time — this is also a good moment to de-duplicate the two existing copies. |

**Key insight:** virtually everything Phase 41 needs data-wise already exists and is already read by at least one existing screen. The engineering risk in this phase is not "how do we compute X" — it's "how do we avoid five different components independently re-deriving the same X and silently drifting."

## Common Pitfalls

### Pitfall 1: Treating "typed confirmation removal" as a code deletion task
**What goes wrong:** A planner reads D-15 ("Publish drops typed confirmation") and searches for a typed-confirmation component to delete, finds nothing, and either wastes time searching further or incorrectly concludes the requirement is already satisfied.
**Why it happens:** The CONTEXT.md phrasing ("reverses Phase 34") describes the relationship to the *original design prototype*, not to what Phase 34 actually shipped in this codebase. Phase 34's actual deliverable was the *server-side* two-sign-off gate; it never built a client-side typed-confirmation dialog.
**How to avoid:** Plan WSP-06 as **net-new UI** (a preview-then-confirm interstitial), not a removal. Verified: `DecisionRail.tsx::handlePublish()` has zero confirmation steps today.
**Warning signs:** A task titled "remove typed confirmation from publish" with no corresponding "build exact preview dialog" task is a sign this pitfall has occurred.

### Pitfall 2: Forgetting SignalDeskScreen's prop signature blocks true issue-keying
**What goes wrong:** Copying the review/voice wrapper pattern verbatim for Stage 1 and passing `SignalDeskScreen` a `runId` prop it doesn't accept — it silently ignores it (TypeScript would actually catch this at the call site since `SignalDeskScreenProps` only declares `workspace_id`, but a careless spread or `any`-typed wrapper could mask it) and continues reading `runs.latest`, which is *usually* the same run as the current issue but breaks the moment two issues are ever "in flight" or an operator opens an older issue's Story tab.
**Why it happens:** All three "mount an existing screen" tasks (Draft, Voice, Story) look structurally identical from the CONTEXT.md decisions, but Story's underlying component was never built with a runId parameter at all (Signal Desk was built in Phase 37, before Phase 40 introduced issue-keying).
**How to avoid:** Add an explicit optional `runId?: string` prop to `SignalDeskScreen` that bypasses the internal `runs.latest` query when provided (Pattern 6 above); write a test asserting Stage 1 renders data for a *specific* (non-latest) run when passed one, to catch a silent revert to `runs.latest`.
**Warning signs:** No test exercises Stage 1 with a runId other than the workspace's actual latest run.

### Pitfall 3: Duplicating Convex subscriptions across the frame and every stage page
**What goes wrong:** Each of the 5 stage pages plus the frame layout independently calls `useQuery(api.qaCorrections.byRunId, {runId})`, `useQuery(api.signOffs.activeByRunId, {runId})`, etc. Convex's client cache de-dupes identical query+args pairs so this won't cause extra network requests, but it *will* cause `deriveStageStates`/`deriveTasks` to be computed independently in 6 places, and any future change to one call site's exact args shape (e.g. someone renames a filter) silently diverges from the others.
**Why it happens:** Each existing screen (`IssueOverviewPage`, `ReviewDeskRunView`, `VoicePassScreen`) already has its own copy of this subscription block, so it's tempting to just copy the pattern a sixth time into the new layout rather than centralizing it.
**How to avoid:** Centralize the subscription + derivation in the layout (or a dedicated hook called once from the layout) and pass results down via Context, per Pattern 1's recommendation.
**Warning signs:** Grep for `api.qaCorrections.byRunId` returning more than 2-3 call sites after this phase ships (one in the layout/hook, one remaining in `DecisionRail`/`Galley` for their own chip-count purposes which legitimately need row-level data the derived summary doesn't carry).

### Pitfall 4: Building the outline's 5-state vocabulary as if `deriveStageStates`'s 4-value `StageState` already covers it
**What goes wrong:** WSP-02's outline vocabulary is "clean / review / must fix / changed since review / not generated" — five *different* words from `derivedState.ts`'s `StageState` ("not-generated / in-progress / needs-you / clean") — and covers **sections**, not stages. A planner who doesn't read `derivedState.ts` closely enough might try to feed `deriveStageStates`'s per-stage results into the per-section outline directly (there are ~9 sections but only 5 stages — the numbers don't even line up 1:1).
**Why it happens:** D-02 and D-18 both cite `derivedState.ts` as the authority, and it's easy to conflate "reuse the selector module" with "reuse the exact same function output" when a new sibling function is what's actually needed.
**How to avoid:** Plan a new `deriveSectionStates`-style function (or similar name) as an addition to `derivedState.ts`, built from the same primitives (`isOpenFinding`, `qaSectionToGalleyId`, `claimRows`) but scoped per-`EDITABLE_SECTIONS`-entry rather than per-stage. Explicitly decide (and document) how/whether "changed since review" is reachable in Phase 41 given no content-patch-touch-tracking exists yet (see Pattern 5 and Open Questions).
**Warning signs:** A task that says "wire `deriveStageStates` output directly into `WorkspaceOutline`" without a data-shape reconciliation step.

### Pitfall 5: Losing capability when gutting IssueOverviewPage into a redirect
**What goes wrong:** `IssueOverviewPage` (today's `page.tsx`) is a **314-line component** carrying status readout, StageStrip, task count, Open Review/Open Voice links, held-state row with reopen, HoldDialog wiring (open state, busy state, error state), and run-history list. D-03 says this becomes "a redirect to `lastVisitedStage`... The overview's persistent concerns... move into the frame's persistent controls" — but if the planner just deletes the page and writes a two-line redirect without first identifying every piece of state/logic that needs a new home in the layout, capability silently disappears (e.g., the Hold error-message display, or the run-history list, which isn't explicitly named as a "persistent control" in the CONTEXT.md list but has nowhere else to live).
**Why it happens:** "Becomes a redirect" sounds like a deletion task; the actual work is an extraction-then-redirect task.
**How to avoid:** Before writing the redirect, explicitly enumerate every piece of `IssueOverviewPage`'s JSX/state/handlers and assign each a destination: status readout → frame header/controls; StageStrip → frame tabs (already there); Hold/Reopen + dialog + busy/error state → frame persistent controls; run-history list → needs an explicit decision (a persistent-control popover? Kept as a link out to `/issues/[n]/runs`? Not explicitly covered by any WSP requirement — flag as open question below).
**Warning signs:** No task references `HoldDialog`, `relativeTime`, or the run-history `history.map(...)` block from the old `page.tsx` when planning the layout.

### Pitfall 6: Assuming the `lastVisitedStage` write path already exists
**What goes wrong:** Planning D-03's redirect logic (`redirect(issueHref + '/' + lastVisitedStage)`) without noticing that **nothing writes `issues.lastVisitedStage` today**. The field exists in `convex/schema.ts` (line 500, `lastVisitedStage: v.optional(v.string())`) but grep across `convex/` and `apps/dispatch-control/` for the string `lastVisitedStage` returns **only the schema declaration** — no mutation, no query, no call site.
**Why it happens:** Phase 40's CONTEXT.md lists `lastVisitedStage` as part of the `issues` table shape (D-01) and the schema was built with the field, but Phase 40 itself never had a reason to write it (there were no stage sub-routes to visit yet) — this was left for Phase 41 by design, but that intent is easy to miss since the field *looks* already wired.
**How to avoid:** Plan an explicit task: add a mutation (e.g. `issues.setLastVisitedStage({ workspace_id, issueNumber, stage })`) and call it from the frame layout on mount/stage-change (e.g. in a `useEffect` keyed on `pathname`), remembering the **live Convex sync** requirement (Pitfall from project memory: `pnpm --filter @eisenbalm/convex dev:once` after any `convex/*.ts` change, or this mutation 404s in the dev deployment despite being committed).
**Warning signs:** The redirect task has no corresponding "write lastVisitedStage" task, or no corresponding Convex-sync step.

## Code Examples

### Reading Convex query results the existing overview page already assembles (reusable verbatim for the new layout)

```typescript
// Source: apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx (existing, lines 116-161)
// This exact block is what the new layout.tsx should own instead of page.tsx.
const issue = useQuery(api.issues.byIssueNumber, n !== null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n } : 'skip')
const run = useQuery(api.pipelineRuns.byIssueNumber, n !== null ? { issueNumber: n } : 'skip')
const history = useQuery(api.pipelineRuns.listByIssueNumber, n !== null ? { issueNumber: n } : 'skip')
const runLookupResolved = n === null || run !== undefined
const runId: string | null = run?.runId ?? null
const signOffsRaw = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
const claimRowsRaw = useQuery(api.claimChecks.listByRunId, runId ? { runId } : 'skip')
const qaFindings = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip')
const pitchRows = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')
const runRow = useQuery(api.runs.byRunId, runId ? { runId } : 'skip')
const signOffs = !runLookupResolved ? undefined : runId === null ? {} : signOffsRaw
// ... then deriveIssueStatus/deriveStageStates/deriveTasks/estimateWorkMinutes(derivationInputs)
```

### Scroll-to-section helper (already duplicated twice; extract on this third use)

```typescript
// Source: ReviewDeskRunView.tsx (galleyAnchorFor) and DecisionRail.tsx (identical private copy)
function galleyAnchorFor(sectionId: string): string | null {
  if (sectionId === 'theme') return null
  if (sectionId === 'deliberation-conversation') return 'galley-deliberation'
  return `galley-${sectionId}`
}
// usage: document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
```

### Claim-mark keyboard behavior to extend (add onFocus/onBlur + click-through prop)

```typescript
// Source: apps/dispatch-control/components/galley/ClaimMark.tsx (existing — the <mark> element to extend)
<mark
  className="galley-claim"
  data-provenance={value.provenance}
  data-checked={isChecked ? 'true' : 'false'}
  title={tooltip}
  tabIndex={0}
  role="button"
  aria-label={`${value.provenance} claim`}
  aria-expanded={open}
  onClick={toggle}
  onKeyDown={handleKeyDown}
  // NET-NEW for D-20: onFocus={() => setFocusOpen(true)}, onBlur={() => setFocusOpen(false)}
  // NET-NEW for D-12/WSP-04 click-through: in toggle()/onClick, if !isChecked && onUnsourcedClaimClick, navigate instead
>
  {children}
</mark>
```

## Open Questions

1. **Where does the run-history list go?**
   - What we know: `IssueOverviewPage` today renders a full run-history list (`history.map(...)`, linking to `/issues/[n]/runs/[runId]`). D-03 lists "run history link" among the persistent concerns moving into frame controls but doesn't specify the UI (inline list? popover? single "View run history" link out to `/issues/[n]/runs`?).
   - What's unclear: whether the full inline list needs to survive in the frame or whether a single link suffices given `runs/[runId]/page.tsx` already exists as its own page.
   - Recommendation: planner's discretion — a single persistent-control link to a "Run history" view (reusing `runs/[runId]` as a target, or a new lightweight `runs/page.tsx` listing) is the lowest-risk choice; do not silently drop the capability.

2. **What is the actual data source for "Agent editor's recommendation" (WSP-05/D-16)?**
   - What we know: The only existing candidate data is the `editor-final` deliberationEvents payload's `notes` field, already surfaced as "Editor's memo" in the current `DecisionRail`.
   - What's unclear: whether D-16's block is meant to be the *same* memo re-labeled ("Agent editor's recommendation" instead of "Editor's memo"), or a distinct new concept requiring new data. The Annotations doc's Stage 5 section lists "readiness board" and "Agent editor's recommendation" as two separate items after the memo already exists in the rail — suggesting the memo IS the recommendation, just needing the D-16 label applied, with the "readiness board" being the genuinely new addition (a scannable status grid).
   - Recommendation: treat "Agent editor's recommendation" as a relabel of the existing editor-final memo unless the planner finds contrary signal in the (not-yet-committed) `.dc.html` prototype file; build the "readiness board" as the one truly new UI element.

3. **Is "changed since review" reachable at all in Phase 41's outline?**
   - What we know: `DERIVED-STATE-CONTRACT.md` §4 defines "changed since check" as a Fact-Check-era (Phase 42) concept requiring content-patch-touch tracking that doesn't exist in Phase 41's data model. The outline's 5-state vocabulary (WSP-02) includes "changed since review" as one of five states, but no existing table/field tracks "this section was edited after its last QA/claim pass."
   - What's unclear: whether Phase 41 must implement minimal touch-tracking now (e.g., comparing a content-patch timestamp against a sign-off/check timestamp) or whether this state is legitimately unreachable until Phase 42/45 wiring lands, in which case the outline should render the label but the state predicate simply never fires in Phase 41.
   - Recommendation: scope Phase 41's section-state selector to only reliably compute clean/review/must-fix/not-generated, and document "changed since review" as a Phase 42+ predicate that the label exists for but nothing yet triggers — consistent with WSP-07's "never blank" spirit (the label exists in the legend even if unused).

4. **Does the publish "destination" copy need a config-driven value or is a static string acceptable?**
   - What we know: There is exactly one destination (the public Dispatch site) and no per-issue destination variance exists anywhere in the schema.
   - What's unclear: whether future milestones (scheduling to different environments, staging previews) would need this to be dynamic.
   - Recommendation: static string is correct for Phase 41; do not over-engineer a destination-config system for a single fixed target.

## Environment Availability

Skipped — this phase has no new external tool/service dependency. It runs entirely within the existing `apps/dispatch-control` Next.js app against the already-provisioned Convex deployment (`dev:modest-magpie-797`) and existing pipeline endpoints. The only operational requirement (not a "missing dependency," a workflow step) is running `pnpm --filter @eisenbalm/convex dev:once` after any Convex schema/function addition (e.g., the `setLastVisitedStage` mutation) — this is a repo-standing project convention, not something to probe for availability.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) + `@testing-library/react` for component tests, jsdom environment for `.test.tsx` files |
| Config file | `apps/dispatch-control/vitest.config.ts` (existing — not read in full during this research pass, but confirmed active via 62 existing `__tests__/*.test.{ts,tsx}` files and the `package.json` `test`/`test:unit` scripts) |
| Quick run command | `pnpm --filter dispatch-control test -- <pattern>` (or `vitest run <file>` from within `apps/dispatch-control`) |
| Full suite command | `pnpm --filter dispatch-control test` (runs all `__tests__/*`), followed by `pnpm --filter dispatch-control build` (strict `tsc` via Next — vitest does NOT type-check) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WSP-01 | Nav shows one "Issue Workspace" item, not the three old desk items | unit (structural, follows `nav.test.ts` pattern) | `vitest run __tests__/nav.test.ts` | ❌ Wave 0 — extend existing `nav.test.ts` |
| WSP-01 | Stage tabs render with live status marks matching `deriveStageStates` | component | `vitest run __tests__/WorkspaceLayout.test.tsx` (or similar new name) | ❌ Wave 0 |
| WSP-02 | Outline lists all sections with correct 5-state vocabulary + jumps on click | unit (pure selector) + component | `vitest run __tests__/derivedState.test.ts` (extend) + new `__tests__/WorkspaceOutline.test.tsx` | ❌ Wave 0 (extend existing + new file) |
| WSP-03 | Context panel shows stage-appropriate content and can be hidden | component | new `__tests__/ContextPanel.test.tsx` | ❌ Wave 0 |
| WSP-04 | Checked claim shows source on focus (not just hover); unchecked claim click navigates to Fact Check | component, extends existing `AnnotationMark.test.tsx`-style pattern | new `__tests__/ClaimMark.test.tsx` (none exists today — verified absent from the 62-file list) | ❌ Wave 0 — **no `ClaimMark.test.tsx` currently exists at all**, despite `AnnotationMark.test.tsx` existing for its sibling component; this is a real gap regardless of this phase |
| WSP-05 | Stage 5 renders blockers → readiness board → recommendation in that order | component, extends `DecisionRail.test.tsx` pattern | `vitest run __tests__/DecisionRail.test.tsx` (extend) or new `__tests__/ApprovalStage.test.tsx` | Partial — `DecisionRail.test.tsx` exists (extend); readiness-board test is new |
| WSP-06 | Publish button disabled until gate conditions met; preview shows destination/title/time/consequences; one click after preview publishes | component | new `__tests__/PublishPreviewDialog.test.tsx` | ❌ Wave 0 |
| WSP-07 | "Not generated" renders as an Editor's-note block, never blank, in both canvas and outline | unit + component | extend `derivedState.test.ts` (section-state selector) + new component test | ❌ Wave 0 (selector function itself is new) |

### Sampling Rate
- **Per task commit:** `vitest run <specific file>` for the file(s) touched
- **Per wave merge:** `pnpm --filter dispatch-control test` (full suite) + `pnpm --filter dispatch-control build` (strict typecheck — mandatory per project memory, vitest alone is insufficient)
- **Phase gate:** Full suite green + `build` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New section-level derivation function in `lib/derivedState.ts` (e.g. `deriveSectionStates`) — needed before `WorkspaceOutline` can be built or tested (WSP-02/WSP-07)
- [ ] `__tests__/ClaimMark.test.tsx` — does not exist today; needed to cover WSP-04's focus-parity + click-through behavior (also closes a pre-existing test gap unrelated to this phase)
- [ ] `issues.setLastVisitedStage` Convex mutation + its own test — needed for D-03/D-04's redirect logic
- [ ] `SignalDeskScreen`'s new optional `runId` prop — needed before Stage 1's issue-keyed wrapper can be meaningfully tested against a non-latest run (Pitfall 2)
- [ ] Extend `lib/issueRouteResolver.ts` with the new stage hrefs (`issueStoryHref`, `issueDraftHref`, `issueFactCheckHref`, `issueApprovalHref`) + their own test cases (existing `issueRouteResolver.test.ts` file already covers this module — extend it, don't create a new file)

## Sources

### Primary (HIGH confidence — read directly from this repository)
- `.planning/phases/41-issue-workspace-frame/41-CONTEXT.md` — locked decisions D-01..D-22
- `.planning/phases/40-issue-entity-issues-home/40-CONTEXT.md` — foundation decisions D-01..D-31
- `.planning/REQUIREMENTS.md` (lines 338–368) — WSP-01..07, FCT-01..07
- `.planning/PROJECT.md` — Current Milestone section, locked decisions, reconciliation facts
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — full file, §Issue Workspace shared frame + Stages 1–5
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — full file, §1-10
- `docs/design/dispatch-control-v3/README.md` — full file
- `apps/dispatch-control/app/(dashboard)/run-monitor/layout.tsx` — layout-based tab bar precedent
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx` — full file, the overview to be gutted into a redirect
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx` and `.../voice/page.tsx` — the issue-keyed wrapper pattern to replicate for Stage 1
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` — full file, Stage 2 mount source
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` — full file, Stage 5 mount source
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx` — full file, Stage 4 mount source
- `apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx` — full file, Stage 1 mount source
- `apps/dispatch-control/app/(dashboard)/issues/_components/StageStrip.tsx` — full file, tab visual
- `apps/dispatch-control/lib/derivedState.ts` — full file, the pure selector module
- `apps/dispatch-control/lib/issueRouteResolver.ts` — full file
- `apps/dispatch-control/lib/reviewClient.ts` — full file, publish/schedule/reject client
- `apps/dispatch-control/lib/nav.ts` — full file
- `apps/dispatch-control/components/galley/ClaimMark.tsx`, `AnnotationMark.tsx`, `Galley.tsx`, `GallerySection.tsx` — full files, WSP-04 prop-chain mapping
- `apps/dispatch-control/app/globals.css` (grep, `.galley-claim`/`.galley-anno`/`.galley-popover` rules) — confirms missing `:focus-visible` on `.galley-claim`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx` — full file, Stage 3 placeholder raw material
- `convex/claimChecks.ts` (partial, `insertBatch`/`setStatus`), `convex/schema.ts` (issues table + claim_checks), `convex/pipelineRuns.ts` (`byIssueNumber`/`listByIssueNumber`) — grep + targeted reads
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` (grep) — confirms server-side publish gate unchanged, no contract-change trigger
- `docs/API_CONTRACTS.md` (grep, publish/claim_checks sections) — confirms existing gate shape
- `apps/dispatch-control/__tests__/derivedState.test.ts`, `nav.test.ts`, `DecisionRail.test.tsx` — testing convention precedents
- `apps/dispatch-control/components/_PlaceholderScreen.tsx` — full file, "Not generated" styling precedent
- `.planning/config.json` — confirms `workflow.nyquist_validation: true`, `ui_phase: true`, `ui_safety_gate: true`

### Secondary (MEDIUM confidence)
- None — no WebSearch/external sources were needed for this phase; it is entirely first-party recomposition work with no new library or ecosystem question.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no new libraries) — HIGH confidence there is nothing to research here, verified by the phase's own framing and by finding zero new-dependency signals anywhere in CONTEXT.md/ROADMAP.md.
- Architecture: HIGH — every pattern above is grounded in a full read of the actual source file it describes, not an inference from documentation.
- Pitfalls: HIGH — each pitfall is derived from a concrete, verified gap between what CONTEXT.md assumes exists and what the codebase actually contains (e.g., no typed confirmation, no `lastVisitedStage` writer, `SignalDeskScreen`'s prop mismatch).

**Research date:** 2026-07-14
**Valid until:** Should remain valid for the life of this phase's planning/execution (no external/ecosystem dependency to go stale). Re-verify only if a sibling phase (40 completion, or a mid-flight scope change) alters `derivedState.ts`, `DecisionRail.tsx`, or `SignalDeskScreen.tsx` before Phase 41 executes.
