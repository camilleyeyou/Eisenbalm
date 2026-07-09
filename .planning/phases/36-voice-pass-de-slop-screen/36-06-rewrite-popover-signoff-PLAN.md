---
phase: 36-voice-pass-de-slop-screen
plan: 06
type: execute
wave: 4
depends_on: [36-02, 36-03, 36-04]
files_modified:
  - apps/dispatch-control/components/galley/AnnotationMark.tsx
  - apps/dispatch-control/lib/findingsClient.ts
  - apps/dispatch-control/lib/voicePassClient.ts
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx
  - apps/dispatch-control/__tests__/AnnotationMark.test.tsx
  - apps/dispatch-control/__tests__/VoicePassRail.test.tsx
autonomous: true
requirements: [VOX-02, VOX-03]
must_haves:
  truths:
    - "Clicking a voice tell shows the as-written span vs a suggested house-voice rewrite with Accept rewrite / Write my own / Keep (not a tell)"
    - "Accept rewrite on a rule-only tell (no stored fix) fetches a rewrite via voice-rewrite then applies it via accept + suggestedFixOverride"
    - "The 'Sounds human' control is disabled until zero open voice-axis error findings remain and 409s server-side otherwise"
    - "Signing 'Sounds human' writes sign_offs kind='sounds-human' and DecisionRail shows the earned green"
  artifacts:
    - path: "apps/dispatch-control/components/galley/AnnotationMark.tsx"
      provides: "voice-tell variant (labels + rewrite-on-accept)"
      contains: "labels"
    - path: "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx"
      provides: "machine-tells list + voice-law reference + Sounds-human sign-off"
      contains: "sounds-human"
  key_links:
    - from: "AnnotationMark Accept rewrite"
      to: "voice-rewrite → accept with suggestedFixOverride"
      via: "voicePassClient.rewrite then acceptFinding({suggestedFixOverride})"
      pattern: "suggestedFixOverride"
    - from: "VoicePassRail Sounds-human button"
      to: "POST /issues/{runId}/sign-off {kind:'sounds-human'}"
      via: "recordSignOff(token, runId, 'sounds-human')"
      pattern: "sounds-human"
    - from: "VoicePassRail disabled state"
      to: "open voice-axis error findings"
      via: "VOICE_AXES-scoped blocker count (client mirror of §36.7)"
      pattern: "VOICE_AXES"
---

<objective>
Complete Voice Pass's interaction layer: the VOX-02 rewrite popover and the VOX-03 "Sounds human" sign-off. Give `AnnotationMark` a voice-tell presentation variant (as-written span vs suggested house voice; Accept rewrite / Write my own / Keep (not a tell)) that reuses the Phase 33 accept/dismiss endpoints plus the 36-03 voice-rewrite + suggestedFixOverride path (D-08/D-09/D-10). Build the Voice Pass right rail: the machine-tells list, a reference to the voice law, and the "Sounds human" sign-off control gated on zero open voice-axis errors (client mirror of the §36.7 server gate) writing `sign_offs kind='sounds-human'` — the green DecisionRail already reflects.

Purpose: VOX-02 (rewrite via content-patch) and VOX-03 (independent voice sign-off feeding PUB-01). Mechanically identical to the factual side — no new mutation path, no special-casing.
Output: AnnotationMark voice variant; `findingsClient` + `voicePassClient` rewrite plumbing; `VoicePassRail`; mounted on the screen; tests + strict build.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-voice-pass-de-slop-screen/36-RESEARCH.md
@apps/dispatch-control/components/galley/AnnotationMark.tsx
@apps/dispatch-control/lib/findingsClient.ts
@apps/dispatch-control/lib/signOffClient.ts
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
@apps/dispatch-control/lib/galley/axisPartition.ts
@apps/dispatch-control/lib/galley/findingState.ts

<interfaces>
<!-- AnnotationMark (post-36-04 promotion, components/galley/AnnotationMark.tsx): already renders the
     underline + popover with axis/severity/reason/suggestedFix and an Accept fix / Edit inline /
     Dismiss action row wired to findingsClient (handleAccept, handleDismissSubmit). D-10 needs
     different LABELS + a rewrite-on-accept path, NOT new mechanics. -->
```tsx
interface AnnotationMarkProps { value: AnnotationMarkDef; children; runId?; sectionId?; revisionId?;
  reloadDraft?: () => Promise<void>|void; onEditSection?: (sectionId, findingId?) => void;
  labels?: { accept?: string; editInline?: string; dismiss?: string; dismissReasonDefault?: string } }
```
<!-- findingsClient.acceptFinding(runId, findingId, { ifRevisionID }, token) — extend payload with optional
     suggestedFixOverride?: string (server §36.6 already accepts it). -->
