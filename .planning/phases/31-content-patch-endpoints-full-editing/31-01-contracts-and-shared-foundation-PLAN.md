---
phase: 31-content-patch-endpoints-full-editing
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/theme_validation.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/structural_floor.py
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
  - packages/pipeline/tests/test_content_patch_endpoints.py
autonomous: true
requirements: [EDT-01, EDT-02, EDT-03, EDT-05]
user_setup: []

must_haves:
  truths:
    - "docs/API_CONTRACTS.md contains a §31.x section documenting every content-patch endpoint, the ifRevisionID revision guard, the asset-upload flow, the draft-read GET, and the rerun-clobber ordering rule — written BEFORE any endpoint code exists"
    - "A reverse Portable-Text → block-row mapper exists and flags lossy blocks"
    - "A single operator-facing theme validator (hex + 9-font whitelist matching apps/web/lib/theme.ts) exists pipeline-side"
    - "A standalone warn-only structural-floor counter exists (does not raise)"
    - "_emit_audit forwards optional before/after snapshot strings to auditLog:record"
    - "A pipeline pytest scaffold file for the content-patch endpoint family exists (skipped placeholders) so later backend plans fill real assertions"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§31.x content-patch endpoint family contract"
      contains: "## Phase 31"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py"
      provides: "pt_to_blocks() reverse mapper with lossy detection"
      contains: "def pt_to_blocks"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/theme_validation.py"
      provides: "CONTENT_FONT_WHITELIST (9 fonts) + HEX_REGEX + validate_theme_fields()"
      contains: "CONTENT_FONT_WHITELIST"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/structural_floor.py"
      provides: "structural_floor_warnings() warn-only counter"
      contains: "def structural_floor_warnings"
    - path: "packages/pipeline/tests/test_content_patch_endpoints.py"
      provides: "Wave-0 pytest scaffold for the endpoint family"
      contains: "test_content_patch"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/control.py::_emit_audit"
      to: "convex auditLog:record"
      via: "before/after kwargs forwarded into args dict"
      pattern: "before is not None"
---

<objective>
Establish the contract and the shared, dependency-free foundation every later Phase 31 plan builds on: amend `docs/API_CONTRACTS.md` with the §31 content-patch endpoint family (CLAUDE.md contract-first hard rule — must land BEFORE any endpoint/UI code), add the two missing reversible/validation primitives the endpoints need (`pt_to_blocks()` reverse mapper, an operator-facing theme validator that matches what the live site actually renders, a warn-only structural-floor counter), extend `_emit_audit` to carry before/after snapshots (D-09), and lay down the Wave-0 pipeline pytest scaffold.

Purpose: Contract-first sequencing + collapse all shared helpers into one blocking foundation so Waves 2-3 (backend lib, endpoints, frontend) can proceed in parallel against a fixed contract.
Output: §31 contract, 3 new/extended lib modules, extended `_emit_audit`, and a skipped pytest scaffold.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/31-content-patch-endpoints-full-editing/31-CONTEXT.md
@.planning/phases/31-content-patch-endpoints-full-editing/31-RESEARCH.md

<interfaces>
<!-- BodyBlock (graph/blocks.py) — the shape both compose_section_body and pt_to_blocks map: -->
class BodyBlock(BaseModel):
    type: Literal['paragraph', 'h2', 'h3', 'blockquote']
    text: str

<!-- compose_section_body (lib/portable_text.py) is WRITE-only. block_paragraph/h2/h3/blockquote
     always emit exactly one child span with marks: []. pt_to_blocks is the missing inverse. -->

<!-- web canonical whitelist (apps/web/lib/theme.ts) — the render-time gate to mirror EXACTLY: -->
FONT_WHITELIST = ['Playfair Display','Lora','Inter','Cormorant Garamond','Merriweather','DM Serif Display','Fraunces','Newsreader','IBM Plex Mono']
HEX_REGEX = /^#[0-9a-fA-F]{6}$/

<!-- structural floor counting (agents/origin_story.py::_enforce_structural_floor) —
     >=2 blocks with type in ('h2','h3') AND >=1 with type=='blockquote'. Reuse the COUNT, not the raise. -->

<!-- current _emit_audit signature (api/control.py) — extend, do not rewrite: -->
async def _emit_audit(http, *, actor_id, action, resource_type=None, resource_id=None) -> None
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md with the §31 content-patch endpoint family (contract-first)</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md (read §26.7 FastAPI endpoints ~L2179 as the shape template; read the file tail to find the last section so §31 appends after Phase 27)
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py (the endpoint skeleton these clone — guard order, 409 {reason,message})
    - .planning/phases/31-content-patch-endpoints-full-editing/31-RESEARCH.md (§"Recommended Project Structure — Endpoint list", §"Field Inventory", Pitfall 1, State-of-the-Art rerun-clobber note)
  </read_first>
  <action>
