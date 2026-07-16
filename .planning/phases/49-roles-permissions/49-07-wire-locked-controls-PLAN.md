---
phase: 49-roles-permissions
plan: 07
type: execute
wave: 3
depends_on: ["49-06"]
files_modified:
  - apps/dispatch-control/components/revision/RevisionFlow.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
  - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
  - apps/dispatch-control/__tests__/RevisionFlow.roleGate.test.tsx
  - apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx
autonomous: true
requirements: [ROL-03]

must_haves:
  truths:
    - "Each of the six gated controls renders for a Collaborator: present in the DOM, disabled, with the exact verbatim §6 explanation visible — never hidden."
    - "For an Editor-in-chief, each control renders fully interactive exactly as before this phase."
    - "The client gate is additive to the existing workflow-state/busy disabled conditions — it never replaces them."
    - "Two integration-level RTL smoke tests (RevisionFlow + DecisionRail) prove the real action button is present + disabled + labeled with the verbatim §6 text when useRole()='Collaborator' (SC-3, beyond the LockedControl unit test)."
  artifacts:
    - path: "apps/dispatch-control/components/revision/RevisionFlow.tsx"
      provides: "Apply revision wrapped with the verbatim Apply lock"
      contains: "Apply revision 🔒 editor only"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"
      provides: "Publish wrapped with the verbatim publish sentence"
      contains: "Collaborators can review and comment, not publish."
    - path: "apps/dispatch-control/__tests__/RevisionFlow.roleGate.test.tsx"
      provides: "integration smoke test: Collaborator sees Apply present-but-locked (SC-3)"
      contains: "useRole: () => 'Collaborator'"
  key_links:
    - from: "the six control components"
      to: "LockedControl + useRole"
      via: "isLocked = useRole() !== 'Editor-in-chief'"
      pattern: "LockedControl"
---

<objective>
Wrap the six gated controls with `<LockedControl>` using the VERBATIM §6 labels, driven by `useRole()`, then prove the rendering contract with two integration-level smoke tests. This is the ROL-03 rendering contract: a Collaborator sees every control present-but-locked with an explanation; an editor sees them unchanged.

Purpose: ROL-03. The prior phases (41/42/45/47) deliberately structured these controls to be WRAPPED not rewritten. The client gate is presentation-only (D-11) and additive to existing `disabled` (busy/workflow-state) conditions.
Output: seven client component files wrapping the six actions (publish has a current + a legacy surface); two new role-gate smoke tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-roles-permissions/49-CONTEXT.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md

<interfaces>
Primitives from Plan 49-06 (import and use):
```typescript
import { useRole } from '@/lib/role'
import { LockedControl } from '@/components/LockedControl'
const isLocked = useRole() !== 'Editor-in-chief'   // presentation-only
```
LockedControl clones a SINGLE interactive child (it calls `React.Children.only` + `React.cloneElement` to force `disabled`/`aria-disabled` onto the real element). So each wrap must pass exactly ONE interactive element (the action `<button>`) as children — not a fragment or multiple siblings.
VERBATIM §6 labels (DERIVED-STATE-CONTRACT lines 85-90 — copy EXACTLY, including the 🔒 emoji and casing):
  Apply revision                → `Apply revision 🔒 editor only`
  Confirm evidence replacement  → (NO distinct label — shares the Apply lock; wrap it with the SAME `Apply revision 🔒 editor only`)
  Approve the Voice Pass        → `Voice approval 🔒 Editor-in-chief only`
  Publish issue                 → `Collaborators can review and comment, not publish.`
  Make instruction active       → `Make active 🔒 Editor-in-chief only`
  Mark Do not use               → `🔒 editor only`
