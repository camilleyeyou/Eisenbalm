# Phase 22: Config Externalization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 22-config-externalization
**Areas discussed:** Config scope & "12 files" reconciliation (the other 3 areas decided at Claude's discretion from brief/research)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Config scope & '12 files' reconciliation | What gets externalized; reconcile 11 .md vs brief's "12" | ✓ |
| llm_config.py disposition | Retire vs keep as disk fallback default set | |
| Fallback granularity (CFG-03) | All-or-nothing vs per-key on Convex failure | |
| enabled flag behavior this phase | Store-only vs actually gate execution | |

**User's choice:** Config scope & '12 files' reconciliation (only)
**Notes:** Other three delegated to Claude to lock from `docs/MISSION_CONTROL_BRIEF.md` + `.planning/research/`.

---

## Config scope & "12 files" reconciliation

### Q1 — Canonical migration set for prompt_versions v1 active rows

| Option | Description | Selected |
|--------|-------------|----------|
| 11 .md prompts only | The load_prompt corpus; reconcile brief's "12" as imprecise | ✓ |
| 11 .md + qa rubric.md (=12) | Add the QA rubric to hit the literal 12 | |
| 12 + 4 section-writer prompts (=16) | Externalize inline SECTION_GUIDANCE too | |

**User's choice:** 11 .md prompts only
**Notes:** Byte-verification clean against real files; smallest correct keystone.

### Q2 — Section-writer inline prompts (SECTION_GUIDANCE)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 24 | Section writers keep reading inline strings this phase | ✓ |
| Externalize now | Extract + byte-verify the 4 inline strings in Phase 22 | |

**User's choice:** Defer to Phase 24
**Notes:** Same extraction risk the research flagged; do it with the prompt-editing UI. Documented gap.

### Q3 — System vs user-prompt templates in prompt_versions

| Option | Description | Selected |
|--------|-------------|----------|
| System prompts only | Store .md system text; user-templates stay code-built | ✓ |
| System + user templates | Lift in-code user-prompt construction into stored templates now | |

**User's choice:** System prompts only
**Notes:** Keeps the keystone focused on read+snapshot+fallback; templates → Phase 24.

### Q4 — `agents` config-row seed scope

| Option | Description | Selected |
|--------|-------------|----------|
| All pipeline agents | Seed rows for every llm_config key (~15), incl. section writers + qa + chronicler | ✓ |
| Only agents with migrated prompts | Seed only the 11/12 with prompt_versions rows | |

**User's choice:** All pipeline agents
**Notes:** Complete roster for Phase 23 dashboard graph; prompt_versions just lacks rows for not-yet-migrated agents.

---

## Claude's Discretion (decided from brief/research)

- **llm_config.py disposition:** KEEP as the in-code fallback default set; Convex `agents` rows override at runtime; the `agents` seed is generated FROM llm_config.py. (mirrors .md-as-prompt-fallback)
- **Fallback granularity (CFG-03):** all-or-nothing on a hard load_run_config failure (ALL disk/code defaults + single WARNING; still snapshots resolved config); per-key fallback for an individual missing/malformed row (that agent only + per-agent WARNING). Never crash.
- **enabled flag:** stored + snapshotted only this phase; skip-gating deferred to Phase 23/25; DESIGNAGENT_SUPPRESSED untouched.
- **Snapshot shape/boundary:** full resolved per-agent config as JSON on `runs.configSnapshot`; FIRST awaited op after create, before graph.ainvoke (snapshot-race pitfall); `runs` on same runId as pipelineRuns:create.

## Deferred Ideas

- Section-writer/user-template/qa-rubric/VOICE externalization + prompt-editing UI → Phase 24.
- enabled→skip gating → Phase 23/25.
- Node wrappers / live dashboard → Phase 23.
