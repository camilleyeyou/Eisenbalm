# Milestones

## v2.0 Mission Control Dashboard — Complete (2026-07-04)

**Goal:** A single-tenant, review-gated no-code control plane that lets a non-coder run, watch, cost, and govern the Eisenbalm Dispatch agent pipeline — built with multi-tenant bones so it can later become a standalone product.

**Phases:** 21–29 (auth + app shell + Convex schema, config externalization, node wrappers + read-only dashboard, prompt editor + versioning, run control, review gate + charity registry, money + notifications, prompt console, deployment hardening). Phases 1–20 built the public site, pipeline, commerce, and email lifecycle (pre-milestone-tracking; recorded in PROJECT.md Evolution notes).

**Shipped:** `apps/dispatch-control` (Next.js + Clerk + Convex) with runs dashboard, per-node forensics (`agent_runs`/`agent_run_payloads`), prompt versioning read by the pipeline at run start, test-run + voice scoring, run control (trigger/cancel/re-roll/kill switch), review gate (`awaiting-review` → approve/schedule/reject with server-enforced claims signoff), charity registry with dedup, Stripe reconciliation + payouts, notifications (email/Slack), budget caps, audit log.

---

## v3.0 Dispatch Control v2 — Editorial Operator Console — Complete (2026-07-10)

**Goal:** Rebuild `apps/dispatch-control` into the complete editorial surface (committed 1c "bold anti-SaaS magazine" design), so Andrew reviews, edits, de-slops, and publishes an entire weekly issue from the dashboard — Sanity reduced to a pass-through datastore, Studio retired to a read-only fallback.

**Phases:** 30–39 (design-system + chrome foundation, content-patch write boundary + full editing, native galley + span-resolver, accept-fix + decision rail, two-sign-off publish gate + Studio bypass retirement, provenance pipeline + sourced/unsourced galley, Voice Pass de-slop screen, Run Monitor v2 + Signal Desk, Prompt Lab evals + Eval Center, Registry coverage-memory strip).

**Stats:** 10 phases · 62 plans · 2026-07-06 → 2026-07-10 (5 days) · 335 commits · 467 files changed (+59,480 / −2,833). Requirements: 234/234 checked (all v3.0 blocks CHR/GLY/EDT/PUB/VOX/PRV/MON/SIG/EVL/MEM complete).

**Shipped:**
- **Native Review Desk** — the preview iframe replaced by a `@portabletext/react` galley rendering the Sanity draft with existing QA findings resolved inline as severity-colored span annotations (`quotedSpan` text-match + `blockIndexHint`); unresolved findings are visibly marked, never dropped (Phases 32–33).
- **Scoped write boundary** — every console content mutation (per-section prose, structured fields, asset uploads) flows through a pipeline-API patch to Sanity; an EDT-05 source-scan proves zero direct Sanity writes from the dashboard, and each mutation logs to `audit_log` (Phase 31).
- **Two-sign-off publish gate + Studio bypass retirement** — publishing requires server-enforced "Facts cleared" + "Sounds human" sign-offs; the publish webhook re-validates sign-off state before running the publisher, closing the Studio status-flip bypass; Studio flagged to read-only (Phase 34).
- **End-to-end provenance** — the Researcher emits per-claim `{claim, sourceUrl, retrievedAt}` bindings that survive into writer prose via index-bound claim IDs; the galley renders sourced (marigold) vs. unsourced (rust) claims and the claims sign-off is upgraded to source-bound (Phase 35).
- **Voice Pass de-slop screen** — a dedicated machine-tell screen reusing the two-layer QA detector (deterministic `agents/qa/rules.py` + Opus judge), as-written vs. house-voice rewrite popovers, and its own "Sounds human" sign-off feeding the publish gate (Phase 36).
- **Forensic Run Monitor v2 + Signal Desk** — run rendered as a vertical spine (agents as dots, code gates as marigold diamonds) with a handoff inspector, per-writer strength scores, run-vs-last-8 drift strip, and Gate 1 candidate-slate adjudication that resumes via `POST /run/{id}/resume` (Phase 37).
- **Prompt Lab evals + Eval Center + Registry memory** — golden-scenario eval drawer with a commit gate (target-up/no-regression + logged override) and an append-only Eval Center drift scoreboard + shadow runs (Phase 38); a Registry coverage-memory strip (last-8 cause/geo/signal) and an append-only charity-corrections log the Researcher re-reads on any future mention (Phase 39).
- **Foundation** — 1c design tokens/fonts on every screen, a persistent masthead (issue/state/spend/lock chips), workflow-ordered nav + How-to-use screen, a cross-screen Awaiting-you inbox, and the production `NEXT_PUBLIC_PIPELINE_URL` fix (Phase 30).

Archived: `milestones/v3.0-ROADMAP.md` (full phase details), `milestones/v3.0-REQUIREMENTS.md` (frozen requirements snapshot). Tag: `v3.0`.

