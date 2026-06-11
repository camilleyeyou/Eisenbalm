# Editing Agent Prompts — A Guide for Andrew

The words that drive each AI agent live in plain text files on GitHub. You can adjust what the agents write — tone, focus, how they approach a task — by editing those files directly in your browser. No code changes, no terminal.

## Where the files are

Open this folder on GitHub to see all the editable prompts:

**`packages/pipeline/src/eisenbalm_pipeline/prompts/`**

You'll see one `.md` file per agent:

| File | What it controls |
|------|-----------------|
| `scout.md` | How Scout finds and describes obscure charities |
| `advocate.md` | How Advocate scores and argues for each charity |
| `researcher.md` | How Researcher gathers background on the winning charity |
| `calibrator.md` | Voice rules and bonus type selection for the issue |
| `editor.md` | How Editor weighs the candidates and picks a winner |
| `editor-final.md` | How Editor reviews the section drafts |
| `game.md` | How the HTML/JS game is written |
| `bonus-big-budget.md` | The big-budget cinematic ad branch |
| `bonus-jingle.md` | The jingle branch |
| `bonus-spec-ad.md` | The spec ad branch |
| `design.md` | How the theme colors and fonts are chosen |

## How to make a change

1. Click the file you want to edit.
2. Click the **pencil icon** (Edit this file) in the top-right corner of the file view.
3. Find the line that reads `<!-- PROMPT START -->` and the line that reads `<!-- PROMPT END -->`.
4. Edit only the text between those two markers. Everything above `<!-- PROMPT START -->` is a note for reference — the pipeline ignores it.
5. When you're done, scroll to the bottom of the page.
6. Under **"Commit changes"**, write a short description of what you changed.
7. Select **"Create a new branch and start a pull request"** (not "Commit directly to master").
8. Click **"Propose changes"**, then on the next screen click **"Create pull request"**.
9. In the pull request, add **Ghislain** as a reviewer (there's a "Reviewers" panel on the right side).
10. Submit the PR and ping Ghislain to take a look.

Ghislain will review and merge it. Nothing changes until he merges — so there's no risk in opening a PR. Once merged, the new wording goes live on the next pipeline run.

## Tokens — never delete these

Some files contain placeholders like `{VOICE_CONSTRAINTS}` or `{charity_name}`. These get filled in automatically by the pipeline at run time with live data. If you accidentally delete one, the pipeline will substitute a blank string and that piece of information will silently disappear from the agent's instructions.

Each file has a short comment near the top (above `<!-- PROMPT START -->`) listing which tokens it uses. Check that comment before editing around them.

Safe to change:
- Sentence phrasing and word choice
- Adding, removing, or reordering instructions
- Length guidance ("200–400 words", "three paragraphs", etc.)

Not safe to change:
- The `<!-- PROMPT START -->` and `<!-- PROMPT END -->` lines themselves
- Token names and their placement

## What is not in these files

A few things are intentionally kept in code rather than here:

- **Jesse's voice** — the core voice constants (dry, precise, absurdly serious) are locked in `voice.py` and enforced by the QA layer. Editing a prompt file can tune emphasis, but it won't override the foundational voice. If you want a voice adjustment that isn't taking effect, that's one for Ghislain.
- **The QA rubric** — the quality-check criteria the pipeline uses to evaluate drafts are in `agents/qa/rubric.md`. They're test-locked and more fragile to change. Ask Ghislain.
- **The Chronicler** — the agent that voices the section narrators composes its prompt dynamically from the active narrator profile in Sanity Studio. It doesn't use a flat file here. To adjust Chronicler behavior, update the narrator's profile in Studio under **Agent Profiles**, or ask Ghislain.

## Stuck?

Anything unclear, or if you want to make a bigger change that touches voice or QA — ping Ghislain. Opening a PR is always safe; nothing goes live until it's reviewed and merged.
