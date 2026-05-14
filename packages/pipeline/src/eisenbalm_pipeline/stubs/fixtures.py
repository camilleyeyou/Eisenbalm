"""Deterministic stub fixtures for Phase 4 (CONTEXT D-16).

Each function returns the FIELDS THIS AGENT WRITES (not the full state) —
LangGraph merges them into the running state.

Stub content is Jesse-voice-ish (dry, neutral, no winking) but planner-
discretion per CONTEXT D-16. Phase 5 replaces these with real LLM outputs
through the same @agent_node interface.

The fake charity "The Quiet Foundation" was seeded by Phase 2's demo
content seed (Plan 02-04, Sanity _id = charity-the-quiet-foundation).
Stub Scout reuses it so Phase 4 runs do not pollute the charity database
with new fake entries on every run.

Fixture inventory (Plan 10 parametrizes over this list):

  1.  calibrator_output            -> style_brief (hardcoded bonusType='bigBudget')
  2.  scout_candidates             -> candidates (3 candidates, demo charity first)
  3.  advocate_scored              -> candidates (scored, demo charity wins with 9)
  4.  editor_decision_output       -> editor_decision + runner_up_notes + transcript
  5.  research_output              -> research
  6.  origin_story_output          -> origin_story
  7.  problem_output               -> problem_statement + problem_pdf_content
  8.  founder_bio_output           -> founder_bio
  9.  case_study_output            -> case_study
  10. game_output                  -> game (self-contained HTML embed)
  11. bonus_output                 -> bonus (bigBudget shape per CONTEXT D-16)
  12. design_output                -> theme (valid 6-digit hex + Google fonts)
  13. qa_output                    -> qa_corrections ([] in stub mode)
  14. editor_final_output          -> editor_final_notes
  15. publisher_output              -> sanity_issue_id placeholder

(Editor runs twice in the brief — gate 1 + final — so 15 functions cover
the 14-agent sequence.)
"""
from __future__ import annotations

from typing import Any

# Phase 2 demo charity (CONTEXT D-16 + Phase 02-04 SUMMARY).
QUIET_FOUNDATION_NAME = "The Quiet Foundation"
QUIET_FOUNDATION_SANITY_ID = "charity-the-quiet-foundation"


# ── Calibrator (CONTEXT D-16 hardcoded bonusType='bigBudget') ─────────────

def calibrator_output() -> dict:
    return {
        "style_brief": {
            "voice": (
                "Dry, precise, Fortune 500 gravity. No exclamation marks. "
                "No winking. Charities treated with the seriousness of "
                "publicly-traded companies."
            ),
            "constraints": [
                "Never use 'just' as a hedge.",
                "No sentence starts with 'And' or 'But'.",
                "Numbers cited with sources.",
            ],
            "bonusType": "bigBudget",
            "visualDirection": (
                "Warm cream paper feel; serif display, sans body; "
                "muted ochre accent."
            ),
            "previousBonusTypes": [],
        },
    }


# ── Scout (3 candidates; one is the demo charity) ──────────────────────────

def scout_candidates() -> dict:
    return {
        "candidates": [
            {
                "name": QUIET_FOUNDATION_NAME,
                "location": "Burlington, Vermont",
                "website": "https://example.org/quiet-foundation",
                "charityNavigatorUrl": None,
                "guidestarUrl": None,
                "foundingYear": 1987,
                "assetRange": "$50K-$100K",
                "focusArea": "Library acoustic preservation",
                "missionStatement": (
                    "To preserve and document the acoustic environments of "
                    "America's smallest libraries."
                ),
                "scoutSummary": (
                    "Niche but operationally rigorous; thirty-year record "
                    "of recorded library silences."
                ),
                "whyOverlooked": (
                    "Mission is so specific that mainstream charity "
                    "aggregators treat it as fringe."
                ),
                "advocateArgument": None,
                "advocateScore": None,
            },
            {
                "name": "The Backroad Cartography Trust",
                "location": "Salina, Kansas",
                "website": "https://example.org/backroad",
                "charityNavigatorUrl": None,
                "guidestarUrl": None,
                "foundingYear": 1972,
                "assetRange": "$10K-$50K",
                "focusArea": "Rural roadway mapping",
                "missionStatement": (
                    "To produce and maintain accurate maps of unimproved "
                    "rural roads in the American Midwest."
                ),
                "scoutSummary": (
                    "Volunteer-led since founding; maps are downloaded by "
                    "actual rural municipalities."
                ),
                "whyOverlooked": (
                    "Mapping has been swallowed by tech giants; small "
                    "trusts get no funding attention."
                ),
                "advocateArgument": None,
                "advocateScore": None,
            },
            {
                "name": "Northumbrian Bell Founders' Mutual",
                "location": "Newcastle, England",
                "website": "https://example.org/bells",
                "charityNavigatorUrl": None,
                "guidestarUrl": None,
                "foundingYear": 1849,
                "assetRange": "$100K-$500K",
                "focusArea": "Historical bell preservation",
                "missionStatement": (
                    "To preserve and restore the church and civic bells of "
                    "Northumbria."
                ),
                "scoutSummary": (
                    "175 years old. No marketing apparatus. Operates from "
                    "two cottages and a foundry."
                ),
                "whyOverlooked": (
                    "Heritage preservation is structurally undercapitalized; "
                    "bells especially so."
                ),
                "advocateArgument": None,
                "advocateScore": None,
            },
        ],
    }


