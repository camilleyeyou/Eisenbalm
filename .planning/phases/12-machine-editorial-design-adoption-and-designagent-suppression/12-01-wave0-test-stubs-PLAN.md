---
phase: 12-machine-editorial-design-adoption-and-designagent-suppression
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/web/__tests__/machine-editorial-components.test.ts
  - apps/web/lib/theme.test.ts
  - packages/pipeline/tests/agents/test_validate.py
  - packages/pipeline/tests/test_pipeline_real_mode.py
  - packages/pipeline/tests/agents/test_design.py
autonomous: true
requirements: [MED-01, MED-02, MED-03, MED-04, MED-05]

must_haves:
  truths:
    - "A web source-scan tripwire fails if canonical anchor ids are removed from rebuilt SectionNavigator.tsx"
    - "A web source-scan tripwire fails if AGENT_LABELS or reduced-motion guard is removed from rebuilt DeliberationSlot.tsx/SectionNavigator.tsx"
    - "A web source-scan tripwire fails if a model-name literal appears in rebuilt DeliberationSlot.tsx (code-only)"
    - "A pipeline test proves the graph completes without state['theme'] when DESIGNAGENT_SUPPRESSED=true"
    - "A pipeline test proves validate_sections passes without 'theme' when suppressed"
    - "A pipeline test asserts the DesignAgent system prompt contains the Machine Editorial envelope phrase"
  artifacts:
    - path: "apps/web/__tests__/machine-editorial-components.test.ts"
      provides: "4 source-scan tripwires for MED-04/MED-05"
      contains: "machine-editorial-components"
    - path: "packages/pipeline/tests/agents/test_validate.py"
      provides: "validate_sections suppressed-mode assertion"
      contains: "DESIGNAGENT_SUPPRESSED"
  key_links:
    - from: "machine-editorial-components.test.ts"
      to: "SectionNavigator.tsx + DeliberationSlot.tsx"
      via: "readFileSync source scan"
      pattern: "readFileSync"
---

<objective>
Author the Wave 0 test surface for Phase 12, closing every gap in 12-VALIDATION.md before any production code changes. These tests encode the MED-01..MED-05 contracts: theme-suppression no-op behavior, the pipeline node-skip + REQUIRED_FIELDS lockstep, the DesignAgent envelope prompt phrase, and the four component-rebuild source-scan tripwires (canonical anchor ids, reduced-motion early-return, AGENT_LABELS, no model names).

Purpose: Tests-first so the implementing waves (02-05) have a green/red signal that proves each contract holds. Some assertions will be RED until the rebuild waves land — that is correct (this is a test scaffold), but the new pipeline tests and the existing-behavior assertions must be GREEN immediately.
Output: 1 new web test file, 1 new pipeline test file, and additive cases in 2 existing test files + 1 existing web test file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-VALIDATION.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md

<interfaces>
<!-- Existing patterns the executor must mirror — do NOT invent new helpers. -->

apps/web/__tests__/deliberation-no-model-names.test.ts ALREADY defines a `codeOnly()`
comment-stripping helper and a model-name literal check on DeliberationSlot.tsx. The new
file must NOT duplicate that file's responsibility — instead it adds the NEW MED-04/MED-05
tripwires (anchor ids, reduced-motion in SectionNavigator, AGENT_LABELS presence) and a
defensive code-only no-model-names re-check using the same codeOnly() pattern (copied
verbatim, since the existing model-name comment in DeliberationSlot.tsx — `// SECURITY:
never read run.cost (it contains the model-version map)` — would false-positive on "model"
without comment-stripping).

Existing codeOnly() helper (copy verbatim into the new file):
```typescript
function codeOnly(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')        // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')    // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')      // line comments (don't eat URL ://)
}
```

Pipeline test env-setup pattern (from test_pipeline_real_mode.py test_full_graph_runs_to_publisher):
```python
monkeypatch.setenv("EISENBALM_STUB_MODE", "false")
monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
monkeypatch.setenv("TAVILY_API_KEY", "test-key")
monkeypatch.setenv("NEXT_PUBLIC_SANITY_PROJECT_ID", "test-project")
monkeypatch.setenv("SANITY_API_TOKEN", "test-token")
```