Control call sites (verified):
  Apply revision  → components/revision/RevisionFlow.tsx (apply button, ~line 138 → applyRevision)
  Evidence apply  → .../fact-check/FactCheckScreen.tsx (~line 277 → evidenceApply)
  Voice approval  → .../voice-pass/[runId]/_components/VoicePassRail.tsx (~line 107 → recordSignOff 'sounds-human')
  Publish (current) → .../review-desk/[runId]/_components/DecisionRail.tsx (~line 230 → publishIssue)
  Publish (legacy)  → .../run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx (~line 84)
  Make active     → .../prompt-lab/_components/VersionHistoryPanel.tsx (~line 255 → activate)
  Do not use      → .../registry/_components/RegistryTable.tsx (~line 63/93 → setStatus 'blocklisted')
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wrap the four FastAPI-backed controls (apply revision, evidence apply, voice approval, publish ×2)</name>
  <files>apps/dispatch-control/components/revision/RevisionFlow.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx, apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx, apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx</files>
  <read_first>
    - Each of the 5 files above — locate the primary action button (the one calling applyRevision / evidenceApply / recordSignOff('sounds-human') / publishIssue) and its existing `disabled={...}` expression
    - apps/dispatch-control/components/LockedControl.tsx (the wrapper API from Plan 49-06 — clones a single interactive child to force disabled/aria-disabled onto the real element)
    - apps/dispatch-control/lib/role.ts (useRole)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md lines 85-90 (verbatim labels)
  </read_first>
  <action>
    In each file, import `useRole` from '@/lib/role' and `LockedControl` from '@/components/LockedControl'. Compute `const isLocked = useRole() !== 'Editor-in-chief'` inside the component. Wrap the primary action control — passing the SINGLE action `<button>` as the only child (LockedControl clones one interactive child; do not pass a fragment/multiple siblings) — with `<LockedControl isLocked={isLocked} lockedLabel="<VERBATIM §6 label>">...</LockedControl>`, keeping the existing `disabled` (busy/workflow-state) condition intact on the underlying button (additive, D-11 — LockedControl force-disables ON TOP of it when locked). Use these EXACT lockedLabel strings:
      - RevisionFlow.tsx (apply) → `Apply revision 🔒 editor only`
      - FactCheckScreen.tsx (evidenceApply) → `Apply revision 🔒 editor only`  (shares the Apply lock — no distinct label per §6/D-09)
      - VoicePassRail.tsx (approve) → `Voice approval 🔒 Editor-in-chief only`
      - DecisionRail.tsx (publish) → `Collaborators can review and comment, not publish.`
      - ReviewDecisionPanel.tsx (legacy publish) → `Collaborators can review and comment, not publish.`
    Do NOT hide any control (`{isEditor && ...}` is forbidden — ROL-03). The control must always render; when locked it is disabled + explained.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/dispatch-control-no-sanity-write.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rc "LockedControl" apps/dispatch-control/components/revision/RevisionFlow.tsx apps/dispatch-control/app/\(dashboard\)/issues/\[issueNumber\]/fact-check/FactCheckScreen.tsx apps/dispatch-control/app/\(dashboard\)/voice-pass/\[runId\]/_components/VoicePassRail.tsx apps/dispatch-control/app/\(dashboard\)/review-desk/\[runId\]/_components/DecisionRail.tsx apps/dispatch-control/app/\(dashboard\)/run-monitor/runs/\[runId\]/review/_components/ReviewDecisionPanel.tsx` sums to ≥ 5 (each file wraps its control).
    - `grep -rc "Collaborators can review and comment, not publish." apps/dispatch-control` ≥ 2 (both publish surfaces).
    - `grep -rc "Voice approval 🔒 Editor-in-chief only" apps/dispatch-control` ≥ 1.
    - No `{isEditor &&` / conditional-removal of these controls introduced (they render always).
  </acceptance_criteria>
  <done>All four FastAPI-backed controls (5 files incl. legacy publish) render present-but-locked for a Collaborator with the verbatim §6 labels.</done>
</task>

<task type="auto">
  <name>Task 2: Wrap the two Convex-backed controls (make active, mark Do not use)</name>
  <files>apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx, apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx lines 40-110, 244-290 (existing useUser import + the activate button + the override sub-flow)
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx lines ~60-100 (the setStatus 'blocklisted' control)
    - apps/dispatch-control/components/LockedControl.tsx, apps/dispatch-control/lib/role.ts
  </read_first>
  <action>
    VersionHistoryPanel.tsx: it already imports `useUser` — add `useRole` from '@/lib/role' + `LockedControl`. Wrap the "Make active" (activate) button — the SINGLE action `<button>` as the only child (LockedControl clones one interactive child) — with `<LockedControl isLocked={useRole() !== 'Editor-in-chief'} lockedLabel="Make active 🔒 Editor-in-chief only">...`. Keep the existing eval-gate override sub-flow behavior; only the top-level Make active affordance needs the lock (the override reason box lives behind it and is unreachable when locked).
    RegistryTable.tsx: wrap the "Mark Do not use" (setStatus 'blocklisted') control — again the SINGLE action `<button>` — with `<LockedControl isLocked={useRole() !== 'Editor-in-chief'} lockedLabel="🔒 editor only">...`. The typed-confirmation + reason flow (Phase 47) stays intact behind the lock — a locked Collaborator never reaches it.
    Additive only — keep existing `disabled` (run-in-progress / busy) conditions. Never hide.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/activate.test.ts __tests__/charitiesDoNotUse.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Make active 🔒 Editor-in-chief only" apps/dispatch-control/app/\(dashboard\)/prompt-lab/_components/VersionHistoryPanel.tsx` == 1.
    - `grep -c "🔒 editor only" apps/dispatch-control/app/\(dashboard\)/registry/_components/RegistryTable.tsx` == 1.
    - Both files import LockedControl and useRole.
    - The Convex mutation unit tests still pass (wrapping is presentation-only): command exits 0.
  </acceptance_criteria>
  <done>Make active and Mark Do not use render present-but-locked for a Collaborator with the verbatim §6 labels; underlying flows unchanged for editors.</done>
</task>

<task type="auto">
  <name>Task 3: Integration RTL smoke test at two representative call sites (RevisionFlow + DecisionRail) — SC-3</name>
  <files>apps/dispatch-control/__tests__/RevisionFlow.roleGate.test.tsx, apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/RevisionFlow.test.tsx (existing harness to reuse: `vi.mock('@clerk/nextjs')`, `vi.mock('@/lib/revisionClient')` with `previewRevision`/`applyRevision`, `vi.mock('@/lib/contentPatchClient')`; the Apply button is driven into view by clicking the `Make clearer` direction chip AFTER mockPreviewRevision resolves)
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (existing harness to reuse: `renderRail` wraps `<DecisionRail>` in `<InspectorProvider>`, mocks `convex/react` useQuery/useMutation + `@convex/_generated/api`; the Publish button queried as `getByRole('button', { name: /^publish$/i })` and mounts under a ready readiness board — see the test that asserts `publish.disabled === false`)
    - apps/dispatch-control/components/LockedControl.tsx + apps/dispatch-control/lib/role.ts (the primitives being exercised)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md lines 85-90 (verbatim labels to assert)
    - .planning/phases/49-roles-permissions/49-CONTEXT.md D-09 (never hidden — present-but-locked)
  </read_first>
  <action>
    Add TWO small RTL smoke tests proving the ROL-03 rendering contract at the INTEGRATION level (the real call site, not just the LockedControl unit from 49-06). Each mocks the role hook to a Collaborator and asserts the ACTUAL action button is present + disabled + shows the verbatim §6 label. Reuse the sibling test's existing mocks/harness verbatim (no new deps) and add ONLY the role mock:
    ```typescript
    vi.mock('@/lib/role', () => ({ useRole: () => 'Collaborator' }))
    ```
    Match the codebase's plain-DOM assertion style (cast to HTMLButtonElement + `.disabled`, `getByText(...).toBeDefined()` — same as DecisionRail.test.tsx), not jest-dom matchers.
    - RevisionFlow.roleGate.test.tsx: reuse RevisionFlow.test.tsx's mock block (mock '@clerk/nextjs', '@/lib/revisionClient' with `previewRevision` resolving to a preview, '@/lib/contentPatchClient'). Render `<RevisionFlow>`, click the `Make clearer` direction chip to mount the wrapped Apply button, then:
        ```typescript
        const apply = await screen.findByRole('button', { name: 'Apply' }) as HTMLButtonElement
        expect(apply.disabled).toBe(true)                                    // real element force-disabled, not just a wrapper
        expect(apply.getAttribute('aria-disabled')).toBe('true')
        expect(screen.getByText('Apply revision 🔒 editor only')).toBeDefined()   // present + visible, never hidden
        ```
    - DecisionRail.roleGate.test.tsx: reuse DecisionRail.test.tsx's `renderRail` harness + convex mocks with the READY state (no open error-severity findings, both sign-offs present, not held) so Publish mounts enabled-for-an-editor. With the Collaborator role mock:
        ```typescript
        const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
        expect(publish.disabled).toBe(true)
        expect(publish.getAttribute('aria-disabled')).toBe('true')
        expect(screen.getByText('Collaborators can review and comment, not publish.')).toBeDefined()
        ```
    Keep each test to a single Collaborator-locked assertion (2 screens is enough per the revision scope). The remaining four screens stay covered by the LockedControl unit test (49-06), the static grep checks in this plan's Tasks 1-2, and the 49-09 human-verify step. Do NOT add new npm deps — reuse the vitest + @testing-library/react already imported by the sibling test files.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/RevisionFlow.roleGate.test.tsx __tests__/DecisionRail.roleGate.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd apps/dispatch-control && pnpm vitest run __tests__/RevisionFlow.roleGate.test.tsx` exits 0.
    - `cd apps/dispatch-control && pnpm vitest run __tests__/DecisionRail.roleGate.test.tsx` exits 0.
    - `grep -c "useRole: () => 'Collaborator'" apps/dispatch-control/__tests__/RevisionFlow.roleGate.test.tsx` == 1 AND `grep -c "useRole: () => 'Collaborator'" apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx` == 1.
    - Each test queries the real action button via getByRole/findByRole('button'), asserts it is `disabled` (and aria-disabled="true"), AND asserts the verbatim §6 label text is present in the DOM (present-but-locked, not hidden).
    - No new dependency added to apps/dispatch-control/package.json (reuse existing test deps).
  </acceptance_criteria>
  <done>Two integration-level smoke tests prove a Collaborator sees the real Apply and Publish buttons present + disabled + labeled with the verbatim §6 text — closing the SC-3 automated gap beyond the unit test.</done>
</task>

<task type="auto">
  <name>Task 4: Strict Next build to catch type errors from the wiring</name>
  <files>apps/dispatch-control/components/LockedControl.tsx</files>
  <read_first>
    - /Users/user/.claude/projects/-Users-user-Desktop-Eisenbalm/memory/MEMORY.md entry "Run strict build before frontend phase done" (vitest does not type-check; Phase 27/39 shipped latent bugs)
  </read_first>
  <action>
    Wrapping 7 files can introduce type errors (LockedControl children typing, cloneElement/prop-threading, hook-in-non-client-component). vitest does NOT type-check. Run the strict Next build for dispatch-control and fix any type/lint errors surfaced by the wiring — in particular the `React.cloneElement` single-child typing at each of the 7 call sites (children must be one `React.ReactElement<ButtonHTMLAttributes>`, not a fragment). (Full-suite + build is repeated as the phase gate in Plan 49-09; this is the per-plan early catch.)
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control build` exits 0 (no type/lint errors from the seven wrapped files or the cloneElement child typing).
  </acceptance_criteria>
  <done>dispatch-control builds strictly with all six controls wrapped.</done>
</task>

</tasks>

<verification>
- All six controls (seven files) wrap their action with LockedControl + the verbatim §6 label, passing a single interactive child.
- Two integration smoke tests (RevisionFlow + DecisionRail) assert the real button is present + disabled + labeled for a Collaborator (SC-3).
- Nothing is hidden; editor experience unchanged; Convex/RTL unit tests + smoke tests + strict build green.
</verification>

<success_criteria>
A Collaborator sees every gated control rendered and locked with the exact §6 explanation, never hidden (ROL-03) — proven at the integration level by two RTL smoke tests plus the static grep checks and the 49-09 human-verify.
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-07-SUMMARY.md`.
</output>
