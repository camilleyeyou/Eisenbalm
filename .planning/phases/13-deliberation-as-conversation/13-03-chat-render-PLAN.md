---
phase: 13-deliberation-as-conversation
plan: 03
type: execute
wave: 2
depends_on: ["13-01"]
files_modified:
  - apps/web/lib/sanity/types.ts
  - apps/web/lib/sanity/queries.ts
  - apps/web/app/globals.css
  - apps/web/components/issue/DeliberationSlot.tsx
  - apps/web/app/issue/[slug]/page.tsx
  - apps/web/components/issue/PodcastSlot.tsx
  - apps/web/__tests__/deliberation-conversation.test.ts
  - apps/web/__tests__/podcast-slot.test.ts
  - .planning/ROADMAP.md
autonomous: true
requirements: [DEL-CONV-04, DEL-CONV-05, DEL-CONV-06]
must_haves:
  truths:
    - "The deliberation conversation renders as a formatted chat thread at the TOP of the #deliberation section, visible by default (not inside a <details>)"
    - "Each turn shows a per-speaker accent chip + persona name + role + plain-string turn text; no literal Markdown characters are ever rendered and no Markdown parser / dangerouslySetInnerHTML is used"
    - "The raw <pre>{transcript}</pre> dump is removed from PodcastSlot.tsx; the deliberationTranscript field + its GROQ projection are retained (NotebookLM source — D-17)"
    - "podcast-slot.test.ts asserts the <pre>/<details> transcript render is ABSENT and the <audio> player is PRESENT; ROADMAP.md records that D-10 supersedes POD-02's reader-facing transcript render"
    - "The new conversation field flows GROQ -> types -> page.tsx prop -> DeliberationSlot render"
    - "DEL-04 (no model names), prefers-reduced-motion, WCAG AA, single <main>, ≥44px touch targets, 5 Convex subscriptions all preserved; pnpm --filter web build passes"
  artifacts:
    - path: "apps/web/lib/sanity/types.ts"
      provides: "IssueDeliberationTurn type + conversation field on IssueDeliberation"
      contains: "IssueDeliberationTurn"
    - path: "apps/web/lib/sanity/queries.ts"
      provides: "conversation[] { speaker, text } in QUERY_ISSUE_BY_SLUG"
      contains: "conversation"
    - path: "apps/web/app/globals.css"
      provides: ".del-conversation* class block"
      contains: ".del-conversation"
    - path: "apps/web/components/issue/DeliberationSlot.tsx"
      provides: "conversation prop + chat-thread render block above the <details> machine view"
      contains: "del-conversation"
    - path: "apps/web/components/issue/PodcastSlot.tsx"
      provides: "<pre>{transcript}</pre> block removed; audio + description + empty state retained"
    - path: "apps/web/__tests__/podcast-slot.test.ts"
      provides: "POD-02 render assertions flipped to absence; <audio>/empty-state assertions retained"
      contains: "not.toContain"
    - path: ".planning/ROADMAP.md"
      provides: "Phase 13 Supersedes note recording D-10 supersedes POD-02's reader-facing transcript render"
      contains: "POD-02"
  key_links:
    - from: "apps/web/app/issue/[slug]/page.tsx"
      to: "DeliberationSlot conversation prop"
      via: "issue.selectionDeliberation?.conversation ?? null"
      pattern: "conversation="
    - from: "DeliberationSlot conversation render"
      to: "agentChipStyle / getAgentLabel / /agents/[agentId]"
      via: "reused per-speaker accent + persona name + DEL-06 link"
      pattern: "agentChipStyle\\("
    - from: "queries.ts QUERY_ISSUE_BY_SLUG"
      to: "Issue.selectionDeliberation.conversation"
      via: "conversation[] { speaker, text } projection"
      pattern: "conversation\\[\\]"
---

<objective>
Build the frontend consumer: render the structured dialogue turns as a formatted chat thread at the top of the #deliberation section, and remove the raw-Markdown `<pre>` dump from PodcastSlot.

