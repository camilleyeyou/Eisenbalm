# Phase 31: Content-Patch Endpoints + Full Editing - Research

**Researched:** 2026-07-07
**Domain:** Sanity scoped-patch write boundary (FastAPI) + per-section block-editing UI (dispatch-control)
**Confidence:** HIGH

## Summary

This phase's backend is a direct, low-risk extension of two patterns that already exist and are proven in this exact codebase: `lib/sanity_client.py`'s existing `patch` mutation calls (`set_charity_first_featured`, `_flip_sanity_published`) and `upload_pdf_to_issue`'s upload-then-patch-reference sequence. The single load-bearing correction this research makes to the phase's own CONTEXT.md/PROJECT.md framing is that **this app does not use Sanity's native draft/publish system** — there is no `drafts.` ID prefix anywhere in the codebase. `write_issue_draft` writes a plain document `_id: issue-{n}` with a custom `status` string field (`draft` | `in-review` | `published`), and `_flip_sanity_published` patches that same plain ID. Every content-patch endpoint in this phase must therefore target `issue-{n}` directly — patching a nonexistent `drafts.issue-{n}` document would silently no-op or fail. This is the most important fact for the planner to internalize before writing any endpoint code.

The endpoint family clones `api/review.py`'s exact skeleton (Clerk-JWT guard via `_require_clerk_jwt_control`, ordered guards, `_emit_audit`, structured 409 detail shapes) and adds one genuinely new capability: Sanity's `ifRevisionID` optimistic-concurrency patch option, confirmed via official docs to return **HTTP 409** on mismatch — which maps directly onto FastAPI's existing 409-detail convention already used throughout `review.py`/`control.py`. The BodyBlock round-trip (Sanity Portable Text → `{type, text}[]` rows for the editor) has no existing reverse mapping — `compose_section_body` is write-only — so the new GET endpoint must implement PT→BodyBlock decomposition itself (a simple `style` → `type` inverse of the four existing builders). File uploads should use **raw binary POST bodies with custom headers** (mirroring `upload_pdf_to_issue`'s exact pattern), not FastAPI's multipart `UploadFile`, because `python-multipart` is not currently a pipeline dependency and raw-binary avoids adding it. A real gap found: the pipeline-side font whitelist (`agents/design/font_whitelist.py`, 17 fonts) and the web-side whitelist (`apps/web/lib/theme.ts` `FONT_WHITELIST`, 9 fonts) have **drifted out of sync** — the web whitelist added Fraunces/Newsreader/IBM Plex Mono in Phase 19 but the pipeline whitelist never did, and the pipeline whitelist has 8 fonts (Libre Baskerville, EB Garamond, Crimson Text, Spectral, Source Serif Pro, Bitter, PT Serif, Noto Serif, IBM Plex Serif) that the web whitelist doesn't recognize. D-08's theme-edit hard validation must decide which list is authoritative and reconcile them, or an operator-edited theme value could pass one validator and fail the other.

**Primary recommendation:** Clone `api/review.py`'s endpoint skeleton verbatim for the new router; use scoped `patch` with dotted-path `set` (e.g. `{"originStory.body": [...]}`) targeting the plain `issue-{n}` ID (never `drafts.`); implement `ifRevisionID` as a required body field, catching Sanity's raw 409 and re-raising as FastAPI's existing 409-detail convention; write a new `pt_to_blocks()` reverse-mapper in `lib/portable_text.py`; use raw-binary uploads via a generalized `upload_asset()` extending `upload_pdf_to_issue`; reconcile the two font whitelists before wiring D-08's hard validation.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDT-01 | Per-section prose editing via scoped patch endpoint | §"Sanity scoped patch mechanics", §"BodyBlock round-trip", §"Endpoint family design" |
| EDT-02 | Structured-field editing (headlines, PDF key data points, game embed, theme) | §"Field inventory", §"Validation reuse" |
| EDT-03 | Asset upload (podcast audio, Suno audio, storyboard images) through console → pipeline → Sanity | §"FastAPI file upload", §"Sanity scoped patch mechanics" (upload_asset generalization) |
| EDT-05 | Zero direct Sanity writes from dashboard (source-scan enforceable) | §"EDT-05 source-scan test" |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Editing UI home**
- D-01: Review Desk becomes real this phase — the run editor lives at `/review-desk/[runId]`. `/review-desk` auto-focuses the current awaiting-review run; a small run switcher handles the rare multi-run case.
- D-02: v1 layout: section-chip list opens one section's editor at a time, with the existing preview iframe alongside/toggleable. Phase 32 swaps the iframe for the native galley — no route migration later.
- D-03: The Phase 26 review page (`/run-monitor/runs/[runId]/review`) stays byte-untouched as the proven fallback path for at least one real weekly cycle — no big-bang cutover.

**Section coverage**
- D-04: ALL prose surfaces are editable in v1: block editor for the 5 long-reads (originStory, problem, founderBio, caseStudy, specAd bonus); turn-list editor for deliberation `conversation[]` (`{speaker, text}`); plain textareas for podcast transcript and jingle lyrics.
- D-05: Bonus editing adapts to stored variant: specAd → block editor; bigBudget → per-storyboard structured fields (+ image slot for asset upload); jingle → lyrics textarea + Suno prompt field.
- D-06: Long-read block editor supports full block ops: edit text, change type (paragraph/h2/h3/blockquote), add, delete, reorder via up/down buttons (no drag library; @dnd-kit deferred-optional).

**Save semantics**
- D-07: Explicit save per section — Save button, dirty-state indicator, unsaved-changes warning on nav. One scoped patch + one audit row per deliberate save; no autosave.
- D-08: Validation split — security-critical checks HARD-block save (theme hex regex + FONT_WHITELIST, sane game-embed size cap); editorial structural floor (≥2 sub-headers + ≥1 blockquote) only WARNS on operator edits.
- D-09: Every content-save audit row carries actor, section, and truncated before/after content snapshots (mirror the `agent_run_payloads` truncation pattern).
- D-10: Saves carry a revision guard — patch includes the document revision it was based on (Sanity `ifRevisionID`); mismatch returns 409 and the editor prompts reload-and-reapply.

**Asset uploads**
- D-11: Upload controls live inline in the owning section's editor (podcast editor → podcast audio slot; jingle bonus → Suno audio slot; storyboard forms → image slots). No separate assets screen.
- D-12: One asset per slot; uploading over an existing asset requires confirmation, then replaces the reference (old asset left in Sanity; audit row records the swap).
- D-13: Post-upload inline preview — native `<audio>` player for audio slots, thumbnail for images, both from the Sanity CDN URL returned after the patch.

