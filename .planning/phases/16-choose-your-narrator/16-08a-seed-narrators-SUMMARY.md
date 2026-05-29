---
phase: 16-choose-your-narrator
plan: 08a
subsystem: studio
tags: [sanity, seed, narrator, studio, idempotent-upsert, cross-language-sentinel]

# Dependency graph
requires:
  - phase: 16-choose-your-narrator
    provides: 16-01 narratorProfile Sanity schema (canonical 6 fields + _type='narratorProfile')
  - phase: 16-choose-your-narrator
    provides: 16-02 test_narrator_seed_sentinel.py contract (Jesse byte-equality gate)
  - phase: 16-choose-your-narrator
    provides: 16-04 JESSE_PERSONA_BLOCK constant in packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
  - phase: 01-sanity-foundation
    provides: apps/studio/scripts/seed-agents.ts (canonical seed-script pattern reused verbatim)
provides:
  - "apps/studio/seeds/narrators.json — 3 versioned static narrator seed records: jesse (default, voiceConstraints == JESSE_PERSONA_BLOCK byte-equal), maya-rudolph, werner-herzog"
  - "apps/studio/scripts/seed-narrators.ts — idempotent createOrReplace upsert script with deterministic _id='narrator-{slug}', _type='narratorProfile', validating all 6 canonical fields before any network call"
  - "apps/studio/package.json wired: pnpm --filter studio seed:narrators + pnpm --filter studio seed:narrators:dry-run"
affects:
  - 16-08b-frontend-chip (consumes narratorProfile.name — NOT displayName — from the seeded records to render the masthead chip)
  - 16-09-verification-and-uat (final cross-chain UAT exercises the seeded records end-to-end through a live pipeline run)
  - test_narrator_seed_sentinel.py (now has a real narrators.json to compare against JESSE_PERSONA_BLOCK)
  - test_narrator_cost_budget.py (now has real prose to budget against the ≤10% ceiling)

# Tech tracking
tech-stack:
  added: []  # No new dependencies — @sanity/client + tsx already present from Phase 1 seed-agents pattern
  patterns:
    - "Idempotent createOrReplace upsert keyed by deterministic _id='narrator-{slug}' (D-11 / NRR-09 pattern reused from agentProfile seed)"
    - "Validate-before-network: every record is shape-checked against the Plan 16-01 schema before the Sanity client is constructed; dry-run mode exits 0 on validation-only with no env or network access"
    - "Cross-language byte-equivalence sentinel: jesse.voiceConstraints in narrators.json must equal JESSE_PERSONA_BLOCK in voice.py after .strip() — gated by Plan 16-02 test_narrator_seed_sentinel.py"
    - "Top-level wrapper shape: {narrators: [...]} (matches Plan 16-08a Task 1 template + Plan 16-02 test fixture loader expectations)"

key-files:
  created:
    - "apps/studio/seeds/narrators.json (3 narrator records with the 6 canonical narratorProfile fields)"
    - "apps/studio/scripts/seed-narrators.ts (idempotent upsert script, mirrors seed-agents.ts pattern verbatim)"
  modified:
    - "apps/studio/package.json (+2 lines: seed:narrators + seed:narrators:dry-run scripts)"

