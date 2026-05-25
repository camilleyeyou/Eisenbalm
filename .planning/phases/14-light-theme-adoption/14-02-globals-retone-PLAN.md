---
phase: 14-light-theme-adoption
plan: 02
type: execute
wave: 2
depends_on: ["14-01"]
files_modified:
  - apps/web/app/globals.css
autonomous: true
requirements: [LIGHT-01, LIGHT-02, LIGHT-05, LIGHT-07]
nyquist_compliant: true

must_haves:
  truths:
    - "Every --color-* token in :root emits the locked light-palette value (warm paper #FAFAF8, near-black ink #1A1A1A) — no dark surfaces remain"
    - "Derived tokens are re-expressed for the light base: --color-primary-bright mixes toward black (not white), --color-primary-glow drops to 12%, aurora glows halved to 5/3/2%"
    - "The two new AA-safe text tokens exist (--color-primary-text #7A5C0E, --color-accent-text #9B3015) and the six small-text gold classes reference --color-primary-text"
    - ".section-card:hover uses the warm paper shadow rgba(90,75,50,0.18), not rgba(0,0,0,0.7)"
  artifacts:
    - path: "apps/web/app/globals.css"
      provides: "Light house palette in :root + re-toned effects + AA-safe small-text class colors"
      contains: "--color-bg: #FAFAF8"
  key_links:
    - from: "apps/web/app/globals.css :root"
      to: "every component using var(--color-*)"
      via: "CSS custom property cascade (token swap auto-resolves)"
      pattern: "--color-bg: #FAFAF8"
    - from: "apps/web/app/globals.css small-text classes"
      to: "--color-primary-text token"
      via: "color: var(--color-primary-text)"
      pattern: "color: var\\(--color-primary-text\\)"
---

<objective>
Re-tone the house palette in apps/web/app/globals.css from the fixed Machine Editorial DARK aesthetic to the fixed warm-paper LIGHT aesthetic. This is the anchor change: replace every --color-* token VALUE in :root, add the two AA-safe text tokens, re-express the three direction-sensitive derived tokens, halve the aurora glows, swap the .section-card:hover black drop-shadow for a warm paper shadow, and repoint the six small-text gold classes to --color-primary-text. Layout, spacing, typography, motion, fonts, and theme.ts logic are UNTOUCHED — only color values and the dark-tuned effects change. Turns the Plan 01 globals.css source-scan tripwires green.

