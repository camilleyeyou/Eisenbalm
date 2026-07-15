# Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval - Context

**Gathered:** 2026-07-14 (`--auto` mode — recommended defaults auto-selected; see DISCUSSION-LOG.md)
**Status:** Ready for planning

<domain>
## Phase Boundary

The Review Desk, Signal Desk, and Voice Pass collapse into **one Issue Workspace** mounted at `/issues/[issueNumber]` (contents replaced in place — the URL does not move; Phase 40 D-09). The Workspace is a **shared frame** — stage tabs 1–5 with live status marks · a persistent issue outline · a collapsible context panel · persistent controls (save state, Ask an agent, Decision log, Hold issue) — with each stage recomposing an already-shipped screen:

- **Stage 1 — Story & Brief:** provisionally mounts the existing Phase 37 Signal Desk (candidate slate + Gate 1 adjudication) **as-is**. Replaced by the full Story & Brief design in Phase 47.
- **Stage 2 — Draft:** recomposes the Phase 32/33/35 galley (native Portable Text render, provenance claim marks, QA findings on selection).
- **Stage 3 — Fact Check:** **placeholder** in this phase — a first-class "arrives in Fact Check" state, not a blank. The real stage is Phase 42.
- **Stage 4 — Voice Pass:** recomposes the Phase 36 Voice Pass screen + its "Sounds human" sign-off.
- **Stage 5 — Approval:** recomposes the Phase 33 decision rail + Phase 34 two-sign-off publish gate, blockers-first, and **removes typed confirmation from Publish** (exact preview + one click — milestone locked decision, reverses Phase 34).

This is a **recomposition of the frame, not a rewrite of the screens** (PROJECT.md: "DO NOT REBUILD the publish gate / the design system"; Phase 40 D-07: the desks were re-keyed as thin translations "do NOT rewrite their internals"). Stages 2/4/5 mount existing components; only the frame (tabs, outline, panel), the Stage-1 issue-keying, the Stage-3 placeholder, and the publish-confirmation change are net-new.

**Not in this phase:** the Fact Check stage itself (Phase 42); the My Tasks *screen* (Phase 43 — the projection already exists, Phase 40 D-21); the "Inspect how this was made" panel and the passage toolbar's *Ask agent to revise* (Phases 44/45 — the Draft passage toolbar's Inspect/Revise actions are stubbed or omitted here); the full Story & Brief redesign (Phase 47); role/permission gating of the six actions (Phase 49 — controls render for the editor, locked-state rendering is 49); the console-wide nomenclature ripple (Phase 50 — except the load-bearing "Agent editor's recommendation" label required by SC-4).

</domain>

<decisions>
## Implementation Decisions

### A. Workspace frame architecture & routing

- **D-01: The frame is a shared layout** at `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` (net-new). It renders the stage tabs, the persistent issue outline, the collapsible context panel, and the persistent controls, and wraps each stage as a **nested child route** so the frame stays mounted across tab switches and every stage is deep-linkable (Phase 40 D-06: stages are path segments, not query params). Precedent for a layout-based tab bar: `app/(dashboard)/run-monitor/layout.tsx` (active tab via `usePathname`).
- **D-02: Stage tabs reuse `issues/_components/StageStrip.tsx`** for the visual + `lib/derivedState.ts` for the live status marks. `StageStrip.tsx`'s own header comment says it is the "shared visual contract Phase 41's stage tabs will reuse — build it once, here." `derivedState.ts` already defines the exact 5 stages (`STAGE_LABELS = ['Story','Draft','Fact Check','Voice','Approval']`, `DerivedTask.stage: 1|2|3|4|5`, `deriveStageStates` → 5 `StageStateResult`s). **Consume it; do not re-derive.** Tab mark = the stage state's `Not generated / In progress / Needs you / Clean` + open-item count (Phase 40 D-20), rendered label + icon, never color alone.
- **D-03: Bare `/issues/[n]` redirects into the Workspace at the last-visited stage.** The Phase 40 overview `page.tsx` (which today owns status header, StageStrip, task count, links, run history, Hold/Reopen) becomes a redirect to `lastVisitedStage` (from the `issues` table, Phase 40 D-01) or a default (D-04). The overview's persistent concerns — status, Hold/Reopen, run history link, Decision log, Ask an agent, save state — move into the frame's **persistent controls**, so no capability is lost. This is exactly the Issues-home behavior "card click → workspace at last-visited stage."
- **D-04: Default landing stage when `lastVisitedStage` is unset** = the earliest stage with real work: Stage 1 if no charity is chosen yet, otherwise Stage 2 (Draft). Deterministic from the same stage states the tabs read.

