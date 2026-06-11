"""Loader for agent system-prompt .md files.

Convention (all .md files):
  - An editorial header lives BEFORE the <!-- PROMPT START --> sentinel line.
  - The verbatim template prose (with {token} placeholders) lives between
    <!-- PROMPT START --> and <!-- PROMPT END --> markers.
  - load_prompt() returns EXACTLY the bytes between those two markers,
    with the leading/trailing newline from the markers stripped to match
    the original inline string byte-for-byte.

Resolution strategy (Railway-safe + dev-safe):
  Single location: importlib.resources files("eisenbalm_pipeline").joinpath("prompts", ...)
  — works from an installed wheel (Railway) and from the editable install because
  prompts/ lives inside src/eisenbalm_pipeline/prompts/ (same mechanism as
  agents/qa/rubric.md — no special pyproject packaging needed).
  Never uses os.getcwd() or bare relative paths.

Token substitution pattern (all callers):
    system = load_prompt("scout").replace("{featured_keys}", str(featured_keys))
Use str.replace(), NOT str.format() — safe against any literal braces in prose.
"""
from __future__ import annotations

from importlib.resources import files

_START = "<!-- PROMPT START -->"
_END = "<!-- PROMPT END -->"


def _extract(raw: str, name: str) -> str:
    """Extract prompt content between PROMPT START / PROMPT END markers."""
    start_idx = raw.find(_START)
    end_idx = raw.find(_END)
    if start_idx == -1:
        raise ValueError(f"prompts/{name}.md missing <!-- PROMPT START --> marker")
    if end_idx == -1:
        raise ValueError(f"prompts/{name}.md missing <!-- PROMPT END --> marker")

    content = raw[start_idx + len(_START) : end_idx]
    # Strip exactly one leading newline (the newline after the marker line).
    if content.startswith("\n"):
        content = content[1:]
    # Strip exactly one trailing newline (the newline before the end marker).
    if content.endswith("\n"):
        content = content[:-1]
    return content


def load_prompt(name: str) -> str:
    """Return the raw template text for prompts/<name>.md (UTF-8, verbatim).

    Extracts the content between <!-- PROMPT START --> and <!-- PROMPT END -->
    markers. The returned string is the template with {token} placeholders
    ready for str.replace() substitution — no stripping beyond what the
    marker convention mandates.

    Args:
        name: stem of the prompt file (e.g. "scout" for prompts/scout.md).

    Returns:
        Template string, byte-identical to the pre-refactor inline system
        string when all tokens are substituted back to their original values.

    Raises:
        FileNotFoundError: if src/eisenbalm_pipeline/prompts/<name>.md cannot
            be found via importlib.resources.
        ValueError: if the file is missing the <!-- PROMPT START --> /
            <!-- PROMPT END --> markers.
    """
    path = files("eisenbalm_pipeline").joinpath("prompts", f"{name}.md")
    try:
        raw: str = path.read_text("utf-8")
    except (FileNotFoundError, TypeError) as exc:
        raise FileNotFoundError(
            f"prompts/{name}.md not found in eisenbalm_pipeline package data "
            f"(src/eisenbalm_pipeline/prompts/{name}.md)"
        ) from exc
    return _extract(raw, name)
