# Phase 24: Prompt Editor + Versioning — Research

**Researched:** 2026-06-22
**Domain:** CodeMirror 6 / React, Convex versioning mutations, LangGraph single-node isolation, voice byte-equivalence migration
**Confidence:** HIGH

---

## Summary

Phase 24 is the first write/control surface in the dispatch-control dashboard. It requires wiring six distinct capability areas: (1) a CodeMirror 6 editor in a Next.js 15 App Router client component; (2) Convex versioning mutations layered on top of the existing `prompt_versions` table; (3) a side-by-side diff renderer; (4) a backend `POST /agents/{key}/test-run` endpoint that invokes a single LangGraph node in isolation; (5) migration of user-prompt templates, section guidance, `qa/rubric.md`, and `VOICE_CONSTRAINTS` into versioned rows with byte-verified v1 seeds; and (6) `VOICE_CONSTRAINTS` versioning without breaking the Phase 16 import-time sentinel and `test_voice.py` invariants.

The codebase is in good shape for this phase. The `prompt_versions` table, `by_workspace_agentKey` index, `upsertActive` seed mutation, `getActive` read query, audit-log infrastructure, and config-loader two-tier fallback all exist and need extensions rather than ground-up builds. The largest research risk was the VOICE_CONSTRAINTS sentinel pattern and the single-agent isolation seam; both are now understood in detail and tractable patterns are documented below.

**Primary recommendation:** Use `@uiw/react-codemirror` (v4.25.10) with a custom `StateField`-based `{variable}` highlighter; use the `diff` npm package for text diffing + a custom two-column React renderer; expose the test-run endpoint as a new `api/agents.py` FastAPI router; treat `VOICE_CONSTRAINTS` as a composite-key agentKey `voice_constraints` in `prompt_versions` and feed `assemble_voice` from the active row at run-start rather than at import time.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Everything becomes editable + versioned this phase.** All of: system prompts, user-prompt templates, section-writer `SECTION_GUIDANCE`, `qa/rubric.md`, and `VOICE_CONSTRAINTS`. Each newly-externalized asset follows the Phase 22 pattern: migrate as v1 active row with **byte-verification (zero diff)**, switch call site to read active version, retain disk/code original as fallback. Split into multiple plans.
- **D-02: Block activation with explanation — no queue.** When a run is in progress, Activate is disabled and shows "A run is in progress — activation will be available when it finishes." In-progress check reads `runs` / `pipelineRuns` status.
- **D-03: Test-run executes the CURRENT unsaved editor draft**, not only saved versions.
- **D-04: Support all four input-sourcing modes:** pull prior-real input (from `agent_run_payloads`), edit unsaved draft (D-03), manual variable entry, canned sample fixture.
- **D-05: Canonical per-agent variable registry is the source of truth.** Drives both highlight color and unknown/mangled-variable warning shown before save.

### Claude's Discretion

- Exact Convex mutation signatures for `saveVersion` / `activate` / version-list/get-by-version, and whether rollback is just `activate(olderVersion)` (likely yes).
- Diff rendering library/approach (must be side-by-side).
- Where the variable registry physically lives (D-05).
- Test-run endpoint shape, isolation mechanism, and how the unsaved-draft prompt is passed in.
- CodeMirror integration specifics (packages, custom highlight extension for `{variable}` tokens).
- Editor layout, version-history list presentation, empty states, mobile behavior.
- Whether non-prompt agent config (model/temp/tokens) editing is co-located (not required).

### Deferred Ideas (OUT OF SCOPE)

- Run control (trigger, cancel, scheduler, budget caps) — Phase 25.
- Review gate / charity registry — Phase 26.
- Stripe reconciliation / notifications — Phase 27.
- Editable graph topology — Phase 28.
- Pending-activation queue (rejected in D-02).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRM-01 | Operator can edit an agent's system prompt and user-prompt template in a UI editor | CodeMirror 6 via `@uiw/react-codemirror`; `prompts/page.tsx` placeholder replaced; user-template externalization pattern documented |
| PRM-02 | Editor highlights template variables and warns on unknown/mangled variables before save | Custom `StateField` + `Decoration` extension; per-agent variable registry enumerated from source |
| PRM-03 | Saving creates a new version (author + timestamp + optional note) and never overwrites prior versions | `saveVersion` Convex mutation design documented; version-increment pattern explicit |
| PRM-04 | Operator can diff any two versions and activate/rollback in one click; activation blocked while run in progress | `diff` npm package + custom two-column renderer; in-progress guard via `runs`/`pipelineRuns` status |
| PRM-05 | Operator can test-run a single agent against sample or prior-real input and see output + cost | Single-node isolation via direct `acomplete` call pattern; four input modes; cost from existing capture path |
| PRM-06 | `VOICE_CONSTRAINTS` is editable and versioned as a first-class config entry | Composite agentKey `voice_constraints`; `assemble_voice` fed from DB at run-start not import time; sentinel preserved |
</phase_requirements>

---

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@uiw/react-codemirror` | 4.25.10 | React wrapper for CodeMirror 6 editor | Thin, well-maintained wrapper; ships typed `extensions` prop; SSR-safe when wrapped in dynamic import |
| `@codemirror/state` | 6.6.0 | StateField, StateEffect, RangeSet, Decoration | Core CM6 state primitives for custom highlight extension |
| `@codemirror/view` | 6.43.1 | EditorView, ViewPlugin, DecorationSet | View-layer extension API |
| `@codemirror/lang-markdown` | 6.5.0 | Markdown language support | Prompt files are Markdown-adjacent prose with `{token}` tokens |
| `diff` | 9.0.0 | Pure-JS diff computation (Myers algorithm) | Zero-dependency; `diffLines()` / `diffWords()` return change arrays; fast enough for prompt text sizes |

**No Monaco Editor.** Monaco (`@monaco-editor/react` v4.7.0) is far heavier (~4 MB bundle) and requires webpack worker configuration in Next.js 15; CodeMirror 6 is the correct choice for this text-editing surface.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@codemirror/theme-one-dark` or `@uiw/codemirror-theme-*` | bundled | Editor theme | Match dispatch-control neutral-900 palette |

