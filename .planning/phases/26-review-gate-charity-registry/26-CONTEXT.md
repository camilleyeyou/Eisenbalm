# Phase 26: Review Gate + Charity Registry - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the existing `awaiting-review` run state into an **operator decision gate** on
`apps/dispatch-control`, and add a **Convex charity registry** the Scout deduplicates
against. Deliver the seven RVW-* / REG-* capabilities:

- **RVW-01 — Review-by-default.** `require_review` on by default; a finished run lands
  in `awaiting-review` (already true today) and appears in a review queue rather than
  auto-publishing.
- **RVW-02 — Rendered preview + cost.** Operator sees a full rendered preview of the
  issue (real layout, including deliberation) plus the run cost before deciding.
- **RVW-03 — Decision actions.** From the review screen: approve-and-publish,
  approve-and-schedule, reject, or re-roll a section.
- **RVW-04 — `auto_publish` friction.** Off by default; enabling it takes a modal
  confirmation, is rate-limited, is audit-logged, emits an alert event, and the
  dashboard makes the enabled state visually alarming.
- **RVW-05 — Factual-claims checklist.** Every number / proper name / date in the
  finished issue is surfaced as a sign-off checklist; the operator checks (or skips)
  each before the approve action is enabled.
- **REG-01 — Charity registry.** Operator manages charities with states
  candidate / featured / blocklisted, plus `timesFeatured`, `lastFeaturedAt`, and a
  dedup key.
- **REG-02 — Scout dedup.** The Scout consults the registry at run start so an
  already-featured or blocklisted charity is not selected again.

**Enabling facts found in the codebase (shape the decisions below):**
- Runs ALREADY land in `awaiting-review` (Editor gate + publisher node write it;
  `convex/schema.ts:11`, `pipelineRuns.ts:33`). RVW-01 is largely already true.
- `require_review` (default `True`) and `auto_publish` (default `False`) ALREADY exist
  as `RunConfig` fields + `pipeline_config` reads (`lib/config_loader.py:67,68,275,
  276,395,396`).
- Convex schema ALREADY STUBS the Phase-26 tables (shape-only, no mutations yet):
  `charities` (`name/status/timesFeatured/lastFeaturedAt`, `schema.ts:320`) and
  `review_actions` (`runId/actorId/action/note/timestamp`, `schema.ts:341`).
- A proven publish chain exists: flipping Sanity `weeklyIssue.status='published'` fires
  the Sanity webhook → `_run_publisher` (PDF render + Vercel deploy). There is also a
  manual `/run/{runId}/publish` path. (`api/webhooks.py`, `agents/publisher/__init__.py`.)
- The Scout currently dedups against PUBLISHED Sanity issues via one GROQ query joining
  `weeklyIssue.charity → charity`, with bare-domain normalization
  (`agents/scout.py:96,126,136,220`). No registry is consulted today.
- Phase 25 provisions an hourly, kill-switch-gated `/pipeline/tick` (the reusable
  scheduled-work entry point).
- `audit_log` infra + `convex/auditLog.ts:record` (Phase 23/25) is the shared
  action-trail writer.

**Explicitly NOT in scope (later phases / deferred):**
- Slack/email **notification transport** (run-complete/failed/awaiting-review + budget)
  — Phase 27 (NTF-01/02). Phase 26 emits the `auto_publish`-enabled alert as a Convex
  event; transport hooks on in 27 (mirrors Phase 25 D-09).
- Stripe donation reconciliation + `model_pricing` staleness — Phase 27 (RCN/Money).
- Web-search-backed claim verification — out this phase (RVW-05 ships the human
  sign-off checklist only; brief calls web-search "optional").
- Re-rolling upstream nodes or auto re-running QA/editor_final after a section re-roll —
  re-roll reuses Phase 25 RUN-05 (section writers only).
- Editable graph topology / per-agent enable-disable UI — productization / later.

</domain>

<decisions>
## Implementation Decisions

