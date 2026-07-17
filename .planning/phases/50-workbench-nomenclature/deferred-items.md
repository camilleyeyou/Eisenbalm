# Phase 50 — Deferred Items (out of scope, discovered during execution)

## 50-01: Duplicate React key `/issues` in AppSidebar's Editorial group

- **Found during:** Plan 50-01, Task 2 (writing `AppSidebar.test.tsx`, the
  role-indicator render test).
- **Symptom:** Mounting `<AppSidebar>` logs a React warning: `Encountered
  two children with the same key, "/issues"`.
- **Cause:** `lib/nav.ts`'s Editorial group has two items — `Issues` and
  `Issue Workspace` — that both point at `href: '/issues'` (Phase 41,
  WSP-01, D-22: "Issue Workspace" links to `/issues` deliberately, the bare
  route redirects onward to the last-visited stage). `AppSidebar.tsx` keys
  each `<li>` by `item.href` (`<li key={item.href}>`), so the two items
  collide on the same React key.
- **Why deferred:** Pre-existing since Phase 41; not caused by this plan's
  nav-label rename or role-indicator addition (verified: the warning is
  unrelated to labels/hrefs touched by 50-01, and 50-01's `<files>` scope is
  the nav-label rename + role indicator only). Fixing it would mean either
  changing the `<li>` key strategy (e.g. key by label instead of href) or
  restructuring the Editorial group's data shape — both out of this plan's
  scope per the SCOPE BOUNDARY rule.
- **Suggested fix (for whichever future plan owns it):** key the `<li>` by
  `item.label` instead of `item.href` in `AppSidebar.tsx` (labels are unique
  within a group today), or give `Issue Workspace` a distinct key prop
  independent of its href.
