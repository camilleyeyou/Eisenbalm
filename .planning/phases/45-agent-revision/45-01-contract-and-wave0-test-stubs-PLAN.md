---
phase: 45-agent-revision
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - apps/dispatch-control/lib/blockIndexFromKey.ts
  - apps/dispatch-control/__tests__/blockIndexFromKey.test.ts
  - apps/dispatch-control/__tests__/PassageToolbar.test.tsx
  - apps/dispatch-control/__tests__/DirectionChips.test.tsx
  - apps/dispatch-control/__tests__/RevisionComparisonCard.test.tsx
  - apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx
  - packages/pipeline/tests/test_revision_endpoints.py
  - packages/pipeline/tests/test_budget.py
autonomous: true
requirements: [REV-01, REV-02, REV-03, REV-04, REV-05]
must_haves:
  truths:
    - "docs/API_CONTRACTS.md has a §45 section locking the passage-revision preview/apply request+response shapes, the 7 direction-chip identifiers, and the cost-guard 409"
    - "The full pipeline pytest suite and full console vitest suite stay green (new stub tests skip/todo until their implementation lands)"
    - "blockIndexFromKey('row-founderBio-2') === 2 and blockIndexFromKey of a malformed key is null"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§45 passage-revision contract (chip identifiers, preview/apply shapes, claimDelta output, cost-guard 409)"
      contains: "## §45"
    - path: "apps/dispatch-control/lib/blockIndexFromKey.ts"
      provides: "Pure helper parsing block index out of a synthetic block _key"
      exports: ["blockIndexFromKey"]
    - path: "packages/pipeline/tests/test_revision_endpoints.py"
      provides: "importorskip-guarded pytest suite for revise/preview + revise/apply + directive + cost_attribution"
      contains: "importorskip"
    - path: "packages/pipeline/tests/test_budget.py"
      provides: "skipif-guarded pytest suite for would_exceed_run_cap"
      contains: "would_exceed_run_cap"
  key_links:
    - from: "docs/API_CONTRACTS.md §45"
      to: "packages/pipeline/src/eisenbalm_pipeline/api/revision.py (Plan 45-03)"
      via: "endpoint paths /issues/{run_id}/revise/preview + /revise/apply implement §45 verbatim"
      pattern: "revise/preview"
---

<objective>
Contract-first (D-19) foundation for Phase 45: amend `docs/API_CONTRACTS.md` with a new
§45 that locks every passage-revision request/response shape, the 7 direction-chip internal
identifiers, the claim-delta output shape, and the cost-guard 409 — BEFORE any endpoint or
UI code depends on it. Ship the one genuinely-real Wave-0 artifact (`blockIndexFromKey.ts`
pure helper + its green test), and scaffold the remaining Wave-0 test files so every later
wave has an automated feedback signal while the full suite stays green.

