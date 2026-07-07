# Phase 31: Content-Patch Endpoints + Full Editing - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

The write-path for all content mutation: a scoped Sanity-patch endpoint family on the pipeline API (per-section prose, structured fields, asset uploads) plus the console editing UI in dispatch-control — every mutation flowing dashboard → pipeline API → Sanity, audit-logged, with zero direct Sanity writes from the dashboard (source-scan enforceable). Requirements: EDT-01, EDT-02, EDT-03, EDT-05.

**Explicitly NOT in scope:** the native galley + span-resolver (Phase 32), accept-fix wiring / annotation re-resolution / EDT-04 / EDT-06 (Phase 33), the two-sign-off publish gate + Studio bypass retirement (Phase 34), provenance (Phase 35). Backend endpoint work has no schema dependency on Phase 30 and may start in parallel with UI work.

</domain>

<decisions>
## Implementation Decisions

### Editing UI home
- **D-01:** Review Desk becomes real this phase — the run editor lives at `/review-desk/[runId]`. `/review-desk` auto-focuses the current awaiting-review run (single-operator, one issue/week); a small run switcher handles the rare multi-run case. Honors Phase 30 D-03 ("build straight into final homes").
- **D-02:** v1 layout: section-chip list (precursor to the design's galley jump-nav) opens one section's editor at a time, with the existing preview iframe alongside/toggleable for reader-fidelity context. Phase 32 swaps the iframe for the native galley — no route migration later.
- **D-03:** The Phase 26 review page (`/run-monitor/runs/[runId]/review`) stays byte-untouched as the proven fallback path for at least one real weekly cycle (research Pitfall 5 — no big-bang cutover).

### Section coverage
- **D-04:** ALL prose surfaces are editable in v1, each with a shape-appropriate editor: block editor for the 5 long-reads (originStory, problem, founderBio, caseStudy, specAd bonus); turn-list editor for the deliberation `conversation[]` (`{speaker, text}`); plain textareas for podcast transcript and jingle lyrics.
- **D-05:** Bonus editing adapts to the stored variant: specAd → block editor; bigBudget → per-storyboard structured fields (+ image slot fed by this phase's asset upload); jingle → lyrics textarea + Suno prompt field.
- **D-06:** The long-read block editor supports full block ops: edit text, change type (paragraph/h2/h3/blockquote), add, delete, reorder via up/down buttons (locked no-drag-library decision; @dnd-kit stays deferred-optional).

### Save semantics
- **D-07:** Explicit save per section — Save button, dirty-state indicator, unsaved-changes warning on nav. One scoped patch + one audit row per deliberate save; no autosave.
- **D-08:** Validation split — security-critical checks HARD-block the save (theme hex regex + FONT_WHITELIST, sane game-embed size cap); the editorial structural floor (≥2 sub-headers + ≥1 blockquote) only WARNS on operator edits — Andrew is the human judgment the floor approximates for LLM writers.
- **D-09:** Every content-save audit row carries actor, section, and truncated before/after content snapshots (mirror the `agent_run_payloads` truncation pattern). "Nothing silent" means you can see WHAT changed, not just that something did.
- **D-10:** Saves carry a revision guard — the patch includes the document revision it was based on (Sanity `ifRevisionID`); mismatch returns 409 and the editor prompts reload-and-reapply. A section re-roll racing an open edit never silently clobbers either side.

### Asset uploads
- **D-11:** Upload controls live inline in the owning section's editor: podcast editor → podcast audio slot; jingle bonus → Suno audio slot; storyboard forms → image slots. No separate assets screen.
- **D-12:** One asset per slot; uploading over an existing asset requires confirmation, then replaces the reference (old asset left in Sanity; the audit row records the swap).
- **D-13:** Post-upload inline preview — native `<audio>` player for audio slots, thumbnail for images, both from the Sanity CDN URL returned after the patch — so the operator verifies the right file landed without leaving the editor.

### Claude's Discretion
- Exact endpoint shapes/granularity (research sketches `PATCH /issues/{run_id}/sections/{name}` + sibling structured-field routes — refine during planning; contract-first per CLAUDE.md: amend `docs/API_CONTRACTS.md` before code).
- Upload transport details (multipart vs raw binary to FastAPI), file size/type limits per asset kind.
- Section-chip UI details, dirty-state mechanics, run-switcher styling (1c design system per Phase 30).
- EDT-05 source-scan test design — precedents exist: `apps-web-no-clerk.test.ts`, the CMR-05 `FORBIDDEN_BYPASS` tripwire pattern.
- Structured-field editor micro-UX (section headlines, PDF key data points, theme value fields, game embed textarea).

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 31 — goal + 4 success criteria (incl. the zero-direct-Sanity-writes source scan).
- `.planning/REQUIREMENTS.md` — EDT-01, EDT-02, EDT-03, EDT-05 (EDT-04/EDT-06 belong to Phase 33 — do not pull them in).
- `.planning/PROJECT.md` §Current Milestone — locked decisions: write boundary (dashboard → pipeline API → Sanity, "nothing silent"), editing v1 is per-section not WYSIWYG, Sanity bypass-not-removal.

### v3.0 research (decisions already reconciled — follow, don't relitigate)
- `.planning/research/SUMMARY.md` — content-patch endpoint family is Architecture #2; scoped Sanity `patch` never `createOrReplace`; plain React forms mapping the `BodyBlock` union; raw-binary `httpx` `upload_asset()`; the span-anchoring reconciliation note (scoped patches exist precisely so annotations survive — Phase 32/33 depend on this phase honoring it).
- `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md` — code-verified findings behind the summary.

### Design handoff (committed by Phase 30 D-12)
- `docs/design/dispatch-control-v2/README.md` — Review Desk section (galley chip strip, decision rail context this editor grows into).
- `docs/design/dispatch-control-v2/DECISIONS.md` — binding house rules ("nothing silent" logging, two sign-offs later, EIC seat).
- `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — 1c tokens/type the editing UI must match.
- `docs/design/dispatch-control-v2/Dispatch Control - Review Desk Directions.dc.html` — Review Desk visual directions.

### Contract boundary (hard rule)
- `docs/API_CONTRACTS.md` — CLAUDE.md hard rule: amend contracts BEFORE any schema/endpoint code. New §31.x sections for the patch endpoint family + asset upload must land first.

### Existing code (patterns to reuse)
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` — the Phase 26 endpoint pattern to clone: Clerk-JWT guard (`_require_clerk_jwt_control`), guard-ordering, `reviewActions:record` + `_emit_audit`, 409 detail shapes.
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — `_emit_audit`, `_require_clerk_jwt_control` definitions; `rerun_agent` (the re-roll whose full re-sync motivates the revision guard).
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — `compose_section_body()` (block serialization), `upload_pdf_to_issue()` (the existing asset-upload-then-patch-reference pattern to generalize into `upload_asset()`), existing `patch` mutation usage (~L317, L464).
- `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` + `lib/portable_text.py` — the `BodyBlock` discriminated union the block editor maps 1:1.
- `apps/studio/schemas/weeklyIssue.ts` — field shapes for every editable surface (sections, theme, game, bonus variants, podcast, PDF key data points).
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/` — `PreviewIframe.tsx` (reuse for D-02), `ClaimsChecklist.tsx`, `ReviewDecisionPanel.tsx` (untouched per D-03).
- `apps/dispatch-control/lib/reviewClient.ts`, `lib/testRunClient.ts` — the `NEXT_PUBLIC_PIPELINE_URL` fetch-client pattern for new patch/upload clients.
- `apps/dispatch-control/lib/previewToken.ts` — HMAC preview-token flow the iframe uses.
- `apps/web/lib/theme.ts` — the hex regex + FONT_WHITELIST that D-08's hard validation must match (pipeline-side equivalent in the DesignAgent validation path).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 26 endpoint family** (`api/review.py`) — Clerk-JWT-guarded POSTs with ordered guards, review_actions + audit_log rows, 409 `{reason, message}` shapes: the exact skeleton for the patch endpoints.
- **`upload_pdf_to_issue()`** — already does binary POST to Sanity `/assets/files/{dataset}` then patches an asset reference onto the issue; generalizing this is the whole EDT-03 backend.
- **`compose_section_body()` / `BodyBlock` union** — the editor's `{type, text}[]` rows serialize through the same path writer output does; no new serialization format.
- **Preview iframe + HMAC token flow** (Phase 26 RVW-02) — mount as-is beside the editor for D-02.
- **1c design system + chrome** (Phase 30) — masthead/nav/tokens already wrap `/review-desk`; the placeholder page is replaced, not restyled.
- **Source-scan tripwire precedents** — `apps-web-no-clerk.test.ts` and the CMR-05 `FORBIDDEN_BYPASS` vitest pattern for the EDT-05 no-direct-Sanity-writes scan.

### Established Patterns
- Contract-first: `docs/API_CONTRACTS.md` amended before any producer/consumer code (CLAUDE.md hard rule, honored by Phases 13/18/22/26/27).
- Audit rows via `_emit_audit` (non-blocking) with `action` vocabulary; Convex `auditLog:record`.
- Dashboard → pipeline fetch clients read `NEXT_PUBLIC_PIPELINE_URL` (verified live in prod by Phase 30 CHR-05).
- Whole-document `write_issue_draft()` regenerates every block `_key` — the reason scoped patches are load-bearing; do NOT route edits through it.

### Integration Points
- `/review-desk` placeholder page (Phase 30 D-02) — replaced by the real editor screen.
- Awaiting-you inbox routes awaiting-review items to "wherever the action can be taken today" (Phase 30 D-11) — re-point to `/review-desk/[runId]` once it's real.
- FastAPI app (`api/main.py`) — new router mounts beside review/control/agents; CORS already allows the dashboard origin (Phase 30).
- Sanity draft documents (`drafts.` prefix) — patches target the draft the publisher wrote; publish flow (Phase 26) reads the same document.

</code_context>

<specifics>
## Specific Ideas

- The section-chip list should visually anticipate the design's galley "section-status chip strip" (jump nav) from `docs/design/dispatch-control-v2/README.md` — Phase 32 upgrades it in place.
- "Nothing silent" is a house rule from DECISIONS.md, not just a logging preference — before/after snapshots (D-09) are the honest reading of it.
- Research SUMMARY's framing to preserve verbatim: editing one section must "never disturb another section's block identities" — this is what Phase 32's span-resolver and Phase 33's re-resolution assume.

</specifics>

<deferred>
## Deferred Ideas

- **"Edit in Review Desk" cross-links from the Phase 26 review page** — considered, not chosen (D-03 keeps that page byte-untouched); revisit during the Phase 32 transition if discovery is a problem.
- **Accept-fix / dismiss-with-reason (EDT-04) and annotation re-resolution (EDT-06)** — Phase 33, consuming this phase's patch endpoints.
- **Native galley rendering** — Phase 32 replaces the D-02 iframe.
- **Retiring the Phase 26 review page and the Studio write path** — Phase 34 (after a soak cycle).
- **@dnd-kit drag reordering** — only if up/down buttons prove insufficient in real weekly use.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 31-content-patch-endpoints-full-editing*
*Context gathered: 2026-07-07*
