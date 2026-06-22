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
