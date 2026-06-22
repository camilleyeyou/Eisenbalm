# Phase 24: Prompt Editor + Versioning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 24-prompt-editor-versioning
**Areas discussed:** Editable scope, Activation lock, Test-run, Variable source

---

## Editable scope

| Option | Description | Selected |
|--------|-------------|----------|
| User-prompt templates | Externalize + version the code-built user-prompt templates | ✓ |
| Section-writer guidance | Migrate inline SECTION_GUIDANCE (origin_story/problem/founder_bio/case_study) to versioned rows | ✓ |
| qa/rubric.md | Make the QA rubric a versioned, editable entry | ✓ |
| System + VOICE only | Minimal: system prompts + VOICE_CONSTRAINTS only, defer the rest | (conflicting — resolved below) |

**User's choice:** Initially selected all four (contradictory). Resolved via follow-up.

### Scope intent (follow-up to resolve the conflict)

| Option | Description | Selected |
|--------|-------------|----------|
| Everything (full scope) | System + user-templates + section guidance + qa/rubric.md + VOICE_CONSTRAINTS all editable+versioned this phase | ✓ |
| Everything except rubric | Defer only qa/rubric.md | |
| Minimal (System + VOICE only) | Defer user-templates, section guidance, rubric | |

**User's choice:** Everything (full scope).
**Notes:** Large phase — planner to split into multiple plans. Each newly-externalized asset
follows the Phase 22 migrate-to-v1-with-byte-verification + loader-swap-with-fallback pattern.

---

## Activation lock (activating a version while a run is in progress)

| Option | Description | Selected |
|--------|-------------|----------|
| Block with explanation | Disable Activate during a live run; show why; operator activates after | ✓ |
| Queue for next run | Accept activation, apply when current run finishes, show pending banner | |

**User's choice:** Block with explanation.
**Notes:** Phase 22 run-start snapshot already makes mid-run editing safe; blocking is the
simplest predictable guard and avoids queue state.

---

## Test-run (single-agent, prioritized)

| Option | Description | Selected |
|--------|-------------|----------|
| Pull prior-real input | Load a past run's actual agent input from agent_run_payloads | ✓ |
| Edit unsaved draft | Test-run executes the current unsaved editor draft | ✓ |
| Manual variable entry | Form to fill each template variable by hand | ✓ |
| Canned sample fixture | Built-in per-agent sample input for one-click testing | ✓ |

**User's choice:** All four (multiSelect).
**Notes:** Draft execution (not just saved versions) is the high-value iterate→test→save
loop. Cost read from the existing OpenRouter capture path; must not run the full pipeline or
mutate real runs/issues.

---

## Variable source (highlight + unknown-variable warning, PRM-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-agent registry (you decide) | Canonical agentKey → allowed variables map; where it lives is Claude's discretion | ✓ |
| Extract from prompt text | Highlight whatever {tokens} appear; can't truly validate "unknown" | |

**User's choice:** Per-agent registry.
**Notes:** Registry populated from the actual variables each agent substitutes today
(grepped from the str.replace call sites). Physical location is Claude's discretion.

## Claude's Discretion

- Convex mutation signatures; rollback likely == activate(prior version).
- Diff library (side-by-side required); CodeMirror package + highlight extension.
- Variable registry physical location.
- Test-run endpoint shape + single-agent isolation mechanism.
- Editor/version-history layout, empty states, mobile.

## Deferred Ideas

- Pending-activation queue (rejected in favor of block-with-explanation).
- Run control / review gate / Stripe / graph-as-data — Phases 25–28.
