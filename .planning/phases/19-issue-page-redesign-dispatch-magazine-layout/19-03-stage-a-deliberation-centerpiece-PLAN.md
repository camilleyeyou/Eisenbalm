---
phase: 19-issue-page-redesign-dispatch-magazine-layout
plan: 03
type: execute
wave: 2
depends_on: [19-01]
files_modified:
  - apps/web/components/issue/DeliberationSlot.tsx
  - apps/web/components/issue/DelibScoreboard.tsx
  - apps/web/components/issue/DelibChat.tsx
  - apps/web/components/issue/ConfidenceBar.tsx
  - apps/web/app/globals.css
  - apps/web/__tests__/issue-page-dispatch.test.ts
autonomous: true
requirements: [P19-01, P19-04, P19-07, DEL-01, DEL-02, DEL-03, DEL-04, DEL-05]
must_haves:
  truths:
    - "DeliberationSlot renders the dark-band centerpiece: animated candidate scoreboard + chat-style transcript + confidence bar"
    - "The 5 Convex useQuery subscriptions (DEL-01..05) are preserved in the rewrite"
    - "No model names appear anywhere in the deliberation (DEL-04) — only The Scout / The Advocate / The Editor"
    - "Chat messages stagger-reveal via framer-motion; reduced-motion shows all messages immediately"
    - "Chat region has role=log + aria-live=polite"
    - "Empty state renders gracefully when no runId / no data (DEL-05)"
  artifacts:
    - path: "apps/web/components/issue/DeliberationSlot.tsx"
      provides: "'use client' dark-band centerpiece; 5 Convex subs preserved; scoreboard + chat + confidence"
      contains: "useQuery"
    - path: "apps/web/components/issue/DelibChat.tsx"
      provides: "framer-motion staggered message reveal, role=log aria-live=polite, reduced-motion safe"
      contains: "aria-live"
    - path: "apps/web/components/issue/ConfidenceBar.tsx"
      provides: "CSS-transition confidence bar fill to target value"
      contains: "width"
  key_links:
    - from: "apps/web/components/issue/DeliberationSlot.tsx"
      to: "convex api (pipelineRuns/pitchLog/deliberationEvents/agentVotes/qaCorrections).byRunId"
      via: "useQuery with runId-or-skip guard"
      pattern: "useQuery"
    - from: "apps/web/components/issue/DeliberationSlot.tsx"
      to: "DelibChat / DelibScoreboard / ConfidenceBar"
      via: "conversation + candidates props"
      pattern: "DelibChat"
---

<objective>
Fully rewrite DeliberationSlot into the dark-band centerpiece from the prototype: a candidate scoreboard (left), a chat-style transcript with framer-motion staggered reveal (right), and a confidence bar that fills after the last message. Build the three sub-components (DelibScoreboard, DelibChat, ConfidenceBar). This is Stage A — driven by MOCK data passed from page.tsx — but the 5 Convex `useQuery` subscriptions (DEL-01..05) MUST be preserved in the component so Stage B (Plan 05) wires real data with no structural change. DEL-04 (no model names) is non-negotiable.

Purpose: The deliberation is the prototype's visual centerpiece and the most complex section. Isolating it in its own plan keeps Plan 02 within context budget and lets the dark-band-only inline color constants live in one place.
Output: DeliberationSlot rewrite + 3 sub-components + globals.css dark-band classes + activated tripwires.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
Current DeliberationSlot (apps/web/components/issue/DeliberationSlot.tsx) — PRESERVE the 5 subscriptions verbatim:
```ts
'use client'
import { useQuery } from 'convex/react'
const run         = useQuery(api.pipelineRuns.byRunId,       runId ? { runId } : 'skip')
const pitchLog    = useQuery(api.pitchLog.byRunId,           runId ? { runId } : 'skip')
const events      = useQuery(api.deliberationEvents.byRunId, runId ? { runId } : 'skip')
const votes       = useQuery(api.agentVotes.byRunId,         runId ? { runId } : 'skip')
const corrections = useQuery(api.qaCorrections.byRunId,      runId ? { runId } : 'skip')
```
Props today: `{ runId: string | null; conversation: IssueDeliberationTurn[] | null }`. Phase 19 ADDS a `candidates` prop for the scoreboard (from `issue.selectionDeliberation.candidates`). Final props: `{ runId, conversation, candidates, confidence? }`.

