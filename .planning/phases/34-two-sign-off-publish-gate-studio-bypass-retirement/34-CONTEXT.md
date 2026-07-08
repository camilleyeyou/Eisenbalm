# Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

An issue cannot be published without two independent, server-enforced sign-offs —
**"Facts cleared"** and **"Sounds human"** — recorded per run with actor + timestamp.
The Sanity publish webhook handler re-validates sign-off state before running the
publisher, closing the Studio status-flip bypass. Sanity Studio's publish action for
`weeklyIssue` is disable-able behind a flag (flipped after a documented soak period of
real weekly cycles on the console), with Studio documented as a read-only fallback.
Every sign-off, publish attempt, and revocation is audit-logged. Requirements:
PUB-01, PUB-02, PUB-03, PUB-04.

**Enabling facts (verified in code 2026-07-08):**
- `POST /issues/{run_id}/publish` (`api/review.py`) already 409s on: wrong status,
  `claimChecks:allSignedOff` false (Phase 26 RVW-05), and open error-severity findings
  (Phase 33 D-14). `schedule_issue` mirrors the same gates.
- The webhook (`api/webhooks.py::sanity_publish`) verifies HMAC + timestamp age and
  guards on `status='published'` — but checks **no editorial gates**. A direct Studio
  flip publishes unconditionally. That is the PUB-02 hole.
- `apps/studio/sanity.config.ts` is vanilla — no custom document actions yet.
- `DecisionRail.tsx` (Phase 33) already gates Publish client-side and is the home for
  the sign-off controls.
- All content mutations flow dashboard → pipeline API → Sanity (locked write boundary),
  so a single choke point exists for sign-off revocation.

**Explicitly NOT in scope:** the Voice Pass machine-tell screen (Phase 36 — it upgrades
the "Sounds human" sign-off in place); provenance/source-bound claims (Phase 35);
Studio *editing* lockdown or full Sanity removal (follow-up milestone per PROJECT.md
"Sanity bypass, not removal").

</domain>

<decisions>
## Implementation Decisions

### Sign-off model & semantics
- **D-01: "Facts cleared" is an explicit, prerequisite-gated operator action.** A
  deliberate sign-off control in the Review Desk decision rail, enabled only once
  (a) all claim checks are checked/skipped AND (b) no open error-severity findings
  exist. The prerequisites are enforced server-side by the sign-off endpoint — not
  just a disabled button. The sign-off is an affirmative act with actor + timestamp,
  never a derived boolean that can flip silently.
- **D-02: New Convex `sign_offs` table.** Shape approximately
  `{runId, kind: 'facts-cleared' | 'sounds-human', actor, signedAt, revokedAt?,
  revokedReason?}` (exact shape at Claude's discretion — amend API_CONTRACTS.md
  first). Append-friendly and audit-shaped; Phase 36's Voice Pass writes the same
  table; revocations are recorded, not field-flips that lose history.
- **D-03: No override path.** Both sign-offs are hard requirements — DECISIONS.md:
  "Neither can be skipped." No break-glass publish-despite-missing-sign-off action.
  If Andrew must force a ship, he records both sign-offs himself — that is the gate
  working, not an override. PUB-04's "any override" is covered by the existing
  audit-logged `auto_publish` toggle and the revocation trail.
- **D-04: Existing gates fold into prerequisites.** The publish endpoint's gate
  becomes: both sign-offs recorded (and not revoked). The claims-signed-off and
  open-error-findings checks move upstream — they gate *recording* "Facts cleared"
  (D-01), not publishing directly. One conceptual gate at publish time with a clean
  409 story ("missing sign-off(s)"); the existing checks are relocated, not deleted.

### Interim "Sounds human" (pre-Phase 36)
- **D-05: Attestation control in the DecisionRail.** "Sounds human" is recorded via a
  second sign-off control next to "Facts cleared" in the Phase 33 decision rail — a
  pure human attestation ("I read it; it sounds human"). No stub /voice-pass route.
  Phase 36 upgrades in place: the Voice Pass screen becomes where the sign-off is
  earned, writing the same `sign_offs` row.
- **D-06: "Sounds human" is ungated.** No prerequisites — nothing machine-checkable
  for voice exists until Phase 36. The two sign-offs are independent greens (per the
  design); no forced ordering between them.

### Bypass & invalidation behavior
- **D-07: Webhook blocks + reverts + alerts on missing sign-offs.** When the webhook
  fires for a run without both valid sign-offs (i.e. a direct Studio flip), the
  handler: skips the publisher, flips the Sanity `weeklyIssue.status` back to
  `in-review`, writes an audit row, and emits an alert Convex event (Phase 27
  transport seam — same pattern as the `auto_publish` alert). Sanity never claims
  "published" for an issue that didn't deploy; the bypass attempt is loud.
