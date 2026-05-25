---
phase: 14-light-theme-adoption
plan: 03
type: execute
wave: 2
depends_on: ["14-01"]
files_modified:
  - apps/web/components/issue/DeliberationSlot.tsx
autonomous: true
requirements: [LIGHT-04, LIGHT-07]
nyquist_compliant: true

must_haves:
  truths:
    - "The editor agent chip renders gold-as-text using the AA-safe --color-primary-text (5.97:1), not raw --color-primary (2.24:1) — this covers both the chip initial-letter and the speaker-name label in the .del-conversation chat thread"
    - "The QA Warning severity pill (11px text + border) uses --color-primary-text; the QA Error severity pill uses --color-accent-text — both AA-safe on the light base"
    - "The advocate-score numerals ({scoreValue}/10, 11px) and the '● live' indicator (11px) use --color-primary-text, not raw --color-primary — per UI-SPEC §Accent-as-Text (authoritative token table)"
    - "The Scout/Advocate chips, the 5 Convex subscriptions, AGENT_LABELS, DEL-04 (no model names), and the count-up are unchanged"
  artifacts:
    - path: "apps/web/components/issue/DeliberationSlot.tsx"
      provides: "AA-safe editor chip + QA severity colors + advocate-score/live-indicator text on the light base"
      contains: "var(--color-primary-text)"
  key_links:
    - from: "DeliberationSlot.tsx agentChipStyle() editor branch + .del-conversation render"
      to: "--color-primary-text token (defined in globals.css :root by Plan 02)"
      via: "chip.color = 'var(--color-primary-text)'"
      pattern: "var\\(--color-primary-text\\)"
    - from: "DeliberationSlot.tsx QA_SEVERITY map + advocate-score numeral + live indicator"
      to: "--color-primary-text / --color-accent-text tokens"
      via: "11px gold/rust text color"
      pattern: "var\\(--color-(primary|accent)-text\\)"
---

