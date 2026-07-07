# Phase 32: Native Galley (read-only) + Span-Resolver - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

The Review Desk renders the Sanity draft natively via `@portabletext/react` — all reader-visible content, including the sandboxed game — replacing the preview iframe as the primary read surface, with existing QA findings overlaid as inline severity-colored span annotations resolved by `quotedSpan` text-match plus a `blockIndexHint`. Section-status chips show per-section finding counts and jump-navigate. The prior preview-iframe path stays reachable as a fallback for at least one full weekly cycle. Requirements: GLY-01, GLY-02, GLY-05.

**Explicitly NOT in scope:** annotation actions (Accept fix / Edit inline / Dismiss — Phase 33, EDT-04), post-edit annotation re-resolution (Phase 33, EDT-06), the decision rail (Phase 33, GLY-04), the two-sign-off publish gate (Phase 34), provenance sourced/unsourced rendering (Phase 35). This phase is read-only: render + resolve + navigate.

</domain>

<decisions>
## Implementation Decisions

### Galley + editor coexistence (screen layout)
- **D-01:** **Galley is the default view** at `/review-desk/[runId]` (matches the design end-state). Each section carries an **Edit affordance** that swaps into the Phase 31 section editor for that section, returning to the galley on save/cancel. One screen, read-first. Exact edit-affordance mechanics (inline swap vs panel) are Claude's discretion.
- **D-02:** **The Phase 31 in-desk iframe toggle stays** for the soak cycle — Andrew can flip between galley and iframe on the same screen. The Phase 26 review page (`/run-monitor/runs/[runId]/review`) also remains byte-untouched (Phase 31 D-03). Toggle retirement is a later phase.
- **D-03:** **The existing `SectionChipList` upgrades in place** into the design's chip strip: per-section finding counts (severity-aware, open findings only), click = scroll-to-section in the galley. One chip strip serves both galley jump-nav and editor section selection (GLY-05).

### Reader fidelity depth
- **D-04:** **Theme fonts + accent color only** inside the galley: the issue's display/body Google Fonts and accent color for flavor, but the design spec's galley type scale (Newsreader 52px headline, italic 22px deck, 16.5px/1.7 body) and the console's paper background. Annotations stay high-contrast against a predictable surface; full color-theme checking remains the iframe's job.
- **D-05:** **Coverage = all reader-visible content Andrew signs off on**: all 8 sections in reader order with headlines/decks, the game as a sandboxed iframe (`srcdoc` + `sandbox="allow-scripts"`, reuse the apps/web GameSlot sandbox pattern), the bonus in its stored variant, the podcast (player if audio exists, transcript), and the deliberation conversation. **Skip pure furniture**: shop callout, mission band, site header/footer, hero decorations.
- **D-06:** **Galley-own renderer** — new PortableText components in `apps/dispatch-control`, styled to the galley spec. Do NOT extract or import apps/web's `PortableTextRenderer`; annotation-span injection needs custom components anyway, and cross-app extraction couples the live reader site to console needs.

### Annotation visual language + unresolved UX
- **D-07:** **Tiered 1c severity colors**: `error` → rust/vermilion underline + tint (the design's shown treatment), `warning` → marigold underline, `info` → cobalt dotted underline. Severity is readable by scanning, consistent with the masthead/inbox color language.
- **D-08:** **Accepted findings (`accepted: true`) are hidden** from galley spans and chip counts — chips count open findings only. Accepted history stays visible in the Phase 26 page and audit log; the galley is a to-do surface.
- **D-09:** **Unresolved findings = section-end card + chip badge.** A finding whose anchor fails renders as a visible "unresolved" card at the end of its section (showing full reason + original quoted text), and the section's chip carries an unresolved marker in its count. Nothing silent; findings stay in section context (GLY-02's "never silently dropped or mis-rendered").
- **D-10:** **Read-only popover this phase**: clicking an annotation opens a popover with axis · severity · reason · suggested fix — the design's popover minus the action buttons. Phase 33 adds Accept/Edit/Dismiss into the same component.