**Installation:**
```bash
cd apps/dispatch-control
npm install @uiw/react-codemirror @codemirror/state @codemirror/view @codemirror/lang-markdown diff
npm install -D @types/diff
```

**Version verification (confirmed 2026-06-22 via npm registry):**
- `@uiw/react-codemirror`: 4.25.10 (latest stable)
- `@codemirror/state`: 6.6.0
- `@codemirror/view`: 6.43.1
- `diff`: 9.0.0

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
apps/dispatch-control/
  app/(dashboard)/prompts/
    page.tsx                          # Replaces placeholder — agent selector + editor shell
    [agentKey]/
      page.tsx                        # Per-agent editor page (system prompt + user template tabs)
    _components/
      PromptEditor.tsx                # 'use client' — CodeMirror wrapper + variable highlight
      VariableRegistry.ts             # Per-agent variable registry (code constant)
      VersionHistoryPanel.tsx         # Version list + activate/rollback controls
      DiffViewer.tsx                  # Side-by-side two-column diff renderer
      TestRunPanel.tsx                # Test-run input modes + output display
      PromptSaveDialog.tsx            # Note field + confirm before saveVersion

convex/
  promptVersions.ts                   # Add saveVersion, activate, listForAgent, getByVersion
  agents.ts                           # Add listForWorkspace (already exists for Phase 23 graph view)

packages/pipeline/src/eisenbalm_pipeline/
  api/
    agents.py                         # New FastAPI router — POST /agents/{key}/test-run
  lib/
    voice.py                          # Add load_voice_from_db() feeding assemble_voice at run-start
    config_loader.py                  # Extend AGENT_KEY_TO_PROMPT_FILE for new assets
  agents/qa/
    rubric.md                         # Stays on disk + seeded as prompt_versions v1
  prompts/                            # New .md files for user-templates once externalized
    <agent>_user.md                   # User-prompt template for each agent
    section_guidance_origin.md        # SECTION_GUIDANCE for origin_story
    section_guidance_problem.md       # SECTION_GUIDANCE for problem
    section_guidance_founder_bio.md   # GUIDANCE_VERIFIED/ANONYMOUS for founder_bio
    section_guidance_case_study.md    # GUIDANCE_VERIFIED/ANONYMOUS for case_study
    rubric.md                         # Copy/symlink of qa/rubric.md for loader
    voice_constraints.md              # VOICE_CONSTRAINTS seed file
```

### Pattern 1: CodeMirror 6 in Next.js 15 App Router

**Problem:** CodeMirror 6 uses browser APIs (`window`, `document`) that blow up in SSR. Next.js 15 App Router renders server components by default.

**Solution:** Wrap in `next/dynamic` with `{ ssr: false }`.

```typescript
// apps/dispatch-control/app/(dashboard)/prompts/_components/PromptEditor.tsx
'use client'
import dynamic from 'next/dynamic'

const CodeMirrorEditor = dynamic(
  () => import('./_CodeMirrorInner'),
  { ssr: false, loading: () => <div className="h-64 bg-neutral-100 animate-pulse rounded" /> }
)
```

```typescript
// _CodeMirrorInner.tsx  — 'use client', loaded only in browser
'use client'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { variableHighlighter } from './variableHighlightExtension'

interface Props {
  value: string
  onChange: (value: string) => void
  allowedVariables: string[]
}

export default function CodeMirrorInner({ value, onChange, allowedVariables }: Props) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[markdown(), variableHighlighter(allowedVariables)]}
      theme="light"
      className="border border-neutral-200 rounded font-mono text-sm"
    />
  )
}
```

### Pattern 2: Custom `{variable}` Highlight Extension

**What:** A CodeMirror 6 `StateField` + `DecorationSet` that scans the document for `{WORD}` tokens and applies distinct decorations.

**Known/allowed variable:** green underline (`text-green-600 underline`).
**Unknown/mangled variable:** red underline with warning glyph.

```typescript
// variableHighlightExtension.ts
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'

const VARIABLE_REGEX = /\{([^}]+)\}/g

const knownDecoration = Decoration.mark({ class: 'cm-var-known' })
const unknownDecoration = Decoration.mark({ class: 'cm-var-unknown' })

export function variableHighlighter(allowedVars: string[]) {
  const allowed = new Set(allowedVars)
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state.doc.toString(), allowed)
    },
    update(decos, tr) {
      if (!tr.docChanged) return decos
      return buildDecorations(tr.newDoc.toString(), allowed)
    },
    provide: f => EditorView.decorations.from(f),
  })
}