This plan (in the exact contract order types → query → CSS → component → page → podcast):
1. Extends apps/web/lib/sanity/types.ts with `IssueDeliberationTurn` and adds `conversation` to `IssueDeliberation`.
2. Extends QUERY_ISSUE_BY_SLUG in queries.ts with `conversation[] { speaker, text }`.
3. Adds the `.del-conversation*` class block to globals.css (the ONLY new CSS — UI-SPEC CSS Convention Contract).
4. Extends DeliberationSlot.tsx with a `conversation` prop and a chat-thread render block ABOVE the existing `<details>` machine view — reusing `getAgentLabel` / `agentChipStyle` / `/agents/[agentId]` and the module-scope `prefersReducedMotion` already in the file.
5. Threads `conversation={issue.selectionDeliberation?.conversation ?? null}` from page.tsx.
6. Removes the `<pre>{transcript}</pre>` collapsible block from PodcastSlot.tsx (D-10), keeping the audio player, description, empty state, and the `deliberationTranscript` field/type (D-17); flips podcast-slot.test.ts's POD-02 render assertions to absence checks; and records the deliberate POD-02 supersession in ROADMAP.md.
7. Un-skips the Plan-13-03 render assertions in the Wave 0 web test.

Purpose: surface the conversation as the magazine-quality deliberation read (the signature feature) inline, replacing the buried raw-Markdown blob.
Output: a chat-thread render that reads from Sanity, fully within the locked accessibility + DEL-04 + no-new-deps constraints; web build green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/13-deliberation-as-conversation/13-CONTEXT.md
@.planning/phases/13-deliberation-as-conversation/13-RESEARCH.md
@.planning/phases/13-deliberation-as-conversation/13-VALIDATION.md
@.planning/phases/13-deliberation-as-conversation/13-UI-SPEC.md

<interfaces>
<!-- Contract this plan consumes (declared by Plan 01 in API_CONTRACTS §1.2; produced by Plan 02). -->

TypeScript types to add (apps/web/lib/sanity/types.ts ~line 106):
```typescript
export type IssueDeliberationTurn = {
  speaker: string   // "scout" | "advocate" | "editor"
  text: string
}
// IssueDeliberation gains:  conversation: IssueDeliberationTurn[] | null
```

GROQ projection to add (queries.ts selectionDeliberation block, after runnerUpNotes):
```groq
conversation[] { speaker, text },
```

Reusable assets already in DeliberationSlot.tsx (do NOT redeclare):
- AGENT_LABELS + getAgentLabel(agentId) -> { displayName, role }   (lines 41-67)
- agentChipStyle(agentId) -> { color, backgroundColor }            (lines 78-101): scout->--color-scout, advocate->--color-advocate, editor->--color-primary, else --color-text-dim
- const prefersReducedMotion (module scope, line 104) — do NOT move into the component
- existing render: section#deliberation (line 244) -> top divider (lines 248-253) -> <details className="deliberation-slot group"> "How this issue was made" (line 256)