### Resolver scope + blockIndexHint
- **D-11:** **This phase adds `blockIndexHint` end-to-end**: new optional field on Convex `qaCorrections` (`v.optional(v.number())`, per research sketch) AND the QA agent records the block ordinal when generating findings. New runs resolve with the hint; legacy findings resolve hint-less (the hint is optional and never authoritative).
- **D-12:** **Ambiguous match → unresolved.** If a `quotedSpan` matches more than once in the section and the hint can't disambiguate, the finding goes to the section-end unresolved card — never guess a span. A wrong highlight is worse than an honest miss.
- **D-13:** **Client-side resolver** — a pure TypeScript module in dispatch-control that resolves Convex findings (live `useQuery`) against the draft from `GET /issues/{run_id}/draft` at render time. Fresh on every content change, no new pipeline endpoints, unit-testable in isolation. Phase 33's post-patch re-resolution reuses this module directly.

### Claude's Discretion
- Edit-affordance mechanics (inline section swap vs side panel vs modal) — whatever reads cleanest in the 1c system.
- quotedSpan match normalization (exact-first, then whitespace/curly-quote-normalized fallback is the sensible shape) — design for resolution rate, but ambiguity always resolves per D-12.
- Chip strip stickiness/scroll-spy behavior, popover positioning library/mechanics.
- How the QA agent computes the block ordinal (which agent output field, plumbing through the Convex mutation).
- Podcast/deliberation/bonus galley presentation details within D-05's coverage.

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 32 — goal + 4 success criteria (native render, resolver with unresolved surfacing, chips, iframe fallback for one cycle).
- `.planning/REQUIREMENTS.md` — GLY-01, GLY-02, GLY-05 (GLY-03/GLY-04 are Phase 33 — do not pull them in).
- `.planning/PROJECT.md` §Current Milestone — locked v3.0 decisions.

### v3.0 research (span-anchoring strategy is LOCKED — follow, don't relitigate)
- `.planning/research/SUMMARY.md` — Reconciliation note (span anchoring): quotedSpan + blockIndexHint resolved fresh at render time; scoped patches preserve block identity; orphans surfaced explicitly. Also flags that the resolver's "unresolved" UX was deferred to this phase's planning — D-09/D-12 answer it.
- `.planning/research/ARCHITECTURE.md` — the code-verified resolver design (§ around L46: ordinal hint rationale, `blockIndexHint: v.optional(v.number())` sketch).
- `.planning/research/PITFALLS.md` — the underlying anchor-orphaning risk this strategy mitigates.

### Design handoff (binding)
- `docs/design/dispatch-control-v2/README.md` §Review Desk — galley spec: two-column end-state, chip strip, QA rust underline + popover contents, game as sandboxed iframe, type scale (Newsreader 52px/.98 headline, italic 22px deck, 16.5px/1.7 body).
- `docs/design/dispatch-control-v2/Dispatch Control - Review Desk Directions.dc.html` — Review Desk visual directions.
- `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — 1c tokens (ink `#17140e`, cobalt `#253ad4`, vermilion `#e8471d`, marigold `#f2b01e`, green `#148a52`), type, spacing.
- `docs/design/dispatch-control-v2/DECISIONS.md` — house rules ("nothing silent").

### Contract boundary
- `docs/API_CONTRACTS.md` — §31.7 draft-read GET is the galley's data source. If the draft-read shape needs extension (it should already be complete per Phase 31-06), amend contracts BEFORE code (CLAUDE.md hard rule). The Convex `qaCorrections` schema change (D-11) should also be reflected wherever the QA payload contract lives.

