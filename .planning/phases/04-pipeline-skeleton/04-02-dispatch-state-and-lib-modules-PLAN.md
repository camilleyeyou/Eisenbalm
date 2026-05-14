---
phase: 04-pipeline-skeleton
plan: 02
type: execute
wave: 1
depends_on:
  - "04-01"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/ids.py
  - packages/pipeline/src/eisenbalm_pipeline/types.py
autonomous: true
requirements:
  - PIP-05
  - PIP-07
must_haves:
  truths:
    - "`DispatchState` TypedDict matches API_CONTRACTS §7 verbatim — every field name and nested TypedDict shape locked"
    - "`text_to_portable_text()` returns Sanity-valid block array with required `_key` UUIDs"
    - "`convex_mutation()` uses `Authorization: Convex {key}` header (NOT Bearer) and branches on response body `status` field (NOT HTTP status code) — research §6 + Pitfall 7"
    - "`write_charity()` and `write_issue_draft()` POST to `/{API_VERSION}/data/mutate/{dataset}` with `Authorization: Bearer {SANITY_API_TOKEN}` — research §5"
    - "`new_run_id()` returns `uuid.uuid4().hex` (32-char no-dash) — CONTEXT D-09"
    - "`CostRecorder` accumulates per-agent `{tokens_in, tokens_out, usd, duration_ms}` keyed by runId"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
      provides: "DispatchState + 9 nested TypedDicts"
      contains: "class DispatchState(TypedDict):"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py"
      provides: "text_to_portable_text(text: str) -> list[dict]"
      contains: "def text_to_portable_text"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "write_charity, write_issue_draft, upload_pdf_to_issue, set_charity_first_featured"
      contains: "def write_charity"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py"
      provides: "convex_mutation, convex_mutation_safe, convex_query"
      contains: "Convex "
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/cost.py"
      provides: "CostRecorder context manager + record_cost helper"
      contains: "class CostRecorder"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/ids.py"
      provides: "new_run_id() -> str returning uuid4().hex"
      contains: "def new_run_id"
  key_links:
    - from: "lib/convex_client.py:convex_mutation"
      to: "Convex /api/mutation"
      via: "POST with Authorization: Convex {CONVEX_DEPLOY_KEY}"
      pattern: "Convex "
    - from: "lib/sanity_client.py:write_issue_draft"
      to: "Sanity /v2024-01-01/data/mutate/{dataset}"
      via: "POST mutations [{createOrReplace}]; pipelineMetadata.runId = state['run_id']"
      pattern: "pipelineMetadata"
    - from: "lib/cost.py:flush_cost"
      to: "Convex pipelineRuns:updateStatus AND Sanity weeklyIssue.pipelineMetadata.cost"
      via: "JSON-stringified cost payload (mirrors modelVersions pattern — CONTEXT D-22)"
      pattern: "json.dumps"
---

<objective>
Land the four library modules that every agent and the FastAPI app will import: the locked `DispatchState` TypedDict (graph/state.py — API_CONTRACTS §7 verbatim), the Portable Text helper (lib/portable_text.py — API_CONTRACTS §2.4 verbatim), the Sanity HTTP client (lib/sanity_client.py — research §5, raw httpx, no SDK), the Convex HTTP client (lib/convex_client.py — research §6, `Authorization: Convex {key}` header), the CostRecorder context manager (lib/cost.py — CONTEXT D-22), and `new_run_id()` (lib/ids.py — CONTEXT D-09).

All of these are independent of the FastAPI app, the LangGraph builder, and the stub fixtures. Wave 2's `@agent_node` wrapper depends on `lib/convex_client.py` + `lib/cost.py` + `graph/state.py`; Wave 2's 14 stub agents depend on `graph/state.py` + (a few) on `lib/sanity_client.py`. Wave 3's FastAPI app composes them all.

Purpose: PIP-05 — runId generated exactly once and threaded through every Convex and Sanity write. This plan owns the `new_run_id()` generator + the two HTTP clients that carry the runId.
Output: A fully-typed set of library modules. No business logic yet — just contract-honoring wrappers and the canonical state shape.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@docs/API_CONTRACTS.md
@convex/schema.ts
@convex/pipelineRuns.ts
@packages/pipeline/pyproject.toml
</context>

<tasks>