### B. Stage route segments & Phase-40 reconciliation

- **D-05: Stage segments are `story` (1), `draft` (2), `fact-check` (3), `voice` (4), `approval` (5).** These match `derivedState.ts`'s stage labels and honor Phase 40 D-06's anticipated `/draft` + `/fact-check` names. New route dirs: `issues/[issueNumber]/{story,draft,fact-check,voice,approval}/page.tsx`.
- **D-06: Rename Phase 40's `/issues/[n]/review` → `/draft`; keep `/voice`; add `/story`, `/fact-check`, `/approval`.** The Phase-40 `/review` and `/voice` thin wrappers are the recomposition seams — `/review` becomes `/draft`, and a 301/redirect from `/review` → `/draft` covers any live link. Update `lib/issueRouteResolver.ts` helpers (`issueReviewHref` → `issueDraftHref`, add stage hrefs). The old top-level `/review-desk`, `/voice-pass`, `/signal-desk` redirects from Phase 40 stay as-is.

### C. Recomposition strategy — reuse, do not rewrite

- **D-07: Mount each shipped screen's inner content into the frame's canvas slot; strip only its standalone page chrome** (the frame now provides the tabs/outline/panel/persistent-controls that each screen used to carry). Internals — data fetching, content-patch machinery, sign-off wiring, span resolution — are **untouched** (Phase 40 D-07; milestone "DO NOT REBUILD"). Screens already receive a `runId` resolved from `issueNumber` by the Phase 40 route wrappers.
  - **Stage 2 (Draft)** mounts the galley portion of `review-desk/[runId]/ReviewDeskRunView.tsx` (`components/galley/Galley.tsx` + section-chip nav + edit mode) **minus its `DecisionRail`**, which moves to Stage 5 (D-13).
  - **Stage 4 (Voice)** mounts the named `VoicePassScreen` export from `voice-pass/[runId]/VoicePassRunView.tsx` + `VoicePassRail.tsx`.
  - **Stage 5 (Approval)** mounts `review-desk/[runId]/_components/DecisionRail.tsx` + `SourceIndex.tsx` (D-13/D-14).
  - **Stage 1 (Story)** mounts `signal-desk/_components/SignalDeskScreen.tsx` (D-11).
- **D-08: Where a run-keyed view must be mounted issue-keyed, extract the mountable inner component rather than duplicate the page.** Exact extraction boundary is Claude's discretion during planning, but the goal is one canonical implementation per screen consumed by both any surviving legacy route and the new stage route.

### D. Stage 1 — provisional Signal Desk (the net-new issue-keying)

- **D-09: Signal Desk needs net-new issue-keying — it is the odd one out.** Unlike Review/Voice (which already have `/issues/[n]/…` wrappers), `SignalDeskScreen` is still keyed to "latest run for workspace" via `runs.latest` and has **no issue-keyed wrapper and no nav entry**. Phase 41 adds `issues/[issueNumber]/story/page.tsx` that resolves `issueNumber → runId` (via the Phase 40 resolver / `pipelineRuns.byIssueNumber`) and mounts `SignalDeskScreen` scoped to that run — **without rebuilding it** (full redesign is Phase 47).
- **D-10: Stage 1 gets the uniform frame treatment** — a stage tab with a live status mark and an outline presence — so tabs 1–5 are consistent and SC-7 holds ("a run that interrupts at charity selection can still be resolved from the Workspace"). The Gate 1 adjudication write path (`adjudicateGate1` via `lib/pipelineControlClient.ts`) is mounted as-is.

### E. Stage 3 — Fact Check interim (compose, not mount)

