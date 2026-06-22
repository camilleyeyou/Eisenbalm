"""
Phase 23 — OBS-04: No-double-count guard for get_cost_payload.

Asserts that calling get_cost_payload(run_id) is a PURE READ — it does not
mutate the cost store, so calling it multiple times returns identical results.

This is the critical invariant for wrap_agent_node: after fn() completes,
the wrapper reads agent cost via get_cost_payload() without triggering any
additional record_cost() accumulation.

See: RESEARCH.md Pitfall 1, Pattern 1 anti-patterns.
"""
import pytest

from eisenbalm_pipeline.lib.cost import begin_run, get_cost_payload, record_cost


def test_get_cost_payload_is_read_only():
    """get_cost_payload called twice returns identical results — no mutation."""
    run_id = "test-double-count-001"
    begin_run(run_id)

    # Record one agent's cost (the only write)
    record_cost(run_id, "scout", usd=0.02, tokens_in=1000, tokens_out=500, duration_ms=2000)

    # Read 1
    payload1 = get_cost_payload(run_id)
    # Read 2 — must be identical (not additive)
    payload2 = get_cost_payload(run_id)

    assert payload1 == payload2, (
        f"get_cost_payload is NOT idempotent — payload1={payload1}, payload2={payload2}. "
        "This indicates get_cost_payload is modifying _store (double-count bug)."
    )
    assert payload1["agents"]["scout"]["usd"] == 0.02, (
        f"Expected scout.usd=0.02, got {payload1['agents']['scout']['usd']}"
    )
    assert payload1["total"] == pytest.approx(0.02, abs=1e-9)


def test_get_cost_payload_does_not_double_count_on_repeated_calls():
    """Repeated reads do not accumulate — total stays constant."""
    run_id = "test-double-count-002"
    begin_run(run_id)

    record_cost(run_id, "calibrator", usd=0.003, tokens_in=200, tokens_out=80, duration_ms=500)
    record_cost(run_id, "scout", usd=0.021, tokens_in=8200, tokens_out=2100, duration_ms=8400)

    # Simulate wrap_agent_node calling get_cost_payload once per agent
    for _ in range(5):
        payload = get_cost_payload(run_id)

    # Total should be sum of the two recorded costs, not multiplied by read count
    assert payload["total"] == pytest.approx(0.024, abs=1e-9), (
        f"Expected total=0.024, got {payload['total']}. "
        "get_cost_payload appears to be mutating the store."
    )
    assert len(payload["agents"]) == 2


def test_record_cost_is_additive_but_get_cost_payload_is_not():
    """Only record_cost accumulates; get_cost_payload is stable between record_cost calls."""
    run_id = "test-double-count-003"
    begin_run(run_id)

    # First agent call
    record_cost(run_id, "scout", usd=0.01, tokens_in=500, tokens_out=200, duration_ms=1000)
    snapshot1 = get_cost_payload(run_id)

    # Second call from the SAME agent (multiple tool calls — additive by design)
    record_cost(run_id, "scout", usd=0.01, tokens_in=500, tokens_out=200, duration_ms=1000)
    snapshot2 = get_cost_payload(run_id)

    # Verify: record_cost IS additive (this is correct behavior)
    assert snapshot2["agents"]["scout"]["usd"] == pytest.approx(0.02, abs=1e-9), (
        "record_cost should accumulate per-agent costs across multiple calls"
    )

    # Verify: reading snapshot1 again returns the SAME value as when it was taken
    re_read = get_cost_payload(run_id)
    # re_read reflects current state (after 2 record_cost calls) = 0.02
    # This confirms get_cost_payload is a pure read of current state, not a writer
    assert re_read["total"] == pytest.approx(0.02, abs=1e-9)
    assert re_read == snapshot2  # Consistent with second snapshot