### Publish & schedule mechanism (RVW-03)
- **D-01: Approve-and-publish flips Sanity status → reuses the webhook chain.** The
  dashboard publish endpoint sets `weeklyIssue.status='published'` in Sanity; the
  existing Sanity webhook → `_run_publisher` (PDF + Vercel deploy) fires. Single proven
  publish codepath — dashboard and Studio converge on one path; zero new deploy logic.
- **D-02: Approve-and-schedule fires via the Phase 25 `/pipeline/tick` sweep.** Store
  the scheduled publish time; the already-running hourly tick also checks for due
  scheduled publishes and fires the same publish path (D-01). Reuses the cron — no new
  scheduler. (Exact storage of the scheduled time — an additive `runs` field vs a
  dedicated scheduled-publish record — is a planning/research detail within this
  decision.)

### Charity registry source-of-truth (REG-01 / REG-02)
- **D-03: Convex `charities` is the authoritative dedup/state layer.** On publish (the
  D-01 path), upsert the featured charity into the registry: `status='featured'`,
  increment `timesFeatured`, set `lastFeaturedAt`. The Scout queries the registry and
  skips featured + blocklisted entries. A one-time backfill seeds the registry from
  existing published Sanity charities. Sanity `charity` docs remain the canonical
  CONTENT record (name, mission, etc.); the registry owns dedup/state. Directly
  satisfies REG-02 ("Scout consults the registry").
- **D-04: Dedup key = normalized name + bare domain.** Match on case-folded normalized
  name OR bare website domain (reuse the existing `scout.py:96` domain normalization).
  Catches both renamed-domain and reworded-name duplicates. (Implies additive fields on
  the `charities` table — website/domain + a dedup-key field + an optional link to the
  Sanity charity slug; the table is Phase-26-owned, so additive change is fine — still
  amend `docs/API_CONTRACTS.md` first.)
- **D-05: Scout logs its considered candidates as `status='candidate'`.** The Scout
  upserts the charities it pitched (reusing the existing `pitchLog` concept) as
  candidates so the operator sees the funnel and can pre-blocklist. Makes the
  `candidate` state meaningful, not just operator-set.

### Factual-claims checklist (RVW-05)
- **D-06: Deterministic extraction.** A regex/NLP pass surfaces every number, date
  pattern, and proper-noun sequence from the issue text — guarantees the "every
  number/name/date" acceptance bar literally (full recall), zero token cost,
  predictable. The operator skips non-claims. (No LLM extraction — recall isn't
  guaranteed and "every" is the bar.)
- **D-07: Extraction runs at pipeline run-end, stored on the run.** A pipeline step
  extracts claims when the run finishes and persists the claim list to Convex so it is
  ready the instant the run hits the review queue. Check-off state (checked / skipped
  per claim) persists in Convex across reloads. (Needs a Convex store for the claim
  list + per-claim sign-off state — a dedicated table or claims-JSON-on-run + a
  checkoff record; planning decides shape, amend API_CONTRACTS first.)
- **D-08: Sign-off checklist only — no web-search verification this phase.** Phase 26
  ships the human check/skip gate that enables the approve action. Web-search-backed
  verification is a later enhancement (brief calls it optional).

### Review preview (RVW-02)
- **D-09: Iframe the real `apps/web` issue page via a token-guarded draft-preview
  route.** Add a guarded preview route on `apps/web` that renders the exact Phase 19
  magazine layout from the Sanity DRAFT (`previewDrafts` perspective); `dispatch-control`
  iframes it. True WYSIWYG — the operator sees exactly what ships. Requires: the guarded
  preview route + Sanity draft-perspective read + a `frame-ancestors` CSP allowing the
  dashboard origin. (No dashboard-native re-render — would drift from `apps/web`.)
- **D-10: Preview-centric layout — decision controls in dashboard chrome.** The
  rendered issue is the centerpiece; cost summary, factual-claims checklist, and the
  approve/schedule/reject/re-roll controls live in dashboard chrome (side panel /
  header) around the iframe. Deliberation + the issue's own content stay inside the
  preview.

