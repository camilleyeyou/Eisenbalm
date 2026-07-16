/**
 * Phase 47 (BRF-06) — BriefFieldStrengthen Wave-0 scaffold.
 *
 * "Ask an agent to strengthen" a single Brief field generalizes the
 * Phase-45 revision preview/apply pattern (D-03/D-13) to a Brief-field
 * scope, exactly as Phase 45 generalized FCT-06 (claim-scope -> passage-
 * scope) — reusing `RevisionFlow.tsx`'s state machine shape rather than
 * forking a third revision engine. Strengthen shows a preview (proposed
 * stronger field value, read-only, NO mutation/audit — mirrors
 * `revise/preview`) then Apply writes the field via `briefs:patch` +
 * `_emit_audit` (mirrors `revise/apply`, docs/API_CONTRACTS.md §47.5).
 *
 * This is a COLLECTIBLE Wave-0 scaffold (47-01) — `BriefFieldStrengthen`
 * does not exist yet, so every case is `it.todo`. The implementing plan
 * (47-07, brief-field-table-and-strengthen) fills these in.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it } from 'vitest'

describe('BriefFieldStrengthen (BRF-06)', () => {
  it.todo('clicking "Ask an agent to strengthen" calls the field-scoped strengthen/preview client (read-only, no mutation)')

  it.todo('renders the preview (proposedText + whatChanged) without writing anything')

  it.todo('Apply calls the field-scoped strengthen/apply client and writes the field via briefs:patch')

  it.todo('a successful Apply surfaces a Decision-log entry (resolution: "brief_field_strengthened")')

  it.todo('Discard/cancel leaves the Brief field unchanged')
})