Purpose: §45 is the single source of truth both the pipeline endpoint (45-03) and the console
client (45-04) implement against — locking it now prevents client/server drift (RESEARCH Open
Question #2). The Wave-0 test files are the Nyquist feedback signal for waves 2-3.
Output: §45 contract, `blockIndexFromKey.ts` (+green test), 5 scaffold test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/45-agent-revision/45-CONTEXT.md
@.planning/phases/45-agent-revision/45-RESEARCH.md
@.planning/phases/45-agent-revision/45-VALIDATION.md

<interfaces>
<!-- The §42.4a contract this §45 GENERALIZES (read first). -->
docs/API_CONTRACTS.md §42.4 / §42.4a — the FCT-06 claim-scoped preview/apply contract.
docs/API_CONTRACTS.md §31.4 — the `ifRevisionID` 409 revision guard.
docs/API_CONTRACTS.md §35.3 — span resolution against CURRENT content, never `claimSpans`.

<!-- Locked 7 direction-chip identifiers (RESEARCH Open Question #2) — display copy is REV-02-locked. -->
make_clearer          → "Make clearer"
make_more_specific    → "Make more specific"
tighten               → "Tighten"
match_brief           → "Match the brief"
reduce_repetition     → "Reduce repetition"
try_another_approach  → "Try another approach"
custom                → "Custom"

<!-- Synthetic block _key shape the helper parses (lib/galley/syntheticPortableText.ts:143). -->
blockKey = `row-${sectionId}-${blockIndex}`   // sectionId is camelCase (no dashes): originStory, founderBio, …
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md with §45 (passage-revision contract, contract-first D-19)</name>
  <requirements>REV-02, REV-03, REV-04, REV-05</requirements>
  <read_first>
    - docs/API_CONTRACTS.md §42.4 + §42.4a (lines ~4378-4424) — the FCT-06 contract §45 generalizes; mirror its structure/prose register exactly.
    - docs/API_CONTRACTS.md §31.4 (revision guard 409) + §35.3 (span resolution) — §45 reuses both verbatim.
    - docs/API_CONTRACTS.md §44.7 (footer live-vs-reserved table) — §45 notes the InspectorFooter "Ask agent to revise" flips LIVE.
  </read_first>
  <files>docs/API_CONTRACTS.md</files>
  <action>
Append a new top-level section `## §45 — Agent Revision (Phase 45)` AFTER §44's block (after the
§44.RECONCILIATION text, ~line 5163). Open with the standard contract-first preamble ("written
BEFORE any endpoint/UI code exists … mirroring §31/§35/§42/§44"). Document, verbatim so 45-03 and
45-04 implement without invention:

**§45.1 — Direction-chip identifiers (locks RESEARCH Open Question #2).** A table mapping the 7
internal `DirectionChip` literal identifiers to their REV-02-locked display copy:
`make_clearer`→"Make clearer", `make_more_specific`→"Make more specific", `tighten`→"Tighten",
`match_brief`→"Match the brief", `reduce_repetition`→"Reduce repetition",
`try_another_approach`→"Try another approach", `custom`→"Custom". State: never a bare "Regenerate"
(REV-02); `custom` carries a free-text `customDirection`; `try_another_approach` carries
`priorProposals` avoid-context (D-05); `match_brief` degrades to `style_brief.voice` /
`visualDirection` + winning charity `missionStatement`/`whyOverlooked`/`focusArea` today, forward-
compatible with the Phase 47 Brief entity (D-07, RESEARCH Pitfall 5).

**§45.2 — New pipeline endpoints (`api/revision.py`, mounted in `api/main.py`).** Two Clerk-JWT-
guarded routes generalizing §42.4a's SAME preview/apply pair to arbitrary passages (D-01 — NOT a
second revision endpoint):
```
POST /issues/{run_id}/revise/preview  body {sectionName, quotedText, blockIndexHint?, direction, customDirection?, priorProposals?[]}
                                       -> 200 {proposedText, whatChanged, claimDelta:{added[],removed[],altered[]}}
                                       -> 409 {reason:"cost_cap_exceeded", message, spentUsd, projectedUsd, capUsd}   (REV-05)
POST /issues/{run_id}/revise/apply    body {ifRevisionID, sectionName, quotedText, blockIndexHint?, newText}
                                       -> 200 {revisionId, resolution:"revision_applied"}
                                       -> 409 {reason:"revision_mismatch"|"span_not_resolved"|"claim_edit_unavailable", message}
```
State the divergence from §42.4a explicitly (RESEARCH State-of-the-Art table): the apply body
carries the original passage text (`quotedText`) explicitly because passages, unlike claims, have
NO stored Convex row (Pitfall 3) — this is deliberate, not an oversight to "fix" back to the
leaner claim shape.

**§45.3 — Preview = read-only (D-02).** No Convex mutation of content, no Sanity write, no
`audit_log` row (mirrors `voice_pass.py::voice_rewrite`). It DOES record the revision LLM call's
cost (see §45.5). Structured LLM output: `{proposedText, whatChanged, claimDelta}` — the claimDelta
is ADVISORY narrative for the card only (D-09), never the enforced state change.

**§45.4 — Apply = atomic + audited (D-02).** Order: resolve `run_id`→`sanityIssueId` →
`_patch_prose_span` (span-resolve against CURRENT Sanity content via `resolve_span`, never
`claimSpans` §35.3 → content-patch → `_reset_touched_claims` FIRST) → `_revoke_active_signoffs`
(Phase-34 sign-off revocation IS revoked on applied revision — port the sentence not the prototype
bug, DERIVED-STATE-CONTRACT §10) → `_emit_audit` exactly ONE row, action `passage_revised`,
resource_type `passage`, resource_id `{run_id}:{sectionName}`. `ifRevisionID` mismatch → 409
`revision_mismatch` (§31.4). Unresolved span → 409 `span_not_resolved`. Edit-before-applying reuses
this SAME apply route with operator-edited `newText`; the deterministic `_reset_touched_claims` is
always correct regardless of the advisory delta (D-11).

**§45.5 — Cost guard (REV-05, D-12/D-13/D-14).** The per-issue denominator is the EXISTING
`per_run_cap_usd` (`pipeline_config`, default 10.0) — no second budget system (D-12). Spend is the
SUM of durable `agentRuns:byRunId({runId})` `costUsd` rows — NEVER `lib/cost.py`'s in-memory
`_store`, which the Publisher's `end_run()` clears before any review stage exists (RESEARCH Pitfall
1). Each revision LLM call records its cost under the issue's REAL `run_id` (never a
`evidence-preview-{run_id}` pseudo-id, D-13) via `agentRuns:completed` with a FRESH distinct
`agentKey` `revision-{uuid4().hex[:12]}` (never reuse a pipeline agentKey — `completed` is an
upsert-by-`(runId,agentKey)`, RESEARCH Pitfall 2). Preview returns 409 `cost_cap_exceeded` when the
projected next call would exceed the cap; the chip UI renders disabled-with-explanation (never
silent).

