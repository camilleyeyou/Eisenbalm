/**
 * Phase 47 (BRF-05) — BriefFieldTable Wave-0 scaffold.
 *
 * The Brief is the one genuinely new cross-boundary artifact of this phase:
 * six console-editable fields (premise, currentPeg, centralClaim,
 * readerEffect, knownRisks, voiceIntention — docs/API_CONTRACTS.md §7/§47.1)
 * read from the Convex `briefs:byRunId` query and generated once inside
 * `editor_gate_1` (§47.3) after the winning charity resolves. An edit
 * routes through the guarded content boundary — `patchBrief` (the
 * `pipelineControlClient.ts` client wrapping `PATCH /issues/{run_id}/brief`,
 * §47.5) — never a bare Convex `useMutation` (D-12).
 *
 * This is a COLLECTIBLE Wave-0 scaffold (47-01) — `BriefFieldTable` does not
 * exist yet, so every case is `it.todo`. The implementing plan (47-07,
 * brief-field-table-and-strengthen) fills these in.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it } from 'vitest'

describe('BriefFieldTable (BRF-05)', () => {
  it.todo('renders all six Brief fields: premise, currentPeg, centralClaim, readerEffect, knownRisks, voiceIntention')

  it.todo('renders each field value read from briefs:byRunId (Convex)')

  it.todo('editing a field and saving calls patchBrief(runId, { field, value })')

  it.todo('a successful edit surfaces in the shared Decision log')

  it.todo('renders gracefully (no crash) when briefs:byRunId has not yet produced a row for this run')
})