### `auto_publish` friction (RVW-04) — Claude's discretion within the brief
- **D-11: Friction now, transport deferred.** Enabling `auto_publish` takes a modal
  confirmation step, is rate-limited, writes an `audit_log` row, and emits an alert
  Convex event; the dashboard renders the enabled state as visually alarming. The
  **email alert transport** is NOT wired here — Phase 26 emits the event, Phase 27
  (NTF) hooks Slack/email onto it (mirrors Phase 25 D-09). Default stays `auto_publish=
  false`.

### Re-roll from the review screen (RVW-03)
- **D-12: Reuse Phase 25 RUN-05.** The review screen's "re-roll a section" action calls
  the existing section-writer re-roll off the LangGraph checkpoint (Phase 25 D-03/D-05,
  `/runs/{id}/agents/{key}/rerun`). No new re-roll mechanics — only the new entry point
  + the re-rolled section re-flowing into the preview.

### Claude's Discretion
- Registry management UI scope (REG-01 "manage"): a `/charities` route in
  dispatch-control with list + state controls (candidate/featured/blocklist toggles) +
  manual add. Full-CRUD vs toggles-first is Claude's call; reuse the Phase 23/24/25
  dashboard patterns + the Clerk-authed control client.
- Exact endpoint shapes/names (`POST /issues/{id}/publish` + `/schedule`, the review
  decision routes, the registry queries the Scout calls) — amend `docs/API_CONTRACTS.md`
  BEFORE coding (CLAUDE.md hard rule).
- Storage shape for scheduled-publish time (D-02) and for the claim list + sign-off
  state (D-07) — additive Convex; document in API_CONTRACTS first.
- Which review actions write `audit_log` / `review_actions` rows (recommend: approve /
  schedule / reject / re-roll / auto_publish-toggle / blocklist at minimum).
- Rate-limit window + exact "visually alarming" treatment for the `auto_publish` toggle.
- Backfill mechanics for seeding the registry from existing published charities (D-03).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 spec & reconciliation (read first)
- `docs/MISSION_CONTROL_BRIEF.md` — §3D (Review gate: `require_review`, rendered preview
  + deliberation + cost + flagged claims, approve/schedule/reject/re-roll, `auto_publish`
  explicit + off by default), §3 "Fact-check / claims gate" (every number/name/date as a
  checklist, optionally web-search-backed), §3 "Charity registry"
  (candidate/featured/blocklisted, timesFeatured, lastFeaturedAt, dedup key — Scout
  checks it), §3 "Issue lifecycle" board, §5 (API surface incl.
  `POST /issues/{id}/publish` · `/schedule`, charity registry roll-ups; data model incl.
  `review_actions`, `charities`), §7 Phase 4 entry, decision #3 (`require_review` on by
  default).
- `docs/CURRENT_STATE.md` — the publish/webhook reconciliation (Sanity status flip →
  `/webhook/sanity-publish` → `_run_publisher`; manual `/run/{runId}/publish`), the
  Scout-dedup-via-GROQ note, the `awaiting-review` landing.

### Research (v2.0 milestone)
- `.planning/research/FEATURES.md` — review-gate + claims-gate + charity-registry
  feature group (complexity, dependencies, anti-features).
- `.planning/research/PITFALLS.md` — publish/deploy idempotency; single-cost-writer
  rule (cost shown in the review preview must read the accurate cost path, never
  recompute); draft-vs-published perspective hazards.
- `.planning/research/ARCHITECTURE.md` — Sanity draft/preview perspective, config-in-
  Convex read path, the publish chain topology.

### Prior phase context (the foundation this phase builds on)
- `.planning/phases/25-run-control/25-CONTEXT.md` — RUN-05 section re-roll (D-12 reuses
  it), the `/pipeline/tick` sweep (D-02), `cancelled`/`awaiting-review` status handling,
  alert-event-vs-transport seam (D-09 → mirrored here as D-11), block-with-explanation.
