---
phase: 12-machine-editorial-design-adoption-and-designagent-suppression
plan: 05
type: execute
wave: 2
depends_on: [01, 04]
files_modified:
  - apps/web/components/issue/DeliberationSlot.tsx
autonomous: true
requirements: [MED-05]

must_haves:
  truths:
    - "DeliberationSlot renders as a three-zone vertical stack: horizontal pitch-log carousel, Scout→Advocate→Editor flow line + tape-reel confidence meter, and QA findings"
    - "All 5 live Convex subscriptions remain byte-compatible (api.pipelineRuns/pitchLog/deliberationEvents/agentVotes/qaCorrections .byRunId with the runId ? {...} : 'skip' sentinel)"
    - "AGENT_LABELS persona names are preserved; no model names are exposed (DEL-04)"
    - "The confidence meter count-up (IntersectionObserver + rAF) is preserved and renders only when a finite 0..1 value is present; reduced-motion shows the final value instantly"
    - "The <details>/<summary> accordion (DEL-03) and ≥44px targets are preserved; the winner card shows a luminous gold glow"
  artifacts:
    - path: "apps/web/components/issue/DeliberationSlot.tsx"
      provides: "Carousel & Flow rebuild with preserved subscriptions + DEL-04"
      contains: "del-flow"
      min_lines: 400
  key_links:
    - from: "DeliberationSlot.tsx useQuery calls"
      to: "Convex api.* byRunId functions"
      via: "runId ? { runId } : 'skip' sentinel (DEL-01)"
      pattern: "byRunId"
    - from: "DeliberationSlot.tsx confidence meter"
      to: ".del-confidence-bar-fill width"
      via: "IntersectionObserver + rAF displayValue count-up"
      pattern: "IntersectionObserver"
---

<objective>
Rebuild `DeliberationSlot.tsx` from the current two-column grid into the board's Carousel & Flow variant (MED-05): a three-zone vertical stack inside the preserved `<details>/<summary>` accordion — Zone 1 a horizontal scroll-snap pitch-log carousel (restyled card interiors, winner luminous glow), Zone 2 a Scout→Advocate→Editor flow-line diagram with the tape-reel confidence meter moved below it, and Zone 3 the QA findings. ALL data bindings are preserved byte-compatible: the 5 Convex subscriptions, AGENT_LABELS, QA_SEVERITY, the `prefersReducedMotion` module-scope check, the `confidenceSectionRef`/`displayValue`/`animatedRef` count-up useEffect, and DEL-04 (no model names). Only the JSX layout + card styling change; the data layer is untouched. The flow-line + confidence-bar CSS classes were already added to globals.css by Plan 04.

Purpose: High-fidelity Machine Editorial deliberation layer that keeps the live Convex deliberation + privacy contracts intact.
Output: rebuilt DeliberationSlot.tsx (visual only; data layer byte-compatible).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-CONTEXT.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-UI-SPEC.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md

@apps/web/components/issue/DeliberationSlot.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rebuild DeliberationSlot.tsx to Carousel & Flow, preserving all data bindings (MED-05)</name>
  <files>apps/web/components/issue/DeliberationSlot.tsx</files>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (full file — note the exact lines that MUST be preserved byte-compatible: the 5 useQuery calls lines ~106-110; AGENT_LABELS lines ~33-49; getAgentLabel; QA_SEVERITY lines ~63-67; agentChipStyle; prefersReducedMotion module-scope lines ~96-98; advocateScores derivation lines ~130-143; editorWinner/editorRationale/editorConfidence parse lines ~146-161; eventOneLiner; isLive; the confidence count-up useEffect lines ~199-232 (ref/displayValue/animatedRef/IntersectionObserver/rAF + the prefersReducedMotion → setDisplayValue(target) path); the <details>/<summary> accordion lines ~248-268 with min-height 44px; the print:hidden class on the outer <section>)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-UI-SPEC.md (§DeliberationSlot — Carousel & Flow (MED-05): Layout Structure (3 zones), Zone 1 card interior spec, Zone 2 flow-line structure + confidence meter spec, Zone 3 QA, Accordion preserved, Reduced-Motion Checklist, Accessibility; §Copywriting Contract → DeliberationSlot existing copy + Flow line copy; §Globals.css Extension Contract for the .del-flow* + .del-confidence-bar* class names already in globals.css)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Pattern 5 — exact preservation targets + visual-changes-only list; Pitfall 4 module-scope prefersReducedMotion)
    - apps/web/__tests__/deliberation-no-model-names.test.ts (the DEL-04 tripwire that must stay green — keep the `// SECURITY: never read run.cost (it contains the model-version map)` comment phrasing intact; never read run.cost / modelVersions in code)
  </read_first>
  <action>
