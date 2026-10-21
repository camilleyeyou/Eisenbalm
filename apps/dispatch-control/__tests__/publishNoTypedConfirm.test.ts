/**
 * Phase 50-03 (D-15, WBN-06) — publish-path no-typed-confirm source-scan
 * tripwire.
 *
 * The Phase 34 reversal is a locked milestone decision (PROJECT.md
 * §Current Milestone: "Publish drops typed confirmation — reverses Phase
 * 34"): typed confirmation survives ONLY for Mark Do-not-use (org name +
 * required reason, Editor-in-chief). Publish is gated solely by the
 * sign-off/claims state — `ready = factDone && voiceDone` (∧ Editor ∧
 * !held) — plus a concise exact-preview + one-click confirm
 * (`PublishPreviewDialog`), never a typed-text-match input.
 *
 * Manually verified (also documented in 50-03-SUMMARY.md): reading
 * DecisionRail.tsx and PublishPreviewDialog.tsx confirms neither publish
 * surface contains a typed-title/typed-name confirm input today. This test
 * makes that fact a tripwire.
 *
 * finish-phase-34-retirement (quick 260718-00i Task 3): the legacy sibling
 * publish surface `ReviewDecisionPanel.tsx` (run-monitor/runs/[runId]/review)
 * has been deleted — its stale `claimChecks.allSignedOff` gate disagreed
 * with the server's `signOffs:activeByRunId` gate and produced the traced
 * production dead end. `DecisionRail` (mounted at the Approval stage) and
 * `PublishPreviewDialog` are now the only two publish-decision surfaces;
 * this tripwire is trimmed to scan only those two.
 *
 * Scoped to the TWO actual publish-decision files (not every file under
 * their parent `_components/` directory) — that directory also holds
 * unrelated content-editing components with legitimate `<input>` elements
 * (AssetUploadSlot, TurnListEditor, StructuredFieldEditor,
 * SchedulePublishDialog's date/time field) that are out of scope for this
 * scan and must not false-positive it. This mirrors `roleGateInventory.test.ts`'s
 * pattern of scanning an EXPECTED file list, not an entire directory tree.
 * The registry Do-not-use typed-name confirm (Task 2, RegistryTable.tsx)
 * is a different directory entirely and is never touched by this scan.
 *
 * If this test ever fails because a typed-confirm input was added to a
 * publish surface, DO NOT weaken the assertions — remove the typed-confirm
 * UI (Phase 34 reversal / D-15 is locked) or, if the milestone decision
 * itself changed, update PROJECT.md first (contract-first per CLAUDE.md).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, it, expect } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const EDITORIAL_ROOT = path.join(REPO_ROOT, 'apps/dispatch-control/app/(editorial)/_components')

// Quick 261021-j83: DecisionRail and PublishPreviewDialog were deleted with
// the review desk. The ONE publish surface is the front door's footer
// (PublishFooter, fed by IssueHome's derivePublishGate).
const PUBLISH_FOOTER = path.join(EDITORIAL_ROOT, 'PublishFooter.tsx')
const ISSUE_HOME = path.join(EDITORIAL_ROOT, 'IssueHome.tsx')

const PUBLISH_SURFACE_FILES = [PUBLISH_FOOTER, ISSUE_HOME]

// Forbidden pattern: any raw <input> control on a publish-decision surface.
// Narrow to these two named files (see header) so it does not false-positive
// on sibling content-editing components in the same parent directory, nor
// on the registry Do-not-use typed-name confirm (different directory,
// legitimately HAS one — out of this scan's scope).
const INPUT_ELEMENT_PATTERN = /<input\b/

// A typed-confirm idiom would gate a button on a value comparison against a
// title/name field — e.g. `typedName`/`typedTitle`/`confirmText` state, or a
// `.trim() ===`/`.trim() !==` name/title match. Neither of these two files
// should reference any such idiom.
const TYPED_CONFIRM_IDIOM_PATTERN = /typed(Name|Title|Text|Confirm)|confirmText|type the .* to confirm/i

describe('publishNoTypedConfirm: the publish surface carries no typed-confirmation input (D-15)', () => {
  it('both publish-surface files exist (sanity)', () => {
    for (const file of PUBLISH_SURFACE_FILES) {
      expect(fs.existsSync(file), `Missing publish-surface file: ${file}`).toBe(true)
    }
  })

  it.each(PUBLISH_SURFACE_FILES)('%s has NO <input> element and NO typed-confirm idiom', (file) => {
    const content = fs.readFileSync(file, 'utf-8')
    expect(INPUT_ELEMENT_PATTERN.test(content)).toBe(false)
    expect(TYPED_CONFIRM_IDIOM_PATTERN.test(content)).toBe(false)
  })

  it("the front door's Publish gate is derivePublishGate (hold / role / busy), not a typed match or sign-offs", () => {
    const home = fs.readFileSync(ISSUE_HOME, 'utf-8')
    expect(/derivePublishGate\(/.test(home)).toBe(true)
    expect(/signOff|factsActive|humanActive|typed/i.test(home)).toBe(false)
  })

  it('the registry Do-not-use typed-name confirm remains the ONLY typed confirmation in operator copy (cross-check)', () => {
    const registryTablePath = path.join(
      REPO_ROOT,
      'apps/dispatch-control/app/admin/charities/_components/RegistryTable.tsx',
    )
    expect(fs.existsSync(registryTablePath)).toBe(true)
    const content = fs.readFileSync(registryTablePath, 'utf-8')
    // Mark Do-not-use must keep its typed-confirmation requirement.
    expect(/typedName/.test(content)).toBe(true)
  })
})
