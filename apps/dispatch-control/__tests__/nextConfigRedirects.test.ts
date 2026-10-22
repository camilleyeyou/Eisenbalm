/**
 * Quick 261021-j83 (D-9) — old console URLs redirect (307) straight to a live
 * page: no chains, and every destination exists on disk.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import nextConfig from '../next.config'

type Rule = { source: string; destination: string; permanent: boolean }
const appRoot = path.resolve(__dirname, '..', 'app')

async function rules(): Promise<Rule[]> {
  return (await nextConfig.redirects!()) as Rule[]
}

/** First-match resolution of a concrete URL against the rule list. */
function resolve(rs: Rule[], url: string): string | null {
  for (const r of rs) {
    const names: string[] = []
    // Single pass so capture-group order matches the order names appear.
    const pattern = r.source.replace(/(\/?):([A-Za-z]+)(\*)?/g, (_m, slash, n, star) => {
      names.push(n)
      return star ? '(?:/(.*))?' : `${slash}([^/]+)`
    })
    const m = new RegExp('^' + pattern + '$').exec(url)
    if (m) {
      const vals: Record<string, string> = {}
      names.forEach((n, i) => (vals[n] = m[i + 1] ?? ''))
      return r.destination.replace(/(\/?):([A-Za-z]+)\*?/g, (_x, slash, n) =>
        vals[n] ? `${slash}${vals[n]}` : '',
      ) || '/'
    }
  }
  return null
}

/** Resolves a destination to a page.tsx, letting any segment match a literal dir or a [dynamic] dir. */
function pageExists(dest: string): boolean {
  const segs = (dest.split('?')[0] || '/').split('/').filter(Boolean).map(s => s.replace(/^:(.+)$/, '[$1]'))
  function walk(dir: string, rest: string[]): boolean {
    if (rest.length === 0) return fs.existsSync(path.join(dir, 'page.tsx'))
    if (!fs.existsSync(dir)) return false
    const [head, ...tail] = rest
    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory())
    const literal = entries.find(e => e.name === head)
    if (literal && walk(path.join(dir, literal.name), tail)) return true
    return entries.some(e => /^\[[^\]]+\]$/.test(e.name) && walk(path.join(dir, e.name), tail))
  }
  return walk(path.join(appRoot, '(editorial)'), segs) || walk(appRoot, segs)
}

const TABLE: Array<[string, string]> = [
  ['/issues', '/archive'],
  ['/issues/7', '/archive?issue=7'],
  ['/issues/7/story', '/archive?issue=7'],
  ['/issues/7/draft', '/archive?issue=7'],
  ['/issues/7/review', '/archive?issue=7'],
  ['/issues/7/fact-check', '/archive?issue=7'],
  ['/issues/7/voice', '/archive?issue=7'],
  ['/issues/7/approval', '/archive?issue=7'],
  ['/issues/7/runs/run_1', '/admin/runs/run_1'],
  ['/run', '/'],
  ['/my-tasks', '/'],
  ['/how-to-use', '/'],
  ['/review-desk', '/'],
  ['/review-desk/run_1', '/s/originStory?run=run_1'],
  ['/voice-pass', '/'],
  ['/voice-pass/run_1', '/'],
  ['/run-monitor/runs/run_1/review', '/admin/runs/run_1'],
  ['/signal-desk', '/'],
  ['/run-monitor', '/admin/runs'],
  ['/run-monitor/runs', '/admin/runs'],
  ['/run-monitor/runs/run_1', '/admin/runs/run_1'],
  ['/run-monitor/graph', '/admin/runs/graph'],
  ['/prompt-lab', '/admin/agents'],
  ['/prompt-lab/scout', '/admin/agents/scout'],
  ['/eval-center', '/admin/tests'],
  ['/registry', '/admin/charities'],
  ['/config', '/admin/automation'],
  ['/finance', '/admin/finance'],
  ['/settings', '/admin/settings'],
  // Phase 30 names, retargeted
  ['/graph', '/admin/runs/graph'],
  ['/runs', '/admin/runs'],
  ['/runs/run_1', '/admin/runs/run_1'],
  ['/prompts', '/admin/agents'],
  ['/prompts/scout', '/admin/agents/scout'],
]

describe('next.config redirects', () => {
  it('are all temporary (307)', async () => {
    for (const r of await rules()) expect(r.permanent).toBe(false)
  })

  it.each(TABLE)('%s -> %s', async (from, to) => {
    expect(resolve(await rules(), from)).toBe(to)
  })

  it('no destination is also a source (no redirect chains)', async () => {
    const rs = await rules()
    for (const r of rs) {
      // A concrete instance of the destination must not match any rule.
      const concrete = r.destination.replace(/:[A-Za-z]+\*?/g, 'x')
      expect(resolve(rs, concrete), `${r.source} -> ${r.destination}`).toBeNull()
    }
  })

  it('every destination page exists on disk', async () => {
    for (const r of await rules()) {
      const dest = r.destination.replace(/\/:[A-Za-z]+\*$/, '/:rest')
      const clean = dest.replace(/:rest$/, '').replace(/\/$/, '') || '/'
      // catch-all (:path*) destinations resolve to their base page
      const target = r.destination.endsWith('*') ? clean : r.destination
      // Dynamic section segments (/s/originStory) map to the [section] page.
      if (target === '/') {
        expect(fs.existsSync(path.join(appRoot, '(editorial)', 'page.tsx'))).toBe(true)
      } else {
        expect(pageExists(target), r.destination).toBe(true)
      }
    }
  })
})