function buildDecorations(text: string, allowed: Set<string>): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  let m: RegExpExecArray | null
  VARIABLE_REGEX.lastIndex = 0
  while ((m = VARIABLE_REGEX.exec(text)) !== null) {
    const varName = m[1].trim()
    const deco = allowed.has(varName) ? knownDecoration : unknownDecoration
    builder.add(m.index, m.index + m[0].length, deco)
  }
  return builder.finish()
}
```

```css
/* Inject via EditorView.baseTheme or globals.css scoped to CodeMirror wrapper */
.cm-var-known  { color: #166534; text-decoration: underline; }
.cm-var-unknown { color: #991b1b; text-decoration: underline wavy; }
```

**Pre-save validation:** scan the editor buffer with the same regex; collect `{token}` names that are NOT in `allowedVars`; if any exist, show an inline warning panel before allowing save. This is distinct from the visual decoration — it's a save-blocking gate.

### Pattern 3: Convex Versioning Mutations

**Key constraint (from schema):** `prompt_versions` has only a `by_workspace_agentKey` index. There is no `by_workspace_agentKey_version` compound index. Phase 24 must add one or use `.filter()` for version queries. Adding the index is the correct path (filter scans all rows).

**Recommended new Convex mutations:**

```typescript
// convex/promptVersions.ts additions

// saveVersion: increment version, never overwrite
export const saveVersion = mutation({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
    content: v.string(),
    createdBy: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, agentKey, content, createdBy, note }) => {
    // Get current max version for this agentKey
    const existing = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey)
      )
      .collect()
    const maxVersion = existing.length > 0
      ? Math.max(...existing.map(r => r.version))
      : 0
    // Emit audit log via internal call
    await ctx.runMutation(internal.auditLog.write, {
      workspace_id,
      actorId: createdBy ?? 'unknown',
      action: 'prompt_version.saved',
      resourceType: 'prompt_version',
      resourceId: `${agentKey}:${maxVersion + 1}`,
      after: JSON.stringify({ agentKey, version: maxVersion + 1 }),
    })
    return await ctx.db.insert('prompt_versions', {
      workspace_id, agentKey,
      version: maxVersion + 1,
      content,
      isActive: false,   // new version is NOT auto-activated
      createdAt: Date.now(),
      createdBy,
      note,
    })
  },
})

// activate: flip isActive, with in-progress-run guard reading runs table
export const activate = mutation({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
    version: v.number(),
    actorId: v.string(),
  },
  handler: async (ctx, { workspace_id, agentKey, version, actorId }) => {
    // In-progress guard (D-02): check runs table status
    const activeRuns = await ctx.db
      .query('runs')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .filter(q => q.eq(q.field('status'), 'running'))
      .first()
    if (activeRuns) {
      return { blocked: true, reason: 'A run is in progress — activation will be available when it finishes.' }
    }
    // Deactivate all versions for this agentKey
    const all = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey)
      )
      .collect()
    for (const row of all) {
      if (row.isActive) await ctx.db.patch(row._id, { isActive: false })
    }
    // Activate the requested version
    const target = all.find(r => r.version === version)
    if (!target) throw new Error(`Version ${version} not found for ${agentKey}`)
    await ctx.db.patch(target._id, { isActive: true })
    // Audit log
    await ctx.runMutation(internal.auditLog.write, {
      workspace_id,
      actorId,
      action: 'prompt_version.activated',
      resourceType: 'prompt_version',
      resourceId: `${agentKey}:${version}`,
      before: JSON.stringify({ agentKey, previousActive: all.find(r => r.isActive)?.version }),
      after: JSON.stringify({ agentKey, version }),
    })
    return { blocked: false }
  },
})

// listForAgent: all versions, newest-first
export const listForAgent = query({
  args: { workspace_id: v.string(), agentKey: v.string() },
  handler: async (ctx, { workspace_id, agentKey }) => {
    const rows = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey)
      )
      .collect()
    return rows.sort((a, b) => b.version - a.version)
  },
})

// getByVersion: fetch one specific version
export const getByVersion = query({
  args: { workspace_id: v.string(), agentKey: v.string(), version: v.number() },
  handler: async (ctx, { workspace_id, agentKey, version }) => {
    const rows = await ctx.db
      .query('prompt_versions')
      .withIndex('by_workspace_agentKey', q =>
        q.eq('workspace_id', workspace_id).eq('agentKey', agentKey)
      )
      .filter(q => q.eq(q.field('version'), version))
      .first()
    return rows ?? null
  },
})
```

**Rollback == activate(olderVersion).** No separate mutation needed. The `activate` mutation is idempotent and works for any version number, current or historical.

**Schema addition needed:** Add `by_workspace_agentKey_version` compound index to `prompt_versions` table to support efficient `getByVersion` queries:

```typescript
// convex/schema.ts — add to prompt_versions defineTable:
.index('by_workspace_agentKey_version', ['workspace_id', 'agentKey', 'version'])
```

### Pattern 4: Side-by-Side Diff Renderer

**Library:** `diff` (v9.0.0) — `diffLines()` returns a `Change[]` array with `value`, `added`, `removed` flags.

**Approach:** Build a custom two-column React component. No `react-diff-view` (requires patching; adds 60 KB; over-engineered for prompt-sized diffs).

```typescript
import { diffLines, Change } from 'diff'

interface DiffViewerProps {
  left: { label: string; content: string }
  right: { label: string; content: string }
}

