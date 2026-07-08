---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 06
type: execute
wave: 3
depends_on: [34-02, 34-03]
files_modified:
  - apps/dispatch-control/lib/signOffClient.ts
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/studio/sanity.config.ts
  - apps/studio/README.md
  - apps/studio/EDITOR_GUIDE.md
autonomous: true
requirements: [PUB-01, PUB-03, PUB-04]

must_haves:
  truths:
    - "The decision rail shows two sign-off controls (Facts cleared + Sounds human) that record via the pipeline sign-off endpoint and reflect live active/revoked state"
    - "The Publish button is disabled until BOTH sign-offs are active (client courtesy; server still enforces)"
    - "Sanity Studio's publish action for weeklyIssue is removed when SANITY_STUDIO_DISABLE_PUBLISH='true', present otherwise"
    - "Studio is documented as a read-only fallback with a soak-end criterion"
  artifacts:
    - path: "apps/dispatch-control/lib/signOffClient.ts"
      provides: "recordSignOff client for POST /issues/{runId}/sign-off"
      exports: ["recordSignOff"]
    - path: "apps/studio/sanity.config.ts"
      provides: "flag-gated document.actions publish removal for weeklyIssue"
      contains: "SANITY_STUDIO_DISABLE_PUBLISH"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"
      to: "api.signOffs.activeByRunId"
      via: "useQuery live sign-off subscription"
      pattern: "signOffs.activeByRunId"
    - from: "apps/dispatch-control/lib/signOffClient.ts"
      to: "/issues/{runId}/sign-off"
      via: "POST fetch"
      pattern: "/sign-off"
---

<objective>
Ship the operator surface + Studio retirement: a `signOffClient.ts` (mirrors `reviewClient.ts`), two sign-off controls in the Phase 33 `DecisionRail` that record via the pipeline and reflect live active/revoked state, a Publish button gated on both greens, a flag-gated Sanity `document.actions` override that removes the `weeklyIssue` publish action, and read-only-fallback + soak-criterion documentation.