Deliberation data shape (API_CONTRACTS §1.2 lines 119-129):
- `selectionDeliberation.candidates[] { charity->{name, slug, location}, scoutSummary, advocateArgument, advocateScore }`
- `selectionDeliberation.conversation[] { speaker, text }` — speaker ∈ "scout"|"advocate"|"editor"
- `editorDecision`, `runnerUpNotes`
- No numeric confidence field projected — default to 80 (Stage A) / array heuristic (Stage B).

Dark-band INLINE color constants (UI-SPEC lines 146-162 — these are NOT new CSS vars; inline in this component only):
- card bg #241F1A, card border #38322A, accent-on-dark #E0B0A4, muted #B8B2A4, note #9A9384, tertiary #8A8273, chat body #CFC9BB (distinct from --rule-strong #CFC9B8 — do NOT correct), editor msg #E8E3D6, location #7A7264, band bg #1A1714.

framer-motion stagger pattern: RESEARCH lines 510-551 (containerVariants staggerChildren 0.26, messageVariants opacity 0 y14 → opacity1 y0 over 0.5s; reduced-motion → initial={false}, no per-message variants).
Avatar colors: Scout #5E7359 "S", Advocate #3D6285 "A", Editor var(--color-accent) "E".
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: DelibScoreboard + ConfidenceBar sub-components + globals.css dark-band classes</name>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (current — reference the conversation chip render to retire)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§10 Deliberation lines 519-571: Left Candidate Scoreboard, Verdict box, confidence bar)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md (Don't Hand-Roll: confidence bar = CSS transition, not framer-motion, line 415-417)
  </read_first>
  <action>
    1. CREATE `DelibScoreboard.tsx` (can be RSC or a plain client child — no motion needed). Props `{ candidates: Array<{ name:string, location:string, score:number|null, note:string, winning:boolean, runnerUp?:boolean }> }`. Flex column gap 12px. Each card: bg #241F1A, border 1px solid #38322A, padding 18px 20px. Winning card `.win`: border-color var(--color-accent), bg `linear-gradient(135deg, rgba(154,51,36,.18), #241F1A)`, left stripe 3px solid var(--color-accent). Name Fraunces 19px #FBFAF6. Score Fraunces 30px weight 500 — non-winner #5A544A, winner #E0B0A4. Location IBM Plex Mono 9px uppercase #7A7264. Note Newsreader 13px italic #9A9384. Winner badge `.w` (bg var(--color-accent) color #fff IBM Plex Mono 9px uppercase padding 4px 9px); runner-up badge `.r` (border #443E35 color #8A8273).
    2. CREATE `ConfidenceBar.tsx` ('use client' — needs useState/useEffect + reduced-motion). Props `{ value:number; trigger:boolean }`. Track height 3px bg #38322A; fill bg var(--color-accent) `transition: width 1.6s cubic-bezier(.16,1,.3,1)`. Fill width animates 0→`value`% when `trigger` becomes true (200ms after last message). Under prefers-reduced-motion (useReducedMotion) render at full `value`% immediately, no transition. Verdict-box wrapper: margin-top 24px padding 20px 22px bg #241F1A border 1px solid var(--color-accent); row = IBM Plex Mono 10px uppercase #8A8273 label + Fraunces 18px #E0B0A4 value.
    3. ADD globals.css dark-band classes per UI-SPEC: `.delib` (bg #1A1714 color #FBFAF6 padding 96px 32px border-bottom 1px solid var(--color-line)), `.delib-in` (max-width 1180px), `.delib-grid` (1fr 1.4fr gap 56px → 1-col below 980px), candidate `.cand`/`.win`/`.w`/`.r`, chat `.msg`/`.avatar`/`.msg-who`, verdict box. Add `[data-deliberation-slot]` to the print hide list if not already present.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/components/issue/DelibScoreboard.tsx` and `ConfidenceBar.tsx` exist
    - `head -1 apps/web/components/issue/ConfidenceBar.tsx` equals `'use client'`
    - `grep -c "width 1.6s cubic-bezier" apps/web/components/issue/ConfidenceBar.tsx` returns 1
    - `grep -c "useReducedMotion" apps/web/components/issue/ConfidenceBar.tsx` returns 1
    - `grep -c "#241F1A\|#38322A" apps/web/components/issue/DelibScoreboard.tsx` returns 1 or more
    - `grep -c "\.delib\b\|delib-grid" apps/web/app/globals.css` returns 1 or more
    - `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>Scoreboard + ConfidenceBar built with dark-band inline constants; globals.css carries .delib band classes; confidence bar reduced-motion safe.</done>
</task>

<task type="auto">
  <name>Task 2: DelibChat staggered message reveal (framer-motion, role=log, DEL-04)</name>
  <read_first>
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md (Deliberation Message Stagger lines 510-551)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§10 Right Chat Transcript lines 544-557, §Accessibility ARIA line 721)
    - apps/web/__tests__/deliberation-no-model-names.test.ts (DEL-04 tripwire that must stay green)
  </read_first>
  <action>
    CREATE `DelibChat.tsx` ('use client'). Props `{ messages: Array<{ speaker:'scout'|'advocate'|'editor', text:string }>, onComplete?: ()=>void }`.
    - Use the RESEARCH stagger pattern: `containerVariants { hidden:{}, visible:{ transition:{ staggerChildren:0.26 } } }`, `messageVariants { hidden:{opacity:0,y:14}, visible:{opacity:1,y:0,transition:{duration:0.5}} }`. `useInView(ref,{once:true,amount:0.2})` + `useReducedMotion()`.
    - Container `motion.div` with `role="log"` `aria-live="polite"`, `initial={prefersReducedMotion ? false : 'hidden'}`, `animate={isInView||prefersReducedMotion ? 'visible' : 'hidden'}`.
    - Each message `motion.div` with `variants={prefersReducedMotion ? undefined : messageVariants}`. Avatar 30px circle IBM Plex Mono 12px weight 500: scout→#5E7359 "S", advocate→#3D6285 "A", editor→var(--color-accent) "E". Who label IBM Plex Mono 10px uppercase #8A8273 with `<b>` agent NAME ("The Scout"/"The Advocate"/"The Editor" — DEL-04: NEVER model names) color #FBFAF6 weight 500. Message text Newsreader 15.5px weight 300 #CFC9BB line-height 1.6; editor messages #E8E3D6.
    - Call `onComplete()` after the last message reveal (≈ messages.length * 260ms + 500ms; or immediately under reduced-motion) so the parent triggers ConfidenceBar fill 200ms later.
    - Map `speaker` → display name with a const map: `{ scout:'The Scout', advocate:'The Advocate', editor:'The Editor' }`. Do NOT interpolate any model/provider string.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `head -1 apps/web/components/issue/DelibChat.tsx` equals `'use client'`
    - `grep -c 'role="log"' apps/web/components/issue/DelibChat.tsx` returns 1
    - `grep -c 'aria-live="polite"' apps/web/components/issue/DelibChat.tsx` returns 1
    - `grep -c "The Scout\|The Advocate\|The Editor" apps/web/components/issue/DelibChat.tsx` returns 1 or more
    - `grep -ci "claude\|gpt\|openai\|anthropic\|sonnet\|haiku\|opus\|model" apps/web/components/issue/DelibChat.tsx` returns 0
    - `grep -c "staggerChildren\|useReducedMotion" apps/web/components/issue/DelibChat.tsx` returns 1 or more
    - `pnpm --filter web test:unit` exits 0 (deliberation-no-model-names green)
  </acceptance_criteria>
  <done>DelibChat staggers messages via framer-motion, reduced-motion shows all immediately, role=log/aria-live set, DEL-04 enforced.</done>
</task>

<task type="auto">
  <name>Task 3: Rewrite DeliberationSlot dark-band centerpiece; preserve 5 Convex subs; wire into page.tsx; activate tripwires</name>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (FULL FILE — copy the 5 useQuery lines verbatim)
    - apps/web/app/issue/[slug]/page.tsx (the delib placeholder stub from Plan 02 Task 4 — replace it)
    - apps/web/__tests__/deliberation-subscriptions.test.ts (DEL-01..05 tripwire that must stay green)
    - apps/web/__tests__/issue-page-dispatch.test.ts (the it.todo placeholders authored in Plan 01 Task 4)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§10 full lines 519-571, §Copywriting delib head lines 689-690)
  </read_first>
  <action>
    1. Rewrite `DeliberationSlot.tsx` ('use client') as the dark band. PRESERVE the 5 `useQuery(...)` subscription lines verbatim (DEL-01..05) — they remain even though Stage A renders from props; they feed the live data in Stage B and the empty-state logic. New props: `{ runId: string|null, conversation: Array<{speaker,text}>|null, candidates: Array<{name,location,score,note,winning,runnerUp?}>|null, confidence?: number }`.
    - Section: `<section id="delib" data-deliberation-slot className="delib">` with `.delib-in` wrapper. Header centered max-width 680px: section label centered color #E0B0A4; h2 Fraunces clamp(32px,4.5vw,56px) weight 400 #FBFAF6 with `<em>` #E0B0A4 — copy "Watch the Machines <em>Decide</em>"; sub Fraunces 21px italic #B8B2A4 "Three charities were proposed. One was chosen. Here is the full audit." (verbatim from §Copywriting).
    - `.delib-grid`: left `<DelibScoreboard candidates={...} />`, right `<DelibChat messages={conversation} onComplete={()=>setConfTrigger(true)} />` + `<ConfidenceBar value={confidence ?? 80} trigger={confTrigger} />`.
    - Empty state (DEL-05): when `runId` is null AND no candidates/conversation, render a graceful empty message inside the dark band (not an error/broken UI). Keep the existing empty-state detection logic shape.
    2. In page.tsx, REPLACE the delib placeholder stub (`<section id="delib" .../>` from Plan 02) with `<DeliberationSlot runId={MOCK_ISSUE.runId ?? null} conversation={MOCK_ISSUE.selectionDeliberation.conversation} candidates={MOCK_ISSUE.selectionDeliberation.candidates.map(...)} />`. Import DeliberationSlot.
    3. ACTIVATE the relevant `it.todo` tripwires in issue-page-dispatch.test.ts authored in Plan 01: the framer-motion-in-motion-components check (assert DelibChat/ScrollReveal/StatCountUp contain `useReducedMotion`) and the DelibChat role=log/aria-live check. Convert them from `it.todo` to real `it(...)` assertions now that the components exist. Do NOT activate the `DESIGNAGENT_SUPPRESSED`-off check — that is Plan 05's (layout.tsx not yet changed).
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit 2>&1 | tail -12 && pnpm build 2>&1 | tail -6</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "useQuery" apps/web/components/issue/DeliberationSlot.tsx` returns 5
    - `grep -c "byRunId" apps/web/components/issue/DeliberationSlot.tsx` returns 5
    - `grep -c "DelibScoreboard\|DelibChat\|ConfidenceBar" apps/web/components/issue/DeliberationSlot.tsx` returns 3 or more
    - `grep -c "Watch the Machines" apps/web/components/issue/DeliberationSlot.tsx` returns 1
    - `grep -ci "claude\|gpt\|openai\|anthropic\|sonnet\|haiku\|opus" apps/web/components/issue/DeliberationSlot.tsx` returns 0
    - `grep -c "DeliberationSlot" apps/web/app/issue/[slug]/page.tsx` returns 1 or more
    - `grep -c "it.todo" apps/web/__tests__/issue-page-dispatch.test.ts` returns 1 or less (only the suppression-off todo may remain for Plan 05)
    - `pnpm --filter web test:unit` exits 0 (deliberation-subscriptions + no-model-names green)
    - `pnpm --filter web build` exits 0
  </acceptance_criteria>
  <done>DeliberationSlot rewritten as dark-band centerpiece with 5 subs preserved + scoreboard/chat/confidence; wired into page.tsx with MOCK data; motion/a11y tripwires activated; build clean.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` exits 0 (deliberation-subscriptions, no-model-names, agent-cards green)
- `pnpm --filter web build` exits 0
- 5 Convex subscriptions present in DeliberationSlot
- Zero model-name strings in deliberation components
</verification>

<success_criteria>
- Dark-band deliberation centerpiece with scoreboard + chat + confidence (P19-01, DEL-02)
- 5 Convex subscriptions preserved (DEL-01..05)
- No model names (DEL-04)
- Staggered reveal reduced-motion safe (P19-04)
- Graceful empty state (DEL-05)
</success_criteria>

<output>
After completion, create `.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-03-SUMMARY.md`
</output>
