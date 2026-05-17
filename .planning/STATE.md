---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
stopped_at: Completed 05-agent-quality-06-PLAN.md (Scout real Tavily implementation; AGT-03/04/18 mechanically proven; 5 tests pass)
last_updated: "2026-05-17T18:24:15.706Z"
progress:
  total_phases: 9
  completed_phases: 4
  total_plans: 53
  completed_plans: 45
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09)

**Core value:** Every Thursday, ship a complete, on-voice issue: one obscure charity, eight original sections, and a working shop callout — published only after Andrew's manual review.
**Current focus:** Phase 05 — agent-quality

## Current Position

Phase: 05 (agent-quality) — EXECUTING
Plan: 7 of 15

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
| Phase 03 P01 | 3 | 3 tasks | 7 files |
| Phase 03-convex-deployment P03 | 7 | 5 tasks | 5 files |
| Phase 03-convex-deployment P05 | 6 | 4 tasks | 4 files |
| Phase 03-convex-deployment P06 | 7 | 3 tasks | 4 files |
| Phase 03-convex-deployment P07 | 4 | 2 tasks | 2 files |
| Phase 04-pipeline-skeleton P01 | 4 | 4 tasks | 12 files |
| Phase 04-pipeline-skeleton P04 | 6 | 2 tasks | 2 files |
| Phase 04-pipeline-skeleton P03 | 3m | 4 tasks | 4 files |
| Phase 04-pipeline-skeleton P05 | 3 | 2 tasks | 9 files |
| Phase 04 P02 | 5min | 5 tasks | 9 files |
| Phase 04 P06 | 12 | 3 tasks | 5 files |
| Phase 04-pipeline-skeleton P04-08 | 6min | 4 tasks | 4 files |
| Phase 04 P07 | 8min | 6 tasks | 15 files |
| Phase 04 P09 | 9 | 4 tasks | 5 files |
| Phase 04-pipeline-skeleton P10 | 15 | 4 tasks | 6 files |
| Phase 04-pipeline-skeleton P11 | 3min | 2 tasks | 2 files |
| Phase 05-agent-quality P02 | 3 | 3 tasks | 4 files |
| Phase 05-agent-quality P01 | 10min | 4 tasks | 3 files |
| Phase 05-agent-quality P03 | 24min | 7 tasks | 7 files |
| Phase 05-agent-quality P04 | 11min | 3 tasks | 25 files |
| Phase 05-agent-quality P05 | 12min | 2 tasks | 3 files |
| Phase 05-agent-quality P07 | 4 | 2 tasks | 3 files |
| Phase 05-agent-quality P06 | 4min | 2 tasks | 2 files |

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
- [Phase 03]: convex/ promoted to pnpm workspace @eisenbalm/convex with convex@^1.38.0 pin (D-01, D-05); _generated/ explicitly preserved by convex/.gitignore (D-08); both .env.example files document NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY with explicit security wording (D-20, D-21)
- [Phase 03-convex-deployment]: Plan 03-03: Five Convex query/mutation files written byte-for-byte from API_CONTRACTS §4.1-4.5 (D-10); v.literal enums match schema.ts verbatim (D-11); Date.now() injected server-side on all inserts (D-12); pipelineRuns.updateStatus throws on missing run (D-13); codegen verified via convex dev --once; _generated/ NOT committed (Plan 03-04 owns)
- [Phase 03-convex-deployment]: Plan 03-05: Module-scope ConvexReactClient construction in 'use client' wrapper (one websocket per browser session, no per-render leak); D-16 fallback renders children unwrapped when NEXT_PUBLIC_CONVEX_URL is missing — verified by stripping env var and running pnpm build (exits 0 with all 13 routes generated); @convex/* path alias resolves under Next 15 Bundler resolution
- [Phase 03-convex-deployment]: Plan 03-06: Next.js 15 App Router private-folder mismatch (Pitfall 7 inverted): literal _debug folder is excluded from routing regardless of page.tsx presence — renamed source folder to %5Fdebug per Next docs %5F-escape so URL stays /_debug/convex; all URL-based contracts (robots.txt, sitemap/feed markers, Plan 03-08 smoke URL) unchanged
- [Phase 03-convex-deployment]: Plan 03-06: /_debug/convex page uses inline <meta name='robots' content='noindex,nofollow'> in JSX rather than metadata export — Client Components don't run metadata exports but inline <meta> elements are surfaced to <head> by Next.js
- [Phase 03-convex-deployment]: Plan 03-07: convex/README.md documents the dev: (not prod:) form of CONVEX_DEPLOY_KEY per Plan 03-02 Deviation 1; both READMEs document the %5Fdebug Next.js 15 private-folder escape so future engineers don't 'fix' it back to _debug; Phase 9 cleanup contract is locked in 4 redundant locations (page.tsx TODO + both READMEs + convex/README.md footer)
- [Phase 03-convex-deployment]: Plan 03-07: PRIMARY placement used for ## Convex section in apps/web/README.md (after ### Reading time, before ### SEO and structured data — both anchors verified to exist); accepted side effect that this terminates ## Architecture notes earlier than Phase 2 layout
- [Phase 04-pipeline-skeleton]: Plan 04-01: Added research §1 sub-deps (langgraph-checkpoint-postgres==3.1.0, psycopg[binary]>=3.2,<4) that CONTEXT D-04 omits — required by AsyncPostgresSaver
- [Phase 04-pipeline-skeleton]: Plan 04-01: railway.toml uses preDeployCommand=['python -m eisenbalm_pipeline.cli setup-checkpointer'] (RESEARCH §9, CONTEXT D-12) — idempotent, runs once per deploy in actual Docker image vs railway run fallback
- [Phase 04-pipeline-skeleton]: Plan 04-01: .env.example documents transaction-pooler (port 6543) and direct-connection variants as WRONG with full rationale (Pitfalls 1+2) — defensive onboarding so engineers don't pick the broken URL format
- [Phase 04-pipeline-skeleton]: Plan 04-04: pipelineMetadata.cost added as type 'text' (JSON-stringified) mirroring modelVersions; pnpm typegen succeeded on first attempt — no manual fallback needed; @eisenbalm/shared pre-existing tsc errors out of scope
- [Phase 04-pipeline-skeleton]: Plan 04-03: Pushed Convex patch to dev deployment (modest-magpie-797) via 'convex dev --once' rather than prod (wonderful-wolverine-947); dev is the deployment all consumers actually use per Phase 3 D-04 / Plan 03-02 Deviation 1, and 'convex deploy' requires interactive prod confirmation.
- [Phase 04-pipeline-skeleton]: Plan 04-05: Adopted research §10 ASGITransport in-process client verbatim — Plan 10 consumes conftest.py as-is, no fixture modifications needed
- [Phase 04-pipeline-skeleton]: Plan 04-05: Defensive fixture skips on missing env vars — REQUIRED_ENV_VARS tuple, first-missing wins skip reason; pytest stays green from day one across all Wave 1-3 commits
- [Phase 04-pipeline-skeleton]: Plan 04-05: Editor split into 2 parametrize cases (editor_gate_1, editor_final) — PIP-04 test produces 15 cases not 14, matches CONTEXT D-05 gate-1+final convention
- [Phase 04]: Plan 04-02: DispatchState matches API_CONTRACTS §7 verbatim plus two underscore-prefixed test toggles (_force_no_winner, _force_fail_agent). API_CONTRACTS not amended.
- [Phase 04]: Plan 04-02: set_charity_first_featured uses Sanity-native setIfMissing (atomic) rather than API_CONTRACTS §2.5's GET-check-set pattern — same observable result, no extra round-trip.
- [Phase 04]: Plan 04-02: Convex client branches on body.get('status') != 'success' for error detection (HTTP 200 + status field — Pitfall 7), not on response.status_code. Auth header is 'Convex {KEY}', NOT Bearer.
- [Phase 04]: Plan 04-06: @agent_node decorator signature is locked (kwargs-only: name, emit_event, payload_builder, max_tool_calls); Phase 5 only changes agent function bodies. Emit happens AFTER fn returns so interrupt() resume re-runs are idempotent.
- [Phase 04]: Plan 04-06: 15 fixture functions (Editor split into gate-1 + final per CONTEXT D-05) reuse Phase 2 demo charity 'The Quiet Foundation' so stub runs don't pollute the charity database; Calibrator hardcoded to bonusType='bigBudget' per CONTEXT D-16.
- [Phase 04-pipeline-skeleton]: validate_sections placed under agents/ (not graph/) — co-locates all graph nodes while remaining structurally distinct (no @agent_node decorator, no deliberation event, no agentId)
- [Phase 04-pipeline-skeleton]: Pattern A plain multi-target add_edge for 7-writer fan-out (no Send API, no Annotated reducers) — Phase 4 has a fixed 7 writers each mutating a distinct DispatchState field
- [Phase 04-pipeline-skeleton]: Dual AsyncPostgresSaver patterns coexist: cli.py uses from_conn_string async-with (one-shot DDL), graph/checkpointer.py uses AsyncConnectionPool + AsyncPostgresSaver(pool) (long-lived lifespan)
- [Phase 04-pipeline-skeleton]: Defensive psycopg pool kwargs (prepare_threshold=None, autocommit=True, row_factory=dict_row) — degrades gracefully if env ever points at Supabase transaction pooler instead of session pooler (Pitfall 1)
- [Phase 04]: Editor gate 1 places idempotent pipelineRuns:updateStatus BEFORE interrupt() and non-idempotent pitchLog:markSelected AFTER interrupt() resolves (research §2 anti-pattern compliance)
- [Phase 04]: _force_fail_agent test toggle handled centrally by @agent_node wrapper, not duplicated in every agent body
- [Phase 04]: Publisher does NOT manually write status='failed' on Sanity exception — wrapper's generic failure path handles it with CONTEXT D-27 errorMessage format (avoid double-write)
- [Phase 04]: Plan 04-09: asyncio.create_task chosen over FastAPI BackgroundTasks (CONTEXT D-06 planner discretion; research §3 + Pitfall 4 — BackgroundTasks cancels on client disconnect, can strand pipelineRuns.status='running'). Tasks strong-ref'd in app.state.background_tasks with add_done_callback(discard).
- [Phase 04]: Plan 04-09: FastAPI lifespan degrades gracefully — missing SUPABASE_POSTGRES_URL or unreachable Supabase logs a warning and boots with app.state.graph=None so /healthz responds and the test-suite import succeeds; /run/weekly + /run/{runId}/resume return 503 via _require_graph guard.
- [Phase 04]: Plan 04-09: _require_trigger_secret skips the X-Pipeline-Trigger-Secret check (logged warning) when PIPELINE_TRIGGER_SECRET is unset, so local dev works without provisioning the secret; enforced 401 in any environment that sets it.
- [Phase 04-pipeline-skeleton]: Plan 04-11: packages/pipeline/README.md rewritten as canonical onboarding doc (CONTEXT D-40) — env var table, Supabase session-pooler sharp-edge warning (5432 vs 6543 vs IPv6 direct), one-time setup-checkpointer, verbatim CONTEXT D-42 smoke test that Plan 12 follows; apps/web/README.md amended (additive) noting CONVEX_DEPLOY_KEY shared with Railway pipeline; root .env.example verified complete, no edit needed
- [Phase 05-agent-quality]: Canonical langchain-tavily import at 0.2.18 is 'from langchain_tavily import TavilySearch' — Plan 05-03 search_client.py uses directly, no fallback wiring needed
- [Phase 05-agent-quality]: ResearchOutput uses NotRequired[Optional[T]] (PEP 655 Python 3.11) for 7 new verification fields rather than class splitting — simpler, single-file edit
- [Phase 05-agent-quality]: EISENBALM_STUB_MODE=false documented in .env.example as Phase 5 default, but runtime default flip deferred to Plan 05-14 — keeps onboarding doc aligned with target state
- [Phase 05-agent-quality]: Plan 05-01 close-out (retroactive): Convex schema patched in lockstep across schema.ts + insert mutation validators; deliberationEvents.eventType extended to 9 literals (adds cost-warning, agent-tool-limit-exceeded); qaCorrections refactored to Phase 5 annotation-only shape (severity info|warning|error; 4 new optional fields agentId/axis/quotedSpan/suggestedFix; legacy fieldName/original/corrected demoted to optional); dev deploy modest-magpie-797 verified clean via pnpm --filter @eisenbalm/convex dev:once
- [Phase 05-agent-quality]: Plan 05-03: 7 lib modules land (errors, llm_config, voice, openrouter_client, search_client, wcag; cost.py additively extended). Single LLM call site (acomplete), single web-search call site (web_search), single section-prompt assembler (build_section_writer_prompt with kwargs-only AGT-09 signature). WCAG 0.03928 threshold matches apps/web/lib/theme.ts byte-for-byte. Phase 4 cost.py surface preserved.
- [Phase 05-agent-quality]: Plan 05-03 open TODO: with_structured_output token capture is approximate (zeros recorded on structured-output path because langchain-openai 1.2.1 doesn't expose usage_metadata on the wrapper). Plain-text acomplete path captures full input_tokens/output_tokens from result.usage_metadata. Plan 05-14 real-mode integration test should measure Sonnet vs. Haiku reliability and figure out include_raw=True or a metadata-capture sidechannel.
- [Phase 05-agent-quality]: Plan 05-04: agents/design.py promoted to agents/design/ package — __init__.py preserves Phase 4 stub body verbatim so graph/builder import contract is unchanged; agents/design/font_whitelist.py ships candidate list with TODO(Andrew) marker (D-16 blocker removed from critical path; final approval moves to Plan 05-15)
- [Phase 05-agent-quality]: Plan 05-04: Wave 0 test surface (21 skeletons + 6 mock fixtures) ships skip-marked; implementing plans (05-05..05-14) unskip + add assertions atomically. pytest --collect-only collects 68 tests with zero import errors throughout phase
- [Phase 05-agent-quality]: Plan 05-05: First voice-critical agent body landed (Calibrator). AGT-17 modelVersions write pattern established — model_versions = dict(state.get('model_versions') or {}); model_versions[agent_id] = usage['resolved_model']. Plans 05-08 (editor_gate1) and 05-13 (qa + editor_final) inherit verbatim.
- [Phase 05-agent-quality]: Plan 05-05: lib/sanity_client.groq_query() helper landed — single read-only GROQ call site. Module-level shared AsyncClient fast-path with one-shot fallback for unit tests + direct agent calls. Plan 05-06 Scout dedup query reuses.
- [Phase 05-agent-quality]: Plan 05-05: Pydantic StyleBriefOutput uses field defaults (default='', default_factory=list, bonusType='bigBudget') so Pydantic.model_construct() succeeds in stub mode (FakeOpenRouterClient skips validation). Real-mode validation still rejects malformed LLM JSON via with_structured_output. Pattern applies to all voice-critical agents using response_format.
- [Phase 05-agent-quality]: Plan 05-07 (Advocate): vote='for' enforced (not 'yes' from plan prose) — Convex schema validator + API_CONTRACTS §3.5 win per CLAUDE.md precedence. Score field NOT in agentVotes (schema has no score column); recoverable from deliberationEvents payload
- [Phase 05-agent-quality]: Plan 05-07 (Advocate): Single Haiku call over all candidates (not per-candidate) — cost containment per CONTEXT D-08; AdvocateOutput Pydantic enforces score 1-10 + 2-4 keyStrengths at parse time
- [Phase 05-agent-quality]: Plan 05-06: GROQ load implemented inline via raw httpx GET (lib/sanity_client.py has no groq_query helper yet); pattern can be promoted to lib when Plan 05-09 Researcher needs reads. AgentToolCallLimitExceeded raised pre-loop (BEFORE the 9th tool call) with introspectable .agent_id/.attempts/.limit; tests assert all three. featured_charity_keys persisted as sorted list[str] (NOT set) for JSON-safe LangGraph checkpoint per RESEARCH Pitfall 7. acomplete call site adapted to kwargs-only signature (plan template showed positional form).

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 5] Font whitelist (~25 fonts safe for web + WeasyPrint) must be approved by Andrew or designer before Phase 5 closes — DesignAgent cannot be finalized without it
- [Phase 6] Andrew must configure Stripe product, price ID, and shipping rates in the Stripe dashboard before Phase 8 code can complete
- [Phase 2] `/about` page copy not specified in brief; Andrew must provide before Phase 2 closes
- [Phase 5] Per-run LLM cost baseline unknown until first real OpenRouter runs; alert threshold to be set after baseline measured

## Session Continuity

Last session: 2026-05-17T18:24:15.700Z
Stopped at: Completed 05-agent-quality-06-PLAN.md (Scout real Tavily implementation; AGT-03/04/18 mechanically proven; 5 tests pass)
Resume file: None