<task type="auto">
  <name>Task 1: graph/state.py (DispatchState) + lib/ids.py + types.py re-exports + __init__ files</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/__init__.py, packages/pipeline/src/eisenbalm_pipeline/graph/state.py, packages/pipeline/src/eisenbalm_pipeline/lib/__init__.py, packages/pipeline/src/eisenbalm_pipeline/lib/ids.py, packages/pipeline/src/eisenbalm_pipeline/types.py</files>
  <read_first>
    - docs/API_CONTRACTS.md §7 lines 1174-1291 (DispatchState + 9 nested TypedDicts — copy VERBATIM)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-09 (runId is `uuid.uuid4().hex` — plain hex, no dashes)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §"Open Questions" Q3 (underscore-prefixed test toggles `_force_no_winner`, `_force_fail_agent` are non-canonical — keep them OUT of API_CONTRACTS §7 docs but allowed in state.py)
    - CLAUDE.md ("do not modify field names without checking API_CONTRACTS.md first")
  </read_first>
  <action>
    1. Create `packages/pipeline/src/eisenbalm_pipeline/graph/__init__.py` containing one docstring line: `"""LangGraph state + builder + checkpointer."""`

    2. Create `packages/pipeline/src/eisenbalm_pipeline/graph/state.py`. Copy the DispatchState + 9 nested TypedDicts VERBATIM from docs/API_CONTRACTS.md §7 (lines 1185-1291). Use `from __future__ import annotations` plus `from typing import TypedDict, Optional, Literal`. After the canonical fields in `DispatchState`, append two underscore-prefixed test-only fields at the end of the class (per research §"Open Questions" Q3):

       ```python
       # Phase 4 test toggles (NOT part of API_CONTRACTS §7).
       # Underscore prefix signals non-canonical, test-only.
       # See research §"Open Questions" Q3.
       _force_no_winner: Optional[bool]
       _force_fail_agent: Optional[str]
       ```

       Keep every other field name, order, and type EXACTLY as API_CONTRACTS §7.

    3. Create `packages/pipeline/src/eisenbalm_pipeline/lib/__init__.py` containing one docstring line: `"""Library modules: HTTP clients, helpers, cost tracking."""`

    4. Create `packages/pipeline/src/eisenbalm_pipeline/lib/ids.py`:

       ```python
       """Run-ID generation. See CONTEXT D-09."""
       from __future__ import annotations
       import uuid


       def new_run_id() -> str:
           """Return a fresh run_id as uuid4 hex (32 chars, no dashes).

           Generated exactly ONCE per /run/weekly request (CONTEXT D-09).
           Used as both the pipelineRuns.runId in Convex AND the LangGraph
           thread_id for AsyncPostgresSaver (CONTEXT D-10).
           """
           return uuid.uuid4().hex
       ```

    5. Create `packages/pipeline/src/eisenbalm_pipeline/types.py` — public re-exports:

       ```python
       """Public re-exports of canonical types for tests / external code."""
       from eisenbalm_pipeline.graph.state import (
           DispatchState,
           StyleBrief,
           CharityCandidate,
           ResearchOutput,
           SectionContent,
           CaseStudyContent,
           GameContent,
           BonusContent,
           Theme,
           QACorrection,
       )

       __all__ = [
           "DispatchState",
           "StyleBrief",
           "CharityCandidate",
           "ResearchOutput",
           "SectionContent",
           "CaseStudyContent",
           "GameContent",
           "BonusContent",
           "Theme",
           "QACorrection",
       ]
       ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState, StyleBrief, CharityCandidate, ResearchOutput, SectionContent, CaseStudyContent, GameContent, BonusContent, Theme, QACorrection; from eisenbalm_pipeline.lib.ids import new_run_id; rid = new_run_id(); assert len(rid) == 32 and '-' not in rid; assert 'run_id' in DispatchState.__annotations__; assert '_force_no_winner' in DispatchState.__annotations__; assert 'voice' in StyleBrief.__annotations__; print('OK')"</automated>
  </verify>
  <done>
    - `graph/state.py` exports `DispatchState` + the 9 nested TypedDicts with field names matching API_CONTRACTS §7 verbatim
    - `_force_no_winner` and `_force_fail_agent` are added to `DispatchState` (underscore-prefixed); they do NOT appear in API_CONTRACTS §7
    - `new_run_id()` returns 32-char uuid4 hex without dashes
    - `types.py` re-exports all 10 TypedDicts
    - All imports succeed under `uv run python -c "..."`
  </done>
</task>

<task type="auto">
  <name>Task 2: lib/portable_text.py (API_CONTRACTS §2.4 verbatim)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py</files>
  <read_first>
    - docs/API_CONTRACTS.md §2.4 lines 432-470 (text_to_portable_text — VERBATIM, do not bypass per section header)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §"Don't Hand-Roll" row "Portable Text serialization" (manual block construction silently produces blank-rendering blocks)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` copying API_CONTRACTS §2.4 verbatim:

    ```python
    """Portable Text helper — convert plain text to Sanity Portable Text blocks.

    DO NOT bypass this helper. Manual block construction silently produces
    malformed blocks that render as blank in Sanity Studio.

    Source: docs/API_CONTRACTS.md §2.4 (verbatim).
    """
    from __future__ import annotations
    import uuid


    def text_to_portable_text(text: str) -> list[dict]:
        """Convert plain text (paragraphs separated by blank lines) to Sanity
        Portable Text block array.

        Args:
            text: Plain text. Paragraphs separated by `\\n\\n`.

        Returns:
            List of Portable Text block dicts ready to write to Sanity.
        """
        paragraphs = [p.strip() for p in text.strip().split('\n\n') if p.strip()]
        return [
            {
                '_type': 'block',
                '_key': f'block-{uuid.uuid4().hex[:8]}',
                'style': 'normal',
                'markDefs': [],
                'children': [
                    {
                        '_type': 'span',
                        '_key': f'span-{uuid.uuid4().hex[:8]}',
                        'text': para,
                        'marks': [],
                    }
                ],
            }
            for para in paragraphs
        ]
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.portable_text import text_to_portable_text; blocks = text_to_portable_text('Hello.\n\nWorld.'); assert len(blocks) == 2; assert blocks[0]['_type'] == 'block'; assert blocks[0]['style'] == 'normal'; assert blocks[0]['children'][0]['text'] == 'Hello.'; assert blocks[0]['_key'].startswith('block-') and len(blocks[0]['_key']) == 14; assert blocks[1]['children'][0]['text'] == 'World.'; print('OK')"</automated>
  </verify>
  <done>
    - `text_to_portable_text('a\n\nb')` returns 2 block dicts
    - Each block has `_type='block'`, `_key` starting with `block-` + 8 hex chars, `style='normal'`, `markDefs=[]`, `children=[{...}]`
    - Each child span has `_type='span'`, `_key` starting with `span-`, `text=<paragraph>`, `marks=[]`
    - Function matches API_CONTRACTS §2.4 byte-for-byte
  </done>
</task>

<task type="auto">
  <name>Task 3: lib/convex_client.py (research §6 + Pitfall 7)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py</files>
  <read_first>
    - docs/API_CONTRACTS.md §3 lines 493-722 (canonical wrapper + every call site shape)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §6 "Convex HTTP API from Python" — auth header is `Convex {key}` (NOT `Bearer`); success response `{status: success, value}`; error response is HTTP 200 with `{status: error, errorMessage}`
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Pitfall 7" (response.status_code is NOT the auth test — must branch on body `status` field)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-20 (Convex failures log + continue — `convex_mutation_safe` swallows; raw `convex_mutation` raises)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-33 (FastAPI lifespan owns the shared httpx client; module-level singleton storage OK)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Example 2" lines ~814-888 (full reference impl)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` per research "Example 2":

    ```python
    """Convex HTTP API client (Phase 4 is the first real caller).

    Endpoint: POST {NEXT_PUBLIC_CONVEX_URL}/api/mutation (or /api/query)
    Auth: Authorization: Convex {CONVEX_DEPLOY_KEY} — NOT Bearer.
    Error envelope: HTTP 200 with {status: "error", errorMessage}.
    Must branch on body `status` field, NOT response.status_code (Pitfall 7).

    Source: docs/API_CONTRACTS.md §3 + 04-RESEARCH.md §6.
    """
    from __future__ import annotations
    import logging
    import os
    from typing import Any, Optional

    from httpx import AsyncClient

    log = logging.getLogger(__name__)

    # Module-level shared client. Constructed in FastAPI lifespan (CONTEXT D-33)
    # and registered via set_client().
    _CLIENT: Optional[AsyncClient] = None


    def set_client(client: AsyncClient) -> None:
        """Register the shared AsyncClient (FastAPI lifespan calls this)."""
        global _CLIENT
        _CLIENT = client


    def get_client() -> AsyncClient:
        """Return the registered shared client; raise if unset."""
        if _CLIENT is None:
            raise RuntimeError(
                "Convex client not registered. "
                "FastAPI lifespan must call set_client(http) at startup."
            )
        return _CLIENT


    async def convex_mutation(http: AsyncClient, path: str, args: dict) -> Any:
        """Call a Convex mutation. Raises on HTTP error OR Convex validator error.

        Args:
            http: AsyncClient with base_url set to NEXT_PUBLIC_CONVEX_URL.
            path: e.g. 'pipelineRuns:create'.
            args: validator-shaped args dict.

        Returns:
            The `value` field from a successful Convex response.

        Raises:
            httpx.HTTPStatusError: on non-2xx HTTP response.
            RuntimeError: on HTTP 200 with body status='error' (Pitfall 7).
        """
        r = await http.post(
            "/api/mutation",
            json={"path": path, "args": args, "format": "json"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
            },
        )
        r.raise_for_status()
        body = r.json()
        if body.get("status") != "success":
            raise RuntimeError(
                f"Convex mutation failed: path={path} args={args} "
                f"err={body.get('errorMessage')}"
            )
        return body.get("value")


    async def convex_mutation_safe(path: str, args: dict) -> None:
        """Fire-and-forget variant per CONTEXT D-20.

        Convex failures log + continue. Uses module-level shared client.
        """
        client = _CLIENT
        if client is None:
            log.warning(
                "convex_mutation_safe called before set_client(); dropping: %s",
                path,
            )
            return
        try:
            await convex_mutation(client, path, args)
        except Exception as e:
            log.warning("convex_mutation_safe failed: %s %s — %r", path, args, e)


    async def convex_query(http: AsyncClient, path: str, args: dict) -> Any:
        """Call a Convex query. Used by GET /run/{runId}/status and tests."""
        r = await http.post(
            "/api/query",
            json={"path": path, "args": args, "format": "json"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
            },
        )
        r.raise_for_status()
        body = r.json()
        if body.get("status") != "success":
            raise RuntimeError(
                f"Convex query failed: path={path} → {body.get('errorMessage')}"
            )
        return body.get("value")
    ```

    Critical correctness notes:
    - Authorization value is the LITERAL string `"Convex "` + key (with space) — NOT `"Bearer "` + key. Research §6 + Pitfall 7.
    - `format: "json"` is required by Convex HTTP API per research §6.
    - `convex_mutation_safe` swallows ALL exceptions (CONTEXT D-20).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.convex_client import convex_mutation, convex_mutation_safe, convex_query, set_client, get_client; import inspect; src = inspect.getsource(convex_mutation); assert 'Authorization' in src; assert 'Convex ' in src; assert 'Bearer' not in src; assert 'body.get' in src and 'status' in src; assert '/api/mutation' in src; src2 = inspect.getsource(convex_query); assert '/api/query' in src2; print('OK')"</automated>
  </verify>
  <done>
    - `convex_mutation` uses `Authorization: f"Convex {os.environ['CONVEX_DEPLOY_KEY']}"` (literal "Convex " prefix, NOT "Bearer ")
    - `convex_mutation` raises `RuntimeError` when response body `status != 'success'`
    - `convex_mutation_safe` swallows all exceptions and logs at warning
    - Module-level `_CLIENT` + `set_client()` / `get_client()` pattern present
    - `convex_query` posts to `/api/query` with same auth shape
  </done>
