---
phase: 13-deliberation-as-conversation
plan: "03"
subsystem: frontend
tags: [chat-render, deliberation, conversation, podcast, sanity-types, groq, css, accessibility, del-04, pod-02-superseded]
dependency_graph:
  requires:
    - phase: 13-01
      provides: "Wave 0 test scaffold (deliberation-conversation.test.ts describe.skip block)"
    - phase: 13-02
      provides: "Sanity conversation[] written by Chronicler; GROQ §1.2 contract"
  provides:
    - apps/web/lib/sanity/types.ts: "IssueDeliberationTurn type + conversation field on IssueDeliberation"
    - apps/web/lib/sanity/queries.ts: "conversation[] { speaker, text } in QUERY_ISSUE_BY_SLUG"
    - apps/web/app/globals.css: ".del-conversation* class block (vars only)"
    - apps/web/components/issue/DeliberationSlot.tsx: "conversation prop + chat-thread render above <details> machine view"
    - apps/web/app/issue/[slug]/page.tsx: "conversation prop threaded from selectionDeliberation"
    - apps/web/components/issue/PodcastSlot.tsx: "<pre>{transcript}</pre> block removed; audio + empty state retained"
    - apps/web/__tests__/podcast-slot.test.ts: "POD-02 absence checks + POD-01 audio assertion"
    - apps/web/__tests__/deliberation-conversation.test.ts: "Plan 13-03 block un-skipped and green"
    - .planning/ROADMAP.md: "Phase 13 Supersedes note for POD-02"
  affects:
    - Issue page readers: conversation renders as inline chat thread (DEL-CONV-04)
    - PodcastSlot: <pre> dump gone; audio player + empty state preserved
tech_stack:
  added: []
  patterns:
    - "IssueDeliberationTurn hand-written type against GROQ projection (Phase 2 pattern)"
    - "conversation[] { speaker, text } GROQ array projection"
    - ".del-conversation* CSS block following .del-flow naming convention (CSS vars only)"
    - "Additive conversation prop to existing Props type (no breaking change)"
    - "Reuse getAgentLabel + agentChipStyle helpers — no new speaker→color mapping"
    - "turn.text as plain {turn.text} — no dangerouslySetInnerHTML, no Markdown parser"
    - "role=log + aria-label on thread container (ARIA for sequential conversation)"
    - "POD-02 supersession pattern: absence-check flip in source-scan tests"
key_files:
  created: []
  modified:
    - apps/web/lib/sanity/types.ts
    - apps/web/lib/sanity/queries.ts
    - apps/web/app/globals.css
    - apps/web/components/issue/DeliberationSlot.tsx
    - apps/web/app/issue/[slug]/page.tsx
    - apps/web/components/issue/PodcastSlot.tsx
    - apps/web/__tests__/podcast-slot.test.ts
    - apps/web/__tests__/deliberation-conversation.test.ts
    - .planning/ROADMAP.md
decisions:
  - "PodcastSlot.tsx docstring stripped of deliberationTranscript and <pre> string literals to pass source-scan tests (comments would have caused false positives)"
  - "Tailwind leading-[1.5] retained (not canonicalized to leading-normal) to match existing codebase convention throughout DeliberationSlot"
metrics:
  duration: "14 min"
  completed_date: "2026-05-24"
  tasks: 3
  files: 9
---

# Phase 13 Plan 03: Chat Render Summary

**Frontend consumer for the Chronicler: structured dialogue turns rendered as a formatted chat thread at the top of #deliberation, and the raw `<pre>` transcript dump removed from PodcastSlot.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-24T16:40:38Z
- **Completed:** 2026-05-24T16:54:20Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

**Task 1 — Types + GROQ + CSS (commit a3e2fda)**

- `types.ts`: `IssueDeliberationTurn` type added; `conversation: IssueDeliberationTurn[] | null` added to `IssueDeliberation`. `IssuePodcast.deliberationTranscript` untouched (D-17).
- `queries.ts`: `conversation[] { speaker, text }` inserted after `runnerUpNotes,` in `QUERY_ISSUE_BY_SLUG` `selectionDeliberation` block. `deliberationTranscript` projection untouched (D-17).
- `globals.css`: `.del-conversation*` CSS block appended behind Phase 13 section banner — 5 class rules, all colors via CSS vars, no hardcoded hex.

**Task 2 — Chat thread render + page prop (commit d8115d2)**

