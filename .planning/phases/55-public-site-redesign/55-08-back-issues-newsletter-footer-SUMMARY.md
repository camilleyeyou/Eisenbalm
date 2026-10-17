---
phase: 55-public-site-redesign
plan: 08
subsystem: web
tags: [dispatch, back-issues, newsletter, footer, a11y]
requires: [55-01, 55-02, 55-03, 55-04]
provides: [BackIssues, NewsletterForm, DispatchFooter]
key-files:
  created:
    - apps/web/components/dispatch/BackIssues.tsx
    - apps/web/components/dispatch/NewsletterForm.tsx
    - apps/web/components/dispatch/DispatchFooter.tsx
    - apps/web/components/dispatch/footer.css
    - apps/web/__tests__/back-issues-search.test.tsx
    - apps/web/__tests__/newsletter-form.test.tsx
metrics:
  completed: 2026-10-17
---

# Phase 55 Plan 08: Back issues, newsletter, footer Summary

Back-issues tone-card grid with accessible client search, a honeypot-protected newsletter form posting to /api/email/subscribe, and a contentinfo Dispatch footer.

## Commits
- Task 1: BackIssues grid + search (footer.css, test)
- Task 2: NewsletterForm + DispatchFooter (test)

## Verification
Full web suite: 62 files, 619 passed, 13 todo. `pnpm --filter web typecheck` clean.

## Deviations
None. footer.css was written once in Task 1 containing both tasks' rules.

## Self-Check: PASSED
