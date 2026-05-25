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
    - "The Scout/Advocate chips, the 5 Convex subscriptions, AGENT_LABELS, DEL-04 (no model names), and the count-up are unchanged"
  artifacts:
    - path: "apps/web/components/issue/DeliberationSlot.tsx"
      provides: "AA-safe editor chip + QA severity colors on the light base"
      contains: "var(--color-primary-text)"
  key_links:
    - from: "DeliberationSlot.tsx agentChipStyle() editor branch + .del-conversation render"
      to: "--color-primary-text token (defined in globals.css :root by Plan 02)"
      via: "chip.color = 'var(--color-primary-text)'"
      pattern: "var\\(--color-primary-text\\)"
    - from: "DeliberationSlot.tsx QA_SEVERITY map"
      to: "--color-primary-text / --color-accent-text tokens"
      via: "QA severity pill color + border"
      pattern: "var\\(--color-(primary|accent)-text\\)"
---

<objective>
Reconcile the one dark-built component that hardcodes raw brand gold/rust as small text. On the light base, raw gold (#CDA434, 2.24:1) and raw rust (#C2502A, 4.49:1) fail WCAG AA at the 11px sizes used here. Swap the editor agent chip to --color-primary-text and the QA Warning/Error severity pills to the AA-safe -text variants. Everything else in this component (5 Convex subscriptions, Scout/Advocate chips, AGENT_LABELS, DEL-04, confidence count-up, flow-line) is preserved byte-compatible. Turns the Plan 01 DeliberationSlot source-scan tripwire green.

Purpose: All other components auto-resolve via the globals.css token swap (Plan 02); DeliberationSlot is the single TSX that needs explicit edits because it hardcodes raw-gold/rust token names for small text.
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
Current DeliberationSlot spots that hardcode raw token names for small text:
```typescript
// agentChipStyle() editor branch (lines ~92-97): color: 'var(--color-primary)'   ← change to -text
// QA_SEVERITY (lines ~72-76): warning.color = 'var(--color-primary)'             ← change to -text
//                              error.color   = 'var(--color-accent)'             ← change to -text
// .del-flow-label editor inline style (line ~560): color: 'var(--color-primary)' ← change to -text (11px label)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap raw gold/rust for AA-safe -text variants on the editor chip, QA severity pills, and the editor flow-label</name>
  <files>apps/web/components/issue/DeliberationSlot.tsx</files>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (the file being edited — QA_SEVERITY ~72-76, agentChipStyle ~79-102, the editor del-flow-label ~558-563, and the .del-conversation render ~262-303 that consumes agentChipStyle output)
    - .planning/phases/14-light-theme-adoption/14-UI-SPEC.md (§"Accent-as-Text AA-Safe Variants" lines ~150-157 — the token→usage map; §"Deliberation .del-conversation Chat Thread" lines ~263-274 — the editor-chip reconciliation action)
    - .planning/phases/14-light-theme-adoption/14-RESEARCH.md (§"Pattern 5: Single TSX Code Change" lines ~180-203 + §"Open Question 1" lines ~440-443 — the QA-warning-gold open question)
  </read_first>
  <action>
    Four targeted edits in apps/web/components/issue/DeliberationSlot.tsx. No logic, no layout, no new props, no subscription changes.

    1. agentChipStyle() editor branch (lines ~92-97): change the editor `color` from `'var(--color-primary)'` to `'var(--color-primary-text)'`. Leave `backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)'` UNCHANGED (the 14% gold wash is a decorative background, not text). This single change covers BOTH the chip initial-letter circle AND the speaker-name `<p>` label in the .del-conversation chat thread, because both consume `chip.color` from agentChipStyle (lines ~279 and ~287). Do NOT touch the scout/advocate branches — `--color-scout` (#3D6B2E) and `--color-advocate` (#1B4F8A) pass AA on light (UI-SPEC §Agent Identity Tokens).

    2. QA_SEVERITY.warning (line ~74): change `color: 'var(--color-primary)'` → `color: 'var(--color-primary-text)'`. RESOLVES RESEARCH Open Question 1: the Warning severity pill renders text at `text-[11px]` (DeliberationSlot line ~741) with a `1px solid {color}` border — 11px is normal-text size, so raw gold (2.24:1) fails AA. UI-SPEC §Accent-as-Text lists the -text variants for "chips/QA-warning". Use the AA-safe gold.

    3. QA_SEVERITY.error (line ~75): change `color: 'var(--color-accent)'` → `color: 'var(--color-accent-text)'`. Same reason: the Error pill text is 11px; raw rust (#C2502A, 4.49:1) passes AA-large but FAILS normal-text AA at 11px. UI-SPEC §Accent-as-Text line 156 explicitly lists "QA error severity label" under --color-accent-text. Leave QA_SEVERITY.info (`var(--color-text-dim)`) unchanged — #595047 passes AA on light.

    4. Editor del-flow-label inline style (the editor flow node, line ~560): change `style={{ color: 'var(--color-primary)' }}` → `style={{ color: 'var(--color-primary-text)' }}` on the THE EDITOR `.del-flow-label` span. `.del-flow-label` is 11px (globals.css line ~919) → raw gold fails AA. Leave the THE SCOUT label (`var(--color-scout)`, line ~516) and THE ADVOCATE label (`var(--color-advocate)`, line ~538) unchanged — both pass AA on light.
       STOP-AND-FLAG NOTE: UI-SPEC line 156 ambiguously lists ".del-flow-label for editor node" under --color-accent-text (rust) while line 157 lists it under --color-primary-text (gold). The editor node renders GOLD in code (matching the editor identity + the editor chip), so --color-primary-text is the consistent choice. Record this UI-SPEC internal inconsistency in the SUMMARY for the checker.

    DO NOT change: the editor del-flow-circle `backgroundColor: 'var(--color-primary)'` (line ~555 — it's a 10px decorative dot, not text), the "● live" indicator `var(--color-primary)` (line ~362 — decorative, but see flag note), the advocate-score numerals `var(--color-primary)` (lines ~363/455 — see flag note), the pitch-card selected-badge gold wash (decorative background), the EDITOR CONFIDENCE % numeral (clamp 32-48px — AA-large context), or any --color-line/--color-card/--color-text-dim reference (all auto-resolve via Plan 02).

    STOP-AND-FLAG (record in SUMMARY, do not change without checker sign-off): the advocate-score `{scoreValue}/10` numerals (lines ~455-457) and the "● live" indicator (line ~362) render `var(--color-primary)` at 11px. UI-SPEC §Accent-as-Text line 154 lists "advocate score numerals" and "live indicator" under --color-primary-text. These are NOT in the UI-SPEC §"Component Reconciliation Summary" explicit change row (which only names agentChipStyle), creating an internal UI-SPEC tension. Flag both in the SUMMARY; do NOT silently change them this plan — defer to checker/UAT to confirm whether the §Accent-as-Text usage list or the §Component Reconciliation Summary is binding.
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts 2>&1 | grep -E "DeliberationSlot|passed|failed"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -A3 "agentId === 'editor'" apps/web/components/issue/DeliberationSlot.tsx | grep "color: 'var(--color-primary-text)'"` matches (editor chip text uses AA-safe gold)
    - `grep "warning:" apps/web/components/issue/DeliberationSlot.tsx | grep "var(--color-primary-text)"` matches
    - `grep "error:" apps/web/components/issue/DeliberationSlot.tsx | grep "var(--color-accent-text)"` matches
    - `grep -c "var(--color-primary-text)" apps/web/components/issue/DeliberationSlot.tsx` >= 3 (editor chip + QA warning + editor flow-label)
    - `grep "var(--color-accent-text)" apps/web/components/issue/DeliberationSlot.tsx` matches (QA error)
    - Scout/Advocate chips unchanged: `grep "color: 'var(--color-scout)'" apps/web/components/issue/DeliberationSlot.tsx` matches AND `grep "color: 'var(--color-advocate)'" apps/web/components/issue/DeliberationSlot.tsx` matches
    - 5 Convex subscriptions intact: `grep -c "useQuery(api\." apps/web/components/issue/DeliberationSlot.tsx` == 5
    - DEL-04 preserved: `grep -c "run.cost\|\.cost\b" apps/web/components/issue/DeliberationSlot.tsx` shows no NEW cost reads (the SECURITY comment block at lines ~35-37 is unchanged)
    - The Plan 01 DeliberationSlot source-scan tripwire is GREEN: `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` reports the "DeliberationSlot.tsx: editor agent chip + QA warning/error…" it() block passing.
  </acceptance_criteria>
  <done>Editor chip + QA Warning use --color-primary-text; QA Error uses --color-accent-text; editor flow-label uses --color-primary-text; Scout/Advocate/info/subscriptions/DEL-04/count-up all unchanged; the two STOP-AND-FLAG spots recorded in SUMMARY.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` — the DeliberationSlot source-scan tripwire GREEN.
- `cd apps/web && npx vitest run __tests__/deliberation-no-model-names.test.ts __tests__/deliberation-subscriptions.test.ts __tests__/deliberation-conversation.test.ts __tests__/deliberation-qa-severity.test.ts` — all prior deliberation tripwires stay GREEN (DEL-04, 5 subs, conversation thread, QA severity).
- `pnpm --filter web build` exits 0.
- No new prop, no subscription change, no layout/motion edit, no new npm dep.
</verification>

<success_criteria>
- The editor chip + speaker-name label + editor flow-label render gold-as-text via the AA-safe --color-primary-text; QA Warning uses --color-primary-text and QA Error uses --color-accent-text (LIGHT-04).
- Scout/Advocate chips, the 5 Convex subscriptions, DEL-04, the .del-conversation chat thread, and the confidence count-up are byte-compatible (LIGHT-07 regression preserved).
- The two STOP-AND-FLAG gold-numeral/live-indicator spots are surfaced in the SUMMARY for checker resolution.
</success_criteria>

<output>
After completion, create `.planning/phases/14-light-theme-adoption/14-03-SUMMARY.md` (include the STOP-AND-FLAG notes: editor del-flow-label UI-SPEC inconsistency + advocate-score/live-indicator gold-numeral spots).
</output>
