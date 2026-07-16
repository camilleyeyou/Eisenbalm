"""Phase 24 (PRM-01 / PRM-06) — config_loader asset-infra tests.

Exercises the newly-externalized asset surface added in Plan 24-03:
  - RunConfig gains voice_constraints / user_templates / section_guidance / rubric
  - New agentKey registries (USER_TEMPLATE_KEYS / SECTION_GUIDANCE_KEYS /
    SINGLETON_ASSET_KEYS) are declared once in config_loader.
  - _build_fallback_config() stays raise-free even when the new asset .md seed
    files are absent (they land in Plans 04/05/06).

Imports are guarded inside test bodies so the file collects cleanly regardless
of import-time state.

Source: .planning/phases/24-prompt-editor-versioning/24-03-...-PLAN.md;
        docs/API_CONTRACTS.md §4A.2b + §7.
"""
from __future__ import annotations


def test_runconfig_has_asset_fields() -> None:
    """PRM-01/PRM-06: RunConfig constructs with sensible asset defaults."""
    from eisenbalm_pipeline.lib.config_loader import RunConfig

    r = RunConfig(
        workspace_id="x",
        agents={},
        require_review=True,
        auto_publish=False,
        schedule_enabled=False,
    )
    assert r.voice_constraints is None
    assert r.rubric is None
    assert r.user_templates == {}
    assert r.section_guidance == {}


def test_asset_registries_counts() -> None:
    """The canonical new-key registries have the contracted cardinalities."""
    from eisenbalm_pipeline.lib.config_loader import (
        SECTION_GUIDANCE_KEYS,
        SINGLETON_ASSET_KEYS,
        USER_TEMPLATE_KEYS,
    )

    # 11 Phase 24 originals + Phase 46's signal_editor_user (SGE-01/D-18).
    assert len(USER_TEMPLATE_KEYS) == 12
    assert len(SECTION_GUIDANCE_KEYS) == 6
    assert len(SINGLETON_ASSET_KEYS) == 2


def test_fallback_config_missing_files_does_not_raise() -> None:
    """Between Wave 2 and Wave 3 the new asset .md files do not exist yet.

    _build_fallback_config() must populate the new asset fields without raising
    FileNotFoundError when load_prompt() cannot find a seed file.
    """
    from eisenbalm_pipeline.lib import config_loader

    config = config_loader._build_fallback_config()

    assert isinstance(config, config_loader.RunConfig)
    assert isinstance(config.user_templates, dict)
    assert isinstance(config.section_guidance, dict)
    # rubric / voice_constraints are Optional[str] — None or a real string.
    assert config.rubric is None or isinstance(config.rubric, str)
    assert config.voice_constraints is None or isinstance(config.voice_constraints, str)
