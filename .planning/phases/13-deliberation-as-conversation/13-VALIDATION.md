---
phase: 13
slug: deliberation-as-conversation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 13-RESEARCH.md §"Validation Architecture". The planner fills the
> Per-Task Verification Map once PLAN.md tasks exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (pipeline) + Vitest (web) |
| **Config file** | `packages/pipeline/pyproject.toml` · `apps/web/vitest.config.ts` |
| **Quick run command** | `cd packages/pipeline && pytest -q` · `pnpm --filter web test:unit` |
| **Full suite command** | `cd packages/pipeline && pytest` && `pnpm --filter web test:unit` && `pnpm --filter web build` |
| **Estimated runtime** | ~60–120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (pytest for pipeline tasks, `test:unit` for web tasks)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green (pipeline pytest + web Vitest + `pnpm --filter web build`)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

*Populated by the planner once PLAN.md task IDs exist. Each task maps to a success
criterion + an automated command (pytest test id or Vitest file) or a Wave 0 dependency.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | — | — | DEL-CONV-* | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/pipeline/tests/test_chronicler.py` — Chronicler node unit tests: faithful turns (winner/scores/names trace to state), well-formed `{speaker,text}` list, fallback-on-LLM-failure leaves `editor_gate_1` transcript intact, `model_versions['chronicler']` recorded
- [ ] `apps/web/__tests__/deliberation-conversation.test.ts` — render-layer test: turns render attributed bubbles, no literal Markdown chars, no model names (complements the existing never-skipped DEL-04 tripwire which already scans `DeliberationSlot.tsx`)
- [ ] Confirm `packages/pipeline/tests/test_transcript_format` (existing) still passes — the deterministic template is now the D-18 fallback, not removed

*Existing infrastructure (pytest + Vitest + the DEL-04 / game-sandbox tripwires) covers most behaviors; the two new test files above are the gaps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Conversation "reads as a genuine, engaging multi-turn debate" (editorial quality) | Success criterion 1 | Subjective brand/voice quality — Andrew's editorial judgement | After a real pipeline run, Andrew reviews the generated conversation in Sanity Studio + the rendered issue page; confirms turn-taking reads as a real exchange in Jesse voice |
| Chat thread visually formatted inline (not buried, no literal `#`/`**`) on a live published issue | Success criterion 2 | Visual fidelity needs a browser against published Sanity content | Render a published issue at `/issue/[slug]`; confirm conversation appears at top of `#deliberation`, formatted, with per-speaker attribution |

*Automated tests cover structure, fidelity-by-source, fallback, no-model-names, and build; the above two are the human editorial/visual passes.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
