# Editing Agent Prompts

The system prompts that drive the nine pipeline agents live in flat Markdown files. You can change what the agents write — tone, structure, focus — by editing these files directly. No code changes, no redeployment of the Python pipeline.

## Where the files live

```
packages/pipeline/prompts/
  scout.md              ← how Scout finds charities
  advocate.md           ← how Advocate scores them
  researcher.md         ← how Researcher writes background
  calibrator.md         ← voice rules + bonus type selection
  editor.md             ← how Editor picks the winning charity
  editor-final.md       ← how Editor reviews section drafts
  game.md               ← the HTML/JS game
  bonus-big-budget.md   ← big-budget ad branch
  bonus-jingle.md       ← jingle branch
  bonus-spec-ad.md      ← spec ad branch
  design.md             ← theme colors and fonts
```

## How to make a change

1. Open the file you want to edit.
2. Find the `<!-- PROMPT START -->` line and the `<!-- PROMPT END -->` line.
3. Edit only the text between those two markers.
4. Make the exact same change in the matching file at `packages/pipeline/src/eisenbalm_pipeline/prompts/<same-name>.md`.
5. Commit both files.

The pipeline reads the files on every run. No restart or redeploy needed.

## Tokens — leave these alone

Each file may contain tokens like `{VOICE_CONSTRAINTS}` or `{charity_name}`. These are placeholders the pipeline replaces with live data at run time. A comment near the top of each file lists which tokens it uses.

Do not rename or delete tokens. If a token is missing from the file, the pipeline will substitute an empty string and the affected constraint will be silently dropped.

## What is safe to change

- Sentence phrasing and word choice
- Adding, removing, or reordering instructions
- Tightening or expanding length guidance (e.g., "200-400 words")

## What is not safe to change

- The `<!-- PROMPT START -->` / `<!-- PROMPT END -->` markers
- Token names and placement
- The `voice.py` file — that file controls Jesse's core voice constants and is off-limits for direct editing

## Chronicler is not here

The Chronicler agent composes its prompt dynamically from the active narrator's voice block, optional rubric, and example samples. It does not use a flat file. To adjust Chronicler behavior, update the narrator profile in Sanity Studio under Agent Profiles.

## Testing after a change

Run the test suite from `packages/pipeline` to confirm the pipeline still assembles correctly:

```
cd packages/pipeline
uv run pytest -q
```

All 229 tests should pass. Skips are expected (integration tests that require live API keys).