Append a new top-level section `## Phase 31 — Content-Patch Endpoints + Full Editing` at the END of docs/API_CONTRACTS.md (after the Phase 27 §27.6 block, before "## Error handling rules" if that is last — otherwise at true EOF). Document, verbatim and concretely:

**§31.1 — Target document identity (load-bearing correction).** Every endpoint resolves `run_id → sanityIssueId` via `pipelineRuns:byRunId` (same as review.py), and patches the PLAIN Sanity `_id` `issue-{n}`. State explicitly: "This app does NOT use Sanity's drafts/publish system — there is no `drafts.` prefix. Never target `drafts.issue-{n}`."

**§31.2 — Endpoint family** (all Clerk-JWT-guarded via `_require_clerk_jwt_control`, mounted in api/content.py):
```
PATCH /issues/{run_id}/sections/{section_name}   # EDT-01 prose body — section_name in: originStory, problemStatement, founderBio, caseStudy
PATCH /issues/{run_id}/headlines/{section_name}  # EDT-02 headline string
PATCH /issues/{run_id}/theme                     # EDT-02 theme (hex+font HARD-validated)
PATCH /issues/{run_id}/game                      # EDT-02 game.headline/description/embedCode (embed size cap)
PATCH /issues/{run_id}/pdf-data-points           # EDT-02 problemStatement.pdfContent.{problemStatement,keyDataPoints[3],interventionMechanism}
PATCH /issues/{run_id}/bonus                     # EDT-01/02 variant-shaped: specAd→body / bigBudget→storyboards / jingle→lyrics+sunoPrompt
PATCH /issues/{run_id}/deliberation-conversation # EDT-01 selectionDeliberation.conversation[] turn list ({speaker,text})
PATCH /issues/{run_id}/podcast-transcript        # EDT-01 podcast.deliberationTranscript textarea
POST  /issues/{run_id}/assets/{slot}             # EDT-03 raw-binary upload; slot in: podcast-audio, suno-audio, storyboard-{i}
GET   /issues/{run_id}/draft                      # read path for the editor
```

**§31.3 — Request body shape.** Every PATCH body includes `ifRevisionID: string` (required) plus a payload. Document the section-body payload as `{ ifRevisionID: string, blocks: [{type: 'paragraph'|'h2'|'h3'|'blockquote', text: string}] }`. Document theme payload as `{ ifRevisionID, primaryColor, accentColor, backgroundColor, textColor, fontDisplay, fontBody, visualDirection }`.

**§31.4 — Revision guard.** State `ifRevisionID` is a TOP-LEVEL key of the Sanity patch object (sibling to `id`/`set`), not nested under `options`. A revision mismatch → Sanity returns HTTP 409 → endpoint re-raises FastAPI `HTTPException(409, detail={"reason":"revision_mismatch","message":"This section changed since you loaded it. Reload and reapply your edit."})`.

**§31.5 — Validation split (D-08).** HARD-block (return 4xx `{reason:"validation_failed", message, fields:[...]}`): theme hex (`^#[0-9a-fA-F]{6}$`) + font membership in the canonical 9-font whitelist (list them; note it MIRRORS apps/web/lib/theme.ts FONT_WHITELIST, the render-time gate); game embed byte-length ≤ 50000. WARN-only (return 200 with `warnings: [str]`): the editorial structural floor (≥2 sub-headers + ≥1 blockquote) on the 5 long-reads.

**§31.6 — Asset upload.** Raw binary POST body (NOT multipart; `python-multipart` is not installed). Inbound headers: `X-Filename`, `Content-Type` (asset MIME). Flow: POST bytes to Sanity `/assets/{files|images}/{dataset}` → get `{document:{_id,url}}` → scoped patch the reference `{_type:'file'|'image', asset:{_type:'reference', _ref:assetId}}` onto the slot field. Response: `{ assetUrl, assetId, revisionId }` (assetUrl = Sanity CDN url for D-13 inline preview). D-12: overwrite leaves the old asset in Sanity and records the swap in audit. **EXCEPTION — `suno-audio` slot:** `bonus.sunoAudioUrl` is a `type: 'url'` (plain string) field in weeklyIssue.ts (~L289) and the live site renders `<audio src={bonus.sunoAudioUrl}>` — for this slot ONLY, the endpoint uploads the asset then `set`s the returned CDN **URL string** into `bonus.sunoAudioUrl` (NOT a `{_type:'file', asset:{_ref}}` reference object). No schema change; podcast-audio and storyboard slots use asset references as normal.

