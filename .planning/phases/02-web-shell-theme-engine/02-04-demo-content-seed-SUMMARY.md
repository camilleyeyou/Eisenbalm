---
phase: 02-web-shell-theme-engine
plan: 04
subsystem: studio-scripts
tags: [seed, sanity, demo, content, idempotent]
dependency_graph:
  requires:
    - 01-06-agent-seed (seed-agents.ts pattern mirror)
    - apps/studio/.env.local (SANITY_API_TOKEN)
  provides:
    - charity-demo-quiet-foundation (Sanity document _id)
    - issue-001-demo (Sanity document _id, slug issue-1)
  affects:
    - 02-06-issue-route (needs issued content to render)
    - 02-07-archive-route (needs published issues)
    - 02-08-charities-routes (needs charity document)
    - 02-11-readme-and-smoke-test (references seed:demo step)
tech_stack:
  added: []
  patterns:
    - "tsx --env-file=.env.local for script env loading"
    - "createOrReplace with deterministic _ids for idempotency"
    - "Portable Text via textToPortableTextBlock() + randomUUID() _key"
key_files:
  created:
    - apps/studio/scripts/demo-content.json
    - apps/studio/scripts/seed-demo-content.ts
  modified:
    - apps/studio/package.json
    - package.json
decisions:
  - "seed:demo NOT executed automatically — Andrew or engineer runs pnpm seed:demo when ready (production dataset write; requires valid SANITY_API_TOKEN)"
  - "bonusType set to jingle to exercise lyrics+sunoPrompt path and empty sunoAudioUrl 'audio coming soon' state in Plan 02-06"
  - "pipelineMetadata intentionally omitted — Phase 4 populates real values"
  - "firstFeaturedIn back-reference on charity deferred to Publisher agent Phase 6"
metrics:
  duration_minutes: 2
  tasks_completed: 3
  files_created: 2
  files_modified: 2
  completed_date: "2026-05-12T03:44:09Z"
---

# Phase 02 Plan 04: Demo Content Seed Summary

Idempotent demo content seed for the Sanity production dataset — one stub charity and one stub published `weeklyIssue` with a recognizable cream/navy/mustard theme, so the Phase 2 web shell has content to render without waiting for Phase 4 pipeline execution.

## What Was Built

### `apps/studio/scripts/demo-content.json`

Source content (separated from logic per D-18) containing:

- Fictional charity "The Quiet Foundation" — rural acoustic preservation, Gallup NM, founded 1987
- Jesse-voice placeholder copy across all eight editorial sections — dry, precise, no exclamation marks
- Cream/navy/mustard theme: `#F5EEDC` bg / `#14213D` primary / `#FCA311` accent / `#1A1A18` text
- `bonusType: "jingle"` to exercise the lyrics + sunoPrompt path

### `apps/studio/scripts/seed-demo-content.ts`

Idempotent Sanity writer mirroring `seed-agents.ts` structure:

- Reads env from `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_API_TOKEN`
- Fast-fails with actionable error on missing env vars
- `createOrReplace` with deterministic `_id`s — idempotent on re-run
- Writes charity first, then issue (which references charity by `_id`)
- `textToPortableTextBlock()` with `randomUUID()` for `_key` values per Sanity PT spec

### Package.json scripts

- `apps/studio/package.json`: `"seed:demo": "tsx --env-file=.env.local scripts/seed-demo-content.ts"`
- `package.json` (root): `"seed:demo": "pnpm --filter studio seed:demo"`

## Deterministic IDs

| Document type | `_id` | Slug |
|---|---|---|
| charity | `charity-demo-quiet-foundation` | `the-quiet-foundation` |
| weeklyIssue | `issue-001-demo` | `issue-1` |

## Demo Theme

| Variable | Value | Purpose |
|---|---|---|
| `primaryColor` | `#14213D` | Deep navy — headlines, borders |
| `accentColor` | `#FCA311` | Mustard — shop button only |
| `backgroundColor` | `#F5EEDC` | Warm cream — page bg |
| `textColor` | `#1A1A18` | Near-black — body copy |
| `fontDisplay` | `DM Serif Display` | Editorial headlines |
| `fontBody` | `Merriweather` | Body copy |

WCAG AA contrast `#1A1A18` on `#F5EEDC` ≈ 14:1 — well above 4.5:1 threshold.

## Bonus Type Choice

`bonusType: "jingle"` was selected because:

1. Exercises the `lyrics` + `sunoPrompt` fields that the jingle branch uses
2. Empty `sunoAudioUrl` exercises the "audio coming soon" empty state in Plan 02-06
3. Tests both player states (audio present / audio absent) before Phase 4 delivers real content

## How to Run

```bash
# From repo root
pnpm seed:demo

# Expected output:
# Seeding demo content into 6h1vd9mf/production…
#   ✓ charity-demo-quiet-foundation
#   ✓ issue-001-demo
#
# Seeded 2/2 demo documents.
# Visit /issue/issue-1 to render the demo issue.
```

The script is idempotent — running it twice produces identical documents.

## Deviations from Plan

### Deviation: Seed not executed automatically

**Found during:** Task 3

**Issue:** The plan's critical rules explicitly stated "SAFER: write the script, do NOT execute it. Document in SUMMARY that engineer/Andrew runs pnpm seed:demo when ready." This overrides the plan's Task 3 execute step.

**Fix:** Script written and wired. Execution deferred to Andrew or the engineer.

**Files modified:** None (no deviation to code — this is a process decision)

## Known Stubs

None — all fields required by the `weeklyIssue` schema are populated. Two intentional non-stubs documented:

1. `pipelineMetadata` — intentionally absent. Phase 4 populates real values. Sanity schema marks all subfields optional.
2. `sunoAudioUrl: ""` — intentionally empty. Exercises the "audio coming soon" empty state. Phase 4/5 BonusWriter populates the real URL.
3. `firstFeaturedIn` on the charity — intentionally absent. Publisher agent (Phase 6) sets this after publication.

These are intentional placeholders, not stubs that prevent the plan's goal. The demo issue renders fully against the theme engine once Wave 3 routes land.

## Self-Check: PASSED

Files exist:
- `apps/studio/scripts/demo-content.json` — FOUND
- `apps/studio/scripts/seed-demo-content.ts` — FOUND

Commits:
- `3616de9` — feat(02-04): create demo-content.json
- `25fb0da` — feat(02-04): create seed-demo-content.ts
- `33eb3a0` — chore(02-04): add seed:demo script to package.json files
