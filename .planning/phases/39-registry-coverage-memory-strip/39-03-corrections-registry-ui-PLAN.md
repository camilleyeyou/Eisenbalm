---
phase: 39-registry-coverage-memory-strip
plan: 03
type: execute
wave: 2
depends_on: ["39-01"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
  - apps/dispatch-control/app/(dashboard)/registry/_components/AddCorrectionDialog.tsx
  - apps/dispatch-control/app/(dashboard)/registry/_components/CorrectionsList.tsx
  - apps/dispatch-control/__tests__/AddCorrectionDialog.test.tsx
  - apps/dispatch-control/__tests__/CorrectionsList.test.tsx
autonomous: true
requirements: [MEM-02]
must_haves:
  truths:
    - "Each charity row in the Registry has an 'Add correction' affordance and shows its corrections chronologically"
    - "Adding a correction calls charityCorrections.append with the row's dedupKey (no client-side key derivation)"
    - "Corrections are read-only in the UI — no edit or delete control exists"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/registry/_components/AddCorrectionDialog.tsx"
      provides: "append form calling useMutation(api.charityCorrections.append)"
      contains: "charityCorrections.append"
    - path: "apps/dispatch-control/app/(dashboard)/registry/_components/CorrectionsList.tsx"
      provides: "chronological per-charity corrections list via useQuery"
      contains: "listByCharityKey"
    - path: "apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx"
      provides: "row expansion mounting corrections list + add affordance"
      contains: "Add correction"
  key_links:
    - from: "AddCorrectionDialog"
      to: "api.charityCorrections.append"
      via: "useMutation"
      pattern: "charityCorrections\\.append"
    - from: "CorrectionsList"
      to: "api.charityCorrections.listByCharityKey"
      via: "useQuery"
      pattern: "charityCorrections\\.listByCharityKey"
---

<objective>
Surface the append-only corrections log per-charity in the Registry (MEM-02): each charity row gains an "Add correction" affordance and a chronological list of its corrections, reusing the existing `RegistryTable.tsx` surface (row expansion), not a new page.

Purpose: The operator can keep a durable, human-authored record of corrections to a charity — the same log the Researcher re-reads (39-04). Corrections are append-only; no edit/delete.
Output: `AddCorrectionDialog.tsx` (append form), `CorrectionsList.tsx` (chronological list), a row-expansion wiring in `RegistryTable.tsx`, and two Vitest files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/39-registry-coverage-memory-strip/39-RESEARCH.md

<interfaces>
<!-- From 39-01 (already landed): -->
<!-- api.charityCorrections.append({ workspace_id, charityKey, sanityCharityId?, text }) -> Id  (requireOperator + audit) -->
<!-- api.charityCorrections.listByCharityKey({ workspace_id, charityKey }) -> Doc[] (createdAt asc) -->
<!-- charity row (from charities.listByWorkspace, already loaded in RegistryTable): { _id, name, status, website?, dedupKey?, sanityCharityId?, timesFeatured?, lastFeaturedAt? } -->
<!-- dedupKey is ALWAYS present on Phase-26 rows — pass charity.dedupKey straight through as charityKey (Pitfall 5). Do NOT re-derive it. -->

Pattern references (read, don't copy blindly):
- RegistryTable.tsx already uses useQuery(api.charities.listByWorkspace) + useMutation + inline-confirm-popover state (confirmingBlocklistId). Reuse the same expanded-row state shape (expandedCharityId).
- AddCharityDialog.tsx — existing dialog+form structure to mirror for AddCorrectionDialog.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests for AddCorrectionDialog + CorrectionsList</name>
  <read_first>
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx or AwaitingYouInbox.test.tsx (Vitest + Testing Library render/mock pattern used in this app; how useQuery/useMutation from 'convex/react' are mocked)
    - apps/dispatch-control/app/(dashboard)/registry/_components/AddCharityDialog.tsx (dialog/form structure)
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx (existing state + row structure)
  </read_first>
  <behavior>
    - AddCorrectionDialog: rendering with a charity { dedupKey: "acme|acme.org", sanityCharityId: "charity-acme" }, typing "Founder name is verified" and submitting calls the mocked append mutation exactly once with { workspace_id, charityKey: "acme|acme.org", sanityCharityId: "charity-acme", text: "Founder name is verified" }. Empty text does not submit.
    - CorrectionsList: given useQuery returns 2 rows (createdAt asc), renders both texts in chronological order (oldest first); a loading (undefined) state renders a loading affordance; an empty ([]) state renders an empty message. No edit/delete button is present.
  </behavior>
  <action>
    Author apps/dispatch-control/__tests__/AddCorrectionDialog.test.tsx and apps/dispatch-control/__tests__/CorrectionsList.test.tsx. Mock `convex/react`'s useMutation/useQuery (vi.mock) mirroring the existing dashboard component tests. Assert the append call args include `charityKey: charity.dedupKey` (NOT a re-derived key). Assert CorrectionsList renders in createdAt-asc order and shows no `edit`/`delete`/`remove` control (query the DOM for those labels → absent). Run — RED (components missing).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run AddCorrectionDialog CorrectionsList 2>&1 | grep -Eq "fail|error|Cannot find|No test files|passed"</automated>
  </verify>
  <acceptance_criteria>
    - Both test files exist under apps/dispatch-control/__tests__/
    - `grep -q "charityKey" apps/dispatch-control/__tests__/AddCorrectionDialog.test.tsx` succeeds
    - `grep -qi "chronolog\|asc\|order" apps/dispatch-control/__tests__/CorrectionsList.test.tsx` succeeds
    - `cd apps/dispatch-control && npx vitest run AddCorrectionDialog CorrectionsList` currently FAILS (RED)
  </acceptance_criteria>
  <done>RED tests encode the append call shape (charityKey passthrough) and chronological read-only rendering.</done>
</task>

<task type="auto">
  <name>Task 2: AddCorrectionDialog + CorrectionsList components</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/registry/_components/AddCharityDialog.tsx (dialog + form + useMutation + error handling)
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx (min-h-[44px], focus-visible ring classes, neutral palette conventions)
    - @convex/_generated/api (confirm api.charityCorrections.append / listByCharityKey exist from 39-01)
  </read_first>
  <action>
    Create AddCorrectionDialog.tsx (`'use client'`): props `{ workspace_id: string; charity: { dedupKey?: string; sanityCharityId?: string; name: string } }`. A textarea + submit button; on submit call `useMutation(api.charityCorrections.append)({ workspace_id, charityKey: charity.dedupKey!, sanityCharityId: charity.sanityCharityId, text })`. Guard: do not submit empty/whitespace text; disable while pending; surface an error message on failure (mirror AddCharityDialog). Clear the field on success. NO edit/delete affordance. If `charity.dedupKey` is missing (legacy row), disable the form with a note ("This charity predates dedup keys; corrections unavailable") — defensive, per Pitfall 5/legacy note.

    Create CorrectionsList.tsx (`'use client'`): props `{ workspace_id: string; charityKey: string }`. `const corrections = useQuery(api.charityCorrections.listByCharityKey, charityKey ? { workspace_id, charityKey } : 'skip')`. Render: undefined → "Loading corrections…"; [] → "No corrections yet."; else an ordered chronological list (oldest first — the query already returns createdAt asc; do not reverse) of `{text}` + a relative timestamp + author. Read-only: no edit/delete buttons, no trash icon (Pitfall 3).
    Run the RED tests — GREEN.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run AddCorrectionDialog CorrectionsList</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "api.charityCorrections.append" apps/dispatch-control/app/(dashboard)/registry/_components/AddCorrectionDialog.tsx` succeeds
    - `grep -q "charityKey: charity.dedupKey" apps/dispatch-control/app/(dashboard)/registry/_components/AddCorrectionDialog.tsx` succeeds
    - `grep -q "api.charityCorrections.listByCharityKey" apps/dispatch-control/app/(dashboard)/registry/_components/CorrectionsList.tsx` succeeds
    - Neither component contains a delete/remove/edit control: `grep -Eiq "onDelete|handleDelete|Remove correction|Edit correction" apps/dispatch-control/app/(dashboard)/registry/_components/CorrectionsList.tsx` returns NOTHING
    - `cd apps/dispatch-control && npx vitest run AddCorrectionDialog CorrectionsList` passes
  </acceptance_criteria>
  <done>An append-only correction form and a chronological read-only list exist, keyed by the charity's existing dedupKey.</done>
</task>

<task type="auto">
  <name>Task 3: Wire row expansion into RegistryTable + strict build</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx (row map, state hooks, Actions cell)
  </read_first>
  <action>
    Extend RegistryTable.tsx: add `const [expandedCharityId, setExpandedCharityId] = useState<string | null>(null)`. In the Actions cell add an "Add correction" / "Corrections" toggle button (min-h-[44px], focus-visible ring, matching existing button styling) that toggles `expandedCharityId`. When a row is expanded, render an additional `<tr>` spanning all columns (`colSpan={6}`) containing `<AddCorrectionDialog workspace_id={workspace_id} charity={charity} />` and `<CorrectionsList workspace_id={workspace_id} charityKey={charity.dedupKey ?? ''} />`. Import both new components. Preserve all existing blocklist/filter behavior unchanged.
    Then run the STRICT build (memory note: vitest does not type-check; Vercel/Linux caught latent bugs in Phase 27).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "Add correction" apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` succeeds
    - `grep -q "AddCorrectionDialog" apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` and `grep -q "CorrectionsList" apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` succeed
    - `grep -q "expandedCharityId" apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` succeeds
    - `pnpm --filter dispatch-control build` exits 0
    - `cd apps/dispatch-control && npx vitest run` full dashboard suite passes (no regression)
  </acceptance_criteria>
  <done>Each Registry row can expand to add/view corrections; the strict dispatch-control build is clean.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run AddCorrectionDialog CorrectionsList` green.
- `pnpm --filter dispatch-control build` exits 0 (strict type-check).
- Corrections UI is append-only (no edit/delete), keyed by the row's existing dedupKey.
</verification>

<success_criteria>
- MEM-02 satisfied: operator can append a correction (guarded + audited via 39-01's mutation) and see the chronological log per charity in the Registry.
</success_criteria>

<output>
After completion, create `.planning/phases/39-registry-coverage-memory-strip/39-03-SUMMARY.md`.
</output>