**§31.7 — Draft-read GET response.** `{ revisionId, sections: {<name>: {headline, blocks:[{type,text}], lossy: boolean}}, theme, game, bonus, bonusType, podcast, deliberation }`. `bonusType` (`specAd` | `bigBudget` | `jingle`) is the TOP-LEVEL weeklyIssue field (sibling of `bonus`, weeklyIssue.ts ~L103) — the editor switches its bonus-editor variant on it (D-05). `lossy: true` when a stored PT block had `markDefs.length>0` or `children.length>1` (marks flattened by pt_to_blocks).

**§31.8 — Audit shape (D-09).** Every content mutation writes one `auditLog:record` row via `_emit_audit` with `action` = `content.section_patched` / `content.theme_patched` / `content.asset_uploaded` etc., plus truncated `before`/`after` (2000-char cap, `...[truncated]` suffix).

**§31.9 — Known interaction risk (rerun-clobber ordering rule).** Document explicitly: `rerun_agent` (RUN-05, api/control.py) rebuilds state from the LangGraph checkpoint and calls full `write_issue_draft` (createOrReplace), which will OVERWRITE any operator content-patch edits to sibling sections with checkpoint content. v1 position: this is a documented ordering rule — "re-roll a section BEFORE making console edits, never after." The editor surfaces a static advisory (Plan 05). Full re-read-current-Sanity guard is deferred to a later phase.
  </action>
  <verify>
    <automated>grep -q "## Phase 31" docs/API_CONTRACTS.md && grep -q "revision_mismatch" docs/API_CONTRACTS.md && grep -q "python-multipart" docs/API_CONTRACTS.md && grep -q "rerun_agent" docs/API_CONTRACTS.md && grep -qi "drafts\." docs/API_CONTRACTS.md && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "PATCH /issues/{run_id}" docs/API_CONTRACTS.md` returns ≥ 6
    - `grep -q "GET   /issues/{run_id}/draft\|GET /issues/{run_id}/draft" docs/API_CONTRACTS.md` succeeds
    - `grep -q "ifRevisionID" docs/API_CONTRACTS.md` and the text states it is a top-level patch key
    - `grep -q "revision_mismatch" docs/API_CONTRACTS.md` and `grep -q "validation_failed" docs/API_CONTRACTS.md`
    - `grep -q "IBM Plex Mono" docs/API_CONTRACTS.md` (font whitelist enumerated) and `grep -q "50000\|50KB\|50 KB" docs/API_CONTRACTS.md` (embed cap)
    - The §31.9 rerun-clobber paragraph names `rerun_agent` and states the ordering rule
    - The §31.1 paragraph states there is NO `drafts.` prefix
  </acceptance_criteria>
  <done>docs/API_CONTRACTS.md has a complete §31 section covering all 10 routes, revision guard, validation split, asset flow, draft-read lossy field, audit shape, and the rerun-clobber ordering rule — committed before any endpoint code.</done>
</task>

<task type="auto">
  <name>Task 2: Add pt_to_blocks() reverse mapper, theme_validation module, and structural_floor helper</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py, packages/pipeline/src/eisenbalm_pipeline/lib/theme_validation.py, packages/pipeline/src/eisenbalm_pipeline/lib/structural_floor.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py (compose_section_body, block_* builders — pt_to_blocks is their inverse)
    - packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py (BodyBlock.type Literal values)
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py (lines 60-90 — the _enforce_structural_floor count logic to mirror)
    - apps/web/lib/theme.ts (FONT_WHITELIST 9 entries + HEX_REGEX — the canonical operator-facing gate)
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py (the DRIFTED 17-entry list — do NOT reuse for operator validation; note the divergence)
  </read_first>
  <action>
Three additions:

**(A) `lib/portable_text.py` — add `pt_to_blocks()`:**
```python
def pt_to_blocks(pt_blocks: list[dict]) -> tuple[list[dict], bool]:
    """Inverse of compose_section_body. Returns ({type,text}[] rows, lossy).
    lossy=True if ANY block had markDefs (len>0) or multiple children spans —
    those marks/spans are flattened by the naive text-join (v1 limitation:
    the block model was never inline-WYSIWYG). See API_CONTRACTS §31.7."""
    style_to_type = {"h2": "h2", "h3": "h3", "blockquote": "blockquote"}
    rows: list[dict] = []
    lossy = False
    for b in pt_blocks or []:
        children = b.get("children") or []
        if (b.get("markDefs") or []) or len(children) > 1:
            lossy = True
        block_type = style_to_type.get(b.get("style"), "paragraph")
        text = "".join(c.get("text", "") for c in children)
        rows.append({"type": block_type, "text": text})
    return rows, lossy
