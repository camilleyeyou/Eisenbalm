# Phase 31: Content-Patch Endpoints + Full Editing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 31-content-patch-endpoints-full-editing
**Areas discussed:** Editing UI home, Section coverage, Save semantics, Asset upload flow

---

## Editing UI home

| Option | Description | Selected |
|--------|-------------|----------|
| Review Desk (Recommended) | Build editing into /review-desk now (/review-desk/[runId]); honors Phase 30 D-03 "build straight into final homes"; Phase 32 wraps the galley around it | ✓ |
| Extend Phase 26 review page | Edit panels beside the preview iframe at /run-monitor/runs/[runId]/review; fastest but requires Phase 32 migration | |
| Both linked | Editor at Review Desk + deep links from the Phase 26 page | |

**User's choice:** Review Desk

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-focus latest (Recommended) | /review-desk opens straight into the current awaiting-review run; small run switcher for multi-run | ✓ |
| Queue list first | ReviewQueue-style list, click to open a run's editor | |

**User's choice:** Auto-focus latest

| Option | Description | Selected |
|--------|-------------|----------|
| Sections + preview (Recommended) | Section-chip list opens one editor at a time, preview iframe alongside/toggleable | ✓ |
| Editor only | No preview on this screen; visual checks via the Phase 26 page | |

**User's choice:** Sections + preview

| Option | Description | Selected |
|--------|-------------|----------|
| Untouched fallback (Recommended) | Phase 26 review page keeps working unchanged for ≥1 weekly cycle | ✓ |
| Add cross-links | Keep it working + "Edit in Review Desk" links per section | |

**User's choice:** Untouched fallback

---

## Section coverage

| Option | Description | Selected |
|--------|-------------|----------|
| All prose surfaces (Recommended) | Every reader-visible text editable with a shape-appropriate editor (blocks / turn-list / textarea) | ✓ |
| Long-reads + structured fields only | Deliberation turns + podcast transcript deferred | |

**User's choice:** All prose surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Structured forms per variant (Recommended) | specAd → block editor; bigBudget → storyboard fields + image slot; jingle → lyrics + Suno prompt | ✓ |
| specAd only, defer others | Storyboard/jingle editing deferred | |

**User's choice:** Structured forms per variant

| Option | Description | Selected |
|--------|-------------|----------|
| Full block ops (Recommended) | Edit text, change type, add, delete, reorder (up/down buttons) | ✓ |
| Text edits only | Rewrite within existing blocks, no restructuring | |
| You decide | Claude picks the op set during planning | |

**User's choice:** Full block ops

---

## Save semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit save (Recommended) | Per-section Save button, dirty indicator, unsaved-changes warning | ✓ |
| Autosave debounced | Automatic patches after typing pauses | |

**User's choice:** Explicit save

| Option | Description | Selected |
|--------|-------------|----------|
| Hard security, soft editorial (Recommended) | Theme hex/font whitelist + game-embed size hard-block; structural floor warns only | ✓ |
| Enforce everything | Operator saves pass all writer validators incl. structural floor | |
| Security checks only | No structural warnings at all | |

**User's choice:** Hard security, soft editorial

| Option | Description | Selected |
|--------|-------------|----------|
| Before/after snapshot (Recommended) | Audit row carries actor, section, truncated before/after content | ✓ |
| Action-only row | Actor + section + timestamp, no content payload | |

**User's choice:** Before/after snapshot

| Option | Description | Selected |
|--------|-------------|----------|
| Revision guard (Recommended) | Sanity ifRevisionID; mismatch → 409 + reload-and-reapply prompt | ✓ |
| Last write wins | No revision check | |
| You decide | Claude picks after checking Sanity's mutate API | |

**User's choice:** Revision guard

---

## Asset upload flow

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in owning section (Recommended) | Asset slots inside their section's editor (podcast audio, Suno audio, storyboard images) | ✓ |
| Dedicated assets panel | One panel listing all slots together | |

**User's choice:** Inline in owning section

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with confirm (Recommended) | One asset per slot; overwrite asks confirmation; audit row records the swap | ✓ |
| Silent replace | New upload swaps the reference without warning | |

**User's choice:** Replace with confirm

| Option | Description | Selected |
|--------|-------------|----------|
| Inline preview (Recommended) | Native audio player / image thumbnail from the Sanity CDN URL | ✓ |
| Filename + status only | Stored filename + "attached" badge | |

**User's choice:** Inline preview

---

## Claude's Discretion

- Exact endpoint shapes/granularity (contract-first via docs/API_CONTRACTS.md)
- Upload transport details, file size/type limits per asset kind
- Section-chip UI details, dirty-state mechanics, run-switcher styling
- EDT-05 source-scan test design
- Structured-field editor micro-UX (headlines, PDF key data points, theme fields, game embed)

## Deferred Ideas

- "Edit in Review Desk" cross-links from the Phase 26 review page (considered, not chosen)
- EDT-04 accept-fix / EDT-06 re-resolution → Phase 33
- Native galley → Phase 32; old-path retirement → Phase 34
- @dnd-kit drag reordering — only if up/down buttons prove insufficient

## Session Notes

- STATE.md frontmatter was stale (`milestone: v2.0`, "Milestone complete") which made `gsd-tools` unable to resolve Phase 31 from the roadmap; repaired to `milestone: v3.0` / "In progress" at session start.
