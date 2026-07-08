---
status: partial
phase: 33-accept-fix-wiring-decision-rail
source: [33-VERIFICATION.md]
started: 2026-07-08T06:45:00Z
updated: 2026-07-08T06:45:00Z
---

## Current Test

[awaiting human testing]

> Ops prerequisite before UAT: Convex schema deploy + pipeline redeploy (memory flags a stale pipeline `CONVEX_DEPLOY_KEY` — prompt_versions seeding was blocked by a 401 on that key).

## Tests

### 1. Live accept round-trip
expected: On a real awaiting-review run, clicking Accept fix in an annotation popover replaces the quoted span with the suggested text in the actual Sanity draft, the galley re-renders with the change, and an audit row with before/after snapshots appears.
result: [pending]

### 2. Dismiss reactivity
expected: Dismiss requires a one-line reason before submitting; on submit the finding disappears from galley spans, chip counts, and the rail blockers, and appears in the rail's collapsed Resolved list — all without a page reload.
result: [pending]

### 3. Publish gate + rail layout
expected: With an open error-severity finding, Publish is disabled with a visible reason ("N blocker(s) to clear") and a direct API publish attempt returns 409 open_error_findings; the rail renders as a 336px right column on #f1f0ea per the design.
result: [pending]

### 4. Orphan surfacing
expected: Editing away a finding's quoted text via the section editor causes the finding to surface as an unresolved card at the end of its section (with Dismiss + Edit inline actions) — never silently dropped; error-severity orphans still block Publish.
result: [pending]

### 5. Verification timestamps
expected: The rail's verification block shows "X/Y claims checked · checked Nm ago" when checks exist, and honest "No claims extracted yet" / "not yet checked" states otherwise — never blank.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
