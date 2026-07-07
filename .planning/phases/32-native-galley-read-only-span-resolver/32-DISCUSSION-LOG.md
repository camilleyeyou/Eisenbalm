# Phase 32: Native Galley (read-only) + Span-Resolver - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 32-native-galley-read-only-span-resolver
**Areas discussed:** Galley + editor coexistence, Reader fidelity depth, Annotation visuals + unresolved UX, Resolver scope + blockIndexHint

---

## Galley + editor coexistence

### How should the galley and the Phase 31 section editors share /review-desk/[runId]?

| Option | Description | Selected |
|--------|-------------|----------|
| Galley default + Edit toggle | Galley is primary view; per-section Edit affordance swaps into the Phase 31 editor, back on save/cancel | ✓ |
| Read / Edit tabs | Two top-level modes, Phase 31 UI unchanged under an Edit tab | |
| Side-by-side | Galley left, editor right when a section is selected | |

### Where does the preview iframe fallback live during the transition cycle?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the in-desk toggle | Phase 31 iframe toggle stays in Review Desk for the soak cycle; Phase 26 page also untouched | ✓ |
| Phase 26 page only | Remove the in-desk toggle; fallback is solely the untouched review page | |

### How do the section-status chips relate to the existing Phase 31 chip list?

| Option | Description | Selected |
|--------|-------------|----------|
| Upgrade in place | Existing SectionChipList becomes the design's chip strip (counts + jump nav), serving both galley and editor | ✓ |
| Separate galley strip | Galley gets its own strip; editor keeps its list | |

**Notes:** Edit-affordance mechanics (inline swap vs panel) left to Claude's discretion.

---

## Reader fidelity depth

### How much of the issue's per-week theme applies inside the galley?

| Option | Description | Selected |
|--------|-------------|----------|
| Theme fonts + accent only | Issue fonts + accent color; galley spec type scale + console paper background | ✓ |
| Full theme fidelity | Whole theme incl. background/text colors inside the galley container | |
| No theme — spec scale only | Pure Newsreader scale; theme checking stays the iframe's job | |

### Which parts of the issue does the galley render?

| Option | Description | Selected |
|--------|-------------|----------|
| All reader-visible content | 8 sections + headlines/decks, game (sandboxed iframe), bonus variant, podcast, deliberation; skip shop/furniture | ✓ |
| The 8 editorial sections only | Just the prose sections QA annotates | |
| Full page replica | Everything including shop callout and decorative bands | |

### Should the galley renderer share code with apps/web's PortableTextRenderer?

| Option | Description | Selected |
|--------|-------------|----------|
| Own galley renderer | New PortableText components in dispatch-control, galley-spec styled | ✓ |
| Extract to packages/shared | Lift apps/web renderer into shared package, parameterize for annotations | |

---

## Annotation visuals + unresolved UX

### How should severity map to the annotation visual?

| Option | Description | Selected |
|--------|-------------|----------|
| 1c palette, tiered | error → rust/vermilion underline + tint, warning → marigold, info → cobalt dotted | ✓ |
| Rust for all, badge for severity | Design mock literal; severity only in popover/chips | |

### How do already-accepted findings (accepted: true) render in the galley?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide from galley | Accepted findings disappear from spans and chip counts; history stays in Phase 26 page + audit | ✓ |
| Show dimmed/struck | Faint gray-green spans for handled findings | |

### How are unresolved (anchor-failed) findings surfaced?

| Option | Description | Selected |
|--------|-------------|----------|
| Section-end card + chip badge | Unresolved card at end of its section (reason + quoted text) + marker in chip count | ✓ |
| Top-of-galley banner | Single global banner with jump links | |
| Both banner and section cards | Belt and suspenders | |

### What does clicking an annotation do in this read-only phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only popover | Axis · severity · reason · suggested fix now; Phase 33 adds actions into the same component | ✓ |
| No popover until Phase 33 | Visual-only spans this phase | |

---

## Resolver scope + blockIndexHint

### Does this phase change the QA agent to emit blockIndexHint, or only build the hint-optional resolver?

| Option | Description | Selected |
|--------|-------------|----------|
| Both: field + QA emits | Add blockIndexHint to Convex schema AND QA agent records block ordinal; legacy findings resolve hint-less | ✓ |
| Resolver only, QA later | Hint always-absent this phase; field + emission in Phase 33 | |

### When a quotedSpan matches more than once and the hint can't disambiguate, what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Mark unresolved | Ambiguous = unresolved section-end card; never guess a span | ✓ |
| Highlight all occurrences | Annotate every match, popover notes ambiguity | |
| First occurrence wins | Deterministic but can mis-attach | |

### Where does the resolver run?

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side in dispatch-control | Pure TS module: Convex findings (live useQuery) × draft from GET /issues/{run_id}/draft, resolved at render time | ✓ |
| Pipeline-side endpoint | FastAPI returns pre-resolved anchors | |

---

## Claude's Discretion

- Edit-affordance mechanics (inline swap vs panel vs modal)
- quotedSpan match normalization strategy (exact-first, normalized fallback)
- Chip strip stickiness / scroll-spy behavior, popover positioning
- How the QA agent computes and plumbs the block ordinal
- Podcast/deliberation/bonus galley presentation details

## Deferred Ideas

- Annotation actions + dismissal reasons (Phase 33)
- Post-patch re-resolution + orphan review (Phase 33)
- Decision rail (Phase 33)
- Iframe toggle / Phase 26 page retirement (post-soak, Phase 34 era)
- Provenance sourced/unsourced rendering (Phase 35)
- Full-theme-fidelity galley mode (not chosen; revisit if iframe retires)
