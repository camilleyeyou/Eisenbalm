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
    - "The two new AA-safe text tokens exist (--color-primary-text #7A5C0E, --color-accent-text #9B3015) and every rendered small-text gold class references --color-primary-text — including the live .snw-tag-pill hover/active text"
    - ".section-card:hover uses the warm paper shadow rgba(90,75,50,0.18), not rgba(0,0,0,0.7)"
    - "No rendered text uses raw --color-primary (#CDA434); raw gold remains only for decorative fills/borders/rules"
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
Re-tone the house palette in apps/web/app/globals.css from the fixed Machine Editorial DARK aesthetic to the fixed warm-paper LIGHT aesthetic. This is the anchor change: replace every --color-* token VALUE in :root, add the two AA-safe text tokens, re-express the three direction-sensitive derived tokens, halve the aurora glows, swap the .section-card:hover black drop-shadow for a warm paper shadow, and repoint every small-text gold class that renders on the light base to --color-primary-text (the six original UI-SPEC classes PLUS the live .snw-tag-pill hover/active text). Layout, spacing, typography, motion, fonts, and theme.ts logic are UNTOUCHED — only color values and the dark-tuned effects change. Turns the Plan 01 globals.css source-scan tripwires green.

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
    - .planning/phases/14-light-theme-adoption/14-RESEARCH.md (§"Pattern 1: Token Swap" + §"Pattern 2: color-mix Re-Expression" lines ~100-155 — the dark→light value map and the white→black flip; NOTE the surface-hex caveat below)
  </read_first>
  <action>
    NOTE ON HEX SOURCE (resolves a known RESEARCH↔UI-SPEC discrepancy — WARNING 4): copy the surface/card hex ONLY from the 14-UI-SPEC.md token table (§Surface Tokens: --color-surface #F2EFE9 / --color-card #EDE9E1 / --color-card-hover #E5E0D6), NOT from the 14-RESEARCH.md Pattern 1 code example (which shows the older warmer-paper variants #F0ECE3 / #EDE8DE / #E5DFD3). The UI-SPEC token table is AUTHORITATIVE whenever the two disagree. The acceptance_criteria greps below assert the UI-SPEC values (#F2EFE9 etc.).

    DEAD-CODE INVESTIGATION (do this FIRST, before any edit — resolves the `.section-card.feature .sc-name` 27px-gold question, BLOCKER 2): grep apps/web for any component/route that renders the `.section-card` / `.sc-name` system:
      `grep -rn "section-card\|sc-name\|section-cards" apps/web --include="*.tsx"`
    The live Phase-12 navigator uses the `.snw-*` vertical-timeline classes (SectionNavigator.tsx), so `.section-card.feature .sc-name` (globals.css line ~542, 27px gold) is expected to be Phase-11 legacy with NO render path (the only non-globals reference is a test-source-scan comment in motion-polish.test.ts, which is not a render). BRANCH on the grep result:
      - IF any TSX renders `.section-card` / `.sc-name`: this is a LIVE 27px gold-on-paper violation (#CDA434 = 2.24:1, fails even AA-large ≥3:1). ADD `.section-card.feature .sc-name` to the small-text gold→`--color-primary-text` fix list in Task 2 sub-edit C (#7A5C0E = 5.97:1 clears AA-large). Note: also tell Plan 01's 14-01 tripwire author this selector is now in-scope.
      - IF confirmed unrendered dead code (EXPECTED): leave `.section-card.feature .sc-name` as raw `--color-primary` and DOCUMENT THIS EXPLICITLY in 14-02-SUMMARY: "`.section-card` / `.sc-name` confirmed dead code — no render path in apps/web (only SectionNavigator's `.snw-*` renders); raw gold retained on `.sc-name`, NOT a live AA violation." Do NOT leave it silently unaddressed.

    In the FIRST `:root { }` block of apps/web/app/globals.css (lines ~32-71), replace token VALUES exactly as follows. Copy hex verbatim from 14-UI-SPEC.md. Do NOT touch the @theme block (lines 11-23 — those are identity re-exports), the shadcn shim :root (lines ~165-176 — auto-resolve), font tokens (lines 68-70 — locked), or any layout/spacing.

    Core base (UI-SPEC §Core Base Tokens):
      --color-bg: #FAFAF8;            /* was #0C0B0A — warm paper */
      --color-text: #1A1A1A;          /* was #F0EAD9 — near-black ink */
      --color-primary: #CDA434;       /* UNCHANGED — brand gold */
      --color-accent: #C2502A;        /* UNCHANGED — brand rust */

    Surfaces (UI-SPEC §Surface Tokens — these are the LOCKED spec values; note these differ from the RESEARCH code-example warmer-paper variants — the UI-SPEC table is authoritative, see NOTE above):
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
    - `grep "--color-surface: #F2EFE9" apps/web/app/globals.css` matches (UI-SPEC value, NOT the RESEARCH #F0ECE3)
    - `grep "--color-card: #EDE9E1" apps/web/app/globals.css` matches (UI-SPEC value, NOT the RESEARCH #EDE8DE)
    - `grep "--color-card-hover: #E5E0D6" apps/web/app/globals.css` matches (UI-SPEC value, NOT the RESEARCH #E5DFD3)
    - `grep -c "#F0ECE3\|#EDE8DE\|#E5DFD3" apps/web/app/globals.css` == 0 (none of the RESEARCH-example surface variants leaked in)
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
    - 14-02-SUMMARY records the `.section-card.feature .sc-name` dead-code determination (rendered → fixed in 2-C, OR confirmed dead → raw gold retained + documented)
  </acceptance_criteria>
  <done>:root emits the locked light palette; the two new AA-safe text tokens exist; --color-primary-bright mixes toward black; --color-primary-glow is 12%; line/border aliases unchanged; no dark base literals remain; surface hex match the UI-SPEC table (not RESEARCH); the .section-card.feature .sc-name dead-code status is determined and recorded.</done>
</task>

<task type="auto">
  <name>Task 2: Reconcile dark-tuned effects (aurora glows, section-card paper shadow) + repoint every rendered small-text gold class to --color-primary-text</name>
  <files>apps/web/app/globals.css</files>
  <read_first>
    - apps/web/app/globals.css (the .aurora block ~313-337, .section-card:hover ~521-528, the six original small-text classes: .sc-num ~553, .sc-arrow ~580, .snw-module-label ~658, .snw-title-accent ~677, .snw-section-num ~732, .snw-read-value ~859, AND the live .snw-tag-pill hover/active block ~808-812)
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
       (Per UI-SPEC the offset/blur/spread also change to the paper-appropriate 0 8px 32px -8px — copy the full replacement line verbatim from the UI-SPEC code block.) Leave the `.section-card:hover` border-color (var(--color-primary)) and any motion-polish translateY UNCHANGED.

    C) SMALL-TEXT GOLD CLASSES (rendered text only) — change `color: var(--color-primary);` → `color: var(--color-primary-text);` in EXACTLY these EIGHT declaration spots (the six UI-SPEC label classes PLUS the live tag-pill hover/active text). These are all 11px/label gold TEXT that fails AA on light:
       1. `.sc-num` (line ~556, 11px)
       2. `.sc-arrow` (line ~583, 11px)
       3. `.snw-module-label`
       4. `.snw-title-accent`
       5. `.snw-section-num`
       6. `.snw-read-value`
       7. `.snw-row:hover .snw-tag-pill` — the `color:` declaration ONLY (globals.css line ~811, 11px tag-pill text turning gold on hover). BLOCKER 1: this is the LIVE Phase-12 vertical-timeline navigator (SectionNavigator.tsx renders `.snw-tag-pill`), so 11px raw gold here is a real AA violation. The selector pair `.snw-row:hover .snw-tag-pill, .snw-row.active .snw-tag-pill { border-color: var(--color-primary); color: var(--color-primary); }` shares one block — change ONLY the `color:` line to `var(--color-primary-text)`.
       8. `.snw-row.active .snw-tag-pill` — covered by the same shared declaration block as #7 (the two selectors share one rule body at lines ~808-812). Changing the single `color:` line satisfies both selectors. (Counted as the 8th spot because both hover AND active states are the live violation surface.)
       NET RESULT: `grep -c "color: var(--color-primary-text)"` in globals.css == 7 declarations (six label classes + the one shared tag-pill hover/active block). The "≥8" in this plan's intent counts the eight selector spots; the literal declaration count is 7 because hover+active share one block — both are acceptable; assert the declaration count is >= 7 (see acceptance_criteria).

       DO NOT change these (they legitimately keep raw --color-primary — decorative/border/large-glyph/fill uses):
       - `.drop-cap > p:first-of-type::first-letter` (decorative 3.5em display glyph)
       - `.section-card:hover` border-color (border, not text)
       - `.section-card.feature .sc-name` (27px display title — DEAD CODE per Task 1 investigation; only touch IF Task 1 found it rendered)
       - `.snw-row.active` border-left `var(--color-primary)` (line ~782 — 2px border, not text)
       - `.snw-node.active` border-color/background (node dot fill)
       - `.snw-row:hover/.active .snw-tag-pill` BORDER-COLOR (line ~810 — border, not text; ONLY the color: line changes)
       - `.del-confidence-bar-fill` background (gold fill — decorative)
       - `.progress` gradient (gold fill — decorative)

    RESOLUTION RECORD (record in SUMMARY): BLOCKER 1 (`.snw-tag-pill` hover/active 11px gold text) is now FIXED here in 2-C. BLOCKER 2 (`.section-card.feature .sc-name` 27px gold) is resolved by the Task 1 dead-code investigation — fixed if rendered, else documented as dead code. After this plan, NO rendered text in globals.css uses raw `--color-primary`; raw gold remains only on borders, fills, the dead `.sc-name`, and the decorative drop-cap glyph.
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
    - `grep -c "color: var(--color-primary-text)" apps/web/app/globals.css` >= 7 (six label classes + the shared .snw-tag-pill hover/active block — up from the old count of 6, now includes the BLOCKER-1 tag-pill fix)
    - The `.snw-tag-pill` hover/active block has its `color:` on `var(--color-primary-text)` while its `border-color:` stays `var(--color-primary)`: `grep -A2 "snw-row.active .snw-tag-pill" apps/web/app/globals.css | grep "color: var(--color-primary-text)"` matches AND `grep -A2 "snw-row.active .snw-tag-pill" apps/web/app/globals.css | grep "border-color: var(--color-primary)"` matches
    - No rendered small-text gold remains raw: the only `color: var(--color-primary);` (text color, trailing semicolon, not border-color/background) left in globals.css is `.section-card.feature .sc-name` IFF it was confirmed dead code in Task 1 (otherwise zero).
    - The Plan 01 globals.css source-scan tripwires now PASS: `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` reports the "globals.css: small-text gold classes…" and "…no rgba(0,0,0) in .section-card" it() blocks GREEN.
  </acceptance_criteria>
  <done>Aurora glows halved to 5/3/2%; the black drop-shadow is replaced by the warm paper shadow; the six UI-SPEC small-text gold classes AND the live .snw-tag-pill hover/active text use --color-primary-text (tag-pill border-color stays raw gold); BLOCKER 1 fixed, BLOCKER 2 resolved per Task 1; no rendered text uses raw --color-primary.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` — all Plan 01 contrast + globals.css source-scan tripwires GREEN.
- `pnpm --filter web build` exits 0 (the build gate for LIGHT-07 — run after Plan 03 also lands; this plan must not break the build).
- No layout/spacing/typography/motion/font edit; no new npm dep; no Google Fonts URL added; theme.ts untouched.
- NET ACCESSIBILITY INVARIANT: no rendered text in globals.css uses raw --color-primary (#CDA434, 2.24:1); every gold-text spot uses --color-primary-text (#7A5C0E, 5.97:1). Raw gold remains only for decorative fills/borders/rules and the (dead) .sc-name title.
</verification>

<success_criteria>
- :root emits the locked warm-paper light palette; no dark base/ink literals remain; surface hex match the UI-SPEC table not the RESEARCH example (LIGHT-01).
- Direction-sensitive derived tokens re-expressed (bright→black-ward, glow→12%), aurora halved (LIGHT-02).
- The six UI-SPEC small-text gold classes AND the live .snw-tag-pill hover/active text use --color-primary-text; the .section-card:hover shadow is the warm paper shadow, not rgba(0,0,0); the dead .sc-name is resolved per Task 1 (LIGHT-05).
- Build passes / no regression introduced by this file (LIGHT-07).
</success_criteria>

<output>
After completion, create `.planning/phases/14-light-theme-adoption/14-02-SUMMARY.md` (record: the surface-hex source resolution, the BLOCKER-1 .snw-tag-pill fix, and the BLOCKER-2 .section-card.feature .sc-name dead-code determination).
</output>
</content>
</invoke>
