'use client'
/**
 * Phase 44 Plan 44-05 (INS-02, INS-04, INS-06) — the universal "Inspect how
 * this was made" 7-tab side panel.
 *
 * PURE PRESENTATION: takes a fully-assembled `InspectorArtifact` (plus the
 * resolved agentKey/promptKey, the redefined missing-inputs diff result, the
 * instructionsExternalized flag, and the output-divergence predicate) as
 * props — no Convex hooks, no data fetching. The container that resolves
 * the artifact key, runs the Convex queries, and assembles `InspectorArtifact`
 * is Plan 44-06; splitting the two keeps this component unit-testable in
 * jsdom against hand-built mock artifacts (see __tests__/InspectorPanel.test.tsx).
 *
 * Mirrors `AgentIOPanel`'s (Phase 23/37) slide-over container/header/close
 * pattern and its human-readable-first + raw-JSON-toggle discipline (D-06),
 * generalized from one collapsed handoff view to seven tabs (D-07). Reuses
 * the shared `prettyJson` helper (lib/inspector/summarize.ts) — the Technical
 * tab is the ONLY place raw JSON leads, and only because the operator chose
 * that tab (never a default anywhere, INS-02).
 *
 * The Instructions tab is the phase's honesty crux (INS-04, 44-RESEARCH.md
 * Pitfall 2, docs/API_CONTRACTS.md §44.9): for the 5 non-externalized agents
 * (origin_story/problem/founder_bio/case_study/qa) it renders the explicit
 * "code-defined, not editable here" state FOLLOWED BY the shared rules the
 * step references (VOICE_CONSTRAINTS/STRUCTURE_CONTRACT for the 4 narrative
 * writers; the fetched rubric for qa) — never a bare one-liner. For the 11
 * externalized agents it renders the REAL active `prompt_versions` content +
 * version number the container mapped — never a blank tab (the D-07/D-14
 * dishonest-blank state).
 *
 * Every state renders label + icon, never color alone (D-14) — tab states,
 * the missing-input flags, the divergence/truncation notes, and every
 * degraded "not recorded" field all follow it.
 *
 * Phase 45 (REV-01, D-18, Plan 45-05 Task 3): flips the footer's "Ask agent
 * to revise" from Always RESERVED to conditionally LIVE. This panel derives
 * a REAL, non-empty `quotedText` via `firstProseExcerpt` (`lib/
 * firstProseExcerpt.ts`) from `sectionBlocks` — the SAME draft/output data
 * `InspectorContainer` already reads (no new subscription) — and only
 * passes `onAskToRevise` down to `InspectorFooter` when both a `sectionName`
 * (this artifact maps to a drafted galley section) AND a non-empty excerpt
 * are available. An empty excerpt (e.g. a claim/rec/org/signal/qa artifact,
 * or an empty section) leaves the footer honestly reserved — an empty
 * `quotedText` would otherwise 409 `span_not_resolved` the moment a
 * direction chip is picked, since `RevisionFlow` has no passage-picker step.
 */