export function DiffViewer({ left, right }: DiffViewerProps) {
  const changes: Change[] = diffLines(left.content, right.content)

  // Build parallel column arrays: left shows removed+context, right shows added+context
  const leftLines: Array<{ text: string; type: 'removed' | 'context' | 'empty' }> = []
  const rightLines: Array<{ text: string; type: 'added' | 'context' | 'empty' }> = []

  for (const change of changes) {
    const lines = change.value.split('\n').filter((_, i, a) => i < a.length - 1 || change.value.endsWith('\n') || i < a.length - 1)
    if (change.removed) {
      lines.forEach(l => { leftLines.push({ text: l, type: 'removed' }); rightLines.push({ text: '', type: 'empty' }) })
    } else if (change.added) {
      lines.forEach(l => { leftLines.push({ text: '', type: 'empty' }); rightLines.push({ text: l, type: 'added' }) })
    } else {
      lines.forEach(l => { leftLines.push({ text: l, type: 'context' }); rightLines.push({ text: l, type: 'context' }) })
    }
  }

  return (
    <div className="grid grid-cols-2 divide-x border font-mono text-xs overflow-auto">
      <DiffColumn label={left.label} lines={leftLines} side="left" />
      <DiffColumn label={right.label} lines={rightLines} side="right" />
    </div>
  )
}
```

### Pattern 5: Single-Agent Test-Run Isolation

**Architecture decision:** Do NOT invoke `graph.ainvoke()`. The isolation seam is a direct call to the agent function with a minimal synthetic `DispatchState`.

**Key insight from code reading:** Every agent function has the signature `async def agent_name(state: DispatchState) -> DispatchState` decorated with `@agent_node`. The decorator adds Convex emission, error handling, and `agent_runs` updates — all of which are UNDESIRABLE for a test run (they would pollute real run tables).

**Correct pattern:** Call the **underlying function body directly**, bypassing the `@agent_node` decorator. The decorator wraps the original function but the original is accessible as `agent_name.__wrapped__` (Python `functools.wraps` convention) — or by calling the build function directly.

However, inspection of `_wrapper.py` is needed to confirm `__wrapped__`. The safer approach is to extract the pure helper functions:

- For system-prompt agents: call `_build_messages(state, ...)` directly and then `acomplete(...)` with a flag to suppress Convex writes.
- **Recommended pattern:** Add a `dry_run=True` flag to `acomplete` that skips cost recording to `agent_run_payloads` but still returns the response and usage. Alternatively, pass a `run_id="test-run-XXXX"` that the wrapper recognizes as a test and skips Convex emissions.

**Best isolation approach (confirmed by code):** The pipeline already uses `acomplete` from `lib/openrouter_client`. The test-run endpoint can:

1. Accept the draft prompt text in the request body (PRM-03 unsaved draft, D-03).
2. Build the `state` dict from the request body's variable values.
3. Call `acomplete(agent_id=key, run_id=f"test-{uuid}", messages=messages, response_format=...)` directly (no `graph.ainvoke`, no `@agent_node`).
4. Cost is captured by `acomplete`'s existing OpenRouter token/USD path and returned in the response.
5. The `run_id` pattern `"test-XXXX"` ensures `agent_runs` rows and `agent_run_payloads` writes either don't occur (if the wrapper checks) or are written under a transient run ID and are inconsequential.

**Safest approach:** Add a `test_run=True` kwarg to `acomplete` that skips `convex_mutation_safe` calls for `agent_runs` updates but still returns `(response, usage)` including cost. This matches CONTEXT PITFALLS: "no second cost recorder — test-run reads the existing capture path."

**Test-run endpoint shape:**

```python
# packages/pipeline/src/eisenbalm_pipeline/api/agents.py
router = APIRouter(prefix="/agents")

class TestRunRequest(BaseModel):
    workspace_id: str
    draft_prompt: str          # The unsaved system prompt text (D-03)
    variables: dict[str, str]  # Template variable values (manual or from fixture)
    prior_run_id: Optional[str] = None  # If set, load from agent_run_payloads

class TestRunResponse(BaseModel):
    output: str                # Raw LLM output text or JSON
    cost_usd: float
    tokens_in: int
    tokens_out: int
    model: str
    duration_ms: int

@router.post("/{agent_key}/test-run")
async def test_run_agent(
    agent_key: str,
    body: TestRunRequest,
    _: None = Depends(require_clerk_jwt),
) -> TestRunResponse:
    ...
```

**Input sourcing mode 1 (prior-real input):** Query `agent_run_payloads` via Convex for the given `run_id` + `agentKey`, extract `inputSnapshot`, deserialize, use as variable values.

**Input sourcing mode 4 (canned fixture):** Keep a `SAMPLE_FIXTURES: dict[str, dict]` constant in `api/agents.py` — one per agentKey, populated from a representative real output.

### Pattern 6: VOICE_CONSTRAINTS Versioning Without Breaking Sentinels

This is the most subtle constraint in the phase.

**Current structure (from `lib/voice.py` source read):**

```python
VOICE_CONSTRAINTS = JESSE_PERSONA_BLOCK + "\n" + UNIVERSAL_CORE

# Import-time sentinel:
assert VOICE_CONSTRAINTS == _PHASE_14_VOICE_CONSTRAINTS_BASELINE
```

**The sentinel fires at IMPORT time.** It cannot be patched from a DB value. It verifies the *code constant* matches the Phase 14 baseline.

**Resolution:** Keep the sentinel exactly as-is. The sentinel guards the code constant; the DB value is a *separate runtime value* that `assemble_voice` consults when building the voice string for a run.

**Pattern:**

1. Add `agentKey = "voice_constraints"` as a special entry in `prompt_versions`. Store the full assembled `VOICE_CONSTRAINTS` string (not just `JESSE_PERSONA_BLOCK`) as the initial v1 content — byte-verified against `VOICE_CONSTRAINTS`.

2. Add a `load_voice_from_db(workspace_id, http) -> Optional[str]` function in `lib/voice.py` (or `config_loader.py`) that fetches the active `voice_constraints` row at run-start.

3. Modify `assemble_voice` to accept an optional `db_override: Optional[str]` parameter. When provided, use it directly instead of composing from `JESSE_PERSONA_BLOCK + UNIVERSAL_CORE`. When None, use the existing composition (sentinel-guarded code constants).

4. In `calibrator.py`, change:
   ```python
   voice_for_brief = assemble_voice(resolved_narrator)
   ```
   to:
   ```python
   db_voice = state["config"].voice_constraints if state.get("config") else None
   voice_for_brief = assemble_voice(resolved_narrator, db_voice_override=db_voice)
   ```

5. The import-time sentinel in `voice.py` continues to protect `VOICE_CONSTRAINTS` (the code constant). The tests `test_voice.py` (`assemble_voice(None) == VOICE_CONSTRAINTS`) remain green because `assemble_voice(None)` without a `db_override` still uses the sentinel-protected constant.

6. The operator edits the voice via the same editor UI and saves a new version. On the next run, `config_loader.py` reads the active DB row for `voice_constraints` and threads it into `state["config"]`.

**The `test_voice.py` invariants stay green** because they call `assemble_voice(None)` without a `db_override`. With `db_override=None`, `assemble_voice` produces `VOICE_CONSTRAINTS` byte-for-byte.

**RunConfig extension needed:**
```python
@dataclass
class RunConfig:
    workspace_id: str
    agents: dict[str, AgentConfig]
    require_review: bool
    auto_publish: bool
    schedule_enabled: bool
    voice_constraints: Optional[str] = None  # None → use code-constant VOICE_CONSTRAINTS