### Existing code (build on these)
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` + `_components/` (`SectionChipList.tsx`, `SectionEditorPanel.tsx`, `BlockEditor.tsx`, etc.) — the Phase 31 screen this phase re-composes around the galley.
- `apps/dispatch-control/lib/contentPatchClient.ts` — §31.7 `GET /issues/{run_id}/draft` client + response shape (galley data source, D-13).
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/PreviewIframe.tsx` — the in-desk iframe toggle component (D-02 keeps it mounted).
- `convex/schema.ts` (`qaCorrections` table, ~L70) + `convex/qaCorrections.ts` — finding shape (`quotedSpan`, `suggestedFix`, `severity`, `axis`, `sectionName`, `accepted`); D-11 adds `blockIndexHint` here.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/` (`rules.py`, `judge.py`, `__init__.py`) — where findings are generated; D-11's ordinal emission lands here + the Convex write path.
- `apps/web/components/issue/GameSlot.tsx` / `GameFallback.tsx` — the sandboxed-iframe game pattern to replicate (not import) in the galley (D-05).
- `apps/web/components/issue/PortableTextRenderer.tsx` — reference for block/mark coverage the galley renderer must handle (do NOT import — D-06).
- `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` + `lib/portable_text.py` — the `BodyBlock` union / block serialization the resolver walks.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Draft read path exists** — `GET /issues/{run_id}/draft` (content.py L780) + typed client in `contentPatchClient.ts` (§31.7); Phase 31-06 made the read complete (pdf/bonus prefill). The galley should need no new pipeline endpoints.
- **Live findings feed exists** — `convex/qaCorrections.ts` queries with `by_runId_and_section` index; dashboard already uses Convex `useQuery` throughout.
- **Review Desk screen + chip list** — Phase 31's `SectionChipList` upgrades in place (D-03); `SectionEditorPanel` becomes the Edit-affordance target (D-01).
- **Preview iframe + HMAC token flow** — already mounted in Review Desk (Phase 31 D-02); stays as the fallback toggle.
- **`@portabletext/react` precedent** — apps/web uses `^6.2.0`; dispatch-control adds its own dependency + components.
- **Game sandbox pattern** — `iframe srcdoc sandbox="allow-scripts"` proven in apps/web `GameSlot`.

### Established Patterns
- 1c design system tokens/fonts already wrap the Review Desk (Phase 30 chrome + globals).
- Convex reactivity means resolver output recomputes automatically when findings or draft state change — no polling.
- Scoped patches (Phase 31) preserve untouched sections' block identities — the precondition the resolver relies on (research: "never disturb another section's block identities").
- Contract-first: amend `docs/API_CONTRACTS.md` before endpoint/schema changes.

### Integration Points
- `/review-desk/[runId]` — galley mounts as the default view; editors and iframe toggle re-compose around it.
- Convex `qaCorrections` schema + QA agent write path — `blockIndexHint` (D-11).
- Awaiting-you inbox (Phase 30 D-11) — items already route to Review Desk; galley makes it the real destination.
- Phase 33 consumes this phase directly: the resolver module (re-resolution), the popover (gains actions), the chip strip (decision-rail counts).

</code_context>

<specifics>
## Specific Ideas

- The design README's galley description is the visual north star: "the issue rendered as the reader will see it (theme fonts)," QA findings underlining the offending span, popover with axis · severity · reason · suggested fix. Phase 32 builds all of it except the popover's action row.
- Success criterion phrasing to honor literally: findings that fail to resolve are "visibly marked 'unresolved' — never silently dropped or mis-rendered." D-12's ambiguity rule is the direct consequence: never guess.
- The galley is a to-do surface, not an archive — accepted findings vanish (D-08); the chip counts answer "what's left to review in this section."

</specifics>

<deferred>
## Deferred Ideas

- **Annotation actions (Accept/Edit/Dismiss) + dismissal reasons** — Phase 33 (EDT-04), extending this phase's popover.
- **Post-patch annotation re-resolution + orphan review flow** — Phase 33 (EDT-06), reusing the D-13 resolver module.
- **Decision rail (blockers-first, editor memo, verification summary)** — Phase 33 (GLY-04).
- **Iframe toggle retirement + Phase 26 review page retirement** — after the soak cycle, alongside Phase 34's Studio bypass retirement.
- **Sourced/unsourced claim highlighting (marigold/rust provenance states)** — Phase 35, rendered by this galley.
- **Full-theme-fidelity galley mode** — not chosen (D-04); revisit only if the iframe retires and theme review needs a new home.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 32-native-galley-read-only-span-resolver*
*Context gathered: 2026-07-07*
