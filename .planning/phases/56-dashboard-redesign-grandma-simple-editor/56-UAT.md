# Phase 56 UAT (plan 56-13)

## Pre-flight
- Pipeline started with `DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001`; `/healthz` returned 200.
- dispatch-control dev on :3001 started.
- BLOCKER: every route except `/sign-in` is Clerk-protected (middleware). Signed-out requests to `/` return 404. No signed-in storage state is available, so no screenshots were captured. Not faked.
- `/sign-in` returns 200 but is not one of the seven artboards.

## Artboards
| Artboard | Route | 1280 | 400 | Notes |
|---|---|---|---|---|
| Main / Home | `/` | pending-human | pending-human | auth blocked, no capture |
| Home (published) | `/?run=<id>` | pending-human | pending-human | auth blocked |
| Section | `/s/founderBio`, `/s/game` | pending-human | pending-human | auth blocked |
| Archive | `/archive` | pending-human | pending-human | auth blocked |
| Behind | `/admin` | pending-human | pending-human | auth blocked |
| Behind-Run | `/admin/runs/<id>` | pending-human | pending-human | auth blocked |

## Walkthrough replay
| Item | Expected | Result |
|---|---|---|
| Bug 1 | Past issues charity name opens that issue | pending-human |
| Bug 2 | Back to the issue opens that issue | pending-human |
| Bug 3 | Stop writing this issue button with confirm | pending-human |
| Bug 4 | Names and dates with plain status words | pending-human |
| Bug 5 | Paragraph edit persists after reload | pending-human |
| Bug 6 | Real cost, not $0.00 | pending-human |
| Bug 7 | Front page lists nine parts | pending-human |
| Bug 8 | Paused issue reads Waiting for you, no Interrupt(...) | pending-human |
| Bug 9 | Every button does something | pending-human |
| Jargon | No Run/Trigger/Pipeline/Graph/Drift/Re-roll/Calibrator/Chronicler/Tokens/Agent | pending-human |

## Deferred
Rewrite this part end-to-end and Start a new issue: blocked until OPENROUTER_API_KEY is replaced. Bug 10 Clerk production instance is ops, out of scope.
