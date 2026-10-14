---
phase: quick-261014-lbr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/storyFindingActions.ts
  - apps/dispatch-control/__tests__/storyFindingActions.test.ts
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFindingsRail.tsx
  - apps/dispatch-control/__tests__/StoryFindingsRail.test.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
autonomous: true
requirements: [QUICK-261014-lbr]

must_haves:
  truths:
    - "Clicking the primary action on any findings-rail card always does something visible: it scrolls to the in-prose mark when one exists, otherwise it opens the story editor"
    - "On the Game story (and Theme, and non-spec-ad Bonus) every card's primary button reads 'Fix it in the editor →', never 'Jump to it →'"
    - "When the editor opens from a finding, the field containing the quoted text (e.g. the game Embed code textarea) is scrolled to, focused, and the quoted text is selected"
    - "Two findings quoting the same passage in the same story render as ONE card: quote once, highest-severity chip, each distinct reason as a bullet"
    - "A card whose findings carry a suggested fix (on an annotatable prose story) shows 'Apply fix', which resolves every finding in the card through the same acceptFinding helper AnnotationMark uses"
    - "'Dismiss' on a card asks for a one-line reason and dismisses every finding in the card via dismissFinding"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/storyFindingActions.ts"
      provides: "groupFindingRows, jumpToFinding, focusFieldContainingQuote, applyFixToGroup, dismissGroup"
      exports: ["groupFindingRows", "jumpToFinding", "focusFieldContainingQuote", "applyFixToGroup", "dismissGroup", "SUPERSEDED_REASON"]
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFindingsRail.tsx"
      provides: "Grouped cards with Apply fix / Fix it in the editor / Jump to it / Dismiss"
    - path: "apps/dispatch-control/__tests__/storyFindingActions.test.ts"
      provides: "grouping, jump fallback, accept loop, editor focus tests"
  key_links:
    - from: "storyFindingActions.ts applyFixToGroup"
      to: "@/lib/findingsClient acceptFinding"
      via: "sequential loop threading res.revisionId (same pattern as s/[section]/page.tsx acceptGroup)"
      pattern: "acceptFinding\\("
    - from: "StoryFocusView handleJump"
      to: "handleFixInEditor"
      via: "jumpToFinding(findingId, handleFixInEditor) fallback when no #finding-{id} element"
      pattern: "jumpToFinding"
    - from: "ReviewDeskRunView editFinding"
      to: "SectionEditorPanel focusQuote"
      via: "rawFindings.find(...).quotedSpan threaded through StoryFocusView"
      pattern: "focusQuote"
---

<objective>
Make must-fix findings on the review-desk story Draft tab actually fixable by a non-technical editor.

Observed failure (GAME story "The Filtration Layer"): the rail lists two MUST FIX cards quoting the same span
"operating in that watershed since 2009"; "Jump to it →" silently does nothing because the game text lives in
`game.embedCode` inside a sandboxed iframe (GalleryGameSlot) — there is no `#finding-{id}` mark to scroll to.
There is also no direct fix action on the card.

Purpose: every card gets a live, plain-language action; duplicates collapse; one-click fix where the existing
accept path supports it; the editor fallback lands the editor ON the offending field.
Output: a pure helper module + tests, a regrouped rail, jump fallback + editor field focus wiring.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFindingsRail.tsx
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx
@apps/dispatch-control/__tests__/StoryFindingsRail.test.tsx
@apps/dispatch-control/components/galley/AnnotationMark.tsx
@apps/dispatch-control/lib/findingsClient.ts