**§45.6 — Toolbar + entry points (REV-01, D-16/D-17/D-18).** The shared galley selection toolbar
offers all six actions (Edit text / Ask agent to revise / Compare with previous / Restore previous
/ Related facts & sources / Inspect how this was made). Compare/Restore render visible-but-reserved
with an explanatory `title` — content version history is DEFERRED (D-17). The same revision flow
mounts from the Phase-44 InspectorFooter, whose "Ask agent to revise" button flips from RESERVED
(§44.7) to LIVE (D-18). State: EDT-05 no-Sanity-write tripwire needs zero edits — the new
`revisionClient.ts` only ever calls `NEXT_PUBLIC_PIPELINE_URL` (RESEARCH Pitfall 7).

Close with the standard additive-only invariant sentence (no existing field renamed/removed;
§42 shapes unchanged; the endpoint GENERALIZES §42.4a rather than forking).
  </action>
  <verify>
    <automated>grep -q "## §45 — Agent Revision" docs/API_CONTRACTS.md && grep -q "revise/preview" docs/API_CONTRACTS.md && grep -q "try_another_approach" docs/API_CONTRACTS.md && grep -q "cost_cap_exceeded" docs/API_CONTRACTS.md && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## §45 — Agent Revision" docs/API_CONTRACTS.md` returns 1.
    - `docs/API_CONTRACTS.md` contains all 7 chip identifiers: `make_clearer`, `make_more_specific`, `tighten`, `match_brief`, `reduce_repetition`, `try_another_approach`, `custom`.
    - `docs/API_CONTRACTS.md` contains the strings `revise/preview`, `revise/apply`, `proposedText`, `claimDelta`, `cost_cap_exceeded`, `passage_revised`, `span_not_resolved`.
    - `docs/API_CONTRACTS.md` states preview is read-only/no-audit and apply emits exactly one audit row with `_reset_touched_claims` FIRST.
  </acceptance_criteria>
  <done>§45 documents the passage-revision preview/apply contract, chip identifiers, claim-delta shape, and cost-guard 409 in enough detail that 45-03 and 45-04 implement without inventing any field name or path.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: blockIndexFromKey pure helper (real, green) + its test</name>
  <requirements>REV-01</requirements>
  <read_first>
    - apps/dispatch-control/lib/galley/syntheticPortableText.ts:135-143 — the `_key = row-${sectionId}-${blockIndex}` construction this helper reverses.
    - apps/dispatch-control/__tests__/factCheckFilters.test.ts — a pure-function vitest convention in this repo to mirror (imports, describe/it/expect from 'vitest').
  </read_first>
  <behavior>
    - blockIndexFromKey('row-founderBio-2') === 2
    - blockIndexFromKey('row-originStory-0') === 0
    - blockIndexFromKey('row-problemStatement-11') === 11
    - blockIndexFromKey('claim-3') === null  (not a row key)
    - blockIndexFromKey('') === null and blockIndexFromKey('row-founderBio-x') === null (non-numeric tail)
  </behavior>
  <files>apps/dispatch-control/lib/blockIndexFromKey.ts, apps/dispatch-control/__tests__/blockIndexFromKey.test.ts</files>
  <action>
