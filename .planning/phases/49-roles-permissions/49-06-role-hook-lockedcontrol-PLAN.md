---
phase: 49-roles-permissions
plan: 06
type: execute
wave: 2
depends_on: ["49-01"]
files_modified:
  - apps/dispatch-control/lib/role.ts
  - apps/dispatch-control/components/LockedControl.tsx
  - apps/dispatch-control/__tests__/LockedControl.test.tsx
autonomous: true
requirements: [ROL-03]

must_haves:
  truths:
    - "useRole() returns 'Editor-in-chief' | 'Collaborator' | undefined, reading Clerk useUser() publicMetadata.role; undefined while Clerk is loading (never assume Collaborator)."
    - "When isLocked=true, LockedControl renders the child control disabled AND the verbatim §6 explanation text in an accessible DOM node (not a title= tooltip); the control is NEVER removed from the DOM."
    - "When isLocked=false, LockedControl renders the child unchanged (fully interactive)."
  artifacts:
    - path: "apps/dispatch-control/components/LockedControl.tsx"
      provides: "reusable locked-with-explanation wrapper (ROL-03)"
      contains: "export function LockedControl"
    - path: "apps/dispatch-control/lib/role.ts"
      provides: "useRole() presentation-only hook"
      contains: "export function useRole"
  key_links:
    - from: "LockedControl"
      to: "useRole()"
      via: "isLocked derived by caller from useRole() !== 'Editor-in-chief'"
      pattern: "useRole"
---

<objective>
Build the two net-new frontend primitives ROL-03 needs: a presentation-only `useRole()` hook and a reusable `<LockedControl>` wrapper that renders a gated control disabled-with-visible-explanation (never hidden). Test-first with `LockedControl.test.tsx`.

