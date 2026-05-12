---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Awaiting human verification
stopped_at: "02-11-readme-and-smoke-test-PLAN.md — Task 1 committed (b07a9e6); blocked at Task 2 checkpoint:human-verify (Andrew must run 16-item smoke test)"
last_updated: "2026-05-11T00:00:00.000Z"
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 18
  completed_plans: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09)

**Core value:** Every Thursday, ship a complete, on-voice issue: one obscure charity, eight original sections, and a working shop callout — published only after Andrew's manual review.
**Current focus:** Phase 02 — web-shell-theme-engine

## Current Position

Phase: 02 (web-shell-theme-engine) — EXECUTING
Plan: 11 of 11

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: — min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 1 | 3 tasks | 4 files |
| Phase 01 P04 | 5 | 3 tasks | 10 files |
| Phase 01 P03 | 6 | 4 tasks | 13 files |
| Phase 01 P05 | 30 | 3 tasks | 4 files |
| Phase 01 P06 | 3 | 2 tasks | 2 files |
| Phase 02-web-shell-theme-engine P02-02 | 196 | 4 tasks | 4 files |
| Phase 02 P04 | 2 | 3 tasks | 4 files |
| Phase 02 P01 | 6 | 3 tasks | 8 files |
| Phase 02-web-shell-theme-engine P03 | 4 | 2 tasks | 2 files |
| Phase 02 P05 | 987 | 8 tasks | 17 files |
| Phase 02 P07 | 12 | 3 tasks | 4 files |
| Phase 02-web-shell-theme-engine P09 | 8 | 4 tasks | 4 files |
| Phase 02-web-shell-theme-engine P08 | 179 | 4 tasks | 4 files |
| Phase 02 P06 | 7m | 7 tasks | 13 files |
| Phase 02 P10 | 18 | 4 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Merged research's 10 phases into 9 by combining Phase 9 (Deliberation Layer) and Phase 10 (Podcast Section) — both are issue-page UI completion work with no ordering dependency between them; merged phase still satisfies `standard` granularity tolerance
- Roadmap: Phase 8 (Stripe) is independent of Phases 3-7; can begin immediately after Phase 2 closes
- Roadmap: Phases 6 and 7 both depend only on Phase 5 and can be planned/executed in parallel after Phase 5
- [Phase 01]: pnpm pinned at 9.15.4 (current 9.x LTS); convex/ excluded from workspace globs (stays at root); apps/studio/.env.example deferred to Plan 03; sanity.types.ts preserved from gitignore (D-08)
- [Phase 01]: packages/shared uses source-resolution (.ts main/types) — no build step needed for placeholder content before Plan 05 wires TypeGen
- [Phase 01]: packages/pipeline has no @eisenbalm/shared dep — Python pipeline consumes Sanity types via HTTP API, not npm (cross-language type sharing is Phase 4 concern)
- [Phase 01]: Schema relocation (D-09): schemas moved to apps/studio/schemas/ byte-for-byte; agentProfile D-11 description fix applied; repo-root schemas/ deleted
- [Phase 01]: sanity.config.ts fast-fails with descriptive error if SANITY_STUDIO_PROJECT_ID is unset — prevents silent Studio misbehavior
- [Phase 01]: apps/studio/.env.example checked in per D-21 (gitignore negation); lists SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET=production, SANITY_API_TOKEN
- [Phase 01]: D-12 correction: sanity.cli.ts schema.path = './schema.json' (not './sanity.types.ts' — typegen writes TS to package root by default)
- [Phase 01]: [Phase 01]: sanity.types.ts manually generated from schema analysis due to ECONNRESET network constraint; must be regenerated with pnpm typegen when network is restored
- [Phase 01]: D-17/D-18 seeding: deterministic _id agent-{agentId} with createOrReplace; agents.json holds copy for non-dev editing; seed executed live against 6h1vd9mf/production (14/14, idempotent confirmed)
- [Phase 01 Plan 07]: Cloud deploy URL not captured — Andrew's local smoke test against production dataset satisfied all four FND criteria; deploy deferred to Andrew's discretion
- [Phase 01 Plan 07]: Plan 06 follow-up fix committed (75b4a08): tsx --env-file=.env.local required for seed:agents to load .env.local in user shell context
- [Phase 02-02]: defineLive deferred to Phase 9: CONTEXT.md D-16 keeps Convex out of Phase 2; GROQ result types hand-written against projections (not TypeGen GA) for Wave 3 immediate type safety
- [Phase 02]: seed:demo not executed automatically — production dataset write deferred to Andrew or engineer via pnpm seed:demo
- [Phase 02]: Demo issue uses bonusType jingle to exercise empty sunoAudioUrl empty-state path in Plan 02-06
- [Phase 02]: lucide-react pinned to ^1.14.0 (plan specified ^0.450.0 which does not exist on npm; bumped to current stable)
- [Phase 02]: tsconfig.moduleResolution: Bundler overrides NodeNext from base — required for Next 15 App Router + Tailwind v4 compatibility
- [Phase 02-web-shell-theme-engine]: validateHex returns string|null rather than boolean so callers can use the value directly without double-lookup
- [Phase 02-web-shell-theme-engine]: WCAG fallback applies to bg+text only; primary+accent retain validated values since they are not body-text colors
- [Phase 02]: shadcn CLI v3 is fully interactive; hand-wrote button+tooltip primitives and installed transitive deps manually
- [Phase 02]: Reading time uses 238 WPM per UI-SPEC (overrides CONTEXT.md D-24 200 WPM reference — UI-SPEC is locked)
- [Phase 02]: Globals.css includes shadcn variable shim (--background, --foreground) to prevent button/tooltip color miss
- [Phase 02]: Empty-list state in RSC; empty-search state in client ArchiveList — clean RSC/client boundary
- [Phase 02-web-shell-theme-engine]: Inline QUERY_LATEST_CHARITY_NAME in shop/page.tsx — single consumer, Phase 8 rewrites page
- [Phase 02-web-shell-theme-engine]: ShopCallout accepts optional charityName prop — fallback to generic copy when null
- [Phase 02-web-shell-theme-engine]: NGO JSON-LD omits null fields via spread conditionals; foundingDate cast to String() per schema.org spec
- [Phase 02-web-shell-theme-engine]: Filtering UI on /charities deferred to v2 per UI-SPEC (dataset < 50 entries)
- [Phase 02-06]: Used details/summary for deliberation accordion (zero-JS progressive enhancement) instead of shadcn Accordion
- [Phase 02-06]: GameSlot iframe hidden in Phase 2 but sandbox='allow-scripts' correct from day 1; Phase 7 surfaces after validator lands
- [Phase 02]: QUERY_FEED is inline in feed.xml/route.ts (not in canonical queries.ts) to avoid mutating API_CONTRACTS.md §1.3 shape
- [Phase 02]: client.ts uses placeholder projectId fallback so createClient does not throw at module load in unconfigured builds
- [Phase 02]: og-default.png is a 1200x630 off-white placeholder PNG; Andrew replaces with real brand artwork before launch

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 5] Font whitelist (~25 fonts safe for web + WeasyPrint) must be approved by Andrew or designer before Phase 5 closes — DesignAgent cannot be finalized without it
- [Phase 6] Andrew must configure Stripe product, price ID, and shipping rates in the Stripe dashboard before Phase 8 code can complete
- [Phase 2] `/about` page copy not specified in brief; Andrew must provide before Phase 2 closes
- [Phase 5] Per-run LLM cost baseline unknown until first real OpenRouter runs; alert threshold to be set after baseline measured

## Session Continuity

Last session: 2026-05-11T00:00:00.000Z
Stopped at: 02-11 Task 1 done (b07a9e6); checkpoint:human-verify for Task 2 (16-item smoke test)
Resume file: None
