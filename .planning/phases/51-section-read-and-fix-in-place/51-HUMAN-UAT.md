---
status: partial
phase: 51-section-read-and-fix-in-place
source: [51-VERIFICATION.md, 51-06-SUMMARY.md]
started: 2026-08-01T09:35:00Z
updated: 2026-08-01T09:35:00Z
blocked_by: "Pipeline CORS excludes all localhost origins — no draft loads from the local dev server, so nothing renders to look at. See Unblock Routes below."
---

## Current Test

[awaiting human testing — blocked, see Unblock Routes]

## Unblock Routes

These items cannot be attempted until one of these is done. Diagnosed 2026-08-01:

The pipeline gates CORS on `DASHBOARD_ALLOWED_ORIGINS`
(`packages/pipeline/src/eisenbalm_pipeline/api/main.py:190`), which defaults to
`http://localhost:3000` when unset. `apps/dispatch-control` runs its dev server on
port **3001** by design (`"dev": "next dev --port 3001"`), and `.env.local` points
`NEXT_PUBLIC_PIPELINE_URL` at the production Railway pipeline. A live OPTIONS preflight
against `https://eisenbalm-pipeline-production.up.railway.app` returned **no
`Access-Control-Allow-Origin` header for either `http://localhost:3000` or
`http://localhost:3001`** — Railway's allowlist contains only the Vercel domain(s).

This is a pre-existing local-dev environment gap, NOT a Phase 51 defect: `git log
--name-only` across all eight Phase 51 plans' commits, scoped to `packages/pipeline`,
`convex`, and `schemas`, returns empty. It will block the same read-through for any
future phase until fixed.

**Route A — run the pipeline locally (no production change):**
```
# packages/pipeline/.env
DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001

# apps/dispatch-control/.env.local
NEXT_PUBLIC_PIPELINE_URL=http://localhost:8000

$ pnpm --filter pipeline dev
```

**Route B — allow localhost on Railway (production config change):**
Append `http://localhost:3001` to `DASHBOARD_ALLOWED_ORIGINS` on the
`eisenbalm-pipeline-production` service and restart. Note this permanently lets a
localhost origin make credentialed calls to the production API.

## Tests

### 1. Reading measure and typography (SC-1, READ-01)
expected: The surface reads as "a page to read, not a workspace to navigate" — reading column ≈760px, body visibly Lora and larger than Review Desk's galley type, no sidebar / masthead / tab strip / stage nav / form field above the prose, header scrolls away rather than sticking.
why_human: jsdom has no layout engine. Tests assert the `.section-reader` wrapper exists, `aside`/`form`/`input` are absent, and `globals.css` literally contains `max-width: 760px` and `font-size: 17.5px` — none of which proves the rendered page reads as intended.
result: [pending]

### 2. Label-not-colour-alone in greyscale (SC-2, READ-02)
expected: Each marked span carries a readable Fact / Voice / Source word beside it without opening anything, and the three kinds stay distinguishable with the display switched to greyscale.
why_human: Tests prove the text label renders and that the tag colour is a single fixed `var(--color-ink-soft)` for every axis — so colour cannot be the differentiator by construction. They cannot prove the label is legible or prominent enough in practice.
result: [pending]

### 3. Popover DOM validity in a real browser (SC-3, READ-03)
expected: Inspecting an open claim popover in Chrome DevTools shows no block-level element leaking into, or auto-closing a `<p>` around, the popover's phrasing-content structure.
why_human: jsdom does not validate HTML content models. The passing Vitest assertion (`.galley-popover div` is null) is an explicit structural PROXY documented as such in the plan — not proof of real-browser validity. Browsers silently reparent invalid nesting.
result: [pending]

### 4. The eight-item read-through from 51-06 Task 2 (SC-4, SC-5, all READ ids)
expected: Accept a suggestion, edit a passage by hand and save, dismiss a finding (one-line reason still required) — none leaving the paragraph. Prev/next reaches first and last sections naming each destination. `/s/game`, `/s/podcast`, `/s/theme`, `/s/deliberation-conversation` each state plainly what they are. `/run`, `/review-desk/{runId}`, `/voice-pass/{runId}` still work with no "Mark reviewed" button anywhere.
why_human: Every item has strong automated coverage (the `in-place edit` / `group accept` / `nav` describes, the StoryDeskGrid / StoryFocusView / ReviewDeskRunView tests, a green strict build with every v4.0 route in the route table), but none of it has been seen rendered in a browser.
result: [pending]

### 5. ClaimProvenanceCard raw-URL decision (open product judgement)
expected: A decision — either the change is fine as shipped, or it needs a follow-up. Plan 51-07 extended the shared `components/provenance/ClaimProvenanceCard.tsx` to render the raw `sourceUrl` as visible text (a new line beneath the untouched derived-publisher line), required to satisfy its own locked evidence-card test. That card is mounted by Review Desk Stage 3 Fact Check, Stage 5 Approval, and Voice Pass.
why_human: Not a code defect — the change is additive, no test broke, the build is clean, and it could not be forked per-caller under the reuse discipline (D-09/D-16), so it landed in the one shared component and reached three other consoles as a side effect. Whether a raw URL reads acceptably on those v4.0 surfaces is a product/design call nobody has made.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 5

## Gaps

None of these represent unfinished engineering. Phase 51's automated gate was
independently re-run by both the 51-06 integration gate and 51-VERIFICATION.md:
148 test files / 1245 tests passed / 0 failed, `pnpm --filter dispatch-control build`
exit 0, and all ten invariant source-scans clean. What is missing is the perceptual
layer and one product decision.
