/**
 * Prompts — Phase 24 (PRM-01/PRM-06): the agent/asset selector.
 *
 * Lists every editable prompt asset (system-prompt agents, `*_user` templates,
 * section-guidance keys, `rubric`, and `voice_constraints`), grouped by key
 * shape and each linking to /prompts/[agentKey]. The set is data-driven from
 * the variable registry + pipeline topology (brand-agnostic — no hardcoded
 * Eisenbalm labels). VOICE_CONSTRAINTS appears here as `voice_constraints`.
 */
import Link from 'next/link'
import {
  listEditableAgentKeys,
  groupForAgentKey,
  GROUP_LABELS,
  type EditableAgentGroup,
} from './_components/agentList'

const GROUP_ORDER: EditableAgentGroup[] = [
  'system',
  'user-template',
  'section-guidance',
  'asset',
]

export default function PromptsPage() {
  const keys = listEditableAgentKeys()

  const grouped = new Map<EditableAgentGroup, string[]>()
  for (const key of keys) {
    const group = groupForAgentKey(key)
    const list = grouped.get(group) ?? []
    list.push(key)
    grouped.set(group, list)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-neutral-900">Prompts</h1>
        <p className="text-sm text-neutral-500">
          Edit any agent prompt, user template, or shared asset with live
          variable hints and immutable versioning. Choose an asset to begin.
        </p>
      </div>

      {GROUP_ORDER.map(group => {
        const groupKeys = grouped.get(group)
        if (!groupKeys || groupKeys.length === 0) return null
        return (
          <section key={group} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {GROUP_LABELS[group]}
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groupKeys.map(key => (
                <li key={key}>
                  <Link
                    href={`/prompts/${encodeURIComponent(key)}`}
                    className="block rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-mono text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 transition-colors min-h-[44px]"
                  >
                    {key}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
