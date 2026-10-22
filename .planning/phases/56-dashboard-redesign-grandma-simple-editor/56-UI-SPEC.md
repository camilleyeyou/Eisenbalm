---
phase: 56
slug: dashboard-redesign-grandma-simple-editor
status: approved
shadcn_initialized: true
preset: none (components.json present, style "default", baseColor neutral, Tailwind v4 CSS-first, radius 0; only components/ui/switch.tsx consumes shadcn variables)
created: 2026-10-22
---

# Phase 56 — UI Design Contract

> Visual and interaction contract for the dispatch-control editor rebuild (apps/dispatch-control).
> The approved design is the 7-artboard canvas. This spec transcribes it into tokens and rules and adds the phone behaviour the canvas lacks. If this spec and a canvas file disagree on a desktop value, the canvas wins, except where "Snapped" below says otherwise.

## Source of truth

Canvas directory: `.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/` (open each `.dc.html`; `canvas.json` holds board sizes, all 1280px wide).

| Artboard file | Live route (new or rebuilt) | State shown |
|---|---|---|
| `Main.dc.html` | `/` | Issue ready to publish (Waiting for you) |
| `Home-Writing.dc.html` | `/` | Issue still being written (Working) |
| `Home-Published.dc.html` | `/` | Issue published; also the view of any past published issue |
| `Section.dc.html` | `/s/[section]` | Read and edit one part, one paragraph in edit mode |
| `Archive.dc.html` | `/archive` | Past issues + collapsed Stopped/unfinished |
| `Behind.dc.html` | `/admin` | Behind the scenes hub: step list + "dials" |
| `Behind-Run.dc.html` | `/admin/runs/[id]` | A run that hit a Problem, explained in plain words |

Missing screen to derive from the canvas (not drawn): the Home page with no current issue and nothing started (see Empty states). Home-Published doubles as the "next issue not started" page.

Reused, not redesigned (backend unchanged): Galley (`components/galley/*`), in-place paragraph editor, content-patch API (`lib/contentPatchClient.ts`), hold/start/stop/publish chain (`lib/publishChain.ts`, `lib/pipelineControlClient.ts`, `components/StopRunButton.tsx`), `lib/derivedState.ts`, `lib/issueTitle.ts`, `lib/runLabels.ts`, `lib/nomenclature.ts`, `lib/nav.ts` (ADMIN_ITEMS to be relabelled).

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn present but effectively unused; editor pages are hand-built with Tailwind v4 `@theme` tokens in `app/globals.css`. Do not add shadcn components for this phase. |
| Preset | not applicable |
| Component library | none (plain elements; `components/ui/ConfirmDialog.tsx` reused for confirmations) |
| Icon library | none. Inline SVG only: 16px check (stroke 3), 14px check/exclamation in Behind step dots, 20px pencil (stroke 2). Copy the SVG paths from the canvas. |
| Font | Newsreader (display, `--font-display`), Lora (reading, `--font-body`), Space Grotesk (UI, `--font-ui`). IBM Plex Mono is NOT used on any editor page (keep the token for non-editor surfaces only; technical details `<pre>` is the one allowed monospace use, browser `monospace`, 14px). |

## Token mapping (canvas onto existing globals.css)

