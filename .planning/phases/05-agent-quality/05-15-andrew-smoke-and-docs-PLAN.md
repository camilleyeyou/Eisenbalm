---
phase: 05-agent-quality
plan: 15
type: execute
wave: 8
depends_on:
  - "05-14"
files_modified:
  - packages/pipeline/README.md
  - packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py
  - .planning/STATE.md
autonomous: false
requirements_addressed:
  - AGT-14
  - AGT-17
must_haves:
  truths:
    - "packages/pipeline/README.md documents EISENBALM_STUB_MODE toggle, the new env vars (OPENROUTER_API_KEY, TAVILY_API_KEY, PIPELINE_COST_CAP_USD, PIPELINE_COST_WARN_PCT), and the real-mode test entrypoint"
    - "Andrew has approved the font whitelist contents of agents/design/font_whitelist.py (D-16 STATE.md blocker cleared)"
    - "Andrew has run one real-mode pipeline end-to-end (Calibrator → Editor Final) against Railway + dev Convex + dev Sanity"
    - "Andrew has recorded the first-real-run cost in STATE.md and tuned PIPELINE_COST_CAP_USD if the observed P95 diverges from the $10 default"
  artifacts:
    - path: "packages/pipeline/README.md"
      provides: "Phase 5 real-mode operator documentation"
      contains: "EISENBALM_STUB_MODE"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py"
      provides: "Andrew-approved font list (D-16 blocker resolved)"
      contains: "approved by Andrew"
    - path: ".planning/STATE.md"
      provides: "First-real-run cost baseline + font-whitelist-approved entry"
      contains: "real-run cost baseline"
  key_links:
    - from: "packages/pipeline/README.md"
      to: "tests/test_pipeline_real_mode.py + agents/qa/rubric.md"
      via: "operator runbook for Phase 5 real-mode + rubric editing"
      pattern: "rubric.md"
---

<objective>
Close Phase 5 with the three manual steps that cannot be automated: (1) document the operator runbook for real-mode in `packages/pipeline/README.md`, (2) Andrew reviews and approves the font whitelist (D-16 blocker per STATE.md), and (3) Andrew runs one end-to-end real-mode pipeline and records the cost baseline.

This plan is `autonomous: false` and mirrors the structure of Phase 4's Plan 04-12 (Andrew smoke). It contains three tasks: one autonomous documentation task, then two `checkpoint:human-action` tasks for Andrew's eyes-on work.

Three concerns:

