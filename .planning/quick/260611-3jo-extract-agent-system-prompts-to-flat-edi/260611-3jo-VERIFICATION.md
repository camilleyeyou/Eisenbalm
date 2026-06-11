---
phase: quick-260611-3jo
verified: 2026-06-11T10:30:00Z
status: human_needed
score: 6/7 must-haves verified
human_verification:
  - test: "Confirm the Andrew-facing docs (prompts/README.md and apps/studio/PROMPT_EDITING_GUIDE.md) are sufficient as a non-technical editing guide"
    expected: "A non-technical editor (Andrew) can open GitHub, navigate to packages/pipeline/prompts/, edit a file in the browser UI, open a PR, and know to assign Ghislain — all from reading one of these docs"
    why_human: "Both docs describe a local commit workflow (clone, edit, commit both files) rather than GitHub's web editor (pencil icon, commit to new branch, open PR). The plan required the GitHub web-editor flow and a 'ping Ghislain' escalation. Neither phrase 'Ghislain' nor GitHub web-editor instructions appear in either doc. Functionally the docs are correct; the question is whether Andrew can act on them without CLI access."
---

# Quick Task 260611-3jo: Extract Agent System Prompts Verification Report

**Task Goal:** Extract agent system prompts into flat, human-editable files + a loader so a non-technical editor can edit prompts via GitHub PRs — a behavior-preserving refactor (zero prompt-wording change; full pytest suite green).
**Verified:** 2026-06-11T10:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Each in-scope agent loads system prose from a flat `prompts/<id>.md` file at runtime | VERIFIED | All 9 agents import and call `load_prompt(...)` with `.replace(...)` token substitution; confirmed via grep in scout, advocate, researcher, calibrator, editor, editor-final, game, bonus (3 branches), design |
| 2 | Every agent's assembled system message is byte-identical to the pre-refactor string (full pytest suite green) | VERIFIED | `uv run pytest -q` → 229 passed, 33 skipped (pre-existing integration skips), 6 warnings — zero failures |
| 3 | lib/voice.py / VOICE_CONSTRAINTS is untouched; agents still inject voice in Python | VERIFIED | `git diff cfb972c HEAD -- packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` → 0 bytes diff; `qa/judge.py` diff also 0 bytes |
| 4 | prompts/ ships with the wheel and resolves on Railway without depending on cwd | VERIFIED | `pyproject.toml` line 39-40: `[tool.hatch.build.targets.wheel.force-include]` `"prompts" = "eisenbalm_pipeline/prompts"`; loader uses `importlib.resources files("eisenbalm_pipeline")` as primary with `__file__`-relative repo fallback; no `os.getcwd()` call |
| 5 | Narrative writers (origin_story/problem/founder_bio/case_study) have no prompt files and are untouched | VERIFIED | `git diff cfb972c HEAD -- packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py [...case_study.py]` → 0 bytes diff; no `.md` files created for them |
| 6 | Chronicler either extracted cleanly or left code-only with documented rationale | VERIFIED | Chronicler not rewired (`grep load_prompt chronicler.py` → 0 hits); rationale documented in SUMMARY.md ("_build_system_prompt() branches on narrator presence — 4 probe states diverged — out of scope"); PROMPT_EDITING_GUIDE.md has dedicated "Chronicler is not here" section |
| 7 | Non-technical editor has a plain-voice guide with GitHub-edit + PR-to-Ghislain flow and {token} rule | PARTIAL | Both docs exist and explain the token rule and editing region convention. Missing: GitHub web-editor flow (pencil icon, "Create a new branch and start a pull request" UI), and "ping Ghislain" escalation. Both docs assume CLI/local clone access. |