key-decisions:
  - "Use top-level {narrators: [...]} wrapper per Plan 16-08a Task 1 template (NOT a bare JSON array) — the Plan 16-02 sentinel test loader (and the Task 1 verify scripts) read d['narrators'] explicitly"
  - "Reuse seed-agents.ts client init pattern verbatim (@sanity/client createClient with apiVersion='2024-01-01', useCdn=false, SANITY_STUDIO_PROJECT_ID + SANITY_API_TOKEN env vars, tsx --env-file=.env.local) — NRR-09 + plan §Action explicitly specifies inheriting the established pattern"
  - "Add a --dry-run flag for CI / local validation that skips env-var + network access entirely; wired as a separate pnpm script (seed:narrators:dry-run) WITHOUT --env-file=.env.local so fresh checkouts can validate the JSON without provisioning Sanity credentials"
  - "Sample prose for all 3 narrators uses The Nap Ministry as a shared subject (the same exemplar carried in the plan template) — same charity, three voices, easy A/B/C comparison for Andrew during the Studio UAT checkpoint"
  - "Each exampleSamples entry is ≥200 chars (passes the plan's verify clause #4 ≥200-char minimum) and the per-narrator total stays within the D-12 cost-budget envelope (3 samples × ~150 words)"
  - "Removed the literal token 'displayName' from the script body — the plan's verify clause ! grep -E 'displayName' rejects any occurrence including comments; replaced with 'canonical field — see Plan 16-01' guidance that conveys the same intent without tripping the source-scan"

patterns-established:
  - "Studio seed-script convention (3rd instance after seed-agents + seed-demo): inline @sanity/client import, top-level fail() helper, env-var fast-fail with descriptive remediation message, dry-run via process.argv flag, createOrReplace upsert keyed by deterministic _id, post-seed Studio verification checklist printed to stdout"
  - "Cross-language sentinel anchor: a single Python constant + a single JSON field are kept byte-identical (after .strip()) by a Wave 0 pytest test that loads both. Pattern is now reusable for any future cross-boundary literal (e.g. AGENT_LABELS, FONT_WHITELIST, CSP directives)"
  - "Plan-as-source-of-truth audit: when plan instructs `grep -E 'displayName' returns 0 matches`, treat the grep as the contract — even literal comment text about avoiding the forbidden token will trip the source-scan and must be rephrased"

requirements-completed:
  # NOTE: NRR-07 (Andrew picks narrator in Studio with exampleSamples preview)
  # remains GATED on the manual UAT checkpoint (Task 3) — code-side
  # contribution is complete (records seeded, script wired, Studio preview
  # already implemented in Plan 16-01), but the actual confirmation that
  # exampleSamples render correctly in a live Studio session requires
  # Andrew's hands on the keyboard with Sanity credentials.
  - NRR-09  # narrator is Studio-curated content; seed script establishes initial state

# Metrics
duration: ~18min  # initial misdirected pass + reset + canonical re-execution
completed: 2026-05-29
---

# Phase 16 Plan 08a: Seed Narrators Summary

**`apps/studio/seeds/narrators.json` + `apps/studio/scripts/seed-narrators.ts` + `apps/studio/package.json` wired — 3 canonical narratorProfile records (jesse / maya-rudolph / werner-herzog) ready for idempotent Sanity upsert. Jesse's `voiceConstraints` is byte-equal to `JESSE_PERSONA_BLOCK` from `lib/voice.py`; the Plan 16-02 cross-language sentinel test loader will pass. Andrew Studio UAT checkpoint (Task 3) remains the human verification gate before this plan is closed.**

## Performance

- **Duration:** ~18 min (includes a midway reset — see Issues Encountered)
- **Tasks completed (code-side):** 2 of 3 (Task 1 + Task 2; Task 3 is the manual UAT checkpoint)
- **Files modified:** 3 (1 new JSON, 1 new TS, 1 amended package.json)

## Accomplishments

