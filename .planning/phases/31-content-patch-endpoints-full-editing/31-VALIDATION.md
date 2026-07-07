---
phase: 31
slug: content-patch-endpoints-full-editing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------------|
| **Framework** | pytest + pytest-asyncio + respx (pipeline) · vitest (dispatch-control) |
| **Config file** | `packages/pipeline/pyproject.toml` · `apps/dispatch-control/vitest.config.ts` |
| **Quick run command** | `cd packages/pipeline && pytest tests/ -k "phase31 or content_patch or upload_asset" -q` · `pnpm --filter dispatch-control test -- --run` |
| **Full suite command** | `cd packages/pipeline && pytest -q` · `pnpm --filter dispatch-control test -- --run` · `pnpm --filter dispatch-control build` |
| **Estimated runtime** | ~60–120 seconds combined |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the affected package
- **After every plan wave:** Run both full suites
- **Before `/gsd:verify-work`:** Full suite must be green + `pnpm --filter dispatch-control build` exits 0
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | EDT-01 | unit/integration | pytest content-patch endpoint tests (respx-mocked Sanity) | ❌ W0 | ⬜ pending |
| (filled by planner) | | | EDT-02 | unit | pytest structured-field patch tests | ❌ W0 | ⬜ pending |
| (filled by planner) | | | EDT-03 | integration | pytest asset-upload proxy tests (respx-mocked Sanity assets API) | ❌ W0 | ⬜ pending |
| (filled by planner) | | | EDT-05 | source-scan | vitest no-direct-sanity-writes tripwire in apps/dispatch-control | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Pipeline endpoint test scaffolds for the content-patch family (patch prose, structured fields, revision-guard 409, audit-row emission)
- [ ] Pipeline asset-upload proxy test scaffold (binary body → Sanity assets API → reference patch)
- [ ] Dispatch-control source-scan tripwire for EDT-05 (forbid `@sanity/client` / `createClient` / direct Sanity API URLs in apps/dispatch-control source)
- [ ] Editor-component vitest scaffolds (block-editor ops, dirty state, save wiring)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live end-to-end save against real Sanity dataset | EDT-01/02 | Needs real Sanity project + Convex + Clerk session | Edit a section in deployed/local console, save, confirm change in Sanity + audit row in Convex |
| Live asset upload playback | EDT-03 | Needs a real audio/image file + Sanity CDN | Upload podcast audio via console, confirm inline player works and asset attached to draft |
| Preview iframe reflects saved edit | EDT-01 | Visual check | Save an edit, refresh/observe preview iframe shows updated prose |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
