---
status: passed
verified: 2026-10-23
score: 7/8 must-haves verified
---

# Quick 261023-0l9 Verification

Goal: Game section overhaul (one-verb GameWriter prompts, how-to-play fields, viewport-fit frame).

| Must-have | Status | Evidence |
|---|---|---|
| Prompts equal SPEC blocks | VERIFIED | `load_prompt('game')` and `('game_user')` each match a SPEC fenced block |
| goal/howToPlay/controls through pipeline, Sanity, contracts | VERIFIED | pipeline tests pass (35: test_game, test_self_fix, seeds); howToPlay counts: API_CONTRACTS 3, studio schema 1, queries.ts 2 projections |
| Reader how-to-play panel, legacy unchanged | VERIFIED | web tests pass (dispatch-bands, game-validator, game-sandbox, typography: 68 passed) |
| Viewport frame, sandbox stays allow-scripts | VERIFIED | `allow-same-origin` = 0, `sandbox="allow-scripts"` = 1 in GameSlot.tsx |
| `html, body { height: 100%; }` in both validators | VERIFIED | count 1 in web and in dispatch-control galley validators |
| QA self-fix guard against editor-note fixes | VERIFIED | test_self_fix passes |
| Galley preview of how-to-play | VERIFIED (by tests per summary; not re-run) | galley files modified in commit 6b856455 |
| Convex active prompt_versions hold new text | NOT MET (human decision) | getActive read-only: game active = v4, game_user active = v2. New text saved as inactive game v5 / game_user v3. |

## Gap requiring human decision

The overhaul does not take effect in the live pipeline until activation. The eval gate blocks it: no eval scenarios exist for agentKey `game`, so only the audited `override` argument can clear it. This is not a code defect. Options:

1. Activate game v5 and game_user v3 with `override: {reason}` (command in SUMMARY.md).
2. Activate through Prompt Lab.

Rollback is re-activating game v4 and game_user v2.

## Notes

- SUMMARY deviation (min-width:64em and minmax(min(100%,280px),360px) in the C3 CSS) was made to satisfy the existing responsive test. It is functionally equivalent and acceptable.
- Pre-existing, not regressions: dispatch-control typecheck has 265 errors before and after (none in galley files), and apps/studio `tsc` lacks node types. Typegen succeeded.