Pipeline modules read DESIGNAGENT_SUPPRESSED at MODULE IMPORT time (builder.py + validate.py
will have `_SUPPRESSED = os.environ.get(...)` at module scope in Wave 1). So the suppressed
test must set the env var via monkeypatch BEFORE importing build_graph / reloading the module,
using `importlib.reload`. Mirror the in-test `from eisenbalm_pipeline.graph.builder import build_graph`
local import already present at line ~422 of test_pipeline_real_mode.py.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create web source-scan tripwire test file (MED-04/MED-05)</name>
  <files>apps/web/__tests__/machine-editorial-components.test.ts</files>
  <read_first>
    - apps/web/__tests__/deliberation-no-model-names.test.ts (copy the codeOnly() helper verbatim; do not duplicate this file's job — add the NEW tripwires only)
    - apps/web/__tests__/issue-page-typography.test.ts (readFileSync + describe/it + resolve(__dirname,...) pattern reference)
    - apps/web/components/issue/SectionNavigator.tsx (current source — anchor ids + prefers-reduced-motion present today; tripwires must stay green after rebuild)
    - apps/web/components/issue/DeliberationSlot.tsx (current source — AGENT_LABELS present today)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Code Examples → "New tripwire test pattern")
  </read_first>
  <action>
Create `apps/web/__tests__/machine-editorial-components.test.ts` (Vitest, source-scan style — readFileSync at module scope, NO DOM/render/mock). Copy the `codeOnly()` helper verbatim from deliberation-no-model-names.test.ts.

Resolve the two source paths:
```typescript
const NAV_PATH = resolve(__dirname, '../components/issue/SectionNavigator.tsx')
const DEL_PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')
```

Write exactly these four describe/it blocks:

1. `describe('MED-04: SectionNavigator Vertical Timeline tripwires')` — read NAV_PATH:
   - `it('preserves all 8 canonical anchor ids')`: for each id in `['#origin-story','#problem','#founder-bio','#case-study','#game','#bonus','#deliberation','#podcast']`, assert `expect(navSrc).toContain(id)`.
   - `it('preserves the prefers-reduced-motion early-return')`: `expect(navSrc).toContain('prefers-reduced-motion')`.

2. `describe('MED-05: DeliberationSlot Carousel & Flow tripwires (DEL-04 + subs)')` — read DEL_PATH:
   - `it('preserves AGENT_LABELS persona map')`: `expect(delSrc).toContain('AGENT_LABELS')`.
   - `it('preserves all 5 Convex useQuery subscriptions')`: for each of `['api.pipelineRuns.byRunId','api.pitchLog.byRunId','api.deliberationEvents.byRunId','api.agentVotes.byRunId','api.qaCorrections.byRunId']`, assert `expect(delSrc).toContain(sub)`.
   - `it('exposes no model-name literals in code (comment-stripped)')`: `const code = codeOnly(delSrc).toLowerCase()`; for each of `['claude','gpt','sonnet','haiku','openrouter','anthropic']` assert `expect(code).not.toContain(name)`. (Do NOT include the bare word 'model' — it legitimately appears in the `run.cost`/`modelVersions` SECURITY comment which codeOnly strips, but 'model' as a substring is too broad; the existing deliberation-no-model-names.test.ts already guards `modelVersions` access and `run.cost`. This file's check is the model-NAME literal backstop.)

All assertions must pass against the CURRENT (pre-rebuild) source — verify by running the command below. They will continue to pass after Waves 04/05 rebuild the components.
  </action>
  <verify>
    <automated>pnpm --filter web test:unit -- machine-editorial-components</automated>
  </verify>
  <acceptance_criteria>
    - File apps/web/__tests__/machine-editorial-components.test.ts exists and contains the literal string `codeOnly`
    - File contains all 8 anchor ids: grep `#origin-story` and `#podcast` both present
    - File contains `AGENT_LABELS`, `api.pipelineRuns.byRunId`, and `prefers-reduced-motion`
    - `pnpm --filter web test:unit -- machine-editorial-components` exits 0 (all assertions GREEN against current source)
  </acceptance_criteria>
  <done>The new tripwire file exists, passes against current source, and locks the 4 MED-04/MED-05 contracts.</done>
</task>

<task type="auto">
  <name>Task 2: Add theme-suppression behavior assertion to theme.test.ts</name>
  <files>apps/web/lib/theme.test.ts</files>
  <read_first>
    - apps/web/lib/theme.test.ts (current assertions — must stay green; understand the describe structure and how serializeThemeCss is exercised)
    - apps/web/lib/theme.ts (serializeThemeCss + BRAND_DEFAULTS — confirm serializeThemeCss(null) emits the LIGHT palette so the suppression test asserts the empty-string contract, NOT serializeThemeCss(null))
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Pitfall 1 — serializeThemeCss(null) emits BRAND_DEFAULTS light palette)
  </read_first>
  <action>