</task>

<task type="auto">
  <name>Task 4: lib/sanity_client.py (research §5 + API_CONTRACTS §2)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py</files>
  <read_first>
    - docs/API_CONTRACTS.md §2.1, §2.2, §2.3, §2.5 (write_charity / write_issue_draft / upload_pdf_to_issue / set_charity_first_featured — full doc shapes)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §5 "Sanity Python SDK status & raw httpx mutation pattern" — no maintained SDK; auth is `Bearer {SANITY_API_TOKEN}`; base URL; api-version 2024-01-01
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Example 3" lines ~894-995 (full reference impl)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-18 step 11 (Sanity write at pipeline end; pipelineMetadata.runId = state['run_id'])
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-22 (pipelineMetadata.cost is a JSON-stringified payload, mirror of modelVersions)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Pitfall 6" (pipelineMetadata.runId nesting — runId is sibling of startedAt INSIDE pipelineMetadata object)
    - apps/studio/schemas/weeklyIssue.ts lines 330-348 (pipelineMetadata field — Plan 04 adds the new `cost` text field; this client writes it)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` per research §5 + API_CONTRACTS §2.2 + CONTEXT D-22:

    ```python
    """Sanity write client — raw httpx (no maintained Python SDK per research §5).

    API base: https://{PROJECT_ID}.api.sanity.io/v2024-01-01
    Auth: Authorization: Bearer {SANITY_API_TOKEN}
    Mutation endpoint: POST /data/mutate/{dataset}
    Asset upload: POST /assets/files/{dataset}?filename=...

    Source: docs/API_CONTRACTS.md §2 + 04-RESEARCH.md §5.
    """
    from __future__ import annotations
    import json
    import os
    from datetime import datetime, timezone
    from typing import Any, Optional

    from httpx import AsyncClient
    from slugify import slugify

    from eisenbalm_pipeline.lib.portable_text import text_to_portable_text

    API_VERSION = "v2024-01-01"


    def _dataset() -> str:
        return os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")


    def _auth_headers() -> dict[str, str]:
        return {
            "Authorization": f"Bearer {os.environ['SANITY_API_TOKEN']}",
            "Content-Type": "application/json",
        }


    async def write_charity(http: AsyncClient, charity: dict) -> str:
        """Idempotent createOrReplace for a charity document. Returns _id.

        Deterministic _id = 'charity-{slugify(name)}' — CONTEXT D-19.
        """
        slug = slugify(charity["name"])
        doc_id = f"charity-{slug}"

        doc: dict[str, Any] = {
            "_type": "charity",
            "_id": doc_id,
            "name": charity["name"],
            "slug": {"_type": "slug", "current": slug},
            "location": charity.get("location", ""),
            "website": charity.get("website", ""),
            "charityNavigatorUrl": charity.get("charityNavigatorUrl"),
            "guidestarUrl": charity.get("guidestarUrl"),
            "foundingYear": charity.get("foundingYear"),
            "assetRange": charity.get("assetRange", ""),
            "focusArea": charity.get("focusArea", ""),
            "missionStatement": charity.get("missionStatement", ""),
            "scoutNotes": charity.get("scoutSummary", ""),
        }
        doc = {k: v for k, v in doc.items() if v is not None}

        r = await http.post(
            f"/{API_VERSION}/data/mutate/{_dataset()}",
            json={"mutations": [{"createOrReplace": doc}]},
            headers=_auth_headers(),
        )
        r.raise_for_status()
        return doc_id


    def _build_bonus(state: dict) -> dict:
        """Mirror API_CONTRACTS §2.2 _build_bonus."""
        bonus = state.get("bonus") or {}
        bonus_type = (state.get("style_brief") or {}).get("bonusType")
        result: dict[str, Any] = {
            "headline": bonus.get("headline", ""),
            "body": text_to_portable_text(bonus.get("body", "")),
        }
        if bonus_type == "jingle":
            result["lyrics"] = bonus.get("lyrics", "")
            result["sunoPrompt"] = bonus.get("sunoPrompt", "")
            # sunoAudioUrl intentionally omitted — Andrew populates
        return result


    def _build_podcast_description(state: dict) -> str:
        """Placeholder until Phase 9 wires real podcast description logic."""
        charity_name = (state.get("winning_charity") or {}).get("name", "")
        return f"Pipeline deliberation transcript for the issue spotlighting {charity_name}."


    async def write_issue_draft(
        http: AsyncClient,
        state: dict,
        cost_payload: Optional[dict] = None,
    ) -> str:
        """One write at pipeline end. Returns Sanity _id.

        cost_payload is JSON-stringified into pipelineMetadata.cost per
        CONTEXT D-22 (mirrors modelVersions). Falls back to empty cost shape.

        Source: docs/API_CONTRACTS.md §2.2.
        """
        issue_id = f"issue-{state['issue_number']}"
        candidates = state.get("candidates") or []
        completed_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        doc: dict[str, Any] = {
            "_type": "weeklyIssue",
            "_id": issue_id,
            "issueNumber": state["issue_number"],
            "slug": {"_type": "slug", "current": f"issue-{state['issue_number']}"},
            "publishDate": state["publish_date"],
            "status": "draft",
            "bonusType": (state.get("style_brief") or {}).get("bonusType"),
            "charity": {
                "_type": "reference",
                "_ref": state["winning_charity_sanity_id"],
            },
            "theme": state.get("theme") or {},
            "originStory": {
                "headline": (state.get("origin_story") or {}).get("headline", ""),
                "body": text_to_portable_text((state.get("origin_story") or {}).get("body", "")),
            },
            "problemStatement": {
                "headline": (state.get("problem_statement") or {}).get("headline", ""),
                "body": text_to_portable_text((state.get("problem_statement") or {}).get("body", "")),
            },
            "founderBio": {
                "headline": (state.get("founder_bio") or {}).get("headline", ""),
                "body": text_to_portable_text((state.get("founder_bio") or {}).get("body", "")),
            },
            "caseStudy": {
                "subjectName": (state.get("case_study") or {}).get("subjectName", ""),
                "headline": (state.get("case_study") or {}).get("headline", ""),
                "body": text_to_portable_text((state.get("case_study") or {}).get("body", "")),
            },
            "game": {
                "headline": (state.get("game") or {}).get("headline", ""),
                "description": (state.get("game") or {}).get("description", ""),
                "embedCode": (state.get("game") or {}).get("embedCode", ""),
            },
            "bonus": _build_bonus(state),
            "podcast": {
                "deliberationTranscript": state.get("deliberation_transcript", ""),
                "podcastDescription": _build_podcast_description(state),
            },
            "selectionDeliberation": {
                "candidates": [
                    {
                        "_key": f"candidate-{i}",
                        "charity": {
                            "_type": "reference",
                            "_ref": f"charity-{slugify(c['name'])}",
                        },
                        "scoutSummary": c.get("scoutSummary", ""),
                        "advocateArgument": c.get("advocateArgument", ""),
                        "advocateScore": c.get("advocateScore"),
                    }
                    for i, c in enumerate(candidates)
                ],
                "editorDecision": state.get("editor_decision", ""),
                "runnerUpNotes": state.get("runner_up_notes", ""),
            },
            "pipelineMetadata": {
                "runId": state["run_id"],
                "startedAt": state.get("pipeline_started_at"),
                "completedAt": completed_iso,
                "modelVersions": json.dumps(state.get("model_versions", {})),
                # CONTEXT D-22 + D-24: JSON-stringified cost summary.
                # Plan 04 adds the `cost` text field to the Sanity schema.
                "cost": json.dumps(cost_payload or {"total": 0.0, "agents": {}}),
            },
        }

        r = await http.post(
            f"/{API_VERSION}/data/mutate/{_dataset()}",
            json={"mutations": [{"createOrReplace": doc}]},
            headers=_auth_headers(),
        )
        r.raise_for_status()
        return issue_id


    async def upload_pdf_to_issue(
        http: AsyncClient,
        issue_id: str,
        pdf_bytes: bytes,
        issue_number: int,
    ) -> None:
        """Phase 6 contract — Phase 4 stub Publisher does NOT call this.
        Function shipped here so Phase 6 only needs to wire it from publisher.py.

        Source: 04-RESEARCH.md §5 + docs/API_CONTRACTS.md §2.3.
        """
        filename = f"dispatch-issue-{issue_number}-problem-statement.pdf"

        # 1) Upload the binary
        r = await http.post(
            f"/{API_VERSION}/assets/files/{_dataset()}",
            params={"filename": filename},
            content=pdf_bytes,
            headers={
                "Authorization": f"Bearer {os.environ['SANITY_API_TOKEN']}",
                "Content-Type": "application/pdf",
            },
        )
        r.raise_for_status()
        asset_id = r.json()["document"]["_id"]

        # 2) Patch the issue to reference the asset
        r = await http.post(
            f"/{API_VERSION}/data/mutate/{_dataset()}",
            json={
                "mutations": [
                    {
                        "patch": {
                            "id": issue_id,
                            "set": {
                                "problemPdf": {
                                    "_type": "file",
                                    "asset": {"_type": "reference", "_ref": asset_id},
                                }
                            },
                        }
                    }
                ]
            },
            headers=_auth_headers(),
        )
        r.raise_for_status()


    async def set_charity_first_featured(
        http: AsyncClient, charity_id: str, issue_id: str
    ) -> None:
        """Publisher-only call. See API_CONTRACTS §2.5. Phase 4 stub Publisher
        does NOT invoke this (the issue isn't actually published yet)."""
        r = await http.post(
            f"/{API_VERSION}/data/mutate/{_dataset()}",
            json={
                "mutations": [
                    {
                        "patch": {
                            "id": charity_id,
                            "setIfMissing": {
                                "firstFeaturedIn": {
                                    "_type": "reference",
                                    "_ref": issue_id,
                                }
                            },
                        }
                    }
                ]
            },
            headers=_auth_headers(),
        )
        r.raise_for_status()
    ```

    Notes:
    - `pipelineMetadata.cost` is JSON-stringified per CONTEXT D-22 — Plan 04 patches the Sanity schema to accept this new field.
    - `setIfMissing` (instead of API_CONTRACTS §2.5's `set`) for `firstFeaturedIn` — slightly safer; document in SUMMARY as Claude's discretion.
    - All function signatures take `http: AsyncClient` first arg — caller passes the lifespan-owned client.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.sanity_client import write_charity, write_issue_draft, upload_pdf_to_issue, set_charity_first_featured, API_VERSION; import inspect; src = inspect.getsource(write_issue_draft); assert 'pipelineMetadata' in src; assert 'cost' in src; assert 'json.dumps' in src; assert 'createOrReplace' in src; src2 = inspect.getsource(write_charity); assert 'charity-' in src2; assert 'slugify' in src2; src3 = inspect.getsource(upload_pdf_to_issue); assert '/assets/files/' in src3; assert API_VERSION == 'v2024-01-01'; print('OK')"</automated>
  </verify>
  <done>
    - `write_charity` does `POST /{API_VERSION}/data/mutate/{dataset}` with `Authorization: Bearer ...` and `_id='charity-{slug}'`
    - `write_issue_draft` writes `pipelineMetadata.runId = state['run_id']` and `pipelineMetadata.cost = json.dumps(cost_payload or {...})`
    - All section bodies routed through `text_to_portable_text`
    - `upload_pdf_to_issue` and `set_charity_first_featured` are present for Phase 6 to wire from publisher.py
    - `API_VERSION = "v2024-01-01"` constant exported
  </done>
</task>

<task type="auto">
  <name>Task 5: lib/cost.py (CostRecorder per CONTEXT D-22)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/cost.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-22 (CostRecorder context manager bound to runId; per-agent {tokens_in, tokens_out, usd} accumulated in memory; flushed to Convex `pipelineRuns:updateStatus` with `cost` arg + to Sanity `pipelineMetadata.cost` as JSON string; stub mode records {tokens: 0, usd: 0.0})
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-23 (durationMs = pipeline_end_ms - pipeline_start_ms, recorded inside Publisher OR FastAPI handler on failure; new optional field on Convex pipelineRuns)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-25 (max_tool_calls stored on function attribute; stub mode never trips the limit but the shape is here for Phase 5)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Pattern 5" lines 437-510 (record_cost signature: `record_cost(run_id, name, tokens_in=0, tokens_out=0, usd=0.0, duration_ms=...)`)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py`:

    ```python
    """Per-run cost + duration tracking. See CONTEXT D-22, D-23.

    Stub mode records 0 tokens/usd but shape is real so Phase 5 only swaps
    the values, not the structure.

    cost is JSON-stringified into:
      - Convex pipelineRuns.cost (v.optional(v.string()) — Plan 03 patches)
      - Sanity weeklyIssue.pipelineMetadata.cost (text field — Plan 04 patches)

    durationMs is plain int millis on Convex pipelineRuns.durationMs
    (v.optional(v.number()) — Plan 03 patches).
    """
    from __future__ import annotations
    import json
    import threading
    import time
    from typing import Optional, TypedDict


    class AgentCost(TypedDict):
        tokens_in: int
        tokens_out: int
        usd: float
        duration_ms: int


    # Module-level in-memory store keyed by run_id (mirrors convex_client._CLIENT
    # singleton pattern). Thread-safe via a lock — FastAPI runs concurrent
    # requests on a single event loop, but tests may exercise multiple runs.
    _store: dict[str, dict[str, AgentCost]] = {}
    _store_lock = threading.Lock()

    # Wall-clock start times keyed by run_id (CONTEXT D-23).
    _start_times: dict[str, float] = {}


    def begin_run(run_id: str) -> None:
        """Mark wall-clock start for a run. Called from FastAPI /run/weekly handler."""
        _start_times[run_id] = time.monotonic()
        with _store_lock:
            _store[run_id] = {}


    def record_cost(
        run_id: str,
        agent_name: str,
        *,
        tokens_in: int = 0,
        tokens_out: int = 0,
        usd: float = 0.0,
        duration_ms: int = 0,
    ) -> None:
        """Record one agent's cost contribution. Stub mode passes all 0s.

        Called by the @agent_node wrapper after each successful agent execution.
        """
        with _store_lock:
            agents = _store.setdefault(run_id, {})
            existing = agents.get(agent_name, AgentCost(
                tokens_in=0, tokens_out=0, usd=0.0, duration_ms=0
            ))
            agents[agent_name] = AgentCost(
                tokens_in=existing["tokens_in"] + tokens_in,
                tokens_out=existing["tokens_out"] + tokens_out,
                usd=existing["usd"] + usd,
                duration_ms=existing["duration_ms"] + duration_ms,
            )


    def get_cost_payload(run_id: str) -> dict:
        """Return the shape-locked cost payload for a run.

        Shape (matches what's JSON-stringified into Sanity + Convex):
            {
              "total": <sum_of_usd>,
              "agents": {
                "calibrator": {"tokens_in": 0, "tokens_out": 0, "usd": 0.0, "duration_ms": 12},
                ...
              }
            }
        """
        with _store_lock:
            agents = dict(_store.get(run_id, {}))
        total = sum(a["usd"] for a in agents.values())
        return {"total": total, "agents": agents}


    def get_duration_ms(run_id: str) -> Optional[int]:
        """Wall-clock duration in milliseconds. None if begin_run() not called."""
        start = _start_times.get(run_id)
        if start is None:
            return None
        return int((time.monotonic() - start) * 1000)


    def end_run(run_id: str) -> tuple[dict, Optional[int]]:
        """Return (cost_payload, duration_ms) AND clear in-memory state for run_id.

        Called by Publisher node (success path) or FastAPI handler (failure path).
        """
        payload = get_cost_payload(run_id)
        duration = get_duration_ms(run_id)
        with _store_lock:
            _store.pop(run_id, None)
        _start_times.pop(run_id, None)
        return payload, duration


    def cost_payload_to_json(payload: dict) -> str:
        """JSON-stringify for Sanity pipelineMetadata.cost and Convex pipelineRuns.cost."""
        return json.dumps(payload)
    ```

    Notes:
    - `begin_run` is called from `POST /run/weekly` (Plan 09) right after `new_run_id()`.
    - `record_cost` is called from the `@agent_node` wrapper (Plan 06).
    - `end_run` is called from Publisher (Plan 07) on success OR from FastAPI handler on failure.
    - In-memory store is per-process — Phase 5 may move it to Convex if costs need cross-instance aggregation, but Phase 4's lifespan-owned single-worker model is fine.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.cost import begin_run, record_cost, get_cost_payload, get_duration_ms, end_run, cost_payload_to_json; import time; rid='test-cost-run'; begin_run(rid); time.sleep(0.01); record_cost(rid, 'calibrator', tokens_in=0, tokens_out=0, usd=0.0, duration_ms=5); p = get_cost_payload(rid); assert p['total'] == 0.0; assert 'calibrator' in p['agents']; assert p['agents']['calibrator']['duration_ms'] == 5; d = get_duration_ms(rid); assert d is not None and d >= 0; payload, dur = end_run(rid); assert payload == p; assert dur is not None; s = cost_payload_to_json(payload); assert 'agents' in s and 'calibrator' in s; print('OK')"</automated>
  </verify>
  <done>
    - `CostRecorder` machinery exposes `begin_run`, `record_cost`, `get_cost_payload`, `get_duration_ms`, `end_run`, `cost_payload_to_json`
    - `get_cost_payload(run_id)` returns `{"total": float, "agents": {agent_name: AgentCost}}`
    - `record_cost(run_id, agent_name, tokens_in=, tokens_out=, usd=, duration_ms=)` accumulates additively per agent (call twice → sums)
    - `end_run` returns `(payload, duration_ms)` and clears the in-memory record
    - Thread-safe via a single `threading.Lock` (handles edge case where pytest runs concurrent runs)
  </done>
