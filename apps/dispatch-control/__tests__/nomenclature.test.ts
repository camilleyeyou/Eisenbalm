/**
 * WBN-05 source-scan tripwire (banned-legacy-term sweep).
 *
 * TODO(50-06): un-skip after the sweep lands. This suite is authored FULLY
 * now (Phase 50 Wave 0 scaffold) so 50-06 only needs to flip `describe.skip`
 * -> `describe`; operator-facing copy has not yet been swept across Waves
 * 1-2, so running this for real today would be RED across many files.
 *
 * Mirrors the recursive-fs regex-scan pattern from
 * `roleGateInventory.test.ts` / `dispatch-control-no-sanity-write.test.ts`.
 *
 * Design (RESEARCH.md §Validation Architecture, §Pitfall 3):
 *   1. Scan ONLY `apps/dispatch-control/app/` + `components/` (excluding
 *      `__tests__/`, `.next/`, `node_modules/`).
 *   2. Scan rendered JSX text nodes + string-literal props (`title=`,
 *      `aria-label=`, `placeholder=`, and visible children) — NOT raw file
 *      content, comments, or code identifiers — so this never trips on
 *      route path strings, node ids, stored enum literals, or internal
 *      state variable names.
 *   3. FORBIDDEN_COPY_TERMS covers BOTH the spec's "old" column AND the
 *      already-live 260710-k8y conflict terms (Rehearsal / Make live / LIVE
 *      / Draft vs. live) AND the three nomenclature-table rows confirmed
 *      live (Coverage memory / registry record, never seeded / seeded,
 *      blocking).
 *   4. ALLOWLIST covers legitimate code identifiers/route paths/stored
 *      enum literals so the scan never flags them.
 *
 * If this test fails after being un-skipped, DO NOT weaken the assertions —
 * fix the operator-facing copy to the product term instead.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, it, expect } from 'vitest'

const APP_ROOT = path.resolve(__dirname, '..')
const SEARCH_DIRS = ['app', 'components'].map(d => path.join(APP_ROOT, d))
const EXCLUDE_DIR_NAMES = ['__tests__', '.next', 'node_modules']

interface ForbiddenTerm {
  pattern: RegExp
  product: string
}

/**
 * Banned legacy terms (spec's "old" column) + the already-live 260710-k8y
 * conflict vocabulary + the three confirmed-live nomenclature-table rows.
 * Mapped to the product term the WBN-05 sweep must land instead.
 */
const FORBIDDEN_COPY_TERMS: ForbiddenTerm[] = [
  { pattern: /\bGate\s*1\b/i, product: 'Choose recommended story / deterministic check' },
  { pattern: /\bcode gate\b/i, product: 'deterministic check' },
  { pattern: /\bgate\b(?!\w)/i, product: 'deterministic check' },
  { pattern: /\bre-?run from (this )?node\b/i, product: 'Restart from this step' },
  { pattern: /\bnode\b/i, product: 'step' },
  { pattern: /\bshadow run\b/i, product: 'Preview next run' },
  { pattern: /\bgolden[- ]?scenario\b/i, product: 'Standard test case' },
  { pattern: /\bblocklist(ed)?\b/i, product: 'Do not use' },
  { pattern: /\brun evals?\b/i, product: 'Test changes / Quality test' },
  { pattern: /\beval\b/i, product: 'Test changes / Quality test' },
  { pattern: /\bcommit\b/i, product: 'Make active / Restore version' },
  { pattern: /\brollback\b/i, product: 'Make active / Restore version' },
  // 260710-k8y conflict terms — a newer, still-wrong vocabulary.
  { pattern: /Rehearsal/, product: 'Test changes' },
  { pattern: /Make live|Making live/, product: 'Make active' },
  { pattern: />LIVE</, product: 'active version' },
  { pattern: /\bLIVE badge\b/, product: 'active version' },
  { pattern: /Draft vs\.?\s*live/i, product: 'Compare results' },
  { pattern: /\bAuto-publish ON\b/, product: 'Human approval required / Administration' },
  // Confirmed-live nomenclature-table rows.
  { pattern: /Coverage memory/i, product: 'Recent coverage' },
  { pattern: /registry record/i, product: 'Organization history' },
  { pattern: /\bnever seeded\b/i, product: 'no starting version' },
  { pattern: /\bseeded\b/i, product: 'has a starting version / no starting version' },
  { pattern: /\bblocking\b/i, product: 'Must fix' },
]

