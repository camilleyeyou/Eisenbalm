"""Phase 5 QA Layer-1 predicate tests — Plan 05-13. Validation: AGT-15.

Each predicate emits ``QAFinding`` with ``severity='error'`` and an axis tag.
Tests cover the five hard-rule axes:
  - gravity        (exclamation marks, AI self-reference)
  - sentiment      (forbidden keyword list)
  - irony-signaling (winking constructions)
  - precision      (unverified founder/subject name leakage)
  - aggregate      (run_all_predicates fan-out + clean-text baseline)
"""
from __future__ import annotations

from eisenbalm_pipeline.agents.qa.rules import (
    QAFinding,
    check_ai_reference,
    check_exclamation_marks,
    check_sentiment_keywords,
    check_unverified_name,
    check_winking,
    run_all_predicates,
)


def test_exclamation_marks_caught() -> None:
    findings = check_exclamation_marks("origin_story", "Hello world!")
    assert len(findings) == 1
    assert findings[0].severity == "error"
    assert findings[0].axis == "gravity"
    assert findings[0].section == "origin_story"


def test_multiple_exclamations_caught() -> None:
    findings = check_exclamation_marks("origin_story", "Wow! Amazing! Great!")
    assert len(findings) == 3


def test_no_exclamation_no_findings() -> None:
    findings = check_exclamation_marks("origin_story", "A measured paragraph.")
    assert findings == []


def test_sentiment_keywords_caught() -> None:
    findings = check_sentiment_keywords("problem", "this is truly heartwarming work")
    # 'truly' AND 'heartwarming' both match the keyword list.
    assert len(findings) >= 2
    assert all(f.severity == "error" and f.axis == "sentiment" for f in findings)


def test_sentiment_passing_text_no_findings() -> None:
    findings = check_sentiment_keywords(
        "problem",
        "Founded in 2003 by a former actuary. Operates without endowment.",
    )
    assert findings == []


def test_winking_caught() -> None:
    findings = check_winking("bonus", "an organization, if you can call it that")
    assert len(findings) == 1
    assert findings[0].axis == "irony-signaling"


def test_ai_reference_caught() -> None:
    findings = check_ai_reference("origin_story", "as an AI, I find this fascinating")
    assert len(findings) >= 1
    assert findings[0].axis == "gravity"


def test_unverified_founder_name_caught() -> None:
    """AGT-10 backstop: Layer 1 catches founderName leak when verified=False."""
    research = {
        "founderName": "Jane Doe",
        "founderNameVerified": False,
    }
    findings = check_unverified_name(
        "founder_bio", "Jane has led this work since 2003", research,
    )
    assert len(findings) == 1
    assert findings[0].axis == "precision"


def test_unverified_subject_name_caught() -> None:
    research = {
        "subjectName": "Alex Park",
        "subjectNameVerified": False,
    }
    findings = check_unverified_name(
        "case_study", "Alex came to the program in 2019", research,
    )
    assert len(findings) == 1
    assert findings[0].axis == "precision"


def test_verified_name_not_flagged() -> None:
    research = {
        "founderName": "Jane Doe",
        "founderNameVerified": True,
    }
    findings = check_unverified_name("founder_bio", "Jane led the work...", research)
    assert findings == []


def test_unverified_name_other_section_ignored() -> None:
    """check_unverified_name is scoped to founder_bio / case_study only."""
    research = {
        "founderName": "Jane Doe",
        "founderNameVerified": False,
    }
    findings = check_unverified_name(
        "origin_story", "Jane led the work since 2003", research,
    )
    assert findings == []


def test_run_all_predicates_aggregates() -> None:
    sections = {
        "origin_story": "Truly amazing work! They built this incredible thing.",
    }
    research: dict = {}
    findings = run_all_predicates(sections, research)
    # 'Truly', 'amazing', 'incredible' (sentiment) + 1 exclamation = >=3
    assert len(findings) >= 3
    sections_seen = {f.section for f in findings}
    assert sections_seen == {"origin_story"}


def test_passing_text_yields_no_findings() -> None:
    """Baseline integrity: a clean, Jesse-voice paragraph trips no predicate."""
    sections = {
        "origin_story": (
            "The organization was founded in 2003 by a former actuary. "
            "Its mission is narrow and its endowment is modest."
        ),
    }
    findings = run_all_predicates(sections, {})
    assert findings == []


def test_qa_finding_namedtuple_fields() -> None:
    """QAFinding shape must carry the six fields the orchestrator writes
    to Convex qaCorrections:insert (sectionName, severity, axis, quotedSpan,
    reason, suggestedFix). The Convex `sectionName` field is derived from
    QAFinding.section in agents/qa.py.
    """
    f = QAFinding(
        section="origin_story", severity="error", axis="gravity",
        quotedSpan="!", reason="r", suggestedFix="s",
    )
    assert f.section == "origin_story"
    assert f.severity == "error"
    assert f.axis == "gravity"
