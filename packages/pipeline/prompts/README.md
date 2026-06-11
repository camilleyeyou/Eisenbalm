# Agent Prompts

This folder contains the system prompts for each pipeline agent. You can edit the prose inside any file here to adjust how the agents write. The pipeline reads these files every time it runs, so a change here is live on the next run — no code deploy needed.

## How to edit a prompt

Open the file you want to change. The editable region is clearly marked:

```
<!-- PROMPT START -->
... the actual prompt text ...
<!-- PROMPT END -->
```

Edit only the text between those two markers. Everything outside them is a comment for your reference and is ignored by the pipeline.

## Files in this folder

| File | Agent | What it controls |
|------|-------|-----------------|
| `scout.md` | Scout | How Scout finds and describes obscure charities |
| `advocate.md` | Advocate | How Advocate scores and argues for each charity |
| `researcher.md` | Researcher | How Researcher gathers and organises background on the winning charity |
| `calibrator.md` | Calibrator | Voice rules and bonus type selection for the issue |
| `editor.md` | Editor (gate-1) | How Editor weighs candidates and makes the charity selection |
| `editor-final.md` | Editor Final | How Editor reviews and finalises section drafts |
| `game.md` | GameWriter | How the HTML/JS game is written |
| `bonus-big-budget.md` | BonusWriter (Big Budget) | The big-budget cinematic ad branch |
| `bonus-jingle.md` | BonusWriter (Jingle) | The jingle branch |
| `bonus-spec-ad.md` | BonusWriter (Spec Ad) | The spec ad branch |
| `design.md` | DesignAgent | How the theme colors and fonts are chosen |

## Tokens (do not delete these)

Some prompts contain tokens like `{VOICE_CONSTRAINTS}` or `{charity_name}`. These are filled in automatically by the pipeline at run time. If you delete a token the pipeline will inject a blank string in its place, which will silently break voice enforcement or inject the wrong value.

Each file lists its tokens in a comment at the top, above the `<!-- PROMPT START -->` marker. Check that comment before editing.

## What you can safely change

- Phrasing, word choice, sentence structure inside the marked region
- Adding or removing instructions that do not reference the tokens
- Reordering paragraphs

## What you should not change

- The `<!-- PROMPT START -->` and `<!-- PROMPT END -->` markers
- Token names (`{VOICE_CONSTRAINTS}`, `{charity_name}`, etc.)
- The files in `src/eisenbalm_pipeline/prompts/` — those are copies the package uses internally and must stay in sync. If you edit a file here in `packages/pipeline/prompts/`, make the same edit in the matching file at `packages/pipeline/src/eisenbalm_pipeline/prompts/`.

## Keeping the two copies in sync

Every prompt lives in two places:

1. `packages/pipeline/prompts/<name>.md` — this folder, Andrew-facing
2. `packages/pipeline/src/eisenbalm_pipeline/prompts/<name>.md` — in-package copy

They are identical. When you edit one, copy the change to the other. The plan is to automate this sync in a future build step, but for now it is a manual two-file edit.