1. **Documentation (autonomous):** Update `packages/pipeline/README.md` with the Phase 5 surface area: `EISENBALM_STUB_MODE` toggle semantics (default now `false`), required env vars (`OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `PIPELINE_COST_CAP_USD`, `PIPELINE_COST_WARN_PCT`), `pytest tests/test_pipeline_real_mode.py` invocation, and a "where to edit the QA rubric" pointer to `agents/qa/rubric.md`.

2. **Font whitelist approval (checkpoint:human-action):** Andrew opens `agents/design/font_whitelist.py`, reviews each candidate font in `WHITELIST_DISPLAY` and `WHITELIST_BODY`, marks rejected fonts (deletes them), and signs off with a comment header `# Approved by Andrew YYYY-MM-DD`. This is the D-16 STATE.md blocker; Phase 5 cannot close without it.

3. **First-real-run cost baseline (checkpoint:human-action):** Andrew runs the Phase 5 pipeline end-to-end against Railway with real OpenRouter + Tavily + Convex + Sanity. Records observed per-agent + total USD cost in STATE.md. If observed cost materially diverges from the $10/run default, Andrew adjusts `PIPELINE_COST_CAP_USD` on Railway (and updates the README + `.env.example`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@packages/pipeline/README.md
@packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
@docs/CLAUDE_CODE_BRIEF.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update packages/pipeline/README.md for Phase 5 real-mode operations</name>
  <files>packages/pipeline/README.md</files>

  <read_first>
    - packages/pipeline/README.md (existing Phase 4 documentation)
    - .planning/phases/05-agent-quality/05-CONTEXT.md (Phase 5 surface area)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md (Plan 05-13; reference path for rubric editing)
    - packages/pipeline/tests/test_pipeline_real_mode.py (Plan 05-14; reference path for real-mode tests)
  </read_first>

  <action>
  Append a new section to `packages/pipeline/README.md` titled `## Phase 5 — Real-Mode Operations`. Preserve all existing Phase 4 content. The new section contains:

  ```markdown
  ## Phase 5 — Real-Mode Operations

  Phase 5 ships the real LLM-driven agents. Stub mode remains available as a fallback for testing.

  ### Toggle: `EISENBALM_STUB_MODE`

  | Value | Behavior |
  |-------|----------|
  | `false` (default since Phase 5 D-22) | Live OpenRouter + Tavily calls; live Convex + Sanity writes |
  | `true` | All LLM/Tavily calls return canned fixtures from `stubs/fixtures.py`; zero token usage; useful for Phase 4 PIP-06 regression smoke |

  ### Required Environment Variables

  | Var | Purpose | Where to set |
  |-----|---------|--------------|
  | `OPENROUTER_API_KEY` | OpenRouter authentication (Claude routing) | Railway env + `.env.local` for dev |
  | `TAVILY_API_KEY` | Tavily web search (Scout + Researcher) | Railway env + `.env.local` for dev |
  | `PIPELINE_COST_CAP_USD` | Hard cap per run (default: `10.0`) | Railway env; tune after first 5 real runs |
  | `PIPELINE_COST_WARN_PCT` | Soft-warn threshold as fraction of cap (default: `0.7`) | Railway env |
  | `SANITY_API_TOKEN` | Sanity write access (Phase 1 → unchanged) | Railway env + `.env.local` |
  | `CONVEX_DEPLOY_KEY` | Convex HTTP API auth (Phase 3 → unchanged) | Railway env + `.env.local` |

  ### Running the Real-Mode Test

  ```bash
  cd packages/pipeline
  EISENBALM_STUB_MODE=false uv run pytest tests/test_pipeline_real_mode.py -x -v
  ```

  This runs the full graph (Calibrator → ... → Editor Final) with all external integrations mocked. Live-API tests run against Railway under Andrew's eye — not automated.

  ### Editing the QA Rubric (`agents/qa/rubric.md`)

  The Layer-2 LLM-as-judge prompt lives at:

  `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md`

  It is version-controlled. After 3+ real-mode issues, Andrew reviews flagged `qaCorrections` rows and edits the rubric prompt to add forbidden constructs, adjust severity thresholds, or refine the evaluation axes. No code change is needed — the rubric is loaded from disk on each QA run.

  ### Per-Agent Model Pinning

  | Tier | Agents | Model |
  |------|--------|-------|
  | Voice-critical | Calibrator, Editor gate 1, Editor Final, QA | `anthropic/claude-opus-4-7` (pinned) |
  | Section writers | OriginStory, Problem, FounderBio, CaseStudy, Bonus, Game, Researcher | `anthropic/claude-sonnet-4-6` (latest alias) |
  | Mechanical | Scout, Advocate, DesignAgent | `anthropic/claude-haiku-4-5` (latest alias) |

  Resolved model IDs are written to `weeklyIssue.pipelineMetadata.modelVersions` (JSON string) on every run — the observability surface for AGT-17.

  ### Cost Observability

  - Soft alert at 70% of `PIPELINE_COST_CAP_USD` emits a Convex `deliberationEvents` row with `eventType='cost-warning'`.
  - Hard halt at 100% raises `CostCapExceeded`; `pipelineRuns.status='failed'` + `errorMessage='cost-cap-exceeded: $X.XX of $Y.YY (agent: Z)'`.
  - Per-agent cost record flushed to `pipelineRuns.cost` (JSON) at run end.
  ```

  Do NOT remove any Phase 4 sections. Append at end (after existing content).
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -c "Phase 5 — Real-Mode Operations" packages/pipeline/README.md | grep -q "^1$" && grep -c "EISENBALM_STUB_MODE" packages/pipeline/README.md | awk '$1 >= 1 {print "OK"; exit} {print "FAIL"; exit 1}' && grep -c "PIPELINE_COST_CAP_USD" packages/pipeline/README.md | grep -q . && grep -c "rubric.md" packages/pipeline/README.md | grep -q . && echo OK</automated>
  </verify>

  <acceptance_criteria>
    - `packages/pipeline/README.md` contains `## Phase 5 — Real-Mode Operations` heading exactly once
    - README documents the EISENBALM_STUB_MODE table with default=false note
    - README lists OPENROUTER_API_KEY, TAVILY_API_KEY, PIPELINE_COST_CAP_USD, PIPELINE_COST_WARN_PCT env vars
    - README references `tests/test_pipeline_real_mode.py` invocation
    - README references `agents/qa/rubric.md` path
    - README lists the three-tier model pinning (Opus / Sonnet / Haiku)
    - Phase 4 content preserved (no deletions)
  </acceptance_criteria>

  <done>
  Operator can read the README and run Phase 5 real-mode end-to-end without consulting the planning artifacts.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Andrew approves the font whitelist (D-16 blocker)</name>

  <what-built>
  Plan 05-04 created `packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py` with a candidate list of ~25 fonts (Google Fonts, claimed WeasyPrint-compatible). RESEARCH §"Font Whitelist" lines 1142-1196 lists each candidate. None of the candidates have been individually render-tested with WeasyPrint; Andrew's aesthetic approval plus one batch render is the Phase 5 gate.

  D-16 is flagged in `.planning/STATE.md` as the Phase 5 blocker. Until Andrew signs off, DesignAgent runs against the candidate list with no editorial confirmation — risk of an editorial reject after a real run.
  </what-built>

  <how-to-verify>
  Andrew does the following:

  1. **Open `packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py`** in an editor.

  2. **For each font in `WHITELIST_DISPLAY` and `WHITELIST_BODY`**, decide:
     - ✓ Keep — fits Jesse-voice aesthetic (Fortune-500 serious, no novelty fonts)
     - ✗ Reject — delete the line; add a `# rejected by Andrew: <reason>` comment if useful

  3. **Optionally add WeasyPrint render verification** (recommended but not required): render a sample page with each font using `weasyprint` from CLI:
     ```bash
     for font in "Playfair Display" "Lora" ... ; do
         echo "<style>@import url('https://fonts.googleapis.com/css2?family=$font'); body{font-family:'$font';}</style><body>Sample text</body>" \
             | weasyprint - "sample-$font.pdf"
     done
     ```
     Open each PDF, confirm font renders correctly. Reject any that fail to render or render with the wrong weight.

  4. **Add an approval header comment** at the top of `font_whitelist.py`:
     ```python
     """Andrew-approved font whitelist (D-16 resolved YYYY-MM-DD).

     # Approved by Andrew YYYY-MM-DD
     ...
     """
     ```

  5. **Update `.planning/STATE.md`** — find the D-16 blocker line and mark it as resolved with the approval date.

  6. **Commit** the changes:
     ```bash
     git add packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py .planning/STATE.md
     git commit -m "docs(05-15): Andrew approves font whitelist (D-16 resolved)"
     ```

  7. **Confirm fallback defaults still in whitelist:**
     - `FALLBACK_FONT_DISPLAY = "Playfair Display"` MUST remain in `WHITELIST_DISPLAY`
     - `FALLBACK_FONT_BODY = "Source Serif Pro"` MUST remain in `WHITELIST_BODY`
     - If either is rejected, Andrew must update the FALLBACK constants in the same file.

  Resume signal: type `font-whitelist-approved` once `font_whitelist.py` has the approval header AND STATE.md notes D-16 resolved AND fallback defaults are present in their respective whitelists.
  </how-to-verify>

  <resume-signal>Type "font-whitelist-approved" once font_whitelist.py is approved, STATE.md updated, and fallback defaults verified.</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Andrew runs first real-mode pipeline + records cost baseline</name>

  <what-built>
  All Phase 5 agent bodies are real. The integration test in Plan 05-14 verifies the wiring with mocks. Plan 05-14 also flipped `EISENBALM_STUB_MODE` default to `false`. What has NOT been done: a live end-to-end pipeline run against real OpenRouter + Tavily + Convex + Sanity from Railway. That is this task.

  Per CONTEXT D-08, the default cost cap is `$10/run`. PROJECT.md notes that per-run cost is unknown until the first real runs; Andrew adjusts after observing actuals.
  </what-built>

  <how-to-verify>
  Andrew does the following:

  1. **Confirm env vars on Railway dev:**
     - `OPENROUTER_API_KEY` set (with a Claude-capable account)
     - `TAVILY_API_KEY` set
     - `EISENBALM_STUB_MODE=false` (or unset — default is now false)
     - `PIPELINE_COST_CAP_USD=10.0` (or override)
     - `SANITY_API_TOKEN`, `CONVEX_DEPLOY_KEY` already set from Phases 1-4

  2. **Trigger one pipeline run** via the existing `POST /run` endpoint on Railway (Phase 4 entrypoint). Use a test issue number like `999` to avoid colliding with the next real issue. Sample command:
     ```bash
     curl -X POST https://<railway-domain>/run \
         -H 'Content-Type: application/json' \
         -d '{"issueNumber": 999}'
     ```

  3. **Monitor execution** via Railway logs. Expected duration: 3-7 minutes depending on Tavily response time + LLM latency. Expected cost: $3-6 per current model pricing.

  4. **Wait for completion** — pipeline either:
     - Reaches `pipelineRuns.status='awaiting-review'` (Editor gate 1 deterministic winner; no human input needed)
     - Reaches `pipelineRuns.status='awaiting-review'` after gate-1 interrupt (in this case, Andrew resumes via the existing Phase 4 interrupt-resume mechanism)
     - Fails: investigate logs, fix, re-run

  5. **Verify outputs in Sanity Studio:**
     - Open the draft weeklyIssue for issue 999
     - Confirm all 8 sections present (Origin Story, Problem, Founder Bio, Case Study, Game, Bonus, Theme, deliberation transcript)
     - Confirm `pipelineMetadata.modelVersions` JSON contains 4 voice-critical agents (calibrator, editor_gate1, qa, editor_final) — AGT-17 verification
     - Confirm `qaCorrections` rows exist in Convex (some `info` or `warning` severity is expected; ANY `error` severity means investigate — Jesse-voice failure)

  6. **Record cost baseline in STATE.md.** Append a section:
     ```markdown
     ## Phase 5 First-Real-Run Cost Baseline (YYYY-MM-DD)

     - Total USD: $X.XX
     - Per-agent breakdown: (read from `pipelineRuns.cost` JSON)
     - Cap (`PIPELINE_COST_CAP_USD`): $10.0
     - Margin: X.X% headroom
     - Decision: keep cap at $10 / lower to $X / raise to $X (whichever applies)
     ```

  7. **Adjust `PIPELINE_COST_CAP_USD` on Railway** if observed cost > $7 (i.e. soft-warn threshold > 70% on a typical run — too tight).

  8. **Update `.env.example`** if the default `PIPELINE_COST_CAP_USD=10.0` line needs adjustment.

  9. **Commit** the STATE.md + `.env.example` changes:
     ```bash
     git add .planning/STATE.md packages/pipeline/.env.example
     git commit -m "docs(05-15): record Phase 5 first-real-run cost baseline"
     ```

  10. **Delete or archive the issue 999 draft from Sanity** so it does not collide with the next real issue number.

  Resume signal: type `real-run-baseline-recorded` once the run is complete AND STATE.md records the cost baseline AND the test draft is cleaned up.
  </how-to-verify>

  <resume-signal>Type "real-run-baseline-recorded" once the first real-mode run is complete, STATE.md records the cost, and the test draft is cleaned up.</resume-signal>
</task>

</tasks>

<verification>
After all three tasks complete:
- `grep -c "Phase 5 — Real-Mode Operations" packages/pipeline/README.md` returns 1
- `grep -c "Approved by Andrew" packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py` returns ≥ 1
- `.planning/STATE.md` records D-16 resolved + Phase 5 first-real-run cost baseline section
- `pipelineRuns.cost` JSON exists in Convex for the test issue
- All Phase 5 success criteria from `.planning/ROADMAP.md` Phase 5 section verified (issue draft has all 8 sections + modelVersions populated + zero Layer-1-hard-rule 'error' qaCorrections)
</verification>

<success_criteria>
- README documents Phase 5 real-mode operations
- D-16 font whitelist approved by Andrew
- First-real-run cost baseline recorded in STATE.md
- PIPELINE_COST_CAP_USD tuned if observed cost diverges from $10
- One end-to-end real-mode draft visible in Sanity Studio with pipelineMetadata.modelVersions populated
- Phase 5 ready to close; Phase 6 (PDF + webhook) can begin
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-15-andrew-smoke-and-docs-SUMMARY.md` summarizing:
- D-16 resolution date + approved font list size (N display + M body)
- First-real-run cost (per-agent + total)
- Final PIPELINE_COST_CAP_USD value (if changed)
- Any qaCorrections findings worth flagging for the Phase 5 retrospective
</output>