- **D-11: Stage 3 is a first-class placeholder, never a blank (WSP-07 discipline).** Fact Check has **no standalone screen today** — claim state lives inside the DecisionRail's `SourceIndex` over `claim_checks`. Phase 41's Stage-3 tab renders a labeled "Fact Check — arrives next / here's what's checked so far" surface that **composes the existing read-only `claim_checks` coverage** (via `convex/claimChecks.ts` `listByRunId` / `allSignedOff`, the same data `deriveFactCheckStage` already reads) rather than mounting a page. It must not show a fake "verified" state. Phase 42 replaces this surface with the real stage.
- **D-12: The publish gate's "Fact Check complete" term maps to the existing `facts-cleared` sign-off for this phase.** `ready = factDone && voiceDone && !held` where `factDone` = active `facts-cleared` `sign_offs` row (Phase 34 / DERIVED-STATE-CONTRACT §1). Phase 42 tightens "Fact Check complete" to real claim coverage; Phase 41 reuses the shipped gate unchanged. Unchecked-claim clicks in the Stage-2 galley (WSP-04) route to the Stage-3 tab.

### F. Stage 5 — Approval + decision-rail split + publish confirmation change

- **D-13: The decision rail moves from the galley to Stage 5.** `DecisionRail.tsx` (today rendered inside the Review Desk galley) is the home of the two sign-offs + the publish button; in the Workspace it **is** the Approval stage. Stage 2 (Draft) no longer renders the rail; Stage 5 renders it. Rail internals (blocking-item counts, editor memo, hook card, `SourceIndex` verification, `facts-cleared` + `sounds-human` sign-offs) are reused unchanged.
- **D-14: Stage 5 layout is blockers-first (WSP-05):** (1) Must fix / Review recommended / estimated review time with jump links, then (2) the readiness board (fact check, voice, hook + peg, organization verification, open decisions), then (3) the **agent editor's recommendation** — explicitly labeled as agent judgment. Reuse the rail's existing blockers-first ordering; add the readiness board and the recommendation block if not already present.
- **D-15: Publish drops typed confirmation; the two-sign-off gate is the safety** (milestone locked decision; PROJECT.md "only the typed-confirmation step is removed"). Replace typed confirmation with an **exact preview** (destination, title, time, consequences) + **one confirmation click**. The unlock condition (`Must fix = 0 ∧ Fact Check complete ∧ Voice approved current`) is written next to the disabled control. Do NOT touch typed confirmation elsewhere (it survives for Mark Do-not-use — not in this phase). Publish endpoint change goes through the existing write boundary; **amend `docs/API_CONTRACTS.md` first if the publish contract changes** (Ph35/38/39 contract-first pattern).
- **D-16: "editor" unqualified stays reserved for the human (SC-4, in scope this phase).** The agent's recommendation is labeled "Agent editor's recommendation." This specific label is load-bearing for Approval's meaning, so it ships in Phase 41; the broader console-wide nomenclature ripple stays in Phase 50.
- **D-17: Sign-off revocation stays exactly as Phase 34 built it** (milestone locked decision, DERIVED-STATE-CONTRACT §10). Port the prototype's sentence ("any later material prose change returns this to Review needed"), not its buggy wiring. No change to revocation here.

### G. Persistent issue outline (WSP-02)

- **D-18: The outline is section-level, persistent across all stages, derived from the Phase 40 stage/section state selector.** State vocabulary per section: **clean / review / must fix / changed since review / not generated** — each rendered label + icon (aligns with Phase 40 D-20 stage vocabulary + DERIVED-STATE-CONTRACT). Section identity reuses `lib/galley/sectionIdMap.ts` (`qaSectionToGalleyId`) and `SectionChipList.tsx`'s `EDITABLE_SECTIONS` — the closest existing outline/jump-nav primitives. Clicking a section jumps to it in the canvas (in Stage 2 Draft; from other stages, switch to Draft and scroll to the section).

### H. Collapsible context panel (WSP-03)

- **D-19: One shared collapsible panel shell** with a persistent "Hide panel" control; content is injected per stage — Stage 1 lead/org detail; Stage 2 open QA items + finding-on-selection; Stage 3 claim detail (placeholder over `claim_checks`); Stage 4 voice findings; Stage 5 the Decision log + readiness detail. Reuse the existing provenance/finding surfaces (`SourceIndex`, `ResolvedFindingsList`, `AnnotationMark` popovers). No shared collapsible primitive exists — build the shell once in the frame. Hidden-state persistence mechanism is Claude's discretion (localStorage vs an `issues`-adjacent field).