<facts_established_during_planning>
- Package name: `dispatch-control` (`apps/dispatch-control/package.json`; scripts `test` = `vitest run`, `build` = `next build`).
- Accept/dismiss helper AnnotationMark uses: `acceptFinding` / `dismissFinding` / `FindingsError` from `@/lib/findingsClient`. These are THE helpers — import them, do not add a fetch path or endpoint.
- Server accept (`packages/pipeline/src/eisenbalm_pipeline/api/findings.py`) raises 409 `accept_unavailable` for `game` (no block body), for `bonus` unless `bonusType === 'specAd'`, and when the finding has no `suggestedFix`/`quotedSpan`. So "Apply fix" must NOT be offered on game / theme / non-specAd bonus — the editor fallback covers them (do not invent a structured-field accept).
- After accepting one finding, a sibling finding quoting the SAME span will 409 `span_not_resolved` (the text was replaced). Sequential accepts MUST thread the fresh `res.revisionId` (pattern: `acceptGroup` in `apps/dispatch-control/app/(editorial)/s/[section]/page.tsx` lines ~408-428) — never parallel, never reuse a stale revision.
- Game findings are always in `unresolved` (ReviewDeskRunView resolves against `draft.sections['game']?.blocks`, which is empty), but they DO carry `quotedSpan`, so today's rail shows "Jump to it" and `handleJump`'s `getElementById` returns null → silent no-op.
- Editor deep link already exists: `handleFixInEditor(id)` → `onEditSection(sectionId, id)` → ReviewDeskRunView `handleEditSection` sets `editFinding` + `editing=true` → `SectionEditorPanel` gets `focusFindingId`/`findingReason` but does NOTHING to locate the span. GameEditor (StructuredFieldEditor.tsx) renders plain `<input type="text">` headline/description + `<textarea>` embedCode; BlockEditor uses `<textarea>`s. A DOM-generic "find the field whose value contains the quote" works for all editors without touching each one.
- Counts: the Draft-tab badge, meta line "N open", Stories picker and nextNeedsYou all read `chipCounts[...]` from `tallyForSection` (one counts source, Phase 51 D-25, shared with StoryDeskGrid). Changing it to distinct-issue counting is invasive — DO NOT change it. The rail header shows the CARD count and, when grouping collapsed anything, a "from N findings" suffix so the mismatch with the tab badge is explained, not hidden. Record this in the SUMMARY.
</facts_established_during_planning>

<interfaces>
From `@/lib/findingsClient`:
```ts
export class FindingsError extends Error { status: number; reason: string }
export interface AcceptFindingResult { revisionId: string; findingId: string; resolution: 'accepted' }
export async function acceptFinding(runId: string, findingId: string,
  payload: { ifRevisionID: string; suggestedFixOverride?: string }, token: string | null): Promise<AcceptFindingResult>
export async function dismissFinding(runId: string, findingId: string,
  payload: { reason: string }, token: string | null): Promise<{ findingId: string; resolution: 'dismissed' }>
```
From `@/lib/galley/spanResolver`:
```ts
export interface ResolvedAnnotation { findingId; sectionId; blockIndex; start; end; severity: 'info'|'warning'|'error'; axis?; reason; suggestedFix?; quotedSpan: string }
export interface UnresolvedFinding { findingId; sectionId; severity; axis?; reason; suggestedFix?; quotedSpan? }
```
StoryFindingsRail today: props `{ resolved, unresolved: ReadonlyArray<StoryFindingsRailUnresolvedFinding>, onJump(id), onFixInEditor(id), onNextStoryWithFindings? }`; `severityChip(row)` maps error→"Must fix", VOICE_AXES→"Voice", else "Review". Card styling: hard edges, `border-[color:var(--color-faint)]`, mono 8.5–9.5px chips, cobalt text links, `min-h-[44px]` buttons.
StoryFocusView: `useAuth` is NOT imported yet; AnnotationMark gets the token via `const { getToken } = useAuth()` from `@clerk/nextjs` — do the same.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure helper module storyFindingActions.ts (grouping, jump fallback, editor focus, group accept/dismiss)</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/storyFindingActions.ts, apps/dispatch-control/__tests__/storyFindingActions.test.ts</files>
  <behavior>
    - groupFindingRows: two rows (one resolved, one unresolved, or both unresolved) in section 'game' with quotedSpan "operating in that watershed since 2009" and "  Operating in that  watershed since 2009 " (case/whitespace/curly-quote differences) → ONE group, findingIds length 2, reasons length 2, severity = max.
    - groupFindingRows: identical normalized reason text across members appears once in `reasons`.
    - groupFindingRows: same quote in DIFFERENT sectionIds → two groups; rows with no quotedSpan → each its own group (never merged).
    - groupFindingRows: severity ranking error > warning > info; chip axis = axis of the highest-severity member; `anchoredFindingId` = first member that came from `resolved` (undefined if none); `suggestedFix` = first member's non-empty suggestedFix; groups ordered by first appearance.
    - jumpToFinding('f1', fallback) with a `<mark id="finding-f1">` in document → calls el.click(), returns true, fallback NOT called. With no such element → fallback('f1') called, returns false.
    - focusFieldContainingQuote(container, quote): container with an `<input value="Headline">` and a `<textarea>` whose value contains the quote (different case) → textarea is document.activeElement, selectionStart/End bracket the match, returns true. No match → returns false, nothing focused.
    - applyFixToGroup (vi.mock '@/lib/findingsClient'): 2 members both with suggestedFix; accept #1 resolves {revisionId:'rev-2'}; accept #2 resolves {revisionId:'rev-3'} → acceptFinding called twice, 2nd call's payload.ifRevisionID === 'rev-2'; result {applied:2, superseded:0, failed:[]}.
    - applyFixToGroup: accept #2 rejects FindingsError(409,'span_not_resolved') after #1 succeeded → dismissFinding called for member #2 with { reason: SUPERSEDED_REASON }; result superseded 1, failed [].
    - applyFixToGroup: member without suggestedFix is NOT passed to acceptFinding; it is dismissed with SUPERSEDED_REASON only if applied > 0, else it lands in `failed`.
    - applyFixToGroup: first accept rejects 'revision_mismatch' → loop stops, all remaining ids in failed, result.note mentions the draft changed.
    - dismissGroup: calls dismissFinding once per id with the given trimmed reason; returns ids that threw.
  </behavior>
  <action>
