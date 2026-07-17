/**
 * Phase 50 (WBN-04, D-13, docs/API_CONTRACTS.md §4A.2c) — the "why this
 * draft exists" origin back-reference shape, shared by:
 *   - AgentPromptEditorView.tsx (reads deep-link params / active.originRef,
 *     renders "why this draft exists")
 *   - PromptEditor.tsx / PromptSaveDialog.tsx (forward it into the
 *     `promptVersions.saveVersion` mutation on save)
 *
 * Kept in its own module (rather than exported from AgentPromptEditorView,
 * the top-level view) so the save-side components don't import from their
 * own parent.
 */
export interface PromptOriginRef {
  runId: string
  sectionName: string
  excerpt: string
  issueNumber?: number
}
