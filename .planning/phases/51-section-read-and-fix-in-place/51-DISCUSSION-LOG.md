# Phase 51: Section — Read and Fix in Place - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 51-section-read-and-fix-in-place
**Areas discussed:** Route/shell & reading surface, One surface three kinds of problem, Recurring corrections (READ-04), Navigation & the derived count, In-place editing (READ-05), Reasoning + evidence (READ-03), Honest states, Passage toolbar
**Mode:** interactive (advisor mode off — no USER-PROFILE.md)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Route, shell & reading surface | Where `/s/[section]` lives, issue resolution with no number in path, global vs scoped typography | ✓ |
| One surface, three kinds of problem | Merging FACTUAL_AXES / VOICE_AXES / claim washes; label-not-colour-alone; competing popover label sets | ✓ |
| Recurring corrections (READ-04) | Resolver returns 'ambiguous' for 2+ unhinted matches; accept endpoint 409s | ✓ |
| Navigation & the 'still need you' count | Prev/next across nine sections; two existing selectors disagree on vocabulary | ✓ |

**User's choice:** all four.

---

## Route, shell & reading surface

### Q: Where should `/s/[section]` live in the app tree?

| Option | Description | Selected |
|--------|-------------|----------|
| New `(editorial)` route group | Own minimal layout; Phases 52/54 drop in as siblings; `(dashboard)` byte-unchanged | ✓ |
| Root-level `app/s/[section]/` | Simplest addition; each later phase invents its own shell | |
| Inside `(dashboard)`, chrome suppressed | Cheapest routing; bolts a conditional onto the layout every v4.0 screen depends on | |

**Notes:** flagged that Phase 52 will hit a `/` conflict with the existing `app/(dashboard)/page.tsx`.

### Q: How does `/s/[section]` know which issue it's showing?

| Option | Description | Selected |
|--------|-------------|----------|
| Current run only | `runs.latest → pipelineRuns.byRunId → issueNumber`, reusing `lib/useCurrentRun.ts` | ✓ |
| Current run + `?issue=N` override | Second resolution path to keep honest; risks regressing the `max(issueNumber)` bug | |
| Issue in path `/i/[n]/s/[section]` | Explicit and linkable; contradicts the approved mockup URL | |

### Q: Is `[section]` the internal galley id or a reading slug?

| Option | Description | Selected |
|--------|-------------|----------|
| Galley ids — `/s/originStory` | Reuses `sectionIdMap.ts`, `galley-{id}` anchors, `Galley`'s `sections` prop; no new map | ✓ |
| Reading slugs — `/s/origin-story` | Magazine-like URL; costs a bidirectional map that can drift | |

### Q: 760px / Lora 17.5px — global or scoped?

| Option | Description | Selected |
|--------|-------------|----------|
| Scope to the new surface | `.galley-body` stays 16.5px; Review Desk and Voice Pass unchanged | ✓ |
| Change `.galley-body` globally | Three shipped screens inherit the change and confound client feedback | |

---

## One surface, three kinds of problem

### Q: What chrome sits above the prose?

| Option | Description | Selected |
|--------|-------------|----------|
| Slim header: issue title + back to issue | One quiet non-sticky line; section name is the prose headline | ✓ |
| Nothing above the prose | Purest reading surface; a stranded editor has no route home | |
| Sticky header persisting on scroll | More reachable; it's a rail lying down | |

### Q: How is READ-02's label rendered?

| Option | Description | Selected |
|--------|-------------|----------|
| Small always-visible tag adjacent to the span | Fact / Voice / Source; satisfies READ-02 literally; additive to AnnotationMark | ✓ |
| Distinct underline styles + label in the popover | Quietest; a scanning reader can't name what they see — likely fails READ-02 | |
| Leading chip before the span | Unmistakable; interrupts the sentence it's meant to sit inside | |

### Q: Which popover action vocabulary wins?

| Option | Description | Selected |
|--------|-------------|----------|
| One neutral vocabulary for every finding | Accept suggestion / Edit myself / Dismiss via the existing `labels` prop | ✓ |
| Keep each kind's existing words | Preserves familiar copy; needs per-finding label plumbing that doesn't exist | |

### Q: How much of the provenance wash stays?

| Option | Description | Selected |
|--------|-------------|----------|
| Only unsourced claims marked | A verified fact is not a problem; avoids highlighter soup | ✓ |
| Full provenance wash, default on | Maximum transparency; most sentences highlighted | |
| Full wash, toggleable off | Honest and quiet by default; adds a control to a surface premised on having none | |

---

## Recurring corrections (READ-04)

### Q: Which case does "applies in more than one place" mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling findings sharing a fix | N rows, N resolvable spans, one action loops the existing endpoint; no backend change | ✓ |
| One finding, ambiguous span | Requires resolver + accept-endpoint changes; collides with backend-untouched | |
| Both | Highest coverage; requires pipeline work in a frontend-only milestone | |

### Q: What makes two findings the same correction?

| Option | Description | Selected |
|--------|-------------|----------|
| Same `axis` + identical `suggestedFix` | Client-side derived selector; groups the same word across different sentences | ✓ |
| Identical `quotedSpan` AND `suggestedFix` | Safest; misses the common case | |
| Never group | Simplest; fails READ-04's "one action" | |

### Q: How does a group accept execute against the revision guard?

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential, refreshing revision between each | Honours Phase 33 D-06; the only shape that works with the endpoint as built | ✓ |
| Parallel with one `revisionId` | Fastest and wrong — most of the group 409s | |
| Server-side batch endpoint | Atomic and correct; forbidden backend work | |