Append a new `describe('MED-01: theme suppression no-op contract')` block to `apps/web/lib/theme.test.ts`. This documents and locks the contract that the SUPPRESSION mechanism (implemented in Wave 1 Plan 03, in layout.tsx — NOT in theme.ts) must emit an empty string rather than calling `serializeThemeCss(null)`.

Since theme.ts is READ-ONLY this phase, the assertion is a guard against regression of the pitfall, expressed as documentation of expected serializer behavior:
- `it('serializeThemeCss(null) STILL emits the light BRAND_DEFAULTS palette (this is why suppression must bypass it)')`: call `serializeThemeCss(null)`, assert the returned string `.toContain(BRAND_DEFAULTS.bg)` (i.e. `#FAFAF8`). This proves the pitfall is real and locks the rationale: suppression code must emit `''`, never `serializeThemeCss(null)`.
- `it('the suppressed-mode CSS string is the empty string (contract for layout.tsx)')`: define a local helper `const suppressedThemeCss = (suppressed: boolean, theme: IssueTheme) => (suppressed ? '' : serializeThemeCss(theme))` and assert `suppressedThemeCss(true, { primaryColor: '#CDA434' } as IssueTheme)` `=== ''`, and that `suppressedThemeCss(false, null)` is non-empty. This encodes the exact gate Plan 03 implements in layout.tsx.

Import `serializeThemeCss`, `BRAND_DEFAULTS`, and the `IssueTheme` type as the existing tests do. Do NOT modify any existing assertion.
  </action>
  <verify>
    <automated>pnpm --filter web test:unit -- theme.test</automated>
  </verify>
  <acceptance_criteria>
    - apps/web/lib/theme.test.ts contains the literal `MED-01: theme suppression no-op contract`
    - apps/web/lib/theme.test.ts contains `suppressedThemeCss` and `=== ''` (or `toBe('')`)
    - `pnpm --filter web test:unit -- theme.test` exits 0 with all existing theme.test.ts assertions still green
  </acceptance_criteria>
  <done>theme.test.ts has a suppression-contract describe block that locks the empty-string gate and the BRAND_DEFAULTS pitfall; existing assertions unchanged and green.</done>
</task>

<task type="auto">
  <name>Task 3: Create test_validate.py with suppressed-mode REQUIRED_FIELDS assertion</name>
  <files>packages/pipeline/tests/agents/test_validate.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/validate.py (current REQUIRED_FIELDS tuple includes "theme" at module scope; validate_sections raises on missing fields)
    - packages/pipeline/tests/agents/test_design.py (pytest async style, imports, fixtures reference)
    - packages/pipeline/tests/test_pipeline_real_mode.py (monkeypatch.setenv + importlib reload pattern; how convex_mutation_safe is patched)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Pattern 2 + Pitfall 2 — REQUIRED_FIELDS must drop "theme" when suppressed)
  </read_first>
  <action>
Create `packages/pipeline/tests/agents/test_validate.py` (this file does NOT currently exist). It must verify BOTH modes of `validate_sections`, with the suppressed mode being the NEW Wave 0 gap.

Because `validate.py` reads `DESIGNAGENT_SUPPRESSED` at MODULE IMPORT time (the Wave 1 edit adds `_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1","true","yes")` and `REQUIRED_FIELDS = (..., *(() if _SUPPRESSED else ("theme",)))`), each test must set the env var BEFORE importing/reloading the module:

```python
import importlib
import os
import pytest


def _build_complete_state_without_theme():
    # Minimal DispatchState dict with all 6 non-theme section fields populated truthy.
    return {
        "run_id": "test-run-suppressed",
        "origin_story": {"body": "x"},
        "problem_statement": {"body": "x"},
        "founder_bio": {"body": "x"},
        "case_study": {"body": "x"},
        "game": {"description": "x"},
        "bonus": {"body": "x"},
        # NOTE: no "theme" key — design node was suppressed.
    }


@pytest.mark.asyncio
async def test_validate_sections_requires_theme_when_not_suppressed(monkeypatch):
    monkeypatch.delenv("DESIGNAGENT_SUPPRESSED", raising=False)
    import eisenbalm_pipeline.agents.validate as validate_mod
    importlib.reload(validate_mod)
    assert "theme" in validate_mod.REQUIRED_FIELDS
    state = _build_complete_state_without_theme()
    # Patch convex_mutation_safe so the failure path doesn't hit the network.
    monkeypatch.setattr(validate_mod, "convex_mutation_safe", _noop_async)
    with pytest.raises(RuntimeError, match="missing sections"):
        await validate_mod.validate_sections(state)


@pytest.mark.asyncio
async def test_validate_sections_skips_theme_when_suppressed(monkeypatch):
    monkeypatch.setenv("DESIGNAGENT_SUPPRESSED", "true")
    import eisenbalm_pipeline.agents.validate as validate_mod
    importlib.reload(validate_mod)
    assert "theme" not in validate_mod.REQUIRED_FIELDS
    state = _build_complete_state_without_theme()
    result = await validate_mod.validate_sections(state)
    assert result is state  # pass-through, no RuntimeError
```

Add a module-level `async def _noop_async(*a, **k): return None`.

IMPORTANT compatibility note: today (pre-Wave-1) `REQUIRED_FIELDS` is a fixed tuple with `"theme"` and validate.py does NOT read the env var. So `test_validate_sections_skips_theme_when_suppressed` will FAIL until Wave 1 Plan 02 adds the `_SUPPRESSED` gate — this is the intended RED Wave-0 signal. The `test_validate_sections_requires_theme_when_not_suppressed` test must PASS now. To keep the suite from going red on a not-yet-implemented contract, wrap the suppressed assertion describe with an `xfail` marker referencing Plan 02:
```python
@pytest.mark.xfail(reason="REQUIRED_FIELDS env gate lands in Plan 12-02 (Wave 1)", strict=False)
```
Place this decorator on `test_validate_sections_skips_theme_when_suppressed`. Plan 02 removes the xfail decorator when it implements the gate.
  </action>
  <verify>
    <automated>cd packages/pipeline && pytest tests/agents/test_validate.py -v</automated>
  </verify>
  <acceptance_criteria>
    - File packages/pipeline/tests/agents/test_validate.py exists and contains `DESIGNAGENT_SUPPRESSED`
    - File contains both `test_validate_sections_requires_theme_when_not_suppressed` and `test_validate_sections_skips_theme_when_suppressed`
    - File contains `importlib.reload` and an `xfail` marker referencing Plan 12-02
    - `cd packages/pipeline && pytest tests/agents/test_validate.py` exits 0 (non-suppressed test passes; suppressed test xfails — not an error)
  </acceptance_criteria>
  <done>test_validate.py exists with both modes; non-suppressed passes now, suppressed is xfail-marked pending Plan 02.</done>
</task>

<task type="auto">
  <name>Task 4: Add suppressed-mode pipeline test + DesignAgent envelope assertion</name>
  <files>packages/pipeline/tests/test_pipeline_real_mode.py, packages/pipeline/tests/agents/test_design.py</files>
  <read_first>
    - packages/pipeline/tests/test_pipeline_real_mode.py (line ~435 test_full_graph_runs_to_publisher; line ~468 `result.get("theme", {}).get("primaryColor")` assertion; line ~422 local `from eisenbalm_pipeline.graph.builder import build_graph`; the _mock_acomplete + patch setup lines ~200-368)
    - packages/pipeline/tests/agents/test_design.py (existing validation assertions; _valid_theme helper; how `design` and `_build_messages` are importable)
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py (_build_messages signature: kwargs charity=, style_brief=, retry_errors=; the system string Wave 1 Plan 02 extends)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Pitfall 3 + DesignAgent envelope content; the phrase to assert)
  </read_first>
  <action>
Two additive changes across two existing pipeline test files. Do NOT modify the existing `test_full_graph_runs_to_publisher` (it runs in non-suppressed default mode and its line-468 `theme.primaryColor` assertion stays valid).

