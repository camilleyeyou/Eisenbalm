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
import type { Metadata } from 'next'
import { getCurrentWorkspace } from '@/lib/workspace'
import {
  listEditableAgentKeys,
  groupForAgentKey,
  type EditableAgentGroup,
} from './_components/agentList'
import PromptsListClient from './_components/PromptsListClient'
import NextStepSlab from '@/components/editor/NextStepSlab'
import { COPY } from '@/lib/editorState'

// quick 260723-4a6 (Task 1e): Server Component route — static title.
export const metadata: Metadata = { title: 'What the writers are told' }

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
      <NextStepSlab
        sentence={COPY.subPageSlab}
        ghost={{ label: COPY.backToBehind, href: '/admin' }}
      />
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-[32px] font-semibold leading-none text-[color:var(--color-ink)]">
          What the writers are told
        </h1>
        <p className="mt-1.5 font-[family-name:var(--font-body)] text-[14px] italic text-[color:var(--color-ink-soft)]">
          The instructions each writer follows. Earlier versions are kept, so any change can be undone.
        </p>
      </div>

      <PromptsListClient workspaceId={workspace_id} groups={groups} />
    </div>
  )
}
