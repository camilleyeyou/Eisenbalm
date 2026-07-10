/**
 * Prompts — Phase 24 (PRM-01/PRM-06) + quick 260624-4ru (view-first).
 *
 * Lists every editable prompt asset (system-prompt agents, `*_user` templates,
 * section-guidance keys, `rubric`, and `voice_constraints`), grouped by key
 * shape and each linking to /prompts/[agentKey]. The set is data-driven from
 * the variable registry + pipeline topology (brand-agnostic — no hardcoded
 * Eisenbalm labels). VOICE_CONSTRAINTS appears here as `voice_constraints`.
 *
 * View-first (quick 260624-4ru): this thin server component resolves the
 * workspace_id and the static grouped key set, then hands them to
 * PromptsListClient, which owns the single live subscription
 * (api.promptVersions.listActiveForWorkspace) and renders each card with a
 * humanized name + active-prompt preview + "active v{N} · updated {date}".
 */
import { getCurrentWorkspace } from '@/lib/workspace'
import {
  listEditableAgentKeys,
  groupForAgentKey,
  type EditableAgentGroup,
} from './_components/agentList'
import PromptsListClient from './_components/PromptsListClient'

const GROUP_ORDER: EditableAgentGroup[] = [
  'asset',
  'system',
  'section-guidance',
  'user-template',
]

export default async function PromptsPage() {
  const workspace_id = await getCurrentWorkspace()

  const keys = listEditableAgentKeys()
  const grouped = new Map<EditableAgentGroup, string[]>()
  for (const key of keys) {
    const group = groupForAgentKey(key)
    const list = grouped.get(group) ?? []
    list.push(key)
    grouped.set(group, list)
  }

  const groups = GROUP_ORDER.map(group => ({
    group,
    keys: grouped.get(group) ?? [],
  }))

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">Prompts</h1>
        <p className="text-sm text-neutral-500">
          Edit any agent prompt, user template, or shared asset with live
          variable hints and immutable versioning. Choose an asset to begin.
        </p>
      </div>

      <PromptsListClient workspaceId={workspace_id} groups={groups} />
    </div>
  )
}
