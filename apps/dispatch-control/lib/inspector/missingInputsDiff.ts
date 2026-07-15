/**
 * computeMissingInputs — the REDEFINED, truncation-honest missing-inputs
 * diff (docs/API_CONTRACTS.md §44.4, INS-03 — the phase's headline
 * diagnostic).
 *
 * REJECTED recipe (do not reintroduce): diffing the fine-grained `{token}`
 * prompt-substitution registry (`VariableRegistry.ts`'s per-agent token
 * list, e.g. `charity_name`, `VOICE_CONSTRAINTS`) against `inputSnapshot`'s
 * top-level keys is broken by construction — the two vocabularies never
 * intersect by name (44-RESEARCH.md Pitfall 1), so that recipe reports
 * EVERY declared token missing for EVERY agent, always. This module diffs
 * `DECLARED_STATE_INPUTS` (the coarse `DispatchState` field-name vocabulary
 * agent_wrapper.py actually captures) instead — the token registry is
 * intentionally never imported here (only `VARIABLE_DESCRIPTIONS`, for the
 * human gloss).
 *
 * Explicit NON-GOAL (§44.4): fine-grained `{token}`-level substitution-gap
 * detection is OUT OF SCOPE for Phase 44. It would require capturing the
 * resolved token->value map at prompt-build time (a bigger agent_wrapper.py
 * change than this phase's additive-field budget) or a per-agent
 * nested-path lookup connecting each VARIABLE_DESCRIPTIONS entry to where in
 * the captured state slice it is sourced from. This coarser diagnostic is
 * the actually-correct, immediately achievable substitute — it never
 * produces a false "missing," which the token-level version would.
 *
 * HARD RULE (D-05, the phase's worst failure mode): this function must
 * NEVER assert a key is definitively `missing` when truncation could have
 * hidden it. Only the untruncated `inputKeys` list (or a snapshot that
 * itself was never truncated) can support a definitive missing claim.
 */
import { DECLARED_STATE_INPUTS } from './declaredStateInputs'
import { VARIABLE_DESCRIPTIONS } from '@/app/(dashboard)/prompt-lab/_components/VariableRegistry'

const TRUNCATION_MARKER = '...[truncated]'

export interface MissingEntry {
  key: string
  gloss: string
  /**
   * true when this key could NOT be confirmed missing — the snapshot was
   * truncated and the key simply wasn't found in the truncated prefix. The
   * panel must render this distinctly ("not captured (snapshot truncated)"),
   * never as a plain, definitive "missing".
   */
  truncated?: boolean
}

export interface MissingInputsResult {
  supplied: string[]
  missing: MissingEntry[]
  approximate: boolean // true when computed from a truncated/absent snapshot (no inputKeys)
  note?: string // set whenever approximate is true, or when DECLARED_STATE_INPUTS has no entry
}

function glossFor(key: string): string {
  return VARIABLE_DESCRIPTIONS[key] ?? ''
}

function parseSuppliedKeys(inputSnapshot: string): string[] {
  // Best-effort: strip the truncation marker before attempting to parse, in
  // case the cut landed exactly on a complete JSON object. Realistic
  // truncated snapshots usually still fail to parse (the cut lands mid
  // value), and that failure is handled honestly below (falls back to []).
  const candidate = inputSnapshot.endsWith(TRUNCATION_MARKER)
    ? inputSnapshot.slice(0, -TRUNCATION_MARKER.length)
    : inputSnapshot
  try {
    const parsed: unknown = JSON.parse(candidate)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed as Record<string, unknown>)
    }
    return []
  } catch {
    return []
  }
}

export function computeMissingInputs(
  agentKey: string,
  inputKeys: string[] | undefined,
  inputSnapshot: string | undefined,
): MissingInputsResult {
  const declared = DECLARED_STATE_INPUTS[agentKey] ?? []

  if (declared.length === 0) {
    return {
      supplied: inputKeys ?? (inputSnapshot != null ? parseSuppliedKeys(inputSnapshot) : []),
      missing: [],
      approximate: inputKeys == null,
      note: 'declared inputs not catalogued for this agent',
    }
  }

  // 1. Prefer the untruncated, additive-optional inputKeys — exact, never approximate.
  if (inputKeys !== undefined) {
    const missing = declared
      .filter((key) => !inputKeys.includes(key))
      .map((key) => ({ key, gloss: glossFor(key) }))
    return { supplied: inputKeys, missing, approximate: false }
  }

  // 2. Fall back to parsing inputSnapshot (legacy rows predating Plan 44-02).
  if (inputSnapshot !== undefined) {
    const supplied = parseSuppliedKeys(inputSnapshot)
    const wasTruncated = inputSnapshot.includes(TRUNCATION_MARKER)

    if (!wasTruncated) {
      // The full (untruncated) snapshot parsed cleanly — the parsed key set
      // is exact, so a definitive missing claim is safe here too.
      const missing = declared
        .filter((key) => !supplied.includes(key))
        .map((key) => ({ key, gloss: glossFor(key) }))
      return { supplied, missing, approximate: false }
    }

    // Truncated: a declared key absent from the parsed prefix is NEVER a
    // definitive "missing" — truncation could have hidden it.
    const missing = declared
      .filter((key) => !supplied.includes(key))
      .map((key) => ({ key, gloss: glossFor(key), truncated: true }))
    return {
      supplied,
      missing,
      approximate: true,
      note: 'snapshot was truncated — this diff is approximate',
    }
  }

  // 3. Neither inputKeys nor inputSnapshot recorded for this step at all.
  return {
    supplied: [],
    missing: declared.map((key) => ({ key, gloss: glossFor(key), truncated: true })),
    approximate: true,
    note: 'no input snapshot recorded for this step',
  }
}