```
Also emit a `logging.warning(...)` when `lossy` becomes True so data loss is visible in Railway logs, not silent.

**(B) NEW file `lib/theme_validation.py`** — the single operator-facing theme validator (canonical = the 9-font web list, since web render is what actually breaks; the DesignAgent font_whitelist.py drift is a SEPARATE, out-of-scope concern documented here):
```python
import re
CONTENT_FONT_WHITELIST = frozenset({
    "Playfair Display","Lora","Inter","Cormorant Garamond","Merriweather",
    "DM Serif Display","Fraunces","Newsreader","IBM Plex Mono",
})  # MIRRORS apps/web/lib/theme.ts FONT_WHITELIST (render-time gate). Keep in sync.
HEX_REGEX = re.compile(r"^#[0-9a-fA-F]{6}$")

def validate_theme_fields(theme: dict) -> list[str]:
    """Return list of failed field names (empty = valid). HARD-block on any failure."""
    failed = []
    for f in ("primaryColor","accentColor","backgroundColor","textColor"):
        v = theme.get(f)
        if v is not None and not HEX_REGEX.match(str(v)):
            failed.append(f)
    for f in ("fontDisplay","fontBody"):
        v = theme.get(f)
        if v is not None and v not in CONTENT_FONT_WHITELIST:
            failed.append(f)
    return failed

GAME_EMBED_MAX_BYTES = 50000
def validate_game_embed(embed_code: str) -> bool:
    return len(embed_code.encode("utf-8")) <= GAME_EMBED_MAX_BYTES
```

**(C) NEW file `lib/structural_floor.py`** — warn-only counter (does NOT raise; distinct from the Pydantic validator's raise-based flow per RESEARCH Pitfall 5):
```python
def structural_floor_warnings(blocks: list[dict]) -> list[str]:
    """WARN-only floor check for operator edits (D-08). Never raises.
    blocks: [{type, text}]."""
    heading = sum(1 for b in blocks if b.get("type") in ("h2","h3"))
    quote = sum(1 for b in blocks if b.get("type") == "blockquote")
    warnings = []
    if heading < 2:
        warnings.append(f"structural-floor: {heading}/2 sub-headers (h2/h3)")
    if quote < 1:
        warnings.append(f"structural-floor: {quote}/1 blockquote")
    return warnings
```
Do NOT modify the existing `_enforce_structural_floor` Pydantic validators in agents/*.py.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.portable_text import pt_to_blocks; from eisenbalm_pipeline.lib.theme_validation import validate_theme_fields, validate_game_embed, CONTENT_FONT_WHITELIST; from eisenbalm_pipeline.lib.structural_floor import structural_floor_warnings; r,l=pt_to_blocks([{'style':'h2','children':[{'text':'Hi'}]},{'style':'normal','children':[{'text':'a'},{'text':'b'}],'markDefs':[]}]); assert r==[{'type':'h2','text':'Hi'},{'type':'paragraph','text':'ab'}], r; assert l is True; assert validate_theme_fields({'primaryColor':'#ZZZZZZ','fontDisplay':'Spectral'})==['primaryColor','fontDisplay']; assert validate_theme_fields({'primaryColor':'#CDA434','fontDisplay':'Fraunces'})==[]; assert validate_game_embed('x'*50001) is False; assert structural_floor_warnings([{'type':'paragraph','text':'a'}])==['structural-floor: 0/2 sub-headers (h2/h3)','structural-floor: 0/1 blockquote']; assert len(CONTENT_FONT_WHITELIST)==9; print('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "def pt_to_blocks" packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py`
    - `pt_to_blocks` returns a 2-tuple `(rows, lossy)` and sets `lossy=True` when `markDefs` non-empty OR `len(children)>1`
    - `packages/pipeline/src/eisenbalm_pipeline/lib/theme_validation.py` exists; `CONTENT_FONT_WHITELIST` has exactly 9 entries matching apps/web/lib/theme.ts FONT_WHITELIST
    - `grep -q "GAME_EMBED_MAX_BYTES = 50000" packages/pipeline/src/eisenbalm_pipeline/lib/theme_validation.py`
    - `packages/pipeline/src/eisenbalm_pipeline/lib/structural_floor.py` exists; `structural_floor_warnings` returns a list and never raises
    - `git diff --stat` shows agents/origin_story.py, problem.py, founder_bio.py, case_study.py, bonus.py are UNCHANGED
    - the inline verify python one-liner prints OK
  </acceptance_criteria>
  <done>Three shared primitives exist and pass the inline assertions; the existing Pydantic floor validators are untouched; theme validator is the canonical 9-font operator gate.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Extend _emit_audit for before/after snapshots + Wave-0 pytest scaffold</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/control.py, packages/pipeline/tests/test_content_patch_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (lines 134-165 — current _emit_audit; extend the signature + args dict)
    - convex/auditLog.ts (confirm record mutation already accepts optional before/after string args)
    - packages/pipeline/tests/test_review_endpoints.py (the monkeypatch-on-_cc pattern to mirror in the scaffold)
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py (_truncate 2000-char pattern to reuse for snapshot truncation)
  </read_first>
  <behavior>
    - Test: _emit_audit called with before="X", after="Y" forwards before/after into the convex_mutation args dict
    - Test: _emit_audit called without before/after omits both keys (back-compat)
    - Test scaffold file test_content_patch_endpoints.py imports cleanly and its placeholder tests are collected as skipped
  </behavior>
  <action>