### Q: What does partial failure look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Apply what works, then say so plainly | "3 of 5 applied — 2 still need you"; failures stay marked and openable | ✓ |
| Stop at first failure | Predictable; editor must work out where it stopped | |
| Roll back on any failure | Cleanest model; not achievable without a server transaction | |

---

## Navigation & the derived count

### Q: Which of the nine sections get a destination?

| Option | Description | Selected |
|--------|-------------|----------|
| All nine, honest about each | game/podcast/theme render natively and state they carry no inline findings | ✓ |
| Prose sections only | Cleanest scope; leaves four table-of-contents rows linking nowhere | |
| Prose + bonus, others deep-link to old console | Least work; drops the editor into operational chrome (DOOR-03) | |

### Q: Where do prev/next live?

| Option | Description | Selected |
|--------|-------------|----------|
| At the end of the prose | Navigation as a consequence of reading | ✓ |
| In the slim header | Faster skipping; puts navigation in your eyeline while reading | |
| Both | Two controls doing one job on a surface defined by not having controls | |

### Q: What does READ-08 count?

| Option | Description | Selected |
|--------|-------------|----------|
| Any section with open findings | Matches `deriveSectionStates`; the count doesn't pre-judge severity | ✓ |
| Must-fix only | Sharper signal; a section of review notes reads as needing nobody | |
| Two numbers side by side | Most information; two things to parse where one sentence belongs | |

### Q: Which selector is the source of truth?

| Option | Description | Selected |
|--------|-------------|----------|
| `deriveSectionStates`, extended if needed | Already iterates the nine sections, returns `openCount`; Phase 52 reuses it | ✓ |
| `deriveRunSections` | Separates voice from must-fix; keyed to run rows, not the nine-section list | |
| New selector for editorial surfaces | Clean vocabulary; a third source of truth for one question | |

**Notes:** discovery during this area — `lib/derivedState.ts:24` imports `EDITABLE_SECTIONS` upward out of `app/(dashboard)/review-desk/[runId]/_components/`. Promotion to shared `lib/` folded into the phase.

---

## Second round — areas surfaced after the first four

User chose "Explore more gray areas" over "I'm ready for context", on the basis that READ-05 and READ-03 were undecided and READ-05 is where a wrong guess costs a rebuild.

### Q: How does "edit the passage myself" work? (READ-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Edit the block in place, text only | Patches one block via content-patch with `ifRevisionID`; no structural ops on this surface | ✓ |
| Keep the deep-link to `SectionEditorPanel` | Zero new code; teleports the editor into a block form — a direct READ-05 failure | |
| Edit in place plus a link out for structural work | More coverage; a second editing surface and a door back into the old console mid-read | |

### Q: How does an in-place edit save?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Save / Cancel per block | Visible dirty state; 409s have an obvious owner and retry | ✓ |
| Save on blur | Fewer clicks; a stray click commits a half-typed sentence | |
| Debounced autosave | Nothing lost; fights the revision guard continuously | |

### Q: Where does evidence render? (READ-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Mount the shared `ClaimProvenanceCard` inside the popover | Honours Phase 42 D-09; evidence read in the paragraph | ✓ |
| Summary inline, full card via Inspect | Lighter popover; evidence then happens outside the paragraph | |
| Evidence only for claim marks, not findings | Simplest; leaves READ-03's "and its evidence" unsatisfied for factual findings | |

**Notes:** flagged Pitfall 5 — the popover is phrasing content, so the card may need a phrasing-safe rendering mode.

### Q: What renders while loading vs not-generated vs clean?

| Option | Description | Selected |
|--------|-------------|----------|
| Three visibly different renders | Skeleton / WSP-07 Editor's-note / prose with an explicit "no open findings" line | ✓ |
| Skeleton, then prose | Fewer branches; empty and clean look identical — the HOME-09 ambiguity | |
| Optimistic render, marks appear as they load | Fastest perceived load; shows a finished-looking page that isn't | |

---

## Third round

### Q: Does `PassageToolbar` belong on the reading surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it, wired to the same actions | Selection-triggered so costs nothing while reading; already mounted inside `Galley` | ✓ |
| Reduced action set | Quieter; removes capability for no requirement's sake | |
| Suppress entirely | Purest; silently drops the Phase 45 revision flow from where editors now live | |

### Q: Ready for context?

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | Remaining unknowns are research/planning work, not user decisions | ✓ |
| Explore more gray areas | Responsive measure, mid-flight streaming, bonus variants | |

---

## Claude's Discretion

- Exact popover markup within the phrasing-content constraint
- In-place block editor implementation (textarea vs contenteditable), focus and keyboard handling
- Visual design of the Fact / Voice / Source tags within 1c tokens
- Responsive behaviour of the 760px measure
- Test strategy and file layout
- Whether group-accept shows a confirmation or preview

## Decided by analysis (not put to the user)

- No Phase 49 role gate applies — accept-fix, dismiss and edit-text are none of the six gated actions
- Review Desk, Voice Pass and all other v4.0 routes are not modified
- `useReviewedSections` is deleted (already locked at milestone level)

## Deferred Ideas

- Phase 52: table of contents, publish footer, and the `/` route conflict
- Phase 53: `/admin/*` relocation
- Phase 54: archive by title
- Later milestone: retiring v4.0 routes
- Backend-requiring: ambiguous-span apply-to-all-occurrences; server-side batch accept endpoint
- Out of v5.0: multi-writer / non-charity topics
- Undiscussed, left to research: responsive measure, mid-flight section streaming, bonus variants
