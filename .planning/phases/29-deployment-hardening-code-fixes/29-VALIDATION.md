---
phase: 29
slug: deployment-hardening-code-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 29-RESEARCH.md § Validation Architecture. This is a hardening phase over existing code with strong existing suites (web vitest 440 pass, pipeline pytest ~387 pass, convex typecheck clean) — the strategy is mostly "extend existing suites + keep them green," not stand up new infra.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (web/dispatch-control/convex)** | vitest + `tsc --noEmit` (typecheck) + `next build` (strict) |
| **Framework (pipeline)** | pytest (stub mode, no network) |
| **Config file** | web: `apps/web/vitest.config.ts` (exists); pipeline: `packages/pipeline/pyproject.toml` (exists); ESLint config for apps/web is CREATED by D-10 (Wave 0-ish) |
| **Quick run command** | `pnpm --filter web test` · `cd packages/pipeline && uv run pytest -q` |
| **Full suite command** | `pnpm --filter web test && pnpm --filter web typecheck && pnpm typecheck:convex && pnpm --filter web build && pnpm --filter dispatch-control build && pnpm build:studio && (cd packages/pipeline && uv run pytest)` |
| **Estimated runtime** | web test ~5s · pipeline pytest ~20s · full (incl. builds) ~4–6 min |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (web test OR pipeline pytest OR `pnpm typecheck:convex`) for the surface touched.
- **After every plan wave:** Run the full suite command.
- **Before `/gsd:verify-work`:** Full suite green, including strict `build` for web + dispatch-control (per memory `run-strict-build-before-frontend-phase-done` — vitest does NOT type-check).
- **Max feedback latency:** ~20s (pipeline pytest, the slowest quick gate).

---

## Per-Task Verification Map

> Task IDs are placeholders until the planner emits PLAN.md files; the mapping below is by DECISION ITEM so the planner can attach the right `<automated>` verify to each task.

| Decision | Surface | Test Type | Automated Command / Assertion |
|----------|---------|-----------|-------------------------------|
| D-1 (Convex lockdown) | convex/ | unit + regression | New convex vitest: guarded dashboard mutation throws without identity; secret-guarded pipeline/webhook mutation throws on wrong/absent secret and passes with correct secret; dual-lane (`pipelineConfig.upsert`, `charities.upsertCandidate`) accepts BOTH lanes; `qaCorrections.insert` stays callable anonymously (GAM-05). `pnpm typecheck:convex` exits 0. |
| D-1 (no-regression) | pipeline + web + dc | integration/build | Pipeline pytest still green (run-status/deliberation/vote/pitch/QA writes still succeed against secret-guarded mutations — update stub/mocks to pass the secret); `pnpm --filter web build` + `pnpm --filter dispatch-control build` green. |
| D-2 (fail-closed auth) | pipeline api/auth.py, runs.py, control.py | unit | New pytest: with deployment marker (`RAILWAY_ENVIRONMENT_NAME` set) + required secret UNSET → boot/request fails closed (raises / 401), NOT the `local-dev-operator` sentinel; without marker → dev convenience preserved. |
| D-3 (constant-time compare) | pipeline runs.py | unit | pytest asserts `hmac.compare_digest` used (grep) + wrong secret rejected, correct accepted. |
| D-4 (restart reconciliation) | pipeline main.py lifespan | unit | New pytest: given Convex runs in `'running'` at startup, the lifespan sweep marks them terminal (`failed`/`cancelled`) so the one-at-a-time gate is clear; uses `runs:listForWorkspace` + existing termination mutation (no new schema). |
| D-5 (deps) | pipeline pyproject | build | `pyproject.toml` contains `pyjwt` + `requests` in `[project.dependencies]`; `uv lock` succeeds; `uv run python -c "import jwt, requests"` exits 0. |
| D-6 (env docs) | pipeline .env.example, checkpointer.py, cli.py | grep | No `pooler.supabase.com` / "Supabase session pooler" guidance remains; Railway Postgres guidance present. |
| D-7 (debug route) | apps/web | file + test | `apps/web/app/%5Fdebug/` removed; `debug-route.test.ts` updated to assert ABSENCE (or removed); `robots.txt` no longer references it; web build green. |
| D-8 (dead subs) | apps/web DeliberationSlot | file + test | 5 `api.*.byRunId` `useQuery` calls removed from `DeliberationSlot.tsx`; the 3 tripwire tests (`deliberation-subscriptions.test.ts`, `machine-editorial-components.test.ts`, `motion-polish.test.ts`) updated to the new contract; deliberation still renders from Sanity (build + existing render test green). |
| D-9 (checkout msg) | apps/web BuyButton | test | Vitest: on checkout API error an inline failure message renders + button re-enables; static import replaces runtime `require()`. |
| D-10 (ESLint) | apps/web | command | `pnpm --filter web lint` runs non-interactively and exits 0 (or with only warnings), no config prompt. |
| D-11 (test TS errors) | apps/web __tests__ | typecheck | `pnpm --filter web typecheck` exits 0 (was 17 errors across 5 files). |
| D-12 (favicon) | apps/web | file + build | `app/icon.*` or `app/favicon.ico` present; build emits it; `/favicon.ico` no longer 404s. |
| D-13 (env docs) | dispatch-control + pipeline .env.example, DEPLOY.md | grep | dispatch-control `.env.example` + `DEPLOY.md` contain `PREVIEW_SECRET` + `NEXT_PUBLIC_WEB_PREVIEW_BASE`; `NEXT_PUBLIC_PIPELINE_URL` no longer labeled "optional"; pipeline `.env.example` contains `DESIGNAGENT_SUPPRESSED` + `LOG_LEVEL`. |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] ESLint config for `apps/web` (D-10) — install/config must land before the lint gate can be asserted; run once to size the error surface, then configure so pre-existing code doesn't hard-fail.
- [ ] Convex test harness check — confirm whether `convex/` already has a vitest setup (`convex-test`); if not, D-1's unit tests need it stood up, else fall back to typecheck + integration (pipeline pytest + web build) as the D-1 regression proof.

*Otherwise: existing infrastructure (web vitest, pipeline pytest, convex typecheck, strict builds) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Favicon actually renders in a browser tab | D-12 | Visual/browser-only | Load `/` in a browser, confirm tab icon is the brand mark, `/favicon.ico` returns 200. |
| Operator dashboard flows still work end-to-end after lockdown | D-1 | Requires a live Clerk session + Convex | Sign into dispatch-control, edit+activate a prompt, record a review action — confirm no "Unauthorized" regression. (Automated coverage proves the guard; live click proves the JWT lane wiring.) |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] Every security-critical decision (D-1..D-4) has an `<automated>` verify attached to its task(s)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers ESLint config + Convex-test harness decision before dependent asserts
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 20s (quick gates)
- [ ] `nyquist_compliant: true` set once the planner attaches verifies

**Approval:** pending