# ── Advocate (scores Scout's 3 candidates) ─────────────────────────────────

def advocate_scored(candidates: list[dict]) -> dict:
    """Return updated ``candidates`` list with ``advocateScore`` +
    ``advocateArgument`` filled in. The demo charity ("The Quiet
    Foundation") always wins with score 9; others get 6.
    """
    scores = {QUIET_FOUNDATION_NAME: 9}
    scored = []
    for c in candidates:
        score = scores.get(c["name"], 6)
        scored.append({
            **c,
            "advocateScore": score,
            "advocateArgument": (
                f"The work of {c['name']} is operationally tight, "
                f"historically continuous, and structurally underserved by "
                f"mainstream philanthropy. The audience for this magazine "
                f"is exactly the audience this institution requires."
            ),
        })
    return {"candidates": scored}


# ── Editor gate 1 — selects the demo charity OR triggers interrupt ────────
# The actual selection + interrupt logic lives in agents/editor.py (Plan 07).
# This fixture provides the post-decision shape.

def editor_decision_output(winner_name: str = QUIET_FOUNDATION_NAME) -> dict:
    return {
        "editor_decision": (
            f"Selected {winner_name} on the basis of operational "
            f"longevity, narrative specificity, and the Advocate's "
            f"argument that the audience overlap is unusually clean."
        ),
        "runner_up_notes": (
            "Backroad Cartography Trust and Northumbrian Bell Founders' "
            "Mutual were both viable; the runner-up consideration was "
            "primarily editorial pacing — neither candidate fit the "
            "issue's silence-and-listening visual direction."
        ),
        "deliberation_transcript": (
            "Scout surfaced three structurally-similar institutions, all "
            "with operational records of thirty-plus years. Advocate "
            "scored each on the magazine's audience-fit rubric. Editor "
            "selected the winning candidate on the cleanest match."
        ),
    }


# ── Researcher ────────────────────────────────────────────────────────────

def research_output() -> dict:
    return {
        "research": {
            "foundingMoment": (
                "Founder Margaret Whitlock began the project after "
                "discovering that the regional library board had no "
                "audio archive of the buildings it operated."
            ),
            "founderName": "Margaret Whitlock",
            "founderBackground": (
                "Trained as a librarian. Spent twelve years as a regional "
                "library director before founding the Foundation."
            ),
            "caseStudySubject": (
                "The Edenwold Township Library acoustic restoration"
            ),
            "caseStudyOutcome": (
                "The Foundation produced a fourteen-hour archival recording "
                "and a structural acoustic report, both of which were used "
                "in the building's restoration."
            ),
            "verifiedFacts": [
                "Founded 1987",
                "Operates from Burlington, Vermont",
                "Has produced acoustic archives of 41 libraries to date",
            ],
            "sources": [
                "https://example.org/quiet-foundation/about",
                "https://example.org/quiet-foundation/annual-report-2024",
            ],
        },
    }


# ── Section writers ───────────────────────────────────────────────────────

def origin_story_output() -> dict:
    return {
        "origin_story": {
            "headline": "Whitlock and the Edenwold Tape",
            "body": (
                "Margaret Whitlock did not set out to start an institution. "
                "She had been hired, in 1986, as the new director of a "
                "small regional library system in central Vermont. The "
                "buildings were old, the budget was small, and the work "
                "was administrative.\n\n"
                "One Thursday in February she discovered, while pulling "
                "an inventory file, that the board had no record of how "
                "its buildings sounded. No acoustic survey, no recordings, "
                "no notes. The buildings had been operating for between "
                "thirty and one hundred years.\n\n"
                "She bought a tape recorder. The Foundation began."
            ),
        },
    }