### I. Galley claim rendering + keyboard focus (WSP-04)

- **D-20: Reuse the shipped provenance rendering; add keyboard-focus parity and the Fact-Check click-through.** Checked claims = marigold-underlined, unchecked = rust-tinted already exists via `components/galley/ClaimMark.tsx` (`marks.claimSpan`) + `AnnotationMark.tsx` + `lib/galley/spanResolver.ts` + `app/globals.css` (`.galley-claim`, marigold tokens) from Phase 35. Phase 41 **ensures the source popover is reachable on keyboard focus as well as hover** (accessibility — WSP-04 says "on hover *and* keyboard focus") and wires unchecked-claim click → the Stage-3 tab (D-12). If focus parity is missing, add it; do not rebuild the mark components.

### J. "Not generated" first-class state (WSP-07)

- **D-21: A dedicated "Not generated" state in both canvas and outline**, driven by section-artifact absence (section not present in the Sanity draft). Canvas renders an Editor's-note-style block (not a blank); the outline renders the "— not generated" marker. Reuse `components/_PlaceholderScreen.tsx` styling conventions where useful.

### K. Nav + status marks (WSP-01)

- **D-22: Add a single "Issue Workspace" item to the Editorial nav group** in `lib/nav.ts`, linking to the in-progress issue's workspace (`/issues/[n]`) or `/issues` if none. Review Desk / Signal Desk / Voice Pass already left the nav in Phase 40 (D-31), so WSP-01's "replaces the three nav items" completes by adding this one entry. Rendered by the existing `components/AppSidebar.tsx` — no chrome rework.

### Claude's Discretion