**Score:** 6/7 truths fully verified; truth 7 is partial.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py` | `load_prompt(name)` via importlib.resources | VERIFIED | `def load_prompt` present; uses `files("eisenbalm_pipeline").joinpath("prompts", f"{name}.md")`; fallback to repo-relative `__file__` path; no cwd |
| `packages/pipeline/prompts/scout.md` | Scout prose with `{featured_keys}` + header | VERIFIED | File present; `{featured_keys}` on line 12; do-not-delete comment header present |
| `packages/pipeline/src/eisenbalm_pipeline/prompts/` (all 11) | In-package copies identical to Andrew-facing | VERIFIED | All 11 files present; `diff` against all Andrew-facing counterparts → IDENTICAL for every pair |
| `packages/pipeline/prompts/README.md` | Token rule + editing guidance | VERIFIED | File present; token rule documented ("do not rename or delete tokens"); editing region markers explained; `<!-- PROMPT START/END -->` convention documented |
| `apps/studio/PROMPT_EDITING_GUIDE.md` | Andrew-facing guide | PARTIAL | File present; token rule and editing flow covered; missing GitHub web-editor path and Ghislain escalation |
| `packages/pipeline/pyproject.toml` | force-include ships prompts/ in wheel | VERIFIED | `[tool.hatch.build.targets.wheel.force-include]` `"prompts" = "eisenbalm_pipeline/prompts"` on lines 39-40 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `agents/scout.py` | `prompts/scout.md` | `load_prompt('scout').replace("{featured_keys}", ...)` | WIRED | Line 192 confirmed |
| `agents/advocate.py` | `prompts/advocate.md` | `load_prompt("advocate")` (static, no tokens) | WIRED | Line 67 confirmed |
| `agents/calibrator.py` | `prompts/calibrator.md` | `load_prompt("calibrator")` + 4 `.replace()` calls | WIRED | Lines 109-113 confirmed |
| `agents/editor.py` | `prompts/editor.md` + `prompts/editor-final.md` | `load_prompt("editor")` + `load_prompt("editor-final")` | WIRED | Lines 194, 440 confirmed |
| `agents/researcher.py` | `prompts/researcher.md` | `load_prompt("researcher").replace("{VOICE_CONSTRAINTS}", ...)` | WIRED | Line 85 confirmed |
| `agents/game.py` | `prompts/game.md` | `load_prompt("game")` + 3 `.replace()` calls | WIRED | Lines 61-64 confirmed |
| `agents/bonus.py` | `prompts/bonus-*.md` (3 branches) | separate `load_prompt()` per branch + `.replace()` | WIRED | Lines 130, 144, 159-161 confirmed |
| `agents/design/__init__.py` | `prompts/design.md` | `load_prompt("design")` + 2 `.replace()` calls | WIRED | Lines 99-101 confirmed |
| `lib/prompts.py` | `packages/pipeline/prompts/` | `importlib.resources files("eisenbalm_pipeline")` + `__file__` fallback | WIRED | Both resolution paths confirmed; no cwd usage |

### Data-Flow Trace (Level 4)

Not applicable — this is a refactor of Python string generation, not a UI rendering pipeline. The pytest suite's byte-equivalence assertions serve as the equivalent correctness gate.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full pytest suite green | `cd packages/pipeline && uv run pytest -q` | 229 passed, 33 skipped, 6 warnings | PASS |
| prompts/ in pyproject force-include | `grep -n "prompts" packages/pipeline/pyproject.toml` | Lines 39-40: force-include entry present | PASS |
| All 11 in-package copies match Andrew-facing copies | `diff` across all 11 pairs | IDENTICAL for all 11 | PASS |
| No cwd-based resolution in loader | `grep "os.getcwd()" lib/prompts.py` | No matches | PASS |
| chronicler not rewired | `grep load_prompt agents/chronicler.py` | 0 hits | PASS |
| voice.py/judge.py untouched | `git diff cfb972c HEAD -- voice.py judge.py` | 0 bytes diff each | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PROMPT-EXTRACT-01 | 260611-3jo-PLAN.md | 11 prompt .md files with do-not-delete headers and verbatim prose | SATISFIED | All 11 files in both locations; headers confirmed in calibrator.md spot-check |
| PROMPT-LOADER-02 | 260611-3jo-PLAN.md | `load_prompt(name)` via importlib.resources, no cwd | SATISFIED | prompts.py confirmed; Railway-safe dual-resolution implemented |
| PROMPT-PACKAGING-03 | 260611-3jo-PLAN.md | prompts/ ships in wheel | SATISFIED | pyproject.toml force-include confirmed |
| PROMPT-DOCS-04 | 260611-3jo-PLAN.md | Plain-voice Andrew guide with GitHub web-editor flow, {token} rule, PR/Ghislain handoff | PARTIAL | Token rule present; GitHub pencil-icon flow and Ghislain escalation absent from both docs |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/pipeline/prompts/README.md` | 51-58 | Two-copy maintenance burden documented as manual ("edit one, copy to other") | Warning | Not a code bug; architectural debt from dual-location decision. The plan never specified dual-copy — it expected one canonical location. A future edit to Andrew-facing prompts that doesn't update the in-package copy would silently use stale text on Railway. |

### Human Verification Required

#### 1. Confirm docs are sufficient for a non-technical editor

**Test:** Have Andrew (or simulate) navigate to `packages/pipeline/prompts/` on GitHub.com, open `scout.md` in the web browser, attempt to edit using GitHub's built-in pencil icon, and follow the docs to complete a PR.

**Expected:** Andrew can complete the workflow without CLI access, knows not to delete `{featured_keys}`, and knows to assign or message Ghislain before the PR is merged.

**Why human:** The docs currently describe a local clone-edit-commit workflow. The plan explicitly required the GitHub web-editor flow ("navigate to packages/pipeline/prompts/, click a file, click the pencil icon, edit, 'Commit changes' → 'Create a new branch and start a pull request'") and a "Ping Ghislain" escalation. Whether Andrew can succeed without those specific instructions depends on Andrew's GitHub familiarity — a human judgment call, not a grep check.

### Gaps Summary

The refactor is functionally complete and behavior-preserving. The test suite is green, all 9 in-scope agents are rewired, voice.py and judge.py are untouched, packaging is correct, and the chronicler skip is documented.

The one gap is editorial: both Andrew-facing docs (`prompts/README.md` and `apps/studio/PROMPT_EDITING_GUIDE.md`) explain the editing convention and token rule but assume CLI/local-clone access. They don't include the GitHub web-editor flow the plan specified (pencil icon, branch+PR UI), and neither mentions Ghislain as the reviewer to assign. The fix is a 5-line addition to either doc — no code change required.

There is also an architectural note worth tracking: the dual-copy design (Andrew-facing `packages/pipeline/prompts/` + in-package `src/eisenbalm_pipeline/prompts/`) requires manual synchronization. The README documents this as manual with a note that automation is planned. This is an accepted deviation from the plan (the plan assumed a single canonical location) but creates a future edit-drift risk if Andrew edits the Andrew-facing copy and the sync to `src/` is skipped.

---

_Verified: 2026-06-11T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