Purpose: ROL-03. Frontend gating is greenfield (no role prop/context/hook exists). The client hint is PRESENTATION-ONLY — the server (Plans 49-03/49-04) is the authoritative gate (D-11). This plan builds the primitives; Plan 49-07 wires the six controls.
Output: `lib/role.ts`; `components/LockedControl.tsx`; `LockedControl.test.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-roles-permissions/49-RESEARCH.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md

<interfaces>
Clerk hook already used elsewhere (apps/dispatch-control/.../VersionHistoryPanel.tsx:40,69):
```typescript
import { useUser } from '@clerk/nextjs'
const { user } = useUser()  // user?.publicMetadata?.role
```
Button/disabled convention to preserve (VersionHistoryPanel.tsx activate button, line ~255-266):
  raw <button>, Tailwind utilities, `min-h-[44px]`, `disabled:cursor-not-allowed disabled:opacity-40`,
  `focus-visible:outline-none focus-visible:ring-2`, fonts via `font-[family-name:var(--font-ui)]`,
  colors via `text-[color:var(--color-ink-soft)]`.
Verbatim §6 labels (DERIVED-STATE-CONTRACT lines 85-90) — passed in by callers in Plan 49-07:
  Apply revision → `Apply revision 🔒 editor only`
  Approve the Voice Pass → `Voice approval 🔒 Editor-in-chief only`
  Publish issue → `Collaborators can review and comment, not publish.`
  Make instruction active → `Make active 🔒 Editor-in-chief only`
  Mark Do not use → `🔒 editor only`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create the useRole() presentation-only hook</name>
  <files>apps/dispatch-control/lib/role.ts</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx lines 40, 69 (the existing useUser() usage pattern)
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Pattern 2" (client-only, undefined-while-loading, never authoritative)
    - .planning/phases/49-roles-permissions/49-CONTEXT.md D-11
  </read_first>
  <action>
    Create apps/dispatch-control/lib/role.ts:
    ```typescript
    'use client'
    import { useUser } from '@clerk/nextjs'

    export type Role = 'Editor-in-chief' | 'Collaborator'

    /**
     * Presentation-only (D-11). The server dependency (_require_editor /
     * requireEditor) is the authoritative gate; this hook only decides which
     * of two render branches LockedControl shows. Returns undefined while Clerk
     * is still loading — callers must NOT treat undefined as Collaborator (that
     * would flash a lock for an editor mid-load).
     */
    export function useRole(): Role | undefined {
      const { user, isLoaded } = useUser()
      if (!isLoaded) return undefined
      const role = user?.publicMetadata?.role
      return role === 'Editor-in-chief' || role === 'Collaborator' ? role : undefined
    }

    /** Convenience: true only when we KNOW the user is an editor. */
    export function useIsEditor(): boolean {
      return useRole() === 'Editor-in-chief'
    }
    ```
  </action>
  <verify>
    <automated>grep -c "export function useRole" apps/dispatch-control/lib/role.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export function useRole" apps/dispatch-control/lib/role.ts` == 1.
    - `grep -c "publicMetadata" apps/dispatch-control/lib/role.ts` ≥ 1.
    - undefined is returned while `!isLoaded` (no default to Collaborator).
  </acceptance_criteria>
  <done>useRole()/useIsEditor() exist, read Clerk publicMetadata.role, return undefined while loading.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write LockedControl.test.tsx (RED) then implement LockedControl.tsx (GREEN)</name>
  <files>apps/dispatch-control/__tests__/LockedControl.test.tsx, apps/dispatch-control/components/LockedControl.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/EvalDrawer.test.tsx (an existing component/RTL test — confirms the render/query API + jsdom setup used in this app)
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx lines 255-266 (the button chrome vocabulary to preserve)
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Pattern 3" (the prop-threading vs cloneElement note — prefer prop-threading; the explanation must be visible text, not title=)
    - .planning/phases/49-roles-permissions/49-CONTEXT.md D-10 (visible adjacent text, ≥44px, WCAG AA, never hidden)
  </read_first>
  <behavior>
    - isLocked=true: the rendered output STILL contains the child control (query it — it is present, not removed) AND the exact `lockedLabel` string appears as visible text in a queryable node (getByText), NOT only inside a title attribute. The interactive affordance is disabled/aria-disabled.
    - isLocked=false: the child renders unchanged and is not disabled by the wrapper.
    - Accessibility: the label node is reachable (e.g., role="note" or a plain span with text), not a hover-only tooltip.
  </behavior>
  <action>
    First write apps/dispatch-control/__tests__/LockedControl.test.tsx (RED) encoding the behavior above with a sample `lockedLabel="Apply revision 🔒 editor only"` and a child `<button>Apply revision</button>`.
    Then implement apps/dispatch-control/components/LockedControl.tsx. Signature:
    ```typescript
    'use client'
    interface LockedControlProps {
      isLocked: boolean
      lockedLabel: string   // verbatim §6 text — passed by caller, never paraphrased here
      children: React.ReactNode
      className?: string
    }
    export function LockedControl({ isLocked, lockedLabel, children, className }: LockedControlProps)
    ```
    When !isLocked → return `<>{children}</>`. When isLocked → render the child in a non-interactive presentation (aria-disabled container, pointer-events-none, opacity-40) PLUS a visible explanation node:
    ```tsx
    <span role="note" className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink-soft)]">{lockedLabel}</span>
    ```
    Keep the §6 label VISIBLE (not `title=`). Preserve the codebase button chrome (min-h-[44px] target, focus-visible ring) so a locked control is chrome-indistinguishable from a normal disabled button, differing only in the explanation text. Do NOT hard-code any specific label inside the component — labels are props (Plan 49-07 supplies the six verbatim strings).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/LockedControl.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export function LockedControl" apps/dispatch-control/components/LockedControl.tsx` == 1.
    - Component contains NO hard-coded §6 label string (labels are props): `grep -c "editor only" apps/dispatch-control/components/LockedControl.tsx` == 0.
    - The test asserts the child is present in the DOM when locked (not removed) and the label is queryable via getByText (not title-only).
    - `cd apps/dispatch-control && pnpm vitest run __tests__/LockedControl.test.tsx` exits 0 (GREEN).
  </acceptance_criteria>
  <done>LockedControl renders locked child + visible explanation, never hidden; test green; no label hard-coded in the component.</done>
</task>

</tasks>

<verification>
- useRole() reads publicMetadata.role, undefined while loading.
- LockedControl: locked → child present + disabled + visible verbatim label; unlocked → child unchanged.
- No §6 label hard-coded in the component (props only).
</verification>

<success_criteria>
The two ROL-03 primitives exist and are tested: a presentation-only role hook and a reusable locked-with-explanation wrapper that never hides the control.
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-06-SUMMARY.md`.
</output>
