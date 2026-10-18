---
phase: 55-public-site-redesign
plan: 13
type: execute
wave: 5
depends_on: [55-12, 55-04, 55-05]
files_modified:
  - .planning/phases/55-public-site-redesign/55-VALIDATION.md
autonomous: false
requirements: [P55-SC1, P55-SC2, P55-SC3, P55-SC4, P55-SC5, P55-SC6, PUB-09, PUB-13, PUB-14, PUB-16]

must_haves:
  truths:
    - "Strict `pnpm --filter web build` passes on a networked machine, with full test suite and typecheck green"
    - "The live checkout charges exactly $21.00 per balm, so 'Full $21.00 / 100% to them' is true and the balms math is right"
    - "Studio shows the new fields, the pipeline on Railway writes editorConfidence, and the public site is deployed"
    - "At 375px and desktop, / and /issue/<slug> match the mockup's structure with no horizontal scroll; keyboard and axe pass with zero serious issues"
    - "A live issue reads entirely in Jesse's voice with no mockup placeholder copy; a test-mode purchase increments the balms count; a newsletter signup is recorded"
  artifacts:
    - path: ".planning/phases/55-public-site-redesign/55-VALIDATION.md"
      provides: "Per-task map statuses + sign-off (nyquist_compliant: true)"
  key_links:
    - from: "Stripe STRIPE_PRICE_ID"
      to: "BALM_PRICE_CENTS = 2100"
      via: "unit_amount check"
      pattern: "unit_amount"
---

<objective>
Close the phase: run every automated gate, prove the Stripe price matches the approved $21.00 wording, get the four deploys done (Studio schema, Railway pipeline, Convex already synced in Plan 04, Vercel web), and have the user verify the live pages against the six success criteria.