UI-SPEC locked specifics: thread wrapper class `.del-conversation` (max-width 740px, mx-auto), per-turn class `.del-conversation-turn` (flex gap-12px py-12px min-height 44px, border-b --color-line-strong, last:none), chip class `.del-conversation-chip` (32x32 circle, font-ui 11px 600), body class `.del-conversation-body` (flex 1 min-w-0). Eyebrow label "The Deliberation" (font-ui 11px uppercase tracking 0.18em, --color-text-dim). Turn text 15px/1.65 --color-text-dim. Speaker name 11px/600 in per-speaker accent var. role="log" aria-label="Deliberation conversation". Chip is an <a href="/agents/${speaker}"> with aria-label.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend types.ts + queries.ts + globals.css for the conversation thread</name>
  <files>apps/web/lib/sanity/types.ts, apps/web/lib/sanity/queries.ts, apps/web/app/globals.css</files>
  <read_first>
    - apps/web/lib/sanity/types.ts (lines 94-130 — IssuePodcast, IssueDeliberationCandidate, IssueDeliberation, Issue; the exact existing shapes)
    - apps/web/lib/sanity/queries.ts (lines 77-95 — the podcast + selectionDeliberation projection in QUERY_ISSUE_BY_SLUG)
    - apps/web/app/globals.css (find the existing .del-flow / .del-confidence-bar-* / .pitch-card-list blocks and the Phase 12 section-banner comment style — append the new block following that convention)
    - docs/API_CONTRACTS.md (§1.2 — the conversation[] { speaker, text } projection Plan 01 added; match exactly)
    - .planning/phases/13-deliberation-as-conversation/13-UI-SPEC.md (CSS Convention Contract — the exact .del-conversation* CSS block to paste)
  </read_first>
  <action>
    A) apps/web/lib/sanity/types.ts:
    - After `IssueDeliberationCandidate` (ends ~line 106) and before `IssueDeliberation`, add:
      ```typescript
      export type IssueDeliberationTurn = {
        speaker: string   // "scout" | "advocate" | "editor"
        text: string
      }
      ```
    - In `IssueDeliberation`, add the `conversation` field after `runnerUpNotes`:
      ```typescript
      export type IssueDeliberation = {
        candidates: IssueDeliberationCandidate[] | null
        editorDecision: string | null
        runnerUpNotes: string | null
        conversation: IssueDeliberationTurn[] | null
      } | null
      ```
    Leave IssuePodcast (incl. deliberationTranscript) unchanged — D-17.

    B) apps/web/lib/sanity/queries.ts — in QUERY_ISSUE_BY_SLUG's `selectionDeliberation { ... }` block (lines 84-93), after `runnerUpNotes,` add a new line so the block becomes:
    ```groq
      editorDecision,
      runnerUpNotes,
      conversation[] { speaker, text },
    ```
    Leave the `podcast { ... deliberationTranscript, }` projection unchanged — D-17.

    C) apps/web/app/globals.css — append this block (paste verbatim from UI-SPEC CSS Convention Contract), after the existing Phase 12 deliberation CSS blocks, behind a section banner comment:
    ```css
    /* ═══ Phase 13 — Deliberation Conversation Thread ══════════════════════
       Component-scoped styles for the chat-thread render in DeliberationSlot.
       All colors via CSS vars only — no hardcoded hex. No new tokens.
       ═════════════════════════════════════════════════════════════════════ */
    .del-conversation {
      max-width: 740px;
      margin-inline: auto;
    }
    .del-conversation-turn {
      display: flex;
      gap: 12px;
      padding-block: 12px;
      min-height: 44px;
      border-bottom: 1px solid var(--color-line-strong);
    }
    .del-conversation-turn:last-child {
      border-bottom: none;
    }
    .del-conversation-chip {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-ui);
      font-size: 11px;
      font-weight: 600;
      text-decoration: none;
      align-self: flex-start;
      margin-top: 2px;
    }
    .del-conversation-body {
      flex: 1;
      min-width: 0;
    }
    ```
    These are the ONLY new globals.css additions for this phase (UI-SPEC). Do NOT add any new CSS variable/token; do NOT hardcode any hex in this block.
  </action>
  <verify>
    <automated>grep -n "IssueDeliberationTurn" apps/web/lib/sanity/types.ts && grep -n "conversation\[\] { speaker, text }" apps/web/lib/sanity/queries.ts && grep -n "del-conversation" apps/web/app/globals.css</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export type IssueDeliberationTurn" apps/web/lib/sanity/types.ts` returns 1
    - `grep -n "conversation: IssueDeliberationTurn\[\] | null" apps/web/lib/sanity/types.ts` returns one line inside IssueDeliberation
    - `grep -n "deliberationTranscript" apps/web/lib/sanity/types.ts` still returns (IssuePodcast unchanged — D-17)
    - `grep -n "conversation\[\] { speaker, text }" apps/web/lib/sanity/queries.ts` returns one line inside the selectionDeliberation block
    - `grep -n "deliberationTranscript," apps/web/lib/sanity/queries.ts` still returns (podcast projection unchanged — D-17)
    - `grep -c "del-conversation" apps/web/app/globals.css` returns ≥4 (.del-conversation, -turn, -chip, -body)
    - The appended .del-conversation* block contains no hardcoded hex — `grep -nA40 "Phase 13 — Deliberation Conversation Thread" apps/web/app/globals.css | grep -iE "#[0-9a-f]{6}"` returns nothing (vars only)
    - `pnpm --filter web build` exits 0 (types compile)
  </acceptance_criteria>
  <done>IssueDeliberationTurn type + conversation field added; GROQ projects conversation[]; .del-conversation* CSS block appended (vars only); D-17 transcript path untouched; build green.</done>
</task>