Rewrite `apps/web/components/issue/DeliberationSlot.tsx`. Keep `'use client'` line 1. PRESERVE byte-compatible (do NOT alter logic): the imports, AGENT_LABELS, getAgentLabel, QA_SEVERITY, agentChipStyle, the module-scope `prefersReducedMotion` declaration, the `Props = { runId: string | null }`, all 5 `useQuery(api.*.byRunId, runId ? { runId } : 'skip')` calls, isLoading/isEmpty derivation, advocateScores, editorWinner/editorRationale/editorConfidence parsing, eventOneLiner, isLive, and the ENTIRE confidence count-up useEffect (confidenceSectionRef + displayValue + animatedRef + IntersectionObserver + rAF + the `if (prefersReducedMotion) { setDisplayValue(target); return }` path + `editorConfidence === null` guard + `[editorConfidence]` deps). Keep the `// SECURITY: never read run.cost` comment and never access `run.cost` or `modelVersions`.

Change ONLY the JSX inside the expanded accordion body (the `<>...</>` after the loading/empty branches). Replace the `<div className="grid gap-12 lg:grid-cols-[1fr_1fr]">` two-column layout with the three-zone vertical stack:

ZONE 1 — Horizontal Pitch Log Carousel:
- Keep the `<h3>` heading "The Scout's Candidates — Pitch Log" (machine-readout treatment: Inter 11px uppercase 0.18em — you may keep the existing classes).
- Keep the `pitch-card-list` container + `role="list"` and the `pitchLog.map(...)` loop with the SAME data (card.charityName, card.charityLocation, card.scoutSummary, card.selected, advocateScores lookup, the null-score branch). Restyle each card interior per UI-SPEC Zone 1:
  - `borderRadius: '4px'` (not the `rounded` Tailwind class), `backgroundColor: 'var(--color-card)'`, internal `padding: 24px`.
  - `borderLeft: card.selected ? '3px solid var(--color-primary)' : '3px solid transparent'`.
  - Winner glow when `card.selected`: `boxShadow: '0 0 32px color-mix(in srgb, var(--color-primary) 28%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-primary) 18%, transparent)'` (static; no animation).
  - Charity name → Body size 15px, weight 600, `--color-text`, `font-display`. (Change from `text-[17px] font-medium` to `text-[15px] font-semibold` per RESEARCH.)
  - Location → Inter 11px `--color-text-dim`.
  - Scout summary → Lora 15px italic `--color-text-dim` (change `text-[14px]` to `text-[15px]`).
  - Keep the `★ Selected this week` / `Runner-up` badge and the advocate score bar exactly as today (gold fill, `--color-line-strong` track, the `prefersReducedMotion ? 'none' : 'width 0.6s ease'` transition).
  - Keep `role="listitem"` + `tabIndex={0}` on each card (≥44px effective via padding).

ZONE 2 — Scout → Advocate → Editor Flow Line + Confidence Meter (NEW), rendered only when `pitchLog?.length || editorWinner || editorConfidence !== null`:
- Render a `<div className="del-flow" aria-hidden="true">` (decorative — screen readers get the same info from the event timeline text, which you may keep as a visually-subordinate list or fold into Zone 2; planner discretion, but keep eventOneLiner usage somewhere or drop the standalone timeline if Zone 2 covers it). Inside `.del-flow`, three `.del-flow-node` rows with `.del-flow-connector` between them:
  - Scout node: `.del-flow-circle` styled `backgroundColor: 'var(--color-scout)'`; `.del-flow-label` "THE SCOUT" colored `--color-scout`; `.del-flow-action` "CANDIDATES FOUND".
  - Advocate node: circle `var(--color-advocate)`; label "THE ADVOCATE" colored `--color-advocate`; action "ARGUMENTS SCORED".
  - Editor node: circle `var(--color-primary)`; label "THE EDITOR" colored `--color-primary`; action rendering `{editorWinner} selected` (editorWinner inline as Lora 15px italic `--color-text` per UI-SPEC; fall back to "candidate selected" if editorWinner is null).