Create `storyFindingActions.ts` (plain TS module, no 'use client', no React) beside StoryFindingsRail. Header comment: quick 261014-lbr purpose (make findings fixable; reuses AnnotationMark's exact helpers; no new API).

Exports:
1. `export interface FindingRowInput { findingId: string; sectionId?: string; severity: 'info'|'warning'|'error'; axis?: string; reason: string; suggestedFix?: string; quotedSpan?: string }`
2. `export interface FindingGroup { key: string; findingIds: string[]; severity; axis?: string; quotedSpan?: string; reasons: string[]; suggestedFix?: string; anchoredFindingId?: string; members: Array<{ findingId: string; suggestedFix?: string }> }`
3. `export function normalizeQuote(s: string): string` — trim, strip leading/trailing straight or curly quotes (`"'“”‘’`), collapse whitespace to single spaces, lowercase.
4. `export function groupFindingRows(resolved: ReadonlyArray<FindingRowInput>, unresolved: ReadonlyArray<FindingRowInput>): FindingGroup[]` — iterate resolved then unresolved; key = `${sectionId ?? ''}::${normalizeQuote(quotedSpan)}` when quotedSpan non-empty after normalization, else `solo::${findingId}`. Member order inside a group: error first, then warning, then info (stable), so `findingIds[0]` is the most severe. `members` keeps that order. Mark `anchoredFindingId` from the first member that came from the `resolved` array.
5. `export function jumpToFinding(findingId: string, fallback: (id: string) => void, doc: Document = document): boolean` — `doc.getElementById(\`finding-${findingId}\`)`; if found: `el.scrollIntoView?.({ behavior: 'smooth', block: 'center' })` (optional-call — jsdom lacks it), `(el as HTMLElement).click()`, return true. Else `fallback(findingId)`, return false. NEVER a silent no-op.
6. `export function focusFieldContainingQuote(container: ParentNode, quote: string): boolean` — query `textarea, input[type="text"], input:not([type])`; for each, `idx = el.value.toLowerCase().indexOf(quote.trim().toLowerCase())`; first hit: `el.scrollIntoView?.({ block: 'center' })`, `el.focus()`, `el.setSelectionRange(idx, idx + quote.trim().length)`, return true. If no exact hit, retry with whitespace-collapsed comparison and on hit focus + scroll without selection. Return false if nothing matches.
7. `export const SUPERSEDED_REASON = 'Resolved: this passage was rewritten by another accepted fix on the same card.'`
8. `export interface ApplyGroupResult { applied: number; superseded: number; failed: string[]; note: string | null }`
   `export async function applyFixToGroup(args: { runId: string; revisionId: string; members: FindingGroup['members']; getToken: () => Promise<string | null> }): Promise<ApplyGroupResult>` — import `acceptFinding, dismissFinding, FindingsError` from `@/lib/findingsClient` (THE helpers AnnotationMark uses — no new fetch). Sequential loop over members WITH a suggestedFix: `const res = await acceptFinding(runId, id, { ifRevisionID: current }, await getToken()); current = res.revisionId; applied++`. On `FindingsError` reason `span_not_resolved` or `accept_unavailable` when `applied > 0` → push to `toSupersede`. On `revision_mismatch` → push this and every remaining member id to `failed`, set note `'The draft changed while applying — reload and try again.'`, break. Any other error → `failed.push(id)` and continue (mirrors acceptGroup D-13). After the loop, members WITHOUT a suggestedFix go to `toSupersede` if `applied > 0`, else `failed`. Then for each `toSupersede` id: `await dismissFinding(runId, id, { reason: SUPERSEDED_REASON }, await getToken())` (on throw → failed). Note when failed non-empty and none set: `` `${applied + superseded} of ${members.length} resolved — ${failed.length} still need you. Use “Fix it in the editor”.` ``. Do NOT reload the draft here — the caller does.
9. `export async function dismissGroup(runId: string, findingIds: string[], reason: string, getToken: () => Promise<string | null>): Promise<string[]>` — sequential `dismissFinding(runId, id, { reason: reason.trim() }, await getToken())`, returns ids that threw.

Write `__tests__/storyFindingActions.test.ts` first (RED) covering every <behavior> bullet; `vi.mock('@/lib/findingsClient', async (orig) => ({ ...(await orig()), acceptFinding: vi.fn(), dismissFinding: vi.fn() }))` so the real `FindingsError` class is kept. Use the jsdom environment (add `// @vitest-environment jsdom` at top since the file is `.ts`, not `.tsx`). Then implement (GREEN).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/storyFindingActions.test.ts</automated>
  </verify>
  <done>All storyFindingActions tests pass; module imports acceptFinding/dismissFinding only from @/lib/findingsClient; no React in the module.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regroup StoryFindingsRail into fixable cards (Apply fix / Fix it in the editor / Jump to it / Dismiss)</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFindingsRail.tsx, apps/dispatch-control/__tests__/StoryFindingsRail.test.tsx</files>
  <behavior>
    - Two unresolved findings (sectionId 'game') with the same quotedSpan and different reasons → exactly ONE "Must fix" chip, the quote rendered once, both reasons rendered as list items, header count reads "1" plus "from 2 findings".
    - `canAnnotate={false}` (game) → card button "Fix it in the editor →" present, no "Jump to it" button; clicking calls onFixInEditor with the group's first findingId.
    - `canAnnotate` true + group with an anchoredFindingId → "Jump to it →" calls onJump with that anchored id. canAnnotate true but no resolved member (anchor failure) → "Fix it in the editor →".
    - Group with suggestedFix + canAnnotate true + onApplyFix provided → "Apply fix" button; clicking calls onApplyFix with the group's `members` (both ids). Group with suggestedFix but canAnnotate false → NO "Apply fix".
    - Group without any suggestedFix → no "Apply fix".
    - "Dismiss" (when onDismiss provided) reveals a one-line reason input + "Confirm dismiss"; confirm disabled while reason is blank; confirm calls onDismiss(findingIds, reason).
    - Existing tests keep passing after updating the fix-button regex from /fix in editor/ to /fix it in the editor/i (zero-findings → null; two distinct spans → two cards, two Jump buttons, onJump('f1'); "Review" chip for non-voice warning).
  </behavior>
  <action>
Rewrite StoryFindingsRail rendering on top of `groupFindingRows` (Task 1). Update the header doc comment: replace the "Design note (Dismiss)" paragraph with a quick 261014-lbr note — cards are grouped by normalized quote per section; Apply fix/Dismiss reuse `acceptFinding`/`dismissFinding` (the AnnotationMark helpers) via `storyFindingActions`, no new endpoint; the rail itself stays pure (callbacks only, no Convex/fetch/Clerk).

Props (all new ones optional so existing call sites/tests compile):
- add `sectionId?: string` to `StoryFindingsRailUnresolvedFinding`, plus `suggestedFix?: string`.
- `canAnnotate?: boolean` (default `true`) — false for sections whose text is not marked up in the galley (game, theme, non-specAd bonus).
- `onApplyFix?: (members: FindingGroup['members']) => Promise<{ note: string | null } | void>`
- `onDismiss?: (findingIds: string[], reason: string) => Promise<{ note: string | null } | void>`
Keep `onJump(findingId: string)` and `onFixInEditor(findingId: string)` signatures unchanged.

Card (one per group, key = group.key), System Sheet styling identical to today's card (hard edges, existing tokens, `min-h-[44px]` buttons, no rounded corners):
- `severityChip` driven by `{ severity: group.severity, axis: group.axis }` (keep the function, adapt its param type).
- Quote once (same blockquote styling) when `group.quotedSpan`.
- Reasons: if 1 → the existing `<p>`; if >1 → `<ul>` of `<li>` with the same text classes, `list-disc pl-4`.
- If `group.suggestedFix`: a small line `Suggested change: “{suggestedFix}”` (11px, ink-soft, body font) so the editor sees what Apply fix will do.
- Action row, in this order:
  1. "Apply fix" — only when `canAnnotate && group.suggestedFix && onApplyFix`; styled as the primary (ink background, white text, hard edge, mono/ui 11px uppercase-ish matching the existing CTA language). Click → set per-card busy, `await onApplyFix(group.members)`, show returned note under the card if non-null, clear busy. Disabled while busy (label "Applying…").
  2. Navigation: if `canAnnotate && group.anchoredFindingId` → "Jump to it →" → `onJump(group.anchoredFindingId)`; else "Fix it in the editor →" → `onFixInEditor(group.findingIds[0])`. Same cobalt text-link style as today.
  3. "Dismiss" — only when `onDismiss`; toggles an inline `<input type="text" placeholder="Why? (one line)">` + "Confirm dismiss" (disabled when trimmed reason empty or busy) + "Cancel". Confirm → `await onDismiss(group.findingIds, reason)`, show any note.
  Per-card state: `useState<Record<string, {busy?: boolean; note?: string|null; dismissing?: boolean; reason?: string}>>` keyed by group.key (component already has 'use client').
- Header: card count `{groups.length}`; when `groups.length !== totalFindings` append `· from {totalFindings} findings` (mono 9.5px, faint) so it reconciles with the Draft-tab badge (which stays a per-finding count — see facts).
- Return null when there are zero groups (unchanged contract).

Update `__tests__/StoryFindingsRail.test.tsx`: change `/fix in editor/i` → `/fix it in the editor/i`; add tests for every new <behavior> bullet (use `fireEvent`/`userEvent` per what the file already imports — `@testing-library/react` `fireEvent` is fine; for async onApplyFix use `await act(...)` or `waitFor`).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/StoryFindingsRail.test.tsx __tests__/storyFindingActions.test.ts</automated>
  </verify>
  <done>Duplicate spans render as one card with bulleted reasons; game cards show "Fix it in the editor →" and no Apply fix; Apply fix/Dismiss invoke callbacks with every grouped id; all rail tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Wire StoryFocusView (jump fallback, Apply fix, Dismiss, canAnnotate) + editor field focus; full test + strict build; commit + push</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx</files>
  <action>
**StoryFocusView.tsx**
- `import { useAuth } from '@clerk/nextjs'` and `const { getToken } = useAuth()` (same as AnnotationMark).
- `import { jumpToFinding, applyFixToGroup, dismissGroup } from './storyFindingActions'`.
- `const canAnnotate = !(sectionId === 'game' || sectionId === 'theme' || (sectionId === 'bonus' && draft.bonusType !== 'specAd'))` — mirrors `wordCountLabelFor`'s 'Structured' rule and the server's accept_unavailable branches. Comment why.
- Replace `handleJump` body with `jumpToFinding(findingId, handleFixInEditor)` — never silent; covers game/podcast/deliberation and any anchor failure.
- `async function handleApplyFix(members)`: `const r = await applyFixToGroup({ runId: _runId, revisionId, members, getToken }); await reloadDraft(); return { note: r.note }`. Wrap in try/catch returning `{ note: e instanceof Error ? e.message : 'Apply fix failed.' }`.
- `async function handleDismiss(ids, reason)`: `const failed = await dismissGroup(_runId, ids, reason, getToken); return { note: failed.length ? \`${failed.length} could not be dismissed — try again.\` : null }` (Convex reactivity drops dismissed rows; no reload needed, matching AnnotationMark).
- Pass to `<StoryFindingsRail>`: `canAnnotate={canAnnotate}`, `onApplyFix={handleApplyFix}`, `onDismiss={handleDismiss}` (keep onJump/onFixInEditor).
- New optional prop `focusQuote?: string` on StoryFocusViewProps → forwarded to `<SectionEditorPanel focusQuote={focusQuote} />`.
- Update the header comment with a one-paragraph quick 261014-lbr note.

**ReviewDeskRunView.tsx** — next to `editFindingReason`, add `const editFindingQuote = editFinding?.findingId ? rawFindings.find(row => row._id === editFinding.findingId)?.quotedSpan : undefined` and pass `focusQuote={editFindingQuote}` to StoryFocusView. Nothing else changes (do NOT touch chipCounts/tallyForSection — counts stay per-finding, D-25).

**SectionEditorPanel.tsx** — add optional prop `focusQuote?: string` (doc: quick 261014-lbr — the finding's quoted span; the panel focuses the field that contains it). Add `const rootRef = useRef<HTMLDivElement>(null)` on the outer `<div className="flex flex-col gap-4">` (line ~468). `useEffect(() => { if (!focusQuote || !rootRef.current) return; const id = requestAnimationFrame(() => { if (rootRef.current) focusFieldContainingQuote(rootRef.current, focusQuote) }); return () => cancelAnimationFrame(id) }, [focusQuote, selectedSection])` — import `focusFieldContainingQuote` from './storyFindingActions'. Runs once per deep-link (not on every keystroke — deps exclude `working`). Ensure `useRef` is imported. No per-editor changes: GameEditor's embedCode `<textarea>`, BlockEditor `<textarea>`s and headline `<input type="text">` are all matched by the DOM query.

**Verify (both required — vitest does not type-check):**
1. `pnpm --filter dispatch-control test` — whole suite green (fix any existing test that asserted the old rail labels/behaviour; DraftFocusFrame.test.tsx and any StoryFocusView/ReviewDeskRunView tests may need a `@clerk/nextjs` `useAuth` mock if StoryFocusView is rendered there — check how sibling tests mock Clerk and follow that).
2. `pnpm --filter dispatch-control build` — strict Next build must pass.

**Commit + push (only if BOTH pass):** the working tree has unrelated uncommitted changes (`.planning/config.json`, `apps/web/__tests__/issue-page-typography.test.ts`, `docs/client-editable/*.docx`, phase-26/36 planning files, untracked `.planning/notes/`, etc.) — NEVER `git add -A`/`git add .`/`git commit -a`. Stage exactly the seven files in `files_modified` (quote the paths — they contain parentheses and brackets) and commit:
`fix(dispatch-control): make story findings fixable — jump fallback, grouped cards, Apply fix (quick-261014-lbr)` with the Co-Authored-By trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Run `git status --short` before committing and confirm only those paths are staged. Then `git push origin master`. If tests or build fail and cannot be fixed within scope, do not commit; report the failure.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test && pnpm --filter dispatch-control build</automated>
  </verify>
  <done>Full dispatch-control vitest suite and strict `next build` pass; the seven files (and only those) are committed on master and pushed to origin.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test` green, including new storyFindingActions + StoryFindingsRail tests:
  grouping merges identical spans; jump falls back to fix-in-editor when the anchor is missing; game section shows "Fix it in the editor"; Apply fix calls acceptFinding for every grouped finding (threading revisionId).
- `pnpm --filter dispatch-control build` green.
- `grep -n "acceptFinding\|dismissFinding" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/storyFindingActions.ts` shows imports from `@/lib/findingsClient` only — no new fetch/endpoint.
- `git show --stat HEAD` lists only the seven planned files.
</verification>

<success_criteria>
On the GAME story, the editor sees ONE "Must fix" card for "operating in that watershed since 2009" with both reasons bulleted;
its button reads "Fix it in the editor →" and opens the editor with the Embed code textarea focused and the phrase selected.
On prose stories, cards with a suggested fix offer "Apply fix" that resolves every finding on the card through the existing accept helper;
"Jump to it →" never silently fails. Counts on the tab badge are unchanged (per-finding); the rail header explains "from N findings".
</success_criteria>

<output>
After completion, create `.planning/quick/261014-lbr-make-story-findings-fixable-jump-fallbac/261014-lbr-SUMMARY.md`.
Note in it: tab badge / meta "N open" remain per-finding counts (shared chipCounts source, D-25) — the rail reconciles via "from N findings"; Apply fix is intentionally absent on game/theme/non-specAd bonus because the server accept path returns accept_unavailable there.
</output>