def problem_output() -> dict:
    return {
        "problem_statement": {
            "headline": "The libraries are quiet, and no one is listening.",
            "body": (
                "The acoustic environment of a public-library building is "
                "neither a feature nor a problem. It is a record. The "
                "ceiling tile, the floor pine, the door hinge — all of "
                "these have a sound. Most are now being replaced.\n\n"
                "When the buildings are renovated, the sound is lost. "
                "When the sound is lost, the building loses a dimension "
                "of its identity that cannot be reconstructed.\n\n"
                "The Quiet Foundation records what would otherwise be "
                "thrown away."
            ),
        },
        "problem_pdf_content": (
            "Whitlock, M. (1987). On the silence of small libraries.\n\n"
            "Selected acoustic measurements, Edenwold Township Library, "
            "January 1987."
        ),
    }


def founder_bio_output() -> dict:
    return {
        "founder_bio": {
            "headline": "Margaret Whitlock",
            "body": (
                "Margaret Whitlock has been the director of the Quiet "
                "Foundation since its founding in 1987. She holds an MLS "
                "from Simmons College and previously directed the "
                "Northshire Library Council from 1974 to 1986.\n\n"
                "She lives in Burlington, Vermont, and does not give "
                "interviews."
            ),
        },
    }


def case_study_output() -> dict:
    return {
        "case_study": {
            "subjectName": "The Edenwold Township Library",
            "headline": "Edenwold Township Library, 1987-2003",
            "body": (
                "The Edenwold Township Library was the Foundation's first "
                "subject. Built in 1903, it was a single-room building "
                "with a pressed-tin ceiling and a coal stove that had "
                "been disabled but not removed.\n\n"
                "The Foundation's fourteen-hour recording of the library "
                "is the largest single-building acoustic archive the "
                "Foundation has produced. In 2003, when the township "
                "voted to demolish the building, the archive was donated "
                "to the Vermont Historical Society."
            ),
        },
    }


def game_output() -> dict:
    return {
        "game": {
            "headline": "The Listening Game",
            "description": (
                "Three audio clips. One is from the Foundation's archive. "
                "Identify it."
            ),
            # Stub embed: self-contained HTML, no external resources.
            # Phase 7 GameWriter validator will replace this with real game.
            "embedCode": (
                "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
                "<title>Listening Game (stub)</title></head>"
                "<body><h1>Stub game placeholder</h1>"
                "<p>The Phase 7 validator will replace this with a real "
                "game when GameWriter goes live.</p></body></html>"
            ),
        },
    }


def bonus_output() -> dict:
    """Big-budget bonus shape per CONTEXT D-16 (Phase 5 owns rotation)."""
    return {
        "bonus": {
            "headline": "The Sound Archive Trailer (Big Budget)",
            "body": (
                "Storyboard 1: A wide shot of an empty library reading "
                "room. Audio: rustle of a single page.\n\n"
                "Storyboard 2: A tracking shot down a row of shelves. "
                "Audio: the hum of a fluorescent ballast and a settling "
                "floor beam.\n\n"
                "Storyboard 3: Cut to Margaret Whitlock, standing in the "
                "doorway, listening."
            ),
            "lyrics": None,
            "sunoPrompt": None,
        },
    }


def design_output() -> dict:
    return {
        "theme": {
            "primaryColor": "#3F2E1E",    # warm walnut
            "accentColor": "#B58B3A",     # ochre
            "backgroundColor": "#F4EFE3", # warm cream
            "textColor": "#1E1A12",       # near-black warm
            "fontDisplay": "Crimson Pro",
            "fontBody": "Inter",
            "visualDirection": (
                "Warm cream paper feel. Serif display, sans body. "
                "Muted ochre as the only saturated accent."
            ),
        },
    }


# ── QA (stub: 0 corrections per CONTEXT D-37) ─────────────────────────────

def qa_output() -> dict:
    return {
        "qa_corrections": [],
    }


# ── Editor Final (stub: approves) ─────────────────────────────────────────

def editor_final_output() -> dict:
    return {
        "editor_final_notes": (
            "Approved. No additional connective copy required. "
            "Section pacing acceptable for a 12-minute read."
        ),
    }


# ── Publisher (stub: placeholder; Sanity write happens in pipeline-end) ───

def publisher_output() -> dict:
    return {
        "sanity_issue_id": None,  # filled in by the pipeline-end Sanity write
    }