import { useState } from 'react'
import {
  X,
  FileText,
  ArrowDownToLine,
  BookOpen,
  ArrowUpFromLine,
  Quote,
  Activity,
  Code2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Lock,
  Info,
  Copy,
  Check,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { prettyJson } from '@/lib/inspector/summarize'
import type { MissingInputsResult } from '@/lib/inspector/missingInputsDiff'
import type { OutputDivergence } from '@/lib/inspector/outputDivergence'
import { firstProseExcerpt, type ProseBlockLike } from '@/lib/firstProseExcerpt'
import { InspectorFooter } from './InspectorFooter'

/** The exact shape `RevisionFlow`'s `passage` prop expects (45-04). */
export interface InspectorRevisionPassage {
  sectionName: string
  quotedText: string
  blockIndexHint?: number
}

// ── the InspectorArtifact shape (docs/API_CONTRACTS.md §44.2, reproduced
// verbatim from DERIVED-STATE-CONTRACT §8 + the additive `sharedRules`
// field, §44.9) — assembled by the Plan 44-06 container, NOT a stored row. ──
export interface InspectorArtifact {
  title: string
  meta: string // "step: … · agent: … · instructions v4 · run #7"
  asked: string
  result: string
  confidence: string
  warning: string
  upstream: string
  downstream: string
  inputs: string
  missing: string
  instructionVersion: string
  instructions: string
  sectionGuidance: string
  sharedRules: { label: string; content?: string }[]
  output: string
  outputNote: string
  sources: { title: string; mark: string; passage: string; retrievedAt: string }[]
  model: string
  timing: string
  cost: string
  latency: string
  validation: string
  json: string
}

export interface InspectorPanelProps {
  /** undefined = loading (the container's queries have not resolved yet). */
  artifact: InspectorArtifact | undefined
  agentKey: string
  /** null => the agent is not externalized to prompt-lab; footer Improve/Compare/Related-tests render reserved. */
  promptKey: string | null
  runId: string
  /** the redefined, truncation-honest missing-inputs diff result (lib/inspector/missingInputsDiff.ts, 44-04). */
  missing: MissingInputsResult
  /** false for origin_story/problem/founder_bio/case_study/qa (§44.9's NON_EXTERNALIZED_SHARED_RULES set). */
  instructionsExternalized: boolean
  divergence: OutputDivergence
  onClose: () => void
  /**
   * Phase 45 (REV-01, D-18) — this artifact's raw prose blocks, when it maps
   * to a drafted galley section (undefined for claim/rec/org/signal/qa
   * artifacts, or when the container's queries haven't resolved yet). Used
   * ONLY to derive a real, non-empty `quotedText` via `firstProseExcerpt` —
   * no new subscription, the SAME data `InspectorContainer` already reads.
   */
  sectionBlocks?: ProseBlockLike[]
  /** Phase 45 (D-18) — the galley/camelCase section id (e.g. "founderBio") `sectionBlocks` belongs to. */
  sectionName?: string
  /**
   * Phase 45 (D-18) — opens the shared `RevisionFlow` scoped to a passage
   * in this artifact's section (owned by whichever surface — Draft/Voice —
   * mounted the inspector). Called ONLY when this panel derived a
   * non-empty excerpt; omitted/unused otherwise, so "Ask agent to revise"
   * renders honestly reserved rather than a false-live dead button.
   */
  onRequestRevision?: (passage: InspectorRevisionPassage) => void
}

const TABS = [
  'Summary',
  'Inputs',
  'Instructions',
  'Output',
  'Sources',
  'Diagnostics',
  'Technical',
] as const
type Tab = (typeof TABS)[number]

const TAB_ICONS: Record<Tab, LucideIcon> = {
  Summary: FileText,
  Inputs: ArrowDownToLine,
  Instructions: BookOpen,
  Output: ArrowUpFromLine,
  Sources: Quote,
  Diagnostics: Activity,
  Technical: Code2,
}

// ── shared label+icon row (D-14 — never color alone) ────────────────────────

function LabelIcon({
  icon: Icon,
  color,
  children,
}: {
  icon: LucideIcon
  color?: string
  children: React.ReactNode
}) {
  return (
    <p
      className="flex items-start gap-[6px] text-[13px] text-[color:var(--color-ink)]"
      style={color ? { color } : undefined}
    >
      <Icon size={14} aria-hidden="true" className="mt-[2px] shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function TabHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
      {children}
    </h3>
  )
}

// ── Summary tab ───────────────────────────────────────────────────────────

function SummaryTab({ artifact }: { artifact: InspectorArtifact }) {
  return (
    <div className="space-y-4">
      <section>
        <TabHeading>Asked</TabHeading>
        <p className="whitespace-pre-wrap text-[13px] text-[color:var(--color-ink)]">
          {artifact.asked || '—'}
        </p>
      </section>
      <section>
        <TabHeading>Result</TabHeading>
        <p className="whitespace-pre-wrap text-[13px] text-[color:var(--color-ink)]">
          {artifact.result || '—'}
        </p>
      </section>
      {artifact.confidence && <LabelIcon icon={Info}>Confidence: {artifact.confidence}</LabelIcon>}
      {artifact.warning && (
        <LabelIcon icon={AlertTriangle} color="var(--color-vermilion)">
          {artifact.warning}
        </LabelIcon>
      )}
      <section className="grid grid-cols-2 gap-3">
        <div>
          <TabHeading>Upstream</TabHeading>
          <p className="text-[13px] text-[color:var(--color-ink)]">{artifact.upstream || '—'}</p>
        </div>
        <div>
          <TabHeading>Downstream</TabHeading>
          <p className="text-[13px] text-[color:var(--color-ink)]">{artifact.downstream || '—'}</p>
        </div>
      </section>
    </div>
  )
}

// ── Inputs tab — the missing-inputs diff is the headline (INS-03) ──────────

function InputsTab({ missing }: { missing: MissingInputsResult }) {
  return (
    <div className="space-y-4">
      <section>
        <TabHeading>Supplied</TabHeading>
        {missing.supplied.length > 0 ? (
          <p className="text-[13px] text-[color:var(--color-ink)]">{missing.supplied.join(', ')}</p>
        ) : (
          <LabelIcon icon={Info}>No input keys recorded for this step</LabelIcon>
        )}
      </section>
      <section>
        <TabHeading>Missing expected inputs</TabHeading>
        {missing.missing.length === 0 ? (
          <LabelIcon icon={CheckCircle2} color="var(--color-green)">
            All expected state inputs were supplied
          </LabelIcon>
        ) : (
          <ul className="space-y-1.5">
            {missing.missing.map((entry) => (
              <li key={entry.key}>
                <LabelIcon icon={AlertTriangle} color="var(--color-vermilion)">
                  <span className="font-semibold">{entry.key}</span>
                  {entry.truncated
                    ? ' — not captured (snapshot truncated)'
                    : ' — expected state input, absent from this run’s captured input'}
                  {entry.gloss ? ` — ${entry.gloss}` : ''}
                </LabelIcon>
              </li>
            ))}
          </ul>
        )}
        {missing.note && (
          <div className="mt-2">
            <LabelIcon
              icon={AlertTriangle}
              color={missing.approximate ? 'var(--color-marigold-text)' : 'var(--color-ink-soft)'}
            >
              {missing.approximate ? `Approximate — ${missing.note}` : missing.note}
            </LabelIcon>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Instructions tab — the honesty crux (INS-04, §44.9) ─────────────────────

function SharedRulesBlock({ rules }: { rules: InspectorArtifact['sharedRules'] }) {
  return (
    <section>
      <TabHeading>Shared rules referenced</TabHeading>
      {rules && rules.length > 0 ? (
        <ul className="space-y-1.5">
          {rules.map((rule) => (
            <li key={rule.label}>
              <LabelIcon icon={BookOpen}>
                <span className="font-semibold">{rule.label}</span>
                {rule.content ? <>{' — '}{rule.content}</> : null}
              </LabelIcon>
            </li>
          ))}
        </ul>
      ) : (
        <LabelIcon icon={Info}>No shared rules recorded for this step</LabelIcon>
      )}
    </section>
  )
}

function InstructionsTab({
  artifact,
  instructionsExternalized,
}: {
  artifact: InspectorArtifact
  instructionsExternalized: boolean
}) {
  if (!instructionsExternalized) {
    // The PERMANENT, EXPECTED state for origin_story/problem/founder_bio/
    // case_study/qa (§44.9) — never a loading/error state, and never a bare
    // one-liner: the shared rules referenced are the substance here.
    return (
      <div className="space-y-4">
        <LabelIcon icon={Lock}>
          This agent&rsquo;s instructions are code-defined, not editable here.
        </LabelIcon>
        <SharedRulesBlock rules={artifact.sharedRules} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section>
        <TabHeading>
          Active instructions{artifact.instructionVersion ? ` — ${artifact.instructionVersion}` : ''}
        </TabHeading>
        <p className="whitespace-pre-wrap text-[13px] text-[color:var(--color-ink)]">
          {artifact.instructions || 'No active version yet.'}
        </p>
      </section>
      {artifact.sectionGuidance && (
        <section>
          <TabHeading>Section guidance</TabHeading>
          <p className="whitespace-pre-wrap text-[13px] text-[color:var(--color-ink)]">
            {artifact.sectionGuidance}
          </p>
        </section>
      )}
      <SharedRulesBlock rules={artifact.sharedRules} />
      <LabelIcon icon={Info}>
        The version shown is the current active version — it may differ from the version that
        produced this output.
      </LabelIcon>
    </div>
  )
}

// ── Output tab (INS-05) ──────────────────────────────────────────────────

const DIVERGENCE_META: Record<OutputDivergence, { label: string; icon: LucideIcon; color: string }> = {
  diverged: {
    label: 'The issue text has changed since this output',
    icon: AlertTriangle,
    color: 'var(--color-vermilion)',
  },
  unchanged: { label: 'Unchanged since this run', icon: Check, color: 'var(--color-green)' },
  unknown: {
    label: 'Unknown whether this still matches the issue',
    icon: HelpCircle,
    color: 'var(--color-ink-soft)',
  },
}

function OutputTab({ artifact, divergence }: { artifact: InspectorArtifact; divergence: OutputDivergence }) {
  const meta = DIVERGENCE_META[divergence]
  return (
    <div className="space-y-4">
      <section>
        <TabHeading>Output</TabHeading>
        <p className="whitespace-pre-wrap text-[13px] text-[color:var(--color-ink)]">
          {artifact.output || '—'}
        </p>
        {artifact.output && artifact.output.length >= 2000 && (
          <p className="mt-2 text-[10px] italic text-[color:var(--color-ink-soft)]">
            Snapshot truncated to ~2000 characters.
          </p>
        )}
      </section>
      <LabelIcon icon={meta.icon} color={meta.color}>
        {meta.label}
      </LabelIcon>
      {artifact.outputNote && (
        <p className="text-[13px] text-[color:var(--color-ink-soft)]">{artifact.outputNote}</p>
      )}
    </div>
  )
}

// ── Sources tab ───────────────────────────────────────────────────────────

function SourcesTab({ artifact }: { artifact: InspectorArtifact }) {
  if (!artifact.sources || artifact.sources.length === 0) {
    return <LabelIcon icon={Info}>No sources recorded for this step</LabelIcon>
  }
  return (
    <ul className="space-y-3">
      {artifact.sources.map((source, i) => (
        <li
          key={`${source.title}-${i}`}
          className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-3"
        >
          <p className="text-[13px] font-semibold text-[color:var(--color-ink)]">{source.title}</p>
          {source.mark && (
            <p className="text-[11px] text-[color:var(--color-ink-soft)]">{source.mark}</p>
          )}
          {source.passage && (
            <p className="mt-1 text-[13px] italic text-[color:var(--color-ink)]">
              &ldquo;{source.passage}&rdquo;
            </p>
          )}
          {source.retrievedAt && (
            <p className="mt-1 text-[10px] text-[color:var(--color-ink-soft)]">
              Retrieved {source.retrievedAt}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

// ── Diagnostics tab (§44.8 — "model" has no live Convex source) ────────────

function DiagnosticsTab({ artifact }: { artifact: InspectorArtifact }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <dt className="text-[color:var(--color-ink-soft)]">Cost</dt>
        <dd className="text-[color:var(--color-ink)]">{artifact.cost || '—'}</dd>
        <dt className="text-[color:var(--color-ink-soft)]">Timing</dt>
        <dd className="text-[color:var(--color-ink)]">{artifact.timing || '—'}</dd>
        <dt className="text-[color:var(--color-ink-soft)]">Latency</dt>
        <dd className="text-[color:var(--color-ink)]">{artifact.latency || '—'}</dd>
        <dt className="text-[color:var(--color-ink-soft)]">Validation</dt>
        <dd className="text-[color:var(--color-ink)]">{artifact.validation || '—'}</dd>
      </dl>
      {/* agent_runs has no `model` field (§44.8) — always renders "not
          recorded" today, label+icon, never a blank/undefined value. */}
      <LabelIcon icon={Info}>Model: {artifact.model || 'not recorded'}</LabelIcon>
    </div>
  )
}

// ── Technical tab — raw JSON, the ONLY place it leads (INS-02) ─────────────

function TechnicalTab({ artifact }: { artifact: InspectorArtifact }) {
  const [copied, setCopied] = useState(false)
  const json = prettyJson(artifact.json)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard
              .writeText(json)
              .then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
              .catch(() => {
                // Best-effort — clipboard access can be denied; the raw JSON
                // is still fully visible/selectable in the <pre> below.
              })
          }
        }}
        className="flex min-h-[28px] items-center gap-[6px] font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-cobalt)]"
      >
        <Copy size={12} aria-hidden="true" />
        {copied ? 'Copied' : 'Copy raw JSON'}
      </button>
      <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap break-words border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-2 text-[11px] text-[color:var(--color-ink)]">
        {json}
      </pre>
    </div>
  )
}

// ── InspectorPanel ────────────────────────────────────────────────────────

export function InspectorPanel({
  artifact,
  agentKey,
  promptKey,
  runId,
  missing,
  instructionsExternalized,
  divergence,
  onClose,
  sectionBlocks,
  sectionName,
  onRequestRevision,
}: InspectorPanelProps) {
  // Seven tabs are client state; Summary is the default. Technical (raw
  // JSON) is NEVER the initial value anywhere (INS-02, D-07).
  const [active, setActive] = useState<Tab>('Summary')

  // Phase 45 (REV-01, D-18) — derive a REAL, non-empty excerpt before "Ask
  // agent to revise" is allowed to go live. `firstProseExcerpt` returns ''
  // for an artifact with no prose blocks (claim/rec/org/signal/qa, an empty
  // section, or the container's queries still resolving) — that '' must
  // NEVER be seeded as `quotedText` (span_not_resolved 409, no passage-
  // picker step in `RevisionFlow` to recover from it), so `onAskToRevise`
  // stays undefined and the footer renders honestly reserved instead.
  const quotedText = firstProseExcerpt(sectionBlocks)
  const onAskToRevise =
    sectionName && quotedText && onRequestRevision
      ? () => onRequestRevision({ sectionName, quotedText, blockIndexHint: 0 })
      : undefined

  return (
    <div
      className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[480px] flex-col overflow-y-auto border-l border-[color:var(--color-faint)] bg-[color:var(--color-paper)] shadow-lg"
      role="complementary"
      aria-label="Inspect how this was made"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[color:var(--color-faint)] bg-[color:var(--color-paper)] px-4 py-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]">
            {artifact?.title || agentKey}
          </h2>
          {artifact?.meta && (
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
              {artifact.meta}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded p-1 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card-alt)] hover:text-[color:var(--color-ink)]"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Tab bar — label + icon, never color alone (D-14) */}
      <nav
        aria-label="Inspector tabs"
        className="flex flex-wrap gap-1 border-b border-[color:var(--color-faint)] px-3 py-2"
      >
        {TABS.map((tab) => {
          const Icon = TAB_ICONS[tab]
          const isActive = active === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActive(tab)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[36px] items-center gap-[6px] rounded-[2px] px-2 py-1 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.03em] transition-colors',
                isActive
                  ? 'bg-[color:var(--color-ink)] text-white'
                  : 'text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card-alt)]',
              )}
            >
              <Icon size={13} aria-hidden="true" />
              {tab}
            </button>
          )
        })}
      </nav>

      {/* Tab body */}
      <div className="flex-1 p-4">
        {artifact === undefined ? (
          <LabelIcon icon={Info}>Loading…</LabelIcon>
        ) : (
          <>
            {active === 'Summary' && <SummaryTab artifact={artifact} />}
            {active === 'Inputs' && <InputsTab missing={missing} />}
            {active === 'Instructions' && (
              <InstructionsTab artifact={artifact} instructionsExternalized={instructionsExternalized} />
            )}
            {active === 'Output' && <OutputTab artifact={artifact} divergence={divergence} />}
            {active === 'Sources' && <SourcesTab artifact={artifact} />}
            {active === 'Diagnostics' && <DiagnosticsTab artifact={artifact} />}
            {active === 'Technical' && <TechnicalTab artifact={artifact} />}
          </>
        )}
      </div>

      {/* Phase 50 (WBN-04, D-13) — the SAME sectionName/quotedText derived
          above for "Ask agent to revise" also seeds "Improve this agent →"'s
          origin reference; '' -> undefined so the footer degrades to the
          plain promptHref rather than a params-with-empty-excerpt link. */}
      <InspectorFooter
        promptKey={promptKey}
        agentKey={agentKey}
        runId={runId}
        onAskToRevise={onAskToRevise}
        sectionName={sectionName}
        excerpt={quotedText || undefined}
      />
    </div>
  )
}
