"""Quick 261021-7aw — contradicted-claim sentence removal."""
from eisenbalm_pipeline.lib.claim_fixes import apply_claim_fixes


def _state():
    return {"origin_story": {"body": [
        {"type": "paragraph", "text": "Keep this. The founder was born in 1990. Keep that."},
        {"type": "paragraph", "text": "Only claim here."},
    ]}}


def test_contradicted_sentence_removed():
    rows = [{"sectionName": "originStory", "text": "born in 1990", "verdict": "contradicted",
             "blockIndexHint": 0}]
    updates, out = apply_claim_fixes(_state(), rows)
    assert out[0]["status"] == "removed"
    assert updates["origin_story"]["body"][0]["text"] == "Keep this. Keep that."


def test_whole_block_dropped_and_hints_shift():
    rows = [
        {"sectionName": "originStory", "text": "Only claim here.", "verdict": "contradicted",
         "blockIndexHint": 1},
        {"sectionName": "originStory", "text": "x", "verdict": "verified", "blockIndexHint": 1},
    ]
    updates, out = apply_claim_fixes(_state(), rows)
    assert len(updates["origin_story"]["body"]) == 1
    assert out[0]["status"] == "removed"
    assert "blockIndexHint" not in out[1]


def test_not_locatable_is_skipped_and_state_untouched():
    rows = [{"sectionName": "originStory", "text": "absent", "verdict": "contradicted"},
            {"sectionName": "game", "text": "x", "verdict": "contradicted"}]
    updates, out = apply_claim_fixes(_state(), rows)
    assert updates == {}
    assert [r["status"] for r in out] == ["skipped", "skipped"]


def test_other_verdicts_keep_status_unset():
    rows = [{"sectionName": "originStory", "text": "Keep this.", "verdict": "verified"},
            {"sectionName": "originStory", "text": "Keep that.", "verdict": "unverifiable"},
            {"sectionName": "originStory", "text": "Keep that."}]
    updates, out = apply_claim_fixes(_state(), rows)
    assert updates == {} and all("status" not in r for r in out)
