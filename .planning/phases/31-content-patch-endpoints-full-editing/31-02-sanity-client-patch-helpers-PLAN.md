---
phase: 31-content-patch-endpoints-full-editing
plan: 02
type: execute
wave: 2
depends_on: [1]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
  - packages/pipeline/tests/test_content_patch_endpoints.py
autonomous: true
requirements: [EDT-01, EDT-02, EDT-03]
user_setup: []

must_haves:
  truths:
    - "A scoped dotted-path patch helper writes exactly one field, targets the plain issue-{n} id, carries ifRevisionID, and re-raises Sanity's 409 as a structured revision_mismatch 409"
    - "A get_issue_draft() helper reads the current draft and returns its revision id + section blocks via pt_to_blocks (with lossy flag)"
    - "A generalized upload_asset() uploads raw binary to the correct Sanity assets endpoint (files vs images) and returns {assetUrl, assetId}"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "patch_issue_field(), get_issue_draft(), upload_asset()"
      contains: "def patch_issue_field"
    - path: "packages/pipeline/tests/test_content_patch_endpoints.py"
      provides: "httpx.MockTransport unit tests for the three helpers"
      contains: "MockTransport"
  key_links:
    - from: "lib/sanity_client.py::patch_issue_field"
      to: "Sanity /data/mutate/{dataset}"
      via: "ifRevisionID top-level patch key + set dotted path"
      pattern: "ifRevisionID"
    - from: "lib/sanity_client.py::upload_asset"
      to: "Sanity /assets/{files|images}/{dataset}"
      via: "raw binary content= POST then reference patch"
      pattern: "/assets/"
---

<objective>
Add the three Sanity-client primitives the content-patch endpoints call: a scoped dotted-path `patch_issue_field()` (the core write primitive with the `ifRevisionID` revision guard → structured 409), a `get_issue_draft()` read helper (for the editor's GET), and a generalized `upload_asset()` (extends `upload_pdf_to_issue`'s upload-then-patch-reference pattern to any file/image). Unit-test all three with `httpx.MockTransport`, filling scaffold placeholders from Plan 01.