Purpose: The single fixed-palette architecture stays (DesignAgent suppressed, per-issue theming off); only the house palette flips dark→light. All color values copied VERBATIM from 14-UI-SPEC.md — never re-derived.
Output: Re-toned `apps/web/app/globals.css`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/14-light-theme-adoption/14-UI-SPEC.md
@.planning/phases/14-light-theme-adoption/14-RESEARCH.md
@apps/web/app/globals.css
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace :root token values with the light palette + add the two AA-safe text tokens + re-express derived tokens</name>
  <files>apps/web/app/globals.css</files>
  <read_first>
    - apps/web/app/globals.css (the :root block at lines ~32-71 — the dark values being replaced)
    - .planning/phases/14-light-theme-adoption/14-UI-SPEC.md (§"Full --color-* Token Table" lines ~116-194 AND §"Derived / Computed Tokens" — the authoritative hex + color-mix expressions)
    - .planning/phases/14-light-theme-adoption/14-RESEARCH.md (§"Pattern 1: Token Swap" + §"Pattern 2: color-mix Re-Expression" lines ~100-155 — the dark→light value map and the white→black flip)
  </read_first>
  <action>
    In the FIRST `:root { }` block of apps/web/app/globals.css (lines ~32-71), replace token VALUES exactly as follows. Copy hex verbatim from 14-UI-SPEC.md. Do NOT touch the @theme block (lines 11-23 — those are identity re-exports), the shadcn shim :root (lines ~165-176 — auto-resolve), font tokens (lines 68-70 — locked), or any layout/spacing.

    Core base (UI-SPEC §Core Base Tokens):
      --color-bg: #FAFAF8;            /* was #0C0B0A — warm paper */
      --color-text: #1A1A1A;          /* was #F0EAD9 — near-black ink */
      --color-primary: #CDA434;       /* UNCHANGED — brand gold */
      --color-accent: #C2502A;        /* UNCHANGED — brand rust */

    Surfaces (UI-SPEC §Surface Tokens — these are the LOCKED spec values; note these differ from the RESEARCH code-example warmer-paper variants — the UI-SPEC table is authoritative):
      --color-surface: #F2EFE9;       /* was #14110D */
      --color-card: #EDE9E1;          /* was #1A1611 */
      --color-card-hover: #E5E0D6;    /* was #221D16 */

    Secondary text (UI-SPEC §Text Secondary Tokens — must pass AA on #FAFAF8):
      --color-text-dim: #595047;      /* was #A89F8A — 7.55:1 */
      --color-text-mute: #706860;     /* was #938A77 — 5.24:1 (dark #938A77 fails on light) */

    Agent identity (UI-SPEC §Agent Identity Tokens — deepened for light bg):
      --color-scout: #3D6B2E;         /* was #8A9B7A — 6.01:1 */
      --color-advocate: #1B4F8A;      /* was #6E92B8 — 7.94:1 */

    ADD two NEW tokens (UI-SPEC §Accent-as-Text AA-Safe Variants). Place them next to --color-primary/--color-accent with a comment:
      --color-primary-text: #7A5C0E;  /* NEW — gold-as-text, 5.97:1 on #FAFAF8 (raw gold fails AA as text) */
      --color-accent-text: #9B3015;   /* NEW — rust-as-text, 7.11:1 on #FAFAF8 */

    Re-express the two DIRECTION-SENSITIVE derived tokens (UI-SPEC §Derived / Computed Tokens + RESEARCH Pattern 2):
      --color-primary-bright: color-mix(in srgb, var(--color-primary) 78%, black 22%);  /* FLIP: was "white 22%" — on light, "brighter" = deeper/darker gold */
      --color-primary-glow: color-mix(in srgb, var(--color-primary) 12%, transparent);  /* was 40% — a 40% gold glow on paper is amber mud; 12% is a subtle warmth */

    LEAVE UNCHANGED (auto-track via --color-text — UI-SPEC confirms the expressions need no change):
      --color-line: color-mix(in srgb, var(--color-text) 8%, transparent);
      --color-line-strong: color-mix(in srgb, var(--color-text) 16%, transparent);
      --color-text-muted: var(--color-text-mute);   /* alias — auto-resolves */
      --color-border: var(--color-line);            /* alias — auto-resolves */

    Update the :root comment block (lines ~25-48) prose from "Dark HYBRID house defaults (Phase 9)" to describe the Phase 14 light house palette (warm paper base, single fixed palette, DesignAgent still suppressed). Do not change behavior — comment text only.
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <acceptance_criteria>
    - `grep "--color-bg: #FAFAF8" apps/web/app/globals.css` matches
    - `grep "--color-text: #1A1A1A" apps/web/app/globals.css` matches
    - `grep "--color-surface: #F2EFE9" apps/web/app/globals.css` matches
    - `grep "--color-card: #EDE9E1" apps/web/app/globals.css` matches
    - `grep "--color-card-hover: #E5E0D6" apps/web/app/globals.css` matches
    - `grep "--color-text-dim: #595047" apps/web/app/globals.css` matches
    - `grep "--color-text-mute: #706860" apps/web/app/globals.css` matches
    - `grep "--color-scout: #3D6B2E" apps/web/app/globals.css` matches
    - `grep "--color-advocate: #1B4F8A" apps/web/app/globals.css` matches
    - `grep "--color-primary-text: #7A5C0E" apps/web/app/globals.css` matches
    - `grep "--color-accent-text: #9B3015" apps/web/app/globals.css` matches
    - `grep "color-mix(in srgb, var(--color-primary) 78%, black 22%)" apps/web/app/globals.css` matches
    - `grep "color-mix(in srgb, var(--color-primary) 12%, transparent)" apps/web/app/globals.css` matches
    - `grep -c "#0C0B0A" apps/web/app/globals.css` == 0 AND `grep -c "#F0EAD9" apps/web/app/globals.css` == 0 (no dark base/ink literals remain)
    - `grep "white 22%" apps/web/app/globals.css` returns nothing (the white-ward mix is gone)
  </acceptance_criteria>
  <done>:root emits the locked light palette; the two new AA-safe text tokens exist; --color-primary-bright mixes toward black; --color-primary-glow is 12%; line/border aliases unchanged; no dark base literals remain.</done>
</task>

<task type="auto">
  <name>Task 2: Reconcile dark-tuned effects (aurora glows, section-card paper shadow) + repoint the six small-text gold classes to --color-primary-text</name>
  <files>apps/web/app/globals.css</files>
  <read_first>
    - apps/web/app/globals.css (the .aurora block ~313-337, .section-card:hover ~521-528, and the six small-text classes: .sc-num ~553, .sc-arrow ~580, .snw-module-label ~658, .snw-title-accent ~677, .snw-section-num ~732, .snw-read-value ~859)
    - .planning/phases/14-light-theme-adoption/14-UI-SPEC.md (§"Effect Reconciliation Rules" lines ~198-294 — the aurora 5/3/2% values + the exact paper-shadow rgba; §"Accent-as-Text" review note line ~157 + §"Component Reconciliation Summary" line ~386 — the six class list)
    - .planning/phases/14-light-theme-adoption/14-RESEARCH.md (§"Pattern 4: Small-Text Class Updates" lines ~166-178 + §"Pattern 6: Hardcoded Shadow Fix" + §"Pitfall 2" + §"Pitfall 4")
  </read_first>
  <action>
    Three sub-edits in apps/web/app/globals.css. Copy values verbatim from 14-UI-SPEC.md §Effect Reconciliation Rules.

    A) AURORA (.aurora background, lines ~320-335) — halve the three radial-gradient color-mix percentages (UI-SPEC §"Atmosphere — .aurora Radial Gradients"):
       - first gradient: `color-mix(in srgb, var(--color-primary) 5%, transparent)`   (was 10%)
       - second gradient: `color-mix(in srgb, var(--color-accent) 3%, transparent)`   (was 6%)
       - third gradient: `color-mix(in srgb, var(--color-advocate) 2%, transparent)`  (was 4%)
       Change ONLY the percentage values inside the color-mix() — keep the ellipse geometry, positions, transparent stops, and the auroraShift animation exactly as-is.

    B) SECTION-CARD HOVER SHADOW (.section-card:hover box-shadow, line ~525) — replace the black drop-shadow with the warm paper shadow (UI-SPEC §"Section Card Hover Shadow" + RESEARCH Pattern 6, the ONE genuine hardcoded-color regression):
       FROM: `0 24px 60px -20px rgba(0, 0, 0, 0.7),`
       TO:   `0 8px 32px -8px rgba(90, 75, 50, 0.18),`
       Keep the second box-shadow line `0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);` unchanged.
       (Per UI-SPEC the offset/blur/spread also change to the paper-appropriate 0 8px 32px -8px — copy the full replacement line verbatim from the UI-SPEC code block.)

    C) SMALL-TEXT GOLD CLASSES — change `color: var(--color-primary);` → `color: var(--color-primary-text);` in EXACTLY these six selectors (the 11px/label gold text that fails AA on light, per UI-SPEC review list line 157 + Component Reconciliation Summary line 386):
       - `.sc-num`
       - `.sc-arrow`
       - `.snw-module-label`
       - `.snw-title-accent`
       - `.snw-section-num`
       - `.snw-read-value`
       DO NOT change these (they legitimately keep raw --color-primary — they are NOT in the UI-SPEC class list and are decorative/border/large-glyph uses):
       - `.drop-cap > p:first-of-type::first-letter` (line 216 — 3.5em decorative display glyph)
       - `.section-card:hover border-color` (line 523 — border, not text)
       - `.section-card.feature .sc-name` (line 543 — 27px display title; see STOP-AND-FLAG below)
       - `.snw-node.active` border-color/background (lines 727-ish — node dot fill)
       - `.snw-row:hover .snw-tag-pill border-color` (line 810) and `.snw-tag-pill` hover `color` (line 811 — see STOP-AND-FLAG)
       - `.del-confidence-bar-fill` background (gold fill — decorative)
       - `.progress` gradient (gold fill — decorative)

    STOP-AND-FLAG (do NOT silently change; record in SUMMARY for checker/UAT): Two small-text gold spots are NOT in the UI-SPEC's six-class review list but render gold text on the light base: (1) `.section-card.feature .sc-name` (27px gold display title — 2.24:1, fails even AA-large), and (2) `.snw-row:hover/.active .snw-tag-pill { color: var(--color-primary) }` (11px tag-pill text turning gold on hover/active — 2.24:1). The UI-SPEC did not list these. Leave them as raw --color-primary for now to honor "do not re-derive / UI-SPEC is authoritative", and FLAG both in the SUMMARY as a possible spec gap so the checker/Andrew can decide. (Note: `.section-cards`/`.section-card` grid is the Phase 11/legacy navigator superseded by the Phase 12 `.snw-*` vertical timeline, so `.sc-name` may be unrendered — flag, don't fix.)
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts 2>&1 | grep -E "Phase 14 source-scan|passed|failed"</automated>
  </verify>
  <acceptance_criteria>
    - `grep "color-mix(in srgb, var(--color-primary) 5%, transparent)" apps/web/app/globals.css` matches (aurora primary halved)
    - `grep "color-mix(in srgb, var(--color-accent) 3%, transparent)" apps/web/app/globals.css` matches
    - `grep "color-mix(in srgb, var(--color-advocate) 2%, transparent)" apps/web/app/globals.css` matches
    - `grep -c "rgba(0, 0, 0, 0.7)" apps/web/app/globals.css` == 0 (black drop-shadow gone)
    - `grep "rgba(90, 75, 50, 0.18)" apps/web/app/globals.css` matches (warm paper shadow present)
    - `grep -c "color: var(--color-primary-text)" apps/web/app/globals.css` == 6 (exactly the six small-text classes)
    - The Plan 01 globals.css source-scan tripwires now PASS: `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` reports the "globals.css: small-text gold classes…" and "…no rgba(0,0,0) in .section-card" it() blocks GREEN.
  </acceptance_criteria>
  <done>Aurora glows halved to 5/3/2%; the black drop-shadow is replaced by the warm paper shadow; the six UI-SPEC small-text gold classes use --color-primary-text; the two non-listed gold-text spots are flagged in SUMMARY, not silently changed.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` — all Plan 01 contrast + globals.css source-scan tripwires GREEN.
- `pnpm --filter web build` exits 0 (the build gate for LIGHT-07 — run after Plan 03 also lands; this plan must not break the build).
- No layout/spacing/typography/motion/font edit; no new npm dep; no Google Fonts URL added; theme.ts untouched.
</verification>

<success_criteria>
- :root emits the locked warm-paper light palette; no dark base/ink literals remain (LIGHT-01).
- Direction-sensitive derived tokens re-expressed (bright→black-ward, glow→12%), aurora halved (LIGHT-02).
- The six UI-SPEC small-text gold classes use --color-primary-text; the .section-card:hover shadow is the warm paper shadow, not rgba(0,0,0) (LIGHT-05).
- Build passes / no regression introduced by this file (LIGHT-07).
</success_criteria>

<output>
After completion, create `.planning/phases/14-light-theme-adoption/14-02-SUMMARY.md` (include the two STOP-AND-FLAG gold-text spots).
</output>