<task type="auto">
  <name>Task 2: Render the chat thread in DeliberationSlot.tsx + thread the prop from page.tsx</name>
  <files>apps/web/components/issue/DeliberationSlot.tsx, apps/web/app/issue/[slug]/page.tsx</files>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (lines 1-120 — imports, AGENT_LABELS, getAgentLabel, agentChipStyle, prefersReducedMotion module scope; lines 108-111 the Props type; lines 243-256 — section#deliberation + top divider + the <details> open. The conversation block inserts between line 253 (after the divider) and line 256 (the <details>))
    - apps/web/app/issue/[slug]/page.tsx (lines 41-42 imports; line 243 `<DeliberationSlot runId={issue.runId ?? null} />` — the prop call to extend)
    - apps/web/lib/sanity/types.ts (the IssueDeliberationTurn type to import)
    - apps/web/__tests__/deliberation-no-model-names.test.ts (the never-skipped tripwire that scans this file — confirm no model literals enter)
    - .planning/phases/13-deliberation-as-conversation/13-UI-SPEC.md (Chat Thread Component Contract: placement, guard, container, per-turn anatomy, eyebrow label, motion contract, empty state, accessibility contract, DEL-04 checklist)
    - .planning/phases/13-deliberation-as-conversation/13-RESEARCH.md (Pattern 8 chat render; Pattern 9 prop threading; Pitfall 3 model-name leak; Pitfall 5 prefersReducedMotion module scope; Pitfall 7 no Markdown)
  </read_first>
  <action>
    A) DeliberationSlot.tsx:
    - Import the type at the top with the other imports: `import type { IssueDeliberationTurn } from '@/lib/sanity/types'`
    - Extend the Props type (line ~109) from `type Props = { runId: string | null }` to:
      ```typescript
      type Props = { runId: string | null; conversation: IssueDeliberationTurn[] | null }
      ```
      and update the destructure on line ~111: `export function DeliberationSlot({ runId, conversation }: Props) {`
    - Insert the chat-thread render block INSIDE the returned `<section id="deliberation">`, AFTER the top divider `<div className="mb-8 h-px" ... aria-hidden="true" />` (line ~253) and BEFORE `<details className="deliberation-slot group">` (line ~256). The block (verbatim, implementing the UI-SPEC per-turn anatomy; uses `getAgentLabel` + `agentChipStyle` already in scope):
      ```tsx
      {conversation && conversation.length > 0 && (
        <div className="del-conversation mb-8">
          <p
            className="font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em] mb-6"
            style={{ color: 'var(--color-text-dim)' }}
          >
            The Deliberation
          </p>
          <div role="log" aria-label="Deliberation conversation">
            {conversation.map((turn, i) => {
              const label = getAgentLabel(turn.speaker)
              const chip = agentChipStyle(turn.speaker)
              return (
                <div className="del-conversation-turn" key={i}>
                  <a
                    href={`/agents/${turn.speaker}`}
                    className="del-conversation-chip"
                    style={{ color: chip.color, backgroundColor: chip.backgroundColor }}
                    aria-label={label.displayName}
                  >
                    {label.displayName.replace(/^The\s+/, '').charAt(0)}
                  </a>
                  <div className="del-conversation-body">
                    <p
                      className="font-ui text-[11px] font-semibold leading-[1.5] mb-1"
                      style={{ color: chip.color }}
                    >
                      {label.displayName} — {label.role}
                    </p>
                    <p
                      className="font-body text-[15px] leading-[1.65]"
                      style={{ color: 'var(--color-text-dim)' }}
                    >
                      {turn.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      ```
      CRITICAL constraints (UI-SPEC + DEL-04 checklist):
      - `turn.text` rendered as `{turn.text}` ONLY — never via dangerouslySetInnerHTML, never via any Markdown parser.
      - The chip text uses the persona initial (first letter after stripping a leading "The "), per UI-SPEC.
      - Reuse `getAgentLabel` + `agentChipStyle` (already defined in this file) — do NOT duplicate the speaker→color mapping.
      - Do NOT introduce any motion (UI-SPEC Motion Contract — none by default). Do NOT move or redeclare `prefersReducedMotion`.
      - Do NOT reference any model name (claude/gpt/sonnet/haiku/openrouter), `modelVersions`, or `run.cost` anywhere — the never-skipped DEL-04 tripwire scans this file after comment-stripping.
    - Do NOT touch the existing `<details>` machine view, the 5 Convex subscriptions, AGENT_LABELS, agentChipStyle, or the confidence count-up. Additive only.

    B) page.tsx — change line ~243 from:
      ```tsx
      <DeliberationSlot runId={issue.runId ?? null} />
      ```
      to:
      ```tsx
      <DeliberationSlot
        runId={issue.runId ?? null}
        conversation={issue.selectionDeliberation?.conversation ?? null}
      />
      ```
  </action>
  <verify>
    <automated>pnpm --filter web build && pnpm --filter web test:unit deliberation-no-model-names</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "del-conversation" apps/web/components/issue/DeliberationSlot.tsx` returns ≥3 lines (wrapper + turn + chip/body usages)
    - `grep -n 'role="log"' apps/web/components/issue/DeliberationSlot.tsx` returns one line with `aria-label="Deliberation conversation"`
    - `grep -n "conversation: IssueDeliberationTurn\[\] | null" apps/web/components/issue/DeliberationSlot.tsx` returns the extended Props type
    - `grep -n "{ runId, conversation }: Props" apps/web/components/issue/DeliberationSlot.tsx` returns the updated destructure
    - `grep -n "agentChipStyle(turn.speaker)" apps/web/components/issue/DeliberationSlot.tsx` returns one line (reuses existing helper)
    - `grep -n 'href={`/agents/${turn.speaker}`}' apps/web/components/issue/DeliberationSlot.tsx` returns one line (DEL-06 link)
    - `grep -c "dangerouslySetInnerHTML" apps/web/components/issue/DeliberationSlot.tsx` returns 0
    - `grep -niE "claude|gpt|sonnet|haiku|openrouter" apps/web/components/issue/DeliberationSlot.tsx` returns NO match (DEL-04)
    - `grep -c "prefersReducedMotion" apps/web/components/issue/DeliberationSlot.tsx` is unchanged from before this task (still module scope; not moved into the component)
    - `grep -n "conversation={issue.selectionDeliberation?.conversation ?? null}" apps/web/app/issue/[slug]/page.tsx` returns one line
    - `pnpm --filter web build` exits 0
    - `pnpm --filter web test:unit deliberation-no-model-names` exits 0 (DEL-04 tripwire green)
  </acceptance_criteria>
  <done>DeliberationSlot renders the chat thread above the machine view using reused helpers; page.tsx threads the conversation prop; DEL-04 tripwire green; build green; reduced-motion + 5 subs preserved.</done>
</task>

<task type="auto">
  <name>Task 3: Remove the <pre> transcript dump from PodcastSlot.tsx + flip the POD-02 tests to absence + record the POD-02 supersession + un-skip the Wave 0 render assertions</name>
  <files>apps/web/components/issue/PodcastSlot.tsx, apps/web/__tests__/podcast-slot.test.ts, apps/web/__tests__/deliberation-conversation.test.ts, .planning/ROADMAP.md</files>
  <read_first>
    - apps/web/components/issue/PodcastSlot.tsx (full file — lines 1-136; specifically lines 96-130 the `{transcript && (<details className="group">...<pre>{transcript}</pre>...</details>)}` block to remove, and lines 29 `const transcript = ...` + 132 the trailing spacer)
    - apps/web/__tests__/podcast-slot.test.ts (full file — Phase 9 leaves ALL assertions active. Lines 39-45 hard-assert `deliberationTranscript` reference + `<details>` presence; lines 61-64 hard-assert the "Read full deliberation transcript" label. Removing the render in PodcastSlot.tsx WILL break these three assertions — they must be flipped to absence checks IN LOCKSTEP, not left conditional.)
    - apps/web/__tests__/deliberation-conversation.test.ts (the Plan-13-03 describe.skip block to un-skip — Plan 01 created it)
    - .planning/ROADMAP.md (Phase 13 section, lines ~250-265 — add the Supersedes line under the **Requirements** line)
    - .planning/REQUIREMENTS.md (POD-02 line 132 — confirm exact wording for the cross-reference: "Issue page renders a collapsible transcript when podcast.deliberationTranscript is populated")
    - .planning/phases/13-deliberation-as-conversation/13-UI-SPEC.md (PodcastSlot Removal Contract — exactly what is kept vs removed)
    - .planning/phases/13-deliberation-as-conversation/13-CONTEXT.md (D-10 line 86, D-17 lines 113-116)
  </read_first>
  <action>
    A) apps/web/components/issue/PodcastSlot.tsx — REMOVE the entire collapsible transcript block (lines ~96-130):
    ```tsx
    {/* Collapsible transcript (POD-02) */}
    {transcript && (
      <details className="group">
        ...
        <pre ...>{transcript}</pre>
      </details>
    )}
    ```
    Delete that whole `{transcript && ( ... )}` JSX expression. KEEP everything else: the `<audio>` player (POD-01), description text, "Audio coming soon." empty state (POD-03), the `podcast` prop and its shape, and the trailing `<div className="mt-12" aria-hidden="true" />` spacer.
    - The `const transcript = podcast?.deliberationTranscript ?? null` declaration on line ~29 becomes unused after the block removal. Remove that line too (and any now-unused import) so the build has no unused-var lint failure — BUT do NOT remove `deliberationTranscript` from the IssuePodcast type or the GROQ projection (D-17 — those stay; only the render is removed).

    B) apps/web/__tests__/podcast-slot.test.ts — UNCONDITIONAL rewrite of the POD-02 render assertions (they are currently hard, active assertions that the `<details>`/`deliberationTranscript`/label exist; D-10 removes those renders, so these MUST flip to absence checks regardless of prior state — no "if it exists" branching). Make exactly these edits to the source-scan assertions (the `const source = readFileSync(PATH, 'utf-8')` at line 18 stays):
       1. Replace the body of `it('POD-02: references deliberationTranscript', ...)` (line ~39-41) so it asserts ABSENCE: rename it to `it('POD-02 (superseded by D-10): PodcastSlot no longer reads deliberationTranscript', () => { expect(source).not.toContain('deliberationTranscript') })`.
       2. Replace the body of `it('POD-02: uses <details> element for collapsible transcript', ...)` (line ~43-45) so it asserts ABSENCE of both the disclosure and the raw dump: `it('POD-02 (superseded by D-10): no <details>/<pre> transcript render in PodcastSlot', () => { expect(source).not.toContain('<details'); expect(source).not.toContain('<pre') })`.
       3. Replace the body of `it('POD-02: transcript toggle reads "Read full deliberation transcript"', ...)` (line ~62-64) so it asserts ABSENCE: `it('POD-02 (superseded by D-10): transcript toggle label removed', () => { expect(source).not.toContain('Read full deliberation transcript') })`.
       4. ADD a positive assertion that the `<audio>` player survives in the SAME describe block (next to the existing POD-01 audio checks) — if not already covered, add `it('POD-01: <audio> player retained after D-10 transcript removal', () => { expect(source).toContain('<audio') })`. (The existing POD-01 `expect(source).toContain('<audio')` at line ~26 already covers this; if you keep that, this added it() is optional — but the suite MUST contain at least one active assertion that `<audio` IS present.)
       Leave the POD-01 (audio) and POD-03 ("Audio coming soon." with-a-period / no-exclamation) assertions UNCHANGED. Do NOT delete the file. Add a one-line comment at the top of the file noting "POD-02 reader-facing transcript render superseded by Phase 13 D-10; deliberationTranscript data retained for NotebookLM (D-17)."

    C) apps/web/__tests__/deliberation-conversation.test.ts — remove the `.skip` from the `describe.skip('Plan 13-03 conversation render ...')` block created in Plan 01, turning the four render assertions live (del-conversation present, role="log" present, conversation prop present, no dangerouslySetInnerHTML). These now pass because Task 2 of this plan added them.

    D) .planning/ROADMAP.md — in the Phase 13 section, immediately after the `**Requirements**: DEL-CONV-01, ...` line (~line 253), add this supersession note line verbatim:
    ```
    **Supersedes**: POD-02 (Phase 9 — "Issue page renders a collapsible transcript when podcast.deliberationTranscript is populated"). D-10 removes the reader-facing collapsible-transcript render from PodcastSlot.tsx; the `deliberationTranscript` data (Sanity field + GROQ projection) is retained solely for the V2-02 NotebookLM export (DEL-CONV-05). Readers now see the deliberation as the inline chat thread (DEL-CONV-04) instead of the buried `<pre>` blob.
    ```
    This makes the deliberate POD-02 supersession discoverable to a future auditor (the REQUIREMENTS.md POD-02 box stays checked because the underlying data/export still works — only the render moved).
  </action>
  <verify>
    <automated>grep -i "POD-02" .planning/ROADMAP.md | grep -i "supersede" && pnpm --filter web test:unit && pnpm --filter web build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "<pre" apps/web/components/issue/PodcastSlot.tsx` returns 0 (the raw transcript dump is gone)
    - `grep -c "deliberationTranscript" apps/web/components/issue/PodcastSlot.tsx` returns 0 (no longer reads it in render) — while `grep -c "deliberationTranscript" apps/web/lib/sanity/types.ts` is still ≥1 and `grep -c "deliberationTranscript" apps/web/lib/sanity/queries.ts` is still ≥1 (D-17 field/projection retained)
    - `grep -n "<audio" apps/web/components/issue/PodcastSlot.tsx` still returns (POD-01 retained)
    - `grep -n "Audio coming soon." apps/web/components/issue/PodcastSlot.tsx` still returns (POD-03 retained)
    - In apps/web/__tests__/podcast-slot.test.ts: `grep -c "not.toContain('deliberationTranscript')" apps/web/__tests__/podcast-slot.test.ts` returns ≥1, `grep -c "not.toContain('<details')" apps/web/__tests__/podcast-slot.test.ts` returns ≥1, and `grep -c "toContain('<audio')" apps/web/__tests__/podcast-slot.test.ts` returns ≥1 (audio assertion retained); `grep -c "describe.skip\|it.skip" apps/web/__tests__/podcast-slot.test.ts` returns 0 (no conditional/skipped POD-02 assertion left silently passing)
    - `grep -c "describe.skip" apps/web/__tests__/deliberation-conversation.test.ts` returns 0 (Plan-13-03 block un-skipped)
    - `grep -i "POD-02" .planning/ROADMAP.md | grep -ic "supersede"` returns ≥1 (the supersession note is present in the Phase 13 section)
    - `pnpm --filter web test:unit` exits 0 (all web tests green: flipped POD-02 absence assertions, retained POD-01/POD-03, now-live conversation render assertions, never-skipped DEL-04 tripwire)
    - `pnpm --filter web build` exits 0 (no unused-var failure from removed transcript const)
  </acceptance_criteria>
  <done><pre> transcript dump removed from PodcastSlot; podcast-slot.test.ts POD-02 render assertions flipped to unconditional absence checks with the <audio> player still asserted present; ROADMAP.md records the deliberate POD-02 supersession; deliberationTranscript field+projection retained (D-17); Wave 0 conversation render assertions live and green; web suite + build green.</done>