(a) In `packages/pipeline/tests/test_pipeline_real_mode.py`, add a new test `test_design_suppressed_graph_completes_without_theme` mirroring the env + patch setup of `test_full_graph_runs_to_publisher`, plus `monkeypatch.setenv("DESIGNAGENT_SUPPRESSED", "true")`. Because `builder.py` and `validate.py` read the flag at module-import time (Wave 1), the test must `importlib.reload` both modules after setting the env var, then build + invoke the graph:
```python
import importlib
monkeypatch.setenv("DESIGNAGENT_SUPPRESSED", "true")
# ... same OPENROUTER/TAVILY/SANITY env setup as test_full_graph_runs_to_publisher ...
import eisenbalm_pipeline.agents.validate as validate_mod
import eisenbalm_pipeline.graph.builder as builder_mod
importlib.reload(validate_mod)
importlib.reload(builder_mod)
assert "design" not in builder_mod.SECTION_WRITERS
# ... build_graph(checkpointer), ainvoke(initial_state) ...
assert result.get("theme") is None  # design node skipped — theme never set
assert result.get("origin_story", {}).get("body")  # other sections still complete
```
Reuse the same `_mock_acomplete` patch list and `convex_mock` setup the existing test uses (the design-agent acomplete patch is harmless when the node is absent). Mark the new test `@pytest.mark.xfail(reason="SECTION_WRITERS env gate lands in Plan 12-02", strict=False)` so it does not red the suite until Plan 02; Plan 02 removes the xfail.

(b) In `packages/pipeline/tests/agents/test_design.py`, add one assertion `test_build_messages_contains_machine_editorial_envelope`:
```python
def test_build_messages_contains_machine_editorial_envelope():
    from eisenbalm_pipeline.agents.design import _build_messages
    messages = _build_messages(charity={"name": "X"}, style_brief={"visualDirection": ""})
    system = next(m["content"] for m in messages if m["role"] == "system")
    assert "Machine Editorial" in system
```
Mark this `@pytest.mark.xfail(reason="DesignAgent envelope text lands in Plan 12-02 (MED-03)", strict=False)`; Plan 02 removes the xfail when it adds the `Machine Editorial` envelope phrase to the system string. The exact phrase the prompt must contain is the literal string `Machine Editorial` (Plan 02 RESEARCH envelope uses `AESTHETIC ENVELOPE (Machine Editorial)`).
  </action>
  <verify>
    <automated>cd packages/pipeline && pytest tests/test_pipeline_real_mode.py::test_design_suppressed_graph_completes_without_theme tests/agents/test_design.py::test_build_messages_contains_machine_editorial_envelope -v</automated>
  </verify>
  <acceptance_criteria>
    - test_pipeline_real_mode.py contains `test_design_suppressed_graph_completes_without_theme` and `DESIGNAGENT_SUPPRESSED` and `importlib.reload`
    - test_pipeline_real_mode.py NEW test asserts `result.get("theme") is None` and `"design" not in builder_mod.SECTION_WRITERS`
    - test_design.py contains `test_build_messages_contains_machine_editorial_envelope` asserting `"Machine Editorial" in system`
    - Both new tests carry an `xfail` decorator referencing Plan 12-02
    - `cd packages/pipeline && pytest tests/agents/test_design.py tests/test_pipeline_real_mode.py` exits 0 (existing tests green; the two new ones xfail)
  </acceptance_criteria>
  <done>The suppressed-graph and envelope-phrase tests exist as xfail Wave-0 stubs that Plan 02 will turn green; existing real-mode + design tests remain green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` exits 0 (new machine-editorial-components.test.ts + theme.test.ts additions green; no existing web test regresses)
- `cd packages/pipeline && pytest` exits 0 (new test_validate.py + the two xfail stubs do not red the suite; all existing pipeline tests green)
- Wave 0 closes all 5 gaps listed in 12-VALIDATION.md "Wave 0 Requirements"
</verification>

<success_criteria>
- All 4 web source-scan tripwires exist and pass against current source
- theme.test.ts encodes the empty-string suppression contract and the BRAND_DEFAULTS pitfall
- test_validate.py exists with both modes (suppressed = xfail pending Plan 02)
- Suppressed-graph + envelope-phrase pipeline tests exist as xfail stubs pending Plan 02
- No production source files modified (test files only)
</success_criteria>

<output>
After completion, create `.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-01-SUMMARY.md`
</output>