- `.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md` — Clerk-authed
  dashboard-control client pattern (`pipelineControlClient.ts`/`testRunClient.ts`),
  block-while-running guard, audit-log emission, immutable-version discipline.
- `.planning/phases/23-node-wrappers-read-only-dashboard/23-CONTEXT.md` — `audit_log`
  infra + viewer, single-cost-writer rule, `agent_runs`/run roll-up reads for the cost
  surface, dashboard read patterns.
- `.planning/phases/22-config-externalization/22-CONTEXT.md` — `pipeline_config`
  key/value, `require_review`/`auto_publish` config plumbing, `load_run_config()`
  Convex-first.
- `.planning/phases/21-auth-app-shell-convex-schema/21-CONTEXT.md` — dispatch-control
  shell, Clerk operator identity (actorId for review_actions/audit_log), the stub
  `charities`/`review_actions` table origins, `workspace_id` discipline.

### Existing code / contracts (edit/extension targets)
- `docs/API_CONTRACTS.md` — amend BEFORE code (CLAUDE.md hard rule): the publish/schedule
  endpoints, the review-decision routes, the registry queries the Scout calls, the
  scheduled-publish + claims storage shapes, and any `charities`/`review_actions`
  additive fields. Frozen `pipelineRuns`/`deliberationEvents` shapes unchanged.
- `convex/schema.ts:320` (`charities`) + `:341` (`review_actions`) — stub tables to
  flesh out (additive fields per D-04/D-07); `:220` (`runs`), `:282` (`pipeline_config`).
  Read `convex/_generated/ai/guidelines.md` first.
- `apps/studio/schemas/weeklyIssue.ts:54` — `status` field (`in-review` / `published`);
  the publish flip target (D-01).
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` — `_run_publisher`
  (PDF + Vercel deploy) + the manual publish path (D-01).
- `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` — Sanity `status='published'`
  webhook guard → publisher (D-01).
- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py:96,126,136,220` — current
  GROQ dedup + bare-domain normalization; re-point to the Convex registry (D-03/D-04)
  and log candidates (D-05).
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — Phase 25 control router;
  the review-decision + publish/schedule endpoints land here or a sibling router; reuse
  the re-roll route (D-12) + start-gate/auth patterns.
- `convex/pipelineConfig.ts` — `require_review`/`auto_publish` read+write (D-11).
- `convex/auditLog.ts` — shared audit writer for review actions (D-11).
- `convex/runs.ts` — run status reads for the review queue + cost roll-up.
- `apps/dispatch-control/lib/pipelineControlClient.ts` — Phase 25 Clerk-authed control
  client to extend for review/publish/registry calls.
- `apps/dispatch-control/app/(dashboard)/runs/` — review screen lands near here; a new
  `/charities` route for the registry UI.
- `apps/web/app/issue/[slug]/` — the Phase 19 issue layout the draft-preview route
  renders (D-09).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Convex `charities` + `review_actions` stub tables already exist (shape-only) — flesh
  out with additive fields, no greenfield table design (D-03/D-04/D-07).
- `require_review`/`auto_publish` config + defaults already wired in `config_loader.py`
  — RVW-01/RVW-04 build on existing keys (D-11).
- Runs already land in `awaiting-review` — the review queue reads existing status; no
  new terminal-status plumbing (RVW-01).
- The Sanity status-flip → webhook → `_run_publisher` (PDF + Vercel) chain is proven and
  WHK-tested — approve-and-publish reuses it wholesale (D-01).
- Phase 25 `/pipeline/tick` (hourly, kill-switch-gated) — the scheduled-publish sweep
  reuses it (D-02).
- Phase 25 RUN-05 section re-roll (`/runs/{id}/agents/{key}/rerun`) — review-screen
  re-roll reuses it (D-12).
