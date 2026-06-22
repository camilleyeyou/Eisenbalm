/**
 * force-dynamic: the editor view subscribes via Convex useQuery
 * (api.promptVersions.getActive / listForAgent), which requires a live
 * ConvexProvider context — static prerendering throws without this.
 */
export const dynamic = 'force-dynamic'

/**
 * Per-agent prompt editor page — Phase 24 (PRM-01/PRM-02/PRM-03/PRM-06).
 *
 * Server Component: resolves the workspace_id and the [agentKey] route param,
 * then renders the client editor view. The client view loads the active
 * version via api.promptVersions.getActive and seeds the CodeMirror draft with
 * allowedVariables = VARIABLE_REGISTRY[agentKey].
 *
 * Unknown agentKeys (not in the registry) still render — the editor treats them
 * as having no allowed variables (every {token} flags as unknown), which is the
 * correct conservative behaviour.
 */
import { getCurrentWorkspace } from '@/lib/workspace'
import AgentPromptEditorView from '../_components/AgentPromptEditorView'

interface AgentPromptPageProps {
  params: Promise<{ agentKey: string }>
}

export default async function AgentPromptPage({ params }: AgentPromptPageProps) {
  const { agentKey: raw } = await params
  const agentKey = decodeURIComponent(raw)
  const workspace_id = await getCurrentWorkspace()

  return (
    <div className="space-y-4">
      <AgentPromptEditorView workspaceId={workspace_id} agentKey={agentKey} />
    </div>
  )
}