- **D-08: Sign-offs auto-revoke on content mutation.** Every content-mutating
  pipeline endpoint (Phase 31 section saves, Phase 33 accept-fix, section re-roll)
  revokes any active sign-offs for the run, with an audit row per revocation
  ("nothing silent"). The rail goes red live via Convex reactivity; Andrew re-signs
  after reviewing the change. No publishing content nobody attested to.
- **D-09: Scheduling checks at both ends.** `schedule_issue` gains the same
  two-sign-off gate as publish (both required to schedule); the D-07 webhook re-check
  naturally covers fire time — if edits revoked a sign-off between scheduling and the
  tick firing, the scheduled publish blocks + alerts instead of shipping unattested
  content.

### Studio retirement & soak
- **D-10: Ship the publish-action disable now, behind a flag defaulting OFF.** Build
  the Sanity custom document-action override (removing/disabling publish for
  `weeklyIssue`) in this phase, gated by a Studio env flag (e.g.
  `SANITY_STUDIO_DISABLE_PUBLISH`). During soak the flag stays off; ending the soak
  = flip flag + redeploy Studio, no new code. PUB-02's webhook re-check protects the
  gate throughout regardless of flag state.
- **D-11: Soak ends manually against a documented criterion.** Document the criterion
  (e.g. 2–3 consecutive real weekly issues shipped entirely via the console with no
  Studio fallback needed); Andrew flips the flag when met. No automatic counter.
- **D-12: Publish path only — editing untouched.** Studio editing remains technically
  possible as the emergency fallback; docs (apps/studio README / EDITOR_GUIDE) state
  the console is the editing + publishing surface of record and Studio is read-only
  fallback. Edit lockdown belongs to the Sanity-removal follow-up milestone.

### Claude's Discretion
- Exact `sign_offs` table shape, index design, and the sign-off/revoke endpoint
  shapes (`POST /issues/{run_id}/sign-off` vs per-kind routes) — contract-first:
  amend `docs/API_CONTRACTS.md` before code (CLAUDE.md hard rule).
- How the webhook identifies the run for a Sanity issue ID (existing
  `sanityIssueId` linkage) and the exact revert mechanics/idempotency against the
  legit dashboard-publish path (which flips status only after the gate passed —
  ordering means the re-check passes for legit publishes).