Purpose: Isolate the Sanity HTTP mechanics in the lib layer (matching the existing file's conventions) so `api/content.py` (Plan 03) is a thin, guard-focused router.
Output: 3 new functions in sanity_client.py + real assertions replacing 5 scaffold placeholders.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/31-content-patch-endpoints-full-editing/31-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Existing sanity_client.py conventions to reuse (verified): -->
API_VERSION = "v2024-01-01"
def _dataset() -> str                 # dataset name
def _auth_headers() -> dict           # {"Authorization": "Bearer <SANITY_API_TOKEN>", "Content-Type": "application/json"}
# mutate:  POST f"/{API_VERSION}/data/mutate/{_dataset()}"  json={"mutations":[...]}
# query:   POST f"/{API_VERSION}/data/query/{_dataset()}"   (groq_query helper exists)
# assets:  POST f"/{API_VERSION}/assets/files/{_dataset()}" params={"filename":...} content=<bytes> headers={Authorization, Content-Type}
# upload_pdf_to_issue (L283-331) is the exact upload->patch-reference precedent; asset id at r.json()["document"]["_id"], url at ["document"]["url"]

<!-- From Plan 01: -->
from eisenbalm_pipeline.lib.portable_text import pt_to_blocks       # (rows, lossy)
from eisenbalm_pipeline.lib.portable_text import compose_section_body  # blocks -> PT (write)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: patch_issue_field() scoped dotted-path patch with ifRevisionID to 409</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py, packages/pipeline/tests/test_content_patch_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (set_charity_first_featured ~L444, _dataset, _auth_headers, API_VERSION, write_issue_draft mutate call ~L275 — mirror the mutate POST shape)
    - docs/API_CONTRACTS.md §31.3/§31.4 (revision guard contract from Plan 01)
    - packages/pipeline/tests/test_content_patch_endpoints.py (scaffold placeholders test_patch_section_scoped, test_patch_revision_mismatch)
  </read_first>
  <behavior>
    - Test test_patch_section_scoped: patch_issue_field(http, issue_id="issue-42", field_path="originStory.body", value=<composed blocks>, if_revision_id="rev-1") posts a mutation whose patch object has id=="issue-42" (NO drafts. prefix), ifRevisionID=="rev-1", and set=={"originStory.body": <blocks>}; nothing else in set
    - Test test_patch_revision_mismatch: when the mocked Sanity endpoint returns HTTP 409, patch_issue_field raises HTTPException(status_code=409) with detail["reason"]=="revision_mismatch"
  </behavior>
  <action>
Add to sanity_client.py (import HTTPException from fastapi and os at top if not present):
```python
from fastapi import HTTPException

async def patch_issue_field(
    http: AsyncClient, *, issue_id: str, field_path: str, value,
    if_revision_id: str,
) -> str:
    """Scoped dotted-path patch of ONE field. Targets the plain issue-{n} id
    (NEVER drafts.). Returns the new revision id (_rev). Raises structured
    409 on ifRevisionID mismatch. See API_CONTRACTS §31.3/§31.4."""
    payload = {
        "mutations": [{
            "patch": {
                "id": issue_id,                 # plain id — no drafts. prefix
                "ifRevisionID": if_revision_id, # TOP-LEVEL key
                "set": {field_path: value},
            }
        }],
        "returnIds": True,
    }
    r = await http.post(
        f"/{API_VERSION}/data/mutate/{_dataset()}",
        json=payload, headers=_auth_headers(),
    )
    if r.status_code == 409:
        raise HTTPException(status_code=409, detail={
            "reason": "revision_mismatch",
            "message": "This section changed since you loaded it. Reload and reapply your edit.",
        })
    r.raise_for_status()
    return await _fetch_issue_rev(http, issue_id)
```
Add a small `_fetch_issue_rev(http, issue_id) -> str` helper that GROQ-queries `*[_id==$id][0]{_rev}` (reuse the existing `data/query/{dataset}` POST mechanics) and returns `_rev`. RESEARCH flags `returnDocuments` as unverified on v2024-01-01 — the separate `_rev` read is the safe path; do NOT rely on parsing `_rev` out of the mutate response.

Callers pass `value` already-serialized: section-body callers pass `compose_section_body(blocks)`; scalar-field callers pass the raw string/object.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py::test_patch_section_scoped tests/test_content_patch_endpoints.py::test_patch_revision_mismatch -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "def patch_issue_field" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`
    - `grep -q '"ifRevisionID": if_revision_id' packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`
    - The patch `id` is set to the raw `issue_id` param with NO `drafts.` prefix (`grep -n "drafts\." packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns no hits)
    - test_patch_section_scoped and test_patch_revision_mismatch pass (skip decorator removed)
    - The 409 branch raises `HTTPException` with `detail["reason"]=="revision_mismatch"`
  </acceptance_criteria>
  <done>patch_issue_field writes one scoped field to the plain issue id with a revision guard and maps Sanity's native 409 to the structured revision_mismatch detail; both scaffold tests un-skipped and green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: get_issue_draft() read helper</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py, packages/pipeline/tests/test_content_patch_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (groq_query ~L358, fetch_narrator_by_slug ~L406 — the GROQ read pattern)
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py (pt_to_blocks from Plan 01)
    - apps/studio/schemas/weeklyIssue.ts (field paths: originStory/problemStatement/founderBio/caseStudy .headline/.body, theme, game, bonus, podcast, selectionDeliberation.conversation)
    - docs/API_CONTRACTS.md §31.7 (draft-read response shape + lossy field)
  </read_first>
  <behavior>
    - Test test_draft_read_lossy_flag: get_issue_draft returns a dict with revisionId and sections[<name>] = {headline, blocks, lossy}; a section whose stored PT block had markDefs sets that section's lossy=True; row types round-trip (h2/blockquote/paragraph)
  </behavior>
  <action>