Purpose: Give Andrew the affirmative "signed, Nm ago" attestation controls (never blank), wire Publish to both greens, and stage the visible Studio publish-button removal behind a soak flag while the webhook (34-04) already protects the truth.
Output: One new client + rail edits + Studio config + two docs. (PUB-03's flag-flip verification is manual UAT — the code + build are automated here.)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md
@.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Existing client + rail + Studio primitives to mirror. -->
From apps/dispatch-control/lib/reviewClient.ts (mirror this exact shape for signOffClient.ts):
```typescript
function pipelineBaseUrl(): string  // reads NEXT_PUBLIC_PIPELINE_URL, throws if unset, strips trailing slash
export class ReviewApiError extends Error { constructor(status:number, reason:string, message:string) }
async function _reviewFetch<T>(path, token, body?): Promise<T>  // POST + Bearer token + typed 4xx {reason,message}
export async function publishIssue(token, runId): Promise<PublishIssueResult>
```
From DecisionRail.tsx (Phase 33 — the rail this plan extends; existing pattern):
```typescript
import { useAuth } from '@clerk/nextjs'; import { useQuery } from 'convex/react'; import { api } from '@convex/_generated/api'
import { publishIssue, rejectIssue, ReviewApiError } from '@/lib/reviewClient'
const rawFindings = (useQuery(api.qaCorrections.byRunId, { runId }) ...) ?? []
const blockers = openFindings.filter(f => f.severity === 'error')
// Publish button currently: disabled={blockers.length > 0 || busy}
// formatAgo(ts) helper + MICRO_LABEL class already exist in the file
```
New Convex query available (34-02): api.signOffs.activeByRunId({ runId }) -> { 'facts-cleared'?: {actorId, signedAt}, 'sounds-human'?: {actorId, signedAt} }
New pipeline endpoint (34-03): POST /issues/{runId}/sign-off  body {kind:"facts-cleared"|"sounds-human"} -> {runId, kind, signedAt}; 409 reasons: missing_signoffs, claims_not_signed_off, open_error_findings.
From apps/studio/sanity.config.ts (vanilla — add document.actions):
```typescript
export default defineConfig({ name:'eisenbalm-dispatch', projectId, dataset, plugins:[structureTool(), visionTool()], schema:{ types: schemaTypes } })
```
Sanity document.actions API (verified §34.9): document:{ actions:(prev, context) => flag && context.schemaType==='weeklyIssue' ? prev.filter(({action})=>action!=='publish') : prev }
Frontend strict build (MANDATORY per STATE memory — vitest does NOT type-check): pnpm --filter dispatch-control build
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: signOffClient.ts + DecisionRail sign-off controls + both-greens Publish gate</name>
  <read_first>
    - apps/dispatch-control/lib/reviewClient.ts (the FULL module — clone pipelineBaseUrl, the typed error class, _reviewFetch, and the exported fn shape)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (the FULL component — you add a Sign-offs section and change the Publish `disabled` condition; reuse useAuth/useQuery/formatAgo/MICRO_LABEL already in the file)
    - docs/API_CONTRACTS.md §34.2 (activeByRunId return shape) + §34.3 (sign-off endpoint body + 409 reasons)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx (adjacent rail sub-component for style consistency, if present)
  </read_first>
  <action>
1. Create `apps/dispatch-control/lib/signOffClient.ts` mirroring reviewClient.ts: reimplement the private `pipelineBaseUrl()` (reads `NEXT_PUBLIC_PIPELINE_URL`, throws if unset, strips trailing slash), export a `SignOffApiError extends Error` (fields `status`, `reason`, `message`) and a private `_signOffFetch<T>(path, token, body?)` POST helper that surfaces typed 4xx `{reason, message}` (identical body to reviewClient's `_reviewFetch`). Export:
```typescript
export type SignOffKind = 'facts-cleared' | 'sounds-human'
export interface RecordSignOffResult { runId: string; kind: SignOffKind; signedAt: number }
export async function recordSignOff(token: string | null, runId: string, kind: SignOffKind): Promise<RecordSignOffResult> {
  return _signOffFetch<RecordSignOffResult>(`/issues/${encodeURIComponent(runId)}/sign-off`, token, { kind })
}
```

2. In `DecisionRail.tsx`:
   - Add a live subscription: `const active = useQuery(api.signOffs.activeByRunId, { runId }) as Record<string, { actorId: string; signedAt: number }> | undefined`. Derive `const factsActive = !!active?.['facts-cleared']` and `const humanActive = !!active?.['sounds-human']`.
   - Add a new rail section (place it just before the Actions section, after Verification) titled with the existing `MICRO_LABEL` "Sign-offs". Render TWO rows, one per kind. Each row (affirmative state, never blank — D-13 convention):
     - active → green line "Facts cleared — signed {formatAgo(active['facts-cleared'].signedAt)}" (and same for Sounds human), using `--color-green`.
     - not active → a `min-h-[44px]` button "Sign: Facts cleared" / "Sign: Sounds human" that calls `handleSignOff('facts-cleared')` / `('sounds-human')`.
     - The Facts-cleared button is additionally `disabled` while `blockers.length > 0` (client courtesy — the server still 409s `claims_not_signed_off`/`open_error_findings` at record time; surface those messages).
   - Add `handleSignOff(kind)`: sets busy, `const token = await getToken()`, `await recordSignOff(token, runId, kind)`, sets a status message; on error use `e instanceof SignOffApiError ? e.message : ...`. Import `{ recordSignOff, SignOffApiError }` from `@/lib/signOffClient`.
   - Change the Publish button `disabled` condition from `blockers.length > 0 || busy` to `blockers.length > 0 || !factsActive || !humanActive || busy`, and update the visible reason under it: when blockers remain show the existing blocker reason; else when a sign-off is missing show e.g. "Both sign-offs required to publish." (never leave the operator without a reason).
   - The existing `handlePublish` already surfaces `ReviewApiError.message` — ensure the new `missing_signoffs` 409 message shows through (no change needed if it already renders `e.message`).
Run the mandatory strict build after edits.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build` exits 0 (strict type-check passes — vitest does not type-check)
    - `grep -q "export async function recordSignOff" apps/dispatch-control/lib/signOffClient.ts` succeeds
    - `grep -q "/sign-off" apps/dispatch-control/lib/signOffClient.ts` and `grep -q "NEXT_PUBLIC_PIPELINE_URL" apps/dispatch-control/lib/signOffClient.ts` succeed
    - `grep -q "signOffs.activeByRunId" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"` succeeds (live subscription)
    - `grep -q "recordSignOff" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"` succeeds
    - Publish gate includes both greens: `grep -q "factsActive" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx" && grep -q "humanActive" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"` succeed
    - Both sign-off kinds referenced in the rail: `grep -q "facts-cleared" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx" && grep -q "sounds-human" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"` succeed
    - Sign buttons keep the ≥44px target: `grep -q "min-h-\[44px\]" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"` succeeds
  </acceptance_criteria>
  <done>signOffClient.recordSignOff exists; the rail shows two live affirmative sign-off controls, records via the endpoint, and gates Publish on both greens; the dispatch-control strict build passes.</done>
</task>

<task type="auto">
  <name>Task 2: Sanity document.actions publish override + read-only-fallback docs</name>
  <read_first>
    - apps/studio/sanity.config.ts (the full vanilla config — add the `document.actions` resolver key)
    - docs/API_CONTRACTS.md §34.9 (frozen resolver logic + flag name)
    - apps/studio/README.md (existing onboarding doc — add the read-only-fallback note)
    - apps/studio/EDITOR_GUIDE.md (existing editor doc — add the soak-criterion + read-only-fallback note)
    - .planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md (D-10/D-11/D-12 — flag default OFF, manual soak end, publish-path-only)
  </read_first>
  <action>
1. In `apps/studio/sanity.config.ts`, add a `document.actions` resolver inside `defineConfig({...})` (alongside `plugins`/`schema`), exactly per §34.9:
```typescript
  document: {
    actions: (prev, context) => {
      // Phase 34 (§34.9, PUB-03, D-10) — remove Studio's publish button for
      // weeklyIssue once the soak ends. Flag defaults OFF; flipping it +
      // redeploying Studio is the only change to end the soak (D-11). The
      // webhook re-check (§34.5) protects the gate regardless of flag state.
      const disablePublish = process.env.SANITY_STUDIO_DISABLE_PUBLISH === 'true'
      if (disablePublish && context.schemaType === 'weeklyIssue') {
        return prev.filter(({ action }) => action !== 'publish')
      }
      return prev
    },
  },
```
Leave `name`/`title`/`projectId`/`dataset`/`plugins`/`schema` unchanged. (Only the `weeklyIssue` type loses publish; other document types are untouched.)

2. In `apps/studio/README.md`, add a short "Publishing & the console (Phase 34)" section stating: the dispatch-control console is the editing + publishing surface of record; Studio is a read-only fallback for emergencies; the two-sign-off gate + webhook re-check mean a direct Studio publish flip for a run without both sign-offs is reverted to `in-review` and never deploys; the `SANITY_STUDIO_DISABLE_PUBLISH` env flag (default OFF) removes Studio's `weeklyIssue` publish button once flipped + redeployed. Studio EDITING remains possible (edit lockdown is a later Sanity-removal milestone — D-12).

3. In `apps/studio/EDITOR_GUIDE.md`, add a "Soak & retiring Studio publish (Phase 34)" section documenting the soak-end criterion (D-11): e.g. "2–3 consecutive real weekly issues shipped entirely via the console with no Studio publish fallback needed; when met, set `SANITY_STUDIO_DISABLE_PUBLISH=true` and redeploy Studio." State there is no automatic counter — Andrew flips the flag manually. Reiterate the read-only-fallback framing (D-12).
  </action>
  <verify>
    <automated>grep -q "SANITY_STUDIO_DISABLE_PUBLISH" apps/studio/sanity.config.ts && grep -q "action !== 'publish'" apps/studio/sanity.config.ts && grep -q "SANITY_STUDIO_DISABLE_PUBLISH" apps/studio/README.md && grep -q "SANITY_STUDIO_DISABLE_PUBLISH" apps/studio/EDITOR_GUIDE.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "document:" apps/studio/sanity.config.ts && grep -q "actions:" apps/studio/sanity.config.ts` succeed (resolver added)
    - `grep -q "process.env.SANITY_STUDIO_DISABLE_PUBLISH === 'true'" apps/studio/sanity.config.ts` succeeds (flag default OFF — only 'true' disables)
    - `grep -q "context.schemaType === 'weeklyIssue'" apps/studio/sanity.config.ts && grep -q "action !== 'publish'" apps/studio/sanity.config.ts` succeed (scoped to weeklyIssue publish only)
    - The `plugins`/`schema`/`projectId` config keys are still present (no regression): `grep -q "structureTool()" apps/studio/sanity.config.ts && grep -q "schemaTypes" apps/studio/sanity.config.ts` succeed
    - `grep -q "read-only" apps/studio/README.md && grep -q "read-only" apps/studio/EDITOR_GUIDE.md` succeed (fallback framing documented, D-12)
    - `grep -q "soak" apps/studio/EDITOR_GUIDE.md` succeeds (soak criterion documented, D-11)
  </acceptance_criteria>
  <done>sanity.config.ts removes the weeklyIssue publish action only when the flag is 'true' (default OFF, other types untouched); README + EDITOR_GUIDE document the read-only fallback and manual soak-end criterion.</done>
</task>

</tasks>

<verification>
- `cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build` exits 0.
- `grep SANITY_STUDIO_DISABLE_PUBLISH apps/studio/sanity.config.ts` present; the resolver filters `publish` for `weeklyIssue` only.
- Manual UAT (PUB-03): set `SANITY_STUDIO_DISABLE_PUBLISH=true`, rebuild Studio, confirm the `weeklyIssue` publish action is absent and present for other types; unset → returns.
</verification>

<success_criteria>
- Andrew records both sign-offs from the rail with live affirmative state; Publish enables only on both greens; the Studio publish button is flag-removable for weeklyIssue with read-only-fallback + soak docs in place.
</success_criteria>

<output>
After completion, create `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-06-SUMMARY.md`
</output>