Purpose: SC-1..SC-6 end-to-end evidence; the deploy steps are human/deploy checkpoints by project rule.
Output: verification evidence in SUMMARY, VALIDATION.md signed off.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/55-public-site-redesign/55-VALIDATION.md
@.planning/phases/55-public-site-redesign/55-UI-SPEC.md
@.planning/phases/55-public-site-redesign/MOCKUP-Main.dc.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Automated gates + Stripe price check + validation map</name>
  <files>.planning/phases/55-public-site-redesign/55-VALIDATION.md</files>
  <read_first>
    - .planning/phases/55-public-site-redesign/55-VALIDATION.md
    - all 55-*-SUMMARY.md files in the phase directory (kept-file notes, build logs, convex run output)
    - apps/web/.env.example (name of STRIPE_PRICE_ID / STRIPE_SECRET_KEY vars)
  </read_first>
  <action>
    1. Run and record outputs: `pnpm --filter web test`, `pnpm --filter web typecheck`, `pnpm --filter @eisenbalm/convex typecheck`, `cd packages/pipeline && uv run pytest tests -k sanity -q`, `pnpm --filter web build` (Plan 11 network-flake rule; a code/type error is a failure to fix before continuing).
    2. Grep gates (record results): `git diff --quiet <phase-start-commit> -- apps/web/lib/theme.ts apps/web/lib/game-validator.ts` (find phase start with `git log --oneline -- .planning/phases/55-public-site-redesign | tail -1`); `grep -c 'sandbox="allow-scripts"' apps/web/components/issue/GameSlot.tsx` == 1; `grep -rc "allow-same-origin" apps/web/components` == 0; `grep -rniE "Monday|\\[LIVE COUNT\\]|panel of AIs|goes here" apps/web/components/dispatch apps/web/lib/dispatch` empty.
    3. Stripe price check without printing secrets: load apps/web/.env.local in a subshell and run `curl -s https://api.stripe.com/v1/prices/$STRIPE_PRICE_ID -u "$STRIPE_SECRET_KEY:" | node -e "const p=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(JSON.stringify({unit_amount:p.unit_amount,currency:p.currency,livemode:p.livemode}))"`. Expected `unit_amount: 2100, currency: 'usd'`. If the env file or vars are absent, or the amount differs (memory notes a $21 test price), record it and raise it in the Task 2 checkpoint as a blocker for SC-5 — do not change the price yourself.
    4. Update 55-VALIDATION.md: fill the per-task map statuses (✅/❌) with the commands that actually ran, set `nyquist_compliant: true` and `wave_0_complete: true` only if every automated row is green.
  </action>
  <verify>
    <automated>pnpm --filter web test && pnpm --filter web typecheck && grep -c 'sandbox="allow-scripts"' apps/web/components/issue/GameSlot.tsx</automated>
  </verify>
  <acceptance_criteria>
    - web suite, web typecheck, convex typecheck and the pipeline pytest selection exit 0
    - Build exits 0, or the recorded log shows type-check passed before a network-only prerender failure
    - Stripe check output (unit_amount/currency/livemode only) recorded in SUMMARY
    - 55-VALIDATION.md per-task map has no ⬜ pending rows for automated checks
  </acceptance_criteria>
  <done>All automated evidence collected; price discrepancy (if any) surfaced.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Deploy Studio schema, Railway pipeline and the web app</name>
  <files>none (deployments only)</files>
  <read_first>
    - .planning/phases/55-public-site-redesign/55-13-SUMMARY.md draft from Task 1 (Stripe price output, build log)
    - apps/studio/EDITOR_GUIDE.md "Front Page (Phase 55)" section (what Andrew fills in step 5)
  </read_first>
  <action>Claude cannot deploy without the user's go-ahead and credentials; present the steps below and wait.</action>
  <instructions>
    Automated work is complete (Task 1). Convex functions were synced in Plan 04. Please:
    1. Confirm the Stripe price: Task 1 printed `unit_amount` for STRIPE_PRICE_ID. It must be 2100 (usd) in the mode that ships. If not, fix the price/ID in Stripe + Vercel env before continuing.
    2. Deploy Sanity Studio so Andrew sees Front Page + Editor's Confidence: `pnpm --filter studio deploy` (or your usual Studio deploy).
    3. Deploy the pipeline to Railway (sanity_client.py now writes editorConfidence) — push/redeploy the pipeline service as you normally do.
    4. Confirm Vercel env has `STRIPE_TO_CONVEX_SECRET` and `NEXT_PUBLIC_CONVEX_URL` for the web project, then deploy apps/web (push to master or `vercel --prod`).
    5. Optional but needed for a full SC-2 read-through: Andrew fills Front Page fields (dek, pull quotes, timeline, ad summary, impact unit, photo + alt) on the current live issue in Studio and publishes.
  </instructions>
  <verify>User confirms each deploy URL / status</verify>
  <resume-signal>Type "deployed" with the Vercel URL, or describe what failed</resume-signal>
  <acceptance_criteria>
    - User reports Studio, Railway and Vercel deployed (or which step is deferred and why)
    - Stripe unit_amount confirmed as 2100
  </acceptance_criteria>
  <done>All four surfaces deployed (or deferrals recorded) and price confirmed.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Live verification against the six success criteria</name>
  <files>none (verification only)</files>
  <read_first>
    - .planning/phases/55-public-site-redesign/MOCKUP-Main.dc.html (layout reference)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §Accessibility and §Responsive contract
  </read_first>
  <action>Present the numbered verification steps below to the user and wait; record each result (pass/fail + note) in 55-13-SUMMARY.md.</action>
  <verify>User response per step; console check `document.documentElement.scrollWidth <= innerWidth` returns true at 375px</verify>
  <what-built>The public Dispatch front page at / and /issue/[slug] (and dispatch-control preview), with live balms count, summary-card deliberation, working Fund and newsletter paths.</what-built>
  <how-to-verify>
    Using the deployed URL from Task 2:
    1. SC-1: Open `/` and `/issue/<latest-slug>` at 1440px and at 375px (Chrome DevTools device mode). Compare with `.planning/phases/55-public-site-redesign/MOCKUP-Main.dc.html`: top bar, masthead, ticker, accent hero, How strip, sticky nav, sections 01–08 in their colours, black buy band, back-issues cards, footer. In the console run `document.documentElement.scrollWidth <= innerWidth` — must be `true` at 375px.
    2. SC-2: Read the whole live issue. Every line should sound like Jesse (dry, precise, no exclamation marks); "Thursday" cadence; no "Monday", "[LIVE COUNT]", "panel of AIs", dog illustration or "goes here".
    3. SC-3: Section 07 shows Picked / Runner-up / Also considered cards and (if the issue has editorConfidence) a confidence bar; no chat transcript anywhere.
    4. SC-4: Click "▶ Play …" — the game loads; in DevTools the iframe has `sandbox="allow-scripts"` only.
    5. SC-5: Click "Fund them · $21.00" in the hero and sticky nav (both jump to the buy band), then the buy-band button → Stripe Checkout shows $21.00. Complete a TEST-mode purchase; return to the page and confirm "Balms sold this week" increased by 1 (or run `cd convex && npx convex run stripeOrders:balmsForCharity '{"charitySlug":"<slug>"}'`).
    6. Newsletter: submit an email in the footer → "Recorded. You are on the list."; confirm a `newsletter-optin` row in the Convex dashboard emailSubscribers table.
    7. SC-6: Tab through the page — visible 3px focus ring everywhere, skip link works, sticky nav reachable; run the axe DevTools extension → zero serious/critical issues; enable "Emulate prefers-reduced-motion: reduce" → ticker stops and wraps.
    8. Open an issue in dispatch-control's preview pane — it should render the same Dispatch layout.
  </how-to-verify>
  <resume-signal>Type "approved", or list the failing step numbers with what you saw</resume-signal>
  <acceptance_criteria>
    - User approves, or each reported failure is logged in SUMMARY for `/gsd:plan-phase 55 --gaps`
  </acceptance_criteria>
  <done>User approved all six success criteria live, or gaps are recorded for gap-closure planning.</done>
</task>

</tasks>

<verification>
All six success criteria confirmed live by the user; automated gates green; VALIDATION.md signed off.
</verification>

<success_criteria>
Phase 55 shipped: public front page live, on-brand, on-voice, accessible, with honest commerce numbers.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-13-SUMMARY.md`
</output>
