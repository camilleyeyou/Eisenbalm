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
    - "When isLocked=true, LockedControl force-disables the ACTUAL interactive child (clones it to inject disabled + aria-disabled=\"true\" onto the real <button> — a pointer-events-none wrapper is NOT sufficient) AND renders the verbatim §6 explanation in an accessible visible node associated via aria-describedby (not a title= tooltip); the control is NEVER removed from the DOM."
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
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Pattern 3" — READ THE CLOSING NOTE (line ~159): a `pointer-events-none` wrapper leaves the real button focusable-but-inert (a keyboard user tabs to it and Enter/Space still fires the underlying handler with no announcement). This plan takes the safe path the note prescribes: prop-thread `disabled` + `aria-disabled` onto the ACTUAL interactive element (via `React.cloneElement`), NOT a non-interactive overlay. The explanation must be visible text (not `title=`) and programmatically associated (`aria-describedby`).
    - .planning/phases/49-roles-permissions/49-CONTEXT.md D-10 (preserve existing a11y invariants — visible adjacent text, ≥44px, WCAG AA, never hidden) and D-09 (verbatim labels).
  </read_first>
  <behavior>
    - isLocked=true: the rendered output STILL contains the interactive child (query it by role — present, not removed); the ACTUAL child element (the real `<button>`, NOT a wrapper `<div>`) carries `disabled` + `aria-disabled="true"` (force-disabled via `cloneElement`/prop-thread, additive to any `disabled` the caller already passed); and the exact `lockedLabel` string appears as visible text in a queryable node (getByText) that is associated to the button via `aria-describedby` — NOT only inside a `title` attribute.
    - isLocked=false: the child renders unchanged and is not disabled by the wrapper.
    - Accessibility (D-10): the label node is a rendered element (role="note"/span) reachable without hover, and the real control is genuinely disabled (not merely visually dimmed while still focusable-and-firing).
  </behavior>
  <action>
    First write apps/dispatch-control/__tests__/LockedControl.test.tsx (RED) encoding the behavior above with a sample `lockedLabel="Apply revision 🔒 editor only"` and a SINGLE child `<button>Apply revision</button>`. The test MUST query the real element with `screen.getByRole('button', { name: 'Apply revision' })` and assert (isLocked=true): `button.disabled === true`, `button.getAttribute('aria-disabled') === 'true'`, `screen.getByText('Apply revision 🔒 editor only')` exists, and `button.getAttribute('aria-describedby')` equals the id of that label node. Also assert the isLocked=false branch renders the button un-disabled.
    Then implement apps/dispatch-control/components/LockedControl.tsx. Signature:
    ```typescript
    'use client'
    import React from 'react'
    interface LockedControlProps {
      isLocked: boolean
      lockedLabel: string   // verbatim §6 text — passed by caller, never paraphrased here
      children: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>  // a SINGLE interactive element (the action <button>)
      className?: string
    }
    export function LockedControl({ isLocked, lockedLabel, children, className }: LockedControlProps)
    ```
    When !isLocked → `return <>{children}</>` unchanged. When isLocked → prop-thread the disabled state onto the ACTUAL interactive child (do NOT wrap it in a `pointer-events-none`/`aria-disabled` overlay `<div>` — see Pattern 3 note). Clone the child to force `disabled` + `aria-disabled` onto the real element and associate the visible explanation via `aria-describedby`:
    ```tsx
    const labelId = React.useId()
    const child = React.Children.only(children)
    const describedBy = [child.props['aria-describedby'], labelId].filter(Boolean).join(' ')
    const lockedChild = React.cloneElement(child, {
      disabled: true,                 // force-disable the REAL element (additive to any disabled the caller passed)
      'aria-disabled': true,
      'aria-describedby': describedBy,
    })
    return (
      <div className={`flex flex-col gap-1 ${className ?? ''}`}>
        {lockedChild}
        <span id={labelId} role="note" className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink-soft)]">
          {lockedLabel}
        </span>
      </div>
    )
    ```
    The cloned child keeps its own chrome (min-h-[44px] target, `focus-visible:ring-2`, `disabled:opacity-40`) so a locked control is chrome-indistinguishable from a normal disabled button, differing only in the associated explanation text. Keep the §6 label VISIBLE (rendered node, not `title=`) and programmatically associated (`aria-describedby`). Do NOT hard-code any specific label inside the component — labels are props (Plan 49-07 supplies the six verbatim strings). `React.Children.only` enforces the single-interactive-child contract at runtime; if a caller ever needs multiple nodes it must pass one wrapping interactive element.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/LockedControl.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export function LockedControl" apps/dispatch-control/components/LockedControl.tsx` == 1.
    - LockedControl prop-threads onto the real child (no inert overlay): `grep -c "cloneElement" apps/dispatch-control/components/LockedControl.tsx` ≥ 1 AND `grep -c "pointer-events-none" apps/dispatch-control/components/LockedControl.tsx` == 0.
    - Component contains NO hard-coded §6 label string (labels are props): `grep -c "editor only" apps/dispatch-control/components/LockedControl.tsx` == 0.
    - `LockedControl.test.tsx` asserts the rendered BUTTON element itself (`screen.getByRole('button')`, not a wrapper div) has the `disabled` attribute AND `aria-disabled="true"` when isLocked=true (the Collaborator branch), and that the child is present in the DOM (not removed).
    - The test asserts the verbatim label is queryable via `getByText` AND that its node id equals the button's `aria-describedby` (visible + programmatically associated, not title-only).
    - `cd apps/dispatch-control && pnpm vitest run __tests__/LockedControl.test.tsx` exits 0 (GREEN).
  </acceptance_criteria>
  <done>LockedControl force-disables the real interactive child + renders a visible, aria-describedby-associated explanation, never hidden; test asserts the actual button (not a wrapper) is disabled/aria-disabled; no label hard-coded in the component.</done>
</task>

</tasks>

<verification>
- useRole() reads publicMetadata.role, undefined while loading.
- LockedControl: locked → the REAL child button is disabled + aria-disabled (cloneElement prop-thread, not a pointer-events-none overlay) + visible aria-describedby-associated verbatim label; unlocked → child unchanged.
- No §6 label hard-coded in the component (props only).
</verification>

<success_criteria>
The two ROL-03 primitives exist and are tested: a presentation-only role hook and a reusable locked-with-explanation wrapper that disables the ACTUAL interactive element (never leaves it focusable-but-inert) and never hides the control.
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-06-SUMMARY.md`.
</output>
</output>