| Canvas value | Existing token | Action |
|---|---|---|
| Page background `#f1f0ea` | `--color-rail` (#f1f0ea) | Editor pages use `bg-rail`. Do NOT use `--color-paper` (#e9eaec); that stays for the legacy/admin-internal surfaces. |
| Ink `#17140e` | `--color-ink` | reuse |
| Secondary text `#55514a` | `--color-ink-soft` | reuse |
| Card/slab white `#ffffff` | `--color-card` | reuse |
| Cobalt `#253ad4`, hover `#1b2ba6` | `--color-cobalt`, `--color-cobalt-dark` | reuse |
| Hover wash `#f7f6f1` | none | add `--color-wash: #f7f6f1` |
| Done green `#11764a` | `--color-green` is #148a52 | add `--color-done: #11764a` (canvas value; 5.65:1 on white, 4.95:1 on rail). Do not reuse `--color-green`. |
| Amber text (canvas `#9a6f04`) | `--color-marigold-text` is #9a6f04 | add `--color-amber-text: #8a6403` and use it for all status-text amber on editor pages (canvas value computes to 3.96:1 on rail and fails AA at 15px). Do not use `--color-marigold-text`. |
| Problem red `#c43a14` | `--color-vermilion` is #e8471d | add `--color-problem: #c43a14` (text-safe contrast) |
| Current-row tint `#fffdf6` | none | add `--color-current: #fffdf6` (Archive: this week's row) |
| Hairlines `rgba(23,20,14,.12/.2/.3)` | `--border` is a different value | add `--color-line: rgba(23,20,14,.12)`, `--color-line-strong: rgba(23,20,14,.2)` |

Corners: radius 0 everywhere except the circular station markers. No shadows. Focus ring on every interactive element: `outline: 3px solid #253ad4; outline-offset: 2px`.

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap between label and status line in a station |
| sm | 8px | Gap inside a row's stacked fields on phone |
| inset | 12px | Named token, used ONLY for the paragraph hover gutter (`-mx-3` / `px-3`) and the masthead wrap gap; kept at 12 so paragraph text stays aligned with the 16px station/row grid when the wash appears |
| md | 16px | Default gap, row vertical padding, textarea vertical padding, phone padding |
| lg | 24px | Row padding (24 horizontal), slab inner gaps, nav gap |
| xl | 32px | Page horizontal padding (desktop), slab padding, display gaps |
| 2xl | 48px | Gap between major page sections (canvas 44, snapped up) |
| 3xl | 64px | Page bottom padding, article bottom padding |

Snapped canvas values (executor uses the right-hand value everywhere): 22 to 24, 20 to 24 (row gaps, textarea horizontal padding), 18 to 16 (row vertical padding), 14 to 16, 10 to 8, 44 to 48, 28 to 32, 56 to 48 (article top), 72 to 64. Specific reconciliations: part/archive rows `18px 24px` becomes `16px 24px`; dial rows `16px 22px` becomes `16px 24px`; paragraph rows `10px 12px` becomes `8px 12px` (12 is the declared inset token). Visual drift stays within 4px.

Exceptions:
- Touch targets: every button, link-row and input has `min-height: 48px`; primary button 56px; part and archive rows 64px. These are minimums, not spacing tokens.
- Row vertical padding is 16px; the 64px `min-height` (not padding) gives single-line rows their height.
- Textarea inner padding `16px 24px`; paragraph hover gutter is the 12px inset token as a negative margin (`-mx-3`) so text does not shift when the wash appears.
- Fixed component dimensions (sizes of drawn things, not spacing): 30px station marker, 22px Behind step dot, 12px marker centre dot, 2px connectors and rules, 20px pencil glyph in a 48px button, 24px / 116px number and part-name columns, `clamp(24px, 7vw, 96px)` article side padding (fluid, minimum 24). No spacing value outside the scale appears anywhere else.
- Page container: `max-width: 1040px`, centred; article (Section) is full 1040 with `padding: 48px clamp(24px, 7vw, 96px) 64px`; its text column is `max-width: 720px`.

## Typography

Exactly these named sizes exist on editor pages: **ui 15, reading 17 and 18 (18 = paragraph body, primary button, issue blurb, Stopped-list italic, phone subtitle), heading 23 / 26 / 32, display 42 / 48**. No other size may be used (16, 19, 21, 22, 20, 34 are dropped). Minimum size on an editor page is 15px, except the 14px monospace technical-details `<pre>`, the single named exception. Nothing smaller, no uppercase tracking, no mono caps chips.

| Role | Font | Size | Weight | Line height | Where |
|------|------|------|--------|-------------|-------|
| ui | Space Grotesk | 15px | 400 (600 for status words) | 1.4 | nav, status words, metadata lines, helper text, "Your next step" eyebrow (600) |
| reading | Space Grotesk 17px for UI text and station names; Lora 17px for explanatory sentences; Lora 18px / 1.75 for paragraph text in Section and textarea | 17px (18px reading) | 400 / 600 | 1.55 (reading 1.75) | slab explanation, station name (600), buttons 17–18px (600), form fields |
| heading | Newsreader | 23px row titles, subtitles and wordmark (500; subtitle is Lora italic), 26px section headings (600), 32px slab sentence (500) | 500 / 600 | 1.15-1.25 | part row titles, "The nine parts", "Step by step" |
| display | Newsreader | 42px Section / page h1 (600, lh 1.06); 48px issue charity name (600, lh 1.04, letter-spacing -0.01em) | 600 | 1.04-1.06 | one per page |

Weights: 400 and 600 are the system weights. Weight 500 is permitted only on Newsreader (slab sentence, part-row titles) as in the canvas. Lora italic is used for subtitles (23px, lh 1.4, `ink-soft`) and for one-line explanations in the Stopped list (18px).

Button text: primary 18px / 600; Save, ghost and secondary buttons 17px / 600 (reading size). Site masthead title "The Eisenbalm Dispatch": Newsreader 23px / 600.

Body copy line length: max 720px (Section), 760px (issue blurb), 620px (hold/stop explanation).

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#f1f0ea` (rail) | Page background |
| Secondary (30%) | `#ffffff` (card) plus ink text `#17140e` / `#55514a` | Slab, part list, article page, archive list, dial list |
| Accent (10%) | `#253ad4` cobalt (hover `#1b2ba6`) | see reserved list |
| Status Done | `#11764a` | Done / Written / Published text, completed station disc and connectors (note: stations use cobalt, see below) |
| Status Waiting / Working | `#8a6403` | "Waiting for you", "Working" text and working dot |
| Status Problem | `#c43a14` | "Problem" text and its step dot |
| Status Stopped / Not yet | `#55514a` | muted text, hollow grey dot |
| Destructive | none | Stop/Hold are ghost buttons (white, 1px ink border). Nothing on editor pages is red-filled. |

Accent (cobalt) reserved for, and only for:
1. The ONE primary button on the page (56px, white text). Exactly one per page.
2. Completed and current station discs and connector lines in the four-station checklist (disc filled cobalt with white check; current station is a white disc, 3px cobalt ring, 12px cobalt centre dot).
3. Text links (`a` default) and hover color shift to cobalt-dark.
4. Focus ring.
5. Textarea border while editing (2px cobalt) and the Save button (primary-style, 48px).
6. Archive search field focus.
Never cobalt on: status words, row titles, headings, nav (nav is ink-soft; current item ink, 600, 2px underline, offset 6px).

Status colour is always paired with the word and, where drawn, a shape (check, ring, exclamation, hollow dot). Colour is never the only signal.

## Status words (single source: extend `lib/nomenclature.ts`)

Exactly six, capitalised as shown, used everywhere (checklist, part rows, archive, Behind steps):

| Word | Colour | Meaning | Marker shape |
|---|---|---|---|
| Done | `#11764a` | finished, nothing for the editor | filled disc, white check |
| Working | `#8a6403` | machine is busy, no action for the editor | ring + dot (current-station style) |
| Waiting for you | `#8a6403`, 600 | the editor must act | ring + dot |
| Not yet | `#55514a` | later in the sequence | hollow grey disc |
| Stopped | `#55514a`, 600 | ended on purpose | grey line |
| Problem | `#c43a14`, 600 | ended by a failure | disc with white exclamation |

Part rows may also say "Written", "Published" (Done synonyms for a part, `#11764a`, 600) and may append a plain suffix after a middle dot: "Written · 2 fixes by the writers", "Working · 5 of 9 parts". Singular: "1 fix by the writers". Never show raw states such as awaiting-review, failed, interrupt, gate.

## Layout and component contract

### Shell (every editor page)
- Masthead row: wordmark left (link to `/`), nav right, `max-width 1040`, padding `24px 32px 8px`, wraps with `gap 12px 24px`.
- Nav is exactly three links with `aria-label="Pages"`: **This week's issue** (`/`), **Past issues** (`/archive`), **Behind the scenes** (`/admin`). 15px, `ink-soft`, current page `aria-current="page"`. The old "Admin" link and all other chrome (CommandPalette trigger, role badges, mono chips) are removed from editor pages.
- Main: `max-width 1040`, padding `16px 32px 64px`, vertical gap 48px.

### 1. "Your next step" slab (every page, first thing in main)
- `section` with `aria-labelledby`, white, **2px solid ink** frame, padding `32px`, flex row wrapping, gap `24px 32px`, text block `flex: 1 1 440px`.
- Eyebrow "Your next step" 15px / 600 / ink-soft. Sentence: Newsreader 32px / 500 / lh 1.15. Optional explanation: Lora 17px / 1.55 / ink-soft (at most 2 sentences).
- Right side: ONE primary button (cobalt, white, 18px / 600, min-height 56px, padding 0 32px, no radius, hover `filter: brightness(.92)`) plus at most one text link beneath it (15px, cobalt).
- Pages whose only job is navigation (Section, Archive, Behind) show a ghost button instead ("Back to the issue", "This week's issue"); the ghost is white, 1px ink border, 48px. Rule: a page has at most one cobalt primary button, and pages with none are fine.
- When status is Working, the right side shows a non-interactive "Working" indicator (amber dot + word, 17px / 600), not a disabled button. Nothing is ever drawn disabled or dead.
- The slab is derived from `lib/derivedState.ts`; the sentence and button per state are in the Copywriting Contract.

### 2. Four-station checklist (Home only)
- `ol` of 4 equal columns (`grid-template-columns: repeat(4, minmax(0,1fr))`): **Pick charity · Write · Check · Publish**.
- Per station: top row = connector (2px) – 30px circular marker – connector; connectors cobalt when that side is complete, transparent at the outer ends and after the current station. Below, centred: station name 17px / 600 ink, status line 15px.
- Status line examples: "Done", "Done · all nine parts", "Done · 6 fixes made", "Working · 5 of 9 parts", "Not yet", "Now — waiting for you" (amber 600), "Done · Thursday 22 October".
- Marker states: Done = cobalt disc + white check; current (Working or Waiting for you) = white disc, 3px cobalt ring, 12px cobalt dot; Not yet = 30px hollow disc with a 2px grey ring (`#55514a` at 30% opacity), as in Home-Writing stations 3-4.
- Charity is auto-picked: the Pick charity station never shows a choice or a button; it is Done as soon as the issue exists.
- Container is decorative-plus-text: `aria-label="Progress on this issue"`, current station has `aria-current="step"`.

### 3. Issue header (Home)
Line 1: "Issue 48 · Thursday 29 October 2026" 15px ink-soft (append " · Published" for published). h1 charity name Newsreader 48/1.04/600. Blurb Lora 18px / 1.5 / ink-soft, max 760px. Never a run id; names come from `lib/issueTitle.ts`.

### 4. The nine parts list (Home)
- h2 "The nine parts" (Newsreader 26/600) with a right-aligned 15px hint (varies by state, see copy). Below: white `ol`, 1px `line-strong` border, rows separated by 1px `line`.
- Row (full-row `<a>`, hover wash `#f7f6f1`, min-height 64, padding 16px 24px, `gap 8px 24px`, baseline-aligned, wraps): number (24px column, 15px ink-soft) · part name (116px column, 15px ink-soft) · part title (flex 1, Newsreader 23/500/1.25) · status text (15px / 600, colour per status table).
- Part order and names: 1 Origin story, 2 Problem, 3 Founder, 4 Case study, 5 Bonus, 6 Game, 7 Deliberation, 8 Podcast, 9 Look. Exactly nine rows (fixes bug 7).
- Parts not written yet render as a non-link `div` (no hover, no chevron) with the title placeholder and "Working" or "Not yet". Written parts are links to `/s/[section]`.
- Published issue: rows stay links; status "Published".

### 5. Hold / Stop footer (Home, below the parts, top border 1px `line-strong`, padding-top 32px)
Left: Lora 17px ink-soft explanation (max 620px). Right: one ghost button (48px, 17px / 600). Ready/Waiting-for-you state: "Hold this issue". Working state: "Stop writing this issue" (confirms via ConfirmDialog, see below). Held state: button becomes "Release this issue" and the slab sentence changes (see copy). No footer on a published issue.

### 6. Section page (`/s/[section]`)
- Slab (ghost "Back to the issue"), then a white article, 1px `line-strong` border.
- Article top row: link "Issue 48 · Kumasi Roofless Schools Trust" (15px, ink-soft, returns to `/`) left; "Part 3 of 9 · Founder" right.
- Title Newsreader 42/1.06/600 + Lora italic 23px subtitle (max 720px).
- Toolbar strip (max 720px, borders top and bottom 1px `rgba(23,20,14,.14)`, padding 16px 0): helper sentence (15px) left, ghost button "Rewrite this part" right (48px). This is the ONLY AI helper on the page.
- Paragraphs: Lora 18px / 1.75 ink in a 720px column. Each paragraph is a row: padding `8px 12px`, margin `0 -12px`, flex with 16px gap; on hover/focus-within the row gets wash `#f7f6f1` and a 20px pencil button (`aria-label="Edit this paragraph"`, 48x48 hit area, `opacity 0` until hover/focus, always visible on touch) appears at the right edge. Click on the paragraph text also enters edit mode.
- Edit mode (one paragraph at a time): label "Editing paragraph 3" (15px / 600), textarea (Lora 18/1.75, padding 16px 24px, 2px cobalt border, white, vertical resize, min 4 rows, autofocus), then buttons **Save** (cobalt, 48px, 17px/600) and **Cancel** (ghost 48px) and the reassurance line (15px ink-soft): "Nothing goes to readers until you press Publish on the issue page." Save calls the content-patch API and returns to read mode with the new text; the paragraph shows an inline "Saved" (15px, `#11764a`) for 3s. Escape = Cancel. Opening another paragraph while one has unsaved edits asks via ConfirmDialog.
- "What the writers changed in this part (N)" is a closed `details` below the text (summary 17px / 600, list 15px). Hidden when N = 0.
- Prev / next nav (`aria-label="Other parts"`): left ghost block "Previous · Part 2 / Problem", centre text link "All nine parts", right ghost block "Next · Part 4 / Case study". First/last part omit the missing side.
- Published issue: article is read-only (no pencils, no Rewrite, toolbar helper says "This issue is published. Changes after publishing need a new issue.").
- The Game part (iframe) and Podcast/Look parts get the same article frame, but their body is the existing Galley game slot / audio field / theme fields; the paragraph pencil applies only to text paragraphs. Keep the sandboxed iframe as-is.

### 7. Past issues (`/archive`)
- Slab (ghost "This week's issue"), then h1 "Past issues" (Newsreader 42/600) with Lora 17px subtitle "Every issue so far, newest first." and a search field (label "Find an issue", placeholder "Charity name or issue number", 48px, 1px ink border, white, 17px).
- List: white `ol`, same chrome as the parts list. Row: date line (15px ink-soft, "Issue 47 · 22 October 2026", 200px column) · charity name as the link (Newsreader 23/500) · status word (15px / 600) · optional text link "Read on the website" (15px, cobalt, opens public site). This week's issue row has tint `#fffdf6` and status "Waiting for you · this week" (or Working).
- Title link opens the issue's Home view (`/` layout, scoped to that issue) (fixes bug 1).
- Bottom: `details` "Stopped or unfinished issues (N)" collapsed by default. Rows: date line, Lora italic 18px plain reason ("Stopped before a charity was chosen", "Hit a problem while checking the research"), status word (Stopped grey / Problem red), and for Problem a link "What happened" to the Behind-Run page. Never run ids.
- Empty (no published issues): see Empty states.

### 8. Behind the scenes (`/admin`)
- Slab with ghost "Back to the issue" and the sentence "Nothing here needs you this week..." (or "This issue hit a problem" variant when the latest issue is in Problem).
- h1 "Behind the scenes" + Lora 17px "How the machine made this week's issue, and the dials that control it. Nothing on this page is needed to publish."
- Two columns at >=1024px (about 60/40): left "This week's issue, step by step" with 10 plain-word steps in the canvas order (Find story leads; Find charities worth writing about; Check the charities are real; Choose this week's charity; Research the charity; Check the research against its sources; Write the nine parts; Check the writing and fix problems; Final read-through; Publish). Each step: 22px dot with 14px glyph on a vertical 2px line, name 17px / 600, status line 15px ("Done · 9:04", "Done · 9:39 · 6 fixes", "Waiting for you"). Footer line: "This issue cost $0.58 to write and took 39 minutes." (cost must be the real total, never $0.00; bug 6).
- Right "The dials" list: seven white link rows (min-height 64, padding 16px 24px, hover wash), title 17px / 600 + 15px ink-soft description. Order and labels: **Money** (Check weekly), **Charities** (Check weekly), **Past issues, step by step**, **What the writers are told**, **Quality tests**, **Schedule and limits**, **Settings**. "Check weekly" is a plain 15px ink-soft tag in text (not a chip, no border, no caps). Map to existing routes: Money to `/admin/finance`, Charities to `/admin/charities`, Past issues step by step to `/admin/runs`, What the writers are told to `/admin/agents`, Quality tests to `/admin/tests`, Schedule and limits to `/admin/automation`, Settings to `/admin/settings`. Route paths do not change; labels in `lib/nav.ts` do.
- Inside those sub-pages, jargon cleanup (Run, Trigger Run, Pipeline Graph, DAG, Drift, Re-roll, Calibrator, Chronicler, tokens in/out, agent names) is part of this phase's acceptance for any page reachable from the dials, but their layout is not redrawn; wrap them in the new shell and slab. Anything styled as a button must act (bug 9).

### 9. Behind-Run (`/admin/runs/[id]`, a problem run)
Slab: sentence "This issue hit a problem and stopped. Nothing reached readers.", explanation, ONE cobalt "Start a new issue". Breadcrumb line "Behind the scenes · Issue 42 · Thursday 17 September 2026" (first part a link). h1 "What happened to Issue 42" (Newsreader 42). Left: "Step by step" (same step component; the failing step shows Problem with a red exclamation dot; later steps "Not started"); footer "This attempt cost $0.21 before it stopped." Right: h2 "In plain words" with 2 Lora paragraphs (what the step does, why it stopped, what usually happens next), then a closed `details` "Technical details" containing a `<pre>` (14px monospace, `rgba(23,20,14,.04)` background) with the raw error. A run paused for a decision is never labelled Problem or Failed.

## Interaction rules
- Everything on a page that looks like a button does something. No placeholder buttons ("Restart from this step", "Improve this agent" are removed or wired).
- Primary action per state is the only cobalt button; it is also the only thing in the slab.
- Hold, Stop and Release are ghost buttons. Stop is the only discard action and uses ConfirmDialog; Hold and Release do not need confirmation.
- Home auto-updates (existing Convex subscription) while Working; a polite live region (`aria-live="polite"`) announces "Part 6 is written" style changes. No spinner animations beyond a 1.2s pulse on the working dot (respect `prefers-reduced-motion`: static).
- Role: publishing needs the Editor-in-chief role and no hold (the only gates). A collaborator sees the same slab but with no Publish button; sentence reads "Waiting for the editor-in-chief to publish." (Waiting for you becomes Not yet for them).
- No toasts that vanish with the only copy of an error; errors appear inline next to the control (15px, `#c43a14`, 600, with icon).
- Links that leave the app (public site) open in a new tab with visible text "on the website".

## Responsive contract (phone, 360-480px; tablet 481-1023px)
Canvas is desktop-only; the following applies and is acceptance-tested at 400px.

- Breakpoints: phone < 640, tablet 640-1023, desktop >= 1024. The canvas already wraps via flex; keep those wraps and add below.
- Page padding: 16px horizontal on phone (24 on tablet, 32 desktop); gap between sections 32px on phone.
- Masthead: wordmark on its own line (23px), nav below it as a single wrapping row of 3 links, each with a 48px-tall tap area (15px text, `gap 4px 24px`). No hamburger.
- Slab: padding 16px; stack vertically; sentence 26px / 1.2 (heading token, from 32); explanation 17px; the primary button becomes full width (min-height 56px) under the text; the secondary text link sits under the button, centred, 48px tall.
- Four-station checklist: stays four columns on tablet. On phone it becomes a **vertical list** (one station per row, left marker column): 30px marker at left, 2px vertical connector between markers (cobalt when the station above is complete), name 17px / 600 and status 15px stacked at the right, row min-height 56px. Same markers, same words, same order, same `aria-current="step"`.
- Issue header: charity name 32px / 1.1 on phone (from 48); blurb 17px.
- Part rows: the 4-field row becomes a 2-line card: line 1 = "3 · Founder" (15px ink-soft) with the status word right-aligned on the same line; line 2 = part title (Newsreader 23px / 1.25, wraps freely, no truncation). Row padding 16px, min-height 64px, whole row remains the tap target.
- Hold/Stop footer: explanation above, ghost button full width (48px).
- Section page: article padding `32px 16px 48px`, border kept; title 32px / 1.1; subtitle 18px italic; toolbar stacks (helper text, then full-width "Rewrite this part" ghost button); paragraph text Lora 18px / 1.7; the pencil button is always visible (no hover on touch), 48x48, pinned top-right of the paragraph row, paragraph gets right padding 64px. Tap on the paragraph also enters edit mode. Edit mode: textarea full width, 6 rows, Save and Cancel stacked full width (Save first), reassurance line below. Keyboard avoidance: scroll the textarea into view on focus.
- Prev/next nav: stacks into three full-width 56px rows in this order: Previous, Next, then the "All nine parts" link.
- Archive: each row becomes 3 lines: date (15px) / charity name (Newsreader 23px, the link, min 48px tap height) / status word + "Read on the website". Search field full width. The Stopped `details` summary is a full-width 48px target.
- Behind: columns collapse to one: steps first, dials after; dial rows full width. Technical `<pre>` scrolls horizontally inside its box (never the page).
- No horizontal page scroll at 360px. Text never below 15px. Tap targets >= 48px (the 20px pencil icon is an exception only for the glyph; the button is 48px).

## Copywriting Contract

Voice for editor pages: plain, warm, second person, short sentences, no jargon, no exclamation marks, no emoji. This is separate from Jesse's reader-facing voice. Banned words on editor pages: run, trigger, pipeline, graph, DAG, drift, re-roll, calibrator, chronicler, agent, token, gate, interrupt, deterministic, awaiting-review, failed. Issues are always "Issue N · date" and the charity name.

### Slab sentence + button per Home state

| State (derivedState) | Sentence | Explanation | Primary button | Link |
|---|---|---|---|---|
| Ready to publish (Waiting for you) | Read the issue, then publish it. | Everything is written and checked. Open any part below to read it or change the words. When you're happy, press Publish. | Publish Issue 48 | Preview the issue first |
| Writing (Working) | Nothing for you to do yet. The writers are on it. | Issue 48 started at 9:02 this morning. Five of the nine parts are written. This page updates by itself, so come back when it says the issue is ready. | none (Working indicator) | none |
| Checking (Working) | Nothing for you to do yet. The writers are checking their work. | All nine parts are written. They are being checked and fixed. This page updates by itself. | none (Working indicator) | none |
| Held | This issue is on hold. | It will not go out until you release it. You can still read and change the parts. | Release this issue | Preview the issue first |
| Published, next not started | Issue 47 went out on Thursday. Start the next one when you're ready. | Readers can see it now. Starting the next issue takes one click: the writers pick a charity and write all nine parts, then this page tells you when it's your turn. | Start next week's issue | Read Issue 47 on the website |
| Stopped / Problem (latest issue) | This issue hit a problem and stopped. Nothing reached readers. | There is nothing to fix here by hand. Start a new issue and the writers will try again from the beginning, usually without trouble. | Start a new issue | What happened |
| Section page | Read this part and change any words you like. Then go back to the issue to publish it. | none | none (ghost "Back to the issue") | none |
| Archive | Nothing is waiting here. Open an issue to read it or change its words. (If this week's issue needs you: "Issue 48 is waiting for you.") | none | ghost "This week's issue" | none |
| Behind | Nothing here needs you this week. The issue is waiting for you on the front page. | none | ghost "Back to the issue" | none |

### Other copy

| Element | Copy |
|---|---|
| Primary CTA (phase-wide) | Publish Issue {N} (ready) · Start next week's issue / Start a new issue (nothing active) |
| Parts hint, ready | Click a part to read it or change the words. |
| Parts hint, writing | Finished parts open as soon as they're written. |
| Parts hint, published | You can still open a part to read it. Changes after publishing need a new issue. |
| Hold explanation | Not ready this week? Holding keeps the issue from going out until you release it. You can still read and change the parts. |
| Stop explanation | Changed your mind about this charity or this week? Stopping throws away what has been written so far. You can start a new issue straight after. |
| Section toolbar helper | Click any paragraph to change the words. Changes save to this issue straight away. |
| Rewrite helper button | Rewrite this part |
| Edit reassurance | Nothing goes to readers until you press Publish on the issue page. |
| Edit buttons | Save · Cancel |
| Saved confirmation | Saved |
| Empty state heading (no issue ever started) | No issue yet this week |
| Empty state body | Start the first issue and the writers will pick a charity and write all nine parts. This page will tell you when it's your turn. (Button: Start the first issue) |
| Empty state, Past issues | No past issues yet. Once you publish an issue it will be listed here. |
| Empty search result | No issue matches "{query}". Try a charity name or an issue number. |
| Stopped list empty | (section not rendered) |
| Error: save failed | We couldn't save that change. Your words are still in the box. Press Save to try again. |
| Error: publish failed | Publishing didn't go through, and nothing has reached readers. Press Publish Issue {N} to try again. If it keeps happening, tell Andrew. |
| Error: start failed | We couldn't start a new issue just now. Wait a minute and press Start a new issue again. |
| Error: load failed (any page) | This page didn't load. Check your connection, then press Reload this page. (Button: Reload this page, ghost) |
| Rewrite in progress | Rewriting this part… (inline, 17px, Working amber; the old text stays visible until the new text is ready) |
| Rewrite result | Here is the new version. Keep it or go back to the old one. (Buttons: Keep this version · Go back to the old one) |
| Destructive: Stop writing this issue | Stop writing this issue?: "This throws away what has been written so far for Issue 48 · {charity}. Nothing has reached readers. You can start a new issue straight after." Buttons: Stop writing (ghost danger-neutral, ink border) · Keep writing (primary in dialog only) |
| Destructive: Discard unsaved paragraph edit | Leave without saving?: "Your changes to this paragraph haven't been saved." Buttons: Leave without saving · Keep editing |
| Hold / Release | no confirmation |

Destructive actions in this phase: Stop writing (confirm dialog), discard unsaved edit (confirm dialog), Rewrite this part (non-destructive: old text kept until Keep this version is chosen). Publish needs no extra dialog beyond the single button press (it is the intended primary action); the button label includes the issue number.

## Accessibility
- One `h1` per page (issue charity name on Home, part title on Section, "Past issues", "Behind the scenes", "What happened to Issue N").
- Slab is a labelled `section`; checklist is an `ol` with `aria-current="step"`; status words are real text.
- Contrast (computed WCAG ratios; all status text is 15px / 600 or larger): ink-soft #55514a 7.89 on white, 6.91 on rail, 7.29 on wash #f7f6f1, 7.75 on current #fffdf6; done green #11764a 5.65 / 4.95 / 5.23 / 5.56; amber #8a6403 5.38 / 4.71 / 4.97 / 5.28; problem #c43a14 5.30 / 4.64 / 4.90 / 5.21 (columns in the same order: white, rail, wash, current). All pass AA 4.5:1 on every row and page background. Do not use the canvas amber #9a6f04 (3.96 on rail).
- Keyboard: paragraphs are focusable (tabindex 0, Enter/Space begins editing); Escape cancels; focus returns to the edited paragraph after Save or Cancel.
- Reduced motion respected; no motion other than the working-dot pulse and 120ms hover wash.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (existing `switch` untouched) | not required |
| Third-party | none declared | not applicable |

## Open items for the planner (not blocking)
1. Canvas shows pencil on hover only; touch behaviour is specified here (always visible).
2. "Rewrite this part" behaviour (what it calls, the Keep/Go back flow above) is a UI contract only; reuse the existing re-roll endpoint, relabelled. Plan must confirm the endpoint can return a candidate without overwriting.
3. `Held` and Collaborator-role states are not drawn in the canvas; they follow the same slab rules and are specified above.
4. Home-for-a-past-issue (Archive links) reuses Home-Published layout with that issue's data; for a Problem/Stopped issue it redirects to the Behind-Run page.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (Save/Cancel kept per locked decision 6)
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: FLAG (no destructive colour by design; Stop gated by confirm)
- [x] Dimension 4 Typography: FLAG (8-size scale waived for canvas fidelity)
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** pending