**(A)** Extend `_emit_audit` in api/control.py — add two kwargs and forward them (mirror the existing resource_type/resource_id conditional pattern):
```python
async def _emit_audit(http, *, actor_id, action, resource_type=None,
                      resource_id=None, before=None, after=None) -> None:
    args = {"workspace_id": WORKSPACE_ID, "actorId": actor_id, "action": action}
    if resource_type is not None: args["resourceType"] = resource_type
    if resource_id is not None: args["resourceId"] = resource_id
    if before is not None: args["before"] = before
    if after is not None: args["after"] = after
    ...  # unchanged try/except convex_mutation
```
This is additive — all existing callers (review.py, control.py) keep working unchanged.

**(B)** Create `packages/pipeline/tests/test_content_patch_endpoints.py` as the Wave-0 scaffold. Include:
- one PASSING test asserting the `_emit_audit` before/after extension: monkeypatch `_cc.convex_mutation` to capture args, call `_emit_audit(None, actor_id="a", action="content.section_patched", before="B", after="A")`, assert captured args include `before=="B"` and `after=="A"`; and a second call without before/after asserts neither key present.
- SKIPPED placeholders (via `@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")`) named exactly: `test_patch_section_scoped`, `test_patch_revision_mismatch`, `test_theme_patch_validation`, `test_structural_floor_warns_not_blocks`, `test_upload_asset_patches_reference`, `test_audit_row_truncated_snapshot`, `test_asset_overwrite_audit_swap`, `test_asset_overwrite_audit_swap_records_audit`, `test_bonus_patch_variant_shaped`, `test_draft_read_lossy_flag`.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "before=None, after=None" packages/pipeline/src/eisenbalm_pipeline/api/control.py`
    - `grep -q 'args\["before"\] = before' packages/pipeline/src/eisenbalm_pipeline/api/control.py`
    - `pytest tests/test_content_patch_endpoints.py -q` reports the `_emit_audit` test(s) passing and 10 skipped placeholders, 0 failures
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/test_content_patch_endpoints.py` returns ≥ 10
    - `cd packages/pipeline && uv run pytest -x -q` (full suite) reports 0 failures (no regression from the _emit_audit change)
  </acceptance_criteria>
  <done>_emit_audit forwards before/after; the content-patch test scaffold exists with a green audit test + 10 named skipped placeholders; full pipeline suite stays green.</done>
</task>

</tasks>

<verification>
- `grep -q "## Phase 31" docs/API_CONTRACTS.md` — contract landed first
- `uv run pytest tests/test_content_patch_endpoints.py -q` — scaffold collected, audit test green
- `uv run pytest -x -q` — full pipeline suite green (no regression)
- All new lib modules importable (Task 2 inline verify prints OK)
</verification>

<success_criteria>
- §31 contract fully documents the endpoint family, revision guard, validation split, asset flow, draft-read lossy field, and rerun-clobber ordering rule — before any endpoint code
- pt_to_blocks, theme_validation (9-font canonical), structural_floor helpers exist and are unit-verified
- _emit_audit carries before/after; existing callers unaffected; full pytest suite green
</success_criteria>

<output>
After completion, create `.planning/phases/31-content-patch-endpoints-full-editing/31-01-SUMMARY.md`
</output>