- Rail sign-off control UX (button vs toggle, revoked-state copy, who-signed-when
  display) within the 1c design system; affirmative-state rule applies ("signed by
  Andrew 2m ago" / "not signed" — never blank).
- Which mutation endpoints trigger D-08 revocation (recommend: all Phase 31 content
  patches, accept-fix, structured-field/asset writes, section re-roll) and whether
  revocation distinguishes which sign-off kinds it clears (recommend: both).
- Whether the schedule/publish 409 detail enumerates which sign-off(s) are missing.
- Exact env flag name and Studio document-action implementation
  (`document.actions` resolver).

### Folded Todos
None — no pending todos matched Phase 34.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 34 — goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` — PUB-01..PUB-04 (VOX-03 is Phase 36 — it feeds this
  gate later; do not build Voice Pass detection here).
- `.planning/PROJECT.md` §Current Milestone — locked decisions: write boundary,
  "nothing silent", "Sanity bypass not removal", publish-gate reconciliation facts.

### Design handoff (binding)
- `docs/design/dispatch-control-v2/DECISIONS.md` §1 — "Two sign-offs, both mandatory,
  every issue. Neither can be skipped."
- `docs/design/dispatch-control-v2/README.md` — §Voice Pass (line ~52: the two
  separate sign-offs, "Publish requires both greens"), §state (line ~78: the two
  Review/Voice sign-off booleans as Publish-gate state).
- `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — 1c tokens for the rail
  sign-off controls.

### Prior phase contexts (direct dependencies — decisions carried forward)
- `.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md` — D-14 (publish
  endpoint's open-error-findings 409 this phase folds into a prerequisite), D-11b
  (anchor-blind blocking), rail composition D-17, endpoint patterns D-02.
- `.planning/phases/26-review-gate-charity-registry/26-CONTEXT.md` — D-01/D-02
  (publish = Sanity flip → webhook chain; schedule via tick sweep), D-11
  (alert-event-now/transport-later seam reused by D-07).

### Contract boundary (hard rule)
- `docs/API_CONTRACTS.md` — amend BEFORE code: the `sign_offs` table, sign-off/revoke
  endpoints, the publish + schedule endpoints' revised 409 conditions, the webhook's
  new re-validation + revert behavior.

### Existing code (edit/extension targets)
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` — `publish_issue` +
  `schedule_issue` (gates restructure per D-04/D-09); `reject_issue`; the
  Clerk-JWT + `_emit_audit` + 409-detail pattern for the new sign-off endpoints.
- `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` — `sanity_publish`
  (D-07 re-validation + revert lands after the existing HMAC/age/status guards).
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` — Phase 31 content-patch
  endpoints (D-08 revocation hook point), incl. accept-fix machinery.
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — `rerun_agent` (D-08
  revocation on re-roll), `_emit_audit`, auth helpers.
- `convex/schema.ts` — new `sign_offs` table (D-02); existing `audit_log` (~L264),
  `claim_checks` (~L401), `review_actions` (~L415), `qaCorrections` (~L70).
- `convex/auditLog.ts` — shared audit writer.
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx`
  — the two sign-off controls + gate state render here (D-01/D-05).
- `apps/dispatch-control/lib/pipelineControlClient.ts` (+ Phase 33 findings client
  pattern) — client for the sign-off endpoints.
- `apps/studio/sanity.config.ts` — the flag-gated document-action override (D-10).
- `apps/studio/README.md` + `apps/studio/EDITOR_GUIDE.md` — read-only-fallback +
  soak-criterion documentation home (D-11/D-12).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Publish/schedule gate skeleton** — `review.py` already stacks server-side 409
  gates (status, claims, error findings, sanity-id); Phase 34 restructures rather
  than invents: sign-off checks in, claims/findings checks relocated to the
  facts-cleared sign-off endpoint (D-04).
- **Webhook guard chain** — HMAC + age + status guards exist; the D-07 re-validation
  inserts as one more guard before `_run_publisher` launch. `_flip_sanity_published`
  in review.py shows the status-write mechanic the revert reuses (inverse direction).
- **Audit + alert infra** — `_emit_audit`, `convex/auditLog.ts`, and the Phase 26
  alert-event pattern (auto_publish) cover PUB-04 and D-07's alert with zero new
  transport machinery.
- **DecisionRail** — Phase 33 built the blockers-first rail with a gated Publish;
  the sign-off controls slot in as rail sections; Convex reactivity gives live
  red/green with no polling.
- **Write-boundary choke point** — all content mutations already pass through the
  pipeline API (content.py / control.py), so D-08's revoke-on-mutate is a helper
  call in a handful of known endpoints, not a scan for write paths.

### Established Patterns
- Server-enforced, never just a disabled button (Phase 26 Pitfall 6, Phase 33 D-14).
- "Nothing silent": every state change writes an audit row with actor + evidence.
- Contract-first: amend `docs/API_CONTRACTS.md` before endpoint/schema code.
- Alert-event-now/transport-later seam (Phase 25 D-09 / Phase 26 D-11) — D-07's
  bypass alert emits the Convex event; Phase 27 transport carries it.
- Affirmative states in the rail — "never blank" (Phase 33 D-13).
- `workspace_id: "eisenbalm"` threaded through new Convex rows.

### Integration Points
- `POST /issues/{run_id}/publish` + `/schedule` — gate restructure (D-04/D-09).
- `api/webhooks.py::sanity_publish` — re-validation + revert + alert (D-07).
- Content-mutation endpoints (content.py, accept/dismiss, rerun_agent) — revocation
  hook (D-08).
- Convex `sign_offs` (new) — written by sign-off endpoints, read by publish/schedule
  gates, the webhook re-check, and the rail's live subscription.
- `DecisionRail.tsx` — sign-off controls; Phase 36's Voice Pass later becomes the
  earner of "Sounds human" writing the same rows.
- `apps/studio/sanity.config.ts` — flag-gated publish-action removal (D-10).

</code_context>

<specifics>
## Specific Ideas

- The gate philosophy is continuous with Phases 26/33: **the server refuses; the UI
  merely explains.** A Studio flip must be *incapable* of publishing, not merely
  discouraged.
- DECISIONS.md language is binding and literal: "Two separate sign-offs, both
  mandatory, every issue. Neither can be skipped" — hence D-03's no-override stance.
- Sign-offs are attestations, not derived state: there must be a moment where a named
  human affirmed each green, and any content change after that moment loudly voids it
  (D-01/D-08).
- With PUB-02 in place, Studio's publish action is functionally neutered before it is
  visually removed — the soak flag (D-10) controls the visible affordance, the
  webhook controls the truth.

</specifics>

<deferred>
## Deferred Ideas

- **Voice Pass machine-tell screen** (detection, rewrite popovers, per-screen tell
  count) — Phase 36; it upgrades the D-05 attestation in place (VOX-01..04).
- **Source-bound claims checklist** upgrade to the facts prerequisites — Phase 35
  (the D-01 prerequisite then reads source-bound claim state instead of free-text
  claim checks, same gate contract).
- **Studio editing lockdown / full Sanity removal** (content → Convex, Studio
  deletion) — follow-up milestone, locked in PROJECT.md.
- **Automatic soak counter** — considered, not chosen (D-11); manual flag flip
  against a documented criterion.
- **Break-glass publish override with typed reason** — considered, not chosen (D-03);
  revisit only if a real Thursday incident shows the gate blocking a legitimate ship
  in a way self-signing can't resolve.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 34.

</deferred>

---

*Phase: 34-two-sign-off-publish-gate-studio-bypass-retirement*
*Context gathered: 2026-07-08*