</task>

</tasks>

<verification>
Full-suite gate after this plan (13-VALIDATION.md sampling — run before merging Wave 2 web side):
- `pnpm --filter web test:unit` exits 0 (all Vitest including deliberation-conversation + deliberation-no-model-names tripwire + game-sandbox tripwire + flipped podcast-slot POD-02 absence assertions)
- `pnpm --filter web build` exits 0 (TypeScript + Next.js compile)
- `grep -c "del-conversation" apps/web/app/globals.css` ≥ 4 and `grep -c "del-conversation" apps/web/components/issue/DeliberationSlot.tsx` ≥ 3
- `grep -c "<pre" apps/web/components/issue/PodcastSlot.tsx` == 0
- `grep -i "POD-02" .planning/ROADMAP.md | grep -ic "supersede"` ≥ 1
- Single `<main>` preserved: no new `<main>` introduced in any modified file — `grep -rc "<main" apps/web/components/issue/DeliberationSlot.tsx apps/web/components/issue/PodcastSlot.tsx` == 0
</verification>

<success_criteria>
- Conversation renders as a formatted chat thread inline at the top of #deliberation, visible by default (DEL-CONV-04, success criterion 2)
- No literal Markdown rendered; per-turn attribution; reuses agentChipStyle/getAgentLabel/agents links (DEL-CONV-04, success criterion 2+3)
- conversation flows GROQ -> types -> page prop -> render (DEL-CONV-04, success criterion 3)
- <pre> dump removed; deliberationTranscript field + GROQ retained for NotebookLM (DEL-CONV-05, success criterion 4)
- POD-02's reader-facing transcript render deliberately superseded (D-10) and recorded in ROADMAP.md; podcast-slot.test.ts asserts the removal unconditionally (no silent regression)
- DEL-04 + reduced-motion + WCAG AA + single <main> + ≥44px + 5 Convex subs preserved; build green (DEL-CONV-06, success criterion 6)
</success_criteria>

<output>
After completion, create `.planning/phases/13-deliberation-as-conversation/13-03-SUMMARY.md`
</output>
</output>