- Exact extraction boundary when splitting run-keyed views (`ReviewDeskRunView`, `VoicePassRunView`) into frame-mountable inner components (D-08).
- Context-panel hidden-state persistence mechanism (D-19).
- Whether the Stage-3 placeholder shows read-only `claim_checks` coverage or a plainer "not yet available" note, provided it is never a blank/fake-verified state (D-11).
- Redirect mechanism for `/review` → `/draft` (route-level vs `next.config` rewrite) (D-06).
- Precise copy for the Stage-3 placeholder, the publish exact-preview, and the "Not generated" Editor's note.
- Whether the Draft passage toolbar shows disabled/stubbed "Inspect how this was made" + "Ask agent to revise" entry points (Phases 44/45) or omits them entirely for now.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Binding design spec (v4.0 milestone)
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — **§Issue Workspace (shared frame)** (three-part layout, persistent controls, tab marks, outline legend), **§Stage 1 Story & Brief**, **§Stage 2 Draft** (typography, claim marks, passage toolbar, "Not generated"), **§Stage 4 Voice Pass**, **§Stage 5 Approval** (blockers-first → readiness board → agent editor's recommendation; publish preview + one click), **§State model** (four state systems, label+icon rule), **§Nav**.
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — **§1** (`ready = factDone && voiceDone`; publish unlock = the Phase 34 two-sign-off gate, reuse `sign_offs`), **§4** (Fact Check counters — informs the Stage-3 placeholder + Phase 42), **§6** (role gating — the six actions; rendering-with-explanation is Phase 49, but read it so Phase 41's controls are structured for it), **§10** (known prototype bugs — do NOT port voice-revocation-on-revision; ours is correct).
- `docs/design/dispatch-control-v3/README.md` — **milestone locked decisions #2** (publish drops typed confirmation — exact preview + one click) and **#5** (sign-off revocation stays as Phase 34 built it); color semantics (every state label + icon, never color alone).

### Contracts & schema
- `docs/API_CONTRACTS.md` — **amend before code if the publish contract changes** (D-15). Contract-first is the established Ph35/38/39 pattern.
- `convex/schema.ts` + Convex functions the mounted screens read: `convex/signOffs.ts` (`record`, `revokeAll`, `activeByRunId`, `listByRunId`), `convex/claimChecks.ts` (`listByRunId`, `allSignedOff`, `setStatus`), `convex/issues.ts` (`byIssueNumber`, `ensureByNumber`, `hold`, `reopen`, `markPublished`, `lastVisitedStage`), `convex/pipelineRuns.ts` (`byIssueNumber` — issueNumber↔runId), `convex/qaCorrections.ts`, `convex/pitchLog.ts`, `convex/runs.ts` (`latest`).

### Project constraints
- `.planning/PROJECT.md` §Current Milestone — locked decisions (publish drops typed confirmation; sign-off revocation stays; "Agent editor's recommendation" nomenclature) and the reconciliation facts (**DO NOT REBUILD the publish gate / the design system**; the write boundary dashboard → pipeline API → Sanity → `audit_log`; RBAC unbuilt → Phase 49).

### Prior-phase context this phase builds on
- `.planning/phases/40-issue-entity-issues-home/40-CONTEXT.md` — **D-06** (stages are path segments; `/draft`, `/fact-check`), **D-07** (desks re-keyed as thin translations — recompose, don't rewrite), **D-09** (Workspace replaces `/issues/[n]` contents in place), **D-18/D-19/D-20** (derived status + stage states + `Not generated / In progress / Needs you / Clean` vocabulary), **D-21** (task projection Phase 43 renders as a screen), **D-23** (`lib/derivedState.ts` pure selector — consume it), **D-31** (nav restructure — three desks already left).
- `.planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md` — the native galley + span resolver mounted as Stage 2.
- `.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md` — Accept-fix wiring + the decision rail moved to Stage 5.
- `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md` — the two-sign-off gate reused unchanged (only typed confirmation removed).
- `.planning/phases/36-voice-pass-de-slop-screen/36-CONTEXT.md` — the Voice Pass screen + "Sounds human" sign-off mounted as Stage 4.
- `.planning/phases/37-run-monitor-v2-signal-desk/37-CONTEXT.md` — the Signal Desk candidate slate + Gate 1 adjudication mounted (net-new issue-keyed) as Stage 1.

</canonical_refs>

<code_context>
## Existing Code Insights

*(Console app: `apps/dispatch-control/`, Next.js App Router, route group `app/(dashboard)/`. No shared design-system package — primitives live in-app; `packages/shared` holds Sanity types only. Confirmed via codebase scan 2026-07-14.)*

### Reusable Assets
- **`lib/derivedState.ts`** — pure selectors `deriveIssueStatus`, `deriveStageStates` (5 `StageStateResult`s), `deriveTasks`, `estimateWorkMinutes`; `STAGE_LABELS = ['Story','Draft','Fact Check','Voice','Approval']`. **The tabs + outline + status marks consume this directly (D-02).**
- **`issues/_components/StageStrip.tsx`** — the 5-segment strip built to be the stage-tab visual (its header comment says so); exports `STAGE_STATE_LABELS`.
- **`lib/issueRouteResolver.ts`** — pure `parseIssueNumber`, `issueHref`, `issueReviewHref`, `issueVoiceHref`, `issueRunHref`, `legacyRedirectTarget`; extend with stage hrefs (D-06).
- **Galley:** `components/galley/Galley.tsx` (+ `GallerySection.tsx`, `ClaimMark.tsx` provenance wash, `AnnotationMark.tsx` finding underline/popover, `GalleryGameSlot.tsx`); `lib/galley/{spanResolver,findingState,sectionIdMap,axisPartition,syntheticPortableText,googleFontLoader}.ts`; typography in `app/globals.css` (`.galley-body`, `.galley-claim`, `.galley-anno`, marigold tokens).
- **Screen views to mount:** `review-desk/[runId]/ReviewDeskRunView.tsx` (+ `_components/{DecisionRail,SourceIndex,SectionChipList,BlockEditor,SectionEditorPanel,ResolvedFindingsList}.tsx`), `voice-pass/[runId]/VoicePassRunView.tsx` (named export `VoicePassScreen`, + `_components/VoicePassRail.tsx`), `signal-desk/_components/SignalDeskScreen.tsx` (+ `CandidateSlate.tsx`, `AdjudicationPanel.tsx`, `DecisionPanel.tsx`).
- **Data clients:** `lib/{signOffClient,reviewClient,voicePassClient,contentPatchClient,findingsClient,pipelineControlClient}.ts`.
- **Panel/badge patterns:** `ResolvedFindingsList.tsx` (collapsed disclosure), `prompt-lab/_components/EvalDrawer.tsx` (drawer), `registry/_components/CharityStatusBadge.tsx` (status badge), `components/_PlaceholderScreen.tsx` (placeholder styling for D-21).

### Established Patterns
- **Layout-based tab bar precedent:** `run-monitor/layout.tsx` (active tab via `usePathname`) — the pattern for the Workspace frame's stage tabs (no generic `Tabs` component exists; the frame tabs are new).
- **Route wrappers are thin issue→run param translations** (`issues/[issueNumber]/{review,voice}/page.tsx`); recompose their contents, don't rewrite the mounted views (Phase 40 D-07).
- **Write boundary:** every content mutation goes dashboard → pipeline API → Sanity, logged to `audit_log`; the publish-confirmation change (D-15) respects it.
- **Every state renders label + icon, never color alone** (design system rule).

### Integration Points
- **`app/(dashboard)/issues/[issueNumber]/page.tsx`** — Phase 40 overview → becomes redirect into the frame (D-03); its persistent concerns move into the frame controls.
- **`app/(dashboard)/issues/[issueNumber]/layout.tsx`** — **net-new**: the Workspace frame (D-01).
- **`app/(dashboard)/issues/[issueNumber]/{story,draft,fact-check,voice,approval}/page.tsx`** — stage routes (`review`→`draft` rename; `story`/`fact-check`/`approval` new) (D-05/D-06).
- **`lib/nav.ts`** — add "Issue Workspace" to the Editorial group (D-22).
- **`components/Masthead.tsx` + `components/AwaitingYouInbox.tsx`** — reconcile the cross-screen "awaiting-you" aggregation with the Workspace's task/outline surfaces (Phase 40 D-25 kept the inbox; verify no double-source-of-truth).

### Two watch-items (net-new work inside a reuse-only phase)
1. **Stage 1 (Signal Desk)** has no `/issues/[n]/…` wrapper and is keyed to `runs.latest` — needs net-new issue-keying (D-09), unlike Review/Voice which already have wrappers.
2. **Stage 3 (Fact Check)** has no standalone screen — its data lives inside the DecisionRail's `SourceIndex` over `claim_checks`. The Stage-3 tab **composes** that read-only data as a placeholder (D-11), not a page mount; the real stage is Phase 42.

</code_context>

<specifics>
## Specific Ideas

- The demo path the whole frame must support live (Annotations header): My Tasks → resolve an unsupported statistic → Fact Check claim detail → *Ask agent for better evidence* → *Confirm* → Draft: select the founder phrase → *Ask agent to revise* → apply → Voice Pass → *Approve the Voice Pass* → Approval → *Publish* (exact preview → confirm), with header status, task counts, stage tabs, and publish lock all updating live. Phase 41 delivers the **frame + Stages 1/2/4/5 + the live status/tab/publish-lock wiring**; the Fact-Check leg and the revise/evidence verbs arrive in Phases 42/45.
- Routine weekly approval is "deliberately not scary" — the publish exact-preview + one click is the whole point of dropping typed confirmation (README #2).

</specifics>

<deferred>
## Deferred Ideas

- **Stage 3 Fact Check (the real stage)** — Phase 42 (this phase ships only the first-class placeholder).
- **My Tasks screen** — Phase 43 (the derived projection already exists, Phase 40 D-21; Phase 41 renders `.length`-style marks, not the screen).
- **"Inspect how this was made" panel + "Ask agent to revise" / "Ask agent for better evidence"** — Phases 44/45 (the Draft passage toolbar's Inspect/Revise entry points are stubbed or omitted in Phase 41).
- **Full Story & Brief redesign** — Phase 47 (replaces the provisional Signal Desk Stage 1 mounted here).
- **Role/permission gating of the six actions (locked-control rendering)** — Phase 49 (Phase 41 builds the actions for the editor; structure them so 49 can wrap them).
- **Console-wide nomenclature ripple** (Run Monitor → Run Details, etc.) — Phase 50 (except the "Agent editor's recommendation" label required by SC-4, shipped here).

### Reviewed Todos (not folded)
None — `todo match-phase 41` returned zero matches.

</deferred>

---

*Phase: 41-issue-workspace-frame*
*Context gathered: 2026-07-14*
