"""Single source of truth for Phase 5 model identity, sampling, token caps.

D-05: tiered model selection (Opus voice-critical, Sonnet writers, Haiku mechanical).
D-06: pin voice-critical IDs verbatim; section writers + mechanical use aliases.
D-07: per-agent sampling defaults.
RESEARCH §"OpenRouter Client Architecture": MAX_TOKENS_BY_AGENT.

Phase 5 agents never hardcode their own model ID or temperature — every value
in this module is the only place to edit when (e.g.) OpenRouter retires
``anthropic/claude-opus-4-7`` or Andrew wants to tune temperature.
"""
from __future__ import annotations

# D-06: voice-critical pin. Replace with whichever Opus snapshot OpenRouter
# actually resolves; the resolved model is captured into modelVersions at
# call time (AGT-17) so observability survives pin retirement.
MODEL_PIN_VOICE_CRITICAL = "anthropic/claude-opus-4-7"

# D-05: 14 agent_ids → 3 tiers (Opus / Sonnet / Haiku).
# Keys MUST match the agent_id used in @agent_node(name=...) and the Sanity
# agentProfile.agentId seeds (Phase 1 D-17).
MODEL_BY_AGENT: dict[str, str] = {
    # Voice-critical (Opus, pinned).
    "calibrator":   MODEL_PIN_VOICE_CRITICAL,
    "editor_gate1": MODEL_PIN_VOICE_CRITICAL,
    "editor_final": MODEL_PIN_VOICE_CRITICAL,
    "qa":           MODEL_PIN_VOICE_CRITICAL,
    # Section writers (Sonnet, latest-stable alias).
    "researcher":   "anthropic/claude-sonnet-4-6",
    "origin_story": "anthropic/claude-sonnet-4-6",
    "problem":      "anthropic/claude-sonnet-4-6",
    "founder_bio":  "anthropic/claude-sonnet-4-6",
    "case_study":   "anthropic/claude-sonnet-4-6",
    "bonus":        "anthropic/claude-sonnet-4-6",
    "game":         "anthropic/claude-sonnet-4-6",
    # Mechanical (Haiku, latest-stable alias).
    "scout":    "anthropic/claude-haiku-4-5",
    "advocate": "anthropic/claude-haiku-4-5",
    "design":   "anthropic/claude-haiku-4-5",
}

# D-07: temperature + top_p per agent. Voice-critical low; writers higher.
SAMPLING_BY_AGENT: dict[str, dict] = {
    "calibrator":   {"temperature": 0.2, "top_p": 1.0},
    "editor_gate1": {"temperature": 0.2, "top_p": 1.0},
    "editor_final": {"temperature": 0.2, "top_p": 1.0},
    "qa":           {"temperature": 0.2, "top_p": 1.0},
    "researcher":   {"temperature": 0.3, "top_p": 1.0},
    "scout":        {"temperature": 0.3},
    "advocate":     {"temperature": 0.3},
    "design":       {"temperature": 0.4},
    "origin_story": {"temperature": 0.7, "top_p": 1.0},
    "problem":      {"temperature": 0.7, "top_p": 1.0},
    "founder_bio":  {"temperature": 0.7, "top_p": 1.0},
    "case_study":   {"temperature": 0.7, "top_p": 1.0},
    "bonus":        {"temperature": 0.7, "top_p": 1.0},
    "game":         {"temperature": 0.7, "top_p": 1.0},
}

# RESEARCH §"OpenRouter Client Architecture": per-agent max_tokens for the
# tool-using factual agents. Other agents accept OpenRouter's default cap.
MAX_TOKENS_BY_AGENT: dict[str, int] = {
    "scout":      12_000,
    "researcher": 20_000,
}
