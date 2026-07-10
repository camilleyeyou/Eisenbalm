# Prompt Lab — Nomenclature Proposal

*July 7, 2026 · rename map + microcopy, ready for the developer. Principle: name things by what the editor does with them, not by how the system implements them. Register: newsroom, matching the "bold anti-SaaS magazine" direction.*

## The four asset groups

| Current | Proposed | One-line descriptor (shown under the group header) |
|---|---|---|
| Agent system prompts | **Job Descriptions** | Who each agent is and the rules it never breaks. Edit these to change judgment and behavior. |
| User templates | **Assignment Memos** | The note each agent gets every run, carrying that week's data. Plumbing — edit only to change what an agent is handed. |
| Section guidance | **Section Briefs** | The standing brief for each section of the issue: its job, its length, what it owns, what it must not do. |
| Shared assets | **House Rules** | Law that many prompts inherit. Edit once, everyone obeys — the most powerful lever on this page. |

Rationale: "system prompt" vs "user template" is an API distinction no editor should need. "Job description vs. assignment memo" carries the same distinction in plain terms: permanent identity vs. this week's envelope.

## The Test run panel — rename to **Rehearsal**

"Test run" sounds like it might run the pipeline (it doesn't). "Rehearsal" says exactly what it is: the draft performs before it goes on stage.

| Current | Proposed | Descriptor |
|---|---|---|
| Canned fixture | **Sample week** | Runs the draft on a stored example input. Quick smoke test. |
| Manual variables | **Your own input** | You supply the values — paste a real dossier or candidate list and see what the draft does with it. |
| Prior-real input | **Replay a real run** | The exact input this agent received in a past run. Same input, new prompt — any difference is your edit. The gold standard. |
| Compare against active | **Draft vs. live** | Runs both on the same input, side by side. Answers: did my edit help? |
| Assembled preview (sample values) | **What the agent sees** | The final assembled text — your prompt plus filled variables — exactly as the model receives it. |

## Versioning controls

| Current | Proposed | Why |
|---|---|---|
| Save as new version | **Save draft as v(n)** | Fine as is; keep. |
| Activate | **Make live** | "Activate" is neutral; "Make live" says stakes. The active badge becomes **LIVE**. |
| Rollback to this version | **Restore this version** | "Rollback" reads as undo-with-loss; nothing is ever lost here. |
| Note (optional) "What changed and why" | keep, but make it **required** | The notes are the institutional memory; optional notes go blank. |
| "edited since seed" badge | **edited since launch** | "Seed" is a developer word. |
| Drift only (filter) | **Edits only** | Shows assets changed from their originals. |
| "Resolve unknown variables before saving" | **"{token} isn't supplied by the pipeline — remove it or ask your developer to wire it"** | Says what to do, not just what's wrong. |

## Agent display names (optional second layer)

Keep slugs for the code; add human titles in the UI list. The two Editors are the biggest confusion today:

| Slug | Display name |
|---|---|
| editor_gate1 | **Editor — Picks the Winner** |
| editor_final | **Editor — Publish Brief** |
| scout | Scout — Finds Candidates |
| advocate | Advocate — Argues the Case |
| researcher | Researcher — Builds the Dossier |
| calibrator | Calibrator — Sets the Week's Style |
| game | Game Writer |
| bonus_* | Bonus Writer — Jingle / Spec Ad / Big Budget |
| rubric | QA Judge's Rubric |
| voice_constraints | The Voice (House Style) |

## Page order (secondary suggestion)

List groups in pipeline order of editing frequency, not alphabetically: House Rules first (highest leverage), then Job Descriptions, Section Briefs, and Assignment Memos last (plumbing, rarely touched). The current order buries the most powerful assets at the bottom of the page.