Add to sanity_client.py:
```python
_DRAFT_GROQ = (
    '*[_id == $id][0]{ _rev, theme, game, bonus, bonusType, podcast, '
    'originStory, problemStatement, founderBio, caseStudy, '
    '"conversation": selectionDeliberation.conversation }'
)
_LONG_READS = ("originStory", "problemStatement", "founderBio", "caseStudy")

async def get_issue_draft(http: AsyncClient, issue_id: str) -> dict:
    """Read the current draft for the editor. Converts each long-read's PT body
    back to {type,text}[] rows via pt_to_blocks and surfaces per-section lossy.
    See API_CONTRACTS §31.7."""
    result = await _groq(http, _DRAFT_GROQ, {"id": issue_id})
    doc = result[0] if result else None
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Issue not found: {issue_id}")
    sections = {}
    for name in _LONG_READS:
        sec = doc.get(name) or {}
        rows, lossy = pt_to_blocks(sec.get("body") or [])
        sections[name] = {"headline": sec.get("headline", ""), "blocks": rows, "lossy": lossy}
    return {
        "revisionId": doc.get("_rev"),
        "sections": sections,
        "theme": doc.get("theme") or {},
        "game": doc.get("game") or {},
        "bonus": doc.get("bonus") or {},
        "podcast": doc.get("podcast") or {},
        "bonusType": doc.get("bonusType"),
        "conversation": doc.get("conversation") or [],
    }
```
If no `_groq(http, query, params)` single low-level helper already exists, add a tiny one wrapping the existing `data/query/{dataset}` POST and returning the `result` list; otherwise reuse the existing helper. Do NOT invent a new HTTP shape.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py::test_draft_read_lossy_flag -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "def get_issue_draft" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`
    - Response dict keys include `revisionId`, `sections`, `theme`, `game`, `bonus`, `bonusType`, `podcast`, `conversation` (`bonusType` is the TOP-LEVEL weeklyIssue field the bonus editor switches on — D-05)
    - Each `sections[name]` dict has keys `headline`, `blocks`, `lossy`
    - test_draft_read_lossy_flag passes (un-skipped) and asserts lossy=True propagates from a markDefs-bearing block
  </acceptance_criteria>
  <done>get_issue_draft reads the plain issue id, decomposes each long-read body to editor rows via pt_to_blocks, and surfaces the per-section lossy flag; the scaffold test is un-skipped and green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: upload_asset() generalization (files + images)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py, packages/pipeline/tests/test_content_patch_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (upload_pdf_to_issue L283-331 — the exact upload->patch-reference precedent to generalize; DO NOT delete it, the Publisher uses it)
    - docs/API_CONTRACTS.md §31.6 (asset upload contract from Plan 01)
    - packages/pipeline/tests/test_content_patch_endpoints.py (test_upload_asset_patches_reference, test_asset_overwrite_audit_swap scaffolds)
  </read_first>
  <behavior>
    - Test test_upload_asset_patches_reference: upload_asset(asset_kind="file") POSTs bytes to /assets/files/{dataset}, then patch_issue_field writes {_type:'file', asset:{_type:'reference',_ref:<assetId>}} onto the slot field; returns {assetUrl, assetId, revisionId}; asset_kind="image" hits /assets/images/{dataset} with _type:'image'
    - Test test_asset_overwrite_audit_swap: a second upload_asset over the same slot returns a new assetId without error (overwrite semantics — old asset left in Sanity)
  </behavior>
  <action>
Add to sanity_client.py, generalizing upload_pdf_to_issue (keep upload_pdf_to_issue intact):
```python
async def upload_asset(
    http: AsyncClient, *, issue_id: str, field_path: str,
    file_bytes: bytes, filename: str, content_type: str,
    asset_kind: str,          # "file" (audio) | "image" (storyboard)
    if_revision_id: str,
) -> dict:
    """Upload raw binary to Sanity assets API, then scoped-patch a reference
    onto field_path. Returns {assetUrl, assetId, revisionId}. See §31.6."""
    endpoint = "files" if asset_kind == "file" else "images"
    r = await http.post(
        f"/{API_VERSION}/assets/{endpoint}/{_dataset()}",
        params={"filename": filename},
        content=file_bytes,
        headers={"Authorization": f"Bearer {os.environ['SANITY_API_TOKEN']}",
                 "Content-Type": content_type},
    )
    r.raise_for_status()
    doc = r.json()["document"]
    asset_id, asset_url = doc["_id"], doc["url"]
    ref_type = "file" if asset_kind == "file" else "image"
    new_rev = await patch_issue_field(
        http, issue_id=issue_id, field_path=field_path,
        value={"_type": ref_type, "asset": {"_type": "reference", "_ref": asset_id}},
        if_revision_id=if_revision_id,
    )
    return {"assetUrl": asset_url, "assetId": asset_id, "revisionId": new_rev}
```
In the tests, use `httpx.MockTransport` to fake BOTH the assets POST (return `{"document":{"_id":"image-abc","url":"https://cdn.sanity.io/.../f.png"}}`) and the mutate POST + the `_rev` read. test_asset_overwrite_audit_swap asserts the second call still returns the new reference without error (the audit swap ROW is asserted at the endpoint layer in Plan 03; here just assert the helper succeeds twice).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py::test_upload_asset_patches_reference tests/test_content_patch_endpoints.py::test_asset_overwrite_audit_swap -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "def upload_asset" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`
    - `upload_pdf_to_issue` still exists unchanged (`grep -q "def upload_pdf_to_issue" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`)
    - asset_kind="file" targets `/assets/files/` and asset_kind="image" targets `/assets/images/`; the patched reference `_type` is `file` for audio, `image` for storyboards
    - Return dict has keys `assetUrl`, `assetId`, `revisionId`
    - test_upload_asset_patches_reference and test_asset_overwrite_audit_swap pass (un-skipped)
    - `cd packages/pipeline && uv run pytest -x -q` full suite reports 0 failures
  </acceptance_criteria>
  <done>upload_asset generalizes the PDF upload to any file/image, patches the reference via patch_issue_field with the revision guard, and returns the CDN url for D-13 preview; both scaffold tests un-skipped; full suite green.</done>
</task>

</tasks>

<verification>
- `uv run pytest tests/test_content_patch_endpoints.py -q` — the 5 helper tests (patch scoped, revision mismatch, draft lossy, upload reference, overwrite) green; remaining scaffolds still skipped for Plan 03
- `uv run pytest -x -q` — full pipeline suite green (upload_pdf_to_issue and all existing sanity_client callers unaffected)
</verification>

<success_criteria>
- patch_issue_field, get_issue_draft, upload_asset exist and are unit-tested with httpx.MockTransport
- All three target the plain issue-{n} id (no drafts. prefix) and honor ifRevisionID
- upload_pdf_to_issue and the full pytest suite remain green
</success_criteria>

<output>
After completion, create `.planning/phases/31-content-patch-endpoints-full-editing/31-02-SUMMARY.md`
</output>