- BELOW the flow line, render the confidence meter (moved out of the old editor-decision card). Keep `ref={confidenceSectionRef}` on the meter wrapper. Render ONLY when `editorConfidence !== null`:
  - Label `EDITOR CONFIDENCE` — Inter 11px uppercase 0.18em `--color-text-mute`.
  - Value `{displayValue}%` — Cormorant Garamond Display size via `font-display` + `text-[clamp(32px,3.5vw,48px)]` (or a class), weight 600, `--color-primary`, `aria-live="polite"`.
  - Bar: use `<div className="del-confidence-bar-track"><div className="del-confidence-bar-fill" style={{ width: `${displayValue}%`, transition: prefersReducedMotion ? 'none' : undefined }} /></div>` (the `.del-confidence-bar-*` classes are in globals.css from Plan 04; 8px tall, 4px radius).
  - Keep the below-threshold flag (`editorConfidence < 0.70`) with `--color-accent` left border and the copy "Below 0.70 threshold — human review flagged." Reduce the prose size from `text-[18px]` to Body `text-[15px]` (UI-SPEC Body token).

ZONE 3 — QA Findings:
- Keep the QA corrections block UNCHANGED in logic (corrections.map, QA_SEVERITY lookup, severity pill color+label per WCAG 1.4.1). Keep the "QA Findings" heading with the machine-readout treatment.

Keep the outer `<section id="deliberation" className="... print:hidden">` and the top divider. Keep the intro `<p>` ("N charities were proposed… One was chosen…") or fold it into Zone 1's heading area (discretion). Keep the `<details className="deliberation-slot group">` accordion + `<summary>` ("How this issue was made" + AnchorCopyButton + chevron, min-height 44px) byte-compatible.

Use ONLY existing `--color-*` tokens and the three FONT_WHITELIST font families. Do not introduce new hex literals, new deps, or model names.
  </action>
  <verify>
    <automated>pnpm --filter web test:unit -- machine-editorial-components deliberation</automated>
  </verify>
  <acceptance_criteria>
    - DeliberationSlot.tsx contains all 5 subscriptions: `api.pipelineRuns.byRunId`, `api.pitchLog.byRunId`, `api.deliberationEvents.byRunId`, `api.agentVotes.byRunId`, `api.qaCorrections.byRunId`, each with `runId ? { runId } : 'skip'`
    - DeliberationSlot.tsx contains `AGENT_LABELS`, `prefersReducedMotion`, `confidenceSectionRef`, `IntersectionObserver`, `requestAnimationFrame`, and `del-flow`
    - DeliberationSlot.tsx keeps the `<details` accordion with `minHeight: '44px'` (or `min-h-11`/equivalent) on the summary and `print:hidden` on the outer section
    - The confidence count-up useEffect is byte-equivalent: contains `if (prefersReducedMotion)` → `setDisplayValue(target)` and the `[editorConfidence]` deps and `observer.disconnect()`
    - The `// SECURITY: never read run.cost` comment is preserved; code does NOT contain `run.cost` or `modelVersions`
    - No model-name literal (`claude`/`gpt`/`sonnet`/`haiku`/`openrouter`/`anthropic`) in code (comment-stripped)
    - No hardcoded 6-digit hex in DeliberationSlot.tsx style/JSX
    - `pnpm --filter web test:unit -- machine-editorial-components deliberation` exits 0 (AGENT_LABELS + subscriptions + no-model-names tripwires + existing deliberation-* tests all green)
  </acceptance_criteria>
  <done>DeliberationSlot renders the three-zone Carousel & Flow with winner glow, flow line, and tape-reel meter, while all 5 subscriptions, AGENT_LABELS, DEL-04, the count-up useEffect, and the accordion are preserved; tripwires + existing deliberation tests green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` exits 0 (machine-editorial-components AGENT_LABELS/subscriptions/no-model-names + deliberation-no-model-names + deliberation-subscriptions + deliberation-advocate-scores + deliberation-qa-severity + deliberation-agent-cards all green)
- `pnpm --filter web build` exits 0
- git diff confirms only JSX/layout changed in DeliberationSlot.tsx — the data layer (5 useQuery + parsing + count-up useEffect) is byte-compatible
</verification>

<success_criteria>
- MED-05: DeliberationSlot is a high-fidelity Carousel & Flow (pitch-log carousel + winner glow + Scout→Advocate→Editor flow line + tape-reel confidence meter)
- DEL-04 (no model names) + the 5 live Convex subscriptions + AGENT_LABELS intact
- Reduced-motion-safe: count-up shows final value instantly; no auto-advance
- ≥44px targets; <details>/<summary> accordion preserved; only FONT_WHITELIST fonts; no new deps; no new hex
</success_criteria>

<output>
After completion, create `.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-05-SUMMARY.md`
</output>