Create `apps/dispatch-control/lib/blockIndexFromKey.ts` exporting a pure
`export function blockIndexFromKey(key: string): number | null`. Implementation: require the key to
start with `row-`; take the substring after the LAST `-` (`key.slice(key.lastIndexOf('-') + 1)`),
`Number()` it, return `null` when the key does not start with `row-`, has no `-`, or the tail is not
a finite integer (`Number.isInteger`). This isolates the DOM-independent parse so the selection
integration (45-05) never re-implements it. Write `__tests__/blockIndexFromKey.test.ts` covering
every case in `<behavior>` (mirror the plain-vitest style of `factCheckFilters.test.ts`).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/blockIndexFromKey.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/lib/blockIndexFromKey.ts` exports `blockIndexFromKey`.
    - `cd apps/dispatch-control && npx vitest run __tests__/blockIndexFromKey.test.ts` exits 0 with all `<behavior>` cases passing.
  </acceptance_criteria>
  <done>The pure helper exists, is exported, and its test is green.</done>
</task>

<task type="auto">
  <name>Task 3: Scaffold the remaining Wave-0 test files (suite stays green)</name>
  <requirements>REV-01, REV-02, REV-03, REV-05</requirements>
  <read_first>
    - packages/pipeline/tests/test_factcheck_endpoints.py:1-60 — the pytest harness (FastAPI TestClient + MagicMock convex_http/sanity_http + `_FC` module-string monkeypatch) the revision pytest file will mirror; use `pytest.importorskip("eisenbalm_pipeline.api.revision")` at module top so the file SKIPS cleanly until 45-03 lands.
    - packages/pipeline/tests/test_budget_gate.py — the existing budget test conventions to mirror in the new `test_budget.py`.
    - apps/dispatch-control/__tests__/FactCheckScreen.test.tsx:1-30 — the vitest render/it convention; scaffold the console files as `it.todo(...)` (the 44-01 Wave-0 precedent) so no missing-module import breaks collection.
  </read_first>
  <files>packages/pipeline/tests/test_revision_endpoints.py, packages/pipeline/tests/test_budget.py, apps/dispatch-control/__tests__/PassageToolbar.test.tsx, apps/dispatch-control/__tests__/DirectionChips.test.tsx, apps/dispatch-control/__tests__/RevisionComparisonCard.test.tsx, apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx</files>
  <action>
Create the five scaffold test files enumerated in 45-VALIDATION.md's Wave-0 list, authored so the
FULL suite stays green today and each activates when its implementation lands:

1. `packages/pipeline/tests/test_revision_endpoints.py` — module top: `import pytest` then
   `pytest.importorskip("eisenbalm_pipeline.api.revision")` (skips the whole module until 45-03
   creates `api/revision.py`). Copy `test_factcheck_endpoints.py`'s harness (a `FastAPI()` mounting
   `revision.router`, `TestClient`, MagicMock `convex_http`/`sanity_http`, and a `_R =
   "eisenbalm_pipeline.api.revision"` monkeypatch string). Write the REAL tests keyed so
   `-k directive` / `-k preview` / `-k apply` / `-k cost_attribution` each select ≥1 test:
   `test_build_directive_per_chip` (asserts `_build_directive` returns the right clause for each of
   the 7 chips incl. custom passthrough + match_brief degradation), `test_preview_no_mutation_no_audit`,
   `test_preview_cost_cap_exceeded_returns_409`, `test_apply_patches_and_resets_and_audits_once`,
   `test_apply_stale_revision_id_409`, `test_apply_unresolved_span_409`,
   `test_cost_attribution_distinct_agentKey_real_runid` (asserts `agentRuns:completed` is called with
   `runId == run_id` and an `agentKey` matching `^revision-` — never a pipeline agentKey). These run
   for real once 45-03 lands.
2. `packages/pipeline/tests/test_budget.py` — module top guard
   `pytestmark = pytest.mark.skipif(not hasattr(__import__('eisenbalm_pipeline.lib.budget', fromlist=['x']), 'would_exceed_run_cap'), reason='45-02 not landed')`.
   Write `test_would_exceed_run_cap_sums_agent_runs`, `test_would_exceed_run_cap_over_cap_true`,
   `test_would_exceed_run_cap_disabled_when_cap_le_zero` (all named to match `-k run_cap`), monkeypatching
   `_cc.convex_query` to return fake `agent_runs` rows with `costUsd`.
3-6. `PassageToolbar.test.tsx`, `DirectionChips.test.tsx`, `RevisionComparisonCard.test.tsx`,
   `FrameChromeCostReadout.test.tsx` — each a vitest file with `describe(...)` + `it.todo(...)`
   entries naming every 45-VALIDATION case (e.g. PassageToolbar: "renders six actions",
   "Compare/Restore reserved-with-title", "Ask agent to revise fires onRevise"; DirectionChips:
   "renders 7 fixed-copy chips", "never renders Regenerate", "disabled-with-title when cost-capped";
   RevisionComparisonCard: "shows original/proposed/what-changed/claim-delta", "Apply/Edit/Try-another/
   Discard present"; FrameChromeCostReadout: "loading → refresh affordance not zero", "$spent / $cap
   when known"). Import NOTHING that does not yet exist (the `it.todo` bodies are title-only). Plans
   45-04/45-05/45-06 convert their `it.todo`s into real assertions.
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest tests/test_revision_endpoints.py tests/test_budget.py -q && cd ../../apps/dispatch-control && npx vitest run __tests__/PassageToolbar.test.tsx __tests__/DirectionChips.test.tsx __tests__/RevisionComparisonCard.test.tsx __tests__/FrameChromeCostReadout.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - All six files exist at the paths in `<files>`.
    - `cd packages/pipeline && python -m pytest tests/test_revision_endpoints.py tests/test_budget.py -q` exits 0 (both modules SKIP cleanly — no collection error, no failure).
    - `cd apps/dispatch-control && npx vitest run __tests__/PassageToolbar.test.tsx __tests__/DirectionChips.test.tsx __tests__/RevisionComparisonCard.test.tsx __tests__/FrameChromeCostReadout.test.tsx` exits 0 (todo entries reported, zero failures).
    - `grep -q "importorskip" packages/pipeline/tests/test_revision_endpoints.py` and `grep -q "would_exceed_run_cap" packages/pipeline/tests/test_budget.py`.
    - Running the FULL suites (`cd packages/pipeline && python -m pytest` and `cd apps/dispatch-control && npm run test`) both stay green.
  </acceptance_criteria>
  <done>All Wave-0 test files exist; the pytest stubs skip cleanly until their implementation lands; the console stubs list every VALIDATION case as `it.todo`; both full suites are green.</done>
</task>

</tasks>

<verification>
- `grep "## §45" docs/API_CONTRACTS.md` present.
- `npx vitest run __tests__/blockIndexFromKey.test.ts` green.
- Full pipeline pytest + full console vitest green (stubs skip/todo).
</verification>

<success_criteria>
§45 locks the passage-revision contract (paths, chip ids, claimDelta, cost-guard 409); the
`blockIndexFromKey` helper is real and green; the 5 scaffold test files exist and keep both suites
green while giving waves 2-3 an automated signal.
</success_criteria>

<output>
After completion, create `.planning/phases/45-agent-revision/45-01-SUMMARY.md`.
</output>