```

### Pattern 7: Byte-Verified v1 Migration for New Assets

**Same pattern as Phase 22.** For each newly-externalized asset:

1. Write the asset text to a `.md` file in `src/eisenbalm_pipeline/prompts/` (or for SECTION_GUIDANCE, a new `prompts/section_guidance/` subdirectory).
2. Add a migration seed script that calls `upsertActive` with the text extracted from the Python constant.
3. Add a byte-verification assertion in the seed script: `assert seed_content == PYTHON_CONSTANT`.
4. Switch the call site to read from `state["config"]` with the existing disk fallback.

**`founder_bio` / `case_study` complication:** These agents have TWO guidance strings (`GUIDANCE_VERIFIED`, `GUIDANCE_ANONYMOUS`) that branch at runtime on `founderNameVerified`. These cannot be collapsed to a single `prompt_versions` row in the simple way. Options:

- **Option A (recommended):** Two agentKeys: `founder_bio_verified` and `founder_bio_anonymous` (same for `case_study`). Both seeded as v1 rows. Call site reads both; branches on `founderNameVerified`.
- **Option B:** One row with a delimiter separating the two texts. Fragile — operators could corrupt the delimiter.

**Recommendation: Option A.** Adds 4 more agentKey rows but is clean and auditable.

### Pattern 8: Variable Registry (D-05)

**Where it lives:** A TypeScript `const` in `apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts`. This is a code constant, not a Convex row — variable names are derived from call-site source inspection at build time, not dynamically.

**Complete variable map (enumerated from source):**

| agentKey | Template variables (in `str.replace` calls) |
|----------|---------------------------------------------|
| `calibrator` | `{VOICE_CONSTRAINTS}`, `{issue_number}`, `{previous_bonus_types}`, `{chosen_bonus_type}` |
| `scout` | `{featured_keys}` |
| `editor_gate1` | `{VOICE_CONSTRAINTS}`, `{EDITOR_INTERRUPT_THRESHOLD}`, `{EDITOR_CONFIDENCE_THRESHOLD}` |
| `editor_final` | `{VOICE_CONSTRAINTS}` |
| `researcher` | `{VOICE_CONSTRAINTS}` |
| `game` | `{charity_name}`, `{VOICE_CONSTRAINTS}`, `{FORBIDDEN_CONSTRUCTS}` |
| `design` | `{display_list}`, `{body_list}` |
| `bonus_big_budget` | `{VOICE_CONSTRAINTS}`, `{STRUCTURE_CONTRACT}` |
| `bonus_jingle` | `{VOICE_CONSTRAINTS}`, `{STRUCTURE_CONTRACT}` |
| `bonus_spec_ad` | `{VOICE_CONSTRAINTS}`, `{STRUCTURE_CONTRACT}` |
| `advocate` | (none confirmed from source — verify `agents/advocate.py`) |
| `origin_story` | (uses `build_section_writer_prompt()` — no raw replacements) |
| `problem` | (same) |
| `founder_bio_verified` / `_anonymous` | (same — STRUCTURE_CONTRACT appended in Python) |
| `case_study_verified` / `_anonymous` | (same) |

**For section-guidance assets** (`origin_story`, `problem`, `founder_bio_*`, `case_study_*`): these are passed as the `section_guidance` parameter to `build_section_writer_prompt`, not substituted via `.replace()`. They have no `{token}` variables — the guidance is plain prose. The variable registry for these agentKeys is empty.

**For `rubric.md`:** Plain text, no `{token}` variables. The registry is empty.

**For `voice_constraints`:** The content is plain text (no `{token}` substitution is done ON the voice text itself). The registry is empty.

**Agentkeys that need the variable registry verified against source:**

| agentKey | Verification needed |
|----------|---------------------|
| `advocate` | Read `agents/advocate.py` and grep for `.replace(` |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text diffing | Myers diff algorithm | `diff` npm package | Edge cases in line/word boundary handling; `diffLines` handles EOF newlines correctly |
| CodeMirror syntax highlight | Manual regex post-processing on rendered HTML | `StateField` + `Decoration` (CM6 native) | Post-processing breaks with CodeMirror's virtual rendering; must use CM6 extension API |
| SSR-safe dynamic import | Custom lazy-loading wrapper | `next/dynamic({ ssr: false })` | App Router needs this pattern for any browser-only library |
| Convex in-progress guard | Polling pipelineRuns from the frontend | Server-side check inside `activate` mutation | Mutation-level check is atomic; frontend polling has a TOCTOU race |

---

## Runtime State Inventory

No rename/refactor pattern — this phase is additive. Existing `prompt_versions` rows for the 11 already-migrated system prompts must NOT be modified by this phase (they are already v1 active rows). All new rows are additive inserts.

**Stored data to be created by this phase:**
- New `prompt_versions` rows for: user-prompt templates (per agent that has them), SECTION_GUIDANCE variants (4-8 rows), `qa/rubric.md` (1 row), `voice_constraints` (1 row)
- New Convex schema index: `by_workspace_agentKey_version`

**Nothing requires data migration of existing rows.**

---

## Common Pitfalls

### Pitfall 1: CodeMirror Extension Closure Stale Reference

**What goes wrong:** The `variableHighlighter(allowedVariables)` is called once when the React component mounts. If `allowedVariables` changes (e.g., user switches agent), the closure captures the old set.

**How to avoid:** Recreate the extension array on `allowedVariables` change using `useMemo`. Pass `extensions={useMemo(() => [markdown(), variableHighlighter(allowedVariables)], [allowedVariables])}` to the CodeMirror component.

**Warning signs:** Variable highlighting doesn't update when switching between agents.

### Pitfall 2: Version Activation TOCTOU Race

**What goes wrong:** The in-progress check in `activate` queries `runs` with `status = 'running'`. If the run completes between the check and the patch, the activation lands on a just-completed run — harmless for correctness (run-start snapshot already happened) but the guard fires a false positive.

**How to avoid:** This is acceptable. The guard errs on the conservative side (blocks rather than allows). The brief specifies block-with-explanation (D-02); a false positive is better than a false negative.

### Pitfall 3: Byte-Equivalence Failures When Seeding New Assets

**What goes wrong:** Python constants like `SECTION_GUIDANCE` include `STRUCTURE_CONTRACT` appended at module load time. If the seed script reads the file rather than the Python constant, it misses the `STRUCTURE_CONTRACT` suffix.

**How to avoid:** The seed script MUST import the Python constant directly and use it as the source of truth. The `.md` file is then written to match the constant (disk is the secondary artifact), not the other way around.

### Pitfall 4: `test_voice.py` Sentinel Trip During `VOICE_CONSTRAINTS` Migration

**What goes wrong:** If `assemble_voice(None)` is modified to hit the DB unconditionally, and the DB returns a different string (even whitespace difference), the `test_voice.py` test `assemble_voice(None) == VOICE_CONSTRAINTS` trips.

**How to avoid:** `assemble_voice(None)` (no DB override) MUST remain byte-identical to the code constant `VOICE_CONSTRAINTS`. Only the new `assemble_voice(narrator, db_voice_override=...)` codepath hits the DB. Tests pass because they call the old API.

### Pitfall 5: Missing `advocate.py` Variable Scan

**What goes wrong:** The variable registry for `advocate` agentKey is listed as unconfirmed. If the advocate system prompt uses `{token}` substitution and the registry omits them, operators get false "unknown variable" warnings when editing.

**How to avoid:** Verify `agents/advocate.py` before building the registry. Grep for `.replace("` in that file.

### Pitfall 6: `founder_bio` / `case_study` Single-Row Temptation

**What goes wrong:** Storing `GUIDANCE_VERIFIED` and `GUIDANCE_ANONYMOUS` as one row with a delimiter. Operators can accidentally corrupt the delimiter, breaking the conditional branching.

**How to avoid:** Use two agentKeys per agent: `founder_bio_verified` + `founder_bio_anonymous`, `case_study_verified` + `case_study_anonymous`. The call site reads both from config; branch logic stays in Python.

### Pitfall 7: New `prompt_versions` Schema Index Missing

**What goes wrong:** `getByVersion` queries fall back to a full table scan filtered by `.filter()` on `version`, which is slow and will fail Convex's query timeout for large prompt history tables.

**How to avoid:** Add the `by_workspace_agentKey_version` compound index in `schema.ts` BEFORE writing the `getByVersion` query. Convex requires the index to exist at deploy time.

### Pitfall 8: Test-Run Polluting Real Convex Tables

**What goes wrong:** If the test-run endpoint invokes the `@agent_node`-decorated function, the decorator emits `deliberationEvents`, `agent_runs`, and `agent_run_payloads` rows under a synthetic `run_id`. This is not dangerous but creates garbage data in the operational tables.

**How to avoid:** Call the agent's `_build_messages` helper and `acomplete` directly, bypassing the decorator. The test-run endpoint is NOT a pipeline invocation — it is a prompt evaluation utility.

---

## Code Examples

### Verified Pattern: `upsertActive` (existing — for migration seeds)

```typescript
// Source: convex/promptVersions.ts (verified from source read)
// Use for all new asset migrations (user-templates, guidance, rubric, voice)
await convex.mutation(api.promptVersions.upsertActive, {
  workspace_id: 'eisenbalm',
  agentKey: 'voice_constraints',
  content: VOICE_CONSTRAINTS_SEED_TEXT,
  note: 'v1 seed — byte-verified against lib/voice.py VOICE_CONSTRAINTS',
})
```

### Verified Pattern: Config Loader Two-Tier Fallback

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (verified)
# Pattern to extend for new agentKeys:
AGENT_KEY_TO_PROMPT_FILE: dict[str, str] = {
    # Existing 11 entries...
    # Add new entries for Phase 24:
    "founder_bio_verified":   "section_guidance_founder_bio_verified",
    "founder_bio_anonymous":  "section_guidance_founder_bio_anonymous",
    "case_study_verified":    "section_guidance_case_study_verified",
    "case_study_anonymous":   "section_guidance_case_study_anonymous",
    "rubric":                 "qa_rubric",
    "voice_constraints":      "voice_constraints",
    # Plus user-template agentKeys (e.g., "scout_user", "calibrator_user") if user templates are separate rows
}
```

### Verified Pattern: AuditLog Internal Mutation Call

```typescript
// Source: convex/auditLog.ts (verified from source read)
// auditLog.write is internalMutation — call via ctx.runMutation(internal.auditLog.write, ...)
// The internal reference: import { internal } from './_generated/api'
await ctx.runMutation(internal.auditLog.write, {
  workspace_id,
  actorId,
  action: 'prompt_version.activated',
  resourceType: 'prompt_version',
  resourceId: `${agentKey}:${version}`,
  before: JSON.stringify({ activeVersion: previousVersion }),
  after: JSON.stringify({ activeVersion: version }),
})
```

### Verified Pattern: In-Progress Guard via `runs` Table

```typescript
// Source: convex/schema.ts (verified — runs table has status field + by_workspace index)
const activeRun = await ctx.db
  .query('runs')
  .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
  .filter(q => q.eq(q.field('status'), 'running'))
  .first()
if (activeRun) {
  return { blocked: true, reason: 'A run is in progress — ...' }
}
```

### Verified Pattern: `diffLines` Usage

```typescript
// Source: diff v9.0.0 npm package API
import { diffLines } from 'diff'

const changes = diffLines(versionA.content, versionB.content)
// Each change: { value: string, count: number, added?: true, removed?: true }
// Lines with neither added nor removed are context lines
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monaco Editor for code/text editing in Next.js | CodeMirror 6 + `@uiw/react-codemirror` | ~2022 (CM6 stable) | 4x smaller bundle; better SSR story; CM6 extension API superior for custom decorations |
| CodeMirror 5 (`codemirror` v5) | CodeMirror 6 (`@codemirror/*`) | CM6 released 2021 | v5 is maintenance-only; v6 has functional state model, no global state |

---

## Open Questions

1. **`advocate.py` variable scan**
   - What we know: `calibrator`, `scout`, `game`, `design`, `editor_gate1/final`, `researcher`, `bonus_*` all confirmed.
   - What's unclear: `agents/advocate.py` was not read. It may have `.replace("{token}", ...)` calls.
   - Recommendation: Read `agents/advocate.py` before building the `VariableRegistry.ts` constant. Low risk — worst case the registry for advocate is empty and operators see no false warnings.

2. **User-template agentKey scheme**
   - What we know: User-prompt templates are currently hardcoded strings in `_build_messages` functions (not `.md` files). They use `str.replace("{token}", ...)` or format them inline.
   - What's unclear: Should user-template rows share the same `agentKey` as system prompts (e.g., `scout`) with a `promptType: 'system' | 'user'` discriminator, or should they use separate keys (e.g., `scout_user`)?
   - Recommendation: Separate keys (`scout_user`, `calibrator_user`, etc.) to avoid complicating the `by_workspace_agentKey` index semantics. The schema allows any string agentKey.

3. **Schema index addition process**
   - What we know: Convex schema changes require `convex dev --once` or a deploy to take effect.
   - What's unclear: Whether adding a new index to `prompt_versions` without changing existing indexes is backward-compatible with the existing queries.
   - Recommendation: It is backward-compatible. Adding an index is additive. Existing queries using `by_workspace_agentKey` are unaffected.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@uiw/react-codemirror` | PRM-01 editor | Not yet installed | 4.25.10 on npm | — |
| `diff` npm package | PRM-04 diff view | Not yet installed | 9.0.0 on npm | — |
| Node.js | apps/dispatch-control build | ✓ | via pnpm workspace | — |
| Python 3.9+ | pipeline test-run endpoint | ✓ | installed on Railway | — |

**No missing dependencies with blocking fallbacks.** All required packages are available on npm/PyPI.

---

## Validation Architecture

Nyquist validation is enabled (`nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Pipeline framework | `pytest` (uv run pytest) |
| Frontend framework | `vitest` (pnpm --filter dispatch-control test:unit or test) |
| Pipeline quick run | `cd packages/pipeline && uv run pytest -x -q -k "test_voice or test_prompt_version"` |
| Pipeline full suite | `cd packages/pipeline && uv run pytest -x -q` |
| Frontend quick run | `pnpm --filter dispatch-control test:unit --run` |
| Convex test run | `pnpm --filter @eisenbalm/convex test` (if vitest configured) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRM-01 | CodeMirror editor renders in dispatch-control | smoke/render | `pnpm --filter dispatch-control test:unit -- PromptEditor` | ❌ Wave 0 |
| PRM-02 | Variable highlight: known vars green, unknown red; unknown → save warning | unit | `pnpm --filter dispatch-control test:unit -- VariableRegistry` | ❌ Wave 0 |
| PRM-03 | `saveVersion` creates new row, increments version, never overwrites | Convex unit | `pnpm --filter @eisenbalm/convex test -- saveVersion` | ❌ Wave 0 |
| PRM-04 | `activate` returns `{ blocked: true }` when `runs` has status='running' | Convex unit | `pnpm --filter @eisenbalm/convex test -- activate_blocked` | ❌ Wave 0 |
| PRM-04 | Side-by-side diff renders removed/added/context lines correctly | unit | `pnpm --filter dispatch-control test:unit -- DiffViewer` | ❌ Wave 0 |
| PRM-05 | Test-run endpoint returns output + cost; does NOT write to `agent_runs` | integration | `uv run pytest packages/pipeline/tests/test_test_run.py -x` | ❌ Wave 0 |
| PRM-06 | `assemble_voice(None)` == `VOICE_CONSTRAINTS` (byte sentinel, no DB) | unit | `uv run pytest packages/pipeline/tests/test_voice.py` | ✅ exists |
| PRM-06 | `assemble_voice(None, db_voice_override=VOICE_CONSTRAINTS)` == `VOICE_CONSTRAINTS` | unit | `uv run pytest packages/pipeline/tests/test_voice.py::test_db_override_passthrough` | ❌ Wave 0 |
| Migration | v1 seed content byte-identical to Python constant for each new asset | unit | `uv run pytest packages/pipeline/tests/test_prompt_version_seeds.py` | ❌ Wave 0 |
| Regression | All Phase 16 voice tests stay green | regression | `uv run pytest packages/pipeline/tests/test_voice.py packages/pipeline/tests/test_section_writer_voice_propagation.py` | ✅ exists |

### Byte-Equivalence Oracles

For every newly-migrated asset, the seed test asserts:

```python
# test_prompt_version_seeds.py
from eisenbalm_pipeline.agents.origin_story import SECTION_GUIDANCE as ORIGIN_GUIDANCE
from eisenbalm_pipeline.agents.problem import SECTION_GUIDANCE as PROBLEM_GUIDANCE
from eisenbalm_pipeline.agents.founder_bio import GUIDANCE_VERIFIED, GUIDANCE_ANONYMOUS as FOUNDER_ANON
from eisenbalm_pipeline.agents.case_study import GUIDANCE_VERIFIED as CS_VERIFIED, GUIDANCE_ANONYMOUS as CS_ANON
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS
from eisenbalm_pipeline.lib.prompts import load_prompt

def test_section_guidance_seed_byte_equivalence():
    """Each SECTION_GUIDANCE Python constant must match its seeded prompt_versions content."""
    # Loaded from the .md seed file using the same load_prompt() oracle
    assert load_prompt("section_guidance_origin") == ORIGIN_GUIDANCE
    assert load_prompt("section_guidance_problem") == PROBLEM_GUIDANCE
    assert load_prompt("section_guidance_founder_bio_verified") == GUIDANCE_VERIFIED
    assert load_prompt("section_guidance_founder_bio_anonymous") == FOUNDER_ANON
    # etc.

def test_voice_constraints_seed_byte_equivalence():
    assert load_prompt("voice_constraints") == VOICE_CONSTRAINTS
```

### Sampling Rate

- **Per task commit:** `uv run pytest packages/pipeline/tests/test_voice.py -x -q`
- **Per wave merge:** `cd packages/pipeline && uv run pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps (test files to create before implementation)

- [ ] `packages/pipeline/tests/test_prompt_version_seeds.py` — byte-equivalence oracles for all v1 seed assets (REQ: PRM-01, PRM-06, Migration)
- [ ] `packages/pipeline/tests/test_test_run.py` — test-run endpoint isolation + cost return + no agent_runs pollution (REQ: PRM-05)
- [ ] `packages/pipeline/tests/test_voice_db_override.py` — `assemble_voice` db_override codepath (REQ: PRM-06)
- [ ] `apps/dispatch-control/__tests__/PromptEditor.test.tsx` — CodeMirror render smoke test (REQ: PRM-01)
- [ ] `apps/dispatch-control/__tests__/VariableRegistry.test.ts` — variable map completeness + highlight logic (REQ: PRM-02)
- [ ] `apps/dispatch-control/__tests__/DiffViewer.test.tsx` — side-by-side diff column logic (REQ: PRM-04)
- [ ] Convex mutation tests for `saveVersion`, `activate` (blocked guard + success), `listForAgent`, `getByVersion` (REQ: PRM-03, PRM-04)

---

## Sources

### Primary (HIGH confidence)

- `convex/schema.ts` — `prompt_versions` table shape, indexes, `runs` table for in-progress guard
- `convex/promptVersions.ts` — `upsertActive`/`getActive` existing patterns
- `convex/auditLog.ts` — `internalMutation write` API for audit emissions
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — `VOICE_CONSTRAINTS`, `JESSE_PERSONA_BLOCK`, `UNIVERSAL_CORE`, import-time sentinels, `assemble_voice` signature
- `packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py` — `load_prompt()` / `_extract()` byte-verification oracle
- `packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py` — `RunConfig`, `AgentConfig`, `AGENT_KEY_TO_PROMPT_FILE`, two-tier fallback pattern
- `packages/pipeline/src/eisenbalm_pipeline/agents/*.py` — all variable substitution call sites (game, scout, calibrator, editor, researcher, design, bonus, origin_story, problem, founder_bio, case_study)
- `packages/pipeline/tests/test_voice.py` — byte-equivalence invariants that must stay green
- npm registry — `@uiw/react-codemirror` 4.25.10, `diff` 9.0.0, `@codemirror/state` 6.6.0, `@codemirror/view` 6.43.1 (verified 2026-06-22)

### Secondary (MEDIUM confidence)

- `@uiw/react-codemirror` README + source (GitHub) — `extensions` prop API, SSR handling (`dynamic({ ssr: false })` is the documented pattern)
- CodeMirror 6 guide — `StateField.define`, `Decoration.mark`, `RangeSetBuilder` API (stable since CM6 6.0)
- `diff` npm package — `diffLines` return shape (`Change[]` with `added?`/`removed?` flags)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — npm versions verified against registry; CodeMirror 6 + `@uiw/react-codemirror` is the established choice for this use case in Next.js
- Architecture patterns: HIGH — derived directly from reading the actual source files; no assumptions
- Convex mutations: HIGH — schema and existing mutation shape read from source; Convex API patterns verified from existing `auditLog.ts` and `promptVersions.ts`
- VOICE_CONSTRAINTS migration: HIGH — sentinel mechanism read from source; proposed `db_voice_override` parameter preserves the invariant by construction
- Test-run isolation: MEDIUM — `_build_messages` + `acomplete` direct call pattern is inferred from code structure; `_wrapper.py` was not read to confirm `__wrapped__` availability. The safest approach (call `_build_messages` + `acomplete` directly) does not depend on decorator internals
- Variable registry: MEDIUM — 9 of 10 agent keys confirmed from source; `advocate.py` not read

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable stack; only risk is npm package minor bumps which are non-breaking)
