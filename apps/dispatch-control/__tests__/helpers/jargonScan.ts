import { readFileSync } from 'node:fs'

export const UI_JARGON =
  /\b(runs?|trigger(ed)?|pipeline|graph|DAG|drift|re-?roll(ed)?|calibrator|chronicler|tokens?|agents?|interrupt|deterministic|awaiting[- ]review|failed|run detail)\b/i

/**
 * Returns user-facing strings in a .tsx/.ts source that contain jargon: JSX text
 * between tags, and string values of label/title/description/placeholder/
 * aria-label/heading/confirmLabel/cancelLabel/body props or object keys. Code
 * identifiers, imports, comments and className values are ignored. `allow` =
 * exact flagged strings a caller has reviewed as code, not UI text (each needs
 * a comment in the calling test).
 */
export function jargonInSource(path: string, allow: string[] = []): string[] {
  const src = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  const found: string[] = []
  for (const m of src.matchAll(/>([^<>{}]+)</g)) {
    const t = m[1].trim()
    if (t) found.push(t)
  }
  const propRe =
    /(?:label|title|description|placeholder|aria-label|heading|confirmLabel|cancelLabel|body)\s*[:=]\s*(['"`])((?:(?!\1).)*)\1/g
  for (const m of src.matchAll(propRe)) found.push(m[2])
  return found.filter((s) => UI_JARGON.test(s) && !allow.includes(s))
}
