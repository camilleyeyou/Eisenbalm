/**
 * Phase 24 (PRM-02) — CodeMirror 6 `{variable}` highlight extension.
 *
 * A StateField + DecorationSet (24-RESEARCH Pattern 2) that scans the document
 * for `{WORD}` tokens and marks known tokens `.cm-var-known` and unknown /
 * mangled tokens `.cm-var-unknown`. Decorations rebuild on docChanged.
 *
 * Styling lives in app/globals.css scoped under the editor wrapper.
 */
import { StateField, RangeSetBuilder } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'

const VARIABLE_REGEX = /\{([^}]+)\}/g

const knownDecoration = Decoration.mark({ class: 'cm-var-known' })
const unknownDecoration = Decoration.mark({ class: 'cm-var-unknown' })

function buildDecorations(text: string, allowed: Set<string>): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  let m: RegExpExecArray | null
  VARIABLE_REGEX.lastIndex = 0
  while ((m = VARIABLE_REGEX.exec(text)) !== null) {
    const varName = m[1].trim()
    const deco = allowed.has(varName) ? knownDecoration : unknownDecoration
    builder.add(m.index, m.index + m[0].length, deco)
  }
  return builder.finish()
}

/**
 * Build a StateField highlighter bound to `allowedVars`. Recreate this via
 * useMemo whenever the allowed set changes (Pitfall 1 — stale closure on agent
 * switch) so the editor re-decorates against the new agent's registry.
 */
export function variableHighlighter(allowedVars: string[]) {
  const allowed = new Set(allowedVars)
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state.doc.toString(), allowed)
    },
    update(decos, tr) {
      if (!tr.docChanged) return decos
      return buildDecorations(tr.newDoc.toString(), allowed)
    },
    provide: f => EditorView.decorations.from(f),
  })
}
