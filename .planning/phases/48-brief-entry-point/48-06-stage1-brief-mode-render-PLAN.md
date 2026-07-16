---
phase: 48-brief-entry-point
plan: 06
type: execute
wave: 2
depends_on: ["48-01", "48-02"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefOrgCard.tsx
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx
autonomous: true
requirements: [ENT-01, ENT-03, ENT-04]

must_haves:
  truths:
    - "The workspace context exposes runRow.entryMode as ws.entryMode ('discovery' | 'brief' | undefined→discovery)"
    - "A brief-started Stage 1 renders the human org + its verification record (never 'No organization options yet')"
    - "The human org's main concern / verification status is always visible, never truncated (Phase 37/47 discipline)"
    - "A brief-started Stage 1 does NOT show the misleading 'No leads yet.' copy"
    - "Discovery-mode Stage 1 (leads slate + OrgOptionSlate + NeedsYourDecisionCard) is unchanged"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
      provides: "entryMode threaded onto the workspace context value"
      contains: "entryMode"
    - path: "apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefOrgCard.tsx"
      provides: "brief-mode single-org card reading the human org's VerificationRecord"
      contains: "BriefOrgCard"
    - path: "apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx"
      provides: "entryMode === 'brief' branch (BriefOrgCard instead of OrgOptionSlate + leads copy)"
      contains: "entryMode"
  key_links:
    - from: "apps/dispatch-control/.../story-brief/_components/BriefOrgCard.tsx"
      to: "ws.verificationRecords (the single human-org record)"
      via: "reads verificationRecords[0].candidateName + check fields"
      pattern: "verificationRecords"
    - from: "apps/dispatch-control/.../WorkspaceStateProvider.tsx"
      to: "convex runs.entryMode"
      via: "runRow?.entryMode → ws.entryMode"
      pattern: "runRow?.entryMode"
---

<objective>
Close the real under-scope the CONTEXT missed (RESEARCH Pattern 4): Phase 47's `StoryBriefScreen`/`OrgOptionSlate` are wired entirely off `story_leads` (Signal Editor) + `pitchLog` (Scout) — both permanently empty for a brief run — so a brief-started issue's Stage 1 silently shows "No leads yet" / "No organization options yet", hiding the human org and its verification record even though both exist in Convex. This directly defeats D-11's "surface its concerns prominently in Stage 1's org card." Add a small `entryMode`-aware brief-mode variant: expose `runs.entryMode` on the workspace context, add a `BriefOrgCard` reading the single human-org VerificationRecord, and branch `StoryBriefScreen` for brief runs. (ENT-01: the brief path lands at a MEANINGFUL Stage 1; ENT-03: Stage 1 legitimately differs while Stages 2-5 stay identical; ENT-04: the persisted verification record becomes visible.)

Purpose: turn the `StoryBriefScreen` brief-mode scaffold (48-02) green.
Output: `ws.entryMode` + `BriefOrgCard.tsx` + the StoryBriefScreen brief branch.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-brief-entry-point/48-RESEARCH.md
@apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
@apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx
@apps/dispatch-control/app/(dashboard)/story-brief/_components/OrgOptionSlate.tsx

<interfaces>
<!-- Exact current shapes. BriefOrgCard reuses OrgOptionSlate's never-truncated rendering discipline. -->

WorkspaceStateProvider already subscribes `const runRow = useQuery(api.runs.byRunId, runId ? {runId}
: 'skip')` (L148) and already exposes `verificationRecords: Doc<'verification_records'>[] | undefined`
and `brief: Doc<'briefs'> | null | undefined` on `WorkspaceStateValue` (L110-112). It also threads
`runRow?.status` / `runRow?.completedAt` into derivation (L213-218). `entryMode` is added the SAME way.

VerificationRecordRow shape (from OrgOptionSlate.tsx L45-57) — the single record BriefOrgCard renders:
`{ candidateId, candidateName, domainLive, registrationId?, registrationVerified, pressHits,
obscurityVerdict, status: 'pass'|'fail'|'unverified', killed, killReason?, checkedAt }`.
`formatCheckedAt(ms)` (OrgOptionSlate L64-71) is the date-format helper to reuse/copy.

StoryBriefScreen.tsx: the "Leads" `<section>` (L222-243) renders `"No leads yet."` when
`storyLeadsTyped.length === 0`; `<OrgOptionSlate />` is mounted at L245; `NeedsYourDecisionCard`
at L247-254 is gated on `isPausedAtGate1` (never true for brief runs — editor_gate_1 never runs);
the Brief `<section>` (L256-274) reads only `ws.brief` and is ALREADY correct for brief runs.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Thread runRow.entryMode onto the workspace context value</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (WorkspaceStateValue interface + the value object + the existing runRow subscription L148)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Pattern 4" step 1-2 (~L285-287) and §"Pitfall 3" (~L318-322)
  </read_first>
  <action>
    In `WorkspaceStateValue`, add `entryMode: 'discovery' | 'brief' | undefined` with a doc comment: absent/undefined = treat as 'discovery' (mirrors the schema default; runRow may be loading). In the provider body, derive it from the ALREADY-subscribed `runRow`: `const entryMode = (runRow?.entryMode as 'discovery' | 'brief' | undefined) ?? undefined`. Add `entryMode` to the `value: WorkspaceStateValue` object (alongside `storyLeads`/`verificationRecords`/`brief`). Do NOT add a new `useQuery` — reuse `runRow`.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep "entryMode" apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` matches in BOTH the `WorkspaceStateValue` interface and the `value` object.
    - `grep "runRow?.entryMode" apps/dispatch-control/.../WorkspaceStateProvider.tsx` matches.
    - No new `useQuery` call was added for entryMode (reuses `runRow`).
    - `pnpm --filter dispatch-control build` compiles the provider (no type error on the new field).
  </acceptance_criteria>
  <done>`useWorkspaceState().entryMode` is available to every Stage-1 consumer, sourced from the existing runRow subscription. (ENT-01/ENT-03 plumbing.)</done>
</task>

<task type="auto">
  <name>Task 2: Add BriefOrgCard.tsx — the single human-org card reading its VerificationRecord</name>
  <files>apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefOrgCard.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/story-brief/_components/OrgOptionSlate.tsx (the never-truncated per-item render + formatCheckedAt + VerificationRecordRow type to reuse)
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (ws.verificationRecords / ws.entryMode / ws.brief the card reads)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Pattern 4" step 3 (~L288-291) and §"Open Questions" #3 (~L432-435, separate component chosen)
  </read_first>
  <action>
    Create `apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefOrgCard.tsx` (a `'use client'` component). It reads `const { verificationRecords } = useWorkspaceState()`. A brief run seeds `candidates=[human org]`, so `verify_candidates` persists EXACTLY ONE record — the card renders that single record (its `candidateName` IS the org name; no need to expose `winning_charity`). Render states:
      - `verificationRecords === undefined` → "Loading the organization you supplied…".
      - `verificationRecords.length === 0` → "Verifying the organization you supplied…" (verify_candidates runs early — this window is brief; honest, not an error).
      - else → a card for `verificationRecords[0]`: the org name (`candidateName`) as heading; a verification-with-dates line copying OrgOptionSlate's exact wording ("Checked {formatCheckedAt(checkedAt)} — domain {live/not live}, registration {verified/unverified}, {pressHits} press hit(s) ({obscurityVerdict})"); a prior-coverage-style note if `killed` (surface `killReason` prominently — this is the advisory concern D-11 wants visible, and it must NEVER remove the org or halt: it is shown, the run continues); and a "Main concern" block ALWAYS visible, rendered IN FULL, never clamped/ellipsised (reuse OrgOptionSlate's `border-t ... text-[color:var(--color-vermilion)]` treatment) — its text is `killReason` when killed, else a status line ("Verification: {status}"). Copy `formatCheckedAt` (or import if it's exported) and the `VerificationRecordRow` type from OrgOptionSlate. Add `data-testid` attributes so the StoryBriefScreen test can assert the org name + verification line render.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefOrgCard.tsx` exists and exports `BriefOrgCard`.
    - `grep "verificationRecords" apps/dispatch-control/.../BriefOrgCard.tsx` matches (reads the single record).
    - `grep -i "main concern\|primaryConcern\|killReason" apps/dispatch-control/.../BriefOrgCard.tsx` matches (always-visible concern).
    - No clamp/`line-clamp`/`truncate`/`ellipsis` utility class appears anywhere in the file.
    - `pnpm --filter dispatch-control build` compiles BriefOrgCard.
  </acceptance_criteria>
  <done>The human org and its persisted verification record are rendered — with its concern always visible and never truncated — so ENT-04's "record never absent" is also never invisible in the console. (ENT-04.)</done>
</task>

<task type="auto">
  <name>Task 3: Branch StoryBriefScreen on entryMode === 'brief'</name>
  <files>apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx (the Leads section L222-243, OrgOptionSlate mount L245, NeedsYourDecisionCard L247-254, Brief section L256-274)
    - apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx (the brief-mode assertions this task must satisfy)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Pattern 4" step 3 (~L288-291)
  </read_first>
  <action>
    Read `const isBrief = ws.entryMode === 'brief'` near the top of the render. Then, WITHOUT touching the discovery path:
      - Leads `<section>`: when `isBrief`, replace the `"No leads yet."` empty-copy branch with a short explanatory line — "Started from a hand-authored brief — no story leads." (only when there are genuinely no leads, which is always true for brief runs). Do NOT alter the discovery leads rendering.
      - Replace `<OrgOptionSlate />` (L245) with `{isBrief ? <BriefOrgCard /> : <OrgOptionSlate />}` (import `BriefOrgCard` from `./BriefOrgCard`).
      - Leave `NeedsYourDecisionCard` (already correctly suppressed for brief runs since `isPausedAtGate1` is never true), the Brief `<section>` (already correct — reads `ws.brief` which Pattern 2 populates at intake), and `BriefFieldTable`/`BriefFieldStrengthen` UNTOUCHED.
    Do NOT alter the Empty/Loading/Error early-return states (they apply to both modes). The result: a brief-started Stage 1 shows the hand-authored Brief (editable + strengthen) + the human org's verification card, and never the misleading discovery empty-copy.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- StoryBriefScreen</automated>
  </verify>
  <acceptance_criteria>
    - `grep "ws.entryMode === 'brief'\|isBrief" apps/dispatch-control/.../StoryBriefScreen.tsx` matches.
    - `grep "BriefOrgCard" apps/dispatch-control/.../StoryBriefScreen.tsx` matches (imported + conditionally rendered).
    - `grep "hand-authored brief" apps/dispatch-control/.../StoryBriefScreen.tsx` matches (the brief-mode leads copy).
    - `pnpm --filter dispatch-control test:unit -- StoryBriefScreen` exits 0 — the brief-mode render case asserts no "No leads yet."/"No organization options yet", and the human org name + verification line render; the discovery-mode cases still pass.
  </acceptance_criteria>
  <done>A brief-started Stage 1 renders meaningfully (hand-authored Brief + verified human org, concern visible); discovery Stage 1 is unchanged. (ENT-01/ENT-03/ENT-04.)</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit -- StoryBriefScreen` green.
- `pnpm --filter dispatch-control build` compiles (strict) — no type error from `ws.entryMode` / `Doc<'runs'>.entryMode` (requires 48-01's live-synced schema so the generated Doc type carries entryMode).
- Discovery-mode Stage 1 (leads slate, OrgOptionSlate, NeedsYourDecisionCard) is byte-unchanged.
</verification>

<success_criteria>
Both Create paths land at a meaningful Stage 1: a brief-started issue shows its hand-authored editable Brief and the human organization with its (never-absent, never-truncated) verification record, instead of the misleading discovery empty-copy — while Stages 2-5 and the discovery Stage 1 are untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/48-brief-entry-point/48-06-SUMMARY.md`
</output>