<objective>
Reconcile the one dark-built component that hardcodes raw brand gold/rust as small text. On the light base, raw gold (#CDA434, 2.24:1) and raw rust (#C2502A, 4.49:1) fail WCAG AA at the 11px sizes used here. Swap the editor agent chip, the QA Warning/Error severity pills, the editor flow-label, the advocate-score numerals, and the "● live" indicator to the AA-safe -text variants. Everything else in this component (5 Convex subscriptions, Scout/Advocate chips, AGENT_LABELS, DEL-04, confidence count-up, flow-line) is preserved byte-compatible. Turns the Plan 01 DeliberationSlot source-scan tripwire green.

Purpose: All other components auto-resolve via the globals.css token swap (Plan 02); DeliberationSlot is the single TSX that needs explicit edits because it hardcodes raw-gold/rust token names for small text. Per UI-SPEC §Accent-as-Text (the AUTHORITATIVE token table — it wins over the §Component Reconciliation Summary when they conflict), the editor chip, QA warning/error, advocate-score numerals, and the live indicator ALL must use the -text variants.
Output: Updated `apps/web/components/issue/DeliberationSlot.tsx`.
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
@apps/web/components/issue/DeliberationSlot.tsx
@CLAUDE.md

<interfaces>
<!-- The two AA-safe tokens these edits reference are added to globals.css :root by Plan 02 (Wave 2, parallel sibling). -->
From apps/web/app/globals.css :root (added in Plan 14-02):
```css
--color-primary-text: #7A5C0E;  /* gold-as-text, 5.97:1 on #FAFAF8 */
--color-accent-text: #9B3015;   /* rust-as-text, 7.11:1 on #FAFAF8 */
```
Current DeliberationSlot spots that hardcode raw token names for small text (all confirmed by direct read):
```typescript
// QA_SEVERITY.warning (line ~74):       color: 'var(--color-primary)'   ← change to -text (11px pill)
// QA_SEVERITY.error   (line ~75):       color: 'var(--color-accent)'    ← change to -text (11px pill)
// agentChipStyle() editor branch (~94): color: 'var(--color-primary)'   ← change to -text
// '● live' indicator span (line ~362):  color: 'var(--color-primary)'   ← change to -text (11px) [BLOCKER 3]
// advocate-score numeral span (~455):   color: 'var(--color-primary)'   ← change to -text (11px) [BLOCKER 3]
// editor del-flow-label (line ~560):    color: 'var(--color-primary)'   ← change to -text (11px label)
```
DECORATIVE raw --color-primary spots that STAY (NOT text, or AA-large): chip background 14% wash (~95), pitch-card selected-badge border/glow (~386/389), selected-badge text+wash (~406-407 — see flag note), advocate-score bar fill (~468), editor flow-circle dot (~555), EDITOR CONFIDENCE numeral (~615, clamp 32-48px = AA-large).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap raw gold/rust for AA-safe -text variants on the editor chip, QA severity pills, editor flow-label, advocate-score numerals, and the live indicator</name>
  <files>apps/web/components/issue/DeliberationSlot.tsx</files>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (the file being edited — QA_SEVERITY ~72-76, agentChipStyle ~79-102, the '● live' indicator ~360-366, the advocate-score numeral ~453-458, the editor del-flow-label ~558-563, and the .del-conversation render ~262-303 that consumes agentChipStyle output)
    - .planning/phases/14-light-theme-adoption/14-UI-SPEC.md (§"Accent-as-Text AA-Safe Variants" lines ~150-157 — the AUTHORITATIVE token→usage map; it lists "advocate score numerals, live indicator" under --color-primary-text; §"Deliberation .del-conversation Chat Thread" lines ~263-274 — the editor-chip reconciliation action)
    - .planning/phases/14-light-theme-adoption/14-RESEARCH.md (§"Pattern 5: Single TSX Code Change" lines ~180-203 + §"Open Question 1" lines ~440-443 — the QA-warning-gold open question)
  </read_first>
  <action>
    SIX targeted edits in apps/web/components/issue/DeliberationSlot.tsx. No logic, no layout, no new props, no subscription changes. The UI-SPEC §Accent-as-Text token table is the authoritative source for which spots take -text variants (it overrides the §Component Reconciliation Summary, which omits the numerals/live-indicator).

    1. agentChipStyle() editor branch (line ~94): change the editor `color` from `'var(--color-primary)'` to `'var(--color-primary-text)'`. Leave `backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)'` (line ~95) UNCHANGED (the 14% gold wash is a decorative background, not text). This single change covers BOTH the chip initial-letter circle AND the speaker-name `<p>` label in the .del-conversation chat thread, because both consume `chip.color` from agentChipStyle. Do NOT touch the scout/advocate branches — `--color-scout` (#3D6B2E) and `--color-advocate` (#1B4F8A) pass AA on light (UI-SPEC §Agent Identity Tokens).

    2. QA_SEVERITY.warning (line ~74): change `color: 'var(--color-primary)'` → `color: 'var(--color-primary-text)'`. RESOLVES RESEARCH Open Question 1: the Warning severity pill renders text at `text-[11px]` with a `1px solid {color}` border — 11px is normal-text size, so raw gold (2.24:1) fails AA. UI-SPEC §Accent-as-Text lists the -text variants for "chips/QA-warning". Use the AA-safe gold.

    3. QA_SEVERITY.error (line ~75): change `color: 'var(--color-accent)'` → `color: 'var(--color-accent-text)'`. Same reason: the Error pill text is 11px; raw rust (#C2502A, 4.49:1) passes AA-large but FAILS normal-text AA at 11px. UI-SPEC §Accent-as-Text line 156 explicitly lists "QA error severity label" under --color-accent-text. Leave QA_SEVERITY.info (`var(--color-text-dim)`) unchanged — #595047 passes AA on light.

    4. '● live' indicator span (line ~362, BLOCKER 3a): change `style={{ color: 'var(--color-primary)' }}` → `style={{ color: 'var(--color-primary-text)' }}` on the live-indicator span (the `● live` text rendered next to "The Scout's Candidates — Pitch Log", `className="ml-2 font-ui text-[11px]"`). It renders at 11px → raw gold = 2.24:1 fails AA. UI-SPEC §Accent-as-Text line 154 lists "live indicator" under --color-primary-text. (The "● live" copy string is unchanged — only the color token changes; the Copywriting Contract is preserved.)

    5. Advocate-score numeral span (line ~455, BLOCKER 3b): change `style={{ color: 'var(--color-primary)' }}` → `style={{ color: 'var(--color-primary-text)' }}` on the `{scoreValue}/10` span (`className="font-ui text-[11px] font-medium"`). It renders at 11px → raw gold = 2.24:1 fails AA. UI-SPEC §Accent-as-Text line 154 lists "advocate score numerals" under --color-primary-text. Leave the adjacent advocate-score progress-bar FILL `backgroundColor: 'var(--color-primary)'` (line ~468) UNCHANGED — that is a decorative gold fill, not text.

    6. Editor del-flow-label inline style (the editor flow node, line ~560): change `style={{ color: 'var(--color-primary)' }}` → `style={{ color: 'var(--color-primary-text)' }}` on THE EDITOR `.del-flow-label` span. `.del-flow-label` is 11px (globals.css line ~919) → raw gold fails AA. Leave THE SCOUT label (`var(--color-scout)`) and THE ADVOCATE label (`var(--color-advocate)`) unchanged — both pass AA on light.
       RESOLUTION RECORD (Flag 2, adjudicated CORRECT by the checker): UI-SPEC line 156 ambiguously lists ".del-flow-label for editor node" under --color-accent-text (rust) while line 157 lists it under --color-primary-text (gold). The editor node renders GOLD in code (matching the editor identity + the editor chip), so --color-primary-text is the consistent and correct choice. Record this resolution in the SUMMARY (the checker confirmed gold is correct here; do NOT switch to rust).

    DO NOT change (decorative / AA-large — all confirmed by direct read):
      - the editor del-flow-circle `backgroundColor: 'var(--color-primary)'` (line ~555 — 10px decorative dot, not text)
      - the advocate-score progress-bar fill `backgroundColor: 'var(--color-primary)'` (line ~468 — decorative fill)
      - the pitch-card selected-badge border/glow (lines ~386/389 — border + glow, not text)
      - the pitch-card selected-badge text + wash (lines ~406-407, `★ Selected this week`, 11px gold text on 14% gold wash) — NOTE this spot was NOT in the blocker list; the revision is targeted, so LEAVE AS-IS and flag in SUMMARY as a possible residual gold-text spot for UAT to confirm (it is on a tinted wash, not pure #FAFAF8, so its effective ratio differs; out of scope for this targeted revision)
      - the EDITOR CONFIDENCE % numeral (line ~615, clamp 32-48px — AA-large context, decorative gold is acceptable at that size)
      - any --color-line/--color-card/--color-text-dim reference (all auto-resolve via Plan 02)
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts 2>&1 | grep -E "DeliberationSlot|passed|failed"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -A3 "agentId === 'editor'" apps/web/components/issue/DeliberationSlot.tsx | grep "color: 'var(--color-primary-text)'"` matches (editor chip text uses AA-safe gold)
    - `grep "warning:" apps/web/components/issue/DeliberationSlot.tsx | grep "var(--color-primary-text)"` matches
    - `grep "error:" apps/web/components/issue/DeliberationSlot.tsx | grep "var(--color-accent-text)"` matches
    - `grep -c "var(--color-primary-text)" apps/web/components/issue/DeliberationSlot.tsx` >= 5 (editor chip + QA warning + editor flow-label + live indicator + advocate-score numeral)
    - `grep "var(--color-accent-text)" apps/web/components/issue/DeliberationSlot.tsx` matches (QA error)
    - The '● live' indicator + advocate-score numeral no longer use raw gold: after edits, the only `color: 'var(--color-primary)'` left in DeliberationSlot.tsx are decorative/AA-large spots (selected-badge text on wash + none others); the two 11px-on-paper text spots (`● live`, `{scoreValue}/10`) use `var(--color-primary-text)`. Confirm: `grep -B1 "● live" apps/web/components/issue/DeliberationSlot.tsx | grep "var(--color-primary-text)"` matches AND `grep -B2 "{scoreValue}/10" apps/web/components/issue/DeliberationSlot.tsx | grep "var(--color-primary-text)"` matches
    - Scout/Advocate chips unchanged: `grep "color: 'var(--color-scout)'" apps/web/components/issue/DeliberationSlot.tsx` matches AND `grep "color: 'var(--color-advocate)'" apps/web/components/issue/DeliberationSlot.tsx` matches
    - 5 Convex subscriptions intact: `grep -c "useQuery(api\." apps/web/components/issue/DeliberationSlot.tsx` == 5
    - DEL-04 preserved: `grep -c "run.cost\|\.cost\b" apps/web/components/issue/DeliberationSlot.tsx` shows no NEW cost reads (the SECURITY comment block at lines ~35-37 is unchanged)
    - Decorative gold fills unchanged: `grep -c "backgroundColor: 'var(--color-primary)'" apps/web/components/issue/DeliberationSlot.tsx` is unchanged from pre-edit (chip wash, bar fill, flow-circle dot all preserved)
    - The Plan 01 DeliberationSlot source-scan tripwire is GREEN: `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` reports the "DeliberationSlot.tsx: editor agent chip + QA warning/error + advocate-score + live-indicator…" it() block passing.
  </acceptance_criteria>
  <done>Editor chip + QA Warning + editor flow-label + '● live' indicator + advocate-score numerals use --color-primary-text; QA Error uses --color-accent-text; Scout/Advocate/info/decorative-fills/subscriptions/DEL-04/count-up all unchanged; the editor del-flow-label gold resolution (Flag 2) and the residual selected-badge spot are recorded in SUMMARY.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` — the DeliberationSlot source-scan tripwire GREEN (now asserts editor chip + QA warning/error + advocate-score numeral + live indicator all use -text variants).
- `cd apps/web && npx vitest run __tests__/deliberation-no-model-names.test.ts __tests__/deliberation-subscriptions.test.ts __tests__/deliberation-conversation.test.ts __tests__/deliberation-qa-severity.test.ts` — all prior deliberation tripwires stay GREEN (DEL-04, 5 subs, conversation thread, QA severity).
- `pnpm --filter web build` exits 0.
- No new prop, no subscription change, no layout/motion edit, no new npm dep.
- NET ACCESSIBILITY INVARIANT: no 11px-on-paper gold TEXT in DeliberationSlot uses raw --color-primary; all such text uses --color-primary-text (#7A5C0E, 5.97:1). Raw gold remains only for decorative fills/dots/borders and the AA-large EDITOR CONFIDENCE numeral.
</verification>

<success_criteria>
- The editor chip + speaker-name label + editor flow-label render gold-as-text via the AA-safe --color-primary-text; the advocate-score numerals and the '● live' indicator use --color-primary-text; QA Warning uses --color-primary-text and QA Error uses --color-accent-text (LIGHT-04).
- Scout/Advocate chips, the 5 Convex subscriptions, DEL-04, the .del-conversation chat thread, the decorative gold fills, and the confidence count-up are byte-compatible (LIGHT-07 regression preserved).
- The editor del-flow-label gold resolution (Flag 2, checker-confirmed) and the residual selected-badge text spot are surfaced in the SUMMARY.
</success_criteria>

<output>
After completion, create `.planning/phases/14-light-theme-adoption/14-03-SUMMARY.md` (record: BLOCKER-3 advocate-score numeral + '● live' indicator fixes, the editor del-flow-label gold resolution, and the residual selected-badge note).
</output>
</content>
</invoke>