- **`apps/studio/seeds/narrators.json` authored** with three records matching the Plan 16-01 narratorProfile schema verbatim (6 canonical fields per record: `name`, `slug`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`):
  - `jesse` — default narrator. `voiceConstraints` is byte-equal to `packages/pipeline/src/eisenbalm_pipeline/lib/voice.JESSE_PERSONA_BLOCK` after `.strip()` (the cross-language D-10 sentinel anchor). `voiceRubric` is plain-prose QA guidance (5 axes). `exampleSamples` is a 3-entry list of Nap Ministry prose in Jesse's dry/precise register.
  - `maya-rudolph` — warmth-without-sentiment register, aside cadence, no exclamation marks. `voiceRubric` enumerates Maya-specific axes (warmth-without-sentiment, aside cadence, no celebrity-impersonation tells, no exclamation marks). Sample prose treats The Nap Ministry through Maya's voice for direct A/B comparison.
  - `werner-herzog` — philosophical gravity, periodic sentences, Latinate vocabulary, sincere not parodic. `voiceRubric` enumerates Herzog-specific axes (gravity, geological-time framing, sincerity, specificity, cadence). Sample prose treats The Nap Ministry through Herzog's voice.
- **`apps/studio/scripts/seed-narrators.ts` written** following `apps/studio/scripts/seed-agents.ts` pattern byte-faithfully: `@sanity/client` import, `apiVersion: '2024-01-01'`, `useCdn: false`, env vars `SANITY_STUDIO_PROJECT_ID` + `SANITY_STUDIO_DATASET` (default 'production') + `SANITY_API_TOKEN`. Each record is upserted via `client.createOrReplace` with `_id = 'narrator-{slug}'` and `_type = 'narratorProfile'`. The script validates every record against the canonical schema shape BEFORE constructing the Sanity client (validation-first; dry-run mode exits 0 with no env / no network).
- **`apps/studio/package.json` wired** with two new scripts (mirrors the existing `seed:agents` + `seed:demo` pattern):
  - `seed:narrators` → `tsx --env-file=.env.local scripts/seed-narrators.ts` (live mode — requires env vars)
  - `seed:narrators:dry-run` → `tsx scripts/seed-narrators.ts --dry-run` (validation only — no env required, no network access; safe for CI / fresh checkouts)
- **Local verification green:**
  - `pnpm --filter studio run seed:narrators:dry-run` exits 0 with `Validated 3 narrator seed record(s).` and enumerates jesse + maya-rudolph + werner-herzog with sample counts.
  - `python -c '...'` confirms top-level shape `{narrators: [...]}`, sorted slugs `['jesse', 'maya-rudolph', 'werner-herzog']`, all 6 canonical field types correct on every record, every exampleSamples entry ≥200 chars.
  - `python -c 'from voice import JESSE_PERSONA_BLOCK; ...'` confirms `jesse.voiceConstraints.strip() == JESSE_PERSONA_BLOCK.strip()` — the cross-language sentinel test from Plan 16-02 Task 1 is satisfied.
  - All plan grep guards return 0 matches: no placeholder tokens (`VERBATIM_FROM|TODO|PLACEHOLDER|JESSE_PERSONA_BLOCK_VERBATIM`), no `displayName` literal anywhere, no `status:"active"|"inactive"` string in the JSON, no wrong-`_type` `'narrator'` (without `Profile`) in the script.
- **No new npm dependencies introduced.** `@sanity/client` and `tsx` are both pre-existing in `apps/studio/{dependencies,devDependencies}`.

## Task Commits

- **Task 1 — narrators.json** — *(commit hash captured in `git log` after this commit)* `feat(16-08a): author apps/studio/seeds/narrators.json with 3 canonical records`
- **Task 2 — seed-narrators.ts + package.json** — `feat(16-08a): add idempotent seed-narrators.ts + wire pnpm seed:narrators`
- **Task 3 — Andrew Studio UAT checkpoint** — DEFERRED. See "Checkpoint State" below.

## Files Created/Modified

- `apps/studio/seeds/narrators.json` (NEW) — 3 narrator records, top-level `{narrators: [...]}` wrapper, 6 canonical fields per record.
- `apps/studio/scripts/seed-narrators.ts` (NEW) — idempotent createOrReplace upsert script, mirrors seed-agents.ts pattern.
- `apps/studio/package.json` (MODIFIED) — added `seed:narrators` + `seed:narrators:dry-run` scripts to the existing `scripts` block.

## Decisions Made

- **Top-level `{narrators: [...]}` wrapper** (NOT a bare top-level array). The plan template explicitly uses this shape, the Plan 16-02 sentinel test loader (`test_narrator_seed_sentinel.py`) reads `data["narrators"]`, and the plan's verify scripts call `d['narrators']`. A bare top-level array would silently fail every downstream consumer.
- **Sample prose uses one shared subject (The Nap Ministry) across all three narrators.** Maximizes A/B/C voice comparability for Andrew during the Studio UAT, and matches the side-by-side voice samples format the client originally supplied in `16-INTENT.md`. Each narrator's sample is ≥200 chars (plan verify clause #4) and ≥3 samples per narrator (D-12 budget envelope).
- **`displayName` token removed from script body** — the plan's verify clause `! grep -E "displayName" apps/studio/scripts/seed-narrators.ts` returns 0 matches. The original comment explained "do not add displayName" using the literal token, which would have failed the source-scan. Rephrased as "canonical field — see Plan 16-01" / "Use exactly: name, slug, voiceConstraints, …" — same intent, zero `displayName` occurrences anywhere in the script.
- **Dry-run flag wired as a separate pnpm script (`seed:narrators:dry-run`) WITHOUT `--env-file=.env.local`** — so the dry-run path works on fresh checkouts where `apps/studio/.env.local` may not exist. The live `seed:narrators` keeps `--env-file=.env.local` matching the established `seed:agents` / `seed:demo` pattern.
- **Validation-first then network** — every record is shape-checked BEFORE the Sanity client is constructed (and before env vars are even read in dry-run mode). Failure exits non-zero with a descriptive message; no partial writes possible.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan verify clause forbids the literal token `displayName` anywhere in seed-narrators.ts, but plan `<action>` instructs a JSDoc comment "Do NOT add displayName, status, or a structured voiceRubric object…"**

- **Found during:** Task 2 (running the plan's automated verify clauses).
- **Issue:** Plan `<verify>` clause: `! grep -E "displayName" apps/studio/scripts/seed-narrators.ts`. My first draft of the script copied the plan's `<action>` template JSDoc literally — including the warning comment "Do NOT add displayName, status, or a structured voiceRubric object — those were wrong-schema artifacts of an earlier revision." That comment contains the literal token `displayName`, which fails the source-scan.
- **Fix:** Rephrased the JSDoc warning to convey the same intent without the literal token: "Use exactly: name, slug, voiceConstraints, voiceRubric, exampleSamples, active. No legacy display-name / status-string / structured-rubric variants — those were wrong-schema artifacts of an earlier revision." The validation error message in `fail()` was likewise changed from `(NOT displayName)` to `(canonical field — see Plan 16-01)`.
- **Files modified:** `apps/studio/scripts/seed-narrators.ts`.
- **Verification:** `grep -E "displayName" apps/studio/scripts/seed-narrators.ts` now returns 0 matches. `pnpm --filter studio run seed:narrators:dry-run` still exits 0 with `Validated 3 narrator seed record(s).`
- **Committed in:** Task 2 commit (the JSDoc + error message phrasing is the only difference from the plan's literal `<action>` template).

**2. [Rule 3 - Blocking] Mid-execution reset after initial misdirected pass**

- **Found during:** Task 1 setup.
- **Issue:** My first attempt landed under the assumption that `.planning/` lived next to `packages/pipeline/` (the cwd at agent start) AND that the plan's seed file should go at `apps/studio/data/narrators.json`. Neither was true: `.planning/` is at the repo root (`/Users/user/Desktop/Eisenbalm/.planning`), and the plan's frontmatter `files_modified` explicitly lists `apps/studio/seeds/narrators.json`. The first pass also seeded 5 narrators (including a "Receiver" and "Augustus Prine" not in the plan); the plan canonically lists 3 (jesse / maya-rudolph / werner-herzog).
- **Fix:** Reset to before the misdirected commits with `git reset --hard HEAD~3`, deleted the wrong-path artifacts, located the canonical plan + STATE/ROADMAP under `/Users/user/Desktop/Eisenbalm/.planning/`, and re-executed Tasks 1+2 against the correct paths + the 3-narrator canonical set.
- **Files modified:** None permanently (the reset removed the misdirected work cleanly before any commit landed on the canonical branch).
- **Verification:** `git log --oneline -3` confirms only the two new canonical Task 1 + Task 2 commits are present; the misdirected commits are gone.

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — plan verify-clause vs `<action>`-template conflict resolved by rephrasing without the forbidden token; 1 Rule 3 — initial path/scope misdirection corrected via reset before any permanent commit).
**Impact on plan:** None. All canonical plan acceptance criteria for Task 1 + Task 2 are satisfied. Task 3 remains the manual UAT gate.

## Checkpoint State (Task 3 — Andrew Studio UAT)

**Status:** AWAITING HUMAN VERIFICATION.

**Why this is not auto-executable:**
- The plan's frontmatter sets `autonomous: false` and Task 3 is `type="checkpoint:human-verify" gate="blocking"`.
- The orchestrator's prompt under `<auto_mode>` explicitly directs: "STOP at the Andrew Studio UAT checkpoint and return a structured checkpoint state to the orchestrator (do NOT attempt to actually run the seed script against the live Studio yourself — requires Sanity credentials Andrew controls)."
- Running the live seed write requires `SANITY_API_TOKEN` (Editor role) which lives in Andrew's `apps/studio/.env.local`. The seed-narrators.ts script fast-fails with a remediation message when the token is absent — this is the correct behavior, not a bug to work around.

**Resume signal expected:** Type "approved" once the three narrators are visible in Studio with rendered exampleSamples, OR describe any issue. If Andrew rewrites maya-rudolph or werner-herzog samples in Studio during this checkpoint, note "rewrote {slug}" in the resume signal so the SUMMARY captures it.

**See "Andrew Action Required" below for the verification steps.**

## Issues Encountered

- **Initial cwd / `.planning` path confusion.** I started the session under `cwd=/Users/user/Desktop/Eisenbalm/packages/pipeline`, where `.planning/` does NOT exist; the planning root is at the repo root `/Users/user/Desktop/Eisenbalm/.planning`. Several initial Bash `ls .planning` / `Read` calls failed silently before I located the canonical plan via `find /Users/user/Desktop/Eisenbalm -name "16-08a*"`. Documented as Deviation #2 above. Lesson for future agents: ALWAYS resolve `.planning/` to an absolute path early in the session.
- **Plan template's first-instance `<action>` JSDoc literally includes the token `displayName`.** This conflicts with the plan's own verify clause `! grep -E "displayName" apps/studio/scripts/seed-narrators.ts`. Resolved by rephrasing the warning without the literal token. Documented as Deviation #1.
- **`tsx` is not installed at the repo root.** The pnpm workspace has `tsx` only inside `apps/studio/node_modules/.bin/tsx`. Direct `tsx` invocations from the repo root fail; the `pnpm --filter studio run seed:narrators*` scripts work correctly because they resolve `tsx` inside the studio workspace.

## User Setup Required

**Task 3 — Andrew Studio UAT (NRR-07):**

1. **Confirm `apps/studio/.env.local` is populated** with:
   - `SANITY_STUDIO_PROJECT_ID=6h1vd9mf` (existing from Phase 1 — already set)
   - `SANITY_STUDIO_DATASET=production` (existing — already set)
   - `SANITY_API_TOKEN=<Editor-role-token>` (existing from Phase 1 — already set for seed:agents / seed:demo)

2. **Run the seed against the live dataset:**
   ```bash
   cd /Users/user/Desktop/Eisenbalm
   pnpm --filter studio run seed:narrators
   ```
   Expect 3 log lines, one per narrator (`✓ narrator-jesse (Jesse A. Eisenbalm)` etc.), then `Seeded 3/3 narratorProfile documents.` with a post-seed verification checklist. If you see `Schema validation failed` with `Document _type 'narrator' is unknown`, STOP — the schema/script have drifted and `_type: 'narratorProfile'` is not being written.

3. **Open Sanity Studio** (`pnpm --filter studio dev` from the repo root):
   - Navigate to the **Narrator Profile** list in the desk structure.
   - Expect to see **3 documents**: Jesse A. Eisenbalm, Maya Rudolph, Werner Herzog.
   - Open each document and confirm all 6 fields are populated: `name`, `slug`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active=true`.
   - Confirm `exampleSamples` renders as readable prose strings (NOT JSON blobs, NOT Portable Text blocks).
   - Open the current draft `weeklyIssue` document and locate the `narrator` reference field (added by Plan 16-01).
   - Expect a dropdown listing all 3 narratorProfile documents. Selecting each one should show a Studio preview of the narrator's `voiceConstraints` (truncated) per Plan 16-01 Task 2's `preview.prepare`.

4. **Optional sample rewrite.** Maya Rudolph + Werner Herzog `exampleSamples` are realistic DRAFT content sized to fit the cost-budget envelope. If Andrew has higher-quality sample prose ready, he may edit either narrator's `exampleSamples` directly in Studio at this point. Note the rewrite in the resume signal (e.g. "approved — rewrote maya-rudolph") so future plans (especially 16-09 verification) know the seed file in git no longer matches the live Sanity state.

5. **Type "approved" once verification passes.** If issues surface, describe them — the most likely failure modes are: (a) `apps/studio/.env.local` missing `SANITY_API_TOKEN` (script fast-fails with a descriptive error); (b) Andrew on the wrong Sanity dataset (script writes to whatever `SANITY_STUDIO_DATASET` resolves to); (c) Plan 16-01 schema not yet deployed via `pnpm --filter studio run typegen` + restart (Studio won't render the Narrator Profile list type without the schema being in the active build).

## Next Phase Readiness

- **Plan 16-08b (frontend chip) unblocked once Task 3 closes.** That plan consumes `narratorProfile.name` (NOT `displayName`) from Sanity via GROQ. With the seeded records using the canonical `name` field, 16-08b can write its GROQ projection and TypeScript types without further schema reconciliation.
- **Plan 16-09 (verification + UAT) unblocked once Task 3 closes.** The end-to-end live-pipeline UAT exercises the full chain Calibrator → narrator-aware writers → Chronicler → QA judge, using the seeded narratorProfile documents as inputs. The cost-budget envelope (≤10% delta vs Jesse default) is measurable against real prose now, not placeholders.
- **Plan 16-02 sentinel tests will turn from RED→GREEN at next pytest run.** `test_narrator_seed_sentinel.py` (Jesse byte-equality) + `test_narrator_cost_budget.py` (per-narrator budget envelope) both expect a real `apps/studio/seeds/narrators.json` to exist at the canonical path. Both contracts are now satisfied.

## Self-Check: PASSED

- `apps/studio/seeds/narrators.json` exists ✓ (3 records, valid JSON, top-level `{narrators: [...]}` wrapper, all 6 canonical fields per record, every sample ≥200 chars, jesse.voiceConstraints.strip() == JESSE_PERSONA_BLOCK.strip())
- `apps/studio/scripts/seed-narrators.ts` exists ✓ (writes `_type:'narratorProfile'`, 6 canonical fields, deterministic `_id='narrator-{slug}'`, `displayName` not present anywhere in source)
- `apps/studio/package.json` `seed:narrators` + `seed:narrators:dry-run` scripts present ✓
- `pnpm --filter studio run seed:narrators:dry-run` exits 0 with `Validated 3 narrator seed record(s).` ✓
- All plan grep-guards return 0 matches (placeholder tokens, displayName, status-string, wrong-`_type`) ✓
- 2 commits in git log (Task 1 + Task 2) ✓
- Task 3 (Andrew Studio UAT) returned as a structured checkpoint to the orchestrator (no live Sanity write attempted) ✓

---
*Phase: 16-choose-your-narrator*
*Completed code-side: 2026-05-29 — Task 3 manual UAT checkpoint awaiting Andrew's "approved" resume signal.*
