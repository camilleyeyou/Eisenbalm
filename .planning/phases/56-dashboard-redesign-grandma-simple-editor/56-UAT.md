---
phase: 56
plan: 13
status: partial
verified_by: user (human visual check, "approved")
verified_on: 2026-10-22
---

# Phase 56 UAT (plan 56-13)

Status: **partial**. The user approved the human walkthrough, but two end-to-end flows are deferred (OpenRouter key revoked) and all automated captures were not taken. The user gave no per-row notes; nothing below is an invented observation.

## Pre-flight
- Pipeline started with `DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001`; `/healthz` returned 200.
- dispatch-control dev on :3001 started.
- BLOCKER: every route except `/sign-in` is Clerk-protected (middleware). Signed-out requests to `/` return 404. No signed-in storage state is available, so no automated screenshots were captured.
- `/sign-in` returns 200 but is not one of the seven artboards.

## Artboards
| Artboard | Route | 1280 | 400 | Notes |
|---|---|---|---|---|
| Main / Home | `/` | pass (approved by user 2026-10-22; no per-row notes given) | pass (approved by user 2026-10-22; no per-row notes given) | no automated capture |
| Home (published) | `/?run=<id>` | pass (approved by user 2026-10-22; no per-row notes given) | pass (approved by user 2026-10-22; no per-row notes given) | no automated capture |
| Section | `/s/founderBio`, `/s/game` | pass (approved by user 2026-10-22; no per-row notes given) | pass (approved by user 2026-10-22; no per-row notes given) | no automated capture |
| Archive | `/archive` | pass (approved by user 2026-10-22; no per-row notes given) | pass (approved by user 2026-10-22; no per-row notes given) | no automated capture |
| Behind | `/admin` | pass (approved by user 2026-10-22; no per-row notes given) | pass (approved by user 2026-10-22; no per-row notes given) | no automated capture |
| Behind-Run | `/admin/runs/<id>` | pass (approved by user 2026-10-22; no per-row notes given) | pass (approved by user 2026-10-22; no per-row notes given) | no automated capture |

## Walkthrough replay
| Item | Expected | Result |
|---|---|---|
| Bug 1 | Past issues charity name opens that issue | pass (approved by user 2026-10-22; no per-row notes given) |
| Bug 2 | Back to the issue opens that issue | pass (approved by user 2026-10-22; no per-row notes given) |
| Bug 3 | Stop writing this issue button with confirm | pass (approved by user 2026-10-22; no per-row notes given) |
| Bug 4 | Names and dates with plain status words | pass (approved by user 2026-10-22; no per-row notes given) |
| Bug 5 | Paragraph edit persists after reload | pass (approved by user 2026-10-22; no per-row notes given) |
| Bug 6 | Real cost, not $0.00 | pass (approved by user 2026-10-22; no per-row notes given) |
| Bug 7 | Front page lists nine parts | pass (approved by user 2026-10-22; no per-row notes given) |
| Bug 8 | Paused issue reads Waiting for you, no Interrupt(...) | pass (approved by user 2026-10-22; no per-row notes given) |
| Bug 9 | Every button does something | pass (approved by user 2026-10-22; no per-row notes given) |
| Jargon | No Run/Trigger/Pipeline/Graph/Drift/Re-roll/Calibrator/Chronicler/Tokens/Agent | pass (approved by user 2026-10-22; no per-row notes given) |

## End-to-end flows
| Flow | Result |
|---|---|
| Start a new issue | deferred: OpenRouter key revoked |
| Rewrite this part | deferred: OpenRouter key revoked |

## Automated captures
| Metric | Result |
|---|---|
| Screenshots (1280 / 400) | not captured: Clerk sign-in blocked automation; human visual check substituted |
| Horizontal-scroll metric | not captured: Clerk sign-in blocked automation; human visual check substituted |
| `[data-primary]` metric | not captured: Clerk sign-in blocked automation; human visual check substituted |
| Console errors | not captured: Clerk sign-in blocked automation; human visual check substituted |

## Deferred
- Rewrite this part end-to-end and Start a new issue: blocked until OPENROUTER_API_KEY is replaced.
- Bug 10 Clerk production instance is ops, out of scope.