- Scout's existing GROQ dedup + bare-domain normalization (`scout.py:96`) — the
  dedup-key logic ports to the registry (D-04).
- Phase 24/25 `pipelineControlClient.ts` Clerk-authed pattern + `audit_log` infra —
  review/publish/registry calls + action trail (D-11).

### Established Patterns
- Single cost writer (Phase 23): the cost shown in the review preview reads the accurate
  recorded cost path — never recompute.
- Block-with-explanation over queues (Phase 24 D-02 / Phase 25 D-12) — applies to
  re-roll/publish concurrency guards on the review screen.
- Alert-event-now, transport-later seam (Phase 25 D-09) — `auto_publish`-enabled alert
  emits a Convex event in 26; Phase 27 wires Slack/email (D-11).
- `workspace_id: "eisenbalm"` threaded through all new rows; control plane stays
  brand-agnostic — no hardcoded charity logic in the review/registry surface.
- Amend `docs/API_CONTRACTS.md` before any endpoint/schema change (CLAUDE.md hard rule).

### Integration Points
- `apps/web` — NEW token-guarded draft-preview route (previewDrafts perspective +
  frame-ancestors CSP) for the iframe (D-09).
- `apps/dispatch-control` — review screen (preview iframe + cost + claims + decisions)
  + a `/charities` registry route.
- `api/control.py` (or sibling) — publish/schedule + review-decision endpoints; reuse
  re-roll route.
- `convex/{charities,review_actions,pipelineConfig,auditLog,runs}.ts` — registry CRUD +
  dedup query, review-action trail, config toggles, audit rows, queue/cost reads.
- `agents/scout.py` — re-point dedup to the registry + log candidates.
- `agents/publisher/__init__.py` + `api/webhooks.py` — the publish path (unchanged
  mechanics; new dashboard entry point flips Sanity status).
- A NEW pipeline run-end claims-extraction step → Convex claims store (D-06/D-07).

</code_context>

<specifics>
## Specific Ideas

- The review gate's headline value is **fidelity** — the operator must see exactly what
  ships, hence the real Phase 19 layout via an iframed draft-preview route (D-09), not a
  re-render.
- The factual-claims gate must surface **every** number/name/date (full recall) — hence
  deterministic extraction over an LLM pass (D-06); the approve action stays disabled
  until each claim is checked or explicitly skipped.
- The registry is the **single dedup authority** the Scout consults (D-03) — "the Scout
  consults the registry" (REG-02) is the literal acceptance bar; featured-state syncs on
  publish, candidates logged by the Scout.
- `auto_publish` enablement is deliberately **high-friction and alarming** (D-11) — the
  human gate is the brand's intentional design ("only Andrew publishes"); auto-publish is
  opt-in, loud, and audit-logged.
- Reuse over reinvention: publish (D-01), schedule (D-02), and re-roll (D-12) all ride
  existing Phase 6 / Phase 25 machinery — Phase 26 adds the gate + registry, not new
  publish/scheduler/re-roll engines.

</specifics>

<deferred>
## Deferred Ideas

- Slack/email **notification transport** (run-complete/failed/awaiting-review + budget +
  `auto_publish`-enabled alert) — Phase 27 (NTF-01/02). Phase 26 emits the Convex event.
- Web-search-backed factual-claim verification — later enhancement (D-08).
- Stripe donation reconciliation + `model_pricing` staleness indicator — Phase 27.
- Issue-lifecycle board (`draft → in_review → scheduled → published → archived` as a
  kanban) — the brief mentions it; Phase 26 ships the review-queue + decision gate, the
  full board view is a later polish unless trivially co-located.
- Re-rolling upstream nodes or auto re-running QA/editor_final after a section re-roll —
  out (re-roll = section writers only, Phase 25 D-03).
- Per-issue OG image, charity-page issue history (V2-07/V2-09) — deferred reader-side.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 26.

</deferred>

---

*Phase: 26-review-gate-charity-registry*
*Context gathered: 2026-06-23*