**Deferred:** Studio deletion + full Sanity-removal follow-up milestone (gated on real weekly cycles); Signal Editor agent + REAL/OBSCURE/SPECIFIC/TELLABLE gates; Suno + NotebookLM API automation (V3-DEF-05). Open human/visual UAT items persisted per phase in `*-HUMAN-UAT.md` / `*-VERIFICATION.md`.

---

## v4.0 Dispatch Control v3 — The Editorial Workspace — Complete (2026-07-17)

**Goal:** The console stops being a set of desks that mirror the pipeline and becomes an editorial product with an *issue* at its center. The machine retreats behind a "System Workbench" the operator visits only when something broke or they want to make an agent better. The editor never "triggers a pipeline."

**Phases:** 40–50 (issue entity + Issues home, one Issue Workspace with stages 1–5, the new Fact Check stage, My Tasks + Decision log, universal inspector, agent revision, Signal Editor + verify_candidates, Story & Brief stage, Brief entry point, Roles & permissions, Workbench rename + nomenclature pass).

**Stats:** 11 phases · 92 plans · 2026-07-14 → 2026-07-17 (4 days) · 406 commits · 556 files changed (+79,142 / −1,747). Requirements: 62/62 checked (all v4.0 blocks ISS/WSP/FCT/TSK/INS/REV/SGE/BRF/ENT/ROL/WBN complete). Phase 50 verified 6/6.

**Shipped:**
- **Issue as first-class entity + Issues home** — console routing inverted from run-keyed to issue-keyed; a run is now reachable only as a historical record *under* an issue. The Issues home shows the in-progress issue with its 5-stage strip, the scheduled slot + Calibrator repetition note, held issues (reason/who/when + Reopen), and four never-blended header state systems (Phase 40).
- **One Issue Workspace, stages 1–5** — the Review Desk, Signal Desk, and Voice Pass nav items collapsed into a single Workspace with live-status stage tabs, a persistent 5-state issue outline, and a per-stage collapsible context panel; Stages 2 (Draft), 4 (Voice Pass), and 5 (Approval) are recompositions of shipped v3.0 galley/voice-pass/decision-rail/publish-gate work — no capability lost (Phase 41).
- **Fact Check stage** — the milestone's only genuinely new stage, on the Phase 35 provenance substrate plus a Researcher-emitted `importance` tier: an affirmative "blank never means verified" coverage summary, a filterable claim table, and a provenance card reused in Draft, Approval, and the inspector (Phase 42).
- **My Tasks + Decision log** — My Tasks as a *derived projection* over open claims/findings/sign-offs (no new task store, with superseded-step handling), and one Decision log recording every reason-requiring action console-wide (actor/action/time/reason/before-after/instruction version/issue/run) (Phase 43).
- **Universal inspector** — one 7-tab "Inspect how this was made" panel reachable from six surfaces, with the missing-expected-input diff (declared template vars minus keys actually supplied) as the headline diagnostic (Phase 44).
- **Agent revision as an editing verb** — passage-level "Ask agent to revise" everywhere, with direction chips (never a bare "Regenerate"), a claim-delta comparison card before apply, and a per-issue cost guard against the header budget readout (Phase 45).
- **Signal Editor + verify_candidates (18 → 20 nodes)** — a Signal Editor agent emitting 3–5 dated story leads (never self-selecting a brand-risk lead) and a deterministic `verify_candidates` check between Scout and Advocate; checkpoint-resume verified across the new nodes (Phase 46).
- **Story & Brief stage + Brief entry point** — Stage 1 replaced with the full design on real leads and verification records (org options, "Needs your decision" adjudication, never-truncated concern) plus an editable Brief the writers draft from (Phase 47); and "Start from my brief" as a real second pipeline entry point that skips discovery and enters at the Researcher (Phase 48).
- **Roles & permissions** — Editor-in-chief vs Collaborator with exactly six server-enforced gated actions; locked controls render with an explanation rather than hiding; Collaborators can read every screen and comment (Phase 49).
- **Workbench rename + nomenclature + recovery rail** — Run Monitor → Run Details, Prompt Lab → Agent Instructions, Eval Center → Quality Tests, Registry → Editorial Memory; a display-copy-only nomenclature sweep (routes/enums/node-ids preserved); action-named run steps, a failed-run recovery rail with honest Restart-from-step, and typed confirmation reserved for Mark Do-not-use (Phase 50).

Archived: `milestones/v4.0-ROADMAP.md` (full phase details), `milestones/v4.0-REQUIREMENTS.md` (frozen requirements snapshot). No git tag — by the project owner's choice.

**Deferred:** Sanity removal (V3-DEF-01), inline WYSIWYG galley editing (V3-DEF-03), and Suno + NotebookLM API automation (V3-DEF-05) remain deferred to future milestones. Open per-phase human/visual UAT items persist in `*-HUMAN-UAT.md` / `*-VERIFICATION.md`; Phase 50 carries three open visual/UX items plus the pre-existing duplicate-React-key nav warning in its deferred-items record.