/**
 * Legitimate code identifiers / route paths / stored enum literals that must
 * NEVER be flagged, even though a substring might otherwise match a
 * FORBIDDEN_COPY_TERMS pattern (e.g. `verify_candidates` contains no banned
 * substring, but `editor_gate_1` — a node id — must never be confused with
 * prose "Gate 1"; `blocklisted`/`charity.blocklisted` are stored values, not
 * copy; `seeded`/`setSeeded` are React state identifiers, not prose).
 */
const ALLOWLIST: RegExp[] = [
  /\/run-monitor\b/,
  /\/prompt-lab\b/,
  /\/eval-center\b/,
  /\/registry\b/,
  /'blocklisted'/,
  /charity\.blocklisted/,
  /\beditor_gate_1\b/,
  /\bverify_research\b/,
  /\bverify_candidates\b/,
  /\bvalidate_sections\b/,
  /\bEvalDrawer\b/,
  /\bevalScores\b/,
  /\beval_scores\b/,
  /\bEvalCenter\w*/,
  /\bseeded\s*[,)\]]/, // `seeded` as a bare destructured/state identifier
  /\bsetSeeded\b/,
  /seed-?script/i,
]

interface Violation {
  file: string
  line: number
  snippet: string
  pattern: string
  product: string
}

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIR_NAMES.includes(entry.name)) continue
      results.push(...listSourceFiles(path.join(dir, entry.name)))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (ext === '.ts' || ext === '.tsx') results.push(path.join(dir, entry.name))
    }
  }
  return results
}

/**
 * Extract candidate "operator-facing copy" snippets from a source file:
 * JSX text nodes (content between `>` and `<`) and string-literal values of
 * `title=` / `aria-label=` / `placeholder=` props. Returns each candidate
 * with its 1-based line number for readable violation messages.
 *
 * This is intentionally NOT a full JSX parse — a lightweight regex scan is
 * sufficient to keep raw identifiers, imports, and comments out of scope
 * (per RESEARCH §Validation Architecture #2), while still catching the
 * rendered strings operators actually see.
 */
function extractCopyCandidates(content: string): { text: string; line: number }[] {
  const candidates: { text: string; line: number }[] = []
  const lines = content.split('\n')

  const propPattern = /(?:title|aria-label|placeholder)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  const jsxTextPattern = />([^<>{}\n]+)</g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    let propMatch: RegExpExecArray | null
    propPattern.lastIndex = 0
    while ((propMatch = propPattern.exec(line)) !== null) {
      const value = propMatch[1] ?? propMatch[2] ?? ''
      if (value.trim().length > 0) candidates.push({ text: value, line: i + 1 })
    }

    let textMatch: RegExpExecArray | null
    jsxTextPattern.lastIndex = 0
    while ((textMatch = jsxTextPattern.exec(line)) !== null) {
      const value = textMatch[1] ?? ''
      if (value.trim().length > 0) candidates.push({ text: value, line: i + 1 })
    }
  }

  return candidates
}

function isAllowlisted(text: string): boolean {
  return ALLOWLIST.some(pattern => pattern.test(text))
}

function collectViolations(files: string[]): Violation[] {
  const violations: Violation[] = []
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const candidates = extractCopyCandidates(content)
    for (const candidate of candidates) {
      if (isAllowlisted(candidate.text)) continue
      for (const term of FORBIDDEN_COPY_TERMS) {
        if (term.pattern.test(candidate.text)) {
          violations.push({
            file,
            line: candidate.line,
            snippet: candidate.text,
            pattern: term.pattern.toString(),
            product: term.product,
          })
        }
      }
    }
  }
  return violations
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
describe.skip('WBN-05: no legacy nomenclature term survives in operator-facing copy', () => {
  it('app/ + components/ contain zero FORBIDDEN_COPY_TERMS in rendered JSX text or string props', () => {
    const files = SEARCH_DIRS.flatMap(listSourceFiles)
    expect(files.length).toBeGreaterThan(0) // sanity: directory scan actually found files

    const violations = collectViolations(files)

    if (violations.length > 0) {
      throw new Error(
        'FORBIDDEN legacy nomenclature term found (WBN-05 violation):\n' +
          violations
            .map(
              v =>
                `  ${v.file}:${v.line} "${v.snippet}" matches ${v.pattern} -> use "${v.product}"`,
            )
            .join('\n'),
      )
    }
  })
})
