/**
 * Per-issue segment layout — Phase 55 passthrough.
 *
 * Phase 55: fixed Dispatch brand. Per-issue DesignAgent theming is not applied
 * on public pages; the weekly accent is emitted inside IssueLayout so published,
 * home and preview cannot diverge. lib/theme.ts is unchanged.
 */
export default function IssueSegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
