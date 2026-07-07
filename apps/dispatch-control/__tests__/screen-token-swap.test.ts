/**
 * screen-token-swap.test.ts — 1c token-swap tripwire for Config/Finance/Settings
 * (CHR-01, Phase 30-03).
 *
 * Source-scan only (reads file contents with node:fs) — no rendering. Per
 * 30-RESEARCH.md Pitfall 1, a globals.css :root variable remap does NOT restyle
 * these screens because they use literal `neutral-*`/`white`/`black` Tailwind
 * classes that compile to fixed hex values and are unaffected by CSS-variable
 * changes. This test locks the absence of those literal classes across the 13
 * known Config/Finance/Settings files, and asserts each file references at
 * least one 1c token arbitrary-value class in its place.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const appRoot = path.resolve(__dirname, '..')

// The 13 files_modified from 30-03-screen-token-swap-PLAN.md — hardcoded per
// the plan's <behavior> instruction, not dynamically globbed.
const FILES = [
  'app/(dashboard)/config/page.tsx',
  'app/(dashboard)/config/_components/NextRunDisplay.tsx',
  'app/(dashboard)/config/_components/BudgetCapsPanel.tsx',
  'app/(dashboard)/config/_components/AutomationPanel.tsx',
  'app/(dashboard)/config/_components/AutoPublishToggle.tsx',
  'app/(dashboard)/finance/page.tsx',
  'app/(dashboard)/finance/_components/PayoutRow.tsx',
  'app/(dashboard)/finance/_components/FinanceSummaryCard.tsx',
  'app/(dashboard)/finance/_components/ModelPricingCard.tsx',
  'app/(dashboard)/finance/_components/IssueRevenueTable.tsx',
  'app/(dashboard)/settings/page.tsx',
  'app/(dashboard)/settings/_components/NotificationSettings.tsx',
  'app/(dashboard)/settings/_components/AuditLogViewer.tsx',
]

const TOKEN_MARKER = '[color:var(--color-'

describe('Config/Finance/Settings 1c token swap (source-scan)', () => {
  for (const relPath of FILES) {
    const absPath = path.join(appRoot, relPath)
    const contents = fs.readFileSync(absPath, 'utf-8')

    describe(relPath, () => {
      it('contains no literal `neutral-` Tailwind class token', () => {
        expect(contents).not.toMatch(/neutral-/)
      })

      it('contains no literal `bg-white` class', () => {
        expect(contents).not.toMatch(/bg-white\b/)
      })

      it('contains no literal `text-white` class', () => {
        expect(contents).not.toMatch(/text-white\b/)
      })

      it('contains no literal `text-black` class', () => {
        expect(contents).not.toMatch(/text-black\b/)
      })

      it('references at least one 1c token arbitrary-value class', () => {
        expect(contents).toContain(TOKEN_MARKER)
      })
    })
  }
})
