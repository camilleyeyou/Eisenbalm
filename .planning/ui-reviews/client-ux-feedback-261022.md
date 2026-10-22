# Client UX feedback — 2026-10-22

Source: the client drove the live dashboard (https://eisenbalm-dispatch-control.vercel.app) with a browser
assistant, trying to edit an already-generated piece. Verdict: **"the UX is very poor."**
Brief, in the client's words: it should feel like **"a simple word processor that my grandma could figure out."**
The public site is jesseaeisenbalm.com.

## Bugs (mostly regressions from quick 261021-j83, fix BEFORE design work)

1. Past issues: clicking an issue title in Past issues (`/archive`) does nothing; old direct draft links now redirect to `/`.
   → There is no way to open and edit an older/finished issue.
2. Every "Review →" and "Open issue →" link (admin run pages) goes to `/`, not to the issue beside it.
3. The front page is stuck on issue 999723 (legacy run paused at Gate 1 by the pre-deploy pipeline,
   started 2026-10-21 14:28 PT). Copy says "stop it in Admin" but **there is no Stop button anywhere** in Admin.
   Only Hold issue / Start issue exist on `/`.
4. Runs list: ~20 cards all "Awaiting review", identified as "Run 70cd8ef…" with no charity name or date; many months old.
5. Run detail: the only edit is "Re-roll" (AI rewrites a whole section) — no sentence-level edit from there.
6. Cost totals show $0.00 while per-step costs sum to ~$0.55/run.
7. "Seven writing agents" heading lists six sections.
8. Paused Gate-1 step rendered as red "Failed"; the AI's reasoning dumped as a raw Python `Interrupt(...)` repr, shown twice.
9. "Restart from this step" and "Improve this agent" are styled as buttons but do nothing.
10. Sign-in shows Clerk "Development mode" — switch to production Clerk instance before others use it.

## Jargon to remove (grandma test)
Run, Trigger Run, Pipeline Graph, DAG, Drift, Re-roll, Calibrator, Chronicler, deterministic check, Tokens in/out.
Suggested swaps: "Start a new issue" (Trigger Run), "Rewrite this part" (Re-roll), "Ready for you to read" (Awaiting review),
"Waiting for you" (Failed/Awaiting review when a decision is needed).

## Design direction requested by the client
- One **"Your next step"** box at the top of every page: plain sentence + one big button.
- If a decision is needed, show it as a simple choice (cards, one-sentence reason, AI pick marked "Suggested").
  RESOLVED 2026-10-22: charity stays auto-picked for now (Gate 1 auto-proceeds); pick-cards may come later. Design should not show a charity choice.
- Front page as a **checklist** for this week's issue: Pick charity → Write → Check → Publish (✓ done, current highlighted).
- Honest status words.
- Every button works and goes where it says.
- Recognizable names: "Nov 2 issue — GRACE", not run ids.
- Archive/clear old stuck runs so the list shows only what needs you today.
- Hide machinery (costs, tokens, agent names, graph) on a "Behind the scenes" page.
- Editing like a word processor: open the issue as a page you click into and type on; small "Rewrite this part" helper per section.

## Agreed plan (2026-10-22)
1. Quick task: fix bugs 1–9 above (incl. a real Stop / clear-stuck-run path; decide 999723: stop + Start issue recommended).
2. Design phase: `ecc:frontend-design-direction` → `gsd:ui-phase` (UI-SPEC) → Claude Design mockups → **client sign-off**
   → build (`ecc:make-interfaces-feel-better`) → `ecc:browser-qa` replaying the client's walkthrough as acceptance.
3. ~~Open question~~ RESOLVED 2026-10-22: charity is auto-picked for now; revisit pick-cards later.
