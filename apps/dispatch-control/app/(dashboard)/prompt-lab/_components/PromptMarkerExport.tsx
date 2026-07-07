'use client'
/**
 * Phase 28 (PRC-10) — copyable `.md`-marker export of the active prompt.
 *
 * Renders the active content wrapped in the EXACT pipeline marker byte form so
 * an operator can copy it and commit it to the `.md` source of truth. The byte
 * form satisfies the loader contract in
 * packages/.../lib/prompts.py::_extract — content lives between
 * `<!-- PROMPT START -->` and `<!-- PROMPT END -->`, with exactly ONE leading
 * newline after START and ONE trailing newline before END stripped on load. So
 * copy→commit keeps `load_prompt()` byte-verification passing.
 *
 * Honest boundary (D-03): this is copy-to-clipboard only — it never writes to
 * the repo.
 */
import { useState } from 'react'

const PROMPT_START = '<!-- PROMPT START -->'
const PROMPT_END = '<!-- PROMPT END -->'

/**
 * Build the exact round-trippable marker byte form for `content`:
 *   `<!-- PROMPT START -->\n` + content + `\n<!-- PROMPT END -->`
 *
 * Stripping one leading + one trailing newline from between the markers
 * returns `content` verbatim (matches prompts.py::_extract).
 */
export function buildMarkerExport(content: string): string {
  return `${PROMPT_START}\n${content}\n${PROMPT_END}`
}

export default function PromptMarkerExport({ content }: { content: string }) {
  const md = buildMarkerExport(content)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable (e.g. insecure context) — fail silently; the
      // <pre> still shows the exact bytes for manual selection.
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          .md export (copy → commit)
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 min-h-[44px]"
        >
          {copied ? 'Copied' : 'Copy .md'}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs text-neutral-700">
        {md}
      </pre>
    </div>
  )
}
