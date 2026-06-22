# Deferred Items — Phase 24

Out-of-scope discoveries logged during plan execution (not fixed by the owning plan).

## From Plan 24-04b (user-template call-sites + seed)

Four pre-existing RED test scaffolds in the shared test files fail identically
before and after 04b's changes — they are owned by later plans, not 04b:

- `tests/test_prompt_version_seeds.py::test_voice_constraints_seed_byte_equivalence`
  — needs `prompts/voice_constraints.md` (lands in a later plan / Plan 06).
- `tests/test_prompt_version_seeds.py::test_rubric_seed_byte_equivalence`
  — needs `prompts/rubric.md` (Plan 05b).
- `tests/test_voice_db_override.py::test_db_override_passthrough`
  — needs `assemble_voice(..., db_voice_override=...)` kwarg (Plan 06).
- `tests/test_voice_db_override.py::test_db_override_used_when_provided`
  — same Plan 06 kwarg.

These are intentional RED scaffolds (each carries a `RED until Plan 06`/asset-not-yet-seeded
comment) and were called out as out-of-scope in the 24-04a SUMMARY "Scope Boundary Note".
Plan 04b owns only `test_user_template_seed_byte_equivalence` (GREEN, 11/11).

## From Plan 24-08 (diff/rollback/test-run UI) — pre-existing tsc errors (53)

Full-project `tsc --noEmit` in apps/dispatch-control reports 53 errors that exist
BEFORE this plan (confirmed: identical count at HEAD~3, before any 24-08 commit)
and are unrelated to the diff/rollback/test-run UI. The 24-08 verification bar —
`tsc` clean for the CHANGED files + full vitest suite green (73 passed) — is met;
all five 24-08 files produce zero tsc errors. Standing issues, left for a dedicated
type-hardening pass:

- `__tests__/auditViewer.test.ts`, `__tests__/costRollup.test.ts`,
  `__tests__/runs.test.ts`, `__tests__/saveVersion.test.ts` — possibly-undefined
  object access (TS18048/TS2532) + `import.meta.glob` untyped (TS2339; needs a
  `vite/client` types reference or test-only tsconfig include).
- `app/(dashboard)/prompts/_components/variableHighlightExtension.ts(23,21)` and
  `VariableRegistry.ts(88,18)` — `Object is possibly 'undefined'` (TS2532) in
  Phase-24 Plan-01/07 code (not 24-08).

Runtime is unaffected (vitest transpiles per-file; all 73 tests pass).