</task>

</tasks>

<verification>
After all five tasks:

1. `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState; from eisenbalm_pipeline.lib.portable_text import text_to_portable_text; from eisenbalm_pipeline.lib.convex_client import convex_mutation; from eisenbalm_pipeline.lib.sanity_client import write_issue_draft; from eisenbalm_pipeline.lib.cost import begin_run, record_cost, end_run; from eisenbalm_pipeline.lib.ids import new_run_id; print('all imports OK')"` succeeds.

2. `grep -F "Authorization: Convex " packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` succeeds (NOT Bearer for Convex).

3. `grep -F "Authorization\": f\"Bearer " packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` succeeds (Bearer for Sanity).

4. `grep -F "pipelineMetadata" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` AND `grep -F "'cost': json.dumps" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` succeed (D-22 evidence).

5. `grep -F "_force_no_winner" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` AND `grep -F "_force_fail_agent" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` succeed (research §"Open Questions" Q3 fields present).
</verification>

<success_criteria>
- PIP-05 contract foundation: every datastore client receives runId as part of its args dict. `new_run_id()` is the only generator and is callable once per request.
- DispatchState is byte-for-byte API_CONTRACTS §7 (plus two underscore-prefixed test toggles). No agent in Wave 2 can invent fields.
- Convex auth uses `Convex {key}`, NOT `Bearer {key}` — verified by grep.
- Sanity writes target `/v2024-01-01/data/mutate/{dataset}` with `Bearer {SANITY_API_TOKEN}` — verified by grep.
- CostRecorder is the single source of truth for `pipelineRuns.cost` + `pipelineRuns.durationMs`.
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-02-dispatch-state-and-lib-modules-SUMMARY.md` recording:
- The `setIfMissing` vs `set` decision in `set_charity_first_featured` (Claude's discretion)
- That `_force_no_winner` and `_force_fail_agent` were added to DispatchState under the underscore-prefix convention (research §"Open Questions" Q3)
- Forward link to Plan 06 (@agent_node wrapper imports `convex_client.convex_mutation_safe` + `cost.record_cost`) and Plan 07 (stub agents import `DispatchState`)
</output>