<!-- signOffClient.recordSignOff(token, runId, 'sounds-human') already exists; on §36.7 409 it throws
     SignOffApiError with reason 'open_voice_findings' (surface the message). -->
<!-- DecisionRail already reads api.signOffs.activeByRunId and renders the sounds-human green when active —
     NO DecisionRail change needed; it reflects automatically once the row is written. -->
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: AnnotationMark voice-tell variant + rewrite-on-accept plumbing</name>
  <read_first>
    - apps/dispatch-control/components/galley/AnnotationMark.tsx (handleAccept at ~133-153, the popover action row at ~204-243, the "Suggested:" line at ~198-202)
    - apps/dispatch-control/lib/findingsClient.ts (acceptFinding signature + FindingsError reasons)
    - apps/dispatch-control/lib/voicePassClient.ts (36-04's recheck; add rewrite here)
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx (existing accept/dismiss test patterns)
    - docs/API_CONTRACTS.md §36.5 + §36.6
  </read_first>
  <behavior>
    - Test 1: with `labels={{accept:'Accept rewrite', editInline:'Write my own', dismiss:'Keep (not a tell)'}}` the popover renders those exact button labels (not "Accept fix"/"Edit inline"/"Dismiss").
    - Test 2: Accept rewrite on a finding WITH a stored `suggestedFix` calls `acceptFinding(runId, id, { ifRevisionID, suggestedFixOverride: undefined }, token)` (uses stored fix).
    - Test 3: Accept rewrite on a finding with NO `suggestedFix` first calls `voicePassClient.rewrite(runId, id, token)` → then `acceptFinding(runId, id, { ifRevisionID, suggestedFixOverride: '<rewrite>' }, token)`.
    - Test 4: "Keep (not a tell)" submits dismiss with reason "not a tell" (prefilled from `labels.dismissReasonDefault`).
  </behavior>
  <action>
    1. `lib/findingsClient.ts`: extend `acceptFinding`'s `payload` param type to `{ ifRevisionID: string; suggestedFixOverride?: string }` and forward it in the POST body (server §36.6 accepts the field).
    2. `lib/voicePassClient.ts`: add `export async function rewrite(runId, findingId, token): Promise<{ findingId: string; suggestedFix: string }>` → `POST /issues/{runId}/voice-rewrite` body `{ findingId }`.
    3. `components/galley/AnnotationMark.tsx`: add `labels?: { accept?; editInline?; dismiss?; dismissReasonDefault? }` to props (default to today's 'Accept fix'/'Edit inline'/'Dismiss'/'' so Review Desk is unchanged). Use `labels.accept ?? 'Accept fix'` etc. for the button text. Relabel the popover's `Suggested:` line to `labels.accept === 'Accept rewrite' ? 'Suggested house voice:' : 'Suggested:'` (D-10 as-written-vs-suggested framing without a separate diff panel). In `handleAccept`: if `!value.suggestedFix`, first `const { suggestedFix } = await voicePassClient.rewrite(runId, value.findingId, await getToken())`, then `acceptFinding(runId, value.findingId, { ifRevisionID: revisionId, suggestedFixOverride: suggestedFix }, token)`; else keep the current stored-fix path. Prefill the dismiss input from `labels.dismissReasonDefault` when `dismissing` opens. Guard: the "Accept unavailable — no suggested fix" message should NOT show in voice mode (rewrite-on-demand covers it) — condition it on `labels.accept !== 'Accept rewrite'`.
    4. Extend `__tests__/AnnotationMark.test.tsx` with the four behavior tests (mock `@/lib/voicePassClient`).
  </action>
  <acceptance_criteria>
    - `grep -q "labels" apps/dispatch-control/components/galley/AnnotationMark.tsx`
    - `grep -q "suggestedFixOverride" apps/dispatch-control/components/galley/AnnotationMark.tsx`
    - `grep -q "suggestedFixOverride" apps/dispatch-control/lib/findingsClient.ts`
    - `grep -Eq "voice-rewrite|rewrite" apps/dispatch-control/lib/voicePassClient.ts`
    - `grep -q "Accept rewrite" apps/dispatch-control/__tests__/AnnotationMark.test.tsx`
    - `cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx</automated>
  </verify>
  <done>The voice-tell popover shows as-written vs suggested house voice with the three voice labels; Accept rewrite generates-then-applies via voice-rewrite + suggestedFixOverride for rule-only tells; Review Desk's default labels/behavior are unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: VoicePassRail — machine-tells list + Sounds-human sign-off (server-gated)</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (the Sign-offs section at ~365-399 + handleSignOff + activeByRunId subscription — mirror the sign-off UI)
    - apps/dispatch-control/lib/signOffClient.ts (recordSignOff + SignOffApiError reasons incl. 'open_voice_findings')
    - apps/dispatch-control/lib/galley/axisPartition.ts (VOICE_AXES) + lib/galley/findingState.ts (isOpenFinding)
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx (36-04's screen — where to mount the rail)
    - docs/API_CONTRACTS.md §36.7 (the sounds-human 409 shape the client mirrors)
  </read_first>
  <behavior>
    - Test 1: given 1 open `severity:'error'`, `axis:'machine-tell'` finding, the "Sounds human" button is DISABLED and a reason line shows the open-voice-tell count.
    - Test 2: with zero open voice-axis errors, the button is enabled; clicking calls `recordSignOff(token, runId, 'sounds-human')`.
    - Test 3: when `activeByRunId` reports `sounds-human` active, the rail shows the green "Sounds human — signed …" state (no button).
    - Test 4: a `SignOffApiError` with reason `'open_voice_findings'` surfaces its message (belt-and-suspenders with the disabled state).
  </behavior>
  <action>
    1. Create `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx` (Client Component, `runId` prop). Subscribe `useQuery(api.qaCorrections.byRunId,{runId})` → `isOpenFinding` → scope to `VOICE_AXES` → `voiceBlockers = open voice-axis errors`, `voiceWarnings`, and a machine-tell subset. Render: (a) a "Machine-tells" list (jump-link rows per open voice finding, mirroring DecisionRail's blocking-items list), (b) a "Voice law" line that REFERENCES `voice_constraints` (a short pointer/link, NOT a restatement — per the design's "reference to voice_constraints, not a restatement"), (c) a **Sign-offs** block mirroring DecisionRail: subscribe `api.signOffs.activeByRunId`; if `sounds-human` active show the green signed state; else a "Sign: Sounds human" button `disabled={voiceBlockers.length > 0 || busy}` calling `recordSignOff(await getToken(), runId, 'sounds-human')`, surfacing `SignOffApiError.message` (incl. `open_voice_findings`). Show a reason line when disabled ("N voice tell(s) to clear").
    2. Mount `<VoicePassRail runId={runId} />` in `voice-pass/[runId]/page.tsx` (right column, mirror the Review Desk galley+rail two-column layout).
    3. Create `apps/dispatch-control/__tests__/VoicePassRail.test.tsx` (mock convex/react useQuery + @clerk/nextjs + @/lib/signOffClient) with the four behavior tests.
    4. NO DecisionRail change: it already reads `api.signOffs.activeByRunId` and renders the sounds-human green once the row exists — add a one-line comment in the plan SUMMARY confirming this (do not edit DecisionRail).
  </action>
  <acceptance_criteria>
    - `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx` exists
    - `grep -q "sounds-human" apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx`
    - `grep -q "VOICE_AXES" apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx`
    - `grep -q "VoicePassRail" "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"`
    - `apps/dispatch-control/__tests__/VoicePassRail.test.tsx` exists
    - `cd apps/dispatch-control && npx vitest run __tests__/VoicePassRail.test.tsx` exits 0
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/VoicePassRail.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <done>The Voice Pass rail lists machine-tells, references the voice law, and carries a server-gated "Sounds human" sign-off; signing writes sign_offs kind='sounds-human' which DecisionRail reflects as the second green required for Publish (PUB-01).</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run` full suite green.
- `pnpm --filter dispatch-control build` exits 0.
- End-to-end (manual, per 36-VALIDATION.md): sign "Facts cleared" on Review Desk + "Sounds human" on Voice Pass; confirm both greens are independent and Publish requires both.
- Reconciliation note (Phase 35 lesson / Pitfall 7): final Wave — ensure this lands on master after 36-04's promotion is already merged (this plan edits the promoted `components/galley/AnnotationMark.tsx` and the 36-04 screen).
</verification>

<success_criteria>
VOX-02 (rewrite via content-patch, three voice actions) and VOX-03 (independent server-gated "Sounds human" sign-off feeding the two-green Publish gate) are complete and tested; the factual and voice sign-offs are earned on their own screens and both required to publish.
</success_criteria>

<output>
After completion, create `.planning/phases/36-voice-pass-de-slop-screen/36-06-SUMMARY.md`.
</output>