### Claude's Discretion
- Exact endpoint shapes/granularity (research sketches `PATCH /issues/{run_id}/sections/{name}` + sibling structured-field routes — refine during planning; contract-first per CLAUDE.md).
- Upload transport details (multipart vs raw binary to FastAPI), file size/type limits per asset kind.
- Section-chip UI details, dirty-state mechanics, run-switcher styling (1c design system per Phase 30).
- EDT-05 source-scan test design — precedents: `apps-web-no-clerk.test.ts`, the CMR-05 `FORBIDDEN_BYPASS` tripwire pattern.
- Structured-field editor micro-UX (section headlines, PDF key data points, theme value fields, game embed textarea).

### Deferred Ideas (OUT OF SCOPE)
- "Edit in Review Desk" cross-links from the Phase 26 review page — not chosen (D-03 keeps that page byte-untouched).
- Accept-fix / dismiss-with-reason (EDT-04) and annotation re-resolution (EDT-06) — Phase 33.
- Native galley rendering — Phase 32 replaces the D-02 iframe.
- Retiring the Phase 26 review page and Studio write path — Phase 34.
- @dnd-kit drag reordering — only if up/down buttons prove insufficient.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Contract-first hard rule**: `docs/API_CONTRACTS.md` MUST be amended (new §31.x) BEFORE any producer/consumer code for the patch endpoint family + asset upload. The plan must sequence a contracts-amendment task first, ahead of both backend and frontend tasks.
- **GSD workflow enforcement**: no direct repo edits outside `/gsd:execute-phase` for this phase.
- **Convex work**: `convex/_generated/ai/guidelines.md` must be read before any Convex schema/function change (this phase adds no new Convex tables/functions but does call the existing `auditLog:record` mutation — no guideline violation expected, but flag if a plan touches `convex/`).
- **Voice/brand**: no directive here restricts editing UI copy tone; N/A for this backend/editor-UI phase.

## Standard Stack

No new npm or pip packages are required. This phase is a direct extension of already-installed dependencies.

### Core (pipeline / Python)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `httpx` | already pinned (see pyproject.toml) | Raw binary POST to Sanity assets API + scoped patch mutations | Already the sole Sanity/Convex HTTP client in this codebase; `upload_pdf_to_issue` is the exact precedent |
| `fastapi` | `==0.136.1` (pinned) | New router (`api/content.py` or similar) | Matches every other endpoint family |
| `pydantic` | already a dependency | Request body models for patch payloads | Matches `_ScheduleBody`/`_RejectBody` pattern in `review.py` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `python-multipart` | NOT currently installed | Only needed if FastAPI `UploadFile`/`File(...)` multipart parsing is chosen | Recommend AVOIDING — use raw binary body instead (see "FastAPI file upload" below), which needs zero new dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw binary upload body | FastAPI `UploadFile` (multipart) | Multipart requires adding `python-multipart` to `pyproject.toml` and is heavier to test; raw binary matches the existing `upload_pdf_to_issue` precedent exactly and needs no new dependency. Recommend raw binary. |
| Dotted-path `set` patch | Fetch-modify-`createOrReplace` whole doc | `createOrReplace` regenerates every Portable Text `_key` (confirmed in `write_issue_draft`/`rerun_agent` — this is the exact anti-pattern D-01/EDT-01 and the Phase 32/33 span-anchoring plan depend on avoiding) |

**Installation:** None required.

**Version verification:** `httpx`, `fastapi`, `pydantic` versions already verified as pinned in `packages/pipeline/pyproject.toml` (read directly, no drift risk — this is an internal monorepo dependency, not an external registry check).

## Architecture Patterns

### Recommended Project Structure

```
packages/pipeline/src/eisenbalm_pipeline/
├── api/
│   └── content.py            # NEW — this phase's router (patch + upload + draft-read GET)
├── lib/
│   ├── sanity_client.py       # EXTEND — add upload_asset(), patch_section(), get_issue_draft()
│   └── portable_text.py       # EXTEND — add pt_to_blocks() reverse mapper

apps/dispatch-control/
├── app/(dashboard)/review-desk/
│   ├── page.tsx                       # REPLACE placeholder — auto-focus current awaiting-review run
│   └── [runId]/
│       ├── page.tsx                   # NEW — section-chip list + editor + preview iframe (D-02)
│       └── _components/
│           ├── SectionChipList.tsx
│           ├── BlockEditor.tsx         # long-read block-row editor (D-06)
│           ├── TurnListEditor.tsx      # deliberation conversation (D-04)
│           ├── StructuredFieldEditor.tsx  # theme/game/PDF-data-points (EDT-02)
│           ├── AssetUploadSlot.tsx     # inline upload + preview (D-11/D-13)
│           └── PreviewIframe.tsx        # REUSE from run-monitor/.../review/_components (D-02)
├── lib/
│   └── contentPatchClient.ts   # NEW — mirrors reviewClient.ts pattern exactly
└── __tests__/
    └── dispatch-control-no-sanity-write.test.ts   # NEW — EDT-05 source-scan
```

### Pattern 1: Scoped dotted-path patch (the core write primitive)

