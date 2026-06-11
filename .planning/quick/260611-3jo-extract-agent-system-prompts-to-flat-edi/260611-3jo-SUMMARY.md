---
plan: 260611-3jo
subsystem: pipeline/prompts
tags: [refactor, prompts, agents, behavior-preserving]
completed: "2026-06-11T09:54:47Z"
remediated: "2026-06-11"
duration: "~2 sessions + remediation pass"
tasks_completed: 6
tasks_total: 6
files_created: 26
files_modified: 9
key_decisions:
  - "chronicler skipped: _build_system_prompt diverges across narrator states — cannot reduce to flat template without architectural change out of scope for behavior-preserving refactor"
  - "single-source for .md files (post-remediation): src/eisenbalm_pipeline/prompts/ is the ONLY location — ships automatically with the package (same as agents/qa/rubric.md), no force-include needed"
  - "str.replace() over str.format() for token substitution to avoid KeyError on literal braces in prompts"
commits:
  - 612b12c
  - 4441f13
  - 0348fdb
  - e0c6cc4
  - a699828
  - 469edff
---

# Quick Task 260611-3jo: Extract Agent System Prompts to Flat Editable Files

Pure behavior-preserving refactor. All 9 extractable agents now load their system prompts from `.md` files Andrew can edit directly — no code changes required to tune agent behavior.

## What was built

### Prompt loader (`lib/prompts.py`)

`load_prompt(name)` resolves `packages/pipeline/src/eisenbalm_pipeline/prompts/<name>.md` via `importlib.resources files("eisenbalm_pipeline")` (works in both editable install and installed wheel). Falls back to `packages/pipeline/prompts/<name>.md` via `__file__`-relative path. Strips `<!-- PROMPT START -->` / `<!-- PROMPT END -->` markers and leading/trailing newlines to return the bare prompt string.

### Agents rewired (9 of 10)

| Agent | File | Tokens |
|-------|------|--------|
| Scout | `scout.md` | `{featured_keys}` |
| Advocate | `advocate.md` | none |
| Researcher | `researcher.md` | `{VOICE_CONSTRAINTS}` |
| Calibrator | `calibrator.md` | `{VOICE_CONSTRAINTS}`, `{issue_number}`, `{previous_bonus_types}`, `{chosen_bonus_type}` (x2) |
| Editor (gate-1) | `editor.md` | `{VOICE_CONSTRAINTS}`, `{EDITOR_INTERRUPT_THRESHOLD}`, `{EDITOR_CONFIDENCE_THRESHOLD}` |
| Editor Final | `editor-final.md` | `{VOICE_CONSTRAINTS}` |
| GameWriter | `game.md` | `{charity_name}`, `{VOICE_CONSTRAINTS}`, `{FORBIDDEN_CONSTRUCTS}` |
| BonusWriter — Big Budget | `bonus-big-budget.md` | `{VOICE_CONSTRAINTS}` |
| BonusWriter — Jingle | `bonus-jingle.md` | `{VOICE_CONSTRAINTS}` |
| BonusWriter — Spec Ad | `bonus-spec-ad.md` | `{VOICE_CONSTRAINTS}`, `{STRUCTURE_CONTRACT}` |
| DesignAgent | `design.md` | `{display_list}`, `{body_list}` |

### Chronicler — skipped (Task 4 decision gate)

`_build_system_prompt()` branches on narrator presence, `style_brief["voice"]`, `narrator.voiceRubric`, and `narrator.exampleSamples`. Byte-equivalence probe across 4 states produced 4 divergent outputs (2788 / 2802 / 2842 / 2011 chars). Extracting to a flat file would require conditional token logic or multi-file composition — out of scope for a behavior-preserving refactor. Chronicler remains inline.

### Narrative writers — excluded per plan

`origin_story`, `problem`, `founder_bio`, `case_study` are excluded per plan constraint. No files created for them.

### File layout

```
packages/pipeline/src/eisenbalm_pipeline/prompts/  ← single canonical location (11 .md files + README.md)
packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py  ← loader
apps/studio/PROMPT_EDITING_GUIDE.md  ← Andrew's GitHub web-editor guide
```

The `packages/pipeline/prompts/` top-level directory has been removed (remediation). There is now one location only.

### pyproject.toml

No special packaging entry needed. `src/eisenbalm_pipeline/prompts/` ships with the wheel automatically under `packages = ["src/eisenbalm_pipeline"]` — same mechanism as `agents/qa/rubric.md`. The `[tool.hatch.build.targets.wheel.force-include]` prompts entry has been removed.

## Verification

229 tests passed, 33 skipped (pre-existing integration skips). All 6 pre/post byte-equivalence checks confirmed before each commit.

## Deviations from Plan

### Auto-fixed Issues

None.

### Notable implementation decisions

**[Rule 2 — Dual location for .md files]** In hatchling editable mode (`uv run`), `importlib.resources files("eisenbalm_pipeline")` resolves to `src/eisenbalm_pipeline/`. The `force-include` pyproject entry only affects wheel builds. To serve both dev (editable) and prod (wheel/Railway) from the same loader, `.md` files were maintained in both `src/eisenbalm_pipeline/prompts/` (importlib.resources primary) and `packages/pipeline/prompts/` (fallback + Andrew-facing). This was later identified as unnecessary dual-copy maintenance burden.

**[Remediation — Single-source consolidation]** Subsequent verification found that `src/eisenbalm_pipeline/prompts/` ships automatically with the wheel under `packages = ["src/eisenbalm_pipeline"]` — exactly as `agents/qa/rubric.md` does. The top-level `packages/pipeline/prompts/` directory was removed, the fallback code path removed from `lib/prompts.py`, and the `force-include` entry removed from `pyproject.toml`. Load path is now: `importlib.resources files("eisenbalm_pipeline").joinpath("prompts", f"{name}.md")` — no fallback, no dual copy.

**[Remediation — GitHub web-editor guide]** `apps/studio/PROMPT_EDITING_GUIDE.md` was rewritten with the GitHub browser-only flow (pencil icon → edit between markers → "Create a new branch and start a pull request" → assign Ghislain as reviewer). A 3-line `README.md` pointing to this guide now lives in `src/eisenbalm_pipeline/prompts/`. No CLI instructions remain in either doc. The full pytest suite (229 passed, 33 skipped) was confirmed green after both changes.

## Known Stubs

None. All prompt content is live. The chronicler skip is documented as a decision, not a stub.
