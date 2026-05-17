"""Phase 5 verify_research unit tests — implemented by Plan 05-09.

Validation: AGT-08 (verification logic + httpx error fallback).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.verify import _name_in_text, verify_research


def test_name_in_text_full_match() -> None:
    assert _name_in_text("Jane Doe", "Jane Doe founded the organization") is True


def test_name_in_text_last_name_fallback() -> None:
    assert _name_in_text("Jane Doe", "Contact Doe at the office") is True


def test_name_in_text_no_match() -> None:
    assert _name_in_text("Jane Doe", "The organization was founded in 2003") is False


def test_name_in_text_empty() -> None:
    assert _name_in_text("", "anything") is False
    assert _name_in_text("Jane", "") is False


@pytest.mark.asyncio
async def test_verify_match() -> None:
    state = {
        "research": {
            "founderName": "Jane Doe",
            "founderNameSourceUrl": "https://foo.example/about",
            "subjectName": None,
            "subjectNameSourceUrl": None,
        }
    }
    with patch(
        "eisenbalm_pipeline.agents.verify._fetch_text",
        AsyncMock(return_value="Jane Doe founded this in 2003."),
    ):
        out = await verify_research(state)

    assert out["research"]["founderNameVerified"] is True
    assert out["research"]["subjectNameVerified"] is False  # no name to verify


@pytest.mark.asyncio
async def test_verify_no_match() -> None:
    state = {
        "research": {
            "founderName": "Jane Doe",
            "founderNameSourceUrl": "https://foo.example/about",
        }
    }
    with patch(
        "eisenbalm_pipeline.agents.verify._fetch_text",
        AsyncMock(return_value="The organization was founded in 2003."),
    ):
        out = await verify_research(state)
    assert out["research"]["founderNameVerified"] is False


@pytest.mark.asyncio
async def test_verify_httpx_error_is_unverified() -> None:
    """AGT-08: httpx error leaves founderNameVerified=False (conservative)."""
    state = {
        "research": {
            "founderName": "Jane Doe",
            "founderNameSourceUrl": "https://foo.example/about",
        }
    }
    with patch(
        "eisenbalm_pipeline.agents.verify._fetch_text",
        AsyncMock(return_value=None),  # _fetch_text returns None on any failure
    ):
        out = await verify_research(state)
    assert out["research"]["founderNameVerified"] is False


@pytest.mark.asyncio
async def test_verify_null_name() -> None:
    """Researcher emitted founderName=None — verified must be False."""
    state = {
        "research": {
            "founderName": None,
            "founderNameSourceUrl": None,
        }
    }
    with patch(
        "eisenbalm_pipeline.agents.verify._fetch_text",
        AsyncMock(return_value="Whatever"),
    ):
        out = await verify_research(state)
    assert out["research"]["founderNameVerified"] is False
    assert out["research"]["subjectNameVerified"] is False


@pytest.mark.asyncio
async def test_verify_subject_parallel() -> None:
    """Same verification logic applied to subjectName."""
    state = {
        "research": {
            "founderName": None,
            "subjectName": "Alex Park",
            "subjectNameSourceUrl": "https://foo.example/stories/alex",
        }
    }
    with patch(
        "eisenbalm_pipeline.agents.verify._fetch_text",
        AsyncMock(return_value="Alex Park came to the program in 2019."),
    ):
        out = await verify_research(state)
    assert out["research"]["subjectNameVerified"] is True