**What:** A single Sanity mutation `{"patch": {"id": "issue-42", "ifRevisionID": "<rev>", "set": {"originStory.body": [...]}}}` updates exactly one nested field, leaving every sibling field (and every other section's block `_key`s) untouched.

**When to use:** Every content-mutating endpoint in this phase (EDT-01, EDT-02, EDT-03's reference-patch step).

**Example:**
```python
# Source: existing precedent in lib/sanity_client.py (set_charity_first_featured,
# _flip_sanity_published) + Sanity docs https://www.sanity.io/docs/content-lake/http-patches
# ("set" supports dotted JSON paths — confirmed via official docs fetch, 2026-07-07)
async def patch_section_body(
    http: AsyncClient, issue_id: str, section: str, body_blocks: list[dict],
    if_revision_id: str,
) -> dict:
    """Patch exactly one section's `body` field. Returns the new document
    (or raises on 409 revision mismatch — see Pitfall below)."""
    payload = {
        "mutations": [{
            "patch": {
                "id": issue_id,                      # PLAIN id — NOT drafts.{id} (see Pitfall)
                "ifRevisionID": if_revision_id,
                "set": {f"{section}.body": compose_section_body(body_blocks)},
            }
        }],
        "returnDocuments": True,  # verify this option name against 2.x API before use
    }
    r = await http.post(f"/{API_VERSION}/data/mutate/{_dataset()}",
                         json=payload, headers=_auth_headers())
    if r.status_code == 409:
        raise HTTPException(status_code=409, detail={
            "reason": "revision_mismatch",
            "message": "This section changed since you loaded it. Reload and reapply your edit.",
        })
    r.raise_for_status()
    return r.json()
```

**Confirmed via official docs (2026-07-07 fetch of `sanity.io/docs/content-lake/http-patches`):** `"set"` performs a shallow merge; "Each key in the argument is either an attribute or a JSON path" — dotted paths like `"personalMetrics.height"` are explicitly documented and supported. This directly confirms `"originStory.body"` / `"theme.primaryColor"` / `"bonus.storyboards[_key==\"sb-0\"].image"`-style paths work as scoped patches.

**Confirmed via official docs (`sanity.io/docs/http-reference/mutation` fetch, 2026-07-07):** `ifRevisionID` is a **top-level key of the patch object** (sibling to `id` and `set`), not nested under an `options` object:
```json
{"patch": {"id": "...", "ifRevisionID": "...", "set": {...}}}
```

**Confirmed via WebSearch (multiple sources, 2026-07-07):** a revision mismatch on `ifRevisionID` returns **HTTP 409 Conflict** from the Sanity mutate endpoint itself. This means the pipeline endpoint's job is simply to propagate/reshape that 409 — not implement its own optimistic-lock logic.

### Pattern 2: Generalized asset upload (upload-then-patch-reference)

**What:** `upload_pdf_to_issue`'s existing two-step sequence — POST raw bytes to `/assets/files/{dataset}?filename=...`, get back `{"document": {"_id": ..., "url": ...}}`, then patch a `{_type: "file"|"image", asset: {_type: "reference", _ref: assetId}}` reference onto the target field.

**When to use:** EDT-03 (podcast audio, Suno audio, storyboard images).

**Example (generalizing the existing function — source: `lib/sanity_client.py` lines 283-331):**
```python
async def upload_asset(
    http: AsyncClient, *, issue_id: str, field_path: str,
    file_bytes: bytes, filename: str, content_type: str,
    asset_kind: str,  # "file" (audio) | "image" (storyboards)
    if_revision_id: str,
) -> dict:
    endpoint = "files" if asset_kind == "file" else "images"
    r = await http.post(
        f"/{API_VERSION}/assets/{endpoint}/{_dataset()}",
        params={"filename": filename},
        content=file_bytes,
        headers={"Authorization": f"Bearer {os.environ['SANITY_API_TOKEN']}",
                 "Content-Type": content_type},
    )
    r.raise_for_status()
    asset_id = r.json()["document"]["_id"]
    asset_url = r.json()["document"]["url"]      # for D-13 inline preview
    # Then patch field_path with the ifRevisionID guard (Pattern 1) — reuse patch helper.
    ...
    return {"assetUrl": asset_url, "assetId": asset_id}
```

**Confirmed via official docs (`sanity.io/docs/http-reference/assets` fetch, WebSearch 2026-07-07):** response shape is `{_id, _type: "sanity.fileAsset"|"sanity.imageAsset", assetId, path, url, originalFilename, size, metadata}`. The `url` field is the CDN URL D-13 needs for inline `<audio>`/thumbnail preview — no second read round-trip required.

**File-type endpoint distinction:** audio → `/assets/files/{dataset}` (as `upload_pdf_to_issue` already does); images (storyboards) → `/assets/images/{dataset}` — confirm this endpoint name during planning (the PDF precedent only exercises the `files` path; images use a sibling endpoint per Sanity's asset API).

### Pattern 3: BodyBlock round-trip (write path exists; read path does not)

**What:** `compose_section_body(list[BodyBlock]) -> list[PortableTextBlock]` is the existing, one-directional write serializer (`lib/portable_text.py`). No reverse mapper exists.

**When to use:** The new draft-read GET endpoint must convert Sanity's stored Portable Text blocks back into the `{type, text}[]` shape the editor's block-row UI expects.

**Recommended implementation (net-new, add to `lib/portable_text.py`):**
```python
def pt_to_blocks(pt_blocks: list[dict]) -> list[dict]:
    """Inverse of compose_section_body. Assumes single-span blocks (the only
    shape the writers ever produce — see block_paragraph/h2/h3/blockquote,
    which always emit exactly one child span with no marks/markDefs).
    Blocks with multiple children or non-empty marks (e.g. an operator
    manually added bold text in a prior Studio edit) are NOT round-trippable
    without lossy flattening — flag this as an open question for planning.
    """
    result = []
    style_to_type = {"h2": "h2", "h3": "h3", "blockquote": "blockquote"}
    for b in pt_blocks:
        block_type = style_to_type.get(b.get("style"), "paragraph")
        children = b.get("children") or []
        text = "".join(c.get("text", "") for c in children)  # flattens multi-span
        result.append({"type": block_type, "text": text})
    return result
```

**Open question flagged for planning:** the writers only ever emit single-span, no-mark blocks (verified: `block_paragraph`/`block_h2`/`block_h3`/`block_blockquote` in `portable_text.py` always build exactly one child span with `marks: []`). But if Andrew has EVER hand-edited a section in Sanity Studio (which has been the only editing surface until now) and added inline bold/italic/links, `pt_to_blocks`'s naive text-join will silently drop those marks on the next operator save via the new editor. Recommend: (a) accept this as a known v1 limitation (matches D-04/D-06's "structured block-list editing, not inline WYSIWYG" — marks were never a first-class part of the block model to begin with), and (b) log a warning server-side when a block has `markDefs.length > 0` or `children.length > 1` so data loss is at least visible in logs, not silent.

### Recommended Project Structure — Endpoint list (Claude's Discretion, refined from research SUMMARY's sketch)

```
PATCH  /issues/{run_id}/sections/{section_name}          # EDT-01 — body (block-row list)
PATCH  /issues/{run_id}/headlines/{section_name}          # EDT-02 — headline string only
PATCH  /issues/{run_id}/theme                              # EDT-02 — theme object (hex+font validated)
PATCH  /issues/{run_id}/game                                # EDT-02 — game headline/description/embedCode
PATCH  /issues/{run_id}/pdf-data-points                     # EDT-02 — problemStatement.pdfContent
PATCH  /issues/{run_id}/bonus                               # EDT-01/02 — variant-shaped (specAd body | bigBudget storyboards | jingle lyrics+sunoPrompt)
PATCH  /issues/{run_id}/deliberation-conversation           # EDT-01 — conversation[] turn list
PATCH  /issues/{run_id}/podcast-transcript                  # EDT-01 — plain textarea field
POST   /issues/{run_id}/assets/{slot}                       # EDT-03 — raw-binary upload (slot: podcast-audio|suno-audio|storyboard-{i})
GET    /issues/{run_id}/draft                               # NEW — read path for the editor (see below)
```

`run_id` vs Sanity `issue_id`: existing endpoints (`review.py`) take `run_id` and internally resolve `pipelineRuns:byRunId` → `sanityIssueId`. Recommend the same pattern here for consistency — every content-patch endpoint does the same `run_id → sanity_id` resolution `review.py`'s publish/schedule/reject endpoints already do, rather than exposing raw Sanity IDs to the dashboard.

### Anti-Patterns to Avoid
- **Whole-document `createOrReplace` for any operator edit:** regenerates every Portable Text `_key` in the ENTIRE document (confirmed in `write_issue_draft`), silently invalidating any span-based annotation system Phase 32/33 build on top of this phase. Never use it for content-patch endpoints.
- **Targeting `drafts.{id}`:** this app has no Sanity draft/publish documents — see the Pitfall below. Patching `drafts.issue-42` when only `issue-42` exists is a no-op or 404, not an error you'd necessarily notice in casual testing.
- **FastAPI `UploadFile` multipart without adding `python-multipart`:** FastAPI will raise a runtime error ("Form data requires 'python-multipart' to be installed") the first time the endpoint is hit if the dependency is missing — this is a deploy-time surprise, not a build-time one, since FastAPI defers the import.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic-concurrency guard for concurrent edits (D-10) | A custom compare-and-swap layer in Convex or the pipeline | Sanity's native `ifRevisionID` patch option | Sanity already implements this exactly, returns 409 natively, zero new code needed beyond catching the 409 |
| Portable Text serialization | Manual block/span dict construction anywhere new | `compose_section_body()` (write) + new `pt_to_blocks()` (read) | The module docstring in `portable_text.py` says this explicitly: "DO NOT bypass this helper. Manual block construction silently produces malformed blocks." |
| Truncated audit snapshots (D-09) | A new truncation utility | The existing `_truncate()` in `lib/agent_wrapper.py` (2000-char cutoff + `"...[truncated]"` suffix) | Byte-identical pattern already proven and tested; `auditLog:record`'s Convex mutation already accepts optional `before`/`after` string args — no schema change needed |
| Asset upload plumbing | A new SDK or multipart library | Raw `httpx` binary POST (already `upload_pdf_to_issue`'s exact pattern) | Zero new dependencies; Sanity's asset API is documented to accept a raw binary body, not multipart form data |

**Key insight:** Every piece of infrastructure this phase needs to hand-roll turns out to already exist somewhere in this codebase in nearly the exact shape needed — the work is generalizing (PDF-upload → any-asset-upload) and reversing (PT-compose → PT-decompose) existing functions, not inventing new patterns.

## Common Pitfalls

### Pitfall 1: Assuming Sanity's native draft/publish system is in play
**What goes wrong:** CONTEXT.md's canonical_refs and PROJECT.md both describe "Sanity draft documents (`drafts.` prefix)" — but a full-repo grep for `drafts.` usage (excluding the built Sanity Studio bundle, which contains generic Sanity UI i18n strings unrelated to this app's data model) returns **zero hits** in `packages/pipeline/src`, `apps/dispatch-control`, `apps/studio/schemas`, or `docs/API_CONTRACTS.md`. `write_issue_draft` writes `_id: f"issue-{state['issue_number']}"` (no `drafts.` prefix) and uses a custom `status` string field for the draft/published distinction. `_flip_sanity_published` patches that exact same plain ID.
**Why it happens:** "Draft" is used colloquially in this project (status='draft') and conflated with Sanity's own drafts/documents-with-`drafts.`-prefix feature, which is a genuinely different mechanism this app has never adopted.
**How to avoid:** Every content-patch endpoint in this phase targets the plain Sanity `_id` (`issue-{n}`), resolved from `pipelineRuns:byRunId → sanityIssueId`, exactly like `review.py`'s existing endpoints do. Do not add `drafts.` prefixing anywhere.
**Warning signs:** A patch mutation that silently does nothing (Sanity returns 200 for a patch against a nonexistent document ID in some configurations, or 404 in others depending on mutation semantics) — verify this during Wave 0 with a real test-dataset write before building the full endpoint family on an untested assumption either way.

### Pitfall 2: Font whitelist drift between pipeline and web (D-08 blocker)
**What goes wrong:** `apps/web/lib/theme.ts` `FONT_WHITELIST` (the render-time validator, WEB-07) currently has **9** entries: Playfair Display, Lora, Inter, Cormorant Garamond, Merriweather, DM Serif Display, Fraunces, Newsreader, IBM Plex Mono. `packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py` (the pre-write validator used by DesignAgent) has a **different 17-entry union** that does NOT include Fraunces/Newsreader/IBM Plex Mono (added to web in Phase 19) but DOES include 8 fonts the web whitelist rejects (Libre Baskerville, EB Garamond, Crimson Text, Spectral, Source Serif Pro, Bitter, PT Serif, Noto Serif, IBM Plex Serif).
**Why it happens:** Phase 19 added 3 fonts to the web-side whitelist as part of a sitewide redesign but never touched the pipeline-side whitelist (which only DesignAgent output validation used at the time); the two lists have quietly diverged.
**How to avoid:** D-08 requires theme-edit hard validation to match "the pipeline-side equivalent in the DesignAgent validation path" — but that pipeline-side list is currently WRONG relative to what the live site will actually accept. Before wiring the theme-edit endpoint's hard validator, the plan must either (a) import/reuse a single shared whitelist source of truth, or (b) explicitly reconcile the two lists to the web's 9-entry list (the one that actually gates rendering) as the authoritative set for operator-facing validation, since a theme edit that passes pipeline-side validation but fails web-side validation would silently fall back to `BRAND_DEFAULTS` at render time with no operator-visible error.
**Warning signs:** An operator sets `fontDisplay: "Spectral"` via the new theme editor, the pipeline endpoint accepts it (in the current pipeline whitelist), but the live issue page silently renders `Fraunces` instead (web whitelist rejects `Spectral`) with only a `console.warn` — invisible to the operator in Sanity/console context.

### Pitfall 3: `python-multipart` is not installed — multipart uploads will fail at request time, not build time
**What goes wrong:** If the asset-upload endpoint is implemented with FastAPI's `UploadFile = File(...)` parameter, the app will start fine and pass all unit tests that don't exercise a real multipart request, then throw `RuntimeError: Form data requires "python-multipart" to be installed` the first time a real multipart POST hits the endpoint in any environment (dev or Railway).
**Why it happens:** FastAPI defers the `python-multipart` import until a request actually needs form/file parsing; a missing dependency doesn't surface at import time or in a trivial smoke test.
**How to avoid:** Use raw binary request bodies (`await request.body()` or a `Request` with `Content-Type` + custom headers for filename/asset-kind), exactly as `upload_pdf_to_issue` already does when it POSTs to Sanity. This requires zero new pipeline dependencies and mirrors the existing precedent byte-for-byte on the outbound side; only the inbound (dashboard → pipeline) side is new.
**Warning signs:** `pytest` suite is green (no dependency check trips), but a live upload from the dashboard 500s in Railway logs with the exact RuntimeError message above.

### Pitfall 4: Regenerate-once retry semantics don't apply to operator edits (D-08 nuance)
**What goes wrong:** The existing DesignAgent validation flow (`agents/design/__init__.py`) has a "regenerate-once, then fall back to SAFE_THEME" retry loop for LLM output. An operator manually editing the theme via the new console UI has no LLM to retry — a hard-block validation failure must simply reject the save with an actionable error, not attempt any fallback substitution.
**Why it happens:** Reusing validation code (`lib/wcag.py` / `font_whitelist.py`) is correct per D-08, but reusing the *retry/fallback control flow* around it is not — that's agent-specific orchestration, not part of the validator itself.
**How to avoid:** Import only `validate_hex`/`passes_wcag_aa`/whitelist-membership functions for the content-patch endpoint's validation step; do not import or replicate the regenerate-once/SAFE_THEME fallback logic. A failed validation on operator edit returns a 4xx with the specific field(s) that failed, letting the operator fix and resubmit.

### Pitfall 5: `_enforce_structural_floor` is a Pydantic `@field_validator`, not a standalone callable (D-08 reuse nuance)
**What goes wrong:** MEL-04/D-08 want the structural floor (≥2 sub-headers + ≥1 blockquote) to WARN (not hard-block) on operator edits. But the floor logic (referenced in Phase 18 requirements as `_enforce_structural_floor`) is implemented as a Pydantic validator attached to the writer output models (`OriginStoryOutput`, etc. — verified: `graph/blocks.py`'s docstring explicitly ties it to `b.type` counting inside those models), not exposed as an importable standalone function in the files read during this research pass.
**Why it happens:** The floor was built for LLM-output validation (hard structural contract on writer output), not for a warn-only advisory check on hand-edited content — these are different call sites with different failure semantics (Pydantic `ValidationError` raise vs. a non-blocking warning list).
**How to avoid:** During planning, locate the exact `_enforce_structural_floor` implementation (likely in `agents/*.py` or a shared validators module not read in this pass — search `packages/pipeline/src/eisenbalm_pipeline` for `_enforce_structural_floor` before writing the plan) and either (a) extract its counting logic into a standalone function callable from both the Pydantic validator and the new content-patch endpoint's warn-only path, or (b) reimplement the same `type in ('h2','h3')` / `type == 'blockquote'` counting inline in the endpoint (it's ~5 lines per `graph/blocks.py`'s documented semantics) rather than trying to reuse the Pydantic validator's raise-based control flow directly.

## Runtime State Inventory

Not applicable — this is a greenfield endpoint-family + editor-UI phase, not a rename/refactor/migration. No existing runtime state (stored data, live service config, OS-registered state, secrets, build artifacts) is being renamed or moved.

## Code Examples

### Existing scoped-patch precedent (verified, `lib/sanity_client.py`)
```python
# set_charity_first_featured — atomic conditional patch precedent
r = await http.post(
    f"/{API_VERSION}/data/mutate/{_dataset()}",
    json={"mutations": [{"patch": {
        "id": charity_id,
        "setIfMissing": {"firstFeaturedIn": {"_type": "reference", "_ref": issue_id}},
    }}]},
    headers=_auth_headers(),
)
r.raise_for_status()
```

### Existing upload-then-patch-reference precedent (verified, `lib/sanity_client.py`)
```python
# upload_pdf_to_issue — the exact pattern EDT-03's upload_asset() generalizes
r = await http.post(f"/{API_VERSION}/assets/files/{_dataset()}",
                     params={"filename": filename}, content=pdf_bytes,
                     headers={"Authorization": f"Bearer {os.environ['SANITY_API_TOKEN']}",
                              "Content-Type": "application/pdf"})
r.raise_for_status()
asset_id = r.json()["document"]["_id"]
# ... then patch problemPdf field with a {_type: "file", asset: {_type: "reference", _ref: asset_id}}
```

### Existing Clerk-JWT-guarded endpoint skeleton to clone (verified, `api/review.py`)
```python
@router.post("/issues/{run_id}/publish")
async def publish_issue(request: Request, run_id: str,
                         claims: dict = Depends(_require_clerk_jwt_control)) -> dict:
    http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"
    run = await _cc.convex_query(http, "pipelineRuns:byRunId", {"runId": run_id})
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    # ... ordered guards, each raising a structured 409 {"reason": ..., "message": ...} ...
    await _emit_audit(http, actor_id=actor, action="run.approved_and_published",
                       resource_type="run", resource_id=run_id)
    return {"issueId": sanity_id, "published": True}
```

### `_emit_audit` already supports before/after snapshots (verified, `api/control.py` + `convex/auditLog.ts`)
```python
async def _emit_audit(http, *, actor_id, action, resource_type=None, resource_id=None,
                       before=None, after=None) -> None:
    # NOTE: current signature (api/control.py) does NOT yet pass before/after through —
    # the Convex `auditLog:record` mutation DOES already accept optional `before`/`after`
    # string args (verified convex/auditLog.ts). Extending _emit_audit's Python signature
    # to accept and forward before/after is a small, additive change — not a new mutation.
    args = {"workspace_id": WORKSPACE_ID, "actorId": actor_id, "action": action}
    if resource_type: args["resourceType"] = resource_type
    if resource_id: args["resourceId"] = resource_id
    if before is not None: args["before"] = before
    if after is not None: args["after"] = after
    await _cc.convex_mutation(http, "auditLog:record", args)
```

### Truncation pattern to mirror for D-09 (verified, `lib/agent_wrapper.py`)
```python
def _truncate(s: str) -> str:
    if len(s) <= 2000:
        return s
    return s[:2000] + "...[truncated]"
```

### Dashboard fetch-client pattern to clone (verified, `lib/reviewClient.ts`)
```typescript
function pipelineBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_PIPELINE_URL
  if (!url) throw new Error('NEXT_PUBLIC_PIPELINE_URL is not set...')
  return url.replace(/\/$/, '')
}
// _reviewFetch<T>(path, token, body) — POSTs with Bearer token, parses 4xx {reason, message}
// New contentPatchClient.ts should mirror this exact shape (including the ReviewApiError-style
// class) rather than testRunClient.ts's simpler throw-Error pattern, since content-patch
// endpoints return structured {reason, message} 409s (revision_mismatch, validation_failed)
// that the editor UI needs to branch on (D-10's "prompt reload-and-reapply").
```

## Field Inventory (EDT-02 — every editable field path)

Verified directly against `apps/studio/schemas/weeklyIssue.ts`:

| Section | Field path | Type | Editor (per D-04/D-05/D-06) |
|---------|-----------|------|------------------------------|
| Origin Story | `originStory.headline` | string | headline text input |
| Origin Story | `originStory.body` | `array<block>` | block-row editor (BodyBlock) |
| Problem | `problemStatement.headline` | string | headline text input |
| Problem | `problemStatement.body` | `array<block>` | block-row editor |
| Problem | `problemStatement.pdfContent.problemStatement` | text (≤150 words) | textarea |
| Problem | `problemStatement.pdfContent.keyDataPoints[]` | array of exactly 3 `{stat, source}` | 3 fixed structured-field rows (Sanity `Rule.length(3)` — do NOT allow add/remove) |
| Problem | `problemStatement.pdfContent.interventionMechanism` | text (≤100 words) | textarea |
| Founder Bio | `founderBio.headline` | string | headline text input |
| Founder Bio | `founderBio.body` | `array<block>` | block-row editor |
| Case Study | `caseStudy.subjectName` | string | text input |
| Case Study | `caseStudy.headline` | string | headline text input |
| Case Study | `caseStudy.body` | `array<block>` | block-row editor |
| Game | `game.headline` | string | text input |
| Game | `game.description` | string | text input |
| Game | `game.embedCode` | text | textarea (needs "sane size cap" per D-08 — no existing cap found in schema; recommend a byte-length ceiling, e.g. 50KB, during planning) |
| Bonus | `bonus.headline` | string | text input |
| Bonus | `bonus.body` | `array<block>` (specAd) or plain string content (bigBudget/jingle body is untyped `array<block>` in schema but pipeline treats it as str for those two variants — see Pitfall in canonical_refs about D-04 body-type branching) | block editor (specAd) / N/A (bigBudget/jingle don't use `body` per `_build_bonus`) |
| Bonus (jingle) | `bonus.lyrics` | text | textarea |
| Bonus (jingle) | `bonus.sunoPrompt` | text | textarea |
| Bonus (jingle) | `bonus.sunoAudioUrl` | url | NOT directly editable — populated via asset upload flow (EDT-03), not a raw URL field, per D-11 |
| Bonus (bigBudget/specAd) | `bonus.storyboards[]` | `array<image>` | storyboard structured fields + image upload slot (D-05) |
| Podcast | `podcast.audioFile` | file | upload slot (EDT-03, D-11) |
| Podcast | `podcast.deliberationTranscript` | text | plain textarea (D-04) |
| Podcast | `podcast.podcastDescription` | text | textarea (not explicitly in D-04/D-05 list — confirm scope during planning; likely in-scope as it's podcast prose) |
| Theme | `theme.primaryColor` / `accentColor` / `backgroundColor` / `textColor` | string (hex) | structured hex inputs, HARD-validated (D-08) |
| Theme | `theme.fontDisplay` / `theme.fontBody` | string | dropdown/select constrained to whitelist (D-08) — NOT a free-text field, to prevent invalid submissions entirely |
| Theme | `theme.visualDirection` | text | textarea (not security-critical — no hard validation needed) |
| Deliberation | `selectionDeliberation.conversation[]` | `array<{speaker, text}>` | turn-list editor (D-04) — `_key` per turn generated `turn-{i:03d}` on write, mirroring existing pattern |
| Deliberation | `selectionDeliberation.editorDecision` / `runnerUpNotes` | text | NOT explicitly listed in D-04/D-05 — confirm in-scope during planning (likely yes, same prose-editing spirit) |

**Fields intentionally NOT editable this phase** (confirmed out of scope by D-04/D-05/CONTEXT boundary): `pipelineMetadata.*` (pipeline-owned, "Do not edit manually" per schema description), `selectionDeliberation.candidates[]` (historical scout/advocate record, not editorial prose), `narrator` (Andrew sets in Studio per Phase 16 design — schema description explicitly says pipeline reads but never writes it; console editing it is a scope question the plan should explicitly resolve or explicitly exclude), `charity` reference, `issueNumber`/`slug`/`publishDate`/`status`/`bonusType` (identity/workflow fields, not content).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Sanity Studio manual editing (only editing surface today) | Console per-section patch endpoints | This phase | First console write path; Studio remains available as an unretired fallback per V3-DEF-01/PUB-03 (later phase) |
| Whole-document `createOrReplace` per pipeline run | Scoped `patch` for operator edits (pipeline run-end write stays `createOrReplace` — unchanged) | This phase, additive only | The two write paths coexist: automated section generation still uses `write_issue_draft`'s full-document write; operator edits after that use scoped patches. A re-roll (`rerun_agent`, RUN-05) still does a full `write_issue_draft` re-sync — this means an operator's patch-based edit to Section A could be silently overwritten if Section B is re-rolled AFTER the operator's edit, since `rerun_agent` merges checkpoint state (not the current Sanity document) and calls `write_issue_draft` on the merged result. **This is a real interaction risk between RUN-05 and this phase's endpoints that should be flagged to the planner as an open question**, not silently accepted. |

**Deprecated/outdated:** None — this is additive infrastructure, nothing existing is being replaced in this phase.

## Open Questions

1. **Does `rerun_agent` (RUN-05) clobber operator content-patch edits?**
   - What we know: `rerun_agent` builds `current_state` from the LangGraph checkpoint (not from reading current Sanity content), merges in the re-rolled section's new output, and calls `write_issue_draft(sanity_client, merged)` — a full `createOrReplace`. If an operator patched `originStory.body` via this phase's new endpoint AFTER the pipeline run completed, and Andrew later re-rolls `game` via RUN-05, the re-roll's `write_issue_draft` call will overwrite `originStory` with the CHECKPOINT's original origin_story content, silently discarding the operator's patch.
   - What's unclear: whether this is an accepted known limitation (re-roll and post-generation editing are assumed not to co-occur in practice) or something this phase's plan should guard against (e.g., have `rerun_agent` re-read current Sanity content for sibling sections instead of trusting the checkpoint).
   - Recommendation: surface this explicitly to the user/planner as a design decision, not silently ship it. At minimum, document it as a known interaction risk in the plan; ideally, verify with Andrew's actual weekly workflow whether re-roll-after-edit is a realistic sequence.

2. **Exact `_enforce_structural_floor` implementation location and callable form.**
   - What we know: it's referenced as a Pydantic `@field_validator` per MEL-04/Phase 18 CONTEXT, counting `type in ('h2','h3')` and `type == 'blockquote'` per `graph/blocks.py`'s BodyBlock docstring.
   - What's unclear: which exact agent file(s) define it and whether it's extractable as a standalone function without triggering the Pydantic model's raise-based control flow (see Pitfall 5).
   - Recommendation: `grep -rn "_enforce_structural_floor" packages/pipeline/src` at planning time (not found in the files read during this research pass — likely in `agents/origin_story.py`, `agents/problem.py`, etc., which were not opened) and extract/duplicate the counting logic into a standalone warn-only helper.

3. **Storyboard per-item patch addressing (`bonus.storyboards[]`).**
   - What we know: Sanity supports array-item patches by `_key` predicate (e.g. `body[_key=="abc"]`) per general Sanity patch semantics, though the official-docs fetch performed in this research pass did not surface a worked example for this exact syntax (the fetched excerpt confirmed dotted-path `set` but not `_key`-predicate array addressing).
   - What's unclear: whether `storyboards[]` array items currently carry a `_key` (the schema defines `of: [{ type: 'image' }]` with no explicit `_key` generation visible in `weeklyIssue.ts` — Sanity auto-generates `_key`s for array items at write time, but confirm this holds for image-type array items specifically).
   - Recommendation: verify with a real test-dataset write during Wave 0 before committing to a per-storyboard-slot patch design; the D-05 "bigBudget → per-storyboard structured fields" requirement depends on being able to address one storyboard slot without touching siblings.

4. **`podcastDescription` and `editorDecision`/`runnerUpNotes` in/out of scope.**
   - What we know: D-04/D-05's explicit field list covers 5 long-reads + conversation + podcast transcript + jingle lyrics. `podcast.podcastDescription`, `selectionDeliberation.editorDecision`, and `selectionDeliberation.runnerUpNotes` are prose fields in the schema not explicitly named in CONTEXT.md's decisions.
   - What's unclear: whether these are simply omitted from the phase's explicit list because they're expected to be swept in under EDT-02's "structured fields" umbrella, or deliberately excluded.
   - Recommendation: confirm scope explicitly in the plan rather than guessing; if included, they're plain-textarea editors with no special validation, cheap to add.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (pipeline) | pytest + pytest-asyncio (`packages/pipeline/pyproject.toml`); `respx` is a listed dependency but NOT currently used anywhere in `packages/pipeline/tests` — the actual dominant pattern for endpoint tests is `monkeypatch.setattr` on `_cc.convex_query`/`_cc.convex_mutation` (see `test_review_endpoints.py`), and `httpx.MockTransport` for direct Sanity-client-layer tests (see `test_sanity_write.py`) |
| Framework (dispatch-control) | Vitest (`apps/dispatch-control/vitest.config.ts`) |
| Config file (pipeline) | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` (not read in full this pass — standard pytest discovery) |
| Config file (dispatch-control) | `apps/dispatch-control/vitest.config.ts` |
| Quick run command (pipeline) | `cd packages/pipeline && uv run pytest -x -q -k content` (once new test files exist, filter by keyword) |
| Quick run command (dispatch-control) | `pnpm --filter dispatch-control test` |
| Full suite command (pipeline) | `cd packages/pipeline && uv run pytest -x -q` |
| Full suite command (dispatch-control) | `pnpm --filter dispatch-control test && pnpm --filter dispatch-control build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDT-01 | Scoped patch updates one section, siblings untouched | unit (pipeline) | `pytest packages/pipeline/tests/test_content_patch_endpoints.py::test_patch_section_scoped -x` | ❌ Wave 0 |
| EDT-01 | `ifRevisionID` mismatch returns structured 409 | unit (pipeline) | `pytest packages/pipeline/tests/test_content_patch_endpoints.py::test_patch_revision_mismatch -x` | ❌ Wave 0 |
| EDT-02 | Theme edit hard-blocks invalid hex/font | unit (pipeline) | `pytest packages/pipeline/tests/test_content_patch_endpoints.py::test_theme_patch_validation -x` | ❌ Wave 0 |
| EDT-02 | Structural-floor WARN (not hard-block) on section edit | unit (pipeline) | `pytest packages/pipeline/tests/test_content_patch_endpoints.py::test_structural_floor_warns_not_blocks -x` | ❌ Wave 0 |
| EDT-03 | Asset upload writes file/image reference + returns CDN url | unit (pipeline, `httpx.MockTransport`) | `pytest packages/pipeline/tests/test_content_patch_endpoints.py::test_upload_asset_patches_reference -x` | ❌ Wave 0 |
| EDT-05 | Zero direct Sanity writes in dispatch-control source | source-scan (vitest) | `pnpm --filter dispatch-control test -- dispatch-control-no-sanity-write` | ❌ Wave 0 |
| D-09 | Audit row carries truncated before/after snapshot | unit (pipeline) | `pytest packages/pipeline/tests/test_content_patch_endpoints.py::test_audit_row_truncated_snapshot -x` | ❌ Wave 0 |
| D-12 | Asset overwrite requires confirmation + records swap in audit | integration (dispatch-control, vitest + pipeline unit) | `pytest ...::test_asset_overwrite_audit_swap -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** pipeline — `pytest -x -q -k content`; dispatch-control — `pnpm --filter dispatch-control test`
- **Per wave merge:** `cd packages/pipeline && uv run pytest -x -q` (full ~340+ test suite) AND `pnpm --filter dispatch-control build` (per the standing "run strict build, not just vitest" rule from memory `run-strict-build-before-frontend-phase-done`)
- **Phase gate:** Full pipeline pytest suite green + dispatch-control `build` clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/pipeline/tests/test_content_patch_endpoints.py` — covers EDT-01, EDT-02, EDT-03, D-08, D-09, D-10, D-12
- [ ] `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts` — covers EDT-05 (source-scan, modeled on `apps-web-no-clerk.test.ts` + the CMR-05 `FORBIDDEN_BYPASS` pattern — forbid `@sanity/client`, `createClient` imports, and any literal `.api.sanity.io` string in `apps/dispatch-control` source)
- [ ] No pipeline test currently exercises `lib/sanity_client.py`'s asset-upload path with `httpx.MockTransport` for a generalized (non-PDF) asset — new fixture needed
- [ ] `docs/API_CONTRACTS.md` §31.x — MUST be written before any of the above tests are meaningful acceptance criteria (contract-first hard rule)

## EDT-05 Source-Scan Test Design (Claude's Discretion — recommendation)

Modeled directly on the two existing precedents read in this pass:

```typescript
// apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts
// Precedents: apps-web-no-clerk.test.ts (package.json + recursive source scan),
// stripe-webhook-source.test.ts (FORBIDDEN_BYPASS regex array pattern)
const FORBIDDEN_IMPORTS = [
  /@sanity\/client/,
  /from ['"]sanity['"]/,          // Sanity Studio SDK
  /createClient\s*\(/,             // @sanity/client's factory, in case imported under an alias
  /\.api\.sanity\.io/,             // literal Sanity API host — catches raw fetch() bypasses too
]
// Recursively scan apps/dispatch-control/{app,components,lib} .ts/.tsx files;
// assert zero matches. package.json check: zero "@sanity/*" dependency entries.
```

**Verified today (2026-07-07):** `apps/dispatch-control/package.json` currently has NO `@sanity/*` dependency at all — this baseline is currently green with zero existing violations, so the test can be written and will pass immediately, then serve as a tripwire for this phase's own new code and all future changes.

## Sources

### Primary (HIGH confidence — direct code reads, this repo)
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` — full file read; endpoint skeleton, guard ordering, 409 detail shapes
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — full file read; `_require_clerk_jwt_control`, `_emit_audit`, `rerun_agent` full-document-rewrite behavior
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — full file read; `write_issue_draft` (plain `_id`, no `drafts.` prefix), `upload_pdf_to_issue`, `set_charity_first_featured`, `_flip_sanity_published`-adjacent patterns
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py` — full file read; confirms plain-ID patch target for the publish flip
- `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py`, `lib/portable_text.py` — full file reads; BodyBlock shape, one-directional `compose_section_body`
- `apps/studio/schemas/weeklyIssue.ts` — full file read; every editable field path (Field Inventory table)
- `apps/web/lib/theme.ts` — full file read; `FONT_WHITELIST` (9 entries), `HEX_REGEX`, `validateHex`/`validateFont`/`passesWcagAA`
- `packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py`, `lib/wcag.py`, `agents/design/__init__.py` (partial) — pipeline-side validation, confirmed whitelist drift vs. web
- `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` — full snippet read; `_truncate()` 2000-char pattern for D-09
- `convex/auditLog.ts` — full file read; `record` mutation already accepts optional `before`/`after`
- `convex/agentRuns.ts`, `convex/schema.ts` (partial) — `savePayload`/`agent_run_payloads` truncation precedent
- `apps/dispatch-control/lib/reviewClient.ts`, `lib/testRunClient.ts`, `lib/previewToken.ts` — full file reads; fetch-client conventions
- `apps/dispatch-control/app/(dashboard)/review-desk/page.tsx`, `.../review/_components/PreviewIframe.tsx` — full file reads; current placeholder + reusable iframe component
- `apps/dispatch-control/__tests__/apps-web-no-clerk.test.ts`, `apps/web/__tests__/stripe-webhook-source.test.ts` — full file reads; source-scan precedents for EDT-05
- `packages/pipeline/tests/test_review_endpoints.py` (partial), `test_sanity_write.py` (grep) — test-pattern precedents (monkeypatch vs. `httpx.MockTransport`)
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` — router mounting, CORS config
- `packages/pipeline/pyproject.toml` — confirmed `fastapi==0.136.1`, no `python-multipart`
- `apps/dispatch-control/package.json` — confirmed zero `@sanity/*` dependencies today
- Repo-wide `grep -rn "drafts\."` (excluding `apps/studio/dist` build artifacts) — zero real hits, grounding Pitfall 1
- `.planning/research/SUMMARY.md` (v3.0 milestone research, 2026-07-06) — architecture rationale, phase sequencing, prior-pass source list

### Secondary (MEDIUM confidence — official docs, WebFetch/WebSearch verified 2026-07-07)
- [Mutation API reference — Sanity Docs](https://www.sanity.io/docs/http-reference/mutation) — confirmed `ifRevisionID` is a top-level patch-object key
- [Patches — Sanity Docs](https://www.sanity.io/docs/content-lake/http-patches) — confirmed dotted-path `set` support with a worked example
- [Assets API reference — Sanity Docs](https://www.sanity.io/docs/http-reference/assets) — confirmed asset upload response shape (`_id`, `_type`, `assetId`, `url`, `originalFilename`, `size`, `metadata`)
- WebSearch (multiple results) — confirmed `ifRevisionID` mismatch returns HTTP 409 Conflict from the Sanity mutate endpoint

### Tertiary (LOW confidence — flagged for validation)
- Exact `returnDocuments` mutation option name/availability on the `v2024-01-01` API version — not independently verified against the official reference table in this pass; verify during Wave 0 implementation rather than assuming.
- `/assets/images/{dataset}` as the sibling endpoint name for image uploads (vs. the verified `/assets/files/{dataset}` for audio/PDF) — inferred from Sanity's general asset-type split, not independently fetched from official docs in this pass.
- Array-item `_key`-predicate patch addressing for `storyboards[]` (Open Question 3) — general Sanity capability, not confirmed with a worked example against this exact schema in this pass.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every library already pinned and verified in this repo's own `pyproject.toml`/`package.json`
- Architecture: HIGH — every core pattern (scoped patch, upload-then-patch, endpoint skeleton) verified against this repo's actual code, not assumed; the one load-bearing correction (Pitfall 1, `drafts.` non-usage) was verified by direct repo-wide grep, not inference
- Pitfalls: HIGH — font-whitelist drift (Pitfall 2) and `python-multipart` absence (Pitfall 3) are both verified facts from direct file/dependency reads, not speculation; Sanity 409-on-mismatch (Pitfall/Pattern 1) is cross-verified via two independent official-docs fetches plus WebSearch

**Research date:** 2026-07-07
**Valid until:** 30 days (stable domain — Sanity's HTTP mutate/patch/asset APIs are mature and slow-moving; the internal codebase facts are current as of this exact commit and should be re-verified if significant pipeline/schema changes land before planning executes)