- `DeliberationSlot.tsx`: `IssueDeliberationTurn` type imported; `Props` extended with `conversation`; chat-thread block inserted BEFORE the `<details>` machine view. Uses `getAgentLabel` + `agentChipStyle` (reused, not duplicated). `turn.text` rendered as plain `{turn.text}`. `role="log"` + `aria-label="Deliberation conversation"` on thread container. `/agents/${turn.speaker}` chip link (DEL-06). No model names anywhere. All 5 Convex subscriptions, AGENT_LABELS, confidence count-up, and `prefersReducedMotion` module-scope check untouched.
- `page.tsx`: `conversation={issue.selectionDeliberation?.conversation ?? null}` threaded to `<DeliberationSlot>`.

**Task 3 — PodcastSlot cleanup + test flips + ROADMAP (commit 386376b)**

- `PodcastSlot.tsx`: `{transcript && (<details>...</details>)}` block removed (D-10). `const transcript = ...` declaration removed. Docstring references to `deliberationTranscript` and `<pre>` stripped to avoid source-scan false positives. Audio player, description, empty state, and `podcast` prop unchanged.
- `podcast-slot.test.ts`: POD-02 render assertions flipped to unconditional absence checks (`not.toContain('deliberationTranscript')`, `not.toContain('<details')`, `not.toContain('<pre')`, `not.toContain('Read full deliberation transcript')`). POD-01 `<audio>` assertion retained.
- `deliberation-conversation.test.ts`: `describe.skip` removed — 4 render assertions now live and green.
- `ROADMAP.md`: Phase 13 **Supersedes** note added (POD-02 superseded by D-10; data retained for D-17 NotebookLM export).

## Test Results

- `deliberation-conversation.test.ts` — 6/6 (4 previously-skipped render assertions now live and green)
- `podcast-slot.test.ts` — 9/9 (POD-02 absence assertions + POD-01 audio + POD-03 empty state)
- `deliberation-no-model-names.test.ts` — 3/3 (DEL-04 tripwire)
- Full suite: 180 passed / 29 failed (the 29 are pre-existing Phase 8 Wave 0 sentinels — CMR-05/06/07/08 etc. for Stripe webhook and legal pages not yet implemented; unrelated to this plan)
- `pnpm --filter web build` — exits 0

## Deviations from Plan

**[Rule 1 - Bug] Stripped deliberationTranscript + `<pre>` string literals from PodcastSlot.tsx docstring**

- **Found during:** Task 3
- **Issue:** The plan specified removing the render block. After removal, the strings `deliberationTranscript` and `<pre>` still appeared in the docstring comments explaining the removal. The source-scan test `expect(source).not.toContain('deliberationTranscript')` scans the raw file including comments, so both assertions would have failed.
- **Fix:** Rewrote the two docstring lines to use `"transcript data field"` and `"collapsible-disclosure render"` instead.
- **Files modified:** `apps/web/components/issue/PodcastSlot.tsx`
- **Commit:** included in 386376b

## Known Stubs

None. The conversation render reads from Sanity GROQ and renders when `conversation && conversation.length > 0`. When null/empty (old issues), renders nothing — the `<details>` machine view is the fallback (per UI-SPEC empty state contract).

## Self-Check: PASSED

Files modified:
- `apps/web/lib/sanity/types.ts` — FOUND (IssueDeliberationTurn at line 108, conversation field at line 117)
- `apps/web/lib/sanity/queries.ts` — FOUND (conversation[] { speaker, text } at line 93)
- `apps/web/app/globals.css` — FOUND (.del-conversation at end of file, 5 class rules)
- `apps/web/components/issue/DeliberationSlot.tsx` — FOUND (chat-thread block, role=log, conversation prop)
- `apps/web/app/issue/[slug]/page.tsx` — FOUND (conversation prop at line 245)
- `apps/web/components/issue/PodcastSlot.tsx` — FOUND (<pre removed, deliberationTranscript absent from source)
- `apps/web/__tests__/podcast-slot.test.ts` — FOUND (absence assertions present)
- `apps/web/__tests__/deliberation-conversation.test.ts` — FOUND (describe.skip removed)
- `.planning/ROADMAP.md` — FOUND (Supersedes line in Phase 13 section)

Commits:
- `a3e2fda` — feat(13-03): extend types + GROQ + globals.css for conversation thread — FOUND
- `d8115d2` — feat(13-03): render chat thread in DeliberationSlot + thread prop from page.tsx — FOUND
- `386376b` — feat(13-03): remove <pre> transcript + flip POD-02 tests + record supersession + un-skip render assertions — FOUND
