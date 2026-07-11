---
phase: quick-260711-iu2
plan: 01
subsystem: pipeline
tags: [langgraph, openrouter, gamewriter, prompt-lab, convex, llm-config]

# Dependency graph
requires:
  - phase: 24-agent-runtime-config-and-prompt-console
    provides: lib/llm_config.py runtime model/sampling/token-cap tables; Convex prompt_versions/agents dashboard tables
provides:
  - GameWriter agent runtime retuned to Opus 4.8, temperature 0.4, 24k max_tokens
  - Rewritten GameWriter system prompt (game.md) as a real game-design brief (mission-enacting mechanic, game feel, visual bar, validator-trap guards, output contract)
  - Rewritten GameWriter user template (game_user.md) with mechanic-from-mission instruction
  - Convex v4 INACTIVE prompt versions for agentKey "game" and "game_user", plus updated "game" agents dashboard row (model/temperature/top_p/max_tokens), ready for Andrew to Rehearse/activate in Prompt Lab
affects: [game-agent, prompt-lab, weekly-issue-game-section]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Per-agent model/sampling/token-cap tiering in lib/llm_config.py stays the single source of truth; Convex agents row remains snapshot/display only", "Convex prompt-version saves are dashboard-only (requireOperator) — `npx convex run <mutation> --identity '{\"subject\":\"...\"}'` is a legitimate way to exercise operator-gated mutations non-interactively from the CLI on a dev deployment"]

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
    - packages/pipeline/src/eisenbalm_pipeline/prompts/game.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/game_user.md

key-decisions:
  - "GameWriter model bumped to anthropic/claude-opus-4-8 with temperature dropped to 0.4 (top_p unchanged at 1.0) and a new 24k max_tokens cap — the only agent changed; all other agents' models/sampling/caps left untouched"
  - "game.md rewritten into a full game-design brief (mission-enacting mechanic, winnable-with-meaning, game feel, visual bar, explicit validator-trap guards, output contract) while preserving {charity_name}, {VOICE_CONSTRAINTS}, {FORBIDDEN_CONSTRUCTS} tokens and PROMPT START/END markers verbatim"
  - "game_user.md given one added line instructing the model to design the mechanic from the mission before writing code; GameOutput JSON contract and {charity_name}/{mission_statement} tokens preserved"
  - "Convex write attempted via `npx convex run ... --identity '{\"subject\":\"quick-260711-iu2\"}' --typecheck disable` against dev:modest-magpie-797 — succeeded (not auth-blocked), so no manual handoff was needed; v4 prompt versions were saved INACTIVE as designed, and Andrew still performs the actual Rehearse/activate step in Prompt Lab"

patterns-established: []

requirements-completed: [QUICK-260711-iu2]

# Metrics
duration: 12min
completed: 2026-07-11
---

# Quick Task 260711-iu2: GameWriter Opus 4.8 Retune + Design Brief Summary

**Bumped the GameWriter agent to Opus 4.8 (temp 0.4, 24k token cap) and replaced its one-line prompt with a full game-design brief covering mission-enacting mechanics, game feel, a visual bar, and explicit validator-trap guards; saved the new prompt content to Convex as INACTIVE v4 versions for Andrew to review in Prompt Lab.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-11T20:46:01Z
- **Completed:** 2026-07-11T20:58:19Z
- **Tasks:** 3 (2 code tasks + 1 data-only task)
- **Files modified:** 3

## Accomplishments
- `lib/llm_config.py`: `MODEL_BY_AGENT["game"]` → `anthropic/claude-opus-4-8`, `SAMPLING_BY_AGENT["game"]["temperature"]` → `0.4` (top_p unchanged), new `MAX_TOKENS_BY_AGENT["game"] = 24_000` — no other agent touched.
- `prompts/game.md`: replaced the single-sentence prompt with a genuine game-design brief — mission-enacting-mechanic requirement, winnable-with-meaning win/lose states, a "game feel" section (immediate feedback, visible progress, difficulty ramp, smooth motion), a "no AI slop" visual bar, explicit validator-trap call-outs (`top.`, `parent.`, `fetch(`, `localStorage`, etc., all safe to mention here since this file is never scanned by the renderer), and an output contract. All three tokens (`{charity_name}`, `{VOICE_CONSTRAINTS}`, `{FORBIDDEN_CONSTRUCTS}`) and the PROMPT START/END markers preserved verbatim.
- `prompts/game_user.md`: added a one-line "design the mechanic from the mission before writing code" instruction ahead of the existing GameOutput JSON contract; `{charity_name}`/`{mission_statement}` tokens preserved.
- Convex: saved new INACTIVE prompt versions (v4) for `agentKey: "game"` and `agentKey: "game_user"` in workspace `eisenbalm`, and updated the `game` row in the `agents` dashboard table to reflect the new model/temperature/top_p/max_tokens — all via `npx convex run` against the dev deployment (`dev:modest-magpie-797`), with `--identity` supplying the operator subject the `requireOperator` guard needs.
- Full pipeline test suite: 526 passed, 36 skipped, 0 failed — no regressions.

## Task Commits

Each code-touching task was committed atomically:

1. **Task 1: Retune game runtime config (Opus 4.8, temp 0.4, 24k cap)** - `228ab4e` (feat)
2. **Task 2: Rewrite the GameWriter system + user prompts** - `194c583` (feat)
3. **Task 3: Best-effort Convex v4 prompt-version write** - no repo files changed (data-only); outcome recorded below

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` - game agent model bumped to Opus 4.8, temperature 0.4, new 24k max_tokens entry
- `packages/pipeline/src/eisenbalm_pipeline/prompts/game.md` - full game-design brief replacing the prior one-line prompt
- `packages/pipeline/src/eisenbalm_pipeline/prompts/game_user.md` - added mechanic-from-mission instruction line

## Decisions Made
- Followed the plan's locked decisions exactly for Tasks 1 and 2 (model/sampling/cap values, and the exact prompt file contents specified in the plan).
- For Task 3, attempted the Convex writes with `--typecheck disable` (read/mutation calls otherwise hit a `TypeError: fetch failed` — root cause was TypeScript typecheck-on-run against the deployment, not an auth/network issue; disabling typecheck for the ad-hoc CLI calls resolved it) and `--identity '{"subject":"quick-260711-iu2"}'` (as the plan explicitly permitted) to satisfy the `requireOperator` guard on `promptVersions:saveVersion` and `agents:upsert`. Both mutations succeeded on the first identity-bearing attempt — no auth-block was hit, so the manual-handoff path was not needed.
- Verified the plan's stated query name mismatch up front: `promptVersions:listVersions` does not exist; the real query is `promptVersions:listForAgent` (confirmed via `grep -n "^export const" convex/promptVersions.ts`) and was used for all verification reads.

## Deviations from Plan

None that changed any repo file or scope. One executor-level adaptation, not a plan deviation: Task 3's verification/write commands used `promptVersions:listForAgent` instead of the plan's placeholder `promptVersions:listVersions` (the constraints anticipated this and told the executor to adapt), and added `--typecheck disable` to work around a `TypeError: fetch failed` that occurred on the first two `npx convex run` invocations before that flag was added (this is a known convex-run quirk when the CLI attempts a TS typecheck pass tied to the local /convex directory state, not a network or auth failure — the plain read query without `--identity` also returned real data once `--typecheck disable` was added, confirming the root cause).

## Issues Encountered
- Initial `npx convex run promptVersions:listForAgent ...` and the first `saveVersion` attempt (without `--identity`) both threw `TypeError: fetch failed`. Network connectivity to the deployment was confirmed healthy (`curl` to `https://modest-magpie-797.convex.cloud` returned `200`). Adding `--typecheck disable` resolved it for reads; the `saveVersion`/`agents:upsert` mutations additionally needed `--identity '{"subject":"quick-260711-iu2"}'` to pass the `requireOperator` Clerk-identity gate (as anticipated by the plan) — both succeeded on the next attempt with both flags present.

## Convex Outcome (Task 3) — no manual handoff needed

The Convex write was **not** auth-blocked; all three writes succeeded:

- `promptVersions:saveVersion` for `agentKey: "game"` → new row `_id m57e97reef2vc6afwpvaqbk28s8aasx4`, `version: 4`, `isActive: false`, note: `"v4: Opus 4.8 game-design brief -- game feel, visual bar, validator-trap guards (quick-260711-iu2)"`
- `promptVersions:saveVersion` for `agentKey: "game_user"` → new row `_id m579kfyswn754pssg2e10z6qfd8aaa4z`, `version: 4`, `isActive: false`, note: `"v4: mechanic-from-mission instruction (quick-260711-iu2)"`
- `agents:upsert` for `agentKey: "game"` → existing row `_id kh7b775xahz3rvqnasd46h27v98998v3` patched to `model: "anthropic/claude-opus-4-8"`, `temperature: 0.4`, `top_p: 1`, `max_tokens: 24000` (`enabled: true`, `description: "game agent"` unchanged)

Verified post-write via `npx convex run promptVersions:listForAgent '{"workspace_id":"eisenbalm","agentKey":"game"}'`: v4 exists with `isActive: false`; v3 (the prior live prompt) remains `isActive: true` — exactly the intended end state. `saveVersion` never activates a version by design; Andrew still needs to open Prompt Lab, Rehearse the new v4 game/game_user pair, and activate them himself (activation is eval-gated, per §38.3 — that gate was intentionally not bypassed here).

**No "Manual follow-up for Andrew" paste-ready section is required** since the Convex write succeeded. For reference, Andrew can find the new content already staged in the Prompt Lab UI under agentKey `game` (v4) and `game_user` (v4) in workspace `eisenbalm`.

## User Setup Required

None - no external service configuration required. Andrew's only remaining action is the normal editorial one: open Prompt Lab, Rehearse the new game/game_user v4 pair, and activate if satisfied.

## Next Phase Readiness
- The pipeline's next real run will use Opus 4.8 (temp 0.4, 24k cap) for the game agent immediately — that part is live already since it reads from `lib/llm_config.py`, not Convex.
- The system/user *prompt text* the pipeline actually sends is still governed by whichever Convex `prompt_versions` row is `isActive` (falling back to the on-disk `.md` files only if Convex is unreachable) — v3 stays active until Andrew activates v4 in Prompt Lab. Until he does, the pipeline will run the new Opus 4.8 model against the *old* one-line game prompt (v3), not the new design brief. Recommend flagging this to Andrew: the model bump alone won't produce noticeably better games until v4 is activated.

---
*Phase: quick-260711-iu2*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/prompts/game.md
- FOUND: packages/pipeline/src/eisenbalm_pipeline/prompts/game_user.md
- FOUND: .planning/quick/260711-iu2-game-section-quality-opus-4-8-gamewriter/260711-iu2-SUMMARY.md
- FOUND commit: 228ab4e
- FOUND commit: 194c583
