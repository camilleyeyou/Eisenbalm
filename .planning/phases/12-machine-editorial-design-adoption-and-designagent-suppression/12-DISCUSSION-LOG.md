# Phase 12: Machine Editorial Design Adoption + DesignAgent Suppression — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 12-machine-editorial-design-adoption-and-designagent-suppression
**Areas discussed:** Navigator variant, Deliberation variant, Suppression toggle shape, DesignAgent prompt fidelity

---

## Gray areas selected for discussion

All four offered areas were selected: Navigator variant, Deliberation variant, Suppression toggle shape, DesignAgent prompt fidelity.

---

## Navigator variant (MED-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical Timeline | Central spine, node dots, reading-progress, cursor glow. Lowest fidelity risk; extends current 8-card grid + Phase 11 hover-glow. | ✓ |
| Masonry | Variable-height tiles encoding section weight; gold hover glow + scroll parallax. Medium risk; board leans on IBM Plex Mono. | |
| Isometric 3D | Floating cards on isometric grid, depth shadows, magnetic glow. Highest risk + most distinctive. | |

**User's choice:** Vertical Timeline
**Notes:** Chosen for lowest fidelity-under-constraints risk — closest to the existing nav and the Phase 11 hover-glow, reading-progress maps cleanly to scroll, trivial ≥44px + reduced-motion.

---

## Deliberation variant (MED-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Carousel & Flow | Horizontal pitch log, winner glow, tape-reel meter, Scout→Advocate→Editor flow. Extends Phase 11 scroll-snap pitch cards + count-up meter. | ✓ |
| Orbital / Radial | Central winner spotlight, concentric candidate orbits, agent vectors by angle, confidence spiral. Highest risk; angular layout hardest for responsive/≥44px/WCAG. | |
| Brutalist Schematic | ASCII borders, grid-paper bg, terminal log, MACHINE_CONFIDENCE_INDEX. Most on-brand but needs IBM Plex Mono (locked out) for true ASCII alignment. | |

**User's choice:** Carousel & Flow
**Notes:** Lowest risk — directly extends Phase 11's scroll-snap pitch cards and IntersectionObserver+rAF count-up confidence meter already shipping; preserves 5 Convex subs + DEL-04.

---

## Suppression toggle shape (MED-02)

### Sub-question 1 — Toggle type
| Option | Description | Selected |
|--------|-------------|----------|
| Environment variable | Read from env (web server layout → ThemeApplier prop; pipeline build_graph). Dashboard flip = true "no code change". | ✓ |
| Checked-in config constant | Boolean in a committed config file; flipping is a code edit + commit + redeploy. | |

### Sub-question 2 — Flag scope
| Option | Description | Selected |
|--------|-------------|----------|
| One shared flag name | Same env var name in Vercel + Railway; both effects move together (one switch). | ✓ |
| Two independent flags | Separate web + pipeline flags toggled independently; more flexible, partial states the spec doesn't ask for. | |

**User's choice:** Environment variable + one shared flag name (working name `DESIGNAGENT_SUPPRESSED`)
**Notes:** Matches the roadmap's "no code change" wording and the spec's singular "a config flag." Default v1 = ON (suppressed).

---

## DesignAgent prompt fidelity (MED-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Envelope + accent variation | Lock canvas/text feel + Cormorant/Lora fonts; allow primary/accent to vary per issue within a dark metallic/ember range. | ✓ |
| Tight palette lock | Bias toward the exact fixed hexes + Cormorant/Lora; re-enabled output ≈ house palette, negligible variation. | |
| Loose prose description | Describe the aesthetic in prose, trust the model within whitelist + WCAG. Most variation, weakest guarantee. | |

**User's choice:** Envelope + accent variation
**Notes:** Prompt-only change; keeps the per-issue identity the DesignAgent was built for while guaranteeing the dark editorial feel. Validation/fallback machinery unchanged.

---

## Claude's Discretion

- Exact timeline geometry, reading-progress visual, tape-reel meter styling, flow-line rendering, token reuse.
- Precise flag-plumbing mechanism (no-op serializer vs. align defaults) and downstream tolerance of an absent `theme`.
- Phrasing of the DesignAgent envelope guidance (prompt-only, within the validation contract).

## Deferred Ideas

- Non-chosen board variants (Masonry, Isometric, Orbital/Radial, Brutalist Schematic).
- Spectral + IBM Plex Mono fonts (FONT_WHITELIST governance required).
- GSAP / framer-motion (CSS-only mandate).
- Per-issue theming as a v1 product feature (suppressed; preserved behind the reversible flag).
